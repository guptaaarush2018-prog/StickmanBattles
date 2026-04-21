'use strict';

// ============================================================
// FIGHTER
// ============================================================
class Fighter {
  constructor(x, y, color, weaponKey, controls, isAI, aiDifficulty) {
    this.x = x; this.y = y;
    this.w = 34; this.h = 84;
    this.vx = 0; this.vy = 0;
    this.color       = color;
    this.weaponKey   = weaponKey;
    this.weapon      = (weaponKey && weaponKey.startsWith('_custom_') && window.CUSTOM_WEAPONS && window.CUSTOM_WEAPONS[weaponKey])
                       ? window.CUSTOM_WEAPONS[weaponKey]
                       : WEAPONS[weaponKey];
    this.controls    = controls;
    this.isAI        = isAI || false;
    this.aiDiff      = aiDifficulty || 'medium';
    this.health      = 150;
    this.maxHealth   = 150;
    this.lives       = chosenLives;
    this.kills       = 0;
    this.onGround    = false;
    this.cooldown    = 0;
    this.cooldown2   = 0;
    this.abilityCooldown  = 0;
    this.abilityCooldown2 = 0;
    this.invincible  = 0;
    this.shielding   = false;
    this.spinning    = 0;
    this.facing      = 1;
    this.state       = 'idle';
    this.attackTimer = 0;
    this.attackDuration = 12;
    this.attackEndlag = 0;    // recovery frames after swing; player can't attack or ability
    this.hurtTimer    = 0;
    this.stunTimer    = 0;   // frames unable to act (stars spin overhead)
    this.ragdollTimer = 0;   // frames of limp physics (flailing limbs)
    this.weaponHit    = false; // has weapon tip dealt damage this swing?
    this.boostCooldown   = 0;  // ability cooldown (legacy field)
    this.shieldCooldown  = 0;  // shield cooldown
    this.shieldHoldTimer = 0;  // frames S is held this activation
    this.canDoubleJump   = false; // allows one double-jump after leaving ground
    this.superMeter      = 0;    // 0-100 super charge
    this.superReady      = false; // true when super is fully charged
    this.superFlashTimer = 0;    // countdown for "SUPER!" text above player
    this.stamina         = 100;  // 0-100 stamina; drains on attack, regens over time
    this.maxStamina      = 100;
    this.superChargeRate = 1.0;  // base rate; boss overrides higher
    this.charClass      = 'none';
    this.classSpeedMult = 1.0;
    this.rageStacks     = 0;
    this.godmode        = false;
    this.backstageHiding = false;
    this.classPerkUsed   = false;  // one-time class passive; resets each life
    this.spartanRageTimer = 0;     // Kratos: frames of +50% damage boost
    this.noCooldownsActive = false;
    this.lavaBurnTimer = 0;
    this.contactDamageCooldown = 0; // frames between passive weapon contact hits
    this.ragdollAngle    = 0;    // accumulated spin angle during ragdoll
    this.ragdollSpin     = 0;    // angular velocity (rad/frame) for ragdoll tumble
    this._rd          = null;    // per-limb ragdoll state (PlayerRagdoll system)
    this.animTimer    = 0;
    this._speedBuff   = 0;
    this._powerBuff   = 0;
    this._maxLives       = chosenLives; // for correct heart display
    this.onePunchMode    = false;       // training: kills anything in one hit
    this.swingHitTargets = new Set();   // tracks targets hit in current swing (multi-hit)
    this._lastTapLeft    = -999;        // frame of last left-key tap (story dodge detection)
    this._lastTapRight   = -999;
    this._lastTapUp      = -999;
    this.target          = null;
    this.aiState     = 'chase';
    this.aiReact     = 0;
    this.squashTimer   = 0;  // frames of landing squash animation
    this.aiNoHitTimer  = 0;  // frames bot has been attacking without landing a hit
    // ---- NO-IDLE SYSTEM ----
    this.intent          = 'pressure'; // 'pressure'|'reposition'|'bait'|'retreat'
    this._intentTimer    = 0;          // AI ticks until next intent re-evaluation
    this._inactiveTime   = 0;          // AI ticks since last meaningful action
    this._microRandTimer = 0;          // countdown to next micro-randomization pulse
    this._playerIdleTmr  = 0;         // AI ticks the target has been idle
    this.storyFaction    = null;       // 'enemy' for story opponent bots; used to prevent ally targeting
    this._megaJumping    = false;
    this._megaJumpLanded = false;
    this._megaSmashing   = false;
    this._spawnFalling   = false; // megaknight: falls from sky on spawn
    this._fallStartY     = null;  // Y when megaknight left ground (for fall-height damage)
    this._wanderDir    = 1;  // direction for wander state
    this._wanderTimer  = 0;  // frames left in wander state
    this.coyoteFrames  = 0;  // frames after walking off a platform where ground jump is still allowed
    this._prevOnGround = false; // previous frame ground state (for coyote time)
    this._stateChangeCd = 0; // frames before AI can switch aiState again (human-like hesitation)
    this.personality    = null; // 'aggressive'|'defensive'|'trickster'|'sniper' — set when spawned as bot
    this._pendingAction    = null;  // { action: string, timer: int } — queued decision pending reaction delay
    this._actionLockFrames = 0;     // frames bot is committed to current action (no re-evaluation)
    this.inputBuffer       = [];    // queued inputs: 'attack'|'jump'|'ability' (drained once per frame)
    this._ammo        = this.weapon && this.weapon.clipSize ? this.weapon.clipSize : 0;
    this._reloadTimer = 0;  // countdown to reload complete; 0 = ready
    this.spawnX      = x;
    this.spawnY      = y;
    this.name        = '';
    this.playerNum   = 1;
    // ── Anti-kite system ─────────────────────────────────────────────────────
    this._kiteTimer     = 0;   // frames of continuous high-speed movement
    this._kiteSpeedMult = 1.0; // applied in processInput; decays toward 0.70 over 8s
    // ── Ranged weapon state ───────────────────────────────────────────────────
    this._rangedBurstTimer = 0; // frames since last ranged attack (resets on pause)
    this._rangedMovePenalty = 0; // frames of post-burst speed debuff remaining
    this._rangedCommitTimer = 0; // short post-shot commitment window
    this._rangedShotHeat    = 0; // repeated-fire recoil / inaccuracy scaler
    this._recentRangedUse   = 0; // AI / boss response signal
    this._reloadInterrupted = false;
    this._rangedRecoilKick  = 0; // visual / movement recoil after firing
    // ── Bot ranged AI state ───────────────────────────────────────────────────
    this._rangedStrafeDir   = 1;   // current strafe direction
    this._rangedStrafeTimer = 0;   // frames until next strafe direction flip
    this._rangedAimPause    = 0;   // frames spent aiming (standing still for accuracy)
    // ── AI Intent buffer ─────────────────────────────────────────────────────
    // Written by AI systems each tick; consumed by applyAIIntent().
    // null between ticks (AI cleared it) or { vx, vy, jump } when pending.
    this._aiIntent = null;
  }

  cx() { return this.x + this.w / 2; }
  cy() { return this.y + this.h / 2; }

  _isInvalidAITarget(candidate) {
    return !candidate || candidate === this || candidate.health <= 0 ||
      (typeof areAlliedEntities === 'function' && areAlliedEntities(this, candidate));
  }

  _acquireAITarget() {
    // In training mode, entities in players[] (e.g. p2 bot) should only target
    // other players[], not trainingDummies — otherwise bots attack the ForestBeast
    // instead of their actual opponent.
    const pool = (trainingMode && players.includes(this))
      ? [...players]
      : [...players, ...trainingDummies, ...minions];
    const living = pool.filter(q => !this._isInvalidAITarget(q));
    this.target = living.length
      ? living.reduce((a, b) => Math.hypot(b.cx() - this.cx(), b.cy() - this.cy()) < Math.hypot(a.cx() - this.cx(), a.cy() - this.cy()) ? b : a)
      : null;
    return this.target;
  }

  respawn() {
    // Always re-pick a safe platform — this handles moving/disappearing boss floor
    if (currentArena && typeof pickSafeSpawn === 'function') {
      const sideHint = this.playerNum === 2 ? 'right' : 'left';
      const newSpawn = pickSafeSpawn(sideHint);
      if (newSpawn) { this.spawnX = newSpawn.x; this.spawnY = newSpawn.y; }
    }
    this.x  = this.spawnX;
    this.y  = this.spawnY - 60;
    this.vx = 0; this.vy = 0;
    this._dimPunchGravLock = false;
    this.health          = this.maxHealth; // always restore to full on respawn
    this.shielding       = false;
    this.spinning        = 0;
    this.ragdollTimer    = 0;
    this.stunTimer       = 0;
    this.weaponHit       = false;
    this.boostCooldown   = 0;
    this.shieldHoldTimer = 0;
    this.canDoubleJump   = false;
    // superMeter / superReady intentionally NOT reset — supers carry over between lives
    this.contactDamageCooldown = 0;
    this.ragdollAngle    = 0;
    this.ragdollSpin     = 0;
    if (this._rd) PlayerRagdoll.standUp(this);
    this.lavaBurnTimer   = 0;
    this._speedBuff      = 0;
    this._powerBuff      = 0;
    this.classPerkUsed    = false;
    this.spartanRageTimer = 0;
    this._ammo        = this.weapon && this.weapon.clipSize ? this.weapon.clipSize : 0;
    this._reloadTimer = 0;
    this._rangedCommitTimer = 0;
    this._rangedShotHeat = 0;
    this._recentRangedUse = 0;
    this._reloadInterrupted = false;
    this._rangedRecoilKick = 0;
    this.invincible = 100;
    // Megaknight spawn animation: fall from sky
    if (this.charClass === 'megaknight') {
      this.y = -120;
      this.vy = 2;
      this._spawnFalling = true;
      this.invincible = 200;
    }
    if (this.isAI) {
      this.target = null;
      this.aiState = 'chase';
      this.intent = 'pressure';
      this.aiReact = 0;
      this._pendingAction = null;
      this._actionLockFrames = 0;
      this._stateChangeCd = 0;
      this._inactiveTime = 0;
      this._intentTimer = 0;
      this._wanderTimer = 0;
      this._comboPressTimer = 0;
      this.aiNoHitTimer = 0;
      this.inputBuffer.length = 0;
      this._acquireAITarget();
    }
    for (const ai of [...players, ...minions]) {
      if (ai && ai.isAI && typeof ai._isInvalidAITarget === 'function' && ai._isInvalidAITarget(ai.target)) {
        ai._acquireAITarget();
      }
    }
    spawnParticles(this.cx(), this.cy(), this.color, 22);
    // Online: notify remote that we respawned
    if (onlineMode && !this.isRemote && NetworkManager.connected) {
      NetworkManager.sendGameEvent('respawn', { x: this.x, y: this.y });
    }
  }

