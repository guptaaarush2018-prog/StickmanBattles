'use strict';

// ============================================================
// ARENA DEFINITIONS
// ============================================================
const ARENAS = {
  grass: {
    sky:         ['#68c0ea', '#aadaf5'],
    groundColor: '#4a8f3f',
    platColor:   '#5aae4e',
    platEdge:    '#3a7030',
    hasLava:     false,
    deathY:      640,
    modifiers:   { gravityMult: 1.0, frictionMult: 1.0, hazardFrequency: 1.0 },
    platforms: [
      { x: -60,  y: 480, w: 1020, h: 40 }, // ground
      // density zone: center high — prominent central hub
      { x: 370,  y: 185, w: 160,  h: 18 }, // centre top
      // mid-left zone
      { x: 155,  y: 268, w: 155,  h: 18 }, // left mid
      // mid-right zone
      { x: 590,  y: 268, w: 155,  h: 18 }, // right mid
      // far-left edge — adds playable space at the extreme left
      { x:  18,  y: 152, w: 120,  h: 16 }, // far-left high
      // far-right edge
      { x: 762,  y: 152, w: 120,  h: 16 }, // far-right high
      // additional low platforms filling mid zones
      { x: 280,  y: 340, w: 110,  h: 14 }, // left-centre low
      { x: 510,  y: 340, w: 110,  h: 14 }, // right-centre low
    ]
  },
  lava: {
    sky:            ['#1a0000', '#3d0800'],
    groundColor:    '#ff4500',
    platColor:      '#6b2b0a',
    platEdge:       '#8b3a0f',
    hasLava:        true,
    isHeavyGravity: true,
    lavaY:       442,
    deathY:      580,
    modifiers:   { gravityMult: 1.1, frictionMult: 1.0, hazardFrequency: 1.2 },
    platforms: [
      { x: 360, y: 118, w: 180, h: 18 }, // top centre
      { x: 178, y: 208, w: 140, h: 18 }, // upper left
      { x: 582, y: 208, w: 140, h: 18 }, // upper right
      { x:  45, y: 300, w: 165, h: 18 }, // lower left
      { x: 690, y: 300, w: 165, h: 18 }, // lower right
      { x: 328, y: 285, w: 244, h: 18 }, // centre bridge
    ]
  },
  space: {
    sky:          ['#000010', '#000830'],
    groundColor:  '#2a2a4a',
    platColor:    '#3a3a6a',
    platEdge:     '#5a5a9a',
    hasLava:      false,
    deathY:       640,
    isLowGravity: true,
    modifiers:    { gravityMult: 0.85, frictionMult: 0.9, hazardFrequency: 0.8 },
    platforms: [
      { x: -60,  y: 480, w: 1020, h: 40 }, // asteroid belt floor
      { x: 350,  y: 170, w: 200,  h: 15 }, // centre station
      { x: 135,  y: 255, w: 155,  h: 15 }, // left mid asteroid
      { x: 610,  y: 255, w: 155,  h: 15 }, // right mid asteroid
      { x:  14,  y: 158, w: 110,  h: 15 }, // far-left satellite
      { x: 776,  y: 158, w: 110,  h: 15 }, // far-right satellite
      // low-gravity exploits more vertical space
      { x: 268,  y:  85, w: 100,  h: 14 }, // upper-left relay
      { x: 532,  y:  85, w: 100,  h: 14 }, // upper-right relay
      { x: 395,  y:  30, w: 110,  h: 14 }, // apex station
    ]
  },
  city: {
    sky:         ['#060614', '#121228'],
    groundColor: '#222233',
    platColor:   '#33334a',
    platEdge:    '#55556a',
    hasLava:     false,
    deathY:      640,
    modifiers:   { gravityMult: 1.0, frictionMult: 1.0, hazardFrequency: 1.1 },
    platforms: [
      { x: -60,  y: 438, w: 1020, h: 82 }, // continuous rooftop floor
      // far-left zone — fire escape / ledge
      { x:  18,  y: 320, w:  90,  h: 15 }, // far-left ledge
      // mid-left zone
      { x: 148,  y: 255, w: 130,  h: 15 }, // left mid
      // centre zone — elevated hub
      { x: 365,  y: 235, w: 170,  h: 15 }, // centre mid
      // mid-right zone
      { x: 622,  y: 255, w: 130,  h: 15 }, // right mid
      // far-right zone
      { x: 793,  y: 320, w:  90,  h: 15 }, // far-right ledge
      // upper cross-zone platforms
      { x: 240,  y: 155, w: 115,  h: 14 }, // left high
      { x: 545,  y: 155, w: 115,  h: 14 }, // right high
    ]
  },
  void: {
    sky:         ['#000000', '#050505'],
    groundColor: '#000000',
    platColor:   '#000000',
    platEdge:    '#ffffff',
    hasLava:     false,
    deathY:      640,
    isBossArena: true,
    isVoidArena: true,
    platforms: [
      { x: 0,   y: 460, w: 900, h: 60, isFloor: true, isFloorDisabled: false },
      { x: 280, y: 225, w: 200, h: 16 },
      { x: 80,  y: 295, w: 140, h: 16 },
      { x: 680, y: 295, w: 140, h: 16 },
    ]
  },
  damnation: {
    sky:         ['#0a0000', '#1a0000'],
    groundColor: '#1a0000',
    platColor:   '#3a0010',
    platEdge:    '#ff2200',
    hasLava:     false,
    deathY:      640,
    isStoryOnly:      true,
    isDamnationArena: true,
    platforms: [
      { x: 0,   y: 460, w: 900, h: 60, isFloor: true, isFloorDisabled: false }, // index 0 — floor, NEVER removed
      { x: 300, y: 310, w: 300, h: 16, isFloorDisabled: false },                // index 1 — center mid
      { x: 80,  y: 240, w: 140, h: 16, isFloorDisabled: false },                // index 2 — lower left
      { x: 680, y: 240, w: 140, h: 16, isFloorDisabled: false },                // index 3 — lower right
      { x: 200, y: 160, w: 120, h: 16, isFloorDisabled: false },                // index 4 — upper left  (death 1)
      { x: 580, y: 160, w: 120, h: 16, isFloorDisabled: false },                // index 5 — upper right (death 2)
    ]
  },
  creator: {
    sky:         ['#050010', '#180030'],
    groundColor: '#1a0028',
    platColor:   '#3a0055',
    platEdge:    '#9900ee',
    hasLava:     false,
    deathY:      640,
    isBossArena: true,
    platforms: [
      { x: 0,   y: 460, w: 900, h: 60, isFloor: true, isFloorDisabled: false },
      { x: 300, y: 195, w: 300, h: 18, ox: 300, oscX: 80,  oscSpeed: 0.013, oscPhase: 0.0 },
      { x: 60,  y: 275, w: 150, h: 18, ox: 60,  oscX: 35,  oscSpeed: 0.019, oscPhase: 1.0 },
      { x: 690, y: 275, w: 150, h: 18, ox: 690, oscX: 35,  oscSpeed: 0.019, oscPhase: 2.1 },
      { x: 185, y: 148, w: 130, h: 18, oy: 148, oscY: 28,  oscSpeed: 0.022, oscPhase: 0.5 },
      { x: 585, y: 148, w: 130, h: 18, oy: 148, oscY: 28,  oscSpeed: 0.022, oscPhase: 1.6 },
      { x: 375, y: 82,  w: 150, h: 18 },
    ]
  },
  forest: {
    sky:         ['#1a4020', '#2d6b3a'],
    groundColor: '#2a5a20',
    platColor:   '#4a8a38',
    platEdge:    '#2a5a18',
    hasLava:     false,
    deathY:      640,
    modifiers:   { gravityMult: 1.0, frictionMult: 1.05, hazardFrequency: 1.15 },
    platforms: [
      { x: -60,  y: 480, w: 1020, h: 40 }, // ground
      // tree canopy tiers — spread across full width
      { x: 350,  y: 190, w: 200,  h: 18 }, // centre high branch
      { x: 112,  y: 272, w: 150,  h: 18 }, // left branch
      { x: 638,  y: 272, w: 150,  h: 18 }, // right branch
      { x:  14,  y: 138, w: 115,  h: 16 }, // far-left treetop
      { x: 771,  y: 138, w: 115,  h: 16 }, // far-right treetop
      { x: 375,  y:  95, w: 150,  h: 16 }, // apex branch
      // low mid-zone stepping stones
      { x: 248,  y: 358, w:  90,  h: 14 }, // left stepping stone
      { x: 562,  y: 358, w:  90,  h: 14 }, // right stepping stone
    ]
  },
  ice: {
    sky:         ['#99c8e8', '#cce8f8'],
    groundColor: '#b8d8ee',
    platColor:   '#7ab0d0',
    platEdge:    '#5090b8',
    hasLava:     false,
    deathY:      640,
    isIcy:       true,
    modifiers:   { gravityMult: 1.0, frictionMult: 0.85, hazardFrequency: 1.0 },
    platforms: [
      { x: -60,  y: 460, w: 1020, h: 60 }, // frozen ground
      // wide centre glacier (landmark)
      { x: 320,  y: 205, w: 260,  h: 16 }, // centre glacier
      // mid-zone ice shelves
      { x:  60,  y: 290, w: 165,  h: 16 }, // left shelf
      { x: 675,  y: 290, w: 165,  h: 16 }, // right shelf
      // upper tiers spread wide
      { x: 165,  y: 145, w: 130,  h: 16 }, // left high
      { x: 605,  y: 145, w: 130,  h: 16 }, // right high
      // edge icebergs — extend playable corners
      { x:   8,  y: 195, w:  80,  h: 16 }, // far-left iceberg
      { x: 812,  y: 195, w:  80,  h: 16 }, // far-right iceberg
    ]
  },
  ruins: {
    sky:         ['#1f1008', '#3a2418'],
    groundColor: '#7a6445',
    platColor:   '#8a7455',
    platEdge:    '#5a4432',
    hasLava:     false,
    deathY:      640,
    modifiers:   { gravityMult: 1.05, frictionMult: 1.0, hazardFrequency: 0.9 },
    platforms: [
      { x:   0, y: 440, w: 260, h: 80 },
      { x: 320, y: 440, w: 260, h: 80 },
      { x: 640, y: 440, w: 260, h: 80 },
      { x:  90, y: 255, w: 145, h: 18 },
      { x: 665, y: 255, w: 145, h: 18 },
      { x: 360, y: 182, w: 180, h: 18 },
      { x: 195, y: 120, w: 120, h: 15 },
      { x: 585, y: 120, w: 120, h: 15 },
    ]
  },
  soccer: {
    sky:         ['#1a1a2e', '#16213e'],
    groundColor: '#2d5016',
    platColor:   '#3a6b1e',
    platEdge:    '#2d5016',
    hasLava:     false,
    deathY:      700,
    platforms: [
      { x: 0,   y: 460, w: 900, h: 60, isFloor: true },
      { x: 0,   y: 0,   w: 10,  h: 460 },
      { x: 890, y: 0,   w: 10,  h: 460 },
    ],
  },
  // ----------------------------------------------------------------
  // NEW ARENAS
  // ----------------------------------------------------------------
  cave: {
    sky:         ['#0a0608', '#1a0e10'],
    groundColor: '#2a1a10',
    platColor:   '#3a2518',
    platEdge:    '#5a3a28',
    hasLava:     false,
    deathY:      640,
    modifiers:   { gravityMult: 1.05, frictionMult: 1.1, hazardFrequency: 0.8 },
    platforms: [
      { x: -60, y: 480, w: 1020, h: 40 },          // ground
      { x: -60, y:   0, w: 1020, h: 20, isCeiling: true }, // low ceiling
      { x: 340, y: 210, w: 220, h: 18 },             // centre mid
      { x: 100, y: 285, w: 150, h: 18 },             // left mid
      { x: 650, y: 285, w: 150, h: 18 },             // right mid
      { x:  30, y: 155, w: 110, h: 16 },             // far-left high
      { x: 760, y: 155, w: 110, h: 16 },             // far-right high
    ]
  },
  mirror: {
    sky:         ['#050a15', '#0a1530'],
    groundColor: '#0d1a2a',
    platColor:   '#1a2a3a',
    platEdge:    '#2a4a6a',
    hasLava:     false,
    deathY:      640,
    modifiers:   { gravityMult: 1.0, frictionMult: 0.95, hazardFrequency: 1.0 },
    platforms: [
      { x: -60,  y: 480, w: 1020, h: 40 },
      { x: 355,  y: 175, w: 190, h: 15, ox: 355, oscX: 60, oscSpeed: 0.011, oscPhase: 0.0 },
      { x: 145,  y: 258, w: 160, h: 15, ox: 145, oscX: 40, oscSpeed: 0.015, oscPhase: 1.2 },
      { x: 595,  y: 258, w: 160, h: 15, ox: 595, oscX: 40, oscSpeed: 0.015, oscPhase: 2.4 },
      { x:  25,  y: 165, w: 105, h: 15, ox:  25, oscX: 25, oscSpeed: 0.018, oscPhase: 0.7 },
      { x: 770,  y: 165, w: 105, h: 15, ox: 770, oscX: 25, oscSpeed: 0.018, oscPhase: 1.9 },
    ]
  },
  underwater: {
    // NOTE: isSlowMovement flag — processInput in smc-loop.js should multiply
    // movement speed by 0.72 when currentArena.isSlowMovement is true.
    sky:            ['#01102a', '#012040'],
    groundColor:    '#003366',
    platColor:      '#004488',
    platEdge:       '#0066bb',
    hasLava:        false,
    deathY:         640,
    isSlowMovement: true,
    modifiers:      { gravityMult: 0.7, frictionMult: 1.2, hazardFrequency: 0.7 },
    platforms: [
      { x: -60, y: 480, w: 1020, h: 40 },
      { x: 355, y: 185, w: 190, h: 15 },
      { x: 145, y: 268, w: 155, h: 15 },
      { x: 600, y: 268, w: 155, h: 15 },
      { x:  25, y: 175, w: 110, h: 15 },
      { x: 765, y: 175, w: 110, h: 15 },
    ]
  },
  volcano: {
    sky:            ['#1a0500', '#3d1000'],
    groundColor:    '#5a1800',
    platColor:      '#6b2b0a',
    platEdge:       '#8b3a0f',
    hasLava:        true,
    isHeavyGravity: true,
    lavaY:          442,
    deathY:         580,
    modifiers:      { gravityMult: 1.15, frictionMult: 1.0, hazardFrequency: 1.4 },
    platforms: [
      { x: 360, y: 118, w: 180, h: 18 },
      { x: 178, y: 208, w: 140, h: 18 },
      { x: 582, y: 208, w: 140, h: 18 },
      { x:  45, y: 300, w: 165, h: 18 },
      { x: 690, y: 300, w: 165, h: 18 },
      { x: 328, y: 285, w: 244, h: 18 },
    ]
  },
  colosseum: {
    sky:         ['#7a6030', '#c8a050'],
    groundColor: '#b89060',
    platColor:   '#c8a070',
    platEdge:    '#8a6040',
    hasLava:     false,
    deathY:      640,
    modifiers:   { gravityMult: 1.05, frictionMult: 1.0, hazardFrequency: 1.0 },
    platforms: [
      { x: -60, y: 480, w: 1020, h: 40 },
      { x: 355, y: 195, w: 190, h: 20 },
      { x: 155, y: 278, w: 155, h: 20 },
      { x: 590, y: 278, w: 155, h: 20 },
      { x:  28, y: 165, w: 108, h: 18 },
      { x: 764, y: 165, w: 108, h: 18 },
    ]
  },
  cyberpunk: {
    sky:         ['#000510', '#020818'],
    groundColor: '#0a0a1a',
    platColor:   '#0d1530',
    platEdge:    '#00eeff',
    hasLava:     false,
    deathY:      640,
    modifiers:   { gravityMult: 1.0, frictionMult: 0.95, hazardFrequency: 1.2 },
    platforms: [
      { x: -60, y: 480, w: 1020, h: 40 },
      { x: 355, y: 195, w: 190, h: 14 },
      { x: 150, y: 275, w: 155, h: 14 },
      { x: 595, y: 275, w: 155, h: 14 },
      { x:  25, y: 165, w: 110, h: 14 },
      { x: 765, y: 165, w: 110, h: 14 },
    ]
  },
  haunted: {
    sky:         ['#050408', '#100818'],
    groundColor: '#1a1020',
    platColor:   '#251528',
    platEdge:    '#4a2860',
    hasLava:     false,
    deathY:      640,
    modifiers:   { gravityMult: 0.95, frictionMult: 0.92, hazardFrequency: 1.1 },
    platforms: [
      { x: -60, y: 480, w: 1020, h: 40 },
      { x: 345, y: 185, w: 210, h: 18 },
      { x: 130, y: 268, w: 155, h: 18 },
      { x: 615, y: 268, w: 155, h: 18 },
      { x:  18, y: 158, w: 112, h: 16 },
      { x: 770, y: 158, w: 112, h: 16 },
    ]
  },
  clouds: {
    sky:          ['#87ceeb', '#e0f0ff'],
    groundColor:  '#ffffff',
    platColor:    '#f0f8ff',
    platEdge:     '#aaccff',
    hasLava:      false,
    deathY:       640,
    isLowGravity: true,
    modifiers:    { gravityMult: 0.8, frictionMult: 0.88, hazardFrequency: 0.6 },
    platforms: [
      { x: -60, y: 480, w: 1020, h: 40 },
      { x: 355, y: 175, w: 190, h: 22 },
      { x: 145, y: 258, w: 165, h: 22 },
      { x: 590, y: 258, w: 165, h: 22 },
      { x:  22, y: 165, w: 108, h: 20 },
      { x: 770, y: 165, w: 108, h: 20 },
    ]
  },
  neonGrid: {
    sky:         ['#000000', '#000a00'],
    groundColor: '#001a00',
    platColor:   '#002200',
    platEdge:    '#00ff44',
    hasLava:     false,
    deathY:      640,
    modifiers:   { gravityMult: 1.0, frictionMult: 1.0, hazardFrequency: 1.0 },
    platforms: [
      { x: -60, y: 480, w: 1020, h: 40 },
      { x: 355, y: 195, w: 190, h: 14 },
      { x: 150, y: 275, w: 155, h: 14 },
      { x: 595, y: 275, w: 155, h: 14 },
      { x:  25, y: 165, w: 110, h: 14 },
      { x: 765, y: 165, w: 110, h: 14 },
    ]
  },
  mushroom: {
    sky:         ['#220033', '#550066'],
    groundColor: '#3a1055',
    platColor:   '#5a2288',
    platEdge:    '#aa44ee',
    hasLava:     false,
    deathY:      640,
    modifiers:   { gravityMult: 0.9, frictionMult: 0.85, hazardFrequency: 0.9 },
    platforms: [
      { x: -60, y: 480, w: 1020, h: 40 },
      // NOTE: isBouncy platforms — smc-loop.js checkPlatform should apply
      // upward velocity bounce (vy = -abs(vy)*1.4) when landing on isBouncy platforms.
      { x: 355, y: 190, w: 190, h: 22, isBouncy: true },
      { x: 140, y: 270, w: 160, h: 22, isBouncy: true },
      { x: 600, y: 270, w: 160, h: 22, isBouncy: true },
      { x:  20, y: 160, w: 112, h: 20, isBouncy: true },
      { x: 768, y: 160, w: 112, h: 20, isBouncy: true },
    ]
  },

  // ─── ONLINE-ONLY LARGE ARENAS ────────────────────────────────────────────
  megacity: {
    name: 'Mega City', isOnlineOnly: true, isLargeMap: true,
    sky: ['#0a0a1a','#1a0a2e','#0d1a3a'],
    groundColor: '#1a1a2e', platColor: '#2d2d5e', platEdge: '#4a4a9e',
    deathY: 700,
    worldWidth: 3600,  // total walkable width
    mapLeft: -900, mapRight: 2700,  // hard boundary walls matching the floor edges
    platforms: [
      { x:-900, y:560, w:3600, h:40, isFloor:true },
      // Lower tier (7) — wider spacing, slight y variation
      { x:-810, y:450, w:210, h:18 },
      { x:-290, y:440, w:190, h:18 },
      { x: 250, y:455, w:200, h:18 },
      { x: 780, y:438, w:190, h:18 },
      { x:1330, y:452, w:200, h:18 },
      { x:1880, y:440, w:190, h:18 },
      { x:2470, y:455, w:210, h:18 },
      // Mid tier (7) — staggered between lower, varied heights, centre bridge wider
      { x:-570, y:345, w:180, h:18 },
      { x: -10, y:315, w:200, h:18 },
      { x: 510, y:348, w:180, h:18 },
      { x:1060, y:310, w:260, h:18 }, // wider centre bridge
      { x:1600, y:345, w:180, h:18 },
      { x:2130, y:318, w:200, h:18 },
      { x:2600, y:350, w:170, h:18 },
      // Upper tier (6) — fewer, more open
      { x:-620, y:215, w:175, h:18 },
      { x: -60, y:195, w:195, h:18 },
      { x: 520, y:218, w:175, h:18 },
      { x:1120, y:192, w:195, h:18 },
      { x:1720, y:215, w:175, h:18 },
      { x:2320, y:195, w:195, h:18 },
      // Top tier (5) — sparse, contested high ground
      { x:-430, y:105, w:190, h:18 },
      { x: 280, y: 88, w:175, h:18 },
      { x: 970, y:102, w:200, h:18 },
      { x:1680, y: 88, w:175, h:18 },
      { x:2380, y:105, w:190, h:18 },
    ]
  },
  warpzone: {
    name: 'Warp Zone', isOnlineOnly: true, isLargeMap: true,
    sky: ['#0d0024','#1a0038','#00001a'],
    groundColor: '#0a001f', platColor: '#2a0055', platEdge: '#8800ff',
    deathY: 700, isLowGravity: true,
    worldWidth: 3600,
    mapLeft: -900, mapRight: 2700,
    platforms: [
      { x:-900, y:560, w:3600, h:40, isFloor:true },
      // Lower tier (7) — wider spacing, slight y variation, warp-themed feel
      { x:-800, y:448, w:200, h:18 },
      { x:-270, y:438, w:185, h:18 },
      { x: 270, y:452, w:195, h:18 },
      { x: 800, y:440, w:185, h:18 },
      { x:1350, y:450, w:200, h:18 },
      { x:1900, y:438, w:185, h:18 },
      { x:2460, y:450, w:200, h:18 },
      // Mid tier (7) — staggered, wider warp-gate bridge at centre
      { x:-560, y:342, w:178, h:18 },
      { x:  20, y:312, w:195, h:18 },
      { x: 530, y:346, w:178, h:18 },
      { x:1080, y:308, w:270, h:18 }, // wider warp bridge
      { x:1620, y:342, w:178, h:18 },
      { x:2160, y:316, w:195, h:18 },
      { x:2610, y:348, w:168, h:18 },
      // Upper tier (6) — open sky, fewer platforms
      { x:-610, y:212, w:172, h:18 },
      { x: -30, y:193, w:190, h:18 },
      { x: 540, y:215, w:172, h:18 },
      { x:1140, y:190, w:190, h:18 },
      { x:1740, y:212, w:172, h:18 },
      { x:2340, y:193, w:190, h:18 },
      // Top tier (5) — rare, contested high ground
      { x:-420, y:102, w:188, h:18 },
      { x: 290, y: 85, w:172, h:18 },
      { x: 990, y: 98, w:195, h:18 },
      { x:1700, y: 85, w:172, h:18 },
      { x:2390, y:102, w:188, h:18 },
    ]
  },
  colosseum10: {
    name: 'Grand Colosseum', isOnlineOnly: true, isLargeMap: true,
    sky: ['#1a0800','#2d1000','#3d1a00'],
    groundColor: '#2d1800', platColor: '#5c3010', platEdge: '#8c5020',
    deathY: 700,
    worldWidth: 3600,
    mapLeft: -900, mapRight: 2700,
    platforms: [
      { x:-900, y:560, w:3600, h:40, isFloor:true },
      // Lower tier (7) — colosseum-style wider stone platforms, slight y variation
      { x:-820, y:448, w:225, h:22 },
      { x:-280, y:435, w:205, h:22 },
      { x: 270, y:450, w:215, h:22 },
      { x: 810, y:435, w:205, h:22 },
      { x:1360, y:450, w:220, h:22 },
      { x:1910, y:435, w:205, h:22 },
      { x:2480, y:450, w:215, h:22 },
      // Mid tier (7) — arena floor balconies, wide centre arch
      { x:-580, y:340, w:185, h:20 },
      { x:  10, y:308, w:205, h:20 },
      { x: 540, y:342, w:185, h:20 },
      { x:1090, y:304, w:280, h:20 }, // wide colosseum arch bridge
      { x:1640, y:340, w:185, h:20 },
      { x:2180, y:312, w:205, h:20 },
      { x:2620, y:342, w:175, h:20 },
      // Upper tier (6) — spectator levels, open gaps
      { x:-600, y:210, w:180, h:18 },
      { x: -40, y:192, w:198, h:18 },
      { x: 530, y:213, w:180, h:18 },
      { x:1130, y:190, w:198, h:18 },
      { x:1730, y:210, w:180, h:18 },
      { x:2340, y:192, w:198, h:18 },
      // Top tier (5) — highest seating, contested and risky
      { x:-440, y:100, w:195, h:18 },
      { x: 280, y: 83, w:180, h:18 },
      { x: 985, y: 98, w:200, h:18 },
      { x:1700, y: 83, w:180, h:18 },
      { x:2400, y:100, w:195, h:18 },
    ]
  },

  // ── Story-only arenas (not shown in arena picker) ─────────────────────────
  // All story arenas are 2200px wide so the player can explore before the fight.
  // isFloor:true marks the ground platform for void-fog and spawn logic.

  homeYard: {
    // Standard-width map (GAME_W=900). No worldWidth — camera doesn't scroll.
    // mapLeft/mapRight match the floor edges so no invisible walls exist.
    // Platform layout: 8 intentional platforms representing a house front yard.
    // pickSafeSpawn('left') → porch step or left fence; pickSafeSpawn('right') → right fence or path.
    // Both spawns naturally land in front of the house, separated by the center gap.
    name: 'Home Yard', isStoryOnly: true, earthPhysics: true,
    mapLeft: 0, mapRight: 900,
    sky: ['#87CEEB','#b8dff5','#d0eeff'],
    groundColor: '#4a8030', platColor: '#6a9a40', platEdge: '#3a6020',
    hasLava: false, deathY: 560,
    platforms: [
      // Ground — full-width grass, flush with map edges
      { x: 0,   y: 460, w: 900, h: 120, isFloor: true },
    ],
  },
  homeAlley: {
    name: 'City Alley', isStoryOnly: true, earthPhysics: true,
    worldWidth: 6000, mapLeft: -50, mapRight: 5850, boundaryPortals: true,
    sky: ['#1a2030','#2a3040','#3a4050'],
    groundColor: '#222222', platColor: '#303030', platEdge: '#181818',
    hasLava: false, deathY: 640,
    platforms: [
      { x: -200, y: 480, w: 6400, h: 200, isFloor: true },
    ]
  },
  suburb: {
    name: 'Suburbs', isStoryOnly: true, earthPhysics: true,
    worldWidth: 6000, mapLeft: -50, mapRight: 5850, boundaryPortals: true,
    sky: ['#87CEEB','#aad8f0','#c8ecff'],
    groundColor: '#5a8a3a', platColor: '#6a9a4a', platEdge: '#3a6020',
    hasLava: false, deathY: 640,
    platforms: [
      { x: -200, y: 480, w: 6400, h: 200, isFloor: true },
    ]
  },
  rural: {
    name: 'Rural Fields', isStoryOnly: true, earthPhysics: true,
    worldWidth: 6000, mapLeft: -50, mapRight: 5850, boundaryPortals: true,
    sky: ['#e8a020','#f0b830','#f5c842'],
    groundColor: '#7a5c30', platColor: '#8a6c40', platEdge: '#5c4010',
    hasLava: false, deathY: 640,
    platforms: [
      { x: -200, y: 480, w: 6400, h: 200, isFloor: true },
    ]
  },
  portalEdge: {
    name: 'Portal Threshold', isStoryOnly: true,
    worldWidth: 6000, mapLeft: -50, mapRight: 5850, boundaryPortals: true,
    sky: ['#050010','#100030','#1a0050'],
    groundColor: '#100020', platColor: '#200050', platEdge: '#6600aa',
    hasLava: false, deathY: 640,
    platforms: [
      { x: -200, y: 480, w: 6400, h: 200, isFloor: true },
      { x:  100, y: 390, w: 140, h: 18 }, { x:  290, y: 340, w: 130, h: 18 },
      { x:  470, y: 280, w: 150, h: 18 }, { x:  660, y: 330, w: 130, h: 18 },
      { x:  840, y: 395, w: 120, h: 18 }, { x: 1010, y: 340, w: 140, h: 18 },
      { x: 1200, y: 280, w: 130, h: 18 }, { x: 1380, y: 330, w: 140, h: 18 },
      { x: 1560, y: 390, w: 120, h: 18 }, { x: 1740, y: 340, w: 140, h: 18 },
      { x: 1920, y: 390, w: 130, h: 18 }, { x: 2110, y: 330, w: 140, h: 18 },
      { x: 2300, y: 275, w: 150, h: 18 }, { x: 2490, y: 340, w: 130, h: 18 },
      { x: 2680, y: 395, w: 120, h: 18 }, { x: 2870, y: 340, w: 140, h: 18 },
      { x: 3060, y: 280, w: 130, h: 18 }, { x: 3250, y: 340, w: 140, h: 18 },
      { x: 3440, y: 395, w: 120, h: 18 }, { x: 3630, y: 340, w: 140, h: 18 },
      { x: 3820, y: 280, w: 130, h: 18 }, { x: 4010, y: 340, w: 140, h: 18 },
      { x: 4200, y: 395, w: 120, h: 18 }, { x: 4390, y: 340, w: 140, h: 18 },
      { x: 4580, y: 280, w: 130, h: 18 }, { x: 4770, y: 340, w: 140, h: 18 },
      { x: 4960, y: 395, w: 120, h: 18 }, { x: 5150, y: 340, w: 140, h: 18 },
      { x: 5340, y: 280, w: 130, h: 18 }, { x: 5530, y: 340, w: 140, h: 18 },
      { x:  200, y: 240, w: 120, h: 16 }, { x:  560, y: 210, w: 110, h: 16 },
      { x:  940, y: 220, w: 120, h: 16 }, { x: 1300, y: 205, w: 110, h: 16 },
      { x: 1650, y: 215, w: 120, h: 16 }, { x: 2020, y: 205, w: 110, h: 16 },
      { x: 2410, y: 215, w: 120, h: 16 }, { x: 2800, y: 205, w: 110, h: 16 },
      { x: 3170, y: 215, w: 120, h: 16 }, { x: 3560, y: 205, w: 110, h: 16 },
      { x: 3930, y: 215, w: 120, h: 16 }, { x: 4310, y: 205, w: 110, h: 16 },
      { x: 4690, y: 215, w: 120, h: 16 }, { x: 5070, y: 205, w: 110, h: 16 },
      { x: 5450, y: 215, w: 120, h: 16 },
      { x:  370, y: 165, w: 100, h: 16 }, { x:  750, y: 155, w: 100, h: 16 },
      { x: 1120, y: 160, w: 100, h: 16 }, { x: 1480, y: 155, w: 100, h: 16 },
      { x: 1820, y: 165, w: 100, h: 16 }, { x: 2220, y: 155, w: 100, h: 16 },
      { x: 2610, y: 160, w: 100, h: 16 }, { x: 2990, y: 155, w: 100, h: 16 },
    ]
  },
  realmEntry: {
    name: 'The New Realm', isStoryOnly: true,
    worldWidth: 6000, mapLeft: -50, mapRight: 5850, boundaryPortals: true,
    sky: ['#000515','#000e2a','#001845'],
    groundColor: '#000a20', platColor: '#002050', platEdge: '#0066cc',
    hasLava: false, deathY: 640, isLowGravity: true,
    platforms: [
      { x: -200, y: 480, w: 6400, h: 200, isFloor: true },
      { x:   80, y: 405, w: 140, h: 18 }, { x:  270, y: 355, w: 130, h: 18 },
      { x:  450, y: 295, w: 150, h: 18 }, { x:  640, y: 325, w: 130, h: 18 },
      { x:  820, y: 400, w: 120, h: 18 }, { x: 1000, y: 350, w: 140, h: 18 },
      { x: 1180, y: 295, w: 130, h: 18 }, { x: 1360, y: 335, w: 140, h: 18 },
      { x: 1540, y: 400, w: 120, h: 18 }, { x: 1720, y: 350, w: 140, h: 18 },
      { x: 1900, y: 400, w: 130, h: 18 }, { x: 2090, y: 345, w: 140, h: 18 },
      { x: 2280, y: 295, w: 130, h: 18 }, { x: 2470, y: 340, w: 140, h: 18 },
      { x: 2660, y: 400, w: 120, h: 18 }, { x: 2850, y: 350, w: 140, h: 18 },
      { x: 3040, y: 295, w: 130, h: 18 }, { x: 3230, y: 340, w: 140, h: 18 },
      { x: 3420, y: 400, w: 120, h: 18 }, { x: 3610, y: 350, w: 140, h: 18 },
      { x: 3800, y: 295, w: 130, h: 18 }, { x: 3990, y: 340, w: 140, h: 18 },
      { x: 4180, y: 400, w: 120, h: 18 }, { x: 4370, y: 350, w: 140, h: 18 },
      { x: 4560, y: 295, w: 130, h: 18 }, { x: 4750, y: 340, w: 140, h: 18 },
      { x: 4940, y: 400, w: 120, h: 18 }, { x: 5130, y: 350, w: 140, h: 18 },
      { x: 5320, y: 295, w: 130, h: 18 }, { x: 5510, y: 345, w: 140, h: 18 },
      { x:  170, y: 245, w: 130, h: 16 }, { x:  540, y: 215, w: 120, h: 16 },
      { x:  910, y: 225, w: 130, h: 16 }, { x: 1270, y: 210, w: 120, h: 16 },
      { x: 1620, y: 220, w: 120, h: 16 }, { x: 2000, y: 210, w: 120, h: 16 },
      { x: 2390, y: 220, w: 130, h: 16 }, { x: 2770, y: 210, w: 120, h: 16 },
      { x: 3150, y: 220, w: 130, h: 16 }, { x: 3530, y: 210, w: 120, h: 16 },
      { x: 3910, y: 220, w: 130, h: 16 }, { x: 4290, y: 210, w: 120, h: 16 },
      { x: 4670, y: 220, w: 130, h: 16 }, { x: 5050, y: 210, w: 120, h: 16 },
      { x: 5430, y: 220, w: 130, h: 16 },
      { x:  350, y: 160, w: 110, h: 16 }, { x:  720, y: 150, w: 100, h: 16 },
      { x: 1090, y: 155, w: 110, h: 16 }, { x: 1450, y: 148, w: 100, h: 16 },
      { x: 1800, y: 160, w: 110, h: 16 }, { x: 2200, y: 150, w: 100, h: 16 },
    ]
  },
  bossSanctum: {
    name: 'Sanctum of the Ruler', isStoryOnly: true,
    worldWidth: 6000, mapLeft: -50, mapRight: 5850, boundaryPortals: true,
    sky: ['#080002','#120006','#200010'],
    groundColor: '#100008', platColor: '#2a0018', platEdge: '#aa0044',
    hasLava: false, deathY: 640,
    platforms: [
      { x: -200, y: 480, w: 6400, h: 200, isFloor: true },
      { x:   60, y: 390, w: 160, h: 22 }, { x:  270, y: 335, w: 145, h: 20 },
      { x:  460, y: 270, w: 165, h: 20 }, { x:  660, y: 330, w: 145, h: 20 },
      { x:  850, y: 395, w: 130, h: 18 }, { x: 1030, y: 340, w: 155, h: 20 },
      { x: 1220, y: 275, w: 145, h: 20 }, { x: 1410, y: 335, w: 155, h: 20 },
      { x: 1600, y: 395, w: 135, h: 18 }, { x: 1780, y: 345, w: 150, h: 20 },
      { x: 1960, y: 390, w: 130, h: 18 }, { x: 2160, y: 340, w: 155, h: 20 },
      { x: 2350, y: 275, w: 145, h: 20 }, { x: 2550, y: 335, w: 155, h: 20 },
      { x: 2740, y: 395, w: 135, h: 18 }, { x: 2930, y: 345, w: 150, h: 20 },
      { x: 3120, y: 270, w: 165, h: 20 }, { x: 3320, y: 330, w: 145, h: 20 },
      { x: 3510, y: 395, w: 130, h: 18 }, { x: 3700, y: 340, w: 155, h: 20 },
      { x: 3890, y: 275, w: 145, h: 20 }, { x: 4090, y: 335, w: 155, h: 20 },
      { x: 4280, y: 395, w: 135, h: 18 }, { x: 4470, y: 345, w: 150, h: 20 },
      { x: 4660, y: 270, w: 165, h: 20 }, { x: 4860, y: 330, w: 145, h: 20 },
      { x: 5050, y: 395, w: 130, h: 18 }, { x: 5240, y: 340, w: 155, h: 20 },
      { x: 5430, y: 275, w: 145, h: 20 }, { x: 5630, y: 335, w: 155, h: 20 },
      { x:  160, y: 250, w: 135, h: 18 }, { x:  550, y: 215, w: 130, h: 18 },
      { x:  940, y: 225, w: 140, h: 18 }, { x: 1310, y: 210, w: 130, h: 18 },
      { x: 1680, y: 220, w: 135, h: 18 }, { x: 2070, y: 210, w: 130, h: 18 },
      { x: 2460, y: 220, w: 140, h: 18 }, { x: 2840, y: 210, w: 130, h: 18 },
      { x: 3230, y: 220, w: 135, h: 18 }, { x: 3620, y: 210, w: 130, h: 18 },
      { x: 4010, y: 220, w: 140, h: 18 }, { x: 4390, y: 210, w: 130, h: 18 },
      { x: 4780, y: 220, w: 135, h: 18 }, { x: 5160, y: 210, w: 130, h: 18 },
      { x: 5550, y: 220, w: 135, h: 18 },
      { x:  360, y: 160, w: 145, h: 18 }, { x:  740, y: 148, w: 140, h: 18 },
      { x: 1120, y: 155, w: 145, h: 18 }, { x: 1490, y: 148, w: 135, h: 18 },
      { x: 1850, y: 158, w: 140, h: 18 }, { x: 2260, y: 148, w: 140, h: 18 },
      { x: 2650, y: 158, w: 145, h: 18 }, { x: 3040, y: 148, w: 140, h: 18 },
    ]
  },
};

