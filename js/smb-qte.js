// smc-qte.js — True-Form Boss QTE System
// ============================================================
// Phases fire at HP thresholds during gameMode === 'trueform':
//   Phase 1 "Reality Flicker"       — 75% HP (3750)
//   Phase 2 "Multiversal Overload"  — 50% HP (2500)
//   Phase 3 "Cosmic Erasure"        — 25% HP (1250)
//   Phase 4 "True-Form Collapse"    — 10% HP  (500)
//
// Call updateQTE() each frame in gameLoop (physics phase).
// Call drawQTE(ctx, cw, ch) in screen-space after all other draws.
// Call resetQTEState() on backToMenu / new game start.
// ============================================================
'use strict';

// ── Debug toggle ────────────────────────────────────────────────────────────
const QTE_DEBUG = false;          // set true to force-trigger phases via cheat
const QTE_SKIP_ALLOWED = false;   // set true so pressing Escape skips active QTE

// ── P1 control mapping (mirrors Fighter constructor in smc-menu.js) ──────────
// Key string → display glyph shown on screen
const _QTE_KEY_MAP = {
  'a': { label: '←',      key: 'a' },
  'd': { label: '→',      key: 'd' },
  'w': { label: '↑',      key: 'w' },
  's': { label: '↓',      key: 's' },
  ' ': { label: 'ATK',    key: ' ' },
  'q': { label: 'ABILITY',key: 'q' },
  'e': { label: 'SUPER',  key: 'e' },
};

// Mirrored: left↔right, up↔down — used in Phase 2 / Phase 4
const _QTE_MIRROR = { 'a': 'd', 'd': 'a', 'w': 's', 's': 'w', ' ': 'q', 'q': ' ', 'e': 'e' };

// All keys as an array for random picking
const _QTE_ALL_KEYS = Object.keys(_QTE_KEY_MAP);

// ── Phase definitions ────────────────────────────────────────────────────────
const QTE_PHASES = {
  // ---------- Phase 1: Reality Flicker ----------
  // Single prompts one at a time, 60-frame window each.
  // Visual: mild screen flicker, scanlines, background tremor.
  1: {
    id: 1,
    name: 'REALITY FLICKER',
    subtitle: 'The timeline is fracturing.',
    promptCount: [4, 5],     // [min, max] prompts
    windowFrames: 60,        // frames per prompt
    mirrored: false,
    simultaneous: false,     // prompts appear one at a time
    failDamage: 0.06,        // fraction of player maxHealth per failed round
    successBonus: 180,       // bonus damage dealt to boss on full success
    bgIntensity: 0.25,
    hpThreshold: 0.75,       // triggers when boss drops below this fraction
    maxAttempts: 4,          // after this many full failures, end QTE with heavy damage
    penaltyDamage: 0.35,     // fraction of maxHealth dealt when attempt limit reached
  },

  // ---------- Phase 2: Multiversal Overload ----------
  // Three prompts appear at once (mirror clone positions); some are mirrored.
  // Player must press all within 45 frames of each appearing.
  2: {
    id: 2,
    name: 'MULTIVERSAL OVERLOAD',
    subtitle: 'Which version of you is real?',
    promptCount: [5, 7],
    windowFrames: 45,
    mirrored: true,          // some prompts show wrong label (mirrored input)
    mirrorChance: 0.40,      // 40% of prompts are mirrored
    simultaneous: true,      // 3 prompts at once
    simultaneousCount: 3,
    failDamage: 0.10,
    successBonus: 280,
    bgIntensity: 0.55,
    hpThreshold: 0.50,
    maxAttempts: 3,
    penaltyDamage: 0.40,
  },

  // ---------- Phase 3: Cosmic Erasure ----------
  // 6–8 rapid prompts at random screen positions, 30-frame window each.
  // Failure → near-death flash + heavy damage.
  3: {
    id: 3,
    name: 'COSMIC ERASURE',
    subtitle: 'You are being unmade.',
    promptCount: [6, 8],
    windowFrames: 30,
    mirrored: true,
    mirrorChance: 0.50,
    simultaneous: false,
    failDamage: 0.20,        // very high — near death
    successBonus: 450,
    bgIntensity: 0.85,
    hpThreshold: 0.25,
    maxAttempts: 2,
    penaltyDamage: 0.55,     // devastating — near-kill
  },

  // ---------- Phase 4: True-Form Collapse ----------
  // 9-step directional+button sequence; every other step is fully mirrored.
  // "Plot armor": after 2 full failures the final step auto-completes.
  // Success triggers the boss death cinematic.
  4: {
    id: 4,
    name: 'TRUE-FORM COLLAPSE',
    subtitle: 'Rebuild the multiverse — or perish with it.',
    promptCount: [9, 9],
    windowFrames: 28,
    mirrored: true,
    mirrorChance: 0.55,
    simultaneous: false,
    failDamage: 0.12,
    successBonus: 9999,      // kills the boss on success
    bgIntensity: 1.0,
    hpThreshold: 0.10,
    plotArmor: 2,            // auto-complete last step after this many failures
    maxAttempts: 3,
    penaltyDamage: 0.60,     // 60% HP — life-threatening
  },
};

function _qteClamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function _qteAnchorPoint(s) {
  const cw = canvas.width;
  const ch = canvas.height;
  const p  = s && s.playerRef;
  let x = cw * 0.5;
  let y = ch * 0.46;

  if (p) {
    const gScX = cw / Math.max(1, GAME_W);
    const gScY = ch / Math.max(1, GAME_H);
    const px = (p.x + p.w * 0.5) * gScX;
    const py = (p.y + p.h * 0.40) * gScY;
    x = cw * 0.5 + (px - cw * 0.5) * 0.30;
    y = ch * 0.46 + (py - ch * 0.46) * 0.18;
  }

  return {
    x: _qteClamp(x, 150, cw - 150),
    y: _qteClamp(y, 120, ch - 170),
  };
}

function _qteReachProfile(s) {
  const phase = s && s.def ? s.def.id : 1;
  if (phase === 4) return { radius: 145, top: 110, bottomPad: 165, margin: 92 };
  if (phase === 3) return { radius: 175, top: 96, bottomPad: 150, margin: 88 };
  if (phase === 2) return { radius: 150, top: 110, bottomPad: 165, margin: 95 };
  return { radius: 125, top: 120, bottomPad: 175, margin: 100 };
}

function _qtePromptReachable(prompt, s) {
  const cw = canvas.width;
  const ch = canvas.height;
  const anchor = _qteAnchorPoint(s);
  const reach  = _qteReachProfile(s);
  const dx = prompt.x - anchor.x;
  const dy = prompt.y - anchor.y;
  return (
    prompt.x >= reach.margin &&
    prompt.x <= cw - reach.margin &&
    prompt.y >= reach.top &&
    prompt.y <= ch - reach.bottomPad &&
    Math.hypot(dx, dy) <= reach.radius
  );
}

