'use strict';
// smb-input.js — Keyboard event handlers, _normKey, _clearAllKeys, SCROLL_BLOCK, processInput()
// Depends on: smb-globals.js, smb-data-weapons.js (WEAPONS)
// ============================================================
// INPUT
// ============================================================
const keysDown      = new Set();
const keyHeldFrames = {};   // key → frames held continuously

const SCROLL_BLOCK = new Set([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 's', '/']);

// Normalize a key string so that caps-lock and shift don't break single-letter
// bindings. Only single alphabetic characters are lowercased; everything else
// (Arrow*, Enter, ' ', '.', '/', etc.) is returned unchanged.
function _normKey(k) {
  return (k.length === 1 && k >= 'A' && k <= 'Z') ? k.toLowerCase() : k;
}

document.addEventListener('keydown', e => {
  // Don't intercept keys when typing in any text input (chat, console, etc.)
  const ae = document.activeElement;
  const inputFocused = ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.isContentEditable);
  if (inputFocused) return; // let the input receive all keystrokes unmodified
  if (tfEndingScene && tfEndingScene.skippable && tfEndingScene.phase === 'powers') { trySkipTFEnding(); return; }
  if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') { pauseGame(); return; }
  // Cheat code: type TRUEFORM anywhere in menu to unlock True Form
  // GAMECONSOLE works any time (menu or in-game)
  if (e.key && e.key.length === 1) {
    _cheatBuffer = ((_cheatBuffer || '') + e.key.toUpperCase()).slice(-20);
    if (_cheatBuffer.endsWith('GAMECONSOLE')) {
      _cheatBuffer = '';
      openGameConsole();
    }
  }
  if (!gameRunning && e.key && e.key.length === 1) {
    // _cheatBuffer already updated above — just check for menu-only codes
    if (_cheatBuffer.endsWith('TRUEFORM')) {
      _cheatBuffer = '';
      if (!unlockedTrueBoss) {
        if (typeof setAccountFlagWithRuntime === 'function') {
          setAccountFlagWithRuntime(['unlocks', 'trueform'], true, function(v) { unlockedTrueBoss = v; });
          [0,1,2,3,4,5,6,7].forEach(function(id) { if (typeof addLetter === 'function') addLetter(id); });
        } else {
          unlockedTrueBoss = true;
          [0,1,2,3,4,5,6,7].forEach(function(id) { collectedLetterIds.add(id); });
        }
        syncCodeInput();
        const card = document.getElementById('modeTrueForm');
        if (card) card.style.display = '';
        spawnParticles && spawnParticles(450, 260, '#cc00ff', 30);
        spawnParticles && spawnParticles(450, 260, '#ffffff', 20);
        showBossDialogue && showBossDialogue('True Form Unlocked!', 180);
        // Show a brief notification
        const notif = document.createElement('div');
        notif.textContent = '⚡ TRUE FORM UNLOCKED ⚡';
        notif.style.cssText = 'position:fixed;top:20%;left:50%;transform:translateX(-50%);background:rgba(160,0,255,0.92);color:#fff;padding:16px 32px;border-radius:12px;font-size:1.2rem;font-weight:900;letter-spacing:3px;z-index:9999;pointer-events:none;text-align:center;box-shadow:0 0 40px #cc00ff;';
        document.body.appendChild(notif);
        setTimeout(() => notif.remove(), 3000);
      }
    }
    // SOVEREIGN cheat: type UNLOCKSOVEREIGN in menu
    if (_cheatBuffer.endsWith('UNLOCKSOVEREIGN')) {
      _cheatBuffer = '';
      if (!sovereignBeaten) {
        if (typeof setAccountFlagWithRuntime === 'function') {
          setAccountFlagWithRuntime(['unlocks', 'sovereignBeaten'], true, function(v) { sovereignBeaten = v; });
        } else {
          sovereignBeaten = true;
        }
        const adCard  = document.getElementById('modeAdaptive');
        const sovCard = document.getElementById('modeSovereign');
        if (adCard)  adCard.style.display  = '';
        if (sovCard) sovCard.style.display = '';
        const notif = document.createElement('div');
        notif.textContent = '⚡ SOVEREIGN UNLOCKED ⚡';
        notif.style.cssText = 'position:fixed;top:20%;left:50%;transform:translateX(-50%);background:rgba(100,0,200,0.92);color:#fff;padding:16px 32px;border-radius:12px;font-size:1.2rem;font-weight:900;letter-spacing:3px;z-index:9999;pointer-events:none;text-align:center;box-shadow:0 0 40px #8800ff;';
        document.body.appendChild(notif);
        setTimeout(() => notif.remove(), 3000);
      }
    }
    // MEGAKNIGHT cheat: type CLASSMEGAKNIGHT in menu
    if (_cheatBuffer.endsWith('CLASSMEGAKNIGHT')) {
      _cheatBuffer = '';
      if (typeof setAccountFlagWithRuntime === 'function') {
        setAccountFlagWithRuntime(['unlocks', 'megaknight'], true, function(v) { unlockedMegaknight = v; });
      } else {
        unlockedMegaknight = true;
      }
      ['p1Class','p2Class'].forEach(id => {
        const sel = document.getElementById(id);
        if (sel && !sel.querySelector('option[value="megaknight"]')) {
          const opt = document.createElement('option'); opt.value = 'megaknight'; opt.textContent = 'Class: Megaknight ★'; sel.appendChild(opt);
        }
      });
      const notif2 = document.createElement('div');
      notif2.textContent = '★ Class: MEGAKNIGHT UNLOCKED ★';
      notif2.style.cssText = 'position:fixed;top:20%;left:50%;transform:translateX(-50%);background:rgba(80,0,160,0.95);color:#fff;padding:14px 32px;border-radius:12px;font-size:1.2rem;font-weight:900;letter-spacing:2px;z-index:9999;pointer-events:none;text-align:center;box-shadow:0 0 40px #8844ff;';
      document.body.appendChild(notif2);
      setTimeout(() => notif2.remove(), 3000);
    }
  }
  const _nk = _normKey(e.key);
  if (SCROLL_BLOCK.has(_nk)) e.preventDefault();
  if (keysDown.has(_nk)) return; // already tracked — let held-frame counter run
  keysDown.add(_nk);

  if (!gameRunning || paused) return;
  // Block attack/ability/super keydown events during the TF opening cinematic (after free period)
  if (typeof tfOpeningFightActive !== 'undefined' && tfOpeningFightActive
      && (typeof _tfOpeningFreeFrames === 'undefined' || _tfOpeningFreeFrames <= 0)) return;

  players.forEach((p, i) => {
    if (p.isAI || p.health <= 0) return;
    const other         = players[i === 0 ? 1 : 0];
    const incapacitated = p.ragdollTimer > 0 || p.stunTimer > 0;
    // Paradox Fusion: block all direct player actions while Paradox owns controls
    if (p._fusionAIOverride) return;
    if (_nk === p.controls.attack) {
      e.preventDefault();
      if (!incapacitated) { p.attack(other); }
      else { p._inputBuffer = { action: 'attack', frame: frameCount }; }
    }
    if (_nk === p.controls.ability) {
      e.preventDefault();
      // Depth phase: Q = move toward background layer (-Z) — not bufferable
      if (typeof tfDepthPhaseActive !== 'undefined' && tfDepthPhaseActive &&
          typeof tfDepthEnabled !== 'undefined' && tfDepthEnabled && !p.isAI) {
        p.z = Math.max(-1, (p.z || 0) - 0.3);
        spawnParticles(p.cx(), p.cy(), '#8844ff', 4);
      } else if (!incapacitated) {
        p.ability(other);
      } else {
        p._inputBuffer = { action: 'ability', frame: frameCount };
      }
    }
    if (p.controls.super && _nk === p.controls.super) {
      e.preventDefault();
      // Depth phase: E = move toward foreground layer (+Z) — not bufferable
      if (typeof tfDepthPhaseActive !== 'undefined' && tfDepthPhaseActive &&
          typeof tfDepthEnabled !== 'undefined' && tfDepthEnabled && !p.isAI) {
        p.z = Math.min(1, (p.z || 0) + 0.3);
        spawnParticles(p.cx(), p.cy(), '#00aaff', 4);
      } else if (!incapacitated) {
        checkSecretLetterCollect(p);
        p.useSuper(other);
      } else {
        p._inputBuffer = { action: 'super', frame: frameCount };
      }
    }
  });
});

