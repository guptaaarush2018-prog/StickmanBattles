'use strict';

// ============================================================
// TRUEFORM ENDING CINEMATIC  v2  (meta-breaking sequence)
// ============================================================
// Phase sequence:
//   realization  — boss immune at 10%; "0" damage pops; inner dialogue
//   punch        — boss monologue + devastating hit; hero ragdolls
//   launch       — hero flies across multi-dimension panels
//   coderealm    — abstract void; 5 interactive code nodes to corrupt
//   return       — hero falls back through dimensional tear
//   finisher     — 3-hit Kratos QTE beatdown
//   aura         — black aura absorbed into hero
//   powers       — ability unlock overlay
//   fall         — hero drops through floor
//   fadeout      — black fade → endGame()
// ============================================================

// tfEndingScene is declared in smb-globals.js

// ── Matrix rain ──────────────────────────────────────────────────────────────
const _TFE_CHARS = '01ΨΦΛΣΩαβγδεθλμπφψ∞∑∏∫∂√±÷×≠≈≡∈∉⊂⊃⊆⊇∪∩∀∃∄¬→←↑↓↔⟨⟩⌊⌋⌈⌉'.split('');
let _tfeRainCols = [];
const _TFE_RAIN_COLORS = ['#00ff41','#00cc33','#009922','#88ffaa','#ffffff'];

function _tfeInitRain() {
  _tfeRainCols = [];
  const cols = Math.floor(GAME_W / 12);
  for (let i = 0; i < cols; i++) {
    _tfeRainCols.push({
      x:     i * 12 + 6,
      y:     Math.random() * GAME_H,
      speed: 1.8 + Math.random() * 3.2,
      chars: Array.from({ length: 20 }, () => _TFE_CHARS[Math.floor(Math.random() * _TFE_CHARS.length)]),
      ci:    Math.floor(Math.random() * _TFE_RAIN_COLORS.length),
      trail: 14 + Math.floor(Math.random() * 10),
    });
  }
}

// ── Dimension panels for launch sequence ─────────────────────────────────────
const _TFE_BG_PANELS = [
  { sky: ['#0a0020','#1a0040','#0a0020'], ground: '#1a0033', plat: '#3a0066', label: 'DIMENSION Ψ-7'  },
  { sky: ['#001a10','#003320','#001a10'], ground: '#002a18', plat: '#004430', label: 'DIMENSION Λ-3'  },
  { sky: ['#200000','#400000','#200000'], ground: '#300000', plat: '#600000', label: 'DIMENSION Ω-11' },
  { sky: ['#000820','#001040','#000820'], ground: '#000030', plat: '#000060', label: 'DIMENSION Σ-19' },
  { sky: ['#101010','#202020','#101010'], ground: '#181818', plat: '#303030', label: 'NULL SPACE'      },
  { sky: ['#1a1000','#332000','#1a1000'], ground: '#281800', plat: '#503000', label: 'DIMENSION Φ-2'  },
  { sky: ['#000000','#000000','#000000'], ground: '#0a0a0a', plat: '#1a1a1a', label: 'THE VOID'        },
];

// ── Catmull-Rom spline ────────────────────────────────────────────────────────
function _tfeSpline(pts, t) {
  const n = pts.length - 1;
  const seg = Math.min(Math.floor(t * n), n - 1);
  const lt  = (t * n) - seg;
  const p0  = pts[Math.max(0, seg - 1)];
  const p1  = pts[seg];
  const p2  = pts[Math.min(n, seg + 1)];
  const p3  = pts[Math.min(n, seg + 2)];
  const cr  = (a, b, c, d, s) =>
    0.5 * ((2*b) + (-a+c)*s + (2*a-5*b+4*c-d)*s*s + (-a+3*b-3*c+d)*s*s*s);
  return { x: cr(p0.x,p1.x,p2.x,p3.x,lt), y: cr(p0.y,p1.y,p2.y,p3.y,lt) };
}

// ── Aura particle pool ────────────────────────────────────────────────────────
let _tfeAuraParticles = [];

// ── "Zero pop" damage texts for realization phase ────────────────────────────
// Each: { x, y, vy, alpha, timer }
let _tfeZeroPops = [];

// ── Code nodes for coderealm ──────────────────────────────────────────────────
function _tfeCreateNodes() {
  const positions = [
    { x: GAME_W * 0.15, y: GAME_H * 0.4  },
    { x: GAME_W * 0.35, y: GAME_H * 0.35 },  // was 0.22 — lowered to be reachable with double jump
    { x: GAME_W * 0.5,  y: GAME_H * 0.55 },
    { x: GAME_W * 0.65, y: GAME_H * 0.35 },  // was 0.25 — lowered to be reachable with double jump
    { x: GAME_W * 0.82, y: GAME_H * 0.42 },
  ];
  const labels = ['while(1){}', 'x/0', 'NULL→*', '∞-∞', 'goto VOID'];
  return positions.map((p, i) => ({
    x:         p.x,
    y:         p.y,
    label:     labels[i],
    corrupted: false,
    pulse:     Math.random() * Math.PI * 2,  // phase offset for animation
    hitTimer:  0,
  }));
}

// ── Edge-detect attack key helper ─────────────────────────────────────────────
let _tfeAtkWas = false;
function _tfeAtkJust() {
  const hero = tfEndingScene && tfEndingScene.hero;
  if (!hero) return false;
  const ctrl = hero.controls;
  const now  = ctrl ? keysDown.has(ctrl.attack) : false;
  const just = now && !_tfeAtkWas;
  _tfeAtkWas = now;
  return just;
}

let _tfeFinAtkWas = false;
function _tfeFinAtkJust() {
  const hero = tfEndingScene && tfEndingScene.hero;
  if (!hero) return false;
  const ctrl = hero.controls;
  const now  = ctrl ? keysDown.has(ctrl.attack) : false;
  const just = now && !_tfeFinAtkWas;
  _tfeFinAtkWas = now;
  return just;
}

// ── QTE prompt messages ────────────────────────────────────────────────────────
const _TFE_QTE_PROMPTS = [
  '[ ATTACK — STRIKE BACK ]',
  '[ ATTACK — FINISH IT ]',
  '[ ATTACK — END THIS ]',
];
const _TFE_QTE_FLASH_COLORS = ['#ff4400','#ff0088','#ffffff'];

// ── Main launch spline points ──────────────────────────────────────────────────
// Hero is blasted RIGHT by the boss punch — straight rightward arc
function _tfeLaunchPts(hero, boss) {
  // Direction: boss is usually left of hero, punches right.
  // If boss is to the right, flip direction.
  const dir = (boss && boss.cx() < hero.cx()) ? 1 : -1;
  const sx  = hero.cx();
  const sy  = hero.cy();
  return [
    { x: sx,                          y: sy                       },  // start
    { x: sx + dir * GAME_W * 0.22,   y: sy - 30                  },  // initial blast
    { x: sx + dir * GAME_W * 0.50,   y: sy - 55                  },  // mid-air
    { x: sx + dir * GAME_W * 0.85,   y: sy - 35                  },  // near edge
    { x: sx + dir * GAME_W * 1.20,   y: sy + 30                  },  // exit screen
    { x: sx + dir * GAME_W * 1.70,   y: sy + 120                 },  // far exit
  ];
}

