# Refactoring & Scalability Plan — Stickman Battles

## Upfront: The Non-Negotiable Constraint

This codebase has **no build step, no bundler, no ES modules**. Every `.js` file is loaded by a `<script>` tag in `index.html` in strict order. This is intentional (zero toolchain, runs directly in a browser) and must be preserved.

This means the refactoring uses **globals-based modularity** — not ES module imports. The patterns below are designed specifically for this constraint. Solutions that require `import`/`export`, TypeScript compilation, or Webpack are out of scope unless you explicitly decide to add a build step (covered at the end).

---

## Current State: What's Too Big

| File | Lines | Problem |
|------|-------|---------|
| `smb-story.js` | 7,182 | 85% is raw chapter data (lines 1079–7182); engine code buried in it |
| `smb-boss.js` | 6,832 | Two full class definitions (Boss + TrueForm) plus ~3,700 lines of helpers |
| `smb-drawing.js` | 4,005 | 24 arena-specific draw functions mixed with core rendering pipeline |
| `smb-paradox.js` | 3,325 | Manageable but tightly coupled to boss globals |
| `smb-fighter.js` | 3,154 | 6 distinct logical groups; stable but hard to navigate |

**Total problem surface:** ~24,500 lines across 5 files. The other 28 modules are fine.

---

## 1. Proposed Folder Structure

```
Stickman-Battles/
├── index.html
├── SMB.css
├── server.js
├── images/
└── js/
    │
    ├── core/                        ← Boot, globals, audio, persistence
    │   ├── smb-errorboundary.js
    │   ├── smb-globals.js
    │   ├── smb-audio.js
    │   ├── smb-director.js
    │   └── smb-save.js
    │
    ├── data/                        ← Pure data definitions, no logic
    │   ├── smb-data-arenas.js       ← ARENAS object
    │   ├── smb-data-weapons.js      ← WEAPONS object
    │   ├── smb-data-classes.js      ← CLASSES, CLASS_AFFINITY
    │   └── smb-data.js              ← Combines above + pickSafeSpawn(), ARENA_KEYS_ORDERED
    │
    ├── combat/                      ← Damage pipeline, projectiles, particles
    │   ├── smb-particles.js         ← Particle/DamageText/VerletRagdoll helpers
    │   └── smb-combat.js            ← dealDamage(), Projectile class, heatmap
    │
    ├── ai/                          ← Navigation and intelligence
    │   ├── smb-map-analyzer.js
    │   ├── smb-pathfinding.js
    │   ├── smb-adaptive-ai.js
    │   └── smb-sovereign-mk2.js
    │
    ├── fighter/                     ← Base fighter class
    │   ├── smb-fighter.js           ← Fighter class (physics, combat, draw)
    │   └── smb-enemies.js           ← Minion, ForestBeast, Yeti, Dummy, applyClass()
    │
    ├── boss/                        ← Boss and TrueForm
    │   ├── smb-boss.js              ← Boss class only (lines 6–910 of current file)
    │   ├── smb-trueform.js          ← TrueForm class only (extracted from current smb-boss.js)
    │   └── smb-trueform-attacks.js  ← All ~20 TF attack case handlers (from _doSpecial)
    │
    ├── cinematics/                  ← All cinematic systems
    │   ├── smb-cinematics.js        ← CinematicManager, cinScript(), CinFX, CinCam
    │   ├── smb-finishers.js
    │   ├── smb-cinematic.js         ← Impact hit-stop/zoom
    │   ├── smb-qte.js
    │   └── smb-trueform-ending.js
    │
    ├── rendering/                   ← All draw functions
    │   ├── smb-drawing.js           ← Core pipeline: drawBackground dispatcher, drawPlatforms,
    │   │                               checkDeaths(), endGame(), HUD, menuBgLoop, edge indicators
    │   └── smb-drawing-arenas.js    ← All 24 arena-specific draw functions (extracted)
    │
    ├── entities/                    ← Non-fighter game entities
    │   ├── smb-paradox.js
    │   └── smb-multiverse.js
    │
    ├── story/                       ← THE BIG WIN — story split
    │   ├── smb-story-registry.js    ← const STORY_CHAPTER_REGISTRY = []
    │   ├── smb-story-engine.js      ← STORY_ENEMY_CONFIGS, STORY_UNLOCKS, STORY_FIGHT_SCRIPTS,
    │   │                               STORY_SKILL_TREE, STORY_WORLDS, STORY_ARCS,
    │   │                               STORY_ABILITIES2, all engine functions,
    │   │                               load-time IIFEs (_story2Init, _restoreStoryStateAbilities,
    │   │                               _patchLaunchChapter2Fight)
    │   ├── smb-story-finalize.js    ← sort, validate, alias, promote, prebuild,
    │   │                               STORY_ACT_STRUCTURE (8 acts, exact runtime IDs),
    │   │                               _expandStoryChaptersInPlace() call
    │   ├── acts/                    ← 17 arc files total (2+2+3+2+2+2+2+2)
    │   │   ├── act0/                ← runtime id 'act0' | Act I   | ch 0–12
    │   │   │   ├── smb-act0-arc1.js    ← arc0-0: The Incident (ch 0–5)
    │   │   │   └── smb-act0-arc2.js    ← arc0-1: City Collapse (ch 6–12)
    │   │   ├── act1/                ← runtime id 'act1' | Act II  | ch 13–27
    │   │   │   ├── smb-act1-arc1.js
    │   │   │   └── smb-act1-arc2.js
    │   │   ├── act2/                ← runtime id 'act2' | Act III | ch 28–44
    │   │   │   ├── smb-act2-arc1.js
    │   │   │   ├── smb-act2-arc2.js
    │   │   │   └── smb-act2-arc3.js
    │   │   ├── act3/                ← runtime id 'act3' | Act IV  | ch 45–61
    │   │   │   ├── smb-act3-arc1.js
    │   │   │   └── smb-act3-arc2.js
    │   │   ├── act4mv/              ← runtime id 'act4mv' | Act V (Multiversal) | ch 62–69
    │   │   │   ├── smb-act4mv-arc1.js  ← folder name matches runtime id to avoid confusion
    │   │   │   └── smb-act4mv-arc2.js
    │   │   ├── act4/                ← runtime id 'act4' | Act VI  | ch 70–85
    │   │   │   ├── smb-act4-arc1.js
    │   │   │   └── smb-act4-arc2.js
    │   │   ├── act5/                ← runtime id 'act5' | Act VII | ch 86–88
    │   │   │   ├── smb-act5-arc1.js
    │   │   │   └── smb-act5-arc2.js
    │   │   └── act6/                ← runtime id 'act6' | Act VIII | ch 89–92
    │   │       ├── smb-act6-arc1.js
    │   │       └── smb-act6-arc2.js
    │
    ├── modes/                       ← Non-story game modes
    │   ├── smb-minigames.js
    │   └── smb-multiplayer-chaos.js
    │
    ├── ui/                          ← Menus and HUD
    │   ├── smb-achievements.js
    │   ├── smb-menu.js
    │   └── smb-designer.js
    │
    ├── net/                         ← Networking
    │   └── smb-network.js
    │
    ├── loop/                        ← Game loop
    │   └── smb-loop.js
    │
    └── dev/                         ← Development tools only
        ├── smb-debug.js
        └── smb-attacktest.js
```

