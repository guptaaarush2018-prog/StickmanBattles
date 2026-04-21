'use strict';
// smb-trueform-ending-draw.js — drawTFEnding visual pass + canvas utilities (_roundRect, _tfeCamFocus)
// Depends on: smb-globals.js, smb-particles-core.js, smb-combat.js

// ── Draw ──────────────────────────────────────────────────────────────────────
function drawTFEnding() {
  const sc = tfEndingScene;
  if (!sc) return;

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const cw = canvas.width, ch = canvas.height;
  const scX = cw / GAME_W, scY = ch / GAME_H;
  const sc_ = Math.min(scX, scY);

  // ── REALIZATION: boss dialogue + zero pops ──────────────────────────────────
  if (sc.phase === 'realization') {
    if (sc.dialogueAlpha > 0 && sc.dialogueIdx < sc.realizationDialogue.length) {
      const line = sc.realizationDialogue[sc.dialogueIdx];
      const bsx  = sc.boss.cx() * scX;
      const bsy  = sc.boss.cy() * scY - 70 * scY;
      ctx.globalAlpha = sc.dialogueAlpha;
      ctx.fillStyle   = 'rgba(0,0,0,0.82)';
      ctx.strokeStyle = '#8800ff';
      ctx.lineWidth   = 2;
      const bw = 280 * sc_, bh = 44 * sc_;
      _roundRect(ctx, bsx - bw/2, bsy - bh/2, bw, bh, 10 * sc_);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle  = '#ffffff';
      ctx.font       = `bold ${Math.round(13 * sc_)}px sans-serif`;
      ctx.textAlign  = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(line, bsx, bsy);
      ctx.textBaseline = 'alphabetic';
    }

    // Zero pops
    for (const zp of _tfeZeroPops) {
      ctx.globalAlpha = zp.alpha;
      ctx.font        = `bold ${Math.round(18 * sc_)}px monospace`;
      ctx.textAlign   = 'center';
      ctx.fillStyle   = '#ff4444';
      ctx.shadowColor = '#ff0000';
      ctx.shadowBlur  = 10;
      ctx.fillText('0', zp.x * scX, zp.y * scY);
      ctx.shadowBlur  = 0;
    }
  }

  // ── LAUNCH: dimension panels + flying hero ───────────────────────────────────
  if (sc.phase === 'launch') {
    const panel = _TFE_BG_PANELS[sc.bgPanelIdx] || _TFE_BG_PANELS[0];

    // Background gradient overlay (dimensions)
    const sky = panel.sky;
    const grd = ctx.createLinearGradient(0, 0, 0, ch);
    grd.addColorStop(0,   sky[0]);
    grd.addColorStop(0.5, sky[1]);
    grd.addColorStop(1,   sky[2]);
    ctx.globalAlpha = 0.72;
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, cw, ch);

    // Dimension label
    ctx.globalAlpha = 0.75 * sc.tearAlpha;
    ctx.font = `bold ${Math.round(11 * sc_)}px monospace`;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(panel.label, 20 * scX, 22 * scY);

    // Reality tear streaks
    if (sc.tearAlpha > 0) {
      ctx.globalAlpha = sc.tearAlpha * 0.5;
      ctx.strokeStyle = '#ffffff';
      for (let i = 0; i < 6; i++) {
        const lx = (Math.sin(sc.timer * 0.04 + i * 1.1) * 0.4 + 0.5) * cw;
        const speed = 12 + i * 8;
        const ly = ((sc.timer * speed + i * 200) % (ch * 1.5)) - ch * 0.25;
        ctx.lineWidth = (0.5 + i * 0.4) * sc_;
        ctx.beginPath();
        ctx.moveTo(lx, ly);
        ctx.lineTo(lx + (Math.random()-0.5)*30*scX, ly + 60*scY);
        ctx.stroke();
      }
    }

    // Flying hero stickman
    const hsx = sc.heroScreenX * scX, hsy = sc.heroScreenY * scY;
    const angle = Math.atan2(
      sc.heroScreenY - sc.heroPrevY,
      sc.heroScreenX - sc.heroPrevX
    ) + Math.PI / 2;
    ctx.save();
    ctx.globalAlpha = sc.heroAlpha;
    ctx.translate(hsx, hsy);
    ctx.rotate(angle);
    const s = 18 * sc_;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.5 * sc_;
    ctx.beginPath(); ctx.moveTo(0, -s*1.6); ctx.lineTo(0, s*0.2); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, -s*2, s*0.5, 0, Math.PI*2);
    ctx.fillStyle = sc.hero.color || '#3399ff'; ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-s*0.9, -s*0.8); ctx.lineTo(s*0.9, -s*0.8); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, s*0.2); ctx.lineTo(-s*0.7, s*1.4);
    ctx.moveTo(0, s*0.2); ctx.lineTo(s*0.7, s*1.4);
    ctx.stroke();
    ctx.restore();
  }

  // ── CODEREALM: matrix rain + hero stickman + code nodes ────────────────────
  if (sc.phase === 'coderealm' || (sc.phase === 'return' && sc.rainAlpha > 0)) {
    // Black void
    ctx.globalAlpha = Math.min(sc.rainAlpha, 0.92);
    ctx.fillStyle   = 'rgba(0,0,0,0.88)';
    ctx.fillRect(0, 0, cw, ch);

    // Rain columns
    ctx.globalAlpha = sc.rainAlpha;
    ctx.font = `${Math.round(12 * sc_)}px monospace`;
    ctx.textAlign = 'left';
    for (const col of _tfeRainCols) {
      for (let j = 0; j < col.trail; j++) {
        const alpha = j === 0 ? 1.0 : (col.trail - j) / col.trail * 0.75;
        ctx.globalAlpha = sc.rainAlpha * alpha;
        ctx.fillStyle   = j === 0 ? '#ffffff' : _TFE_RAIN_COLORS[col.ci];
        ctx.fillText(col.chars[j % col.chars.length], col.x * scX, (col.y - j*14) * scY);
      }
    }

    if (sc.phase === 'coderealm') {
      // Code nodes
      for (const nd of sc.codeNodes) {
        const nx = nd.x * scX, ny = nd.y * scY;
        const pulse = 1 + Math.sin(nd.pulse) * 0.15;
        const r     = 22 * sc_ * pulse;
        ctx.globalAlpha = nd.corrupted ? 0.35 : 0.85;

        // Outer ring
        ctx.beginPath();
        ctx.arc(nx, ny, r * 1.5, 0, Math.PI*2);
        ctx.strokeStyle = nd.corrupted ? '#224422' : (nd.hitTimer > 0 ? '#ffffff' : '#00ff41');
        ctx.lineWidth   = 2 * sc_;
        ctx.stroke();

        // Fill
        ctx.beginPath();
        ctx.arc(nx, ny, r, 0, Math.PI*2);
        ctx.fillStyle = nd.corrupted ? 'rgba(0,40,0,0.5)' : 'rgba(0,255,65,0.12)';
        ctx.fill();
        ctx.strokeStyle = nd.corrupted ? '#006600' : '#00ff41';
        ctx.lineWidth = 1.5 * sc_;
        ctx.stroke();

        // Label
        ctx.font      = `bold ${Math.round(10 * sc_)}px monospace`;
        ctx.textAlign = 'center';
        ctx.fillStyle = nd.corrupted ? '#224422' : '#00ff41';
        ctx.shadowColor = nd.corrupted ? 'transparent' : '#00ff41';
        ctx.shadowBlur  = nd.corrupted ? 0 : 8;
        ctx.fillText(nd.label, nx, ny + 4 * sc_);
        ctx.shadowBlur  = 0;

        // Corrupted X
        if (nd.corrupted) {
          ctx.globalAlpha = 0.7;
          ctx.font      = `bold ${Math.round(22 * sc_)}px monospace`;
          ctx.fillStyle = '#ff0000';
          ctx.fillText('✕', nx, ny + 8 * sc_);
        }

        // Proximity ring for hero
        const dx = nd.x - sc.crHeroX, dy = nd.y - sc.crHeroY;
        const dist = Math.sqrt(dx*dx+dy*dy);
        if (!nd.corrupted && dist < 80) {
          ctx.globalAlpha = (1 - dist/80) * 0.55;
          ctx.beginPath();
          ctx.arc(nx, ny, r * 2.2 * (1 + (1-dist/80)*0.3), 0, Math.PI*2);
          ctx.strokeStyle = '#00ffcc';
          ctx.lineWidth   = 2 * sc_;
          ctx.stroke();
        }
      }

      // Node counter
      ctx.globalAlpha = 0.75;
      ctx.font      = `${Math.round(10 * sc_)}px monospace`;
      ctx.textAlign = 'left';
      ctx.fillStyle = '#00ff41';
      ctx.fillText(`NODES CORRUPTED: ${sc.nodesCorrupted}/5`, 14 * scX, 18 * scY);

      // Instruction
      if (sc.nodesCorrupted < 5) {
        ctx.globalAlpha = 0.6 + Math.sin(sc.timer * 0.12) * 0.3;
        ctx.font      = `${Math.round(9 * sc_)}px monospace`;
        ctx.textAlign = 'center';
        ctx.fillStyle = '#88ffaa';
        ctx.fillText('[ approach node + ATTACK to corrupt ]', cw/2, ch - 16*scY);
      } else {
        ctx.globalAlpha = 0.9;
        ctx.font      = `bold ${Math.round(14 * sc_)}px monospace`;
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = '#00ff41'; ctx.shadowBlur = 18;
        ctx.fillText('SYSTEM COLLAPSE INITIATED', cw/2, ch*0.5 - 20*scY);
        ctx.shadowBlur = 0;
      }

      // Hero stickman in coderealm
      const hsx = sc.crHeroX * scX, hsy = sc.crHeroY * scY;
      ctx.globalAlpha = 1.0;
      const s = 16 * sc_;
      ctx.strokeStyle = sc.hero.color || '#3399ff';
      ctx.lineWidth   = 2.5 * sc_;
      ctx.shadowColor = sc.hero.color || '#3399ff'; ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.moveTo(hsx, hsy - s*1.4); ctx.lineTo(hsx, hsy + s*0.3); ctx.stroke();
      ctx.beginPath(); ctx.arc(hsx, hsy - s*1.9, s*0.45, 0, Math.PI*2);
      ctx.fillStyle = sc.hero.color || '#3399ff'; ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(hsx - s*0.8, hsy - s*0.5); ctx.lineTo(hsx + s*0.8, hsy - s*0.5); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(hsx, hsy + s*0.3); ctx.lineTo(hsx - s*0.6, hsy + s*1.4);
      ctx.moveTo(hsx, hsy + s*0.3); ctx.lineTo(hsx + s*0.6, hsy + s*1.4);
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Flash on node corruption
      if (sc.crFlashTimer > 0) {
        ctx.globalAlpha = (sc.crFlashTimer / 20) * 0.38;
        ctx.fillStyle = '#00ff41';
        ctx.fillRect(0, 0, cw, ch);
      }
    }
  }

  // ── RETURN: dimensional tear entry ─────────────────────────────────────────
  if (sc.phase === 'return') {
    const hsx = GAME_W/2 * scX, hsy = sc.returnY * scY;
    // Tear effect at top
    ctx.globalAlpha = 0.7;
    const grd = ctx.createRadialGradient(hsx, 0, 0, hsx, 0, 80*scY);
    grd.addColorStop(0, 'rgba(100,0,200,0.8)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grd; ctx.fillRect(0, 0, cw, 120*scY);

    // Falling hero
    ctx.globalAlpha = 1;
    const s = 16 * sc_;
    ctx.strokeStyle = sc.hero.color || '#3399ff';
    ctx.lineWidth   = 2.5 * sc_;
    ctx.beginPath(); ctx.moveTo(hsx, hsy - s*1.4); ctx.lineTo(hsx, hsy + s*0.3); ctx.stroke();
    ctx.beginPath(); ctx.arc(hsx, hsy - s*1.9, s*0.45, 0, Math.PI*2);
    ctx.fillStyle = sc.hero.color || '#3399ff'; ctx.fill(); ctx.stroke();
    // Arms raised (falling pose)
    ctx.beginPath(); ctx.moveTo(hsx - s*1.0, hsy - s*1.0); ctx.lineTo(hsx + s*1.0, hsy - s*1.0); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(hsx, hsy + s*0.3); ctx.lineTo(hsx - s*0.6, hsy + s*1.4);
    ctx.moveTo(hsx, hsy + s*0.3); ctx.lineTo(hsx + s*0.6, hsy + s*1.4);
    ctx.stroke();
  }

  // ── FINISHER QTE ─────────────────────────────────────────────────────────────
  if (sc.phase === 'finisher') {
    const neededHits = 3;

    // Boss ragdoll draw (manual, detached from normal draw)
    if (sc.finisherBossAlpha > 0) {
      const bsx = sc.finisherBossX * scX, bsy = sc.finisherBossY * scY;
      const bs = 20 * sc_;
      const tilt = Math.sin(sc.timer * 0.25) * 0.4;
      ctx.save();
      ctx.translate(bsx, bsy);
      ctx.rotate(tilt);
      ctx.globalAlpha = sc.finisherBossAlpha * 0.9;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth   = 2.5 * sc_;
      ctx.fillStyle   = '#000000';
      ctx.beginPath(); ctx.moveTo(0, -bs*1.4); ctx.lineTo(0, bs*0.3); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, -bs*1.9, bs*0.45, 0, Math.PI*2); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-bs*0.8, -bs*0.5); ctx.lineTo(bs*0.8, -bs*0.5); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, bs*0.3); ctx.lineTo(-bs*0.6, bs*1.4);
      ctx.moveTo(0, bs*0.3); ctx.lineTo(bs*0.6, bs*1.4);
      ctx.stroke();
      ctx.restore();
    }

    // QTE prompt
    if (sc.finisherPrompt > 0 && sc.finisherHits < neededHits) {
      const promptIdx = sc.finisherHits;
      const pulse = 0.75 + Math.sin(sc.timer * 0.22) * 0.25;
      ctx.globalAlpha = pulse;
      ctx.font      = `bold ${Math.round(18 * sc_)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillStyle = _TFE_QTE_FLASH_COLORS[promptIdx] || '#ffffff';
      ctx.shadowColor = _TFE_QTE_FLASH_COLORS[promptIdx] || '#ffffff';
      ctx.shadowBlur  = 20;
      ctx.fillText(_TFE_QTE_PROMPTS[promptIdx] || '[ ATTACK ]', cw/2, ch * 0.84);
      ctx.shadowBlur  = 0;

      // Hit counter dots
      for (let i = 0; i < neededHits; i++) {
        const filled = i < sc.finisherHits;
        const dotX = cw/2 + (i - 1) * 28 * sc_;
        const dotY = ch * 0.91;
        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        ctx.arc(dotX, dotY, 8 * sc_, 0, Math.PI*2);
        ctx.fillStyle = filled ? '#ffffff' : 'rgba(255,255,255,0.25)';
        ctx.fill();
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5 * sc_;
        ctx.stroke();
      }
    }

    // Hit flash
    if (sc.finisherFlash > 0) {
      ctx.globalAlpha = (sc.finisherFlash / 22) * 0.45;
      ctx.fillStyle   = '#ffffff';
      ctx.fillRect(0, 0, cw, ch);
    }
  }

  // ── AURA orb + particles ─────────────────────────────────────────────────────
  if (sc.phase === 'aura') {
    const ax = sc.auraX * scX, ay = sc.auraY * scY;
    const r  = 28 * sc_;
    const pulse = 1 + Math.sin(sc.timer * 0.18) * 0.1;
    ctx.globalAlpha = 0.9;
    const grd = ctx.createRadialGradient(ax, ay, 0, ax, ay, r * 2.5 * pulse);
    grd.addColorStop(0,   'rgba(0,0,0,0.85)');
    grd.addColorStop(0.55,'rgba(20,20,40,0.6)');
    grd.addColorStop(1,   'rgba(0,0,0,0)');
    ctx.fillStyle = grd;
    ctx.beginPath(); ctx.arc(ax, ay, r * 2.5 * pulse, 0, Math.PI*2); ctx.fill();

    ctx.globalAlpha = 0.95;
    ctx.fillStyle   = '#080808';
    ctx.shadowColor = '#6600ff'; ctx.shadowBlur = 22;
    ctx.beginPath(); ctx.arc(ax, ay, r * pulse, 0, Math.PI*2); ctx.fill();
    ctx.shadowBlur = 0;

    for (const ap of _tfeAuraParticles) {
      ctx.globalAlpha = (ap.life / ap.maxLife) * 0.85;
      ctx.fillStyle   = Math.random() < 0.3 ? '#6600ff' : '#000000';
      ctx.beginPath(); ctx.arc(ap.x * scX, ap.y * scY, ap.r * sc_, 0, Math.PI*2); ctx.fill();
    }
  }

  // ── Hero aura glow (powers + fall) ────────────────────────────────────────────
  if (sc.hero._tfAuraGlow && (sc.phase === 'powers' || sc.phase === 'fall')) {
    const hsx = sc.hero.cx() * scX, hsy = sc.hero.cy() * scY;
    const glowR = 55 * sc_ * (1 + Math.sin(sc.timer * 0.12) * 0.15);
    ctx.globalAlpha = 0.55;
    const hgrd = ctx.createRadialGradient(hsx, hsy, 0, hsx, hsy, glowR);
    hgrd.addColorStop(0,   'rgba(80,0,180,0.55)');
    hgrd.addColorStop(0.6, 'rgba(20,0,60,0.25)');
    hgrd.addColorStop(1,   'rgba(0,0,0,0)');
    ctx.fillStyle = hgrd;
    ctx.beginPath(); ctx.arc(hsx, hsy, glowR, 0, Math.PI*2); ctx.fill();
  }

  // ── POWERS panel ─────────────────────────────────────────────────────────────
  if (sc.phase === 'powers' && sc.powersAlpha > 0) {
    ctx.globalAlpha = sc.powersAlpha;
    ctx.fillStyle   = 'rgba(0,0,10,0.78)';
    ctx.fillRect(0, 0, cw, ch);

    const baseY = ch * 0.32;
    const lineH = ch * 0.075;

    ctx.font      = `bold ${Math.round(ch * 0.044)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#8800ff'; ctx.shadowBlur = 26;
    ctx.fillText('POWERS GRANTED', cw/2, baseY);
    ctx.shadowBlur = 0;

    ctx.font      = `${Math.round(ch * 0.025)}px sans-serif`;
    ctx.fillStyle = 'rgba(180,140,255,0.9)';
    ctx.fillText('You have absorbed the void.', cw/2, baseY + lineH * 0.85);

    ctx.font = `bold ${Math.round(ch * 0.028)}px monospace`;
    for (let i = 0; i < sc.powersList.length; i++) {
      const alpha = Math.min(1, Math.max(0, (sc.timer - 30 - i*22)/28));
      ctx.globalAlpha = sc.powersAlpha * alpha;
      ctx.fillStyle   = '#00ffcc';
      ctx.shadowColor = '#00ffcc'; ctx.shadowBlur = 14;
      ctx.fillText(sc.powersList[i], cw/2, baseY + lineH * (2 + i));
      ctx.shadowBlur  = 0;
    }
    ctx.globalAlpha = sc.powersAlpha;

    if (sc.skippable) {
      ctx.font      = `${Math.round(ch * 0.018)}px sans-serif`;
      ctx.fillStyle = 'rgba(150,150,150,0.6)';
      ctx.fillText('[ Press any key to skip ]', cw/2, ch * 0.90);
    }
  }

  // ── FALL alpha ─────────────────────────────────────────────────────────────────
  if (sc.phase === 'fall') {
    ctx.globalAlpha = 1 - sc.heroFallAlpha;
    ctx.fillStyle   = '#000000';
    ctx.fillRect(0, 0, cw, ch);
  }

  // ── FADEOUT ───────────────────────────────────────────────────────────────────
  if (sc.phase === 'fadeout') {
    const frac = Math.min(1, sc.timer / 70);
    ctx.globalAlpha = frac;
    ctx.fillStyle   = '#000000';
    ctx.fillRect(0, 0, cw, ch);
  }

  ctx.globalAlpha  = 1;
  ctx.textBaseline = 'alphabetic';
  ctx.restore();
}

// ── Utilities ─────────────────────────────────────────────────────────────────
function _roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y,     x + w, y + r,     r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x,     y + h, x,     y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x,     y,     x + r, y,         r);
  ctx.closePath();
}

function _tfeCamFocus(x, y, zoom) {
  if (typeof cinematicCamOverride !== 'undefined') {
    cinematicCamOverride = true;
    cinematicFocusX      = x;
    cinematicFocusY      = y;
    cinematicZoomTarget  = zoom;
  }
}
