// smc-save.js — Persistent save system: auto-save, export, import
'use strict';

console.info('[BOOT ORDER] smb-save init');

const SAVE_VERSION = 3;
const SAVE_KEY     = 'smb_state';
const CANONICAL_SAVE_KEY = 'smb_state';

// Dynamic key helpers — route through AccountManager when available so each
// account gets its own isolated save slot.
function _getSaveKey()   { return (window.AccountManager) ? window.AccountManager.getActiveSaveKey() : SAVE_KEY; }
function _getBackupKey() { return _getSaveKey() + '_backup'; }

function _parseMaybeEncodedSave(raw) {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') return parsed;
  } catch(e) {}
  try {
    const decoded = JSON.parse(decodeURIComponent(escape(atob(raw))));
    if (decoded && typeof decoded === 'object') return decoded;
  } catch(e) {}
  console.warn('[SAVE] parse failed', { key: CANONICAL_SAVE_KEY });
  return null;
}

function _readCanonicalSave() {
  try {
    const raw = localStorage.getItem(CANONICAL_SAVE_KEY);
    if (!raw) return null;
    const parsed = _parseMaybeEncodedSave(raw);
    if (!parsed) return null;
    if (parsed && parsed.accounts && parsed.activeAccountId) {
      const acct = parsed.accounts[parsed.activeAccountId];
      return acct && acct.data ? _normalizeAccountSaveShape(acct.data) : null;
    }
    return _normalizeAccountSaveShape(parsed);
  } catch(e) {
    console.warn('[SAVE] parse failed', e);
    return null;
  }
}

function _writeCanonicalSave(data) {
  try {
    if (window.GameState && typeof GameState.getPersistent === 'function') {
      localStorage.setItem(CANONICAL_SAVE_KEY, JSON.stringify(GameState.getPersistent()));
    } else {
      localStorage.setItem(CANONICAL_SAVE_KEY, JSON.stringify(data));
    }
  } catch(e) {
    console.warn('[save] save write failed: canonical save', e);
  }
}