// ============================================================
// ARENA LAYOUT RANDOMIZATION
// ============================================================
// Stores base platform positions per arena for randomization reference
const ARENA_BASE_PLATFORMS = {};
for (const key of Object.keys(ARENAS)) {
  if (key === 'creator') continue; // boss arena — never randomize
  ARENA_BASE_PLATFORMS[key] = ARENAS[key].platforms.map(p => ({ ...p }));
}

function randomizeArenaLayout(key) {
  if (key === 'creator' || key === 'soccer' || key === 'cave') return; // never randomize boss/soccer/cave (ceiling constraint)
  const base  = ARENA_BASE_PLATFORMS[key];
  if (!base) return;
  const arena = ARENAS[key];
  // Determine the actual x bounds of the arena (wide arenas use worldWidth, not GAME_W)
  const _xMin = arena.mapLeft  !== undefined ? arena.mapLeft  : 10;
  const _xMax = arena.mapRight !== undefined ? arena.mapRight : GAME_W - 10;
  arena.platforms = base.map((p, idx) => {
    if (idx === 0) return { ...p }; // always keep ground platform fixed
    // Randomize within ±70px x, ±45px y, clamped to actual arena bounds
    return {
      ...p,
      x: Math.max(_xMin, Math.min(_xMax - p.w, p.x + (Math.random() - 0.5) * 140)),
      y: Math.max(55, Math.min(420, p.y + (Math.random() - 0.5) * 90))
    };
  });
}

