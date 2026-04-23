'use strict';
// smb-menu-startcore.js — _startGameCore: full game initialisation sequence
// Depends on: smb-globals.js, smb-fighter.js, smb-enemies.js, smb-menu-spawn.js
// Must load AFTER smb-menu-spawn.js, BEFORE smb-menu-utils.js

function _startGameCore() {
  document.getElementById('menu').style.display            = 'none';
  document.getElementById('gameOverOverlay').style.display  = 'none';
  document.getElementById('pauseOverlay').style.display     = 'none';
  canvas.style.display = 'block';
  document.getElementById('hud').style.display = 'flex';

  // Show chat widget if online
  const chatEl = document.getElementById('onlineChat');
  if (chatEl) chatEl.style.display = onlineMode ? 'flex' : 'none';

  // Resolve arena
  const isBossMode         = gameMode === 'boss';
  const isTrueFormMode     = gameMode === 'trueform';
  const isGodMode          = gameMode === 'god';
  const isDamnationMode    = gameMode === 'damnation';
  const isTrainingMode     = gameMode === 'training';
  // Online: force 2P-compatible variants so guest doesn't get assigned to boss/dummy
  if (onlineMode && isBossMode && bossPlayerCount !== 2) bossPlayerCount = 2;
  if (onlineMode && isTrainingMode) training2P = true;
  const isMinigamesMode    = gameMode === 'minigames';
  const isExploreMode      = gameMode === 'exploration';
  const isAdaptiveMode     = gameMode === 'adaptive' || gameMode === 'sovereign';
  const isSovereignMode    = gameMode === 'sovereign';
  const isCompleteRandMode = gameMode === '2p' && completeRandomizer;
  const isMultiverseMode   = gameMode === 'multiverse';
  const isBossLivesMode    = isBossMode || isTrueFormMode;
  _setBossFightLivesLock(isBossLivesMode);
  trainingMode = isTrainingMode;
  tutorialMode = false; // tutorial mode removed
  if (isGodMode) {
    currentArenaKey = 'creator'; // reuse creator arena for the god encounter
  } else if (isMultiverseMode) {
    const mvWorld = (typeof MultiverseManager !== 'undefined') ? MultiverseManager.getActiveWorld() : null;
    currentArenaKey = (mvWorld && mvWorld.arenaKey) ? mvWorld.arenaKey : 'homeAlley';
  } else if (isBossMode) {
    currentArenaKey = 'creator';
  } else if (isTrueFormMode) {
    currentArenaKey = 'void';
    resetTFState();
  } else if (isDamnationMode) {
    currentArenaKey = 'damnation';
    if (typeof resetDamnationState === 'function') resetDamnationState();
  } else if (isExploreMode) {
    currentArenaKey = '__explore__';
  } else if (isMinigamesMode) {
    if (minigameType === 'soccer') {
      currentArenaKey = 'soccer';
    } else {
      // Pick a random arena from the standard PvP selection
      const arenaPool = ARENA_KEYS_ORDERED.filter(k => ARENAS[k] && !ARENAS[k].isStoryOnly);
      currentArenaKey = randChoice(arenaPool);
    }
  } else if (isCompleteRandMode) {
    const arenaPool = ARENA_KEYS_ORDERED.filter(k => ARENAS[k] && !ARENAS[k].isStoryOnly);
    currentArenaKey = randChoice(arenaPool);
  } else {
    // Only standard PvP arenas (ARENA_KEYS_ORDERED) available for random pick
    const arenaPool = ARENA_KEYS_ORDERED.filter(k => ARENAS[k] && !ARENAS[k].isStoryOnly);
    // If a story-only arena was somehow selected outside story mode, fall back to random
    const isStoryOnlyArena = ARENAS[selectedArena] && ARENAS[selectedArena].isStoryOnly;
    if (isStoryOnlyArena && !storyModeActive) {
      currentArenaKey = randChoice(arenaPool);
    } else {
      currentArenaKey = selectedArena === 'random' ? randChoice(arenaPool) : selectedArena;
    }
  }
  isRandomMapMode = (selectedArena === 'random' && !isCompleteRandMode);
  // Lava/void: no randomization
  if (currentArenaKey !== 'creator' && currentArenaKey !== 'lava' && currentArenaKey !== 'void' && currentArenaKey !== 'soccer' && currentArenaKey !== 'damnation' && !isExploreMode) randomizeArenaLayout(currentArenaKey);
  currentArena = ARENAS[currentArenaKey];
  if (typeof buildGraphForCurrentArena === 'function') buildGraphForCurrentArena();
  initMapPerks(currentArenaKey);

  // Online host: broadcast authoritative game state to guest BEFORE creating fighters
  if (onlineMode && onlineLocalSlot === 1 && typeof NetworkManager !== 'undefined' && NetworkManager.connected) {
    const syncState = {
      arenaKey:  currentArenaKey,
      gameMode:  gameMode,
      lives:     chosenLives,
      p1Weapon:  document.getElementById('p1Weapon')?.value || 'sword',
      p2Weapon:  document.getElementById('p2Weapon')?.value || 'sword',
      p1Class:   document.getElementById('p1Class')?.value  || 'none',
      p2Class:   document.getElementById('p2Class')?.value  || 'none',
      platforms: (ARENAS[currentArenaKey]?.platforms || []).map(pl => ({ x: pl.x, y: pl.y, w: pl.w })),
    };
    NetworkManager.sendGameStateSync(syncState);
  }

  // Resolve weapons & classes together — handles 50/50 when both are 'random'
  // Complete Randomizer is a 1v1 modifier: force random arena + weapon + class
  const _p1Resolved = isCompleteRandMode ? resolveWeaponAndClassValues('random', 'random') : resolveWeaponAndClass('p1Weapon', 'p1Class');
  const _p2Resolved = isCompleteRandMode ? resolveWeaponAndClassValues('random', 'random') : resolveWeaponAndClass('p2Weapon', 'p2Class');
  let w1 = _p1Resolved.weaponKey;
  let w2 = _p2Resolved.weaponKey;
  // Story mode: HARD enforce no ranged weapons for human players at game start
  if (storyModeActive) {
    const _isMeleeOnly = (key) => typeof WEAPONS !== 'undefined' && WEAPONS[key] && WEAPONS[key].type === 'ranged';
    if (_isMeleeOnly(w1)) w1 = 'sword';
    if (_isMeleeOnly(w2)) w2 = 'sword';
  }
  // Store resolved class keys so applyClass calls below use the coordinated result
  const _p1ResolvedClass = _p1Resolved.classKey;
  const _p2ResolvedClass = _p2Resolved.classKey;
  const c1   = document.getElementById('p1Color').value;
  const c2   = document.getElementById('p2Color').value;
  const p1Diff = (document.getElementById('p1Difficulty')?.value) || 'hard';
  const p2Diff = (document.getElementById('p2Difficulty')?.value) || 'hard';
  const diff   = p2Diff; // legacy alias used below for p2
  const isBot  = p2IsBot; // bot determined by P2 toggle, not separate mode

  // Generate bg elements fresh each game
  generateBgElements();

  // Reset state — stop menu background loop
  menuLoopRunning    = false;
  frameCount         = 0; // reset per-game frame counter (used for yeti min-spawn delay)
  projectiles        = [];
  particles          = [];
  verletRagdolls     = [];
  damageTexts        = [];
  respawnCountdowns  = [];
  minions            = [];
  forestBeast        = null;
  forestBeastCooldown = 0;
  yeti               = null;
  yetiCooldown       = 0;
  bossBeams          = [];
  bossSpikes         = [];
  if (typeof resetBossWarnings === 'function') resetBossWarnings();
  trainingDummies    = [];
  bossDialogue       = { text: '', timer: 0 };
  backstagePortals   = [];
  lightningBolts     = [];
  bossDeathScene     = null;
  fakeDeath          = { triggered: false, active: false, timer: 0, player: null };
  if (typeof resetParadoxState === 'function') resetParadoxState();
  mapItems           = [];
  mapPerkState       = {};
  winsP1             = 0;
  winsP2             = 0;
  screenShake     = 0;
  frameCount      = 0;
  paused          = false;
  // Reset timing globals — prevent stale slow-motion / hitstop from previous game
  slowMotion      = 1.0;
  hitStopFrames   = 0;
  hitSlowTimer    = 0;
  storyFreezeTimer = 0;
  gameFrozen      = false; // ensure cinematic freeze is cleared on new game start
  if (typeof _lastFrameTime !== 'undefined') _lastFrameTime = 0;
  if (typeof resetDirector === 'function') resetDirector();

  // Reset camera zoom
  camZoomCur = 1; camZoomTarget = 1;
  camXCur = GAME_W / 2; camYCur = GAME_H / 2;
  camXTarget = GAME_W / 2; camYTarget = GAME_H / 2;
  camHitZoomTimer = 0;
  // Reset duel-cam state so it doesn't carry stale midpoint from previous match
  if (typeof _duelMidX !== 'undefined') { _duelMidX = GAME_W / 2; _duelMidY = GAME_H / 2; _duelFallDelay = 0; }
  aiTick = 0;
  // Reset boss floor state for every game start
  bossFloorState = 'normal';
  bossFloorType  = 'lava';
  bossFloorTimer = 1500;
  bossPhaseFlash = 0;
  // Restore creator arena floor platform in case a previous game left it disabled
  if (ARENAS.creator) {
    const floorPl = ARENAS.creator.platforms.find(p => p.isFloor);
    if (floorPl) floorPl.isFloorDisabled = false;
    ARENAS.creator.hasLava = false;
    ARENAS.creator.deathY  = 640;
  }

  // Player 1  (W/A/D move · S=shield · Space=attack · Q=ability)
  const p1 = new Fighter(160, 300, c1, w1, { left:'a', right:'d', jump:'w', attack:' ', shield:'s', ability:'q', super:'e' }, p1IsBot, p1Diff);
  p1.playerNum = 1; p1.name = p1IsBot ? 'BOT1' : 'P1'; p1.lives = chosenLives;
  const _p1SpawnPos = pickSafeSpawn('left') || { x: 160, y: 300 };
  p1.spawnX = _p1SpawnPos.x; p1.spawnY = _p1SpawnPos.y; p1.x = _p1SpawnPos.x; p1.y = _p1SpawnPos.y - p1.h;
  p1.hat  = document.getElementById('p1Hat')?.value  || 'none';
  p1.cape = document.getElementById('p1Cape')?.value || 'none';
  if (p1Skin !== 'default' && SKIN_COLORS[p1Skin]) p1.color = SKIN_COLORS[p1Skin];
  p1.weaponTheme = (p1WeaponSkin && p1WeaponSkin !== 'default') ? p1WeaponSkin : null;
  // Story mode: if class is locked for this chapter, ignore player's class selection
  const _storyClassLocked = storyModeActive && storyPlayerOverride && storyPlayerOverride.noClass;
  applyClass(p1, _storyClassLocked ? 'none' : _p1ResolvedClass);
  // If player explicitly chose a weapon (not random), restore it after applyClass
  // so archer/paladin class doesn't forcefully override the selected weapon
  if (document.getElementById('p1Weapon')?.value && document.getElementById('p1Weapon').value !== 'random'
      && !isCompleteRandMode) {
    const _w1Obj = (w1 && w1.startsWith('_custom_') && window.CUSTOM_WEAPONS && window.CUSTOM_WEAPONS[w1])
                   ? window.CUSTOM_WEAPONS[w1]
                   : (typeof WEAPONS !== 'undefined' && WEAPONS[w1] ? WEAPONS[w1] : null);
    if (_w1Obj) { p1.weaponKey = w1; p1.weapon = _w1Obj; p1._ammo = p1.weapon.clipSize || 0; }
  }
  // Story mode: apply per-level player restrictions (weak human → powerful fighter progression)
  if (storyModeActive && storyPlayerOverride) {
    const _sc = storyPlayerOverride;
    if (_sc.speedMult !== undefined) p1.classSpeedMult = _sc.speedMult;
    if (_sc.dmgMult   !== undefined) p1.dmgMult        = _sc.dmgMult;
    if (_sc.weapon && typeof WEAPONS !== 'undefined' && WEAPONS[_sc.weapon]) {
      p1.weapon = WEAPONS[_sc.weapon]; p1.weaponKey = _sc.weapon;
    }
    p1._storyNoAbility    = !!_sc.noAbility;
    p1._storyNoSuper      = !!_sc.noSuper;
    p1._storyNoDoubleJump = !!_sc.noDoubleJump;
    p1._noDoubleJump      = !!_sc.noDoubleJump;  // unified flag checked in smb-loop.js
    p1._storyNoDodge      = !!_sc.noDodge;
  }
  // Auto-equip saved custom weapon only when the player is not explicitly
  // asking for random weapons/classes. Random mode should stay random.
  const _p1WeaponSel = document.getElementById('p1Weapon')?.value || 'sword';
  if (!storyModeActive && !isBossMode && gameMode !== 'trueform'
      && !isCompleteRandMode
      && _p1WeaponSel !== 'random'
      && (!onlineMode || onlineAllowCustomWeapons)
      && typeof loadCustomWeaponSelection === 'function') {
    const _cwKey = loadCustomWeaponSelection();
    if (_cwKey && window.CUSTOM_WEAPONS && window.CUSTOM_WEAPONS[_cwKey]) {
      p1.weapon    = window.CUSTOM_WEAPONS[_cwKey];
      p1.weaponKey = _cwKey;
    }
  }
  // Megaknight spawn fall
  if (p1.charClass === 'megaknight') { p1.y = -120; p1.vy = 2; p1._spawnFalling = true; p1.invincible = 200; }

  // Player 2 / Bot / Boss / Training Dummy
  let p2;
  if (isBossMode) {
    const _guestOnline = typeof onlineMode !== 'undefined' && onlineMode
      && typeof NetworkManager !== 'undefined' && !NetworkManager.isHost();
    const boss = (storyBossType === 'fallen_god' && typeof FallenGod !== 'undefined') ? new FallenGod() : new Boss();
    // Online guests: mark boss as remote so loop skips its AI
    if (_guestOnline) { boss.isRemote = true; boss.isAI = false; }
    // True Creator mode: significantly harder boss (requires TRUEFORM code)
    // Skipped in story mode — story has its own boss scaling below
    if (unlockedTrueBoss && !storyModeActive) {
      boss.health            = 4500;
      boss.maxHealth         = 4500;
      boss.attackCooldownMult = 0.28;
      boss.kbBonus           = 2.5;
      boss.kbResist          = 0.25;
      boss.name              = 'CREATOR';
      boss.color             = '#ff00ee';
    }
    // Story mode: scale boss to be challenging but beatable
    if (storyModeActive) {
      boss.health            = 800;
      boss.maxHealth         = 800;
      boss.dmgMult           = 0.65;
      boss.attackCooldownMult = 1.3;
      boss.kbBonus           = 1.2;
    }
    // Fallen God: apply health multiplier on top of story scaling
    if (boss.isFallenGod && boss._healthMult) {
      boss.health    = Math.round(boss.health    * boss._healthMult);
      boss.maxHealth = Math.round(boss.maxHealth * boss._healthMult);
    }
    if (bossPlayerCount === 2 && !storyModeActive) {
      // 2P boss: harder boss
      boss.attackCooldownMult = 0.38; // ~1.3x faster attacks than 1P
      boss.kbBonus            = 2.0;  // 1.33x more KB than 1P
      boss.health             *= 1.5; // 1.5x more HP
      boss.maxHealth          = boss.health;
      // Spawn real P2 alongside boss (can be human or bot)
      const w2b  = _p2ResolvedClass !== 'none' && typeof CLASSES !== 'undefined' && CLASSES[_p2ResolvedClass]?.weapon
                   ? CLASSES[_p2ResolvedClass].weapon : w2;
      const c2b  = document.getElementById('p2Color').value;
      const p2h  = new Fighter(720, 300, c2b, w2b, { left:'ArrowLeft', right:'ArrowRight', jump:'ArrowUp', attack:'Enter', shield:'ArrowDown', ability:'.', super:'/' }, p2IsBot, diff);
      p2h.playerNum = 2; p2h.name = p2IsBot ? 'BOT' : 'P2'; p2h.lives = chosenLives;
      { const _sp2 = pickSafeSpawn('right', _p1SpawnPos.x) || { x: 720, y: 300 };
        p2h.spawnX = _sp2.x; p2h.spawnY = _sp2.y; p2h.x = _sp2.x; p2h.y = _sp2.y - p2h.h; }
      p2h.hat  = document.getElementById('p2Hat')?.value  || 'none';
      p2h.cape = document.getElementById('p2Cape')?.value || 'none';
      applyClass(p2h, _p2ResolvedClass);
      if (p2h.charClass === 'megaknight') { p2h.y = -120; p2h.vy = 2; p2h._spawnFalling = true; p2h.invincible = 200; }
      if (p2h.isAI) p2h.target = boss; // bot targets boss
      players = [p1, p2h, boss];
      p1.target  = boss;
      p2h.target = boss;
      boss.target = p1;
      p2 = p2h; // for HUD reference
    } else {
      p2 = boss;
      players = [p1, p2];
      p1.target = p2;
      p2.target = p1;
    }
  } else if (isMultiverseMode) {
    // Multiverse: P1 vs AI fighter configured by the pending encounter
    p1.isAI  = false;
    p1.lives = (_pendingMultiverseEncounter && _pendingMultiverseEncounter.lives) || 3;
    const _mvEnc = (typeof _pendingMultiverseEncounter !== 'undefined' && _pendingMultiverseEncounter) || {};
    const _mvSpawn = pickSafeSpawn('right', _p1SpawnPos.x) || { x: 720, y: 300 };
    const mvEnemy = new Fighter(
      _mvSpawn.x, _mvSpawn.y,
      _mvEnc.color || '#778899',
      _mvEnc.weaponKey || 'sword',
      null, // AI-controlled
      true,
      _mvEnc.aiDiff || 'hard'
    );
    mvEnemy.playerNum = 2;
    mvEnemy.name      = _mvEnc.opponentName || 'Dimensional Fighter';
    mvEnemy.lives     = p1.lives;
    mvEnemy.spawnX    = _mvSpawn.x; mvEnemy.spawnY = _mvSpawn.y;
    mvEnemy.x = _mvSpawn.x; mvEnemy.y = _mvSpawn.y - mvEnemy.h;
    if (typeof applyClass === 'function') applyClass(mvEnemy, _mvEnc.classKey || 'warrior');
    if (Array.isArray(_mvEnc.armor)) {
      mvEnemy.armorPieces = [..._mvEnc.armor];
    }
    if (_mvEnc.isBossEnc) mvEnemy.isBoss = false; // treat as strong AI, not actual boss class
    p2 = mvEnemy;
    players = [p1, mvEnemy];
    p1.target = mvEnemy; mvEnemy.target = p1;

    // Optional second enemy (elite/survival encounters)
    if (_mvEnc.twoEnemies) {
      const _mvSpawn2 = pickSafeSpawn('right', _mvSpawn.x + 80) || { x: 760, y: 300 };
      const mvEnemy2  = new Fighter(
        _mvSpawn2.x, _mvSpawn2.y,
        _mvEnc.secondColor || '#667788',
        _mvEnc.weaponKey || 'sword',
        null, true, _mvEnc.aiDiff || 'hard'
      );
      mvEnemy2.playerNum = 3;
      mvEnemy2.name      = (_mvEnc.opponentName || 'Fighter') + ' II';
      mvEnemy2.lives     = p1.lives;
      mvEnemy2.spawnX    = _mvSpawn2.x; mvEnemy2.spawnY = _mvSpawn2.y;
      mvEnemy2.x = _mvSpawn2.x; mvEnemy2.y = _mvSpawn2.y - mvEnemy2.h;
      if (typeof applyClass === 'function') applyClass(mvEnemy2, _mvEnc.classKey || 'warrior');
      mvEnemy2.target = p1;
      players.push(mvEnemy2);
    }

    // Clear pending so it doesn't persist across fights
    _pendingMultiverseEncounter = null;

    // Fire multiverse fight start hooks (scaling, modifiers)
    if (typeof MultiverseManager !== 'undefined') MultiverseManager.onFightStart();

  } else if (isAdaptiveMode) {
    // Adaptive AI: P1 vs the learning AdaptiveAI opponent
    // Sovereign mode uses SovereignMK2 (enhanced); story adaptive uses base AdaptiveAI
    p1.isAI  = false;
    p1.lives = chosenLives;
    // Pick a weapon for the AI — random from a balanced set
    const _aiWeapons = ['sword','axe','spear','hammer','scythe','voidblade'];
    const _aiWeapon  = _aiWeapons[Math.floor(Math.random() * _aiWeapons.length)];
    const ai = isSovereignMode
      ? new SovereignMK2(720, 300, '#ff3311', _aiWeapon)
      : new AdaptiveAI(720, 300, '#9955ee', _aiWeapon);
    ai.playerNum = 2;
    ai.lives     = chosenLives;
    const _aiSpawn = pickSafeSpawn('right', _p1SpawnPos.x) || { x: 720, y: 300 };
    ai.spawnX = _aiSpawn.x; ai.spawnY = _aiSpawn.y;
    ai.x = _aiSpawn.x;      ai.y = _aiSpawn.y - ai.h;
    p2 = ai;
    players = [p1, ai];
    p1.target = ai;
    ai.target = p1;
  } else if (isDamnationMode) {
    // Eternal Damnation arc: P1 solo, wave manager spawns echoes dynamically
    p1.isAI  = false;
    p1.lives = 9999;   // damnationDeaths manages progression, not lives
    players  = [p1];
    p1.target = null;
    damnationActive = true;
    if (typeof spawnDamnationWave === 'function') spawnDamnationWave();
  } else if (isTrueFormMode) {
    // True Form: solo — P1 vs True Form boss, void arena, no 2P
    p1.isAI = false;
    p1.lives = chosenLives;
    const tf = new TrueForm();
    // Story mode: scale TrueForm to be challenging but beatable
    if (storyModeActive) {
      tf.health            = 1500;
      tf.maxHealth         = 1500;
      tf.dmgMult           = 0.65;
      tf.attackCooldownMult = 1.25;
    }
    tf.target = p1;
    p1.target = tf;
    p2 = tf;
    players = [p1, tf];
    // Damnation scar bonus: surviving the echo gives 10% extra damage
    if (storyModeActive) {
      try {
        if (window.GameState && GameState.getActiveAccount()?.data?.unlocks?.damnationScar) {
          p1.dmgMult = (p1.dmgMult || 1.0) * 1.10;
          p1._hasDamnationScar = true;
        }
      } catch(e) {}
    }
  } else if (isTrainingMode) {
    if (training2P) {
      // 2P training: both fighters present, shared dummy
      p2 = new Fighter(720, 300, c2, w2, { left:'ArrowLeft', right:'ArrowRight', jump:'ArrowUp', attack:'Enter', shield:'ArrowDown', ability:'.', super:'/' }, p2IsBot, diff);
      p2.playerNum = 2; p2.name = p2IsBot ? 'BOT' : 'P2'; p2.lives = 999;
      { const _sp2 = pickSafeSpawn('right', _p1SpawnPos.x) || { x: 720, y: 300 };
        p2.spawnX = _sp2.x; p2.spawnY = _sp2.y; p2.x = _sp2.x; p2.y = _sp2.y - p2.h; }
      applyClass(p2, _p2ResolvedClass);
      if (p2.charClass === 'megaknight') { p2.y = -120; p2.vy = 2; p2._spawnFalling = true; p2.invincible = 200; }
      const starterDummy = new Dummy(450, 200);
      starterDummy.playerNum = 3; starterDummy.name = 'DUMMY';
      trainingDummies.push(starterDummy);
      players = [p1, p2];
      p1.target = p2; p2.target = p1;
      p1.lives = 999;
    } else {
      // Standard training: P1 vs dummy
      const starterDummy = new Dummy(720, 300);
      starterDummy.playerNum = 2; starterDummy.name = 'DUMMY';
      trainingDummies.push(starterDummy);
      players = [p1];
      p1.target = starterDummy; starterDummy.target = p1;
    }
  } else if (isMinigamesMode) {
    // Minigames: P1 always human; survival/koth both support optional P2
    p1.isAI = false;
    p1.lives = (minigameType === 'survival') ? 1 : 99; // survival: 1 life; koth/chaos/soccer: infinite (99)
    if (minigameType === 'koth' || minigameType === 'chaos' || minigameType === 'soccer' || (minigameType === 'survival' && !p2IsNone)) {
      const p2mg = new Fighter(720, 300, c2, w2,
        { left:'ArrowLeft', right:'ArrowRight', jump:'ArrowUp', attack:'Enter',
          shield:'ArrowDown', ability:'.', super:'/' }, p2IsBot, p2Diff);
      p2mg.playerNum = 2; p2mg.name = p2IsBot ? 'BOT' : 'P2';
      p2mg.lives = (minigameType === 'survival') ? 1 : 99;
      { const _sp2 = pickSafeSpawn('right', _p1SpawnPos.x) || { x: 720, y: 300 };
        p2mg.spawnX = _sp2.x; p2mg.spawnY = _sp2.y; p2mg.x = _sp2.x; p2mg.y = _sp2.y - p2mg.h; }
      p2mg.hat  = document.getElementById('p2Hat')?.value  || 'none';
      p2mg.cape = document.getElementById('p2Cape')?.value || 'none';
      if (p2Skin !== 'default' && SKIN_COLORS[p2Skin]) p2mg.color = SKIN_COLORS[p2Skin];
      p2mg.weaponTheme = (p2WeaponSkin && p2WeaponSkin !== 'default') ? p2WeaponSkin : null;
      applyClass(p2mg, _p2ResolvedClass);
      players = [p1, p2mg];
      if (minigameType === 'koth' || minigameType === 'chaos') { p1.target = p2mg; p2mg.target = p1; }
      else if (minigameType === 'soccer') {
        p1.lives = 99; p2mg.lives = 99;
        p1.target = p2mg; p2mg.target = p1;
      } else { p1.target = null; p2mg.target = null; } // survival: both target enemies
    } else {
      // Survival solo
      players = [p1];
      p1.target = null;
    }
    initMinigame();
  } else if (isGodMode) {
    // God encounter — P1 vs God (in minions), optional Paradox ally
    p1.isAI  = false;
    p1.lives = 10;
    p1.armorPieces = ['helmet', 'chestplate', 'leggings']; // Godslayer armor
    p1._teamId = 1;
    if (window.GODSLAYER_WEAPON) {
      p1.weapon    = window.GODSLAYER_WEAPON;
      p1.weaponKey = '_godslayer';
      p1._ammo     = 0;
    }
    players = [p1];
    p1.target = null;
    // Spawn God into minions
    if (typeof God !== 'undefined') {
      const _god = new God(700, 200);
      _god._teamId = 2;
      minions.push(_god);
      if (typeof _godWasAlive !== 'undefined') _godWasAlive = true;
    }
    // Phase 2: spawn Paradox as ally
    if (typeof _isGodPhase2 === 'function' && _isGodPhase2() && typeof GodParadoxAlly !== 'undefined') {
      const _ally = new GodParadoxAlly(300, 200);
      _ally._teamId = 1;
      minions.push(_ally);
    }
  } else if (isExploreMode) {
    // Exploration: P1 only — enemies are dynamically spawned as minions
    players = [p1];
    p1.target = null;
    // Do NOT set trainingMode — exploration uses its own lives system
  } else if (p2IsNone) {
    // Solo / None mode — only P1 exists, infinite lives, no opponent
    p1.lives = 9999;
    players = [p1];
    p1.target = null;
  } else {
    p2 = new Fighter(720, 300, c2, w2, { left:'ArrowLeft', right:'ArrowRight', jump:'ArrowUp', attack:'Enter', shield:'ArrowDown', ability:'.', super:'/' }, isBot, diff);
    // In story two-enemy fights, cap p2 lives so total enemy lives ≤ player lives
    const _p2StoryLives = (storyModeActive && storyTwoEnemies) ? Math.max(1, Math.floor(chosenLives / 2)) : chosenLives;
    p2.playerNum = 2; p2.name = p2IsBot ? 'BOT' : 'P2'; p2.lives = _p2StoryLives;
    { const _sp2 = pickSafeSpawn('right', _p1SpawnPos.x) || { x: 720, y: 300 };
      p2.spawnX = _sp2.x; p2.spawnY = _sp2.y; p2.x = _sp2.x; p2.y = _sp2.y - p2.h; }
    p2.hat  = document.getElementById('p2Hat')?.value  || 'none';
    p2.cape = document.getElementById('p2Cape')?.value || 'none';
    if (p2Skin !== 'default' && SKIN_COLORS[p2Skin]) p2.color = SKIN_COLORS[p2Skin];
    p2.weaponTheme = (p2WeaponSkin && p2WeaponSkin !== 'default') ? p2WeaponSkin : null;
    applyClass(p2, _p2ResolvedClass);
    if (p2.charClass === 'megaknight') { p2.y = -120; p2.vy = 2; p2._spawnFalling = true; p2.invincible = 200; }
    // Story mode: apply enemy damage and cooldown scaling so fights feel fair at each chapter
    if (storyModeActive && typeof STORY_ENEMY_CONFIGS !== 'undefined') {
      const _ec = STORY_ENEMY_CONFIGS[storyCurrentLevel];
      if (_ec) {
        if (_ec.enemyDmgMult   !== undefined) p2.dmgMult            = _ec.enemyDmgMult;
        if (_ec.enemyAtkCdMult !== undefined) p2.attackCooldownMult = _ec.enemyAtkCdMult;
      }
    }
    if (storyModeActive && typeof _storyScaleEnemyUnit === 'function' && typeof _activeStory2Chapter !== 'undefined' && _activeStory2Chapter) {
      _storyScaleEnemyUnit(p2, _activeStory2Chapter.id, {
        elite: !!(typeof storyPendingPhaseConfig !== 'undefined' && storyPendingPhaseConfig && (storyPendingPhaseConfig.type === 'elite_wave' || storyPendingPhaseConfig.type === 'mini_boss'))
      });
    }
    // Story armor: apply to p2
    if (storyModeActive && storyEnemyArmor && storyEnemyArmor.length > 0) {
      p2.armorPieces = [...storyEnemyArmor];
    }
    // Story opponent name
    if (storyModeActive && storyOpponentName) p2.name = storyOpponentName;
    players = [p1, p2];
    if (storyModeActive) {
      p1.storyFaction = 'player'; p1._teamId = 1;
      p2.storyFaction = 'enemy';  p2._teamId = 2;
    }
    p1.target = p2; p2.target = p1;

    // Story two-enemies: spawn a third fighter on p2's side
    if (storyModeActive && storyTwoEnemies && storySecondEnemyDef) {
      const _sed = storySecondEnemyDef;
      const _sp3 = pickSafeSpawn('right', p1.x) || { x: 600, y: 300 };
      const _p3w = _sed.weaponKey || w2;
      const _p3c = _sed.color || '#cc5500';
      const _p3d = _sed.aiDiff || diff;
      const p3 = new Fighter(_sp3.x, _sp3.y, _p3c, _p3w,
        { left:'ArrowLeft', right:'ArrowRight', jump:'ArrowUp', attack:'Enter', shield:'ArrowDown', ability:'.', super:'/' },
        true, _p3d);
      // In story two-enemy fights the player must have lives ≥ total enemy lives.
      // Cap each enemy at floor(playerLives/2) so 2 enemies never exceed the player's total.
      const _p3Lives = storyModeActive ? Math.max(1, Math.floor(chosenLives / 2)) : chosenLives;
      p3.playerNum = 3; p3.name = _sed.name || 'ENEMY B'; p3.lives = _p3Lives;
      p3.spawnX = _sp3.x; p3.spawnY = _sp3.y; p3.y = _sp3.y - p3.h;
      if (_sed.classKey) applyClass(p3, _sed.classKey);
      if (storyModeActive && typeof STORY_ENEMY_CONFIGS !== 'undefined') {
        const _ec2 = STORY_ENEMY_CONFIGS[storyCurrentLevel];
        if (_ec2) {
          if (_ec2.enemyDmgMult   !== undefined) p3.dmgMult            = _ec2.enemyDmgMult;
          if (_ec2.enemyAtkCdMult !== undefined) p3.attackCooldownMult = _ec2.enemyAtkCdMult;
        }
      }
      if (storyModeActive && typeof _storyScaleEnemyUnit === 'function' && typeof _activeStory2Chapter !== 'undefined' && _activeStory2Chapter) {
        _storyScaleEnemyUnit(p3, _activeStory2Chapter.id, { elite: true });
      }
      players.push(p3);
      if (storyModeActive) {
        p3.storyFaction = 'enemy';
        p3._teamId = 2;
      }
      // All bots target the player
      p2.target = p1; p3.target = p1;
    }
  }

  // Assign bot personalities — each AI fighter gets a random personality
  const PERSONALITIES = ['aggressive', 'defensive', 'trickster', 'sniper'];
  for (const p of players) {
    if (p.isAI && !p.isBoss && !p.isTrueForm && !p.isMinion) {
      p.personality = randChoice(PERSONALITIES);
    }
  }

  // Online mode: mark which player is remote so gameLoop applies network state
  if (onlineMode && NetworkManager.connected) {
    // Only remap human (non-boss, non-trueform) players — boss/TrueForm always stay AI
    const humanPlayers = players.filter(p => p && !p.isBoss && !p.isTrueForm);
    const localIdx  = onlineLocalSlot;  // 0 = host, 1 = guest
    const remoteIdx = 1 - localIdx;
    if (humanPlayers[localIdx]) {
      humanPlayers[localIdx].isRemote = false;
      humanPlayers[localIdx].controls = {
        left: 'a', right: 'd', jump: 'w', attack: ' ',
        shield: 's', ability: 'q', super: 'e',
      };
      humanPlayers[localIdx].isAI = false;
    }
    if (humanPlayers[remoteIdx]) {
      humanPlayers[remoteIdx].isRemote  = true;
      humanPlayers[remoteIdx].isAI      = false; // network drives this player, not AI
      humanPlayers[remoteIdx].controls  = {};    // no local keyboard input
    }
  }

  // Lava arena: override spawn positions to ensure players land on solid platforms
  if (currentArenaKey === 'lava') {
    p1.spawnX = 236; p1.spawnY = 260; // above upper-left platform (x=178,y=278)
    p1.x = 236; p1.y = 200;
    if (p2 && !p2.isBoss) {
      p2.spawnX = 640; p2.spawnY = 260; // above upper-right platform (x=582,y=278)
      p2.x = 640; p2.y = 200;
    }
  }

  _applyBossFightLivesLockToPlayers();

  // Training mode: show in-game HUD (not in tutorial)
  const trainingHud = document.getElementById('trainingHud');
  if (trainingHud) trainingHud.style.display = isTrainingMode ? 'flex' : 'none';
  const trainingCtrl = document.getElementById('trainingControls');
  if (trainingCtrl) trainingCtrl.style.display = isTrainingMode ? 'flex' : 'none';

  // HUD labels
  document.getElementById('p1HudName').textContent = p1.name;
  if (p2) document.getElementById('p2HudName').textContent = p2.name;
  document.getElementById('killFeed').innerHTML = '';

  updateHUD();
  // Reset per-match achievement stats
  _achStats.damageTaken = 0; _achStats.rangedDmg = 0; _achStats.consecutiveHits = 0;
  _achStats.superCount = 0; _achStats.matchStartTime = Date.now();
  _firstDeathFrame  = -1;
  _firstDeathPlayer = null;
  // Chaos mode: initialize after players are set up
  if (typeof chaosMode !== 'undefined' && chaosMode && typeof initChaosMode === 'function') {
    initChaosMode();
  }

  // Post-class weapon restore: if player explicitly selected a non-random weapon,
  // respect that choice over what applyClass may have forced
  if (!isCompleteRandMode) {
    const _p2WeaponEl = document.getElementById('p2Weapon');
    const _p2WeaponVal = _p2WeaponEl?.value;
    if (p2 && !p2.isBoss && _p2WeaponVal && _p2WeaponVal !== 'random') {
      const _w2Obj = (w2 && w2.startsWith('_custom_') && window.CUSTOM_WEAPONS && window.CUSTOM_WEAPONS[w2])
                     ? window.CUSTOM_WEAPONS[w2]
                     : (typeof WEAPONS !== 'undefined' && WEAPONS[w2] ? WEAPONS[w2] : null);
      if (_w2Obj) { p2.weaponKey = w2; p2.weapon = _w2Obj; p2._ammo = p2.weapon.clipSize || 0; }
    }
  }

  gameRunning = true;
  // Paradox companion: speak on boss start
  if ((gameMode === 'boss' || gameMode === 'trueform') &&
      typeof paradoxOnBossStart === 'function') {
    paradoxOnBossStart();
  }
  // Start appropriate background music
  if (gameMode === 'boss' || gameMode === 'trueform' || gameMode === 'god') {
    MusicManager.playBoss();
  } else {
    MusicManager.playNormal();
  }
  resizeGame();
  const _safeLoop = typeof ErrorBoundary !== 'undefined'
    ? ErrorBoundary.wrapLoop(gameLoop)
    : gameLoop;
  requestAnimationFrame(_safeLoop);
}

// ============================================================
// CHAOS MODE TOGGLE
// ============================================================
