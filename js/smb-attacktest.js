'use strict';

// ============================================================
// ATTACK TEST SANDBOX  (smb-attacktest.js)
// ============================================================
// Two complementary systems:
//
// ── SYSTEM 1: ATTACK VIEWER GUI / CONSOLE ────────────────────
// Preview every attack as a pure visual effect without spawning
// boss characters.  Works in any running game mode.
//
//   Open the in-game console (type GAMECONSOLE), then:
//   atk help
//
// ── SYSTEM 2: ADMIN CLASSES ──────────────────────────────────
// Equip a player with a "kit" class that lets them personally
// use boss/NPC attacks mapped to Q (ability) and E (super).
//
//   atk class creator  [p1|p2]   — equip Creator kit on a player
//   atk class trueform [p1|p2]   — equip True Form kit
//   atk class yeti     [p1|p2]   — equip Yeti kit
//   atk class beast    [p1|p2]   — equip Forest Beast kit
//   atk class off      [p1|p2]   — remove admin kit
//
// HOW TO ADD A NEW ATTACK:
//   Add an entry to ATK_REGISTRY under the right class key:
//   { label, desc, fn(ctx, target, opts) }
//   ctx is a lightweight proxy object positioned at the firing
//   player's location — NOT a real game entity, never rendered.
// ============================================================

// ─── Global sandbox state ─────────────────────────────────────
let _atkSafeMode     = false;
let _atkPauseBetween = true;
let _atkSpeed        = 1.0;
let _atkDamageScale  = 1.0;
let _atkDemoRunning  = false;

// ─── Proxy factory ────────────────────────────────────────────
/**
 * Creates a lightweight context object that mimics just enough of Boss/TrueForm
 * for attack logic to run.  It is NEVER pushed into players[] so it is never
 * drawn, updated, or treated as a real entity.
 *
 * @param {boolean} isTF  – true → TrueForm-spec proxy, false → Creator Boss spec
 * @param {number}  [x]   – world-space x (defaults to arena centre)
 * @param {number}  [y]   – world-space y
 */
function _atkMakeProxy(isTF, x, y) {
  const px = x !== undefined ? x : GAME_W / 2;
  const py = y !== undefined ? y : 300;
  const proxy = {
    // Position / size
    x: px - (isTF ? 9 : 16),
    y: py,
    w: isTF ? 18 : 33,
    h: isTF ? 50 : 90,
    vx: 0, vy: 0,
    facing: 1,
    onGround: true,
    // Identity flags
    isBoss: true,
    isTrueForm: !!isTF,
    isProxy: true,       // used by cleanup logic
    health: 9999,
    maxHealth: isTF ? 5000 : 3000,
    invincible: 99999,
    // Cooldown buckets — all zeroed so _doSpecial can fire immediately
    _gravityCd:0,_warpCd:0,_holeCd:0,_floorCd:0,_invertCd:0,_sizeCd:0,_portalCd:0,
    _graspCd:0,_slashCd:0,_wellCd:0,_meteorCd:0,_cloneCd:0,_chainCd:0,
    _shockwaveCd:0,_teleportComboCd:0,_gravityCrushCd:0,
    _phaseShiftCd:0,_realityTearCd:0,_calcStrikeCd:0,
    _realityOverrideCd:0,_collapseStrikeCd:0,_grabCinCd:0,_dimensionCd:0,
    _gammaBeamCd:0,_neutronStarCd:0,_galaxySweepCd:0,_multiverseCd:0,_supernovaCd:0,
    _groundSlamCd:0,_gravPulseCd:0,_stormCd:0,
    // State needed by some attack helpers
    postSpecialPause:0, _pendingGroundSlam:null, _pendingGravPulse:null,
    _pendingSlash:null, _pendingShockwave:null, _pendingTeleportCombo:null,
    _pendingGravityCrush:null, _pendingCollapseStrike:null, _pendingChainMove:null,
    _desperationMode:false, _stillTimer:0, _runAwayTicks:0, _idleTicks:0,
    _lastSpecial:null, _lastLastSpecial:null, _aggressionBurstTimer:0,
    _cinematicFired: new Set(),
    _lastPhase:1,
    backstageHiding: false,
    // Attack state — required by TrueForm._doSpecial
    _tfAttackState: { name: null, phase: 'idle', timer: 0, locked: false },
    // Methods
    cx()  { return this.x + this.w / 2; },
    cy()  { return this.y + this.h / 2; },
    getPhase() { return 3; },  // always phase-3 so all attacks are available
    platformAbove() { return null; },
    isEdgeDanger()  { return false; },
    _startAttackState(name, startFrames = 0, locked = false) {
      this._tfAttackState = { name, phase: 'start', timer: startFrames, locked };
    },
    _setAttackPhase(phase, frames = 0, locked = false) {
      if (!this._tfAttackState.name) return;
      this._tfAttackState.phase  = phase;
      this._tfAttackState.timer  = frames;
      this._tfAttackState.locked = locked;
    },
    _finishAttackState(name = null) {
      if (name && this._tfAttackState.name && this._tfAttackState.name !== name) return;
      this._tfAttackState = { name: null, phase: 'idle', timer: 0, locked: false };
    },
  };

  // Attach TrueForm._doSpecial if available, binding to proxy
  if (isTF && typeof TrueForm !== 'undefined') {
    try {
      // Borrow methods from TrueForm prototype
      const tfProto = TrueForm.prototype;
      if (tfProto._doSpecial)  proxy._doSpecial  = tfProto._doSpecial.bind(proxy);
      if (tfProto._pickSpecial) proxy._pickSpecial = tfProto._pickSpecial.bind(proxy);
    } catch(_e) { /* graceful degradation */ }
  }
  // Attach Boss._bossFireSpecial if available
  if (!isTF && typeof Boss !== 'undefined') {
    try {
      const bProto = Boss.prototype;
      if (bProto._bossFireSpecial) proxy._bossFireSpecial = bProto._bossFireSpecial.bind(proxy);
    } catch(_e) {}
  }

  return proxy;
}

// ─── Live-player context (for admin kit) ──────────────────────
/**
 * Like _atkMakeProxy but position reads/writes delegate LIVE to `player`.
 * This means:
 *  - AOE effects always originate from the player's current location.
 *  - Teleport attacks (reality slash, portal teleport, etc.) actually move
 *    the real player since setting ctx.x writes to player.x.
 *  - Physics attacks (meteor leap, neutron slam) modify player.vy/vx so
 *    the player's body executes the move for real.
 *  - bossRef stored in global attack state objects (tfGammaBeam, etc.)
 *    reads live position, so beam/sweep visuals track the player.
 */
