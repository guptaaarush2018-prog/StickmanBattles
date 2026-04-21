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

// ============================================================
// CINEMATIC MANAGER
// ============================================================
function startCinematic(seq) {
  if (onlineMode) return; // skip cinematics in online multiplayer (sync too complex)
  if (activeCinematic) endCinematic();
  activeCinematic = Object.assign({ timer: 0 }, seq);
  isCinematic = true;
  if (typeof setCombatLock === 'function') setCombatLock('cinematic');
  // Hard freeze: halt physics, input, and hazard damage so player cannot die during cinematics
  gameFrozen = true;
  // Freeze all player velocities to prevent mid-air drift during cinematic
  if (typeof players !== 'undefined') {
    for (const p of players) {
      if (!p.isBoss && p.health > 0) { p.vx = 0; p.vy = Math.min(p.vy, 0); }
    }
  }
}

function updateCinematic() {
  if (!activeCinematic) return;
  activeCinematic.timer++;
  const t = activeCinematic.timer / 60; // seconds
  activeCinematic.update(t);
  if (activeCinematic.timer >= activeCinematic.durationFrames) {
    endCinematic();
  }
}

function endCinematic() {
  if (!activeCinematic) return;
  // Respawn any players that were hidden during the cinematic at a safe position
  if (activeCinematic.hidePlayers && typeof players !== 'undefined' && typeof pickSafeSpawn === 'function') {
    for (const idx of activeCinematic.hidePlayers) {
      const p = players[idx];
      if (p && p.health > 0) {
        const spawn = pickSafeSpawn(idx === 0 ? 'left' : 'right');
        p.x  = spawn.x - p.w / 2;
        p.y  = spawn.y - p.h;
        p.vx = 0;
        p.vy = 0;
      }
    }
  }
  if (activeCinematic.onEnd) activeCinematic.onEnd();
  activeCinematic = null;
  isCinematic = false;
  if (typeof clearCombatLock === 'function') clearCombatLock('cinematic');
  slowMotion = 1.0;
  cinematicCamOverride = false;
  gameFrozen = false; // resume physics and input
}

// ============================================================
// CINEMATIC SEQUENCES — one factory per boss × phase
// ============================================================
function _makeBossPhase2Cinematic(boss) {
  return {
    durationFrames: 150, // 2.5 s
    _slamFired: false, _roarFired: false,
    _phaseLabel: { text: '— PHASE II —', color: '#cc00ee' },
    update(t) {
      // Slow motion ramp: 0.15× during cinematic, fade out at end
      if (t < 0.4)      slowMotion = Math.max(0.15, 1 - t * 2.1);
      else if (t > 1.8) slowMotion = Math.min(1.0, (t - 1.8) / 0.7);
      else              slowMotion = 0.15;

      // Camera zoom in on boss
      cinematicCamOverride = t < 2.2;
      if (cinematicCamOverride && boss) {
        cinematicZoomTarget = 1 + Math.min(0.55, t * 0.4);
        cinematicFocusX = boss.cx();
        cinematicFocusY = boss.cy();
      }

      // 0.6 s: slam — rings + particles + player knockback
      if (t >= 0.6 && !this._slamFired) {
        this._slamFired = true;
        if (boss) {
          for (let i = 0; i < 5; i++) {
            phaseTransitionRings.push({ cx: boss.cx(), cy: boss.cy(),
              r: 5 + i*14, maxR: 240 + i*30, timer: 65+i*11, maxTimer: 65+i*11,
              color: i%2===0 ? '#cc00ee' : '#ff44ff', lineWidth: 4-i*0.5 });
          }
          spawnParticles(boss.cx(), boss.cy(), '#cc00ee', 40);
          spawnParticles(boss.cx(), boss.cy(), '#ffffff', 25);
          spawnParticles(boss.cx(), boss.cy(), '#ff44ff', 18);
          screenShake = Math.max(screenShake, 32);
          for (const p of players) {
            if (p.isBoss || p.health <= 0) continue;
            const dir = p.cx() >= boss.cx() ? 1 : -1;
            p.vx += dir * 13; p.vy = Math.min(p.vy, -9);
            p.hurtTimer = Math.max(p.hurtTimer, 16);
          }
        }
      }
      // 1.05 s: dialogue
      if (t >= 1.05 && !this._roarFired) {
        this._roarFired = true;
        showBossDialogue('I was being patient. That ends now.', 220);
      }
    },
    onEnd() { slowMotion = 1.0; cinematicCamOverride = false; }
  };
}

function _makeBossPhase3Cinematic(boss) {
  return {
    durationFrames: 180, // 3.0 s
    _slamFired: false, _roarFired: false,
    _phaseLabel: { text: '— PHASE III —', color: '#ff44aa' },
    update(t) {
      if (t < 0.3)      slowMotion = Math.max(0.05, 1 - t * 3.2);
      else if (t > 2.2) slowMotion = Math.min(1.0, (t - 2.2) / 0.8);
      else              slowMotion = 0.05;

      cinematicCamOverride = t < 2.6;
      if (cinematicCamOverride && boss) {
        cinematicZoomTarget = Math.min(1.8, 1 + t * 0.55);
        cinematicFocusX = boss.cx();
        cinematicFocusY = boss.cy();
      }

      if (t >= 0.55 && !this._slamFired) {
        this._slamFired = true;
        if (boss) {
          for (let i = 0; i < 6; i++) {
            phaseTransitionRings.push({ cx: boss.cx(), cy: boss.cy(),
              r: 5+i*12, maxR: 340+i*30, timer: 70+i*12, maxTimer: 70+i*12,
              color: i%2===0 ? '#cc00ee' : '#ff0077', lineWidth: 5-i*0.6 });
          }
          spawnParticles(boss.cx(), boss.cy(), '#cc00ee', 55);
          spawnParticles(boss.cx(), boss.cy(), '#ffffff', 35);
          spawnParticles(boss.cx(), boss.cy(), '#ff0000', 22);
          screenShake = Math.max(screenShake, 48);
          if (settings.phaseFlash) bossPhaseFlash = 70;
          for (const p of players) {
            if (p.isBoss || p.health <= 0) continue;
            const dir = p.cx() >= boss.cx() ? 1 : -1;
            p.vx += dir * 20; p.vy = Math.min(p.vy, -14);
            p.hurtTimer = Math.max(p.hurtTimer, 22);
          }
        }
      }
      if (t >= 1.2 && !this._roarFired) {
        this._roarFired = true;
        showBossDialogue('Now you see why I built this world.', 250);
      }
    },
    onEnd() { slowMotion = 1.0; cinematicCamOverride = false; }
  };
}

