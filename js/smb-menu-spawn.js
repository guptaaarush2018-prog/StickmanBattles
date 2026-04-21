'use strict';
// smb-menu-spawn.js — startGame entry, arena spawn bounds, safe spawn point helpers
// Depends on: smb-globals.js, smb-data-arenas.js, smb-menu-config.js
// Must load AFTER smb-menu-config.js, BEFORE smb-menu-startcore.js

function startGame() {
  // Story mode: reset per-fight event state when launching from story
  if (storyModeActive && typeof _onStoryFightStart === 'function') _onStoryFightStart();
  const fadeOv = document.getElementById('fadeOverlay');
  const loadOv = document.getElementById('loadOverlay');

  // Show loading overlay immediately (no dependency on fadeOv)
  if (loadOv) {
    const info    = _getLoadingInfo();
    const titleEl = document.getElementById('loadModeTitle');
    const subEl   = document.getElementById('loadModeSub');
    const imgEl   = document.getElementById('loadModeImg');
    if (titleEl) titleEl.textContent = info.title;
    if (subEl)   subEl.textContent   = info.subtitle;
    if (imgEl) {
      imgEl.src = info.image;
    }
    loadOv.style.display = 'flex';
    const bar = document.getElementById('loadBar');
    if (bar) { bar.style.width = '0%'; requestAnimationFrame(() => { bar.style.transition = 'width 0.75s ease'; bar.style.width = '100%'; }); }
  }
  if (fadeOv) fadeOv.style.opacity = '1';
  gameLoading = true; // freeze input/physics until game is fully started

  // Hold the loading screen for 800ms so the player can see it
  setTimeout(() => {
    _startGameCore();
    if (loadOv) setTimeout(() => { loadOv.style.display = 'none'; }, 200);
    if (fadeOv) setTimeout(() => { fadeOv.style.opacity = '0'; }, 300);
    // Unfreeze only after overlays are fully gone (~350ms fade) so bots can't act while loading screen is visible
    setTimeout(() => { gameLoading = false; }, 480);
  }, 800);
}

// Pick a safe spawn position on a platform in the preferred half of the arena.
// avoidX: if set, the result will be at least MIN_SPAWN_SEP pixels away horizontally.
// Returns {x, y} or null if no arena is loaded.
const MIN_SPAWN_SEP = 220; // minimum horizontal distance between two spawns
function _arenaSpawnBounds() {
  if (!currentArena || !Array.isArray(currentArena.platforms) || !currentArena.platforms.length) {
    return { left: 20, right: GAME_W - 20 };
  }
  const xs = currentArena.platforms.map(pl => pl.x);
  const xr = currentArena.platforms.map(pl => pl.x + pl.w);
  const left = currentArena.worldWidth
    ? Math.max(Math.min(...xs), (currentArena.mapLeft !== undefined ? currentArena.mapLeft : Math.min(...xs)) - GAME_W * 0.5)
    : 20;
  const right = currentArena.worldWidth
    ? Math.min(Math.max(...xr), (currentArena.mapRight !== undefined ? currentArena.mapRight : Math.max(...xr)) + GAME_W * 0.5)
    : GAME_W - 20;
  return { left, right };
}

function _spawnHazardFloorY() {
  if (!currentArena) return Infinity;
  if (currentArena.hasLava) return currentArena.lavaY || 442;
  // Both void (TrueForm) and creator (Boss) arenas use bossFloorState for floor hazards
  if ((currentArenaKey === 'void' || currentArenaKey === 'creator') && bossFloorState === 'hazard') return 460;
  return Infinity;
}

/**
 * isHazard(x, y) — returns true if the world-space point (x, y) falls inside
 * a damaging zone (lava surface, active boss-floor hazard).
 * Uses a small upward margin so spawns land clearly above the danger boundary.
 */
function isHazard(x, y) {
  if (!currentArena) return false;
  // Lava / magma floor
  if (currentArena.hasLava) {
    const ly = currentArena.lavaY || 442;
    if (y >= ly - 10) return true;
  }
  // Boss-arena floor hazard (void = TrueForm arena, creator = Boss arena)
  if ((currentArenaKey === 'void' || currentArenaKey === 'creator') &&
      bossFloorState === 'hazard' && y >= 450) return true;
  // Active boss beams — don't spawn players into a live beam column
  if (typeof bossBeams !== 'undefined' && Array.isArray(bossBeams)) {
    for (const beam of bossBeams) {
      if (beam.done || beam.phase !== 'active') continue;
      if (Math.abs(x - beam.x) < 28) return true;
    }
  }
  return false;
}

