'use strict';
// smb-drawing-hud.js — Story subtitle, objective HUD, cinematic letterbox, story opponent name HUD
// Depends on: smb-globals.js, smb-data-arenas.js, smb-particles-core.js

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

