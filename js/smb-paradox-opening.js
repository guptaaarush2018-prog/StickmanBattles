'use strict';
// smb-paradox-opening.js — TF opening fight cinematic (startTFOpeningFight, updateTFOpeningFight)
// Depends on: smb-globals.js, smb-paradox-class.js (and preceding splits in chain)

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

