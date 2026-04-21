'use strict';

// ============================================================
// BACKGROUND GENERATION (pre-computed to avoid flicker)
// ============================================================
function generateBgElements() {
  bgStars = Array.from({ length: 110 }, () => ({
    x:       Math.random() * 900,
    y:       Math.random() * 420,
    r:       0.4 + Math.random() * 1.8,
    phase:   Math.random() * Math.PI * 2,
    speed:   0.02 + Math.random() * 0.04
  }));

  bgBuildings = [];
  let bx = 0;
  while (bx < 940) {
    const bw = 55 + Math.random() * 85;
    const bh = 110 + Math.random() * 260;
    const wins = [];
    for (let wy = GAME_H - bh + 14; wy < GAME_H - 18; wy += 17) {
      for (let wx = bx + 8; wx < bx + bw - 8; wx += 14) {
        wins.push({ x: wx, y: wy, on: Math.random() > 0.28 });
      }
    }
    bgBuildings.push({ x: bx, w: bw, h: bh, wins });
    bx += bw + 4;
  }
}

// ============================================================
// DRAWING
// ============================================================
function drawBackground() {
  const a = currentArena;
  // Fill the entire world width (+ generous overdraw) so no void shows through on wide/panning maps
  // The extra 3000px on each axis covers extreme zoom-out where the visible world exceeds GAME_H
  const _bgX = a.mapLeft  !== undefined ? a.mapLeft  - 3000 : -3000;
  const _bgW = a.worldWidth ? a.worldWidth + 6000 : GAME_W + 6000;
  const _bgH = GAME_H + 3000; // extend well below floor to cover zoom-out void
  // Solid base fill first (gradient fallback for bottom overflow area)
  ctx.fillStyle = a.sky[a.sky.length - 1];
  ctx.fillRect(_bgX, 0, _bgW, _bgH);
  // Gradient layer over the visible game area
  const g = ctx.createLinearGradient(0, 0, 0, GAME_H);
  g.addColorStop(0, a.sky[0]);
  g.addColorStop(1, a.sky[a.sky.length - 1]);
  ctx.fillStyle = g;
  ctx.fillRect(_bgX, 0, _bgW, GAME_H);
  // Ground color fill below floor level — prevents raw canvas showing through on zoomed-out large maps
  if (a.groundColor) {
    const floorPl = a.platforms && a.platforms.find(pl => pl.isFloor);
    const groundTop = floorPl ? floorPl.y : GAME_H - 60;
    ctx.fillStyle = a.groundColor;
    ctx.fillRect(_bgX, groundTop, _bgW, _bgH - groundTop);
  }

  if (currentArenaKey === 'space')      drawStars();
  if (currentArenaKey === 'grass')      drawClouds();
  if (currentArenaKey === 'lava')       drawLava();
  if (currentArenaKey === 'city')       drawCityBuildings();
  if (currentArenaKey === 'creator')    drawCreatorArena();
  if (currentArenaKey === 'forest')     drawForest();
  if (currentArenaKey === 'ice')        drawIce();
  if (currentArenaKey === 'ruins')      drawRuins();
  if (currentArenaKey === 'void')       drawVoidArena();
  if (currentArenaKey === 'soccer')     drawSoccerArena();
  if (currentArenaKey === 'cave')       drawCaveArena();
  if (currentArenaKey === 'mirror')     drawMirrorArena();
  if (currentArenaKey === 'underwater') drawUnderwaterArena();
  if (currentArenaKey === 'volcano')    drawVolcanoArena();
  if (currentArenaKey === 'colosseum')  drawColosseumArena();
  if (currentArenaKey === 'cyberpunk')  drawCyberpunkArena();
  if (currentArenaKey === 'haunted')    drawHauntedArena();
  if (currentArenaKey === 'clouds')     drawCloudsArena();
  if (currentArenaKey === 'neonGrid')   drawNeonGridArena();
  if (currentArenaKey === 'mushroom')   drawMushroomArena();
  if (currentArenaKey === 'megacity')   drawMegacityArena();
  if (currentArenaKey === 'warpzone')   drawWarpzoneArena();
  if (currentArenaKey === 'colosseum10') drawColosseum10Arena();
  if (currentArenaKey === 'homeYard')    drawHomeYardArena();
  if (currentArenaKey === 'homeAlley')   drawHomeAlleyArena();
  if (currentArenaKey === 'suburb')      drawSuburbArena();
  if (currentArenaKey === 'rural')       drawRuralArena();
  if (currentArenaKey === 'portalEdge')  drawPortalEdgeArena();
  if (currentArenaKey === 'realmEntry')  drawRealmEntryArena();
  if (currentArenaKey === 'bossSanctum') drawBossSanctumArena();

  // Exploration: tile the style-appropriate background across world width
  if (currentArena && currentArena.isExploreArena) {
    _drawExploreBgTiles(currentArena.exploreStyle);
  }

  // Boundary portals: visible warp rifts at map edges for large story maps
  if (currentArena && currentArena.boundaryPortals) {
    _drawBoundaryPortals(currentArena);
  }
}

function _drawBoundaryPortals(arena) {
  const t = (frameCount || 0) * 0.04;
  const portalH = 420;
  const portalW = 30;
  const groundY = 480; // top of floor

  // Portal color adapts to arena theme
  const skyBase = arena.sky ? arena.sky[0] : '#000';
  // Use complementary glow: dark arenas get cyan/purple, bright arenas get deep blue/magenta
  const isDark = parseInt(skyBase.replace('#',''), 16) < 0x404040;
  const innerCol  = isDark ? 'rgba(80,220,255,0.9)'  : 'rgba(160,0,255,0.9)';
  const outerCol  = isDark ? 'rgba(0,150,220,0.0)'   : 'rgba(100,0,180,0.0)';
  const coreCol   = isDark ? 'rgba(180,240,255,1)'   : 'rgba(230,180,255,1)';
  const runeCol   = isDark ? 'rgba(100,200,255,0.7)' : 'rgba(200,100,255,0.7)';

  const edges = [
    { x: arena.mapLeft + 10 },
    { x: arena.mapRight - 10 },
  ];

  for (const edge of edges) {
    const cx = edge.x;
    const topY = groundY - portalH;

    ctx.save();

    // Outer glow halo
    const halo = ctx.createRadialGradient(cx, topY + portalH * 0.5, 0, cx, topY + portalH * 0.5, portalW * 2.5);
    halo.addColorStop(0, innerCol.replace('0.9)', '0.25)'));
    halo.addColorStop(1, outerCol);
    ctx.fillStyle = halo;
    ctx.fillRect(cx - portalW * 2.5, topY, portalW * 5, portalH);

    // Portal column glow
    const grad = ctx.createLinearGradient(cx - portalW, 0, cx + portalW, 0);
    grad.addColorStop(0,   outerCol);
    grad.addColorStop(0.3, innerCol);
    grad.addColorStop(0.5, coreCol);
    grad.addColorStop(0.7, innerCol);
    grad.addColorStop(1,   outerCol);
    ctx.fillStyle = grad;
    ctx.fillRect(cx - portalW, topY, portalW * 2, portalH);

    // Animated scan lines / energy ripples
    ctx.save();
    ctx.rect(cx - portalW, topY, portalW * 2, portalH);
    ctx.clip();
    for (let i = 0; i < 6; i++) {
      const ry = topY + ((t * 80 + i * (portalH / 6)) % portalH);
      const rg = ctx.createLinearGradient(0, ry - 10, 0, ry + 10);
      rg.addColorStop(0, 'rgba(255,255,255,0)');
      rg.addColorStop(0.5, 'rgba(255,255,255,0.25)');
      rg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = rg;
      ctx.fillRect(cx - portalW, ry - 10, portalW * 2, 20);
    }
    ctx.restore();

    // Rune symbols — 3 static glyphs on the column
    ctx.fillStyle = runeCol;
    ctx.font = `bold ${Math.round(portalW * 0.9)}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const glyphs = ['⌬', '◈', '⌬'];
    for (let g = 0; g < glyphs.length; g++) {
      const gy = topY + portalH * (0.25 + g * 0.25);
      const pulse = 0.6 + 0.4 * Math.sin(t * 2 + g * 1.2);
      ctx.globalAlpha = pulse;
      ctx.fillText(glyphs[g], cx, gy);
    }
    ctx.globalAlpha = 1;

    // "BOUNDARY" label above portal
    ctx.font = `bold 9px monospace`;
    ctx.fillStyle = coreCol;
    ctx.globalAlpha = 0.6 + 0.4 * Math.sin(t * 1.5);
    ctx.fillText('RIFT', cx, topY - 12);
    ctx.globalAlpha = 1;

    // Top cap glow
    const capGrad = ctx.createRadialGradient(cx, topY, 0, cx, topY, portalW * 1.8);
    capGrad.addColorStop(0, coreCol);
    capGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = capGrad;
    ctx.beginPath();
    ctx.ellipse(cx, topY, portalW * 1.8, portalW * 0.9, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}

function _drawExploreBgTiles(style) {
  // Draw repeating background details across the full worldWidth
  // The camera transform already positions everything correctly;
  // we just draw from x=0 to x=exploreWorldLen in world-space tiles.
  const tileW = GAME_W;
  const numTiles = Math.ceil(exploreWorldLen / tileW) + 1;
  for (let i = 0; i < numTiles; i++) {
    const tx = i * tileW;
    ctx.save();
    ctx.translate(tx, 0);
    if (style === 'city')        _expTileCity(i);
    else if (style === 'forest') _expTileForest(i);
    else if (style === 'ruins')  _expTileRuins(i);
    else                         _expTileCity(i); // fallback
    ctx.restore();
  }
  // Subtle ground line across full world
  ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, 440); ctx.lineTo(exploreWorldLen, 440); ctx.stroke();
}

function _expTileCity(i) {
  const seed = i * 7 + 3;
  // Background buildings (silhouettes)
  for (let b = 0; b < 5; b++) {
    const bx = (seed * 37 + b * 183) % GAME_W;
    const bh = 120 + (seed * 13 + b * 71) % 200;
    const bw = 50 + (seed * 11 + b * 43) % 80;
    ctx.fillStyle = 'rgba(20,20,35,0.9)';
    ctx.fillRect(bx, 440 - bh, bw, bh);
    // Windows
    ctx.fillStyle = 'rgba(180,200,255,0.18)';
    for (let wy = 440 - bh + 12; wy < 430; wy += 16) {
      for (let wx2 = bx + 6; wx2 < bx + bw - 6; wx2 += 12) {
        if ((wy * 3 + wx2 + seed) % 3 !== 0) ctx.fillRect(wx2, wy, 5, 7);
      }
    }
  }
  // Street lamp
  const lx = (seed * 59) % GAME_W;
  ctx.fillStyle = '#555560';
  ctx.fillRect(lx, 390, 4, 52);
  ctx.fillStyle = 'rgba(255,230,100,0.7)';
  ctx.beginPath(); ctx.arc(lx + 2, 392, 8, 0, Math.PI * 2); ctx.fill();
}

function _expTileForest(i) {
  const seed = i * 11 + 5;
  // Background trees
  for (let t = 0; t < 6; t++) {
    const tx2 = (seed * 41 + t * 151) % GAME_W;
    const th  = 80 + (seed * 17 + t * 61) % 140;
    const alpha = 0.3 + (t % 3) * 0.2;
    ctx.fillStyle = `rgba(10,40,10,${alpha})`;
    // Trunk
    ctx.fillRect(tx2, 440 - th, 8, th);
    // Canopy
    ctx.beginPath();
    ctx.arc(tx2 + 4, 440 - th, 22 + (seed * 7 + t * 31) % 20, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(15,55,12,${alpha + 0.15})`;
    ctx.fill();
  }
  // Floating ash particles (static per tile)
  ctx.fillStyle = 'rgba(200,200,180,0.25)';
  for (let a = 0; a < 8; a++) {
    const ax = (seed * 53 + a * 97) % GAME_W;
    const ay = 60 + (seed * 19 + a * 113) % 320;
    ctx.beginPath(); ctx.arc(ax, ay, 1.5, 0, Math.PI * 2); ctx.fill();
  }
}

