'use strict';
// smb-debug-overlay.js — Debug HUD, sanity checks, debug menu panel
// Depends on: smb-globals.js, smb-state.js
// Must load BEFORE smb-debug-console.js

// ============================================================
// DEVELOPER DEBUG TOOLKIT
// Toggle with F1 key. Slow motion with F2.
// Hidden activation: type "debugmode" anywhere.
// ============================================================

// ---- FPS tracker ----
let _dbgFpsFrames  = 0;
let _dbgFpsTimer   = 0;
let _dbgFpsCurrent = 0;
let _dbgLastTs     = performance.now();

function _dbgTickFps() {
  const now = performance.now();
  const dt  = now - _dbgLastTs;
  _dbgLastTs = now;
  _dbgFpsFrames++;
  _dbgFpsTimer += dt;
  if (_dbgFpsTimer >= 500) {
    _dbgFpsCurrent = Math.round(_dbgFpsFrames / (_dbgFpsTimer / 1000));
    _dbgFpsFrames  = 0;
    _dbgFpsTimer   = 0;
  }
}

// ---- Sanity checks ----
function runSanityChecks() {
  const all = [...players, ...minions, ...trainingDummies];
  for (const p of all) {
    if (p.health <= 0) continue;
    if (isNaN(p.x) || isNaN(p.y) || !isFinite(p.x) || !isFinite(p.y)) {
      console.warn('[DBG] Bad position on', p.name || 'fighter', { x: p.x, y: p.y });
      p.x = GAME_W / 2; p.y = 200; p.vx = 0; p.vy = 0;
    }
    if (isNaN(p.vx) || isNaN(p.vy) || !isFinite(p.vx) || !isFinite(p.vy)) {
      console.warn('[DBG] NaN/Inf velocity on', p.name || 'fighter', { vx: p.vx, vy: p.vy });
      p.vx = 0; p.vy = 0;
    }
    if (isNaN(p.health) || p.health < 0) {
      console.warn('[DBG] Invalid health on', p.name || 'fighter', p.health);
      p.health = isNaN(p.health) ? (p.maxHealth || 100) : 0;
    }
    // Bot stuck detection
    if (p.isAI && !p.isBoss) {
      p._dbgStuckTimer = p._dbgStuckTimer || 0;
      p._dbgLastX      = p._dbgLastX !== undefined ? p._dbgLastX : p.x;
      if (Math.abs(p.x - p._dbgLastX) < 2) {
        p._dbgStuckTimer++;
        if (p._dbgStuckTimer > 120) { // 2 seconds
          p.aiState        = 'chase';
          p._wanderDir     = (Math.random() < 0.5 ? -1 : 1);
          p._wanderTimer   = 60;
          p._dbgStuckTimer = 0;
        }
      } else {
        p._dbgStuckTimer = 0;
      }
      p._dbgLastX = p.x;
    }
    // Target revalidation
    if (p.isAI && p.target) {
      if (p.target.health <= 0 || !players.includes(p.target) && !trainingDummies.includes(p.target) && !minions.includes(p.target)) {
        // Re-assign nearest living target
        const living = [...players, ...trainingDummies].filter(q => q !== p && q.health > 0);
        p.target = living.length ? living.reduce((a, b) => Math.hypot(b.cx()-p.cx(),b.cy()-p.cy()) < Math.hypot(a.cx()-p.cx(),a.cy()-p.cy()) ? b : a) : null;
      }
    }
  }
}

