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


// ============================================================
// BOSS BACKSTORY CINEMATIC
// ============================================================
// 7 scenes — ~38 seconds total — triggered once before Boss fight.
// startBossBackstoryCinematic() is called from smb-boss.js constructor
// hook (first time the boss arena loads, before combat starts).
// ============================================================

function startBossBackstoryCinematic() {
  // Reusable world-centre coords
  const CX = GAME_W / 2;
  const CY = GAME_H / 2;

  // ── Scene timing map (seconds) ────────────────────────────
  // 0.0  – 5.5   SCENE 1 : Alley (human boss enters)
  // 5.5  – 11.0  SCENE 2 : Awakening Fight (hits accelerate)
  // 11.0 – 17.0  SCENE 3 : Sky Ascension (uppercuts, rising cam)
  // 17.0 – 21.5  SCENE 4 : Space Silence (heartbeat, void)
  // 21.5 – 26.5  SCENE 5 : Reality Break Punch (rift opens)
  // 26.5 – 31.0  SCENE 6 : Corruption (dark energy, floating)
  // 31.0 – 38.0  SCENE 7 : Universe Creation (arenas forming)

  startCinematic(cinScript({
    duration: 38.0,

    // ── SLOW-MOTION CURVE ────────────────────────────────────
    // Normal entering most scenes; near-freeze on key impacts
    slowMo: [
      // Scene 1 – slow, brooding build
      [0.0,  0.55],
      [2.0,  0.40],
      [4.5,  0.55],
      // Scene 2 – each hit accelerates
      [5.5,  0.80],
      [6.8,  0.12],  // first hit freeze
      [7.2,  0.70],
      [8.0,  0.12],  // second hit freeze
      [8.4,  0.90],
      [9.4,  0.08],  // final hit near-stop
      [9.8,  1.10],  // overshoot speed surge
      [11.0, 0.55],
      // Scene 3 – each uppercut beat
      [11.5, 0.10],
      [12.0, 0.80],
      [12.8, 0.08],
      [13.4, 0.90],
      [14.2, 0.06],
      [15.0, 1.0],
      [17.0, 0.50],
      // Scene 4 – dead silence, ultra slow
      [17.5, 0.08],
      [21.0, 0.08],
      [21.5, 0.50],
      // Scene 5 – ramp to freeze on impact
      [22.5, 1.0],
      [23.1, 0.04],  // reality punch freeze
      [24.5, 0.04],
      [24.8, 1.0],
      [26.5, 0.55],
      // Scene 6 – slow float
      [27.5, 0.25],
      [30.5, 0.55],
      // Scene 7 – normal, triumphant
      [31.0, 1.0],
      [38.0, 1.0],
    ],

    // ── CAMERA KEYFRAMES ────────────────────────────────────
    cam: [
      // SCENE 1: alley – wide establishing, then creep toward boss
      [0.0,  { zoomTo: 0.75, focusX: CX,         focusY: CY + 60  }],
      [1.5,  { zoomTo: 0.85, focusX: CX - 80,    focusY: CY + 30  }],
      [3.5,  { zoomTo: 1.10, focusX: CX - 30,    focusY: CY       }],
      [5.0,  { zoomTo: 1.30, focusX: CX,         focusY: CY - 10  }],

      // SCENE 2: tight on boss as hits land
      [5.5,  { zoomTo: 1.50, focusX: CX,         focusY: CY       }],
      [6.8,  { zoomTo: 1.85, focusX: CX,         focusY: CY - 20  }],
      [8.0,  { zoomTo: 1.70, focusX: CX + 50,    focusY: CY - 10  }],
      [9.4,  { zoomTo: 2.00, focusX: CX,         focusY: CY - 40  }],
      [10.5, { zoomTo: 1.40, focusX: CX,         focusY: CY       }],

      // SCENE 3: camera rises — chasing the sky ascent
      [11.0, { zoomTo: 1.20, focusX: CX,         focusY: CY       }],
      [11.8, { zoomTo: 1.50, focusX: CX,         focusY: CY - 80  }],
      [13.0, { zoomTo: 1.40, focusX: CX,         focusY: CY - 160 }],
      [14.5, { zoomTo: 1.20, focusX: CX,         focusY: CY - 260 }],
      [16.0, { zoomTo: 0.90, focusX: CX,         focusY: CY - 380 }],
      [17.0, { zoomTo: 0.70, focusX: CX,         focusY: CY       }],

      // SCENE 4: space — static, distant, isolating
      [17.5, { zoomTo: 0.55, focusX: CX,         focusY: CY - 50  }],
      [20.0, { zoomTo: 0.55, focusX: CX,         focusY: CY - 50  }],
      [21.5, { zoomTo: 0.70, focusX: CX,         focusY: CY       }],

      // SCENE 5: punch — ram zoom forward on impact
      [22.5, { zoomTo: 1.60, focusX: CX,         focusY: CY       }],
      [23.1, { zoomTo: 2.40, focusX: CX,         focusY: CY - 30  }],
      [24.0, { zoomTo: 1.80, focusX: CX,         focusY: CY       }],
      [25.5, { zoomTo: 0.80, focusX: CX,         focusY: CY       }],
      [26.5, { zoomTo: 1.00, focusX: CX,         focusY: CY       }],

      // SCENE 6: tight on floating boss, slow orbit
      [27.0, { zoomTo: 1.60, focusX: CX,         focusY: CY - 60  }],
      [29.5, { zoomTo: 1.30, focusX: CX,         focusY: CY - 40  }],
      [31.0, { zoomTo: 0.65, focusX: CX,         focusY: CY       }],

      // SCENE 7: pull all the way back — god-shot of the world being built
      [32.0, { zoomTo: 0.45, focusX: CX,         focusY: CY + 40  }],
      [35.0, { zoomTo: 0.55, focusX: CX,         focusY: CY       }],
      [37.5, { zoomTo: 1.00, focusX: CX,         focusY: CY       }],
    ],

    // ── ONE-TIME STEPS ────────────────────────────────────────
    steps: [

      // ══ SCENE 1 — ALLEY ═══════════════════════════════════

      // Darkness-flavoured blue screen flash as scene opens
      { at: 0.05,
        fx: { flash: { color: '#000022', alpha: 0.80, dur: 30 } }
      },

      // Subtitle — place, time
      { at: 0.4,
        dialogue: 'Before the world was made…',
        dialogueDur: 200,
      },

      // Ambient footstep particle dust — boss (human) walks in
      { at: 1.2,
        run({ CinFX }) {
          CinFX.particles(CX - 120, CY + 90, '#334455', 10);
          CinFX.particles(CX - 80,  CY + 90, '#334455',  8);
        }
      },

      // Soft blue flash — a figure steps under a shaft of light
      { at: 2.2,
        fx: { flash: { color: '#002244', alpha: 0.30, dur: 18 } }
      },

      // An opponent steps forward — subtle ground dust
      { at: 3.0,
        run({ CinFX }) {
          CinFX.particles(CX + 100, CY + 90, '#445566', 12);
          CinFX.groundCrack(CX + 100, CY + 95, { count: 2, color: '#333355' });
        }
      },

      // Dialogue: "just a man, picking a fight"
      { at: 3.8,
        dialogue: 'He was no one.',
        dialogueDur: 160,
      },

      // Clashing weapons spark — the fight begins
      { at: 5.0,
        run({ CinFX }) {
          CinFX.shake(6);
          CinFX.particles(CX, CY + 20, '#ffffff', 18);
          CinFX.particles(CX, CY + 20, '#99aacc', 10);
        }
      },

      // ══ SCENE 2 — AWAKENING ════════════════════════════════

      // HIT 1 — he takes a blow; something changes
      { at: 6.8,
        run({ CinFX }) {
          CinFX.shake(14);
          CinFX.flash('#cc2200', 0.30, 8);
          CinFX.particles(CX - 40, CY, '#ff4422', 22);
          CinFX.groundCrack(CX - 40, CY + 90, { count: 3, color: '#cc3300' });
        }
      },
      { at: 7.0,
        dialogue: 'Then something answered.',
        dialogueDur: 180,
      },

      // HIT 2 — he hits back harder; orange energy
      { at: 8.0,
        run({ CinFX }) {
          CinFX.shake(24);
          CinFX.flash('#ff6600', 0.35, 10);
          CinFX.shockwave(CX, CY + 10, '#ff8800', { count: 2, maxR: 180 });
          CinFX.particles(CX + 20, CY, '#ffaa44', 30);
          CinFX.groundCrack(CX + 20, CY + 90, { count: 5, color: '#ff5500' });
        }
      },

      // HIT 3 — unstoppable surge; purple-white energy erupts
      { at: 9.4,
        run({ CinFX }) {
          CinFX.shake(44);
          CinFX.flash('#ffffff', 0.75, 14);
          CinFX.shockwave(CX, CY, '#cc44ff', { count: 4, maxR: 300, lw: 5 });
          CinFX.particles(CX, CY, '#ffffff', 55);
          CinFX.particles(CX, CY, '#cc44ff', 30);
          CinFX.groundCrack(CX, CY + 90, { count: 8, color: '#9900ff' });
        }
      },

      // His opponent flies off — trails of orange
      { at: 9.9,
        run({ CinFX }) {
          CinFX.particles(CX + 160, CY - 20, '#ff8800', 18);
          CinFX.particles(CX + 220, CY - 50, '#ff4400', 12);
        }
      },

      // ══ SCENE 3 — SKY ASCENSION ════════════════════════════

      // First uppercut — ground shatter below
      { at: 11.5,
        run({ CinFX }) {
          CinFX.shake(30);
          CinFX.flash('#ffeecc', 0.45, 10);
          CinFX.shockwave(CX, CY + 80, '#ffcc44', { count: 3, maxR: 220 });
          CinFX.particles(CX, CY + 80, '#ffcc00', 40);
          CinFX.groundCrack(CX, CY + 95, { count: 10, color: '#ffaa00' });
        }
      },
      { at: 11.7,
        dialogue: 'He struck the sky.',
        dialogueDur: 160,
      },

      // Second uppercut — purple/white cloud burst
      { at: 12.8,
        run({ CinFX }) {
          CinFX.shake(38);
          CinFX.flash('#eeddff', 0.40, 10);
          CinFX.shockwave(CX, CY - 80, '#cc66ff', { count: 3, maxR: 260, lw: 4 });
          CinFX.particles(CX, CY - 80, '#cc88ff', 35);
          CinFX.particles(CX, CY - 80, '#ffffff', 20);
        }
      },

      // Clouds breaking — horizontal streaks of white
      { at: 13.8,
        run({ CinFX }) {
          for (let i = 0; i < 6; i++) {
            CinFX.particles(
              CX + (Math.random() - 0.5) * 420,
              CY - 200 + (Math.random() - 0.5) * 80,
              '#eeeeff', 6
            );
          }
          CinFX.flash('#ccccff', 0.20, 8);
        }
      },

      // Final uppercut — massive; passes the clouds
      { at: 14.2,
        run({ CinFX }) {
          CinFX.shake(55);
          CinFX.flash('#ffffff', 0.90, 16);
          CinFX.shockwave(CX, CY - 220, '#ffffff', { count: 5, maxR: 380, lw: 6 });
          CinFX.particles(CX, CY - 220, '#ffffff', 60);
          CinFX.particles(CX, CY - 220, '#aaccff', 30);
        }
      },

      // Silence after the burst before space
      { at: 16.5,
        dialogue: '…and kept going.',
        dialogueDur: 180,
      },

      // ══ SCENE 4 — SPACE SILENCE ════════════════════════════

      // Black-out wipe into void
      { at: 17.0,
        fx: { flash: { color: '#000000', alpha: 1.0, dur: 40 } }
      },

      // Void twinkle — distant white star particles
      { at: 17.8,
        run({ CinFX }) {
          for (let i = 0; i < 5; i++) {
            CinFX.particles(
              CX + (Math.random() - 0.5) * 700,
              CY + (Math.random() - 0.5) * 400,
              '#ffffff', 3
            );
          }
        }
      },

      // Heartbeat 1 — subtle shake pulse, like a thud
      { at: 18.5,
        run({ CinFX }) {
          CinFX.shake(8);
          CinFX.flash('#220022', 0.18, 5);
        }
      },

      // More stars drift in
      { at: 19.2,
        run({ CinFX }) {
          for (let i = 0; i < 6; i++) {
            CinFX.particles(
              CX + (Math.random() - 0.5) * 700,
              CY + (Math.random() - 0.5) * 400,
              '#aaaaff', 3
            );
          }
        }
      },

      // Heartbeat 2 — stronger
      { at: 19.7,
        run({ CinFX }) {
          CinFX.shake(12);
          CinFX.flash('#330033', 0.22, 6);
        }
      },

      // Heartbeat 3 — builds
      { at: 20.5,
        run({ CinFX }) {
          CinFX.shake(18);
          CinFX.flash('#440044', 0.28, 7);
          CinFX.particles(CX, CY, '#cc00ff', 8);
        }
      },

      { at: 20.9,
        dialogue: 'Nothing.',
        dialogueDur: 120,
      },

      // ══ SCENE 5 — REALITY BREAK PUNCH ══════════════════════

      // Wind-up — purple aura builds
      { at: 21.8,
        run({ CinFX }) {
          CinFX.shake(10);
          CinFX.particles(CX, CY, '#9900ee', 30);
          CinFX.particles(CX, CY, '#ff44ff', 15);
          CinFX.shockwave(CX, CY, '#cc00ff', { count: 2, maxR: 140 });
        }
      },

      // Charge — energy converges inward
      { at: 22.5,
        run({ CinFX }) {
          CinFX.shake(22);
          CinFX.flash('#440066', 0.40, 10);
          CinFX.particles(CX, CY - 20, '#cc44ff', 40);
          CinFX.particles(CX, CY - 20, '#ffffff', 20);
        }
      },

      { at: 22.8,
        dialogue: 'He punched through it.',
        dialogueDur: 200,
      },

      // THE IMPACT — reality shatters
      { at: 23.1,
        run({ CinFX }) {
          CinFX.shake(80);
          CinFX.flash('#ffffff', 1.0, 22);
          CinFX.shockwave(CX, CY, '#ffffff', { count: 6, maxR: 500, lw: 7 });
          CinFX.shockwave(CX, CY, '#cc00ff', { count: 4, maxR: 400, lw: 5 });
          CinFX.particles(CX, CY, '#ffffff', 80);
          CinFX.particles(CX, CY, '#ee44ff', 50);
          CinFX.particles(CX, CY, '#ff0077', 35);
          CinFX.groundCrack(CX, CY + 90, { count: 14, color: '#cc00ff' });
          CinFX.groundCrack(CX, CY + 90, { count: 10, color: '#ffffff' });
        }
      },

      // Rift tears open — additional jagged cracks as it widens
      { at: 23.6,
        run({ CinFX }) {
          CinFX.shake(45);
          CinFX.flash('#220033', 0.55, 14);
          CinFX.groundCrack(CX - 80, CY + 90, { count: 6, color: '#ff00ff' });
          CinFX.groundCrack(CX + 80, CY + 90, { count: 6, color: '#ff00ff' });
          CinFX.particles(CX, CY + 30, '#ff44ff', 30);
        }
      },

      // Rift fully open — sucking light in
      { at: 24.5,
        run({ CinFX }) {
          CinFX.shake(25);
          CinFX.shockwave(CX, CY, '#000000', { count: 3, maxR: 320 });
          CinFX.particles(CX, CY, '#000000', 20);
          CinFX.particles(CX, CY, '#9900cc', 25);
        }
      },

      // Dialogue — truth dawning
      { at: 25.2,
        dialogue: 'And something looked back.',
        dialogueDur: 200,
      },

      // ══ SCENE 6 — CORRUPTION ════════════════════════════════

      // Dark energy wraps him — tendrils of black and purple
      { at: 26.5,
        run({ CinFX }) {
          CinFX.flash('#110011', 0.60, 20);
          CinFX.shake(18);
          CinFX.particles(CX, CY + 10, '#330033', 30);
          CinFX.particles(CX, CY + 10, '#6600aa', 20);
        }
      },

      // He rises — floating now, no longer human
      { at: 27.2,
        run({ CinFX }) {
          CinFX.particles(CX, CY + 80, '#440044', 20);  // ground 'lift' dust
          CinFX.shockwave(CX, CY + 60, '#660066', { count: 2, maxR: 180 });
          CinFX.shake(14);
        }
      },

      // Dark aura pulses outward
      { at: 27.8,
        run({ CinFX }) {
          CinFX.shockwave(CX, CY - 30, '#9900bb', { count: 3, maxR: 250, lw: 4 });
          CinFX.particles(CX, CY - 30, '#cc00ee', 35);
          CinFX.particles(CX, CY - 30, '#000000', 25);
          CinFX.flash('#110022', 0.35, 12);
        }
      },

      { at: 28.6,
        dialogue: 'It gave him everything.',
        dialogueDur: 200,
      },

      // The smile — a flash of pure white light
      { at: 29.5,
        run({ CinFX }) {
          CinFX.shake(10);
          CinFX.flash('#ffffff', 0.20, 8);
          CinFX.particles(CX, CY - 40, '#ffffff', 12);
        }
      },

      // Second aura surge before scene transition
      { at: 30.2,
        run({ CinFX }) {
          CinFX.shockwave(CX, CY - 20, '#cc00ff', { count: 4, maxR: 340, lw: 5 });
          CinFX.particles(CX, CY - 20, '#cc00ff', 40);
          CinFX.particles(CX, CY - 20, '#ffffff', 20);
          CinFX.shake(20);
          CinFX.flash('#220033', 0.45, 14);
        }
      },

      // ══ SCENE 7 — UNIVERSE CREATION ════════════════════════

      // Platform 1 materialises — burst of ground
      { at: 31.2,
        run({ CinFX }) {
          CinFX.particles(CX - 200, CY + 80, '#665544', 25);
          CinFX.particles(CX - 200, CY + 80, '#888866', 15);
          CinFX.shake(16);
          CinFX.flash('#332211', 0.25, 8);
        }
      },

      // Platform 2 — another arena fragment snaps into existence
      { at: 32.0,
        run({ CinFX }) {
          CinFX.particles(CX + 220, CY + 60, '#445566', 25);
          CinFX.particles(CX + 220, CY + 60, '#667788', 15);
          CinFX.shake(14);
          CinFX.shockwave(CX + 220, CY + 60, '#aabbcc', { count: 2, maxR: 150 });
        }
      },

      // Stars snap into being — small white bursts all over
      { at: 32.6,
        run({ CinFX }) {
          for (let i = 0; i < 8; i++) {
            CinFX.particles(
              CX + (Math.random() - 0.5) * 700,
              CY + (Math.random() - 0.5) * 440,
              '#ffffff', 5
            );
          }
        }
      },

      { at: 33.0,
        dialogue: 'He built it all.',
        dialogueDur: 200,
      },

      // Platform 3 + more stars
      { at: 33.4,
        run({ CinFX }) {
          CinFX.particles(CX, CY + 120, '#553322', 20);
          CinFX.shake(12);
          for (let i = 0; i < 6; i++) {
            CinFX.particles(
              CX + (Math.random() - 0.5) * 600,
              CY + (Math.random() - 0.5) * 380,
              '#ffeeaa', 4
            );
          }
        }
      },

      // Grand shockwave — the world expanding outward
      { at: 34.5,
        run({ CinFX }) {
          CinFX.shake(30);
          CinFX.flash('#221133', 0.50, 16);
          CinFX.shockwave(CX, CY, '#aa44ff', { count: 5, maxR: 480, lw: 6 });
          CinFX.shockwave(CX, CY, '#ffffff', { count: 3, maxR: 380, lw: 3 });
          CinFX.particles(CX, CY, '#ffffff', 45);
          CinFX.particles(CX, CY, '#cc88ff', 30);
        }
      },

      // Final beat — boss watches from above; stars settle
      { at: 35.5,
        run({ CinFX }) {
          for (let i = 0; i < 10; i++) {
            CinFX.particles(
              CX + (Math.random() - 0.5) * 700,
              CY + (Math.random() - 0.5) * 440,
              '#aaaaff', 4
            );
          }
          CinFX.flash('#110022', 0.20, 10);
        }
      },

      // Final line — before the title card
      { at: 36.5,
        dialogue: 'Every arena. Every rule. Every fighter.',
        dialogueDur: 260,
      },

      { at: 37.6,
        dialogue: 'All of it — his.',
        dialogueDur: 120,
      },

      // Fade to black before fight begins
      { at: 37.9,
        fx: { flash: { color: '#000000', alpha: 1.0, dur: 45 } }
      },
    ],
  }));
}