function _atkMakePlayerCtx(player, isTF) {
  const ctx = {
    // Live getters/setters — reads and writes go to the real player
    get x()       { return player.x; },
    set x(v)      { player.x = v; },
    get y()       { return player.y; },
    set y(v)      { player.y = v; },
    get vx()      { return player.vx; },
    set vx(v)     { player.vx = v; },
    get vy()      { return player.vy; },
    set vy(v)     { player.vy = v; },
    get facing()  { return player.facing; },
    get onGround(){ return player.onGround; },
    get w()       { return player.w; },
    get h()       { return player.h; },
    cx()  { return player.cx(); },
    cy()  { return player.cy(); },
    // Identity — override so boss-method dispatch works
    isBoss: true,
    isTrueForm: !!isTF,
    isProxy: true,
    health: 9999, maxHealth: isTF ? 5000 : 3000,
    invincible: 99999,
    // All cooldowns zeroed so _doSpecial fires immediately
    _gravityCd:0,_warpCd:0,_holeCd:0,_floorCd:0,_invertCd:0,_sizeCd:0,_portalCd:0,
    _graspCd:0,_slashCd:0,_wellCd:0,_meteorCd:0,_cloneCd:0,_chainCd:0,
    _shockwaveCd:0,_teleportComboCd:0,_gravityCrushCd:0,
    _phaseShiftCd:0,_realityTearCd:0,_calcStrikeCd:0,
    _realityOverrideCd:0,_collapseStrikeCd:0,_grabCinCd:0,_dimensionCd:0,
    _gammaBeamCd:0,_neutronStarCd:0,_galaxySweepCd:0,_multiverseCd:0,_supernovaCd:0,
    _groundSlamCd:0,_gravPulseCd:0,_stormCd:0,
    postSpecialPause:0, _pendingGroundSlam:null, _pendingGravPulse:null,
    _pendingSlash:null, _pendingShockwave:null, _pendingTeleportCombo:null,
    _pendingGravityCrush:null, _pendingCollapseStrike:null, _pendingChainMove:null,
    _desperationMode:false, _stillTimer:0, _runAwayTicks:0, _idleTicks:0,
    _lastSpecial:null, _lastLastSpecial:null, _aggressionBurstTimer:0,
    _cinematicFired: new Set(),
    _lastPhase: 1,
    backstageHiding: false,
    // Attack state — required by TrueForm._doSpecial
    _tfAttackState: { name: null, phase: 'idle', timer: 0, locked: false },
    getPhase()      { return 3; },
    platformAbove() { return null; },
    isEdgeDanger()  { return false; },
    _startAttackState(name, startFrames = 0, locked = false) {
      this._tfAttackState = { name, phase: 'start', timer: startFrames, locked };
    },
    _setAttackPhase(phase, frames = 0, locked = false) {
      if (!this._tfAttackState.name) return;
      this._tfAttackState.phase  = phase;
      this._tfAttackState.timer  = frames;
      this._tfAttackState.locked = locked;
    },
    _finishAttackState(name = null) {
      if (name && this._tfAttackState.name && this._tfAttackState.name !== name) return;
      this._tfAttackState = { name: null, phase: 'idle', timer: 0, locked: false };
    },
  };
  // Attach boss methods
  if (isTF && typeof TrueForm !== 'undefined') {
    try {
      const tp = TrueForm.prototype;
      if (tp._doSpecial)   ctx._doSpecial   = tp._doSpecial.bind(ctx);
      if (tp._pickSpecial) ctx._pickSpecial  = tp._pickSpecial.bind(ctx);
    } catch(_e) {}
  }
  if (!isTF && typeof Boss !== 'undefined') {
    try {
      const bp = Boss.prototype;
      if (bp._bossFireSpecial) ctx._bossFireSpecial = bp._bossFireSpecial.bind(ctx);
    } catch(_e) {}
  }
  return ctx;
}

// ─── Helpers ──────────────────────────────────────────────────
function _atkGetTarget() {
  if (typeof players === 'undefined') return null;
  return players.find(p => !p.isBoss && p.health > 0) || null;
}

// Get best target for a kit-equipped player: any live entity that isn't them
function _atkGetKitTarget(firingPlayer) {
  if (typeof players === 'undefined') return null;
  return players.find(p => p !== firingPlayer && p.health > 0) || null;
}

// Check if target is a teammate (should not be hit) for the current firer
function _atkIsTeammate(firingPlayer, target) {
  if (!firingPlayer || !target) return false;
  if (typeof survivalTeamMode === 'undefined' || !survivalTeamMode) return false;
  if (typeof survivalFriendlyFire !== 'undefined' && survivalFriendlyFire) return false;
  // In survival team mode with friendly fire off, players on same team don't hit each other
  // Players in players[] at same team index — P1+minions vs P2+minions
  // Simple heuristic: same color/team as firingPlayer
  if (firingPlayer._teamId !== undefined && target._teamId !== undefined)
    return firingPlayer._teamId === target._teamId;
  // Fallback: minions spawned by the same player share aggro target
  return false;
}

// Get all valid AOE targets for a kit-equipped player (excludes firer, dead, teammates)
function _atkGetAOETargets(firingPlayer) {
  if (typeof players === 'undefined') return [];
  return players.filter(p => p !== firingPlayer && p.health > 0 && !_atkIsTeammate(firingPlayer, p));
}

// Current kit firer — set in _atkKitFire so _atkDeal can use it as attacker
let _atkCurrentFirer = null;

// Mark a player as immune to GUI-triggered attacks for the duration of the attack (~20s max).
// This prevents AOE attacks from damaging the player who triggered them.
function _atkSetGuiFirer(player) {
  if (!player) return;
  player._guiAttackImmune = true;
  setTimeout(() => { if (player) player._guiAttackImmune = false; }, 20000);
}

function _atkDeal(attacker, target, dmg, kb) {
  if (_atkSafeMode) return;
  if (typeof dealDamage === 'function')
    dealDamage(attacker || _atkCurrentFirer, target, Math.round(dmg * _atkDamageScale), kb);
}

function _atkResetEffects() {
  if (typeof bossBeams        !== 'undefined') bossBeams        = [];
  if (typeof bossSpikes       !== 'undefined') bossSpikes       = [];
  if (typeof bossWarnings     !== 'undefined') bossWarnings     = [];
  if (typeof bossMetSafeZones !== 'undefined') bossMetSafeZones = [];
  if (typeof tfBlackHoles     !== 'undefined') tfBlackHoles     = [];
  if (typeof tfGravityWells   !== 'undefined') tfGravityWells   = [];
  if (typeof tfClones         !== 'undefined') tfClones         = [];
  if (typeof tfShockwaves     !== 'undefined') tfShockwaves     = [];
  if (typeof tfPhaseShift     !== 'undefined') tfPhaseShift     = null;
  if (typeof tfMeteorCrash    !== 'undefined') tfMeteorCrash    = null;
  if (typeof tfChainSlam      !== 'undefined') tfChainSlam      = null;
  if (typeof tfGraspSlam      !== 'undefined') tfGraspSlam      = null;
  if (typeof tfGammaBeam      !== 'undefined') tfGammaBeam      = null;
  if (typeof tfNeutronStar    !== 'undefined') tfNeutronStar    = null;
  if (typeof tfGalaxySweep    !== 'undefined') tfGalaxySweep    = null;
  if (typeof tfMultiverse     !== 'undefined') tfMultiverse     = null;
  if (typeof tfSupernova      !== 'undefined') tfSupernova      = null;
  if (typeof tfFloorRemoved   !== 'undefined' && tfFloorRemoved) {
    tfFloorRemoved = false;
    const fl = currentArena && currentArena.platforms.find(p => p.isFloor);
    if (fl) fl.isFloorDisabled = false;
  }
  if (typeof tfGravityInverted  !== 'undefined') tfGravityInverted  = false;
  if (typeof tfControlsInverted !== 'undefined') tfControlsInverted = false;
  if (typeof tfSizeTargets      !== 'undefined') tfSizeTargets.clear();
  _consoleOk('[ATK] All active attack effects cleared.');
}

// ─── FORCE ATTACK EXECUTION SYSTEM ───────────────────────────
// Guarantees any attack fires regardless of game state, arena,
// boss presence, cooldowns, or missing targets.
// Set window.FORCE_ATTACK_MODE = false to disable.
window.FORCE_ATTACK_MODE = true;

/**
 * Returns a safe world position near the firer (or arena center as fallback).
 */
