'use strict';
// smb-drawing-effects.js — Boss beams, cinematic overlay, phase rings, boss spikes, accessories, curse auras, spartan rage, lightning bolts, class effects
// Depends on: smb-globals.js, smb-data-arenas.js, smb-particles-core.js

// ============================================================
// BOSS BEAMS
// ============================================================
function drawBossBeams() {
  for (const b of bossBeams) {
    ctx.save();
    if (b.phase === 'warning') {
      const progress = 1 - b.warningTimer / 300;
      const flicker  = Math.sin(frameCount * 0.35 + b.x * 0.05) * 0.1;
      ctx.globalAlpha = clamp(0.15 + progress * 0.40 + flicker, 0.05, 0.65);
      ctx.strokeStyle = '#dd77ff';
      ctx.lineWidth   = 5 + progress * 7;
      ctx.shadowColor = '#9900ee';
      ctx.shadowBlur  = 20;
      ctx.setLineDash([22, 14]);
      ctx.beginPath();
      ctx.moveTo(b.x, 462);
      ctx.lineTo(b.x, 0);
      ctx.stroke();
      ctx.setLineDash([]);
      // Pulsing ground indicator
      const pulse = 8 + progress * 14 + Math.sin(frameCount * 0.4) * 4;
      ctx.globalAlpha = 0.75;
      ctx.fillStyle   = '#ff44ff';
      ctx.shadowBlur  = 24;
      ctx.beginPath();
      ctx.arc(b.x, 462, pulse, 0, Math.PI * 2);
      ctx.fill();
      // Countdown text
      const secs = Math.ceil(b.warningTimer / 60);
      ctx.globalAlpha = 0.9;
      ctx.font        = 'bold 11px Arial';
      ctx.fillStyle   = '#ffffff';
      ctx.textAlign   = 'center';
      ctx.shadowBlur  = 6;
      ctx.fillText(secs + 's', b.x, 448);
    } else if (b.phase === 'active') {
      ctx.globalAlpha = 0.9;
      // Outer glow
      ctx.strokeStyle = '#ff00ff';
      ctx.lineWidth   = 24;
      ctx.shadowColor = '#cc00ff';
      ctx.shadowBlur  = 55;
      ctx.beginPath();
      ctx.moveTo(b.x, GAME_H);
      ctx.lineTo(b.x, 0);
      ctx.stroke();
      // Core beam
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth   = 8;
      ctx.shadowBlur  = 20;
      ctx.beginPath();
      ctx.moveTo(b.x, GAME_H);
      ctx.lineTo(b.x, 0);
      ctx.stroke();
    }
    ctx.restore();
  }
}

// ============================================================
// CINEMATIC OVERLAY — letterbox bars + vignette (drawn in screen space)
// ============================================================
function drawCinematicOverlay() {
  if (!activeCinematic) return;
  const cw = canvas.width, ch = canvas.height;
  const t  = activeCinematic.timer / 60;
  const totalSec  = activeCinematic.durationFrames / 60;
  const inAlpha   = Math.min(1, t / 0.3);
  const outAlpha  = Math.min(1, (totalSec - t) / 0.3);
  const barAlpha  = Math.min(inAlpha, outAlpha);

  // Letterbox bars
  const barH = Math.round(ch * 0.082);
  ctx.globalAlpha = barAlpha;
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0,         cw, barH);
  ctx.fillRect(0, ch - barH, cw, barH);

  // Edge vignette
  ctx.globalAlpha = barAlpha * 0.38;
  const vg = ctx.createLinearGradient(0, 0, cw, 0);
  vg.addColorStop(0,    'rgba(0,0,0,0.85)');
  vg.addColorStop(0.13, 'rgba(0,0,0,0)');
  vg.addColorStop(0.87, 'rgba(0,0,0,0)');
  vg.addColorStop(1,    'rgba(0,0,0,0.85)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, barH, cw, ch - barH * 2);

  // Phase label (if set by the cinematic sequence)
  const labelAlpha = Math.max(0,
    Math.min(1, (t - 0.9) / 0.25) * Math.min(1, (totalSec - t - 0.25) / 0.25));
  if (labelAlpha > 0 && activeCinematic._phaseLabel) {
    ctx.globalAlpha = labelAlpha;
    ctx.font        = `bold ${Math.round(ch * 0.042)}px Arial`;
    ctx.textAlign   = 'center';
    ctx.fillStyle   = activeCinematic._phaseLabel.color || '#ffffff';
    ctx.shadowColor = activeCinematic._phaseLabel.color || '#cc00ee';
    ctx.shadowBlur  = 30;
    ctx.fillText(activeCinematic._phaseLabel.text, cw / 2, ch / 2);
    ctx.shadowBlur  = 0;
  }
  // Screen flash (from CinFX.flash)
  if (cinScreenFlash && cinScreenFlash.timer > 0) {
    const fa = (cinScreenFlash.timer / cinScreenFlash.maxTimer) * cinScreenFlash.alpha;
    ctx.globalAlpha = Math.max(0, fa);
    ctx.fillStyle   = cinScreenFlash.color || '#ffffff';
    ctx.fillRect(0, 0, cw, ch);
    cinScreenFlash.timer--;
    if (cinScreenFlash.timer <= 0) cinScreenFlash = null;
  }

  ctx.globalAlpha = 1;
}

