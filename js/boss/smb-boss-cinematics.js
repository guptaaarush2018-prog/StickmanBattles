// smb-boss-cinematics.js
// Cinematic sequencer: startCinematic/endCinematic/updateCinematic, phase transition factories.
// Depends on: smb-globals.js, smb-cinematics.js
// Must load: AFTER smb-boss.js, BEFORE smb-loop.js

// ============================================================
// CINEMATIC MANAGER
// ============================================================
function startCinematic(seq) {
  if (onlineMode) return; // skip cinematics in online multiplayer (sync too complex)
  if (activeCinematic) endCinematic();
  activeCinematic = Object.assign({ timer: 0 }, seq);
  isCinematic = true;
  // Hard freeze: halt physics, input, and hazard damage so player cannot die during cinematics
  gameFrozen = true;
  // Freeze all player velocities to prevent mid-air drift during cinematic
  if (typeof players !== 'undefined') {
    for (const p of players) {
      if (!p.isBoss && p.health > 0) { p.vx = 0; p.vy = Math.min(p.vy, 0); }
    }
  }
}

function updateCinematic() {
  if (!activeCinematic) return;
  activeCinematic.timer++;
  const t = activeCinematic.timer / 60; // seconds
  activeCinematic.update(t);
  if (activeCinematic.timer >= activeCinematic.durationFrames) {
    endCinematic();
  }
}

function endCinematic() {
  if (!activeCinematic) return;
  // Respawn any players that were hidden during the cinematic at a safe position
  if (activeCinematic.hidePlayers && typeof players !== 'undefined' && typeof pickSafeSpawn === 'function') {
    for (const idx of activeCinematic.hidePlayers) {
      const p = players[idx];
      if (p && p.health > 0) {
        const spawn = pickSafeSpawn(idx === 0 ? 'left' : 'right');
        p.x  = spawn.x - p.w / 2;
        p.y  = spawn.y - p.h;
        p.vx = 0;
        p.vy = 0;
      }
    }
  }
  if (activeCinematic.onEnd) activeCinematic.onEnd();
  activeCinematic = null;
  isCinematic = false;
  slowMotion = 1.0;
  cinematicCamOverride = false;
  gameFrozen = false; // resume physics and input
}

// ============================================================
// CINEMATIC SEQUENCES — one factory per boss × phase
// ============================================================
function _makeBossPhase2Cinematic(boss) {
  return {
    durationFrames: 150, // 2.5 s
    _slamFired: false, _roarFired: false,
    _phaseLabel: { text: '— PHASE II —', color: '#cc00ee' },
    update(t) {
      // Slow motion ramp: 0.15× during cinematic, fade out at end
      if (t < 0.4)      slowMotion = Math.max(0.15, 1 - t * 2.1);
      else if (t > 1.8) slowMotion = Math.min(1.0, (t - 1.8) / 0.7);
      else              slowMotion = 0.15;

      // Camera zoom in on boss
      cinematicCamOverride = t < 2.2;
      if (cinematicCamOverride && boss) {
        cinematicZoomTarget = 1 + Math.min(0.55, t * 0.4);
        cinematicFocusX = boss.cx();
        cinematicFocusY = boss.cy();
      }

      // 0.6 s: slam — rings + particles + player knockback
      if (t >= 0.6 && !this._slamFired) {
        this._slamFired = true;
        if (boss) {
          for (let i = 0; i < 5; i++) {
            phaseTransitionRings.push({ cx: boss.cx(), cy: boss.cy(),
              r: 5 + i*14, maxR: 240 + i*30, timer: 65+i*11, maxTimer: 65+i*11,
              color: i%2===0 ? '#cc00ee' : '#ff44ff', lineWidth: 4-i*0.5 });
          }
          spawnParticles(boss.cx(), boss.cy(), '#cc00ee', 40);
          spawnParticles(boss.cx(), boss.cy(), '#ffffff', 25);
          spawnParticles(boss.cx(), boss.cy(), '#ff44ff', 18);
          screenShake = Math.max(screenShake, 32);
          for (const p of players) {
            if (p.isBoss || p.health <= 0) continue;
            const dir = p.cx() >= boss.cx() ? 1 : -1;
            p.vx += dir * 13; p.vy = Math.min(p.vy, -9);
            p.hurtTimer = Math.max(p.hurtTimer, 16);
          }
        }
      }
      // 1.05 s: dialogue
      if (t >= 1.05 && !this._roarFired) {
        this._roarFired = true;
        showBossDialogue('I was being patient. That ends now.', 220);
      }
    },
    onEnd() { slowMotion = 1.0; cinematicCamOverride = false; }
  };
}

