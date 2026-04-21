// ============================================================
// SOVEREIGN Ω  —  Next-Generation Adaptive AI
// Extends AdaptiveAI with five new systems:
//   A. Prediction  — bigram sequence learning; preemptive counters
//   B. Punishment  — spam/repetition detection; aggro-burst mode
//   C. Limiter Break — permanent power-up at peak intelligence
//   D. Anti-Exploit — stall / edge-camp / button-spam detection
//   E. Humanization — early delays + fake-outs; ramps to inhuman
//
// Used ONLY in gameMode === 'sovereign'. Story mode keeps AdaptiveAI.
// ============================================================
'use strict';

// ── Action classifier priority ──────────────────────────────
// Returns a string tag for the player's current action each AI tick.
// Priority: attack > shield > dodge > jump > idle
function _smk2ClassifyAction(t, prevT) {
  if (t.attackTimer > 0 && !(prevT && prevT.attacking))  return 'attack'; // rising edge
  if (t.shielding  && !(prevT && prevT.shielding))        return 'shield'; // rising edge
  const vxFlip = prevT && Math.abs(t.vx) > 3 && Math.sign(t.vx) !== Math.sign(prevT.vx || 0);
  if (vxFlip)                                             return 'dodge';
  if (!t.onGround && prevT && prevT.onGround)             return 'jump';   // rising edge
  return 'idle';
}

// ── Dialogue pools ───────────────────────────────────────────
const SMK2_PUNISH_LINES = [
  'You keep doing that.',
  'Three times. Same thing.',
  'Stop. It isn\'t working.',
  'I\'ve filed that away.',
  'You\'re making this easier.',
];
const SMK2_LIMITER_LINES = [
  'Limiters are a courtesy. Withdrawn.',
  'I was holding back. I\'m not anymore.',
  'Full output. Let\'s see if you can keep up.',
  'There is no ceiling above me.',
];
const SMK2_EXPLOIT_STALL = [
  'You\'re not hiding. You\'re waiting to lose.',
  'Standing still just makes it easier.',
  'I\'ll come to you, then.',
];
const SMK2_EXPLOIT_EDGE = [
  'The edge won\'t save you.',
  'There\'s nowhere left to go.',
  'I prefer the center.',
];
const SMK2_EXPLOIT_SPAM = [
  'Your habits are showing.',
  'I\'ve seen this pattern.',
  'Interesting choice. To repeat it.',
];
const SMK2_PREDICT_LINES = [
  'I knew you\'d do that.',
  'Called it.',
  'Predictable.',
  'There it is.',
];
const SMK2_EVOLUTION_LINES = [
  'I\'m starting to see the shape of you.',
  'Now I know what you reach for.',
  'Every exchange improves me.',
  'You\'re not fighting me anymore. You\'re feeding me.',
];
const SMK2_INTIMIDATION_LINES = [
  'Feel that? That\'s your space disappearing.',
  'You can feel the answer before you move.',
  'There\'s pressure on every option now.',
  'You\'re running out of safe habits.',
];
const SMK2_DOMINANCE_LINES = [
  'You\'re predictable.',
  'Again?',
  'That won\'t work.',
  'Same answer. Same punishment.',
];
const SMK2_STAGE_NAMES = ['OBSERVING', 'READING', 'DOMINATING', 'TYRANT'];

class SovereignMK2 extends AdaptiveAI {
  constructor(x, y, color, weaponKey) {
    super(x, y, color, weaponKey);

    this.name           = 'SOVEREIGN Ω';
    this.isSovereignMK2 = true;
    // Don't affect story mode — story uses AdaptiveAI directly

    // ── A. Prediction System ────────────────────────────────────
    // Bigram table: maps "lastAction→currentAction" → occurrence count
    this._bigramTable   = {};          // { 'jump→attack': 5, 'idle→jump': 3, … }
    this._trigramTable  = {};          // { 'jump→attack→dodge': 2, … }
    this._actionSeq     = [];          // ring buffer: last 32 tagged actions
    this._lastAction    = 'idle';
    this._lastTwoActions = ['idle', 'idle'];
    this._predictedNext = null;        // current prediction or null
    this._predictConf   = 0;           // 0–1 confidence
    this._predictSource = 'none';      // none|bigram|trigram|habit
    this._preemptMode   = false;       // currently executing preemptive counter
    this._preemptTimer  = 0;           // frames left in preemptive action
    this._preemptTarget = null;        // what we're preempting
    this._predCorrect   = 0;           // confirmed correct predictions
    this._predTotal     = 0;           // total predictions made
    this._predictDialogueCd = 0;       // cooldown between "called it" lines

    // ── B. Punishment System ────────────────────────────────────
    this._spamWindow    = { action: null, count: 0, timer: 0 };
    this._punishModeActive = false;
    this._punishModeTimer  = 0;        // frames remaining in punish mode
    this._punishModeCount  = 0;        // total activations (increases severity)
    this._punishDialogueCd = 0;

    // ── C. Limiter Break Mode ────────────────────────────────────
    this._limiterBroken       = false;
    this._limiterBreakDialogue = false; // fired once
    this._limiterAuraPhase    = 0;
    this._limiterFlashTimer   = 0;     // white flash on break

    // ── Evolution / intimidation state ─────────────────────────
    this._evolutionStage      = 0;     // 0..3
    this._evolutionPulse      = 0;
    this._intimidation        = 0;     // 0..1 pressure meter
    this._intimidationPulse   = 0;
    this._intimidationLineCd  = 0;
    this._intimidationPeak    = false;
    this._pressureMode        = 'study'; // study|suffocate
    this._pressureHoldTimer   = 0;
    this._studyBurstTimer     = 0;

    // ── D. Anti-Exploit System ───────────────────────────────────
    this._exploit = {
      stallFrames:    0,
      stallRespCd:    0,
      edgeFrames:     0,
      edgeRespCd:     0,
      spamCount:      0,
      spamTimer:      0,
      spamRespCd:     0,
      lastTargetX:    0,
      engageTimer:    0,   // forced-engage countdown after exploit trigger
      engageType:     null,
    };

    // ── E. Humanization Layer ────────────────────────────────────
    this._humanFakeoutDir   = 0;   // -1|0|1 direction of current fakeout
    this._humanFakeoutTimer = 0;
    this._humanMissArmed    = false; // intentional "whiff" this tick

    // ── Garou-style habit / counter / fear layers ───────────────
    this._habitStats = {
      jump:   { count: 0, streak: 0, timer: 0, total: 0 },
      dodge:  { count: 0, streak: 0, timer: 0, total: 0 },
      attack: { count: 0, streak: 0, timer: 0, total: 0 },
      shield: { count: 0, streak: 0, timer: 0, total: 0 },
    };
    this._lastHabitAction   = 'idle';
    this._dominantHabit     = null;
    this._dominantHabitScore= 0;
    this._counterLockTimer  = 0;
    this._counterCueCd      = 0;
    this._fearLineCd        = 0;
    this._dominanceZoomCd   = 0;
    this._flowBreakCd       = 0;
    this._guardBreakCd      = 0;
    this._repositionBurstCd = 0;
    this._audioSpikeTimer   = 0;
    this._limiterReason     = null;

    // ── Observation window + adaptation lock ────────────────────
    // No adaptation fires until _observationFrames >= 180 (≈3 sec)
    // AND _actionSampleCount >= 6 non-idle actions.
    this._observationFrames  = 0;   // incremented every AI tick
    this._actionSampleCount  = 0;   // non-idle actions seen
    this._adaptLockTimer     = 0;   // frames remaining on locked strategy
    this._lockedCounterStrategy = null; // 'anti-air'|'parry'|'guard-break'|'intercept'|'pressure'|null

    // ── Force Engagement System ──────────────────────────────────
    // Tracks how long the player has stayed distant AND avoided attacking.
    // When both thresholds are exceeded, Sovereign enters FORCE MODE and
    // overrides all movement decisions to close the gap relentlessly.
    // Does NOT change speed values or cooldowns — only decision priority.
    this._forceEngageDistFrames = 0;  // frames player has been > FORCE_DIST_THRESHOLD away
    this._forceEngageIdleFrames = 0;  // frames since player last attacked
    this._forceModeActive       = false;
    this._forceModeCloseFrames  = 0;  // frames spent within close range during force mode
    // Thresholds (tunable without touching speed/cooldowns):
    this._FORCE_DIST_THRESHOLD  = 200; // px — "player is staying far"
    this._FORCE_DIST_FRAMES     = 240; // ~4 sec continuously far
    this._FORCE_IDLE_FRAMES     = 300; // ~5 sec since player last attacked
    this._FORCE_CLOSE_NEEDED    = 60;  // frames close (<140px) needed to exit force mode
  }

