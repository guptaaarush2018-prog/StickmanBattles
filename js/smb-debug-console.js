'use strict';
// smb-debug-console.js — In-game developer console (GAMECONSOLE unlock, _consoleExec)
// Depends on: smb-globals.js, smb-debug-overlay.js, smb-state.js, smb-accounts.js
// Must load AFTER smb-debug-overlay.js, BEFORE smb-debug-jump.js

// ============================================================
// IN-GAME CONSOLE SYSTEM
// Unlock by typing GAMECONSOLE anywhere, or via debug menu.
// Commands mirror the existing slash-command system plus extras.
// ============================================================

let _consoleOpen      = false;
let _consoleHistory   = [];  // command history (up/down arrow)
let _consoleHistIdx   = -1;
let consoleUnlocked   = false;  // password lock — cleared each page load
const _CONSOLE_PASS   = 'devmode';  // hardcoded password

// Intercept native console so game logs appear in the overlay
const _origLog   = console.log.bind(console);
const _origWarn  = console.warn.bind(console);
const _origError = console.error.bind(console);
console.log   = (...a) => { _origLog(...a);   _consoleAppend('[log]',   a.join(' '), '#aaddff'); };
console.warn  = (...a) => { _origWarn(...a);  _consoleAppend('[warn]',  a.join(' '), '#ffdd88'); };
console.error = (...a) => { _origError(...a); _consoleAppend('[error]', a.join(' '), '#ff6666'); };

function _consoleAppend(prefix, text, color) {
  const log = document.getElementById('gameConsoleLog');
  if (!log) return;
  const line = document.createElement('div');
  line.style.color = color || '#ccddff';
  line.textContent = prefix + ' ' + text;
  log.appendChild(line);
  log.scrollTop = log.scrollHeight;
  // Trim old entries to prevent memory bloat
  while (log.children.length > 300) log.removeChild(log.firstChild);
}

function _consolePrint(text, color) { _consoleAppend('>', text, color || '#ccddff'); }
function _consoleOk(text)           { _consoleAppend('✓', text, '#44ff88'); }
function _consoleErr(text)          { _consoleAppend('✗', text, '#ff5555'); }

// Whether this session's console was opened by an admin/dev account.
// Reset when console closes so switching accounts mid-session takes effect next open.
let _consoleIsAdmin = false;

function _consoleApplyAdminTheme(role) {
  // role: 'admin' or 'dev'
  const isDev = role === 'dev';
  const ov      = document.getElementById('gameConsoleOverlay');
  const titleBar = document.getElementById('gameConsoleTitleBar');
  const title    = document.getElementById('gameConsoleTitle');
  const badge    = document.getElementById('gameConsoleRoleBadge');

  if (isDev) {
    if (ov)       { ov.style.borderTopColor = '#ff9900'; ov.style.borderTopWidth = '2px'; }
    if (titleBar) { titleBar.style.background = 'rgba(40,20,0,0.97)'; titleBar.style.borderBottomColor = '#cc6600'; }
    if (title)    { title.style.color = '#ffcc44'; title.textContent = '\u26A0 Stickman Clash  — Dev Console'; }
    if (badge)    { badge.style.display = ''; badge.textContent = 'DEV'; badge.style.background = 'rgba(255,150,0,0.25)'; badge.style.border = '1px solid rgba(255,150,0,0.55)'; badge.style.color = '#ffcc44'; }
  } else {
    // admin (not dev)
    if (ov)       { ov.style.borderTopColor = '#ff8800'; ov.style.borderTopWidth = '2px'; }
    if (titleBar) { titleBar.style.background = 'rgba(35,15,0,0.97)'; titleBar.style.borderBottomColor = '#994400'; }
    if (title)    { title.style.color = '#ffaa44'; title.textContent = '\u{1F6E1} Stickman Clash  — Admin Console'; }
    if (badge)    { badge.style.display = ''; badge.textContent = 'ADMIN'; badge.style.background = 'rgba(255,120,0,0.2)'; badge.style.border = '1px solid rgba(255,120,0,0.5)'; badge.style.color = '#ffaa44'; }
  }
}

function _consoleResetTheme() {
  const ov      = document.getElementById('gameConsoleOverlay');
  const titleBar = document.getElementById('gameConsoleTitleBar');
  const title    = document.getElementById('gameConsoleTitle');
  const badge    = document.getElementById('gameConsoleRoleBadge');
  if (ov)       { ov.style.borderTopColor = '#3366ff'; ov.style.borderTopWidth = '2px'; }
  if (titleBar) { titleBar.style.background = 'rgba(20,30,80,0.95)'; titleBar.style.borderBottomColor = '#3366ff'; }
  if (title)    { title.style.color = '#88aaff'; title.textContent = '\u25B6 Stickman Clash Console'; }
  if (badge)    { badge.style.display = 'none'; badge.textContent = ''; }
}

function openGameConsole() {
  const ov = document.getElementById('gameConsoleOverlay');
  if (!ov) return;

  // Detect role for this session
  const _acct = (typeof AccountManager !== 'undefined' && AccountManager.getActiveAccount) ? AccountManager.getActiveAccount() : null;
  const _role = _acct ? (_acct.role || 'player') : 'player';
  const _hasAdminRole = (typeof hasPermission === 'function' && hasPermission('admin')) ||
                        (typeof _isAdmin === 'function' && _acct && _isAdmin(_acct.id));
  const _hasDevRole   = _role === 'dev' || (typeof isSuperuserAccountId === 'function' && _acct && isSuperuserAccountId(_acct.id));

  _consoleIsAdmin = _hasAdminRole || _hasDevRole;

  // Auto-unlock for admins/devs — no password gate needed
  if (_consoleIsAdmin && !consoleUnlocked) {
    consoleUnlocked = true;
  }

  // Apply visual theme
  if (_hasDevRole) {
    _consoleApplyAdminTheme('dev');
  } else if (_hasAdminRole) {
    _consoleApplyAdminTheme('admin');
  } else {
    _consoleResetTheme();
  }

  _consoleOpen = true;
  ov.style.display = 'flex';
  const inp = document.getElementById('gameConsoleInput');
  if (inp) { inp.value = ''; inp.focus(); }

  if (!consoleUnlocked) {
    _consolePrint('Console locked. Enter password to continue.', '#ffaa44');
  } else if (_consoleIsAdmin) {
    const roleLabel = _hasDevRole ? 'Dev' : 'Admin';
    const nameLabel = _acct ? ' (' + (_acct.username || _acct.id) + ')' : '';
    _consolePrint('\u26A0 ' + roleLabel + ' Console unlocked' + nameLabel + '. Type HELP for full command list.', _hasDevRole ? '#ffcc44' : '#ffaa44');
    _consolePrint('Admin-only: ban  tempban  banpeer  banip  unban  banlist  kick  bancheck  setaccountrole  notify', '#ffdd88');
    _consolePrint('Dev-only:   spawn  godmode  eval  unlockall  setchapter  startboss  gravity  noclip  setspeed  reload', '#ffbb66');
  } else {
    _consolePrint('Stickman Clash Console \u2014 type HELP for commands.', '#88bbff');
  }

  // History navigation
  if (inp) {
    inp.onkeydown = (e) => {
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (_consoleHistIdx < _consoleHistory.length - 1) _consoleHistIdx++;
        inp.value = _consoleHistory[_consoleHistory.length - 1 - _consoleHistIdx] || '';
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (_consoleHistIdx > 0) _consoleHistIdx--;
        else { _consoleHistIdx = -1; inp.value = ''; }
        inp.value = _consoleHistIdx >= 0 ? (_consoleHistory[_consoleHistory.length - 1 - _consoleHistIdx] || '') : '';
      }
    };
  }
}

