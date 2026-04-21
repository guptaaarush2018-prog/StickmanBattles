// smb-cinematics-core.js — CinematicManager engine: CinFX, CinCam, cinScript(), CinTimeline, world effects
// Depends on: smb-globals.js (ctx, GAME_W, GAME_H, activeCinematic, isCinematic, slowMotion)
'use strict';

// ============================================================
// CINEMATIC SCRIPTING SYSTEM v2
// ============================================================
// Replaces hand-written update(t) monoliths with a declarative
// step-based API. Fully compatible with existing startCinematic().
//
// QUICK USAGE:
//   startCinematic(cinScript({
//     duration: 4.0,
//     label:    { text: '— TITLE —', color: '#ff0044' },
//     slowMo:   [[0, 1.0], [0.3, 0.05], [3.7, 0.05], [4.0, 1.0]],
//     cam: [
//       [0,   { zoomTo: 1.7, focusOn: () => boss }],
//       [0.5, { zoomTo: 1.1, focusOn: () => target }],
//     ],
//     steps: [
//       { at: 0.3, run: ({ boss, target }) => { /* scripted action */ } },
//       { at: 0.8, dialogue: 'Enough.' },
//       { at: 0.8, fx: { screenShake: 40, shockwave: { color: '#ff0044' } } },
//     ]
//   }));
// ============================================================


// ── World-space cinematic effects ─────────────────────────────────────────
// cinGroundCracks and cinScreenFlash are declared in smc-globals.js

// Called from smc-loop.js in world-space draw pass (after platforms, before fighters)
function drawCinematicWorldEffects() {
  for (let i = cinGroundCracks.length - 1; i >= 0; i--) {
    const c = cinGroundCracks[i];
    c.timer--;
    if (c.timer <= 0) { cinGroundCracks.splice(i, 1); continue; }
    const fadeAlpha = c.timer < 60 ? (c.timer / 60) * c.alpha : c.alpha;
    ctx.save();
    ctx.globalAlpha = Math.max(0, fadeAlpha);
    ctx.strokeStyle = c.color || '#cc3300';
    ctx.lineWidth   = c.width || 2.5;
    ctx.shadowColor = c.color || '#cc3300';
    ctx.shadowBlur  = 10;
    ctx.translate(c.x, c.y);
    ctx.rotate(c.angle);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(c.length, 0);
    ctx.stroke();
    // Branch cracks
    if (c.branches) {
      for (const b of c.branches) {
        ctx.globalAlpha = Math.max(0, fadeAlpha * 0.55);
        ctx.lineWidth   = (c.width || 2.5) * 0.55;
        ctx.beginPath();
        ctx.moveTo(b.ox, 0);
        ctx.lineTo(b.ox + b.len * Math.cos(b.ang), b.len * Math.sin(b.ang));
        ctx.stroke();
      }
    }
    ctx.restore();
  }
}

// ── CinFX — effect helper (call from step run() callbacks) ────────────────
const CinFX = {

  // Expanding ring shockwave (world-space)
  shockwave(x, y, color, opts = {}) {
    const count = opts.count  || 4;
    const maxR  = opts.maxR   || 290;
    const lw    = opts.lw     || 4.5;
    const dur   = opts.dur    || 72;
    for (let i = 0; i < count; i++) {
      phaseTransitionRings.push({
        cx: x, cy: y,
        r:       4 + i * 16,
        maxR:    maxR + i * 32,
        timer:   dur + i * 13,
        maxTimer: dur + i * 13,
        color,
        lineWidth: Math.max(0.5, lw - i * 0.6),
      });
    }
  },

  // Particle burst (world-space)
  particles(x, y, color, count = 30) {
    spawnParticles(x, y, color, count);
  },

  // Set screen shake (takes the max of current vs new value)
  shake(intensity) {
    if (settings && settings.screenShake !== false) {
      screenShake = Math.max(screenShake, intensity);
    }
  },

  // Brief screen flash (drawn by drawCinematicOverlay in screen-space)
  flash(color = '#ffffff', alpha = 0.65, durationFrames = 14) {
    cinScreenFlash = { color, alpha, timer: durationFrames, maxTimer: durationFrames };
  },

  // Ground crack fan radiating from a point (world-space, floor-level)
  groundCrack(x, groundY, opts = {}) {
    const count = opts.count || 6;
    const color = opts.color || '#cc3300';
    for (let i = 0; i < count; i++) {
      const angle  = (Math.random() - 0.5) * Math.PI * 0.7; // fan spread
      const length = 22 + Math.random() * 65;
      const dur    = 200 + Math.random() * 130;
      const branches = [];
      for (let b = 0; b < Math.floor(Math.random() * 3) + 1; b++) {
        branches.push({
          ox:  Math.random() * length * 0.8,
          len: 8 + Math.random() * 22,
          ang: (Math.random() - 0.5) * 1.3,
        });
      }
      cinGroundCracks.push({
        x:       x + (Math.random() - 0.5) * 28,
        y:       groundY,
        angle,
        length,
        alpha:   0.9,
        timer:   dur,
        maxTimer: dur,
        width:   1.5 + Math.random() * 2.2,
        color,
        branches,
      });
    }
  },

  // Force the nearest arena hazard to trigger soon
  arenaHazardNow() {
    if (typeof directorSpawnHazard === 'function') directorSpawnHazard();
  },
};

