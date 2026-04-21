'use strict';

// ============================================================
// IMPACT CINEMATIC SYSTEM
// ============================================================
// Provides a frame-queued, multi-phase cinematic impact system
// with time-scale ramping, screen shake, vignette, flash,
// shockwaves, energy swirls, and camera drama.
//
// Public API:
//   playCinematicAttack(config)       — main entry point
//   playDominanceMoment(boss, target) — boss dominance helper
//   applyScreenShake(intensity, dur)  — stackable shake
//   CINEMATIC_PRESETS                 — preset configs
//   updateCinematicSystem()           — called every gameLoop frame
//   drawCinematicWorldEffects()       — world-space draw pass
//   drawCinematicImpactEffects()      — screen-space draw pass
// ============================================================


// ── Debug / control flags ────────────────────────────────────────────────────

let cinematicsEnabled    = true;
let _cinIntensityMult    = 1.0;

function toggleCinematics(val) {
  cinematicsEnabled = (val !== undefined ? !!val : !cinematicsEnabled);
}
function setCinematicIntensity(val) {
  _cinIntensityMult = Math.max(0, val);
}


// ── Time scale system ────────────────────────────────────────────────────────
// Separate from hitSlowTimer — managed entirely by updateCinematicSystem().

let _cinTSTarget      = 1.0;
let _cinTSCurrent     = 1.0;
let _cinTSLerpSpeed   = 0.10;


// ── Stackable screen shake queue ────────────────────────────────────────────

const _cinShakeQueue = [];
// maxFrames stored alongside each entry for ratio calculation
// Entry shape: { intensity, framesLeft, maxFrames }

function applyScreenShake(intensity, durationFrames) {
  _cinShakeQueue.push({
    intensity,
    framesLeft: durationFrames,
    maxFrames:  durationFrames,
  });
}


// ── Vignette system ──────────────────────────────────────────────────────────

let _cinVignetteAlpha  = 0;
let _cinVignetteTarget = 0;
let _cinVignetteColor  = '#000000';


// ── Impact flash system ──────────────────────────────────────────────────────

let _cinFlashAlpha = 0;
let _cinFlashColor = '#ffffff';


// ── Shockwave system (world-space) ───────────────────────────────────────────
// Entry shape: { x, y, r, maxR, lineWidth, color, alpha, age, lifetime }

const _cinShockwaves = [];


// ── Energy swirl (anticipation particles, world-space) ───────────────────────
// Entry shape: { cx, cy, angle, radius, speed, color, alpha, shrinkRate, life, maxLife, px, py }

const _cinEnergySwirls = [];

function _spawnEnergySwirl(cx, cy, color, count, intensity) {
  const baseRadius  = lerp(30, 80, Math.min(1, intensity));
  for (let i = 0; i < count; i++) {
    const angle      = Math.random() * Math.PI * 2;
    const radius     = baseRadius * (0.7 + Math.random() * 0.6);
    const speed      = 0.08 + Math.random() * 0.07;
    const shrinkRate = 0.3  + Math.random() * 0.5;
    const life       = Math.round(20 + Math.random() * 15);
    _cinEnergySwirls.push({
      cx, cy,
      angle,
      radius,
      speed,
      color,
      alpha: 0.7 + Math.random() * 0.3,
      shrinkRate,
      life,
      maxLife: life,
      px: cx + Math.cos(angle) * radius,
      py: cy + Math.sin(angle) * radius,
    });
  }
}


// ── Camera cinematic overlay ─────────────────────────────────────────────────
// These are READ by smb-loop.js each frame in the camera section.

let _cinCamTarget    = null;  // entity with .cx()/.cy() — cinematic cam focus
let _cinCamLerp      = 0.06;  // lerp speed toward target
let _cinCamZoomBoost = 0.0;   // additive zoom multiplier (applied as camZoom *= 1 + boost)
let _cinCamOffX      = 0;     // screen-pixel jolt — added directly to sx/sy transform
let _cinCamOffY      = 0;
let _cinCamOffXTgt   = 0;     // targets lerped toward
let _cinCamOffYTgt   = 0;