function _makeTFPhase2Cinematic(tf) {
  return {
    durationFrames: 150, // 2.5 s
    _burstFired: false, _roarFired: false,
    _phaseLabel: { text: '— FORM II —', color: '#aaaaaa' },
    update(t) {
      if (t < 0.35)     slowMotion = Math.max(0.1, 1 - t * 2.6);
      else if (t > 1.8) slowMotion = Math.min(1.0, (t - 1.8) / 0.7);
      else              slowMotion = 0.1;

      cinematicCamOverride = t < 2.1;
      if (cinematicCamOverride && tf) {
        cinematicZoomTarget = Math.min(1.5, 1 + t * 0.4);
        cinematicFocusX = tf.cx(); cinematicFocusY = tf.cy();
      }

      if (t >= 0.65 && !this._burstFired) {
        this._burstFired = true;
        if (tf) {
          for (let i = 0; i < 5; i++) {
            phaseTransitionRings.push({ cx: tf.cx(), cy: tf.cy(),
              r: 5+i*13, maxR: 260+i*28, timer: 62+i*11, maxTimer: 62+i*11,
              color: i%2===0 ? '#ffffff' : '#888888', lineWidth: 4-i*0.5 });
          }
          spawnParticles(tf.cx(), tf.cy(), '#ffffff', 45);
          spawnParticles(tf.cx(), tf.cy(), '#000000', 30);
          spawnParticles(tf.cx(), tf.cy(), '#aaaaaa', 20);
          screenShake = Math.max(screenShake, 36);
          for (const p of players) {
            if (p.isBoss || p.health <= 0) continue;
            const dir = p.cx() >= tf.cx() ? 1 : -1;
            p.vx += dir * 14; p.vy = Math.min(p.vy, -10);
            p.hurtTimer = Math.max(p.hurtTimer, 18);
          }
        }
      }
      if (t >= 1.1 && !this._roarFired) {
        this._roarFired = true;
        showBossDialogue('You surprised me. That almost never happens.', 250);
      }
    },
    onEnd() { slowMotion = 1.0; cinematicCamOverride = false; }
  };
}

function _makeTFPhase3Cinematic(tf) {
  return {
    durationFrames: 210, // 3.5 s
    _voidFired: false, _roarFired: false,
    _phaseLabel: { text: '— TRUE FORM —', color: '#ffffff' },
    update(t) {
      if (t < 0.25)     slowMotion = Math.max(0.02, 1 - t * 3.9);
      else if (t > 2.7) slowMotion = Math.min(1.0, (t - 2.7) / 0.8);
      else              slowMotion = 0.02;

      cinematicCamOverride = t < 3.1;
      if (cinematicCamOverride && tf) {
        cinematicZoomTarget = Math.min(2.0, 1 + t * 0.55);
        cinematicFocusX = tf.cx(); cinematicFocusY = tf.cy();
      }

      if (t >= 0.5 && !this._voidFired) {
        this._voidFired = true;
        if (tf) {
          for (let i = 0; i < 7; i++) {
            phaseTransitionRings.push({ cx: tf.cx(), cy: tf.cy(),
              r: 5+i*10, maxR: 400+i*22, timer: 72+i*13, maxTimer: 72+i*13,
              color: i%2===0 ? '#ffffff' : '#000000', lineWidth: 5-i*0.5 });
          }
          spawnParticles(tf.cx(), tf.cy(), '#ffffff', 65);
          spawnParticles(tf.cx(), tf.cy(), '#000000', 50);
          spawnParticles(tf.cx(), tf.cy(), '#555555', 28);
          screenShake = Math.max(screenShake, 55);
          if (settings.phaseFlash) bossPhaseFlash = 80;
          for (const p of players) {
            if (p.isBoss || p.health <= 0) continue;
            const dir = p.cx() >= tf.cx() ? 1 : -1;
            p.vx += dir * 24; p.vy = Math.min(p.vy, -18);
            p.hurtTimer = Math.max(p.hurtTimer, 25);
          }
        }
      }
      if (t >= 1.5 && !this._roarFired) {
        this._roarFired = true;
        showBossDialogue('No more fractions. All of it.', 280);
      }
    },
    onEnd() { slowMotion = 1.0; cinematicCamOverride = false; }
  };
}

// ============================================================
// CINEMATIC SEQUENCES — ForestBeast and Yeti
// ============================================================
function _makeBeastPhase2Cinematic(beast) {
  return {
    durationFrames: 150, // 2.5 s
    _rageFired: false, _roarFired: false,
    _phaseLabel: { text: '— BEAST UNLEASHED —', color: '#cc4400' },
    update(t) {
      // Slow motion: slam on slow-mo, fade back at end
      if (t < 0.3)      slowMotion = Math.max(0.15, 1 - t * 3.0);
      else if (t > 1.8) slowMotion = Math.min(1.0,  (t - 1.8) / 0.7);
      else              slowMotion = 0.15;

      // Camera zoom to beast
      cinematicCamOverride = t < 2.2;
      if (cinematicCamOverride && beast) {
        cinematicZoomTarget = Math.min(1.6, 1 + t * 0.45);
        cinematicFocusX = beast.cx();
        cinematicFocusY = beast.cy();
      }

      // 0.5 s: ground slam — rings + particles + knockback
      if (t >= 0.5 && !this._rageFired) {
        this._rageFired = true;
        if (beast) {
          for (let i = 0; i < 5; i++) {
            phaseTransitionRings.push({
              cx: beast.cx(), cy: beast.cy(),
              r: 5 + i * 12, maxR: 260 + i * 28,
              timer: 65 + i * 11, maxTimer: 65 + i * 11,
              color: i % 2 === 0 ? '#cc4400' : '#ff8800', lineWidth: 4 - i * 0.5
            });
          }
          spawnParticles(beast.cx(), beast.cy(), '#cc4400', 40);
          spawnParticles(beast.cx(), beast.cy(), '#ff8800', 25);
          spawnParticles(beast.cx(), beast.cy(), '#ffff00', 12);
          screenShake = Math.max(screenShake, 35);
          for (const p of players) {
            if (p.health <= 0) continue;
            const dir = p.cx() >= beast.cx() ? 1 : -1;
            p.vx += dir * 11;  p.vy = Math.min(p.vy, -8);
            p.hurtTimer = Math.max(p.hurtTimer, 14);
          }
        }
      }
      // 1.0 s: roar text
      if (t >= 1.0 && !this._roarFired) {
        this._roarFired = true;
        if (settings.dmgNumbers && beast)
          damageTexts.push(new DamageText(beast.cx(), beast.y - 30, 'RAAAWR!', '#ff6600'));
      }
    },
    onEnd() { slowMotion = 1.0; cinematicCamOverride = false; }
  };
}