// ============================================================
// MID-FIGHT CINEMATICS — Creator Boss (75%, 40%, 10%)
// ============================================================

function _makeBossWarning75Cinematic(boss) {
  return cinScript({
    duration: 3.2,
    label:    { text: '— I MADE THIS WORLD —', color: '#aa44ff' },

    // Slow ramp down → near-freeze through dialogue → ramp back
    slowMo: [[0, 1.0], [0.35, 0.06], [2.8, 0.06], [3.2, 1.0]],

    cam: [
      [0,    { zoomTo: 1.0, focusOn: () => boss }],
      [0.3,  { zoomTo: 1.55, focusOn: () => boss }],
      [1.8,  { zoomTo: 1.3, focusX: GAME_W / 2, focusY: GAME_H / 2 }],
      [2.8,  { zoomTo: 1.0, focusX: GAME_W / 2, focusY: GAME_H / 2 }],
    ],

    steps: [
      // Boss rises off the ground
      { at: 0.3,
        run({ boss }) {
          if (!boss) return;
          boss.vy = -8;
          CinFX.particles(boss.cx(), boss.cy(), '#aa44ff', 25);
          CinFX.particles(boss.cx(), boss.cy(), '#ffffff', 12);
          CinFX.shake(18);
        }
      },
      // Arena hazard triggers (makes the arena feel like it's reacting)
      { at: 0.5,
        fx: { shockwave: { x: () => boss ? boss.cx() : GAME_W/2,
                           y: () => boss ? boss.cy() : GAME_H/2,
                           color: '#aa44ff', count: 3, maxR: 240 } }
      },
      { at: 0.5, run() { CinFX.arenaHazardNow(); } },
      // First dialogue line
      { at: 0.6, dialogue: 'This world existed before you arrived.', dialogueDur: 160 },
      // Purple energy rings pulse from arena center
      { at: 1.0,
        fx: { shockwave: { x: GAME_W / 2, y: GAME_H / 2,
                           color: '#cc00ee', count: 2, maxR: 380, dur: 90 } }
      },
      // Second dialogue line
      { at: 1.7, dialogue: 'I wrote the rules. I can revise them.', dialogueDur: 180 },
      // Screen flash + shake for emphasis
      { at: 1.75,
        fx: { flash: { color: '#aa44ff', alpha: 0.35, dur: 10 },
              screenShake: 22 }
      },
      // Boss lands / resumes
      { at: 2.6,
        run({ boss }) {
          if (boss) CinFX.particles(boss.cx(), boss.cy(), '#cc00ee', 18);
        }
      },
    ],
  });
}