// ── Frame queue system ───────────────────────────────────────────────────────
// Entry shape: { delay: N, fn: function }

const _cinQueue = [];

function _cinSchedule(delayFrames, fn) {
  _cinQueue.push({ delay: delayFrames, fn });
}


// ── Preset configs ───────────────────────────────────────────────────────────

const CINEMATIC_PRESETS = {
  LIGHT: {
    intensity:     0.35,
    effectsConfig: { flashColor: '#ffffff' },
  },
  MEDIUM: {
    intensity:     0.65,
    effectsConfig: { flashColor: '#ffffff' },
  },
  HEAVY: {
    intensity:     1.00,
    effectsConfig: { flashColor: '#ffffff' },
  },
  BOSS: {
    intensity:     1.20,
    effectsConfig: {
      flashColor:  '#ffcc44',
      swirlColor:  '#cc00ee',
      shockColor:  '#cc00ee',
      afterColor:  '#9900cc',
    },
  },
  TRUEFORM: {
    intensity:     1.50,
    effectsConfig: {
      flashColor:  '#ffffff',
      swirlColor:  '#ffffff',
      shockColor:  '#ffffff',
      afterColor:  '#aaaaff',
    },
  },
  NEUTRON_STAR: {
    intensity:     1.6,
    effectsConfig: {
      flashColor:  '#ffff99',
      swirlColor:  '#ffaa00',
      shockColor:  '#ff6600',
      afterColor:  '#ff4400',
    },
  },
  GAMMA_BEAM: {
    intensity:     1.4,
    effectsConfig: {
      flashColor:  '#44ff88',
      swirlColor:  '#00ff44',
      shockColor:  '#00cc44',
      afterColor:  '#004422',
    },
  },
  GRAVITY: {
    intensity:     1.1,
    effectsConfig: {
      flashColor:  '#cc88ff',
      swirlColor:  '#9900cc',
      shockColor:  '#9900cc',
      afterColor:  '#440066',
    },
  },
};


// ── Main pipeline — playCinematicAttack ──────────────────────────────────────

