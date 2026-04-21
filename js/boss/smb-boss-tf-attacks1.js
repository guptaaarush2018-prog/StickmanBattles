'use strict';
// smb-boss-tf-attacks1.js — Gravity wells, meteor crash, clones, chain/grasp slam, dimension punch, shockwaves, updateBossPendingAttacks
// Depends on: smb-globals.js, smb-particles-core.js, smb-combat.js, smb-boss-tf-legacy.js
// Must load AFTER smb-boss-tf-legacy.js, BEFORE smb-boss-tf-attacks2.js

// ============================================================
function triggerPhaseTransition(entity, phase) {
  if (entity.isTrueForm) {
    startCinematic(phase === 2 ? _makeTFPhase2Cinematic(entity) : _makeTFPhase3Cinematic(entity));
  } else if (entity.isBeast) {
    startCinematic(_makeBeastPhase2Cinematic(entity));
  } else if (entity.isYeti) {
    startCinematic(_makeYetiPhase2Cinematic(entity));
  } else {
    startCinematic(phase === 2 ? _makeBossPhase2Cinematic(entity) : _makeBossPhase3Cinematic(entity));
  }
}

// ============================================================
// GRAVITY WELLS
// ============================================================
function updateTFGravityWells() {
  if (!tfGravityWells.length) return;
  const tf = players.find(p => p.isTrueForm)
          || (tfGravityWells.length ? tfGravityWells[0].bossRef : null);
  for (let i = tfGravityWells.length - 1; i >= 0; i--) {
    const gw = tfGravityWells[i];
    gw.timer--;
    if (gw.timer <= 0) { tfGravityWells.splice(i, 1); continue; }
    for (const p of players) {
      if ((p.isBoss && !(gw.bossRef && gw.bossRef.isProxy)) || p.health <= 0) continue;
      const dx = gw.x - p.cx();
      const dy = gw.y - (p.y + p.h * 0.5);
      const dd = Math.hypot(dx, dy);
      if (dd < gw.r && dd > 1) {
        const pull = gw.strength * 0.022 * (1 - dd / gw.r);
        p.vx += (dx / dd) * pull;
        p.vy += (dy / dd) * pull;
      }
      // Damage when very close to well centre — 18 iframes to prevent per-frame drain
      if (dd < 32 && p.invincible <= 0) {
        dealDamage(tf || players[players.length - 1], p, 18, 3, 1.0, false, 18);
        spawnParticles(p.cx(), p.cy(), '#440044', 8);
      }
    }
  }
}

