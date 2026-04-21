'use strict';
// smb-trueform-ending-update.js — updateTFEnding state machine, _tfeResumeAfterIntro, _tfeUnlockPatrolMode, trySkipTFEnding
// Depends on: smb-globals.js, smb-particles-core.js, smb-combat.js

// ── Update ────────────────────────────────────────────────────────────────────
function updateTFEnding() {
  const sc = tfEndingScene;
  if (!sc) return;
  sc.timer++;
  const t = sc.timer;

  // ── REALIZATION ─────────────────────────────────────────────────────────────
  if (sc.phase === 'realization') {
    // Cycle through 3 dialogue lines, each 100 frames
    const lineLen = 100;
    const totalLines = sc.realizationDialogue.length;
    const lineIdx = Math.floor(t / lineLen);
    const lineT   = t % lineLen;
    sc.dialogueIdx   = Math.min(lineIdx, totalLines - 1);
    sc.dialogueAlpha = lineT < 15  ? lineT / 15 :
                       lineT < 70  ? 1 :
                       lineT < 95  ? 1 - (lineT - 70) / 25 : 0;

    // Spawn bouncing "0" damage pops at boss position (simulating attacks doing nothing)
    if (t % 18 === 5 && _tfeZeroPops.length < 12) {
      _tfeZeroPops.push({
        x:     sc.boss.cx() + (Math.random() - 0.5) * 60,
        y:     sc.boss.cy() - 20,
        vy:   -3 - Math.random() * 2,
        alpha: 1,
        timer: 0,
        bounces: 0,
      });
    }
    // Update zero pops
    for (let i = _tfeZeroPops.length - 1; i >= 0; i--) {
      const zp = _tfeZeroPops[i];
      zp.timer++;
      zp.vy += 0.35;
      zp.y  += zp.vy;
      if (zp.y > sc.boss.cy() + 10 && zp.vy > 0 && zp.bounces < 2) {
        zp.y  = sc.boss.cy() + 10;
        zp.vy = -Math.abs(zp.vy) * 0.55;
        zp.bounces++;
      }
      zp.alpha = Math.max(0, 1 - zp.timer / 55);
      if (zp.alpha <= 0) _tfeZeroPops.splice(i, 1);
    }

    if (t >= totalLines * lineLen + 20) {
      _tfeZeroPops = [];
      sc.phase = 'punch';
      sc.timer = 0;
      screenShake = 14;
    }
  }

  // ── PUNCH ───────────────────────────────────────────────────────────────────
  else if (sc.phase === 'punch') {
    const bx = sc.boss.cx(), by = sc.boss.cy();
    const hx = sc.hero.cx(), hy = sc.hero.cy();
    const punchDir = bx < hx ? 1 : -1; // direction hero will be launched

    // Frames 0–8: freeze + dramatic slow-motion buildup (anticipation)
    if (t < 8) {
      slowMotion = Math.max(0.05, 1 - t * 0.12);
    }

    // Frames 0–18: boss rushes toward hero with wind-up energy swirl
    if (t < 18) {
      sc.boss.x += (hx - bx - sc.boss.w / 2) * 0.22;
      sc.boss.y += (hy - by - sc.boss.h / 2) * 0.22;
      // Charge particles spiraling around boss
      if (settings.particles && t % 2 === 0 && particles.length < MAX_PARTICLES) {
        const _p = _getParticle();
        const ang = (t / 18) * Math.PI * 4;
        _p.x = sc.boss.cx() + Math.cos(ang) * 28;
        _p.y = sc.boss.cy() + Math.sin(ang) * 28;
        _p.vx = Math.cos(ang + 1.5) * 3; _p.vy = Math.sin(ang + 1.5) * 3;
        _p.color = Math.random() < 0.5 ? '#8800ff' : '#ffffff';
        _p.size = 2 + Math.random() * 3; _p.life = 14; _p.maxLife = 14;
        particles.push(_p);
      }
    }

    // Frame 18: time snaps back — IMPACT
    if (t === 18) {
      slowMotion = 1.0;
      sc.boss.attackTimer    = 22;
      sc.boss.attackDuration = 22;
      sc.boss.facing         = punchDir;
    }

    // Frame 22: PUNCH LANDS — directional blast
    if (t === 22) {
      screenShake = 75;
      // Shockwave at hero position
      CinFX.shockwave(hx, hy, '#ffffff', { count: 3, maxR: 280, lw: 6, dur: 60 });
      // Directional speed-line burst in punch direction
      CinFX.flash('#ffffff', 0.95, 14);
      spawnParticles(hx, hy, '#ffffff', 55);
      spawnParticles(hx, hy, '#8800ff', 25);
      spawnParticles(hx + punchDir * 30, hy, '#ffffff', 30);
      // Directional speed lines: particles blast in punch direction
      if (settings.particles) {
        for (let i = 0; i < 30 && particles.length < MAX_PARTICLES; i++) {
          const _p = _getParticle();
          _p.x = hx + (Math.random() - 0.5) * 20;
          _p.y = hy + (Math.random() - 0.5) * 20;
          _p.vx = punchDir * (10 + Math.random() * 14);
          _p.vy = (Math.random() - 0.5) * 4;
          _p.color = Math.random() < 0.6 ? '#ffffff' : '#8800ff';
          _p.size  = 1.5 + Math.random() * 4;
          _p.life  = 20 + Math.random() * 15; _p.maxLife = 35;
          particles.push(_p);
        }
      }
      SoundManager.heavyHit && SoundManager.heavyHit();
      // Camera snap to launch direction
      cinematicCamOverride = true;
      cinematicZoomTarget  = 1.6;
      cinematicFocusX      = hx + punchDir * 80;
      cinematicFocusY      = hy - 20;
    }

    if (t >= 32) {
      sc.phase = 'launch';
      sc.timer = 0;
      sc.hero.invincible = 999999;
      sc.hero.backstageHiding = true;
      sc.heroScreenX = sc.hero.cx();
      sc.heroScreenY = sc.hero.cy();
      sc.heroPrevX   = sc.heroScreenX;
      sc.heroPrevY   = sc.heroScreenY;
      sc.bgPanelIdx  = 0;
      sc.bgPanelT    = 0;
      // Rebuild launch spline now that we know boss direction
      sc.launchPts = _tfeLaunchPts(sc.hero, sc.boss);
    }
  }

  // ── LAUNCH ──────────────────────────────────────────────────────────────────
  else if (sc.phase === 'launch') {
    const totalDur = 300;
    sc.launchT = Math.min(1, t / totalDur);
    // Ease-in acceleration
    const eased = sc.launchT * sc.launchT * (3 - 2 * sc.launchT);
    const pos = _tfeSpline(sc.launchPts, eased);
    sc.heroPrevX   = sc.heroScreenX;
    sc.heroPrevY   = sc.heroScreenY;
    sc.heroScreenX = pos.x;
    sc.heroScreenY = pos.y;

    // Cycle dimension panels based on progress
    const panelCount = _TFE_BG_PANELS.length;
    sc.bgPanelIdx = Math.min(panelCount - 1, Math.floor(sc.launchT * panelCount));

    // Reality tear grows as speed increases
    sc.tearAlpha = Math.min(0.65, sc.launchT * 1.1);

    // Panel-transition flash
    const expectedPanel = Math.floor(sc.launchT * panelCount);
    if (expectedPanel > (sc._lastPanel || 0)) {
      sc._lastPanel = expectedPanel;
      CinFX.flash('#ffffff', 0.45, 6);
      screenShake = 18 + expectedPanel * 4;
    }

    // Trail particles
    if (t % 2 === 0) {
      const _p = _getParticle();
      _p.x = pos.x + (Math.random()-0.5)*18; _p.y = pos.y + (Math.random()-0.5)*18;
      _p.vx = (Math.random()-0.5)*3; _p.vy = (Math.random()-0.5)*3;
      _p.color = Math.random() < 0.5 ? '#ffffff' : '#8888ff';
      _p.size = 2 + Math.random()*6; _p.life = 28 + Math.random()*22; _p.maxLife = 50;
      particles.push(_p);
    }

    _tfeCamFocus(pos.x, pos.y, 1.45);

    if (t >= totalDur) {
      sc.phase = 'coderealm';
      sc.timer = 0;
      sc.hero.backstageHiding = true;
      sc.boss.backstageHiding = true;  // hide TF so it doesn't attack in background
      sc.hero.invincible = 999999;  // full immunity for entire coderealm phase
      sc.crHeroX  = GAME_W / 2;
      sc.crHeroY  = GAME_H * 0.52;
      sc.crHeroVY = 0;
      sc.nodesCorrupted = 0;
      _tfeInitRain();
      _tfeCamFocus(GAME_W / 2, GAME_H / 2, 1.0);
      CinFX.flash('#000000', 1.0, 18);
    }
  }

  // ── CODEREALM ───────────────────────────────────────────────────────────────
  else if (sc.phase === 'coderealm') {
    sc.rainAlpha = Math.min(0.92, t / 50);

    // Keep hero fully immune to damage and hazards throughout coderealm
    sc.hero.invincible = 999999;

    // Free-flight physics — no gravity, directional control (jump=up, shield=down)
    const ctrl = sc.hero.controls;
    if (ctrl) {
      const spd = 3.8;
      if (keysDown.has(ctrl.left))  sc.crHeroX -= spd;
      if (keysDown.has(ctrl.right)) sc.crHeroX += spd;
      const fUp   = keysDown.has(ctrl.jump);
      const fDown = keysDown.has(ctrl.shield);
      sc.crHeroVY = fUp ? -6 : (fDown ? 6 : sc.crHeroVY * 0.7);
      sc.crHeroY += sc.crHeroVY;
      sc.crHeroX = Math.max(12, Math.min(GAME_W - 12, sc.crHeroX));
      sc.crHeroY = Math.max(18, Math.min(GAME_H - 18, sc.crHeroY));
    }

    // Update node pulse
    for (const nd of sc.codeNodes) {
      nd.pulse += 0.07;
      if (nd.hitTimer > 0) nd.hitTimer--;
    }

    // Corrupt node on proximity contact — no attack required, generous radius
    for (const nd of sc.codeNodes) {
      if (!nd.corrupted) {
        const dx = nd.x - sc.crHeroX, dy = nd.y - sc.crHeroY;
        if (Math.sqrt(dx*dx+dy*dy) < 80) {
          nd.corrupted = true;
          nd.hitTimer  = 30;
          sc.nodesCorrupted++;
          sc.crFlashTimer = 20;
          screenShake = 22;
          CinFX.flash('#00ff41', 0.55, 10);
          spawnParticles(nd.x, nd.y, '#00ff41', 18);
          spawnParticles(nd.x, nd.y, '#ffffff', 10);
          SoundManager.explosion && SoundManager.explosion();
          break;
        }
      }
    }

    if (sc.crFlashTimer > 0) sc.crFlashTimer--;

    // All nodes corrupted → proceed
    if (sc.nodesCorrupted >= 5 && t > 60) {
      // Transition after a beat
      if (!sc._crDoneTimer) sc._crDoneTimer = 0;
      sc._crDoneTimer++;
      if (sc._crDoneTimer === 1) {
        screenShake = 90;
        CinFX.flash('#00ff41', 0.85, 20);
        spawnParticles(GAME_W/2, GAME_H/2, '#00ff41', 80);
        spawnParticles(GAME_W/2, GAME_H/2, '#000000', 50);
        spawnParticles(GAME_W/2, GAME_H/2, '#ffffff', 40);
      }
      if (sc._crDoneTimer >= 60) {
        sc.phase = 'return';
        sc.timer = 0;
        sc.returnY  = -80;
        sc.returnVY = 3;
        sc.boss.backstageHiding = true;
        // Place hero back in arena visually
        const floor = currentArena && currentArena.platforms.find(pl => pl.isFloor && !pl.isFloorDisabled);
        const floorY = floor ? floor.y : GAME_H - 30;
        sc.hero.x = GAME_W / 2 - sc.hero.w / 2;
        sc.hero.y = floorY - sc.hero.h;
        _tfeCamFocus(GAME_W / 2, GAME_H / 2, 1.1);
        CinFX.flash('#000000', 1.0, 16);
      }
    }

    // Rain animation
    for (const col of _tfeRainCols) {
      col.y += col.speed;
      if (col.y > GAME_H + 50) col.y = -Math.random() * 60;
      if (Math.random() < 0.025) {
        col.chars[Math.floor(Math.random() * col.chars.length)] =
          _TFE_CHARS[Math.floor(Math.random() * _TFE_CHARS.length)];
      }
    }
  }

  // ── RETURN ──────────────────────────────────────────────────────────────────
  else if (sc.phase === 'return') {
    // Hero descends back into arena through a dimensional tear in the sky
    sc.returnY  += sc.returnVY;
    sc.returnVY += 0.4;
    sc.rainAlpha = Math.max(0, sc.rainAlpha - 0.04);

    const floor = currentArena && currentArena.platforms.find(pl => pl.isFloor && !pl.isFloorDisabled);
    const floorY = floor ? floor.y : GAME_H - 30;

    if (sc.returnY >= floorY - sc.hero.h) {
      sc.returnY = floorY - sc.hero.h;
      sc.returnVY = 0;
      screenShake = 28;
      CinFX.flash('#ffffff', 0.55, 8);
      spawnParticles(GAME_W/2, floorY, '#ffffff', 20);
      // Intro mode: skip finisher/aura/powers/fall — go straight to fadeout
      if (sc.isIntro) {
        sc.phase = 'fadeout';
        sc.timer = 0;
        sc.hero.backstageHiding = false;
        sc.hero.x = GAME_W / 2 - sc.hero.w / 2;
        if (typeof showBossDialogue === 'function') showBossDialogue('NOW we begin.', 300);
        return;
      }
      sc.phase = 'finisher';
      sc.timer = 0;
      sc.hero.backstageHiding = false;
      sc.hero.x = GAME_W / 2 - sc.hero.w / 2;
      sc.hero.y = sc.returnY;
      sc.boss.backstageHiding = false;
      // Position boss facing hero
      sc.boss.x = GAME_W / 2 - sc.boss.w / 2 - 120;
      sc.boss.y = floorY - sc.boss.h;
      sc.finisherBossX = sc.boss.cx();
      sc.finisherBossY = sc.boss.cy();
      sc.finisherPrompt = 1;
    }
  }

  // ── FINISHER ─────────────────────────────────────────────────────────────────
  else if (sc.phase === 'finisher') {
    if (sc.finisherFlash > 0) sc.finisherFlash--;

    const neededHits = 3;
    // QTE: player must press attack at the right prompt
    if (sc.finisherHits < neededHits) {
      if (sc.finisherPrompt > 0 && _tfeFinAtkJust()) {
        sc.finisherHits++;
        sc.finisherFlash = 22;
        sc.finisherPrompt = 0;
        screenShake = 38 + sc.finisherHits * 10;
        CinFX.flash(_TFE_QTE_FLASH_COLORS[sc.finisherHits - 1] || '#ffffff', 0.7, 12);
        spawnParticles(sc.boss.cx(), sc.boss.cy(), '#ffffff', 30);
        spawnParticles(sc.boss.cx(), sc.boss.cy(), '#000000', 20);
        SoundManager.heavyHit && SoundManager.heavyHit();
        // Launch boss backward
        const dir = sc.boss.cx() < sc.hero.cx() ? -1 : 1;
        sc.finisherBossVX = dir * (8 + sc.finisherHits * 4);
        sc.finisherBossVY = -12 - sc.finisherHits * 3;
        // Re-prompt after boss lands
        sc._finisherPauseTimer = 0;
      }
    }

    // Animate boss ragdoll
    sc.finisherBossVY += 0.7;
    sc.finisherBossX  += sc.finisherBossVX;
    sc.finisherBossY  += sc.finisherBossVY;
    sc.finisherBossVX *= 0.88;
    const floor = currentArena && currentArena.platforms.find(pl => pl.isFloor && !pl.isFloorDisabled);
    const floorY = floor ? floor.y : GAME_H - 30;
    if (sc.finisherBossY >= floorY - sc.boss.h / 2) {
      sc.finisherBossY  = floorY - sc.boss.h / 2;
      sc.finisherBossVY = -Math.abs(sc.finisherBossVY) * 0.3;
      if (Math.abs(sc.finisherBossVY) < 1) sc.finisherBossVY = 0;
    }

    // Re-show prompt after boss settles and we haven't finished
    if (sc.finisherHits < neededHits && sc.finisherPrompt === 0) {
      if (!sc._finisherPauseTimer) sc._finisherPauseTimer = 0;
      sc._finisherPauseTimer++;
      if (sc._finisherPauseTimer > 30 && Math.abs(sc.finisherBossVY) < 2) {
        sc.finisherPrompt = 1;
        sc._finisherPauseTimer = 0;
      }
    }

    // After all hits and boss has settled
    if (sc.finisherHits >= neededHits) {
      if (!sc._finisherEndTimer) sc._finisherEndTimer = 0;
      sc._finisherEndTimer++;
      if (sc._finisherEndTimer === 40) {
        CinFX.flash('#000000', 0.7, 20);
      }
      if (sc._finisherEndTimer >= 80) {
        sc.phase = 'aura';
        sc.timer = 0;
        sc.auraX  = sc.finisherBossX;
        sc.auraY  = sc.finisherBossY;
        sc.boss.backstageHiding = true;
        _tfeAuraParticles = [];
        _tfeCamFocus(GAME_W/2, GAME_H/2, 1.2);
      }
    }
  }

  // ── AURA ────────────────────────────────────────────────────────────────────
  else if (sc.phase === 'aura') {
    const dur = 120;
    const frac = Math.min(1, t / dur);
    const hx = sc.hero.cx(), hy = sc.hero.cy();
    sc.auraX = sc.auraX + (hx - sc.auraX) * (frac * 0.08 + 0.01);
    sc.auraY = sc.auraY + (hy - sc.auraY) * (frac * 0.08 + 0.01);

    if (t % 2 === 0) {
      for (let i = 0; i < 3; i++) {
        const angle = Math.random() * Math.PI * 2;
        const rad   = 20 + Math.random() * 30;
        _tfeAuraParticles.push({
          x: sc.auraX + Math.cos(angle) * rad,
          y: sc.auraY + Math.sin(angle) * rad,
          vx: (hx - sc.auraX) * 0.04 + (Math.random()-0.5)*2,
          vy: (hy - sc.auraY) * 0.04 + (Math.random()-0.5)*2,
          life: 18 + Math.floor(Math.random()*12),
          maxLife: 30,
          r: 2 + Math.random() * 3,
        });
      }
    }
    for (let i = _tfeAuraParticles.length - 1; i >= 0; i--) {
      const ap = _tfeAuraParticles[i];
      ap.x += ap.vx; ap.y += ap.vy; ap.life--;
      if (ap.life <= 0) _tfeAuraParticles.splice(i, 1);
    }

    if (t === 90) { screenShake = 35; CinFX.flash('#000000', 0.55, 14); }
    if (t >= dur + 20) {
      sc.phase = 'powers';
      sc.timer = 0;
      _tfeAuraParticles = [];
      sc.hero._tfAuraGlow = true;
      localStorage.setItem('smc_patrolMode', '1');
      localStorage.setItem('smc_interTravel', '1');
      if (settings.experimental3D) localStorage.setItem('smc_view3D', '1');
      _tfeCamFocus(sc.hero.cx(), sc.hero.cy(), 1.5);
      sc.skippable = true;
    }
  }

  // ── POWERS ──────────────────────────────────────────────────────────────────
  else if (sc.phase === 'powers') {
    sc.powersAlpha = t < 30 ? t/30 : t < 200 ? 1 : Math.max(0, 1 - (t-200)/40);
    if (t >= 260) {
      sc.phase = 'fall';
      sc.timer = 0;
      sc.skippable = false;
      sc.heroFallAlpha = 1;
      _tfeCamFocus(sc.hero.cx(), sc.hero.cy(), 1.8);
    }
  }

  // ── FALL ────────────────────────────────────────────────────────────────────
  else if (sc.phase === 'fall') {
    sc.hero.vy += 1.2;
    sc.hero.x  += sc.hero.vx;
    sc.hero.y  += sc.hero.vy;
    sc.heroFallAlpha = Math.max(0, 1 - t / 80);
    if (t >= 90) {
      sc.phase = 'fadeout';
      sc.timer = 0;
    }
  }

  // ── FADEOUT ──────────────────────────────────────────────────────────────────
  else if (sc.phase === 'fadeout') {
    sc.heroFallAlpha = 0;
    if (t >= 80) {
      tfEndingScene = null;
      if (typeof cinematicCamOverride !== 'undefined') cinematicCamOverride = false;
      if (sc.isIntro) {
        _tfeResumeAfterIntro(sc);
      } else {
        _tfeUnlockPatrolMode();
        if (typeof activateParadoxCompanion === 'function') activateParadoxCompanion();
        endGame();
      }
    }
  }
}