  // ══════════════════════════════════════════════════════════════
  // A. PREDICTION SYSTEM
  // ══════════════════════════════════════════════════════════════

  _recordActionBigram(action) {
    if (action === 'idle' && this._lastAction === 'idle') return; // skip idle→idle noise
    const key = `${this._lastAction}→${action}`;
    this._bigramTable[key] = (this._bigramTable[key] || 0) + 1;
    const trigramKey = `${this._lastTwoActions[0]}→${this._lastTwoActions[1]}→${action}`;
    this._trigramTable[trigramKey] = (this._trigramTable[trigramKey] || 0) + 1;
    this._actionSeq.push(action);
    if (this._actionSeq.length > 32) this._actionSeq.shift();
    this._lastTwoActions = [this._lastTwoActions[1], action];
    this._lastAction = action;
  }

  _updatePrediction() {
    const triPrefix = `${this._lastTwoActions[0]}→${this._lastTwoActions[1]}→`;
    let triBest = null, triBestCount = 0, triTotal = 0;
    for (const [key, count] of Object.entries(this._trigramTable)) {
      if (key.startsWith(triPrefix)) {
        triTotal += count;
        if (count > triBestCount) { triBestCount = count; triBest = key.split('→')[2]; }
      }
    }
    if (triTotal >= 2 && triBestCount / triTotal >= 0.50) {
      this._predictedNext = triBest;
      this._predictConf   = triBestCount / triTotal;
      this._predictSource = 'trigram';
      this._predTotal++;
      return;
    }

    const recent = this._actionSeq.slice(-6).filter(a => a !== 'idle');
    if (recent.length >= 4) {
      const counts = {};
      for (const act of recent) counts[act] = (counts[act] || 0) + 1;
      let bestHabit = null, bestHabitCount = 0;
      for (const [act, count] of Object.entries(counts)) {
        if (count > bestHabitCount) { bestHabit = act; bestHabitCount = count; }
      }
      const habitConf = bestHabitCount / recent.length;
      if (bestHabit && habitConf >= 0.66) {
        this._predictedNext = bestHabit;
        this._predictConf   = Math.min(0.95, 0.40 + habitConf * 0.65);
        this._predictSource = 'habit';
        this._predTotal++;
        return;
      }
    }

    // Given _lastAction, find the most likely next action
    const prefix = `${this._lastAction}→`;
    let best = null, bestCount = 0, total = 0;
    for (const [key, count] of Object.entries(this._bigramTable)) {
      if (key.startsWith(prefix)) {
        total += count;
        if (count > bestCount) { bestCount = count; best = key.split('→')[1]; }
      }
    }
    // Require at least 2 observations before predicting
    if (total >= 2 && bestCount / total >= 0.40) {
      this._predictedNext = best;
      this._predictConf   = bestCount / total;
      this._predictSource = 'bigram';
      this._predTotal++;
    } else {
      this._predictedNext = null;
      this._predictConf   = 0;
      this._predictSource = 'none';
    }
  }

  _applyPredictionCounter(t, dir, d, moveSpd) {
    const confFloor = 0.44 - this._evolutionStage * 0.03 - this._intimidation * 0.05;
    if (!this._predictedNext || this._predictConf < confFloor) return false;
    if (this._preemptTimer > 0) {
      this._preemptTimer--;
      // Execute preemptive movement
      if (this._preemptTarget === 'attack') {
        // Pre-dash back — create distance to whiff their attack
        const safeDir = (this.x < 100) ? 1 : (this.x + this.w > GAME_W - 100) ? -1 : -dir;
        if (!this.isEdgeDanger(safeDir)) this.vx = safeDir * moveSpd * (2.0 + this._evolutionStage * 0.12);
      } else if (this._preemptTarget === 'jump') {
        // Reposition to anti-air zone: move under predicted apex
        if (!this.isEdgeDanger(dir)) this.vx = dir * moveSpd * (0.7 + this._intimidation * 0.35);
      } else if (this._preemptTarget === 'dodge') {
        // Chase in predicted escape direction
        if (!this.isEdgeDanger(dir)) this.vx = dir * moveSpd * (1.5 + this._intimidation * 0.35);
      } else if (this._preemptTarget === 'shield') {
        if (!this.isEdgeDanger(dir)) this.vx = dir * moveSpd * (0.95 + this._evolutionStage * 0.08);
        const weapon = this._getCombatWeapon();
        if (d < (weapon.range || 90) * 1.3 && this.cooldown <= 0) this.attack(t);
      }
      return true; // consumed movement frame
    }

    // Arm new preemptive action if confidence high enough
    if (this._predictConf >= (0.58 - this._evolutionStage * 0.03) && d < 220) {
      this._preemptTimer  = Math.max(4, 6 - this._evolutionStage);
      this._preemptTarget = this._predictedNext;
      this._preemptMode   = true;
      return true;
    }
    return false;
  }

  _checkPredictionCorrect(t, prevAction) {
    if (!this._preemptMode || !this._preemptTarget) return;
    const action = _smk2ClassifyAction(t, this._prevT2state);
    if (action === this._preemptTarget) {
      this._predCorrect++;
      this._preemptMode = false;
      this._intimidation = Math.min(1, this._intimidation + 0.09);
      // Celebrate: fire "called it" dialogue occasionally
      if (this._predictDialogueCd <= 0 && Math.random() < 0.35) {
        showBossDialogue(SMK2_PREDICT_LINES[Math.floor(Math.random() * SMK2_PREDICT_LINES.length)], 100);
        this._predictDialogueCd = 300;
      }
    }
    if (this._predictDialogueCd > 0) this._predictDialogueCd--;
  }

  // ══════════════════════════════════════════════════════════════
  // B. PUNISHMENT SYSTEM
  // ══════════════════════════════════════════════════════════════

  _updateSpamTracker(action) {
    const sp = this._spamWindow;
    if (sp.timer > 0) sp.timer--;
    else { sp.action = null; sp.count = 0; }

    if (action !== 'idle') {
      if (action === sp.action) {
        sp.count++;
        sp.timer = 36; // reset window on each new occurrence
      } else {
        sp.action = action;
        sp.count  = 1;
        sp.timer  = 36;
      }
      // 4+ same actions in the window = spam detected (requires clear pattern, not noise)
      if (sp.count >= 4 && !this._punishModeActive) {
        this._activatePunishMode(action);
      }
    }
    if (this._punishModeTimer > 0) this._punishModeTimer--;
    else if (this._punishModeActive) this._punishModeActive = false;
    if (this._punishDialogueCd > 0) this._punishDialogueCd--;
  }

  _activatePunishMode(triggerAction) {
    this._punishModeActive = true;
    this._punishModeCount++;
    // Duration grows with repetition and intelligence
    this._punishModeTimer = Math.round(180 + this._punishModeCount * 30 + this.intelligence * 60);
    // Reset the spam window so it doesn't re-trigger instantly
    this._spamWindow = { action: null, count: 0, timer: 0 };
    if (this._punishDialogueCd <= 0) {
      showBossDialogue(SMK2_PUNISH_LINES[Math.floor(Math.random() * SMK2_PUNISH_LINES.length)], 180);
      this._punishDialogueCd = 400;
    }
    screenShake = Math.max(screenShake, 10);
    spawnParticles(this.cx(), this.cy(), '#ff2200', 12);
  }

  _tickHabitStat(stat) {
    if (stat.timer > 0) {
      stat.timer--;
      return;
    }
    if (stat.count > 0) stat.count--;
    if (stat.streak > 0) stat.streak = Math.max(0, stat.streak - 1);
  }

  _updateHabitTracker(action, t) {
    for (const stat of Object.values(this._habitStats)) this._tickHabitStat(stat);
    if (this._counterCueCd > 0) this._counterCueCd--;
    if (this._fearLineCd > 0) this._fearLineCd--;
    if (this._dominanceZoomCd > 0) this._dominanceZoomCd--;
    if (this._flowBreakCd > 0) this._flowBreakCd--;
    if (this._guardBreakCd > 0) this._guardBreakCd--;
    if (this._repositionBurstCd > 0) this._repositionBurstCd--;
    if (this._audioSpikeTimer > 0) this._audioSpikeTimer--;
    if (this._counterLockTimer > 0) this._counterLockTimer--;

    const stat = this._habitStats[action];
    if (stat) {
      stat.count = Math.min(8, stat.count + 1);
      stat.streak = this._lastHabitAction === action ? Math.min(6, stat.streak + 1) : 1;
      stat.timer = action === 'shield' ? 95 : 82;
      stat.total++;
      this._lastHabitAction = action;
    }
    if (t.shielding && this._habitStats.shield.timer > 0) {
      this._habitStats.shield.timer = Math.max(this._habitStats.shield.timer, 48);
    }

    let best = null;
    let bestScore = 0;
    for (const [key, h] of Object.entries(this._habitStats)) {
      const score = h.count + h.streak * 0.7;
      if (score > bestScore) { best = key; bestScore = score; }
    }
    this._dominantHabit = best;
    this._dominantHabitScore = bestScore;
  }

