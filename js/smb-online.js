// smb-online.js — Lobby presence layer
//
// Sits ON TOP of the existing NetworkManager (smb-network.js).
// NetworkManager owns the WebRTC connections and gameplay sync.
// LobbyManager owns lobby metadata, the player roster, and the
// simulated-server advertisement stored in localStorage.
//
// Load order: after smb-network.js, before smb-save.js.
'use strict';

// ── Constants ─────────────────────────────────────────────────────────────────
const _LOB_KEY_PREFIX   = 'smblob_';      // localStorage key prefix for lobby ads
const _LOB_TTL_MS       = 90000;          // non-persistent lobbies expire after 90 s
const _LOB_ADV_HZ       = 20000;          // re-advertise every 20 s while hosting
const _PUBLIC_LOBBY_ID  = 'PUBLIC_SERVER'; // well-known ID for the persistent lobby

// ── LobbyManager ──────────────────────────────────────────────────────────────
const LobbyManager = (() => {

  // { id, players, maxPlayers, isPrivate, persistent? } — null when not in a lobby
  let _current   = null;
  let _advTimer  = null;
  let _localName = 'Player';

  // ── Private helpers ───────────────────────────────────────────────────────────

  function _playerName() {
    if (window.AccountManager) {
      const a = AccountManager.getActiveAccount();
      if (a) return a.username;
    }
    return _localName;
  }

  function _genId() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let id = '';
    for (let i = 0; i < 6; i++) id += chars[Math.floor(Math.random() * chars.length)];
    return id;
  }

  // Write a public-server record that can never expire.
  function _writePublicLobby(players) {
    try {
      localStorage.setItem(
        _LOB_KEY_PREFIX + _PUBLIC_LOBBY_ID,
        JSON.stringify({
          id:         _PUBLIC_LOBBY_ID,
          label:      'Public Server',
          players:    players || [],
          maxPlayers: 10,
          isPrivate:  false,
          persistent: true,    // ← never expires, never deleted
          ts:         Date.now(),
        })
      );
    } catch(e) {}
  }

  // Create the persistent lobby record on startup (idempotent).
  function _initPublicLobby() {
    const existing = localStorage.getItem(_LOB_KEY_PREFIX + _PUBLIC_LOBBY_ID);
    if (!existing) _writePublicLobby([]);
    // Always refresh the timestamp so it is never reaped by a stale-key cleanup.
    else {
      try {
        const d = JSON.parse(existing);
        d.ts = Date.now();
        d.persistent = true;
        localStorage.setItem(_LOB_KEY_PREFIX + _PUBLIC_LOBBY_ID, JSON.stringify(d));
      } catch(e) { _writePublicLobby([]); }
    }
  }

  // Write a regular (non-persistent) lobby ad.
  function _advertise() {
    if (!_current) return;
    try {
      localStorage.setItem(
        _LOB_KEY_PREFIX + _current.id,
        JSON.stringify(Object.assign({}, _current, { ts: Date.now() }))
      );
    } catch(e) {}
  }

  // Remove the lobby ad — EXCEPT for the persistent public lobby.
  function _unadvertise() {
    if (!_current) return;
    if (_current.id === _PUBLIC_LOBBY_ID) {
      // Public lobby persists: reset to empty instead of removing.
      _writePublicLobby([]);
    } else {
      try { localStorage.removeItem(_LOB_KEY_PREFIX + _current.id); } catch(e) {}
    }
    clearInterval(_advTimer);
    _advTimer = null;
  }

  function _slotCount() {
    if (window.NetworkManager && typeof NetworkManager.getSlotCount === 'function') {
      return NetworkManager.getSlotCount();
    }
    return _current ? _current.players.length : 0;
  }

  function _makeLobby(id, maxPlayers, isPrivate, persistent) {
    return {
      id,
      label:      persistent ? 'Public Server' : id,
      players:    [{ slot: 0, name: _playerName() }],
      maxPlayers: Math.min(10, Math.max(2, maxPlayers || 2)),
      isPrivate:  !!isPrivate,
      persistent: !!persistent,
    };
  }

  // ── createLobby ──────────────────────────────────────────────────────────────
  // opts: { maxPlayers?, isPrivate?, id? }
  function createLobby(opts) {
    opts = opts || {};
    const id = (opts.id ? String(opts.id).toUpperCase().trim() : '') || _genId();

    if (_current) leaveLobby();

    _current = _makeLobby(id, opts.maxPlayers || 2, opts.isPrivate || false, false);

    GameState.update(s => { s.session.online.lobbyId = id; s.session.online.role = 'host'; s.session.online.connected = true; });

    _advertise();
    clearInterval(_advTimer);
    _advTimer = setInterval(function() {
      if (_current) {
        const count = _slotCount();
        while (_current.players.length < count) {
          _current.players.push({ slot: _current.players.length, name: 'Player ' + (_current.players.length + 1) });
        }
        _advertise();
      }
    }, _LOB_ADV_HZ);

    if (window.NetworkManager && typeof NetworkManager.connect === 'function') {
      NetworkManager.connect(id, _current.maxPlayers).then(function() {
        _lobbyUiRefresh();
      }).catch(function(e) {
        console.warn('[Lobby] NetworkManager.connect failed:', e);
        leaveLobby();
      });
    }

    _lobbyUiRefresh();
    return _current;
  }

  // ── joinLobby ─────────────────────────────────────────────────────────────────
  function joinLobby(id) {
    if (!id) { console.warn('[Lobby] joinLobby: id required'); return null; }
    id = String(id).toUpperCase().trim();

    if (_current) leaveLobby();

    let meta = null;
    try {
      const raw = localStorage.getItem(_LOB_KEY_PREFIX + id);
      if (raw) meta = JSON.parse(raw);
    } catch(e) {}

    const isPub = (id === _PUBLIC_LOBBY_ID);

    _current = {
      id,
      label:      meta ? (meta.label || id) : id,
      // Don't pre-populate a fake "Host" entry — we don't know if anyone is there yet.
      // The real player count comes from NetworkManager once the connection resolves.
      players:    meta ? meta.players.slice() : [],
      maxPlayers: meta ? meta.maxPlayers : (isPub ? 10 : 2),
      isPrivate:  meta ? !!meta.isPrivate : false,
      persistent: isPub,
    };
    // Add ourselves (slot unknown until slotAssign — use 0 as placeholder)
    _current.players.push({ slot: 0, name: _playerName() });

    GameState.update(s => { s.session.online.lobbyId = id; s.session.online.role = 'guest'; s.session.online.connected = true; });

    if (window.NetworkManager && typeof NetworkManager.connect === 'function') {
      NetworkManager.connect(id, _current.maxPlayers).then(function() {
        // After connection resolves we know our actual role (host vs guest)
        const role = (NetworkManager.isHost && NetworkManager.isHost()) ? 'host' : 'guest';
        GameState.update(function(s) { s.session.online.role = role; });
        // Fix slot assignment for the local player entry
        if (_current && _current.players.length > 0) {
          _current.players[0].slot = NetworkManager.getLocalSlot ? NetworkManager.getLocalSlot() : 0;
        }
        _lobbyUiRefresh();
      }).catch(function(e) {
        console.warn('[Lobby] Join failed:', e);
        leaveLobby();
      });
    }

    _lobbyUiRefresh();
    return _current;
  }

  // ── joinPublicLobby ───────────────────────────────────────────────────────────
  // Convenience shortcut — always joins the well-known public server.
  function joinPublicLobby() {
    return joinLobby(_PUBLIC_LOBBY_ID);
  }

  // ── leaveLobby ────────────────────────────────────────────────────────────────
  function leaveLobby() {
    _unadvertise();           // public lobby: resets to empty; others: removed
    if (window.NetworkManager && typeof NetworkManager.disconnect === 'function') {
      NetworkManager.disconnect();
    }
    _current = null;
    GameState.update(s => { s.session.online.lobbyId = null; s.session.online.role = null; s.session.online.connected = false; });
    _lobbyUiRefresh();
  }

  // ── getCurrentLobby ───────────────────────────────────────────────────────────
  function getCurrentLobby() {
    if (!_current) return null;
    const count = _slotCount();
    const players = _current.players.slice();
    while (players.length < count) {
      players.push({ slot: players.length, name: 'Player ' + (players.length + 1) });
    }
    return {
      id:         _current.id,
      label:      _current.label,
      players,
      maxPlayers: _current.maxPlayers,
      isPrivate:  _current.isPrivate,
      persistent: _current.persistent,
    };
  }

  // ── listLobbies ───────────────────────────────────────────────────────────────
  // Persistent lobbies are never expired and always appear first.
  function listLobbies() {
    const now      = Date.now();
    const persists = [];
    const regular  = [];

    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k || !k.startsWith(_LOB_KEY_PREFIX)) continue;
        const raw = localStorage.getItem(k);
        if (!raw) continue;
        let lob;
        try { lob = JSON.parse(raw); } catch(e) { continue; }
        if (!lob || !lob.id) continue;

        if (lob.persistent) {
          // Refresh timestamp so it is never accidentally cleaned up.
          lob.ts = Date.now();
          persists.push(lob);
          continue;
        }

        if (now - lob.ts > _LOB_TTL_MS) { localStorage.removeItem(k); continue; }
        if (lob.isPrivate) continue;
        regular.push(lob);
      }
    } catch(e) {}

    regular.sort(function(a, b) { return b.ts - a.ts; });
    return persists.concat(regular);
  }

  // Boot: ensure the public lobby always exists in localStorage.
  _initPublicLobby();

  return {
    createLobby,
    joinLobby,
    joinPublicLobby,
    leaveLobby,
    getCurrentLobby,
    listLobbies,
  };
})();