  // ---- UPDATE ----
  update() {
    // Remote player in online mode: skip local physics (state driven by network)
    if (this.isRemote && onlineMode) {
      this.updateState();
      return;
    }
    if (this.cooldown > 0)         this.cooldown--;
    if (this.cooldown2 > 0)        this.cooldown2--;
    if (this.abilityCooldown > 0)  this.abilityCooldown--;
    if (this.abilityCooldown2 > 0) this.abilityCooldown2--;
    if (this.invincible > 0)      this.invincible--;
    const _prevAtkTimer = this.attackTimer;
    if (this.attackTimer > 0)     this.attackTimer--;
    // Trigger endlag when swing animation completes (attackTimer just hit 0)
    if (_prevAtkTimer === 1 && this.attackTimer === 0 && !this.isBoss) {
      let endlag = this.weapon.endlag || 0;
      // Whiff punish: extra recovery if swing missed
      if (!this.weaponHit) endlag = Math.round(endlag * 2.4); // whiff is heavily punishable
      // Low stamina: sluggish recovery (up to +40% at 0 stamina)
      const staminaRatio = this.stamina / (this.maxStamina || 100);
      if (staminaRatio < 0.4) endlag = Math.round(endlag * (1 + 0.4 * (1 - staminaRatio / 0.4)));
      // Affinity feel: low affinity = sluggish recovery, high affinity = snappier recovery
      if (this.charClass && this.weapon && typeof CLASS_AFFINITY !== 'undefined') {
        const _aff = CLASS_AFFINITY[this.charClass];
        if (_aff) {
          const _affMult = _aff[this.weapon.type] || 1.0;
          if (_affMult < 0.8) endlag = Math.round(endlag * (1 + (_affMult < 0.6 ? 0.30 : 0.15)));
          else if (_affMult > 1.2) endlag = Math.round(endlag * (1 - (_affMult > 1.4 ? 0.20 : 0.10)));
        }
      }
      this.attackEndlag = endlag;
      // Stamina drain on attack
      const staminaCost = Math.min(this.stamina, (this.weapon.damage || 10) * 1.5);
      this.stamina = Math.max(0, this.stamina - staminaCost);
    }
    if (this.attackEndlag > 0) { this.attackEndlag--; this.vx *= 0.72; } // slow during recovery
    // Affinity move penalty: low-affinity attacks slow the attacker during the active swing frames
    if (this._affinityMovePenalty > 0) { this._affinityMovePenalty--; this.vx *= 0.88; }
    // Stamina regen
    if (!this.isBoss) this.stamina = Math.min(this.maxStamina, this.stamina + 0.35);

    // ── Anti-kite timer (human players — 1v1, minigames, story; not boss/TF) ───
    if (!this.isAI && !this.isBoss) {
      const _kiteMode   = gameMode === '2p' || gameMode === 'minigames' || storyModeActive;
      const _movingFast = Math.abs(this.vx) > 3.8;
      const _inCombat   = this.hurtTimer > 0 || this.attackTimer > 0 || this.attackEndlag > 0;
      const _nearEnemy  = this.target && Math.abs(this.target.cx() - this.cx()) < 140;
      // Increment while actively running away from combat; decay 3× faster when not kiting
      if (!_kiteMode || !_movingFast || _inCombat || _nearEnemy) {
        this._kiteTimer = Math.max(0, this._kiteTimer - 3);
      } else {
        this._kiteTimer++;
      }
      // Grace: full speed for 90f (~1.5s), then linear decay to 0.65 floor by 450f (~7.5s)
      if (this._kiteTimer <= 90) {
        this._kiteSpeedMult = 1.0;
      } else if (this._kiteTimer <= 450) {
        this._kiteSpeedMult = 1.0 - 0.35 * ((this._kiteTimer - 90) / 360);
      } else {
        this._kiteSpeedMult = 0.65;
      }
    }
    // ── Ranged burst tracking ─────────────────────────────────────────────────
    if (!this.isBoss && this.weapon && this.weapon.type === 'ranged') {
      if (this.attackTimer > 0) {
        this._rangedBurstTimer++;
        // After ~3s of continuous fire, apply post-burst debuff
        if (this._rangedBurstTimer >= 180 && this._rangedMovePenalty <= 0) {
          this._rangedMovePenalty = 40; // 0.67s recovery debuff
          this._rangedBurstTimer  = 0;
        }
      } else {
        this._rangedBurstTimer = Math.max(0, this._rangedBurstTimer - 1);
        this._rangedShotHeat   = Math.max(0, this._rangedShotHeat - 0.16);
      }
    }
    if (this._rangedMovePenalty > 0) this._rangedMovePenalty--;
    if (this._rangedCommitTimer > 0) this._rangedCommitTimer--;
    if (this._rangedRecoilKick > 0) this._rangedRecoilKick--;
    if (this._recentRangedUse > 0) this._recentRangedUse--;
    if (this.hurtTimer > 0)       this.hurtTimer--;
    if (this.stunTimer > 0)       this.stunTimer--;
    if (this.ragdollTimer > 0)    this.ragdollTimer--;
    // ── STATE RESET FAILSAFE ─────────────────────────────────────────────────
    // If hitstun/stun/ragdoll timers are stuck above their maximum possible values,
    // force them back to neutral so the fighter doesn't get permanently locked.
    if (this.hurtTimer > 240) {
      console.warn('[STATE] hurtTimer overflow — reset on', this.name || 'fighter');
      this.hurtTimer = 0;
    }
    if (this.stunTimer > 180) {
      console.warn('[STATE] stunTimer overflow — reset on', this.name || 'fighter');
      this.stunTimer = 0;
    }
    if (this.ragdollTimer > 180) {
      console.warn('[STATE] ragdollTimer overflow — reset on', this.name || 'fighter');
      this.ragdollTimer = 0; this.ragdollSpin = 0;
    }
    if (this.spinning > 0)        this.spinning--;
    if (this.boostCooldown > 0)        this.boostCooldown--;
    if (this.shieldCooldown > 0)       this.shieldCooldown--;
    if (this._projDeflectCd > 0)       this._projDeflectCd--;
    if (this.contactDamageCooldown > 0) this.contactDamageCooldown--;
    // Reload ticker — refill clip when timer expires
    if (this._reloadTimer > 0) {
      if (this.hurtTimer > 0 && !this._reloadInterrupted) {
        this._reloadTimer = this.weapon && this.weapon.reloadFrames ? Math.round(this.weapon.reloadFrames * 1.18) : this._reloadTimer;
        this._reloadInterrupted = true;
      }
      this._reloadTimer--;
      if (this._reloadTimer === 0 && this.weapon && this.weapon.clipSize) {
        this._ammo = this.weapon.clipSize;
        this._reloadInterrupted = false;
        if (!this.isAI) SoundManager.pickup && SoundManager.pickup();
      }
    }
    if (this.hurtTimer <= 0) this._reloadInterrupted = false;
    if (this.superFlashTimer > 0)      this.superFlashTimer--;
    if (this.spartanRageTimer > 0) this.spartanRageTimer--;
    this.animTimer++;

    if (this.noCooldownsActive) {
      this.cooldown = 0; this.cooldown2 = 0;
      this.abilityCooldown = 0; this.abilityCooldown2 = 0;
      this.shieldCooldown = 0; this.boostCooldown = 0;
    }
    // Story mode: runtime enforcement — ranged weapons silently swap to sword
    if (storyModeActive && !this.isBoss && this.weapon && this.weapon.type === 'ranged') {
      if (typeof WEAPONS !== 'undefined' && WEAPONS.sword) {
        this.weapon = WEAPONS.sword;
        this.weaponKey = 'sword';
        this._ammo = 0;
      }
    }

    // ---- RAGDOLL SPIN PHYSICS ----
    if (this.ragdollTimer > 0) {
      this.ragdollAngle += this.ragdollSpin;
      this.ragdollSpin  *= 0.97; // gradually decelerate spin
    } else {
      this.ragdollAngle = 0;
      this.ragdollSpin  = 0;
    }

    // ---- PER-LIMB SPRING-DAMPER RAGDOLL ----
    // Lazily init on first update; runs every frame to keep pose smooth.
    if (!this._rd) PlayerRagdoll.createRagdoll(this);
    PlayerRagdoll.updateLimbs(this);
    // Lean torso into movement direction
    if (Math.abs(this.vx) > 0.5) PlayerRagdoll.applyMovement(this);

    // ---- WEAPON ARC HITBOX (melee only) — sweeps multiple points along swing arc ----
    if (this.attackTimer > 0 && this.weapon.type === 'melee') {
      // Build a set of hit-check points: tip + mid-arc + close-arc for wide coverage
      const hitPoints = this._getMeleeArcPoints();
      if (hitPoints.length > 0) {
        const hitPad = 8; // tight horizontal pad — reduces phantom hits from behind/above

        // Helper: is any hit point inside the target's box?
        // Y-axis is strict: no hit if attacker and target have > 70px vertical separation.
        const arcHits = (tx, ty, tw, th, extraPad) => {
          const ep = extraPad || 0;
          // Directional check: hit point must be on the side the attacker is facing
          const facingSign = this.facing;
          for (const pt of hitPoints) {
            if (pt.x > tx - hitPad - ep && pt.x < tx + tw + hitPad + ep &&
                pt.y > ty - 8  - ep    && pt.y < ty + th + 8  + ep) return true;
          }
          return false;
        };

        // All players in range (multi-target — not locked to primary target)
        for (const tgt of players) {
          if (tgt === this || !tgt || tgt.health <= 0) continue;
          // Vertical separation guard: require meaningful bounding-box overlap (~55px center gap)
          if (Math.abs((this.y + this.h / 2) - (tgt.y + tgt.h / 2)) > 55) continue;
          // Block friendly fire unless survival competitive mode explicitly enables it
          const _survFFM = gameMode === 'minigames' && minigameType === 'survival' && survivalFriendlyFire;
          if (!_survFFM && gameMode === 'boss' && !this.isBoss && !tgt.isBoss) continue;
          // Block friendly fire in minigames ONLY for survival team mode
          if (gameMode === 'minigames' && minigameType === 'survival' && !_survFFM && !this.isBoss && !tgt.isBoss && !tgt.isAI && !this.isAI) continue;
          if (!this.swingHitTargets.has(tgt) && arcHits(tgt.x, tgt.y, tgt.w, tgt.h, 0)) {
            dealDamage(this, tgt, this.weapon.damage, this.weapon.kb);
            this.swingHitTargets.add(tgt);
            this.weaponHit = true;
          }
        }
        // All minions in range (multi-hit — no break)
        if (!this.isMinion && !(this instanceof Boss)) {
          for (const mn of minions) {
            if (!this.swingHitTargets.has(mn) && mn.health > 0 && arcHits(mn.x, mn.y, mn.w, mn.h, 4)) {
              dealDamage(this, mn, this.weapon.damage, this.weapon.kb);
              this.swingHitTargets.add(mn);
              this.weaponHit = true;
            }
          }
        }
        // All training dummies in range (multi-hit — no break)
        if (!this.isDummy) {
          for (const dum of trainingDummies) {
            if (!this.swingHitTargets.has(dum) && dum.health > 0 && arcHits(dum.x, dum.y, dum.w, dum.h, 0)) {
              dealDamage(this, dum, this.weapon.damage, this.weapon.kb);
              this.swingHitTargets.add(dum);
              this.weaponHit = true;
            }
          }
        }
        const tip = hitPoints[hitPoints.length - 1]; // use outermost point for platform sparks
        // Weapon bounces off platform surfaces → sparks + recoil
        if (!this.weaponHit) {
          for (const pl of currentArena.platforms) {
            if (tip.x > pl.x && tip.x < pl.x + pl.w &&
                tip.y > pl.y && tip.y < pl.y + pl.h) {
              spawnParticles(tip.x, tip.y, '#ffee88', 5);
              spawnParticles(tip.x, tip.y, '#ffffff', 3);
              screenShake = Math.max(screenShake, 5);
              this.attackTimer = Math.min(this.attackTimer, 4); // cut swing short
              this.weaponHit   = true;
              break;
            }
          }
        }
      }
    }

    // ---- PASSIVE WEAPON CONTACT (melee only, while not mid-swing) ----
    if (this.weapon && this.weapon.type === 'melee' && this.attackTimer === 0 &&
        this.contactDamageCooldown === 0 && this.target) {
      const tgt = this.target;
      if (tgt.health > 0 && dist(this, tgt) < this.weapon.range * 0.62) {
        const movingToward = (tgt.cx() > this.cx() && this.vx > 0.8) ||
                             (tgt.cx() < this.cx() && this.vx < -0.8);
        if (movingToward) {
          const contactMult = this.weapon.contactDmgMult !== undefined ? this.weapon.contactDmgMult : 0.25;
          dealDamage(this, tgt, Math.max(1, Math.floor(this.weapon.damage * contactMult)),
                                Math.floor(this.weapon.kb * 0.35));
          this.contactDamageCooldown = 32;
        }
      }
    }

    // AI: only update every AI_TICK_INTERVAL frames (smoother movement, less CPU)
    // _fusionAIOverride is handled by paradoxFusionUpdateAI() in the game loop — do NOT run stock AI
    // combatLock.blocks.ai gates the whole update during finishers, QTEs, and cinematics
    if (this.isAI && !this._fusionAIOverride && this.target &&
        !activeCinematic &&
        !(typeof isCutsceneActive === 'function' && isCutsceneActive()) &&
        !(typeof isCombatLocked === 'function' && isCombatLocked('ai')) &&
        aiTick % AI_TICK_INTERVAL === 0) this.updateAI();

      // ── Standard game physics ──
      // godmode cheat: free flight for human player
      if (this.godmode && !this.isAI && !this.isBoss) {
        this.health = this.maxHealth;
        this.invincible = 9999;
        const fUp   = this.controls && keysDown.has(this.controls.jump);
        const fDown = this.controls && keysDown.has(this.controls.shield);
        this.vy = fUp ? -9 : (fDown ? 9 : this.vy * 0.7);
        this.onGround = true;
        this.x += this.vx * slowMotion;
        this.y += this.vy * slowMotion;
        this.vx *= 0.72;
        this.vx = clamp(this.vx, -13, 13);
        this.y = clamp(this.y, -200, GAME_H + 100);
        this._prevOnGround = true;
        return;
      }
      // Training designer: godmode + free flight for human player
      if (trainingDesignerOpen && !this.isAI && !this.isBoss) {
        this.health = this.maxHealth;
        this.invincible = 9999;
        // Free flight: zero out gravity, allow up/down movement via jump/shield keys
        const fUp   = this.controls && keysDown.has(this.controls.jump);
        const fDown = this.controls && keysDown.has(this.controls.shield);
        this.vy = fUp ? -6 : (fDown ? 6 : 0);
        this.onGround = true; // prevent double-jump consumption
        this.x += this.vx * slowMotion;
        this.y += this.vy * slowMotion;
        this.vx *= 0.72;
        this.vx = clamp(this.vx, -13, 13);
        this.y = clamp(this.y, -200, GAME_H + 100);
        this._prevOnGround = true;
        return; // skip normal physics this frame
      }
      const _chaosMoon = gameMode === 'minigames' && currentChaosModifiers.has('moon');
      const _arenaModGrav = (currentArena.modifiers && currentArena.modifiers.gravityMult) || 1.0;
      const arenaGravity = (_chaosMoon ? 0.18 : (currentArena.isLowGravity ? 0.28 : (currentArena.isHeavyGravity ? 0.95 : (currentArena.earthPhysics ? 0.88 : 0.65)))) * _arenaModGrav;
      const gravDir = ((gameMode === 'trueform' || gameMode === 'story') && tfGravityInverted && !this.isBoss) ? -1 : 1;
      const _sm = slowMotion; // cinematic slow-motion time scale

      // ── GRAVITY FAILSAFE ─────────────────────────────────────────────────────
      // If _dimPunchGravLock is stuck (sequence was interrupted without cleanup), clear it.
      if (this._dimPunchGravLock) {
        const _dpActive = (typeof tfDimensionPunch !== 'undefined') && tfDimensionPunch != null;
        if (!_dpActive) {
          this._dimPunchGravLock = false;
          console.warn('[PHYS] gravity lock cleared by failsafe on', this.name || 'fighter');
        }
      }

      // Dimension punch gravity lock: skip gravity while player is being launched/travelling
      if (!this._dimPunchGravLock) {
        this.vy += arenaGravity * gravDir * _sm;
      }
      this.x  += this.vx * _sm;
      this.y  += this.vy * _sm;
      const _chaosSlip = gameMode === 'minigames' && currentChaosModifiers.has('slippery');
      const _arenaModFric = (currentArena.modifiers && currentArena.modifiers.frictionMult) || 1.0;
      const _baseFric = (this.onGround && (currentArena.isIcy || _chaosSlip)) ? 0.975 : (this.onGround ? 0.78 : 0.94);
      // frictionMult > 1 = more grip (higher deceleration); < 1 = more slip
      const friction = 1 - (1 - _baseFric) * _arenaModFric;
      this.vx *= friction;
      // During dimension travel, allow vx beyond the normal cap
      const _vxMax = this._dimPunchGravLock ? 60 : 13;
      this.vx  = clamp(this.vx, -_vxMax, _vxMax);
      const vyMax = currentArena.isLowGravity ? 10 : 19;
      this.vy  = clamp(this.vy, -20, vyMax);

      // ── VELOCITY SANITY LOG (debug) ──────────────────────────────────────────
      if (Math.abs(this.vx) > 11 || Math.abs(this.vy) > 17) {
        console.warn('[PHYS] high velocity', this.name || 'fighter', 'vx:', this.vx.toFixed(1), 'vy:', this.vy.toFixed(1));
      }
      this.onGround = false;
      // Inverted gravity ceiling bounce
      if (gameMode === 'trueform' && tfGravityInverted && !this.isBoss && this.y < 0) {
        this.y = 0; this.vy = Math.abs(this.vy) * 0.4;
      }
      // No ceiling — camera zooms out to follow players upward
      // Story/story-only arenas: soft boundary — flag for portal teleport instead of hard wall
      const _storyWalls = storyModeActive || (currentArena && currentArena.isStoryOnly);
      if (_storyWalls && !this.isBoss && gameMode !== 'exploration') {
        // Mark fighter for portal teleport when they step into the boundary portal visual
        // Portal visuals are drawn at mapLeft+10 and mapRight-10; trigger fires as player enters them
        const softLeft  = currentArena && currentArena.mapLeft  !== undefined ? currentArena.mapLeft  + 30 : -60;
        const softRight = currentArena && currentArena.mapRight !== undefined ? currentArena.mapRight - this.w - 30 : GAME_W - this.w + 60;
        if (this.x < softLeft)   { this._storyBoundaryBreached = 'left';  }
        else if (this.x > softRight) { this._storyBoundaryBreached = 'right'; }
        else { this._storyBoundaryBreached = null; }
      }
      for (const pl of currentArena.platforms) this.checkPlatform(pl);
      this._voidSafetyFrame(); // Per-frame void/lava safety — bypasses AI tick delay

    // Coyote time: if player just walked off a platform (was on ground, now isn't),
    // grant 6 frames where a ground jump is still possible
    if (this._prevOnGround && !this.onGround && this.vy > -5 && !this.isBoss) {
      // Walked off edge (vy > -5 means didn't jump off)
      if (this.coyoteFrames === 0) this.coyoteFrames = 6;
    }
    // Megaknight: record Y when leaving ground for fall-height damage
    if (this.charClass === 'megaknight' && this._prevOnGround && !this.onGround) {
      this._fallStartY = this.y;
    }
    // Enable double jump for ALL entities (including AI/Boss/TrueForm) when they jump off ground
    if (this._prevOnGround && !this.onGround && this.vy <= -5) {
      this.canDoubleJump = true;
    }
    if (this.coyoteFrames > 0 && !this.onGround) this.coyoteFrames--;
    this._prevOnGround = this.onGround;

    // Horizontal clamp — only boss arena has hard walls; large maps use floor edges; all others are open
    if (currentArena.isBossArena) {
      if (this.x < 0)               { this.x = 0;               this.vx =  Math.abs(this.vx) * 0.25; }
      if (this.x + this.w > GAME_W) { this.x = GAME_W - this.w; this.vx = -Math.abs(this.vx) * 0.25; }
    } else if (currentArena.worldWidth) {
      const mapLeft  = currentArena.mapLeft  !== undefined ? currentArena.mapLeft  : -(currentArena.worldWidth - GAME_W) / 2;
      const mapRight = currentArena.mapRight !== undefined ? currentArena.mapRight : (currentArena.worldWidth + GAME_W) / 2;
      // Story arenas with boundary portals use portal teleports instead of hard walls
      const _usePortals = storyModeActive && currentArena.boundaryPortals;
      if (!_usePortals) {
        if (this.x < mapLeft)               { this.x = mapLeft;               this.vx =  Math.abs(this.vx) * 0.25; }
        if (this.x + this.w > mapRight)     { this.x = mapRight - this.w;     this.vx = -Math.abs(this.vx) * 0.25; }
      }
    }
    // No clamp on standard arenas — players can drift slightly off edges; deathY handles falling

    // Death by falling / lava
    const dyY = currentArena.deathY;
    // Lava burn: damage + bounce when feet touch lava surface
    if (currentArena.hasLava && !this.isBoss && this.y + this.h > currentArena.lavaY && this.health > 0) {
      this.lavaBurnTimer++;
      if (!this.godmode) {
        if (this.vy > 0) {
          this.vy = -16; // lava bounce
          this.canDoubleJump = true; // refill double jump on lava bounce
        }
        this.vx *= 0.88;
        // Apply immediate damage on first contact and every 6 frames thereafter
        // Routes through dealDamage so shield, iframes, and anti-stack checks apply
        if (this.lavaBurnTimer === 1 || this.lavaBurnTimer % 6 === 0) {
          // Ramping lava damage: starts gentle, escalates with sustained contact
          let _lavaDmg = 4;
          if (this.lavaBurnTimer > 120) _lavaDmg = 8;
          else if (this.lavaBurnTimer > 60) _lavaDmg = 6;
          dealDamage(null, this, _lavaDmg, 0, 1.0, false, 6);
          if (settings.particles) spawnParticles(this.cx(), this.cy(), '#ff6600', 8);
          if (settings.particles) spawnParticles(this.cx(), this.cy(), '#ffaa00', 5);
          if (settings.screenShake) screenShake = Math.max(screenShake, 4);
        }
      }
    } else {
      this.lavaBurnTimer = 0;
    }
    // Story mode: soft bottom boundary — flag for portal catch instead of hard clamp
    if (storyModeActive && !this.isBoss && this.y + this.h > dyY - 20) {
      this._storyBottomBreached = true;
    } else if (storyModeActive) {
      this._storyBottomBreached = false;
    }
    // Hard death (fell off screen or health ran out from lava)
    // Remote players: skip — their death is handled on their own machine
    if (!this.isRemote && this.y > dyY && this.health > 0) {
      if (this.isBoss) bossTeleport(this, true);
      else if (!this.godmode) this.health = 0;
    }

    this.updateState();

    // Auto-face: AI only — human players face from last key press (set in processInput)
    if (this.isAI) {
      if (this.target) this.facing = this.target.cx() > this.cx() ? 1 : -1;
      else if (Math.abs(this.vx) > 0.5) this.facing = this.vx > 0 ? 1 : -1;
    }

    // godmode visual: keep HP bar full for clarity
    if (this.godmode) this.health = this.maxHealth;

    // Apply speed/power buffs from map perks
    if (this._speedBuff > 0) this._speedBuff--;
    if (this._powerBuff > 0) this._powerBuff--;

    // Tick down active curses
    if (this.curses && this.curses.length > 0) {
      this.curses = this.curses.filter(c => {
        c.timer--;
        return c.timer > 0;
      });
    }

    // ---- CLASS PASSIVE PERK (fires once per life at HP threshold) ----
    if (!this.classPerkUsed && this.charClass !== 'none' && this.health > 0 && this.target) {
      const pct = this.health / this.maxHealth;

      // THOR: Lightning Storm at ≤20% HP — 3 lightning strikes on opponent
      if (this.charClass === 'thor' && pct <= 0.20) {
        this.classPerkUsed = true;
        screenShake = Math.max(screenShake, 22);
        spawnParticles(this.cx(), this.cy(), '#ffff00', 28);
        spawnParticles(this.cx(), this.cy(), '#88ddff', 14);
        const _t = this.target;
        for (let _i = 0; _i < 3; _i++) {
          setTimeout(() => {
            if (!gameRunning || !_t || _t.health <= 0) return;
            // Spawn visible lightning bolt from sky to target
            spawnLightningBolt(_t.cx(), _t.y);
            spawnParticles(_t.cx(), _t.cy(), '#ffff00', 22);
            spawnParticles(_t.cx(), _t.cy(), '#ffffff', 12);
            if (settings.screenShake) screenShake = Math.max(screenShake, 12);
            _t.health = Math.max(0, _t.health - 8);
            _t.hurtTimer = 10;
            _t.stunTimer = Math.max(_t.stunTimer, 45);
            if (settings.dmgNumbers) damageTexts.push(new DamageText(_t.cx(), _t.y, 8, '#ffff00'));
          }, _i * 350);
        }
      }

      // KRATOS: Spartan Rage at ≤15% HP — 5s damage boost; heals 10% of damage dealt during rage
      if (this.charClass === 'kratos' && pct <= 0.15) {
        this.classPerkUsed     = true;
        this.spartanRageTimer  = 300;
        this._spartanRageHealPool = 0; // resets each activation
        screenShake = Math.max(screenShake, 24);
        spawnParticles(this.cx(), this.cy(), '#ff4400', 30);
        spawnParticles(this.cx(), this.cy(), '#ff8800', 18);
        spawnParticles(this.cx(), this.cy(), '#ffffff',  8);
      }

      // NINJA: Shadow Step at ≤25% HP — 2s invincibility + all cooldowns reset
      if (this.charClass === 'ninja' && pct <= 0.25) {
        this.classPerkUsed = true;
        this.invincible = 120;
        this.cooldown = 0; this.abilityCooldown = 0; this.shieldCooldown = 0; this.boostCooldown = 0;
        screenShake = Math.max(screenShake, 14);
        spawnParticles(this.cx(), this.cy(), '#44ff88', 30);
        spawnParticles(this.cx(), this.cy(), '#ffffff', 14);
      }

      // GUNNER: Last Stand at ≤20% HP — 8 bullets burst in all directions
      if (this.charClass === 'gunner' && pct <= 0.20) {
        this.classPerkUsed = true;
        screenShake = Math.max(screenShake, 26);
        spawnParticles(this.cx(), this.cy(), '#ff6600', 28);
        spawnParticles(this.cx(), this.cy(), '#ffaa00', 14);
        for (let _j = 0; _j < 8; _j++) {
          const _ang = (_j / 8) * Math.PI * 2;
          const _spd = 11 + Math.random() * 3;
          const _dmg = Math.floor(Math.random() * 3) + 3;
          projectiles.push(new Projectile(
            this.cx(), this.cy(),
            Math.cos(_ang) * _spd, Math.sin(_ang) * _spd,
            this, _dmg, '#ff4400'
          ));
        }
      }

      // ARCHER: Back-Step at ≤20% HP — auto-dash backward + reset double jump
      if (this.charClass === 'archer' && pct <= 0.20 && this.onGround) {
        this.classPerkUsed = true;
        this.vx = -this.facing * 20;
        this.canDoubleJump = true;
        spawnParticles(this.cx(), this.cy(), '#aad47a', 16);
      }

      // PALADIN: Holy Light at ≤25% HP — AoE heal pulse
      if (this.charClass === 'paladin' && pct <= 0.25) {
        this.classPerkUsed = true;
        this.health = Math.min(this.maxHealth, this.health + 20);
        screenShake = Math.max(screenShake, 14);
        spawnParticles(this.cx(), this.cy(), '#ffffaa', 28);
        spawnParticles(this.cx(), this.cy(), '#88aaff', 14);
        for (const p of players) {
          if (p === this || p.health <= 0) continue;
          if (dist(this, p) < 130) dealDamage(this, p, 15, 8);
        }
      }

      // BERSERKER: Blood Frenzy at ≤15% HP — 3s damage boost + speed boost
      if (this.charClass === 'berserker' && pct <= 0.15) {
        this.classPerkUsed = true;
        this._powerBuff   = 180; // 3s damage boost via existing power buff
        this._speedBuff   = 180; // also speed boost
        screenShake = Math.max(screenShake, 20);
        spawnParticles(this.cx(), this.cy(), '#ff2200', 24);
        spawnParticles(this.cx(), this.cy(), '#880000', 12);
      }

      // (Megaknight perk is now the super — no passive HP-threshold trigger)
    }
  }

