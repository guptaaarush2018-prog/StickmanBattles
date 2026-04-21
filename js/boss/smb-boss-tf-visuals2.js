'use strict';
// smb-boss-tf-visuals2.js — Burn trail, neutron star, galaxy sweep, multiverse fracture, supernova
// Depends on: smb-globals.js, smb-particles-core.js, smb-boss-tf-visuals1.js
// Must load AFTER smb-boss-tf-visuals1.js

function updateTFBurnTrail() {
  if (!tfBurnTrail) return;
  tfBurnTrail.timer++;
  // Spawn fading embers along the trail each frame
  if (tfBurnTrail.timer % 3 === 0 && tfBurnTrail.timer < tfBurnTrail.maxTimer - 10) {
    const ex = 20 + Math.random() * (GAME_W - 40);
    spawnParticles(ex, tfBurnTrail.y + (Math.random() - 0.5) * 10, '#ffcc00', 1);
  }
  if (tfBurnTrail.timer >= tfBurnTrail.maxTimer) tfBurnTrail = null;
}

function drawTFBurnTrail() {
  if (!tfBurnTrail) return;
  const bt = tfBurnTrail;
  const frac = 1 - bt.timer / bt.maxTimer;
  ctx.save();
  ctx.globalAlpha = frac * 0.55;
  // Core streak
  const grad = ctx.createLinearGradient(0, bt.y - 6, 0, bt.y + 6);
  grad.addColorStop(0, 'rgba(255,255,120,0)');
  grad.addColorStop(0.5, `rgba(255,220,40,${frac})`);
  grad.addColorStop(1, 'rgba(255,100,0,0)');
  ctx.fillStyle = grad;
  ctx.shadowColor = '#ffcc00';
  ctx.shadowBlur = 12 * frac;
  ctx.fillRect(0, bt.y - 6, GAME_W, 12);
  // Outer glow
  ctx.globalAlpha = frac * 0.18;
  ctx.shadowBlur = 28 * frac;
  ctx.fillRect(0, bt.y - 18, GAME_W, 36);
  ctx.restore();
}

// ── NEUTRON STAR ───────────────────────────────────────────────────────────────
function updateTFNeutronStar() {
  if (!tfNeutronStar) return;
  const ns = tfNeutronStar;
  ns.timer++;
  const boss = ns.bossRef;

  if (ns.phase === 'charge') {
    // Charge animation before pull activates
    if (ns.timer % 6 === 0) spawnParticles(
      boss.cx() + (Math.random() - 0.5) * 120,
      boss.cy() + (Math.random() - 0.5) * 100,
      Math.random() < 0.5 ? '#ffaa00' : '#ffffff', 2
    );
    if (ns.timer >= ns.maxTimer) {
      ns.phase = 'pull';
      ns.timer = 0; ns.maxTimer = 240;
      bossWarnings.push({ type: 'circle', x: boss.cx(), y: boss.cy(), r: 220,
        color: '#ffaa00', timer: 50, maxTimer: 50, label: 'NEUTRON STAR!' });
      screenShake = Math.max(screenShake, 18);
    }

  } else if (ns.phase === 'pull') {
    // Gravity pull — force ramps up over duration (most intense at end)
    const pullIntensity = 0.4 + (ns.timer / ns.maxTimer) * 1.2; // 0.4 → 1.6
    if (ns.timer % 6 === 0) spawnParticles(
      boss.cx() + (Math.random() - 0.5) * 260,
      boss.cy() + (Math.random() - 0.5) * 220,
      '#ffaa00', 3
    );
    // Apply gravitational pull to players (heavier near end)
    for (const p of players) {
      if ((p.isTrueForm && !(ns.bossRef && ns.bossRef.isProxy)) || p.health <= 0 || p.invincible > 0) continue;
      const dx = boss.cx() - p.cx();
      const dy = boss.cy() - (p.y + p.h / 2);
      const d  = Math.hypot(dx, dy);
      if (d > 10) {
        p.vx += (dx / d) * pullIntensity * 0.30;
        p.vy += (dy / d) * pullIntensity * 0.18;
      }
    }
    if (ns.timer >= ns.maxTimer) {
      // Transition: implosion visual then launch
      ns.phase = 'implosion';
      ns.timer = 0; ns.maxTimer = 28;
      slowMotion   = 0.20;
      hitSlowTimer = 35;
      spawnParticles(boss.cx(), boss.cy(), '#ffaa00', 20);
      spawnParticles(boss.cx(), boss.cy(), '#ffffff', 12);
    }

  } else if (ns.phase === 'implosion') {
    // Brief pause — massive pull spike — then launch
    for (const p of players) {
      if ((p.isTrueForm && !(ns.bossRef && ns.bossRef.isProxy)) || p.health <= 0) continue;
      const dx = boss.cx() - p.cx();
      const dy = boss.cy() - (p.y + p.h / 2);
      const d  = Math.hypot(dx, dy);
      if (d > 8) { p.vx += (dx / d) * 3.5; p.vy += (dy / d) * 2.0; }
    }
    if (ns.timer >= ns.maxTimer) {
      ns.phase = 'warn';
      ns.timer = 0; ns.maxTimer = 52;
      boss.vy = -55; boss.invincible = 130;
      bossWarnings.push({ type: 'circle', x: boss.cx(), y: 470, r: 95,
        color: '#ffaa00', timer: 52, maxTimer: 52, label: 'SLAM!' });
      slowMotion = 1.0; // snap back
      showBossDialogue('IMPACT.', 140);
      screenShake = Math.max(screenShake, 20);
    }

  } else if (ns.phase === 'warn') {
    if (ns.timer >= ns.maxTimer) {
      ns.phase = 'slam'; ns.timer = 0; ns.maxTimer = 1;
      if (boss) {
        boss.x  = clamp(ns.startX - boss.w / 2, 40, GAME_W - boss.w - 40);
        boss.y  = -90;
        boss.vy = 42; boss.vx = 0;
      }
    }

  } else if (ns.phase === 'slam') {
    if (boss && boss.onGround) {
      screenShake = Math.max(screenShake, 36);
      hitStopFrames = Math.max(hitStopFrames, 12);
      spawnParticles(boss.cx(), boss.y + boss.h, '#ffaa00', 35);
      spawnParticles(boss.cx(), boss.y + boss.h, '#ffffff', 20);
      spawnParticles(boss.cx(), boss.y + boss.h, '#ff4400', 12);
      for (const p of players) {
        if ((p.isTrueForm && !(ns.bossRef && ns.bossRef.isProxy)) || p.health <= 0) continue;
        const dd = Math.abs(p.cx() - boss.cx());
        if (dd < 140) {
          dealDamage(boss, p, 32, 24);
          p.vy = -16;
          spawnParticles(p.cx(), p.cy(), '#ffaa00', 10);
        }
      }
      tfNeutronStar = null;
    } else if (ns.timer > 130) {
      tfNeutronStar = null; // safety timeout
    }
  }
}