function getSafeSpawnPosition(firer) {
  if (firer && typeof firer.cx === 'function') {
    return { x: clamp(firer.cx(), 40, GAME_W - 40), y: clamp(firer.cy(), 40, GAME_H - 40) };
  }
  if (typeof currentArena !== 'undefined' && currentArena) {
    const fl = currentArena.platforms && currentArena.platforms.find(p => p.isFloor && !p.isFloorDisabled);
    if (fl) return { x: Math.round(fl.x + fl.w / 2), y: fl.y - 60 };
  }
  return { x: GAME_W / 2, y: 300 };
}

/**
 * Creates a lightweight dummy target entity.
 * Temporarily pushed into players[] so _doSpecial can find it via players.find().
 * Removed from players[] after the attack duration expires.
 */
function _atkMakeDummyTarget(x, y) {
  return {
    x: x - 9, y: y - 50, w: 18, h: 50,
    vx: 0, vy: 0, facing: -1, onGround: true,
    health: 300, maxHealth: 300, lives: 0,
    isBoss: false, isAI: false, _isDummy: true,
    invincible: 0, stunTimer: 0, color: '#ff4488',
    weapon: { key: 'sword', damage: 0 },
    controls: {}, superMeter: 0, maxSuper: 100,
    attackTimer: 0, attackCooldown: 0,
    _comboCount: 0, _comboDamage: 0,
    shieldActive: false, shieldTimer: 0,
    kbResist: 0, kbBonus: 0, dmgMult: undefined,
    cx()  { return this.x + this.w / 2; },
    cy()  { return this.y + this.h / 2; },
    draw() {},
    update() {},
    respawn() { this.health = this.maxHealth; },
    platformAbove() { return null; },
    isEdgeDanger()  { return false; },
  };
}

/**
 * Initializes any global arrays/values that attack functions depend on,
 * in case they're undefined (e.g. called before a game has started).
 */
function _atkEnsureGlobals() {
  const arrays = [
    'bossBeams','bossSpikes','bossWarnings','bossMetSafeZones',
    'tfBlackHoles','tfGravityWells','tfClones','tfShockwaves',
    'projectiles','particles','damageTexts','minions',
  ];
  for (const k of arrays) {
    if (typeof window[k] === 'undefined') window[k] = [];
  }
  const nullables = [
    'tfPhaseShift','tfMeteorCrash','tfChainSlam','tfGraspSlam',
    'tfGammaBeam','tfNeutronStar','tfGalaxySweep','tfMultiverse','tfSupernova',
  ];
  for (const k of nullables) {
    if (typeof window[k] === 'undefined') window[k] = null;
  }
  if (typeof window.tfGravityInverted   === 'undefined') window.tfGravityInverted   = false;
  if (typeof window.tfControlsInverted  === 'undefined') window.tfControlsInverted  = false;
  if (typeof window.tfFloorRemoved      === 'undefined') window.tfFloorRemoved      = false;
  if (typeof window.tfGravityTimer      === 'undefined') window.tfGravityTimer      = 0;
  if (typeof window.tfSizeTargets       === 'undefined') window.tfSizeTargets       = new Map();
  if (typeof window.screenShake         === 'undefined') window.screenShake         = 0;
  if (typeof window.bossDialogue        === 'undefined') window.bossDialogue        = null;
  // Safe stub for showBossDialogue if not yet defined
  if (typeof window.showBossDialogue !== 'function') {
    window.showBossDialogue = (text, dur) => {
      window.bossDialogue = { text: text || '', timer: dur || 180 };
    };
  }
}

/**
 * Aggressively re-attempt attaching _doSpecial / _bossFireSpecial to ctx.
 * Called right before firing so even a stale ctx gets fresh bindings.
 */
function _atkEnsureDoSpecial(ctx, isTF) {
  if (isTF) {
    if (!ctx._doSpecial && typeof TrueForm !== 'undefined') {
      try {
        const tp = TrueForm.prototype;
        if (tp._doSpecial)   ctx._doSpecial   = tp._doSpecial.bind(ctx);
        if (tp._pickSpecial) ctx._pickSpecial  = tp._pickSpecial.bind(ctx);
      } catch(_e) {}
    }
  } else {
    if (!ctx._bossFireSpecial && typeof Boss !== 'undefined') {
      try {
        const bp = Boss.prototype;
        if (bp._bossFireSpecial) ctx._bossFireSpecial = bp._bossFireSpecial.bind(ctx);
      } catch(_e) {}
    }
  }
}

/**
 * Core force-execute wrapper used by _atkSummon, _atkAll, and _atkKitFire.
 * - Injects a dummy target if the attack needs one and none exists.
 * - Ensures all globals are initialized before firing.
 * - Re-attaches _doSpecial if missing.
 * - Logs any exception and detects silent no-ops.
 */
function forceExecuteAttack(entry, classKey, ctx, tgt, opts) {
  const attackName = entry.label;
  const isTF = classKey === 'trueform';
  const missing = [];
  let fallbackUsed = null;
  let dummyCleanup = null;

  _atkEnsureGlobals();
  if (ctx) _atkEnsureDoSpecial(ctx, isTF);

  // Auto-inject dummy target when attack would otherwise silently skip
  if (!tgt && window.FORCE_ATTACK_MODE) {
    missing.push('target');
    const sp = getSafeSpawnPosition(_atkCurrentFirer);
    const offsetX = (_atkCurrentFirer && _atkCurrentFirer.facing >= 0) ? 160 : -160;
    const dummy = _atkMakeDummyTarget(
      clamp(sp.x + offsetX, 40, GAME_W - 40), sp.y
    );
    if (typeof players !== 'undefined') {
      players.push(dummy);
      // Remove after 10 s — long enough for any multi-phase attack
      const cleanup = () => { const i = players.indexOf(dummy); if (i >= 0) players.splice(i, 1); };
      setTimeout(cleanup, 10000);
      dummyCleanup = true; // marks that cleanup is scheduled
    }
    tgt = dummy;
    fallbackUsed = 'auto-created dummy target at (' + Math.round(tgt.cx()) + ',' + Math.round(tgt.cy()) + ')';
  }

  // Snapshot state to detect silent no-ops
  const snap = {
    beams:   (typeof bossBeams    !== 'undefined' ? bossBeams.length    : 0),
    spikes:  (typeof bossSpikes   !== 'undefined' ? bossSpikes.length   : 0),
    holes:   (typeof tfBlackHoles !== 'undefined' ? tfBlackHoles.length : 0),
    wells:   (typeof tfGravityWells!=='undefined' ? tfGravityWells.length:0),
    clones:  (typeof tfClones     !== 'undefined' ? tfClones.length     : 0),
    shakes:  (typeof screenShake  !== 'undefined' ? screenShake         : 0),
    gamma:   !!(typeof tfGammaBeam    !== 'undefined' && tfGammaBeam),
    neutron: !!(typeof tfNeutronStar  !== 'undefined' && tfNeutronStar),
    sweep:   !!(typeof tfGalaxySweep  !== 'undefined' && tfGalaxySweep),
    multi:   !!(typeof tfMultiverse   !== 'undefined' && tfMultiverse),
    nova:    !!(typeof tfSupernova    !== 'undefined' && tfSupernova),
  };

  let threw = false;
  try {
    entry.fn(ctx, tgt, opts || { damageScale: _atkDamageScale, safeMode: _atkSafeMode });
  } catch (err) {
    threw = true;
    console.warn('[Attack Debug]', {
      attackName, reason: err.message,
      missingDependencies: missing, fallbackUsed, stack: err.stack,
    });
    _consoleErr('[ATK FORCE] ' + attackName + ' threw: ' + err.message);
  }

  if (!threw && window.FORCE_ATTACK_MODE) {
    const changed =
      (typeof bossBeams   !== 'undefined' && bossBeams.length    !== snap.beams)  ||
      (typeof bossSpikes  !== 'undefined' && bossSpikes.length   !== snap.spikes) ||
      (typeof tfBlackHoles!=='undefined'  && tfBlackHoles.length !== snap.holes)  ||
      (typeof tfGravityWells!=='undefined'&& tfGravityWells.length!==snap.wells)  ||
      (typeof tfClones    !== 'undefined' && tfClones.length     !== snap.clones) ||
      (typeof screenShake !== 'undefined' && screenShake         > snap.shakes)   ||
      (typeof tfGammaBeam !== 'undefined' && !!tfGammaBeam       !== snap.gamma)  ||
      (typeof tfNeutronStar!=='undefined' && !!tfNeutronStar     !== snap.neutron)||
      (typeof tfGalaxySweep!=='undefined' && !!tfGalaxySweep     !== snap.sweep)  ||
      (typeof tfMultiverse !== 'undefined'&& !!tfMultiverse       !== snap.multi)  ||
      (typeof tfSupernova !== 'undefined' && !!tfSupernova        !== snap.nova);

    // Singleton-state attacks are hard to snapshot — trust they ran if no error
    const usesSingleton = [
      'void_grasp','reality_slash','gravity_well','meteor_crash','shadow_clones',
      'chain_slam','shockwave','phase_shift','teleport_combo','gravity_crush',
      'gamma_beam','neutron_star','galaxy_sweep','multiverse_fracture','supernova',
      'collapse_strike','reality_override','gravity_invert','controls_invert',
      'floor_remove','size_shift','arena_warp','portal_teleport',
    ].includes(attackName);

    if (!changed && !usesSingleton) {
      const reasons = [];
      if (missing.includes('target') && !fallbackUsed) reasons.push('no target, dummy inject failed');
      if (ctx && !ctx._doSpecial && isTF) reasons.push('_doSpecial still not attached');
      console.warn('[Attack Debug]', {
        attackName,
        reason: 'silent no-op — no measurable state change',
        missingDependencies: missing,
        fallbackUsed,
        suggestions: reasons.length ? reasons : ['check inner _doSpecial guard conditions'],
      });
      _consoleErr('[ATK FORCE] ' + attackName + ': no-op (check DevTools console for details)');
    }
  }
}