### Target File Size Limits

| Category | Max Lines | Rationale |
|----------|-----------|-----------|
| Data files (arenas, weapons) | 600 | Pure data; wide is OK |
| Story arc files | 400 | ~6–8 chapters per file |
| Class definitions | 500 | One class per file |
| Attack/ability registries | 400 | Case handlers only |
| Draw functions | 500 | Group by type |
| Engine/loop files | 800 | Complex but singular responsibility |

---

## 2. File Splitting Strategy

### THE BIG WIN: Story System

#### Why This Matters

`smb-story.js` is 7,182 lines, 85% of which is raw chapter data. Adding chapter 93 means opening a 7,000-line file, scrolling past the entire engine to find the right spot, and risking corrupting code on either side. At 311 chapters, this file will exceed 22,000 lines.

#### The Registry Pattern (Works Without ES Modules)

This is the core technique. Each arc file **pushes** into a global array. No imports needed.

**Step 1 — `smb-story-registry.js`** (loaded first, before all act files):
```js
// smb-story-registry.js
// Initializes the chapter registry. Must load BEFORE any act file.
const STORY_CHAPTER_REGISTRY = [];
```

**Step 2 — Each arc file** (e.g., `acts/act0/smb-act0-arc1.js`):
```js
// smb-act0-arc1.js — Act I, Arc 1: The Incident (Chapters 0–5)
// Depends on: smb-story-registry.js (STORY_CHAPTER_REGISTRY must exist)
(function() {
    const chapters = [
        {
            id: 0,
            title: 'The First Crack',
            arenaKey: 'city',
            enemyWeapon: 'sword',
            // ... all chapter properties
        },
        {
            id: 1,
            // ...
        },
        // chapters 2–5
    ];
    chapters.forEach(ch => STORY_CHAPTER_REGISTRY.push(ch));
})();
```

