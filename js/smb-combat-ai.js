// ============================================================
// smb-combat-ai.js  —  Modular Combat AI
// Three-class architecture:
//   CombatSystem   — attack decisions, cooldowns, range
//   MovementSystem — approach / retreat / dodge / bait
//   AIController   — utility scoring, action selection
//   CombatAIFighter — Fighter subclass wiring them together
//
// Load order: after smb-pathfinding.js, before smb-enemies.js
// All damage flows through Fighter.attack() → dealDamage().
// All edge checks use Fighter.isEdgeDanger().
// ============================================================

'use strict';

// ─────────────────────────────────────────────────────────────
// Tunable weight table — tweak here without touching logic
// ─────────────────────────────────────────────────────────────
const CAI_WEIGHTS = {
  // Utility base scores (before perception modifiers)
  approach : 0.50,
  attack   : 0.60,
  dodge    : 0.55,
  retreat  : 0.40,
  bait     : 0.35,
  idle     : 0.10,

  // How much randomness is blended into each score (±fraction)
  noiseFactor: 0.15,

  // Reaction delay range in ms (converted to frames @ 60fps)
  reactionDelayMinMs: 100,
  reactionDelayMaxMs: 250,

  // Probability of a deliberately suboptimal choice
  suboptimalChance: 0.12,
};

// ─────────────────────────────────────────────────────────────
// Small helpers shared by all three systems
// ─────────────────────────────────────────────────────────────

/** Convert milliseconds to AI frames (≈ 60 fps). */
function _msToFrames(ms) { return Math.max(1, Math.round(ms / (1000 / 60))); }

/** Uniform random in [min, max]. */
function _rand(min, max) { return min + Math.random() * (max - min); }

/** Signed distance: positive = target is to the right. */
function _dx(self, target) { return target.cx() - self.cx(); }

/** Add ±noiseFactor relative noise to a score. */
function _noise(score) {
  const f = CAI_WEIGHTS.noiseFactor;
  return score * (1 + _rand(-f, f));
}

// ─────────────────────────────────────────────────────────────
// applyAIIntent — single consolidation point
// ─────────────────────────────────────────────────────────────
// AI systems write to fighter._aiIntent instead of mutating
// vx/vy directly.  The game loop (or Fighter.update) calls
// applyAIIntent(fighter) once per frame to flush the buffer.
//
// If _aiIntent is null (AI did not run this tick), physics
// is left untouched — no stale overwrite.
// ─────────────────────────────────────────────────────────────
function applyAIIntent(fighter) {
  if (!fighter || !fighter._aiIntent) return;
  const intent = fighter._aiIntent;
  fighter._aiIntent = null; // consume

  if (intent.vx !== null && intent.vx !== undefined) fighter.vx = intent.vx;
  if (intent.vy !== null && intent.vy !== undefined) fighter.vy = intent.vy;
  if (intent.jump && fighter.onGround) {
    fighter.vy = intent.jumpForce || -20;
    fighter.onGround = false;
  }
  if (intent.doubleJump && fighter.canDoubleJump && !fighter.onGround) {
    fighter.vy = intent.doubleJumpForce || -17;
    fighter.canDoubleJump = false;
  }
}

// ═════════════════════════════════════════════════════════════
// 1.  CombatSystem
//     Manages attacking: range check, cooldown tracking,
//     and hit-detection stub (real damage via Fighter.attack).
// ═════════════════════════════════════════════════════════════
class CombatSystem {
  /**
   * @param {Fighter} owner  — the AI-controlled fighter
   */
  constructor(owner) {
    this.owner   = owner;
    this.cd      = 0;        // frames until next attack allowed
    this.abilityCD = 0;
    this.superCD   = 0;
  }

  /** Call once per game-logic frame to decrement cooldowns. */
  tick() {
    if (this.cd      > 0) this.cd--;
    if (this.abilityCD > 0) this.abilityCD--;
    if (this.superCD   > 0) this.superCD--;
  }

  /** True if the target is within melee reach. */
  inRange(target) {
    const d       = Math.abs(_dx(this.owner, target));
    const range   = (this.owner.weapon ? this.owner.weapon.range : 60) * 1.15;
    return d < range;
  }