function _expTileRuins(i) {
  const seed = i * 13 + 7;
  // Broken pillars
  for (let p = 0; p < 4; p++) {
    const px2 = (seed * 43 + p * 197) % GAME_W;
    const ph  = 60 + (seed * 23 + p * 79) % 160;
    ctx.fillStyle = 'rgba(60,50,35,0.85)';
    ctx.fillRect(px2, 440 - ph, 22, ph);
    // Cracked top
    ctx.fillStyle = 'rgba(80,70,50,0.7)';
    ctx.fillRect(px2 - 4, 440 - ph - 8, 30, 10);
  }
  // Rubble dots
  ctx.fillStyle = 'rgba(100,85,60,0.5)';
  for (let r = 0; r < 5; r++) {
    const rx = (seed * 67 + r * 113) % GAME_W;
    ctx.fillRect(rx, 435, 6 + r * 2, 5);
  }
}


// ============================================================
// BOSS BEAMS
// ============================================================
function drawBossBeams() {
  for (const b of bossBeams) {
    ctx.save();
    if (b.phase === 'warning') {
      const progress = 1 - b.warningTimer / 300;
      const flicker  = Math.sin(frameCount * 0.35 + b.x * 0.05) * 0.1;
      ctx.globalAlpha = clamp(0.15 + progress * 0.40 + flicker, 0.05, 0.65);
      ctx.strokeStyle = '#dd77ff';
      ctx.lineWidth   = 5 + progress * 7;
      ctx.shadowColor = '#9900ee';
      ctx.shadowBlur  = 20;
      ctx.setLineDash([22, 14]);
      ctx.beginPath();
      ctx.moveTo(b.x, 462);
      ctx.lineTo(b.x, 0);
      ctx.stroke();
      ctx.setLineDash([]);
      // Pulsing ground indicator
      const pulse = 8 + progress * 14 + Math.sin(frameCount * 0.4) * 4;
      ctx.globalAlpha = 0.75;
      ctx.fillStyle   = '#ff44ff';
      ctx.shadowBlur  = 24;
      ctx.beginPath();
      ctx.arc(b.x, 462, pulse, 0, Math.PI * 2);
      ctx.fill();
      // Countdown text
      const secs = Math.ceil(b.warningTimer / 60);
      ctx.globalAlpha = 0.9;
      ctx.font        = 'bold 11px Arial';
      ctx.fillStyle   = '#ffffff';
      ctx.textAlign   = 'center';
      ctx.shadowBlur  = 6;
      ctx.fillText(secs + 's', b.x, 448);
    } else if (b.phase === 'active') {
      ctx.globalAlpha = 0.9;
      // Outer glow
      ctx.strokeStyle = '#ff00ff';
      ctx.lineWidth   = 24;
      ctx.shadowColor = '#cc00ff';
      ctx.shadowBlur  = 55;
      ctx.beginPath();
      ctx.moveTo(b.x, GAME_H);
      ctx.lineTo(b.x, 0);
      ctx.stroke();
      // Core beam
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth   = 8;
      ctx.shadowBlur  = 20;
      ctx.beginPath();
      ctx.moveTo(b.x, GAME_H);
      ctx.lineTo(b.x, 0);
      ctx.stroke();
    }
    ctx.restore();
  }
}

// ============================================================
// CINEMATIC OVERLAY — letterbox bars + vignette (drawn in screen space)
// ============================================================
function drawCinematicOverlay() {
  if (!activeCinematic) return;
  const cw = canvas.width, ch = canvas.height;
  const t  = activeCinematic.timer / 60;
  const totalSec  = activeCinematic.durationFrames / 60;
  const inAlpha   = Math.min(1, t / 0.3);
  const outAlpha  = Math.min(1, (totalSec - t) / 0.3);
  const barAlpha  = Math.min(inAlpha, outAlpha);

  // Letterbox bars
  const barH = Math.round(ch * 0.082);
  ctx.globalAlpha = barAlpha;
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0,         cw, barH);
  ctx.fillRect(0, ch - barH, cw, barH);

  // Edge vignette
  ctx.globalAlpha = barAlpha * 0.38;
  const vg = ctx.createLinearGradient(0, 0, cw, 0);
  vg.addColorStop(0,    'rgba(0,0,0,0.85)');
  vg.addColorStop(0.13, 'rgba(0,0,0,0)');
  vg.addColorStop(0.87, 'rgba(0,0,0,0)');
  vg.addColorStop(1,    'rgba(0,0,0,0.85)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, barH, cw, ch - barH * 2);

  // Phase label (if set by the cinematic sequence)
  const labelAlpha = Math.max(0,
    Math.min(1, (t - 0.9) / 0.25) * Math.min(1, (totalSec - t - 0.25) / 0.25));
  if (labelAlpha > 0 && activeCinematic._phaseLabel) {
    ctx.globalAlpha = labelAlpha;
    ctx.font        = `bold ${Math.round(ch * 0.042)}px Arial`;
    ctx.textAlign   = 'center';
    ctx.fillStyle   = activeCinematic._phaseLabel.color || '#ffffff';
    ctx.shadowColor = activeCinematic._phaseLabel.color || '#cc00ee';
    ctx.shadowBlur  = 30;
    ctx.fillText(activeCinematic._phaseLabel.text, cw / 2, ch / 2);
    ctx.shadowBlur  = 0;
  }
  // Screen flash (from CinFX.flash)
  if (cinScreenFlash && cinScreenFlash.timer > 0) {
    const fa = (cinScreenFlash.timer / cinScreenFlash.maxTimer) * cinScreenFlash.alpha;
    ctx.globalAlpha = Math.max(0, fa);
    ctx.fillStyle   = cinScreenFlash.color || '#ffffff';
    ctx.fillRect(0, 0, cw, ch);
    cinScreenFlash.timer--;
    if (cinScreenFlash.timer <= 0) cinScreenFlash = null;
  }

  ctx.globalAlpha = 1;
}