// ══════════════════════════════════════════════════════════════════════════════
// Lobby UI
// ══════════════════════════════════════════════════════════════════════════════

function _lobbyUiRefresh() {
  const wrap = document.getElementById('lobbySection');
  if (!wrap) return;

  const lob    = LobbyManager.getCurrentLobby();
  const isConn = window.NetworkManager && typeof NetworkManager.isConnected === 'function' && NetworkManager.isConnected();
  const isHost = window.NetworkManager && typeof NetworkManager.isHost === 'function'      && NetworkManager.isHost();
  const inPub  = lob && lob.id === _PUBLIC_LOBBY_ID;

  // ── Public Server button ────────────────────────────────────────────────────
  const pubBtn = document.getElementById('lobbyBtnPublic');
  if (pubBtn) {
    if (inPub) {
      pubBtn.textContent      = '✓ In Public Server';
      pubBtn.style.background = 'rgba(0,200,80,0.18)';
      pubBtn.style.borderColor = 'rgba(0,255,100,0.5)';
      pubBtn.style.color      = '#afffca';
      pubBtn.style.opacity    = '0.7';
      pubBtn.style.cursor     = 'default';
      pubBtn.onclick          = null;
    } else {
      pubBtn.textContent      = '🌐 Public Server';
      pubBtn.style.background = 'rgba(0,160,255,0.15)';
      pubBtn.style.borderColor = 'rgba(0,200,255,0.5)';
      pubBtn.style.color      = '#88eeff';
      pubBtn.style.opacity    = '1';
      pubBtn.style.cursor     = 'pointer';
      pubBtn.onclick          = function() { LobbyManager.joinPublicLobby(); };
    }
  }

  // ── Status bar ──────────────────────────────────────────────────────────────
  const statusEl = document.getElementById('lobbyStatus');
  if (statusEl) {
    if (lob) {
      const role  = isHost ? 'Hosting' : 'Joined';
      const label = lob.persistent ? 'Public Server' : lob.id;
      statusEl.textContent = role + ' \u2022 ' + label + ' \u2022 ' + lob.players.length + '/' + lob.maxPlayers + ' players';
      statusEl.style.color = isHost ? '#88ffaa' : (inPub ? '#88eeff' : '#88ccff');
    } else {
      statusEl.textContent = 'Not in a lobby';
      statusEl.style.color = 'rgba(180,200,255,0.45)';
    }
  }

  // ── Player roster ───────────────────────────────────────────────────────────
  const roster = document.getElementById('lobbyRoster');
  if (roster) {
    if (lob && lob.players.length) {
      roster.style.display = 'flex';
      roster.innerHTML = lob.players.map(function(p, i) {
        const isLocal = window.NetworkManager
          && typeof NetworkManager.getLocalSlot === 'function'
          && NetworkManager.getLocalSlot() === p.slot;
        return [
          '<span style="font-size:0.72rem;padding:2px 7px;border-radius:4px;',
            'background:rgba(255,255,255,0.06);border:1px solid rgba(',
            isLocal ? '100,255,200,0.55' : '100,180,255,0.2',
            ');color:', isLocal ? '#88ffcc' : '#aac', ';">',
            (i === 0 ? '\u2605 ' : ''),
            _lobEsc(p.name || ('P' + (p.slot + 1))),
          '</span>',
        ].join('');
      }).join('');
    } else {
      roster.style.display = 'none';
      roster.innerHTML = '';
    }
  }

  // ── Show/hide controls based on lobby state ─────────────────────────────────
  const btnCreate  = document.getElementById('lobbyBtnCreate');
  const joinRow    = document.getElementById('lobbyJoinRow');
  const btnLeave   = document.getElementById('lobbyBtnLeave');
  const listWrap   = document.getElementById('lobbyListWrap');
  const maxSel     = document.getElementById('lobbyMaxSel');
  const privWrap   = document.getElementById('lobbyPrivChkWrap');

  if (btnCreate) btnCreate.style.display = lob ? 'none' : 'inline-block';
  if (joinRow)   joinRow.style.display   = lob ? 'none' : 'flex';
  if (listWrap)  listWrap.style.display  = lob ? 'none' : 'flex';
  if (maxSel)    maxSel.style.display    = lob ? 'none' : 'inline-block';
  if (privWrap)  privWrap.style.display  = lob ? 'none' : 'flex';
  // Leave button shown whenever in any lobby.
  if (btnLeave) btnLeave.style.display   = lob ? 'inline-block' : 'none';
}

