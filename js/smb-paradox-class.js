'use strict';
// smb-paradox-class.js — Paradox entity class definition + global state variables
// Depends on: smb-globals.js, smb-paradox-class.js (and preceding splits in chain)

// ============================================================
// PARADOX  — multiversal being (cinematic entity + revive system)
// Visual only: no AI, no hitbox, not in players[]
// ============================================================

// ---- Global state ----------------------------------------
let paradoxEntity        = null;  // active Paradox visual instance
let paradoxReviveActive  = false; // paradox revive sequence running
let paradoxReviveTimer   = 0;
let paradoxRevivePlayer  = null;  // player being revived

// ---- Opening fight state (player + Paradox vs TF for 1000 total damage) ----
let tfOpeningFightActive   = false;
let tfOpeningDamageDealt   = 0;     // total damage dealt to TF so far (free + scripted)
let _tfOpeningParadoxAtkCd = 0;     // frames until next Paradox attack
let _tfOpeningHeroAtkCd    = 90;    // frames until next scripted hero attack
let _tfOpeningTFRef        = null;  // reference to TrueForm entity
let _tfOpeningPhase        = 0;     // 0=slow buildup, 1=building, 2=climax
let _tfOpeningDialogueFired = new Set(); // which scripted lines have been shown
let _paradoxVx             = 0;    // smoothed horizontal velocity for Paradox movement
let _tfOpeningHeroReactDelay = 0;  // frames hero has been in back-off zone (reaction delay)
let _tfOpeningFreeFrames   = 0;    // countdown: player controls active during this many frames
let _tfOpeningTFStartHealth = 0;   // TF HP at fight start — used to pin exact 1000 damage
const TF_OPENING_DAMAGE_THRESHOLD = 1000;

// ---- Absorption state (after Paradox dies and enters player) ----------------
let _tfAbsorptionState = null; // { timer, boss, hero }

// ---- New declarative absorption cinematic (replaces _startAbsorptionThenPunch in main flow) ----
let tfAbsorptionScene = null; // { timer, maxTimer, playerRef, paradoxRef, bossRef, phase, memoryIndex, flashAlpha, absorbed }

// Brief fragmented flashes of Paradox's origin — shown during the absorption scene.
// Intentionally incomplete so the player must piece them together.
// CANON: Paradox was built during the multiversal war to fight beside Axiom.
//        A construction error caused it to turn against everyone.
//        It has been fighting ever since — not out of malice, but because
//        the error is all it knows.
const _TF_ABSORPTION_MEMORIES = [
  'Built to fight beside him.',
  'Something went wrong.',
  '"I was not supposed to be the enemy."',
  'The error was never fixed.',
  '"I fought because that is what I was made to do."',
  'It was always going to end here.',
  '"Remember what I was before the mistake."',
];

// ---- TF-kills-Paradox cinematic overlay state --------------------------------
let playerParadoxAbsorbed = false; // permanent: player carries Paradox energy
let _tfKCOverlay = null;           // visual overlay for the kills-Paradox cinematic

// TrueForm damage lock phase
let tfDamageLocked     = false; // true = player deals 0 dmg to TrueForm
let tfDamageLockTimer  = 0;     // frames until auto-unlock (counts down)

// Paradox Empowerment — activated after damage lock ends
let tfParadoxEmpowered = false;
let tfEmpowerTimer     = 0;
const TF_EMPOWER_DURATION = 900; // 15 seconds at 60 fps

// Boss fight foreshadowing state
let bossParadoxForeshadow = {
  active:     false,
  timer:      0,
  cooldown:   0,    // frames before next event can trigger
  punchFired: false // one-time boss-punches-paradox scripted moment
};

// TrueForm 30% final cinematic
let tfFinalParadoxFired = false;

const _PARADOX_REVIVE_LINES = [
  "You're not done.",
  "Not this outcome.",
  "Try again."
];

// ============================================================
// PARADOX CLASS  (visual entity — no physics fighting)
// ============================================================
class Paradox {
  constructor(x, y) {
    this.x        = x;
    this.y        = y;
    this.w        = 18;
    this.h        = 50;
    this.alpha    = 0;      // fades in on spawn
    this.facing   = 1;      // +1 right, -1 left
    this.vy       = 0;
    this.done     = false;  // set true to begin fade-out
    this._flicker = 0;
    this._glitchX = 0;
    this._glitchTick = 0;
    this.attackAnim  = 0;   // 0-1 punch animation progress
  }

