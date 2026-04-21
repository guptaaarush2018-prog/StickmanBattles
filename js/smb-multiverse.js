// smb-multiverse.js — Multiverse Progression System
// Adds: MultiverseManager, EncounterManager, MultiverseScalingSystem
// Worlds: War-Torn, Gravity Flux, Shadow Realm, Titan World
// Integrates Fallen God as guide/observer with timed dialogue
// Must load after smb-story.js and before smb-menu.js
'use strict';

// ============================================================
// MULTIVERSE WORLD DEFINITIONS
// ============================================================
const MULTIVERSE_WORLDS = [
  {
    id:          'war_torn',
    name:        'War-Torn Dimension',
    icon:        '⚔️',
    color:       '#cc4422',
    bgGradient:  ['#1a0a06', '#2d1008'],
    description: 'A dimension locked in perpetual war. Enemies attack without hesitation or mercy.',
    loreText:    'Every soul here has fought since birth. They know nothing else.',
    arenaKey:    'homeAlley',
    order:       0,
    unlockRequirement: null, // always first
    modifier: {
      aiAggressionMult:  1.6,   // AI attacks far more frequently
      aiDefenseMult:     0.4,   // AI barely defends
      enemyDmgMult:      1.15,
      enemySpeedMult:    1.10,
      label:             '⚔️ War Frenzy',
      description:       'Enemies attack relentlessly. No rest. No mercy.',
    },
    encounters: [
      { type: 'standard', opponentName: 'War Grunt',       weaponKey: 'sword',  classKey: 'warrior',  aiDiff: 'medium', color: '#884422', lives: 3 },
      { type: 'elite',    opponentName: 'War Veteran',     weaponKey: 'axe',    classKey: 'berserker',aiDiff: 'hard',   color: '#aa3311', lives: 2, twoEnemies: true, secondColor: '#993322' },
      { type: 'survival', waves: 3, opponentName: 'War Horde', weaponKey: 'sword', classKey: 'warrior', aiDiff: 'hard', color: '#882200', lives: 3 },
      { type: 'boss',     opponentName: 'War Champion',    weaponKey: 'hammer', classKey: 'berserker',aiDiff: 'expert', color: '#ff2200', lives: 1, armor: ['helmet','chestplate'], isBoss: true },
    ],
    bossName:    'War Champion',
    reward: { expBonus: 120, statKey: 'aggression', statDesc: 'You fight without hesitation now.' },
    fallenGodDialogue: [
      { trigger: 'enter',   text: '"Power without understanding is collapse waiting to happen. Watch how they waste it."' },
      { trigger: 'boss',    text: '"The War Champion has never lost. Until you."' },
      { trigger: 'complete',text: '"You did not become violent. You became decisive. There is a difference."' },
    ],
  },
  {
    id:          'gravity_flux',
    name:        'Gravity Flux World',
    icon:        '🌀',
    color:       '#4488ff',
    bgGradient:  ['#050a1a', '#0a1530'],
    description: 'Gravity reverses every 12 seconds. Masters of this dimension use the shifts as weapons.',
    loreText:    'In this world, the ground is a suggestion. The sky is equally uncertain.',
    arenaKey:    'space',
    order:       1,
    unlockRequirement: 'war_torn',
    modifier: {
      gravityFlipInterval: 720,  // frames between flips (12s at 60fps)
      gravityFlipDuration: 180,  // frames gravity is inverted (3s warning before snap)
      enemyDmgMult:        1.10,
      label:               '🌀 Flux Field',
      description:         'Gravity inverts every 12 seconds. Both fighters are affected.',
    },
    encounters: [
      { type: 'standard', opponentName: 'Flux Drifter',    weaponKey: 'spear',  classKey: 'ninja',    aiDiff: 'medium', color: '#2255aa', lives: 3 },
      { type: 'elite',    opponentName: 'Flux Veteran',    weaponKey: 'sword',  classKey: 'warrior',  aiDiff: 'hard',   color: '#3366cc', lives: 2 },
      { type: 'survival', waves: 3, opponentName: 'Flux Patrol', weaponKey: 'axe', classKey: 'warrior', aiDiff: 'hard', color: '#2244aa', lives: 3 },
      { type: 'boss',     opponentName: 'Flux Guardian',   weaponKey: 'spear',  classKey: 'warrior',  aiDiff: 'expert', color: '#00aaff', lives: 1, armor: ['helmet','chestplate'], isBoss: true },
    ],
    bossName:    'Flux Guardian',
    reward: { expBonus: 150, statKey: 'adaptability', statDesc: 'Unstable ground no longer unsettles you.' },
    fallenGodDialogue: [
      { trigger: 'enter',   text: '"The Creator built a weapon. I am watching to see if you become something better."' },
      { trigger: 'flip',    text: '"Adapt or fall. This world has no patience for the rigid."' },
      { trigger: 'boss',    text: '"The Guardian has mastered what you are only learning. Close the gap."' },
      { trigger: 'complete',text: '"You are not becoming stronger. You are becoming capable."' },
    ],
  },
  {
    id:          'shadow_realm',
    name:        'Shadow Realm',
    icon:        '🌑',
    color:       '#8833cc',
    bgGradient:  ['#080010', '#100020'],
    description: 'Darkness limits visibility. Enemies phase and teleport. Only instinct survives here.',
    loreText:    'Light is a lie in this realm. Trust your senses, not your eyes.',
    arenaKey:    'city',
    order:       2,
    unlockRequirement: 'gravity_flux',
    modifier: {
      visibilityRadius:  220,   // px in game-space — beyond this, entities fade to black
      enemyTeleportCd:   180,   // frames between enemy teleport blinks
      enemyDmgMult:      1.20,
      enemySpeedMult:    1.05,
      label:             '🌑 Shadow Veil',
      description:       'Visibility is limited. Enemies phase through space.',
    },
    encounters: [
      { type: 'standard', opponentName: 'Shadow Prowler',  weaponKey: 'sword',  classKey: 'assassin', aiDiff: 'medium', color: '#440066', lives: 3 },
      { type: 'elite',    opponentName: 'Phase Hunter',    weaponKey: 'spear',  classKey: 'ninja',    aiDiff: 'hard',   color: '#550077', lives: 2 },
      { type: 'survival', waves: 3, opponentName: 'Shadow Pack', weaponKey: 'axe', classKey: 'assassin', aiDiff: 'hard', color: '#330055', lives: 3 },
      { type: 'boss',     opponentName: 'Shadow Warden',   weaponKey: 'sword',  classKey: 'ninja',    aiDiff: 'expert', color: '#9900ff', lives: 1, armor: ['helmet','chestplate','leggings'], isBoss: true },
    ],
    bossName:    'Shadow Warden',
    reward: { expBonus: 180, statKey: 'perception', statDesc: 'You sense the fight before you see it.' },
    fallenGodDialogue: [
      { trigger: 'enter',   text: '"What you cannot see, you must feel. The fragment knows the way."' },
      { trigger: 'boss',    text: '"The Warden has never been found. You have already done the impossible."' },
      { trigger: 'complete',text: '"Fear of the unseen was the last thing holding you back. Good."' },
    ],
  },
  {
    id:          'titan_world',
    name:        'Titan World',
    icon:        '🏔️',
    color:       '#ffaa00',
    bgGradient:  ['#1a1000', '#2a1a00'],
    description: 'Every enemy is massive, resistant to knockback, and hits with devastating force. Size is power here.',
    loreText:    'The Titans have never acknowledged a threat smaller than themselves. You are about to change that.',
    arenaKey:    'lava',
    order:       3,
    unlockRequirement: 'shadow_realm',
    modifier: {
      enemySizeMult:     1.40,   // enemies drawn larger
      enemyKbResist:     0.75,   // strong knockback resistance
      enemyDmgMult:      1.30,
      enemyHealthMult:   1.50,
      label:             '🏔️ Titan Scale',
      description:       'Enemies are larger, heavier, and hit devastatingly hard.',
    },
    encounters: [
      { type: 'standard', opponentName: 'Titan Grunt',     weaponKey: 'hammer', classKey: 'tank',     aiDiff: 'hard',   color: '#aa6600', lives: 3 },
      { type: 'elite',    opponentName: 'Titan Enforcer',  weaponKey: 'axe',    classKey: 'tank',     aiDiff: 'hard',   color: '#cc7700', lives: 2, twoEnemies: true, secondColor: '#aa5500' },
      { type: 'survival', waves: 4, opponentName: 'Titan Horde', weaponKey: 'hammer', classKey: 'tank', aiDiff: 'hard', color: '#995500', lives: 3 },
      { type: 'boss',     opponentName: 'Titan King',      weaponKey: 'hammer', classKey: 'tank',     aiDiff: 'expert', color: '#ffaa00', lives: 1, armor: ['helmet','chestplate','leggings'], isBoss: true },
    ],
    bossName:    'Titan King',
    reward: { expBonus: 220, statKey: 'resilience', statDesc: 'You have shattered what could not be shattered.' },
    fallenGodDialogue: [
      { trigger: 'enter',   text: '"Size is the most ancient form of confidence. Show them it is not enough."' },
      { trigger: 'boss',    text: '"The Titan King was worshipped as a god in three dimensions. You are about to end that."' },
      { trigger: 'complete',text: '"Every world you survive rewrites what the next one can do to you. Remember that."' },
    ],
  },
];