// ============================================================
// MAP PERKS — per-arena special item/event state
// ============================================================
const MAP_PERK_DEFS = {
  ruins: {
    items: [
      { baseX: 135, baseY: 400 },  // on left block
      { baseX: 450, baseY: 400 },  // on center block
      { baseX: 765, baseY: 400 },  // on right block
    ],
    types: ['speed','power','heal','shield','maxhp','curse_slow','curse_weak','curse_fragile','curse_maxhp_perm']
  },
  forest: {
    healZones: [{ x: 0, w: 900, healRate: 60 }]  // gentle healing every 60 frames
  },
  city: {
    carCooldown: 600  // frames between car runs
  },
  lava: {
    eruptionCooldown: 480
  },
  cave: {
    stalactites:       [],
    stalactiteCooldown: 0
  },
  volcano: {
    geysers:       [],
    geyserCooldown: 0
  },
  haunted: {
    ghosts:       [],
    ghostCooldown: 0
  },
  cyberpunk: {
    zapTimer:  0,
    zapActive: false,
    zapLine:   0
  },
  neonGrid: {
    boostPads: [{ x: 180, y: 478 }, { x: 540, y: 478 }, { x: 750, y: 478 }]
  }
};

let mapPerkState = {};  // runtime state per arena

function initMapPerks(key) {
  mapItems    = [];
  mapPerkState = {};
  if (key === 'ruins') {
    const def = MAP_PERK_DEFS.ruins;
    for (const pos of def.items) {
      mapItems.push({
        x: pos.baseX, y: pos.baseY - 22,
        type: def.types[Math.floor(Math.random() * def.types.length)],
        collected: false, respawnIn: 0, radius: 14, animPhase: Math.random() * Math.PI * 2
      });
    }
    mapPerkState.crates       = [];
    mapPerkState.crateCooldown = 300; // first crate after 5s
  }
  if (key === 'city') {
    mapPerkState.carCooldown = MAP_PERK_DEFS.city.carCooldown;
    mapPerkState.cars        = [];
  }
  if (key === 'lava') {
    mapPerkState.eruptCooldown = MAP_PERK_DEFS.lava.eruptionCooldown;
    mapPerkState.eruptions     = [];
  }
  if (key === 'cave') {
    mapPerkState.stalactites       = [];
    mapPerkState.stalactiteCooldown = 480; // first drop after ~8s
  }
  if (key === 'volcano') {
    mapPerkState.geysers       = [];
    mapPerkState.geyserCooldown = 420;
  }
  if (key === 'haunted') {
    mapPerkState.ghosts       = [];
    mapPerkState.ghostCooldown = 600;
  }
  if (key === 'cyberpunk') {
    mapPerkState.zapTimer  = 900; // first zap after 15s
    mapPerkState.zapActive = false;
    mapPerkState.zapLine   = GAME_W / 2;
  }
  if (key === 'underwater') {
    mapPerkState.bubbles = Array.from({ length: 18 }, (_, i) => ({
      x: 30 + i * 50, y: 480 + Math.random() * 40, speed: 0.6 + Math.random() * 0.8
    }));
  }
}