function _makeYetiPhase2Cinematic(yetiEnt) {
  return {
    durationFrames: 180, // 3.0 s
    _leapFired: false, _slamFired: false, _roarFired: false,
    _phaseLabel: { text: '— BLIZZARD RAGE —', color: '#88ccff' },
    update(t) {
      if (t < 0.3)      slowMotion = Math.max(0.10, 1 - t * 3.1);
      else if (t > 2.2) slowMotion = Math.min(1.0,  (t - 2.2) / 0.8);
      else              slowMotion = 0.10;

      // Camera zoom to yeti
      cinematicCamOverride = t < 2.6;
      if (cinematicCamOverride && yetiEnt) {
        cinematicZoomTarget = Math.min(1.7, 1 + t * 0.48);
        cinematicFocusX = yetiEnt.cx();
        cinematicFocusY = yetiEnt.cy();
      }

      // 0.5 s: yeti leaps upward
      if (t >= 0.5 && !this._leapFired) {
        this._leapFired = true;
        if (yetiEnt) yetiEnt.vy = Math.min(yetiEnt.vy, -22);
      }

      // 1.2 s: slam down + ice shockwave
      if (t >= 1.2 && !this._slamFired) {
        this._slamFired = true;
        if (yetiEnt) {
          yetiEnt.vy = Math.max(yetiEnt.vy, 18); // force downward
          for (let i = 0; i < 6; i++) {
            phaseTransitionRings.push({
              cx: yetiEnt.cx(), cy: yetiEnt.cy(),
              r: 5 + i * 12, maxR: 300 + i * 30,
              timer: 68 + i * 12, maxTimer: 68 + i * 12,
              color: i % 2 === 0 ? '#88ccff' : '#ffffff', lineWidth: 4.5 - i * 0.5
            });
          }
          spawnParticles(yetiEnt.cx(), yetiEnt.cy(), '#aaddff', 50);
          spawnParticles(yetiEnt.cx(), yetiEnt.cy(), '#ffffff', 30);
          spawnParticles(yetiEnt.cx(), yetiEnt.cy(), '#0066ff', 18);
          screenShake = Math.max(screenShake, 42);
          if (settings.phaseFlash) bossPhaseFlash = 55;
          for (const p of players) {
            if (p.health <= 0) continue;
            const dir = p.cx() >= yetiEnt.cx() ? 1 : -1;
            p.vx += dir * 16;  p.vy = Math.min(p.vy, -12);
            p.stunTimer  = Math.max(p.stunTimer  || 0, 40);
            p.hurtTimer  = Math.max(p.hurtTimer, 18);
          }
        }
      }
      // 1.8 s: roar text
      if (t >= 1.8 && !this._roarFired) {
        this._roarFired = true;
        if (settings.dmgNumbers && yetiEnt)
          damageTexts.push(new DamageText(yetiEnt.cx(), yetiEnt.y - 35, 'BLIZZARD!', '#aaddff'));
      }
    },
    onEnd() { slowMotion = 1.0; cinematicCamOverride = false; }
  };
}

// ============================================================
// MID-FIGHT CINEMATICS — see js/smc-cinematics.js for all 6 factory fns
// ============================================================
// _makeBossWarning75Cinematic, _makeBossRage40Cinematic, _makeBossDesp10Cinematic,
// _makeTFEntryCinematic, _makeTFReality50Cinematic, _makeTFDesp15Cinematic
// are all defined in smc-cinematics.js using the cinScript() API.
/* DELETED OLD IMPLEMENTATIONS BELOW — kept as dead code marker only */
function _DELETED_makeBossWarning75Cinematic(boss) {
  return {
    durationFrames: 180, // 3 s
    _warnFired: false, _line1Fired: false, _line2Fired: false,
    _phaseLabel: { text: '— MY WORLD —', color: '#cc00ee' },
    update(t) {
      if (t < 0.3)      slowMotion = Math.max(0.18, 1 - t * 2.7);
      else if (t > 2.2) slowMotion = Math.min(1.0, (t - 2.2) / 0.8);
      else              slowMotion = 0.18;

      cinematicCamOverride = t < 2.6;
      if (cinematicCamOverride && boss) {
        cinematicZoomTarget = Math.min(1.4, 1 + t * 0.28);
        cinematicFocusX = boss.cx();
        cinematicFocusY = boss.cy() - 30 * Math.min(1, t * 1.2); // camera drifts upward
      }

      // 0.5 s: boss floats upward + rings + hazard warning begins
      if (t >= 0.5 && !this._warnFired) {
        this._warnFired = true;
        if (boss) {
          boss.vy = Math.min(boss.vy, -14); // float upward
          for (let i = 0; i < 4; i++) {
            phaseTransitionRings.push({ cx: boss.cx(), cy: boss.cy(),
              r: 8 + i * 18, maxR: 200 + i * 40, timer: 60 + i * 12, maxTimer: 60 + i * 12,
              color: i % 2 === 0 ? '#aa00cc' : '#ff88ff', lineWidth: 3.5 - i * 0.5 });
          }
          spawnParticles(boss.cx(), boss.cy(), '#cc00ee', 30);
          spawnParticles(boss.cx(), boss.cy(), '#ffffff', 18);
          screenShake = Math.max(screenShake, 22);
          // Trigger arena hazard warning early
          if (typeof bossFloorState !== 'undefined' && bossFloorState === 'normal') {
            bossFloorState = 'warning';
            bossFloorTimer = BOSS_FLOOR_WARNING_FRAMES;
            bossFloorType  = Math.random() < 0.5 ? 'lava' : 'void';
          }
        }
      }
      if (t >= 0.9 && !this._line1Fired) {
        this._line1Fired = true;
        showBossDialogue('This world obeys me. So does this fight.', 200);
      }
      if (t >= 1.8 && !this._line2Fired) {
        this._line2Fired = true;
        showBossDialogue('And I designed it breakable.', 200);
      }
    },
    onEnd() { slowMotion = 1.0; cinematicCamOverride = false; }
  };
}