  checkPlatform(pl) {
    if (pl.isFloorDisabled) return;
    // Broad-phase: skip if no overlap at all
    if (this.x + this.w <= pl.x || this.x >= pl.x + pl.w ||
        this.y + this.h <= pl.y || this.y >= pl.y + pl.h) return;

    // Penetration depth on each side
    const dTop    = (this.y + this.h) - pl.y;      // player bottom into platform top
    const dBottom = (pl.y + pl.h)    - this.y;     // player top  into platform bottom
    const dLeft   = (this.x + this.w) - pl.x;      // player right into platform left
    const dRight  = (pl.x + pl.w)    - this.x;     // player left  into platform right

    const minPen = Math.min(dTop, dBottom, dLeft, dRight);

    if (minPen === dTop && this.vy >= 0) {
      // Fell onto top surface
      const landVy = this.vy;
      this.y           = pl.y - this.h;
      this.vy          = 0;
      this.onGround    = true;
      this.canDoubleJump = false; // reset on landing; re-enabled by jumping
      // Edge grip: if player is within 4px past a platform edge, nudge them back
      // Prevents frustrating slip-offs when barely touching a platform
      if (!this.isBoss) {
        const overLeft  = pl.x - (this.x + this.w);   // +ve = player barely on left edge
        const overRight = this.x - (pl.x + pl.w);     // +ve = player barely on right edge
        if (overLeft  >= 0 && overLeft  < 4) this.x = pl.x - this.w + 1;
        if (overRight >= 0 && overRight < 4) this.x = pl.x + pl.w - 1;
      }
      // Bouncy platform — launch player upward
      if (pl.isBouncy && landVy > 1) {
        pl.sinkOffset = (pl.sinkOffset || 0) + Math.min(landVy * 0.5, 22);
        this.vy = -Math.max(18, landVy * 1.1); // bounce up with at least 18 force
        this.canDoubleJump = true;              // refill double jump on bounce
        this.onGround = false;
        spawnParticles(this.cx(), pl.y, '#ff88ff', 10);
      }
      // Landing squash animation trigger
      if (!this.isBoss && landVy > 5) this.squashTimer = 4;
      // Clear pending double-jump intent on landing
      if (this.isAI) this._pfDoubleJumpPending = false;
      // Landing dust — harder landing = more particles
      if (settings.landingDust && landVy > 4) {
        spawnParticles(this.cx(), pl.y, 'rgba(200,200,200,0.9)', Math.min(14, Math.floor(landVy * 1.2)));
        if (!this.isAI && landVy > 6) SoundManager.land();
      }
      // Stop ragdoll spin on landing
      if (this.ragdollTimer > 0 && landVy > 2) {
        spawnParticles(this.cx(), pl.y, this.color, 10);
        this.ragdollSpin = 0;
      }
      // MEGAKNIGHT: Fall-height landing damage (any normal landing, not just Mega Jump)
      if (this.charClass === 'megaknight' && !this._megaJumping && !this._spawnFalling &&
          this._fallStartY !== null && landVy > 5) {
        const fallHeight = Math.max(0, this.y - this._fallStartY); // positive = fell down
        if (fallHeight > 40) {
          const dmg = Math.max(5, Math.min(40, Math.floor(fallHeight * 0.15)));
          const _allF = [...players, ...minions, ...trainingDummies];
          let hitAny = false;
          for (const f of _allF) {
            if (f === this || f.health <= 0) continue;
            const _d = Math.hypot(f.cx() - this.cx(), f.cy() - this.cy());
            if (_d < 100) {
              dealDamage(this, f, Math.round(dmg * (1 - _d/100)), Math.round(20 * (1 - _d/100)));
              hitAny = true;
            }
          }
          if (hitAny || fallHeight > 80) {
            // Shockwave particle ring
            spawnParticles(this.cx(), pl.y, '#8844ff', Math.min(20, Math.floor(fallHeight * 0.2)));
            spawnParticles(this.cx(), pl.y, '#ffffff', 8);
            if (settings.screenShake) screenShake = Math.max(screenShake, Math.min(fallHeight * 0.1, 14));
          }
        }
        this._fallStartY = null;
      }
      // MEGAKNIGHT: Mega Jump shockwave on landing
      if (this._megaJumping && !this._megaJumpLanded && landVy > 8) {
        this._megaJumping    = false;
        this._megaJumpLanded = true;
        this.invincible      = 0;
        screenShake = Math.max(screenShake, 28);
        spawnParticles(this.cx(), pl.y, '#8844ff', 30);
        spawnParticles(this.cx(), pl.y, '#ffffff', 18);
        const _allF = [...players, ...minions, ...trainingDummies];
        for (const f of _allF) {
          if (f === this || f.health <= 0) continue;
          const _d = Math.hypot(f.cx() - this.cx(), f.cy() - this.cy());
          if (_d < 200) {
            const _pct = 1 - _d / 200;
            dealDamage(this, f, Math.round(45 * _pct), Math.round(55 * _pct));
            f.vy = Math.min(f.vy, -22 * _pct);
            f.vx += Math.sign(f.cx() - this.cx()) * 12 * _pct;
          }
        }
        SoundManager.explosion && SoundManager.explosion();
      }
      // MEGAKNIGHT: spawn-fall landing — deals AoE damage when dropping in from sky
      if (this._spawnFalling && landVy > 6) {
        this._spawnFalling = false;
        this.invincible    = 0;
        screenShake = Math.max(screenShake, 32);
        spawnParticles(this.cx(), pl.y, '#8844ff', 36);
        spawnParticles(this.cx(), pl.y, '#ffffff', 22);
        camHitZoomTimer = 20;
        const _allFS = [...players, ...minions, ...trainingDummies];
        for (const f of _allFS) {
          if (f === this || f.health <= 0) continue;
          const _d = Math.hypot(f.cx() - this.cx(), f.cy() - this.cy());
          if (_d < 200) {
            const _p = 1 - _d / 200;
            dealDamage(this, f, Math.round(35 * _p), 50 * _p);
            f.vy = Math.min(f.vy, -18 * _p);
          }
        }
        SoundManager.explosion && SoundManager.explosion();
      }
    } else if (minPen === dBottom && this.vy <= 0) {
      // Bumped head on underside
      this.y  = pl.y + pl.h;
      this.vy = Math.abs(this.vy) * 0.1; // small bounce so gravity takes over
    } else if (minPen === dLeft) {
      // Hit right face of platform (player moving right)
      this.x  = pl.x - this.w;
      this.vx = Math.min(this.vx, 0);
    } else if (minPen === dRight) {
      // Hit left face of platform (player moving left)
      this.x  = pl.x + pl.w;
      this.vx = Math.max(this.vx, 0);
    }
  }

  // Player state machine: idle | run | jump | fall | attack | stunned | ragdoll | dead
  updateState() {
    if (this.health <= 0)              this.state = 'dead';
    else if (this.ragdollTimer > 0)     this.state = 'ragdoll';
    else if (this.hurtTimer > 0)       this.state = 'hurt';
    else if (this.stunTimer > 0)       this.state = 'stunned';
    else if (this.attackTimer > 0)     this.state = 'attacking';
    else if (this.shielding)           this.state = 'shielding';
    else if (!this.onGround)           this.state = this.vy < 0 ? 'jumping' : 'falling';
    else if (Math.abs(this.vx) > 0.7)  this.state = 'walking';
    else                               this.state = 'idle';
  }

  // Returns weapon-tip world position during a melee swing, or null if not attacking.
  getWeaponTipPos() {
    if (this.attackTimer <= 0) return null;
    const cx         = this.cx();
    // Must match draw() layout: headR(11) + 1 + headR(11) + 1 + neckLen(5) = 29
    const shoulderY  = this.y + 29;
    const armLen     = 24; // matches draw() armLen
    const atkP       = 1 - this.attackTimer / this.attackDuration;
    const ang = this.facing > 0
      ? lerp(-0.45, 1.1,          atkP)
      : lerp(Math.PI + 0.45, Math.PI - 1.1, atkP);
    const tipLens = { sword: 30, hammer: 34, axe: 26, spear: 44, gauntlet: 28 };
    const wLen    = tipLens[this.weaponKey] || 26;
    const reach   = armLen + wLen;
    return {
      x: cx         + Math.cos(ang) * reach,
      y: shoulderY  + Math.sin(ang) * reach
    };
  }

  // Returns 3 points along the weapon swing arc for broad hitbox coverage.
  // Includes the inner arm, mid-arc, and tip — so enemies right next to the
  // attacker or slightly misaligned still get hit.
  _getMeleeArcPoints() {
    if (this.attackTimer <= 0) return [];
    const cx        = this.cx();
    const shoulderY = this.y + 29;
    const armLen    = 24;
    const atkP      = 1 - this.attackTimer / this.attackDuration;
    const ang = this.facing > 0
      ? lerp(-0.45, 1.1,          atkP)
      : lerp(Math.PI + 0.45, Math.PI - 1.1, atkP);
    const tipLens = { sword: 30, hammer: 34, axe: 26, spear: 44, gauntlet: 28 };
    const wLen    = tipLens[this.weaponKey] || 26; // no extra reach padding — keep hitbox tight
    const fullReach = armLen + wLen;
    // Sample inner (50%), mid (75%), and tip (100%) along the weapon
    return [0.50, 0.75, 1.0].map(frac => ({
      x: cx        + Math.cos(ang) * fullReach * frac,
      y: shoulderY + Math.sin(ang) * fullReach * frac,
    }));
  }

  // ---- ATTACK ----
  attack(target) {
    if (isCinematic) return; // no new attacks during cinematics or finishers
    if (this.backstageHiding) return;
    if (this.state === 'dead' || this.state === 'stunned' || this.state === 'ragdoll') return;
    if (this.cooldown > 0 || this.health <= 0 || this.stunTimer > 0 || this.ragdollTimer > 0) return;
    if (!this.isBoss && this.attackEndlag > 0) return; // enforced swing recovery window

    // MEGAKNIGHT: Gauntlet Smash — AoE slam in front, launches enemies outward
    if (this.charClass === 'megaknight') {
      this.cooldown     = this.attackCooldownMult ? Math.max(1, Math.ceil(this.weapon.cooldown * this.attackCooldownMult)) : this.weapon.cooldown;
      this.attackTimer  = this.attackDuration;
      this.superChargeRate = 2;
      this.weaponHit    = false;
      SoundManager.heavyHit && SoundManager.heavyHit();
      const _allF = [...players, ...minions, ...trainingDummies];
      for (const f of _allF) {
        if (f === this || f.health <= 0) continue;
        const relX = f.cx() - this.cx();
        const relY = f.cy() - this.cy();
        if (Math.hypot(relX, relY) < 140 && (relX * this.facing > -30)) {
          dealDamage(this, f, this.weapon.damage, this.weapon.kb);
          f.vx += this.facing * 10;
          f.vy  = Math.min(f.vy, -6);
        }
      }
      spawnParticles(this.cx() + this.facing * 40, this.cy(), '#8844ff', 12);
      spawnParticles(this.cx() + this.facing * 40, this.cy(), '#cc88ff', 6);
      screenShake = Math.max(screenShake, 8);
      return;
    }

    if (!this.weapon) return;
    if (this.weapon.type === 'melee') {
      // Use closest enemy (dummy, minion, or training target) if target is null
      const _atkTarget = target || this.target || trainingDummies[0] || players.find(p => p !== this);
      // Damage is delivered via weapon-tip hitbox in update() — just start the swing
      // Always clear swingHitTargets so previous swing's targets can be hit again
      this.weaponHit = false;
      this.swingHitTargets.clear();
      if (!_atkTarget || dist(this, _atkTarget) < this.weapon.range * 1.4) {
        if (!this.isAI) SoundManager.swing();
      }
    } else {
      const _distToTarget = target ? dist(this, target) : 999;
      const _pointBlankT  = !this.isBoss ? Math.max(0, 1 - clamp((_distToTarget - 48) / 72, 0, 1)) : 0;
      // Ranged: close-range disadvantage — add extra cooldown when enemy is point-blank (<70px)
      if (!this.isBoss && _distToTarget < 70) {
        const _pbPenalty = Math.round((this.weapon.cooldown || 30) * 0.35);
        this.cooldown = Math.max(this.cooldown, _pbPenalty); // stacks with normal cooldown
      }
      // Ranged: check ammo clip
      if (this.weapon.clipSize) {
        if (this._reloadTimer > 0) return; // currently reloading — can't shoot
        if (this._ammo <= 0) {
          // Out of ammo — start reload
          this._reloadTimer = Math.round(this.weapon.reloadFrames * 1.18);
          this._reloadInterrupted = false;
          return;
        }
        this._ammo--;
        // Auto-trigger reload when last round is fired
        if (this._ammo === 0) {
          this._reloadTimer = Math.round(this.weapon.reloadFrames * 1.18);
          this._reloadInterrupted = false;
        }
      }
      if (!this.isAI) SoundManager.shoot();
      const bSpd = this.weapon.bulletSpeed || 13;
      const bClr = this.weapon.bulletColor || '#ffdd00';
      const bVy  = this.weapon.bulletVy  || 0;
      const _baseDmg = this.weapon.damageFunc ? this.weapon.damageFunc() : this.weapon.damage;
      const _closeDmgMult = 1 - _pointBlankT * 0.34;
      const dmg  = Math.max(1, Math.round(_baseDmg * _closeDmgMult));
      // Slingshot: auto-aim regular shot at nearest enemy (arc adjusted to lead target)
      let _bvx = this.facing * bSpd, _bvy = bVy;
      if (this.weaponKey === 'slingshot') {
        const _aimPool = [...players, ...trainingDummies].filter(p => p !== this && p.health > 0);
        const _aimT = _aimPool.sort((a,b) => dist(this,a) - dist(this,b))[0];
        if (_aimT) {
          const _adx = _aimT.cx() - this.cx(), _ady = _aimT.cy() - this.cy();
          const _alen = Math.hypot(_adx, _ady) || 1;
          _bvx = (_adx / _alen) * bSpd;
          _bvy = (_ady / _alen) * bSpd;
        }
      }
      // Movement-based spread (same logic as spawnBullet)
      const _atkSpd    = Math.abs(this.vx);
      const _atkRapid  = this.weapon.cooldown <= 20;
      const _recoilHeat = Math.min(8, this._rangedShotHeat + 1);
      const _atkSpread = (_atkSpd > 0.8 ? (_atkSpd / 5.2) * (_atkRapid ? 2.0 : 1.25) * 0.70 : 0)
                       + _recoilHeat * (_atkRapid ? 0.28 : 0.18)
                       + _pointBlankT * (_atkRapid ? 1.45 : 0.95);
      const _atkVyOff  = _atkSpread > 0 ? (Math.random() - 0.5) * _atkSpread : 0;
      const _proj = new Projectile(
        this.cx() + this.facing * 12, this.y + 22,
        _bvx, _bvy + _atkVyOff, this, dmg, bClr
      );
      _proj._closeRangePenalty = _pointBlankT;
      _proj._warmupFrames = _atkRapid ? 3 : 2;
      projectiles.push(_proj);
      // Gunner class: fire a second bullet (costs no extra ammo — it's the same shot)
      if (this.charClass === 'gunner') {
        const dmg2 = Math.max(1, Math.round((this.weapon.damageFunc ? this.weapon.damageFunc() : this.weapon.damage) * _closeDmgMult));
        const _proj2 = new Projectile(this.cx() + this.facing * 12, this.y + 28, this.facing * bSpd * 0.92, bVy - 0.8 + _atkVyOff, this, dmg2, bClr);
        _proj2._closeRangePenalty = _pointBlankT;
        _proj2._warmupFrames = _atkRapid ? 3 : 2;
        projectiles.push(_proj2);
      }
      const _commitFrames = Math.max(10, Math.min(18, Math.round((this.weapon.cooldown || 30) * 0.42)));
      const _recoilPush = 0.6 + _recoilHeat * (_atkRapid ? 0.11 : 0.08);
      this.attackEndlag = Math.max(this.attackEndlag || 0, _commitFrames);
      this._rangedCommitTimer = Math.max(this._rangedCommitTimer, _commitFrames);
      this._rangedMovePenalty = Math.max(this._rangedMovePenalty, Math.round(_commitFrames * 1.55));
      this._rangedShotHeat = Math.min(8, this._rangedShotHeat + (_atkRapid ? 1.75 : 1.15) + _pointBlankT * 0.9);
      this._recentRangedUse = Math.min(180, this._recentRangedUse + 28);
      this._rangedRecoilKick = Math.max(this._rangedRecoilKick, _commitFrames);
      this.vx *= _atkRapid ? 0.58 : 0.68;
      this.vx -= this.facing * _recoilPush;
    }
    this.cooldown    = this.attackCooldownMult ? Math.max(1, Math.ceil(this.weapon.cooldown * this.attackCooldownMult)) : this.weapon.cooldown;
    this.attackTimer = this.attackDuration;
    // Affinity feel: low affinity slows movement during attack swing; high affinity lets you stay mobile
    if (!this.isBoss && this.charClass && this.weapon && typeof CLASS_AFFINITY !== 'undefined') {
      const _aff2 = CLASS_AFFINITY[this.charClass];
      if (_aff2) {
        const _affMult2 = _aff2[this.weapon.type] || 1.0;
        if (_affMult2 < 0.8) this._affinityMovePenalty = Math.round(this.attackDuration * 0.6); // sluggish during swing
        else if (_affMult2 > 1.2) this._affinityMovePenalty = 0; // no extra penalty
      }
    }
  }

  ability(target) {
    if (isCinematic) return; // no abilities during cinematics or finishers
    if (this.backstageHiding) return;
    if (this._storyNoAbility) return; // story progression — ability not yet unlocked
    if (this.state === 'dead' || this.state === 'stunned' || this.state === 'ragdoll') return;
    if (this.abilityCooldown > 0 || this.health <= 0 || this.stunTimer > 0 || this.ragdollTimer > 0) return;
    if (!this.isBoss && this.attackEndlag > 0) return; // can't ability during swing recovery
    // MEGAKNIGHT class override: Q = Uppercut — launch nearby enemies skyward
    if (this.charClass === 'megaknight') {
      this.abilityCooldown  = 75;
      this.abilityCooldown2 = 75;
      abilityFlashTimer = 14; abilityFlashPlayer = this;
      const _allF = [...players, ...minions, ...trainingDummies];
      let hitCount = 0;
      for (const f of _allF) {
        if (f === this || f.health <= 0) continue;
        if (Math.hypot(f.cx() - this.cx(), f.cy() - this.cy()) < 130) {
          dealDamage(this, f, 25, 20);
          f.vy = Math.min(f.vy, -28); // strong upward launch
          f.vx += (f.cx() > this.cx() ? 1 : -1) * 6;
          hitCount++;
        }
      }
      spawnParticles(this.cx(), this.y, '#8844ff', 22);
      spawnParticles(this.cx(), this.y, '#ffffff', hitCount > 0 ? 18 : 6);
      screenShake = Math.max(screenShake, hitCount > 0 ? 14 : 6);
      return;
    }
    const _safeTarget = target || this.target || trainingDummies[0] || players.find(p => p !== this && p.health > 0);
    if (!_safeTarget) return; // no valid target — don't fire ability (avoids null crash in weapon ability functions)
    if (!this.weapon || typeof this.weapon.ability !== 'function') return; // weapon not loaded yet
    this.weapon.ability(this, _safeTarget);
    this.abilityCooldown = this.weapon.abilityCooldown;
    this.attackTimer     = this.attackDuration * 2;
    abilityFlashTimer = 14; abilityFlashPlayer = this;
  }

  // Dedicated super / ultimate activation (separate button from Q)
  useSuper(target) {
    if (this.state === 'dead' || this.stunTimer > 0 || this.ragdollTimer > 0) return;
    if (!this.superReady) return;
    if (this._storyNoSuper) return; // story progression — super not yet unlocked
    this.activateSuper(target);
  }