  /**
   * Attempt a normal attack.
   * Returns true if the attack was executed.
   *
   * A small wind-up delay (50–100 ms) is inserted between the decision to attack
   * and the actual swing.  This gives the player a brief readable telegraph without
   * touching AI decision logic or targeting.
   */
  tryAttack(target) {
    if (this.cd > 0) return false;
    // Cancel pending wind-up if the AI stepped out of range mid-telegraph
    if (!this.inRange(target)) {
      this._windupTimer = undefined;
      return false;
    }
    // First call this decision cycle: start the wind-up countdown
    if (this._windupTimer === undefined) {
      this._windupTimer = _msToFrames(_rand(50, 100)); // 3–6 frames ≈ 50–100 ms
      return false;
    }
    // Still winding up
    if (this._windupTimer > 0) {
      this._windupTimer--;
      return false;
    }
    // Wind-up complete — fire the swing
    this._windupTimer = undefined;
    this.owner.attack(target);           // uses Fighter.attack → dealDamage
    this.cd = this.owner.cooldown || 28; // sync with weapon cooldown
    return true;
  }

  /**
   * Attempt the class ability.
   * Returns true if activated.
   */
  tryAbility(target) {
    if (this.abilityCD > 0 || this.owner.abilityCooldown > 0) return false;
    const d = Math.abs(_dx(this.owner, target));
    if (d > 300) return false;
    this.owner.ability(target);
    this.abilityCD = _msToFrames(800);
    return true;
  }

  /**
   * Attempt super move — used when meter is full or health is critical.
   */
  trySuper(target) {
    if (!this.owner.superReady) return false;
    this.owner.useSuper(target);
    this.superCD = _msToFrames(2000);
    return true;
  }

  /**
   * Is the target visibly vulnerable?
   * True when target's attack animation just finished (whiff window).
   */
  targetIsVulnerable(target) {
    return (this._prevTargetAttackTimer > 0 && target.attackTimer === 0);
  }

  /** Call every AI tick to track target state for vulnerability detection. */
  observeTarget(target) {
    this._prevTargetAttackTimer = target ? target.attackTimer : 0;
  }
}

// ═════════════════════════════════════════════════════════════
// 2.  MovementSystem
//     Executes the six movement intentions.
//     Uses pfGetNextWaypoint (A*) for long-range navigation,
//     direct velocity for close-range and impulse moves.
// ═════════════════════════════════════════════════════════════
class MovementSystem {
  /**
   * @param {Fighter} owner
   * @param {object}  cfg   — { speed, approachThreshold, retreatThreshold }
   */
  constructor(owner, cfg) {
    this.owner = owner;
    this.spd   = cfg.speed            || 4.8;
    this.approachThresh = cfg.approachThreshold || 200; // px: use A* beyond this
    this.retreatThresh  = cfg.retreatThreshold  ||  90; // px: retreat zone

    // Bait state
    this._baitPhase    = 'none'; // 'none' | 'in' | 'hold' | 'out'
    this._baitTimer    = 0;
    this._baitCooldown = 0;
    this._baitGap      = 0;      // preferred gap during bait

    // Zig-zag noise
    this._zigzagTimer  = 0;
    this._zigzagDir    = 1;
  }

  tick() {
    if (this._baitCooldown > 0) this._baitCooldown--;
    if (this._baitTimer    > 0) this._baitTimer--;
    if (this._zigzagTimer  > 0) this._zigzagTimer--;
    else {
      // Roll a new zig-zag offset every 0.4–0.9 s
      this._zigzagDir   = Math.random() < 0.5 ? 1 : -1;
      this._zigzagTimer = _msToFrames(_rand(400, 900));
    }
  }

  // ── Internal helpers ───────────────────────────────────────

  _safeDir(dir) {
    const o = this.owner;
    if (o.isEdgeDanger(dir))  return 0;
    if (typeof pfVoidAhead === 'function' && pfVoidAhead(o, dir)) return 0;
    return dir;
  }

