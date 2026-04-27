// smb-accounts.js — Local multi-account system
// Must be loaded BEFORE smb-save.js so _getSaveKey() works on first loadGame() call.
// Requires smb-state.js (loaded earlier) — reads/writes via GameState instead of
// maintaining its own _state and localStorage key.
'use strict';

// Immutable top-tier accounts for the local build.
// These accounts should always outrank role changes so console/admin access
// cannot be accidentally revoked by in-game tools.
const SUPERUSER_ACCOUNT_IDS = ['acct_mo3runjg_h23f4', 'acct_mo5st5fh_96ehz'];

const AccountManager = (() => {

  // GameState is already populated (smb-state.js called load() at parse time).
  // No local _state needed — all account data lives in GameState.

  // ── Persistence ──────────────────────────────────────────────────────────────
  function _persist() {
    GameState.save();
  }

  function _genId() {
    return 'acct_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
  }

  // ── loadAccounts ─────────────────────────────────────────────────────────────
  // Validates the state already loaded by GameState, seeds defaults on first run,
  // and flushes to 'smb_state' so future loads hit the canonical key.
  function loadAccounts() {
    const p = GameState.getPersistent();

    // Guard: activeAccountId points to a deleted account
    if (p.activeAccountId && p.accounts && !p.accounts[p.activeAccountId]) {
      const keys = Object.keys(p.accounts);
      GameState.update(s => { s.persistent.activeAccountId = keys.length > 0 ? keys[0] : null; });
    }

    // Migration: ensure every account has a role field (accounts created before roles were added)
    if (p.accounts && Object.values(p.accounts).some(function(a) { return !a.role; })) {
      GameState.update(function(s) {
        Object.values(s.persistent.accounts || {}).forEach(function(a) { if (!a.role) a.role = 'player'; });
      });
    }

    // Keep immutable superuser accounts pinned to the top role.
    if (p.accounts && Object.values(p.accounts).some(function(a) { return a && isSuperuserAccountId(a.id) && a.role !== 'dev'; })) {
      GameState.update(function(s) {
        Object.values(s.persistent.accounts || {}).forEach(function(a) {
          if (a && isSuperuserAccountId(a.id)) a.role = 'dev';
        });
      });
    }

    // Migration: ensure every account has a data field (for per-account game progress)
    if (p.accounts && Object.values(p.accounts).some(function(a) { return !a.data; })) {
      GameState.update(function(s) {
        Object.values(s.persistent.accounts || {}).forEach(function(a) {
          if (!a.data) a.data = { version: 2, progression: {}, achievements: {}, stats: {}, unlocks: {} };
        });
      });
    }

    // Migration: ensure every account.data has a version field so loadGame() primary
    // path fires and _refreshRuntimeFromSave() (with its reset phase) always runs.
    if (p.accounts && Object.values(p.accounts).some(function(a) { return a.data && typeof a.data.version !== 'number'; })) {
      GameState.update(function(s) {
        Object.values(s.persistent.accounts || {}).forEach(function(a) {
          if (a.data && typeof a.data.version !== 'number') a.data.version = 2;
        });
      });
    }

    // Migration: ensure every account.data has v3 fields (coins, cosmetics, extended unlocks)
    if (p.accounts && Object.values(p.accounts).some(function(a) {
      return a.data && (typeof a.data.coins !== 'number' || !Array.isArray(a.data.cosmetics) ||
        (a.data.unlocks && typeof a.data.unlocks.sovereignBeaten === 'undefined'));
    })) {
      GameState.update(function(s) {
        Object.values(s.persistent.accounts || {}).forEach(function(a) {
          if (!a.data) return;
          if (typeof a.data.coins !== 'number') a.data.coins = 0;
          if (!Array.isArray(a.data.cosmetics)) a.data.cosmetics = [];
          if (typeof a.data._legacyCleared !== 'boolean') a.data._legacyCleared = false;
          if (!a.data.unlocks) a.data.unlocks = {};
          var u = a.data.unlocks;
          if (typeof u.sovereignBeaten    === 'undefined') u.sovereignBeaten    = false;
          if (typeof u.storyOnline        === 'undefined') u.storyOnline        = false;
          if (typeof u.tfEndingSeen       === 'undefined') u.tfEndingSeen       = false;
          if (typeof u.damnationScar      === 'undefined') u.damnationScar      = false;
          if (typeof u.storyDodgeUnlocked === 'undefined') u.storyDodgeUnlocked = false;
          if (typeof u.paradoxCompanion   === 'undefined') u.paradoxCompanion   = false;
          if (typeof u.interTravel        === 'undefined') u.interTravel        = false;
          if (typeof u.patrolMode         === 'undefined') u.patrolMode         = false;
        });
      });
    }

    // Migration: ensure every account has an auth field (passwords + lock state)
    if (p.accounts && Object.values(p.accounts).some(function(a) { return !a.auth; })) {
      GameState.update(function(s) {
        Object.values(s.persistent.accounts || {}).forEach(function(a) {
          if (!a.auth) a.auth = { passwordHash: null, recoveryCodeHash: null, locked: false };
        });
      });
    }

    // Already have a valid active account — flush and return
    if (p.accounts && Object.keys(p.accounts).length > 0 && GameState.getPersistent().activeAccountId) {
      _persist();
      return;
    }

    // First run or fully corrupted — seed a default "Player 1" account.
    // Include data + auth fields immediately so migrations never see a missing-data
    // account and overwrite progress with empty defaults.
    const defaultId = 'acct_default';
    const _sv = (typeof SAVE_VERSION !== 'undefined') ? SAVE_VERSION : 3;
    GameState.update(s => {
      s.persistent.activeAccountId = defaultId;
      s.persistent.accounts = {
        [defaultId]: {
          id:        defaultId,
          username:  'Player 1',
          createdAt: Date.now(),
          saveKey:   'smb_state',
          role:      'player',
          data: {
            version: _sv,
            coins: 0,
            cosmetics: [],
            achievements: [],
            _legacyCleared: false,
            unlocks: {
              bossBeaten: false, trueform: false, megaknight: false,
              letters: [], achievements: [],
              sovereignBeaten: false, storyOnline: false, tfEndingSeen: false,
              damnationScar: false, storyDodgeUnlocked: false, paradoxCompanion: false,
              interTravel: false, patrolMode: false, godEncountered: false, godDefeated: false,
            },
            settings: { sfxVol: 0.35, sfxMute: false, musicMute: false, ragdoll: false },
          },
          auth: { passwordHash: null, recoveryCodeHash: null, locked: false },
        },
      };
    });
    _persist();
  }

  // ── Getters ──────────────────────────────────────────────────────────────────
  function getActiveAccount() {
    const p = GameState.getPersistent();
    return (p.accounts && p.activeAccountId) ? (p.accounts[p.activeAccountId] || null) : null;
  }

  function getActiveSaveKey() {
    return 'smb_state';
  }

  function getAllAccounts() {
    return Object.values(GameState.getPersistent().accounts || {}).sort((a, b) => a.createdAt - b.createdAt);
  }

  // ── findAccountByName ────────────────────────────────────────────────────────
  // Returns ALL accounts whose username matches (case-insensitive).
  // Always returns an array — callers must not assume uniqueness.
  // Authority actions (bans, kicks) MUST use the returned account.id, never the name.
  function findAccountByName(name) {
    const needle = String(name || '').trim().toLowerCase();
    if (!needle) return [];
    return getAllAccounts().filter(a => String(a.username || '').toLowerCase() === needle);
  }

  // ── createAccount ────────────────────────────────────────────────────────────
  function createAccount(username) {
    const name = (String(username || '').trim().slice(0, 20)) || 'Player';
    const id = _genId();
    GameState.update(s => {
      s.persistent.accounts[id] = {
        id,
        username:  name,
        createdAt: Date.now(),
        saveKey:   'smb_acct_' + id,
        role:      'player',
        data:      { version: (typeof SAVE_VERSION !== 'undefined' ? SAVE_VERSION : 3), progression: {}, stats: {}, coins: 0, cosmetics: [], _legacyCleared: false, unlocks: { bossBeaten: false, trueform: false, megaknight: false, letters: [], achievements: [], sovereignBeaten: false, storyOnline: false, tfEndingSeen: false, damnationScar: false, storyDodgeUnlocked: false, paradoxCompanion: false, interTravel: false, patrolMode: false }, settings: { sfxVol: 0.35, sfxMute: false, musicMute: false, ragdoll: false } },
      };
    });
    _persist();
    return id;
  }

  // ── switchAccount ────────────────────────────────────────────────────────────
  function switchAccount(id) {
    const p = GameState.getPersistent();
    if (!p.accounts[id]) return false;
    if (p.activeAccountId === id) return true;
    // Flush current account's state before switching
    if (typeof saveGame === 'function') saveGame();
    GameState.update(s => { s.persistent.activeAccountId = id; });
    _persist();
    // Restore the newly active account's saved state
    if (typeof loadGame === 'function') loadGame();
    if (typeof refreshMenuFromAccount === 'function') refreshMenuFromAccount();
    return true;
  }

  // ── deleteAccount ────────────────────────────────────────────────────────────
  function deleteAccount(id) {
    const p = GameState.getPersistent();
    if (!p.accounts || !p.accounts[id]) return false;
    const acct = p.accounts[id];
    // Remove save data for this account
    try {
      if (acct.saveKey && acct.saveKey !== 'smb_state') {
        localStorage.removeItem(acct.saveKey);
        localStorage.removeItem(acct.saveKey + '_backup');
      }
    } catch(e) {}
    const wasActive = (p.activeAccountId === id);
    GameState.update(s => { delete s.persistent.accounts[id]; });
    // If the active account was deleted, pick or create a replacement
    if (wasActive) {
      const remaining = Object.keys(GameState.getPersistent().accounts);
      if (remaining.length === 0) {
        const newId = createAccount('Player 1');
        GameState.update(s => { s.persistent.activeAccountId = newId; });
      } else {
        GameState.update(s => { s.persistent.activeAccountId = remaining[0]; });
      }
      if (typeof loadGame === 'function') loadGame();
      if (typeof refreshMenuFromAccount === 'function') refreshMenuFromAccount();
    }
    _persist();
    return true;
  }

  // ── renameAccount ────────────────────────────────────────────────────────────
  function renameAccount(id, newName) {
    const name = (String(newName || '').trim().slice(0, 20)) || 'Player';
    const p = GameState.getPersistent();
    if (!p.accounts || !p.accounts[id]) return false;
    GameState.update(s => { s.persistent.accounts[id].username = name; });
    _persist();
    return true;
  }

  // ── saveAccountData ──────────────────────────────────────────────────────────
  function saveAccountData() {
    if (typeof saveGame === 'function') saveGame();
  }

  // ── Auth helpers ─────────────────────────────────────────────────────────────
  function _hashStr(s) {
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = Math.imul(h, 33) ^ s.charCodeAt(i);
    return (h >>> 0).toString(16).padStart(8, '0');
  }

  function _hashPassword(plaintext, salt) {
    const a = _hashStr(salt + ':' + plaintext);
    const b = _hashStr(plaintext + ':' + a);
    return a + b;
  }

  function _genRecoveryCode() {
    const ch = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let c = '';
    for (let i = 0; i < 12; i++) {
      if (i > 0 && i % 4 === 0) c += '-';
      c += ch[Math.floor(Math.random() * ch.length)];
    }
    return c;
  }

  function hasPassword(id) {
    const p = GameState.getPersistent();
    const acct = p.accounts && p.accounts[id];
    return !!(acct && acct.auth && acct.auth.passwordHash);
  }

  function verifyPassword(id, plaintext) {
    const p = GameState.getPersistent();
    const acct = p.accounts && p.accounts[id];
    if (!acct || !acct.auth || !acct.auth.passwordHash) return true;
    return _hashPassword(String(plaintext), id) === acct.auth.passwordHash;
  }

  // Returns the plaintext recovery code on success, null on failure.
  function setPassword(id, plaintext) {
    const p = GameState.getPersistent();
    if (!p.accounts || !p.accounts[id]) return null;
    const code = _genRecoveryCode();
    const passwordHash    = _hashPassword(String(plaintext), id);
    const recoveryCodeHash = _hashPassword(code, id + '_rc');
    GameState.update(function(s) {
      if (!s.persistent.accounts[id].auth) s.persistent.accounts[id].auth = {};
      s.persistent.accounts[id].auth.passwordHash    = passwordHash;
      s.persistent.accounts[id].auth.recoveryCodeHash = recoveryCodeHash;
      s.persistent.accounts[id].auth.locked           = false;
    });
    _persist();
    return code;
  }

  function changePassword(id, oldPlaintext, newPlaintext) {
    if (!verifyPassword(id, oldPlaintext)) return false;
    const p = GameState.getPersistent();
    if (!p.accounts || !p.accounts[id]) return false;
    GameState.update(function(s) {
      if (!s.persistent.accounts[id].auth) s.persistent.accounts[id].auth = {};
      s.persistent.accounts[id].auth.passwordHash = _hashPassword(String(newPlaintext), id);
    });
    _persist();
    return true;
  }

  function removePassword(id, plaintext) {
    if (!verifyPassword(id, plaintext)) return false;
    const p = GameState.getPersistent();
    if (!p.accounts || !p.accounts[id]) return false;
    GameState.update(function(s) {
      if (s.persistent.accounts[id].auth) {
        s.persistent.accounts[id].auth.passwordHash    = null;
        s.persistent.accounts[id].auth.recoveryCodeHash = null;
        s.persistent.accounts[id].auth.locked           = false;
      }
    });
    _persist();
    return true;
  }

  // Returns new plaintext recovery code on success, false on bad code.
  function resetPasswordWithCode(id, code, newPlaintext) {
    const p    = GameState.getPersistent();
    const acct = p.accounts && p.accounts[id];
    if (!acct || !acct.auth || !acct.auth.recoveryCodeHash) return false;
    const codeHash = _hashPassword(String(code).trim().toUpperCase(), id + '_rc');
    if (codeHash !== acct.auth.recoveryCodeHash) return false;
    const newCode    = _genRecoveryCode();
    const newRCHash  = _hashPassword(newCode, id + '_rc');
    const newPwHash  = _hashPassword(String(newPlaintext), id);
    GameState.update(function(s) {
      s.persistent.accounts[id].auth.passwordHash    = newPwHash;
      s.persistent.accounts[id].auth.recoveryCodeHash = newRCHash;
      s.persistent.accounts[id].auth.locked           = false;
    });
    _persist();
    return newCode;
  }

  function isLocked(id) {
    const p    = GameState.getPersistent();
    const acct = p.accounts && p.accounts[id];
    return !!(acct && acct.auth && acct.auth.locked && acct.auth.passwordHash);
  }

  function lockAccount(id) {
    const p = GameState.getPersistent();
    if (!p.accounts || !p.accounts[id]) return false;
    if (!hasPassword(id)) return false;
    GameState.update(function(s) {
      if (!s.persistent.accounts[id].auth) s.persistent.accounts[id].auth = {};
      s.persistent.accounts[id].auth.locked = true;
    });
    _persist();
    return true;
  }

  function logoutCurrentAccount() {
    const active = getActiveAccount();
    if (!active || !hasPassword(active.id)) return false;
    if (typeof saveGame === 'function') saveGame();
    return lockAccount(active.id);
  }

  // Initialize on script parse (before smb-save.js runs)
  loadAccounts();

  return {
    loadAccounts,
    getActiveAccount,
    getActiveSaveKey,
    getAllAccounts,
    findAccountByName,
    createAccount,
    renameAccount,
    switchAccount,
    deleteAccount,
    saveAccountData,
    // Auth
    hasPassword,
    verifyPassword,
    setPassword,
    changePassword,
    removePassword,
    resetPasswordWithCode,
    isLocked,
    lockAccount,
    logoutCurrentAccount,
  };
})();