// ── CinCam — per-frame camera setter ──────────────────────────────────────
// Call from within step run() callbacks or the cinScript update loop.
const CinCam = {

  // Point camera at a world-space coordinate with a zoom level.
  // The existing smc-loop.js lerp (0.09 zoom, 0.07 pos) handles smoothing automatically.
  setFocus(x, y, zoom) {
    cinematicCamOverride = true;
    if (x    !== undefined) cinematicFocusX    = x;
    if (y    !== undefined) cinematicFocusY    = y;
    if (zoom !== undefined) cinematicZoomTarget = zoom;
  },

  // Hard-cut camera to a new focal point for one frame before normal smoothing resumes.
  snap(x, y, zoom) {
    this.setFocus(x, y, zoom);
    cinematicCamSnapFrames = Math.max(cinematicCamSnapFrames || 0, 1);
    _camPrevFocusX = cinematicFocusX;
    _camPrevFocusY = cinematicFocusY;
    _camOvershootX = 0;
    _camOvershootY = 0;
  },

  // Orbit camera around a center point (for dramatic circular reveal)
  // angle in radians; call each frame with an incrementing angle value
  orbit(cx, cy, radius, angle, zoom) {
    this.setFocus(
      cx + Math.cos(angle) * radius,
      cy + Math.sin(angle) * radius,
      zoom
    );
  },

  // Convenience: focus midpoint between two entities
  midpoint(a, b, zoom) {
    if (!a || !b) return;
    this.setFocus((a.cx() + b.cx()) * 0.5, (a.cy() + b.cy()) * 0.5, zoom);
  },

  // ── Finisher-friendly aliases ──────────────────────────────────────────
  // These match the CinCam API used by weapon/class finishers.

  // Set zoom only (keep current focus position)
  zoomTo(zoom) {
    cinematicCamOverride = true;
    cinematicZoomTarget = zoom;
  },

  // Focus on midpoint of two entities (optionally with zoom)
  focusMidpoint(a, b, zoom) {
    if (!a || !b) return;
    this.setFocus((a.cx() + b.cx()) * 0.5, (a.cy() + b.cy()) * 0.5, zoom);
  },

  // Focus on a single entity center
  focusOn(entity, zoom) {
    if (!entity) return;
    this.setFocus(entity.cx(), entity.cy(), zoom);
  },

  // Focus on an explicit world-space point
  focusPoint(x, y, zoom) {
    this.setFocus(x, y, zoom);
  },

  // Trigger screen shake (intensity in pixels)
  shake(intensity) {
    if (settings.screenShake) screenShake = Math.max(screenShake, intensity);
  },

  // Set slow-motion scale (1.0 = normal, 0.07 = near-freeze)
  slowMo(scale) {
    slowMotion = scale;
  },

  // Restore camera to normal gameplay control
  restore() {
    cinematicCamOverride = false;
    cinematicCamSnapFrames = 0;
    _camPrevFocusX = camXCur;
    _camPrevFocusY = camYCur;
    _camOvershootX = 0;
    _camOvershootY = 0;
    slowMotion = 1.0;
  },
};


// ── Keyframe interpolation helpers ────────────────────────────────────────

// Smooth-step easing (s-curve between 0 and 1)
function _cinEase(t) { return t * t * (3 - 2 * t); }