// ─── Optional debug tools (set via DevTools console) ──────────
// window.SMB_SHOW_HITBOXES   = true   → overlay entity bounding boxes
// window.SMB_SLOW_MOTION     = 0.2    → set game slowMotion factor (0.2–1.0)
// window.SMB_FREEZE_ON_IMPACT = true  → long hitStop on every hit
//
// Apply SMB_SLOW_MOTION each frame (checked in the force RAF below)
(function _installForceDebugRAF() {
  let _prevHitboxState = false;
  function _forceDebugTick() {
    requestAnimationFrame(_forceDebugTick);
    if (!window.FORCE_ATTACK_MODE || !gameRunning) return;
    // Slow motion control
    if (typeof window.SMB_SLOW_MOTION === 'number' && window.SMB_SLOW_MOTION !== 1.0) {
      if (typeof slowMotion !== 'undefined') slowMotion = Math.max(0.05, Math.min(1.0, window.SMB_SLOW_MOTION));
    }
    // Freeze on impact — extend any active hitStop
    if (window.SMB_FREEZE_ON_IMPACT && typeof hitStopFrames !== 'undefined' && hitStopFrames > 0) {
      hitStopFrames = Math.max(hitStopFrames, 30);
    }
    // Hitbox overlay drawn on top of canvas (screen-space)
    if (window.SMB_SHOW_HITBOXES) {
      if (!_prevHitboxState && typeof canvas !== 'undefined' && typeof ctx !== 'undefined') {
        _prevHitboxState = true;
      }
      if (typeof players !== 'undefined' && typeof ctx !== 'undefined' && typeof canvas !== 'undefined') {
        const m = ctx.getTransform();
        ctx.save();
        for (const p of players) {
          if (!p || p._isProxy) continue;
          const sx = p.x * m.a + m.e;
          const sy = p.y * m.d + m.f;
          const sw = p.w * m.a;
          const sh = p.h * m.d;
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.strokeStyle = p._isDummy ? '#ff4488' : (p.isBoss ? '#ff0000' : '#00ffcc');
          ctx.lineWidth = 1.5;
          ctx.strokeRect(sx, sy, sw, sh);
          ctx.fillStyle = ctx.strokeStyle;
          ctx.font = '10px monospace';
          ctx.fillText((p._isDummy ? 'DUMMY' : (p.isBoss ? 'BOSS' : 'P')) + ' hp:' + Math.round(p.health), sx, sy - 3);
        }
        ctx.restore();
      }
    } else {
      _prevHitboxState = false;
    }
    // Show spawn point indicator for dummy targets
    if (window.SMB_SHOW_HITBOXES && typeof players !== 'undefined' && typeof ctx !== 'undefined') {
      for (const p of players) {
        if (!p._isDummy) continue;
        const m = ctx.getTransform();
        const sx = p.cx() * m.a + m.e;
        const sy = p.cy() * m.d + m.f;
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.strokeStyle = '#ff4488';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(sx - 8, sy - 8); ctx.lineTo(sx + 8, sy + 8);
        ctx.moveTo(sx + 8, sy - 8); ctx.lineTo(sx - 8, sy + 8); ctx.stroke();
        ctx.restore();
      }
    }
  }
  requestAnimationFrame(_forceDebugTick);
})();