  activateSuper(target) {
    // MEGAKNIGHT super: Mega Jump — massive leap into the sky, shockwave on landing
    if (this.charClass === 'megaknight') {
      this._megaJumping    = true;
      this._megaJumpLanded = false;
      this.vy              = -32;
      this.canDoubleJump   = true;
      this.superMeter      = 0;
      this.superReady      = false;
      this.superActive     = true; // block super meter charging from landing shockwave
      this.invincible      = Math.max(this.invincible, 120);
      screenShake = Math.max(screenShake, 20);
      spawnParticles(this.cx(), this.y + this.h, '#8844ff', 32);
      spawnParticles(this.cx(), this.y + this.h, '#cc88ff', 18);
      spawnParticles(this.cx(), this.y + this.h, '#ffffff', 10);
      SoundManager.explosion && SoundManager.explosion();
      setTimeout(() => { if (this) this.superActive = false; }, 4000);
      return;
    }
    // Boss heals 5% of max HP (no max HP increase); players gain +20 max HP and heal 20
    if (this.isBoss) {
      // Boss no longer heals on super — super is purely offensive
    } else {
      this.maxHealth = Math.min(200, this.maxHealth + 20);
      this.health    = Math.min(this.maxHealth, this.health + 20);
    }
    this.superMeter  = 0;
    this.superReady  = false;
    this.superActive = true; // block super-meter charging during this move
    setTimeout(() => { if (this) this.superActive = false; }, 4000); // clear after 4s (covers full attackTimer*3 window)
    screenShake      = Math.max(screenShake, 24);
    SoundManager.superActivate();
    if (!this.isAI && !this.isBoss) { _achStats.superCount++; if (_achStats.superCount >= 10) unlockAchievement('super_saver'); }
    spawnParticles(this.cx(), this.cy(), this.color,   36);
    spawnParticles(this.cx(), this.cy(), '#ffffff',    18);
    spawnParticles(this.cx(), this.cy(), '#ffd700',    12);
    this.attackTimer = this.attackDuration * 3;
    this.weaponHit   = false;
    if (!this.isBoss) this.invincible = Math.max(this.invincible, 90); // 1.5s i-frames on super
    // Resolve a safe target — target arg may be undefined in solo/training modes
    const _superTarget = target || this.target || trainingDummies[0] || players.find(p => p !== this && p.health > 0);
    const superMoves = {
      sword:  () => {
        this.vx = this.facing * 24;
        if (_superTarget && dist(this, _superTarget) < 210) dealDamage(this, _superTarget, 60, 30);
      },
      hammer: () => {
        screenShake = Math.max(screenShake, 36);
        spawnRing(this.cx(), this.y + this.h);
        spawnRing(this.cx(), this.y + this.h);
        if (_superTarget && dist(this, _superTarget) < 230) dealDamage(this, _superTarget, 38, 28);
      },
      gun: () => {
        for (let i = 0; i < 14; i++) {
          setTimeout(() => {
            if (!gameRunning || this.health <= 0) return;
            spawnBullet(this, 14 + (Math.random() - 0.5) * 4, '#ff8800', Math.floor(Math.random() * 4) + 9);
          }, i * 50);
        }
      },
      axe:   () => {
        this.spinning = 75;
        if (_superTarget && dist(this, _superTarget) < 175) dealDamage(this, _superTarget, 52, 26);
      },
      spear: () => {
        this.vx = this.facing * 22;
        this.vy = -10;
        if (_superTarget && dist(this, _superTarget) < 230) dealDamage(this, _superTarget, 50, 24);
      },
      // ── Bow: Arrow Rain — 8 spread arrows arc outward ───────────────────────
      bow: () => {
        for (let i = 0; i < 8; i++) {
          setTimeout(() => {
            if (!gameRunning || this.health <= 0) return;
            const angle = -0.48 + (i / 7) * 0.96;
            const spd   = 16;
            const dmg   = 24 + Math.floor(Math.random() * 10);
            projectiles.push(new Projectile(
              this.cx() + this.facing * 14, this.y + 20,
              this.facing * spd * Math.cos(angle), spd * Math.sin(angle) - 5,
              this, dmg, '#ffee44'
            ));
          }, i * 55);
        }
        spawnParticles(this.cx(), this.cy(), '#ffee44', 16);
      },
      // ── Shield: Fortress Charge — massive dash + KB + stun all nearby ───────
      shield: () => {
        this.vx = this.facing * 30;
        screenShake = Math.max(screenShake, 36);
        const _sAll = [...players, ...trainingDummies];
        for (const f of _sAll) {
          if (f === this || f.health <= 0) continue;
          if (dist(this, f) < 190) {
            dealDamage(this, f, 32, 40);
            f.vx        = this.facing * 22;
            f.stunTimer = Math.max(f.stunTimer || 0, 14);
          }
        }
        spawnParticles(this.cx(), this.cy(), '#88aaff', 30);
        spawnRing(this.cx(), this.cy());
      },
      // ── Scythe: Soul Reap — huge AoE spin, heals 12 HP per target hit ───────
      scythe: () => {
        this.spinning = 90;
        screenShake   = Math.max(screenShake, 22);
        let healed    = 0;
        const _scAll  = [...players, ...trainingDummies];
        for (const f of _scAll) {
          if (f === this || f.health <= 0) continue;
          if (dist(this, f) < 210) { dealDamage(this, f, 32, 16); healed++; }
        }
        if (healed > 0) {
          this.health = Math.min(this.maxHealth, this.health + healed * 12);
          spawnParticles(this.cx(), this.cy(), '#cc44cc', 28);
          spawnRing(this.cx(), this.cy());
        }
      },
      // ── Frying Pan: Grand Slam — 62 dmg + 1.5 s stun ────────────────────────
      fryingpan: () => {
        if (_superTarget && dist(this, _superTarget) < 140) {
          dealDamage(this, _superTarget, 40, 20);
          _superTarget.stunTimer = Math.max(_superTarget.stunTimer || 0, 28); // reduced from 90 — no more infinite stun chains
          spawnParticles(_superTarget.cx(), _superTarget.cy(), '#ffdd44', 24);
          spawnParticles(_superTarget.cx(), _superTarget.cy(), '#ffffff', 12);
          screenShake = Math.max(screenShake, 32);
          spawnRing(_superTarget.cx(), _superTarget.cy());
        }
      },
      // ── Broomstick: Storm Sweep — spin + extreme edge-push on all nearby ─────
      broomstick: () => {
        this.spinning = 90;
        screenShake   = Math.max(screenShake, 28);
        const _bAll   = [...players, ...trainingDummies];
        for (const f of _bAll) {
          if (f === this || f.health <= 0) continue;
          if (dist(this, f) < 250) {
            const dir = f.cx() > this.cx() ? 1 : -1;
            dealDamage(this, f, 38, 16);
            f.vx = dir * 36;
            spawnParticles(f.cx(), f.cy(), '#cc9966', 10);
          }
        }
        spawnRing(this.cx(), this.cy());
      },
      // ── Boxing Gloves: Knockout Flurry — 8-hit rapid combo ──────────────────
      boxinggloves: () => {
        let count = 0;
        const doHit = () => {
          if (!gameRunning || this.health <= 0) return;
          if (_superTarget && dist(this, _superTarget) < 110) {
            dealDamage(this, _superTarget, 16, 6);
            spawnParticles(_superTarget.cx(), _superTarget.cy(), '#ff4444', 5);
          }
          count++;
          if (count < 8) setTimeout(doHit, 70);
        };
        doHit();
      },
      // ── Pea Shooter: Pea Cannon — slow massive explosive pea ────────────────
      peashooter: () => {
        const _pProj = new Projectile(
          this.cx() + this.facing * 14, this.y + 22,
          this.facing * 7, -2,
          this, 55, '#00ff44'
        );
        _pProj.splashRange = 95;
        _pProj.dmg         = 55;
        projectiles.push(_pProj);
        spawnParticles(this.cx(), this.cy(), '#44ff44', 18);
        screenShake = Math.max(screenShake, 14);
      },
      // ── Slingshot: Megastone — giant aimed boulder with massive splash ────────
      slingshot: () => {
        const _sdx = _superTarget ? (_superTarget.cx() - this.cx()) : this.facing * 300;
        const _sdy = _superTarget ? (_superTarget.cy() - this.cy()) : 0;
        const _slen = Math.hypot(_sdx, _sdy) || 1;
        const _slProj = new Projectile(
          this.cx() + this.facing * 14, this.y + 22,
          (_sdx / _slen) * 13, (_sdy / _slen) * 13 - 2,
          this, 68, '#ff6600'
        );
        _slProj.splashRange = 100;
        _slProj.dmg         = 68;
        projectiles.push(_slProj);
        spawnParticles(this.cx(), this.cy(), '#ff9933', 20);
        screenShake = Math.max(screenShake, 18);
      },
      // ── Paper Airplane: Paper Flock — 12 planes radiate in all directions ────
      paperairplane: () => {
        for (let i = 0; i < 12; i++) {
          setTimeout(() => {
            if (!gameRunning || this.health <= 0) return;
            const angle = (i / 12) * Math.PI * 2;
            const spd   = 9 + Math.random() * 4;
            const dmg   = 18 + Math.floor(Math.random() * 8);
            projectiles.push(new Projectile(
              this.cx(), this.cy(),
              Math.cos(angle) * spd, Math.sin(angle) * spd,
              this, dmg, '#aaccff'
            ));
          }, i * 40);
        }
        spawnParticles(this.cx(), this.cy(), '#aaccff', 22);
        screenShake = Math.max(screenShake, 16);
      },
      gauntlet: () => {
        screenShake = Math.max(screenShake, 60);
        spawnRing(this.cx(), this.cy());
        spawnRing(this.cx(), this.cy());
        spawnRing(this.cx(), this.cy());
        for (const p of players) {
          if (p === this || p.health <= 0) continue;
          if (dist(this, p) < 280) dealDamage(this, p, 15, 50);
        }
        for (const d of trainingDummies) {
          if (d.health <= 0) continue;
          if (dist(this, d) < 280) dealDamage(this, d, 15, 50);
        }
        if (this.isBoss) this.postSpecialPause = 90; // 1.5s pause after super
      }
    };
    (superMoves[this.weaponKey] || superMoves.sword)();
  }

  // ---- AI ----

  // ---- UTILITY AI HELPERS ----

  /**
   * Walk N steps forward (world-space) and sample the heatmap + check for cliffs.
   * @param {number} dir      ±1 direction
   * @param {number} steps    how many probe steps
   * @param {number} stepDist world-units per step
   * @returns {{ heat: number, cliff: boolean }}
   */
  raycastForward(dir, steps = 7, stepDist = 13) {
    let maxHeat = 0;
    let cliffAhead = false;
    for (let i = 1; i <= steps; i++) {
      const wx = this.cx() + dir * i * stepDist;
      const wy = this.y + this.h * 0.5;
      const h  = heatAt(wx, wy);
      if (h > maxHeat) maxHeat = h;
      // Check ground under foot for the first 3 steps (cliff detection)
      if (i <= 3 && this.onGround) {
        const footX = wx;
        const footY = this.y + this.h + 10;
        let groundFound = false;
        for (const pl of currentArena.platforms) {
          if (pl.isFloorDisabled) continue;
          if (footX > pl.x && footX < pl.x + pl.w && footY >= pl.y && footY <= pl.y + 30) {
            groundFound = true; break;
          }
        }
        if (!groundFound) cliffAhead = true;
      }
    }
    return { heat: maxHeat, cliff: cliffAhead };
  }

  /**
   * Score each possible AI action [0–1+] based on current game state.
   * Higher score = more desirable action.
   * Difficulty weights bias the scores toward aggression or caution.
   */
  computeUtility(t) {
    const hpPct    = this.health / this.maxHealth;
    const selfHeat = heatAt(this.cx(), this.cy());
    const d        = t ? Math.abs(t.cx() - this.cx()) : Infinity;
    const dNorm    = Math.min(d / 500, 1);           // 0 = at target, 1 = far away
    const tHpPct   = t ? t.health / t.maxHealth : 1;


    // Difficulty: easy = cautious, expert = relentless
    const hazardW  = this.aiDiff === 'easy' ? 1.10 : this.aiDiff === 'medium' ? 0.80 : this.aiDiff === 'hard' ? 0.50 : 0.30;
    const _baseAggrW = this.aiDiff === 'easy' ? 0.90 : this.aiDiff === 'medium' ? 1.25 : this.aiDiff === 'hard' ? 1.65 : 2.20;
    // Aggression ramps over match time — +0..45% over 90 seconds of no kill
    const _matchSecs   = (typeof frameCount !== 'undefined' ? frameCount : 0) / 60;
    const _noKillYet   = !players.some(p => p !== this && p.health < (p.maxHealth || 100) * 0.5);
    const _timeRamp    = _noKillYet ? Math.min(0.45, _matchSecs / 90 * 0.45) : 0;
    const aggrW        = _baseAggrW + _timeRamp;

    const s = {};

    // Clamp heat so hazard avoidance never fully disables attacks
    const clampedHeat = Math.min(selfHeat, 0.40);

    // AVOID_HAZARD: only fires when genuinely standing in danger
    s.avoid_hazard = clampedHeat > 0.30 ? clampedHeat * hazardW * (1 + (1 - hpPct) * 0.3) : 0;

    // RECOVER: steer to platform when falling
    s.recover = (!this.onGround && this.vy > 1 && this.y > GAME_H * 0.50) ? 0.96 : 0;

    // RETREAT: only when critically low HP (< 20%) and healthy enemy very close
    s.retreat = (hpPct < 0.12 && d < 160)
      ? (1 - hpPct) * 0.28 * hazardW
      : 0;

    // ATTACK: wide detection, always wins over chase when in range + cooldown ready
    const attackRange = this.weapon.range * 1.1 + 30;
    const inRangeExt  = t ? d < attackRange : false;
    // Base attack score is very high when in range — always beats chase
    s.attack = inRangeExt
      ? (1.10 + (1 - dNorm) * 0.30 + (1 - tHpPct) * 0.20) * aggrW
      : 0;

    // USE_ABILITY: available + reasonable distance
    s.use_ability = (this.abilityCooldown <= 0 && d < 320)
      ? (0.80 + (1 - tHpPct) * 0.18) * aggrW
      : 0;

    // USE_SUPER: very high priority when ready
    s.use_super = (this.superReady && clampedHeat < 0.40) ? 1.10 * aggrW : 0;

    // CHASE: strong baseline — always positive so bot never idles
    s.chase = (0.55 + dNorm * 0.25) * aggrW;

    // Ranged target pressure: punish kiting / repeated gunplay by closing faster.
    if (t && t.weapon && t.weapon.type === 'ranged') {
      const _rangedRetreat = Math.sign(t.vx || 0) === Math.sign(t.cx() - this.cx()) && Math.abs(t.vx || 0) > 1.6;
      const _rangedSpam    = (t._recentRangedUse || 0) > 45;
      if (_rangedRetreat || _rangedSpam) {
        s.chase        = Math.min(1.45, s.chase + 0.28 * aggrW);
        s.attack       = Math.min(1.60, (s.attack || 0) + (d < attackRange * 1.35 ? 0.18 : 0));
        s.reposition   = Math.min(1.0, (s.reposition || 0) + 0.20);
        s.retreat      = Math.max(0, (s.retreat || 0) * 0.35);
      }
    }

    // FINISH_THEM: enemy near death — ignore hazards, close in relentlessly
    if (tHpPct < 0.25 && d < 420) {
      const _urgency    = (1 - tHpPct) * 1.8 * aggrW;
      s.attack          = Math.max(s.attack || 0,   _urgency);
      s.chase           = Math.max(s.chase  || 0,   _urgency * 0.8);
      s.retreat         = 0;
      s.avoid_hazard    = Math.max(0, (s.avoid_hazard || 0) - 0.5);
    }

    // ---- TACTICAL POSITIONING MODIFIERS ----
    const tacticW = this.aiDiff === 'expert' ? 1.4 : this.aiDiff === 'hard' ? 1.0 : this.aiDiff === 'medium' ? 0.55 : 0.18;
    if (tacticW > 0 && currentArena) {
      // Corner avoidance: boost reposition when bot is near edge
      const edgeDist = Math.min(this.cx(), GAME_W - this.cx()) / (GAME_W * 0.18);
      const heatBelow = heatAt(this.cx(), this.y + this.h + 20);
      const corner = Math.min(1, (1 - Math.min(edgeDist, 1)) * 0.6 + heatBelow * 0.4);
      if (corner > 0.45) {
        s.reposition = (s.reposition || 0) + corner * 0.55 * tacticW;
        s.chase = Math.max(0, s.chase - corner * 0.30 * tacticW);
      }
      // Hazard push: more aggressive when enemy is near hazard
      if (t) {
        const tEdgeDist = Math.min(t.cx(), GAME_W - t.cx()) / (GAME_W * 0.25);
        const tHazard   = heatAt(t.cx(), t.y + t.h + 10);
        const push = Math.max(0, Math.min(1, (1 - Math.min(tEdgeDist, 1)) * 0.5 + tHazard * 0.5));
        if (push > 0.3) {
          s.attack = Math.min(1.5, s.attack + push * 0.45 * tacticW);
          s.chase  = Math.min(1.2, s.chase  + push * 0.25 * tacticW);
        }
        // Distance control by weapon type
        const optRange = this.weapon?.type === 'ranged' ? 280 : (this.weapon?.range >= 90 ? 90 : 60);
        const rangeDiff = d - optRange;
        if (rangeDiff > 50 && this.weapon?.type !== 'ranged') {
          s.chase = Math.min(1.2, s.chase + 0.22 * tacticW);
        } else if (rangeDiff < -30 && this.weapon?.type === 'ranged') {
          s.reposition = Math.min(1, (s.reposition || 0) + 0.28 * tacticW);
        }
      }
      // Escape routes: reduce aggression when trapped
      let escapes = 0;
      for (const pl of currentArena.platforms) {
        if (pl.isFloorDisabled) continue;
        const pdx = Math.abs((pl.x + pl.w/2) - this.cx());
        const pdy = this.y - pl.y;
        if (pdx < 200 && pdy > -20 && pdy < 320 && heatAt(pl.x + pl.w/2, pl.y) < 0.5) escapes++;
      }
      if (escapes <= 1) {
        s.attack     = Math.max(0, s.attack - 0.22 * tacticW);
        s.reposition = Math.min(1, (s.reposition || 0) + 0.32 * tacticW);
      }
    }

    // ---- PERSONALITY MODIFIERS ----
    // Applied after all base scoring so they additively shift the action distribution.
    if (this.personality) {
      switch (this.personality) {
        case 'aggressive':
          // Relentlessly press attacks — ignore self-preservation when healthy
          s.attack       = Math.min(1.8, (s.attack || 0)       * 1.55);
          s.chase        = Math.min(1.5, (s.chase  || 0)       * 1.40);
          s.use_ability  = Math.min(1.6, (s.use_ability || 0)  * 1.35);
          s.retreat      = Math.max(0,   (s.retreat || 0)      * 0.30);
          s.avoid_hazard = Math.max(0,   (s.avoid_hazard || 0) * 0.55);
          break;

        case 'defensive':
          // Back off when hurt; fight mainly when enemy comes to them
          s.retreat      = Math.min(1.1, (s.retreat      || 0) * 1.15);
          s.avoid_hazard = Math.min(1.4, (s.avoid_hazard || 0) * 1.45);
          s.reposition   = Math.min(1.2, (s.reposition   || 0) + 0.18);
          s.attack       = Math.max(0,   (s.attack || 0)       * 0.65);
          s.chase        = Math.max(0,   (s.chase  || 0)       * 0.55);
          // Counter-punch: spike attack score when enemy swings at us
          if (t && t.attackTimer > 0 && Math.abs(t.cx() - this.cx()) < 120) {
            s.attack = Math.min(1.5, (s.attack || 0) + 0.55);
          }
          break;

        case 'trickster':
          // Chaotic — frequently uses abilities/supers, moves unpredictably
          s.use_ability = Math.min(1.8, (s.use_ability || 0) * 1.70);
          s.use_super   = Math.min(1.6, (s.use_super   || 0) * 1.45);
          s.chase       = Math.min(1.3, (s.chase       || 0) * 1.20);
          // Random noise: shifts scoring each frame for erratic feel
          s.attack      = Math.max(0, (s.attack || 0) + (Math.random() - 0.5) * 0.35);
          s.retreat     = Math.max(0, (s.retreat || 0) + (Math.random() - 0.5) * 0.25);
          break;

        case 'sniper':
          // Stays at range; high attack priority only with ranged weapon
          if (this.weapon?.type === 'ranged') {
            s.attack      = Math.min(1.8, (s.attack || 0) * 1.80);
            s.use_ability = Math.min(1.6, (s.use_ability || 0) * 1.50);
            // Prefer keeping distance — boost reposition when enemy gets close
            if (d < 200) {
              s.retreat    = Math.min(0.95, (s.retreat    || 0) + 0.20);
              s.reposition = Math.min(1.2, (s.reposition || 0) + 0.35);
              s.attack     = Math.max(0,   (s.attack     || 0) * 0.60);
            }
          } else {
            // Melee sniper: still tries to keep optimal range, attacks only when lined up
            s.chase       = Math.max(0,   (s.chase  || 0) * 0.70);
            s.reposition  = Math.min(1.2, (s.reposition || 0) + 0.22);
          }
          break;
      }
    }

    return s;
  }

