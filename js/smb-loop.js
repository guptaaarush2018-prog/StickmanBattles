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

// ============================================================
// GAME LOOP
// ============================================================
let _lastFrameTime = 0;
const _FRAME_MIN_MS = 1000 / 62; // cap at ~62fps to prevent double-speed on 120Hz displays

// ── World Modifier Handler ────────────────────────────────────────────────────
// Called once per frame during story mode to apply per-world gameplay changes.
// All mutations are transient (re-applied each frame) — nothing is permanently stored.
function applyWorldModifiers() {
  const _fighters = [...(players || []), ...(minions || []), ...(trainingDummies || [])];
  for (const f of _fighters) {
    if (!f) continue;
    f._aggroBoost = 1;
    f._damageTakenMult = 1;
  }

  if (!worldId || gameMode !== 'story') return;

  if (worldId !== 'fracture' && tfGravityInverted && typeof forceResetGravity === 'function') {
    forceResetGravity();
  }

  switch (worldId) {

    case 'fracture':
      // Random gravity shift: ~1% chance per frame to invert gravity direction.
      // Uses the existing tfGravityInverted flag so fighter physics already handle it.
      if (Math.random() < 0.01) {
        tfGravityInverted = !tfGravityInverted;
      }
      break;

    case 'war':
      // Boost AI aggression each frame (re-applied so removal on world change is clean).
      players.forEach(p => {
        if (p && p.isAI) p._aggroBoost = 1.25;
      });
      break;

    case 'mirror':
      // Mirror AI behaviour is handled in the AI update path.
      break;

    case 'godfall':
      // Increase incoming damage multiplier each frame (re-applied so it resets naturally).
      players.forEach(p => {
        if (p) p._damageTakenMult = 1.3;
      });
      break;

    case 'code':
      // Visual glitch effects are handled in the drawing layer.
      break;
  }
}