function _spawnPointSafe(x, y, w = 24, h = 60) {
  if (!currentArena || !Array.isArray(currentArena.platforms)) return false;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false;

  const bounds = _arenaSpawnBounds();
  const left   = x - w / 2;
  const right  = x + w / 2;
  const top    = y - h;
  const bottom = y;
  const hazardY = _spawnHazardFloorY();

  if (left < bounds.left + 8 || right > bounds.right - 8) return false;
  if (bottom >= hazardY - 8) return false;

  let support = null;
  for (const pl of currentArena.platforms) {
    if (!pl || pl.isFloorDisabled) continue;
    const overlapX = Math.min(right, pl.x + pl.w) - Math.max(left, pl.x);
    if (overlapX < Math.min(18, w * 0.55)) continue;
    const footGap = Math.abs(bottom - pl.y);
    if (footGap <= 6 && (!support || pl.y < support.y)) support = pl;
    const intersectsBody =
      right > pl.x + 4 &&
      left < pl.x + pl.w - 4 &&
      bottom > pl.y + 3 &&
      top < pl.y + pl.h - 2;
    if (intersectsBody) return false;
  }
  if (!support) return false;

  for (const other of currentArena.platforms) {
    if (!other || other === support || other.isFloorDisabled) continue;
    const blocksHead =
      right > other.x + 4 &&
      left < other.x + other.w - 4 &&
      top < other.y + other.h &&
      bottom > other.y + 2;
    if (blocksHead) return false;
  }

  return true;
}