function _makeBossRage40Cinematic(boss) {
  // Capture the thrown target at the moment of the grab so camera can track it
  let _throwTarget = null;

  return cinScript({
    duration: 4.2,
    label: { text: '— ENOUGH. —', color: '#ff0044' },

    // 0–0.4: ramp to freeze; 0.4–1.2: ramp UP so throw is visible; 1.2–1.7: freeze for slam; 1.7+: crawl then resume
    slowMo: [[0, 1.0], [0.4, 0.05], [0.45, 0.05], [1.1, 0.50], [1.7, 0.05], [3.8, 0.06], [4.2, 1.0]],

    cam: [
      // Tight zoom on boss at start
      [0,   { zoomTo: 1.0, focusOn: () => boss }],
      [0.3, { zoomTo: 1.85, focusOn: () => boss }],
      // During throw: track the flying player
      [0.45, { zoomTo: 1.2, focusOn: () => _throwTarget || (players && players.find(p => !p.isBoss && p.health > 0)) }],
      // Zoom out to reveal the slam landing
      [1.0, { zoomTo: 0.95, focusX: GAME_W / 2, focusY: GAME_H / 2 }],
      // Settle back during dialogue
      [1.8, { zoomTo: 1.35, focusOn: () => boss }],
      [3.8, { zoomTo: 1.0,  focusX: GAME_W / 2, focusY: GAME_H / 2 }],
    ],

    steps: [
      // Pre-grab: boss glows red
      { at: 0.25,
        run({ boss }) {
          if (!boss) return;
          CinFX.particles(boss.cx(), boss.cy(), '#ff0044', 20);
          CinFX.shake(14);
        }
      },
      // Teleport boss directly behind the player and hurl them
      { at: 0.42,
        run({ boss, target }) {
          if (!boss || !target) return;
          _throwTarget = target;
          // Teleport boss to just behind the player's back
          const facingRight = target.vx >= 0;
          const behindX     = facingRight ? target.cx() - 52 : target.cx() + 52;
          boss.x  = behindX - boss.w / 2;
          boss.y  = target.y;
          boss.vy = 0;
          // Portal burst at new boss position
          CinFX.particles(boss.cx(), boss.cy(), '#cc00ee', 40);
          CinFX.particles(boss.cx(), boss.cy(), '#ff44ff', 18);
          CinFX.shake(24);
          CinFX.flash('#ff2200', 0.25, 8);
          // Hurl player away — arc across the arena
          const throwDir = facingRight ? 1 : -1;
          target.vx       = throwDir * 20;
          target.vy       = -13;
          target.hurtTimer  = Math.max(target.hurtTimer || 0, 32);
          target.stunTimer  = Math.max(target.stunTimer  || 0, 28);
        }
      },
      // Trail particles chasing the thrown player during flight (two pulses)
      { at: 0.65,
        run() {
          if (_throwTarget) CinFX.particles(_throwTarget.cx(), _throwTarget.cy(), '#ff4400', 22);
        }
      },
      { at: 0.90,
        run() {
          if (_throwTarget) CinFX.particles(_throwTarget.cx(), _throwTarget.cy(), '#ff8800', 15);
        }
      },
      // Boss slam: boss drops hard toward where the player will land
      { at: 1.1,
        run({ boss }) {
          if (!boss) return;
          boss.vy = 30; // hard slam down
          CinFX.flash('#ffffff', 0.45, 10);
          CinFX.shake(52);
        }
      },
      // Shockwave + ground cracks at impact zone
      { at: 1.15,
        fx: {
          shockwave:   { x: () => boss ? boss.cx() : GAME_W/2,
                         y: GAME_H - 60, color: '#ff0044', count: 5, maxR: 320, lw: 5, dur: 80 },
          groundCrack: { x: () => boss ? boss.cx() : GAME_W/2,
                         y: GAME_H - 65, color: '#cc2200', count: 7 },
        }
      },
      // Shockwave knocks the thrown player further
      { at: 1.15,
        run({ boss }) {
          if (!boss) return;
          CinFX.particles(boss.cx(), GAME_H - 60, '#ff0044', 55);
          CinFX.particles(boss.cx(), GAME_H - 60, '#ffffff', 28);
          for (const p of players) {
            if (p.isBoss || p.health <= 0) continue;
            const dir = p.cx() >= boss.cx() ? 1 : -1;
            p.vx += dir * 13;
            p.vy  = Math.min(p.vy || 0, -9);
            p.hurtTimer = Math.max(p.hurtTimer || 0, 18);
          }
        }
      },
      // Dialogue
      { at: 1.55, dialogue: 'I\'m done being generous.',  dialogueDur: 140 },
      { at: 2.30, dialogue: 'You don\'t get to leave.',   dialogueDur: 220 },
      // Second dramatic shake for the line delivery
      { at: 2.35, fx: { flash: { color: '#ff0044', alpha: 0.3, dur: 8 }, screenShake: 26 } },
    ],
  });
}