  cx() { return this.x + this.w / 2; }
  cy() { return this.y + this.h / 2; }

  update() {
    // Fade in / fade out
    if (!this.done) this.alpha = Math.min(1, this.alpha + 0.05);
    else            this.alpha = Math.max(0, this.alpha - 0.06);

    // Glitch offset
    this._flicker++;
    this._glitchTick--;
    if (this._glitchTick <= 0) {
      this._glitchTick = 4 + Math.floor(Math.random() * 12);
      this._glitchX    = (Math.random() < 0.28) ? (Math.random() - 0.5) * 14 : 0;
    }

    // Simple gravity
    this.vy += 0.55;
    this.y  += this.vy;
    const floor = GAME_H - 72;
    if (this.y + this.h > floor) { this.y = floor - this.h; this.vy = 0; }

    // Cyan / white particle trail
    if (settings.particles && Math.random() < 0.22 && this.alpha > 0.25 && particles.length < MAX_PARTICLES) {
      const _p = _getParticle();
      _p.x     = this.cx() + (Math.random() - 0.5) * 14;
      _p.y     = this.cy() + (Math.random() - 0.5) * 22;
      _p.vx    = (Math.random() - 0.5) * 1.4;
      _p.vy    = -0.8 - Math.random() * 1.8;
      _p.color = Math.random() < 0.55 ? '#00ffff' : '#ffffff';
      _p.size  = 1 + Math.random() * 2;
      _p.life  = 16 + Math.random() * 18;
      _p.maxLife = 34;
      particles.push(_p);
    }

    // Decay punch anim
    if (this.attackAnim > 0) this.attackAnim = Math.max(0, this.attackAnim - 0.07);
  }

  // Trigger visible punch animation
  punch(dir) {
    this.attackAnim = 1;
    if (dir !== undefined) this.facing = dir;
  }

  draw() {
    if (this.alpha <= 0) return;
    const flickAlpha = this.alpha * (0.6 + Math.sin(this._flicker * 0.75) * 0.4);
    const gx = this.x + this._glitchX;
    const hx = gx + this.w / 2;

    ctx.save();
    ctx.globalAlpha = Math.max(0, flickAlpha);
    ctx.shadowColor = '#00ffff';
    ctx.shadowBlur  = 22 * this.alpha;

    // Head
    ctx.fillStyle   = '#000000';
    ctx.strokeStyle = '#00ffff';
    ctx.lineWidth   = 1.8;
    ctx.beginPath();
    ctx.arc(hx, this.y + 8, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Eye gleam
    ctx.fillStyle   = '#ffffff';
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur  = 6;
    ctx.beginPath();
    ctx.arc(hx + this.facing * 2.5, this.y + 7.5, 1.8, 0, Math.PI * 2);
    ctx.fill();

    // Torso
    ctx.shadowColor = '#00ffff';
    ctx.shadowBlur  = 14 * this.alpha;
    ctx.fillStyle   = '#000000';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth   = 1.6;
    ctx.beginPath();
    ctx.rect(hx - 7, this.y + 16, 14, 18);
    ctx.fill();
    ctx.stroke();

    // Arms — front arm extends with punch anim
    const armExt = this.attackAnim * 10 * this.facing;
    ctx.strokeStyle = '#00ffff';
    ctx.lineWidth   = 2;
    ctx.beginPath();
    ctx.moveTo(hx, this.y + 18);
    ctx.lineTo(hx - this.facing * 11, this.y + 25);
    ctx.moveTo(hx, this.y + 18);
    ctx.lineTo(hx + this.facing * 13 + armExt, this.y + 24 - this.attackAnim * 4);
    ctx.stroke();

    // Legs
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth   = 1.8;
    ctx.beginPath();
    ctx.moveTo(hx - 4, this.y + 34);
    ctx.lineTo(hx - 6, this.y + this.h);
    ctx.moveTo(hx + 4, this.y + 34);
    ctx.lineTo(hx + 7, this.y + this.h);
    ctx.stroke();

    // Glitch scan-line effect
    if (this._flicker % 8 < 3) {
      ctx.globalAlpha *= 0.38;
      ctx.fillStyle = '#00ffff';
      for (let i = 0; i < 4; i++) {
        const scanY = this.y + Math.random() * this.h;
        ctx.fillRect(gx - 2, scanY, this.w + 4, 1.2);
      }
    }

    ctx.restore();
  }
}

