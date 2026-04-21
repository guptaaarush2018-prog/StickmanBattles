'use strict';
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

// ============================================================
// OPENING FIGHT  — player + Paradox fight TF together (fully scripted cinematic)
// Called from TrueForm.updateAI() on first tick.
// Player has NO control. TF cannot attack. Everything is driven by a GSAP timeline
// for phase events/dialogue; per-frame movement handled in updateTFOpeningFight().
// ============================================================
let _tfOpeningGSAPTL = null; // active GSAP timeline for this cinematic

function startTFOpeningFight(tf) {
  if (tfOpeningFightActive) return;
  tfOpeningFightActive      = true;
  tfCinematicState          = 'opening_fight';
  tfOpeningDamageDealt      = 0;
  _tfOpeningParadoxAtkCd    = 90;
  _tfOpeningHeroAtkCd       = 120;
  _tfOpeningPhase           = 0;
  _tfOpeningDialogueFired   = new Set();
  _tfOpeningTFRef           = tf;
  _paradoxVx                = 0;
  _tfOpeningHeroReactDelay  = 0;
  _tfOpeningFreeFrames      = 300; // 5 seconds of free player control at start
  _tfOpeningTFStartHealth   = tf ? tf.health : 10000;

  // Player is INVINCIBLE throughout but retains full control for the first 5 seconds.
  // Input lock kicks in at _tfOpeningFreeFrames === 0 (see processInput + updateTFOpeningFight).
  if (typeof players !== 'undefined') {
    for (const p of players) {
      if (!p.isBoss) {
        p.invincible = 99999; // god-mode — TF cannot hurt the player during this cinematic
      }
    }
  }

  spawnParadox(155, GAME_H - 190);
  if (paradoxEntity) paradoxEntity.facing = 1;

  // ── GSAP Timeline: schedule all phase/dialogue/camera events ──────────────
  if (typeof gsap !== 'undefined') {
    if (_tfOpeningGSAPTL) _tfOpeningGSAPTL.kill();

    // Use a proxy object so GSAP can tween numeric properties
    const state = { damagePhase: 0, camZoom: 1.0, camX: GAME_W / 2, camY: GAME_H / 2 };
    _tfOpeningGSAPTL = gsap.timeline({ paused: false });

    // t=0: opening flash + dialogue
    _tfOpeningGSAPTL.call(() => {
      screenShake = Math.max(screenShake, 18);
      if (typeof CinFX !== 'undefined') CinFX.flash('#00ffff', 0.22, 14);
      if (typeof showBossDialogue === 'function')
        showBossDialogue('Two of you? How desperate.', 270);
      // Enable cinematic camera
      cinematicCamOverride = true;
      cinematicZoomTarget  = 1.1;
      cinematicFocusX      = tf ? tf.cx() : GAME_W / 2;
      cinematicFocusY      = GAME_H / 2 - 20;
    });

    // t=3s: phase 1 (250 dmg equiv) — Paradox closes in
    _tfOpeningGSAPTL.call(() => {
      _tfOpeningPhase = 1;
      screenShake = Math.max(screenShake, 12);
      if (typeof showBossDialogue === 'function')
        showBossDialogue('Persistent.', 200);
    }, [], 3);

    // t=6s: phase 2 (650 dmg equiv) — climax
    _tfOpeningGSAPTL.call(() => {
      _tfOpeningPhase = 2;
      screenShake = Math.max(screenShake, 18);
      if (typeof CinFX !== 'undefined') CinFX.flash('#ffffff', 0.18, 10);
      if (typeof showBossDialogue === 'function')
        showBossDialogue("...you're stronger than you look.", 220);
      // Zoom in tighter for climax
      cinematicZoomTarget = 1.3;
    }, [], 6);

    // t=9s: threshold reached — pin TF HP to exactly 1000 below its start value,
    // then hand off to the kicks-paradox-out cinematic.
    _tfOpeningGSAPTL.call(() => {
      if (!tfOpeningFightActive) return;
      const _tf9 = _tfOpeningTFRef;
      if (_tf9) {
        // Always land on exactly startHP - 1000, regardless of free-phase damage
        _tf9.health = Math.max(1, _tfOpeningTFStartHealth - TF_OPENING_DAMAGE_THRESHOLD);
      }
      tfOpeningDamageDealt = TF_OPENING_DAMAGE_THRESHOLD;
    }, [], 9);

  } else {
    // No GSAP fallback: use frame counters (legacy)
    screenShake = Math.max(screenShake, 18);
    if (typeof CinFX !== 'undefined') CinFX.flash('#00ffff', 0.22, 14);
    if (typeof showBossDialogue === 'function')
      showBossDialogue('Two of you? How desperate.', 270);
  }
}

// Called each frame from game loop while opening fight is active.
function updateTFOpeningFight() {
  if (!tfOpeningFightActive || !gameRunning || gameFrozen) return;
  if (gameMode !== 'trueform') return;

  const tf = _tfOpeningTFRef;
  if (!tf || tf.health <= 0) return;

  // ── Free period: player can move/attack for first 2 seconds ──────────────
  if (_tfOpeningFreeFrames > 0) {
    _tfOpeningFreeFrames--;
    // Track any damage the player freely deals during this window
    const freedmg = Math.max(0, _tfOpeningTFStartHealth - tf.health);
    tfOpeningDamageDealt = freedmg;
    // Prevent TF from retaliating — keep it locked during free phase
    tf.attackTimer = Math.max(tf.attackTimer, 1);
    if (paradoxEntity) paradoxEntity.update();
    return; // skip scripted section entirely while player has control
  }

  // ── Scripted phase begins: lock player movement to zero ──────────────────
  if (typeof players !== 'undefined') {
    for (const p of players) {
      if (!p.isBoss) { p.vx = 0; p.invincible = Math.max(p.invincible, 9999); }
    }
  }

  // ── Phase speed/cadence (phase index set by GSAP timeline, not damage count) ─
  // Speed multipliers per phase
  const paradoxSpeed  = [4.5, 5.5, 6.5][_tfOpeningPhase];
  const paradoxCdBase = [90,  58,  34][_tfOpeningPhase];
  const heroCdBase    = [110, 68,  38][_tfOpeningPhase];

  // Keep Paradox alive and updated
  if (!paradoxEntity || paradoxEntity.done) {
    spawnParadox(155, GAME_H - 190);
    if (paradoxEntity) paradoxEntity.facing = 1;
  }
  if (paradoxEntity) paradoxEntity.update();

  // ── Hero scripted behaviour ────────────────────────────────────────────────
  const hero = players && players.find(p => !p.isBoss && !p.isRemote);
  if (hero) {
    const hdx = tf.cx() - hero.cx();
    const heroSign = Math.sign(hdx);

    // Always face TF
    hero.facing = heroSign || hero.facing;

    // Walk toward TF if far; hang back slightly when already close
    if (Math.abs(hdx) > 80) {
      hero.vx = heroSign * (1.8 + _tfOpeningPhase * 0.7);
      _tfOpeningHeroReactDelay = 0;
    } else if (Math.abs(hdx) < 50 && hero.attackTimer <= 0) {
      // Reaction delay: only back off after 6-10 frames in back-off zone
      _tfOpeningHeroReactDelay++;
      if (_tfOpeningHeroReactDelay >= 8) {
        hero.vx = -heroSign * 0.8;
      }
    } else {
      _tfOpeningHeroReactDelay = 0;
    }

    // Occasional phase-appropriate jump to feel alive
    if (hero.onGround && Math.random() < 0.003 + _tfOpeningPhase * 0.003) {
      hero.vy = -14;
    }

    // Periodic scripted attack
    _tfOpeningHeroAtkCd--;
    if (_tfOpeningHeroAtkCd <= 0) {
      if (Math.abs(hdx) >= 95 || hero.attackTimer > 0) {
        // Not in range yet — hold ready (check again next frame)
        _tfOpeningHeroAtkCd = 1;
      } else {
        _tfOpeningHeroAtkCd = heroCdBase + Math.floor(Math.random() * 30);
        // Trigger attack animation
        hero.attackTimer    = 18;
        hero.attackDuration = 18;
        hero.facing         = heroSign || hero.facing;

        // Deal scripted damage to TF
        const heroDmg = 12 + _tfOpeningPhase * 8 + Math.floor(Math.random() * 8);
        tf.health = Math.max(tf.health - heroDmg, 1);
        tfOpeningDamageDealt += heroDmg;

        // TF flinch + micro-knockback
        tf.hurtTimer = 7 + _tfOpeningPhase * 3;
        tf.vx = -heroSign * (2 + _tfOpeningPhase * 1.5);

        // Hit particles
        const hitColor = hero.color || '#ff8800';
        spawnParticles(tf.cx(), tf.cy() - 10, hitColor, 5 + _tfOpeningPhase * 3);
        spawnParticles(tf.cx(), tf.cy() - 10, '#ffffff', 2 + _tfOpeningPhase);
        screenShake = Math.max(screenShake, 5 + _tfOpeningPhase * 4);

        if (settings.dmgNumbers && typeof DamageText !== 'undefined') {
          damageTexts.push(new DamageText(String(heroDmg),
            tf.cx() + (Math.random()-0.5)*28, tf.cy() - 28, hitColor));
        }
      }
    }
  }

  // ── Paradox attack on TF ──────────────────────────────────────────────────
  if (paradoxEntity) {
    const pdx = tf.cx() - paradoxEntity.cx();

    // Smoothed velocity movement — lerp toward target speed to prevent jitter
    const targetVx = Math.abs(pdx) > 55 ? Math.sign(pdx) * paradoxSpeed : 0;
    _paradoxVx += (targetVx - _paradoxVx) * 0.2;
    if (Math.abs(_paradoxVx) > 0.1) {
      paradoxEntity.x += _paradoxVx;
      paradoxEntity.facing = Math.sign(_paradoxVx);
    }

    _tfOpeningParadoxAtkCd--;
    if (_tfOpeningParadoxAtkCd <= 0) {
      if (Math.abs(pdx) >= 130) {
        // Not in range — hold ready, check next frame
        _tfOpeningParadoxAtkCd = 1;
      } else {
        _tfOpeningParadoxAtkCd = paradoxCdBase + Math.floor(Math.random() * 25);
        paradoxEntity.punch(Math.sign(pdx));
        const dmg = 18 + _tfOpeningPhase * 7 + Math.floor(Math.random() * 10);
        tf.health = Math.max(tf.health - dmg, 1);
        tfOpeningDamageDealt += dmg;

        // TF flinch + micro-knockback from Paradox
        tf.hurtTimer = Math.max(tf.hurtTimer, 7 + _tfOpeningPhase * 2);
        tf.vx = Math.sign(pdx) === 1
          ? -Math.abs(tf.vx + 1.5 + _tfOpeningPhase)
          :  Math.abs(tf.vx + 1.5 + _tfOpeningPhase);

        spawnParticles(tf.cx(), tf.cy(), '#00ffff', 6 + _tfOpeningPhase * 2);
        spawnParticles(tf.cx(), tf.cy(), '#ffffff', 3 + _tfOpeningPhase);
        screenShake = Math.max(screenShake, 6 + _tfOpeningPhase * 5);

        if (settings.dmgNumbers && typeof DamageText !== 'undefined') {
          damageTexts.push(new DamageText(String(dmg),
            tf.cx() + (Math.random()-0.5)*30, tf.cy() - 22, '#00ffff'));
        }
      }
    }
  }

  // When threshold reached: TF teleports behind Paradox and punches them out of the stage.
  // Fight then continues normally; Paradox returns later at 1000 HP.
  if (tfOpeningDamageDealt >= TF_OPENING_DAMAGE_THRESHOLD) {
    tfOpeningFightActive = false;
    _tfOpeningTFRef      = null;
    // Kill GSAP timeline so it doesn't fire any more callbacks
    if (_tfOpeningGSAPTL) { _tfOpeningGSAPTL.kill(); _tfOpeningGSAPTL = null; }
    cinematicCamOverride = false;
    // Restore player invincibility to normal (brief window so they land safely)
    if (typeof players !== 'undefined') {
      for (const p of players) {
        if (!p.isBoss) p.invincible = Math.min(p.invincible, 90);
      }
    }
    if (typeof startCinematic === 'function' && typeof _makeTFKicksParadoxOutCinematic === 'function') {
      startCinematic(_makeTFKicksParadoxOutCinematic(tf));
    } else {
      // Fallback: just end the opening phase cleanly
      if (paradoxEntity) paradoxEntity.done = true;
      tfCinematicState = 'none';
    }
  }
}

// ============================================================
// TF KICKS PARADOX OUT  — fires after opening 1000-damage threshold
// TF teleports behind Paradox and punches them off-stage.
// After this cinematic: tfCinematicState = 'none' (fight continues normally).
// ============================================================
function _makeTFKicksParadoxOutCinematic(tf) {
  return {
    durationFrames:   300,  // 5 seconds
    _teleportFired:   false,
    _windupFired:     false,
    _launchFired:     false,
    _phaseLabel: { text: '— ENOUGH —', color: '#ffffff' },

    update(t) {
      if      (t < 0.2) slowMotion = Math.max(0.05, 1 - t * 4.75);
      else if (t > 3.8) slowMotion = Math.min(1.0,  (t - 3.8) / 1.0);
      else              slowMotion = 0.05;

      cinematicCamOverride = t < 4.8;
      if (cinematicCamOverride) {
        cinematicZoomTarget = 1.6;
        const px = paradoxEntity ? paradoxEntity.cx() : GAME_W / 2;
        cinematicFocusX = px;
        cinematicFocusY = GAME_H / 2 - 20;
      }

      // 0.5 s: TF teleports directly behind Paradox
      if (t >= 0.5 && !this._teleportFired) {
        this._teleportFired = true;
        if (tf && paradoxEntity) {
          spawnParticles(tf.cx(), tf.cy(), '#000000', 20);
          spawnParticles(tf.cx(), tf.cy(), '#ffffff', 12);
          const behindX = paradoxEntity.cx() - paradoxEntity.facing * 24 - tf.w / 2;
          tf.x = Math.max(10, Math.min(GAME_W - tf.w - 10, behindX));
          tf.y = paradoxEntity.y;
          tf.vx = 0; tf.vy = 0;
          tf.facing = paradoxEntity.facing;
          spawnParticles(tf.cx(), tf.cy(), '#000000', 20);
          spawnParticles(tf.cx(), tf.cy(), '#ffffff', 12);
          screenShake = Math.max(screenShake, 18);
        }
        if (typeof showBossDialogue === 'function') showBossDialogue("I've seen enough.", 220);
      }

      // 1.2 s: TF winds up punch
      if (t >= 1.2 && !this._windupFired) {
        this._windupFired = true;
        if (tf) { tf.attackTimer = 22; tf.attackDuration = 22; }
        screenShake = Math.max(screenShake, 10);
      }

      // 1.8 s: TF punches Paradox off-stage
      if (t >= 1.8 && !this._launchFired) {
        this._launchFired = true;
        if (paradoxEntity) {
          const launchDir = paradoxEntity.facing;
          spawnParticles(paradoxEntity.cx(), paradoxEntity.cy(), '#00ffff', 45);
          spawnParticles(paradoxEntity.cx(), paradoxEntity.cy(), '#ffffff', 22);
          paradoxEntity._launchVx = launchDir * 28;
          paradoxEntity._launchVy = -16;
        }
        if (typeof CinFX !== 'undefined') CinFX.flash('#ffffff', 0.7, 18);
        screenShake = Math.max(screenShake, 48);
        if (typeof showBossDialogue === 'function')
          showBossDialogue('You are not needed here.', 280);
      }

      // Fly Paradox off-screen after launch
      if (this._launchFired && paradoxEntity && paradoxEntity._launchVx !== undefined) {
        paradoxEntity.x  += paradoxEntity._launchVx;
        paradoxEntity.y  += paradoxEntity._launchVy;
        paradoxEntity._launchVy += 0.5;
        paradoxEntity.alpha = Math.max(0, paradoxEntity.alpha - 0.04);
        if (paradoxEntity.alpha <= 0) paradoxEntity.done = true;
      } else if (paradoxEntity) {
        paradoxEntity.update();
      }
    },

    onEnd() {
      slowMotion           = 1.0;
      cinematicCamOverride = false;
      paradoxEntity        = null;
      tfCinematicState     = 'none'; // main fight resumes normally
      if (tf) {
        tf.x = Math.max(40, Math.min(GAME_W - tf.w - 40, tf.x));
        tf.y = GAME_H - 200;
        tf.vy = 0; tf.vx = 0;
        tf.invincible      = 60;
        tf.postSpecialPause = 3;
      }
    }
  };
}

// ============================================================
// PARADOX RETURN AT 1000 HP  — fires from startTFParadoxReturn1000()
// Sequence: Paradox flashes back → brief joint fight → TF gamma rays
//           → multiversal attacks → execute command → Paradox dies
//           → absorption → dimension punch → Code Realm
// ============================================================
// Helper: reposition TF and hero to a flat, always-visible cinematic stage position
function _snapToCinematicStage(tf, hero) {
  const stageY = GAME_H - 120;
  if (tf)   { tf.x   = GAME_W * 0.65 - tf.w / 2;   tf.y   = stageY - tf.h;   tf.vx = 0; tf.vy = 0; }
  if (hero) { hero.x = GAME_W * 0.28 - hero.w / 2; hero.y = stageY - hero.h; hero.vx = 0; hero.vy = 0; }
}

function startTFParadoxReturn1000(tf) {
  tfCinematicState = 'paradox_death'; // reuse state to suppress normal AI
  if (tf) tf.invincible = 9999;

  // Snap both entities to a guaranteed visible stage position
  const _hero = typeof players !== 'undefined' ? players.find(p => !p.isBoss) : null;
  _snapToCinematicStage(tf, _hero);
  if (_hero) _hero.invincible = Math.max(_hero.invincible || 0, 9999);

  if (typeof showBossDialogue === 'function') showBossDialogue('Not yet.', 200);
  if (typeof startCinematic === 'function') {
    startCinematic(_makeTFParadoxReturn1000Cinematic(tf));
  }
}