function gameLoop(timestamp) {
  if (!gameRunning) return;
  // Frame rate cap: skip this frame if called too soon after the last one
  if (timestamp - _lastFrameTime < _FRAME_MIN_MS) {
    requestAnimationFrame(gameLoop);
    return;
  }
  _lastFrameTime = timestamp;
  if (paused || gameLoading) { requestAnimationFrame(gameLoop); return; }
  // Hitstop: freeze gameplay for a few frames on strong hits
  if (hitStopFrames > 0) {
    hitStopFrames--;
    screenShake *= 0.9; // decay-based shake
    requestAnimationFrame(gameLoop);
    return;
  }
  // Story cinematic freeze: halt physics without blocking rendering
  if (storyFreezeTimer > 0) {
    storyFreezeTimer--;
    // Still render (draw call happens later), but skip physics by falling through
    // to draw-only path — achieved by setting hitStopFrames for 1 frame
    hitStopFrames = 1;
    requestAnimationFrame(gameLoop);
    return;
  }
  // Decay hit-slow-motion burst back to normal
  if (hitSlowTimer > 0) {
    hitSlowTimer--;
    // Don't restore slowMotion during a finisher — finisher manages it
    if (hitSlowTimer <= 0 && slowMotion < 0.9 && !activeFinisher) slowMotion = 1.0;
  }
  // Cosmic silence: brief volume dip on heavy boss hits
  if (typeof SoundManager !== 'undefined' && SoundManager._cosmicSilenceTimer > 0) {
    SoundManager._cosmicSilenceTimer--;
    const _silVol = SoundManager._cosmicSilenceTimer > 4 ? 0.08 : 0.08 + (4 - SoundManager._cosmicSilenceTimer) * 0.23;
    SoundManager._silencedGain = _silVol;
  } else if (typeof SoundManager !== 'undefined' && SoundManager._silencedGain !== undefined && SoundManager._silencedGain < 1.0) {
    SoundManager._silencedGain = Math.min(1.0, (SoundManager._silencedGain || 0) + 0.06);
  }
  // Tick active cinematic (before input and physics)
  // Skip if absorption cinematic is running — prevents overlap with activeCinematic
  if (!tfAbsorptionScene) {
    updateCinematic();
    if (typeof updateCinematicSystem === 'function') updateCinematicSystem();
  }
  // Tick deterministic cutscene system
  if (typeof updateCutscene === 'function') updateCutscene();
  if (typeof updateParadoxCompanion === 'function') updateParadoxCompanion();
  frameCount++;
  aiTick++;
  // Approximate real delta-time at 60fps for Director
  if (typeof updateDirector === 'function') updateDirector(1/60);

  // ---------- Phase: updateInput ----------
  // Online: tick network + apply remote player state
  if (onlineMode && gameRunning && NetworkManager.connected) {
    const localP  = players.find(p => !p.isRemote);
    const remoteP = players.find(p =>  p.isRemote);
    NetworkManager.tick(localP);
    if (remoteP) {
      const rs = NetworkManager.getRemoteStateLegacy();
      if (rs) {
        remoteP.x         = rs.x;
        remoteP.y         = rs.y;
        remoteP.vx        = rs.vx        || 0;
        remoteP.vy        = rs.vy        || 0;
        remoteP.health    = rs.health    != null ? rs.health    : remoteP.health;
        remoteP.maxHealth = rs.maxHealth != null ? rs.maxHealth : (remoteP.maxHealth || 100);
        remoteP.state     = rs.state     || 'idle';
        remoteP.onGround  = rs.state === 'idle' || rs.state === 'walking' || rs.state === 'attacking';
        remoteP.facing    = rs.facing    || remoteP.facing;
        remoteP.lives     = rs.lives     != null ? rs.lives     : remoteP.lives;
        remoteP.curses     = rs.curses    || [];
        remoteP.shielding  = rs.shield    || false;
        // Sync attack animation so weapon swing is visible on opponent's screen
        remoteP.attackTimer    = rs.attackTimer    != null ? rs.attackTimer    : remoteP.attackTimer;
        remoteP.attackDuration = rs.attackDuration != null ? rs.attackDuration : (remoteP.attackDuration || 12);
        remoteP.hurtTimer      = rs.hurtTimer      != null ? rs.hurtTimer      : 0;
        remoteP.stunTimer      = rs.stunTimer2     != null ? rs.stunTimer2     : 0;
        // Sync invincible from owning machine — prevents permanent transparency/unhittable
        remoteP.invincible = rs.invincible != null ? rs.invincible : 0;
        // Sync weapon — always apply to prevent stale local-UI weapon showing
        if (rs.weaponKey && WEAPONS[rs.weaponKey]) {
          remoteP.weaponKey = rs.weaponKey;
          remoteP.weapon    = WEAPONS[rs.weaponKey];
        }
        if (rs.color) remoteP.color = rs.color;
        if (rs.name)  remoteP.name  = rs.name;
        if (rs.hat)   remoteP.hat   = rs.hat;
        if (rs.cape)  remoteP.cape  = rs.cape;
      }
    }
  }

  applyWorldModifiers();
  processInput(); // updateInput

  // ---------- Phase: updateBossArena (platforms, floor hazard) ----------
  if (currentArena && currentArena.isBossArena) {
    // Animate moving platforms — random-lerp targets for unpredictable movement
    // Boss arena: 2x speed (shorter timer range, faster lerp)
    const bossPlSpeed = currentArenaKey === 'creator' ? 2 : 1;
    const bossLerpSpd = currentArenaKey === 'creator' ? 0.14 : 0.07;
    for (const pl of currentArena.platforms) {
      if (pl.ox !== undefined) {
        if (pl.rx === undefined || pl.rTimer <= 0) {
          pl.rx    = pl.ox + (Math.random() - 0.5) * pl.oscX * 2;
          pl.rx    = clamp(pl.rx, pl.ox - pl.oscX, pl.ox + pl.oscX);
          pl.rTimer = Math.floor((30 + Math.floor(Math.random() * 50)) / bossPlSpeed);
        }
        pl.rTimer--;
        pl.x = lerp(pl.x, pl.rx, bossLerpSpd);
      }
      if (pl.oy !== undefined) {
        if (pl.ry === undefined || pl.ryTimer <= 0) {
          pl.ry    = pl.oy + (Math.random() - 0.5) * pl.oscY * 2;
          pl.ry    = clamp(pl.ry, pl.oy - pl.oscY, pl.oy + pl.oscY);
          pl.ryTimer = Math.floor((30 + Math.floor(Math.random() * 50)) / bossPlSpeed);
        }
        pl.ryTimer--;
        pl.y = lerp(pl.y, pl.ry, bossLerpSpd);
      }
    }

    // Floor hazard state machine — suppressed during TF opening cinematic
    if (!gameFrozen && !(typeof tfOpeningFightActive !== 'undefined' && tfOpeningFightActive)) bossFloorTimer--;
    if (bossFloorTimer <= 0) {
      if (bossFloorState === 'normal') {
        bossFloorState = 'warning';
        bossFloorType  = Math.random() < 0.5 ? 'lava' : 'void';
        bossFloorTimer = BOSS_FLOOR_WARNING_FRAMES; // 3-second warning
        showBossDialogue(bossFloorType === 'lava'
          ? randChoice(['The floor has a new purpose.', 'Heat is a matter of perspective.', 'I\'d move if I were you. I\'m not.'])
          : randChoice(['The ground is a luxury.', 'Space beneath your feet — gone.', 'Let\'s see how well you float.']), 220);
      } else if (bossFloorState === 'warning') {
        bossFloorState = 'hazard';
        bossFloorTimer = 900; // 15-second hazard
        const floorPl  = currentArena.platforms.find(p => p.isFloor);
        if (bossFloorType === 'lava') {
          if (floorPl) { floorPl.isFloorDisabled = true; }
          currentArena.hasLava = true;
          currentArena.lavaY   = 462;
          currentArena.deathY  = 560;
        } else {
          if (floorPl) { floorPl.isFloorDisabled = true; }
          currentArena.deathY = 530;
        }
      } else { // 'hazard' → back to normal
        bossFloorState = 'normal';
        bossFloorTimer = 1200 + Math.floor(Math.random() * 600); // 20–30 s until next
        const floorPl  = currentArena.platforms.find(p => p.isFloor);
        if (floorPl) { floorPl.isFloorDisabled = false; }
        currentArena.hasLava = false;
        currentArena.deathY  = 640;
        mapPerkState.eruptions    = [];
        mapPerkState.eruptCooldown = 0;
      }
    }

    // TrueForm floor-removal per-frame countdown (runs every frame, not on AI ticks)
    if (typeof tfFloorRemoved !== 'undefined' && tfFloorRemoved && !gameFrozen) {
      tfFloorTimer--;
      if (tfFloorTimer <= 0) {
        tfFloorRemoved = false;
        const _floorPl = currentArena.platforms.find(p => p.isFloor);
        if (_floorPl) _floorPl.isFloorDisabled = false;
        if (typeof showBossDialogue === 'function')
          showBossDialogue('I gave it back. Enjoy it while it lasts.', 150);
      }
    }

    // Boss lava hazard: spawn eruption columns
    if (bossFloorState === 'hazard' && bossFloorType === 'lava') {
      if (!mapPerkState.eruptions)     mapPerkState.eruptions     = [];
      if (!mapPerkState.eruptCooldown) mapPerkState.eruptCooldown = 120;
      mapPerkState.eruptCooldown--;
      if (mapPerkState.eruptCooldown <= 0) {
        const ex = 80 + Math.random() * 740;
        mapPerkState.eruptions.push({ x: ex, timer: 180 });
        mapPerkState.eruptCooldown = 150 + Math.floor(Math.random() * 150);
      }
      // Tick down eruption timers
      for (let ei = mapPerkState.eruptions.length - 1; ei >= 0; ei--) {
        const er = mapPerkState.eruptions[ei];
        er.timer--;
        if (er.timer <= 0) { mapPerkState.eruptions.splice(ei, 1); continue; }
        if (er.timer % 5 === 0 && settings.particles && particles.length < MAX_PARTICLES) {
          const upA = -Math.PI/2 + (Math.random()-0.5)*0.5;
          const _p = _getParticle();
          _p.x = er.x; _p.y = currentArena.lavaY || 462;
          _p.vx = Math.cos(upA)*5; _p.vy = Math.sin(upA)*(8+Math.random()*8);
          _p.color = Math.random() < 0.5 ? '#ff4400' : '#ff8800';
          _p.size = 3+Math.random()*4; _p.life = 30+Math.random()*20; _p.maxLife = 50;
          particles.push(_p);
        }
        // Damage players in column
        for (const p of players) {
          if (p.isBoss || p.health <= 0 || p.invincible > 0) continue;
          if (Math.abs(p.cx() - er.x) < 100 && p.y + p.h > (currentArena.lavaY || 462) - 250) {
            if (er.timer % 10 === 0) dealDamage(players.find(q => q.isBoss) || players[1], p, Math.ceil(p.maxHealth * 0.044), 8);
          }
        }
      }
    }
  }

  // ---------- Phase: updateCamera (bounding box, dead zone, lerp) ----------
  const baseScale = Math.min(canvas.width / GAME_W, canvas.height / GAME_H);
  const baseScaleX = baseScale;
  const baseScaleY = baseScale;

  let camZoom, camCX, camCY;
  if (bossDeathScene) {
    camZoom = bossDeathScene.camZoom || 1;
    camCX   = bossDeathScene.orbX;
    camCY   = bossDeathScene.orbY;
  } else {
    updateCamera();
    camZoom = camZoomCur;
    camCX   = camXCur;
    camCY   = camYCur;
  }

  // Cinematic camera: smooth follow with a subtle spring, plus optional hard cuts.
  if (cinematicCamOverride) {
    if (cinematicCamSnapFrames > 0) {
      camZoom = cinematicZoomTarget;
      camCX   = cinematicFocusX;
      camCY   = cinematicFocusY;
      cinematicCamSnapFrames--;
      _camPrevFocusX = cinematicFocusX;
      _camPrevFocusY = cinematicFocusY;
      _camOvershootX = 0;
      _camOvershootY = 0;
    } else {
      camZoom += (cinematicZoomTarget - camZoom) * 0.09;
      camCX   += (cinematicFocusX    - camCX)   * 0.07;
      camCY   += (cinematicFocusY    - camCY)   * 0.07;

      _camOvershootX += (cinematicFocusX - _camPrevFocusX) * 0.04;
      _camOvershootY += (cinematicFocusY - _camPrevFocusY) * 0.04;
      _camPrevFocusX = cinematicFocusX;
      _camPrevFocusY = cinematicFocusY;
      _camOvershootX *= 0.82;
      _camOvershootY *= 0.82;
      camCX += _camOvershootX;
      camCY += _camOvershootY;
    }
  } else {
    cinematicCamSnapFrames = 0;
    _camPrevFocusX = camCX;
    _camPrevFocusY = camCY;
    _camOvershootX = 0;
    _camOvershootY = 0;
  }

  // Impact cinematic: override tracking target and apply zoom boost
  if (typeof _cinCamTarget !== 'undefined' && _cinCamTarget) {
    camCX += (_cinCamTarget.cx() - camCX) * _cinCamLerp;
    camCY += (_cinCamTarget.cy() - camCY) * _cinCamLerp;
  }
  if (typeof _cinCamZoomBoost !== 'undefined') camZoom *= (1 + _cinCamZoomBoost);

  const finalScX = baseScaleX * camZoom;
  const finalScY = baseScaleY * camZoom;

  // Clear canvas: fill with arena sky color so zoomed-out margins don't show black
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const _skyBg = ctx.createLinearGradient(0, 0, 0, canvas.height);
  _skyBg.addColorStop(0, currentArena?.sky?.[0] || '#000');
  _skyBg.addColorStop(1, currentArena?.sky?.[1] || '#000');
  ctx.fillStyle = _skyBg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.restore();

  const _cinOX = typeof _cinCamOffX !== 'undefined' ? _cinCamOffX : 0;
  const _cinOY = typeof _cinCamOffY !== 'undefined' ? _cinCamOffY : 0;
  // Only apply screen shake above a threshold to prevent micro-jitter at near-zero values
  const _shakeAmt = screenShake > 1.0 ? screenShake : 0;
  const sx = (Math.random() - 0.5) * _shakeAmt + (canvas.width  / 2 - camCX * finalScX) + _cinOX;
  const sy = (Math.random() - 0.5) * _shakeAmt + (canvas.height / 2 - camCY * finalScY) + _cinOY;
  ctx.setTransform(finalScX, 0, 0, finalScY, sx, sy);

  // ---------- Phase: render (world, entities, particles, HUD) ----------
  drawBackground();
  drawPlatforms();
  if (typeof drawCinematicImpactWorldEffects === 'function') drawCinematicImpactWorldEffects();
  if (gameMode === 'minigames' && minigameType === 'soccer') drawSoccer();
  drawBackstagePortals();
  drawMapPerks();

  // Boss beams — update logic + draw (also in training mode when boss is present, or when an admin kit is equipped)
  const _anyAdminKit = typeof players !== 'undefined' && players.some(p => p._adminKit);
  const hasBossActive = (currentArena && currentArena.isBossArena) || (trainingMode && trainingDummies.some(d => d.isBoss)) || _anyAdminKit
    || (damnationActive && players.some(p => p.isBoss));
  if (hasBossActive) {
    for (const b of bossBeams) {
      if (b.phase === 'warning') {
        if (--b.warningTimer <= 0) { b.phase = 'active'; b.activeTimer = 110; }
      } else if (b.phase === 'active') {
        if (--b.activeTimer <= 0) { b.done = true; }
        else {
          // Deal damage each frame to players caught in beam
          const boss = players.find(p => p.isBoss) || trainingDummies.find(d => d.isBoss);
          const beamTargets = trainingMode ? players : players.filter(p => !p.isBoss);
          for (const p of beamTargets) {
            if (p.health <= 0 || p.invincible > 0) continue;
            // Skip damage if player is inside a safe zone
            const inSafe = bossMetSafeZones.some(sz =>
              Math.hypot(p.cx() - sz.x, (p.y + p.h * 0.5) - sz.y) < sz.r);
            if (!inSafe && Math.abs(p.cx() - b.x) < 24) {
              // Per-beam damage accumulator — cap at 40% of max HP per beam.
              // Keyed on the beam object so overlapping beams don't share/reset each other's cap.
              if (!b._damageAccum) b._damageAccum = {};
              const pid = p.playerNum != null ? p.playerNum : players.indexOf(p);
              if (b._damageAccum[pid] == null) b._damageAccum[pid] = 0;
              const MAX_BEAM_DAMAGE = Math.floor((p.maxHealth || 100) * 0.4);
              if (b._damageAccum[pid] < MAX_BEAM_DAMAGE) {
                const allowed = Math.min(6, MAX_BEAM_DAMAGE - b._damageAccum[pid]);
                b._damageAccum[pid] += allowed;
                dealDamage(boss || players[1], p, allowed, 5, 1.0, false, 12);
              }
            }
          }
        }
      }
    }
    bossBeams = bossBeams.filter(b => !b.done);
    drawBossBeams();

    // Boss spikes — update and draw
    const bossRef = players.find(p => p.isBoss) || trainingDummies.find(d => d.isBoss);
    for (const sp of bossSpikes) {
      if (sp.done) continue;
      if (sp.phase === 'rising') {
        sp.h += 8;
        if (sp.h >= sp.maxH) { sp.h = sp.maxH; sp.phase = 'staying'; sp.stayTimer = 180; }
      } else if (sp.phase === 'staying') {
        sp.stayTimer--;
        if (sp.stayTimer <= 0) sp.phase = 'falling';
      } else if (sp.phase === 'falling') {
        sp.h -= 6;
        if (sp.h <= 0) { sp.h = 0; sp.done = true; }
      }
      // Damage and bounce players caught by spike
      if (sp.phase === 'rising' || sp.phase === 'staying') {
        const spikeTopY = 460 - sp.h;
        const spikeTargets = trainingMode ? players : players.filter(p => !p.isBoss);
        for (const p of spikeTargets) {
          if (p.health <= 0 || p.invincible > 0) continue;
          if (Math.abs(p.cx() - sp.x) < 9 && p.y + p.h > spikeTopY) {
            dealDamage(bossRef || players.find(q => q.isBoss) || players[1], p, 14, 14, 1.0, false, 20);
            // Bounce player upward so they can escape
            if (p.vy >= 0) {
              p.vy = -20;
              p.canDoubleJump = true;
            }
          }
        }
      }
    }
    bossSpikes = bossSpikes.filter(sp => !sp.done);
    drawBossSpikes();
    // Paradox foreshadow: background silhouettes during boss fight (drawn behind fighters)
    if (typeof updateBossParadoxForeshadow === 'function') updateBossParadoxForeshadow();
    if (typeof drawBossParadoxForeshadow   === 'function') drawBossParadoxForeshadow();
    if (bossDeathScene) updateBossDeathScene();
    if (tfEndingScene)  updateTFEnding();
    // Telegraph system: pending attacks, stagger, desperation, warnings draw
    updateBossPendingAttacks();
    drawBossWarnings();
  }

  // ---------- Phase: updatePhysics/updateCombat (projectiles, minions, players) ----------
  projectiles.forEach(p => p.update());
  projectiles = projectiles.filter(p => p.active); // prevent leak
  projectiles.forEach(p => p.draw());

  // Minions (boss-spawned) — freeze during absorption cinematic
  minions.forEach(m => { if (m.health > 0 && !tfAbsorptionScene) m.update(); });
  minions.forEach(m => { if (m.health > 0) m.draw(); });
  minions = minions.filter(m => m.health > 0);

  // Training dummies / bots
  if (trainingMode) {
    trainingDummies.forEach(d => { if (d.isDummy || d.health > 0 || d.invincible > 0) d.update(); });
    trainingDummies.forEach(d => { if (d.isDummy || d.health > 0 || d.invincible > 0) d.draw(); });
    // Remove dead bots (lives=0), keep dummies (they auto-heal)
    trainingDummies = trainingDummies.filter(d => {
      if (d.isDummy) return true; // dummies auto-heal, never remove
      // Decrement lives for dead bots not yet cleaned up (checkDeaths only handles players[])
      if (d.health <= 0 && d.invincible === 0 && d.lives > 0 && !d.isBoss) {
        d.lives--;
        spawnParticles(d.cx(), d.cy(), d.color, 10);
      }
      return d.health > 0 || d.invincible > 0 || d.lives > 0;
    });
  }

  // Soccer ball physics update
  if (gameMode === 'minigames' && minigameType === 'soccer') updateSoccerBall();
  // Minigame logic update
  if (gameMode === 'minigames') updateMinigame();
  // Eternal Damnation arc update
  if (damnationActive && typeof updateDamnation === 'function') updateDamnation();
  // True Form special updates (also active when a trueform admin kit is equipped, or FORCE_ATTACK_MODE has active TF effects)
  const _anyTFKit = typeof players !== 'undefined' && players.some(p => p._adminKit && p._adminKit.kitKey === 'trueform');
  const _forceTF  = !!window.FORCE_ATTACK_MODE && (
    (typeof tfBlackHoles  !== 'undefined' && tfBlackHoles.length)  ||
    (typeof tfGravityWells!== 'undefined' && tfGravityWells.length)||
    (typeof tfClones      !== 'undefined' && tfClones.length)      ||
    (typeof tfShockwaves  !== 'undefined' && tfShockwaves.length)  ||
    (typeof tfGammaBeam   !== 'undefined' && tfGammaBeam)          ||
    (typeof tfNeutronStar !== 'undefined' && tfNeutronStar)        ||
    (typeof tfGalaxySweep !== 'undefined' && tfGalaxySweep)        ||
    (typeof tfMultiverse  !== 'undefined' && tfMultiverse)         ||
    (typeof tfSupernova   !== 'undefined' && tfSupernova)          ||
    (typeof tfMeteorCrash !== 'undefined' && tfMeteorCrash)        ||
    (typeof tfChainSlam   !== 'undefined' && tfChainSlam)          ||
    (typeof tfGraspSlam   !== 'undefined' && tfGraspSlam)          ||
    (typeof tfPhaseShift  !== 'undefined' && tfPhaseShift)         ||
    (typeof tfGravityInverted !== 'undefined' && tfGravityInverted)
  );
  if ((gameMode === 'trueform' || _anyTFKit || _forceTF
      || (damnationActive && players.some(p => p.isTrueForm))) &&
      !(typeof tfOpeningFightActive !== 'undefined' && tfOpeningFightActive)) {
    updateTFBlackHoles();
    updateTFGravityWells();
    updateTFMeteorCrash();
    updateTFClones();
    updateTFChainSlam();
    updateTFGraspSlam();
    updateTFDimensionPunch();
    updateTFShockwaves();
    updateTFPendingAttacks();
    updateTFGammaBeam();
    updateTFBurnTrail();
    updateTFNeutronStar();
    updateTFGalaxySweep();
    updateTFMultiverse();
    updateTFSupernova();
    // Gravity failsafe: ensure inversion ALWAYS expires via timer or hard cap
    if (tfGravityInverted) {
      if (tfGravityTimer > 0) {
        // Normal path: timer-driven restore
        tfGravityTimer--;
        if (tfGravityTimer <= 0) {
          forceResetGravity();
          showBossDialogue('I restored gravity. You\'re welcome.', 150);
          spawnParticles(GAME_W / 2, GAME_H / 2, '#ffffff', 16);
        }
      } else {
        // Failsafe path: inverted but no timer set (e.g. chaos event / cinematic without tfGravityTimer)
        if (!gravityState.active) {
          gravityState.active   = true;
          gravityState.type     = 'reverse';
          gravityState.timer    = 0;
          gravityState.maxTimer = 240; // 4-second hard cap
        }
        gravityState.timer++;
        if (gravityState.timer >= gravityState.maxTimer) {
          forceResetGravity();
          spawnParticles(GAME_W / 2, GAME_H / 2, '#ffffff', 12);
        }
      }
    } else if (gravityState.active) {
      // Not inverted — clear failsafe tracker
      gravityState.active = false;
      gravityState.timer  = 0;
    }
    if (tfControlsInverted && tfControlsInvertTimer > 0) {
      tfControlsInvertTimer--;
      if (tfControlsInvertTimer <= 0) {
        tfControlsInverted = false;
        showBossDialogue('Your body is yours again. Briefly.', 150);
        spawnParticles(GAME_W / 2, GAME_H / 2, '#aaaaaa', 12);
      }
    }
  }

  // Verlet death ragdolls — update and remove when lifetime expires (prevent leak)
  verletRagdolls.forEach(vr => vr.update());
  verletRagdolls = verletRagdolls.filter(vr => !vr.isDone());

  // Draw Verlet death ragdolls (behind living players)
  verletRagdolls.forEach(vr => vr.draw());

  // Safety: clamp any Infinity/NaN velocities before physics update (avoids teleport bugs)
  for (const p of players) {
    if (!isFinite(p.vx)) p.vx = 0;
    if (!isFinite(p.vy)) p.vy = 0;
    if (!isFinite(p.x))  { p.x = GAME_W / 2; p.vx = 0; }
    if (!isFinite(p.y))  { p.y = 200;         p.vy = 0; }
  }
  // Players — skip physics update for remote (network-driven) players; also skip during hard freeze or absorption cinematic
  if (!gameFrozen && !tfAbsorptionScene) {
    players.forEach(p => { if ((p.health > 0 || p.invincible > 0) && !p.isRemote) p.update(); });
  }
  // Passive super charge: every player (non-boss) gains a small amount of super each frame
  if (!isCinematic && !paused) {
    players.forEach(p => {
      if (p.isBoss || p.superActive || p.health <= 0) return;
      const _prev = p.superReady;
      p.superMeter = Math.min(100, p.superMeter + 0.04);
      if (!_prev && p.superMeter >= 100) {
        p.superReady      = true;
        p.superFlashTimer = 90;
      }
    });
  }
  // Chaos system: per-frame update (events, drops, effects, multi-kill, announcer)
  if (typeof chaosMode !== 'undefined' && chaosMode && typeof updateChaosSystem === 'function') updateChaosSystem();
  // Finisher: override positions/state AFTER physics, BEFORE draw
  if (typeof updateFinisher === 'function') updateFinisher();

  // ── Depth Phase: transition, circular arena constraint, still-Z tracking ──────
  if (typeof tfDepthPhaseActive !== 'undefined' && tfDepthPhaseActive) {
    // Tick the freeze-transition timer; unlock Z-movement when it expires
    if (tfDepthTransitionTimer > 0) {
      tfDepthTransitionTimer--;
      if (tfDepthTransitionTimer === 0) {
        tfDepthEnabled = true;
        if (typeof cinScreenFlash !== 'undefined')
          cinScreenFlash = { color: '#8844ff', alpha: 0.55, timer: 22, maxTimer: 22 };
        screenShake = Math.max(screenShake, 26);
        spawnParticles(TF_DEPTH_CX, TF_DEPTH_CY, '#8844ff', 22);
        spawnParticles(TF_DEPTH_CX, TF_DEPTH_CY, '#ffffff', 14);
        if (typeof showBossDialogue === 'function')
          showBossDialogue('Every dimension. Every layer. I am all of them.', 240);
      }
    }
    // Clamp all living entities inside the circular arena boundary
    for (const ent of players) {
      if (!ent || (ent.health <= 0 && ent.invincible <= 0)) continue;
      const ecx = ent.cx(), ecy = ent.cy();
      const edx = ecx - TF_DEPTH_CX, edy = ecy - TF_DEPTH_CY;
      const ed  = Math.hypot(edx, edy);
      if (ed > TF_DEPTH_R) {
        const sc = TF_DEPTH_R / ed;
        ent.x  = TF_DEPTH_CX + edx * sc - ent.w * 0.5;
        ent.y  = TF_DEPTH_CY + edy * sc - ent.h * 0.5;
        ent.vx *= -0.45;
        ent.vy *= -0.45;
      }
    }
    // Track per-player same-Z idle frames for depthPunish
    if (typeof tfDepthPlayerStillZ !== 'undefined') {
      players.forEach((p, pi) => {
        if (p.isAI || p.isBoss || p.health <= 0) return;
        const rec = tfDepthPlayerStillZ[pi] || { z: p.z || 0, frames: 0 };
        if (Math.abs((p.z || 0) - rec.z) < 0.05) { rec.frames++; }
        else { rec.z = p.z || 0; rec.frames = 0; }
        tfDepthPlayerStillZ[pi] = rec;
      });
    }
  }

  players.forEach((p, i) => {
    if (p.health <= 0 && p.invincible <= 0) return;
    // Cinematic visibility: skip players flagged as hidden for this scene
    if (activeCinematic && activeCinematic.hidePlayers && activeCinematic.hidePlayers.includes(i)) return;
    // Depth phase: apply per-entity Z-axis depth illusion transform
    if (typeof tfDepthPhaseActive !== 'undefined' && tfDepthPhaseActive) {
      const pz     = p.z || 0;
      const dScale = 1 + pz * 0.2;  // z=1 → 20% larger, z=-1 → 20% smaller
      const dOffY  = pz * 40;        // z=1 → 40px lower (foreground), z=-1 → 40px higher
      const pivX   = p.cx();
      const pivY   = p.cy();
      ctx.save();
      ctx.translate(pivX, pivY + dOffY);
      ctx.scale(dScale, dScale);
      ctx.translate(-pivX, -pivY);
      p.draw();
      ctx.restore();
      // Draw Z-layer indicator bar beneath entity
      const barW = p.w * 1.4, barH = 4;
      const barX = p.cx() - barW * 0.5;
      const barY = p.y + p.h + dOffY + 6 * dScale;
      ctx.save();
      ctx.globalAlpha = 0.7;
      ctx.fillStyle = '#222';
      ctx.fillRect(barX, barY, barW, barH);
      // Filled portion shows z position (center = z:0, right = z:1, left = z:-1)
      const fillX  = barX + barW * 0.5 + (pz * barW * 0.5) - barH * 0.5;
      ctx.fillStyle = pz >= 0 ? '#00aaff' : '#aa44ff';
      ctx.fillRect(Math.max(barX, fillX), barY, barH, barH);
      ctx.restore();
      return; // draw already called above
    }
    // Hit nudge: directional visual recoil — linearly decays over 4 frames
    if (p._hitNudge && p._hitNudge.t > 0) {
      ctx.save();
      ctx.translate(p._hitNudge.x * (p._hitNudge.t / 4), 0);
      p.draw();
      ctx.restore();
      p._hitNudge.t--;
    } else {
      p.draw();
    }
    // Hit confirmation flash: brief white overlay sized to fighter bounding box
    if (p._hitFlashTimer && p._hitFlashTimer > 0) {
      p._hitFlashTimer--;
      ctx.save();
      ctx.globalAlpha = (p._hitFlashTimer / 5) * 0.38;
      ctx.fillStyle   = '#ffffff';
      ctx.fillRect(p.x - 1, p.y - 1, p.w + 2, p.h + 2);
      ctx.restore();
    }
  });
  // Chaos system: world-space draw (item drops, effect badges, platform effects)
  if (typeof chaosMode !== 'undefined' && chaosMode && typeof drawChaosWorldSpace === 'function') drawChaosWorldSpace();
  drawSpartanRageEffects();
  drawClassEffects();
  drawCurseAuras();
  updateAndDrawLightningBolts();
  if ((gameMode === 'trueform' || _anyTFKit || _forceTF
      || (damnationActive && players.some(p => p.isTrueForm))) &&
      !(typeof tfOpeningFightActive !== 'undefined' && tfOpeningFightActive)) {
    updateTFPhaseShift();
    updateTFRealityTear();
    updateTFCalcStrike();
    updateTFRealityOverride();
    drawTFBlackHoles();
    drawTFGravityWells();
    drawTFMeteorCrash();
    drawTFClones();
    drawTFShockwaves();
    drawTFPhaseShift();
    drawTFRealityTear();
    drawTFCalcStrike();
    drawTFMathBubble();
    drawTFRealityOverride();
    drawTFBurnTrail();
    drawTFGammaBeam();
    drawTFNeutronStar();
    drawTFGalaxySweep();
    drawTFMultiverse();
    drawTFSupernova();
    drawTFDimensionPunch();
    drawBossWarnings();
  }
  drawPhaseTransitionRings();
  drawCinematicWorldEffects(); // ground cracks + world-space cinematic fx
  // Paradox entity (world-space, drawn over fighters)
  if (typeof drawParadox === 'function') drawParadox();
  // TF-kills-Paradox cinematic overlay (lock rings world-space + terminal screen-space)
  if (typeof updateTFKCOverlay === 'function') updateTFKCOverlay();
  if (typeof drawTFKCOverlay   === 'function') drawTFKCOverlay();
  // Absorption aura on player (world-space cyan glow, active and permanent)
  if (typeof drawTFAbsorption      === 'function') drawTFAbsorption();
  // Absorption cinematic v2 — memory-driven scene overlay
  if (tfAbsorptionScene && typeof drawTFAbsorptionScene === 'function') drawTFAbsorptionScene();
  // Paradox empowerment aura (world-space, over fighters)
  if (typeof drawParadoxEmpowerment === 'function') drawParadoxEmpowerment();
  checkWeaponSparks();

  // Ability activation ring flash
  if (abilityFlashTimer > 0 && abilityFlashPlayer) {
    const fp = abilityFlashPlayer;
    ctx.save();
    ctx.globalAlpha = (abilityFlashTimer / 14) * 0.6;
    ctx.strokeStyle = fp.color;
    ctx.lineWidth   = 3;
    const r = (14 - abilityFlashTimer) * 4 + 8;
    ctx.beginPath(); ctx.arc(fp.cx(), fp.cy(), r, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
    abilityFlashTimer--;
  }

  drawSecretLetters();
  if (bossDeathScene) drawBossDeathScene();
  if (tfEndingScene)  drawTFEnding();
  updateMapPerks();
  updateMirrorGimmick();
  drawMirrorGimmickOverlay();
  // Paradox revive system (screen-space overlay — replaces fake-death visually)
  if (typeof updateParadoxRevive === 'function') updateParadoxRevive();
  if (typeof drawParadoxRevive   === 'function') drawParadoxRevive();
  // Standalone Paradox entity update (fade-out cleanup outside of revive/opening-fight sequence)
  if (typeof updateParadox === 'function' && (typeof paradoxReviveActive === 'undefined' || !paradoxReviveActive)
      && (typeof tfOpeningFightActive === 'undefined' || !tfOpeningFightActive)) updateParadox();
  // Paradox empowerment timer tick
  if (typeof updateParadoxEmpowerment === 'function') updateParadoxEmpowerment();
  // Paradox ability effects update
  if (typeof updateParadoxEffects === 'function') updateParadoxEffects();
  // False Victory sequence update + draw
  if (typeof updateFalseVictory === 'function') updateFalseVictory();
  if (typeof drawFalseVictory   === 'function') drawFalseVictory();
  if (typeof updateTFOpeningFight   === 'function') updateTFOpeningFight();
  if (typeof updateTFAbsorption     === 'function') updateTFAbsorption();
  if (tfAbsorptionScene && typeof updateTFAbsorptionScene === 'function') updateTFAbsorptionScene();
  // Paradox Fusion visual overlay on P1
  if (typeof drawParadoxFusion === 'function' && typeof tfParadoxFused !== 'undefined' && tfParadoxFused) {
    drawParadoxFusion(players[0]);
  }
  // Paradox ability effects draw
  if (typeof drawParadoxEffects === 'function') drawParadoxEffects();
  // Legacy fake-death scene (runs only when paradox system unavailable)
  if (typeof triggerParadoxRevive === 'undefined') {
    updateFakeDeathScene();
    drawFakeDeathScene();
  }

  // ---------- Phase: updateParticles (prevent memory leak: remove expired) ----------
  const _liveParticles = [];
  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    p.x += p.vx; p.y += p.vy;
    p.vy += 0.12; p.vx *= 0.96;
    p.life--;
    if (p.life > 0) {
      _liveParticles.push(p);
      const a = p.life / p.maxLife;
      ctx.globalAlpha = Math.max(0, a);
      ctx.fillStyle   = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(0.01, p.size * a), 0, Math.PI * 2);
      ctx.fill();
    } else {
      _recycleParticle(p);
    }
  }
  particles = _liveParticles; // keep only live (life > 0) to prevent leak
  ctx.globalAlpha = 1;

  // Damage texts — filter expired to prevent leak
  damageTexts.forEach(d => { d.update(); d.draw(); });
  damageTexts = damageTexts.filter(d => d.life > 0);

  // Respawn countdowns — filter expired to prevent leak
  for (const cd of respawnCountdowns) {
    cd.framesLeft--;
    if (cd.framesLeft <= 0) continue;
    const num = Math.ceil(cd.framesLeft / 22);
    const a   = Math.min(1, cd.framesLeft / 18) * (1 - Math.max(0, (22 - cd.framesLeft % 22) / 22) * 0.3);
    ctx.save();
    ctx.globalAlpha = Math.max(0, a);
    ctx.font        = 'bold 32px Arial';
    ctx.fillStyle   = cd.color;
    ctx.textAlign   = 'center';
    ctx.shadowColor = 'rgba(0,0,0,0.9)';
    ctx.shadowBlur  = 8;
    ctx.fillText(num, cd.x, cd.y);
    ctx.restore();
  }
  respawnCountdowns = respawnCountdowns.filter(cd => cd.framesLeft > 0);

  // Boss phase 3: subtle red screen tint
  if (currentArena && currentArena.isBossArena && settings.bossAura) {
    const bossChar = players.find(p => p.isBoss);
    if (bossChar && bossChar.getPhase && bossChar.getPhase() >= 3 && bossChar.health > 0) {
      ctx.save();
      ctx.globalAlpha = 0.03 + Math.sin(frameCount * 0.04) * 0.012;
      ctx.fillStyle   = '#ff0000';
      ctx.fillRect(0, 0, GAME_W, GAME_H);
      ctx.restore();
    }
  }

  // Boss phase transition flash
  if (bossPhaseFlash > 0) {
    ctx.save();
    ctx.globalAlpha = (bossPhaseFlash / 50) * 0.55;
    ctx.fillStyle   = '#ffffff';
    ctx.fillRect(0, 0, GAME_W, GAME_H);
    bossPhaseFlash--;
    ctx.restore();
  }

  screenShake *= 0.9; // decay-based shake (smoother than instant drop)
  // Reset to non-shake transform (keep scale + camera centering, remove shake)
  ctx.setTransform(finalScX, 0, 0, finalScY,
    canvas.width  / 2 - camCX * finalScX,
    canvas.height / 2 - camCY * finalScY);

  checkDeaths();
  updateHUD();
  if (storyModeActive && typeof storyTickFightScript    === 'function') storyTickFightScript();
  if (storyModeActive && typeof storyCheckEvents        === 'function') storyCheckEvents();
  if (storyModeActive && typeof storyUpdateBoundaries   === 'function') storyUpdateBoundaries();
  // Multiverse: per-frame world modifier tick (gravity flip, shadow teleport, etc.)
  if (multiverseModeActive && typeof MultiverseManager !== 'undefined') MultiverseManager.tick();
  if (exploreActive && typeof updateExploration === 'function') updateExploration();
  // Ship & Fracture progression — tick preview timer each frame
  if (typeof updateFracturePreview === 'function') updateFracturePreview();
  if (gameMode === 'trueform' && !tfAbsorptionScene && typeof updateQTE === 'function') updateQTE();

  // TrueForm: record player position history for multiverse lag-echo
  if (gameMode === 'trueform' && players[0] && players[0].health > 0) {
    _tfCloneHistory.push({ x: players[0].cx(), y: players[0].cy(), facing: players[0].facing });
    if (_tfCloneHistory.length > 24) _tfCloneHistory.shift();
  }

  // Minigame HUD overlay
  if (gameMode === 'minigames') drawMinigameHUD();
  // New chaos modifier notification — timer ticked here, drawn in screen-space below
  if (_chaosModNotif && _chaosModNotif.timer > 0) _chaosModNotif.timer--;
  if (exploreActive && typeof drawExploreGoalObject === 'function') drawExploreGoalObject();
  // Story mode: void fog + boundary warning (drawn in game-world space)
  if (storyModeActive) drawStoryVoidFog();
  if (storyModeActive && typeof drawStoryBoundaryWarning === 'function') drawStoryBoundaryWarning();
  // Achievement popups (drawn over everything, in screen space)
  ctx.setTransform(1, 0, 0, 1, 0, 0); // reset transform for screen-space draw

  // Hit vignette: red edge flash when player takes heavy damage
  if (hitVignetteTimer > 0) {
    hitVignetteTimer--;
    const _va = (hitVignetteTimer / 28) * 0.38;
    const _vg = ctx.createRadialGradient(canvas.width/2, canvas.height/2, canvas.height*0.3, canvas.width/2, canvas.height/2, canvas.height*0.9);
    _vg.addColorStop(0, hitVignetteColor + '0)');
    _vg.addColorStop(1, hitVignetteColor + _va.toFixed(3) + ')');
    ctx.fillStyle = _vg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  if (typeof drawCinematicImpactEffects === 'function') drawCinematicImpactEffects();
  drawCinematicOverlay();
  // Story world distortion intentionally disabled (purple scanlines removed per user request)
  drawAchievementPopups();
  if (damnationActive && typeof drawDamnationEffects === 'function') drawDamnationEffects();
  if (damnationActive && typeof drawDamnationAnchors === 'function') drawDamnationAnchors();
  if (typeof drawObjectiveHUD === 'function') drawObjectiveHUD();
  // Chaos system: screen-space draw (score HUD, event badge, announcer, spectator label)
  if (typeof chaosMode !== 'undefined' && chaosMode && typeof drawChaosOverlay === 'function') drawChaosOverlay();
  if (gameMode === 'adaptive' && typeof drawAdaptiveAIDebug === 'function') drawAdaptiveAIDebug();
  if (typeof drawEntityOverlays === 'function') drawEntityOverlays(finalScX, finalScY, camCX, camCY);
  // Pathfinding debug overlays (toggled via `pf *` console commands, drawn in world-space)
  if (window._pfShowGraph && typeof visualizePlatformGraph  === 'function') visualizePlatformGraph();
  if (window._pfShowDJ    && typeof highlightDoubleJumpEdges === 'function') highlightDoubleJumpEdges();
  if (typeof players !== 'undefined') {
    const _pfBots = players.filter(p => p.isAI && !p.isBoss);
    if (window._pfShowPaths && typeof showBotPath           === 'function') _pfBots.forEach(showBotPath);
    if (window._pfShowArcs  && typeof showProjectedLanding  === 'function') _pfBots.forEach(showProjectedLanding);
  }
  if (storyModeActive && typeof drawStorySubtitle        === 'function') drawStorySubtitle();
  if (storyModeActive && typeof drawStoryOpponentHUD     === 'function') drawStoryOpponentHUD();
  if (storyModeActive && typeof drawStoryPhaseHUD        === 'function') drawStoryPhaseHUD();
  if (storyModeActive && typeof drawFallenWarriorMemory  === 'function') drawFallenWarriorMemory();
  // Multiverse: in-world-space modifier visuals (badge, gravity bar, warning text)
  if (multiverseModeActive && typeof MultiverseManager !== 'undefined') MultiverseManager.draw();
  // Multiverse: screen-space overlays (shadow fog, Fallen God dialogue, world-complete banner, encounter HUD)
  if (multiverseModeActive && typeof MultiverseManager !== 'undefined') {
    MultiverseManager.drawScreenSpace();
    MultiverseManager.drawHUD();
  }
  if ((currentArena.isBossArena || window.FORCE_ATTACK_MODE) && typeof drawBossDialogue === 'function') drawBossDialogue(finalScX, finalScY, camCX, camCY);
  if (gameMode === 'exploration') drawExploreHUD();
  if (abilityUnlockToast && abilityUnlockToast.timer > 0) drawAbilityUnlockToast();
  if (gameMode === 'trueform' && typeof drawQTE === 'function') drawQTE(ctx, canvas.width, canvas.height);
  if (typeof drawCutscene === 'function') drawCutscene(ctx, canvas.width, canvas.height);
  if (typeof drawFinisher === 'function') drawFinisher(ctx); // finisher overlay (topmost)

  // ── Critical status overlays — always screen-space, always above HUD ──────
  // Hide legacy DOM banner (replaced by canvas draw below)
  { const _b = document.getElementById('ctrlInvertedBanner'); if (_b) _b.style.display = 'none'; }

  ctx.setTransform(1, 0, 0, 1, 0, 0); // ensure screen space
  {
    const _now = performance.now();
    const _cW  = canvas.width;
    const _cH  = canvas.height;

    // Chaos mod notification (screen-space, was world-space before)
    if (_chaosModNotif && _chaosModNotif.timer > 0) {
      const _alpha = Math.min(1, _chaosModNotif.timer / 30);
      const _pulse = 0.75 + 0.25 * Math.sin(_now / 220);
      const _scale = 1 + 0.06 * Math.sin(_now / 180);
      ctx.save();
      ctx.globalAlpha = _alpha * _pulse;
      ctx.translate(_cW / 2, _cH * 0.88);
      ctx.scale(_scale, _scale);
      ctx.font = 'bold 16px Arial';
      ctx.fillStyle = '#ff88ff';
      ctx.textAlign = 'center';
      ctx.shadowColor = '#ff00ff'; ctx.shadowBlur = 14;
      ctx.fillText('+ ' + _chaosModNotif.label, 0, 0);
      ctx.restore();
    }

    // Gravity-inverted warning
    if (typeof tfGravityInverted !== 'undefined' && tfGravityInverted) {
      const _pulse = 0.55 + 0.45 * Math.abs(Math.sin(_now / 350));
      const _scale = 1 + 0.07 * Math.sin(_now / 280);
      ctx.save();
      ctx.globalAlpha = _pulse;
      ctx.translate(_cW / 2, _cH * 0.13);
      ctx.scale(_scale, _scale);
      ctx.font = 'bold 19px Arial';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ccaaff';
      ctx.shadowColor = '#8844ff'; ctx.shadowBlur = 22;
      ctx.fillText('\u26A0 GRAVITY INVERTED', 0, 0);
      ctx.restore();
    }

    // Controls-inverted warning (canvas replacement for DOM banner)
    if (typeof tfControlsInverted !== 'undefined' && tfControlsInverted && tfControlsInvertTimer > 0) {
      const _pulse = 0.6 + 0.4 * Math.abs(Math.sin(_now / 300));
      const _scale = 1 + 0.05 * Math.sin(_now / 240);
      const _secs  = Math.ceil(tfControlsInvertTimer / 60);
      ctx.save();
      ctx.globalAlpha = _pulse;
      ctx.translate(_cW / 2, _cH * 0.08);
      ctx.scale(_scale, _scale);
      ctx.font = 'bold 18px Arial';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ff5555';
      ctx.shadowColor = '#ff0000'; ctx.shadowBlur = 18;
      ctx.fillText('\u26A0 CONTROLS INVERTED  ' + _secs + 's', 0, 0);
      ctx.restore();
    }
  }
  // ── End critical status overlays ─────────────────────────────────────────

  drawEdgeIndicators(finalScX, finalScY, camCX, camCY);
  if (typeof drawCinematicLetterbox === 'function') drawCinematicLetterbox();
  // Restore the stable game transform after (remaining draws use it already)
  ctx.setTransform(finalScX, 0, 0, finalScY, canvas.width/2 - camCX*finalScX, canvas.height/2 - camCY*finalScY);

  // Infinite mode: draw win score on canvas (outside shake transform)
  if (infiniteMode && gameRunning) {
    const p1c = players[0] ? players[0].color : '#00d4ff';
    const p2c = players[1] ? players[1].color : '#ff4455';
    ctx.save();
    ctx.textAlign   = 'center';
    ctx.shadowColor = 'rgba(0,0,0,0.95)';
    ctx.shadowBlur  = 14;
    ctx.font        = 'bold 30px Arial';
    ctx.fillStyle   = p1c;
    ctx.fillText(winsP1, GAME_W / 2 - 48, 96);
    ctx.fillStyle   = 'rgba(255,255,255,0.7)';
    ctx.fillText('—', GAME_W / 2, 96);
    ctx.fillStyle   = p2c;
    ctx.fillText(winsP2, GAME_W / 2 + 48, 96);
    ctx.restore();
  }

  // Debug overlay (drawn last, in screen-space)
  if (debugMode) {
    runSanityChecks();
    renderDebugOverlay(ctx);
  }

  // Use error-boundary wrapper if available; fall back to raw rAF
  if (typeof ErrorBoundary !== 'undefined') {
    requestAnimationFrame(ErrorBoundary.wrapLoop(gameLoop));
  } else {
    requestAnimationFrame(gameLoop);
  }
}