// ============================================================
// MULTIVERSE SCALING SYSTEM
// ============================================================
const MultiverseScalingSystem = (function() {
  // Per-world-completed passive bonuses applied to the player fighter
  const WORLD_CLEAR_BONUSES = {
    war_torn:      { speedAdd: 0.15, dmgMult: 0.06, label: 'War-Hardened Reflexes' },
    gravity_flux:  { jumpMult: 0.12, speedAdd: 0.10, label: 'Flux Adaptation' },
    shadow_realm:  { kbResist: 0.04, dmgMult: 0.08, label: 'Shadow Perception' },
    titan_world:   { maxHpAdd: 20,   kbBonus: 0.08, label: 'Titan-Breaker Strength' },
  };

  // Combat adaptation — gained per encounter completed, up to a cap
  // These are fractional so they feel earned, not inflated
  const ENCOUNTER_ADAPTATION = {
    standard: { dmgMult: 0.01 },
    elite:    { dmgMult: 0.02, speedAdd: 0.05 },
    survival: { maxHpAdd: 5,   kbResist: 0.01 },
    boss:     { dmgMult: 0.04, speedAdd: 0.10, maxHpAdd: 10, kbResist: 0.02 },
  };

  const MAX_ADAPT = { dmgMult: 0.40, speedAdd: 0.50, maxHpAdd: 60, kbResist: 0.15, kbBonus: 0.12, jumpMult: 0.20 };

  return {
    // Apply all accumulated bonuses to a fighter object at fight-start
    applyToFighter(p, saveData) {
      if (!p || !saveData) return;
      const bonuses = saveData.accumulatedBonuses || {};

      if (bonuses.dmgMult)  p.dmgMult  = Math.min((p.dmgMult  || 1) + bonuses.dmgMult,  2.0);
      if (bonuses.speedAdd) p.speed    = Math.min((p.speed    || 3.2) + bonuses.speedAdd, 5.5);
      if (bonuses.maxHpAdd) {
        p.maxHealth = (p.maxHealth || 100) + bonuses.maxHpAdd;
        p.health    = Math.min(p.health + bonuses.maxHpAdd, p.maxHealth);
      }
      if (bonuses.kbResist) p.kbResist = Math.min((p.kbResist || 0) + bonuses.kbResist, 0.55);
      if (bonuses.kbBonus)  p.kbBonus  = Math.min((p.kbBonus  || 0) + bonuses.kbBonus,  0.40);
      if (bonuses.jumpMult) p._mvJumpMult = 1.0 + bonuses.jumpMult;

      // Store on fighter so HUD can display stat summary
      p._multiverseBonuses = Object.assign({}, bonuses);
    },

    // Record a world-clear bonus into saveData
    recordWorldClear(worldId, saveData) {
      if (!saveData || !WORLD_CLEAR_BONUSES[worldId]) return;
      const bonus = WORLD_CLEAR_BONUSES[worldId];
      const acc   = saveData.accumulatedBonuses = saveData.accumulatedBonuses || {};
      for (const [k, v] of Object.entries(bonus)) {
        if (k === 'label') continue;
        acc[k] = Math.min((acc[k] || 0) + v, MAX_ADAPT[k] || 999);
      }
      saveData.worldClearBonusLog = saveData.worldClearBonusLog || [];
      saveData.worldClearBonusLog.push({ worldId, label: bonus.label, at: Date.now() });
    },

    // Record an encounter adaptation into saveData
    recordEncounterAdapt(encounterType, saveData) {
      if (!saveData || !ENCOUNTER_ADAPTATION[encounterType]) return;
      const bonus = ENCOUNTER_ADAPTATION[encounterType];
      const acc   = saveData.accumulatedBonuses = saveData.accumulatedBonuses || {};
      for (const [k, v] of Object.entries(bonus)) {
        acc[k] = Math.min((acc[k] || 0) + v, MAX_ADAPT[k] || 999);
      }
    },

    // Build a human-readable stat summary for the HUD
    getSummaryLines(saveData) {
      const acc = (saveData && saveData.accumulatedBonuses) || {};
      const lines = [];
      if (acc.dmgMult)  lines.push(`+${Math.round(acc.dmgMult  * 100)}% damage`);
      if (acc.speedAdd) lines.push(`+${acc.speedAdd.toFixed(1)} speed`);
      if (acc.maxHpAdd) lines.push(`+${acc.maxHpAdd} max HP`);
      if (acc.kbResist) lines.push(`+${Math.round(acc.kbResist * 100)}% KB resist`);
      if (acc.jumpMult) lines.push(`+${Math.round(acc.jumpMult * 100)}% jump`);
      return lines;
    },

    // Scale an enemy fighter to the world's difficulty tier
    applyWorldModifierToEnemy(enemy, worldId, worldsCompleted) {
      if (!enemy || !worldId) return;
      const world = MULTIVERSE_WORLDS.find(w => w.id === worldId);
      if (!world) return;
      const m = world.modifier;
      if (m.enemyDmgMult)   enemy.dmgMult   = (enemy.dmgMult   || 1) * m.enemyDmgMult;
      if (m.enemySpeedMult) enemy.speed     = (enemy.speed     || 3.2) * m.enemySpeedMult;
      if (m.enemyKbResist)  enemy.kbResist  = Math.min((enemy.kbResist || 0) + m.enemyKbResist, 0.80);
      if (m.enemyHealthMult) {
        enemy.maxHealth = Math.round((enemy.maxHealth || 100) * m.enemyHealthMult);
        enemy.health    = enemy.maxHealth;
      }
      // Scale further with each world cleared (soft difficulty ramp)
      const extraDmg = 1 + worldsCompleted * 0.08;
      enemy.dmgMult = (enemy.dmgMult || 1) * extraDmg;
    },
  };
})();

