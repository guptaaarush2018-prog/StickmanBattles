'use strict';
// smb-boss-tf-legacy.js — DELETED cinematic stubs (dead code kept for reference) + triggerPhaseTransition
// Depends on: smb-globals.js, smb-boss-phase-cin.js
// Must load AFTER smb-boss-phase-cin.js, BEFORE smb-boss-tf-attacks1.js

// ============================================================
// MID-FIGHT CINEMATICS — see js/smc-cinematics.js for all 6 factory fns
// ============================================================
// _makeBossWarning75Cinematic, _makeBossRage40Cinematic, _makeBossDesp10Cinematic,
// _makeTFEntryCinematic, _makeTFReality50Cinematic, _makeTFDesp15Cinematic
// are all defined in smc-cinematics.js using the cinScript() API.
/* DELETED OLD IMPLEMENTATIONS BELOW — kept as dead code marker only */
function _DELETED_makeBossWarning75Cinematic(boss) {
  return {
    durationFrames: 180, // 3 s
    _warnFired: false, _line1Fired: false, _line2Fired: false,
    _phaseLabel: { text: '— MY WORLD —', color: '#cc00ee' },
    update(t) {
      if (t < 0.3)      slowMotion = Math.max(0.18, 1 - t * 2.7);
      else if (t > 2.2) slowMotion = Math.min(1.0, (t - 2.2) / 0.8);
      else              slowMotion = 0.18;

      cinematicCamOverride = t < 2.6;
      if (cinematicCamOverride && boss) {
        cinematicZoomTarget = Math.min(1.4, 1 + t * 0.28);
        cinematicFocusX = boss.cx();
        cinematicFocusY = boss.cy() - 30 * Math.min(1, t * 1.2); // camera drifts upward
      }

      // 0.5 s: boss floats upward + rings + hazard warning begins
      if (t >= 0.5 && !this._warnFired) {
        this._warnFired = true;
        if (boss) {
          boss.vy = Math.min(boss.vy, -14); // float upward
          for (let i = 0; i < 4; i++) {
            phaseTransitionRings.push({ cx: boss.cx(), cy: boss.cy(),
              r: 8 + i * 18, maxR: 200 + i * 40, timer: 60 + i * 12, maxTimer: 60 + i * 12,
              color: i % 2 === 0 ? '#aa00cc' : '#ff88ff', lineWidth: 3.5 - i * 0.5 });
          }
          spawnParticles(boss.cx(), boss.cy(), '#cc00ee', 30);
          spawnParticles(boss.cx(), boss.cy(), '#ffffff', 18);
          screenShake = Math.max(screenShake, 22);
          // Trigger arena hazard warning early
          if (typeof bossFloorState !== 'undefined' && bossFloorState === 'normal') {
            bossFloorState = 'warning';
            bossFloorTimer = BOSS_FLOOR_WARNING_FRAMES;
            bossFloorType  = Math.random() < 0.5 ? 'lava' : 'void';
          }
        }
      }
      if (t >= 0.9 && !this._line1Fired) {
        this._line1Fired = true;
        showBossDialogue('This world obeys me. So does this fight.', 200);
      }
      if (t >= 1.8 && !this._line2Fired) {
        this._line2Fired = true;
        showBossDialogue('And I designed it breakable.', 200);
      }
    },
    onEnd() { slowMotion = 1.0; cinematicCamOverride = false; }
  };
}

