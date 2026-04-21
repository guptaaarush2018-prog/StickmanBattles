class TrueForm extends Fighter {
  constructor() {
    const noCtrl = { left: null, right: null, jump: null, attack: null, ability: null, super: null };
    super(450, 350, '#000000', 'gauntlet', noCtrl, true, 'hard');
    // Override weapon to use a fist-style profile
    this.weapon = Object.assign({}, WEAPONS.gauntlet, {
      name: 'Fists', damage: 20, range: 48, cooldown: 16, kb: 7,
      contactDmgMult: 0,
      ability() {}
    });
    this.name          = 'TRUE FORM';
    this.health        = 10000;
    this.maxHealth     = 10000;
    this.w             = 18;
    this.h             = 50;
    this.isBoss        = true;
    this.isTrueForm    = true;
    this.lives         = 1;
    this.spawnX        = 450;
    this.spawnY        = 350;
    this.playerNum     = 2;
    this.color         = '#000000';
    this.kbResist      = 0.90;  // nearly no knockback — lowest in game
    this.kbBonus       = 0.55;  // deals low KB for tight combos
    this.attackCooldownMult = 0.65; // was 0.45 — increased to reduce M1 spam frequency
    this.superChargeRate    = 0; // no super meter
    this._tfSpeed      = 4.2;   // 1.3× normal fighter speed
    this._attackMode   = 'punch'; // alternates punch/kick
    // Combo tracking (max 4 hits, max 85% maxHP damage per combo)
    this._comboCount   = 0;
    this._comboDamage  = 0;
    this._comboTimer   = 0;
    // Special move cooldowns (in AI TICKS — updateAI runs every 15 frames)
    // TrueForm has shorter cooldowns than Creator to maintain overwhelming pressure
    this._gravityCd    =  8;  // ~2s   (was 14)
    this._warpCd       = 17;  // ~4.25s (was 28)
    this._holeCd       = 10;  // ~2.5s  (was 16)
    this._floorCd      = 26;  // ~6.5s  (was 44)
    this._invertCd     = 11;  // ~2.75s (was 18)
    this._sizeCd       = 11;  // ~2.75s (was 18)
    this._portalCd     =  7;  // ~1.75s (was 12)
    // New attack cooldowns (AI ticks — 1 tick = 15 frames)
    this._graspCd      = 17;  // Void Grasp    — ~4.25s (was 28)
    this._slashCd      =  5;  // Reality Slash — ~1.25s (was 9)
    this._wellCd       = 13;  // Gravity Well  — ~3.25s (was 22)
    this._meteorCd     = 22;  // Meteor Crash  — ~5.5s  (was 36)
    this._cloneCd      = 20;  // Shadow Clones — 5s     (was 34)
    this._chainCd      = 14;  // Chain Slam    — ~3.5s  (was 24)
    this.postSpecialPause = 0;
    // Cosmic visual state
    this._floatT    = Math.random() * Math.PI * 2; // random phase so float doesn't start at apex
    this._trailPts  = []; // [{x, y, a}] — fading ghost silhouette trail
    this._lastPhase    = 1;
    this._maxLives     = 1;
    // Dodge mechanic
    this._justDodged   = false;
    this._dodgeTimer   = 0;
    // Anti-repeat and player intelligence
    this._lastSpecial     = null;
    this._lastLastSpecial = null;
    this._stillTimer      = 0;
    this._lastTargetX     = -999;
    // Aggression timer (forces a special after idle)
    this._idleTicks       = 0;
    // Running-away detection
    this._runAwayTicks    = 0;
    // Shockwave cooldown
    this._shockwaveCd     = 0;
    this._teleportComboCd = 0;  // Teleport Combo — 12s
    this._gravityCrushCd  = 0;  // Gravity Crush  — 15s
    // Pending (deferred) attacks — telegraph first, then execute
    this._pendingSlash        = null; // { timer, targetX, targetY, target }
    this._pendingShockwave    = null; // { timer } — ground variant only
    this._pendingTeleportCombo = null; // { hits, target }
    this._pendingGravityCrush = null;  // { timer }
    this._prevHealth       = 5000; // for stagger accumulation tracking
    this._cinematicFired   = new Set(); // HP-threshold mid-fight cinematics already triggered
    // Dimensional attack cooldowns (AI ticks)
    this._phaseShiftCd  = 18;  // Phase Shift     — ~4.5s (was 30)
    this._realityTearCd = 26;  // Reality Tear    — ~6.5s (was 44)
    this._calcStrikeCd  = 13;  // Calculated Strike — ~3.25s (was 22)
    // Chaining + pressure system
    this._pendingChainMove    = null; // { move, delay } — queued follow-up attack
    this._prevTargetVxArr     = [];   // rolling history of target vx for unpredictability detection
    this._aggressionBurstTimer = 0;  // AI ticks remaining in hyper-aggressive burst
    this._comboFinisherCd     = 0;   // cooldown preventing back-to-back mini finishers
    // Desperation + new high-impact moves
    this._desperationMode     = false; // activates at <20% HP
    this._realityOverrideCd   = 0;    // Reality Override — boss rewrites game state
    this._collapseStrikeCd    = 0;    // Collapse Strike  — slowmo + devastating hit
    this._grabCinCd           = 36;   // Grab Cinematic   — short scripted grab+throw (was 60)
    this._dimensionCd         = 0;   // Dimension Shift  — toggle 2D/3D perspective
    this._pendingCollapseStrike = null; // { timer, target }
    // ── Cosmic attack cooldowns (AI ticks) ────────────────────
    this._gammaBeamCd    = 12;  // Gamma Ray Beam    — 3s    (was 20)
    this._neutronStarCd  = 17;  // Neutron Star      — ~4.25s (was 28)
    this._galaxySweepCd  = 14;  // Galaxy Sweep      — ~3.5s  (was 24)
    this._multiverseCd   = 19;  // Multiverse Fracture — ~4.75s (was 32)
    this._supernovaCd    = 999; // Supernova — triggers once at low HP only
    // ── Depth Phase Z-axis attack cooldowns (AI ticks) ───────────────────────
    this._depthPhaseShiftCd = 12; // Phase Shift Strike — ~3s  (shift Z then attack)
    this._depthLayerFakeCd  = 18; // Multi-Layer Fake   — ~4.5s (afterimages at diff Z)
    this._depthPunishCd     = 16; // Depth Punish       — ~4s  (attack if player idle in Z)

    // ── Adaptive AI: real-time player pattern recognition ──────────────────
    this.adaptationLevel  = 0;      // 0–100: depth of player understanding
    this._adaptProfileTick = 0;     // AI-tick counter for profile updates (every 8 ticks = 2s)
    this._adaptBehaviorCd  = 12;    // AI-tick countdown to next behavior recalculation

    // Raw per-cycle event counters
    this._rawAtks    = 0;
    this._rawJumps   = 0;
    this._rawDodges  = 0;
    this._rawBlocks  = 0;
    this._distSamples = [];

    // Smoothed player profile (updated every 2s, range 0–1 unless noted)
    this._profile = {
      attackFrequency:    0,     // attacks per 2s window
      jumpFrequency:      0,
      dodgeFrequency:     0,
      blockFrequency:     0,
      distancePreference: 200,   // px — preferred engagement gap
      repetitionScore:    0,     // 0=unpredictable, 1=very predictable
    };

    // Previous target state for delta detection
    this._prevTState = { attacking: false, onGround: true, shielding: false, vx: 0 };

    // Adaptive behavior multipliers (recalculated every _adaptBehaviorCd ticks)
    this._adaptDodge   = 0.32;  // dodge chance
    this._adaptAtkFreq = 0.16;  // melee attack frequency
    this._adaptSpacing = 55;    // preferred combat distance (px)
    this._adaptReact   = 3;     // reaction delay (AI ticks)

    // Adaptation milestone dialogue tracking
    this._adaptDialogueFired = new Set();

    // Visual evolution state (driven by adaptationLevel)
    this._adaptOrbitMult = 1.0;  // orbit speed multiplier; increases with adaptation
    this._adaptGlowBoost = 0;    // extra nebula brightness (0–1)
    this._adaptFlicker   = 0;    // high-adaptation instability (0–1)
    this._tfAttackState  = { name: null, phase: 'idle', timer: 0, locked: false };
    this._antiRangedStats = { projectiles: 0, rangedDamage: 0, farTicks: 0 };
    this._antiRangedTimer = 0;
    this._antiRangedCooldown = 0;
    this._antiRangedDashCd = 0;
    this._antiRangedPulse = 0;
    this._antiRangedFieldR = 220;
  }

  getPhase() {
    if (this.health > 3500) return 1;  // >70% HP
    if (this.health > 1500) return 2;  // 30–70% HP
    return 3;                           // <30% HP
  }

  _startAttackState(name, startFrames = 0, locked = false) {
    this._tfAttackState = { name, phase: 'start', timer: startFrames, locked };
  }

  _setAttackPhase(phase, frames = 0, locked = false) {
    if (!this._tfAttackState.name) return;
    this._tfAttackState.phase = phase;
    this._tfAttackState.timer = frames;
    this._tfAttackState.locked = locked;
  }

  _finishAttackState(name = null) {
    if (name && this._tfAttackState.name && this._tfAttackState.name !== name) return;
    // Recovery windows per attack — gives players a punish opportunity after heavy moves.
    // Light specials: 15–25f. Heavy/multiversal: 35–60f. Omit = no forced recovery.
    const TF_RECOVERY_FRAMES = {
      slash:           25,
      shockwave:       20,
      chain:           22,
      calcStrike:      45,
      grasp:           35,
      gravityCrush:    50,
      portal:          30,
      phaseShift:      25,
      realityTear:     40,
      collapseStrike:  35,
      gammaBeam:       30,
      neutronStar:     55,
      galaxySweep:     45,
      meteor:          55,
      realityOverride: 40,
      multiverseFracture: 50,
      clones:             28,
      well:               22,
    };
    const _recovFrames = (name && TF_RECOVERY_FRAMES[name]) || 0;
    if (_recovFrames > 0) {
      this._tfAttackState = { name, phase: 'recovery', timer: _recovFrames, locked: false };
    } else {
      this._tfAttackState = { name: null, phase: 'idle', timer: 0, locked: false };
    }
  }

  _startAntiRangedPhase(reason) {
    if (this._antiRangedTimer > 0 || this._antiRangedCooldown > 0) return false;
    this._antiRangedTimer = 360 + Math.floor(Math.random() * 241);
    this._antiRangedCooldown = this._antiRangedTimer + 420;
    this._antiRangedDashCd = 68;
    this._antiRangedPulse = 80;
    this._antiRangedFieldR = 220 + Math.min(45, this.adaptationLevel * 0.2);
    // Failsafe anti-idle system
    this._noActionTicks      = 0;   // consecutive AI ticks without attacking or using a special
    this._multiversalGroupCd    = 0; // AI ticks before multiversal moves re-allowed (cooldown grouping)
    this._consecutiveMeleeCount = 0; // melee-class specials used in a row (drives combo chain gate)
    this._hitReactPending    = false; // true when boss was hit and must respond within 2 ticks
    this._prevHealthForReact = this.health; // previous health for hit detection
    this._antiRangedStats.projectiles = 0;
    this._antiRangedStats.rangedDamage = 0;
    this._antiRangedStats.farTicks = 0;
    slowMotion = 0.18;
    hitSlowTimer = Math.max(hitSlowTimer, 18);
    screenShake = Math.max(screenShake, 22);
    if (typeof setCameraDrama === 'function') setCameraDrama('focus', 54, this, 1.22);
    if (typeof cinScreenFlash !== 'undefined') {
      cinScreenFlash = { color: '#8844ff', alpha: 0.34, timer: 12, maxTimer: 12 };
    }
    showBossDialogue('Running won’t save you.', 200);
    spawnParticles(this.cx(), this.cy(), '#ffffff', 24);
    spawnParticles(this.cx(), this.cy(), '#8844ff', 20);
    spawnParticles(this.cx(), this.cy(), '#000000', 16);
    return true;
  }

  _trackRangedAbuse(target, d) {
    if (!target || target.health <= 0) return;
    if (target.weapon && target.weapon.type === 'ranged' && d > 250) {
      this._antiRangedStats.farTicks = Math.min(999, this._antiRangedStats.farTicks + 1);
    } else {
      this._antiRangedStats.farTicks = Math.max(0, this._antiRangedStats.farTicks - 2);
    }
    const abuseScore =
      this._antiRangedStats.projectiles * 0.85 +
      this._antiRangedStats.rangedDamage * 0.32 +
      this._antiRangedStats.farTicks * 1.2;
    if (this._antiRangedCooldown <= 0 && abuseScore >= 42) {
      this._startAntiRangedPhase('abuse');
    }
  }

  attack(target) {
    if (this.cooldown > 0 || this.health <= 0 || this.stunTimer > 0 || this.ragdollTimer > 0) return;
    if (this.postSpecialPause > 0) return;
    if (this._tfAttackState?.phase === 'recovery') return;
    // Combo cap: max 4 hits per combo burst
    if (this._comboCount >= 4) return;
    // Damage cap: combo cannot deal more than 85% of target's maxHP
    if (target && this._comboDamage >= target.maxHealth * 0.85) return;
    // Alternate punch / kick
    this._attackMode = this._attackMode === 'punch' ? 'kick' : 'punch';
    this.weaponHit   = false;
    this.swingHitTargets.clear();
    this.cooldown    = Math.max(1, Math.ceil(this.weapon.cooldown * this.attackCooldownMult));
    this.attackTimer = this.attackDuration;
    this._comboCount++;
    this._comboTimer = 0;
  }

  updateAI() {
    if (activeCinematic || gameFrozen) return; // freeze during cinematics / freeze frames
    if (typeof tfOpeningFightActive !== 'undefined' && tfOpeningFightActive) return; // scripted opening — TF does not act
    if (this.aiReact > 0) { this.aiReact--; return; }
    if (this.ragdollTimer > 0 || this.stunTimer > 0) return;
    if (bossStaggerTimer > 0) return; // stunned — vulnerability window

    // ── Hit-reaction detection ─────────────────────────────────────────
    // If boss took damage this tick, flag an immediate reaction (overrides postSpecialPause)
    const _dmgThisTick = this._prevHealthForReact - this.health;
    this._prevHealthForReact = this.health;
    if (_dmgThisTick > 0) {
      this._hitReactPending = true;
      this._noActionTicks   = 0;
      this.postSpecialPause = Math.min(this.postSpecialPause, 1); // cut pause short on hit
    }

    // ── No-action failsafe ─────────────────────────────────────────────
    // If 8+ consecutive AI ticks with no attack or special (= ~120 frames), force action now
    this._noActionTicks++;
    if (this._noActionTicks >= 8) {
      this._noActionTicks   = 0;
      this._hitReactPending = true;
      this.postSpecialPause = 0;
    }

    // ── postSpecialPause: allow movement and hit-reactions; block specials only ──
    if (this.postSpecialPause > 0) {
      this.postSpecialPause--;
      const _pt = this.target;
      if (_pt && _pt.health > 0) {
        const _pdx = _pt.cx() - this.cx();
        const _pd  = Math.abs(_pdx);
        const _pdir = _pdx > 0 ? 1 : -1;
        // Always chase during pause so boss never stands frozen
        if (_pd > 55) this.vx = _pdir * this._tfSpeed;
        // React to hits: skip remaining pause and fall through to full AI
        if (this._hitReactPending) {
          this.postSpecialPause = 0;
          this._hitReactPending = false;
          // fall through
        } else {
          return;
        }
      } else {
        return;
      }
    }
    this._hitReactPending = false; // clear after we've passed the gate

    const phase = this.getPhase();
    if (phase > this._lastPhase) {
      this._lastPhase = phase;
      if (settings.screenShake) screenShake = Math.max(screenShake, 22);
      this.postSpecialPause = Math.max(this.postSpecialPause, 7); // 7 ticks = 105 frames = 1.75s cinematic pause
      triggerPhaseTransition(this, phase);
    }

    // ── Mid-fight HP cinematics ───────────────────────────────
    if (!this._cinematicFired.has('entry')) {
      // Free-fight phase: player can move/attack freely for ~6 seconds before Paradox joins.
      if (!this._freePhaseTimer) this._freePhaseTimer = 0;
      this._freePhaseTimer++;
      if (this._freePhaseTimer < 24) return; // ~6 seconds of free combat (24 AI ticks × 15 frames = 360 frames)
      this._cinematicFired.add('entry');
      this.postSpecialPause = Math.max(this.postSpecialPause, 24);
      // Entry: interactive opening fight (player + Paradox vs TF before main fight)
      if (typeof startTFOpeningFight === 'function') {
        startTFOpeningFight(this);
      } else if (typeof _makeTFIntroCinematic === 'function') {
        startCinematic(_makeTFIntroCinematic(this));
      } else {
        const _entryCin = (typeof _makeTFParadoxEntryCinematic === 'function')
          ? _makeTFParadoxEntryCinematic(this)
          : _makeTFEntryCinematic(this);
        startCinematic(_entryCin);
      }
      return;
    }
    const _tfHpPct = this.health / this.maxHealth;
    // QTE triggers at 75 / 50 / 25 / 10 % HP
    if (!this._cinematicFired.has('qte75') && _tfHpPct <= 0.75) {
      this._cinematicFired.add('qte75');
      if (typeof triggerQTEPhase === 'function') triggerQTEPhase(1);
    }
    if (!this._cinematicFired.has('50') && _tfHpPct <= 0.50) {
      this._cinematicFired.add('50');
      if (typeof triggerQTEPhase === 'function') triggerQTEPhase(2);
      this.postSpecialPause = Math.max(this.postSpecialPause, 14);
      startCinematic(_makeTFReality50Cinematic(this));
      return;
    }
    // 1000 HP: Paradox returns — joint fight, TF kills Paradox, absorption, dimension punch
    if (!this._cinematicFired.has('paradox1000') && this.health <= 1000 &&
        typeof startTFParadoxReturn1000 === 'function') {
      this._cinematicFired.add('paradox1000');
      this.postSpecialPause = Math.max(this.postSpecialPause, 20);
      startTFParadoxReturn1000(this);
      return;
    }
    if (!this._cinematicFired.has('qte25') && _tfHpPct <= 0.25) {
      this._cinematicFired.add('qte25');
      if (typeof triggerQTEPhase === 'function') triggerQTEPhase(3);
    }
    if (!this._cinematicFired.has('15') && _tfHpPct <= 0.15) {
      this._cinematicFired.add('15');
      if (typeof triggerQTEPhase === 'function') triggerQTEPhase(4);
      this.postSpecialPause = Math.max(this.postSpecialPause, 16);
      startCinematic(_makeTFDesp15Cinematic(this));
      return;
    }

    // False Victory is now triggered from _tfeResumeAfterIntro (after Code Realm),
    // not from an HP threshold — so no HP check here.

    // Combo reset: if no new attack for 90 frames, reset combo window
    this._comboTimer++;
    if (this._comboTimer > 90) {
      this._comboCount  = 0;
      this._comboDamage = 0;
    }

    // ── Desperation mode activates at <20% HP ────────────────
    if (!this._desperationMode && this.health / this.maxHealth < 0.20) {
      this._desperationMode = true;
      showBossDialogue(randChoice(['You wanted this.', 'Last warning. You passed it.', 'There is no ceiling above me.', 'Fine. All of it.']), 260);
      screenShake = Math.max(screenShake, 28);
      spawnParticles(this.cx(), this.cy(), '#ffffff', 30);
      spawnParticles(this.cx(), this.cy(), '#000000', 20);
    }

    // Final state boost: jump adaptation to max when false victory completes
    if (typeof tfFinalStateActive !== 'undefined' && tfFinalStateActive && this.adaptationLevel < 90) {
      this.adaptationLevel = 90;
      this._tfSpeed = Math.min(this._tfSpeed * 1.2, 7.0); // +20% speed
    }

    // Tick all special cooldowns
    if (this._gravityCd > 0) this._gravityCd--;
    if (this._warpCd    > 0) this._warpCd--;
    if (this._holeCd    > 0) this._holeCd--;
    if (this._floorCd   > 0) this._floorCd--;
    if (this._invertCd  > 0) this._invertCd--;
    if (this._sizeCd    > 0) this._sizeCd--;
    if (this._portalCd  > 0) this._portalCd--;
    if (this._graspCd     > 0) this._graspCd--;
    if (this._slashCd     > 0) this._slashCd--;
    if (this._wellCd      > 0) this._wellCd--;
    if (this._meteorCd    > 0) this._meteorCd--;
    if (this._cloneCd     > 0) this._cloneCd--;
    if (this._chainCd     > 0) this._chainCd--;
    if (this._shockwaveCd     > 0) this._shockwaveCd--;
    if (this._teleportComboCd > 0) this._teleportComboCd--;
    if (this._gravityCrushCd  > 0) this._gravityCrushCd--;
    if (this._phaseShiftCd  > 0) this._phaseShiftCd--;
    if (this._realityTearCd > 0) this._realityTearCd--;
    if (this._calcStrikeCd  > 0) this._calcStrikeCd--;
    if (this._realityOverrideCd > 0) this._realityOverrideCd--;
    if (this._collapseStrikeCd  > 0) this._collapseStrikeCd--;
    if (this._grabCinCd         > 0) this._grabCinCd--;
    if (this._dimensionCd       > 0) this._dimensionCd--;
    if (this._gammaBeamCd    > 0) this._gammaBeamCd--;
    if (this._neutronStarCd  > 0) this._neutronStarCd--;
    if (this._galaxySweepCd  > 0) this._galaxySweepCd--;
    if (this._multiverseCd   > 0) this._multiverseCd--;
    if (this._supernovaCd    > 0) this._supernovaCd--;
    if (this._multiversalGroupCd > 0) this._multiversalGroupCd--;
    if (this._depthPhaseShiftCd > 0) this._depthPhaseShiftCd--;
    if (this._depthLayerFakeCd  > 0) this._depthLayerFakeCd--;
    if (this._depthPunishCd     > 0) this._depthPunishCd--;
    // ── Recovery phase tick-down ──────────────────────────────────
    // When _tfAttackState.phase === 'recovery', TF cannot start new specials (enforced in _doSpecial).
    // Tick down the timer here so it clears automatically.
    if (this._tfAttackState.phase === 'recovery' && this._tfAttackState.timer > 0) {
      this._tfAttackState.timer--;
      if (this._tfAttackState.timer <= 0) {
        this._tfAttackState = { name: null, phase: 'idle', timer: 0, locked: false };
      }
      // Dampen movement during recovery — gives players a real punish window
      this.vx *= 0.4;
      this.vy *= 0.4;
    }
    // ── Desperation: triple burn on all offensive cooldowns ──────
    if (this._desperationMode) {
      const burnKeys = ['_slashCd','_graspCd','_chainCd','_phaseShiftCd','_gammaBeamCd','_shockwaveCd','_calcStrikeCd','_portalCd'];
      for (const k of burnKeys) { if (this[k] > 0) this[k] -= 2; }
    }
    // ── Pressure system: idle player → faster cooldowns ──────────
    if (this._stillTimer > 8) {
      if (this._slashCd      > 0) this._slashCd--;
      if (this._calcStrikeCd > 0) this._calcStrikeCd--;
      if (this._phaseShiftCd > 0) this._phaseShiftCd--;
      if (this._shockwaveCd  > 0) this._shockwaveCd--;
      if (this._gammaBeamCd  > 0) this._gammaBeamCd--;
    }
    // ── Aggression burst tick ─────────────────────────────────
    if (this._aggressionBurstTimer > 0) this._aggressionBurstTimer--;
    // ── Combo finisher cooldown ───────────────────────────────
    if (this._comboFinisherCd > 0) this._comboFinisherCd--;
    // ── Execute pending chain move ────────────────────────────
    if (this._pendingChainMove) {
      this._pendingChainMove.delay--;
      if (this._pendingChainMove.delay <= 0) {
        const cm = this._pendingChainMove;
        this._pendingChainMove = null;
        const freshTarget = players.find(p => !p.isBoss && p.health > 0);
        if (freshTarget) {
          const fired = this._doSpecial(cm.move, freshTarget);
          // Give the boss's locked attack state time to clear before retrying
          if (!fired) tfAttackRetryQueue.push({ ctx: this, move: cm.move, targetRef: freshTarget, source: 'chain', framesLeft: 18, attempts: 0 });
          return;
        }
      }
    }

    // Floor-removal countdown — handled per-frame in smb-loop.js (updateTFFloorTimer)

    const t = this.target;
    if (!t || t.health <= 0) return;

    // ── Adaptive AI: track player profile every tick ──────────────────────
    this._trackPlayerProfile(t);
    // Recalculate behavior parameters every _adaptBehaviorCd ticks
    if (this._adaptBehaviorCd > 0) { this._adaptBehaviorCd--; }
    else { this._adaptBehaviorCd = 12; this._adaptBehavior(); }

    const dx  = t.cx() - this.cx();
    const d   = Math.abs(dx);
    const dir = dx > 0 ? 1 : -1;
    this._trackRangedAbuse(t, d);
    const spd = phase === 3 ? this._tfSpeed * 1.25 : phase === 2 ? this._tfSpeed * 1.12 : this._tfSpeed;

    this.facing = dir;

    // --- Player intelligence: detect still-standing / edge / airborne / fleeing ---
    const playerMoved = Math.abs(t.cx() - this._lastTargetX) > 8;
    this._stillTimer  = playerMoved ? 0 : this._stillTimer + 1;
    this._lastTargetX = t.cx();
    // Rolling vx history for calcStrike accuracy tier
    this._prevTargetVxArr.push(t.vx);
    if (this._prevTargetVxArr.length > 10) this._prevTargetVxArr.shift();

    const dx_  = t.cx() - this.cx();
    const playerFleeing = (dx_ < 0 && t.vx < -1) || (dx_ > 0 && t.vx > 1);
    const playerFar = Math.abs(dx_) > 280;
    this._runAwayTicks = (playerFleeing && playerFar) ? this._runAwayTicks + 1
                                                       : Math.max(0, this._runAwayTicks - 2);

    // ── TrueForm is MORE aggressive than Creator: shorter specials window ─
    // Force special every 7/5/4 idle ticks vs Creator's longer interval
    this._idleTicks++;
    const burstActive  = this._aggressionBurstTimer > 0;
    // Adaptive special frequency: grows with adaptationLevel (range 0→+0.12 bonus)
    const _alBonus = (this.adaptationLevel / 100) * 0.12;
    const specialFreq  = burstActive
      ? (phase === 3 ? 0.70 : phase === 2 ? 0.58 : 0.48) + _alBonus
      : (phase === 3 ? 0.45 : phase === 2 ? 0.40 : 0.36) + _alBonus * 0.6;
    // Force-special idle threshold shrinks with adaptation (max patience at 0→min at 100)
    const _idleThreshold = Math.max(4, (this._desperationMode ? 4 : phase === 3 ? 6 : 8) - Math.round((this.adaptationLevel / 100) * 3));
    const forceSpecial = this._idleTicks >= _idleThreshold;
    if (forceSpecial || Math.random() < specialFreq) {
      const move = this._selectWeightedSpecial(phase, t);
      if (move) {
        this._idleTicks     = 0;
        this._noActionTicks = 0;
        this._doSpecial(move, t);
        // ── Attack chaining: queue a follow-up melee 0.4s later ──────────
        const chainChance = phase === 3 ? 0.65 : phase === 2 ? 0.40 : 0.20;
        if (!this._pendingChainMove && Math.random() < chainChance) {
          const followMoves = ['slash', 'grasp', 'calcStrike'];
          const followMove  = followMoves.find(m => this[`_${m}Cd`] <= 3) || null;
          if (followMove) {
            this._pendingChainMove = { move: followMove, delay: Math.round(8 + Math.random() * 6) };
          }
        }
        return;
      }
      if (forceSpecial) {
        this._idleTicks = 5;
        // If still no special available, trigger bare aggression burst + direct melee
        if (this._stillTimer > 10 && this._aggressionBurstTimer <= 0) {
          this._aggressionBurstTimer = 6;
          showBossDialogue(randChoice(['Stillness won\'t protect you.', 'I see you.', 'Move. I\'m getting bored.', 'You\'re not hiding. You\'re waiting to lose.']), 120);
        }
        // Force a melee combo burst when idle too long
        if (d < 100 && this.cooldown <= 0) {
          this.attack(t);
          this._noActionTicks = 0;
        }
      }
    }

    // --- Movement: chase at elevated pressure ---
    if (tfFloorRemoved && !this.onGround) {
      if (this.y + this.h > 430 && this.vy > 0) this.vy = -14;
    }

    // Phase 3: shorter minimum engagement distance (gets in your face)
    const _vsRanged = !!(t.weapon && t.weapon.type === 'ranged');
    const _kiteRun  = _vsRanged && Math.sign(t.vx || 0) === Math.sign(t.cx() - this.cx()) && Math.abs(t.vx || 0) > 1.6;
    const antiRangeActive = this._antiRangedTimer > 0;
    const minDist = antiRangeActive ? 18 : (_vsRanged ? (phase === 3 ? 28 : 42) : (phase === 3 ? 40 : 55));
    const backDist = antiRangeActive ? 0 : (phase === 3 ? 22 : 30);
    if (antiRangeActive) {
      if (d > minDist) this.vx = dir * spd * (_vsRanged ? (_kiteRun ? 1.72 : 1.50) : 1.34);
      else this.vx *= 0.94;
      if (this._antiRangedDashCd <= 0 && d > 150) {
        this._antiRangedDashCd = 78;
        const useTeleportCloser = d > 240 && !this._tfAttackState.locked && Math.random() < 0.35;
        if (useTeleportCloser) {
          const closer = _bossTeleportActor(this, t.cx() - dir * 34, t.y, { preferRaised: true, sideBias: -dir });
          if (closer) {
            screenShake = Math.max(screenShake, 10);
            spawnParticles(this.cx(), this.cy(), '#8844ff', 10);
            spawnParticles(this.cx(), this.cy(), '#ffffff', 6);
            this._setAttackPhase('active', 4, true);
            if (this.cooldown <= 0 && d < 180) this.attack(t);
          } else {
            this.vx = dir * spd * 2.05;
          }
        } else {
          this.vx = dir * spd * 2.25;
          if (this.onGround && d > 210) this.vy = -15;
        }
      }
    } else if (d > minDist) {
      this.vx = dir * spd * (_vsRanged ? (_kiteRun ? 1.28 : 1.14) : 1.0);
    } else if (d < backDist) {
      this.vx = -dir * spd * 0.45;
    }

    // Jump to chase if target is above — more aggressive vertical pursuit
    if (t.y < this.y - 40 && this.onGround) this.vy = phase === 3 ? -18 : -16;
    if (!this.onGround && this.canDoubleJump && t.y < this.y - 20 && this.vy > -2 && Math.random() < 0.55) {
      this.vy = -16; this.canDoubleJump = false;
    }
    // Edge avoidance
    const nearLeft  = this.x < 90;
    const nearRight = this.x + this.w > GAME_W - 90;
    if (nearLeft && dir < 0) this.vx = spd * 0.6;
    if (nearRight && dir > 0) this.vx = -spd * 0.6;

    // --- Dodge incoming attacks (never 2 in a row) ---
    if (this._justDodged) {
      this._dodgeTimer++;
      if (this._dodgeTimer > 55) { this._justDodged = false; this._dodgeTimer = 0; }
    } else {
      const attacker = players.find(p => !p.isBoss && p.attackTimer > 0 && dist(this, p) < 85);
      if (attacker) {
        const dodgeChance = Math.min(0.80, this._adaptDodge * (phase === 3 ? 2.0 : phase === 2 ? 1.5 : 1.0));
        if (Math.random() < dodgeChance) {
          const awayDir = this.cx() > attacker.cx() ? 1 : -1;
          this.vx = awayDir * spd * 4.2;
          if (this.onGround && Math.random() < 0.60) this.vy = -14;
          this.invincible = Math.max(this.invincible, 20);
          this._justDodged = true;
          this._dodgeTimer = 0;
          spawnParticles(this.cx(), this.cy(), '#000000', 10);
          spawnParticles(this.cx(), this.cy(), '#ffffff', 5);
          // Counter-attack immediately after dodge in phase 2/3
          if (phase >= 2 && d < 85 && Math.random() < 0.55 && this.cooldown <= 0) {
            setTimeout(() => { if (this.health > 0) this.attack(t); }, 80);
          }
        }
      }
    }

    // --- Attack: frequency driven by adaptive behavior multiplier ────────
    const atkFreq = Math.min(antiRangeActive ? 0.62 : 0.44, this._adaptAtkFreq * (antiRangeActive ? 2.8 : (phase === 3 ? 2.2 : phase === 2 ? 1.5 : 1.0)));
    if (d < this._adaptSpacing + 20 && Math.random() < atkFreq && this.cooldown <= 0) {
      this.attack(t); this._noActionTicks = 0;
    }
    // Second hit of a combo when very close (area control)
    const atkFreq2 = Math.min(antiRangeActive ? 0.38 : 0.28, (this._adaptAtkFreq * 0.6) * (antiRangeActive ? 2.4 : (phase === 3 ? 2.0 : phase === 2 ? 1.4 : 0.9)));
    if (d < 48 && Math.random() < atkFreq2 && this.cooldown <= 0) {
      this.attack(t); this._noActionTicks = 0;
    }
    // High adaptation bonus: pressure hit at medium range
    if (this.adaptationLevel >= 50 && d < (antiRangeActive ? 125 : 95) && Math.random() < (antiRangeActive ? 0.22 : 0.08) + (this.adaptationLevel / 100) * 0.08 && this.cooldown <= 0) {
      this.attack(t);
    }

    // ── Proximity-melee guarantee ─────────────────────────────────────────
    // If player is within reach and boss hasn't attacked, always strike — no passive standing
    if (d < 70 && this.cooldown <= 0 && !this._tfAttackState.locked) {
      this.attack(t);
      this._noActionTicks = 0;
    }
    // Approach guarantee: boss always moves toward player when no special was just used
    if (d > 80 && Math.abs(this.vx) < 0.5) {
      this.vx = dir * this._tfSpeed * 0.8;
    }
  }

  _selectWeightedSpecial(phase, target) {
    const d          = dist(this, target);
    const playerEdge = target.x < 130 || target.x + target.w > GAME_W - 130;
    const playerAir  = !target.onGround;
    const playerRanged = !!(target.weapon && target.weapon.type === 'ranged');
    const playerKiting = playerRanged && Math.sign(target.vx || 0) === Math.sign(target.cx() - this.cx()) && Math.abs(target.vx || 0) > 1.6;
    const hpPct      = target.health / target.maxHealth;
    const w          = {};

    const al = this.adaptationLevel;

    // ── TIER 0 — Always available ─────────────────────────────────────────
    if (this._slashCd  <= 0) w.slash  = 0.20;
    if (this._meteorCd <= 0) w.meteor = 0.16;
    if (this._portalCd <= 0) w.portal = 0.12;
    if (this._holeCd   <= 0) w.holes  = 0.09;
    if (this._warpCd   <= 0) w.warp   = 0.04;

    // ── TIER 1 — Unlocks at AL 25 ────────────────────────────────────────
    if (al >= 25) {
      if (this._shockwaveCd <= 0) w.shockwave = 0.14;
      if (this._sizeCd      <= 0) w.size      = 0.07;
      if (this._invertCd    <= 0) w.invert    = 0.10;   // gravity inversion early access
      if (this._phaseShiftCd <= 0 && !tfPhaseShift) w.phaseShift = 0.11;
      // Early calcStrike access (lower weight until tier 2)
      if (this._calcStrikeCd <= 0 && !tfCalcStrike) w.calcStrike = 0.08;
      // Early gravity inversion field
      if (this._gravityCd <= 0) w.gravity = 0.07;
    }

    // ── TIER 2 — Unlocks at AL 40 (or HP phase 2 as fallback) ────────────
    const _tier2 = al >= 40 || phase >= 2;
    if (_tier2) {
      if (this._wellCd        <= 0)               w.well        = al >= 40 ? 0.16 : 0.10;
      if (this._calcStrikeCd  <= 0 && !tfCalcStrike)  w.calcStrike  = al >= 40 ? 0.18 : 0.10;  // boosted
      if (this._realityTearCd <= 0 && !tfRealityTear) w.realityTear = al >= 40 ? 0.10 : 0.05;
      if (this._floorCd       <= 0 && !tfFloorRemoved) w.floor      = al >= 40 ? 0.14 : 0.08;  // boosted — lava/void hazard
      if (this._gravityCd     <= 0) w.gravity = al >= 40 ? 0.13 : 0.08;  // gravity inversion accessible here
    }
    if (al >= 40 && this._gammaBeamCd <= 0 && !tfGammaBeam) w.gammaBeam = 0.14;  // boosted

    // ── TIER 3 — Unlocks at AL 60 (or HP phase 2/3 as fallback) ─────────
    const _tier3early = al >= 60;
    if (_tier3early || phase >= 2) {
      if (this._cloneCd   <= 0) w.clones  = _tier3early ? 0.14 : 0.07;
      // teleportCombo and multiverseFracture accessible from phase 2 (not locked to tier 4)
      if (this._teleportComboCd <= 0) w.teleportCombo    = _tier3early ? 0.18 : 0.09;  // early access
      if (this._multiverseCd    <= 0 && !tfMultiverse) w.multiverseFracture = _tier3early ? 0.12 : 0.06;  // early access
    }
    if (_tier3early || phase >= 3) {
      if (this._graspCd <= 0) w.grasp = _tier3early ? 0.22 : 0.12;
      if (this._chainCd <= 0) w.chain = _tier3early ? 0.18 : 0.10;
      if (this._neutronStarCd <= 0 && !tfNeutronStar) w.neutronStar = _tier3early ? 0.10 : 0.05;
    }

    // ── TIER 4 — Unlocks at AL 75 (or HP phase 3 as fallback) ────────────
    const _tier4 = al >= 75;
    if (_tier4 || phase >= 3) {
      if (this._teleportComboCd <= 0) w.teleportCombo      = _tier4 ? 0.24 : 0.14;  // boosted
      if (this._gravityCrushCd  <= 0) w.gravityCrush       = _tier4 ? 0.16 : 0.08;
      if (this._galaxySweepCd   <= 0 && !tfGalaxySweep)  w.galaxySweep        = _tier4 ? 0.10 : 0.05;
      if (this._multiverseCd    <= 0 && !tfMultiverse)   w.multiverseFracture = _tier4 ? 0.16 : 0.08;  // boosted
    }
    if (phase === 2 && !_tier4 && this._gravityCrushCd <= 0) w.gravityCrush = 0.07;  // slightly boosted
    if (_tier4) {
      if ((phase >= 3 || this._desperationMode) && this._realityOverrideCd <= 0 && !tfRealityOverride) w.realityOverride = 0.16;
      if ((phase >= 3 || this._desperationMode) && this._collapseStrikeCd  <= 0) w.collapseStrike  = 0.13;
      if (phase >= 2 && this._grabCinCd <= 0 && !activeCinematic) w.grabCinematic = 0.07;
      if (phase >= 2 && this._dimensionCd <= 0) w.dimension = 0.09;
    }

    // ── TIER 5 — Unlocks at AL 90 ────────────────────────────────────────
    if (al >= 90 && this._supernovaCd <= 0 && !tfSupernova && this.health / this.maxHealth < 0.25) {
      w.supernova = 0.28;
    } else if (al < 90 && this._supernovaCd <= 0 && !tfSupernova && this.health / this.maxHealth < 0.18) {
      w.supernova = 0.12; // fallback at very low HP even without full adaptation
    }

    // ── DEPTH PHASE — Z-axis attacks (only when depth phase is active) ───────
    if (typeof tfDepthPhaseActive !== 'undefined' && tfDepthPhaseActive &&
        typeof tfDepthEnabled !== 'undefined' && tfDepthEnabled) {
      // Phase Shift Strike: TF shifts Z layer before attacking
      if (this._depthPhaseShiftCd <= 0) w.depthPhaseShift = 0.30;
      // Multi-Layer Fake: spawn afterimages at different Z values
      if (this._depthLayerFakeCd  <= 0) w.depthLayerFake  = 0.22;
      // Depth Punish: punish player who stays in same Z > 120 frames
      const _pi = players.findIndex(p => !p.isBoss && p.health > 0);
      const _pz = typeof tfDepthPlayerStillZ !== 'undefined' && tfDepthPlayerStillZ[_pi];
      if (this._depthPunishCd <= 0 && _pz && _pz.frames >= 120) w.depthPunish = 0.40;
      // Suppress regular non-Z specials during depth phase to emphasise the system
      for (const k of Object.keys(w)) {
        if (!k.startsWith('depth')) w[k] *= 0.35;
      }
    }

    // ── Distance zone modifiers ───────────────────────────────
    const closeDist = d < 100;
    const medDist   = d >= 100 && d < 260;
    const farDist   = d >= 260;

    if (closeDist) {
      if (w.chain)     w.chain     = (w.chain     || 0) * 2.2;
      if (w.grasp)     w.grasp     = (w.grasp     || 0) * 2.0;
      if (w.shockwave) w.shockwave = (w.shockwave || 0) * 1.6;
    }
    if (medDist) {
      if (w.well)      w.well      = (w.well      || 0) * 2.0;
      if (w.shockwave) w.shockwave = (w.shockwave || 0) * 2.2;
      if (w.holes)     w.holes     = (w.holes     || 0) * 1.5;
    }
    if (farDist) {
      if (w.meteor)    w.meteor    = (w.meteor    || 0) * 2.8;
      if (w.slash)     w.slash     = (w.slash     || 0) * 2.2;
      if (w.warp)      w.warp      = (w.warp      || 0) * 2.0;
    }

    // ── Situational boosts ────────────────────────────────────
    // Player standing still → teleport behind them
    if (this._stillTimer > 8) {
      if (w.slash)  w.slash  = (w.slash  || 0) * 2.2;
      if (w.portal) w.portal = (w.portal || 0) * 2.2;
      if (w.grasp)  w.grasp  = (w.grasp  || 0) * 1.6;
    }
    // Player running away → intercept with meteor or slash
    if (this._runAwayTicks > 5) {
      if (w.meteor) w.meteor = (w.meteor || 0) * 3.0;
      if (w.slash)  w.slash  = (w.slash  || 0) * 2.5;
    }
    if (playerRanged) {
      if (w.portal)        w.portal        = (w.portal        || 0) * 2.8;
      if (w.slash)         w.slash         = (w.slash         || 0) * 1.9;
      if (w.grasp)         w.grasp         = (w.grasp         || 0) * 1.8;
      if (w.teleportCombo) w.teleportCombo = (w.teleportCombo || 0) * 2.1;
      if (w.phaseShift)    w.phaseShift    = (w.phaseShift    || 0) * 1.6;
      if (w.gammaBeam)     w.gammaBeam     = (w.gammaBeam     || 0) * 1.4;
    }
    if (playerKiting) {
      if (w.portal)        w.portal        = (w.portal        || 0) * 3.2;
      if (w.teleportCombo) w.teleportCombo = (w.teleportCombo || 0) * 2.6;
      if (w.gravityCrush)  w.gravityCrush  = (w.gravityCrush  || 0) * 1.8;
      if (w.calcStrike)    w.calcStrike    = (w.calcStrike    || 0) * 1.8;
    }
    if (this._antiRangedTimer > 0) {
      if (w.portal)             w.portal             = (w.portal             || 0) * 1.45;
      if (w.slash)              w.slash              = (w.slash              || 0) * 1.35;
      if (w.gravityCrush)       w.gravityCrush       = (w.gravityCrush       || 0) * 1.35;
      if (w.phaseShift)         w.phaseShift         = (w.phaseShift         || 0) * 1.15;
      if (w.calcStrike)         w.calcStrike         = (w.calcStrike         || 0) * 1.55;
      delete w.gammaBeam;
      delete w.teleportCombo;
      delete w.warp;
    }
    // Player near arena edge → pull with gravity well / crush
    if (playerEdge) {
      if (w.well)          w.well          = (w.well          || 0) * 2.2;
      if (w.grasp)         w.grasp         = (w.grasp         || 0) * 1.6;
      if (w.shockwave)     w.shockwave     = (w.shockwave     || 0) * 1.4;
      if (w.gravityCrush)  w.gravityCrush  = (w.gravityCrush  || 0) * 2.2;
    }
    // Player standing still → teleport combo
    if (this._stillTimer > 6 && w.teleportCombo) {
      w.teleportCombo = (w.teleportCombo || 0) * 2.8;
    }
    // Player airborne → slam them down
    if (playerAir) {
      if (w.meteor)    w.meteor    = (w.meteor    || 0) * 1.8;
      if (w.well)      w.well      = (w.well      || 0) * 1.5;
      if (w.shockwave) w.shockwave = (w.shockwave || 0) * 1.3;
    }
    // Player nearly dead → finishing moves
    if (hpPct < 0.25) {
      if (w.grasp) w.grasp = (w.grasp || 0) * 1.8;
      if (w.chain) w.chain = (w.chain || 0) * 1.8;
    }
    // Dimensional attack situational boosts
    if (this._stillTimer > 6 && w.calcStrike)  w.calcStrike  *= 2.4; // standing still = easy to predict
    if (farDist  && w.realityTear) w.realityTear *= 2.0; // far away = tear pulls them in
    if (closeDist && w.phaseShift) w.phaseShift  *= 1.8; // close = phase shift to reposition
    // (Phase 3 / desperation / cosmic attacks are now gated via tier system above)
    // Situational boosts for cosmic attacks
    if (farDist  && w.gammaBeam)   w.gammaBeam    *= 2.2; // beam crosses full map
    if (playerAir && w.neutronStar) w.neutronStar  *= 1.8; // gravity hurts airborne players more
    if (medDist  && w.galaxySweep) w.galaxySweep  *= 1.6;
    if (this._stillTimer > 6 && w.multiverseFracture) w.multiverseFracture *= 2.0;
    // Desperation: boost all finishing moves
    if (this._desperationMode) {
      if (w.grasp)           w.grasp           *= 1.5;
      if (w.chain)           w.chain           *= 1.6;
      if (w.realityOverride) w.realityOverride *= 2.0;
      if (w.collapseStrike)  w.collapseStrike  *= 1.8;
      if (w.calcStrike)      w.calcStrike      *= 1.4;
      if (w.supernova)       w.supernova       *= 1.5;
    }

    // ── Adaptive profile-driven boosts ───────────────────────
    // Jump-heavy player → anti-air priority
    if (this._profile.jumpFrequency > 0.8) {
      if (w.meteor)  w.meteor  = (w.meteor  || 0) * (1 + this._profile.jumpFrequency * 0.8);
      if (w.well)    w.well    = (w.well    || 0) * (1 + this._profile.jumpFrequency * 0.6);
    }
    // Aggressive player → prioritize evasion + counter
    if (this._profile.attackFrequency > 1.2) {
      if (w.phaseShift) w.phaseShift = (w.phaseShift || 0) * 1.8;
      if (w.portal)     w.portal     = (w.portal     || 0) * 1.5;
    }
    // Defensive/block-heavy player → break through
    if (this._profile.blockFrequency > 0.6) {
      if (w.grasp)  w.grasp  = (w.grasp  || 0) * 1.8;
      if (w.meteor) w.meteor = (w.meteor || 0) * 1.4;
    }
    // Predictable player → prediction-based attacks
    if (this._profile.repetitionScore > 0.5 && al >= 40) {
      if (w.calcStrike) w.calcStrike = (w.calcStrike || 0) * (1 + this._profile.repetitionScore * 2.0);
      if (w.slash)      w.slash      = (w.slash      || 0) * (1 + this._profile.repetitionScore * 1.2);
    }

    // ── Melee vs multiversal balance (60/40 split) ────────────
    // Melee-class specials: direct physical contact or close-range attacks
    const MELEE_CLASS = new Set(['slash','grasp','chain','calcStrike','shockwave','collapseStrike','phaseShift']);
    // Multiversal cooldown: when active, suppress all non-melee specials
    if (this._multiversalGroupCd > 0) {
      for (const key of Object.keys(w)) {
        if (!MELEE_CLASS.has(key)) delete w[key];
      }
    }
    // Close range: force melee-class (boost 4×, suppress multiversal 0.2×)
    if (d < 120) {
      for (const key of Object.keys(w)) {
        if (MELEE_CLASS.has(key)) w[key] *= 4.0;
        else w[key] *= 0.2;
      }
    }
    // Combo chain enforcement: melee→melee→special pattern
    // After fewer than 2 consecutive melee-class specials, strongly prefer melee
    if (this._consecutiveMeleeCount < 2) {
      for (const key of Object.keys(w)) {
        if (MELEE_CLASS.has(key)) w[key] *= 2.5; // 60% bias toward melee
        else w[key] *= 0.4;                       // suppress multiversal until combo built
      }
    }

    // ── Anti-repeat ───────────────────────────────────────────
    delete w[this._lastSpecial];
    delete w[this._lastLastSpecial];

    const entries = Object.entries(w);
    if (!entries.length) return null;
    const total = entries.reduce((s, [, v]) => s + v, 0);
    let r = Math.random() * total;
    for (const [key, v] of entries) { r -= v; if (r <= 0) return key; }
    return entries[entries.length - 1][0];
  }


  // ── Player pattern tracking — called every AI tick ────────────────────────
  _trackPlayerProfile(t) {
    this._adaptProfileTick++;
    const prev = this._prevTState;

    // Detect new attack (rising edge)
    if (t.attackTimer > 0 && !prev.attacking) this._rawAtks++;
    // Detect jump (rising edge off ground)
    if (!t.onGround && prev.onGround) this._rawJumps++;
    // Detect shield activation
    if (t.shielding && !prev.shielding) this._rawBlocks++;
    // Detect dodge (rapid direction change while moving)
    if (Math.abs(t.vx) > 3 && Math.sign(t.vx) !== Math.sign(prev.vx || 0)) this._rawDodges++;

    // Rolling distance sample
    const d = Math.hypot(t.cx() - this.cx(), t.cy() - this.cy());
    this._distSamples.push(d);
    if (this._distSamples.length > 30) this._distSamples.shift();

    // Save state for next tick
    this._prevTState = { attacking: t.attackTimer > 0, onGround: t.onGround, shielding: t.shielding, vx: t.vx };

    // Every 8 AI ticks (~2 seconds) — commit profile snapshot and grow adaptationLevel
    if (this._adaptProfileTick >= 8) {
      this._adaptProfileTick = 0;
      const R = 0.3; // smoothing factor
      this._profile.attackFrequency  = lerp(this._profile.attackFrequency,  this._rawAtks   / 8, R);
      this._profile.jumpFrequency    = lerp(this._profile.jumpFrequency,    this._rawJumps  / 8, R);
      this._profile.dodgeFrequency   = lerp(this._profile.dodgeFrequency,   this._rawDodges / 8, R);
      this._profile.blockFrequency   = lerp(this._profile.blockFrequency,   this._rawBlocks / 8, R);
      this._rawAtks = this._rawJumps = this._rawDodges = this._rawBlocks = 0;

      if (this._distSamples.length > 0) {
        const avgDist = this._distSamples.reduce((a, b) => a + b, 0) / this._distSamples.length;
        this._profile.distancePreference = lerp(this._profile.distancePreference, avgDist, 0.25);
      }

      // Repetition score: low vx variance = predictable player
      if (this._prevTargetVxArr.length >= 6) {
        const avg = this._prevTargetVxArr.reduce((a, b) => a + b, 0) / this._prevTargetVxArr.length;
        const variance = this._prevTargetVxArr.reduce((s, v) => s + (v - avg) ** 2, 0) / this._prevTargetVxArr.length;
        this._profile.repetitionScore = lerp(this._profile.repetitionScore, Math.max(0, 1 - variance / 30), 0.2);
      }

      // Base adaptation growth: 1.5 per cycle = ~67 cycles (~134s) to reach 100
      this.adaptationLevel = Math.min(100, this.adaptationLevel + 1.5);
      // Bonus growth when player is highly predictable
      if (this._profile.repetitionScore > 0.6) this.adaptationLevel = Math.min(100, this.adaptationLevel + 0.8);

      // Update visual evolution state
      const al = this.adaptationLevel;
      this._adaptOrbitMult = 1.0 + (al / 100) * 1.4;
      this._adaptGlowBoost = al / 100;
      this._adaptFlicker   = Math.max(0, (al - 68) / 32);

      this._checkAdaptDialogue();
    }
  }

  // ── Behavior recalculation — called every _adaptBehaviorCd AI ticks ───────
  _adaptBehavior() {
    const p  = this._profile;
    const al = this.adaptationLevel;
    const R  = 0.10; // max change per recalculation (gradual drift)

    // High attack frequency → dodge and counter more
    if (p.attackFrequency > 1.2) {
      this._adaptDodge = Math.min(0.75, this._adaptDodge + R * 0.35);
    }
    // Block-heavy player → get more aggressive, close the gap
    if (p.blockFrequency > 0.7 || p.distancePreference > 230) {
      this._adaptAtkFreq = Math.min(0.44, this._adaptAtkFreq + R * 0.18);
      this._adaptSpacing = Math.max(32, this._adaptSpacing - R * 4);
    }
    // Passive/stand-off player → apply pressure
    if (p.attackFrequency < 0.3 && p.dodgeFrequency < 0.3) {
      this._adaptAtkFreq = Math.min(0.44, this._adaptAtkFreq + R * 0.12);
      this._adaptSpacing = Math.max(32, this._adaptSpacing - R * 8);
    }
    // Jump-heavy player → reduce preferred distance (gets under them)
    if (p.jumpFrequency > 1.0) {
      this._adaptSpacing = Math.max(32, this._adaptSpacing - R * 6);
    }

    // Predictable player → faster reactions (reads them)
    const reactTarget = Math.max(0, Math.round(3 - p.repetitionScore * 2.8));
    this._adaptReact = Math.round(lerp(this._adaptReact, reactTarget, 0.2));

    // Flat adaptation-level bonuses (slow continuous drift upward)
    const alT = al / 100;
    this._adaptAtkFreq = Math.min(0.44, this._adaptAtkFreq + alT * 0.0025);
    this._adaptDodge   = Math.min(0.75, this._adaptDodge   + alT * 0.0018);
  }

  // ── Adaptation milestone dialogue ─────────────────────────────────────────
  _checkAdaptDialogue() {
    const al = this.adaptationLevel;
    const milestones = [
      [20,  'I\'m starting to understand you.'],
      [40,  'A pattern. You have one.'],
      [60,  'You\'re readable now.'],
      [80,  'I\'m a step ahead. Maybe two.'],
      [95,  'There\'s nothing left to learn from you.'],
    ];
    for (const [threshold, text] of milestones) {
      if (al >= threshold && !this._adaptDialogueFired.has(threshold)) {
        this._adaptDialogueFired.add(threshold);
        showBossDialogue(text, 240);
        if (al >= 60) screenShake = Math.max(screenShake, 14);
        spawnParticles(this.cx(), this.cy(), al >= 80 ? '#ffffff' : '#8800ff', 20);
        return; // only one milestone per cycle
      }
    }
  }

  draw() {
    if (this.backstageHiding) return;
    if (this.health <= 0 && this.ragdollTimer <= 0) return;

    // ════════════════════════════════════════════════════════════════════════
    // TRUE FORM — FRAGMENTED COSMIC ENTITY RENDERER
    // ════════════════════════════════════════════════════════════════════════
    // Architecture: 7 draw layers, each independent:
    //   L0  Outer void nebula (far background glow)
    //   L1  Reality-tear trails (motion distortion)
    //   L2  Orbiting fragment ring  (3 rings, counter-rotating)
    //   L3  Body segments — DETACHED: legs, torso, arms, head (all floating)
    //   L4  Core singularity (bright anchor point)
    //   L5  Inner eye + void pupils
    //   L6  HP bar
    //
    // To tweak intensity: adjust _TF_AURA_SCALE, _TF_ORBIT_SCALE, _TF_DRIFT
    // ════════════════════════════════════════════════════════════════════════

    // Adaptation-driven visual evolution
    const _alT = (this.adaptationLevel || 0) / 100;
    const _TF_AURA_SCALE  = 1.0 + _alT * 0.45;   // aura swells as boss adapts
    const _TF_ORBIT_SCALE = this._adaptOrbitMult || 1.0; // orbit speeds up
    const _TF_DRIFT       = 1.0 + _alT * 0.6;    // segment drift increases

    // ── Global time & phase ─────────────────────────────────────────────────
    this._floatT += 0.042;
    const T  = this._floatT;
    const hpPct  = this.health / this.maxHealth;
    const phase  = this.getPhase ? this.getPhase() : 1;
    // Rage factor 0→1: increases with phase, maxes at phase 3
    const rage   = Math.min(1, (3 - hpPct * 3) / 2);  // 0 at full HP, 1 at 33% HP

    // Core anchor — hitbox center, floats vertically
    const cx   = this.cx();
    const coreY = this.y + this.h * 0.5 + Math.sin(T * 0.9) * (4 + rage * 6);

    // ── Color palette ────────────────────────────────────────────────────────
    // Low rage + low AL: deep void purple.  High rage: blinding white-blue.
    // High adaptation adds an orange-red accent (heated, dangerous).
    const _adaptHeat = (this._adaptGlowBoost || 0);
    const cR  = Math.round(80  + rage * 175 + _adaptHeat * 60);   // 80 → 315 (clamped)
    const cG  = Math.round(0   + rage * 80  + _adaptHeat * 20);   // 0  → 100
    const cB  = Math.round(255 - rage * 55  - _adaptHeat * 60);   // 255 → 140
    const cRc = Math.min(255, cR);
    const glowColor  = `rgb(${cRc},${cG},${Math.max(0, cB)})`;
    const glowColor2 = `rgb(${Math.round(cRc*0.5)},0,${Math.max(0, cB)})`; // darker variant for trails
    const WHITE = '#ffffff';

    // Invincibility blink — whole entity flickers
    const blinkAlpha = (this.invincible > 0 && Math.floor(this.invincible / 4) % 2 === 1) ? 0.25 : 1.0;

    // Scale pivot (tfDrawScale from size-manipulation special)
    const tfs = (this.tfDrawScale && this.tfDrawScale !== 1) ? this.tfDrawScale : 1;

    // Attack progress 0→1 (used to stretch limbs during attacks)
    const atkP = (this.attackDuration > 0 && this.state === 'attacking')
      ? 1 - this.attackTimer / this.attackDuration : 0;
    const isAttacking = this.state === 'attacking';
    const f = this.facing;

    // ── Per-segment drift offsets (each body part floats independently) ─────
    // These give the detached-fragment feel without extra state.
    // Formula: sin(T * speed + phase_offset) * amplitude
    const dHead  = { x: Math.sin(T * 1.1 + 0.3) * 2.5 * _TF_DRIFT,  y: Math.sin(T * 0.7 + 1.0) * 3.5 * _TF_DRIFT };
    const dTorso = { x: Math.sin(T * 0.5 + 2.1) * 1.5 * _TF_DRIFT,  y: Math.sin(T * 0.8 + 0.5) * 2.0 * _TF_DRIFT };
    const dArmR  = { x: Math.sin(T * 1.3 + 0.8) * 3.0 * _TF_DRIFT,  y: Math.sin(T * 1.0 + 2.3) * 3.5 * _TF_DRIFT };
    const dArmL  = { x: Math.sin(T * 1.2 + 1.6) * 3.0 * _TF_DRIFT,  y: Math.sin(T * 0.9 + 0.1) * 3.5 * _TF_DRIFT };
    const dLegR  = { x: Math.sin(T * 0.8 + 3.1) * 2.5 * _TF_DRIFT,  y: Math.sin(T * 1.1 + 1.4) * 2.5 * _TF_DRIFT };
    const dLegL  = { x: Math.sin(T * 0.9 + 0.4) * 2.5 * _TF_DRIFT,  y: Math.sin(T * 0.8 + 2.7) * 2.5 * _TF_DRIFT };
    // During attacks: arms snap violently toward attack direction
    const atkStretch = isAttacking ? (1 + atkP * 1.6) : 1;

    // Segment position anchors (in game coords, relative to core)
    // DETACHED: there are gaps between each part — they never connect.
    const seg = {
      // Head floats 28px above core, gap of ~6px from torso top
      headX:    cx    + dHead.x  * tfs,
      headY:    coreY - 28 * tfs + dHead.y  * tfs,
      headR:    10    * tfs + Math.sin(T * 2.1) * 1.2,

      // Torso: small rectangular mass centered on core, ±4px gap from head/hip
      torsoX:   cx    + dTorso.x * tfs,
      torsoTop: coreY - 14 * tfs + dTorso.y * tfs,
      torsoBot: coreY +  8 * tfs + dTorso.y * tfs,

      // Arms: attached to torso shoulder level but FLOATING away from it
      // (gap between arm root and torso edge)
      armRootY: coreY - 8 * tfs,

      // Legs: float below hip with 4px gap
      hipY:     coreY + 12 * tfs,
    };

    // ── Ragdoll override: spin all segments together ─────────────────────────
    let ragRot = 0;
    if (this.ragdollTimer > 0) {
      ragRot = this.ragdollAngle * (this.ragdollTimer / 45);
    }

    // ════════════════════════════════════════════════════════════════════════
    // L0 — OUTER VOID NEBULA
    // ════════════════════════════════════════════════════════════════════════
    ctx.save();
    ctx.globalAlpha = blinkAlpha * (0.22 + rage * 0.25);
    if (tfs !== 1) { ctx.translate(cx, coreY); ctx.scale(tfs, tfs); ctx.translate(-cx, -coreY); }

    // Three overlapping radial gradients for depth — each a different size/speed
    const _nebula = (ox, oy, r, alpha, T_mul) => {
      const pulse = 1 + Math.sin(T * T_mul) * 0.12;
      const g = ctx.createRadialGradient(cx + ox, coreY + oy, r * 0.1, cx + ox, coreY + oy, r * pulse * _TF_AURA_SCALE);
      g.addColorStop(0,   `rgba(${cRc},${cG},${Math.max(0,cB)},${alpha * 0.55})`);
      g.addColorStop(0.4, `rgba(${cRc},${cG},${Math.max(0,cB)},${alpha * 0.18})`);
      g.addColorStop(1,   'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(cx + ox, coreY + oy, r * pulse * _TF_AURA_SCALE, 0, Math.PI * 2); ctx.fill();
    };
    _nebula(0,  0,  90, 0.9, 0.8);   // main outer nebula
    _nebula(-8, -5, 60, 0.7, 1.1);   // offset inner bloom
    _nebula(6,  4,  45, 0.6, 1.4);   // tight inner core glow
    // Extra void ring at rage≥0.5 — white-hot inner burn
    if (rage > 0.5) {
      const r2 = (rage - 0.5) * 2;
      _nebula(0, 0, 30, r2 * 0.8, 2.1);
    }
    ctx.restore();

    // ════════════════════════════════════════════════════════════════════════
    // L1 — REALITY TEAR TRAILS
    // ════════════════════════════════════════════════════════════════════════
    // Push trail when moving; draw as jagged void-tears not smooth ghosts
    if (this.state === 'walking' || this.state === 'jumping' || this.state === 'falling') {
      this._trailPts.push({ x: cx, y: coreY, a: 0.55 + rage * 0.2 });
      if (this._trailPts.length > 14) this._trailPts.shift();
    }
    ctx.save();
    for (let i = this._trailPts.length - 1; i >= 0; i--) {
      const tp = this._trailPts[i];
      tp.a -= 0.038;
      if (tp.a <= 0) { this._trailPts.splice(i, 1); continue; }
      const age = 1 - tp.a / 0.75; // 0=fresh → 1=old
      ctx.globalAlpha = tp.a * blinkAlpha;
      ctx.shadowColor = glowColor2;
      ctx.shadowBlur  = 8;
      ctx.strokeStyle = glowColor2;
      ctx.lineWidth   = 1.2 + (1 - age) * 1.5;
      ctx.lineCap     = 'round';
      // Jagged void-tear shape (4-point zigzag)
      const jitter = (1 - age) * 5;
      ctx.beginPath();
      ctx.moveTo(tp.x - 4 + Math.sin(tp.a * 17) * jitter, tp.y - 22 * tfs);
      ctx.lineTo(tp.x + 2 + Math.sin(tp.a * 11) * jitter, tp.y - 10 * tfs);
      ctx.lineTo(tp.x - 3 + Math.sin(tp.a *  7) * jitter, tp.y + 2  * tfs);
      ctx.lineTo(tp.x + 4 + Math.sin(tp.a * 13) * jitter, tp.y + 14 * tfs);
      ctx.stroke();
    }
    ctx.restore();

    // ════════════════════════════════════════════════════════════════════════
    // L2 — ORBITING FRAGMENT RINGS
    // ════════════════════════════════════════════════════════════════════════
    // Ring A: 8 small shards, close orbit, co-rotating
    // Ring B: 5 larger crystal fragments, mid orbit, counter-rotating
    // Ring C: 3 massive chunks, wide orbit, very slow (only at rage > 0.4)
    ctx.save();
    ctx.globalAlpha = blinkAlpha;
    if (tfs !== 1) { ctx.translate(cx, coreY); ctx.scale(tfs, tfs); ctx.translate(-cx, -coreY); }

    const _drawShard = (px, py, size, angle, col, blur) => {
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(angle);
      ctx.shadowColor = col;
      ctx.shadowBlur  = blur;
      // Diamond shard shape
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(0, -size);
      ctx.lineTo(size * 0.5, 0);
      ctx.lineTo(0,  size * 0.6);
      ctx.lineTo(-size * 0.5, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    };

    // Ring A — tight fast orbit (radius 26)
    const rA = (26 + Math.sin(T * 0.7) * 4) * _TF_ORBIT_SCALE;
    for (let i = 0; i < 8; i++) {
      const ang  = T * 1.4 + (i / 8) * Math.PI * 2;
      const px   = cx    + Math.cos(ang) * rA;
      const py   = coreY + Math.sin(ang) * rA * 0.45;
      const sz   = 2.2 + Math.sin(T * 2 + i * 0.78) * 0.8;
      const alpha = 0.55 + Math.sin(T * 1.8 + i) * 0.3;
      ctx.globalAlpha = alpha * blinkAlpha;
      _drawShard(px, py, sz, ang * 2, i % 2 === 0 ? WHITE : glowColor, 6);
    }

    // Ring B — counter-rotating (radius 44)
    const rB = (44 + Math.sin(T * 0.5) * 6) * _TF_ORBIT_SCALE;
    for (let i = 0; i < 5; i++) {
      const ang  = -T * 0.85 + (i / 5) * Math.PI * 2;
      const px   = cx    + Math.cos(ang) * rB;
      const py   = coreY + Math.sin(ang) * rB * 0.38;
      const sz   = 3.8 + Math.sin(T * 1.2 + i * 1.3) * 1.2;
      const alpha = 0.4 + Math.sin(T * 0.9 + i * 1.5) * 0.25;
      ctx.globalAlpha = alpha * blinkAlpha;
      _drawShard(px, py, sz, ang * 1.5, glowColor, 10);
    }

    // Ring C — slow massive chunks at high rage (radius 64)
    if (rage > 0.35) {
      const rC  = (64 + Math.sin(T * 0.3) * 8) * _TF_ORBIT_SCALE;
      const cnt = 3 + Math.floor(rage * 2); // 3→5 chunks
      for (let i = 0; i < cnt; i++) {
        const ang   = T * 0.45 + (i / cnt) * Math.PI * 2;
        const px    = cx    + Math.cos(ang) * rC;
        const py    = coreY + Math.sin(ang) * rC * 0.32;
        const sz    = 5 + rage * 4 + Math.sin(T * 0.8 + i) * 1.5;
        const alpha = (rage - 0.35) * 1.5 * (0.5 + Math.sin(T * 0.6 + i) * 0.3);
        ctx.globalAlpha = Math.min(0.85, alpha) * blinkAlpha;
        ctx.shadowColor = WHITE;
        ctx.shadowBlur  = 14;
        _drawShard(px, py, sz, ang + T * 0.4, WHITE, 14);
      }
    }
    ctx.restore();

    // ════════════════════════════════════════════════════════════════════════
    // L3 — DETACHED BODY SEGMENTS
    // ════════════════════════════════════════════════════════════════════════
    ctx.save();
    ctx.globalAlpha = blinkAlpha;
    if (tfs !== 1) { ctx.translate(cx, coreY); ctx.scale(tfs, tfs); ctx.translate(-cx, -coreY); }
    if (ragRot !== 0) { ctx.translate(cx, coreY); ctx.rotate(ragRot); ctx.translate(-cx, -coreY); }

    const segGlow = 11 + Math.sin(T * 2.8) * 4 + rage * 8;  // increases with rage
    ctx.shadowColor = glowColor;
    ctx.shadowBlur  = segGlow;
    ctx.strokeStyle = WHITE;
    ctx.fillStyle   = '#000000';
    ctx.lineWidth   = 2.4;
    ctx.lineCap     = 'round';
    ctx.lineJoin    = 'round';

    // ── ARM geometry ─────────────────────────────────────────────────────────
    // Base angles from state, then stretched/distorted during attacks
    let rAng, lAng;
    if (this.state === 'ragdoll') {
      const fl = Math.sin(this.animTimer * 0.38) * 1.4;
      rAng = ragRot * 1.2 + fl;
      lAng = ragRot * 1.2 + Math.PI - fl;
    } else if (this.state === 'stunned') {
      rAng = Math.PI * 0.8; lAng = Math.PI * 0.2;
    } else if (isAttacking) {
      if (this._attackMode === 'punch') {
        if (f > 0) { rAng = lerp(-0.2, 0.1, atkP);  lAng = lerp(Math.PI * 0.75, Math.PI * 0.6, atkP); }
        else       { rAng = lerp(Math.PI + 0.2, Math.PI - 0.1, atkP); lAng = lerp(Math.PI * 0.25, Math.PI * 0.4, atkP); }
      } else { // kick — arms thrown wide
        rAng = f > 0 ? -0.65 : Math.PI + 0.65;
        lAng = f > 0 ?  Math.PI * 0.7  : Math.PI * 0.3;
      }
    } else if (this.state === 'walking') {
      const sw = Math.sin(this.animTimer * 0.24) * 0.55;
      rAng = Math.PI * 0.58 + sw; lAng = Math.PI * 0.42 - sw;
    } else if (this.state === 'jumping' || this.state === 'falling') {
      rAng = -0.28; lAng = Math.PI + 0.28;
    } else {
      rAng = Math.PI * 0.6; lAng = Math.PI * 0.4;
    }
    // Arm length stretches during attacks (cosmic elastic effect)
    const armBase = 22;
    const armLen  = isAttacking ? armBase * (1 + atkP * 0.85) : armBase;

    // Arms DETACHED: origin is floating arm-root (not directly connected to torso)
    const armRX = cx    + dArmR.x;
    const armRY = seg.armRootY + dArmR.y + (isAttacking && f > 0 ? atkP * -4 : 0);
    const armLX = cx    + dArmL.x;
    const armLY = seg.armRootY + dArmL.y + (isAttacking && f < 0 ? atkP * -4 : 0);

    const rEx = armRX + Math.cos(rAng) * armLen * atkStretch;
    const rEy = armRY + Math.sin(rAng) * armLen;
    const lEx = armLX + Math.cos(lAng) * armLen * atkStretch;
    const lEy = armLY + Math.sin(lAng) * armLen;

    // Draw arm segments as disconnected jagged lines (not straight strokes)
    const _drawDetachedLimb = (x1, y1, x2, y2, stretch) => {
      // Mid-point drift for organic feel
      const mx  = (x1 + x2) * 0.5 + Math.sin(T * 1.7 + x1 * 0.01) * 3 * stretch;
      const my  = (y1 + y2) * 0.5 + Math.cos(T * 1.3 + y1 * 0.01) * 2 * stretch;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.quadraticCurveTo(mx, my, x2, y2);
      ctx.stroke();
      // GAP: draw a small void circle at each segment root to emphasize disconnection
      ctx.save();
      ctx.globalAlpha *= 0.7;
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#000000';
      ctx.beginPath(); ctx.arc(x1, y1, 3.5, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    };

    _drawDetachedLimb(armRX, armRY, rEx, rEy, isAttacking ? 1.8 : 1);
    _drawDetachedLimb(armLX, armLY, lEx, lEy, isAttacking ? 1.8 : 1);

    // Fist/energy burst at punch impact
    if (isAttacking && this._attackMode === 'punch' && atkP > 0.45) {
      const impactX = f > 0 ? rEx : lEx;
      const impactY = f > 0 ? rEy : lEy;
      ctx.save();
      ctx.globalAlpha = atkP * blinkAlpha;
      ctx.shadowColor = WHITE;
      ctx.shadowBlur  = 18 + atkP * 20;
      // Expanding impact ring
      ctx.strokeStyle = glowColor;
      ctx.lineWidth   = 2;
      ctx.beginPath(); ctx.arc(impactX, impactY, 6 + atkP * 10, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = WHITE;
      ctx.beginPath(); ctx.arc(impactX, impactY, 5.5, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    // ── LEG geometry ─────────────────────────────────────────────────────────
    let rLeg, lLeg;
    if (this.state === 'ragdoll') {
      const lf = Math.sin(this.animTimer * 0.35) * 1.1 + ragRot * 0.8;
      rLeg = Math.PI * 0.5 + lf; lLeg = Math.PI * 0.5 - lf + 0.4;
    } else if (isAttacking && this._attackMode === 'kick') {
      rLeg = f > 0 ? lerp(Math.PI * 0.52, Math.PI * 0.08, atkP) : lerp(Math.PI * 0.48, Math.PI * 0.92, atkP);
      lLeg = Math.PI * 0.52;
    } else if (this.state === 'walking') {
      const sw = Math.sin(this.animTimer * 0.24) * 0.6;
      rLeg = Math.PI * 0.5 + sw; lLeg = Math.PI * 0.5 - sw;
    } else if (this.state === 'jumping') {
      rLeg = Math.PI * 0.32; lLeg = Math.PI * 0.68;
    } else {
      rLeg = Math.PI * 0.55; lLeg = Math.PI * 0.45;
    }
    const legBase = 24;
    const legLen  = isAttacking && this._attackMode === 'kick' ? legBase * (1 + atkP * 0.7) : legBase;

    const legRX = cx    + dLegR.x;
    const legRY = seg.hipY + dLegR.y;
    const legLX = cx    + dLegL.x;
    const legLY = seg.hipY + dLegL.y;

    const rLx = legRX + Math.cos(rLeg) * legLen;
    const rLy = legRY + Math.sin(rLeg) * legLen;
    const lLx = legLX + Math.cos(lLeg) * legLen;
    const lLy = legLY + Math.sin(lLeg) * legLen;

    _drawDetachedLimb(legRX, legRY, rLx, rLy, 1);
    _drawDetachedLimb(legLX, legLY, lLx, lLy, 1);

    // Kick foot energy burst
    if (isAttacking && this._attackMode === 'kick' && atkP > 0.45) {
      const kx = f > 0 ? rLx : lLx;
      const ky = f > 0 ? rLy : lLy;
      ctx.save();
      ctx.globalAlpha = atkP * blinkAlpha;
      ctx.shadowColor = glowColor;
      ctx.shadowBlur  = 16 + atkP * 18;
      ctx.strokeStyle = WHITE;
      ctx.lineWidth   = 2;
      ctx.beginPath(); ctx.arc(kx, ky, 5 + atkP * 8, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }

    // ── TORSO — elongated parallelogram, slightly rotated ───────────────────
    const torsoW = 8 + Math.sin(T * 1.8) * 1.5;
    const torsoH = seg.torsoBot - seg.torsoTop;
    const torsoTilt = Math.sin(T * 0.6) * 0.08 * (isAttacking ? 2 : 1);
    ctx.save();
    ctx.translate(seg.torsoX, seg.torsoTop + torsoH * 0.5 + dTorso.y);
    ctx.rotate(torsoTilt + ragRot);
    ctx.beginPath();
    ctx.rect(-torsoW, -torsoH * 0.5, torsoW * 2, torsoH);
    ctx.fillStyle = '#000000';
    ctx.fill();
    ctx.strokeStyle = WHITE;
    ctx.shadowColor = glowColor;
    ctx.shadowBlur  = segGlow;
    ctx.stroke();
    ctx.restore();

    // ── HEAD — floating above, slightly larger, with void-crack eye sockets ─
    const headX = seg.headX;
    const headY = seg.headY;
    const headR = seg.headR;
    // Head rotates slightly, adds inhuman feel
    const headTilt = Math.sin(T * 0.9 + 1.2) * 0.12;
    ctx.save();
    ctx.translate(headX, headY);
    ctx.rotate(headTilt + ragRot);
    ctx.beginPath();
    ctx.arc(0, 0, headR, 0, Math.PI * 2);
    ctx.fillStyle = '#000000';
    ctx.fill();
    ctx.strokeStyle = WHITE;
    ctx.shadowColor = glowColor;
    ctx.shadowBlur  = segGlow * 1.2;
    ctx.stroke();
    // Void crack — thin diagonal slash through head
    ctx.globalAlpha = 0.35 + rage * 0.4;
    ctx.strokeStyle = glowColor;
    ctx.lineWidth   = 0.8;
    ctx.shadowBlur  = 3;
    ctx.beginPath();
    ctx.moveTo(-headR * 0.6, -headR * 0.4);
    ctx.lineTo( headR * 0.4,  headR * 0.6);
    ctx.stroke();
    ctx.restore();
    // GAP marker below head (void space between head and torso)
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#000000';
    ctx.beginPath(); ctx.arc(seg.headX, (seg.headY + seg.torsoTop + dTorso.y) * 0.5, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    ctx.restore(); // end L3

    // ════════════════════════════════════════════════════════════════════════
    // L4 — CORE SINGULARITY (the actual anchor of the entity)
    // ════════════════════════════════════════════════════════════════════════
    ctx.save();
    ctx.globalAlpha = blinkAlpha;
    if (tfs !== 1) { ctx.translate(cx, coreY); ctx.scale(tfs, tfs); ctx.translate(-cx, -coreY); }

    // Pulsing singularity at the chest level — the "soul" of True Form
    const coreR = Math.max(0.01, (5 + Math.sin(T * 3.1) * 2 + rage * 5) * tfs);
    const coreGrad = ctx.createRadialGradient(cx, coreY, 0, cx, coreY, coreR * 3.5);
    coreGrad.addColorStop(0,   WHITE);
    coreGrad.addColorStop(0.2, glowColor);
    coreGrad.addColorStop(0.6, `rgba(${cR},${cG},${cB},0.4)`);
    coreGrad.addColorStop(1,   'rgba(0,0,0,0)');

    ctx.shadowColor = WHITE;
    ctx.shadowBlur  = 22 + rage * 18;
    ctx.fillStyle   = coreGrad;
    ctx.beginPath(); ctx.arc(cx, coreY, coreR * 3.5, 0, Math.PI * 2); ctx.fill();

    // Solid bright core center
    ctx.shadowBlur  = 30 + rage * 20;
    ctx.fillStyle   = WHITE;
    ctx.beginPath(); ctx.arc(cx, coreY, coreR, 0, Math.PI * 2); ctx.fill();

    // Rotating cross-flare (4 spikes from core, common cosmic motif)
    ctx.globalAlpha = blinkAlpha * (0.5 + rage * 0.4);
    ctx.strokeStyle = WHITE;
    ctx.shadowColor = WHITE;
    ctx.shadowBlur  = 12;
    ctx.lineWidth   = 1.2;
    const flareAng = T * 0.7;
    for (let f2 = 0; f2 < 4; f2++) {
      const fa  = flareAng + f2 * Math.PI * 0.5;
      const fl2 = (12 + rage * 14 + Math.sin(T * 2.2 + f2) * 3) * tfs;
      ctx.beginPath();
      ctx.moveTo(cx, coreY);
      ctx.lineTo(cx + Math.cos(fa) * fl2, coreY + Math.sin(fa) * fl2 * 0.55);
      ctx.stroke();
    }
    ctx.restore();

    // ════════════════════════════════════════════════════════════════════════
    // L5 — VOID EYES (drawn on head in screen-relative space)
    // ════════════════════════════════════════════════════════════════════════
    ctx.save();
    ctx.globalAlpha = blinkAlpha;

    const eyeX   = seg.headX + (this.facing > 0 ? 4 : -4) * tfs;
    const eyeBaseY = seg.headY - 1.5 * tfs;

    // Outer eye glow ring
    ctx.shadowColor = glowColor;
    ctx.shadowBlur  = 10 + rage * 12;
    ctx.strokeStyle = glowColor;
    ctx.lineWidth   = 0.9;
    ctx.beginPath(); ctx.arc(eyeX, eyeBaseY, 3.5 * tfs, 0, Math.PI * 2); ctx.stroke();

    // Inner void pupil — blinking effect: occasionally goes fully black
    const blinkCycle = Math.sin(T * 0.35); // slow blink
    const pupilAlpha = blinkCycle > 0.85 ? Math.max(0, 1 - (blinkCycle - 0.85) * 20) : 1; // fast blink
    ctx.globalAlpha = blinkAlpha * pupilAlpha;
    ctx.shadowColor = WHITE;
    ctx.shadowBlur  = 8;
    ctx.fillStyle   = WHITE;
    ctx.beginPath(); ctx.arc(eyeX, eyeBaseY, 2.2 * tfs, 0, Math.PI * 2); ctx.fill();

    // Second ghost eye (unsettling — offset slightly behind)
    ctx.globalAlpha = blinkAlpha * 0.25 * (1 - pupilAlpha + 0.3);
    ctx.fillStyle   = glowColor;
    ctx.beginPath(); ctx.arc(eyeX - this.facing * 2 * tfs, eyeBaseY + 1 * tfs, 1.8 * tfs, 0, Math.PI * 2); ctx.fill();

    ctx.restore();

    // ════════════════════════════════════════════════════════════════════════
    // L6 — HP BAR (floating above head)
    // ════════════════════════════════════════════════════════════════════════
    ctx.save();
    const barW  = 70, barH = 5;
    const barX  = cx - barW / 2;
    const barY  = this.y - 22 + Math.sin(T * 0.9) * 3; // floats with boss
    ctx.fillStyle = 'rgba(0,0,0,0.85)';
    ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);
    // HP color: white → purple → near-dead flicker
    const hpCol = hpPct > 0.6 ? '#ffffff'
                : hpPct > 0.3 ? glowColor
                : `rgba(${cRc},${cG},${Math.max(0,cB)},${0.6 + Math.sin(T * 8) * 0.4})`;
    ctx.fillStyle = hpCol;
    ctx.shadowColor = hpCol;
    ctx.shadowBlur  = 6;
    ctx.fillRect(barX, barY, barW * hpPct, barH);

    // ── ADAPTATION METER (below HP bar) ──────────────────────────────────
    const al = this.adaptationLevel || 0;
    if (al > 0) {
      const aBarY = barY + barH + 3;
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(barX - 1, aBarY - 1, barW + 2, 4);
      // Color: blue → purple → orange → white
      const aR = Math.round(al < 50 ? 40 + al * 1.2  : 100 + (al - 50) * 3.1);
      const aG = Math.round(al < 75 ? 0   : (al - 75) * 2.4);
      const aB = Math.round(al < 60 ? 255 : Math.max(0, 255 - (al - 60) * 4.5));
      ctx.fillStyle   = `rgb(${Math.min(255,aR)},${Math.min(255,aG)},${Math.min(255,aB)})`;
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur  = 5 + al * 0.05;
      ctx.fillRect(barX, aBarY, barW * (al / 100), 3);

      // Tier label above HP bar
      const tierLabel = al >= 90 ? '◈ PERFECTED'
                      : al >= 75 ? '◈ MASTERED'
                      : al >= 60 ? '◈ EVOLVED'
                      : al >= 40 ? '◈ ADAPTING'
                      : al >= 20 ? '◈ LEARNING'
                      : null;
      if (tierLabel) {
        ctx.globalAlpha = 0.65 + Math.sin(T * 3.0) * 0.20;
        ctx.font        = `bold ${al >= 60 ? 7 : 6}px monospace`;
        ctx.textAlign   = 'center';
        ctx.fillStyle   = `rgb(${Math.min(255,aR)},${Math.min(255,aG)},${Math.min(255,aB)})`;
        ctx.shadowBlur  = 8;
        ctx.fillText(tierLabel, cx, barY - 6);
        ctx.globalAlpha = 1;
      }
    }
    ctx.restore();

    // ── RECOVERY INDICATOR — teaches players when to punish ──────────────
    if (this._tfAttackState?.phase === 'recovery') {
      ctx.save();
      ctx.globalAlpha = 0.25;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 8;
      const _recScale = this.tfDrawScale && this.tfDrawScale !== 1 ? this.tfDrawScale : 1;
      ctx.beginPath();
      ctx.arc(cx, coreY, 40 * _recScale, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // ── HIGH-ADAPTATION INSTABILITY OVERLAY ──────────────────────────────
    // At AL >= 70: subtle reality-crack scan-lines flicker over the entity
    if (_alT >= 0.70) {
      const flickerIntensity = ((_alT - 0.70) / 0.30) * (0.18 + Math.sin(T * 14) * 0.10);
      if (flickerIntensity > 0) {
        ctx.save();
        ctx.globalAlpha = flickerIntensity * blinkAlpha;
        ctx.strokeStyle = glowColor;
        ctx.lineWidth   = 0.8;
        ctx.shadowColor = glowColor;
        ctx.shadowBlur  = 4;
        // Horizontal scan-line cracks across the entity bounding box
        const bx = cx - 20 * tfs, bw = 40 * tfs;
        const by = coreY - 34 * tfs, bh = 68 * tfs;
        const lineCount = Math.floor(3 + _alT * 4);
        for (let li = 0; li < lineCount; li++) {
          const lFrac = (li + 0.5 + Math.sin(T * 2.3 + li * 1.7) * 0.4) / lineCount;
          const ly = by + bh * lFrac;
          const lOffset = Math.sin(T * 4.1 + li * 2.3) * 6;
          ctx.beginPath();
          ctx.moveTo(bx + lOffset,      ly);
          ctx.lineTo(bx + bw + lOffset, ly);
          ctx.stroke();
        }
        ctx.restore();
      }
    }

    // ── Echo red tint — post-render overlay (Damnation arc) ──────────
    if (this.isEcho && typeof damnationActive !== 'undefined' && damnationActive) {
      ctx.save();
      ctx.globalCompositeOperation = 'multiply';
      ctx.globalAlpha = 0.50;
      ctx.fillStyle   = '#ff1100';
      ctx.fillRect(this.x - 6, this.y - 6, this.w + 12, this.h + 12);
      ctx.restore();
    }
  }
}
