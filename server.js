'use strict';

// ============================================================
// Stickman Battles — Relay + Moderation API Server
//
// Runs two services on the same port:
//   1. Socket.io relay — relays playerState / hitEvent / gameEvent
//      between peers in named rooms (unchanged from original).
//   2. REST API       — persistent cross-device ban storage so
//      admin bans survive across sessions and work on any device.
//
// Environment variables:
//   PORT        Server port (default 3001)
//   ADMIN_KEY   Secret key required for write operations (POST/DELETE /api/bans)
//               Default is 'smb-dev-key-change-me' — CHANGE THIS in production.
//               Must match SERVER_CONFIG.adminKey in smb-globals.js.
//
// REST Endpoints:
//   GET    /api/status                       — health check
//   GET    /api/bans                         — list all active bans
//   GET    /api/bans/check?accountId=&...    — check if identity is banned
//   POST   /api/bans           [admin]       — add a ban record
//   DELETE /api/bans/:key      [admin]       — remove a ban by key
//   DELETE /api/bans           [admin]       — bulk remove by identity (body)
//
// Data is persisted to ./data/bans.json.
// ============================================================

const { createServer } = require('http');
const { Server }       = require('socket.io');
const fs               = require('fs');
const path             = require('path');

const PORT      = process.env.PORT      || 3001;
const ADMIN_KEY = process.env.ADMIN_KEY || 'smb-dev-key-change-me';

if (ADMIN_KEY === 'smb-dev-key-change-me') {
  console.warn('[!] Using default ADMIN_KEY. Set the ADMIN_KEY environment variable before deploying!');
}

// ── Data persistence ─────────────────────────────────────────────────────────

const DATA_DIR  = path.join(__dirname, 'data');
const BANS_FILE = path.join(DATA_DIR, 'bans.json');

function _ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function _loadBans() {
  _ensureDataDir();
  try {
    return JSON.parse(fs.readFileSync(BANS_FILE, 'utf8'));
  } catch (_) {
    return { records: {}, lastModified: Date.now() };
  }
}

function _saveBans(data) {
  _ensureDataDir();
  data.lastModified = Date.now();
  fs.writeFileSync(BANS_FILE, JSON.stringify(data, null, 2), 'utf8');
}

// Removes expired records in-place. Returns true if any were removed.
function _trimExpiredBans(data) {
  const now = Date.now();
  let changed = false;
  for (const key of Object.keys(data.records)) {
    const rec = data.records[key];
    if (rec && rec.expiresAt && rec.expiresAt <= now) {
      delete data.records[key];
      changed = true;
    }
  }
  return changed;
}

// Checks whether a ban record matches a client identity object.
function _recordMatchesIdentity(rec, id) {
  if (!rec || !id) return false;
  if (rec.expiresAt && rec.expiresAt <= Date.now()) return false;
  const acc  = String(id.accountId || '');
  const peer = String(id.peerId    || '');
  const dev  = String(id.deviceId  || '');
  const user = String(id.username  || '').toLowerCase();
  return (
    (rec.accountId && acc  && String(rec.accountId) === acc)  ||
    (rec.peerId    && peer && String(rec.peerId)    === peer) ||
    (rec.deviceId  && dev  && String(rec.deviceId)  === dev)  ||
    (!rec.accountId && !rec.peerId && !rec.deviceId &&
     rec.username && user && String(rec.username).toLowerCase() === user)
  );
}

// ── HTTP helpers ──────────────────────────────────────────────────────────────

function _cors(res) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Key');
}

function _json(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

// Reads the request body as JSON. Resolves to {} on parse failure.
function _readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', chunk => {
      raw += chunk;
      if (raw.length > 512 * 1024) reject(new Error('Request body too large'));
    });
    req.on('end',   () => { try { resolve(JSON.parse(raw)); } catch (_) { resolve({}); } });
    req.on('error', reject);
  });
}

function _isAdmin(req) {
  return (req.headers['x-admin-key'] || '') === ADMIN_KEY;
}

// ── Request handler ───────────────────────────────────────────────────────────

