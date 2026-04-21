// smb-state.js — Centralized runtime state authority
//
// Single source of truth for:
//   - persistent: account registry, admin overrides  (written to localStorage)
//   - session:    online lobby metadata              (never serialized)
//
// DOES NOT manage:
//   - players[], gameRunning, physics, rendering, or any game-loop globals
//   - game save blobs (those stay in AccountManager / smb-save.js)
//
// Load order: must come before smb-online.js, smb-accounts.js, smb-admin.js.
// GameState.load() is called eagerly at parse time so all downstream modules
// can read state synchronously from their own parse-time init.

'use strict';

const GameState = (() => {

  // ── Dev flag ──────────────────────────────────────────────────────────────────
  const DEBUG_STATE = false;

  // ── Internal state ────────────────────────────────────────────────────────────
  //
  // Explicitly split into two subtrees so callers always know what is safe
  // to persist and what is session-only. save() writes only `persistent`;
  // `session` is never serialized and resets to defaults on every page load.

  let _state = {
    persistent: {
      activeAccountId: null,
      accounts:        {},
      admin: {
        overrides: {}, // keyed by accountId → true | false (false = explicit revocation)
        bans: {
          records: {}, // keyed by `${kind}:${target}` → ban record
        },
      },
    },
    session: {
      online: {
        lobbyId:   null,
        role:      null,   // 'host' | 'guest' | null
        connected: false,
      },
    },
  };

  // ── Schema validation ─────────────────────────────────────────────────────────

  /**
   * Validates the persistent subtree structure.
   * Throws a descriptive Error if the shape is invalid.
   * Called after load() and after every update() commit.
   */
  function _validatePersistent(p) {
    if (!p) throw new Error("Persistent state missing");

    if (typeof p.accounts !== 'object') {
      if (DEBUG_STATE) console.warn('[GameState] Invalid accounts structure:', p.accounts);
      throw new Error('Invalid accounts structure');
    }

    if (!p.admin || typeof p.admin.overrides !== 'object') {
      if (DEBUG_STATE) console.warn('[GameState] Invalid admin overrides:', p.admin);
      throw new Error('Invalid admin overrides');
    }

    if (!p.admin.bans || typeof p.admin.bans.records !== 'object') {
      if (DEBUG_STATE) console.warn('[GameState] Invalid admin bans:', p.admin.bans);
      throw new Error('Invalid admin bans');
    }
  }

  // ── Core accessors ────────────────────────────────────────────────────────────

  /** Returns the full state object (both subtrees). */
  function get() { return _state; }

  /** Returns only the persistent subtree. Use for account / admin data. */
  function getPersistent() { return _state.persistent; }

  /** Returns only the session subtree. Use for online / transient data. */
  function getSession() { return _state.session; }

  /**
   * Shallow-merges `partial` onto the top-level state.
   * Prefer update() for nested mutations to avoid clobbering sibling keys.
   */
  function set(partial) {
    Object.assign(_state, partial);
  }

  /**
   * Passes a shallow-cloned draft to `fn` for mutation.
   * Validates persistent state after mutation; commits only if valid.
   * Always use the explicit subtree path, e.g.:
   *   GameState.update(s => { s.persistent.activeAccountId = id; });
   *   GameState.update(s => { s.session.online.connected = true; });
   */
  function update(fn) {
    const draft = {
      persistent: { ..._state.persistent },
      session:    { ..._state.session },
    };

    fn(draft);

    try {
      _validatePersistent(draft.persistent);
    } catch (e) {
      if (DEBUG_STATE) console.warn('[GameState] update() rejected — invalid state:', e.message);
      throw e;
    }

    _state.persistent = draft.persistent;
    _state.session    = draft.session;
  }

  // ── Convenience helper ────────────────────────────────────────────────────────

  /**
   * Returns the active account object, or null if none is set.
   * Shorthand for getPersistent().accounts[getPersistent().activeAccountId].
   */
  function getActiveAccount() {
    const p = _state.persistent;
    return (p.accounts && p.activeAccountId) ? (p.accounts[p.activeAccountId] || null) : null;
  }

  // ── Persistence ───────────────────────────────────────────────────────────────

  /**
   * Serializes _state.persistent to localStorage under 'smb_state'.
   * _state.session is intentionally excluded — it is runtime-only.
   * Throws if persistent state fails validation; nothing is written in that case.
   */
  function save() {
    _validatePersistent(_state.persistent); // throws before touching localStorage
    try {
      localStorage.setItem('smb_state', JSON.stringify(_state.persistent));
    } catch (e) {}
  }

  /**
   * Loads persistent state into _state.persistent from localStorage.
   *
   * Priority:
   *   1. 'smb_state' key  (written by GameState.save())
   *   2. Legacy 'stickman_accounts' key  (written by the old AccountManager)
   *
   * The legacy key is never deleted — this is a non-destructive one-way
   * migration. The next call to save() will write 'smb_state' and future
   * loads will use that key.
   */
  function load() {
    // ── Prefer canonical key ─────────────────────────────────────────────────
    try {
      const raw = localStorage.getItem('smb_state');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          // Assign parsed data, then ensure required sub-objects always exist.
          _state.persistent = Object.assign(
            { activeAccountId: null, accounts: {}, admin: { overrides: {}, bans: { records: {} } } },
            parsed
          );
          if (!_state.persistent.admin)           _state.persistent.admin           = { overrides: {} };
          if (!_state.persistent.admin.overrides) _state.persistent.admin.overrides = {};
          if (!_state.persistent.admin.bans)      _state.persistent.admin.bans      = { records: {} };
          if (!_state.persistent.admin.bans.records) _state.persistent.admin.bans.records = {};
          _validatePersistent(_state.persistent);
          return;
        }
      }
    } catch (e) {}

    // ── Fall back: migrate legacy 'stickman_accounts' key ────────────────────
    try {
      const legacy = localStorage.getItem('stickman_accounts');
      if (legacy) {
        const parsed = JSON.parse(legacy);
        if (parsed && parsed.accounts && parsed.activeAccountId) {
          _state.persistent.accounts        = parsed.accounts;
          _state.persistent.activeAccountId = parsed.activeAccountId;
          if (!_state.persistent.admin)           _state.persistent.admin           = { overrides: {}, bans: { records: {} } };
          if (!_state.persistent.admin.overrides) _state.persistent.admin.overrides = {};
          if (!_state.persistent.admin.bans)      _state.persistent.admin.bans      = { records: {} };
          if (!_state.persistent.admin.bans.records) _state.persistent.admin.bans.records = {};
          // Do NOT call save() here — smb-accounts.js finalizes and saves
          // after validating the migrated data.
        }
      }
    } catch (e) {}
  }

  // ── Session helpers ───────────────────────────────────────────────────────────

  /**
   * Resets session.online to its default idle shape.
   * Call when leaving a lobby or on clean disconnect.
   */
  function resetSession() {
    _state.session = {
      online: {
        lobbyId:   null,
        role:      null,
        connected: false,
      },
    };
  }

  /**
   * Shallow-merges `data` onto session.online.
   * Use instead of direct mutation so all online-state writes are traceable.
   *   GameState.setOnlineState({ lobbyId: 'abc', role: 'host', connected: true });
   */
  function setOnlineState(data) {
    _state.session.online = {
      ..._state.session.online,
      ...data,
    };
  }

  // Eager load: _state is fully populated before any downstream IIFE runs.
  load();

  return { get, getPersistent, getSession, set, update, save, load, getActiveAccount, resetSession, setOnlineState };

})();