// ============================================================
// INPUT
// ============================================================
const keysDown      = new Set();
const keyHeldFrames = {};   // key → frames held continuously

const SCROLL_BLOCK = new Set([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 's', '/']);

// Normalize a key string so that caps-lock and shift don't break single-letter
// bindings. Only single alphabetic characters are lowercased; everything else
// (Arrow*, Enter, ' ', '.', '/', etc.) is returned unchanged.
function _normKey(k) {
  return (k.length === 1 && k >= 'A' && k <= 'Z') ? k.toLowerCase() : k;
}

document.addEventListener('keydown', e => {
  // Don't intercept keys when typing in any text input (chat, console, etc.)
  const ae = document.activeElement;
  const inputFocused = ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.isContentEditable);
  if (inputFocused) return; // let the input receive all keystrokes unmodified
  if (tfEndingScene && tfEndingScene.skippable && tfEndingScene.phase === 'powers') { trySkipTFEnding(); return; }
  if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') { pauseGame(); return; }
  // Cheat code: type TRUEFORM anywhere in menu to unlock True Form
  // GAMECONSOLE works any time (menu or in-game)
  if (e.key && e.key.length === 1) {
    _cheatBuffer = ((_cheatBuffer || '') + e.key.toUpperCase()).slice(-20);
    if (_cheatBuffer.endsWith('GAMECONSOLE')) {
      _cheatBuffer = '';
      openGameConsole();
    }
  }
  if (!gameRunning && e.key && e.key.length === 1) {
    // _cheatBuffer already updated above — just check for menu-only codes
    if (_cheatBuffer.endsWith('TRUEFORM')) {
      _cheatBuffer = '';
      if (!unlockedTrueBoss) {
        unlockedTrueBoss = true;
        if (typeof setAccountFlagWithRuntime === 'function') {
          setAccountFlagWithRuntime(['unlocks', 'trueform'], true, function(v) { unlockedTrueBoss = v; });
          setAccountFlagWithRuntime(['unlocks', 'letters'], [0,1,2,3,4,5,6,7], function() {});
        } else if (typeof saveGame === 'function') {
          saveGame();
        }
        collectedLetterIds = new Set([0,1,2,3,4,5,6,7]);
        syncCodeInput();
        const card = document.getElementById('modeTrueForm');
        if (card) card.style.display = '';
        spawnParticles && spawnParticles(450, 260, '#cc00ff', 30);
        spawnParticles && spawnParticles(450, 260, '#ffffff', 20);
        showBossDialogue && showBossDialogue('True Form Unlocked!', 180);
        // Show a brief notification
        const notif = document.createElement('div');
        notif.textContent = '⚡ TRUE FORM UNLOCKED ⚡';
        notif.style.cssText = 'position:fixed;top:20%;left:50%;transform:translateX(-50%);background:rgba(160,0,255,0.92);color:#fff;padding:16px 32px;border-radius:12px;font-size:1.2rem;font-weight:900;letter-spacing:3px;z-index:9999;pointer-events:none;text-align:center;box-shadow:0 0 40px #cc00ff;';
        document.body.appendChild(notif);
        setTimeout(() => notif.remove(), 3000);
      }
    }
    // SOVEREIGN cheat: type UNLOCKSOVEREIGN in menu
    if (_cheatBuffer.endsWith('UNLOCKSOVEREIGN')) {
      _cheatBuffer = '';
      if (!sovereignBeaten) {
        sovereignBeaten = true;
        if (typeof setAccountFlagWithRuntime === 'function') {
          setAccountFlagWithRuntime(['unlocks', 'sovereignBeaten'], true, function(v) { sovereignBeaten = v; });
        } else if (typeof saveGame === 'function') {
          saveGame();
        }
        const adCard  = document.getElementById('modeAdaptive');
        const sovCard = document.getElementById('modeSovereign');
        if (adCard)  adCard.style.display  = '';
        if (sovCard) sovCard.style.display = '';
        const notif = document.createElement('div');
        notif.textContent = '⚡ SOVEREIGN UNLOCKED ⚡';
        notif.style.cssText = 'position:fixed;top:20%;left:50%;transform:translateX(-50%);background:rgba(100,0,200,0.92);color:#fff;padding:16px 32px;border-radius:12px;font-size:1.2rem;font-weight:900;letter-spacing:3px;z-index:9999;pointer-events:none;text-align:center;box-shadow:0 0 40px #8800ff;';
        document.body.appendChild(notif);
        setTimeout(() => notif.remove(), 3000);
      }
    }
    // MEGAKNIGHT cheat: type CLASSMEGAKNIGHT in menu
    if (_cheatBuffer.endsWith('CLASSMEGAKNIGHT')) {
      _cheatBuffer = '';
      unlockedMegaknight = true;
      if (typeof setAccountFlagWithRuntime === 'function') {
        setAccountFlagWithRuntime(['unlocks', 'megaknight'], true, function(v) { unlockedMegaknight = v; });
      } else if (typeof saveGame === 'function') {
        saveGame();
      }
      ['p1Class','p2Class'].forEach(id => {
        const sel = document.getElementById(id);
        if (sel && !sel.querySelector('option[value="megaknight"]')) {
          const opt = document.createElement('option'); opt.value = 'megaknight'; opt.textContent = 'Class: Megaknight ★'; sel.appendChild(opt);
        }
      });
      const notif2 = document.createElement('div');
      notif2.textContent = '★ Class: MEGAKNIGHT UNLOCKED ★';
      notif2.style.cssText = 'position:fixed;top:20%;left:50%;transform:translateX(-50%);background:rgba(80,0,160,0.95);color:#fff;padding:14px 32px;border-radius:12px;font-size:1.2rem;font-weight:900;letter-spacing:2px;z-index:9999;pointer-events:none;text-align:center;box-shadow:0 0 40px #8844ff;';
      document.body.appendChild(notif2);
      setTimeout(() => notif2.remove(), 3000);
    }
  }
  const _nk = _normKey(e.key);
  if (SCROLL_BLOCK.has(_nk)) e.preventDefault();
  if (keysDown.has(_nk)) return; // already tracked — let held-frame counter run
  keysDown.add(_nk);

  if (!gameRunning || paused) return;
  // Block attack/ability/super keydown events during the TF opening cinematic (after free period)
  if (typeof tfOpeningFightActive !== 'undefined' && tfOpeningFightActive
      && (typeof _tfOpeningFreeFrames === 'undefined' || _tfOpeningFreeFrames <= 0)) return;

  players.forEach((p, i) => {
    if (p.isAI || p.health <= 0) return;
    const other         = players[i === 0 ? 1 : 0];
    const incapacitated = p.ragdollTimer > 0 || p.stunTimer > 0;
    // Paradox Fusion: block all direct player actions while Paradox owns controls
    if (p._fusionAIOverride) return;
    if (_nk === p.controls.attack) {
      e.preventDefault();
      if (!incapacitated) { p.attack(other); }
      else { p._inputBuffer = { action: 'attack', frame: frameCount }; }
    }
    if (_nk === p.controls.ability) {
      e.preventDefault();
      // Depth phase: Q = move toward background layer (-Z) — not bufferable
      if (typeof tfDepthPhaseActive !== 'undefined' && tfDepthPhaseActive &&
          typeof tfDepthEnabled !== 'undefined' && tfDepthEnabled && !p.isAI) {
        p.z = Math.max(-1, (p.z || 0) - 0.3);
        spawnParticles(p.cx(), p.cy(), '#8844ff', 4);
      } else if (!incapacitated) {
        p.ability(other);
      } else {
        p._inputBuffer = { action: 'ability', frame: frameCount };
      }
    }
    if (p.controls.super && _nk === p.controls.super) {
      e.preventDefault();
      // Depth phase: E = move toward foreground layer (+Z) — not bufferable
      if (typeof tfDepthPhaseActive !== 'undefined' && tfDepthPhaseActive &&
          typeof tfDepthEnabled !== 'undefined' && tfDepthEnabled && !p.isAI) {
        p.z = Math.min(1, (p.z || 0) + 0.3);
        spawnParticles(p.cx(), p.cy(), '#00aaff', 4);
      } else if (!incapacitated) {
        checkSecretLetterCollect(p);
        p.useSuper(other);
      } else {
        p._inputBuffer = { action: 'super', frame: frameCount };
      }
    }
  });
});

