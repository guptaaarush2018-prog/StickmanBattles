'use strict';
// smb-cheats.js — Cheat code logic (_cheatUnlockAll, applyCode) and secret letter codes
// Depends on: smb-globals.js, smb-camera.js
// ============================================================
// CHEAT: UNLOCK ALL
// ============================================================
function _cheatUnlockAll() {
  // Boss
  if (typeof setAccountFlagWithRuntime === 'function') {
    setAccountFlagWithRuntime(['unlocks', 'bossBeaten'], true, function(v) { bossBeaten = v; });
  } else { bossBeaten = true; }
  const bossCard = document.getElementById('modeBoss');
  if (bossCard) bossCard.style.display = '';

  // True Form
  if (typeof setAccountFlagWithRuntime === 'function') {
    setAccountFlagWithRuntime(['unlocks', 'trueform'], true, function(v) { unlockedTrueBoss = v; });
    [0,1,2,3,4,5,6,7].forEach(function(id) { if (typeof addLetter === 'function') addLetter(id); });
  } else {
    unlockedTrueBoss = true;
    [0,1,2,3,4,5,6,7].forEach(function(id) { collectedLetterIds.add(id); });
  }
  syncCodeInput && syncCodeInput();
  const tfCard = document.getElementById('modeTrueForm');
  if (tfCard) tfCard.style.display = '';

  // Sovereign
  if (typeof setAccountFlagWithRuntime === 'function') {
    setAccountFlagWithRuntime(['unlocks', 'sovereignBeaten'], true, function(v) { sovereignBeaten = v; });
  } else { sovereignBeaten = true; }
  const _adCard  = document.getElementById('modeAdaptive');
  const _sovCard = document.getElementById('modeSovereign');
  if (_adCard)  _adCard.style.display  = '';
  if (_sovCard) _sovCard.style.display = '';

  // Megaknight
  if (typeof setAccountFlagWithRuntime === 'function') {
    setAccountFlagWithRuntime(['unlocks', 'megaknight'], true, function(v) { unlockedMegaknight = v; });
  } else { unlockedMegaknight = true; }
  ['p1Class','p2Class'].forEach(id => {
    const sel = document.getElementById(id);
    if (sel && !sel.querySelector('option[value="megaknight"]')) {
      const opt = document.createElement('option'); opt.value = 'megaknight'; opt.textContent = 'Class: Megaknight ★'; sel.appendChild(opt);
    }
  });

  // All achievements
  if (typeof ACHIEVEMENTS !== 'undefined') {
    ACHIEVEMENTS.forEach(a => {
      if (typeof unlockAchievement === 'function') unlockAchievement(a.id);
    });
  }

  // Story: mark all chapters beaten + max tokens
  if (typeof _story2 !== 'undefined' && typeof STORY_CHAPTERS2 !== 'undefined') {
    STORY_CHAPTERS2.forEach(ch => {
      if (!_story2.defeated.includes(ch.id)) _story2.defeated.push(ch.id);
      // Unlock all blueprints that chapters drop
      if (ch.blueprintDrop && !_story2.blueprints.includes(ch.blueprintDrop)) {
        _story2.blueprints.push(ch.blueprintDrop);
      }
    });
    _story2.chapter = STORY_CHAPTERS2.length;
    _story2.tokens  = 99999;
    _story2.exp     = 99999;
    _story2.storyComplete = true;

    // Max out meta upgrades (shop items with ranks)
    if (!_story2.metaUpgrades) _story2.metaUpgrades = {};
    _story2.metaUpgrades.damage        = 6;
    _story2.metaUpgrades.survivability = 6;
    _story2.metaUpgrades.healUses      = 0; // not a rank cap, skip

    // Purchase all story abilities
    if (typeof STORY_ABILITIES2 !== 'undefined') {
      if (!Array.isArray(_story2.unlockedAbilities)) _story2.unlockedAbilities = [];
      Object.keys(STORY_ABILITIES2).forEach(key => {
        if (!_story2.unlockedAbilities.includes(key)) _story2.unlockedAbilities.push(key);
      });
    }

    // Max out skill tree (unlock every node, ignoring cost/prereq order)
    if (typeof STORY_SKILL_TREE !== 'undefined') {
      if (!_story2.skillTree) _story2.skillTree = {};
      for (const branch of Object.values(STORY_SKILL_TREE)) {
        for (const node of branch.nodes) {
          _story2.skillTree[node.id] = true;
        }
      }
    }

    if (typeof _saveStory2 === 'function') _saveStory2();
    if (typeof _updateStoryCloseBtn === 'function') _updateStoryCloseBtn();
    // Reveal story online card if present
    const soCard = document.getElementById('modeStoryOnline');
    if (soCard) soCard.style.display = '';
  }

  // Persist immediately so a page reload doesn't lose the unlocks
  if (typeof saveGame === 'function') saveGame();

  // Notify
  const notif = document.createElement('div');
  notif.textContent = '★ EVERYTHING UNLOCKED ★';
  notif.style.cssText = 'position:fixed;top:20%;left:50%;transform:translateX(-50%);background:linear-gradient(135deg,rgba(160,0,255,0.95),rgba(255,150,0,0.95));color:#fff;padding:16px 40px;border-radius:12px;font-size:1.25rem;font-weight:900;letter-spacing:3px;z-index:9999;pointer-events:none;text-align:center;box-shadow:0 0 50px #ff8800,0 0 20px #cc00ff;';
  document.body.appendChild(notif);
  setTimeout(() => notif.remove(), 3500);
}

