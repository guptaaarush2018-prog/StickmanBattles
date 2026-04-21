'use strict';
// smb-boss-tf-visuals1.js — Phase shift, reality tear, calc strike, math bubble, reality override, gamma beam
// Depends on: smb-globals.js, smb-particles-core.js, smb-boss-tf-attacks2.js
// Must load AFTER smb-boss-tf-attacks2.js, BEFORE smb-boss-tf-visuals2.js

// ============================================================
// DRAW: Boss warnings (telegraph zones) + safe zones + desperation
// ============================================================
function drawBossWarnings() {
  if (!bossWarnings.length && !bossMetSafeZones.length && !bossDesperationFlash) return;
  ctx.save();

  // ── Desperation screen pulse ───────────────────────────────
  if (bossDesperationFlash > 0) {
    const alpha = (bossDesperationFlash / 90) * 0.35;
    ctx.fillStyle = `rgba(255,0,0,${alpha})`;
    ctx.fillRect(0, 0, GAME_W, GAME_H);
  }
  // Subtle desperation aura — red border pulse when active
  if (bossDesperationMode) {
    const pulse = 0.12 + Math.abs(Math.sin(frameCount * 0.07)) * 0.10;
    ctx.strokeStyle = `rgba(255,30,0,${pulse})`;
    ctx.lineWidth   = 8;
    ctx.strokeRect(4, 4, GAME_W - 8, GAME_H - 8);
  }
  // TrueForm desperation aura — dark void border when active
  const tfDesp = players.find(p => p.isTrueForm && p._desperationMode);
  if (tfDesp) {
    const pulse2 = 0.10 + Math.abs(Math.sin(frameCount * 0.09)) * 0.12;
    ctx.strokeStyle = `rgba(0,0,0,${pulse2 + 0.4})`;
    ctx.lineWidth   = 10;
    ctx.strokeRect(5, 5, GAME_W - 10, GAME_H - 10);
    ctx.strokeStyle = `rgba(160,0,255,${pulse2})`;
    ctx.lineWidth   = 4;
    ctx.strokeRect(5, 5, GAME_W - 10, GAME_H - 10);
  }
  const tfAnti = getTrueFormAntiRangedBoss();
  if (tfAnti) {
    const antiPulse = 0.18 + Math.abs(Math.sin(frameCount * 0.11)) * 0.16;
    const antiR = tfAnti._antiRangedFieldR || 220;
    ctx.save();
    ctx.strokeStyle = `rgba(136,68,255,${antiPulse})`;
    ctx.lineWidth = 3;
    ctx.shadowColor = '#8844ff';
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.arc(tfAnti.cx(), tfAnti.cy(), antiR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = `rgba(255,255,255,${antiPulse * 0.8})`;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([8, 10]);
    ctx.beginPath();
    ctx.arc(tfAnti.cx(), tfAnti.cy(), antiR + 18 + Math.sin(frameCount * 0.15) * 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // ── Safe zones ─────────────────────────────────────────────
  for (const sz of bossMetSafeZones) {
    const prog  = sz.timer / sz.maxTimer;
    const alpha = 0.18 + Math.sin(frameCount * 0.12) * 0.07;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle   = '#00ff88';
    ctx.beginPath(); ctx.arc(sz.x, sz.y, sz.r, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 0.7;
    ctx.strokeStyle = '#00ffcc';
    ctx.lineWidth   = 2.5;
    ctx.shadowColor = '#00ff88';
    ctx.shadowBlur  = 10;
    ctx.beginPath(); ctx.arc(sz.x, sz.y, sz.r, 0, Math.PI * 2); ctx.stroke();
    // Label
    ctx.globalAlpha = 0.85;
    ctx.fillStyle   = '#00ffcc';
    ctx.font        = 'bold 11px monospace';
    ctx.textAlign   = 'center';
    ctx.fillText('SAFE', sz.x, sz.y + 4);
    ctx.restore();
  }

  // ── Attack warning shapes ──────────────────────────────────
  for (const w of bossWarnings) {
    const prog  = w.timer / w.maxTimer;          // 1 → 0 as attack approaches
    const blink = Math.floor(w.timer / 4) % 2;  // fast blink when almost expired
    const alpha = (prog > 0.25 ? 0.25 + (1 - prog) * 0.35 : 0.55 + (blink ? 0.3 : 0)) * (prog < 0.15 ? prog / 0.15 : 1);

    ctx.save();
    ctx.globalAlpha = Math.min(0.85, Math.max(0.05, alpha));

    if (w.type === 'circle') {
      // Filled danger zone
      const hex = w.safeZone ? '#00ff88' : w.color;
      ctx.fillStyle   = hex + '33';
      ctx.strokeStyle = hex;
      ctx.lineWidth   = 2;
      ctx.shadowColor = hex;
      ctx.shadowBlur  = 12;
      ctx.beginPath(); ctx.arc(w.x, w.y, w.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else if (w.type === 'cross') {
      // X marker at target location
      ctx.strokeStyle = w.color;
      ctx.lineWidth   = 3;
      ctx.shadowColor = w.color;
      ctx.shadowBlur  = 8;
      const s = w.r;
      ctx.beginPath();
      ctx.moveTo(w.x - s, w.y - s); ctx.lineTo(w.x + s, w.y + s);
      ctx.moveTo(w.x + s, w.y - s); ctx.lineTo(w.x - s, w.y + s);
      ctx.stroke();
    } else if (w.type === 'spike_warn') {
      // Glowing dot on floor before spike rises
      ctx.fillStyle   = w.color;
      ctx.shadowColor = w.color;
      ctx.shadowBlur  = 14;
      ctx.beginPath(); ctx.arc(w.x, w.y, w.r * (1 - prog * 0.5), 0, Math.PI * 2);
      ctx.fill();
    }

    // Label text
    if (w.label && prog < 0.7) {
      ctx.globalAlpha = Math.min(0.9, (0.7 - prog) / 0.7 * 0.9);
      ctx.fillStyle   = w.color;
      ctx.shadowColor = w.color;
      ctx.shadowBlur  = 6;
      ctx.font        = 'bold 12px monospace';
      ctx.textAlign   = 'center';
      ctx.fillText(w.label, w.x, w.y - w.r - 6);
    }

    ctx.restore();
  }

  ctx.restore();
}

function resetBossWarnings() {
  bossWarnings        = [];
  bossMetSafeZones    = [];
  bossStaggerTimer    = 0;
  bossStaggerDmg      = 0;
  bossStaggerDecay    = 0;
  bossDesperationMode  = false;
  bossDesperationFlash = 0;
  if (activeCinematic) endCinematic();
  slowMotion           = 1.0;
  cinematicCamOverride = false;
  cinGroundCracks      = [];
  cinScreenFlash       = null;
}

// ── PHASE SHIFT update + draw ────────────────────────────────────────────
function updateTFPhaseShift() {
  if (!tfPhaseShift) return;
  const ps = tfPhaseShift;
  ps.timer++;

  // Apply drift to fake echo positions each frame (real echo stays still)
  for (let i = 0; i < ps.echoes.length; i++) {
    if (i === ps.realIdx) continue;
    const e = ps.echoes[i];
    if (e.driftVx !== undefined) {
      e.x = clamp(e.x + e.driftVx, 60, GAME_W - 60);
      e.y = clamp(e.y + e.driftVy, 60, GAME_H - 60);
      // Slow down drift over time
      e.driftVx *= 0.97;
      e.driftVy *= 0.97;
    }
  }

  // At the reveal frame, snap boss to the real echo position and attack
  if (!ps.revealed && ps.timer === 45) {
    ps.revealed = true;
    const tf = players.find(p => p.isTrueForm);
    if (tf) {
      const echo = ps.echoes[ps.realIdx];
      const landed = _bossTeleportActor(tf, echo.x, echo.y, { preferRaised: true });
      if (!landed) {
        tfPhaseShift = null;
        tf._finishAttackState && tf._finishAttackState('phaseShift');
        return;
      }
      tf._setAttackPhase && tf._setAttackPhase('active', 4, true);
      screenShake = Math.max(screenShake, 16);
      spawnParticles(tf.cx(), tf.cy(), '#ffffff', 18);
      spawnParticles(tf.cx(), tf.cy(), '#9900ff', 14);
      // Immediately attack the nearest player
      const target = players.find(p => !p.isBoss && p.health > 0);
      if (target && tf.cooldown <= 0) tf.attack(target);
    }
  }

  if (ps.timer >= ps.maxTimer) {
    if (ps.bossRef && ps.bossRef._setAttackPhase) ps.bossRef._setAttackPhase('recovery', 20, false);
    tfPhaseShift = null;
  }
}

function drawTFPhaseShift() {
  if (!tfPhaseShift) return;
  const ps = tfPhaseShift;
  const progress = ps.timer / ps.maxTimer;
  const tf = players.find(p => p.isTrueForm);

  // Draw echoes (false positions)
  for (let i = 0; i < ps.echoes.length; i++) {
    const e = ps.echoes[i];
    const isReal = i === ps.realIdx;
    // Fade echoes out after reveal; fake ones vanish faster
    let alpha;
    if (!ps.revealed) {
      alpha = Math.min(1, ps.timer / 12) * (isReal ? 0.55 : 0.40);
    } else {
      alpha = isReal ? 0 : Math.max(0, 1 - (ps.timer - 45) / 12) * 0.35;
    }
    if (alpha <= 0.01) continue;
    ctx.save();
    ctx.globalAlpha = alpha;
    _drawTimelineStickman(e.x, e.y - 18, isReal ? 1 : -1, isReal ? '#ff88ff' : '#aa66ff', isReal ? 2.6 : 2.0, isReal ? 20 : 10, alpha);
    ctx.strokeStyle  = isReal ? '#ffffff' : '#aa00ff';
    ctx.lineWidth    = isReal ? 2 : 1.3;
    ctx.beginPath();
    ctx.arc(e.x, e.y + 12, isReal ? 24 : 18, 0, Math.PI * 2);
    ctx.stroke();
    // Small '?' label on fakes
    if (!isReal && !ps.revealed) {
      ctx.globalAlpha = alpha * 0.8;
      ctx.fillStyle   = '#cc88ff';
      ctx.font        = 'bold 11px monospace';
      ctx.textAlign   = 'center';
      ctx.fillText('?', e.x, e.y - 28);
    }
    ctx.restore();
  }

  // Make the real boss semi-transparent while shifting
  if (tf && !ps.revealed) {
    // The boss draw() call handles normal rendering; we just overlay a ghosting effect
    ctx.save();
    ctx.globalAlpha = 0.25 + Math.sin(ps.timer * 0.4) * 0.1;
    ctx.strokeStyle = '#9900ff';
    ctx.lineWidth   = 1.5;
    ctx.setLineDash([4, 4]);
    _drawTimelineStickman(tf.cx(), tf.y - 5, tf.facing || 1, '#9900ff', 1.8, 10, 0.45);
    ctx.restore();
  }
}

// ── REALITY TEAR update + draw ────────────────────────────────────────────
function updateTFRealityTear() {
  if (!tfRealityTear) return;
  const rt = tfRealityTear;
  rt.timer++;

  // Phase transitions
  if (rt.phase === 'warn'   && rt.timer >= 20) rt.phase = 'active';
  if (rt.phase === 'active' && rt.timer >= 70) {
    rt.phase = 'close';
    // Chain follow-up: boss teleports behind player and combo-attacks
    if (rt.bossRef && !rt._followUpFired) {
      rt._followUpFired = true;
      const tf  = rt.bossRef;
      const tgt = (rt.targetRef && rt.targetRef.health > 0)
        ? rt.targetRef
        : players.find(p => !p.isBoss && p.health > 0);
      if (tf && tgt) {
        // Teleport behind the pulled player
        const behindDir = tgt.facing || (tgt.cx() > GAME_W / 2 ? 1 : -1);
        const landed = _bossTeleportActor(tf, tgt.cx() - behindDir * 55, tgt.y, { preferRaised: true, sideBias: -behindDir });
        if (!landed) {
          tf._finishAttackState && tf._finishAttackState('realityTear');
          return;
        }
        tf._setAttackPhase && tf._setAttackPhase('active', 4, true);
        tf.invincible = Math.max(tf.invincible || 0, 12);
        screenShake   = Math.max(screenShake, 12);
        spawnParticles(tf.cx(), tf.cy(), '#cc00ff', 14);
        spawnParticles(tf.cx(), tf.cy(), '#ffffff', 8);
        // Immediate combo: two quick hits
        if (tf.cooldown <= 0) tf.attack(tgt);
        if (typeof tf._pendingChainMove !== 'undefined' && !tf._pendingChainMove) {
          tf._pendingChainMove = { move: 'slash', delay: 12 };
        }
      }
    }
  }
  if (rt.phase === 'close'  && rt.timer >= rt.maxTimer) {
    if (rt.bossRef && rt.bossRef._setAttackPhase) rt.bossRef._setAttackPhase('recovery', 20, false);
    tfRealityTear = null;
    return;
  }

  // Active phase: pull all non-boss players toward the tear
  if (rt.phase === 'active') {
    const pullStr = 1.8;
    for (const p of players) {
      if (p.isBoss || p.health <= 0) continue;
      const dx = rt.x - p.cx();
      const dy = rt.y - p.cy();
      const dd = Math.hypot(dx, dy);
      if (dd < 320 && dd > 1) {
        const force = pullStr * (1 - dd / 320);
        p.vx += (dx / dd) * force;
        p.vy += (dy / dd) * force * 0.7;
      }
    }
  }
}

function drawTFRealityTear() {
  if (!tfRealityTear) return;
  const rt = tfRealityTear;
  const progress = rt.timer / rt.maxTimer;

  let alpha;
  if (rt.phase === 'warn')   alpha = Math.min(1, rt.timer / 20);
  else if (rt.phase === 'active') alpha = 1.0;
  else alpha = Math.max(0, 1 - (rt.timer - 70) / 20);
  if (alpha <= 0) return;

  const height = rt.phase === 'warn'
    ? 40 * (rt.timer / 20)
    : rt.phase === 'active'
      ? 40 + 60 * Math.min(1, (rt.timer - 20) / 15)
      : 100 * alpha;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(rt.x, rt.y);

  // Outer glow
  const grd = ctx.createRadialGradient(0, 0, 2, 0, 0, 70);
  grd.addColorStop(0,   'rgba(180,0,255,0.35)');
  grd.addColorStop(1,   'rgba(80,0,180,0)');
  ctx.fillStyle = grd;
  ctx.beginPath(); ctx.ellipse(0, 0, 70, height * 0.6, 0, 0, Math.PI * 2); ctx.fill();

  // The crack itself — jagged vertical line
  ctx.strokeStyle  = '#ffffff';
  ctx.lineWidth    = 2.5;
  ctx.shadowColor  = '#cc00ff';
  ctx.shadowBlur   = 12;
  ctx.beginPath();
  const segs = 8;
  ctx.moveTo(0, -height / 2);
  for (let i = 1; i <= segs; i++) {
    const fy = -height / 2 + (height / segs) * i;
    const jag = rt.phase === 'active' ? (Math.random() - 0.5) * 14 : (Math.random() - 0.5) * 6;
    ctx.lineTo(jag, fy);
  }
  ctx.stroke();

  // Inner black void core
  ctx.fillStyle   = '#000000';
  ctx.shadowBlur  = 0;
  ctx.beginPath(); ctx.ellipse(0, 0, 6, height * 0.45, 0, 0, Math.PI * 2); ctx.fill();

  ctx.restore();
}

// ── MATH BUBBLE + CALCULATED STRIKE update + draw ─────────────────────────
function updateTFCalcStrike() {
  if (tfMathBubble) {
    tfMathBubble.timer++;
    if (tfMathBubble.timer >= tfMathBubble.maxTimer) tfMathBubble = null;
  }
  // Tick ghost paths
  if (tfGhostPaths) {
    tfGhostPaths.timer++;
    if (tfGhostPaths.timer >= tfGhostPaths.maxTimer) tfGhostPaths = null;
  }
  if (!tfCalcStrike) return;
  const cs = tfCalcStrike;
  cs.timer++;

  const strikeFrame = cs.strikeDelay || 42;
  if (!cs.fired && cs.timer >= strikeFrame) {
    cs.fired = true;
    tfGhostPaths = null; // clear path visualization on strike
    const tf = players.find(p => p.isTrueForm);
    const target = cs.targetRef && cs.targetRef.health > 0 ? cs.targetRef : players.find(p => !p.isBoss && p.health > 0);
    if (tf) {
      const desiredX = target ? target.cx() - tf.w / 2 : cs.predictX;
      const desiredY = target ? target.y : cs.predictY;
      const landed = _bossTeleportActor(tf, desiredX, desiredY, { preferRaised: true, sideBias: tf.facing || 1 });
      if (!landed) {
        tfCalcStrike = null;
        tf._finishAttackState && tf._finishAttackState('calcStrike');
        return;
      }
      tf._setAttackPhase && tf._setAttackPhase('active', 4, true);
      tf.facing = target ? (target.cx() > tf.cx() ? 1 : -1) : tf.facing;
      screenShake = Math.max(screenShake, 14);
      spawnParticles(tf.cx(), tf.cy(), '#ffffff', 16);
      spawnParticles(tf.cx(), tf.cy(), '#aaddff', 10);
      if (target) {
        if (target.shielding) {
          target.shieldCooldown = Math.max(target.shieldCooldown || 0, typeof SHIELD_CD !== 'undefined' ? Math.round(SHIELD_CD * 0.55) : 180);
          target.hurtTimer = Math.max(target.hurtTimer || 0, 10);
          target.vx += tf.facing * 7;
          screenShake = Math.max(screenShake, 8);
          spawnParticles(target.cx(), target.cy(), '#88ccff', 12);
        } else {
          // Calc-strike: deliver impact — do NOT strip prior invincibility.
          // hitInvincibleFrames=0 lets the strike land if the player has no active iframes,
          // but respawn protection and finisher locks are now respected.
          dealDamage(tf, target, 34, 16, 1.2, false, 0);
          target.stunTimer = Math.max(target.stunTimer || 0, 14);
          target.vx += tf.facing * 10;
          target.vy = Math.min(target.vy, -10);
        }
      }
    }
  }
  if (cs.timer >= cs.maxTimer) {
    const tf = players.find(p => p.isTrueForm);
    if (tf && tf._setAttackPhase) tf._setAttackPhase('recovery', 20, false);
    tfCalcStrike = null;
  }
}

function drawTFCalcStrike() {
  // Draw 5D ghost paths while calculating (before strike fires)
  if (tfGhostPaths) {
    const gp = tfGhostPaths;
    const gFade = gp.timer < 8 ? gp.timer / 8 : gp.timer > gp.maxTimer - 8 ? (gp.maxTimer - gp.timer) / 8 : 1.0;
    if (gFade > 0.01) {
      for (const path of gp.paths) {
        if (path.pts.length < 2) continue;
        ctx.save();
        ctx.globalAlpha = path.alpha * gFade;
        ctx.strokeStyle  = path.selected ? '#aaddff' : '#6633aa';
        ctx.lineWidth    = path.selected ? 2.0 : 1.0;
        ctx.setLineDash(path.selected ? [] : [4, 5]);
        ctx.shadowColor  = path.selected ? '#aaddff' : 'transparent';
        ctx.shadowBlur   = path.selected ? 8 : 0;
        ctx.beginPath();
        ctx.moveTo(path.pts[0].x, path.pts[0].y);
        ctx.lineTo(path.pts[1].x, path.pts[1].y);
        ctx.stroke();
        // Arrow head on selected path
        if (path.selected) {
          const dx = path.pts[1].x - path.pts[0].x;
          const dy = path.pts[1].y - path.pts[0].y;
          const len = Math.hypot(dx, dy) || 1;
          const angle = Math.atan2(dy, dx);
          ctx.beginPath();
          ctx.moveTo(path.pts[1].x, path.pts[1].y);
          ctx.lineTo(path.pts[1].x - 10 * Math.cos(angle - 0.45), path.pts[1].y - 10 * Math.sin(angle - 0.45));
          ctx.lineTo(path.pts[1].x - 10 * Math.cos(angle + 0.45), path.pts[1].y - 10 * Math.sin(angle + 0.45));
          ctx.closePath();
          ctx.fillStyle = '#aaddff';
          ctx.fill();
        }
        ctx.restore();
      }
    }
  }
  // Brief crosshair flash at strike landing point (right after teleport fires)
  if (tfCalcStrike && tfCalcStrike.fired) {
    const cs = tfCalcStrike;
    const strikeFrame = cs.strikeDelay || 42;
    const postFire = cs.timer - strikeFrame;
    if (postFire < 12) {
      const flashAlpha = 1 - postFire / 12;
      ctx.save();
      ctx.globalAlpha  = flashAlpha * 0.8;
      ctx.strokeStyle  = '#aaddff';
      ctx.lineWidth    = 2;
      ctx.shadowColor  = '#ffffff';
      ctx.shadowBlur   = 10;
      const cx_ = cs.predictX, cy_ = cs.predictY;
      const sz  = 14;
      ctx.beginPath();
      ctx.moveTo(cx_ - sz, cy_); ctx.lineTo(cx_ + sz, cy_);
      ctx.moveTo(cx_, cy_ - sz); ctx.lineTo(cx_, cy_ + sz);
      ctx.stroke();
      ctx.restore();
    }
  }
}

function drawTFMathBubble() {
  if (!tfMathBubble) return;
  const mb   = tfMathBubble;
  const fade = mb.timer < 8
    ? mb.timer / 8
    : mb.timer > mb.maxTimer - 10
      ? (mb.maxTimer - mb.timer) / 10
      : 1.0;
  if (fade <= 0) return;

  ctx.save();
  ctx.globalAlpha = fade;
  const bx = mb.x;
  const by = mb.y - 28;
  const pad = 8;
  ctx.font = 'bold 13px monospace';
  const tw  = ctx.measureText(mb.text).width;
  const bw  = tw + pad * 2;
  const bh  = 22;

  // Bubble background
  ctx.fillStyle   = 'rgba(240,240,255,0.92)';
  ctx.strokeStyle = '#9900cc';
  ctx.lineWidth   = 1.5;
  ctx.beginPath();
  ctx.roundRect(bx - bw / 2, by - bh / 2, bw, bh, 5);
  ctx.fill(); ctx.stroke();

  // Tail
  ctx.fillStyle = 'rgba(240,240,255,0.92)';
  ctx.beginPath();
  ctx.moveTo(bx - 5, by + bh / 2);
  ctx.lineTo(bx + 5, by + bh / 2);
  ctx.lineTo(bx,     by + bh / 2 + 8);
  ctx.closePath(); ctx.fill(); ctx.stroke();

  // Text
  ctx.fillStyle   = '#220044';
  ctx.textAlign   = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(mb.text, bx, by);

  ctx.restore();
}

// ── REALITY OVERRIDE update + draw ───────────────────────────────────────────
function updateTFRealityOverride() {
  if (!tfRealityOverride) return;
  const ro = tfRealityOverride;
  ro.timer++;

  // Phase: freeze (0-16f) — hitstop visual, player pulled toward boss
  if (ro.phase === 'freeze' && ro.timer === 16) {
    ro.phase = 'execute';
    const tf  = ro.bossRef;
    const tgt = (ro.targetRef && ro.targetRef.health > 0)
      ? ro.targetRef : players.find(p => !p.isBoss && p.health > 0);
    if (tf && tgt) {
      // Teleport player to 75px in front of boss
      const pullDir = tf.facing || 1;
      tgt.x  = clamp(tf.cx() + pullDir * 75 - tgt.w / 2, 20, GAME_W - tgt.w - 20);
      tgt.y  = tf.y;
      tgt.vx = 0; tgt.vy = 0;
      screenShake = Math.max(screenShake, 20);
      spawnParticles(tgt.cx(), tgt.cy(), '#ffffff', 20);
    }
  }

  // Phase: execute (16-60f) — boss attacks every 14 frames; player can still dodge
  if (ro.phase === 'execute') {
    const tf  = ro.bossRef;
    const tgt = (ro.targetRef && ro.targetRef.health > 0)
      ? ro.targetRef : players.find(p => !p.isBoss && p.health > 0);
    if (tf && tgt && ro.timer >= 16 && (ro.timer - 16) % 14 === 0 && ro.attacksFired < 3) {
      ro.attacksFired++;
      if (tf.cooldown <= 0) tf.attack(tgt);
    }
  }

  if (ro.timer >= ro.maxTimer) tfRealityOverride = null;
}

function drawTFRealityOverride() {
  if (!tfRealityOverride) return;
  const ro = tfRealityOverride;

  // Freeze phase: dark overlay + white vignette border
  if (ro.phase === 'freeze') {
    const p = Math.min(1, ro.timer / 16);
    ctx.save();
    ctx.fillStyle = `rgba(0,0,0,${0.55 * p})`;
    ctx.fillRect(0, 0, GAME_W, GAME_H);
    ctx.strokeStyle = `rgba(255,255,255,${0.7 * p})`;
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, GAME_W - 6, GAME_H - 6);
    // "OVERRIDE" text
    ctx.globalAlpha = p;
    ctx.fillStyle   = '#ffffff';
    ctx.font        = 'bold 22px monospace';
    ctx.textAlign   = 'center';
    ctx.fillText('— OVERRIDE —', GAME_W / 2, GAME_H / 2);
    ctx.restore();
  }

  // Execute phase: subtle dark tint that fades out
  if (ro.phase === 'execute') {
    const fadeP = 1 - Math.min(1, (ro.timer - 16) / 44);
    if (fadeP > 0.01) {
      ctx.save();
      ctx.fillStyle = `rgba(0,0,0,${0.30 * fadeP})`;
      ctx.fillRect(0, 0, GAME_W, GAME_H);
      ctx.restore();
    }
  }
}
function updateTFGammaBeam() {
  if (!tfGammaBeam) return;
  const gb = tfGammaBeam;
  gb.timer++;
  // Fall back to bossRef stored at fire-time so admin-kit (proxy) attacks work
  const boss = gb.bossRef || players.find(p => p.isTrueForm);

  if (gb.phase === 'charge') {
    // Continuously track player Y during charge window (locks at end)
    const tgt = players.find(p => !p.isBoss && !p.isTrueForm && p.health > 0);
    if (tgt) gb.trackY = clamp(tgt.y + tgt.h * 0.45, 120, 440);
    if (gb.timer >= gb.maxTimer) {
      gb.y = gb.trackY || GAME_H / 2;
      gb.phase = 'telegraph';
      gb.timer = 0; gb.maxTimer = 34;
      bossWarnings.push({ type: 'circle', x: GAME_W / 2, y: gb.y, r: 14,
        color: '#ffff00', timer: 32, maxTimer: 32, label: 'GAMMA BEAM — JUMP!' });
      screenShake = Math.max(screenShake, 16);
    }

  } else if (gb.phase === 'telegraph') {
    if (gb.timer >= gb.maxTimer) {
      gb.phase = 'active';
      gb.timer = 0; gb.maxTimer = 45;
      hitStopFrames = Math.max(hitStopFrames, 10);
      screenShake   = Math.max(screenShake, 26);
    }

  } else if (gb.phase === 'active') {
    for (const p of players) {
      if (((p.isBoss || p.isTrueForm) && !(gb.bossRef && gb.bossRef.isProxy)) || p.health <= 0) continue;
      const py = p.y + p.h * 0.5;
      if (Math.abs(py - gb.y) < 24 && p.invincible <= 0 && !gb.hit.has(p)) {
        gb.hit.add(p);
        dealDamage(boss || players[1], p, 24, 14);
        spawnParticles(p.cx(), p.cy(), '#ffff00', 14);
        spawnParticles(p.cx(), p.cy(), '#ffffff',  8);
        hitStopFrames = Math.max(hitStopFrames, 7); // per-hit hitstop
        p.invincible = Math.max(p.invincible, 20);
      }
    }
    if (gb.timer >= gb.maxTimer) {
      // Chain: 30% chance to immediately follow with neutron star
      if (boss && Math.random() < 0.30 && boss._chainCd <= 0) {
        const chainTgt = players.find(p => !p.isBoss && !p.isTrueForm && p.health > 0);
        if (chainTgt && !tfNeutronStar) {
          boss._chainCd = 36;
          setTimeout(() => {
            if (!gameRunning || !boss) return;
            boss._doSpecial('neutronStar', chainTgt);
          }, 700);
        }
      }
      // Spawn burn trail aftermath
      tfBurnTrail = { y: gb.y, timer: 0, maxTimer: 70 };
      tfGammaBeam = null;
    }
  }
}

function drawTFGammaBeam() {
  if (!tfGammaBeam) return;
  const gb = tfGammaBeam;
  ctx.save();

  if (gb.phase === 'charge') {
    const prog = gb.timer / gb.maxTimer;
    const trackY = gb.trackY || GAME_H / 2;
    // Screen dim — subtle, grows
    ctx.globalAlpha = prog * 0.20;
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, GAME_W, GAME_H);
    // Tracking hairline follows player Y
    ctx.globalAlpha = 0.12 + prog * 0.38;
    ctx.strokeStyle = '#ffff88';
    ctx.lineWidth = 1 + prog * 2;
    ctx.shadowColor = '#ffff00';
    ctx.shadowBlur  = 6 + prog * 14;
    ctx.setLineDash([4, 9]);
    ctx.beginPath(); ctx.moveTo(0, trackY); ctx.lineTo(GAME_W, trackY); ctx.stroke();
    ctx.setLineDash([]);
    // Boss charge orb
    const orbR = 8 + prog * 20;
    ctx.globalAlpha = 0.28 + prog * 0.55;
    const orbGrad = ctx.createRadialGradient(gb.chargeX, gb.chargeY, 0, gb.chargeX, gb.chargeY, orbR);
    orbGrad.addColorStop(0,   `rgba(255,255,200,${0.9})`);
    orbGrad.addColorStop(0.5, `rgba(255,220,0,${0.65})`);
    orbGrad.addColorStop(1,   'rgba(255,200,0,0)');
    ctx.fillStyle = orbGrad;
    ctx.shadowColor = '#ffff44'; ctx.shadowBlur = 20;
    ctx.beginPath(); ctx.arc(gb.chargeX, gb.chargeY, orbR, 0, Math.PI * 2); ctx.fill();

  } else if (gb.phase === 'telegraph') {
    const prog = gb.timer / gb.maxTimer;
    // Heavier screen dim — danger is near
    ctx.globalAlpha = 0.24 + prog * 0.10;
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, GAME_W, GAME_H);
    // Locked beam — flashing
    const blink = Math.floor(gb.timer / 4) % 2 === 0;
    ctx.globalAlpha = blink ? 0.92 : 0.52;
    ctx.strokeStyle = '#ffff22';
    ctx.lineWidth   = 3 + prog * 5;
    ctx.shadowColor = '#ffff00';
    ctx.shadowBlur  = 18 + prog * 20;
    ctx.beginPath(); ctx.moveTo(0, gb.y); ctx.lineTo(GAME_W, gb.y); ctx.stroke();
    // Pulsing edge arrows
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = '#ffff44';
    ctx.font = `bold ${12 + Math.floor(prog * 4)}px monospace`;
    ctx.fillText('▶ ▶ ▶', 8, gb.y - 6);
    ctx.fillText('◀ ◀ ◀', GAME_W - 72, gb.y - 6);

  } else if (gb.phase === 'active') {
    const fade = 1 - gb.timer / gb.maxTimer;
    // Full-screen white flash on fire
    if (gb.timer <= 4) {
      ctx.globalAlpha = (0.85 - gb.timer * 0.18);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, GAME_W, GAME_H);
    }
    // Core beam — solid white bar
    ctx.globalAlpha = 0.96 * fade;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, gb.y - 14, GAME_W, 28);
    // Wide glow envelope
    const grad = ctx.createLinearGradient(0, gb.y - 45, 0, gb.y + 45);
    grad.addColorStop(0,   'rgba(255,255,0,0)');
    grad.addColorStop(0.30, `rgba(255,220,0,${0.55 * fade})`);
    grad.addColorStop(0.50, `rgba(255,255,255,${0.95 * fade})`);
    grad.addColorStop(0.70, `rgba(255,220,0,${0.55 * fade})`);
    grad.addColorStop(1,   'rgba(255,255,0,0)');
    ctx.globalAlpha = 1;
    ctx.fillStyle = grad;
    ctx.fillRect(0, gb.y - 45, GAME_W, 90);
    // Periodic flare pops along beam
    if (gb.timer % 7 === 0) {
      ctx.globalAlpha = fade * 0.65;
      ctx.fillStyle = '#ffffaa';
      ctx.shadowColor = '#ffff00'; ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.arc(30 + Math.random() * (GAME_W - 60), gb.y, 10 + Math.random() * 14, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

// ── GAMMA RAY BURN TRAIL ───────────────────────────────────────────────────────
