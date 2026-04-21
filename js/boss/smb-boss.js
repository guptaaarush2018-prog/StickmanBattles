'use strict';

// ============================================================
// BOSS  (special Fighter — 3× HP, gauntlet weapon, ½ cooldowns)
// ============================================================
class Boss extends Fighter {
  constructor() {
    const noCtrl = { left:null, right:null, jump:null, attack:null, ability:null, super:null };
    super(450, 200, '#cc00ee', 'gauntlet', noCtrl, true, 'hard');
    this.name           = 'CREATOR';
    this.health         = 3000;
    this.maxHealth      = 3000;
    this.w              = 33;   // double Fighter hitbox width
    this.h              = 90;  // double Fighter hitbox height
    this.drawScale      = 1.5;    // visual 2× scale in draw()
    this.isBoss         = true;
    this.lives          = 1;
    this.spawnX         = 450;
    this.spawnY         = 200;
    this.playerNum      = 2;
    // Boss combat modifiers
    this.kbResist       = 0.5;  // takes half knockback
    this.kbBonus        = 1.5;  // deals 1.5x knockback
    this.attackCooldownMult = 0.5;
    this.superChargeRate = 1.7;   // charges super 1.7× faster
    // Gauntlet weapon (single weapon only)
    this.weaponKey      = 'gauntlet';
    this.weapon         = WEAPONS['gauntlet'];
    // NOTE: all cooldowns below are in AI TICKS (updateAI runs every 15 frames).
    // 1 AI tick = 15 frames. To get seconds: ticks × 15 / 60.
    // Minion spawning
    this.minionCooldown = 20;   // 20 ticks = 300 frames = ~5 s initial
    // Beam attacks
    this.beamCooldown   = 28;   // 28 ticks = 420 frames = ~7 s initial
    // Teleport
    this.teleportCooldown = 0;
    this.teleportMaxCd    = 60; // 60 ticks = 900 frames = ~15 s
    this.postTeleportCrit = 0;
    this.forcedTeleportFlash = 0;
    // Spike attacks
    this.spikeCooldown  = 24;   // 24 ticks = 360 frames = ~6 s initial
    // Post-special pause (in AI ticks; 1 tick ≈ 0.25 s)
    this.postSpecialPause = 0;
    // Monologue tracking
    this.phaseDialogueFired = new Set();
    this._maxLives          = 1; // boss shows phase indicator, not hearts
    this._lastPhase         = 1; // track phase transitions for animation triggers
    // Aggression system + player intelligence
    this._idleTicks       = 0;   // forces a special after 12 ticks (3s)
    this._runAwayTicks    = 0;   // tracks player fleeing behaviour
    this._stillTimer      = 0;   // tracks player standing still
    this._lastTargetX     = -999;
    // New special cooldowns
    this._gravPulseCd     = 0;   // Gravity Pulse
    this._stormCd         = 0;   // Meteor Storm
    this._groundSlamCd    = 0;   // Ground Slam
    // Pending (deferred) attacks — set warning, delay damage by N frames
    this._pendingGroundSlam = null; // { timer, x, y }
    this._pendingGravPulse  = null; // { timer }
    this._prevHealth        = 3000; // for stagger accumulation tracking
    this._cinematicFired    = new Set(); // HP-threshold mid-fight cinematics already triggered
  }

  getPhase() {
    if (this.health > 2000) return 1;   // > 66% HP (>2000 of 3000)
    if (this.health > 1000) return 2;   // 33–66% HP (1000–2000)
    return 3;                            // < 33% HP (<1000)
  }

  // Override attack: gauntlet melee only, half cooldowns
  attack(target) {
    if (this.backstageHiding) return;
    if (this.postPortalAttackBlock > 0) return; // can't attack for 1s after portal exit
    if (this.cooldown > 0 || this.health <= 0 || this.stunTimer > 0 || this.ragdollTimer > 0) return;
    // Gauntlet is melee-only — start swing, damage delivered via weapon-tip hitbox
    if (dist(this, target) < this.weapon.range * 1.4) { this.weaponHit = false; this.swingHitTargets.clear(); }
    this.cooldown    = Math.max(1, Math.ceil(this.weapon.cooldown * (this.attackCooldownMult || 0.5)));
    this.attackTimer = this.attackDuration;
  }

  // Override ability: half cooldown + 1.5s post-special pause
  ability(target) {
    if (this.postPortalAttackBlock > 0) return; // can't use ability for 1s after portal exit
    if (this.abilityCooldown > 0 || this.health <= 0 || this.stunTimer > 0 || this.ragdollTimer > 0) return;
    this.weapon.ability(this, target);
    this.abilityCooldown  = Math.max(1, Math.ceil(this.weapon.abilityCooldown * (this.attackCooldownMult || 0.5)));
    this.attackTimer      = this.attackDuration * 2;
    this.postSpecialPause = 3; // 3 ticks = 45 frames = 0.75s pause after void slam ability
  }