// ── Entry point ───────────────────────────────────────────────────────────────
// isIntro=true: fires as opening sequence; resumes gameplay after code realm instead of endGame
function startTFEnding(boss, isIntro) {
  const hero = players.find(p => !p.isBoss);
  if (!hero) { endGame(); return; }

  boss.invincible = 999999;
  boss.vx = 0; boss.vy = 0;

  _tfeInitRain();
  _tfeAuraParticles = [];
  _tfeZeroPops      = [];
  _tfeAtkWas        = false;
  _tfeFinAtkWas     = false;

  minions = []; projectiles = []; bossBeams = [];
  if (typeof bossSpikes !== 'undefined') bossSpikes = [];
  if (typeof trainingDummies !== 'undefined') trainingDummies = [];

  tfEndingScene = {
    phase:   'realization',
    timer:   0,
    boss,
    hero,

    // realization
    realizationDialogue: [
      '"So you figured it out."',
      '"Nothing you do here matters."',
      '"I\'ve wasted enough time."',
    ],
    dialogueIdx:   0,
    dialogueAlpha: 0,

    // punch
    bossRushed: false,

    // launch
    launchPts:   _tfeLaunchPts(hero, boss),
    launchT:     0,
    heroScreenX: hero.cx(),
    heroScreenY: hero.cy(),
    heroPrevX:   hero.cx(),
    heroPrevY:   hero.cy(),
    heroAlpha:   1,
    bgPanelIdx:  0,
    bgPanelT:    0,      // 0–1 scroll within panel
    tearAlpha:   0,      // reality tear overlay

    // coderealm
    rainAlpha:   0,
    divAlpha:    0,
    divScale:    0,
    codeNodes:   _tfeCreateNodes(),
    crHeroX:     GAME_W / 2,
    crHeroY:     GAME_H * 0.55,
    crHeroVY:       0,
    crOnGround:     false,
    crCanDoubleJump: false,
    nodesCorrupted: 0,
    crFlashTimer:   0,

    // return
    returnY:    -60,
    returnVY:    4,

    // finisher
    finisherHits:    0,
    finisherPrompt:  0,
    finisherFlash:   0,
    finisherBossX:   boss.cx(),
    finisherBossY:   boss.cy(),
    finisherBossVX:  0,
    finisherBossVY:  0,
    finisherBossAlpha: 1,

    // aura
    auraX: boss.cx(),
    auraY: boss.cy(),

    // powers
    powersAlpha: 0,
    powersList: [
      '⬡  DIMENSION SHIFT — 3D VIEW ENABLED',
      '◈  HOME UNIVERSE PATROL MODE UNLOCKED',
      '✦  INTER-WORLD TRAVEL UNLOCKED',
    ],

    // fall
    heroFallAlpha: 1,

    // skip
    skippable: false,
    skipped:   false,
    canReplay:  (localStorage.getItem('smc_tfEndingSeen') === '1'),

    // intro mode: resume gameplay instead of calling endGame
    isIntro: isIntro === true,
  };

  localStorage.setItem('smc_tfEndingSeen', '1');
  hero.backstageHiding = false;
  screenShake = 20;
}