  _habitRepeated(key, countFloor, streakFloor = 2) {
    const h = this._habitStats[key];
    return !!(h && (h.count >= countFloor || h.streak >= streakFloor));
  }

  _triggerFearLine(lines, dur = 110) {
    if (this._fearLineCd > 0 || !lines || !lines.length) return;
    showBossDialogue(lines[Math.floor(Math.random() * lines.length)], dur);
    this._fearLineCd = 220;
  }

  _triggerLimiterBreak(reason) {
    if (this._limiterBroken) return;
    this._limiterBroken      = true;
    this._limiterReason      = reason;
    this._limiterFlashTimer  = 25;
    this._adaptInterval      = 4; // post-break: ~15x/sec — superhuman pattern lock
    this._pressureMode       = 'suffocate';
    this._pressureHoldTimer  = 300;
    this._audioSpikeTimer    = 75;
    if (!this._limiterBreakDialogue) {
      this._limiterBreakDialogue = true;
      showBossDialogue(SMK2_LIMITER_LINES[Math.floor(Math.random() * SMK2_LIMITER_LINES.length)], 260);
    }
    if (typeof setCameraDrama === 'function') setCameraDrama('focus', 90, this, 1.28);
    if (typeof SoundManager !== 'undefined' && typeof SoundManager.superActivate === 'function') SoundManager.superActivate();
    screenShake = Math.max(screenShake, 28);
    spawnParticles(this.cx(), this.cy(), '#ffffff', 40);
    spawnParticles(this.cx(), this.cy(), '#ff0000', 20);
    spawnParticles(this.cx(), this.cy(), '#000000', 20);
  }

  // ══════════════════════════════════════════════════════════════
  // C. LIMITER BREAK MODE
  // ══════════════════════════════════════════════════════════════

  _checkLimiterBreak(t) {
    if (this._limiterBroken) {
      this._limiterAuraPhase = (this._limiterAuraPhase + 0.12) % (Math.PI * 2);
      if (this._limiterFlashTimer > 0) this._limiterFlashTimer--;
      if (this._pressureHoldTimer > 0) this._pressureHoldTimer--;
      if (this._adaptInterval > 4) this._adaptInterval = 4;
      return;
    }
    const recentTaken = this._countRecent('dmg_taken', 180);
    const hpPct = this.health / Math.max(1, this.maxHealth);
    const targetAdv = t && t.health > 0 ? t.health / Math.max(1, this.health) : 1;
    const overwhelmed = recentTaken >= 4 || (targetAdv > 1.28 && hpPct < 0.72);
    const habitOverload = this._dominantHabitScore >= 5.2 && this._punishModeCount >= 1;
    if (this.intelligence >= 0.82) return this._triggerLimiterBreak('evolution');
    if (hpPct <= 0.38) return this._triggerLimiterBreak('low_hp');
    if (overwhelmed) return this._triggerLimiterBreak('dominated');
    if (habitOverload) return this._triggerLimiterBreak('habit');
  }

  _updateEvolutionState() {
    const ratio = this._predTotal > 0 ? this._predCorrect / this._predTotal : 0;
    let nextStage = 0;
    if (this.intelligence >= 0.72 || this._predCorrect >= 2 || ratio >= 0.45) nextStage = 1;
    if (this.intelligence >= 0.82 && (this._predCorrect >= 4 || this._punishModeCount >= 2 || ratio >= 0.55)) nextStage = 2;
    if (this._limiterBroken || (this.intelligence >= 0.91 && (this._predCorrect >= 6 || this._punishModeCount >= 4 || ratio >= 0.65))) nextStage = 3;

    if (nextStage !== this._evolutionStage) {
      this._evolutionStage = nextStage;
      this._evolutionPulse = 30;
      screenShake = Math.max(screenShake, 8 + nextStage * 3);
      spawnParticles(this.cx(), this.cy(), nextStage >= 2 ? '#ff2200' : '#ffbb33', 10 + nextStage * 4);
      if (nextStage > 0) {
        showBossDialogue(SMK2_EVOLUTION_LINES[Math.min(SMK2_EVOLUTION_LINES.length - 1, nextStage - 1)], 180);
      }
    }
    if (this._evolutionPulse > 0) this._evolutionPulse--;
  }

  _updateIntimidation(t, d) {
    let delta = -0.010;
    if (d < 210) delta += 0.014;
    if (d < 140) delta += 0.020;
    if (this._predictConf >= 0.55) delta += 0.010 + this._predictConf * 0.015;
    if (this._punishModeActive) delta += 0.028;
    if (this._exploit.engageTimer > 0) delta += 0.018;
    if (t.health < t.maxHealth * 0.40) delta += 0.010;
    if (t.x < 95 || t.x + t.w > GAME_W - 95) delta += 0.018;
    delta += this._evolutionStage * 0.004;

    this._intimidation = Math.max(0, Math.min(1, this._intimidation + delta));
    this._intimidationPulse = (this._intimidationPulse + 0.09 + this._intimidation * 0.16) % (Math.PI * 2);

    if (this._intimidationLineCd > 0) this._intimidationLineCd--;
    if (this._intimidation > 0.72 && !this._intimidationPeak) {
      this._intimidationPeak = true;
      screenShake = Math.max(screenShake, 6);
      if (this._intimidationLineCd <= 0) {
        showBossDialogue(SMK2_INTIMIDATION_LINES[Math.floor(Math.random() * SMK2_INTIMIDATION_LINES.length)], 150);
        this._intimidationLineCd = 360;
      }
    } else if (this._intimidation < 0.45) {
      this._intimidationPeak = false;
    }
  }

  _updatePressureState(t, d) {
    if (this._pressureHoldTimer > 0) this._pressureHoldTimer--;
    if (this._studyBurstTimer > 0) this._studyBurstTimer--;
    const suffocateNow = this._limiterBroken || this._punishModeActive || this._intimidation > 0.70 || this._pressureHoldTimer > 0;
    if (suffocateNow) {
      this._pressureMode = 'suffocate';
      if (d < 150) this._pressureHoldTimer = Math.max(this._pressureHoldTimer, 22);
      return;
    }
    const studying = this._predictConf >= 0.42 && this._intimidation < 0.62 && d > 95;
    this._pressureMode = studying ? 'study' : 'suffocate';
    if (studying && this._studyBurstTimer <= 0 && this._predictedNext && this._predictConf >= 0.55) {
      this._studyBurstTimer = 36;
    }
  }

  // ── Force Engagement tracker ─────────────────────────────────
  // Call once per AI tick before movement decisions.
  // Returns true if force mode is currently active (caller should act on it).
  _updateForceEngagement(t, d, playerAttacking) {
    const far  = d > this._FORCE_DIST_THRESHOLD;
    const idle = !playerAttacking;

    // Count frames player is staying distant
    if (far)  this._forceEngageDistFrames++;
    else      this._forceEngageDistFrames = Math.max(0, this._forceEngageDistFrames - 4); // decay when close

    // Count frames since player last attacked
    if (idle) this._forceEngageIdleFrames++;
    else      this._forceEngageIdleFrames = 0; // reset on any player attack

    // Activate force mode when BOTH thresholds are met
    if (!this._forceModeActive) {
      if (this._forceEngageDistFrames >= this._FORCE_DIST_FRAMES &&
          this._forceEngageIdleFrames >= this._FORCE_IDLE_FRAMES) {
        this._forceModeActive     = true;
        this._forceModeCloseFrames = 0;
        if (typeof showBossDialogue === 'function') {
          showBossDialogue('You cannot run forever.', 120);
        }
      }
    }

    // While active: count frames spent within close range
    if (this._forceModeActive) {
      if (d < 140) {
        this._forceModeCloseFrames++;
      } else {
        this._forceModeCloseFrames = Math.max(0, this._forceModeCloseFrames - 1);
      }
      // Exit force mode once Sovereign has maintained close range long enough
      if (this._forceModeCloseFrames >= this._FORCE_CLOSE_NEEDED) {
        this._forceModeActive       = false;
        this._forceEngageDistFrames = 0;
        this._forceEngageIdleFrames = 0;
        this._forceModeCloseFrames  = 0;
      }
    }

    return this._forceModeActive;
  }