function _lobbyRefreshList() {
  const list = document.getElementById('lobbyList');
  if (!list) return;

  const lobbies = LobbyManager.listLobbies();
  list.innerHTML = '';

  if (!lobbies.length) {
    list.innerHTML = '<span style="color:rgba(150,170,220,0.45);font-size:0.72rem;">No open lobbies found.</span>';
    return;
  }

  lobbies.forEach(function(lob) {
    const isPub = lob.persistent;
    const row   = document.createElement('div');
    row.style.cssText = [
      'display:flex','align-items:center','gap:6px',
      'padding:4px 6px','border-radius:5px','margin:1px 0',
      'background:' + (isPub ? 'rgba(0,160,255,0.08)' : 'rgba(255,255,255,0.03)'),
      'border:1px solid ' + (isPub ? 'rgba(0,200,255,0.3)' : 'rgba(100,180,255,0.12)'),
    ].join(';');

    const label = isPub
      ? '<span style="font-size:0.72rem;color:#88eeff;flex:1;">' +
          '&#127760; Public Server' +
          '<span style="font-size:0.65rem;opacity:0.55;margin-left:5px;">' +
            '(' + lob.players.length + '/' + lob.maxPlayers + ')</span>' +
        '</span>'
      : '<span style="font-size:0.72rem;color:#aac;flex:1;">' +
          _lobEsc(lob.id) +
          '<span style="font-size:0.65rem;opacity:0.5;margin-left:5px;">' +
            '(' + lob.players.length + '/' + lob.maxPlayers + ')</span>' +
        '</span>';

    const joinBtn = document.createElement('button');
    joinBtn.className = 'btn';
    joinBtn.style.cssText = [
      'font-size:0.68rem','padding:2px 8px',
      isPub ? 'color:#88eeff;border-color:rgba(0,200,255,0.4)' : '',
    ].join(';');
    joinBtn.textContent = 'Join';
    joinBtn.onclick = function() { LobbyManager.joinLobby(lob.id); };

    row.innerHTML = label;
    row.appendChild(joinBtn);
    list.appendChild(row);
  });
}

