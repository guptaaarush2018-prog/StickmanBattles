'use strict';
// smb-paradox-absorption-update.js — Absorption update logic (_startAbsorptionThenPunch, updateTFAbsorption, absorption scene update/draw)
// Depends on: smb-globals.js, smb-paradox-class.js (and preceding splits in chain)

// ============================================================
// ABSORPTION  — Paradox energy flows into player after portal
// Triggered from _makeTFParadoxEntryCinematic.onEnd()
// ============================================================
function _startAbsorptionThenPunch(boss, hero) {
  // Guard: only start if paradox death cinematic has fully completed
  if (!paradoxDeathComplete) return;
  // Clear any pending dialogue so death-scene lines don't bleed into absorption text
  if (typeof bossDialogue !== 'undefined') bossDialogue.timer = 0;
  _tfAbsorptionState = { timer: 0, boss, hero };
  tfCinematicState   = 'absorption';
  if (hero) hero.invincible = Math.max(hero.invincible || 0, 9999);
  // Freeze game: blocks player input, boss AI, and all hazard damage
  gameFrozen = true;
}

function updateTFAbsorption() {
  if (!_tfAbsorptionState) return;
  const s = _tfAbsorptionState;
  s.timer++;
  const t = s.timer;

  const hx = s.hero ? s.hero.cx() : GAME_W / 2;
  const hy = s.hero ? s.hero.cy() : GAME_H / 2;

  // Particle stream from dissolution point toward hero
  if (t < 120 && settings.particles && particles.length < MAX_PARTICLES) {
    const srcX = GAME_W * 0.55, srcY = GAME_H / 2;
    const lerpT = Math.random();
    const _p = _getParticle();
    _p.x     = srcX + (hx - srcX) * lerpT + (Math.random() - 0.5) * 22;
    _p.y     = srcY + (hy - srcY) * lerpT + (Math.random() - 0.5) * 22;
    _p.vx    = (hx - srcX) / 80 * (1.5 + Math.random());
    _p.vy    = (hy - srcY) / 80 * (1.5 + Math.random());
    _p.color = Math.random() < 0.55 ? '#00ffff' : '#aa44ff';
    _p.size  = 1.5 + Math.random() * 3;
    _p.life  = 12 + Math.random() * 14;
    _p.maxLife = 26;
    particles.push(_p);
  }

  // t=60: big flash + power surge
  if (t === 60) {
    screenShake = Math.max(screenShake, 30);
    if (typeof CinFX !== 'undefined') CinFX.flash('#00ffff', 0.62, 20);
    if (typeof showBossDialogue === 'function')
      showBossDialogue("Paradox is gone. What remains is yours. Use it.", 280);
    if (s.hero && settings.particles) {
      for (let i = 0; i < 40 && particles.length < MAX_PARTICLES; i++) {
        const angle = Math.random() * Math.PI * 2;
        const spd   = 4 + Math.random() * 9;
        const _p    = _getParticle();
        _p.x = hx; _p.y = hy;
        _p.vx = Math.cos(angle) * spd; _p.vy = Math.sin(angle) * spd;
        _p.color = Math.random() < 0.5 ? '#00ffff' : '#ff00ff';
        _p.size  = 2 + Math.random() * 4; _p.life  = 30 + Math.random() * 30; _p.maxLife = 60;
        particles.push(_p);
      }
    }
    playerParadoxAbsorbed = true; // permanent glow flag
  }

  // t=110: explain survival
  if (t === 110) {
    if (typeof showBossDialogue === 'function')
      showBossDialogue("No weapon. No system. Just your hands. Finish it.", 320);
  }

  // t=170: hand off directly to punch cinematic — clear state AFTER startTFEnding
  // takes ownership so there is no gap frame between the two sequences.
  if (t >= 170) {
    if (!absorptionComplete) absorptionComplete = true;
    if (paradoxDeathComplete && absorptionComplete) {
      tfCinematicState = 'punch_transition';
      if (typeof startTFEnding === 'function') {
        startTFEnding(s.boss, true); // true = isIntro mode
      }
      _tfAbsorptionState = null; // clear only after handoff
    }
  }
}