const _CIN_EASINGS = {
  linear: t => t,
  smooth: _cinEase,
  smoothstep: _cinEase,
  cubic: t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  expo: t => {
    if (t === 0 || t === 1) return t;
    return t < 0.5
      ? Math.pow(2, 20 * t - 10) / 2
      : (2 - Math.pow(2, -20 * t + 10)) / 2;
  },
  back: t => {
    const c1 = 1.70158;
    const c2 = c1 * 1.525;
    return t < 0.5
      ? (Math.pow(2 * t, 2) * ((c2 + 1) * 2 * t - c2)) / 2
      : (Math.pow(2 * t - 2, 2) * ((c2 + 1) * (2 * t - 2) + c2) + 2) / 2;
  },
  elastic: t => {
    if (t === 0 || t === 1) return t;
    const c5 = (2 * Math.PI) / 4.5;
    return t < 0.5
      ? -(Math.pow(2, 20 * t - 10) * Math.sin((20 * t - 11.125) * c5)) / 2
      : (Math.pow(2, -20 * t + 10) * Math.sin((20 * t - 11.125) * c5)) / 2 + 1;
  },
  bounce: t => {
    const n1 = 7.5625;
    const d1 = 2.75;
    if (t < 1 / d1) return n1 * t * t;
    if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
    if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
    return n1 * (t -= 2.625 / d1) * t + 0.984375;
  },
};

function _cinGetEaseName(k0, k1) {
  const v0 = k0 && k0[1];
  const v1 = k1 && k1[1];
  const ease0 = Array.isArray(k0) ? k0[2] : null;
  const ease1 = Array.isArray(k1) ? k1[2] : null;
  const objEase0 = v0 && typeof v0 === 'object' && !Array.isArray(v0) ? v0._ease : null;
  const objEase1 = v1 && typeof v1 === 'object' && !Array.isArray(v1) ? v1._ease : null;
  return ease0 || objEase0 || ease1 || objEase1 || 'smooth';
}

function _cinGetEaseFn(k0, k1) {
  return _CIN_EASINGS[_cinGetEaseName(k0, k1)] || _cinEase;
}

// Linear interpolation along sorted [[t, value], ...] keyframe array
function _cinSampleKeyframes(kf, t) {
  if (!kf || kf.length === 0) return 1.0;
  if (t <= kf[0][0])                  return kf[0][1];
  if (t >= kf[kf.length - 1][0])     return kf[kf.length - 1][1];
  for (let i = 0; i < kf.length - 1; i++) {
    const k0 = kf[i];
    const k1 = kf[i + 1];
    const [t0, v0] = k0;
    const [t1, v1] = k1;
    if (t >= t0 && t <= t1) {
      if (t1 <= t0) return v1;
      const ease = _cinGetEaseFn(k0, k1);
      return v0 + (v1 - v0) * ease((t - t0) / (t1 - t0));
    }
  }
  return kf[kf.length - 1][1];
}

// Camera keyframes: [[t, { zoomTo, focusOn, focusX, focusY }], ...]
// focusOn: () => entity    — live entity tracking (re-evaluated each frame)
// focusX/Y: number         — static world-space coordinate
function _cinSampleCam(kf, t) {
  if (!kf || kf.length === 0) return null;
  if (t <= kf[0][0])              return kf[0][1];
  if (t >= kf[kf.length - 1][0]) return kf[kf.length - 1][1];
  for (let i = 0; i < kf.length - 1; i++) {
    const seg0 = kf[i];
    const seg1 = kf[i + 1];
    const [t0, k0] = seg0;
    const [t1, k1] = seg1;
    if (t >= t0 && t <= t1) {
      if (t1 <= t0) return k1;
      const ease = _cinGetEaseFn(seg0, seg1);
      const a    = ease((t - t0) / (t1 - t0));
      const zoom = (k0.zoomTo !== undefined && k1.zoomTo !== undefined)
        ? k0.zoomTo + (k1.zoomTo - k0.zoomTo) * a
        : (k0.zoomTo ?? k1.zoomTo ?? 1.0);
      // focusOn: use the earlier keyframe's tracker (it "owns" this segment)
      const focusOn = k0.focusOn || null;
      const focusX  = k0.focusX !== undefined && k1.focusX !== undefined
        ? k0.focusX + (k1.focusX - k0.focusX) * a : (k0.focusX ?? k1.focusX);
      const focusY  = k0.focusY !== undefined && k1.focusY !== undefined
        ? k0.focusY + (k1.focusY - k0.focusY) * a : (k0.focusY ?? k1.focusY);
      return { zoomTo: zoom, focusOn, focusX, focusY };
    }
  }
  return kf[kf.length - 1][1];
}

function _cinUpsertKey(keys, time, value, ease) {
  const key = ease ? [time, value, ease] : [time, value];
  const last = keys[keys.length - 1];
  if (last && Math.abs(last[0] - time) < 1e-6) keys[keys.length - 1] = key;
  else keys.push(key);
}

