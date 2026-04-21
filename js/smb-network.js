'use strict';

// ============================================================
// NETWORK MANAGER — WebRTC peer-to-peer via PeerJS
// Star topology: all guests connect to HOST.
// HOST: registers named PeerID "smcgame-<ROOMCODE>", manages up to 9 guests.
// GUESTS: connect to host, receive slot assignment (1-9).
// HOST relays all player states to all guests each tick.
// Supports up to 10 players total (slots 0-9, slot 0 = HOST).
// ============================================================
const NetworkManager = (() => {
  let _peer = null;
  let _connections = []; // all active DataConnections (host: N guests; guest: 1 to host)
  let _slotConnections = {}; // slot -> DataConnection
  let _slotMeta = {}; // slot -> identity/roster metadata
  let _localSlot = 0;
  let _isHost = false;
  let _roomCode = '';
  let _maxPlayers = 10;
  let _remoteStates = {}; // slot -> latest state obj
  let _stateBuffers = {}; // slot -> [{state, ts}]
  const INTERP_DELAY = 130;
  const SEND_HZ = 20;
  let _sendTimer = 0;
  let _roomType = 'public';
  let _connected = false;
  let _slotCount = 1; // active player count including host
  let _nextGuestSlot = 1; // next unique guest slot number to assign
  let _pingTimers = {};
  let _latencies = {};
  let _ownDeviceId = null;
  let _forcedCloseSlots = {}; // slot -> reason key used to suppress win popups
  let _disconnectReason = null;

  function _log(msg) { console.log('[Net]', msg); }

  function _ensureDeviceId() {
    if (_ownDeviceId) return _ownDeviceId;
    const key = 'smb_device_id';
    try {
      let id = localStorage.getItem(key);
      if (!id) {
        id = 'dev_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
        localStorage.setItem(key, id);
      }
      _ownDeviceId = id;
    } catch (e) {
      _ownDeviceId = 'dev_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
    }
    return _ownDeviceId;
  }

  function _cloneIdentity(data) {
    return data ? {
      slot: data.slot,
      peerId: data.peerId || null,
      accountId: data.accountId || null,
      username: data.username || null,
      deviceId: data.deviceId || null,
      role: data.role || null,
      connectedAt: data.connectedAt || null,
      lastSeen: data.lastSeen || null,
    } : null;
  }

  function _getLocalIdentity() {
    const acct = (typeof AccountManager !== 'undefined' && AccountManager.getActiveAccount)
      ? AccountManager.getActiveAccount()
      : null;
    return {
      slot: _localSlot,
      peerId: (_peer && _peer.id) ? _peer.id : null,
      accountId: acct ? acct.id : null,
      username: acct ? acct.username : null,
      deviceId: _ensureDeviceId(),
      role: acct ? acct.role : null,
    };
  }

  function _setSlotMeta(slot, data) {
    _slotMeta[slot] = Object.assign({}, _slotMeta[slot] || {}, data || {}, {
      slot: slot,
      lastSeen: Date.now(),
    });
    return _slotMeta[slot];
  }

  function _clearSlot(slot) {
    delete _slotConnections[slot];
    delete _slotMeta[slot];
    delete _stateBuffers[slot];
    delete _remoteStates[slot];
    delete _forcedCloseSlots[slot];
  }

  function _findConnectionBySlot(slot) {
    return _slotConnections[slot] || null;
  }

  function _findBanRecord(identity) {
    if (typeof isConnectionBanned !== 'function') return null;
    return isConnectionBanned(identity || null);
  }

  function _disconnectBannedConnection(conn, banRecord, label, slot) {
    if (!conn) return;
    const reason = (banRecord && banRecord.reason) ? banRecord.reason : 'Banned from room.';
    if (slot !== undefined && slot !== null) _forcedCloseSlots[slot] = 'ban';
    try { conn.send({ type: 'banned', reason, label: label || null, ban: banRecord || null }); } catch (e) {}
    try { conn.close(); } catch (e) {}
  }

  function _closeSlot(slot, msg, reasonKey) {
    const conn = _findConnectionBySlot(slot) || (!_isHost && slot === 0 ? _connections[0] : null);
    if (!conn) return false;
    if (reasonKey) _forcedCloseSlots[slot] = reasonKey;
    if (msg) {
      try { conn.send(msg); } catch (e) {}
    }
    try { conn.close(); } catch (e) {}
    return true;
  }

  function _sendClientHello(conn) {
    const targetConn = conn || (_connections.length > 0 ? _connections[0] : null);
    if (!targetConn || !targetConn.open || _isHost) return;
    const identity = _getLocalIdentity();
    try {
      targetConn.send({
        type: 'clientHello',
        accountId: identity.accountId,
        username: identity.username,
        role: identity.role,
        deviceId: identity.deviceId,
        peerId: identity.peerId,
        slot: _localSlot,
      });
    } catch (e) {}
  }

  function showToast(msg, dur) {
    dur = dur || 2500;
    let t = document.getElementById('netToast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'netToast';
      t.style.cssText = 'position:fixed;top:18px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.82);color:#fff;padding:10px 22px;border-radius:20px;font-size:15px;z-index:9999;pointer-events:none;transition:opacity 0.4s';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.style.opacity = '1';
    clearTimeout(t._to);
    t._to = setTimeout(() => { t.style.opacity = '0'; }, dur);
  }

  function _setStatus(msg) {
    const el = document.getElementById('onlineStatus');
    if (el) el.textContent = msg;
  }

  function _appendChatMsg(sender, text) {
    const el = document.getElementById('chatMessages');
    if (!el) return;
    const d = document.createElement('div');
    d.style.cssText = 'padding:2px 0;font-size:13px;color:#ddd;';
    d.textContent = sender + ': ' + text;
    el.appendChild(d);
    el.scrollTop = el.scrollHeight;
  }

  function _initPeer(peerId) {
    _peer = peerId ? new Peer(peerId, { debug: 0 }) : new Peer({ debug: 0 });
    return new Promise((resolve, reject) => {
      _peer.on('open', id => { _log('Peer open: ' + id); resolve(id); });
      _peer.on('error', err => reject(err));
    });
  }

  // HOST: receives connections from guests
  function _setupHostListeners() {
    _peer.on('connection', conn => {
      const guestPeerId = conn.peer || null;
      const preBan = _findBanRecord({ peerId: guestPeerId });
      if (preBan) {
        conn.on('open', () => _disconnectBannedConnection(conn, preBan, 'peer'));
        return;
      }
      if (_slotCount >= _maxPlayers) {
        conn.on('open', () => conn.send({ type: 'roomFull' }));
        return;
      }
      const guestSlot = _nextGuestSlot++;
      _slotCount++;
      _connections.push(conn);
      _slotConnections[guestSlot] = conn;
      _stateBuffers[guestSlot] = [];
      _setSlotMeta(guestSlot, {
        peerId: guestPeerId,
        username: 'Player ' + (guestSlot + 1),
        accountId: null,
        deviceId: null,
        role: null,
        connectedAt: Date.now(),
      });
      _log('Guest connecting to slot ' + guestSlot);

      conn.on('open', () => {
        conn.send({ type: 'slotAssign', slot: guestSlot, maxPlayers: _maxPlayers });
        conn.send({ type: 'requestHello', slot: guestSlot });
        _setStatus('Players: ' + _slotCount + '/' + _maxPlayers);
        showToast('Player ' + (guestSlot + 1) + ' joined!');
        _broadcast({ type: 'playerCount', count: _slotCount });
        // Late-join: send full story state so guest can reconstruct current scene
        if (typeof storyModeActive !== 'undefined' && storyModeActive && typeof _story2 !== 'undefined') {
          const _bossEntity = typeof players !== 'undefined' && players.find(p => p && p.isBoss);
          conn.send({
            type: 'gameEvent', event: 'story_state',
            story2:     JSON.parse(JSON.stringify(_story2)),
            bossHealth: _bossEntity ? _bossEntity.health : undefined,
            objective:  typeof window !== 'undefined' && window.currentObjective ? window.currentObjective.text : undefined,
            isCinematic: typeof isCinematic !== 'undefined' ? isCinematic : false,
          });
        }
      });

      conn.on('data', msg => _handleMessage(guestSlot, conn, msg));
      conn.on('close', () => {
        _connections = _connections.filter(c => c !== conn);
        _slotCount = Math.max(1, _slotCount - 1);
        const forced = !!_forcedCloseSlots[guestSlot];
        _clearSlot(guestSlot);
        _setStatus('Players: ' + _slotCount + '/' + _maxPlayers);
        if (!forced) _handleOpponentLeft(guestSlot);
      });
    });
  }

  function _handleMessage(fromSlot, fromConn, msg) {
    switch (msg.type) {
      case 'playerState':
        _stateBuffers[fromSlot] = _stateBuffers[fromSlot] || [];
        _stateBuffers[fromSlot].push({ state: msg.state, ts: performance.now() });
        if (_stateBuffers[fromSlot].length > 16) _stateBuffers[fromSlot].shift();
        _remoteStates[fromSlot] = msg.state;
        // HOST relays to all other connections
        if (_isHost) {
          const relay = { type: 'playerState', slot: fromSlot, state: msg.state };
          for (const c of _connections) { if (c !== fromConn && c.open) c.send(relay); }
        }
        break;

      case 'clientHello': {
        const merged = _setSlotMeta(fromSlot, {
          peerId: fromConn && fromConn.peer ? fromConn.peer : (_slotMeta[fromSlot] && _slotMeta[fromSlot].peerId) || null,
          accountId: msg.accountId || (_slotMeta[fromSlot] && _slotMeta[fromSlot].accountId) || null,
          username: msg.username || (_slotMeta[fromSlot] && _slotMeta[fromSlot].username) || null,
          deviceId: msg.deviceId || (_slotMeta[fromSlot] && _slotMeta[fromSlot].deviceId) || null,
          role: msg.role || (_slotMeta[fromSlot] && _slotMeta[fromSlot].role) || null,
        });
        const ban = _findBanRecord(merged);
        if (ban) {
          _disconnectBannedConnection(fromConn, ban, 'client', fromSlot);
          return;
        }
        break;
      }

      case 'hostBroadcast':
        // Guest receives relayed state from host
        if (!_isHost && msg.slot !== undefined) {
          const s = msg.slot;
          _stateBuffers[s] = _stateBuffers[s] || [];
          _stateBuffers[s].push({ state: msg.state, ts: performance.now() });
          if (_stateBuffers[s].length > 16) _stateBuffers[s].shift();
          _remoteStates[s] = msg.state;
        }
        break;

      case 'hitEvent':
        // Only the owning slot may author its own hit packets.
        // This prevents a client from spoofing hits as another player.
        if (fromSlot !== 0 && fromSlot !== msg.attackerSlot) return;
        if (typeof dealDamage === 'function' && players[msg.targetSlot]) {
          const attacker = players[msg.attackerSlot] || players[0];
          dealDamage(attacker, players[msg.targetSlot], msg.dmg, msg.kb);
        }
        if (_isHost) {
          const relay = Object.assign({}, msg);
          for (const c of _connections) { if (c !== fromConn && c.open) c.send(relay); }
        }
        break;

      case 'gameEvent':
        _handleGameEvent(msg, fromSlot);
        if (_isHost && _shouldRelayGameEvent(msg, fromSlot)) {
          for (const c of _connections) { if (c !== fromConn && c.open) c.send(msg); }
        }
        break;

      case 'gameStateSync':
        if (!_isHost) {
          if (msg.arena && typeof selectArena === 'function') selectArena(msg.arena);
          if (msg.mode && typeof selectMode === 'function') selectMode(msg.mode);
        }
        break;

      case 'playerCount':
        _setStatus('Players: ' + msg.count + '/' + _maxPlayers);
        break;

      case 'roomFull':
        showToast('Room is full!');
        if (_peer) _peer.destroy();
        break;

      case 'banned':
        showToast(msg.reason || 'You were removed from the room.');
        _disconnectReason = 'ban';
        if (_peer) _peer.destroy();
        _connected = false;
        onlineMode = false;
        _setStatus('Banned');
        return;

      case 'ping':
        fromConn.send({ type: 'pong', id: msg.id });
        break;

      case 'pong':
        if (_pingTimers[msg.id]) {
          _latencies[fromSlot] = performance.now() - _pingTimers[msg.id];
          delete _pingTimers[msg.id];
        }
        break;
    }
  }

  function _handleOpponentLeft(slotWhoLeft) {
    showToast('Opponent disconnected — you win!');
    _setStatus('Opponent left');
    if (typeof gameRunning !== 'undefined' && gameRunning &&
        typeof players !== 'undefined' && players.length >= 2 &&
        typeof endGame === 'function') {
      // Kill the remote player so endGame() resolves the correct winner
      const leaver = players[slotWhoLeft !== undefined ? slotWhoLeft : (1 - _localSlot)];
      if (leaver) { leaver.health = 0; leaver.lives = 0; }
      // Small delay so the death registers visually before the overlay
      setTimeout(() => { if (typeof gameRunning !== 'undefined' && gameRunning) endGame(); }, 600);
    }
  }

  function _shouldRelayGameEvent(msg, fromSlot) {
    if (!_isHost) return false;
    if (fromSlot === 0) return true;
    if (!msg || !msg.event) return false;
    // Guests may chat, but they may not drive lobby/admin/console/game-state events.
    return msg.event === 'chat';
  }

  function _handleGameEvent(msg, fromSlot) {
    const isHostOrigin = fromSlot === 0;
    if (!isHostOrigin && msg.event !== 'chat') {
      return false;
    }

    if (msg.event === 'chat') {
      _appendChatMsg(msg.sender || 'P?', msg.text || '');
    } else if (msg.event === 'modeChange') {
      if (!_isHost && typeof selectMode === 'function') selectMode(msg.mode);
    } else if (msg.event === 'achievement') {
      if (typeof unlockAchievement === 'function') unlockAchievement(msg.id);
    } else if (msg.event === 'gameModeSelected') {
      _onlineGameMode = msg.data && msg.data.mode ? msg.data.mode : (msg.mode || '2p');
      gameMode = _onlineGameMode;
      if (typeof selectMode === 'function') selectMode(gameMode);
    } else if (msg.event === 'minigameSelected') {
      if (!_isHost && msg.minigameType && typeof minigameType !== 'undefined') minigameType = msg.minigameType;
      if (!_isHost && msg.minigameType && typeof selectMinigame === 'function') selectMinigame(msg.minigameType);
    } else if (msg.event === 'livesSelected') {
      if (!_isHost && msg.lives !== undefined && typeof chosenLives !== 'undefined') chosenLives = msg.lives;
      if (!_isHost && msg.lives !== undefined && typeof selectLives === 'function') selectLives(msg.lives);
    } else if (msg.event === 'arenaSelected') {
      if (!_isHost && msg.arena && typeof selectArena === 'function') selectArena(msg.arena);
    } else if (msg.event === 'startGame') {
      // Guest receives host's start signal — sync settings then launch
      if (!_isHost) {
        if (msg.arena  && typeof selectArena === 'function') selectArena(msg.arena);
        if (msg.mode   && typeof selectMode  === 'function') { gameMode = msg.mode; selectMode(msg.mode); }
        if (msg.lives  !== undefined && typeof chosenLives !== 'undefined') chosenLives = msg.lives;
        if (msg.minigameType && typeof minigameType !== 'undefined') minigameType = msg.minigameType;
        if (msg.minigameType && typeof selectMinigame === 'function') selectMinigame(msg.minigameType);
        if (typeof startGame === 'function') startGame();
      }
    } else if (msg.event === 'playerLeft') {
      _handleOpponentLeft(msg.slot !== undefined ? msg.slot : undefined);
    } else if (msg.event === 'consoleCmd') {
      // Remote console command — execute locally (sender already ran it on their end)
      if (msg.cmd && typeof _consoleExec === 'function') {
        _consoleExec(msg.cmd);
      }
    } else if (msg.event === 'story_sync') {
      // Client: apply host story state without restarting the scene
      if (!_isHost && typeof _story2 !== 'undefined' && msg.chapter !== undefined) {
        if (msg.chapter > (_story2.chapter || 0)) _story2.chapter = msg.chapter;
        if (Array.isArray(msg.defeated)) {
          for (const id of msg.defeated) {
            if (!_story2.defeated.includes(id)) _story2.defeated.push(id);
          }
        }
        if (typeof _saveStory2 === 'function') _saveStory2();
        // Sync boss health (prevent client-side boss from being a different HP)
        if (msg.bossHealth !== undefined) {
          const boss = typeof players !== 'undefined' && players.find(p => p.isBoss);
          if (boss && !boss.isRemote) boss.health = Math.min(boss.health, msg.bossHealth);
        }
        // Sync objective label
        if (msg.objective && typeof setObjective === 'function') {
          setObjective(msg.objective);
        }
        if ('isCinematic' in msg && typeof isCinematic !== 'undefined') {
          isCinematic = !!msg.isCinematic;
          if (typeof gameFrozen !== 'undefined') gameFrozen = !!msg.isCinematic;
        }
      }
    } else if (msg.event === 'story_state') {
      // Deep late-join sync — reconstruct current story state from host snapshot
      if (!_isHost && typeof _story2 !== 'undefined') {
        if (msg.story2)   Object.assign(_story2, msg.story2);
        if (msg.bossHealth !== undefined) {
          const boss = typeof players !== 'undefined' && players.find(p => p.isBoss);
          if (boss) boss.health = msg.bossHealth;
        }
        if (msg.objective && typeof setObjective === 'function') setObjective(msg.objective);
        if (typeof isCinematic !== 'undefined' && 'isCinematic' in msg) {
          isCinematic = !!msg.isCinematic;
          if (typeof gameFrozen !== 'undefined') gameFrozen = !!msg.isCinematic;
        }
        if (typeof _saveStory2 === 'function') _saveStory2();
      }
    } else if (typeof handleChaosNetworkEvent === 'function' && handleChaosNetworkEvent(msg)) {
      // handled by chaos system
    } else if (typeof handleAdminNetworkEvent === 'function' && handleAdminNetworkEvent(msg, fromSlot)) {
      // handled by admin system
    }
  }

  function _broadcast(msg) {
    for (const c of _connections) { if (c && c.open) c.send(msg); }
  }

  // ─── PUBLIC API ───────────────────────────────────────────────────────────

  async function connect(roomCode, maxPlayers) {
    maxPlayers = maxPlayers || 2;
    if (_peer) { _peer.destroy(); _peer = null; }
    _roomCode = roomCode.toUpperCase().trim();
    _maxPlayers = Math.min(10, Math.max(2, maxPlayers));
    _connections = [];
    _slotConnections = {};
    _slotMeta = {};
    _remoteStates = {};
    _stateBuffers = {};
    _slotCount = 1;
    _nextGuestSlot = 1;
    _forcedCloseSlots = {};
    _disconnectReason = null;

    const hostId = 'smcgame-' + _roomCode;
    _setStatus('Connecting...');

    try {
      // Try to register as HOST
      await _initPeer(hostId);
      _isHost = true;
      _localSlot = 0;
      localPlayerSlot = 0;
      onlineLocalSlot = 0;
      _connected = true;
      onlineMode = true;
      _setSlotMeta(0, _getLocalIdentity());
      _setupHostListeners();
      _setStatus('Hosting \u2022 Players: 1/' + _maxPlayers);
      showToast('Room created! Share code: ' + _roomCode);
      if (_roomType === 'public') _advertisePublicRoom();
      const modeRow = document.getElementById('onlineGameModeRow');
      if (modeRow) modeRow.style.display = 'flex';
      const chatEl = document.getElementById('onlineChat');
      if (chatEl) chatEl.style.display = 'flex';
      const startBtn = document.getElementById('onlineStartBtn');
      if (startBtn) startBtn.style.display = 'inline-block';
    } catch (err) {
      if (err.type === 'unavailable-id') {
        // Room exists — join as GUEST
        if (_peer) _peer.destroy();
        _peer = null;
        await _initPeer(undefined); // auto-generated ID
        _isHost = false;
        _connected = true;
        onlineMode = true;
        _setStatus('Joining room...');
        const conn = _peer.connect(hostId, { reliable: true });
        _connections = [conn];

        conn.on('open', () => {
          _log('Connected to host');
          _sendClientHello(conn);
        });
        conn.on('data', msg => {
          if (msg.type === 'slotAssign') {
            _localSlot = msg.slot;
            localPlayerSlot = msg.slot;
            onlineLocalSlot = msg.slot;
            _maxPlayers = msg.maxPlayers || _maxPlayers;
            _setSlotMeta(_localSlot, _getLocalIdentity());
            _sendClientHello(conn);
            _setStatus('Joined as P' + (_localSlot + 1) + ' \u2022 Waiting for host to start...');
            showToast('You are Player ' + (_localSlot + 1) + ' — wait for host to start');
            // Hide the Connect button, show a waiting indicator
            const startBtn = document.getElementById('onlineStartBtn');
            if (startBtn) startBtn.style.display = 'none'; // guests never see Start
            const chatEl = document.getElementById('onlineChat');
            if (chatEl) chatEl.style.display = 'flex';
          } else if (msg.type === 'requestHello') {
            _sendClientHello(conn);
          } else if (msg.type === 'playerState') {
            // Host is relaying another guest's state
            const s = msg.slot;
            if (s !== undefined && s !== _localSlot) {
              _stateBuffers[s] = _stateBuffers[s] || [];
              _stateBuffers[s].push({ state: msg.state, ts: performance.now() });
              if (_stateBuffers[s].length > 16) _stateBuffers[s].shift();
              _remoteStates[s] = msg.state;
            }
          } else {
            _handleMessage(0, conn, msg);
          }
        });
        conn.on('close', () => {
          _connected = false;
          _setStatus('Disconnected');
          if (_disconnectReason !== 'ban') _handleOpponentLeft(0); // host is always slot 0
        });
        conn.on('error', e => showToast('Connection error: ' + e));
      } else {
        _setStatus('Connection failed: ' + (err.message || err.type));
        showToast('Failed to connect');
        throw err;
      }
    }
  }

  function disconnect() {
    _disconnectReason = 'manual';
    _broadcast({ type: 'gameEvent', event: 'playerLeft', slot: _localSlot });
    for (const c of _connections) { try { c.close(); } catch(e){} }
    _connections = [];
    if (_peer) { _peer.destroy(); _peer = null; }
    _slotConnections = {};
    _slotMeta = {};
    _remoteStates = {};
    _stateBuffers = {};
    _forcedCloseSlots = {};
    _slotCount = 1;
    _nextGuestSlot = 1;
    _isHost = false;
    _localSlot = 0;
    _disconnectReason = null;
    _connected = false;
    onlineMode = false;
    _setStatus('Disconnected');
    _unAdvertisePublicRoom();
    const startBtn = document.getElementById('onlineStartBtn');
    if (startBtn) startBtn.style.display = 'none';
    const modeRow = document.getElementById('onlineGameModeRow');
    if (modeRow) modeRow.style.display = 'none';
  }

  function sendState() {
    if (!_connected) return;
    const p = (typeof players !== 'undefined') && players[_localSlot];
    if (!p) return;
    const state = {
      x: p.x, y: p.y, vx: p.vx, vy: p.vy,
      health: p.health, maxHealth: p.maxHealth, facing: p.facing,
      state: p.attackTimer > 0 ? 'attacking' : p.onGround ? 'idle' : 'jumping',
      attackTimer: p.attackTimer || 0, attackDuration: p.attackDuration || 12,
      hurtTimer: p.hurtTimer || 0, stunTimer2: p.stunTimer || 0,
      weaponKey: p.weaponKey, charClass: p.charClass || 'none',
      shield: p.shielding, stunTimer: p.stunTimer > 0,
      invincible: p.invincible || 0,
      color: p.color, lives: p.lives,
      hat: p.hat || 'none', cape: p.cape || 'none',
      name: p.name || ('P' + (_localSlot + 1)),
      slot: _localSlot, ts: Date.now()
    };
    const msg = { type: 'playerState', slot: _localSlot, state };
    if (_isHost) {
      _broadcast(msg);
    } else if (_connections[0] && _connections[0].open) {
      _connections[0].send(msg);
    }
  }

  function sendHit(attackerSlot, targetSlot, dmg, kb) {
    // Support legacy 2-arg call: sendHit(dmg, kb)
    if (typeof targetSlot === 'undefined' || typeof dmg === 'undefined' || typeof kb === 'undefined') {
      // Legacy 2-player call: sendHit(dmg, kbDir)
      const legDmg = attackerSlot, legKb = targetSlot;
      const msg2 = { type: 'hitEvent', attackerSlot: _localSlot, targetSlot: _localSlot === 0 ? 1 : 0, dmg: legDmg, kb: legKb };
      if (_isHost) { _broadcast(msg2); }
      else if (_connections[0] && _connections[0].open) { _connections[0].send(msg2); }
      return;
    }
    const msg = { type: 'hitEvent', attackerSlot, targetSlot, dmg, kb };
    if (_isHost) { _broadcast(msg); }
    else if (_connections[0] && _connections[0].open) { _connections[0].send(msg); }
  }

  function sendGameEvent(event, data) {
    const msg = Object.assign({ type: 'gameEvent', event }, data || {});
    if (_isHost) { _broadcast(msg); }
    else if (_connections[0] && _connections[0].open) { _connections[0].send(msg); }
  }

  function sendToSlot(slot, msg) {
    const conn = _isHost ? _findConnectionBySlot(slot) : (_connections[0] || null);
    if (!conn || !conn.open) return false;
    try {
      conn.send(msg);
      return true;
    } catch (e) {
      return false;
    }
  }

  function sendChatMsg() {
    const inp = document.getElementById('chatInput');
    if (!inp || !inp.value.trim()) return;
    const text = inp.value.trim();
    inp.value = '';
    const sender = 'P' + (_localSlot + 1);
    _appendChatMsg(sender, text);
    sendGameEvent('chat', { sender, text });
  }

  function onChatKey(e) {
    if (e.key === 'Enter') sendChatMsg();
  }

  function getRemoteState(slot) {
    const buf = _stateBuffers[slot];
    if (!buf || buf.length === 0) return _remoteStates[slot] || null;
    const now = performance.now() - INTERP_DELAY;
    let a = buf[0], b = buf[0];
    for (let i = 0; i < buf.length - 1; i++) {
      if (buf[i].ts <= now && buf[i+1].ts >= now) { a = buf[i]; b = buf[i+1]; break; }
      if (buf[i+1].ts < now) { a = buf[i+1]; b = buf[i+1]; }
    }
    if (a === b) return a.state;
    const t = Math.max(0, Math.min(1, (now - a.ts) / Math.max(1, b.ts - a.ts)));
    return Object.assign({}, b.state, {
      x: a.state.x + (b.state.x - a.state.x) * t,
      y: a.state.y + (b.state.y - a.state.y) * t,
    });
  }

  // Legacy getRemoteState() with no arg — returns slot 1 state for 2P compat
  function getRemoteStateLegacy() {
    const otherSlot = _localSlot === 0 ? 1 : 0;
    return getRemoteState(otherSlot);
  }

  function isHost() { return _isHost; }
  function isConnected() { return _connected; }
  function getLocalSlot() { return _localSlot; }
  function getSlotCount() { return _slotCount; }
  function getLatency(slot) { return _latencies[slot] || 0; }
  function getOwnPeerId() { return _peer ? _peer.id : null; }
  function getOwnDeviceId() { return _ensureDeviceId(); }
  function getLocalIdentity() { return Object.assign({}, _getLocalIdentity()); }
  function getPeerMeta(slot) { return _cloneIdentity(_slotMeta[slot] || null); }
  function getPeerRoster() {
    const roster = [];
    const slots = Object.keys(_slotMeta).map(k => parseInt(k, 10)).filter(n => Number.isFinite(n)).sort((a, b) => a - b);
    if (_isHost && slots.indexOf(0) === -1) {
      roster.push(_cloneIdentity(_getLocalIdentity()));
    }
    for (const slot of slots) {
      const meta = _slotMeta[slot];
      if (meta) roster.push(_cloneIdentity(meta));
    }
    return roster;
  }
  function getSlotByAccountId(accountId) {
    const needle = String(accountId || '');
    for (const [slot, meta] of Object.entries(_slotMeta)) {
      if (meta && String(meta.accountId || '') === needle) return parseInt(slot, 10);
    }
    return null;
  }
  function getSlotByPeerId(peerId) {
    const needle = String(peerId || '');
    for (const [slot, meta] of Object.entries(_slotMeta)) {
      if (meta && String(meta.peerId || '') === needle) return parseInt(slot, 10);
    }
    return null;
  }
  function getSlotByDeviceId(deviceId) {
    const needle = String(deviceId || '');
    for (const [slot, meta] of Object.entries(_slotMeta)) {
      if (meta && String(meta.deviceId || '') === needle) return parseInt(slot, 10);
    }
    return null;
  }

  function tick(localPlayer) {
    // localPlayer param kept for legacy API compat — we use players[_localSlot] instead
    _sendTimer++;
    if (_sendTimer >= Math.ceil(60 / SEND_HZ)) {
      _sendTimer = 0;
      sendState();
    }
  }

  // Public room advertisement via localStorage
  let _advTimer = null;
  function _advertisePublicRoom() {
    if (_roomType !== 'public') return;
    const key = 'smcpub_' + _roomCode;
    localStorage.setItem(key, JSON.stringify({ code: _roomCode, ts: Date.now(), players: _slotCount, max: _maxPlayers }));
    clearInterval(_advTimer);
    _advTimer = setInterval(() => {
      if (_connected && _isHost && _roomType === 'public') {
        localStorage.setItem(key, JSON.stringify({ code: _roomCode, ts: Date.now(), players: _slotCount, max: _maxPlayers }));
      }
    }, 30000);
  }

  function _unAdvertisePublicRoom() {
    clearInterval(_advTimer);
    if (_roomCode) localStorage.removeItem('smcpub_' + _roomCode);
  }

  function setRoomType(type) {
    _roomType = type;
    const pubBtn = document.getElementById('roomTypePublicBtn');
    const privBtn = document.getElementById('roomTypePrivateBtn');
    if (pubBtn) pubBtn.classList.toggle('active', type === 'public');
    if (privBtn) privBtn.classList.toggle('active', type === 'private');
    const browser = document.getElementById('publicRoomBrowser');
    if (browser) browser.style.display = type === 'public' ? 'flex' : 'none';
    if (_isHost && type === 'public') _advertisePublicRoom();
    if (type === 'private') _unAdvertisePublicRoom();
  }

  function refreshPublicRooms() {
    const list = document.getElementById('publicRoomList');
    if (!list) return;
    list.innerHTML = '';
    const now = Date.now();
    let found = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith('smcpub_')) continue;
      try {
        const d = JSON.parse(localStorage.getItem(k));
        if (now - d.ts > 120000) { localStorage.removeItem(k); continue; }
        found++;
        const btn = document.createElement('button');
        btn.className = 'btn pub-room-btn';
        btn.style.cssText = 'width:100%;margin:2px 0;font-size:13px;';
        btn.textContent = d.code + '  (' + d.players + '/' + d.max + ' players)';
        btn.onclick = () => {
          const inp = document.getElementById('onlineRoomCode');
          if (inp) inp.value = d.code;
        };
        list.appendChild(btn);
      } catch(e) {}
    }
    if (!found) list.innerHTML = '<div style="color:#aaa;font-size:13px;padding:4px;">No public rooms found</div>';
  }

  function setOnlineGameMode(mode) {
    if (!_isHost) return;
    _onlineGameMode = mode;
    gameMode = mode;
    if (typeof selectMode === 'function') selectMode(mode);
    document.querySelectorAll('#onlineGameModeRow [data-onlinemode]').forEach(b => {
      b.classList.toggle('active', b.dataset.onlinemode === mode);
    });
    // Show/hide minigame type row
    const mgRow = document.getElementById('onlineMinigameRow');
    if (mgRow) mgRow.style.display = mode === 'minigames' ? 'flex' : 'none';
    sendGameEvent('gameModeSelected', { mode });
  }

  function setOnlineMinigame(type) {
    if (!_isHost) return;
    if (typeof minigameType !== 'undefined') minigameType = type;
    if (typeof selectMinigame === 'function') selectMinigame(type);
    document.querySelectorAll('#onlineMinigameRow [data-onlinemg]').forEach(b => {
      b.classList.toggle('active', b.dataset.onlinemg === type);
    });
    sendGameEvent('minigameSelected', { minigameType: type });
  }

  function setOnlineLives(n) {
    if (!_isHost) return;
    if (typeof chosenLives !== 'undefined') chosenLives = n;
    if (typeof selectLives === 'function') selectLives(n);
    document.querySelectorAll('[data-onlinelives]').forEach(b => {
      b.classList.toggle('active', parseInt(b.dataset.onlinelives) === n);
    });
    sendGameEvent('livesSelected', { lives: n });
  }

  function selectOnlineArenaLocal(arenaKey) {
    if (!_isHost) return;
    if (typeof selectArena === 'function') selectArena(arenaKey);
    document.querySelectorAll('[data-onlinearena]').forEach(b => {
      b.classList.toggle('active', b.dataset.onlinearena === arenaKey);
    });
    sendGameEvent('arenaSelected', { arena: arenaKey });
  }

  // Legacy sendGameStateSync for compatibility
  function sendGameStateSync(stateObj) {
    if (!_isHost) return;
    _broadcast({ type: 'gameStateSync', state: stateObj });
  }

  return {
    connect, disconnect, tick,
    sendState, sendHit, sendGameEvent, sendChatMsg, sendToSlot, closeSlot: _closeSlot,
    getRemoteState, getRemoteStateLegacy,
    getLocalSlot, getSlotCount, isHost, isConnected, getLatency,
    getOwnPeerId, getOwnDeviceId, getLocalIdentity, getPeerMeta, getPeerRoster, getSlotByAccountId, getSlotByPeerId, getSlotByDeviceId,
    setRoomType, refreshPublicRooms, setOnlineGameMode, setOnlineMinigame, setOnlineLives, selectOnlineArenaLocal, showToast,
    sendGameStateSync,
    get connected() { return _connected; },
    get slot() { return _localSlot; },
    get room() { return _roomCode; },
    get localSlot() { return _localSlot; },
  };
})();

