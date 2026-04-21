// ============================================================
// smb-behavior-model.js — Player Behavior Fingerprinting
//
// Plugs into AdaptiveAI to add:
//   • Per-context bigram prediction (grounded / airborne / edge)
//   • Dynamic confidence thresholds — strict early, loose after ~200 obs
//   • Punish-route ledger with adaptive rotation & escape-cooldowns
//   • Acceleration-aware anticipatory position projection
//
// Load order: after smb-adaptive-ai.js, before smb-sovereign-mk2.js
// Uses globals: GAME_W, currentArena (from smb-globals.js)
// All classes/constants exposed as globals — no import/export.
// ============================================================

// ─── Player action constants ──────────────────────────────────
// Edge-detected once per AI tick; used as bigram indices.
const PA = Object.freeze({
  IDLE        : 0,
  WALK        : 1,
  JUMP        : 2,
  ATTACK      : 3,
  AIRBORNE_ATK: 4,
  BLOCK       : 5,
  LAND        : 6,
});
const _PA_COUNT = 7;

// ─── Spatial context constants ────────────────────────────────
// Separate bigrams per context so grounded/airborne/edge
// sequences are predicted independently.
const BM_CTX = Object.freeze({
  GROUNDED: 0,  // on ground, not near wall
  AIRBORNE: 1,  // in the air
  EDGE    : 2,  // within 80 px of left or right wall
});
const _BM_CTX_COUNT = 3;

// ─── Action classifier ───────────────────────────────────────
// Requires prevSnapshot = { onGround, vx, vy } from the previous tick.
function _bmClassifyAction(p, prevSnap) {
  if (!prevSnap) return PA.IDLE;
  const justLanded = p.onGround  && !prevSnap.onGround;
  const justJumped = !p.onGround &&  prevSnap.onGround && p.vy < 0;
  if (justLanded)                        return PA.LAND;
  if (justJumped)                        return PA.JUMP;
  if (p.attackTimer > 0 && !p.onGround) return PA.AIRBORNE_ATK;
  if (p.attackTimer > 0)                return PA.ATTACK;
  if (p.shielding)                      return PA.BLOCK;
  if (Math.abs(p.vx) > 1.2)            return PA.WALK;
  return PA.IDLE;
}

// ─── Context classifier ───────────────────────────────────────
function _bmClassifyContext(p) {
  const nearEdge = p.x < 80 || p.x + (p.w || 34) > GAME_W - 80;
  if (nearEdge)    return BM_CTX.EDGE;
  if (!p.onGround) return BM_CTX.AIRBORNE;
  return BM_CTX.GROUNDED;
}

// ═════════════════════════════════════════════════════════════
// BehaviorModel
// ═════════════════════════════════════════════════════════════
class BehaviorModel {
  constructor() {
    // Per-context bigram: _bigram[ctx][prevAction][nextAction]
    // 3 × 7 × 7 = 147 floats — negligible memory cost.
    this._bigram = [];
    for (let c = 0; c < _BM_CTX_COUNT; c++) {
      this._bigram.push(
        Array.from({ length: _PA_COUNT }, () => new Float32Array(_PA_COUNT))
      );
    }

    // Per-context accumulated observation counts (decayed)
    this._ctxObs = new Float32Array(_BM_CTX_COUNT);

    // Overall action frequencies (context-agnostic, for bias weights)
    this._freq    = new Float32Array(_PA_COUNT);
    this._totalObs = 0;

    // Previous-tick state (seeded to safe defaults)
    this._prevAction = PA.IDLE;
    this._prevCtx    = BM_CTX.GROUNDED;

    // Decay: apply every _decayInterval frames to keep recent data dominant.
    // decayRate 0.993 → half-life ≈ 99 frames (~1.65 s at 60 fps).
    this._decayRate     = 0.993;
    this._decayTick     = 0;
    this._decayInterval = 6;

    // ── Punish ledger ─────────────────────────────────────────
    // Three routes. Ledger entry: { hits, escapes, cooldown }.
    //   direct  — sprint in, basic swing (default)
    //   crossup — jump over target, attack from behind
    //   delayed — normal approach but with a timing-trip pause
    this._ledger = {
      direct : { hits: 0, escapes: 0, cooldown: 0 },
      crossup: { hits: 0, escapes: 0, cooldown: 0 },
      delayed: { hits: 0, escapes: 0, cooldown: 0 },
    };
    this._punishCount = 0;   // total selections (drives rotation cadence)
    this._lastRoute   = 'direct';
  }

