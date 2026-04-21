'use strict';
// smb-attacktest-commands.js — _atkCommand console router, _atkHelp, _atkList, _atkSummon, _atkAll, kit HUD, key handler, kit fire
// Depends on: smb-globals.js, smb-fighter.js, smb-combat.js

// ─── CONSOLE COMMAND ROUTER ───────────────────────────────────
function _atkCommand(raw) {
  const parts = raw.trim().split(/\s+/);
  const sub   = (parts[0] || '').toLowerCase();
  switch (sub) {
    case 'help':   return _atkHelp();
    case 'list':   return _atkList(parts[1]);
    case 'summon': return _atkSummon((parts[1]||'').toLowerCase());
    case 'all':    return _atkAll((parts[1]||'').toLowerCase());
    case 'safe':   return _atkToggleSafe(parts[1]);
    case 'pause':  return _atkTogglePause(parts[1]);
    case 'speed':  return _atkSetSpeed(parts[1]);
    case 'scale':  return _atkSetScale(parts[1]);
    case 'reset':  return _atkResetEffects();
    case 'gui':    return _atkOpenGUI();
    case 'class':  return _atkEquipClass(parts[1], parts[2]);
    default:
      _consoleErr('Unknown atk sub-command: ' + sub + '  (type: atk help)');
  }
}

function _atkHelp() {
  const lines = [
    '── ATK SANDBOX ──────────────────────────────────────────────────',
    '  VIEWER / CONSOLE:',
    '  atk list  <creator|trueform|weapons|yeti|beast>',
    '  atk summon <label>        — fire one attack as a pure effect',
    '  atk all   <class>         — sequential demo of every attack',
    '  atk safe  [on|off]        — ' + (_atkSafeMode?'ON':'OFF') + ' (no damage)',
    '  atk pause [on|off]        — ' + (_atkPauseBetween?'ON':'OFF') + ' (gap between demo attacks)',
    '  atk speed <0.1–4.0>       — demo speed (' + _atkSpeed.toFixed(1) + '×)',
    '  atk scale <0.1–10.0>      — damage mult (' + _atkDamageScale.toFixed(1) + '×)',
    '  atk reset                 — clear all active effects',
    '  atk gui                   — open/close visual Attack Viewer panel',
    '  ADMIN CLASSES (equip on a player):',
    '  atk class creator  [p1|p2]',
    '  atk class trueform [p1|p2]',
    '  atk class yeti     [p1|p2]',
    '  atk class beast    [p1|p2]',
    '  atk class off      [p1|p2]  — remove admin kit',
    '    Q = fire current attack & advance queue',
    '    E (super) = random attack from the kit',
    '─────────────────────────────────────────────────────────────────',
  ];
  lines.forEach(l => _consolePrint(l, '#88bbff'));
}

function _atkList(classKey) {
  if (!classKey) { _consoleErr('Usage: atk list <creator|trueform|weapons|yeti|beast>'); return; }
  const bucket = ATK_REGISTRY[classKey.toLowerCase()];
  if (!bucket)  { _consoleErr('Unknown class key: ' + classKey); return; }
  _consolePrint('── ' + classKey.toUpperCase() + ' (' + bucket.length + ' attacks) ──', '#ffcc55');
  bucket.forEach((a,i) => _consolePrint(`  [${String(i+1).padStart(2)}] ${a.label.padEnd(24)} ${a.desc}`, '#aaccff'));
  _consolePrint('Use:  atk summon <label>', '#668899');
}

// Returns a ctx for summon calls: live-delegating from P1 when in-game, else a static proxy
function _atkGetSummonCtx(isTF) {
  const firer = typeof players !== 'undefined' ? players.find(p => !p.isBoss && p.health > 0) : null;
  return firer ? _atkMakePlayerCtx(firer, isTF) : _atkMakeProxy(isTF);
}