  _moveToward(target, speedScale) {
    const o   = this.owner;
    const dx  = _dx(o, target);
    const d   = Math.abs(dx);
    const dir = Math.sign(dx);

    if (d > this.approachThresh && typeof pfGetNextWaypoint === 'function') {
      // A* long-range navigation
      const wp = pfGetNextWaypoint(o, target.cx(), target.y + target.h * 0.5);
      if (wp) {
        const wpDir = Math.sign(wp.x - o.cx());
        const safeD = this._safeDir(wpDir);
        if (safeD !== 0) o.vx = safeD * this.spd * (speedScale || 1.0);

        // Jump if waypoint requires it
        if (wp.action === 'jump' && o.onGround) {
          o.vy = -20;
        } else if (wp.action === 'doubleJump' && o.canDoubleJump && o.vy > -1) {
          o.vy = -17; o.canDoubleJump = false;
        } else if (wp.action === 'drop') {
          // Just walk off
        }
        return;
      }
    }

    // Direct movement — close range or no graph
    const safeD = this._safeDir(dir);
    if (safeD !== 0) {
      // Add tiny zig-zag noise to X movement
      const zigzagOffset = this._zigzagDir * this.spd * 0.06;
      o.vx = safeD * this.spd * (speedScale || 1.0) + zigzagOffset;
    } else {
      // Edge danger — try jumping over instead
      if (o.onGround) o.vy = -20;
    }

    // Jump to reach elevated target
    if (o.onGround && target.y < o.y - 60 && Math.random() < 0.15) {
      o.vy = -20;
    } else if (o.canDoubleJump && o.vy > 0 && target.y < o.y - 50) {
      o.vy = -17; o.canDoubleJump = false;
    }
  }

  // ── Six movement intentions ────────────────────────────────

  /**
   * approach — move toward target using A* or direct walk.
   */
  approach(target) {
    this._moveToward(target, 1.0);
  }

  /**
   * retreat — move away; prefer jumping to a higher platform.
   */
  retreat(target) {
    const o   = this.owner;
    const dx  = _dx(o, target);
    const dir = -Math.sign(dx); // opposite
    const sd  = this._safeDir(dir);

    if (sd !== 0) {
      o.vx = sd * this.spd * 1.1;
    } else {
      // Cornered — jump straight up
      if (o.onGround) o.vy = -22;
    }

    // Jump to create vertical separation
    if (o.onGround && Math.random() < 0.22) o.vy = -20;
  }

  /**
   * dodge — quick impulse away from the incoming attack direction.
   * Perpendicular or backward relative to the player.
   */
  dodge(target) {
    const o   = this.owner;
    const dx  = _dx(o, target);
    const dir = Math.sign(dx); // direction TOWARD attacker
    const nearLeft  = o.x < 60;
    const nearRight = o.x + o.w > GAME_W - 60;

    // Prefer to dash backward; if cornered, jump
    let dodgeDir = -dir;
    if (nearLeft  && dodgeDir < 0) dodgeDir =  1;
    if (nearRight && dodgeDir > 0) dodgeDir = -1;

    if (o.onGround && !o.isEdgeDanger(dodgeDir)) {
      o.vx = dodgeDir * this.spd * 2.4; // fast impulse
      // Randomly add a jump to make the dodge less predictable
      if (Math.random() < 0.35) o.vy = -18;
    } else if (o.onGround) {
      // Cornered — jump toward attacker to pass through
      o.vy = -20;
      o.vx = dir * this.spd * 0.7;
    } else if (o.canDoubleJump) {
      o.vy = -16; o.canDoubleJump = false;
    }
  }

