'use strict';
// smb-qte-core.js — QTE phase definitions, state objects, public API, trigger detection, _startQTE
// Depends on: smb-globals.js, smb-particles-core.js, smb-combat.js

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

