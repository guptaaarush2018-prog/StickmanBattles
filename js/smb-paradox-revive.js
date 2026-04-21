'use strict';
// smb-paradox-revive.js — spawnParadox, removeParadox, triggerParadoxRevive, drawParadoxRevive, damage lock, empowerment, foreshadow
// Depends on: smb-globals.js, smb-paradox-class.js (and preceding splits in chain)

// ============================================================
// SPAWN / REMOVE helpers
// ============================================================
function spawnParadox(x, y) {
  paradoxEntity = new Paradox(x, y);
}

function removeParadox() {
  if (paradoxEntity) paradoxEntity.done = true;
}

// ============================================================
// PARADOX REVIVE  — replaces triggerFakeDeath visually
// ============================================================
function triggerParadoxRevive(player) {
  if (fakeDeath.triggered) return;
  fakeDeath.triggered = true; // block re-trigger (shared flag with old system)

  paradoxReviveActive = true;
  paradoxReviveTimer  = 0;
  paradoxRevivePlayer = player;

  // Standard tumble physics so player reacts visually
  player.invincible   = 9999;
  player.ragdollTimer = 80;
  player.ragdollSpin  = (Math.random() > 0.5 ? 1 : -1) * (0.18 + Math.random() * 0.14);
  player.vy           = -12;
  player.vx           = (Math.random() - 0.5) * 14;
  screenShake         = Math.max(screenShake, 20);
}

function updateParadoxRevive() {
  if (!paradoxReviveActive) return;
  paradoxReviveTimer++;
  const t = paradoxReviveTimer;
  const p = paradoxRevivePlayer;

  // t=60: spawn Paradox near fallen player's spawn, show first dialogue
  if (t === 60) {
    const spx = p ? p.spawnX : GAME_W / 2;
    const spy = p ? p.spawnY : GAME_H / 2;
    spawnParadox(spx - 45, spy - 20);
    bossDialogue = { text: randChoice(_PARADOX_REVIVE_LINES), timer: 280 };
    screenShake  = Math.max(screenShake, 10);
  }

  // t=100: energy surge burst
  if (t === 100 && p && settings.particles) {
    for (let i = 0; i < 50 && particles.length < MAX_PARTICLES; i++) {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.3;
      const spd   = 4 + Math.random() * 12;
      const _p2   = _getParticle();
      _p2.x       = p.spawnX; _p2.y = p.spawnY;
      _p2.vx      = Math.cos(angle) * spd;
      _p2.vy      = Math.sin(angle) * spd;
      _p2.color   = Math.random() < 0.5 ? '#00ffff' : '#ffffff';
      _p2.size    = 2 + Math.random() * 5;
      _p2.life    = 50 + Math.random() * 40;
      _p2.maxLife = 90;
      particles.push(_p2);
    }
    screenShake = Math.max(screenShake, 28);
  }

  // t=150: secondary Paradox particle burst
  if (t === 150 && settings.particles) {
    const ex = paradoxEntity ? paradoxEntity.cx() : (p ? p.spawnX : GAME_W / 2);
    const ey = paradoxEntity ? paradoxEntity.cy() : (p ? p.spawnY : GAME_H / 2);
    for (let i = 0; i < 35 && particles.length < MAX_PARTICLES; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd   = 3 + Math.random() * 9;
      const _p2   = _getParticle();
      _p2.x       = ex + (Math.random() - 0.5) * 20;
      _p2.y       = ey + (Math.random() - 0.5) * 20;
      _p2.vx      = Math.cos(angle) * spd;
      _p2.vy      = Math.sin(angle) * spd;
      _p2.color   = Math.random() < 0.6 ? '#00ffff' : '#aa88ff';
      _p2.size    = 1.5 + Math.random() * 3.5;
      _p2.life    = 40 + Math.random() * 35;
      _p2.maxLife = 75;
      particles.push(_p2);
    }
  }

  // t=220: revive player with 2 lives, remove Paradox
  if (t === 220 && p) {
    p.lives        = 2;
    p.invincible   = 150;
    p.ragdollTimer = 0;
    p.ragdollSpin  = 0;
    p.ragdollAngle = 0;
    p.respawn();
    removeParadox();
    paradoxReviveActive = false;
  }

  // Keep Paradox entity alive and updated
  if (paradoxEntity) paradoxEntity.update();
}