The IIFE `(function() { ... })()` keeps all local variables scoped. Only `STORY_CHAPTER_REGISTRY.push()` touches the global.

**Step 3 — `smb-story-finalize.js`** (loaded AFTER `smb-story-engine.js` and all act files):
```js
// smb-story-finalize.js
// Loads AFTER smb-story-engine.js AND all arc data files.
// Calls engine helpers — do NOT reorder relative to smb-story-engine.js.

// Step 1: Sort registry by id and validate no gaps
STORY_CHAPTER_REGISTRY.sort((a, b) => a.id - b.id);

STORY_CHAPTER_REGISTRY.forEach((ch, i) => {
    if (ch.id !== i) console.error(`[Story] id mismatch: index ${i} has id ${ch.id}`);
});

// Step 2: Expose backward-compatible alias (engine refs use this name)
const STORY_CHAPTERS2 = STORY_CHAPTER_REGISTRY;

// Step 3: Promote noFight chapters to exploration chapters (sets noFight=false, type='exploration')
//         Must run before expansion. Epilogues are explicitly skipped and remain unchanged.
_promotePassiveStoryChapters();

// Step 4: Phase prebuild — parity with live code; caches .phases on original chapter objects
//         for any caller that reads the property directly outside the expansion path.
//         NOTE: _expandStoryChaptersInPlace() rebuilds phases independently on its own copy;
//         this loop is NOT a dependency for expansion correctness.
for (const _ch of STORY_CHAPTERS2) {
    if (_ch && !_ch.isEpilogue) _storyBuildPhases(_ch);
}

// Step 5: Act/Arc structure — must live here, NOT inside any arc file
//         IDs match the live runtime values exactly (including the non-sequential 'act4mv')
const STORY_ACT_STRUCTURE = [
    { id: 'act0',   label: 'Act I — Fracture Point',             color: '#88aacc',
      arcs: [ { id: 'arc0-0', label: 'The Incident',      chapterRange: [0,  5]  },
               { id: 'arc0-1', label: 'City Collapse',    chapterRange: [6,  12] } ] },
    { id: 'act1',   label: 'Act II — Into the Wound',            color: '#7744cc',
      arcs: [ { id: 'arc1-0', label: 'Fracture Network',  chapterRange: [13, 19] },
               { id: 'arc1-1', label: 'The Core',         chapterRange: [20, 27] } ] },
    { id: 'act2',   label: 'Act III — The Architects',           color: '#33aa44',
      arcs: [ { id: 'arc2-0', label: 'Multiversal Core',  chapterRange: [28, 34] },
               { id: 'arc2-1', label: 'Forest & Ice',     chapterRange: [35, 41] },
               { id: 'arc2-2', label: 'Ruins & Collapse', chapterRange: [42, 44] } ] },
    { id: 'act3',   label: 'Act IV — The Architects\\' War',     color: '#cc7722',
      arcs: [ { id: 'arc3-0', label: 'The Assembly',      chapterRange: [45, 51] },
               { id: 'arc3-1', label: 'The Fracture Within', chapterRange: [52, 61] } ] },
    { id: 'act4mv', label: 'Act V — Multiversal Ascension',      color: '#bb88ff',
      arcs: [ { id: 'arc4mv-0', label: 'War & Flux',      chapterRange: [62, 65] },
               { id: 'arc4mv-1', label: 'Shadow & Titan', chapterRange: [66, 69] } ] },
    { id: 'act4',   label: 'Act VI — Into the Architecture',     color: '#dd3344',
      arcs: [ { id: 'arc4-0', label: 'The Creator\\'s Threshold', chapterRange: [70, 77] },
               { id: 'arc4-1', label: 'The Final Architecture',  chapterRange: [78, 85] } ] },
    { id: 'act5',   label: 'Act VII — True Form',                color: '#cc44ff',
      arcs: [ { id: 'arc5-0', label: 'Into the Void',     chapterRange: [86, 86] },
               { id: 'arc5-1', label: 'Final Confrontation', chapterRange: [87, 88] } ] },
    { id: 'act6',   label: 'Act VIII — Godfall',                 color: '#ffaa00',
      arcs: [ { id: 'arc6-0', label: 'The Signal',        chapterRange: [89, 90] },
               { id: 'arc6-1', label: 'The Fallen God',   chapterRange: [91, 92] } ] },
];

// Step 6: Expand chapters in-place — also rebuilds STORY_ACT_STRUCTURE chapterRanges
_expandStoryChaptersInPlace();
```

