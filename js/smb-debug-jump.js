'use strict';
// smb-debug-jump.js — F8 developer jump menu (story/cinematic/arena/boss fast-travel)
// Depends on: smb-globals.js, smb-debug-console.js, smb-story-engine.js, smb-menu-startcore.js
// Must load AFTER smb-debug-console.js

// ============================================================
// F8 DEVELOPER JUMP MENU
// Opens only when debugMode is true (F1/F2/F3 activates it,
// or type "debugmode" to toggle). No effect on normal gameplay.
// ============================================================

// ---- Jump menu helpers ----
function _dbgJumpMenuClose() {
  const p = document.getElementById('_dbgJumpPanel');
  if (p) p.remove();
}

function _dbgJumpMenuOpen() {
  _dbgJumpMenuClose(); // idempotent

  const ov = document.createElement('div');
  ov.id = '_dbgJumpPanel';
  ov.style.cssText = [
    'position:fixed','top:0','right:0','bottom:0','z-index:9995',
    'background:rgba(5,10,25,0.96)','border-left:2px solid #0f0',
    'width:320px','overflow-y:auto','font-family:monospace',
    'color:#0f0','padding:14px 16px','box-sizing:border-box',
  ].join(';');

  // Header
  const hdr = document.createElement('div');
  hdr.style.cssText = 'font-size:1rem;font-weight:bold;letter-spacing:2px;margin-bottom:12px;border-bottom:1px solid #0a0;padding-bottom:8px;display:flex;align-items:center;justify-content:space-between;';
  hdr.innerHTML = '<span>⚡ DEV JUMP MENU</span>';
  const closeBtn = document.createElement('button');
  closeBtn.textContent = '✕';
  closeBtn.style.cssText = 'background:none;border:1px solid #0a0;color:#0f0;cursor:pointer;font-family:monospace;padding:2px 8px;border-radius:4px;font-size:0.9rem;';
  closeBtn.onclick = _dbgJumpMenuClose;
  hdr.appendChild(closeBtn);
  ov.appendChild(hdr);

  const hint = document.createElement('div');
  hint.style.cssText = 'font-size:0.72rem;color:#446644;margin-bottom:14px;';
  hint.textContent = 'F8 to toggle  •  dev-only  •  no effect when debugMode is off';
  ov.appendChild(hint);

  // Helper: section heading
  function _sec(label) {
    const d = document.createElement('div');
    d.style.cssText = 'font-size:0.78rem;letter-spacing:1px;color:#44bb66;margin:10px 0 5px;border-top:1px solid #0a0;padding-top:8px;';
    d.textContent = '── ' + label + ' ──';
    ov.appendChild(d);
  }

  // Helper: row with label + input + button
  function _row(label, inputEl, btnLabel, onBtn) {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:5px;align-items:center;margin:4px 0;';
    const lbl = document.createElement('span');
    lbl.style.cssText = 'font-size:0.75rem;color:#88aa88;min-width:60px;';
    lbl.textContent = label;
    const btn = document.createElement('button');
    btn.textContent = btnLabel;
    btn.style.cssText = 'background:rgba(0,180,0,0.18);border:1px solid #0a0;color:#0f0;font-family:monospace;font-size:0.75rem;padding:3px 8px;border-radius:4px;cursor:pointer;white-space:nowrap;';
    btn.onclick = () => { onBtn(inputEl ? inputEl.value : null); };
    if (inputEl) {
      inputEl.style.cssText = 'flex:1;background:rgba(0,30,0,0.9);border:1px solid #0a0;color:#0f0;font-family:monospace;font-size:0.75rem;padding:3px 6px;border-radius:4px;min-width:0;';
      row.appendChild(lbl); row.appendChild(inputEl); row.appendChild(btn);
    } else {
      btn.style.width = '100%';
      row.appendChild(lbl); row.appendChild(btn);
    }
    ov.appendChild(row);
  }

  // Helper: styled select
  function _sel(optMap) {
    const s = document.createElement('select');
    s.style.cssText = 'flex:1;background:rgba(0,30,0,0.9);border:1px solid #0a0;color:#0f0;font-family:monospace;font-size:0.75rem;padding:3px 6px;border-radius:4px;min-width:0;';
    for (const [val, text] of Object.entries(optMap)) {
      const o = document.createElement('option');
      o.value = val; o.textContent = text;
      s.appendChild(o);
    }
    return s;
  }

  // Helper: number input
  function _numIn(dflt, min, max) {
    const i = document.createElement('input');
    i.type = 'number'; i.value = dflt; i.min = min; i.max = max;
    return i;
  }

  // ── Section 1: Story Fight ─────────────────────────────────────────────
  _sec('STORY FIGHT');
  const sfChapSel = _sel({
    0:'Ch 0 — Prologue', 1:'Ch 1 — Act 1', 2:'Ch 2', 3:'Ch 3', 4:'Ch 4',
    5:'Ch 5', 6:'Ch 6', 7:'Ch 7', 8:'Ch 8', 9:'Ch 9',
  });
  _row('Chapter', sfChapSel, '▶ Load', (v) => loadStoryFight(parseInt(v, 10)));

  // ── Section 2: Play Cinematic ──────────────────────────────────────────
  _sec('CINEMATIC');
  const cinSel = _sel({
    'boss_intro':  'Boss Intro (Backstory)',
    'boss_phase2': 'Boss → Phase 2',
    'boss_rage':   'Boss → Rage (40%)',
    'boss_desp':   'Boss → Desperate (10%)',
    'tf_entry':    'TrueForm Entry',
    'tf_reality':  'TrueForm Reality (50%)',
    'tf_desp':     'TrueForm Desperate (15%)',
    'multiverse':  'Multiverse Travel',
  });
  _row('Cinematic', cinSel, '▶ Play', (v) => playCinematic(v));

  // ── Section 3: Spawn in Arena ──────────────────────────────────────────
  _sec('SPAWN ARENA');
  const arenaKeys = (typeof ARENAS !== 'undefined')
    ? Object.keys(ARENAS).filter(k => k !== 'creator' && k !== 'void')
    : ['grass','lava','space','city','forest','ice','ruins'];
  const arenaSel = _sel(Object.fromEntries(arenaKeys.map(k => [k, k.charAt(0).toUpperCase() + k.slice(1)])));
  _row('Arena', arenaSel, '▶ Go', (v) => spawnInArena(v));

  // ── Section 4: Force Boss Fight ────────────────────────────────────────
  _sec('BOSS FIGHT');
  const bossSel = _sel({
    'boss':     'Standard Boss',
    'trueform': 'True Form',
  });
  _row('Boss', bossSel, '▶ Start', (v) => forceBossFight(v));

  // ── Status readout ─────────────────────────────────────────────────────
  const statusDiv = document.createElement('div');
  statusDiv.id = '_dbgJumpStatus';
  statusDiv.style.cssText = 'margin-top:14px;border-top:1px solid #0a0;padding-top:8px;font-size:0.72rem;color:#44aa66;min-height:32px;';
  statusDiv.textContent = 'Ready.';
  ov.appendChild(statusDiv);

  document.body.appendChild(ov);
}