  /**
   * bait — step inside attack range, pause, then step back.
   * Phase machine: 'in' → 'hold' → 'out'
   */
  bait(target) {
    const o      = this.owner;
    const atkRange = o.weapon ? o.weapon.range * 1.2 + 20 : 80;
    const dx     = _dx(o, target);
    const d      = Math.abs(dx);
    const dir    = Math.sign(dx);

    if (this._baitPhase === 'none' || this._baitTimer === 0) {
      // Decide the desired bait gap (just inside attack range)
      this._baitGap   = atkRange * 0.85;
      this._baitPhase = 'in';
      this._baitTimer = _msToFrames(300);  // max time to step in
    }

    switch (this._baitPhase) {
      case 'in':
        // Move to baitGap distance
        if (d > this._baitGap + 15) {
          const sd = this._safeDir(dir);
          if (sd !== 0) o.vx = sd * this.spd * 0.55;
        } else {
          // Reached bait position — hold still
          o.vx *= 0.5;
          this._baitPhase = 'hold';
          this._baitTimer = _msToFrames(_rand(180, 360)); // 0.18–0.36 s pause
        }
        break;

      case 'hold':
        // Stand still — tempting target
        o.vx = 0;
        if (this._baitTimer === 0) {
          this._baitPhase = 'out';
          this._baitTimer = _msToFrames(250);
        }
        break;

      case 'out':
        // Step back out of range
        {
          const sd = this._safeDir(-dir);
          if (sd !== 0) o.vx = sd * this.spd * 0.70;
          if (this._baitTimer === 0) {
            this._baitPhase    = 'none';
            this._baitCooldown = _msToFrames(_rand(1800, 3200));
          }
        }
        break;
    }
  }

  /** Reset bait state — e.g. when interrupted by a dodge. */
  cancelBait() {
    this._baitPhase    = 'none';
    this._baitTimer    = 0;
    this._baitCooldown = _msToFrames(800);
  }

  /** True when the bait cycle is currently active. */
  get isBaiting() { return this._baitPhase !== 'none'; }

  /** True when bait cooldown has expired (bait available). */
  get canBait() { return this._baitCooldown === 0; }
}

// ═════════════════════════════════════════════════════════════
// 3.  AIController  (Utility-based decision engine)
//     Each frame: score all actions → pick highest → execute.
// ═════════════════════════════════════════════════════════════
class AIController {
  /**
   * @param {Fighter}        owner
   * @param {CombatSystem}   combat
   * @param {MovementSystem} movement
   */
  constructor(owner, combat, movement) {
    this.owner    = owner;
    this.combat   = combat;
    this.movement = movement;

    // Current locked action (prevents per-frame thrashing)
    this._action        = 'idle';
    this._actionLock    = 0;   // frames remaining in this action
    this._reactionDelay = 0;   // frames until the AI is allowed to react

    // Perception snapshot (updated each decide() call)
    this._perc = {
      dist             : 0,
      playerIsAttacking: false,
      playerVx         : 0,
      playerVy         : 0,
      aiHealth         : 1.0,
      playerHealth     : 1.0,
      playerIsIdle     : false,
      playerIsAirborne : false,
    };
  }

  // ── Perception ─────────────────────────────────────────────

  _updatePerception(target) {
    const o = this.owner;
    const p = this._perc;

    p.dist              = Math.abs(_dx(o, target));
    p.playerIsAttacking = target.attackTimer > 0;
    p.playerVx          = target.vx || 0;
    p.playerVy          = target.vy || 0;
    p.aiHealth          = o.health / (o.maxHealth || 100);
    p.playerHealth      = target.health / (target.maxHealth || 100);
    p.playerIsIdle      = Math.abs(p.playerVx) < 0.8 && !p.playerIsAttacking;
    p.playerIsAirborne  = !target.onGround;
  }

  // ── Scoring ────────────────────────────────────────────────

  /**
   * Compute a raw utility score for each action, then add noise.
   * Returns { action, score } for each entry.
   */
  _scoreActions(target) {
    const W = CAI_WEIGHTS;
    const p = this._perc;
    const atkRange = this.owner.weapon ? this.owner.weapon.range * 1.15 + 20 : 80;
    const closeRatio = Math.max(0, 1 - p.dist / atkRange);     // 0=far  1=touching
    const farRatio   = 1 - closeRatio;

    const scores = {};

    // approach — high when far away
    scores.approach = W.approach * (0.4 + farRatio * 1.6);

    // attack — high when close, higher when target is vulnerable
    scores.attack = W.attack * (closeRatio * 1.5) *
                    (this.combat.targetIsVulnerable(target) ? 1.8 : 1.0);

    // dodge — spike when player is attacking and we are close
    scores.dodge = p.playerIsAttacking
      ? W.dodge * (0.8 + closeRatio * 1.4)
      : W.dodge * 0.05;

    // retreat — scales with low AI health
    scores.retreat = W.retreat * Math.pow(Math.max(0, 0.45 - p.aiHealth) * 2.5, 1.4);

    // bait — high when player is idle/defensive and AI is healthy
    scores.bait = this.movement.canBait
      ? W.bait * (p.playerIsIdle ? 1.6 : 0.3) * (0.3 + p.aiHealth * 0.7)
      : 0;

    // idle — low baseline (AI prefers to do something)
    scores.idle = W.idle;

    // Add per-score noise
    const result = {};
    for (const key in scores) result[key] = _noise(scores[key]);
    return result;
  }