// ============================================================
// STANDALONE FUNCTIONS (called from HTML onclick, etc.)
// ============================================================
function networkJoinRoom() {
  const code = ((document.getElementById('onlineRoomCode') || {}).value || '').trim();
  const maxEl = document.getElementById('onlineMaxPlayers');
  const max = maxEl ? (parseInt(maxEl.value) || 2) : 2;
  if (!code) { NetworkManager.showToast('Enter a room code'); return; }
  NetworkManager.connect(code, max).catch(e => console.error('[Net] Connect failed:', e));
}

function onChatKey(e) {
  if (e.key === 'Enter') { e.preventDefault(); NetworkManager.sendChatMsg(); }
}

function sendChatMsg() { NetworkManager.sendChatMsg(); }

function setRoomType(type) { NetworkManager.setRoomType(type); }

function refreshPublicRooms() { NetworkManager.refreshPublicRooms(); }

function setOnlineGameMode(mode) { NetworkManager.setOnlineGameMode(mode); }

function setOnlineMinigame(type) { NetworkManager.setOnlineMinigame(type); }

function setOnlineLives(n) { NetworkManager.setOnlineLives(n); }

function selectOnlineArena(arenaKey) {
  NetworkManager.selectOnlineArenaLocal(arenaKey);
}

function showToast(msg, duration) {
  NetworkManager.showToast(msg, duration);
}

