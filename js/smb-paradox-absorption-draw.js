'use strict';
// smb-paradox-absorption-draw.js — Absorption draw with ctx arg, memories draw, KC overlay update+draw
// Depends on: smb-globals.js, smb-paradox-class.js (and preceding splits in chain)

// ABSORPTION SCENE (ctx-param version) — strong visual clarity
// Called from smb-drawing.js / smb-loop.js with explicit ctx arg.
// The no-arg drawTFAbsorptionScene() above handles in-loop calls.
// ============================================================
function drawTFAbsorptionSceneWithCtx(ctx) {
  const sc = tfAbsorptionScene;
  if (!sc) return;

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  // Dark overlay — deepens during flash
  ctx.globalAlpha = 1;
  ctx.fillStyle = `rgba(0,0,0,${0.6 + sc.flashAlpha * 0.4})`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // --------------------------------------------------
  // MEMORY PHASE
  if (sc.phase === 'memories') {
    drawTFAbsorptionMemories(ctx, sc);
  }

  // --------------------------------------------------
  // MERGE EFFECT — purple tint signals convergence
  if (sc.phase === 'merge') {
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = '#aa55ff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  // --------------------------------------------------
  // POWER SURGE — white flash at peak intensity
  if (sc.phase === 'power_surge') {
    ctx.globalAlpha = sc.flashAlpha;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  ctx.restore();
}

// ============================================================
// ABSORPTION MEMORY FLASHES  — Paradox backstory visual flashes
// Shown in sequence during the absorption scene after Paradox dies.
// Each flash is a brief, fragmented glimpse — enough for the player
// to piece together what Paradox was and why it fought.
//
// CANON: Paradox was constructed during the multiversal war to fight
// beside Axiom. An error in its design caused it to turn against
// everything. It was not malicious — it was broken. It has been
// fighting since the error, unable to stop.
// ============================================================
function drawTFAbsorptionMemories(ctx, sc) {
  // Cycle through 7 memories (length of _TF_ABSORPTION_MEMORIES)
  const t = sc.memoryIndex % 7;

  ctx.save();
  ctx.globalAlpha = 0.72;

  switch (t) {

    case 0:
      // Flash 1: Construction — clean, cold, clinical. Paradox was made deliberately.
      ctx.font = 'bold 13px monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#aaddff';
      ctx.shadowColor = '#aaddff';
      ctx.shadowBlur = 10;
      ctx.fillText('UNIT DESIGNATION: PARADOX', GAME_W / 2, GAME_H / 2 - 20);
      ctx.fillText('PURPOSE: COMBAT AUXILIARY', GAME_W / 2, GAME_H / 2);
      ctx.fillText('CREATOR: AXIOM', GAME_W / 2, GAME_H / 2 + 20);
      break;

    case 1:
      // Flash 2: Paradox and Axiom, side by side.
      // Two stickman silhouettes standing together.
      ctx.fillStyle = '#aaddff';
      ctx.shadowColor = '#aaddff';
      ctx.shadowBlur = 14;
      // Axiom (left)
      const ax = GAME_W / 2 - 40;
      ctx.beginPath(); ctx.arc(ax, GAME_H / 2 - 55, 7, 0, Math.PI * 2); ctx.fill();
      ctx.lineWidth = 2.5; ctx.strokeStyle = '#aaddff';
      ctx.beginPath();
      ctx.moveTo(ax, GAME_H / 2 - 48); ctx.lineTo(ax, GAME_H / 2 - 22);
      ctx.moveTo(ax - 12, GAME_H / 2 - 40); ctx.lineTo(ax + 12, GAME_H / 2 - 40);
      ctx.moveTo(ax, GAME_H / 2 - 22); ctx.lineTo(ax - 9, GAME_H / 2 - 5);
      ctx.moveTo(ax, GAME_H / 2 - 22); ctx.lineTo(ax + 9, GAME_H / 2 - 5);
      ctx.stroke();
      ctx.font = '11px sans-serif'; ctx.fillStyle = '#aaddff';
      ctx.fillText('AXIOM', ax, GAME_H / 2 - 70);
      // Paradox (right) — slightly glitched outline
      const px2 = GAME_W / 2 + 40;
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = '#aa55ff'; ctx.shadowColor = '#aa55ff'; ctx.shadowBlur = 18;
      ctx.beginPath(); ctx.arc(px2, GAME_H / 2 - 55, 7, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#aa55ff';
      ctx.beginPath();
      ctx.moveTo(px2, GAME_H / 2 - 48); ctx.lineTo(px2, GAME_H / 2 - 22);
      ctx.moveTo(px2 - 12, GAME_H / 2 - 40); ctx.lineTo(px2 + 12, GAME_H / 2 - 40);
      ctx.moveTo(px2, GAME_H / 2 - 22); ctx.lineTo(px2 - 9, GAME_H / 2 - 5);
      ctx.moveTo(px2, GAME_H / 2 - 22); ctx.lineTo(px2 + 9, GAME_H / 2 - 5);
      ctx.stroke();
      ctx.font = '11px sans-serif'; ctx.fillStyle = '#aa55ff';
      ctx.fillText('PARADOX', px2, GAME_H / 2 - 70);
      break;

    case 2:
      // Flash 3: The error — red diagnostic text, glitchy
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ff4444';
      ctx.shadowColor = '#ff4444';
      ctx.shadowBlur = 20;
      ctx.fillText('CRITICAL ERROR', GAME_W / 2, GAME_H / 2 - 22);
      ctx.globalAlpha = 0.5;
      ctx.font = '11px monospace';
      ctx.fillStyle = '#ff8888';
      ctx.fillText('LOYALTY DIRECTIVE: CORRUPTED', GAME_W / 2, GAME_H / 2 + 2);
      ctx.fillText('TARGET LOCK: ALL', GAME_W / 2, GAME_H / 2 + 20);
      break;

    case 3:
      // Flash 4: Paradox turns — silhouette facing away, hostile aura
      ctx.strokeStyle = '#ff4444';
      ctx.lineWidth = 2.5;
      ctx.shadowColor = '#ff4444';
      ctx.shadowBlur = 22;
      // Paradox silhouette facing away (mirrored arms — aggressive stance)
      const px3 = GAME_W / 2;
      ctx.fillStyle = '#ff4444';
      ctx.beginPath(); ctx.arc(px3, GAME_H / 2 - 55, 7, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(px3, GAME_H / 2 - 48); ctx.lineTo(px3, GAME_H / 2 - 20);
      ctx.moveTo(px3 - 16, GAME_H / 2 - 36); ctx.lineTo(px3 + 16, GAME_H / 2 - 36); // arms wide
      ctx.moveTo(px3, GAME_H / 2 - 20); ctx.lineTo(px3 - 10, GAME_H / 2 - 4);
      ctx.moveTo(px3, GAME_H / 2 - 20); ctx.lineTo(px3 + 10, GAME_H / 2 - 4);
      ctx.stroke();
      ctx.font = '11px monospace'; ctx.textAlign = 'center';
      ctx.fillStyle = '#ff6666'; ctx.globalAlpha = 0.6;
      ctx.fillText('TARGET: AXIOM', px3, GAME_H / 2 + 14);
      break;

    case 4:
      // Flash 5: A voice — first person. Brief. Incomplete.
      ctx.font = 'italic 15px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ccaaff';
      ctx.shadowColor = '#aa55ff';
      ctx.shadowBlur = 16;
      ctx.fillText('"I was not supposed to be the enemy."', GAME_W / 2, GAME_H / 2);
      break;

    case 5:
      // Flash 6: The war — Paradox fighting alone, endless. Abstract.
      ctx.font = 'bold 20px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ff8844';
      ctx.shadowColor = '#ff6600';
      ctx.shadowBlur = 18;
      ctx.fillText('FIGHT.', GAME_W / 2, GAME_H / 2 - 10);
      ctx.globalAlpha = 0.4;
      ctx.font = '11px monospace';
      ctx.fillStyle = '#ffaa66';
      ctx.fillText('ITERATION: ???', GAME_W / 2, GAME_H / 2 + 16);
      break;

    case 6:
      // Flash 7: The end. Final words. Fades with purpose.
      ctx.font = 'italic 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#88ccff';
      ctx.shadowColor = '#44aaff';
      ctx.shadowBlur = 14;
      ctx.fillText('"Remember what I was before the mistake."', GAME_W / 2, GAME_H / 2);
      break;
  }

  ctx.restore();
}

// ============================================================
// TF-KILLS-PARADOX OVERLAY  — update + draw helpers
// ============================================================
function updateTFKCOverlay() {
  if (!_tfKCOverlay) return;
  const o = _tfKCOverlay;
  o.frame = (o.frame || 0) + 1;

  // Fade distortion lines
  for (let i = o.distortLines.length - 1; i >= 0; i--) {
    o.distortLines[i].alpha -= 0.028;
    if (o.distortLines[i].alpha <= 0) o.distortLines.splice(i, 1);
  }

  // Fade reality tears
  for (let i = o.realityTears.length - 1; i >= 0; i--) {
    o.realityTears[i].alpha -= 0.022;
    if (o.realityTears[i].alpha <= 0) o.realityTears.splice(i, 1);
  }

  // Slide terminal panel in
  if (o.termVisible && o.termSlide < 1) {
    o.termSlide = Math.min(1, (o.termSlide || 0) + 0.075);
  }

  // Terminal cursor blink
  o.termCursorTimer = (o.termCursorTimer || 0) + 1;

  // Terminal typing: advance reveal counts
  if (o.termLines) {
    o.termTimer = (o.termTimer || 0) + 1;
    for (const line of o.termLines) {
      if (line.isProgress) continue;
      if (o.termTimer >= line.delay && line.revealCount < line.text.length) {
        line.revealCount = Math.min(line.text.length, line.revealCount + 2);
      }
    }
    // Progress bar
    if (o.termProgressStart !== undefined && o.termTimer >= o.termProgressStart && o.termProgress < 100) {
      o.termProgress = Math.min(100, (o.termProgress || 0) + (100 / 72));
    }
  }
}

function drawTFKCOverlay() {
  if (!_tfKCOverlay) return;
  const o = _tfKCOverlay;
  const frame = o.frame || 0;

  // ── WORLD SPACE: lock rings around Paradox ──────────────────
  if (o.lockActive && paradoxEntity && (o.lockAlpha || 0) > 0) {
    const px = paradoxEntity.cx();
    const py = paradoxEntity.cy();
    const pulse = 0.6 + Math.sin(frame * 0.18) * 0.4;
    ctx.save();
    for (let i = 0; i < 3; i++) {
      const r = 28 + i * 14 + Math.sin(frame * 0.12 + i) * 4;
      ctx.globalAlpha = o.lockAlpha * pulse * (1 - i * 0.25);
      ctx.strokeStyle = i % 2 === 0 ? '#00ffff' : '#aa44ff';
      ctx.lineWidth   = 3 - i * 0.7;
      ctx.shadowColor = '#00ffff';
      ctx.shadowBlur  = 14;
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    // Rotating tick marks (lock teeth)
    ctx.globalAlpha = o.lockAlpha * 0.7;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth   = 2;
    ctx.shadowBlur  = 6;
    const outerR = 56;
    for (let ti = 0; ti < 8; ti++) {
      const angle = (ti / 8) * Math.PI * 2 + frame * 0.04;
      const x1 = px + Math.cos(angle) * (outerR - 5);
      const y1 = py + Math.sin(angle) * (outerR - 5);
      const x2 = px + Math.cos(angle) * (outerR + 5);
      const y2 = py + Math.sin(angle) * (outerR + 5);
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    }
    ctx.restore();
  }

  // ── SCREEN SPACE ────────────────────────────────────────────
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const sw = canvas.width, sh = canvas.height;

  // Horizontal energy distortion lines
  for (const dl of o.distortLines) {
    if (dl.alpha <= 0) continue;
    ctx.save();
    ctx.globalAlpha = dl.alpha;
    ctx.strokeStyle = dl.color;
    ctx.lineWidth   = dl.width;
    ctx.shadowColor = dl.color;
    ctx.shadowBlur  = 8;
    ctx.beginPath();
    ctx.moveTo(dl.x1 * sw, dl.y * sh);
    ctx.lineTo(dl.x2 * sw, dl.y * sh);
    ctx.stroke();
    ctx.restore();
  }

  // Vertical reality tear cracks
  for (const rt of o.realityTears) {
    if (rt.alpha <= 0) continue;
    ctx.save();
    const cx = rt.x * sw;
    // Wide bleed glow first
    ctx.globalAlpha = rt.alpha * 0.35;
    ctx.strokeStyle = '#ff00ff';
    ctx.lineWidth   = 10;
    ctx.shadowColor = '#aa00ff';
    ctx.shadowBlur  = 28;
    ctx.beginPath();
    ctx.moveTo(cx, sh * 0.08);
    let cy2 = sh * 0.08;
    while (cy2 < sh * 0.92) {
      cy2 += sh * 0.06;
      ctx.lineTo(cx + Math.sin(cy2 * rt.seed * 0.01) * sw * 0.012, cy2);
    }
    ctx.stroke();
    // Sharp white crack on top
    ctx.globalAlpha = rt.alpha;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth   = 1.5;
    ctx.shadowBlur  = 0;
    ctx.beginPath();
    cy2 = sh * 0.08;
    ctx.moveTo(cx, cy2);
    while (cy2 < sh * 0.92) {
      cy2 += sh * 0.06;
      ctx.lineTo(cx + Math.sin(cy2 * rt.seed * 0.01) * sw * 0.012, cy2);
    }
    ctx.stroke();
    ctx.restore();
  }

  // Terminal panel
  if (o.termVisible && o.termLines) {
    const slide   = o.termSlide || 0;
    const panW    = Math.round(sw * 0.33);
    const panH    = Math.round(sh * 0.31);
    const panX    = sw - panW - Math.round(sw * 0.02) + Math.round((1 - slide) * (panW + 50));
    const panY    = Math.round(sh * 0.06);
    const lineH   = Math.round(panH / (o.termLines.length + 2.5));
    const fSize   = Math.max(9, Math.round(sw * 0.012));

    ctx.save();
    // Background
    ctx.globalAlpha = 0.93 * slide;
    ctx.fillStyle   = '#000c12';
    ctx.strokeStyle = '#00ffcc';
    ctx.lineWidth   = 2;
    ctx.shadowColor = '#00ffcc';
    ctx.shadowBlur  = 20;
    ctx.beginPath();
    ctx.rect(panX, panY, panW, panH);
    ctx.fill();
    ctx.stroke();

    // Header bar
    ctx.shadowBlur  = 0;
    ctx.fillStyle   = '#00281c';
    ctx.fillRect(panX + 1, panY + 1, panW - 2, Math.round(lineH * 1.25));

    ctx.globalAlpha = slide;
    ctx.fillStyle   = '#00ffcc';
    ctx.font        = `bold ${fSize}px monospace`;
    ctx.textAlign   = 'left';
    ctx.shadowColor = '#00ffcc';
    ctx.shadowBlur  = 8;
    ctx.fillText('  REALITY.EXE  v\u221e.0', panX + 10, panY + Math.round(lineH * 0.88));

    // Separator line
    ctx.globalAlpha = 0.45 * slide;
    ctx.strokeStyle = '#00ffcc';
    ctx.lineWidth   = 1;
    ctx.shadowBlur  = 0;
    ctx.beginPath();
    ctx.moveTo(panX, panY + Math.round(lineH * 1.25));
    ctx.lineTo(panX + panW, panY + Math.round(lineH * 1.25));
    ctx.stroke();

    // Lines
    ctx.font      = `${fSize}px monospace`;
    ctx.textAlign = 'left';
    for (let li = 0; li < o.termLines.length; li++) {
      const line = o.termLines[li];
      const ly   = panY + Math.round(lineH * (li + 2.15));

      // Progress bar (special)
      if (line.isProgress) {
        const prog  = Math.min(1, (o.termProgress || 0) / 100);
        if (prog <= 0) continue;
        const barW  = Math.round(panW * 0.60);
        const barX  = panX + 14;
        const barY2 = ly - Math.round(fSize * 0.75);
        const barH2 = Math.round(fSize * 1.05);
        ctx.globalAlpha = slide;
        ctx.fillStyle   = '#001a0f';
        ctx.fillRect(barX, barY2, barW, barH2);
        ctx.fillStyle   = prog >= 1 ? '#ff3344' : '#00ffcc';
        ctx.fillRect(barX, barY2, Math.round(barW * prog), barH2);
        ctx.strokeStyle = '#00ffcc';
        ctx.lineWidth   = 1;
        ctx.strokeRect(barX, barY2, barW, barH2);
        ctx.fillStyle   = '#ffffff';
        ctx.shadowBlur  = 0;
        ctx.fillText(`  ${Math.round((o.termProgress || 0))}%`, barX + barW + 6, ly);
        continue;
      }

      if (line.revealCount <= 0) continue;
      const revealed = line.text.substring(0, line.revealCount);
      ctx.globalAlpha = slide;
      ctx.fillStyle   = line.color || '#00ffcc';
      ctx.shadowColor = line.color || '#00ffcc';
      ctx.shadowBlur  = 5;
      ctx.fillText(revealed, panX + 14, ly);

      // Blinking cursor on actively-typing line
      if (line.revealCount < line.text.length && Math.floor((o.termCursorTimer || 0) / 14) % 2 === 0) {
        const tw = ctx.measureText(revealed).width;
        ctx.fillStyle  = '#00ffcc';
        ctx.shadowBlur = 0;
        ctx.fillRect(panX + 14 + tw + 1, ly - Math.round(fSize * 0.85), 5, fSize);
      }
    }
    ctx.restore();
  }

  ctx.restore(); // end screen-space
}