function pickSafeSpawn(sideHint, avoidX) {
  if (!currentArena) return null;
  if (['void','soccer'].includes(currentArenaKey)) return null;

  const platforms = currentArena.platforms;
  const lavaY = currentArena.hasLava ? (currentArena.lavaY || 442) : Infinity;

  // For boss/creator arena: the floor can be disabled by hazard events.
  // Prefer non-floor platforms that are solid. Fall back to floor if available.
  // Use current pl.x (live, after random-lerp) so spawn lands on the actual platform.
  // Also exclude platforms at or below the lava line (would place spawns in lava).
  // lavaY - 90: keep spawns well above lava so players don't immediately burn on respawn
  // Fix 5: stricter lava margin — keep 120px above lava to account for fall arc
  const lavaMargin = currentArena.hasLava ? 120 : 90;
  const safe = platforms.filter(pl => !pl.isFloorDisabled && pl.w > 50 && pl.y < lavaY - lavaMargin);
  const raised = safe.filter(pl => !pl.isFloor);
  const floor  = safe.find(pl => pl.isFloor);

  // Fix 4: for story arenas with worldWidth, restrict candidates to visible starting section
  // to avoid spawning players on platforms 3000px away from the action.
  // Use camera position if available; otherwise default to first screen near mapLeft.
  let _storyPool = null;
  if (storyModeActive && currentArena.worldWidth) {
    const viewCX = (typeof camX === 'number' ? camX : (currentArena.mapLeft || 0)) + GAME_W / 2;
    const viewHalf = GAME_W * 0.75;
    const nearby = raised.filter(pl => Math.abs(pl.x + pl.w / 2 - viewCX) < viewHalf);
    _storyPool = nearby.length ? nearby : raised;
  }

  // Overhead clearance check: filter out platforms that have another platform within 100px above them
  function hasOverheadClearance(pl) {
    const spawnX = pl.x + pl.w / 2;
    const spawnY = pl.y;
    for (const other of platforms) {
      if (other === pl || other.isFloor) continue;
      // Check if 'other' is directly above this platform spawn point
      if (other.y + other.h > spawnY - 100 && other.y + other.h < spawnY &&
          other.x < spawnX + 20 && other.x + other.w > spawnX - 20) {
        return false;
      }
    }
    return true;
  }

  let pool;
  const raisedBase = _storyPool || raised;
  if (raisedBase.length) {
    // Prefer platforms with overhead clearance, then requested side
    const clear = raisedBase.filter(hasOverheadClearance);
    const usable = clear.length ? clear : raisedBase;
    const preferred = sideHint === 'any' ? usable
      : usable.filter(pl => sideHint === 'right' ? (pl.x + pl.w / 2 > GAME_W / 2) : (pl.x + pl.w / 2 < GAME_W / 2));
    pool = preferred.length ? preferred : usable;
  } else if (floor) {
    // Only the floor is available — place on appropriate side, far from avoidX.
    // For large worldWidth maps the floor may be wider than the viewport; use viewport-relative
    // coordinates so both players don't clamp to the same GAME_W edge.
    const ww = currentArena.worldWidth;
    let rx;
    if (ww) {
      // Viewport starts at mapLeft (or floor.x as a proxy). Spawn within first screen-width of world.
      const viewStart = currentArena.mapLeft !== undefined ? currentArena.mapLeft : floor.x;
      const viewSpan  = Math.min(GAME_W - 160, floor.w);
      rx = viewStart + viewSpan * (sideHint === 'right' ? 0.70 : 0.25);
      rx = Math.max(floor.x + 80, Math.min(floor.x + floor.w - 80, rx));
    } else {
      const fx = floor.x + (sideHint === 'right' ? floor.w * 0.65 : floor.w * 0.25);
      rx = Math.max(100, Math.min(GAME_W - 100, fx));
    }
    // If too close to avoidX, push to the far quarter of the view span
    if (avoidX !== undefined && Math.abs(rx - avoidX) < MIN_SPAWN_SEP) {
      const refW = ww ? Math.min(GAME_W - 160, floor.w) : (GAME_W - 200);
      const refL = ww ? (currentArena.mapLeft !== undefined ? currentArena.mapLeft : floor.x) : 100;
      rx = avoidX < refL + refW / 2
        ? Math.max(avoidX + MIN_SPAWN_SEP, refL + refW * 0.65)
        : Math.min(avoidX - MIN_SPAWN_SEP, refL + refW * 0.35);
      rx = Math.max(floor.x + 80, Math.min(floor.x + floor.w - 80, rx));
    }
    const floorCandidates = [
      rx,
      floor.x + floor.w * 0.22,
      floor.x + floor.w * 0.50,
      floor.x + floor.w * 0.78,
    ];
    for (const candX of floorCandidates) {
      if (_spawnPointSafe(candX, floor.y - 1)) return { x: candX, y: floor.y - 1 };
    }
    // Last-resort floor fallback: only return if not in a hazard zone
    if (!isHazard(rx, floor.y - 1)) return { x: rx, y: floor.y - 1 };
    // Floor is hazardous — use center-of-map safe position instead
    const safeHazY = _spawnHazardFloorY();
    return { x: GAME_W / 2, y: Math.min(safeHazY - 140, GAME_H * 0.55) };
  } else {
    return null; // no safe surface at all
  }

  // Spawn fairness: check if a candidate point is within 120px of a living enemy.
  function _spawnNearEnemy(x, y) {
    if (typeof players === 'undefined') return false;
    for (const p of players) {
      if (!p || p.health <= 0) continue;
      if (Math.hypot(p.x - x, p.y - y) < 120) return true;
    }
    return false;
  }

  // If avoidX is set, prefer platforms that are far enough away; fall back to any platform.
  // Secondary sort: prefer elevated platforms (lower y value = higher on screen) for fairer spawns.
  let chosenPool = pool;
  if (avoidX !== undefined) {
    const farPool = pool.filter(pl => Math.abs(pl.x + pl.w / 2 - avoidX) >= MIN_SPAWN_SEP);
    if (farPool.length) chosenPool = farPool;
  }
  const orderedPool = chosenPool
    .slice()
    .sort((a, b) => {
      const aMid = a.x + a.w / 2;
      const bMid = b.x + b.w / 2;
      // Primary: distance from avoidX (farther = better)
      const aScore = avoidX !== undefined ? Math.abs(aMid - avoidX) : 0;
      const bScore = avoidX !== undefined ? Math.abs(bMid - avoidX) : 0;
      if (bScore !== aScore) return bScore - aScore;
      // Secondary: prefer elevated platforms (smaller y = higher)
      return a.y - b.y;
    });

  for (const pl of orderedPool) {
    // Keep spawn within platform bounds without leaking outside the current arena
    const bounds = _arenaSpawnBounds();
    const safeLeft  = Math.max(pl.x + 14, bounds.left + 12);
    const safeRight = Math.min(pl.x + pl.w - 14, bounds.right - 12);
    if (!(safeLeft < safeRight)) continue;

    const samples = [
      safeLeft + (safeRight - safeLeft) * 0.18,
      safeLeft + (safeRight - safeLeft) * 0.50,
      safeLeft + (safeRight - safeLeft) * 0.82,
    ];
    if (avoidX !== undefined) {
      samples.push(avoidX < (safeLeft + safeRight) / 2
        ? Math.min(safeRight, avoidX + MIN_SPAWN_SEP)
        : Math.max(safeLeft, avoidX - MIN_SPAWN_SEP));
    }

    // Up to 50 random retries per platform to avoid hazards
    for (let i = 0; i < 50; i++) {
      samples.push(safeLeft + Math.random() * (safeRight - safeLeft));
    }

    for (const candX of samples) {
      if (avoidX !== undefined && Math.abs(candX - avoidX) < MIN_SPAWN_SEP * 0.72) continue;
      // Spawn 6px above platform surface so player lands cleanly and not inside geometry
      const spawnY = pl.y - 6;
      if (!isHazard(candX, spawnY) && _spawnPointSafe(candX, spawnY) && !_spawnNearEnemy(candX, spawnY)) return { x: candX, y: spawnY };
    }
  }

  // Last-resort: return the center of the best platform, validated against hazards.
  // If still unsafe, use map center above the hazard floor.
  const fallback = orderedPool[0];
  if (fallback) {
    const fbX = clamp(fallback.x + fallback.w / 2, fallback.x + 14, fallback.x + fallback.w - 14);
    const fbY = fallback.y - 6;
    if (!isHazard(fbX, fbY)) {
      // If still too close to an enemy, nudge to map center
      const fbSafeX = _spawnNearEnemy(fbX, fbY) ? GAME_W / 2 : fbX;
      return { x: fbSafeX, y: fbY };
    }
  }
  // Center-of-map safe fallback — well above any hazard floor
  const safeHazardY = _spawnHazardFloorY();
  const fallbackY = Math.min(safeHazardY - 140, GAME_H * 0.55);
  // If center is occupied, alternate to left or right quarter of the arena
  let fallbackX = GAME_W / 2;
  if (_spawnNearEnemy(fallbackX, fallbackY)) {
    fallbackX = _spawnNearEnemy(GAME_W * 0.2, fallbackY) ? GAME_W * 0.8 : GAME_W * 0.2;
  }
  return { x: fallbackX, y: fallbackY };
}