function _qteEnsureReachable(prompt, slot, total, s) {
  const cw = canvas.width;
  const ch = canvas.height;
  const anchor = _qteAnchorPoint(s);
  const reach  = _qteReachProfile(s);

  prompt.x = _qteClamp(prompt.x, reach.margin, cw - reach.margin);
  prompt.y = _qteClamp(prompt.y, reach.top, ch - reach.bottomPad);

  let dx = prompt.x - anchor.x;
  let dy = prompt.y - anchor.y;
  const dist = Math.hypot(dx, dy);
  if (dist > reach.radius) {
    const pull = reach.radius / Math.max(1, dist);
    prompt.x = anchor.x + dx * pull;
    prompt.y = anchor.y + dy * pull;
  }

  const minGap = total > 1 ? 84 : 0;
  if (minGap > 0 && s && Array.isArray(s.prompts)) {
    for (const other of s.prompts) {
      if (!other || other === prompt) continue;
      const odx = prompt.x - other.x;
      const ody = prompt.y - other.y;
      const od  = Math.hypot(odx, ody);
      if (od > 0 && od < minGap) {
        const push = (minGap - od) / od;
        prompt.x += odx * push * 0.5;
        prompt.y += ody * push * 0.5;
      }
    }
    prompt.x = _qteClamp(prompt.x, reach.margin, cw - reach.margin);
    prompt.y = _qteClamp(prompt.y, reach.top, ch - reach.bottomPad);
  }

  prompt._slot = slot;
  prompt._total = total;
}

// ── QTE State Object ─────────────────────────────────────────────────────────
let QTE_STATE = null; // null when no QTE active

/**
 * qteState shape:
 * {
 *   phase: 1|2|3|4,
 *   def: <phase definition>,
 *   stage: 'intro'|'prompts'|'outro_success'|'outro_fail',
 *   introTimer: 0,        // counts up to 80 before prompts begin
 *   outroTimer: 0,
 *   prompts: [],          // active prompt objects
 *   promptQueue: [],      // upcoming prompt keys
 *   promptIdx: 0,         // index into queue
 *   completedCount: 0,
 *   failCount: 0,         // failures this attempt
 *   totalAttempts: 0,     // how many full restarts
 *   failedThisRound: false,
 *   chaosLevel: 0,        // 0-1, rises with each failure
 *   bossRef: <TrueForm>,
 *   playerRef: <Fighter>,
 *   _firedPhases: Set,    // which phase ids have already fired
 * }
 */

// Persistent across phases in one fight
const _qteFiredPhases = new Set();

// ── Prompt object ─────────────────────────────────────────────────────────────
// {
//   key: 'a',          actual key player must press
//   displayKey: 'a',   key shown in the prompt UI (may differ if mirrored)
//   label: '←',        display glyph
//   displayLabel: '→', shown label (mirrored)
//   isMirrored: bool,
//   timer: 0,          counts up; expires at windowFrames
//   maxTimer: 60,
//   x: 450, y: 260,   screen position of this prompt bubble
//   hit: false,        true once player pressed the correct key
//   missed: bool,
//   slot: 0,           for simultaneous mode: which of the 3 slots
// }

// ── Particle / visual accumulators ──────────────────────────────────────────
let _qteParticles    = [];  // { x, y, vx, vy, r, color, alpha, decay, type }
let _qteRipples      = [];  // { x, y, r, maxR, alpha, color }
let _qteFlashAlpha   = 0;   // 0-1 white/colour flash overlay
let _qteFlashColor   = '#ffffff';
let _qteShakeExtra   = 0;   // bonus screen shake during QTE
let _qteScanAlpha    = 0;   // scanline overlay intensity
let _qteVoidAlpha    = 0;   // dark vignette
let _qteFractalSeed  = Math.random() * 1000; // stable noise seed per QTE
let _qteCloneAlpha   = 0;   // mirror clone silhouette alpha
let _qteWarpGrid     = [];  // { x, y, ox, oy } warp grid nodes
let _qteTimeline     = 0;   // global frame counter within QTE
let _qteComboText    = null; // { text, timer, x, y, color }

// ── Pre-QTE pending state ────────────────────────────────────────────────────
// When a threshold is crossed, we enter a short warning window before firing.
// _qtePending = { phaseId, tf, p1, timer, totalDelay }
let _qtePending = null;

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Call every frame from smc-loop.js gameLoop, BEFORE drawing.
 * Returns true when a QTE is active (use to suppress normal game input).
 */
function updateQTE() {
  if (!QTE_STATE) {
    _checkQTETriggers();
    return false;
  }
  _qteTimeline++;
  _tickQTEParticles();
  _tickQTERipples();
  _tickQTEVisuals();

  switch (QTE_STATE.stage) {
    case 'intro':   _tickQTEIntro();   break;
    case 'prompts': _tickQTEPrompts(); break;
    case 'outro_success': _tickQTEOutroSuccess(); break;
    case 'outro_fail':    _tickQTEOutroFail();    break;
  }
  return true;
}

/**
 * Call in screen-space (after ctx.setTransform(1,0,0,1,0,0)) from drawLoop.
 */
function drawQTE(ctx, cw, ch) {
  // Draw pre-QTE warning pulse even when QTE hasn't started yet
  if (!QTE_STATE && _qtePending) {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const progress = _qtePending.timer / _qtePending.totalDelay; // 0 → 1
    const pulse = Math.sin(progress * Math.PI * 4) * 0.5 + 0.5; // oscillates
    const color = _phaseColor(_qtePending.phaseId);
    // Vignette-style border flash
    // Parse hex color to rgba
    const r = parseInt(color.slice(1,3),16), g = parseInt(color.slice(3,5),16), b = parseInt(color.slice(5,7),16);
    const a = (0.25 + pulse * 0.25).toFixed(2);
    const gradient = ctx.createRadialGradient(cw * 0.5, ch * 0.5, ch * 0.3, cw * 0.5, ch * 0.5, Math.max(cw, ch) * 0.7);
    gradient.addColorStop(0, 'rgba(0,0,0,0)');
    gradient.addColorStop(1, `rgba(${r},${g},${b},${a})`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, cw, ch);
    // Warning text
    if (progress > 0.3) {
      ctx.globalAlpha = Math.min(1, (progress - 0.3) / 0.3) * (0.7 + pulse * 0.3);
      ctx.font = 'bold 18px monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = color;
      ctx.shadowBlur = 12;
      ctx.fillText('⚠ REALITY FRACTURING', cw * 0.5, ch * 0.12);
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    }
    ctx.restore();
    return;
  }

  if (!QTE_STATE) return;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  // Layer 1: cosmic background distortion
  _drawQTEBackground(ctx, cw, ch);

  // Layer 2: warp grid
  _drawQTEWarpGrid(ctx, cw, ch);

  // Layer 3: mirror clone silhouettes
  if (_qteCloneAlpha > 0) _drawQTEClones(ctx, cw, ch);

  // Layer 4: ripple effects
  _drawQTERipples(ctx);

  // Layer 5: prompt bubbles
  if (QTE_STATE.stage === 'prompts') _drawQTEPrompts(ctx, cw, ch);

  // Layer 6: particles
  _drawQTEParticles(ctx);

  // Layer 7: combo text
  if (_qteComboText) _drawQTEComboText(ctx, cw, ch);

  // Layer 8: HUD — phase name + subtitle + progress bar
  _drawQTEHUD(ctx, cw, ch);

  // Layer 9: flash overlay
  if (_qteFlashAlpha > 0.01) {
    ctx.globalAlpha = _qteFlashAlpha;
    ctx.fillStyle   = _qteFlashColor;
    ctx.fillRect(0, 0, cw, ch);
    ctx.globalAlpha = 1;
  }

  ctx.restore();
}

/**
 * Reset all QTE state — call from resetTFState() / backToMenu().
 */
