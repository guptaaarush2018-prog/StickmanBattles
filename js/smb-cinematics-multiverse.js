'use strict';
// smb-cinematics-multiverse.js — startMultiverseTravelCinematic()
// Depends on: smb-cinematics-core.js
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
