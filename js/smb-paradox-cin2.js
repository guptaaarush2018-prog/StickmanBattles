'use strict';
// smb-paradox-cin2.js — _makeTFParadoxEntryCinematic, _makeTFFinalParadoxCinematic, triggerFalseVictory, drawParadoxFusion, resetParadoxState
// Depends on: smb-globals.js, smb-paradox-class.js (and preceding splits in chain)

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