// Helper used by both the random forest encounter logic and the Director.
function spawnForestBeastNow() {
  if (!currentArena || forestBeast || forestBeastCooldown > 0) return;
  const pls = currentArena.platforms;
  if (!pls || pls.length === 0) return;
  const pl  = pls[Math.floor(Math.random() * pls.length)];
  const spawnX = pl.x + Math.random() * pl.w;
  const spawnY = pl.y - 62;
  forestBeast = new ForestBeast(spawnX, spawnY);
  // 1/10 chance: spawn as raged beast (lower HP, higher everything else)
  if (Math.random() < 0.10) {
    forestBeast.isRaged     = true;
    forestBeast.health      = 180;
    forestBeast.maxHealth   = 180;
    forestBeast.dmgMult     = 2.2;
    forestBeast.kbBonus     = 1.8;
    forestBeast.kbResist    = 0.25;
    forestBeast.color       = '#ff2200';
    forestBeast.name        = 'RAGED BEAST';
    // Speed handled in updateAI via dash cooldown tweak
    forestBeast.dashCooldown = 60;
  }
  // Target the player with lowest health
  const livingPlayers = players.filter(p => !p.isBoss && p.health > 0);
  if (livingPlayers.length > 0) {
    forestBeast.target = livingPlayers.reduce((a, b) => a.health < b.health ? a : b);
  }
  minions.push(forestBeast);
  spawnParticles(spawnX, spawnY, forestBeast.isRaged ? '#ff2200' : '#1a8a2e', 20);
  if (settings.screenShake) screenShake = Math.max(screenShake, 10);
  const beastLabel = forestBeast.isRaged ? 'RAGED BEAST!' : 'BEAST APPEARS!';
  if (settings.dmgNumbers) damageTexts.push(new DamageText(spawnX, spawnY - 20, beastLabel, forestBeast.isRaged ? '#ff4400' : '#1aff3a'));
}

// Helper used by both the random ice encounter logic and the Director.
function spawnYetiNow() {
  if (!currentArena || yeti || yetiCooldown > 0) return;
  const spawnX = Math.random() < 0.5 ? 60 : GAME_W - 60;
  yeti = new Yeti(spawnX, 200);
  const living = players.filter(p => !p.isBoss && p.health > 0);
  yeti.target = living[0] || players[0];
  minions.push(yeti);
  spawnParticles(spawnX, 200, '#88ccff', 20);
  if (settings.dmgNumbers) damageTexts.push(new DamageText(GAME_W / 2, 80, 'A YETI APPEARS!', '#88ccff'));
}