// ── Update ────────────────────────────────────────────────────────────────────
function updateTFEnding() {
  const sc = tfEndingScene;
  if (!sc) return;
  sc.timer++;
  const t = sc.timer;

  // ── REALIZATION ─────────────────────────────────────────────────────────────
  if (sc.phase === 'realization') {
    // Cycle through 3 dialogue lines, each 100 frames
    const lineLen = 100;
    const totalLines = sc.realizationDialogue.length;
    const lineIdx = Math.floor(t / lineLen);
    const lineT   = t % lineLen;
    sc.dialogueIdx   = Math.min(lineIdx, totalLines - 1);
    sc.dialogueAlpha = lineT < 15  ? lineT / 15 :
                       lineT < 70  ? 1 :
                       lineT < 95  ? 1 - (lineT - 70) / 25 : 0;

    // Spawn bouncing "0" damage pops at boss position (simulating attacks doing nothing)
    if (t % 18 === 5 && _tfeZeroPops.length < 12) {
      _tfeZeroPops.push({
        x:     sc.boss.cx() + (Math.random() - 0.5) * 60,
        y:     sc.boss.cy() - 20,
        vy:   -3 - Math.random() * 2,
        alpha: 1,
        timer: 0,
        bounces: 0,
      });
    }
    // Update zero pops
    for (let i = _tfeZeroPops.length - 1; i >= 0; i--) {
      const zp = _tfeZeroPops[i];
      zp.timer++;
      zp.vy += 0.35;
      zp.y  += zp.vy;
      if (zp.y > sc.boss.cy() + 10 && zp.vy > 0 && zp.bounces < 2) {
        zp.y  = sc.boss.cy() + 10;
        zp.vy = -Math.abs(zp.vy) * 0.55;
        zp.bounces++;
      }
      zp.alpha = Math.max(0, 1 - zp.timer / 55);
      if (zp.alpha <= 0) _tfeZeroPops.splice(i, 1);
    }

    if (t >= totalLines * lineLen + 20) {
      _tfeZeroPops = [];
      sc.phase = 'punch';
      sc.timer = 0;
      screenShake = 14;
    }
  }

  // ── PUNCH ───────────────────────────────────────────────────────────────────
  else if (sc.phase === 'punch') {
    const bx = sc.boss.cx(), by = sc.boss.cy();
    const hx = sc.hero.cx(), hy = sc.hero.cy();
    const punchDir = bx < hx ? 1 : -1; // direction hero will be launched

    // Frames 0–8: freeze + dramatic slow-motion buildup (anticipation)
    if (t < 8) {
      slowMotion = Math.max(0.05, 1 - t * 0.12);
    }

    // Frames 0–18: boss rushes toward hero with wind-up energy swirl
    if (t < 18) {
      sc.boss.x += (hx - bx - sc.boss.w / 2) * 0.22;
      sc.boss.y += (hy - by - sc.boss.h / 2) * 0.22;
      // Charge particles spiraling around boss
      if (settings.particles && t % 2 === 0 && particles.length < MAX_PARTICLES) {
        const _p = _getParticle();
        const ang = (t / 18) * Math.PI * 4;
        _p.x = sc.boss.cx() + Math.cos(ang) * 28;
        _p.y = sc.boss.cy() + Math.sin(ang) * 28;
        _p.vx = Math.cos(ang + 1.5) * 3; _p.vy = Math.sin(ang + 1.5) * 3;
        _p.color = Math.random() < 0.5 ? '#8800ff' : '#ffffff';
        _p.size = 2 + Math.random() * 3; _p.life = 14; _p.maxLife = 14;
        particles.push(_p);
      }
    }

    // Frame 18: time snaps back — IMPACT
    if (t === 18) {
      slowMotion = 1.0;
      sc.boss.attackTimer    = 22;
      sc.boss.attackDuration = 22;
      sc.boss.facing         = punchDir;
    }

    // Frame 22: PUNCH LANDS — directional blast
    if (t === 22) {
      screenShake = 75;
      // Shockwave at hero position
      CinFX.shockwave(hx, hy, '#ffffff', { count: 3, maxR: 280, lw: 6, dur: 60 });
      // Directional speed-line burst in punch direction
      CinFX.flash('#ffffff', 0.95, 14);
      spawnParticles(hx, hy, '#ffffff', 55);
      spawnParticles(hx, hy, '#8800ff', 25);
      spawnParticles(hx + punchDir * 30, hy, '#ffffff', 30);
      // Directional speed lines: particles blast in punch direction
      if (settings.particles) {
        for (let i = 0; i < 30 && particles.length < MAX_PARTICLES; i++) {
          const _p = _getParticle();
          _p.x = hx + (Math.random() - 0.5) * 20;
          _p.y = hy + (Math.random() - 0.5) * 20;
          _p.vx = punchDir * (10 + Math.random() * 14);
          _p.vy = (Math.random() - 0.5) * 4;
          _p.color = Math.random() < 0.6 ? '#ffffff' : '#8800ff';
          _p.size  = 1.5 + Math.random() * 4;
          _p.life  = 20 + Math.random() * 15; _p.maxLife = 35;
          particles.push(_p);
        }
      }
      SoundManager.heavyHit && SoundManager.heavyHit();
      // Camera snap to launch direction
      cinematicCamOverride = true;
      cinematicZoomTarget  = 1.6;
      cinematicFocusX      = hx + punchDir * 80;
      cinematicFocusY      = hy - 20;
    }

    if (t >= 32) {
      sc.phase = 'launch';
      sc.timer = 0;
      sc.hero.invincible = 999999;
      sc.hero.backstageHiding = true;
      sc.heroScreenX = sc.hero.cx();
      sc.heroScreenY = sc.hero.cy();
      sc.heroPrevX   = sc.heroScreenX;
      sc.heroPrevY   = sc.heroScreenY;
      sc.bgPanelIdx  = 0;
      sc.bgPanelT    = 0;
      // Rebuild launch spline now that we know boss direction
      sc.launchPts = _tfeLaunchPts(sc.hero, sc.boss);
    }
  }

  // ── LAUNCH ──────────────────────────────────────────────────────────────────
  else if (sc.phase === 'launch') {
    const totalDur = 300;
    sc.launchT = Math.min(1, t / totalDur);
    // Ease-in acceleration
    const eased = sc.launchT * sc.launchT * (3 - 2 * sc.launchT);
    const pos = _tfeSpline(sc.launchPts, eased);
    sc.heroPrevX   = sc.heroScreenX;
    sc.heroPrevY   = sc.heroScreenY;
    sc.heroScreenX = pos.x;
    sc.heroScreenY = pos.y;

    // Cycle dimension panels based on progress
    const panelCount = _TFE_BG_PANELS.length;
    sc.bgPanelIdx = Math.min(panelCount - 1, Math.floor(sc.launchT * panelCount));

    // Reality tear grows as speed increases
    sc.tearAlpha = Math.min(0.65, sc.launchT * 1.1);

    // Panel-transition flash
    const expectedPanel = Math.floor(sc.launchT * panelCount);
    if (expectedPanel > (sc._lastPanel || 0)) {
      sc._lastPanel = expectedPanel;
      CinFX.flash('#ffffff', 0.45, 6);
      screenShake = 18 + expectedPanel * 4;
    }

    // Trail particles
    if (t % 2 === 0) {
      const _p = _getParticle();
      _p.x = pos.x + (Math.random()-0.5)*18; _p.y = pos.y + (Math.random()-0.5)*18;
      _p.vx = (Math.random()-0.5)*3; _p.vy = (Math.random()-0.5)*3;
      _p.color = Math.random() < 0.5 ? '#ffffff' : '#8888ff';
      _p.size = 2 + Math.random()*6; _p.life = 28 + Math.random()*22; _p.maxLife = 50;
      particles.push(_p);
    }

    _tfeCamFocus(pos.x, pos.y, 1.45);

    if (t >= totalDur) {
      sc.phase = 'coderealm';
      sc.timer = 0;
      sc.hero.backstageHiding = true;
      sc.boss.backstageHiding = true;  // hide TF so it doesn't attack in background
      sc.hero.invincible = 999999;  // full immunity for entire coderealm phase
      sc.crHeroX  = GAME_W / 2;
      sc.crHeroY  = GAME_H * 0.52;
      sc.crHeroVY = 0;
      sc.nodesCorrupted = 0;
      _tfeInitRain();
      _tfeCamFocus(GAME_W / 2, GAME_H / 2, 1.0);
      CinFX.flash('#000000', 1.0, 18);
    }
  }

  // ── CODEREALM ───────────────────────────────────────────────────────────────
  else if (sc.phase === 'coderealm') {
    sc.rainAlpha = Math.min(0.92, t / 50);

    // Keep hero fully immune to damage and hazards throughout coderealm
    sc.hero.invincible = 999999;

    // Free-flight physics — no gravity, directional control (jump=up, shield=down)
    const ctrl = sc.hero.controls;
    if (ctrl) {
      const spd = 3.8;
      if (keysDown.has(ctrl.left))  sc.crHeroX -= spd;
      if (keysDown.has(ctrl.right)) sc.crHeroX += spd;
      const fUp   = keysDown.has(ctrl.jump);
      const fDown = keysDown.has(ctrl.shield);
      sc.crHeroVY = fUp ? -6 : (fDown ? 6 : sc.crHeroVY * 0.7);
      sc.crHeroY += sc.crHeroVY;
      sc.crHeroX = Math.max(12, Math.min(GAME_W - 12, sc.crHeroX));
      sc.crHeroY = Math.max(18, Math.min(GAME_H - 18, sc.crHeroY));
    }

    // Update node pulse
    for (const nd of sc.codeNodes) {
      nd.pulse += 0.07;
      if (nd.hitTimer > 0) nd.hitTimer--;
    }

    // Corrupt node on proximity contact — no attack required, generous radius
    for (const nd of sc.codeNodes) {
      if (!nd.corrupted) {
        const dx = nd.x - sc.crHeroX, dy = nd.y - sc.crHeroY;
        if (Math.sqrt(dx*dx+dy*dy) < 80) {
          nd.corrupted = true;
          nd.hitTimer  = 30;
          sc.nodesCorrupted++;
          sc.crFlashTimer = 20;
          screenShake = 22;
          CinFX.flash('#00ff41', 0.55, 10);
          spawnParticles(nd.x, nd.y, '#00ff41', 18);
          spawnParticles(nd.x, nd.y, '#ffffff', 10);
          SoundManager.explosion && SoundManager.explosion();
          break;
        }
      }
    }

    if (sc.crFlashTimer > 0) sc.crFlashTimer--;

    // All nodes corrupted → proceed
    if (sc.nodesCorrupted >= 5 && t > 60) {
      // Transition after a beat
      if (!sc._crDoneTimer) sc._crDoneTimer = 0;
      sc._crDoneTimer++;
      if (sc._crDoneTimer === 1) {
        screenShake = 90;
        CinFX.flash('#00ff41', 0.85, 20);
        spawnParticles(GAME_W/2, GAME_H/2, '#00ff41', 80);
        spawnParticles(GAME_W/2, GAME_H/2, '#000000', 50);
        spawnParticles(GAME_W/2, GAME_H/2, '#ffffff', 40);
      }
      if (sc._crDoneTimer >= 60) {
        sc.phase = 'return';
        sc.timer = 0;
        sc.returnY  = -80;
        sc.returnVY = 3;
        sc.boss.backstageHiding = true;
        // Place hero back in arena visually
        const floor = currentArena && currentArena.platforms.find(pl => pl.isFloor && !pl.isFloorDisabled);
        const floorY = floor ? floor.y : GAME_H - 30;
        sc.hero.x = GAME_W / 2 - sc.hero.w / 2;
        sc.hero.y = floorY - sc.hero.h;
        _tfeCamFocus(GAME_W / 2, GAME_H / 2, 1.1);
        CinFX.flash('#000000', 1.0, 16);
      }
    }

    // Rain animation
    for (const col of _tfeRainCols) {
      col.y += col.speed;
      if (col.y > GAME_H + 50) col.y = -Math.random() * 60;
      if (Math.random() < 0.025) {
        col.chars[Math.floor(Math.random() * col.chars.length)] =
          _TFE_CHARS[Math.floor(Math.random() * _TFE_CHARS.length)];
      }
    }
  }

  // ── RETURN ──────────────────────────────────────────────────────────────────
  else if (sc.phase === 'return') {
    // Hero descends back into arena through a dimensional tear in the sky
    sc.returnY  += sc.returnVY;
    sc.returnVY += 0.4;
    sc.rainAlpha = Math.max(0, sc.rainAlpha - 0.04);

    const floor = currentArena && currentArena.platforms.find(pl => pl.isFloor && !pl.isFloorDisabled);
    const floorY = floor ? floor.y : GAME_H - 30;

    if (sc.returnY >= floorY - sc.hero.h) {
      sc.returnY = floorY - sc.hero.h;
      sc.returnVY = 0;
      screenShake = 28;
      CinFX.flash('#ffffff', 0.55, 8);
      spawnParticles(GAME_W/2, floorY, '#ffffff', 20);
      // Intro mode: skip finisher/aura/powers/fall — go straight to fadeout
      if (sc.isIntro) {
        sc.phase = 'fadeout';
        sc.timer = 0;
        sc.hero.backstageHiding = false;
        sc.hero.x = GAME_W / 2 - sc.hero.w / 2;
        if (typeof showBossDialogue === 'function') showBossDialogue('NOW we begin.', 300);
        return;
      }
      sc.phase = 'finisher';
      sc.timer = 0;
      sc.hero.backstageHiding = false;
      sc.hero.x = GAME_W / 2 - sc.hero.w / 2;
      sc.hero.y = sc.returnY;
      sc.boss.backstageHiding = false;
      // Position boss facing hero
      sc.boss.x = GAME_W / 2 - sc.boss.w / 2 - 120;
      sc.boss.y = floorY - sc.boss.h;
      sc.finisherBossX = sc.boss.cx();
      sc.finisherBossY = sc.boss.cy();
      sc.finisherPrompt = 1;
    }
  }

  // ── FINISHER ─────────────────────────────────────────────────────────────────
  else if (sc.phase === 'finisher') {
    if (sc.finisherFlash > 0) sc.finisherFlash--;

    const neededHits = 3;
    // QTE: player must press attack at the right prompt
    if (sc.finisherHits < neededHits) {
      if (sc.finisherPrompt > 0 && _tfeFinAtkJust()) {
        sc.finisherHits++;
        sc.finisherFlash = 22;
        sc.finisherPrompt = 0;
        screenShake = 38 + sc.finisherHits * 10;
        CinFX.flash(_TFE_QTE_FLASH_COLORS[sc.finisherHits - 1] || '#ffffff', 0.7, 12);
        spawnParticles(sc.boss.cx(), sc.boss.cy(), '#ffffff', 30);
        spawnParticles(sc.boss.cx(), sc.boss.cy(), '#000000', 20);
        SoundManager.heavyHit && SoundManager.heavyHit();
        // Launch boss backward
        const dir = sc.boss.cx() < sc.hero.cx() ? -1 : 1;
        sc.finisherBossVX = dir * (8 + sc.finisherHits * 4);
        sc.finisherBossVY = -12 - sc.finisherHits * 3;
        // Re-prompt after boss lands
        sc._finisherPauseTimer = 0;
      }
    }

    // Animate boss ragdoll
    sc.finisherBossVY += 0.7;
    sc.finisherBossX  += sc.finisherBossVX;
    sc.finisherBossY  += sc.finisherBossVY;
    sc.finisherBossVX *= 0.88;
    const floor = currentArena && currentArena.platforms.find(pl => pl.isFloor && !pl.isFloorDisabled);
    const floorY = floor ? floor.y : GAME_H - 30;
    if (sc.finisherBossY >= floorY - sc.boss.h / 2) {
      sc.finisherBossY  = floorY - sc.boss.h / 2;
      sc.finisherBossVY = -Math.abs(sc.finisherBossVY) * 0.3;
      if (Math.abs(sc.finisherBossVY) < 1) sc.finisherBossVY = 0;
    }

    // Re-show prompt after boss settles and we haven't finished
    if (sc.finisherHits < neededHits && sc.finisherPrompt === 0) {
      if (!sc._finisherPauseTimer) sc._finisherPauseTimer = 0;
      sc._finisherPauseTimer++;
      if (sc._finisherPauseTimer > 30 && Math.abs(sc.finisherBossVY) < 2) {
        sc.finisherPrompt = 1;
        sc._finisherPauseTimer = 0;
      }
    }

    // After all hits and boss has settled
    if (sc.finisherHits >= neededHits) {
      if (!sc._finisherEndTimer) sc._finisherEndTimer = 0;
      sc._finisherEndTimer++;
      if (sc._finisherEndTimer === 40) {
        CinFX.flash('#000000', 0.7, 20);
      }
      if (sc._finisherEndTimer >= 80) {
        sc.phase = 'aura';
        sc.timer = 0;
        sc.auraX  = sc.finisherBossX;
        sc.auraY  = sc.finisherBossY;
        sc.boss.backstageHiding = true;
        _tfeAuraParticles = [];
        _tfeCamFocus(GAME_W/2, GAME_H/2, 1.2);
      }
    }
  }

  // ── AURA ────────────────────────────────────────────────────────────────────
  else if (sc.phase === 'aura') {
    const dur = 120;
    const frac = Math.min(1, t / dur);
    const hx = sc.hero.cx(), hy = sc.hero.cy();
    sc.auraX = sc.auraX + (hx - sc.auraX) * (frac * 0.08 + 0.01);
    sc.auraY = sc.auraY + (hy - sc.auraY) * (frac * 0.08 + 0.01);

    if (t % 2 === 0) {
      for (let i = 0; i < 3; i++) {
        const angle = Math.random() * Math.PI * 2;
        const rad   = 20 + Math.random() * 30;
        _tfeAuraParticles.push({
          x: sc.auraX + Math.cos(angle) * rad,
          y: sc.auraY + Math.sin(angle) * rad,
          vx: (hx - sc.auraX) * 0.04 + (Math.random()-0.5)*2,
          vy: (hy - sc.auraY) * 0.04 + (Math.random()-0.5)*2,
          life: 18 + Math.floor(Math.random()*12),
          maxLife: 30,
          r: 2 + Math.random() * 3,
        });
      }
    }
    for (let i = _tfeAuraParticles.length - 1; i >= 0; i--) {
      const ap = _tfeAuraParticles[i];
      ap.x += ap.vx; ap.y += ap.vy; ap.life--;
      if (ap.life <= 0) _tfeAuraParticles.splice(i, 1);
    }

    if (t === 90) { screenShake = 35; CinFX.flash('#000000', 0.55, 14); }
    if (t >= dur + 20) {
      sc.phase = 'powers';
      sc.timer = 0;
      _tfeAuraParticles = [];
      sc.hero._tfAuraGlow = true;
      localStorage.setItem('smc_patrolMode', '1');
      localStorage.setItem('smc_interTravel', '1');
      if (settings.experimental3D) localStorage.setItem('smc_view3D', '1');
      _tfeCamFocus(sc.hero.cx(), sc.hero.cy(), 1.5);
      sc.skippable = true;
    }
  }

  // ── POWERS ──────────────────────────────────────────────────────────────────
  else if (sc.phase === 'powers') {
    sc.powersAlpha = t < 30 ? t/30 : t < 200 ? 1 : Math.max(0, 1 - (t-200)/40);
    if (t >= 260) {
      sc.phase = 'fall';
      sc.timer = 0;
      sc.skippable = false;
      sc.heroFallAlpha = 1;
      _tfeCamFocus(sc.hero.cx(), sc.hero.cy(), 1.8);
    }
  }

  // ── FALL ────────────────────────────────────────────────────────────────────
  else if (sc.phase === 'fall') {
    sc.hero.vy += 1.2;
    sc.hero.x  += sc.hero.vx;
    sc.hero.y  += sc.hero.vy;
    sc.heroFallAlpha = Math.max(0, 1 - t / 80);
    if (t >= 90) {
      sc.phase = 'fadeout';
      sc.timer = 0;
    }
  }

  // ── FADEOUT ──────────────────────────────────────────────────────────────────
  else if (sc.phase === 'fadeout') {
    sc.heroFallAlpha = 0;
    if (t >= 80) {
      tfEndingScene = null;
      if (typeof cinematicCamOverride !== 'undefined') cinematicCamOverride = false;
      if (sc.isIntro) {
        _tfeResumeAfterIntro(sc);
      } else {
        _tfeUnlockPatrolMode();
        if (typeof activateParadoxCompanion === 'function') activateParadoxCompanion();
        endGame();
      }
    }
  }
}