function _makeBossPhase3Cinematic(boss) {
  return {
    durationFrames: 180, // 3.0 s
    _slamFired: false, _roarFired: false,
    _phaseLabel: { text: '— PHASE III —', color: '#ff44aa' },
    update(t) {
      if (t < 0.3)      slowMotion = Math.max(0.05, 1 - t * 3.2);
      else if (t > 2.2) slowMotion = Math.min(1.0, (t - 2.2) / 0.8);
      else              slowMotion = 0.05;

      cinematicCamOverride = t < 2.6;
      if (cinematicCamOverride && boss) {
        cinematicZoomTarget = Math.min(1.8, 1 + t * 0.55);
        cinematicFocusX = boss.cx();
        cinematicFocusY = boss.cy();
      }

      if (t >= 0.55 && !this._slamFired) {
        this._slamFired = true;
        if (boss) {
          for (let i = 0; i < 6; i++) {
            phaseTransitionRings.push({ cx: boss.cx(), cy: boss.cy(),
              r: 5+i*12, maxR: 340+i*30, timer: 70+i*12, maxTimer: 70+i*12,
              color: i%2===0 ? '#cc00ee' : '#ff0077', lineWidth: 5-i*0.6 });
          }
          spawnParticles(boss.cx(), boss.cy(), '#cc00ee', 55);
          spawnParticles(boss.cx(), boss.cy(), '#ffffff', 35);
          spawnParticles(boss.cx(), boss.cy(), '#ff0000', 22);
          screenShake = Math.max(screenShake, 48);
          if (settings.phaseFlash) bossPhaseFlash = 70;
          for (const p of players) {
            if (p.isBoss || p.health <= 0) continue;
            const dir = p.cx() >= boss.cx() ? 1 : -1;
            p.vx += dir * 20; p.vy = Math.min(p.vy, -14);
            p.hurtTimer = Math.max(p.hurtTimer, 22);
          }
        }
      }
      if (t >= 1.2 && !this._roarFired) {
        this._roarFired = true;
        showBossDialogue('Now you see why I built this world.', 250);
      }
    },
    onEnd() { slowMotion = 1.0; cinematicCamOverride = false; }
  };
}

function _makeTFPhase2Cinematic(tf) {
  return {
    durationFrames: 150, // 2.5 s
    _burstFired: false, _roarFired: false,
    _phaseLabel: { text: '— FORM II —', color: '#aaaaaa' },
    update(t) {
      if (t < 0.35)     slowMotion = Math.max(0.1, 1 - t * 2.6);
      else if (t > 1.8) slowMotion = Math.min(1.0, (t - 1.8) / 0.7);
      else              slowMotion = 0.1;

      cinematicCamOverride = t < 2.1;
      if (cinematicCamOverride && tf) {
        cinematicZoomTarget = Math.min(1.5, 1 + t * 0.4);
        cinematicFocusX = tf.cx(); cinematicFocusY = tf.cy();
      }

      if (t >= 0.65 && !this._burstFired) {
        this._burstFired = true;
        if (tf) {
          for (let i = 0; i < 5; i++) {
            phaseTransitionRings.push({ cx: tf.cx(), cy: tf.cy(),
              r: 5+i*13, maxR: 260+i*28, timer: 62+i*11, maxTimer: 62+i*11,
              color: i%2===0 ? '#ffffff' : '#888888', lineWidth: 4-i*0.5 });
          }
          spawnParticles(tf.cx(), tf.cy(), '#ffffff', 45);
          spawnParticles(tf.cx(), tf.cy(), '#000000', 30);
          spawnParticles(tf.cx(), tf.cy(), '#aaaaaa', 20);
          screenShake = Math.max(screenShake, 36);
          for (const p of players) {
            if (p.isBoss || p.health <= 0) continue;
            const dir = p.cx() >= tf.cx() ? 1 : -1;
            p.vx += dir * 14; p.vy = Math.min(p.vy, -10);
            p.hurtTimer = Math.max(p.hurtTimer, 18);
          }
        }
      }
      if (t >= 1.1 && !this._roarFired) {
        this._roarFired = true;
        showBossDialogue('You surprised me. That almost never happens.', 250);
      }
    },
    onEnd() { slowMotion = 1.0; cinematicCamOverride = false; }
  };
}