function _makeBossDesp10Cinematic(boss) {
  return cinScript({
    duration: 3.5,
    label: { text: '— IMPOSSIBLE —', color: '#ff8800' },

    slowMo: [[0, 1.0], [0.3, 0.05], [3.1, 0.05], [3.5, 1.0]],

    cam: [
      [0,   { zoomTo: 1.0, focusX: GAME_W / 2, focusY: GAME_H / 2 }],
      [0.25, { zoomTo: 1.6, focusOn: () => boss }],
      [2.8,  { zoomTo: 1.0, focusX: GAME_W / 2, focusY: GAME_H / 2 }],
    ],

    steps: [
      // Boss staggers — visual jolt
      { at: 0.3,
        run({ boss }) {
          if (!boss) return;
          boss.vx += (Math.random() - 0.5) * 10;
          boss.vy  = -5;
          boss.hurtTimer = Math.max(boss.hurtTimer || 0, 18);
          CinFX.particles(boss.cx(), boss.cy(), '#ff8800', 30);
          CinFX.particles(boss.cx(), boss.cy(), '#ffff00', 15);
          CinFX.shake(30);
          CinFX.flash('#ff8800', 0.30, 12);
        }
      },
      // Ground cracks radiate from boss impact
      { at: 0.35,
        fx: {
          groundCrack: { x: () => boss ? boss.cx() : GAME_W/2,
                         y: GAME_H - 65, color: '#cc4400', count: 9 },
          shockwave:   { x: () => boss ? boss.cx() : GAME_W/2,
                         y: () => boss ? boss.cy() : GAME_H/2,
                         color: '#ff6600', count: 4, maxR: 260 }
        }
      },
      // Desperation mode activates
      { at: 0.5,
        run() {
          if (typeof bossDesperationMode !== 'undefined') bossDesperationMode = true;
          CinFX.particles(GAME_W / 2, GAME_H / 2, '#ff8800', 40);
          CinFX.shake(20);
        }
      },
      // Red arena tint rings
      { at: 0.6,
        fx: { shockwave: { x: GAME_W / 2, y: GAME_H / 2,
                           color: '#ff4400', count: 3, maxR: 450, dur: 100 } }
      },
      { at: 1.0, dialogue: 'You\'re still here.',        dialogueDur: 160 },
      { at: 1.85, dialogue: 'Most things break. You don\'t.', dialogueDur: 200 },
      { at: 1.9,
        fx: { flash: { color: '#ff8800', alpha: 0.40, dur: 10 }, screenShake: 32 }
      },
      // Final crack burst
      { at: 2.6,
        fx: { groundCrack: { x: GAME_W / 2, y: GAME_H - 65, color: '#ff4400', count: 6 } }
      },
    ],
  });
}