// ── Resume gameplay after intro dimension-punch cinematic ─────────────────────
// Player returns from Code Realm to see TrueForm apparently dying.
// A shadow clone then executes a command to reset the fight (triggerFalseVictory).
function _tfeResumeAfterIntro(sc) {
  // Advance state machine to backstage — from here normal death/ending logic is allowed
  if (typeof tfCinematicState !== 'undefined') tfCinematicState = 'backstage';

  // Restore boss visually (shadow clone will resurrect it via triggerFalseVictory)
  if (sc.boss) {
    sc.boss.backstageHiding = false;
    sc.boss.vx = 0;
    sc.boss.vy = 0;
  }

  // Restore hero — player keeps the gauntlet (fists) after absorbing Paradox.
  // Paradox's power is expressed through raw combat, not weapons.
  if (sc.hero) {
    sc.hero.backstageHiding = false;
    sc.hero.invincible      = Math.max(sc.hero.invincible, 60);
    // Switch to gauntlet (fists) — the player fights bare-handed from here on.
    if (typeof WEAPONS !== 'undefined' && WEAPONS['gauntlet']) {
      sc.hero.weapon = WEAPONS['gauntlet'];
    }
    sc.hero.vx = 0;
    sc.hero.vy = 0;
  }

  // Shadow clone saves TrueForm: trigger fight reset sequence.
  // triggerFalseVictory shows the clone, resets boss to 10000 HP, and
  // activates Paradox fusion so player keeps Paradox's power for round 2.
  if (typeof triggerFalseVictory === 'function' &&
      typeof tfFalseVictoryFired !== 'undefined' && !tfFalseVictoryFired) {
    if (sc.boss) {
      sc.boss.health     = 51;   // keep alive; false victory will restore to 10000
      sc.boss.invincible = 9999;
    }
    triggerFalseVictory(sc.boss);
  } else {
    // Fallback: resume fight directly if false victory unavailable or already fired
    if (sc.boss) sc.boss.invincible = 90;
    if (typeof tfFinalStateActive !== 'undefined') tfFinalStateActive = true;
    if (typeof tfParadoxFused !== 'undefined') {
      tfParadoxFused      = true;
      tfFusionControlMode = 'player';
      if (typeof controlState !== 'undefined') controlState = 'player';
      if (typeof controlTimer !== 'undefined') controlTimer = 0;
    }
  }

  screenShake = Math.max(screenShake, 35);
  if (typeof CinFX !== 'undefined') CinFX.flash('#ffffff', 0.5, 14);

  // ── Depth Phase transition: trigger the Z-axis final phase ────────────────
  // Freeze player briefly (30 frames = 0.5s), then enable Z-movement.
  // This fires after the fight resets (false victory sequence) — the very last
  // phase of the True Form encounter.
  if (typeof tfDepthPhaseActive !== 'undefined') {
    tfDepthPhaseActive     = true;
    tfDepthTransitionTimer = 30;   // 0.5-second input freeze
    tfDepthEnabled         = false;
    tfDepthPlayerStillZ    = {};
    // Reset all entities' Z to 0 (center layer) at phase start
    if (typeof players !== 'undefined') {
      players.forEach(p => { p.z = 0; });
    }
    // Camera tilt: focus on center-field with a slight zoom-in
    if (typeof setCameraDrama === 'function') setCameraDrama('focus', 90, null, 1.08);
    // Screen distortion burst
    if (typeof cinScreenFlash !== 'undefined')
      cinScreenFlash = { color: '#440088', alpha: 0.4, timer: 16, maxTimer: 16 };
    screenShake = Math.max(screenShake, 20);
    spawnParticles(GAME_W * 0.5, GAME_H * 0.5, '#8844ff', 28);
    spawnParticles(GAME_W * 0.5, GAME_H * 0.5, '#000000', 18);
    if (typeof showBossDialogue === 'function')
      showBossDialogue('You broke my world. I\'ll break yours.', 220);
  }

  gameRunning = true;
  requestAnimationFrame(gameLoop);
}