function _atkSummon(label) {
  if (!label) { _consoleErr('Usage: atk summon <label>'); return; }
  if (!gameRunning) { _consoleErr('Start a game first.'); return; }
  for (const [classKey, bucket] of Object.entries(ATK_REGISTRY)) {
    const entry = bucket.find(a => a.label === label);
    if (!entry) continue;
    const isTF     = classKey === 'trueform';
    const needsCtx = classKey === 'creator' || classKey === 'trueform' || classKey === 'yeti' || classKey === 'beast';
    const firer    = typeof players !== 'undefined' ? players.find(p => !p.isBoss && !p._isDummy && p.health > 0) : null;
    const ctx      = needsCtx ? _atkGetSummonCtx(isTF) : null;
    const tgt      = firer ? _atkGetKitTarget(firer) : _atkGetTarget();
    _atkCurrentFirer = firer;
    _atkSetGuiFirer(firer);
    _consolePrint('[ATK] ' + entry.label + ' — ' + entry.desc, '#ffcc00');
    forceExecuteAttack(entry, classKey, ctx, tgt);
    _atkCurrentFirer = null;
    _consoleOk('[ATK] fired.');
    return;
  }
  _consoleErr('[ATK] Unknown label: ' + label + '  (use: atk list <class>)');
}

function _atkAll(classKey) {
  if (!classKey) { _consoleErr('Usage: atk all <creator|trueform|weapons|yeti|beast>'); return; }
  const bucket = ATK_REGISTRY[classKey.toLowerCase()];
  if (!bucket)  { _consoleErr('Unknown class: ' + classKey); return; }
  if (!gameRunning) { _consoleErr('Start a game first.'); return; }
  if (_atkDemoRunning) { _consoleErr('Demo already running.'); return; }
  _atkDemoRunning = true;
  _consolePrint('[ATK] Demo: ' + classKey.toUpperCase() + ' (' + bucket.length + ' attacks)…', '#ffcc00');
  if (_atkSafeMode) _consolePrint('[ATK] Safe mode ON.', '#88ff88');
  const isTF   = classKey === 'trueform';
  const GAP_MS = Math.round(2200 / _atkSpeed);
  let idx = 0;
  function _next() {
    if (!gameRunning) { _atkDemoRunning=false; _consolePrint('[ATK] Demo aborted.','#ff8888'); return; }
    if (idx >= bucket.length) { _atkDemoRunning=false; _consoleOk('[ATK] Demo complete.'); return; }
    const entry    = bucket[idx++];
    const needsCtx = classKey === 'creator' || classKey === 'trueform' || classKey === 'yeti' || classKey === 'beast';
    const firer    = typeof players !== 'undefined' ? players.find(p => !p.isBoss && !p._isDummy && p.health > 0) : null;
    const ctx      = needsCtx ? _atkGetSummonCtx(isTF) : null;
    const tgt      = firer ? _atkGetKitTarget(firer) : _atkGetTarget();
    _atkCurrentFirer = firer;
    _atkSetGuiFirer(firer);
    _consolePrint('[ATK] ' + idx + '/' + bucket.length + ' → ' + entry.label, '#aaddff');
    forceExecuteAttack(entry, classKey, ctx, tgt);
    _atkCurrentFirer = null;
    if (_atkPauseBetween) setTimeout(_next, GAP_MS);
    else _next();
  }
  _next();
}

function _atkToggleSafe(v)  { _atkSafeMode    = v ? v.toLowerCase()!=='off' : !_atkSafeMode;    _consoleOk('[ATK] Safe: '  +(_atkSafeMode?'ON':'OFF')); }
function _atkTogglePause(v) { _atkPauseBetween = v ? v.toLowerCase()!=='off' : !_atkPauseBetween; _consoleOk('[ATK] Pause: '+(_atkPauseBetween?'ON':'OFF')); }
function _atkSetSpeed(v)    { const n=parseFloat(v); if(isNaN(n)||n<0.1||n>4){_consoleErr('0.1–4.0');return;} _atkSpeed=n; _consoleOk('[ATK] Speed: '+n.toFixed(2)+'×'); }
function _atkSetScale(v)    { const n=parseFloat(v); if(isNaN(n)||n<0.1||n>10){_consoleErr('0.1–10.0');return;} _atkDamageScale=n; _consoleOk('[ATK] Scale: '+n.toFixed(2)+'×'); }

