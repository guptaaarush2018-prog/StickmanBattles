'use strict';

// storage.js — Persistent key-value store for the Stickman Battles server.
//
// Primary backend: SQLite via better-sqlite3 (synchronous API, no async needed).
// Fallback:        In-memory Map — data survives the process lifetime only.
//                  Logged at startup so it's never silent.
//
// Usage:
//   const storage = require('./storage');
//   storage.set('bans', { records: {}, lastModified: Date.now() });
//   const data = storage.get('bans');  // returns parsed object or null

const path = require('path');

const DB_PATH = path.join(__dirname, 'data.db');

let _get, _set, _type;

try {
  const Database = require('better-sqlite3');
  const db = new Database(DB_PATH);

  db.exec(`
    CREATE TABLE IF NOT EXISTS kv (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

  const _stmtGet = db.prepare('SELECT value FROM kv WHERE key = ?');
  const _stmtSet = db.prepare('INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)');

  _get  = (key) => { const row = _stmtGet.get(key); return row ? JSON.parse(row.value) : null; };
  _set  = (key, value) => { _stmtSet.run(key, JSON.stringify(value)); };
  _type = 'sqlite:' + DB_PATH;

} catch (err) {
  console.warn('[storage] SQLite unavailable (' + err.message + ')');
  console.warn('[storage] Falling back to in-memory store — data will NOT persist across restarts.');

  const _mem = new Map();
  _get  = (key) => _mem.get(key) ?? null;
  _set  = (key, value) => { _mem.set(key, value); };
  _type = 'memory';
}

function get(key) {
  try {
    return _get(key);
  } catch (err) {
    console.error('[storage] get("' + key + '") failed:', err.message);
    return null;
  }
}

function set(key, value) {
  try {
    _set(key, value);
  } catch (err) {
    console.error('[storage] set("' + key + '") failed:', err.message);
  }
}

function getType() { return _type; }

module.exports = { get, set, getType };