function updateMapPerks() {
  if (!currentArena || !gameRunning) return;


  // ---- RUINS: Artifact pickups ----
  if (currentArenaKey === 'ruins') {
    for (const item of mapItems) {
      item.animPhase += 0.06;
      if (item.collected) {
        item.respawnIn--;
        if (item.respawnIn <= 0) {
          item.collected = false;
          item.type = MAP_PERK_DEFS.ruins.types[Math.floor(Math.random() * MAP_PERK_DEFS.ruins.types.length)];
        }
        continue;
      }
      // Check proximity
      for (const p of players) {
        if (p.isBoss || p.health <= 0) continue;
        const dx = p.cx() - item.x, dy = (p.y + p.h/2) - item.y;
        if (Math.hypot(dx, dy) < 28) {
          item.collected  = true;
          item.respawnIn  = 1800 + Math.random() * 600; // 30–40 s
          applyMapPerk(p, item.type);
          SoundManager.pickup();
          spawnParticles(item.x, item.y, '#ffd700', 16);
          screenShake = Math.max(screenShake, 6);
          if (settings.dmgNumbers) {
            const labels = { speed:'SWIFT!', power:'POWER!', heal:'+30 HP', shield:'SHIELD!', maxhp:'+15 MAX HP' };
            damageTexts.push(new DamageText(item.x, item.y - 20, labels[item.type] || '!', '#ffd700'));
          }
          break;
        }
      }
    }

    // ---- RUINS: Breakable crates ----
    if (!mapPerkState.crates)       mapPerkState.crates       = [];
    if (mapPerkState.crateCooldown === undefined) mapPerkState.crateCooldown = 300;
    if (mapPerkState.crates.length < 3) {
      mapPerkState.crateCooldown--;
      if (mapPerkState.crateCooldown <= 0) {
        // Pick a random platform surface to place the crate
        const pls = currentArena.platforms.filter(p => !p.isFloor && p.w >= 60);
        if (pls.length > 0) {
          const pl  = pls[Math.floor(Math.random() * pls.length)];
          const cx  = pl.x + 20 + Math.random() * (pl.w - 40);
          const cy  = pl.y; // crate bottom sits on platform top
          // Avoid stacking on existing crates
          const occupied = mapPerkState.crates.some(c => Math.abs(c.x - cx) < 50 && Math.abs(c.y - cy) < 40);
          if (!occupied) {
            const t = MAP_PERK_DEFS.ruins.types[Math.floor(Math.random() * MAP_PERK_DEFS.ruins.types.length)];
            mapPerkState.crates.push({ x: cx, y: cy, hp: 50, maxHp: 50, type: t, hitShake: 0, lastHitFrame: -30 });
          }
        }
        mapPerkState.crateCooldown = 1200 + Math.floor(Math.random() * 600); // 20–30 s
      }
    }
    // Crate hit detection
    for (let ci = mapPerkState.crates.length - 1; ci >= 0; ci--) {
      const crate = mapPerkState.crates[ci];
      if (crate.hitShake > 0) crate.hitShake--;
      for (const p of players) {
        if (p.health <= 0 || p.state !== 'attacking') continue;
        if (frameCount - crate.lastHitFrame < 12) continue;
        const reach = (p.weapon ? (p.weapon.range || 40) : 40) + 20;
        const inX = Math.abs(p.cx() - crate.x) < reach;
        const inY = p.y < crate.y && p.y + p.h + 10 > crate.y;
        if (inX && inY) {
          const dmg = p.weapon ? (p.weapon.damage || 10) : 10;
          crate.hp -= dmg;
          crate.hitShake = 6;
          crate.lastHitFrame = frameCount;
          spawnParticles(crate.x, crate.y - 15, '#8B5E3C', 6);
          if (crate.hp <= 0) {
            applyMapPerk(p, crate.type);
            spawnParticles(crate.x, crate.y - 15, '#ffd700', 20);
            screenShake = Math.max(screenShake, 5);
            if (settings.dmgNumbers) {
              const labels = { speed:'SWIFT!', power:'POWER!', heal:'+30 HP', shield:'SHIELD!', maxhp:'+15 MAX HP' };
              damageTexts.push(new DamageText(crate.x, crate.y - 40, labels[crate.type] || '!', '#ffd700'));
            }
            mapPerkState.crates.splice(ci, 1);
          }
          break;
        }
      }
    }
  }

  // ---- FOREST: Gradual healing ----
  if (currentArenaKey === 'forest' && frameCount % 90 === 0) {
    for (const p of players) {
      if (p.isBoss || p.health <= 0 || p.hurtTimer > 0) continue;
      if (p.onGround && p.health < p.maxHealth) {
        p.health = Math.min(p.maxHealth, p.health + 1);
        if (settings.particles && Math.random() < 0.4) {
          spawnParticles(p.cx(), p.y, '#44ff44', 3);
        }
      }
    }
  }

  // ---- FOREST: Rare beast encounter ----
  if (currentArenaKey === 'forest') {
    // Track beast death → set cooldown
    if (forestBeast && forestBeast.health <= 0) {
      _achCheckBeastDead();
      forestBeast = null;
      forestBeastCooldown = SPAWN_CONFIG.forestBeast.respawnDelay;
    }
    if (forestBeastCooldown > 0) forestBeastCooldown--;
    // Deterministic interval spawn — no hidden randomness
    if (!forestBeast && forestBeastCooldown <= 0 && frameCount % SPAWN_CONFIG.forestBeast.spawnInterval === 0) {
      spawnForestBeastNow();
    }
  }

  // ---- CITY: Occasional car ----
  if (currentArenaKey === 'city') {
    if (!mapPerkState.cars)        mapPerkState.cars        = [];
    if (!mapPerkState.carCooldown) mapPerkState.carCooldown = MAP_PERK_DEFS.city.carCooldown;
    if (mapPerkState.carCooldown > 0) {
      mapPerkState.carCooldown--;
    } else {
      // Spawn a car
      const fromLeft = Math.random() < 0.5;
      mapPerkState.cars.push({ x: fromLeft ? -60 : GAME_W + 60, y: 432,
        vx: fromLeft ? 9 : -9, warned: false, warnTimer: 60 });
      mapPerkState.carCooldown = 1200 + Math.floor(Math.random() * 800);
    }
    for (let ci = mapPerkState.cars.length - 1; ci >= 0; ci--) {
      const car = mapPerkState.cars[ci];
      if (car.warnTimer > 0) { car.warnTimer--; continue; }
      car.x += car.vx;
      if (car.x < -120 || car.x > GAME_W + 120) {
        mapPerkState.cars.splice(ci, 1); continue;
      }
      // Damage players in path
      let _carExploded = false;
      for (const p of players) {
        if (p.health <= 0 || p.invincible > 0) continue;
        if (Math.abs(p.cx() - car.x) < 40 && Math.abs((p.y + p.h) - car.y) < 60) {
          if (p.isTrueForm) {
            spawnParticles(car.x, car.y - 20, '#ff8800', 16);
            spawnParticles(car.x, car.y - 20, '#ffff00', 8);
            if (settings.screenShake) screenShake = Math.max(screenShake, 14);
            car._exploded = true; _carExploded = true; break;
          }
          dealDamage(players.find(q => q.isBoss) || players[1], p, 18, 16);
        }
      }
      if (_carExploded) { mapPerkState.cars.splice(ci, 1); continue; }
    }
  }

  // ---- LAVA: Eruptions ----
  if (currentArenaKey === 'lava') {
    if (!mapPerkState.eruptCooldown) mapPerkState.eruptCooldown = 480;
    if (!mapPerkState.eruptions)     mapPerkState.eruptions     = [];
    mapPerkState.eruptCooldown--;
    if (mapPerkState.eruptCooldown <= 0) {
      const ex = 60 + Math.random() * 780;
      mapPerkState.eruptions.push({ x: ex, timer: 180 });
      mapPerkState.eruptCooldown = 360 + Math.floor(Math.random() * 360);
    }
    for (let ei = mapPerkState.eruptions.length - 1; ei >= 0; ei--) {
      const er = mapPerkState.eruptions[ei];
      er.timer--;
      if (er.timer <= 0) { mapPerkState.eruptions.splice(ei, 1); continue; }
      if (er.timer % 5 === 0 && settings.particles && particles.length < MAX_PARTICLES) {
        const upA = -Math.PI/2 + (Math.random()-0.5)*0.5;
        const _p = _getParticle();
        _p.x = er.x; _p.y = currentArena.lavaY || 442;
        _p.vx = Math.cos(upA)*5; _p.vy = Math.sin(upA)*(8+Math.random()*8);
        _p.color = Math.random() < 0.5 ? '#ff4400' : '#ff8800';
        _p.size = 3+Math.random()*4; _p.life = 30+Math.random()*20; _p.maxLife = 50;
        particles.push(_p);
      }
      // Damage nearby players — wider (±100px), taller (250px above lava)
      for (const p of players) {
        if (p.isBoss || p.health <= 0 || p.invincible > 0) continue;
        if (Math.abs(p.cx() - er.x) < 100 && p.y + p.h > (currentArena.lavaY || 442) - 250) {
          if (er.timer % 10 === 0) dealDamage(players.find(q => q.isBoss) || players[1], p, Math.ceil(p.maxHealth * 0.044), 8);
        }
      }
    }
  }

  // ---- SPACE: Falling meteorites ----
  if (currentArenaKey === 'space') {
    if (!mapPerkState.meteors)         mapPerkState.meteors        = [];
    if (!mapPerkState.meteorCooldown)  mapPerkState.meteorCooldown = 1800;
    mapPerkState.meteorCooldown--;
    if (mapPerkState.meteorCooldown <= 0) {
      mapPerkState.meteorCooldown = 1200 + Math.floor(Math.random() * 600);
      const mx = 80 + Math.random() * (GAME_W - 160);
      mapPerkState.meteors.push({ x: mx, y: -20, vy: 0, warned: true, warnTimer: 90, landed: false });
    }
    for (let mi = mapPerkState.meteors.length - 1; mi >= 0; mi--) {
      const m = mapPerkState.meteors[mi];
      if (m.warnTimer > 0) { m.warnTimer--; continue; }
      m.vy += 0.55; // gravity accelerates
      m.y  += m.vy;
      if (m.y > GAME_H + 20) { mapPerkState.meteors.splice(mi, 1); continue; }
      // Damage players in blast radius
      for (const p of players) {
        if (p.health <= 0 || p.invincible > 0) continue;
        if (Math.hypot(p.cx() - m.x, p.cy() - m.y) < 55) {
          spawnParticles(m.x, m.y, '#ff8844', 14);
          dealDamage(players[1] || players[0], p, 28, 22);
          mapPerkState.meteors.splice(mi, 1);
          if (settings.screenShake) screenShake = Math.max(screenShake, 18);
          break;
        }
      }
      // Explode on ground (y > 460)
      if (mi < mapPerkState.meteors.length && mapPerkState.meteors[mi].y > 455) {
        spawnParticles(m.x, 460, '#ff8844', 20);
        if (settings.screenShake) screenShake = Math.max(screenShake, 14);
        mapPerkState.meteors.splice(mi, 1);
      }
    }
  }

  // ---- CITY: Moving cars that deal damage ----
  if (currentArenaKey === 'city') {
    if (!mapPerkState.cityCars)    mapPerkState.cityCars    = [];
    if (mapPerkState.carSpawnCd === undefined) mapPerkState.carSpawnCd = 180;
    mapPerkState.carSpawnCd--;
    if (mapPerkState.carSpawnCd <= 0) {
      mapPerkState.carSpawnCd = 240 + Math.floor(Math.random() * 240);
      const goRight = Math.random() < 0.5;
      mapPerkState.cityCars.push({
        x:      goRight ? -80 : GAME_W + 80,
        y:      438,            // floor level
        w:      55, h: 22,
        vx:     goRight ? 6.5 : -6.5,
        color:  ['#cc2200','#0033cc','#448800','#cc8800'][Math.floor(Math.random() * 4)],
        warned: false,
        hit:    new Set(), // dedup: each player can only be hit once per car
      });
      // Warn players with a HUD message
      if (settings.dmgNumbers) damageTexts.push(new DamageText(GAME_W / 2, 105, 'CAR!', '#ffcc00'));
    }
    for (let ci = mapPerkState.cityCars.length - 1; ci >= 0; ci--) {
      const car = mapPerkState.cityCars[ci];
      car.x += car.vx;
      // Remove when off-screen
      if (car.x > GAME_W + 120 || car.x < -120) { mapPerkState.cityCars.splice(ci, 1); continue; }
      // Damage players
      let _cityCarHit = false;
      for (const p of players) {
        if (p.health <= 0 || p.invincible > 0 || p.isBoss) continue;
        if (car.hit.has(p)) continue; // already hit this player — skip
        const carCX = car.x + car.w / 2;
        const carCY = car.y - car.h / 2;
        if (Math.abs(p.cx() - carCX) < car.w / 2 + p.w / 2 &&
            Math.abs((p.y + p.h / 2) - carCY) < car.h / 2 + p.h / 2) {
          if (p.isTrueForm) {
            spawnParticles(carCX, carCY, '#ff8800', 16);
            spawnParticles(carCX, carCY, '#ffff00', 8);
            if (settings.screenShake) screenShake = Math.max(screenShake, 14);
            _cityCarHit = true; break;
          }
          car.hit.add(p);
          dealDamage(null, p, 20, 28, 1.0, false, 16);
          spawnParticles(p.cx(), p.cy(), '#ffcc00', 12);
          if (settings.screenShake) screenShake = Math.max(screenShake, 12);
          _cityCarHit = true; break; // car destroyed on first player hit
        }
      }
      if (_cityCarHit) { mapPerkState.cityCars.splice(ci, 1); continue; }
    }
  }

  // ---- ICE: Yeti rare encounter ----
  if (currentArenaKey === 'ice') {
    // Clean up dead yeti and start respawn cooldown
    if (yeti && yeti.health <= 0) { _achCheckYetiDead(); yeti = null; yetiCooldown = SPAWN_CONFIG.yeti.respawnDelay; }
    if (yetiCooldown > 0) yetiCooldown--;
    // Deterministic interval spawn — no hidden randomness
    if (!yeti && yetiCooldown <= 0 && frameCount >= SPAWN_CONFIG.yeti.minDelay && frameCount % SPAWN_CONFIG.yeti.spawnInterval === 0) {
      spawnYetiNow();
    }
  }

  // ---- ICE/SNOW: Blizzard wind gusts ----
  if (currentArenaKey === 'ice') {
    if (mapPerkState.blizzardTimer === undefined) mapPerkState.blizzardTimer = 1200;
    if (mapPerkState.blizzardActive === undefined) mapPerkState.blizzardActive = false;
    if (mapPerkState.blizzardDir    === undefined) mapPerkState.blizzardDir    = 1;
    mapPerkState.blizzardTimer--;
    if (!mapPerkState.blizzardActive && mapPerkState.blizzardTimer <= 0) {
      mapPerkState.blizzardActive = true;
      mapPerkState.blizzardDir    = Math.random() < 0.5 ? 1 : -1;
      mapPerkState.blizzardTimer  = 180; // gust lasts 3 seconds
      if (settings.dmgNumbers) damageTexts.push(new DamageText(GAME_W / 2, 80, 'BLIZZARD!', '#88ccff'));
    } else if (mapPerkState.blizzardActive && mapPerkState.blizzardTimer <= 0) {
      mapPerkState.blizzardActive = false;
      mapPerkState.blizzardTimer  = 1200 + Math.floor(Math.random() * 600);
    }
    if (mapPerkState.blizzardActive) {
      const pushForce = 1.2 * mapPerkState.blizzardDir;
      for (const p of players) {
        if (p.health <= 0) continue;
        p.vx += pushForce;
        // Spawn snow particles
        if (Math.random() < 0.25 && particles.length < MAX_PARTICLES) {
          const _p = _getParticle();
          _p.x = Math.random() * GAME_W; _p.y = -5;
          _p.vx = -2 * mapPerkState.blizzardDir + (Math.random()-0.5)*2;
          _p.vy = 2 + Math.random() * 2;
          _p.color = 'rgba(200,230,255,0.7)'; _p.size = 2 + Math.random() * 2;
          _p.life = 50; _p.maxLife = 50;
          particles.push(_p);
        }
      }
    }
  }

  // ---- CAVE: Falling stalactites ----
  if (currentArenaKey === 'cave') {
    if (!mapPerkState.stalactites)        mapPerkState.stalactites        = [];
    if (mapPerkState.stalactiteCooldown === undefined) mapPerkState.stalactiteCooldown = 480;
    mapPerkState.stalactiteCooldown--;
    if (mapPerkState.stalactiteCooldown <= 0 && mapPerkState.stalactites.length < 5) {
      const sx = 60 + Math.random() * (GAME_W - 120);
      mapPerkState.stalactites.push({ x: sx, y: 20, vy: 0, fallen: false, warnTimer: 90 });
      mapPerkState.stalactiteCooldown = 360 + Math.floor(Math.random() * 300);
    }
    for (let si = mapPerkState.stalactites.length - 1; si >= 0; si--) {
      const st = mapPerkState.stalactites[si];
      if (st.warnTimer > 0) { st.warnTimer--; continue; }
      st.vy += 0.6;
      st.y  += st.vy;
      if (st.y > GAME_H + 20) { mapPerkState.stalactites.splice(si, 1); continue; }
      for (const p of players) {
        if (p.health <= 0 || p.invincible > 0 || p.isBoss) continue;
        if (Math.abs(p.cx() - st.x) < 18 && Math.abs((p.y + p.h / 2) - st.y) < 30) {
          dealDamage(null, p, 22, 14);
          spawnParticles(st.x, st.y, '#8a5a3a', 10);
          if (settings.screenShake) screenShake = Math.max(screenShake, 8);
          mapPerkState.stalactites.splice(si, 1);
          break;
        }
      }
    }
  }

  // ---- VOLCANO: Lava geysers ----
  if (currentArenaKey === 'volcano') {
    if (!mapPerkState.geysers)        mapPerkState.geysers        = [];
    if (mapPerkState.geyserCooldown === undefined) mapPerkState.geyserCooldown = 420;
    mapPerkState.geyserCooldown--;
    if (mapPerkState.geyserCooldown <= 0 && mapPerkState.geysers.length < 4) {
      const gx = 80 + Math.random() * (GAME_W - 160);
      mapPerkState.geysers.push({ x: gx, timer: 200 });
      mapPerkState.geyserCooldown = 300 + Math.floor(Math.random() * 300);
    }
    for (let gi = mapPerkState.geysers.length - 1; gi >= 0; gi--) {
      const gy = mapPerkState.geysers[gi];
      gy.timer--;
      if (gy.timer <= 0) { mapPerkState.geysers.splice(gi, 1); continue; }
      if (gy.timer % 4 === 0 && settings.particles && particles.length < MAX_PARTICLES) {
        const upA = -Math.PI / 2 + (Math.random() - 0.5) * 0.6;
        const _p = _getParticle();
        _p.x = gy.x; _p.y = currentArena.lavaY || 442;
        _p.vx = Math.cos(upA) * 4; _p.vy = Math.sin(upA) * (9 + Math.random() * 9);
        _p.color = Math.random() < 0.5 ? '#ff5500' : '#ff9900';
        _p.size = 4 + Math.random() * 5; _p.life = 35 + Math.random() * 20; _p.maxLife = 55;
        particles.push(_p);
      }
      for (const p of players) {
        if (p.isBoss || p.health <= 0 || p.invincible > 0) continue;
        if (Math.abs(p.cx() - gy.x) < 90 && p.y + p.h > (currentArena.lavaY || 442) - 280) {
          if (gy.timer % 10 === 0) dealDamage(null, p, Math.ceil(p.maxHealth * 0.04), 7);
        }
      }
    }
  }

  // ---- HAUNTED: Drifting ghost NPCs ----
  if (currentArenaKey === 'haunted') {
    if (!mapPerkState.ghosts)        mapPerkState.ghosts        = [];
    if (mapPerkState.ghostCooldown === undefined) mapPerkState.ghostCooldown = 600;
    mapPerkState.ghostCooldown--;
    if (mapPerkState.ghostCooldown <= 0 && mapPerkState.ghosts.length < 3) {
      const fromLeft = Math.random() < 0.5;
      mapPerkState.ghosts.push({
        x: fromLeft ? -40 : GAME_W + 40,
        y: 100 + Math.random() * 300,
        vx: fromLeft ? 1.4 : -1.4,
        timer: 480
      });
      mapPerkState.ghostCooldown = 480 + Math.floor(Math.random() * 480);
    }
    for (let ghi = mapPerkState.ghosts.length - 1; ghi >= 0; ghi--) {
      const gh = mapPerkState.ghosts[ghi];
      gh.x += gh.vx;
      gh.timer--;
      if (gh.timer <= 0 || gh.x < -80 || gh.x > GAME_W + 80) {
        mapPerkState.ghosts.splice(ghi, 1); continue;
      }
      for (const p of players) {
        if (p.health <= 0 || p.invincible > 0 || p.isBoss) continue;
        if (Math.hypot(p.cx() - gh.x, p.cy() - gh.y) < 30) {
          dealDamage(null, p, 8, 5);
          spawnParticles(gh.x, gh.y, '#aa88ff', 8);
          mapPerkState.ghosts.splice(ghi, 1);
          break;
        }
      }
    }
  }

  // ---- NEON GRID: Speed boost pads on floor ----
  if (currentArenaKey === 'neonGrid') {
    const pads = (mapPerkState.boostPads) || [];
    for (const pad of pads) {
      for (const p of players) {
        if (p.health <= 0 || p.isBoss) continue;
        if (p.onGround && Math.abs(p.cx() - pad.x) < 30) {
          p._speedBuff = Math.max(p._speedBuff || 0, 18); // 0.3s burst
          if (frameCount % 30 === 0) spawnParticles(pad.x, pad.y, '#00ff88', 5);
        }
      }
    }
  }

  // ---- CYBERPUNK: Periodic floor zap ----
  if (currentArenaKey === 'cyberpunk') {
    if (mapPerkState.zapTimer === undefined) mapPerkState.zapTimer = 900;
    if (mapPerkState.zapActive === undefined) mapPerkState.zapActive = false;
    mapPerkState.zapTimer--;
    if (!mapPerkState.zapActive && mapPerkState.zapTimer <= 0) {
      mapPerkState.zapActive = true;
      mapPerkState.zapLine   = 60 + Math.random() * (GAME_W - 120);
      mapPerkState.zapTimer  = 120; // zap lasts 2s
      if (settings.dmgNumbers) damageTexts.push(new DamageText(GAME_W / 2, 80, 'ZAP!', '#00eeff'));
    } else if (mapPerkState.zapActive && mapPerkState.zapTimer <= 0) {
      mapPerkState.zapActive = false;
      mapPerkState.zapTimer  = 600 + Math.floor(Math.random() * 600);
    }
    if (mapPerkState.zapActive) {
      for (const p of players) {
        if (p.health <= 0 || p.invincible > 0 || p.isBoss) continue;
        if (Math.abs(p.cx() - mapPerkState.zapLine) < 40 && p.onGround) {
          if (frameCount % 12 === 0) dealDamage(null, p, 10, 6);
        }
      }
    }
  }
}

