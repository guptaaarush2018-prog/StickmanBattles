'use strict';

// ============================================================
// MAP ANALYZER  v2
// ============================================================
// analyzeMap(arena, key)  — returns a rich report object
// scoreMap(report)        — returns letter grade S/A/B/C/F
// formatMapAnalysis(r)    — human-readable string
// analyzeAllMaps()        — array of {key, ...report} for all ARENAS
// ============================================================

// Friendly display names — falls back to the arena key itself
const _ARENA_DISPLAY = {
  grass:      'Grasslands', lava:       'Lava Pit',   space:    'Deep Space',
  city:       'City Rooftops', void:    'The Void',   creator:  'Creator\'s Arena',
  forest:     'Haunted Forest', ice:    'Ice Shelf',  ruins:    'Ruins',
  soccer:     'Soccer Field',   cave:   'Crystal Cave', mirror: 'Mirror Realm',
  underwater: 'Ocean Depths',   volcano:'Volcano',    colosseum:'Colosseum',
  cyberpunk:  'Cyberpunk City',  haunted:'Haunted Mansion', clouds:'Cloud Kingdom',
  neonGrid:   'Neon Grid',  mushroom: 'Mushroom Grove',
  megacity:   'Mega City',  warpzone: 'Warp Zone',   colosseum10:'Grand Colosseum',
  homeYard:   'Home (Yard)',     homeAlley:'Home (Alley)', suburb:'Suburbs',
  rural:      'Rural Road',      portalEdge:'Portal Edge', realmEntry:'Realm Entry',
  bossSanctum:'Boss Sanctum',
};

// ─────────────────────────────────────────────────────────────
function analyzeMap(arena, key) {
  const displayName = (key && _ARENA_DISPLAY[key]) || arena.name || key || 'Unknown';
  const isLarge     = !!(arena.worldWidth);
  const mapWidth    = arena.worldWidth || GAME_W;
  const plats       = arena.platforms || [];
  const nonFloor    = plats.filter(p => !p.isFloor && !p.isCeiling);
  const floors      = plats.filter(p => p.isFloor);

  const report = {
    name:          displayName,
    key:           key || '?',
    platformCount: plats.length,
    nonFloorCount: nonFloor.length,
    size:          isLarge ? 'Large' : 'Standard',
    isLarge,
    issues:        [],
    strengths:     [],
    scores:        {},
    suggestions:   [],
  };

  // ── 1. Platform density score (platforms per 300px of map width) ─────
  const idealDensity = isLarge ? 2.5 : 1.8; // platforms per 300px
  const actualDensity = (nonFloor.length / mapWidth) * 300;
  report.scores.density = Math.round(Math.min(100, (actualDensity / idealDensity) * 100));
  if (nonFloor.length < 2) {
    report.issues.push('Too few platforms (combat is flat)');
    report.suggestions.push('Add 3–5 raised platforms to create vertical play');
  } else if (!isLarge && nonFloor.length > 14) {
    report.issues.push('Too many platforms — map feels cluttered');
    report.suggestions.push('Remove ' + (nonFloor.length - 10) + ' platforms, keep central landmarks');
  } else if (isLarge && nonFloor.length > 35) {
    report.issues.push('Platform density too high for map width');
    report.suggestions.push('Reduce to ~26 platforms; keep 4-tier structure with wider spacing');
  } else {
    report.strengths.push('Good platform density');
  }

  // ── 2. Vertical balance score ────────────────────────────────────────
  let vertScore = 50;
  if (nonFloor.length >= 2) {
    const ys       = nonFloor.map(p => p.y);
    const minY     = Math.min(...ys);
    const maxY     = Math.max(...ys);
    const spread   = maxY - minY;
    // Group into tiers (100px buckets)
    const tiers    = {};
    nonFloor.forEach(p => { const t = Math.floor(p.y / 100); tiers[t] = (tiers[t] || 0) + 1; });
    const tierCount = Object.keys(tiers).length;
    if (spread > 300 && tierCount >= 3) vertScore = 90;
    else if (spread > 200 && tierCount >= 2) vertScore = 70;
    else if (spread < 100) vertScore = 30;
  }
  report.scores.vertical = vertScore;
  if (vertScore >= 80)      report.strengths.push('Strong vertical gameplay');
  else if (vertScore < 40)  { report.issues.push('Flat map — poor vertical variety'); report.suggestions.push('Add platforms at 3+ height tiers (y ≈ 150, 270, 380)'); }

  // ── 3. Spawn fairness score ─────────────────────────────────────────
  let spawnScore = 100;
  const floor = floors[0];
  if (floor) {
    const leftSpawn  = floor.x + floor.w * 0.25;
    const rightSpawn = floor.x + floor.w * 0.65;
    const separation = rightSpawn - leftSpawn;
    const minSep     = isLarge ? 200 : 120;
    if (separation < minSep) {
      spawnScore = 30;
      report.issues.push('Spawn positions too close — players start in each other\'s face');
      report.suggestions.push('Widen floor or add separate spawn platforms 300px+ apart');
    } else if (isLarge) {
      // On large maps check viewport-relative separation (Phase 2 fixed spawn logic uses this)
      const viewSpan = Math.min(GAME_W - 160, floor.w);
      const effSep   = viewSpan * (0.70 - 0.25);
      if (effSep < 160) { spawnScore = 50; report.issues.push('Effective spawn separation narrow on this map width'); }
      else spawnScore = 90;
    }
    // Check if dominant wide platforms are near centre blocking spawn area
    const centrePlatform = nonFloor.find(p => p.w > 250 && Math.abs(p.x + p.w/2 - GAME_W/2) < 100);
    if (centrePlatform) report.strengths.push('Central landmark platform (good for contested fights)');
  }
  report.scores.spawn = spawnScore;
  if (spawnScore >= 80) report.strengths.push('Fair spawn distribution');

  // ── 4. Camera compatibility score ───────────────────────────────────
  let camScore = 90;
  if (isLarge) {
    const mapLeft  = arena.mapLeft  !== undefined ? arena.mapLeft  : 0;
    const mapRight = arena.mapRight !== undefined ? arena.mapRight : mapWidth;
    const hasWalls = (mapLeft !== undefined && mapRight !== undefined);
    if (!hasWalls)        { camScore -= 20; report.issues.push('No mapLeft/mapRight — camera clamping unavailable'); }
    if (!arena.groundColor) { camScore -= 10; report.issues.push('Missing groundColor — zoom-out may show raw canvas below floor'); report.suggestions.push('Add groundColor matching your floor/dirt theme'); }
    else report.strengths.push('Has groundColor (zoom-out safe)');
  }
  // High platform near y=0 can clip camera top
  const extremeHigh = nonFloor.find(p => p.y < 60);
  if (extremeHigh) { camScore -= 10; report.issues.push('Platform near top edge (y=' + extremeHigh.y + ') — may clip off screen'); report.suggestions.push('Move top-tier platforms to y ≥ 70'); }
  report.scores.camera = Math.max(0, camScore);
  if (camScore >= 85) report.strengths.push('Camera-friendly layout');

  // ── 5. Hazard evaluation ────────────────────────────────────────────
  if (arena.hasLava)         report.strengths.push('Lava hazard adds pressure');
  if (arena.isLowGravity)    report.strengths.push('Low gravity expands vertical play');
  if (arena.isHeavyGravity)  report.strengths.push('Heavy gravity increases ground game stakes');
  if (arena.isIcy)           report.strengths.push('Ice physics creates skill-expression moments');
  if (arena.boundaryPortals) report.strengths.push('Boundary portals prevent edge-camping');

  return report;
}