function isSuperuserAccountId(accountId) {
  return SUPERUSER_ACCOUNT_IDS.indexOf(String(accountId)) !== -1;
}

// ── UI ────────────────────────────────────────────────────────────────────────
// Multi-view modal: 'list' | 'login' | 'setpw' | 'recovery' | 'showcode'

let _acctModalData = { view: 'list', targetId: null, recoveryCode: null };

function openAccountsModal() {
  _acctModalData = { view: 'list', targetId: null, recoveryCode: null };
  _acctEnsureModal();
  if (window.SupabaseBridge && typeof SupabaseBridge.bootstrap === 'function') {
    SupabaseBridge.bootstrap().catch(function(e) { console.warn('[accounts] cloud bootstrap failed:', e); });
  }
  if (window.SupabaseBridge && !window.__acctCloudListenerInstalled && typeof SupabaseBridge.onChange === 'function') {
    window.__acctCloudListenerInstalled = true;
    SupabaseBridge.onChange(function() {
      const modal = document.getElementById('accountsModal');
      if (modal && modal.style.display === 'flex') _acctRender();
    });
  }
  _acctRender();
  document.getElementById('accountsModal').style.display = 'flex';
}

function closeAccountsModal() {
  const m = document.getElementById('accountsModal');
  if (m) m.style.display = 'none';
}

