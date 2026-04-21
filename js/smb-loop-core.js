'use strict';
// smb-loop-core.js — applyWorldModifiers() + gameLoop() main game tick
// Depends on: all earlier modules (called from requestAnimationFrame)
// NOTE: gameLoop is a single monolithic function; do not split further without full refactor
// ============================================================
// GAME LOOP
// ============================================================
let _lastFrameTime = 0;
const _FRAME_MIN_MS = 1000 / 62; // cap at ~62fps to prevent double-speed on 120Hz displays

// ── World Modifier Handler ────────────────────────────────────────────────────
// Called once per frame during story mode to apply per-world gameplay changes.
// All mutations are transient (re-applied each frame) — nothing is permanently stored.
function applyWorldModifiers() {
  const _fighters = [...(players || []), ...(minions || []), ...(trainingDummies || [])];
  for (const f of _fighters) {
    if (!f) continue;
    f._aggroBoost = 1;
    f._damageTakenMult = 1;
  }

  if (!worldId || gameMode !== 'story') return;

  if (worldId !== 'fracture' && tfGravityInverted && typeof forceResetGravity === 'function') {
    forceResetGravity();
  }

  switch (worldId) {

    case 'fracture':
      // Random gravity shift: ~1% chance per frame to invert gravity direction.
      // Uses the existing tfGravityInverted flag so fighter physics already handle it.
      if (Math.random() < 0.01) {
        tfGravityInverted = !tfGravityInverted;
      }
      break;

    case 'war':
      // Boost AI aggression each frame (re-applied so removal on world change is clean).
      players.forEach(p => {
        if (p && p.isAI) p._aggroBoost = 1.25;
      });
      break;

    case 'mirror':
      // Mirror AI behaviour is handled in the AI update path.
      break;

    case 'godfall':
      // Increase incoming damage multiplier each frame (re-applied so it resets naturally).
      players.forEach(p => {
        if (p) p._damageTakenMult = 1.3;
      });
      break;

    case 'code':
      // Visual glitch effects are handled in the drawing layer.
      break;
  }
}