function _cinCloneCamState(state) {
  return state ? Object.assign({}, state) : {};
}

function _cinApplyCamState(base, opts) {
  const next = _cinCloneCamState(base);
  if (!opts) return next;
  if (opts.zoom !== undefined) next.zoomTo = opts.zoom;
  if (opts.focusOn !== undefined) {
    if (opts.focusOn) {
      next.focusOn = opts.focusOn;
      delete next.focusX;
      delete next.focusY;
    } else {
      delete next.focusOn;
    }
  }
  if (opts.focusX !== undefined || opts.focusY !== undefined) {
    delete next.focusOn;
    if (opts.focusX !== undefined) next.focusX = opts.focusX;
    if (opts.focusY !== undefined) next.focusY = opts.focusY;
  }
  return next;
}


// ── cinScript — main factory ───────────────────────────────────────────────
//
// def = {
//   duration:  Number,                                    // total seconds
//   label:     { text, color } | null,                   // phase label shown mid-cinematic
//   slowMo:    [[t0, v0], [t1, v1], ...],                // slowMotion keyframes
//   cam:       [[t0, camKey], [t1, camKey], ...],        // camera keyframes
//   orbit:     { cx, cy, radius, speed, zoom } | null,  // optional constant orbit override
//   steps:     [{ at, run, dialogue, dialogueDur, fx }] // one-time timed steps
// }
//
// step.run receives: { t, boss, target, CinCam, CinFX }
// step.fx: { screenShake, flash:{color,alpha,dur}, particles:{x,y,color,count},
//            shockwave:{x,y,color,...}, groundCrack:{x,y,color,count} }
//
// ── Finisher timeline helpers ─────────────────────────────────────────────
// Used by smc-finishers.js weapon/class finishers.

function _makeTimeline(events) {
  // events: [{frame, fn}, ...]  sorted ascending by frame
  return events.slice().sort((a, b) => a.frame - b.frame);
}

function _tickTimeline(timeline, frame) {
  for (const ev of timeline) {
    if (ev.frame === frame) ev.fn();
  }
}

function _makeFinisherSentinel() {
  // Minimal activeCinematic stub that blocks processInput/AI during finisher.
  return {
    _isFinisherSentinel: true,
    durationFrames: 9999,
    tick() {},
    update() {},
    draw() {},
    done: false,
  };
}

// ── cinScript ─────────────────────────────────────────────────────────────

function cinScript(def) {
  const stepsFired = new Array((def.steps || []).length).fill(false);

  return {
    durationFrames: Math.round((def.duration || 3) * 60),
    _phaseLabel:    def.label || null,

    update(t) {
      // ── 1. Slow motion ──────────────────────────────────────
      if (def.slowMo) {
        slowMotion = _cinSampleKeyframes(def.slowMo, t);
      }

      // ── 2. Camera ───────────────────────────────────────────
      if (def.orbit && t >= (def.orbit.start || 0)) {
        const o     = def.orbit;
        const angle = (t - (o.start || 0)) * (o.speed || 0.8);
        CinCam.orbit(o.cx, o.cy, o.radius || 120, angle, o.zoom || 1.4);
      } else if (def.cam) {
        const k = _cinSampleCam(def.cam, t);
        if (k) {
          let fx = k.focusX, fy = k.focusY;
          if (k.focusOn) {
            const ent = typeof k.focusOn === 'function' ? k.focusOn() : k.focusOn;
            if (ent) { fx = ent.cx(); fy = ent.cy(); }
          }
          CinCam.setFocus(fx ?? GAME_W / 2, fy ?? GAME_H / 2, k.zoomTo);
        }
      }

      // ── 3. One-time steps ───────────────────────────────────
      const steps = def.steps || [];
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        if (stepsFired[i] || t < step.at) continue;
        stepsFired[i] = true;

        // Live entity lookup at execution time
        const boss   = players ? players.find(p => p.isBoss && p.health > 0) : null;
        const target = players ? players.find(p => !p.isBoss && p.health > 0) : null;

        // run callback
        if (step.run) step.run({ t, boss, target, CinCam, CinFX });

        // dialogue shorthand
        if (step.dialogue) showBossDialogue(step.dialogue, step.dialogueDur || 180);

        // inline fx shorthand
        if (step.fx) {
          const fx = step.fx;
          if (fx.screenShake)  CinFX.shake(fx.screenShake);
          if (fx.flash)        CinFX.flash(fx.flash.color, fx.flash.alpha, fx.flash.dur || 14);
          if (fx.particles)    CinFX.particles(fx.particles.x, fx.particles.y, fx.particles.color, fx.particles.count || 30);
          if (fx.shockwave) {
            // x/y can be a function (deferred evaluation) or a number
            const sw = fx.shockwave;
            const sx = typeof sw.x === 'function' ? sw.x() : (sw.x ?? GAME_W / 2);
            const sy = typeof sw.y === 'function' ? sw.y() : (sw.y ?? GAME_H / 2);
            CinFX.shockwave(sx, sy, sw.color || '#ffffff', sw);
          }
          if (fx.groundCrack) {
            const gc = fx.groundCrack;
            const gx = typeof gc.x === 'function' ? gc.x() : gc.x;
            const gy = typeof gc.y === 'function' ? gc.y() : gc.y;
            CinFX.groundCrack(gx, gy, gc);
          }
        }
      }
    },

    onEnd() {
      slowMotion           = 1.0;
      cinematicCamOverride = false;
      cinematicCamSnapFrames = 0;
      _camPrevFocusX = camXCur;
      _camPrevFocusY = camYCur;
      _camOvershootX = 0;
      _camOvershootY = 0;
    },
  };
}