function _acctEnsureModal() {
  if (document.getElementById('accountsModal')) return;
  const m = document.createElement('div');
  m.id = 'accountsModal';
  m.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,0.88);z-index:10000;align-items:center;justify-content:center;';
  m.addEventListener('click', function(e) { if (e.target === m) closeAccountsModal(); });
  const inner = document.createElement('div');
  inner.id = 'accountsModalInner';
  inner.style.cssText = [
    'background:#0b0b1e',
    'border:1px solid rgba(100,180,255,0.3)',
    'border-radius:12px',
    'padding:28px',
    'width:min(480px,92vw)',
    'max-height:88vh',
    'overflow-y:auto',
    'color:#dde4ff',
    "font-family:'Segoe UI',Arial,sans-serif",
    'box-shadow:0 0 40px rgba(0,100,255,0.18)',
  ].join(';');
  m.appendChild(inner);
  document.body.appendChild(m);
}

function _acctRender() {
  const inner = document.getElementById('accountsModalInner');
  if (!inner) return;
  const v = _acctModalData.view;
  if      (v === 'list')     _acctRenderList(inner);
  else if (v === 'login')    _acctRenderLogin(inner);
  else if (v === 'setpw')    _acctRenderSetPw(inner);
  else if (v === 'recovery') _acctRenderRecovery(inner);
  else if (v === 'showcode') _acctRenderShowCode(inner);
}