function _readCanonicalStateRoot() {
  try {
    const raw = localStorage.getItem(CANONICAL_SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return (parsed && typeof parsed === 'object') ? parsed : null;
  } catch(e) {
    console.warn('[SAVE] parse failed', e);
    return null;
  }
}

function _extractActiveAccountSave(root) {
  if (!root || typeof root !== 'object') return null;
  if (root.accounts && root.activeAccountId && root.accounts[root.activeAccountId]) {
    const acct = root.accounts[root.activeAccountId];
    return acct && acct.data ? acct.data : null;
  }
  if (typeof root.version === 'number') return root;
  return null;
}

function _normalizeAccountSaveShape(data) {
  if (!data || typeof data !== 'object') return null;
  const out = JSON.parse(JSON.stringify(data));
  if (typeof out.version !== 'number') out.version = SAVE_VERSION;
  if (!out.unlocks || typeof out.unlocks !== 'object') out.unlocks = {};
  if (Array.isArray(out.achievements) && !Array.isArray(out.unlocks.achievements)) {
    out.unlocks.achievements = out.achievements.slice();
  }
  if (!Array.isArray(out.cosmetics)) {
    if (Array.isArray(out.unlockedCosmetics)) out.cosmetics = out.unlockedCosmetics.slice();
    else if (out.unlocks && Array.isArray(out.unlocks.cosmetics)) out.cosmetics = out.unlocks.cosmetics.slice();
    else out.cosmetics = [];
  }
  if (typeof out.coins !== 'number') {
    if (typeof out.playerCoins === 'number') out.coins = out.playerCoins;
    else if (out.progression && typeof out.progression.coins === 'number') out.coins = out.progression.coins;
    else if (out.stats && typeof out.stats.coins === 'number') out.coins = out.stats.coins;
    else if (out.story && typeof out.story.coins === 'number') out.coins = out.story.coins;
    else if (typeof out.chapter === 'number' && out.chapter > 0) out.coins = out.coins || 0;
    else out.coins = 0;
  }
  if (typeof out.chapter !== 'number') {
    if (out.storyProgress && typeof out.storyProgress.chapter === 'number') out.chapter = out.storyProgress.chapter;
    else if (out.story && typeof out.story.chapter === 'number') out.chapter = out.story.chapter;
    else if (out.progression && typeof out.progression.chapter === 'number') out.chapter = out.progression.chapter;
    else out.chapter = 0;
  }
  if (out.storyProgress && typeof out.storyProgress === 'object') {
    if (!out.story || typeof out.story !== 'object') out.story = {};
    if (typeof out.story.chapter !== 'number' && typeof out.storyProgress.chapter === 'number') out.story.chapter = out.storyProgress.chapter;
    if (typeof out.story.act !== 'number' && typeof out.storyProgress.act === 'number') out.story.act = out.storyProgress.act;
    if (!Array.isArray(out.story.defeated) && Array.isArray(out.storyProgress.defeated)) out.story.defeated = out.storyProgress.defeated.slice();
    if (!out.story.meta && out.storyProgress.meta && typeof out.storyProgress.meta === 'object') out.story.meta = Object.assign({}, out.storyProgress.meta);
  }
  if (out.story && typeof out.story === 'object') {
    if (!out.storyProgress || typeof out.storyProgress !== 'object') out.storyProgress = {};
    if (typeof out.storyProgress.chapter !== 'number' && typeof out.story.chapter === 'number') out.storyProgress.chapter = out.story.chapter;
    if (typeof out.storyProgress.act !== 'number' && typeof out.story.act === 'number') out.storyProgress.act = out.story.act;
    if (!Array.isArray(out.storyProgress.defeated) && Array.isArray(out.story.defeated)) out.storyProgress.defeated = out.story.defeated.slice();
    if (!out.storyProgress.flags || typeof out.storyProgress.flags !== 'object') out.storyProgress.flags = {};
  }
  if (!Array.isArray(out.achievements)) {
    out.achievements = Array.isArray(out.unlocks.achievements) ? out.unlocks.achievements.slice() : [];
  }
  if (!out.meta || typeof out.meta !== 'object') out.meta = {};
  if (typeof out.meta.updatedAt !== 'number') out.meta.updatedAt = 0;
  if (typeof out.updatedAt !== 'number') out.updatedAt = out.meta.updatedAt || 0;
  if (typeof out.chapter !== 'number' && typeof out.storyProgress === 'object' && typeof out.storyProgress.chapter === 'number') {
    out.chapter = out.storyProgress.chapter;
  }
  return out;
}

function normalizeSave(raw) {
  return _normalizeAccountSaveShape(raw);
}

function _saveSnapshotSummary(data) {
  const d = _normalizeAccountSaveShape(data) || {};
  const coins = typeof d.coins === 'number' ? d.coins : 0;
  const chapter = (typeof d.chapter === 'number')
    ? d.chapter
    : (d.storyProgress && typeof d.storyProgress.chapter === 'number'
      ? d.storyProgress.chapter
      : (d.story && typeof d.story.chapter === 'number' ? d.story.chapter : 0));
  return { coins, chapter };
}

function _logSaveState(prefix, data, suffix) {
  const s = _saveSnapshotSummary(data);
  console.info(`[${prefix}] ${CANONICAL_SAVE_KEY} ${suffix}`, { coins: s.coins, chapter: s.chapter });
}

function _canonicalSaveMeaningful(data) {
  const d = _normalizeAccountSaveShape(data);
  if (!d || typeof d !== 'object') return false;
  if (d.story && Array.isArray(d.story.defeated) && d.story.defeated.length > 0) return true;
  if (typeof d.chapter === 'number' && d.chapter > 0) return true;
  if (d.storyProgress && typeof d.storyProgress.chapter === 'number' && d.storyProgress.chapter > 0) return true;
  if (d.story && typeof d.story.chapter === 'number' && d.story.chapter > 0) return true;
  if (d.story && (d.story.storyComplete || (Array.isArray(d.story.blueprints) && d.story.blueprints.length > 0))) return true;
  if (d.unlocks) {
    if (d.unlocks.bossBeaten || d.unlocks.trueform || d.unlocks.megaknight || d.unlocks.sovereignBeaten || d.unlocks.storyOnline || d.unlocks.tfEndingSeen || d.unlocks.damnationScar) return true;
    if (Array.isArray(d.unlocks.letters) && d.unlocks.letters.length > 0) return true;
    if (Array.isArray(d.unlocks.achievements) && d.unlocks.achievements.length > 0) return true;
  }
  if (typeof d.coins === 'number' && d.coins > 0) return true;
  if (Array.isArray(d.cosmetics) && d.cosmetics.length > 0) return true;
  return false;
}

// ── Default save structure (used for deep-merge / version migrations) ─────────
const _SAVE_DEFAULTS = {
  version: SAVE_VERSION,
  coins: 0,
  chapter: 0,
  cosmetics: [],
  achievements: [],
  unlocks: {
    bossBeaten:         false,
    trueform:           false,
    megaknight:         false,
    letters:            [],
    achievements:       [],
    sovereignBeaten:    false,
    storyOnline:        false,
    tfEndingSeen:       false,
    damnationScar:      false,
    storyDodgeUnlocked: false,
    paradoxCompanion:   false,
    interTravel:        false,
    patrolMode:         false,
    godEncountered:     false,
    godDefeated:        false,
  },
  settings: {
    sfxVol:    0.35,
    sfxMute:   false,
    musicMute: false,
    ragdoll:   false,
  },
  updatedAt: 0,
};

// ── Custom Weapon helpers ─────────────────────────────────────────────────────
// window.CUSTOM_WEAPONS is populated by smb-designer.js or cheat console.
// We persist both the selected key and all weapon objects across sessions.
function saveCustomWeaponSelection(key) {
  try { localStorage.setItem('smc_customWeapon', key || ''); } catch(e) {}
}
function loadCustomWeaponSelection() {
  return localStorage.getItem('smc_customWeapon') || '';
}
function clearCustomWeaponSelection() {
  try {
    localStorage.removeItem('smc_customWeapon');
    localStorage.removeItem('smc_customWeaponsData');
  } catch(e) {}
}
function saveCustomWeaponsData() {
  try {
    const data = window.CUSTOM_WEAPONS || {};
    // Strip non-serializable fields (functions like ability)
    const serializable = {};
    for (const [k, w] of Object.entries(data)) {
      const copy = Object.assign({}, w);
      delete copy.ability;
      serializable[k] = copy;
    }
    localStorage.setItem('smc_customWeaponsData', JSON.stringify(serializable));
  } catch(e) {}
}
function loadCustomWeaponsData() {
  try {
    const raw = localStorage.getItem('smc_customWeaponsData');
    if (!raw) return;
    const data = JSON.parse(raw);
    window.CUSTOM_WEAPONS = window.CUSTOM_WEAPONS || {};
    for (const [k, w] of Object.entries(data)) {
      window.CUSTOM_WEAPONS[k] = w;
    }
  } catch(e) {}
}

// ── Migration ─────────────────────────────────────────────────────────────────
function _migrateSave(data) {
  const d = Object.assign({}, data);
  // v1 → v2: ensure settings.musicMute exists (was added in v2)
  if (!d.settings) d.settings = {};
  if (typeof d.settings.musicMute === 'undefined') d.settings.musicMute = false;
  if (typeof d.settings.ragdoll   === 'undefined') d.settings.ragdoll   = false;
  // ensure unlocks sub-object has all keys
  if (!d.unlocks) d.unlocks = {};
  if (typeof d.unlocks.megaknight        === 'undefined') d.unlocks.megaknight        = false;
  if (!Array.isArray(d.unlocks.achievements))             d.unlocks.achievements      = [];
  // v2 → v3: new unlock flags, coins, cosmetics
  if (typeof d.unlocks.sovereignBeaten    === 'undefined') d.unlocks.sovereignBeaten    = false;
  if (typeof d.unlocks.storyOnline        === 'undefined') d.unlocks.storyOnline        = false;
  if (typeof d.unlocks.tfEndingSeen       === 'undefined') d.unlocks.tfEndingSeen       = false;
  if (typeof d.unlocks.damnationScar      === 'undefined') d.unlocks.damnationScar      = false;
  if (typeof d.unlocks.storyDodgeUnlocked === 'undefined') d.unlocks.storyDodgeUnlocked = false;
  if (typeof d.unlocks.paradoxCompanion   === 'undefined') d.unlocks.paradoxCompanion   = false;
  if (typeof d.unlocks.interTravel        === 'undefined') d.unlocks.interTravel        = false;
  if (typeof d.unlocks.patrolMode         === 'undefined') d.unlocks.patrolMode         = false;
  if (typeof d.unlocks.godEncountered    === 'undefined') d.unlocks.godEncountered    = false;
  if (typeof d.unlocks.godDefeated       === 'undefined') d.unlocks.godDefeated       = false;
  if (typeof d.coins !== 'number')     d.coins     = 0;
  if (!Array.isArray(d.cosmetics))     d.cosmetics = [];
  d.version = SAVE_VERSION;
  return d;
}

// ── Utilities ─────────────────────────────────────────────────────────────────
function _deepMerge(defaults, saved) {
  const out = Object.assign({}, defaults);
  for (const k of Object.keys(saved)) {
    if (k in defaults
        && typeof defaults[k] === 'object'
        && !Array.isArray(defaults[k])
        && defaults[k] !== null) {
      out[k] = _deepMerge(defaults[k], saved[k]);
    } else {
      out[k] = saved[k];
    }
  }
  return out;
}

// ── Gather progression state from globals (SHIP, FRACTURES, motivationStage) ──
function _gatherProgressionData() {
  const data = {};
  try { if (typeof SHIP !== 'undefined') data.ship = JSON.parse(JSON.stringify(SHIP)); } catch(e) {}
  try {
    if (typeof FRACTURES !== 'undefined') {
      data.fractures = FRACTURES.map(function(f) {
        return { id: f.id, unlocked: f.unlocked, previewed: f.previewed, completed: f.completed };
      });
    }
  } catch(e) {}
  try {
    if (typeof motivationStage !== 'undefined') data.motivationStage = motivationStage;
  } catch(e) {}
  return data;
}

// ── Flush volatile runtime state into account.data (SSOT approach) ───────────
// Called by saveGame() before serializing.  account.data is the single source
// of truth; this function writes runtime globals that are NOT automatically
// committed via setAccountFlag (story, storyProgress, settings, progression).
// For fields that ARE committed via setAccountFlag (coins, cosmetics, unlock
// flags), we write from runtime as a safety net using the "never lower" rule.
function _flushRuntimeIntoBase(base) {
  // story — _story2 lives in smb-story-config.js; flush its snapshot
  if (typeof getStoryDataForSave === 'function') {
    const _snap = getStoryDataForSave();
    if (_snap && Array.isArray(_snap.defeated)) base.story = _snap;
  }
  // storyProgress — STORY_PROGRESS is mutated directly in smb-progression.js
  if (typeof STORY_PROGRESS !== 'undefined') {
    if (!base.storyProgress || typeof base.storyProgress !== 'object') base.storyProgress = {};
    if (typeof STORY_PROGRESS.act     === 'number') base.storyProgress.act     = STORY_PROGRESS.act;
    if (typeof STORY_PROGRESS.chapter === 'number') base.storyProgress.chapter = STORY_PROGRESS.chapter;
    if (STORY_PROGRESS.flags && typeof STORY_PROGRESS.flags === 'object') {
      base.storyProgress.flags = Object.assign({}, STORY_PROGRESS.flags);
    }
    if (!Array.isArray(base.storyProgress.defeated)) base.storyProgress.defeated = [];
  }
  // chapter top-level — take the highest observed value
  const _rch = (base.story && typeof base.story.chapter === 'number') ? base.story.chapter
    : (base.storyProgress && typeof base.storyProgress.chapter === 'number') ? base.storyProgress.chapter : 0;
  if (typeof base.chapter !== 'number' || _rch > base.chapter) base.chapter = _rch;
  // coins — runtime is always authoritative (kept in sync by updateCoins → setAccountFlagWithRuntime)
  if (typeof playerCoins === 'number') base.coins = playerCoins;
  // cosmetics — runtime is always authoritative (kept in sync by addCosmetic → setAccountFlag)
  if (typeof unlockedCosmetics !== 'undefined' && Array.isArray(unlockedCosmetics)) {
    base.cosmetics = unlockedCosmetics.slice();
  }
  // achievements
  if (typeof earnedAchievements !== 'undefined') {
    const _ach = Array.from(earnedAchievements);
    base.achievements = _ach;
    if (!base.unlocks) base.unlocks = {};
    base.unlocks.achievements = _ach;
  }
  // unlock flags — safety net; never lower a flag that's already true in account.data
  if (!base.unlocks) base.unlocks = {};
  if (typeof bossBeaten         !== 'undefined') base.unlocks.bossBeaten      = base.unlocks.bossBeaten      || !!bossBeaten;
  if (typeof unlockedTrueBoss   !== 'undefined') base.unlocks.trueform        = base.unlocks.trueform        || !!unlockedTrueBoss;
  if (typeof unlockedMegaknight !== 'undefined') base.unlocks.megaknight      = base.unlocks.megaknight      || !!unlockedMegaknight;
  if (typeof sovereignBeaten    !== 'undefined') base.unlocks.sovereignBeaten = base.unlocks.sovereignBeaten || !!sovereignBeaten;
  if (typeof storyOnline        !== 'undefined') base.unlocks.storyOnline     = base.unlocks.storyOnline     || !!storyOnline;
  if (typeof storyDodgeUnlocked !== 'undefined') base.unlocks.storyDodgeUnlocked = base.unlocks.storyDodgeUnlocked || !!storyDodgeUnlocked;
  if (typeof paradoxCompanionActive !== 'undefined') base.unlocks.paradoxCompanion = base.unlocks.paradoxCompanion || !!paradoxCompanionActive;
  if (typeof godEncountered     !== 'undefined') base.unlocks.godEncountered  = base.unlocks.godEncountered  || !!godEncountered;
  if (typeof godDefeated        !== 'undefined') base.unlocks.godDefeated     = base.unlocks.godDefeated     || !!godDefeated;
  if (typeof collectedLetterIds !== 'undefined') {
    const _ids = Array.from(collectedLetterIds);
    if (!Array.isArray(base.unlocks.letters) || _ids.length > base.unlocks.letters.length) base.unlocks.letters = _ids;
  }
  // settings
  base.settings = {
    sfxVol:    parseFloat(localStorage.getItem('smc_sfxVol') || '0.35'),
    sfxMute:   (localStorage.getItem('smc_sfxMute')   === '1'),
    musicMute: (localStorage.getItem('smc_musicMute') === '1'),
    ragdoll:   (typeof settings !== 'undefined') ? !!settings.ragdollEnabled : (localStorage.getItem('smc_ragdoll') === '1'),
  };
  // progression
  base.progression = _gatherProgressionData();
  // version stamp
  base.version = SAVE_VERSION;
}

// ── Gather current state from individual localStorage keys (used by export) ──
function _gatherSaveData() {
  const active = (typeof GameState !== 'undefined' && typeof GameState.getActiveAccount === 'function')
    ? GameState.getActiveAccount()
    : null;
  const chapter = (typeof STORY_PROGRESS !== 'undefined' && typeof STORY_PROGRESS.chapter === 'number')
    ? STORY_PROGRESS.chapter
    : ((active && active.data && typeof active.data.chapter === 'number') ? active.data.chapter : 0);
  const updatedAt = (active && active.data && typeof active.data.updatedAt === 'number')
    ? active.data.updatedAt
    : (active && active.data && active.data.meta && typeof active.data.meta.updatedAt === 'number'
      ? active.data.meta.updatedAt
      : 0);
  const achievements = (typeof earnedAchievements !== 'undefined') ? Array.from(earnedAchievements) : [];
  return {
    version: SAVE_VERSION,
    story: (typeof getStoryDataForSave === 'function') ? getStoryDataForSave() : null,
    chapter,
    storyProgress: (typeof STORY_PROGRESS !== 'undefined') ? {
      act:     STORY_PROGRESS.act,
      chapter: STORY_PROGRESS.chapter,
      flags:   Object.assign({}, STORY_PROGRESS.flags),
    } : null,
    unlocks: {
      // Core unlocks — read from runtime globals (authoritative after _refreshRuntimeFromSave)
      bossBeaten:   (typeof bossBeaten        !== 'undefined') ? !!bossBeaten        : false,
      trueform:     (typeof unlockedTrueBoss   !== 'undefined') ? !!unlockedTrueBoss   : false,
      megaknight:   (typeof unlockedMegaknight !== 'undefined') ? !!unlockedMegaknight : false,
      letters:      (typeof collectedLetterIds !== 'undefined') ? Array.from(collectedLetterIds) : [],
      achievements: (typeof earnedAchievements !== 'undefined') ? Array.from(earnedAchievements) : [],
      // Extended unlocks with runtime globals
      storyDodgeUnlocked: (typeof storyDodgeUnlocked    !== 'undefined') ? !!storyDodgeUnlocked    : false,
      paradoxCompanion:   (typeof paradoxCompanionActive !== 'undefined') ? !!paradoxCompanionActive : false,
      // Extended unlocks — sourced from runtime globals (hydrated by _refreshRuntimeFromSave)
      sovereignBeaten: (typeof sovereignBeaten !== 'undefined') ? !!sovereignBeaten : false,
      storyOnline:     (typeof storyOnline     !== 'undefined') ? !!storyOnline     : false,
      tfEndingSeen:    (typeof GameState !== 'undefined' && GameState.getActiveAccount()
                         ? !!GameState.getActiveAccount().data?.unlocks?.tfEndingSeen : false),
      damnationScar:   (typeof GameState !== 'undefined' && GameState.getActiveAccount()
                         ? !!GameState.getActiveAccount().data?.unlocks?.damnationScar : false),
      interTravel:     (typeof GameState !== 'undefined' && GameState.getActiveAccount()
                         ? !!GameState.getActiveAccount().data?.unlocks?.interTravel : false),
      patrolMode:      (typeof GameState !== 'undefined' && GameState.getActiveAccount()
                         ? !!GameState.getActiveAccount().data?.unlocks?.patrolMode : false),
      godEncountered:  (typeof godEncountered !== 'undefined') ? !!godEncountered : false,
      godDefeated:     (typeof godDefeated    !== 'undefined') ? !!godDefeated    : false,
    },
    coins:     (typeof playerCoins        !== 'undefined') ? playerCoins                  : 0,
    cosmetics: (typeof unlockedCosmetics  !== 'undefined') ? unlockedCosmetics.slice()    : [],
    achievements,
    meta: {
      updatedAt,
      source: (active && active.data && active.data.meta && active.data.meta.source) || 'local',
    },
    updatedAt,
    settings: {
      sfxVol:    parseFloat(localStorage.getItem('smc_sfxVol') || '0.35'),
      sfxMute:   (localStorage.getItem('smc_sfxMute')    === '1'),
      musicMute: (localStorage.getItem('smc_musicMute')  === '1'),
      ragdoll:   (typeof settings !== 'undefined') ? !!settings.ragdollEnabled : (localStorage.getItem('smc_ragdoll') === '1'),
    },
    progression: _gatherProgressionData(),
  };
}

// ── Write save data back into individual localStorage keys ────────────────────
function _applySaveData(data) {
  const d = _deepMerge(_SAVE_DEFAULTS, data);
  if (typeof restoreStoryDataFromSave === 'function') {
    // Always restore story data — fall back to default so switching to a new account
    // (which has no story field) resets _story2 instead of leaving the old account's data.
    const storyPayload = (d.story && d.story.defeated) ? d.story
      : (typeof _defaultStory2Progress === 'function' ? _defaultStory2Progress() : null);
    if (storyPayload) restoreStoryDataFromSave(storyPayload);
  }
}

// ── Refresh runtime variables after loading a save ───────────────────────────
// Called after _applySaveData() so that module-level globals (which were set at
// parse time from localStorage) are brought in sync with the newly-active account.
function _refreshRuntimeFromSave(data) {
  if (!data) return;

  // Skip if we already hydrated this account — prevents redundant re-runs within a session.
  // Keyed by account ID (not a boolean) so account switches automatically pass through.
  const _acct = window.GameState ? GameState.getActiveAccount() : null;
  const _acctId = _acct ? _acct.id : null;
  if (_acctId && _acctId === _hydratedAccountId) return;

  // ── Reset phase: bring all account-specific globals to their initial defaults
  // before applying save data. This ensures no previous account's state bleeds
  // through when the incoming data is sparse or omits a field entirely.
  if (typeof resetProgressionGlobals   === 'function') resetProgressionGlobals();
  if (typeof resetAccountScopedGlobals === 'function') resetAccountScopedGlobals();

  // Unlock globals — smb-globals.js
  if (data.unlocks) {
    if (typeof bossBeaten         !== 'undefined') bossBeaten         = !!data.unlocks.bossBeaten;
    if (typeof unlockedTrueBoss   !== 'undefined') unlockedTrueBoss   = !!data.unlocks.trueform;
    if (typeof unlockedMegaknight !== 'undefined') unlockedMegaknight = !!data.unlocks.megaknight;
    if (typeof collectedLetterIds !== 'undefined' && Array.isArray(data.unlocks.letters)) {
      collectedLetterIds.clear();
      data.unlocks.letters.forEach(function(id) { collectedLetterIds.add(id); });
    }
    // Extended runtime globals reset by resetAccountScopedGlobals() above; restore here
    if (typeof storyDodgeUnlocked    !== 'undefined') storyDodgeUnlocked    = !!data.unlocks.storyDodgeUnlocked;
    if (typeof paradoxCompanionActive !== 'undefined') paradoxCompanionActive = !!data.unlocks.paradoxCompanion;
    // New v3 runtime globals
    if (typeof sovereignBeaten !== 'undefined') sovereignBeaten = !!data.unlocks.sovereignBeaten;
    if (typeof storyOnline     !== 'undefined') storyOnline     = !!data.unlocks.storyOnline;
    // God encounter flags
    if (typeof godEncountered  !== 'undefined') godEncountered  = !!data.unlocks.godEncountered;
    if (typeof godDefeated     !== 'undefined') godDefeated     = !!data.unlocks.godDefeated;
  }

  // Coins and cosmetics — new v3 fields
  if (typeof playerCoins !== 'undefined')       playerCoins       = (typeof data.coins === 'number') ? data.coins : 0;
  if (typeof unlockedCosmetics !== 'undefined' && Array.isArray(data.cosmetics)) {
    unlockedCosmetics.length = 0;
    data.cosmetics.forEach(function(id) { unlockedCosmetics.push(id); });
  }

  // Achievement Set — smb-achievements.js
  if (typeof earnedAchievements !== 'undefined' && data.unlocks && Array.isArray(data.unlocks.achievements)) {
    earnedAchievements.clear();
    data.unlocks.achievements.forEach(function(id) { earnedAchievements.add(id); });
  }

  // Settings — smb-globals.js (const object; properties must be mutated, not replaced)
  if (data.settings) {
    if (typeof data.settings.ragdoll !== 'undefined') settings.ragdollEnabled = !!data.settings.ragdoll;
  }

  // Progression globals — smb-progression.js (may not be loaded yet at parse time; guarded)
  if (data.progression) {
    try {
      if (typeof SHIP !== 'undefined' && data.progression.ship) {
        Object.assign(SHIP, data.progression.ship);
        if (data.progression.ship.parts) Object.assign(SHIP.parts, data.progression.ship.parts);
      }
    } catch(e) {}
    try {
      if (typeof FRACTURES !== 'undefined' && Array.isArray(data.progression.fractures)) {
        data.progression.fractures.forEach(function(saved) {
          var live = FRACTURES.find(function(f) { return f.id === saved.id; });
          if (live) {
            live.unlocked  = saved.unlocked  !== undefined ? saved.unlocked  : live.unlocked;
            live.previewed = saved.previewed !== undefined ? saved.previewed : live.previewed;
            live.completed = saved.completed !== undefined ? saved.completed : live.completed;
          }
        });
      }
    } catch(e) {}
    try {
      if (typeof motivationStage !== 'undefined' && typeof data.progression.motivationStage === 'number') {
        motivationStage = Math.min(3, data.progression.motivationStage);
      }
    } catch(e) {}
  }

  // Story progress — smb-globals.js (STORY_PROGRESS available at all times)
  if (data.storyProgress && typeof STORY_PROGRESS !== 'undefined') {
    if (typeof data.storyProgress.act     === 'number') STORY_PROGRESS.act     = data.storyProgress.act;
    if (typeof data.storyProgress.chapter === 'number') STORY_PROGRESS.chapter = data.storyProgress.chapter;
    if (data.storyProgress.flags && typeof data.storyProgress.flags === 'object') {
      STORY_PROGRESS.flags = Object.assign({}, data.storyProgress.flags);
    }
  }

  // Recalculate derived unlock level now that source booleans are final
  if (typeof playerProgressLevel !== 'undefined') {
    playerProgressLevel = unlockedTrueBoss ? 2 : bossBeaten ? 1 : 0;
  }

  // Sync secret-letter UI (no-op if still in loading phase)
  if (typeof syncCodeInput === 'function') syncCodeInput();

  // Mark this account as hydrated — guards against redundant re-runs this session
  if (_acctId) _hydratedAccountId = _acctId;
}

// ── Debounced save ────────────────────────────────────────────────────────────
let _saveQueued = false;
let _saveTimer  = null;
let _flushInProgress = false;

function queueGameStateSave() {
  if (_saveQueued) return;
  _saveQueued = true;
  _saveTimer = setTimeout(function() {
    if (window.GameState) GameState.save();
    _saveQueued = false;
    _saveTimer  = null;
  }, 50);
}

// ── Account flag setters ──────────────────────────────────────────────────────
function setAccountFlag(path, value, acctOverride) {
  const acct = acctOverride || (window.GameState ? GameState.getActiveAccount() : null);
  if (!acct) return;
  let ref = acct.data;
  if (!ref) return;
  for (let i = 0; i < path.length - 1; i++) {
    if (typeof ref[path[i]] !== 'object' || ref[path[i]] === null) {
      ref[path[i]] = {};
    }
    ref = ref[path[i]];
  }
  ref[path[path.length - 1]] = value;
  if (typeof saveGame === 'function') {
    saveGame();
  } else {
    queueGameStateSave();
  }
}

function setAccountFlagWithRuntime(path, value, runtimeSetter) {
  const acct = window.GameState ? GameState.getActiveAccount() : null;
  if (!acct) return;
  runtimeSetter(value);
  try {
    setAccountFlag(path, value, acct);
  } catch(e) {
    console.error('[save] Failed to persist flag:', path, e);
  }
}

// ── Coin update ───────────────────────────────────────────────────────────────
function updateCoins(fn, _retry) {
  const base = (typeof playerCoins !== 'undefined') ? playerCoins : 0;
  const next = fn(base);
  if (typeof next !== 'number' || !isFinite(next)) {
    console.warn('[coins] Invalid coin update result:', next);
    return;
  }
  const clamped = Math.max(0, Math.floor(next));
  if (!_retry && typeof playerCoins !== 'undefined' && base !== playerCoins) {
    return updateCoins(fn, true);
  }
  if (clamped !== base) console.info('[STATE MUTATION] coins', base, '->', clamped);
  setAccountFlagWithRuntime(['coins'], clamped, function(v) {
    if (typeof playerCoins !== 'undefined') playerCoins = v;
  });
}

// ── Collection wrappers ───────────────────────────────────────────────────────
function addCosmetic(id) {
  if (typeof unlockedCosmetics === 'undefined') return;
  if (unlockedCosmetics.indexOf(id) !== -1) return;
  unlockedCosmetics.push(id);
  console.info('[STATE MUTATION] cosmetics added', id);
  setAccountFlag(['cosmetics'], unlockedCosmetics.slice());
}

function addAchievement(id) {
  if (typeof earnedAchievements === 'undefined') return;
  if (earnedAchievements.has(id)) return;
  earnedAchievements.add(id);
  setAccountFlag(['unlocks', 'achievements'], Array.from(earnedAchievements));
}

function addLetter(id) {
  if (typeof collectedLetterIds === 'undefined') return;
  if (collectedLetterIds.has(id)) return;
  collectedLetterIds.add(id);
  setAccountFlag(['unlocks', 'letters'], Array.from(collectedLetterIds));
}

// ── Legacy key cleanup ────────────────────────────────────────────────────────
function _clearLegacyKeys() {
  return;
}

// ── Rehydration guard (keyed by account ID, not a boolean) ───────────────────
let _hydratedAccountId = null;

function forceRehydrateFromAccount(acct) {
  _hydratedAccountId = null;
  _refreshRuntimeFromSave(acct ? acct.data : null);
}

// ── Dev guard: warn on stale localStorage reads for account-scoped keys ───────
function _guardLocalStorageRead(key) {
  if (key && /^smc_|^smb_(bossBeaten|trueform|megaknight|sovereignBeaten|storyOnline|storyDodgeUnlocked|damnationScar|interTravel|patrolMode)$/.test(key)) {
    console.warn('[storage] Blocked localStorage read for account-scoped key:', key,
      '— use runtime globals instead.');
  }
}

// ── Flush hooks (beforeunload + visibilitychange) ─────────────────────────────
(function() {
  function _flushSave() {
    if (_flushInProgress) return;
    _flushInProgress = true;
    clearTimeout(_saveTimer);
    _saveTimer  = null;
    _saveQueued = false;
    if (window.GameState) {
      try { GameState.save(); } catch(e) {}
    }
    // Reset flag after a tick so the handler can fire again after navigation (e.g. spa reload)
    setTimeout(function() { _flushInProgress = false; }, 200);
  }
  window.addEventListener('beforeunload',    _flushSave);
  document.addEventListener('visibilitychange', function() {
    if (document.visibilityState === 'hidden') _flushSave();
  });
})();

// ── Save ──────────────────────────────────────────────────────────────────────
// _SAVE_BACKUP_KEY is now computed dynamically via _getBackupKey()

function saveGame() {
  try {
    if (!window.GameState) return;
    const acct = GameState.getActiveAccount();
    if (!acct) return;
    // account.data is the single source of truth.
    // Start from existing account.data (already contains all setAccountFlag mutations)
    // then flush volatile runtime state (story, storyProgress, settings, progression)
    // that does not go through setAccountFlag on every change.
    const base = (acct.data && typeof acct.data === 'object') ? acct.data : {};
    _flushRuntimeIntoBase(base);
    const normalized = _normalizeAccountSaveShape(base) || base;
    const summary = _saveSnapshotSummary(normalized);
    if (!_canonicalSaveMeaningful(normalized)) {
      console.info('[DEFAULT BLOCKED]', summary);
      return;
    }
    const preserveTs = (window.__SMB_PENDING_SAVE_TIMESTAMP !== undefined);
    normalized.meta = {
      updatedAt: preserveTs ? Number(window.__SMB_PENDING_SAVE_TIMESTAMP) || 0 : Date.now(),
      source: 'local',
    };
    normalized.updatedAt = normalized.meta.updatedAt;
    if (acct.data && acct.data._legacyCleared) normalized._legacyCleared = true;
    console.info('[SAVE SNAPSHOT]', { coins: summary.coins, chapter: summary.chapter, version: normalized.version });
    GameState.update(function(s) {
      const a = s.persistent.accounts[s.persistent.activeAccountId];
      if (a) a.data = normalized;
    });
    GameState.save();
    _writeCanonicalSave(normalized);
    _logSaveState('SAVE FINAL', normalized, 'written');
    console.info('[SAVE VERIFIED]', summary);
    if (!window.__SMB_SUPPRESS_CLOUD_SYNC && window.SupabaseBridge && typeof SupabaseBridge.queueSyncFromRuntime === 'function') {
      SupabaseBridge.queueSyncFromRuntime(normalized);
    }
  } catch(e) {
    console.warn('[SMC Save] Save failed:', e);
  }
}

// ── Load (called once on page start, and on every account switch) ─────────────
function loadGame() {
  try {
    const acct = window.GameState ? GameState.getActiveAccount() : null;
    const root = (window.GameState && typeof GameState.getPersistent === 'function')
      ? GameState.getPersistent()
      : _readCanonicalStateRoot();
    const activeId = root && root.activeAccountId ? root.activeAccountId : (acct ? acct.id : null);
    const activeBlob = root && root.accounts && activeId && root.accounts[activeId] ? root.accounts[activeId].data : null;
    const rawForNorm = activeBlob || (root && typeof root.version === 'number' ? root : null);

    console.info('[LOAD RAW]', {
      active: activeId || 'none',
      path: activeBlob ? `smb_state.accounts.${activeId}.data` : (root && typeof root.version === 'number' ? 'smb_state' : 'missing'),
      version: rawForNorm ? rawForNorm.version : null,
      raw: JSON.parse(JSON.stringify(rawForNorm || {})),
    });

    const canonical = _normalizeAccountSaveShape(rawForNorm);
    const normalizedSummary = canonical ? _saveSnapshotSummary(canonical) : null;
    console.info('[LOAD NORMALIZED]', normalizedSummary
      ? { coins: normalizedSummary.coins, chapter: normalizedSummary.chapter, version: canonical.version }
      : 'null');

    if (canonical && _canonicalSaveMeaningful(canonical)) {
      const wasLegacy = rawForNorm && typeof rawForNorm.version === 'number' && rawForNorm.version < SAVE_VERSION;
      if (wasLegacy) {
        console.info('[MIGRATED V2 TO V3]', {
          fromVersion: rawForNorm.version,
          toVersion: SAVE_VERSION,
          coins: normalizedSummary.coins,
          chapter: normalizedSummary.chapter,
        });
      }
      _logSaveState('LOAD FINAL', canonical, 'loaded');
      console.info('[LOAD VERIFIED]', normalizedSummary);
      _applySaveData(canonical);
      _refreshRuntimeFromSave(canonical);
      if (acct && (acct.data !== canonical || wasLegacy)) {
        console.info('[SAVE WRITING]', { reason: wasLegacy ? 'migration' : 'normalize', ...normalizedSummary });
        GameState.update(function(s) {
          const a = s.persistent.accounts[s.persistent.activeAccountId];
          if (a) a.data = canonical;
        });
        GameState.save();
        _writeCanonicalSave(canonical);
      }
      _queueCloudReconcile();
      return;
    }

    // ── Primary path: account.data in GameState (not caught by canonical path) ─
    if (acct && acct.data && typeof acct.data.version === 'number') {
      const wasLegacy = acct.data.version < SAVE_VERSION;
      const data = wasLegacy ? _migrateSave(acct.data) : acct.data;
      if (wasLegacy) {
        console.info('[MIGRATED V2 TO V3]', { fromVersion: acct.data.version, toVersion: SAVE_VERSION });
      }
      _applySaveData(data);
      _refreshRuntimeFromSave(data);
      console.info('[SAVE WRITING]', { reason: 'primary-path', ..._saveSnapshotSummary(data) });
      _writeCanonicalSave(data);
      _logSaveState('LOAD FINAL', data, 'loaded');
      console.info('[LOAD VERIFIED]', _saveSnapshotSummary(data));
      _queueCloudReconcile();
      return;
    }

    // ── First run: no save data exists at all ─────────────────────────────────
    if (typeof resetProgressionGlobals   === 'function') resetProgressionGlobals();
    if (typeof resetAccountScopedGlobals === 'function') resetAccountScopedGlobals();
    console.info('[DEFAULT BLOCKED]', { coins: 0, chapter: 0 });
    _logSaveState('LOAD FINAL', { coins: 0, chapter: 0, storyProgress: { chapter: 0 } }, 'defaults used');
    if (typeof restoreStoryDataFromSave === 'function' &&
        typeof _defaultStory2Progress === 'function') {
      restoreStoryDataFromSave(_defaultStory2Progress());
    }
    window.__SMB_SAVE_READY = true;
  } catch(e) {
    console.warn('[SMC Save] Load failed:', e);
  }
}

// ── Export ────────────────────────────────────────────────────────────────────
function exportSave() {
  try {
    const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(_gatherSaveData()))));
    // populate the textbox so user can copy manually even if clipboard API fails
    const box = document.getElementById('importSaveText');
    if (box) box.value = encoded;

    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(encoded)
        .then(() => _showSaveToast('✓ Save copied to clipboard!'))
        .catch(() => _showSaveToast('Paste the text from the box below.'));
    } else {
      _showSaveToast('Copy the text from the box below.');
    }
    return encoded;
  } catch(e) {
    console.warn('[SMC Save] Export failed:', e);
    _showSaveToast('Export failed — check console.', true);
    return '';
  }
}