// ---- Render debug overlay ----
function renderDebugOverlay(ctx) {
  _dbgTickFps();

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  // Top-left info panel
  const f1 = showHitboxes       ? '[ON]' : '[off]';
  const f2 = showCollisionBoxes ? '[ON]' : '[off]';
  const f3 = showPhysicsInfo    ? '[ON]' : '[off]';
  const _dbgTop = 72; // below the HUD top bar (~65-70px)
  ctx.fillStyle = 'rgba(0,0,0,0.78)';
  ctx.fillRect(4, _dbgTop, 230, 110);
  ctx.strokeStyle = '#0f0';
  ctx.lineWidth   = 1;
  ctx.strokeRect(4, _dbgTop, 230, 110);

  ctx.font      = '11px monospace';
  ctx.fillStyle = '#0f0';
  ctx.textAlign = 'left';
  ctx.fillText(`SMC ${typeof GAME_VERSION !== 'undefined' ? GAME_VERSION : ''}  FPS: ${_dbgFpsCurrent}  ts:${timeScale.toFixed(2)}`, 10, _dbgTop + 16);
  ctx.fillText(`Players: ${players.length}  Minions: ${minions.length}  Bots: ${[...players,...trainingDummies].filter(p=>p.isAI).length}`, 10, _dbgTop + 30);
  ctx.fillText(`Proj: ${projectiles.length}  Particles: ${particles.length}  Frame: ${frameCount}`, 10, _dbgTop + 44);
  ctx.fillText(`Arena: ${currentArenaKey}  Mode: ${gameMode}`, 10, _dbgTop + 58);
  ctx.fillText(`Beams: ${bossBeams.length}  Floor: ${bossFloorState}`, 10, _dbgTop + 72);
  ctx.fillStyle = showHitboxes       ? '#00ff88' : '#668866';
  ctx.fillText(`F1 Hitboxes ${f1}`, 10, _dbgTop + 86);
  ctx.fillStyle = showCollisionBoxes ? '#00ccff' : '#446688';
  ctx.fillText(`F2 Collision ${f2}`, 90, _dbgTop + 86);
  ctx.fillStyle = showPhysicsInfo    ? '#ffcc00' : '#887744';
  ctx.fillText(`F3 Physics ${f3}`, 175, _dbgTop + 86);
  ctx.fillStyle = '#aaa';
  ctx.fillText(`type "debugmode" for menu`, 10, _dbgTop + 102);

  // Per-player state labels (screen-space)
  if (typeof canvas !== 'undefined' && currentArena) {
    const scX = canvas.width  / GAME_W;
    const scY = canvas.height / GAME_H;
    const all = [...players, ...trainingDummies];
    for (const p of all) {
      if (p.health <= 0) continue;
      const sx = (p.cx() - (camXCur - GAME_W/2)) * scX;
      const sy = (p.y    - (camYCur - GAME_H/2)) * scY;
      ctx.font      = '9px monospace';
      ctx.fillStyle = p.isAI ? '#ffaa00' : '#00ffaa';
      ctx.textAlign = 'center';
      ctx.fillText(`${p.name||'?'} ${p.aiState||p.state||''}  HP:${Math.round(p.health)}`, sx, Math.max(10, sy - 80));
    }
  }
  ctx.restore();

  // ---- F1: Hitbox overlay (game space) ----
  if (showHitboxes && gameRunning) {
    ctx.save();
    const all2 = [...players, ...minions, ...trainingDummies];
    for (const p of all2) {
      if (p.health <= 0) continue;
      // Body hitbox — green
      ctx.strokeStyle = 'rgba(0,255,100,0.85)';
      ctx.lineWidth   = 1.5;
      ctx.strokeRect(p.x, p.y, p.w, p.h);
      // Centre cross
      ctx.strokeStyle = 'rgba(0,255,0,0.5)';
      ctx.lineWidth = 0.5;
      ctx.beginPath(); ctx.moveTo(p.cx()-4, p.cy()); ctx.lineTo(p.cx()+4, p.cy()); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(p.cx(), p.cy()-4); ctx.lineTo(p.cx(), p.cy()+4); ctx.stroke();
      // Weapon tip — red dot
      if (p.attackTimer > 0 && typeof p.getWeaponTipPos === 'function') {
        const tip = p.getWeaponTipPos();
        if (tip) {
          ctx.fillStyle = 'rgba(255,30,30,0.95)';
          ctx.beginPath(); ctx.arc(tip.x, tip.y, 6, 0, Math.PI*2); ctx.fill();
          // Weapon reach circle — translucent red
          ctx.strokeStyle = 'rgba(255,80,80,0.3)';
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.arc(p.cx(), p.cy(), p.weapon ? p.weapon.range : 50, 0, Math.PI*2); ctx.stroke();
        }
      }
    }
    // Beam hazard zones — orange
    ctx.strokeStyle = 'rgba(255,140,0,0.7)';
    ctx.lineWidth   = 2;
    for (const b of bossBeams) {
      if (b.done) continue;
      const bw = b.phase === 'active' ? 24 : 20;
      ctx.strokeRect(b.x - bw/2, 0, bw, GAME_H);
    }
    ctx.restore();
  }

  // ---- F2: Collision box overlay (game space) ----
  if (showCollisionBoxes && gameRunning && currentArena) {
    ctx.save();
    for (const pl of currentArena.platforms) {
      if (pl.isFloorDisabled) {
        ctx.strokeStyle = 'rgba(255,0,200,0.7)';   // magenta = disabled
      } else if (pl.isFloor) {
        ctx.strokeStyle = 'rgba(0,200,255,0.85)';  // cyan = floor
      } else {
        ctx.strokeStyle = 'rgba(0,180,255,0.55)';  // blue = normal platform
      }
      ctx.lineWidth = 1.5;
      ctx.strokeRect(pl.x, pl.y, pl.w, pl.h);
      // Label
      ctx.fillStyle = 'rgba(0,200,255,0.8)';
      ctx.font      = '8px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`${Math.round(pl.x)},${Math.round(pl.y)} ${pl.w}×${pl.h}${pl.isFloor?' [floor]':''}`, pl.x + 2, pl.y - 2);
    }
    // Arena deathY line
    if (currentArena.deathY) {
      ctx.strokeStyle = 'rgba(255,40,40,0.6)';
      ctx.setLineDash([6, 4]);
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, currentArena.deathY); ctx.lineTo(GAME_W, currentArena.deathY); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(255,80,80,0.7)';
      ctx.font = '9px monospace';
      ctx.fillText(`deathY=${currentArena.deathY}`, 4, currentArena.deathY - 3);
    }
    // LavaY line
    if (currentArena.lavaY) {
      ctx.strokeStyle = 'rgba(255,140,0,0.7)';
      ctx.setLineDash([4, 3]);
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, currentArena.lavaY); ctx.lineTo(GAME_W, currentArena.lavaY); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(255,180,0,0.8)';
      ctx.font = '9px monospace';
      ctx.fillText(`lavaY=${currentArena.lavaY}`, 4, currentArena.lavaY - 3);
    }
    ctx.restore();
  }

  // ---- F3: Physics info (game space) ----
  if (showPhysicsInfo && gameRunning) {
    ctx.save();
    const all3 = [...players, ...minions, ...trainingDummies];
    for (const p of all3) {
      if (p.health <= 0) continue;
      const cx = p.cx(), cy = p.cy();
      // Velocity arrow — yellow
      const velScale = 5;
      ctx.strokeStyle = '#ffcc00';
      ctx.lineWidth   = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + p.vx * velScale, cy + p.vy * velScale);
      ctx.stroke();
      // Arrowhead
      const ax = cx + p.vx * velScale, ay = cy + p.vy * velScale;
      ctx.fillStyle = '#ffcc00';
      ctx.beginPath(); ctx.arc(ax, ay, 3, 0, Math.PI*2); ctx.fill();
      // Physics label
      ctx.fillStyle = '#ffee88';
      ctx.font      = '8px monospace';
      ctx.textAlign = 'center';
      const gnd = p.onGround ? 'GND' : `air`;
      const djmp = p.canDoubleJump ? 'DJ' : '--';
      ctx.fillText(`vx:${p.vx.toFixed(1)} vy:${p.vy.toFixed(1)}`, cx, p.y - 4);
      ctx.fillText(`${gnd}  ${djmp}`, cx, p.y - 13);
    }
    ctx.restore();
  }
}

