'use strict';
// smb-drawing-bg.js — generateBgElements, drawBackground, boundary portals, explore background tiles
// Depends on: smb-globals.js, smb-data-arenas.js, smb-particles-core.js

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