// ============================================================
// ENCOUNTER MANAGER
// ============================================================
const EncounterManager = (function() {
  let _currentEncounterIdx = 0;
  let _currentWorld        = null;
  let _onComplete          = null;

  return {
    // Start an encounter sequence for a world
    beginWorld(worldId, onComplete) {
      _currentWorld        = MULTIVERSE_WORLDS.find(w => w.id === worldId) || null;
      _currentEncounterIdx = 0;
      _onComplete          = onComplete || null;
    },

    getCurrentEncounter() {
      if (!_currentWorld) return null;
      return _currentWorld.encounters[_currentEncounterIdx] || null;
    },

    advanceEncounter() {
      if (!_currentWorld) return false;
      _currentEncounterIdx++;
      if (_currentEncounterIdx >= _currentWorld.encounters.length) {
        _currentEncounterIdx = _currentWorld.encounters.length - 1;
        if (typeof _onComplete === 'function') _onComplete();
        return false; // no more
      }
      return true;
    },

    getEncounterCount() {
      return _currentWorld ? _currentWorld.encounters.length : 0;
    },

    getEncounterIndex() { return _currentEncounterIdx; },

    isBossEncounter() {
      const enc = this.getCurrentEncounter();
      return enc ? enc.type === 'boss' : false;
    },

    reset() {
      _currentWorld        = null;
      _currentEncounterIdx = 0;
      _onComplete          = null;
    },
  };
})();