document.addEventListener('keyup', e => {
  const _nk = _normKey(e.key);
  keysDown.delete(_nk);
  delete keyHeldFrames[_nk];
});

// When the tab loses focus, clear all held keys so players can't exploit
// held-key persistence (floating, invincibility timer freeze, etc.)
function _clearAllKeys() {
  keysDown.clear();
  for (const k in keyHeldFrames) delete keyHeldFrames[k];
}
window.addEventListener('blur', _clearAllKeys);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) _clearAllKeys();
});

const SHIELD_MAX    = 140;  // max frames shield stays up (~2.3 s)
const SHIELD_CD     = 180; // 3-second cooldown at 60 fps

function processInput() {
  if (!gameRunning || paused) return;
  if (gameLoading) return; // freeze input while loading screen is visible
  if (activeCinematic) return; // freeze player controls during boss cinematics
  if (gameFrozen) return;      // hard freeze during cinematics — halts all input
  if (tfAbsorptionScene) return; // freeze all input during absorption cinematic
  if (typeof isCutsceneActive === 'function' && isCutsceneActive()) return; // freeze during cutscenes
  // Combat lock: highest-priority phase (cinematic/finisher) blocks all player input
  if (typeof isCombatLocked === 'function' && isCombatLocked('input')) return;
  // Lock player input only after the 5-second free period has elapsed
  if (typeof tfOpeningFightActive !== 'undefined' && tfOpeningFightActive
      && (typeof _tfOpeningFreeFrames === 'undefined' || _tfOpeningFreeFrames <= 0)) return;

  // Paradox Control Override — tick the canonical controlState/controlTimer
  // Hard rule: only ONE controller is active at a time; no overlap.
  if (typeof tfParadoxFused !== 'undefined' && tfParadoxFused) {
    // --- Safeguard 1: controlState must always be a known value ---
    if (controlState !== 'player' && controlState !== 'paradox') {
      controlState = 'player';
      controlTimer = 0;
    }

    // --- Safeguard 2: controlTimer must never go negative ---
    if (typeof controlTimer !== 'undefined' && controlTimer < 0) {
      controlTimer = 0;
    }

    // --- Safeguard 3: boss death → immediately return control to player ---
    const _paradoxBoss = players.find(p => p.isBoss);
    if (_paradoxBoss && _paradoxBoss.health <= 0 && controlState !== 'player') {
      controlState = 'player';
      controlTimer = 0;
      tfFusionControlMode = 'player';
      const _fp1Early = players[0];
      if (_fp1Early) { _fp1Early._fusionAIOverride = false; }
    }

    // --- Safeguard 4: player (P1) death → disable Paradox control loop ---
    const _paradoxP1 = players[0];
    if (_paradoxP1 && _paradoxP1.health <= 0) {
      if (_paradoxP1._fusionAIOverride) { _paradoxP1._fusionAIOverride = false; }
      // Skip the rest of the Paradox control tick this frame
    } else {

    // Initialise on first entry (timer will be 0 when fusion first activates)
    if (typeof controlTimer !== 'undefined' && controlTimer <= 0) {
      // Assign a fresh random duration based on who currently owns controls
      if (controlState === 'player') {
        controlTimer = 180 + Math.floor(Math.random() * 121); // 180–300 frames
      } else {
        controlTimer = 120 + Math.floor(Math.random() * 121); // 120–240 frames
      }
    }

    // Count down; switch ownership the moment the timer expires
    if (typeof controlTimer !== 'undefined') {
      controlTimer--;
      if (controlTimer <= 0) {
        // Flip ownership — exactly one switch, no overlap
        controlState = (controlState === 'player') ? 'paradox' : 'player';
        // Assign duration for the NEW owner
        if (controlState === 'player') {
          controlTimer = 180 + Math.floor(Math.random() * 121); // 180–300
        } else {
          controlTimer = 120 + Math.floor(Math.random() * 121); // 120–240
        }
        // Keep legacy variable in sync for rendering/other systems
        tfFusionControlMode = controlState;
        tfFusionGlitchTimer = 20;
        // Clear any buffered key state for P1 so no inputs bleed across the boundary
        const _fp1 = players[0];
        if (_fp1 && _fp1.controls) {
          for (const k of Object.values(_fp1.controls)) { delete keyHeldFrames[k]; }
        }
        // When paradox takes over: abort any in-progress attack swing immediately
        if (controlState === 'paradox' && _fp1) {
          _fp1.attackTimer  = 0;
          _fp1.attackEndlag = 0;
          _fp1.shielding    = false;
          // Short freeze + visual burst
          hitStopFrames = Math.max(hitStopFrames, 5);
          if (typeof tfSwitchToParadoxFlash !== 'undefined') tfSwitchToParadoxFlash = 18;
        }
        // When player regains control: quick fade-out effect
        if (controlState === 'player' && typeof tfSwitchToPlayerFade !== 'undefined') {
          tfSwitchToPlayerFade = 12;
        }
      }
    }

    // When Paradox owns controls: force AI behaviour on P1
    const _fusionP1 = players[0];
    if (_fusionP1 && !_fusionP1.isBoss) {
      _fusionP1._fusionAIOverride = (controlState === 'paradox');
    }
    if (controlState === 'paradox' && _fusionP1 && typeof paradoxFusionUpdateAI === 'function') {
      if (aiTick % AI_TICK_INTERVAL === 0) paradoxFusionUpdateAI(_fusionP1);
    }
    } // end safeguard-4 else (player alive)
  }

  // Update key-held counters
  for (const k of keysDown) keyHeldFrames[k] = (keyHeldFrames[k] || 0) + 1;

  players.forEach(p => {
    if (p.isAI || p.health <= 0) return;
    if (p._fusionAIOverride) return; // Paradox Fusion: AI handles movement, skip keyboard input
    if (p.ragdollTimer > 0 || p.stunTimer > 0) {
      // Expire stale buffer so it can't fire far outside the intended window
      if (p._inputBuffer && (frameCount - p._inputBuffer.frame) > 8) p._inputBuffer = null;
      p.shielding = false;
      return;
    }
    // Input buffer: if a buffered action was queued while incapacitated and the
    // window (~133ms / 8 frames) hasn't expired, execute it now and clear.
    if (p._inputBuffer) {
      if ((frameCount - p._inputBuffer.frame) <= 8) {
        const _buf      = p._inputBuffer;
        const _pi       = players.indexOf(p);
        const _bufOther = players[_pi === 0 ? 1 : 0];
        p._inputBuffer  = null;
        if      (_buf.action === 'attack')  p.attack(_bufOther);
        else if (_buf.action === 'ability') p.ability(_bufOther);
        else if (_buf.action === 'super')   { checkSecretLetterCollect(p); p.useSuper(_bufOther); }
      } else {
        p._inputBuffer = null; // window expired
      }
    }

    const hasCurseSlow = p.curses && p.curses.some(c => c.type === 'curse_slow');
    const _chaosSpeed = gameMode === 'minigames' && currentChaosModifiers.has('speedy') ? 1.4 : 1.0;
    const _underwaterSlow = currentArena && currentArena.isSlowMovement ? 0.72 : 1.0;
    const _earthSlow      = currentArena && currentArena.earthPhysics   ? 0.70 : 1.0;
    // Anti-kite decay (0.70-1.0), shooting penalty (0.85 while firing ranged / 0.78 post-burst)
    const _kiteMult    = (p._kiteSpeedMult != null) ? p._kiteSpeedMult : 1.0;
    const _isRanged    = p.weapon && p.weapon.type === 'ranged';
    const _tfAntiBoss  = typeof getTrueFormAntiRangedBoss === 'function' ? getTrueFormAntiRangedBoss() : null;
    const _rangeLockMult = _tfAntiBoss && !p.isBoss
      ? (Math.abs(p.cx() - _tfAntiBoss.cx()) > (_tfAntiBoss._antiRangedFieldR || 220)
          ? (_isRanged ? 0.58 : 0.72)
          : 1.0)
      : 1.0;
    const _shootingMult = _isRanged && p.attackTimer > 0   ? 0.78
                        : _isRanged && p._rangedMovePenalty > 0 ? 0.70 : 1.0;
    const _commitMult  = _isRanged && p._rangedCommitTimer > 0 ? 0.64 : 1.0;
    const spd  = 5.2 * (p.classSpeedMult || 1.0) * (p._speedBuff > 0 ? 1.35 : 1.0) * (hasCurseSlow ? 0.6 : 1.0) * _chaosSpeed * _underwaterSlow * _earthSlow * _kiteMult * _shootingMult * _commitMult * _rangeLockMult;
    const wHeld = keyHeldFrames[p.controls.jump]  || 0;


    // --- Regular movement ---
    // True Form: inverted controls for human players only
    const _ctrlInv  = (!p.isAI) && ((gameMode === 'trueform' && tfControlsInverted) || (currentArenaKey === 'mirror' && mirrorFlipped));
    const _leftKey  = _ctrlInv ? p.controls.right : p.controls.left;
    const _rightKey = _ctrlInv ? p.controls.left  : p.controls.right;
    const movingLeft  = keysDown.has(_leftKey);
    const movingRight = keysDown.has(_rightKey);
    if (movingLeft) {
      p.vx = -spd;
      p.facing = -1; // face direction of last key pressed
    }
    if (movingRight) {
      p.vx =  spd;
      p.facing = 1;  // face direction of last key pressed
    }
    // Decay acceleration ramp when no direction key held

    // --- Jump (ground jump + double jump) ---
    if (wHeld === 1) {
      // Megaknight gets higher jump power
      const jumpPower = p.charClass === 'megaknight' ? -22 : -17;
      const dblPower  = p.charClass === 'megaknight' ? -16 : -13;
      if (p.onGround || (p.coyoteFrames > 0 && !p.canDoubleJump)) {
        // Ground jump (or coyote jump — briefly after walking off a platform)
        p.vy = jumpPower;
        p.canDoubleJump = true; // enable one double-jump after leaving ground
        p.coyoteFrames  = 0;   // consume coyote window
        if (p._rd) PlayerRagdoll.applyJump(p);
        spawnParticles(p.cx(), p.y + p.h, '#ffffff', 5);
        if (p.charClass === 'megaknight') spawnParticles(p.cx(), p.y + p.h, '#8844ff', 5);
        SoundManager.jump();
      } else if (p.canDoubleJump && !p._noDoubleJump) {
        // Double jump in air — gated by skill flag in story mode
        p.vy = dblPower;
        p.canDoubleJump = false;
        spawnParticles(p.cx(), p.cy(), p.color,  8);
        spawnParticles(p.cx(), p.cy(), '#ffffff', 5);
        SoundManager.jump();
      }
    }
    // --- S / ArrowDown = boost shield (30-second cooldown) ---
    const sHeld = keysDown.has(p.controls.shield);
    if (sHeld && p.shieldCooldown === 0 && !(p.weapon && p.weapon.type === 'ranged' && p._rangedCommitTimer > 0)) {
      p.shielding       = true;
      p.shieldHoldTimer = (p.shieldHoldTimer || 0) + 1;
      if (p.shieldHoldTimer >= SHIELD_MAX) {
        // Max duration exhausted → forced break and start cooldown
        p.shielding       = false;
        p.shieldCooldown  = SHIELD_CD;
        p.shieldHoldTimer = 0;
      }
    } else {
      if (p.shielding && !sHeld) {
        // Player released S — start cooldown if they used it for more than 3 frames
        if ((p.shieldHoldTimer || 0) > 3) p.shieldCooldown = SHIELD_CD;
        p.shielding       = false;
        p.shieldHoldTimer = 0;
      }
      if (!sHeld) p.shielding = false;
    }
    // Paradox Fusion: ability key triggers paradox abilities during player control phase
    if (typeof tfParadoxFused !== 'undefined' && tfParadoxFused &&
        typeof tfFusionControlMode !== 'undefined' && tfFusionControlMode === 'player' &&
        !p._fusionAIOverride) {
      const _abilityHeldFrames = keyHeldFrames[p.controls.ability] || 0;
      if (_abilityHeldFrames === 1 && typeof paradoxPlayerUseAbility === 'function') {
        paradoxPlayerUseAbility(p);
      }
    }
    // Fracture interaction — E key (super) or ability key on P1 near an unlocked fracture
    if (!p.isAI && p === players[0] && typeof checkFractureInteraction === 'function') {
      const _ePressed = (keyHeldFrames[p.controls.super] || 0) === 1;
      checkFractureInteraction(p, _ePressed);
    }
  });
}

