'use strict';
// smb-boss-tf-misc.js — TF black holes, warp, portal teleport, size manipulation
// Depends on: smb-globals.js, smb-particles-core.js, smb-fighter.js
// Must load BEFORE smb-boss-phase-cin.js

// smb-boss-effects.js
// TrueForm visual effects: black holes, gravity wells, meteor, gamma beam, clones, multiverse, supernova, boss warning telegraphs.
// Depends on: smb-globals.js, smb-particles.js
// Must load: AFTER smb-boss-cinematics.js, BEFORE smb-loop.js
// ---- True Form helper functions ----
function spawnTFBlackHoles(bossRefOverride) {
  // Spawn 2–3 black holes at random positions across the arena
  const count = 2 + Math.floor(Math.random() * 2);
  const ref = bossRefOverride || players.find(p => p.isTrueForm) || null;
  for (let i = 0; i < count; i++) {
    tfBlackHoles.push({
      x:        100 + Math.random() * (GAME_W - 200),
      y:        120 + Math.random() * 200,
      r:        52,
      maxTimer: 360, // 6 seconds
      timer:    360,
      spin:     Math.random() * Math.PI * 2,
      bossRef:  ref,
    });
  }
}

function updateTFBlackHoles() {
  if (!tfBlackHoles.length) return;
  const tf = players.find(p => p.isTrueForm)
          || (tfBlackHoles.length ? tfBlackHoles[0].bossRef : null);
  for (let i = tfBlackHoles.length - 1; i >= 0; i--) {
    const bh = tfBlackHoles[i];
    bh.timer--;

    if (bh.timer <= 0) {
      // Implosion on expiry — outward KB burst
      screenShake = Math.max(screenShake, 16);
      spawnParticles(bh.x, bh.y, '#ffffff', 18);
      spawnParticles(bh.x, bh.y, '#440066', 12);
      for (const p of players) {
        if ((p.isTrueForm && !(bh.bossRef && bh.bossRef.isProxy)) || p.health <= 0) continue;
        const dx = p.cx() - bh.x;
        const dy = (p.y + p.h / 2) - bh.y;
        const d  = Math.hypot(dx, dy);
        if (d < 140 && d > 0.5) {
          // Push outward violently
          p.vx += (dx / d) * 12;
          p.vy += (dy / d) * 8;
        }
      }
      tfBlackHoles.splice(i, 1);
      // After ALL black holes expire, chain into gamma beam (phase 2+ only)
      if (tfBlackHoles.length === 0 && tf && !tfGammaBeam && tf._chainCd <= 0 && tf.getPhase && tf.getPhase() >= 2) {
        const chainTgt = players.find(p => !p.isTrueForm && p.health > 0);
        if (chainTgt) {
          tf._chainCd = 36;
          setTimeout(() => {
            if (!gameRunning || !tf) return;
            tf._doSpecial('gammaBeam', chainTgt);
          }, 500);
        }
      }
      continue;
    }

    // Pull ramps: stronger at start of life (when bh is young = timer near maxTimer)
    const age = 1 - bh.timer / bh.maxTimer; // 0 = just spawned, 1 = about to expire
    // Pull is strongest mid-life; final 10% slows as implosion approaches
    const pullMult = age < 0.5 ? 0.5 + age * 1.4 : 1.2 - (age - 0.5) * 0.6;

    for (const p of players) {
      if ((p.isTrueForm && !(bh.bossRef && bh.bossRef.isProxy)) || p.health <= 0) continue;
      const dx = bh.x - p.cx();
      const dy = bh.y - (p.y + p.h / 2);
      const d  = Math.hypot(dx, dy);
      if (d < 180 && d > 0.5) {
        const pull = 0.65 * (1 - d / 180) * pullMult;
        p.vx += (dx / d) * pull;
        p.vy += (dy / d) * pull * 0.75;
      }
      // Event horizon damage — 18 iframes so back-to-back frame hits can't chain
      if (d < bh.r + 8 && p.invincible <= 0) {
        dealDamage(tf || players[1], p, 36, 0, 1.0, false, 18);
        spawnParticles(p.cx(), p.cy(), '#000000', 10);
        spawnParticles(p.cx(), p.cy(), '#aa00ff',  6);
        hitStopFrames = Math.max(hitStopFrames, 8);
      }
    }
  }
}