// ── View: Account List ────────────────────────────────────────────────────────
function _acctRenderList(inner) {
  const accounts          = AccountManager.getAllAccounts();
  const active            = AccountManager.getActiveAccount();
  const activeHasPassword = active && AccountManager.hasPassword(active.id);
  const activeIsLocked    = active && AccountManager.isLocked(active.id);
  const cloudSection      = _acctRenderCloudSection();

  let rows = '';
  accounts.forEach(function(acct) {
    const isActive  = active && acct.id === active.id;
    const locked    = AccountManager.isLocked(acct.id);
    const hasPw     = AccountManager.hasPassword(acct.id);
    const date      = new Date(acct.createdAt).toLocaleDateString();
    const lockIcon  = locked ? '🔒 ' : (hasPw ? '🔓 ' : '');
    const borderCol = isActive ? 'rgba(80,200,120,0.5)' : 'rgba(100,150,255,0.2)';
    const bgCol     = isActive ? 'rgba(40,120,80,0.18)' : 'rgba(255,255,255,0.04)';
    const nameCol   = isActive ? '#88ffaa' : '#dde4ff';

    let actionBtn = '';
    if (isActive && locked) {
      actionBtn = '<button onclick="_acctNav(\'login\',\'' + _acctEscId(acct.id) + '\')" style="' + _acctBtnStyle('blue') + '">Login</button>';
    } else if (!isActive) {
      actionBtn = '<button onclick="_acctClickSwitch(\'' + _acctEscId(acct.id) + '\')" style="' + _acctBtnStyle('blue') + '">' + (locked ? 'Login' : 'Switch') + '</button>';
    }

    const renameBtn = '<button onclick="_acctRenamePrompt(\'' + _acctEscId(acct.id) + '\',\'' + _acctEscStr(acct.username) + '\')" style="' + _acctBtnStyle('green') + '">Rename</button>';
    const pwBtn     = '<button onclick="_acctGoSetPw(\'' + _acctEscId(acct.id) + '\')" style="' + _acctBtnStyle('purple') + '">' + (hasPw ? 'Password' : 'Set PW') + '</button>';
    const delBtn    = '<button onclick="_acctConfirmDelete(\'' + _acctEscId(acct.id) + '\',\'' + _acctEscStr(acct.username) + '\')" style="' + _acctBtnStyle('red') + '">Delete</button>';

    rows += '<div style="display:flex;align-items:center;gap:6px;padding:8px 12px;border-radius:8px;border:1px solid ' + borderCol + ';background:' + bgCol + ';margin-bottom:6px;">'
          + '<div style="flex:1;min-width:0;">'
          + '<div style="font-size:0.88rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:' + nameCol + ';">'
          + lockIcon + _acctEscHtml(acct.username) + (isActive ? ' <span style="font-size:0.7rem;color:#88ffaa;">(active)</span>' : '')
          + '</div>'
          + '<div style="font-size:0.7rem;opacity:0.45;">Created ' + date + '</div>'
          + '</div>'
          + '<div style="display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end;">'
          + actionBtn + renameBtn + pwBtn + delBtn
          + '</div></div>';
  });

  if (!rows) rows = '<div style="font-size:0.8rem;opacity:0.5;text-align:center;padding:12px;">No accounts found.</div>';

  const logoutBtn = (activeHasPassword && !activeIsLocked)
    ? '<button onclick="_acctLogout()" style="' + _acctBtnStyle('orange') + ';flex:1;">🔒 Log Out</button>'
    : '';

  inner.innerHTML = '<h3 style="margin:0 0 16px;font-size:1.1rem;color:#88ccff;">👤 Account &amp; Saves</h3>'
    + cloudSection
    + '<div style="max-height:300px;overflow-y:auto;margin-bottom:14px;">' + rows + '</div>'
    + '<div style="display:flex;gap:8px;flex-wrap:wrap;">'
    + '<button onclick="_acctCreatePrompt()" style="' + _acctBtnStyle('blue') + ';flex:1;">+ New Account</button>'
    + logoutBtn
    + '<button onclick="closeAccountsModal()" style="' + _acctBtnStyle('dim') + '">Close</button>'
    + '</div>';
}