function applyMapPerk(player, type) {
  if (type === 'heal') {
    player.health = Math.min(player.maxHealth, player.health + 30);
  } else if (type === 'speed') {
    player._speedBuff = 360; // 6 seconds
  } else if (type === 'power') {
    player._powerBuff = 360;
  } else if (type === 'shield') {
    player.invincible = Math.max(player.invincible, 180);
    spawnParticles(player.cx(), player.cy(), '#88ddff', 20);
  } else if (type === 'maxhp') {
    player.maxHealth = Math.min(250, player.maxHealth + 15);
    player.health    = Math.min(player.maxHealth, player.health + 15);
    spawnParticles(player.cx(), player.cy(), '#ff88ff', 20);
  } else if (type === 'curse_slow') {
    if (!player.curses) player.curses = [];
    player.curses = player.curses.filter(c => c.type !== 'curse_slow');
    player.curses.push({ type: 'curse_slow', timer: 30 * 60 }); // 30s
    spawnParticles(player.cx(), player.cy(), '#4488ff', 14);
  } else if (type === 'curse_weak') {
    if (!player.curses) player.curses = [];
    player.curses = player.curses.filter(c => c.type !== 'curse_weak');
    player.curses.push({ type: 'curse_weak', timer: 20 * 60 }); // 20s
    spawnParticles(player.cx(), player.cy(), '#222222', 14);
  } else if (type === 'curse_fragile') {
    if (!player.curses) player.curses = [];
    player.curses = player.curses.filter(c => c.type !== 'curse_fragile');
    player.curses.push({ type: 'curse_fragile', timer: 25 * 60 }); // 25s
    spawnParticles(player.cx(), player.cy(), '#ff8800', 14);
  } else if (type === 'curse_maxhp_perm') {
    player.maxHealth = Math.max(50, player.maxHealth - 15);
    if (player.health > player.maxHealth) player.health = player.maxHealth;
    spawnParticles(player.cx(), player.cy(), '#880000', 18);
  }
}

