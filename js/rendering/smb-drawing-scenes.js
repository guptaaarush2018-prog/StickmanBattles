'use strict';
// smb-drawing-scenes.js — Boss death scene, fake death scene (startBossDeathScene, updateBossDeathScene, drawBossDeathScene, triggerFakeDeath)
// Depends on: smb-globals.js, smb-data-arenas.js, smb-particles-core.js

// ============================================================
// BOSS DEFEAT SCENE
// ============================================================
function startBossDeathScene(boss) {
  bossDeathScene = {
    phase: 'shatter', timer: 0,
    orbX: boss.cx(), orbY: boss.cy(),
    orbR: 0, orbVx: 0, orbVy: 0,
    camZoom: 1.0, camZoomTarget: 1.0,  // cinematic zoom state
  };
  boss.invincible = 9999;
  screenShake     = 65;
  // Remove all other entities — boss takes center stage
  players    = players.filter(p => p.isBoss);
  minions    = [];
  trainingDummies = [];
  projectiles = [];
  bossBeams   = [];
  bossSpikes  = [];
  const deathColors = boss.isTrueForm
    ? ['#000000','#111111','#222222','#ffffff','#cccccc','#888888','#444444']
    : ['#cc00ee','#9900bb','#ff00ff','#000000','#ffffff','#6600aa','#ff88ff'];
  for (let _i = 0; _i < 100 && particles.length < MAX_PARTICLES; _i++) {
    const _a = Math.random() * Math.PI * 2;
    const _s = 2 + Math.random() * 14;
    const _p = _getParticle();
    _p.x = boss.cx(); _p.y = boss.cy();
    _p.vx = Math.cos(_a)*_s; _p.vy = Math.sin(_a)*_s;
    _p.color = deathColors[Math.floor(Math.random() * deathColors.length)];
    _p.size = 2 + Math.random() * 8; _p.life = 80 + Math.random() * 100; _p.maxLife = 180;
    particles.push(_p);
  }
  const deathLine = boss.isTrueForm ? '...form is a choice. I\'ll make another.' : 'This changes nothing.';
  showBossDialogue(deathLine, 360);
}

function updateBossDeathScene() {
  const sc   = bossDeathScene;
  if (!sc) return;
  sc.timer++;
  // Smooth camera zoom lerp for cinematic effect
  sc.camZoom = lerp(sc.camZoom || 1, sc.camZoomTarget || 1, 0.06);
  const boss = players.find(p => p.isBoss);

  if (sc.phase === 'shatter') {
    // Camera slowly zooms in on boss
    sc.camZoomTarget = 1.5;
    if (boss && sc.timer % 4 === 0) {
      spawnParticles(boss.cx() + (Math.random()-0.5)*50, boss.cy() + (Math.random()-0.5)*50,
        Math.random() < 0.5 ? '#cc00ee' : '#000000', 6);
      screenShake = Math.max(screenShake, 10);
    }
    if (sc.timer >= 120) {
      sc.phase = 'orb_form';
      if (boss) { sc.orbX = boss.cx(); sc.orbY = boss.cy(); boss.backstageHiding = true; }
      sc.camZoomTarget = 2.0; // zoom in further as orb forms
      screenShake = 50;
      spawnParticles(sc.orbX, sc.orbY, '#9900ee', 60);
      spawnParticles(sc.orbX, sc.orbY, '#ff88ff', 30);
      spawnParticles(sc.orbX, sc.orbY, '#000000', 40);
    }
  } else if (sc.phase === 'orb_form') {
    sc.orbR = Math.min(38, sc.orbR + 0.65); // bigger orb
    if (sc.timer >= 180) {
      sc.phase = 'orb_burst';
      // Flash + extra particles as orb fully forms
      screenShake = 40;
      for (let _i = 0; _i < 60 && particles.length < MAX_PARTICLES; _i++) {
        const _a = Math.random() * Math.PI * 2;
        const _s = 3 + Math.random() * 8;
        const _p = _getParticle();
        _p.x = sc.orbX; _p.y = sc.orbY;
        _p.vx = Math.cos(_a)*_s; _p.vy = Math.sin(_a)*_s;
        _p.color = Math.random() < 0.4 ? '#ffffff' : (Math.random() < 0.5 ? '#cc00ee' : '#ffaaff');
        _p.size = 2 + Math.random() * 5; _p.life = 60 + Math.random()*60; _p.maxLife = 120;
        particles.push(_p);
      }
    }
  } else if (sc.phase === 'orb_burst') {
    // Brief pause — orb glows at full size
    if (sc.timer >= 220) {
      sc.phase = 'portal_open';
      const _px = clamp(sc.orbX + 240, 80, GAME_W - 80);
      openBackstagePortal(_px, sc.orbY, 'exit');
    }
  } else if (sc.phase === 'portal_open') {
    if (sc.timer >= 260) {
      sc.phase    = 'orb_fly';
      sc.orbVx    = 5;
      sc.orbVy    = -1.0;
      sc.camZoomTarget = 1.2; // zoom back out as orb escapes
    }
  } else if (sc.phase === 'orb_fly') {
    sc.orbX += sc.orbVx;
    sc.orbY += sc.orbVy;
    sc.orbVx  = Math.min(sc.orbVx * 1.12, 28);
    sc.orbR   = Math.max(0, sc.orbR - 0.22);
    // Bright light trail
    if (settings.particles && Math.random() < 0.6 && particles.length < MAX_PARTICLES) {
      const _p = _getParticle();
      _p.x = sc.orbX; _p.y = sc.orbY;
      _p.vx = (Math.random()-0.5)*2; _p.vy = (Math.random()-0.5)*2;
      _p.color = Math.random() < 0.5 ? '#cc00ee' : '#ffffff';
      _p.size = 2 + Math.random()*4; _p.life = 20 + Math.random()*20; _p.maxLife = 40;
      particles.push(_p);
    }
    if (sc.orbX > GAME_W + 60 || sc.orbR <= 0) {
      sc.phase  = 'portal_close';
      sc.camZoomTarget = 1.0; // zoom all the way back to normal
      for (const bp of backstagePortals) bp.phase = 'closing';
    }
  } else if (sc.phase === 'portal_close') {
    if (sc.timer >= 370) {
      bossDeathScene = null;
      const _customWpnUsed = players.some(p => !p.isBoss && p.weapon && p.weapon._isCustom);
      if (!bossBeaten && gameMode === 'boss' && !_customWpnUsed) {
        bossBeaten = true;
        localStorage.setItem('smc_bossBeaten', '1');
        // Unlock boss card for future free-play now that it's been beaten via story
        const _bossCard = document.getElementById('modeBoss');
        if (_bossCard) _bossCard.style.display = '';
        showBossBeatenScreen();
      } else {
        endGame();
      }
    }
  }
  // Lerp cinematic zoom
  if (sc.camZoom === undefined) sc.camZoom = 1.0;
  sc.camZoom = sc.camZoom + (sc.camZoomTarget - sc.camZoom) * 0.04;
}