function _acctRenderCloudSection() {
  if (!window.SupabaseBridge) {
    return '<div style="margin:0 0 14px;padding:12px;border:1px solid rgba(100,180,255,0.18);border-radius:8px;background:rgba(255,255,255,0.03);font-size:0.78rem;opacity:0.65;">Cloud saves are not loaded.</div>';
  }
  const st = typeof SupabaseBridge.getState === 'function' ? SupabaseBridge.getState() : { ready: false, available: false };
  const session = st.session;
  const user = st.user;
  const signedIn = !!(session && user);
  const title = signedIn ? '☁️ Cloud Save Connected' : (st.available ? '☁️ Connect Cloud Save' : '☁️ Cloud Save Unavailable');
  const status = signedIn
    ? ('Signed in as <strong style="color:#dde4ff;">' + _acctEscHtml(user.email || user.id) + '</strong>')
    : (st.available ? 'Sign in to sync progress across browsers and devices.' : 'Add Supabase config to enable cloud sync.');
  const buttonRow = signedIn
    ? '<button onclick="_acctCloudSyncNow()" style="' + _acctBtnStyle('green') + '">Sync Now</button>'
      + '<button onclick="_acctCloudLogOut()" style="' + _acctBtnStyle('orange') + '">Sign Out</button>'
    : '<button onclick="_acctCloudSignIn()" style="' + _acctBtnStyle('blue') + '">Log In</button>'
      + '<button onclick="_acctCloudSignUp()" style="' + _acctBtnStyle('purple') + '">Sign Up</button>';

  return '<div style="margin:0 0 14px;padding:12px;border:1px solid rgba(100,180,255,0.18);border-radius:8px;background:rgba(255,255,255,0.03);">'
    + '<div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start;flex-wrap:wrap;">'
    + '<div>'
    + '<div style="font-size:0.82rem;font-weight:700;color:#88ccff;margin-bottom:4px;">' + title + '</div>'
    + '<div style="font-size:0.76rem;opacity:0.7;line-height:1.4;">' + status + '</div>'
    + '</div>'
    + '<div style="display:flex;gap:6px;flex-wrap:wrap;">' + buttonRow + '</div>'
    + '</div>'
    + (signedIn ? ''
      : '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px;">'
        + '<input id="_acctCloudEmail" type="email" placeholder="Email" autocomplete="email" style="' + _acctInputStyle() + '">'
        + '<input id="_acctCloudPassword" type="password" placeholder="Password" autocomplete="current-password" style="' + _acctInputStyle() + '">'
        + '</div>'
        + '<div id="_acctCloudMsg" style="min-height:18px;margin-top:6px;font-size:0.76rem;opacity:0.72;"></div>')
    + '<div style="margin-top:6px;font-size:0.72rem;opacity:0.5;line-height:1.4;">Cloud auth uses Supabase sessions. A successful login keeps progress synced on GitHub Pages, itch.io, and Render.</div>'
    + '<div style="margin-top:10px;padding-top:10px;border-top:1px solid rgba(255,255,255,0.08);display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;">'
    + '<div style="font-size:0.72rem;opacity:0.58;">Community</div>'
    + '<button onclick="window.open(\'https://discord.gg/dgmhj33a5H\',\'_blank\',\'noopener\')" style="' + _acctBtnStyle('blue') + '">💬 Discord</button>'
    + '</div>'
    + '</div>';
}

// ── View: Login ───────────────────────────────────────────────────────────────
function _acctRenderLogin(inner) {
  const id   = _acctModalData.targetId;
  const p    = GameState.getPersistent();
  const acct = p.accounts && p.accounts[id];
  if (!acct) { _acctModalData.view = 'list'; _acctRender(); return; }

  inner.innerHTML = '<h3 style="margin:0 0 6px;font-size:1.1rem;color:#88ccff;">🔒 Login</h3>'
    + '<p style="margin:0 0 16px;font-size:0.82rem;opacity:0.6;">Enter password for <strong style="color:#dde4ff;">' + _acctEscHtml(acct.username) + '</strong></p>'
    + '<input id="_acctPwInput" type="password" placeholder="Password" autocomplete="current-password"'
    + ' style="' + _acctInputStyle() + '" onkeydown="if(event.key===\'Enter\')_acctSubmitLogin()">'
    + '<div id="_acctLoginErr" style="color:#ff7777;font-size:0.78rem;margin-top:6px;min-height:18px;"></div>'
    + '<div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap;">'
    + '<button onclick="_acctSubmitLogin()" style="' + _acctBtnStyle('blue') + ';flex:1;">Login</button>'
    + '<button onclick="_acctGoRecovery(\'' + _acctEscId(id) + '\')" style="' + _acctBtnStyle('dim') + '">Forgot password?</button>'
    + '<button onclick="_acctNav(\'list\')" style="' + _acctBtnStyle('dim') + '">Back</button>'
    + '</div>';

  setTimeout(function() { const i = document.getElementById('_acctPwInput'); if (i) i.focus(); }, 50);
}

function _acctSubmitLogin() {
  const id  = _acctModalData.targetId;
  const inp = document.getElementById('_acctPwInput');
  const err = document.getElementById('_acctLoginErr');
  if (!inp) return;
  if (!AccountManager.verifyPassword(id, inp.value)) {
    if (err) err.textContent = 'Incorrect password.';
    inp.value = ''; inp.focus();
    return;
  }
  GameState.update(function(s) {
    if (s.persistent.accounts[id] && s.persistent.accounts[id].auth)
      s.persistent.accounts[id].auth.locked = false;
  });
  GameState.save();
  const p = GameState.getPersistent();
  if (p.activeAccountId !== id) AccountManager.switchAccount(id);
  const acct = GameState.getPersistent().accounts[id];
  closeAccountsModal();
  _acctToast('Logged in as ' + (acct ? acct.username : 'account'));
}

// ── View: Set / Change / Remove Password ─────────────────────────────────────
function _acctRenderSetPw(inner) {
  const id    = _acctModalData.targetId;
  const p     = GameState.getPersistent();
  const acct  = p.accounts && p.accounts[id];
  if (!acct) { _acctModalData.view = 'list'; _acctRender(); return; }
  const hasPw = AccountManager.hasPassword(id);

  inner.innerHTML = '<h3 style="margin:0 0 6px;font-size:1.1rem;color:#88ccff;">🔐 Password — ' + _acctEscHtml(acct.username) + '</h3>'
    + '<p style="margin:0 0 12px;font-size:0.78rem;opacity:0.55;">' + (hasPw ? 'Change or remove your password.' : 'Set a password to lock this account. You\'ll receive a recovery code.') + '</p>'
    + (hasPw ? '<input id="_acctOldPw" type="password" placeholder="Current password" autocomplete="current-password" style="' + _acctInputStyle() + ';margin-bottom:8px;">' : '')
    + '<input id="_acctNewPw" type="password" placeholder="' + (hasPw ? 'New password' : 'Password') + '" autocomplete="new-password" style="' + _acctInputStyle() + ';margin-bottom:8px;">'
    + '<input id="_acctConfPw" type="password" placeholder="Confirm password" autocomplete="new-password" style="' + _acctInputStyle() + ';margin-bottom:4px;" onkeydown="if(event.key===\'Enter\')_acctSubmitSetPw()">'
    + '<div id="_acctPwErr" style="color:#ff7777;font-size:0.78rem;min-height:18px;"></div>'
    + '<div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap;">'
    + '<button onclick="_acctSubmitSetPw()" style="' + _acctBtnStyle('blue') + ';flex:1;">' + (hasPw ? 'Change Password' : 'Set Password') + '</button>'
    + (hasPw ? '<button onclick="_acctSubmitRemovePw()" style="' + _acctBtnStyle('red') + '">Remove Password</button>' : '')
    + '<button onclick="_acctNav(\'list\')" style="' + _acctBtnStyle('dim') + '">Back</button>'
    + '</div>';

  setTimeout(function() { const i = document.getElementById(hasPw ? '_acctOldPw' : '_acctNewPw'); if (i) i.focus(); }, 50);
}