  // Returns a strategy string if a confident pattern is detected, else null.
  // Requires minimum observation window to have elapsed.
  _getCounterStrategy() {
    if (this._observationFrames < 180 || this._actionSampleCount < 6) return null;

    const seq = this._actionSeq.filter(a => a !== 'idle');
    if (seq.length < 6) return null;

    // Use the last 12 non-idle actions for rate calculation
    const recent = seq.slice(-12);
    const total  = recent.length;
    const counts = { jump: 0, attack: 0, shield: 0, dodge: 0 };
    for (const a of recent) if (counts[a] !== undefined) counts[a]++;

    const jumpRate   = counts.jump   / total;
    const attackRate = counts.attack / total;
    const shieldRate = counts.shield / total;
    const dodgeRate  = counts.dodge  / total;

    // High-confidence thresholds — must be strong pattern, not noise
    if (jumpRate   > 0.60) return 'anti-air';
    if (attackRate > 0.65) return 'parry';
    if (shieldRate > 0.50) return 'guard-break';
    if (dodgeRate  > 0.50) return 'intercept';
    // Passive player (low overall action rate relative to window): apply pressure
    if (total <= 6 && this._observationFrames > 300) return 'pressure';
    return null;
  }

  _runHardCounter(t, dir, d, moveSpd, weaponRange, atkRange, playerAttacking) {
    if (this._counterLockTimer > 0) return false;

    // Use rate-based strategy with lock-in — don't re-evaluate every tick
    if (this._adaptLockTimer <= 0) {
      const strategy = this._getCounterStrategy();
      if (strategy) {
        this._lockedCounterStrategy = strategy;
        this._adaptLockTimer = 120; // hold this counter for 2 seconds
      }
    }
    if (this._adaptLockTimer > 0) this._adaptLockTimer--;

    // Execute locked strategy
    const strat = this._lockedCounterStrategy;
    if (strat === 'anti-air' && !t.onGround) {
      this._counterLockTimer = 10;
      this._pressureHoldTimer = Math.max(this._pressureHoldTimer, 50);
      if (!this.isEdgeDanger(dir)) this.vx = dir * moveSpd * 1.18;
      if (this.onGround && t.cy() < this.cy() - 14) this.vy = -19;
      if (d < atkRange * 1.15 && this.cooldown <= 0) this.attack(t);
      this._triggerFearLine(SMK2_DOMINANCE_LINES, 95);
      return true;
    }
    if (strat === 'pressure' && d > 150) {
      // Passive player — close gap and force engagement
      if (!this.isEdgeDanger(dir)) this.vx = dir * moveSpd * 1.35;
      if (this.onGround && t.y < this.y - 40) this.vy = -18;
      this._triggerFearLine(SMK2_INTIMIDATION_LINES, 95);
      return true;
    }

    // Legacy habit checks — only if observation window passed AND thresholds are stricter
    if (this._observationFrames < 180) return false;

    if (this._habitRepeated('jump', 4, 3) && !t.onGround) {
      this._counterLockTimer = 10;
      this._pressureHoldTimer = Math.max(this._pressureHoldTimer, 50);
      if (!this.isEdgeDanger(dir)) this.vx = dir * moveSpd * 1.18;
      if (this.onGround && t.cy() < this.cy() - 14) this.vy = -19;
      if (d < atkRange * 1.15 && this.cooldown <= 0) this.attack(t);
      this._triggerFearLine(SMK2_DOMINANCE_LINES, 95);
      return true;
    }

    if (this._habitRepeated('shield', 4, 3) && t.shielding) {
      this._counterLockTimer = 12;
      if (!this.isEdgeDanger(dir)) this.vx = dir * moveSpd * 1.25;
      if (d < weaponRange * 1.25 + 24) {
        t.shielding = false;
        t.shieldHoldTimer = 0;
        t.shieldCooldown = Math.max(t.shieldCooldown || 0, typeof SHIELD_CD !== 'undefined' ? Math.round(SHIELD_CD * 0.70) : 260);
        t.hurtTimer = Math.max(t.hurtTimer || 0, 14);
        t.stunTimer = Math.max(t.stunTimer || 0, 8);
        t.vx += dir * 9;
        screenShake = Math.max(screenShake, 14);
        spawnParticles(t.cx(), t.cy(), '#ffaa44', 16);
        if (typeof setCameraDrama === 'function') setCameraDrama('impact', 18);
        if (this.abilityCooldown <= 0 && Math.random() < 0.55) this.ability(t);
        else if (this.cooldown <= 0) this.attack(t);
        if (this._guardBreakCd <= 0) {
          this._guardBreakCd = 160;
          this._triggerFearLine(['Guard breaks too.', 'That shield is mine now.', 'Blocking isn\'t a plan.'], 110);
        }
      }
      return true;
    }

    if (this._habitRepeated('dodge', 4, 3) && Math.abs(t.vx) > 3) {
      this._counterLockTimer = 9;
      const interceptDir = Math.sign(t.vx) || dir;
      if (!this.isEdgeDanger(interceptDir)) this.vx = interceptDir * moveSpd * 1.55;
      if (d < atkRange * 1.25 && this.cooldown <= 0) this.attack(t);
      this._pressureHoldTimer = Math.max(this._pressureHoldTimer, 36);
      return true;
    }

    if (this._habitRepeated('attack', 5, 3) && playerAttacking && d < 170) {
      this._counterLockTimer = 10;
      const dDir = (this.x < 100 && dir < 0) ? 1 : (this.x + this.w > GAME_W - 100 && dir > 0) ? -1 : -dir;
      if (this.onGround && !this.isEdgeDanger(dDir)) this.vx = dDir * moveSpd * 2.2;
      else if (this.onGround) this.vy = -18;
      this._punishTimer = this._limiterBroken ? 3 : 5;
      this._triggerFearLine(SMK2_DOMINANCE_LINES, 95);
      return true;
    }
    return false;
  }

  _runFlowBreak(t, dir, d, moveSpd, weaponRange, playerAttacking, recentTaken) {
    if (this._flowBreakCd > 0) return false;

    const cornered = this.x < 70 || this.x + this.w > GAME_W - 70;
    if (recentTaken >= 2 && d < weaponRange * 1.35 + 30 && this.abilityCooldown <= 0) {
      this._flowBreakCd = 120;
      this._pressureHoldTimer = 90;
      this.ability(t);
      t.vx += dir * 10;
      t.vy = Math.min(t.vy, -8);
      screenShake = Math.max(screenShake, 18);
      if (typeof setCameraDrama === 'function') setCameraDrama('impact', 22);
      this._triggerFearLine(['Your turn is over.', 'No. My pace.', 'You don\'t keep momentum.'], 105);
      return true;
    }

    if (playerAttacking && d < 155 && (recentTaken >= 1 || this.health < this.maxHealth * 0.46)) {
      this._flowBreakCd = 70;
      const dDir = (this.x < 100 && dir < 0) ? 1 : (this.x + this.w > GAME_W - 100 && dir > 0) ? -1 : -dir;
      if (!this.isEdgeDanger(dDir)) this.vx = dDir * moveSpd * 2.4;
      if (this.onGround) this.vy = -17;
      return true;
    }

    if (cornered && d < 170 && this._repositionBurstCd <= 0) {
      this._repositionBurstCd = 160;
      this._flowBreakCd = 55;
      const centerDir = Math.sign(GAME_W / 2 - this.cx()) || -dir;
      if (!this.isEdgeDanger(centerDir)) this.vx = centerDir * moveSpd * 2.05;
      this.vy = this.onGround ? -16 : this.vy;
      this._pressureHoldTimer = 60;
      spawnParticles(this.cx(), this.cy(), '#ff8844', 10);
      return true;
    }
    return false;
  }

  _updateFearFactor(d, recentLanded, heavyCounter) {
    if ((this._intimidation > 0.70 || this._limiterBroken) && this._dominanceZoomCd <= 0) {
      if (typeof setCameraDrama === 'function') setCameraDrama('focus', 32, this, 1.12 + this._intimidation * 0.06);
      this._dominanceZoomCd = 48;
    }
    if (heavyCounter || recentLanded >= 2) {
      screenShake = Math.max(screenShake, heavyCounter ? 16 : 10);
    }
  }