  // ─── observe() ───────────────────────────────────────────────
  // Call once per AI tick with the current target (player) state
  // and the snapshot captured on the previous tick.
  // Updates all matrices and ticks ledger cooldowns.
  // Returns { action, context } for use in the same tick.
  observe(player, prevSnapshot) {
    const action  = _bmClassifyAction(player, prevSnapshot);
    const context = _bmClassifyContext(player);

    // Periodic decay — not every frame (saves multiply ops)
    this._decayTick++;
    if (this._decayTick >= this._decayInterval) {
      this._decayTick = 0;
      const d = this._decayRate;
      for (let c = 0; c < _BM_CTX_COUNT; c++) {
        this._ctxObs[c] *= d;
        for (let i = 0; i < _PA_COUNT; i++) {
          const row = this._bigram[c][i];
          for (let j = 0; j < _PA_COUNT; j++) row[j] *= d;
        }
      }
      for (let i = 0; i < _PA_COUNT; i++) this._freq[i] *= d;
      this._totalObs *= d;
    }

    // Record transition: (prevCtx, prevAction) → action
    this._bigram[this._prevCtx][this._prevAction][action] += 1;
    this._ctxObs[this._prevCtx] += 1;
    this._freq[action] += 1;
    this._totalObs     += 1;

    // Tick punish-route cooldowns
    for (const e of Object.values(this._ledger)) {
      if (e.cooldown > 0) e.cooldown--;
    }

    this._prevAction = action;
    this._prevCtx    = context;

    return { action, context };
  }

  // ─── predictNext() ───────────────────────────────────────────
  // Returns the most likely next action from the current (action, context).
  //
  // Dynamic confidence gate:
  //   - Starts at 0.65 (very tight — needs strong signal before committing)
  //   - Loosens linearly to 0.38 after ~195 per-context observations
  //   - This prevents the AI from pre-dodging on random noise early on
  //
  // Returns { action, confidence, minConf }.
  // action === PA.IDLE means "not confident enough to act on prediction."
  predictNext(currentAction, context) {
    const ctxObs = this._ctxObs[context];

    // Dynamic threshold: 0.65 → 0.38 as ctxObs grows toward 195
    const minConf = Math.max(0.38, 0.65 - ctxObs * 0.0014);

    const row = this._bigram[context][currentAction];
    let total = 0;
    for (let j = 0; j < _PA_COUNT; j++) total += row[j];
    if (total < 4) return { action: PA.IDLE, confidence: 0, minConf };

    let bestIdx = 0, bestVal = -1;
    for (let j = 0; j < _PA_COUNT; j++) {
      if (row[j] > bestVal) { bestVal = row[j]; bestIdx = j; }
    }
    const confidence = bestVal / total;

    return {
      action    : confidence >= minConf ? bestIdx : PA.IDLE,
      confidence,
      minConf,
    };
  }

  // ─── attackProb() ────────────────────────────────────────────
  // Marginal probability the player will attack given their context.
  // Used to scale bait activation (aggressive players bite less often).
  attackProb(context) {
    const ctxObs = this._ctxObs[context];
    if (ctxObs < 5) return 0.30;  // uninformed prior

    let atkSum = 0, total = 0;
    for (let i = 0; i < _PA_COUNT; i++) {
      const row = this._bigram[context][i];
      for (let j = 0; j < _PA_COUNT; j++) {
        if (j === PA.ATTACK || j === PA.AIRBORNE_ATK) atkSum += row[j];
        total += row[j];
      }
    }
    return total > 0 ? atkSum / total : 0.30;
  }

  // ─── computeBias() ───────────────────────────────────────────
  // Derives score multipliers from the behavior model for use in
  // AdaptiveAI's decision logic.
  //
  // Returns:
  //   dodgeBoost     — multiply Phase-1 dodge threshold (prediction-driven)
  //   approachBoost  — multiply approach speed (jumpy player → close in faster)
  //   baitBoost      — multiply bait activation chance (idle/defensive player)
  //   preDodgeFrames — frames to pre-position if attack is confidently predicted
  //   atkProb        — marginal attack probability for the caller to inspect
  computeBias(currentAction, prediction) {
    const ctx     = this._prevCtx;
    const atkProb = this.attackProb(ctx);
    const safe    = Math.max(1, this._totalObs);

    const jumpFreq  = this._freq[PA.JUMP]  / safe;
    const idleFreq  = this._freq[PA.IDLE]  / safe;
    const blockFreq = this._freq[PA.BLOCK] / safe;

    const predAtk = prediction.action === PA.ATTACK ||
                    prediction.action === PA.AIRBORNE_ATK;

    // Dodge boost: spikes when prediction is confident and attack is incoming
    const dodgeBoost = predAtk
      ? Math.max(1, 1 + prediction.confidence * 1.8)
      : 1;

    // Approach boost: close faster when player is airborne-heavy
    const approachBoost = jumpFreq > 0.18 ? 1.28 : 1.0;

    // Bait boost: passive/defensive players bite bait more reliably
    const baitRaw   = idleFreq > 0.28 ? 1.90 : blockFreq > 0.20 ? 1.55 : 1.0;
    // Scale down bait when player is very aggressive (they attack through it)
    const baitBoost = Math.max(1, baitRaw * (1 - Math.min(0.60, atkProb * 0.75)));

    // Pre-dodge frames: only commit if confidence exceeds 0.52
    // 0.52 → 3 frames early;  1.0 → 7 frames early
    const preDodgeFrames = (predAtk && prediction.confidence > 0.52)
      ? Math.round(3 + (prediction.confidence - 0.52) * 8.3)
      : 0;

    return { dodgeBoost, approachBoost, baitBoost, preDodgeFrames, atkProb };
  }

