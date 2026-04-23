'use strict';
// smb-admin-core.js — Admin identity, isAdmin, ban records/helpers, ban/unban/kick actions, player chapter/items/reset, lobby management
// Depends on: smb-globals.js, smb-state.js, smb-accounts.js

// smb-admin.js — Developer admin control system
// Loaded after smb-save.js. Story/network globals are referenced at call-time,
// not at parse-time, so load order relative to those files is not critical.
'use strict';

// ── Admin identity ─────────────────────────────────────────────────────────────
// Add account IDs here to grant admin powers.
const ADMIN_IDS = ['acct_mo3runjg_h23f4'];

// All achievement IDs — kept in sync with smb-achievements.js
const _ADMIN_ALL_ACH_IDS = [
  'first_blood', 'hat_trick', 'survivor', 'untouchable', 'combo_king',
  'gunslinger', 'hammer_time', 'clash_master',
  'wave_5', 'wave_10', 'survival_win', 'koth_win',
  'boss_slayer', 'true_form', 'yeti_hunter', 'beast_tamer',
  'chaos_survivor', 'super_saver', 'speedrun', 'perfectionist',
];

// ── isAdmin ────────────────────────────────────────────────────────────────────
// Legacy helper kept for external callers. New internal code should use _isAdmin().
function isAdmin(accountId) {
  return ADMIN_IDS.indexOf(String(accountId)) !== -1;
}

// ── _isAdmin ───────────────────────────────────────────────────────────────────
// Authoritative admin check used by all internal admin logic.
//
// Precedence:
//   1. GameState.getPersistent().admin.overrides[id] — if the key exists, its
//      boolean value wins (true = elevated, false = explicitly revoked).
//   2. ADMIN_IDS hardcoded list — fallback when no override is present.
//
// This means admins can be granted or revoked at runtime without redeploying:
//   GameState.update(s => { s.persistent.admin.overrides['acct_123'] = true; });
//   GameState.update(s => { s.persistent.admin.overrides['acct_123'] = false; }); // revoke
function _isAdmin(id) {
  const overrides = GameState.getPersistent().admin.overrides;
  if (overrides.hasOwnProperty(id)) {
    return !!overrides[id];
  }
  return ADMIN_IDS.includes(String(id));
}

// ── Internal helpers ───────────────────────────────────────────────────────────

// Returns the AccountManager entry for the given id, or null.
function _adminGetAcct(accountId) {
  if (!window.AccountManager) return null;
  return AccountManager.getAllAccounts().find(function(a) { return a.id === accountId; }) || null;
}

// True if accountId is the currently active account.
function _adminIsActive(accountId) {
  if (!window.AccountManager) return false;
  const active = AccountManager.getActiveAccount();
  return active && active.id === accountId;
}

// Decode → mutate → re-encode a raw save blob in localStorage for any account.
// mutFn(data) receives the decoded save object and should mutate it in-place.
function _adminMutateRawSave(accountId, mutFn) {
  const acct = _adminGetAcct(accountId);
  if (!acct) { console.warn('[Admin] Account not found:', accountId); return false; }
  try {
    const raw  = localStorage.getItem(acct.saveKey);
    const data = raw
      ? JSON.parse(decodeURIComponent(escape(atob(raw))))
      : { version: 2, unlocks: {}, settings: {}, story: null };
    mutFn(data);
    localStorage.setItem(acct.saveKey, btoa(unescape(encodeURIComponent(JSON.stringify(data)))));
    return true;
  } catch(e) {
    console.warn('[Admin] Mutate raw save failed:', e);
    return false;
  }
}

// ── Ban helpers ───────────────────────────────────────────────────────────────

function _adminGetBanRecords() {
  const p = GameState.getPersistent();
  if (!p.admin) p.admin = { overrides: {}, bans: { records: {} } };
  if (!p.admin.bans) p.admin.bans = { records: {} };
  if (!p.admin.bans.records) p.admin.bans.records = {};
  return p.admin.bans.records;
}