  // ══════════════════════════════════════════════════════════════
  // D. ANTI-EXPLOIT SYSTEM
  // ══════════════════════════════════════════════════════════════

  _updateAntiExploit(t) {
    const ex = this._exploit;
    const tx = t.cx();

    // ── Stall detection: player hasn't moved ──────────────────
    const moved = Math.abs(tx - ex.lastTargetX) > 6;
    ex.lastTargetX = tx;
    ex.stallFrames = moved ? 0 : ex.stallFrames + 1;
    if (ex.stallRespCd > 0) ex.stallRespCd--;

    if (ex.stallFrames >= 55 && ex.stallRespCd === 0) {
      ex.stallFrames = 0;
      ex.stallRespCd = 300;
      ex.engageTimer = 110;
      ex.engageType  = 'stall';
      showBossDialogue(SMK2_EXPLOIT_STALL[Math.floor(Math.random() * SMK2_EXPLOIT_STALL.length)], 140);
    }

    // ── Edge-camp detection ────────────────────────────────────
    const atEdge = t.x < 85 || t.x + t.w > GAME_W - 85;
    ex.edgeFrames = atEdge ? ex.edgeFrames + 1 : Math.max(0, ex.edgeFrames - 2);
    if (ex.edgeRespCd > 0) ex.edgeRespCd--;

    if (ex.edgeFrames >= 65 && ex.edgeRespCd === 0) {
      ex.edgeFrames = 0;
      ex.edgeRespCd = 420;
      ex.engageTimer = 80;
      ex.engageType  = 'edge';
      showBossDialogue(SMK2_EXPLOIT_EDGE[Math.floor(Math.random() * SMK2_EXPLOIT_EDGE.length)], 140);
    }

    // ── Attack-spam detection ──────────────────────────────────
    if (t.attackTimer > 0 && !(this._prevT2state && this._prevT2state.attacking)) {
      ex.spamCount++;
      ex.spamTimer = 50;
    }
    if (ex.spamTimer > 0) ex.spamTimer--;
    else ex.spamCount = 0;
    if (ex.spamRespCd > 0) ex.spamRespCd--;

    if (ex.spamCount >= 5 && ex.spamRespCd === 0) {
      ex.spamCount  = 0;
      ex.spamRespCd = 300;
      // Activate punishment too
      if (!this._punishModeActive) this._activatePunishMode('attack');
      showBossDialogue(SMK2_EXPLOIT_SPAM[Math.floor(Math.random() * SMK2_EXPLOIT_SPAM.length)], 140);
    }

    if (ex.engageTimer > 0) ex.engageTimer--;
  }

  // Returns true if anti-exploit is forcing a specific action this tick
  _runExploitResponse(t, dir, d, moveSpd) {
    const ex = this._exploit;
    if (ex.engageTimer <= 0) return false;

    if (ex.engageType === 'stall') {
      // Dash directly at them and attack
      if (!this.isEdgeDanger(dir)) this.vx = dir * moveSpd * 2.2;
      if (this.onGround && t.y < this.y - 40) this.vy = -20;
      const weapon = this._getCombatWeapon();
      if (d < (weapon.range || 90) * 1.4 && this.cooldown <= 0) this.attack(t);
      // Teleport if far
      if (d > 220 && this._portalCd <= 0) { this._portalCd = 0; }
      return true;
    }
    if (ex.engageType === 'edge') {
      // Pull them toward center: use grasp-style impulse
      const ddx = GAME_W / 2 - t.cx();
      t.vx += ddx * 0.04; // gentle center-pull
      t.vy  = Math.min(t.vy, -6);
      if (!this.isEdgeDanger(dir)) this.vx = dir * moveSpd * 1.6;
      const weapon = this._getCombatWeapon();
      if (d < (weapon.range || 90) * 1.5 && this.cooldown <= 0) this.attack(t);
      return true;
    }
    return false;
  }

  // ══════════════════════════════════════════════════════════════
  // E. HUMANIZATION LAYER
  // ══════════════════════════════════════════════════════════════

  _getHumanizedReact() {
    const i = this.intelligence;
    // Early: 4→2 frames; mid: 2→1 frame; late: 1→0 frames
    if (i < 0.35) return Math.round(4 - i * 5.7);           // 4→2
    if (i < 0.65) return Math.round(2 - (i - 0.35) * 3.3); // 2→1
    return Math.round(Math.max(0, 1 - (i - 0.65) * 3.3));  // 1→0
  }

  _updateHumanization(dir, moveSpd) {
    const i = this.intelligence;

    // Intentional miss: early-game, occasionally "misread" a dodge or attack
    this._humanMissArmed = i < 0.40 && Math.random() < (0.14 - i * 0.30);

    // Fake-out movement: late-game only — walk wrong way then snap back
    if (i > 0.62 && this._humanFakeoutTimer <= 0 && this.onGround && Math.random() < 0.008) {
      this._humanFakeoutDir   = -dir; // move AWAY from target briefly
      this._humanFakeoutTimer = Math.round(6 + Math.random() * 8);
    }
    if (this._humanFakeoutTimer > 0) {
      this._humanFakeoutTimer--;
      this.vx = this._humanFakeoutDir * moveSpd * 0.55;
    }
  }

  _getCombatWeapon() {
    const fallback = (typeof WEAPONS !== 'undefined' && (WEAPONS[this.weaponKey] || WEAPONS.sword)) || null;
    const resolved = this.weapon || fallback;
    if (resolved && this.weapon !== resolved) this.weapon = resolved;
    return resolved || { range: 90, damage: 12, cooldown: 32, kb: 12, type: 'melee' };
  }

  // ══════════════════════════════════════════════════════════════
  // OVERRIDE: update() — tick new systems before physics
  // ══════════════════════════════════════════════════════════════

  update() {
    this._checkLimiterBreak(this.target);
    super.update();
  }

  // ══════════════════════════════════════════════════════════════
  // OVERRIDE: updateAI() — full enhanced AI loop
  // ══════════════════════════════════════════════════════════════