  /**
   * Execute the highest-scoring utility action.
   * Handles movement, combat, dodging, and reaction lag.
   * Called from updateAI() after special-case overrides.
   */
  // ---- PER-FRAME VOID/LAVA SAFETY ----
  // Runs every physics frame for AI bots on lethal-fall arenas (hasLava, isVoidArena,
  // boss void floor). Detects "no platform below us" and immediately uses double jump +
  // steers toward the nearest platform — bypassing the AI tick reaction delay.
  _voidSafetyFrame() {
    if (!this.isAI || this.isBoss || this.health <= 0 || !currentArena) return;

    const lethalFall = currentArena.hasLava || currentArena.isVoidArena ||
      (bossFloorState === 'hazard' && bossFloorType === 'void');
    if (!lethalFall) return;

    // Only act when airborne and falling
    if (this.onGround || this.vy <= 0.5) return;

    // Check if a platform will catch us within safe distance below
    const footY = this.y + this.h;
    let hasPlatBelow = false;
    for (const pl of currentArena.platforms) {
      if (pl.isFloorDisabled) continue;
      if (this.cx() > pl.x - 35 && this.cx() < pl.x + pl.w + 35 &&
          pl.y >= footY && pl.y <= footY + 260) {
        hasPlatBelow = true;
        break;
      }
    }

    if (!hasPlatBelow) {
      const spd = this.aiDiff === 'easy' ? 3.4 : this.aiDiff === 'medium' ? 4.4 : this.aiDiff === 'hard' ? 5.0 : 5.6;

      // Steer toward the nearest platform immediately
      let nearX = GAME_W / 2, nearDist = Infinity;
      for (const pl of currentArena.platforms) {
        if (pl.isFloorDisabled) continue;
        const pd = Math.abs((pl.x + pl.w / 2) - this.cx());
        if (pd < nearDist) { nearDist = pd; nearX = pl.x + pl.w / 2; }
      }
      this.vx = nearX > this.cx() ? spd * 2.4 : -spd * 2.4;

      // Fire double jump immediately — don't wait for AI tick
      if (this.canDoubleJump) {
        this.vy = -16;
        this.canDoubleJump = false;
      }
    }
  }

  executeUtilityAI(t) {
    // Ensure heatmap is current (no-op if already done this frame)
    updateHeatmap();

    const scores = this.computeUtility(t);

    // Fix 1: fallback — if every score is zero or below, default to 'chase' so bot never idles
    const maxScore = Math.max(...Object.values(scores));
    const best = maxScore <= 0
      ? 'chase'
      : Object.keys(scores).reduce((a, b) => scores[a] >= scores[b] ? a : b);

    // Reaction delay (in AI ticks). Kept short so bots feel responsive.
    const reactFrames  = this.aiDiff === 'easy' ? 3 : this.aiDiff === 'medium' ? 2 : 1;
    const lockFrames   = this.aiDiff === 'easy' ? 3 : this.aiDiff === 'medium' ? 2 : 1;

    if (this._stateChangeCd > 0) this._stateChangeCd--;
    if (this._actionLockFrames > 0) this._actionLockFrames--;

    // Tick pending action countdown; commit when it expires
    if (this._pendingAction) {
      this._pendingAction.timer--;
      if (this._pendingAction.timer <= 0) {
        this.aiState = this._pendingAction.action;
        this._pendingAction = null;
        this._stateChangeCd = 18;
        this._actionLockFrames = lockFrames;
      }
    } else if (best !== this.aiState && this._stateChangeCd === 0 && this._actionLockFrames === 0) {
      // Queue the new decision — bot will execute it after reaction delay
      this._pendingAction = { action: best, timer: reactFrames };
    }

    // Fix 6: debug state display — show current AI state as a small label above bot
    if (this.isAI && !this.isBoss && settings.dmgNumbers) {
      this._debugState = best; // drawn by Fighter.draw() if present
    }

    const dx         = t ? t.cx() - this.cx() : 0;
    const dir        = dx > 0 ? 1 : -1;
    const d          = Math.abs(dx);
    const _worldAggro = Math.max(0.25, this._aggroBoost || 1);
    let   spd        = (this.aiDiff === 'easy' ? 3.0 : this.aiDiff === 'medium' ? 4.4 : this.aiDiff === 'hard' ? 5.2 : 5.8) * _worldAggro;
    // atkFreq is per-AI-tick probability. Previously 0.04/0.16/0.28 = attacks every 6s/1.6s/0.9s.
    // New values guarantee attacks within 1–3 ticks of entering range.
    let   atkFreq    = Math.min(1, (this.aiDiff === 'easy' ? 0.55 : this.aiDiff === 'medium' ? 0.75 : this.aiDiff === 'hard' ? 0.90 : 1.00) * _worldAggro);
    let   abiFreq    = Math.min(1, (this.aiDiff === 'easy' ? 0.10 : this.aiDiff === 'medium' ? 0.20 : this.aiDiff === 'hard' ? 0.32 : 0.50) * _worldAggro);
    let   missChance = Math.max(0, (this.aiDiff === 'easy' ? 0.18 : this.aiDiff === 'medium' ? 0.08 : this.aiDiff === 'hard' ? 0.03 : 0.00) / _worldAggro);
    // Personality execution tweaks
    if (this.personality === 'aggressive') { spd *= 1.20; atkFreq *= 1.45; missChance *= 0.60; }
    if (this.personality === 'defensive')  { spd *= 0.85; atkFreq *= 0.65; }
    if (this.personality === 'trickster')  { abiFreq *= 2.0; missChance *= 0.50; }
    if (this.personality === 'sniper' && this.weapon?.type === 'ranged') { spd *= 1.10; atkFreq *= 1.55; }

    // Raycast: check heat and cliff directly ahead
    const fwd      = this.raycastForward(dir);
    const pathSafe = fwd.heat < 0.55 && !fwd.cliff;

    // Screen-edge guard (50px — reduced from 120px to avoid huge dead zones)
    const nearLeftEdge  = this.x < 50 && !this.isBoss;
    const nearRightEdge = this.x + this.w > GAME_W - 50 && !this.isBoss;
    const towardEdge    = (nearLeftEdge && dir < 0) || (nearRightEdge && dir > 0);

    switch (best) {

      // ---- AVOID_HAZARD: flee the most dangerous nearby direction ----
      case 'avoid_hazard': {
        const selfHeat = heatAt(this.cx(), this.cy());
        // Compare danger 60px left vs right; flee toward the safer side
        const heatL  = heatAt(this.cx() - 60, this.cy());
        const heatR  = heatAt(this.cx() + 60, this.cy());
        const fleeDir = heatL < heatR ? -1 : 1;
        if (!this.isEdgeDanger(fleeDir)) {
          this.vx = fleeDir * spd * 1.6;
        } else {
          this.vx = 0; // can't run — jump up instead
        }
        // Jump if heat is high enough — only if not at an edge
        const fleeAhead = heatL < heatR ? -1 : 1;
        if (selfHeat > 0.65 && this.onGround && !this.isEdgeDanger(fleeAhead)) {
          this.vy = -20;
        } else if (selfHeat > 0.50 && this.canDoubleJump && this.vy > 0) {
          this.vy = -16; this.canDoubleJump = false;
        }
        break;
      }

      // ---- RETREAT: back away; weak counter-attack when cornered ----
      case 'retreat': {
        const retDir  = -dir;
        const retEdge = this.isEdgeDanger(retDir);
        if (!retEdge && !towardEdge) {
          this.vx = retDir * spd * 0.55;
        } else {
          // Cornered — fight back rather than stepping off edge
          if (this.cooldown <= 0 && Math.random() < atkFreq) this.attack(t);
          this.vx = 0;
        }
        if (this.onGround && !retEdge && Math.random() < 0.04) this.vy = -16;
        // Chip damage while retreating (reduced freq)
        if (d < this.weapon.range + 10 && this.cooldown === 0 && Math.random() < atkFreq * 0.45)
          this.attack(t);
        break;
      }

      // ---- RECOVER: steer toward nearest platform when falling ----
      case 'recover': {
        let nearX = GAME_W / 2, nearDist = Infinity;
        for (const pl of currentArena.platforms) {
          if (pl.isFloorDisabled) continue;
          const pdx = Math.abs(pl.x + pl.w / 2 - this.cx());
          if (pdx < nearDist) { nearDist = pdx; nearX = pl.x + pl.w / 2; }
        }
        this.vx = nearX > this.cx() ? spd * 1.8 : -spd * 1.8;
        // Use double jump to reach safety if still falling
        if (this.canDoubleJump && this.vy > 1) { this.vy = -15; this.canDoubleJump = false; }
        break;
      }

      // ---- USE_SUPER: unleash super move ----
      case 'use_super':
        this.useSuper(t);
        break;

      // ---- USE_ABILITY: activate weapon ability; close range if needed ----
      case 'use_ability':
        this.ability(t);
        if (d > this.weapon.range + 5 && pathSafe && !towardEdge)
          this.vx = dir * spd;
        break;

      // ---- ATTACK: press the target, always fire when cooldown ready ----
      case 'attack':
        if (this.weapon && this.weapon.type === 'ranged') {
          // Ranged attack case is handled above in the ranged AI block;
          // utility AI reaching here means keep optimal distance, already handled.
          this.facing = dir;
          if (this.cooldown <= 0 && Math.random() < atkFreq) this.attack(t);
        } else {
          // Melee: slide in slightly so hits land — don't just stand still
          if (d > this.weapon.range * 0.6 && !towardEdge) {
            this.vx = dir * spd * 0.85;
          } else {
            this.vx *= 0.80;
          }
          // Miss chance simulates human imperfection on easy
          if (Math.random() < missChance) this.facing = -this.facing;
          if (this.cooldown <= 0) {
            if (Math.random() < atkFreq) this.attack(t);
          }
        }
        if (this.abilityCooldown <= 0 && Math.random() < abiFreq) this.ability(t);
        if (this.superReady && Math.random() < 0.25) this.useSuper(t);
        // Hop to reach target on a higher platform
        if (this.onGround && t && t.y + t.h < this.y - 30 && !fwd.cliff && !nearLeftEdge && !nearRightEdge && Math.random() < 0.05)
          this.vy = -16;
        break;

      // ---- REPOSITION: move toward map center to avoid corner traps ----
      case 'reposition': {
        const toCenter = GAME_W / 2 - this.cx();
        if (Math.abs(toCenter) > 30) {
          const rDir = Math.sign(toCenter);
          if (!this.isEdgeDanger(rDir)) this.vx = rDir * spd;
        }
        if (this.onGround && Math.abs(toCenter) > 80 && Math.random() < 0.03) this.vy = -16;
        // Still attack if target walks into range while repositioning
        if (t && Math.abs(t.cx() - this.cx()) < this.weapon.range + 15 && this.cooldown === 0 && Math.random() < atkFreq * 0.6)
          this.attack(t);
        break;
      }

      // ---- CHASE: close the distance using platform pathfinding ----
      case 'chase':
      default: {
        // ── 0. Airborne arc correction (highest priority) ──────────
        // pfAirborneCorrect predicts landing via full arc simulation.
        // Only fires when falling (vy > 0); upward arcs are intentional.
        if (!this.onGround && !this.isBoss &&
            typeof pfAirborneCorrect === 'function' && pfAirborneCorrect(this, spd)) {
          // Correction applied — skip all other movement this tick
          break;
        }

        // ── 1. Stuck detection & kick ──────────────────────────────
        if (typeof pfCheckStuck === 'function' && !this.isBoss && pfCheckStuck(this)) {
          forceRecalculatePath(this);
          const kickDir = this.isEdgeDanger(dir) ? -dir : dir;
          if (this.onGround && !this.isEdgeDanger(kickDir)) this.vy = -18;
          this.vx = kickDir * spd * 1.4;
          break;
        }

        // ── 2. Pathfinding waypoint ────────────────────────────────
        const wp = (typeof pfGetNextWaypoint === 'function' && !this.isBoss)
          ? pfGetNextWaypoint(this, t.cx(), t.y + t.h * 0.5)
          : null;

        if (wp) {
          const wpDir = wp.x > this.cx() ? 1 : -1;

          // ── jump: single jump verified by arc simulation ──────────
          if (wp.action === 'jump') {
            this.vx = wpDir * spd * 1.05;
            if (this.onGround) {
              this.vy = -20;
            }
            // If airborne and predicted landing is bad, pfAirborneCorrect handles it above

          // ── doubleJump: fire ground jump, then double near apex ───
          } else if (wp.action === 'doubleJump') {
            this.vx = wpDir * spd * 1.1;
            if (this.onGround) {
              this.vy = -20;
              this._pfDoubleJumpPending = true;
            } else if (this._pfDoubleJumpPending && this.canDoubleJump && this.vy >= -2) {
              // Near apex of first jump — fire double jump proactively
              this.vy = -17; this.canDoubleJump = false;
              this._pfDoubleJumpPending = false;
            }

          // ── drop: verify at runtime then walk off ─────────────────
          } else if (wp.action === 'drop') {
            const dropSafe = typeof pfDropSafe === 'function'
              ? pfDropSafe(this, wpDir) : !currentArena.hasLava;
            if (dropSafe) {
              this.vx = wpDir * spd;
            } else {
              // Destination is no longer safe — reroute
              if (typeof _pfLogUnsafe === 'function') _pfLogUnsafe(this, 'drop', 'runtime-unsafe');
              forceRecalculatePath(this);
              this.vx = 0;
            }

          // ── walk: edge-aware aggressive positioning ───────────────
          } else {
            const voidFwd  = typeof pfVoidAhead === 'function' && pfVoidAhead(this, wpDir);
            const voidBack = typeof pfVoidAhead === 'function' && pfVoidAhead(this, -wpDir);

            if (voidFwd && !voidBack) {
              // Void ahead, safe behind:
              // If player is toward the void, maintain light pressure (keep player on the edge).
              // If player is away, hold position.
              this.vx = (dir === wpDir) ? wpDir * spd * 0.38 : 0;
            } else if (voidFwd && voidBack) {
              // Void both ways (narrow platform) — hold center, don't move
              this.vx = 0;
            } else {
              this.vx = wpDir * (pathSafe ? spd * 1.12 : spd * 0.88);
            }

            // Hop to clear terrain or reach airborne targets
            if (this.onGround && t && t.y + t.h < this.y - 50 && !voidFwd && !nearLeftEdge && !nearRightEdge && Math.random() < 0.08)
              this.vy = -18;
          }

        } else {
          // ── 3. Heuristic fallback (no graph / no path found) ──────
          const voidFwd = !storyModeActive && typeof pfVoidAhead === 'function' && pfVoidAhead(this, dir);
          if (towardEdge || voidFwd) {
            this.vx = 0;
            if (this.onGround && this.platformAbove() && Math.random() < 0.08) this.vy = -18;
          } else if (fwd.cliff && currentArena.hasLava) {
            this.vx = 0;
            if (this.onGround && Math.random() < 0.15) this.vy = -18;
          } else {
            this.vx = dir * (pathSafe ? spd * 1.10 : spd * 0.86);
          }
          if (this.onGround && t && t.y + t.h < this.y - 50 && !fwd.cliff && !voidFwd &&
              Math.random() < 0.06 && (!currentArena.hasLava || this.platformAbove()))
            this.vy = -18;
          if (this.onGround && t && !t.onGround && !voidFwd && Math.random() < 0.06 && !fwd.cliff && !this.isEdgeDanger(dir))
            this.vy = -18;
          if (t && this.onGround && !voidFwd) {
            const _vGap  = this.cy() - t.cy();
            const _lDist = Math.abs(t.cx() - this.cx());
            if (_vGap > 80 && _lDist < 280) {
              const _jProb = this.aiDiff === 'easy' ? 0.04 : this.aiDiff === 'medium' ? 0.10 :
                             this.aiDiff === 'hard' ? 0.20 : 0.30;
              if (Math.random() < _jProb) { this.vy = -17; this.vx = dir * spd * 1.1; }
            }
          }
        }

        // Trickster: erratic jumps/fakes, but never toward a void
        if (this.personality === 'trickster' && this.onGround) {
          const noVoid = !this.isEdgeDanger(dir);
          if (noVoid && Math.random() < 0.025) { this.vy = -18; }
          if (noVoid && Math.random() < 0.012) { this.vx = -this.vx; this.facing *= -1; }
        }
        break;
      }
    }

    // Input buffer: queue an attack when opponent steps into range (executes on drain, not immediately)
    if (t && t.health > 0 && this.aiState !== 'retreat' && this.aiState !== 'recover') {
      const bufferRange = this.weapon.range * 0.9 + 20;
      if (d < bufferRange && this.inputBuffer.length === 0) {
        this.inputBuffer.push('attack');
      }
    }
    // Drain input buffer — process one queued input per frame when ready
    if (this.inputBuffer.length > 0 && this._actionLockFrames === 0 && !this._pendingAction) {
      const qi = this.inputBuffer.shift();
      if      (qi === 'attack'  && this.cooldown <= 0 && t && t.health > 0) this.attack(t);
      else if (qi === 'jump'    && this.onGround) this.vy = -18;
      else if (qi === 'ability' && this.abilityCooldown <= 0) this.ability(t);
    }
    // Cap buffer to prevent stale queues
    if (this.inputBuffer.length > 3) this.inputBuffer.length = 3;

    // --- Shield reaction (medium+): block incoming melee swing ---
    if (t && this.aiDiff !== 'easy' && t.attackTimer > 0 && d < 110 &&
        this.shieldCooldown === 0 && Math.random() < 0.22) {
      this.shielding = true;
      this.shieldCooldown = SHIELD_CD;
      setTimeout(() => { this.shielding = false; }, 320);
    }

    // --- Dodge projectiles (medium+) ---
    if (this.aiDiff !== 'easy') {
      for (const pr of projectiles) {
        if (pr.owner === this) continue;
        const pd = Math.hypot(pr.x - this.cx(), pr.y - this.cy());
        if (pd < 130 && !this.isEdgeDanger(pr.vx > 0 ? -1 : 1) && Math.random() < 0.30) {
          if (this.onGround) this.vy = -17;
          else if (this.canDoubleJump) { this.vy = -13; this.canDoubleJump = false; }
        }
      }
    }

    // Reaction lag now handled by _pendingAction system (see above).
    // Rare stun pause for easy bots only (simulates brief confusion)
    if (this.aiDiff === 'easy' && Math.random() < 0.04) this.aiReact = 3 + Math.floor(Math.random() * 4);
  }

  // Returns true if moving in 'dir' (±1) would walk the AI off a platform
  // with no safe ground beneath within the next 40px.
  isEdgeDanger(dir) {
    // Story mode: portals handle out-of-bounds; never block movement
    if (storyModeActive) return false;
    if (currentArena && currentArena.earthPhysics) return false;

    // ── Grounded check: look ahead at foot level ──────────────
    if (this.onGround) {
      const lookX = dir > 0 ? this.x + this.w + 44 : this.x - 44;
      const footY = this.y + this.h;
      for (const pl of currentArena.platforms) {
        if (pl.isFloorDisabled) continue;
        if (lookX > pl.x && lookX < pl.x + pl.w &&
            footY <= pl.y + 22 && footY >= pl.y - 8) return false;
      }
      if (currentArena.hasLava) return true;
      // Boss arena void floor: floor is disabled — treat as instant death zone
      if (currentArena.isBossArena && bossFloorState === 'hazard' && bossFloorType === 'void') return true;
      return this.y + this.h < GAME_H + 40;
    }

    // ── Airborne check: would continuing in 'dir' lead to a void? ──
    if (!this.isBoss && typeof pfVoidAhead === 'function') {
      return pfVoidAhead(this, dir);
    }
    return false;
  }