// ============================================================
// FALLEN GOD DIALOGUE SYSTEM
// ============================================================
const FallenGodSystem = (function() {
  let _activeDialogue = null; // { text, timer, maxTimer }
  let _seenDialogue   = new Set(); // prevent repeats per session

  const GENERIC_LINES = [
    '"Every world you pass through teaches the next one to fear you."',
    '"The fragment is not a weapon. It is a record of everything you have survived."',
    '"I have watched a thousand fragment bearers. None reached this far."',
    '"Do not confuse endurance for strength. They are different lessons."',
    '"The Creator built a mechanism. You are rewriting what it produces."',
  ];

  return {
    trigger(key, worldId) {
      const dialogueKey = `${worldId}_${key}`;
      if (_seenDialogue.has(dialogueKey)) return;
      _seenDialogue.add(dialogueKey);

      const world = MULTIVERSE_WORLDS.find(w => w.id === worldId);
      if (!world) return;
      const entry = world.fallenGodDialogue.find(d => d.trigger === key);
      if (!entry) return;

      const dur = 320;
      _activeDialogue = { text: entry.text, timer: dur, maxTimer: dur };
    },

    triggerGeneric() {
      const unused = GENERIC_LINES.filter(l => !_seenDialogue.has('generic_' + l));
      if (!unused.length) return;
      const line = unused[Math.floor(Math.random() * unused.length)];
      _seenDialogue.add('generic_' + line);
      const dur = 300;
      _activeDialogue = { text: line, timer: dur, maxTimer: dur };
    },

    tick() {
      if (_activeDialogue && _activeDialogue.timer > 0) _activeDialogue.timer--;
    },

    draw() {
      if (!_activeDialogue || _activeDialogue.timer <= 0) return;
      const alpha = Math.min(1, _activeDialogue.timer / 40, (_activeDialogue.maxTimer - _activeDialogue.timer) / 30 + 0.1);
      const cw = canvas.width, ch = canvas.height;
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);

      // Background bar
      ctx.fillStyle = `rgba(8,0,20,${alpha * 0.82})`;
      ctx.fillRect(0, ch - 110, cw, 110);

      // Gold accent line
      ctx.fillStyle = `rgba(255,180,60,${alpha * 0.6})`;
      ctx.fillRect(0, ch - 110, cw, 2);

      // Speaker label
      ctx.font = 'bold 11px "Segoe UI", Arial, sans-serif';
      ctx.letterSpacing = '2px';
      ctx.fillStyle = `rgba(255,180,60,${alpha})`;
      ctx.fillText('THE FALLEN GOD', 28, ch - 78);
      ctx.letterSpacing = '0px';

      // Dialogue text — wrap at ~90 chars
      const words = _activeDialogue.text.split(' ');
      const lines  = [];
      let cur = '';
      for (const w of words) {
        if ((cur + ' ' + w).trim().length > 88) { lines.push(cur.trim()); cur = w; }
        else cur = (cur + ' ' + w).trim();
      }
      if (cur) lines.push(cur);

      ctx.font = 'italic 14px "Segoe UI", Arial, sans-serif';
      ctx.fillStyle = `rgba(230,220,255,${alpha})`;
      lines.forEach((line, i) => ctx.fillText(line, 28, ch - 52 + i * 20));

      ctx.restore();
    },

    getActive() { return _activeDialogue; },
    resetSession() { _seenDialogue.clear(); _activeDialogue = null; },
  };
})();