function downloadSave() {
  try {
    const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(_gatherSaveData()))));
    const blob = new Blob([encoded], { type: 'text/plain' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = 'stickman-clash-save.json';
    a.click();
    URL.revokeObjectURL(url);
    _showSaveToast('✓ Save downloaded!');
  } catch(e) {
    console.warn('[SMC Save] Download failed:', e);
    _showSaveToast('Download failed — check console.', true);
  }
}

function importSaveFromFile(input) {
  const file = input && input.files && input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const text = (e.target.result || '').trim();
    const box  = document.getElementById('importSaveText');
    if (box) box.value = text;
    // auto-import immediately
    if (importSave(text)) closeImportSaveModal();
  };
  reader.readAsText(file);
}

// ── Import ────────────────────────────────────────────────────────────────────
function importSave(saveString) {
  try {
    const str = (saveString || '').trim();
    if (!str) { _showSaveToast('Paste a save string first.', true); return false; }

    let data;
    try {
      data = JSON.parse(decodeURIComponent(escape(atob(str))));
    } catch(_) {
      throw new Error('Could not decode — not a valid save string.');
    }

    if (!data || typeof data.version !== 'number' || !data.unlocks) {
      throw new Error('Save data structure invalid.');
    }

    _applySaveData(data);
    _refreshRuntimeFromSave(data);
    saveGame();
    _showSaveToast('✓ Save imported!');
    return true;
  } catch(e) {
    console.warn('[SMC Save] Import error:', e.message);
    _showSaveToast('Invalid save: ' + e.message, true);
    return false;
  }
}