function drawTFGravityWells() {
  for (const gw of tfGravityWells) {
    ctx.save();
    const alpha = gw.timer < 60 ? gw.timer / 60 : 1;
    const pulse = 0.85 + 0.15 * Math.sin(Date.now() * 0.006);
    // Outer pull haze
    const haze = ctx.createRadialGradient(gw.x, gw.y, gw.r * 0.3, gw.x, gw.y, gw.r);
    haze.addColorStop(0, `rgba(120,0,200,${0.35 * alpha * pulse})`);
    haze.addColorStop(0.5, `rgba(60,0,120,${0.18 * alpha})`);
    haze.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = haze;
    ctx.beginPath(); ctx.arc(gw.x, gw.y, gw.r, 0, Math.PI * 2); ctx.fill();
    // Spinning vortex rings
    for (let ring = 0; ring < 3; ring++) {
      const rr = gw.r * (0.2 + ring * 0.22);
      const angle = (Date.now() * 0.002 * (ring % 2 === 0 ? 1 : -1)) + ring * Math.PI * 0.67;
      ctx.save();
      ctx.translate(gw.x, gw.y);
      ctx.rotate(angle);
      ctx.scale(1, 0.35);
      ctx.strokeStyle = `rgba(200,80,255,${(0.6 - ring * 0.12) * alpha})`;
      ctx.lineWidth = 2;
      ctx.shadowColor = '#aa00ff'; ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.arc(0, 0, rr, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
    // Bright core
    ctx.shadowColor = '#ff00ff'; ctx.shadowBlur = 20;
    ctx.fillStyle = `rgba(255,100,255,${0.85 * alpha * pulse})`;
    ctx.beginPath(); ctx.arc(gw.x, gw.y, 10, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}

// ============================================================
// METEOR CRASH
// ============================================================
function updateTFMeteorCrash() {
  if (!tfMeteorCrash) return;
  const mc = tfMeteorCrash;
  mc.timer++;
  const tf = mc.boss;

  if (mc.phase === 'rising') {
    // Boss flies upward — when it leaves the screen switch to shadow phase
    if (tf.y < -80 || mc.timer > 50) {
      mc.phase = 'shadow';
      mc.timer = 0;
      tf.x = mc.landX - tf.w / 2;  // reposition off-screen
      tf.y = -200;
      tf.vx = 0; tf.vy = 0;
    }
  } else if (mc.phase === 'shadow') {
    // Shadow circle grows on the ground at landX
    mc.shadowR = Math.min(60, mc.shadowR + 2);
    if (mc.timer > 80) {  // after ~1.3s of warning, crash down
      mc.phase = 'crash';
      mc.timer = 0;
      tf.vy = 55;  // slam down hard
    }
  } else if (mc.phase === 'crash') {
    if (tf.onGround || mc.timer > 30) {
      // Impact
      screenShake = Math.max(screenShake, 30);
      spawnParticles(mc.landX, 460, '#000000', 40);
      spawnParticles(mc.landX, 460, '#ffffff', 20);
      spawnParticles(mc.landX, 460, '#8800ff', 16);
      // Shockwave: massive knockback to nearby players
      for (const p of players) {
        if (p.isBoss || p.health <= 0) continue;
        const sdx = p.cx() - mc.landX;
        const sdd = Math.abs(sdx);
        if (sdd < 280) {
          const force = 28 * (1 - sdd / 280);
          p.vx = (sdx > 0 ? 1 : -1) * force;
          p.vy = -force * 0.7;
          dealDamage(tf, p, Math.round(35 * (1 - sdd / 280) + 8), 0);
        }
      }
      if (typeof directorAddIntensity === 'function') directorAddIntensity(0.3);
      tfMeteorCrash = null;
    }
  }
}

function drawTFMeteorCrash() {
  if (!tfMeteorCrash) return;
  const mc = tfMeteorCrash;
  if (mc.phase !== 'shadow') return;
  // Warning shadow circle on the ground
  ctx.save();
  const pulse = 0.6 + 0.4 * Math.sin(mc.timer * 0.15);
  const urgency = Math.min(1, mc.timer / 80); // grows more intense over time
  const g = ctx.createRadialGradient(mc.landX, 465, 0, mc.landX, 465, mc.shadowR);
  g.addColorStop(0, `rgba(0,0,0,${0.75 * pulse})`);
  g.addColorStop(0.5, `rgba(80,0,140,${0.4 * urgency})`);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(mc.landX, 465, mc.shadowR, 0, Math.PI * 2); ctx.fill();
  // Warning ring
  ctx.strokeStyle = `rgba(200,0,255,${0.8 * pulse})`;
  ctx.lineWidth   = 2.5;
  ctx.shadowColor = '#ff00ff'; ctx.shadowBlur = 12;
  ctx.beginPath(); ctx.arc(mc.landX, 465, mc.shadowR, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
}

// ============================================================
// SHADOW CLONES
// ============================================================
function updateTFClones() {
  if (!tfClones.length) return;
  const tf = players.find(p => p.isTrueForm)
          || (tfClones.length ? tfClones[0].bossRef : null);
  const humanPlayers = players.filter(p => !p.isBoss && p.health > 0);
  for (let i = tfClones.length - 1; i >= 0; i--) {
    const cl = tfClones[i];
    cl.timer--;
    cl.animTimer++;
    if (cl.timer <= 0 || cl.health <= 0) {
      spawnParticles(cl.x + cl.w / 2, cl.y + cl.h * 0.5, '#333333', 10);
      tfClones.splice(i, 1);
      continue;
    }
    // Chase nearest human
    if (humanPlayers.length > 0) {
      const target = humanPlayers.reduce((a, b) =>
        Math.abs(b.cx() - (cl.x + cl.w / 2)) < Math.abs(a.cx() - (cl.x + cl.w / 2)) ? b : a);
      const ddx = target.cx() - (cl.x + cl.w / 2);
      cl.facing = ddx > 0 ? 1 : -1;
      if (Math.abs(ddx) > 50) cl.x += cl.facing * 3.2;
      // Clone attack
      if (cl.attackTimer > 0) {
        cl.attackTimer--;
        if (cl.attackTimer === 0 && Math.abs(ddx) < 55) {
          dealDamage(tf || players[players.length - 1], target, 12, 6);
        }
      } else if (Math.abs(ddx) < 55 && Math.random() < 0.04) {
        cl.attackTimer = 14;
      }
    }
    // Clones die in one hit — check if any projectile or player attack hit them
    for (const p of players) {
      if (p.isBoss || p.health <= 0 || p.attackTimer <= 0) continue;
      const cx = cl.x + cl.w / 2;
      if (Math.abs(p.cx() - cx) < 55 && Math.abs((p.y + p.h / 2) - (cl.y + cl.h / 2)) < 50) {
        // If it's the real clone, deal damage back to the player
        if (cl.isReal) {
          dealDamage(tf || players[players.length - 1], p, 25, 12);
          spawnParticles(cx, cl.y + cl.h * 0.5, '#ffffff', 18);
          showBossDialogue('Sharp. That\'ll cost you.', 120);
        } else {
          spawnParticles(cx, cl.y + cl.h * 0.5, '#444444', 14);
        }
        cl.health = 0;
      }
    }
  }
}

function drawTFClones() {
  for (const cl of tfClones) {
    ctx.save();
    const alpha = cl.timer < 45 ? cl.timer / 45 : 0.72;
    ctx.globalAlpha = alpha;
    const cx = cl.x + cl.w / 2;
    const ty = cl.y;
    const sw = Math.sin(cl.animTimer * 0.22) * 0.45;
    ctx.shadowColor = '#333333'; ctx.shadowBlur = 6;
    ctx.strokeStyle = '#555555'; ctx.lineWidth = 2; ctx.lineCap = 'round';
    const headR = 9, headCY = ty + headR + 1, shoulderY = headCY + headR + 5, hipY = shoulderY + 24;
    // Head
    ctx.fillStyle = '#222222';
    ctx.beginPath(); ctx.arc(cx, headCY, headR, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // Body
    ctx.beginPath(); ctx.moveTo(cx, headCY + headR); ctx.lineTo(cx, hipY); ctx.stroke();
    // Arms
    ctx.beginPath(); ctx.moveTo(cx, shoulderY); ctx.lineTo(cx + Math.cos(Math.PI * 0.58 + sw) * 20, shoulderY + Math.sin(Math.PI * 0.58 + sw) * 20); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, shoulderY); ctx.lineTo(cx + Math.cos(Math.PI * 0.42 - sw) * 20, shoulderY + Math.sin(Math.PI * 0.42 - sw) * 20); ctx.stroke();
    // Legs
    ctx.beginPath(); ctx.moveTo(cx, hipY); ctx.lineTo(cx + Math.cos(Math.PI * 0.5 + sw * 0.9) * 22, hipY + Math.sin(Math.PI * 0.5 + sw * 0.9) * 22); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, hipY); ctx.lineTo(cx + Math.cos(Math.PI * 0.5 - sw * 0.9) * 22, hipY + Math.sin(Math.PI * 0.5 - sw * 0.9) * 22); ctx.stroke();
    ctx.restore();
  }
}

// ============================================================
// CHAIN SLAM COMBO
// ============================================================
function updateTFChainSlam() {
  if (!tfChainSlam) return;
  const cs = tfChainSlam;
  const tf = players.find(p => p.isTrueForm);
  if (!tf || !cs.target || cs.target.health <= 0) { tfChainSlam = null; return; }
  cs.timer++;
  // Stage timing: 0=grab(0-20f), 1=slam(20-40f), 2=kick(40-60f), 3=shockwave(60-80f)
  if (cs.stage === 0 && cs.timer >= 20) {
    // Grab: pull target to boss + damage
    cs.target.x = tf.cx() - cs.target.w / 2 + tf.facing * 30;
    cs.target.vy = -8;
    dealDamage(tf, cs.target, 18, 2);
    spawnParticles(tf.cx(), tf.cy(), '#ffffff', 12);
    cs.stage = 1; cs.timer = 0;
  } else if (cs.stage === 1 && cs.timer >= 20) {
    // Slam: drive target into ground
    cs.target.vy = 22;
    cs.target.vx = 0;
    dealDamage(tf, cs.target, 24, 1);
    screenShake = Math.max(screenShake, 14);
    spawnParticles(cs.target.cx(), cs.target.y + cs.target.h, '#ffffff', 16);
    cs.stage = 2; cs.timer = 0;
  } else if (cs.stage === 2 && cs.timer >= 20) {
    // Kick: launch target sideways
    const kickDir = tf.facing;
    cs.target.vx = kickDir * 22;
    cs.target.vy = -10;
    dealDamage(tf, cs.target, 20, 14);
    screenShake = Math.max(screenShake, 18);
    spawnParticles(cs.target.cx(), cs.target.cy(), '#8800ff', 18);
    cs.stage = 3; cs.timer = 0;
  } else if (cs.stage === 3 && cs.timer >= 20) {
    // Shockwave: radial blast
    screenShake = Math.max(screenShake, 22);
    spawnParticles(tf.cx(), 460, '#000000', 30);
    spawnParticles(tf.cx(), 460, '#8800ff', 16);
    for (const p of players) {
      if (p.isBoss || p.health <= 0) continue;
      const sdx = p.cx() - tf.cx();
      if (Math.abs(sdx) < 300) {
        p.vx = (sdx > 0 ? 1 : -1) * 20 * (1 - Math.abs(sdx) / 300);
        p.vy = -14;
        dealDamage(tf, p, 14, 0);
      }
    }
    if (typeof directorAddIntensity === 'function') directorAddIntensity(0.25);
    tfChainSlam = null;
  }
}

// ============================================================
// VOID GRASP SLAM (deferred hit after pull)
// ============================================================
function updateTFGraspSlam() {
  if (!tfGraspSlam) return;
  tfGraspSlam.timer--;
  if (tfGraspSlam.timer <= 0) {
    const tf = players.find(p => p.isTrueForm);
    // Slam everyone near the boss
    for (const p of players) {
      if (p.isBoss || p.health <= 0) continue;
      const dd = Math.hypot(p.cx() - (tf ? tf.cx() : GAME_W / 2), (p.y + p.h * 0.5) - (tf ? tf.cy() : 300));
      if (dd < 120) {
        p.vy = 22;  // drive into ground
        dealDamage(tf || players[players.length - 1], p, 30, 2);
        screenShake = Math.max(screenShake, 20);
        spawnParticles(p.cx(), p.cy(), '#440044', 12);
        spawnParticles(p.cx(), p.cy(), '#ffffff',  6);
      }
    }
    tfGraspSlam = null;
  }
}

// ============================================================
// DIMENSION PUNCH CINEMATIC
// ============================================================
// Stage 0  (0–18f):  Boss charges toward player
// Stage 1  (18–30f): Impact — freeze, shake, flash
// Stage 2  (30–44f): Launch — very high velocity applied, gravity disabled
// Stage 3  (44–200f): Dimension travel — player rockets across arena,
//                     background flashes through dimensions every 30f
// Stage 4  (200–230f): Gravity restored, player slams into floor
// Stage 5  (230+):   Cleanup
// ============================================================
function updateTFDimensionPunch() {
  if (!tfDimensionPunch) return;
  const dp = tfDimensionPunch;
  const tf = dp.boss;
  const t  = dp.target;

  // Abort if entities gone
  if (!tf || !t || t.health <= 0) { tfDimensionPunch = null; return; }

  dp.timer++;
  dp.bgFlashTimer = Math.max(0, dp.bgFlashTimer - 1);

  // ── Stage 0: Boss charges toward player (0–18 frames) ───────────────────
  if (dp.stage === 0) {
    // Boss keeps charging momentum (set in _doSpecial)
    if (dp.timer >= 18) {
      // Check if boss is close enough — snap to contact
      const dx = t.cx() - tf.cx();
      if (Math.abs(dx) < 100) {
        tf.x = t.cx() - dp.launchDir * (tf.w + 10) - tf.w / 2;
      }
      dp.stage = 1;
      dp.timer = 0;
    }
    return;
  }

  // ── Stage 1: Impact (frames 0–12) ───────────────────────────────────────
  if (dp.stage === 1) {
    if (dp.timer === 1) {
      // Freeze frame
      hitStopFrames = Math.max(hitStopFrames, 10);
      // Shake
      screenShake = Math.max(screenShake, 40);
      // White flash
      cinScreenFlash = { color: '#ffffff', alpha: 0.90, timer: 16, maxTimer: 16 };
      // Damage
      dealDamage(tf, t, 28, 3);
      spawnParticles(t.cx(), t.cy(), '#ffffff', 24);
      spawnParticles(t.cx(), t.cy(), '#aa00ff', 16);
      spawnParticles(t.cx(), t.cy(), '#000000', 10);
      // Boss stops
      tf.vx = 0; tf.vy = 0;
    }
    if (dp.timer >= 12) {
      dp.stage = 2;
      dp.timer = 0;
    }
    return;
  }

  // ── Stage 2: Launch (frames 0–14) ───────────────────────────────────────
  if (dp.stage === 2) {
    if (dp.timer === 1) {
      // Apply extreme horizontal velocity in the punch direction
      t.vx = dp.launchDir * 48;
      t.vy = -12;
      // Lock gravity on the target
      t._dimPunchGravLock = true;
      // Slow motion for dramatic effect
      if (typeof slowMotion !== 'undefined') slowMotion = 0.25;
      screenShake = Math.max(screenShake, 28);
      cinScreenFlash = { color: '#8800ff', alpha: 0.55, timer: 10, maxTimer: 10 };
      spawnParticles(t.cx(), t.cy(), '#ffffff', 18);
    }
    if (dp.timer >= 14) {
      dp.stage = 3;
      dp.timer = 0;
      dp.travelTimer = 0;
      dp.bgPhase = 0;
      // Restore slow-mo for travel phase
      if (typeof slowMotion !== 'undefined') slowMotion = 1.0;
    }
    return;
  }

  // ── Stage 3: Dimension travel (frames 0–156) ────────────────────────────
  if (dp.stage === 3) {
    dp.travelTimer++;

    // Sustain high velocity — player travels fast horizontally
    t.vx = dp.launchDir * 46;
    t.vy = 0;  // gravity locked: keep vertical constant
    t._dimPunchGravLock = true;

    // Wrap player across screen edges for "dimension travel" feel
    if (t.x + t.w < 0)        t.x = GAME_W - t.w;
    else if (t.x > GAME_W)    t.x = 0;

    // Background flash every 30 frames — cycle through dimension colours
    if (dp.travelTimer % 30 === 0) {
      dp.bgPhase = (dp.bgPhase + 1) % 5;
      dp.bgFlashTimer = 12;
      screenShake = Math.max(screenShake, 14);
      spawnParticles(t.cx(), t.cy(), ['#00ffff','#ff0066','#ffff00','#ff6600','#00ff88'][dp.bgPhase], 20);
      cinScreenFlash = {
        color: ['#00ffff','#ff0066','#ffff00','#ff6600','#00ff88'][dp.bgPhase],
        alpha: 0.35, timer: 8, maxTimer: 8,
      };
    }

    // Particle trail behind the player
    if (dp.travelTimer % 4 === 0) {
      spawnParticles(t.cx() - dp.launchDir * 18, t.cy(), '#8800ff', 4);
      spawnParticles(t.cx() - dp.launchDir * 8,  t.cy(), '#ffffff', 2);
    }

    if (dp.travelTimer >= 156) {
      dp.stage = 4;
      dp.timer = 0;
      // Bring player back to arena centre-ish for the slam
      t.x = clamp(GAME_W / 2 - t.w / 2 + (Math.random() - 0.5) * 200, 60, GAME_W - 60 - t.w);
      t.y = 80;
      t.vx = 0;
      t.vy = 0;
    }
    return;
  }

  // ── Stage 4: Slam (restore gravity, drive into floor) ───────────────────
  if (dp.stage === 4) {
    if (dp.timer === 1) {
      t._dimPunchGravLock = false;
      // Blast downward
      t.vy = 32;
      t.vx = 0;
      screenShake = Math.max(screenShake, 36);
      cinScreenFlash = { color: '#ffffff', alpha: 0.80, timer: 14, maxTimer: 14 };
      spawnParticles(t.cx(), t.cy(), '#ffffff', 22);
      spawnParticles(t.cx(), t.cy(), '#8800ff', 14);
    }
    // Wait until player lands or timer expires
    const landed = t.onGround && dp.timer > 4;
    if (landed || dp.timer >= 40) {
      // Impact on landing
      if (landed) {
        dealDamage(tf, t, 22, 2);
        screenShake = Math.max(screenShake, 30);
        spawnParticles(t.cx(), t.y + t.h, '#ffffff', 28);
        spawnParticles(t.cx(), t.y + t.h, '#000000', 14);
        if (typeof CinFX !== 'undefined') CinFX.groundCrack(t.cx(), t.y + t.h);
        CinFX.shockwave(t.cx(), t.y + t.h, '#8800ff', { count: 3, maxR: 200, dur: 50 });
      }
      dp.stage = 5;
      dp.timer = 0;
    }
    return;
  }

  // ── Stage 5: Cleanup ─────────────────────────────────────────────────────
  if (dp.stage === 5) {
    t._dimPunchGravLock = false;
    if (typeof slowMotion !== 'undefined') slowMotion = 1.0;
    tfDimensionPunch = null;
  }
}

// ── Dimension Punch — background dimension visuals ────────────────────────────
function drawTFDimensionPunch() {
  if (!tfDimensionPunch) return;
  const dp = tfDimensionPunch;
  if (dp.stage !== 3 && dp.stage !== 4) return;

  // During travel: draw coloured dimension overlay stripes
  const colours = ['#00ffff','#ff0066','#ffff00','#ff6600','#00ff88'];
  const col     = colours[dp.bgPhase % colours.length];
  const fade    = dp.bgFlashTimer > 0 ? (dp.bgFlashTimer / 12) * 0.22 : 0;
  if (fade > 0) {
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.fillStyle = col;
    ctx.fillRect(0, 0, GAME_W, GAME_H);
    // Horizontal speed lines to reinforce directionality
    ctx.globalAlpha = fade * 1.8;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth   = 1.5;
    for (let i = 0; i < 18; i++) {
      const ly = 20 + Math.random() * (GAME_H - 40);
      const lx = Math.random() * GAME_W;
      const ll = 60 + Math.random() * 160;
      ctx.beginPath();
      ctx.moveTo(lx, ly);
      ctx.lineTo(lx + (dp.launchDir > 0 ? ll : -ll), ly);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Draw a rift crack centred on the player during travel
  if (dp.target && dp.stage === 3) {
    const t = dp.target;
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.strokeStyle = col;
    ctx.shadowColor  = col;
    ctx.shadowBlur   = 18;
    ctx.lineWidth    = 3;
    ctx.beginPath();
    ctx.moveTo(t.cx(), t.cy() - 40);
    ctx.lineTo(t.cx() + dp.launchDir * 70, t.cy());
    ctx.lineTo(t.cx(), t.cy() + 40);
    ctx.stroke();
    ctx.restore();
  }
}

// ── Shockwave Pulse ──────────────────────────────────────────────────────────
function updateTFShockwaves() {
  for (const sw of tfShockwaves) {
    if (sw.done) continue;
    // Air-slam sentinel: wait until boss lands, then spawn real waves
    if (sw.pendingLanding) {
      if (sw.boss && sw.boss.onGround) {
        sw.pendingLanding = false;
        if (typeof screenShake !== 'undefined') screenShake = Math.max(screenShake, 22);
        spawnParticles(sw.boss.cx(), sw.boss.y + sw.boss.h, '#ffffff', 26);
        spawnParticles(sw.boss.cx(), sw.boss.y + sw.boss.h, '#440044', 16);
        for (let ri = 0; ri < 3; ri++) {
          tfShockwaves.push({
            x: sw.boss.cx(), y: sw.boss.y + sw.boss.h,
            r: 12 + ri * 6, maxR: 260 + ri * 70,
            timer: 38 + ri * 9, maxTimer: 38 + ri * 9,
            boss: sw.boss, hit: new Set(),
          });
        }
      } else {
        sw.timer--;
        if (sw.timer <= 0) sw.done = true;
      }
      continue;
    }
    const speed = (sw.maxR - sw.r) / (sw.timer + 1) * 1.6;
    sw.r = Math.min(sw.r + speed, sw.maxR);
    sw.timer--;
    if (sw.timer <= 0 || sw.r >= sw.maxR) { sw.done = true; continue; }
    // Damage players inside the ring band
    for (const p of players) {
      if (p.isBoss || p.health <= 0 || sw.hit.has(p)) continue;
      const pd = Math.hypot(p.cx() - sw.x, (p.y + p.h * 0.5) - sw.y);
      if (pd < sw.r + 20 && pd > sw.r - 22) {
        sw.hit.add(p);
        dealDamage(sw.boss || null, p, 15, 9);
        const rDir = p.cx() > sw.x ? 1 : -1;
        p.vx += rDir * 13;
        p.vy  = Math.min(p.vy, -7);
      }
    }
  }
  tfShockwaves = tfShockwaves.filter(sw => !sw.done);
}

function drawTFShockwaves() {
  for (const sw of tfShockwaves) {
    if (sw.done || sw.pendingLanding || sw.r < 2) continue;
    const progress = 1 - sw.timer / sw.maxTimer;
    const alpha    = progress < 0.85 ? Math.min(1, progress / 0.25) * 0.75
                                      : (1 - (progress - 0.85) / 0.15) * 0.75;
    if (alpha <= 0) continue;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle  = '#cc00ff';
    ctx.lineWidth    = 3.5;
    ctx.shadowColor  = '#ff00ff';
    ctx.shadowBlur   = 14;
    ctx.beginPath(); ctx.arc(sw.x, sw.y, sw.r, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = alpha * 0.4;
    ctx.strokeStyle  = '#ffffff';
    ctx.lineWidth    = 1.5;
    ctx.shadowBlur   = 6;
    ctx.beginPath(); ctx.arc(sw.x, sw.y, sw.r + 8, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }
}
function updateBossPendingAttacks() {
  if (!gameRunning) return;
  const boss = players.find(p => p.isBoss && !p.isTrueForm);

  // ── Tick bossWarnings (visual only) ───────────────────────
  for (let i = bossWarnings.length - 1; i >= 0; i--) {
    bossWarnings[i].timer--;
    if (bossWarnings[i].timer <= 0) bossWarnings.splice(i, 1);
  }
  // ── Tick safe zones ────────────────────────────────────────
  for (let i = bossMetSafeZones.length - 1; i >= 0; i--) {
    bossMetSafeZones[i].timer--;
    if (bossMetSafeZones[i].timer <= 0) bossMetSafeZones.splice(i, 1);
  }
  // ── Desperation flash decay ────────────────────────────────
  if (bossDesperationFlash > 0) bossDesperationFlash--;

  if (!boss || boss.health <= 0) return;

  // ── Stagger: accumulate damage taken, trigger stun ────────
  const dmgThisFrame = (boss._prevHealth || boss.health) - boss.health;
  if (dmgThisFrame > 0) {
    bossStaggerDmg   += dmgThisFrame;
    bossStaggerDecay  = 180; // 3s window
  }
  boss._prevHealth = boss.health;
  if (bossStaggerDecay > 0) {
    bossStaggerDecay--;
    if (bossStaggerDecay <= 0) bossStaggerDmg = 0;
  }
  if (bossStaggerDmg >= 120 && bossStaggerTimer <= 0) {
    bossStaggerTimer = 150; // 2.5s stagger
    bossStaggerDmg   = 0;
    bossStaggerDecay = 0;
    screenShake = Math.max(screenShake, 25);
    showBossDialogue(randChoice(['...that landed.', 'Hm.', 'You hit harder than you look.', '...fine.']), 120);
    spawnParticles(boss.cx(), boss.cy(), '#ffffff', 22);
    if (typeof directorAddIntensity === 'function') directorAddIntensity(0.4);
  }
  if (bossStaggerTimer > 0) {
    bossStaggerTimer--;
    boss.vx *= 0.85; // slow boss during stagger
    if (bossStaggerTimer === 0) {
      showBossDialogue(randChoice(['That cost you nothing. My turn costs more.', 'I allowed that.', 'Done being generous.']), 120);
    }
  }

  // ── Desperation mode: health < 25% ───────────────────────
  if (!bossDesperationMode && boss.health / boss.maxHealth < 0.25) {
    bossDesperationMode  = true;
    bossDesperationFlash = 90;
    screenShake = Math.max(screenShake, 30);
    showBossDialogue('You want to see what\'s left? Here it is.', 300);
    spawnParticles(boss.cx(), boss.cy(), '#ff0000', 40);
    spawnParticles(boss.cx(), boss.cy(), '#cc00ee', 30);
    if (typeof directorAddIntensity === 'function') directorAddIntensity(0.8);
  }

  // ── Pending Ground Slam ───────────────────────────────────
  if (boss._pendingGroundSlam) {
    boss._pendingGroundSlam.timer--;
    if (boss._pendingGroundSlam.timer <= 0) {
      screenShake = Math.max(screenShake, 20);
      spawnParticles(boss.cx(), boss.y + boss.h, '#cc00ee', 30);
      spawnParticles(boss.cx(), boss.y + boss.h, '#ffffff', 14);
      for (const p of players) {
        if (p.isBoss || p.health <= 0) continue;
        if (dist(boss, p) < 160) {
          dealDamage(boss, p, 20, 14);
          const rDir = p.cx() > boss.cx() ? 1 : -1;
          p.vx += rDir * 16;
          p.vy  = Math.min(p.vy, -10);
        }
      }
      for (let i = 0; i < 6; i++) {
        const sx = clamp(boss.cx() + (i - 2.5) * 55, 20, 880);
        bossSpikes.push({ x: sx, maxH: 70 + Math.random() * 40, h: 0,
          phase: 'rising', stayTimer: 0, done: false });
      }
      if (typeof directorAddIntensity === 'function') directorAddIntensity(0.15);
      boss._pendingGroundSlam = null;
    }
  }

  // ── Pending Gravity Pulse ─────────────────────────────────
  if (boss._pendingGravPulse) {
    boss._pendingGravPulse.timer--;
    if (boss._pendingGravPulse.timer <= 0) {
      screenShake = Math.max(screenShake, 18);
      spawnParticles(boss.cx(), boss.cy(), '#9900cc', 28);
      spawnParticles(boss.cx(), boss.cy(), '#cc66ff', 14);
      for (const p of players) {
        if (p.isBoss || p.health <= 0) continue;
        const ddx = boss.cx() - p.cx();
        const ddy = (boss.y + boss.h * 0.5) - (p.y + p.h * 0.5);
        const dd  = Math.hypot(ddx, ddy);
        const isEdge = boss._pendingGravPulse.edge;
        const range  = isEdge ? 500 : 350;
        const force  = isEdge ? 18  : 22;
        if (dd < range && dd > 1) {
          const pull = force * (1 - dd / range);
          p.vx = (ddx / dd) * pull;
          p.vy = (ddy / dd) * pull * 0.5 - 5;
        }
      }
      if (typeof directorAddIntensity === 'function') directorAddIntensity(0.14);
      boss._pendingGravPulse = null;
    }
  }
}

// ── TrueForm pending attacks + stagger ───────────────────────────────────────
