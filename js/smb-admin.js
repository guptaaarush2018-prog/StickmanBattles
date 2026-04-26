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
    // Set individual localStorage keys (source of truth for live game state).
    localStorage.setItem('smc_bossBeaten',  '1');
    localStorage.setItem('smc_trueform',    '1');
    localStorage.setItem('smc_megaknight',  '1');
    localStorage.setItem('smc_letters', JSON.stringify(allLetters));
    localStorage.setItem('smc_achievements', JSON.stringify(_ADMIN_ALL_ACH_IDS));
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
     'smc_letters','smc_achievements'].forEach(function(k) {
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

function _adminPanelToggle() {
  if (!_adminPanelIsAllowed()) {
    // Silently ignore for non-admins — no UI feedback on purpose.
    return;
  }
  _adminPanelOpen = !_adminPanelOpen;
  const panel = _adminPanelGetOrCreate();
  panel.style.display = _adminPanelOpen ? 'flex' : 'none';
  if (_adminPanelOpen) _adminPanelRefresh();
}

function _adminPanelGetOrCreate() {
  let panel = document.getElementById('adminControlPanel');
  if (panel) return panel;

  panel = document.createElement('div');
  panel.id = 'adminControlPanel';
  panel.style.cssText = [
    'display:none',
    'position:fixed',
    'top:50%','left:50%',
    'transform:translate(-50%,-50%)',
    'z-index:99998',
    'flex-direction:column',
    'gap:0',
    'min-width:360px',
    'max-width:min(480px,92vw)',
    'max-height:80vh',
    'overflow-y:auto',
    'background:#080814',
    'border:1px solid rgba(255,160,40,0.55)',
    'border-radius:12px',
    'box-shadow:0 0 48px rgba(255,140,0,0.18)',
    "font-family:'Segoe UI',Arial,sans-serif",
    'color:#ffe0a0',
  ].join(';');

  // Header
  const hdr = document.createElement('div');
  hdr.style.cssText = [
    'display:flex','align-items:center','justify-content:space-between',
    'padding:12px 18px',
    'background:rgba(255,140,0,0.1)',
    'border-bottom:1px solid rgba(255,140,0,0.3)',
    'border-radius:12px 12px 0 0',
    'position:sticky','top:0',
  ].join(';');
  hdr.innerHTML = [
    '<span style="font-size:0.9rem;font-weight:700;letter-spacing:1px;color:#ffcc66;">',
      '&#9888; ADMIN PANEL',
    '</span>',
    '<button onclick="_adminPanelToggle()" style="background:none;border:none;',
      'color:#ff8888;font-size:1rem;cursor:pointer;padding:0 4px;" title="Close (F9)">&#x2715;</button>',
  ].join('');
  panel.appendChild(hdr);

  // Body — populated by _adminPanelRefresh
  const body = document.createElement('div');
  body.id = 'adminPanelBody';
  body.style.cssText = 'padding:16px 18px;display:flex;flex-direction:column;gap:14px;';
  panel.appendChild(body);

  document.body.appendChild(panel);
  return panel;
}

function _adminPanelRefresh() {
  const body = document.getElementById('adminPanelBody');
  if (!body) return;

  const active   = window.AccountManager ? AccountManager.getActiveAccount() : null;
  const activeId = active ? active.id : '';
  const allAccts = window.AccountManager ? AccountManager.getAllAccounts() : [];
  const peerRoster = (window.NetworkManager && typeof NetworkManager.getPeerRoster === 'function') ? NetworkManager.getPeerRoster() : [];

  // Build account options string for <select>
  const acctOptions = allAccts.map(function(a) {
    return '<option value="' + _adminEsc(a.id) + '">' + _adminEsc(a.username) + (a.id === activeId ? ' (active)' : '') + '</option>';
  }).join('');
  const rosterRows = peerRoster.length ? peerRoster.map(function(p) {
    const slotLabel = (p && p.slot !== null && p.slot !== undefined) ? ('P' + (p.slot + 1)) : 'P?';
    const target = p.slot !== null && p.slot !== undefined ? ('slot:' + p.slot) : (p.accountId ? ('acct:' + p.accountId) : (p.peerId ? ('peer:' + p.peerId) : ''));
    const targetJs = JSON.stringify(String(target));
    return [
      '<div style="display:flex;flex-direction:column;gap:3px;padding:6px 8px;border:1px solid rgba(255,160,40,0.18);border-radius:8px;background:rgba(255,255,255,0.02);">',
        '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">',
          '<div style="font-size:0.78rem;color:#ffe0a0;"><strong style="color:#ffcc66;">' + _adminEsc(slotLabel) + '</strong> ' + _adminEsc(p.username || 'Unknown') + '</div>',
          '<div style="display:flex;gap:4px;flex-wrap:wrap;">',
            '<button onclick="_adminPanelBanTarget(' + targetJs + ', false)" style="background:rgba(180,40,40,0.18);border:1px solid rgba(255,80,80,0.35);border-radius:6px;color:#ff9999;padding:2px 7px;cursor:pointer;font-size:0.72rem;">Ban</button>',
            '<button onclick="_adminPanelBanTarget(' + targetJs + ', true)" style="background:rgba(180,40,40,0.12);border:1px solid rgba(255,80,80,0.3);border-radius:6px;color:#ffbbbb;padding:2px 7px;cursor:pointer;font-size:0.72rem;">Temp</button>',
            '<button onclick="_adminPanelKickTarget(' + targetJs + ')" style="background:rgba(255,160,40,0.12);border:1px solid rgba(255,160,40,0.35);border-radius:6px;color:#ffcc66;padding:2px 7px;cursor:pointer;font-size:0.72rem;">Kick</button>',
          '</div>',
        '</div>',
        '<div style="font-size:0.68rem;color:#8fa2d9;word-break:break-all;">',
          'acct: ' + _adminEsc(p.accountId || '—') + ' | peer: ' + _adminEsc(p.peerId || '—') + ' | device: ' + _adminEsc(p.deviceId || '—'),
        '</div>',
      '</div>',
    ].join('');
  }).join('') : '<div style="font-size:0.73rem;opacity:0.48;">No connected peers.</div>';

  body.innerHTML = [
    // ── Active account info ────────────────────────────────────────────────
    '<div style="font-size:0.78rem;opacity:0.55;padding-bottom:4px;border-bottom:1px solid rgba(255,140,0,0.2);">',
      'Active: <strong style="color:#ffcc66;">' + (active ? _adminEsc(active.username) : 'none') + '</strong>',
      ' &nbsp;|&nbsp; ID: <code style="font-size:0.72rem;color:#aac;">' + (activeId || '—') + '</code>',
    '</div>',

    // ── Set Chapter ────────────────────────────────────────────────────────
    '<div>',
      '<div style="font-size:0.8rem;font-weight:600;color:#ffcc66;margin-bottom:6px;">Set Story Chapter</div>',
      '<div style="display:flex;gap:6px;align-items:center;">',
        '<input id="adminChapterInput" type="number" min="0" value="0"',
          ' style="width:70px;background:#0a0a1c;border:1px solid rgba(255,160,40,0.4);',
          'border-radius:6px;color:#ffe0a0;padding:5px 8px;font-size:0.82rem;outline:none;">',
        '<select id="adminChapterAcctSel"',
          ' style="flex:1;background:#0a0a1c;border:1px solid rgba(255,160,40,0.4);',
          'border-radius:6px;color:#ffe0a0;padding:5px 8px;font-size:0.78rem;outline:none;">',
          acctOptions,
        '</select>',
        '<button onclick="_adminPanelSetChapter()"',
          ' style="background:rgba(255,160,40,0.15);border:1px solid rgba(255,160,40,0.45);',
          'border-radius:6px;color:#ffcc66;padding:5px 12px;cursor:pointer;font-size:0.8rem;">Apply</button>',
      '</div>',
    '</div>',

    // ── Give All Unlocks ───────────────────────────────────────────────────
    '<div>',
      '<div style="font-size:0.8rem;font-weight:600;color:#ffcc66;margin-bottom:6px;">Give All Unlocks</div>',
      '<div style="display:flex;gap:6px;align-items:center;">',
        '<select id="adminUnlockAcctSel"',
          ' style="flex:1;background:#0a0a1c;border:1px solid rgba(255,160,40,0.4);',
          'border-radius:6px;color:#ffe0a0;padding:5px 8px;font-size:0.78rem;outline:none;">',
          acctOptions,
        '</select>',
        '<button onclick="_adminPanelUnlockAll()"',
          ' style="background:rgba(255,160,40,0.15);border:1px solid rgba(255,160,40,0.45);',
          'border-radius:6px;color:#ffcc66;padding:5px 12px;cursor:pointer;font-size:0.8rem;">Unlock All</button>',
      '</div>',
    '</div>',

    // ── Teleport to Story Fight ────────────────────────────────────────────
    '<div>',
      '<div style="font-size:0.8rem;font-weight:600;color:#ffcc66;margin-bottom:6px;">Teleport to Story Fight</div>',
      '<div style="font-size:0.73rem;opacity:0.5;margin-bottom:5px;">Starts the chapter immediately. Must be on the menu screen.</div>',
      '<div style="display:flex;gap:6px;align-items:center;">',
        '<input id="adminTeleportInput" type="number" min="0" value="0" placeholder="Chapter ID"',
          ' style="width:80px;background:#0a0a1c;border:1px solid rgba(255,160,40,0.4);',
          'border-radius:6px;color:#ffe0a0;padding:5px 8px;font-size:0.82rem;outline:none;">',
        '<button onclick="_adminPanelTeleport()"',
          ' style="background:rgba(255,160,40,0.15);border:1px solid rgba(255,160,40,0.45);',
          'border-radius:6px;color:#ffcc66;padding:5px 12px;cursor:pointer;font-size:0.8rem;">Go</button>',
      '</div>',
    '</div>',

    // ── Reset Account ──────────────────────────────────────────────────────
    '<div>',
      '<div style="font-size:0.8rem;font-weight:600;color:#ffcc66;margin-bottom:6px;">Reset Account Save</div>',
      '<div style="display:flex;gap:6px;align-items:center;">',
        '<select id="adminResetAcctSel"',
          ' style="flex:1;background:#0a0a1c;border:1px solid rgba(255,160,40,0.4);',
          'border-radius:6px;color:#ffe0a0;padding:5px 8px;font-size:0.78rem;outline:none;">',
          acctOptions,
        '</select>',
        '<button onclick="_adminPanelReset()"',
          ' style="background:rgba(180,40,40,0.15);border:1px solid rgba(255,80,80,0.4);',
          'border-radius:6px;color:#ff8888;padding:5px 12px;cursor:pointer;font-size:0.8rem;">Reset</button>',
      '</div>',
    '</div>',

    // ── Delete Account ─────────────────────────────────────────────────────
    '<div>',
      '<div style="font-size:0.8rem;font-weight:600;color:#ffcc66;margin-bottom:6px;">Delete Account</div>',
      '<div style="display:flex;gap:6px;align-items:center;">',
        '<select id="adminDeleteAcctSel"',
          ' style="flex:1;background:#0a0a1c;border:1px solid rgba(255,160,40,0.4);',
          'border-radius:6px;color:#ffe0a0;padding:5px 8px;font-size:0.78rem;outline:none;">',
          acctOptions,
        '</select>',
        '<button onclick="_adminPanelDelete()"',
          ' style="background:rgba(180,0,0,0.2);border:1px solid rgba(255,60,60,0.5);',
          'border-radius:6px;color:#ff6666;padding:5px 12px;cursor:pointer;font-size:0.8rem;">Delete</button>',
      '</div>',
    '</div>',

    // ── Online Controls ────────────────────────────────────────────────────
    '<div style="border-top:1px solid rgba(255,140,0,0.15);padding-top:12px;">',
      '<div style="font-size:0.8rem;font-weight:600;color:#ffcc66;margin-bottom:8px;">Online Controls</div>',

      // Join Any Lobby
      '<div style="margin-bottom:8px;">',
        '<div style="font-size:0.73rem;opacity:0.6;margin-bottom:4px;">Join Any Lobby</div>',
        '<div style="display:flex;gap:6px;">',
          '<input id="adminLobbyInput" placeholder="Lobby ID" maxlength="20"',
            ' style="flex:1;background:#0a0a1c;border:1px solid rgba(255,160,40,0.4);',
            'border-radius:6px;color:#ffe0a0;padding:5px 8px;font-size:0.78rem;outline:none;',
            'text-transform:uppercase;" onkeydown="if(event.key===\'Enter\')_adminPanelJoinLobby()">',
          '<button onclick="_adminPanelJoinLobby()"',
            ' style="background:rgba(255,160,40,0.12);border:1px solid rgba(255,160,40,0.35);',
            'border-radius:6px;color:#ffcc66;padding:5px 10px;cursor:pointer;font-size:0.78rem;">Join</button>',
        '</div>',
      '</div>',

      // Kick Player
      '<div style="margin-bottom:8px;">',
        '<div style="font-size:0.73rem;opacity:0.6;margin-bottom:4px;">Kick Player (by account)</div>',
        '<div style="display:flex;gap:6px;align-items:center;">',
          '<select id="adminKickAcctSel"',
            ' style="flex:1;background:#0a0a1c;border:1px solid rgba(255,160,40,0.4);',
            'border-radius:6px;color:#ffe0a0;padding:5px 8px;font-size:0.78rem;outline:none;">',
            acctOptions,
          '</select>',
          '<button onclick="_adminPanelKick()"',
            ' style="background:rgba(180,40,40,0.18);border:1px solid rgba(255,80,80,0.45);',
            'border-radius:6px;color:#ff9999;padding:5px 10px;cursor:pointer;font-size:0.78rem;">Kick</button>',
        '</div>',
      '</div>',

      // Set Chapter Live
      '<div>',
        '<div style="font-size:0.73rem;opacity:0.6;margin-bottom:4px;">Set Chapter Live (local + remote)</div>',
        '<div style="display:flex;gap:6px;align-items:center;">',
          '<input id="adminLiveChapterInput" type="number" min="0" value="0"',
            ' style="width:64px;background:#0a0a1c;border:1px solid rgba(255,160,40,0.4);',
            'border-radius:6px;color:#ffe0a0;padding:5px 8px;font-size:0.82rem;outline:none;">',
          '<select id="adminLiveChapterAcctSel"',
            ' style="flex:1;background:#0a0a1c;border:1px solid rgba(255,160,40,0.4);',
            'border-radius:6px;color:#ffe0a0;padding:5px 8px;font-size:0.78rem;outline:none;">',
            acctOptions,
          '</select>',
          '<button onclick="_adminPanelSetChapterLive()"',
            ' style="background:rgba(255,160,40,0.12);border:1px solid rgba(255,160,40,0.35);',
            'border-radius:6px;color:#ffcc66;padding:5px 10px;cursor:pointer;font-size:0.78rem;">Set Live</button>',
        '</div>',
      '</div>',
    '</div>',

    // ── Moderation ───────────────────────────────────────────────────────
    '<div style="border-top:1px solid rgba(255,140,0,0.15);padding-top:12px;">',
      '<div style="font-size:0.8rem;font-weight:600;color:#ffcc66;margin-bottom:8px;">Moderation</div>',
      '<div style="display:flex;flex-direction:column;gap:6px;">',
        '<input id="adminBanTargetInput" placeholder="account id / username / slot / peer id" ',
          'style="width:100%;background:#0a0a1c;border:1px solid rgba(255,160,40,0.4);border-radius:6px;color:#ffe0a0;padding:5px 8px;font-size:0.78rem;outline:none;">',
        '<div style="display:flex;gap:6px;align-items:center;">',
          '<input id="adminBanMinutesInput" type="number" min="1" placeholder="min" ',
            'style="width:76px;background:#0a0a1c;border:1px solid rgba(255,160,40,0.4);border-radius:6px;color:#ffe0a0;padding:5px 8px;font-size:0.78rem;outline:none;">',
          '<input id="adminBanReasonInput" placeholder="reason (optional)" ',
            'style="flex:1;background:#0a0a1c;border:1px solid rgba(255,160,40,0.4);border-radius:6px;color:#ffe0a0;padding:5px 8px;font-size:0.78rem;outline:none;">',
        '</div>',
        '<div style="display:flex;gap:6px;flex-wrap:wrap;">',
          '<button onclick="_adminPanelBanPerm()" style="background:rgba(180,40,40,0.16);border:1px solid rgba(255,80,80,0.35);border-radius:6px;color:#ff9999;padding:5px 10px;cursor:pointer;font-size:0.78rem;">Perm Ban</button>',
          '<button onclick="_adminPanelBanTemp()" style="background:rgba(180,40,40,0.12);border:1px solid rgba(255,80,80,0.3);border-radius:6px;color:#ffbbbb;padding:5px 10px;cursor:pointer;font-size:0.78rem;">Temp Ban</button>',
          '<button onclick="_adminPanelBanIp()" style="background:rgba(255,160,40,0.12);border:1px solid rgba(255,160,40,0.35);border-radius:6px;color:#ffcc66;padding:5px 10px;cursor:pointer;font-size:0.78rem;">IP Ban*</button>',
          '<button onclick="_adminPanelUnban()" style="background:rgba(70,160,255,0.12);border:1px solid rgba(70,160,255,0.35);border-radius:6px;color:#88ccff;padding:5px 10px;cursor:pointer;font-size:0.78rem;">Unban</button>',
          '<button onclick="_adminPanelBanList()" style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.16);border-radius:6px;color:#dde4ff;padding:5px 10px;cursor:pointer;font-size:0.78rem;">Ban List</button>',
        '</div>',
        '<div style="font-size:0.68rem;opacity:0.52;">* Browser P2P does not expose real IPs, so this records peer/device identity instead.</div>',
      '</div>',
      '<div style="margin-top:10px;display:flex;flex-direction:column;gap:6px;max-height:180px;overflow:auto;">',
        rosterRows,
      '</div>',
    '</div>',

    // ── Footer hint ────────────────────────────────────────────────────────
    '<div style="font-size:0.7rem;opacity:0.35;text-align:center;padding-top:4px;',
      'border-top:1px solid rgba(255,140,0,0.15);">Press F9 to close</div>',
  ].join('');
}

// ── Panel action handlers ─────────────────────────────────────────────────────

function _adminPanelSetChapter() {
  const id  = (document.getElementById('adminChapterAcctSel') || {}).value || '';
  const ch  = parseInt((document.getElementById('adminChapterInput') || {}).value, 10) || 0;
  if (!id) return;
  setPlayerChapter(id, ch);
  _adminToast('Chapter set to ' + ch);
}

function _adminPanelUnlockAll() {
  const id = (document.getElementById('adminUnlockAcctSel') || {}).value || '';
  if (!id) return;
  unlockAllItems(id);
  _adminToast('All items unlocked');
}

function _adminPanelTeleport() {
  const ch = parseInt((document.getElementById('adminTeleportInput') || {}).value, 10) || 0;
  if (typeof gameRunning !== 'undefined' && gameRunning) {
    _adminToast('Cannot teleport mid-game.', true);
    return;
  }
  if (typeof startStoryFromMenu === 'function') {
    startStoryFromMenu(ch);
    _adminPanelToggle(); // close panel
    _adminToast('Launching chapter ' + ch);
  } else {
    _adminToast('startStoryFromMenu not available', true);
  }
}

function _adminPanelReset() {
  const id = (document.getElementById('adminResetAcctSel') || {}).value || '';
  if (!id) return;
  const acct = _adminGetAcct(id);
  const name = acct ? acct.username : id;
  if (!confirm('Reset all save data for "' + name + '"?\nThis cannot be undone.')) return;
  resetAccount(id);
  _adminPanelRefresh();
  _adminToast('Account reset: ' + name);
}

function _adminPanelDelete() {
  const id = (document.getElementById('adminDeleteAcctSel') || {}).value || '';
  if (!id) return;
  const acct = _adminGetAcct(id);
  const name = acct ? acct.username : id;
  if (!confirm('Permanently delete account "' + name + '"?')) return;
  adminDeleteAccount(id);
  _adminToast('Deleted: ' + name);
}

function _adminPanelJoinLobby() {
  const lid = ((document.getElementById('adminLobbyInput') || {}).value || '').trim();
  if (!lid) { _adminToast('Enter a lobby ID first', true); return; }
  adminJoinAnyLobby(lid);
  _adminToast('Joining lobby: ' + lid);
}

function _adminPanelKick() {
  const id = (document.getElementById('adminKickAcctSel') || {}).value || '';
  if (!id) return;
  const acct = _adminGetAcct(id);
  const name = acct ? acct.username : id;
  adminKickPlayer(id);
  _adminToast('Kick sent: ' + name);
}

function _adminPanelSetChapterLive() {
  const id = (document.getElementById('adminLiveChapterAcctSel') || {}).value || '';
  const ch = parseInt((document.getElementById('adminLiveChapterInput') || {}).value, 10) || 0;
  if (!id) return;
  adminSetChapterLive(id, ch);
  _adminToast('Chapter ' + ch + ' applied live');
}

function _adminPanelReadBanFields() {
  const target = ((document.getElementById('adminBanTargetInput') || {}).value || '').trim();
  const reason = ((document.getElementById('adminBanReasonInput') || {}).value || '').trim();
  const minutesRaw = ((document.getElementById('adminBanMinutesInput') || {}).value || '').trim();
  const minutes = minutesRaw ? parseFloat(minutesRaw) : null;
  return { target: target, reason: reason, minutes: Number.isFinite(minutes) ? minutes : null };
}

function _adminPanelBanTarget(target, tempOnly) {
  const reason = ((document.getElementById('adminBanReasonInput') || {}).value || '').trim();
  const minutesRaw = ((document.getElementById('adminBanMinutesInput') || {}).value || '').trim();
  const minutes = minutesRaw ? parseFloat(minutesRaw) : null;
  if (!target) { _adminToast('Enter a target first', true); return; }
  if (tempOnly) {
    const tempMinutes = Number.isFinite(minutes) ? minutes : 10;
    adminTempBanTarget(target, tempMinutes, reason, { kind: 'mixed' });
    _adminToast('Temp ban issued');
  } else {
    adminBanTarget(target, null, reason, { kind: 'mixed' });
    _adminToast('Permanent ban issued');
  }
}

function _adminPanelBanPerm() {
  const f = _adminPanelReadBanFields();
  if (!f.target) { _adminToast('Enter a target first', true); return; }
  adminBanTarget(f.target, null, f.reason, { kind: 'mixed' });
  _adminToast('Permanent ban issued');
}

function _adminPanelBanTemp() {
  const f = _adminPanelReadBanFields();
  if (!f.target) { _adminToast('Enter a target first', true); return; }
  if (!f.minutes) { _adminToast('Enter minutes for a temp ban', true); return; }
  adminTempBanTarget(f.target, f.minutes, f.reason, { kind: 'mixed' });
  _adminToast('Temp ban issued');
}

function _adminPanelBanIp() {
  const f = _adminPanelReadBanFields();
  if (!f.target) { _adminToast('Enter a target first', true); return; }
  adminBanIp(f.target, f.minutes, f.reason);
  _adminToast('Best-effort IP ban issued');
}

function _adminPanelUnban() {
  const f = _adminPanelReadBanFields();
  if (!f.target) { _adminToast('Enter a target first', true); return; }
  const n = adminUnbanTarget(f.target);
  _adminToast(n ? ('Unbanned ' + n + ' record' + (n === 1 ? '' : 's')) : 'No matching ban', !n);
}

function _adminPanelBanList() {
  adminListBans();
  _adminToast('Ban list written to console');
}

function _adminPanelKickTarget(target) {
  const bundle = _adminResolveBanTarget(target);
  if (!bundle) { _adminToast('Target not found', true); return; }
  if (bundle.slot !== null && bundle.slot !== undefined && window.NetworkManager && typeof NetworkManager.closeSlot === 'function') {
    NetworkManager.closeSlot(bundle.slot, { type: 'banned', reason: 'Kicked by admin.', targetSlot: bundle.slot }, 'kick');
    _adminToast('Kick sent');
    return;
  }
  if (bundle.accountId) {
    adminKickPlayer(bundle.accountId);
    _adminToast('Kick sent');
  } else {
    _adminToast('Kick target not available', true);
  }
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function _adminToast(msg, isError) {
  let t = document.getElementById('adminToast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'adminToast';
    t.style.cssText = [
      'position:fixed','bottom:22px','right:22px',
      'background:rgba(8,8,20,0.96)','color:#ffe0a0',
      'padding:8px 20px','border-radius:8px','font-size:0.8rem',
      'z-index:99999','pointer-events:none','transition:opacity 0.3s',
      'border:1px solid rgba(255,160,40,0.5)',
      "font-family:'Segoe UI',Arial,sans-serif",
    ].join(';');
    document.body.appendChild(t);
  }
  t.textContent  = '[Admin] ' + msg;
  t.style.borderColor = isError ? 'rgba(255,80,80,0.55)' : 'rgba(255,160,40,0.5)';
  t.style.opacity = '1';
  clearTimeout(t._hideTimer);
  t._hideTimer = setTimeout(function() { t.style.opacity = '0'; }, 2600);
}

// ── HTML escape (panel only) ──────────────────────────────────────────────────
function _adminEsc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── F9 keydown listener ───────────────────────────────────────────────────────
document.addEventListener('keydown', function(e) {
  if (e.key === 'F9') {
    e.preventDefault();
    _adminPanelToggle();
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// Ban Screen
// Shown when the active account matches a ban record on this device.
// This protects against shared-device scenarios. Cross-device bans require
// a server backend — browser games have no way to enforce them client-side.
// ═══════════════════════════════════════════════════════════════════════════════

const APPEAL_DISCORD_URL = 'https://discord.gg/JWk3jMFKBP';

function showBanScreen(banRecord) {
  // Remove any existing ban screen first
  const existing = document.getElementById('smbBanScreen');
  if (existing) existing.remove();

  const now = Date.now();
  const isPerm = !banRecord.expiresAt;
  const msLeft = banRecord.expiresAt ? Math.max(0, banRecord.expiresAt - now) : 0;
  const minutesLeft = Math.ceil(msLeft / 60000);
  const hoursLeft = Math.floor(minutesLeft / 60);
  const daysLeft = Math.floor(hoursLeft / 24);

  let durationText;
  if (isPerm) {
    durationText = 'This ban is <strong style="color:#ff4444;">permanent</strong>.';
  } else if (msLeft <= 0) {
    // Expired — don't show the screen
    return;
  } else if (daysLeft >= 1) {
    durationText = 'Expires in <strong style="color:#ffaa44;">' + daysLeft + ' day' + (daysLeft === 1 ? '' : 's') + '</strong>.';
  } else if (hoursLeft >= 1) {
    durationText = 'Expires in <strong style="color:#ffaa44;">' + hoursLeft + ' hour' + (hoursLeft === 1 ? '' : 's') + '</strong>.';
  } else {
    durationText = 'Expires in <strong style="color:#ffaa44;">' + minutesLeft + ' minute' + (minutesLeft === 1 ? '' : 's') + '</strong>.';
  }

  const reason = banRecord.reason ? _adminEsc(banRecord.reason) : 'No reason provided.';
  const bannedBy = banRecord.createdByName ? ' by <strong style="color:#ffaa44;">' + _adminEsc(banRecord.createdByName) + '</strong>' : '';
  const banDate = banRecord.createdAt ? new Date(banRecord.createdAt).toLocaleDateString() : 'unknown date';

  const overlay = document.createElement('div');
  overlay.id = 'smbBanScreen';
  overlay.style.cssText = [
    'position:fixed', 'inset:0', 'z-index:999999',
    'background:radial-gradient(ellipse at center, #1a0008 0%, #080005 60%, #000000 100%)',
    "font-family:'Segoe UI',Arial,sans-serif",
    'display:flex', 'align-items:center', 'justify-content:center',
    'flex-direction:column',
    'overflow:hidden',
  ].join(';');

  overlay.innerHTML = [
    // Animated vignette bars
    '<div style="position:absolute;inset:0;pointer-events:none;overflow:hidden;">',
      '<div style="position:absolute;top:0;left:0;right:0;height:4px;background:linear-gradient(90deg,#ff0000,#aa0000,#ff0000);animation:smbBanPulse 2s infinite;"></div>',
      '<div style="position:absolute;bottom:0;left:0;right:0;height:4px;background:linear-gradient(90deg,#aa0000,#ff0000,#aa0000);animation:smbBanPulse 2s 1s infinite;"></div>',
    '</div>',

    // Main card
    '<div style="position:relative;max-width:min(580px,90vw);width:100%;text-align:center;padding:48px 36px;',
      'background:rgba(20,0,5,0.82);border:1px solid rgba(255,40,40,0.35);border-radius:16px;',
      'box-shadow:0 0 80px rgba(200,0,0,0.25),0 0 20px rgba(255,0,0,0.1) inset;">',

      // Icon
      '<div style="font-size:3.5rem;margin-bottom:12px;filter:drop-shadow(0 0 16px #ff2222);">&#x26D4;</div>',

      // Title
      '<div style="font-size:1.7rem;font-weight:800;letter-spacing:3px;color:#ff3333;',
        'text-shadow:0 0 24px rgba(255,0,0,0.6);margin-bottom:6px;text-transform:uppercase;">',
        'Account Banned',
      '</div>',

      // Subtitle
      '<div style="font-size:0.82rem;color:rgba(255,150,150,0.5);letter-spacing:2px;margin-bottom:32px;text-transform:uppercase;">',
        'Access to Stickman Clash has been restricted',
      '</div>',

      // Reason card
      '<div style="background:rgba(255,30,30,0.07);border:1px solid rgba(255,60,60,0.25);border-radius:10px;',
        'padding:18px 22px;margin-bottom:18px;text-align:left;">',
        '<div style="font-size:0.68rem;color:rgba(255,120,120,0.55);letter-spacing:2px;text-transform:uppercase;margin-bottom:6px;">Reason</div>',
        '<div style="font-size:0.92rem;color:#ffcccc;">' + reason + '</div>',
      '</div>',

      // Duration + Issued
      '<div style="display:flex;gap:12px;margin-bottom:28px;">',
        '<div style="flex:1;background:rgba(255,30,30,0.05);border:1px solid rgba(255,60,60,0.2);border-radius:10px;padding:14px 16px;text-align:left;">',
          '<div style="font-size:0.65rem;color:rgba(255,120,120,0.5);letter-spacing:2px;text-transform:uppercase;margin-bottom:5px;">Duration</div>',
          '<div style="font-size:0.85rem;color:#ffbbbb;">' + durationText + '</div>',
        '</div>',
        '<div style="flex:1;background:rgba(255,30,30,0.05);border:1px solid rgba(255,60,60,0.2);border-radius:10px;padding:14px 16px;text-align:left;">',
          '<div style="font-size:0.65rem;color:rgba(255,120,120,0.5);letter-spacing:2px;text-transform:uppercase;margin-bottom:5px;">Issued</div>',
          '<div style="font-size:0.85rem;color:#ffbbbb;">' + banDate + bannedBy + '</div>',
        '</div>',
      '</div>',

      // Appeal section
      '<div style="background:rgba(80,60,20,0.18);border:1px solid rgba(255,180,40,0.25);border-radius:10px;padding:16px 22px;margin-bottom:24px;text-align:left;">',
        '<div style="font-size:0.68rem;color:rgba(255,200,80,0.55);letter-spacing:2px;text-transform:uppercase;margin-bottom:6px;">Think this is a mistake?</div>',
        '<div style="font-size:0.82rem;color:rgba(255,220,140,0.8);margin-bottom:12px;">',
          'You can appeal your ban in the official Stickman Clash Discord server.',
          ' Join the <strong>#ban-appeals</strong> channel and provide your account ID.',
        '</div>',
        '<a href="' + APPEAL_DISCORD_URL + '" target="_blank" rel="noopener" ',
          'style="display:inline-flex;align-items:center;gap:8px;',
          'background:rgba(88,101,242,0.22);border:1px solid rgba(88,101,242,0.55);border-radius:8px;',
          'color:#b9bfff;padding:9px 18px;font-size:0.82rem;font-weight:600;',
          'text-decoration:none;cursor:pointer;transition:background 0.2s;" ',
          'onmouseover="this.style.background=\'rgba(88,101,242,0.38)\'" ',
          'onmouseout="this.style.background=\'rgba(88,101,242,0.22)\'">',
          // Discord icon (SVG)
          '<svg width="18" height="14" viewBox="0 0 18 14" fill="none" xmlns="http://www.w3.org/2000/svg">',
            '<path d="M15.247 1.15A14.56 14.56 0 0 0 11.67 0c-.16.29-.35.68-.48.99a13.4 13.4 0 0 0-4.37 0C6.67.68 6.47.29 6.31 0a14.52 14.52 0 0 0-3.58 1.15C.39 4.7-.24 8.15.075 11.55a14.76 14.76 0 0 0 4.55 2.33c.37-.5.7-1.04.98-1.6a9.54 9.54 0 0 1-1.54-.75c.13-.1.25-.2.37-.3a10.5 10.5 0 0 0 9.08 0c.12.1.24.2.37.3a9.54 9.54 0 0 1-1.54.75c.28.56.61 1.1.98 1.6a14.7 14.7 0 0 0 4.55-2.33C18.23 8.15 17.61 4.7 15.25 1.15ZM6 9.46c-.95 0-1.72-.88-1.72-1.96 0-1.08.76-1.97 1.72-1.97.96 0 1.73.88 1.72 1.97 0 1.08-.76 1.96-1.72 1.96Zm6 0c-.95 0-1.72-.88-1.72-1.96 0-1.08.76-1.97 1.72-1.97.96 0 1.73.88 1.72 1.97 0 1.08-.76 1.96-1.72 1.96Z" fill="currentColor"/>',
          '</svg>',
          'Appeal on Discord',
        '</a>',
      '</div>',

      // Account ID (for appeal reference)
      (function() {
        const acct = (window.AccountManager && AccountManager.getActiveAccount) ? AccountManager.getActiveAccount() : null;
        if (!acct) return '';
        return [
          '<div style="font-size:0.68rem;color:rgba(255,255,255,0.18);margin-bottom:6px;">',
            'Your account ID (include this in your appeal): ',
            '<code style="color:rgba(255,255,255,0.35);user-select:all;">' + _adminEsc(acct.id) + '</code>',
          '</div>',
        ].join('');
      })(),

    '</div>',

    // CSS keyframe animation (injected once)
    '<style id="smbBanScreenStyles">',
      '@keyframes smbBanPulse { 0%,100%{opacity:1} 50%{opacity:0.35} }',
    '</style>',
  ].join('');

  document.body.appendChild(overlay);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Server Sync — REST helpers
// All functions are async and fail gracefully when the server is unreachable.
// ═══════════════════════════════════════════════════════════════════════════════

function _syncServerUrl() {
  return (typeof SERVER_CONFIG !== 'undefined' && SERVER_CONFIG.url)
    ? String(SERVER_CONFIG.url).replace(/\/$/, '')
    : null;
}

function _syncAdminKey() {
  return (typeof SERVER_CONFIG !== 'undefined') ? (SERVER_CONFIG.adminKey || '') : '';
}

// Generic fetch wrapper. Returns parsed JSON or null on any failure.
async function _serverFetch(method, endpoint, body) {
  const base = _syncServerUrl();
  if (!base) return null; // server not configured — offline mode

  const headers = { 'Content-Type': 'application/json' };
  const key = _syncAdminKey();
  if (key) headers['X-Admin-Key'] = key;

  const opts = { method: method, headers: headers };
  if (body !== undefined) opts.body = JSON.stringify(body);

  try {
    const res = await fetch(base + endpoint, opts);
    if (!res.ok) {
      console.warn('[ServerSync] ' + method + ' ' + endpoint + ' → HTTP ' + res.status);
      return null;
    }
    return await res.json();
  } catch (e) {
    // Network error / server down — silently degrade to offline mode
    console.warn('[ServerSync] Unreachable (' + (e.message || e) + ')');
    return null;
  }
}

// Push a single ban record to the server.
async function _serverPostBan(key, record) {
  return _serverFetch('POST', '/api/bans', { key, record });
}

// Delete a single ban by key from the server.
async function _serverDeleteBan(key) {
  return _serverFetch('DELETE', '/api/bans/' + encodeURIComponent(key));
}

// Fetch all active bans from the server and merge them into local GameState.
// New server records are added locally; existing local records are left alone.
// Returns the number of newly imported records.
async function syncBansFromServer() {
  const data = await _serverFetch('GET', '/api/bans');
  if (!data || typeof data.records !== 'object') return 0;

  const now = Date.now();
  let added = 0;

  GameState.update(function(s) {
    if (!s.persistent.admin)               s.persistent.admin               = { overrides: {}, bans: { records: {} } };
    if (!s.persistent.admin.bans)          s.persistent.admin.bans          = { records: {} };
    if (!s.persistent.admin.bans.records)  s.persistent.admin.bans.records  = {};
    const local = s.persistent.admin.bans.records;
    for (const [key, rec] of Object.entries(data.records)) {
      if (!rec) continue;
      if (rec.expiresAt && rec.expiresAt <= now) continue; // skip expired
      if (!local[key]) {
        local[key] = rec;
        added++;
      }
    }
  });

  if (added > 0) {
    GameState.save();
    console.log('[ServerSync] Imported ' + added + ' ban(s) from server.');
  }
  return added;
}

// Ask the server directly whether the given identity is banned.
// Fastest path for the ban screen — does not depend on the local cache.
// Returns a BanRecord or null.
async function checkBanOnServer(identity) {
  if (!_syncServerUrl()) return null;
  try {
    const params = new URLSearchParams();
    if (identity.accountId) params.set('accountId', identity.accountId);
    if (identity.peerId)    params.set('peerId',    identity.peerId);
    if (identity.deviceId)  params.set('deviceId',  identity.deviceId);
    if (identity.username)  params.set('username',  identity.username);
    const res = await fetch(_syncServerUrl() + '/api/bans/check?' + params.toString());
    if (!res.ok) return null;
    const data = await res.json();
    return (data.banned && data.record) ? data.record : null;
  } catch (_) {
    return null;
  }
}

// ── Ban screen entry point (server-aware) ─────────────────────────────────────

async function checkAndShowBanScreen() {
  if (typeof AccountManager === 'undefined' || typeof isConnectionBanned !== 'function') return;
  if (document.getElementById('smbBanScreen')) return; // already showing

  const acct = AccountManager.getActiveAccount();
  if (!acct) return;

  const identity = {
    accountId: acct.id,
    username:  acct.username || '',
  };

  // 1. Ask the server directly — most authoritative, works cross-device.
  const serverRecord = await checkBanOnServer(identity);
  if (serverRecord) {
    showBanScreen(serverRecord);
    return;
  }

  // 2. Fall back to local ban records (covers same-device bans when offline).
  const localRecord = isConnectionBanned(identity);
  if (localRecord) showBanScreen(localRecord);
}

// ── Startup: sync + check once all scripts have loaded ───────────────────────

let _syncInterval = null;

window.addEventListener('load', function() {
  // Short delay so AccountManager / GameState finish any synchronous init.
  setTimeout(async function() {
    // Pull server bans into local cache first (so local check also catches them).
    await syncBansFromServer();
    // Then check whether the active account is banned.
    await checkAndShowBanScreen();
    // Schedule periodic background re-sync while the tab is open.
    const interval = (typeof SERVER_CONFIG !== 'undefined' && SERVER_CONFIG.syncIntervalMs > 0)
      ? SERVER_CONFIG.syncIntervalMs
      : 0;
    if (interval > 0 && _syncInterval === null) {
      _syncInterval = setInterval(syncBansFromServer, interval);
    }
  }, 200);
});