// ── Public functions called from button onclicks ──────────────────────────────

function lobbyCreate() {
  const maxSel  = document.getElementById('lobbyMaxSel');
  const privChk = document.getElementById('lobbyPrivChk');
  const max     = maxSel  ? (parseInt(maxSel.value) || 2) : 2;
  const priv    = privChk ? privChk.checked : false;
  LobbyManager.createLobby({ maxPlayers: max, isPrivate: priv });
}

function lobbyJoin() {
  const inp = document.getElementById('lobbyJoinInput');
  const id  = inp ? inp.value.trim() : '';
  if (!id) { _lobbyToast('Enter a lobby code first', true); return; }
  LobbyManager.joinLobby(id);
}

function lobbyLeave() {
  LobbyManager.leaveLobby();
}

// ── Inject lobby section into #onlinePanel ────────────────────────────────────
function _lobbyInjectUI() {
  const panel = document.getElementById('onlinePanel');
  if (!panel || document.getElementById('lobbySection')) return;

  const sec = document.createElement('div');
  sec.id = 'lobbySection';
  sec.style.cssText = [
    'display:flex','flex-direction:column','gap:7px',
    'padding-bottom:10px','margin-bottom:4px',
    'border-bottom:1px solid rgba(100,180,255,0.2)',
  ].join(';');

  sec.innerHTML = [
    // ── Header row ────────────────────────────────────────────────────────────
    '<div style="display:flex;align-items:center;justify-content:space-between;">',
      '<span style="font-size:0.78rem;font-weight:700;color:#88ccff;letter-spacing:0.5px;">',
        '&#127760; Lobby',
      '</span>',
      '<button class="btn" onclick="_lobbyRefreshList();_lobbyUiRefresh()" ',
        'style="font-size:0.65rem;padding:2px 8px;opacity:0.7;">Refresh</button>',
    '</div>',

    // ── Public Server button — always visible ─────────────────────────────────
    '<button id="lobbyBtnPublic" class="btn" ',
      'style="font-size:0.78rem;padding:6px 14px;font-weight:600;',
      'background:rgba(0,160,255,0.15);border-color:rgba(0,200,255,0.5);color:#88eeff;" ',
      'onclick="LobbyManager.joinPublicLobby()">',
      '&#127760; Public Server',
    '</button>',

    // ── Status ────────────────────────────────────────────────────────────────
    '<div id="lobbyStatus" style="font-size:0.72rem;color:rgba(180,200,255,0.45);">Not in a lobby</div>',

    // ── Player roster ─────────────────────────────────────────────────────────
    '<div id="lobbyRoster" style="display:none;flex-wrap:wrap;gap:4px;"></div>',

    // ── Create row ────────────────────────────────────────────────────────────
    '<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">',
      '<select id="lobbyMaxSel" ',
        'style="background:#0d0d22;color:#cce;border:1px solid rgba(100,180,255,0.35);',
        'border-radius:5px;padding:3px 6px;font-size:0.72rem;">',
        '<option value="2">2 players</option>',
        '<option value="3">3 players</option>',
        '<option value="4">4 players</option>',
        '<option value="6">6 players</option>',
        '<option value="8">8 players</option>',
        '<option value="10">10 players</option>',
      '</select>',
      '<label id="lobbyPrivChkWrap" ',
        'style="display:flex;align-items:center;gap:4px;font-size:0.72rem;color:#aac;cursor:pointer;">',
        '<input type="checkbox" id="lobbyPrivChk" style="cursor:pointer;">',
        'Private',
      '</label>',
      '<button id="lobbyBtnCreate" class="btn" onclick="lobbyCreate()" ',
        'style="font-size:0.75rem;padding:4px 12px;',
        'background:rgba(0,200,80,0.15);border-color:rgba(0,255,100,0.4);color:#afffca;">',
        '+ Create Lobby',
      '</button>',
      '<button id="lobbyBtnLeave" class="btn" onclick="lobbyLeave()" ',
        'style="display:none;font-size:0.75rem;padding:4px 12px;',
        'background:rgba(255,80,80,0.12);border-color:rgba(255,80,80,0.4);color:#ff9999;">',
        'Leave Lobby',
      '</button>',
    '</div>',

    // ── Join row ──────────────────────────────────────────────────────────────
    '<div id="lobbyJoinRow" style="display:flex;gap:6px;align-items:center;">',
      '<input id="lobbyJoinInput" type="text" maxlength="10" placeholder="Lobby code" ',
        'style="flex:1;padding:4px 7px;background:rgba(0,0,0,0.4);',
        'border:1px solid rgba(100,180,255,0.4);border-radius:5px;',
        'color:#cce;font-size:0.75rem;text-transform:uppercase;" ',
        'onkeydown="if(event.key===\'Enter\')lobbyJoin();">',
      '<button class="btn" onclick="lobbyJoin()" ',
        'style="font-size:0.75rem;padding:4px 12px;">Join</button>',
    '</div>',

    // ── Lobby browser ─────────────────────────────────────────────────────────
    '<div id="lobbyListWrap" style="display:flex;flex-direction:column;gap:3px;">',
      '<div style="font-size:0.7rem;color:rgba(150,180,240,0.5);">Open lobbies</div>',
      '<div id="lobbyList" style="max-height:100px;overflow-y:auto;',
        'background:rgba(0,0,0,0.25);border-radius:5px;padding:4px;">',
        '<span style="color:rgba(150,170,220,0.45);font-size:0.72rem;">Loading…</span>',
      '</div>',
    '</div>',
  ].join('');

  panel.insertBefore(sec, panel.firstChild);

  _lobbyRefreshList();
  _lobbyUiRefresh();
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function _lobbyToast(msg, isError) {
  let t = document.getElementById('lobbyToast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'lobbyToast';
    t.style.cssText = [
      'position:fixed','bottom:56px','left:50%','transform:translateX(-50%)',
      'background:rgba(5,5,20,0.94)','color:#dde4ff',
      'padding:8px 20px','border-radius:8px','font-size:0.8rem',
      'z-index:99999','pointer-events:none','transition:opacity 0.3s',
      'border:1px solid rgba(100,180,255,0.4)',
      "font-family:'Segoe UI',Arial,sans-serif",
    ].join(';');
    document.body.appendChild(t);
  }
  t.textContent       = msg;
  t.style.borderColor = isError ? 'rgba(255,80,80,0.5)' : 'rgba(100,180,255,0.4)';
  t.style.opacity     = '1';
  clearTimeout(t._hideTimer);
  t._hideTimer = setTimeout(function() { t.style.opacity = '0'; }, 2400);
}

// ── HTML escape ───────────────────────────────────────────────────────────────
function _lobEsc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Boot ──────────────────────────────────────────────────────────────────────
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', _lobbyInjectUI);
} else {
  _lobbyInjectUI();
}

// Patch selectMode so the lobby list refreshes when the Online panel opens.
(function() {
  const _orig = window.selectMode;
  if (typeof _orig === 'function') {
    window.selectMode = function(mode) {
      _orig(mode);
      if (mode === 'online') {
        _lobbyRefreshList();
        _lobbyUiRefresh();
      }
    };
  }
})();