function closeGameConsole() {
  const ov = document.getElementById('gameConsoleOverlay');
  if (ov) ov.style.display = 'none';
  _consoleOpen = false;
  _consoleHistIdx = -1;
  _consoleIsAdmin = false;
  _consoleResetTheme();
}

function gameConsoleRun() {
  const inp = document.getElementById('gameConsoleInput');
  if (!inp) return;
  const raw = inp.value.trim();
  inp.value = '';
  if (!raw) return;

  // Password gate — check on every submission until unlocked
  if (!consoleUnlocked) {
    if (raw === _CONSOLE_PASS) {
      consoleUnlocked = true;
      _consoleOk('Password accepted. Console unlocked.');
      _consolePrint('Stickman Clash Console — type HELP for commands.', '#88bbff');
    } else {
      _consoleErr('Incorrect password. Console locked.');
    }
    return;
  }

  _consoleHistory.push(raw);
  _consoleHistIdx = -1;
  _consolePrint('> ' + raw, '#ffffff');
  // Prefix a command with "--local " to skip broadcast and run only on this client
  const isLocal = raw.startsWith('--local ');
  const execRaw = isLocal ? raw.slice('--local '.length).trim() : raw;
  const localOnly = isLocal || _consoleIsLocalOnlyCommand(execRaw);
  // Online: broadcast command to all peers so it runs on every client
  if (!localOnly && typeof onlineMode !== 'undefined' && onlineMode &&
      typeof NetworkManager !== 'undefined' && NetworkManager.connected) {
    NetworkManager.sendGameEvent('consoleCmd', { cmd: execRaw });
    _consolePrint('[broadcast to all players]', '#55aaff');
  } else if (localOnly) {
    _consolePrint('[local only — not broadcast]', '#ffaa44');
  }
  _consoleExec(execRaw);
}

function _consoleIsLocalOnlyCommand(raw) {
  const cmd = String(raw || '').trim().toUpperCase();
  return (
    cmd === 'BAN' ||
    cmd.startsWith('BAN ') ||
    cmd === 'TEMPBAN' ||
    cmd.startsWith('TEMPBAN ') ||
    cmd === 'BANPEER' ||
    cmd.startsWith('BANPEER ') ||
    cmd === 'BANIP' ||
    cmd.startsWith('BANIP ') ||
    cmd === 'UNBAN' ||
    cmd.startsWith('UNBAN ') ||
    cmd === 'BANLIST' ||
    cmd === 'KICK' ||
    cmd.startsWith('KICK ') ||
    cmd === 'WHOAMI' ||
    cmd === 'WHO' ||
    cmd === 'ACCOUNTS' ||
    cmd === 'NET STATUS' ||
    cmd === 'NET PEERS' ||
    cmd === 'SYNC' ||
    cmd === 'SYNC BANS' ||
    cmd === 'SERVER' ||
    cmd === 'SERVER STATUS' ||
    cmd === 'NOTIFY_DISPLAY' ||
    cmd.startsWith('NOTIFY_DISPLAY ')
  );
}

