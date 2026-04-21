'use strict';
// smb-camera.js — Camera system: sequences, drama mode, updateCamera()
// Depends on: smb-globals.js (GAME_W, GAME_H, players, canvas)
'use strict';

// ============================================================
// INTELLIGENT MULTI-MODE CAMERA SYSTEM
// Mode 1 — Gameplay: bounding-box tracking, 60/40 player bias
// Mode 2 — Combat Focus: triggered when players are close / attacking
// Mode 3 — Cinematic: entity-lock (boss attacks, QTEs, specials)
// Mode 4 — DuelCam: smooth midpoint+distance-zoom for exactly 2 entities
// ============================================================
let _camMode         = 'gameplay';  // 'gameplay' | 'combat' | 'cinematic' | 'duel'
let _camCombatTimer  = 0;           // frames remaining in forced combat mode
let _camModeBlend    = 0;           // 0→1 smoothing factor for mode transitions
let _camSnapCooldown = 0;           // frames before failsafe snap can fire again

// Duel-cam: smoothed midpoint target (separate from camXTarget/camYTarget so it doesn't fight lerp)
let _duelMidX = GAME_W / 2;
let _duelMidY = GAME_H / 2;
// Max world-units the smoothed midpoint can travel per frame — prevents snapping on sudden jumps.
// Scales with distance so far-behind camera catches up without overshooting.
const _DUEL_MAX_SPEED   = 14;   // hard cap (world units/frame)
const _DUEL_SPEED_SCALE = 0.10; // proportional factor (speed = dist * scale, then capped)
// How many frames to delay following a fast-falling entity (cinematic drop feel)
let _duelFallDelay = 0;

// Per-mode lerp speeds
const _CAM_LERP = {
  gameplay:  { pos: 0.062, zoom: 0.045 },
  combat:    { pos: 0.130, zoom: 0.095 },
  cinematic: { pos: 0.220, zoom: 0.180 },
  cinematic_snap: { pos: 0.55, zoom: 0.45 },
  duel:      { pos: 0.072, zoom: 0.052 },   // slightly slower than combat for smoothness
  duel_close: { pos: 0.110, zoom: 0.082 },  // tighter when fighters are close
};

// ── Camera Keyframe Sequencer ─────────────────────────────────────────────────
// createCameraSequence(keyframes) — drives camera through a timed path.
// Each keyframe: { t: seconds, zoom: number, target: entityRef|{x,y}|null }
// While a sequence is active, cinematicCamOverride is forced true.
let _camSeq = null; // active sequence state
let _camSeqTime = 0; // elapsed seconds

function createCameraSequence(keyframes) {
  if (!Array.isArray(keyframes) || keyframes.length === 0) return;
  _camSeq = keyframes.slice().sort((a, b) => a.t - b.t);
  _camSeqTime = 0;
  cinematicCamOverride = true;
}

function _tickCameraSequence(dt) {
  if (!_camSeq) return;
  _camSeqTime += dt;

  // Find surrounding keyframes
  const kf = _camSeq;
  const last = kf[kf.length - 1];
  if (_camSeqTime >= last.t) {
    // Sequence finished — apply final frame and release
    const fx = _resolveSeqTarget(last);
    if (fx) { camXTarget = fx.x; camYTarget = fx.y; }
    if (last.zoom) camZoomTarget = last.zoom;
    _camSeq = null;
    cinematicCamOverride = false;
    return;
  }

  let kfA = kf[0], kfB = kf[1] || kf[0];
  for (let i = 0; i < kf.length - 1; i++) {
    if (_camSeqTime >= kf[i].t && _camSeqTime < kf[i + 1].t) {
      kfA = kf[i]; kfB = kf[i + 1]; break;
    }
  }

  const span = Math.max(0.001, kfB.t - kfA.t);
  const t    = Math.min(1, (_camSeqTime - kfA.t) / span);
  const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; // smooth-step

  const ptA = _resolveSeqTarget(kfA);
  const ptB = _resolveSeqTarget(kfB);
  if (ptA && ptB) {
    camXTarget = ptA.x + (ptB.x - ptA.x) * ease;
    camYTarget = ptA.y + (ptB.y - ptA.y) * ease;
  } else if (ptB) {
    camXTarget = ptB.x; camYTarget = ptB.y;
  }
  const zA = kfA.zoom || camZoomCur;
  const zB = kfB.zoom || camZoomCur;
  camZoomTarget = zA + (zB - zA) * ease;

  // Apply timed shake from keyframe
  if (kfA.shake && t < 0.05) screenShake = Math.max(screenShake, kfA.shake);

  // Smooth-apply camera
  camZoomCur += (camZoomTarget - camZoomCur) * 0.22;
  camXCur    += (camXTarget    - camXCur)    * 0.22;
  camYCur    += (camYTarget    - camYCur)    * 0.22;
}