function _handleRequest(req, res) {
  _cors(res);

  // CORS pre-flight — browsers send this before cross-origin writes
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const url      = new URL(req.url, 'http://localhost');
  const pathname = url.pathname;

  // ── GET /api/status ─────────────────────────────────────────────────────────
  if (pathname === '/api/status' && req.method === 'GET') {
    const data = _loadBans();
    _trimExpiredBans(data);
    _json(res, 200, {
      ok: true,
      server: 'Stickman Battles Moderation API',
      version: '1.0.0',
      activeBans: Object.keys(data.records).length,
      uptime: Math.floor(process.uptime()),
    });
    return;
  }

  // ── GET /api/bans ────────────────────────────────────────────────────────────
  // Returns all active (non-expired) ban records.
  // Safe to call from any client — no admin key needed for reads.
  if (pathname === '/api/bans' && req.method === 'GET') {
    const data = _loadBans();
    const changed = _trimExpiredBans(data);
    if (changed) _saveBans(data);
    _json(res, 200, { records: data.records, lastModified: data.lastModified });
    return;
  }

  // ── GET /api/bans/check ──────────────────────────────────────────────────────
  // Query params: accountId, peerId, deviceId, username
  // Returns { banned: bool, record: BanRecord|null }
  if (pathname === '/api/bans/check' && req.method === 'GET') {
    const identity = {
      accountId: url.searchParams.get('accountId') || '',
      peerId:    url.searchParams.get('peerId')    || '',
      deviceId:  url.searchParams.get('deviceId')  || '',
      username:  url.searchParams.get('username')  || '',
    };
    const data = _loadBans();
    _trimExpiredBans(data);
    let match = null;
    for (const rec of Object.values(data.records)) {
      if (_recordMatchesIdentity(rec, identity)) { match = rec; break; }
    }
    _json(res, 200, { banned: !!match, record: match || null });
    return;
  }

  // ── POST /api/bans ───────────────────────────────────────────────────────────
  // Body: { key: string, record: BanRecord }
  // Adds or replaces a ban record. Requires X-Admin-Key header.
  if (pathname === '/api/bans' && req.method === 'POST') {
    if (!_isAdmin(req)) { _json(res, 403, { error: 'Forbidden — invalid or missing X-Admin-Key' }); return; }
    _readBody(req).then(body => {
      const { key, record } = body || {};
      if (!key || !record || typeof record !== 'object') {
        _json(res, 400, { error: 'Body must be { key: string, record: BanRecord }' }); return;
      }
      const data = _loadBans();
      data.records[key] = record;
      _saveBans(data);
      // Push real-time update to all connected socket.io clients
      if (_io) _io.emit('banSync', { action: 'add', key, record });
      const label = record.targetLabel || record.accountId || record.peerId || record.deviceId || '?';
      const ttl   = record.expiresAt ? Math.ceil((record.expiresAt - Date.now()) / 60000) + 'm' : 'perm';
      console.log(`[Ban] + ${label}  [${ttl}]${record.reason ? '  — ' + record.reason : ''}`);
      _json(res, 200, { ok: true, key });
    }).catch(err => _json(res, 500, { error: err.message }));
    return;
  }

  // ── DELETE /api/bans/:key ────────────────────────────────────────────────────
  // Removes a single ban record by its exact key (URL-encoded).
  if (pathname.startsWith('/api/bans/') && req.method === 'DELETE') {
    if (!_isAdmin(req)) { _json(res, 403, { error: 'Forbidden' }); return; }
    const rawKey = decodeURIComponent(pathname.slice('/api/bans/'.length).trim());
    if (!rawKey) { _json(res, 400, { error: 'Key required in path' }); return; }
    const data = _loadBans();
    if (!data.records[rawKey]) { _json(res, 404, { error: 'Ban record not found' }); return; }
    delete data.records[rawKey];
    _saveBans(data);
    if (_io) _io.emit('banSync', { action: 'remove', key: rawKey });
    console.log('[Ban] - removed key:', rawKey);
    _json(res, 200, { ok: true });
    return;
  }

  // ── DELETE /api/bans (bulk unban by identity) ─────────────────────────────────
  // Body: { accountId?, peerId?, deviceId?, username? }
  // Removes all records matching the given identity fields.
  if (pathname === '/api/bans' && req.method === 'DELETE') {
    if (!_isAdmin(req)) { _json(res, 403, { error: 'Forbidden' }); return; }
    _readBody(req).then(body => {
      const identity = body || {};
      const data = _loadBans();
      const removedKeys = [];
      for (const [key, rec] of Object.entries(data.records)) {
        if (_recordMatchesIdentity(rec, identity)) {
          removedKeys.push(key);
          delete data.records[key];
        }
      }
      if (removedKeys.length) {
        _saveBans(data);
        if (_io) removedKeys.forEach(k => _io.emit('banSync', { action: 'remove', key: k }));
        console.log('[Ban] - bulk removed ' + removedKeys.length + ' record(s)');
      }
      _json(res, 200, { ok: true, removed: removedKeys.length });
    }).catch(err => _json(res, 500, { error: err.message }));
    return;
  }

  // ── Socket.io owns /socket.io/* — leave those alone ──────────────────────────
  // For any other unrecognised path, return 404 so browsers don't hang.
  if (!pathname.startsWith('/socket.io')) {
    _json(res, 404, { error: 'Not found' });
  }
}

