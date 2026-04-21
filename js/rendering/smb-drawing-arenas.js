// Depends on: smb-globals.js
//   globals used: ctx, GAME_W, GAME_H, frameCount, currentArena,
//                 players, bossFloorState, bossFloorType, tfFloorRemoved

function drawSoccerArena() {
  // Green field with vertical stripe pattern
  ctx.fillStyle = '#2d6b1e';
  ctx.fillRect(0, 0, GAME_W, GAME_H);
  for (let i = 0; i < 9; i++) {
    if (i % 2 === 0) {
      ctx.fillStyle = 'rgba(0,0,0,0.06)';
      ctx.fillRect(i * 100, 0, 100, GAME_H);
    }
  }
}

function drawVoidArena() {
  // Subtle void distortion rings
  ctx.save();
  for (let i = 0; i < 4; i++) {
    const pulse = (frameCount * 0.008 + i * 1.4) % (Math.PI * 2);
    const r = 90 + i * 60 + Math.sin(pulse) * 20;
    const alpha = 0.04 + Math.sin(pulse) * 0.02;
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(GAME_W / 2, GAME_H / 2, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  // Draw lava on floor if boss floor hazard is active (same as creator arena)
  if (bossFloorState === 'hazard' && bossFloorType === 'lava') {
    const ly = 460;
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
    ctx.lineTo(GAME_W, GAME_H);
    ctx.lineTo(0, GAME_H);
    ctx.closePath();
    ctx.fill();
    ctx.shadowColor = '#ff4400';
    ctx.shadowBlur  = 20;
    ctx.fillStyle   = 'rgba(255,80,0,0.22)';
    ctx.fillRect(0, ly - 10, GAME_W, 12);
    ctx.shadowBlur  = 0;
  }

  // Void floor hazard from bossFloorState machine (type = 'void')
  if (bossFloorState === 'hazard' && bossFloorType === 'void') {
    const vy = 460;
    ctx.save();
    const vg = ctx.createLinearGradient(0, vy, 0, GAME_H);
    vg.addColorStop(0,   'rgba(20,0,60,0.92)');
    vg.addColorStop(0.3, 'rgba(8,0,30,0.97)');
    vg.addColorStop(1,   'rgba(0,0,0,1)');
    ctx.fillStyle = vg;
    ctx.beginPath();
    ctx.moveTo(0, vy);
    for (let x = 0; x <= GAME_W; x += 18) {
      ctx.lineTo(x, vy + Math.sin(x * 0.045 + frameCount * 0.07) * 6);
    }
    ctx.lineTo(GAME_W, GAME_H);
    ctx.lineTo(0, GAME_H);
    ctx.closePath();
    ctx.fill();
    ctx.shadowColor = '#6600cc';
    ctx.shadowBlur  = 28;
    ctx.fillStyle   = `rgba(80,0,180,${0.18 + Math.abs(Math.sin(frameCount * 0.04)) * 0.12})`;
    ctx.fillRect(0, vy - 10, GAME_W, 12);
    ctx.shadowBlur  = 0;
    ctx.restore();
  }

  // When floor is removed by TrueForm attack: orange lava rises from below
  if (tfFloorRemoved) {
    ctx.globalAlpha = 1;
    const ly = 460;
    const lg = ctx.createLinearGradient(0, ly, 0, GAME_H);
    lg.addColorStop(0,   '#ff6600');
    lg.addColorStop(0.3, '#cc2200');
    lg.addColorStop(1,   '#880000');
    ctx.fillStyle = lg;
    ctx.beginPath();
    ctx.moveTo(0, ly);
    for (let x = 0; x <= GAME_W; x += 18) {
      ctx.lineTo(x, ly + Math.sin(x * 0.055 + frameCount * 0.09) * 8);
    }
    ctx.lineTo(GAME_W, GAME_H);
    ctx.lineTo(0, GAME_H);
    ctx.closePath();
    ctx.fill();
    ctx.save();
    ctx.shadowColor = '#ff4400';
    ctx.shadowBlur  = 24;
    ctx.fillStyle   = 'rgba(255,100,0,0.28)';
    ctx.fillRect(0, ly - 12, GAME_W, 14);
    ctx.restore();
  }
}

function drawCreatorArena() {
  // Dramatic purple lightning during phase 2 and 3
  const boss = players.find(p => p.isBoss);
  if (boss && boss.health > 0) {
    const bPhase = boss.health > 2000 ? 1 : boss.health > 1000 ? 2 : 3;
    if (bPhase >= 2) {
      // Each lightning bolt: random jagged line from top to mid-screen
      const boltCount = bPhase === 3 ? 3 : 1;
      for (let b = 0; b < boltCount; b++) {
        // Each bolt uses a slowly cycling seed so it persists a few frames, then jumps
        const seed  = Math.floor(frameCount / 4) * 37 + b * 1731;
        const seededRand = (n) => (Math.sin(seed + n * 127.1) * 43758.5453) % 1;
        const startX = (Math.abs(seededRand(0)) % 1) * GAME_W;
        const alpha  = 0.12 + Math.abs(Math.sin(frameCount * 0.11 + b)) * 0.25;
        if (alpha < 0.06) continue; // occasional off flash
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = bPhase === 3 ? '#ff88ff' : '#aa44ff';
        ctx.shadowColor = bPhase === 3 ? '#ff00ff' : '#8800ff';
        ctx.shadowBlur  = 14;
        ctx.lineWidth   = 1.5;
        ctx.beginPath();
        let lx = startX, ly = 0;
        ctx.moveTo(lx, ly);
        const steps = 6 + Math.floor(Math.abs(seededRand(1)) * 4);
        for (let s = 1; s <= steps; s++) {
          lx += (seededRand(s * 3 + 1) - 0.5) * 80;
          ly  = (s / steps) * 260;
          ctx.lineTo(lx, ly);
        }
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  // Pulsing void portals in the background
  for (let i = 0; i < 6; i++) {
    const bx = (i * 160 + Math.sin(frameCount * 0.007 + i * 1.1) * 55) % 900;
    const by = 80 + Math.sin(frameCount * 0.011 + i * 1.4) * 70;
    const r  = 35 + Math.sin(frameCount * 0.019 + i) * 12;
    const g  = ctx.createRadialGradient(bx, by, 0, bx, by, r);
    g.addColorStop(0, 'rgba(200,0,255,0.14)');
    g.addColorStop(1, 'rgba(80,0,140,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(bx, by, r, 0, Math.PI * 2); ctx.fill();
  }
  // Draw lava on floor if active hazard
  if (bossFloorState === 'hazard' && bossFloorType === 'lava') {
    const ly = 460;
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
    ctx.lineTo(GAME_W, GAME_H);
    ctx.lineTo(0, GAME_H);
    ctx.closePath();
    ctx.fill();
    ctx.shadowColor = '#ff4400';
    ctx.shadowBlur  = 20;
    ctx.fillStyle   = 'rgba(255,80,0,0.22)';
    ctx.fillRect(0, ly - 10, GAME_W, 12);
    ctx.shadowBlur  = 0;
  }

  // Invisible walls — glowing neon energy barriers on left and right
  const wallPulse = 0.35 + Math.abs(Math.sin(frameCount * 0.04)) * 0.45;
  ctx.save();
  for (const wallX of [0, GAME_W]) {
    const grad = ctx.createLinearGradient(
      wallX === 0 ? 0 : GAME_W - 14, 0,
      wallX === 0 ? 14 : GAME_W, 0
    );
    grad.addColorStop(0, `rgba(180,0,255,${wallPulse})`);
    grad.addColorStop(1, 'rgba(180,0,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(wallX === 0 ? 0 : GAME_W - 14, 0, 14, GAME_H);
  }
  ctx.restore();
}

function drawStars() {
  for (const s of bgStars) {
    const alpha = 0.3 + Math.abs(Math.sin(frameCount * s.speed + s.phase)) * 0.7;
    ctx.globalAlpha = alpha;
    ctx.fillStyle   = s.r < 1 ? '#ffffff' : '#aabbff';
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawClouds() {
  const offsets = [100, 420, 700];
  const speeds  = [0.18, 0.12, 0.22];
  const sizes   = [30, 24, 36];
  const ys      = [55, 88, 45];
  ctx.fillStyle = 'rgba(255,255,255,0.72)';
  for (let i = 0; i < 3; i++) {
    const cx = ((frameCount * speeds[i] + offsets[i]) % 1000) - 60;
    const cy = ys[i];
    const r  = sizes[i];
    ctx.beginPath();
    ctx.arc(cx,         cy,       r,       0, Math.PI*2);
    ctx.arc(cx + r*0.8, cy - r*0.3, r*0.7, 0, Math.PI*2);
    ctx.arc(cx - r*0.6, cy - r*0.2, r*0.6, 0, Math.PI*2);
    ctx.fill();
  }
  // Swaying grass tufts along the ground
  const groundY = 460; // grass floor y
  ctx.strokeStyle = '#4a8c32';
  ctx.lineWidth   = 1.5;
  for (let i = 0; i < 28; i++) {
    const tx   = 12 + i * 32;
    const sway = Math.sin(frameCount * 0.025 + i * 0.9) * 5;
    const h    = 8 + Math.sin(i * 2.7) * 4; // varied height
    ctx.globalAlpha = 0.65;
    ctx.beginPath();
    ctx.moveTo(tx, groundY);
    ctx.quadraticCurveTo(tx + sway * 0.5, groundY - h * 0.6, tx + sway, groundY - h);
    ctx.stroke();
    // Second blade
    const sway2 = Math.sin(frameCount * 0.025 + i * 0.9 + 0.5) * 4;
    ctx.beginPath();
    ctx.moveTo(tx + 4, groundY);
    ctx.quadraticCurveTo(tx + 4 + sway2 * 0.5, groundY - h * 0.5, tx + 4 + sway2, groundY - h * 0.85);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawLava() {
  const ly = currentArena.lavaY;
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
  ctx.lineTo(GAME_W, GAME_H);
  ctx.lineTo(0, GAME_H);
  ctx.closePath();
  ctx.fill();
  // glow
  ctx.shadowColor = '#ff4400';
  ctx.shadowBlur  = 22;
  ctx.fillStyle   = 'rgba(255,80,0,0.28)';
  ctx.fillRect(0, ly - 10, GAME_W, 12);
  ctx.shadowBlur  = 0;
}

function drawCityBuildings() {
  for (const b of bgBuildings) {
    const shade = 14 + Math.floor(b.h / 20);
    ctx.fillStyle = `rgb(${shade},${shade},${shade+12})`;
    ctx.fillRect(b.x, GAME_H - b.h, b.w, b.h);
    // windows
    for (const w of b.wins) {
      ctx.fillStyle = w.on ? 'rgba(255,245,160,0.65)' : 'rgba(40,40,60,0.5)';
      ctx.fillRect(w.x, w.y, 7, 9);
    }
    // Neon sign flicker on top edge of taller buildings
    if (b.h > 120) {
      const neonPhase = Math.sin(frameCount * 0.07 + b.x * 0.03);
      const flicker   = neonPhase > 0.85 ? 0 : (0.5 + neonPhase * 0.5); // occasional off flicker
      const neonAlpha = Math.max(0, flicker);
      // Alternate neon colors per building based on position
      const neonColor = (Math.floor(b.x / 80) % 3 === 0) ? `rgba(255,20,100,${neonAlpha})`
                      : (Math.floor(b.x / 80) % 3 === 1) ? `rgba(0,200,255,${neonAlpha})`
                      :                                     `rgba(180,0,255,${neonAlpha})`;
      ctx.save();
      ctx.shadowColor = neonColor;
      ctx.shadowBlur  = 8;
      ctx.strokeStyle = neonColor;
      ctx.lineWidth   = 2;
      ctx.beginPath();
      ctx.moveTo(b.x + 4, GAME_H - b.h - 1);
      ctx.lineTo(b.x + b.w - 4, GAME_H - b.h - 1);
      ctx.stroke();
      ctx.restore();
    }
  }
}

function drawForest() {
  // Animated trees in background
  const treeXs = [45, 140, 280, 480, 620, 760, 860];
  for (let i = 0; i < treeXs.length; i++) {
    const tx   = treeXs[i];
    const sway = Math.sin(frameCount * 0.008 + i * 1.2) * 3;
    // trunk
    ctx.fillStyle = '#3a2010';
    ctx.fillRect(tx - 5, 400, 10, 80);
    // canopy layers
    const shades = ['rgba(30,90,30,0.7)', 'rgba(45,120,40,0.65)', 'rgba(60,150,50,0.6)'];
    for (let j = 0; j < 3; j++) {
      ctx.fillStyle = shades[j];
      ctx.beginPath();
      ctx.arc(tx + sway, 380 - j * 28, 32 - j * 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Fireflies / floating particles
  for (let i = 0; i < 6; i++) {
    const fx = (frameCount * (0.4 + i * 0.15) + i * 150) % 920 - 10;
    const fy = 200 + Math.sin(frameCount * 0.02 + i * 2.1) * 80;
    const fa = 0.4 + Math.sin(frameCount * 0.08 + i) * 0.4;
    ctx.globalAlpha = Math.max(0, fa);
    ctx.fillStyle   = '#ccff44';
    ctx.beginPath();
    ctx.arc(fx, fy, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawIce() {
  // Snow particles falling
  for (let i = 0; i < 12; i++) {
    const sx = ((frameCount * (0.6 + i * 0.1) + i * 75) % 930) - 15;
    const sy = ((frameCount * (1.2 + i * 0.08) + i * 42) % 520);
    const sa = 0.3 + (i % 3) * 0.2;
    ctx.globalAlpha = sa;
    ctx.fillStyle   = '#ffffff';
    ctx.beginPath();
    ctx.arc(sx, sy, 1.5 + (i % 3), 0, Math.PI * 2);
    ctx.fill();
  }
  // Ice crystals on ground
  ctx.globalAlpha = 0.55;
  ctx.strokeStyle = '#aaddff';
  ctx.lineWidth   = 1.5;
  for (let i = 0; i < 8; i++) {
    const cx2 = 60 + i * 115;
    const cy2 = 455;
    for (let a = 0; a < 3; a++) {
      const ang = (a / 3) * Math.PI;
      ctx.beginPath();
      ctx.moveTo(cx2, cy2);
      ctx.lineTo(cx2 + Math.cos(ang) * 14, cy2 + Math.sin(ang) * 14);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx2, cy2);
      ctx.lineTo(cx2 - Math.cos(ang) * 14, cy2 - Math.sin(ang) * 14);
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
  ctx.lineWidth   = 1;
}

function drawRuins() {
  // Stone columns / pillars in background
  const cols = [50, 200, 360, 540, 700, 850];
  for (let i = 0; i < cols.length; i++) {
    const cx2 = cols[i];
    const broken = i % 3 === 0;
    const colH   = broken ? 180 + (i % 2) * 60 : 260;
    // Column body
    ctx.fillStyle = `rgba(80,65,48,0.55)`;
    ctx.fillRect(cx2 - 10, GAME_H - colH, 20, colH);
    // Column cap
    ctx.fillStyle = `rgba(100,82,58,0.65)`;
    ctx.fillRect(cx2 - 14, GAME_H - colH, 28, 12);
    // Column base
    ctx.fillStyle = `rgba(100,82,58,0.65)`;
    ctx.fillRect(cx2 - 14, GAME_H - 16, 28, 16);
  }
  // Ambient dust motes
  for (let i = 0; i < 5; i++) {
    const dx  = ((frameCount * (0.18 + i * 0.06) + i * 180) % 960) - 30;
    const dy  = 200 + ((frameCount * (0.22 + i * 0.04) + i * 90) % 280);
    const da  = 0.08 + Math.sin(frameCount * 0.03 + i) * 0.06;
    ctx.globalAlpha = Math.max(0, da);
    ctx.fillStyle   = '#c8a86a';
    ctx.beginPath();
    ctx.arc(dx, dy, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawPlatforms() {
  const isBoss = !!currentArena.isBossArena;
  const isVoid = !!currentArena.isVoidArena;
  for (const pl of currentArena.platforms) {
    if (pl.isFloorDisabled) continue;

    if (isVoid) {
      // Void arena: solid black with white outline — no shadow, no highlight
      ctx.fillStyle = '#000000';
      ctx.fillRect(pl.x, pl.y, pl.w, pl.h);
      ctx.save();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.shadowColor = '#fff';
      ctx.shadowBlur  = 4;
      ctx.strokeRect(pl.x, pl.y, pl.w, pl.h);
      ctx.restore();
      continue;
    }

    // shadow (skip for moving boss platforms — cheaper and avoids ghost trails)
    if (!pl.ox && !pl.oy) {
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.fillRect(pl.x + 4, pl.y + 4, pl.w, pl.h);
    }
    // body
    ctx.fillStyle = currentArena.platColor;
    ctx.fillRect(pl.x, pl.y, pl.w, pl.h);
    // top highlight
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.fillRect(pl.x, pl.y, pl.w, 3);
    // border
    ctx.strokeStyle = currentArena.platEdge;
    ctx.lineWidth   = 1.5;
    ctx.strokeRect(pl.x, pl.y, pl.w, pl.h);

    // Boss arena: purple glow on moving platforms
    if (isBoss && (pl.ox !== undefined || pl.oy !== undefined)) {
      ctx.save();
      ctx.strokeStyle = 'rgba(200,0,255,0.7)';
      ctx.lineWidth   = 2;
      ctx.shadowColor = '#aa00ff';
      ctx.shadowBlur  = 10;
      ctx.strokeRect(pl.x, pl.y, pl.w, pl.h);
      ctx.restore();
    }

    // Floor hazard flash during warning
    if (isBoss && pl.isFloor && bossFloorState === 'warning') {
      const flash = Math.sin(frameCount * 0.35) > 0;
      if (flash) {
        ctx.save();
        ctx.fillStyle = bossFloorType === 'lava' ? 'rgba(255,70,0,0.55)' : 'rgba(20,0,60,0.70)';
        ctx.fillRect(pl.x, pl.y, pl.w, pl.h);
        ctx.restore();
      }
    }
  }

  // Floor hazard countdown banner
  if (isBoss && bossFloorState === 'warning') {
    const secs = Math.ceil(bossFloorTimer / 60);
    const isLava = bossFloorType === 'lava';
    ctx.save();
    ctx.font        = 'bold 20px Arial';
    ctx.fillStyle   = isLava ? '#ff5500' : '#bb88ff';
    ctx.textAlign   = 'center';
    ctx.shadowColor = 'rgba(0,0,0,0.95)';
    ctx.shadowBlur  = 10;
    ctx.fillText(`${isLava ? '🌋 LAVA' : '🌑 VOID'} IN ${secs}s`, GAME_W / 2, 444);
    ctx.restore();
  }
}

// ============================================================
// STORY MODE VOID FOG
// ============================================================
function drawStoryVoidFog() {
  if (!storyModeActive || !currentArena) return;

  // Find floor top: prefer isFloor-tagged platform, fall back to lowest platform
  let floorTopY = currentArena.deathY - 60;
  if (currentArena.platforms) {
    const floorPl = currentArena.platforms.find(pl => pl.isFloor && !pl.isFloorDisabled);
    if (floorPl) {
      floorTopY = floorPl.y;
    } else {
      for (const pl of currentArena.platforms) {
        if (!pl.isFloorDisabled) floorTopY = Math.max(floorTopY, pl.y);
      }
    }
  }

  const fogStartY = floorTopY;
  const fogEndY   = currentArena.deathY + 80;
  const fogHeight = fogEndY - fogStartY;
  if (fogHeight <= 0) return;

  // Cover full world width — no void peeks through on wide maps
  const fogX = currentArena.mapLeft !== undefined ? currentArena.mapLeft - 200 : -200;
  const fogW  = (currentArena.worldWidth ? currentArena.worldWidth + 400 : GAME_W + 400);

  const grad = ctx.createLinearGradient(0, fogStartY, 0, fogEndY);
  grad.addColorStop(0,    'rgba(0,0,0,0)');
  grad.addColorStop(0.08, 'rgba(0,0,0,0.18)');
  grad.addColorStop(0.30, 'rgba(0,0,0,0.60)');
  grad.addColorStop(0.55, 'rgba(0,0,0,0.90)');
  grad.addColorStop(1.0,  'rgba(0,0,0,1.0)');

  ctx.fillStyle = grad;
  ctx.fillRect(fogX, fogStartY, fogW, fogHeight);
}

// ── Story boundary proximity warning (edge vignette, world-space) ────────
function drawStoryBoundaryWarning() {
  if (!storyModeActive || !currentArena || gameMode === 'exploration') return;
  const worldW = currentArena.worldWidth || GAME_W;
  // Check if any non-boss player is close to the soft boundary zone
  let leftIntensity = 0, rightIntensity = 0;
  for (const p of players) {
    if (!p || p.isBoss || p.health <= 0) continue;
    const distL = p.x;
    const distR = GAME_W - (p.x + p.w);
    if (distL < 140) leftIntensity  = Math.max(leftIntensity,  1 - distL / 140);
    if (distR < 140) rightIntensity = Math.max(rightIntensity, 1 - distR / 140);
  }
  if (leftIntensity <= 0 && rightIntensity <= 0) return;
  ctx.save();
  // Left warning gradient
  if (leftIntensity > 0) {
    const gl = ctx.createLinearGradient(0, 0, 120, 0);
    gl.addColorStop(0,   `rgba(80,0,180,${(leftIntensity * 0.55).toFixed(2)})`);
    gl.addColorStop(0.6, `rgba(80,0,180,${(leftIntensity * 0.18).toFixed(2)})`);
    gl.addColorStop(1.0, 'rgba(80,0,180,0)');
    ctx.fillStyle = gl;
    ctx.fillRect(0, 0, 120, GAME_H);
    // Glitch lines
    ctx.strokeStyle = `rgba(180,100,255,${(leftIntensity * 0.6).toFixed(2)})`;
    ctx.lineWidth = 1;
    for (let i = 0; i < 4; i++) {
      const gy = Math.floor(Math.random() * GAME_H);
      ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(30 + Math.random() * 50, gy); ctx.stroke();
    }
  }
  // Right warning gradient
  if (rightIntensity > 0) {
    const gr = ctx.createLinearGradient(GAME_W, 0, GAME_W - 120, 0);
    gr.addColorStop(0,   `rgba(80,0,180,${(rightIntensity * 0.55).toFixed(2)})`);
    gr.addColorStop(0.6, `rgba(80,0,180,${(rightIntensity * 0.18).toFixed(2)})`);
    gr.addColorStop(1.0, 'rgba(80,0,180,0)');
    ctx.fillStyle = gr;
    ctx.fillRect(GAME_W - 120, 0, 120, GAME_H);
    ctx.strokeStyle = `rgba(180,100,255,${(rightIntensity * 0.6).toFixed(2)})`;
    ctx.lineWidth = 1;
    for (let i = 0; i < 4; i++) {
      const gy = Math.floor(Math.random() * GAME_H);
      ctx.beginPath(); ctx.moveTo(GAME_W, gy); ctx.lineTo(GAME_W - 30 - Math.random() * 50, gy); ctx.stroke();
    }
  }
  ctx.restore();
}

// ── Ability unlock toast (story mode) ────────────────────────────────────
function drawAbilityUnlockToast() {
  if (!abilityUnlockToast || abilityUnlockToast.timer <= 0) return;
  abilityUnlockToast.timer--;
  const t   = abilityUnlockToast.timer / abilityUnlockToast.maxTimer;
  const alpha = t > 0.85 ? (1 - t) / 0.15 : (t < 0.15 ? t / 0.15 : 1);
  const rise  = (1 - t) * 22;

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const cx = canvas.width / 2;
  const cy = canvas.height * 0.22 - rise; // keep below HUD top bar

  ctx.globalAlpha = alpha * 0.88;
  ctx.fillStyle   = 'rgba(0,0,0,0.75)';
  const tw = 460, th = 52, tr = 12;
  const tx = cx - tw / 2, ty = cy - th / 2;
  ctx.beginPath();
  ctx.roundRect(tx, ty, tw, th, tr);
  ctx.fill();

  ctx.strokeStyle = abilityUnlockToast.color || '#ffcc44';
  ctx.lineWidth = 2;
  ctx.globalAlpha = alpha;
  ctx.stroke();

  ctx.fillStyle = abilityUnlockToast.color || '#ffcc44';
  ctx.font      = 'bold 16px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('NEW ABILITY UNLOCKED', cx, ty + 16);
  ctx.fillStyle = '#ffffff';
  ctx.font      = '14px Arial';
  ctx.fillText(abilityUnlockToast.text, cx, ty + 36);

  ctx.globalAlpha = 1;
  ctx.restore();
}

// ── Exploration HUD ───────────────────────────────────────────────────────
function drawExploreHUD() {
  if (!exploreActive || !players[0]) return;
  const p1 = players[0];

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  const cw = canvas.width, ch = canvas.height;
  const barW = 280, barH = 14;
  const barX = cw / 2 - barW / 2;
  const barY = _hudBottom() + 10; // sit just below the DOM HUD bar

  const progress = Math.min(1, Math.max(0, p1.x / exploreGoalX));

  // Bar background
  ctx.globalAlpha = 0.82;
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.beginPath(); ctx.roundRect(barX - 4, barY - 4, barW + 8, barH + 22, 6); ctx.fill();

  // Bar fill
  ctx.fillStyle = exploreGoalFound ? '#ffffaa' : '#44ccff';
  ctx.beginPath(); ctx.roundRect(barX, barY, barW * progress, barH, 4); ctx.fill();

  // Bar outline
  ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.roundRect(barX, barY, barW, barH, 4); ctx.stroke();

  // Label
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 11px Arial';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(`FIND: ${exploreGoalName}`, barX, barY + barH + 4);
  if (storyPhaseIndicator) {
    ctx.fillStyle = '#9fd4ff';
    ctx.textAlign = 'right';
    ctx.fillText(`PHASE ${storyPhaseIndicator.index}/${storyPhaseIndicator.total}  ${storyPhaseIndicator.label}`, barX + barW, barY + barH + 4);
  }

  // Distance hint (arrow on right side of screen when goal is ahead)
  if (!exploreGoalFound && p1.x < exploreGoalX - 150) {
    const arrowX = cw * 0.92, arrowY = ch / 2;
    ctx.globalAlpha = 0.6 + 0.3 * Math.sin(frameCount * 0.08);
    ctx.fillStyle = '#44ccff';
    ctx.font = 'bold 28px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('▶', arrowX, arrowY);
    ctx.font = '10px Arial';
    const dist = Math.round((exploreGoalX - p1.x) / 10);
    ctx.fillText(`${dist}m`, arrowX, arrowY + 20);
  }

  ctx.globalAlpha = 1;
  ctx.restore();
}

function drawStoryPhaseHUD() {
  if (!storyModeActive || !storyPhaseIndicator) return;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const w = 210;
  const h = 36;
  const x = canvas.width - w - 18;
  const y = _hudBottom() + 12;
  ctx.fillStyle = 'rgba(6,10,20,0.78)';
  ctx.strokeStyle = 'rgba(120,190,255,0.30)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 10);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#8cc8ff';
  ctx.font = 'bold 10px Arial';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(`PHASE ${storyPhaseIndicator.index} / ${storyPhaseIndicator.total}`, x + 12, y + 7);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 11px Arial';
  ctx.fillText(storyPhaseIndicator.label || 'Engage', x + 12, y + 19);
  ctx.restore();
}

// Draw goal object in WORLD space (called from gameLoop before HUD reset)
function drawExploreGoalObject() {
  if (!exploreActive) return;
  for (const portal of (exploreSidePortals || [])) {
    if (!portal || !portal.active || portal.entered) continue;
    const pulseP = Math.sin(frameCount * 0.1) * 0.35 + 0.65;
    ctx.save();
    ctx.shadowColor = portal.type === 'distorted_rift' ? '#ff55ff' : '#44ccff';
    ctx.shadowBlur = 18 + pulseP * 10;
    ctx.globalAlpha = pulseP;
    ctx.strokeStyle = portal.type === 'distorted_rift' ? '#ff88ff' : '#88ddff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(portal.x, portal.y, 20 + pulseP * 8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.font = 'bold 10px Arial';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(portal.type === 'distorted_rift' ? 'DISTORTED RIFT' : 'SIDE PORTAL', portal.x, portal.y - 32);
    ctx.restore();
  }
  if (exploreGoalFound) return;
  const gx = exploreGoalX + 12;
  const gy = 380;
  const pulse = Math.sin(frameCount * 0.08) * 0.4 + 0.6;

  // Glow
  ctx.save();
  ctx.shadowColor = '#ffffaa';
  ctx.shadowBlur  = 20 + pulse * 15;
  ctx.globalAlpha = pulse;

  // Beacon pillar
  ctx.fillStyle = '#ffffcc';
  ctx.fillRect(gx - 4, gy - 50, 8, 50);

  // Beacon orb
  ctx.beginPath();
  ctx.arc(gx, gy - 54, 14, 0, Math.PI * 2);
  const og = ctx.createRadialGradient(gx, gy - 54, 0, gx, gy - 54, 14);
  og.addColorStop(0, 'rgba(255,255,200,1)');
  og.addColorStop(1, 'rgba(200,180,50,0)');
  ctx.fillStyle = og;
  ctx.fill();

  // Outer ring
  ctx.strokeStyle = `rgba(255,240,100,${0.6 * pulse})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(gx, gy - 54, 20 + pulse * 6, 0, Math.PI * 2);
  ctx.stroke();

  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;
  ctx.restore();
}

// ============================================================
// DEATH / RESPAWN / WIN
// ============================================================
function checkDeaths() {
  for (const p of players) {
    if (p.isRemote) continue; // remote player deaths are managed on their own machine
    if (p.health <= 0 && p.invincible === 0) {
      // Notify AdaptiveAI of its death so it can adapt immediately
      if (p.isAdaptive && typeof p.onDeath === 'function') p.onDeath();

      // Chaos mode: infinite respawn with kill tracking
      if (typeof chaosMode !== 'undefined' && chaosMode && !p.isBoss) {
        addKillFeed(p);
        if (typeof chaosModeRecordKill === 'function') chaosModeRecordKill(p);
        spawnParticles(p.cx(), p.cy(), p.color, 20);
        if (!p.ragdollTimer) { p.ragdollTimer = 45; p.ragdollSpin = (Math.random() - 0.5) * 0.25; }
        if (typeof VerletRagdoll !== 'undefined') {
          const vr = new VerletRagdoll(p);
          if (currentArena) {
            const floor = currentArena.platforms.find(pl => pl.isFloor && !pl.isFloorDisabled);
            if (floor) vr.floorY = floor.y;
          }
          verletRagdolls.push(vr);
        }
        if (p._rd) PlayerRagdoll.collapse(p);
        p.invincible = 999;
        respawnCountdowns.push({ color: p.color, x: p.spawnX, y: p.spawnY - 80, framesLeft: 66 });
        setTimeout(() => { if (gameRunning) p.respawn(); }, 1100);
        continue;
      }

      // Damnation echo death: drop anchor orb, advance wave — do NOT trigger cinematic death scenes
      if (damnationActive && p.isBoss && p.isEcho && p.invincible === 0) {
        spawnParticles(p.cx(), p.cy(), p.color, 30);
        if (!p.ragdollTimer) { p.ragdollTimer = 45; p.ragdollSpin = (Math.random() - 0.5) * 0.25; }
        if (!p._anchorDropped) {
          p._anchorDropped = true;
          damnationAnchorOrbs.push({ x: p.cx(), y: p.y + p.h / 2, frame: 0 });
        }
        p.invincible = 999;
        damnationCheckpoint = Math.max(damnationCheckpoint, damnationWave);
        damnationWave++;
        // Spawn next wave (wave 3: TrueForm echo)
        if (typeof spawnDamnationWave === 'function') spawnDamnationWave();
        continue;
      }

      // Damnation human death: lose a platform, not a life
      if (damnationActive && !p.isBoss && !p.isEcho) {
        damnationDeaths++;
        SoundManager.death();
        spawnParticles(p.cx(), p.cy(), p.color, 20);
        if (!p.ragdollTimer) { p.ragdollTimer = 45; p.ragdollSpin = (Math.random() - 0.5) * 0.25; }
        // Remove the next platform in sequence
        if (damnationDeaths <= damnationRemovalOrder.length && currentArena) {
          const removeIdx = damnationRemovalOrder[damnationDeaths - 1];
          if (currentArena.platforms[removeIdx]) {
            currentArena.platforms[removeIdx].isFloorDisabled = true;
            if (typeof SoundManager !== 'undefined' && SoundManager.explosion) SoundManager.explosion();
          }
        }
        if (damnationDeaths >= 4) {
          // Total Erasure: fail condition
          damnationActive = false;
          if (typeof endGame === 'function') endGame(0); // player 0 = no winner (loss)
          continue;
        }
        p.invincible = 120;
        const spawnPl = currentArena && currentArena.platforms.find(pl => pl.isFloor && !pl.isFloorDisabled);
        const spawnX = spawnPl ? spawnPl.x + spawnPl.w / 2 : GAME_W / 2;
        const spawnY = spawnPl ? spawnPl.y - 60 : 400;
        p.x = spawnX - p.w / 2; p.y = spawnY; p.vx = 0; p.vy = 0; p.health = p.maxHealth;
        continue;
      }

      // Boss defeat: trigger cinematic scene instead of normal death
      // True Form ending fires at 10% HP threshold (not on actual death)
      if (p.isBoss && p.isTrueForm) {
        // During the intro sequence (opening_fight → paradox_death → absorption → punch_transition)
        // keep TF alive and do NOT fire the ending — the sequence must complete in strict order.
        const introActive = (typeof tfCinematicState !== 'undefined')
          && tfCinematicState !== 'none'
          && tfCinematicState !== 'backstage';
        if (introActive) {
          p.health = Math.max(p.health, 1); // prevent accidental death mid-sequence
          continue;
        }
        if (!tfEndingScene && !bossDeathScene && !p._tfEndingPrimed
            && p.health > 0 && p.health <= p.maxHealth * 0.10) {
          // Round 1 end: intro sequence not yet done — route through Paradox return → Code Realm → Round 2
          if (typeof tfFalseVictoryFired !== 'undefined' && !tfFalseVictoryFired
              && typeof startTFParadoxReturn1000 === 'function') {
            p.invincible = 9999;
            if (p._cinematicFired) p._cinematicFired.add('paradox1000'); // block AI double-fire
            startTFParadoxReturn1000(p);
          } else {
            // Round 2: fire the real ending
            p._tfEndingPrimed = true;
            p.invincible = 999999;
            startTFEnding(p);
          }
          continue;
        }
        // health=0 fallthrough — same routing logic
        if (!tfEndingScene && !bossDeathScene) {
          if (typeof tfFalseVictoryFired !== 'undefined' && !tfFalseVictoryFired
              && typeof startTFParadoxReturn1000 === 'function') {
            p.health = 1;     // keep alive for intro sequence
            p.invincible = 9999;
            if (p._cinematicFired) p._cinematicFired.add('paradox1000');
            startTFParadoxReturn1000(p);
          } else {
            startTFEnding(p); // Round 2 real ending
          }
          continue;
        }
        if (tfEndingScene || bossDeathScene)   { continue; }
      }
      if (p.isBoss && !bossDeathScene) { startBossDeathScene(p); continue; }
      if (p.isBoss && bossDeathScene)  { continue; } // handled by death scene
      SoundManager.death();
      const isMgSurvival = gameMode === 'minigames' && (minigameType === 'survival' || minigameType === 'koth' || minigameType === 'chaos') && !p.isBoss;
      if ((trainingMode || isMgSurvival) && !p.isBoss) {
        // Training/survival minigame: player respawns infinitely, no game-over
        addKillFeed(p);
        spawnParticles(p.cx(), p.cy(), p.color, 20);
        if (!p.ragdollTimer) { p.ragdollTimer = 45; p.ragdollSpin = (Math.random() - 0.5) * 0.25; }
        if (typeof VerletRagdoll !== 'undefined') {
          const vr = new VerletRagdoll(p);
          if (currentArena) {
            const floor = currentArena.platforms.find(pl => pl.isFloor && !pl.isFloorDisabled);
            if (floor) vr.floorY = floor.y;
          }
          verletRagdolls.push(vr);
        }
        if (p._rd) PlayerRagdoll.collapse(p);
        p.invincible = 999;
        p.vy = -10; p.vx = (Math.random() - 0.5) * 14;
        respawnCountdowns.push({ color: p.color, x: p.spawnX, y: p.spawnY - 80, framesLeft: 66 });
        setTimeout(() => {
          if (!gameRunning) return;
          if (completeRandomizer && gameMode !== 'boss' && gameMode !== 'trueform') {
            const arenaPool = ARENA_KEYS_ORDERED.filter(k => ARENAS[k] && !ARENAS[k].isStoryOnly);
            switchArenaWithTransition(randChoice(arenaPool), () => p.respawn());
          } else {
            p.respawn();
          }
        }, 1100);
      } else if (infiniteMode && !p.isBoss) {
        // Infinite mode: award win to opponent, always respawn
        const other = players.find(q => q !== p);
        if (other) { if (p === players[0]) winsP2++; else winsP1++; }
        addKillFeed(p);
        spawnParticles(p.cx(), p.cy(), p.color, 20);
        if (!p.ragdollTimer) { p.ragdollTimer = 45; p.ragdollSpin = (Math.random() - 0.5) * 0.25; }
        if (typeof VerletRagdoll !== 'undefined') {
          const vr = new VerletRagdoll(p);
          if (currentArena) {
            const floor = currentArena.platforms.find(pl => pl.isFloor && !pl.isFloorDisabled);
            if (floor) vr.floorY = floor.y;
          }
          verletRagdolls.push(vr);
        }
        if (p._rd) PlayerRagdoll.collapse(p);
        p.invincible = 999;
        respawnCountdowns.push({ color: p.color, x: p.spawnX, y: p.spawnY - 80, framesLeft: 66 });
        setTimeout(() => {
          if (!gameRunning) return;
          if (completeRandomizer && gameMode !== 'boss' && gameMode !== 'trueform') {
            const arenaPool = ARENA_KEYS_ORDERED.filter(k => ARENAS[k] && !ARENAS[k].isStoryOnly);
            switchArenaWithTransition(randChoice(arenaPool), () => p.respawn());
          } else {
            p.respawn();
          }
        }, 1100);
      } else if (p.lives > 0) {
        p.lives--;
        p.invincible = 999; // block re-trigger until respawn clears it
        // Story event: enemy just died — fire FIRST_KILL for the killer
        if (storyModeActive && p.isAI && typeof storyOnEnemyDeath === 'function') {
          const killer = players.find(q => q !== p && !q.isAI);
          storyOnEnemyDeath(p, killer || null);
        }
        // Award EXP for killing a story enemy
        if (storyModeActive && p.isAI && !p.isBoss && typeof _storyAwardKillExp === 'function') {
          _storyAwardKillExp(12);
        }
        addKillFeed(p);
        spawnParticles(p.cx(), p.cy(), p.color, 20);
        if (!p.ragdollTimer) { p.ragdollTimer = 45; p.ragdollSpin = (Math.random() - 0.5) * 0.25; }
        if (typeof VerletRagdoll !== 'undefined') {
          const vr = new VerletRagdoll(p);
          if (currentArena) {
            const floor = currentArena.platforms.find(pl => pl.isFloor && !pl.isFloorDisabled);
            if (floor) vr.floorY = floor.y;
          }
          verletRagdolls.push(vr);
        }
        if (p._rd) PlayerRagdoll.collapse(p);
        if (p.lives > 0) {
          respawnCountdowns.push({ color: p.color, x: p.spawnX, y: p.spawnY - 80, framesLeft: 66 });
          setTimeout(() => {
            if (!gameRunning) return;
            if (completeRandomizer && gameMode !== 'boss' && gameMode !== 'trueform') {
              const arenaPool = ARENA_KEYS_ORDERED.filter(k => ARENAS[k] && !ARENAS[k].isStoryOnly);
              switchArenaWithTransition(randChoice(arenaPool), () => p.respawn());
            } else {
              p.respawn();
            }
          }, 1100);
        } else {
          // Check if boss fake-death should trigger (boss < 33% HP, once per game)
          const boss = players.find(q => q.isBoss);
          if (boss && boss.health < boss.maxHealth * 0.33 && !fakeDeath.triggered && gameMode === 'boss') {
            // Use Paradox revive if available, otherwise fall back to standard fake-death
            if (typeof triggerParadoxRevive === 'function') {
              triggerParadoxRevive(p);
            } else {
              triggerFakeDeath(p);
            }
          } else if (gameMode === 'boss' && bossPlayerCount === 2) {
            // In 2P boss co-op: only delay end if teammate is still alive
            const otherHumansAlive = players.some(q => !q.isBoss && q !== p && q.lives > 0 && q.health > 0);
            if (otherHumansAlive) {
              p.invincible = 9999; // stay dead, teammate still fighting
            } else {
              setTimeout(endGame, 900);
            }
          } else if (storyModeActive && storyTwoEnemies && !p.isAI) {
            // Story two-enemy mode: player just died — always end (player lost)
            setTimeout(endGame, 900);
          } else if (storyModeActive && storyTwoEnemies && p.isAI) {
            // Story two-enemy mode: when one bot dies, only end if the player is also dead
            // or no other enemies remain
            const p1Alive = players[0] && players[0].lives > 0;
            const otherEnemyAlive = players.some(q => q !== p && q.isAI && q.lives > 0);
            if (p1Alive && otherEnemyAlive) {
              p.invincible = 9999; // stay dead — fight continues
            } else {
              setTimeout(endGame, 900);
            }
          } else {
            // Record which player ran out of lives first (for draw-avoidance)
            if (_firstDeathPlayer === null) {
              _firstDeathFrame  = frameCount;
              _firstDeathPlayer = p;
            }
            if (gameMode === 'trueform') {
              showBossDialogue('That was always how this ended.', 220);
              setTimeout(endGame, 1400);
            } else {
              setTimeout(endGame, 900);
            }
          }
        }
      }
    }
  }
}

function addKillFeed(loser) {
  const killer = players.find(q => q !== loser);
  if (killer) killer.kills++;
  const feed = document.getElementById('killFeed');
  const msg  = document.createElement('div');
  msg.className   = 'kill-msg';
  msg.textContent = `${killer ? killer.name : '?'} KO'd ${loser.name}!`;
  msg.style.color = killer ? killer.color : '#fff';
  feed.prepend(msg);
  setTimeout(() => msg.remove(), 3200);
}

function endGame() {
  gameRunning = false;
  exploreActive = false;
  if (typeof saveGame === 'function') saveGame();
  document.getElementById('hud').style.display = 'none';
  const isBossModeEnd = gameMode === 'boss' || gameMode === 'trueform';
  const alive  = players.filter(p => p.lives > 0 && !(isBossModeEnd && p.isBoss));
  // Boss death scene removes human players from the array — check health directly to detect victory
  const bossEntity   = players.find(p => p.isBoss);
  const bossDefeated = isBossModeEnd && bossEntity && bossEntity.health <= 0;
  // In two-enemy story mode, multiple bots may still be alive — the winner is the surviving human
  const _aliveHuman = alive.find(p => !p.isAI && !p.isBoss);
  // If nobody is alive and it's not a boss fight, use first-death tracking to pick a winner.
  // A true draw only occurs when both players lost their last life on the exact same frame.
  let _tiebreakWinner = null;
  if (!isBossModeEnd && alive.length === 0 && _firstDeathPlayer !== null) {
    // The player who died FIRST is the loser; their opponent wins.
    const other = players.find(p => p !== _firstDeathPlayer && !p.isBoss);
    if (other) _tiebreakWinner = other;
  }
  // KotH win is determined by zone-time (kothWinnerIdx), not by lives
  const _kothWin = gameMode === 'minigames' && minigameType === 'koth' && typeof kothWinnerIdx !== 'undefined' && kothWinnerIdx >= 0
    ? players[kothWinnerIdx] || null : null;
  const winner = bossDefeated                              ? null   // human win — handled in bossDefeated block
               : _kothWin                                  ? _kothWin
               : (storyTwoEnemies && _aliveHuman)          ? _aliveHuman
               : alive.length === 1                        ? alive[0]
               : (alive.length === 0 && isBossModeEnd)     ? bossEntity
               : _tiebreakWinner                           ? _tiebreakWinner
               : null;

  // --- Achievement checks on match end ---
  // Skip all achievements/progression if any non-boss player used a custom weapon
  const _anyCustomWeapon = players.some(p => !p.isBoss && p.weapon && p.weapon._isCustom);
  // For 2P boss co-op win, treat any survivor as the "winner" for achievements
  // alive may be empty after boss death scene (startBossDeathScene strips human players)
  // so use a sentinel achiever object for boss-defeat achievements if no human ref available
  const _bossDefeatedAchiever = bossDefeated ? (alive[0] || { isBoss: false, health: 1, maxHealth: 1, weaponKey: null, kills: 0 }) : null;
  const achievWinner = _anyCustomWeapon ? null : (winner || _bossDefeatedAchiever);

  // ── Coin rewards ──────────────────────────────────────────────────────────
  if (typeof awardCoins === 'function') {
    const _humanPlayers = players.filter(p => !p.isAI && !p.isBoss);
    if (_humanPlayers.length > 0) {
      // Base: 5 coins per match played; bonus for winning or beating boss
      let _coins = 5;
      if (bossDefeated) _coins += 20;
      else if (winner && !winner.isAI && !winner.isBoss) _coins += 10;
      awardCoins(_coins);
    }
  }

  if (achievWinner && !achievWinner.isBoss && !achievWinner.isAI) {
    _achStats.totalWins++;
    _achStats.winStreak++;
    // First Blood: only when beating a hard AI bot
    const loser = players.find(p => p !== achievWinner && p.isAI && p.aiDiff === 'hard');
    if (loser) unlockAchievement('first_blood');
    if (_achStats.totalWins >= 10) unlockAchievement('perfectionist');
    if (_achStats.winStreak >= 3)  unlockAchievement('hat_trick');
    // Win with ≤10 HP
    if (achievWinner.health <= 10) unlockAchievement('survivor');
    // Untouchable: won without taking damage this match
    if (_achStats.damageTaken === 0) unlockAchievement('untouchable');
    // Speedrun: won in under 30 seconds
    if (Date.now() - _achStats.matchStartTime < 30000) unlockAchievement('speedrun');
    // Ranged damage threshold
    if (_achStats.rangedDmg >= 500) unlockAchievement('gunslinger');
    // Super count
    if (_achStats.superCount >= 10) unlockAchievement('super_saver');
    // Hammer-only win
    if (achievWinner.weaponKey === 'hammer') unlockAchievement('hammer_time');
    // Boss slayer achievements are intentionally unobtainable
    // SOVEREIGN beaten — unlock the SOVEREIGN mode card
    if (gameMode === 'adaptive' && !localStorage.getItem('smc_sovereignBeaten')) {
      localStorage.setItem('smc_sovereignBeaten', '1');
      const _s2Card = document.getElementById('modeSovereign');
      if (_s2Card) _s2Card.style.display = '';
    }
    // KotH win
    if (gameMode === 'minigames' && minigameType === 'koth') unlockAchievement('koth_win');
    // PvP achievements: require both players dealt ≥40 damage (real fight condition)
    const isRealPvP = _achStats.pvpDamageDealt >= 40 && _achStats.pvpDamageReceived >= 40;
    if (isRealPvP) {
      if (_achStats.winStreak >= 3) unlockAchievement('hat_trick');
      if (achievWinner.health <= 10) unlockAchievement('survivor');
    }
  } else if (winner && winner.isBoss) {
    _achStats.winStreak = 0; // loss resets streak
  } else {
    _achStats.winStreak = 0;
  }
  const wt = document.getElementById('winnerText');
  if (bossDefeated) {
    // Human players beat the boss
    if (gameMode === 'boss' && bossPlayerCount === 2) {
      wt.textContent = 'PLAYERS WIN!';
      wt.style.color = '#00ffaa';
    } else {
      const humanWinner = alive[0];
      wt.textContent = (humanWinner ? humanWinner.name : 'PLAYER') + ' WINS!';
      wt.style.color  = humanWinner ? humanWinner.color : '#ffffff';
    }
  } else if (winner) {
    wt.textContent = winner.name + ' WINS!';
    wt.style.color = winner.color;
  } else {
    wt.textContent = 'DRAW!';
    wt.style.color = '#ffffff';
  }
  let statsHtml = players.map(p => `<div class="stat-row" style="color:${p.color}">${p.name}: ${p.kills} KO${p.kills !== 1 ? 's' : ''}</div>`).join('');
  // Boss defeated hint (only if letters not yet unlocked)
  const defeatedBoss = players.find(p => p.isBoss && p.health <= 0);
  if (defeatedBoss && (winner || bossDefeated) && !(winner && winner.isBoss) && !unlockedTrueBoss && bossBeaten) {
    statsHtml += '<div class="stat-row" style="color:#cc00ee;margin-top:10px;font-size:11px;letter-spacing:1px">' +
                 '&#x2756; Something stirs... seek clues in the arenas.</div>';
  }
  document.getElementById('statsDisplay').innerHTML = statsHtml;
  document.getElementById('gameOverOverlay').style.display = 'flex';
  // Show Replay Cinematic button if TF ending has been seen and this was a TF fight
  const _replayRow = document.getElementById('replayCinematicRow');
  if (_replayRow) {
    _replayRow.style.display = (gameMode === 'trueform' && localStorage.getItem('smc_tfEndingSeen') === '1') ? '' : 'none';
  }

  // Story mode: detect win and show level-complete screen
  if (storyModeActive && typeof storyOnMatchEnd === 'function') {
    const isBossModeEnd2 = gameMode === 'boss' || gameMode === 'trueform';
    const playerWon = isBossModeEnd2
      ? bossDefeated
      : !!(winner && !winner.isAI);
    storyOnMatchEnd(playerWon);
  }

  // Multiverse mode: report result so EncounterManager can advance
  if (gameMode === 'multiverse' && typeof multiverseOnMatchEnd === 'function') {
    const playerWon = !!(winner && !winner.isAI);
    multiverseOnMatchEnd(playerWon);
  }
}

// ============================================================
// SECRET LETTER HUNT SYSTEM
// ============================================================
function syncCodeInput() {
  const inp  = document.getElementById('codeInput');
  const hint = document.getElementById('trueFormHint');
  // Hide the homepage hint once True Form is unlocked
  if (hint) hint.style.display = unlockedTrueBoss ? 'none' : '';
  if (!inp) return;
  inp.readOnly = true;
  if (!bossBeaten) {
    inp.value       = '';
    inp.placeholder = 'Beat the boss to unlock';
    return;
  }
  if (unlockedTrueBoss) {
    inp.value       = '✦ TRUE FORM UNLOCKED ✦';
    inp.placeholder = '';
    return;
  }
  const val = SECRET_ARENAS.map((_, i) => collectedLetterIds.has(i) ? SECRET_LETTERS[i] : '_').join('');
  inp.value       = val;
  inp.placeholder = collectedLetterIds.size < 8 ? 'Find letters with supers...' : '';
}

function unlockTrueForm() {
  if (unlockedTrueBoss) return;
  unlockedTrueBoss = true;
  localStorage.setItem('smc_trueform', '1');
  const card = document.getElementById('modeTrueForm');
  if (card) { card.style.display = ''; }
  const msg = document.getElementById('codeMessage');
  if (msg) { msg.textContent = '✦ True Form unlocked!'; msg.style.color = '#cc00ee'; }
  syncCodeInput();
}

function showBossBeatenScreen() {
  const ov = document.getElementById('bossBeatenOverlay');
  if (!ov) { endGame(); return; }
  ov.style.display = 'flex';
  const txt = document.getElementById('bossBeatenText');
  const btn = document.getElementById('bossBeatenContinue');
  if (txt) { txt.style.opacity = '0'; setTimeout(() => { txt.style.opacity = '1'; }, 200); }
  if (btn) { btn.style.display = 'none'; setTimeout(() => { btn.style.display = 'block'; }, 2400); }
  syncCodeInput();
}

function closeBossBeatenScreen() {
  const ov = document.getElementById('bossBeatenOverlay');
  if (ov) ov.style.display = 'none';
  endGame();
}

function drawSecretLetters() {
  if (!bossBeaten || !currentArenaKey || !gameRunning) return;
  const idx = SECRET_ARENAS.indexOf(currentArenaKey);
  if (idx === -1 || collectedLetterIds.has(idx)) return;
  const pos = SECRET_LETTER_POS[currentArenaKey];
  if (!pos) return;
  const pulse = 0.65 + Math.sin(frameCount * 0.07) * 0.35;
  ctx.save();
  ctx.globalAlpha = pulse;
  ctx.font        = 'bold 22px Arial';
  ctx.textAlign   = 'center';
  ctx.fillStyle   = '#cc00ee';
  ctx.shadowColor = '#cc00ee';
  ctx.shadowBlur  = 20;
  ctx.fillText(SECRET_LETTERS[idx], pos.x, pos.y);
  ctx.restore();
}

function checkSecretLetterCollect(p) {
  if (!bossBeaten || !currentArenaKey) return;
  const idx = SECRET_ARENAS.indexOf(currentArenaKey);
  if (idx === -1 || collectedLetterIds.has(idx)) return;
  const pos = SECRET_LETTER_POS[currentArenaKey];
  if (!pos) return;
  if (Math.hypot(p.cx() - pos.x, p.cy() - pos.y) < 100) {
    collectedLetterIds.add(idx);
    localStorage.setItem('smc_letters', JSON.stringify([...collectedLetterIds]));
    spawnParticles(pos.x, pos.y, '#cc00ee', 18);
    syncCodeInput();
    if (collectedLetterIds.size === 8) unlockTrueForm();
  }
}

function replayTFEnding() {
  // Restart TF ending cinematic from the game-over screen (only works if a TF boss is present)
  document.getElementById('gameOverOverlay').style.display = 'none';
  if (typeof startTFEnding === 'function' && players) {
    const boss = players.find(p => p.isTrueForm);
    if (boss) {
      boss._tfEndingPrimed = false;
      boss.invincible      = 0;
      boss.health          = Math.floor(boss.maxHealth * 0.05);
      boss.backstageHiding = false;
      tfEndingScene        = null;
      gameRunning          = true;
      requestAnimationFrame(gameLoop);
    }
  }
}

function backToMenu() {
  MusicManager.stop();
  activeFinisher = null; // cancel any in-progress finisher
  gameRunning  = false;
  paused       = false;
  exploreActive = false;
  trainingMode      = false;
  trainingChaosMode = false;
  trainingPlayerOnly = true;
  tutorialMode = false;
  // After boss fights, reset mode to 1v1 so player config is fully visible again
  if (gameMode === 'trueform' || gameMode === 'boss') gameMode = '2p';
  // Deactivate multiverse state on menu return
  if (typeof MultiverseManager !== 'undefined' && MultiverseManager.isActive()) {
    MultiverseManager.deactivate();
    gameMode = '2p';
  }
  if (typeof _setBossFightLivesLock === 'function') _setBossFightLivesLock(false);
  completeRandomizer = false;
  isRandomMapMode    = false;
  clearChaosModifiers();
  resetTFState();
  canvas.style.display = 'block'; // keep visible as animated menu background
  document.getElementById('hud').style.display            = 'none';
  const chatElBTM = document.getElementById('onlineChat');
  if (chatElBTM) chatElBTM.style.display = 'none';
  document.getElementById('pauseOverlay').style.display    = 'none';
  document.getElementById('gameOverOverlay').style.display = 'none';
  document.getElementById('menu').style.display            = 'grid';
  const trainingHud = document.getElementById('trainingHud');
  if (trainingHud) trainingHud.style.display = 'none';
  const trainingCtrl2 = document.getElementById('trainingControls');
  if (trainingCtrl2) trainingCtrl2.style.display = 'none';
  const mapCr = document.getElementById('mapCreatorPanel');
  if (mapCr) mapCr.style.display = 'none';
  const trainingPanel = document.getElementById('trainingExpandPanel');
  if (trainingPanel) trainingPanel.style.display = 'none';
  // Restore menu UI to match current mode (un-hides P2 rows, arena, etc.)
  selectMode(gameMode);
  resizeGame();
  syncCodeInput();
  if (!menuLoopRunning) {
    menuLoopRunning = true;
    requestAnimationFrame(menuBgLoop);
  }
  // Story mode: re-open story menu on top of the restored menu
  if (storyModeActive && typeof storyOnBackToMenu === 'function') {
    storyOnBackToMenu();
  }
  // Always return to home view when leaving a game
  if (typeof backToHome === 'function') backToHome();
}

function pauseGame() {
  if (!gameRunning) return;
  paused = !paused;
  document.getElementById('pauseOverlay').style.display = paused ? 'flex' : 'none';
}

function resumeGame() {
  paused = false;
  document.getElementById('pauseOverlay').style.display = 'none';
}

// ============================================================
// HUD
// ============================================================
function updateHUD() {
  // Slot 1 = first non-boss player; Slot 2 = boss (1P boss mode) or second human (2P boss mode)
  const nonBoss = players.filter(p => !p.isBoss);
  const boss    = players.find(p => p.isBoss);
  const hudP1   = nonBoss[0];
  // Training 1P: show most recently summoned entity in the p2 slot (or hide if none)
  const _trainingTarget = (trainingMode && !training2P)
    ? (trainingDummies.length ? trainingDummies[trainingDummies.length - 1] : null)
    : null;
  const hudP2   = _trainingTarget !== null
    ? _trainingTarget
    : ((gameMode === 'boss' && bossPlayerCount === 2) ? nonBoss[1] : (boss || nonBoss[1]));
  const hudPlayers = [hudP1, hudP2];

  // Show/hide the p2 HUD panel in training 1P mode
  const hudP2El = document.getElementById('hud-p2');
  if (hudP2El) hudP2El.style.display = (trainingMode && !training2P && !hudP2) ? 'none' : '';

  for (let i = 0; i < 2; i++) {
    const p = hudPlayers[i];
    if (!p) continue;
    const n  = i + 1;
    const pct = Math.max(0, p.health / p.maxHealth * 100);
    const hEl  = document.getElementById(`p${n}Health`);
    const lEl  = document.getElementById(`p${n}Lives`);
    const nEl  = document.getElementById(`p${n}HudName`);
    const sEl  = document.getElementById(`p${n}Super`);
    const cdEl = document.getElementById(`p${n}CdBar`);
    if (hEl) {
      hEl.style.width      = pct + '%';
      hEl.style.background = `hsl(${pct * 1.2},100%,44%)`;
    }
    const htEl = document.getElementById(`p${n}HealthText`);
    if (htEl) htEl.textContent = Math.ceil(p.health) + '/' + p.maxHealth;
    if (lEl) {
      if (p.isBoss) {
        // Boss: show a phase indicator instead of hearts
        const phase = p.getPhase ? p.getPhase() : 1;
        lEl.innerHTML = `<span style="font-size:10px;letter-spacing:1px;color:#cc00ee">PHASE ${phase}</span>`;
      } else if (infiniteMode || p.isDummy || p.lives >= 50 ||
                 (gameMode === 'minigames' && (minigameType === 'survival' || minigameType === 'koth' || minigameType === 'chaos'))) {
        lEl.innerHTML = '∞';
      } else {
        const capped    = Math.min(p.lives, 10);
        const cappedMax = Math.min(p._maxLives !== undefined ? p._maxLives : chosenLives, 10);
        const full  = '\u2665'.repeat(Math.max(0, capped));
        const empty = '<span style="opacity:0.18">\u2665</span>'.repeat(Math.max(0, cappedMax - capped));
        lEl.innerHTML = full + empty;
      }
    }
    if (nEl) nEl.style.color = p.color;
    if (sEl) {
      sEl.style.width = p.superMeter + '%';
      if (p.superReady) sEl.classList.add('ready');
      else              sEl.classList.remove('ready');
    }
    if (cdEl) {
      // Show how much of the Q cooldown has recovered (full = ready)
      const maxCd = p.weapon && p.weapon.abilityCooldown;
      const cdPct = maxCd > 0
        ? Math.max(0, 100 - (p.abilityCooldown / maxCd) * 100)
        : 100;
      cdEl.style.width = cdPct + '%';
    }
    const shEl = document.getElementById(`p${n}ShieldBar`);
    if (shEl) {
      const shPct = p.shieldCooldown > 0
        ? Math.max(0, 100 - (p.shieldCooldown / 180) * 100)
        : 100;
      shEl.style.width = shPct + '%';
      shEl.style.background = p.shieldCooldown > 0
        ? 'linear-gradient(90deg, #4488ff, #88ccff)'
        : 'linear-gradient(90deg, #44ddff, #ffffff)';
    }
    const wEl = document.getElementById(`p${n}WeaponHud`);
    if (wEl) {
      const hasAmmo = p.weapon && p.weapon.clipSize;
      wEl.textContent = p.weapon
        ? (hasAmmo ? `${p.weapon.name}  ${p._ammo}/${p.weapon.clipSize}` : p.weapon.name)
        : '';
    }
  }

  // Boss HP bar (shown in 2P boss mode below HUD center)
  const bossBarEl  = document.getElementById('bossHpBar');
  const bossHpFill = document.getElementById('bossHpFill');
  const bossHpText = document.getElementById('bossHpText');
  if (bossBarEl) {
    if (gameMode === 'boss' && bossPlayerCount === 2 && boss) {
      bossBarEl.style.display = 'flex';
      const bPct = Math.max(0, boss.health / boss.maxHealth * 100);
      if (bossHpFill) bossHpFill.style.width = bPct + '%';
      if (bossHpText) bossHpText.textContent = Math.ceil(boss.health) + ' / ' + boss.maxHealth;
    } else {
      bossBarEl.style.display = 'none';
    }
  }
}

function _entityOverlayLabel(ent) {
  if (ent.name && ent.name.trim()) return ent.name;
  if (ent.isBoss) return 'BOSS';
  if (ent.isDummy) return 'DUMMY';
  if (ent.playerNum) return `P${ent.playerNum}`;
  if (ent.isAI) return 'BOT';
  return 'ENTITY';
}

function drawEntityOverlays(scX, scY, camX, camY) {
  const all = [...players, ...minions, ...trainingDummies].filter(ent => ent && (ent.health > 0 || ent.invincible > 0));
  if (!all.length) return;

  const hudFloor = _hudBottom() + 18;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (const ent of all) {
    if (ent.backstageHiding) continue;
    const sx = canvas.width / 2 + (ent.cx() - camX) * scX;
    const syRaw = canvas.height / 2 + ((ent.y - 22) - camY) * scY;
    const sy = Math.max(hudFloor, syRaw);
    if (sx < -80 || sx > canvas.width + 80 || sy > canvas.height + 80) continue;

    const barW = Math.max(36, Math.min(82, ent.w * scX * 1.35));
    const barH = 7;
    const pct = Math.max(0, Math.min(1, ent.health / Math.max(1, ent.maxHealth)));
    const label = _entityOverlayLabel(ent);
    const labelY = sy - 11;
    const ammoY = sy + 12;

    ctx.font = 'bold 11px Arial';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0,0,0,0.85)';
    ctx.strokeText(label, sx, labelY);
    ctx.fillStyle = ent.color || '#ffffff';
    ctx.fillText(label, sx, labelY);

    ctx.fillStyle = 'rgba(0,0,0,0.72)';
    ctx.fillRect(sx - barW / 2 - 1, sy - barH / 2 - 1, barW + 2, barH + 2);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(sx - barW / 2, sy - barH / 2, barW, barH);
    ctx.fillStyle = pct > 0.6 ? '#44dd66' : pct > 0.3 ? '#ffcc33' : '#ff5533';
    ctx.fillRect(sx - barW / 2, sy - barH / 2, barW * pct, barH);

    if (ent.weapon && ent.weapon.clipSize) {
      ctx.font = 'bold 10px Arial';
      ctx.strokeStyle = 'rgba(0,0,0,0.80)';
      ctx.strokeText(`${ent._ammo}/${ent.weapon.clipSize}`, sx, ammoY);
      ctx.fillStyle = ent._ammo <= 0 ? '#ff6666' : '#ddeeff';
      ctx.fillText(`${ent._ammo}/${ent.weapon.clipSize}`, sx, ammoY);
    }
  }

  ctx.restore();
}

// ============================================================
// MENU BACKGROUND LOOP  (animated arena showcase behind the menu)
// ============================================================
function menuBgLoop() {
  if (!menuLoopRunning) return;

  menuBgTimer++;
  menuBgFrameCount++;

  // Cycle to next arena every ~5 seconds (300 frames)
  if (menuBgTimer >= 300 && menuBgFade === 0) {
    menuBgFade  = 0.01;
    menuBgTimer = 0;
  }
  if (menuBgFade > 0) {
    menuBgFade = Math.min(2, menuBgFade + 0.028);
    if (menuBgFade >= 1 && menuBgFade < 1.03) {
      // Peak darkness: switch to next arena
      menuBgArenaIdx = (menuBgArenaIdx + 1) % ARENA_KEYS_ORDERED.length;
    }
    if (menuBgFade >= 2) menuBgFade = 0;
  }

  // Temporarily borrow arena + frame state for the background draw
  const savedKey   = currentArenaKey;
  const savedArena = currentArena;
  const savedFrame = frameCount;
  currentArenaKey  = ARENA_KEYS_ORDERED[menuBgArenaIdx];
  currentArena     = ARENAS[currentArenaKey];
  frameCount       = menuBgFrameCount;

  const mScX = canvas.width / GAME_W, mScY = canvas.height / GAME_H;
  ctx.setTransform(mScX, 0, 0, mScY, 0, 0);
  drawBackground();

  // Semi-transparent dark overlay so menu text stays readable
  ctx.save();
  ctx.fillStyle = 'rgba(7,7,15,0.55)';
  ctx.fillRect(0, 0, GAME_W, GAME_H);
  ctx.restore();

  // Cross-fade overlay during arena transitions
  if (menuBgFade > 0) {
    const fadeA = menuBgFade <= 1 ? menuBgFade : 2 - menuBgFade;
    ctx.save();
    ctx.globalAlpha = Math.min(1, Math.max(0, fadeA));
    ctx.fillStyle   = '#000';
    ctx.fillRect(0, 0, GAME_W, GAME_H);
    ctx.restore();
  }

  // Restore game state
  currentArenaKey = savedKey;
  currentArena    = savedArena;
  frameCount      = savedFrame;

  // Draw animated character previews in config panels
  _drawPlayerPreview('p1', menuBgFrameCount);
  _drawPlayerPreview('p2', menuBgFrameCount);

  requestAnimationFrame(menuBgLoop);
}

// ============================================================
// PLAYER CONFIG PREVIEW  (animated stickman in side panels)
// ============================================================
const _previewParticles = { p1: [], p2: [] };

const _CLASS_AURA_COLORS = {
  thor:      '#ffe844',
  kratos:    '#ff6622',
  ninja:     '#aa44ff',
  gunner:    '#00eeff',
  archer:    '#44ff88',
  paladin:   '#ffffcc',
  berserker: '#ff2244',
  megaknight:'#cc88ff',
  none:      null,
  random:    null,
};

const _WEAPON_AURA_COLORS = {
  sword:        '#88ccff',
  hammer:       '#ffcc44',
  gun:          '#44ffee',
  axe:          '#ff8844',
  spear:        '#aaffaa',
  bow:          '#88ff88',
  shield:       '#ffffaa',
  scythe:       '#cc44ff',
  fryingpan:    '#ffaa44',
  broomstick:   '#cc88ff',
  boxinggloves: '#ff4444',
  peashooter:   '#44ff44',
  slingshot:    '#ffdd88',
  paperairplane:'#88ddff',
};

function _drawPlayerPreview(pid, frame) {
  const cvs = document.getElementById(pid + 'Preview');
  if (!cvs) return;
  const pc = cvs.getContext('2d');
  if (!pc) return;

  const W = cvs.width, H = cvs.height;
  pc.clearRect(0, 0, W, H);

  // Read config values
  const color     = (document.getElementById(pid + 'Color') || {}).value || '#ffffff';
  const classVal  = (document.getElementById(pid + 'Class') || {}).value  || 'none';
  const weaponVal = (document.getElementById(pid + 'Weapon') || {}).value || 'sword';

  // Determine aura color: class takes priority, then weapon, then player color
  let auraColor = _CLASS_AURA_COLORS[classVal]
                  || _WEAPON_AURA_COLORS[weaponVal]
                  || color;

  const t = frame;

  // --- Particles (small upward floaters) ---
  const parts = _previewParticles[pid];
  if (frame % 8 === 0 && parts.length < 10) {
    parts.push({
      x:  W * 0.5 + (Math.random() - 0.5) * 28,
      y:  H * 0.78,
      vx: (Math.random() - 0.5) * 0.6,
      vy: -(0.4 + Math.random() * 0.5),
      life: 60 + Math.random() * 40,
      maxLife: 100,
      r: 1.5 + Math.random() * 2,
    });
  }
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    p.x  += p.vx;
    p.y  += p.vy;
    p.life--;
    if (p.life <= 0) { parts.splice(i, 1); continue; }
    const alpha = Math.min(1, p.life / 25) * 0.55;
    pc.save();
    pc.globalAlpha  = alpha;
    pc.fillStyle    = auraColor;
    pc.shadowColor  = auraColor;
    pc.shadowBlur   = 6;
    pc.beginPath();
    pc.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    pc.fill();
    pc.restore();
  }

  // --- Aura glow (ellipse under feet) ---
  const auraPulse  = 0.18 + Math.sin(t * 0.07) * 0.08;
  const auraY      = H * 0.78;
  const auraRX     = 26 + Math.sin(t * 0.05) * 3;
  pc.save();
  pc.globalAlpha = auraPulse;
  const auraGrad   = pc.createRadialGradient(W * 0.5, auraY, 2, W * 0.5, auraY, auraRX);
  auraGrad.addColorStop(0, auraColor);
  auraGrad.addColorStop(1, 'transparent');
  pc.fillStyle   = auraGrad;
  pc.shadowColor = auraColor;
  pc.shadowBlur  = 18;
  pc.beginPath();
  pc.ellipse(W * 0.5, auraY, auraRX, 9, 0, 0, Math.PI * 2);
  pc.fill();
  pc.restore();

  // --- Stickman idle animation ---
  const bob    = Math.sin(t * 0.055) * 3;   // vertical bob
  const sway   = Math.sin(t * 0.038) * 1.2; // slight sway (rotation degrees)
  const cx     = W * 0.5;
  const baseY  = H * 0.72 + bob;

  pc.save();
  // Apply gentle sway around feet
  pc.translate(cx, baseY + 28);
  pc.rotate(sway * Math.PI / 180);
  pc.translate(-cx, -(baseY + 28));

  pc.strokeStyle = color;
  pc.fillStyle   = color;
  pc.lineWidth   = 3.5;
  pc.lineCap     = 'round';
  pc.lineJoin    = 'round';
  pc.shadowColor = auraColor;
  pc.shadowBlur  = 8;

  const headR    = 10;
  const headCY   = baseY - 48;
  const neckY    = headCY + headR + 1;
  const shouldY  = neckY + 4;
  const hipY     = shouldY + 26;
  const armLen   = 20;
  const legLen   = 23;

  // Idle arm sway
  const armSw = Math.sin(t * 0.045) * 0.04;
  const rAng  = Math.PI * 0.58 + armSw;
  const lAng  = Math.PI * 0.42 - armSw;
  const rEx   = cx + Math.cos(rAng) * armLen;
  const rEy   = shouldY + Math.sin(rAng) * armLen;
  const lEx   = cx + Math.cos(lAng) * armLen;
  const lEy   = shouldY + Math.sin(lAng) * armLen;

  // Head
  pc.beginPath();
  pc.arc(cx, headCY, headR, 0, Math.PI * 2);
  pc.fill();

  // Eyes
  pc.fillStyle = '#fff';
  pc.beginPath();
  pc.arc(cx + 4, headCY - 2, 2.8, 0, Math.PI * 2);
  pc.fill();
  pc.fillStyle = '#111';
  pc.beginPath();
  pc.arc(cx + 5, headCY - 2, 1.5, 0, Math.PI * 2);
  pc.fill();

  // Smile
  pc.strokeStyle = 'rgba(0,0,0,0.5)';
  pc.lineWidth   = 1.4;
  pc.beginPath();
  pc.arc(cx + 4, headCY + 3, 3, 0, Math.PI, true);
  pc.stroke();

  // Reset stroke for body/limbs
  pc.strokeStyle = color;
  pc.lineWidth   = 3.5;

  // Body
  pc.beginPath();
  pc.moveTo(cx, neckY);
  pc.lineTo(cx, hipY);
  pc.stroke();

  // Arms (2-segment with elbows)
  const _lj = (ax, ay, bx, by, ox, oy) => [(ax+bx)*0.5 + ox, (ay+by)*0.5 + oy];
  const [rElbX, rElbY] = _lj(cx, shouldY, rEx, rEy, 4, -2);
  const [lElbX, lElbY] = _lj(cx, shouldY, lEx, lEy, 4, -2);
  pc.beginPath(); pc.moveTo(cx, shouldY); pc.lineTo(rElbX, rElbY); pc.lineTo(rEx, rEy); pc.stroke();
  pc.beginPath(); pc.moveTo(cx, shouldY); pc.lineTo(lElbX, lElbY); pc.lineTo(lEx, lEy); pc.stroke();

  // Legs
  const rFootX = cx + Math.cos(Math.PI * 0.62) * legLen;
  const rFootY = hipY + Math.sin(Math.PI * 0.62) * legLen;
  const lFootX = cx + Math.cos(Math.PI * 0.38) * legLen;
  const lFootY = hipY + Math.sin(Math.PI * 0.38) * legLen;
  const [rKnX, rKnY] = _lj(cx, hipY, rFootX, rFootY, 4, 0);
  const [lKnX, lKnY] = _lj(cx, hipY, lFootX, lFootY, 4, 0);
  pc.beginPath(); pc.moveTo(cx, hipY); pc.lineTo(rKnX, rKnY); pc.lineTo(rFootX, rFootY); pc.stroke();
  pc.beginPath(); pc.moveTo(cx, hipY); pc.lineTo(lKnX, lKnY); pc.lineTo(lFootX, lFootY); pc.stroke();

  pc.restore();
}

// ============================================================
// BOSS DIALOGUE  (speech bubble above boss)
// ============================================================
function showBossDialogue(text, dur = 220) {
  bossDialogue.text  = text;
  bossDialogue.timer = dur;
}

function drawBossDialogue(scX, scY, camX, camY) {
  if (bossDialogue.timer <= 0) return;
  const boss = players.find(p => p.isBoss);
  if (!boss || boss.health <= 0) return;
  bossDialogue.timer--;

  const alpha = Math.min(1, bossDialogue.timer < 45 ? bossDialogue.timer / 45 : 1);
  const text  = bossDialogue.text;
  const hasCamera = typeof scX === 'number' && typeof scY === 'number' && typeof camX === 'number' && typeof camY === 'number';
  const bx = hasCamera ? (canvas.width / 2 + (boss.cx() - camX) * scX) : boss.cx();
  const byWorld = boss.y - 18;
  const by = hasCamera ? (canvas.height / 2 + (byWorld - camY) * scY) : byWorld;

  const _zoom  = (typeof camZoomCur === 'number' && camZoomCur > 0) ? camZoomCur : 1;
  const _scale = Math.min(2.0, Math.max(0.7, 1 / _zoom));
  const _fs    = Math.round(16 * _scale);
  const padX   = Math.round(16 * _scale);
  const padY   = Math.round(12 * _scale);
  const maxTextW = Math.min(canvas.width * 0.70, 520 * _scale);

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font        = `bold ${_fs}px Arial`;
  ctx.textAlign   = 'center';
  ctx.textBaseline = 'middle';
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const lines = [];
  let curLine = '';
  for (const word of words) {
    const next = curLine ? `${curLine} ${word}` : word;
    if (ctx.measureText(next).width <= maxTextW || !curLine) curLine = next;
    else {
      lines.push(curLine);
      curLine = word;
    }
  }
  if (curLine) lines.push(curLine);
  if (!lines.length) lines.push('');
  const textW = lines.reduce((m, line) => Math.max(m, ctx.measureText(line).width), 0);
  const lineH = Math.round(_fs * 1.15);
  const bw  = textW + padX * 2;
  const bh  = lines.length * lineH + padY * 2;
  const rx  = clamp(bx - bw / 2, 14, canvas.width - bw - 14);
  const bubbleCx = rx + bw / 2;
  const ry  = Math.max(_hudBottom() + 12, by - bh - Math.round(6 * _scale));

  ctx.fillStyle   = 'rgba(18,0,32,0.90)';
  ctx.strokeStyle = '#d65bff';
  ctx.lineWidth   = 2.2;
  ctx.shadowColor = 'rgba(160,20,240,0.42)';
  ctx.shadowBlur  = 14;
  ctx.beginPath();
  ctx.roundRect(rx, ry, bw, bh, Math.round(10 * _scale));
  ctx.fill();
  ctx.stroke();

  const _tp = Math.round(10 * _scale);
  const tailCx = clamp(bx, rx + 18, rx + bw - 18);
  const tailTop = ry + bh - 1;
  ctx.beginPath();
  ctx.moveTo(tailCx - _tp, tailTop);
  ctx.lineTo(tailCx,       Math.max(tailTop + _tp * 1.55, by + _tp * 0.65));
  ctx.lineTo(tailCx + _tp, tailTop);
  ctx.closePath();
  ctx.fillStyle = 'rgba(18,0,32,0.90)';
  ctx.fill();
  ctx.strokeStyle = '#d65bff';
  ctx.lineWidth = 2.2;
  ctx.stroke();

  ctx.fillStyle   = '#f8d7ff';
  ctx.shadowColor = '#aa00ee';
  ctx.shadowBlur  = 10;
  for (let i = 0; i < lines.length; i++) {
    const ty = ry + padY + lineH * (i + 0.5);
    ctx.fillText(lines[i], bubbleCx, ty);
  }
  ctx.restore();
}

// ── Eternal Damnation visual effects ─────────────────────────────────────────

function drawDamnationEffects() {
  if (!damnationActive) return;
  ctx.save();

  // Heartbeat fog overlay — pulses red at the edges
  const pulse = 0.08 + 0.06 * Math.sin(damnationPulse * Math.PI / 60);
  const grad = ctx.createRadialGradient(GAME_W / 2, GAME_H / 2, GAME_H * 0.3, GAME_W / 2, GAME_H / 2, GAME_H * 0.9);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, `rgba(180,0,0,${pulse.toFixed(3)})`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, GAME_W, GAME_H);

  // Corner vignette
  const corners = [
    [0, 0], [GAME_W, 0], [0, GAME_H], [GAME_W, GAME_H]
  ];
  for (const [cx, cy] of corners) {
    const cg = ctx.createRadialGradient(cx, cy, 0, cx, cy, GAME_H * 0.5);
    cg.addColorStop(0, 'rgba(100,0,0,0.18)');
    cg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = cg;
    ctx.fillRect(0, 0, GAME_W, GAME_H);
  }

  // Ghost platforms (show disabled platforms as faint outlines)
  if (currentArena && currentArena.isDamnationArena) {
    ctx.strokeStyle = 'rgba(255,34,0,0.18)';
    ctx.lineWidth   = 1;
    ctx.setLineDash([4, 4]);
    for (const pl of currentArena.platforms) {
      if (pl.isFloor) continue;
      if (pl.isFloorDisabled) {
        ctx.strokeRect(pl.x, pl.y, pl.w, pl.h);
      }
    }
    ctx.setLineDash([]);
  }

  // Deaths counter
  const scarText = `FALLS: ${damnationDeaths}/4`;
  ctx.font      = 'bold 13px monospace';
  ctx.textAlign = 'right';
  ctx.fillStyle = damnationDeaths >= 3 ? '#ff4444' : '#ff8844';
  ctx.fillText(scarText, GAME_W - 12, 22);

  // Anchors counter
  const anchText = `ANCHORS: ${damnationAnchors}/8`;
  ctx.textAlign  = 'right';
  ctx.fillStyle  = '#ffaa44';
  ctx.fillText(anchText, GAME_W - 12, 38);

  // Portal
  if (damnationPortalActive && damnationPortal) {
    const pf    = damnationPortal.frame;
    const alpha = Math.min(1, pf / 30);
    const r     = 24 + 6 * Math.sin(pf * 0.08);
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = '#88ffcc';
    ctx.lineWidth   = 3;
    ctx.shadowColor = '#88ffcc';
    ctx.shadowBlur  = 18;
    ctx.beginPath();
    ctx.arc(damnationPortal.x, damnationPortal.y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.font = 'bold 11px monospace';
    ctx.fillStyle = '#88ffcc';
    ctx.textAlign = 'center';
    ctx.fillText('EXIT', damnationPortal.x, damnationPortal.y - r - 6);
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }

  ctx.restore();
}

function drawDamnationAnchors() {
  if (!damnationActive || !damnationAnchorOrbs.length) return;
  ctx.save();
  for (const orb of damnationAnchorOrbs) {
    const alpha = Math.min(1, orb.frame / 20);
    const r     = 8 + 3 * Math.sin(orb.frame * 0.1);
    ctx.globalAlpha = alpha;
    ctx.fillStyle   = '#ff8800';
    ctx.shadowColor = '#ff4400';
    ctx.shadowBlur  = 12;
    ctx.beginPath();
    ctx.arc(orb.x, orb.y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.shadowBlur  = 0;
  ctx.globalAlpha = 1;
  ctx.restore();
}