**Step 4 — `smb-story-engine.js`** (loaded before finalize, before the game loop):
Contains `STORY_ENEMY_CONFIGS`, `STORY_UNLOCKS`, `STORY_FIGHT_SCRIPTS`, `STORY_SKILL_TREE`, `STORY_WORLDS`, `STORY_ARCS`, `STORY_ABILITIES2`, all engine functions (`openStoryMenu()`, `closeStoryMenu()`, `_launchChapter2FightImmediate()`, `storyOnMatchEnd()`, `storyTickFightScript()`, `_expandStoryChaptersInPlace()`, `_storyBuildPhases()`, `_promotePassiveStoryChapters()`, etc.), and all three load-time IIFEs (`_story2Init`, `_restoreStoryStateAbilities`, `_patchLaunchChapter2Fight`).

#### Adding a New Chapter (After Migration)

1. Open the correct arc file (e.g., `acts/act5/smb-act5-arc2.js`)
2. Add one chapter object to the `chapters` array
3. Add one `<script>` tag in `index.html` if it's a new arc file
4. Done — no 7,000-line file to navigate

#### Adding Chapter 311

1. Create `acts/actN/smb-actN-arcM.js` if a new act/arc is needed
2. Add the `<script>` tag before `smb-story-engine.js` / `smb-story-finalize.js`
3. Push chapters into `STORY_CHAPTER_REGISTRY`
4. The auto-sort in finalize handles ordering

---

### Boss System Split (`smb-boss.js` → 3 files)

The audit confirmed a clean split at line 911 (TrueForm class start).

**`boss/smb-boss.js`** (lines 6–910 of current file, ~905 lines):
```js
// Boss class definition only.
// Depends on: smb-fighter.js (Fighter base class)
class Boss extends Fighter {
    constructor(...) { ... }
    getPhase() { ... }
    attack(target) { ... }
    updateAI() { ... }
    _bossFireSpecial() { ... }
    _dominanceMoment() { ... }
}
// Boss-specific helper globals (bossBeams[], resetBossWarnings(), etc.)
```

**`boss/smb-trueform.js`** (~2,141 lines of class definition):
```js
// TrueForm class definition.
// Depends on: smb-fighter.js, smb-boss.js (does NOT extend Boss, extends Fighter directly)
class TrueForm extends Fighter {
    constructor(...) { ... }
    updateAI() { ... }
    _selectWeightedSpecial() { ... }
    _doSpecial(name) { ... }   // dispatcher only — delegates to smb-trueform-attacks.js handlers
    _trackPlayerProfile() { ... }
    _adaptBehavior() { ... }
    draw(ctx) { ... }
}
```

**`boss/smb-trueform-attacks.js`** (~400 lines, attack case handlers):
```js
// TrueForm attack implementations.
// Depends on: smb-trueform.js (TF_ATTACK_HANDLERS added to TrueForm.prototype or registry)
// Pattern: each handler is a function that receives (tf, target) and executes the attack.

const TF_ATTACK_HANDLERS = {
    meteor:      (tf, target) => { /* meteor crash logic */ },
    gravPulse:   (tf, target) => { /* gravity pulse logic */ },
    dimension:   (tf, target) => { /* dimension shift */ },
    clone:       (tf, target) => { /* shadow clones */ },
    grasp:       (tf, target) => { /* void grasp */ },
    chain:       (tf, target) => { /* chain slam */ },
    neutronStar: (tf, target) => { /* neutron star */ },
    galaxySweep: (tf, target) => { /* galaxy sweep */ },
    // ... all others
};

// TrueForm._doSpecial() becomes a one-liner:
// TrueForm.prototype._doSpecial = function(name) { TF_ATTACK_HANDLERS[name]?.(this, this.target); }
```

**`boss/smb-boss-helpers.js`** (~3,700 lines of post-class code from current `smb-boss.js`):
Must load between `smb-boss.js` and `smb-trueform.js` in `index.html`. Contains:

| System | Called from |
|--------|------------|
| `updateCinematic()` | `smb-loop.js:299` (every frame) |
| `startCinematic()`, `endCinematic()` | `smb-boss.js` internal, `smb-paradox.js:386` |
| `resetBossWarnings()` | `smb-menu.js:1317` |
| `drawBossWarnings()` | `smb-loop.js:764` |
| `updateTFBlackHoles()` | `smb-loop.js:654` |
| `drawTFBlackHoles()` | `smb-loop.js:747` |
| `updateTFGammaBeam()` | `smb-loop.js:663` |
| `drawTFGammaBeam()` | `smb-loop.js:758` |
| Remaining TF update/draw systems | `smb-loop.js:654–764` block |
| Cinematic camera, slowMotion, phase-shift helpers | `smb-loop.js`, `smb-drawing.js` |

Note: `drawBossBeams()` (`smb-drawing.js:2004`) and boss spike/shockwave logic (`smb-loop.js:562`) stay in their current files.

---

### Drawing System Split (`smb-drawing.js` → 2 files)

The audit found 24 arena-specific draw functions (~2,000 lines). They have no inter-dependencies on each other, but they DO read gameplay globals.

**`rendering/smb-drawing-arenas.js`** (new file, ~2,000 lines):
```js
// Arena-specific background draw functions.
// Depends on: smb-globals.js
//   globals used: ctx, GAME_W, GAME_H, frameCount, currentArena,
//                 players, bossFloorState, bossFloorType, tfFloorRemoved

function drawSoccerArena(ctx) { ... }
function drawVoidArena(ctx) { ... }
function drawCreatorArena(ctx) { ... }
function drawForest(ctx) { ... }
function drawIce(ctx) { ... }
// ... all 24 arena functions
```

**`rendering/smb-drawing.js`** (reduced to ~2,000 lines):
- Core pipeline: `drawBackground()` dispatcher, `drawPlatforms()`, `checkDeaths()`, `endGame()`
- HUD, boss overlays, cinematic overlays, edge indicators
- `menuBgLoop()`

`drawBackground()` already calls the arena functions by name — no changes needed to the dispatcher after moving the functions.

---

### Fighter System (Lowest Priority — Already Manageable)

`smb-fighter.js` at 3,154 lines has 6 logical groups but **they are tightly coupled** (AI methods reference physics properties set in the constructor; draw methods reference combat state). Splitting Fighter is high-risk for low gain.

**Recommended:** Do not split Fighter. Instead, add section header comments:

```js
// ============================================================
// SECTION: Constructor & Core Properties (lines 7–117)
// ============================================================

// ============================================================
// SECTION: Physics & Movement (lines 119–699)
// ============================================================

// ============================================================
// SECTION: Combat System (lines 888–1298)
// ============================================================

// ============================================================
// SECTION: AI Decision Making (lines 1329–1947)
// ============================================================

// ============================================================
// SECTION: Rendering (lines 2438–3154)
// ============================================================
```

This costs nothing, breaks nothing, and makes navigation and AI context loading much easier.

---

## 3. Architecture Rules

### Rule 1 — Max File Size by Category

| Category | Hard Limit |
|----------|-----------|
| Story arc files | 400 lines |
| Class definition files | 600 lines |
| Attack/handler registries | 400 lines |
| Arena draw functions | 600 lines per file |
| Engine/orchestration files | 800 lines |
| Data-only files | 700 lines |

If a file is approaching its limit, it's a signal to extract the next logical chunk — not a catastrophe. The limits exist to make AI context loading efficient, not as strict compiler errors.

### Rule 2 — One Responsibility Per File

Each file answers exactly one question:
- "What is a Fighter?" → `smb-fighter.js`
- "What does Act I, Arc 2 contain?" → `smb-act0-arc2.js`
- "How does TrueForm's meteor attack work?" → `smb-trueform-attacks.js`
- "What does the city arena look like?" → `smb-drawing-arenas.js`

If a file answers two questions, split it.

### Rule 3 — Data Files Have No Logic

`smb-data-arenas.js`, `smb-data-weapons.js`, `smb-data-classes.js` contain only plain object/array definitions. No function calls, no `if` statements, no references to `canvas` or `ctx`. They are inert until read.

### Rule 4 — No Cross-System Direct Calls

Systems communicate through globals and the `dealDamage()` pipeline, not by calling each other's internal functions directly.