function drawParadoxRevive() {
  if (!paradoxReviveActive) return;
  const t = paradoxReviveTimer;

  // Dark overlay builds over first 80 frames
  const overlayAlpha = Math.min(0.70, t / 80 * 0.70);
  ctx.save();
  ctx.globalAlpha = overlayAlpha;
  ctx.fillStyle   = '#000000';
  ctx.fillRect(0, 0, GAME_W, GAME_H);
  ctx.restore();

  // "DEFEATED" text
  if (t > 40) {
    const a = Math.min(1, (t - 40) / 30);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle   = '#ff3355';
    ctx.font        = 'bold 32px monospace';
    ctx.textAlign   = 'center';
    ctx.shadowColor = '#ff0033';
    ctx.shadowBlur  = 18;
    ctx.fillText('DEFEATED', GAME_W / 2, 82);
    ctx.restore();
  }

  // Paradox entity (draws in world space, over dark overlay)
  if (paradoxEntity && t >= 60) paradoxEntity.draw();

  // "PARADOX" label above entity
  if (t >= 70 && t < 205 && paradoxEntity) {
    const la = Math.min(1, (t - 70) / 20) * (t > 185 ? Math.max(0, (205 - t) / 20) : 1);
    ctx.save();
    ctx.globalAlpha = la;
    ctx.fillStyle   = '#00ffff';
    ctx.font        = 'bold 12px monospace';
    ctx.textAlign   = 'center';
    ctx.shadowColor = '#00ffff';
    ctx.shadowBlur  = 10;
    ctx.fillText('PARADOX', paradoxEntity.cx(), paradoxEntity.y - 13);
    ctx.restore();
  }

  // Horizontal CRT scan-line distortion
  if (t >= 80 && t < 220) {
    const da = 0.05 + Math.abs(Math.sin(t * 0.15)) * 0.04;
    ctx.save();
    ctx.globalAlpha = da;
    ctx.fillStyle   = '#00ffff';
    for (let ry = 0; ry < GAME_H; ry += 7) ctx.fillRect(0, ry, GAME_W, 1);
    ctx.restore();
  }
}

// ============================================================
// UPDATE / DRAW — standalone (called each frame when no revive)
// ============================================================
function updateParadox() {
  if (paradoxEntity) {
    paradoxEntity.update();
    if (paradoxEntity.done && paradoxEntity.alpha <= 0) paradoxEntity = null;
  }
}

function drawParadox() {
  if (paradoxEntity) paradoxEntity.draw();
}

// ============================================================
// TRUEFORM DAMAGE LOCK + PARADOX EMPOWERMENT
// ============================================================
function startTFDamageLock() {
  tfDamageLocked    = true;
  tfDamageLockTimer = 480; // 8 seconds then auto-empower
}

function activateParadoxEmpowerment(hero) {
  tfDamageLocked    = false;
  tfDamageLockTimer = 0;
  tfParadoxEmpowered = true;
  tfEmpowerTimer     = TF_EMPOWER_DURATION;

  if (hero) {
    // Speed boost
    if (!hero._preEmpowerSpeed) hero._preEmpowerSpeed = hero.speed;
    hero.speed = (hero._preEmpowerSpeed || 3.2) * 1.4;
    // Damage boost
    if (hero._preEmpowerDmgMult === undefined) hero._preEmpowerDmgMult = hero.dmgMult !== undefined ? hero.dmgMult : 1.0;
    hero.dmgMult = hero._preEmpowerDmgMult * 1.6;
  }

  if (typeof showBossDialogue === 'function') showBossDialogue('PARADOX EMPOWERMENT', 320);
  screenShake = Math.max(screenShake, 30);

  if (hero && settings.particles) {
    for (let i = 0; i < 60 && particles.length < MAX_PARTICLES; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd   = 5 + Math.random() * 12;
      const _p    = _getParticle();
      _p.x = hero.cx(); _p.y = hero.cy();
      _p.vx = Math.cos(angle) * spd; _p.vy = Math.sin(angle) * spd;
      _p.color = Math.random() < 0.5 ? '#00ffff' : '#ffffff';
      _p.size  = 2 + Math.random() * 5;
      _p.life  = 60 + Math.random() * 40; _p.maxLife = 100;
      particles.push(_p);
    }
  }
}

function updateParadoxEmpowerment() {
  // Count down damage lock → auto-activate empowerment
  if (tfDamageLocked && tfDamageLockTimer > 0) {
    tfDamageLockTimer--;
    if (tfDamageLockTimer <= 0) {
      const hero = players.find(p => !p.isBoss && p.health > 0);
      activateParadoxEmpowerment(hero || null);
    }
  }

  // Count down empowerment duration
  if (tfParadoxEmpowered && tfEmpowerTimer > 0) {
    tfEmpowerTimer--;
    if (tfEmpowerTimer <= 0) {
      const hero = players.find(p => !p.isBoss && p.health > 0);
      if (hero) {
        if (hero._preEmpowerSpeed    !== undefined) { hero.speed   = hero._preEmpowerSpeed;    delete hero._preEmpowerSpeed; }
        if (hero._preEmpowerDmgMult  !== undefined) { hero.dmgMult = hero._preEmpowerDmgMult;  delete hero._preEmpowerDmgMult; }
      }
      tfParadoxEmpowered = false;
    }
  }
}