// ============================================================
// CHEAT: UNLOCK ALL
// ============================================================
function _cheatUnlockAll() {
  // Boss
  bossBeaten = true;
  if (typeof setAccountFlagWithRuntime === 'function') {
    setAccountFlagWithRuntime(['unlocks', 'bossBeaten'], true, function(v) { bossBeaten = v; });
  }
  const bossCard = document.getElementById('modeBoss');
  if (bossCard) bossCard.style.display = '';

  // True Form
  unlockedTrueBoss = true;
  if (typeof setAccountFlagWithRuntime === 'function') {
    setAccountFlagWithRuntime(['unlocks', 'trueform'], true, function(v) { unlockedTrueBoss = v; });
    setAccountFlagWithRuntime(['unlocks', 'letters'], [0,1,2,3,4,5,6,7], function() {});
  }
  collectedLetterIds = new Set([0,1,2,3,4,5,6,7]);
  syncCodeInput && syncCodeInput();
  const tfCard = document.getElementById('modeTrueForm');
  if (tfCard) tfCard.style.display = '';

  // Sovereign
  sovereignBeaten = true;
  if (typeof setAccountFlagWithRuntime === 'function') {
    setAccountFlagWithRuntime(['unlocks', 'sovereignBeaten'], true, function(v) { sovereignBeaten = v; });
  }
  const _adCard  = document.getElementById('modeAdaptive');
  const _sovCard = document.getElementById('modeSovereign');
  if (_adCard)  _adCard.style.display  = '';
  if (_sovCard) _sovCard.style.display = '';

  // Megaknight
  unlockedMegaknight = true;
  if (typeof setAccountFlagWithRuntime === 'function') {
    setAccountFlagWithRuntime(['unlocks', 'megaknight'], true, function(v) { unlockedMegaknight = v; });
  }
  ['p1Class','p2Class'].forEach(id => {
    const sel = document.getElementById(id);
    if (sel && !sel.querySelector('option[value="megaknight"]')) {
      const opt = document.createElement('option'); opt.value = 'megaknight'; opt.textContent = 'Class: Megaknight ★'; sel.appendChild(opt);
    }
  });

  // All achievements
  if (typeof ACHIEVEMENTS !== 'undefined') {
    ACHIEVEMENTS.forEach(a => {
      if (typeof unlockAchievement === 'function') unlockAchievement(a.id);
    });
  }

  // Story: mark all chapters beaten + max tokens
  if (typeof _story2 !== 'undefined' && typeof STORY_CHAPTERS2 !== 'undefined') {
    STORY_CHAPTERS2.forEach(ch => {
      if (!_story2.defeated.includes(ch.id)) _story2.defeated.push(ch.id);
      // Unlock all blueprints that chapters drop
      if (ch.blueprintDrop && !_story2.blueprints.includes(ch.blueprintDrop)) {
        _story2.blueprints.push(ch.blueprintDrop);
      }
    });
    _story2.chapter = STORY_CHAPTERS2.length;
    _story2.tokens  = 99999;
    _story2.exp     = 99999;
    _story2.storyComplete = true;

    // Max out meta upgrades (shop items with ranks)
    if (!_story2.metaUpgrades) _story2.metaUpgrades = {};
    _story2.metaUpgrades.damage        = 6;
    _story2.metaUpgrades.survivability = 6;
    _story2.metaUpgrades.healUses      = 0; // not a rank cap, skip

    // Purchase all story abilities
    if (typeof STORY_ABILITIES2 !== 'undefined') {
      if (!Array.isArray(_story2.unlockedAbilities)) _story2.unlockedAbilities = [];
      Object.keys(STORY_ABILITIES2).forEach(key => {
        if (!_story2.unlockedAbilities.includes(key)) _story2.unlockedAbilities.push(key);
      });
    }

    // Max out skill tree (unlock every node, ignoring cost/prereq order)
    if (typeof STORY_SKILL_TREE !== 'undefined') {
      if (!_story2.skillTree) _story2.skillTree = {};
      for (const branch of Object.values(STORY_SKILL_TREE)) {
        for (const node of branch.nodes) {
          _story2.skillTree[node.id] = true;
        }
      }
    }

    if (typeof _saveStory2 === 'function') _saveStory2();
    if (typeof _updateStoryCloseBtn === 'function') _updateStoryCloseBtn();
    // Reveal story online card if present
    const soCard = document.getElementById('modeStoryOnline');
    if (soCard) soCard.style.display = '';
  }

  // Persist immediately so a page reload doesn't lose the unlocks
  if (typeof saveGame === 'function') saveGame();

  // Notify
  const notif = document.createElement('div');
  notif.textContent = '★ EVERYTHING UNLOCKED ★';
  notif.style.cssText = 'position:fixed;top:20%;left:50%;transform:translateX(-50%);background:linear-gradient(135deg,rgba(160,0,255,0.95),rgba(255,150,0,0.95));color:#fff;padding:16px 40px;border-radius:12px;font-size:1.25rem;font-weight:900;letter-spacing:3px;z-index:9999;pointer-events:none;text-align:center;box-shadow:0 0 50px #ff8800,0 0 20px #cc00ff;';
  document.body.appendChild(notif);
  setTimeout(() => notif.remove(), 3500);
}