function _dbgJumpStatus(msg, isErr) {
  const d = document.getElementById('_dbgJumpStatus');
  if (!d) return;
  d.style.color = isErr ? '#ff5555' : '#44ff88';
  d.textContent = msg;
}

// ---- 4 debug jump functions ----

/**
 * loadStoryFight(chapterId)
 * Navigates to Story Mode and starts the given chapter.
 * Safe guard: does nothing if debugMode is off.
 */
function loadStoryFight(chapterId) {
  if (!debugMode) return;
  const id = parseInt(chapterId, 10);
  if (isNaN(id)) { _dbgJumpStatus('Invalid chapter id: ' + chapterId, true); return; }
  if (typeof startStoryFromMenu !== 'function') {
    _dbgJumpStatus('startStoryFromMenu() not available — is smb-story-config.js loaded?', true);
    return;
  }
  try {
    // If a game is running, return to menu first
    if (typeof gameRunning !== 'undefined' && gameRunning && typeof backToMenu === 'function') {
      backToMenu();
    }
    if (typeof selectMode === 'function') selectMode('story');
    startStoryFromMenu(id);
    _dbgJumpStatus('Started story chapter ' + id + '.', false);
    _dbgJumpMenuClose();
  } catch(e) {
    _dbgJumpStatus('Error: ' + e.message, true);
    console.warn('[DBG] loadStoryFight error:', e);
  }
}

/**
 * playCinematic(cinematicId)
 * Triggers a named cinematic sequence by ID.
 * Boss/TF cinematics require an active boss/TF entity in `players`.
 */