function _DELETED_makeBossRage40Cinematic(boss) {
  return {
    durationFrames: 240, // 4 s
    _grabFired: false, _slamFired: false, _line1Fired: false, _line2Fired: false,
    _throwTarget: null,
    _phaseLabel: { text: '— ENOUGH. —', color: '#ff0044' },
    update(t) {
      // Phase 1 (0–0.4s): freeze into the moment
      // Phase 2 (0.4–1.1s): speed up so the throw VISUALLY travels across the screen
      // Phase 3 (1.1–1.6s): freeze for impact / slam
      // Phase 4 (1.6–3.5s): slow crawl for dialogue, then ramp back
      if      (t < 0.4)  slowMotion = Math.max(0.05, 1 - t * 2.4);   // ramp down to near-freeze
      else if (t < 1.1)  slowMotion = Math.min(0.55, (t - 0.4) * 0.8); // ramp UP — throw is visible
      else if (t < 1.6)  slowMotion = Math.max(0.05, 0.55 - (t - 1.1) * 1.1); // freeze for slam impact
      else if (t > 3.7)  slowMotion = Math.min(1.0, (t - 3.7) / 0.3);
      else               slowMotion = 0.06;                              // crawl for dialogue

      cinematicCamOverride = t < 3.9;
      if (cinematicCamOverride && boss) {
        const trackTarget = this._throwTarget || players.find(p => !p.isBoss && p.health > 0);
        // During throw (0.4–1.1s) follow the flying player; otherwise focus between boss & player
        const focusX = (t >= 0.4 && t < 1.2 && trackTarget)
          ? trackTarget.cx()
          : trackTarget ? (boss.cx() + trackTarget.cx()) * 0.5 : boss.cx();
        cinematicZoomTarget = t < 0.4 ? Math.min(1.8, 1 + t * 2.0)  // zoom in fast
                            : t < 1.1 ? Math.max(0.9, 1.8 - (t - 0.4) * 1.3) // zoom out to follow throw
                            : Math.min(1.5, 0.9 + (t - 1.1) * 0.8);
        cinematicFocusX = focusX;
        cinematicFocusY = trackTarget ? trackTarget.cy() : boss.cy();
      }

      // 0.4 s: boss teleports directly behind player and hurls them
      if (t >= 0.4 && !this._grabFired) {
        this._grabFired = true;
        const target = players.find(p => !p.isBoss && p.health > 0);
        if (boss && target) {
          this._throwTarget = target;
          // Teleport boss right behind the player (same side as their back)
          const facingRight = target.vx >= 0;
          const behindX = facingRight ? target.cx() - 55 : target.cx() + 55;
          boss.x = behindX - boss.w / 2;
          boss.y = target.y;
          boss.vy = 0;
          spawnParticles(boss.cx(), boss.cy(), '#cc00ee', 35);
          spawnParticles(boss.cx(), boss.cy(), '#ff44ff', 20);
          spawnParticles(target.cx(), target.cy(), '#ff0044', 20);
          screenShake = Math.max(screenShake, 22);
          // Throw: opposite direction to behind offset, arc upward
          const throwDir = facingRight ? 1 : -1;
          target.vx = throwDir * 22;
          target.vy = -14;
          target.hurtTimer = Math.max(target.hurtTimer, 35);
          target.stunTimer  = Math.max(target.stunTimer || 0, 30); // brief stun so player can't air-dodge
        }
      }

      // 1.1 s: boss slam hits the ground as player lands — shockwave
      if (t >= 1.1 && !this._slamFired) {
        this._slamFired = true;
        if (boss) {
          boss.vy = 28;
          const slamX = this._throwTarget ? (boss.cx() + this._throwTarget.cx()) * 0.5 : boss.cx();
          for (let i = 0; i < 6; i++) {
            phaseTransitionRings.push({ cx: slamX, cy: GAME_H - 60,
              r: 5 + i * 18, maxR: 320 + i * 40, timer: 70 + i * 12, maxTimer: 70 + i * 12,
              color: i % 2 === 0 ? '#ff0044' : '#ff8800', lineWidth: 4.5 - i * 0.5 });
          }
          spawnParticles(slamX, GAME_H - 60, '#ff0044', 55);
          spawnParticles(slamX, GAME_H - 60, '#ffffff', 30);
          screenShake = Math.max(screenShake, 52);
          for (const p of players) {
            if (p.isBoss || p.health <= 0) continue;
            const dir = p.cx() >= slamX ? 1 : -1;
            p.vx += dir * 14; p.vy = Math.min(p.vy, -10);
            p.hurtTimer = Math.max(p.hurtTimer, 18);
          }
        }
      }

      if (t >= 1.5 && !this._line1Fired) {
        this._line1Fired = true;
        showBossDialogue('Enough.', 140);
      }
      if (t >= 2.2 && !this._line2Fired) {
        this._line2Fired = true;
        showBossDialogue('I will ERASE you.', 220);
      }
    },
    onEnd() { slowMotion = 1.0; cinematicCamOverride = false; }
  };
}