  updateAI() {
    // Inherited guard checks
    if (this.aiReact > 0) { this.aiReact--; return; }
    if (this.ragdollTimer > 0 || this.stunTimer > 0) return;

    const t = this.target;
    if (!t || t.health <= 0) return;

    const m = this.aiMemory;
    const weapon = this._getCombatWeapon();
    const weaponRange = weapon.range || 90;

    // ── Pattern tracking ─────────────────────────────────────
    const playerAttacking = t.attackTimer > 0;
    if (playerAttacking && !this._prevPlayerAttacking) this._recordEvent('player_attack', 0);
    this._prevPlayerAttacking = playerAttacking;
    const playerAirborne = !t.onGround;
    if (playerAirborne && !this._prevPlayerAirborne) this._recordEvent('player_jump', 0);
    this._prevPlayerAirborne = playerAirborne;

    // ── Observation window ───────────────────────────────────
    // Sovereign must observe for at least 180 frames (~3 sec) and see
    // at least 6 non-idle player actions before adapting.
    this._observationFrames++;

    // ── A. Bigram action tracking ────────────────────────────
    const currentAction = _smk2ClassifyAction(t, this._prevT2state);
    if (currentAction !== 'idle') {
      this._actionSampleCount++;
      this._recordActionBigram(currentAction);
      this._updatePrediction();
    }
    this._updateHabitTracker(currentAction, t);
    this._checkPredictionCorrect(t, currentAction);
    this._prevT2state = { attacking: t.attackTimer > 0, onGround: t.onGround, shielding: t.shielding, vx: t.vx };

    // ── B. Spam/punishment tracking (gated by observation window) ──
    if (this._observationFrames >= 180 && this._actionSampleCount >= 6) {
      this._updateSpamTracker(currentAction);
    }

    // ── D. Anti-exploit tracking ─────────────────────────────
    this._updateAntiExploit(t);
    this._updateEvolutionState();

    // Whiff window carry-over
    const playerJustWhiffed = this._prevPlayerAtk > 0 && t.attackTimer === 0;
    this._prevPlayerAtk = t.attackTimer;
    if (playerJustWhiffed) this._counterWindowOpen = true;
    if (this._baitCooldown > 0) this._baitCooldown--;
    if (this._comboFollowTimer > 0) this._comboFollowTimer--;

    // ── Micro-adaptation ─────────────────────────────────────
    const recentTaken  = this._countRecent('dmg_taken',    90);
    const recentLanded = this._countRecent('hit_landed',   90);
    const recentPAtks  = this._countRecent('player_attack', 150);
    const recentPJumps = this._countRecent('player_jump',   150);
    const microDef = recentTaken  >= 2 ? 0.32 : recentTaken  >= 1 ? 0.16 : 0;
    const microAgg = recentLanded >= 2 ? 0.22 : recentLanded >= 1 ? 0.11 : 0;
    const effAgg = Math.min(1, m.aggression + microAgg);
    const effDef = Math.min(1, m.defense    + microDef);

    // State-based aggression: pull back when low HP, surge when player is vulnerable.
    const hpPct      = this.health / Math.max(1, this.maxHealth);
    const tHpPct     = t.health   / Math.max(1, t.maxHealth);
    const lowHPMode  = hpPct < 0.30;   // defensive below 30% HP
    const finishPush = tHpPct < 0.25;  // surge when player is near death
    const GAROU_FLOOR = lowHPMode ? 0.42 : 0.70; // reduced floor when defensive
    const evoAgg      = this._evolutionStage * 0.05 + this._intimidation * 0.06;
    const rawAgg      = Math.min(1, effAgg + evoAgg);
    const realAgg     = finishPush
      ? Math.min(1.0, rawAgg + 0.15)   // extra aggression when player is nearly dead
      : Math.max(GAROU_FLOOR, rawAgg);

    // ── C. Limiter Break flags ────────────────────────────────
    // lbSpd / lbAtk removed: Sovereign must not exceed player stat caps.
    // Limiter Break now only unlocks aggressive DECISION patterns, not raw numbers.
    const lb       = this._limiterBroken;
    const lbCombo  = lb ? 1    : 0;   // one extra follow-up (was 2); bounded by dealDamage combo limiter

    // ── E. Humanized parameters ───────────────────────────────
    // moveSpd capped to player normal base (5.2).  pressureMul removed from speed —
    // intimidation affects decision-making, not movement stat.
    const prefDist    = Math.max(18, 25 + m.spacing * 85 - this._intimidation * 22 - this._evolutionStage * 5);
    const moveSpd     = Math.min(5.2, 3.6 + realAgg * 1.6);  // ≤ player base speed
    const atkFreq     = Math.min(1.0, 0.40 + realAgg * 0.52 + this._intimidation * 0.08) *
                        (this._punishModeActive ? 1.2 : 1.0); // reduced from 1.5 — no superhuman attack rate
    // Always keep at least 1 frame of reaction delay (simulates human processing time).
    const reactFrames = Math.max(1, this._getHumanizedReact() - this._evolutionStage);
    const atkRange    = weaponRange * (1.1 + this._intimidation * 0.08) + 20;

    const dx  = t.cx() - this.cx();
    const d   = Math.abs(dx);
    const dir = Math.sign(dx);
    this._updateIntimidation(t, d);
    this._updatePressureState(t, d);

    // ── Humanization fakeout movement ─────────────────────────
    this._updateHumanization(dir, moveSpd);
    if (this._humanFakeoutTimer > 0) {
      this.aiReact = reactFrames;
      return; // fakeout frame — skip normal logic
    }

    // ── Danger: beams ─────────────────────────────────────────
    if (typeof bossBeams !== 'undefined' && bossBeams && bossBeams.length) {
      for (const beam of bossBeams) {
        if (beam.done) continue;
        if (Math.abs(beam.x - this.cx()) < 50) {
          const fd = this.cx() < beam.x ? -1 : 1;
          if (!this.isEdgeDanger(fd)) this.vx = fd * 8;
          if (this.onGround) this.vy = -18;
          return;
        }
      }
    }

    // ── Danger: lava ──────────────────────────────────────────
    if (currentArena && currentArena.hasLava && currentArena.lavaY) {
      if ((currentArena.lavaY - (this.y + this.h)) < 80 && this.onGround) {
        this.vx = this.cx() < GAME_W / 2 ? 6 : -6;
        this.vy = -18;
        return;
      }
    }

    const nearLeft  = this.x < 50;
    const nearRight = this.x + this.w > GAME_W - 50;

    // ── FORCE ENGAGEMENT ─────────────────────────────────────────
    // If player has been passive AND distant for too long, override movement.
    // Does not change speed values — only decision priority.
    const inForceMode = this._updateForceEngagement(t, d, playerAttacking);
    if (inForceMode) {
      // Override: always path directly at player, no hesitation
      if (!this.isEdgeDanger(dir)) {
        this.vx = dir * moveSpd; // full speed toward player, no multiplier increase
      } else {
        // Near edge — jump over instead of walking into the void
        if (this.onGround) { this.vy = -19; this.vx = dir * moveSpd * 0.6; }
      }
      // Jump if player is elevated or if a platform is in the way
      if (this.onGround && t.y < this.y - 45 && Math.random() < 0.55) {
        this.vy = -19;
      } else if (this.canDoubleJump && this.vy > 0 && t.y < this.y - 45) {
        this.vy = -15; this.canDoubleJump = false;
      }
      // Attack the moment range allows — no bait, no hesitation
      if (d < atkRange && this.cooldown <= 0) {
        this.attack(t);
      }
      // Use ability to close gap faster (decision, not speed change)
      if (this.abilityCooldown <= 0 && d < 300 && Math.random() < 0.35) this.ability(t);
      this.aiReact = Math.max(1, reactFrames - 1);
      this._updateFearFactor(d, recentLanded, true);
      return;
    }

    // ── D. Anti-exploit forced response ───────────────────────
    if (this._runExploitResponse(t, dir, d, moveSpd)) {
      this.aiReact = Math.max(0, reactFrames - 1);
      return;
    }

    if (this._runFlowBreak(t, dir, d, moveSpd, weaponRange, playerAttacking, recentTaken)) {
      this.aiReact = this._limiterBroken ? 0 : Math.max(0, reactFrames - 1);
      this._updateFearFactor(d, recentLanded, true);
      return;
    }

    // ── B. Punish mode: ignore defense, go full offense ───────
    if (this._punishModeActive) {
      // No dodging — rush and attack relentlessly
      if (!this.isEdgeDanger(dir)) this.vx = dir * moveSpd * 1.45;
      if (this.onGround && t.y < this.y - 50 && Math.random() < 0.3) this.vy = -19;
      if (d < atkRange * 1.3 && this.cooldown <= 0) {
        this.attack(t);
        const comboHits = Math.floor(this.intelligence * 3.5) + lbCombo;
        if (comboHits > 0 && this._comboFollowHits === 0) {
          this._comboFollowHits = comboHits;
          this._comboFollowTimer = Math.max(4, Math.round(8 - m.reactionSpeed * 5));
        }
      }
      // Use ability and super aggressively during punish mode
      if (this.abilityCooldown <= 0 && d < 280 && Math.random() < 0.45) this.ability(t);
      if (this.superReady && Math.random() < (finishPush ? 0.80 : 0.50)) this.useSuper(t);
      this.aiReact = 0; // zero delay in punish mode
      this._updateFearFactor(d, recentLanded, true);
      return;
    }

    // ── A. Preemptive prediction counter ─────────────────────
    // Only after observation window — requires real pattern data
    const adaptReady = this._observationFrames >= 180 && this._actionSampleCount >= 6;
    if (adaptReady && !this._humanMissArmed) {
      if (this._applyPredictionCounter(t, dir, d, moveSpd)) {
        this.aiReact = reactFrames;
        return;
      }
    }

    if (this._runHardCounter(t, dir, d, moveSpd, weaponRange, atkRange, playerAttacking)) {
      this.aiReact = this._limiterBroken ? 0 : Math.max(0, reactFrames - 1);
      this._updateFearFactor(d, recentLanded, true);
      return;
    }

    // ── COUNTER-ATTACK: dodge + punish on player attack ───────
    if (playerAttacking && d < 160) {
      if (effDef > 0.45) {
        const dDir = (nearLeft && dir < 0) ? 1 : (nearRight && dir > 0) ? -1 : -dir;
        if (this.onGround && !this.isEdgeDanger(dDir)) {
          this.vx = dDir * moveSpd * 2.2;
        } else if (this.onGround) {
          this.vy = -19; this.vx = dir * moveSpd * 0.8;
        } else if (this.canDoubleJump) {
          this.vy = -16; this.canDoubleJump = false;
        }
        this.shielding = false;
        this._recordEvent('dodge', 5);
        this._punishTimer = lb ? 4 : 6; // limiter break: faster punish
        this.aiReact = Math.max(1, reactFrames);
        return;
      }
      if (effDef > 0.60 && this.shieldCooldown === 0 && effDef > 0.72) {
        this.shielding = true;
        this.shieldCooldown = typeof SHIELD_CD !== 'undefined' ? SHIELD_CD : 450;
        this._recordEvent('dodge', 3);
        setTimeout(() => { this.shielding = false; }, 280);
        return;
      }
    } else {
      this.shielding = false;
    }

    // ── PUNISH TIMER: sprint and strike after dodge ────────────
    if (this._punishTimer > 0) {
      this._punishTimer--;
      if (!this.isEdgeDanger(dir)) this.vx = dir * moveSpd * 1.9;
      if (this._punishTimer === 0) {
        if (this.cooldown <= 0 && d < weaponRange * 1.5 + 35) {
          this.attack(t);
          this._counterWindowOpen = false;
        }
        if (this.superReady && Math.random() < 0.55) this.useSuper(t);
        if (this.abilityCooldown <= 0 && d < 200 && Math.random() < 0.40) this.ability(t);
      }
      return;
    }

    // Instant counter on whiff — dash in even from range to punish consistently
    if (this._counterWindowOpen) {
      if (d < weaponRange * 1.6 + 40 && this.cooldown <= 0) {
        if (!this.isEdgeDanger(dir)) this.vx = dir * moveSpd * 1.6;
        this.attack(t);
        this._counterWindowOpen = false;
        this.aiReact = 0;
        return;
      } else if (d < 280 && !this.isEdgeDanger(dir)) {
        // Out of range: dash in to punish, consume the window to avoid wasted opportunity
        this.vx = dir * moveSpd * 2.2;
        this._counterWindowOpen = false;
        this.aiReact = 0;
        return;
      }
      this._counterWindowOpen = false;
    }

    // ── COMBO FOLLOW-UP ────────────────────────────────────────
    if (this._comboFollowTimer === 0 && this._comboFollowHits > 0 && this.cooldown <= 0 && d < atkRange * 1.2) {
      this._comboFollowHits--;
      this.attack(t);
      this._comboFollowTimer = Math.max(lb ? 4 : 6, Math.round(8 - m.reactionSpeed * 4));
      return;
    }

    // ── PATTERN ANTICIPATION ───────────────────────────────────
    // Jump-heavy player → shadow their air movement
    if (recentPJumps >= 3 && !this.onGround && this.canDoubleJump) {
      this.vy = -15; this.canDoubleJump = false;
    }
    // Rapid-attack player → pre-position at punish range
    if (recentPAtks >= 4 && d < prefDist + 60 && d > prefDist) {
      this.vx *= 0.80;
    }

    // ── BAIT MECHANIC ──────────────────────────────────────────
    if (this._baitTimer > 0) {
      this._baitTimer--;
      this.vx = dir * moveSpd * 0.20; // creep forward even while baiting
      if (playerAttacking && d < 160) {
        this._baitTimer    = 0;
        this._baitCooldown = lb ? 180 : 280;
        this._baitCount++;
        const dDir = (nearLeft && dir < 0) ? 1 : (nearRight && dir > 0) ? -1 : -dir;
        if (this.onGround && !this.isEdgeDanger(dDir)) {
          this.vy = -20; this.vx = dDir * moveSpd * 2.6;
        }
        this._punishTimer = 4;
        this._recordEvent('dodge', 8);
      }
      return;
    }

    const finishMode = finishPush;
    const canBait    = this.intelligence > 0.55 && this._baitCooldown === 0 && !finishMode && d < 140 && d > prefDist * 0.8;
    if (canBait && this.intelligence > 0.70) {
      this._baitTimer = Math.round(18 + this.intelligence * 20);
    }

    // ── MOVEMENT — continuous, no idle gaps ───────────────────
    if (this._pressureMode === 'study' && !finishMode) {
      const studyDist = Math.max(prefDist + 16, weaponRange * 0.95);
      if (d > studyDist + 26) {
        const _passiveMult = recentPAtks === 0 ? 1.10 : 0.82;
        if (!this.isEdgeDanger(dir)) this.vx = dir * moveSpd * _passiveMult;
      } else if (d < studyDist - 18) {
        if (!this.isEdgeDanger(-dir)) this.vx = -dir * moveSpd * 0.46;
      } else {
        // Always step in — no idle drift
        if (!this.isEdgeDanger(dir)) this.vx = dir * moveSpd * 0.35;
      }
      if (this._studyBurstTimer > 0 && !this.isEdgeDanger(dir)) this.vx = dir * moveSpd * 1.12;
    } else if (d > atkRange + 15 || finishMode) {
      if (!nearLeft || dir >= 0) if (!nearRight || dir <= 0) {
        this.vx = dir * moveSpd * (finishMode ? 1.34 : this._pressureMode === 'suffocate' ? 1.16 : 1.0);
      }
      if (this.onGround && t.y < this.y - 55) {
        this.vy = -19;
      } else if (this.canDoubleJump && this.vy > 0 && t.y < this.y - 45) {
        this.vy = -15; this.canDoubleJump = false;
      }
    } else if (d < prefDist - 15) {
      if (this._pressureMode === 'suffocate') {
        if (!this.isEdgeDanger(dir)) this.vx = dir * moveSpd * 0.70;
        else this.vx *= 0.90;
      } else if (!this.isEdgeDanger(-dir)) {
        this.vx = -dir * moveSpd * 0.3;
      } else {
        this.vx *= 0.88;
      }
    } else {
      // In attack range — keep light pressure toward target
      if (!this.isEdgeDanger(dir)) this.vx = dir * moveSpd * 0.25;
    }

    // ── ATTACK — deterministic: if in range and ready, always attack ───
    if (d < atkRange && this.cooldown <= 0) {
      this.attack(t);
      const comboHits = Math.floor(this.intelligence * 3.5) + lbCombo;
      if (comboHits > 0 && this._comboFollowHits === 0) {
        this._comboFollowHits = comboHits;
        this._comboFollowTimer = Math.max(lb ? 4 : 6, Math.round(10 - m.reactionSpeed * 5));
      }
    }

    // ── ABILITY / SUPER ───────────────────────────────────────
    const abiChance = 0.05 + realAgg * 0.09 * (lb ? 1.3 : 1.0);
    if (this.abilityCooldown <= 0 && d < 280 && Math.random() < abiChance) this.ability(t);
    const superChance = finishMode ? 0.60 : 0.18 + realAgg * 0.22;
    if (this.superReady && Math.random() < superChance) this.useSuper(t);
    if (this.health < 22 && this.superReady) this.useSuper(t);

    this._updateFearFactor(d, recentLanded, false);

    // Debug: gated behind window.DEBUG_RECORDING to prevent frame spam
    if (window.DEBUG_RECORDING) {
      if (this._comboFollowHits > 2) console.log('[SOV] Combo follow hits remaining:', this._comboFollowHits, 'intelligence:', this.intelligence.toFixed(2));
      if (this._evolutionStage === 3 && this._evolutionPulse === 29) console.log('[SOV] Reached TYRANT stage — intelligence:', this.intelligence.toFixed(2));
    }

    this.aiReact = reactFrames;
  }