function _DELETED_makeBossRage40Cinematic(boss) {
  return {
    durationFrames: 240, // 4 s
    _grabFired: false, _slamFired: false, _line1Fired: false, _line2Fired: false,
    _throwTarget: null,
    _phaseLabel: { text: '— ENOUGH. —', color: '#ff0044' },
    update(t) {
      // Phase 1 (0–0.4s): freeze into the moment
      // Phase 2 (0.4–1.1s): speed up so the throw VISUALLY travels across the screen
      // Phase 3 (1.1–1.6s): freeze for impact / slam
      // Phase 4 (1.6–3.5s): slow crawl for dialogue, then ramp back
      if      (t < 0.4)  slowMotion = Math.max(0.05, 1 - t * 2.4);   // ramp down to near-freeze
      else if (t < 1.1)  slowMotion = Math.min(0.55, (t - 0.4) * 0.8); // ramp UP — throw is visible
      else if (t < 1.6)  slowMotion = Math.max(0.05, 0.55 - (t - 1.1) * 1.1); // freeze for slam impact
      else if (t > 3.7)  slowMotion = Math.min(1.0, (t - 3.7) / 0.3);
      else               slowMotion = 0.06;                              // crawl for dialogue

      cinematicCamOverride = t < 3.9;
      if (cinematicCamOverride && boss) {
        const trackTarget = this._throwTarget || players.find(p => !p.isBoss && p.health > 0);
        // During throw (0.4–1.1s) follow the flying player; otherwise focus between boss & player
        const focusX = (t >= 0.4 && t < 1.2 && trackTarget)
          ? trackTarget.cx()
          : trackTarget ? (boss.cx() + trackTarget.cx()) * 0.5 : boss.cx();
        cinematicZoomTarget = t < 0.4 ? Math.min(1.8, 1 + t * 2.0)  // zoom in fast
                            : t < 1.1 ? Math.max(0.9, 1.8 - (t - 0.4) * 1.3) // zoom out to follow throw
                            : Math.min(1.5, 0.9 + (t - 1.1) * 0.8);
        cinematicFocusX = focusX;
        cinematicFocusY = trackTarget ? trackTarget.cy() : boss.cy();
      }

      // 0.4 s: boss teleports directly behind player and hurls them
      if (t >= 0.4 && !this._grabFired) {
        this._grabFired = true;
        const target = players.find(p => !p.isBoss && p.health > 0);
        if (boss && target) {
          this._throwTarget = target;
          // Teleport boss right behind the player (same side as their back)
          const facingRight = target.vx >= 0;
          const behindX = facingRight ? target.cx() - 55 : target.cx() + 55;
          boss.x = behindX - boss.w / 2;
          boss.y = target.y;
          boss.vy = 0;
          spawnParticles(boss.cx(), boss.cy(), '#cc00ee', 35);
          spawnParticles(boss.cx(), boss.cy(), '#ff44ff', 20);
          spawnParticles(target.cx(), target.cy(), '#ff0044', 20);
          screenShake = Math.max(screenShake, 22);
          // Throw: opposite direction to behind offset, arc upward
          const throwDir = facingRight ? 1 : -1;
          target.vx = throwDir * 22;
          target.vy = -14;
          target.hurtTimer = Math.max(target.hurtTimer, 35);
          target.stunTimer  = Math.max(target.stunTimer || 0, 30); // brief stun so player can't air-dodge
        }
      }

      // 1.1 s: boss slam hits the ground as player lands — shockwave
      if (t >= 1.1 && !this._slamFired) {
        this._slamFired = true;
        if (boss) {
          boss.vy = 28;
          const slamX = this._throwTarget ? (boss.cx() + this._throwTarget.cx()) * 0.5 : boss.cx();
          for (let i = 0; i < 6; i++) {
            phaseTransitionRings.push({ cx: slamX, cy: GAME_H - 60,
              r: 5 + i * 18, maxR: 320 + i * 40, timer: 70 + i * 12, maxTimer: 70 + i * 12,
              color: i % 2 === 0 ? '#ff0044' : '#ff8800', lineWidth: 4.5 - i * 0.5 });
          }
          spawnParticles(slamX, GAME_H - 60, '#ff0044', 55);
          spawnParticles(slamX, GAME_H - 60, '#ffffff', 30);
          screenShake = Math.max(screenShake, 52);
          for (const p of players) {
            if (p.isBoss || p.health <= 0) continue;
            const dir = p.cx() >= slamX ? 1 : -1;
            p.vx += dir * 14; p.vy = Math.min(p.vy, -10);
            p.hurtTimer = Math.max(p.hurtTimer, 18);
          }
        }
      }

      if (t >= 1.5 && !this._line1Fired) {
        this._line1Fired = true;
        showBossDialogue('Enough.', 140);
      }
      if (t >= 2.2 && !this._line2Fired) {
        this._line2Fired = true;
        showBossDialogue('I will ERASE you.', 220);
      }
    },
    onEnd() { slowMotion = 1.0; cinematicCamOverride = false; }
  };
}