  // Override AI: phase-based, more aggressive, respects shield cooldown
  updateAI() {
    if (activeCinematic || gameFrozen) return; // freeze during cinematics / freeze frames

    if (this.aiReact > 0) { this.aiReact--; return; }
    if (this.ragdollTimer > 0 || this.stunTimer > 0) return;
    if (bossStaggerTimer > 0) return; // stunned — vulnerability window
    // Post-special pause: boss moves but doesn't attack for 1.5s after specials
    if (this.postSpecialPause > 0) this.postSpecialPause--;
    const canAct = this.postSpecialPause <= 0;

    if (this.target && !activeCinematic && typeof this._dominanceMoment === 'function') {
      this._dominanceMoment(this.target);
    }

    // In 2P boss mode, always target the nearest alive human player
    if (gameMode === 'boss' && bossPlayerCount === 2) {
      let nearDist = Infinity, nearP = null;
      for (const p of players) {
        if (p.isBoss || p.health <= 0) continue;
        const d2 = dist(this, p);
        if (d2 < nearDist) { nearDist = d2; nearP = p; }
      }
      if (nearP) this.target = nearP;
    }

    const phase   = this.getPhase();
    // Phase transition animations
    if (phase > this._lastPhase) {
      this._lastPhase = phase;
      if (settings.screenShake) screenShake = Math.max(screenShake, 20);
      if (settings.phaseFlash)  bossPhaseFlash = 50;
      this.postSpecialPause = Math.max(this.postSpecialPause, 8); // 8 ticks = 120 frames = 2s cinematic pause
      triggerPhaseTransition(this, phase);
    }

    // ── Mid-fight HP cinematics ───────────────────────────────
    const _hpPct = this.health / this.maxHealth;
    if (!this._cinematicFired.has('75') && _hpPct <= 0.75) {
      this._cinematicFired.add('75');
      this.postSpecialPause = Math.max(this.postSpecialPause, 14);
      startCinematic(_makeBossWarning75Cinematic(this));
      return;
    }
    // Foreshadowing: at 50% HP Boss punches Paradox out of the arena (one-time scripted moment)
    if (!this._cinematicFired.has('paradox50') && _hpPct <= 0.50) {
      this._cinematicFired.add('paradox50');
      if (typeof triggerBossParadoxPunch === 'function') triggerBossParadoxPunch();
    }
    if (!this._cinematicFired.has('40') && _hpPct <= 0.40) {
      this._cinematicFired.add('40');
      this.postSpecialPause = Math.max(this.postSpecialPause, 16);
      startCinematic(_makeBossRage40Cinematic(this));
      return;
    }
    if (!this._cinematicFired.has('10') && _hpPct <= 0.10) {
      this._cinematicFired.add('10');
      this.postSpecialPause = Math.max(this.postSpecialPause, 14);
      startCinematic(_makeBossDesp10Cinematic(this));
      return;
    }

    // Phase-based stats — hyper aggressive, always pressing attack
    const _worldAggro = Math.max(0.25, this._aggroBoost || 1);
    const spd     = (phase === 3 ? 6.8 : phase === 2 ? 5.8 : 5.0) * _worldAggro;
    const atkFreq = Math.min(1, (phase === 3 ? 0.95 : phase === 2 ? 0.80 : 0.60) * _worldAggro);
    const abiFreq = Math.min(1, (phase === 3 ? 0.18 : phase === 2 ? 0.10 : 0.05) * _worldAggro);

    // Count down post-teleport crit window and attack block
    if (this.postTeleportCrit > 0) this.postTeleportCrit--;
    if (this.postPortalAttackBlock > 0) this.postPortalAttackBlock--;
    if (this.forcedTeleportFlash > 0) this.forcedTeleportFlash--;

    const t  = this.target;
    if (!t || t.health <= 0) return;
    const dx  = t.cx() - this.cx();
    const d   = Math.abs(dx);
    const dir = dx > 0 ? 1 : -1;

    // Lava / void floor — flee toward elevated platforms
    if (currentArena.hasLava) {
      const distToLava = currentArena.lavaY - (this.y + this.h);
      if (distToLava < 110) {
        if (this.onGround) {
          this.vy = -19; this.vx = this.cx() < GAME_W/2 ? spd*2.2 : -spd*2.2;
        } else {
          let nearX = GAME_W/2, nearDist = Infinity;
          for (const pl of currentArena.platforms) {
            if (pl.y < this.y && !pl.isFloorDisabled) {
              const pdx = Math.abs(pl.x + pl.w/2 - this.cx());
              if (pdx < nearDist) { nearDist = pdx; nearX = pl.x + pl.w/2; }
            }
          }
          this.vx = nearX > this.cx() ? spd*2 : -spd*2;
        }
        return;
      }
    }

    // Flee floor during void warning/hazard
    const floorDanger = currentArena.isBossArena &&
      (bossFloorState === 'hazard' || (bossFloorState === 'warning' && bossFloorTimer < 90)) &&
      this.y + this.h > 440;
    if (floorDanger && this.onGround) {
      const above = this.platformAbove();
      if (above) { this.vy = -18; this.vx = (above.x + above.w/2 - this.cx()) > 0 ? spd*1.5 : -spd*1.5; }
      return;
    }

    // ── Player intelligence ──────────────────────────────────
    const playerMoved = Math.abs(t.cx() - this._lastTargetX) > 8;
    this._stillTimer  = playerMoved ? 0 : this._stillTimer + 1;
    this._lastTargetX = t.cx();

    const playerFleeing = (dx > 0 && t.vx > 1) || (dx < 0 && t.vx < -1);
    const playerFar     = d > 280;
    this._runAwayTicks  = (playerFleeing && playerFar) ? this._runAwayTicks + 1
                                                        : Math.max(0, this._runAwayTicks - 2);

    // ── Tick new special cooldowns ────────────────────────────
    if (this._gravPulseCd  > 0) this._gravPulseCd--;
    if (this._stormCd      > 0) this._stormCd--;
    if (this._groundSlamCd > 0) this._groundSlamCd--;

    // ── Aggression timer — force a special every 3 s of idle ─
    this._idleTicks++;
    const cdScale      = phase === 3 ? 0.55 : phase === 2 ? 0.75 : 1.0;
    const specialFreq  = phase === 3 ? 0.10 : phase === 2 ? 0.055 : 0.025;
    const fullD_pre    = dist(this, t);
    if (canAct && (this._idleTicks >= 8 || Math.random() < specialFreq)) {
      const fired = this._bossFireSpecial(phase, t, d, fullD_pre, cdScale);
      if (fired) { this._idleTicks = 0; this.postSpecialPause = Math.max(this.postSpecialPause, 3); return; }
      if (this._idleTicks >= 12) this._idleTicks = 8; // nothing available yet — back off slightly
    }

    // State machine — use horizontal distance for attack range (boss should attack even when player jumps above)
    const fullD = fullD_pre;
    if (d < this.weapon.range * 3.5) this.aiState = 'attack'; // wide horizontal trigger
    else if (this.health < 120 && fullD > 160 && Math.random() < 0.008) this.aiState = 'evade';
    else this.aiState = 'chase';

    // Reactive shield (respects cooldown) — responds to both attacks AND incoming bullets
    if (this.shieldCooldown === 0) {
      const incomingBullet = projectiles.some(pr =>
        pr.owner !== this && Math.hypot(pr.x - this.cx(), pr.y - this.cy()) < 160 &&
        ((pr.vx > 0 && pr.x < this.cx()) || (pr.vx < 0 && pr.x > this.cx()))
      );
      if ((t.attackTimer > 0 && d < 150) || incomingBullet) {
        if (Math.random() < (phase === 3 ? 0.55 : 0.35)) {
          this.shielding = true;
          this.shieldCooldown = Math.ceil(SHIELD_CD * 0.5);
          setTimeout(() => { this.shielding = false; }, 350);
        }
      }
    }

    // Dodge bullets by jumping
    for (const pr of projectiles) {
      if (pr.owner === this) continue;
      const pd = Math.hypot(pr.x - this.cx(), pr.y - this.cy());
      if (pd < 130 && this.onGround && Math.random() < (phase >= 2 ? 0.35 : 0.20)) {
        this.vy = -18;
        break;
      }
    }

    const edgeDanger = this.isEdgeDanger(dir);

    // If player is significantly below boss, walk off platform edge to chase them down
    const playerBelow = t.y > this.y + this.h + 30;
    if (playerBelow && this.onGround && Math.abs(dx) < 120 && Math.random() < 0.08) {
      this.vx = dir * spd; // walk toward edge so we fall off
    }

    switch (this.aiState) {
      case 'chase':
        if (!edgeDanger || playerBelow) this.vx = dir * spd;
        else { this.vx = 0; if (this.onGround && this.platformAbove() && Math.random() < 0.10) this.vy = -18; }
        // Jump toward target on platforms above
        if (this.onGround && t.y + t.h < this.y - 40 && !edgeDanger && Math.random() < 0.10) this.vy = -19;
        // Double jump in air to reach elevated targets
        if (!this.onGround && this.canDoubleJump && t.y + t.h < this.y - 20 && this.vy > -4 && Math.random() < 0.35) {
          this.vy = -18; this.canDoubleJump = false;
        }
        break;
      case 'attack':
        // Keep pressure on — always creep toward target even while attacking
        if (d < 45) this.vx *= 0.78;
        else        this.vx = dir * spd * 0.7;
        if (canAct && Math.random() < atkFreq)       this.attack(t);
        if (canAct && Math.random() < abiFreq)       this.ability(t);
        if (canAct && this.superReady && Math.random() < (phase === 3 ? 0.22 : 0.14)) this.useSuper(t);
        if (this.onGround && t.y + t.h < this.y - 25 && !edgeDanger && Math.random() < 0.12) this.vy = -18;
        // Double jump during attack to stay on top of target
        if (!this.onGround && this.canDoubleJump && t.y + t.h < this.y - 15 && this.vy > -3 && Math.random() < 0.40) {
          this.vy = -17; this.canDoubleJump = false;
        }
        // Guaranteed attack burst when directly adjacent
        if (canAct && d < this.weapon.range + 10 && this.cooldown <= 0) this.attack(t);
        break;
      case 'evade': {
        const eDir  = -dir;
        const eEdge = this.isEdgeDanger(eDir);
        if (!eEdge) this.vx = eDir * spd * 1.2;
        else if (canAct && Math.random() < atkFreq)  this.attack(t);
        if (canAct && Math.random() < atkFreq * 0.5) this.attack(t);
        break;
      }
    }

    // Phase 2+ bonus: extra aggression
    if (phase >= 2) {
      if (this.onGround && !edgeDanger && Math.random() < 0.025) this.vy = -17;
      if (canAct && Math.random() < 0.055) this.attack(t);
    }
    // Phase 3 bonus: burst attacks every frame when adjacent
    if (phase === 3) {
      if (this.onGround && !edgeDanger && Math.random() < 0.030) this.vy = -18;
      if (canAct && this.cooldown <= 0 && d < this.weapon.range * 2) this.attack(t);
    }

    if (this.teleportCooldown > 0) this.teleportCooldown--;

    // Ability more often when target is close
    if (canAct && t && dist(this, t) < 150 && Math.random() < 0.09) this.ability(t);

    // Boss leads attacks when player moves toward it
    if (canAct && t && t.vx !== 0) {
      const playerMovingToward = (t.cx() < this.cx() && t.vx > 0) || (t.cx() > this.cx() && t.vx < 0);
      if (playerMovingToward && dist(this, t) < this.weapon.range * 2 && Math.random() < 0.15) {
        this.attack(t);
      }
    }

    // Spike attacks — Phase 3 ONLY (ground spells)
    if (phase >= 3) {
      if (this.spikeCooldown > 0) {
        this.spikeCooldown--;
      } else if (canAct && t) {
        const numSpikes = 5;
        for (let i = 0; i < numSpikes; i++) {
          const sx = clamp(t.cx() + (i - Math.floor(numSpikes / 2)) * 40, 20, 880);
          bossSpikes.push({ x: sx, maxH: 90 + Math.random() * 50, h: 0, phase: 'rising', stayTimer: 0, done: false });
        }
        this.spikeCooldown = 24; // in AI ticks
        this.postSpecialPause = 4;
        showBossDialogue(randChoice(['The floor has opinions.', 'Watch what\'s beneath you.', 'Everything rises at my word.', 'Below.']));
      }
    }

    // Minion spawning — Phase 2+ ONLY
    if (phase >= 2) {
      if (this.minionCooldown > 0) {
        this.minionCooldown--;
      } else if (minions.filter(m => m.health > 0).length < (phase >= 3 ? 2 : 1)) {
        const spawnX = Math.random() < 0.5 ? 60 : 840;
        const spawnY = 200;
        const mn     = new Minion(spawnX, spawnY);
        mn.target    = players[0];
        minions.push(mn);
        spawnParticles(spawnX, spawnY, '#bb00ee', 24);
        if (settings.screenShake) screenShake = Math.max(screenShake, 12);
        this.minionCooldown = phase === 3 ? 20 : 36; // in AI ticks
        showBossDialogue(randChoice(['I have associates.', 'Let them practice on you.', 'You wanted a crowd? Here.', 'Handle these first.']));
      }
    }

    // Beam attacks — Phase 2+ ONLY
    if (phase >= 2) {
      if (this.beamCooldown > 0) {
        this.beamCooldown--;
      } else if (canAct && t) {
        const numBeams = phase === 3 ? 4 : 2;
        for (let i = 0; i < numBeams; i++) {
          const spread = (i - Math.floor(numBeams / 2)) * 95;
          const bx = clamp(t.cx() + spread + (Math.random() - 0.5) * 70, 40, 860);
          bossBeams.push({ x: bx, warningTimer: 300, activeTimer: 0, phase: 'warning', done: false });
        }
        this.beamCooldown = phase === 3 ? 16 : 28; // in AI ticks
        this.postSpecialPause = 4;
        showBossDialogue(randChoice(['The arena remembers where you stood.', 'Light doesn\'t miss.', 'I\'m everywhere you aren\'t.', 'This is what \'nowhere\' looks like.']));
      }
    }

    // HP-threshold monologue (fires once per threshold crossing) — scaled for 3000 HP
    const hpLines = [
      { hp: 2999, text: 'Good. You showed up.' },
      { hp: 2600, text: 'That was yours. Enjoy it.' },
      { hp: 2200, text: 'You\'re still here. Interesting.' },
      { hp: 2000, text: 'I was holding back. Not anymore.' },
      { hp: 1600, text: 'You\'re earning this.' },
      { hp: 1200, text: 'Every world has a limit. You\'re approaching mine.' },
      { hp: 1000, text: 'I built this place. I decide when it ends.' },
      { hp: 600,  text: 'I miscalculated. That won\'t happen again.' },
      { hp: 300,  text: 'You\'ve gone further than anyone. That means nothing.' },
      { hp: 100,  text: 'Still standing. So am I.' },
    ];
    for (const { hp, text } of hpLines) {
      if (this.health <= hp && !this.phaseDialogueFired.has(hp)) {
        this.phaseDialogueFired.add(hp);
        showBossDialogue(text, 280);
        break; // one at a time
      }
    }

    if (Math.random() < 0.025) this.aiReact = 2; // tighter reaction window than base AI
  }