function gameLoop(timestamp) {
  if (!gameRunning) return;
  // Frame rate cap: skip this frame if called too soon after the last one
  if (timestamp - _lastFrameTime < _FRAME_MIN_MS) {
    requestAnimationFrame(gameLoop);
    return;
  }
  _lastFrameTime = timestamp;
  if (paused || gameLoading) { requestAnimationFrame(gameLoop); return; }
  // Hitstop: freeze gameplay for a few frames on strong hits
  if (hitStopFrames > 0) {
    hitStopFrames--;
    screenShake *= 0.9; // decay-based shake
    requestAnimationFrame(gameLoop);
    return;
  }
  // Story cinematic freeze: halt physics without blocking rendering
  if (storyFreezeTimer > 0) {
    storyFreezeTimer--;
    // Still render (draw call happens later), but skip physics by falling through
    // to draw-only path — achieved by setting hitStopFrames for 1 frame
    hitStopFrames = 1;
    requestAnimationFrame(gameLoop);
    return;
  }
  // Decay hit-slow-motion burst back to normal
  if (hitSlowTimer > 0) {
    hitSlowTimer--;
    // Don't restore slowMotion during a finisher — finisher manages it
    if (hitSlowTimer <= 0 && slowMotion < 0.9 && !activeFinisher) slowMotion = 1.0;
  }
  // Cosmic silence: brief volume dip on heavy boss hits
  if (typeof SoundManager !== 'undefined' && SoundManager._cosmicSilenceTimer > 0) {
    SoundManager._cosmicSilenceTimer--;
    const _silVol = SoundManager._cosmicSilenceTimer > 4 ? 0.08 : 0.08 + (4 - SoundManager._cosmicSilenceTimer) * 0.23;
    SoundManager._silencedGain = _silVol;
  } else if (typeof SoundManager !== 'undefined' && SoundManager._silencedGain !== undefined && SoundManager._silencedGain < 1.0) {
    SoundManager._silencedGain = Math.min(1.0, (SoundManager._silencedGain || 0) + 0.06);
  }
  // Tick active cinematic (before input and physics)
  // Skip if absorption cinematic is running — prevents overlap with activeCinematic
  if (!tfAbsorptionScene) {
    updateCinematic();
    if (typeof updateCinematicSystem === 'function') updateCinematicSystem();
  }
  // Tick deterministic cutscene system
  if (typeof updateCutscene === 'function') updateCutscene();
  if (typeof updateParadoxCompanion === 'function') updateParadoxCompanion();
  frameCount++;
  aiTick++;
  // Approximate real delta-time at 60fps for Director
  if (typeof updateDirector === 'function') updateDirector(1/60);

  // ---------- Phase: updateInput ----------
  // Online: tick network + apply remote player state
  if (onlineMode && gameRunning && NetworkManager.connected) {
    const localP  = players.find(p => !p.isRemote);
    const remoteP = players.find(p =>  p.isRemote);
    NetworkManager.tick(localP);
    if (remoteP) {
      const rs = NetworkManager.getRemoteStateLegacy();
      if (rs) {
        remoteP.x         = rs.x;
        remoteP.y         = rs.y;
        remoteP.vx        = rs.vx        || 0;
        remoteP.vy        = rs.vy        || 0;
        remoteP.health    = rs.health    != null ? rs.health    : remoteP.health;
        remoteP.maxHealth = rs.maxHealth != null ? rs.maxHealth : (remoteP.maxHealth || 100);
        remoteP.state     = rs.state     || 'idle';
        remoteP.onGround  = rs.state === 'idle' || rs.state === 'walking' || rs.state === 'attacking';
        remoteP.facing    = rs.facing    || remoteP.facing;
        remoteP.lives     = rs.lives     != null ? rs.lives     : remoteP.lives;
        remoteP.curses     = rs.curses    || [];
        remoteP.shielding  = rs.shield    || false;
        // Sync attack animation so weapon swing is visible on opponent's screen
        remoteP.attackTimer    = rs.attackTimer    != null ? rs.attackTimer    : remoteP.attackTimer;
        remoteP.attackDuration = rs.attackDuration != null ? rs.attackDuration : (remoteP.attackDuration || 12);
        remoteP.hurtTimer      = rs.hurtTimer      != null ? rs.hurtTimer      : 0;
        remoteP.stunTimer      = rs.stunTimer2     != null ? rs.stunTimer2     : 0;
        // Sync invincible from owning machine — prevents permanent transparency/unhittable
        remoteP.invincible = rs.invincible != null ? rs.invincible : 0;
        // Sync weapon — always apply to prevent stale local-UI weapon showing
        if (rs.weaponKey && WEAPONS[rs.weaponKey]) {
          remoteP.weaponKey = rs.weaponKey;
          remoteP.weapon    = WEAPONS[rs.weaponKey];
        }
        if (rs.color) remoteP.color = rs.color;
        if (rs.name)  remoteP.name  = rs.name;
        if (rs.hat)   remoteP.hat   = rs.hat;
        if (rs.cape)  remoteP.cape  = rs.cape;
      }
    }
  }

  applyWorldModifiers();
  processInput(); // updateInput

  // ---------- Phase: updateBossArena (platforms, floor hazard) ----------
  if (currentArena && currentArena.isBossArena) {
    // Animate moving platforms — random-lerp targets for unpredictable movement
    // Boss arena: 2x speed (shorter timer range, faster lerp)
    const bossPlSpeed = currentArenaKey === 'creator' ? 2 : 1;
    const bossLerpSpd = currentArenaKey === 'creator' ? 0.14 : 0.07;
    for (const pl of currentArena.platforms) {
      if (pl.ox !== undefined) {
        if (pl.rx === undefined || pl.rTimer <= 0) {
          pl.rx    = pl.ox + (Math.random() - 0.5) * pl.oscX * 2;
          pl.rx    = clamp(pl.rx, pl.ox - pl.oscX, pl.ox + pl.oscX);
          pl.rTimer = Math.floor((30 + Math.floor(Math.random() * 50)) / bossPlSpeed);
        }
        pl.rTimer--;
        pl.x = lerp(pl.x, pl.rx, bossLerpSpd);
      }
      if (pl.oy !== undefined) {
        if (pl.ry === undefined || pl.ryTimer <= 0) {
          pl.ry    = pl.oy + (Math.random() - 0.5) * pl.oscY * 2;
          pl.ry    = clamp(pl.ry, pl.oy - pl.oscY, pl.oy + pl.oscY);
          pl.ryTimer = Math.floor((30 + Math.floor(Math.random() * 50)) / bossPlSpeed);
        }
        pl.ryTimer--;
        pl.y = lerp(pl.y, pl.ry, bossLerpSpd);
      }
    }

    // Floor hazard state machine — suppressed during TF opening cinematic
    if (!gameFrozen && !(typeof tfOpeningFightActive !== 'undefined' && tfOpeningFightActive)) bossFloorTimer--;
    if (bossFloorTimer <= 0) {
      if (bossFloorState === 'normal') {
        bossFloorState = 'warning';
        bossFloorType  = Math.random() < 0.5 ? 'lava' : 'void';
        bossFloorTimer = BOSS_FLOOR_WARNING_FRAMES; // 3-second warning
        showBossDialogue(bossFloorType === 'lava'
          ? randChoice(['The floor has a new purpose.', 'Heat is a matter of perspective.', 'I\'d move if I were you. I\'m not.'])
          : randChoice(['The ground is a luxury.', 'Space beneath your feet — gone.', 'Let\'s see how well you float.']), 220);
      } else if (bossFloorState === 'warning') {
        bossFloorState = 'hazard';
        bossFloorTimer = 900; // 15-second hazard
        const floorPl  = currentArena.platforms.find(p => p.isFloor);
        if (bossFloorType === 'lava') {
          if (floorPl) { floorPl.isFloorDisabled = true; }
          currentArena.hasLava = true;
          currentArena.lavaY   = 462;
          currentArena.deathY  = 560;
        } else {
          if (floorPl) { floorPl.isFloorDisabled = true; }
          currentArena.deathY = 530;
        }
      } else { // 'hazard' → back to normal
        bossFloorState = 'normal';
        bossFloorTimer = 1200 + Math.floor(Math.random() * 600); // 20–30 s until next
        const floorPl  = currentArena.platforms.find(p => p.isFloor);
        if (floorPl) { floorPl.isFloorDisabled = false; }
        currentArena.hasLava = false;
        currentArena.deathY  = 640;
        mapPerkState.eruptions    = [];
        mapPerkState.eruptCooldown = 0;
      }
    }

    // TrueForm floor-removal per-frame countdown (runs every frame, not on AI ticks)
    if (typeof tfFloorRemoved !== 'undefined' && tfFloorRemoved && !gameFrozen) {
      tfFloorTimer--;
      if (tfFloorTimer <= 0) {
        tfFloorRemoved = false;
        const _floorPl = currentArena.platforms.find(p => p.isFloor);
        if (_floorPl) _floorPl.isFloorDisabled = false;
        if (typeof showBossDialogue === 'function')
          showBossDialogue('I gave it back. Enjoy it while it lasts.', 150);
      }
    }

    // Boss lava hazard: spawn eruption columns
    if (bossFloorState === 'hazard' && bossFloorType === 'lava') {
      if (!mapPerkState.eruptions)     mapPerkState.eruptions     = [];
      if (!mapPerkState.eruptCooldown) mapPerkState.eruptCooldown = 120;
      mapPerkState.eruptCooldown--;
      if (mapPerkState.eruptCooldown <= 0) {
        const ex = 80 + Math.random() * 740;
        mapPerkState.eruptions.push({ x: ex, timer: 180 });
        mapPerkState.eruptCooldown = 150 + Math.floor(Math.random() * 150);
      }
      // Tick down eruption timers
      for (let ei = mapPerkState.eruptions.length - 1; ei >= 0; ei--) {
        const er = mapPerkState.eruptions[ei];
        er.timer--;
        if (er.timer <= 0) { mapPerkState.eruptions.splice(ei, 1); continue; }
        if (er.timer % 5 === 0 && settings.particles && particles.length < MAX_PARTICLES) {
          const upA = -Math.PI/2 + (Math.random()-0.5)*0.5;
          const _p = _getParticle();
          _p.x = er.x; _p.y = currentArena.lavaY || 462;
          _p.vx = Math.cos(upA)*5; _p.vy = Math.sin(upA)*(8+Math.random()*8);
          _p.color = Math.random() < 0.5 ? '#ff4400' : '#ff8800';
          _p.size = 3+Math.random()*4; _p.life = 30+Math.random()*20; _p.maxLife = 50;
          particles.push(_p);
        }
        // Damage players in column
        for (const p of players) {
          if (p.isBoss || p.health <= 0 || p.invincible > 0) continue;
          if (Math.abs(p.cx() - er.x) < 100 && p.y + p.h > (currentArena.lavaY || 462) - 250) {
            if (er.timer % 10 === 0) dealDamage(players.find(q => q.isBoss) || players[1], p, Math.ceil(p.maxHealth * 0.044), 8);
          }
        }
      }
    }
  }

  // ---------- Phase: updateCamera (bounding box, dead zone, lerp) ----------
  const baseScale = Math.min(canvas.width / GAME_W, canvas.height / GAME_H);
  const baseScaleX = baseScale;
  const baseScaleY = baseScale;

  let camZoom, camCX, camCY;
  if (bossDeathScene) {
    camZoom = bossDeathScene.camZoom || 1;
    camCX   = bossDeathScene.orbX;
    camCY   = bossDeathScene.orbY;
  } else {
    updateCamera();
    camZoom = camZoomCur;
    camCX   = camXCur;
    camCY   = camYCur;
  }

  // Cinematic camera: smooth follow with a subtle spring, plus optional hard cuts.
  if (cinematicCamOverride) {
    if (cinematicCamSnapFrames > 0) {
      camZoom = cinematicZoomTarget;
      camCX   = cinematicFocusX;
      camCY   = cinematicFocusY;
      cinematicCamSnapFrames--;
      _camPrevFocusX = cinematicFocusX;
      _camPrevFocusY = cinematicFocusY;
      _camOvershootX = 0;
      _camOvershootY = 0;
    } else {
      camZoom += (cinematicZoomTarget - camZoom) * 0.09;
      camCX   += (cinematicFocusX    - camCX)   * 0.07;
      camCY   += (cinematicFocusY    - camCY)   * 0.07;

      _camOvershootX += (cinematicFocusX - _camPrevFocusX) * 0.04;
      _camOvershootY += (cinematicFocusY - _camPrevFocusY) * 0.04;
      _camPrevFocusX = cinematicFocusX;
      _camPrevFocusY = cinematicFocusY;
      _camOvershootX *= 0.82;
      _camOvershootY *= 0.82;
      camCX += _camOvershootX;
      camCY += _camOvershootY;
    }
  } else {
    cinematicCamSnapFrames = 0;
    _camPrevFocusX = camCX;
    _camPrevFocusY = camCY;
    _camOvershootX = 0;
    _camOvershootY = 0;
  }

  // Impact cinematic: override tracking target and apply zoom boost
  if (typeof _cinCamTarget !== 'undefined' && _cinCamTarget) {
    camCX += (_cinCamTarget.cx() - camCX) * _cinCamLerp;
    camCY += (_cinCamTarget.cy() - camCY) * _cinCamLerp;
  }
  if (typeof _cinCamZoomBoost !== 'undefined') camZoom *= (1 + _cinCamZoomBoost);

  const finalScX = baseScaleX * camZoom;
  const finalScY = baseScaleY * camZoom;

  // Clear canvas: fill with arena sky color so zoomed-out margins don't show black
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const _skyBg = ctx.createLinearGradient(0, 0, 0, canvas.height);
  _skyBg.addColorStop(0, currentArena?.sky?.[0] || '#000');
  _skyBg.addColorStop(1, currentArena?.sky?.[1] || '#000');
  ctx.fillStyle = _skyBg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.restore();

  const _cinOX = typeof _cinCamOffX !== 'undefined' ? _cinCamOffX : 0;
  const _cinOY = typeof _cinCamOffY !== 'undefined' ? _cinCamOffY : 0;
  // Only apply screen shake above a threshold to prevent micro-jitter at near-zero values
  const _shakeAmt = screenShake > 1.0 ? screenShake : 0;
  const sx = (Math.random() - 0.5) * _shakeAmt + (canvas.width  / 2 - camCX * finalScX) + _cinOX;
  const sy = (Math.random() - 0.5) * _shakeAmt + (canvas.height / 2 - camCY * finalScY) + _cinOY;
  ctx.setTransform(finalScX, 0, 0, finalScY, sx, sy);

  // ---------- Phase: render (world, entities, particles, HUD) ----------
  drawBackground();
  drawPlatforms();
  if (typeof drawCinematicImpactWorldEffects === 'function') drawCinematicImpactWorldEffects();
  if (gameMode === 'minigames' && minigameType === 'soccer') drawSoccer();
  drawBackstagePortals();
  drawMapPerks();

  // Boss beams — update logic + draw (also in training mode when boss is present, or when an admin kit is equipped)
  const _anyAdminKit = typeof players !== 'undefined' && players.some(p => p._adminKit);
  const hasBossActive = (currentArena && currentArena.isBossArena) || (trainingMode && trainingDummies.some(d => d.isBoss)) || _anyAdminKit
    || (damnationActive && players.some(p => p.isBoss));
  if (hasBossActive) {
    for (const b of bossBeams) {
      if (b.phase === 'warning') {
        if (--b.warningTimer <= 0) { b.phase = 'active'; b.activeTimer = 110; }
      } else if (b.phase === 'active') {
        if (--b.activeTimer <= 0) { b.done = true; }
        else {
          // Deal damage each frame to players caught in beam
          const boss = players.find(p => p.isBoss) || trainingDummies.find(d => d.isBoss);
          const beamTargets = trainingMode ? players : players.filter(p => !p.isBoss);
          for (const p of beamTargets) {
            if (p.health <= 0 || p.invincible > 0) continue;
            // Skip damage if player is inside a safe zone
            const inSafe = bossMetSafeZones.some(sz =>
              Math.hypot(p.cx() - sz.x, (p.y + p.h * 0.5) - sz.y) < sz.r);
            if (!inSafe && Math.abs(p.cx() - b.x) < 24) {
              // Per-beam damage accumulator — cap at 40% of max HP per beam.
              // Keyed on the beam object so overlapping beams don't share/reset each other's cap.
              if (!b._damageAccum) b._damageAccum = {};
              const pid = p.playerNum != null ? p.playerNum : players.indexOf(p);
              if (b._damageAccum[pid] == null) b._damageAccum[pid] = 0;
              const MAX_BEAM_DAMAGE = Math.floor((p.maxHealth || 100) * 0.4);
              if (b._damageAccum[pid] < MAX_BEAM_DAMAGE) {
                const allowed = Math.min(6, MAX_BEAM_DAMAGE - b._damageAccum[pid]);
                b._damageAccum[pid] += allowed;
                dealDamage(boss || players[1], p, allowed, 5, 1.0, false, 12);
              }
            }
          }
        }
      }
    }
    bossBeams = bossBeams.filter(b => !b.done);
    drawBossBeams();

    // Boss spikes — update and draw
    const bossRef = players.find(p => p.isBoss) || trainingDummies.find(d => d.isBoss);
    for (const sp of bossSpikes) {
      if (sp.done) continue;
      if (sp.phase === 'rising') {
        sp.h += 8;
        if (sp.h >= sp.maxH) { sp.h = sp.maxH; sp.phase = 'staying'; sp.stayTimer = 180; }
      } else if (sp.phase === 'staying') {
        sp.stayTimer--;
        if (sp.stayTimer <= 0) sp.phase = 'falling';
      } else if (sp.phase === 'falling') {
        sp.h -= 6;
        if (sp.h <= 0) { sp.h = 0; sp.done = true; }
      }
      // Damage and bounce players caught by spike
      if (sp.phase === 'rising' || sp.phase === 'staying') {
        const spikeTopY = 460 - sp.h;
        const spikeTargets = trainingMode ? players : players.filter(p => !p.isBoss);
        for (const p of spikeTargets) {
          if (p.health <= 0 || p.invincible > 0) continue;
          if (Math.abs(p.cx() - sp.x) < 9 && p.y + p.h > spikeTopY) {
            dealDamage(bossRef || players.find(q => q.isBoss) || players[1], p, 14, 14, 1.0, false, 20);
            // Bounce player upward so they can escape
            if (p.vy >= 0) {
              p.vy = -20;
              p.canDoubleJump = true;
            }
          }
        }
      }
    }
    bossSpikes = bossSpikes.filter(sp => !sp.done);
    drawBossSpikes();
    // Paradox foreshadow: background silhouettes during boss fight (drawn behind fighters)
    if (typeof updateBossParadoxForeshadow === 'function') updateBossParadoxForeshadow();
    if (typeof drawBossParadoxForeshadow   === 'function') drawBossParadoxForeshadow();
    if (bossDeathScene) updateBossDeathScene();
    if (tfEndingScene)  updateTFEnding();
    // Telegraph system: pending attacks, stagger, desperation, warnings draw
    updateBossPendingAttacks();
    drawBossWarnings();
  }

  // ---------- Phase: updatePhysics/updateCombat (projectiles, minions, players) ----------
  projectiles.forEach(p => p.update());
  projectiles = projectiles.filter(p => p.active); // prevent leak
  projectiles.forEach(p => p.draw());

  // Minions (boss-spawned) — freeze during absorption cinematic
  minions.forEach(m => { if (m.health > 0 && !tfAbsorptionScene) m.update(); });
  minions.forEach(m => { if (m.health > 0) m.draw(); });
  minions = minions.filter(m => m.health > 0);

  // Training dummies / bots
  if (trainingMode) {
    trainingDummies.forEach(d => { if (d.isDummy || d.health > 0 || d.invincible > 0) d.update(); });
    trainingDummies.forEach(d => { if (d.isDummy || d.health > 0 || d.invincible > 0) d.draw(); });
    // Remove dead bots (lives=0), keep dummies (they auto-heal)
    trainingDummies = trainingDummies.filter(d => {
      if (d.isDummy) return true; // dummies auto-heal, never remove
      // Decrement lives for dead bots not yet cleaned up (checkDeaths only handles players[])
      if (d.health <= 0 && d.invincible === 0 && d.lives > 0 && !d.isBoss) {
        d.lives--;
        spawnParticles(d.cx(), d.cy(), d.color, 10);
      }
      return d.health > 0 || d.invincible > 0 || d.lives > 0;
    });
  }

  // Soccer ball physics update
  if (gameMode === 'minigames' && minigameType === 'soccer') updateSoccerBall();
  // Minigame logic update
  if (gameMode === 'minigames') updateMinigame();
  // Eternal Damnation arc update
  if (damnationActive && typeof updateDamnation === 'function') updateDamnation();
  // True Form special updates (also active when a trueform admin kit is equipped, or FORCE_ATTACK_MODE has active TF effects)
  const _anyTFKit = typeof players !== 'undefined' && players.some(p => p._adminKit && p._adminKit.kitKey === 'trueform');
  const _forceTF  = !!window.FORCE_ATTACK_MODE && (
    (typeof tfBlackHoles  !== 'undefined' && tfBlackHoles.length)  ||
    (typeof tfGravityWells!== 'undefined' && tfGravityWells.length)||
    (typeof tfClones      !== 'undefined' && tfClones.length)      ||
    (typeof tfShockwaves  !== 'undefined' && tfShockwaves.length)  ||
    (typeof tfGammaBeam   !== 'undefined' && tfGammaBeam)          ||
    (typeof tfNeutronStar !== 'undefined' && tfNeutronStar)        ||
    (typeof tfGalaxySweep !== 'undefined' && tfGalaxySweep)        ||
    (typeof tfMultiverse  !== 'undefined' && tfMultiverse)         ||
    (typeof tfSupernova   !== 'undefined' && tfSupernova)          ||
    (typeof tfMeteorCrash !== 'undefined' && tfMeteorCrash)        ||
    (typeof tfChainSlam   !== 'undefined' && tfChainSlam)          ||
    (typeof tfGraspSlam   !== 'undefined' && tfGraspSlam)          ||
    (typeof tfPhaseShift  !== 'undefined' && tfPhaseShift)         ||
    (typeof tfGravityInverted !== 'undefined' && tfGravityInverted)
  );
  if ((gameMode === 'trueform' || _anyTFKit || _forceTF
      || (damnationActive && players.some(p => p.isTrueForm))) &&
      !(typeof tfOpeningFightActive !== 'undefined' && tfOpeningFightActive)) {
    updateTFBlackHoles();
    updateTFGravityWells();
    updateTFMeteorCrash();
    updateTFClones();
    updateTFChainSlam();
    updateTFGraspSlam();
    updateTFDimensionPunch();
    updateTFShockwaves();
    updateTFPendingAttacks();
    updateTFGammaBeam();
    updateTFBurnTrail();
    updateTFNeutronStar();
    updateTFGalaxySweep();
    updateTFMultiverse();
    updateTFSupernova();
    // Gravity failsafe: ensure inversion ALWAYS expires via timer or hard cap
    if (tfGravityInverted) {
      if (tfGravityTimer > 0) {
        // Normal path: timer-driven restore
        tfGravityTimer--;
        if (tfGravityTimer <= 0) {
          forceResetGravity();
          showBossDialogue('I restored gravity. You\'re welcome.', 150);
          spawnParticles(GAME_W / 2, GAME_H / 2, '#ffffff', 16);
        }
      } else {
        // Failsafe path: inverted but no timer set (e.g. chaos event / cinematic without tfGravityTimer)
        if (!gravityState.active) {
          gravityState.active   = true;
          gravityState.type     = 'reverse';
          gravityState.timer    = 0;
          gravityState.maxTimer = 240; // 4-second hard cap
        }
        gravityState.timer++;
        if (gravityState.timer >= gravityState.maxTimer) {
          forceResetGravity();
          spawnParticles(GAME_W / 2, GAME_H / 2, '#ffffff', 12);
        }
      }
    } else if (gravityState.active) {
      // Not inverted — clear failsafe tracker
      gravityState.active = false;
      gravityState.timer  = 0;
    }
    if (tfControlsInverted && tfControlsInvertTimer > 0) {
      tfControlsInvertTimer--;
      if (tfControlsInvertTimer <= 0) {
        tfControlsInverted = false;
        showBossDialogue('Your body is yours again. Briefly.', 150);
        spawnParticles(GAME_W / 2, GAME_H / 2, '#aaaaaa', 12);
      }
    }
  }

  // Verlet death ragdolls — update and remove when lifetime expires (prevent leak)
  verletRagdolls.forEach(vr => vr.update());
  verletRagdolls = verletRagdolls.filter(vr => !vr.isDone());

  // Draw Verlet death ragdolls (behind living players)
  verletRagdolls.forEach(vr => vr.draw());

  // Safety: clamp any Infinity/NaN velocities before physics update (avoids teleport bugs)
  for (const p of players) {
    if (!isFinite(p.vx)) p.vx = 0;
    if (!isFinite(p.vy)) p.vy = 0;
    if (!isFinite(p.x))  { p.x = GAME_W / 2; p.vx = 0; }
    if (!isFinite(p.y))  { p.y = 200;         p.vy = 0; }
  }
  // Players — skip physics update for remote (network-driven) players; also skip during hard freeze or absorption cinematic
  if (!gameFrozen && !tfAbsorptionScene) {
    players.forEach(p => { if ((p.health > 0 || p.invincible > 0) && !p.isRemote) p.update(); });
  }
  // Passive super charge: every player (non-boss) gains a small amount of super each frame
  if (!isCinematic && !paused) {
    players.forEach(p => {
      if (p.isBoss || p.superActive || p.health <= 0) return;
      const _prev = p.superReady;
      p.superMeter = Math.min(100, p.superMeter + 0.04);
      if (!_prev && p.superMeter >= 100) {
        p.superReady      = true;
        p.superFlashTimer = 90;
      }
    });
  }
  // Chaos system: per-frame update (events, drops, effects, multi-kill, announcer)
  if (typeof chaosMode !== 'undefined' && chaosMode && typeof updateChaosSystem === 'function') updateChaosSystem();
  // Finisher: override positions/state AFTER physics, BEFORE draw
  if (typeof updateFinisher === 'function') updateFinisher();

  // ── Depth Phase: transition, circular arena constraint, still-Z tracking ──────
  if (typeof tfDepthPhaseActive !== 'undefined' && tfDepthPhaseActive) {
    // Tick the freeze-transition timer; unlock Z-movement when it expires
    if (tfDepthTransitionTimer > 0) {
      tfDepthTransitionTimer--;
      if (tfDepthTransitionTimer === 0) {
        tfDepthEnabled = true;
        if (typeof cinScreenFlash !== 'undefined')
          cinScreenFlash = { color: '#8844ff', alpha: 0.55, timer: 22, maxTimer: 22 };
        screenShake = Math.max(screenShake, 26);
        spawnParticles(TF_DEPTH_CX, TF_DEPTH_CY, '#8844ff', 22);
        spawnParticles(TF_DEPTH_CX, TF_DEPTH_CY, '#ffffff', 14);
        if (typeof showBossDialogue === 'function')
          showBossDialogue('Every dimension. Every layer. I am all of them.', 240);
      }
    }
    // Clamp all living entities inside the circular arena boundary
    for (const ent of players) {
      if (!ent || (ent.health <= 0 && ent.invincible <= 0)) continue;
      const ecx = ent.cx(), ecy = ent.cy();
      const edx = ecx - TF_DEPTH_CX, edy = ecy - TF_DEPTH_CY;
      const ed  = Math.hypot(edx, edy);
      if (ed > TF_DEPTH_R) {
        const sc = TF_DEPTH_R / ed;
        ent.x  = TF_DEPTH_CX + edx * sc - ent.w * 0.5;
        ent.y  = TF_DEPTH_CY + edy * sc - ent.h * 0.5;
        ent.vx *= -0.45;
        ent.vy *= -0.45;
      }
    }
    // Track per-player same-Z idle frames for depthPunish
    if (typeof tfDepthPlayerStillZ !== 'undefined') {
      players.forEach((p, pi) => {
        if (p.isAI || p.isBoss || p.health <= 0) return;
        const rec = tfDepthPlayerStillZ[pi] || { z: p.z || 0, frames: 0 };
        if (Math.abs((p.z || 0) - rec.z) < 0.05) { rec.frames++; }
        else { rec.z = p.z || 0; rec.frames = 0; }
        tfDepthPlayerStillZ[pi] = rec;
      });
    }
  }

  players.forEach((p, i) => {
    if (p.health <= 0 && p.invincible <= 0) return;
    // Cinematic visibility: skip players flagged as hidden for this scene
    if (activeCinematic && activeCinematic.hidePlayers && activeCinematic.hidePlayers.includes(i)) return;
    // Depth phase: apply per-entity Z-axis depth illusion transform
    if (typeof tfDepthPhaseActive !== 'undefined' && tfDepthPhaseActive) {
      const pz     = p.z || 0;
      const dScale = 1 + pz * 0.2;  // z=1 → 20% larger, z=-1 → 20% smaller
      const dOffY  = pz * 40;        // z=1 → 40px lower (foreground), z=-1 → 40px higher
      const pivX   = p.cx();
      const pivY   = p.cy();
      ctx.save();
      ctx.translate(pivX, pivY + dOffY);
      ctx.scale(dScale, dScale);
      ctx.translate(-pivX, -pivY);
      p.draw();
      ctx.restore();
      // Draw Z-layer indicator bar beneath entity
      const barW = p.w * 1.4, barH = 4;
      const barX = p.cx() - barW * 0.5;
      const barY = p.y + p.h + dOffY + 6 * dScale;
      ctx.save();
      ctx.globalAlpha = 0.7;
      ctx.fillStyle = '#222';
      ctx.fillRect(barX, barY, barW, barH);
      // Filled portion shows z position (center = z:0, right = z:1, left = z:-1)
      const fillX  = barX + barW * 0.5 + (pz * barW * 0.5) - barH * 0.5;
      ctx.fillStyle = pz >= 0 ? '#00aaff' : '#aa44ff';
      ctx.fillRect(Math.max(barX, fillX), barY, barH, barH);
      ctx.restore();
      return; // draw already called above
    }
    // Hit nudge: directional visual recoil — linearly decays over 4 frames
    if (p._hitNudge && p._hitNudge.t > 0) {
      ctx.save();
      ctx.translate(p._hitNudge.x * (p._hitNudge.t / 4), 0);
      p.draw();
      ctx.restore();
      p._hitNudge.t--;
    } else {
      p.draw();
    }
    // Hit confirmation flash: brief white overlay sized to fighter bounding box
    if (p._hitFlashTimer && p._hitFlashTimer > 0) {
      p._hitFlashTimer--;
      ctx.save();
      ctx.globalAlpha = (p._hitFlashTimer / 5) * 0.38;
      ctx.fillStyle   = '#ffffff';
      ctx.fillRect(p.x - 1, p.y - 1, p.w + 2, p.h + 2);
      ctx.restore();
    }
  });
  // Chaos system: world-space draw (item drops, effect badges, platform effects)
  if (typeof chaosMode !== 'undefined' && chaosMode && typeof drawChaosWorldSpace === 'function') drawChaosWorldSpace();
  drawSpartanRageEffects();
  drawClassEffects();
  drawCurseAuras();
  updateAndDrawLightningBolts();
  if ((gameMode === 'trueform' || _anyTFKit || _forceTF
      || (damnationActive && players.some(p => p.isTrueForm))) &&
      !(typeof tfOpeningFightActive !== 'undefined' && tfOpeningFightActive)) {
    updateTFPhaseShift();
    updateTFRealityTear();
    updateTFCalcStrike();
    updateTFRealityOverride();
    drawTFBlackHoles();
    drawTFGravityWells();
    drawTFMeteorCrash();
    drawTFClones();
    drawTFShockwaves();
    drawTFPhaseShift();
    drawTFRealityTear();
    drawTFCalcStrike();
    drawTFMathBubble();
    drawTFRealityOverride();
    drawTFBurnTrail();
    drawTFGammaBeam();
    drawTFNeutronStar();
    drawTFGalaxySweep();
    drawTFMultiverse();
    drawTFSupernova();
    drawTFDimensionPunch();
    drawBossWarnings();
  }
  drawPhaseTransitionRings();
  drawCinematicWorldEffects(); // ground cracks + world-space cinematic fx
  // Paradox entity (world-space, drawn over fighters)
  if (typeof drawParadox === 'function') drawParadox();
  // TF-kills-Paradox cinematic overlay (lock rings world-space + terminal screen-space)
  if (typeof updateTFKCOverlay === 'function') updateTFKCOverlay();
  if (typeof drawTFKCOverlay   === 'function') drawTFKCOverlay();
  // Absorption aura on player (world-space cyan glow, active and permanent)
  if (typeof drawTFAbsorption      === 'function') drawTFAbsorption();
  // Absorption cinematic v2 — memory-driven scene overlay
  if (tfAbsorptionScene && typeof drawTFAbsorptionScene === 'function') drawTFAbsorptionScene();
  // Paradox empowerment aura (world-space, over fighters)
  if (typeof drawParadoxEmpowerment === 'function') drawParadoxEmpowerment();
  checkWeaponSparks();

  // Ability activation ring flash
  if (abilityFlashTimer > 0 && abilityFlashPlayer) {
    const fp = abilityFlashPlayer;
    ctx.save();
    ctx.globalAlpha = (abilityFlashTimer / 14) * 0.6;
    ctx.strokeStyle = fp.color;
    ctx.lineWidth   = 3;
    const r = (14 - abilityFlashTimer) * 4 + 8;
    ctx.beginPath(); ctx.arc(fp.cx(), fp.cy(), r, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
    abilityFlashTimer--;
  }

  drawSecretLetters();
  if (bossDeathScene) drawBossDeathScene();
  if (tfEndingScene)  drawTFEnding();
  updateMapPerks();
  updateMirrorGimmick();
  drawMirrorGimmickOverlay();
  // Paradox revive system (screen-space overlay — replaces fake-death visually)
  if (typeof updateParadoxRevive === 'function') updateParadoxRevive();
  if (typeof drawParadoxRevive   === 'function') drawParadoxRevive();
  // Standalone Paradox entity update (fade-out cleanup outside of revive/opening-fight sequence)
  if (typeof updateParadox === 'function' && (typeof paradoxReviveActive === 'undefined' || !paradoxReviveActive)
      && (typeof tfOpeningFightActive === 'undefined' || !tfOpeningFightActive)) updateParadox();
  // Paradox empowerment timer tick
  if (typeof updateParadoxEmpowerment === 'function') updateParadoxEmpowerment();
  // Paradox ability effects update
  if (typeof updateParadoxEffects === 'function') updateParadoxEffects();
  // False Victory sequence update + draw
  if (typeof updateFalseVictory === 'function') updateFalseVictory();
  if (typeof drawFalseVictory   === 'function') drawFalseVictory();
  if (typeof updateTFOpeningFight   === 'function') updateTFOpeningFight();
  if (typeof updateTFAbsorption     === 'function') updateTFAbsorption();
  if (tfAbsorptionScene && typeof updateTFAbsorptionScene === 'function') updateTFAbsorptionScene();
  // Paradox Fusion visual overlay on P1
  if (typeof drawParadoxFusion === 'function' && typeof tfParadoxFused !== 'undefined' && tfParadoxFused) {
    drawParadoxFusion(players[0]);
  }
  // Paradox ability effects draw
  if (typeof drawParadoxEffects === 'function') drawParadoxEffects();
  // Legacy fake-death scene (runs only when paradox system unavailable)
  if (typeof triggerParadoxRevive === 'undefined') {
    updateFakeDeathScene();
    drawFakeDeathScene();
  }

  // ---------- Phase: updateParticles (prevent memory leak: remove expired) ----------
  const _liveParticles = [];
  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    p.x += p.vx; p.y += p.vy;
    p.vy += 0.12; p.vx *= 0.96;
    p.life--;
    if (p.life > 0) {
      _liveParticles.push(p);
      const a = p.life / p.maxLife;
      ctx.globalAlpha = Math.max(0, a);
      ctx.fillStyle   = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(0.01, p.size * a), 0, Math.PI * 2);
      ctx.fill();
    } else {
      _recycleParticle(p);
    }
  }
  particles = _liveParticles; // keep only live (life > 0) to prevent leak
  ctx.globalAlpha = 1;

  // Damage texts — filter expired to prevent leak
  damageTexts.forEach(d => { d.update(); d.draw(); });
  damageTexts = damageTexts.filter(d => d.life > 0);

  // Respawn countdowns — filter expired to prevent leak
  for (const cd of respawnCountdowns) {
    cd.framesLeft--;
    if (cd.framesLeft <= 0) continue;
    const num = Math.ceil(cd.framesLeft / 22);
    const a   = Math.min(1, cd.framesLeft / 18) * (1 - Math.max(0, (22 - cd.framesLeft % 22) / 22) * 0.3);
    ctx.save();
    ctx.globalAlpha = Math.max(0, a);
    ctx.font        = 'bold 32px Arial';
    ctx.fillStyle   = cd.color;
    ctx.textAlign   = 'center';
    ctx.shadowColor = 'rgba(0,0,0,0.9)';
    ctx.shadowBlur  = 8;
    ctx.fillText(num, cd.x, cd.y);
    ctx.restore();
  }
  respawnCountdowns = respawnCountdowns.filter(cd => cd.framesLeft > 0);

  // Boss phase 3: subtle red screen tint
  if (currentArena && currentArena.isBossArena && settings.bossAura) {
    const bossChar = players.find(p => p.isBoss);
    if (bossChar && bossChar.getPhase && bossChar.getPhase() >= 3 && bossChar.health > 0) {
      ctx.save();
      ctx.globalAlpha = 0.03 + Math.sin(frameCount * 0.04) * 0.012;
      ctx.fillStyle   = '#ff0000';
      ctx.fillRect(0, 0, GAME_W, GAME_H);
      ctx.restore();
    }
  }

  // Boss phase transition flash
  if (bossPhaseFlash > 0) {
    ctx.save();
    ctx.globalAlpha = (bossPhaseFlash / 50) * 0.55;
    ctx.fillStyle   = '#ffffff';
    ctx.fillRect(0, 0, GAME_W, GAME_H);
    bossPhaseFlash--;
    ctx.restore();
  }

  screenShake *= 0.9; // decay-based shake (smoother than instant drop)
  // Reset to non-shake transform (keep scale + camera centering, remove shake)
  ctx.setTransform(finalScX, 0, 0, finalScY,
    canvas.width  / 2 - camCX * finalScX,
    canvas.height / 2 - camCY * finalScY);

  checkDeaths();
  updateHUD();
  if (storyModeActive && typeof storyTickFightScript    === 'function') storyTickFightScript();
  if (storyModeActive && typeof storyCheckEvents        === 'function') storyCheckEvents();
  if (storyModeActive && typeof storyUpdateBoundaries   === 'function') storyUpdateBoundaries();
  // Multiverse: per-frame world modifier tick (gravity flip, shadow teleport, etc.)
  if (multiverseModeActive && typeof MultiverseManager !== 'undefined') MultiverseManager.tick();
  if (exploreActive && typeof updateExploration === 'function') updateExploration();
  // Ship & Fracture progression — tick preview timer each frame
  if (typeof updateFracturePreview === 'function') updateFracturePreview();
  if (gameMode === 'trueform' && !tfAbsorptionScene && typeof updateQTE === 'function') updateQTE();

  // TrueForm: record player position history for multiverse lag-echo
  if (gameMode === 'trueform' && players[0] && players[0].health > 0) {
    _tfCloneHistory.push({ x: players[0].cx(), y: players[0].cy(), facing: players[0].facing });
    if (_tfCloneHistory.length > 24) _tfCloneHistory.shift();
  }

  // Minigame HUD overlay
  if (gameMode === 'minigames') drawMinigameHUD();
  // New chaos modifier notification — timer ticked here, drawn in screen-space below
  if (_chaosModNotif && _chaosModNotif.timer > 0) _chaosModNotif.timer--;
  if (exploreActive && typeof drawExploreGoalObject === 'function') drawExploreGoalObject();
  // Story mode: void fog + boundary warning (drawn in game-world space)
  if (storyModeActive) drawStoryVoidFog();
  if (storyModeActive && typeof drawStoryBoundaryWarning === 'function') drawStoryBoundaryWarning();
  // Achievement popups (drawn over everything, in screen space)
  ctx.setTransform(1, 0, 0, 1, 0, 0); // reset transform for screen-space draw

  // Hit vignette: red edge flash when player takes heavy damage
  if (hitVignetteTimer > 0) {
    hitVignetteTimer--;
    const _va = (hitVignetteTimer / 28) * 0.38;
    const _vg = ctx.createRadialGradient(canvas.width/2, canvas.height/2, canvas.height*0.3, canvas.width/2, canvas.height/2, canvas.height*0.9);
    _vg.addColorStop(0, hitVignetteColor + '0)');
    _vg.addColorStop(1, hitVignetteColor + _va.toFixed(3) + ')');
    ctx.fillStyle = _vg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  if (typeof drawCinematicImpactEffects === 'function') drawCinematicImpactEffects();
  drawCinematicOverlay();
  // Story world distortion intentionally disabled (purple scanlines removed per user request)
  drawAchievementPopups();
  if (damnationActive && typeof drawDamnationEffects === 'function') drawDamnationEffects();
  if (damnationActive && typeof drawDamnationAnchors === 'function') drawDamnationAnchors();
  if (typeof drawObjectiveHUD === 'function') drawObjectiveHUD();
  // Chaos system: screen-space draw (score HUD, event badge, announcer, spectator label)
  if (typeof chaosMode !== 'undefined' && chaosMode && typeof drawChaosOverlay === 'function') drawChaosOverlay();
  if (gameMode === 'adaptive' && typeof drawAdaptiveAIDebug === 'function') drawAdaptiveAIDebug();
  if (typeof drawEntityOverlays === 'function') drawEntityOverlays(finalScX, finalScY, camCX, camCY);
  // Pathfinding debug overlays (toggled via `pf *` console commands, drawn in world-space)
  if (window._pfShowGraph && typeof visualizePlatformGraph  === 'function') visualizePlatformGraph();
  if (window._pfShowDJ    && typeof highlightDoubleJumpEdges === 'function') highlightDoubleJumpEdges();
  if (typeof players !== 'undefined') {
    const _pfBots = players.filter(p => p.isAI && !p.isBoss);
    if (window._pfShowPaths && typeof showBotPath           === 'function') _pfBots.forEach(showBotPath);
    if (window._pfShowArcs  && typeof showProjectedLanding  === 'function') _pfBots.forEach(showProjectedLanding);
  }
  if (storyModeActive && typeof drawStorySubtitle        === 'function') drawStorySubtitle();
  if (storyModeActive && typeof drawStoryOpponentHUD     === 'function') drawStoryOpponentHUD();
  if (storyModeActive && typeof drawStoryPhaseHUD        === 'function') drawStoryPhaseHUD();
  if (storyModeActive && typeof drawFallenWarriorMemory  === 'function') drawFallenWarriorMemory();
  // Multiverse: in-world-space modifier visuals (badge, gravity bar, warning text)
  if (multiverseModeActive && typeof MultiverseManager !== 'undefined') MultiverseManager.draw();
  // Multiverse: screen-space overlays (shadow fog, Fallen God dialogue, world-complete banner, encounter HUD)
  if (multiverseModeActive && typeof MultiverseManager !== 'undefined') {
    MultiverseManager.drawScreenSpace();
    MultiverseManager.drawHUD();
  }
  if ((currentArena.isBossArena || window.FORCE_ATTACK_MODE) && typeof drawBossDialogue === 'function') drawBossDialogue(finalScX, finalScY, camCX, camCY);
  if (gameMode === 'exploration') drawExploreHUD();
  if (abilityUnlockToast && abilityUnlockToast.timer > 0) drawAbilityUnlockToast();
  if (gameMode === 'trueform' && typeof drawQTE === 'function') drawQTE(ctx, canvas.width, canvas.height);
  if (typeof drawCutscene === 'function') drawCutscene(ctx, canvas.width, canvas.height);
  if (typeof drawFinisher === 'function') drawFinisher(ctx); // finisher overlay (topmost)

  // ── Critical status overlays — always screen-space, always above HUD ──────
  // Hide legacy DOM banner (replaced by canvas draw below)
  { const _b = document.getElementById('ctrlInvertedBanner'); if (_b) _b.style.display = 'none'; }

  ctx.setTransform(1, 0, 0, 1, 0, 0); // ensure screen space
  {
    const _now = performance.now();
    const _cW  = canvas.width;
    const _cH  = canvas.height;

    // Chaos mod notification (screen-space, was world-space before)
    if (_chaosModNotif && _chaosModNotif.timer > 0) {
      const _alpha = Math.min(1, _chaosModNotif.timer / 30);
      const _pulse = 0.75 + 0.25 * Math.sin(_now / 220);
      const _scale = 1 + 0.06 * Math.sin(_now / 180);
      ctx.save();
      ctx.globalAlpha = _alpha * _pulse;
      ctx.translate(_cW / 2, _cH * 0.88);
      ctx.scale(_scale, _scale);
      ctx.font = 'bold 16px Arial';
      ctx.fillStyle = '#ff88ff';
      ctx.textAlign = 'center';
      ctx.shadowColor = '#ff00ff'; ctx.shadowBlur = 14;
      ctx.fillText('+ ' + _chaosModNotif.label, 0, 0);
      ctx.restore();
    }

    // Gravity-inverted warning
    if (typeof tfGravityInverted !== 'undefined' && tfGravityInverted) {
      const _pulse = 0.55 + 0.45 * Math.abs(Math.sin(_now / 350));
      const _scale = 1 + 0.07 * Math.sin(_now / 280);
      ctx.save();
      ctx.globalAlpha = _pulse;
      ctx.translate(_cW / 2, _cH * 0.13);
      ctx.scale(_scale, _scale);
      ctx.font = 'bold 19px Arial';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ccaaff';
      ctx.shadowColor = '#8844ff'; ctx.shadowBlur = 22;
      ctx.fillText('\u26A0 GRAVITY INVERTED', 0, 0);
      ctx.restore();
    }

    // Controls-inverted warning (canvas replacement for DOM banner)
    if (typeof tfControlsInverted !== 'undefined' && tfControlsInverted && tfControlsInvertTimer > 0) {
      const _pulse = 0.6 + 0.4 * Math.abs(Math.sin(_now / 300));
      const _scale = 1 + 0.05 * Math.sin(_now / 240);
      const _secs  = Math.ceil(tfControlsInvertTimer / 60);
      ctx.save();
      ctx.globalAlpha = _pulse;
      ctx.translate(_cW / 2, _cH * 0.08);
      ctx.scale(_scale, _scale);
      ctx.font = 'bold 18px Arial';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ff5555';
      ctx.shadowColor = '#ff0000'; ctx.shadowBlur = 18;
      ctx.fillText('\u26A0 CONTROLS INVERTED  ' + _secs + 's', 0, 0);
      ctx.restore();
    }
  }
  // ── End critical status overlays ─────────────────────────────────────────

  drawEdgeIndicators(finalScX, finalScY, camCX, camCY);
  if (typeof drawCinematicLetterbox === 'function') drawCinematicLetterbox();
  // Restore the stable game transform after (remaining draws use it already)
  ctx.setTransform(finalScX, 0, 0, finalScY, canvas.width/2 - camCX*finalScX, canvas.height/2 - camCY*finalScY);

  // Infinite mode: draw win score on canvas (outside shake transform)
  if (infiniteMode && gameRunning) {
    const p1c = players[0] ? players[0].color : '#00d4ff';
    const p2c = players[1] ? players[1].color : '#ff4455';
    ctx.save();
    ctx.textAlign   = 'center';
    ctx.shadowColor = 'rgba(0,0,0,0.95)';
    ctx.shadowBlur  = 14;
    ctx.font        = 'bold 30px Arial';
    ctx.fillStyle   = p1c;
    ctx.fillText(winsP1, GAME_W / 2 - 48, 96);
    ctx.fillStyle   = 'rgba(255,255,255,0.7)';
    ctx.fillText('—', GAME_W / 2, 96);
    ctx.fillStyle   = p2c;
    ctx.fillText(winsP2, GAME_W / 2 + 48, 96);
    ctx.restore();
  }

  // Debug overlay (drawn last, in screen-space)
  if (debugMode) {
    runSanityChecks();
    renderDebugOverlay(ctx);
  }

  // Use error-boundary wrapper if available; fall back to raw rAF
  if (typeof ErrorBoundary !== 'undefined') {
    requestAnimationFrame(ErrorBoundary.wrapLoop(gameLoop));
  } else {
    requestAnimationFrame(gameLoop);
  }
}