function _acctSubmitSetPw() {
  const id    = _acctModalData.targetId;
  const hasPw = AccountManager.hasPassword(id);
  const oldEl = document.getElementById('_acctOldPw');
  const newEl = document.getElementById('_acctNewPw');
  const cfEl  = document.getElementById('_acctConfPw');
  const err   = document.getElementById('_acctPwErr');
  const newPw = newEl ? newEl.value : '';
  const cfPw  = cfEl  ? cfEl.value  : '';
  if (!newPw)           { if (err) err.textContent = 'Password cannot be empty.'; return; }
  if (newPw !== cfPw)   { if (err) err.textContent = 'Passwords do not match.'; return; }
  if (newPw.length < 4) { if (err) err.textContent = 'At least 4 characters required.'; return; }
  if (hasPw) {
    const oldPw = oldEl ? oldEl.value : '';
    if (!AccountManager.changePassword(id, oldPw, newPw)) {
      if (err) err.textContent = 'Current password is incorrect.';
      if (oldEl) { oldEl.value = ''; oldEl.focus(); }
      return;
    }
    _acctNav('list');
    _acctToast('Password changed.');
  } else {
    const code = AccountManager.setPassword(id, newPw);
    _acctModalData.recoveryCode = code;
    _acctNav('showcode');
  }
}

function _acctSubmitRemovePw() {
  const id    = _acctModalData.targetId;
  const oldEl = document.getElementById('_acctOldPw');
  const err   = document.getElementById('_acctPwErr');
  const oldPw = oldEl ? oldEl.value : '';
  if (!AccountManager.removePassword(id, oldPw)) {
    if (err) err.textContent = 'Incorrect password.';
    if (oldEl) { oldEl.value = ''; oldEl.focus(); }
    return;
  }
  _acctNav('list');
  _acctToast('Password removed.');
}

// ── View: Recovery ────────────────────────────────────────────────────────────
function _acctRenderRecovery(inner) {
  const id   = _acctModalData.targetId;
  const p    = GameState.getPersistent();
  const acct = p.accounts && p.accounts[id];
  if (!acct) { _acctModalData.view = 'list'; _acctRender(); return; }

  inner.innerHTML = '<h3 style="margin:0 0 6px;font-size:1.1rem;color:#88ccff;">🔑 Password Recovery</h3>'
    + '<p style="margin:0 0 12px;font-size:0.82rem;opacity:0.6;">Account: <strong style="color:#dde4ff;">' + _acctEscHtml(acct.username) + '</strong></p>'
    + '<p style="margin:0 0 12px;font-size:0.78rem;opacity:0.55;">Enter your 12-character recovery code and a new password.</p>'
    + '<input id="_acctRcCode" type="text" placeholder="XXXX-XXXX-XXXX" autocomplete="off" maxlength="14"'
    + ' style="' + _acctInputStyle() + ';margin-bottom:8px;text-transform:uppercase;letter-spacing:2px;font-family:monospace;"'
    + ' oninput="this.value=this.value.toUpperCase()">'
    + '<input id="_acctRcNewPw" type="password" placeholder="New password" autocomplete="new-password" style="' + _acctInputStyle() + ';margin-bottom:8px;">'
    + '<input id="_acctRcCfPw" type="password" placeholder="Confirm new password" autocomplete="new-password" style="' + _acctInputStyle() + ';margin-bottom:4px;"'
    + ' onkeydown="if(event.key===\'Enter\')_acctSubmitRecovery()">'
    + '<div id="_acctRcErr" style="color:#ff7777;font-size:0.78rem;min-height:18px;"></div>'
    + '<div style="display:flex;gap:8px;margin-top:14px;">'
    + '<button onclick="_acctSubmitRecovery()" style="' + _acctBtnStyle('blue') + ';flex:1;">Reset Password</button>'
    + '<button onclick="_acctNav(\'login\')" style="' + _acctBtnStyle('dim') + '">Back</button>'
    + '</div>';

  setTimeout(function() { const i = document.getElementById('_acctRcCode'); if (i) i.focus(); }, 50);
}

function _acctSubmitRecovery() {
  const id    = _acctModalData.targetId;
  const code  = ((document.getElementById('_acctRcCode')  || {}).value || '').trim().toUpperCase();
  const newPw = ((document.getElementById('_acctRcNewPw') || {}).value || '');
  const cfPw  = ((document.getElementById('_acctRcCfPw')  || {}).value || '');
  const err   = document.getElementById('_acctRcErr');
  if (!code)            { if (err) err.textContent = 'Enter your recovery code.'; return; }
  if (!newPw)           { if (err) err.textContent = 'Enter a new password.'; return; }
  if (newPw !== cfPw)   { if (err) err.textContent = 'Passwords do not match.'; return; }
  if (newPw.length < 4) { if (err) err.textContent = 'At least 4 characters required.'; return; }
  const newCode = AccountManager.resetPasswordWithCode(id, code, newPw);
  if (!newCode) { if (err) err.textContent = 'Invalid recovery code. Check it and try again.'; return; }
  _acctModalData.recoveryCode = newCode;
  _acctNav('showcode');
}