function _DELETED_makeBossDesp10Cinematic(boss) {
  return {
    durationFrames: 180, // 3 s
    _staggerFired: false, _despFired: false, _line1Fired: false, _line2Fired: false,
    _phaseLabel: { text: '— IMPOSSIBLE —', color: '#ffffff' },
    update(t) {
      if (t < 0.2)      slowMotion = Math.max(0.04, 1 - t * 4.8);
      else if (t > 2.2) slowMotion = Math.min(1.0, (t - 2.2) / 0.8);
      else              slowMotion = 0.04;

      cinematicCamOverride = t < 2.6;
      if (cinematicCamOverride && boss) {
        cinematicZoomTarget = Math.min(1.85, 1 + t * 0.55);
        cinematicFocusX = boss.cx();
        cinematicFocusY = boss.cy();
      }

      // 0.35 s: boss staggers visually — shake + rings
      if (t >= 0.35 && !this._staggerFired) {
        this._staggerFired = true;
        if (boss) {
          boss.hurtTimer = 30;
          boss.stunTimer = 18;
          boss.vx *= 0.1;
          for (let i = 0; i < 6; i++) {
            phaseTransitionRings.push({ cx: boss.cx(), cy: boss.cy(),
              r: 8 + i * 12, maxR: 180 + i * 25, timer: 55 + i * 10, maxTimer: 55 + i * 10,
              color: i % 2 === 0 ? '#ffffff' : '#ff4444', lineWidth: 3 - i * 0.35 });
          }
          spawnParticles(boss.cx(), boss.cy(), '#ffffff', 50);
          spawnParticles(boss.cx(), boss.cy(), '#ff0000', 32);
          spawnParticles(boss.cx(), boss.cy(), '#cc00ee', 20);
          screenShake = Math.max(screenShake, 40);
          if (settings.phaseFlash) bossPhaseFlash = 60;
        }
      }

      // 1.0 s: activate desperation mode
      if (t >= 1.0 && !this._despFired) {
        this._despFired = true;
        bossDesperationMode  = true;
        bossDesperationFlash = 90;
        if (boss) {
          bossStaggerTimer = 0; // end stagger so it can fight
        }
      }

      if (t >= 0.8 && !this._line1Fired) {
        this._line1Fired = true;
        showBossDialogue('Impossible...', 200);
      }
      if (t >= 1.5 && !this._line2Fired) {
        this._line2Fired = true;
        showBossDialogue('You refuse to break!', 220);
      }
    },
    onEnd() { slowMotion = 1.0; cinematicCamOverride = false; }
  };
}

// ============================================================
// MID-FIGHT CINEMATICS — True Form (entry, 50%, 15%)
// ============================================================
function _DELETED_makeTFEntryCinematic(tf) {
  return {
    durationFrames: 240, // 4 s
    _burstFired: false, _line1Fired: false, _line2Fired: false,
    _phaseLabel: { text: '— TRUE FORM —', color: '#ffffff' },
    update(t) {
      if (t < 0.3)      slowMotion = Math.max(0.08, 1 - t * 3.1);
      else if (t > 3.1) slowMotion = Math.min(1.0, (t - 3.1) / 0.9);
      else              slowMotion = 0.08;

      cinematicCamOverride = t < 3.6;
      if (cinematicCamOverride && tf) {
        cinematicZoomTarget = Math.min(1.65, 1 + t * 0.38);
        cinematicFocusX = tf.cx();
        cinematicFocusY = tf.cy();
      }

      // 0.6 s: energy burst pushes players, rings expand
      if (t >= 0.6 && !this._burstFired) {
        this._burstFired = true;
        if (tf) {
          for (let i = 0; i < 6; i++) {
            phaseTransitionRings.push({ cx: tf.cx(), cy: tf.cy(),
              r: 5 + i * 14, maxR: 320 + i * 30, timer: 68 + i * 12, maxTimer: 68 + i * 12,
              color: i % 2 === 0 ? '#ffffff' : '#333333', lineWidth: 4 - i * 0.5 });
          }
          spawnParticles(tf.cx(), tf.cy(), '#ffffff', 55);
          spawnParticles(tf.cx(), tf.cy(), '#000000', 40);
          spawnParticles(tf.cx(), tf.cy(), '#888888', 25);
          screenShake = Math.max(screenShake, 38);
          if (settings.phaseFlash) bossPhaseFlash = 55;
          for (const p of players) {
            if (p.isBoss || p.health <= 0) continue;
            const dir = p.cx() >= tf.cx() ? 1 : -1;
            p.vx += dir * 18; p.vy = Math.min(p.vy, -11);
            p.hurtTimer = Math.max(p.hurtTimer, 20);
          }
        }
      }
      if (t >= 1.2 && !this._line1Fired) {
        this._line1Fired = true;
        showBossDialogue('You forced my hand.', 220);
      }
      if (t >= 2.1 && !this._line2Fired) {
        this._line2Fired = true;
        showBossDialogue('Witness my TRUE POWER.', 240);
      }
    },
    onEnd() { slowMotion = 1.0; cinematicCamOverride = false; }
  };
}