function _makeTFPhase3Cinematic(tf) {
  return {
    durationFrames: 210, // 3.5 s
    _voidFired: false, _roarFired: false,
    _phaseLabel: { text: '— TRUE FORM —', color: '#ffffff' },
    update(t) {
      if (t < 0.25)     slowMotion = Math.max(0.02, 1 - t * 3.9);
      else if (t > 2.7) slowMotion = Math.min(1.0, (t - 2.7) / 0.8);
      else              slowMotion = 0.02;

      cinematicCamOverride = t < 3.1;
      if (cinematicCamOverride && tf) {
        cinematicZoomTarget = Math.min(2.0, 1 + t * 0.55);
        cinematicFocusX = tf.cx(); cinematicFocusY = tf.cy();
      }

      if (t >= 0.5 && !this._voidFired) {
        this._voidFired = true;
        if (tf) {
          for (let i = 0; i < 7; i++) {
            phaseTransitionRings.push({ cx: tf.cx(), cy: tf.cy(),
              r: 5+i*10, maxR: 400+i*22, timer: 72+i*13, maxTimer: 72+i*13,
              color: i%2===0 ? '#ffffff' : '#000000', lineWidth: 5-i*0.5 });
          }
          spawnParticles(tf.cx(), tf.cy(), '#ffffff', 65);
          spawnParticles(tf.cx(), tf.cy(), '#000000', 50);
          spawnParticles(tf.cx(), tf.cy(), '#555555', 28);
          screenShake = Math.max(screenShake, 55);
          if (settings.phaseFlash) bossPhaseFlash = 80;
          for (const p of players) {
            if (p.isBoss || p.health <= 0) continue;
            const dir = p.cx() >= tf.cx() ? 1 : -1;
            p.vx += dir * 24; p.vy = Math.min(p.vy, -18);
            p.hurtTimer = Math.max(p.hurtTimer, 25);
          }
        }
      }
      if (t >= 1.5 && !this._roarFired) {
        this._roarFired = true;
        showBossDialogue('No more fractions. All of it.', 280);
      }
    },
    onEnd() { slowMotion = 1.0; cinematicCamOverride = false; }
  };
}