// ── Unlock post-ending features ───────────────────────────────────────────────
function _tfeUnlockPatrolMode() {
  const pm = document.getElementById('modePatrol');
  if (pm) { pm.style.display = ''; pm.classList.add('tf-unlocked'); }
  const m3d = document.getElementById('mode3D');
  if (m3d) { m3d.style.display = ''; }
}

// ── Skip handler ──────────────────────────────────────────────────────────────
function trySkipTFEnding() {
  const sc = tfEndingScene;
  if (!sc || !sc.skippable) return false;
  sc.phase = 'fadeout';
  sc.timer = 0;
  sc.heroFallAlpha = 1;
  _tfeAuraParticles = [];
  if (typeof cinematicCamOverride !== 'undefined') cinematicCamOverride = false;
  return true;
}

// ── Draw ──────────────────────────────────────────────────────────────────────
function drawTFEnding() {
  const sc = tfEndingScene;
  if (!sc) return;

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const cw = canvas.width, ch = canvas.height;
  const scX = cw / GAME_W, scY = ch / GAME_H;
  const sc_ = Math.min(scX, scY);

  // ── REALIZATION: boss dialogue + zero pops ──────────────────────────────────
  if (sc.phase === 'realization') {
    if (sc.dialogueAlpha > 0 && sc.dialogueIdx < sc.realizationDialogue.length) {
      const line = sc.realizationDialogue[sc.dialogueIdx];
      const bsx  = sc.boss.cx() * scX;
      const bsy  = sc.boss.cy() * scY - 70 * scY;
      ctx.globalAlpha = sc.dialogueAlpha;
      ctx.fillStyle   = 'rgba(0,0,0,0.82)';
      ctx.strokeStyle = '#8800ff';
      ctx.lineWidth   = 2;
      const bw = 280 * sc_, bh = 44 * sc_;
      _roundRect(ctx, bsx - bw/2, bsy - bh/2, bw, bh, 10 * sc_);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle  = '#ffffff';
      ctx.font       = `bold ${Math.round(13 * sc_)}px sans-serif`;
      ctx.textAlign  = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(line, bsx, bsy);
      ctx.textBaseline = 'alphabetic';
    }

    // Zero pops
    for (const zp of _tfeZeroPops) {
      ctx.globalAlpha = zp.alpha;
      ctx.font        = `bold ${Math.round(18 * sc_)}px monospace`;
      ctx.textAlign   = 'center';
      ctx.fillStyle   = '#ff4444';
      ctx.shadowColor = '#ff0000';
      ctx.shadowBlur  = 10;
      ctx.fillText('0', zp.x * scX, zp.y * scY);
      ctx.shadowBlur  = 0;
    }
  }

  // ── LAUNCH: dimension panels + flying hero ───────────────────────────────────
  if (sc.phase === 'launch') {
    const panel = _TFE_BG_PANELS[sc.bgPanelIdx] || _TFE_BG_PANELS[0];

    // Background gradient overlay (dimensions)
    const sky = panel.sky;
    const grd = ctx.createLinearGradient(0, 0, 0, ch);
    grd.addColorStop(0,   sky[0]);
    grd.addColorStop(0.5, sky[1]);
    grd.addColorStop(1,   sky[2]);
    ctx.globalAlpha = 0.72;
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, cw, ch);

    // Dimension label
    ctx.globalAlpha = 0.75 * sc.tearAlpha;
    ctx.font = `bold ${Math.round(11 * sc_)}px monospace`;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(panel.label, 20 * scX, 22 * scY);

    // Reality tear streaks
    if (sc.tearAlpha > 0) {
      ctx.globalAlpha = sc.tearAlpha * 0.5;
      ctx.strokeStyle = '#ffffff';
      for (let i = 0; i < 6; i++) {
        const lx = (Math.sin(sc.timer * 0.04 + i * 1.1) * 0.4 + 0.5) * cw;
        const speed = 12 + i * 8;
        const ly = ((sc.timer * speed + i * 200) % (ch * 1.5)) - ch * 0.25;
        ctx.lineWidth = (0.5 + i * 0.4) * sc_;
        ctx.beginPath();
        ctx.moveTo(lx, ly);
        ctx.lineTo(lx + (Math.random()-0.5)*30*scX, ly + 60*scY);
        ctx.stroke();
      }
    }

    // Flying hero stickman
    const hsx = sc.heroScreenX * scX, hsy = sc.heroScreenY * scY;
    const angle = Math.atan2(
      sc.heroScreenY - sc.heroPrevY,
      sc.heroScreenX - sc.heroPrevX
    ) + Math.PI / 2;
    ctx.save();
    ctx.globalAlpha = sc.heroAlpha;
    ctx.translate(hsx, hsy);
    ctx.rotate(angle);
    const s = 18 * sc_;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.5 * sc_;
    ctx.beginPath(); ctx.moveTo(0, -s*1.6); ctx.lineTo(0, s*0.2); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, -s*2, s*0.5, 0, Math.PI*2);
    ctx.fillStyle = sc.hero.color || '#3399ff'; ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-s*0.9, -s*0.8); ctx.lineTo(s*0.9, -s*0.8); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, s*0.2); ctx.lineTo(-s*0.7, s*1.4);
    ctx.moveTo(0, s*0.2); ctx.lineTo(s*0.7, s*1.4);
    ctx.stroke();
    ctx.restore();
  }

  // ── CODEREALM: matrix rain + hero stickman + code nodes ────────────────────
  if (sc.phase === 'coderealm' || (sc.phase === 'return' && sc.rainAlpha > 0)) {
    // Black void
    ctx.globalAlpha = Math.min(sc.rainAlpha, 0.92);
    ctx.fillStyle   = 'rgba(0,0,0,0.88)';
    ctx.fillRect(0, 0, cw, ch);

    // Rain columns
    ctx.globalAlpha = sc.rainAlpha;
    ctx.font = `${Math.round(12 * sc_)}px monospace`;
    ctx.textAlign = 'left';
    for (const col of _tfeRainCols) {
      for (let j = 0; j < col.trail; j++) {
        const alpha = j === 0 ? 1.0 : (col.trail - j) / col.trail * 0.75;
        ctx.globalAlpha = sc.rainAlpha * alpha;
        ctx.fillStyle   = j === 0 ? '#ffffff' : _TFE_RAIN_COLORS[col.ci];
        ctx.fillText(col.chars[j % col.chars.length], col.x * scX, (col.y - j*14) * scY);
      }
    }

    if (sc.phase === 'coderealm') {
      // Code nodes
      for (const nd of sc.codeNodes) {
        const nx = nd.x * scX, ny = nd.y * scY;
        const pulse = 1 + Math.sin(nd.pulse) * 0.15;
        const r     = 22 * sc_ * pulse;
        ctx.globalAlpha = nd.corrupted ? 0.35 : 0.85;

        // Outer ring
        ctx.beginPath();
        ctx.arc(nx, ny, r * 1.5, 0, Math.PI*2);
        ctx.strokeStyle = nd.corrupted ? '#224422' : (nd.hitTimer > 0 ? '#ffffff' : '#00ff41');
        ctx.lineWidth   = 2 * sc_;
        ctx.stroke();

        // Fill
        ctx.beginPath();
        ctx.arc(nx, ny, r, 0, Math.PI*2);
        ctx.fillStyle = nd.corrupted ? 'rgba(0,40,0,0.5)' : 'rgba(0,255,65,0.12)';
        ctx.fill();
        ctx.strokeStyle = nd.corrupted ? '#006600' : '#00ff41';
        ctx.lineWidth = 1.5 * sc_;
        ctx.stroke();

        // Label
        ctx.font      = `bold ${Math.round(10 * sc_)}px monospace`;
        ctx.textAlign = 'center';
        ctx.fillStyle = nd.corrupted ? '#224422' : '#00ff41';
        ctx.shadowColor = nd.corrupted ? 'transparent' : '#00ff41';
        ctx.shadowBlur  = nd.corrupted ? 0 : 8;
        ctx.fillText(nd.label, nx, ny + 4 * sc_);
        ctx.shadowBlur  = 0;

        // Corrupted X
        if (nd.corrupted) {
          ctx.globalAlpha = 0.7;
          ctx.font      = `bold ${Math.round(22 * sc_)}px monospace`;
          ctx.fillStyle = '#ff0000';
          ctx.fillText('✕', nx, ny + 8 * sc_);
        }

        // Proximity ring for hero
        const dx = nd.x - sc.crHeroX, dy = nd.y - sc.crHeroY;
        const dist = Math.sqrt(dx*dx+dy*dy);
        if (!nd.corrupted && dist < 80) {
          ctx.globalAlpha = (1 - dist/80) * 0.55;
          ctx.beginPath();
          ctx.arc(nx, ny, r * 2.2 * (1 + (1-dist/80)*0.3), 0, Math.PI*2);
          ctx.strokeStyle = '#00ffcc';
          ctx.lineWidth   = 2 * sc_;
          ctx.stroke();
        }
      }

      // Node counter
      ctx.globalAlpha = 0.75;
      ctx.font      = `${Math.round(10 * sc_)}px monospace`;
      ctx.textAlign = 'left';
      ctx.fillStyle = '#00ff41';
      ctx.fillText(`NODES CORRUPTED: ${sc.nodesCorrupted}/5`, 14 * scX, 18 * scY);

      // Instruction
      if (sc.nodesCorrupted < 5) {
        ctx.globalAlpha = 0.6 + Math.sin(sc.timer * 0.12) * 0.3;
        ctx.font      = `${Math.round(9 * sc_)}px monospace`;
        ctx.textAlign = 'center';
        ctx.fillStyle = '#88ffaa';
        ctx.fillText('[ approach node + ATTACK to corrupt ]', cw/2, ch - 16*scY);
      } else {
        ctx.globalAlpha = 0.9;
        ctx.font      = `bold ${Math.round(14 * sc_)}px monospace`;
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = '#00ff41'; ctx.shadowBlur = 18;
        ctx.fillText('SYSTEM COLLAPSE INITIATED', cw/2, ch*0.5 - 20*scY);
        ctx.shadowBlur = 0;
      }

      // Hero stickman in coderealm
      const hsx = sc.crHeroX * scX, hsy = sc.crHeroY * scY;
      ctx.globalAlpha = 1.0;
      const s = 16 * sc_;
      ctx.strokeStyle = sc.hero.color || '#3399ff';
      ctx.lineWidth   = 2.5 * sc_;
      ctx.shadowColor = sc.hero.color || '#3399ff'; ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.moveTo(hsx, hsy - s*1.4); ctx.lineTo(hsx, hsy + s*0.3); ctx.stroke();
      ctx.beginPath(); ctx.arc(hsx, hsy - s*1.9, s*0.45, 0, Math.PI*2);
      ctx.fillStyle = sc.hero.color || '#3399ff'; ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(hsx - s*0.8, hsy - s*0.5); ctx.lineTo(hsx + s*0.8, hsy - s*0.5); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(hsx, hsy + s*0.3); ctx.lineTo(hsx - s*0.6, hsy + s*1.4);
      ctx.moveTo(hsx, hsy + s*0.3); ctx.lineTo(hsx + s*0.6, hsy + s*1.4);
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Flash on node corruption
      if (sc.crFlashTimer > 0) {
        ctx.globalAlpha = (sc.crFlashTimer / 20) * 0.38;
        ctx.fillStyle = '#00ff41';
        ctx.fillRect(0, 0, cw, ch);
      }
    }
  }

  // ── RETURN: dimensional tear entry ─────────────────────────────────────────
  if (sc.phase === 'return') {
    const hsx = GAME_W/2 * scX, hsy = sc.returnY * scY;
    // Tear effect at top
    ctx.globalAlpha = 0.7;
    const grd = ctx.createRadialGradient(hsx, 0, 0, hsx, 0, 80*scY);
    grd.addColorStop(0, 'rgba(100,0,200,0.8)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grd; ctx.fillRect(0, 0, cw, 120*scY);

    // Falling hero
    ctx.globalAlpha = 1;
    const s = 16 * sc_;
    ctx.strokeStyle = sc.hero.color || '#3399ff';
    ctx.lineWidth   = 2.5 * sc_;
    ctx.beginPath(); ctx.moveTo(hsx, hsy - s*1.4); ctx.lineTo(hsx, hsy + s*0.3); ctx.stroke();
    ctx.beginPath(); ctx.arc(hsx, hsy - s*1.9, s*0.45, 0, Math.PI*2);
    ctx.fillStyle = sc.hero.color || '#3399ff'; ctx.fill(); ctx.stroke();
    // Arms raised (falling pose)
    ctx.beginPath(); ctx.moveTo(hsx - s*1.0, hsy - s*1.0); ctx.lineTo(hsx + s*1.0, hsy - s*1.0); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(hsx, hsy + s*0.3); ctx.lineTo(hsx - s*0.6, hsy + s*1.4);
    ctx.moveTo(hsx, hsy + s*0.3); ctx.lineTo(hsx + s*0.6, hsy + s*1.4);
    ctx.stroke();
  }

  // ── FINISHER QTE ─────────────────────────────────────────────────────────────
  if (sc.phase === 'finisher') {
    const neededHits = 3;

    // Boss ragdoll draw (manual, detached from normal draw)
    if (sc.finisherBossAlpha > 0) {
      const bsx = sc.finisherBossX * scX, bsy = sc.finisherBossY * scY;
      const bs = 20 * sc_;
      const tilt = Math.sin(sc.timer * 0.25) * 0.4;
      ctx.save();
      ctx.translate(bsx, bsy);
      ctx.rotate(tilt);
      ctx.globalAlpha = sc.finisherBossAlpha * 0.9;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth   = 2.5 * sc_;
      ctx.fillStyle   = '#000000';
      ctx.beginPath(); ctx.moveTo(0, -bs*1.4); ctx.lineTo(0, bs*0.3); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, -bs*1.9, bs*0.45, 0, Math.PI*2); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-bs*0.8, -bs*0.5); ctx.lineTo(bs*0.8, -bs*0.5); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, bs*0.3); ctx.lineTo(-bs*0.6, bs*1.4);
      ctx.moveTo(0, bs*0.3); ctx.lineTo(bs*0.6, bs*1.4);
      ctx.stroke();
      ctx.restore();
    }

    // QTE prompt
    if (sc.finisherPrompt > 0 && sc.finisherHits < neededHits) {
      const promptIdx = sc.finisherHits;
      const pulse = 0.75 + Math.sin(sc.timer * 0.22) * 0.25;
      ctx.globalAlpha = pulse;
      ctx.font      = `bold ${Math.round(18 * sc_)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillStyle = _TFE_QTE_FLASH_COLORS[promptIdx] || '#ffffff';
      ctx.shadowColor = _TFE_QTE_FLASH_COLORS[promptIdx] || '#ffffff';
      ctx.shadowBlur  = 20;
      ctx.fillText(_TFE_QTE_PROMPTS[promptIdx] || '[ ATTACK ]', cw/2, ch * 0.84);
      ctx.shadowBlur  = 0;

      // Hit counter dots
      for (let i = 0; i < neededHits; i++) {
        const filled = i < sc.finisherHits;
        const dotX = cw/2 + (i - 1) * 28 * sc_;
        const dotY = ch * 0.91;
        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        ctx.arc(dotX, dotY, 8 * sc_, 0, Math.PI*2);
        ctx.fillStyle = filled ? '#ffffff' : 'rgba(255,255,255,0.25)';
        ctx.fill();
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5 * sc_;
        ctx.stroke();
      }
    }

    // Hit flash
    if (sc.finisherFlash > 0) {
      ctx.globalAlpha = (sc.finisherFlash / 22) * 0.45;
      ctx.fillStyle   = '#ffffff';
      ctx.fillRect(0, 0, cw, ch);
    }
  }

  // ── AURA orb + particles ─────────────────────────────────────────────────────
  if (sc.phase === 'aura') {
    const ax = sc.auraX * scX, ay = sc.auraY * scY;
    const r  = 28 * sc_;
    const pulse = 1 + Math.sin(sc.timer * 0.18) * 0.1;
    ctx.globalAlpha = 0.9;
    const grd = ctx.createRadialGradient(ax, ay, 0, ax, ay, r * 2.5 * pulse);
    grd.addColorStop(0,   'rgba(0,0,0,0.85)');
    grd.addColorStop(0.55,'rgba(20,20,40,0.6)');
    grd.addColorStop(1,   'rgba(0,0,0,0)');
    ctx.fillStyle = grd;
    ctx.beginPath(); ctx.arc(ax, ay, r * 2.5 * pulse, 0, Math.PI*2); ctx.fill();

    ctx.globalAlpha = 0.95;
    ctx.fillStyle   = '#080808';
    ctx.shadowColor = '#6600ff'; ctx.shadowBlur = 22;
    ctx.beginPath(); ctx.arc(ax, ay, r * pulse, 0, Math.PI*2); ctx.fill();
    ctx.shadowBlur = 0;

    for (const ap of _tfeAuraParticles) {
      ctx.globalAlpha = (ap.life / ap.maxLife) * 0.85;
      ctx.fillStyle   = Math.random() < 0.3 ? '#6600ff' : '#000000';
      ctx.beginPath(); ctx.arc(ap.x * scX, ap.y * scY, ap.r * sc_, 0, Math.PI*2); ctx.fill();
    }
  }

  // ── Hero aura glow (powers + fall) ────────────────────────────────────────────
  if (sc.hero._tfAuraGlow && (sc.phase === 'powers' || sc.phase === 'fall')) {
    const hsx = sc.hero.cx() * scX, hsy = sc.hero.cy() * scY;
    const glowR = 55 * sc_ * (1 + Math.sin(sc.timer * 0.12) * 0.15);
    ctx.globalAlpha = 0.55;
    const hgrd = ctx.createRadialGradient(hsx, hsy, 0, hsx, hsy, glowR);
    hgrd.addColorStop(0,   'rgba(80,0,180,0.55)');
    hgrd.addColorStop(0.6, 'rgba(20,0,60,0.25)');
    hgrd.addColorStop(1,   'rgba(0,0,0,0)');
    ctx.fillStyle = hgrd;
    ctx.beginPath(); ctx.arc(hsx, hsy, glowR, 0, Math.PI*2); ctx.fill();
  }

  // ── POWERS panel ─────────────────────────────────────────────────────────────
  if (sc.phase === 'powers' && sc.powersAlpha > 0) {
    ctx.globalAlpha = sc.powersAlpha;
    ctx.fillStyle   = 'rgba(0,0,10,0.78)';
    ctx.fillRect(0, 0, cw, ch);

    const baseY = ch * 0.32;
    const lineH = ch * 0.075;

    ctx.font      = `bold ${Math.round(ch * 0.044)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#8800ff'; ctx.shadowBlur = 26;
    ctx.fillText('POWERS GRANTED', cw/2, baseY);
    ctx.shadowBlur = 0;

    ctx.font      = `${Math.round(ch * 0.025)}px sans-serif`;
    ctx.fillStyle = 'rgba(180,140,255,0.9)';
    ctx.fillText('You have absorbed the void.', cw/2, baseY + lineH * 0.85);

    ctx.font = `bold ${Math.round(ch * 0.028)}px monospace`;
    for (let i = 0; i < sc.powersList.length; i++) {
      const alpha = Math.min(1, Math.max(0, (sc.timer - 30 - i*22)/28));
      ctx.globalAlpha = sc.powersAlpha * alpha;
      ctx.fillStyle   = '#00ffcc';
      ctx.shadowColor = '#00ffcc'; ctx.shadowBlur = 14;
      ctx.fillText(sc.powersList[i], cw/2, baseY + lineH * (2 + i));
      ctx.shadowBlur  = 0;
    }
    ctx.globalAlpha = sc.powersAlpha;

    if (sc.skippable) {
      ctx.font      = `${Math.round(ch * 0.018)}px sans-serif`;
      ctx.fillStyle = 'rgba(150,150,150,0.6)';
      ctx.fillText('[ Press any key to skip ]', cw/2, ch * 0.90);
    }
  }

  // ── FALL alpha ─────────────────────────────────────────────────────────────────
  if (sc.phase === 'fall') {
    ctx.globalAlpha = 1 - sc.heroFallAlpha;
    ctx.fillStyle   = '#000000';
    ctx.fillRect(0, 0, cw, ch);
  }

  // ── FADEOUT ───────────────────────────────────────────────────────────────────
  if (sc.phase === 'fadeout') {
    const frac = Math.min(1, sc.timer / 70);
    ctx.globalAlpha = frac;
    ctx.fillStyle   = '#000000';
    ctx.fillRect(0, 0, cw, ch);
  }

  ctx.globalAlpha  = 1;
  ctx.textBaseline = 'alphabetic';
  ctx.restore();
}

// ── Utilities ─────────────────────────────────────────────────────────────────
function _roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y,     x + w, y + r,     r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x,     y + h, x,     y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x,     y,     x + r, y,         r);
  ctx.closePath();
}

function _tfeCamFocus(x, y, zoom) {
  if (typeof cinematicCamOverride !== 'undefined') {
    cinematicCamOverride = true;
    cinematicFocusX      = x;
    cinematicFocusY      = y;
    cinematicZoomTarget  = zoom;
  }
}