  // ══════════════════════════════════════════════════════════════
  // OVERRIDE: draw() — adds limiter break visual layer
  // ══════════════════════════════════════════════════════════════

  draw() {
    // Limiter break white flash overlay (screen-space, drawn before fighter)
    if (this._limiterFlashTimer > 0 && this.health > 0) {
      const fa = this._limiterFlashTimer / 25 * 0.45;
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = `rgba(255,255,255,${fa.toFixed(3)})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
    }

    // Limiter break secondary aura ring (under base draw)
    if (this._limiterBroken && this.health > 0) {
      const lp = this._limiterAuraPhase;
      const r  = 32 + Math.sin(lp) * 8;
      const a  = 0.18 + 0.12 * Math.sin(lp * 2.1);
      ctx.save();
      // Rapidly cycling red/white ring
      const t2 = (Math.sin(lp * 3) + 1) / 2; // 0–1
      const rr = Math.round(255);
      const gg = Math.round(t2 * 60);
      const bb = Math.round(t2 * 60);
      const grd = ctx.createRadialGradient(this.cx(), this.cy(), 8, this.cx(), this.cy(), r + 16);
      grd.addColorStop(0,   `rgba(${rr},${gg},${bb},${(a * 2.5).toFixed(3)})`);
      grd.addColorStop(0.5, `rgba(${rr},${gg},${bb},${a.toFixed(3)})`);
      grd.addColorStop(1,   `rgba(${rr},${gg},${bb},0)`);
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(this.cx(), this.cy(), r + 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      const distA = 0.04 + 0.03 * (Math.sin(lp * 4.4) * 0.5 + 0.5);
      ctx.fillStyle = `rgba(255,40,0,${distA.toFixed(3)})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
    }

    if (this.health > 0 && settings.bossAura) {
      const p = this._intimidation;
      const evo = this._evolutionStage;
      if (p > 0.08 || evo > 0) {
        const pulseR = 28 + evo * 8 + Math.sin(this._intimidationPulse) * (4 + p * 7);
        const auraA  = 0.08 + p * 0.22 + evo * 0.03;
        ctx.save();
        const aura = ctx.createRadialGradient(this.cx(), this.cy(), 8, this.cx(), this.cy(), pulseR + 22);
        aura.addColorStop(0, `rgba(255,${Math.round(70 + p * 90)},${Math.round(20 + evo * 10)},${Math.min(0.95, auraA * 2.4).toFixed(3)})`);
        aura.addColorStop(0.45, `rgba(255,70,20,${auraA.toFixed(3)})`);
        aura.addColorStop(1, 'rgba(255,40,0,0)');
        ctx.fillStyle = aura;
        ctx.beginPath();
        ctx.arc(this.cx(), this.cy(), pulseR + 22, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = `rgba(255,170,60,${(0.10 + p * 0.28).toFixed(3)})`;
        ctx.lineWidth = 1.5 + evo * 0.2;
        ctx.beginPath();
        ctx.arc(this.cx(), this.cy(), pulseR * 0.88, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }

    // Parent draw (aura + fighter body + "ADAPTING" label)
    super.draw();

    if (this.health > 0 && this.target && this._intimidation > 0.34) {
      const p = this._intimidation;
      const tx = this.target.cx();
      const ty = this.target.cy();
      const tr = 22 + p * 16 + Math.sin(this._intimidationPulse * 1.8) * 4;
      ctx.save();
      ctx.strokeStyle = `rgba(255,110,40,${(0.12 + p * 0.26).toFixed(3)})`;
      ctx.lineWidth = 1.2;
      ctx.setLineDash([4, 5]);
      ctx.beginPath();
      ctx.moveTo(this.cx(), this.cy());
      ctx.lineTo(tx, ty);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.strokeStyle = `rgba(255,180,90,${(0.18 + p * 0.30).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(tx, ty, tr, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Limiter break label override
    if (this._limiterBroken && this.health > 0) {
      ctx.save();
      const flicker = 0.7 + 0.3 * Math.sin(this._limiterAuraPhase * 4.2);
      ctx.font      = `bold ${8 + Math.round(this.intelligence * 2)}px Arial`;
      ctx.textAlign = 'center';
      const t2 = (Math.sin(this._limiterAuraPhase * 3) + 1) / 2;
      const r2 = Math.round(255);
      const g2 = Math.round(t2 * 55);
      ctx.fillStyle = `rgba(${r2},${g2},0,${flicker.toFixed(2)})`;
      ctx.fillText('◉ LIMITER BREAK', this.cx(), this.y - 14);
      ctx.restore();
    }

    // Punish mode indicator
    if (this._punishModeActive && this.health > 0) {
      ctx.save();
      const pa = 0.55 + 0.35 * Math.sin(frameCount * 0.28);
      ctx.font      = 'bold 7px Arial';
      ctx.textAlign = 'center';
      ctx.fillStyle = `rgba(255,40,0,${pa.toFixed(2)})`;
      ctx.fillText('⚠ PUNISHING', this.cx(), this.y - (this._limiterBroken ? 24 : 14));
      ctx.restore();
    }

    if (this.health > 0) {
      ctx.save();
      const stageAlpha = 0.28 + this._evolutionStage * 0.12 + this._evolutionPulse * 0.008;
      ctx.font = 'bold 7px Arial';
      ctx.textAlign = 'center';
      ctx.fillStyle = `rgba(255,210,120,${Math.min(0.95, stageAlpha).toFixed(2)})`;
      ctx.fillText(`◆ ${SMK2_STAGE_NAMES[this._evolutionStage]}`, this.cx(), this.y - (this._limiterBroken ? 34 : 24));
      if (this._intimidation > 0.36) {
        ctx.fillStyle = `rgba(255,120,60,${(0.22 + this._intimidation * 0.52).toFixed(2)})`;
        ctx.fillText(`PRESSURE ${(this._intimidation * 100).toFixed(0)}%`, this.cx(), this.y - (this._limiterBroken ? 44 : 34));
      }
      if (this._dominantHabit && this._dominantHabitScore >= 3.2) {
        ctx.fillStyle = `rgba(255,210,140,${(0.18 + Math.min(0.55, this._dominantHabitScore * 0.08)).toFixed(2)})`;
        ctx.fillText(`COUNTER ${this._dominantHabit.toUpperCase()}`, this.cx(), this.y - (this._limiterBroken ? 54 : 44));
      }
      ctx.restore();
    }
  }
}

// ── Debug / console API for SovereignMK2 ─────────────────────
function showSovereignStats(on) {
  adaptiveAIDebug = !!on; // reuse parent's debug overlay
  console.log('[SovereignMK2] Stats overlay:', on ? 'ON' : 'OFF');
}
function showSovereignPredictions() {
  const ai = (typeof players !== 'undefined') && players.find(p => p.isSovereignMK2);
  if (!ai) { console.warn('[SovereignMK2] No active SovereignMK2 found.'); return; }
  const total  = Object.values(ai._bigramTable).reduce((a, b) => a + b, 0);
  const top    = Object.entries(ai._bigramTable).sort(([,a],[,b]) => b - a).slice(0, 8);
  console.log(`[SovereignMK2] Top bigrams (${total} total):`);
  for (const [k, v] of top) console.log(`  ${k.padEnd(18)} x${v} (${(v/total*100).toFixed(0)}%)`);
  console.log(`Predictions: ${ai._predCorrect}/${ai._predTotal} correct`);
  console.log(`Limiter broken: ${ai._limiterBroken}  |  Punish count: ${ai._punishModeCount}`);
  console.log(`Stage: ${SMK2_STAGE_NAMES[ai._evolutionStage]}  |  Pressure: ${(ai._intimidation * 100).toFixed(0)}%  |  Source: ${ai._predictSource}`);
}
function resetSovereignMK2() {
  const ai = (typeof players !== 'undefined') && players.find(p => p.isSovereignMK2);
  if (!ai) return;
  ai.aiMemory       = { ...ADAPTIVE_DEFAULTS };
  ai._eventBuffer   = [];
  ai._adaptTick     = 0;
  ai._adaptCycles   = 0;
  ai._bigramTable   = {};
  ai._trigramTable  = {};
  ai._actionSeq     = [];
  ai._lastAction    = 'idle';
  ai._lastTwoActions = ['idle', 'idle'];
  ai._limiterBroken = false;
  ai._limiterBreakDialogue = false;
  ai._punishModeActive = false;
  ai._punishModeTimer  = 0;
  ai._punishModeCount  = 0;
  ai._predictedNext = null;
  ai._predictConf   = 0;
  ai._predictSource = 'none';
  ai._predCorrect   = 0;
  ai._predTotal     = 0;
  ai._evolutionStage = 0;
  ai._evolutionPulse = 0;
  ai._intimidation = 0;
  ai._intimidationPulse = 0;
  ai._intimidationLineCd = 0;
  ai._intimidationPeak = false;
  ai._pressureMode = 'study';
  ai._pressureHoldTimer = 0;
  ai._studyBurstTimer = 0;
  ai._habitStats = {
    jump:   { count: 0, streak: 0, timer: 0, total: 0 },
    dodge:  { count: 0, streak: 0, timer: 0, total: 0 },
    attack: { count: 0, streak: 0, timer: 0, total: 0 },
    shield: { count: 0, streak: 0, timer: 0, total: 0 },
  };
  ai._lastHabitAction = 'idle';
  ai._dominantHabit = null;
  ai._dominantHabitScore = 0;
  ai._counterLockTimer = 0;
  ai._counterCueCd = 0;
  ai._fearLineCd = 0;
  ai._dominanceZoomCd = 0;
  ai._flowBreakCd = 0;
  ai._guardBreakCd = 0;
  ai._repositionBurstCd = 0;
  ai._audioSpikeTimer = 0;
  ai._limiterReason = null;
  Object.assign(ai._exploit, { stallFrames:0, stallRespCd:0, edgeFrames:0, edgeRespCd:0, spamCount:0, spamTimer:0, spamRespCd:0, engageTimer:0 });
  const _m = ai.aiMemory;
  ai.intelligence = (_m.aggression + _m.defense + _m.spacing + _m.reactionSpeed) / 4;
  ai._updateAuraColor();
  console.log('[SovereignMK2] Full reset.');
}
