'use strict';
// smb-story-engine-explore2.js — updateExploration, _exploreSpawnEnemy, triggerScene, drawFallenWarriorMemory
// Depends on: smb-globals.js, smb-story-registry.js (and preceding story-engine splits)

function updateExploration() {
  if (!exploreActive || !players[0] || !gameRunning) return;
  const p1 = players[0];
  const activeEnemyCount = minions.filter(m => m.health > 0).length;
  const inCombat = activeEnemyCount > 0 || !!players.find(p => p !== p1 && p.health > 0 && p.isAI);
  exploreCombatQuiet = inCombat ? 0 : (exploreCombatQuiet + 1);
  exploreAmbushTimer++;
  if (exploreArenaLock) {
    p1.x = clamp(p1.x, exploreArenaLock.left, exploreArenaLock.right - p1.w);
    if (currentArena) {
      currentArena.mapLeft = exploreArenaLock.left;
      currentArena.mapRight = exploreArenaLock.right;
    }
    const lockAlive = minions.some(m => m.health > 0 && m.isArenaLockEnemy);
    if (!lockAlive) {
      if (currentArena) {
        currentArena.mapLeft = exploreArenaLock.prevLeft;
        currentArena.mapRight = exploreArenaLock.prevRight;
      }
      storyFightSubtitle = { text: `${exploreArenaLock.label || 'Arena lock'} cleared. Move.`, timer: 150, maxTimer: 150, color: '#88ffcc' };
      exploreArenaLock = null;
    }
  }

  // Far boundary: player wandered far beyond the world — reset the chapter
  const _farLimit = exploreWorldLen + 2500;
  if (p1.x > _farLimit || p1.x < -1200) {
    p1.x = 60; p1.y = 300; p1.vx = 0; p1.vy = 0;
    storyFightSubtitle = { text: '⚠ You wandered too far — back to the start!', timer: 200, maxTimer: 200, color: '#ff6644' };
    screenShake = 30;
    return;
  }

  // Goal reached?
  if (!exploreArenaLock && !exploreGoalFound && p1.x + p1.w >= exploreGoalX && p1.health > 0) {
    exploreGoalFound = true;
    SoundManager.superActivate();
    spawnParticles(exploreGoalX + 20, 380, '#ffffaa', 40);
    // Show completion subtitle
    storyFightSubtitle = { text: `✨ ${exploreGoalName} found! Moving on...`, timer: 200, maxTimer: 200, color: '#ffffaa' };
    // Complete chapter after a short delay
    setTimeout(() => {
      if (!gameRunning) return;
      endGame();
    }, 2200);
  }

  for (let i = 0; i < exploreCheckpoints.length; i++) {
    const cp = exploreCheckpoints[i];
    if (cp.hit || p1.cx() < cp.x || exploreArenaLock) continue;
    cp.hit = true;
    exploreCheckpointIdx = i;
    const safeSpawn = typeof pickSafeSpawnNear === 'function' ? pickSafeSpawnNear(cp.x, 'any') : null;
    if (safeSpawn) {
      p1.spawnX = safeSpawn.x;
      p1.spawnY = safeSpawn.y;
    }
    storyFightSubtitle = {
      text: `Checkpoint secured ${i + 1}/${exploreCheckpoints.length}`,
      timer: 170,
      maxTimer: 170,
      color: '#7dffcc'
    };
    spawnParticles(cp.x, p1.cy(), '#7dffcc', 14);
    if ((_activeStory2Chapter && _activeStory2Chapter.id >= 8) || (storyGauntletState && storyGauntletState.index > 0)) {
      if (!exploreArenaLock && currentArena) {
        exploreArenaLock = {
          left: Math.max(0, cp.x - 240),
          right: Math.min(exploreWorldLen, cp.x + 320),
          prevLeft: currentArena.mapLeft,
          prevRight: currentArena.mapRight,
          label: 'Checkpoint Arena',
        };
        storyFightSubtitle = { text: 'Arena lock engaged. Clear the wave.', timer: 180, maxTimer: 180, color: '#ffcc66' };
      }
      _exploreSpawnEnemy({ wx: cp.x + 80, name: 'Checkpoint Hunter', weaponKey: 'spear', classKey: 'warrior', aiDiff: 'hard', color: '#886644', isElite: true, health: 150, isArenaLockEnemy: true }, p1);
      if ((_activeStory2Chapter && _activeStory2Chapter.id >= 18) || exploreEnemyCap >= 4) {
        _exploreSpawnEnemy({ wx: cp.x + 150, name: 'Checkpoint Warden', weaponKey: 'hammer', classKey: 'tank', aiDiff: 'hard', color: '#556677', isElite: true, health: 170, isArenaLockEnemy: true }, p1);
      }
    }
  }

  for (const portal of exploreSidePortals) {
    if (!portal.active || portal.entered) continue;
    if (Math.abs(p1.cx() - portal.x) < 34 && Math.abs(p1.cy() - portal.y) < 120) {
      _storyEnterSidePortal(portal, p1, _activeStory2Chapter);
    }
  }
  for (const portal of exploreSidePortals) {
    if (!portal || !portal.challengeActive) continue;
    const livePortalEnemy = minions.some(m => m.health > 0 && m.isSidePortalEnemy);
    if (!livePortalEnemy) {
      portal.challengeActive = false;
      _story2.tokens += portal.reward;
      if (portal.type === 'distorted_rift') {
        if (!_story2.metaUpgrades) _story2.metaUpgrades = { damage: 0, survivability: 0, healUses: 0 };
        _story2.metaUpgrades.damage = Math.min(6, _story2.metaUpgrades.damage + 1);
      }
      _saveStory2();
      storyFightSubtitle = {
        text: portal.type === 'distorted_rift'
          ? `Distorted Rift conquered — +${portal.reward} 🪙 and +1 damage rank.`
          : `Side portal cleared — +${portal.reward} 🪙`,
        timer: 220,
        maxTimer: 220,
        color: portal.type === 'distorted_rift' ? '#ff88ff' : '#88ffcc'
      };
    }
  }

  if (exploreCombatQuiet > 260 && activeEnemyCount < exploreEnemyCap) {
    const spawnAhead = p1.x + GAME_W * 0.92;
    _exploreSpawnEnemy({
      wx: spawnAhead,
      name: 'Pressure Stalker',
      weaponKey: _activeStory2Chapter && _activeStory2Chapter.id >= 18 ? 'spear' : 'sword',
      classKey: _activeStory2Chapter && _activeStory2Chapter.id >= 20 ? 'assassin' : 'warrior',
      aiDiff: _activeStory2Chapter && _activeStory2Chapter.id >= 24 ? 'hard' : 'medium',
      color: '#665544'
    }, p1);
    exploreCombatQuiet = 120;
  }

  if (exploreAmbushTimer > 360 && Math.abs(p1.vx) < 1.1 && !inCombat && activeEnemyCount < exploreEnemyCap) {
    _exploreSpawnEnemy({
      wx: p1.x + 120,
      name: 'Ambush Elite',
      weaponKey: 'axe',
      classKey: 'berserker',
      aiDiff: _activeStory2Chapter && _activeStory2Chapter.id >= 25 ? 'expert' : 'hard',
      color: '#994444',
      isElite: true,
      health: 165
    }, p1);
    exploreAmbushTimer = 0;
    storyFightSubtitle = { text: 'Passive too long. An elite found you.', timer: 170, maxTimer: 170, color: '#ff7766' };
  }

  // Spawn enemies from queue as player advances
  // Guards (isGuard:true) bypass the cap and spawn immediately at world load
  // Regular enemies are capped at exploreEnemyCap concurrent
  const activeRegularCount = minions.filter(m => m.health > 0 && !m.isExploreGuard).length;
  if (exploreSpawnQ.length > 0) {
    const next = exploreSpawnQ[0];
    if (next) {
      const isGuard = !!next.isGuard;
      const readyToSpawn = isGuard
        ? !minions.some(m => m.isExploreGuard && m._guardX === next.wx) // guard not yet spawned
        : (activeRegularCount < exploreEnemyCap && p1.x + GAME_W * 0.8 >= next.wx);
      if (readyToSpawn) {
        exploreSpawnQ.shift();
        _exploreSpawnEnemy(next, p1);
      }
    }
  }
}