| Allowed | Not Allowed |
|---------|------------|
| `dealDamage(attacker, target, ...)` | `target._comboCount++` from outside Fighter |
| `startCinematic(cinScript(...))` | Manually setting `activeCinematic` from a story file |
| `players[0].health` read | Calling `Fighter._getMeleeArcPoints()` from drawing code |

### Rule 5 — Registry Pattern for Extensible Collections

Any collection that grows over time (chapters, arena keys, achievement definitions, chaos events) uses the registry pattern:

```js
// In the registry-owner file (loaded first):
const MY_REGISTRY = [];

// In contributor files (loaded after):
MY_REGISTRY.push({ id: ..., ... });

// In the finalizer file (loaded last):
MY_REGISTRY.sort(...);
const MY_EXPORTED_NAME = MY_REGISTRY; // backward-compatible alias
```

Apply to: story chapters, achievements, chaos events, finisher definitions.

### Rule 6 — Load Order Is the Dependency Graph

The `<script>` tag order in `index.html` IS the dependency declaration. When adding a file, its position in `index.html` communicates: "this file depends on everything above it."

Document this at the top of every new file:
```js
// smb-act0-arc1.js
// Depends on: smb-story-registry.js
// Must load: BEFORE smb-story-finalize.js
```

---

## 4. AI Optimization Layer

### The Core Problem

When Claude or Codex opens a 7,000-line file to edit one chapter, the entire file loads into context. This wastes tokens on irrelevant data and increases the chance of an edit breaking something in a distant part of the file.

### Solution: Entry Points + Section Headers

Each system folder gets an `_index.md` file — a map of what's inside, not loaded into the game, only read by AI.

```
story/
├── _index.md           ← "Act I is in act0/, chapters 0–12. Act II is in act1/, chapters 13–27. Engine in smb-story-engine.js."
├── smb-story-engine.js
├── smb-story-registry.js
└── acts/
    ├── act0/
    │   ├── _index.md   ← "Arc 1 (ch 0–5) in smb-act0-arc1.js. Arc 2 (ch 6–12) in smb-act0-arc2.js."
    │   ├── smb-act0-arc1.js
    │   └── smb-act0-arc2.js
```

**How an AI should navigate:**
1. Read `story/_index.md` → find which arc file contains the target chapter
2. Open only that arc file (~300 lines)
3. Edit the single chapter object
4. Done — 300 lines in context vs 7,000

### Section Headers for Unsplit Files

For files like `smb-fighter.js` that won't be split, use machine-readable section anchors:

```js
// @section: Physics & Movement
// @section-end: Physics & Movement
```

An AI (or a grep) can then request just the physics section by searching for the anchor and reading until the end marker.

### Per-System Entry Points

| System | Entry Point | What It Tells AI |
|--------|------------|-----------------|
| Story | `story/_index.md` | Which file has which chapters |
| Boss | `boss/_index.md` | Boss class vs TrueForm vs attacks |
| Combat | `combat/_index.md` | dealDamage pipeline, projectile system |
| Rendering | `rendering/_index.md` | Core pipeline vs arena-specific draws |
| Cinematics | `cinematics/_index.md` | cinScript API, QTE, finishers |

### Partial Context Loading Rules

When asking Claude to modify a system, only provide:

| Task | Files to Include in Context |
|------|---------------------------|
| Fix chapter 47's dialogue | `smb-act3-arc1.js` only |
| Add a new TrueForm attack | `smb-trueform-attacks.js` + TrueForm constructor property list |
| Fix boss beam damage | `smb-boss.js` + `dealDamage()` signature |
| Add new arena | `smb-data-arenas.js` + `smb-drawing-arenas.js` (two small files) |
| Fix hitbox detection | `smb-fighter.js` combat section only |

This is only possible when files are small enough to contain one thing.

---

## 5. Migration Plan

**Guiding principle:** Each step must leave the game working. No "big bang" refactors.

### Phase 0 — Preparation (1 session, zero risk)

- [ ] Add `// @section:` headers to `smb-fighter.js` (non-invasive)
- [ ] Create all `_index.md` files for each folder (docs only, no code changes)
- [ ] Update `docs/architecture.md` with the new folder structure
- [ ] Create the `js/story/`, `js/boss/`, `js/rendering/`, `js/core/` etc. directories (empty)

### Phase 1 — Story Split (Highest Value, Lowest Risk)