// ============================================================
// CINEMATIC SEQUENCES — ForestBeast and Yeti
// ============================================================
function _makeBeastPhase2Cinematic(beast) {
  return {
    durationFrames: 150, // 2.5 s
    _rageFired: false, _roarFired: false,
    _phaseLabel: { text: '— BEAST UNLEASHED —', color: '#cc4400' },
    update(t) {
      // Slow motion: slam on slow-mo, fade back at end
      if (t < 0.3)      slowMotion = Math.max(0.15, 1 - t * 3.0);
      else if (t > 1.8) slowMotion = Math.min(1.0,  (t - 1.8) / 0.7);
      else              slowMotion = 0.15;

      // Camera zoom to beast
      cinematicCamOverride = t < 2.2;
      if (cinematicCamOverride && beast) {
        cinematicZoomTarget = Math.min(1.6, 1 + t * 0.45);
        cinematicFocusX = beast.cx();
        cinematicFocusY = beast.cy();
      }

      // 0.5 s: ground slam — rings + particles + knockback
      if (t >= 0.5 && !this._rageFired) {
        this._rageFired = true;
        if (beast) {
          for (let i = 0; i < 5; i++) {
            phaseTransitionRings.push({
              cx: beast.cx(), cy: beast.cy(),
              r: 5 + i * 12, maxR: 260 + i * 28,
              timer: 65 + i * 11, maxTimer: 65 + i * 11,
              color: i % 2 === 0 ? '#cc4400' : '#ff8800', lineWidth: 4 - i * 0.5
            });
          }
          spawnParticles(beast.cx(), beast.cy(), '#cc4400', 40);
          spawnParticles(beast.cx(), beast.cy(), '#ff8800', 25);
          spawnParticles(beast.cx(), beast.cy(), '#ffff00', 12);
          screenShake = Math.max(screenShake, 35);
          for (const p of players) {
            if (p.health <= 0) continue;
            const dir = p.cx() >= beast.cx() ? 1 : -1;
            p.vx += dir * 11;  p.vy = Math.min(p.vy, -8);
            p.hurtTimer = Math.max(p.hurtTimer, 14);
          }
        }
      }
      // 1.0 s: roar text
      if (t >= 1.0 && !this._roarFired) {
        this._roarFired = true;
        if (settings.dmgNumbers && beast)
          damageTexts.push(new DamageText(beast.cx(), beast.y - 30, 'RAAAWR!', '#ff6600'));
      }
    },
    onEnd() { slowMotion = 1.0; cinematicCamOverride = false; }
  };
}

function _makeYetiPhase2Cinematic(yetiEnt) {
  return {
    durationFrames: 180, // 3.0 s
    _leapFired: false, _slamFired: false, _roarFired: false,
    _phaseLabel: { text: '— BLIZZARD RAGE —', color: '#88ccff' },
    update(t) {
      if (t < 0.3)      slowMotion = Math.max(0.10, 1 - t * 3.1);
      else if (t > 2.2) slowMotion = Math.min(1.0,  (t - 2.2) / 0.8);
      else              slowMotion = 0.10;

      // Camera zoom to yeti
      cinematicCamOverride = t < 2.6;
      if (cinematicCamOverride && yetiEnt) {
        cinematicZoomTarget = Math.min(1.7, 1 + t * 0.48);
        cinematicFocusX = yetiEnt.cx();
        cinematicFocusY = yetiEnt.cy();
      }

      // 0.5 s: yeti leaps upward
      if (t >= 0.5 && !this._leapFired) {
        this._leapFired = true;
        if (yetiEnt) yetiEnt.vy = Math.min(yetiEnt.vy, -22);
      }

      // 1.2 s: slam down + ice shockwave
      if (t >= 1.2 && !this._slamFired) {
        this._slamFired = true;
        if (yetiEnt) {
          yetiEnt.vy = Math.max(yetiEnt.vy, 18); // force downward
          for (let i = 0; i < 6; i++) {
            phaseTransitionRings.push({
              cx: yetiEnt.cx(), cy: yetiEnt.cy(),
              r: 5 + i * 12, maxR: 300 + i * 30,
              timer: 68 + i * 12, maxTimer: 68 + i * 12,
              color: i % 2 === 0 ? '#88ccff' : '#ffffff', lineWidth: 4.5 - i * 0.5
            });
          }
          spawnParticles(yetiEnt.cx(), yetiEnt.cy(), '#aaddff', 50);
          spawnParticles(yetiEnt.cx(), yetiEnt.cy(), '#ffffff', 30);
          spawnParticles(yetiEnt.cx(), yetiEnt.cy(), '#0066ff', 18);
          screenShake = Math.max(screenShake, 42);
          if (settings.phaseFlash) bossPhaseFlash = 55;
          for (const p of players) {
            if (p.health <= 0) continue;
            const dir = p.cx() >= yetiEnt.cx() ? 1 : -1;
            p.vx += dir * 16;  p.vy = Math.min(p.vy, -12);
            p.stunTimer  = Math.max(p.stunTimer  || 0, 40);
            p.hurtTimer  = Math.max(p.hurtTimer, 18);
          }
        }
      }
      // 1.8 s: roar text
      if (t >= 1.8 && !this._roarFired) {
        this._roarFired = true;
        if (settings.dmgNumbers && yetiEnt)
          damageTexts.push(new DamageText(yetiEnt.cx(), yetiEnt.y - 35, 'BLIZZARD!', '#aaddff'));
      }
    },
    onEnd() { slowMotion = 1.0; cinematicCamOverride = false; }
  };
}