// ============================================================
// MID-FIGHT CINEMATICS — True Form (entry, 50%, 15%)
// ============================================================

function _makeTFEntryCinematic(tf) {
  return cinScript({
    duration: 4.8,
    label: { text: '— TRUE POWER —', color: '#ffffff' },

    slowMo: [[0, 1.0], [0.2, 0.35], [0.55, 0.05], [2.6, 0.08], [3.8, 0.18], [4.8, 1.0]],

    cam: [
      [0,    { zoomTo: 0.82, focusX: GAME_W / 2, focusY: GAME_H / 2 }],
      [0.35, { zoomTo: 1.55, focusOn: () => tf }],
      [1.4,  { zoomTo: 1.88, focusOn: () => tf }],
      [2.6,  { zoomTo: 1.08, focusX: GAME_W / 2, focusY: GAME_H / 2 }],
      [4.2,  { zoomTo: 0.94, focusX: GAME_W / 2, focusY: GAME_H / 2 }],
    ],

    steps: [
      { at: 0.18,
        fx: { flash: { color: '#05070f', alpha: 0.78, dur: 14 }, screenShake: 10 }
      },
      // Energy burst from TF
      { at: 0.45,
        run({ boss: tf }) {
          if (!tf) return;
          tf.vy = -10;
          CinFX.particles(tf.cx(), tf.cy(), '#ffffff', 70);
          CinFX.particles(tf.cx(), tf.cy(), '#000000', 45);
          CinFX.particles(tf.cx(), tf.cy(), '#8aa7ff', 28);
          CinFX.shake(42);
          CinFX.flash('#ffffff', 0.62, 18);
        }
      },
      // Expanding black/white rings
      { at: 0.48,
        fx: { shockwave: { x: () => tf ? tf.cx() : GAME_W/2,
                           y: () => tf ? tf.cy() : GAME_H/2,
                           color: '#ffffff', count: 6, maxR: 460, lw: 6, dur: 110 } }
      },
      // Blast wave that pushes human players back
      { at: 0.56,
        run({ boss: tf }) {
          if (!tf) return;
          for (const p of players) {
            if (p.isBoss || p.health <= 0) continue;
            const dir = p.cx() >= tf.cx() ? 1 : -1;
            p.vx      = dir * 24;
            p.vy      = -16;
            p.hurtTimer = Math.max(p.hurtTimer || 0, 20);
            CinFX.particles(p.cx(), p.cy(), '#ffffff', 12);
          }
        }
      },
      { at: 0.72,
        fx: { shockwave: { x: () => tf ? tf.cx() : GAME_W/2,
                           y: () => tf ? tf.cy() : GAME_H/2,
                           color: '#000000', count: 4, maxR: 360, dur: 82 } }
      },
      { at: 1.05, dialogue: 'You pushed past the limit I set.', dialogueDur: 180 },
      // Mid-cinematic second ring burst
      { at: 1.7,
        fx: { shockwave: { x: GAME_W / 2, y: GAME_H / 2,
                           color: '#888888', count: 3, maxR: 560, dur: 130 },
              screenShake: 22 }
      },
      { at: 2.15, dialogue: 'This is what I keep in reserve.', dialogueDur: 220 },
      { at: 2.25, fx: { flash: { color: '#ffffff', alpha: 0.48, dur: 12 } } },
      // Ground cracks from the void energy
      { at: 2.55,
        fx: { groundCrack: { x: () => tf ? tf.cx() : GAME_W/2,
                             y: GAME_H - 65, color: '#888888', count: 10 } }
      },
      { at: 3.25,
        dialogue: 'Look carefully. This is the part no one survives.',
        dialogueDur: 210,
      },
      { at: 3.35,
        fx: { flash: { color: '#7f96ff', alpha: 0.30, dur: 10 }, screenShake: 16 }
      },
    ],
  });
}


