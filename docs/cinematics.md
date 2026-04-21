# Cinematics — Stickman Battles

## Overview

The cinematic system v2 (`smb-cinematics.js`) replaces hand-written imperative frame-counters with a declarative, timeline-based scripting API. It is the single source of truth for all in-engine cutscenes, finishers, boss transitions, and TrueForm sequences.

---

## Core Architecture

### Key Globals

| Global | Type | Purpose |
|--------|------|---------|
| `activeCinematic` | Object | Currently running cinematic; `null` when idle |
| `isCinematic` | Boolean | Blocks new attacks and projectile spawns while true |
| `slowMotion` | 0–1 | Physics time scale; 1 = normal; 0.05 = near-frozen |
| `cinematicCamOverride` | Boolean | Prevents `updateCamera()` from touching the camera |
| `cinematicCamSnapFrames` | Number | >0 forces a hard-cut camera move |
| `cinematicFocusX/Y` | Number | World-space camera target set by `CinCam` |

---

## cinScript() API

The primary builder function. Returns a cinematic object that can be passed to `startCinematic()`.

```js
startCinematic(cinScript({
  duration: 4.0,                     // total length in seconds
  label: { text: 'PHASE 2', color: '#ff0044' },  // optional title card
  slowMo: [                          // [timeInSeconds, targetSlowMoValue]
    [0,   1.0],                      // start at normal speed
    [0.3, 0.05],                     // ramp to near-freeze
    [3.7, 0.05],                     // hold
    [4.0, 1.0],                      // return to normal
  ],
  cam: [                             // [timeInSeconds, CinCam command]
    [0,   { zoomTo: 1.7, focusOn: () => boss }],
    [0.5, { zoomTo: 1.1, focusOn: () => target }],
  ],
  steps: [                           // ordered by `at` value
    { at: 0.3, run: ({ boss, target }) => { /* imperative action */ } },
    { at: 0.8, dialogue: 'Enough.' },
    { at: 0.8, fx: { screenShake: 40, shockwave: { color: '#ff0044' } } },
  ]
}));
```

- `duration` — if omitted, calculated from last step's `at` value
- `steps` — processed in order; `run` receives current entity refs from a context object
- `cam` entries — processed independently from steps on the same timeline
- `slowMo` entries — ramped linearly between keyframes

---

## CinFX — Effect Helpers

Used inside `steps[].fx` or `steps[].run`:

| Method | Description |
|--------|-------------|
| `CinFX.shockwave(x, y, color, opts)` | Expanding ring(s): `count`, `maxR`, `lw`, `dur` |
| `CinFX.particles(x, y, color, count)` | Particle burst at world position |
| `CinFX.shake(intensity)` | One-shot screen shake (sets `screenShake`) |
| `CinFX.flash(color, alpha, durationFrames)` | Full-screen color flash |
| `CinFX.groundCrack(x, groundY, opts)` | Radiating cracks with branches (`count`, `color`) |
| `CinFX.arenaHazardNow()` | Immediately triggers boss floor hazard |

---

## CinCam — Camera Commands

Used in `cam[]` entries:

| Command | Effect |
|---------|--------|
| `focusOn: () => entity` | Smooth pan to entity center |
| `focusAt: { x, y }` | Smooth pan to world coordinate |
| `zoomTo: n` | Lerp zoom target to `n` (1.0 = default) |
| `snap: { x, y, zoom }` | Hard-cut to position + zoom |
| `orbit: { cx, cy, radius, angle, zoom }` | Circular reveal shot |
| `midpoint: { a, b, zoom }` | Center camera between two entities |

---

## Sequence Types

### Boss Phase Transitions

Fired by `Boss.updateAI()` at HP thresholds. Uses `_cinematicFired` Set to prevent re-trigger.

| HP Threshold | Sequence |
|-------------|----------|
| 75% | Warning monologue, camera pull-back, beam telegraph |
| 50% | Paradox punched cinematic (phase 2 entry) |
| 40% | Rage escalation, platform hazard activation |
| 10% | Desperation mode, meteor storm |

### TrueForm Sequences

| Trigger | Sequence |
|---------|---------|
| Fight start | 7-second opening cinematic; Paradox foreshadowing |
| @20% HP | Supernova attack wind-up |
| Death | TrueForm ending cinematic v2 (meta-breaking, smb-trueform-ending.js) |
| @30% HP | Paradox dragged back — loss-of-control moment |

### Finishers

`smb-finishers.js` — killing-blow finisher system.

- Triggered when `target.health <= 0` inside `dealDamage()`
- Checks `settings.finishers` flag before activating
- Runs a short cinematic: slow-mo freeze, zoom into attacker, impact flash, resume
- Each weapon has a unique finisher animation (sword slash-down, hammer smash, gun headshot, etc.)

### QTE Phases

`smb-qte.js` — QTE at 75/50/25/10% TrueForm HP.

- `triggerQTEPhase()` — stops game, shows prompt
- Player must press correct key within window → reward (damage boost, heal)
- Failure → TrueForm empowers briefly
- `updateQTE()` / `drawQTE()` called from `gameLoop` when QTE active
- QTE is NEVER triggered during combat — only at specific cinematic HP checkpoints

---

## Phase Reference

TrueForm cinematic phases (tracked in `tfCinematicState`):

| Phase String | Meaning |
|--------------|---------|
| `'none'` | No active TF cinematic |
| `'opening_fight'` | Pre-fight intro sequence |
| `'paradox_death'` | Paradox punched and collapses |
| `'absorption'` | TrueForm absorbs Paradox energy |
| `'punch_transition'` | Phase 2 entry with signature punch |
| `'backstage'` | Post-fight meta-breaking sequence |

---

## Impact Cinematic System

`smb-cinematic.js` — lightweight system for in-combat impact moments. Separate from `CinematicManager`.

- Triggers on heavy hits (≥30 damage) or super activations
- Hit-stop: `hitStopFrames` set in `dealDamage()`; gameLoop skips physics while >0
- Camera zoom-in: `camHitZoomTimer` lerps zoom toward target briefly
- Red vignette: `hitVignetteTimer` fades red overlay for human players taking ≥15 damage
- Hit-slow: `hitSlowTimer` briefly reduces `slowMotion` after heavy collisions

---

## Adding a New Cinematic

1. Define the sequence using `cinScript()` in the relevant module (boss.js, paradox.js, etc.)
2. Call `startCinematic(yourScript)` at the appropriate trigger point
3. Check `activeCinematic` is null before triggering (prevent stacking)
4. Use `_cinematicFired.add('myKey')` with a Set guard if it should fire only once
5. Restore any state you modify in the final step (`at: duration`)

**Never call `startCinematic()` inside `dealDamage()` directly — defer via a flag and trigger at frame start.**

---

## Common Pitfalls

- `isCinematic = true` blocks `dealDamage()` — do not forget to set it back to `false` in the final step
- `cinematicCamOverride = true` blocks `updateCamera()` — must be cleared when cinematic ends
- `slowMotion` affects physics; entities still update (at reduced speed) unless `gameFrozen` is set
- `activeCinematic` has no queue — a new `startCinematic()` while one runs replaces it; use `_cinematicFired` guards
- Step `at` values must be in ascending order within the `steps` array
