'use strict';
// smb-heatmap.js — heatmap grid system (HMAP), heatAt(), updateHeatmap()
// Depends on: smb-globals.js
// DANGER HEATMAP — grid-based environmental hazard awareness
// Rebuilt once per frame; bots sample it to steer away from danger.
// ============================================================
const HMAP_COLS = 45;   // GAME_W / 20 ≈ 45 columns
const HMAP_ROWS = 26;   // GAME_H / 20 ≈ 26 rows
const HMAP_CELL = 20;   // world-units per cell

let _heatmap   = new Float32Array(HMAP_COLS * HMAP_ROWS);
let _heatFrame = -1;    // last frameCount when heatmap was rebuilt

/** Write danger value into one cell (takes the max of existing value). */
function _heatSet(col, row, val) {
  if (col < 0 || col >= HMAP_COLS || row < 0 || row >= HMAP_ROWS) return;
  const idx = row * HMAP_COLS + col;
  if (val > _heatmap[idx]) _heatmap[idx] = val;
}

/** Radial splat — write danger fading outward from world-point (wx, wy). */
function _heatSplat(wx, wy, radiusPx, peakVal) {
  const cr = Math.ceil(radiusPx / HMAP_CELL);
  const cc = Math.floor(wx / HMAP_CELL);
  const rc = Math.floor(wy / HMAP_CELL);
  for (let dr = -cr; dr <= cr; dr++) {
    for (let dc = -cr; dc <= cr; dc++) {
      const worldDx = dc * HMAP_CELL;
      const worldDy = dr * HMAP_CELL;
      const worldD  = Math.hypot(worldDx, worldDy);
      if (worldD <= radiusPx) {
        _heatSet(cc + dc, rc + dr, peakVal * (1 - worldD / radiusPx));
      }
    }
  }
}

/**
 * Sample danger value [0–1] at a world-space position.
 * Returns 0.95 for positions outside the game world.
 */
function heatAt(wx, wy) {
  const col = Math.floor(wx / HMAP_CELL);
  const row = Math.floor(wy / HMAP_CELL);
  if (col < 0 || col >= HMAP_COLS || row < 0 || row >= HMAP_ROWS) return 0.95;
  return _heatmap[row * HMAP_COLS + col];
}

/**
 * Rebuild the heatmap from current arena hazards.
 * Guard: no-op if already rebuilt this frame (safe to call from multiple bots).
 */
function updateHeatmap() {
  if (_heatFrame === frameCount) return;
  _heatFrame = frameCount;
  _heatmap.fill(0);

  const a = currentArena;
  if (!a) return;

  // --- Screen / map edges: high danger near left & right walls ---
  for (let row = 0; row < HMAP_ROWS; row++) {
    _heatSet(0, row, 0.80); _heatSet(1, row, 0.55); _heatSet(2, row, 0.30);
    _heatSet(HMAP_COLS - 1, row, 0.80);
    _heatSet(HMAP_COLS - 2, row, 0.55);
    _heatSet(HMAP_COLS - 3, row, 0.30);
  }

  // --- Bottom of screen: approaching death boundary ---
  const deathRow = Math.min(HMAP_ROWS - 1, Math.floor(((a.deathY || 640)) / HMAP_CELL));
  for (let col = 0; col < HMAP_COLS; col++) {
    for (let dr = 0; dr <= 5; dr++) {
      const row = Math.max(0, deathRow - dr);
      _heatSet(col, row, Math.min(0.95, 0.18 + dr * 0.16));
    }
  }

  // --- Lava floor (lava arena) ---
  if (a.hasLava && a.lavaY) {
    const lavaRow = Math.floor(a.lavaY / HMAP_CELL);
    for (let col = 0; col < HMAP_COLS; col++) {
      _heatSet(col, lavaRow,     1.00);
      _heatSet(col, lavaRow - 1, 0.88);
      _heatSet(col, lavaRow - 2, 0.68);
      _heatSet(col, lavaRow - 3, 0.44);
      _heatSet(col, lavaRow - 4, 0.24);
      _heatSet(col, lavaRow - 5, 0.10);
    }
  }

  // --- Boss arena floor hazard (lava or void floor removal) ---
  if (a.isBossArena) {
    if (bossFloorState === 'hazard') {
      const floorPl = a.platforms.find(p => p.isFloor);
      if (floorPl && floorPl.isFloorDisabled) {
        const floorRow = Math.floor(floorPl.y / HMAP_CELL);
        for (let col = 0; col < HMAP_COLS; col++) {
          _heatSet(col, floorRow,     1.00);
          _heatSet(col, floorRow + 1, 0.90);
          _heatSet(col, floorRow - 1, 0.72);
          _heatSet(col, floorRow - 2, 0.46);
          _heatSet(col, floorRow - 3, 0.22);
        }
      }
    } else if (bossFloorState === 'warning') {
      // Warning: lower danger but bots should start repositioning
      const floorPl = a.platforms.find(p => p.isFloor);
      if (floorPl) {
        const floorRow = Math.floor(floorPl.y / HMAP_CELL);
        for (let col = 0; col < HMAP_COLS; col++) {
          _heatSet(col, floorRow, 0.38);
          _heatSet(col, floorRow - 1, 0.20);
        }
      }
    }
  }

  // --- Boss beams (warning = moderate, active = very high) ---
  for (const beam of bossBeams) {
    const bCol = Math.floor(beam.x / HMAP_CELL);
    const val  = beam.phase === 'active' ? 1.00 : 0.50;
    const spread = beam.phase === 'active' ? 2 : 1;
    for (let row = 0; row < HMAP_ROWS; row++) {
      for (let dc = -spread; dc <= spread; dc++) {
        const falloff = 1 - Math.abs(dc) / (spread + 1);
        _heatSet(bCol + dc, row, val * falloff);
      }
    }
  }

  // --- TrueForm black holes ---
  for (const bh of tfBlackHoles) {
    _heatSplat(bh.x, bh.y, bh.r * 2.8, 0.92);
  }

  // --- Active projectiles (radial danger bubble) ---
  for (const pr of projectiles) {
    _heatSplat(pr.x, pr.y, 44, 0.45);
  }

  // --- TrueForm gravity: entire arena is lower danger if inverted (bots ignore ceiling-fall risk) ---
  // (no change needed — the bottom death row captures it)
}