function drawParadoxEmpowerment() {
  if (!tfParadoxEmpowered || tfEmpowerTimer <= 0) return;
  const hero = players.find(p => !p.isBoss && p.health > 0);
  if (!hero) return;

  const fadeA = Math.min(1, tfEmpowerTimer / 120);
  const pulse = 0.4 + Math.sin(frameCount * 0.12) * 0.3;

  // Aura ring
  ctx.save();
  ctx.globalAlpha = fadeA * pulse * 0.55;
  ctx.strokeStyle = '#00ffff';
  ctx.lineWidth   = 3;
  ctx.shadowColor = '#00ffff';
  ctx.shadowBlur  = 22;
  ctx.beginPath();
  ctx.arc(hero.cx(), hero.cy(), 32 + Math.sin(frameCount * 0.1) * 6, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // Floating "EMPOWERED" label that fades at end
  if (tfEmpowerTimer < 120) {
    const la = Math.min(1, tfEmpowerTimer / 60) * 0.88;
    ctx.save();
    ctx.globalAlpha = la;
    ctx.fillStyle   = '#00ffff';
    ctx.font        = 'bold 11px monospace';
    ctx.textAlign   = 'center';
    ctx.shadowColor = '#00ffff';
    ctx.shadowBlur  = 8;
    ctx.fillText('EMPOWERED', hero.cx(), hero.y - 20);
    ctx.restore();
  }
}

// ============================================================
// BOSS FIGHT FORESHADOWING
// ============================================================
function updateBossParadoxForeshadow() {
  if (gameMode !== 'boss' || !gameRunning || gameFrozen) return;
  const fs = bossParadoxForeshadow;

  if (fs.cooldown > 0) { fs.cooldown--; return; }

  if (fs.active) {
    fs.timer++;
    if (fs.timer >= 52) {
      fs.active   = false;
      fs.timer    = 0;
      fs.cooldown = 660 + Math.floor(Math.random() * 540); // 11–20 s
    }
    return;
  }

  // Random chance to trigger (~0.25% per frame after cooldown)
  if (frameCount > 600 && Math.random() < 0.0025) {
    fs.active = true;
    fs.timer  = 0;
  }
}

function drawBossParadoxForeshadow() {
  if (!bossParadoxForeshadow.active) return;
  const t = bossParadoxForeshadow.timer;
  const alpha = t < 10 ? (t / 10) * 0.32 : t < 40 ? 0.32 : ((52 - t) / 12) * 0.32;
  if (alpha <= 0) return;

  ctx.save();
  ctx.globalAlpha = alpha;
  // Subtle dark overlay to sell the vision
  ctx.fillStyle = '#000d1a';
  ctx.fillRect(0, 0, GAME_W, GAME_H);
  ctx.globalAlpha = alpha * 1.0;

  // TrueForm silhouette — left background
  _drawForeshadowSilhouette(195, GAME_H - 155, '#111111', '#ffffff', 1.25, true);
  // Paradox silhouette — right background
  _drawForeshadowSilhouette(610, GAME_H - 148, '#000000', '#00ffff', 1.0, false);

  // Energy clash line between them
  ctx.strokeStyle = '#00ffff';
  ctx.lineWidth   = 1.8;
  ctx.shadowColor = '#00ffff';
  ctx.shadowBlur  = 16;
  ctx.globalAlpha = alpha * 0.65;
  ctx.beginPath();
  ctx.moveTo(215, GAME_H - 185);
  ctx.lineTo(600, GAME_H - 178);
  ctx.stroke();

  ctx.restore();
}

// Internal helper: small stickman silhouette for foreshadow
function _drawForeshadowSilhouette(x, y, fill, stroke, scale, faceRight) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.fillStyle   = fill;
  ctx.strokeStyle = stroke;
  ctx.lineWidth   = 1.6 / scale;
  ctx.shadowColor = stroke;
  ctx.shadowBlur  = 9;
  const d = faceRight ? 1 : -1;
  ctx.beginPath(); ctx.arc(0, -44, 7, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, -37); ctx.lineTo(0, -15);
  ctx.moveTo(0, -32); ctx.lineTo(d * 13, -23);
  ctx.moveTo(0, -32); ctx.lineTo(-d * 10, -25);
  ctx.moveTo(0, -15); ctx.lineTo(d * 9, 0);
  ctx.moveTo(0, -15); ctx.lineTo(-d * 7, 0);
  ctx.stroke();
  ctx.restore();
}

// One-time scripted moment: Boss punches Paradox out of arena (fires at 50% boss HP)
function triggerBossParadoxPunch() {
  if (bossParadoxForeshadow.punchFired) return;
  bossParadoxForeshadow.punchFired = true;

  screenShake = Math.max(screenShake, 18);
  if (settings.particles) {
    for (let i = 0; i < 32 && particles.length < MAX_PARTICLES; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd   = 4 + Math.random() * 9;
      const _p    = _getParticle();
      _p.x = 600; _p.y = GAME_H - 185;
      _p.vx = Math.cos(angle) * spd; _p.vy = Math.sin(angle) * spd;
      _p.color = Math.random() < 0.5 ? '#00ffff' : '#ffffff';
      _p.size  = 2 + Math.random() * 4; _p.life  = 28 + Math.random() * 28; _p.maxLife = 56;
      particles.push(_p);
    }
  }
  if (typeof showBossDialogue === 'function') showBossDialogue('Nothing can save you.', 280);
}

