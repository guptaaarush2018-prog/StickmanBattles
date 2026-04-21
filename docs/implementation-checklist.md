# Implementation Checklist — Stickman Battles Refactor

**Execute steps in exact order. Never skip ahead. Test after every step.**

---

## Phase 0 — Bootstrap (Zero Game Risk)

### Step 0.1 — Add load-order guard file

**Files:** Create `js/smb-load-guard.js`; edit `index.html`

**Change:**
```js
// js/smb-load-guard.js
// Must be the FIRST script loaded after smb-errorboundary.js.
// Provides a namespace registry and load-order assertion helper.
(function() {
    window.SMB = window.SMB || {};

    // Registry of loaded modules — each file calls SMB.loaded('filename')
    SMB._loadedModules = new Set();
    SMB.loaded = function(name) { SMB._loadedModules.add(name); };

    // Assertion: call at the TOP of a file that depends on another
    SMB.requires = function(name) {
        if (!SMB._loadedModules.has(name)) {
            console.error('[SMB Load Guard] Missing dependency: "' + name + '". Check <script> order in index.html.');
        }
    };
})();
```

In `index.html`, insert **immediately after** `smb-errorboundary.js`:
```html
<script src="./js/smb-load-guard.js"></script>
```

Then add `SMB.loaded('smb-globals')` as the **last line** of `smb-globals.js`.