function drawTFBlackHoles() {
  for (const bh of tfBlackHoles) {
    if (!isFinite(bh.x) || !isFinite(bh.y) || !isFinite(bh.r) || bh.r <= 0) continue;
    ctx.save();
    const alpha = bh.timer < 60 ? bh.timer / 60 : 1;
    bh.spin = (bh.spin || 0) + 0.025;

    // Gravitational lensing glow (outermost)
    const lensR = bh.r * 2.6;
    const gLens = ctx.createRadialGradient(bh.x, bh.y, bh.r * 1.1, bh.x, bh.y, lensR);
    gLens.addColorStop(0, `rgba(80,0,140,${0.22 * alpha})`);
    gLens.addColorStop(0.5, `rgba(30,0,60,${0.12 * alpha})`);
    gLens.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gLens;
    ctx.beginPath(); ctx.arc(bh.x, bh.y, lensR, 0, Math.PI * 2); ctx.fill();

    // Accretion disk (ellipse, rotates)
    ctx.save();
    ctx.translate(bh.x, bh.y);
    ctx.rotate(bh.spin);
    ctx.scale(1, 0.28);
    const diskInner = bh.r * 1.05, diskOuter = bh.r * 1.9;
    const gDisk = ctx.createRadialGradient(0, 0, diskInner, 0, 0, diskOuter);
    gDisk.addColorStop(0, `rgba(255,140,0,${0.85 * alpha})`);
    gDisk.addColorStop(0.4, `rgba(255,60,0,${0.55 * alpha})`);
    gDisk.addColorStop(0.75, `rgba(120,20,180,${0.3 * alpha})`);
    gDisk.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gDisk;
    ctx.beginPath(); ctx.arc(0, 0, diskOuter, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    // Photon ring (bright orange/white ring at event horizon)
    ctx.save();
    ctx.shadowColor = '#ff8800'; ctx.shadowBlur = 14;
    ctx.strokeStyle = `rgba(255,180,60,${0.75 * alpha})`;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(bh.x, bh.y, bh.r * 1.08, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();

    // Gravitational distortion ripples — expanding rings at varying alpha
    const age = bh.maxTimer > 0 ? 1 - bh.timer / bh.maxTimer : 0;
    ctx.save();
    ctx.strokeStyle = `rgba(140,0,255,${0.14 * alpha})`;
    ctx.lineWidth = 1;
    for (let ri = 0; ri < 3; ri++) {
      const rr = bh.r * 1.5 + ri * 28 + Math.sin(bh.spin * 2 + ri * 1.2) * 8;
      ctx.beginPath(); ctx.arc(bh.x, bh.y, rr, 0, Math.PI * 2); ctx.stroke();
    }
    // Pulsing outer gravity field (intensifies as black hole ages)
    ctx.strokeStyle = `rgba(100,0,200,${(0.05 + age * 0.12) * alpha})`;
    ctx.lineWidth = 2 + age * 3;
    ctx.setLineDash([6, 10]);
    ctx.beginPath(); ctx.arc(bh.x, bh.y, bh.r * 2.8 + Math.sin(bh.spin * 3) * 12, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // Black hole core (perfectly dark)
    const g = ctx.createRadialGradient(bh.x, bh.y, 0, bh.x, bh.y, bh.r);
    g.addColorStop(0, `rgba(0,0,0,${alpha})`);
    g.addColorStop(0.85, `rgba(0,0,0,${alpha})`);
    g.addColorStop(1, `rgba(0,0,0,0)`);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(bh.x, bh.y, bh.r, 0, Math.PI * 2); ctx.fill();

    ctx.restore();
  }
}

function tfWarpArena(key) {
  if (!ARENAS[key]) return;
  currentArenaKey = key;
  currentArena    = ARENAS[key];
  // Randomize layout if safe
  if (key !== 'lava') randomizeArenaLayout(key);
  generateBgElements();
  initMapPerks(key);
  // Reset floor state
  const floorPl = currentArena.platforms.find(p => p.isFloor);
  if (floorPl) floorPl.isFloorDisabled = false;
  tfFloorRemoved = false;
  if (settings.screenShake) screenShake = Math.max(screenShake, 22);
  spawnParticles(GAME_W / 2, GAME_H / 2, '#ffffff', 40);
}

function tfPortalTeleport(tf, target) {
  if (!target || !tf) return;
  const safePos = _bossFindSafeArenaPosition(tf, target.cx() + (target.facing || 1) * 48, target.y, {
    preferRaised: true,
    sideBias: target.facing || 1,
  });
  if (!safePos) {
    tf._finishAttackState && tf._finishAttackState('portal');
    return;
  }
  // Black portal flash
  spawnParticles(tf.cx(), tf.cy(), '#000000', 20);
  spawnParticles(tf.cx(), tf.cy(), '#ffffff', 10);
  setTimeout(() => {
    if (!gameRunning) return;
    const landed = _bossTeleportActor(tf, safePos.x + tf.w / 2, safePos.y, { preferRaised: true, sideBias: target.facing || 1 });
    if (!landed) {
      tf._finishAttackState && tf._finishAttackState('portal');
      return;
    }
    tf.facing = target.cx() > tf.cx() ? 1 : -1;
    spawnParticles(tf.cx(), tf.cy(), '#000000', 20);
    spawnParticles(tf.cx(), tf.cy(), '#ffffff', 10);
    if (settings.screenShake) screenShake = Math.max(screenShake, 12);
    tf._setAttackPhase && tf._setAttackPhase('recovery', 16, false);
  }, 350);
}

function tfSetSize(fighter, scale) {
  if (!fighter) return;
  // Restore original size first
  if (tfSizeTargets.has(fighter)) {
    const orig = tfSizeTargets.get(fighter);
    fighter.w = orig.w; fighter.h = orig.h;
  } else {
    tfSizeTargets.set(fighter, { w: fighter.w, h: fighter.h });
  }
  fighter.w        = Math.round(fighter.w * scale);
  fighter.h        = Math.round(fighter.h * scale);
  fighter.tfDrawScale = scale;
  fighter.drawScale   = scale;
}