// ---- Debug menu UI ----
function openDebugMenu() {
  if (document.getElementById('debugMenuOverlay')) return;
  const ov = document.createElement('div');
  ov.id = 'debugMenuOverlay';
  ov.style.cssText = 'position:fixed;inset:0;z-index:9990;background:rgba(0,0,0,0.75);display:flex;align-items:center;justify-content:center;';

  const panel = document.createElement('div');
  panel.style.cssText = 'background:rgba(10,10,30,0.97);border:1px solid #0f0;border-radius:10px;padding:20px 28px;min-width:300px;font-family:monospace;color:#0f0;';
  panel.innerHTML = `<div style="font-size:1.1rem;font-weight:bold;margin-bottom:14px;letter-spacing:2px;">🛠 DEBUG MENU</div>`;

  const btns = [
    ['Toggle Debug Mode',    () => { debugMode = !debugMode; }],
    ['Slow Motion',          () => { timeScale = timeScale < 1 ? 1.0 : 0.25; slowMotion = timeScale; }],
    ['F1 — Hitboxes',        () => { showHitboxes = !showHitboxes; }],
    ['F2 — Collision Boxes', () => { showCollisionBoxes = !showCollisionBoxes; }],
    ['F3 — Physics Info',    () => { showPhysicsInfo = !showPhysicsInfo; }],
    ['Spawn Forest Beast', () => {
      if (gameRunning && typeof ForestBeast !== 'undefined') {
        const fb = new ForestBeast(Math.random() < 0.5 ? 80 : 820, 280);
        if (players[0]) fb.target = players[0];
        trainingDummies.push(fb);
      }
    }],
    ['Spawn Yeti',         () => {
      if (gameRunning && typeof Yeti !== 'undefined') {
        const yt = new Yeti(Math.random() < 0.5 ? 80 : 820, 280);
        if (players[0]) yt.target = players[0];
        trainingDummies.push(yt);
      }
    }],
    ['Reset Bots',         () => {
      for (const p of [...players, ...trainingDummies]) {
        if (!p.isAI) continue;
        p.aiState = 'chase'; p._wanderTimer = 0; p._pendingAction = null;
        p._actionLockFrames = 0; p._dbgStuckTimer = 0;
      }
    }],
    ['Kill All Bots',      () => {
      for (const p of [...players, ...(minions||[]), ...(trainingDummies||[])]) {
        if (p.isAI && !p.godmode && !p._godmode) p.health = 0;
      }
    }],
    ['Refill All HP',      () => {
      for (const p of [...players, ...trainingDummies, ...minions]) {
        p.health = p.maxHealth;
      }
    }],
    ['Close (Esc)',        () => { ov.remove(); }],
  ];

  for (const [label, fn] of btns) {
    const b = document.createElement('button');
    b.textContent = label;
    b.style.cssText = 'display:block;width:100%;margin:4px 0;padding:6px 10px;background:rgba(0,255,0,0.12);border:1px solid #0a0;border-radius:5px;color:#0f0;font-family:monospace;font-size:0.85rem;cursor:pointer;text-align:left;';
    b.onclick = () => { fn(); };
    panel.appendChild(b);
  }

  ov.appendChild(panel);
  document.body.appendChild(ov);

  // Close on Escape
  const close = (e) => { if (e.key === 'Escape') { ov.remove(); document.removeEventListener('keydown', close); } };
  document.addEventListener('keydown', close);
}

