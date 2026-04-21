// ============================================================
// SMB TEST HARNESS  —  smb-test-tools.js
// Dev/testing utilities. All functionality is gated behind:
//   window.DEBUG_MODE = true;
// NEVER affects production gameplay.
//
// Usage:
//   window.DEBUG_MODE = true;
//   smbTest.help();
//   smbTest.loadCreator();
// ============================================================
'use strict';

(function () {

  // ── Guard ─────────────────────────────────────────────────────────────────
  function _guard(label) {
    if (!window.DEBUG_MODE) {
      console.warn(`[smbTest:${label}] DEBUG_MODE is not enabled. Set window.DEBUG_MODE = true first.`);
      return false;
    }
    return true;
  }

  // ── Entity helpers ────────────────────────────────────────────────────────
  function _player()  {
    if (typeof players === 'undefined') return null;
    return players.find(p => p && !p.isAI && !p.isBoss && !p.isDummy) || null;
  }
  function _enemy()   {
    if (typeof players === 'undefined') return null;
    const pl = _player();
    return players.find(p => p && p !== pl) || null;
  }
  function _boss()    {
    if (typeof players === 'undefined') return null;
    return players.find(p => p && p.isBoss) || null;
  }
  function _adaptiveAI() {
    if (typeof players === 'undefined') return null;
    return players.find(p => p && (p.isAdaptive || p.isSovereignMk2)) || null;
  }

  // ── Quick-start helper ────────────────────────────────────────────────────
  // Sets gameMode (and optional arena), runs an optional pre-launch callback,
  // then calls startGame(). If a game is already running, goes to menu first.
  function _quickStart(mode, arenaKey, preCallback) {
    const _doLaunch = () => {
      if (typeof gameMode !== 'undefined') gameMode = mode;
      if (arenaKey && typeof selectedArena !== 'undefined') selectedArena = arenaKey;
      if (typeof preCallback === 'function') preCallback();
      if (typeof startGame === 'function') startGame();
    };

    if (typeof gameRunning !== 'undefined' && gameRunning) {
      if (typeof backToMenu === 'function') backToMenu();
      setTimeout(_doLaunch, 350);
    } else {
      _doLaunch();
    }
  }

  // ── Wait-for-game helper ──────────────────────────────────────────────────
  // Polls until gameRunning is true, then fires callback.
  function _waitForGame(cb, timeout) {
    const start = Date.now();
    const limit = timeout || 6000;
    const id = setInterval(() => {
      if (typeof gameRunning !== 'undefined' && gameRunning) {
        clearInterval(id);
        cb();
      } else if (Date.now() - start > limit) {
        clearInterval(id);
        console.warn('[smbTest] Timed out waiting for game to start.');
      }
    }, 100);
  }


  // ════════════════════════════════════════════════════════════════════════════
  // 1.  STORY SKIP
  // ════════════════════════════════════════════════════════════════════════════
  function loadStoryFight(id) {
    if (!_guard('loadStoryFight')) return;
    const _launch = () => {
      if (typeof storyModeActive !== 'undefined') storyModeActive = true;
      if (typeof storyCurrentLevel !== 'undefined') {
        storyCurrentLevel = Math.min(8, Math.floor(id / 5) + 1);
      }
      if (typeof _beginChapter2 === 'function') {
        // Second call in the same session bypasses the narrative panel
        // (the engine skips to fight when the chapter id is already in _seenNarrativeIds).
        // We call once now; if the narrative panel pops up the dev can click Fight.
        _beginChapter2(id);
      } else {
        console.warn('[smbTest] _beginChapter2 not found — story engine may not be loaded.');
      }
    };

    if (typeof gameRunning !== 'undefined' && gameRunning) {
      if (typeof backToMenu === 'function') backToMenu();
      setTimeout(_launch, 350);
    } else {
      _launch();
    }
    console.log(`[smbTest] Story fight #${id} launched.`);
  }


  // ════════════════════════════════════════════════════════════════════════════
  // 2.  BOSS DIRECT LOADERS
  // ════════════════════════════════════════════════════════════════════════════
  function loadSovereign() {
    if (!_guard('loadSovereign')) return;
    console.log('[smbTest] Loading Sovereign (Neural AI) fight…');
    _quickStart('sovereign');
  }

  function loadCreator() {
    if (!_guard('loadCreator')) return;
    console.log('[smbTest] Loading Creator (Boss) fight…');
    _quickStart('boss');
  }

  function loadTrueForm() {
    if (!_guard('loadTrueForm')) return;
    console.log('[smbTest] Loading True Form fight…');
    _quickStart('trueform');
  }

  function loadTrueForm3D() {
    if (!_guard('loadTrueForm3D')) return;
    console.log('[smbTest] Loading True Form → 3D phase…');
    _quickStart('trueform', null, () => {
      // After the game loop is live, skip intro cinematic and force 3D
      _waitForGame(() => {
        setTimeout(() => {
          if (typeof tfCinematicState !== 'undefined') {
            tfCinematicState = 'backstage';
          }
          if (typeof isCinematic !== 'undefined') isCinematic = false;
          if (typeof gameFrozen   !== 'undefined') gameFrozen   = false;
          if (typeof tfDimensionIs3D !== 'undefined') {
            tfDimensionIs3D = true;
            console.log('[smbTest] TrueForm 3D dimension active.');
          } else {
            console.warn('[smbTest] tfDimensionIs3D global not found.');
          }
        }, 1200); // let game settle one second before forcing 3D
      });
    });
  }


  // ════════════════════════════════════════════════════════════════════════════
  // 3.  PHASE CONTROL
  // ════════════════════════════════════════════════════════════════════════════
  function setBossPhase(phaseNumber) {
    if (!_guard('setBossPhase')) return;
    if (typeof players === 'undefined') { console.warn('[smbTest] No players array.'); return; }

    const boss = _boss();

    // ── Creator boss ──────────────────────────────────────────────────────────
    if (boss && boss.isBoss && !boss.isTrueForm) {
      // getPhase(): health > 2000 → 1, health > 1000 → 2, else → 3
      const hp = ({ 1: Math.min(boss.maxHealth, 2500), 2: 1500, 3: 800 })[phaseNumber];
      if (hp === undefined) { console.warn('[smbTest] Creator phase must be 1, 2, or 3.'); return; }
      boss.health = hp;
      console.log(`[smbTest] Creator boss → phase ${phaseNumber} (HP: ${hp})`);
      return;
    }

    // ── True Form ─────────────────────────────────────────────────────────────
    if (boss && boss.isTrueForm) {
      const maxHp = boss.maxHealth || 5000;
      const hp = ({
        1: Math.floor(maxHp * 0.90),  // pre-reset, fresh
        2: Math.floor(maxHp * 0.50),  // mid-fight, post QTE #1
        3: Math.floor(maxHp * 0.15),  // near-ending / final stretch
      })[phaseNumber];
      if (hp === undefined) { console.warn('[smbTest] TrueForm phase must be 1, 2, or 3.'); return; }
      boss.health = hp;
      // Ensure cinematic intro is past so combat runs normally
      if (typeof tfCinematicState !== 'undefined') tfCinematicState = 'backstage';
      if (typeof isCinematic      !== 'undefined') isCinematic      = false;
      if (typeof gameFrozen       !== 'undefined') gameFrozen       = false;
      console.log(`[smbTest] TrueForm → phase ${phaseNumber} (HP: ${hp})`);
      return;
    }

    // ── Sovereign / AdaptiveAI ────────────────────────────────────────────────
    const ai = _adaptiveAI();
    if (ai) {
      const cycleMap = { 1: 0, 2: 15, 3: 35 };
      const c = cycleMap[phaseNumber];
      if (c === undefined) { console.warn('[smbTest] Sovereign phase must be 1, 2, or 3.'); return; }
      ai._adaptCycles = c;
      // Push memory towards that "phase" intensity
      if (ai.aiMemory) {
        const intensities = {
          1: { aggression: 0.78, defense: 0.70, reactionSpeed: 0.90 },
          2: { aggression: 0.88, defense: 0.80, reactionSpeed: 0.94 },
          3: { aggression: 0.97, defense: 0.92, reactionSpeed: 0.99 },
        };
        Object.assign(ai.aiMemory, intensities[phaseNumber]);
      }
      console.log(`[smbTest] Sovereign adaptation → phase ${phaseNumber} (cycles: ${c})`);
      return;
    }

    console.warn('[smbTest] No active boss or adaptive AI found.');
  }


  // ════════════════════════════════════════════════════════════════════════════
  // 4.  PLAYER STATE CONTROL
  // ════════════════════════════════════════════════════════════════════════════
  function setPlayerHP(value) {
    if (!_guard('setPlayerHP')) return;
    const p = _player();
    if (!p) { console.warn('[smbTest] No human player found. Is a game running?'); return; }
    p.health = Math.max(1, Math.min(p.maxHealth, value));
    console.log(`[smbTest] P1 HP → ${p.health}`);
  }

  function setEnemyHP(value) {
    if (!_guard('setEnemyHP')) return;
    const e = _enemy();
    if (!e) { console.warn('[smbTest] No enemy found.'); return; }
    e.health = Math.max(1, Math.min(e.maxHealth, value));
    console.log(`[smbTest] Enemy HP → ${e.health}`);
  }

  function setLives(count) {
    if (!_guard('setLives')) return;
    if (typeof players === 'undefined') { console.warn('[smbTest] No players array.'); return; }
    for (const p of players) {
      if (!p || p.isBoss) continue;
      p.lives = count;
      if (typeof p._maxLives !== 'undefined') p._maxLives = count;
    }
    console.log(`[smbTest] All player lives set to ${count}`);
  }

  function godMode(enabled) {
    if (!_guard('godMode')) return;
    const p = _player();
    if (!p) { console.warn('[smbTest] No human player found. Start a game first.'); return; }
    if (enabled) {
      p.godmode    = true;
      p.invincible = 9_999_999;
      console.log('[smbTest] God mode ON — P1 is invincible');
    } else {
      p.godmode    = false;
      p.invincible = 0;
      console.log('[smbTest] God mode OFF');
    }
  }


  // ════════════════════════════════════════════════════════════════════════════
  // 5.  AI DEBUG OVERLAY
  // ════════════════════════════════════════════════════════════════════════════
  let _aiOverlayEl  = null;
  let _aiOverlayRunning = false;

  function _ensureAIOverlay() {
    if (_aiOverlayEl && document.body.contains(_aiOverlayEl)) return _aiOverlayEl;
    const el = document.createElement('div');
    el.id = 'smbTestAIOverlay';
    el.style.cssText = [
      'position:fixed', 'top:10px', 'right:10px',
      'background:rgba(0,0,0,0.85)', 'border:1px solid #33aaff',
      'border-radius:7px', 'padding:10px 14px', 'z-index:9900',
      'font-family:monospace', 'font-size:11px', 'color:#aaddff',
      'min-width:240px', 'pointer-events:none', 'line-height:1.8',
      'box-shadow:0 0 16px rgba(0,120,255,0.3)',
    ].join(';');
    document.body.appendChild(el);
    _aiOverlayEl = el;
    return el;
  }

  function _renderAIOverlay() {
    if (!window._smbTestAIDebug) return;
    requestAnimationFrame(_renderAIOverlay);

    const el = _ensureAIOverlay();
    const ai = _adaptiveAI();
    if (!ai) {
      el.innerHTML = '<span style="color:#446">[ AI DEBUG ] No adaptive AI active.</span>';
      return;
    }

    const m = ai.aiMemory || {};
    const buf = ai._eventBuffer || [];
    const fc  = typeof frameCount !== 'undefined' ? frameCount : 0;

    // Dominant event pattern in the last 5 seconds
    const recent = buf.filter(e => e.frame >= fc - 300);
    const counts = {};
    for (const e of recent) counts[e.type] = (counts[e.type] || 0) + 1;
    const topEntry = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    const patternStr = topEntry ? `${topEntry[0]} ×${topEntry[1]}` : '—';

    // Strategy label
    let strategy = 'neutral';
    if (m.aggression >= 0.92)    strategy = '🔴 overwhelming';
    else if (m.aggression >= 0.84) strategy = '🟠 aggressive';
    else if (m.defense    >= 0.85) strategy = '🟡 counter-punish';
    else if (m.spacing    >= 0.45) strategy = '🔵 spacing / bait';

    const pct = (v) => (v != null ? (v * 100).toFixed(0) : '?') + '%';
    const int     = ai.intelligence != null ? (ai.intelligence * 100).toFixed(0) : '?';
    const cycles  = ai._adaptCycles  != null ? ai._adaptCycles  : '?';
    const punish  = ai._punishTimer  != null ? ai._punishTimer  : '—';
    const bait    = ai._baitTimer    != null ? ai._baitTimer    : '—';
    const combo   = ai._comboCount   != null ? ai._comboCount   : '—';

    // SovereignMk2 extras
    const smk2SpamCount = ai._spamMap != null
      ? Array.from(ai._spamMap.values()).reduce((a, v) => Math.max(a, v), 0)
      : null;
    const smk2Predict   = ai._predictedAction || null;
    const smk2LimBreak  = ai._limiterBroken   || false;

    let rows = [
      `<b style="color:#66ccff">[ AI DEBUG — ${ai.name || 'Adaptive'} ]</b>`,
      `INT: <b style="color:#ffe066">${int}%</b> &nbsp; Cycles: ${cycles}`,
      `AGG: ${pct(m.aggression)} &nbsp; DEF: ${pct(m.defense)} &nbsp; SPC: ${pct(m.spacing)} &nbsp; RXN: ${pct(m.reactionSpeed)}`,
      `Strategy: <b style="color:#ffcc44">${strategy}</b>`,
      `Player pattern: <span style="color:#ff9966">${patternStr}</span>`,
      `PunishTimer: ${punish} &nbsp; BaitTimer: ${bait} &nbsp; Combo: ${combo}`,
    ];
    if (smk2SpamCount != null)  rows.push(`Spam streak: ${smk2SpamCount}`);
    if (smk2Predict   != null)  rows.push(`Predicted: <span style="color:#cc88ff">${smk2Predict}</span>`);
    if (smk2LimBreak)           rows.push(`<span style="color:#ff3366;font-weight:bold">⚡ LIMITER BROKEN</span>`);

    el.innerHTML = rows.join('<br>');
  }

  function debugAI(enabled) {
    if (!_guard('debugAI')) return;
    window._smbTestAIDebug = !!enabled;
    // Sync the existing console flag too
    if (typeof adaptiveAIDebug !== 'undefined') adaptiveAIDebug = !!enabled;

    if (enabled) {
      _ensureAIOverlay();
      if (!_aiOverlayRunning) {
        _aiOverlayRunning = true;
        _renderAIOverlay();
      }
      console.log('[smbTest] AI debug overlay ON');
    } else {
      _aiOverlayRunning = false;
      if (_aiOverlayEl) { _aiOverlayEl.remove(); _aiOverlayEl = null; }
      console.log('[smbTest] AI debug overlay OFF');
    }
  }


  // ════════════════════════════════════════════════════════════════════════════
  // 6.  HITBOX DEBUG
  // ════════════════════════════════════════════════════════════════════════════
  function debugHitboxes(enabled) {
    if (!_guard('debugHitboxes')) return;
    if (typeof showHitboxes !== 'undefined') {
      showHitboxes = !!enabled;
      console.log(`[smbTest] Hitbox debug: ${enabled ? 'ON' : 'OFF'}`);
    } else {
      console.warn('[smbTest] showHitboxes global not found (check load order).');
    }
  }


  // ════════════════════════════════════════════════════════════════════════════
  // 7.  MINIGAME LOADER
  // ════════════════════════════════════════════════════════════════════════════
  function loadMinigame(modeName) {
    if (!_guard('loadMinigame')) return;
    const modeMap = {
      waves:    'survival',
      survival: 'survival',
      kingZone: 'koth',
      koth:     'koth',
      chaos:    'chaos',
      soccer:   'soccer',
    };
    const resolved = modeMap[modeName] || modeName;
    console.log(`[smbTest] Loading minigame: ${resolved}`);

    _quickStart('minigames', null, () => {
      if (typeof minigameType !== 'undefined') minigameType = resolved;
      // Sync the dropdown if it exists in the DOM
      const sel = document.getElementById('minigameTypeSelect');
      if (sel) sel.value = resolved;
    });
  }


  // ════════════════════════════════════════════════════════════════════════════
  // 8.  FREE CAMERA
  //
  // Controls (while free camera is active):
  //   I / K  — pan up / down
  //   J / L  — pan left / right
  //   U / O  — zoom in / out
  // ════════════════════════════════════════════════════════════════════════════
  let _freeCamActive = false;
  let _freeCamKeys   = {};
  const _FREE_CAM_SPEED = 8;

  function _freeCamKeydown(e) { _freeCamKeys[e.key.toLowerCase()] = true; }
  function _freeCamKeyup(e)   { _freeCamKeys[e.key.toLowerCase()] = false; }

  function _freeCamTick() {
    if (!_freeCamActive) return;
    requestAnimationFrame(_freeCamTick);

    const spd = _FREE_CAM_SPEED;
    if (_freeCamKeys['i']) { if (typeof camYTarget !== 'undefined') camYTarget -= spd; }
    if (_freeCamKeys['k']) { if (typeof camYTarget !== 'undefined') camYTarget += spd; }
    if (_freeCamKeys['j']) { if (typeof camXTarget !== 'undefined') camXTarget -= spd; }
    if (_freeCamKeys['l']) { if (typeof camXTarget !== 'undefined') camXTarget += spd; }
    if (_freeCamKeys['u']) { if (typeof camZoomTarget !== 'undefined') camZoomTarget = Math.min(2.5, camZoomTarget + 0.02); }
    if (_freeCamKeys['o']) { if (typeof camZoomTarget !== 'undefined') camZoomTarget = Math.max(0.20, camZoomTarget - 0.02); }
  }

  function freeCamera(enabled) {
    if (!_guard('freeCamera')) return;
    _freeCamActive = !!enabled;

    if (enabled) {
      if (typeof cinematicCamOverride !== 'undefined') cinematicCamOverride = true;
      document.addEventListener('keydown', _freeCamKeydown);
      document.addEventListener('keyup',   _freeCamKeyup);
      _freeCamTick();
      console.log('[smbTest] Free camera ON — I/K pan up/down · J/L pan left/right · U/O zoom');
    } else {
      if (typeof cinematicCamOverride !== 'undefined') cinematicCamOverride = false;
      document.removeEventListener('keydown', _freeCamKeydown);
      document.removeEventListener('keyup',   _freeCamKeyup);
      console.log('[smbTest] Free camera OFF — camera returned to normal tracking');
    }
  }


  // ════════════════════════════════════════════════════════════════════════════
  // HELP
  // ════════════════════════════════════════════════════════════════════════════
  function help() {
    console.log(
      '%c╔══════════════════════════════════════════════════════╗\n' +
      '║          SMB TEST HARNESS — smbTest API              ║\n' +
      '╠══════════════════════════════════════════════════════╣\n' +
      '║ ENABLE:  window.DEBUG_MODE = true                    ║\n' +
      '╠══════════════════════════════════════════════════════╣\n' +
      '║ STORY                                                ║\n' +
      '║  smbTest.loadStoryFight(id)   jump to chapter by id  ║\n' +
      '╠══════════════════════════════════════════════════════╣\n' +
      '║ BOSS LOADERS                                         ║\n' +
      '║  smbTest.loadSovereign()      Neural AI fight         ║\n' +
      '║  smbTest.loadCreator()        Creator / Boss fight    ║\n' +
      '║  smbTest.loadTrueForm()       True Form fight         ║\n' +
      '║  smbTest.loadTrueForm3D()     True Form + 3D phase    ║\n' +
      '╠══════════════════════════════════════════════════════╣\n' +
      '║ PHASE CONTROL                                        ║\n' +
      '║  smbTest.setBossPhase(1|2|3)  force phase            ║\n' +
      '╠══════════════════════════════════════════════════════╣\n' +
      '║ PLAYER STATE                                         ║\n' +
      '║  smbTest.setPlayerHP(n)       set P1 HP               ║\n' +
      '║  smbTest.setEnemyHP(n)        set enemy / boss HP     ║\n' +
      '║  smbTest.setLives(n)          set lives for all        ║\n' +
      '║  smbTest.godMode(true/false)  P1 invincibility         ║\n' +
      '╠══════════════════════════════════════════════════════╣\n' +
      '║ DEBUG OVERLAYS                                       ║\n' +
      '║  smbTest.debugAI(true/false)       AI stats overlay   ║\n' +
      '║  smbTest.debugHitboxes(true/false) hitbox overlay     ║\n' +
      '╠══════════════════════════════════════════════════════╣\n' +
      '║ MINIGAMES                                            ║\n' +
      '║  smbTest.loadMinigame("waves"|"kingZone"|"chaos")    ║\n' +
      '╠══════════════════════════════════════════════════════╣\n' +
      '║ CAMERA                                               ║\n' +
      '║  smbTest.freeCamera(true/false)                      ║\n' +
      '║    I/K=pan up/down  J/L=pan left/right  U/O=zoom    ║\n' +
      '╚══════════════════════════════════════════════════════╝',
      'color:#44ccff; font-family:monospace; font-size:11px'
    );
  }


  // ════════════════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ════════════════════════════════════════════════════════════════════════════
  window.smbTest = {
    loadStoryFight,
    loadSovereign,
    loadCreator,
    loadTrueForm,
    loadTrueForm3D,
    setBossPhase,
    setPlayerHP,
    setEnemyHP,
    setLives,
    godMode,
    debugAI,
    debugHitboxes,
    loadMinigame,
    freeCamera,
    help,
  };

  // Print ready message if DEBUG_MODE was already set at load time
  if (window.DEBUG_MODE) {
    console.log(
      '%c[smbTest] Test harness ready. Call smbTest.help() for the full command list.',
      'color:#44ffaa; font-weight:bold'
    );
  }

})();