// ============================================================
// MULTIVERSE MANAGER — central controller
// ============================================================
const MultiverseManager = (function() {
  const _SAVE_KEY = 'smc_multiverse';

  function _defaultSave() {
    return {
      unlockedWorlds:      ['war_torn'],
      completedWorlds:     [],
      currentWorldId:      null,
      accumulatedBonuses:  {},
      worldClearBonusLog:  [],
      totalExp:            0,
      encounterHistory:    [], // { worldId, type, result } last 20
    };
  }

  let _save = (function() {
    try {
      const raw = localStorage.getItem(_SAVE_KEY);
      if (!raw) return _defaultSave();
      const p = JSON.parse(raw);
      if (!p || !Array.isArray(p.unlockedWorlds)) return _defaultSave();
      // Ensure all fields present
      if (!p.accumulatedBonuses) p.accumulatedBonuses = {};
      if (!p.worldClearBonusLog) p.worldClearBonusLog = [];
      if (!p.encounterHistory)   p.encounterHistory   = [];
      if (typeof p.totalExp !== 'number') p.totalExp = 0;
      return p;
    } catch(e) { return _defaultSave(); }
  })();

  function _persist() {
    try { localStorage.setItem(_SAVE_KEY, JSON.stringify(_save)); } catch(e) {}
  }

  // Active state
  let _active        = false;
  let _activeWorldId = null;
  let _gravFlipTimer = 0;
  let _gravFlipping  = false;
  let _shadowFogAlpha = 0;

  return {
    // ── Accessors ───────────────────────────────────────────
    isActive()         { return _active; },
    getSave()          { return _save; },
    getActiveWorldId() { return _activeWorldId; },
    getActiveWorld()   { return MULTIVERSE_WORLDS.find(w => w.id === _activeWorldId) || null; },
    isWorldUnlocked(id){ return _save.unlockedWorlds.includes(id); },
    isWorldComplete(id){ return _save.completedWorlds.includes(id); },
    getCompletedCount(){ return _save.completedWorlds.length; },

    // ── Unlock next world when a world is completed ─────────
    _tryUnlockNext(completedId) {
      const completed = MULTIVERSE_WORLDS.find(w => w.id === completedId);
      if (!completed) return;
      for (const w of MULTIVERSE_WORLDS) {
        if (w.unlockRequirement === completedId && !_save.unlockedWorlds.includes(w.id)) {
          _save.unlockedWorlds.push(w.id);
          _persist();
          return w;
        }
      }
      return null;
    },

    // ── Enter a world ─────────────────────────────────────────
    enterWorld(worldId, forceUnlocked = false) {
      const world = MULTIVERSE_WORLDS.find(w => w.id === worldId);
      if (!world) return false;
      // Story mode bypasses the unlock gate — world is entered via chapter progression
      if (!forceUnlocked && !_save.unlockedWorlds.includes(worldId)) {
        // Auto-unlock when entered through story
        if (!_save.unlockedWorlds.includes(worldId)) _save.unlockedWorlds.push(worldId);
      }

      _active        = true;
      _activeWorldId = worldId;
      _save.currentWorldId = worldId;
      multiverseModeActive = true;
      _gravFlipTimer = 0;
      _gravFlipping  = false;
      _shadowFogAlpha = 0;

      EncounterManager.beginWorld(worldId, () => this.onWorldComplete(worldId));
      FallenGodSystem.trigger('enter', worldId);
      _persist();
      return true;
    },

    // ── Called from endGame() after each encounter ───────────
    onEncounterComplete(worldId, encounterType, playerWon) {
      if (!playerWon) return; // retry — no progression
      MultiverseScalingSystem.recordEncounterAdapt(encounterType, _save);
      _save.totalExp += (encounterType === 'boss' ? 80 : encounterType === 'elite' ? 40 : 20);
      _save.encounterHistory.push({ worldId, type: encounterType, result: 'win', t: Date.now() });
      if (_save.encounterHistory.length > 20) _save.encounterHistory.shift();
      _persist();

      if (encounterType === 'boss') {
        FallenGodSystem.trigger('boss', worldId);
      }
      EncounterManager.advanceEncounter();
    },

    // ── Called when all encounters in a world are done ───────
    onWorldComplete(worldId) {
      if (_save.completedWorlds.includes(worldId)) return;
      _save.completedWorlds.push(worldId);
      MultiverseScalingSystem.recordWorldClear(worldId, _save);
      _save.totalExp += MULTIVERSE_WORLDS.find(w => w.id === worldId)?.reward?.expBonus || 100;
      FallenGodSystem.trigger('complete', worldId);
      const unlocked = this._tryUnlockNext(worldId);
      _persist();

      // Show world-complete banner
      _multiverseWorldCompleteTimer  = 280;
      _multiverseWorldCompleteLabel  = MULTIVERSE_WORLDS.find(w => w.id === worldId)?.name || '';
      _multiverseWorldCompleteUnlock = unlocked ? unlocked.name : null;
    },

    // ── Apply active world modifier to current game state ────
    applyActiveModifier() {
      const world = this.getActiveWorld();
      if (!world) return;
      const m = world.modifier;

      // AI aggression override via worldModifiers (read by Fighter.updateAI)
      worldModifiers.aiAggressionMult  = m.aiAggressionMult  || 1.0;
      worldModifiers.aiDefenseMult     = m.aiDefenseMult     || 1.0;
      worldModifiers.visibilityRadius  = m.visibilityRadius  || null;
      worldModifiers.enemyTeleportCd   = m.enemyTeleportCd   || null;
      worldModifiers.gravityFlipInterval = m.gravityFlipInterval || null;
    },

    // ── Called once when a multiverse fight starts ────────────
    onFightStart() {
      this.applyActiveModifier();
      // Apply player scaling bonuses
      if (players && players[0]) {
        MultiverseScalingSystem.applyToFighter(players[0], _save);
      }
      // Apply world modifier to enemy fighters
      const enc = EncounterManager.getCurrentEncounter();
      if (enc && players) {
        const worldsCompleted = this.getCompletedCount();
        players.filter(p => p.isAI && !p.isBoss).forEach(p => {
          MultiverseScalingSystem.applyWorldModifierToEnemy(p, _activeWorldId, worldsCompleted);
        });
      }
    },

    // ── Per-frame tick ────────────────────────────────────────
    tick() {
      if (!_active) return;
      FallenGodSystem.tick();

      const world = this.getActiveWorld();
      if (!world) return;
      const m = world.modifier;

      // Gravity Flux: periodic flip
      if (m.gravityFlipInterval && players) {
        _gravFlipTimer++;
        if (_gravFlipTimer >= m.gravityFlipInterval) {
          _gravFlipTimer = 0;
          _gravFlipping = !_gravFlipping;
          // Toggle gravity for all non-boss players
          players.forEach(p => {
            if (!p.isBoss) p._mvGravInverted = _gravFlipping;
          });
          FallenGodSystem.trigger('flip', _activeWorldId);
          spawnParticles(GAME_W / 2, GAME_H / 2, _gravFlipping ? '#4488ff' : '#88ccff', 12);
        }
      }

      // Shadow Realm: ramp up fog
      if (m.visibilityRadius && _shadowFogAlpha < 0.88) {
        _shadowFogAlpha = Math.min(0.88, _shadowFogAlpha + 0.008);
      }

      // Shadow Realm: enemy teleport blink
      if (m.enemyTeleportCd && players) {
        players.filter(p => p.isAI && !p.isBoss && p.health > 0).forEach(p => {
          p._mvTeleportCd = (p._mvTeleportCd || 0) - 1;
          if (p._mvTeleportCd <= 0) {
            p._mvTeleportCd = m.enemyTeleportCd + Math.floor(Math.random() * 60);
            // Teleport behind the human player
            const human = players.find(h => !h.isAI);
            if (human) {
              const offset = human.facing === 1 ? -80 : 80;
              p.x = Math.max(50, Math.min(GAME_W - 50, human.x + offset));
              spawnParticles(p.cx(), p.cy(), '#8833cc', 8);
            }
          }
        });
      }
    },

    // ── Per-frame draw (game-world space) ─────────────────────
    draw() {
      if (!_active) return;
      const world = this.getActiveWorld();
      if (!world) return;
      const m = world.modifier;

      // World modifier badge (top-left, game-space)
      ctx.save();
      ctx.font = 'bold 9px "Segoe UI", Arial, sans-serif';
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(6, 6, 160, 20);
      ctx.fillStyle = world.color;
      ctx.fillText(m.label, 12, 19);
      ctx.restore();

      // Gravity flip warning bar
      if (m.gravityFlipInterval) {
        const progress = _gravFlipTimer / m.gravityFlipInterval;
        const barW = GAME_W * progress;
        ctx.save();
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = _gravFlipping ? '#ff6644' : '#4488ff';
        ctx.fillRect(0, GAME_H - 5, barW, 5);
        ctx.globalAlpha = 1;
        ctx.restore();
        if (progress > 0.85) {
          ctx.save();
          ctx.font = 'bold 11px Arial';
          ctx.fillStyle = `rgba(100,180,255,${0.5 + Math.sin(Date.now() / 120) * 0.4})`;
          ctx.textAlign = 'center';
          ctx.fillText('⚠ GRAVITY SHIFT INCOMING', GAME_W / 2, GAME_H - 14);
          ctx.textAlign = 'left';
          ctx.restore();
        }
      }
    },

    // ── Screen-space draw (after transform reset) ─────────────
    drawScreenSpace() {
      if (!_active) return;
      FallenGodSystem.draw();
      this._drawWorldCompleteBanner();
      const world = this.getActiveWorld();
      if (!world) return;

      // Shadow Realm: darkness vignette overlay
      if (world.modifier.visibilityRadius && _shadowFogAlpha > 0 && players && players[0]) {
        const p   = players[0];
        const scX = canvas.width  / GAME_W;
        const scY = canvas.height / GAME_H;
        const px  = p.cx() * scX;
        const py  = p.cy() * scY;
        const r   = world.modifier.visibilityRadius * Math.min(scX, scY);

        ctx.save();
        const grad = ctx.createRadialGradient(px, py, r * 0.45, px, py, r * 1.6);
        grad.addColorStop(0, `rgba(0,0,0,0)`);
        grad.addColorStop(1, `rgba(0,0,0,${_shadowFogAlpha})`);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
      }
    },

    // ── World-complete banner ─────────────────────────────────
    _drawWorldCompleteBanner() {
      if (!_multiverseWorldCompleteTimer || _multiverseWorldCompleteTimer <= 0) return;
      _multiverseWorldCompleteTimer--;
      const t     = _multiverseWorldCompleteTimer;
      const alpha = Math.min(1, t / 40, (280 - t) / 30 + 0.05);
      const cw    = canvas.width, ch = canvas.height;

      ctx.save();
      ctx.fillStyle = `rgba(0,0,0,${alpha * 0.75})`;
      ctx.fillRect(0, ch * 0.3, cw, ch * 0.38);

      ctx.textAlign = 'center';
      ctx.font = `bold 22px "Segoe UI", Arial, sans-serif`;
      ctx.fillStyle = `rgba(255,210,80,${alpha})`;
      ctx.fillText('WORLD COMPLETE', cw / 2, ch * 0.42);

      ctx.font = `16px "Segoe UI", Arial, sans-serif`;
      ctx.fillStyle = `rgba(200,200,255,${alpha})`;
      ctx.fillText(_multiverseWorldCompleteLabel, cw / 2, ch * 0.50);

      if (_multiverseWorldCompleteUnlock) {
        ctx.font = `bold 13px "Segoe UI", Arial, sans-serif`;
        ctx.fillStyle = `rgba(100,255,160,${alpha})`;
        ctx.fillText(`🔓 Unlocked: ${_multiverseWorldCompleteUnlock}`, cw / 2, ch * 0.58);
      }
      ctx.textAlign = 'left';
      ctx.restore();
    },

    // ── HUD draw — encounter progress indicator ───────────────
    drawHUD() {
      if (!_active) return;
      const world = this.getActiveWorld();
      if (!world) return;
      const total = EncounterManager.getEncounterCount();
      const cur   = EncounterManager.getEncounterIndex();
      const enc   = EncounterManager.getCurrentEncounter();
      if (!enc) return;

      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      const cw = canvas.width;
      const y  = 8;
      const dotR = 6;
      const spacing = 22;
      const startX = cw / 2 - ((total - 1) * spacing) / 2;

      ctx.font = 'bold 10px "Segoe UI", Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(startX - 20, y - 1, (total - 1) * spacing + 40, 22);

      for (let i = 0; i < total; i++) {
        const cx = startX + i * spacing;
        const cy = y + 10;
        const encType = world.encounters[i].type;
        const done    = i < cur;
        const active  = i === cur;
        ctx.beginPath();
        ctx.arc(cx, cy, dotR, 0, Math.PI * 2);
        ctx.fillStyle = done   ? '#66ee99'
                       : active ? world.color
                       : 'rgba(255,255,255,0.15)';
        ctx.fill();
        if (active) {
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
        if (encType === 'boss') {
          ctx.font = '8px Arial';
          ctx.fillStyle = done ? '#66ee99' : active ? '#fff' : '#554';
          ctx.fillText('★', cx, cy + 3);
          ctx.font = 'bold 10px "Segoe UI", Arial, sans-serif';
        }
      }

      ctx.fillStyle = 'rgba(200,200,200,0.7)';
      ctx.fillText(`${world.icon} ${world.name}`, cw / 2, y + 30);
      ctx.textAlign = 'left';
      ctx.restore();
    },

    // ── Reset for back-to-menu ─────────────────────────────────
    deactivate() {
      _active              = false;
      _activeWorldId       = null;
      _gravFlipTimer       = 0;
      _gravFlipping        = false;
      _shadowFogAlpha      = 0;
      multiverseModeActive = false;
      worldModifiers       = {};
      // Clear per-fighter multiverse state
      if (players) players.forEach(p => {
        p._mvGravInverted = false;
        p._mvTeleportCd   = 0;
        p._mvJumpMult     = undefined;
      });
      EncounterManager.reset();
    },

    // ── New run (reset save) ──────────────────────────────────
    resetSave() {
      if (!confirm('Reset all Multiverse progress? This cannot be undone.')) return;
      _save = _defaultSave();
      _persist();
    },

    persist: _persist,
  };
})();

// ============================================================
// WORLD SELECTION — now lives inside Story Mode modal tab
// ============================================================
function openMultiverseMenu() {
  // Open story modal and switch to multiverse tab
  if (typeof openStoryMenu === 'function') openStoryMenu();
  setTimeout(() => { if (typeof switchStoryTab === 'function') switchStoryTab('multiverse'); }, 60);
}

function closeMultiverseMenu() {
  // Just close the story modal
  const m = document.getElementById('storyModal');
  if (m) m.style.display = 'none';
}

function _renderMultiverseWorldList() {
  const list = document.getElementById('multiverseWorldList');
  if (!list) return;
  list.innerHTML = '';

  // Show a top-level banner if the ship isn't built yet — no cards are clickable.
  const shipReady = window.SHIP && SHIP.built;
  if (!shipReady) {
    const banner = document.createElement('div');
    banner.style.cssText = 'padding:12px 14px;border-radius:8px;background:rgba(60,30,0,0.40);border:1px solid rgba(255,160,50,0.30);margin-bottom:12px;text-align:center;';
    banner.innerHTML =
      `<div style="font-size:0.80rem;color:#ffaa44;font-weight:700;margin-bottom:4px;">🚀 Axiom Ship Required</div>` +
      `<div style="font-size:0.68rem;color:#aa7733;line-height:1.5;">"The trials were built to break those who arrive unprepared.<br>Complete the ship first. Then we talk."</div>`;
    list.appendChild(banner);
  }

  const save = MultiverseManager.getSave();
  const statLines = MultiverseScalingSystem.getSummaryLines(save);

  // Header stats
  if (statLines.length > 0) {
    const statsDiv = document.createElement('div');
    statsDiv.style.cssText = 'padding:6px 10px 10px;border-bottom:1px solid rgba(255,255,255,0.08);margin-bottom:8px;';
    statsDiv.innerHTML =
      `<div style="font-size:0.64rem;color:#667;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Your Power</div>` +
      statLines.map(l => `<span style="font-size:0.72rem;color:#88ffcc;margin-right:10px;">${l}</span>`).join('');
    list.appendChild(statsDiv);
  }

  MULTIVERSE_WORLDS.forEach(world => {
    const unlocked  = MultiverseManager.isWorldUnlocked(world.id);
    const completed = MultiverseManager.isWorldComplete(world.id);
    const isCurrent = save.currentWorldId === world.id;

    // Card is only interactive if the ship is built AND the world is unlocked
    const cardClickable = shipReady && unlocked && !completed;
    const card = document.createElement('div');
    card.style.cssText = [
      'padding:12px 14px', 'border-radius:10px', 'margin-bottom:8px',
      `border:1px solid ${completed ? 'rgba(80,220,120,0.35)' : isCurrent ? world.color + '66' : 'rgba(255,255,255,0.07)'}`,
      `background:${completed ? 'rgba(20,60,35,0.30)' : isCurrent ? 'rgba(20,20,50,0.40)' : 'rgba(8,8,22,0.25)'}`,
      `opacity:${shipReady ? (unlocked ? '1' : '0.30') : '0.20'}`,
      cardClickable ? 'cursor:pointer' : 'cursor:default',
    ].join(';');

    const encounterDots = world.encounters.map((e, i) => {
      const done = completed || (isCurrent && i < EncounterManager.getEncounterIndex());
      const col  = done ? '#66ee99' : e.type === 'boss' ? world.color : 'rgba(255,255,255,0.25)';
      return `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${col};margin-right:3px;"></span>`;
    }).join('');

    card.innerHTML =
      `<div style="display:flex;align-items:center;gap:10px;margin-bottom:5px;">` +
        `<span style="font-size:1.3rem;">${world.icon}</span>` +
        `<span style="font-size:0.88rem;font-weight:700;color:${world.color};flex:1;">${world.name}</span>` +
        `<span style="font-size:0.65rem;color:${completed ? '#66ee99' : shipReady ? '#556' : '#aa5500'};">${completed ? '✓ Complete' : !shipReady ? '🚀 Ship Required' : unlocked ? 'Available' : '🔒'}</span>` +
      `</div>` +
      `<div style="font-size:0.70rem;color:#778;line-height:1.4;margin-bottom:6px;">${world.description}</div>` +
      `<div style="font-size:0.62rem;color:#445;font-style:italic;margin-bottom:7px;">"${world.loreText}"</div>` +
      `<div style="display:flex;align-items:center;gap:6px;">` +
        `<span style="font-size:0.60rem;color:#445;">Encounters:</span>` +
        encounterDots +
        `<span style="flex:1;"></span>` +
        `<span style="font-size:0.60rem;color:#667;">+${world.reward?.expBonus || 0} exp on clear</span>` +
      `</div>` +
      `<div style="font-size:0.62rem;color:#556;margin-top:5px;">${world.modifier.description}</div>`;

    if (cardClickable) {
      card.addEventListener('mouseover', () => { card.style.borderColor = world.color + 'aa'; });
      card.addEventListener('mouseout',  () => { card.style.borderColor = isCurrent ? world.color + '66' : 'rgba(255,255,255,0.07)'; });
      card.addEventListener('click', () => _beginMultiverseWorld(world.id));
    }
    list.appendChild(card);
  });

  // Total exp display
  const expDiv = document.createElement('div');
  expDiv.style.cssText = 'text-align:center;padding:8px;font-size:0.65rem;color:#556;margin-top:4px;';
  expDiv.textContent = `Total Multiverse EXP: ${save.totalExp}`;
  list.appendChild(expDiv);
}

function _beginMultiverseWorld(worldId) {
  // Require the Axiom Ship to be complete before any trial can be entered.
  // The ship is built by collecting all 5 parts through story chapters.
  if (!window.SHIP || !SHIP.built) {
    if (typeof storyFightSubtitle !== 'undefined') {
      storyFightSubtitle = {
        text:     '"The ship is not ready. The trials will destroy you without it."',
        color:    '#ffaa44',
        timer:    300,
        maxTimer: 300
      };
    }
    return;
  }
  closeMultiverseMenu();
  MultiverseManager.enterWorld(worldId);
  // Launch first encounter
  _launchMultiverseEncounter();
}

function _launchMultiverseEncounter() {
  const enc   = EncounterManager.getCurrentEncounter();
  const world = MultiverseManager.getActiveWorld();
  if (!enc || !world) { backToMenu(); return; }

  gameMode = 'multiverse';
  selectedArena = world.arenaKey;

  // Configure the two fighters via existing player config system
  const p1w = document.getElementById('p1Weapon');
  if (p1w) p1w.value = p1w.value || 'sword'; // keep P1 weapon

  // Store encounter config for _startGameCore to read
  _pendingMultiverseEncounter = {
    opponentName:  enc.opponentName,
    weaponKey:     enc.weaponKey,
    classKey:      enc.classKey,
    aiDiff:        enc.aiDiff,
    color:         enc.color,
    twoEnemies:    enc.twoEnemies || false,
    secondColor:   enc.secondColor || '#667788',
    lives:         enc.lives || 3,
    type:          enc.type,
    isBossEnc:     enc.isBoss || false,
    armor:         enc.armor || [],
  };

  startGame();
}

// Pending encounter config read by _startGameCore
let _pendingMultiverseEncounter = null;

// ============================================================
// BANNER GLOBALS (used by MultiverseManager._drawWorldCompleteBanner)
// ============================================================
let _multiverseWorldCompleteTimer  = 0;
let _multiverseWorldCompleteLabel  = '';
let _multiverseWorldCompleteUnlock = null;

// ============================================================
// MULTIVERSE MATCH END — called from endGame()
// ============================================================
function multiverseOnMatchEnd(playerWon) {
  if (!MultiverseManager.isActive()) return;
  const enc = EncounterManager.getCurrentEncounter();
  if (!enc) return;

  MultiverseManager.onEncounterComplete(
    MultiverseManager.getActiveWorldId(),
    enc.type,
    playerWon
  );

  if (playerWon) {
    // Brief delay then auto-advance to next encounter (or world-complete screen)
    setTimeout(() => {
      const nextEnc = EncounterManager.getCurrentEncounter();
      if (nextEnc && EncounterManager.getEncounterIndex() < EncounterManager.getEncounterCount()) {
        // More encounters left in this world
        const ov = document.getElementById('gameOverOverlay');
        if (ov) ov.style.display = 'none';
        _launchMultiverseEncounter();
      } else {
        // World complete — go back to multiverse menu
        setTimeout(() => {
          backToMenu();
          setTimeout(openMultiverseMenu, 400);
        }, 2800); // let world-complete banner show
      }
    }, 1800);
  }
  // If player lost — standard retry screen handles it; no auto-advance
}

// ============================================================
// GRAVITY: hook into Fighter physics
// Fighter.update() uses gravDir; we override it per-frame via
// worldModifiers so existing gravity inversion code path fires.
// ============================================================
// This function is called by smb-loop.js each frame when multiverse is active
function multiverseTickPhysicsHooks() {
  if (!MultiverseManager.isActive() || !players) return;
  players.forEach(p => {
    if (p._mvGravInverted !== undefined && !p.isBoss) {
      // Re-use the existing tfGravityInverted path in Fighter.update()
      // We temporarily shadow it without touching TF state
      p._mvGravInvertedActive = !!p._mvGravInverted;
    }
  });
}