// ============================================================
// PHASE TRANSITION — triggers appropriate cinematic sequence
// ============================================================
function triggerPhaseTransition(entity, phase) {
  if (entity.isTrueForm) {
    startCinematic(phase === 2 ? _makeTFPhase2Cinematic(entity) : _makeTFPhase3Cinematic(entity));
  } else if (entity.isBeast) {
    startCinematic(_makeBeastPhase2Cinematic(entity));
  } else if (entity.isYeti) {
    startCinematic(_makeYetiPhase2Cinematic(entity));
  } else {
    startCinematic(phase === 2 ? _makeBossPhase2Cinematic(entity) : _makeBossPhase3Cinematic(entity));
  }
}

// ── GRAB CINEMATIC ────────────────────────────────────────────────────────────
function _makeTFGrabCinematic(tf, target) {
  let _phase1Done = false, _phase2Done = false, _phase3Done = false;
  return {
    durationFrames: 90,
    update(t) {
      // 0-0.25s: slowmo + zoom to both
      if (t < 0.5) {
        slowMotion = Math.max(0.15, 1 - t * 2.5);
        cinematicCamOverride = true;
        if (tf && target) {
          cinematicFocusX  = (tf.cx() + target.cx()) * 0.5;
          cinematicFocusY  = (tf.cy() + target.cy()) * 0.5;
          cinematicZoomTarget = Math.min(1.6, 1 + t * 1.2);
        }
      }
      // 0.25s: boss teleports adjacent + grab lock
      if (t >= 0.25 && !_phase1Done) {
        _phase1Done = true;
        if (tf && target && target.health > 0) {
          const gDir = target.cx() > tf.cx() ? 1 : -1;
          tf.x = clamp(target.cx() - gDir * 28 - tf.w / 2, 20, GAME_W - tf.w - 20);
          tf.y = target.y;
          tf.vx = 0; tf.vy = 0;
          target.vx = 0; target.vy = 0;
          target.stunTimer = 55; // player is grabbed — brief stun
          screenShake = Math.max(screenShake, 18);
          spawnParticles(tf.cx(), tf.cy(), '#000000', 22);
          spawnParticles(tf.cx(), tf.cy(), '#ffffff', 10);
        }
      }
      // 0.5-0.9s: lift player upward
      if (t >= 0.5 && t < 0.9 && target && target.health > 0 && target.stunTimer > 0) {
        target.vy = -6;
        target.x  = clamp(tf.cx() + 10 - target.w / 2, 20, GAME_W - target.w - 20);
      }
      // 0.9s: throw — release with strong horizontal velocity
      if (t >= 0.9 && !_phase2Done) {
        _phase2Done = true;
        if (target && target.health > 0) {
          const throwDir = tf.facing || 1;
          target.vx = throwDir * 22;
          target.vy = -10;
          target.stunTimer = 0;
          screenShake = Math.max(screenShake, 24);
          spawnParticles(target.cx(), target.cy(), '#ffffff', 18);
          dealDamage(tf, target, 28, 14);
        }
      }
      // 1.2s: restore camera + slowmo
      if (t >= 1.2 && !_phase3Done) {
        _phase3Done = true;
        cinematicCamOverride = false;
        slowMotion = 1.0;
      }
    },
    draw() {},
    done: false,
  };
}