function _DELETED_makeTFReality50Cinematic(tf) {
  return {
    durationFrames: 210, // 3.5 s
    _gravFired: false, _stormFired: false, _lineFired: false,
    _phaseLabel: { text: '— REALITY BENDS —', color: '#cccccc' },
    update(t) {
      if (t < 0.3)      slowMotion = Math.max(0.12, 1 - t * 2.9);
      else if (t > 2.4) slowMotion = Math.min(1.0, (t - 2.4) / 1.1);
      else              slowMotion = 0.12;

      cinematicCamOverride = t < 3.2;
      if (cinematicCamOverride && tf) {
        // Slowly zoom out to show whole arena
        cinematicZoomTarget = Math.max(0.7, 1.4 - t * 0.22);
        cinematicFocusX = GAME_W / 2;
        cinematicFocusY = GAME_H / 2;
      }

      // 0.5 s: gravity reverses briefly — players float
      if (t >= 0.5 && !this._gravFired) {
        this._gravFired = true;
        tfGravityInverted = true;
        tfGravityTimer    = 180; // 3 s of inverted gravity
        gravityState.active = true; gravityState.type = 'reverse'; gravityState.timer = 0; gravityState.maxTimer = 180;
        if (tf) {
          for (let i = 0; i < 5; i++) {
            phaseTransitionRings.push({ cx: tf.cx(), cy: tf.cy(),
              r: 6 + i * 15, maxR: 280 + i * 32, timer: 64 + i * 11, maxTimer: 64 + i * 11,
              color: i % 2 === 0 ? '#ffffff' : '#666666', lineWidth: 3.5 - i * 0.5 });
          }
          spawnParticles(tf.cx(), tf.cy(), '#ffffff', 40);
          spawnParticles(tf.cx(), tf.cy(), '#888888', 28);
          screenShake = Math.max(screenShake, 34);
        }
      }

      if (t >= 0.9 && !this._lineFired) {
        this._lineFired = true;
        showBossDialogue('Reality... bends to me.', 230);
      }

      // 2.0 s: trigger meteor storm special for TrueForm
      if (t >= 2.0 && !this._stormFired) {
        this._stormFired = true;
        if (tf && typeof tf._doSpecial === 'function') {
          const target = players.find(p => !p.isBoss && p.health > 0);
          if (target) tf._doSpecial('meteorCrash', target);
        }
      }
    },
    onEnd() { slowMotion = 1.0; cinematicCamOverride = false; }
  };
}

function _DELETED_makeTFDesp15Cinematic(tf) {
  return {
    durationFrames: 180, // 3 s
    _crackFired: false, _despFired: false, _lineFired: false,
    _phaseLabel: { text: '— WE FALL TOGETHER —', color: '#ffffff' },
    update(t) {
      if (t < 0.2)      slowMotion = Math.max(0.03, 1 - t * 4.9);
      else if (t > 2.1) slowMotion = Math.min(1.0, (t - 2.1) / 0.9);
      else              slowMotion = 0.03;

      cinematicCamOverride = t < 2.7;
      if (cinematicCamOverride && tf) {
        cinematicZoomTarget = Math.min(2.0, 1 + t * 0.65);
        cinematicFocusX = tf.cx();
        cinematicFocusY = tf.cy();
      }

      // 0.3 s: massive rings, flash, arena destabilises
      if (t >= 0.3 && !this._crackFired) {
        this._crackFired = true;
        if (tf) {
          for (let i = 0; i < 7; i++) {
            phaseTransitionRings.push({ cx: tf.cx(), cy: tf.cy(),
              r: 5 + i * 11, maxR: 380 + i * 24, timer: 70 + i * 14, maxTimer: 70 + i * 14,
              color: i % 2 === 0 ? '#ffffff' : '#000000', lineWidth: 5 - i * 0.6 });
          }
          spawnParticles(tf.cx(), tf.cy(), '#ffffff', 70);
          spawnParticles(tf.cx(), tf.cy(), '#000000', 55);
          spawnParticles(tf.cx(), tf.cy(), '#555555', 30);
          screenShake = Math.max(screenShake, 55);
          if (settings.phaseFlash) bossPhaseFlash = 85;
          for (const p of players) {
            if (p.isBoss || p.health <= 0) continue;
            const dir = p.cx() >= tf.cx() ? 1 : -1;
            p.vx += dir * 22; p.vy = Math.min(p.vy, -16);
            p.hurtTimer = Math.max(p.hurtTimer, 24);
          }
        }
      }

      // 1.2 s: activate desperation + remove floor + trigger hazards
      if (t >= 1.2 && !this._despFired) {
        this._despFired = true;
        bossDesperationMode  = true;
        bossDesperationFlash = 90;
        // Remove floor for dramatic effect
        if (!tfFloorRemoved) {
          tfFloorRemoved = true;
          tfFloorTimer   = 600; // 10 s
          const floorPl  = currentArena && currentArena.platforms.find(p => p.isFloor);
          if (floorPl) floorPl.isFloorDisabled = true;
          showBossDialogue('The floor was never yours to keep.', 160);
        }
        // Spawn black holes at both sides
        tfBlackHoles.push({ x: 120, y: 260, r: 110, timer: 480, maxTimer: 480, strength: 5 });
        tfBlackHoles.push({ x: 780, y: 260, r: 110, timer: 480, maxTimer: 480, strength: 5 });
      }

      if (t >= 0.7 && !this._lineFired) {
        this._lineFired = true;
        showBossDialogue('Then we fall TOGETHER!', 250);
      }
    },
    onEnd() { slowMotion = 1.0; cinematicCamOverride = false; }
  };
}