function _consoleExec(raw) {
  const cmd  = raw.toUpperCase().trim();
  const parts = raw.trim().split(/\s+/);
  const sub  = parts[1] ? parts[1].toLowerCase() : '';

  function _parseBanArgs(startIndex) {
    const target = parts[startIndex] || '';
    const maybeMinutes = parts[startIndex + 1];
    const hasMinutes = maybeMinutes !== undefined && /^-?\d+(?:\.\d+)?$/.test(maybeMinutes);
    const minutes = hasMinutes ? parseFloat(maybeMinutes) : null;
    const reason = parts.slice(startIndex + (hasMinutes ? 2 : 1)).join(' ').trim();
    return { target, minutes, reason };
  }

  // ---- HELP ----
  if (cmd === 'HELP') {
    const cmds = [
      '── General ──────────────────────────────────────────────────────',
      'help                    — show this list',
      'clear                   — clear console output',
      'status                  — show game state summary',
      'version                 — show build/game version info',
      'time                    — show current frame count and game clock',
      'fps                     — show current FPS',
      'reload                  — reload the page (dev only)',
      '── Combat ───────────────────────────────────────────────────────',
      'heal [p1|p2|all]        — restore health',
      'kill [p1|p2|boss|all]   — set health to 0',
      'sethp <n> [p1|p2|player|boss|all] — set health to exact value',
      'lives <n> [p1|p2|all]   — set lives remaining',
      'revive [p1|p2|boss|all] — respawn fighters at full health',
      'godmode [p1|p2|on|off]  — toggle invincibility (dev only)',
      '── Game Setup ───────────────────────────────────────────────────',
      'setmap <arena>          — change arena (e.g. setmap lava)',
      'setweapon <key> [p1|p2] — change weapon (e.g. setweapon gun)',
      'setclass <key> [p1|p2]  — change class (e.g. setclass megaknight)',
      'setspeed <n>            — set game time scale (1=normal, 0.5=slow, 2=fast) [dev]',
      'slow [on|off]           — toggle slow motion (0.25×)',
      'pause [on|off|toggle]   — pause or resume the game',
      'gravity [n]             — set gravity multiplier (1=normal) [dev]',
      'noclip [p1|p2|on|off]   — toggle platform collision [dev]',
      '── Entities ─────────────────────────────────────────────────────',
      'spawn <forestbeast|yeti|dummy|god> — spawn entity [dev]',
      'summon god — summon God entity (no crash behavior) [dev]',
      'bots reset              — reset all bot AI states',
      'bots kill               — kill all bots instantly',
      'boss phase <1|2|3>      — force boss to a phase [dev]',
      '── Listings ─────────────────────────────────────────────────────',
      'arena list              — list all available arena keys',
      'weapon list             — list all weapon keys',
      'class list              — list all class keys',
      'story list              — list story chapters [dev]',
      '── Economy ──────────────────────────────────────────────────────',
      'coins show|set|give|take — view or edit the coin wallet',
      '── Unlocks ──────────────────────────────────────────────────────',
      'unlock trueform|megaknight — unlock secret content',
      'unlockall               — unlock everything [dev]',
      '── Accounts / Moderation ────────────────────────────────────────',
      'who                     — list all accounts with IDs and roles',
      'whoami                  — show local player/account/network identity',
      'account info <id>       — show detailed account info [admin]',
      'bancheck <target>       — check if a target is currently banned [admin]',
      'notify <message>        — show an in-game notification to all players [admin]',
      'sync [bans]             — pull latest bans from server [admin]',
      'server [status]         — check server health and ban count [admin]',
      'ban <target> [min] [reason]     — ban by account/slot/peer/device [admin]',
      'tempban <target> <min> [reason] — temporary ban [admin]',
      'banpeer <peerId> [min] [reason] — ban a peer id directly [admin]',
      'banip <target> [min] [reason]   — best-effort IP-style ban [admin]',
      'unban <target>          — remove matching bans [admin]',
      'banlist                 — list active bans [admin]',
      'kick <target>           — remove a player from the room [admin]',
      'setaccountrole <id> <player|admin|dev> — change account role [dev]',
      '── Network ──────────────────────────────────────────────────────',
      'net status              — show network role, slot, and peer count',
      'net peers               — print connected peer roster',
      '── Dev / Story ──────────────────────────────────────────────────',
      'setchapter <id> [acctId]        — jump to story chapter [dev]',
      'startboss [boss|trueform]       — start boss fight immediately [dev]',
      'unlockallskills [acctId]        — unlock all items for account [dev]',
      'eval <js>               — evaluate raw JavaScript [dev]',
      '── Map Analysis ─────────────────────────────────────────────────',
      'maps analyze            — print analysis of all maps',
      'maps analyze raw        — print raw analysis array',
      'map analyze <key>       — print analysis of one map',
    ];
    cmds.forEach(c => {
      const isSection = c.startsWith('──');
      _consolePrint(c, isSection ? '#556688' : '#88bbff');
    });
    return;
  }

  // ---- CLEAR ----
  if (cmd === 'CLEAR') {
    const log = document.getElementById('gameConsoleLog');
    if (log) log.innerHTML = '';
    return;
  }

  // ---- STATUS ----
  if (cmd === 'STATUS') {
    _consolePrint('gameMode: ' + (typeof gameMode !== 'undefined' ? gameMode : '?'));
    _consolePrint('gameRunning: ' + (typeof gameRunning !== 'undefined' ? gameRunning : '?'));
    _consolePrint('players: ' + (typeof players !== 'undefined' ? players.length : '?'));
    _consolePrint('FPS: ' + _dbgFpsCurrent);
    if (typeof players !== 'undefined') {
      players.forEach((p, i) => _consolePrint(`  [${i}] ${p.name||'?'} HP:${Math.round(p.health)}/${p.maxHealth} lives:${p.lives}`));
    }
    return;
  }

  // ---- FPS ----
  if (cmd === 'FPS') { _consolePrint('FPS: ' + _dbgFpsCurrent, '#44ff88'); return; }

  // ---- HEAL ----
  if (cmd.startsWith('HEAL')) {
    const who = sub || 'all';
    const _heal = (p) => { p.health = p.maxHealth; p.invincible = 60; };
    if (typeof players === 'undefined') { _consoleErr('No game running.'); return; }
    if (who === 'p1' || who === '1') { if (players[0]) _heal(players[0]); }
    else if (who === 'p2' || who === '2') { if (players[1]) _heal(players[1]); }
    else { players.forEach(_heal); (typeof trainingDummies !== 'undefined') && trainingDummies.forEach(_heal); }
    _consoleOk('Healed ' + who);
    return;
  }

  // ---- KILL ----
  if (cmd.startsWith('KILL')) {
    const who = sub || 'all';
    if (typeof players === 'undefined') { _consoleErr('No game running.'); return; }
    if (who === 'p1' || who === '1') { if (players[0]) players[0].health = 0; }
    else if (who === 'p2' || who === '2') { if (players[1]) players[1].health = 0; }
    else if (who === 'boss') {
      players.forEach(p => {
        if (!p.isBoss) return;
        // Respect TrueForm intro sequence — block kill boss until backstage
        if (p.isTrueForm
            && typeof tfCinematicState !== 'undefined'
            && tfCinematicState !== 'none'
            && tfCinematicState !== 'backstage') {
          _consoleErr('TF intro sequence in progress (' + tfCinematicState + ') — kill boss blocked to preserve cinematic order. Wait for backstage state.');
          return;
        }
        // TrueForm Round 1: set HP to 1 so checkDeaths routes through Paradox return → Code Realm → Round 2
        if (p.isTrueForm && typeof tfFalseVictoryFired !== 'undefined' && !tfFalseVictoryFired) {
          p.health = 1;
        } else {
          p.health = 0;
        }
      });
    }
    else {
      // kill all: players + minions + training dummies (including boss)
      const all = [...players, ...(minions||[]), ...(trainingDummies||[])];
      all.forEach(p => { if (!p.godmode && !p._godmode) p.health = 0; });
    }
    _consoleOk('Killed ' + who);
    return;
  }

  // ---- SPAWN ----
  if (cmd.startsWith('SPAWN')) {
    if (typeof hasPermission === 'function' && !hasPermission('dev')) {
      _consoleErr('Permission denied — developer role required.'); return;
    }
    if (!sub) { _consoleErr('Usage: spawn <forestbeast|yeti|dummy|god>'); return; }
    if (typeof gameRunning === 'undefined' || !gameRunning) { _consoleErr('Start a game first.'); return; }
    if (sub === 'forestbeast' || sub === 'forest') {
      if (typeof ForestBeast !== 'undefined') {
        const fb = new ForestBeast(600, 300);
        minions.push(fb);
        _consoleOk('Spawned ForestBeast');
      } else _consoleErr('ForestBeast not available in this arena.');
    } else if (sub === 'yeti') {
      if (typeof Yeti !== 'undefined') {
        const y = new Yeti(500, 300);
        minions.push(y);
        _consoleOk('Spawned Yeti');
      } else _consoleErr('Yeti not available.');
    } else if (sub === 'dummy') {
      if (typeof Dummy !== 'undefined') {
        const d = new Dummy(450, 300);
        d.playerNum = 9; d.name = 'DUMMY';
        trainingDummies.push(d);
        _consoleOk('Spawned Dummy');
      }
    } else if (sub === 'god') {
      if (typeof spawnGod === 'function') {
        const _g = spawnGod(true); // consoleSummoned=true suppresses crash screen
        if (_g) _consoleOk('Summoned God (no crash — dev mode)');
        else    _consoleErr('God is already present.');
      } else _consoleErr('spawnGod not available.');
    } else { _consoleErr('Unknown entity: ' + sub); }
    return;
  }

  // ---- SUMMON ----
  if (cmd.startsWith('SUMMON')) {
    if (typeof gameRunning === 'undefined' || !gameRunning) { _consoleErr('Start a game first.'); return; }
    if (sub === 'god') {
      if (typeof spawnGod === 'function') {
        const _g = spawnGod(true); // consoleSummoned=true suppresses crash screen
        if (_g) _consoleOk('Summoned God (no crash — dev mode)');
        else    _consoleErr('God is already present.');
      } else _consoleErr('spawnGod not available.');
    } else {
      _consoleErr('Usage: summon god');
    }
    return;
  }

  // ---- SETMAP ----
  if (cmd.startsWith('SETMAP')) {
    const mapKey = sub;
    if (!mapKey || typeof ARENAS === 'undefined' || !ARENAS[mapKey]) {
      _consoleErr('Unknown arena. Try: grass lava space city forest ice ruins'); return;
    }
    if (typeof gameRunning !== 'undefined' && gameRunning) {
      currentArenaKey = mapKey;
      currentArena    = ARENAS[mapKey];
      if (typeof randomizeArenaLayout === 'function') randomizeArenaLayout(mapKey);
      if (typeof generateBgElements   === 'function') generateBgElements();
      _consoleOk('Arena changed to: ' + mapKey);
    } else { _consoleErr('Start a game first.'); }
    return;
  }

  // ---- SETWEAPON ----
  if (cmd.startsWith('SETWEAPON')) {
    const wKey = sub;
    const who  = (parts[2] || 'p1').toLowerCase();
    if (!wKey || typeof WEAPONS === 'undefined' || !WEAPONS[wKey]) { _consoleErr('Unknown weapon key.'); return; }
    if (typeof players === 'undefined') { _consoleErr('No game running.'); return; }
    const p = who === 'p2' || who === '2' ? players[1] : players[0];
    if (p) { p.weapon = WEAPONS[wKey]; _consoleOk(who + ' weapon set to ' + wKey); }
    return;
  }

  // ---- SETCLASS ----
  if (cmd.startsWith('SETCLASS')) {
    const cKey = sub;
    const who  = (parts[2] || 'p1').toLowerCase();
    if (!cKey || typeof CLASSES === 'undefined' || !CLASSES[cKey]) { _consoleErr('Unknown class key.'); return; }
    if (typeof players === 'undefined') { _consoleErr('No game running.'); return; }
    const p = who === 'p2' || who === '2' ? players[1] : players[0];
    if (p && typeof applyClass === 'function') { applyClass(p, cKey); _consoleOk(who + ' class set to ' + cKey); }
    return;
  }

  // ---- LIVES ----
  if (cmd.startsWith('LIVES')) {
    const n   = parseInt(parts[1]);
    const who = (parts[2] || 'all').toLowerCase();
    if (isNaN(n)) { _consoleErr('Usage: lives <number> [p1|p2|all]'); return; }
    if (typeof players === 'undefined') { _consoleErr('No game running.'); return; }
    const _setLives = (p) => { p.lives = n; };
    if (who === 'p1' || who === '1') { if (players[0]) _setLives(players[0]); }
    else if (who === 'p2' || who === '2') { if (players[1]) _setLives(players[1]); }
    else { players.forEach(_setLives); }
    _consoleOk('Lives set to ' + n + ' for ' + who);
    return;
  }

  // ---- GODMODE ----
  if (cmd.startsWith('GODMODE')) {
    if (typeof hasPermission === 'function' && !hasPermission('dev')) {
      _consoleErr('Permission denied — developer role required.'); return;
    }
    if (typeof players === 'undefined') { _consoleErr('No game running.'); return; }
    const who = sub || 'p1';
    const on  = parts[2] ? parts[2].toLowerCase() !== 'off' : true;
    const targets = (who === 'all' || who === 'everyone')
      ? players
      : [who === 'p2' || who === '2' ? players[1] : players[0]];
    targets.forEach(p => {
      if (!p) return;
      p.godmode    = on;
      p._godmode   = on;
      if (on) p.invincible = 999999;
      else    p.invincible = 0;
    });
    _consoleOk('Godmode ' + (on ? 'ON' : 'OFF') + ' for ' + who);
    return;
  }

  // ---- BOTS ----
  if (cmd.startsWith('BOTS')) {
    if (sub === 'reset') {
      if (typeof players !== 'undefined') players.filter(p => p.isAI).forEach(p => { p._aiState = 'approach'; p._stuckFrames = 0; });
      _consoleOk('All bot states reset to approach.');
    } else if (sub === 'kill') {
      if (typeof players !== 'undefined') players.filter(p => p.isAI && !p.isBoss).forEach(p => p.health = 0);
      _consoleOk('All bots killed.');
    } else { _consoleErr('Usage: bots reset|kill'); }
    return;
  }

  // ---- DEBUG ----
  if (cmd.startsWith('DEBUG')) {
    if (typeof debugMode !== 'undefined') {
      debugMode = sub !== 'off';
      _consoleOk('Debug overlay: ' + (debugMode ? 'ON' : 'OFF'));
    }
    return;
  }

  // ---- SLOW ----
  if (cmd.startsWith('SLOW')) {
    if (typeof timeScale !== 'undefined') {
      timeScale  = sub === 'off' ? 1.0 : 0.25;
      slowMotion = timeScale;
      _consoleOk('Slow motion: ' + (timeScale < 1 ? 'ON (0.25×)' : 'OFF'));
    }
    return;
  }

  // ---- COINS ----
  if (cmd === 'COINS') {
    const action = sub || 'show';
    const parseAmt = () => {
      const amt = parseInt(parts[2], 10);
      return Number.isFinite(amt) ? amt : null;
    };
    const current = (typeof getCoinBalance === 'function')
      ? getCoinBalance()
      : (typeof playerCoins !== 'undefined' ? playerCoins : 0);

    if (action === 'show') {
      _consoleOk('Coins: ' + current + ' ⬡');
      return;
    }

    const amount = parseAmt();
    if (amount === null) {
      _consoleErr('Usage: coins show|set <n>|give <n>|take <n>');
      return;
    }

    if (action === 'set') {
      if (typeof setCoinBalance === 'function') setCoinBalance(amount);
      else if (typeof updateCoins === 'function') updateCoins(function() { return amount; });
      _consoleOk('Coins set to ' + Math.max(0, amount) + ' ⬡');
    } else if (action === 'give' || action === 'add' || action === 'grant') {
      if (typeof awardCoins === 'function') awardCoins(amount);
      else if (typeof updateCoins === 'function') updateCoins(function(b) { return b + amount; });
      _consoleOk('Added ' + amount + ' ⬡. New balance: ' + (current + amount) + ' ⬡');
    } else if (action === 'take' || action === 'remove' || action === 'deduct') {
      if (typeof setCoinBalance === 'function') setCoinBalance(current - amount);
      else if (typeof updateCoins === 'function') updateCoins(function(b) { return b - amount; });
      _consoleOk('Removed ' + amount + ' ⬡. New balance: ' + Math.max(0, current - amount) + ' ⬡');
    } else {
      _consoleErr('Usage: coins show|set <n>|give <n>|take <n>');
    }
    return;
  }

  // ---- PAUSE / RESUME ----
  if (cmd === 'PAUSE' || cmd === 'RESUME') {
    if (typeof pauseGame !== 'function' || typeof resumeGame !== 'function') {
      _consoleErr('Pause system not available.');
      return;
    }
    const mode = (sub || (cmd === 'RESUME' ? 'off' : 'toggle')).toLowerCase();
    if (mode === 'off' || mode === 'resume') {
      resumeGame();
      _consoleOk('Game resumed.');
    } else if (mode === 'on' || mode === 'pause') {
      if (!paused) pauseGame();
      _consoleOk('Game paused.');
    } else {
      pauseGame();
      _consoleOk(paused ? 'Game paused.' : 'Game resumed.');
    }
    return;
  }

  // ---- REVIVE / RESPAWN ----
  if (cmd === 'REVIVE' || cmd === 'RESPAWN') {
    if (typeof players === 'undefined' || players.length === 0) {
      _consoleErr('No active game.');
      return;
    }
    const who = (sub || 'all').toLowerCase();
    const _revive = (p) => {
      if (!p) return;
      if (typeof p.respawn === 'function') {
        p.respawn();
      } else {
        p.health = p.maxHealth;
        p.invincible = 100;
      }
      if (typeof p.lives === 'number' && p.lives <= 0) p.lives = 1;
    };
    if (who === 'p1' || who === '1' || who === 'player') {
      _revive(players[0]);
    } else if (who === 'p2' || who === '2') {
      _revive(players[1]);
    } else if (who === 'boss') {
      _revive(players.find(p => p && p.isBoss));
    } else {
      players.forEach(_revive);
      if (typeof trainingDummies !== 'undefined') trainingDummies.forEach(_revive);
      if (typeof minions !== 'undefined') minions.forEach(_revive);
    }
    _consoleOk('Respawned ' + who);
    return;
  }

  // ---- UNLOCKALL ----
  if (cmd === 'UNLOCKALL') {
    if (typeof hasPermission === 'function' && !hasPermission('dev')) {
      _consoleErr('Permission denied — developer role required.'); return;
    }
    if (typeof _cheatUnlockAll === 'function') {
      _cheatUnlockAll();
      _consoleOk('Everything unlocked!');
    } else { _consoleErr('_cheatUnlockAll not found.'); }
    return;
  }

  // ---- UNLOCK ----
  if (cmd.startsWith('UNLOCK')) {
    if (sub === 'trueform') {
      if (typeof setAccountFlagWithRuntime === 'function') {
        setAccountFlagWithRuntime(['unlocks', 'trueform'], true, function(v) { unlockedTrueBoss = v; });
      } else if (typeof unlockedTrueBoss !== 'undefined') { unlockedTrueBoss = true; }
      const card = document.getElementById('modeTrueForm');
      if (card) card.style.display = '';
      _consoleOk('True Form unlocked!');
    } else if (sub === 'megaknight') {
      if (typeof unlockedMegaknight !== 'undefined') {
        if (typeof setAccountFlagWithRuntime === 'function') {
          setAccountFlagWithRuntime(['unlocks', 'megaknight'], true, function(v) { unlockedMegaknight = v; });
        } else { unlockedMegaknight = true; }
        ['p1Class','p2Class'].forEach(id => {
          const sel = document.getElementById(id);
          if (sel && !sel.querySelector('option[value="megaknight"]')) {
            const opt = document.createElement('option'); opt.value='megaknight'; opt.textContent='Class: Megaknight ★'; sel.appendChild(opt);
          }
        });
        _consoleOk('Class: Megaknight unlocked!');
      }
    } else { _consoleErr('Usage: unlock trueform|megaknight'); }
    return;
  }

  // ---- SETWEAPON <weaponName> [p1|p2] ----
  if (cmd.startsWith('SETWEAPON')) {
    const parts = raw.trim().split(/\s+/);
    const wName = (parts[1] || '').toLowerCase();
    const slot  = parts[2] === 'p2' ? 1 : 0;
    if (!wName) { _consoleErr('Usage: setweapon <name> [p1|p2]'); return; }
    const allWeapons = Object.assign({}, typeof WEAPONS !== 'undefined' ? WEAPONS : {}, window.CUSTOM_WEAPONS || {});
    const wKey = Object.keys(allWeapons).find(k => k.toLowerCase() === wName);
    if (!wKey) { _consoleErr('Unknown weapon: ' + wName + '. Available: ' + Object.keys(allWeapons).join(', ')); return; }
    const p = players && players[slot];
    if (!p) { _consoleErr('No player in slot ' + slot); return; }
    p.weapon = allWeapons[wKey];
    p.weaponKey = wKey;
    _consoleOk('P' + (slot + 1) + ' weapon set to ' + wKey);
    return;
  }

  // ---- EVAL (raw JS) ----
  if (raw.toLowerCase().startsWith('eval ')) {
    if (typeof hasPermission === 'function' && !hasPermission('dev')) {
      _consoleErr('Permission denied — developer role required.'); return;
    }
    const code = raw.slice(5);
    try {
      // eslint-disable-next-line no-eval
      const result = eval(code); // intentional: developer console feature
      _consoleOk(String(result));
    } catch(err) {
      _consoleErr(err.message);
    }
    return;
  }

  // True Form adaptive AI debug commands
  if (cmd === 'TF ADAPT' || cmd === 'TF ADAPTATION') { if (typeof showAdaptationLevel === 'function') showAdaptationLevel(); return; }
  if (cmd === 'TF PROFILE') { if (typeof showPlayerProfile === 'function') showPlayerProfile(); return; }
  if (parts[0] && parts[0].toLowerCase() === 'tf' && parts[1] && parts[1].toLowerCase() === 'force' && parts[2]) {
    if (typeof forceAdaptationLevel === 'function') { forceAdaptationLevel(parseFloat(parts[2])); return; }
  }
  if (typeof handleChaosConsoleCmd === 'function' && handleChaosConsoleCmd(raw)) return;

  // ---- PATHFINDING DEBUG ----
  if (cmd === 'PF' || cmd === 'PATHFINDING') {
    if (sub === 'graph') {
      window._pfShowGraph = !window._pfShowGraph;
      _consoleOk('Platform graph viz: ' + (window._pfShowGraph ? 'ON' : 'OFF'));
    } else if (sub === 'paths') {
      window._pfShowPaths = !window._pfShowPaths;
      _consoleOk('Bot path viz: ' + (window._pfShowPaths ? 'ON' : 'OFF'));
    } else if (sub === 'arcs') {
      window._pfShowArcs = !window._pfShowArcs;
      _consoleOk('Projected landing arcs: ' + (window._pfShowArcs ? 'ON' : 'OFF'));
    } else if (sub === 'dj' || sub === 'doublejump') {
      window._pfShowDJ = !window._pfShowDJ;
      _consoleOk('Double-jump edge highlight: ' + (window._pfShowDJ ? 'ON' : 'OFF'));
    } else if (sub === 'log') {
      if (typeof logUnsafeEdgeAttempts === 'function') logUnsafeEdgeAttempts();
      _consoleOk('Unsafe edge log printed to console.');
    } else if (sub === 'reset') {
      if (typeof players !== 'undefined')
        players.filter(p => p.isAI).forEach(p => { if (typeof forceRecalculatePath === 'function') forceRecalculatePath(p); });
      _consoleOk('All bot paths reset.');
    } else if (sub === 'rebuild') {
      if (typeof buildGraphForCurrentArena === 'function') { buildGraphForCurrentArena(); _consoleOk('Graph rebuilt.'); }
    } else {
      _consoleOk('pf graph | pf paths | pf arcs | pf dj | pf log | pf reset | pf rebuild');
    }
    return;
  }

  // ---- MAP ANALYZE ----
  if (cmd === 'MAPS ANALYZE') {
    analyzeAllMaps().forEach(r => { console.log(formatMapAnalysis(r)); });
    _consoleOk('Map analysis printed to browser console.');
    return;
  }
  if (cmd === 'MAPS ANALYZE RAW') {
    console.log(analyzeAllMaps());
    _consoleOk('Raw map analysis array printed to browser console.');
    return;
  }
  if (cmd.startsWith('MAP ANALYZE ')) {
    const key = parts[2];
    if (ARENAS[key]) {
      console.log(formatMapAnalysis({ key, ...analyzeMap(ARENAS[key]) }));
      _consoleOk('Analysis for "' + key + '" printed to browser console.');
    } else {
      _consoleErr('Map not found: ' + key);
    }
    return;
  }

  // ── SOVEREIGN Ω console commands ──────────────────────────────────────
  if (cmd === 'SOV STATS' || cmd === 'SOVEREIGN STATS') { if (typeof showSovereignStats === 'function') showSovereignStats(!adaptiveAIDebug); return; }
  if (cmd === 'SOV PREDICT' || cmd === 'SOVEREIGN PREDICT') { if (typeof showSovereignPredictions === 'function') showSovereignPredictions(); return; }
  if (cmd === 'SOV RESET' || cmd === 'SOVEREIGN RESET') { if (typeof resetSovereignMK2 === 'function') resetSovereignMK2(); return; }
  if (cmd.startsWith('SOV LIMITER') || cmd.startsWith('SOVEREIGN LIMITER')) {
    const ai = players && players.find(p => p.isSovereignMK2);
    if (ai) { ai._limiterBroken = !ai._limiterBroken; ok(`Limiter break: ${ai._limiterBroken ? 'ON' : 'OFF'}`); }
    return;
  }

  // ── SETHP ─────────────────────────────────────────────────────────────
  if (parts[0].toLowerCase() === 'sethp') {
    // sethp <value>  |  sethp p1|p2|player|boss|all <value>
    let target = 'all', valStr;
    if (parts.length >= 3 && isNaN(parts[1])) {
      target = parts[1].toLowerCase();
      valStr = parts[2];
    } else {
      valStr = parts[1];
    }
    const val = parseInt(valStr, 10);
    if (isNaN(val)) { _consoleErr('Usage: sethp <value>  or  sethp p1|p2|player|boss|all <value>'); return; }
    if (!players || players.length === 0) { _consoleErr('No active game.'); return; }
    let count = 0;
    players.forEach((p, idx) => {
      const isBossEntity = p.isBoss || p.isTrueForm;
      if (target === 'player' && isBossEntity) return;
      if (target === 'boss'   && !isBossEntity) return;
      if (target === 'p1'     && idx !== 0) return;
      if (target === 'p2'     && idx !== 1) return;
      p.health = Math.max(1, Math.min(val, p.maxHealth));
      count++;
    });
    _consoleOk(`Set HP to ${val} for ${count} entit${count === 1 ? 'y' : 'ies'}.`);
    return;
  }

  // ---- SETCHAPTER (dev only) ----
  if (cmd.startsWith('SETCHAPTER')) {
    if (typeof hasPermission === 'function' && !hasPermission('dev')) {
      _consoleErr('Permission denied — developer role required.'); return;
    }
    const chId  = parseInt(parts[1], 10);
    const acId  = parts[2] || (typeof AccountManager !== 'undefined' && AccountManager.getActiveAccount()
      ? AccountManager.getActiveAccount().id : '');
    if (isNaN(chId))  { _consoleErr('Usage: setchapter <id> [accountId]'); return; }
    if (!acId)        { _consoleErr('No active account.'); return; }
    if (typeof setPlayerChapter === 'function') { setPlayerChapter(acId, chId); _consoleOk('Chapter set to ' + chId); }
    else              { _consoleErr('setPlayerChapter not available.'); }
    return;
  }

  // ---- STARTBOSS (dev only) ----
  if (cmd.startsWith('STARTBOSS')) {
    if (typeof hasPermission === 'function' && !hasPermission('dev')) {
      _consoleErr('Permission denied — developer role required.'); return;
    }
    const bossType = sub || 'boss';
    if (typeof gameRunning !== 'undefined' && gameRunning && typeof backToMenu === 'function') backToMenu();
    if (typeof selectMode === 'function') selectMode(bossType === 'trueform' ? 'trueform' : 'boss');
    if (typeof startGame  === 'function') startGame();
    _consoleOk('Starting ' + bossType + ' fight…');
    return;
  }

  // ---- UNLOCKALLSKILLS (dev only) ----
  if (cmd === 'UNLOCKALLSKILLS') {
    if (typeof hasPermission === 'function' && !hasPermission('dev')) {
      _consoleErr('Permission denied — developer role required.'); return;
    }
    const unlAcct = parts[1] || (typeof AccountManager !== 'undefined' && AccountManager.getActiveAccount()
      ? AccountManager.getActiveAccount().id : '');
    if (!unlAcct) { _consoleErr('No active account.'); return; }
    if (typeof unlockAllItems === 'function') { unlockAllItems(unlAcct); _consoleOk('All items unlocked for ' + unlAcct); }
    else          { _consoleErr('unlockAllItems not available.'); }
    return;
  }

  // ---- SETACCOUNTROLE (dev only) ----
  if (cmd.startsWith('SETACCOUNTROLE')) {
    if (typeof hasPermission === 'function' && !hasPermission('dev')) {
      _consoleErr('Permission denied — developer role required.'); return;
    }
    const roleTargetId = parts[1] || '';
    const newRole      = (parts[2] || '').toLowerCase();
    if (!roleTargetId || !['player', 'admin', 'dev'].includes(newRole)) {
      _consoleErr('Usage: setaccountrole <accountId> <player|admin|dev>'); return;
    }
    if (typeof AccountManager === 'undefined') { _consoleErr('AccountManager not available.'); return; }
    const roleAcct = AccountManager.getAllAccounts().find(function(a) { return a.id === roleTargetId; });
    if (!roleAcct) { _consoleErr('Account not found: ' + roleTargetId); return; }
    if (typeof isSuperuserAccountId === 'function' && isSuperuserAccountId(roleTargetId) && newRole !== 'dev') {
      _consoleErr('That account is pinned to dev and cannot be downgraded.');
      return;
    }
    if (typeof GameState !== 'undefined') {
      GameState.update(function(s) {
        if (s.persistent.accounts[roleTargetId]) s.persistent.accounts[roleTargetId].role = newRole;
      });
      GameState.save();
    }
    _consoleOk('Account ' + roleTargetId + ' role set to ' + newRole);
    return;
  }

  // ---- WHO / ACCOUNTS ----
  if (cmd === 'WHO' || cmd === 'ACCOUNTS') {
    if (typeof AccountManager === 'undefined') { _consoleErr('AccountManager not available.'); return; }
    const _active = AccountManager.getActiveAccount();
    const _all    = AccountManager.getAllAccounts();
    if (_all.length === 0) { _consolePrint('No accounts found.', '#ffaa44'); return; }
    _consolePrint('── Accounts (' + _all.length + ') ──', '#44aaff');
    _all.forEach(function(a) {
      const isMe = _active && a.id === _active.id;
      _consolePrint((isMe ? '★ ' : '  ') + a.username + '  [' + (a.role || 'player') + ']', isMe ? '#ffdd66' : '#ccccff');
      _consolePrint('    id: ' + a.id, '#6688cc');
    });
    return;
  }

  // ---- WHOAMI ----
  if (cmd === 'WHOAMI') {
    if (typeof adminWhoAmI === 'function') {
      adminWhoAmI();
    } else {
      _consoleErr('Identity helper not available.');
    }
    return;
  }

  // ---- NET STATUS / NET PEERS ----
  if (cmd === 'NET STATUS') {
    if (typeof adminNetStatus === 'function') {
      adminNetStatus();
    } else {
      _consoleErr('Network status helper not available.');
    }
    return;
  }
  if (cmd === 'NET PEERS') {
    if (window.NetworkManager && typeof NetworkManager.getPeerRoster === 'function') {
      const roster = NetworkManager.getPeerRoster();
      if (!roster.length) { _consolePrint('No connected peers.', '#ffaa44'); return; }
      roster.forEach(function(p) {
        _consolePrint(
          'slot ' + p.slot + ' | ' + (p.username || 'Unknown') +
          ' | acct=' + (p.accountId || '—') +
          ' | peer=' + (p.peerId || '—') +
          ' | device=' + (p.deviceId || '—'),
          '#88bbff'
        );
      });
    } else {
      _consoleErr('Network roster not available.');
    }
    return;
  }

  // ---- BAN / TEMPBAN / BANPEER / BANIP / UNBAN / BANLIST ----
  if (cmd.startsWith('BANIP')) {
    const parsed = _parseBanArgs(1);
    if (!parsed.target) { _consoleErr('Usage: banip <target> [minutes] [reason]'); return; }
    if (typeof adminBanIp === 'function') {
      adminBanIp(parsed.target, parsed.minutes, parsed.reason);
      _consoleOk('Best-effort IP ban queued for ' + parsed.target);
    } else {
      _consoleErr('Ban helpers not available.');
    }
    return;
  }
  if (cmd.startsWith('BANPEER')) {
    const parsed = _parseBanArgs(1);
    if (!parsed.target) { _consoleErr('Usage: banpeer <peerId> [minutes] [reason]'); return; }
    if (typeof adminBanPeer === 'function') {
      adminBanPeer(parsed.target, parsed.minutes, parsed.reason);
      _consoleOk('Peer ban queued for ' + parsed.target);
    } else {
      _consoleErr('Ban helpers not available.');
    }
    return;
  }
  if (cmd === 'BAN' || cmd.startsWith('BAN ')) {
    const parsed = _parseBanArgs(1);
    if (!parsed.target) { _consoleErr('Usage: ban <target> [minutes] [reason]'); return; }
    if (typeof adminBanTarget === 'function') {
      adminBanTarget(parsed.target, parsed.minutes, parsed.reason, { kind: 'mixed' });
      _consoleOk('Ban queued for ' + parsed.target);
    } else {
      _consoleErr('Ban helpers not available.');
    }
    return;
  }
  if (cmd.startsWith('TEMPBAN')) {
    const parsed = _parseBanArgs(1);
    if (!parsed.target || !parsed.minutes) { _consoleErr('Usage: tempban <target> <minutes> [reason]'); return; }
    if (typeof adminTempBanTarget === 'function') {
      adminTempBanTarget(parsed.target, parsed.minutes, parsed.reason, { kind: 'mixed' });
      _consoleOk('Temp ban queued for ' + parsed.target + ' (' + parsed.minutes + 'm)');
    } else {
      _consoleErr('Ban helpers not available.');
    }
    return;
  }
  if (cmd.startsWith('UNBAN')) {
    const target = parts.slice(1).join(' ').trim();
    if (!target) { _consoleErr('Usage: unban <target>'); return; }
    if (typeof adminUnbanTarget === 'function') {
      adminUnbanTarget(target);
      _consoleOk('Unban processed for ' + target);
    } else {
      _consoleErr('Ban helpers not available.');
    }
    return;
  }
  if (cmd === 'BANLIST') {
    if (typeof adminListBans === 'function') {
      adminListBans();
    } else {
      _consoleErr('Ban helpers not available.');
    }
    return;
  }
  if (cmd.startsWith('KICK')) {
    const target = parts.slice(1).join(' ').trim();
    if (!target) { _consoleErr('Usage: kick <target>'); return; }
    if (typeof _adminPanelKickTarget === 'function') {
      _adminPanelKickTarget(target);
      _consoleOk('Kick processed for ' + target);
    } else {
      _consoleErr('Kick helper not available.');
    }
    return;
  }

  // ---- VERSION ----
  if (cmd === 'VERSION') {
    _consolePrint('Stickman Clash (Stickman Battles)', '#88bbff');
    _consolePrint('Build: ' + (typeof GAME_VERSION !== 'undefined' ? GAME_VERSION : 'dev'), '#88bbff');
    _consolePrint('Mode: ' + (typeof gameMode !== 'undefined' ? gameMode || 'menu' : 'unknown'), '#88bbff');
    _consolePrint('Arena: ' + (typeof currentArenaKey !== 'undefined' ? currentArenaKey || '—' : '—'), '#88bbff');
    const _acctV = (typeof AccountManager !== 'undefined' && AccountManager.getActiveAccount) ? AccountManager.getActiveAccount() : null;
    if (_acctV) _consolePrint('Account: ' + _acctV.username + ' [' + (_acctV.role || 'player') + '] ' + _acctV.id, '#88bbff');
    return;
  }

  // ---- TIME ----
  if (cmd === 'TIME' || cmd === 'GAMETIME') {
    const fc = typeof frameCount !== 'undefined' ? frameCount : '?';
    const secs = typeof frameCount !== 'undefined' ? (frameCount / 60).toFixed(1) : '?';
    _consolePrint('Frame: ' + fc + '  |  Time: ' + secs + 's', '#88bbff');
    _consolePrint('Date: ' + new Date().toLocaleString(), '#88bbff');
    return;
  }

  // ---- SETSPEED ----
  if (cmd.startsWith('SETSPEED')) {
    if (typeof hasPermission === 'function' && !hasPermission('dev')) { _consoleErr('Permission denied — developer role required.'); return; }
    const spd = parseFloat(parts[1]);
    if (isNaN(spd) || spd <= 0) { _consoleErr('Usage: setspeed <n>  (e.g. setspeed 0.5 or setspeed 2)'); return; }
    if (typeof timeScale !== 'undefined') { timeScale = spd; slowMotion = spd; }
    else if (typeof slowMotion !== 'undefined') { slowMotion = spd; }
    _consoleOk('Game speed set to ' + spd + '×');
    return;
  }

  // ---- GRAVITY ----
  if (cmd.startsWith('GRAVITY')) {
    if (typeof hasPermission === 'function' && !hasPermission('dev')) { _consoleErr('Permission denied — developer role required.'); return; }
    const gv = parseFloat(parts[1]);
    if (isNaN(gv)) { _consolePrint('Current gravity multiplier: ' + (typeof gravityMult !== 'undefined' ? gravityMult : 1), '#88bbff'); return; }
    if (typeof window !== 'undefined') { window.gravityMult = gv; }
    _consoleOk('Gravity multiplier set to ' + gv + '×  (takes effect on next physics tick)');
    _consolePrint('Note: gravityMult is read in Fighter.update(). If your build reads a local var, use eval instead.', '#ffaa44');
    return;
  }

  // ---- NOCLIP ----
  if (cmd.startsWith('NOCLIP')) {
    if (typeof hasPermission === 'function' && !hasPermission('dev')) { _consoleErr('Permission denied — developer role required.'); return; }
    if (typeof players === 'undefined' || !players.length) { _consoleErr('No active game.'); return; }
    const who  = (parts[1] || 'p1').toLowerCase();
    const onOff = parts[2] ? parts[2].toLowerCase() !== 'off' : null; // null = toggle
    const targets = (who === 'all') ? players : [who === 'p2' || who === '2' ? players[1] : players[0]];
    targets.forEach(p => {
      if (!p) return;
      p._noclip = (onOff !== null) ? onOff : !p._noclip;
      if (p._noclip) p.onGround = false; // prevent immediate snap-to-floor
    });
    const state = targets[0] && targets[0]._noclip;
    _consoleOk('Noclip ' + (state ? 'ON' : 'OFF') + ' for ' + who);
    _consolePrint('Note: Fighter.update() must check p._noclip to skip platform collision.', '#ffaa44');
    return;
  }

  // ---- RELOAD ----
  if (cmd === 'RELOAD') {
    if (typeof hasPermission === 'function' && !hasPermission('dev')) { _consoleErr('Permission denied — developer role required.'); return; }
    _consolePrint('Reloading…', '#ffaa44');
    setTimeout(function() { window.location.reload(); }, 400);
    return;
  }

  // ---- BOSS PHASE ----
  if (cmd === 'BOSS PHASE' || (parts[0].toUpperCase() === 'BOSS' && parts[1] && parts[1].toLowerCase() === 'phase')) {
    if (typeof hasPermission === 'function' && !hasPermission('dev')) { _consoleErr('Permission denied — developer role required.'); return; }
    const targetPhase = parseInt(parts[2], 10);
    if (isNaN(targetPhase) || targetPhase < 1 || targetPhase > 3) { _consoleErr('Usage: boss phase <1|2|3>'); return; }
    const bossEntity = (typeof players !== 'undefined') ? players.find(function(p) { return p && p.isBoss && !p.isTrueForm; }) : null;
    if (!bossEntity) { _consoleErr('No boss entity found in current game.'); return; }
    // Set health to the threshold that forces the target phase
    // Phase 1: >2000 HP, Phase 2: 1001-2000 HP, Phase 3: <=1000 HP
    const phaseThresholds = { 1: bossEntity.maxHealth, 2: 1500, 3: 500 };
    bossEntity.health = Math.min(phaseThresholds[targetPhase], bossEntity.maxHealth);
    _consoleOk('Boss health set to ' + bossEntity.health + ' (targeting phase ' + targetPhase + ')');
    return;
  }

  // ---- ARENA LIST ----
  if (cmd === 'ARENA LIST') {
    if (typeof ARENAS === 'undefined') { _consoleErr('ARENAS not available.'); return; }
    _consolePrint('Available arenas:', '#44aaff');
    Object.keys(ARENAS).forEach(function(k) {
      const a = ARENAS[k];
      _consolePrint('  ' + k + (a.name ? '  — ' + a.name : '') + (a.isBossArena ? '  [boss]' : '') + (a.isVoidArena ? '  [trueform]' : ''), '#ccddff');
    });
    return;
  }

  // ---- WEAPON LIST ----
  if (cmd === 'WEAPON LIST') {
    if (typeof WEAPONS === 'undefined') { _consoleErr('WEAPONS not available.'); return; }
    _consolePrint('Available weapons:', '#44aaff');
    Object.keys(WEAPONS).forEach(function(k) {
      const w = WEAPONS[k];
      _consolePrint('  ' + k + (w.name ? '  — ' + w.name : '') + (w.damage ? '  dmg:' + w.damage : ''), '#ccddff');
    });
    return;
  }

  // ---- CLASS LIST ----
  if (cmd === 'CLASS LIST') {
    if (typeof CLASSES === 'undefined') { _consoleErr('CLASSES not available.'); return; }
    _consolePrint('Available classes:', '#44aaff');
    Object.keys(CLASSES).forEach(function(k) {
      const c = CLASSES[k];
      _consolePrint('  ' + k + (c.name ? '  — ' + c.name : ''), '#ccddff');
    });
    return;
  }

  // ---- STORY LIST ----
  if (cmd === 'STORY LIST') {
    if (typeof hasPermission === 'function' && !hasPermission('dev')) { _consoleErr('Permission denied — developer role required.'); return; }
    if (typeof STORY_CHAPTERS === 'undefined') { _consoleErr('STORY_CHAPTERS not available.'); return; }
    _consolePrint('Story chapters (' + STORY_CHAPTERS.length + '):', '#44aaff');
    STORY_CHAPTERS.forEach(function(ch, i) {
      _consolePrint('  [' + i + '] ' + (ch.title || ch.id || '(untitled)'), '#ccddff');
    });
    return;
  }

  // ---- ACCOUNT INFO ----
  if (cmd.startsWith('ACCOUNT INFO') || (parts[0].toUpperCase() === 'ACCOUNT' && parts[1] && parts[1].toLowerCase() === 'info')) {
    if (!_consoleIsAdmin && typeof hasPermission === 'function' && !hasPermission('admin')) { _consoleErr('Permission denied — admin role required.'); return; }
    if (typeof AccountManager === 'undefined') { _consoleErr('AccountManager not available.'); return; }
    const targetId = parts[2] || '';
    const infoAcct = targetId
      ? AccountManager.getAllAccounts().find(function(a) { return a.id === targetId; })
      : AccountManager.getActiveAccount();
    if (!infoAcct) { _consoleErr('Account not found: ' + (targetId || '(none active)')); return; }
    _consolePrint('── Account: ' + infoAcct.username + ' ──', '#44aaff');
    _consolePrint('  id:       ' + infoAcct.id, '#ccddff');
    _consolePrint('  role:     ' + (infoAcct.role || 'player'), '#ccddff');
    _consolePrint('  created:  ' + new Date(infoAcct.createdAt).toLocaleString(), '#ccddff');
    _consolePrint('  saveKey:  ' + (infoAcct.saveKey || '—'), '#ccddff');
    // Check ban status
    if (typeof isConnectionBanned === 'function') {
      const br = isConnectionBanned({ accountId: infoAcct.id, username: infoAcct.username });
      if (br) {
        const ttl = br.expiresAt ? Math.max(0, Math.ceil((br.expiresAt - Date.now()) / 60000)) + 'm remaining' : 'permanent';
        _consolePrint('  BANNED:   ' + (br.reason || 'no reason') + ' [' + ttl + ']', '#ff6666');
      } else {
        _consolePrint('  status:   not banned', '#44ff88');
      }
    }
    return;
  }

  // ---- BANCHECK ----
  if (cmd.startsWith('BANCHECK')) {
    if (!_consoleIsAdmin && typeof hasPermission === 'function' && !hasPermission('admin')) { _consoleErr('Permission denied — admin role required.'); return; }
    const checkTarget = parts.slice(1).join(' ').trim();
    if (!checkTarget) { _consoleErr('Usage: bancheck <accountId|username>'); return; }
    if (typeof isConnectionBanned !== 'function' || typeof _adminResolveBanTarget !== 'function') { _consoleErr('Ban helpers not available.'); return; }
    const checkBundle = _adminResolveBanTarget(checkTarget);
    if (!checkBundle) { _consoleErr('Could not resolve target: ' + checkTarget); return; }
    const identity = { accountId: checkBundle.accountId || '', peerId: checkBundle.peerId || '', deviceId: checkBundle.deviceId || '', username: checkBundle.username || '' };
    const banRec = isConnectionBanned(identity);
    if (banRec) {
      const ttl = banRec.expiresAt ? Math.max(0, Math.ceil((banRec.expiresAt - Date.now()) / 60000)) + 'm remaining' : 'permanent';
      _consolePrint(checkBundle.label + ' is BANNED  [' + ttl + ']', '#ff6666');
      _consolePrint('Reason: ' + (banRec.reason || 'none'), '#ffaaaa');
      _consolePrint('Issued: ' + (banRec.createdAt ? new Date(banRec.createdAt).toLocaleString() : '?'), '#ffaaaa');
    } else {
      _consoleOk(checkBundle.label + ' is NOT banned.');
    }
    return;
  }

  // ---- NOTIFY ----
  if (cmd.startsWith('NOTIFY')) {
    if (!_consoleIsAdmin && typeof hasPermission === 'function' && !hasPermission('admin')) { _consoleErr('Permission denied — admin role required.'); return; }
    const notifyMsg = parts.slice(1).join(' ').trim();
    if (!notifyMsg) { _consoleErr('Usage: notify <message>'); return; }
    // Broadcast online if connected
    if (typeof onlineMode !== 'undefined' && onlineMode && typeof NetworkManager !== 'undefined' && NetworkManager.connected) {
      NetworkManager.sendGameEvent('consoleCmd', { cmd: 'NOTIFY_DISPLAY ' + notifyMsg });
    }
    // Show locally
    if (typeof _showNotification === 'function') {
      _showNotification(notifyMsg);
    } else if (typeof _adminToast === 'function') {
      _adminToast(notifyMsg);
    } else {
      _consolePrint('[Notification] ' + notifyMsg, '#ffdd88');
    }
    _consoleOk('Notification sent: ' + notifyMsg);
    return;
  }

  // ---- SYNC ----
  // Pulls the latest ban list from the server and merges it locally.
  if (cmd === 'SYNC' || cmd === 'SYNC BANS') {
    if (!_consoleIsAdmin && typeof hasPermission === 'function' && !hasPermission('admin')) { _consoleErr('Permission denied — admin role required.'); return; }
    const serverUrl = (typeof SERVER_CONFIG !== 'undefined') ? SERVER_CONFIG.url : '';
    if (!serverUrl) {
      _consolePrint('SERVER_CONFIG.url is not set — running in offline mode.', '#ffaa44');
      _consolePrint('Set SERVER_CONFIG.url in smb-globals.js to enable server sync.', '#ffaa44');
      return;
    }
    _consolePrint('Syncing bans from ' + serverUrl + ' …', '#88bbff');
    if (typeof syncBansFromServer === 'function') {
      syncBansFromServer().then(function(added) {
        if (added === null || added === undefined) {
          _consoleErr('Server unreachable — could not sync.');
        } else {
          _consoleOk('Sync complete. ' + added + ' new ban(s) imported.');
        }
      });
    } else {
      _consoleErr('syncBansFromServer not available.');
    }
    return;
  }

  // ---- SERVER STATUS ----
  if (cmd === 'SERVER' || cmd === 'SERVER STATUS') {
    const serverUrl = (typeof SERVER_CONFIG !== 'undefined') ? SERVER_CONFIG.url : '';
    if (!serverUrl) { _consolePrint('Server: (not configured — offline mode)', '#ffaa44'); return; }
    _consolePrint('Checking ' + serverUrl + '/api/status …', '#88bbff');
    fetch(serverUrl + '/api/status')
      .then(function(r) { return r.json(); })
      .then(function(d) {
        _consoleOk('Server online  v' + (d.version || '?') + '  |  active bans: ' + (d.activeBans || 0) + '  |  uptime: ' + (d.uptime || 0) + 's');
      })
      .catch(function(e) { _consoleErr('Server unreachable: ' + (e.message || e)); });
    return;
  }

  // Handle NOTIFY_DISPLAY (received from broadcast — render it locally)
  if (cmd.startsWith('NOTIFY_DISPLAY')) {
    const displayMsg = raw.slice('NOTIFY_DISPLAY '.length).trim();
    if (typeof _showNotification === 'function') { _showNotification(displayMsg); }
    else if (typeof _adminToast === 'function') { _adminToast(displayMsg); }
    return;
  }

  _consoleErr('Unknown command: ' + parts[0] + '  (type HELP for list)');
}