function _resolveSeqTarget(kf) {
  if (!kf) return null;
  if (!kf.target) return null;
  const t = kf.target;
  if (typeof t === 'function') { const e = t(); return e ? { x: e.cx ? e.cx() : e.x, y: e.cy ? e.cy() : e.y } : null; }
  if (typeof t.cx === 'function') return { x: t.cx(), y: t.cy() };
  if (typeof t.x === 'number')   return { x: t.x, y: t.y };
  return null;
}

function stopCameraSequence() {
  _camSeq = null;
  cinematicCamOverride = false;
}

function setCameraDrama(state, frames, target, zoom) {
  camDramaState  = state  || 'normal';
  camDramaTimer  = frames || 60;
  camDramaTarget = target || null;
  camDramaZoom   = zoom   || 1.0;
}

function _updateCameraDrama() {
  if (camDramaTimer > 0) {
    camDramaTimer--;
    if (camDramaTimer === 0) { camDramaState = 'normal'; camDramaTarget = null; }
  }
  if (camDramaState === 'normal' || cinematicCamOverride) return;
  if (camDramaState === 'focus' && camDramaTarget) {
    camZoomTarget = Math.min(camZoomTarget * camDramaZoom, 1.55);
    camXTarget = camXTarget + (camDramaTarget.cx() - camXTarget) * 0.10;
    camYTarget = camYTarget + (camDramaTarget.cy() - camYTarget) * 0.10;
  }
  if (camDramaState === 'impact') {
    camZoomTarget = Math.max(camZoomTarget * 0.84, 0.46);
  }
  if (camDramaState === 'wideshot') {
    camZoomTarget = Math.max(0.44, camZoomTarget * 0.91);
  }
}

// Determine active camera mode each frame
function _updateCamMode() {
  if (cinematicCamOverride || activeCinematic) {
    _camMode = cinematicCamSnapFrames > 0 ? 'cinematic_snap' : 'cinematic';
    _camCombatTimer = 0;
    return;
  }
  // Detect combat conditions: any attack active OR players within 220px
  const humanPlayers = players.filter(p => p.health > 0 && !p.isBoss);
  const anyAttacking = players.some(p => p.attackTimer > 0 && p.health > 0);
  let combatClose = false;
  if (humanPlayers.length >= 2) {
    const d = Math.abs(humanPlayers[0].cx() - humanPlayers[1].cx());
    combatClose = d < 220;
  } else if (humanPlayers.length === 1) {
    const boss = players.find(p => p.isBoss && p.health > 0);
    if (boss) combatClose = Math.abs(humanPlayers[0].cx() - boss.cx()) < 250;
  }
  if (anyAttacking || combatClose) _camCombatTimer = 25; // stay in combat mode 25 frames after last trigger
  if (_camCombatTimer > 0) {
    _camCombatTimer--;
    _camMode = 'combat';
  } else {
    _camMode = 'gameplay';
  }
}

