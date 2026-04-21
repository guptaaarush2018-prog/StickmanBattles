'use strict';
// smb-drawing-arenas2.js — Cave, mirror, underwater, volcano, colosseum, cyberpunk, haunted, clouds, neon grid, mushroom arena draw functions
// Depends on: smb-globals.js, smb-data-arenas.js, smb-particles-core.js

// ============================================================
// NEW ARENA DRAW FUNCTIONS
// ============================================================

function drawCaveArena() {
  // Stalactites from ceiling — static seeded pattern
  ctx.fillStyle = '#4a2a18';
  const stalCols = [60, 145, 230, 310, 400, 490, 580, 660, 750, 840];
  for (let i = 0; i < stalCols.length; i++) {
    const bx = stalCols[i] + Math.sin(i * 1.7) * 18;
    const bh = 28 + Math.abs(Math.sin(i * 2.3)) * 42;
    ctx.beginPath();
    ctx.moveTo(bx - 10, 20);
    ctx.lineTo(bx + 10, 20);
    ctx.lineTo(bx, 20 + bh);
    ctx.closePath();
    ctx.fill();
  }
  // Drip glow at tips
  ctx.save();
  ctx.shadowColor = '#7a4a28';
  ctx.shadowBlur  = 6;
  for (let i = 0; i < stalCols.length; i++) {
    const bx = stalCols[i] + Math.sin(i * 1.7) * 18;
    const bh = 28 + Math.abs(Math.sin(i * 2.3)) * 42;
    const drip = Math.abs(Math.sin(frameCount * 0.02 + i * 0.8)) > 0.9;
    if (drip) {
      ctx.globalAlpha = 0.55;
      ctx.fillStyle   = '#6a3a20';
      ctx.beginPath();
      ctx.arc(bx, 20 + bh + 3, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
  ctx.restore();
  // Draw falling stalactites from map perks
  if (mapPerkState.stalactites) {
    for (const st of mapPerkState.stalactites) {
      const alpha = st.warnTimer > 0 ? 0.4 + Math.abs(Math.sin(frameCount * 0.3)) * 0.5 : 1;
      ctx.globalAlpha = alpha;
      ctx.fillStyle   = '#5a3520';
      ctx.beginPath();
      ctx.moveTo(st.x - 9, st.y);
      ctx.lineTo(st.x + 9, st.y);
      ctx.lineTo(st.x, st.y + 28);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}

function drawMirrorArena() {
  // Rotating geometric shapes — fractal mirror dimension
  ctx.save();
  const shapes = [
    { cx: 200, cy: 180, r: 70, sides: 3, speed: 0.004 },
    { cx: 700, cy: 200, r: 60, sides: 6, speed: -0.006 },
    { cx: 450, cy: 280, r: 90, sides: 4, speed: 0.003 },
    { cx: 100, cy: 340, r: 45, sides: 5, speed: -0.005 },
    { cx: 800, cy: 350, r: 50, sides: 3, speed: 0.007 },
  ];
  for (const sh of shapes) {
    const angle = frameCount * sh.speed;
    ctx.save();
    ctx.translate(sh.cx, sh.cy);
    ctx.rotate(angle);
    ctx.globalAlpha = 0.12;
    ctx.strokeStyle = '#44aaff';
    ctx.lineWidth   = 1.5;
    ctx.beginPath();
    for (let k = 0; k <= sh.sides; k++) {
      const a = (k / sh.sides) * Math.PI * 2;
      k === 0 ? ctx.moveTo(Math.cos(a) * sh.r, Math.sin(a) * sh.r)
              : ctx.lineTo(Math.cos(a) * sh.r, Math.sin(a) * sh.r);
    }
    ctx.stroke();
    // Inner reflected copy
    ctx.rotate(Math.PI / sh.sides);
    ctx.globalAlpha = 0.07;
    ctx.strokeStyle = '#ff44aa';
    ctx.beginPath();
    for (let k = 0; k <= sh.sides; k++) {
      const a = (k / sh.sides) * Math.PI * 2;
      k === 0 ? ctx.moveTo(Math.cos(a) * sh.r * 0.55, Math.sin(a) * sh.r * 0.55)
              : ctx.lineTo(Math.cos(a) * sh.r * 0.55, Math.sin(a) * sh.r * 0.55);
    }
    ctx.stroke();
    ctx.restore();
  }
  // Fracture lines across screen
  ctx.globalAlpha = 0.06;
  ctx.strokeStyle = '#88ccff';
  ctx.lineWidth   = 1;
  const fractures = [[0, 120, 900, 280], [0, 340, 900, 180], [200, 0, 400, 520], [650, 0, 500, 520]];
  for (const [x1, y1, x2, y2] of fractures) {
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

// ── Mirror arena gimmick: invert controls every 20s ───────────────────────────
const MIRROR_FLIP_INTERVAL = 1200; // 20 seconds at 60fps
const MIRROR_WARN_FRAMES   = 90;   // 1.5s warning before flip

function updateMirrorGimmick() {
  if (!gameRunning || currentArenaKey !== 'mirror') {
    // Reset when leaving mirror arena
    if (mirrorFlipped) { mirrorFlipped = false; mirrorFlipTimer = 0; mirrorFlipWarning = 0; }
    return;
  }
  mirrorFlipTimer++;
  if (mirrorFlipWarning > 0) mirrorFlipWarning--;

  // Warn players before the flip
  if (mirrorFlipTimer === MIRROR_FLIP_INTERVAL - MIRROR_WARN_FRAMES) {
    mirrorFlipWarning = MIRROR_WARN_FRAMES;
    showBossDialogue(mirrorFlipped ? '⟳ Reality restoring…' : '↔ Mirror flipping…', MIRROR_WARN_FRAMES + 20);
  }

  if (mirrorFlipTimer >= MIRROR_FLIP_INTERVAL) {
    mirrorFlipped = !mirrorFlipped;
    mirrorFlipTimer = 0;
    screenShake = mirrorFlipped ? 22 : 14;
    CinFX && CinFX.flash(mirrorFlipped ? '#88ccff' : '#ccaaff', 0.45, 12);
    // All fighters: instantly swap their facing/vx as visual "pop"
    if (Array.isArray(players)) {
      for (const p of players) { if (p && p.health > 0) { p.vx = -p.vx * 0.5; } }
    }
  }
}

// Draw mirror warning overlay (screen-space)
function drawMirrorGimmickOverlay() {
  if (currentArenaKey !== 'mirror') return;
  if (mirrorFlipWarning <= 0 && !mirrorFlipped) return;

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const cw = canvas.width, ch = canvas.height;

  // Warning pulse when about to flip
  if (mirrorFlipWarning > 0) {
    const alpha = (mirrorFlipWarning / MIRROR_WARN_FRAMES) * 0.22 * (0.5 + 0.5 * Math.sin(mirrorFlipWarning * 0.3));
    ctx.fillStyle = `rgba(136,204,255,${alpha.toFixed(3)})`;
    ctx.fillRect(0, 0, cw, ch);
  }

  // Persistent "MIRRORED" indicator when controls are inverted
  if (mirrorFlipped) {
    ctx.globalAlpha = 0.7;
    ctx.font = `bold ${Math.round(ch * 0.022)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#aaddff';
    ctx.shadowColor = '#88ccff';
    ctx.shadowBlur  = 10;
    ctx.fillText('↔ CONTROLS MIRRORED', cw / 2, _hudBottom() + Math.round(ch * 0.04) + 12);
    ctx.shadowBlur = 0;
  }

  ctx.restore();
}

function drawUnderwaterArena() {
  // Caustic light ripples on floor
  ctx.save();
  for (let i = 0; i < 8; i++) {
    const cx2 = 55 + i * 112;
    const cy2 = 460;
    const r   = 30 + Math.sin(frameCount * 0.03 + i * 0.9) * 12;
    ctx.globalAlpha = 0.07 + Math.sin(frameCount * 0.025 + i) * 0.04;
    ctx.strokeStyle = '#44aaff';
    ctx.lineWidth   = 1.5;
    ctx.beginPath();
    ctx.ellipse(cx2, cy2, r, r * 0.35, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  // Rising bubbles from perk state or fallback
  const bubbles = (mapPerkState.bubbles) ? mapPerkState.bubbles : [];
  for (const b of bubbles) {
    b.y -= b.speed;
    if (b.y < -10) b.y = 490 + Math.random() * 30;
    const wobble = Math.sin(frameCount * 0.06 + b.x * 0.05) * 4;
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = '#88ccff';
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.arc(b.x + wobble, b.y, 3 + (b.speed * 2), 0, Math.PI * 2);
    ctx.stroke();
  }
  // Wavy water-surface shimmer at top
  ctx.globalAlpha = 0.08;
  ctx.fillStyle   = '#0055aa';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  for (let x = 0; x <= GAME_W; x += 20) {
    ctx.lineTo(x, 18 + Math.sin(x * 0.04 + frameCount * 0.05) * 10);
  }
  ctx.lineTo(GAME_W, 0);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.restore();
}

function drawVolcanoArena() {
  // Lava floor (same wave style as drawLava)
  const ly = currentArena.lavaY || 442;
  const lg = ctx.createLinearGradient(0, ly, 0, GAME_H);
  lg.addColorStop(0,   '#ff6600');
  lg.addColorStop(0.3, '#cc2200');
  lg.addColorStop(1,   '#880000');
  ctx.fillStyle = lg;
  ctx.beginPath();
  ctx.moveTo(0, ly);
  for (let x = 0; x <= GAME_W; x += 18) {
    ctx.lineTo(x, ly + Math.sin(x * 0.055 + frameCount * 0.07) * 7);
  }
  ctx.lineTo(GAME_W, GAME_H); ctx.lineTo(0, GAME_H); ctx.closePath(); ctx.fill();
  ctx.shadowColor = '#ff4400'; ctx.shadowBlur = 22;
  ctx.fillStyle   = 'rgba(255,80,0,0.28)';
  ctx.fillRect(0, ly - 10, GAME_W, 12);
  ctx.shadowBlur = 0;
  // Jagged rock formations along bottom
  ctx.fillStyle = '#2a0800';
  for (let i = 0; i < 7; i++) {
    const rx = i * 140 - 10;
    const rh = 60 + Math.sin(i * 1.9) * 40;
    ctx.beginPath();
    ctx.moveTo(rx, ly + 20);
    ctx.lineTo(rx + 40, ly - rh + 20);
    ctx.lineTo(rx + 70, ly + 10);
    ctx.lineTo(rx + 70, GAME_H);
    ctx.lineTo(rx, GAME_H);
    ctx.closePath();
    ctx.fill();
  }
  // Geyser visuals from perk state
  if (mapPerkState.geysers) {
    for (const gy of mapPerkState.geysers) {
      const h = Math.min(gy.timer * 1.2, 220);
      const gg = ctx.createLinearGradient(gy.x, ly - h, gy.x, ly);
      gg.addColorStop(0, 'rgba(255,120,0,0)');
      gg.addColorStop(1, 'rgba(255,60,0,0.5)');
      ctx.fillStyle = gg;
      ctx.beginPath();
      ctx.moveTo(gy.x - 18, ly);
      ctx.quadraticCurveTo(gy.x, ly - h, gy.x + 18, ly);
      ctx.closePath();
      ctx.fill();
    }
  }
}

function drawColosseumArena() {
  // Stone arched columns in background
  const colXs = [30, 140, 260, 380, 520, 640, 760, 870];
  for (let i = 0; i < colXs.length; i++) {
    const cx2 = colXs[i];
    ctx.fillStyle = `rgba(140,110,75,0.55)`;
    ctx.fillRect(cx2 - 9, 140, 18, 340);
    // Capital (top)
    ctx.fillStyle = `rgba(165,130,90,0.65)`;
    ctx.fillRect(cx2 - 14, 135, 28, 14);
    // Base
    ctx.fillRect(cx2 - 14, GAME_H - 14, 28, 14);
    // Arch between columns
    if (i < colXs.length - 1) {
      const nx = colXs[i + 1];
      ctx.globalAlpha = 0.28;
      ctx.strokeStyle = '#b8884a';
      ctx.lineWidth   = 5;
      ctx.beginPath();
      ctx.arc((cx2 + nx) / 2, 140, (nx - cx2) / 2, Math.PI, 0);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }
  // Crowd silhouettes in upper stands
  ctx.fillStyle = 'rgba(100,75,50,0.18)';
  for (let i = 0; i < 32; i++) {
    const hx = 12 + i * 28;
    const hy = 55 + Math.sin(i * 1.3) * 10;
    // React to big hits — crowd bounces on screen shake
    const bounce = screenShake > 4 ? Math.abs(Math.sin(frameCount * 0.5 + i)) * 8 : 0;
    ctx.beginPath();
    ctx.arc(hx, hy - bounce, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(hx - 4, hy - bounce, 8, 12);
  }
}

function drawCyberpunkArena() {
  // Neon grid lines on floor/walls
  ctx.save();
  ctx.strokeStyle = '#003a4a';
  ctx.lineWidth   = 1;
  for (let gx = 0; gx < GAME_W; gx += 45) {
    ctx.globalAlpha = 0.2;
    ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, GAME_H); ctx.stroke();
  }
  for (let gy = 0; gy < GAME_H; gy += 45) {
    ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(GAME_W, gy); ctx.stroke();
  }
  // Neon building outlines
  const neons = [
    { x: 0,   w: 80,  h: 300, color: '#ff0066' },
    { x: 180, w: 60,  h: 380, color: '#00eeff' },
    { x: 380, w: 70,  h: 260, color: '#ff00ff' },
    { x: 590, w: 55,  h: 340, color: '#00ffaa' },
    { x: 790, w: 70,  h: 290, color: '#ffaa00' },
    { x: 860, w: 60,  h: 360, color: '#00eeff' },
  ];
  for (const b of neons) {
    const flicker = 0.4 + Math.abs(Math.sin(frameCount * 0.07 + b.x * 0.02)) * 0.6;
    ctx.globalAlpha = flicker * 0.35;
    ctx.strokeStyle = b.color;
    ctx.shadowColor = b.color;
    ctx.shadowBlur  = 10;
    ctx.lineWidth   = 2;
    ctx.strokeRect(b.x, GAME_H - b.h, b.w, b.h);
  }
  ctx.shadowBlur  = 0;
  // Zap visual from perk state
  if (mapPerkState.zapActive) {
    const pulse = 0.4 + Math.abs(Math.sin(frameCount * 0.35)) * 0.6;
    ctx.globalAlpha = pulse * 0.7;
    ctx.strokeStyle = '#00eeff';
    ctx.shadowColor = '#00eeff';
    ctx.shadowBlur  = 20;
    ctx.lineWidth   = 3;
    ctx.beginPath();
    ctx.moveTo(mapPerkState.zapLine, 460);
    ctx.lineTo(mapPerkState.zapLine, 490);
    ctx.stroke();
    // jagged arc
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = pulse * 0.4;
    ctx.beginPath();
    let zx = mapPerkState.zapLine, zy = 460;
    ctx.moveTo(zx, zy);
    for (let s = 0; s < 5; s++) {
      zx += (Math.random() - 0.5) * 24;
      zy  = 460 + (s / 5) * 30;
      ctx.lineTo(zx, zy);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

function drawHauntedArena() {
  // Gothic windows in background
  const winXs = [60, 240, 450, 660, 840];
  for (let i = 0; i < winXs.length; i++) {
    const wx  = winXs[i];
    const wy  = 80 + (i % 2) * 40;
    const glow = 0.3 + Math.abs(Math.sin(frameCount * 0.025 + i * 0.7)) * 0.4;
    // Window frame
    ctx.fillStyle   = 'rgba(60,40,80,0.55)';
    ctx.fillRect(wx - 14, wy, 28, 55);
    // Arched top
    ctx.beginPath();
    ctx.arc(wx, wy, 14, Math.PI, 0);
    ctx.fill();
    // Glowing interior
    ctx.globalAlpha = glow * 0.45;
    ctx.fillStyle   = '#ffcc44';
    ctx.fillRect(wx - 10, wy + 4, 20, 44);
    ctx.globalAlpha = 1;
  }
  // Atmospheric fog wisps
  for (let i = 0; i < 4; i++) {
    const fx = ((frameCount * (0.15 + i * 0.08) + i * 230) % 970) - 30;
    const fy = 280 + Math.sin(frameCount * 0.015 + i * 1.4) * 60;
    ctx.globalAlpha = 0.06 + Math.sin(frameCount * 0.02 + i) * 0.03;
    ctx.fillStyle   = '#cc99ff';
    ctx.beginPath();
    ctx.ellipse(fx, fy, 70, 22, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  // Ghost sprites from perk state
  if (mapPerkState.ghosts) {
    for (const gh of mapPerkState.ghosts) {
      const ga = 0.35 + Math.sin(frameCount * 0.08 + gh.x * 0.02) * 0.2;
      ctx.globalAlpha = Math.max(0, ga);
      ctx.fillStyle   = '#ddc8ff';
      ctx.shadowColor = '#aa66ff';
      ctx.shadowBlur  = 12;
      // Body
      ctx.beginPath();
      ctx.arc(gh.x, gh.y - 10, 14, Math.PI, 0);
      ctx.lineTo(gh.x + 14, gh.y + 12);
      ctx.quadraticCurveTo(gh.x + 7,  gh.y + 6,  gh.x,     gh.y + 12);
      ctx.quadraticCurveTo(gh.x - 7,  gh.y + 6,  gh.x - 14, gh.y + 12);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
    }
    ctx.globalAlpha = 1;
  }
}

function drawCloudsArena() {
  // Golden sky gradient band near horizon
  const sunG = ctx.createLinearGradient(0, 200, 0, GAME_H);
  sunG.addColorStop(0, 'rgba(255,220,100,0)');
  sunG.addColorStop(1, 'rgba(255,200,80,0.18)');
  ctx.fillStyle = sunG;
  ctx.fillRect(0, 200, GAME_W, GAME_H - 200);
  // Animated fluffy cloud shapes
  const cDefs = [
    { ox: 80,  y: 60,  speed: 0.10, r: 38 },
    { ox: 340, y: 95,  speed: 0.07, r: 28 },
    { ox: 600, y: 55,  speed: 0.13, r: 44 },
    { ox: 200, y: 140, speed: 0.09, r: 22 },
    { ox: 750, y: 120, speed: 0.11, r: 32 },
  ];
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  for (const c of cDefs) {
    const cx2 = ((frameCount * c.speed + c.ox) % 970) - 50;
    ctx.beginPath();
    ctx.arc(cx2,           c.y,         c.r,       0, Math.PI * 2);
    ctx.arc(cx2 + c.r*0.8, c.y - c.r*0.3, c.r*0.7, 0, Math.PI * 2);
    ctx.arc(cx2 - c.r*0.6, c.y - c.r*0.2, c.r*0.6, 0, Math.PI * 2);
    ctx.fill();
  }
  // Distant smaller clouds
  ctx.fillStyle = 'rgba(220,240,255,0.45)';
  for (let i = 0; i < 6; i++) {
    const scx = ((frameCount * 0.05 + i * 160) % 960) - 20;
    const scy = 170 + i * 18;
    ctx.beginPath();
    ctx.ellipse(scx, scy, 50, 14, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawNeonGridArena() {
  // Pulsing green grid lines
  const pulse = 0.5 + Math.abs(Math.sin(frameCount * 0.03)) * 0.5;
  ctx.save();
  ctx.strokeStyle = `rgba(0,255,68,${0.15 * pulse})`;
  ctx.lineWidth   = 1;
  for (let gx = 0; gx <= GAME_W; gx += 50) {
    ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, GAME_H); ctx.stroke();
  }
  for (let gy = 0; gy <= GAME_H; gy += 50) {
    ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(GAME_W, gy); ctx.stroke();
  }
  // Bright horizon line
  ctx.globalAlpha = 0.25 * pulse;
  ctx.strokeStyle = '#00ff44';
  ctx.lineWidth   = 2;
  ctx.shadowColor = '#00ff44';
  ctx.shadowBlur  = 14;
  ctx.beginPath(); ctx.moveTo(0, 460); ctx.lineTo(GAME_W, 460); ctx.stroke();
  ctx.shadowBlur = 0;
  // Speed-boost pad indicators
  if (MAP_PERK_DEFS.neonGrid && MAP_PERK_DEFS.neonGrid.boostPads) {
    for (const pad of MAP_PERK_DEFS.neonGrid.boostPads) {
      ctx.globalAlpha = 0.35 + Math.abs(Math.sin(frameCount * 0.08 + pad.x * 0.01)) * 0.35;
      ctx.fillStyle   = '#00ff44';
      ctx.shadowColor = '#00ff44';
      ctx.shadowBlur  = 10;
      ctx.fillRect(pad.x - 20, pad.y, 40, 8);
    }
    ctx.shadowBlur = 0;
  }
  // Floating data-stream particles
  for (let i = 0; i < 8; i++) {
    const dx = ((frameCount * (0.5 + i * 0.1) + i * 112) % 920) - 10;
    const dy = ((frameCount * (0.9 + i * 0.07) + i * 65) % 520);
    ctx.globalAlpha = 0.18;
    ctx.fillStyle   = i % 2 === 0 ? '#00ff44' : '#44ffaa';
    ctx.fillRect(dx, dy, 2, 8);
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

function drawMushroomArena() {
  // Colorful background mushroom shapes
  const mDefs = [
    { x: 30,  capR: 45, stemH: 50, color: '#ff44cc' },
    { x: 180, capR: 35, stemH: 40, color: '#ff8822' },
    { x: 310, capR: 52, stemH: 60, color: '#44ffaa' },
    { x: 480, capR: 40, stemH: 45, color: '#ff4488' },
    { x: 630, capR: 48, stemH: 55, color: '#ffcc00' },
    { x: 780, capR: 38, stemH: 42, color: '#88aaff' },
    { x: 880, capR: 42, stemH: 48, color: '#ff44cc' },
  ];
  for (const m of mDefs) {
    const bob = Math.sin(frameCount * 0.015 + m.x * 0.01) * 4;
    const groundY = 480;
    // Stem
    ctx.fillStyle = 'rgba(240,220,200,0.45)';
    ctx.fillRect(m.x - 8, groundY - m.stemH + bob, 16, m.stemH);
    // Cap
    ctx.globalAlpha = 0.5;
    ctx.fillStyle   = m.color;
    ctx.beginPath();
    ctx.ellipse(m.x, groundY - m.stemH + bob, m.capR, m.capR * 0.55, 0, Math.PI, 0);
    ctx.fill();
    // Spots
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.globalAlpha = 0.4;
    for (let s = 0; s < 3; s++) {
      ctx.beginPath();
      ctx.arc(m.x + (s - 1) * m.capR * 0.38, groundY - m.stemH - m.capR * 0.22 + bob, m.capR * 0.12, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  // Sparkle particles
  for (let i = 0; i < 7; i++) {
    const sx  = ((frameCount * (0.3 + i * 0.1) + i * 135) % 940) - 20;
    const sy  = 100 + ((frameCount * (0.5 + i * 0.08) + i * 55) % 380);
    const sa  = 0.25 + Math.abs(Math.sin(frameCount * 0.1 + i)) * 0.55;
    const col = ['#ff88ff', '#ffcc44', '#88ffcc', '#ff8844', '#aaffee'][i % 5];
    ctx.globalAlpha = sa;
    ctx.fillStyle   = col;
    ctx.beginPath();
    ctx.arc(sx, sy, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}