// ── Import modal helpers (called from HTML) ───────────────────────────────────
function openImportSaveModal() {
  const m = document.getElementById('importSaveModal');
  if (m) { m.style.display = 'flex'; document.getElementById('importSaveText').value = ''; }
}

function closeImportSaveModal() {
  const m = document.getElementById('importSaveModal');
  if (m) m.style.display = 'none';
}

function confirmImportSave() {
  const box = document.getElementById('importSaveText');
  if (!box) return;
  if (importSave(box.value)) {
    closeImportSaveModal();
  }
}

// ── Toast notification ────────────────────────────────────────────────────────
function _showSaveToast(msg, isError) {
  let t = document.getElementById('smcSaveToast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'smcSaveToast';
    t.style.cssText = [
      'position:fixed','bottom:32px','left:50%','transform:translateX(-50%)',
      'background:rgba(5,5,20,0.92)','color:#dde4ff',
      'padding:9px 24px','border-radius:8px','font-size:0.85rem',
      'z-index:99999','pointer-events:none','transition:opacity 0.3s',
      'border:1px solid rgba(100,180,255,0.45)',
      'font-family:\'Segoe UI\',Arial,sans-serif',
    ].join(';');
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.style.borderColor = isError ? 'rgba(255,80,80,0.55)' : 'rgba(100,180,255,0.45)';
  t.style.opacity = '1';
  clearTimeout(t._hideTimer);
  t._hideTimer = setTimeout(() => { t.style.opacity = '0'; }, 2800);
}

// ── Auto-save every 15 s ──────────────────────────────────────────────────────
setInterval(saveGame, 15000);

// ── Load on startup ───────────────────────────────────────────────────────────
loadGame();
window.__SMB_SAVE_READY = true;

function _queueCloudReconcile() {
  if (window.__SMB_SUPPRESS_CLOUD_SYNC) return;
  if (!window.SupabaseBridge || typeof SupabaseBridge.reconcileActiveSave !== 'function') return;
  if (typeof SupabaseBridge.isSignedIn === 'function' && !SupabaseBridge.isSignedIn()) return;
  if (typeof SupabaseBridge.isRuntimeReady === 'function' && !SupabaseBridge.isRuntimeReady()) return;
  setTimeout(function() {
    SupabaseBridge.reconcileActiveSave().catch(function(e) {
      console.warn('[SMC Save] Cloud reconcile failed:', e);
    });
  }, 0);
}