function drawTFNeutronStar() {
  if (!tfNeutronStar) return;
  const ns = tfNeutronStar;
  ctx.save();

  if (ns.phase === 'charge') {
    const prog = ns.timer / ns.maxTimer;
    const pulseR = 30 + prog * 40;
    const aura = ctx.createRadialGradient(ns.bossRef.cx(), ns.bossRef.cy(), 0, ns.bossRef.cx(), ns.bossRef.cy(), pulseR);
    aura.addColorStop(0,   `rgba(255,220,80,${prog * 0.8})`);
    aura.addColorStop(0.6, `rgba(255,120,0,${prog * 0.4})`);
    aura.addColorStop(1,   'rgba(255,80,0,0)');
    ctx.fillStyle = aura;
    ctx.beginPath(); ctx.arc(ns.bossRef.cx(), ns.bossRef.cy(), pulseR, 0, Math.PI * 2); ctx.fill();

  } else if (ns.phase === 'pull') {
    const prog = ns.timer / ns.maxTimer;
    const pulseR = 55 + Math.sin(ns.timer * 0.14) * 20 + prog * 40;
    const auraA = 0.15 + prog * 0.18;
    const aura = ctx.createRadialGradient(ns.bossRef.cx(), ns.bossRef.cy(), 10, ns.bossRef.cx(), ns.bossRef.cy(), pulseR);
    aura.addColorStop(0,   `rgba(255,200,0,${auraA * 2.5})`);
    aura.addColorStop(0.5, `rgba(255,100,0,${auraA * 1.4})`);
    aura.addColorStop(1,   'rgba(255,80,0,0)');
    ctx.fillStyle = aura;
    ctx.beginPath(); ctx.arc(ns.bossRef.cx(), ns.bossRef.cy(), pulseR, 0, Math.PI * 2); ctx.fill();
    // Concentric gravity rings — grow in opacity as pull ramps
    ctx.globalAlpha = (0.08 + prog * 0.14);
    ctx.strokeStyle = '#ffaa00'; ctx.lineWidth = 1.2;
    for (let rr = 55; rr <= 230; rr += 58) {
      ctx.beginPath(); ctx.arc(ns.bossRef.cx(), ns.bossRef.cy(), rr + Math.sin(ns.timer * 0.08 + rr * 0.02) * 6, 0, Math.PI * 2); ctx.stroke();
    }
    // Directional pull streaks toward boss
    if (ns.timer % 5 === 0) {
      ctx.globalAlpha = 0.18 + prog * 0.18;
      ctx.strokeStyle = '#ffcc44'; ctx.lineWidth = 1;
      const ang = Math.random() * Math.PI * 2;
      const dist = 140 + Math.random() * 120;
      ctx.beginPath();
      ctx.moveTo(ns.bossRef.cx() + Math.cos(ang) * dist, ns.bossRef.cy() + Math.sin(ang) * dist);
      ctx.lineTo(ns.bossRef.cx() + Math.cos(ang) * 18, ns.bossRef.cy() + Math.sin(ang) * 18);
      ctx.stroke();
    }

  } else if (ns.phase === 'implosion') {
    const prog = ns.timer / ns.maxTimer;
    // Everything flashes inward — bright burst of light
    ctx.globalAlpha = prog * 0.70;
    ctx.fillStyle = '#ffcc44';
    ctx.beginPath(); ctx.arc(ns.bossRef.cx(), ns.bossRef.cy(), 10 + (1 - prog) * 80, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = (1 - prog) * 0.35;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, GAME_W, GAME_H);

  } else if (ns.phase === 'warn') {
    const prog = ns.timer / ns.maxTimer;
    const shR  = 12 + prog * 88;
    ctx.globalAlpha = 0.35 + prog * 0.45;
    ctx.fillStyle = '#ff8800';
    ctx.shadowColor = '#ffaa00'; ctx.shadowBlur = 18;
    ctx.beginPath(); ctx.ellipse(ns.startX, 480, shR, shR * 0.22, 0, 0, Math.PI * 2); ctx.fill();
    // Rings converging on shadow
    ctx.globalAlpha = prog * 0.40;
    ctx.strokeStyle = '#ffcc00'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(ns.startX, 480, shR * 1.5, shR * 0.36, 0, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore();
}

// ── GALAXY SWEEP ───────────────────────────────────────────────────────────────
function updateTFGalaxySweep() {
  if (!tfGalaxySweep) return;
  const gs = tfGalaxySweep;
  gs.timer++;
  const boss = gs.bossRef || players.find(p => p.isTrueForm);

  if (gs.phase === 'charge') {
    gs.chargeTimer++;
    if (gs.chargeTimer >= gs.chargeMax) {
      gs.phase = 'active';
      bossWarnings.push({ type: 'circle', x: GAME_W / 2, y: GAME_H / 2 - 30,
        r: 280, color: '#8800ff', timer: 38, maxTimer: 38, label: 'GALAXY SWEEP!' });
      screenShake = Math.max(screenShake, 14);
      spawnParticles(GAME_W / 2, GAME_H / 2 - 30, '#cc66ff', 22);
    }
    return;
  }

  // Arm speed accelerates over duration: slow → fast
  const sweepProg = gs.timer / gs.maxTimer;
  gs.speed = 0.008 + sweepProg * 0.048; // 0.008 → 0.056 rad/frame
  gs.angle += gs.speed;

  const ARM_HALF = 0.42 + sweepProg * 0.06; // arms widen slightly at speed
  const ARM_LEN  = 290;
  const armAngles = [gs.angle, gs.angle + Math.PI];

  for (const p of players) {
    if ((p.isTrueForm && !(gs.bossRef && gs.bossRef.isProxy)) || p.health <= 0) continue;
    const dx = p.cx() - gs.cx;
    const dy = p.cy() - gs.cy;
    const d  = Math.hypot(dx, dy);
    if (d > ARM_LEN) continue;
    const playerAngle = Math.atan2(dy, dx);
    for (const armA of armAngles) {
      let diff = playerAngle - armA;
      while (diff >  Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const hitKey = `${p.playerNum || p.name}_${Math.floor(gs.timer / 9)}`;
      if (Math.abs(diff) < ARM_HALF && p.invincible <= 0 && !gs.hit.has(hitKey)) {
        gs.hit.add(hitKey);
        const dmg = 12 + Math.floor(sweepProg * 8); // scales 12→20 as arms speed up
        dealDamage(boss || players[1], p, dmg, 12 + Math.floor(sweepProg * 6));
        spawnParticles(p.cx(), p.cy(), '#8800ff', 10);
        spawnParticles(p.cx(), p.cy(), '#cc44ff',  5);
        hitStopFrames = Math.max(hitStopFrames, 5);
        p.invincible = Math.max(p.invincible, 14);
      }
    }
  }
  if (gs.timer >= gs.maxTimer) {
    screenShake = Math.max(screenShake, 10);
    tfGalaxySweep = null;
  }
}

function drawTFGalaxySweep() {
  if (!tfGalaxySweep) return;
  const gs = tfGalaxySweep;
  ctx.save();

  if (gs.phase === 'charge') {
    const prog = gs.chargeTimer / gs.chargeMax;
    // Center swirl growing
    const cr = 12 + prog * 28;
    ctx.globalAlpha = prog * 0.65;
    const cGrad = ctx.createRadialGradient(gs.cx, gs.cy, 0, gs.cx, gs.cy, cr);
    cGrad.addColorStop(0,   `rgba(255,255,255,${prog})`);
    cGrad.addColorStop(0.5, `rgba(180,0,255,${prog * 0.7})`);
    cGrad.addColorStop(1,   'rgba(100,0,180,0)');
    ctx.fillStyle = cGrad;
    ctx.shadowColor = '#aa00ff'; ctx.shadowBlur = 20;
    ctx.beginPath(); ctx.arc(gs.cx, gs.cy, cr, 0, Math.PI * 2); ctx.fill();
    ctx.restore(); return;
  }

  const sweepProg = gs.timer / gs.maxTimer;
  const fade = gs.timer < 15 ? gs.timer / 15 : gs.timer > gs.maxTimer - 18 ? (gs.maxTimer - gs.timer) / 18 : 1;
  const ARM_HALF_RAD = 0.42 + sweepProg * 0.06;
  const ARM_LEN = 290;
  const armAngles = [gs.angle, gs.angle + Math.PI];
  const armColors = [['#6600cc', '#dd44ff'], ['#330066', '#aa22ee']];

  for (let ai = 0; ai < armAngles.length; ai++) {
    const a = armAngles[ai];
    const [fillCol, edgeCol] = armColors[ai];
    // Arm wedge — brighter as speed increases
    ctx.globalAlpha = (0.30 + sweepProg * 0.22) * fade;
    ctx.fillStyle = fillCol;
    ctx.shadowColor = edgeCol; ctx.shadowBlur = 8 + sweepProg * 14;
    ctx.beginPath();
    ctx.moveTo(gs.cx, gs.cy);
    ctx.arc(gs.cx, gs.cy, ARM_LEN, a - ARM_HALF_RAD, a + ARM_HALF_RAD);
    ctx.closePath(); ctx.fill();
    // Leading edge — sharp bright line
    ctx.globalAlpha = (0.75 + sweepProg * 0.20) * fade;
    ctx.strokeStyle = edgeCol;
    ctx.lineWidth = 2.5 + sweepProg * 2;
    ctx.shadowBlur = 16 + sweepProg * 18;
    ctx.beginPath();
    ctx.moveTo(gs.cx, gs.cy);
    ctx.lineTo(gs.cx + Math.cos(a) * ARM_LEN, gs.cy + Math.sin(a) * ARM_LEN);
    ctx.stroke();
    // Trailing particles at arm tip
    if (gs.timer % 5 === 0) {
      ctx.globalAlpha = 0.55 * fade;
      ctx.fillStyle = edgeCol;
      ctx.beginPath();
      const tipX = gs.cx + Math.cos(a) * (ARM_LEN * 0.8);
      const tipY = gs.cy + Math.sin(a) * (ARM_LEN * 0.8);
      ctx.arc(tipX, tipY, 4 + sweepProg * 4, 0, Math.PI * 2); ctx.fill();
    }
  }
  // Center — pulsing star, gets hotter as arms accelerate
  ctx.globalAlpha = (0.55 + sweepProg * 0.30) * fade;
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = '#cc44ff';
  ctx.shadowBlur  = 22 + sweepProg * 22;
  const starR = 10 + sweepProg * 8;
  ctx.beginPath(); ctx.arc(gs.cx, gs.cy, starR, 0, Math.PI * 2); ctx.fill();
  // Outer distortion ring
  ctx.globalAlpha = (0.10 + sweepProg * 0.15) * fade;
  ctx.strokeStyle = '#8800ff'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(gs.cx, gs.cy, ARM_LEN, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
}

// ── MULTIVERSE FRACTURE ────────────────────────────────────────────────────────
// True timeline-echo system.
// Clones are purely visual — they track the real player's live position + a fixed X offset,
// so they mirror all movement identically without running extra physics.

function updateTFMultiverse() {
  if (!tfMultiverse) return;
  const mv = tfMultiverse;
  mv.timer++;
  const boss = mv.bossRef;
  const target = mv.targetRef;
  const arenaBounds = _bossArenaBounds();
  const _clonePose = idx => {
    const offset = mv.cloneOffsets[idx] || 0;
    const plan = mv.clonePlans ? mv.clonePlans[idx] : 'advance';
    const hist = _tfCloneHistory[Math.max(0, _tfCloneHistory.length - 1 - idx * 4)];
    const baseX = hist ? hist.x : (target ? target.cx() : GAME_W / 2);
    const baseY = hist ? hist.y : (target ? target.cy() : GAME_H / 2);
    const facing = hist ? hist.facing : (target ? target.facing : 1);
    const tNorm = Math.min(1, mv.timer / 70);
    let dx = 0, dy = 0;
    if (plan === 'advance') dx = 34 * tNorm;
    else if (plan === 'retreat') dx = -28 * tNorm;
    else if (plan === 'jump') dy = -48 * Math.sin(tNorm * Math.PI);
    else if (plan === 'dash') dx = 52 * Math.sin(tNorm * Math.PI * 0.5);
    return {
      x: clamp(baseX + offset + dx, arenaBounds.left + 30, arenaBounds.right - 30),
      y: clamp(baseY + dy, 60, GAME_H - 50),
      facing,
      plan,
    };
  };

  // ── show (0-70): slow-motion, clones appear ──────────────────────────────
  if (mv.phase === 'show' && mv.timer >= 70) {
    mv.phase = 'select';
    const realPose = _clonePose(mv.realIdx);
    mv.strikeX = realPose.x;
    mv.strikeY = realPose.y;
    // Boss warning at the locked position
    bossWarnings.push({
      type: 'cross', x: mv.strikeX, y: mv.strikeY,
      r: 30, color: '#ff0044', timer: 40, maxTimer: 40, label: 'THIS TIMELINE!',
    });
    screenShake = Math.max(screenShake, 14);
    spawnParticles(mv.strikeX, mv.strikeY, '#ff0044', 14);
    spawnParticles(mv.strikeX, mv.strikeY, '#ffffff',  8);
    // Sound cue: reuse phaseUp
    if (typeof SoundManager !== 'undefined') SoundManager.phaseUp();
  }

  // ── select (70-115): warning shown, player has time to dodge ─────────────
  if (mv.phase === 'select' && mv.timer >= 115) {
    mv.phase = 'collapse';
    slowMotion   = 1.0; // snap back — urgency
    // Spawn shard particles for each non-real clone
    if (target) {
      for (let i = 0; i < mv.cloneOffsets.length; i++) {
        if (i === mv.realIdx) continue;
        const fakePose = _clonePose(i);
        const cx = fakePose.x;
        const cy = fakePose.y;
        // Shard burst: lightweight objects stored in mv.shards
        for (let s = 0; s < 10; s++) {
          const ang = (s / 10) * Math.PI * 2;
          mv.shards.push({
            x: cx, y: cy,
            vx: Math.cos(ang) * (2 + Math.random() * 5),
            vy: Math.sin(ang) * (2 + Math.random() * 5) - 2,
            life: 22, maxLife: 22,
            col: ['#00ccff', '#44ffaa', '#aa44ff'][i % 3],
          });
        }
        spawnParticles(cx, cy, '#00ccff', 8);
        spawnParticles(cx, cy, '#ffffff', 5);
      }
      // Boss ghosts also shatter
      spawnParticles(boss ? (GAME_W - boss.cx()) : GAME_W * 0.25, boss ? boss.cy() : 220, '#cc44ff', 10);
    }
    screenShake = Math.max(screenShake, 18);
    hitStopFrames = Math.max(hitStopFrames, 8);
  }

  // ── collapse (115-148): shards fly, selected clone glows ─────────────────
  // Tick shard particles
  for (let s = mv.shards.length - 1; s >= 0; s--) {
    const sh = mv.shards[s];
    sh.x += sh.vx; sh.y += sh.vy; sh.vy += 0.3; // gravity
    sh.life--;
    if (sh.life <= 0) { mv.shards.splice(s, 1); }
  }

  if (mv.phase === 'collapse' && mv.timer >= 148) {
    mv.phase = 'strike';
    // Screen flash
    hitStopFrames = Math.max(hitStopFrames, 10);
    screenShake   = Math.max(screenShake, 24);
    spawnParticles(mv.strikeX, mv.strikeY, '#ff0044', 24);
    spawnParticles(mv.strikeX, mv.strikeY, '#00ccff', 16);
    spawnParticles(mv.strikeX, mv.strikeY, '#ffffff', 12);
    // Damage: player must have dodged away from mv.strikeX
    if (boss && target && target.health > 0) {
      const distFromStrike = Math.abs(target.cx() - mv.strikeX);
      if (distFromStrike < 68 && !mv.hit) {
        mv.hit = true;
        dealDamage(boss, target, 32, 22);
        spawnParticles(target.cx(), target.cy(), '#00ccff', 16);
        spawnParticles(target.cx(), target.cy(), '#ffffff',  8);
        hitStopFrames = Math.max(hitStopFrames, 8);
        screenShake   = Math.max(screenShake, 20);
      }
    }
  }

  if (mv.timer >= mv.maxTimer) {
    mv.shards.length = 0;
    if (mv.bossRef && mv.bossRef._setAttackPhase) mv.bossRef._setAttackPhase('recovery', 18, false);
    tfMultiverse = null;
  }
}

// ── helper: draw a lightweight stickman silhouette ──────────────────────────
function _drawTimelineStickman(x, y, facing, strokeCol, lw, shadowB, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = strokeCol;
  ctx.fillStyle   = strokeCol;
  ctx.lineWidth   = lw;
  ctx.lineCap     = 'round';
  ctx.shadowColor = strokeCol;
  ctx.shadowBlur  = shadowB;
  const headR = 9, neckY = y + headR * 2 + 1, shoulderY = neckY + 4, hipY = shoulderY + 24;
  // Head
  ctx.beginPath(); ctx.arc(x, y + headR, headR, 0, Math.PI * 2); ctx.stroke();
  // Body
  ctx.beginPath(); ctx.moveTo(x, neckY); ctx.lineTo(x, hipY); ctx.stroke();
  // Arms
  ctx.beginPath(); ctx.moveTo(x - 14, shoulderY + 4); ctx.lineTo(x + 14, shoulderY + 4); ctx.stroke();
  // Legs
  ctx.beginPath(); ctx.moveTo(x, hipY); ctx.lineTo(x + facing * 10, hipY + 22); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x, hipY); ctx.lineTo(x - facing * 10, hipY + 22); ctx.stroke();
  ctx.restore();
}

function _drawTimelineBossClone(boss, x, y, alpha, strokeCol = '#cc44ff') {
  if (!boss) return;
  const facing = boss.facing || 1;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = strokeCol;
  ctx.lineWidth = 2.6;
  ctx.lineCap = 'round';
  ctx.shadowColor = strokeCol;
  ctx.shadowBlur = 16;
  const topY = y - boss.h * 0.55;
  _drawTimelineStickman(x, topY, facing, strokeCol, 2.4, 14, alpha * 0.92);
  ctx.beginPath();
  ctx.arc(x, topY + 9, 13, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - 18, topY + 26);
  ctx.lineTo(x + 18, topY + 26);
  ctx.stroke();
  ctx.restore();
}

function drawTFMultiverse() {
  if (!tfMultiverse) return;
  const mv = tfMultiverse;
  const target = mv.targetRef;
  const boss   = mv.bossRef;
  const arenaBounds = _bossArenaBounds();
  ctx.save();

  const showProg    = Math.min(1, mv.timer / 24); // fade-in during first 24 frames
  const isCollapsed = mv.phase === 'collapse' || mv.phase === 'strike';
  const isStrike    = mv.phase === 'strike';

  // ── Otherworldly screen tint during show / select ──────────────────────────
  if (!isCollapsed) {
    const tintA = showProg * 0.16;
    ctx.globalAlpha = tintA;
    ctx.fillStyle = '#001122';
    ctx.fillRect(0, 0, GAME_W, GAME_H);
    ctx.globalAlpha = 1;
  }

  // ── Boss ghost mirrors ──────────────────────────────────────────────────────
  if (boss && !isCollapsed) {
    for (const bg of mv.bossGhosts) {
      const ghostX = clamp(boss.cx() + bg.offsetX, arenaBounds.left + 40, arenaBounds.right - 40);
      const ghostY = boss.cy();
      _drawTimelineBossClone(boss, ghostX, ghostY, showProg * 0.34);
    }
  }

  // ── Player clones ──────────────────────────────────────────────────────────
  if (target) {
    const _clonePos = mv.cloneOffsets.map((offset, i) => {
      const plan = mv.clonePlans ? mv.clonePlans[i] : 'advance';
      const hist = _tfCloneHistory[Math.max(0, _tfCloneHistory.length - 1 - i * 4)];
      const baseX = hist ? hist.x : target.cx();
      const baseY = hist ? hist.y : target.cy();
      const facing = hist ? hist.facing : target.facing;
      const tNorm = Math.min(1, mv.timer / 70);
      let dx = 0, dy = 0;
      if (plan === 'advance') dx = 34 * tNorm;
      else if (plan === 'retreat') dx = -28 * tNorm;
      else if (plan === 'jump') dy = -48 * Math.sin(tNorm * Math.PI);
      else if (plan === 'dash') dx = 52 * Math.sin(tNorm * Math.PI * 0.5);
      return { x: baseX + offset + dx, y: baseY + dy, facing, plan };
    });
    for (let i = 0; i < mv.cloneOffsets.length; i++) {
      const isReal = i === mv.realIdx;
      const rawX   = _clonePos[i].x;
      const cloneX = clamp(rawX, arenaBounds.left + 30, arenaBounds.right - 30);
      const cloneY = (_clonePos[i].y || target.y) + target.h * 0.25; // stickman reference Y
      const f = _clonePos[i].facing || target.facing || 1;

      // After collapse: only the selected clone remains visible
      if (isCollapsed && !isReal) continue;
      // After strike: hide everything
      if (isStrike) continue;

      // Alpha: clones are dim; real candidate brightens during select
      let cloneAlpha;
      if (isReal) {
        cloneAlpha = showProg * (mv.phase === 'select' || mv.phase === 'collapse' ? 0.90 : 0.50);
      } else {
        cloneAlpha = showProg * 0.28;
      }

      // Visual differentiation
      const cloneColors = ['#00ccff', '#44ffaa', '#aa44ff'];
      const col = isReal && mv.phase !== 'show' ? '#ff2244' : cloneColors[i % 3];
      const lw  = isReal && mv.phase !== 'show' ? 2.2 : 1.5;
      const shB = isReal && mv.phase !== 'show' ? 22 : 6;

      _drawTimelineStickman(cloneX, cloneY, f, col, lw, shB, cloneAlpha);

      ctx.save();
      ctx.globalAlpha = Math.min(0.75, cloneAlpha * 0.85);
      ctx.fillStyle = isReal ? '#ffd5dd' : '#ccf3ff';
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center';
      const label = _clonePos[i].plan === 'advance' ? 'PUSH'
        : _clonePos[i].plan === 'retreat' ? 'FADE'
        : _clonePos[i].plan === 'jump' ? 'RISE'
        : 'SHIFT';
      ctx.fillText(label, cloneX, cloneY - 42);
      ctx.restore();

      // Timeline label (only during show phase, non-real clones)
      if (!isReal && mv.phase === 'show') {
        ctx.save();
        ctx.globalAlpha = showProg * 0.50;
        ctx.fillStyle = col; ctx.font = '9px monospace'; ctx.textAlign = 'center';
        ctx.shadowColor = col; ctx.shadowBlur = 5;
        ctx.fillText(`T-${i + 1}`, cloneX, cloneY - 42);
        ctx.restore();
      }

      // Selection highlight ring on real clone during 'select'
      if (isReal && mv.phase === 'select') {
        const pulseProg = (mv.timer - 70) / 45;
        const pulseR = 22 + Math.sin(mv.timer * 0.35) * 5;
        ctx.save();
        ctx.globalAlpha = 0.50 + pulseProg * 0.35;
        ctx.strokeStyle = '#ff0044'; ctx.lineWidth = 2;
        ctx.shadowColor = '#ff0044'; ctx.shadowBlur = 18;
        ctx.beginPath(); ctx.arc(cloneX, cloneY + 15, pulseR, 0, Math.PI * 2); ctx.stroke();
        // Crosshair
        ctx.globalAlpha = 0.70 + pulseProg * 0.20;
        ctx.beginPath(); ctx.moveTo(cloneX - 26, cloneY + 15); ctx.lineTo(cloneX + 26, cloneY + 15); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cloneX, cloneY - 14); ctx.lineTo(cloneX, cloneY + 44); ctx.stroke();
        ctx.restore();

        if (boss) {
          ctx.save();
          ctx.globalAlpha = 0.42 + Math.sin(mv.timer * 0.3) * 0.08;
          ctx.strokeStyle = '#ff6688';
          ctx.lineWidth = 2.2;
          ctx.shadowColor = '#ff3355';
          ctx.shadowBlur = 18;
          ctx.beginPath();
          ctx.moveTo(boss.cx(), boss.cy() - 10);
          ctx.lineTo(cloneX, cloneY + 4);
          ctx.stroke();
          ctx.restore();
        }
      }

      // Collapse: selected clone gets a bright shockwave ring
      if (isReal && mv.phase === 'collapse') {
        const cProg = (mv.timer - 115) / 33;
        ctx.save();
        ctx.globalAlpha = (1 - cProg) * 0.70;
        ctx.strokeStyle = '#ff2244'; ctx.lineWidth = 3;
        ctx.shadowColor = '#ff0044'; ctx.shadowBlur = 22;
        ctx.beginPath(); ctx.arc(cloneX, cloneY + 15, 24 + cProg * 40, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
      }
    }

    // ── Strike marker: locked X beam column ──────────────────────────────────
    if (mv.phase === 'strike') {
      const sf = mv.timer - 148;
      const fade = Math.max(0, 1 - sf / 42);
      ctx.save();
      // Vertical impact column
      const iGrad = ctx.createLinearGradient(mv.strikeX - 22, 0, mv.strikeX + 22, 0);
      iGrad.addColorStop(0,   'rgba(255,0,68,0)');
      iGrad.addColorStop(0.4, `rgba(255,0,68,${0.55 * fade})`);
      iGrad.addColorStop(0.5, `rgba(255,255,255,${0.80 * fade})`);
      iGrad.addColorStop(0.6, `rgba(255,0,68,${0.55 * fade})`);
      iGrad.addColorStop(1,   'rgba(255,0,68,0)');
      ctx.globalAlpha = 1;
      ctx.fillStyle = iGrad;
      ctx.fillRect(mv.strikeX - 22, 0, 44, GAME_H);
      // Full flash on first 5 frames
      if (sf <= 5) {
        ctx.globalAlpha = 0.70 - sf * 0.12;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, GAME_W, GAME_H);
      }
      ctx.restore();
    }
  }

  // ── Shard particles ────────────────────────────────────────────────────────
  for (const sh of mv.shards) {
    const sf = sh.life / sh.maxLife;
    ctx.save();
    ctx.globalAlpha = sf * 0.80;
    ctx.fillStyle = sh.col;
    ctx.shadowColor = sh.col; ctx.shadowBlur = 8;
    const sz = 2 + sf * 3;
    ctx.fillRect(sh.x - sz / 2, sh.y - sz / 2, sz, sz);
    ctx.restore();
  }

  // ── Dodge hint text ────────────────────────────────────────────────────────
  if (mv.phase === 'select') {
    const ht = (mv.timer - 70) / 45;
    ctx.save();
    ctx.globalAlpha = Math.min(ht * 1.5, 0.85);
    ctx.fillStyle = '#ffdd44';
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.shadowColor = '#ff8800'; ctx.shadowBlur = 10;
    ctx.fillText('READ THE REAL TIMELINE', mv.strikeX, (mv.targetRef ? mv.targetRef.y - 28 : 80));
    ctx.restore();
  }

  ctx.restore();
}

// ── SUPERNOVA ─────────────────────────────────────────────────────────────────
function updateTFSupernova() {
  if (!tfSupernova) return;
  const sn = tfSupernova;
  sn.timer++;
  const boss = sn.bossRef;

  if (sn.phase === 'buildup') {
    // Particles converge on boss from all directions
    if (sn.timer % 3 === 0) {
      const ang = Math.random() * Math.PI * 2;
      const dist = 180 + Math.random() * 220;
      spawnParticles(
        boss.cx() + Math.cos(ang) * dist,
        boss.cy() + Math.sin(ang) * dist,
        Math.random() < 0.5 ? '#ffff88' : '#ff8800', 3
      );
    }
    if (sn.timer >= sn.maxTimer) {
      sn.phase = 'implosion';
      sn.timer = 0; sn.maxTimer = 36;
      // Heavy pull + deeper slow-mo during implosion
      slowMotion   = 0.08;
      hitSlowTimer = 50;
      screenShake  = Math.max(screenShake, 24);
    }

  } else if (sn.phase === 'implosion') {
    // Everything gets sucked toward boss center — massive pull spike
    for (const p of players) {
      if ((p.isTrueForm && !(sn.bossRef && sn.bossRef.isProxy)) || p.health <= 0) continue;
      const dx = boss.cx() - p.cx();
      const dy = boss.cy() - (p.y + p.h / 2);
      const d  = Math.hypot(dx, dy);
      if (d > 6) { p.vx += (dx / d) * 4.5; p.vy += (dy / d) * 3.0; }
    }
    if (sn.timer >= sn.maxTimer) {
      sn.phase = 'active';
      sn.timer = 0; sn.maxTimer = 60;
      slowMotion   = 1.0; // snap to normal on detonation
      screenShake  = Math.max(screenShake, 44);
      hitStopFrames = Math.max(hitStopFrames, 14);
      spawnParticles(boss.cx(), boss.cy(), '#ffffff', 40);
      spawnParticles(boss.cx(), boss.cy(), '#ffff88', 25);
      spawnParticles(boss.cx(), boss.cy(), '#ff8800', 20);
    }

  } else if (sn.phase === 'active') {
    sn.r = (sn.timer / sn.maxTimer) * 350;
    for (const p of players) {
      if ((p.isTrueForm && !(sn.bossRef && sn.bossRef.isProxy)) || p.health <= 0) continue;
      const dd = Math.hypot(p.cx() - boss.cx(), p.cy() - boss.cy());
      const inWave = dd >= 32 && dd <= sn.r + 26 && dd >= sn.r - 44;
      const hitKey = `${p.playerNum || p.name}_${Math.floor(sn.timer / 7)}`;
      if (inWave && p.invincible <= 0 && !sn.hit.has(hitKey)) {
        sn.hit.add(hitKey);
        dealDamage(boss, p, 36, 24);
        p.vy = -12;
        spawnParticles(p.cx(), p.cy(), '#ffff88', 14);
        hitStopFrames = Math.max(hitStopFrames, 8);
        p.invincible = Math.max(p.invincible, 22);
      }
    }
    if (sn.timer >= sn.maxTimer) tfSupernova = null;
  }
}

function drawTFSupernova() {
  if (!tfSupernova) return;
  const sn = tfSupernova;
  const boss = sn.bossRef;
  ctx.save();

  if (sn.phase === 'buildup') {
    const prog = sn.timer / sn.maxTimer;
    // Screen darkens — anticipation
    ctx.globalAlpha = prog * 0.28;
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, GAME_W, GAME_H);
    // Growing radiant halo
    const haloR = 18 + prog * 90;
    const halo = ctx.createRadialGradient(boss.cx(), boss.cy(), 0, boss.cx(), boss.cy(), haloR);
    halo.addColorStop(0,   `rgba(255,255,255,${prog * 0.88})`);
    halo.addColorStop(0.4, `rgba(255,220,80,${prog * 0.55})`);
    halo.addColorStop(1,   'rgba(255,120,0,0)');
    ctx.globalAlpha = 1;
    ctx.fillStyle = halo;
    ctx.shadowColor = '#ffff44'; ctx.shadowBlur = 28;
    ctx.beginPath(); ctx.arc(boss.cx(), boss.cy(), haloR, 0, Math.PI * 2); ctx.fill();
    // Converging streaks
    ctx.globalAlpha = prog * 0.20;
    ctx.strokeStyle = '#ffcc44'; ctx.lineWidth = 1;
    for (let si = 0; si < 8; si++) {
      const ang = (si / 8) * Math.PI * 2 + sn.timer * 0.04;
      const len = 80 + prog * 100;
      ctx.beginPath();
      ctx.moveTo(boss.cx() + Math.cos(ang) * (haloR + len), boss.cy() + Math.sin(ang) * (haloR + len));
      ctx.lineTo(boss.cx() + Math.cos(ang) * haloR * 1.1, boss.cy() + Math.sin(ang) * haloR * 1.1);
      ctx.stroke();
    }

  } else if (sn.phase === 'implosion') {
    const prog = sn.timer / sn.maxTimer;
    // Screen goes almost dark
    ctx.globalAlpha = 0.35 + prog * 0.40;
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, GAME_W, GAME_H);
    // Collapsing sphere
    const colR = (1 - prog) * 120 + 10;
    const colGrad = ctx.createRadialGradient(boss.cx(), boss.cy(), 0, boss.cx(), boss.cy(), colR);
    colGrad.addColorStop(0,   `rgba(255,255,255,${0.9 + prog * 0.1})`);
    colGrad.addColorStop(0.4, `rgba(255,200,50,${0.7})`);
    colGrad.addColorStop(1,   'rgba(255,60,0,0)');
    ctx.globalAlpha = 1;
    ctx.fillStyle = colGrad;
    ctx.shadowColor = '#ffffff'; ctx.shadowBlur = 40;
    ctx.beginPath(); ctx.arc(boss.cx(), boss.cy(), colR, 0, Math.PI * 2); ctx.fill();

  } else if (sn.phase === 'active') {
    const prog = sn.timer / sn.maxTimer;
    const r = sn.r;
    // White screen flash on detonation
    if (sn.timer <= 5) {
      ctx.globalAlpha = 0.88 - sn.timer * 0.14;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, GAME_W, GAME_H);
    }
    if (r > 0) {
      const ringFade = Math.max(0, 0.90 - prog * 0.75);
      // Outer shockwave ring
      ctx.globalAlpha = ringFade;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth   = 20 - prog * 14;
      ctx.shadowColor = '#ffff88'; ctx.shadowBlur = 35;
      ctx.beginPath(); ctx.arc(boss.cx(), boss.cy(), r, 0, Math.PI * 2); ctx.stroke();
      // Inner orange ring
      ctx.strokeStyle = '#ff8800'; ctx.lineWidth = 7;
      ctx.shadowBlur  = 14;
      ctx.beginPath(); ctx.arc(boss.cx(), boss.cy(), Math.max(1, r - 24), 0, Math.PI * 2); ctx.stroke();
      // Second trailing ring
      if (r > 40) {
        ctx.globalAlpha = ringFade * 0.50;
        ctx.strokeStyle = '#ffcc44'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(boss.cx(), boss.cy(), Math.max(1, r - 50), 0, Math.PI * 2); ctx.stroke();
      }
      // Safe zone indicator — green ring around boss core
      ctx.globalAlpha = ringFade * 0.55;
      ctx.strokeStyle = '#44ff88'; ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.arc(boss.cx(), boss.cy(), 45, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
    }
  }
  ctx.restore();
}