function _DELETED_makeBossDesp10Cinematic(boss) {
  return {
    durationFrames: 180, // 3 s
    _staggerFired: false, _despFired: false, _line1Fired: false, _line2Fired: false,
    _phaseLabel: { text: '— IMPOSSIBLE —', color: '#ffffff' },
    update(t) {
      if (t < 0.2)      slowMotion = Math.max(0.04, 1 - t * 4.8);
      else if (t > 2.2) slowMotion = Math.min(1.0, (t - 2.2) / 0.8);
      else              slowMotion = 0.04;

      cinematicCamOverride = t < 2.6;
      if (cinematicCamOverride && boss) {
        cinematicZoomTarget = Math.min(1.85, 1 + t * 0.55);
        cinematicFocusX = boss.cx();
        cinematicFocusY = boss.cy();
      }

      // 0.35 s: boss staggers visually — shake + rings
      if (t >= 0.35 && !this._staggerFired) {
        this._staggerFired = true;
        if (boss) {
          boss.hurtTimer = 30;
          boss.stunTimer = 18;
          boss.vx *= 0.1;
          for (let i = 0; i < 6; i++) {
            phaseTransitionRings.push({ cx: boss.cx(), cy: boss.cy(),
              r: 8 + i * 12, maxR: 180 + i * 25, timer: 55 + i * 10, maxTimer: 55 + i * 10,
              color: i % 2 === 0 ? '#ffffff' : '#ff4444', lineWidth: 3 - i * 0.35 });
          }
          spawnParticles(boss.cx(), boss.cy(), '#ffffff', 50);
          spawnParticles(boss.cx(), boss.cy(), '#ff0000', 32);
          spawnParticles(boss.cx(), boss.cy(), '#cc00ee', 20);
          screenShake = Math.max(screenShake, 40);
          if (settings.phaseFlash) bossPhaseFlash = 60;
        }
      }

      // 1.0 s: activate desperation mode
      if (t >= 1.0 && !this._despFired) {
        this._despFired = true;
        bossDesperationMode  = true;
        bossDesperationFlash = 90;
        if (boss) {
          bossStaggerTimer = 0; // end stagger so it can fight
        }
      }

      if (t >= 0.8 && !this._line1Fired) {
        this._line1Fired = true;
        showBossDialogue('Impossible...', 200);
      }
      if (t >= 1.5 && !this._line2Fired) {
        this._line2Fired = true;
        showBossDialogue('You refuse to break!', 220);
      }
    },
    onEnd() { slowMotion = 1.0; cinematicCamOverride = false; }
  };
}

// ============================================================
// MID-FIGHT CINEMATICS — True Form (entry, 50%, 15%)
// ============================================================
function _DELETED_makeTFEntryCinematic(tf) {
  return {
    durationFrames: 240, // 4 s
    _burstFired: false, _line1Fired: false, _line2Fired: false,
    _phaseLabel: { text: '— TRUE FORM —', color: '#ffffff' },
    update(t) {
      if (t < 0.3)      slowMotion = Math.max(0.08, 1 - t * 3.1);
      else if (t > 3.1) slowMotion = Math.min(1.0, (t - 3.1) / 0.9);
      else              slowMotion = 0.08;

      cinematicCamOverride = t < 3.6;
      if (cinematicCamOverride && tf) {
        cinematicZoomTarget = Math.min(1.65, 1 + t * 0.38);
        cinematicFocusX = tf.cx();
        cinematicFocusY = tf.cy();
      }

      // 0.6 s: energy burst pushes players, rings expand
      if (t >= 0.6 && !this._burstFired) {
        this._burstFired = true;
        if (tf) {
          for (let i = 0; i < 6; i++) {
            phaseTransitionRings.push({ cx: tf.cx(), cy: tf.cy(),
              r: 5 + i * 14, maxR: 320 + i * 30, timer: 68 + i * 12, maxTimer: 68 + i * 12,
              color: i % 2 === 0 ? '#ffffff' : '#333333', lineWidth: 4 - i * 0.5 });
          }
          spawnParticles(tf.cx(), tf.cy(), '#ffffff', 55);
          spawnParticles(tf.cx(), tf.cy(), '#000000', 40);
          spawnParticles(tf.cx(), tf.cy(), '#888888', 25);
          screenShake = Math.max(screenShake, 38);
          if (settings.phaseFlash) bossPhaseFlash = 55;
          for (const p of players) {
            if (p.isBoss || p.health <= 0) continue;
            const dir = p.cx() >= tf.cx() ? 1 : -1;
            p.vx += dir * 18; p.vy = Math.min(p.vy, -11);
            p.hurtTimer = Math.max(p.hurtTimer, 20);
          }
        }
      }
      if (t >= 1.2 && !this._line1Fired) {
        this._line1Fired = true;
        showBossDialogue('You forced my hand.', 220);
      }
      if (t >= 2.1 && !this._line2Fired) {
        this._line2Fired = true;
        showBossDialogue('Witness my TRUE POWER.', 240);
      }
    },
    onEnd() { slowMotion = 1.0; cinematicCamOverride = false; }
  };
}