The story data is pure data — no executable side effects. Safe to split first.

**Step 1.1 — Extract chapter data**
1. Open `smb-story.js`
2. Copy lines 1079 to end (chapter data + `STORY_ACT_STRUCTURE`)
3. Identify natural arc boundaries by chapter id
4. Create one arc file per arc (see folder structure above)
5. Each arc file uses the IIFE + push pattern

**Step 1.2 — Create registry + finalize files**
1. Create `smb-story-registry.js` with `const STORY_CHAPTER_REGISTRY = []`
2. Create `smb-story-finalize.js` with sort + validation + `STORY_CHAPTERS2` alias + `_promotePassiveStoryChapters()` + parity phase prebuild + `STORY_ACT_STRUCTURE` + `_expandStoryChaptersInPlace()`

**Step 1.3 — Extract engine**
1. Move engine code, all seven story data globals, and all three load-time IIFEs from `smb-story.js` into `smb-story-engine.js`
2. Delete the original `smb-story.js`

**Step 1.4 — Update index.html**
```html
<!-- Replace: <script src="js/smb-story.js"></script> -->
<!-- With: -->
<script src="js/story/smb-story-registry.js"></script>
<!-- 17 arc data files (2+2+3+2+2+2+2+2) — all push to STORY_CHAPTER_REGISTRY -->
<script src="js/story/acts/act0/smb-act0-arc1.js"></script>
<!-- ... all 17 arc files in chapter-id order ... -->
<script src="js/story/acts/act6/smb-act6-arc2.js"></script>
<!-- engine MUST come before finalize — finalize calls _expandStoryChaptersInPlace() -->
<!-- engine's load-time IIFEs do not reference STORY_CHAPTERS2 so order is safe -->
<script src="js/story/smb-story-engine.js"></script>
<script src="js/story/smb-story-finalize.js"></script>
```

**Step 1.5 — Validate**
- Open game, navigate to Story Mode
- Verify chapter count in story menu matches expected
- Verify `STORY_CHAPTERS2.length > 93` after expansion
- Arc mapping check: do NOT use raw chapter ids as `_story2.chapter` after expansion. Instead:
  `const expIdx0 = STORY_CHAPTERS2.findIndex(ch => ch._origId === 0);`
  `const expIdx52 = STORY_CHAPTERS2.findIndex(ch => ch._origId === 52);`
  `const expIdx87 = STORY_CHAPTERS2.findIndex(ch => ch._origId === 87);`
  `_story2.chapter = expIdx0; console.assert(_getCurrentArcId() === 'arc0-0');`
  `_story2.chapter = expIdx52; console.assert(_getCurrentArcId() === 'arc3-1');`
  `_story2.chapter = expIdx87; console.assert(_getCurrentArcId() === 'arc5-1');`
- Promotion check: a chapter that was originally `noFight === true && isEpilogue !== true` now has `noFight === false` and `type === 'exploration'`
- Epilogue check: chapters with `isEpilogue === true` still have `noFight === true`
- Run: `node -e "..."` id-invariant check (now automated in finalize)

### Phase 2 — Arena Draw Split (High Value, Low Risk)

**Step 2.1**
1. Create `js/rendering/smb-drawing-arenas.js`
2. Move all 24 arena-specific functions from `smb-drawing.js` into it
3. Leave `drawBackground()` dispatcher in place — it calls them by name, which will now resolve from the other file

**Step 2.2 — Update index.html**
```html
<!-- Add BEFORE smb-drawing.js: -->
<script src="js/rendering/smb-drawing-arenas.js"></script>
<script src="js/rendering/smb-drawing.js"></script>
```

**Step 2.3 — Validate**
- Open game in every arena type
- Verify all backgrounds render
- Check no "is not defined" errors in console
- Boss arena in all 3 phases — verify phase-2/3 lightning renders
- `bossFloorState = 'hazard'` in void arena — verify lava floor renders
- `tfFloorRemoved = true` in void arena — verify rising lava renders

### Phase 3 — Boss / TrueForm Split (Medium Risk)

This is higher risk because `TrueForm` and `Boss` share the same file and some helper functions.

**Step 3.1 — Audit shared helpers**
Identify all functions between line 3052 and the end of the file that are called by BOTH Boss and TrueForm. Do not move these yet.