function _makeTFReality50Cinematic(tf) {
  return cinScript({
    duration: 4.7,
    label: { text: '— REALITY BENDS —', color: '#8844ff' },

    slowMo: [[0, 1.0], [0.25, 0.30], [0.55, 0.06], [2.6, 0.08], [3.8, 0.16], [4.7, 1.0]],

    // Orbit camera around the arena during the gravity inversion reveal
    orbit: { cx: GAME_W / 2, cy: GAME_H / 2, radius: 110, speed: 0.44, zoom: 1.16, start: 1.0 },

    cam: [
      // Snap to TF before orbit kicks in
      [0,   { zoomTo: 0.95, focusOn: () => tf }],
      [0.35, { zoomTo: 1.7, focusOn: () => tf }],
      [0.9, { zoomTo: 0.86, focusX: GAME_W / 2, focusY: GAME_H / 2 }],
    ],

    steps: [
      // TF energy pulse
      { at: 0.28,
        run({ boss: tf }) {
          if (!tf) return;
          CinFX.particles(tf.cx(), tf.cy(), '#8844ff', 44);
          CinFX.particles(tf.cx(), tf.cy(), '#ffffff', 24);
          CinFX.particles(tf.cx(), tf.cy(), '#120022', 16);
          CinFX.shake(30);
          CinFX.flash('#8844ff', 0.42, 12);
        }
      },
      { at: 0.36,
        fx: { shockwave: { x: () => tf ? tf.cx() : GAME_W/2,
                           y: () => tf ? tf.cy() : GAME_H/2,
                           color: '#8844ff', count: 5, maxR: 360, lw: 5, dur: 90 } }
      },
      { at: 0.88, dialogue: 'Reality is a setting.', dialogueDur: 160 },
      // Gravity inverts for 3 seconds
      { at: 1.18,
        run() {
          if (typeof tfGravityInverted !== 'undefined') {
            tfGravityInverted = true;
            tfGravityTimer    = 240; // hard 4-second restore via the central failsafe
          }
          CinFX.shake(44);
          CinFX.flash('#ffffff', 0.48, 16);
        }
      },
      { at: 1.18,
        fx: { shockwave: { x: GAME_W / 2, y: GAME_H / 2,
                           color: '#ffffff', count: 7, maxR: 560, lw: 6, dur: 118 } }
      },
      { at: 1.72, dialogue: 'I adjusted it.', dialogueDur: 190 },
      // Second arena-wide ring
      { at: 2.18,
        fx: { shockwave: { x: GAME_W / 2, y: GAME_H / 2,
                           color: '#440088', count: 3, maxR: 640, dur: 138 },
              screenShake: 26 }
      },
      // Spawn a black hole for drama
      { at: 2.75,
        run() {
          if (typeof tfBlackHoles !== 'undefined') {
            tfBlackHoles.push({ x: GAME_W / 2, y: GAME_H / 2 - 40,
              radius: 0, maxRadius: 45, timer: 360, pullStrength: 0.6, phase: 'grow' });
          }
        }
      },
      { at: 3.35,
        dialogue: 'Hold yourself together if you can.',
        dialogueDur: 180,
      },
      { at: 3.55,
        fx: { flash: { color: '#cda8ff', alpha: 0.28, dur: 10 }, screenShake: 14 }
      },
    ],
  });
}


