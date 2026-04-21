// smc-save.js — Persistent save system: auto-save, export, import
'use strict';

const SAVE_VERSION = 2;
const SAVE_KEY     = 'smc_save_v1'; // legacy fallback key (used when AccountManager is absent)

// Dynamic key helpers — route through AccountManager when available so each
// account gets its own isolated save slot.
function _getSaveKey()   { return (window.AccountManager) ? window.AccountManager.getActiveSaveKey() : SAVE_KEY; }
function _getBackupKey() { return _getSaveKey() + '_backup'; }

// ── Default save structure (used for deep-merge / version migrations) ─────────
const _SAVE_DEFAULTS = {
  version: SAVE_VERSION,
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
  },
  settings: {
    sfxVol:    0.35,
    sfxMute:   false,
    musicMute: false,
    ragdoll:   false,
  },
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
  if (typeof d.unlocks.megaknight === 'undefined') d.unlocks.megaknight = false;
  if (!Array.isArray(d.unlocks.achievements)) d.unlocks.achievements = [];
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

// ── Gather current state from individual localStorage keys ────────────────────
function _gatherSaveData() {
  return {
    version: SAVE_VERSION,
    story: (typeof getStoryDataForSave === 'function') ? getStoryDataForSave() : null,
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
      // Extended unlocks — no runtime global; localStorage is the only source until they get one
      sovereignBeaten: !!localStorage.getItem('smc_sovereignBeaten'),
      storyOnline:     !!localStorage.getItem('smc_storyOnline'),
      tfEndingSeen:    (localStorage.getItem('smc_tfEndingSeen') === '1'),
      damnationScar:   !!localStorage.getItem('smb_damnationScar'),
    },
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

  if (d.unlocks.bossBeaten)    localStorage.setItem('smc_bossBeaten',  '1');
  else                          localStorage.removeItem('smc_bossBeaten');
  if (d.unlocks.trueform)      localStorage.setItem('smc_trueform',    '1');
  else                          localStorage.removeItem('smc_trueform');
  if (d.unlocks.megaknight)    localStorage.setItem('smc_megaknight',  '1');
  else                          localStorage.removeItem('smc_megaknight');
  localStorage.setItem('smc_letters',      JSON.stringify(d.unlocks.letters));
  localStorage.setItem('smc_achievements', JSON.stringify(d.unlocks.achievements));
  localStorage.setItem('smc_sfxVol',       String(d.settings.sfxVol));
  localStorage.setItem('smc_sfxMute',      d.settings.sfxMute    ? '1' : '0');
  localStorage.setItem('smc_musicMute',    d.settings.musicMute  ? '1' : '0');
  localStorage.setItem('smc_ragdoll',      d.settings.ragdoll    ? '1' : '0');
  // Extended account-scoped flags
  if (d.unlocks.sovereignBeaten)    localStorage.setItem('smc_sovereignBeaten',    '1');
  else                               localStorage.removeItem('smc_sovereignBeaten');
  if (d.unlocks.storyOnline)        localStorage.setItem('smc_storyOnline',        '1');
  else                               localStorage.removeItem('smc_storyOnline');
  if (d.unlocks.tfEndingSeen)       localStorage.setItem('smc_tfEndingSeen',       '1');
  else                               localStorage.removeItem('smc_tfEndingSeen');
  if (d.unlocks.damnationScar)      localStorage.setItem('smb_damnationScar',      '1');
  else                               localStorage.removeItem('smb_damnationScar');
  if (d.unlocks.storyDodgeUnlocked) localStorage.setItem('smc_storyDodgeUnlocked', '1');
  else                               localStorage.removeItem('smc_storyDodgeUnlocked');
  if (d.unlocks.paradoxCompanion)   localStorage.setItem('smc_paradox_companion',  '1');
  else                               localStorage.removeItem('smc_paradox_companion');
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

  // ── Reset phase: bring all account-specific globals to their initial defaults
  // before applying save data. This ensures no previous account's state bleeds
  // through when the incoming data is sparse or omits a field entirely.
  if (typeof resetProgressionGlobals   === 'function') resetProgressionGlobals();
  if (typeof resetAccountScopedGlobals === 'function') resetAccountScopedGlobals();

  // Unlock globals — smb-globals.js
  if (data.unlocks) {
    if (typeof bossBeaten        !== 'undefined') bossBeaten        = !!data.unlocks.bossBeaten;
    if (typeof unlockedTrueBoss  !== 'undefined') unlockedTrueBoss  = !!data.unlocks.trueform;
    if (typeof unlockedMegaknight !== 'undefined') unlockedMegaknight = !!data.unlocks.megaknight;
    if (typeof collectedLetterIds !== 'undefined' && Array.isArray(data.unlocks.letters)) {
      collectedLetterIds.clear();
      data.unlocks.letters.forEach(function(id) { collectedLetterIds.add(id); });
    }
    // Extended runtime globals reset by resetAccountScopedGlobals() above; restore here
    if (typeof storyDodgeUnlocked    !== 'undefined') storyDodgeUnlocked    = !!data.unlocks.storyDodgeUnlocked;
    if (typeof paradoxCompanionActive !== 'undefined') paradoxCompanionActive = !!data.unlocks.paradoxCompanion;
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
}

// ── Save ──────────────────────────────────────────────────────────────────────
// _SAVE_BACKUP_KEY is now computed dynamically via _getBackupKey()

function saveGame() {
  try {
    if (!window.GameState) return;
    const acct = GameState.getActiveAccount();
    if (!acct) return;
    const data = _gatherSaveData();
    GameState.update(function(s) {
      const a = s.persistent.accounts[s.persistent.activeAccountId];
      if (a) a.data = data;
    });
    GameState.save();
  } catch(e) {
    console.warn('[SMC Save] Save failed:', e);
  }
}

// ── Load (called once on page start, and on every account switch) ─────────────
function loadGame() {
  try {
    const acct = window.GameState ? GameState.getActiveAccount() : null;

    // ── Primary path: account.data in GameState ───────────────────────────────
    if (acct && acct.data && typeof acct.data.version === 'number') {
      const data = acct.data.version < SAVE_VERSION ? _migrateSave(acct.data) : acct.data;
      _applySaveData(data);
      _refreshRuntimeFromSave(data);
      return;
    }

    // ── Migration path: legacy per-account localStorage blob ─────────────────
    const legacyKey = acct ? (acct.saveKey || SAVE_KEY) : SAVE_KEY;
    const raw = localStorage.getItem(legacyKey);
    if (raw) {
      try {
        let data = JSON.parse(decodeURIComponent(escape(atob(raw))));
        if (data && typeof data.version === 'number') {
          if (data.version < SAVE_VERSION) data = _migrateSave(data);
          _applySaveData(data);
          _refreshRuntimeFromSave(data);
          // One-time migration: write into GameState so future loads use the new path
          saveGame();
          return;
        }
      } catch(e) {
        console.warn('[SMC Save] Legacy key decode failed:', e);
      }
    }

    // ── First run: no save data yet ───────────────────────────────────────────
    // On initial page load globals are already at defaults, but on an account
    // switch to a brand-new account we must still reset so the previous account's
    // globals don't bleed through.
    if (typeof resetProgressionGlobals   === 'function') resetProgressionGlobals();
    if (typeof resetAccountScopedGlobals === 'function') resetAccountScopedGlobals();
    // Clear all account-scoped localStorage caches so the new account starts clean.
    // No-ops on initial page load; only meaningful during in-session account switches.
    try {
      ['smc_story2','smc_sovereignBeaten','smc_storyOnline','smc_tfEndingSeen',
       'smb_damnationScar','smc_storyDodgeUnlocked','smc_paradox_companion']
        .forEach(function(k) { localStorage.removeItem(k); });
    } catch(e) {}
    if (typeof restoreStoryDataFromSave === 'function' &&
        typeof _defaultStory2Progress === 'function') {
      restoreStoryDataFromSave(_defaultStory2Progress());
    }
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