  /** Pick the action with the highest score (with suboptimal-choice fallback). */
  _pickAction(scores) {
    const entries = Object.entries(scores).sort((a, b) => b[1] - a[1]);

    // Occasionally pick a suboptimal choice for unpredictability
    if (Math.random() < CAI_WEIGHTS.suboptimalChance && entries.length > 1) {
      const idx = 1 + Math.floor(Math.random() * Math.min(2, entries.length - 1));
      return entries[idx][0];
    }

    return entries[0][0];
  }

  // ── Main decide-and-act loop ───────────────────────────────

  /**
   * Call once per AI tick (respects existing aiTick throttle from Fighter).
   * @param {Fighter} target — the opponent
   */
  decide(target) {
    if (!target || target.health <= 0) return;

    // Reaction delay — simulates human latency
    if (this._reactionDelay > 0) { this._reactionDelay--; return; }

    this.combat.tick();
    this.movement.tick();
    this.combat.observeTarget(target);
    this._updatePerception(target);

    // If locked into an action, keep executing it
    if (this._actionLock > 0) {
      this._actionLock--;
      this._executeAction(this._action, target);
      return;
    }

    // Score and choose
    const scores = this._scoreActions(target);
    const chosen  = this._pickAction(scores);

    // Bait requires a clean state transition
    if (chosen === 'bait' && this.movement.isBaiting) {
      // Already baiting — keep going
      this._action     = 'bait';
      this._actionLock = 2;
    } else if (chosen !== 'bait' && this.movement.isBaiting) {
      this.movement.cancelBait();
    }

    this._action = chosen;

    // Assign lock duration (prevents jitter between frames)
    const lockMs = {
      approach : _rand(80,  160),
      attack   : _rand(40,  100),
      dodge    : _rand(120, 220),
      retreat  : _rand(120, 240),
      bait     : _rand(60,  100),
      idle     : _rand(60,  140),
    };
    this._actionLock = _msToFrames(lockMs[chosen] || 80);

    // Queue reaction delay for next decision cycle
    this._reactionDelay = _msToFrames(
      _rand(CAI_WEIGHTS.reactionDelayMinMs, CAI_WEIGHTS.reactionDelayMaxMs)
    );

    this._executeAction(chosen, target);
  }

  /** Dispatch action string → concrete system calls. */
  _executeAction(action, target) {
    const c = this.combat;
    const m = this.movement;
    const o = this.owner;

    switch (action) {

      case 'approach':
        m.approach(target);
        // Opportunistic attack if we wandered into range
        if (c.inRange(target)) c.tryAttack(target);
        break;

      case 'attack':
        // Close the last gap before swinging
        if (!c.inRange(target)) m.approach(target);
        if (!c.tryAttack(target)) {
          // Attack on cooldown — use ability or super while waiting
          if (!c.tryAbility(target)) c.trySuper(target);
        } else {
          // Attack landed — try ability/super as combo
          c.tryAbility(target);
        }
        break;

      case 'dodge':
        m.dodge(target);
        // Interrupt any ongoing bait
        if (m.isBaiting) m.cancelBait();
        // After dodge, queue a counter
        this._actionLock = Math.max(this._actionLock, _msToFrames(120));
        break;

      case 'retreat':
        m.retreat(target);
        // Emergency super on low HP
        if (this._perc.aiHealth < 0.18) c.trySuper(target);
        break;

      case 'bait':
        m.bait(target);
        // If player takes the bait (attacks during hold), dodge and punish
        if (this._perc.playerIsAttacking && m._baitPhase === 'hold') {
          m.cancelBait();
          m.dodge(target);
          // Schedule a counter attack
          this._action     = 'attack';
          this._actionLock = _msToFrames(150);
          this._reactionDelay = _msToFrames(60);
        }
        break;

      case 'idle':
      default:
        // Dampen velocity gradually — don't freeze solid
        o.vx *= 0.85;
        break;
    }
  }
}

