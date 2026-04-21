'use strict';
// smb-attacktest-exec.js — FORCE_ATTACK_MODE, getSafeSpawnPosition, _atkMakeDummyTarget, _atkEnsureGlobals, forceExecuteAttack, debug tools
// Depends on: smb-globals.js, smb-fighter.js, smb-combat.js

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