function drawBossDeathScene() {
  const sc = bossDeathScene;
  if (!sc || sc.orbR <= 0) return;
  ctx.save();
  // Outer glow (pulsing)
  const pulse = 1 + Math.sin(frameCount * 0.18) * 0.12;
  const glowR = sc.orbR * 3.5 * pulse;
  const glow  = ctx.createRadialGradient(sc.orbX, sc.orbY, 0, sc.orbX, sc.orbY, glowR);
  glow.addColorStop(0,   'rgba(180,0,255,0.35)');
  glow.addColorStop(0.5, 'rgba(80,0,140,0.15)');
  glow.addColorStop(1,   'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(sc.orbX, sc.orbY, glowR, 0, Math.PI * 2);
  ctx.fill();
  // Core orb — dark with bright rim
  const _g = ctx.createRadialGradient(sc.orbX, sc.orbY, 0, sc.orbX, sc.orbY, sc.orbR);
  _g.addColorStop(0,   'rgba(0,0,12,1)');
  _g.addColorStop(0.55,'rgba(40,0,70,0.95)');
  _g.addColorStop(0.82,'rgba(160,0,230,0.88)');
  _g.addColorStop(1,   'rgba(255,180,255,0.6)');
  ctx.fillStyle   = _g;
  ctx.shadowColor = '#cc00ff';
  ctx.shadowBlur  = 40;
  ctx.beginPath();
  ctx.arc(sc.orbX, sc.orbY, sc.orbR, 0, Math.PI * 2);
  ctx.fill();
  // Inner bright center
  const inner = ctx.createRadialGradient(sc.orbX, sc.orbY, 0, sc.orbX, sc.orbY, sc.orbR * 0.35);
  inner.addColorStop(0, 'rgba(255,255,255,0.9)');
  inner.addColorStop(1, 'rgba(200,100,255,0)');
  ctx.fillStyle = inner;
  ctx.beginPath();
  ctx.arc(sc.orbX, sc.orbY, sc.orbR * 0.35, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// ============================================================
// FAKE DEATH SCENE  (boss < 1000 HP + player loses last life)
// ============================================================
function triggerFakeDeath(player) {
  fakeDeath.active    = true;
  fakeDeath.triggered = true;
  fakeDeath.timer     = 0;
  fakeDeath.player    = player;
  player.invincible   = 9999;
  player.ragdollTimer = 80;
  player.ragdollSpin  = (Math.random() > 0.5 ? 1 : -1) * (0.18 + Math.random() * 0.14);
  player.vy           = -12;
  player.vx           = (Math.random() - 0.5) * 14;
  screenShake         = Math.max(screenShake, 20);
  const boss = players.find(p => p.isBoss);
  if (boss) {
    // Force-interrupt any current dialogue after 1.2s
    setTimeout(() => {
      if (gameRunning) {
        bossDialogue = { text: "You thought that was the end.", timer: 320 };
      }
    }, 1200);
  }
}

function updateFakeDeathScene() {
  if (!fakeDeath.active) return;
  fakeDeath.timer++;
  const p = fakeDeath.player;

  // Phase 1 (t=0–150): dark overlay + boss dialogue
  // Phase 2 (t=150–220): purple light column rises
  if (fakeDeath.timer === 150 && p) {
    screenShake = Math.max(screenShake, 32);
    if (settings.particles) {
      for (let i = 0; i < 60 && particles.length < MAX_PARTICLES; i++) {
        const angle = -Math.PI/2 + (Math.random()-0.5)*0.4;
        const spd   = 4 + Math.random() * 10;
        const _p = _getParticle();
        _p.x = p.spawnX; _p.y = p.spawnY;
        _p.vx = Math.cos(angle)*spd; _p.vy = Math.sin(angle)*spd;
        _p.color = Math.random() < 0.6 ? '#aa44ff' : '#ffffff';
        _p.size = 2 + Math.random()*5; _p.life = 60 + Math.random()*40; _p.maxLife = 100;
        particles.push(_p);
      }
    }
  }

  // Phase 3 (t=220): revive player with 2 lives
  if (fakeDeath.timer === 220 && p) {
    p.lives        = 2;
    p.invincible   = 150;
    p.ragdollTimer = 0;
    p.ragdollSpin  = 0;
    p.ragdollAngle = 0;
    p.respawn();
    fakeDeath.active = false;
  }
}

function drawFakeDeathScene() {
  if (!fakeDeath.active && fakeDeath.timer === 0) return;
  if (!fakeDeath.active) return; // scene ended
  const t = fakeDeath.timer;
  const p = fakeDeath.player;

  // Dim overlay (builds up in first 60 frames, stays)
  const overlayAlpha = Math.min(0.72, t / 80 * 0.72);
  ctx.save();
  ctx.globalAlpha = overlayAlpha;
  ctx.fillStyle   = '#000';
  ctx.fillRect(0, 0, GAME_W, GAME_H);
  ctx.restore();

  // "DEFEATED" text at top (fades in at t=40)
  if (t > 40) {
    const a = Math.min(1, (t - 40) / 30);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.font        = 'bold 42px Arial';
    ctx.textAlign   = 'center';
    ctx.fillStyle   = '#ff3333';
    ctx.shadowColor = '#ff0000';
    ctx.shadowBlur  = 24;
    ctx.fillText('DEFEATED', GAME_W / 2, GAME_H / 2 - 40);
    ctx.restore();
  }

  // Purple column of light (t=130–220)
  if (t > 130 && p) {
    const colAlpha = Math.min(1, (t - 130) / 40);
    const colPulse = Math.abs(Math.sin((t - 130) * 0.15));
    ctx.save();
    ctx.globalAlpha = colAlpha * (0.7 + colPulse * 0.3);
    const colGrad = ctx.createLinearGradient(p.spawnX, GAME_H, p.spawnX, 0);
    colGrad.addColorStop(0, 'rgba(160,0,255,0.85)');
    colGrad.addColorStop(0.5, 'rgba(200,100,255,0.55)');
    colGrad.addColorStop(1, 'rgba(160,0,255,0)');
    ctx.fillStyle = colGrad;
    ctx.fillRect(p.spawnX - 18, 0, 36, GAME_H);
    // Bright core
    ctx.fillStyle = `rgba(255,200,255,${colAlpha * 0.55})`;
    ctx.fillRect(p.spawnX - 6, 0, 12, GAME_H);
    ctx.restore();
  }

  // "REVIVING..." text (t=160)
  if (t > 160) {
    const a2 = Math.min(1, (t - 160) / 20);
    ctx.save();
    ctx.globalAlpha = a2;
    ctx.font        = 'bold 22px Arial';
    ctx.textAlign   = 'center';
    ctx.fillStyle   = '#dd88ff';
    ctx.shadowColor = '#aa00ff';
    ctx.shadowBlur  = 14;
    ctx.fillText('REVIVING...', GAME_W / 2, GAME_H / 2 + 10);
    ctx.restore();
  }
}



// ============================================================
// STORY SUBTITLE — in-fight narrative captions
// ============================================================
// Returns the bottom edge of the DOM HUD bar in canvas pixels.
