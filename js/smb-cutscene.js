'use strict';
// smb-cutscene.js — Deterministic step-based cutscene system
// ============================================================
// Cutscenes are data-driven sequences of discrete steps.
// Each step runs once and advances only when its timer condition is met.
//
// CONTROL LOCK: while a cutscene is active
//   - processInput() is suppressed (activeCutscene check in smb-loop.js)
//   - Fighter.updateAI() is suppressed (activeCutscene check in smb-fighter.js)
//   - Physics update is suppressed (gameFrozen = true while running)
//
// PUBLIC API
//   startCutscene(data)   — begin a cutscene; data is an arbitrary object
//   endCutscene()         — finish and restore control
//   updateCutscene()      — called every frame from gameLoop; advances steps
//   isCutsceneActive()    — returns true when a cutscene is running
//
// STEP PATTERN  (implement in data.onStep or supply data.steps array)
//
//   steps: [
//     { duration: 60, onEnter(cs){}, onTick(cs){}, onExit(cs){} },
//     { duration: 90, ... },
//   ]
//
// Alternatively, supply data.update(cs) for a fully custom imperative loop.
// ============================================================

// ── Global state ─────────────────────────────────────────────────────────────
let activeCutscene = null;  // null when inactive; object while running

// ── Internal helpers ─────────────────────────────────────────────────────────

/** Apply the control-lock: freeze physics and suppress input/AI. */
function _cutsceneLock() {
  gameFrozen = true;
}

/** Lift the control-lock: unfreeze physics and restore input/AI. */
function _cutsceneUnlock() {
  gameFrozen = false;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Start a cutscene.
 *
 * @param {object} data  Arbitrary cutscene descriptor.  Recognised keys:
 *   steps   {Array}    — Array of step objects { duration, onEnter, onTick, onExit }
 *   update  {Function} — Custom per-frame function(cs); overrides step-array logic.
 *   onEnd   {Function} — Called by endCutscene() just before control is restored.
 */
function startCutscene(data) {
  if (activeCutscene && activeCutscene.running) {
    // Forcibly end the previous cutscene before starting the next one.
    endCutscene();
  }

  activeCutscene = {
    step:     0,
    timer:    0,
    running:  true,
    _entered: false,  // whether onEnter for current step has been called
    data:     data || {},
  };

  _cutsceneLock();
}

/**
 * End the active cutscene and restore player/AI control.
 * Safe to call even when no cutscene is active.
 */
function endCutscene() {
  if (!activeCutscene) return;

  // Call the final-step's onExit if it hasn't been called yet
  const cs  = activeCutscene;
  const def = cs.data.steps && cs.data.steps[cs.step];
  if (def && def.onExit) {
    try { def.onExit(cs); } catch(e) { console.warn('[cutscene] onExit error', e); }
  }

  // User-supplied teardown hook
  if (cs.data.onEnd) {
    try { cs.data.onEnd(cs); } catch(e) { console.warn('[cutscene] onEnd error', e); }
  }

  cs.running    = false;
  activeCutscene = null;

  _cutsceneUnlock();
}

/**
 * Returns true while a cutscene is running.
 */
function isCutsceneActive() {
  return activeCutscene !== null && activeCutscene.running;
}

// ── Frame update (called each frame from gameLoop) ────────────────────────────

/**
 * Advance the active cutscene by one frame.
 * Called unconditionally from gameLoop; exits immediately when inactive.
 */
function updateCutscene() {
  const cs = activeCutscene;
  if (!cs || !cs.running) return;

  // Custom imperative update overrides the step-array logic entirely.
  if (typeof cs.data.update === 'function') {
    try { cs.data.update(cs); } catch(e) { console.warn('[cutscene] update error', e); }
    return;
  }

  const steps = cs.data.steps;
  if (!steps || steps.length === 0) {
    // Nothing to do — end immediately.
    endCutscene();
    return;
  }

  // All steps complete → end the cutscene.
  if (cs.step >= steps.length) {
    endCutscene();
    return;
  }

  const def = steps[cs.step];

  // ── ENTER: run onEnter exactly once when we arrive at this step ───────────
  if (!cs._entered) {
    cs._entered = true;
    cs.timer    = (def.duration != null) ? def.duration : 60;
    if (typeof def.onEnter === 'function') {
      try { def.onEnter(cs); } catch(e) { console.warn('[cutscene] onEnter error', e); }
    }
  }

  // ── TICK: run every frame while on this step ──────────────────────────────
  if (typeof def.onTick === 'function') {
    try { def.onTick(cs); } catch(e) { console.warn('[cutscene] onTick error', e); }
  }

  // ── ADVANCE: decrement timer; move to next step when it reaches zero ──────
  cs.timer--;
  if (cs.timer <= 0) {
    if (typeof def.onExit === 'function') {
      try { def.onExit(cs); } catch(e) { console.warn('[cutscene] onExit error', e); }
    }
    cs.step++;
    cs._entered = false;
  }
}

// ── Draw hook (screen-space, optional) ───────────────────────────────────────

/**
 * Draw cutscene overlays in screen-space.
 * Call after ctx.setTransform(1,0,0,1,0,0) in the render loop.
 * The active step's onDraw(cs, ctx, cw, ch) is invoked if defined.
 */
function drawCutscene(ctx, cw, ch) {
  const cs = activeCutscene;
  if (!cs || !cs.running) return;

  const steps = cs.data.steps;
  const def   = steps && steps[cs.step];
  if (def && typeof def.onDraw === 'function') {
    ctx.save();
    try { def.onDraw(cs, ctx, cw, ch); } catch(e) { console.warn('[cutscene] onDraw error', e); }
    ctx.restore();
  }

  // Top-level draw function on the data object (always drawn if defined)
  if (typeof cs.data.onDraw === 'function') {
    ctx.save();
    try { cs.data.onDraw(cs, ctx, cw, ch); } catch(e) { console.warn('[cutscene] data.onDraw error', e); }
    ctx.restore();
  }
}