// ============================================================
// PHASE TRANSITION — triggers appropriate cinematic sequence
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
function updateTFPendingAttacks() {
  if (!gameRunning) return;
  const tf = players.find(p => p.isTrueForm);

  for (let i = tfAttackRetryQueue.length - 1; i >= 0; i--) {
    const job = tfAttackRetryQueue[i];
    job.framesLeft--;
    if (job.framesLeft > 0) continue;
    const target = job.targetRef && job.targetRef.health > 0 ? job.targetRef : players.find(p => !p.isBoss && p.health > 0);
    const ok = job.ctx && typeof job.ctx._doSpecial === 'function' ? job.ctx._doSpecial(job.move, target) : false;
    if (ok || job.attempts >= 4) {
      if (!ok) console.warn(`[TrueFormAttack:${job.source}] retry failed for "${job.move}"`);
      tfAttackRetryQueue.splice(i, 1);
    } else {
      job.attempts++;
      job.framesLeft = 12;
    }
  }

  if (!tf || tf.health <= 0) return;
  if (tf._wallComboTimer > 0) tf._wallComboTimer--;
  if (tf._antiRangedCooldown > 0) tf._antiRangedCooldown--;
  if (tf._antiRangedDashCd > 0) tf._antiRangedDashCd--;
  if (tf._antiRangedPulse > 0) tf._antiRangedPulse--;
  if (tf._antiRangedTimer > 0) {
    tf._antiRangedTimer--;
    const pullRadius = tf._antiRangedFieldR + 55;
    for (const p of players) {
      if (p.isBoss || p.health <= 0) continue;
      const dx = tf.cx() - p.cx();
      const dy = tf.cy() - p.cy();
      const dd = Math.hypot(dx, dy) || 1;
      if (dd < pullRadius) {
        const movingAway = Math.sign(p.vx || 0) === -Math.sign(dx) && Math.abs(p.vx || 0) > 1.1;
        const pull = (movingAway ? 1.10 : 0.62) * (1 - dd / pullRadius);
        p.vx += (dx / dd) * pull;
        p.vy += (dy / dd) * pull * 0.22;
      }
    }
    if (tf._antiRangedTimer <= 0) {
      tf._antiRangedStats.projectiles = 0;
      tf._antiRangedStats.rangedDamage = 0;
      tf._antiRangedStats.farTicks = 0;
    }
  }
  if (tf._tfAttackState && tf._tfAttackState.timer > 0) {
    tf._tfAttackState.timer--;
    if (tf._tfAttackState.timer <= 0) {
      if (tf._tfAttackState.phase === 'recovery') {
        tf._finishAttackState();
      } else if (tf._tfAttackState.phase === 'start' && tf._tfAttackState.locked) {
        // Telegraph window expired — release the lock so follow-up moves can fire
        tf._tfAttackState.locked = false;
      }
    }
  }

  // ── Tick bossWarnings (so telegraph circles disappear) ────
  for (let i = bossWarnings.length - 1; i >= 0; i--) {
    bossWarnings[i].timer--;
    if (bossWarnings[i].timer <= 0) bossWarnings.splice(i, 1);
  }

  // ── Stagger ────────────────────────────────────────────────
  const dmgThisFrame = (tf._prevHealth || tf.health) - tf.health;
  if (dmgThisFrame > 0) {
    bossStaggerDmg   += dmgThisFrame;
    bossStaggerDecay  = 180;
  }
  tf._prevHealth = tf.health;
  if (bossStaggerDecay > 0) {
    bossStaggerDecay--;
    if (bossStaggerDecay <= 0) bossStaggerDmg = 0;
  }
  if (bossStaggerDmg >= 150 && bossStaggerTimer <= 0) {
    bossStaggerTimer = 150;
    bossStaggerDmg   = 0;
    bossStaggerDecay = 0;
    screenShake = Math.max(screenShake, 25);
    showBossDialogue(randChoice(['...noted.', 'You hit like you mean it.', 'That was unexpected. I respect it.']), 120);
    spawnParticles(tf.cx(), tf.cy(), '#ffffff', 22);
    if (typeof directorAddIntensity === 'function') directorAddIntensity(0.4);
  }
  if (bossStaggerTimer > 0) {
    bossStaggerTimer--;
    tf.vx *= 0.85;
    if (bossStaggerTimer === 0) {
      showBossDialogue(randChoice(['That was the last one you get free.', 'I don\'t fall.', 'We\'re past the warm-up.']), 120);
    }
  }

  // ── Desperation mode ──────────────────────────────────────
  if (!bossDesperationMode && tf.health / tf.maxHealth < 0.25) {
    bossDesperationMode  = true;
    bossDesperationFlash = 90;
    screenShake = Math.max(screenShake, 30);
    showBossDialogue('You\'ve earned the last of me. I hope it was worth asking for.', 300);
    spawnParticles(tf.cx(), tf.cy(), '#ffffff', 50);
    spawnParticles(tf.cx(), tf.cy(), '#000000', 30);
    if (typeof directorAddIntensity === 'function') directorAddIntensity(0.8);
  }

  // ── Pending Reality Slash ─────────────────────────────────
  if (tf._pendingSlash) {
    tf._pendingSlash.timer--;
    if (tf._pendingSlash.timer <= 0) {
      const tgt = tf._pendingSlash.target;
      const behindOff = tf._pendingSlash.behindOff;
      const landed = _bossTeleportActor(tf, tgt.cx() + behindOff, tgt.y, { preferRaised: true, sideBias: Math.sign(behindOff) || 1 });
      if (!landed) {
        tf._pendingSlash = null;
        tf._finishAttackState('slash');
        return;
      }
      tf.facing = (tgt.cx() > tf.cx() ? 1 : -1);
      tf._setAttackPhase('active', 4, true);
      spawnParticles(tf.cx(), tf.cy(), '#ffffff', 20);
      spawnParticles(tf.cx(), tf.cy(), '#000000', 12);
      screenShake = Math.max(screenShake, 12);
      dealDamage(tf, tgt, 18, 10);
      for (const p of players) {
        if (p.isBoss || p.health <= 0) continue;
        const sdx = p.cx() - tf.cx();
        if (Math.abs(sdx) < 220) {
          p.vx += (sdx > 0 ? 1 : -1) * 9;
          if (p !== tgt) dealDamage(tf, p, 6, 5);
        }
      }
      tf._pendingSlash = null;
      tf._setAttackPhase('recovery', 20, false);
    }
  }

  // ── Pending Teleport Combo ─────────────────────────────────
  if (tf._pendingTeleportCombo) {
    const tc = tf._pendingTeleportCombo;
    tc.timer--;
    if (tc.timer <= 0 && tc.hits > 0) {
      const tgt = tc.target;
      if (tgt && tgt.health > 0) {
        // Teleport to alternating sides of the player
        const side   = tc.hits % 2 === 0 ? 1 : -1;
        const offset = side * (45 + Math.random() * 25);
        const landed = _bossTeleportActor(tf, tgt.cx() + offset, tgt.y, { preferRaised: true, sideBias: side });
        if (!landed) {
          tc.hits = 0;
          tf._pendingTeleportCombo = null;
          tf._finishAttackState('teleportCombo');
          return;
        }
        tf.facing = tgt.cx() > tf.cx() ? 1 : -1;
        tf._setAttackPhase('active', 4, true);
        // Portal burst at new position
        spawnParticles(tf.cx(), tf.cy(), '#000000', 18);
        spawnParticles(tf.cx(), tf.cy(), '#ffffff', 10);
        screenShake = Math.max(screenShake, 14);
        // Deal damage
        dealDamage(tf, tgt, 14, 8);
        // Brief invincibility so we don't get counter-hit during combo
        tf.invincible = Math.max(tf.invincible, 12);
      }
      tc.hits--;
      if (tc.hits > 0) {
        tc.timer = tc.gap;
      } else {
        tf._pendingTeleportCombo = null;
        tf._setAttackPhase('recovery', 14, false);
        // Final shockwave at landing position
        if (typeof tfShockwaves !== 'undefined') {
          tfShockwaves.push({
            x: tf.cx(), y: tf.y + tf.h,
            r: 8, maxR: 200,
            timer: 30, maxTimer: 30,
            boss: tf, hit: new Set(),
          });
        }
        screenShake = Math.max(screenShake, 22);
      }
    }
  }

  // ── Pending Gravity Crush ──────────────────────────────────
  if (tf._pendingGravityCrush) {
    const gc = tf._pendingGravityCrush;
    gc.timer--;
    // During pull phase, drag all players toward arena center each frame
    const pullStrength = 0.55 * (1 - gc.timer / 60); // increases as timer counts down
    for (const p of players) {
      if (p.isBoss || p.health <= 0) continue;
      const pdx = GAME_W / 2 - p.cx();
      const pdy = GAME_H / 2 - p.cy();
      p.vx += Math.sign(pdx) * pullStrength * Math.min(1, Math.abs(pdx) / 200);
      p.vy += Math.sign(pdy) * pullStrength * 0.5;
    }
    if (gc.timer <= 0) {
      // DETONATE — massive outward blast
      spawnParticles(GAME_W / 2, GAME_H / 2, '#8800ff', 55);
      spawnParticles(GAME_W / 2, GAME_H / 2, '#ffffff', 35);
      spawnParticles(GAME_W / 2, GAME_H / 2, '#ff00aa', 20);
      screenShake = Math.max(screenShake, 40);
      if (typeof cinScreenFlash !== 'undefined') {
        cinScreenFlash = { color: '#8800ff', alpha: 0.45, timer: 12, maxTimer: 12 };
      }
      // Blast rings
      if (typeof phaseTransitionRings !== 'undefined') {
        for (let ri = 0; ri < 5; ri++) {
          phaseTransitionRings.push({
            cx: GAME_W / 2, cy: GAME_H / 2,
            r: 10 + ri * 18, maxR: 380 + ri * 55,
            timer: 50 + ri * 10, maxTimer: 50 + ri * 10,
            color: ri % 2 === 0 ? '#8800ff' : '#ffffff',
            lineWidth: Math.max(0.8, 4 - ri * 0.5),
          });
        }
      }
      // Knockback and damage all nearby players
      for (const p of players) {
        if (p.isBoss || p.health <= 0) continue;
        const pdx2 = p.cx() - GAME_W / 2;
        const pdy2 = p.cy() - GAME_H / 2;
        const dist2 = Math.hypot(pdx2, pdy2) || 1;
        p.vx += (pdx2 / dist2) * 28;
        p.vy += (pdy2 / dist2) * 18 - 8;
        dealDamage(tf, p, 22, 16);
      }
      tf._pendingGravityCrush = null;
    }
  }

  // ── Pending Collapse Strike ────────────────────────────────
  if (tf._pendingCollapseStrike) {
    tf._pendingCollapseStrike.timer--;
    if (tf._pendingCollapseStrike.timer <= 0) {
      const csTgt = tf._pendingCollapseStrike.target;
      // Teleport boss behind target
      if (csTgt && csTgt.health > 0) {
        const csDir = (csTgt.facing || 1);
        const landed = _bossTeleportActor(tf, csTgt.cx() - csDir * 55, csTgt.y, { preferRaised: true, sideBias: -csDir });
        if (!landed) {
          tf._pendingCollapseStrike = null;
          tf._finishAttackState('collapseStrike');
          return;
        }
        tf._setAttackPhase('active', 5, true);
        // Restore slowmo
        if (hitSlowTimer <= 0) slowMotion = 1.0;
        screenShake = Math.max(screenShake, 26);
        spawnParticles(tf.cx(), tf.cy(), '#ffffff', 28);
        spawnParticles(tf.cx(), tf.cy(), '#aaddff', 18);
        spawnParticles(tf.cx(), tf.cy(), '#000000', 14);
        // Heavy strike — 55 damage + strong knockback
        const oldDmg = tf.weapon.damage;
        const oldKb  = tf.weapon.kb;
        tf.weapon.damage = 55;
        tf.weapon.kb     = 16;
        if (tf.cooldown <= 0) tf.attack(csTgt);
        tf.weapon.damage = oldDmg;
        tf.weapon.kb     = oldKb;
      }
      tf._pendingCollapseStrike = null;
      tf._setAttackPhase('recovery', 18, false);
    }
  }

  // ── Pending Shockwave (ground) ─────────────────────────────
  if (tf._pendingShockwave) {
    tf._pendingShockwave.timer--;
    if (tf._pendingShockwave.timer <= 0) {
      const bossRef = tf._pendingShockwave.boss || tf;
      screenShake = Math.max(screenShake, 22);
      spawnParticles(bossRef.cx(), bossRef.y + bossRef.h, '#ffffff', 30);
      spawnParticles(bossRef.cx(), bossRef.y + bossRef.h, '#440044', 22);
      spawnParticles(bossRef.cx(), bossRef.y + bossRef.h, '#8800ff', 14);
      for (let ri = 0; ri < 3; ri++) {
        tfShockwaves.push({
          x: bossRef.cx(), y: bossRef.y + bossRef.h,
          r: 12 + ri * 6, maxR: 260 + ri * 70,
          timer: 38 + ri * 9, maxTimer: 38 + ri * 9,
          boss: bossRef, hit: new Set(),
        });
      }
      tf._pendingShockwave = null;
    }
  }
}

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