// ─────────────────────────────────────────────────────────────
function scoreMap(report) {
  const s = report.scores;
  // Weighted average of sub-scores
  const weighted = (
    (s.density  || 50) * 0.25 +
    (s.vertical || 50) * 0.30 +
    (s.spawn    || 50) * 0.25 +
    (s.camera   || 50) * 0.20
  );
  // Issue penalty: –8 per issue, strength bonus +3 each
  const adjusted = weighted - (report.issues.length * 8) + (report.strengths.length * 3);
  const final = Math.max(0, Math.min(100, adjusted));

  if (final >= 88) return 'S';
  if (final >= 74) return 'A';
  if (final >= 58) return 'B';
  if (final >= 42) return 'C';
  return 'F';
}

// ─────────────────────────────────────────────────────────────
function formatMapAnalysis(report) {
  const grade = scoreMap(report);
  const scores = report.scores;
  const lines = [
    `=== ${report.name} [${report.key}] — Grade: ${grade} ===`,
    `Size: ${report.size}  |  Total platforms: ${report.platformCount}  |  Raised: ${report.nonFloorCount}`,
    `Scores — Density:${scores.density}  Vertical:${scores.vertical}  Spawn:${scores.spawn}  Camera:${scores.camera}`,
    '',
  ];
  if (report.strengths.length) {
    lines.push('Strengths:');
    report.strengths.forEach(s => lines.push('  ✓ ' + s));
  }
  if (report.issues.length) {
    lines.push('Issues:');
    report.issues.forEach(i => lines.push('  ✗ ' + i));
  }
  if (report.suggestions.length) {
    lines.push('Suggestions:');
    report.suggestions.forEach(s => lines.push('  → ' + s));
  }
  if (!report.issues.length && !report.suggestions.length) lines.push('  No issues found.');
  lines.push('');
  return lines.join('\n');
}

// ─────────────────────────────────────────────────────────────
function analyzeAllMaps() {
  if (typeof ARENAS === 'undefined') return [];
  return Object.entries(ARENAS).map(([key, arena]) => {
    const r = analyzeMap(arena, key);
    return { key, grade: scoreMap(r), ...r };
  });
}