// ─── ADMIN CLASS SYSTEM ───────────────────────────────────────
// Attack lists used by both the kit weapons and the GUI
const _ADMIN_KIT_ATTACKS = {
  creator:  ATK_REGISTRY.creator,
  trueform: ATK_REGISTRY.trueform,
  yeti:     ATK_REGISTRY.yeti,
  beast:    ATK_REGISTRY.beast,
};

/**
 * Equip an admin kit class on a player.
 * The kit overrides weapon.ability (Q) and registers a super handler (E).
 * Q fires the current queued attack then advances to the next.
 * E fires a random attack from the kit.
 *
 * @param {string} kitKey   — 'creator' | 'trueform' | 'yeti' | 'beast' | 'off'
 * @param {string} [slot]   — 'p1' | 'p2' | 'p2' (default: 'p1')
 */
// ─── Kit HUD DOM overlay ───────────────────────────────────────
function _atkUpdateKitHUD() {
  let hud = document.getElementById('atkKitHUD');
  // Collect all equipped players
  const equipped = [];
  if (typeof players !== 'undefined') {
    players.filter(p => !p.isBoss && p._adminKit).forEach((p, i) => equipped.push(p));
  }
  if (equipped.length === 0) { if (hud) hud.remove(); return; }

  if (!hud) {
    hud = document.createElement('div');
    hud.id = 'atkKitHUD';
    hud.style.cssText = 'position:fixed;bottom:12px;left:12px;z-index:9990;font-family:monospace;font-size:0.72rem;pointer-events:none;';
    document.body.appendChild(hud);
  }

  hud.innerHTML = equipped.map(p => {
    const kit = p._adminKit;
    const label = kit.kitKey.toUpperCase() + ' KIT';
    const rows = kit.bucket.map((e, i) => {
      const key = i < 9 ? (i + 1) : (i === 9 ? '0' : '—');
      const active = i === kit.idx;
      const bg = active ? 'background:rgba(180,0,255,0.55);color:#fff;' : 'color:#bb88ee;';
      return `<div style="padding:1px 6px;${bg}border-radius:2px;">[${key}] ${e.label}</div>`;
    }).join('');
    return `<div style="background:rgba(6,0,18,0.90);border:1px solid #660099;border-radius:6px;padding:6px 8px;margin-bottom:6px;">
      <div style="color:#cc66ff;font-weight:bold;margin-bottom:3px;">${label} — Q=fire · E=next</div>${rows}</div>`;
  }).join('');
}

// ─── Per-kit keydown handler ───────────────────────────────────
let _atkKitKeyHandler = null;
function _atkInstallKeyHandler() {
  if (_atkKitKeyHandler) return; // already installed
  _atkKitKeyHandler = function(e) {
    if (typeof players === 'undefined') return;
    const equipped = players.filter(p => !p.isBoss && p._adminKit);
    if (equipped.length === 0) { _atkRemoveKeyHandler(); return; }

    // Only intercept digit keys and only when the kit is active
    const digit = e.key >= '1' && e.key <= '9' ? parseInt(e.key) - 1
                : e.key === '0' ? 9 : -1;
    if (digit === -1) return;

    // Fire attack at that index for ALL equipped players (or just P1 if only one)
    equipped.forEach(p => {
      const kit = p._adminKit;
      if (digit >= kit.bucket.length) return;
      kit.idx = digit;
      _atkKitFire(p);
    });
    _atkUpdateKitHUD();
    e.preventDefault();
  };
  window.addEventListener('keydown', _atkKitKeyHandler, true);
}
function _atkRemoveKeyHandler() {
  if (_atkKitKeyHandler) {
    window.removeEventListener('keydown', _atkKitKeyHandler, true);
    _atkKitKeyHandler = null;
  }
}