function _exploreSpawnEnemy(def, p1) {
  const isGuard = !!def.isGuard;
  // Guards spawn directly at their post (near the relic), not offset from player
  const spawnX = isGuard ? def.wx : Math.max(p1.x + GAME_W * 0.7, def.wx);
  const safeSpawn = typeof pickSafeSpawnNear === 'function'
    ? pickSafeSpawnNear(spawnX, isGuard ? 'any' : 'right', p1 ? p1.x : undefined)
    : null;
  const m = new Minion(safeSpawn ? safeSpawn.x : spawnX, safeSpawn ? safeSpawn.y - 60 : 300, def.color || '#888888', def.weaponKey || 'sword', true, def.aiDiff || 'medium');
  m.name     = def.name || 'Enemy';
  m.lives    = 1;
  m.health   = isGuard ? (def.health || 120) : 80;
  m.maxHealth= isGuard ? (def.health || 120) : 80;
  m.dmgMult  = isGuard ? 1.2 : 1.0;
  if (isGuard) {
    m.isExploreGuard = true;
    m._guardX = def.wx; // the x position they guard
  }
  if (def.isArenaLockEnemy) m.isArenaLockEnemy = true;
  if (def.isSidePortalEnemy) m.isSidePortalEnemy = true;
  if (def.classKey && def.classKey !== 'none' && typeof applyClass === 'function') {
    applyClass(m, def.classKey);
  }
  _storyScaleEnemyUnit(m, _activeStory2Chapter ? _activeStory2Chapter.id : 1, { elite: !!def.isElite });
  if (def.armor && typeof storyApplyArmor === 'function') {
    storyApplyArmor(m, def.armor);
  }
  m.storyFaction = 'enemy';
  m._teamId = 2;
  m.target = p1;
  p1.storyFaction = 'player';
  p1._teamId = 1;
  p1.target = m; // P1 targets most recently spawned
  minions.push(m);
}