function _makeTFDesp15Cinematic(tf) {
  return cinScript({
    duration: 5.1,
    label: { text: '— WE FALL TOGETHER —', color: '#ff0044' },

    // Extreme slow-mo throughout, brief normal-speed flash on impact
    slowMo: [[0, 1.0], [0.2, 0.25], [0.45, 0.03], [2.1, 0.05], [3.8, 0.08], [5.1, 1.0]],

    cam: [
      [0,    { zoomTo: 0.95, focusX: GAME_W / 2, focusY: GAME_H / 2 }],
      [0.35, { zoomTo: 0.68, focusX: GAME_W / 2, focusY: GAME_H / 2 }],
      [1.4,  { zoomTo: 1.58, focusOn: () => tf }],
      [2.7,  { zoomTo: 1.18, focusX: GAME_W / 2, focusY: GAME_H / 2 }],
      [4.5,  { zoomTo: 0.92, focusX: GAME_W / 2, focusY: GAME_H / 2 }],
    ],

    steps: [
      // TF screams — full-arena energy burst
      { at: 0.32,
        run({ boss: tf }) {
          if (!tf) return;
          CinFX.particles(tf.cx(), tf.cy(), '#ffffff', 76);
          CinFX.particles(tf.cx(), tf.cy(), '#000000', 54);
          CinFX.particles(tf.cx(), tf.cy(), '#ff0044', 38);
          CinFX.shake(62);
          CinFX.flash('#ffffff', 0.76, 20);
        }
      },
      // Massive concentric ring explosion
      { at: 0.32,
        fx: { shockwave: { x: () => tf ? tf.cx() : GAME_W/2,
                           y: () => tf ? tf.cy() : GAME_H/2,
                           color: '#ff0044', count: 7, maxR: 680, lw: 7, dur: 128 } }
      },
      { at: 0.42,
        fx: { shockwave: { x: GAME_W / 2, y: GAME_H / 2,
                           color: '#ffffff', count: 5, maxR: 760, lw: 4, dur: 145 } }
      },
      // Floor removal (10 seconds)
      { at: 0.62,
        run() {
          if (typeof tfFloorRemoved !== 'undefined') {
            tfFloorRemoved  = true;
            tfFloorTimer    = 600; // 10s
          }
          CinFX.groundCrack(GAME_W / 2, GAME_H - 65, { color: '#ff0044', count: 12 });
          CinFX.groundCrack(GAME_W * 0.25, GAME_H - 65, { color: '#ff4400', count: 7 });
          CinFX.groundCrack(GAME_W * 0.75, GAME_H - 65, { color: '#ff4400', count: 7 });
        }
      },
      // Desperation mode
      { at: 0.72,
        run() {
          if (typeof bossDesperationMode !== 'undefined') bossDesperationMode = true;
          CinFX.flash('#ff0044', 0.58, 14);
        }
      },
      // Spawn two black holes flanking the arena
      { at: 0.96,
        run() {
          if (typeof tfBlackHoles !== 'undefined') {
            tfBlackHoles.push({ x: GAME_W * 0.2, y: GAME_H / 2,
              radius: 0, maxRadius: 50, timer: 480, pullStrength: 0.8, phase: 'grow' });
            tfBlackHoles.push({ x: GAME_W * 0.8, y: GAME_H / 2,
              radius: 0, maxRadius: 50, timer: 480, pullStrength: 0.8, phase: 'grow' });
          }
        }
      },
      // Additional crack wave
      { at: 1.2,
        fx: { shockwave: { x: GAME_W / 2, y: GAME_H / 2,
                           color: '#880022', count: 4, maxR: 620, dur: 116 },
              screenShake: 36 }
      },
      { at: 1.55, dialogue: 'You want the ending?', dialogueDur: 130 },
      { at: 2.25, dialogue: 'Then watch the universe break with me.', dialogueDur: 240 },
      { at: 2.32, fx: { flash: { color: '#ff0044', alpha: 0.60, dur: 14 }, screenShake: 44 } },
      // Final ring sweep
      { at: 3.55,
        fx: { shockwave: { x: GAME_W / 2, y: GAME_H / 2,
                           color: '#ff0044', count: 4, maxR: 760, dur: 155 } }
      },
      { at: 4.05,
        fx: { flash: { color: '#ffffff', alpha: 0.26, dur: 10 }, screenShake: 18 }
      },
    ],
  });
}