function resetQTEState() {
  QTE_STATE       = null;
  if (typeof clearCombatLock === 'function') clearCombatLock('qte');
  _qteFiredPhases.clear();
  _qtePending     = null;
  _qteParticles   = [];
  _qteRipples     = [];
  _qteFlashAlpha  = 0;
  _qteShakeExtra  = 0;
  _qteScanAlpha   = 0;
  _qteVoidAlpha   = 0;
  _qteCloneAlpha  = 0;
  _qteWarpGrid    = [];
  _qteTimeline    = 0;
  _qteComboText   = null;
}

/**
 * Debug / cheat: force a specific phase (call from cheat console).
 * e.g. triggerQTEPhase(3);
 */
function triggerQTEPhase(phaseId) {
  if (!QTE_PHASES[phaseId]) return;
  const tf  = players && players.find(p => p.isTrueForm);
  const p1  = players && players.find(p => !p.isTrueForm && p.health > 0);
  if (!tf || !p1) return;
  // Mark fired so _checkQTETriggers doesn't double-trigger the same phase
  _qteFiredPhases.add(phaseId);
  _startQTE(phaseId, tf, p1);
}

// ── Trigger detection (called each frame when QTE is inactive) ────────────────
function _checkQTETriggers() {
  if (gameMode !== 'trueform' || !gameRunning) return;
  if (_qtePending) {
    _tickQTEPending();
    return;
  }
  const tf = players && players.find(p => p.isTrueForm);
  const p1 = players && players.find(p => !p.isTrueForm && p.health > 0);
  if (!tf || !p1 || tf.health <= 0 || activeCinematic) return;

  const hpPct = tf.health / tf.maxHealth;

  // Check phases in reverse order (highest priority first)
  for (const phaseId of [4, 3, 2, 1]) {
    const def = QTE_PHASES[phaseId];
    if (!_qteFiredPhases.has(phaseId) && hpPct <= def.hpThreshold) {
      // Mark as fired immediately so re-entry next frame doesn't double-trigger
      _qteFiredPhases.add(phaseId);
      // 0.3–0.6s delay at 60fps = 18–36 frames
      const delay = 18 + Math.floor(Math.random() * 19);
      _qtePending = { phaseId, tf, p1, timer: 0, totalDelay: delay };
      return;
    }
  }
}

// ── Pre-QTE warning tick ─────────────────────────────────────────────────────
// Runs each frame while _qtePending is set.  Checks player safety conditions
// and fires _startQTE only when the player is in a safe, grounded state.
function _tickQTEPending() {
  const pd = _qtePending;
  if (!pd) return;

  const { tf, p1 } = pd;

  // Abort if entities are gone
  if (!tf || tf.health <= 0 || !p1 || p1.health <= 0) {
    _qtePending = null;
    return;
  }

  // Apply gentle slow-motion during the warning window (0.7× speed)
  if (typeof slowMotionFor === 'function') slowMotionFor(0.7, 120);

  pd.timer++;

  // Safety checks — only proceed once the player is in a safe state.
  // Block if player is in an active combat state.
  const SPEED_THRESHOLD = 8; // px/frame
  const playerBusy = (
    (p1.attackTimer  > 0) ||
    (p1.hurtTimer    > 0) ||
    (p1.stunTimer    > 0) ||
    (Math.abs(p1.vx) > SPEED_THRESHOLD || Math.abs(p1.vy) > SPEED_THRESHOLD)
  );

  // Block if boss is mid-attack
  const bossBusy = (tf.attackTimer > 0);

  // Require player to be grounded (or at least not freefalling hard)
  const playerGrounded = p1.onGround || Math.abs(p1.vy) < 3;

  const safeToFire = !playerBusy && !bossBusy && playerGrounded;

  // Wait at least totalDelay frames AND for a safe window.
  // Hard cap: after 3× totalDelay frames always fire regardless (prevents indefinite deferral).
  const hardCap = pd.totalDelay * 3;
  if ((pd.timer >= pd.totalDelay && safeToFire) || pd.timer >= hardCap) {
    _qtePending = null;
    _startQTE(pd.phaseId, tf, p1);
  }
}

// ── QTE Initialisation ───────────────────────────────────────────────────────
function _startQTE(phaseId, bossRef, playerRef) {
  // Note: _qteFiredPhases.add() already called in _checkQTETriggers when pending starts
  const def = QTE_PHASES[phaseId];

  // Snap player to neutral — cancel velocity and any active combat timers
  if (playerRef) {
    playerRef.vx = 0;
    playerRef.vy = 0;
    if (playerRef.attackTimer  > 0) playerRef.attackTimer  = 0;
    if (playerRef.hurtTimer    > 0) playerRef.hurtTimer    = 0;
    if (playerRef.stunTimer    > 0) playerRef.stunTimer    = 0;
  }

  // Freeze normal game physics during QTE; raise combat lock so AI cannot run
  if (typeof slowMotionFor === 'function') slowMotionFor(0.0, 99999); // held until QTE ends
  if (typeof setCombatLock === 'function') setCombatLock('qte');

  // Build random prompt queue
  const count = def.promptCount[0] + Math.floor(Math.random() * (def.promptCount[1] - def.promptCount[0] + 1));
  const queue = _buildPromptQueue(count, def);

  QTE_STATE = {
    phase:         phaseId,
    def,
    stage:         'intro',
    introTimer:    0,
    outroTimer:    0,
    prompts:       [],
    promptQueue:   queue,
    promptIdx:     0,
    completedCount:0,
    failCount:     0,
    totalAttempts: 0,
    failedThisRound: false,
    chaosLevel:    0,
    bossRef,
    playerRef,
  };

  // Build warp grid
  _qteWarpGrid = _buildWarpGrid(16, 10);

  // Camera drama
  if (typeof setCameraDrama === 'function') {
    setCameraDrama('focus', 60, bossRef, 1.35);
  }

  // Strong shake
  _qteShakeExtra = 28 + phaseId * 6;
  screenShake = Math.max(screenShake, _qteShakeExtra);

  // Flash
  _qteFlashColor = phaseId >= 3 ? '#ff00ff' : '#ffffff';
  _qteFlashAlpha = 0.85;

  // Spawn intro burst particles
  _spawnQTEBurst(bossRef.cx(), bossRef.cy(), 40, _phaseColor(phaseId));
  _spawnQTERipple(bossRef.cx(), bossRef.cy(), _phaseColor(phaseId));

  // Dialogue
  const dialogues = [
    '',
    '"The world noticed you. So did I."',
    '"Every version of you is here. None of them are ready."',
    '"I\'m removing you from every frame of existence. Not personal."',
    '"All of it ends here. Every thread."',
  ];
  if (typeof showBossDialogue === 'function') showBossDialogue(dialogues[phaseId] || '', 180);
}

// ── Build prompt queue ────────────────────────────────────────────────────────
function _buildPromptQueue(count, def) {
  const queue = [];
  for (let i = 0; i < count; i++) {
    const actualKey  = _QTE_ALL_KEYS[Math.floor(Math.random() * _QTE_ALL_KEYS.length)];
    const isMirrored = def.mirrored && Math.random() < (def.mirrorChance || 0);
    const displayKey = isMirrored ? _QTE_MIRROR[actualKey] : actualKey;
    queue.push({
      key:          actualKey,
      displayKey:   displayKey,
      label:        _QTE_KEY_MAP[actualKey]  ? _QTE_KEY_MAP[actualKey].label  : actualKey.toUpperCase(),
      displayLabel: _QTE_KEY_MAP[displayKey] ? _QTE_KEY_MAP[displayKey].label : displayKey.toUpperCase(),
      isMirrored,
      hit:          false,
      missed:       false,
      timer:        0,
      maxTimer:     def.windowFrames,
      x:            0,
      y:            0,
      slot:         i % (def.simultaneousCount || 1),
    });
  }
  return queue;
}