  // ─── bestPunishRoute() ───────────────────────────────────────
  // Selects the punish route to use, incrementing _punishCount.
  //
  // Selection logic:
  //   1. Every 5th punish, 35% chance to force-rotate to a different
  //      available route — prevents the AI from becoming one-note.
  //   2. Otherwise: Laplace-smoothed success rate = (hits+0.5)/(hits+escapes+1)
  //      Routes on cooldown (recently escaped) are skipped.
  bestPunishRoute() {
    const routes = ['direct', 'crossup', 'delayed'];
    this._punishCount++;

    // Forced rotation: avoids the AI becoming exploitable on a single route
    if (this._punishCount % 5 === 0 && Math.random() < 0.35) {
      const avail = routes.filter(r =>
        this._ledger[r].cooldown === 0 && r !== this._lastRoute
      );
      if (avail.length) {
        const r = avail[Math.floor(Math.random() * avail.length)];
        this._lastRoute = r;
        return r;
      }
    }

    // Weighted pick
    let best = 'direct', bestScore = -1;
    for (const r of routes) {
      const e = this._ledger[r];
      if (e.cooldown > 0) continue;
      const score = (e.hits + 0.5) / (e.hits + e.escapes + 1);
      if (score > bestScore) { bestScore = score; best = r; }
    }

    this._lastRoute = best;
    return best;
  }

  // ─── recordPunish() ──────────────────────────────────────────
  // Called ~22 frames after a punish attempt to record the outcome.
  // 'landed' = true if target HP dropped since the attempt.
  // Escaped punishes put the route on a random 60–120 frame cooldown.
  recordPunish(route, landed) {
    const e = this._ledger[route];
    if (!e) return;
    if (landed) {
      e.hits++;
    } else {
      e.escapes++;
      e.cooldown = 60 + Math.floor(Math.random() * 61);  // 1–2 s
    }
  }

  // ─── projectPosition() ───────────────────────────────────────
  // Simulates N frames of physics to anticipate where the player
  // centre will be. Accounts for current velocity, gravity, and
  // ground/air drag. Clamps to horizontal arena bounds.
  //
  // Good-enough for an 8-frame lookahead; ignores platform landing
  // (the error is < 15 px over that window).
  projectPosition(player, frames) {
    // Infer arena gravity from currentArena flags (mirrors Fighter.update logic)
    let grav = 0.65;
    if (typeof currentArena !== 'undefined' && currentArena) {
      const gravMult = (currentArena.modifiers && currentArena.modifiers.gravityMult) || 1.0;
      if      (currentArena.isLowGravity)   grav = 0.28;
      else if (currentArena.isHeavyGravity) grav = 0.95;
      else if (currentArena.earthPhysics)   grav = 0.88;
      grav *= gravMult;
    }

    const MAX_VY  = 18;
    const FRIC_GR = 0.78;   // ground friction (matches Fighter.update)
    const FRIC_AI = 0.94;   // air friction

    let px       = player.cx();
    let py       = player.cy();
    let vx       = player.vx;
    let vy       = player.vy;
    let onGround = player.onGround;

    for (let i = 0; i < frames; i++) {
      if (!onGround) vy = Math.min(vy + grav, MAX_VY);
      vx *= onGround ? FRIC_GR : FRIC_AI;
      px += vx;
      py += vy;
      // Simplified floor landing (ignores platforms — acceptable for short lookahead)
      if (py > GAME_H - 30 && !onGround) { onGround = true; vy = 0; }
    }

    // Clamp to horizontal arena bounds
    px = Math.max(30, Math.min(GAME_W - 30, px));
    return { x: px, y: py };
  }
}