// ─── ATTACK REGISTRY ──────────────────────────────────────────
// fn(ctx, target, opts)
//   ctx    — proxy object (position + methods, never rendered)
//   target — first live human player, may be null
//   opts   — { damageScale, safeMode }
//
// HOW TO ADD:  push a new { label, desc, fn } into the right bucket.
// ──────────────────────────────────────────────────────────────
const ATK_REGISTRY = {

  // ═══════════════════════════════════════════════════════════
  // CREATOR BOSS
  // ═══════════════════════════════════════════════════════════
  creator: [
    {
      label: 'beam_single',
      desc:  'Void beam — warning then active strike',
      fn(ctx, target) {
        const bx = target ? clamp(target.cx() + (Math.random()-0.5)*60, 40, 860) : GAME_W/2;
        bossBeams.push({ x:bx, warningTimer:300, activeTimer:0, phase:'warning', done:false });
        showBossDialogue('Feel the void!', 200);
      }
    },
    {
      label: 'beam_storm',
      desc:  'Meteor Storm — 5 beams with marked safe zone',
      fn(ctx) {
        const safeX = 150 + Math.random() * 600;
        bossMetSafeZones.push({ x:safeX, y:380, r:70, timer:350, maxTimer:350 });
        for (let i = 0; i < 5; i++) {
          let bx;
          do { bx = 60 + Math.random()*(GAME_W-120); } while (Math.abs(bx-safeX) < 80);
          bossBeams.push({ x:bx, warningTimer:240, activeTimer:0, phase:'warning', done:false });
        }
        screenShake = Math.max(screenShake, 14);
        showBossDialogue('METEOR STORM!', 220);
      }
    },
    {
      label: 'ground_slam',
      desc:  'Ground Slam — telegraph AOE then spike burst',
      fn(ctx, target) {
        const slamX = ctx.cx();
        const slamY = ctx.y + ctx.h;
        bossWarnings.push({ type:'circle', x:slamX, y:slamY, r:160, color:'#ff2200', timer:45, maxTimer:45, label:'SLAM!' });
        for (let i=0;i<6;i++) {
          const sx = clamp(slamX+(i-2.5)*55, 20, 880);
          bossWarnings.push({ type:'spike_warn', x:sx, y:460, r:12, color:'#ff6600', timer:45, maxTimer:45 });
        }
        setTimeout(() => {
          if (!gameRunning) return;
          for (let i=0;i<6;i++) {
            const sx = clamp(slamX+(i-2.5)*55, 20, 880);
            bossSpikes.push({ x:sx, maxH:90+Math.random()*50, h:0, phase:'rising', stayTimer:0, done:false });
          }
          screenShake = Math.max(screenShake, 20);
          spawnParticles(slamX, slamY, '#ff4400', 28);
        }, 750);
        showBossDialogue('SHATTER!', 160);
      }
    },
    {
      label: 'gravity_pulse',
      desc:  'Gravity Pulse — pulls player toward ctx position',
      fn(ctx) {
        bossWarnings.push({ type:'circle', x:ctx.cx(), y:ctx.cy(), r:350, color:'#9900cc', timer:40, maxTimer:40, label:'GRAVITY PULL!' });
        bossWarnings.push({ type:'circle', x:ctx.cx(), y:ctx.cy(), r:60,  color:'#cc66ff', timer:40, maxTimer:40 });
        setTimeout(() => {
          if (!gameRunning) return;
          const aoeTargets = _atkGetAOETargets(_atkCurrentFirer);
          for (const p of aoeTargets) {
            if (p.health <= 0) continue;
            const ddx = ctx.cx()-p.cx(), ddy = ctx.cy()-(p.y+p.h*0.5);
            const dd  = Math.hypot(ddx,ddy)||1;
            p.vx = (ddx/dd)*18; p.vy = (ddy/dd)*12-4;
            _atkDeal(null, p, 12, 6);
          }
          screenShake = Math.max(screenShake, 18);
          spawnParticles(ctx.cx(), ctx.cy(), '#9900cc', 24);
        }, 670);
        showBossDialogue('You cannot run.', 180);
      }
    },
    {
      label: 'minion_spawn',
      desc:  'Spawn 2 boss minions from arena edges',
      fn() {
        if (typeof Minion === 'undefined') { _consoleErr('Minion class unavailable.'); return; }
        const t = _atkGetTarget();
        for (let i=0;i<2;i++) {
          const spawnX = i===0 ? 80 : 820;
          const mn = new Minion(spawnX, 200);
          mn.target = t;
          minions.push(mn);
          spawnParticles(spawnX, 200, '#bb00ee', 24);
        }
        screenShake = Math.max(screenShake, 12);
        showBossDialogue('MINIONS, arise!', 220);
      }
    },
    {
      label: 'teleport',
      desc:  'Backstage portal teleport animation',
      fn(ctx) {
        // Open entry portal at ctx position then exit portal at a new position
        if (typeof openBackstagePortal === 'function') {
          openBackstagePortal(ctx.cx(), ctx.cy(), 'entry');
          const destX = ctx.cx() > GAME_W/2 ? 150 : GAME_W-150;
          setTimeout(() => {
            if (!gameRunning) return;
            openBackstagePortal(destX, ctx.cy(), 'exit');
          }, 500);
        }
        spawnParticles(ctx.cx(), ctx.cy(), '#9900ee', 18);
      }
    },
    {
      label: 'phase_flash',
      desc:  'Phase transition flash + screen shake',
      fn() {
        if (typeof bossPhaseFlash !== 'undefined') bossPhaseFlash = 50;
        screenShake = Math.max(screenShake, 24);
        showBossDialogue('PHASE THREE. Feel my full power!', 300);
        SoundManager.phaseUp && SoundManager.phaseUp();
      }
    },
    {
      label: 'beam_wave',
      desc:  'Wave of 8 beams covering the whole arena',
      fn() {
        for (let i=0;i<8;i++) {
          const bx = 60 + i*(GAME_W-120)/7;
          setTimeout(() => {
            if (!gameRunning) return;
            bossBeams.push({ x:bx, warningTimer:200, activeTimer:0, phase:'warning', done:false });
          }, i*120);
        }
        screenShake = Math.max(screenShake, 12);
        showBossDialogue('Nowhere to hide!', 200);
      }
    },
    {
      label: 'spike_carpet',
      desc:  'Dense carpet of floor spikes across the arena',
      fn() {
        for (let i=0;i<10;i++) {
          const sx = 50 + i*(GAME_W-100)/9;
          bossSpikes.push({ x:sx, maxH:70+Math.random()*60, h:0, phase:'rising', stayTimer:0, done:false });
        }
        screenShake = Math.max(screenShake, 18);
        showBossDialogue('The ground betrays you!', 200);
      }
    },
  ],

  // ═══════════════════════════════════════════════════════════
  // TRUE FORM
  // ═══════════════════════════════════════════════════════════
  trueform: [
    {
      label: 'gravity_invert',
      desc:  'Invert gravity for all non-boss players (10 s)',
      fn(ctx) {
        if (typeof tfGravityInverted === 'undefined') return;
        tfGravityInverted = !tfGravityInverted;
        tfGravityTimer    = tfGravityInverted ? 600 : 0;
        spawnParticles(ctx.cx(), ctx.cy(), '#ffffff', 22);
        showBossDialogue(tfGravityInverted ? 'Down is up now.' : 'Gravity returns.', 180);
      }
    },
    {
      label: 'controls_invert',
      desc:  'Invert player left/right controls',
      fn(ctx) {
        if (typeof tfControlsInverted === 'undefined') return;
        tfControlsInverted = !tfControlsInverted;
        spawnParticles(ctx.cx(), ctx.cy(), '#aaaaaa', 16);
        showBossDialogue(tfControlsInverted ? 'Your body refuses you.' : 'Control returns.', 180);
      }
    },
    {
      label: 'black_holes',
      desc:  'Spawn black holes that pull players',
      fn(ctx) {
        if (typeof spawnTFBlackHoles === 'function') {
          spawnTFBlackHoles(ctx);
        } else if (typeof tfBlackHoles !== 'undefined') {
          for (let i=0;i<3;i++)
            tfBlackHoles.push({ x:150+i*280, y:260+Math.random()*80, r:0, maxR:70, timer:600, bossRef:ctx });
        }
        showBossDialogue('Consume.', 110);
      }
    },
    {
      label: 'floor_remove',
      desc:  'Remove the arena floor for 20 seconds',
      fn() {
        if (typeof tfFloorRemoved === 'undefined') return;
        tfFloorRemoved = true; tfFloorTimer = 1200;
        const fl = currentArena && currentArena.platforms.find(p => p.isFloor);
        if (fl) fl.isFloorDisabled = true;
        spawnParticles(GAME_W/2, 465, '#000000', 30);
        spawnParticles(GAME_W/2, 465, '#ffffff', 15);
        showBossDialogue('There is no ground to stand on.', 240);
      }
    },
    {
      label: 'size_shift',
      desc:  'Randomly resize the player',
      fn(ctx, target) {
        if (typeof tfSetSize !== 'function') return;
        const scales = [0.4, 0.55, 0.7, 1.0, 1.25, 1.5];
        if (target) tfSetSize(target, scales[Math.floor(Math.random()*scales.length)]);
        showBossDialogue('Size means nothing here.', 180);
      }
    },
    {
      label: 'arena_warp',
      desc:  'Warp to a random arena',
      fn() {
        if (typeof tfWarpArena !== 'function') return;
        const pool = Object.keys(ARENAS).filter(k => !['creator','void','soccer'].includes(k));
        tfWarpArena(pool[Math.floor(Math.random()*pool.length)]);
        showBossDialogue('A new stage.', 150);
      }
    },
    {
      label: 'portal_teleport',
      desc:  'Teleport the player through a void portal',
      fn(ctx, target) {
        if (typeof executeTrueFormAttack === 'function') {
          executeTrueFormAttack(ctx, 'portal', target, 'atk-gui');
        } else if (target) {
          target.x = clamp(GAME_W - target.x - target.w, 20, GAME_W - target.w - 20);
          spawnParticles(target.cx(), target.cy(), '#8800ff', 18);
        }
      }
    },
    {
      label: 'void_grasp',
      desc:  'Pull player in then slam (Void Grasp)',
      fn(ctx, target) { if (typeof executeTrueFormAttack === 'function') { ctx._graspCd=0; executeTrueFormAttack(ctx, 'grasp', target, 'atk-gui'); } }
    },
    {
      label: 'reality_slash',
      desc:  'Telegraph + teleport strike (Reality Slash)',
      fn(ctx, target) { if (typeof executeTrueFormAttack === 'function') { ctx._slashCd=0; executeTrueFormAttack(ctx, 'slash', target, 'atk-gui'); } }
    },
    {
      label: 'gravity_well',
      desc:  'Persistent gravity pull zone',
      fn(ctx, target) { if (typeof executeTrueFormAttack === 'function') { ctx._wellCd=0; executeTrueFormAttack(ctx, 'well', target, 'atk-gui'); } }
    },
    {
      label: 'meteor_crash',
      desc:  'Rising leap then crash down on target',
      fn(ctx, target) { if (typeof executeTrueFormAttack === 'function') { ctx._meteorCd=0; executeTrueFormAttack(ctx, 'meteor', target, 'atk-gui'); } }
    },
    {
      label: 'shadow_clones',
      desc:  '3 clones — one is real (Shadow Clones)',
      fn(ctx, target) { if (typeof executeTrueFormAttack === 'function') { ctx._cloneCd=0; executeTrueFormAttack(ctx, 'clones', target, 'atk-gui'); } }
    },
    {
      label: 'chain_slam',
      desc:  'Multi-stage slam combo (Chain Slam)',
      fn(ctx, target) { if (typeof executeTrueFormAttack === 'function') { ctx._chainCd=0; executeTrueFormAttack(ctx, 'chain', target, 'atk-gui'); } }
    },
    {
      label: 'shockwave',
      desc:  'Ground shockwave with telegraph ring',
      fn(ctx, target) { if (typeof executeTrueFormAttack === 'function') { ctx._shockwaveCd=0; executeTrueFormAttack(ctx, 'shockwave', target, 'atk-gui'); } }
    },
    {
      label: 'phase_shift',
      desc:  '3 decoy echoes, one is real (Phase Shift)',
      fn(ctx, target) { if (typeof executeTrueFormAttack === 'function') { ctx._phaseShiftCd=0; executeTrueFormAttack(ctx, 'phaseShift', target, 'atk-gui'); } }
    },
    {
      label: 'teleport_combo',
      desc:  '3× rapid teleport-strikes',
      fn(ctx, target) { if (typeof executeTrueFormAttack === 'function') { ctx._teleportComboCd=0; executeTrueFormAttack(ctx, 'teleportCombo', target, 'atk-gui'); } }
    },
    {
      label: 'gravity_crush',
      desc:  'Suck players to center then explode outward',
      fn(ctx, target) { if (typeof executeTrueFormAttack === 'function') { ctx._gravityCrushCd=0; executeTrueFormAttack(ctx, 'gravityCrush', target, 'atk-gui'); } }
    },
    {
      label: 'gamma_beam',
      desc:  'Horizontal screen-crossing beam',
      fn(ctx, target) { if (typeof executeTrueFormAttack === 'function') { ctx._gammaBeamCd=0; executeTrueFormAttack(ctx, 'gammaBeam', target, 'atk-gui'); } }
    },
    {
      label: 'neutron_star',
      desc:  'Massive gravity sphere (Neutron Star)',
      fn(ctx, target) { if (typeof executeTrueFormAttack === 'function') { ctx._neutronStarCd=0; executeTrueFormAttack(ctx, 'neutronStar', target, 'atk-gui'); } }
    },
    {
      label: 'galaxy_sweep',
      desc:  'Wide debris wave (Galaxy Sweep)',
      fn(ctx, target) { if (typeof executeTrueFormAttack === 'function') { ctx._galaxySweepCd=0; executeTrueFormAttack(ctx, 'galaxySweep', target, 'atk-gui'); } }
    },
    {
      label: 'multiverse_fracture',
      desc:  'Shatter arena into segments',
      fn(ctx, target) { if (typeof executeTrueFormAttack === 'function') { ctx._multiverseCd=0; executeTrueFormAttack(ctx, 'multiverseFracture', target, 'atk-gui'); } }
    },
    {
      label: 'supernova',
      desc:  'Ultimate screen-clearing explosion',
      fn(ctx, target) { if (typeof executeTrueFormAttack === 'function') { ctx._supernovaCd=0; executeTrueFormAttack(ctx, 'supernova', target, 'atk-gui'); } }
    },
    {
      label: 'collapse_strike',
      desc:  'Slow-motion devastating blow',
      fn(ctx, target) { if (typeof executeTrueFormAttack === 'function') { ctx._collapseStrikeCd=0; executeTrueFormAttack(ctx, 'collapseStrike', target, 'atk-gui'); } }
    },
    {
      label: 'reality_override',
      desc:  'Boss temporarily rewrites game state',
      fn(ctx, target) { if (typeof executeTrueFormAttack === 'function') { ctx._realityOverrideCd=0; executeTrueFormAttack(ctx, 'realityOverride', target, 'atk-gui'); } }
    },
  ],

  // ═══════════════════════════════════════════════════════════
  // WEAPON ABILITIES (fires from first human player)
  // ═══════════════════════════════════════════════════════════
  weapons: [
    {
      label: 'sword_parry',
      desc:  'Sword ability — parry/counter',
      fn(_, target) {
        const p = players && players.find(q => !q.isBoss && q.health > 0);
        if (p && WEAPONS.sword && WEAPONS.sword.ability) WEAPONS.sword.ability(p, target || p.target);
      }
    },
    {
      label: 'hammer_shockwave',
      desc:  'Hammer ability — ground shockwave',
      fn(_, target) {
        const p = players && players.find(q => !q.isBoss && q.health > 0);
        if (p && WEAPONS.hammer && WEAPONS.hammer.ability) WEAPONS.hammer.ability(p, target || p.target);
      }
    },
    {
      label: 'gun_rapidfire',
      desc:  'Gun ability — 5-shot rapid burst',
      fn() {
        const p = players && players.find(q => !q.isBoss && q.health > 0);
        if (p && WEAPONS.gun && WEAPONS.gun.ability) WEAPONS.gun.ability(p, p.target);
      }
    },
    {
      label: 'axe_spin',
      desc:  'Axe ability — 360° spin',
      fn(_, target) {
        const p = players && players.find(q => !q.isBoss && q.health > 0);
        if (p && WEAPONS.axe && WEAPONS.axe.ability) WEAPONS.axe.ability(p, target || p.target);
      }
    },
    {
      label: 'spear_dash',
      desc:  'Spear ability — forward dash thrust',
      fn(_, target) {
        const p = players && players.find(q => !q.isBoss && q.health > 0);
        if (p && WEAPONS.spear && WEAPONS.spear.ability) WEAPONS.spear.ability(p, target || p.target);
      }
    },
  ],

  // ═══════════════════════════════════════════════════════════
  // YETI ATTACKS
  // ═══════════════════════════════════════════════════════════
  yeti: [
    {
      label: 'ice_roar',
      desc:  'AOE stun + KB all nearby players',
      fn(ctx) {
        const ROAR_R = 200;
        for (const p of _atkGetAOETargets(_atkCurrentFirer)) {
          if (Math.hypot(p.cx()-ctx.cx(), p.cy()-ctx.cy()) < ROAR_R) {
            p.stunTimer = Math.max(p.stunTimer||0, 60);
            p.vx = (p.cx() > ctx.cx() ? 1 : -1) * 10;
          }
        }
        spawnParticles(ctx.cx(), ctx.cy(), '#88ccff', 30);
        screenShake = Math.max(screenShake, 16);
        if (settings.dmgNumbers && typeof DamageText !== 'undefined')
          damageTexts.push(new DamageText(ctx.cx(), ctx.y-20, 'ROAR!', '#88ccff'));
      }
    },
    {
      label: 'ice_throw',
      desc:  'Throw an ice boulder at the target',
      fn(ctx, target) {
        if (!target) return;
        const dx = target.cx()-ctx.cx(), dy = (target.cy())-(ctx.cy());
        const spd = 14, mag = Math.hypot(dx,dy)||1;
        const _iceBoulder = new Projectile(ctx.cx(), ctx.cy(), (dx/mag)*spd, (dy/mag)*spd-4, null, Math.round(22*_atkDamageScale), '#aaddff');
        _iceBoulder.radius = 10; _iceBoulder.life = 120;
        projectiles.push(_iceBoulder);
        spawnParticles(ctx.cx(), ctx.cy(), '#aaddff', 12);
      }
    },
    {
      label: 'blizzard',
      desc:  'Burst of ice projectiles across the arena',
      fn(ctx) {
        for (let i=0;i<8;i++) {
          const ang = (Math.PI*0.9)+(i/7)*(Math.PI*1.0);
          const spd = 4+Math.random()*4;
          const _blizzP = new Projectile(ctx.cx(), ctx.y+30+i*20, Math.cos(ang)*spd, Math.sin(ang)*spd+1, null, Math.round(8*_atkDamageScale), '#88ccff');
          _blizzP.radius = 8; _blizzP.life = 180;
          projectiles.push(_blizzP);
        }
        spawnParticles(ctx.cx(), ctx.y, '#cceeff', 30);
        screenShake = Math.max(screenShake, 8);
        showBossDialogue && showBossDialogue('BLIZZARD!', 180);
      }
    },
    {
      label: 'ice_slam',
      desc:  'Massive downward ice slam + freeze zone',
      fn(ctx) {
        screenShake = Math.max(screenShake, 22);
        spawnParticles(ctx.cx(), ctx.cy(), '#aaddff', 40);
        spawnParticles(ctx.cx(), ctx.cy(), '#ffffff', 20);
        for (const p of _atkGetAOETargets(_atkCurrentFirer)) {
          _atkDeal(null, p, 30, 18);
          p.stunTimer = Math.max(p.stunTimer||0, 45);
        }
        if (settings.dmgNumbers && typeof DamageText !== 'undefined')
          damageTexts.push(new DamageText(ctx.cx(), ctx.y-30, 'ICE SLAM!', '#aaddff'));
      }
    },
  ],

  // ═══════════════════════════════════════════════════════════
  // FOREST BEAST ATTACKS
  // ═══════════════════════════════════════════════════════════
  beast: [
    {
      label: 'pounce',
      desc:  'Lunge forward at the player with high KB',
      fn(ctx, target) {
        if (!target) return;
        const dir = target.cx() > ctx.cx() ? 1 : -1;
        spawnParticles(ctx.cx(), ctx.cy(), '#1a8a2e', 16);
        _atkDeal(null, target, 20, 14);
        target.vx = dir * 18; target.vy = -10;
      }
    },
    {
      label: 'rage_burst',
      desc:  'Rage burst — particle explosion + nearby KB',
      fn(ctx) {
        spawnParticles(ctx.cx(), ctx.cy(), '#ff4400', 40);
        spawnParticles(ctx.cx(), ctx.cy(), '#ff8800', 20);
        screenShake = Math.max(screenShake, 20);
        for (const p of _atkGetAOETargets(_atkCurrentFirer)) {
          if (Math.hypot(p.cx()-ctx.cx(), p.cy()-ctx.cy()) < 160) {
            _atkDeal(null, p, 15, 16);
            p.vx = (p.cx() > ctx.cx() ? 1 : -1) * 16;
          }
        }
        if (settings.dmgNumbers && typeof DamageText !== 'undefined')
          damageTexts.push(new DamageText(ctx.cx(), ctx.y-20, 'ENRAGED!', '#ff4400'));
      }
    },
    {
      label: 'ground_slam',
      desc:  'AOE ground slam on landing',
      fn(ctx) {
        screenShake = Math.max(screenShake, 14);
        spawnParticles(ctx.cx(), ctx.y+ctx.h, '#1a8a2e', 24);
        for (const p of _atkGetAOETargets(_atkCurrentFirer)) {
          if (Math.abs(p.cx()-ctx.cx()) < 120) _atkDeal(null, p, 18, 12);
        }
      }
    },
    {
      label: 'vine_snare',
      desc:  'Root the target in place for 1.5 s',
      fn(ctx, target) {
        if (!target) return;
        target.stunTimer = Math.max(target.stunTimer||0, 90);
        target.vx = 0; target.vy = 0;
        spawnParticles(target.cx(), target.cy(), '#1a8a2e', 20);
        spawnParticles(target.cx(), target.cy(), '#44cc44', 10);
        if (settings.dmgNumbers && typeof DamageText !== 'undefined')
          damageTexts.push(new DamageText(target.cx(), target.y-20, 'SNARED!', '#44cc44'));
      }
    },
  ],
};

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