function playCinematic(cinematicId) {
  if (!debugMode) return;
  if (typeof isCinematic !== 'undefined' && isCinematic) {
    _dbgJumpStatus('A cinematic is already playing.', true); return;
  }

  // Locate boss or TF entity if needed
  const boss = (typeof players !== 'undefined') ? players.find(p => p.isBoss && !p.isTrueForm) : null;
  const tf   = (typeof players !== 'undefined') ? players.find(p => p.isTrueForm) : null;

  try {
    switch (cinematicId) {
      case 'boss_intro':
        if (typeof startBossBackstoryCinematic === 'function') {
          startBossBackstoryCinematic();
          _dbgJumpStatus('Playing: Boss Backstory intro.'); break;
        }
        _dbgJumpStatus('startBossBackstoryCinematic() not found.', true); break;

      case 'boss_phase2':
        if (!boss) { _dbgJumpStatus('No active Boss entity in players[].', true); break; }
        if (typeof _makeBossPhase2Cinematic === 'function') {
          if (typeof startCinematic === 'function') startCinematic(_makeBossPhase2Cinematic(boss));
          _dbgJumpStatus('Playing: Boss Phase 2 transition.'); break;
        }
        _dbgJumpStatus('_makeBossPhase2Cinematic() not found.', true); break;

      case 'boss_rage':
        if (!boss) { _dbgJumpStatus('No active Boss entity in players[].', true); break; }
        if (typeof _makeBossRage40Cinematic === 'function') {
          if (typeof startCinematic === 'function') startCinematic(_makeBossRage40Cinematic(boss));
          _dbgJumpStatus('Playing: Boss Rage (40%) cinematic.'); break;
        }
        _dbgJumpStatus('_makeBossRage40Cinematic() not found.', true); break;

      case 'boss_desp':
        if (!boss) { _dbgJumpStatus('No active Boss entity in players[].', true); break; }
        if (typeof _makeBossDesp10Cinematic === 'function') {
          if (typeof startCinematic === 'function') startCinematic(_makeBossDesp10Cinematic(boss));
          _dbgJumpStatus('Playing: Boss Desperate (10%) cinematic.'); break;
        }
        _dbgJumpStatus('_makeBossDesp10Cinematic() not found.', true); break;

      case 'tf_entry':
        if (!tf) { _dbgJumpStatus('No active TrueForm entity in players[].', true); break; }
        if (typeof _makeTFEntryCinematic === 'function') {
          if (typeof startCinematic === 'function') startCinematic(_makeTFEntryCinematic(tf));
          _dbgJumpStatus('Playing: TrueForm Entry cinematic.'); break;
        }
        _dbgJumpStatus('_makeTFEntryCinematic() not found.', true); break;

      case 'tf_reality':
        if (!tf) { _dbgJumpStatus('No active TrueForm entity in players[].', true); break; }
        if (typeof _makeTFReality50Cinematic === 'function') {
          if (typeof startCinematic === 'function') startCinematic(_makeTFReality50Cinematic(tf));
          _dbgJumpStatus('Playing: TrueForm Reality (50%) cinematic.'); break;
        }
        _dbgJumpStatus('_makeTFReality50Cinematic() not found.', true); break;

      case 'tf_desp':
        if (!tf) { _dbgJumpStatus('No active TrueForm entity in players[].', true); break; }
        if (typeof _makeTFDesp15Cinematic === 'function') {
          if (typeof startCinematic === 'function') startCinematic(_makeTFDesp15Cinematic(tf));
          _dbgJumpStatus('Playing: TrueForm Desperate (15%) cinematic.'); break;
        }
        _dbgJumpStatus('_makeTFDesp15Cinematic() not found.', true); break;

      case 'multiverse':
        if (typeof startMultiverseTravelCinematic === 'function') {
          startMultiverseTravelCinematic('Test Arc', '#88aaff', null);
          _dbgJumpStatus('Playing: Multiverse Travel cinematic.'); break;
        }
        _dbgJumpStatus('startMultiverseTravelCinematic() not found.', true); break;

      default:
        _dbgJumpStatus('Unknown cinematic id: ' + cinematicId, true);
    }
  } catch(e) {
    _dbgJumpStatus('Cinematic error: ' + e.message, true);
    console.warn('[DBG] playCinematic error:', e);
  }
}

/**
 * spawnInArena(arenaId)
 * If a game is running: hot-swaps the arena (same as SETMAP console cmd).
 * If no game is running: starts a 1v1 vs-bot match in the given arena.
 */
function spawnInArena(arenaId) {
  if (!debugMode) return;
  if (typeof ARENAS === 'undefined' || !ARENAS[arenaId]) {
    _dbgJumpStatus('Unknown arena: ' + arenaId, true); return;
  }
  try {
    if (typeof gameRunning !== 'undefined' && gameRunning) {
      // Hot-swap arena
      currentArenaKey = arenaId;
      currentArena    = ARENAS[arenaId];
      if (typeof randomizeArenaLayout === 'function') randomizeArenaLayout(arenaId);
      if (typeof generateBgElements   === 'function') generateBgElements();
      _dbgJumpStatus('Arena hot-swapped to: ' + arenaId);
      _dbgJumpMenuClose();
    } else {
      // Start a fresh game in that arena
      if (typeof backToMenu === 'function') backToMenu();
      if (typeof selectMode === 'function') selectMode('vs');
      if (typeof selectArena === 'function') selectArena(arenaId);
      if (typeof startGame  === 'function') startGame();
      _dbgJumpStatus('Starting game in arena: ' + arenaId);
      _dbgJumpMenuClose();
    }
  } catch(e) {
    _dbgJumpStatus('Arena error: ' + e.message, true);
    console.warn('[DBG] spawnInArena error:', e);
  }
}

/**
 * forceBossFight(bossId)
 * Immediately starts a boss fight.
 * bossId: 'boss' → standard 3-phase Boss; 'trueform' → True Form fight.
 */
function forceBossFight(bossId) {
  if (!debugMode) return;
  const mode = (bossId === 'trueform') ? 'trueform' : 'boss';
  try {
    if (typeof gameRunning !== 'undefined' && gameRunning && typeof backToMenu === 'function') {
      backToMenu();
    }
    if (typeof selectMode === 'function') selectMode(mode);
    if (typeof startGame  === 'function') startGame();
    _dbgJumpStatus('Starting ' + mode + ' fight…');
    _dbgJumpMenuClose();
  } catch(e) {
    _dbgJumpStatus('Boss start error: ' + e.message, true);
    console.warn('[DBG] forceBossFight error:', e);
  }
}