// ============================================================
function updateCamera() {
  // Camera keyframe sequence: runs at 60fps (dt = 1/60s per frame)
  if (_camSeq) { _tickCameraSequence(1 / 60); return; }
  _updateCamMode();

  const lerp = _CAM_LERP[_camMode] || _CAM_LERP.gameplay;
  const activePlayers = [...players, ...trainingDummies, ...minions].filter(p => p.health > 0 && !p.backstageHiding);

  // ── HUD safe-area offset ──────────────────────────────────────────────────
  // The HUD is a fixed HTML bar at the top of the screen. Convert its pixel
  // height to game units so camera targets can be shifted down, keeping
  // players visible below the HUD instead of hidden behind it.
  const _hudEl = document.getElementById('hud');
  const _hudScreenH = (_hudEl && _hudEl.offsetHeight) || 0;
  const _hudGU = _hudScreenH * GAME_H / Math.max(canvas.height, 1); // HUD height in game units
  const _hudShift = _hudGU / 2; // shift camera center down by half HUD height

  let targetZoom = 1.0;
  let targetX    = GAME_W / 2;
  let targetY    = GAME_H / 2;
  let _isDuel    = false;  // set inside activePlayers block, read in post-block apply

  // ── Online: track only local player ──────────────────────
  if (gameMode === 'online' && typeof localPlayerSlot !== 'undefined' && players[localPlayerSlot]) {
    const lp = players[localPlayerSlot];
    const PAD = 180;
    const bbMinX = lp.cx() - PAD, bbMaxX = lp.cx() + PAD;
    const bbMinY = lp.y    - PAD, bbMaxY = lp.y + lp.h + PAD;
    camZoomTarget = Math.max(0.5, Math.min(1.4, Math.min(GAME_W / (bbMaxX - bbMinX), GAME_H / (bbMaxY - bbMinY))));
    camXTarget = (bbMinX + bbMaxX) / 2;
    camYTarget = (bbMinY + bbMaxY) / 2;
    camZoomCur += (camZoomTarget - camZoomCur) * lerp.zoom;
    camXCur    += (camXTarget - camXCur) * lerp.pos;
    camYCur    += (camYTarget - camYCur) * lerp.pos;
    return;
  }

  if (activePlayers.length > 0) {
    // Exploration: track only P1 at steady zoom — world is wide
    if (gameMode === 'exploration' && players[0] && players[0].health > 0) {
      const ep = players[0];
      const targetX2    = ep.cx();
      const targetY2    = ep.cy() - 30;
      const targetZoom2 = 1.05;
      camZoomTarget = targetZoom2;
      const dx2 = targetX2 - camXTarget, dy2 = targetY2 - camYTarget;
      if (Math.hypot(dx2, dy2) > CAMERA_DEAD_ZONE) { camXTarget = targetX2; camYTarget = targetY2; }
      _updateCameraDrama();
      camZoomCur += (targetZoom2 - camZoomCur) * 0.08;
      camXCur    += (camXTarget  - camXCur)    * 0.10;
      camYCur    += (camYTarget  - camYCur)    * 0.10;
      return;
    }

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of activePlayers) {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x + (p.w || 0));
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y + (p.h || 0));
    }

    // ── Mode 4 — DuelCam: exactly 2 entities, smooth midpoint + distance zoom ──
    // Applies to 1v1, boss fights, and 2-entity minigames.
    // Excluded: online (has its own path), exploration, 3+ entity situations.
    _isDuel = activePlayers.length === 2 &&
      gameMode !== 'online' && gameMode !== 'exploration' && !cinematicCamOverride;

    if (_isDuel) {
      const pA = activePlayers[0], pB = activePlayers[1];

      // Raw midpoint
      const rawMidX = (pA.cx() + pB.cx()) / 2;
      const rawMidY = (pA.cy() + pB.cy()) / 2 + 15 + _hudShift; // slight downward offset for floor context + HUD safe area

      // Velocity-capped smooth follow: moves toward raw midpoint at proportional speed,
      // capped to _DUEL_MAX_SPEED units/frame — never snaps regardless of jump size.
      const dMidX = rawMidX - _duelMidX;
      const dMidY = rawMidY - _duelMidY;
      const dMid  = Math.hypot(dMidX, dMidY);
      if (dMid > 0.5) {
        const speed = Math.min(dMid * _DUEL_SPEED_SCALE, _DUEL_MAX_SPEED);
        _duelMidX += (dMidX / dMid) * speed;
        _duelMidY += (dMidY / dMid) * speed;
      }

      // Distance-based zoom: close (<120px) → zoom in, far (>480px) → zoom out
      const spread = Math.hypot(pA.cx() - pB.cx(), pA.cy() - pB.cy());
      // Smooth zoom curve: maps spread 0→600 to zoom 1.18→0.52; scale down by HUD safe-area ratio
      const _duelSafeH = Math.max(GAME_H - _hudGU, GAME_H * 0.7);
      const duelZoom = Math.max(0.50, Math.min(1.18, (1.18 - (spread / 600) * 0.68) * (_duelSafeH / GAME_H)));

      // Detect fast-falling entity (|vy| > 12) — reduce vertical speed during fall
      const anyFalling = activePlayers.some(p => p.vy && Math.abs(p.vy) > 12);
      if (anyFalling) _duelFallDelay = 8;
      if (_duelFallDelay > 0) {
        _duelFallDelay--;
        // Undo 30% of the vertical advance this frame for a cinematic lag feel
        _duelMidY -= (dMidY / Math.max(dMid, 1)) * Math.min(dMid * _DUEL_SPEED_SCALE, _DUEL_MAX_SPEED) * 0.30;
      }

      targetX    = _duelMidX;
      targetY    = _duelMidY;
      targetZoom = duelZoom;

      // Pick lerp speed based on proximity
      const duelLerp = spread < 200 ? _CAM_LERP.duel_close : _CAM_LERP.duel;
      // Always update camXTarget — no secondary dead zone here (that caused the snap)
      camZoomTarget = targetZoom;
      camXTarget = targetX;
      camYTarget = targetY;
      _updateCameraDrama();
      if (camHitZoomTimer > 0) { camHitZoomTimer--; camZoomTarget = Math.max(camZoomTarget, 1.0 + 0.18 * (camHitZoomTimer / 15)); }
      camZoomCur += (camZoomTarget - camZoomCur) * duelLerp.zoom;
      camXCur    += (camXTarget    - camXCur)    * duelLerp.pos;
      camYCur    += (camYTarget    - camYCur)    * duelLerp.pos;

    } else {

    // ── Mode 2 — Combat Focus: center on midpoint, zoom in ──
    if (_camMode === 'combat' && activePlayers.length >= 2) {
      const pA = activePlayers[0], pB = activePlayers[activePlayers.length - 1];
      const midX = (pA.cx() + pB.cx()) / 2;
      const midY = (pA.cy() + pB.cy()) / 2;
      const spread = Math.hypot(pA.cx() - pB.cx(), pA.cy() - pB.cy());
      const combatZoom = Math.max(0.55, Math.min(1.2, 320 / (spread + 80)));
      targetX    = midX;
      targetY    = midY + 20 + _hudShift;  // slight downward offset to show floor + HUD safe area
      targetZoom = combatZoom;
    } else {
      // ── Mode 1 — Gameplay: always fit all players in frame ───
      // Use a larger PAD on wide maps so players don't crowd the screen edges
      const isWideMap = !!(currentArena && currentArena.worldWidth);
      const PAD       = isWideMap ? 220 : 140;
      const zoomX     = GAME_W / ((maxX - minX) + PAD);
      // Reduce effective height by HUD height so players aren't hidden behind the HUD bar
      const _safeH    = Math.max(GAME_H - _hudGU, GAME_H * 0.7);
      const zoomY     = _safeH / ((maxY - minY) + PAD);
      // On wide maps keep a zoom floor of 0.30 so players never become tiny specks
      const minZoom   = isWideMap
        ? Math.max(0.30, GAME_W / (currentArena.worldWidth + 200))
        : 0.42;
      targetZoom = Math.min(1.18, Math.max(minZoom, Math.min(zoomX, zoomY)));

      const rawCX  = (minX + maxX) / 2;
      const rawCY  = (minY + maxY) / 2;
      // 72/28 horizontal bias toward human player; 62/38 vertical bias so jumps are tracked better
      const humanP = activePlayers.find(p => !p.isAI && !p.isBoss) || activePlayers[0];
      targetX = rawCX * 0.72 + humanP.cx() * 0.28;
      targetY = rawCY * 0.62 + humanP.cy() * 0.38 + _hudShift; // shift down to keep players below HUD
    }

    } // end non-duel branch

    if (!_isDuel) {
      // Brief hit-zoom (cinematic heavy hit pulse)
      if (camHitZoomTimer > 0) {
        camHitZoomTimer--;
        targetZoom = Math.max(targetZoom, 1.0 + 0.22 * (camHitZoomTimer / 15));
      }

      // Boss attack: bias camera slightly toward boss (unchanged behaviour)
      if (!cinematicCamOverride && gameRunning && _camMode !== 'combat') {
        const attackingBoss = players.find(p => p.isBoss && p.attackTimer > 0 && p.health > 0);
        if (attackingBoss) {
          targetZoom = Math.max(targetZoom, 1.08);
          targetX = targetX * 0.6 + attackingBoss.cx() * 0.4;
          targetY = targetY * 0.6 + attackingBoss.cy() * 0.4;
        }
      }
    }
  }

  if (!_isDuel) {
    camZoomTarget = targetZoom;
    const dx = targetX - camXTarget, dy = targetY - camYTarget;
    // Per-axis deadzone: decouple horizontal and vertical thresholds so that
    // a jump doesn't trigger horizontal drift and a side-step doesn't pull the
    // camera vertically. Tighter Y (16) keeps jumps tracked promptly.
    if (Math.abs(dx) > 28) camXTarget = targetX;
    if (Math.abs(dy) > 16) camYTarget = targetY;

    _updateCameraDrama();

    // Smooth transition: use combat-speed lerp when entering/leaving mode
    camZoomCur += (camZoomTarget - camZoomCur) * lerp.zoom;
    camXCur    += (camXTarget    - camXCur)    * lerp.pos;
    camYCur    += (camYTarget    - camYCur)    * lerp.pos;
  }

  // ── Clamp camera to world bounds so we never show empty space past map edges ──
  if (currentArena && !cinematicCamOverride) {
    // Half-viewport in world units at current zoom
    const hvw = GAME_W / (2 * camZoomCur);  // half viewport width  (world units)
    const hvh = GAME_H / (2 * camZoomCur);  // half viewport height (world units)

    const wLeft  = currentArena.mapLeft  !== undefined ? currentArena.mapLeft  : 0;
    const wRight = currentArena.mapRight !== undefined ? currentArena.mapRight : (currentArena.worldWidth || GAME_W);

    // Only clamp if the world is wider than the viewport (otherwise centering is fine)
    if (wRight - wLeft > GAME_W / camZoomCur) {
      camXCur = Math.max(wLeft  + hvw, Math.min(wRight - hvw, camXCur));
    }

    // Vertical: clamp so floor is always visible (don't pan above top or below floor+margin)
    const floorPl = currentArena.platforms && currentArena.platforms.find(p => p.isFloor);
    const wBottom = floorPl ? floorPl.y + 80 : GAME_H;
    const wTop    = 0;
    if (wBottom - wTop > GAME_H / camZoomCur) {
      camYCur = Math.max(wTop + hvh, Math.min(wBottom - hvh, camYCur));
    }
  }

  // ── CAMERA FAILSAFE: player out of view → instant partial snap ───────────────
  // Cooldown prevents repeated snaps each frame (causes shudder when lerp fights snap).
  if (_camSnapCooldown > 0) _camSnapCooldown--;
  // Duel mode: skip hard failsafe entirely — velocity-capped midpoint will always catch up
  // smoothly. Brief off-screen is acceptable.
  if (!_isDuel && !cinematicCamOverride && gameRunning && activePlayers.length > 0 && _camSnapCooldown === 0) {
    for (const _fp of activePlayers) {
      const _sx = (_fp.cx() - camXCur) * camZoomCur + GAME_W * 0.5;
      const _sy = (_fp.cy() - camYCur) * camZoomCur + GAME_H * 0.5;
      const _margin = 40;
      if (_sx < -_margin || _sx > GAME_W + _margin || _sy < -_margin || _sy > GAME_H + _margin) {
        // Snap once, then disable lerp conflict for 10 frames
        camXCur    += (_fp.cx() - camXCur) * 0.50;
        camYCur    += (_fp.cy() - camYCur) * 0.50;
        camXTarget  = camXCur;
        camYTarget  = camYCur;
        _camSnapCooldown = 10;
        break;
      }
    }
  }
}