// ============================================================
// MULTIVERSE TRAVEL CINEMATIC
// DOM-canvas overlay; runs independently of the game loop so
// it can play safely between story chapters (no game loop active).
// ============================================================
function startMultiverseTravelCinematic(arcLabel, arcColor, onComplete) {
  // Remove any leftover overlay from a previous call
  const old = document.getElementById('multiverseTravelOverlay');
  if (old) old.remove();

  const overlay = document.createElement('div');
  overlay.id = 'multiverseTravelOverlay';
  overlay.style.cssText = [
    'position:fixed', 'top:0', 'left:0', 'width:100%', 'height:100%',
    'z-index:9000', 'background:#000', 'pointer-events:all',
  ].join(';');

  const cvs = document.createElement('canvas');
  cvs.width  = window.innerWidth;
  cvs.height = window.innerHeight;
  cvs.style.cssText = 'width:100%;height:100%;display:block;';
  overlay.appendChild(cvs);
  document.body.appendChild(overlay);

  const c   = cvs.getContext('2d');
  const W   = cvs.width;
  const H   = cvs.height;
  const COL = arcColor || '#8844ff';
  const TOTAL_FRAMES = 162; // ~2.7 s at 60 fps
  let frame = 0;
  let rafId;

  // Build star-field particles once
  const stars = [];
  for (let i = 0; i < 140; i++) {
    stars.push({
      x:  W * Math.random(),
      y:  H * Math.random(),
      vx: (Math.random() - 0.5) * 3.5,
      vy: (Math.random() - 0.5) * 3.5,
      r:  0.8 + Math.random() * 2.4,
    });
  }

  function tick() {
    frame++;
    const t   = frame / TOTAL_FRAMES;       // 0 → 1
    const env = Math.sin(t * Math.PI);       // 0 → 1 → 0 envelope

    // ── Background ───────────────────────────────────────────────
    c.clearRect(0, 0, W, H);
    c.fillStyle = '#000';
    c.fillRect(0, 0, W, H);

    // ── Streaking distortion lines ────────────────────────────────
    c.save();
    for (let i = 0; i < 28; i++) {
      const y     = H * ((i / 28 + t * 0.6) % 1);
      const alpha = env * 0.25 * (0.4 + 0.6 * Math.sin((i / 28) * Math.PI * 4 + frame * 0.04));
      c.globalAlpha = Math.max(0, alpha);
      c.strokeStyle = COL;
      c.lineWidth   = 0.8 + Math.random() * 0.4;
      c.beginPath();
      c.moveTo(0, y);
      c.lineTo(W, y + (Math.random() - 0.5) * 14);
      c.stroke();
    }
    c.restore();

    // ── Star particles ────────────────────────────────────────────
    const speed = 1 + t * 3;
    c.save();
    c.globalAlpha = env * 0.85;
    c.fillStyle = COL;
    for (const s of stars) {
      s.x = (s.x + s.vx * speed + W) % W;
      s.y = (s.y + s.vy * speed + H) % H;
      c.beginPath();
      c.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      c.fill();
    }
    c.restore();

    // ── Radial vortex (peaks at t=0.5) ───────────────────────────
    const vortexAlpha = Math.max(0, 1 - Math.abs(t - 0.5) * 3.5) * 0.75;
    if (vortexAlpha > 0.01) {
      const grad = c.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, H * 0.65);
      grad.addColorStop(0,   COL);
      grad.addColorStop(0.35, COL + '55');
      grad.addColorStop(1,   '#00000000');
      c.save();
      c.globalAlpha = vortexAlpha;
      c.fillStyle   = grad;
      c.fillRect(0, 0, W, H);
      c.restore();
    }

    // ── White flash at peak ───────────────────────────────────────
    const flashAlpha = Math.max(0, 1 - Math.abs(t - 0.5) * 9);
    if (flashAlpha > 0.01) {
      c.save();
      c.globalAlpha = flashAlpha;
      c.fillStyle   = '#ffffff';
      c.fillRect(0, 0, W, H);
      c.restore();
    }

    // ── Text ──────────────────────────────────────────────────────
    const textAlpha = env;
    if (textAlpha > 0.01) {
      c.save();
      c.globalAlpha   = textAlpha;
      c.textAlign     = 'center';
      c.textBaseline  = 'middle';

      // "REALITY SHIFT" heading
      c.font        = `bold ${Math.round(H * 0.062)}px 'Arial Black', Arial, sans-serif`;
      c.shadowColor = COL;
      c.shadowBlur  = 28;
      c.fillStyle   = '#ffffff';
      c.fillText('REALITY SHIFT', W / 2, H / 2 - H * 0.065);

      // Arc label sub-heading
      if (arcLabel) {
        c.font        = `${Math.round(H * 0.033)}px Arial, sans-serif`;
        c.shadowBlur  = 14;
        c.fillStyle   = COL;
        c.fillText(arcLabel, W / 2, H / 2 + H * 0.038);
      }
      c.restore();
    }

    // ── Fade in / fade out ────────────────────────────────────────
    if (t < 0.09) {
      c.save();
      c.globalAlpha = 1 - t / 0.09;
      c.fillStyle   = '#000';
      c.fillRect(0, 0, W, H);
      c.restore();
    }
    if (t > 0.91) {
      c.save();
      c.globalAlpha = (t - 0.91) / 0.09;
      c.fillStyle   = '#000';
      c.fillRect(0, 0, W, H);
      c.restore();
    }

    if (frame < TOTAL_FRAMES) {
      rafId = requestAnimationFrame(tick);
    } else {
      cancelAnimationFrame(rafId);
      overlay.remove();
      if (typeof onComplete === 'function') onComplete();
    }
  }

  rafId = requestAnimationFrame(tick);
}