// ─── Core fire helper (fires kit.idx attack for a player) ─────
function _atkKitFire(player) {
  const kit  = player._adminKit;
  if (!kit) return;
  const isTF = kit.kitKey === 'trueform';
  const entry = kit.bucket[kit.idx];
  // Live-delegating ctx: position reads/writes go to the real player so
  // teleport attacks move them, meteor attacks apply real physics, and
  // bossRef stored in global state (tfGammaBeam etc.) tracks them live.
  const ctx = _atkMakePlayerCtx(player, isTF);
  // Target: any live non-dummy entity that isn't the firing player
  const tgt = typeof players !== 'undefined'
    ? players.find(p => p !== player && !p._isDummy && p.health > 0) || null
    : null;
  _atkCurrentFirer = player;
  _atkSetGuiFirer(player);
  _consolePrint(`[ADMIN KIT] [${kit.idx + 1}] ${entry.label}`, '#ffcc44');
  forceExecuteAttack(entry, kit.kitKey, ctx, tgt);
  _atkCurrentFirer = null;
  spawnParticles(player.cx(), player.cy(), isTF ? '#ffffff' : '#cc00ee', 12);
}

function _atkEquipClass(kitKey, slot) {
  if (!kitKey) { _consoleErr('Usage: atk class <creator|trueform|yeti|beast|off> [p1|p2]'); return; }
  if (!gameRunning) { _consoleErr('Start a game first.'); return; }

  const slotIdx = (slot === 'p2' || slot === '2') ? 1 : 0;
  const player  = players && players.filter(p => !p.isBoss)[slotIdx];
  if (!player)  { _consoleErr('No player in slot ' + (slotIdx+1)); return; }

  // Remove existing kit
  if (player._adminKit) {
    player.weapon = player._adminKit.prevWeapon;
    if (player._origActivateSuper) { player.activateSuper = player._origActivateSuper; delete player._origActivateSuper; }
    delete player._adminKit;
    if (kitKey === 'off') { _atkUpdateKitHUD(); _consoleOk('[ATK] Admin kit removed from P' + (slotIdx+1)); return; }
  }
  if (kitKey === 'off') { _consoleOk('[ATK] No kit equipped.'); return; }

  const bucket = _ADMIN_KIT_ATTACKS[kitKey.toLowerCase()];
  if (!bucket)  { _consoleErr('Unknown kit: ' + kitKey + '  (creator|trueform|yeti|beast)'); return; }

  const isTF = kitKey === 'trueform';

  // Build kit state on the player
  player._adminKit = { kitKey, bucket, idx: 0, prevWeapon: player.weapon };

  // Build a synthetic weapon: Q fires current slot (no advance); E advances to next slot
  const kitWeapon = Object.assign({}, player.weapon || {}, {
    name:            kitKey.charAt(0).toUpperCase() + kitKey.slice(1) + ' Kit',
    type:            'admin',
    abilityCooldown: 30,
    cooldown:        player.weapon ? player.weapon.cooldown : 28,
    // Q — fire currently selected attack (no cycle)
    ability(user) {
      if (!user._adminKit) return;
      _atkKitFire(user);
      _atkUpdateKitHUD();
    },
  });
  player.weapon = kitWeapon;

  // E — advance selection to next attack (no fire; instant super recharge)
  if (!player._origActivateSuper) {
    player._origActivateSuper = player.activateSuper ? player.activateSuper.bind(player) : null;
  }
  player.activateSuper = function(_target) {
    if (!this._adminKit) { if (this._origActivateSuper) this._origActivateSuper(_target); return; }
    const kit = this._adminKit;
    kit.idx = (kit.idx + 1) % kit.bucket.length;
    _consolePrint(`[ADMIN KIT] selected [${kit.idx + 1}] ${kit.bucket[kit.idx].label}`, '#aaddff');
    _atkUpdateKitHUD();
    // Immediately refill super so E is always available
    this.superMeter = 100; this.superReady = true;
  };
  player.superMeter = 100; player.superReady = true;

  _atkInstallKeyHandler();
  _atkUpdateKitHUD();

  _consoleOk(`[ATK] P${slotIdx+1} equipped with ${kitKey.toUpperCase()} kit (${bucket.length} attacks).`);
  _consolePrint('  1–' + Math.min(bucket.length, 9) + ' = fire specific attack directly', '#aaddff');
  _consolePrint('  Q = fire selected attack  |  E = cycle to next', '#aaddff');
  _consolePrint(`  atk class off${slotIdx===1?' p2':''} to remove`, '#667788');
}