// ── HTTP Server + Socket.io ───────────────────────────────────────────────────

const httpServer = createServer(_handleRequest);

// `let _io` so the request handler can emit banSync events
let _io;
_io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

// ── Socket.io relay rooms ─────────────────────────────────────────────────────

const rooms = new Map();

function _getRoomBySocket(socketId) {
  for (const [code, room] of rooms.entries()) {
    if (room.p1 === socketId || room.p2 === socketId) return { code, room };
  }
  return null;
}

_io.on('connection', (socket) => {
  console.log(`[+] socket connected: ${socket.id}`);

  socket.on('joinRoom', (rawCode) => {
    const code = String(rawCode || '').trim().toLowerCase().slice(0, 20);
    if (!code) return;

    let room = rooms.get(code);
    if (!room) { room = { p1: null, p2: null }; rooms.set(code, room); }

    if (room.p1 && room.p2) { socket.emit('roomFull'); return; }

    let slot;
    if (!room.p1) { room.p1 = socket.id; slot = 1; }
    else           { room.p2 = socket.id; slot = 2; }

    socket.join(code);
    socket.emit('joined', { slot, roomCode: code });
    console.log(`  Room "${code}" — slot ${slot} → ${socket.id}`);

    if (room.p1 && room.p2) {
      _io.to(code).emit('bothConnected');
      console.log(`  Room "${code}" is full`);
    }
  });

  socket.on('playerState', (state) => {
    const found = _getRoomBySocket(socket.id);
    if (found) socket.to(found.code).emit('remoteState', state);
  });

  socket.on('hitEvent', (ev) => {
    const found = _getRoomBySocket(socket.id);
    if (found) socket.to(found.code).emit('remoteHit', ev);
  });

  socket.on('gameEvent', (ev) => {
    const found = _getRoomBySocket(socket.id);
    if (found) socket.to(found.code).emit('remoteGameEvent', ev);
  });

  socket.on('disconnect', () => {
    console.log(`[-] socket disconnected: ${socket.id}`);
    const found = _getRoomBySocket(socket.id);
    if (!found) return;
    const { code, room } = found;
    socket.to(code).emit('opponentDisconnected');
    if (room.p1 === socket.id) room.p1 = null;
    if (room.p2 === socket.id) room.p2 = null;
    if (!room.p1 && !room.p2) {
      rooms.delete(code);
      console.log(`  Room "${code}" deleted (empty)`);
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`\nStickman Battles relay + moderation API`);
  console.log(`  Listening on port ${PORT}`);
  console.log(`  Admin key: ${ADMIN_KEY === 'smb-dev-key-change-me' ? '(default — set ADMIN_KEY env var!)' : '(configured)'}`);
  console.log(`  Bans file: ${BANS_FILE}`);
  console.log(`  REST API:  http://localhost:${PORT}/api/status\n`);
});