// ============================================================
// EXPERIMENTAL CODE SYSTEM
// ============================================================
function applyCode(val) {
  const code  = (val || '').trim().toUpperCase();
  const msgEl = document.getElementById('codeMessage');
  const ok  = (t) => { if (msgEl) { msgEl.textContent = '✓ ' + t; msgEl.style.color = '#44ff88'; msgEl.style.fontSize = ''; } };
  const err = (t) => { if (msgEl) { msgEl.textContent = '✗ ' + t; msgEl.style.color = '#ff4444'; msgEl.style.fontSize = ''; } };

  if (code === 'TRUEFORM') {
    unlockedTrueBoss = true;
    if (typeof setAccountFlagWithRuntime === 'function') {
      setAccountFlagWithRuntime(['unlocks', 'trueform'], true, function(v) { unlockedTrueBoss = v; });
    }
    const card = document.getElementById('modeTrueForm');
    if (card) card.style.display = '';
    ok('True Creator unlocked! Start a boss fight.');
  } else if (code === 'SOVEREIGN') {
    sovereignBeaten = true;
    if (typeof setAccountFlagWithRuntime === 'function') {
      setAccountFlagWithRuntime(['unlocks', 'sovereignBeaten'], true, function(v) { sovereignBeaten = v; });
    }
    const adCard  = document.getElementById('modeAdaptive');
    const sovCard = document.getElementById('modeSovereign');
    if (adCard)  adCard.style.display  = '';
    if (sovCard) sovCard.style.display = '';
    ok('SOVEREIGN Ω unlocked! Select it from the menu.');
  } else if (code === 'CLASSMEGAKNIGHT') {
    unlockedMegaknight = true;
    if (typeof setAccountFlagWithRuntime === 'function') {
      setAccountFlagWithRuntime(['unlocks', 'megaknight'], true, function(v) { unlockedMegaknight = v; });
    }
    ['p1Class','p2Class'].forEach(id => {
      const sel = document.getElementById(id);
      if (sel && !sel.querySelector('option[value="megaknight"]')) {
        const opt = document.createElement('option'); opt.value = 'megaknight'; opt.textContent = 'Class: Megaknight ★'; sel.appendChild(opt);
      }
    });
    ok('Megaknight class unlocked! Select it in the class dropdown.');
  } else if (code.startsWith('MAP:')) {
    const mapKey = code.slice(4).toLowerCase();
    if (!ARENAS[mapKey]) { err('Unknown arena. Try: grass lava space city forest ice ruins'); return; }
    if (gameRunning) {
      switchArena(mapKey);
      ok('Switched to ' + mapKey + ' arena!');
    } else {
      selectedArena = mapKey;
      document.querySelectorAll('.arena-card').forEach(c => c.classList.toggle('active', c.dataset.arena === mapKey));
      ok('Arena set to ' + mapKey + '!');
    }
  } else if (code.startsWith('WEAPON:')) {
    const wKey = code.slice(7).toLowerCase();
    if (!WEAPONS[wKey]) { err('Unknown weapon. Try: sword hammer gun axe spear bow shield scythe'); return; }
    if (gameRunning) {
      const p = players.find(pl => !pl.isAI && !pl.isBoss);
      if (p) { p.weaponKey = wKey; p.weapon = WEAPONS[wKey]; p.cooldown = 0; p.abilityCooldown = 0; }
      ok('Weapon changed to ' + wKey + '!');
    } else { err('Enter WEAPON: codes while in-game.'); }
  } else if (code.startsWith('CLASS:')) {
    const cKey = code.slice(6).toLowerCase();
    if (!CLASSES[cKey] && cKey !== 'megaknight') { err('Unknown class. Try: none thor kratos ninja gunner archer paladin berserker megaknight'); return; }
    if (gameRunning) {
      const p = players.find(pl => !pl.isAI && !pl.isBoss);
      if (p) applyClass(p, cKey);
      ok('Class changed to ' + cKey + '!');
    } else { err('Enter CLASS: codes while in-game.'); }
  } else if (code === 'GODMODE') {
    if (gameRunning) {
      const p = players.find(pl => !pl.isAI && !pl.isBoss);
      if (p) { p.invincible = 99999; p.health = p.maxHealth; p.godmode = true; }
      ok('GOD MODE — invincible + flight (jump=up, shield=down)!');
    } else { err('Enter GODMODE while in-game.'); }
  } else if (code === 'FULLHEAL') {
    if (gameRunning) {
      players.filter(pl => !pl.isBoss).forEach(p => { p.health = p.maxHealth; spawnParticles(p.cx(), p.cy(), '#44ff88', 18); });
      ok('All players fully healed!');
    } else { err('Enter FULLHEAL while in-game.'); }
  } else if (code === 'SUPERJUMP') {
    if (gameRunning) {
      const p = players.find(pl => !pl.isAI && !pl.isBoss);
      if (p) { p.vy = -36; p.canDoubleJump = true; }
      ok('SUPER JUMP!');
    } else { err('Enter SUPERJUMP while in-game.'); }
  } else if (code === 'KILLBOSS') {
    if (gameRunning) {
      const boss = players.find(p => p.isBoss);
      if (boss) boss.health = 1;
      ok('Boss is nearly dead!');
    } else { err('Enter KILLBOSS while in-game.'); }
  } else if (code.startsWith('SETHP:')) {
    // SETHP:<n> — set TrueForm (Axion) HP and bypass all cinematics above that threshold.
    // Example: SETHP:1001  →  boss at 1001 HP, paradox1000 cinematic ready to fire.
    if (!gameRunning) { err('Enter SETHP: while in a TrueForm fight.'); return; }
    const _targetHp = parseInt(code.slice(6), 10);
    if (isNaN(_targetHp) || _targetHp < 1) { err('Usage: SETHP:<number>  e.g. SETHP:1001'); return; }
    const _tfBoss = players.find(p => p.isBoss && p.isTrueForm);
    if (!_tfBoss) { err('No TrueForm boss found. Start a True Form fight first.'); return; }

    // ── 1. Set HP ────────────────────────────────────────────────────────────
    _tfBoss.health    = Math.min(_targetHp, _tfBoss.maxHealth);
    _tfBoss.invincible = 90; // brief invincibility so the HP set doesn't immediately trigger death

    // ── 2. Mark all cinematics that would have fired above _targetHp ─────────
    if (!_tfBoss._cinematicFired) _tfBoss._cinematicFired = new Set();
    // 'entry' always fires at fight start
    _tfBoss._cinematicFired.add('entry');
    if (_targetHp < 7500) _tfBoss._cinematicFired.add('qte75');
    if (_targetHp < 5000) { _tfBoss._cinematicFired.add('50'); }
    if (_targetHp < 2500) _tfBoss._cinematicFired.add('qte25');
    if (_targetHp < 1500) _tfBoss._cinematicFired.add('15');
    // paradox1000 fires at <=1000; only pre-mark if we're setting above that
    if (_targetHp <= 1000) _tfBoss._cinematicFired.add('paradox1000');
    // false victory no longer HP-triggered; never pre-mark it

    // ── 3. Reset in-flight cinematic state ──────────────────────────────────
    // Stop opening fight if it was running
    if (typeof tfOpeningFightActive !== 'undefined') tfOpeningFightActive = false;
    if (typeof _tfOpeningTFRef     !== 'undefined') _tfOpeningTFRef      = null;
    if (typeof paradoxEntity       !== 'undefined' && paradoxEntity) {
      paradoxEntity.done = true;
      paradoxEntity = null;
    }
    // Reset absorption / paradox death flags so the 1000-HP sequence can run clean
    if (typeof paradoxDeathComplete !== 'undefined') paradoxDeathComplete = false;
    if (typeof absorptionComplete   !== 'undefined') absorptionComplete   = false;
    if (typeof _tfAbsorptionState   !== 'undefined') _tfAbsorptionState   = null;
    if (typeof tfAbsorptionScene    !== 'undefined') tfAbsorptionScene    = null;
    if (typeof tfFinalParadoxFired  !== 'undefined') tfFinalParadoxFired  = false;

    // Cancel any active cinematic / QTE
    if (typeof activeCinematic !== 'undefined') activeCinematic = null;
    if (typeof isCinematic     !== 'undefined') isCinematic     = false;
    if (typeof slowMotion      !== 'undefined') slowMotion       = 1.0;
    if (typeof gameFrozen      !== 'undefined') gameFrozen       = false;
    if (typeof cinematicCamOverride !== 'undefined') cinematicCamOverride = false;
    // Hard-reset combatLock so no phase leaks across game sessions
    if (typeof combatLock !== 'undefined') {
      combatLock.phase    = 'normal';
      combatLock.priority = 0;
      combatLock.blocks   = { ai: false, movement: false, input: false };
    }
    if (typeof activeQTE       !== 'undefined' && activeQTE) {
      if (typeof cancelQTE === 'function') cancelQTE();
      else activeQTE = null;
    }

    // Ensure fight state is 'none' (or 'backstage' if we're past the Code Realm)
    if (typeof tfCinematicState !== 'undefined') {
      tfCinematicState = (_targetHp <= 50) ? 'backstage' : 'none';
    }

    // Reset free-phase timer so it doesn't block AI
    _tfBoss._freePhaseTimer = 9999;

    // Reposition hero next to boss for easy testing
    const _hero = players.find(p => !p.isBoss && !p.isRemote);
    if (_hero) {
      _hero.x  = Math.max(40, _tfBoss.x - 160);
      _hero.y  = _tfBoss.y;
      _hero.vx = 0; _hero.vy = 0;
      _hero.health = _hero.maxHealth; // full HP so player doesn't die during test
    }

    ok('TrueForm HP → ' + _tfBoss.health + '. Cinematics above this threshold bypassed.');
  } else if (code === 'UNLOCKALL') {
    _cheatUnlockAll();
    ok('Everything unlocked!');
  } else if (code === 'HELP' || code === 'CODES') {
    if (msgEl) {
      msgEl.textContent = 'TRUEFORM · SOVEREIGN · CLASSMEGAKNIGHT · UNLOCKALL · GODMODE · FULLHEAL · KILLBOSS · SETHP:<n> · MAP:<arena> · WEAPON:<key> · CLASS:<key>';
      msgEl.style.color = '#aabbff'; msgEl.style.fontSize = '0.7rem';
    }
  } else {
    err('Unknown code. Type HELP for a list.');
  }
}
