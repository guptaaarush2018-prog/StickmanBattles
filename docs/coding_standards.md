# Coding Standards — Stickman Battles

## Core Rules (Non-Negotiable)

1. **Never break existing systems.** Patch, don't replace.
2. **Never use ES modules** (`import`/`export`). This is a globals-based codebase loaded by `<script>` tags in strict order.
3. **Never use classes that bypass the existing `Fighter` hierarchy.** Extend `Fighter` or one of its subclasses.
4. **All damage must go through `dealDamage()`.** Never mutate `target.health` directly.
5. **Never start a cinematic from inside `dealDamage()`.** Set a flag; trigger at frame start.
6. **All new entities must have null-safety guards.** If the entity could be missing, check first.

```js
// Correct
if (!boss || boss.health <= 0) return;

// Wrong — crashes if boss is null
boss.doSomething();
```

---

## Naming Conventions

### Variables & Functions

| Context | Convention | Example |
|---------|-----------|---------|
| Global state | `camelCase` | `gameRunning`, `bossFloorTimer` |
| Constants | `UPPER_SNAKE_CASE` | `GAME_W`, `AI_TICK_INTERVAL` |
| Private Fighter properties | `_camelCase` (underscore prefix) | `_comboCount`, `_lastPhase` |
| Event/flag Sets | `camelCase` + descriptive suffix | `_cinematicFired`, `phaseDialogueFired` |
| Cooldown timers | `camelCase` + `Cd` or `Timer` suffix | `beamCooldown`, `bossFloorTimer` |
| Boolean flags | Positive assertion | `isBoss`, `onGround`, `gameRunning` |
| Draw functions | `draw` prefix | `drawBossBeams()`, `drawHUD()` |
| Update functions | `update` prefix | `updateCamera()`, `updateQTE()` |
| Spawn functions | `spawn` prefix | `spawnParticles()`, `spawnBullet()` |

### Files

- Format: `smb-<system>.js` (e.g., `smb-boss.js`, `smb-particles.js`)
- One system per file
- File name must match its primary export or class name when readable

---

## File Organization

### Adding a New JS Module

1. Create `Stickman-Battles/js/smb-yourmodule.js`
2. Add a `<script src="js/smb-yourmodule.js"></script>` tag in `index.html` at the **correct position** in the load order
3. Document the module in `docs/architecture.md` (load order table)
4. Ensure your module only reads globals defined by files loaded before it
5. Verify with: `node --check Stickman-Battles/js/smb-yourmodule.js`

### Module Structure Template

```js
// ============================================================
// smb-yourmodule.js — One-line description of purpose
// Depends on: smb-globals.js, smb-particles.js (list load-order deps)
// ============================================================

// 1. Constants (UPPER_SNAKE_CASE, module-local)
const MY_CONSTANT = 42;

// 2. Module-level state (camelCase, prefix with system name if global)
let myModuleState = false;

// 3. Public functions (exposed as globals)
function myPublicFunction(arg) {
    if (!arg) return;  // always guard
    // ...
}

// 4. Internal helpers (prefix with _ if possible to reduce global pollution)
function _myHelper(x) {
    // ...
}
```

---

## How to Add New Systems

### New Weapon

1. Add entry to `WEAPONS` object in `smb-data.js`
2. Add `drawWeapon()` case in `smb-drawing.js`
3. Add key to `WEAPON_KEYS` filter array
4. Weapon `ability(user, target)` must check `if (!target) return;`

### New Arena

1. Add entry to `ARENAS` object in `smb-data.js`
2. Add draw case in `drawBackground()` in `smb-drawing.js`
3. Add to `ARENA_KEYS_ORDERED` for menu rotation (omit if story-only or boss-only)
4. Must include exactly one `isFloor: true` platform
5. Verify `pickSafeSpawn()` returns valid positions for your platform layout

### New Game Mode

Handle in all four locations:
1. `selectMode()` — `smb-menu.js`
2. `_startGameCore()` — `smb-menu.js`
3. `checkDeaths()` — `smb-drawing.js`
4. `endGame()` — `smb-drawing.js`

### New Console Command

Add a handler block in `_consoleExec()` in `smb-debug.js` **before** the "Unknown command" fallthrough line.

```js
if (cmd === 'mycommand') {
    // handler
    if (!cmd.includes('--local')) NetworkManager.sendGameEvent('consoleCmd', { cmd });
    return;
}
```

### New Achievement

Add entry to `ACHIEVEMENTS` array in `smb-achievements.js`. Increment tracking in `_achStats` where the condition can be observed. Call `unlockAchievement('myId')` at the correct trigger point.

### New Cinematic

Use `cinScript()` builder. Never hand-write frame-counter cinematics. See `docs/cinematics.md`.

---

## Performance Expectations

- **AI update rate:** Every 15 frames (`AI_TICK_INTERVAL`). Never every frame.
- **Particle count:** Keep burst spawns ≤ 40 particles. Larger explosions use fewer, faster particles.
- **Canvas operations:** Prefer `ctx.fillRect` over `ctx.arc` for bulk elements. Avoid `ctx.filter` (known to cause lag on city map).
- **String operations:** Don't allocate strings in the hot path (inside `gameLoop` per-entity). Cache dialogue strings.
- **Array iteration:** Use `for` loops over `forEach` for `players[]` and `particles[]` — these run 60× per second.
- **Globals over closures:** For hot-path state, prefer globals over closure captures for GC predictability.

---

## Safety Patterns

### Entity Existence Checks

```js
// Before using any entity
if (!entity || entity.health <= 0) return;

// Before iterating an array
for (let i = 0; i < players.length; i++) {
    const p = players[i];
    if (!p || p.health <= 0) continue;
    // ...
}
```

### Cinematic Guards

```js
// Prevent re-firing one-shot cinematics
if (_cinematicFired.has('myKey')) return;
_cinematicFired.add('myKey');
startCinematic(myScript);
```

### Online Safety

```js
// Skip remote players in local simulation
if (p.isRemote) continue;
```

### Arena Boundary Checks

```js
// Never hardcode pixel values — use GAME_W/GAME_H
const centerX = GAME_W / 2;
const bottomY = GAME_H - 20;
```

---

## Testing & Verification

- **Syntax check before committing:** `node --check Stickman-Battles/js/smb-yourfile.js`
- **Story chapter id invariant:** After editing `STORY_CHAPTERS2`, run:
  ```bash
  node -e "const m=require('fs').readFileSync('Stickman-Battles/js/smb-story.js','utf8').match(/const STORY_CHAPTERS2\s*=\s*\[([\s\S]*?)\];/); const ids=[...m[1].matchAll(/^\s*id:\s*(\d+),/gm)].map(x=>+x[1]); ids.forEach((id,i)=>id!==i&&console.log(i,id));"
  ```
- **Manual smoke tests (before any PR):**
  - Launch boss fight — verify cinematics trigger at 75/50/40/10% HP
  - Launch TrueForm — verify adaptive AI escalates; QTE fires at checkpoints
  - Launch story chapter — verify no null crashes in first 3 chapters
  - Test online: host + guest in 2-player mode; verify both can deal damage