function playCinematicAttack({ attacker, target, attackName, intensity = 1.0, effectsConfig = {} }) {
  if (!cinematicsEnabled) return;
  if (typeof gameRunning === 'undefined' || !gameRunning) return;

  const eff = Math.min(2.0, intensity * _cinIntensityMult);

  const anticipationLen = Math.round(lerp(14, 50, Math.min(eff, 1)));

  // Capture impact position once (at schedule time) for aftermath use
  let _impactX = attacker ? attacker.cx() : GAME_W / 2;
  let _impactY = attacker ? attacker.cy() : GAME_H / 2;

  // ─── PHASE 1: ANTICIPATION ─────────────────────────────────────────────
  // Frame 0: time scale ramp down, camera toward attacker, vignette in
  _cinSchedule(0, () => {
    _cinTSTarget    = lerp(0.88, 0.55, eff * 0.7);
    _cinTSLerpSpeed = 0.07;

    if (attacker) {
      _cinCamTarget    = attacker;
      _cinCamLerp      = 0.07;
      _cinCamZoomBoost = lerp(0.04, 0.16, eff);
    }

    _cinVignetteTarget = lerp(0.12, 0.40, eff);
    _cinVignetteColor  = '#000000';
  });

  // Frame 3: spawn energy swirl around attacker
  if (effectsConfig.energySwirl !== false && attacker) {
    _cinSchedule(3, () => {
      const swirlColor = effectsConfig.swirlColor || '#ffffff';
      const swirlCount = Math.round(lerp(4, 12, Math.min(eff, 1)));
      _spawnEnergySwirl(attacker.cx(), attacker.cy(), swirlColor, swirlCount, eff);
    });
  }

  // ─── PHASE 2: IMPACT ───────────────────────────────────────────────────
  _cinSchedule(anticipationLen, () => {
    // Resolve impact position at impact time (more accurate)
    _impactX = target ? target.cx() : (attacker ? attacker.cx() : GAME_W / 2);
    _impactY = target ? target.cy() : (attacker ? attacker.cy() : GAME_H / 2);

    // Time: snap back fast
    _cinTSTarget    = 1.0;
    _cinTSLerpSpeed = 0.25;

    // Hitstop
    if (typeof hitStopFrames !== 'undefined') {
      hitStopFrames = Math.max(hitStopFrames, Math.round(lerp(2, 7, eff)));
    }

    // Shake
    applyScreenShake(lerp(10, 32, eff), Math.round(lerp(10, 22, eff)));

    // Flash
    _cinFlashAlpha = lerp(0.25, 0.80, eff);
    _cinFlashColor = effectsConfig.flashColor || '#ffffff';

    // Shockwave at impact point
    _cinShockwaves.push({
      x:         _impactX,
      y:         _impactY,
      r:         0,
      maxR:      lerp(55, 180, eff),
      lineWidth: lerp(55, 180, eff) / 8,
      color:     effectsConfig.shockColor || '#ffffff',
      alpha:     0.85,
      age:       0,
      lifetime:  Math.round(lerp(10, 20, eff)),
    });

    // Camera snap to impact
    _cinCamTarget    = { cx: () => _impactX, cy: () => _impactY };
    _cinCamLerp      = 0.30;
    _cinCamZoomBoost = lerp(0.06, 0.20, eff);

    // Camera jolt offset (attacker → target direction)
    if (attacker && target) {
      const dir     = target.cx() > attacker.cx() ? 1 : -1;
      _cinCamOffXTgt = dir * lerp(8, 28, eff);
      _cinCamOffYTgt = lerp(-4, -14, eff);
    }

    // Clear vignette
    _cinVignetteTarget = 0;
  });

  // ─── PHASE 3: AFTERMATH ────────────────────────────────────────────────
  const aftermathStart = anticipationLen + Math.round(lerp(5, 12, eff));

  _cinSchedule(aftermathStart, () => {
    // Slow-mo ramp — dramatic aftermath
    _cinTSTarget    = lerp(0.70, 0.50, eff);
    _cinTSLerpSpeed = 0.05;

    // Aftermath particles
    if (effectsConfig.afterParticles !== false && typeof spawnParticles === 'function') {
      const afterColor  = effectsConfig.afterColor || '#ffffff';
      const afterCount  = Math.round(lerp(8, 25, Math.min(eff, 1)));
      spawnParticles(_impactX, _impactY, afterColor, afterCount);
    }

    // Camera drift back
    _cinCamLerp    = 0.04;
    _cinCamOffXTgt = 0;
    _cinCamOffYTgt = 0;
  });

  // Clear cinematic cam focus after aftermath plays out
  const camClearFrame = aftermathStart + Math.round(lerp(25, 70, eff));
  _cinSchedule(camClearFrame, () => {
    _cinCamTarget    = null;
    _cinCamZoomBoost = 0;
  });

  // Full return to normal
  const normalFrame = aftermathStart + Math.round(lerp(30, 80, eff));
  _cinSchedule(normalFrame, () => {
    _cinTSTarget    = 1.0;
    _cinTSLerpSpeed = 0.06;
  });
}


// ── Dominance moment ─────────────────────────────────────────────────────────

function playDominanceMoment(boss, target, config = {}) {
  const intensity  = config.intensity || 1.4;
  const stunDur    = config.stunDur   || 35;
  const stunTarget = config.stunTarget !== false;

  // Stun the target briefly
  if (stunTarget && target) {
    target.stunTimer = Math.max(target.stunTimer || 0, stunDur);
  }

  playCinematicAttack({
    attacker:     boss,
    target,
    attackName:   config.label || 'dominance',
    intensity,
    effectsConfig: {
      flashColor: '#ffcc44',
      swirlColor: '#cc00ee',
      shockColor: '#cc00ee',
      afterColor: '#9900cc',
    },
  });
}


// ── updateCinematicSystem — called every gameLoop frame ───────────────────────