// ============================================================
// PHASE TRANSITION RINGS
// ============================================================
function drawPhaseTransitionRings() {
  for (let i = phaseTransitionRings.length - 1; i >= 0; i--) {
    const ring = phaseTransitionRings[i];
    ring.timer--;
    if (ring.timer <= 0) { phaseTransitionRings.splice(i, 1); continue; }
    const prog  = 1 - ring.timer / ring.maxTimer;
    const curR  = ring.r + prog * (ring.maxR - ring.r);
    const alpha = ring.timer < 20 ? ring.timer / 20 : 1 - prog * 0.55;
    ctx.save();
    ctx.globalAlpha = Math.max(0, alpha);
    ctx.strokeStyle = ring.color;
    ctx.lineWidth   = Math.max(0.5, (ring.lineWidth || 3) * (1 - prog * 0.7));
    ctx.shadowColor = ring.color;
    ctx.shadowBlur  = 16;
    ctx.beginPath();
    ctx.arc(ring.cx, ring.cy, Math.max(0.1, curR), 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

// ============================================================
// BOSS SPIKES
// ============================================================
function drawBossSpikes() {
  for (const sp of bossSpikes) {
    if (sp.done || sp.h <= 0) continue;
    const baseY = 460;
    const tipY  = baseY - sp.h;
    ctx.save();
    ctx.shadowColor = '#cc00ff';
    ctx.shadowBlur  = 12;
    // Spike body (tapered rectangle, 10px base → 2px tip)
    ctx.beginPath();
    ctx.moveTo(sp.x - 3,   baseY);
    ctx.lineTo(sp.x + 3,   baseY);
    ctx.lineTo(sp.x + 0.5, tipY);
    ctx.lineTo(sp.x - 0.5, tipY);
    ctx.closePath();
    ctx.fillStyle = '#aaaacc';
    ctx.fill();
    ctx.strokeStyle = '#cc00ff';
    ctx.lineWidth   = 1.5;
    ctx.stroke();
    ctx.restore();
  }
}

// ============================================================
// SPARTAN RAGE VISUALS  (Kratos class perk active)
// ============================================================
function drawAccessory(fighter, cx, headCY, shoulderY, hipY, facing, headR) {
  const hat  = fighter.hat  || 'none';
  const cape = fighter.cape || 'none';
  if (hat === 'none' && cape === 'none') return;
  ctx.save();

  // --- CAPE (draw behind body) ---
  if (cape !== 'none') {
    const capeX = cx - facing * 4;
    ctx.lineWidth = 1;
    if (cape === 'short') {
      ctx.fillStyle = 'rgba(180,20,20,0.8)';
      ctx.beginPath();
      ctx.moveTo(cx - 5, shoulderY);
      ctx.lineTo(cx + 5, shoulderY);
      ctx.lineTo(cx - facing * 14, hipY - 6);
      ctx.closePath(); ctx.fill();
    } else if (cape === 'long') {
      const capeGrad = ctx.createLinearGradient(capeX, shoulderY, capeX, hipY + 18);
      capeGrad.addColorStop(0, 'rgba(120,10,10,0.85)');
      capeGrad.addColorStop(1, 'rgba(80,5,5,0)');
      ctx.fillStyle = capeGrad;
      ctx.beginPath();
      ctx.moveTo(cx - 7, shoulderY);
      ctx.lineTo(cx + 7, shoulderY);
      ctx.lineTo(cx - facing * 18, hipY + 18);
      ctx.closePath(); ctx.fill();
    } else if (cape === 'royal') {
      ctx.fillStyle = 'rgba(160,10,10,0.9)';
      ctx.beginPath();
      ctx.moveTo(cx - 7, shoulderY);
      ctx.lineTo(cx + 7, shoulderY);
      ctx.lineTo(cx - facing * 18, hipY + 14);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#ffcc00'; ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx - 6, shoulderY + 2);
      ctx.lineTo(cx - facing * 16, hipY + 10);
      ctx.stroke();
    }
  }

  // --- HAT (draw above head) ---
  if (hat !== 'none') {
    ctx.fillStyle   = '#333';
    ctx.strokeStyle = '#222';
    ctx.lineWidth   = 1;
    const hatTop = headCY - headR;
    if (hat === 'cap') {
      ctx.fillStyle = '#444';
      ctx.beginPath();
      ctx.ellipse(cx, hatTop, headR + 1, 5, 0, Math.PI, 0);
      ctx.fill();
      ctx.fillRect(cx - headR - 1, hatTop - 7, headR * 2 + 2, 8);
      ctx.fillStyle = '#555';
      ctx.fillRect(cx + facing * headR, hatTop - 2, facing * 6, 4);
    } else if (hat === 'crown') {
      ctx.fillStyle = '#ffcc00';
      const bY = hatTop - 2;
      ctx.fillRect(cx - headR + 2, bY - 8, headR * 2 - 4, 8);
      ctx.beginPath();
      ctx.moveTo(cx - headR + 2, bY - 8);
      ctx.lineTo(cx - headR + 2 + 4, bY - 13);
      ctx.lineTo(cx, bY - 10);
      ctx.lineTo(cx + headR - 6, bY - 13);
      ctx.lineTo(cx + headR - 2, bY - 8);
      ctx.closePath(); ctx.fill();
    } else if (hat === 'wizard') {
      ctx.fillStyle = '#660099';
      ctx.beginPath();
      ctx.moveTo(cx - headR + 1, hatTop + 1);
      ctx.lineTo(cx + headR - 1, hatTop + 1);
      ctx.lineTo(cx + facing * 2, hatTop - 22);
      ctx.closePath(); ctx.fill();
      ctx.fillRect(cx - headR - 3, hatTop - 2, headR * 2 + 6, 5);
    } else if (hat === 'headband') {
      ctx.fillStyle = '#cc2200';
      ctx.fillRect(cx - headR, headCY - 4, headR * 2, 4);
    }
  }

  ctx.restore();
}

function drawCurseAuras() {
  const CURSE_COLORS = {
    curse_slow:    '#4488ff',
    curse_weak:    '#222244',
    curse_fragile: '#ff8800',
  };
  for (const p of players) {
    if (!p.curses || p.curses.length === 0 || p.health <= 0) continue;
    ctx.save();
    let ringOffset = 0;
    for (const curse of p.curses) {
      const col = CURSE_COLORS[curse.type];
      if (!col) continue;
      const pulse = 0.3 + Math.abs(Math.sin(frameCount * 0.08 + ringOffset)) * 0.5;
      ctx.globalAlpha = pulse;
      ctx.strokeStyle = col;
      ctx.lineWidth   = 2.5;
      ctx.shadowColor = col;
      ctx.shadowBlur  = 10;
      const r = 22 + ringOffset * 6;
      ctx.beginPath();
      ctx.arc(p.cx(), p.cy() - p.h * 0.1, r, 0, Math.PI * 2);
      ctx.stroke();
      ringOffset++;
    }
    ctx.restore();
  }
}

function drawSpartanRageEffects() {
  let anyRage = false;
  for (const p of players) {
    if (!(p.spartanRageTimer > 0)) continue;
    anyRage = true;
    const pct = Math.min(1, p.spartanRageTimer / 300);
    const pcx = p.cx(), pcy = p.cy();
    ctx.save();
    // Radial aura
    const grad = ctx.createRadialGradient(pcx, pcy, 0, pcx, pcy, 52 + Math.sin(frameCount * 0.12) * 6);
    grad.addColorStop(0,   `rgba(255,100,0,${0.32 * pct})`);
    grad.addColorStop(0.5, `rgba(255,60,0,${0.18 * pct})`);
    grad.addColorStop(1,   'rgba(255,30,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(pcx, pcy, 58, 0, Math.PI * 2);
    ctx.fill();
    // Pulsing outline ring
    ctx.strokeStyle = `rgba(255,140,0,${0.65 * pct})`;
    ctx.lineWidth   = 2.5;
    ctx.shadowColor = '#ff6600';
    ctx.shadowBlur  = 18;
    ctx.beginPath();
    ctx.arc(pcx, pcy, 34 + Math.sin(frameCount * 0.18) * 4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    // Floating ember particles every 3 frames
    if (frameCount % 3 === 0 && settings.particles && particles.length < MAX_PARTICLES) {
      const _ang = Math.random() * Math.PI * 2;
      const _r   = 16 + Math.random() * 24;
      const _p = _getParticle();
      _p.x = pcx + Math.cos(_ang) * _r; _p.y = pcy + Math.sin(_ang) * _r;
      _p.vx = (Math.random() - 0.5) * 1.8; _p.vy = -2.0 - Math.random() * 2.2;
      _p.color = Math.random() < 0.65 ? '#ff6600' : '#ff9900';
      _p.size = 1.6 + Math.random() * 2.2; _p.life = 28 + Math.random() * 22; _p.maxLife = 50;
      particles.push(_p);
    }
  }
  // Screen orange tint — only once regardless of how many have rage
  if (anyRage) {
    const _tintA = 0.055 + Math.sin(frameCount * 0.09) * 0.025;
    ctx.save();
    ctx.globalAlpha = _tintA;
    ctx.fillStyle   = '#ff5500';
    ctx.fillRect(0, 0, GAME_W, GAME_H);
    ctx.restore();
  }
}

// ============================================================
// CLASS VISUAL EFFECTS (Thor lightning arcs, Ninja shadow trail, etc.)
// ============================================================
function spawnLightningBolt(x, targetY) {
  // Build a jagged segmented path from top of screen down to target
  const segments = [];
  let cx = x + (Math.random() - 0.5) * 60;
  let cy = 0;
  const steps = 10 + Math.floor(Math.random() * 6);
  for (let i = 0; i <= steps; i++) {
    segments.push({ x: cx, y: cy });
    cy = targetY * (i / steps);
    cx = x + (Math.random() - 0.5) * 40 * (1 - i / steps);
  }
  segments.push({ x, y: targetY });
  lightningBolts.push({ x, y: targetY, timer: 18, segments });
}

function updateAndDrawLightningBolts() {
  for (let i = lightningBolts.length - 1; i >= 0; i--) {
    const bolt = lightningBolts[i];
    bolt.timer--;
    if (bolt.timer <= 0) { lightningBolts.splice(i, 1); continue; }
    const alpha = bolt.timer / 18;
    ctx.save();
    ctx.strokeStyle = `rgba(255,255,120,${alpha})`;
    ctx.lineWidth   = 2.5;
    ctx.shadowColor = '#ffff00';
    ctx.shadowBlur  = 12;
    ctx.beginPath();
    ctx.moveTo(bolt.segments[0].x, bolt.segments[0].y);
    for (let j = 1; j < bolt.segments.length; j++) {
      ctx.lineTo(bolt.segments[j].x, bolt.segments[j].y);
    }
    ctx.stroke();
    // Inner bright core
    ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.8})`;
    ctx.lineWidth   = 1;
    ctx.shadowBlur  = 4;
    ctx.beginPath();
    ctx.moveTo(bolt.segments[0].x, bolt.segments[0].y);
    for (let j = 1; j < bolt.segments.length; j++) {
      ctx.lineTo(bolt.segments[j].x, bolt.segments[j].y);
    }
    ctx.stroke();
    ctx.restore();
  }
}

const classTrails = []; // {x, y, color, alpha, size, life}

function drawClassEffects() {
  // Update + draw shadow trails
  for (let i = classTrails.length - 1; i >= 0; i--) {
    const t = classTrails[i];
    t.alpha -= 0.04;
    t.life--;
    if (t.life <= 0) { classTrails.splice(i, 1); continue; }
    ctx.save();
    ctx.globalAlpha = Math.max(0, t.alpha);
    ctx.fillStyle   = t.color;
    ctx.beginPath();
    ctx.roundRect(t.x, t.y, 22, 60, 4);
    ctx.fill();
    ctx.restore();
  }

  for (const p of players) {
    if (p.health <= 0 || p.backstageHiding) continue;

    // THOR: Periodic lightning arc toward target + electric sparks on body
    if (p.charClass === 'thor') {
      // Ambient crackling particles
      if (frameCount % 8 === 0 && settings.particles && particles.length < MAX_PARTICLES) {
        const a = Math.random() * Math.PI * 2;
        const _p = _getParticle();
        _p.x = p.cx() + Math.cos(a) * 14; _p.y = p.cy() + Math.sin(a) * 14;
        _p.vx = (Math.random()-0.5)*2; _p.vy = -1.5 - Math.random()*1.5;
        _p.color = Math.random() < 0.6 ? '#ffff44' : '#aaddff';
        _p.size = 1.5 + Math.random()*2; _p.life = 14 + Math.random()*10; _p.maxLife = 24;
        particles.push(_p);
      }
      // Lightning arc toward target every 55 frames
      if (p.target && p.target.health > 0 && frameCount % 55 === 0) {
        const tx = p.target.cx(), ty = p.target.cy();
        const sx2 = p.cx(), sy2 = p.cy();
        const steps = 7;
        for (let si = 0; si < steps && particles.length < MAX_PARTICLES; si++) {
          const prog = si / steps;
          const jx   = sx2 + (tx - sx2) * prog + (Math.random()-0.5)*30;
          const jy   = sy2 + (ty - sy2) * prog + (Math.random()-0.5)*20;
          const _p = _getParticle();
          _p.x = jx; _p.y = jy; _p.vx = 0; _p.vy = 0;
          _p.color = '#ffffaa'; _p.size = 2.5; _p.life = 8; _p.maxLife = 8;
          particles.push(_p);
        }
      }
    }

    // NINJA: Shadow trail during fast movement
    if (p.charClass === 'ninja' && Math.abs(p.vx) > 5 && frameCount % 4 === 0) {
      classTrails.push({ x: p.x, y: p.y, color: 'rgba(0,200,80,0.45)', alpha: 0.45, size: 1, life: 14 });
    }

    // KRATOS: Ember sparks when in Spartan Rage (already handled by drawSpartanRageEffects)
    // Extra hit flash crackle when rage is active and hit
    if (p.charClass === 'kratos' && p.spartanRageTimer > 0 && p.hurtTimer > 0) {
      if (settings.particles) {
        for (let k = 0; k < 3 && particles.length < MAX_PARTICLES; k++) {
          const _p = _getParticle();
          _p.x = p.cx() + (Math.random()-0.5)*20; _p.y = p.cy() + (Math.random()-0.5)*20;
          _p.vx = (Math.random()-0.5)*4; _p.vy = -2-Math.random()*3;
          _p.color = '#ff8800'; _p.size = 2+Math.random()*2; _p.life = 12; _p.maxLife = 12;
          particles.push(_p);
        }
      }
    }

    // GUNNER: Muzzle flash lingering glow on weapon arm (cosmetic)
    if (p.charClass === 'gunner' && p.attackTimer > 0 && p.attackTimer === p.attackDuration) {
      if (settings.particles) {
        spawnParticles(p.cx() + p.facing * 28, p.y + 22, '#ffdd00', 5);
      }
    }
  }
}

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
// Canvas fills 100vw × 100vh and canvas.width = window.innerWidth, so
// getBoundingClientRect() CSS-pixel values map 1:1 to canvas coordinates.
function _hudBottom() {
  const el = document.getElementById('hud');
  return el ? el.getBoundingClientRect().bottom : 0;
}

function drawStorySubtitle() {
  if (!storyFightSubtitle || storyFightSubtitle.timer <= 0) return;
  storyFightSubtitle.timer--;

  const { text, timer, maxTimer, color, speaker } = storyFightSubtitle;
  const fadeIn  = Math.min(1, (maxTimer - timer) / 20);
  const fadeOut = Math.min(1, timer / 30);
  const alpha   = Math.min(fadeIn, fadeOut);
  if (alpha <= 0) return;

  const cw = canvas.width;
  const ch = canvas.height;
  const isGuide   = !!speaker;
  const fontSize  = Math.round(cw * 0.022);
  const labelSize = Math.round(cw * 0.014);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0); // guarantee screen-space regardless of caller transform state
  ctx.font = `${isGuide ? 'bold' : 'italic'} ${fontSize}px "Segoe UI", Arial, sans-serif`;
  ctx.textAlign = 'center';
  const textW = ctx.measureText(text).width;
  const padX = 28, padY = 12;
  const labelH = isGuide ? labelSize + 10 : 0;
  const bx = cw / 2 - textW / 2 - padX;
  const by = ch - fontSize - padY * 2 - 32 - (isGuide ? labelH + 4 : 0);
  const bw = textW + padX * 2;
  const bh = fontSize + padY * 2;
  const r  = bh / 2;

  // guide label tab above the box
  if (isGuide) {
    ctx.font = `bold ${labelSize}px "Segoe UI", Arial, sans-serif`;
    const labelW = ctx.measureText('🧭 ' + speaker).width + 20;
    const lx = cw / 2 - labelW / 2;
    const ly = by - labelH + 2;
    ctx.globalAlpha = alpha * 0.9;
    ctx.fillStyle = 'rgba(60,30,100,0.92)';
    ctx.beginPath();
    ctx.moveTo(lx + 5, ly); ctx.lineTo(lx + labelW - 5, ly);
    ctx.arcTo(lx + labelW, ly, lx + labelW, ly + 5, 5);
    ctx.lineTo(lx + labelW, ly + labelH - 5);
    ctx.arcTo(lx + labelW, ly + labelH, lx + labelW - 5, ly + labelH, 5);
    ctx.lineTo(lx + 5, ly + labelH);
    ctx.arcTo(lx, ly + labelH, lx, ly + labelH - 5, 5);
    ctx.lineTo(lx, ly + 5);
    ctx.arcTo(lx, ly, lx + 5, ly, 5);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#ccaaff';
    ctx.shadowColor = '#aa66ff'; ctx.shadowBlur = 6;
    ctx.fillText('🧭 ' + speaker, cw / 2, ly + labelSize * 0.85 + 4);
    ctx.shadowBlur = 0;
  }

  // pill background
  ctx.font = `${isGuide ? 'bold' : 'italic'} ${fontSize}px "Segoe UI", Arial, sans-serif`;
  ctx.globalAlpha = alpha * 0.82;
  ctx.fillStyle = isGuide ? 'rgba(40,15,70,0.92)' : 'rgba(0,0,0,0.78)';
  ctx.beginPath();
  ctx.moveTo(bx + r, by);
  ctx.lineTo(bx + bw - r, by);
  ctx.arcTo(bx + bw, by, bx + bw, by + bh, r);
  ctx.lineTo(bx + bw, by + bh - r);
  ctx.arcTo(bx + bw, by + bh, bx + bw - r, by + bh, r);
  ctx.lineTo(bx + r, by + bh);
  ctx.arcTo(bx, by + bh, bx, by + bh - r, r);
  ctx.lineTo(bx, by + r);
  ctx.arcTo(bx, by, bx + r, by, r);
  ctx.closePath();
  ctx.fill();
  if (isGuide) {
    ctx.globalAlpha = alpha * 0.6;
    ctx.strokeStyle = '#aa66ff'; ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(bx + r, by); ctx.lineTo(bx + bw - r, by);
    ctx.arcTo(bx + bw, by, bx + bw, by + bh, r); ctx.lineTo(bx + bw, by + bh - r);
    ctx.arcTo(bx + bw, by + bh, bx + bw - r, by + bh, r); ctx.lineTo(bx + r, by + bh);
    ctx.arcTo(bx, by + bh, bx, by + bh - r, r); ctx.lineTo(bx, by + r);
    ctx.arcTo(bx, by, bx + r, by, r); ctx.closePath(); ctx.stroke();
  }
  // text
  ctx.globalAlpha = alpha;
  ctx.fillStyle   = isGuide ? '#ffffcc' : (color || '#ddeeff');
  ctx.shadowColor = isGuide ? '#ffee88' : (color || '#aaccff');
  ctx.shadowBlur  = isGuide ? 10 : 8;
  ctx.fillText(text, cw / 2, by + padY + fontSize * 0.85);
  ctx.restore();

  if (storyFightSubtitle.timer <= 0) storyFightSubtitle = null;
}

// ── Objective system ─────────────────────────────────────────────────────────
function setObjective(text) {
  window.currentObjective = { text: text, completed: false };
  window.objectiveCompleteTimer = 0;
}

function completeObjective() {
  if (!window.currentObjective || window.currentObjective.completed) return;
  window.currentObjective.completed = true;
  window.objectiveCompleteTimer = 200; // show "COMPLETE" for ~3.3s
}

function drawObjectiveHUD() {
  if (!storyModeActive) return;
  if (!window.currentObjective && window.objectiveCompleteTimer <= 0) return;
  if (typeof isCinematic !== 'undefined' && isCinematic) return; // hide during cinematics

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  const cw = canvas.width;
  const ch = canvas.height;
  const isComplete = window.objectiveCompleteTimer > 0;
  const label  = isComplete ? '✓ OBJECTIVE COMPLETE' : (window.currentObjective ? window.currentObjective.text : '');
  if (!label) { ctx.restore(); return; }

  // Fade in/out
  let alpha = 1.0;
  if (isComplete) {
    window.objectiveCompleteTimer--;
    alpha = Math.min(1.0, window.objectiveCompleteTimer / 30); // fade out in last 30 frames
    if (window.objectiveCompleteTimer <= 0) { window.currentObjective = null; }
  }

  ctx.globalAlpha = alpha * 0.92;
  const fontSize = Math.round(cw * 0.018);
  ctx.font = `${isComplete ? 'bold ' : ''}${fontSize}px "Segoe UI", Arial, sans-serif`;
  ctx.textAlign    = 'left';
  ctx.textBaseline = 'middle';

  const prefix   = isComplete ? '' : '▶ ';
  const fullText = prefix + label;
  const tw = ctx.measureText(fullText).width;
  const px = Math.round(cw * 0.015);
  const hudH = typeof _hudBottom === 'function' ? _hudBottom() : 0;
  const py = hudH + fontSize + 10;
  const padX = 9, padH = fontSize + 10;

  // Background pill
  ctx.fillStyle = isComplete ? 'rgba(30,120,50,0.82)' : 'rgba(5,8,22,0.78)';
  ctx.beginPath();
  ctx.roundRect(px - padX, py - padH / 2, tw + padX * 2, padH, 5);
  ctx.fill();

  // Accent left bar
  ctx.fillStyle = isComplete ? '#44ee88' : '#4488ff';
  ctx.fillRect(px - padX, py - padH / 2, 3, padH);

  // Text
  ctx.fillStyle = isComplete ? '#aaffcc' : '#c8d8ff';
  ctx.shadowColor = isComplete ? '#44ff88' : '#4466ff';
  ctx.shadowBlur  = isComplete ? 8 : 4;
  ctx.fillText(fullText, px, py + 1);
  ctx.restore();
}

// ── Cinematic letterbox (top/bottom black bars) ───────────────────────────────
function drawCinematicLetterbox() {
  if (typeof cinematicLetterboxAmt === 'undefined') return;
  // Lerp toward target
  const lerpRate = 0.08;
  cinematicLetterboxAmt += (cinematicLetterboxTarget - cinematicLetterboxAmt) * lerpRate;
  if (Math.abs(cinematicLetterboxTarget - cinematicLetterboxAmt) < 0.001) cinematicLetterboxAmt = cinematicLetterboxTarget;
  if (cinematicLetterboxAmt < 0.002) return;

  const barH = Math.round(canvas.height * cinematicLetterboxAmt * 0.13); // 13% per side max
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, barH);
  ctx.fillRect(0, canvas.height - barH, canvas.width, barH);
  ctx.restore();
}

// ── Cinematic mode helpers ────────────────────────────────────────────────────
function startCinematicMode() {
  if (typeof isCinematic !== 'undefined') isCinematic = true;
  if (typeof setCombatLock === 'function') setCombatLock('cinematic');
  if (typeof cinematicLetterboxTarget !== 'undefined') cinematicLetterboxTarget = 1;
  // Hide debug overlays during cinematics
  if (typeof debugMode !== 'undefined') window._debugModePreCinematic = debugMode;
}
function endCinematicMode() {
  if (typeof isCinematic !== 'undefined') isCinematic = false;
  if (typeof clearCombatLock === 'function') clearCombatLock('cinematic');
  if (typeof cinematicLetterboxTarget !== 'undefined') cinematicLetterboxTarget = 0;
  if (typeof window._debugModePreCinematic !== 'undefined') {
    if (typeof debugMode !== 'undefined') debugMode = window._debugModePreCinematic;
    delete window._debugModePreCinematic;
  }
}

// ── Story opponent name HUD — small banner at top-right during story fights ───
function drawStoryOpponentHUD() {
  if (!storyModeActive || !storyOpponentName || gameMode === 'exploration') return;
  const p2 = players && players[1];
  if (!p2 || p2.health <= 0) return;

  const cw = canvas.width;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  const fontSize = Math.round(cw * 0.018);
  const label    = storyOpponentName;
  ctx.font = `bold ${fontSize}px "Segoe UI", Arial, sans-serif`;
  ctx.textAlign    = 'right';
  ctx.textBaseline = 'middle';
  const tw  = ctx.measureText(label).width;
  // py must sit below the DOM HUD bar (which has an opaque background covering ~120–130px).
  // _hudBottom() reads the actual rendered height so this stays correct if HUD ever resizes.
  const px  = cw - 16, py = _hudBottom() + fontSize + 6;
  const padX = 10, padH = fontSize + 10;

  // Background pill
  ctx.globalAlpha = 0.78;
  ctx.fillStyle = 'rgba(10,5,25,0.85)';
  ctx.beginPath();
  const bx = px - tw - padX * 2, bw = tw + padX * 2, bh = padH;
  ctx.roundRect(bx, py - bh / 2, bw, bh, bh / 2);
  ctx.fill();

  // HP fraction bar under name
  const hpFrac = Math.max(0, p2.health / p2.maxHealth);
  const barH   = 3;
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.fillRect(bx, py + bh / 2 - barH, bw, barH);
  ctx.globalAlpha = 0.85;
  const hpColor = hpFrac > 0.5 ? '#44cc66' : hpFrac > 0.25 ? '#ffaa22' : '#ee3333';
  ctx.fillStyle = hpColor;
  ctx.fillRect(bx, py + bh / 2 - barH, bw * hpFrac, barH);

  // Name text
  ctx.globalAlpha = 0.95;
  ctx.fillStyle = '#dde4ff';
  ctx.shadowColor = '#6688ff'; ctx.shadowBlur = 6;
  ctx.fillText(label, px - padX, py + 1);

  // Class label (small, below name pill)
  if (p2.charClass) {
    const clsName = (typeof CLASSES !== 'undefined' && CLASSES[p2.charClass])
      ? (CLASSES[p2.charClass].name || p2.charClass)
      : p2.charClass;
    const clsFontSize = Math.round(cw * 0.013);
    ctx.font = `${clsFontSize}px "Segoe UI", Arial, sans-serif`;
    ctx.globalAlpha = 0.65;
    ctx.fillStyle = '#88aaff';
    ctx.shadowBlur = 0;
    ctx.fillText(clsName.toUpperCase(), px - padX, py + bh / 2 + clsFontSize + 4);
  }

  ctx.restore();
}

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

// ─── ONLINE-ONLY LARGE ARENA DRAW FUNCTIONS ─────────────────────────────────

function drawMegacityArena() {
  const W = 1800, H = GAME_H;
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#0a0a1a');
  grad.addColorStop(1, '#1a0a2e');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
  // Buildings
  for (let i = 0; i < 30; i++) {
    const bx = (i * 62) % W;
    const bh = 120 + ((i * 137) % 200);
    const bw = 40 + ((i * 53) % 50);
    ctx.fillStyle = '#1a1a3e';
    ctx.fillRect(bx, H - bh - 40, bw, bh);
    // Windows
    for (let wy = 0; wy < bh - 20; wy += 16) {
      for (let wx = 6; wx < bw - 6; wx += 14) {
        const lit = ((frameCount + i * 7 + wy + wx) % 60) < 30;
        ctx.fillStyle = 'rgba(255,220,80,' + (lit ? '0.7' : '0.1') + ')';
        ctx.fillRect(bx + wx, H - bh - 40 + wy + 8, 8, 8);
      }
    }
  }
}

function drawWarpzoneArena() {
  const W = 1800, H = GAME_H;
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#0d0024');
  grad.addColorStop(1, '#00001a');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
  // Stars
  for (let i = 0; i < 80; i++) {
    const sx = (i * 223) % W, sy = (i * 139) % Math.floor(H * 0.7);
    ctx.fillStyle = 'rgba(200,150,255,' + (0.3 + (i % 3) * 0.2) + ')';
    ctx.fillRect(sx, sy, 2, 2);
  }
  // Decorative warp portals
  for (let i = 0; i < 5; i++) {
    const px = 180 + i * 350, py = 200 + (i % 2) * 100;
    const phase = (frameCount * 0.03 + i) % (Math.PI * 2);
    ctx.beginPath();
    ctx.ellipse(px, py, 60 + Math.sin(phase) * 10, 30 + Math.sin(phase) * 5, 0, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(136,0,255,' + (0.5 + Math.sin(phase) * 0.3) + ')';
    ctx.lineWidth = 3;
    ctx.stroke();
  }
}

function drawColosseum10Arena() {
  const W = 1800, H = GAME_H;
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#1a0800');
  grad.addColorStop(1, '#3d1a00');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
  // Stone arches
  ctx.fillStyle = '#4a2808';
  for (let i = 0; i < 12; i++) {
    const ax = i * 155, aw = 100, ah = 180;
    ctx.fillRect(ax, H - ah - 40, 20, ah);
    ctx.fillRect(ax + aw - 20, H - ah - 40, 20, ah);
    ctx.beginPath();
    ctx.arc(ax + aw / 2, H - ah - 40, aw / 2, Math.PI, 0);
    ctx.fill();
  }
  // Torches (flickering)
  for (let i = 0; i < 8; i++) {
    const tx = 100 + i * 220, ty = H - 180;
    const flicker = Math.sin(frameCount * 0.2 + i) * 0.3;
    const g = 120 + Math.floor(flicker * 80);
    ctx.fillStyle = 'rgba(255,' + g + ',0,' + (0.7 + flicker * 0.3) + ')';
    ctx.beginPath();
    ctx.arc(tx, ty, 8 + flicker * 4, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ── Home world: Backyard ───────────────────────────────────────────────────────
function drawHomeYardArena() {
  const W = GAME_W;
  const groundY = 480;

  // Sky — clear afternoon
  const sky = ctx.createLinearGradient(0,0,0,groundY);
  sky.addColorStop(0,'#5aaddb'); sky.addColorStop(1,'#c0e8f8');
  ctx.fillStyle = sky; ctx.fillRect(0,0,W,groundY);

  // Clouds
  ctx.fillStyle = 'rgba(255,255,255,0.82)';
  [[120,60,55,22],[360,40,70,26],[640,70,50,20],[800,50,60,24]].forEach(([cx,cy,rx,ry])=>{
    ctx.beginPath(); ctx.ellipse(cx,cy,rx,ry,0,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx+30,cy-8,rx*0.7,ry*0.7,0,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx-28,cy-4,rx*0.6,ry*0.6,0,0,Math.PI*2); ctx.fill();
  });

  // Back wall of house — large, spans most of the width
  ctx.fillStyle = '#c8b89a'; ctx.strokeStyle='#a09070'; ctx.lineWidth=2;
  ctx.fillRect(0, 180, W, groundY-180);
  // Brick texture rows
  ctx.strokeStyle='rgba(0,0,0,0.06)'; ctx.lineWidth=1;
  for(let ry=200; ry<groundY; ry+=18){
    ctx.beginPath(); ctx.moveTo(0,ry); ctx.lineTo(W,ry); ctx.stroke();
    const off = ((ry/18)|0)%2 === 0 ? 0 : 55;
    for(let rx=off; rx<W; rx+=110){
      ctx.beginPath(); ctx.moveTo(rx,ry); ctx.lineTo(rx,ry+18); ctx.stroke();
    }
  }

  // Sliding glass door (center)
  ctx.fillStyle='rgba(180,220,255,0.35)'; ctx.strokeStyle='#8aadcc'; ctx.lineWidth=2;
  ctx.fillRect(360,270,180,210); ctx.strokeRect(360,270,180,210);
  ctx.beginPath(); ctx.moveTo(450,270); ctx.lineTo(450,480); ctx.stroke();
  // Door frame
  ctx.strokeStyle='#6a8aa8'; ctx.lineWidth=3;
  ctx.strokeRect(360,270,180,210);
  // Reflection shimmer
  ctx.fillStyle='rgba(255,255,255,0.18)';
  ctx.fillRect(366,276,24,180);

  // Window (left of door)
  ctx.fillStyle='rgba(180,220,255,0.3)'; ctx.strokeStyle='#8aadcc'; ctx.lineWidth=1.5;
  ctx.fillRect(180,290,120,90); ctx.strokeRect(180,290,120,90);
  ctx.beginPath(); ctx.moveTo(240,290); ctx.lineTo(240,380); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(180,335); ctx.lineTo(300,335); ctx.stroke();
  // Curtains
  ctx.fillStyle='rgba(255,220,180,0.5)';
  ctx.fillRect(180,290,28,90); ctx.fillRect(272,290,28,90);

  // Window (right)
  ctx.fillStyle='rgba(180,220,255,0.3)'; ctx.strokeStyle='#8aadcc'; ctx.lineWidth=1.5;
  ctx.fillRect(600,290,120,90); ctx.strokeRect(600,290,120,90);
  ctx.beginPath(); ctx.moveTo(660,290); ctx.lineTo(660,380); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(600,335); ctx.lineTo(720,335); ctx.stroke();
  ctx.fillStyle='rgba(255,220,180,0.5)';
  ctx.fillRect(600,290,28,90); ctx.fillRect(692,290,28,90);

  // Wooden fence (back of yard)
  ctx.fillStyle='#c4966a'; ctx.strokeStyle='#9a7040'; ctx.lineWidth=1.5;
  // Horizontal rails
  ctx.fillRect(0,195,W,10); ctx.strokeRect(0,195,W,10);
  ctx.fillRect(0,218,W,8);  ctx.strokeRect(0,218,W,8);
  // Vertical pickets (left section and right section, door gap in middle)
  for(let fx=0; fx<360; fx+=22){
    ctx.fillRect(fx+2,170,16,50); ctx.strokeRect(fx+2,170,16,50);
  }
  for(let fx=540; fx<W; fx+=22){
    ctx.fillRect(fx+2,170,16,50); ctx.strokeRect(fx+2,170,16,50);
  }

  // Patio concrete slab
  ctx.fillStyle='#b0a898'; ctx.strokeStyle='#908878'; ctx.lineWidth=1;
  ctx.fillRect(300,460,300,20); ctx.strokeRect(300,460,300,20);
  // Patio grout lines
  ctx.strokeStyle='rgba(0,0,0,0.12)'; ctx.lineWidth=1;
  for(let px=300; px<600; px+=50){ ctx.beginPath(); ctx.moveTo(px,460); ctx.lineTo(px,480); ctx.stroke(); }
  ctx.beginPath(); ctx.moveTo(300,470); ctx.lineTo(600,470); ctx.stroke();

  // Lawn — green ground (extends well past canvas so camera zoom-out never shows void)
  const grass = ctx.createLinearGradient(0,groundY-30,0,groundY+40);
  grass.addColorStop(0,'#5a9040'); grass.addColorStop(1,'#3d6e28');
  ctx.fillStyle = grass; ctx.fillRect(0,groundY,W,600);
  ctx.fillStyle='#4a8030'; ctx.fillRect(0,groundY,W,8);

  // Lawn texture — random darker blades
  ctx.strokeStyle='rgba(40,80,20,0.25)'; ctx.lineWidth=1;
  for(let bx=0; bx<W; bx+=14){
    ctx.beginPath(); ctx.moveTo(bx,groundY); ctx.lineTo(bx+3,groundY-8); ctx.stroke();
  }

  // Small flower pots on patio
  [[328,460],[560,460]].forEach(([px,py])=>{
    ctx.fillStyle='#9a5030'; ctx.strokeStyle='#7a3820'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(px-8,py); ctx.lineTo(px+8,py); ctx.lineTo(px+6,py-14); ctx.lineTo(px-6,py-14); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle='#e06040'; ctx.beginPath(); ctx.arc(px,py-18,5,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#3a7020'; ctx.fillRect(px-1,py-28,2,12);
  });

  // Left & right wooden fence barriers (hard walls)
  [[0, 40],[W-40, 40]].forEach(([bx, bw])=>{
    ctx.fillStyle='#c4966a'; ctx.strokeStyle='#9a7040'; ctx.lineWidth=1.5;
    ctx.fillRect(bx,0,bw,groundY);
    // Horizontal rails
    ctx.fillStyle='#b08050'; ctx.fillRect(bx,200,bw,10); ctx.fillRect(bx,260,bw,10);
    // Vertical pickets
    for(let fy=0; fy<groundY; fy+=22){
      ctx.fillStyle='#c4966a'; ctx.fillRect(bx+4,fy,bw-8,18); ctx.strokeRect(bx+4,fy,bw-8,18);
    }
  });
}

// ── Home world: City Alley ─────────────────────────────────────────────────────
function drawHomeAlleyArena() {
  const W = GAME_W;
  const groundY = 480;
  const t = frameCount * 0.02;

  // Sky strip between buildings — dark/dusk
  const sky = ctx.createLinearGradient(0,0,0,160);
  sky.addColorStop(0,'#1a2030'); sky.addColorStop(1,'#2a3040');
  ctx.fillStyle = sky; ctx.fillRect(0,0,W,160);

  // Stars in the narrow sky strip
  ctx.fillStyle='rgba(255,255,255,0.7)';
  [[60,20],[130,40],[200,15],[300,35],[400,22],[500,38],[620,18],[730,42],[820,28],[880,15]].forEach(([sx,sy])=>{
    const blink = Math.sin(t + sx*0.1) * 0.3 + 0.7;
    ctx.globalAlpha = blink * 0.7;
    ctx.beginPath(); ctx.arc(sx,sy,1,0,Math.PI*2); ctx.fill();
  });
  ctx.globalAlpha = 1;

  // LEFT building wall — brick
  const leftW = 130;
  ctx.fillStyle='#3a3028'; ctx.fillRect(0,0,leftW,groundY);
  // Brick pattern
  ctx.strokeStyle='rgba(0,0,0,0.3)'; ctx.lineWidth=1;
  for(let ry=0; ry<groundY; ry+=16){
    ctx.beginPath(); ctx.moveTo(0,ry); ctx.lineTo(leftW,ry); ctx.stroke();
    const off = ((ry/16)|0)%2===0 ? 0 : 50;
    for(let rx=off; rx<leftW; rx+=100){ ctx.beginPath(); ctx.moveTo(rx,ry); ctx.lineTo(rx,ry+16); ctx.stroke(); }
  }
  // Fire escape on left wall
  ctx.strokeStyle='#555545'; ctx.lineWidth=2;
  ctx.beginPath(); ctx.moveTo(leftW-2,160); ctx.lineTo(leftW-2,groundY); ctx.stroke();
  [220,310,400,groundY-10].forEach(fy=>{
    ctx.fillStyle='#444434'; ctx.fillRect(leftW-30,fy,30,6);
    ctx.strokeStyle='#333324'; ctx.lineWidth=1;
    ctx.strokeRect(leftW-30,fy,30,6);
    // Railing
    for(let rx=leftW-28; rx<leftW; rx+=8){ ctx.beginPath(); ctx.moveTo(rx,fy); ctx.lineTo(rx,fy-20); ctx.stroke(); }
  });
  // Lit window on left
  ctx.fillStyle='rgba(255,200,80,0.35)'; ctx.strokeStyle='#555'; ctx.lineWidth=1;
  ctx.fillRect(8,100,60,50); ctx.strokeRect(8,100,60,50);
  ctx.fillStyle='rgba(255,200,80,0.12)'; // window glow
  ctx.beginPath(); ctx.ellipse(38,125,50,40,0,0,Math.PI*2); ctx.fill();

  // RIGHT building wall
  const rightX = W-130;
  ctx.fillStyle='#2e2a24'; ctx.fillRect(rightX,0,130,groundY);
  ctx.strokeStyle='rgba(0,0,0,0.3)'; ctx.lineWidth=1;
  for(let ry=0; ry<groundY; ry+=16){
    ctx.beginPath(); ctx.moveTo(rightX,ry); ctx.lineTo(W,ry); ctx.stroke();
    const off = ((ry/16)|0)%2===0 ? 0 : 50;
    for(let rx=off; rx<130; rx+=100){ ctx.beginPath(); ctx.moveTo(rightX+rx,ry); ctx.lineTo(rightX+rx,ry+16); ctx.stroke(); }
  }
  ctx.fillStyle='rgba(255,200,80,0.3)'; ctx.strokeStyle='#555'; ctx.lineWidth=1;
  ctx.fillRect(rightX+12,80,70,45); ctx.strokeRect(rightX+12,80,70,45);
  ctx.fillStyle='rgba(255,200,80,0.10)';
  ctx.beginPath(); ctx.ellipse(rightX+47,105,60,40,0,0,Math.PI*2); ctx.fill();

  // Alley depth — dark background between buildings
  const depthGrad = ctx.createLinearGradient(0,0,0,groundY);
  depthGrad.addColorStop(0,'#141820'); depthGrad.addColorStop(1,'#1e2028');
  ctx.fillStyle=depthGrad; ctx.fillRect(leftW,0,rightX-leftW,groundY);

  // Overhead wires
  ctx.strokeStyle='rgba(40,40,40,0.9)'; ctx.lineWidth=1.5;
  [[leftW,80,rightX,100],[leftW,120,rightX,108]].forEach(([x1,y1,x2,y2])=>{
    ctx.beginPath();
    ctx.moveTo(x1,y1);
    const mid=(x1+x2)/2;
    ctx.quadraticCurveTo(mid,y1+18,x2,y2);
    ctx.stroke();
  });
  // Hanging light
  const lightX = W*0.5, lightY = 110;
  const swing = Math.sin(t) * 8;
  ctx.strokeStyle='rgba(40,40,40,0.8)'; ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(lightX,90); ctx.lineTo(lightX+swing,lightY); ctx.stroke();
  ctx.fillStyle='#888'; ctx.beginPath(); ctx.arc(lightX+swing,lightY,6,0,Math.PI*2); ctx.fill();
  // Light cone
  const lightFlicker = 0.15 + Math.sin(t*3)*0.05;
  const lgrad = ctx.createRadialGradient(lightX+swing,lightY,0,lightX+swing,lightY,180);
  lgrad.addColorStop(0,`rgba(255,200,100,${lightFlicker*2})`);
  lgrad.addColorStop(1,'rgba(255,200,100,0)');
  ctx.fillStyle=lgrad;
  ctx.beginPath(); ctx.moveTo(lightX+swing,lightY); ctx.lineTo(lightX+swing-100,groundY); ctx.lineTo(lightX+swing+100,groundY); ctx.closePath(); ctx.fill();

  // Ground — wet asphalt (fill well past canvas to eliminate void on zoom-out)
  const road = ctx.createLinearGradient(0,groundY,0,groundY+60);
  road.addColorStop(0,'#252525'); road.addColorStop(1,'#1a1a1a');
  ctx.fillStyle=road; ctx.fillRect(0,groundY,W,600);
  // Cracks
  ctx.strokeStyle='rgba(0,0,0,0.4)'; ctx.lineWidth=1;
  [[200,groundY,220,groundY+20],[450,groundY,440,groundY+15],[700,groundY,715,groundY+18]].forEach(([x1,y1,x2,y2])=>{
    ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
  });
  // Puddle reflection
  ctx.fillStyle='rgba(255,200,100,0.06)';
  ctx.beginPath(); ctx.ellipse(lightX,groundY+12,60,8,0,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='rgba(100,140,200,0.08)';
  ctx.beginPath(); ctx.ellipse(250,groundY+10,40,6,0,0,Math.PI*2); ctx.fill();
  // Ground line
  ctx.fillStyle='#1a1a1a'; ctx.fillRect(0,groundY,W,4);

  // Graffiti on left wall (simple colored shapes)
  ctx.save(); ctx.globalAlpha=0.45;
  ctx.fillStyle='#dd4422'; ctx.font='bold 18px Arial';
  ctx.fillText('NO', 20, 340);
  ctx.fillStyle='#2244cc';
  ctx.fillText('WAY', 22, 360);
  ctx.restore();

  // Graffiti arrow on right
  ctx.save(); ctx.globalAlpha=0.35; ctx.strokeStyle='#cc8800'; ctx.lineWidth=3;
  ctx.beginPath(); ctx.moveTo(rightX+15,300); ctx.lineTo(rightX+55,300); ctx.lineTo(rightX+48,293); ctx.moveTo(rightX+55,300); ctx.lineTo(rightX+48,307); ctx.stroke();
  ctx.restore();

  // Dumpsters — decorative, flush against ground (no collision)
  [[80,480],[700,480]].forEach(([dx,dy])=>{
    ctx.fillStyle='#2a7a3a'; ctx.strokeStyle='#1a5a2a'; ctx.lineWidth=2;
    ctx.fillRect(dx,dy-38,120,38); ctx.strokeRect(dx,dy-38,120,38);
    ctx.fillStyle='#1a6a2a'; ctx.fillRect(dx-2,dy-42,124,8); ctx.strokeRect(dx-2,dy-42,124,8);
    ctx.strokeStyle='rgba(0,0,0,0.3)'; ctx.lineWidth=1;
    ctx.strokeRect(dx+10,dy-28,30,18);
    ctx.fillStyle='rgba(255,255,255,0.15)'; ctx.font='7px Arial';
    ctx.fillText('WASTE', dx+8, dy-16);
  });

  // Rats (tiny animated)
  const ratX = 180 + Math.sin(t*0.8)*15;
  ctx.fillStyle='#555'; ctx.save();
  ctx.translate(ratX, groundY+5);
  ctx.beginPath(); ctx.ellipse(0,0,8,4,0,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(-8,0,3,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle='#555'; ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(8,0); ctx.quadraticCurveTo(16,-3,20,1); ctx.stroke();
  ctx.restore();

  // Left & right solid brick barrier walls (hard walls matching physics boundary)
  [[0,40],[W-40,40]].forEach(([bx,bw])=>{
    ctx.fillStyle='#3a3028'; ctx.fillRect(bx,0,bw,groundY);
    ctx.strokeStyle='rgba(0,0,0,0.3)'; ctx.lineWidth=1;
    for(let ry=0; ry<groundY; ry+=16){
      ctx.beginPath(); ctx.moveTo(bx,ry); ctx.lineTo(bx+bw,ry); ctx.stroke();
      const off=((ry/16)|0)%2===0?0:50;
      for(let rx=off; rx<bw; rx+=100){ ctx.beginPath(); ctx.moveTo(bx+rx,ry); ctx.lineTo(bx+rx,ry+16); ctx.stroke(); }
    }
    // Grime/moss patches
    ctx.fillStyle='rgba(40,60,20,0.2)'; ctx.fillRect(bx, groundY-80, bw, 80);
  });
}

function drawSuburbArena() {
  const W = GAME_W;
  const sky = ctx.createLinearGradient(0,0,0,480);
  sky.addColorStop(0,'#87CEEB'); sky.addColorStop(1,'#daf0ff');
  ctx.fillStyle = sky; ctx.fillRect(0,0,W,GAME_H);
  // Houses in background
  const houses = [{x:60,w:120,h:140},{x:230,w:140,h:160},{x:430,w:160,h:150},{x:640,w:130,h:145},{x:780,w:110,h:130}];
  for (const hh of houses) {
    ctx.fillStyle = '#e8d8b0';
    ctx.fillRect(hh.x, 480-hh.h, hh.w, hh.h);
    ctx.fillStyle = '#aa5522';
    ctx.beginPath();
    ctx.moveTo(hh.x - 10, 480 - hh.h);
    ctx.lineTo(hh.x + hh.w/2, 480 - hh.h - 60);
    ctx.lineTo(hh.x + hh.w + 10, 480 - hh.h);
    ctx.fill();
    ctx.fillStyle = 'rgba(100,180,255,0.6)';
    ctx.fillRect(hh.x + 15, 480 - hh.h + 25, 30, 30);
    ctx.fillRect(hh.x + hh.w - 45, 480 - hh.h + 25, 30, 30);
  }
  // Portal smoke effect (chaos beginning)
  const smokeAlpha = 0.08 + Math.sin(frameCount * 0.04) * 0.03;
  ctx.fillStyle = `rgba(80,0,80,${smokeAlpha})`;
  ctx.fillRect(0,0,W,GAME_H);
  // Lawn — extend well below canvas to eliminate void on zoom-out
  ctx.fillStyle = '#5a8a3a'; ctx.fillRect(0, 480, W, 600);
  // Sidewalk strip
  ctx.fillStyle = '#c8b890'; ctx.fillRect(0, 472, W, 8);
  ctx.strokeStyle = '#a09070'; ctx.lineWidth = 1;
  for (let sx = 0; sx < W; sx += 80) { ctx.beginPath(); ctx.moveTo(sx,472); ctx.lineTo(sx,480); ctx.stroke(); }

  // Left & right picket fence barriers (hard wall boundaries)
  [[0,40],[W-40,40]].forEach(([bx,bw])=>{
    // Lawn behind fence
    ctx.fillStyle='#5a8a3a'; ctx.fillRect(bx,0,bw,480);
    // Fence rails
    ctx.fillStyle='#f0ece0'; ctx.strokeStyle='#c8c0a0'; ctx.lineWidth=1.5;
    ctx.fillRect(bx,300,bw,8); ctx.strokeRect(bx,300,bw,8);
    ctx.fillRect(bx,340,bw,8); ctx.strokeRect(bx,340,bw,8);
    // Pickets
    for(let fy=260; fy<480; fy+=16){
      ctx.fillStyle='#f5f0e0'; ctx.fillRect(bx+4,fy,bw-8,14); ctx.strokeRect(bx+4,fy,bw-8,14);
      // Pointed top
      ctx.beginPath(); ctx.moveTo(bx+4,fy); ctx.lineTo(bx+bw/2,fy-8); ctx.lineTo(bx+bw-4,fy); ctx.closePath();
      ctx.fillStyle='#f5f0e0'; ctx.fill(); ctx.stroke();
    }
  });
}

function drawRuralArena() {
  const W = GAME_W;
  const groundY = 480;

  // Sky — sunset gradient
  const sky = ctx.createLinearGradient(0,0,0,groundY);
  sky.addColorStop(0,'#f5c842'); sky.addColorStop(0.5,'#f0a020'); sky.addColorStop(1,'#c87010');
  ctx.fillStyle = sky; ctx.fillRect(0,0,W,groundY);

  // Sun
  ctx.fillStyle = 'rgba(255,220,80,0.9)';
  ctx.beginPath(); ctx.arc(740, 100, 55, 0, Math.PI*2); ctx.fill();

  // Background barn (purely decorative — does not reach ground)
  ctx.fillStyle = '#8b1a1a';
  ctx.fillRect(220, 300, 180, 180);
  ctx.fillStyle = '#6b1010';
  ctx.beginPath(); ctx.moveTo(210,300); ctx.lineTo(310,230); ctx.lineTo(410,300); ctx.fill();
  ctx.fillStyle = '#4a0808';
  ctx.fillRect(285, 390, 60, 90);

  // Background silo
  ctx.fillStyle = '#c8b870';
  ctx.fillRect(500, 300, 60, 180);
  ctx.beginPath(); ctx.arc(530, 300, 30, Math.PI, 0); ctx.fill();

  // Portal glow in distance (story atmosphere)
  const pg = ctx.createRadialGradient(150, 380, 10, 150, 380, 80);
  pg.addColorStop(0, `rgba(180,0,255,${0.35 + Math.sin(frameCount*0.06)*0.12})`);
  pg.addColorStop(1, 'rgba(180,0,255,0)');
  ctx.fillStyle = pg; ctx.fillRect(0,200,300,280);

  // Ground — dirt/earth, extend far below to eliminate void
  const dirt = ctx.createLinearGradient(0,groundY,0,groundY+60);
  dirt.addColorStop(0,'#8a6a38'); dirt.addColorStop(1,'#6a4e28');
  ctx.fillStyle = dirt; ctx.fillRect(0,groundY,W,600);
  // Top soil strip
  ctx.fillStyle = '#7a5c30'; ctx.fillRect(0,groundY,W,6);
  // Dirt texture lines
  ctx.strokeStyle = '#5c4010'; ctx.lineWidth = 1;
  for (let fx = 0; fx < W; fx += 18) {
    ctx.beginPath(); ctx.moveTo(fx,groundY); ctx.lineTo(fx+5,groundY-6); ctx.stroke();
  }

  // Left & right wire/chain-link fence barriers (hard wall boundaries)
  [[0,36],[W-36,36]].forEach(([bx,bw])=>{
    // Wood posts
    ctx.fillStyle='#8a6a38'; ctx.strokeStyle='#5a4020'; ctx.lineWidth=2;
    for(let py=200; py<groundY; py+=100){
      ctx.fillRect(bx+bw/2-4,py,8,groundY-py);
      ctx.strokeRect(bx+bw/2-4,py,8,groundY-py);
      // Post cap
      ctx.beginPath(); ctx.moveTo(bx+bw/2-5,py); ctx.lineTo(bx+bw/2,py-10); ctx.lineTo(bx+bw/2+5,py); ctx.closePath();
      ctx.fill(); ctx.stroke();
    }
    // Horizontal wire strands
    ctx.strokeStyle='rgba(150,150,100,0.7)'; ctx.lineWidth=1.5;
    [240,280,320,360,400,440,480].forEach(wy=>{
      ctx.beginPath(); ctx.moveTo(bx,wy); ctx.lineTo(bx+bw,wy); ctx.stroke();
    });
    // Diagonal cross-wire pattern
    ctx.strokeStyle='rgba(150,150,100,0.4)'; ctx.lineWidth=1;
    for(let wy=240; wy<480; wy+=20){
      ctx.beginPath(); ctx.moveTo(bx,wy); ctx.lineTo(bx+bw,wy+20); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(bx,wy+20); ctx.lineTo(bx+bw,wy); ctx.stroke();
    }
  });
}

function drawPortalEdgeArena() {
  const W = GAME_W, H = GAME_H;
  const sky = ctx.createLinearGradient(0,0,0,H);
  sky.addColorStop(0,'#0a0020'); sky.addColorStop(1,'#300060');
  ctx.fillStyle = sky; ctx.fillRect(0,0,W,H);
  for (let i=0; i<60; i++) {
    const sx=(i*227+13)%W, sy=(i*131+7)%(H*0.7);
    const br = 0.4 + Math.sin(frameCount*0.05+i)*0.3;
    ctx.fillStyle=`rgba(220,180,255,${br})`; ctx.fillRect(sx,sy,2,2);
  }
  const px = W/2, py = 260;
  const pr = 120 + Math.sin(frameCount*0.04)*12;
  const portalGrad = ctx.createRadialGradient(px,py,0,px,py,pr);
  portalGrad.addColorStop(0,'rgba(255,255,255,0.95)');
  portalGrad.addColorStop(0.15,'rgba(180,80,255,0.9)');
  portalGrad.addColorStop(0.5,'rgba(80,0,200,0.7)');
  portalGrad.addColorStop(1,'rgba(20,0,60,0)');
  ctx.fillStyle = portalGrad;
  ctx.beginPath(); ctx.ellipse(px,py,pr*0.55,pr,0,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle = `rgba(200,100,255,${0.7+Math.sin(frameCount*0.07)*0.2})`;
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.ellipse(px,py,pr*0.55,pr,0,0,Math.PI*2); ctx.stroke();
  for (let i=0; i<8; i++) {
    const angle = (i/8)*Math.PI*2 + frameCount*0.02;
    const len = 30 + Math.sin(frameCount*0.1+i)*15;
    ctx.strokeStyle = `rgba(200,100,255,0.6)`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(px + Math.cos(angle)*pr*0.5, py + Math.sin(angle)*pr*0.85);
    ctx.lineTo(px + Math.cos(angle)*(pr*0.5+len), py + Math.sin(angle)*(pr*0.85+len));
    ctx.stroke();
  }
  ctx.fillStyle = '#150030'; ctx.fillRect(0,480,W,H-480);
  const gGlow = ctx.createLinearGradient(0,460,0,480);
  gGlow.addColorStop(0,`rgba(100,0,200,${0.4+Math.sin(frameCount*0.04)*0.1})`);
  gGlow.addColorStop(1,'rgba(100,0,200,0)');
  ctx.fillStyle = gGlow; ctx.fillRect(0,440,W,40);
}

function drawRealmEntryArena() {
  const W = GAME_W, H = GAME_H;
  const sky = ctx.createLinearGradient(0,0,0,H);
  sky.addColorStop(0,'#000820'); sky.addColorStop(1,'#003060');
  ctx.fillStyle = sky; ctx.fillRect(0,0,W,H);
  for (let i=0; i<4; i++) {
    const nx=(i*230+100)%W, ny=60+i*80;
    const nr=100+i*30;
    const ng = ctx.createRadialGradient(nx,ny,0,nx,ny,nr);
    ng.addColorStop(0,`rgba(0,${80+i*30},${180+i*20},0.07)`);
    ng.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=ng; ctx.fillRect(0,0,W,H);
  }
  ctx.fillStyle = 'rgba(0,60,120,0.6)';
  for (let i=0; i<5; i++) {
    const bx=i*185+30, bh=60+i%3*40;
    ctx.fillRect(bx, 380-bh, 60, bh);
    ctx.fillRect(bx-10, 380-bh-20, 80, 20);
  }
  for (let i=0; i<80; i++) {
    const sx=(i*211)%W, sy=(i*137)%(H*0.9);
    const br = 0.3+Math.sin(frameCount*0.04+i*0.7)*0.3;
    ctx.fillStyle=`rgba(100,200,255,${br})`; ctx.fillRect(sx,sy,1.5,1.5);
  }
  ctx.fillStyle='#001030'; ctx.fillRect(0,480,W,H-480);
  const reGlow = ctx.createLinearGradient(0,460,0,480);
  reGlow.addColorStop(0,`rgba(0,100,255,${0.3+Math.sin(frameCount*0.04)*0.1})`);
  reGlow.addColorStop(1,'rgba(0,100,255,0)');
  ctx.fillStyle = reGlow; ctx.fillRect(0,440,W,40);
}

function drawBossSanctumArena() {
  const W = GAME_W, H = GAME_H;
  const sky = ctx.createLinearGradient(0,0,0,H);
  sky.addColorStop(0,'#100005'); sky.addColorStop(1,'#350020');
  ctx.fillStyle = sky; ctx.fillRect(0,0,W,H);
  ctx.strokeStyle = `rgba(200,0,60,${0.3+Math.sin(frameCount*0.05)*0.2})`;
  ctx.lineWidth = 2;
  for (let i=0; i<6; i++) {
    const vx = i*(W/5);
    ctx.beginPath(); ctx.moveTo(vx,0);
    ctx.bezierCurveTo(vx+80,60, vx-50,120, vx+30,200);
    ctx.stroke();
  }
  ctx.fillStyle = '#1a0015';
  ctx.fillRect(W/2-60, 280, 120, 200);
  ctx.fillRect(W/2-100, 275, 200, 20);
  ctx.fillRect(W/2-40, 210, 80, 80);
  ctx.fillRect(W/2-50, 205, 100, 15);
  const tg = ctx.createRadialGradient(W/2,350,0,W/2,350,200);
  tg.addColorStop(0,`rgba(180,0,50,${0.2+Math.sin(frameCount*0.04)*0.08})`);
  tg.addColorStop(1,'rgba(180,0,50,0)');
  ctx.fillStyle=tg; ctx.fillRect(0,0,W,H);
  for (let i=0; i<6; i++) {
    const cx2 = 80+i*140, cy2 = 150+Math.sin(frameCount*0.02+i)*12;
    ctx.fillStyle = `rgba(80,0,40,0.7)`;
    ctx.beginPath();
    ctx.moveTo(cx2, cy2-25); ctx.lineTo(cx2+12,cy2); ctx.lineTo(cx2,cy2+25); ctx.lineTo(cx2-12,cy2);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle='rgba(200,0,60,0.5)'; ctx.lineWidth=1; ctx.stroke();
  }
  ctx.fillStyle='#1a0010'; ctx.fillRect(0,480,W,H-480);
  ctx.strokeStyle=`rgba(200,0,40,${0.4+Math.sin(frameCount*0.06)*0.15})`; ctx.lineWidth=2;
  const cracks = [[0,490,200,485],[200,485,350,492],[350,492,500,480],[500,480,700,488],[700,488,900,483]];
  for (const [x1,y1,x2,y2] of cracks) { ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke(); }
}
