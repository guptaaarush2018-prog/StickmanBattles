'use strict';
// smb-paradox-return-cin.js — TF kicks Paradox out + Paradox return-1000 cinematics
// Depends on: smb-globals.js, smb-paradox-class.js (and preceding splits in chain)

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

