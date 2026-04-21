TrueForm.prototype._doSpecial = function(move, target) {
    const entry = TF_ATTACK_REGISTRY[move];
    if (!entry) {
      console.warn(`[TrueFormAttack:runtime] unregistered attack "${move}"`);
      if (target && this.cooldown <= 0) this.attack(target);
      return false;
    }
    if (entry.requiresTarget && (!target || target.health <= 0)) {
      console.warn(`[TrueFormAttack:runtime] attack "${move}" missing target`);
      return false;
    }
    if (this._tfAttackState.phase === 'recovery' && this._tfAttackState.timer > 0) {
      return false;
    }
    if (this._tfAttackState.locked && this._tfAttackState.name && this._tfAttackState.name !== move) {
      return false;
    }
    const isDeferredMove = ['slash', 'portal', 'teleportCombo', 'gravityCrush', 'shockwave', 'phaseShift', 'realityTear', 'calcStrike', 'realityOverride', 'collapseStrike', 'multiverseFracture', 'grabCinematic', 'gammaBeam', 'neutronStar', 'galaxySweep', 'meteor'].includes(move);
    this._startAttackState(move, isDeferredMove ? 10 : 0, isDeferredMove);
    this.postSpecialPause = 4;
    this._comboCount  = 0;
    this._comboDamage = 0;
    this._idleTicks   = 0;
    // Anti-repeat tracking
    this._lastLastSpecial = this._lastSpecial;
    this._lastSpecial     = move;
    // Combo chain + multiversal cooldown grouping
    const _MELEE_CLASS = new Set(['slash','grasp','chain','calcStrike','shockwave','collapseStrike','phaseShift']);
    if (_MELEE_CLASS.has(move)) {
      this._consecutiveMeleeCount++;
    } else {
      this._consecutiveMeleeCount = 0;
      // After a multiversal ability, require 2 AI ticks (~0.5s) of melee-only before next multiversal
      this._multiversalGroupCd = 2;
    }
    // Director: specials add intensity
    if (typeof directorAddIntensity === 'function') directorAddIntensity(0.18);
    // Phase-based cooldown multiplier — phase 3 recharges ~45% faster
    const phase  = this.getPhase();
    // Final state (post-false-victory): halved cooldowns, boosted speed
    const _finalMult = (typeof tfFinalStateActive !== 'undefined' && tfFinalStateActive) ? 0.5 : 1.0;
    const cdMult = (phase === 3 ? 0.55 : phase === 2 ? 0.75 : 1.0) * _finalMult * 0.6;
    // Burst mode: halve post-special pause so attacks chain faster
    const _burstActive = this._aggressionBurstTimer > 0;
    switch (move) {
      // ── NEW: Void Grasp ─────────────────────────────────────
      case 'grasp': {
        this._graspCd = Math.ceil(50 * cdMult);
        this.postSpecialPause = 6;
        showBossDialogue('Gravity is not on your side.', 180);
        screenShake = Math.max(screenShake, 22);
        spawnParticles(this.cx(), this.cy(), '#440044', 22);
        spawnParticles(this.cx(), this.cy(), '#ffffff',  8);
        // Pull all non-boss players toward the boss
        for (const p of players) {
          if (p.isBoss || p.health <= 0) continue;
          const ddx = this.cx() - p.cx();
          const ddy = (this.y + this.h * 0.5) - (p.y + p.h * 0.5);
          const dd  = Math.hypot(ddx, ddy);
          if (dd < 280 && dd > 1) {
            const pull = 20 * (1 - dd / 280);
            p.vx = (ddx / dd) * pull;
            p.vy = (ddy / dd) * pull * 0.5 - 4;
          }
        }
        // Telegraph: show slam impact zone at boss position for the pull duration
        bossWarnings.push({ type: 'circle', x: this.cx(), y: this.cy(), r: 120,
          color: '#ff00ff', timer: 45, maxTimer: 45, label: 'SLAM INCOMING!' });
        // Schedule a slam hit after the pull lands (~45 frames)
        tfGraspSlam = { timer: 45 };
        break;
      }
      // ── NEW: Reality Slash — DEFERRED with telegraph ────────
      case 'slash': {
        this._slashCd = Math.ceil(16 * cdMult);
        this.postSpecialPause = 5;
        // Telegraph: show red X + slash cone at the target's current position (30 frames)
        const behindOff = (target.facing || 1) * 55;
        const warnX = clamp(target.cx() + behindOff, 20, GAME_W - 20);
        const warnY = clamp(target.y + target.h * 0.5, 20, 450);
        bossWarnings.push({ type: 'cross',  x: target.cx(), y: target.cy(),
          r: 30, color: '#ffffff', timer: 30, maxTimer: 30, label: 'TELEPORT!' });
        bossWarnings.push({ type: 'circle', x: warnX, y: warnY,
          r: 80, color: '#ff0044', timer: 30, maxTimer: 30, label: 'SLASH ZONE' });
        // Store pending slash; execute teleport+damage after telegraph
        this._pendingSlash = { timer: 30, target, behindOff };
        showBossDialogue('I was already there.', 100);
        break;
      }
      // ── NEW: Gravity Well ───────────────────────────────────
      case 'well': {
        this._wellCd = Math.ceil(36 * cdMult);
        this.postSpecialPause = 5;
        const wellX = GAME_W / 2 + (Math.random() - 0.5) * 200;
        const wellY = 320 + Math.random() * 60;
        tfGravityWells.push({ x: wellX, y: wellY, r: 200, timer: 270, maxTimer: 270, strength: 16, bossRef: this });
        // Telegraph: pulsing danger ring at well spawn location
        bossWarnings.push({ type: 'circle', x: wellX, y: wellY,
          r: 200, color: '#8800ff', timer: 40, maxTimer: 40, label: 'GRAVITY WELL!' });
        screenShake = Math.max(screenShake, 16);
        spawnParticles(wellX, wellY, '#440044', 28);
        spawnParticles(wellX, wellY, '#8800ff', 14);
        showBossDialogue('Everything falls toward me eventually.', 180);
        break;
      }
      // ── NEW: Meteor Crash ───────────────────────────────────
      case 'meteor': {
        this._meteorCd = Math.ceil(60 * cdMult);
        this.postSpecialPause = 10;
        this.vy  = -38;
        this.invincible = 170;
        tfMeteorCrash = {
          phase:   'rising',
          timer:   0,
          landX:   clamp(target.cx(), 80, GAME_W - 80),
          boss:    this,
          shadowR: 0,
        };
        spawnParticles(this.cx(), this.cy(), '#000000', 22);
        spawnParticles(this.cx(), this.cy(), '#ffffff', 10);
        showBossDialogue('Look up.', 220);
        break;
      }
      // ── NEW: Shadow Clone Barrage ───────────────────────────
      case 'clones': {
        this._cloneCd = Math.ceil(60 * cdMult);
        this.postSpecialPause = 4;
        tfClones = [];
        const realIdx = Math.floor(Math.random() * 3);
        for (let ci = 0; ci < 3; ci++) {
          const cx = 120 + Math.random() * (GAME_W - 240);
          tfClones.push({
            x: cx, y: target.y || 300,
            w: this.w, h: this.h,
            health: 1,
            timer:  420, // 7 seconds
            facing: Math.random() < 0.5 ? 1 : -1,
            attackTimer: 0, animTimer: 0,
            isReal: ci === realIdx,
            bossRef: this,
          });
          spawnParticles(cx, target.y || 300, '#333333', 16);
        }
        showBossDialogue('Choose carefully. Only one of me is the problem.', 220);
        break;
      }
      // ── NEW: Chain Slam Combo ───────────────────────────────
      case 'chain': {
        this._chainCd = Math.ceil(42 * cdMult);
        this.postSpecialPause = 9;
        screenShake = Math.max(screenShake, 18);
        showBossDialogue('Don\'t stop. Neither will I.', 160);
        tfChainSlam = { stage: 0, timer: 0, target };
        break;
      }
      case 'gravity':
        tfGravityInverted = !tfGravityInverted;
        tfGravityTimer    = tfGravityInverted ? 240 : 0; // 4s hard cap (was 10s)
        // Sync gravityState failsafe so the loop.js cap always fires
        if (tfGravityInverted) {
          gravityState.active   = true;
          gravityState.type     = 'reverse';
          gravityState.timer    = 0;
          gravityState.maxTimer = 240;
        } else {
          forceResetGravity();
        }
        this._gravityCd = Math.ceil(48 * cdMult);
        showBossDialogue(tfGravityInverted ? 'Up is a direction. So is down. I decide which.' : 'The world is right-side up again. For now.', 180);
        spawnParticles(this.cx(), this.cy(), '#ffffff', 22);
        break;
      case 'warp': {
        _bossTeleportActor(this, (this.target ? this.target.cx() : this.cx()) + (Math.random() < 0.5 ? -140 : 140), this.y, { preferRaised: true });
        this._warpCd = Math.ceil(80 * cdMult);
        this._setAttackPhase('recovery', 18, false);
        showBossDialogue('Same arena. Different angle.', 150);
        break;
      }
      case 'holes':
        spawnTFBlackHoles();
        this._holeCd = Math.ceil(36 * cdMult);
        showBossDialogue('The void is hungry.', 110);
        break;
      case 'floor': {
        tfFloorRemoved = true;
        tfFloorTimer   = 1200; // 20 seconds at 60fps (tfFloorTimer is decremented every frame)
        this._floorCd  = Math.ceil(120 * cdMult);
        const floorPl = currentArena.platforms.find(p => p.isFloor);
        if (floorPl) floorPl.isFloorDisabled = true;
        showBossDialogue('The floor was a courtesy. Withdrawn.', 240);
        spawnParticles(GAME_W / 2, 465, '#000000', 30);
        spawnParticles(GAME_W / 2, 465, '#ffffff', 15);
        break;
      }
      case 'invert':
        // Apply a timed 10s inversion instead of a permanent toggle
        tfControlsInverted    = true;
        tfControlsInvertTimer = 600; // 10 seconds at 60fps
        this._invertCd = Math.ceil(36 * cdMult);
        showBossDialogue('Your instincts work for me now.', 180);
        spawnParticles(this.cx(), this.cy(), '#aaaaaa', 16);
        break;
      case 'size': {
        const t = this.target;
        if (t) {
          const scales = [0.4, 0.55, 0.7, 1.0, 1.25, 1.5];
          tfSetSize(t, scales[Math.floor(Math.random() * scales.length)]);
        }
        if (Math.random() < 0.45) {
          tfSetSize(this, clamp(0.5 + Math.random() * 0.9, 0.4, 1.5));
        }
        this._sizeCd = Math.ceil(32 * cdMult);
        showBossDialogue('Scale is just another variable.', 180);
        break;
      }
      case 'portal':
        tfPortalTeleport(this, target);
        this._portalCd = Math.ceil(24 * cdMult);
        break;
      // ── Teleport Combo — teleport to player 3× in quick succession, attack each time ──
      case 'teleportCombo': {
        this._teleportComboCd = Math.ceil(48 * cdMult);
        this.postSpecialPause = 8;
        showBossDialogue(randChoice(['I\'m everywhere. Choose one to dodge.', 'You can\'t track what owns the space.', 'Pick a direction. Wrong answer guaranteed.']), 200);
        screenShake = Math.max(screenShake, 18);
        spawnParticles(this.cx(), this.cy(), '#000000', 18);
        spawnParticles(this.cx(), this.cy(), '#ffffff', 10);
        // Schedule 3 rapid teleport-strikes (each 18 frames apart)
        this._pendingTeleportCombo = {
          hits:   3,
          gap:    18,  // frames between each strike
          timer:  6,   // frames until first strike
          target,
        };
        break;
      }
      // ── Gravity Crush — suck all players toward arena center, then explode outward ──
      case 'gravityCrush': {
        this._gravityCrushCd = Math.ceil(60 * cdMult);
        this.postSpecialPause = 10;
        showBossDialogue(randChoice(['Everything collapses inward.', 'All roads end here.', 'The center holds. You don\'t.']), 220);
        screenShake = Math.max(screenShake, 22);
        spawnParticles(GAME_W / 2, GAME_H / 2, '#440044', 30);
        spawnParticles(GAME_W / 2, GAME_H / 2, '#ffffff', 15);
        // Telegraph warning circle at arena center
        bossWarnings.push({ type: 'circle', x: GAME_W / 2, y: GAME_H / 2,
          r: 200, color: '#8800ff', timer: 60, maxTimer: 60, label: 'CRUSH!' });
        // Schedule the detonation after 60 frames of pull
        this._pendingGravityCrush = { timer: 60, boss: this };
        break;
      }
      // ── NEW: Shockwave Pulse — ground variant deferred with telegraph ────────
      case 'shockwave': {
        this._shockwaveCd = Math.ceil(20 * cdMult);
        this.postSpecialPause = 5;
        if (this.onGround) {
          // Telegraph: expanding warning ring on ground (20 frames ≈ 0.33s)
          bossWarnings.push({ type: 'circle', x: this.cx(), y: this.y + this.h,
            r: 340, color: '#aa00ff', timer: 20, maxTimer: 20, label: 'SHOCKWAVE!' });
          this._pendingShockwave = { timer: 20, boss: this };
        } else {
          // Air slam: crash down fast, wave spawns when landing
          this.vy = Math.max(this.vy, 24);
          tfShockwaves.push({
            x: this.cx(), y: this.y + this.h,
            r: 0, maxR: 0,
            timer: 1, maxTimer: 1,
            boss: this, hit: new Set(), pendingLanding: true,
          });
        }
        showBossDialogue(randChoice(['The world agrees with me.', 'Feel that? Everything does.', 'Ground-level reminder.', 'Even the arena bows.']), 140);
        break;
      }

      // ── PHASE SHIFT ─────────────────────────────────────────
      // Boss goes semi-transparent, spawns 3 position echoes.
      // After a delay one echo is real — boss snaps there and attacks.
      case 'phaseShift': {
        this._phaseShiftCd = Math.ceil(38 * cdMult);
        this.postSpecialPause = 8;
        this.invincible = 70;
        const realIdx = Math.floor(Math.random() * 3);
        const spread  = 180;
        const echoes  = [0, 1, 2].map(i => ({
          x: clamp(this.cx() + (i - 1) * spread + (Math.random() - 0.5) * 80, 60, GAME_W - 60),
          y: this.y + (Math.random() - 0.5) * 60,
          // Fake echoes drift slightly to confuse the player; real echo stays put
          driftVx: i !== realIdx ? (Math.random() - 0.5) * 1.4 : 0,
          driftVy: i !== realIdx ? (Math.random() - 0.5) * 0.6 : 0,
        }));
        tfPhaseShift = { timer: 0, maxTimer: 70, echoes, realIdx, revealed: false, bossRef: this };
        screenShake  = Math.max(screenShake, 10);
        // Chain: calcStrike immediately after reappearing
        if (!this._pendingChainMove) this._pendingChainMove = { move: 'calcStrike', delay: 80 };
        showBossDialogue(randChoice(['Perception is a luxury.', 'Pick one. One of them will hurt you.', 'Reality is negotiable.']), 160);
        break;
      }

      // ── REALITY TEAR ────────────────────────────────────────
      // A crack opens in space between boss and player.
      // It pulls the player toward it, then snaps shut cleanly — no residue.
      case 'realityTear': {
        this._realityTearCd = Math.ceil(44 * cdMult);
        this.postSpecialPause = 7;
        const midX = (this.cx() + target.cx()) / 2;
        const midY = (this.cy() + target.cy()) / 2;
        tfRealityTear = { x: midX, y: midY, timer: 0, maxTimer: 90, phase: 'warn',
                          bossRef: this, targetRef: target };
        bossWarnings.push({ type: 'circle', x: midX, y: midY, r: 60,
          color: '#cc00ff', timer: 20, maxTimer: 20, label: 'REALITY TEAR!' });
        screenShake = Math.max(screenShake, 8);
        showBossDialogue(randChoice(['Space has seams. I pull them.', 'The fabric has always been mine.', 'I wrote the rules of distance.']), 150);
        break;
      }

      // ── CALCULATED STRIKE ────────────────────────────────────
      // Shows a math thought bubble (boss "calculating"), then teleports
      // to the player's predicted future position and strikes.
      case 'calcStrike': {
        this._calcStrikeCd = Math.ceil(28 * cdMult);
        this.postSpecialPause = 6;
        const MATH_EXPRESSIONS = [
          'T_μν = (8πG/c⁴)G_μν', 'ψ(x,t) = Ae^{i(kx−ωt)}',
          '∇×B − ∂E/∂t = μ₀J', 'S = ∫L dt → δS=0',
          'Ĥ|ψ⟩ = iℏ ∂|ψ⟩/∂t', '∂²φ/∂t² = c²∇²φ',
          'R_μν − ½Rg_μν + Λg_μν = 8πT_μν',
          'Z = Tr[e^{−βĤ}]', '⟨x|p⟩ = e^{ipx/ℏ}/√(2πℏ)',
          'dS ≥ 0, ΔS = k_B ln Ω',
        ];
        const bubbleText = MATH_EXPRESSIONS[Math.floor(Math.random() * MATH_EXPRESSIONS.length)];
        const predictX = clamp(target.cx(), 40, GAME_W - 40);
        const predictY = clamp(target.cy(), 40, GAME_H - 40);
        tfGhostPaths = {
          timer: 0, maxTimer: 40,
          paths: [
            {
              pts: [{ x: target.cx(), y: target.cy() },
                    { x: clamp(target.cx() + 120, 30, GAME_W - 30), y: target.cy() - 12 }],
              selected: false, alpha: 0.22,
            },
            {
              pts: [{ x: target.cx(), y: target.cy() },
                    { x: clamp(target.cx() - 120, 30, GAME_W - 30), y: target.cy() + 12 }],
              selected: false, alpha: 0.22,
            },
            {
              pts: [{ x: target.cx(), y: target.cy() },
                    { x: predictX, y: predictY }],
              selected: true, alpha: 0.85,
            },
          ],
        };
        const strikeDelay = 38;
        tfMathBubble = { text: bubbleText, timer: 0, maxTimer: 38, x: this.cx(), y: this.y - 18 };
        tfCalcStrike = { timer: 0, maxTimer: Math.max(strikeDelay + 14, 55), predictX, predictY,
                         fired: false, strikeDelay, targetRef: target };
        showBossDialogue('I know where you end up.', 140);
        break;
      }

      // ── REALITY OVERRIDE — boss rewrites game state ──────────────
      // Briefly freezes game, teleports player close, executes attack chain.
      // Player can dodge with jump/shield during the 20-frame execute window.
      case 'realityOverride': {
        this._realityOverrideCd = Math.ceil(65 * cdMult);
        this.postSpecialPause   = 12;
        hitStopFrames = Math.max(hitStopFrames, 14);
        showBossDialogue(randChoice(['I wrote this moment.', 'This world listens to me.', 'The script says you lose here.', 'Nothing happens without my permission.']), 210);
        screenShake = Math.max(screenShake, 22);
        spawnParticles(this.cx(), this.cy(), '#000000', 28);
        spawnParticles(this.cx(), this.cy(), '#ffffff', 14);
        tfRealityOverride = { timer: 0, maxTimer: 70, bossRef: this, targetRef: target, phase: 'freeze',
                              attacksFired: 0 };
        break;
      }

      // ── COLLAPSE STRIKE — slowmo + devastating teleport hit ─────
      case 'collapseStrike': {
        this._collapseStrikeCd = Math.ceil(55 * cdMult);
        this.postSpecialPause  = 8;
        showBossDialogue('Time to end this sentence.', 160);
        slowMotion   = 0.08;
        hitSlowTimer = 25;
        screenShake  = Math.max(screenShake, 14);
        spawnParticles(this.cx(), this.cy(), '#000000', 22);
        spawnParticles(this.cx(), this.cy(), '#ffffff', 10);
        // Crosshair telegraph at target's current position
        bossWarnings.push({ type: 'cross', x: target.cx(), y: target.cy(),
          r: 22, color: '#ffffff', timer: 22, maxTimer: 22, label: 'COLLAPSE!' });
        // Schedule the actual strike after 22 frames (during slowmo)
        this._pendingCollapseStrike = { timer: 22, target };
        break;
      }

      // ── GRAB CINEMATIC — short scripted grab + throw ─────────────
      case 'grabCinematic': {
        this._grabCinCd       = Math.ceil(80 * cdMult);
        this.postSpecialPause = 10;
        showBossDialogue(randChoice(['You\'re not going anywhere.', 'Running is exhausting. Stop.', 'I prefer you close.', 'There you are.']), 170);
        startCinematic(_makeTFGrabCinematic(this, target));
        break;
      }

      // ── GAMMA RAY BEAM ─────────────────────────────────────────────────
      // 42-frame telegraph (thin glowing line across full arena), then 40-frame beam.
      // Beam fires at a fixed Y; player must jump above or duck below.
      case 'gammaBeam': {
        this._gammaBeamCd = Math.ceil(40 * cdMult);
        this.postSpecialPause = 14;
        // charge phase first — tracks player Y live, then locks
        tfGammaBeam = {
          phase: 'charge', timer: 0, maxTimer: 28,
          trackY: clamp(target.y + target.h * 0.45, 120, 440),
          y: 0, hit: new Set(),
          chargeX: this.cx(), chargeY: this.cy() + this.h * 0.45,
          bossRef: this,
        };
        screenShake = Math.max(screenShake, 6);
        showBossDialogue(randChoice(['Don\'t move. Too late — don\'t move.', 'Light travels at my pace now.', 'Burning is a kind word for this.', 'The beam doesn\'t ask.']), 240);
        break;
      }

      // ── NEUTRON STAR ───────────────────────────────────────────────────
      // Pull phase (5s): gravity increased, jump height halved.
      // Slam phase: boss rises off-screen, warns with shadow, crashes down as AoE.
      case 'neutronStar': {
        this._neutronStarCd = Math.ceil(52 * cdMult);
        this.postSpecialPause = 16;
        tfNeutronStar = {
          phase: 'charge', timer: 0, maxTimer: 22, // charge first
          bossRef: this, startX: this.cx(),
        };
        screenShake = Math.max(screenShake, 10);
        spawnParticles(this.cx(), this.cy(), '#ffaa00', 16);
        showBossDialogue(randChoice(['Gravity bends. You follow.', 'A dying star still commands everything near it.', 'Weight is just another word for power.', 'Pull.']), 220);
        if (typeof playCinematicAttack === 'function' && cinematicsEnabled) {
          const _nsTarget = typeof players !== 'undefined' ? players.find(p => !p.isBoss && p.health > 0) : null;
          playCinematicAttack({
            attacker: this,
            target: _nsTarget,
            attackName: 'neutronStar',
            ...CINEMATIC_PRESETS.NEUTRON_STAR,
          });
        }
        break;
      }

      // ── GALAXY SWEEP ───────────────────────────────────────────────────
      // Two rotating danger arms sweep the arena for 3s. Player must stay in gaps.
      case 'galaxySweep': {
        this._galaxySweepCd = Math.ceil(44 * cdMult);
        this.postSpecialPause = 14;
        tfGalaxySweep = {
          angle: 0, speed: 0.008, // starts slow, accelerates
          timer: 0, maxTimer: 260,
          hit: new Set(),
          cx: GAME_W / 2, cy: GAME_H / 2 - 30,
          phase: 'charge', chargeTimer: 0, chargeMax: 24,
          bossRef: this,
        };
        screenShake = Math.max(screenShake, 10);
        spawnParticles(GAME_W / 2, GAME_H / 2 - 30, '#440066', 20);
        showBossDialogue(randChoice(['The universe rotates around me. Not a metaphor.', 'Everything spirals back to me.', 'I built this galaxy. It cleans on command.', 'Spin.']), 200);
        if (typeof playCinematicAttack === 'function' && cinematicsEnabled) {
          const _gsTarget = typeof players !== 'undefined' ? players.find(p => !p.isBoss && p.health > 0) : null;
          playCinematicAttack({
            attacker: this,
            target: _gsTarget,
            attackName: 'galaxySweep',
            ...CINEMATIC_PRESETS.BOSS,
          });
        }
        break;
      }

      // ── MULTIVERSE FRACTURE ────────────────────────────────────────────
      // True timeline-echo system:
      //   show    (0-70):   3 live player clones appear at spatial offsets, boss ghosts mirror
      //   select  (70-110): boss highlights ONE clone as the "real" timeline, locks its X
      //   collapse(110-140): all other timelines shatter with particles
      //   strike  (140-190): boss fires at the locked X — player must have dodged away
      case 'multiverseFracture': {
        this._multiverseCd = Math.ceil(50 * cdMult);
        this.postSpecialPause = 16;

        // 3 clone offsets (left / center / right). Player's REAL body is always at 0.
        // Boss will select one of these offsets as the "target" — strikes that absolute X.
        const CLONE_OFFSETS = [-200, 0, 200];          // spatial X offsets from player
        const realIdx = Math.floor(Math.random() * CLONE_OFFSETS.length);

        // Boss ghost mirrors: symmetric reflections so boss also looks "duplicated"
        const bossGhosts = [
          { offsetX: -(this.cx() - GAME_W * 0.25) },   // left mirror
          { offsetX:  (GAME_W * 0.75 - this.cx()) },   // right mirror
        ];

        tfMultiverse = {
          phase: 'show', timer: 0, maxTimer: 190,
          bossRef: this, targetRef: target,
          cloneOffsets: CLONE_OFFSETS,
          clonePlans: ['advance', 'retreat', 'jump'],
          realIdx,             // which offset the boss will target
          strikeX: 0,          // locked absolute X (set at start of 'select')
          strikeY: 0,          // locked absolute Y
          bossGhosts,
          shards: [],          // lightweight shard particles spawned on collapse
          hit: false,
          focusAlpha: 0,
        };

        screenShake = Math.max(screenShake, 14);
        slowMotion   = 0.55;
        hitSlowTimer = 30;
        spawnParticles(target.cx(), target.cy(), '#00ccff', 18);
        spawnParticles(target.cx(), target.cy(), '#ffffff',  8);
        showBossDialogue(
          randChoice(['Every version of you loses.', 'I\'ve seen all the timelines. None of them end well for you.', 'Pick a reality. They\'re all wrong.', 'Every path leads here.']), 260
        );
        break;
      }

      // ── SUPERNOVA (rare — triggers once at <25% HP) ────────────────────
      // buildup → implosion → active shockwave (r=0→340)
      // Safe zone: stay within 45px of boss (inside the core)
      case 'supernova': {
        this._supernovaCd = 9999; // one-time use per fight
        this.postSpecialPause = 22;
        slowMotion   = 0.14;
        hitSlowTimer = 55;
        tfSupernova = {
          phase: 'buildup', timer: 0, maxTimer: 70,
          bossRef: this, hit: new Set(), r: 0,
        };
        bossWarnings.push({ type: 'circle', x: this.cx(), y: this.cy(),
          r: 340, color: '#ffdd00', timer: 65, maxTimer: 65, label: '⚠ SUPERNOVA — STAY CLOSE!' });
        screenShake = Math.max(screenShake, 20);
        spawnParticles(this.cx(), this.cy(), '#ffff88', 30);
        spawnParticles(this.cx(), this.cy(), '#ffffff', 16);
        showBossDialogue('Stars die like this. So do you.', 360);
        break;
      }

      // ── DEPTH PHASE SHIFT STRIKE — shift to target's Z layer then attack ──
      // TrueForm copies the player's exact Z, closes in, and lands a guaranteed hit.
      case 'depthPhaseShift': {
        this._depthPhaseShiftCd = Math.ceil(38 * cdMult);
        this.postSpecialPause   = 8;
        if (!target || target.health <= 0) break;
        const _tz = target.z || 0;
        // Snap TrueForm to the same Z layer as the player (no escape via layer switch)
        this.z = _tz;
        screenShake = Math.max(screenShake, 14);
        spawnParticles(this.cx(), this.cy(), '#000000', 12);
        spawnParticles(this.cx(), this.cy(), '#8844ff',  8);
        // Teleport to just behind the player (same approach as 'slash')
        const _psDir  = target.cx() > this.cx() ? 1 : -1;
        const _psDestX = clamp(target.cx() - _psDir * 38, 20, GAME_W - 20);
        this.x = _psDestX - this.w * 0.5;
        this.y = target.y;
        this.facing = _psDir;
        // Visual burst at landing point
        spawnParticles(this.cx(), this.cy(), '#ffffff', 10);
        // Schedule direct melee hit (next frame — attacker and target are now same Z)
        this._pendingChainMove = { move: 'slash', delay: 2 };
        showBossDialogue(randChoice([
          'Same layer. Nowhere to go.',
          'I follow you everywhere.',
          'Depth means nothing to me.',
          'You chose this layer. I choose it too.',
        ]), 160);
        bossWarnings.push({ type: 'cross', x: target.cx(), y: target.cy(),
          r: 28, color: '#ff0088', timer: 18, maxTimer: 18, label: 'LAYER LOCKED!' });
        break;
      }

      // ── MULTI-LAYER FAKE — afterimages at different Z values; only one is real ──
      // Spawns 2 shadow copies at z = -0.6 and +0.6; TrueForm stays at z = 0.
      // Clones vanish after 3 s; only the real copy (z=0) deals damage.
      case 'depthLayerFake': {
        this._depthLayerFakeCd = Math.ceil(54 * cdMult);
        this.postSpecialPause  = 10;
        // True form stays at its current Z (default 0 if not in depth phase)
        const _realZ = this.z || 0;
        // Place two fake clones at symmetric Z offsets
        const _fakeZs = [_realZ - 0.6, _realZ + 0.6].map(v => Math.max(-1, Math.min(1, v)));
        // Re-use tfClones array (same structure as Shadow Clones)
        for (const fz of _fakeZs) {
          tfClones.push({
            x:           this.x,
            y:           this.y,
            w:           this.w,
            h:           this.h,
            health:      1,   // dies instantly if hit
            timer:       180, // 3 s lifetime
            facing:      this.facing,
            attackTimer: 0,
            animTimer:   Math.random() * Math.PI * 2,
            isReal:      false,
            z:           fz,    // depth layer tag (read by draw/hit code)
            _isDepthFake: true, // flag so clone update doesn't move independently
          });
        }
        screenShake = Math.max(screenShake, 12);
        spawnParticles(this.cx(), this.cy(), '#8844ff', 18);
        spawnParticles(this.cx(), this.cy(), '#000000', 10);
        showBossDialogue(randChoice([
          'Which one is real? Guess fast.',
          'Three layers. One truth.',
          'Find me — if depth lets you.',
          'This is how I vanish.',
        ]), 180);
        // Warn player that multiple Z-layer entities just appeared
        bossWarnings.push({ type: 'circle', x: this.cx(), y: this.cy(),
          r: 80, color: '#aa00ff', timer: 40, maxTimer: 40, label: 'MULTI-LAYER FAKE!' });
        break;
      }

      // ── DEPTH PUNISH — fires when player camps the same Z layer too long ──
      // Strikes into that exact Z with an unavoidable beam column.
      case 'depthPunish': {
        this._depthPunishCd = Math.ceil(48 * cdMult);
        this.postSpecialPause = 6;
        if (!target || target.health <= 0) break;
        const _dpZ = target.z || 0;
        // Shift TrueForm to the player's Z layer
        this.z = _dpZ;
        // Wide vertical beam locked on the player's X (re-uses bossBeams infrastructure)
        // Telegraph for 20 frames then active for 60 frames
        bossBeams.push({
          x:            target.cx(),
          warningTimer: 20,
          activeTimer:  0,
          phase:        'warning',
          done:         false,
          _depthZ:      _dpZ,  // only hits entities at this Z layer
          _ownerRef:    this,
        });
        screenShake = Math.max(screenShake, 18);
        spawnParticles(target.cx(), target.cy(), '#ff0044', 20);
        spawnParticles(target.cx(), target.cy(), '#ffffff',  8);
        showBossDialogue(randChoice([
          'You stayed too long in one place.',
          'I know where you are. In every dimension.',
          'Same layer. Same fate.',
          'Predictable. Even across depth.',
        ]), 180);
        bossWarnings.push({ type: 'circle', x: target.cx(), y: target.cy(),
          r: 60, color: '#ff0044', timer: 20, maxTimer: 20, label: 'DEPTH PUNISH!' });
        // Reset the still-Z counter for this player so it doesn't re-trigger immediately
        const _dpIdx = players.findIndex(p => p === target);
        if (_dpIdx >= 0 && typeof tfDepthPlayerStillZ !== 'undefined') {
          tfDepthPlayerStillZ[_dpIdx] = { z: _dpZ, frames: 0 };
        }
        break;
      }

      // ── DIMENSION SHIFT — toggle game between 2D and 3D perspective ──
      case 'dimension': {
        this._dimensionCd = Math.ceil(110 * cdMult);
        this.postSpecialPause = 18;
        // Only launch if no dimension punch already active and a valid target exists
        if (!tfDimensionPunch && target && target.health > 0) {
          const punchDir = target.cx() > this.cx() ? 1 : -1;
          tfDimensionPunch = {
            stage:       0,      // 0=approach, 1=impact, 2=launch, 3=travel, 4=slam, 5=done
            timer:       0,
            target,
            boss:        this,
            launchDir:   punchDir,
            travelTimer: 0,
            bgPhase:     0,
            bgFlashTimer: 0,
            inputLocked: true,
          };
          // Step 0: boss charges toward player
          this.vx = punchDir * 28;
          this.vy = -4;
          screenShake = Math.max(screenShake, 10);
          spawnParticles(this.cx(), this.cy(), '#000000', 14);
          spawnParticles(this.cx(), this.cy(), '#8800ff', 8);
          showBossDialogue(randChoice([
            'You will see other worlds.',
            'Every dimension will know your name.',
            'Travel. Whether you want to or not.',
            'There is nowhere that isn\'t mine.',
          ]), 200);
        }
        break;
      }
    }
    // Burst mode: halve post-special pause so specials chain faster
    if (_burstActive) this.postSpecialPause = Math.max(1, Math.floor(this.postSpecialPause * 0.5));

    // Adaptation boost: successfully landing a special reads the player → small AL gain
    this.adaptationLevel = Math.min(100, this.adaptationLevel + 0.6);
    if (!isDeferredMove && this._tfAttackState.name === move) {
      this._setAttackPhase('recovery', Math.max(10, this.postSpecialPause * 10), false);
    }
    return true;
};