**Step 3.2 — Extract TrueForm attacks**
1. Extract all case handlers from `TrueForm._doSpecial()` into `smb-trueform-attacks.js`
2. Replace each case body with a call: `TF_ATTACK_HANDLERS[name]?.(this, this.target);`
3. Test TrueForm fight — verify all attacks fire

**Step 3.3 — Extract TrueForm class**
1. Move TrueForm class definition (lines 911–3051) to `boss/smb-trueform.js`
2. Move TrueForm-only helper functions that follow (check no Boss code calls them)
3. Leave Boss class + Boss helpers in `boss/smb-boss.js`

**Step 3.4 — Update index.html**
```html
<!-- Replace: <script src="js/smb-boss.js"></script> -->
<!-- With (strict dependency order): -->
<script src="js/boss/smb-boss.js"></script>
<script src="js/boss/smb-boss-helpers.js"></script>
<script src="js/boss/smb-trueform.js"></script>
<script src="js/boss/smb-trueform-attacks.js"></script>
```

**Step 3.5 — Validate**
- Full Boss fight, all 3 phases + cinematics
- Full TrueForm fight — trigger at least 10 different attacks
- QTE phases at 75/50/25/10%
- TrueForm ending cinematic

### Phase 4 — Folder Reorganization (Cosmetic, Lowest Risk)

Move existing small files into the new subfolder structure. Update `index.html` paths. No code changes.

```
js/smb-globals.js     → js/core/smb-globals.js
js/smb-audio.js       → js/core/smb-audio.js
js/smb-pathfinding.js → js/ai/smb-pathfinding.js
js/smb-network.js     → js/net/smb-network.js
js/smb-debug.js       → js/dev/smb-debug.js
// etc.
```

Update `<script src="js/smb-globals.js">` → `<script src="js/core/smb-globals.js">` for each moved file.

**Do this one folder at a time. Test after each folder.**

---

## 6. What Not To Do

| Temptation | Why To Avoid |
|------------|-------------|
| Split `smb-fighter.js` into separate physics/AI/draw files | Fighter methods are highly coupled to each other's state; partial class definitions break `this` context |
| Use ES modules (`import/export`) | Requires a bundler (Vite, Webpack) — a full infrastructure change, not a refactor |
| Migrate to TypeScript | Requires a build step + complete retyping of all globals — separate major project |
| Rewrite any system during migration | Migration and rewriting are different tasks; mixing them causes untraceable regressions |
| Move more than one phase at a time | Phase N must be fully validated before Phase N+1 begins |
| Remove `smb-story.js` before all arc files are tested | Keep the old file as `smb-story.BACKUP.js` until story mode is 100% validated |

---

## 7. Future-Proofing for 311+ Chapters

After migration, adding chapter 100–311 is:

1. Find the right arc file (or create a new one if arc is full)
2. Add a chapter object to the `chapters` array
3. If it's a new arc file: add one `<script>` tag before `smb-story-finalize.js`
4. The sort + validation in finalize catches any id mistakes

**To support 311 chapters cleanly:**
- Act 7+ would get their own act folders
- Each arc stays under 400 lines (~6–8 chapters)
- Total story files: ~45 arc files × ~300 lines = 13,500 lines instead of one 22,000-line file
- Any single chapter is reachable in under 5 seconds via `story/actN/smb-actN-arcM.js`

---

## Optional: Adding a Build Step (Future Decision)

If the project eventually needs TypeScript or tree-shaking, the migration above is the prerequisite. After all files are small and logically separated:

1. Add Vite as a dev dependency (zero config, no webpack)
2. Rename `.js` to `.ts` incrementally
3. Replace `<script>` tags with a single `<script type="module" src="main.ts">`
4. Add `import` statements following the same dependency order already established

**This is not part of the current plan** — it's a separate project that becomes feasible after Phase 1–4 are complete.

---

## Expected Outcomes

| Metric | Before | After (Phases 1–4) |
|--------|--------|---------------------|
| Largest file | 7,182 lines | ~800 lines |
| Story system | 1 file | ~15–20 files, each <400 lines |
| Files >1000 lines | 5 | 2 (`smb-fighter.js`, `smb-loop.js` with section headers) |
| Time to find chapter 47 | 5 min (scroll 7k file) | 10 sec (open `smb-act3-arc1.js`) |
| AI context for story edit | ~7,000 tokens | ~300 tokens |
| AI context for attack edit | ~6,800 tokens | ~400 tokens |
| Risk of cross-file corruption | High (monolithic) | Low (isolated) |