function _adminTrimExpiredBans() {
  const now = Date.now();
  let dirty = false;
  GameState.update(function(s) {
    const records = s.persistent.admin && s.persistent.admin.bans ? s.persistent.admin.bans.records : null;
    if (!records) return;
    Object.keys(records).forEach(function(key) {
      const rec = records[key];
      if (rec && rec.expiresAt && rec.expiresAt <= now) {
        delete records[key];
        dirty = true;
      }
    });
  });
  if (dirty) GameState.save();
  return dirty;
}

function _adminBanRecordKey(record) {
  return [record.kind || 'mixed', record.accountId || '', record.peerId || '', record.deviceId || '', record.createdAt || Date.now()].join(':');
}

function _adminNormalizeMinutes(minutes) {
  if (minutes === null || minutes === undefined || minutes === '') return null;
  const n = parseFloat(minutes);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function _adminResolveBanTarget(target) {
  const raw = String(target || '').trim();
  if (!raw) return null;

  const bundle = {
    raw: raw,
    label: raw,
    slot: null,
    accountId: null,
    peerId: null,
    deviceId: null,
    username: null,
    role: null,
    source: null,
  };

  const lower = raw.toLowerCase();
  const acct = (typeof AccountManager !== 'undefined' && AccountManager.getActiveAccount) ? AccountManager.getActiveAccount() : null;
  if (['me', 'self', 'here'].includes(lower) && acct) {
    bundle.accountId = acct.id;
    bundle.username = acct.username || null;
    bundle.role = acct.role || null;
    bundle.label = acct.username ? acct.username + ' (self)' : raw;
  }

  if (!bundle.accountId && lower.startsWith('acct:')) {
    bundle.accountId = raw.slice(5).trim();
  } else if (!bundle.accountId && lower.startsWith('account:')) {
    bundle.accountId = raw.slice(8).trim();
  }

  if (lower.startsWith('peer:')) {
    bundle.peerId = raw.slice(5).trim();
  } else if (lower.startsWith('device:')) {
    bundle.deviceId = raw.slice(7).trim();
  } else if (lower.startsWith('slot:')) {
    bundle.slot = parseInt(raw.slice(5), 10);
  } else if (/^p\d+$/i.test(raw)) {
    bundle.slot = parseInt(raw.slice(1), 10) - 1;
  } else if (/^\d+$/.test(raw)) {
    bundle.slot = parseInt(raw, 10);
  }
  if (!Number.isFinite(bundle.slot)) bundle.slot = null;

  if (bundle.slot !== null && window.NetworkManager && typeof NetworkManager.getPeerMeta === 'function') {
    const meta = NetworkManager.getPeerMeta(bundle.slot);
    if (meta) {
      bundle.peerId = bundle.peerId || meta.peerId || null;
      bundle.accountId = bundle.accountId || meta.accountId || null;
      bundle.deviceId = bundle.deviceId || meta.deviceId || null;
      bundle.username = bundle.username || meta.username || null;
      bundle.role = bundle.role || meta.role || null;
      bundle.label = meta.username ? meta.username + ' (slot ' + bundle.slot + ')' : bundle.label;
      bundle.source = 'slot';
    }
  }

  if (!bundle.accountId && window.AccountManager) {
    const all = AccountManager.getAllAccounts ? AccountManager.getAllAccounts() : [];
    const exact = all.filter(function(a) { return String(a.id || '') === raw; });
    if (exact.length > 0) {
      bundle.accountId = exact[0].id;
      bundle.username = exact[0].username || null;
      bundle.role = exact[0].role || null;
      bundle.label = exact[0].username || raw;
      bundle.source = 'account-id';
    } else if (!bundle.peerId && !bundle.deviceId) {
      const matches = AccountManager.findAccountByName ? AccountManager.findAccountByName(raw) : [];
      if (matches.length === 1) {
        bundle.accountId = matches[0].id;
        bundle.username = matches[0].username || null;
        bundle.role = matches[0].role || null;
        bundle.label = matches[0].username || raw;
        bundle.source = 'account-name';
      } else if (matches.length > 1) {
        bundle.error = 'Ambiguous username: ' + raw;
        bundle.matches = matches;
      }
    }
  }

  if (!bundle.peerId && window.NetworkManager) {
    if (bundle.accountId && typeof NetworkManager.getSlotByAccountId === 'function') {
      const slot = NetworkManager.getSlotByAccountId(bundle.accountId);
      if (slot !== null && slot !== undefined) {
        bundle.slot = slot;
        const meta = NetworkManager.getPeerMeta(slot);
        if (meta) {
          bundle.peerId = meta.peerId || bundle.peerId;
          bundle.deviceId = meta.deviceId || bundle.deviceId;
          bundle.username = meta.username || bundle.username;
          bundle.role = meta.role || bundle.role;
          bundle.source = bundle.source || 'roster';
        }
      }
    }
    if (bundle.peerId && typeof NetworkManager.getSlotByPeerId === 'function') {
      const slot = NetworkManager.getSlotByPeerId(bundle.peerId);
      if (slot !== null && slot !== undefined) {
        bundle.slot = slot;
        const meta = NetworkManager.getPeerMeta(slot);
        if (meta) {
          bundle.accountId = meta.accountId || bundle.accountId;
          bundle.deviceId = meta.deviceId || bundle.deviceId;
          bundle.username = meta.username || bundle.username;
          bundle.role = meta.role || bundle.role;
          bundle.source = bundle.source || 'roster';
        }
      }
    }
    if (bundle.deviceId && typeof NetworkManager.getSlotByDeviceId === 'function') {
      const slot = NetworkManager.getSlotByDeviceId(bundle.deviceId);
      if (slot !== null && slot !== undefined) {
        bundle.slot = slot;
        const meta = NetworkManager.getPeerMeta(slot);
        if (meta) {
          bundle.accountId = meta.accountId || bundle.accountId;
          bundle.peerId = meta.peerId || bundle.peerId;
          bundle.username = meta.username || bundle.username;
          bundle.role = meta.role || bundle.role;
          bundle.source = bundle.source || 'roster';
        }
      }
    }
  }

  return bundle;
}

function _adminRecordMatchesIdentity(record, identity) {
  if (!record || !identity) return false;
  if (record.expiresAt && record.expiresAt <= Date.now()) return false;
  const acc = String(identity.accountId || '');
  const peer = String(identity.peerId || '');
  const dev  = String(identity.deviceId || '');
  const user = String(identity.username || '').toLowerCase();
  return (
    (record.accountId && acc && String(record.accountId) === acc) ||
    (record.peerId && peer && String(record.peerId) === peer) ||
    (record.deviceId && dev && String(record.deviceId) === dev) ||
    (!record.accountId && !record.peerId && !record.deviceId && record.username && user && String(record.username).toLowerCase() === user)
  );
}

function isConnectionBanned(identity) {
  _adminTrimExpiredBans();
  const records = _adminGetBanRecords();
  for (const key in records) {
    const rec = records[key];
    if (_adminRecordMatchesIdentity(rec, identity || {})) return rec;
  }
  return null;
}

function _adminStoreBan(bundle, minutes, reason, kind, note) {
  const now = Date.now();
  const ttl = _adminNormalizeMinutes(minutes);
  const record = {
    kind: kind || (bundle.peerId && bundle.accountId ? 'mixed' : bundle.accountId ? 'account' : bundle.peerId ? 'peer' : 'device'),
    accountId: bundle.accountId || null,
    peerId: bundle.peerId || null,
    deviceId: bundle.deviceId || null,
    username: bundle.username || null,
    role: bundle.role || null,
    slot: bundle.slot !== null && bundle.slot !== undefined ? bundle.slot : null,
    createdAt: now,
    expiresAt: ttl ? now + Math.round(ttl * 60000) : null,
    reason: String(reason || '').trim(),
    createdBy: (window.AccountManager && AccountManager.getActiveAccount && AccountManager.getActiveAccount()) ? AccountManager.getActiveAccount().id : null,
    createdByName: (window.AccountManager && AccountManager.getActiveAccount && AccountManager.getActiveAccount()) ? AccountManager.getActiveAccount().username : null,
    note: note || '',
    targetLabel: bundle.label || bundle.raw || '',
  };
  const key = _adminBanRecordKey(record);
  GameState.update(function(s) {
    if (!s.persistent.admin) s.persistent.admin = { overrides: {}, bans: { records: {} } };
    if (!s.persistent.admin.bans) s.persistent.admin.bans = { records: {} };
    if (!s.persistent.admin.bans.records) s.persistent.admin.bans.records = {};
    s.persistent.admin.bans.records[key] = record;
  });
  GameState.save();

  // Push to server (non-blocking — fails gracefully if server is offline)
  _serverPostBan(key, record).then(function(result) {
    if (result && result.ok) {
      _adminLog('Ban synced to server: ' + (record.targetLabel || key));
    }
  });

  return record;
}

function _adminRemoveMatchingBans(bundle) {
  const removed = [];
  const removedKeys = [];
  GameState.update(function(s) {
    const records = s.persistent.admin && s.persistent.admin.bans ? s.persistent.admin.bans.records : null;
    if (!records) return;
    Object.keys(records).forEach(function(key) {
      const rec = records[key];
      if (!rec) return;
      const match =
        (bundle.accountId && String(rec.accountId || '') === String(bundle.accountId)) ||
        (bundle.peerId && String(rec.peerId || '') === String(bundle.peerId)) ||
        (bundle.deviceId && String(rec.deviceId || '') === String(bundle.deviceId));
      if (match) {
        removed.push(rec);
        removedKeys.push(key);
        delete records[key];
      }
    });
  });
  if (removed.length) {
    GameState.save();
    // Delete from server for each removed key (non-blocking)
    removedKeys.forEach(function(key) {
      _serverDeleteBan(key).then(function(result) {
        if (result && result.ok) {
          _adminLog('Unban synced to server: key ' + key.slice(0, 40));
        }
      });
    });
  }
  return removed;
}

function _adminFormatBanRecord(rec) {
  if (!rec) return '';
  const parts = [];
  if (rec.accountId) parts.push('acct ' + rec.accountId);
  if (rec.peerId) parts.push('peer ' + rec.peerId);
  if (rec.deviceId) parts.push('device ' + rec.deviceId);
  if (!parts.length && rec.targetLabel) parts.push(rec.targetLabel);
  const duration = rec.expiresAt ? Math.max(0, Math.ceil((rec.expiresAt - Date.now()) / 60000)) + 'm left' : 'perm';
  return '[' + (rec.kind || 'ban') + '] ' + parts.join(' | ') + ' • ' + duration + (rec.reason ? ' • ' + rec.reason : '');
}

function adminBanTarget(target, minutes, reason, opts) {
  opts = opts || {};
  if (!_adminPanelIsAllowed()) { _adminLog('ban: not admin'); return null; }
  const bundle = _adminResolveBanTarget(target);
  if (!bundle) { _adminLog('Ban target not found: ' + target); return null; }
  if (bundle.error) { _adminLog(bundle.error); return null; }
  const record = _adminStoreBan(bundle, minutes, reason, opts.kind || null, opts.note || '');
  _adminLog('Banned ' + (bundle.label || bundle.raw) + (record.expiresAt ? ' for ' + Math.round(_adminNormalizeMinutes(minutes)) + 'm' : ' permanently') + (record.reason ? ' — ' + record.reason : ''));
  if (window.NetworkManager && typeof NetworkManager.closeSlot === 'function' && bundle.slot !== null && bundle.slot !== undefined) {
    const closed = NetworkManager.closeSlot(bundle.slot, { type: 'banned', reason: record.reason || 'Banned from room.', ban: record }, 'ban');
    if (closed) return record;
  } else if (window.NetworkManager && typeof NetworkManager.sendToSlot === 'function' && bundle.slot !== null && bundle.slot !== undefined) {
    NetworkManager.sendToSlot(bundle.slot, { type: 'banned', reason: record.reason || 'Banned from room.', ban: record });
  }
  if (bundle.accountId && _adminIsActive(bundle.accountId)) {
    if (typeof LobbyManager !== 'undefined') { LobbyManager.leaveLobby(); }
    else if (window.NetworkManager)          { NetworkManager.disconnect(); }
  }
  return record;
}

function adminTempBanTarget(target, minutes, reason, opts) {
  return adminBanTarget(target, minutes, reason, opts);
}

function adminBanPeer(peerId, minutes, reason) {
  const bundle = _adminResolveBanTarget('peer:' + String(peerId || '').trim());
  if (!bundle) return null;
  return adminBanTarget(bundle.peerId || peerId, minutes, reason, { kind: 'peer', note: 'peer ban' });
}

function adminBanIp(target, minutes, reason) {
  const bundle = _adminResolveBanTarget(target);
  if (!bundle) { _adminLog('Ban target not found: ' + target); return null; }
  const note = 'Best-effort IP ban: browser peers do not expose real client IPs.';
  return adminBanTarget(target, minutes, reason, { kind: bundle.peerId ? 'mixed' : 'device', note: note });
}

function adminUnbanTarget(target) {
  if (!_adminPanelIsAllowed()) { _adminLog('unban: not admin'); return 0; }
  _adminTrimExpiredBans();
  const bundle = _adminResolveBanTarget(target);
  if (!bundle) { _adminLog('Unban target not found: ' + target); return 0; }
  if (bundle.error) { _adminLog(bundle.error); return 0; }
  const removed = _adminRemoveMatchingBans(bundle);
  if (!removed.length) {
    _adminLog('No active ban matched: ' + (bundle.label || bundle.raw));
    return 0;
  }
  _adminLog('Unbanned ' + (bundle.label || bundle.raw) + ' (' + removed.length + ' record' + (removed.length === 1 ? '' : 's') + ')');
  return removed.length;
}

function adminListBans() {
  _adminTrimExpiredBans();
  const records = _adminGetBanRecords();
  const list = Object.values(records);
  if (!list.length) {
    _adminLog('Ban list empty.');
    return [];
  }
  _adminLog('Active bans: ' + list.length);
  list.sort(function(a, b) { return (b.createdAt || 0) - (a.createdAt || 0); }).forEach(function(rec) {
    _adminLog('  ' + _adminFormatBanRecord(rec));
  });
  return list;
}

function adminBanSlot(slot, minutes, reason) {
  if (slot === null || slot === undefined || slot === '') return null;
  const target = 'slot:' + slot;
  return adminBanTarget(target, minutes, reason, { kind: 'mixed' });
}

function adminWhoAmI() {
  const identity = (window.NetworkManager && typeof NetworkManager.getLocalIdentity === 'function')
    ? NetworkManager.getLocalIdentity()
    : null;
  if (!identity) {
    _adminLog('Identity unavailable.');
    return null;
  }
  _adminLog('slot=' + identity.slot + ' peer=' + (identity.peerId || '—') + ' acct=' + (identity.accountId || '—') + ' device=' + (identity.deviceId || '—') + ' user=' + (identity.username || '—'));
  return identity;
}

function adminNetStatus() {
  const connected = window.NetworkManager && typeof NetworkManager.isConnected === 'function' ? NetworkManager.isConnected() : false;
  const host = window.NetworkManager && typeof NetworkManager.isHost === 'function' ? NetworkManager.isHost() : false;
  const slot = window.NetworkManager && typeof NetworkManager.getLocalSlot === 'function' ? NetworkManager.getLocalSlot() : null;
  const roster = window.NetworkManager && typeof NetworkManager.getPeerRoster === 'function' ? NetworkManager.getPeerRoster() : [];
  _adminLog('Net: ' + (connected ? 'connected' : 'offline') + ', role=' + (host ? 'host' : 'guest') + ', slot=' + (slot !== null && slot !== undefined ? slot : '—') + ', peers=' + roster.length);
  return { connected: connected, host: host, slot: slot, roster: roster };
}

// ── setPlayerChapter ───────────────────────────────────────────────────────────
// Sets the story chapter pointer. Marks all previous chapters as defeated so
// the chapter is reachable via normal story flow.
function setPlayerChapter(accountId, chapterId) {
  chapterId = parseInt(chapterId, 10) || 0;

  if (_adminIsActive(accountId)) {
    // Active account — use live story functions so the UI updates immediately.
    const story = (typeof getStoryDataForSave === 'function') ? getStoryDataForSave() : null;
    if (story) {
      story.chapter = chapterId;
      // Mark every prior chapter as defeated so none are gated.
      story.defeated = story.defeated || [];
      for (let i = 0; i < chapterId; i++) {
        if (story.defeated.indexOf(i) === -1) story.defeated.push(i);
      }
      if (typeof restoreStoryDataFromSave === 'function') restoreStoryDataFromSave(story);
    }
    if (typeof saveGame === 'function') saveGame();
    _adminLog('Chapter set to ' + chapterId + ' on active account.');
    return;
  }

  // Non-active account — modify the raw save blob directly.
  _adminMutateRawSave(accountId, function(data) {
    if (!data.story) data.story = {};
    data.story.chapter  = chapterId;
    data.story.defeated = data.story.defeated || [];
    for (let i = 0; i < chapterId; i++) {
      if (data.story.defeated.indexOf(i) === -1) data.story.defeated.push(i);
    }
  });
  _adminLog('Chapter set to ' + chapterId + ' on account ' + accountId + '.');
}

// ── unlockAllItems ─────────────────────────────────────────────────────────────
function unlockAllItems(accountId) {
  const allLetters = [0, 1, 2, 3, 4, 5, 6, 7];

  if (_adminIsActive(accountId)) {
    // Route all writes through the account-flag system
    if (typeof setAccountFlagWithRuntime === 'function') {
      setAccountFlagWithRuntime(['unlocks', 'bossBeaten'],  true, function(v) { bossBeaten = v; });
      setAccountFlagWithRuntime(['unlocks', 'trueform'],    true, function(v) { unlockedTrueBoss = v; });
      setAccountFlagWithRuntime(['unlocks', 'megaknight'],  true, function(v) { unlockedMegaknight = v; });
    } else {
      bossBeaten = true; unlockedTrueBoss = true; unlockedMegaknight = true;
    }
    allLetters.forEach(function(id) { if (typeof addLetter === 'function') addLetter(id); });
    // Unlock achievements via the live function so in-memory Set stays in sync.
    if (typeof unlockAchievement === 'function') {
      _ADMIN_ALL_ACH_IDS.forEach(function(id) { unlockAchievement(id); });
    }
    // Sync the hidden code-input display if available.
    if (typeof syncCodeInput === 'function') syncCodeInput();
    if (typeof saveGame === 'function') saveGame();
    _adminLog('All items unlocked on active account.');
    return;
  }

  _adminMutateRawSave(accountId, function(data) {
    if (!data.unlocks) data.unlocks = {};
    data.unlocks.bossBeaten   = true;
    data.unlocks.trueform     = true;
    data.unlocks.megaknight   = true;
    data.unlocks.letters      = allLetters;
    data.unlocks.achievements = _ADMIN_ALL_ACH_IDS.slice();
  });
  _adminLog('All items unlocked on account ' + accountId + '.');
}

// ── resetAccount ──────────────────────────────────────────────────────────────
function resetAccount(accountId) {
  const acct = _adminGetAcct(accountId);
  if (!acct) return;

  // Wipe save blobs from localStorage.
  try { localStorage.removeItem(acct.saveKey); } catch(e) {}
  try { localStorage.removeItem(acct.saveKey + '_backup'); } catch(e) {}

  if (_adminIsActive(accountId)) {
    // Wipe individual smc_* keys that are used as live state.
    ['smc_bossBeaten','smc_trueform','smc_megaknight',
     'smc_letters','smc_achievements','smc_story2'].forEach(function(k) {
      try { localStorage.removeItem(k); } catch(e) {}
    });
    // Reload save system to restore defaults.
    if (typeof loadGame === 'function') loadGame();
    _adminLog('Active account reset to defaults.');
    return;
  }

  _adminLog('Account ' + accountId + ' save data cleared.');
}

// ── forceJoinLobby ─────────────────────────────────────────────────────────────
// Legacy helper — wraps adminJoinAnyLobby for backwards compat with panel buttons.
function forceJoinLobby(lobbyId) {
  adminJoinAnyLobby(lobbyId);
}

// ── adminJoinAnyLobby ─────────────────────────────────────────────────────────
// Admin bypasses normal join flow — no UI input required, leaves current lobby
// first. Uses LobbyManager when available so presence state stays consistent.
function adminJoinAnyLobby(lobbyId) {
  if (!_adminPanelIsAllowed()) { _adminLog('adminJoinAnyLobby: not admin'); return; }
  if (!lobbyId) { _adminToast('Enter a lobby ID', true); return; }
  const id = String(lobbyId).toUpperCase().trim();
  if (typeof LobbyManager !== 'undefined' && typeof LobbyManager.joinLobby === 'function') {
    LobbyManager.joinLobby(id);
  } else if (window.NetworkManager && typeof NetworkManager.connect === 'function') {
    // Fallback: connect directly via NetworkManager (no lobby metadata).
    NetworkManager.connect(id, 10).catch(function(e) {
      console.warn('[Admin] Direct connect failed:', e);
    });
  }
  _adminLog('Joined lobby: ' + id);
}

// ── adminKickPlayer ───────────────────────────────────────────────────────────
// Broadcasts a kick event to all peers. The peer whose account ID matches
// receives it via handleAdminNetworkEvent and disconnects itself.
// Replaces the old kickPlayer() stub.
function adminKickPlayer(accountId) {
  if (!_adminPanelIsAllowed()) { _adminLog('adminKickPlayer: not admin'); return; }
  if (!accountId) return;

  _adminLog('Kick broadcast for account: ' + accountId);

  const bundle = _adminResolveBanTarget(accountId);
  if (bundle && bundle.slot !== null && bundle.slot !== undefined && window.NetworkManager && typeof NetworkManager.closeSlot === 'function') {
    const closed = NetworkManager.closeSlot(bundle.slot, {
      type: 'banned',
      reason: 'Kicked by admin.',
      targetAccountId: bundle.accountId || null,
      targetPeerId: bundle.peerId || null,
      targetDeviceId: bundle.deviceId || null,
      targetSlot: bundle.slot,
    }, 'kick');
    if (closed) return;
  }

  // Broadcast to all connected peers so the target receives it.
  if (window.NetworkManager && typeof NetworkManager.sendGameEvent === 'function') {
    NetworkManager.sendGameEvent('adminKick', { targetAccountId: accountId });
  }

  // If the target is the local account, disconnect immediately.
  if (_adminIsActive(accountId)) {
    if (typeof LobbyManager !== 'undefined') { LobbyManager.leaveLobby(); }
    else if (window.NetworkManager)          { NetworkManager.disconnect(); }
  }
}

// Keep old name as alias so existing panel buttons still work.
function kickPlayer(accountId) { adminKickPlayer(accountId); }

// ── adminSetChapterLive ───────────────────────────────────────────────────────
// Sets chapter on the target account locally AND broadcasts to connected peers
// so the target applies the change in their live session.
function adminSetChapterLive(accountId, chapter) {
  if (!_adminPanelIsAllowed()) { _adminLog('adminSetChapterLive: not admin'); return; }
  chapter = parseInt(chapter, 10) || 0;

  // Apply locally if the target is our own active account.
  if (_adminIsActive(accountId)) {
    setPlayerChapter(accountId, chapter);
  }

  // Broadcast to peers — the matching peer applies it on receipt.
  if (window.NetworkManager && typeof NetworkManager.sendGameEvent === 'function') {
    NetworkManager.sendGameEvent('adminSetChapter', {
      targetAccountId: accountId,
      chapter:         chapter,
    });
  }

  _adminLog('Chapter ' + chapter + ' set live for account: ' + accountId);
}

// ── handleAdminNetworkEvent ───────────────────────────────────────────────────
// Called from smb-network.js _handleGameEvent for every incoming gameEvent.
// Returns true if handled (stops further processing), false otherwise.
function handleAdminNetworkEvent(msg, fromSlot) {
  if (!msg || !msg.event) return false;
  if (fromSlot !== 0) return false; // only the host may originate admin packets

  // ── adminKick ──────────────────────────────────────────────────────────────
  if (msg.event === 'adminKick') {
    if (window.AccountManager) {
      const active = AccountManager.getActiveAccount();
      if (active && active.id === msg.targetAccountId) {
        _adminLog('Kicked from session by admin.');
        if (typeof LobbyManager !== 'undefined') { LobbyManager.leaveLobby(); }
        else if (window.NetworkManager)          { NetworkManager.disconnect(); }
      }
    }
    return true;
  }

  // ── adminBan ───────────────────────────────────────────────────────────────
  if (msg.event === 'adminBan') {
    if (window.AccountManager) {
      const active = AccountManager.getActiveAccount();
      const identity = (window.NetworkManager && typeof NetworkManager.getLocalIdentity === 'function')
        ? NetworkManager.getLocalIdentity()
        : null;
      const accountMatch = active && msg.targetAccountId && active.id === msg.targetAccountId;
      const peerMatch = identity && msg.targetPeerId && identity.peerId === msg.targetPeerId;
      const deviceMatch = identity && msg.targetDeviceId && identity.deviceId === msg.targetDeviceId;
      if (accountMatch || peerMatch || deviceMatch || msg.targetSlot === (window.NetworkManager && typeof NetworkManager.getLocalSlot === 'function' ? NetworkManager.getLocalSlot() : null)) {
        _adminLog('Banned from session by admin.');
        if (typeof LobbyManager !== 'undefined') { LobbyManager.leaveLobby(); }
        else if (window.NetworkManager)          { NetworkManager.disconnect(); }
      }
    }
    return true;
  }

  // ── adminSetChapter ────────────────────────────────────────────────────────
  if (msg.event === 'adminSetChapter') {
    if (window.AccountManager && typeof msg.targetAccountId === 'string') {
      const active = AccountManager.getActiveAccount();
      if (active && active.id === msg.targetAccountId) {
        const ch = parseInt(msg.chapter, 10) || 0;
        setPlayerChapter(active.id, ch);
        _adminLog('Chapter set to ' + ch + ' by remote admin.');
      }
    }
    return true;
  }

  return false;
}

// ── deleteAccount (admin shortcut) ────────────────────────────────────────────
function adminDeleteAccount(accountId) {
  if (!window.AccountManager) return;
  AccountManager.deleteAccount(accountId);
  _adminLog('Deleted account: ' + accountId);
  _adminPanelRefresh();
}

// ── Console log helper ────────────────────────────────────────────────────────
function _adminLog(msg) {
  const prefix = '[Admin] ';
  console.log(prefix + msg);
  // Mirror to in-game console if it exists.
  const log = document.getElementById('gameConsoleLog');
  if (log) {
    const line = document.createElement('div');
    line.style.color = '#ffdd88';
    line.textContent = prefix + msg;
    log.appendChild(line);
    log.scrollTop = log.scrollHeight;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Admin Panel UI
// ═══════════════════════════════════════════════════════════════════════════════

let _adminPanelOpen = false;

function _adminPanelIsAllowed() {
  if (!window.AccountManager) return false;
  const active = AccountManager.getActiveAccount();
  if (!active) return false;
  // Role-based check first; fall back to legacy ADMIN_IDS for existing admins
  if (typeof hasPermission === 'function' && hasPermission('admin')) return true;
  return _isAdmin(active.id);
}