function _makeTFParadoxReturn1000Cinematic(tf) {
  return {
    durationFrames:   900,  // 15 seconds — extended for pacing
    _spawnFired:      false,
    _fightFired:      false,
    _fight2Fired:     false,
    _gammaFired:      false,
    _multiAttackFired:false,
    _multiStrike2:    false,
    _multiStrike3:    false,
    _executeFired:    false,
    _collapseFired:   false,
    _paradoxContinuousCd: 0, // frames until next autonomous Paradox attack
    _phaseLabel: { text: '— THE RETURN —', color: '#00ffff' },

    update(t) {
      if      (t < 0.3)  slowMotion = Math.max(0.05, 1 - t * 3.3);
      else if (t > 13.5) slowMotion = Math.min(1.0,  (t - 13.5) / 1.0);
      else               slowMotion = 0.06;

      cinematicCamOverride = t < 14.8;
      if (cinematicCamOverride) {
        const focus = paradoxEntity || tf;
        // Camera shifts focus: start on TF, then to Paradox during gamma, then both
        if (t < 4.0) {
          cinematicZoomTarget = 1.3;
          cinematicFocusX = tf ? tf.cx() : GAME_W / 2;
          cinematicFocusY = GAME_H / 2 - 20;
        } else if (t < 8.0) {
          cinematicZoomTarget = 1.5;
          cinematicFocusX = paradoxEntity ? paradoxEntity.cx() : (tf ? tf.cx() : GAME_W / 2);
          cinematicFocusY = GAME_H / 2 - 30;
        } else {
          cinematicZoomTarget = 1.2;
          cinematicFocusX = GAME_W / 2;
          cinematicFocusY = GAME_H / 2 - 20;
        }
      }

      // 0.6 s: Paradox flashes back in — spawn on cinematic stage next to hero
      if (t >= 0.6 && !this._spawnFired) {
        this._spawnFired = true;
        const _stageY = GAME_H - 120 - 50;
        spawnParadox(GAME_W * 0.20, _stageY);
        if (paradoxEntity) { paradoxEntity.facing = 1; paradoxEntity.vy = 0; }
        if (typeof CinFX !== 'undefined') CinFX.flash('#00ffff', 0.5, 16);
        screenShake = Math.max(screenShake, 20);
        if (typeof showBossDialogue === 'function')
          showBossDialogue("I'm not finished.", 260);
        const _hero = typeof players !== 'undefined' ? players.find(p => !p.isBoss) : null;
        if (_hero) _hero.invincible = Math.max(_hero.invincible || 0, 9999);
      }

      // 1.5 s: Paradox and hero land first scripted hit on TF
      if (t >= 1.5 && !this._fightFired) {
        this._fightFired = true;
        if (paradoxEntity) paradoxEntity.punch(1);
        if (tf) {
          tf.hurtTimer = 12;
          tf.vx        = -4;
          spawnParticles(tf.cx(), tf.cy(), '#00ffff', 22);
          spawnParticles(tf.cx(), tf.cy(), '#ffffff', 12);
          screenShake = Math.max(screenShake, 24);
          if (typeof DamageText !== 'undefined' && settings.dmgNumbers) {
            damageTexts.push(new DamageText('CRITICAL', tf.cx(), tf.cy() - 30, '#00ffff'));
          }
        }
        if (typeof showBossDialogue === 'function')
          showBossDialogue("You can't stop both of us.", 260);
      }

      // 2.8 s: Second coordinated attack burst
      if (t >= 2.8 && !this._fight2Fired) {
        this._fight2Fired = true;
        if (paradoxEntity) paradoxEntity.punch(1);
        const _hero = typeof players !== 'undefined' ? players.find(p => !p.isBoss) : null;
        if (_hero) { _hero.attackTimer = 16; _hero.attackDuration = 16; }
        if (tf) {
          tf.hurtTimer = 10; tf.vx = 3;
          spawnParticles(tf.cx(), tf.cy(), '#ffffff', 16);
          spawnParticles(tf.cx(), tf.cy(), '#ffaa00', 10);
          screenShake = Math.max(screenShake, 18);
        }
        if (typeof CinFX !== 'undefined') CinFX.flash('#ffffff', 0.22, 8);
        if (typeof showBossDialogue === 'function')
          showBossDialogue("End of the line.", 260);
      }

      // 4.5 s: TF turns on Paradox — GAMMA RAY BURST
      if (t >= 4.5 && !this._gammaFired) {
        this._gammaFired = true;
        const gx = tf ? tf.cx() : GAME_W * 0.65;
        const gy = tf ? tf.cy() : GAME_H / 2;
        if (settings.particles) {
          for (let i = 0; i < 80 && particles.length < MAX_PARTICLES; i++) {
            const angle = Math.random() * Math.PI * 2;
            const spd   = 5 + Math.random() * 16;
            const _p    = _getParticle();
            _p.x = gx; _p.y = gy;
            _p.vx = Math.cos(angle) * spd; _p.vy = Math.sin(angle) * spd;
            _p.color = Math.random() < 0.5 ? '#ffff00' : (Math.random() < 0.5 ? '#ffffff' : '#ff8800');
            _p.size  = 2 + Math.random() * 6; _p.life = 40 + Math.random() * 40; _p.maxLife = 80;
            particles.push(_p);
          }
        }
        // Gamma beam visual: large shockwave ring from TF toward Paradox
        if (typeof CinFX !== 'undefined') {
          CinFX.shockwave(gx, gy, '#ffff44', { count: 3, maxR: 340, lw: 6, dur: 55 });
          CinFX.flash('#ffff44', 0.65, 22);
        }
        screenShake = Math.max(screenShake, 44);
        if (typeof showBossDialogue === 'function')
          showBossDialogue('GAMMA RAY BURST — MULTIVERSAL COLLAPSE', 300);
        if (paradoxEntity) {
          paradoxEntity.hurtTimer = 35;
          paradoxEntity.alpha     = 0.5;
          if (cinematicCamOverride) {
            cinematicFocusX = paradoxEntity.cx();
            cinematicFocusY = paradoxEntity.cy() - 30;
          }
        }
        // TF faces Paradox and wind-up
        if (tf && paradoxEntity) {
          tf.facing = Math.sign(paradoxEntity.cx() - tf.cx()) || 1;
          tf.attackTimer = 20; tf.attackDuration = 20;
        }
      }

      // 6.0 s: MULTIVERSAL STRIKE 1 — dimensional lightning bolt at Paradox
      if (t >= 6.0 && !this._multiAttackFired) {
        this._multiAttackFired = true;
        const px = paradoxEntity ? paradoxEntity.cx() : GAME_W * 0.25;
        const py = paradoxEntity ? paradoxEntity.cy() : GAME_H / 2;
        screenShake = Math.max(screenShake, 40);
        if (settings.particles) {
          // Streak from sky → Paradox
          for (let i = 0; i < 50 && particles.length < MAX_PARTICLES; i++) {
            const _p = _getParticle();
            const frac = i / 50;
            _p.x = px + (Math.random() - 0.5) * 30;
            _p.y = py - 200 * (1 - frac) + (Math.random() - 0.5) * 20;
            _p.vx = (Math.random() - 0.5) * 3;
            _p.vy = 4 + Math.random() * 6;
            _p.color = Math.random() < 0.55 ? '#ff00ff' : '#8800ff';
            _p.size  = 2 + Math.random() * 5; _p.life = 20 + Math.random() * 20; _p.maxLife = 40;
            particles.push(_p);
          }
        }
        if (typeof CinFX !== 'undefined') {
          CinFX.shockwave(px, py, '#ff00ff', { count: 2, maxR: 200, lw: 5, dur: 40 });
          CinFX.flash('#ff00ff', 0.50, 16);
        }
        if (typeof showBossDialogue === 'function')
          showBossDialogue('MULTIVERSAL STRIKE — DIMENSIONAL OVERWRITE', 300);
        if (paradoxEntity) { paradoxEntity.hurtTimer = Math.max(paradoxEntity.hurtTimer, 20); }
      }

      // 7.2 s: MULTIVERSAL STRIKE 2 — reality tear
      if (t >= 7.2 && !this._multiStrike2) {
        this._multiStrike2 = true;
        const px2 = paradoxEntity ? paradoxEntity.cx() : GAME_W * 0.25;
        const py2 = paradoxEntity ? paradoxEntity.cy() : GAME_H / 2;
        screenShake = Math.max(screenShake, 36);
        if (settings.particles) {
          for (let i = 0; i < 60 && particles.length < MAX_PARTICLES; i++) {
            const angle = (i / 60) * Math.PI * 2;
            const spd   = 2 + Math.random() * 9;
            const _p    = _getParticle();
            _p.x = px2 + Math.cos(angle) * 20; _p.y = py2 + Math.sin(angle) * 20;
            _p.vx = Math.cos(angle) * spd; _p.vy = Math.sin(angle) * spd;
            _p.color = Math.random() < 0.5 ? '#00ffff' : '#ffffff';
            _p.size  = 1.5 + Math.random() * 4; _p.life = 25 + Math.random() * 25; _p.maxLife = 50;
            particles.push(_p);
          }
        }
        if (typeof CinFX !== 'undefined') {
          CinFX.shockwave(px2, py2, '#00ffff', { count: 2, maxR: 160, lw: 4, dur: 35 });
          CinFX.flash('#00ffff', 0.35, 12);
          CinFX.groundCrack(px2, GAME_H - 120, { count: 8, color: '#00ffff' });
        }
        if (typeof showBossDialogue === 'function')
          showBossDialogue('REALITY TEAR — TIMELINE COLLAPSE', 300);
      }

      // 8.0 s: MULTIVERSAL STRIKE 3 — execute windup
      if (t >= 8.0 && !this._multiStrike3) {
        this._multiStrike3 = true;
        if (tf) {
          tf.attackTimer    = 30;
          tf.attackDuration = 30;
          if (paradoxEntity) tf.facing = Math.sign(paradoxEntity.cx() - tf.cx()) || tf.facing;
        }
        screenShake = Math.max(screenShake, 28);
        if (typeof CinFX !== 'undefined') CinFX.flash('#ff4400', 0.30, 14);
        if (typeof showBossDialogue === 'function')
          showBossDialogue("You've served your purpose. End sequence.", 320);
      }

      // 9.2 s: Execute command — TF charges final blow
      if (t >= 9.2 && !this._executeFired) {
        this._executeFired = true;
        if (tf) {
          tf.attackTimer    = 28;
          tf.attackDuration = 28;
          if (paradoxEntity) tf.facing = Math.sign(paradoxEntity.cx() - tf.cx()) || tf.facing;
        }
        screenShake = Math.max(screenShake, 24);
        if (typeof showBossDialogue === 'function')
          showBossDialogue('EXECUTE: PARADOX_ENTITY.terminate()', 360);
        if (typeof CinFX !== 'undefined') CinFX.flash('#00ff88', 0.35, 14);
      }

      // 11.0 s: Paradox collapses — big final burst
      if (t >= 11.0 && !this._collapseFired) {
        this._collapseFired = true;
        if (paradoxEntity) {
          spawnParticles(paradoxEntity.cx(), paradoxEntity.cy(), '#00ffff', 80);
          spawnParticles(paradoxEntity.cx(), paradoxEntity.cy(), '#ffffff', 40);
          spawnParticles(paradoxEntity.cx(), paradoxEntity.cy(), '#000000', 30);
          if (typeof CinFX !== 'undefined') {
            CinFX.shockwave(paradoxEntity.cx(), paradoxEntity.cy(), '#ffffff', { count: 4, maxR: 300, lw: 5, dur: 60 });
          }
          paradoxEntity.done = true;
        }
        if (typeof CinFX !== 'undefined') CinFX.flash('#ffffff', 0.90, 30);
        screenShake = Math.max(screenShake, 60);
        if (typeof showBossDialogue === 'function') showBossDialogue('...', 280);
      }

      // ── Continuous Paradox movement + attacks (between spawn and gamma ray) ──
      // Paradox actively fights TF — moves toward them and punches on cooldown.
      if (t >= 0.6 && t < 4.5 && paradoxEntity && !paradoxEntity.done && tf) {
        const pdx = tf.cx() - paradoxEntity.cx();
        // Smooth movement toward TF; hang back slightly when in punch range
        const targetVx = Math.abs(pdx) > 60 ? Math.sign(pdx) * 5.5 : 0;
        paradoxEntity.x += targetVx * 0.45;
        paradoxEntity.facing = Math.sign(pdx) || paradoxEntity.facing;

        this._paradoxContinuousCd = (this._paradoxContinuousCd || 0) - 1;
        if (this._paradoxContinuousCd <= 0 && Math.abs(pdx) < 110) {
          this._paradoxContinuousCd = 48 + Math.floor(Math.random() * 20);
          paradoxEntity.punch(Math.sign(pdx));
          // Visual flinch on TF — no actual HP change, cinematic controls that
          tf.hurtTimer = Math.max(tf.hurtTimer, 8);
          tf.vx        = -Math.sign(pdx) * 2.5;
          spawnParticles(tf.cx(), tf.cy(), '#00ffff', 10);
          spawnParticles(tf.cx(), tf.cy(), '#ffffff', 5);
          screenShake = Math.max(screenShake, 8);
        }
      }

      if (paradoxEntity) paradoxEntity.update();
    },

    onEnd() {
      slowMotion           = 1.0;
      cinematicCamOverride = false;
      paradoxEntity        = null;
      _tfKCOverlay         = null;

      // Mark Paradox as dead — required by _startAbsorptionThenPunch guard
      paradoxDeathComplete = true;

      if (tf) {
        tf.invincible       = 60;
        tf.postSpecialPause = 3;
      }

      // Reposition hero safely, then begin absorption → dimension punch → Code Realm
      const hero = typeof players !== 'undefined' ? players.find(p => !p.isBoss) : null;
      if (hero) {
        hero.x  = Math.max(40, tf ? tf.x - 150 : GAME_W * 0.25);
        hero.y  = GAME_H - 72 - hero.h;
        hero.vx = 0; hero.vy = 0;
        hero.invincible = 9999;
      }

      if (hero && typeof startTFAbsorptionScene === 'function') {
        startTFAbsorptionScene(hero, null);
      } else if (hero && typeof _startAbsorptionThenPunch === 'function') {
        _startAbsorptionThenPunch(tf, hero);
      }
    }
  };
}

// ============================================================
// ABSORPTION  — Paradox energy flows into player after portal
// Triggered from _makeTFParadoxEntryCinematic.onEnd()
// ============================================================
function _startAbsorptionThenPunch(boss, hero) {
  // Guard: only start if paradox death cinematic has fully completed
  if (!paradoxDeathComplete) return;
  // Clear any pending dialogue so death-scene lines don't bleed into absorption text
  if (typeof bossDialogue !== 'undefined') bossDialogue.timer = 0;
  _tfAbsorptionState = { timer: 0, boss, hero };
  tfCinematicState   = 'absorption';
  if (hero) hero.invincible = Math.max(hero.invincible || 0, 9999);
  // Freeze game: blocks player input, boss AI, and all hazard damage
  gameFrozen = true;
}

function updateTFAbsorption() {
  if (!_tfAbsorptionState) return;
  const s = _tfAbsorptionState;
  s.timer++;
  const t = s.timer;

  const hx = s.hero ? s.hero.cx() : GAME_W / 2;
  const hy = s.hero ? s.hero.cy() : GAME_H / 2;

  // Particle stream from dissolution point toward hero
  if (t < 120 && settings.particles && particles.length < MAX_PARTICLES) {
    const srcX = GAME_W * 0.55, srcY = GAME_H / 2;
    const lerpT = Math.random();
    const _p = _getParticle();
    _p.x     = srcX + (hx - srcX) * lerpT + (Math.random() - 0.5) * 22;
    _p.y     = srcY + (hy - srcY) * lerpT + (Math.random() - 0.5) * 22;
    _p.vx    = (hx - srcX) / 80 * (1.5 + Math.random());
    _p.vy    = (hy - srcY) / 80 * (1.5 + Math.random());
    _p.color = Math.random() < 0.55 ? '#00ffff' : '#aa44ff';
    _p.size  = 1.5 + Math.random() * 3;
    _p.life  = 12 + Math.random() * 14;
    _p.maxLife = 26;
    particles.push(_p);
  }

  // t=60: big flash + power surge
  if (t === 60) {
    screenShake = Math.max(screenShake, 30);
    if (typeof CinFX !== 'undefined') CinFX.flash('#00ffff', 0.62, 20);
    if (typeof showBossDialogue === 'function')
      showBossDialogue("Paradox is gone. What remains is yours. Use it.", 280);
    if (s.hero && settings.particles) {
      for (let i = 0; i < 40 && particles.length < MAX_PARTICLES; i++) {
        const angle = Math.random() * Math.PI * 2;
        const spd   = 4 + Math.random() * 9;
        const _p    = _getParticle();
        _p.x = hx; _p.y = hy;
        _p.vx = Math.cos(angle) * spd; _p.vy = Math.sin(angle) * spd;
        _p.color = Math.random() < 0.5 ? '#00ffff' : '#ff00ff';
        _p.size  = 2 + Math.random() * 4; _p.life  = 30 + Math.random() * 30; _p.maxLife = 60;
        particles.push(_p);
      }
    }
    playerParadoxAbsorbed = true; // permanent glow flag
  }

  // t=110: explain survival
  if (t === 110) {
    if (typeof showBossDialogue === 'function')
      showBossDialogue("No weapon. No system. Just your hands. Finish it.", 320);
  }

  // t=170: hand off directly to punch cinematic — clear state AFTER startTFEnding
  // takes ownership so there is no gap frame between the two sequences.
  if (t >= 170) {
    if (!absorptionComplete) absorptionComplete = true;
    if (paradoxDeathComplete && absorptionComplete) {
      tfCinematicState = 'punch_transition';
      if (typeof startTFEnding === 'function') {
        startTFEnding(s.boss, true); // true = isIntro mode
      }
      _tfAbsorptionState = null; // clear only after handoff
    }
  }
}