function updateCinematicSystem() {

  // 1. Process frame queue
  for (let i = _cinQueue.length - 1; i >= 0; i--) {
    _cinQueue[i].delay--;
    if (_cinQueue[i].delay <= 0) {
      try { _cinQueue[i].fn(); } catch(e) { /* silently absorb */ }
      _cinQueue.splice(i, 1);
    }
  }

  // 2. Time scale: lerp toward target; release control when settled at 1.0
  const tsDiff = _cinTSTarget - _cinTSCurrent;
  if (Math.abs(tsDiff) > 0.005) {
    _cinTSCurrent += tsDiff * _cinTSLerpSpeed;
    slowMotion = _cinTSCurrent;
  } else if (_cinTSCurrent !== 1.0 || _cinTSTarget !== 1.0) {
    _cinTSCurrent = _cinTSTarget = 1.0;
    // Only release control of slowMotion if we're not in a story/finisher
    if (!activeFinisher && (typeof activeCinematic === 'undefined' || !activeCinematic)) {
      slowMotion = 1.0;
    }
  }

  // 3. Vignette lerp
  _cinVignetteAlpha += (_cinVignetteTarget - _cinVignetteAlpha) * 0.10;

  // 4. Decay flash
  _cinFlashAlpha = Math.max(0, _cinFlashAlpha - 0.06);

  // 5. Shake queue
  for (let i = _cinShakeQueue.length - 1; i >= 0; i--) {
    const e = _cinShakeQueue[i];
    e.framesLeft--;
    if (e.framesLeft > 0) {
      if (typeof screenShake !== 'undefined' && settings.screenShake) {
        screenShake = Math.max(screenShake, e.intensity * (e.framesLeft / e.maxFrames));
      }
    } else {
      _cinShakeQueue.splice(i, 1);
    }
  }

  // 6. Shockwaves
  for (let i = _cinShockwaves.length - 1; i >= 0; i--) {
    const sw = _cinShockwaves[i];
    sw.age++;
    sw.r     = (sw.age / sw.lifetime) * sw.maxR;
    sw.alpha = 0.85 * (1 - sw.age / sw.lifetime);
    if (sw.age >= sw.lifetime) {
      _cinShockwaves.splice(i, 1);
    }
  }

  // 7. Energy swirls
  for (let i = _cinEnergySwirls.length - 1; i >= 0; i--) {
    const s = _cinEnergySwirls[i];
    s.angle  += s.speed;
    s.radius  = Math.max(0, s.radius - s.shrinkRate);
    s.life--;
    s.px = s.cx + Math.cos(s.angle) * s.radius;
    s.py = s.cy + Math.sin(s.angle) * s.radius;
    if (s.life <= 0 || s.radius <= 0) {
      _cinEnergySwirls.splice(i, 1);
    }
  }

  // 8. Lerp camera offset toward targets
  _cinCamOffX += (_cinCamOffXTgt - _cinCamOffX) * 0.18;
  _cinCamOffY += (_cinCamOffYTgt - _cinCamOffY) * 0.18;

  // 9. Slowly decay zoom boost back to 0
  _cinCamZoomBoost *= 0.92;
}


// ── drawCinematicWorldEffects — world-space draw ──────────────────────────────
// Called during the world transform (after platforms, before fighters).
// NOTE: smb-cinematics.js also exports drawCinematicWorldEffects for ground cracks.
// We augment that file's function by drawing our own world-space effects after it.
// This function is called as drawCinematicImpactWorldEffects() from smb-loop.js.