async function _acctCloudSignIn() {
  if (!window.SupabaseBridge || typeof SupabaseBridge.signInAndLoad !== 'function') return;
  const email = ((document.getElementById('_acctCloudEmail') || {}).value || '').trim();
  const password = ((document.getElementById('_acctCloudPassword') || {}).value || '');
  const msg = document.getElementById('_acctCloudMsg');
  if (!email || !password) {
    if (msg) msg.textContent = 'Enter email and password.';
    return;
  }
  if (msg) msg.textContent = 'Signing in...';
  const res = await SupabaseBridge.signInAndLoad(email, password);
  if (res && res.error) {
    if (msg) msg.textContent = res.error.message || 'Login failed.';
    return;
  }
  if (msg) msg.textContent = '';
  _acctRender();
  _acctToast('Cloud session restored.');
}

async function _acctCloudSignUp() {
  if (!window.SupabaseBridge || typeof SupabaseBridge.signUpAndLoad !== 'function') return;
  const email = ((document.getElementById('_acctCloudEmail') || {}).value || '').trim();
  const password = ((document.getElementById('_acctCloudPassword') || {}).value || '');
  const msg = document.getElementById('_acctCloudMsg');
  if (!email || !password) {
    if (msg) msg.textContent = 'Enter email and password.';
    return;
  }
  if (password.length < 6) {
    if (msg) msg.textContent = 'Password should be at least 6 characters.';
    return;
  }
  if (msg) msg.textContent = 'Creating account...';
  const res = await SupabaseBridge.signUpAndLoad(email, password);
  if (res && res.error) {
    if (msg) msg.textContent = res.error.message || 'Signup failed.';
    return;
  }
  if (msg) {
    msg.textContent = (res && res.data && res.data.session)
      ? 'Cloud account created and signed in.'
      : 'Account created. Check your email to confirm, then return to sign in.';
  }
  _acctRender();
}

async function _acctCloudLogOut() {
  if (!window.SupabaseBridge || typeof SupabaseBridge.signOut !== 'function') return;
  await SupabaseBridge.signOut().catch(function(e) { console.warn('[accounts] cloud signout failed:', e); });
  _acctRender();
  _acctToast('Cloud session signed out.');
}

async function _acctCloudSyncNow() {
  if (!window.SupabaseBridge || typeof SupabaseBridge.reconcileActiveSave !== 'function') return;
  const msg = document.getElementById('_acctCloudMsg');
  if (msg) msg.textContent = 'Syncing...';
  await SupabaseBridge.reconcileActiveSave().catch(function(e) {
    if (msg) msg.textContent = e && e.message ? e.message : 'Cloud sync failed.';
  });
  if (msg) msg.textContent = 'Cloud save synchronized.';
  _acctToast('Cloud save synced.');
}

function showChapter1SavePrompt() {
  try {
    if (window.SupabaseBridge && typeof SupabaseBridge.isSignedIn === 'function' && SupabaseBridge.isSignedIn()) return;
    if (localStorage.getItem('smc_save_prompt_seen_v1') === '1') return;
  } catch(e) {}

  let modal = document.getElementById('chapter1SavePromptModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'chapter1SavePromptModal';
    modal.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,0.84);z-index:10020;align-items:center;justify-content:center;';
    modal.addEventListener('click', function(e) { if (e.target === modal) _acctCloseChapter1SavePrompt(); });
    const inner = document.createElement('div');
    inner.id = 'chapter1SavePromptInner';
    inner.style.cssText = [
      'background:#0b0b1e',
      'border:1px solid rgba(100,180,255,0.3)',
      'border-radius:12px',
      'padding:26px',
      'width:min(520px,92vw)',
      'max-height:88vh',
      'overflow-y:auto',
      'color:#dde4ff',
      "font-family:'Segoe UI',Arial,sans-serif",
      'box-shadow:0 0 40px rgba(0,100,255,0.18)',
    ].join(';');
    modal.appendChild(inner);
    document.body.appendChild(modal);
  }

  const inner = document.getElementById('chapter1SavePromptInner');
  if (!inner) return;
  inner.innerHTML = [
    '<div style="font-size:1.15rem;font-weight:800;color:#88ccff;margin-bottom:10px;">Save Your Progress Forever</div>',
    '<div style="font-size:0.84rem;line-height:1.6;opacity:0.82;margin-bottom:16px;">Create a free Stickman Battles account to:<br>- Keep progress forever<br>- Play on any device<br>- Unlock future online features<br>- Join the community</div>',
    '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">',
    '<button onclick="_acctOpenCloudSignupFromPrompt()" style="' + _acctBtnStyle('blue') + ';flex:1;">Create Account</button>',
    '<button onclick="_acctCloseChapter1SavePrompt(true)" style="' + _acctBtnStyle('dim') + '">Later</button>',
    '<button onclick="window.open(\'https://discord.gg/dgmhj33a5H\',\'_blank\',\'noopener\')" style="' + _acctBtnStyle('purple') + '">💬 Discord</button>',
    '</div>',
  ].join('');

  modal.style.display = 'flex';
}

function _acctOpenCloudSignupFromPrompt() {
  _acctCloseChapter1SavePrompt(false);
  openAccountsModal();
  setTimeout(function() {
    const email = document.getElementById('_acctCloudEmail');
    if (email) email.focus();
  }, 80);
}

function _acctCloseChapter1SavePrompt(markSeen) {
  const modal = document.getElementById('chapter1SavePromptModal');
  if (modal) modal.style.display = 'none';
  if (markSeen) {
    try { localStorage.setItem('smc_save_prompt_seen_v1', '1'); } catch(e) {}
  }
}

// ── View: Show Recovery Code ──────────────────────────────────────────────────
function _acctRenderShowCode(inner) {
  const code = _acctModalData.recoveryCode || '(error)';
  inner.innerHTML = '<h3 style="margin:0 0 8px;font-size:1.1rem;color:#ffcc44;">⚠️ Save Your Recovery Code</h3>'
    + '<p style="margin:0 0 12px;font-size:0.82rem;opacity:0.75;">This is shown <strong>once only</strong>. Without it you cannot recover your account if you forget your password.</p>'
    + '<div style="background:rgba(255,200,50,0.1);border:1px solid rgba(255,200,50,0.4);border-radius:8px;padding:16px;text-align:center;margin-bottom:14px;">'
    + '<div style="font-family:monospace;font-size:1.5rem;letter-spacing:3px;color:#ffee88;user-select:all;">' + _acctEscHtml(code) + '</div>'
    + '<button onclick="navigator.clipboard&&navigator.clipboard.writeText(\'' + _acctEscStr(code) + '\').then(function(){_acctToast(\'Copied!\')})"'
    + ' style="' + _acctBtnStyle('dim') + ';margin-top:10px;font-size:0.75rem;">📋 Copy</button>'
    + '</div>'
    + '<p style="margin:0 0 16px;font-size:0.75rem;opacity:0.5;">Store this somewhere safe — a notes app, password manager, or paper.</p>'
    + '<button onclick="_acctNav(\'list\')" style="' + _acctBtnStyle('blue') + ';width:100%;">I\'ve Saved It — Continue</button>';
}