// ============================================================
// PHASE TRANSITION RINGS
// ============================================================
function drawPhaseTransitionRings() {
  for (let i = phaseTransitionRings.length - 1; i >= 0; i--) {
    const ring = phaseTransitionRings[i];
    ring.timer--;
    if (ring.timer <= 0) { phaseTransitionRings.splice(i, 1); continue; }
    const prog  = 1 - ring.timer / ring.maxTimer;
    const curR  = ring.r + prog * (ring.maxR - ring.r);
    const alpha = ring.timer < 20 ? ring.timer / 20 : 1 - prog * 0.55;
    ctx.save();
    ctx.globalAlpha = Math.max(0, alpha);
    ctx.strokeStyle = ring.color;
    ctx.lineWidth   = Math.max(0.5, (ring.lineWidth || 3) * (1 - prog * 0.7));
    ctx.shadowColor = ring.color;
    ctx.shadowBlur  = 16;
    ctx.beginPath();
    ctx.arc(ring.cx, ring.cy, Math.max(0.1, curR), 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

// ============================================================
// BOSS SPIKES
// ============================================================
function drawBossSpikes() {
  for (const sp of bossSpikes) {
    if (sp.done || sp.h <= 0) continue;
    const baseY = 460;
    const tipY  = baseY - sp.h;
    ctx.save();
    ctx.shadowColor = '#cc00ff';
    ctx.shadowBlur  = 12;
    // Spike body (tapered rectangle, 10px base → 2px tip)
    ctx.beginPath();
    ctx.moveTo(sp.x - 3,   baseY);
    ctx.lineTo(sp.x + 3,   baseY);
    ctx.lineTo(sp.x + 0.5, tipY);
    ctx.lineTo(sp.x - 0.5, tipY);
    ctx.closePath();
    ctx.fillStyle = '#aaaacc';
    ctx.fill();
    ctx.strokeStyle = '#cc00ff';
    ctx.lineWidth   = 1.5;
    ctx.stroke();
    ctx.restore();
  }
}

// ============================================================
// SPARTAN RAGE VISUALS  (Kratos class perk active)
// ============================================================
function drawAccessory(fighter, cx, headCY, shoulderY, hipY, facing, headR) {
  const hat  = fighter.hat  || 'none';
  const cape = fighter.cape || 'none';
  if (hat === 'none' && cape === 'none') return;
  ctx.save();

  // --- CAPE (draw behind body) ---
  if (cape !== 'none') {
    const capeX = cx - facing * 4;
    ctx.lineWidth = 1;
    if (cape === 'short') {
      ctx.fillStyle = 'rgba(180,20,20,0.8)';
      ctx.beginPath();
      ctx.moveTo(cx - 5, shoulderY);
      ctx.lineTo(cx + 5, shoulderY);
      ctx.lineTo(cx - facing * 14, hipY - 6);
      ctx.closePath(); ctx.fill();
    } else if (cape === 'long') {
      const capeGrad = ctx.createLinearGradient(capeX, shoulderY, capeX, hipY + 18);
      capeGrad.addColorStop(0, 'rgba(120,10,10,0.85)');
      capeGrad.addColorStop(1, 'rgba(80,5,5,0)');
      ctx.fillStyle = capeGrad;
      ctx.beginPath();
      ctx.moveTo(cx - 7, shoulderY);
      ctx.lineTo(cx + 7, shoulderY);
      ctx.lineTo(cx - facing * 18, hipY + 18);
      ctx.closePath(); ctx.fill();
    } else if (cape === 'royal') {
      ctx.fillStyle = 'rgba(160,10,10,0.9)';
      ctx.beginPath();
      ctx.moveTo(cx - 7, shoulderY);
      ctx.lineTo(cx + 7, shoulderY);
      ctx.lineTo(cx - facing * 18, hipY + 14);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#ffcc00'; ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx - 6, shoulderY + 2);
      ctx.lineTo(cx - facing * 16, hipY + 10);
      ctx.stroke();
    }
  }

  // --- HAT (draw above head) ---
  if (hat !== 'none') {
    ctx.fillStyle   = '#333';
    ctx.strokeStyle = '#222';
    ctx.lineWidth   = 1;
    const hatTop = headCY - headR;
    if (hat === 'cap') {
      ctx.fillStyle = '#444';
      ctx.beginPath();
      ctx.ellipse(cx, hatTop, headR + 1, 5, 0, Math.PI, 0);
      ctx.fill();
      ctx.fillRect(cx - headR - 1, hatTop - 7, headR * 2 + 2, 8);
      ctx.fillStyle = '#555';
      ctx.fillRect(cx + facing * headR, hatTop - 2, facing * 6, 4);
    } else if (hat === 'crown') {
      ctx.fillStyle = '#ffcc00';
      const bY = hatTop - 2;
      ctx.fillRect(cx - headR + 2, bY - 8, headR * 2 - 4, 8);
      ctx.beginPath();
      ctx.moveTo(cx - headR + 2, bY - 8);
      ctx.lineTo(cx - headR + 2 + 4, bY - 13);
      ctx.lineTo(cx, bY - 10);
      ctx.lineTo(cx + headR - 6, bY - 13);
      ctx.lineTo(cx + headR - 2, bY - 8);
      ctx.closePath(); ctx.fill();
    } else if (hat === 'wizard') {
      ctx.fillStyle = '#660099';
      ctx.beginPath();
      ctx.moveTo(cx - headR + 1, hatTop + 1);
      ctx.lineTo(cx + headR - 1, hatTop + 1);
      ctx.lineTo(cx + facing * 2, hatTop - 22);
      ctx.closePath(); ctx.fill();
      ctx.fillRect(cx - headR - 3, hatTop - 2, headR * 2 + 6, 5);
    } else if (hat === 'headband') {
      ctx.fillStyle = '#cc2200';
      ctx.fillRect(cx - headR, headCY - 4, headR * 2, 4);
    }
  }

  ctx.restore();
}

function drawCurseAuras() {
  const CURSE_COLORS = {
    curse_slow:    '#4488ff',
    curse_weak:    '#222244',
    curse_fragile: '#ff8800',
  };
  for (const p of players) {
    if (!p.curses || p.curses.length === 0 || p.health <= 0) continue;
    ctx.save();
    let ringOffset = 0;
    for (const curse of p.curses) {
      const col = CURSE_COLORS[curse.type];
      if (!col) continue;
      const pulse = 0.3 + Math.abs(Math.sin(frameCount * 0.08 + ringOffset)) * 0.5;
      ctx.globalAlpha = pulse;
      ctx.strokeStyle = col;
      ctx.lineWidth   = 2.5;
      ctx.shadowColor = col;
      ctx.shadowBlur  = 10;
      const r = 22 + ringOffset * 6;
      ctx.beginPath();
      ctx.arc(p.cx(), p.cy() - p.h * 0.1, r, 0, Math.PI * 2);
      ctx.stroke();
      ringOffset++;
    }
    ctx.restore();
  }
}

function drawSpartanRageEffects() {
  let anyRage = false;
  for (const p of players) {
    if (!(p.spartanRageTimer > 0)) continue;
    anyRage = true;
    const pct = Math.min(1, p.spartanRageTimer / 300);
    const pcx = p.cx(), pcy = p.cy();
    ctx.save();
    // Radial aura
    const grad = ctx.createRadialGradient(pcx, pcy, 0, pcx, pcy, 52 + Math.sin(frameCount * 0.12) * 6);
    grad.addColorStop(0,   `rgba(255,100,0,${0.32 * pct})`);
    grad.addColorStop(0.5, `rgba(255,60,0,${0.18 * pct})`);
    grad.addColorStop(1,   'rgba(255,30,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(pcx, pcy, 58, 0, Math.PI * 2);
    ctx.fill();
    // Pulsing outline ring
    ctx.strokeStyle = `rgba(255,140,0,${0.65 * pct})`;
    ctx.lineWidth   = 2.5;
    ctx.shadowColor = '#ff6600';
    ctx.shadowBlur  = 18;
    ctx.beginPath();
    ctx.arc(pcx, pcy, 34 + Math.sin(frameCount * 0.18) * 4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    // Floating ember particles every 3 frames
    if (frameCount % 3 === 0 && settings.particles && particles.length < MAX_PARTICLES) {
      const _ang = Math.random() * Math.PI * 2;
      const _r   = 16 + Math.random() * 24;
      const _p = _getParticle();
      _p.x = pcx + Math.cos(_ang) * _r; _p.y = pcy + Math.sin(_ang) * _r;
      _p.vx = (Math.random() - 0.5) * 1.8; _p.vy = -2.0 - Math.random() * 2.2;
      _p.color = Math.random() < 0.65 ? '#ff6600' : '#ff9900';
      _p.size = 1.6 + Math.random() * 2.2; _p.life = 28 + Math.random() * 22; _p.maxLife = 50;
      particles.push(_p);
    }
  }
  // Screen orange tint — only once regardless of how many have rage
  if (anyRage) {
    const _tintA = 0.055 + Math.sin(frameCount * 0.09) * 0.025;
    ctx.save();
    ctx.globalAlpha = _tintA;
    ctx.fillStyle   = '#ff5500';
    ctx.fillRect(0, 0, GAME_W, GAME_H);
    ctx.restore();
  }
}

// ============================================================
// CLASS VISUAL EFFECTS (Thor lightning arcs, Ninja shadow trail, etc.)
// ============================================================
function spawnLightningBolt(x, targetY) {
  // Build a jagged segmented path from top of screen down to target
  const segments = [];
  let cx = x + (Math.random() - 0.5) * 60;
  let cy = 0;
  const steps = 10 + Math.floor(Math.random() * 6);
  for (let i = 0; i <= steps; i++) {
    segments.push({ x: cx, y: cy });
    cy = targetY * (i / steps);
    cx = x + (Math.random() - 0.5) * 40 * (1 - i / steps);
  }
  segments.push({ x, y: targetY });
  lightningBolts.push({ x, y: targetY, timer: 18, segments });
}

function updateAndDrawLightningBolts() {
  for (let i = lightningBolts.length - 1; i >= 0; i--) {
    const bolt = lightningBolts[i];
    bolt.timer--;
    if (bolt.timer <= 0) { lightningBolts.splice(i, 1); continue; }
    const alpha = bolt.timer / 18;
    ctx.save();
    ctx.strokeStyle = `rgba(255,255,120,${alpha})`;
    ctx.lineWidth   = 2.5;
    ctx.shadowColor = '#ffff00';
    ctx.shadowBlur  = 12;
    ctx.beginPath();
    ctx.moveTo(bolt.segments[0].x, bolt.segments[0].y);
    for (let j = 1; j < bolt.segments.length; j++) {
      ctx.lineTo(bolt.segments[j].x, bolt.segments[j].y);
    }
    ctx.stroke();
    // Inner bright core
    ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.8})`;
    ctx.lineWidth   = 1;
    ctx.shadowBlur  = 4;
    ctx.beginPath();
    ctx.moveTo(bolt.segments[0].x, bolt.segments[0].y);
    for (let j = 1; j < bolt.segments.length; j++) {
      ctx.lineTo(bolt.segments[j].x, bolt.segments[j].y);
    }
    ctx.stroke();
    ctx.restore();
  }
}

const classTrails = []; // {x, y, color, alpha, size, life}

function drawClassEffects() {
  // Update + draw shadow trails
  for (let i = classTrails.length - 1; i >= 0; i--) {
    const t = classTrails[i];
    t.alpha -= 0.04;
    t.life--;
    if (t.life <= 0) { classTrails.splice(i, 1); continue; }
    ctx.save();
    ctx.globalAlpha = Math.max(0, t.alpha);
    ctx.fillStyle   = t.color;
    ctx.beginPath();
    ctx.roundRect(t.x, t.y, 22, 60, 4);
    ctx.fill();
    ctx.restore();
  }

  for (const p of players) {
    if (p.health <= 0 || p.backstageHiding) continue;

    // THOR: Periodic lightning arc toward target + electric sparks on body
    if (p.charClass === 'thor') {
      // Ambient crackling particles
      if (frameCount % 8 === 0 && settings.particles && particles.length < MAX_PARTICLES) {
        const a = Math.random() * Math.PI * 2;
        const _p = _getParticle();
        _p.x = p.cx() + Math.cos(a) * 14; _p.y = p.cy() + Math.sin(a) * 14;
        _p.vx = (Math.random()-0.5)*2; _p.vy = -1.5 - Math.random()*1.5;
        _p.color = Math.random() < 0.6 ? '#ffff44' : '#aaddff';
        _p.size = 1.5 + Math.random()*2; _p.life = 14 + Math.random()*10; _p.maxLife = 24;
        particles.push(_p);
      }
      // Lightning arc toward target every 55 frames
      if (p.target && p.target.health > 0 && frameCount % 55 === 0) {
        const tx = p.target.cx(), ty = p.target.cy();
        const sx2 = p.cx(), sy2 = p.cy();
        const steps = 7;
        for (let si = 0; si < steps && particles.length < MAX_PARTICLES; si++) {
          const prog = si / steps;
          const jx   = sx2 + (tx - sx2) * prog + (Math.random()-0.5)*30;
          const jy   = sy2 + (ty - sy2) * prog + (Math.random()-0.5)*20;
          const _p = _getParticle();
          _p.x = jx; _p.y = jy; _p.vx = 0; _p.vy = 0;
          _p.color = '#ffffaa'; _p.size = 2.5; _p.life = 8; _p.maxLife = 8;
          particles.push(_p);
        }
      }
    }

    // NINJA: Shadow trail during fast movement
    if (p.charClass === 'ninja' && Math.abs(p.vx) > 5 && frameCount % 4 === 0) {
      classTrails.push({ x: p.x, y: p.y, color: 'rgba(0,200,80,0.45)', alpha: 0.45, size: 1, life: 14 });
    }

    // KRATOS: Ember sparks when in Spartan Rage (already handled by drawSpartanRageEffects)
    // Extra hit flash crackle when rage is active and hit
    if (p.charClass === 'kratos' && p.spartanRageTimer > 0 && p.hurtTimer > 0) {
      if (settings.particles) {
        for (let k = 0; k < 3 && particles.length < MAX_PARTICLES; k++) {
          const _p = _getParticle();
          _p.x = p.cx() + (Math.random()-0.5)*20; _p.y = p.cy() + (Math.random()-0.5)*20;
          _p.vx = (Math.random()-0.5)*4; _p.vy = -2-Math.random()*3;
          _p.color = '#ff8800'; _p.size = 2+Math.random()*2; _p.life = 12; _p.maxLife = 12;
          particles.push(_p);
        }
      }
    }

    // GUNNER: Muzzle flash lingering glow on weapon arm (cosmetic)
    if (p.charClass === 'gunner' && p.attackTimer > 0 && p.attackTimer === p.attackDuration) {
      if (settings.particles) {
        spawnParticles(p.cx() + p.facing * 28, p.y + 22, '#ffdd00', 5);
      }
    }
  }
}