**Why safe:** Pure addition. Existing code is untouched. If `SMB` already exists (it won't), the `||` guard prevents overwrite.

**Test:** Open game → open DevTools console → type `SMB._loadedModules` → should show a Set with at least `'smb-globals'`. Game must run normally.

**What could go wrong:** `window.SMB` name collision with existing global. Check first: `grep -r "window.SMB\b" js/` before applying.

---

### Step 0.2 — Create directory structure (empty folders only)

**Files:** New directories only, no code changes.

```bash
mkdir -p Stickman-Battles/js/core
mkdir -p Stickman-Battles/js/data
mkdir -p Stickman-Battles/js/combat
mkdir -p Stickman-Battles/js/ai
mkdir -p Stickman-Battles/js/fighter
mkdir -p Stickman-Battles/js/boss
mkdir -p Stickman-Battles/js/cinematics
mkdir -p Stickman-Battles/js/rendering
mkdir -p Stickman-Battles/js/entities
mkdir -p Stickman-Battles/js/story/acts/act1
mkdir -p Stickman-Battles/js/story/acts/act2
mkdir -p Stickman-Battles/js/story/acts/act3
mkdir -p Stickman-Battles/js/story/acts/act4
mkdir -p Stickman-Battles/js/story/acts/act5
mkdir -p Stickman-Battles/js/story/acts/act6
mkdir -p Stickman-Battles/js/modes
mkdir -p Stickman-Battles/js/ui
mkdir -p Stickman-Battles/js/net
mkdir -p Stickman-Battles/js/loop
mkdir -p Stickman-Battles/js/dev
```

**Why safe:** Empty folders. Zero code impact.

**Test:** `ls js/` shows new subdirectories. Game still runs.

**What could go wrong:** Nothing. This is pure filesystem.

---

### Step 0.3 — Add section headers to smb-fighter.js

**Files:** `js/smb-fighter.js`

**Change:** Insert comment banners at the start of each logical group. Do NOT move or reorder any code.

```js
// ================================================================
// @section: Constructor & Core Properties
// ================================================================
// ... (line 7, constructor starts here)

// ================================================================
// @section: Physics & Movement
// ================================================================
// ... (line ~119, cx/cy helpers start here)

// ================================================================
// @section: Combat System
// ================================================================
// ... (line ~888, attack() starts here)

// ================================================================
// @section: AI Decision Making
// ================================================================
// ... (line ~1329, computeUtility() starts here)

// ================================================================
// @section: Rendering
// ================================================================
// ... (line ~2438, draw() starts here)
```

**Why safe:** Comments only. No logic changed.

**Test:** `node --check js/smb-fighter.js` → no errors. Game runs.

**What could go wrong:** Accidentally editing code while inserting comments. Use search to find exact line numbers before editing.

---

## Phase 2 — Arena Draw Extraction

*Do Phase 2 before Phase 1 — it's the lowest-risk extraction and builds confidence.*

### Step 2.1 — Identify exact arena function boundaries

**Files:** Read only. `js/smb-drawing.js`

**Change:** None. Run this to confirm line ranges:
```bash
grep -n "^function draw" js/smb-drawing.js
```

**Expected arena-only functions (to move):**
| Function | Approx Line |
|----------|------------|
| `drawSoccerArena` | 283 |
| `drawVoidArena` | 295 |
| `drawCreatorArena` | 363 |
| `drawStars` | 450 |
| `drawClouds` | 462 |
| `drawLava` | 501 |
| `drawCityBuildings` | 525 |
| `drawForest` | 558 |
| `drawIce` | 590 |
| `drawRuins` | 625 |
| `drawCaveArena` | 2906 |
| `drawMirrorArena` | 2955 |
| `drawUnderwaterArena` | 3067 |
| `drawVolcanoArena` | 3109 |
| `drawColosseumArena` | 3158 |
| `drawCyberpunkArena` | 3196 |
| `drawHauntedArena` | 3257 |
| `drawCloudsArena` | 3310 |
| `drawNeonGridArena` | 3345 |
| `drawMushroomArena` | 3388 |
| `drawMegacityArena` | 3438 |
| `drawWarpzoneArena` | 3463 |
| `drawColosseum10Arena` | 3488 |
| `drawHomeYardArena` | 3518 |
| `drawHomeAlleyArena` | 3631 |
| `drawSuburbArena` | 3783 |
| `drawRuralArena` | 3832 |
| `drawPortalEdgeArena` | 3901 |
| `drawRealmEntryArena` | 3940 |
| `drawBossSanctumArena` | 3971 |

**Functions to KEEP in smb-drawing.js (core pipeline):**
`generateBgElements`, `drawBackground` (dispatcher), `drawPlatforms`, `drawStoryVoidFog`, `drawStoryBoundaryWarning`, `drawAbilityUnlockToast`, `drawExploreHUD`, `drawStoryPhaseHUD`, `drawExploreGoalObject`, `drawSecretLetters`, `drawEntityOverlays`, `drawBossDialogue`, `drawBossBeams`, `drawCinematicOverlay`, `drawPhaseTransitionRings`, `drawBossSpikes`, `drawAccessory`, `drawCurseAuras`, `drawSpartanRageEffects`, `drawClassEffects`, `drawBossDeathScene`, `drawFakeDeathScene`, `drawStorySubtitle`, `drawStoryOpponentHUD`, `drawMirrorGimmickOverlay`, plus `checkDeaths`, `endGame`, `menuBgLoop`, `gameLoop` (if present).

**Why safe:** Read-only step.

**What could go wrong:** Nothing.

---

### Step 2.2 — Create js/rendering/smb-drawing-arenas.js

**Files:** Create `js/rendering/smb-drawing-arenas.js`

**Change:** New file containing ONLY the arena functions listed in Step 2.1. Header:
```js
'use strict';
// smb-drawing-arenas.js — Arena-specific background draw functions
// Depends on: smb-globals.js (ctx, GAME_W, GAME_H, frameCount, currentArena)
// Note: drawStars(), drawClouds(), drawLava(), drawCityBuildings() are
//       arena helpers co-located here since they serve arena draws only.
// Must load BEFORE smb-drawing.js (so drawBackground dispatcher can call these)
```

**Procedure:**
1. Copy the exact text of each arena function from smb-drawing.js
2. Paste into the new file in the same order they appear in smb-drawing.js
3. Do NOT modify any function body

**Why safe:** The original file is unchanged. This step only creates a new file.

**Test:** `node --check js/rendering/smb-drawing-arenas.js` → no errors.

**What could go wrong:** Partial copy — missing closing brace. Always verify function count: `grep -c "^function " js/rendering/smb-drawing-arenas.js` should equal the count of arena functions above.

---

### Step 2.3 — Delete arena functions from smb-drawing.js

**Files:** `js/smb-drawing.js`

**Change:** Remove the exact lines of each arena function from smb-drawing.js. Delete each function from its `function` keyword to its closing `}`.

**Procedure:**
1. Work from BOTTOM of file to TOP (line numbers stay stable when editing downward)
2. Delete `drawBossSanctumArena` first (line ~3971), then upward
3. In the "early" block (lines 283–654), delete `drawSoccerArena` through `drawRuins` last

**Why safe:** Each function is referenced only by name at runtime. As long as the new file loads before the dispatcher calls them (which it will — all scripts are loaded before `gameLoop` runs), removing from this file is safe.

**Test:** `node --check js/smb-drawing.js` → no errors. Confirm line count dropped significantly.

**What could go wrong:** Accidental deletion of `drawPlatforms` (line 656) or other non-arena functions. After deletion, verify these critical functions still exist:
```bash
grep -n "^function drawPlatforms\|^function drawBackground\|^function checkDeaths\|^function endGame" js/smb-drawing.js
```

---

### Step 2.4 — Insert script tag in index.html

**Files:** `index.html`

**Change:** Add the new script tag BEFORE the existing `smb-drawing.js` line:

```html
<!-- Arena-specific background draw functions (must load before smb-drawing.js) -->
<script src="./js/rendering/smb-drawing-arenas.js"></script>
<!-- Drawing, game state, HUD, visual effects -->
<script src="./js/smb-drawing.js"></script>
```

**Why safe:** Browser loads scripts sequentially. By the time `drawBackground()` is ever called (at runtime), both files are already loaded. Adding a script tag before an existing one is purely additive.

**What could go wrong:** Typo in path. Test immediately.

---

### Step 2.5 — Validate Phase 2

**Test procedure:**
1. `python3 -m http.server 8080` → open `http://localhost:8080/index.html`
2. Open DevTools console — no `ReferenceError: drawSoccerArena is not defined` or similar
3. Enter every arena in the arena selector — confirm backgrounds render
4. Start a boss fight — `drawCreatorArena` must render the purple platform arena
5. Check story mode — `drawVoidArena`, `drawForest`, `drawIce`, `drawRuins` must render
6. `grep -c "^function " js/rendering/smb-drawing-arenas.js` — confirm expected count
7. `grep -c "^function " js/smb-drawing.js` — confirm reduced count

**Rollback:** If anything breaks, delete `js/rendering/smb-drawing-arenas.js`, restore the deleted lines in `smb-drawing.js` (from git: `git checkout js/smb-drawing.js`), remove the added `<script>` tag.

---

## Phase 1 — Story Registry Split

*Highest value. 85% of smb-story.js is pure data (6,100 lines). Extracting it makes the story system AI-navigable.*

### Step 1.1 — Create js/story/smb-story-registry.js

**Files:** Create `js/story/smb-story-registry.js`

**Change:**
```js
'use strict';
// smb-story-registry.js — Initialises the chapter registry array.
// MUST load BEFORE any smb-act*.js file.
// MUST load BEFORE smb-story-finalize.js.
// Does NOT modify STORY_CHAPTERS2 (that is set by smb-story-finalize.js).

const STORY_CHAPTER_REGISTRY = [];
SMB.loaded('smb-story-registry');
```

**Why safe:** New global `STORY_CHAPTER_REGISTRY`. Existing `STORY_CHAPTERS2` is untouched. No behaviour changes.

**Test:** `node --check js/story/smb-story-registry.js` → no errors.

---

### Step 1.2 — Create js/story/smb-story-finalize.js

**Files:** Create `js/story/smb-story-finalize.js`

**Change:**
```js
'use strict';
// smb-story-finalize.js — Runs AFTER all act files have pushed their chapters.
// Sorts registry, validates id===index invariant, exposes STORY_CHAPTERS2 alias.
// MUST load AFTER all smb-act*.js files.
// MUST load BEFORE smb-story.js (which contains the engine functions).

(function() {
    // Sort by id to allow arc files to be loaded in any order
    STORY_CHAPTER_REGISTRY.sort(function(a, b) { return a.id - b.id; });

    // Validate id === index invariant
    var errors = 0;
    STORY_CHAPTER_REGISTRY.forEach(function(ch, i) {
        if (ch.id !== i) {
            console.error('[SMB Story] Chapter id mismatch: array index ' + i + ' has id=' + ch.id);
            errors++;
        }
    });
    if (errors === 0) {
        console.log('[SMB Story] Registry OK — ' + STORY_CHAPTER_REGISTRY.length + ' chapters loaded.');
    }
})();

// Backward-compatible alias — ALL existing code using STORY_CHAPTERS2 continues to work unchanged
const STORY_CHAPTERS2 = STORY_CHAPTER_REGISTRY;

SMB.loaded('smb-story-finalize');
```

**Why safe:** Creates `STORY_CHAPTERS2` as a reference alias. As long as this loads BEFORE `smb-story.js`, the engine sees the same array it always did.

**Test:** `node --check js/story/smb-story-finalize.js` → no errors.

---

### Step 1.3 — Identify the engine/data boundary in smb-story.js

**Files:** Read only. `js/smb-story.js`

**Change:** None. Confirm line numbers:
```bash
grep -n "^const STORY_CHAPTERS2" js/smb-story.js
grep -n "^const STORY_ACT_STRUCTURE" js/smb-story.js
grep -n "^const STORY_ENEMY_CONFIGS" js/smb-story.js
```

**Expected:** `STORY_CHAPTERS2` at line ~1079. `STORY_ACT_STRUCTURE` somewhere after 4000. Engine functions in lines 1–1078.

**Why safe:** Read-only.

---

### Step 1.4 — Extract engine to js/story/smb-story-engine.js

**Files:** `js/smb-story.js` → copy lines 1–1078 to new file

**Change:** Create `js/story/smb-story-engine.js` with the content of lines 1 through (but not including) `const STORY_CHAPTERS2 = [`.

Header to add at top:
```js
// smb-story-engine.js — Story mode engine: menus, chapter launch, event bus.
// Depends on: smb-globals.js, smb-story-finalize.js (STORY_CHAPTERS2 must exist)
// NOTE: STORY_CHAPTERS2 and STORY_ACT_STRUCTURE are NOT defined here —
//       they come from smb-story-finalize.js and the act files.
```

**Why safe:** This is a COPY step — the original `smb-story.js` is not yet modified. Both files coexist temporarily.

**Test:** `node --check js/story/smb-story-engine.js` → no errors (some reference errors expected because STORY_CHAPTERS2 doesn't exist in isolation — that's OK; node --check only checks syntax).

---

### Step 1.5 — Create first arc file as template

**Files:** Create `js/story/acts/act1/smb-act1-arc1.js`

**Change:** Extract chapters 0–5 from `smb-story.js` (starting at `const STORY_CHAPTERS2 = [` and finding the first 6 chapter objects). Wrap in the registry push pattern:

```js
'use strict';
// smb-act1-arc1.js — Act I, Arc 1: The Incident (Chapters 0–5)
// Depends on: smb-story-registry.js (STORY_CHAPTER_REGISTRY must exist)
// Must load BEFORE smb-story-finalize.js
(function() {
    var chapters = [
        // --- PASTE CHAPTER 0 OBJECT HERE (from STORY_CHAPTERS2[0]) ---
        {
            id: 0,
            // ... exact content from smb-story.js
        },
        // --- PASTE CHAPTERS 1–5 ---
    ];
    chapters.forEach(function(ch) { STORY_CHAPTER_REGISTRY.push(ch); });
    SMB.loaded('smb-act1-arc1');
})();
```

**Why safe:** This is additive. `smb-story.js` still defines the full `STORY_CHAPTERS2` and is still loaded. The registry arc file exists but `smb-story-finalize.js` is not yet wired into `index.html`, so `STORY_CHAPTER_REGISTRY` is never used yet.

**Test:** `node --check js/story/acts/act1/smb-act1-arc1.js` → no syntax errors.

---

### Step 1.6 — Create all remaining arc files

**Files:** Create one file per arc (14 total) following the exact pattern from Step 1.5.

| File | Chapters | Arc Name |
|------|---------|---------|
| `act1/smb-act1-arc1.js` | 0–5 | The Incident |
| `act1/smb-act1-arc2.js` | 6–12 | City Collapse |
| `act1/smb-act1-arc3.js` | 13–19 | Fracture Network |
| `act2/smb-act2-arc1.js` | 20–27 | The Core |
| `act2/smb-act2-arc2.js` | 28–34 | Multiversal Core |
| `act3/smb-act3-arc1.js` | 35–41 | Forest & Ice |
| `act3/smb-act3-arc2.js` | 42–44 | Ruins & Collapse |
| `act4/smb-act4-arc1.js` | 45–51 | The Assembly |
| `act4/smb-act4-arc2.js` | 52–61 | Fracture Within |
| `act5/smb-act5-arc1.js` | 62–65 | War & Flux |
| `act5/smb-act5-arc2.js` | 66–69 | Shadow & Titan |
| `act6/smb-act6-arc1.js` | 70–77 | Creator's Threshold |
| `act6/smb-act6-arc2.js` | 78–85 | Final Architecture |
| `act6/smb-act6-arc3.js` | 86–92 | Into the Void → Fallen God |

Also extract `STORY_ACT_STRUCTURE` and `STORY_ENEMY_CONFIGS` + `STORY_UNLOCKS` + `STORY_FIGHT_SCRIPTS` into `js/story/smb-story-data.js`:
```js
'use strict';
// smb-story-data.js — Scalar story constants (not chapter objects)
// Depends on: smb-globals.js
const STORY_ENEMY_CONFIGS = { ... };
const STORY_UNLOCKS = { ... };
const STORY_FIGHT_SCRIPTS = { ... };
const STORY_ACT_STRUCTURE = [ ... ];
SMB.loaded('smb-story-data');
```

**Why safe:** All additive. Original `smb-story.js` still runs. Arc files push into the registry which is not yet connected to the engine.

**Test:** `node --check` every arc file. Confirm no syntax errors. Confirm chapter counts:
```bash
grep -c "id:" js/story/acts/act1/smb-act1-arc1.js  # should be 6
```

---

### Step 1.7 — Wire arc files into index.html (shadow run)

**Files:** `index.html`

**Change:** Add new script tags in a block BEFORE the existing `smb-story.js` tag. The existing tag remains — both run in parallel temporarily:

```html
<!-- STORY REGISTRY (new modular system) -->
<script src="./js/story/smb-story-data.js"></script>
<script src="./js/story/smb-story-registry.js"></script>
<script src="./js/story/acts/act1/smb-act1-arc1.js"></script>
<script src="./js/story/acts/act1/smb-act1-arc2.js"></script>
<script src="./js/story/acts/act1/smb-act1-arc3.js"></script>
<script src="./js/story/acts/act2/smb-act2-arc1.js"></script>
<script src="./js/story/acts/act2/smb-act2-arc2.js"></script>
<script src="./js/story/acts/act3/smb-act3-arc1.js"></script>
<script src="./js/story/acts/act3/smb-act3-arc2.js"></script>
<script src="./js/story/acts/act4/smb-act4-arc1.js"></script>
<script src="./js/story/acts/act4/smb-act4-arc2.js"></script>
<script src="./js/story/acts/act5/smb-act5-arc1.js"></script>
<script src="./js/story/acts/act5/smb-act5-arc2.js"></script>
<script src="./js/story/acts/act6/smb-act6-arc1.js"></script>
<script src="./js/story/acts/act6/smb-act6-arc2.js"></script>
<script src="./js/story/acts/act6/smb-act6-arc3.js"></script>
<script src="./js/story/smb-story-finalize.js"></script>
<!-- STORY ENGINE (engine functions — unchanged from original) -->
<script src="./js/story/smb-story-engine.js"></script>
<!-- LEGACY (kept until registry is fully validated — remove after Step 1.9) -->
<script src="./js/smb-story.js"></script>
```

**Why safe:** `smb-story.js` still loads. `STORY_CHAPTERS2` is now defined twice (once by finalize, once by smb-story.js). The engine uses whichever is in scope. This is intentional for the shadow-run validation step.

**Test:** Open game. Open DevTools console. Run:
```js
STORY_CHAPTER_REGISTRY.length  // should equal total chapter count (93)
STORY_CHAPTERS2.length          // should also equal 93
STORY_CHAPTER_REGISTRY[47].id  // should be 47
```
Play story mode. Launch chapter 0, chapter 47, last chapter. Verify they work.

---

### Step 1.8 — Remove smb-story.js duplicate definitions

**Files:** `js/smb-story.js`

**Change:** Delete `const STORY_CHAPTERS2 = [` through the closing `];` of the array. Also delete `STORY_ACT_STRUCTURE`, `STORY_ENEMY_CONFIGS`, `STORY_UNLOCKS`, `STORY_FIGHT_SCRIPTS` blocks (they now live in `smb-story-data.js`). The remaining file is ONLY engine functions (~1,078 lines).

**Why safe:** The registry system is now active and validated. The engine functions that remain are identical to those in `smb-story-engine.js`, so both load the same functions. That's fine — function re-declarations overwrite silently.

**Test:** Same as Step 1.7. All story chapters must still work.

---

### Step 1.9 — Remove legacy smb-story.js from index.html

**Files:** `index.html`, `js/smb-story.js`

**Change:**
1. Remove `<script src="./js/smb-story.js"></script>` from `index.html`
2. Rename (don't delete) `smb-story.js` → `smb-story.BACKUP.js` as insurance

**Why safe:** All engine functions now live in `smb-story-engine.js` which is already loaded. Chapter data lives in arc files + registry.

**Test (critical):**
- Open story menu — all chapters visible
- Play chapter 0 (prologue) — fight launches, dialogue fires, level completes
- Play chapter 47 — enemy scaling correct, fight completes
- Play chapter 92 (last) — completes correctly
- Type `STORY_CHAPTERS2.length` in console — correct count
- `STORY_CHAPTERS2[0].id === 0` → true

**Rollback if broken:** Restore `<script src="./js/smb-story.js"></script>` (or rename backup back).

---

### Step 1.10 — Validate Phase 1

**Checklist:**
- [ ] `STORY_CHAPTER_REGISTRY` and `STORY_CHAPTERS2` have identical contents
- [ ] Chapter ids 0 through N-1 are all present with no gaps (finalize logs this)
- [ ] Story menu shows correct chapter list with correct act/arc grouping
- [ ] Playing chapters across all 6 acts works (sample: 0, 14, 30, 55, 70, 88)
- [ ] `smb-story.js` removed from index.html, backup kept
- [ ] Each arc file passes `node --check`
- [ ] No `ReferenceError` or `const STORY_CHAPTERS2 has already been declared` in console

---

## Phase 3 — Boss / TrueForm Split

### Step 3.1 — Audit shared helpers in smb-boss.js

**Files:** Read only. `js/smb-boss.js`

**Change:** None. Identify:
```bash
grep -n "^function \|^class \|^const \|^let \|^var " js/smb-boss.js | head -60
```
Confirm the Boss class boundary (lines ~6–910) and TrueForm class boundary (lines ~911–3051). Note any helper functions after line 3051 that are called by BOTH classes — do not move these in this phase.

---

### Step 3.2 — Extract TrueForm attack handlers

**Files:** Create `js/boss/smb-trueform-attacks.js`

**Change:** Create a registry of attack handler functions:
```js
'use strict';
// smb-trueform-attacks.js — TrueForm attack case implementations
// Depends on: smb-globals.js, smb-particles.js (dealDamage, spawnParticles)
// Must load BEFORE smb-boss.js (TrueForm._doSpecial references TF_ATTACK_HANDLERS)

const TF_ATTACK_HANDLERS = {};

TF_ATTACK_HANDLERS.meteor = function(tf, target) {
    // ... exact body of 'meteor' case from TrueForm._doSpecial()
};

TF_ATTACK_HANDLERS.gravPulse = function(tf, target) {
    // ... exact body
};

// ... all other attack cases
```

**Procedure:** For each `case 'X':` in `TrueForm._doSpecial()`, extract the body into `TF_ATTACK_HANDLERS.X = function(tf, target) { ... }`.

In `smb-boss.js`, replace `_doSpecial(name)` body with:
```js
_doSpecial(name) {
    if (TF_ATTACK_HANDLERS[name]) {
        TF_ATTACK_HANDLERS[name](this, this.target);
    } else {
        console.warn('[TrueForm] Unknown special: ' + name);
    }
}
```

**Why safe:** Pure refactor of internals. External API (`_doSpecial`) unchanged. Load `smb-trueform-attacks.js` BEFORE `smb-boss.js` in index.html.

**Test:** Full TrueForm fight. Trigger at least: meteor, shadow clones, gravity well, gamma beam, void grasp. All must function.

---

### Step 3.3 — Extract TrueForm class to js/boss/smb-trueform.js

**Files:** Create `js/boss/smb-trueform.js`; edit `js/smb-boss.js`

**Change:**
1. Copy TrueForm class definition (line ~911 to ~3051) into new file
2. Add TrueForm-only helper functions that follow (identify by checking they're NOT called by Boss)
3. Remove those lines from `smb-boss.js`

New file header:
```js
'use strict';
// smb-trueform.js — TrueForm class (extends Fighter, adaptive boss)
// Depends on: smb-fighter.js, smb-trueform-attacks.js, smb-globals.js
```

In `index.html`, after the new `smb-trueform-attacks.js` tag:
```html
<script src="./js/boss/smb-trueform-attacks.js"></script>
<script src="./js/smb-boss.js"></script>
<script src="./js/boss/smb-trueform.js"></script>
```

**Why safe:** TrueForm does NOT extend Boss — it extends Fighter directly. The only dependency is `Fighter` being defined (which smb-fighter.js loads before). Removing TrueForm from smb-boss.js reduces it to the Boss class only.

**Test:**
- Full Boss fight (all 3 phases, cinematics at 75/50/40/10%)
- Full TrueForm fight (adaptive AI, QTE at checkpoints, all 20+ attacks, ending cinematic)
- `typeof TrueForm === 'function'` → true
- `typeof Boss === 'function'` → true

---

### Step 3.4 — Validate Phase 3

- [ ] Boss fight: phase transitions, beams, minion spawns, floor hazard, death cinematic
- [ ] TrueForm fight: adaptation level grows, attack variety, QTE fires, ending sequence
- [ ] `smb-boss.js` line count < 1,500 (Boss class only)
- [ ] `smb-trueform.js` < 2,500 lines
- [ ] `smb-trueform-attacks.js` < 500 lines
- [ ] No `ReferenceError` for Boss, TrueForm, or any TF attack handler

---

## Phase 4 — Folder Reorganization

*Cosmetic. Move files to subfolders. Update paths in index.html. Do one folder per commit.*

### Step 4.1 — Move core files

Move these files and update paths in `index.html`:

| From | To |
|------|----|
| `js/smb-errorboundary.js` | `js/core/smb-errorboundary.js` |
| `js/smb-load-guard.js` | `js/core/smb-load-guard.js` |
| `js/smb-globals.js` | `js/core/smb-globals.js` |
| `js/smb-audio.js` | `js/core/smb-audio.js` |
| `js/smb-director.js` | `js/core/smb-director.js` |
| `js/smb-save.js` | `js/core/smb-save.js` |

Test: Game runs. No 404s in Network tab.

### Step 4.2 — Move AI files

| From | To |
|------|----|
| `js/smb-map-analyzer.js` | `js/ai/smb-map-analyzer.js` |
| `js/smb-pathfinding.js` | `js/ai/smb-pathfinding.js` |
| `js/smb-adaptive-ai.js` | `js/ai/smb-adaptive-ai.js` |
| `js/smb-sovereign-mk2.js` | `js/ai/smb-sovereign-mk2.js` |

### Step 4.3 — Move cinematic files

| From | To |
|------|----|
| `js/smb-cinematics.js` | `js/cinematics/smb-cinematics.js` |
| `js/smb-finishers.js` | `js/cinematics/smb-finishers.js` |
| `js/smb-cinematic.js` | `js/cinematics/smb-cinematic.js` |
| `js/smb-qte.js` | `js/cinematics/smb-qte.js` |
| `js/smb-trueform-ending.js` | `js/cinematics/smb-trueform-ending.js` |
| `js/smb-cutscene.js` | `js/cinematics/smb-cutscene.js` |

### Step 4.4 — Move remaining files

| From | To |
|------|----|
| `js/smb-achievements.js` | `js/ui/smb-achievements.js` |
| `js/smb-menu.js` | `js/ui/smb-menu.js` |
| `js/smb-designer.js` | `js/ui/smb-designer.js` |
| `js/smb-network.js` | `js/net/smb-network.js` |
| `js/smb-loop.js` | `js/loop/smb-loop.js` |
| `js/smb-debug.js` | `js/dev/smb-debug.js` |
| `js/smb-attacktest.js` | `js/dev/smb-attacktest.js` |
| `js/smb-minigames.js` | `js/modes/smb-minigames.js` |
| `js/smb-multiplayer-chaos.js` | `js/modes/smb-multiplayer-chaos.js` |
| `js/smb-multiverse.js` | `js/modes/smb-multiverse.js` |
| `js/smb-paradox.js` | `js/entities/smb-paradox.js` |
| `js/smb-data.js` | `js/data/smb-data.js` |
| `js/smb-particles.js` | `js/combat/smb-particles.js` |
| `js/smb-fighter.js` | `js/fighter/smb-fighter.js` |
| `js/smb-enemies.js` | `js/fighter/smb-enemies.js` |
| `js/smb-drawing.js` | `js/rendering/smb-drawing.js` |
| `js/smb-boss.js` | `js/boss/smb-boss.js` |

**Rule:** Move ONE group per step. Test after each group. Use `git mv` to preserve history.

---

## Global Namespace Strategy

### What SMB provides (from Step 0.1)

```js
window.SMB = {
    _loadedModules: Set,
    loaded(name),     // called at end of each file
    requires(name),   // called at top of files with strict deps
}
```

### Gradual adoption

Add `SMB.loaded('module-name')` to the last line of each file as you touch it. Do NOT bulk-add across all files at once — only add when a file is already being modified for another reason.

Priority order (highest value for AI navigation):
1. `smb-story-registry.js` — already included in Step 1.1
2. `smb-story-finalize.js` — already included in Step 1.2
3. Each arc file — already included in Steps 1.5–1.6
4. `smb-trueform-attacks.js` — already included in Step 3.2
5. `smb-globals.js` — add in Step 0.1

### What NOT to do
- Do NOT create `SMB.fighters`, `SMB.boss`, etc. as namespaced replacements for globals — that's a full rewrite, not a refactor. The namespace is a metadata layer only.

---

## Load-Order Validation Rules

Add this pattern to any file where a missing dependency would cause a silent failure:

```js
// At TOP of smb-story-engine.js:
if (typeof STORY_CHAPTERS2 === 'undefined') {
    console.error('[SMB] smb-story-engine.js loaded before smb-story-finalize.js — chapter data missing!');
}

// At TOP of smb-trueform.js:
if (typeof Fighter === 'undefined') {
    console.error('[SMB] smb-trueform.js loaded before smb-fighter.js!');
}

// At TOP of smb-trueform-attacks.js:
// (none needed — it defines TF_ATTACK_HANDLERS proactively)
```

---

## Final Validation — All Phases Complete

Run this checklist after all phases:

**File sizes:**
```bash
wc -l js/rendering/smb-drawing.js        # target < 2,100
wc -l js/rendering/smb-drawing-arenas.js # target ~1,900
wc -l js/boss/smb-boss.js                # target < 1,500
wc -l js/boss/smb-trueform.js            # target < 2,500
wc -l js/boss/smb-trueform-attacks.js    # target < 500
wc -l js/story/smb-story-engine.js       # target ~1,100
wc -l js/story/acts/act1/smb-act1-arc1.js # target < 400
```

**Functional smoke tests:**
- [ ] Main menu loads
- [ ] 2P local match starts, plays, ends
- [ ] Boss fight: 3 phases, cinematics, win screen
- [ ] TrueForm fight: QTE fires, adapts, ending cinematic
- [ ] Story Mode: chapters 0, 14, 47, 92 all launch and complete
- [ ] Online lobby: can create/join a room
- [ ] Minigames: Survival, KotH both start
- [ ] All arenas render backgrounds (spot-check 6 arenas)
- [ ] No `ReferenceError` or `const X has already been declared` in DevTools console
- [ ] `SMB._loadedModules.size > 5` (confirms guard system active)