// ── Stage tickers ─────────────────────────────────────────────────────────────

function _tickQTEIntro() {
  const s = QTE_STATE;
  s.introTimer++;

  // Escalate visuals
  _qteScanAlpha  = Math.min(0.45, s.introTimer / 80 * 0.45);
  _qteVoidAlpha  = Math.min(0.55 * s.def.bgIntensity, s.introTimer / 80 * 0.55 * s.def.bgIntensity);
  _qteCloneAlpha = Math.min(0.6, s.introTimer / 80 * 0.6);

  // Warp grid activation
  for (const node of _qteWarpGrid) {
    node.wobble = (node.wobble || 0) + 0.04;
    node.x = node.bx + Math.sin(node.wobble + node.phase) * 8 * s.def.bgIntensity;
    node.y = node.by + Math.cos(node.wobble + node.phase) * 6 * s.def.bgIntensity;
  }

  _qteFlashAlpha = Math.max(0, _qteFlashAlpha - 0.04);
  screenShake = Math.max(screenShake, _qteShakeExtra * (1 - s.introTimer / 80));

  if (s.introTimer >= 80) {
    s.stage = 'prompts';
    _advancePrompts();
  }
}

function _tickQTEPrompts() {
  const s   = QTE_STATE;
  const def = s.def;

  // Maintain visual chaos
  _qteScanAlpha  = 0.35 + s.chaosLevel * 0.25;
  _qteVoidAlpha  = 0.4  + s.chaosLevel * 0.3;
  _qteCloneAlpha = 0.4  + s.chaosLevel * 0.3;

  // Warp grid
  for (const node of _qteWarpGrid) {
    node.wobble = (node.wobble || 0) + 0.06 + s.chaosLevel * 0.04;
    node.x = node.bx + Math.sin(node.wobble + node.phase) * (10 + s.chaosLevel * 18) * def.bgIntensity;
    node.y = node.by + Math.cos(node.wobble + node.phase) * (8  + s.chaosLevel * 14) * def.bgIntensity;
  }

  _qteFlashAlpha = Math.max(0, _qteFlashAlpha - 0.05);

  // Tick active prompts
  let allResolved = true;
  for (const prompt of s.prompts) {
    if (prompt.hit || prompt.missed) continue;
    allResolved = false;
    prompt.timer++;
    if (!_qtePromptReachable(prompt, s)) {
      prompt._badPosFrames = (prompt._badPosFrames || 0) + 1;
      _qteEnsureReachable(prompt, prompt._slot || 0, prompt._total || 1, s);
      prompt.timer = Math.max(0, prompt.timer - 4);
    } else {
      prompt._badPosFrames = 0;
    }

    // Pulse radius on the bubble
    prompt.pulseT = (prompt.pulseT || 0) + 0.18;

    // Check expiry
    if (prompt.timer >= prompt.maxTimer) {
      prompt.missed = true;
      s.failCount++;
      s.failedThisRound = true;
      _onPromptFail(prompt);
      // In simultaneous mode — don't immediately restart, let others resolve
    } else {
      // Check key press (rising-edge: key is down AND was not down last frame)
      const keyDown = keysDown.has(prompt.key);
      if (keyDown && !prompt._wasDown) {
        prompt.hit = true;
        s.completedCount++;
        _onPromptHit(prompt, s);
      }
      prompt._wasDown = keyDown;
    }
  }

  // All prompts in current batch resolved?
  if (allResolved || s.prompts.every(p => p.hit || p.missed)) {
    const anyMissed = s.prompts.some(p => p.missed);
    if (anyMissed && !def.simultaneous) {
      // Sequential fail: reset the queue but escalate chaos
      _resetQTERound();
      return;
    }
    // Advance to next batch or finish
    _advancePrompts();
  }
}

function _tickQTEOutroSuccess() {
  const s = QTE_STATE;
  s.outroTimer++;

  _qteFlashAlpha  = Math.max(0, _qteFlashAlpha - 0.02);
  _qteScanAlpha   = Math.max(0, _qteScanAlpha  - 0.025);
  _qteVoidAlpha   = Math.max(0, _qteVoidAlpha  - 0.025);
  _qteCloneAlpha  = Math.max(0, _qteCloneAlpha - 0.018);
  _qteShakeExtra  = Math.max(0, _qteShakeExtra - 1);
  screenShake     = Math.max(screenShake, _qteShakeExtra);

  // Warp grid settle
  for (const node of _qteWarpGrid) {
    node.x += (node.bx - node.x) * 0.12;
    node.y += (node.by - node.y) * 0.12;
  }

  if (s.outroTimer >= 90) {
    _endQTE(true);
  }
}

function _tickQTEOutroFail() {
  const s = QTE_STATE;
  s.outroTimer++;
  _qteFlashAlpha = Math.max(0, _qteFlashAlpha - 0.03);
  screenShake = Math.max(screenShake, 18 * (1 - s.outroTimer / 45));

  if (s.outroTimer >= 45) {
    _endQTE(false);
  }
}

// ── Prompt advancement ────────────────────────────────────────────────────────

function _advancePrompts() {
  const s   = QTE_STATE;
  const def = s.def;

  // All prompts done?
  if (s.promptIdx >= s.promptQueue.length) {
    _beginOutroSuccess();
    return;
  }

  s.prompts = [];

  if (def.simultaneous) {
    // Launch simultaneousCount prompts at once
    const batchSize = def.simultaneousCount || 3;
    for (let b = 0; b < batchSize && s.promptIdx < s.promptQueue.length; b++, s.promptIdx++) {
      const p = s.promptQueue[s.promptIdx];
      _assignPromptPosition(p, b, batchSize, s);
      s.prompts.push(p);
    }
  } else {
    // One prompt at a time
    const p = s.promptQueue[s.promptIdx++];
    _assignPromptPosition(p, 0, 1, s);
    s.prompts.push(p);
  }
}

function _assignPromptPosition(prompt, slot, total, s) {
  const cw = canvas.width;
  const ch = canvas.height;
  const anchor = _qteAnchorPoint(s);

  if (s.def.id === 3) {
    // Phase 3: chaotic, but still inside a player-reachable pocket.
    prompt.x = anchor.x + (Math.random() - 0.5) * 300;
    prompt.y = anchor.y + (Math.random() - 0.5) * 220;
  } else if (s.def.id === 4) {
    // Phase 4: collapse arc close enough to read and react to.
    const angle = -Math.PI / 2 + (slot / Math.max(total - 1, 1)) * Math.PI * 1.2;
    const r     = 90 + slot * 10;
    prompt.x    = anchor.x + Math.cos(angle) * r;
    prompt.y    = anchor.y + Math.sin(angle) * (r * 0.82);
  } else if (total > 1) {
    // Phase 2: spread around player anchor, not the raw screen edges.
    const offsets = [-120, 0, 120];
    prompt.x = anchor.x + (offsets[slot] || 0);
    prompt.y = anchor.y + (slot % 2 === 0 ? -28 : 28);
  } else {
    // Single prompt: near the player focus point.
    prompt.x = anchor.x + (Math.random() - 0.5) * 96;
    prompt.y = anchor.y + (Math.random() - 0.5) * 56;
  }
  _qteEnsureReachable(prompt, slot, total, s);
  prompt.timer    = 0;
  prompt._wasDown = false; // always reset so any press — held OR new — registers immediately
}

// ── Round failure/reset ───────────────────────────────────────────────────────