// ============================================================
// ABSORPTION DRAW  — cyan aura on player during and after absorption
// ============================================================
function drawTFAbsorption() {
  if (!_tfAbsorptionState && !playerParadoxAbsorbed) return;

  const hero = _tfAbsorptionState
    ? _tfAbsorptionState.hero
    : (typeof players !== 'undefined' ? players.find(p => !p.isBoss && p.health > 0) : null);
  if (!hero) return;

  const frame = _tfAbsorptionState ? _tfAbsorptionState.timer : (typeof frameCount !== 'undefined' ? frameCount : 0);
  const pulse = 0.55 + Math.sin(frame * 0.15) * 0.45;

  ctx.save();
  if (_tfAbsorptionState) {
    // Active absorption: strong pulsing glow rings
    const intensity = Math.min(1, Math.max(0, (_tfAbsorptionState.timer - 40) / 30));
    if (intensity > 0) {
      for (let i = 0; i < 3; i++) {
        const r = 30 + i * 16 + Math.sin(frame * 0.1 + i * 1.2) * 8;
        ctx.globalAlpha = intensity * pulse * (0.55 - i * 0.14);
        ctx.strokeStyle = i % 2 === 0 ? '#00ffff' : '#aa44ff';
        ctx.lineWidth   = 3 - i * 0.5;
        ctx.shadowColor = '#00ffff';
        ctx.shadowBlur  = 30;
        ctx.beginPath();
        ctx.arc(hero.cx(), hero.cy(), r, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  } else {
    // Permanent subtle glow
    ctx.globalAlpha = pulse * 0.18;
    ctx.strokeStyle = '#00ffff';
    ctx.lineWidth   = 2;
    ctx.shadowColor = '#00ffff';
    ctx.shadowBlur  = 18;
    ctx.beginPath();
    ctx.arc(hero.cx(), hero.cy(), 30, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

// ============================================================
// ABSORPTION CINEMATIC v2  — memory-driven scene
// Phases: fade_in(0-40) → memories(40-130) → merge(130-175) → power_surge(175-210) → done(210+)
// Uses activeCinematic + gameFrozen so no gameplay occurs during the scene.
// Hands off to startTFEnding() when complete.
// ============================================================
function startTFAbsorptionScene(player, paradoxRef) {
  if (tfAbsorptionScene) return; // already running
  // Clear any pending boss dialogue so death-scene lines don't bleed into absorption
  if (typeof bossDialogue !== 'undefined') bossDialogue.timer = 0;
  const boss = typeof players !== 'undefined' ? players.find(p => p.isBoss && p.health > 0) : null;
  tfAbsorptionScene = {
    timer:      0,
    maxTimer:   220,
    playerRef:  player,
    paradoxRef: paradoxRef,
    bossRef:    boss,
    phase:      'fade_in',
    memoryIndex: 0,
    flashAlpha:  0,
    absorbed:    false
  };
  activeCinematic = true;
  gameFrozen      = true;
  tfCinematicState = 'absorption';
  if (player) player.invincible = Math.max(player.invincible || 0, 9999);
}

function updateTFAbsorptionScene() {
  const sc = tfAbsorptionScene;
  if (!sc) return;

  sc.timer++;

  // Keep player frozen
  if (sc.playerRef) {
    sc.playerRef.vx = 0;
    sc.playerRef.vy = 0;
  }

  //--------------------------------------------------
  // PHASE 1 — FADE IN (0–40)
  if (sc.timer < 40) {
    sc.phase = 'fade_in';
    sc.flashAlpha = Math.min(1, sc.timer / 40);
  }

  //--------------------------------------------------
  // PHASE 2 — MEMORY FLASHES (40–140)
  else if (sc.timer < 140) {
    sc.phase = 'memories';

    if (sc.timer % 20 === 0) {
      sc.memoryIndex++;
    }
  }

  //--------------------------------------------------
  // PHASE 3 — MERGE (140–180)
  else if (sc.timer < 180) {
    sc.phase = 'merge';

    // Pull paradox into player
    if (sc.paradoxRef && sc.playerRef) {
      const dx = sc.playerRef.cx() - sc.paradoxRef.cx();
      const dy = sc.playerRef.cy() - sc.paradoxRef.cy();

      sc.paradoxRef.x += dx * 0.08;
      sc.paradoxRef.y += dy * 0.08;
    }
  }

  //--------------------------------------------------
  // PHASE 4 — POWER SURGE (180–210)
  else if (sc.timer < 210) {
    sc.phase = 'power_surge';

    sc.flashAlpha = Math.sin(sc.timer * 0.4) * 0.5 + 0.5;
  }

  //--------------------------------------------------
  // END
  else {
    sc.phase = 'done';

    if (!sc.absorbed) {
      sc.absorbed = true;

      if (sc.playerRef) {
        sc.playerRef.paradoxPowered = true;
      }
    }

    // Hand off directly to punch cinematic — do NOT clear activeCinematic/gameFrozen
    // before startTFEnding runs, or a gap frame will flash between the two cinematics.
    if (typeof startTFEnding === 'function') {
      const _tfEndBoss = players.find(p => p.isBoss);
      startTFEnding(_tfEndBoss, true);
    }
    // Only clear after startTFEnding has taken ownership
    tfAbsorptionScene = null;
    activeCinematic   = false;
  }
}

function drawTFAbsorptionScene() {
  if (!tfAbsorptionScene) return;
  const s  = tfAbsorptionScene;
  const t  = s.timer;
  const hero = s.playerRef;
  if (!hero) return;

  const hx = hero.cx();
  const hy = hero.cy();

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0); // screen-space for overlay

  // Fade-in dark vignette
  if (s.phase === 'fade_in') {
    const a = Math.min(1, t / 40);
    ctx.globalAlpha = a * 0.38;
    ctx.fillStyle = '#000033';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  // Memories + merge: dark overlay behind the scene
  if (s.phase === 'memories' || s.phase === 'merge') {
    const fadeOut = s.phase === 'merge' ? Math.max(0, 1 - (t - 130) / 45) : 1;
    ctx.globalAlpha = 0.50 * fadeOut;
    ctx.fillStyle = '#000022';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  // Back to world-space for rings (drawn on top of fighters)
  ctx.restore();
  ctx.save();

  // Memory text (world-space, centered)
  if (s.phase === 'memories') {
    const memText = _TF_ABSORPTION_MEMORIES[s.memoryIndex] || '';
    const textAge = (t - 40) % 22;
    const textAlpha = textAge < 6 ? textAge / 6 : textAge > 16 ? Math.max(0, 1 - (textAge - 16) / 6) : 1;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = textAlpha * 0.88;
    ctx.font = 'italic 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#00ffff';
    ctx.shadowColor = '#00ffff';
    ctx.shadowBlur = 16;
    ctx.fillText(memText, canvas.width / 2, canvas.height / 2 - 80);
    ctx.restore();
  }

  // Pulsing absorption rings around player (world-space)
  if (s.phase === 'memories' || s.phase === 'merge' || s.phase === 'power_surge') {
    const ringProgress = s.phase === 'memories'
      ? Math.min(1, (t - 40) / 90)
      : s.phase === 'merge'
        ? 1.0
        : Math.max(0, 1 - (t - 175) / 35);
    const pulse = 0.5 + Math.sin(t * 0.18) * 0.5;
    for (let i = 0; i < 3; i++) {
      const r = 28 + i * 18 + Math.sin(t * 0.1 + i * 1.4) * 7;
      ctx.globalAlpha = ringProgress * pulse * (0.60 - i * 0.15);
      ctx.strokeStyle = i % 2 === 0 ? '#00ffff' : '#aa44ff';
      ctx.lineWidth   = 3 - i * 0.6;
      ctx.shadowColor = '#00ffff';
      ctx.shadowBlur  = 22;
      ctx.beginPath();
      ctx.arc(hx, hy, r, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  ctx.restore();
}

// ============================================================
// ABSORPTION SCENE (ctx-param version) — strong visual clarity
// Called from smb-drawing.js / smb-loop.js with explicit ctx arg.
// The no-arg drawTFAbsorptionScene() above handles in-loop calls.
// ============================================================
function drawTFAbsorptionSceneWithCtx(ctx) {
  const sc = tfAbsorptionScene;
  if (!sc) return;

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  // Dark overlay — deepens during flash
  ctx.globalAlpha = 1;
  ctx.fillStyle = `rgba(0,0,0,${0.6 + sc.flashAlpha * 0.4})`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // --------------------------------------------------
  // MEMORY PHASE
  if (sc.phase === 'memories') {
    drawTFAbsorptionMemories(ctx, sc);
  }

  // --------------------------------------------------
  // MERGE EFFECT — purple tint signals convergence
  if (sc.phase === 'merge') {
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = '#aa55ff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  // --------------------------------------------------
  // POWER SURGE — white flash at peak intensity
  if (sc.phase === 'power_surge') {
    ctx.globalAlpha = sc.flashAlpha;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  ctx.restore();
}

// ============================================================
// ABSORPTION MEMORY FLASHES  — Paradox backstory visual flashes
// Shown in sequence during the absorption scene after Paradox dies.
// Each flash is a brief, fragmented glimpse — enough for the player
// to piece together what Paradox was and why it fought.
//
// CANON: Paradox was constructed during the multiversal war to fight
// beside Axiom. An error in its design caused it to turn against
// everything. It was not malicious — it was broken. It has been
// fighting since the error, unable to stop.
// ============================================================
function drawTFAbsorptionMemories(ctx, sc) {
  // Cycle through 7 memories (length of _TF_ABSORPTION_MEMORIES)
  const t = sc.memoryIndex % 7;

  ctx.save();
  ctx.globalAlpha = 0.72;

  switch (t) {

    case 0:
      // Flash 1: Construction — clean, cold, clinical. Paradox was made deliberately.
      ctx.font = 'bold 13px monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#aaddff';
      ctx.shadowColor = '#aaddff';
      ctx.shadowBlur = 10;
      ctx.fillText('UNIT DESIGNATION: PARADOX', GAME_W / 2, GAME_H / 2 - 20);
      ctx.fillText('PURPOSE: COMBAT AUXILIARY', GAME_W / 2, GAME_H / 2);
      ctx.fillText('CREATOR: AXIOM', GAME_W / 2, GAME_H / 2 + 20);
      break;

    case 1:
      // Flash 2: Paradox and Axiom, side by side.
      // Two stickman silhouettes standing together.
      ctx.fillStyle = '#aaddff';
      ctx.shadowColor = '#aaddff';
      ctx.shadowBlur = 14;
      // Axiom (left)
      const ax = GAME_W / 2 - 40;
      ctx.beginPath(); ctx.arc(ax, GAME_H / 2 - 55, 7, 0, Math.PI * 2); ctx.fill();
      ctx.lineWidth = 2.5; ctx.strokeStyle = '#aaddff';
      ctx.beginPath();
      ctx.moveTo(ax, GAME_H / 2 - 48); ctx.lineTo(ax, GAME_H / 2 - 22);
      ctx.moveTo(ax - 12, GAME_H / 2 - 40); ctx.lineTo(ax + 12, GAME_H / 2 - 40);
      ctx.moveTo(ax, GAME_H / 2 - 22); ctx.lineTo(ax - 9, GAME_H / 2 - 5);
      ctx.moveTo(ax, GAME_H / 2 - 22); ctx.lineTo(ax + 9, GAME_H / 2 - 5);
      ctx.stroke();
      ctx.font = '11px sans-serif'; ctx.fillStyle = '#aaddff';
      ctx.fillText('AXIOM', ax, GAME_H / 2 - 70);
      // Paradox (right) — slightly glitched outline
      const px2 = GAME_W / 2 + 40;
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = '#aa55ff'; ctx.shadowColor = '#aa55ff'; ctx.shadowBlur = 18;
      ctx.beginPath(); ctx.arc(px2, GAME_H / 2 - 55, 7, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#aa55ff';
      ctx.beginPath();
      ctx.moveTo(px2, GAME_H / 2 - 48); ctx.lineTo(px2, GAME_H / 2 - 22);
      ctx.moveTo(px2 - 12, GAME_H / 2 - 40); ctx.lineTo(px2 + 12, GAME_H / 2 - 40);
      ctx.moveTo(px2, GAME_H / 2 - 22); ctx.lineTo(px2 - 9, GAME_H / 2 - 5);
      ctx.moveTo(px2, GAME_H / 2 - 22); ctx.lineTo(px2 + 9, GAME_H / 2 - 5);
      ctx.stroke();
      ctx.font = '11px sans-serif'; ctx.fillStyle = '#aa55ff';
      ctx.fillText('PARADOX', px2, GAME_H / 2 - 70);
      break;

    case 2:
      // Flash 3: The error — red diagnostic text, glitchy
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ff4444';
      ctx.shadowColor = '#ff4444';
      ctx.shadowBlur = 20;
      ctx.fillText('CRITICAL ERROR', GAME_W / 2, GAME_H / 2 - 22);
      ctx.globalAlpha = 0.5;
      ctx.font = '11px monospace';
      ctx.fillStyle = '#ff8888';
      ctx.fillText('LOYALTY DIRECTIVE: CORRUPTED', GAME_W / 2, GAME_H / 2 + 2);
      ctx.fillText('TARGET LOCK: ALL', GAME_W / 2, GAME_H / 2 + 20);
      break;

    case 3:
      // Flash 4: Paradox turns — silhouette facing away, hostile aura
      ctx.strokeStyle = '#ff4444';
      ctx.lineWidth = 2.5;
      ctx.shadowColor = '#ff4444';
      ctx.shadowBlur = 22;
      // Paradox silhouette facing away (mirrored arms — aggressive stance)
      const px3 = GAME_W / 2;
      ctx.fillStyle = '#ff4444';
      ctx.beginPath(); ctx.arc(px3, GAME_H / 2 - 55, 7, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(px3, GAME_H / 2 - 48); ctx.lineTo(px3, GAME_H / 2 - 20);
      ctx.moveTo(px3 - 16, GAME_H / 2 - 36); ctx.lineTo(px3 + 16, GAME_H / 2 - 36); // arms wide
      ctx.moveTo(px3, GAME_H / 2 - 20); ctx.lineTo(px3 - 10, GAME_H / 2 - 4);
      ctx.moveTo(px3, GAME_H / 2 - 20); ctx.lineTo(px3 + 10, GAME_H / 2 - 4);
      ctx.stroke();
      ctx.font = '11px monospace'; ctx.textAlign = 'center';
      ctx.fillStyle = '#ff6666'; ctx.globalAlpha = 0.6;
      ctx.fillText('TARGET: AXIOM', px3, GAME_H / 2 + 14);
      break;

    case 4:
      // Flash 5: A voice — first person. Brief. Incomplete.
      ctx.font = 'italic 15px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ccaaff';
      ctx.shadowColor = '#aa55ff';
      ctx.shadowBlur = 16;
      ctx.fillText('"I was not supposed to be the enemy."', GAME_W / 2, GAME_H / 2);
      break;

    case 5:
      // Flash 6: The war — Paradox fighting alone, endless. Abstract.
      ctx.font = 'bold 20px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ff8844';
      ctx.shadowColor = '#ff6600';
      ctx.shadowBlur = 18;
      ctx.fillText('FIGHT.', GAME_W / 2, GAME_H / 2 - 10);
      ctx.globalAlpha = 0.4;
      ctx.font = '11px monospace';
      ctx.fillStyle = '#ffaa66';
      ctx.fillText('ITERATION: ???', GAME_W / 2, GAME_H / 2 + 16);
      break;

    case 6:
      // Flash 7: The end. Final words. Fades with purpose.
      ctx.font = 'italic 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#88ccff';
      ctx.shadowColor = '#44aaff';
      ctx.shadowBlur = 14;
      ctx.fillText('"Remember what I was before the mistake."', GAME_W / 2, GAME_H / 2);
      break;
  }

  ctx.restore();
}

// ============================================================
// TF-KILLS-PARADOX OVERLAY  — update + draw helpers
// ============================================================
function updateTFKCOverlay() {
  if (!_tfKCOverlay) return;
  const o = _tfKCOverlay;
  o.frame = (o.frame || 0) + 1;

  // Fade distortion lines
  for (let i = o.distortLines.length - 1; i >= 0; i--) {
    o.distortLines[i].alpha -= 0.028;
    if (o.distortLines[i].alpha <= 0) o.distortLines.splice(i, 1);
  }

  // Fade reality tears
  for (let i = o.realityTears.length - 1; i >= 0; i--) {
    o.realityTears[i].alpha -= 0.022;
    if (o.realityTears[i].alpha <= 0) o.realityTears.splice(i, 1);
  }

  // Slide terminal panel in
  if (o.termVisible && o.termSlide < 1) {
    o.termSlide = Math.min(1, (o.termSlide || 0) + 0.075);
  }

  // Terminal cursor blink
  o.termCursorTimer = (o.termCursorTimer || 0) + 1;

  // Terminal typing: advance reveal counts
  if (o.termLines) {
    o.termTimer = (o.termTimer || 0) + 1;
    for (const line of o.termLines) {
      if (line.isProgress) continue;
      if (o.termTimer >= line.delay && line.revealCount < line.text.length) {
        line.revealCount = Math.min(line.text.length, line.revealCount + 2);
      }
    }
    // Progress bar
    if (o.termProgressStart !== undefined && o.termTimer >= o.termProgressStart && o.termProgress < 100) {
      o.termProgress = Math.min(100, (o.termProgress || 0) + (100 / 72));
    }
  }
}

function drawTFKCOverlay() {
  if (!_tfKCOverlay) return;
  const o = _tfKCOverlay;
  const frame = o.frame || 0;

  // ── WORLD SPACE: lock rings around Paradox ──────────────────
  if (o.lockActive && paradoxEntity && (o.lockAlpha || 0) > 0) {
    const px = paradoxEntity.cx();
    const py = paradoxEntity.cy();
    const pulse = 0.6 + Math.sin(frame * 0.18) * 0.4;
    ctx.save();
    for (let i = 0; i < 3; i++) {
      const r = 28 + i * 14 + Math.sin(frame * 0.12 + i) * 4;
      ctx.globalAlpha = o.lockAlpha * pulse * (1 - i * 0.25);
      ctx.strokeStyle = i % 2 === 0 ? '#00ffff' : '#aa44ff';
      ctx.lineWidth   = 3 - i * 0.7;
      ctx.shadowColor = '#00ffff';
      ctx.shadowBlur  = 14;
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    // Rotating tick marks (lock teeth)
    ctx.globalAlpha = o.lockAlpha * 0.7;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth   = 2;
    ctx.shadowBlur  = 6;
    const outerR = 56;
    for (let ti = 0; ti < 8; ti++) {
      const angle = (ti / 8) * Math.PI * 2 + frame * 0.04;
      const x1 = px + Math.cos(angle) * (outerR - 5);
      const y1 = py + Math.sin(angle) * (outerR - 5);
      const x2 = px + Math.cos(angle) * (outerR + 5);
      const y2 = py + Math.sin(angle) * (outerR + 5);
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    }
    ctx.restore();
  }

  // ── SCREEN SPACE ────────────────────────────────────────────
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const sw = canvas.width, sh = canvas.height;

  // Horizontal energy distortion lines
  for (const dl of o.distortLines) {
    if (dl.alpha <= 0) continue;
    ctx.save();
    ctx.globalAlpha = dl.alpha;
    ctx.strokeStyle = dl.color;
    ctx.lineWidth   = dl.width;
    ctx.shadowColor = dl.color;
    ctx.shadowBlur  = 8;
    ctx.beginPath();
    ctx.moveTo(dl.x1 * sw, dl.y * sh);
    ctx.lineTo(dl.x2 * sw, dl.y * sh);
    ctx.stroke();
    ctx.restore();
  }

  // Vertical reality tear cracks
  for (const rt of o.realityTears) {
    if (rt.alpha <= 0) continue;
    ctx.save();
    const cx = rt.x * sw;
    // Wide bleed glow first
    ctx.globalAlpha = rt.alpha * 0.35;
    ctx.strokeStyle = '#ff00ff';
    ctx.lineWidth   = 10;
    ctx.shadowColor = '#aa00ff';
    ctx.shadowBlur  = 28;
    ctx.beginPath();
    ctx.moveTo(cx, sh * 0.08);
    let cy2 = sh * 0.08;
    while (cy2 < sh * 0.92) {
      cy2 += sh * 0.06;
      ctx.lineTo(cx + Math.sin(cy2 * rt.seed * 0.01) * sw * 0.012, cy2);
    }
    ctx.stroke();
    // Sharp white crack on top
    ctx.globalAlpha = rt.alpha;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth   = 1.5;
    ctx.shadowBlur  = 0;
    ctx.beginPath();
    cy2 = sh * 0.08;
    ctx.moveTo(cx, cy2);
    while (cy2 < sh * 0.92) {
      cy2 += sh * 0.06;
      ctx.lineTo(cx + Math.sin(cy2 * rt.seed * 0.01) * sw * 0.012, cy2);
    }
    ctx.stroke();
    ctx.restore();
  }

  // Terminal panel
  if (o.termVisible && o.termLines) {
    const slide   = o.termSlide || 0;
    const panW    = Math.round(sw * 0.33);
    const panH    = Math.round(sh * 0.31);
    const panX    = sw - panW - Math.round(sw * 0.02) + Math.round((1 - slide) * (panW + 50));
    const panY    = Math.round(sh * 0.06);
    const lineH   = Math.round(panH / (o.termLines.length + 2.5));
    const fSize   = Math.max(9, Math.round(sw * 0.012));

    ctx.save();
    // Background
    ctx.globalAlpha = 0.93 * slide;
    ctx.fillStyle   = '#000c12';
    ctx.strokeStyle = '#00ffcc';
    ctx.lineWidth   = 2;
    ctx.shadowColor = '#00ffcc';
    ctx.shadowBlur  = 20;
    ctx.beginPath();
    ctx.rect(panX, panY, panW, panH);
    ctx.fill();
    ctx.stroke();

    // Header bar
    ctx.shadowBlur  = 0;
    ctx.fillStyle   = '#00281c';
    ctx.fillRect(panX + 1, panY + 1, panW - 2, Math.round(lineH * 1.25));

    ctx.globalAlpha = slide;
    ctx.fillStyle   = '#00ffcc';
    ctx.font        = `bold ${fSize}px monospace`;
    ctx.textAlign   = 'left';
    ctx.shadowColor = '#00ffcc';
    ctx.shadowBlur  = 8;
    ctx.fillText('  REALITY.EXE  v\u221e.0', panX + 10, panY + Math.round(lineH * 0.88));

    // Separator line
    ctx.globalAlpha = 0.45 * slide;
    ctx.strokeStyle = '#00ffcc';
    ctx.lineWidth   = 1;
    ctx.shadowBlur  = 0;
    ctx.beginPath();
    ctx.moveTo(panX, panY + Math.round(lineH * 1.25));
    ctx.lineTo(panX + panW, panY + Math.round(lineH * 1.25));
    ctx.stroke();

    // Lines
    ctx.font      = `${fSize}px monospace`;
    ctx.textAlign = 'left';
    for (let li = 0; li < o.termLines.length; li++) {
      const line = o.termLines[li];
      const ly   = panY + Math.round(lineH * (li + 2.15));

      // Progress bar (special)
      if (line.isProgress) {
        const prog  = Math.min(1, (o.termProgress || 0) / 100);
        if (prog <= 0) continue;
        const barW  = Math.round(panW * 0.60);
        const barX  = panX + 14;
        const barY2 = ly - Math.round(fSize * 0.75);
        const barH2 = Math.round(fSize * 1.05);
        ctx.globalAlpha = slide;
        ctx.fillStyle   = '#001a0f';
        ctx.fillRect(barX, barY2, barW, barH2);
        ctx.fillStyle   = prog >= 1 ? '#ff3344' : '#00ffcc';
        ctx.fillRect(barX, barY2, Math.round(barW * prog), barH2);
        ctx.strokeStyle = '#00ffcc';
        ctx.lineWidth   = 1;
        ctx.strokeRect(barX, barY2, barW, barH2);
        ctx.fillStyle   = '#ffffff';
        ctx.shadowBlur  = 0;
        ctx.fillText(`  ${Math.round((o.termProgress || 0))}%`, barX + barW + 6, ly);
        continue;
      }

      if (line.revealCount <= 0) continue;
      const revealed = line.text.substring(0, line.revealCount);
      ctx.globalAlpha = slide;
      ctx.fillStyle   = line.color || '#00ffcc';
      ctx.shadowColor = line.color || '#00ffcc';
      ctx.shadowBlur  = 5;
      ctx.fillText(revealed, panX + 14, ly);

      // Blinking cursor on actively-typing line
      if (line.revealCount < line.text.length && Math.floor((o.termCursorTimer || 0) / 14) % 2 === 0) {
        const tw = ctx.measureText(revealed).width;
        ctx.fillStyle  = '#00ffcc';
        ctx.shadowBlur = 0;
        ctx.fillRect(panX + 14 + tw + 1, ly - Math.round(fSize * 0.85), 5, fSize);
      }
    }
    ctx.restore();
  }

  ctx.restore(); // end screen-space
}

// ============================================================
// _makeTFKillsParadoxCinematic  — TrueForm executes Paradox
// 600 frames / 10 seconds. Fires when opening-fight threshold is reached.
// Sequence: lock → teleport strikes → command terminal → collapse →
//           energy stream → absorption pulse → onEnd → absorption phase
// ============================================================
function _makeTFKillsParadoxCinematic(tf) {
  return {
    durationFrames:   600,
    _paradoxSpawned:  false,
    _lockFired:       false,
    _prevPX:          0,
    _prevPY:          0,
    _strike1Fired:    false,
    _strike2Fired:    false,
    _strike3Fired:    false,
    _termFired:       false,
    _collapseFired:   false,
    _streamFired:     false,
    _absorptionFired: false,
    _phaseLabel: { text: '\u2014 TERMINAL SEQUENCE \u2014', color: '#00ffcc' },

    update(t) {
      // ── slow-motion envelope ──────────────────────────────────
      if      (t < 0.4) slowMotion = Math.max(0.06, 1 - t * 2.4);
      else if (t > 9.3) slowMotion = Math.min(1.0,  (t - 9.3) / 0.7);
      else              slowMotion = 0.06;

      // Manually tick TF attack animation (gameFrozen skips Fighter.update())
      if (tf && tf.attackTimer > 0) {
        tf.attackTimer--;
        tf.state = tf.attackTimer > 0 ? 'attacking' : 'idle';
      }
      if (paradoxEntity) paradoxEntity.update();

      // ── camera ───────────────────────────────────────────────
      cinematicCamOverride = (t < 9.8);
      if (cinematicCamOverride && tf) {
        const tgt = t < 4 ? 1.45 : t < 7 ? 1.55 : 1.3;
        cinematicZoomTarget = Math.min((cinematicZoomTarget || 1) + 0.012, tgt);
        cinematicFocusX     = tf.cx ? tf.cx() : GAME_W / 2;
        cinematicFocusY     = (tf.cy ? tf.cy() : GAME_H / 2) - 15;
      }

      // ── 0.5s: spawn Paradox, init overlay ────────────────────
      if (t >= 0.5 && !this._paradoxSpawned) {
        this._paradoxSpawned = true;
        if (!paradoxEntity) spawnParadox(200, GAME_H - 200);
        if (paradoxEntity) paradoxEntity.facing = 1;
        if (tf && paradoxEntity) tf.facing = Math.sign(paradoxEntity.cx() - tf.cx()) || 1;
        _tfKCOverlay = {
          frame: 0, lockActive: false, lockAlpha: 0,
          distortLines: [], realityTears: [],
          termVisible: false, termSlide: 0, termLines: null,
          termTimer: 0, termProgress: 0, termProgressStart: 0,
          termCursorTimer: 0,
        };
        if (typeof showBossDialogue === 'function')
          showBossDialogue('You cannot run.', 210);
      }

      // ── 0.8s: LOCK — Paradox frozen in place ─────────────────
      if (t >= 0.8 && !this._lockFired) {
        this._lockFired = true;
        if (paradoxEntity) {
          this._prevPX = paradoxEntity.x;
          this._prevPY = paradoxEntity.y;
          paradoxEntity.vx = 0;
          paradoxEntity.vy = 0;
        }
        if (_tfKCOverlay) _tfKCOverlay.lockActive = true;
        if (typeof CinFX !== 'undefined') { CinFX.shake(10); CinFX.flash('#00ffff', 0.26, 12); }
        if (paradoxEntity) spawnParticles(paradoxEntity.cx(), paradoxEntity.cy(), '#00ffff', 18);
      }

      // Pin Paradox while locked (until strike 1)
      if (this._lockFired && !this._strike1Fired && paradoxEntity) {
        paradoxEntity.vx = 0;
        paradoxEntity.vy = 0;
        paradoxEntity.x  = this._prevPX;
        paradoxEntity.y  = this._prevPY;
      }

      // Fade lock-ring alpha in
      if (_tfKCOverlay && _tfKCOverlay.lockActive && (t < 7.3)) {
        _tfKCOverlay.lockAlpha = Math.min(1, (_tfKCOverlay.lockAlpha || 0) + 0.05);
      }

      // ── 1.5s: STRIKE 1 — TF teleports BEHIND Paradox ────────
      if (t >= 1.5 && !this._strike1Fired) {
        this._strike1Fired = true;
        if (tf && paradoxEntity) {
          spawnParticles(tf.cx(), tf.cy(), '#000000', 14);
          spawnParticles(tf.cx(), tf.cy(), '#ffffff',  8);
          tf.x      = paradoxEntity.cx() + 14;
          tf.y      = paradoxEntity.y;
          tf.vy     = 0;
          tf.facing = -1;
          tf.state          = 'attacking';
          tf._attackMode    = 'punch';
          tf.attackTimer    = 18;
          tf.attackDuration = 18;
          paradoxEntity.facing = 1;
          paradoxEntity.vx = 0;
          paradoxEntity.vy = -4;
          spawnParticles(tf.cx(), tf.cy(), '#00ffff', 22);
          spawnParticles(tf.cx(), tf.cy(), '#ffffff', 10);
          this._prevPX = paradoxEntity.cx();
          this._prevPY = paradoxEntity.cy();
        }
        if (typeof CinFX !== 'undefined') { CinFX.shake(22); CinFX.flash('#00ffff', 0.40, 10); }
        // Energy distortion lines
        if (_tfKCOverlay) {
          for (let i = 0; i < 5; i++) {
            _tfKCOverlay.distortLines.push({
              y: 0.15 + Math.random() * 0.70, x1: Math.random() * 0.3, x2: 0.6 + Math.random() * 0.4,
              alpha: 0.6 + Math.random() * 0.3,
              color: Math.random() < 0.5 ? '#00ffcc' : '#ffffff',
              width: 1 + Math.random() * 2,
            });
          }
        }
      }

      // ── 2.3s: STRIKE 2 — TF teleports ABOVE Paradox ─────────
      if (t >= 2.3 && !this._strike2Fired) {
        this._strike2Fired = true;
        if (tf && paradoxEntity) {
          spawnParticles(tf.cx(), tf.cy(), '#000000', 14);
          tf.x      = paradoxEntity.cx() - tf.w / 2;
          tf.y      = paradoxEntity.y - 60;
          tf.vy     = 6;
          tf.facing = 1;
          tf.state          = 'attacking';
          tf._attackMode    = 'kick';
          tf.attackTimer    = 22;
          tf.attackDuration = 22;
          paradoxEntity.vx = (Math.random() - 0.5) * 3;
          paradoxEntity.vy = 5;
          spawnParticles(paradoxEntity.cx(), paradoxEntity.cy(), '#ffffff', 18);
          spawnParticles(paradoxEntity.cx(), paradoxEntity.cy(), '#aa44ff', 10);
          this._prevPX = paradoxEntity.cx();
          this._prevPY = paradoxEntity.cy();
        }
        if (typeof CinFX !== 'undefined') { CinFX.shake(28); CinFX.flash('#ffffff', 0.35, 10); }
        if (typeof showBossDialogue === 'function')
          showBossDialogue('Every timeline checked\u2026 you lose.', 230);
        // Reality tear cracks
        if (_tfKCOverlay) {
          _tfKCOverlay.realityTears.push({ x: 0.35 + Math.random() * 0.30, alpha: 0.80, seed: Math.random() * 10 });
          _tfKCOverlay.realityTears.push({ x: 0.55 + Math.random() * 0.20, alpha: 0.55, seed: Math.random() * 10 });
        }
      }

      // ── 3.0s: STRIKE 3 — Multiversal final blow ──────────────
      if (t >= 3.0 && !this._strike3Fired) {
        this._strike3Fired = true;
        if (tf && paradoxEntity) {
          spawnParticles(tf.cx(), tf.cy(), '#000000', 18);
          tf.x      = paradoxEntity.cx() - tf.w - 6;
          tf.y      = paradoxEntity.y;
          tf.vy     = 0;
          tf.facing = 1;
          tf.state          = 'attacking';
          tf._attackMode    = 'punch';
          tf.attackTimer    = 26;
          tf.attackDuration = 26;
          paradoxEntity.facing = -1;
          paradoxEntity.vx = 0;
          paradoxEntity.vy = -2;
          this._prevPX = paradoxEntity.cx();
          this._prevPY = paradoxEntity.cy();
        }
        if (paradoxEntity && settings.particles) {
          for (let i = 0; i < 55 && particles.length < MAX_PARTICLES; i++) {
            const angle = Math.random() * Math.PI * 2;
            const spd   = 6 + Math.random() * 14;
            const _p    = _getParticle();
            _p.x  = paradoxEntity.cx(); _p.y  = paradoxEntity.cy();
            _p.vx = Math.cos(angle) * spd; _p.vy = Math.sin(angle) * spd;
            _p.color   = ['#00ffff','#ffffff','#ff00ff','#aa44ff'][Math.floor(Math.random() * 4)];
            _p.size    = 2 + Math.random() * 5;
            _p.life    = 35 + Math.random() * 35;
            _p.maxLife = 70;
            particles.push(_p);
          }
        }
        if (typeof CinFX !== 'undefined') { CinFX.shake(45); CinFX.flash('#ffffff', 0.88, 14); }
        if (typeof showBossDialogue === 'function')
          showBossDialogue('This is where it ends.', 240);
        // More distortion + extra tear
        if (_tfKCOverlay) {
          for (let i = 0; i < 8; i++) {
            _tfKCOverlay.distortLines.push({
              y: Math.random(), x1: 0, x2: 1,
              alpha: 0.5 + Math.random() * 0.4,
              color: Math.random() < 0.5 ? '#ff00ff' : '#00ffff',
              width: 1 + Math.random() * 3,
            });
          }
          _tfKCOverlay.realityTears.push({ x: 0.1 + Math.random() * 0.8, alpha: 1.0, seed: Math.random() * 10 });
        }
      }

      // ── 3.8s: command-line terminal panel opens ───────────────
      if (t >= 3.8 && !this._termFired) {
        this._termFired = true;
        if (_tfKCOverlay) {
          _tfKCOverlay.termVisible        = true;
          _tfKCOverlay.termSlide          = 0;
          _tfKCOverlay.termTimer          = 0;
          _tfKCOverlay.termProgress       = 0;
          _tfKCOverlay.termProgressStart  = 145; // progress bar starts ~2.4s after panel opens
          _tfKCOverlay.termLines = [
            { text: '> query --entity PARADOX',                         color: '#00ffcc', delay: 0,   revealCount: 0 },
            { text: '  FOUND: 1 instance  [ID: \u03c8-\u221e]',         color: '#aaffee', delay: 42,  revealCount: 0 },
            { text: '> entity.destroy(--all-timelines --force)',         color: '#00ffcc', delay: 85,  revealCount: 0 },
            { text: '', isProgress: true, delay: 145, revealCount: 1,   color: '#ffff00' },
            { text: '  STATUS: TERMINATED \u2713',                       color: '#ff3344', delay: 230, revealCount: 0 },
          ];
        }
        if (typeof showBossDialogue === 'function')
          showBossDialogue('Every version. Every timeline.', 260);
      }

      // While terminal active: Paradox glitches and tracks center for collapse
      if (this._termFired && !this._collapseFired && paradoxEntity) {
        paradoxEntity.vx = 0;
        paradoxEntity.vy = 0;
        if (paradoxEntity._glitchTick <= 0) {
          paradoxEntity._glitchTick = 2 + Math.floor(Math.random() * 5);
          paradoxEntity._glitchX    = (Math.random() - 0.5) * 28;
        }
        this._prevPX = paradoxEntity.cx();
        this._prevPY = paradoxEntity.cy();
      }

      // ── 7.0s: COLLAPSE — Paradox destroyed ───────────────────
      if (t >= 7.0 && !this._collapseFired) {
        this._collapseFired = true;
        const px = this._prevPX || (paradoxEntity ? paradoxEntity.cx() : GAME_W / 2);
        const py = this._prevPY || (paradoxEntity ? paradoxEntity.cy() : GAME_H / 2);
        if (paradoxEntity) paradoxEntity.done = true;
        if (typeof CinFX !== 'undefined') { CinFX.flash('#ffffff', 0.95, 18); CinFX.shake(50); }
        if (settings.particles) {
          for (let i = 0; i < 80 && particles.length < MAX_PARTICLES; i++) {
            const angle = Math.random() * Math.PI * 2;
            const spd   = 3 + Math.random() * 18;
            const _p    = _getParticle();
            _p.x  = px + (Math.random() - 0.5) * 30; _p.y  = py + (Math.random() - 0.5) * 30;
            _p.vx = Math.cos(angle) * spd; _p.vy = Math.sin(angle) * spd;
            _p.color   = ['#00ffff','#ffffff','#ff00ff','#aaaaff'][Math.floor(Math.random() * 4)];
            _p.size    = 2 + Math.random() * 6;
            _p.life    = 40 + Math.random() * 40;
            _p.maxLife = 80;
            particles.push(_p);
          }
        }
        if (typeof showBossDialogue === 'function') showBossDialogue('Erased.', 200);
        // Force terminal to show TERMINATED immediately
        if (_tfKCOverlay && _tfKCOverlay.termLines) {
          const last = _tfKCOverlay.termLines[_tfKCOverlay.termLines.length - 1];
          if (last) last.revealCount = last.text.length;
          _tfKCOverlay.termProgress = 100;
        }
      }

      // ── 7.5s: terminal closes ────────────────────────────────
      if (t >= 7.5 && _tfKCOverlay && _tfKCOverlay.termVisible) {
        _tfKCOverlay.termVisible = false;
      }

      // ── 8.2s: energy streams from Paradox remains → player ───
      if (t >= 8.2 && !this._streamFired) {
        this._streamFired = true;
        if (_tfKCOverlay) _tfKCOverlay.lockActive = false;
        const hero = typeof players !== 'undefined' ? players.find(p => !p.isBoss && p.health > 0) : null;
        if (hero) hero.invincible = Math.max(hero.invincible || 0, 9999);
        if (typeof showBossDialogue === 'function')
          showBossDialogue('Their energy\u2026 it\u2019s yours now.', 240);
      }

      // Continuous stream particles (t 8.2 – 9.3)
      if (this._streamFired && !this._absorptionFired && settings.particles && particles.length < MAX_PARTICLES) {
        const hero = typeof players !== 'undefined' ? players.find(p => !p.isBoss && p.health > 0) : null;
        const hx   = hero ? hero.cx() : GAME_W / 2;
        const hy   = hero ? hero.cy() : GAME_H / 2;
        for (let i = 0; i < 3 && particles.length < MAX_PARTICLES; i++) {
          const lerpT = Math.random();
          const _p    = _getParticle();
          _p.x  = this._prevPX + (hx - this._prevPX) * lerpT + (Math.random() - 0.5) * 18;
          _p.y  = this._prevPY + (hy - this._prevPY) * lerpT + (Math.random() - 0.5) * 18;
          _p.vx = (hx - this._prevPX) / 80 * (1.5 + Math.random());
          _p.vy = (hy - this._prevPY) / 80 * (1.5 + Math.random());
          _p.color   = Math.random() < 0.6 ? '#00ffff' : '#aa44ff';
          _p.size    = 1.5 + Math.random() * 2.5;
          _p.life    = 14 + Math.random() * 12;
          _p.maxLife = 26;
          particles.push(_p);
        }
      }

      // ── 9.3s: absorption pulse — player gains Paradox power ──
      if (t >= 9.3 && !this._absorptionFired) {
        this._absorptionFired = true;
        playerParadoxAbsorbed = true;
        const hero = typeof players !== 'undefined' ? players.find(p => !p.isBoss && p.health > 0) : null;
        if (hero && settings.particles) {
          for (let i = 0; i < 50 && particles.length < MAX_PARTICLES; i++) {
            const angle = Math.random() * Math.PI * 2;
            const spd   = 5 + Math.random() * 10;
            const _p    = _getParticle();
            _p.x  = hero.cx(); _p.y = hero.cy();
            _p.vx = Math.cos(angle) * spd; _p.vy = Math.sin(angle) * spd;
            _p.color   = Math.random() < 0.55 ? '#00ffff' : '#ff00ff';
            _p.size    = 2 + Math.random() * 4;
            _p.life    = 30 + Math.random() * 30;
            _p.maxLife = 60;
            particles.push(_p);
          }
        }
        if (typeof CinFX !== 'undefined') { CinFX.flash('#00ffff', 0.55, 22); CinFX.shake(28); }
        if (typeof showBossDialogue === 'function')
          showBossDialogue('You carry a piece of the multiverse. That is why you survive.', 300);
      }

      // Tick Paradox entity (fade/glitch)
      if (paradoxEntity) paradoxEntity.update();
    },

    onEnd() {
      slowMotion           = 1.0;
      cinematicCamOverride = false;
      paradoxEntity        = null;
      _tfKCOverlay         = null;

      // Mark paradox death cinematic as complete — absorption MUST check this flag
      paradoxDeathComplete = true;

      // Guarantee TF starts the main fight at exactly 9000 HP
      if (tf) {
        tf.health           = 9000;
        tf.maxHealth        = Math.max(tf.maxHealth, 9000);
        tf.postSpecialPause = 4;
      }

      // Reposition hero away from TF
      const hero = typeof players !== 'undefined' ? players.find(p => !p.isBoss) : null;
      if (hero && tf) {
        hero.x  = Math.max(40, tf.x - 140);
        hero.y  = GAME_H - 72 - hero.h;
        hero.vx = 0;
        hero.vy = 0;
      }

      // Begin absorption → transition to dimension-punch cinematic
      // startTFAbsorptionScene is the new declarative version; falls back to legacy helper
      if (hero && typeof startTFAbsorptionScene === 'function') {
        startTFAbsorptionScene(hero, paradoxEntity);
      } else if (hero && typeof _startAbsorptionThenPunch === 'function') {
        _startAbsorptionThenPunch(tf, hero);
      }
    }
  };
}

// ============================================================
// SPAWN / REMOVE helpers
// ============================================================
function spawnParadox(x, y) {
  paradoxEntity = new Paradox(x, y);
}

function removeParadox() {
  if (paradoxEntity) paradoxEntity.done = true;
}

// ============================================================
// PARADOX REVIVE  — replaces triggerFakeDeath visually
// ============================================================
function triggerParadoxRevive(player) {
  if (fakeDeath.triggered) return;
  fakeDeath.triggered = true; // block re-trigger (shared flag with old system)

  paradoxReviveActive = true;
  paradoxReviveTimer  = 0;
  paradoxRevivePlayer = player;

  // Standard tumble physics so player reacts visually
  player.invincible   = 9999;
  player.ragdollTimer = 80;
  player.ragdollSpin  = (Math.random() > 0.5 ? 1 : -1) * (0.18 + Math.random() * 0.14);
  player.vy           = -12;
  player.vx           = (Math.random() - 0.5) * 14;
  screenShake         = Math.max(screenShake, 20);
}

function updateParadoxRevive() {
  if (!paradoxReviveActive) return;
  paradoxReviveTimer++;
  const t = paradoxReviveTimer;
  const p = paradoxRevivePlayer;

  // t=60: spawn Paradox near fallen player's spawn, show first dialogue
  if (t === 60) {
    const spx = p ? p.spawnX : GAME_W / 2;
    const spy = p ? p.spawnY : GAME_H / 2;
    spawnParadox(spx - 45, spy - 20);
    bossDialogue = { text: randChoice(_PARADOX_REVIVE_LINES), timer: 280 };
    screenShake  = Math.max(screenShake, 10);
  }

  // t=100: energy surge burst
  if (t === 100 && p && settings.particles) {
    for (let i = 0; i < 50 && particles.length < MAX_PARTICLES; i++) {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.3;
      const spd   = 4 + Math.random() * 12;
      const _p2   = _getParticle();
      _p2.x       = p.spawnX; _p2.y = p.spawnY;
      _p2.vx      = Math.cos(angle) * spd;
      _p2.vy      = Math.sin(angle) * spd;
      _p2.color   = Math.random() < 0.5 ? '#00ffff' : '#ffffff';
      _p2.size    = 2 + Math.random() * 5;
      _p2.life    = 50 + Math.random() * 40;
      _p2.maxLife = 90;
      particles.push(_p2);
    }
    screenShake = Math.max(screenShake, 28);
  }

  // t=150: secondary Paradox particle burst
  if (t === 150 && settings.particles) {
    const ex = paradoxEntity ? paradoxEntity.cx() : (p ? p.spawnX : GAME_W / 2);
    const ey = paradoxEntity ? paradoxEntity.cy() : (p ? p.spawnY : GAME_H / 2);
    for (let i = 0; i < 35 && particles.length < MAX_PARTICLES; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd   = 3 + Math.random() * 9;
      const _p2   = _getParticle();
      _p2.x       = ex + (Math.random() - 0.5) * 20;
      _p2.y       = ey + (Math.random() - 0.5) * 20;
      _p2.vx      = Math.cos(angle) * spd;
      _p2.vy      = Math.sin(angle) * spd;
      _p2.color   = Math.random() < 0.6 ? '#00ffff' : '#aa88ff';
      _p2.size    = 1.5 + Math.random() * 3.5;
      _p2.life    = 40 + Math.random() * 35;
      _p2.maxLife = 75;
      particles.push(_p2);
    }
  }

  // t=220: revive player with 2 lives, remove Paradox
  if (t === 220 && p) {
    p.lives        = 2;
    p.invincible   = 150;
    p.ragdollTimer = 0;
    p.ragdollSpin  = 0;
    p.ragdollAngle = 0;
    p.respawn();
    removeParadox();
    paradoxReviveActive = false;
  }

  // Keep Paradox entity alive and updated
  if (paradoxEntity) paradoxEntity.update();
}

function drawParadoxRevive() {
  if (!paradoxReviveActive) return;
  const t = paradoxReviveTimer;

  // Dark overlay builds over first 80 frames
  const overlayAlpha = Math.min(0.70, t / 80 * 0.70);
  ctx.save();
  ctx.globalAlpha = overlayAlpha;
  ctx.fillStyle   = '#000000';
  ctx.fillRect(0, 0, GAME_W, GAME_H);
  ctx.restore();

  // "DEFEATED" text
  if (t > 40) {
    const a = Math.min(1, (t - 40) / 30);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle   = '#ff3355';
    ctx.font        = 'bold 32px monospace';
    ctx.textAlign   = 'center';
    ctx.shadowColor = '#ff0033';
    ctx.shadowBlur  = 18;
    ctx.fillText('DEFEATED', GAME_W / 2, 82);
    ctx.restore();
  }

  // Paradox entity (draws in world space, over dark overlay)
  if (paradoxEntity && t >= 60) paradoxEntity.draw();

  // "PARADOX" label above entity
  if (t >= 70 && t < 205 && paradoxEntity) {
    const la = Math.min(1, (t - 70) / 20) * (t > 185 ? Math.max(0, (205 - t) / 20) : 1);
    ctx.save();
    ctx.globalAlpha = la;
    ctx.fillStyle   = '#00ffff';
    ctx.font        = 'bold 12px monospace';
    ctx.textAlign   = 'center';
    ctx.shadowColor = '#00ffff';
    ctx.shadowBlur  = 10;
    ctx.fillText('PARADOX', paradoxEntity.cx(), paradoxEntity.y - 13);
    ctx.restore();
  }

  // Horizontal CRT scan-line distortion
  if (t >= 80 && t < 220) {
    const da = 0.05 + Math.abs(Math.sin(t * 0.15)) * 0.04;
    ctx.save();
    ctx.globalAlpha = da;
    ctx.fillStyle   = '#00ffff';
    for (let ry = 0; ry < GAME_H; ry += 7) ctx.fillRect(0, ry, GAME_W, 1);
    ctx.restore();
  }
}

// ============================================================
// UPDATE / DRAW — standalone (called each frame when no revive)
// ============================================================
function updateParadox() {
  if (paradoxEntity) {
    paradoxEntity.update();
    if (paradoxEntity.done && paradoxEntity.alpha <= 0) paradoxEntity = null;
  }
}

function drawParadox() {
  if (paradoxEntity) paradoxEntity.draw();
}

// ============================================================
// TRUEFORM DAMAGE LOCK + PARADOX EMPOWERMENT
// ============================================================
function startTFDamageLock() {
  tfDamageLocked    = true;
  tfDamageLockTimer = 480; // 8 seconds then auto-empower
}

function activateParadoxEmpowerment(hero) {
  tfDamageLocked    = false;
  tfDamageLockTimer = 0;
  tfParadoxEmpowered = true;
  tfEmpowerTimer     = TF_EMPOWER_DURATION;

  if (hero) {
    // Speed boost
    if (!hero._preEmpowerSpeed) hero._preEmpowerSpeed = hero.speed;
    hero.speed = (hero._preEmpowerSpeed || 3.2) * 1.4;
    // Damage boost
    if (hero._preEmpowerDmgMult === undefined) hero._preEmpowerDmgMult = hero.dmgMult !== undefined ? hero.dmgMult : 1.0;
    hero.dmgMult = hero._preEmpowerDmgMult * 1.6;
  }

  if (typeof showBossDialogue === 'function') showBossDialogue('PARADOX EMPOWERMENT', 320);
  screenShake = Math.max(screenShake, 30);

  if (hero && settings.particles) {
    for (let i = 0; i < 60 && particles.length < MAX_PARTICLES; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd   = 5 + Math.random() * 12;
      const _p    = _getParticle();
      _p.x = hero.cx(); _p.y = hero.cy();
      _p.vx = Math.cos(angle) * spd; _p.vy = Math.sin(angle) * spd;
      _p.color = Math.random() < 0.5 ? '#00ffff' : '#ffffff';
      _p.size  = 2 + Math.random() * 5;
      _p.life  = 60 + Math.random() * 40; _p.maxLife = 100;
      particles.push(_p);
    }
  }
}

function updateParadoxEmpowerment() {
  // Count down damage lock → auto-activate empowerment
  if (tfDamageLocked && tfDamageLockTimer > 0) {
    tfDamageLockTimer--;
    if (tfDamageLockTimer <= 0) {
      const hero = players.find(p => !p.isBoss && p.health > 0);
      activateParadoxEmpowerment(hero || null);
    }
  }

  // Count down empowerment duration
  if (tfParadoxEmpowered && tfEmpowerTimer > 0) {
    tfEmpowerTimer--;
    if (tfEmpowerTimer <= 0) {
      const hero = players.find(p => !p.isBoss && p.health > 0);
      if (hero) {
        if (hero._preEmpowerSpeed    !== undefined) { hero.speed   = hero._preEmpowerSpeed;    delete hero._preEmpowerSpeed; }
        if (hero._preEmpowerDmgMult  !== undefined) { hero.dmgMult = hero._preEmpowerDmgMult;  delete hero._preEmpowerDmgMult; }
      }
      tfParadoxEmpowered = false;
    }
  }
}

function drawParadoxEmpowerment() {
  if (!tfParadoxEmpowered || tfEmpowerTimer <= 0) return;
  const hero = players.find(p => !p.isBoss && p.health > 0);
  if (!hero) return;

  const fadeA = Math.min(1, tfEmpowerTimer / 120);
  const pulse = 0.4 + Math.sin(frameCount * 0.12) * 0.3;

  // Aura ring
  ctx.save();
  ctx.globalAlpha = fadeA * pulse * 0.55;
  ctx.strokeStyle = '#00ffff';
  ctx.lineWidth   = 3;
  ctx.shadowColor = '#00ffff';
  ctx.shadowBlur  = 22;
  ctx.beginPath();
  ctx.arc(hero.cx(), hero.cy(), 32 + Math.sin(frameCount * 0.1) * 6, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // Floating "EMPOWERED" label that fades at end
  if (tfEmpowerTimer < 120) {
    const la = Math.min(1, tfEmpowerTimer / 60) * 0.88;
    ctx.save();
    ctx.globalAlpha = la;
    ctx.fillStyle   = '#00ffff';
    ctx.font        = 'bold 11px monospace';
    ctx.textAlign   = 'center';
    ctx.shadowColor = '#00ffff';
    ctx.shadowBlur  = 8;
    ctx.fillText('EMPOWERED', hero.cx(), hero.y - 20);
    ctx.restore();
  }
}

// ============================================================
// BOSS FIGHT FORESHADOWING
// ============================================================
function updateBossParadoxForeshadow() {
  if (gameMode !== 'boss' || !gameRunning || gameFrozen) return;
  const fs = bossParadoxForeshadow;

  if (fs.cooldown > 0) { fs.cooldown--; return; }

  if (fs.active) {
    fs.timer++;
    if (fs.timer >= 52) {
      fs.active   = false;
      fs.timer    = 0;
      fs.cooldown = 660 + Math.floor(Math.random() * 540); // 11–20 s
    }
    return;
  }

  // Random chance to trigger (~0.25% per frame after cooldown)
  if (frameCount > 600 && Math.random() < 0.0025) {
    fs.active = true;
    fs.timer  = 0;
  }
}

function drawBossParadoxForeshadow() {
  if (!bossParadoxForeshadow.active) return;
  const t = bossParadoxForeshadow.timer;
  const alpha = t < 10 ? (t / 10) * 0.32 : t < 40 ? 0.32 : ((52 - t) / 12) * 0.32;
  if (alpha <= 0) return;

  ctx.save();
  ctx.globalAlpha = alpha;
  // Subtle dark overlay to sell the vision
  ctx.fillStyle = '#000d1a';
  ctx.fillRect(0, 0, GAME_W, GAME_H);
  ctx.globalAlpha = alpha * 1.0;

  // TrueForm silhouette — left background
  _drawForeshadowSilhouette(195, GAME_H - 155, '#111111', '#ffffff', 1.25, true);
  // Paradox silhouette — right background
  _drawForeshadowSilhouette(610, GAME_H - 148, '#000000', '#00ffff', 1.0, false);

  // Energy clash line between them
  ctx.strokeStyle = '#00ffff';
  ctx.lineWidth   = 1.8;
  ctx.shadowColor = '#00ffff';
  ctx.shadowBlur  = 16;
  ctx.globalAlpha = alpha * 0.65;
  ctx.beginPath();
  ctx.moveTo(215, GAME_H - 185);
  ctx.lineTo(600, GAME_H - 178);
  ctx.stroke();

  ctx.restore();
}

// Internal helper: small stickman silhouette for foreshadow
function _drawForeshadowSilhouette(x, y, fill, stroke, scale, faceRight) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.fillStyle   = fill;
  ctx.strokeStyle = stroke;
  ctx.lineWidth   = 1.6 / scale;
  ctx.shadowColor = stroke;
  ctx.shadowBlur  = 9;
  const d = faceRight ? 1 : -1;
  ctx.beginPath(); ctx.arc(0, -44, 7, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, -37); ctx.lineTo(0, -15);
  ctx.moveTo(0, -32); ctx.lineTo(d * 13, -23);
  ctx.moveTo(0, -32); ctx.lineTo(-d * 10, -25);
  ctx.moveTo(0, -15); ctx.lineTo(d * 9, 0);
  ctx.moveTo(0, -15); ctx.lineTo(-d * 7, 0);
  ctx.stroke();
  ctx.restore();
}

// One-time scripted moment: Boss punches Paradox out of arena (fires at 50% boss HP)
function triggerBossParadoxPunch() {
  if (bossParadoxForeshadow.punchFired) return;
  bossParadoxForeshadow.punchFired = true;

  screenShake = Math.max(screenShake, 18);
  if (settings.particles) {
    for (let i = 0; i < 32 && particles.length < MAX_PARTICLES; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd   = 4 + Math.random() * 9;
      const _p    = _getParticle();
      _p.x = 600; _p.y = GAME_H - 185;
      _p.vx = Math.cos(angle) * spd; _p.vy = Math.sin(angle) * spd;
      _p.color = Math.random() < 0.5 ? '#00ffff' : '#ffffff';
      _p.size  = 2 + Math.random() * 4; _p.life  = 28 + Math.random() * 28; _p.maxLife = 56;
      particles.push(_p);
    }
  }
  if (typeof showBossDialogue === 'function') showBossDialogue('Nothing can save you.', 280);
}

// ============================================================
// TRUEFORM INTRO CINEMATIC  (fires at fight start, fully scripted)
//
// Sequence:
//   0.0 s  Freeze — TF centered, Paradox + player repositioned left
//   0.3 s  "So… you brought backup."
//   0.7-2.4 s  6 scripted hits — TF HP falls from 10 000 → 9 000
//   2.6 s  "Enough." — momentum halted, slowdown
//   3.1 s  "You cannot win." — TF begins gliding toward Paradox (visible)
//   4.9 s  GRAB complete → Paradox pinned
//   4.9 s  NECK SNAP — white flash, ~10-frame near-freeze
//   5.4 s  PORTAL OPEN — shockwave burst right side
//   6.1 s  THROW — Paradox launched at portal with velocity
//   7.2 s  PORTAL CLOSE — Paradox fades out
//   8.3 s  "Now… face me alone." — fight begins
// ============================================================
function _makeTFIntroCinematic(tf) {
  const PORTAL_X  = GAME_W - 140;
  const PORTAL_Y  = GAME_H - 100;
  const FLOOR_Y   = GAME_H - 72;

  // ── Scripted hit timings (seconds) ────────────────────────────────
  // Paradox hits TF  (6 hits, frames ~42–144)
  const PARADOX_HITS = [0.7, 1.05, 1.4, 1.75, 2.05, 2.4];
  // Player hits TF   (5 hits, interleaved, frames ~54–150)
  const P1_HITS      = [0.9, 1.2,  1.6, 1.95, 2.3 ];

  // Per-hit damage amounts — deterministic, total well above 1000 so the
  // hard-set at frame 300 is the only source of truth for final HP.
  const PARADOX_HIT_DMG = [120, 130, 125, 140, 115, 135]; // sum = 765
  const P1_HIT_DMG      = [ 80,  90,  85,  95,  75];      // sum = 425
  // Combined ≥1000, but tf.health is clamped to ≥9000 per hit AND
  // hard-forced to exactly 9000 at t=5.0 s (frame 300).

  return {
    durationFrames: 500,   // ~8.3 s at 60 fps
    _phaseLabel: { text: '— THE VOID AWAKENS —', color: '#00ffff' },

    // ── State flags ──────────────────────────────────────────────────
    _setupDone:          false,
    _introDialogueFired: false,
    _paradoxHitIdx:      0,
    _p1HitIdx:           0,
    _hp9kForced:         false,   // hard HP lock at frame 300
    _turnFired:          false,
    _grabMoving:         false,
    _grabDone:           false,
    _snapFired:          false,
    _portalFired:        false,
    _portalPulse:        0,
    _throwFired:         false,
    _throwVx:            0,
    _throwVy:            0,
    _closeFired:         false,
    // Animation state — manually driven since gameFrozen skips Fighter.update()
    _heroAtkTimer:       0,  // counts down: >0 → hero shows attack pose
    _tfHurtTimer:        0,  // counts down: >0 → TF shows hurt pose / flinch

    // Cached hero ref (set in _setupDone block)
    _hero: null,
    // Target X for hero approach (set in _setupDone block)
    _heroTargetX: 0,

    update(t) {
      // ── Slow-motion curve ─────────────────────────────────────────
      if      (t < 0.3)  slowMotion = Math.max(0.3,  1.0 - t * 2.33);
      else if (t < 2.5)  slowMotion = 0.30;
      else if (t < 2.85) slowMotion = Math.max(0.08, 0.30 - (t - 2.5) * 0.63);
      else if (t < 4.85) slowMotion = 0.08;
      else if (t < 5.0)  slowMotion = 0.01;  // near-freeze before snap
      else if (t < 6.2)  slowMotion = 0.10;
      else               slowMotion = Math.min(1.0, 0.10 + (t - 6.2) * 0.35);

      // ── Camera ───────────────────────────────────────────────────
      cinematicCamOverride = true;
      if (t < 2.5) {
        cinematicZoomTarget = 0.82;
        cinematicFocusX     = GAME_W / 2;
        cinematicFocusY     = GAME_H / 2 - 10;
      } else if (t < 5.5 && tf) {
        cinematicZoomTarget = Math.min(1.55, 0.82 + (t - 2.5) * 0.244);
        cinematicFocusX     = tf.cx ? tf.cx() : GAME_W / 2;
        cinematicFocusY     = (tf.cy ? tf.cy() : GAME_H / 2) - 20;
      } else {
        cinematicZoomTarget = 1.1;
        cinematicFocusX     = PORTAL_X - 60;
        cinematicFocusY     = PORTAL_Y - 20;
      }

      // ── MANUAL ANIMATION STATE (gameFrozen skips Fighter.update()) ──
      // Hero walk / attack pose driven entirely by cinematic state.
      {
        const hero = this._hero;
        if (this._heroAtkTimer > 0) {
          this._heroAtkTimer--;
          if (hero) {
            hero.attackDuration = Math.max(hero.attackDuration || 0, 22);
            hero.attackTimer    = Math.max(1, this._heroAtkTimer);
            hero.state          = 'attacking';
          }
        } else if (this._setupDone && t < 2.5 && hero && hero.x < this._heroTargetX) {
          if (hero) hero.state = 'walking';
        } else if (hero && hero.state !== 'idle' && this._heroAtkTimer <= 0 && t < 2.6) {
          if (hero) hero.state = 'idle';
        }

        // TF hurt flinch — manually decrement since update() is frozen
        if (this._tfHurtTimer > 0) {
          this._tfHurtTimer--;
          if (tf) { tf.hurtTimer = this._tfHurtTimer; tf.state = 'hurt'; }
        }
      }

      // ── CONTINUOUS HP FLOOR CLAMP ────────────────────────────────
      // Prevents any stray damage (class effects, particles, etc.) from
      // pushing TF below 9000 before the deterministic force at frame 300.
      if (tf && !this._hp9kForced && tf.health < 9000) tf.health = 9000;

      // ── STEP 0: Position entities ─────────────────────────────────
      if (!this._setupDone && t >= 0.05) {
        this._setupDone = true;

        // True Form: centered, full HP, abilities hard-blocked
        if (tf) {
          tf.x               = GAME_W / 2 - tf.w / 2;
          tf.y               = FLOOR_Y - tf.h;
          tf.vx              = 0; tf.vy = 0;
          tf.health          = tf.maxHealth; // 10 000
          tf.facing          = -1;           // face left toward attackers
          // Block ALL special abilities for the duration of this cinematic.
          // gameFrozen=true (set by startCinematic) already prevents updateAI,
          // but postSpecialPause guards against any ability that checks it.
          tf.postSpecialPause = 9999;
        }

        // Spawn Paradox left side (between player and TF)
        if (!paradoxEntity) spawnParadox(210, FLOOR_Y - 50);
        if (paradoxEntity) { paradoxEntity.facing = 1; paradoxEntity.vy = 0; }

        // Reposition player: left edge, zero velocity, input already locked
        // by gameFrozen=true — no additional input disable needed.
        const hero = players ? players.find(p => !p.isBoss) : null;
        this._hero = hero || null;
        if (hero) {
          hero.x  = 80 - hero.w / 2;
          hero.y  = FLOOR_Y - hero.h;
          hero.vx = 0; hero.vy = 0;
          // Approach target: stop ~90 px left of TF center
          this._heroTargetX = (GAME_W / 2) - 90 - hero.w / 2;
        }

        screenShake = Math.max(screenShake, 12);
        if (typeof CinFX !== 'undefined') CinFX.flash('#ffffff', 0.20, 18);
      }

      // ── STEP 1: Intro dialogue ────────────────────────────────────
      if (t >= 0.3 && !this._introDialogueFired) {
        this._introDialogueFired = true;
        if (typeof showBossDialogue === 'function')
          showBossDialogue('So\u2026 you brought backup.', 270);
      }

      // ── STEP 1a: Player & Paradox approach TF (frames 0–120 / t 0–2 s) ─
      // Both fighters walk toward TF during the positioning window.
      if (this._setupDone && t < 2.0) {
        const hero = this._hero;
        if (hero && hero.x < this._heroTargetX) {
          hero.x      += 1.6;
          hero.facing  = 1; // face right (toward TF)
        }
        // Paradox also closes distance
        if (paradoxEntity && tf) {
          const pdx = tf.cx() - paradoxEntity.cx();
          if (Math.abs(pdx) > 70) {
            paradoxEntity.x     += Math.sign(pdx) * 1.4;
            paradoxEntity.facing = Math.sign(pdx);
          }
        }
      }

      // ── STEP 2: Paradox scripted hits (frames ~42–144) ───────────
      if (this._paradoxHitIdx < PARADOX_HITS.length &&
          t >= PARADOX_HITS[this._paradoxHitIdx]) {
        const idx = this._paradoxHitIdx++;
        if (paradoxEntity) paradoxEntity.punch(1);
        const drop = PARADOX_HIT_DMG[idx];
        if (tf) tf.health = Math.max(9000, tf.health - drop);
        const px = tf ? tf.cx() : GAME_W / 2;
        const py = tf ? tf.cy() : GAME_H / 2;
        spawnParticles(px, py, '#00ffff', 7);
        spawnParticles(px, py, '#ffffff', 4);
        screenShake = Math.max(screenShake, 7);
        if (settings.dmgNumbers && typeof DamageText !== 'undefined') {
          damageTexts.push(new DamageText(String(drop),
            px + (Math.random() - 0.5) * 28, py - 22, '#00ffff'));
        }
        // TF flinch: brief hurt pose + slight knockback away from Paradox
        if (tf) {
          this._tfHurtTimer = 14;
          tf.hurtTimer = 14;
          tf.state     = 'hurt';
          if (paradoxEntity) tf.x += Math.sign(tf.cx() - paradoxEntity.cx()) * 5;
        }
      }

      // ── STEP 3: Player (hero) scripted hits (frames ~54–150) ─────
      // Player is AI-controlled for this cinematic (gameFrozen disables input).
      // We script their position + impact visuals to show them actively fighting.
      if (this._p1HitIdx < P1_HITS.length &&
          t >= P1_HITS[this._p1HitIdx]) {
        const idx  = this._p1HitIdx++;
        const hero = this._hero;
        const drop = P1_HIT_DMG[idx];

        // Snap hero adjacent to TF for the impact frame, show attack pose
        if (hero && tf) {
          hero.x            = tf.x - hero.w - 4;
          hero.y            = FLOOR_Y - hero.h;
          hero.facing       = 1;
          hero.attackDuration = Math.max(hero.attackDuration || 0, 22);
          hero.attackTimer  = 22;
          hero.state        = 'attacking';
          this._heroAtkTimer = 22;
        }

        if (tf) tf.health = Math.max(9000, tf.health - drop);
        const px = tf ? tf.cx() : GAME_W / 2;
        const py = tf ? tf.cy() : GAME_H / 2;

        // Hero-colored impact particles (white + yellow)
        spawnParticles(px, py, '#ffffff', 6);
        spawnParticles(px, py, '#ffe066', 4);
        if (hero) spawnParticles(hero.cx ? hero.cx() : hero.x, hero.y, '#ffe066', 3);

        screenShake = Math.max(screenShake, 9);
        if (settings.dmgNumbers && typeof DamageText !== 'undefined') {
          damageTexts.push(new DamageText(String(drop),
            px + (Math.random() - 0.5) * 24, py - 34, '#ffe066'));
        }

        // TF flinch on player hit: stronger knockback than Paradox hits
        if (tf) {
          this._tfHurtTimer = Math.max(this._tfHurtTimer, 18);
          tf.hurtTimer = 18;
          tf.state     = 'hurt';
          if (hero) tf.x += Math.sign(tf.cx() - hero.cx()) * 8;
        }

        // Pull hero back slightly after impact (recoil)
        if (hero) { hero.x -= 12; hero.vx = 0; hero.vy = 0; }
      }

      // ── STEP 4: HARD HP FORCE at t = 5.0 s (frame 300) ──────────
      // This is the single source of truth for the final opening HP value.
      // Regardless of accumulated hit damage, TF is ALWAYS at exactly 9000
      // when the execution cinematic begins.
      if (!this._hp9kForced && t >= 5.0) {
        this._hp9kForced = true;
        if (tf) {
          tf.health           = 9000; // hard set — no Math.max, no Math.min
          tf.maxHealth        = Math.max(tf.maxHealth, 9000);
          tf.postSpecialPause = 0;   // will be re-applied in onEnd guard
        }
      }

      // ── STEP 5: Turning point — TF disengages from player ────────
      if (t >= 2.6 && !this._turnFired) {
        this._turnFired = true;
        if (paradoxEntity) paradoxEntity.vy = 0;
        const hero = this._hero;
        if (hero) {
          hero.vx = 0; hero.vy = 0;
          hero.state = 'idle';
          hero.attackTimer = 0;
          this._heroAtkTimer = 0;
        }
        // Clear TF hurt state so it stands upright before grab
        this._tfHurtTimer = 0;
        if (tf) { tf.hurtTimer = 0; tf.state = 'idle'; }
        if (typeof showBossDialogue === 'function') showBossDialogue('Enough.', 200);
        if (tf) spawnParticles(tf.cx(), tf.cy() - 10, '#ffffff', 22);
        if (typeof CinFX !== 'undefined') {
          CinFX.shake(24);
          CinFX.flash('#ffffff', 0.30, 12);
        }
      }

      // ── STEP 6: GRAB — TF glides visibly toward Paradox ──────────
      if (t >= 3.15 && !this._grabMoving) {
        this._grabMoving = true;
        if (typeof showBossDialogue === 'function')
          showBossDialogue('You cannot win.', 270);
      }

      if (this._grabMoving && !this._grabDone && tf && paradoxEntity) {
        const dx = paradoxEntity.cx() - tf.cx();
        if (Math.abs(dx) > 6) {
          tf.x     += Math.sign(dx) * 2.5;
          tf.facing = Math.sign(dx);
        } else {
          this._grabDone   = true;
          tf.x             = paradoxEntity.cx() - tf.w / 2 - 3;
          tf.facing        = 1;
          paradoxEntity.facing = -1;
          paradoxEntity.vy     = -1;
          spawnParticles(tf.cx(), tf.cy(), '#ffffff', 16);
          spawnParticles(paradoxEntity.cx(), paradoxEntity.cy(), '#00ffff', 12);
          if (typeof CinFX !== 'undefined') CinFX.shake(16);
        }
      }

      // Keep Paradox pinned while grabbed (before snap)
      if (this._grabDone && paradoxEntity && !this._snapFired) {
        paradoxEntity.vx = 0;
        paradoxEntity.vy = 0;
        if (tf) {
          paradoxEntity.x = tf.cx() - paradoxEntity.w / 2 + tf.facing * 2;
          paradoxEntity.y = tf.y - 4;
        }
      }

      // Fallback: force grab complete if movement overruns timing
      if (!this._grabDone && t >= 5.2 && paradoxEntity && tf) {
        this._grabDone       = true;
        tf.x                 = paradoxEntity.cx() - tf.w / 2 - 3;
        tf.facing            = 1;
        paradoxEntity.facing = -1;
      }

      // ── STEP 7: NECK SNAP ─────────────────────────────────────────
      if (this._grabDone && t >= 4.9 && !this._snapFired) {
        this._snapFired = true;

        if (paradoxEntity && settings.particles) {
          for (let i = 0; i < 55 && particles.length < MAX_PARTICLES; i++) {
            const angle = Math.random() * Math.PI * 2;
            const spd   = 7 + Math.random() * 15;
            const _p    = _getParticle();
            _p.x     = paradoxEntity.cx();
            _p.y     = paradoxEntity.cy();
            _p.vx    = Math.cos(angle) * spd;
            _p.vy    = Math.sin(angle) * spd;
            _p.color = Math.random() < 0.55 ? '#00ffff' : '#ffffff';
            _p.size  = 2 + Math.random() * 5;
            _p.life  = 35 + Math.random() * 30;
            _p.maxLife = 65;
            particles.push(_p);
          }
        }
        if (typeof CinFX !== 'undefined') {
          CinFX.flash('#ffffff', 0.92, 10);
          CinFX.shake(42);
        }
        if (typeof showBossDialogue === 'function')
          showBossDialogue('This timeline ends here.', 290);
      }

      // ── STEP 8: PORTAL OPEN ───────────────────────────────────────
      if (t >= 5.4 && !this._portalFired) {
        this._portalFired = true;
        if (typeof CinFX !== 'undefined') {
          CinFX.shockwave(PORTAL_X, PORTAL_Y, '#00ffff', { count: 5, maxR: 200, lw: 5, dur: 100 });
          CinFX.shockwave(PORTAL_X, PORTAL_Y, '#aa44ff', { count: 2, maxR: 90,  lw: 9, dur: 65  });
          CinFX.flash('#00ffff', 0.38, 16);
          CinFX.shake(18);
        }
        spawnParticles(PORTAL_X, PORTAL_Y, '#00ffff', 30);
        spawnParticles(PORTAL_X, PORTAL_Y, '#aa44ff', 20);
        if (typeof showBossDialogue === 'function')
          showBossDialogue('Back to the void.', 230);
      }

      // Portal pulse — inward particle swirl
      if (this._portalFired && !this._closeFired) {
        this._portalPulse++;
        if (this._portalPulse % 7 === 0 && settings.particles && particles.length < MAX_PARTICLES) {
          for (let i = 0; i < 5; i++) {
            const ang = Math.random() * Math.PI * 2;
            const r   = 35 + Math.random() * 40;
            const _p  = _getParticle();
            _p.x    = PORTAL_X + Math.cos(ang) * r;
            _p.y    = PORTAL_Y + Math.sin(ang) * r;
            _p.vx   = -Math.cos(ang) * (1.2 + Math.random() * 2.2);
            _p.vy   = -Math.sin(ang) * (1.2 + Math.random() * 2.2);
            _p.color = Math.random() < 0.6 ? '#00ffff' : '#aa44ff';
            _p.size  = 1.5 + Math.random() * 2.5;
            _p.life  = 18 + Math.random() * 14;
            _p.maxLife = 32;
            particles.push(_p);
          }
        }
      }

      // ── STEP 9: THROW ─────────────────────────────────────────────
      if (t >= 6.1 && !this._throwFired) {
        this._throwFired = true;
        if (paradoxEntity && tf) {
          const dx   = PORTAL_X - paradoxEntity.cx();
          const dy   = PORTAL_Y - paradoxEntity.cy();
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          this._throwVx = (dx / dist) * 22;
          this._throwVy = (dy / dist) * 22 - 5;
          paradoxEntity._glitchX = 10;
        }
        if (typeof CinFX !== 'undefined') {
          CinFX.shake(28);
          CinFX.flash('#ffffff', 0.55, 12);
        }
        if (paradoxEntity)
          spawnParticles(paradoxEntity.cx(), paradoxEntity.cy(), '#ffffff', 28);
      }

      if (this._throwFired && !this._closeFired && paradoxEntity) {
        paradoxEntity.x += this._throwVx;
        paradoxEntity.y += this._throwVy;
        this._throwVy   += 0.3;
      }

      // ── STEP 10: PORTAL CLOSE ────────────────────────────────────
      if (t >= 7.2 && !this._closeFired) {
        this._closeFired = true;
        if (paradoxEntity) paradoxEntity.done = true;
        if (typeof CinFX !== 'undefined') {
          CinFX.flash('#00ffff', 0.60, 20);
          CinFX.shake(18);
        }
        spawnParticles(PORTAL_X, PORTAL_Y, '#00ffff', 38);
        spawnParticles(PORTAL_X, PORTAL_Y, '#ffffff', 20);
      }

      // Keep Paradox entity ticking (fade, glitch, alpha decay)
      if (paradoxEntity) paradoxEntity.update();
    },

    onEnd() {
      slowMotion           = 1.0;
      cinematicCamOverride = false;
      paradoxEntity        = null;

      // Guarantee TF is at exactly 9000 HP when fight resumes.
      // (Safety net in case the cinematic was skipped or cut short.)
      if (tf) {
        tf.health           = 9000;
        tf.maxHealth        = Math.max(tf.maxHealth, 9000);
        // Re-enable TF abilities for the main fight (postSpecialPause was
        // set to 9999 in setup; give a small grace window before first attack).
        tf.postSpecialPause = 4; // ~60 frames before first special
      }

      // Reposition hero to a safe spawn so they aren't clipping TF
      const hero = players ? players.find(p => !p.isBoss) : null;
      if (hero && tf) {
        hero.x   = Math.max(40, tf.x - 140);
        hero.y   = GAME_H - 72 - hero.h;
        hero.vx  = 0;
        hero.vy  = 0;
      }

      // Opening taunt — fight begins
      if (typeof showBossDialogue === 'function')
        showBossDialogue('Now\u2026 face me alone.', 300);
    }
  };
}

// ============================================================
// TRUEFORM PRE-FIGHT CINEMATIC  (replaces _makeTFEntryCinematic)
// ============================================================
function _makeTFParadoxEntryCinematic(tf) {
  return {
    durationFrames: 420, // 7 seconds
    _paradoxSpawned: false,
    _fightFired:     false,
    _teleportFired:  false,
    _snapFired:      false,
    _portalFired:    false,
    _lockFired:      false,
    _phaseLabel: { text: '— THE RECKONING —', color: '#00ffff' },

    update(t) {
      // Slow motion throughout
      if      (t < 0.3) slowMotion = Math.max(0.08, 1 - t * 3.2);
      else if (t > 6.3) slowMotion = Math.min(1.0,  (t - 6.3) / 0.7);
      else              slowMotion = 0.08;

      cinematicCamOverride = t < 6.8;
      if (cinematicCamOverride && tf) {
        cinematicZoomTarget = Math.min(1.5, 1.1 + t * 0.06);
        cinematicFocusX     = tf.cx ? tf.cx() : GAME_W / 2;
        cinematicFocusY     = (tf.cy ? tf.cy() : GAME_H / 2) - 20;
      }

      // 0.5 s: ensure Paradox is present (may already be spawned by opening fight)
      if (t >= 0.5 && !this._paradoxSpawned) {
        this._paradoxSpawned = true;
        if (!paradoxEntity) {
          spawnParadox(155, GAME_H - 190);
        }
        if (paradoxEntity) paradoxEntity.facing = 1;
      }

      // 1.0 s: clash sparks between TF and Paradox (fighting evenly)
      if (t >= 1.0 && !this._fightFired) {
        this._fightFired = true;
        if (paradoxEntity && tf) {
          const mx = (paradoxEntity.cx() + tf.cx()) / 2;
          const my = (paradoxEntity.cy() + tf.cy()) / 2;
          if (settings.particles) {
            for (let i = 0; i < 28 && particles.length < MAX_PARTICLES; i++) {
              const angle = Math.random() * Math.PI * 2;
              const spd   = 3 + Math.random() * 7;
              const _p    = _getParticle();
              _p.x = mx + (Math.random() - 0.5) * 32; _p.y = my + (Math.random() - 0.5) * 22;
              _p.vx = Math.cos(angle) * spd; _p.vy = Math.sin(angle) * spd;
              _p.color = Math.random() < 0.5 ? '#ffffff' : '#00ffff';
              _p.size  = 1.5 + Math.random() * 3; _p.life  = 22 + Math.random() * 22; _p.maxLife = 44;
              particles.push(_p);
            }
          }
          screenShake = Math.max(screenShake, 14);
        }
        if (typeof showBossDialogue === 'function') showBossDialogue('You think you can stop me?', 210);
      }

      // 2.5 s: TrueForm teleports behind Paradox — first strike
      if (t >= 2.5 && !this._teleportFired) {
        this._teleportFired = true;
        if (tf && paradoxEntity) {
          tf.x = paradoxEntity.cx() + 8;
          tf.y = paradoxEntity.y;
          tf.vy = 0;
          if (tf.facing !== undefined) tf.facing = -1;
          paradoxEntity.facing = 1;
          spawnParticles(tf.cx(), tf.cy(), '#000000', 20);
          spawnParticles(tf.cx(), tf.cy(), '#ffffff', 12);
          screenShake = Math.max(screenShake, 22);
          paradoxEntity.vy = -9; // knocked upward
        }
        if (typeof showBossDialogue === 'function') showBossDialogue('Wrong.', 190);
      }

      // 3.8 s: snap — finisher telegraph
      if (t >= 3.8 && !this._snapFired) {
        this._snapFired = true;
        screenShake = Math.max(screenShake, 35);
        if (paradoxEntity && settings.particles) {
          for (let i = 0; i < 42 && particles.length < MAX_PARTICLES; i++) {
            const angle = Math.random() * Math.PI * 2;
            const spd   = 5 + Math.random() * 12;
            const _p    = _getParticle();
            _p.x = paradoxEntity.cx(); _p.y = paradoxEntity.cy();
            _p.vx = Math.cos(angle) * spd; _p.vy = Math.sin(angle) * spd;
            _p.color = Math.random() < 0.55 ? '#00ffff' : '#ffffff';
            _p.size  = 2 + Math.random() * 4; _p.life  = 32 + Math.random() * 30; _p.maxLife = 62;
            particles.push(_p);
          }
        }
        if (typeof showBossDialogue === 'function') showBossDialogue('This timeline ends here.', 230);
      }

      // 5.0 s: throw Paradox into portal — cyan flash
      if (t >= 5.0 && !this._portalFired) {
        this._portalFired = true;
        if (paradoxEntity) {
          paradoxEntity.vx   = 18;
          paradoxEntity.vy   = -5;
          paradoxEntity.done = true;
        }
        cinScreenFlash = { color: '#00ffff', alpha: 0.7, timer: 30, maxTimer: 30 };
        screenShake    = Math.max(screenShake, 22);
        spawnParticles(700, GAME_H / 2, '#00ffff', 42);
        spawnParticles(700, GAME_H / 2, '#ffffff', 22);
      }

      // 6.0 s: cleanup — remove Paradox (absorption begins in onEnd)
      if (t >= 6.0 && !this._lockFired) {
        this._lockFired  = true;
        paradoxEntity    = null;
        if (typeof showBossDialogue === 'function') showBossDialogue('You will suffer alone.', 240);
      }

      if (paradoxEntity) paradoxEntity.update();
    },

    onEnd() {
      slowMotion           = 1.0;
      cinematicCamOverride = false;
      paradoxEntity        = null;
      // Begin absorption → dimension punch intro sequence
      const hero = players.find(p => !p.isBoss && p.health > 0);
      if (hero && typeof _startAbsorptionThenPunch === 'function') {
        _startAbsorptionThenPunch(tf, hero);
      }
    }
  };
}

// ============================================================
// TRUEFORM FINAL PARADOX CINEMATIC  (fires at 30% HP)
// ============================================================
function _makeTFFinalParadoxCinematic(tf) {
  return {
    durationFrames: 300, // 5 seconds
    _warpFired:     false,
    _returnFired:   false,
    _attackFired:   false,
    _lockFired:     false,
    _phaseLabel: { text: '— FINAL RECKONING —', color: '#ff2244' },

    update(t) {
      if      (t < 0.3) slowMotion = Math.max(0.08, 1 - t * 3.3);
      else if (t > 4.3) slowMotion = Math.min(1.0,  (t - 4.3) / 0.7);
      else              slowMotion = 0.08;

      cinematicCamOverride = t < 4.8;
      if (cinematicCamOverride) {
        cinematicZoomTarget = 1.3;
        cinematicFocusX     = GAME_W / 2;
        cinematicFocusY     = GAME_H / 2 - 30;
      }

      // 0.5 s: TF warps away
      if (t >= 0.5 && !this._warpFired) {
        this._warpFired = true;
        if (tf) {
          spawnParticles(tf.cx(), tf.cy(), '#000000', 22);
          spawnParticles(tf.cx(), tf.cy(), '#ffffff', 14);
          tf.x = -300; tf.y = -300; // off-screen
          screenShake = Math.max(screenShake, 20);
        }
        if (typeof showBossDialogue === 'function') showBossDialogue('I know what you need.', 210);
      }

      // 1.5 s: TF returns dragging Paradox
      if (t >= 1.5 && !this._returnFired) {
        this._returnFired = true;
        if (tf) {
          tf.x  = GAME_W / 2 - 9;
          tf.y  = GAME_H - 160;
          tf.vy = 0;
        }
        spawnParadox(GAME_W / 2 - 72, GAME_H - 158);
        if (paradoxEntity) { paradoxEntity.facing = 1; paradoxEntity.alpha = 0.7; }
        spawnParticles(GAME_W / 2, GAME_H / 2, '#00ffff', 28);
        spawnParticles(GAME_W / 2, GAME_H / 2, '#ffffff', 14);
        screenShake = Math.max(screenShake, 14);
        if (typeof showBossDialogue === 'function') showBossDialogue('Watch.', 190);
      }

      // 2.5 s: TF attacks Paradox
      if (t >= 2.5 && !this._attackFired) {
        this._attackFired = true;
        if (paradoxEntity) paradoxEntity.punch(-1);
        screenShake = Math.max(screenShake, 28);
        if (paradoxEntity && settings.particles) {
          for (let i = 0; i < 50 && particles.length < MAX_PARTICLES; i++) {
            const angle = Math.random() * Math.PI * 2;
            const spd   = 4 + Math.random() * 10;
            const _p    = _getParticle();
            _p.x = paradoxEntity.cx(); _p.y = paradoxEntity.cy();
            _p.vx = Math.cos(angle) * spd; _p.vy = Math.sin(angle) * spd;
            _p.color = Math.random() < 0.6 ? '#00ffff' : '#ffffff';
            _p.size  = 2 + Math.random() * 4; _p.life  = 35 + Math.random() * 35; _p.maxLife = 70;
            particles.push(_p);
          }
        }
        cinScreenFlash = { color: '#ffffff', alpha: 0.45, timer: 18, maxTimer: 18 };
        if (typeof showBossDialogue === 'function') showBossDialogue('This is what awaits you.', 240);
      }

      // 3.5 s: brief damage lock + fade Paradox out
      if (t >= 3.5 && !this._lockFired) {
        this._lockFired       = true;
        tfDamageLocked        = true;
        tfDamageLockTimer     = 180; // 3-second brief lock
        if (paradoxEntity) paradoxEntity.done = true;
      }

      if (paradoxEntity) paradoxEntity.update();
    },

    onEnd() {
      slowMotion           = 1.0;
      cinematicCamOverride = false;
      paradoxEntity        = null;
    }
  };
}

// ============================================================
// TRUEFORM PHASE 0 — FALSE VICTORY + PARADOX FUSION SYSTEM
// ============================================================

// State globals
let tfFalseVictoryFired = false;
let tfFalseVictoryState = null;  // { timer, phase, bossRef }
let tfParadoxFused      = false;
let tfFusionGlow        = 0;
let tfFusionControlMode = 'player'; // 'player' | 'paradox'
let tfFusionSwitchTimer = 0;
let tfFusionSwitchInterval = 300; // switch every 5 seconds

// ---- Paradox Control Override system ----
// controlState: which entity currently owns the player's inputs
// controlTimer: frames remaining before the next ownership switch
let controlState = 'player'; // 'player' | 'paradox' — only ONE is ever active
let controlTimer = 0;        // counts down; when 0 → switch ownership
let tfFusionGlitchTimer = 0;
// Switch-feel timers
let tfSwitchToParadoxFlash = 0; // counts 18→0: glow burst when paradox takes over
let tfSwitchToPlayerFade   = 0; // counts 12→0: fade-out when player regains control
let tfFinalStateActive  = false;

function triggerFalseVictory(bossRef) {
  if (tfFalseVictoryFired) return;
  if (!bossRef) return;
  tfFalseVictoryFired = true;
  tfFalseVictoryState = { timer: 0, phase: 'collapse', bossRef };
  gameFrozen = true;
}

function updateFalseVictory() {
  if (!tfFalseVictoryState) return;
  tfFalseVictoryState.timer++;
  const t    = tfFalseVictoryState.timer;
  const boss = tfFalseVictoryState.bossRef;

  if (t === 60)  { tfFalseVictoryState.phase = 'clone'; }
  if (t === 120) {
    tfFalseVictoryState.phase = 'reset';
    // Boss resurrects with full power
    if (boss) {
      boss.health    = 10000;
      boss.maxHealth = 10000;
      boss.invincible = 90;
      boss._tfEndingPrimed = false; // allow Round 2's real ending to trigger at 10% HP
    }
    tfFinalStateActive = true;
    // Restore player weapon (was nulled during Code Realm) so ability key works in Round 2
    const _p1 = players && players[0];
    if (_p1 && !_p1.weapon) {
      const _wk = _p1._savedWeaponKey || _p1.weaponKey || 'sword';
      if (typeof WEAPONS !== 'undefined' && WEAPONS[_wk]) _p1.weapon = WEAPONS[_wk];
    }
    // Activate Paradox fusion on player 1
    tfParadoxFused         = true;
    tfFusionControlMode    = 'player';
    tfFusionSwitchTimer    = tfFusionSwitchInterval;
    tfFusionGlitchTimer    = 0;
    // Reset canonical control-override state; timer=0 so smb-loop initialises it on next tick
    controlState = 'player';
    controlTimer = 0;
    if (typeof showBossDialogue === 'function') {
      showBossDialogue('resetFightState();', 3000);
    }
  }
  if (t >= 240) {
    tfFalseVictoryState = null;
    gameFrozen = false;
  }
}

function drawFalseVictory() {
  if (!tfFalseVictoryState) return;
  const t = tfFalseVictoryState.timer;

  if (tfFalseVictoryState.phase === 'collapse') {
    const glitchAmt = Math.min(1, t / 60);
    ctx.save();
    ctx.globalAlpha = glitchAmt * 0.4;
    ctx.fillStyle = '#ff00ff';
    for (let i = 0; i < 5; i++) {
      const gy = Math.random() * GAME_H;
      ctx.fillRect(0, gy, GAME_W, 1 + Math.random() * 3);
    }
    ctx.restore();
  }

  if (tfFalseVictoryState.phase === 'clone') {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = Math.min(1, (t - 60) / 30);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('> shadow_clone.execute()', canvas.width / 2, canvas.height / 2 - 40);
    ctx.fillText('> resetFightState();',     canvas.width / 2, canvas.height / 2);
    ctx.restore();
  }

  if (tfFalseVictoryState.phase === 'reset' && t < 200) {
    const alpha = Math.max(0, 1 - (t - 120) / 80);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
  }
}

function drawParadoxFusion(player) {
  if (!tfParadoxFused || !player) return;
  tfFusionGlow = Math.min(1, tfFusionGlow + 0.05);

  const paradoxControlling = (tfFusionControlMode === 'paradox');
  // Paradox-controlled: magenta/red palette. Player-controlled: cyan palette.
  const auraColor    = paradoxControlling ? '#ff00cc' : '#00ffff';
  const trailColorA  = paradoxControlling ? '#ff00cc' : '#00ffff';
  const trailColorB  = paradoxControlling ? '#ff4400' : '#ff00ff';
  const auraIntensity = paradoxControlling ? 0.55 : 0.3;
  const auraInner    = paradoxControlling ? (auraColor + 'cc') : 'rgba(0,255,255,0.6)';
  const auraOuter    = paradoxControlling ? (auraColor + '00') : 'rgba(0,255,255,0)';

  ctx.save();
  // Afterimage trail — stronger and more frantic when Paradox is in control
  const trailCount = paradoxControlling ? 5 : 3;
  for (let i = 1; i <= trailCount; i++) {
    ctx.globalAlpha = (paradoxControlling ? 0.22 : 0.15) * (trailCount + 1 - i) / trailCount;
    ctx.fillStyle = i % 2 === 0 ? trailColorA : trailColorB;
    const offX = (player.facing || 1) * -i * 8;
    ctx.fillRect(player.x + offX, player.y, player.w, player.h);
  }

  // Aura glow
  const pulse = 0.8 + 0.2 * Math.sin(frameCount * (paradoxControlling ? 0.18 : 0.1));
  ctx.globalAlpha = tfFusionGlow * auraIntensity * pulse;
  const grad = ctx.createRadialGradient(player.cx(), player.cy(), 5, player.cx(), player.cy(), paradoxControlling ? 80 : 60);
  grad.addColorStop(0, auraInner);
  grad.addColorStop(1, auraOuter);
  ctx.fillStyle = grad;
  ctx.fillRect(player.x - 60, player.y - 60, player.w + 120, player.h + 120);

  // Outline flicker when Paradox is in control to signal the takeover clearly
  if (paradoxControlling) {
    ctx.globalAlpha = 0.6 + 0.4 * Math.sin(frameCount * 0.25);
    ctx.strokeStyle = '#ff00cc';
    ctx.lineWidth = 2.5;
    ctx.shadowColor = '#ff00cc';
    ctx.shadowBlur = 18;
    ctx.strokeRect(player.x - 2, player.y - 2, player.w + 4, player.h + 4);
  }
  ctx.restore();

  // Glitch scanlines on control switch
  if (tfFusionGlitchTimer > 0) {
    tfFusionGlitchTimer--;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = tfFusionGlitchTimer / 20;
    ctx.fillStyle = paradoxControlling ? '#ff00cc' : '#00ffff';
    for (let i = 0; i < 5; i++) {
      const ly = Math.random() * canvas.height;
      ctx.fillRect(0, ly, canvas.width, 1 + Math.random() * 2);
    }
    ctx.restore();
  }

  // Switch-to-Paradox: expanding ring burst + deep magenta flash
  if (tfSwitchToParadoxFlash > 0) {
    tfSwitchToParadoxFlash--;
    const t18 = tfSwitchToParadoxFlash; // 17→0
    const alpha = t18 / 18;
    ctx.save();
    // Expanding ring centered on player
    const ringR = (18 - t18) * 7;
    ctx.globalAlpha = alpha * 0.75;
    ctx.strokeStyle = '#ff00cc';
    ctx.lineWidth = 4 - t18 / 6;
    ctx.shadowColor = '#ff00cc';
    ctx.shadowBlur = 24;
    ctx.beginPath();
    ctx.arc(player.cx(), player.cy(), ringR, 0, Math.PI * 2);
    ctx.stroke();
    // Second smaller ring offset
    ctx.globalAlpha = alpha * 0.4;
    ctx.beginPath();
    ctx.arc(player.cx(), player.cy(), ringR * 0.55, 0, Math.PI * 2);
    ctx.stroke();
    // Screen-space vignette pulse
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = alpha * 0.18;
    ctx.fillStyle = '#ff00cc';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
  }

  // Switch-to-Player: quick cyan fade-out
  if (tfSwitchToPlayerFade > 0) {
    tfSwitchToPlayerFade--;
    const alpha = tfSwitchToPlayerFade / 12;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = alpha * 0.22;
    ctx.fillStyle = '#00ffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
  }
}

// ============================================================
// RESET  (call from _startGameCore to clear state)
// ============================================================
function resetParadoxState() {
  paradoxEntity        = null;
  paradoxReviveActive  = false;
  tfOpeningFightActive    = false;
  tfOpeningDamageDealt    = 0;
  _tfOpeningParadoxAtkCd  = 0;
  _tfOpeningHeroAtkCd     = 90;
  _tfOpeningPhase         = 0;
  _tfOpeningDialogueFired = new Set();
  _tfOpeningTFRef         = null;
  _tfAbsorptionState    = null;
  playerParadoxAbsorbed = false;
  _tfKCOverlay          = null;
  paradoxReviveTimer   = 0;
  paradoxRevivePlayer  = null;
  tfDamageLocked       = false;
  tfDamageLockTimer    = 0;
  tfParadoxEmpowered   = false;
  tfEmpowerTimer       = 0;
  tfFinalParadoxFired  = false;
  bossParadoxForeshadow.active     = false;
  bossParadoxForeshadow.timer      = 0;
  bossParadoxForeshadow.cooldown   = 0;
  bossParadoxForeshadow.punchFired = false;
  // Phase 0 / False Victory state
  tfFalseVictoryFired = false;
  tfFalseVictoryState = null;
  tfParadoxFused      = false;
  tfFusionGlow        = 0;
  tfFusionControlMode = 'player';
  tfFusionSwitchTimer = 0;
  tfFusionGlitchTimer = 0;
  controlState = 'player';
  controlTimer = 0;
  tfSwitchToParadoxFlash = 0;
  tfSwitchToPlayerFade   = 0;
  tfFinalStateActive  = false;
  _paradoxPendingStrikes = [];
  _paradoxEchoHits       = [];
  _paradoxNullFields     = [];
  _paradoxCommandTexts   = [];
}

// ============================================================
// PARADOX ABILITIES SYSTEM
// ============================================================
const PARADOX_ABILITIES = {
  microTeleport: {
    name: 'Micro-Teleport',
    cooldown: 90,
    execute(user) {
      const dir = user.facing || 1;
      const blink = 120;
      user.x += dir * blink;
      user.x = Math.max(0, Math.min(GAME_W - user.w, user.x));
      user.vy = -6;
      if (settings.particles) {
        for (let i = 0; i < 18 && particles.length < MAX_PARTICLES; i++) {
          const _p = _getParticle();
          _p.x = user.cx() - dir * blink * 0.5;
          _p.y = user.cy();
          _p.vx = (Math.random() - 0.5) * 8;
          _p.vy = (Math.random() - 0.5) * 8;
          _p.color = '#00ffff';
          _p.size = 2 + Math.random() * 3;
          _p.life = 18 + Math.random() * 14;
          _p.maxLife = 32;
          particles.push(_p);
        }
      }
      SoundManager.jump && SoundManager.jump();
    }
  },
  phaseDash: {
    name: 'Phase Dash',
    cooldown: 120,
    execute(user, target) {
      if (!target) return;
      const dir = target.cx() > user.cx() ? 1 : -1;
      user.x = target.cx() + dir * (target.w + 5) - user.w / 2;
      user.vx = dir * 8;
      user.invincible = Math.max(user.invincible, 45);
      if (typeof dealDamage === 'function') {
        dealDamage(user, target, 18, 14);
      }
      if (settings.particles) {
        for (let i = 0; i < 22 && particles.length < MAX_PARTICLES; i++) {
          const _p = _getParticle();
          _p.x = user.cx() + (Math.random() - 0.5) * 30;
          _p.y = user.cy() + (Math.random() - 0.5) * 20;
          _p.vx = -dir * (2 + Math.random() * 4);
          _p.vy = (Math.random() - 0.5) * 3;
          _p.color = Math.random() < 0.5 ? '#ffffff' : '#00ffff';
          _p.size = 1.5 + Math.random() * 2.5;
          _p.life = 14 + Math.random() * 12;
          _p.maxLife = 26;
          particles.push(_p);
        }
      }
    }
  },
  futureStrike: {
    name: 'Future Strike',
    cooldown: 180,
    execute(user, target) {
      if (!target) return;
      const predX = target.cx() + (target.vx || 0) * 18;
      const predY = target.y + (target.h / 2);
      _paradoxPendingStrikes.push({
        x: predX, y: predY,
        timer: 0, maxTimer: 55,
        owner: user,
        target: target,
        fired: false
      });
      if (settings.particles) {
        const _p = _getParticle();
        _p.x = predX; _p.y = predY - 20;
        _p.vx = 0; _p.vy = -1;
        _p.color = '#ffcc00';
        _p.size = 6; _p.life = 55; _p.maxLife = 55;
        particles.push(_p);
      }
    }
  },
  echoCombo: {
    name: 'Echo Combo',
    cooldown: 150,
    execute(user, target) {
      if (!target) return;
      for (let i = 0; i < 3; i++) {
        _paradoxEchoHits.push({
          x: user.cx(), y: user.cy(),
          timer: i * 22,
          owner: user, target: target,
          fired: false
        });
      }
      if (typeof dealDamage === 'function') dealDamage(user, target, 12, 8);
    }
  },
  positionSwap: {
    name: 'Position Swap',
    cooldown: 210,
    execute(user, target) {
      if (!target) return;
      const tx = target.x, ty = target.y;
      target.x = user.x; target.y = user.y;
      user.x   = tx;     user.y   = ty;
      if (settings.particles) {
        for (let i = 0; i < 16 && particles.length < MAX_PARTICLES; i++) {
          const _p = _getParticle();
          _p.x = user.cx() + (Math.random()-0.5)*20;
          _p.y = user.cy() + (Math.random()-0.5)*20;
          _p.vx = (Math.random()-0.5)*5;
          _p.vy = (Math.random()-0.5)*5;
          _p.color = '#ff00ff';
          _p.size = 2+Math.random()*3; _p.life = 18+Math.random()*12; _p.maxLife = 30;
          particles.push(_p);
        }
      }
      screenShake = Math.max(screenShake, 12);
    }
  },
  nullField: {
    name: 'Null Field',
    cooldown: 240,
    execute(user) {
      _paradoxNullFields.push({
        x: user.cx(), y: user.cy(),
        r: 90, timer: 0, maxTimer: 300
      });
      if (typeof showBossDialogue === 'function') showBossDialogue('> null_zone.activate();', 160);
    }
  },
  commandInjection: {
    name: 'Command Injection',
    cooldown: 180,
    execute(user, target) {
      if (!target) return;
      _paradoxCommandTexts.push({
        text: '> target.speed = 0;',
        x: target.cx(), y: target.y - 30,
        timer: 0, maxTimer: 90, alpha: 1
      });
      target._pdxSlow = 120;
      if (typeof dealDamage === 'function') dealDamage(user, target, 8, 4);
    }
  },
  projectileRewrite: {
    name: 'Projectile Rewrite',
    cooldown: 90,
    execute(user) {
      if (!projectiles) return;
      let nearest = null, nearDist = 200;
      for (const proj of projectiles) {
        if (proj.owner === user) continue;
        const d = Math.hypot(proj.x - user.cx(), proj.y - user.cy());
        if (d < nearDist) { nearDist = d; nearest = proj; }
      }
      if (nearest) {
        nearest.vx *= -1.4;
        nearest.vy *= -1.2;
        nearest.owner = user;
        nearest.damage = (nearest.damage || 5) + 4;
        if (settings.particles) {
          for (let i = 0; i < 10 && particles.length < MAX_PARTICLES; i++) {
            const _p = _getParticle();
            _p.x = nearest.x; _p.y = nearest.y;
            _p.vx = (Math.random()-0.5)*5; _p.vy = (Math.random()-0.5)*5;
            _p.color = '#00ffff'; _p.size = 2+Math.random()*2;
            _p.life = 12+Math.random()*10; _p.maxLife = 22;
            particles.push(_p);
          }
        }
      }
    }
  },
  perfectShield: {
    name: 'Perfect Shield',
    cooldown: 240,
    execute(user) {
      user.invincible = Math.max(user.invincible, 60);
      user.shielding  = true;
      user._pdxParryTimer = 60;
      if (settings.particles) {
        for (let i = 0; i < 14 && particles.length < MAX_PARTICLES; i++) {
          const _p = _getParticle();
          _p.x = user.cx() + Math.cos(i/14*Math.PI*2)*28;
          _p.y = user.cy() + Math.sin(i/14*Math.PI*2)*28;
          _p.vx = Math.cos(i/14*Math.PI*2)*2; _p.vy = Math.sin(i/14*Math.PI*2)*2;
          _p.color = '#ffffff'; _p.size = 2; _p.life = 25; _p.maxLife = 25;
          particles.push(_p);
        }
      }
    }
  },
  undoHit: {
    name: 'Undo Hit',
    cooldown: 300,
    execute(user) {
      const restore = Math.min(35, user.maxHealth - user.health);
      if (restore > 0) {
        user.health = Math.min(user.maxHealth, user.health + restore);
        if (settings.particles) {
          for (let i = 0; i < 18 && particles.length < MAX_PARTICLES; i++) {
            const _p = _getParticle();
            _p.x = user.cx() + (Math.random()-0.5)*20;
            _p.y = user.cy() + (Math.random()-0.5)*20;
            _p.vx = (Math.random()-0.5)*3; _p.vy = -2-Math.random()*3;
            _p.color = '#00ffcc'; _p.size = 2+Math.random()*3;
            _p.life = 22+Math.random()*18; _p.maxLife = 40;
            particles.push(_p);
          }
        }
        if (typeof showBossDialogue === 'function') showBossDialogue('> rollback(damage);', 140);
      }
    }
  }
};

// Active pending effect arrays
let _paradoxPendingStrikes = [];
let _paradoxEchoHits       = [];
let _paradoxNullFields     = [];
let _paradoxCommandTexts   = [];

// ============================================================
// updateParadoxEffects — called each game frame
// ============================================================
function updateParadoxEffects() {
  // Future Strike: wait then hit
  for (let i = _paradoxPendingStrikes.length - 1; i >= 0; i--) {
    const s = _paradoxPendingStrikes[i];
    s.timer++;
    if (s.timer >= s.maxTimer && !s.fired) {
      s.fired = true;
      if (s.target && s.target.health > 0 && typeof dealDamage === 'function') {
        dealDamage(s.owner, s.target, 28, 18);
        screenShake = Math.max(screenShake, 14);
        if (settings.particles) {
          for (let j = 0; j < 20 && particles.length < MAX_PARTICLES; j++) {
            const _p = _getParticle();
            _p.x = s.x + (Math.random()-0.5)*20; _p.y = s.y + (Math.random()-0.5)*20;
            _p.vx = (Math.random()-0.5)*8; _p.vy = (Math.random()-0.5)*8;
            _p.color = '#ffcc00'; _p.size = 2+Math.random()*4;
            _p.life = 18+Math.random()*16; _p.maxLife = 34;
            particles.push(_p);
          }
        }
      }
    }
    if (s.timer > s.maxTimer + 5) _paradoxPendingStrikes.splice(i, 1);
  }

  // Echo Combo: delayed afterimage hits
  for (let i = _paradoxEchoHits.length - 1; i >= 0; i--) {
    const e = _paradoxEchoHits[i];
    e.timer--;
    if (e.timer <= 0 && !e.fired) {
      e.fired = true;
      if (e.target && e.target.health > 0 && typeof dealDamage === 'function') {
        dealDamage(e.owner, e.target, 10, 6);
      }
      if (settings.particles) {
        const _p = _getParticle();
        _p.x = e.x; _p.y = e.y;
        _p.vx = (Math.random()-0.5)*4; _p.vy = -2-Math.random()*3;
        _p.color = '#00ffff'; _p.size = 3+Math.random()*3;
        _p.life = 12+Math.random()*10; _p.maxLife = 22;
        particles.push(_p);
      }
    }
    if (e.fired) _paradoxEchoHits.splice(i, 1);
  }

  // Null Field: destroy projectiles in zone, apply slow to targets
  for (let i = _paradoxNullFields.length - 1; i >= 0; i--) {
    const nf = _paradoxNullFields[i];
    nf.timer++;
    if (projectiles) {
      for (let j = projectiles.length - 1; j >= 0; j--) {
        const proj = projectiles[j];
        const d = Math.hypot(proj.x - nf.x, proj.y - nf.y);
        if (d < nf.r) {
          projectiles.splice(j, 1);
          if (settings.particles) {
            const _p = _getParticle();
            _p.x = proj.x; _p.y = proj.y;
            _p.vx = (Math.random()-0.5)*3; _p.vy = (Math.random()-0.5)*3;
            _p.color = '#8800ff'; _p.size = 3; _p.life = 12; _p.maxLife = 12;
            particles.push(_p);
          }
        }
      }
    }
    for (const p of players) {
      if (p.isBoss) continue;
      const d = Math.hypot(p.cx() - nf.x, p.cy() - nf.y);
      if (d < nf.r) {
        p.vx *= 0.88;
      }
    }
    if (nf.timer >= nf.maxTimer) _paradoxNullFields.splice(i, 1);
  }

  // Command Injection slow decay
  for (const p of players) {
    if (p._pdxSlow > 0) {
      p._pdxSlow--;
      p.vx *= 0.72;
    }
    if (p._pdxParryTimer > 0) {
      p._pdxParryTimer--;
      if (p._pdxParryTimer <= 0) p.shielding = false;
    }
  }

  // Command text decay
  for (let i = _paradoxCommandTexts.length - 1; i >= 0; i--) {
    const ct = _paradoxCommandTexts[i];
    ct.timer++;
    ct.y -= 0.4;
    ct.alpha = Math.max(0, 1 - ct.timer / ct.maxTimer);
    if (ct.timer >= ct.maxTimer) _paradoxCommandTexts.splice(i, 1);
  }
}

// ============================================================
// drawParadoxEffects — called each game frame (world-space)
// ============================================================
function drawParadoxEffects() {
  // Future Strike markers
  for (const s of _paradoxPendingStrikes) {
    if (s.fired) continue;
    const prog = s.timer / s.maxTimer;
    const pulse = 0.5 + Math.sin(s.timer * 0.3) * 0.3;
    ctx.save();
    ctx.globalAlpha = pulse * (1 - prog * 0.4);
    ctx.strokeStyle = '#ffcc00';
    ctx.lineWidth   = 2;
    ctx.shadowColor = '#ffcc00';
    ctx.shadowBlur  = 14;
    const sz = 12 + prog * 8;
    ctx.beginPath();
    ctx.moveTo(s.x - sz, s.y - sz); ctx.lineTo(s.x + sz, s.y + sz);
    ctx.moveTo(s.x + sz, s.y - sz); ctx.lineTo(s.x - sz, s.y + sz);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(s.x, s.y, 18, -Math.PI/2, -Math.PI/2 + prog * Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Null Field zones
  for (const nf of _paradoxNullFields) {
    const prog = nf.timer / nf.maxTimer;
    const alpha = (1 - prog) * 0.18;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle   = '#8800ff';
    ctx.beginPath();
    ctx.arc(nf.x, nf.y, nf.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = (1 - prog) * 0.35;
    ctx.strokeStyle = '#bb44ff';
    ctx.lineWidth   = 2;
    ctx.shadowColor = '#bb44ff';
    ctx.shadowBlur  = 12;
    ctx.beginPath();
    ctx.arc(nf.x, nf.y, nf.r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Command Injection floating text
  for (const ct of _paradoxCommandTexts) {
    ctx.save();
    ctx.globalAlpha = ct.alpha;
    ctx.fillStyle   = '#00ffcc';
    ctx.font        = 'bold 11px monospace';
    ctx.textAlign   = 'center';
    ctx.shadowColor = '#00ffcc';
    ctx.shadowBlur  = 8;
    ctx.fillText(ct.text, ct.x, ct.y);
    ctx.restore();
  }

  // Echo Combo afterimages
  for (const e of _paradoxEchoHits) {
    if (e.fired) continue;
    const alpha = 0.25 - (e.timer / 22) * 0.1;
    if (alpha <= 0) continue;
    ctx.save();
    ctx.globalAlpha = Math.max(0, alpha);
    ctx.fillStyle   = '#ffcc00';
    ctx.shadowColor = '#ffcc00';
    ctx.shadowBlur  = 8;
    ctx.fillRect(e.x - 9, e.y - 25, 18, 50);
    ctx.restore();
  }
}

// ============================================================
// paradoxFusionUpdateAI — deterministic combat loop for Paradox control phase
// Priority: DODGE > ATTACK > CHASE > REPOSITION
// Never stands still; always faces boss; forces attack when in range.
// ============================================================
function paradoxFusionUpdateAI(fighter) {
  if (!tfParadoxFused || tfFusionControlMode !== 'paradox') return;
  if (!fighter || fighter.health <= 0 || fighter.ragdollTimer > 0 || fighter.stunTimer > 0) return;

  // ── Target ────────────────────────────────────────────────
  const boss = players.find(p => p.isBoss && p.health > 0);
  if (!boss) return;
  fighter.target = boss;

  const dx   = boss.cx() - fighter.cx();
  const dist = Math.abs(dx);
  const dir  = Math.sign(dx) || 1;

  // Always face the boss
  fighter.facing = dir;

  // Init drift tracker
  if (fighter._pdxDriftDir === undefined) fighter._pdxDriftDir = 0;
  if (fighter._pdxDriftFrames === undefined) fighter._pdxDriftFrames = 0;

  const range = (fighter.weapon && fighter.weapon.range) ? fighter.weapon.range : 60;
  const OPTIMAL_DIST = range - 5; // stay just inside attack range

  // ── A. DODGE — check active telegraphs near fighter ───────
  let inDanger = false;
  let dodgeDir = 0;

  // Boss beams (warning or active)
  if (typeof bossBeams !== 'undefined') {
    for (const beam of bossBeams) {
      if (beam.done) continue;
      const beamDist = Math.abs(fighter.cx() - beam.x);
      if (beamDist < 80) {
        inDanger = true;
        dodgeDir = fighter.cx() < beam.x ? -1 : 1; // move away from beam
        break;
      }
    }
  }

  // Black holes
  if (!inDanger && typeof tfBlackHoles !== 'undefined') {
    for (const bh of tfBlackHoles) {
      const bhDist = Math.hypot(fighter.cx() - bh.x, fighter.cy() - bh.y);
      if (bhDist < bh.r + 60) {
        inDanger = true;
        // move directly away from black hole
        dodgeDir = Math.sign(fighter.cx() - bh.x) || (Math.random() < 0.5 ? -1 : 1);
        break;
      }
    }
  }

  // Floor hazard
  if (!inDanger && typeof bossFloorState !== 'undefined' && bossFloorState === 'hazard') {
    // Stay airborne — jump constantly
    inDanger = true;
    dodgeDir = dir; // keep moving toward boss even during floor hazard
  }

  // ── Execute priority ───────────────────────────────────────
  if (inDanger) {
    // A. DODGE: sprint away from danger zone
    fighter.vx = dodgeDir * 7.5;
    if (fighter.onGround) fighter.vy = -17; // jump out of danger
    // Reset drift counter when dodging
    fighter._pdxDriftDir    = dodgeDir;
    fighter._pdxDriftFrames = 0;

  } else if (dist <= range + 10) {
    // B. ATTACK: in range — must attack; maintain close pressure
    if (fighter.cooldown <= 0) {
      fighter.attack(boss);
    }
    // Maintain optimal distance (slight forward pressure, never retreat)
    if (dist > OPTIMAL_DIST) {
      fighter.vx = dir * 2.5;
    } else {
      fighter.vx = dir * 0.8; // micro-pressure, never zero
    }
    fighter._pdxDriftDir    = dir;
    fighter._pdxDriftFrames = 0;

  } else {
    // C. CHASE: close the gap aggressively
    fighter.vx = dir * 6.2;

    // D. REPOSITION drift guard — if drifting backward > 30 frames, force forward
    if (Math.sign(fighter.vx) !== dir) {
      fighter._pdxDriftFrames++;
    } else {
      fighter._pdxDriftFrames = 0;
      fighter._pdxDriftDir    = dir;
    }
    if (fighter._pdxDriftFrames >= 30) {
      fighter.vx = dir * 6.2;
      fighter._pdxDriftFrames = 0;
    }
  }

  // Jump to reach boss on elevated platforms or when far
  if (fighter.onGround && (boss.y < fighter.y - 45 || dist > 260)) {
    fighter.vy = -18;
  }

  // Use Paradox special abilities on top of movement
  paradoxAIUseAbility(fighter);
}

// ============================================================
// paradoxAIUseAbility — called from game loop during AI control phase
// ============================================================
function paradoxAIUseAbility(fighter) {
  if (!tfParadoxFused || tfFusionControlMode !== 'paradox') return;
  if (!fighter || !fighter.target || fighter.target.health <= 0) return;

  if (!fighter._pdxCooldowns) {
    fighter._pdxCooldowns = {};
    for (const k of Object.keys(PARADOX_ABILITIES)) fighter._pdxCooldowns[k] = 0;
  }

  for (const k of Object.keys(fighter._pdxCooldowns)) {
    if (fighter._pdxCooldowns[k] > 0) fighter._pdxCooldowns[k]--;
  }

  const target = fighter.target;
  const dist   = Math.abs(fighter.cx() - target.cx());

  const tryAbility = (key) => {
    if (fighter._pdxCooldowns[key] <= 0) {
      PARADOX_ABILITIES[key].execute(fighter, target);
      fighter._pdxCooldowns[key] = Math.round(PARADOX_ABILITIES[key].cooldown * 0.85);
      return true;
    }
    return false;
  };

  if (fighter.health < fighter.maxHealth * 0.35 && tryAbility('undoHit')) return;

  if (projectiles && projectiles.some(p => p.owner !== fighter && Math.hypot(p.x - fighter.cx(), p.y - fighter.cy()) < 150)) {
    if (tryAbility('projectileRewrite')) return;
  }

  if (dist < 100) {
    if (Math.random() < 0.5 && tryAbility('echoCombo')) return;
    if (tryAbility('phaseDash')) return;
  }

  if (dist >= 100 && dist < 240) {
    if (Math.random() < 0.6 && tryAbility('futureStrike')) return;
    if (tryAbility('commandInjection')) return;
  }

  if (dist >= 240 && tryAbility('microTeleport')) return;

  if (Math.abs(fighter.y - target.y) < 40 && tryAbility('positionSwap')) return;
}

// ============================================================
// paradoxPlayerUseAbility — called from processInput during player control phase
// ============================================================
function paradoxPlayerUseAbility(fighter) {
  if (!tfParadoxFused || tfFusionControlMode !== 'player') return;
  if (!fighter || fighter.health <= 0) return;

  if (!fighter._pdxCooldowns) {
    fighter._pdxCooldowns = {};
    for (const k of Object.keys(PARADOX_ABILITIES)) fighter._pdxCooldowns[k] = 0;
  }

  const target = fighter.target || (players.find(p => p !== fighter && p.health > 0 && p.isBoss));
  if (!target) return;

  const dist = target ? Math.abs(fighter.cx() - target.cx()) : 999;

  for (const k of Object.keys(fighter._pdxCooldowns)) {
    if (fighter._pdxCooldowns[k] > 0) fighter._pdxCooldowns[k]--;
  }

  const tryAbility = (key) => {
    if (fighter._pdxCooldowns[key] <= 0) {
      PARADOX_ABILITIES[key].execute(fighter, target);
      fighter._pdxCooldowns[key] = Math.round(PARADOX_ABILITIES[key].cooldown * 1.15);
      abilityFlashTimer  = 14;
      abilityFlashPlayer = fighter;
      return true;
    }
    return false;
  };

  if (dist < 100) {
    if (tryAbility('phaseDash')) return;
    if (tryAbility('echoCombo')) return;
  } else if (dist < 240) {
    if (tryAbility('commandInjection')) return;
    if (tryAbility('futureStrike')) return;
  } else {
    if (tryAbility('microTeleport')) return;
  }
  for (const k of Object.keys(PARADOX_ABILITIES)) {
    if (tryAbility(k)) return;
  }
}

// ============================================================
// PARADOX COMPANION  — post-final-boss ambient voice system
// Activated once by setting localStorage 'smc_paradox_companion'
// after the TrueForm ending. No UI, no spam.
// ============================================================

// Read persisted flag once on load
let paradoxCompanionActive = localStorage.getItem('smc_paradox_companion') === '1';

// Internal state
let _pdxCompIdleTimer    = 0;   // counts up; fires a line at threshold
let _pdxCompLastArena    = '';  // detect arena change
let _pdxCompCooldown     = 0;   // global cooldown between any lines (frames)
const _PDX_IDLE_MIN      = 3600; // 60s minimum between idle lines
const _PDX_IDLE_VARIANCE = 3600; // up to 60s additional random delay
const _PDX_COOLDOWN      = 900;  // 15s minimum between any two lines

const _PDX_BOSS_START_LINES = [
  "I have seen this fight before. It ends differently now.",
  "He is strong. You are stronger than you were.",
  "I remember the last time you faced him. You did not hesitate.",
  "Do not let him read you. Move first.",
];

const _PDX_AREA_LINES = {
  creator:   ["This place again. The architecture is afraid of you now.", "He built this arena to break you. It did not."],
  void:      ["The void remembers what happened here.", "He thought the void was his. You proved otherwise."],
  _default:  ["New ground. Stay sharp.", "I am still here.", "Different arena. Same outcome."],
};

const _PDX_IDLE_LINES = [
  "Still here.",
  "I watch. That is enough.",
  "You carry what I gave you. Use it well.",
  "The fracture is quiet for now.",
  "I do not sleep. I observe.",
  "Something is coming. Not today.",
];

/**
 * Speak a single line as Paradox. Uses showBossDialogue if available,
 * otherwise silently skips. Respects global cooldown.
 */
function paradoxSpeak(line) {
  if (!paradoxCompanionActive) return;
  if (_pdxCompCooldown > 0) return;
  if (typeof showBossDialogue !== 'function') return;
  showBossDialogue(`[Paradox] ${line}`, 200);
  _pdxCompCooldown = _PDX_COOLDOWN;
}

/**
 * Called once when the TrueForm ending completes (non-intro path).
 * Sets the persistent companion flag.
 */
function activateParadoxCompanion() {
  if (paradoxCompanionActive) return;
  paradoxCompanionActive = true;
  localStorage.setItem('smc_paradox_companion', '1');
}

/**
 * Called at boss/trueform game start, after players[] is populated.
 * Fires a single contextual line with a short delay so it lands
 * after the opening animation settles.
 */
function paradoxOnBossStart() {
  if (!paradoxCompanionActive) return;
  const line = _PDX_BOSS_START_LINES[Math.floor(Math.random() * _PDX_BOSS_START_LINES.length)];
  // Delay 4 seconds — let opening cinematics breathe
  setTimeout(() => paradoxSpeak(line), 4000);
}

/**
 * Called from updateParadoxCompanion() when arena changes mid-session.
 */
function _paradoxOnAreaChange(arenaKey) {
  if (!paradoxCompanionActive) return;
  const pool = _PDX_AREA_LINES[arenaKey] || _PDX_AREA_LINES._default;
  const line = pool[Math.floor(Math.random() * pool.length)];
  paradoxSpeak(line);
}

/**
 * Tick function — called each frame from gameLoop.
 * Handles cooldown decay, arena-change detection, and rare idle lines.
 */
function updateParadoxCompanion() {
  if (!paradoxCompanionActive || !gameRunning) return;

  if (_pdxCompCooldown > 0) _pdxCompCooldown--;

  // Arena-change detection
  if (typeof currentArenaKey !== 'undefined' && currentArenaKey !== _pdxCompLastArena) {
    if (_pdxCompLastArena !== '') _paradoxOnAreaChange(currentArenaKey);
    _pdxCompLastArena = currentArenaKey;
  }

  // Rare idle line — only during active gameplay, not during cinematics
  if (!isCinematic) {
    _pdxCompIdleTimer++;
    const threshold = _PDX_IDLE_MIN + Math.floor(Math.random() * _PDX_IDLE_VARIANCE);
    if (_pdxCompIdleTimer >= threshold) {
      _pdxCompIdleTimer = 0;
      // ~40% chance to actually speak when threshold reached (keeps it rare)
      if (Math.random() < 0.4) {
        const line = _PDX_IDLE_LINES[Math.floor(Math.random() * _PDX_IDLE_LINES.length)];
        paradoxSpeak(line);
      }
    }
  }
}