const CinTimeline = (function() {
  function create(labelDef) {
    let cursor = 0;
    let dur = 0;
    const slowMoKeys = [];
    const camKeys = [];
    const steps = [];
    let orbitDef = null;
    let slowMoState = typeof slowMotion === 'number' ? slowMotion : 1.0;
    let camState = {
      zoomTo: cinematicCamOverride ? cinematicZoomTarget : (typeof camZoomCur === 'number' ? camZoomCur : 1.0),
      focusX: cinematicCamOverride ? cinematicFocusX : (typeof camXCur === 'number' ? camXCur : GAME_W / 2),
      focusY: cinematicCamOverride ? cinematicFocusY : (typeof camYCur === 'number' ? camYCur : GAME_H / 2),
    };

    function touch(time) {
      dur = Math.max(dur, time);
    }

    function pushStep(step) {
      steps.push(step);
      touch(step.at);
    }

    const api = {
      to(opts = {}) {
        const startState = _cinApplyCamState(camState, {
          zoom: opts.zoomStart,
          focusX: opts.fromX,
          focusY: opts.fromY,
          focusOn: opts.focusOnStart,
        });
        const duration = Math.max(0, opts.duration || 0);
        _cinUpsertKey(camKeys, cursor, startState);

        const endState = _cinApplyCamState(startState, {
          zoom: opts.zoom,
          focusX: opts.focusX,
          focusY: opts.focusY,
          focusOn: opts.focusOn,
        });

        cursor += duration;
        touch(cursor);
        _cinUpsertKey(camKeys, cursor, endState, opts.ease);
        camState = _cinCloneCamState(endState);
        return api;
      },

      wait(secs) {
        cursor += Math.max(0, secs || 0);
        touch(cursor);
        return api;
      },

      fx(opts = {}) {
        const fx = Object.assign({}, opts);
        if (fx.shake !== undefined && fx.screenShake === undefined) {
          fx.screenShake = fx.shake;
        }
        pushStep({ at: cursor, fx });
        return api;
      },

      dialogue(text, durationFrames) {
        pushStep({ at: cursor, dialogue: text, dialogueDur: durationFrames });
        return api;
      },

      run(fn) {
        pushStep({ at: cursor, run: fn });
        return api;
      },

      slowMo(scale, rampDur, ease) {
        _cinUpsertKey(slowMoKeys, cursor, slowMoState);
        cursor += Math.max(0, rampDur || 0);
        touch(cursor);
        _cinUpsertKey(slowMoKeys, cursor, scale, ease);
        slowMoState = scale;
        return api;
      },

      orbit(opts) {
        orbitDef = Object.assign({}, opts || {}, { start: cursor });
        touch(cursor);
        return api;
      },

      at(t) {
        cursor = Math.max(0, t || 0);
        touch(cursor);
        return api;
      },

      build() {
        const sortedSteps = steps.slice().sort((a, b) => a.at - b.at);
        const duration = Math.max(
          dur,
          camKeys.length ? camKeys[camKeys.length - 1][0] : 0,
          slowMoKeys.length ? slowMoKeys[slowMoKeys.length - 1][0] : 0
        );

        return cinScript({
          duration,
          label: labelDef,
          slowMo: slowMoKeys.length ? slowMoKeys : undefined,
          cam: camKeys.length ? camKeys : undefined,
          orbit: orbitDef,
          steps: sortedSteps,
        });
      },
    };

    return api;
  }

  return { create };
})();