document.addEventListener('keyup', e => {
  const _nk = _normKey(e.key);
  keysDown.delete(_nk);
  delete keyHeldFrames[_nk];
});

// When the tab loses focus, clear all held keys so players can't exploit
// held-key persistence (floating, invincibility timer freeze, etc.)
function _clearAllKeys() {
  keysDown.clear();
  for (const k in keyHeldFrames) delete keyHeldFrames[k];
}
window.addEventListener('blur', _clearAllKeys);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) _clearAllKeys();
});

const SHIELD_MAX    = 140;  // max frames shield stays up (~2.3 s)
const SHIELD_CD     = 180; // 3-second cooldown at 60 fps

function processInput() {
  if (!gameRunning || paused) return;
  if (gameLoading) return; // freeze input while loading screen is visible
  if (activeCinematic) return; // freeze player controls during boss cinematics
  if (gameFrozen) return;      // hard freeze during cinematics — halts all input
  if (tfAbsorptionScene) return; // freeze all input during absorption cinematic
  if (typeof isCutsceneActive === 'function' && isCutsceneActive()) return; // freeze during cutscenes
  // Combat lock: highest-priority phase (cinematic/finisher) blocks all player input
  if (typeof isCombatLocked === 'function' && isCombatLocked('input')) return;
  // Lock player input only after the 5-second free period has elapsed
  if (typeof tfOpeningFightActive !== 'undefined' && tfOpeningFightActive
      && (typeof _tfOpeningFreeFrames === 'undefined' || _tfOpeningFreeFrames <= 0)) return;

  // Paradox Control Override — tick the canonical controlState/controlTimer
  // Hard rule: only ONE controller is active at a time; no overlap.
  if (typeof tfParadoxFused !== 'undefined' && tfParadoxFused) {
    // --- Safeguard 1: controlState must always be a known value ---
    if (controlState !== 'player' && controlState !== 'paradox') {
      controlState = 'player';
      controlTimer = 0;
    }

    // --- Safeguard 2: controlTimer must never go negative ---
    if (typeof controlTimer !== 'undefined' && controlTimer < 0) {
      controlTimer = 0;
    }

    // --- Safeguard 3: boss death → immediately return control to player ---
    const _paradoxBoss = players.find(p => p.isBoss);
    if (_paradoxBoss && _paradoxBoss.health <= 0 && controlState !== 'player') {
      controlState = 'player';
      controlTimer = 0;
      tfFusionControlMode = 'player';
      const _fp1Early = players[0];
      if (_fp1Early) { _fp1Early._fusionAIOverride = false; }
    }

    // --- Safeguard 4: player (P1) death → disable Paradox control loop ---
    const _paradoxP1 = players[0];
    if (_paradoxP1 && _paradoxP1.health <= 0) {
      if (_paradoxP1._fusionAIOverride) { _paradoxP1._fusionAIOverride = false; }
      // Skip the rest of the Paradox control tick this frame
    } else {

    // Initialise on first entry (timer will be 0 when fusion first activates)
    if (typeof controlTimer !== 'undefined' && controlTimer <= 0) {
      // Assign a fresh random duration based on who currently owns controls
      if (controlState === 'player') {
        controlTimer = 180 + Math.floor(Math.random() * 121); // 180–300 frames
      } else {
        controlTimer = 120 + Math.floor(Math.random() * 121); // 120–240 frames
      }
    }

    // Count down; switch ownership the moment the timer expires
    if (typeof controlTimer !== 'undefined') {
      controlTimer--;
      if (controlTimer <= 0) {
        // Flip ownership — exactly one switch, no overlap
        controlState = (controlState === 'player') ? 'paradox' : 'player';
        // Assign duration for the NEW owner
        if (controlState === 'player') {
          controlTimer = 180 + Math.floor(Math.random() * 121); // 180–300
        } else {
          controlTimer = 120 + Math.floor(Math.random() * 121); // 120–240
        }
        // Keep legacy variable in sync for rendering/other systems
        tfFusionControlMode = controlState;
        tfFusionGlitchTimer = 20;
        // Clear any buffered key state for P1 so no inputs bleed across the boundary
        const _fp1 = players[0];
        if (_fp1 && _fp1.controls) {
          for (const k of Object.values(_fp1.controls)) { delete keyHeldFrames[k]; }
        }
        // When paradox takes over: abort any in-progress attack swing immediately
        if (controlState === 'paradox' && _fp1) {
          _fp1.attackTimer  = 0;
          _fp1.attackEndlag = 0;
          _fp1.shielding    = false;
          // Short freeze + visual burst
          hitStopFrames = Math.max(hitStopFrames, 5);
          if (typeof tfSwitchToParadoxFlash !== 'undefined') tfSwitchToParadoxFlash = 18;
        }
        // When player regains control: quick fade-out effect
        if (controlState === 'player' && typeof tfSwitchToPlayerFade !== 'undefined') {
          tfSwitchToPlayerFade = 12;
        }
      }
    }

    // When Paradox owns controls: force AI behaviour on P1
    const _fusionP1 = players[0];
    if (_fusionP1 && !_fusionP1.isBoss) {
      _fusionP1._fusionAIOverride = (controlState === 'paradox');
    }
    if (controlState === 'paradox' && _fusionP1 && typeof paradoxFusionUpdateAI === 'function') {
      if (aiTick % AI_TICK_INTERVAL === 0) paradoxFusionUpdateAI(_fusionP1);
    }
    } // end safeguard-4 else (player alive)
  }

  // Update key-held counters
  for (const k of keysDown) keyHeldFrames[k] = (keyHeldFrames[k] || 0) + 1;

  players.forEach(p => {
    if (p.isAI || p.health <= 0) return;
    if (p._fusionAIOverride) return; // Paradox Fusion: AI handles movement, skip keyboard input
    if (p.ragdollTimer > 0 || p.stunTimer > 0) {
      // Expire stale buffer so it can't fire far outside the intended window
      if (p._inputBuffer && (frameCount - p._inputBuffer.frame) > 8) p._inputBuffer = null;
      p.shielding = false;
      return;
    }
    // Input buffer: if a buffered action was queued while incapacitated and the
    // window (~133ms / 8 frames) hasn't expired, execute it now and clear.
    if (p._inputBuffer) {
      if ((frameCount - p._inputBuffer.frame) <= 8) {
        const _buf      = p._inputBuffer;
        const _pi       = players.indexOf(p);
        const _bufOther = players[_pi === 0 ? 1 : 0];
        p._inputBuffer  = null;
        if      (_buf.action === 'attack')  p.attack(_bufOther);
        else if (_buf.action === 'ability') p.ability(_bufOther);
        else if (_buf.action === 'super')   { checkSecretLetterCollect(p); p.useSuper(_bufOther); }
      } else {
        p._inputBuffer = null; // window expired
      }
    }

    const hasCurseSlow = p.curses && p.curses.some(c => c.type === 'curse_slow');
    const _chaosSpeed = gameMode === 'minigames' && currentChaosModifiers.has('speedy') ? 1.4 : 1.0;
    const _underwaterSlow = currentArena && currentArena.isSlowMovement ? 0.72 : 1.0;
    const _earthSlow      = currentArena && currentArena.earthPhysics   ? 0.70 : 1.0;
    // Anti-kite decay (0.70-1.0), shooting penalty (0.85 while firing ranged / 0.78 post-burst)
    const _kiteMult    = (p._kiteSpeedMult != null) ? p._kiteSpeedMult : 1.0;
    const _isRanged    = p.weapon && p.weapon.type === 'ranged';
    const _tfAntiBoss  = typeof getTrueFormAntiRangedBoss === 'function' ? getTrueFormAntiRangedBoss() : null;
    const _rangeLockMult = _tfAntiBoss && !p.isBoss
      ? (Math.abs(p.cx() - _tfAntiBoss.cx()) > (_tfAntiBoss._antiRangedFieldR || 220)
          ? (_isRanged ? 0.58 : 0.72)
          : 1.0)
      : 1.0;
    const _shootingMult = _isRanged && p.attackTimer > 0   ? 0.78
                        : _isRanged && p._rangedMovePenalty > 0 ? 0.70 : 1.0;
    const _commitMult  = _isRanged && p._rangedCommitTimer > 0 ? 0.64 : 1.0;
    const spd  = 5.2 * (p.classSpeedMult || 1.0) * (p._speedBuff > 0 ? 1.35 : 1.0) * (hasCurseSlow ? 0.6 : 1.0) * _chaosSpeed * _underwaterSlow * _earthSlow * _kiteMult * _shootingMult * _commitMult * _rangeLockMult;
    const wHeld = keyHeldFrames[p.controls.jump]  || 0;


    // --- Regular movement ---
    // True Form: inverted controls for human players only
    const _ctrlInv  = (!p.isAI) && ((gameMode === 'trueform' && tfControlsInverted) || (currentArenaKey === 'mirror' && mirrorFlipped));
    const _leftKey  = _ctrlInv ? p.controls.right : p.controls.left;
    const _rightKey = _ctrlInv ? p.controls.left  : p.controls.right;
    const movingLeft  = keysDown.has(_leftKey);
    const movingRight = keysDown.has(_rightKey);
    if (movingLeft) {
      p.vx = -spd;
      p.facing = -1; // face direction of last key pressed
    }
    if (movingRight) {
      p.vx =  spd;
      p.facing = 1;  // face direction of last key pressed
    }
    // Decay acceleration ramp when no direction key held

    // --- Jump (ground jump + double jump) ---
    if (wHeld === 1) {
      // Megaknight gets higher jump power
      const jumpPower = p.charClass === 'megaknight' ? -22 : -17;
      const dblPower  = p.charClass === 'megaknight' ? -16 : -13;
      if (p.onGround || (p.coyoteFrames > 0 && !p.canDoubleJump)) {
        // Ground jump (or coyote jump — briefly after walking off a platform)
        p.vy = jumpPower;
        p.canDoubleJump = true; // enable one double-jump after leaving ground
        p.coyoteFrames  = 0;   // consume coyote window
        if (p._rd) PlayerRagdoll.applyJump(p);
        spawnParticles(p.cx(), p.y + p.h, '#ffffff', 5);
        if (p.charClass === 'megaknight') spawnParticles(p.cx(), p.y + p.h, '#8844ff', 5);
        SoundManager.jump();
      } else if (p.canDoubleJump && !p._noDoubleJump) {
        // Double jump in air — gated by skill flag in story mode
        p.vy = dblPower;
        p.canDoubleJump = false;
        spawnParticles(p.cx(), p.cy(), p.color,  8);
        spawnParticles(p.cx(), p.cy(), '#ffffff', 5);
        SoundManager.jump();
      }
    }
    // --- S / ArrowDown = boost shield (30-second cooldown) ---
    const sHeld = keysDown.has(p.controls.shield);
    if (sHeld && p.shieldCooldown === 0 && !(p.weapon && p.weapon.type === 'ranged' && p._rangedCommitTimer > 0)) {
      p.shielding       = true;
      p.shieldHoldTimer = (p.shieldHoldTimer || 0) + 1;
      if (p.shieldHoldTimer >= SHIELD_MAX) {
        // Max duration exhausted → forced break and start cooldown
        p.shielding       = false;
        p.shieldCooldown  = SHIELD_CD;
        p.shieldHoldTimer = 0;
      }
    } else {
      if (p.shielding && !sHeld) {
        // Player released S — start cooldown if they used it for more than 3 frames
        if ((p.shieldHoldTimer || 0) > 3) p.shieldCooldown = SHIELD_CD;
        p.shielding       = false;
        p.shieldHoldTimer = 0;
      }
      if (!sHeld) p.shielding = false;
    }
    // Paradox Fusion: ability key triggers paradox abilities during player control phase
    if (typeof tfParadoxFused !== 'undefined' && tfParadoxFused &&
        typeof tfFusionControlMode !== 'undefined' && tfFusionControlMode === 'player' &&
        !p._fusionAIOverride) {
      const _abilityHeldFrames = keyHeldFrames[p.controls.ability] || 0;
      if (_abilityHeldFrames === 1 && typeof paradoxPlayerUseAbility === 'function') {
        paradoxPlayerUseAbility(p);
      }
    }
    // Fracture interaction — E key (super) or ability key on P1 near an unlocked fracture
    if (!p.isAI && p === players[0] && typeof checkFractureInteraction === 'function') {
      const _ePressed = (keyHeldFrames[p.controls.super] || 0) === 1;
      checkFractureInteraction(p, _ePressed);
    }
  });
}