function _resetQTERound() {
  const s = QTE_STATE;
  s.totalAttempts++;
  s.chaosLevel = Math.min(1, s.chaosLevel + 0.22);

  // Escalate visual chaos
  _qteFlashColor = '#ff0044';
  _qteFlashAlpha = 0.70;
  _qteShakeExtra = 22 + s.chaosLevel * 20;
  screenShake = Math.max(screenShake, _qteShakeExtra);

  // Damage player (failDamage fraction of max HP)
  const p1 = s.playerRef;
  if (p1 && p1.health > 0) {
    const dmg = Math.round(p1.maxHealth * s.def.failDamage * (1 + s.chaosLevel * 0.5));
    p1.health = Math.max(1, p1.health - dmg); // never kill outright (plot armor)
    if (typeof spawnParticles === 'function') {
      spawnParticles(p1.cx(), p1.cy(), '#ff0044', 20);
    }
    if (typeof showBossDialogue === 'function') {
      const taunts = [
        '"Slow."',
        '"That was already written."',
        '"You\'re not here anymore. You just don\'t know it."',
        '"You\'re more interesting when you resist."',
      ];
      showBossDialogue(taunts[s.totalAttempts % taunts.length], 120);
    }
  }

  // Spawn fail particles at centre
  _spawnQTEBurst(canvas.width / 2, canvas.height / 2, 30, '#ff0044');
  _spawnQTERipple(canvas.width / 2, canvas.height / 2, '#ff0044');

  // Combo text
  _qteComboText = {
    text:  'SEQUENCE FAILED',
    timer: 60,
    x:     canvas.width  / 2,
    y:     canvas.height * 0.30,
    color: '#ff2244',
  };

  // Plot armor: after N failures, inject easy prompts at end of queue
  if (s.def.plotArmor && s.totalAttempts >= s.def.plotArmor) {
    const remaining = s.promptQueue.slice(s.promptIdx);
    // Replace last 2 prompts with easily-detectable keys, no mirroring
    for (let i = Math.max(0, remaining.length - 2); i < remaining.length; i++) {
      remaining[i].isMirrored  = false;
      remaining[i].displayKey  = remaining[i].key;
      remaining[i].displayLabel= remaining[i].label;
      remaining[i].maxTimer    = 80; // extra time
    }
  }

  // Rebuild remaining prompts into the queue (restart from current idx)
  s.promptIdx = 0;
  s.failCount = 0;
  s.failedThisRound = false;
  s.prompts   = [];

  // Short pause then continue
  QTE_STATE.stage = 'outro_fail';
  QTE_STATE.outroTimer = 0;
}

// ── Prompt hit/miss events ────────────────────────────────────────────────────

function _onPromptHit(prompt, s) {
  // Cosmic flare particle burst at prompt position
  _spawnQTEBurst(prompt.x, prompt.y, 22, prompt.isMirrored ? '#00ffff' : '#ffcc00');
  _spawnQTERipple(prompt.x, prompt.y, '#ffcc00');

  // Screen flash on phase 3/4
  if (s.def.id >= 3) {
    _qteFlashColor = '#ffcc00';
    _qteFlashAlpha = 0.25;
    screenShake = Math.max(screenShake, 6);
  }

  // Timeline pulse
  _spawnTimelinePulse(prompt.x, prompt.y, s.def.id);

  // Combo text
  const combos = ['NICE', 'GOOD', 'PERFECT', 'REALITY HELD', 'TIMELINE STABLE'];
  _qteComboText = {
    text:  combos[Math.min(s.completedCount - 1, combos.length - 1)],
    timer: 40,
    x:     prompt.x,
    y:     prompt.y - 50,
    color: '#88ffcc',
  };
}

function _onPromptFail(prompt) {
  _spawnQTEBurst(prompt.x, prompt.y, 12, '#ff2244');
  screenShake = Math.max(screenShake, 10);
  // Simultaneous phases: deal damage per missed prompt (sequential phases handle this in _resetQTERound)
  if (QTE_STATE && QTE_STATE.def.simultaneous) {
    const p1 = QTE_STATE.playerRef;
    if (p1 && p1.health > 0) {
      const dmg = Math.round(p1.maxHealth * QTE_STATE.def.failDamage * 0.5); // half-weight per prompt
      p1.health = Math.max(1, p1.health - dmg);
      if (typeof spawnParticles === 'function') spawnParticles(p1.cx(), p1.cy(), '#ff0044', 10);
    }
  }
}

// ── Outro success ─────────────────────────────────────────────────────────────

function _beginOutroSuccess() {
  const s = QTE_STATE;
  s.stage      = 'outro_success';
  s.outroTimer = 0;

  // Visual payoff
  _qteFlashColor = _phaseColor(s.phase);
  _qteFlashAlpha = 0.70;
  screenShake = Math.max(screenShake, 30);

  // Massive particle burst
  _spawnQTEBurst(canvas.width / 2, canvas.height / 2, 60, _phaseColor(s.phase));
  _spawnQTEBurst(canvas.width / 2, canvas.height / 2, 40, '#ffffff');
  for (let i = 0; i < 6; i++) {
    const rx = 60 + Math.random() * (canvas.width  - 120);
    const ry = 60 + Math.random() * (canvas.height - 120);
    _spawnQTERipple(rx, ry, _phaseColor(s.phase));
  }

  // Combo headline
  const headlines = [
    '', // phase 0 unused
    'TIMELINE STABILIZED',
    'MULTIVERSE REALIGNED',
    'ERASURE REVERSED',
    'MULTIVERSE REBUILT',
  ];
  _qteComboText = {
    text:  headlines[s.phase] || 'SUCCESS',
    timer: 90,
    x:     canvas.width  / 2,
    y:     canvas.height * 0.28,
    color: _phaseColor(s.phase),
  };

  // Dialogue
  const successLines = [
    '',
    '"...you broke the sequence."',
    '"That wasn\'t in any timeline I modeled."',
    '"You survived the gap between realities. Remarkable."',
    '"...I see. You\'re something else entirely."',
  ];
  if (typeof showBossDialogue === 'function') {
    showBossDialogue(successLines[s.phase] || '', 200);
  }

  // Deal success bonus damage to boss
  const boss = s.bossRef;
  if (boss && boss.health > 0) {
    if (s.def.successBonus >= 9999) {
      // Phase 4 kill — set health to 1 so boss death scene triggers naturally
      boss.health = 1;
      if (typeof dealDamage === 'function') dealDamage(s.playerRef, boss, 1, 0);
    } else {
      if (typeof dealDamage === 'function') dealDamage(s.playerRef, boss, s.def.successBonus, 0);
    }
  }

  // Phase-specific cinematic extras
  _phaseSuccessExtras(s);
}