// ── Resume gameplay after intro dimension-punch cinematic ─────────────────────
// Player returns from Code Realm to see TrueForm apparently dying.
// A shadow clone then executes a command to reset the fight (triggerFalseVictory).
function _tfeResumeAfterIntro(sc) {
  // Advance state machine to backstage — from here normal death/ending logic is allowed
  if (typeof tfCinematicState !== 'undefined') tfCinematicState = 'backstage';

  // Restore boss visually (shadow clone will resurrect it via triggerFalseVictory)
  if (sc.boss) {
    sc.boss.backstageHiding = false;
    sc.boss.vx = 0;
    sc.boss.vy = 0;
  }

  // Restore hero — player keeps the gauntlet (fists) after absorbing Paradox.
  // Paradox's power is expressed through raw combat, not weapons.
  if (sc.hero) {
    sc.hero.backstageHiding = false;
    sc.hero.invincible      = Math.max(sc.hero.invincible, 60);
    // Switch to gauntlet (fists) — the player fights bare-handed from here on.
    if (typeof WEAPONS !== 'undefined' && WEAPONS['gauntlet']) {
      sc.hero.weapon = WEAPONS['gauntlet'];
    }
    sc.hero.vx = 0;
    sc.hero.vy = 0;
  }

  // Shadow clone saves TrueForm: trigger fight reset sequence.
  // triggerFalseVictory shows the clone, resets boss to 10000 HP, and
  // activates Paradox fusion so player keeps Paradox's power for round 2.
  if (typeof triggerFalseVictory === 'function' &&
      typeof tfFalseVictoryFired !== 'undefined' && !tfFalseVictoryFired) {
    if (sc.boss) {
      sc.boss.health     = 51;   // keep alive; false victory will restore to 10000
      sc.boss.invincible = 9999;
    }
    triggerFalseVictory(sc.boss);
  } else {
    // Fallback: resume fight directly if false victory unavailable or already fired
    if (sc.boss) sc.boss.invincible = 90;
    if (typeof tfFinalStateActive !== 'undefined') tfFinalStateActive = true;
    if (typeof tfParadoxFused !== 'undefined') {
      tfParadoxFused      = true;
      tfFusionControlMode = 'player';
      if (typeof controlState !== 'undefined') controlState = 'player';
      if (typeof controlTimer !== 'undefined') controlTimer = 0;
    }
  }

  screenShake = Math.max(screenShake, 35);
  if (typeof CinFX !== 'undefined') CinFX.flash('#ffffff', 0.5, 14);

  // ── Depth Phase transition: trigger the Z-axis final phase ────────────────
  // Freeze player briefly (30 frames = 0.5s), then enable Z-movement.
  // This fires after the fight resets (false victory sequence) — the very last
  // phase of the True Form encounter.
  if (typeof tfDepthPhaseActive !== 'undefined') {
    tfDepthPhaseActive     = true;
    tfDepthTransitionTimer = 30;   // 0.5-second input freeze
    tfDepthEnabled         = false;
    tfDepthPlayerStillZ    = {};
    // Reset all entities' Z to 0 (center layer) at phase start
    if (typeof players !== 'undefined') {
      players.forEach(p => { p.z = 0; });
    }
    // Camera tilt: focus on center-field with a slight zoom-in
    if (typeof setCameraDrama === 'function') setCameraDrama('focus', 90, null, 1.08);
    // Screen distortion burst
    if (typeof cinScreenFlash !== 'undefined')
      cinScreenFlash = { color: '#440088', alpha: 0.4, timer: 16, maxTimer: 16 };
    screenShake = Math.max(screenShake, 20);
    spawnParticles(GAME_W * 0.5, GAME_H * 0.5, '#8844ff', 28);
    spawnParticles(GAME_W * 0.5, GAME_H * 0.5, '#000000', 18);
    if (typeof showBossDialogue === 'function')
      showBossDialogue('You broke my world. I\'ll break yours.', 220);
  }

  gameRunning = true;
  requestAnimationFrame(gameLoop);
}

// ── Unlock post-ending features ───────────────────────────────────────────────
function _tfeUnlockPatrolMode() {
  const pm = document.getElementById('modePatrol');
  if (pm) { pm.style.display = ''; pm.classList.add('tf-unlocked'); }
  const m3d = document.getElementById('mode3D');
  if (m3d) { m3d.style.display = ''; }
}

// ── Skip handler ──────────────────────────────────────────────────────────────
function trySkipTFEnding() {
  const sc = tfEndingScene;
  if (!sc || !sc.skippable) return false;
  sc.phase = 'fadeout';
  sc.timer = 0;
  sc.heroFallAlpha = 1;
  _tfeAuraParticles = [];
  if (typeof cinematicCamOverride !== 'undefined') cinematicCamOverride = false;
  return true;
}