// ─── VISUAL GUI ───────────────────────────────────────────────
function _atkOpenGUI() {
  const existing = document.getElementById('atkViewerOverlay');
  if (existing) { existing.remove(); return; }

  const ov = document.createElement('div');
  ov.id = 'atkViewerOverlay';
  ov.style.cssText = 'position:fixed;top:0;right:0;width:340px;max-height:100vh;overflow-y:auto;z-index:9995;background:rgba(6,6,18,0.97);border-left:2px solid #8800ff;font-family:monospace;color:#ccbbff;display:flex;flex-direction:column;';

  // Header
  const hdr = document.createElement('div');
  hdr.style.cssText = 'padding:10px 14px 6px;background:rgba(50,0,100,0.9);border-bottom:1px solid #8800ff;flex-shrink:0;';
  hdr.innerHTML = '<span style="font-size:1rem;font-weight:bold;letter-spacing:1px;color:#cc88ff">⚔ ATTACK VIEWER</span>'
    + '<span id="atkCloseBtn" style="float:right;cursor:pointer;color:#ff88aa;font-size:1.1rem;" title="Close">✕</span>'
    + '<div style="font-size:0.7rem;color:#8866aa;margin-top:3px;">Click an attack to fire it as a pure effect. No boss spawned.</div>';
  ov.appendChild(hdr);

  // Options bar
  const optBar = document.createElement('div');
  optBar.style.cssText = 'padding:7px 14px;background:rgba(20,10,40,0.9);border-bottom:1px solid #440088;font-size:0.72rem;display:flex;gap:10px;align-items:center;flex-shrink:0;';
  optBar.innerHTML = `<label style="cursor:pointer"><input type="checkbox" id="atkGUISafe" ${_atkSafeMode?'checked':''}> Safe</label>`
    + `<label style="cursor:pointer"><input type="checkbox" id="atkGUIPause" ${_atkPauseBetween?'checked':''}> Pause</label>`
    + `<label>Dmg×<input type="number" id="atkGUIScale" value="${_atkDamageScale}" min="0.1" max="10" step="0.1" style="width:42px;background:#111;color:#aaf;border:1px solid #556;border-radius:3px;padding:1px 4px;"></label>`
    + `<button id="atkGUIReset" style="margin-left:auto;padding:2px 8px;background:rgba(180,0,0,0.4);border:1px solid #880000;border-radius:4px;color:#ffaaaa;cursor:pointer;font-size:0.7rem;">Reset</button>`;
  ov.appendChild(optBar);

  // Admin class equip bar
  const kitBar = document.createElement('div');
  kitBar.style.cssText = 'padding:6px 14px;background:rgba(15,0,35,0.9);border-bottom:1px solid #440088;font-size:0.7rem;flex-shrink:0;';
  kitBar.innerHTML = '<div style="color:#aa88cc;margin-bottom:4px;">⚙ Equip Admin Kit on player:</div>'
    + '<div style="display:flex;gap:6px;flex-wrap:wrap;">'
    + ['creator','trueform','yeti','beast'].map(k =>
        `<button class="atkKitBtn" data-kit="${k}" style="padding:3px 8px;background:rgba(80,0,160,0.4);border:1px solid #660099;border-radius:4px;color:#cc88ff;cursor:pointer;font-size:0.68rem;">${k}</button>`
      ).join('')
    + `<button class="atkKitBtn" data-kit="off" style="padding:3px 8px;background:rgba(100,0,0,0.4);border:1px solid #660000;border-radius:4px;color:#ff8888;cursor:pointer;font-size:0.68rem;">off</button>`
    + `<select id="atkKitSlot" style="padding:2px 4px;background:#111;color:#aaf;border:1px solid #446;border-radius:4px;font-size:0.68rem;"><option value="p1">P1</option><option value="p2">P2</option></select>`
    + '</div>';
  ov.appendChild(kitBar);

  // Class tabs
  const tabBar = document.createElement('div');
  tabBar.style.cssText = 'display:flex;flex-shrink:0;border-bottom:1px solid #440088;';
  const classKeys = Object.keys(ATK_REGISTRY);
  let activeKey = classKeys[0];
  const tabBtns = {};
  for (const key of classKeys) {
    const tb = document.createElement('button');
    tb.textContent = key.toUpperCase().slice(0,6);
    tb.dataset.key = key;
    tb.style.cssText = 'flex:1;padding:6px 2px;background:transparent;border:none;border-right:1px solid #440088;color:#aa88cc;font-family:monospace;font-size:0.68rem;cursor:pointer;';
    tabBtns[key] = tb;
    tabBar.appendChild(tb);
  }
  ov.appendChild(tabBar);

  // Attack list
  const listDiv = document.createElement('div');
  listDiv.id = 'atkGUIList';
  listDiv.style.cssText = 'flex:1;overflow-y:auto;padding:6px 10px;';
  ov.appendChild(listDiv);

  // Demo all footer
  const footer = document.createElement('div');
  footer.style.cssText = 'padding:8px 14px;border-top:1px solid #440088;flex-shrink:0;';
  footer.innerHTML = '<button id="atkGUIDemoAll" style="width:100%;padding:5px;background:rgba(100,0,200,0.4);border:1px solid #8800ff;border-radius:5px;color:#cc88ff;font-family:monospace;cursor:pointer;">▶ Demo All Attacks</button>';
  ov.appendChild(footer);

  document.body.appendChild(ov);

  // Render attack cards
  function _syncOpts() {
    const safeEl  = document.getElementById('atkGUISafe');
    const scaleEl = document.getElementById('atkGUIScale');
    const pauseEl = document.getElementById('atkGUIPause');
    if (safeEl)  _atkSafeMode     = safeEl.checked;
    if (scaleEl) _atkDamageScale  = Math.max(0.1, parseFloat(scaleEl.value)||1);
    if (pauseEl) _atkPauseBetween = pauseEl.checked;
  }

  function _renderCards(key) {
    activeKey = key;
    for (const [k, btn] of Object.entries(tabBtns)) {
      btn.style.background = k===key ? 'rgba(100,0,200,0.5)' : 'transparent';
      btn.style.color      = k===key ? '#ffffff' : '#aa88cc';
    }
    listDiv.innerHTML = '';
    const bucket = ATK_REGISTRY[key] || [];
    bucket.forEach((entry, i) => {
      const card = document.createElement('div');
      card.style.cssText = 'display:flex;align-items:center;gap:8px;margin:4px 0;padding:6px 10px;background:rgba(40,0,80,0.55);border:1px solid rgba(120,0,200,0.4);border-radius:5px;cursor:pointer;';
      card.innerHTML = `<div style="flex:0 0 auto;font-size:0.7rem;color:#8844cc;min-width:18px">${i+1}</div>`
        + `<div style="flex:1;"><div style="color:#ddaaff;font-size:0.8rem;font-weight:bold;">${entry.label}</div>`
        + `<div style="color:#8877aa;font-size:0.68rem;margin-top:1px;">${entry.desc}</div></div>`
        + `<button style="flex-shrink:0;padding:3px 10px;background:rgba(130,0,255,0.4);border:1px solid #8800ff;border-radius:4px;color:#ccaaff;font-size:0.7rem;cursor:pointer;">▶</button>`;
      card.addEventListener('mouseenter', () => { card.style.background = 'rgba(80,0,150,0.7)'; });
      card.addEventListener('mouseleave', () => { card.style.background = 'rgba(40,0,80,0.55)'; });
      card.addEventListener('click', () => {
        _syncOpts();
        _atkSummon(entry.label);
      });
      listDiv.appendChild(card);
    });
  }

  _renderCards(activeKey);
  for (const [key, btn] of Object.entries(tabBtns)) btn.addEventListener('click', () => _renderCards(key));
  ov.querySelector('#atkCloseBtn').addEventListener('click', () => ov.remove());
  document.getElementById('atkGUIReset').addEventListener('click', () => _atkResetEffects());
  document.getElementById('atkGUIDemoAll').addEventListener('click', () => { _syncOpts(); _atkAll(activeKey); });

  // Kit equip buttons
  ov.querySelectorAll('.atkKitBtn').forEach(btn => {
    btn.addEventListener('click', () => {
      _syncOpts();
      const slot = document.getElementById('atkKitSlot').value;
      _atkEquipClass(btn.dataset.kit, slot);
    });
  });

  _consolePrint('[ATK] GUI opened — click any attack card to fire it.', '#88bbff');
}

// ─── PATCH CONSOLE ────────────────────────────────────────────
(function _patchConsoleForATK() {
  if (typeof _consoleExec !== 'function') {
    window.addEventListener('load', _patchConsoleForATK, { once: true });
    return;
  }
  if (_consoleExec.__atkPatched) return;
  const _orig = _consoleExec;
  _consoleExec = function(raw) {
    const trimmed = raw.trim().toLowerCase();
    if (trimmed === 'atk' || trimmed.startsWith('atk ')) {
      _atkCommand(raw.trim().slice(4).trim());
      return;
    }
    _orig(raw);
  };
  _consoleExec.__atkPatched = true;
  // Browser DevTools aliases
  window.atkSummon = (l)   => _atkSummon(l);
  window.atkList   = (k)   => _atkList(k);
  window.atkAll    = (k)   => _atkAll(k);
  window.atkGUI    = ()    => _atkOpenGUI();
  window.atkReset  = ()    => _atkResetEffects();
  window.atkClass  = (k,s) => _atkEquipClass(k,s);
})();
