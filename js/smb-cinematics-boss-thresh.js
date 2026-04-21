'use strict';
// smb-cinematics-boss-thresh.js — Boss mid-fight cinematics: 75%, 40%, 10% HP thresholds
// Depends on: smb-cinematics-core.js (cinScript, CinFX, CinCam)
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