  // ── Distance-routed special selector ──────────────────────────────────────
  // Returns true if a special was fired.
  _bossFireSpecial(phase, t, d, fullD, cdScale) {
    const playerEdge  = t.x < 130 || t.x + t.w > GAME_W - 130;
    const playerAir   = !t.onGround;
    const playerStill = this._stillTimer > 8;
    const fleeing     = this._runAwayTicks > 5;

    // ── Close range (< 130 px): Ground Slam — DEFERRED with telegraph ────────
    if (d < 130 && this._groundSlamCd <= 0 && !this._pendingGroundSlam) {
      this._groundSlamCd = Math.ceil(18 * cdScale);
      // Telegraph: pulsing red AOE circle + spike floor markers (45 frames ≈ 0.75s)
      const slamX = this.cx(), slamY = this.y + this.h;
      bossWarnings.push({ type: 'circle', x: slamX, y: slamY, r: 160,
        color: '#ff2200', timer: 45, maxTimer: 45, label: 'SLAM!' });
      // Show spike warning dots on floor ahead of time
      for (let i = 0; i < 6; i++) {
        const sx = clamp(slamX + (i - 2.5) * 55, 20, 880);
        bossWarnings.push({ type: 'spike_warn', x: sx, y: 460, r: 12,
          color: '#ff6600', timer: 45, maxTimer: 45 });
      }
      this._pendingGroundSlam = { timer: 45, x: slamX, y: slamY };
      showBossDialogue(randChoice(['Down.', 'Stay there.', 'The floor agrees with me.', 'SHATTER.']), 150);
      if (typeof directorAddIntensity === 'function') directorAddIntensity(0.15);
      return true;
    }

    // ── Medium range (130–300 px): Gravity Pulse — DEFERRED with telegraph ───
    if (d >= 80 && d < 320 && this._gravPulseCd <= 0 && !this._pendingGravPulse) {
      this._gravPulseCd = Math.ceil(28 * cdScale);
      // Telegraph: expanding purple pull-radius ring (40 frames ≈ 0.67s)
      bossWarnings.push({ type: 'circle', x: this.cx(), y: this.cy(), r: 350,
        color: '#9900cc', timer: 40, maxTimer: 40, label: 'GRAVITY PULL!' });
      // Inner ring at boss to show pull origin
      bossWarnings.push({ type: 'circle', x: this.cx(), y: this.cy(), r: 60,
        color: '#cc66ff', timer: 40, maxTimer: 40 });
      this._pendingGravPulse = { timer: 40, edge: false };
      showBossDialogue(randChoice(['Come.', 'Distance is an illusion.', 'The void obeys me.', 'You were never free.']), 180);
      if (typeof directorAddIntensity === 'function') directorAddIntensity(0.14);
      return true;
    }

    // ── Far range / player fleeing: Meteor Storm ─────────────
    if ((d >= 250 || fleeing) && phase >= 2 && this._stormCd <= 0) {
      this._stormCd = Math.ceil(32 * cdScale);
      const count = phase === 3 ? 8 : 5;
      const safeCount = phase === 3 ? 1 : 2;
      // Pick random safe zone positions that don't overlap beams
      const safePositions = [];
      for (let s = 0; s < safeCount; s++) {
        safePositions.push(120 + Math.random() * (GAME_W - 240));
      }
      for (let i = 0; i < count; i++) {
        let bx;
        // Avoid placing beams on safe zones
        do { bx = 60 + Math.random() * (GAME_W - 120); }
        while (safePositions.some(sx => Math.abs(bx - sx) < 80));
        bossBeams.push({ x: bx, warningTimer: 240, activeTimer: 0, phase: 'warning', done: false });
      }
      // Register safe zones so beam damage is skipped inside them
      for (const sx of safePositions) {
        bossMetSafeZones.push({ x: sx, y: 380, r: 70, timer: 240 + 110, maxTimer: 240 + 110 });
      }
      screenShake = Math.max(screenShake, 14);
      showBossDialogue(randChoice(['Every corner belongs to me.', 'Let it rain.', 'I own the sky too.', 'Nowhere safe. I checked.']), 220);
      if (typeof directorAddIntensity === 'function') directorAddIntensity(0.20);
      return true;
    }

    // ── Situational: player standing still → teleport behind ─
    if (playerStill && phase >= 2 && this.teleportCooldown <= 0 && !this.backstageHiding && d > 110) {
      bossTeleport(this);
      this.teleportCooldown = phase === 3 ? 26 : 46;
      showBossDialogue('Standing still is a choice. A bad one.', 160);
      return true;
    }

    // ── Situational: player at edge → Gravity Pulse (deferred) ──────────────
    if (playerEdge && this._gravPulseCd <= 0 && !this._pendingGravPulse) {
      this._gravPulseCd = Math.ceil(28 * cdScale);
      bossWarnings.push({ type: 'circle', x: this.cx(), y: this.cy(), r: 350,
        color: '#9900cc', timer: 40, maxTimer: 40, label: 'GRAVITY PULL!' });
      this._pendingGravPulse = { timer: 40, edge: true };
      spawnParticles(this.cx(), this.cy(), '#9900cc', 20);
      screenShake = Math.max(screenShake, 14);
      showBossDialogue('The edges are mine too.', 180);
      if (typeof directorAddIntensity === 'function') directorAddIntensity(0.12);
      return true;
    }

    return false;
  }