// ---- Key hooks (F1/F2/F3 + secret buffer) ----
document.addEventListener('keydown', e => {
  // Console input: allow Enter (submit) and Escape (close) to pass through, block everything else
  const _ae = document.activeElement;
  const _consoleInputFocused = _ae && _ae.id === 'gameConsoleInput';
  if (_consoleInputFocused) {
    if (e.key === 'Enter') { e.preventDefault(); gameConsoleRun(); }
    else if (e.key === 'Escape') { closeGameConsole(); }
    return; // never let game keys fire while console is focused
  }
  // Don't intercept keys when any other text input is focused (chat, room code, etc.)
  if (_ae && (_ae.tagName === 'INPUT' || _ae.tagName === 'TEXTAREA' || _ae.isContentEditable)) return;
  // F1: toggle hitboxes (fighter body + weapon tip)
  if (e.key === 'F1') { e.preventDefault(); showHitboxes = !showHitboxes; if (!debugMode) debugMode = true; return; }
  // F2: toggle collision boxes (platforms + hazard lines)
  if (e.key === 'F2') { e.preventDefault(); showCollisionBoxes = !showCollisionBoxes; if (!debugMode) debugMode = true; return; }
  // F3: toggle physics info (velocity vectors + ground state)
  if (e.key === 'F3') { e.preventDefault(); showPhysicsInfo = !showPhysicsInfo; if (!debugMode) debugMode = true; return; }
  // F4: toggle in-game live map editor (training mode only)
  if (e.key === 'F4') {
    e.preventDefault();
    if (!gameRunning || !trainingMode) return;
    if (trainingDesignerOpen) closeTrainingDesigner();
    else openTrainingDesigner();
    return;
  }
  // F8: open developer jump menu (debug mode only)
  if (e.key === 'F8') {
    e.preventDefault();
    if (!debugMode) return;
    if (document.getElementById('_dbgJumpPanel')) { _dbgJumpMenuClose(); return; }
    _dbgJumpMenuOpen();
    return;
  }
  // Escape closes game console if open (when console input is NOT focused)
  if (e.key === 'Escape' && _consoleOpen) { closeGameConsole(); return; }
  // Track "debugmode" secret buffer
  if (e.key && e.key.length === 1) {
    _debugKeyBuf = (_debugKeyBuf + e.key.toLowerCase()).slice(-12);
    if (_debugKeyBuf.endsWith('debugmode')) {
      _debugKeyBuf = '';
      openDebugMenu();
    }
  }
});

