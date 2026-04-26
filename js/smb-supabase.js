'use strict';

// smb-supabase.js — Supabase auth + cloud save bridge
//
// Loaded before smb-accounts.js / smb-save.js so the rest of the game can
// query auth state and queue syncs without knowing about Supabase internals.

window.SMB_SUPABASE_CONFIG = window.SMB_SUPABASE_CONFIG || {
  url: 'https://cpqlqaynealpilmvollv.supabase.co',
  anonKey: 'sb_publishable_kGUxVfyEd6i4UeLPDBb_Ag_6jEYsZvh',
  authStorageKey: 'smc_supabase_auth_v1',
};

const SupabaseBridge = (() => {
  const _listeners = new Set();
  const _storageKey = (window.SMB_SUPABASE_CONFIG && window.SMB_SUPABASE_CONFIG.authStorageKey) || 'smc_supabase_auth_v1';

  let _clientPromise = null;
  let _client = null;
  let _bootPromise = null;
  let _session = null;
  let _user = null;
  let _ready = false;
  let _syncTimer = null;
  let _syncQueued = null;
  let _syncInFlight = false;
  let _lastStatus = 'disconnected';

  function _cfg() {
    return window.SMB_SUPABASE_CONFIG || {};
  }

  function isAvailable() {
    const cfg = _cfg();
    return !!(cfg.url && cfg.anonKey);
  }

  function _menuButtonLabel() {
    if (!isAvailable()) return '👤 Account & Saves';
    if (!_ready) return '👤 Account & Saves...';
    if (!_session || !_user) return '👤 Account & Saves';
    const label = _user.email || _user.user_metadata?.full_name || _user.id.slice(0, 8);
    return '👤 ' + String(label).split('@')[0].slice(0, 18);
  }

  function _saveRuntimeReady() {
    return isRuntimeReady() && typeof window._gatherSaveData === 'function' && typeof window.saveGame === 'function';
  }

  function isRuntimeReady() {
    return typeof window.getStoryDataForSave === 'function' && typeof window.restoreStoryDataFromSave === 'function';
  }

  function _updateMenuButton() {
    const btn = document.getElementById('accountsSavesBtn') || document.getElementById('cloudAuthBtn');
    if (!btn) return;
    btn.textContent = _menuButtonLabel();
    btn.title = _session
      ? ('Signed in as ' + (_user?.email || 'cloud user'))
      : (isAvailable() ? 'Open account, local save, and cloud sync settings' : 'Supabase config missing');
  }

  function _emit(event, payload) {
    _updateMenuButton();
    const msg = {
      ready: _ready,
      status: _lastStatus,
      session: _session,
      user: _user,
      event: event || 'update',
      payload: payload || null,
    };
    _listeners.forEach(function(fn) {
      try { fn(msg); } catch (e) {}
    });
  }

  async function _loadClientModule() {
    return import('https://esm.sh/@supabase/supabase-js@2');
  }

  async function getClient() {
    if (_client) return _client;
    if (_clientPromise) return _clientPromise;
    _clientPromise = (async function() {
      if (!isAvailable()) throw new Error('Supabase config is missing');
      const mod = await _loadClientModule();
      const cfg = _cfg();
      _client = mod.createClient(cfg.url, cfg.anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storage: window.localStorage,
          storageKey: _storageKey,
        },
      });
      _client.auth.onAuthStateChange(function(event, session) {
        _session = session || null;
        _user = session ? session.user : null;
        _ready = true;
        _lastStatus = session ? 'signed_in' : 'signed_out';
        _emit(event, session);
        if (session && _saveRuntimeReady()) {
          void reconcileActiveSave();
        }
      });
      return _client;
    })();
    return _clientPromise;
  }

  async function bootstrap() {
    if (_bootPromise) return _bootPromise;
    _bootPromise = (async function() {
      try {
        const client = await getClient();
        const res = await client.auth.getSession();
        _session = res && res.data ? res.data.session : null;
        _user = _session ? _session.user : null;
        _ready = true;
        _lastStatus = _session ? 'signed_in' : 'signed_out';
        _emit('bootstrap', _session);
        if (_session && _saveRuntimeReady()) {
          void reconcileActiveSave();
        }
        return _session;
      } catch (e) {
        _ready = true;
        _lastStatus = 'error';
        _emit('bootstrap_error', e);
        return null;
      }
    })();
    return _bootPromise;
  }

  async function ensureReady() {
    await bootstrap();
    return _session;
  }

  function onChange(fn) {
    if (typeof fn !== 'function') return function() {};
    _listeners.add(fn);
    return function() { _listeners.delete(fn); };
  }

  function getState() {
    return {
      ready: _ready,
      status: _lastStatus,
      session: _session,
      user: _user,
      available: isAvailable(),
    };
  }

  function getSession() {
    return _session;
  }

  function getUser() {
    return _user;
  }

  function isSignedIn() {
    return !!(_session && _user);
  }

  function _redirectTarget() {
    return window.location.href.split('#')[0];
  }

  async function signUp(email, password) {
    const client = await getClient();
    return client.auth.signUp({
      email: String(email || '').trim(),
      password: String(password || ''),
      options: {
        emailRedirectTo: _redirectTarget(),
      },
    });
  }

  async function signIn(email, password) {
    const client = await getClient();
    return client.auth.signInWithPassword({
      email: String(email || '').trim(),
      password: String(password || ''),
    });
  }

  async function signOut() {
    if (!_client && !_clientPromise) return { error: null };
    const client = await getClient();
    const res = await client.auth.signOut();
    _session = null;
    _user = null;
    _ready = true;
    _lastStatus = 'signed_out';
    _emit('signed_out', res);
    return res;
  }

  function _localSaveTimestamp(save) {
    const meta = save && save.meta ? save.meta : null;
    const ts = meta && typeof meta.updatedAt === 'number' ? meta.updatedAt : 0;
    return ts || 0;
  }

  function _runtimeSave() {
    if (typeof window._gatherSaveData === 'function') return window._gatherSaveData();
    if (typeof window.GameState !== 'undefined' && typeof window.saveGame === 'function') {
      try { return window._gatherSaveData(); } catch (e) {}
    }
    return null;
  }

  function _saveTimestampFromRow(row) {
    if (!row) return 0;
    const ts = row.client_updated_at || row.updated_at || row.created_at || null;
    const parsed = ts ? Date.parse(ts) : 0;
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function _cloneSave(save) {
    if (!save) return null;
    try { return JSON.parse(JSON.stringify(save)); } catch (e) { return null; }
  }

  function _uniqMerge(primary, secondary) {
    const out = [];
    const push = function(value) {
      if (value === null || value === undefined || value === '') return;
      const key = typeof value === 'number' ? String(value) : String(value).trim();
      if (!key) return;
      if (out.indexOf(key) === -1) out.push(key);
    };
    (Array.isArray(primary) ? primary : []).forEach(push);
    (Array.isArray(secondary) ? secondary : []).forEach(push);
    return out;
  }

  function _fractureMap(save) {
    const out = {};
    const add = function(entry) {
      if (!entry || entry.id === undefined || entry.id === null) return;
      const id = String(entry.id);
      out[id] = {
        id: id,
        unlocked: !!entry.unlocked,
        previewed: !!entry.previewed,
        completed: !!entry.completed,
      };
    };
    if (save && save.progression && Array.isArray(save.progression.fractures)) save.progression.fractures.forEach(add);
    return out;
  }

  function _saveMeaningfulScore(save) {
    if (!save || typeof save !== 'object') return 0;
    let score = 0;
    if (typeof save.coins === 'number' && save.coins > 0) score += 1;
    if (Array.isArray(save.cosmetics) && save.cosmetics.length > 0) score += 2;
    if (save.unlocks) {
      if (save.unlocks.bossBeaten) score += 2;
      if (save.unlocks.trueform) score += 3;
      if (save.unlocks.megaknight) score += 2;
      if (Array.isArray(save.unlocks.letters) && save.unlocks.letters.length > 0) score += 1;
      if (Array.isArray(save.unlocks.achievements) && save.unlocks.achievements.length > 0) score += 1;
      if (save.unlocks.sovereignBeaten) score += 2;
      if (save.unlocks.storyOnline) score += 2;
      if (save.unlocks.tfEndingSeen) score += 1;
      if (save.unlocks.damnationScar) score += 1;
      if (save.unlocks.storyDodgeUnlocked) score += 1;
      if (save.unlocks.paradoxCompanion) score += 1;
      if (save.unlocks.interTravel) score += 1;
      if (save.unlocks.patrolMode) score += 1;
      if (save.unlocks.godEncountered) score += 1;
      if (save.unlocks.godDefeated) score += 1;
    }
    if (save.storyProgress) {
      if (typeof save.storyProgress.act === 'number' && save.storyProgress.act > 0) score += 2;
      if (typeof save.storyProgress.chapter === 'number' && save.storyProgress.chapter > 0) score += 1;
      if (save.storyProgress.flags && Object.keys(save.storyProgress.flags).length > 0) score += 1;
    }
    if (save.story) {
      if (Array.isArray(save.story.defeated) && save.story.defeated.length > 0) score += 3;
      if (Array.isArray(save.story.blueprints) && save.story.blueprints.length > 0) score += 1;
      if (Array.isArray(save.story.unlockedAbilities) && save.story.unlockedAbilities.length > 0) score += 1;
      if (save.story.storyComplete) score += 3;
    }
    if (save.progression) {
      if (save.progression.ship && save.progression.ship.built) score += 2;
      if (Array.isArray(save.progression.fractures) && save.progression.fractures.some(function(f) { return f && (f.unlocked || f.previewed || f.completed); })) score += 2;
      if (typeof save.progression.motivationStage === 'number' && save.progression.motivationStage > 0) score += 1;
    }
    if (save.settings) {
      if (typeof save.settings.sfxVol === 'number' && save.settings.sfxVol !== 0.35) score += 1;
      if (save.settings.sfxMute || save.settings.musicMute || save.settings.ragdoll) score += 1;
    }
    return score;
  }

  function _mergeSaveData(primary, secondary) {
    const out = _cloneSave(primary) || _cloneSave(secondary) || null;
    if (!out || !secondary) return out;
    const other = secondary;
    out.version = Math.max(out.version || 3, other.version || 3);

    out.unlocks = Object.assign({}, other.unlocks || {}, out.unlocks || {});
    if (other.unlocks) {
      const u = out.unlocks;
      u.bossBeaten         = !!(u.bossBeaten         || other.unlocks.bossBeaten);
      u.trueform           = !!(u.trueform           || other.unlocks.trueform);
      u.megaknight         = !!(u.megaknight         || other.unlocks.megaknight);
      u.sovereignBeaten    = !!(u.sovereignBeaten    || other.unlocks.sovereignBeaten);
      u.storyOnline        = !!(u.storyOnline        || other.unlocks.storyOnline);
      u.tfEndingSeen       = !!(u.tfEndingSeen       || other.unlocks.tfEndingSeen);
      u.damnationScar      = !!(u.damnationScar      || other.unlocks.damnationScar);
      u.storyDodgeUnlocked = !!(u.storyDodgeUnlocked || other.unlocks.storyDodgeUnlocked);
      u.paradoxCompanion   = !!(u.paradoxCompanion   || other.unlocks.paradoxCompanion);
      u.interTravel        = !!(u.interTravel        || other.unlocks.interTravel);
      u.patrolMode         = !!(u.patrolMode         || other.unlocks.patrolMode);
      u.godEncountered     = !!(u.godEncountered     || other.unlocks.godEncountered);
      u.godDefeated        = !!(u.godDefeated        || other.unlocks.godDefeated);
      u.letters            = _uniqMerge(u.letters, other.unlocks.letters);
      u.achievements       = _uniqMerge(u.achievements, other.unlocks.achievements);
    }

    out.cosmetics = _uniqMerge(out.cosmetics, other.cosmetics);

    if (other.storyProgress) {
      out.storyProgress = out.storyProgress || {};
      out.storyProgress.flags = Object.assign({}, other.storyProgress.flags || {}, out.storyProgress.flags || {});
    }
    if (other.story && out.story) {
      out.story.defeated = _uniqMerge(out.story.defeated, other.story.defeated).map(function(v) {
        const n = Number(v);
        return Number.isFinite(n) ? n : v;
      }).sort(function(a, b) { return Number(a) - Number(b); });
      out.story.blueprints = _uniqMerge(out.story.blueprints, other.story.blueprints);
      out.story.unlockedAbilities = _uniqMerge(out.story.unlockedAbilities, other.story.unlockedAbilities);
      out.story.storyComplete = !!(out.story.storyComplete || other.story.storyComplete);
    }
    if (other.progression) {
      out.progression = out.progression || {};
      if (other.progression.ship) {
        out.progression.ship = out.progression.ship || {};
        out.progression.ship.built = !!((out.progression.ship && out.progression.ship.built) || other.progression.ship.built);
        if (other.progression.ship.parts) {
          out.progression.ship.parts = Object.assign({}, other.progression.ship.parts, out.progression.ship.parts || {});
        }
      }
      const mineFract = _fractureMap(out);
      const otherFract = _fractureMap(other);
      const mergedFractures = {};
      Object.keys(otherFract).concat(Object.keys(mineFract)).forEach(function(id) {
        const mine = mineFract[id] || { id: id, unlocked: false, previewed: false, completed: false };
        const theirs = otherFract[id] || { id: id, unlocked: false, previewed: false, completed: false };
        mergedFractures[id] = {
          id: id,
          unlocked:  !!(mine.unlocked  || theirs.unlocked),
          previewed: !!(mine.previewed || theirs.previewed),
          completed:  !!(mine.completed  || theirs.completed),
        };
      });
      if (Object.keys(mergedFractures).length > 0) {
        out.progression.fractures = Object.values(mergedFractures);
      }
      if (typeof other.progression.motivationStage === 'number') {
        const mineStage = typeof out.progression.motivationStage === 'number' ? out.progression.motivationStage : 0;
        out.progression.motivationStage = Math.max(mineStage, other.progression.motivationStage);
      }
    }

    if (other.settings) {
      out.settings = out.settings || {};
      if (typeof out.settings.sfxVol !== 'number') out.settings.sfxVol = other.settings.sfxVol;
      if (typeof out.settings.sfxMute === 'undefined') out.settings.sfxMute = !!other.settings.sfxMute;
      if (typeof out.settings.musicMute === 'undefined') out.settings.musicMute = !!other.settings.musicMute;
      if (typeof out.settings.ragdoll === 'undefined') out.settings.ragdoll = !!other.settings.ragdoll;
    }

    return out;
  }

  function _coalesceList(primary, secondary) {
    const out = [];
    const push = function(value) {
      if (value === null || value === undefined || value === '') return;
      const key = String(value);
      if (out.indexOf(key) === -1) out.push(key);
    };
    (Array.isArray(primary) ? primary : []).forEach(push);
    (Array.isArray(secondary) ? secondary : []).forEach(push);
    return out;
  }

  function _buildProgressRow(save) {
    return {
      user_id: _user.id,
      save_version: save.version || 3,
      progress_data: {
        storyProgress: save.storyProgress || null,
        progression: save.progression || null,
        unlocks: save.unlocks || null,
        coins: typeof save.coins === 'number' ? save.coins : 0,
        cosmetics: Array.isArray(save.cosmetics) ? save.cosmetics : [],
        settings: save.settings || null,
      },
      updated_at: new Date().toISOString(),
    };
  }

  function _buildStatsRow(save) {
    const sessionStats = (typeof window._achStats === 'object' && window._achStats) ? window._achStats : {};
    const stats = {
      session: sessionStats,
      winsP1: (typeof window.winsP1 === 'number') ? window.winsP1 : 0,
      winsP2: (typeof window.winsP2 === 'number') ? window.winsP2 : 0,
      playerCoins: (typeof window.playerCoins === 'number') ? window.playerCoins : 0,
      cosmeticsUnlocked: Array.isArray(save.cosmetics) ? save.cosmetics.length : 0,
      storyChaptersBeaten: save.story && Array.isArray(save.story.defeated) ? save.story.defeated.length : 0,
      achievements: save.unlocks && Array.isArray(save.unlocks.achievements) ? save.unlocks.achievements.length : 0,
    };
    return {
      user_id: _user.id,
      stats_data: stats,
      updated_at: new Date().toISOString(),
    };
  }

  function _buildSnapshotRow(save) {
    const data = JSON.parse(JSON.stringify(save || {}));
    data.meta = data.meta || {};
    if (typeof data.meta.updatedAt !== 'number' || !data.meta.updatedAt) data.meta.updatedAt = Date.now();
    data.meta.source = 'cloud';
    return {
      user_id: _user.id,
      save_version: data.version || 3,
      save_data: data,
      client_updated_at: new Date(data.meta.updatedAt).toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  function _buildProfileRow(save) {
    const active = (typeof window.GameState !== 'undefined' && typeof GameState.getActiveAccount === 'function')
      ? GameState.getActiveAccount()
      : null;
    const profileName = active && active.username
      ? active.username
      : (save && save.profile && save.profile.displayName) || (_user.email ? _user.email.split('@')[0] : 'Player');
    return {
      user_id: _user.id,
      email: _user.email || '',
      display_name: String(profileName || 'Player').slice(0, 32),
      provider: (_user.app_metadata && _user.app_metadata.provider) ? String(_user.app_metadata.provider) : 'email',
      last_login_at: new Date().toISOString(),
      last_sync_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  function _extractWeapons(save) {
    const raw = [];
    const add = function(value) {
      if (value === null || value === undefined || value === '') return;
      const key = String(value).trim();
      if (!key) return;
      if (raw.indexOf(key) === -1) raw.push(key);
    };
    if (Array.isArray(save.weaponsUnlocked)) save.weaponsUnlocked.forEach(add);
    if (save.unlocks && Array.isArray(save.unlocks.weapons)) save.unlocks.weapons.forEach(add);
    if (save.story && Array.isArray(save.story.unlockedWeapons)) save.story.unlockedWeapons.forEach(add);
    if (save.progression && Array.isArray(save.progression.weapons)) save.progression.weapons.forEach(add);
    return raw;
  }

  function _extractChapters(save) {
    const chapters = [];
    if (save.story && Array.isArray(save.story.defeated)) {
      save.story.defeated.forEach(function(idx) {
        const n = Number(idx);
        if (Number.isFinite(n) && chapters.indexOf(n) === -1) chapters.push(n);
      });
    }
    return chapters;
  }

  function _extractCosmetics(save) {
    const ids = [];
    if (Array.isArray(save.cosmetics)) {
      save.cosmetics.forEach(function(id) {
        const key = String(id || '').trim();
        if (key && ids.indexOf(key) === -1) ids.push(key);
      });
    }
    return ids;
  }

  async function _upsertRows(client, table, rows, conflictCol) {
    if (!rows || rows.length === 0) {
      const del = await client.from(table).delete().eq('user_id', _user.id);
      if (del.error) throw del.error;
      return;
    }
    const payload = rows.map(function(row) {
      return Object.assign({ user_id: _user.id }, row);
    });
    const opts = conflictCol ? { onConflict: 'user_id,' + conflictCol } : {};
    const res = await client.from(table).upsert(payload, opts);
    if (res.error) throw res.error;
  }

  async function syncFromRuntime(saveOverride) {
    if (!isAvailable()) return { skipped: true, reason: 'unavailable' };
    if (_syncInFlight) return { skipped: true, reason: 'in_flight' };
    await ensureReady();
    if (!_session || !_user) return { skipped: true, reason: 'signed_out' };
    const save = saveOverride || _runtimeSave();
    if (!save) return { skipped: true, reason: 'no-save' };
    const client = await getClient();
    const saveCopy = JSON.parse(JSON.stringify(save));
    if (!saveCopy.meta) saveCopy.meta = {};
    if (typeof saveCopy.meta.updatedAt !== 'number' || !saveCopy.meta.updatedAt) saveCopy.meta.updatedAt = Date.now();
    saveCopy.meta.source = 'local';

    const weapons = _extractWeapons(saveCopy);
    const chapters = _extractChapters(saveCopy);
    const cosmetics = _extractCosmetics(saveCopy);

    const weaponRows = weapons.map(function(weapon_key) {
      return { weapon_key: weapon_key, unlocked_at: new Date().toISOString() };
    });
    const chapterRows = chapters.map(function(chapter_index) {
      return { chapter_index: chapter_index, beaten_at: new Date().toISOString() };
    });
    const cosmeticRows = cosmetics.map(function(cosmetic_id) {
      return { cosmetic_id: cosmetic_id, unlocked_at: new Date().toISOString() };
    });

    try {
      _syncInFlight = true;
      const profileRes = await client.from('player_profiles').upsert(_buildProfileRow(saveCopy));
      if (profileRes.error) throw profileRes.error;
      const progressRes = await client.from('player_progress').upsert(_buildProgressRow(saveCopy));
      if (progressRes.error) throw progressRes.error;
      const statsRes = await client.from('player_stats').upsert(_buildStatsRow(saveCopy));
      if (statsRes.error) throw statsRes.error;
      const snapshotRes = await client.from('player_save_snapshots').upsert(_buildSnapshotRow(saveCopy));
      if (snapshotRes.error) throw snapshotRes.error;
      await _upsertRows(client, 'player_unlocked_weapons', weaponRows, 'weapon_key');
      await _upsertRows(client, 'player_chapters_beaten', chapterRows, 'chapter_index');
      await _upsertRows(client, 'player_cosmetics', cosmeticRows, 'cosmetic_id');
      if (typeof window.GameState !== 'undefined' && typeof GameState.update === 'function' && typeof GameState.save === 'function') {
        GameState.update(function(s) {
          const acct = s.persistent.accounts && s.persistent.activeAccountId
            ? s.persistent.accounts[s.persistent.activeAccountId]
            : null;
          if (acct) {
            if (!acct.data) acct.data = {};
            acct.data.meta = Object.assign({}, acct.data.meta || {}, {
              updatedAt: saveCopy.meta.updatedAt,
              source: 'cloud',
            });
          }
        });
        GameState.save();
      }
      _emit('synced', { source: 'local', userId: _user.id });
      return { ok: true };
    } finally {
      _syncInFlight = false;
      _syncQueued = null;
    }
  }

  async function fetchRemoteSave() {
    if (!isAvailable()) return null;
    await ensureReady();
    if (!_session || !_user) return null;
    const client = await getClient();
    const { data, error } = await client
      .from('player_save_snapshots')
      .select('save_version, save_data, updated_at, client_updated_at')
      .eq('user_id', _user.id)
      .maybeSingle();
    if (error) throw error;
    return data || null;
  }

  async function reconcileActiveSave() {
    if (!isAvailable()) return { skipped: true, reason: 'unavailable' };
    await ensureReady();
    if (!_session || !_user) return { skipped: true, reason: 'signed_out' };

    const local = _runtimeSave();
    const remote = await fetchRemoteSave();
    const localTs = _localSaveTimestamp(local);
    const remoteTs = _saveTimestampFromRow(remote);
    const localScore = _saveMeaningfulScore(local);
    const remoteScore = _saveMeaningfulScore(remote && remote.save_data ? remote.save_data : null);
    const hasRemote = !!(remote && remote.save_data);
    const chooseRemote = hasRemote && (
      (!local && remoteScore > 0) ||
      (remoteScore > 0 && localScore === 0) ||
      (remoteScore > 0 && localScore > 0 && remoteTs >= localTs)
    );

    if (chooseRemote) {
      const merged = local ? _mergeSaveData(remote.save_data, local) : _cloneSave(remote.save_data);
      if (merged && typeof window._applySaveData === 'function') window._applySaveData(merged);
      if (merged && typeof window._refreshRuntimeFromSave === 'function') window._refreshRuntimeFromSave(merged);
      if (typeof window.GameState !== 'undefined' && typeof saveGame === 'function') {
        window.__SMB_SUPPRESS_CLOUD_SYNC = true;
        window.__SMB_PENDING_SAVE_TIMESTAMP = remoteTs || Date.now();
        try { saveGame(); } finally {
          window.__SMB_SUPPRESS_CLOUD_SYNC = false;
          window.__SMB_PENDING_SAVE_TIMESTAMP = undefined;
        }
      }
      _emit('loaded_remote', { updatedAt: remote.updated_at || remote.client_updated_at || null });
      return { source: 'cloud' };
    }

    if (local) {
      const merged = hasRemote ? _mergeSaveData(local, remote.save_data) : local;
      await syncFromRuntime(merged);
      _emit('loaded_local', { updatedAt: localTs || null });
      return { source: 'local' };
    }

    return { skipped: true, reason: 'no-local-save' };
  }

  function queueSyncFromRuntime(saveOverride) {
    if (!isAvailable()) return;
    if (!_session || !_user) return;
    _syncQueued = saveOverride || _runtimeSave();
    if (!_syncQueued) return;
    if (_syncTimer) clearTimeout(_syncTimer);
    _syncTimer = setTimeout(async function() {
      _syncTimer = null;
      if (_syncInFlight) return;
      try {
        await syncFromRuntime(_syncQueued);
      } catch (e) {
        _emit('sync_error', e);
      } finally {
        _syncQueued = null;
      }
    }, 800);
  }

  async function signInAndLoad(email, password) {
    const res = await signIn(email, password);
    if (res && !res.error) {
      await reconcileActiveSave();
    }
    return res;
  }

  async function signUpAndLoad(email, password) {
    const res = await signUp(email, password);
    if (res && res.data && res.data.session) {
      await reconcileActiveSave();
    }
    return res;
  }

  function suppressNextSync() {
    window.__SMB_SUPPRESS_CLOUD_SYNC = true;
  }

  function clearSuppressNextSync() {
    window.__SMB_SUPPRESS_CLOUD_SYNC = false;
  }

  void bootstrap();

  return {
    isAvailable,
    isRuntimeReady,
    ensureReady,
    bootstrap,
    getClient,
    getState,
    getSession,
    getUser,
    isSignedIn,
    onChange,
    signUp,
    signIn,
    signOut,
    signInAndLoad,
    signUpAndLoad,
    fetchRemoteSave,
    reconcileActiveSave,
    queueSyncFromRuntime,
    suppressNextSync,
    clearSuppressNextSync,
  };
})();

window.SupabaseBridge = SupabaseBridge;