  _dominanceMoment(target) {
    if (!target || target.health <= 0) return;
    if ((this._dominanceCd || 0) > 0) { this._dominanceCd--; return; }
    if (this._inDominance) return;

    const hpPct = this.health / this.maxHealth;
    const atPhase2 = hpPct < 0.67 && !this._dom2Fired;
    const atPhase3 = hpPct < 0.33 && !this._dom3Fired;
    const playerClose = Math.abs(target.cx() - this.cx()) < 130 && target.attackTimer > 0;

    if (!atPhase2 && !atPhase3 && !playerClose) return;
    if (atPhase2) this._dom2Fired = true;
    if (atPhase3) this._dom3Fired = true;

    this._inDominance = true;
    this._dominanceCd = 1200;

    const _self = this;
    if (typeof directorSchedule === 'function') {
      directorSchedule([
        {
          id: 'dom_freeze', delay: 0,
          condition: () => gameRunning,
          action: () => {
            _self.vx = 0; _self.vy = 0;
            if (typeof slowMotion !== 'undefined') slowMotion = 0.32;
            if (typeof hitStopFrames !== 'undefined') hitStopFrames = 6;
            if (typeof showBossDialogue === 'function') showBossDialogue(_self._domLine(), 110);
            if (typeof setCameraDrama === 'function') setCameraDrama('focus', 85, _self, 1.28);
            if (typeof SoundManager !== 'undefined' && SoundManager.phaseUp) SoundManager.phaseUp();
          }
        },
        {
          id: 'dom_teleport', delay: 50,
          condition: () => gameRunning && target.health > 0,
          action: () => {
            if (typeof slowMotion !== 'undefined') slowMotion = 1.0;
            const _behindX = target.cx() + target.facing * -80;
            _self.x = Math.max(20, Math.min(GAME_W - _self.w - 20, _behindX - _self.w / 2));
            if (typeof spawnParticles === 'function') spawnParticles(_self.cx(), _self.cy(), '#cc44ff', 18);
            _self.facing = target.cx() < _self.cx() ? -1 : 1;
          }
        },
        {
          id: 'dom_strike', delay: 8,
          condition: () => gameRunning && target.health > 0,
          action: () => {
            if (typeof setCameraDrama === 'function') setCameraDrama('impact', 22);
            _self.attack(target);
            if (typeof screenShakeIntensity !== 'undefined') screenShakeIntensity = 9;
          }
        },
        {
          id: 'dom_end', delay: 45,
          condition: () => true,
          action: () => { _self._inDominance = false; }
        }
      ]);
    } else {
      // Fallback if director not available
      setTimeout(() => { this._inDominance = false; }, 2000);
    }
  }