// ============================================================
// ABSORPTION DRAW  — cyan aura on player during and after absorption
// ============================================================
function drawTFAbsorption() {
  if (!_tfAbsorptionState && !playerParadoxAbsorbed) return;

  const hero = _tfAbsorptionState
    ? _tfAbsorptionState.hero
    : (typeof players !== 'undefined' ? players.find(p => !p.isBoss && p.health > 0) : null);
  if (!hero) return;

  const frame = _tfAbsorptionState ? _tfAbsorptionState.timer : (typeof frameCount !== 'undefined' ? frameCount : 0);
  const pulse = 0.55 + Math.sin(frame * 0.15) * 0.45;

  ctx.save();
  if (_tfAbsorptionState) {
    // Active absorption: strong pulsing glow rings
    const intensity = Math.min(1, Math.max(0, (_tfAbsorptionState.timer - 40) / 30));
    if (intensity > 0) {
      for (let i = 0; i < 3; i++) {
        const r = 30 + i * 16 + Math.sin(frame * 0.1 + i * 1.2) * 8;
        ctx.globalAlpha = intensity * pulse * (0.55 - i * 0.14);
        ctx.strokeStyle = i % 2 === 0 ? '#00ffff' : '#aa44ff';
        ctx.lineWidth   = 3 - i * 0.5;
        ctx.shadowColor = '#00ffff';
        ctx.shadowBlur  = 30;
        ctx.beginPath();
        ctx.arc(hero.cx(), hero.cy(), r, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  } else {
    // Permanent subtle glow
    ctx.globalAlpha = pulse * 0.18;
    ctx.strokeStyle = '#00ffff';
    ctx.lineWidth   = 2;
    ctx.shadowColor = '#00ffff';
    ctx.shadowBlur  = 18;
    ctx.beginPath();
    ctx.arc(hero.cx(), hero.cy(), 30, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

// ============================================================
// ABSORPTION CINEMATIC v2  — memory-driven scene
// Phases: fade_in(0-40) → memories(40-130) → merge(130-175) → power_surge(175-210) → done(210+)
// Uses activeCinematic + gameFrozen so no gameplay occurs during the scene.
// Hands off to startTFEnding() when complete.
// ============================================================
function startTFAbsorptionScene(player, paradoxRef) {
  if (tfAbsorptionScene) return; // already running
  // Clear any pending boss dialogue so death-scene lines don't bleed into absorption
  if (typeof bossDialogue !== 'undefined') bossDialogue.timer = 0;
  const boss = typeof players !== 'undefined' ? players.find(p => p.isBoss && p.health > 0) : null;
  tfAbsorptionScene = {
    timer:      0,
    maxTimer:   220,
    playerRef:  player,
    paradoxRef: paradoxRef,
    bossRef:    boss,
    phase:      'fade_in',
    memoryIndex: 0,
    flashAlpha:  0,
    absorbed:    false
  };
  activeCinematic = true;
  gameFrozen      = true;
  tfCinematicState = 'absorption';
  if (player) player.invincible = Math.max(player.invincible || 0, 9999);
}

function updateTFAbsorptionScene() {
  const sc = tfAbsorptionScene;
  if (!sc) return;

  sc.timer++;

  // Keep player frozen
  if (sc.playerRef) {
    sc.playerRef.vx = 0;
    sc.playerRef.vy = 0;
  }

  //--------------------------------------------------
  // PHASE 1 — FADE IN (0–40)
  if (sc.timer < 40) {
    sc.phase = 'fade_in';
    sc.flashAlpha = Math.min(1, sc.timer / 40);
  }

  //--------------------------------------------------
  // PHASE 2 — MEMORY FLASHES (40–140)
  else if (sc.timer < 140) {
    sc.phase = 'memories';

    if (sc.timer % 20 === 0) {
      sc.memoryIndex++;
    }
  }

  //--------------------------------------------------
  // PHASE 3 — MERGE (140–180)
  else if (sc.timer < 180) {
    sc.phase = 'merge';

    // Pull paradox into player
    if (sc.paradoxRef && sc.playerRef) {
      const dx = sc.playerRef.cx() - sc.paradoxRef.cx();
      const dy = sc.playerRef.cy() - sc.paradoxRef.cy();

      sc.paradoxRef.x += dx * 0.08;
      sc.paradoxRef.y += dy * 0.08;
    }
  }

  //--------------------------------------------------
  // PHASE 4 — POWER SURGE (180–210)
  else if (sc.timer < 210) {
    sc.phase = 'power_surge';

    sc.flashAlpha = Math.sin(sc.timer * 0.4) * 0.5 + 0.5;
  }

  //--------------------------------------------------
  // END
  else {
    sc.phase = 'done';

    if (!sc.absorbed) {
      sc.absorbed = true;

      if (sc.playerRef) {
        sc.playerRef.paradoxPowered = true;
      }
    }

    // Hand off directly to punch cinematic — do NOT clear activeCinematic/gameFrozen
    // before startTFEnding runs, or a gap frame will flash between the two cinematics.
    if (typeof startTFEnding === 'function') {
      const _tfEndBoss = players.find(p => p.isBoss);
      startTFEnding(_tfEndBoss, true);
    }
    // Only clear after startTFEnding has taken ownership
    tfAbsorptionScene = null;
    activeCinematic   = false;
  }
}

function drawTFAbsorptionScene() {
  if (!tfAbsorptionScene) return;
  const s  = tfAbsorptionScene;
  const t  = s.timer;
  const hero = s.playerRef;
  if (!hero) return;

  const hx = hero.cx();
  const hy = hero.cy();

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0); // screen-space for overlay

  // Fade-in dark vignette
  if (s.phase === 'fade_in') {
    const a = Math.min(1, t / 40);
    ctx.globalAlpha = a * 0.38;
    ctx.fillStyle = '#000033';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  // Memories + merge: dark overlay behind the scene
  if (s.phase === 'memories' || s.phase === 'merge') {
    const fadeOut = s.phase === 'merge' ? Math.max(0, 1 - (t - 130) / 45) : 1;
    ctx.globalAlpha = 0.50 * fadeOut;
    ctx.fillStyle = '#000022';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  // Back to world-space for rings (drawn on top of fighters)
  ctx.restore();
  ctx.save();

  // Memory text (world-space, centered)
  if (s.phase === 'memories') {
    const memText = _TF_ABSORPTION_MEMORIES[s.memoryIndex] || '';
    const textAge = (t - 40) % 22;
    const textAlpha = textAge < 6 ? textAge / 6 : textAge > 16 ? Math.max(0, 1 - (textAge - 16) / 6) : 1;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = textAlpha * 0.88;
    ctx.font = 'italic 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#00ffff';
    ctx.shadowColor = '#00ffff';
    ctx.shadowBlur = 16;
    ctx.fillText(memText, canvas.width / 2, canvas.height / 2 - 80);
    ctx.restore();
  }

  // Pulsing absorption rings around player (world-space)
  if (s.phase === 'memories' || s.phase === 'merge' || s.phase === 'power_surge') {
    const ringProgress = s.phase === 'memories'
      ? Math.min(1, (t - 40) / 90)
      : s.phase === 'merge'
        ? 1.0
        : Math.max(0, 1 - (t - 175) / 35);
    const pulse = 0.5 + Math.sin(t * 0.18) * 0.5;
    for (let i = 0; i < 3; i++) {
      const r = 28 + i * 18 + Math.sin(t * 0.1 + i * 1.4) * 7;
      ctx.globalAlpha = ringProgress * pulse * (0.60 - i * 0.15);
      ctx.strokeStyle = i % 2 === 0 ? '#00ffff' : '#aa44ff';
      ctx.lineWidth   = 3 - i * 0.6;
      ctx.shadowColor = '#00ffff';
      ctx.shadowBlur  = 22;
      ctx.beginPath();
      ctx.arc(hx, hy, r, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  ctx.restore();
}

// ============================================================