// ── Fallen Warrior Memory ─────────────────────────────────────────────────────
// A rare (~10%) ambient scene that fires once per fight in late-game chapters
// (id >= 60) to build tension before/during the TrueForm arc.
// Shows a silhouette warrior fighting, then being instantly defeated.
// ─────────────────────────────────────────────────────────────────────────────

let _fallenWarrior = null; // null when inactive

/**
 * Trigger a named ambient scene.  Currently only "fallen_warrior_memory".
 * Safe to call multiple times — ignored if the scene is already playing or
 * if the fight-level flag is already set.
 */
function triggerScene(name) {
  if (!storyModeActive || !gameRunning) return;
  if (name !== 'fallen_warrior_memory') return;
  if (storyEventFired['FALLEN_WARRIOR']) return; // once per fight
  if (_fallenWarrior) return; // already playing

  storyEventFired['FALLEN_WARRIOR'] = true;
  _fallenWarrior = {
    timer:    0,
    duration: 168, // 2.8 s at 60 fps
  };
}

/**
 * Draw the fallen warrior memory overlay in screen-space.
 * Called from smc-loop.js after drawStoryPhaseHUD().
 */
function drawFallenWarriorMemory() {
  if (!_fallenWarrior) return;
  _fallenWarrior.timer++;
  const f   = _fallenWarrior.timer;       // 1 … 168
  const DUR = _fallenWarrior.duration;

  if (f > DUR) { _fallenWarrior = null; return; }

  const cw  = canvas.width;
  const ch  = canvas.height;
  const cx  = cw * 0.5;
  const cy  = ch * 0.5;
  const scY = ch / GAME_H; // logical-to-screen Y scale

  // ── Envelope alphas ──────────────────────────────────────────
  // Fade in  : f  0 → 20
  // Hold     : f 20 → 140
  // Fade out : f 140 → 168
  const fadeIn  = Math.min(1, f / 20);
  const fadeOut = f > 140 ? 1 - (f - 140) / 28 : 1;
  const baseA   = Math.min(fadeIn, fadeOut);

  ctx.save();

  // ── Background vignette ──────────────────────────────────────
  const vg = ctx.createRadialGradient(cx, cy, 0, cx, cy, cw * 0.55);
  vg.addColorStop(0,   `rgba(0,0,0,${(baseA * 0.82).toFixed(3)})`);
  vg.addColorStop(0.6, `rgba(0,0,0,${(baseA * 0.72).toFixed(3)})`);
  vg.addColorStop(1,   `rgba(0,0,0,0)`);
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, cw, ch);

  // ── Silhouette drawing helper ─────────────────────────────────
  // Draws a simple stickman silhouette at (sx, sy) facing dir (+1/-1),
  // scaled by s, with action pose based on phase.
  function _drawSilhouette(sx, sy, s, dir, pose) {
    ctx.save();
    ctx.translate(sx, sy);
    ctx.scale(dir * s, s);
    ctx.fillStyle   = `rgba(0,0,0,${baseA.toFixed(3)})`;
    ctx.strokeStyle = `rgba(200,200,255,${(baseA * 0.55).toFixed(3)})`;
    ctx.lineWidth   = 2 / s;
    ctx.shadowColor = 'rgba(150,150,255,0.4)';
    ctx.shadowBlur  = 8 / s;

    // Head
    ctx.beginPath();
    ctx.arc(0, -50 * scY, 7 * scY, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();

    // Body
    ctx.beginPath();
    ctx.moveTo(0, -43 * scY);
    ctx.lineTo(0, -18 * scY);
    ctx.stroke();

    if (pose === 'stand') {
      // Arms down
      ctx.beginPath();
      ctx.moveTo(0, -38 * scY); ctx.lineTo(-12 * scY, -26 * scY);
      ctx.moveTo(0, -38 * scY); ctx.lineTo( 12 * scY, -26 * scY);
      ctx.stroke();
      // Legs
      ctx.beginPath();
      ctx.moveTo(0, -18 * scY); ctx.lineTo(-9 * scY, 0);
      ctx.moveTo(0, -18 * scY); ctx.lineTo( 9 * scY, 0);
      ctx.stroke();

    } else if (pose === 'attack') {
      // Punch arm forward
      ctx.beginPath();
      ctx.moveTo(0, -38 * scY); ctx.lineTo( 22 * scY, -36 * scY);
      ctx.moveTo(0, -38 * scY); ctx.lineTo(-10 * scY, -28 * scY);
      ctx.stroke();
      // Stride legs
      ctx.beginPath();
      ctx.moveTo(0, -18 * scY); ctx.lineTo(-12 * scY,  2 * scY);
      ctx.moveTo(0, -18 * scY); ctx.lineTo( 10 * scY, -2 * scY);
      ctx.stroke();

    } else if (pose === 'fly') {
      // Ragdoll — arms/legs splayed
      ctx.beginPath();
      ctx.moveTo(0, -38 * scY); ctx.lineTo(-18 * scY, -32 * scY);
      ctx.moveTo(0, -38 * scY); ctx.lineTo( 14 * scY, -44 * scY);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, -18 * scY); ctx.lineTo(-14 * scY,  4 * scY);
      ctx.moveTo(0, -18 * scY); ctx.lineTo( 16 * scY,  8 * scY);
      ctx.stroke();
    }
    ctx.restore();
  }

  // ── Phase logic ──────────────────────────────────────────────
  // Phase A  (f  1-40): warrior stands, facing the enemy (off-screen right)
  // Phase B  (f 41-70): warrior lunges — attack pose, slides forward
  // Phase C  (f 71-90): white flash + instant defeat — warrior flies left
  // Phase D  (f 91-140): warrior lies on ground; "THEY FAILED." text
  // Phase E  (f 141-168): fade out

  const sfX  = cx - cw * 0.10; // warrior screen X at rest
  const sfY  = cy + ch * 0.14; // feet level (mid-lower screen)

  if (f <= 40) {
    // Stand
    _drawSilhouette(sfX, sfY, 1, 1, 'stand');

  } else if (f <= 70) {
    // Lunge: slide right
    const prog = (f - 40) / 30;
    _drawSilhouette(sfX + prog * cw * 0.15, sfY, 1, 1, 'attack');

  } else if (f <= 90) {
    // Impact flash + fly
    const prog = (f - 70) / 20;
    // White flash (fades fast)
    if (f <= 76) {
      const flashA = (1 - (f - 70) / 6) * baseA * 0.7;
      ctx.fillStyle = `rgba(255,255,255,${flashA.toFixed(3)})`;
      ctx.fillRect(0, 0, cw, ch);
    }
    // Warrior flying left and up
    const flyX = sfX + cw * 0.15 - prog * cw * 0.30;
    const flyY = sfY - prog * ch * 0.16 + prog * prog * ch * 0.20; // arc
    _drawSilhouette(flyX, flyY, 1, -1, 'fly');

  } else if (f <= 140) {
    // Crumpled on ground
    const crumpX = sfX + cw * 0.15 - cw * 0.30;
    _drawSilhouette(crumpX, sfY, 1, -1, 'fly');

    // "THEY FAILED." text — fades in between f 95-115
    const textA = Math.min(1, (f - 95) / 20) * baseA;
    if (textA > 0) {
      const fs = Math.round(cw * 0.030);
      ctx.font        = `900 ${fs}px 'Arial Black', Arial, sans-serif`;
      ctx.textAlign   = 'center';
      ctx.letterSpacing = '0.12em';
      // Shadow
      ctx.shadowColor = 'rgba(100,80,200,0.9)';
      ctx.shadowBlur  = 18;
      ctx.fillStyle   = `rgba(220,210,255,${textA.toFixed(3)})`;
      ctx.fillText('THEY FAILED.', cx, cy - ch * 0.22);
      // Thin underline rule
      ctx.shadowBlur  = 0;
      ctx.strokeStyle = `rgba(200,180,255,${(textA * 0.35).toFixed(3)})`;
      ctx.lineWidth   = 1;
      const tw = ctx.measureText('THEY FAILED.').width;
      ctx.beginPath();
      ctx.moveTo(cx - tw * 0.5, cy - ch * 0.22 + fs * 0.25);
      ctx.lineTo(cx + tw * 0.5, cy - ch * 0.22 + fs * 0.25);
      ctx.stroke();
    }
  }
  // Phase E: just the envelope fades — nothing extra to draw

  ctx.restore();
}
