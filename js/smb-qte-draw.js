'use strict';
// smb-qte-draw.js — QTE draw functions: background, warp grid, clones, ripples, particles, prompts, HUD, combo text
// Depends on: smb-globals.js, smb-particles-core.js, smb-combat.js

// ── DRAW functions ────────────────────────────────────────────────────────────

function _drawQTEBackground(ctx, cw, ch) {
  const s = QTE_STATE;
  if (!s) return;

  const t = _qteTimeline;

  // Dark vignette
  if (_qteVoidAlpha > 0.01) {
    const vg = ctx.createRadialGradient(cw / 2, ch / 2, ch * 0.15, cw / 2, ch / 2, cw * 0.75);
    vg.addColorStop(0, `rgba(0,0,0,0)`);
    vg.addColorStop(1, `rgba(0,0,6,${_qteVoidAlpha.toFixed(2)})`);
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, cw, ch);
  }

  // Fractal star field (phase 3+)
  if (s.phase >= 3) {
    ctx.save();
    ctx.globalAlpha = 0.35 + s.chaosLevel * 0.25;
    const starCount = 60;
    for (let i = 0; i < starCount; i++) {
      // Deterministic pseudo-random using seed
      const sx = (Math.sin(i * 127.1 + _qteFractalSeed) * 0.5 + 0.5) * cw;
      const sy = (Math.sin(i * 311.7 + _qteFractalSeed) * 0.5 + 0.5) * ch;
      const sr = 0.8 + (Math.sin(i * 43.9 + t * 0.05) * 0.5 + 0.5) * 2.2;
      const sa = 0.4 + (Math.sin(i * 97.3 + t * 0.08) * 0.5 + 0.5) * 0.6;
      ctx.globalAlpha = sa * (0.35 + s.chaosLevel * 0.25);
      ctx.fillStyle   = _phaseColor(s.phase);
      ctx.beginPath();
      ctx.arc(sx, sy, sr, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // Scanline overlay
  if (_qteScanAlpha > 0.01) {
    ctx.save();
    const scanStep = 4;
    ctx.globalAlpha = _qteScanAlpha * (0.5 + 0.5 * Math.sin(t * 0.25));
    ctx.fillStyle   = `rgba(0,0,20,0.45)`;
    for (let sy = 0; sy < ch; sy += scanStep * 2) {
      ctx.fillRect(0, sy, cw, scanStep);
    }
    ctx.restore();
  }

  // Collapsing timeline arcs (phase 2+)
  if (s.phase >= 2) {
    ctx.save();
    ctx.globalAlpha = 0.18 + s.chaosLevel * 0.18;
    ctx.strokeStyle = _phaseColor(s.phase);
    ctx.lineWidth   = 1;
    for (let arc = 0; arc < 5; arc++) {
      const arcT    = (t * 0.01 + arc * 0.2) % 1;
      const arcR    = 80 + arc * 90 + arcT * 200;
      const arcA    = 0.6 - arcT * 0.6;
      ctx.globalAlpha = arcA * (0.18 + s.chaosLevel * 0.18);
      ctx.beginPath();
      ctx.arc(cw / 2, ch / 2, arcR, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }
}

function _drawQTEWarpGrid(ctx, cw, ch) {
  const s = QTE_STATE;
  if (!s || _qteScanAlpha < 0.05) return;
  const cols = 16, rows = 10;

  ctx.save();
  ctx.globalAlpha = 0.08 + s.chaosLevel * 0.10;
  ctx.strokeStyle = _phaseColor(s.phase);
  ctx.lineWidth   = 0.7;

  // Draw grid lines between adjacent nodes
  for (let row = 0; row <= rows; row++) {
    ctx.beginPath();
    for (let col = 0; col <= cols; col++) {
      const idx = row * (cols + 1) + col;
      const n   = _qteWarpGrid[idx];
      if (!n) continue;
      if (col === 0) ctx.moveTo(n.x, n.y);
      else            ctx.lineTo(n.x, n.y);
    }
    ctx.stroke();
  }
  for (let col = 0; col <= cols; col++) {
    ctx.beginPath();
    for (let row = 0; row <= rows; row++) {
      const idx = row * (cols + 1) + col;
      const n   = _qteWarpGrid[idx];
      if (!n) continue;
      if (row === 0) ctx.moveTo(n.x, n.y);
      else            ctx.lineTo(n.x, n.y);
    }
    ctx.stroke();
  }
  ctx.restore();
}

function _drawQTEClones(ctx, cw, ch) {
  const s = QTE_STATE;
  if (!s || !s.playerRef) return;

  const p = s.playerRef;
  ctx.save();

  // Draw 3 mirrored silhouettes at offset positions
  const offsets = [[-180, -20, -1], [180, 20, 1], [0, -60, 1]];
  offsets.forEach(([ox, oy, scaleX]) => {
    ctx.save();
    ctx.globalAlpha = _qteCloneAlpha * 0.45;
    ctx.fillStyle   = _phaseColor(s.phase);

    // Convert game coords to screen
    const gScX = canvas.width  / GAME_W;
    const gScY = canvas.height / GAME_H;
    const sx   = (p.x + p.w / 2) * gScX + ox;
    const sy   = p.y * gScY + oy;
    const sw   = p.w * gScX * 1.1;
    const sh   = p.h * gScY * 1.1;

    ctx.translate(sx, sy);
    ctx.scale(scaleX, 1);
    ctx.shadowColor = _phaseColor(s.phase);
    ctx.shadowBlur  = 12;

    // Simple stickman silhouette
    ctx.fillRect(-sw / 2, 0, sw, sh);
    ctx.restore();
  });

  ctx.restore();
}

function _drawQTERipples(ctx) {
  ctx.save();
  for (const r of _qteRipples) {
    ctx.strokeStyle = r.color;
    ctx.lineWidth   = 2;
    ctx.globalAlpha = r.alpha;
    ctx.shadowColor = r.color;
    ctx.shadowBlur  = 8;
    ctx.beginPath();
    ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function _drawQTEParticles(ctx) {
  ctx.save();
  for (const p of _qteParticles) {
    ctx.globalAlpha  = p.alpha;
    ctx.fillStyle    = p.color;
    ctx.shadowColor  = p.color;
    ctx.shadowBlur   = 6;
    ctx.beginPath();
    ctx.arc(p.x, p.y, Math.max(0.1, p.r), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.shadowBlur = 0;
  ctx.restore();
}

function _drawQTEPrompts(ctx, cw, ch) {
  const s = QTE_STATE;
  if (!s) return;

  const now = _qteTimeline;

  for (const prompt of s.prompts) {
    if (prompt.missed) {
      _drawPromptBubble(ctx, prompt, 'missed', now);
    } else if (prompt.hit) {
      _drawPromptBubble(ctx, prompt, 'hit', now);
    } else {
      _drawPromptBubble(ctx, prompt, 'active', now);
    }
  }
}

function _drawPromptBubble(ctx, prompt, state, now) {
  const { x, y, timer, maxTimer, displayLabel, isMirrored } = prompt;

  ctx.save();

  const pct      = timer / maxTimer;        // 0 = just appeared, 1 = about to expire
  const pulse    = 0.88 + Math.sin((prompt.pulseT || 0) * 2.8) * 0.12;
  const baseR    = 38 * pulse;
  const urgency  = pct > 0.65 ? (pct - 0.65) / 0.35 : 0; // 0-1, ramps in last 35%

  // Colour based on state
  let fillColor, strokeColor, textColor;
  if (state === 'hit') {
    fillColor   = 'rgba(80,255,140,0.25)';
    strokeColor = '#44ff88';
    textColor   = '#88ffcc';
  } else if (state === 'missed') {
    fillColor   = 'rgba(255,30,50,0.20)';
    strokeColor = '#ff2244';
    textColor   = '#ff6677';
  } else {
    // Urgency tint: white → yellow → red
    const ur = Math.round(200 + urgency * 55);
    const ug = Math.round(220 - urgency * 150);
    const ub = Math.round(255 - urgency * 255);
    fillColor   = isMirrored
      ? `rgba(140,0,200,${0.18 + urgency * 0.25})`
      : `rgba(${ur},${ug},${ub},${0.12 + urgency * 0.28})`;
    strokeColor = isMirrored ? '#cc44ff' : `rgb(${ur},${ug},${ub})`;
    textColor   = '#ffffff';
  }

  // Drop shadow glow
  ctx.shadowColor = strokeColor;
  ctx.shadowBlur  = 14 + urgency * 12;

  // Circle background
  ctx.globalAlpha = state === 'missed' ? 0.4 : (state === 'hit' ? 0.6 : 1.0);
  ctx.fillStyle   = fillColor;
  ctx.beginPath();
  ctx.arc(x, y, baseR, 0, Math.PI * 2);
  ctx.fill();

  // Stroke ring
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth   = 2.5 + urgency * 2;
  ctx.beginPath();
  ctx.arc(x, y, baseR, 0, Math.PI * 2);
  ctx.stroke();

  // Countdown ring (shrinking arc)
  if (state === 'active') {
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth   = 4;
    ctx.globalAlpha = 0.55 + urgency * 0.3;
    ctx.beginPath();
    ctx.arc(x, y, baseR + 6, -Math.PI / 2, -Math.PI / 2 + (1 - pct) * Math.PI * 2);
    ctx.stroke();
  }

  // Key label
  ctx.globalAlpha = state === 'missed' ? 0.4 : 1.0;
  ctx.fillStyle   = textColor;
  ctx.shadowBlur  = 8;
  ctx.font        = `bold ${displayLabel.length > 2 ? 11 : 20}px "Segoe UI", Arial, sans-serif`;
  ctx.textAlign   = 'center';
  ctx.textBaseline= 'middle';
  ctx.fillText(displayLabel, x, y);

  // "MIRRORED" badge for phase 2+ mirrored prompts
  if (isMirrored && state === 'active') {
    ctx.font        = '8px Arial';
    ctx.fillStyle   = '#cc88ff';
    ctx.shadowBlur  = 4;
    ctx.fillText('MIRRORED', x, y + baseR + 10);
  }

  // Hit checkmark
  if (state === 'hit') {
    ctx.font      = 'bold 22px Arial';
    ctx.fillStyle = '#44ff88';
    ctx.fillText('✓', x, y + baseR - 8);
  }

  ctx.shadowBlur = 0;
  ctx.restore();
}

function _drawQTEHUD(ctx, cw, ch) {
  const s = QTE_STATE;
  if (!s) return;

  ctx.save();

  // Phase name (top center)
  const phaseAlpha = s.stage === 'intro'
    ? Math.min(1, s.introTimer / 40)
    : (s.stage === 'outro_success' ? Math.max(0, 1 - s.outroTimer / 40) : 1.0);

  ctx.globalAlpha = phaseAlpha;
  ctx.font        = 'bold 28px "Segoe UI", Arial, sans-serif';
  ctx.textAlign   = 'center';
  ctx.fillStyle   = _phaseColor(s.phase);
  ctx.shadowColor = _phaseColor(s.phase);
  ctx.shadowBlur  = 20;

  // Glitch offset on phase 3/4
  const glitchX = s.phase >= 3 ? (Math.random() - 0.5) * 3 * s.chaosLevel : 0;
  const glitchY = s.phase >= 3 ? (Math.random() - 0.5) * 2 * s.chaosLevel : 0;

  ctx.fillText(s.def.name, cw / 2 + glitchX, 46 + glitchY);

  // Subtitle
  if (s.stage === 'intro' || s.stage === 'prompts') {
    ctx.font        = '14px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle   = 'rgba(200,200,255,0.75)';
    ctx.shadowBlur  = 6;
    ctx.globalAlpha = phaseAlpha * 0.8;
    ctx.fillText(s.def.subtitle, cw / 2, 68);
  }

  // Progress dots (sequential mode)
  if (!s.def.simultaneous && s.promptQueue.length > 0) {
    const total     = s.promptQueue.length;
    const dotR      = 5;
    const dotSpacing= 16;
    const totalW    = (total - 1) * dotSpacing;
    const startX    = cw / 2 - totalW / 2;
    const dotY      = ch - 30;

    ctx.shadowBlur  = 6;
    for (let i = 0; i < total; i++) {
      const pq = s.promptQueue[i];
      const dx = startX + i * dotSpacing;

      if (pq.hit) {
        ctx.globalAlpha = phaseAlpha;
        ctx.fillStyle   = '#44ff88';
        ctx.shadowColor = '#44ff88';
      } else if (pq.missed) {
        ctx.globalAlpha = phaseAlpha * 0.6;
        ctx.fillStyle   = '#ff2244';
        ctx.shadowColor = '#ff2244';
      } else if (i === s.promptIdx - 1 || s.prompts.includes(pq)) {
        ctx.globalAlpha = phaseAlpha;
        ctx.fillStyle   = _phaseColor(s.phase);
        ctx.shadowColor = _phaseColor(s.phase);
      } else {
        ctx.globalAlpha = phaseAlpha * 0.25;
        ctx.fillStyle   = '#aaaacc';
        ctx.shadowColor = 'transparent';
      }

      ctx.beginPath();
      ctx.arc(dx, dotY, dotR, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Chaos level warning (phase 3/4)
  if (s.chaosLevel > 0.1 && (s.phase >= 3)) {
    ctx.globalAlpha = phaseAlpha * s.chaosLevel;
    ctx.font        = '11px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle   = '#ff6644';
    ctx.shadowColor = '#ff2200';
    ctx.shadowBlur  = 10;
    ctx.textAlign   = 'right';
    ctx.fillText(`CHAOS LEVEL ${Math.round(s.chaosLevel * 100)}%`, cw - 24, ch - 20);
  }

  ctx.shadowBlur = 0;
  ctx.restore();
}

function _drawQTEComboText(ctx, cw, ch) {
  if (!_qteComboText) return;
  const ct = _qteComboText;
  const alpha = Math.min(1, ct.timer / 20) * Math.min(1, (ct.timer) / 10);

  ctx.save();
  ctx.globalAlpha  = alpha;
  ctx.font         = 'bold 22px "Segoe UI", Arial, sans-serif';
  ctx.textAlign    = 'center';
  ctx.fillStyle    = ct.color;
  ctx.shadowColor  = ct.color;
  ctx.shadowBlur   = 16;

  // Rise upward as timer decreases
  const rise = (1 - ct.timer / 60) * 18;
  ctx.fillText(ct.text, ct.x, ct.y - rise);
  ctx.restore();
}

// ── HTML load: add QTE script tag to index.html integration point ─────────────
// In index.html, add before smc-loop.js:
//   <script src="js/smc-qte.js"></script>
//
// In smc-loop.js gameLoop(), add after storyCheckEvents line:
//   if (gameMode === 'trueform') updateQTE();
//
// In smc-loop.js screen-space draw section (after drawStoryWorldDistortion):
//   if (gameMode === 'trueform' && typeof drawQTE === 'function')
//     drawQTE(ctx, canvas.width, canvas.height);
//
// In smc-boss.js resetTFState():
//   if (typeof resetQTEState === 'function') resetQTEState();
//
// Cheat code (add to smc-loop.js cheat handler):
//   } else if (code.startsWith('QTE')) {
//     const ph = parseInt(code.slice(3));
//     if (ph >= 1 && ph <= 4 && typeof triggerQTEPhase === 'function') {
//       triggerQTEPhase(ph); ok('QTE Phase ' + ph);
//     }
//   }