function pickSafeSpawnNear(preferredX, sideHint = 'any', avoidX) {
  if (!currentArena || !Array.isArray(currentArena.platforms)) return pickSafeSpawn(sideHint, avoidX);
  const hazardY = _spawnHazardFloorY();
  const bounds = _arenaSpawnBounds();
  const candidates = currentArena.platforms.filter(pl =>
    pl && !pl.isFloorDisabled && pl.w > 46 && pl.y < hazardY - 18
  );
  if (!candidates.length) return pickSafeSpawn(sideHint, avoidX);

  const desiredX = Number.isFinite(preferredX)
    ? clamp(preferredX, bounds.left + 24, bounds.right - 24)
    : (bounds.left + bounds.right) * 0.5;

  const filtered = sideHint === 'left'
    ? candidates.filter(pl => pl.x + pl.w / 2 <= desiredX + GAME_W * 0.15)
    : sideHint === 'right'
      ? candidates.filter(pl => pl.x + pl.w / 2 >= desiredX - GAME_W * 0.15)
      : candidates;
  const pool = filtered.length ? filtered : candidates;
  const ordered = pool
    .slice()
    .sort((a, b) => Math.abs((a.x + a.w / 2) - desiredX) - Math.abs((b.x + b.w / 2) - desiredX));

  for (const pl of ordered) {
    const left = Math.max(pl.x + 14, bounds.left + 12);
    const right = Math.min(pl.x + pl.w - 14, bounds.right - 12);
    if (!(left < right)) continue;
    const samples = [
      clamp(desiredX, left, right),
      clamp((left + right) * 0.5, left, right),
      left + (right - left) * 0.22,
      left + (right - left) * 0.78,
    ];
    for (let i = 0; i < 5; i++) samples.push(left + Math.random() * (right - left));
    for (const candX of samples) {
      if (avoidX !== undefined && Math.abs(candX - avoidX) < MIN_SPAWN_SEP * 0.66) continue;
      if (_spawnPointSafe(candX, pl.y - 1)) return { x: candX, y: pl.y - 1 };
    }
  }
  return pickSafeSpawn(sideHint, avoidX);
}