// ============================================================
// EXPERIMENTAL CODE SYSTEM
// ============================================================
function applyCode(val) {
  const code  = (val || '').trim().toUpperCase();
  const msgEl = document.getElementById('codeMessage');
  const ok  = (t) => { if (msgEl) { msgEl.textContent = '✓ ' + t; msgEl.style.color = '#44ff88'; msgEl.style.fontSize = ''; } };
  const err = (t) => { if (msgEl) { msgEl.textContent = '✗ ' + t; msgEl.style.color = '#ff4444'; msgEl.style.fontSize = ''; } };

  if (code === 'TRUEFORM') {
    if (typeof setAccountFlagWithRuntime === 'function') {
      setAccountFlagWithRuntime(['unlocks', 'trueform'], true, function(v) { unlockedTrueBoss = v; });
    } else { unlockedTrueBoss = true; }
    const card = document.getElementById('modeTrueForm');
    if (card) card.style.display = '';
    ok('True Creator unlocked! Start a boss fight.');
  } else if (code === 'SOVEREIGN') {
    if (typeof setAccountFlagWithRuntime === 'function') {
      setAccountFlagWithRuntime(['unlocks', 'sovereignBeaten'], true, function(v) { sovereignBeaten = v; });
    } else { sovereignBeaten = true; }
    const adCard  = document.getElementById('modeAdaptive');
    const sovCard = document.getElementById('modeSovereign');
    if (adCard)  adCard.style.display  = '';
    if (sovCard) sovCard.style.display = '';
    ok('SOVEREIGN Ω unlocked! Select it from the menu.');
  } else if (code === 'CLASSMEGAKNIGHT') {
    if (typeof setAccountFlagWithRuntime === 'function') {
      setAccountFlagWithRuntime(['unlocks', 'megaknight'], true, function(v) { unlockedMegaknight = v; });
    } else { unlockedMegaknight = true; }
    ['p1Class','p2Class'].forEach(id => {
      const sel = document.getElementById(id);
      if (sel && !sel.querySelector('option[value="megaknight"]')) {
        const opt = document.createElement('option'); opt.value = 'megaknight'; opt.textContent = 'Class: Megaknight ★'; sel.appendChild(opt);
      }
    });
    ok('Megaknight class unlocked! Select it in the class dropdown.');
  } else if (code.startsWith('MAP:')) {
    const mapKey = code.slice(4).toLowerCase();
    if (!ARENAS[mapKey]) { err('Unknown arena. Try: grass lava space city forest ice ruins'); return; }
    if (gameRunning) {
      switchArena(mapKey);
      ok('Switched to ' + mapKey + ' arena!');
    } else {
      selectedArena = mapKey;
      document.querySelectorAll('.arena-card').forEach(c => c.classList.toggle('active', c.dataset.arena === mapKey));
      ok('Arena set to ' + mapKey + '!');
    }
  } else if (code.startsWith('WEAPON:')) {
    const wKey = code.slice(7).toLowerCase();
    if (!WEAPONS[wKey]) { err('Unknown weapon. Try: sword hammer gun axe spear bow shield scythe'); return; }
    if (gameRunning) {
      const p = players.find(pl => !pl.isAI && !pl.isBoss);
      if (p) { p.weaponKey = wKey; p.weapon = WEAPONS[wKey]; p.cooldown = 0; p.abilityCooldown = 0; }
      ok('Weapon changed to ' + wKey + '!');
    } else { err('Enter WEAPON: codes while in-game.'); }
  } else if (code.startsWith('CLASS:')) {
    const cKey = code.slice(6).toLowerCase();
    if (!CLASSES[cKey] && cKey !== 'megaknight') { err('Unknown class. Try: none thor kratos ninja gunner archer paladin berserker megaknight'); return; }
    if (gameRunning) {
      const p = players.find(pl => !pl.isAI && !pl.isBoss);
      if (p) applyClass(p, cKey);
      ok('Class changed to ' + cKey + '!');
    } else { err('Enter CLASS: codes while in-game.'); }
  } else if (code === 'GODMODE') {
    if (gameRunning) {
      const p = players.find(pl => !pl.isAI && !pl.isBoss);
      if (p) { p.invincible = 99999; p.health = p.maxHealth; p.godmode = true; }
      ok('GOD MODE — invincible + flight (jump=up, shield=down)!');
    } else { err('Enter GODMODE while in-game.'); }
  } else if (code === 'FULLHEAL') {
    if (gameRunning) {
      players.filter(pl => !pl.isBoss).forEach(p => { p.health = p.maxHealth; spawnParticles(p.cx(), p.cy(), '#44ff88', 18); });
      ok('All players fully healed!');
    } else { err('Enter FULLHEAL while in-game.'); }
  } else if (code === 'SUPERJUMP') {
    if (gameRunning) {
      const p = players.find(pl => !pl.isAI && !pl.isBoss);
      if (p) { p.vy = -36; p.canDoubleJump = true; }
      ok('SUPER JUMP!');
    } else { err('Enter SUPERJUMP while in-game.'); }
  } else if (code === 'KILLBOSS') {
    if (gameRunning) {
      const boss = players.find(p => p.isBoss);
      if (boss) boss.health = 1;
      ok('Boss is nearly dead!');
    } else { err('Enter KILLBOSS while in-game.'); }
  } else if (code.startsWith('SETHP:')) {
    // SETHP:<n> — set TrueForm (Axion) HP and bypass all cinematics above that threshold.
    // Example: SETHP:1001  →  boss at 1001 HP, paradox1000 cinematic ready to fire.
    if (!gameRunning) { err('Enter SETHP: while in a TrueForm fight.'); return; }
    const _targetHp = parseInt(code.slice(6), 10);
    if (isNaN(_targetHp) || _targetHp < 1) { err('Usage: SETHP:<number>  e.g. SETHP:1001'); return; }
    const _tfBoss = players.find(p => p.isBoss && p.isTrueForm);
    if (!_tfBoss) { err('No TrueForm boss found. Start a True Form fight first.'); return; }

    // ── 1. Set HP ────────────────────────────────────────────────────────────
    _tfBoss.health    = Math.min(_targetHp, _tfBoss.maxHealth);
    _tfBoss.invincible = 90; // brief invincibility so the HP set doesn't immediately trigger death

    // ── 2. Mark all cinematics that would have fired above _targetHp ─────────
    if (!_tfBoss._cinematicFired) _tfBoss._cinematicFired = new Set();
    // 'entry' always fires at fight start
    _tfBoss._cinematicFired.add('entry');
    if (_targetHp < 7500) _tfBoss._cinematicFired.add('qte75');
    if (_targetHp < 5000) { _tfBoss._cinematicFired.add('50'); }
    if (_targetHp < 2500) _tfBoss._cinematicFired.add('qte25');
    if (_targetHp < 1500) _tfBoss._cinematicFired.add('15');
    // paradox1000 fires at <=1000; only pre-mark if we're setting above that
    if (_targetHp <= 1000) _tfBoss._cinematicFired.add('paradox1000');
    // false victory no longer HP-triggered; never pre-mark it

    // ── 3. Reset in-flight cinematic state ──────────────────────────────────
    // Stop opening fight if it was running
    if (typeof tfOpeningFightActive !== 'undefined') tfOpeningFightActive = false;
    if (typeof _tfOpeningTFRef     !== 'undefined') _tfOpeningTFRef      = null;
    if (typeof paradoxEntity       !== 'undefined' && paradoxEntity) {
      paradoxEntity.done = true;
      paradoxEntity = null;
    }
    // Reset absorption / paradox death flags so the 1000-HP sequence can run clean
    if (typeof paradoxDeathComplete !== 'undefined') paradoxDeathComplete = false;
    if (typeof absorptionComplete   !== 'undefined') absorptionComplete   = false;
    if (typeof _tfAbsorptionState   !== 'undefined') _tfAbsorptionState   = null;
    if (typeof tfAbsorptionScene    !== 'undefined') tfAbsorptionScene    = null;
    if (typeof tfFinalParadoxFired  !== 'undefined') tfFinalParadoxFired  = false;

    // Cancel any active cinematic / QTE
    if (typeof activeCinematic !== 'undefined') activeCinematic = null;
    if (typeof isCinematic     !== 'undefined') isCinematic     = false;
    if (typeof slowMotion      !== 'undefined') slowMotion       = 1.0;
    if (typeof gameFrozen      !== 'undefined') gameFrozen       = false;
    if (typeof cinematicCamOverride !== 'undefined') cinematicCamOverride = false;
    // Hard-reset combatLock so no phase leaks across game sessions
    if (typeof combatLock !== 'undefined') {
      combatLock.phase    = 'normal';
      combatLock.priority = 0;
      combatLock.blocks   = { ai: false, movement: false, input: false };
    }
    if (typeof activeQTE       !== 'undefined' && activeQTE) {
      if (typeof cancelQTE === 'function') cancelQTE();
      else activeQTE = null;
    }

    // Ensure fight state is 'none' (or 'backstage' if we're past the Code Realm)
    if (typeof tfCinematicState !== 'undefined') {
      tfCinematicState = (_targetHp <= 50) ? 'backstage' : 'none';
    }

    // Reset free-phase timer so it doesn't block AI
    _tfBoss._freePhaseTimer = 9999;

    // Reposition hero next to boss for easy testing
    const _hero = players.find(p => !p.isBoss && !p.isRemote);
    if (_hero) {
      _hero.x  = Math.max(40, _tfBoss.x - 160);
      _hero.y  = _tfBoss.y;
      _hero.vx = 0; _hero.vy = 0;
      _hero.health = _hero.maxHealth; // full HP so player doesn't die during test
    }

    ok('TrueForm HP → ' + _tfBoss.health + '. Cinematics above this threshold bypassed.');
  } else if (code === 'UNLOCKALL') {
    _cheatUnlockAll();
    ok('Everything unlocked!');
  } else if (code === 'HELP' || code === 'CODES') {
    if (msgEl) {
      msgEl.textContent = 'TRUEFORM · SOVEREIGN · CLASSMEGAKNIGHT · UNLOCKALL · GODMODE · FULLHEAL · KILLBOSS · SETHP:<n> · MAP:<arena> · WEAPON:<key> · CLASS:<key>';
      msgEl.style.color = '#aabbff'; msgEl.style.fontSize = '0.7rem';
    }
  } else {
    err('Unknown code. Type HELP for a list.');
  }
}