  // Finds any reachable platform above (for jumping pathing).
  platformAbove() {
    for (const pl of currentArena.platforms) {
      if (pl.y < this.y - 20 &&
          pl.x < this.cx() + 130 && pl.x + pl.w > this.cx() - 130) return pl;
    }
    return null;
  }

  // ---- INTENT UPDATE: choose a high-level behavioral goal every ~0.6-1.2s ----
  _updateIntent(t, d) {
    if (this._intentTimer > 0) { this._intentTimer--; return; }
    this._intentTimer = 35 + Math.floor(Math.random() * 35); // 35-70 AI ticks

    const hpPct  = this.health / this.maxHealth;
    const tHpPct = t ? (t.health / t.maxHealth) : 1;

    if (hpPct < 0.14 && d > 220) {
      this.intent = 'retreat';
    } else if (hpPct < 0.35 && tHpPct > 0.75 && d < 260) {
      this.intent = Math.random() < 0.45 ? 'bait' : 'reposition';
    } else if (d > 360) {
      this.intent = 'pressure'; // always close the gap when far
    } else {
      const r = Math.random();
      this.intent = r < 0.60 ? 'pressure' : r < 0.80 ? 'reposition' : 'bait';
    }
  }

  updateAI() {
    if (this.aiReact > 0) { this.aiReact--; return; }
    if (this.ragdollTimer > 0 || this.stunTimer > 0) return;

    // ---- TARGET VALIDATION: reassign if current target is dead/invalid ----
    if (this._isInvalidAITarget(this.target)) this._acquireAITarget();

    // ---- DYNAMIC RETARGETING: re-evaluate closest enemy every 25 ticks ----
    // Prevents bots from tunnel-visioning a far target while a closer one is adjacent.
    this._targetRetargetCd = (this._targetRetargetCd || 0) - 1;
    if (this._targetRetargetCd <= 0) {
      this._acquireAITarget();
      this._targetRetargetCd = 25;
    }

    // ---- DANGER AVOIDANCE: boss beams ----
    if (bossBeams && bossBeams.length > 0 && !this.isBoss) {
      for (const beam of bossBeams) {
        if (beam.done) continue;
        const beamDx = Math.abs(beam.x - this.cx());
        if (beamDx < 50) {
          // Move away from beam
          const fleeDir = this.cx() < beam.x ? -1 : 1;
          if (!this.isEdgeDanger(fleeDir)) {
            const spd0 = this.aiDiff === 'easy' ? 2.6 : this.aiDiff === 'medium' ? 4.2 : 5.8;
            this.vx = fleeDir * spd0 * 2;
          }
          if (this.onGround) this.vy = -18;
          return; // beam avoidance takes priority
        }
      }
    }

    // ---- DANGER AVOIDANCE: floor hazard ----
    if (!this.isBoss && bossFloorState === 'hazard' && this.y + this.h > 430) {
      // Floor is lethal — jump or move to a platform
      if (this.onGround) {
        const above = this.platformAbove();
        if (above) {
          const toPlat = above.x + above.w/2 - this.cx();
          const spd0 = this.aiDiff === 'easy' ? 2.6 : this.aiDiff === 'medium' ? 4.2 : 5.8;
          this.vx = Math.sign(toPlat) * spd0 * 1.5;
          this.vy = -19;
          return;
        }
        this.vy = -19;
        return;
      }
    }

    // ---- DANGER AVOIDANCE: lava proximity ----
    if (!this.isBoss && currentArena && currentArena.hasLava && currentArena.lavaY) {
      const distToLava = currentArena.lavaY - (this.y + this.h);
      if (distToLava < 80 && this.y + this.h > 380) {
        if (this.onGround) {
          const spd0 = this.aiDiff === 'easy' ? 2.6 : this.aiDiff === 'medium' ? 4.2 : 5.8;
          this.vx = this.cx() < GAME_W/2 ? spd0 * 2 : -spd0 * 2;
          this.vy = -19;
          return;
        }
      }
    }

    // ---- DEADLOCK DETECTION: two bots mirroring each other ----
    if (!this.isBoss && this.target && this.target.isAI) {
      this._stuckFrames  = (this._stuckFrames  || 0);
      this._lastXForStuck = (this._lastXForStuck !== undefined ? this._lastXForStuck : this.x);
      if (Math.abs(this.x - this._lastXForStuck) < 5) {
        this._stuckFrames++;
        if (this._stuckFrames > 180) { // 3 seconds at AI tick rate
          this._stuckFrames = 0;
          this._wanderDir   = (Math.random() < 0.5 ? -1 : 1);
          this._wanderTimer = 40;
          if (this.onGround) this.vy = -18;
        }
      } else {
        this._stuckFrames = 0;
      }
      this._lastXForStuck = this.x;
    }

    // Combo follow-through: maintain forward pressure after landing a hit
    if (this._comboPressTimer > 0) {
      this._comboPressTimer--;
      if (this.target) {
        const _cDir = this.target.cx() > this.cx() ? 1 : -1;
        const _cSpd = this.aiDiff === 'expert' ? 5.8 : 5.2;
        this.vx = _cDir * _cSpd;
      }
    }

    // ---- RANDOM NUDGE: prevents long idle stretches ----
    if (!this.isBoss && frameCount % 45 === 0 && Math.abs(this.vx) < 0.5 && this.target) {
      const spd0 = this.aiDiff === 'easy' ? 2.6 : this.aiDiff === 'medium' ? 4.2 : 5.8;
      this._wanderDir   = (Math.random() < 0.5 ? -1 : 1);
      this._wanderTimer = 20;
      this.vx           = this._wanderDir * spd0;
    }

    // ---- STUCK DETECTION: if attacking with no hits for 1s, wander away ----
    if (this.isAI && this.state === 'attacking') {
      if (this.weaponHit) {
        this.aiNoHitTimer = 0;
        // Press forward after landing a hit (combo follow-through for hard/expert)
        if (!this._comboPressTimer && (this.aiDiff === 'hard' || this.aiDiff === 'expert')) {
          this._comboPressTimer = 16;
        }
      } else {
        this.aiNoHitTimer++;
        if (this.aiNoHitTimer > 60) {
          this.aiNoHitTimer = 0;
          this.aiState = 'chase';
          this._wanderDir = (Math.random() < 0.5 ? -1 : 1);
          this._wanderTimer = 45;
        }
      }
    } else {
      this.aiNoHitTimer = 0;
    }
    // ---- WANDER STATE: move in random direction briefly ----
    if (this._wanderTimer > 0) {
      this._wanderTimer--;
      const spd0 = this.aiDiff === 'easy' ? 3.0 : this.aiDiff === 'medium' ? 4.4 : 5.2;
      if (!this.isEdgeDanger(this._wanderDir)) {
        this.vx = this._wanderDir * spd0 * 1.2;
      } else {
        this._wanderDir = -this._wanderDir;
      }
      if (this.onGround && Math.random() < 0.04) this.vy = -18;
      // Still attack if target walks into range during wander
      const _wt = this.target;
      if (_wt && _wt.health > 0 && this.cooldown <= 0) {
        const _wd = Math.abs(_wt.cx() - this.cx());
        if (_wd < this.weapon.range * 1.1 + 20) this.attack(_wt);
      }
      return;
    }

    // ---- KOTH: bots rush the zone; only fight if an enemy is also in the zone ----
    if (gameMode === 'minigames' && minigameType === 'koth' && !this.isBoss) {
      const kothSpd     = this.aiDiff === 'easy' ? 3.8 : this.aiDiff === 'medium' ? 4.8 : 5.8;
      const kothAtkFreq = this.aiDiff === 'easy' ? 0.04 : this.aiDiff === 'medium' ? 0.16 : 0.28;
      const kothAbiFreq = this.aiDiff === 'easy' ? 0.004 : this.aiDiff === 'medium' ? 0.022 : 0.04;
      const zoneLeft  = kothZoneX - 100;
      const zoneRight = kothZoneX + 100;
      const selfInZone = this.cx() > zoneLeft && this.cx() < zoneRight && this.onGround;
      const enemyInZone = players.some(p => p !== this && !p.isBoss && p.health > 0 &&
                                            p.cx() > zoneLeft && p.cx() < zoneRight && p.onGround);
      if (!selfInZone) {
        // Use pathfinding to reach the zone center
        const kothWp = (typeof pfGetNextWaypoint === 'function')
          ? pfGetNextWaypoint(this, kothZoneX, GAME_H - 80)
          : null;
        if (kothWp) {
          const kdir2 = kothWp.x > this.cx() ? 1 : -1;
          this.vx = kdir2 * kothSpd * 1.1;
          if (kothWp.action === 'jump' && this.onGround) { this.vy = -19; }
          else if (kothWp.action === 'jump' && this.canDoubleJump && this.vy > 0) { this.vy = -16; this.canDoubleJump = false; }
        } else {
          const kdir = kothZoneX > this.cx() ? 1 : -1;
          this.vx = kdir * kothSpd * 1.1;
          if (this.onGround && !this.isEdgeDanger(kdir) && Math.random() < 0.05) this.vy = -18;
          else if (this.canDoubleJump && this.vy > 1 && Math.random() < 0.08) { this.vy = -14; this.canDoubleJump = false; }
        }
        return; // never leave zone logic — skip all other AI this frame
      }
      // Inside zone: attack any enemy also in zone, otherwise hold ground
      if (enemyInZone && this.target && this.target.cx() > zoneLeft && this.target.cx() < zoneRight) {
        const zd = Math.abs(this.target.cx() - this.cx());
        if (zd < this.weapon.range + 20) {
          this.vx *= 0.72;
          if (Math.random() < kothAtkFreq) this.attack(this.target);
          if (Math.random() < kothAbiFreq) this.ability(this.target);
          if (this.superReady && Math.random() < 0.12) this.useSuper(this.target);
        } else {
          this.vx = (this.target.cx() > this.cx() ? 1 : -1) * kothSpd;
        }
      } else {
        // No enemy in zone — hold center, small idle drift
        const centerDiff = kothZoneX - this.cx();
        this.vx = Math.abs(centerDiff) > 20 ? Math.sign(centerDiff) * kothSpd * 0.5 : 0;
      }
      return; // KotH bots never leave the zone
    }

    // ---- Exploration guard: defend the relic position ----
    if (this.isExploreGuard && typeof exploreGoalX !== 'undefined') {
      const guardX  = this._guardX || exploreGoalX;
      const guardSpd = (this.aiDiff === 'expert' ? 6.5 : this.aiDiff === 'hard' ? 5.5 : 4.5) * _worldAggro;
      const atkFreq  = Math.min(1, (this.aiDiff === 'expert' ? 0.35 : this.aiDiff === 'hard' ? 0.25 : 0.16) * _worldAggro);
      const t2 = this.target || players.find(p => !p.isBoss && p.health > 0);
      const playerNear = t2 && Math.abs(t2.cx() - guardX) < 300; // player within guard radius
      const selfNearPost = Math.abs(this.cx() - guardX) < 120;

      if (playerNear && t2) {
        // Player is near the relic — intercept and attack aggressively
        const dd2 = Math.abs(t2.cx() - this.cx());
        if (dd2 < this.weapon.range + 30) {
          this.vx *= 0.7;
          if (Math.random() < atkFreq)      this.attack(t2);
          if (Math.random() < atkFreq * 0.4) this.ability(t2);
          if (this.superReady && Math.random() < 0.18) this.useSuper(t2);
          // Shove the player away from the relic with extra knockback intent
          if (dd2 < 40 && Math.random() < 0.12) {
            const pushDir = t2.cx() > guardX ? 1 : -1; // push away from relic
            t2.vx += pushDir * 8;
          }
        } else {
          this.vx = (t2.cx() > this.cx() ? 1 : -1) * guardSpd * 1.2;
          if (this.onGround && Math.random() < 0.06) this.vy = -18;
        }
      } else if (!selfNearPost) {
        // Return to post — use pathfinding
        const guardWp = (typeof pfGetNextWaypoint === 'function')
          ? pfGetNextWaypoint(this, guardX, GAME_H - 80)
          : null;
        if (guardWp) {
          const dir2 = guardWp.x > this.cx() ? 1 : -1;
          this.vx = dir2 * guardSpd * 0.85;
          if (guardWp.action === 'jump' && this.onGround) this.vy = -18;
          else if (guardWp.action === 'jump' && this.canDoubleJump && this.vy > 0) { this.vy = -15; this.canDoubleJump = false; }
        } else {
          const dir2 = guardX > this.cx() ? 1 : -1;
          this.vx = dir2 * guardSpd * 0.8;
          if (this.onGround && Math.random() < 0.04) this.vy = -16;
        }
      } else {
        // Idle at post — small patrol drift
        const centerDiff = guardX - this.cx();
        this.vx = Math.abs(centerDiff) > 30 ? Math.sign(centerDiff) * guardSpd * 0.3 : 0;
      }
      return;
    }

    // Chaos mode: all entities attack nearest other entity
    if (trainingChaosMode && trainingMode) {
      const allEntities = [...players, ...trainingDummies, ...minions];
      let nearDist = Infinity, nearEnt = null;
      for (const e of allEntities) {
        if (e === this || e.health <= 0) continue;
        const dd = dist(this, e);
        if (dd < nearDist) { nearDist = dd; nearEnt = e; }
      }
      if (nearEnt) this.target = nearEnt;
    }

    const t  = this.target;
    if (!t) return;
    const dx = t.cx() - this.cx();
    const d  = Math.abs(dx);
    const dir = dx > 0 ? 1 : -1;

    const _worldAggro = Math.max(0.25, this._aggroBoost || 1);
    const spd = (this.aiDiff === 'easy' ? 3.4 : this.aiDiff === 'medium' ? 4.4 : this.aiDiff === 'hard' ? 5.0 : 5.6) * _worldAggro;

    // ---- NO-IDLE: intent update + player idle detection ----
    if (!this.isBoss) {
      this._updateIntent(t, d);
      const _tMoving = Math.abs(t.vx) > 0.5 || !t.onGround || t.state === 'attacking';
      this._playerIdleTmr = _tMoving ? 0 : this._playerIdleTmr + 1;
    }

    // ---- RUINS: prioritize artifacts unless player is very close ----
    if (currentArenaKey === 'ruins' && mapItems && mapItems.length > 0 && !this.isBoss) {
      const uncollected = mapItems.filter(it => !it.collected);
      if (uncollected.length > 0) {
        const nearest = uncollected.reduce((best, it) => {
          const da = Math.hypot(it.x - this.cx(), it.y - this.cy());
          const db = Math.hypot(best.x - this.cx(), best.y - this.cy());
          return da < db ? it : best;
        });
        const da = Math.hypot(nearest.x - this.cx(), nearest.y - this.cy());
        if (d > 200 || da < 80) {
          const adir = nearest.x > this.cx() ? 1 : -1;
          if (!this.isEdgeDanger(adir)) this.vx = adir * spd;
          if (this.onGround && nearest.y < this.y - 30 && Math.random() < 0.05) this.vy = -18;
          return;
        }
      }
    }

    // ---- DANGER: lava / death zone ----
    if (currentArena.hasLava) {
      const distToLava = currentArena.lavaY - (this.y + this.h);
      if (distToLava < 130) {
        if (this.onGround && distToLava < 85) {
          this.vy = -20; // lava escape jump
          this.vx = this.cx() < GAME_W / 2 ? spd * 2.2 : -spd * 2.2;
        } else if (!this.onGround && distToLava < 110) {
          let nearestX = GAME_W / 2;
          let nearestDist = Infinity;
          for (const pl of currentArena.platforms) {
            if (pl.y < this.y) {
              const pdx2 = Math.abs(pl.x + pl.w / 2 - this.cx());
              if (pdx2 < nearestDist) { nearestDist = pdx2; nearestX = pl.x + pl.w / 2; }
            }
          }
          this.vx = nearestX > this.cx() ? spd * 2.2 : -spd * 2.2;
        }
        return;
      }
    }

    // ---- DANGER: boss void floor (when boss floor hazard is void) ----
    if (currentArena.isBossArena && bossFloorState === 'hazard' && bossFloorType === 'void') {
      const floorPl = currentArena.platforms.find(p => p.isFloor);
      if (floorPl && floorPl.isFloorDisabled && this.y + this.h > GAME_H - 140) {
        // Void floor active — flee upward toward nearest platform
        let nearestX = GAME_W / 2, nearestDist = Infinity;
        for (const pl of currentArena.platforms) {
          if (pl.isFloor) continue;
          const pdx3 = Math.abs(pl.x + pl.w / 2 - this.cx());
          if (pdx3 < nearestDist) { nearestDist = pdx3; nearestX = pl.x + pl.w / 2; }
        }
        this.vx = nearestX > this.cx() ? spd * 1.8 : -spd * 1.8;
        if (this.onGround && Math.random() < 0.25) this.vy = -20;
        else if (this.canDoubleJump && this.vy > 0 && Math.random() < 0.35) { this.vy = -17; this.canDoubleJump = false; }
        return;
      }
    }

    // ---- DANGER: map screen edges (avoid falling off) ----
    // Story mode uses wider margin so bots never drift near soft boundary
    const _edgeMargin = (storyModeActive && gameMode !== 'exploration') ? 110 : 50;
    const nearLeftEdge  = this.x < _edgeMargin && !this.isBoss;
    const nearRightEdge = this.x + this.w > GAME_W - _edgeMargin && !this.isBoss;
    if (this.onGround) {
      if (nearLeftEdge  && dir < 0) { this.vx = 0; }
      if (nearRightEdge && dir > 0) { this.vx = 0; }
    }
    if (!this.onGround && !this.isBoss) {
      if (nearLeftEdge  && this.vx < 0) this.vx = 0;
      if (nearRightEdge && this.vx > 0) this.vx = 0;
    }

    // ---- RANGED WEAPON AI: kite / strafe / aim behavior ----
    // Phases based on HP: low-HP kites far, dominant HP pushes close.
    if (this.weapon && this.weapon.type === 'ranged' && t && t.health > 0) {
      // HP-based phase switching
      const _hpPct       = this.health / this.maxHealth;
      const _advRatio    = t.health > 0 ? this.health / t.health : 2;
      const _targetIsRanged = !!(t.weapon && t.weapon.type === 'ranged');
      const _targetRetreating = _targetIsRanged && Math.sign(t.vx || 0) === Math.sign(t.cx() - this.cx()) && Math.abs(t.vx || 0) > 1.8;
      const _isLowHp     = _hpPct < 0.28;               // kite mode: stay far
      const _isDominating = _advRatio > 1.60 && _hpPct > 0.50; // push in for the kill
      const _optMin   = _targetIsRanged ? 95 : (_isDominating ? 90  : 160);
      const _optMax   = _targetIsRanged ? (_targetRetreating ? 150 : 175) : (_isLowHp ? 280 : (_isDominating ? 180 : 220));
      const _closeRange = _targetIsRanged ? 110 : 80; // panic distance — back away NOW

      // Tick strafe timer — flip direction more often when dominant
      this._rangedStrafeTimer = (this._rangedStrafeTimer || 0) - 1;
      if (this._rangedStrafeTimer <= 0) {
        this._rangedStrafeDir   = Math.random() < 0.5 ? 1 : -1;
        this._rangedStrafeTimer = _isDominating
          ? 10 + Math.floor(Math.random() * 15)  // fast repositioning when dominant
          : 18 + Math.floor(Math.random() * 22); // normal 0.3-0.67s
      }

      // Aim pause: slow-strafe instead of full stop so bot is never standing still
      if (this._rangedAimPause > 0) {
        this._rangedAimPause--;
        const _aimStrf = this.isEdgeDanger(this._rangedStrafeDir) ? -this._rangedStrafeDir : this._rangedStrafeDir;
        this.vx = _aimStrf * spd * 0.22; // very slow walk while aiming — not a statue
        this.facing = dir;
        if (this.cooldown <= 0) this.attack(t);
        if (this.abilityCooldown <= 0 && Math.random() < 0.18) this.ability(t);
        return;
      }
      // Schedule aim pause every 1.5-3s (skip when dominant — keep pushing)
      if (!_isDominating && Math.random() < 0.012) this._rangedAimPause = 8 + Math.floor(Math.random() * 12);

      if (d < _closeRange && _isLowHp) {
        // PANIC: enemy too close — back away and don't shoot (point-blank penalty)
        const escapeDir = -dir;
        if (!this.isEdgeDanger(escapeDir)) {
          this.vx = escapeDir * spd * 1.6;
        } else if (!this.isEdgeDanger(dir)) {
          this.vx = dir * spd * 1.2; // edge behind, try to pass through
        }
        if (this.onGround && Math.random() < 0.30) this.vy = -18; // jump away
      } else if (d > _optMax) {
        // PRESSURE: chase into range, shoot opportunistically
        if (!this.isEdgeDanger(dir)) this.vx = dir * spd * (_targetIsRanged ? 1.30 : (_isDominating ? 1.20 : 1.00));
        if (d < this.weapon.range * 1.1 + 20 && this.cooldown <= 0) this.attack(t);
      } else {
        // OPTIMAL RANGE: strafe continuously — never stand still
        const strafeDir = this.isEdgeDanger(this._rangedStrafeDir) ? -this._rangedStrafeDir : this._rangedStrafeDir;
        if (d < _optMin && _isLowHp && !this.isEdgeDanger(-dir)) {
          // Too close — back off
          this.vx = -dir * spd * 0.75;
        } else {
          // Dominant bots strafe faster to close in; low-HP bots strafe to maintain distance
          this.vx = strafeDir * spd * (_isDominating ? 0.95 : _isLowHp ? 0.68 : 0.78);
          if (!this.isEdgeDanger(dir) && d > this.weapon.range * 0.55) this.vx += dir * spd * (_targetIsRanged ? 0.58 : (_isLowHp ? 0.22 : 0.42));
        }
        this.facing = dir;
        if (this.cooldown <= 0 && Math.random() < (this.aiDiff === 'easy' ? 0.55 : this.aiDiff === 'medium' ? 0.75 : 0.90)) {
          this.attack(t);
        }
        if (this.abilityCooldown <= 0 && Math.random() < 0.15) this.ability(t);
      }
      if (this.superReady && Math.random() < 0.22) this.useSuper(t);
      return;
    }

    // ---- IMMEDIATE ATTACK OVERRIDE (melee only) ----
    // If in range and cooldown ready, always attack — bypass the utility state machine.
    if (t && t.health > 0 && this.cooldown <= 0) {
      const atkRange = this.weapon.range * 1.1 + 20;
      if (d < atkRange) {
        this.attack(t);
      }
    }
    const _abiFreqNow = Math.min(1, (this.aiDiff === 'easy' ? 0.10 : this.aiDiff === 'medium' ? 0.20 : this.aiDiff === 'hard' ? 0.35 : 0.55) * _worldAggro);
    if (t && this.abilityCooldown <= 0 && d < 280 && Math.random() < _abiFreqNow) {
      this.ability(t);
    }
    if (this.superReady && Math.random() < 0.22) { this.useSuper(t); }

    // Emergency super: if critically low health and super is ready, fire immediately
    if (this.health < 40 && this.superReady) { this.useSuper(t); }

    // ---- NO-IDLE SYSTEM: inactivity enforcement + micro-randomization + intent movement ----
    if (!this.isBoss) {
      const isMoving = Math.abs(this.vx) > 0.8 || !this.onGround;
      const isActing = this.state === 'attacking' || this.shielding;
      if (isMoving || isActing) {
        this._inactiveTime = 0;
      } else {
        this._inactiveTime++;
      }

      // Force engagement: if idle too long, immediately close and attack
      if (this._inactiveTime > 2) { // 2 AI ticks ~30 frames = ~0.5s
        this._inactiveTime = 0;
        if (typeof debugMode !== 'undefined' && debugMode) {
          console.warn('[AI no-idle]', { intent: this.intent, d, playerIdle: this._playerIdleTmr });
        }
        const forceDir = Math.sign(t.cx() - this.cx());
        if (!this.isEdgeDanger(forceDir)) this.vx = forceDir * spd * 1.5;
        if (this.onGround && !this.isEdgeDanger(dir) && (this.platformAbove() || Math.random() < 0.35)) this.vy = -17;
        if (this.cooldown <= 0 && d < this.weapon.range * 1.5 + 35) this.attack(t);
        return;
      }

      // Player is idle → increase aggression: attack more freely and close faster
      if (this._playerIdleTmr > 60) { // target idle for ~1s at AI tick rate
        if (this.cooldown <= 0 && d < this.weapon.range * 1.4 + 40) this.attack(t);
        if (!this.isEdgeDanger(dir) && Math.abs(this.vx) < spd * 0.6) this.vx = dir * spd * 0.9;
      }

      // Micro-randomization pulse every 0.5–1.5s: keeps AI feeling alive even in calm stretches
      this._microRandTimer--;
      if (this._microRandTimer <= 0) {
        this._microRandTimer = 30 + Math.floor(Math.random() * 60); // 30-90 AI ticks
        const roll = Math.random();
        if (roll < 0.30 && this.cooldown <= 0 && d < this.weapon.range * 1.5 + 45) {
          this.attack(t);                                              // 30% sudden attack
        } else if (roll < 0.50 && this.onGround && !this.isEdgeDanger(dir)) {
          this.vy = -17;                                              // 20% random jump
        } else if (roll < 0.70 && !this.isEdgeDanger(dir)) {
          this._wanderDir   = Math.random() < 0.70 ? dir : -dir;    // 20% reposition burst
          this._wanderTimer = 12 + Math.floor(Math.random() * 14);
        }
        // remaining 30%: no-op (natural pause keeps rhythm varied)
      }

      // Intent-based passive movement: always drift toward the current goal
      // Only kicks in when the bot is nearly stationary (utility AI will override if needed)
      if (Math.abs(this.vx) < 0.6) {
        switch (this.intent) {
          case 'pressure':
            if (!this.isEdgeDanger(dir)) this.vx = dir * spd * 0.90;
            break;
          case 'bait': {
            const baitGap = this.weapon.range + 50;
            if (d > baitGap + 30 && !this.isEdgeDanger(dir))  this.vx = dir  * spd * 0.50;
            if (d < baitGap - 30 && !this.isEdgeDanger(-dir)) this.vx = -dir * spd * 0.45;
            break;
          }
          case 'retreat':
            if (!this.isEdgeDanger(-dir)) this.vx = -dir * spd * 0.30;
            break;
          case 'reposition': {
            const toCenter = GAME_W / 2 - this.cx();
            const rDir2 = Math.sign(toCenter);
            if (Math.abs(toCenter) > 40 && !this.isEdgeDanger(rDir2)) this.vx = rDir2 * spd * 0.55;
            break;
          }
        }
      }
    }

    // ---- UTILITY AI: score-based action selection + raycast hazard detection ----
    // Replaces the old state machine; handles movement, combat, dodge, and reaction lag.
    this.executeUtilityAI(t);
  }