function _DELETED_makeTFReality50Cinematic(tf) {
  return {
    durationFrames: 210, // 3.5 s
    _gravFired: false, _stormFired: false, _lineFired: false,
    _phaseLabel: { text: '— REALITY BENDS —', color: '#cccccc' },
    update(t) {
      if (t < 0.3)      slowMotion = Math.max(0.12, 1 - t * 2.9);
      else if (t > 2.4) slowMotion = Math.min(1.0, (t - 2.4) / 1.1);
      else              slowMotion = 0.12;

      cinematicCamOverride = t < 3.2;
      if (cinematicCamOverride && tf) {
        // Slowly zoom out to show whole arena
        cinematicZoomTarget = Math.max(0.7, 1.4 - t * 0.22);
        cinematicFocusX = GAME_W / 2;
        cinematicFocusY = GAME_H / 2;
      }

      // 0.5 s: gravity reverses briefly — players float
      if (t >= 0.5 && !this._gravFired) {
        this._gravFired = true;
        tfGravityInverted = true;
        tfGravityTimer    = 180; // 3 s of inverted gravity
        gravityState.active = true; gravityState.type = 'reverse'; gravityState.timer = 0; gravityState.maxTimer = 180;
        if (tf) {
          for (let i = 0; i < 5; i++) {
            phaseTransitionRings.push({ cx: tf.cx(), cy: tf.cy(),
              r: 6 + i * 15, maxR: 280 + i * 32, timer: 64 + i * 11, maxTimer: 64 + i * 11,
              color: i % 2 === 0 ? '#ffffff' : '#666666', lineWidth: 3.5 - i * 0.5 });
          }
          spawnParticles(tf.cx(), tf.cy(), '#ffffff', 40);
          spawnParticles(tf.cx(), tf.cy(), '#888888', 28);
          screenShake = Math.max(screenShake, 34);
        }
      }

      if (t >= 0.9 && !this._lineFired) {
        this._lineFired = true;
        showBossDialogue('Reality... bends to me.', 230);
      }

      // 2.0 s: trigger meteor storm special for TrueForm
      if (t >= 2.0 && !this._stormFired) {
        this._stormFired = true;
        if (tf && typeof tf._doSpecial === 'function') {
          const target = players.find(p => !p.isBoss && p.health > 0);
          if (target) tf._doSpecial('meteorCrash', target);
        }
      }
    },
    onEnd() { slowMotion = 1.0; cinematicCamOverride = false; }
  };
}

function _DELETED_makeTFDesp15Cinematic(tf) {
  return {
    durationFrames: 180, // 3 s
    _crackFired: false, _despFired: false, _lineFired: false,
    _phaseLabel: { text: '— WE FALL TOGETHER —', color: '#ffffff' },
    update(t) {
      if (t < 0.2)      slowMotion = Math.max(0.03, 1 - t * 4.9);
      else if (t > 2.1) slowMotion = Math.min(1.0, (t - 2.1) / 0.9);
      else              slowMotion = 0.03;

      cinematicCamOverride = t < 2.7;
      if (cinematicCamOverride && tf) {
        cinematicZoomTarget = Math.min(2.0, 1 + t * 0.65);
        cinematicFocusX = tf.cx();
        cinematicFocusY = tf.cy();
      }

      // 0.3 s: massive rings, flash, arena destabilises
      if (t >= 0.3 && !this._crackFired) {
        this._crackFired = true;
        if (tf) {
          for (let i = 0; i < 7; i++) {
            phaseTransitionRings.push({ cx: tf.cx(), cy: tf.cy(),
              r: 5 + i * 11, maxR: 380 + i * 24, timer: 70 + i * 14, maxTimer: 70 + i * 14,
              color: i % 2 === 0 ? '#ffffff' : '#000000', lineWidth: 5 - i * 0.6 });
          }
          spawnParticles(tf.cx(), tf.cy(), '#ffffff', 70);
          spawnParticles(tf.cx(), tf.cy(), '#000000', 55);
          spawnParticles(tf.cx(), tf.cy(), '#555555', 30);
          screenShake = Math.max(screenShake, 55);
          if (settings.phaseFlash) bossPhaseFlash = 85;
          for (const p of players) {
            if (p.isBoss || p.health <= 0) continue;
            const dir = p.cx() >= tf.cx() ? 1 : -1;
            p.vx += dir * 22; p.vy = Math.min(p.vy, -16);
            p.hurtTimer = Math.max(p.hurtTimer, 24);
          }
        }
      }

      // 1.2 s: activate desperation + remove floor + trigger hazards
      if (t >= 1.2 && !this._despFired) {
        this._despFired = true;
        bossDesperationMode  = true;
        bossDesperationFlash = 90;
        // Remove floor for dramatic effect
        if (!tfFloorRemoved) {
          tfFloorRemoved = true;
          tfFloorTimer   = 600; // 10 s
          const floorPl  = currentArena && currentArena.platforms.find(p => p.isFloor);
          if (floorPl) floorPl.isFloorDisabled = true;
          showBossDialogue('The floor was never yours to keep.', 160);
        }
        // Spawn black holes at both sides
        tfBlackHoles.push({ x: 120, y: 260, r: 110, timer: 480, maxTimer: 480, strength: 5 });
        tfBlackHoles.push({ x: 780, y: 260, r: 110, timer: 480, maxTimer: 480, strength: 5 });
      }

      if (t >= 0.7 && !this._lineFired) {
        this._lineFired = true;
        showBossDialogue('Then we fall TOGETHER!', 250);
      }
    },
    onEnd() { slowMotion = 1.0; cinematicCamOverride = false; }
  };
}

// ============================================================
// PHASE TRANSITION — triggers appropriate cinematic sequence