// ── Navigation ────────────────────────────────────────────────────────────────
function _acctNav(view, targetId) {
  _acctModalData.view = view;
  if (targetId !== undefined) _acctModalData.targetId = targetId;
  _acctEnsureModal();
  _acctRender();
}

function _acctGoSetPw(id)    { _acctNav('setpw', id); }
function _acctGoRecovery(id) { _acctNav('recovery', id); }

function _acctClickSwitch(id) {
  if (AccountManager.isLocked(id)) {
    _acctNav('login', id);
  } else {
    AccountManager.switchAccount(id);
    _acctNav('list');
    const acct = GameState.getPersistent().accounts[id];
    _acctToast('Switched to ' + (acct ? acct.username : 'account'));
  }
}

function _acctLogout() {
  const active = AccountManager.getActiveAccount();
  if (!active) return;
  if (!AccountManager.hasPassword(active.id)) {
    _acctToast('Set a password first to enable logout.');
    _acctNav('setpw', active.id);
    return;
  }
  AccountManager.logoutCurrentAccount();
  _acctNav('list');
  _acctToast('Logged out. Account is now locked.');
}

// ── Prompt helpers ────────────────────────────────────────────────────────────
function _acctCreatePrompt() {
  const name = prompt('Enter a name for the new account (max 20 chars):');
  if (name === null) return;
  AccountManager.createAccount(name);
  _acctNav('list');
  _acctToast('Account created!');
}

function _acctRenamePrompt(id, currentName) {
  const newName = prompt('Rename "' + currentName + '" to (max 20 chars):', currentName);
  if (newName === null) return;
  if (!AccountManager.renameAccount(id, newName)) return;
  _acctNav('list');
  _acctToast('Account renamed.');
}

function _acctConfirmDelete(id, username) {
  if (!confirm('Delete account "' + username + '"?\nThis cannot be undone.')) return;
  const wasLast = AccountManager.getAllAccounts().length === 1;
  AccountManager.deleteAccount(id);
  _acctNav('list');
  _acctToast(wasLast ? 'Account deleted. A new default account was created.' : 'Account deleted.');
}

// ── Style helpers ─────────────────────────────────────────────────────────────
function _acctBtnStyle(type) {
  const base = 'border-radius:6px;padding:5px 12px;cursor:pointer;font-size:0.78rem;';
  if (type === 'blue')   return base + 'background:rgba(80,160,255,0.15);border:1px solid rgba(80,160,255,0.4);color:#88ccff;';
  if (type === 'green')  return base + 'background:rgba(120,200,80,0.12);border:1px solid rgba(120,200,80,0.35);color:#aaffaa;';
  if (type === 'red')    return base + 'background:rgba(255,60,60,0.12);border:1px solid rgba(255,80,80,0.35);color:#ff8888;';
  if (type === 'purple') return base + 'background:rgba(180,80,255,0.12);border:1px solid rgba(180,100,255,0.35);color:#cc88ff;';
  if (type === 'orange') return base + 'background:rgba(255,160,40,0.12);border:1px solid rgba(255,160,40,0.35);color:#ffbb66;';
  return base + 'background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.18);color:#aab;';
}

function _acctInputStyle() {
  return [
    'width:100%',
    'box-sizing:border-box',
    'background:rgba(255,255,255,0.07)',
    'border:1px solid rgba(100,180,255,0.3)',
    'border-radius:7px',
    'color:#dde4ff',
    'padding:9px 12px',
    'font-size:0.88rem',
    "font-family:'Segoe UI',Arial,sans-serif",
    'outline:none',
  ].join(';');
}

// ── Safe string helpers ───────────────────────────────────────────────────────
function _acctEscHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function _acctEscStr(s) {
  return String(s).replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/[<>]/g,'');
}
function _acctEscId(s) {
  return String(s).replace(/[^a-zA-Z0-9_]/g,'');
}

// ── hasPermission ─────────────────────────────────────────────────────────────
function hasPermission(level) {
  const _ROLE_RANK = { player: 0, admin: 1, dev: 2 };
  const required = (_ROLE_RANK[level] !== undefined) ? _ROLE_RANK[level] : 999;
  if (required === 0) return true;
  const acct = (typeof AccountManager !== 'undefined') ? AccountManager.getActiveAccount() : null;
  if (!acct) return false;
  if (isSuperuserAccountId(acct.id)) return true;
  const role   = acct.role || 'player';
  const actual = (_ROLE_RANK[role] !== undefined) ? _ROLE_RANK[role] : 0;
  return actual >= required;
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function _acctToast(msg) {
  let t = document.getElementById('accountsToast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'accountsToast';
    t.style.cssText = [
      'position:fixed','top:24px','left:50%','transform:translateX(-50%)',
      'background:rgba(5,5,20,0.92)','color:#dde4ff',
      'padding:8px 22px','border-radius:8px','font-size:0.82rem',
      'z-index:99999','pointer-events:none','transition:opacity 0.3s',
      'border:1px solid rgba(80,200,120,0.45)',
      "font-family:'Segoe UI',Arial,sans-serif",
    ].join(';');
    document.body.appendChild(t);
  }
  t.textContent   = msg;
  t.style.opacity = '1';
  clearTimeout(t._hideTimer);
  t._hideTimer = setTimeout(function() { t.style.opacity = '0'; }, 2200);
}