// Host-only: broadcast start signal to all guests then launch locally
function networkStartGame() {
  if (!NetworkManager.isHost()) {
    NetworkManager.showToast('Only the host can start the game');
    return;
  }
  if (!NetworkManager.connected) {
    NetworkManager.showToast('Not connected — click Connect first');
    return;
  }
  // Broadcast current arena + mode so guests match
  NetworkManager.sendGameEvent('startGame', {
    arena:        typeof selectedArena  !== 'undefined' ? selectedArena  : 'random',
    mode:         typeof gameMode       !== 'undefined' ? gameMode       : '2p',
    lives:        typeof chosenLives    !== 'undefined' ? chosenLives    : 3,
    minigameType: typeof minigameType   !== 'undefined' ? minigameType   : 'survival',
  });
  // Small delay so the network message reaches guests before host starts
  setTimeout(() => {
    if (typeof startGame === 'function') startGame();
  }, 120);
}

// ============================================================
// VOICE CHAT SCAFFOLD (push-to-talk, peer-to-peer WebRTC)
// Lightweight: no server. Mic stream sent directly to peers via PeerJS MediaConnection.
// ============================================================
window._voiceChat = (function() {
  let _localStream     = null; // microphone MediaStream
  let _mediaConns      = [];   // PeerJS MediaConnection array (one per remote peer)
  let _micActive       = false;
  let _enabled         = false; // only active in multiplayer

  function init() {
    if (!window.onlineMode) return; // only in multiplayer
    _enabled = true;
    // Bind push-to-talk key (V)
    document.addEventListener('keydown', _onKeyDown);
    document.addEventListener('keyup',   _onKeyUp);
  }

  function destroy() {
    _enabled = false;
    _stopMic();
    for (const mc of _mediaConns) { try { mc.close(); } catch(e){} }
    _mediaConns = [];
    document.removeEventListener('keydown', _onKeyDown);
    document.removeEventListener('keyup',   _onKeyUp);
  }

  function _onKeyDown(e) {
    if (!_enabled || e.repeat) return;
    if (e.code === 'KeyV') { e.preventDefault(); _startMic(); }
  }
  function _onKeyUp(e) {
    if (!_enabled) return;
    if (e.code === 'KeyV') { e.preventDefault(); _stopMic(); }
  }

  async function _startMic() {
    if (_micActive) return;
    try {
      _localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      _micActive = true;
      // Broadcast mic stream to all connected peers via NetworkManager's peer object
      const peer = window.NetworkManager && window.NetworkManager._peer;
      if (peer) {
        // Call all connected peers with our audio stream
        const conns = window.NetworkManager._connections || [];
        for (const conn of conns) {
          if (!conn || !conn.peer) continue;
          const mc = peer.call(conn.peer, _localStream);
          if (mc) _mediaConns.push(mc);
        }
      }
      _showVoiceIndicator(true);
    } catch(e) {
      console.warn('[VoiceChat] Mic access denied:', e.message);
    }
  }

  function _stopMic() {
    if (!_micActive) return;
    if (_localStream) { _localStream.getTracks().forEach(t => t.stop()); _localStream = null; }
    for (const mc of _mediaConns) { try { mc.close(); } catch(e){} }
    _mediaConns = [];
    _micActive = false;
    _showVoiceIndicator(false);
  }

  function _showVoiceIndicator(active) {
    let el = document.getElementById('voiceChatIndicator');
    if (!el) {
      el = document.createElement('div');
      el.id = 'voiceChatIndicator';
      el.style.cssText = 'position:fixed;bottom:60px;left:16px;background:rgba(0,200,80,0.18);border:1px solid rgba(0,200,80,0.5);color:#44ff88;font-size:0.72rem;padding:4px 10px;border-radius:5px;z-index:9999;pointer-events:none;font-family:Arial,sans-serif;transition:opacity 0.2s;';
      document.body.appendChild(el);
    }
    el.textContent = active ? '🎤 MIC ON (V)' : '🔇 MIC OFF';
    el.style.opacity = active ? '1' : '0.45';
    el.style.display = 'block';
  }

  // Called by NetworkManager when a remote peer calls us (answer incoming media call)
  function answerIncoming(mediaConn) {
    mediaConn.answer(); // no stream back (listen-only by default)
    mediaConn.on('stream', remoteStream => {
      const audio = new Audio();
      audio.srcObject = remoteStream;
      audio.autoplay = true;
      audio.volume = 0.85;
    });
  }

  return { init, destroy, answerIncoming };
})();