// ═════════════════════════════════════════════════════════════
// 4.  CombatAIFighter  —  Fighter subclass
//     Wires the three systems into Fighter.updateAI().
// ═════════════════════════════════════════════════════════════
class CombatAIFighter extends Fighter {
  /**
   * @param {number} x          — spawn x
   * @param {number} y          — spawn y
   * @param {string} color      — fill colour string
   * @param {string} weaponKey  — key from WEAPONS data
   * @param {object} [cfg]      — optional overrides for speed, thresholds
   */
  constructor(x, y, color, weaponKey, cfg) {
    // Always created as an AI fighter at 'hard' difficulty base
    super(x, y, color, weaponKey, null, true, 'hard');

    cfg = cfg || {};
    this.name = cfg.name || 'AI';

    const movCfg = {
      speed             : cfg.speed            || 4.8,
      approachThreshold : cfg.approachThreshold || 200,
      retreatThreshold  : cfg.retreatThreshold  ||  90,
    };

    this._combat   = new CombatSystem(this);
    this._movement = new MovementSystem(this, movCfg);
    this._aiCtrl   = new AIController(this, this._combat, this._movement);

    // Suppress Fighter's built-in updateAI logic for this subclass
    this._useCombatAI = true;
  }

  // Override Fighter.updateAI — route to AIController.decide()
  updateAI() {
    // Respect Fighter's aiReact delay
    if (this.aiReact > 0) { this.aiReact--; return; }
    if (this.ragdollTimer > 0 || this.stunTimer > 0) return;

    const t = this.target;
    if (!t || t.health <= 0) return;

    // Danger overrides — check for arena hazards before AI logic
    if (this._handleHazards(t)) return;

    this._aiCtrl.decide(t);
  }

  /**
   * Handle immediate environmental dangers (beams, lava).
   * Returns true if an override movement was applied.
   */
  _handleHazards(target) {
    // Boss beams
    if (typeof bossBeams !== 'undefined' && bossBeams && bossBeams.length) {
      for (const beam of bossBeams) {
        if (beam.done) continue;
        if (Math.abs(beam.x - this.cx()) < 50) {
          const fd = this.cx() < beam.x ? -1 : 1;
          if (!this.isEdgeDanger(fd)) this.vx = fd * 8;
          if (this.onGround) this.vy = -18;
          return true;
        }
      }
    }

    // Lava proximity
    if (currentArena && currentArena.hasLava && currentArena.lavaY) {
      if ((currentArena.lavaY - (this.y + this.h)) < 80 && this.onGround) {
        this.vx = this.cx() < GAME_W / 2 ? 6 : -6;
        this.vy = -18;
        return true;
      }
    }

    return false;
  }
}

// ─────────────────────────────────────────────────────────────
// Factory helper (optional convenience)
// ─────────────────────────────────────────────────────────────

/**
 * spawnCombatAI(x, y, color, weaponKey, cfg)
 * Creates a CombatAIFighter and adds it to the players array
 * so it participates in the game loop automatically.
 *
 * Call from startGame() or a cheat/debug console.
 * Example:
 *   spawnCombatAI(400, 300, '#ff8800', 'sword', { name: 'Hunter', speed: 5.2 });
 */
function spawnCombatAI(x, y, color, weaponKey, cfg) {
  const ai = new CombatAIFighter(x, y, color || '#ff8800', weaponKey || 'sword', cfg);

  // Pick a human player as the default target
  const humanTarget = typeof players !== 'undefined'
    ? players.find(p => !p.isAI && p.health > 0)
    : null;
  if (humanTarget) ai.target = humanTarget;

  if (typeof players !== 'undefined') players.push(ai);
  return ai;
}