  _domLine() {
    const lines = [
      'I was always behind you.',
      'You never had the initiative.',
      'Amusing.',
      'I let you get that far.',
    ];
    return lines[Math.floor(Math.random() * lines.length)];
  }
}

// ============================================================
// BACKSTAGE PORTAL HELPERS
// ============================================================
function openBackstagePortal(cx, cy, type) {
  const words = ['if','for','let','const','function','return','true','false','null',
                 '&&','||','=>','{','}','()','0','1','new','this','class','extends',
                 'import','export','while','switch','break','typeof','void'];
  const chars = [];
  for (let _i = 0; _i < 35; _i++) {
    chars.push({
      x:     (Math.random() * 90) - 45,
      y:     (Math.random() * 160) - 80,
      char:  words[Math.floor(Math.random() * words.length)],
      speed: 0.6 + Math.random() * 1.8,
      alpha: 0.35 + Math.random() * 0.55,
      color: ['#00ff88','#00cc66','#88ffaa','#44ff00','#aaffaa','#ffffff'][Math.floor(Math.random()*6)]
    });
  }
  backstagePortals.push({ x: cx, y: cy, type, phase: 'opening', timer: 0, radius: 0, maxRadius: 58, codeChars: chars, done: false });
}

function drawBackstagePortals() {
  for (const bp of backstagePortals) {
    if (bp.done) continue;
    bp.timer++;
    if (bp.phase === 'opening') {
      bp.radius = bp.maxRadius * Math.min(1, (bp.timer / 35) * (bp.timer / 35) * 2);
      if (bp.timer >= 35) bp.phase = 'open';
    } else if (bp.phase === 'open') {
      bp.radius = bp.maxRadius;
      bp.openTimer = (bp.openTimer || 0) + 1;
      if (bp.openTimer >= 300) bp.phase = 'closing'; // auto-close after 5s
    } else if (bp.phase === 'closing') {
      bp.radius = Math.max(0, bp.radius - 2.8);
      if (bp.radius <= 0) { bp.done = true; continue; }
    }
    const rw = bp.radius * 0.55;
    const rh = bp.radius;
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(bp.x, bp.y, Math.max(0.1, rw), Math.max(0.1, rh), 0, 0, Math.PI * 2);
    ctx.fillStyle = '#000008';
    ctx.fill();
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(bp.x, bp.y, Math.max(0.1, rw - 2), Math.max(0.1, rh - 2), 0, 0, Math.PI * 2);
    ctx.clip();
    ctx.font = '8px monospace';
    ctx.textAlign = 'left';
    for (const c of bp.codeChars) {
      c.y += c.speed;
      if (c.y > rh + 14) c.y = -rh - 14;
      ctx.globalAlpha = c.alpha * (bp.radius / bp.maxRadius);
      ctx.fillStyle   = c.color;
      ctx.fillText(c.char, bp.x + c.x - 28, bp.y + c.y);
    }
    ctx.restore();
    ctx.globalAlpha = bp.radius / bp.maxRadius;
    ctx.strokeStyle = '#cc00ff';
    ctx.lineWidth   = 3.5;
    ctx.shadowColor = '#9900ee';
    ctx.shadowBlur  = 22;
    ctx.beginPath();
    ctx.ellipse(bp.x, bp.y, Math.max(0.1, rw), Math.max(0.1, rh), 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(200,0,255,0.4)';
    ctx.lineWidth   = 1;
    ctx.shadowBlur  = 8;
    for (let _i = 0; _i < 3; _i++) {
      const _sa = (frameCount * 0.04 + _i * 2.1) % (Math.PI * 2);
      ctx.beginPath();
      ctx.arc(bp.x, bp.y, rw * (0.35 + _i * 0.18), _sa, _sa + Math.PI * 1.3);
      ctx.stroke();
    }
    ctx.restore();
  }
  backstagePortals = backstagePortals.filter(bp => !bp.done);
}

// ============================================================
// BOSS TELEPORT
// ============================================================
function bossTeleport(boss, isForced = false) {
  if (!currentArena || !boss) return;
  if (!isForced && boss.teleportCooldown > 0) return;
  const fallbackX = currentArena.worldWidth ? (currentArena.mapLeft || GAME_W * 0.5) : GAME_W * 0.5;
  const safePos = _bossFindSafeArenaPosition(
    boss,
    fallbackX,
    boss ? boss.y : 200,
    { preferRaised: true, sideBias: Math.random() < 0.5 ? -1 : 1 }
  );
  if (!safePos) return;
  const destX = safePos.x;
  const destY = safePos.y;

  const oldX = boss.cx();
  const oldY = boss.cy();

  if (!isForced) {
    // === BACKSTAGE PORTAL TELEPORT (3-second animation) ===
    bossWarnings.push({ type: 'circle', x: oldX, y: oldY, r: 48, color: '#aa55ff', timer: 24, maxTimer: 24, label: 'GLITCH' });
    bossWarnings.push({ type: 'circle', x: destX + boss.w / 2, y: destY + boss.h / 2, r: 56, color: '#ff66aa', timer: 34, maxTimer: 34, label: 'ARRIVAL' });
    openBackstagePortal(oldX, oldY, 'entry');
    boss.backstageHiding = true;
    boss.invincible      = 9999;
    boss.teleportCooldown = 60; // 60 ticks = 900 frames = 15s (in AI ticks)
    boss.vx = 0;
    boss.vy = 0;
    // Move boss off-screen so it cannot hit players during the portal animation
    boss.x = -2000;
    boss.y = -2000;

    // t=1.5s: open exit portal at destination
    setTimeout(() => {
      if (!gameRunning) return;
      openBackstagePortal(destX + boss.w / 2, destY + boss.h / 2, 'exit');
    }, 1500);

    // t=2.5s: boss reappears
    setTimeout(() => {
      if (!gameRunning) return;
      boss.x = destX;
      boss.y = destY;
      boss.vx = 0;
      boss.vy = 0;
      boss.backstageHiding = false;
      boss.invincible      = 60;
      boss.postTeleportCrit = 120;        // 2s crit window
      boss.postPortalAttackBlock = 60;    // boss can't attack for 1s after portal exit
      showBossDialogue(randChoice(['Behind you.', 'You were looking in the wrong place.', 'I was never there.', 'Try to keep up.']));
      // Close entry portal
      setTimeout(() => {
        for (const bp of backstagePortals) { if (bp.type === 'entry' && bp.phase === 'open') bp.phase = 'closing'; }
      }, 500);
      // Close exit portal
      setTimeout(() => {
        for (const bp of backstagePortals) { if (bp.type === 'exit'  && bp.phase === 'open') bp.phase = 'closing'; }
      }, 1200);
    }, 2500);

  } else {
    // Forced teleport: use portal animation (same as voluntary but faster — 1s total)
    bossWarnings.push({ type: 'circle', x: oldX, y: oldY, r: 42, color: '#aa55ff', timer: 16, maxTimer: 16, label: 'SHIFT' });
    openBackstagePortal(oldX, oldY, 'entry');
    boss.backstageHiding = true;
    boss.invincible      = 9999;
    boss.vx = 0; boss.vy = 0;
    boss.x = -2000; boss.y = -2000; // off-screen while animating
    spawnParticles(oldX, oldY, '#9900ee', 18);
    setTimeout(() => {
      if (!gameRunning) return;
      openBackstagePortal(destX + boss.w / 2, destY + boss.h / 2, 'exit');
    }, 600);
    setTimeout(() => {
      if (!gameRunning) return;
      boss.x = destX; boss.y = destY;
      boss.vx = 0; boss.vy = 0;
      boss.backstageHiding = false;
      boss.invincible = 60;
      boss.forcedTeleportFlash = 20;
      showBossDialogue('Did you think that was enough?', 300);
    }, 1100);
  }
}

function _bossArenaBounds() {
  if (!currentArena || !Array.isArray(currentArena.platforms) || !currentArena.platforms.length) {
    return { left: 20, right: GAME_W - 20, floorY: GAME_H - 30 };
  }
  const xs = currentArena.platforms.map(pl => pl.x);
  const xr = currentArena.platforms.map(pl => pl.x + pl.w);
  const ys = currentArena.platforms.map(pl => pl.y);
  return {
    left: Math.min(...xs),
    right: Math.max(...xr),
    floorY: Math.max(...ys),
  };
}

function _bossHazardFloorY() {
  if (!currentArena) return Infinity;
  if (currentArena.hasLava) return currentArena.lavaY || 442;
  if (currentArenaKey === 'void' && typeof bossFloorState !== 'undefined' && bossFloorState === 'hazard') return 470;
  return Infinity;
}

function _bossTeleportSpotSafe(actor, x, y) {
  if (!actor || !currentArena || !Array.isArray(currentArena.platforms)) return false;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false;

  const bounds  = _bossArenaBounds();
  const left    = x;
  const right   = x + actor.w;
  const top     = y;
  const bottom  = y + actor.h;
  const hazardY = _bossHazardFloorY();

  if (left < bounds.left + 10 || right > bounds.right - 10) return false;
  if (bottom >= hazardY - 10) return false;

  let support = null;
  for (const pl of currentArena.platforms) {
    if (!pl || pl.isFloorDisabled) continue;
    const overlapX = Math.min(right, pl.x + pl.w) - Math.max(left, pl.x);
    if (overlapX < Math.min(actor.w * 0.45, 14)) continue;
    if (Math.abs(bottom - pl.y) <= 8 && (!support || pl.y < support.y)) support = pl;
    const bodyIntersect =
      right > pl.x + 4 &&
      left < pl.x + pl.w - 4 &&
      bottom > pl.y + 3 &&
      top < pl.y + pl.h - 2;
    if (bodyIntersect) return false;
  }
  return !!support;
}

function _bossFindSafeArenaPosition(actor, desiredCenterX, preferredY, opts = {}) {
  if (!actor || !currentArena || !Array.isArray(currentArena.platforms)) return null;

  const bounds = _bossArenaBounds();
  const preferRaised = !!opts.preferRaised;
  const hazardY = _bossHazardFloorY();
  const platforms = currentArena.platforms.filter(pl =>
    pl &&
    !pl.isFloorDisabled &&
    pl.w > actor.w + 16 &&
    pl.y < hazardY - 22
  );
  if (!platforms.length) return null;

  const preferred = preferRaised ? platforms.filter(pl => !pl.isFloor) : platforms.slice();
  const usable = preferred.length ? preferred : platforms;
  const desiredX = Number.isFinite(desiredCenterX) ? desiredCenterX : actor.cx();
  const samples = usable
    .slice()
    .sort((a, b) => Math.abs((a.x + a.w / 2) - desiredX) - Math.abs((b.x + b.w / 2) - desiredX));

  for (const pl of samples) {
    const left = Math.max(bounds.left + 10, pl.x + 8);
    const right = Math.min(bounds.right - actor.w - 10, pl.x + pl.w - actor.w - 8);
    if (!(left <= right)) continue;

    const centerBias = clamp(desiredX - actor.w / 2, left, right);
    const sideBias = opts.sideBias === 1 ? right : opts.sideBias === -1 ? left : (left + right) * 0.5;
    const positions = [centerBias, sideBias, left, right, clamp((left + right) * 0.5, left, right)];
    for (const posX of positions) {
      const posY = pl.y - actor.h - 2;
      if (_bossTeleportSpotSafe(actor, posX, posY)) return { x: posX, y: posY, platform: pl };
    }
  }

  const fallbackFloor = platforms
    .slice()
    .sort((a, b) => Math.abs(a.y - preferredY) - Math.abs(b.y - preferredY))[0];
  if (!fallbackFloor) return null;
  const fx = clamp(desiredX - actor.w / 2, fallbackFloor.x + 8, fallbackFloor.x + fallbackFloor.w - actor.w - 8);
  const fy = fallbackFloor.y - actor.h - 2;
  return _bossTeleportSpotSafe(actor, fx, fy) ? { x: fx, y: fy, platform: fallbackFloor } : null;
}

function _bossTeleportActor(actor, desiredCenterX, preferredY, opts = {}) {
  const safePos = _bossFindSafeArenaPosition(actor, desiredCenterX, preferredY, opts);
  if (!safePos) return null;
  actor.x = safePos.x;
  actor.y = safePos.y;
  actor.vx = 0;
  actor.vy = 0;
  return safePos;
}

const TF_ATTACK_REGISTRY = {
  grasp:              { requiresTarget: false, cooldownKey: '_graspCd' },
  slash:              { requiresTarget: true,  cooldownKey: '_slashCd' },
  well:               { requiresTarget: false, cooldownKey: '_wellCd' },
  meteor:             { requiresTarget: true,  cooldownKey: '_meteorCd' },
  clones:             { requiresTarget: false, cooldownKey: '_cloneCd' },
  chain:              { requiresTarget: true,  cooldownKey: '_chainCd' },
  gravity:            { requiresTarget: false, cooldownKey: '_gravityCd' },
  warp:               { requiresTarget: false, cooldownKey: '_warpCd' },
  holes:              { requiresTarget: false, cooldownKey: '_holeCd' },
  floor:              { requiresTarget: false, cooldownKey: '_floorCd' },
  invert:             { requiresTarget: false, cooldownKey: '_invertCd' },
  size:               { requiresTarget: false, cooldownKey: '_sizeCd' },
  portal:             { requiresTarget: true,  cooldownKey: '_portalCd' },
  teleportCombo:      { requiresTarget: true,  cooldownKey: '_teleportComboCd' },
  gravityCrush:       { requiresTarget: false, cooldownKey: '_gravityCrushCd' },
  shockwave:          { requiresTarget: false, cooldownKey: '_shockwaveCd' },
  phaseShift:         { requiresTarget: false, cooldownKey: '_phaseShiftCd' },
  realityTear:        { requiresTarget: true,  cooldownKey: '_realityTearCd' },
  calcStrike:         { requiresTarget: true,  cooldownKey: '_calcStrikeCd' },
  realityOverride:    { requiresTarget: true,  cooldownKey: '_realityOverrideCd' },
  collapseStrike:     { requiresTarget: true,  cooldownKey: '_collapseStrikeCd' },
  grabCinematic:      { requiresTarget: true,  cooldownKey: '_grabCinCd' },
  gammaBeam:          { requiresTarget: false, cooldownKey: '_gammaBeamCd' },
  neutronStar:        { requiresTarget: false, cooldownKey: '_neutronStarCd' },
  galaxySweep:        { requiresTarget: false, cooldownKey: '_galaxySweepCd' },
  multiverseFracture: { requiresTarget: true,  cooldownKey: '_multiverseCd' },
  supernova:          { requiresTarget: false, cooldownKey: '_supernovaCd' },
  dimension:          { requiresTarget: false, cooldownKey: '_dimensionCd' },
  // ── Depth Phase Z-axis attacks (active only when tfDepthPhaseActive) ─────────
  depthPhaseShift:    { requiresTarget: true,  cooldownKey: '_depthPhaseShiftCd' },
  depthLayerFake:     { requiresTarget: true,  cooldownKey: '_depthLayerFakeCd'  },
  depthPunish:        { requiresTarget: true,  cooldownKey: '_depthPunishCd'     },
};

function executeTrueFormAttack(ctx, move, target, source = 'runtime') {
  const entry = TF_ATTACK_REGISTRY[move];
  if (!ctx || typeof ctx._doSpecial !== 'function') {
    console.warn(`[TrueFormAttack:${source}] missing boss context for "${move}"`);
    return false;
  }
  if (!entry) {
    console.warn(`[TrueFormAttack:${source}] missing attack registry entry for "${move}"`);
    if (target && ctx.cooldown <= 0) ctx.attack(target);
    return false;
  }
  const liveTarget = target && target.health > 0
    ? target
    : ctx.target && ctx.target.health > 0 ? ctx.target : players.find(p => !p.isBoss && p.health > 0);
  if (entry.requiresTarget && !liveTarget) {
    console.warn(`[TrueFormAttack:${source}] attack "${move}" requires a valid target`);
    return false;
  }
  ctx.target = liveTarget || ctx.target;
  const ok = ctx._doSpecial(move, liveTarget || target);
  if (!ok) {
    console.warn(`[TrueFormAttack:${source}] "${move}" deferred for retry`);
    tfAttackRetryQueue.push({ ctx, move, targetRef: liveTarget || target || null, source, framesLeft: 1, attempts: 0 });
  }
  return ok;
}

function getTrueFormAntiRangedBoss() {
  return players && players.find(p => p.isTrueForm && p.health > 0 && p._antiRangedTimer > 0) || null;
}

// ============================================================
// TRUE FORM  (secret final boss — player-sized, void arena only)
// ============================================================