  // ---- DRAW ----
  draw() {
    if (this.backstageHiding) return;
    if (this.health <= 0 && !this.isBoss && !this.isDummy) return; // ragdolls handle dead fighter visuals; dummies always draw

    ctx.save();

    // Scale transform for oversized fighters — pivot at feet so players stay grounded
    if (this.drawScale && this.drawScale !== 1) {
      const pivX = this.cx();
      const pivY = this.y + this.h;   // feet = ground level
      ctx.translate(pivX, pivY);
      ctx.scale(this.drawScale, this.drawScale);
      ctx.translate(-pivX, -pivY);
    }

    // Invincibility blink
    if (this.invincible > 0 && Math.floor(this.invincible / 5) % 2 === 1) {
      ctx.globalAlpha = 0.35;
    }

    const cx = this.cx();
    const ty = this.y;
    const f  = this.facing;
    const s  = this.state;
    const t  = this.animTimer;

    // ---- Scripted animation ----

    // Boss phase aura glow (phase 2+)
    if (this.isBoss && settings.bossAura) {
      const bPhase = this.getPhase ? this.getPhase() : 0;
      if (bPhase >= 2) {
        ctx.save();
        const pulse = 0.10 + Math.sin(t * 0.09) * 0.05;
        ctx.globalAlpha = pulse;
        ctx.fillStyle   = bPhase >= 3 ? '#ff2200' : '#9900cc';
        ctx.shadowColor = bPhase >= 3 ? '#ff6600' : '#cc00ff';
        ctx.shadowBlur  = 40;
        ctx.beginPath();
        ctx.ellipse(cx, ty + this.h * 0.5, this.w * 2.0, this.h * 0.75, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    // Ragdoll body rotation — use accumulated angular momentum
    if (this.ragdollTimer > 0) {
      ctx.translate(cx, ty + this.h * 0.45);
      ctx.rotate(this.ragdollAngle);
      ctx.translate(-cx, -(ty + this.h * 0.45));
    }

    // Squash / stretch / idle breath
    let animScaleX = 1, animScaleY = 1, animOffY = 0;
    if (!this.isBoss) {
      if (this.squashTimer > 0) {
        // Landing squash: compress vertically
        const sq = this.squashTimer / 4;
        animScaleX = 1 + sq * 0.15;
        animScaleY = 1 - sq * 0.15;
        this.squashTimer--;
      } else if (!this.onGround && this.vy < -8) {
        // Jump stretch: elongate vertically
        animScaleY = 1.12; animScaleX = 0.92;
      } else if (this.onGround && s === 'idle') {
        // Idle breath
        animOffY = Math.sin(t * 0.04) * 1;
      }
      if (animScaleX !== 1 || animScaleY !== 1) {
        ctx.translate(cx, ty + this.h);
        ctx.scale(animScaleX, animScaleY);
        ctx.translate(-cx, -(ty + this.h));
      }
    }

    const headR     = 11;
    // Head bob when walking: slight downward dip on each step
    const headBob   = (s === 'walking') ? Math.abs(Math.sin(t * 0.24)) * 1.8 : 0;
    const headCY    = ty + headR + 1 + animOffY + headBob;
    const neckY     = headCY + headR + 1;
    const shoulderY = neckY + 5;
    const hipY      = shoulderY + 30;
    // Body lean forward when walking/running
    const hipX      = cx + (s === 'walking' ? f * 1.8 : 0);
    const armLen    = 24;
    const legLen    = 27;
    // Inline helper: 2-segment limb joint via midpoint offset
    const _lj = (ax, ay, bx, by, ox, oy) => [(ax+bx)*0.5 + ox, (ay+by)*0.5 + oy];

    ctx.strokeStyle = this.color;
    ctx.lineWidth   = 4;
    ctx.lineCap     = 'round';
    ctx.lineJoin    = 'round';

    // HEAD
    ctx.beginPath();
    ctx.arc(cx, headCY, headR, 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.fill();

    // Eyes
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(cx + f * 4, headCY - 2, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = s === 'hurt' ? '#ff0000' : '#111';
    ctx.beginPath();
    ctx.arc(cx + f * 5.2, headCY - 2, 1.6, 0, Math.PI * 2);
    ctx.fill();

    // Expression (mouth)
    ctx.strokeStyle = s === 'hurt' || s === 'attacking' ? '#ff3333' : 'rgba(0,0,0,0.6)';
    ctx.lineWidth   = 1.5;
    ctx.beginPath();
    if (s === 'hurt') {
      ctx.arc(cx + f * 4, headCY + 4, 3.5, 0, Math.PI);
    } else {
      ctx.arc(cx + f * 4, headCY + 3, 3.5, 0, Math.PI, true);
    }
    ctx.stroke();

    // ACCESSORIES (hat, cape)
    drawAccessory(this, cx, headCY, shoulderY, hipY, f, headR);

    // BODY (leans forward when walking)
    ctx.strokeStyle = this.color;
    ctx.lineWidth   = 4;
    ctx.beginPath();
    ctx.moveTo(cx, neckY);
    ctx.lineTo(hipX, hipY);
    ctx.stroke();

    // ARM ANGLES
    const atkProgress = this.attackDuration > 0 ? 1 - this.attackTimer / this.attackDuration : 0;
    let rAng, lAng;

    if (this._rd && this.spinning <= 0) {
      rAng = this._rd.rArm.angle;
      lAng = this._rd.lArm.angle;
    } else if (this.spinning > 0) {
      // (fall through to spinning block below)
      rAng = 0; lAng = Math.PI; // placeholder; overwritten below
    }

    if (this.spinning > 0) {
      const spinA = (this.spinning / 24) * Math.PI * 4;
      rAng = spinA;
      lAng = spinA + Math.PI;
    } else if (s === 'attacking') {
      if (f > 0) { rAng = lerp(-0.45, 1.1, atkProgress); lAng = lerp(Math.PI*0.8, Math.PI*0.55, atkProgress); }
      else       { rAng = lerp(Math.PI+0.45, Math.PI-1.1, atkProgress); lAng = lerp(Math.PI*0.2, Math.PI*0.45, atkProgress); }
    } else if (s === 'walking') {
      const sw = Math.sin(t * 0.24) * 0.52;
      rAng = Math.PI * 0.58 + sw;
      lAng = Math.PI * 0.42 - sw;
    } else if (s === 'jumping' || s === 'falling') {
      rAng = -0.25; lAng = Math.PI + 0.25;
    } else if (s === 'shielding') {
      rAng = f > 0 ? -0.25 : Math.PI + 0.25;
      lAng = f > 0 ? -0.55 : Math.PI + 0.55;
    } else {
      const b = Math.sin(t * 0.045) * 0.045;
      rAng = Math.PI * 0.58 + b;
      lAng = Math.PI * 0.42 - b;
    }

    const rEx = cx + Math.cos(rAng) * armLen;
    const rEy = shoulderY + Math.sin(rAng) * armLen;
    const lEx = cx + Math.cos(lAng) * armLen;
    const lEy = shoulderY + Math.sin(lAng) * armLen;

    // 2-segment arms: elbows bend outward (in facing direction) and slightly up
    const elbowOut = f * 5;
    const [rElbX, rElbY] = _lj(cx, shoulderY, rEx, rEy, elbowOut, -3);
    const [lElbX, lElbY] = _lj(cx, shoulderY, lEx, lEy, elbowOut, -3);
    ctx.strokeStyle = this.color;
    ctx.lineWidth   = 4;
    ctx.beginPath(); ctx.moveTo(cx, shoulderY); ctx.lineTo(rElbX, rElbY); ctx.lineTo(rEx, rEy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, shoulderY); ctx.lineTo(lElbX, lElbY); ctx.lineTo(lEx, lEy); ctx.stroke();

    // WEAPON in right hand (boss draws gauntlet on both hands for visual flair)
    const weapScale = this.isBoss ? 1.0 : 1.5;
    this.drawWeapon(rEx, rEy, rAng, s === 'attacking', null, weapScale);
    if (this.isBoss && this.weaponKey === 'gauntlet') {
      this.drawWeapon(lEx, lEy, lAng + Math.PI, s === 'attacking', 'gauntlet', weapScale);
    }

    // LEGS
    let rLeg, lLeg;
    if (this._rd && this.spinning <= 0) {
      rLeg = this._rd.rLeg.angle;
      lLeg = this._rd.lLeg.angle;
    } else if (s === 'stunned') {
      rLeg = Math.PI * 0.6; lLeg = Math.PI * 0.4;
    } else if (s === 'jumping')      { rLeg = Math.PI*0.65; lLeg = Math.PI*0.35; }
    else if (s === 'falling') { rLeg = Math.PI*0.56; lLeg = Math.PI*0.44; }
    else if (s === 'walking') {
      const sw = Math.sin(t * 0.24) * 0.44;
      rLeg = Math.PI * 0.5 + sw;
      lLeg = Math.PI * 0.5 - sw;
    } else { rLeg = Math.PI*0.62; lLeg = Math.PI*0.38; }

    // 2-segment legs: knees bend forward (in facing direction)
    const rFootX = hipX + Math.cos(rLeg)*legLen, rFootY = hipY + Math.sin(rLeg)*legLen;
    const lFootX = hipX + Math.cos(lLeg)*legLen, lFootY = hipY + Math.sin(lLeg)*legLen;
    const kneeOut = f * 5;
    const [rKneeX, rKneeY] = _lj(hipX, hipY, rFootX, rFootY, kneeOut, 0);
    const [lKneeX, lKneeY] = _lj(hipX, hipY, lFootX, lFootY, kneeOut, 0);
    ctx.beginPath(); ctx.moveTo(hipX, hipY); ctx.lineTo(rKneeX, rKneeY); ctx.lineTo(rFootX, rFootY); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(hipX, hipY); ctx.lineTo(lKneeX, lKneeY); ctx.lineTo(lFootX, lFootY); ctx.stroke();

    // SHIELD bubble
    if (this.shielding) {
      ctx.beginPath();
      ctx.arc(cx + f * 15, shoulderY + 12, 23, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(100,210,255,0.88)';
      ctx.lineWidth   = 3;
      ctx.stroke();
      ctx.fillStyle   = 'rgba(100,210,255,0.14)';
      ctx.fill();
    }

    // ARMOR visuals (enemy story armor pieces)
    if (this.armorPieces && this.armorPieces.length > 0) {
      ctx.save();
      const armorCol  = '#9ab8e8';
      const armorEdge = '#cde0ff';
      ctx.strokeStyle = armorEdge;
      ctx.fillStyle   = armorCol;
      ctx.lineWidth   = 1.5;
      // Helmet
      if (this.armorPieces.includes('helmet')) {
        ctx.beginPath();
        ctx.arc(cx, headCY, headR + 3, Math.PI, 0);
        ctx.lineTo(cx + headR + 3, headCY + 4);
        ctx.lineTo(cx - headR - 3, headCY + 4);
        ctx.closePath();
        ctx.fillStyle = armorCol; ctx.fill();
        ctx.strokeStyle = armorEdge; ctx.stroke();
        // visor slit
        ctx.strokeStyle = '#7090c0'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(cx - 5, headCY); ctx.lineTo(cx + 5, headCY); ctx.stroke();
      }
      // Chestplate
      if (this.armorPieces.includes('chestplate')) {
        ctx.fillStyle = armorCol; ctx.strokeStyle = armorEdge; ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(cx - 8, neckY + 2, 16, 18, 2);
        ctx.fill(); ctx.stroke();
        // center line
        ctx.strokeStyle = '#7090c0'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(cx, neckY + 4); ctx.lineTo(cx, neckY + 18); ctx.stroke();
      }
      // Leggings
      if (this.armorPieces.includes('leggings')) {
        ctx.fillStyle = armorCol; ctx.strokeStyle = armorEdge; ctx.lineWidth = 1.5;
        // left leg plate
        ctx.beginPath(); ctx.roundRect(hipX - 8, hipY, 7, 12, 2); ctx.fill(); ctx.stroke();
        // right leg plate
        ctx.beginPath(); ctx.roundRect(hipX + 1, hipY, 7, 12, 2); ctx.fill(); ctx.stroke();
      }
      ctx.restore();
    }

    // Stun stars orbiting head
    if (this.stunTimer > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, this.stunTimer / 15);
      for (let i = 0; i < 3; i++) {
        const starA  = t * 0.14 + (i * Math.PI * 2 / 3);
        const starX  = cx  + Math.cos(starA) * 15;
        const starY  = ty  - 4 + Math.sin(starA * 2) * 5;
        ctx.fillStyle   = i % 2 === 0 ? '#ffdd00' : '#ffffff';
        ctx.font        = '10px Arial';
        ctx.textAlign   = 'center';
        ctx.fillText('★', starX, starY);
      }
      ctx.restore();
    }

    // SUPER READY flash
    if (this.superFlashTimer > 0) {
      const pulse = Math.abs(Math.sin(this.superFlashTimer * 0.18));
      ctx.save();
      ctx.globalAlpha = Math.min(1, this.superFlashTimer / 20);
      ctx.font        = `bold ${12 + Math.floor(pulse * 4)}px Arial`;
      ctx.fillStyle   = '#ffd700';
      ctx.textAlign   = 'center';
      ctx.shadowColor = '#ff8800';
      ctx.shadowBlur  = 10 + pulse * 8;
      ctx.fillText('SUPER!', cx, ty - 20);
      ctx.restore();
    }

    // Name tag
    ctx.globalAlpha  = 1;
    ctx.font         = 'bold 10px Arial';
    ctx.fillStyle    = this.color;
    ctx.textAlign    = 'center';
    ctx.shadowColor  = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur   = 4;
    ctx.fillText(this.name, cx, ty - 5);
    ctx.shadowBlur   = 0;
    // Fix 6: debug state label — shown only when dmgNumbers is on (dev toggle)
    if (this._debugState && settings.dmgNumbers) {
      ctx.font      = 'bold 8px monospace';
      ctx.fillStyle = '#ffee55';
      ctx.fillText(this._debugState, cx, ty - 16);
    }

    // Per-limb ragdoll debug overlay
    if (this._rd) PlayerRagdoll.debugDraw(this, cx, shoulderY, hipY);

    ctx.restore();
  }

  drawWeapon(hx, hy, angle, attacking, overrideKey = null, scale = 1) {
    ctx.save();
    ctx.translate(hx, hy);
    ctx.rotate(angle + (attacking ? 0.6 : 0));
    if (scale !== 1) ctx.scale(scale, scale);
    ctx.lineCap   = 'round';

    const k = overrideKey || this.weaponKey;

    // Store world-space weapon tip for clash detection
    const _tipAngle = angle + (attacking ? 0.6 : 0);
    const _tipRange = this.weapon ? (this.weapon.range || 30) : 30;
    this._weaponTip = { x: hx + Math.cos(_tipAngle) * _tipRange * 0.85,
                        y: hy + Math.sin(_tipAngle) * _tipRange * 0.85,
                        attacking };

    // --- Weapon glow: stronger when swinging (prevents clipping into background) ---
    const _glowColors = {
      sword: '#c8e8ff', hammer: '#ffaa44', gun: '#ff4444', axe: '#ff6633',
      spear: '#8888ff', bow: '#aadd88', shield: '#4488ff', scythe: '#aabbcc',
      fryingpan: '#ffcc44', broomstick: '#ddbb44', boxinggloves: '#ff3333',
      peashooter: '#44ff66', slingshot: '#cc8844', paperairplane: '#aaccff',
    };
    if (k !== 'gauntlet' && _glowColors[k]) {
      const pulse = 0.5 + 0.5 * Math.sin(frameCount * 0.12 + (this.playerNum || 0));
      ctx.shadowColor = _glowColors[k];
      ctx.shadowBlur  = attacking ? Math.max(15, 18 + pulse * 8) : 5 + pulse * 5;
    }

    // Weapon theme: override glow colour when a cosmetic theme is active
    if (!overrideKey && this.weaponTheme && typeof WEAPON_THEMES !== 'undefined' && WEAPON_THEMES[this.weaponTheme]) {
      const pulse = 0.5 + 0.5 * Math.sin(frameCount * 0.12 + (this.playerNum || 0));
      ctx.shadowColor = WEAPON_THEMES[this.weaponTheme];
      ctx.shadowBlur  = attacking ? Math.max(18, 22 + pulse * 10) : 7 + pulse * 7;
    }

    if (k === 'sword') {
      ctx.strokeStyle = '#cccccc';
      ctx.lineWidth   = 3;
      ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(26,-3); ctx.stroke();
      ctx.strokeStyle = '#ffee99';
      ctx.lineWidth   = 1.5;
      ctx.beginPath(); ctx.moveTo(-5,0); ctx.lineTo(5,0); ctx.stroke();

    } else if (k === 'hammer') {
      ctx.strokeStyle = '#888';
      ctx.lineWidth   = 3;
      ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(20,0); ctx.stroke();
      ctx.fillStyle   = '#777';
      ctx.fillRect(17, -9, 13, 15);
      ctx.fillStyle   = '#999';
      ctx.fillRect(17, -9, 13, 4);

    } else if (k === 'gun') {
      ctx.fillStyle = '#444';
      ctx.fillRect(0, -4, 18, 8);
      ctx.fillStyle = '#333';
      ctx.fillRect(15, -2, 12, 4);
      ctx.fillStyle = '#555';
      ctx.fillRect(4, 4, 6, 5);

    } else if (k === 'axe') {
      ctx.strokeStyle = '#cc4422';
      ctx.lineWidth   = 3;
      ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(18,0); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(14,-11); ctx.lineTo(23,2); ctx.lineTo(13,5);
      ctx.closePath();
      ctx.fillStyle = '#cc4422';
      ctx.fill();

    } else if (k === 'spear') {
      ctx.strokeStyle = '#8888ff';
      ctx.lineWidth   = 4;
      ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(30,0); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(27,-7); ctx.lineTo(38,0); ctx.lineTo(27,7);
      ctx.closePath();
      ctx.fillStyle = '#aaaaff';
      ctx.fill();

    } else if (k === 'bow') {
      // Curved bow + arrow nocked
      ctx.strokeStyle = '#8b5e3c'; ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, 18, -Math.PI * 0.6, Math.PI * 0.6);
      ctx.stroke();
      // String
      ctx.strokeStyle = '#ddd'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, -18 * Math.sin(Math.PI * 0.6)); ctx.lineTo(0, 18 * Math.sin(Math.PI * 0.6)); ctx.stroke();
      // Arrow
      ctx.strokeStyle = '#c8a060'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(-4, 0); ctx.lineTo(22, 0); ctx.stroke();
      ctx.fillStyle = '#888';
      ctx.beginPath(); ctx.moveTo(22, -4); ctx.lineTo(28, 0); ctx.lineTo(22, 4); ctx.fill();

    } else if (k === 'shield') {
      // Kite shield
      ctx.fillStyle = '#4466cc';
      ctx.beginPath();
      ctx.moveTo(-8, -14); ctx.lineTo(8, -14);
      ctx.lineTo(12, 4); ctx.lineTo(0, 16); ctx.lineTo(-12, 4);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#aabbff'; ctx.lineWidth = 1.5; ctx.stroke();
      // Boss trim
      ctx.strokeStyle = '#ffee88'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(0, 10); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-7, -2); ctx.lineTo(7, -2); ctx.stroke();

    } else if (k === 'scythe') {
      // Long handle
      ctx.strokeStyle = '#5a3a1a'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(-6, 0); ctx.lineTo(28, 0); ctx.stroke();
      // Curved blade
      ctx.fillStyle = '#778899';
      ctx.beginPath();
      ctx.moveTo(18, -2);
      ctx.quadraticCurveTo(34, -20, 26, -28);
      ctx.quadraticCurveTo(14, -20, 18, -2);
      ctx.fill();
      ctx.strokeStyle = '#aabbcc'; ctx.lineWidth = 1; ctx.stroke();

    } else if (k === 'fryingpan') {
      // Handle
      ctx.strokeStyle = '#6b4c2a'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(-2, 0); ctx.lineTo(16, 0); ctx.stroke();
      // Pan head
      ctx.fillStyle = '#555';
      ctx.beginPath(); ctx.arc(23, 0, 10, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#777'; ctx.lineWidth = 1.5; ctx.stroke();
      // Shine
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.beginPath(); ctx.ellipse(20, -4, 5, 3, -0.4, 0, Math.PI * 2); ctx.fill();

    } else if (k === 'broomstick') {
      // Long stick
      ctx.strokeStyle = '#8b6914'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(-4, 0); ctx.lineTo(32, 0); ctx.stroke();
      // Bristles
      ctx.strokeStyle = '#c8a040'; ctx.lineWidth = 1.5;
      for (let bi = 0; bi < 5; bi++) {
        const bx = 28 + bi * 2;
        ctx.beginPath(); ctx.moveTo(bx, -7 + bi); ctx.lineTo(bx + 3, 7 - bi); ctx.stroke();
      }
      // Binding
      ctx.strokeStyle = '#8b4040'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(26, -5); ctx.lineTo(26, 5); ctx.stroke();

    } else if (k === 'boxinggloves') {
      // Large rounded glove
      ctx.fillStyle = '#cc2222';
      ctx.beginPath(); ctx.roundRect(0, -8, 20, 16, 6); ctx.fill();
      ctx.strokeStyle = '#ff4444'; ctx.lineWidth = 1.5; ctx.stroke();
      // Knuckle line
      ctx.strokeStyle = '#ff8888'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(18, -5); ctx.lineTo(18, 5); ctx.stroke();
      // Wrist band
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, -2, 5, 4);

    } else if (k === 'peashooter') {
      // Tube body
      ctx.fillStyle = '#228833';
      ctx.fillRect(0, -4, 22, 8);
      ctx.strokeStyle = '#44aa44'; ctx.lineWidth = 1; ctx.strokeRect(0, -4, 22, 8);
      // Barrel opening
      ctx.fillStyle = '#0a1a0a';
      ctx.beginPath(); ctx.arc(22, 0, 3.5, 0, Math.PI * 2); ctx.fill();
      // Leaf detail
      ctx.fillStyle = '#33aa33';
      ctx.beginPath(); ctx.ellipse(8, -7, 7, 3, -0.3, 0, Math.PI * 2); ctx.fill();

    } else if (k === 'slingshot') {
      // Y-fork
      ctx.strokeStyle = '#6b3d0a'; ctx.lineWidth = 3; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(14, 0); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(20, -10); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(20, 10); ctx.stroke();
      // Elastic band
      ctx.strokeStyle = '#cc6622'; ctx.lineWidth = 1.5; ctx.setLineDash([2, 2]);
      ctx.beginPath(); ctx.moveTo(20, -10); ctx.lineTo(8, 0); ctx.lineTo(20, 10); ctx.stroke();
      ctx.setLineDash([]);
      // Stone in band
      ctx.fillStyle = '#888';
      ctx.beginPath(); ctx.arc(8, 0, 3, 0, Math.PI * 2); ctx.fill();

    } else if (k === 'paperairplane') {
      // Paper plane silhouette
      ctx.fillStyle = '#ddeeff';
      ctx.beginPath();
      ctx.moveTo(0, 0); ctx.lineTo(28, -2); ctx.lineTo(0, -10); ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(0, 0); ctx.lineTo(28, -2); ctx.lineTo(0, 8); ctx.closePath();
      ctx.fillStyle = '#bbccee'; ctx.fill();
      ctx.strokeStyle = '#7799bb'; ctx.lineWidth = 0.8; ctx.stroke();
      // Fold line
      ctx.strokeStyle = '#aabbdd'; ctx.lineWidth = 0.5;
      ctx.beginPath(); ctx.moveTo(0, -1); ctx.lineTo(20, -2); ctx.stroke();

    } else if (k === 'gauntlet') {
      // Large dark-energy fist/gauntlet around the hand
      ctx.save();
      ctx.shadowColor = '#bb00ff';
      ctx.shadowBlur  = 14;
      // Main gauntlet body
      ctx.fillStyle   = '#7700cc';
      ctx.beginPath();
      ctx.roundRect(-10, -10, 26, 20, 5);
      ctx.fill();
      // Bright outline
      ctx.strokeStyle = '#bb00ff';
      ctx.lineWidth   = 2;
      ctx.stroke();
      // Knuckle arcs
      ctx.fillStyle = '#9900ee';
      for (let ki = 0; ki < 3; ki++) {
        ctx.beginPath();
        ctx.arc(2 + ki * 6, -10, 4, Math.PI, 0);
        ctx.fill();
      }
      // Energy glow core
      ctx.globalAlpha = 0.5;
      ctx.fillStyle   = '#ee88ff';
      ctx.beginPath();
      ctx.arc(5, 0, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.restore();

    } else if (k === 'mkgauntlet') {
      // Megaknight gauntlets — gold + purple, larger than boss gauntlet
      ctx.save();
      ctx.shadowColor = '#cc88ff';
      ctx.shadowBlur  = 18;
      // Main body — gold plate
      ctx.fillStyle = '#aa6600';
      ctx.beginPath();
      ctx.roundRect(-12, -12, 30, 22, 6);
      ctx.fill();
      // Purple energy overlay
      ctx.fillStyle   = 'rgba(136,68,255,0.45)';
      ctx.fillRect(-12, -12, 30, 22);
      // Gold outline
      ctx.strokeStyle = '#ffcc44';
      ctx.lineWidth   = 4;
      ctx.beginPath();
      ctx.roundRect(-12, -12, 30, 22, 6);
      ctx.stroke();
      // Knuckle spikes
      ctx.fillStyle = '#ffcc44';
      for (let ki = 0; ki < 4; ki++) {
        ctx.beginPath();
        ctx.arc(-6 + ki * 8, -12, 4, Math.PI, 0);
        ctx.fill();
      }
      // Inner glow
      ctx.globalAlpha = 0.6;
      ctx.fillStyle   = '#cc88ff';
      ctx.beginPath();
      ctx.arc(3, 1, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.restore();

    } else if (k === 'voidblade') {
      // Dark jagged blade with purple void energy
      ctx.save();
      ctx.shadowColor = '#9933ff'; ctx.shadowBlur = 16;
      // Blade body — dark purple
      ctx.fillStyle = '#440088';
      ctx.beginPath();
      ctx.moveTo(0, -3); ctx.lineTo(26, -1); ctx.lineTo(30, 1);
      ctx.lineTo(26, 3); ctx.lineTo(0, 2); ctx.closePath();
      ctx.fill();
      // Void cracks on blade
      ctx.strokeStyle = '#bb44ff'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(5, 0); ctx.lineTo(12, -2); ctx.lineTo(18, 1); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(16, 0); ctx.lineTo(24, -1); ctx.stroke();
      // Edge glow
      ctx.strokeStyle = '#9933ff'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(0, -3); ctx.lineTo(30, 0); ctx.lineTo(0, 2); ctx.stroke();
      ctx.restore();

    } else if (k === 'shockrifle') {
      // Sci-fi electric rifle — cyan + dark
      ctx.save();
      ctx.shadowColor = '#00ddff'; ctx.shadowBlur = 14;
      // Barrel
      ctx.fillStyle = '#113344';
      ctx.beginPath(); ctx.roundRect(0, -3, 28, 6, 2); ctx.fill();
      // Energy coils
      ctx.strokeStyle = '#00aacc'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(4, -3); ctx.lineTo(4, 3); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(10, -3); ctx.lineTo(10, 3); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(16, -3); ctx.lineTo(16, 3); ctx.stroke();
      // Muzzle glow
      ctx.fillStyle = '#00eeff';
      ctx.beginPath(); ctx.arc(28, 0, 3, 0, Math.PI * 2); ctx.fill();
      // Grip
      ctx.fillStyle = '#224455';
      ctx.beginPath(); ctx.roundRect(-3, 0, 6, 10, 2); ctx.fill();
      ctx.restore();
    }

    // ── Ranged cooldown bar (ranged weapons WITHOUT clipSize) ─────────────────
    if (this.weapon && this.weapon.type === 'ranged' && !this.weapon.clipSize &&
        this.state !== 'dead' && this.state !== 'ragdoll') {
      const barW = 36, barH = 4;
      const bx = this.cx() - barW / 2, by = this.y - 22;
      const cd = this.weapon.cooldown || 1;
      const pct = this.cooldown > 0 ? Math.max(0, 1 - this.cooldown / cd) : 1;
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(bx, by, barW, barH);
      ctx.fillStyle = pct >= 1 ? '#44ffaa' : '#ffcc44';
      ctx.fillRect(bx, by, barW * pct, barH);
      ctx.strokeStyle = 'rgba(255,255,255,0.18)';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(bx, by, barW, barH);
      // Label "READY" when full
      if (pct >= 1) {
        ctx.font = 'bold 6.5px Arial';
        ctx.fillStyle = '#44ffaa';
        ctx.textAlign = 'center';
        ctx.fillText('READY', this.cx(), by - 1);
      }
      ctx.restore();
    }

    // ── Ammo indicator (ranged weapons with clipSize) ─────────────────────────
    // Always drawn just above the fighter's head, capped to 32px max spread.
    if (this.weapon && this.weapon.clipSize && this.state !== 'dead' && this.state !== 'ragdoll') {
      const clip  = this.weapon.clipSize;
      const ammo  = this._ammo;
      // Scale dot size down for large clips so the bar never exceeds 32px wide
      const maxW  = 32;
      const dotR  = Math.min(3.5, maxW / (clip * 2.6));
      const gap   = dotR * 2.6;
      const totalW = (clip - 1) * gap;
      const startX = this.cx() - totalW / 2;
      // Fixed position: just above the fighter's head, independent of clip width
      const dotY   = this.y - 12;
      if (this._reloadTimer > 0) {
        // Reloading: compact arc ring centred on the fighter
        const progress = 1 - this._reloadTimer / this.weapon.reloadFrames;
        const arcR = Math.min(10, totalW / 2 + dotR + 2);
        ctx.save();
        ctx.strokeStyle = 'rgba(255,255,255,0.25)';
        ctx.lineWidth   = 3;
        ctx.beginPath();
        ctx.arc(this.cx(), dotY, arcR, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = '#ffdd44';
        ctx.lineWidth   = 3;
        ctx.beginPath();
        ctx.arc(this.cx(), dotY, arcR, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      } else {
        // Show bullet dots: filled = loaded, hollow = spent
        for (let i = 0; i < clip; i++) {
          const dx = startX + i * gap;
          ctx.beginPath();
          ctx.arc(dx, dotY, dotR, 0, Math.PI * 2);
          if (i < ammo) {
            ctx.fillStyle = '#ffdd44';
            ctx.fill();
          } else {
            ctx.strokeStyle = 'rgba(255,255,255,0.3)';
            ctx.lineWidth   = 1;
            ctx.stroke();
          }
        }
      }
    }

    // ── Invincibility / I-frame shield indicator ──────────────────────────────
    // Show a translucent pulsing shield when the fighter is invincible (spawn
    // grace, post-hit recovery, etc.) but NOT when they're in permanent godmode
    // (invincible === 9999 AND health is full — that's the training designer state).
    const _isPermInvincible = this.invincible >= 9999 && this.health >= this.maxHealth;
    if (this.invincible > 0 && !_isPermInvincible &&
        this.state !== 'dead' && this.state !== 'ragdoll') {
      const _pulse = 0.35 + 0.25 * Math.sin(frameCount * 0.28);
      ctx.save();
      // Outer glow ring
      ctx.globalAlpha = _pulse * 0.55;
      ctx.strokeStyle = '#88ddff';
      ctx.lineWidth   = 2.5;
      ctx.beginPath();
      ctx.ellipse(this.cx(), this.cy() - 4, this.w * 0.8, this.h * 0.6, 0, 0, Math.PI * 2);
      ctx.stroke();
      // Translucent fill
      ctx.globalAlpha = _pulse * 0.18;
      ctx.fillStyle   = '#aaddff';
      ctx.fill();
      // Small shield icon above head
      ctx.globalAlpha = _pulse * 0.75;
      ctx.fillStyle   = '#88ddff';
      ctx.font        = '9px Arial';
      ctx.textAlign   = 'center';
      ctx.fillText('🛡', this.cx(), this.y - 35);
      ctx.restore();
    }

    // ── Echo red tint (Damnation arc) ─────────────────────────────
    if (this.isEcho && damnationActive) {
      ctx.save();
      ctx.globalCompositeOperation = 'multiply';
      ctx.globalAlpha = 0.45;
      ctx.fillStyle   = '#ff2200';
      ctx.fillRect(this.x - 4, this.y - 4, this.w + 8, this.h + 8);
      ctx.restore();
    }

    // ── Damnation scar ghost trail (player who survived the loop) ─
    if (this._hasDamnationScar && !this.isEcho) {
      ctx.save();
      ctx.globalAlpha = 0.07;
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#cc2200';
      ctx.fillRect(this.x - 3, this.y - 3, this.w + 6, this.h + 6);
      ctx.restore();
    }

    ctx.restore();
  }
}
