'use strict';
// smb-data-arenas.js — Arena platform/color definitions + layout randomization
// Depends on: smb-globals.js (GAME_W)
// Must load BEFORE smb-data-mapperks.js, smb-data-mapperks-draw.js, smb-data-weapons.js

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
