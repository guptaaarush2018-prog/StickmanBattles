'use strict';
// smb-cinematics-tf-thresh.js — TrueForm mid-fight cinematics: entry, 50%, 15% HP
// Depends on: smb-cinematics-core.js (cinScript, CinFX, CinCam)
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