function drawCinematicImpactWorldEffects() {
  // Draw shockwaves
  for (const sw of _cinShockwaves) {
    if (sw.alpha <= 0) continue;
    ctx.save();
    ctx.globalAlpha  = Math.max(0, sw.alpha);
    ctx.strokeStyle  = sw.color;
    ctx.lineWidth    = Math.max(0.5, sw.lineWidth * (1 - sw.age / sw.lifetime));
    ctx.shadowColor  = sw.color;
    ctx.shadowBlur   = 12;
    ctx.beginPath();
    ctx.arc(sw.x, sw.y, sw.r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Draw energy swirl particles
  for (const s of _cinEnergySwirls) {
    if (s.alpha <= 0) continue;
    const fadeRatio = s.life / s.maxLife;
    ctx.save();
    ctx.globalAlpha = Math.max(0, s.alpha * fadeRatio);
    ctx.fillStyle   = s.color;
    ctx.shadowColor = s.color;
    ctx.shadowBlur  = 6;
    ctx.beginPath();
    ctx.arc(s.px, s.py, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}


// ── drawCinematicImpactEffects — screen-space draw ───────────────────────────
// Called after ctx.setTransform(1,0,0,1,0,0), before drawCinematicOverlay().

function drawCinematicImpactEffects() {
  const cw = canvas.width;
  const ch = canvas.height;

  // Vignette: radial gradient from center outward
  if (_cinVignetteAlpha > 0.005) {
    const grad = ctx.createRadialGradient(
      cw / 2, ch / 2, 0,
      cw / 2, ch / 2, Math.max(cw, ch) * 0.75
    );
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    // Parse _cinVignetteColor into an rgba string
    grad.addColorStop(1, _hexToRgba(_cinVignetteColor, _cinVignetteAlpha));
    ctx.save();
    ctx.fillStyle   = grad;
    ctx.globalAlpha = 1;
    ctx.fillRect(0, 0, cw, ch);
    ctx.restore();
  }

  // Impact flash: full-screen fill
  if (_cinFlashAlpha > 0.005) {
    ctx.save();
    ctx.globalAlpha = _cinFlashAlpha;
    ctx.fillStyle   = _cinFlashColor;
    ctx.fillRect(0, 0, cw, ch);
    ctx.restore();
  }
}

// Helper: convert hex color + alpha to rgba() string
function _hexToRgba(hex, alpha) {
  hex = hex.replace('#', '');
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}


// ── Console command integration ───────────────────────────────────────────────
// Patches _consoleExec (defined in smb-debug.js) to support "cin" commands.

(function _patchConsoleForCin() {
  if (typeof _consoleExec !== 'function') {
    window.addEventListener('load', _patchConsoleForCin, { once: true });
    return;
  }
  if (_consoleExec.__cinPatched) return;

  const _orig = _consoleExec;
  _consoleExec = function(raw) {
    const trimmed = raw.trim().toLowerCase();
    if (trimmed === 'cin' || trimmed.startsWith('cin ')) {
      _cinCommand(raw.trim().slice(4).trim());
      return;
    }
    _orig(raw);
  };
  _consoleExec.__cinPatched = true;

  // DevTools aliases
  window.cinTest      = (preset) => _cinCommand('test ' + (preset || 'heavy'));
  window.cinOff       = ()       => toggleCinematics(false);
  window.cinOn        = ()       => toggleCinematics(true);
  window.cinIntensity = (v)      => setCinematicIntensity(v);
})();

function _cinCommand(args) {
  const parts = args.split(' ').filter(Boolean);
  const cmd   = (parts[0] || '').toLowerCase();

  if (cmd === 'off')  { toggleCinematics(false); console.log('[CIN] Cinematics disabled'); return; }
  if (cmd === 'on')   { toggleCinematics(true);  console.log('[CIN] Cinematics enabled');  return; }

  if (cmd === 'intensity') {
    const v = parseFloat(parts[1]);
    if (!isNaN(v)) {
      setCinematicIntensity(v);
      console.log('[CIN] Intensity multiplier set to ' + v);
    } else {
      console.log('[CIN] Usage: cin intensity <value>');
    }
    return;
  }

  if (cmd === 'test') {
    const presetKey = (parts[1] || 'heavy').toUpperCase();
    const preset    = CINEMATIC_PRESETS[presetKey];
    if (!preset) {
      console.log('[CIN] Unknown preset: ' + parts[1] + '. Options: light, medium, heavy, boss, trueform');
      return;
    }
    if (typeof players === 'undefined' || !players || !players[0]) {
      console.log('[CIN] No players active — start a game first');
      return;
    }
    const p1 = players[0];
    const p2 = players[1] || null;
    playCinematicAttack({
      attacker:  p1,
      target:    p2,
      attackName: 'test_' + presetKey,
      ...preset,
    });
    console.log('[CIN] Fired test cinematic: ' + presetKey);
    return;
  }

  console.log('[CIN] Commands: cin on | cin off | cin intensity <val> | cin test <light|medium|heavy|boss|trueform>');
}