function drawMapPerks() {
  // ---- RUINS artifacts ----
  if (currentArenaKey === 'ruins') {
    // Breakable crates
    if (mapPerkState.crates) {
      for (const crate of mapPerkState.crates) {
        const sx = crate.hitShake > 0 ? (Math.random() - 0.5) * 4 : 0;
        const bx = crate.x + sx;
        const by = crate.y;          // crate bottom = platform top
        const cw = 32, ch = 28;
        ctx.save();
        // Box body
        ctx.fillStyle = '#7B4F2A';
        ctx.fillRect(bx - cw/2, by - ch, cw, ch);
        // Wood grain lines
        ctx.strokeStyle = '#4A2E10';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(bx - cw/2, by - ch, cw, ch);
        ctx.beginPath();
        ctx.moveTo(bx, by - ch); ctx.lineTo(bx, by);
        ctx.moveTo(bx - cw/2, by - ch/2); ctx.lineTo(bx + cw/2, by - ch/2);
        ctx.stroke();
        // HP bar
        const hpFrac = crate.hp / crate.maxHp;
        ctx.fillStyle = '#222';
        ctx.fillRect(bx - 18, by - ch - 7, 36, 4);
        ctx.fillStyle = hpFrac > 0.5 ? '#44dd44' : hpFrac > 0.25 ? '#ddcc22' : '#dd3333';
        ctx.fillRect(bx - 18, by - ch - 7, 36 * hpFrac, 4);
        // Type icon
        const icons = { speed:'S', power:'P', heal:'H', shield:'D', maxhp:'+' };
        ctx.fillStyle = '#ffe8a0';
        ctx.font = 'bold 11px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(icons[crate.type] || '?', bx, by - ch/2);
        ctx.restore();
      }
    }
    for (const item of mapItems) {
      if (item.collected) continue;
      const bob   = Math.sin(item.animPhase) * 5;
      const glow  = 0.6 + Math.sin(item.animPhase * 1.3) * 0.3;
      const colors = { speed:'#44aaff', power:'#ff4422', heal:'#44ff88', shield:'#88ddff', maxhp:'#ff88ff' };
      const glowC  = colors[item.type] || '#ffd700';
      ctx.save();
      ctx.shadowColor = glowC;
      ctx.shadowBlur  = 12 * glow;
      ctx.fillStyle   = glowC;
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.arc(item.x, item.y + bob, 10, 0, Math.PI * 2);
      ctx.fill();
      // Icon letter
      ctx.fillStyle   = '#000';
      ctx.shadowBlur  = 0;
      ctx.font        = 'bold 10px Arial';
      ctx.textAlign   = 'center';
      ctx.textBaseline = 'middle';
      const icons = { speed:'S', power:'P', heal:'H', shield:'D', maxhp:'+' };
      ctx.fillText(icons[item.type] || '?', item.x, item.y + bob);
      ctx.restore();
    }
  }

  // ---- LAVA eruption columns (lava arena + boss arena lava hazard) ----
  const showEruptions = (currentArenaKey === 'lava' || currentArenaKey === 'creator') && mapPerkState.eruptions;
  if (showEruptions) {
    const ly = currentArena.lavaY || 462;
    for (const er of mapPerkState.eruptions) {
      const progress = 1 - (er.timer / 180);
      const colH = Math.min(300, progress * 600);
      const alpha = er.timer < 40 ? er.timer / 40 : Math.min(1, (180 - er.timer) / 18 + 0.55);
      ctx.save();
      ctx.globalAlpha = alpha * 0.90;
      const cg = ctx.createLinearGradient(er.x, ly, er.x, ly - colH);
      cg.addColorStop(0, '#ff8800');
      cg.addColorStop(0.35, 'rgba(255,60,0,0.80)');
      cg.addColorStop(1, 'rgba(255,40,0,0)');
      ctx.fillStyle = cg;
      ctx.fillRect(er.x - 40, ly - colH, 80, colH);
      ctx.restore();
    }
  }

  // ---- CITY cars ----
  if (currentArenaKey === 'city' && mapPerkState.cars) {
    for (const car of mapPerkState.cars) {
      if (car.warnTimer > 0) {
        // Warning arrow
        const wx = car.vx > 0 ? 20 : GAME_W - 20;
        ctx.save();
        ctx.globalAlpha = Math.sin(frameCount * 0.3) * 0.5 + 0.5;
        ctx.fillStyle   = '#ff4400';
        ctx.font        = 'bold 18px Arial';
        ctx.textAlign   = 'center';
        ctx.fillText(car.vx > 0 ? '\u25b6 CAR!' : 'CAR! \u25c0', wx, car.y - 20);
        ctx.restore();
        continue;
      }
      ctx.save();
      ctx.fillStyle = '#cc3300';
      ctx.fillRect(car.x - 30, car.y - 24, 60, 24);
      ctx.fillStyle = '#ff5500';
      ctx.fillRect(car.x - 24, car.y - 38, 48, 16);
      ctx.fillStyle = '#ffee88';
      ctx.fillRect(car.vx > 0 ? car.x + 26 : car.x - 34, car.y - 20, 8, 8);
      ctx.restore();
    }
  }

  // ---- SPACE: Draw meteors + warning ----
  if (currentArenaKey === 'space' && mapPerkState.meteors) {
    for (const m of mapPerkState.meteors) {
      ctx.save();
      if (m.warnTimer > 0) {
        // Red X warning on ground
        ctx.globalAlpha = Math.sin(frameCount * 0.4) * 0.5 + 0.5;
        ctx.strokeStyle = '#ff4400';
        ctx.lineWidth   = 3;
        ctx.beginPath();
        ctx.moveTo(m.x - 14, 450); ctx.lineTo(m.x + 14, 464);
        ctx.moveTo(m.x + 14, 450); ctx.lineTo(m.x - 14, 464);
        ctx.stroke();
        // Dashed drop line
        ctx.setLineDash([4, 6]);
        ctx.strokeStyle = 'rgba(255,100,0,0.4)';
        ctx.beginPath(); ctx.moveTo(m.x, 0); ctx.lineTo(m.x, 450); ctx.stroke();
      } else {
        // Meteor body
        const mg = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, 16);
        mg.addColorStop(0, '#ffffff');
        mg.addColorStop(0.4, '#ffaa44');
        mg.addColorStop(1, '#cc3300');
        ctx.fillStyle = mg;
        ctx.shadowColor = '#ff6600';
        ctx.shadowBlur  = 16;
        ctx.beginPath(); ctx.arc(m.x, m.y, 14, 0, Math.PI * 2); ctx.fill();
        // Trail
        ctx.globalAlpha = 0.4;
        ctx.fillStyle = '#ffaa44';
        ctx.beginPath(); ctx.arc(m.x, m.y - 20, 8, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 0.2;
        ctx.beginPath(); ctx.arc(m.x, m.y - 38, 5, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }
  }

  // ---- CITY: Draw cars ----
  if (currentArenaKey === 'city' && mapPerkState.cityCars) {
    for (const car of mapPerkState.cityCars) {
      ctx.save();
      const carTop = car.y - car.h;
      // Car body
      ctx.fillStyle = car.color;
      ctx.fillRect(car.x, carTop, car.w, car.h);
      // Windows
      ctx.fillStyle = 'rgba(160,220,255,0.75)';
      ctx.fillRect(car.x + 6, carTop + 3, 14, 9);
      ctx.fillRect(car.x + car.w - 20, carTop + 3, 14, 9);
      // Wheels
      ctx.fillStyle = '#111';
      ctx.beginPath(); ctx.arc(car.x + 12, car.y, 6, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(car.x + car.w - 12, car.y, 6, 0, Math.PI * 2); ctx.fill();
      // Headlights
      ctx.fillStyle = car.vx > 0 ? '#ffffaa' : 'rgba(255,60,60,0.9)';
      ctx.beginPath(); ctx.arc(car.vx > 0 ? car.x + car.w : car.x, car.y - car.h / 2, 4, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  }

  // ---- ICE: Blizzard overlay ----
  if (currentArenaKey === 'ice' && mapPerkState.blizzardActive) {
    ctx.save();
    const windAlpha = Math.min(1, (180 - mapPerkState.blizzardTimer) / 60) * 0.18;
    ctx.fillStyle = `rgba(180,220,255,${windAlpha})`;
    ctx.fillRect(0, 0, GAME_W, GAME_H);
    // Wind lines
    ctx.strokeStyle = 'rgba(200,240,255,0.35)';
    ctx.lineWidth = 1.5;
    for (let li = 0; li < 12; li++) {
      const lx = ((frameCount * 6 * mapPerkState.blizzardDir + li * 80) % (GAME_W + 60)) - 30;
      const ly = 40 + li * 45;
      ctx.beginPath();
      ctx.moveTo(lx, ly);
      ctx.lineTo(lx + mapPerkState.blizzardDir * -60, ly + 8);
      ctx.stroke();
    }
    ctx.restore();
  }
}

// ============================================================
// WEAPON DEFINITIONS
// ============================================================
const WEAPONS = {
  sword: {
    // THE ALL-ROUNDER: Fast, mobile, reliable. Jack of all trades.
    // Identity: Dash Slash chases and punishes. Great neutral game.
    name: 'Sword',   damage: 16, range: 90, cooldown: 30, endlag: 7,
    kb: 10,          abilityCooldown: 150, type: 'melee', weaponType: 'light', color: '#cccccc',
    abilityName: 'Dash Slash',
    ability(user, target) {
      user.vx = user.facing * 16;
      if (dist(user, target) < 130) dealDamage(user, target, 28, 16);
    }
  },
  hammer: {
    // THE CRUSHER: Slow, punishing, massive knockback. Forces commitment.
    // Identity: Every hit sends enemies flying. One good read = huge reward.
    name: 'Hammer',  damage: 22, range: 80, cooldown: 62, endlag: 22,
    kb: 20,          abilityCooldown: 230, type: 'melee', weaponType: 'heavy', color: '#888888',
    abilityName: 'Ground Slam',
    ability(user, target) {
      screenShake = Math.max(screenShake, 24);
      spawnRing(user.cx(), user.y + user.h);
      if (dist(user, target) < 145) dealDamage(user, target, 28, 22);
    }
  },
  gun: {
    // THE HARASSER: Reliable ranged poke. Rewards keeping distance.
    // Identity: Steady chip damage + burst fire ability. Control space.
    name: 'Gun',     damage: 9, range: 600, cooldown: 32, endlag: 6,
    damageFunc: () => Math.floor(Math.random() * 4) + 7,
    superRateBonus: 1.2,
    splashRange: 38, splashDmgPct: 0.30,
    clipSize: 6, reloadFrames: 90,
    kb: 7,           abilityCooldown: 200, type: 'ranged', weaponType: 'ranged', color: '#666666',
    abilityName: 'Burst Shot',
    ability(user, _target) {
      // 3-round burst: fires 3 bullets in a tight vertical fan, rapid-fire feel
      user._qSuperCapRemaining = 10; // max 10% super per activation
      const offsets = [-0.55, 0, 0.55]; // slight vertical spread
      for (let i = 0; i < 3; i++) {
        setTimeout(() => {
          if (!gameRunning || user.health <= 0) return;
          const _p = spawnBullet(user, 9, '#ffdd00', 7);
          if (_p) {
            _p._isQAbility = true;
            _p.vy += offsets[i]; // fan spread
          }
        }, i * 60);
      }
      setTimeout(() => { user._qSuperCapRemaining = undefined; }, 400);
    }
  },
  axe: {
    // THE SPINNER: Mid-range AoE brawler. Covers angles, not pure damage.
    // Identity: Spin Attack is a defensive escape AND offensive tool. Trades raw dmg for coverage.
    name: 'Axe',     damage: 13, range: 88, cooldown: 52, endlag: 16,
    splashRange: 70, splashDmgPct: 0.30,
    kb: 10,          abilityCooldown: 180, type: 'melee', weaponType: 'heavy', color: '#cc4422',
    abilityName: 'Spin Attack',
    ability(user, target) {
      user.spinning = 30;
      if (dist(user, target) < 110) dealDamage(user, target, 16, 11);
    }
  },
  spear: {
    // THE POKER: Longest melee reach. Safe, consistent, spacing-dependent.
    // Identity: Never lets enemies get close. Low KB keeps spacing tight for follow-ups.
    name: 'Spear',   damage: 15, range: 140, cooldown: 44, endlag: 12,
    kb: 7,           abilityCooldown: 165, type: 'melee', weaponType: 'light', color: '#8888ff',
    abilityName: 'Lunge',
    ability(user, target) {
      user.vx = user.facing * 14;
      user.vy = -5;
      if (dist(user, target) < 150) dealDamage(user, target, 18, 10);
    }
  },
  bow: {
    // THE SNIPER: Highest single-shot ranged damage. Archer class only.
    // Identity: Huge range, powerful arrow, but slow fire rate demands good aim.
    name: 'Bow',  damage: 0, range: 700, cooldown: 52, endlag: 4,
    damageFunc: () => Math.floor(14 + Math.random() * 8),
    clipSize: 3, reloadFrames: 120,
    kb: 14,       abilityCooldown: 185, type: 'ranged', weaponType: 'ranged', color: '#aad47a',
    requiresClass: 'archer',
    abilityName: 'Triple Shot',
    ability(user, _target) {
      user._qHitCount = 0;
      user._qSuperCapRemaining = 28;
      const angles = [-0.22, 0, 0.22];
      for (let i = 0; i < 3; i++) {
        const dmg = user.weapon.damageFunc();
        const speed = 13;
        const vx = user.facing * speed * Math.cos(angles[i]);
        const vy = speed * Math.sin(angles[i]);
        const _p = new Projectile(user.cx() + user.facing * 12, user.y + 22, vx, vy, user, dmg, '#aad47a');
        _p._isQAbility = true;
        projectiles.push(_p);
      }
      setTimeout(() => { user._qSuperCapRemaining = undefined; }, 400);
    }
  },
  shield: {
    // THE WALL: Lowest damage, highest block and pushback. Paladin class only.
    // Identity: You don't kill with damage — you kill by shoving enemies off platforms.
    name: 'Shield', damage: 10, range: 52, cooldown: 36, endlag: 9,
    kb: 26,         abilityCooldown: 195, type: 'melee', weaponType: 'heavy', color: '#88aaff',
    requiresClass: 'paladin',
    contactDmgMult: 0,
    abilityName: 'Shield Bash',
    ability(user, target) {
      if (dist(user, target) < 105) {
        target.vx  = user.facing * 26;
        target.stunTimer = Math.max(target.stunTimer || 0, 12);
        dealDamage(user, target, 12, 22);
        spawnParticles(target.cx(), target.cy(), '#88aaff', 10);
      }
    }
  },
  scythe: {
    // THE SUSTAINER: Wide sweep with lifesteal. Weaker 1v1, stronger vs groups.
    // Identity: Fights multiple targets simultaneously. Healing rewards multi-hit risks.
    name: 'Scythe', damage: 12, range: 100, cooldown: 44, endlag: 13,
    splashRange: 60, splashDmgPct: 0.35,
    kb: 8,           abilityCooldown: 195, type: 'melee', weaponType: 'light', color: '#aa44aa',
    abilityName: 'Reaping Sweep',
    ability(user, _target) {
      let healed = 0;
      for (const p of players) {
        if (p === user || p.health <= 0) continue;
        if (dist(user, p) < 125) { dealDamage(user, p, 10, 7); healed++; }
      }
      for (const d of trainingDummies) {
        if (d.health > 0 && dist(user, d) < 125) { dealDamage(user, d, 10, 7); healed++; }
      }
      if (healed > 0) {
        user.health = Math.min(user.maxHealth, user.health + healed * 3);
        spawnParticles(user.cx(), user.cy(), '#aa44aa', 12);
      }
    }
  },
  fryingpan: {
    // THE STUNNER: Slow but delivers punishing stun windows. Reads = reward.
    // Identity: Land the slow swing → stun window → follow-up combo. High risk, high reward.
    name: 'Frying Pan', damage: 18, range: 60, cooldown: 58, endlag: 20,
    kb: 12,              abilityCooldown: 220, type: 'melee', weaponType: 'heavy', color: '#ccaa44',
    abilityName: 'Pan Slam',
    ability(user, target) {
      if (dist(user, target) < 105) {
        dealDamage(user, target, 22, 16);
        target.stunTimer = Math.max(target.stunTimer || 0, 18); // reduced from 35 — brief stun, not a chain lock
        spawnParticles(target.cx(), target.cy(), '#ffdd66', 12);
        screenShake = Math.max(screenShake, 12);
      }
    }
  },
  broomstick: {
    // THE PUSHER: Long reach + extreme knockback. Kills by platform denial.
    // Identity: Lowest damage, highest push force. Win by edgeguarding.
    name: 'Broomstick', damage: 12, range: 125, cooldown: 32, endlag: 8,
    kb: 22,              abilityCooldown: 155, type: 'melee', weaponType: 'light', color: '#aa8855',
    abilityName: 'Sweep',
    ability(user, target) {
      user.vx = user.facing * 12;
      if (dist(user, target) < 165) {
        dealDamage(user, target, 14, 18);
        target.vx += user.facing * 24; // huge push toward edge
        spawnParticles(target.cx(), target.cy(), '#cc9966', 10);
      }
    }
  },
  boxinggloves: {
    // THE BRAWLER: Fastest attack speed in the game. Wins by relentless pressure.
    // Identity: Lowest range, must stay face-to-face. Rapid Combo is the identity skill.
    name: 'Boxing Gloves', damage: 9, range: 50, cooldown: 20, endlag: 10,
    kb: 4,                 abilityCooldown: 110, type: 'melee', weaponType: 'light', color: '#ee3333',
    abilityName: 'Rapid Combo',
    ability(user, target) {
      let count = 0;
      const doHit = () => {
        if (!gameRunning || user.health <= 0) return;
        if (dist(user, target) < 90) {
          dealDamage(user, target, 11, 4);
          spawnParticles(target.cx(), target.cy(), '#ff4444', 4);
        }
        count++;
        if (count < 5) setTimeout(doHit, 90);
      };
      doHit();
    }
  },
  peashooter: {
    // THE HARASSER: Fastest fire rate. Chip damage and interrupts enemy combos.
    // Identity: Each shot is weak but relentless. Storm ability dumps huge lead.
    name: 'Pea Shooter', damage: 0, range: 700, cooldown: 18, endlag: 5,
    damageFunc: () => 2 + Math.floor(Math.random() * 2), // 2-3 per shot
    bulletSpeed: 15, bulletColor: '#44cc44',
    clipSize: 15, reloadFrames: 75,
    kb: 3,               abilityCooldown: 120, type: 'ranged', weaponType: 'ranged', color: '#44cc44',
    abilityName: 'Pea Storm',
    ability(user, _target) {
      user._qHitCount = 0;
      user._qSuperCapRemaining = 28;
      for (let i = 0; i < 9; i++) {
        setTimeout(() => {
          if (!gameRunning || user.health <= 0) return;
          const angle = (Math.random() - 0.5) * 0.28;
          const spd   = 13 + Math.random() * 3;
          const _p = new Projectile(
            user.cx() + user.facing * 12, user.y + 22,
            user.facing * spd * Math.cos(angle), spd * Math.sin(angle),
            user, user.weapon.damageFunc(), '#44cc44'
          );
          _p._isQAbility = true;
          projectiles.push(_p);
        }, i * 65);
      }
      setTimeout(() => { user._qSuperCapRemaining = undefined; }, 800);
    }
  },
  slingshot: {
    // THE AIM-REWARDING SNIPER: Highest per-shot ranged damage. Slow but punishing.
    // Identity: Arc trajectory demands prediction. Land a hit = big reward.
    name: 'Slingshot', damage: 0, range: 650, cooldown: 62, endlag: 5,
    damageFunc: () => 10 + Math.floor(Math.random() * 5), // 10-14 per shot (was 15-21)
    bulletSpeed: 9, bulletColor: '#ff9933', bulletVy: -1.5,
    clipSize: 4, reloadFrames: 130,
    kb: 10,            abilityCooldown: 230, type: 'ranged', weaponType: 'ranged', color: '#cc8833',
    abilityName: 'Power Stone',
    ability(user, target) {
      const dx = (target.cx() - user.cx()) || 1;
      const dy = (target.cy() - user.cy()) || 1;
      const len = Math.hypot(dx, dy);
      const proj = new Projectile(
        user.cx() + user.facing * 12, user.y + 22,
        (dx / len) * 14, (dy / len) * 14,
        user, 30, '#ff9933'
      );
      proj.splashRange = 50;
      proj.dmg = 22;
      projectiles.push(proj);
    }
  },
  paperairplane: {
    // THE TRICKSTER: Unpredictable arc confuses and disrupts. Unique flight path.
    // Identity: Angles and curves opponents can't predict. Barrage forces dodging.
    name: 'Paper Airplane', damage: 0, range: 800, cooldown: 35, endlag: 8,
    damageFunc: () => 8 + Math.floor(Math.random() * 5), // 8-12 per shot
    bulletSpeed: 7, bulletColor: '#aaccff', bulletVy: -0.5,
    clipSize: 5, reloadFrames: 80,
    kb: 6,                  abilityCooldown: 160, type: 'ranged', weaponType: 'ranged', color: '#ddeeff',
    abilityName: 'Paper Barrage',
    ability(user, _target) {
      for (let i = 0; i < 5; i++) {
        setTimeout(() => {
          if (!gameRunning || user.health <= 0) return;
          const angle = (Math.random() - 0.5) * 0.55;
          projectiles.push(new Projectile(
            user.cx() + user.facing * 12, user.y + 20,
            user.facing * (8 + Math.random() * 5) * Math.cos(angle),
            (8 + Math.random() * 5) * Math.sin(angle) - 2,
            user, user.weapon.damageFunc(), '#aaccff'
          ));
        }, i * 120);
      }
    }
  },
  gauntlet: {
    // Boss-only weapon. Heavy hitting melee, massive void slam ability.
    name: 'Gauntlet', damage: 13, range: 30, cooldown: 38,
    kb: 18,            abilityCooldown: 160, type: 'melee', weaponType: 'heavy', color: '#9900ee',
    contactDmgMult: 0.55,
    abilityName: 'Void Slam',
    ability(user, _target) {
      screenShake = Math.max(screenShake, 28);
      spawnRing(user.cx(), user.cy());
      spawnRing(user.cx(), user.cy());
      for (const p of players) {
        if (p === user || p.health <= 0) continue;
        if (dist(user, p) < 165) dealDamage(user, p, 22, 40);
      }
      // Also hit training dummies
      for (const d of trainingDummies) {
        if (d.health <= 0) continue;
        if (dist(user, d) < 165) dealDamage(user, d, 7, 40);
      }
    }
  },

  mkgauntlet: {
    // Megaknight class weapon — locked to Megaknight. Overrides handled in attack()/ability().
    name: 'Mk. Gauntlets', damage: 20, range: 72, cooldown: 22,
    kb: 24, abilityCooldown: 75, type: 'melee', weaponType: 'heavy', color: '#8844ff',
    contactDmgMult: 0.5, abilityName: 'Uppercut',
    ability(_user, _tgt) { /* fully overridden by Megaknight class */ }
  },

  // ── ENEMY-ONLY WEAPONS (never available in player weapon picker) ─────────
  voidblade: {
    enemyOnly: true,
    name: 'Void Blade', damage: 14, range: 58, cooldown: 26, endlag: 9,
    kb: 10, abilityCooldown: 140, type: 'melee', weaponType: 'light', color: '#9933ff',
    abilityName: 'Void Slash',
    ability(user, target) {
      if (!target || target.health <= 0) return;
      // Lunge forward + rapid slashes
      user.vx = user.facing * 14;
      if (dist(user, target) < 80) dealDamage(user, target, 10, 8);
      if (dist(user, target) < 80) dealDamage(user, target, 10, 8);
      spawnParticles(user.cx(), user.cy(), '#9933ff', 8);
      spawnParticles(user.cx(), user.cy(), '#cc66ff', 5);
    }
  },

  shockrifle: {
    enemyOnly: true,
    name: 'Shock Rifle', damage: 8, range: 600, cooldown: 36, endlag: 10,
    kb: 6, abilityCooldown: 180, type: 'ranged', weaponType: 'ranged', color: '#00ddff',
    abilityName: 'Chain Lightning',
    ability(user, _target) {
      // Rapid triple burst — fire 3 projectiles in quick sequence
      spawnBullet(user, 22, '#00eeff', 11);
      spawnBullet(user, 20, '#00ccdd', 11);
      spawnBullet(user, 18, '#0099bb', 11);
      spawnParticles(user.cx(), user.cy(), '#00ddff', 6);
    }
  }
};

const WEAPON_KEYS = Object.keys(WEAPONS).filter(k => k !== 'gauntlet' && k !== 'mkgauntlet' && !WEAPONS[k].enemyOnly);

// ============================================================
// CHARACTER CLASSES
// ============================================================
const CLASSES = {
  none:      { name: 'None',      desc: 'Standard balanced fighter',            weapon: null,     hp: 150, speedMult: 1.00, perk: null           },
  thor:      { name: 'Thor',      desc: 'Hammer master, thunder on dash',       weapon: 'hammer', hp: 150, speedMult: 0.90, perk: 'thunder'      },
  kratos:    { name: 'Kratos',    desc: 'Axe specialist, rage at low HP',       weapon: 'axe',    hp: 150, speedMult: 0.95, perk: 'rage'         },
  ninja:     { name: 'Ninja',     desc: 'Fast sword fighter, quick dash',       weapon: 'sword',  hp: 150, speedMult: 1.24, perk: 'swift'        },
  gunner:    { name: 'Gunner',    desc: 'Dual-shot gunslinger',                 weapon: 'gun',    hp: 150, speedMult: 1.06, perk: 'dual_shot'    },
  archer:    { name: 'Archer',    desc: 'Bow-only. Fast. Auto-backstep at low HP.', weapon: 'bow', hp: 150, speedMult: 1.20, perk: 'backstep'    },
  paladin:   { name: 'Paladin',   desc: 'Shield-only. Tanky. 15% dmg reduction.', weapon: 'shield', hp: 150, speedMult: 0.88, perk: 'holy_light' },
  berserker:  { name: 'Berserker',  desc: 'Any weapon. Rage boosts dmg at low HP.',             weapon: null, hp: 150, speedMult: 1.08, perk: 'blood_frenzy' },
  megaknight: { name: 'Megaknight', desc: 'Legendary knight. Smash, uppercut, and crush enemies.', weapon: 'mkgauntlet', hp: 150, speedMult: 0.84, perk: null },
};

// Damage multipliers applied when a class uses a weapon of a given weaponType.
// Keys must match classKey values used in applyClass().
const CLASS_AFFINITY = {
  archer: {
    light: 0.9,
    heavy: 0.7,
    ranged: 1.25
  },
  berserker: {
    light: 1.1,
    heavy: 1.3,
    ranged: 0.6
  },
  phasewalker: {
    light: 1.2,
    heavy: 0.8,
    ranged: 1.0
  },
  juggernaut: {
    light: 0.9,
    heavy: 1.4,
    ranged: 0.5
  }
};

// ============================================================
// WEAPON & CLASS DESCRIPTIONS  (shown in menu sidebar)
// ============================================================
const WEAPON_DESCS = {
  random:  { title: 'Random Weapon',  what: 'Picks a random weapon each game — embrace the chaos.',                                                         ability: null,                                                              super: null,                                                               how:  'Adapt to whatever you get each round.' },
  sword:   { title: 'Sword',          what: 'Fast, balanced melee weapon with good range. Damage: 18.',                                                     ability: 'Q — Dash Slash: dashes forward and slices for 36 dmg.',           super: 'E — Power Thrust: massive forward lunge for 60 dmg.',              how:  'Great all-rounder. Use Dash Slash to chase and punish.' },
  hammer:  { title: 'Hammer',         what: 'Slow but devastating. Huge knockback on every hit. Damage: 28.',                                               ability: 'Q — Ground Slam: shockwave AoE around you for 34 dmg.',          super: 'E — Mega Slam: screen-shaking AoE crush for 58 dmg.',              how:  'Get close, be patient, then smash hard.' },
  gun:     { title: 'Gun',            what: 'Ranged weapon. Each bullet deals 5–8 damage. Fires splash rounds.',                                            ability: 'Q — Rapid Fire: 5-shot burst.',                                   super: 'E — Bullet Storm: 14 rapid shots (9–12 dmg each).',               how:  'Keep your distance. Use Rapid Fire to pressure from afar.' },
  axe:     { title: 'Axe',            what: 'Balanced melee with solid damage, good knockback, and splash hits. Damage: 22.',                               ability: 'Q — Spin Attack: 360° slash that hits both sides.',               super: 'E — Berserker Spin: long spinning AoE for 52 dmg.',               how:  'Use Spin Attack in tight spots to cover all angles.' },
  spear:   { title: 'Spear',          what: 'Longest melee reach in the game. Consistent damage. Damage: 18.',                                              ability: 'Q — Lunge: leap forward with the spear for 30 dmg.',             super: 'E — Sky Piercer: aerial forward lunge for 50 dmg.',               how:  'Stay at optimal range. Poke safely from afar.' },
  bow:     { title: 'Bow ⚔ Archer only', what: 'Long-range arc weapon. Arrows deal 12–20 damage and arc slightly over distance.', ability: 'Q — Triple Shot: fires 3 arrows in a fan spread.',       super: 'E — Power Arrow: giant arrow for 60 dmg with high knockback.',    how:  'Stay back and poke. Triple Shot punishes clustered enemies. ARCHER CLASS REQUIRED.' },
  shield:  { title: 'Shield ⚔ Paladin only', what: 'Defensive melee weapon. High knockback. Damage: 10.', ability: 'Q — Shield Bash: pushes enemy back and stuns for 25 frames.',              super: 'E — Holy Nova: AoE burst, heals self and deals 40 dmg to nearby foes.', how: 'Block with S key to absorb bullets. Bash enemies away. PALADIN CLASS REQUIRED.' },
  scythe:       { title: 'Scythe',         what: 'Wide-arc melee with splash damage. Heals on ability kills. Damage: 20.',        ability: 'Q — Reaping Sweep: 360° sweep, heals 5 HP per target hit.',    super: 'E — Death\'s Toll: massive 40 dmg AoE sweep with lifesteal.',    how:  'Fight multiple enemies at once. Sweep into crowds for healing.' },
  fryingpan:    { title: 'Frying Pan',     what: 'Slow but punishing melee. High knockback and a 0.7s stun on ability. Damage: 20.', ability: 'Q — Pan Slam: heavy strike stuns for 40 frames.',              super: 'E — Mega Smack: shockwave stun for 55 dmg.',                     how:  'Patience is key. Land Pan Slam then follow up while they\'re stunned.' },
  broomstick:   { title: 'Broomstick',     what: 'Long-reach melee. Low damage but pushes enemies away. Damage: 10.',               ability: 'Q — Sweep: dash forward, huge push to enemy.',                 super: 'E — Tornado Spin: spin push that hits all directions.',           how:  'Keep pressure with the long reach. Sweep enemies off platforms.' },
  boxinggloves: { title: 'Boxing Gloves',  what: 'Very fast punches. Low damage per hit but combos build up. Damage: 7.',           ability: 'Q — Rapid Combo: 5-hit burst at close range.',                 super: 'E — KO Punch: massive single hit for 60 dmg.',                   how:  'Stay in close. The rapid combo ability is your main damage tool.' },
  peashooter:   { title: 'Pea Shooter',    what: 'Rapid-fire ranged weapon. Very low damage per pea (2-3). High fire rate.',        ability: 'Q — Pea Storm: 10 rapid shots.',                               super: 'E — Giant Pea: one huge pea for 40 dmg and big knockback.',      how:  'Annoy and whittle down enemies. Storm ability surprises up close.' },
  slingshot:    { title: 'Slingshot',      what: 'Ranged weapon with arc trajectory. Moderate damage (12-17). Slow fire rate.',     ability: 'Q — Power Stone: big stone with 60px splash for 24 dmg.',     super: 'E — Boulder Shot: massive arc shot for 55 dmg.',                 how:  'Aim ahead of moving targets. Arc makes it tricky but rewarding.' },
  paperairplane:{ title: 'Paper Airplane', what: 'Very slow curving projectile. Low damage (6-9) but unpredictable arc.',           ability: 'Q — Barrage: 4 airplanes at staggered angles.',               super: 'E — Paper Swarm: 8 planes in all directions.',                   how:  'Confuse enemies with the curving path. Barrage at close range.' },
};

const CLASS_DESCS = {
  none:      { title: 'No Class',   what: 'No class modifier. Full freedom of weapon choice. HP: 100.',                                                                    perk: null,                                                                                                                              how:  'Choose any weapon — pure skill matters.' },
  thor:      { title: 'Thor',       what: 'Hammer master. Slower movement but powerful strikes. Forces Hammer. HP: 115.',                                                   perk: 'Lightning Storm (≤20% HP, once): Summons 3 lightning bolts — 8 dmg + stun each. Activates automatically.',                        how:  'Tank hits to trigger the lightning perk when low. Then finish with your super.' },
  kratos:    { title: 'Kratos',     what: 'Axe specialist. More HP, builds rage when hit. Forces Axe. HP: 125.',                                                            perk: 'Spartan Rage (≤15% HP, once): Auto-heals to 30% HP and boosts damage by +30% for 5 seconds.',                                     how:  'Survive the threat threshold — let the rage save you. Strike hard in the buff window.' },
  ninja:     { title: 'Ninja',      what: 'Extremely fast sword fighter. Fragile but elusive. Forces Sword. HP: 80.',                                                       perk: 'Shadow Step (≤25% HP, once): 2 seconds of full invincibility and all cooldowns reset instantly.',                                  how:  'Use your speed advantage to dodge. The perk buys time to escape and counter.' },
  gunner:    { title: 'Gunner',     what: 'Dual-shot gunslinger — fires 2 bullets every shot. Forces Gun. HP: 95.',                                                         perk: 'Last Stand (≤20% HP, once): Fires 8 bullets in all directions for 3–5 dmg each.',                                                 how:  'Keep distance at all times. The burst perk punishes enemies who close in when you\'re low.' },
  archer:    { title: 'Archer',     what: 'Long-range bow fighter. Fast movement, low HP. Forces Bow. HP: 85.',                                                              perk: 'Back-Step (≤20% HP): Auto-dash backward and reset double jump when threatened.',                                                  how:  'Stay at range. The auto-backstep keeps you alive when pressured.' },
  paladin:   { title: 'Paladin',    what: 'Tanky shield warrior. Slower movement, high HP. Forces Shield. HP: 130.',                                                         perk: 'Holy Light (≤25% HP): AoE healing pulse — heals self 20 HP, deals 15 dmg to nearby enemies.',                                    how:  'Block and bash. The perk punishes opponents who rush you when you\'re low.' },
  berserker: { title: 'Berserker',  what: 'Any-weapon brawler. Strong and sturdy. HP: 120.',                                                                                 perk: 'Blood Frenzy (≤15% HP): 3 seconds of +50% damage and ×1.4 speed.',                                                              how:  'Play aggressively and stack risk — the frenzy perk rewards surviving near death.' },
};