function _phaseSuccessExtras(s) {
  switch (s.phase) {
    case 1:
      // Mild gravity glitch clears
      if (typeof tfGravityInverted !== 'undefined' && tfGravityInverted) {
        tfGravityInverted = false;
        if (typeof showBossDialogue === 'function') showBossDialogue('"You broke the pull. Noted."', 100);
      }
      break;
    case 2:
      // Clear all black holes
      if (typeof tfBlackHoles !== 'undefined') tfBlackHoles.length = 0;
      if (typeof setCameraDrama === 'function') setCameraDrama('wideshot', 80);
      break;
    case 3:
      // Slow-mo moment
      slowMotion = 0.08;
      setTimeout(() => { if (typeof slowMotion !== 'undefined' && slowMotion < 0.5) slowMotion = 1.0; }, 1200);
      if (typeof setCameraDrama === 'function') {
        setCameraDrama('impact', 40);
        setTimeout(() => setCameraDrama('focus', 70, s.bossRef, 1.28), 700);
      }
      break;
    case 4:
      // Final collapse cinematic — camera pulls out dramatically
      slowMotion = 0.05;
      if (typeof setCameraDrama === 'function') {
        setCameraDrama('wideshot', 120);
        setTimeout(() => { if (typeof setCameraDrama === 'function') setCameraDrama('focus', 90, s.bossRef, 1.6); }, 2000);
      }
      setTimeout(() => { if (typeof slowMotion !== 'undefined') slowMotion = 1.0; }, 3000);
      // Massive shake sequence
      let _shakeSeq = 0;
      const _doShake = () => {
        if (_shakeSeq++ < 5 && typeof screenShake !== 'undefined') {
          screenShake = 35 - _shakeSeq * 4;
          setTimeout(_doShake, 220);
        }
      };
      _doShake();
      break;
  }
}

// ── End QTE ───────────────────────────────────────────────────────────────────

function _endQTE(success) {
  if (!QTE_STATE) return;
  const phase = QTE_STATE.phase;

  // Restore slowMotion (we froze it at 0.0 during the QTE) and release combat lock
  if (typeof slowMotion !== 'undefined') slowMotion = 1.0;
  if (typeof clearCombatLock === 'function') clearCombatLock('qte');

  // Fade out visuals
  _qteFlashAlpha  = 0;
  _qteScanAlpha   = 0;
  _qteVoidAlpha   = 0;
  _qteCloneAlpha  = 0;
  _qteShakeExtra  = 0;

  // If failure outro just ended, either retry or end with heavy penalty
  if (!success) {
    const def = QTE_STATE.def;
    const p1  = QTE_STATE.playerRef;

    // Check attempt limit — if reached, deal the penalty and exit for real
    if (def.maxAttempts && QTE_STATE.totalAttempts >= def.maxAttempts) {
      if (p1 && p1.health > 0) {
        const penaltyDmg = Math.round(p1.maxHealth * (def.penaltyDamage || 0.40));
        // Phase 4: outright kill (the boss wins this exchange)
        if (def.id === 4) {
          p1.health = 0;
        } else {
          p1.health = Math.max(1, p1.health - penaltyDmg);
        }
        if (typeof spawnParticles === 'function') spawnParticles(p1.cx(), p1.cy(), '#ff0000', 30);
        screenShake = Math.max(screenShake || 0, 30);
        _qteFlashColor = '#ff0000';
        _qteFlashAlpha = 0.85;
      }
      if (typeof showBossDialogue === 'function') {
        const endLines = [
          '"That\'s all you had."',
          '"Every version of you failed."',
          '"Existence disagreed with you."',
          '"You ran out of timelines."',
        ];
        showBossDialogue(endLines[(def.id - 1) % endLines.length], 200);
      }
      QTE_STATE = null;
      return;
    }

    // Attempts remain — rebuild and retry with escalated chaos
    QTE_STATE.stage        = 'prompts';
    QTE_STATE.outroTimer   = 0;
    QTE_STATE.failedThisRound = false;
    const count = def.promptCount[0] + Math.floor(Math.random() * (def.promptCount[1] - def.promptCount[0] + 1));
    QTE_STATE.promptQueue  = _buildPromptQueue(count, def);
    QTE_STATE.promptIdx    = 0;
    QTE_STATE.prompts      = [];
    slowMotion = 0.0; // re-freeze
    _advancePrompts();
    return;
  }

  // Full success — clear
  QTE_STATE = null;
}

// ── Visual helpers ────────────────────────────────────────────────────────────

function _tickQTEVisuals() {
  _qteFlashAlpha = Math.max(0, _qteFlashAlpha - 0.015);

  // Apply extra shake to game
  if (_qteShakeExtra > 0.5 && typeof screenShake !== 'undefined') {
    screenShake = Math.max(screenShake, _qteShakeExtra * (0.6 + Math.sin(_qteTimeline * 0.3) * 0.4));
    _qteShakeExtra *= 0.96;
  }

  if (_qteComboText) {
    _qteComboText.timer--;
    if (_qteComboText.timer <= 0) _qteComboText = null;
  }
}

function _tickQTEParticles() {
  for (let i = _qteParticles.length - 1; i >= 0; i--) {
    const p = _qteParticles[i];
    p.x    += p.vx;
    p.y    += p.vy;
    p.vy   += p.gravity || 0;
    p.alpha = Math.max(0, p.alpha - p.decay);
    p.r    *= 0.97;
    if (p.alpha <= 0 || p.r < 0.3) { _qteParticles.splice(i, 1); }
  }
}

function _tickQTERipples() {
  for (let i = _qteRipples.length - 1; i >= 0; i--) {
    const r = _qteRipples[i];
    r.r     += r.speed || 4;
    r.alpha  = Math.max(0, r.alpha - 0.028);
    if (r.alpha <= 0) { _qteRipples.splice(i, 1); }
  }
}

function _spawnQTEBurst(cx, cy, count, color) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const spd   = 1.5 + Math.random() * 5;
    _qteParticles.push({
      x: cx, y: cy,
      vx: Math.cos(angle) * spd,
      vy: Math.sin(angle) * spd,
      r: 3 + Math.random() * 5,
      color,
      alpha: 0.9 + Math.random() * 0.1,
      decay: 0.018 + Math.random() * 0.015,
      gravity: 0.05,
    });
  }
}

function _spawnTimelinePulse(cx, cy, phaseId) {
  // A "timeline thread" — a line of particles shooting upward
  const color = _phaseColor(phaseId);
  for (let i = 0; i < 8; i++) {
    _qteParticles.push({
      x: cx + (Math.random() - 0.5) * 20,
      y: cy,
      vx: (Math.random() - 0.5) * 2,
      vy: -(2 + Math.random() * 4),
      r: 2 + Math.random() * 3,
      color,
      alpha: 1.0,
      decay: 0.022,
      gravity: -0.02,
    });
  }
}

function _spawnQTERipple(cx, cy, color) {
  _qteRipples.push({ x: cx, y: cy, r: 8, alpha: 0.85, color, speed: 3 + Math.random() * 2 });
  _qteRipples.push({ x: cx, y: cy, r: 4, alpha: 0.65, color, speed: 5 + Math.random() * 3 });
}

// ── Warp grid builder ─────────────────────────────────────────────────────────
function _buildWarpGrid(cols, rows) {
  const nodes = [];
  const cw = canvas.width  || 900;
  const ch = canvas.height || 520;
  for (let row = 0; row <= rows; row++) {
    for (let col = 0; col <= cols; col++) {
      const bx = (col / cols) * cw;
      const by = (row / rows) * ch;
      nodes.push({ bx, by, x: bx, y: by, wobble: 0, phase: Math.random() * Math.PI * 2 });
    }
  }
  return nodes;
}

// ── Phase colour ─────────────────────────────────────────────────────────────
function _phaseColor(phaseId) {
  return ['#ffffff', '#44aaff', '#aa44ff', '#ff4400', '#ff00ff'][phaseId] || '#ffffff';
}

// ── DRAW functions ────────────────────────────────────────────────────────────

function _drawQTEBackground(ctx, cw, ch) {
  const s = QTE_STATE;
  if (!s) return;

  const t = _qteTimeline;

  // Dark vignette
  if (_qteVoidAlpha > 0.01) {
    const vg = ctx.createRadialGradient(cw / 2, ch / 2, ch * 0.15, cw / 2, ch / 2, cw * 0.75);
    vg.addColorStop(0, `rgba(0,0,0,0)`);
    vg.addColorStop(1, `rgba(0,0,6,${_qteVoidAlpha.toFixed(2)})`);
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, cw, ch);
  }

  // Fractal star field (phase 3+)
  if (s.phase >= 3) {
    ctx.save();
    ctx.globalAlpha = 0.35 + s.chaosLevel * 0.25;
    const starCount = 60;
    for (let i = 0; i < starCount; i++) {
      // Deterministic pseudo-random using seed
      const sx = (Math.sin(i * 127.1 + _qteFractalSeed) * 0.5 + 0.5) * cw;
      const sy = (Math.sin(i * 311.7 + _qteFractalSeed) * 0.5 + 0.5) * ch;
      const sr = 0.8 + (Math.sin(i * 43.9 + t * 0.05) * 0.5 + 0.5) * 2.2;
      const sa = 0.4 + (Math.sin(i * 97.3 + t * 0.08) * 0.5 + 0.5) * 0.6;
      ctx.globalAlpha = sa * (0.35 + s.chaosLevel * 0.25);
      ctx.fillStyle   = _phaseColor(s.phase);
      ctx.beginPath();
      ctx.arc(sx, sy, sr, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // Scanline overlay
  if (_qteScanAlpha > 0.01) {
    ctx.save();
    const scanStep = 4;
    ctx.globalAlpha = _qteScanAlpha * (0.5 + 0.5 * Math.sin(t * 0.25));
    ctx.fillStyle   = `rgba(0,0,20,0.45)`;
    for (let sy = 0; sy < ch; sy += scanStep * 2) {
      ctx.fillRect(0, sy, cw, scanStep);
    }
    ctx.restore();
  }

  // Collapsing timeline arcs (phase 2+)
  if (s.phase >= 2) {
    ctx.save();
    ctx.globalAlpha = 0.18 + s.chaosLevel * 0.18;
    ctx.strokeStyle = _phaseColor(s.phase);
    ctx.lineWidth   = 1;
    for (let arc = 0; arc < 5; arc++) {
      const arcT    = (t * 0.01 + arc * 0.2) % 1;
      const arcR    = 80 + arc * 90 + arcT * 200;
      const arcA    = 0.6 - arcT * 0.6;
      ctx.globalAlpha = arcA * (0.18 + s.chaosLevel * 0.18);
      ctx.beginPath();
      ctx.arc(cw / 2, ch / 2, arcR, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }
}

function _drawQTEWarpGrid(ctx, cw, ch) {
  const s = QTE_STATE;
  if (!s || _qteScanAlpha < 0.05) return;
  const cols = 16, rows = 10;

  ctx.save();
  ctx.globalAlpha = 0.08 + s.chaosLevel * 0.10;
  ctx.strokeStyle = _phaseColor(s.phase);
  ctx.lineWidth   = 0.7;

  // Draw grid lines between adjacent nodes
  for (let row = 0; row <= rows; row++) {
    ctx.beginPath();
    for (let col = 0; col <= cols; col++) {
      const idx = row * (cols + 1) + col;
      const n   = _qteWarpGrid[idx];
      if (!n) continue;
      if (col === 0) ctx.moveTo(n.x, n.y);
      else            ctx.lineTo(n.x, n.y);
    }
    ctx.stroke();
  }
  for (let col = 0; col <= cols; col++) {
    ctx.beginPath();
    for (let row = 0; row <= rows; row++) {
      const idx = row * (cols + 1) + col;
      const n   = _qteWarpGrid[idx];
      if (!n) continue;
      if (row === 0) ctx.moveTo(n.x, n.y);
      else            ctx.lineTo(n.x, n.y);
    }
    ctx.stroke();
  }
  ctx.restore();
}

function _drawQTEClones(ctx, cw, ch) {
  const s = QTE_STATE;
  if (!s || !s.playerRef) return;

  const p = s.playerRef;
  ctx.save();

  // Draw 3 mirrored silhouettes at offset positions
  const offsets = [[-180, -20, -1], [180, 20, 1], [0, -60, 1]];
  offsets.forEach(([ox, oy, scaleX]) => {
    ctx.save();
    ctx.globalAlpha = _qteCloneAlpha * 0.45;
    ctx.fillStyle   = _phaseColor(s.phase);

    // Convert game coords to screen
    const gScX = canvas.width  / GAME_W;
    const gScY = canvas.height / GAME_H;
    const sx   = (p.x + p.w / 2) * gScX + ox;
    const sy   = p.y * gScY + oy;
    const sw   = p.w * gScX * 1.1;
    const sh   = p.h * gScY * 1.1;

    ctx.translate(sx, sy);
    ctx.scale(scaleX, 1);
    ctx.shadowColor = _phaseColor(s.phase);
    ctx.shadowBlur  = 12;

    // Simple stickman silhouette
    ctx.fillRect(-sw / 2, 0, sw, sh);
    ctx.restore();
  });

  ctx.restore();
}

function _drawQTERipples(ctx) {
  ctx.save();
  for (const r of _qteRipples) {
    ctx.strokeStyle = r.color;
    ctx.lineWidth   = 2;
    ctx.globalAlpha = r.alpha;
    ctx.shadowColor = r.color;
    ctx.shadowBlur  = 8;
    ctx.beginPath();
    ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function _drawQTEParticles(ctx) {
  ctx.save();
  for (const p of _qteParticles) {
    ctx.globalAlpha  = p.alpha;
    ctx.fillStyle    = p.color;
    ctx.shadowColor  = p.color;
    ctx.shadowBlur   = 6;
    ctx.beginPath();
    ctx.arc(p.x, p.y, Math.max(0.1, p.r), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.shadowBlur = 0;
  ctx.restore();
}

function _drawQTEPrompts(ctx, cw, ch) {
  const s = QTE_STATE;
  if (!s) return;

  const now = _qteTimeline;

  for (const prompt of s.prompts) {
    if (prompt.missed) {
      _drawPromptBubble(ctx, prompt, 'missed', now);
    } else if (prompt.hit) {
      _drawPromptBubble(ctx, prompt, 'hit', now);
    } else {
      _drawPromptBubble(ctx, prompt, 'active', now);
    }
  }
}

function _drawPromptBubble(ctx, prompt, state, now) {
  const { x, y, timer, maxTimer, displayLabel, isMirrored } = prompt;

  ctx.save();

  const pct      = timer / maxTimer;        // 0 = just appeared, 1 = about to expire
  const pulse    = 0.88 + Math.sin((prompt.pulseT || 0) * 2.8) * 0.12;
  const baseR    = 38 * pulse;
  const urgency  = pct > 0.65 ? (pct - 0.65) / 0.35 : 0; // 0-1, ramps in last 35%

  // Colour based on state
  let fillColor, strokeColor, textColor;
  if (state === 'hit') {
    fillColor   = 'rgba(80,255,140,0.25)';
    strokeColor = '#44ff88';
    textColor   = '#88ffcc';
  } else if (state === 'missed') {
    fillColor   = 'rgba(255,30,50,0.20)';
    strokeColor = '#ff2244';
    textColor   = '#ff6677';
  } else {
    // Urgency tint: white → yellow → red
    const ur = Math.round(200 + urgency * 55);
    const ug = Math.round(220 - urgency * 150);
    const ub = Math.round(255 - urgency * 255);
    fillColor   = isMirrored
      ? `rgba(140,0,200,${0.18 + urgency * 0.25})`
      : `rgba(${ur},${ug},${ub},${0.12 + urgency * 0.28})`;
    strokeColor = isMirrored ? '#cc44ff' : `rgb(${ur},${ug},${ub})`;
    textColor   = '#ffffff';
  }

  // Drop shadow glow
  ctx.shadowColor = strokeColor;
  ctx.shadowBlur  = 14 + urgency * 12;

  // Circle background
  ctx.globalAlpha = state === 'missed' ? 0.4 : (state === 'hit' ? 0.6 : 1.0);
  ctx.fillStyle   = fillColor;
  ctx.beginPath();
  ctx.arc(x, y, baseR, 0, Math.PI * 2);
  ctx.fill();

  // Stroke ring
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth   = 2.5 + urgency * 2;
  ctx.beginPath();
  ctx.arc(x, y, baseR, 0, Math.PI * 2);
  ctx.stroke();

  // Countdown ring (shrinking arc)
  if (state === 'active') {
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth   = 4;
    ctx.globalAlpha = 0.55 + urgency * 0.3;
    ctx.beginPath();
    ctx.arc(x, y, baseR + 6, -Math.PI / 2, -Math.PI / 2 + (1 - pct) * Math.PI * 2);
    ctx.stroke();
  }

  // Key label
  ctx.globalAlpha = state === 'missed' ? 0.4 : 1.0;
  ctx.fillStyle   = textColor;
  ctx.shadowBlur  = 8;
  ctx.font        = `bold ${displayLabel.length > 2 ? 11 : 20}px "Segoe UI", Arial, sans-serif`;
  ctx.textAlign   = 'center';
  ctx.textBaseline= 'middle';
  ctx.fillText(displayLabel, x, y);

  // "MIRRORED" badge for phase 2+ mirrored prompts
  if (isMirrored && state === 'active') {
    ctx.font        = '8px Arial';
    ctx.fillStyle   = '#cc88ff';
    ctx.shadowBlur  = 4;
    ctx.fillText('MIRRORED', x, y + baseR + 10);
  }

  // Hit checkmark
  if (state === 'hit') {
    ctx.font      = 'bold 22px Arial';
    ctx.fillStyle = '#44ff88';
    ctx.fillText('✓', x, y + baseR - 8);
  }

  ctx.shadowBlur = 0;
  ctx.restore();
}

function _drawQTEHUD(ctx, cw, ch) {
  const s = QTE_STATE;
  if (!s) return;

  ctx.save();

  // Phase name (top center)
  const phaseAlpha = s.stage === 'intro'
    ? Math.min(1, s.introTimer / 40)
    : (s.stage === 'outro_success' ? Math.max(0, 1 - s.outroTimer / 40) : 1.0);

  ctx.globalAlpha = phaseAlpha;
  ctx.font        = 'bold 28px "Segoe UI", Arial, sans-serif';
  ctx.textAlign   = 'center';
  ctx.fillStyle   = _phaseColor(s.phase);
  ctx.shadowColor = _phaseColor(s.phase);
  ctx.shadowBlur  = 20;

  // Glitch offset on phase 3/4
  const glitchX = s.phase >= 3 ? (Math.random() - 0.5) * 3 * s.chaosLevel : 0;
  const glitchY = s.phase >= 3 ? (Math.random() - 0.5) * 2 * s.chaosLevel : 0;

  ctx.fillText(s.def.name, cw / 2 + glitchX, 46 + glitchY);

  // Subtitle
  if (s.stage === 'intro' || s.stage === 'prompts') {
    ctx.font        = '14px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle   = 'rgba(200,200,255,0.75)';
    ctx.shadowBlur  = 6;
    ctx.globalAlpha = phaseAlpha * 0.8;
    ctx.fillText(s.def.subtitle, cw / 2, 68);
  }

  // Progress dots (sequential mode)
  if (!s.def.simultaneous && s.promptQueue.length > 0) {
    const total     = s.promptQueue.length;
    const dotR      = 5;
    const dotSpacing= 16;
    const totalW    = (total - 1) * dotSpacing;
    const startX    = cw / 2 - totalW / 2;
    const dotY      = ch - 30;

    ctx.shadowBlur  = 6;
    for (let i = 0; i < total; i++) {
      const pq = s.promptQueue[i];
      const dx = startX + i * dotSpacing;

      if (pq.hit) {
        ctx.globalAlpha = phaseAlpha;
        ctx.fillStyle   = '#44ff88';
        ctx.shadowColor = '#44ff88';
      } else if (pq.missed) {
        ctx.globalAlpha = phaseAlpha * 0.6;
        ctx.fillStyle   = '#ff2244';
        ctx.shadowColor = '#ff2244';
      } else if (i === s.promptIdx - 1 || s.prompts.includes(pq)) {
        ctx.globalAlpha = phaseAlpha;
        ctx.fillStyle   = _phaseColor(s.phase);
        ctx.shadowColor = _phaseColor(s.phase);
      } else {
        ctx.globalAlpha = phaseAlpha * 0.25;
        ctx.fillStyle   = '#aaaacc';
        ctx.shadowColor = 'transparent';
      }

      ctx.beginPath();
      ctx.arc(dx, dotY, dotR, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Chaos level warning (phase 3/4)
  if (s.chaosLevel > 0.1 && (s.phase >= 3)) {
    ctx.globalAlpha = phaseAlpha * s.chaosLevel;
    ctx.font        = '11px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle   = '#ff6644';
    ctx.shadowColor = '#ff2200';
    ctx.shadowBlur  = 10;
    ctx.textAlign   = 'right';
    ctx.fillText(`CHAOS LEVEL ${Math.round(s.chaosLevel * 100)}%`, cw - 24, ch - 20);
  }

  ctx.shadowBlur = 0;
  ctx.restore();
}

function _drawQTEComboText(ctx, cw, ch) {
  if (!_qteComboText) return;
  const ct = _qteComboText;
  const alpha = Math.min(1, ct.timer / 20) * Math.min(1, (ct.timer) / 10);

  ctx.save();
  ctx.globalAlpha  = alpha;
  ctx.font         = 'bold 22px "Segoe UI", Arial, sans-serif';
  ctx.textAlign    = 'center';
  ctx.fillStyle    = ct.color;
  ctx.shadowColor  = ct.color;
  ctx.shadowBlur   = 16;

  // Rise upward as timer decreases
  const rise = (1 - ct.timer / 60) * 18;
  ctx.fillText(ct.text, ct.x, ct.y - rise);
  ctx.restore();
}

// ── HTML load: add QTE script tag to index.html integration point ─────────────
// In index.html, add before smc-loop.js:
//   <script src="js/smc-qte.js"></script>
//
// In smc-loop.js gameLoop(), add after storyCheckEvents line:
//   if (gameMode === 'trueform') updateQTE();
//
// In smc-loop.js screen-space draw section (after drawStoryWorldDistortion):
//   if (gameMode === 'trueform' && typeof drawQTE === 'function')
//     drawQTE(ctx, canvas.width, canvas.height);
//
// In smc-boss.js resetTFState():
//   if (typeof resetQTEState === 'function') resetQTEState();
//
// Cheat code (add to smc-loop.js cheat handler):
//   } else if (code.startsWith('QTE')) {
//     const ph = parseInt(code.slice(3));
//     if (ph >= 1 && ph <= 4 && typeof triggerQTEPhase === 'function') {
//       triggerQTEPhase(ph); ok('QTE Phase ' + ph);
//     }
//   }
