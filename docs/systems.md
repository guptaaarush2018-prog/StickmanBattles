# Systems — Stickman Battles

## Overview

Each system is isolated in its own module but communicates via globals. Read `architecture.md` for load order. This document covers the behavior and internal design of each major system.

---

## 1. Combat System

**Entry point:** `dealDamage()` in `smb-particles.js`

The single authoritative pipeline for all damage. Never apply damage by directly mutating `target.health`.

**Pipeline (in order):**
1. Guard checks (cinematic active, target invincible, godmode, ally check)
2. Damage multipliers (attacker `dmgMult`, story power level, class affinity, rage stacks, map perks, curses, armor)
3. Knockback scaling (`kbForce × (1 + actualDmg × 0.028)`)
4. Shield interaction (dmg → 8%, KB → 15% when shielding)
5. Hit-stop assignment (light 2–4f, medium 4–7f, heavy 8–11f, cosmic 11–14f)
6. Screen feedback (shake, vignette, slowmo on heavy hits)
7. State changes (stun, knockback direction, invincible frames)
8. Online sync (`NetworkManager.sendHit()`)
9. Finisher check (on killing blow)
10. Achievement tracking

See `combat.md` for full detail.

---

## 2. Physics System

Lives inside `Fighter.update()` and `checkPlatform()`.

- **Gravity:** applied every frame as `vy += gravity * gravDir`
- **Gravity constant:** 0.65 normal; 0.30 low-gravity arenas; 0.90 heavy-gravity arenas
- **Velocity limits:** vx capped ±12; vy uncapped upward, capped at +18 falling
- **Platform AABB:** penetration-depth resolution; sets `onGround = true`, resets vy
- **Coyote time:** 6 frames grace after leaving a platform edge before fall state
- **Double jump:** available to all fighters; resets on landing
- **Lava:** `lavaBurnTimer` increments while below `lavaY`; 2 damage/frame after 60f delay
- **TrueForm gravity inversion:** `gravDir = -1`; bounce at `y < 0` (ceiling becomes floor)
- **Icy arenas:** `vx *= 0.997` (near-zero friction); horizontal momentum persists

---

## 3. AI System

**Standard AI** — `Fighter.updateAI()` (runs every 15 frames, `AI_TICK_INTERVAL`)

States: `'chase'` → `'attack'` → `'evade'` → `'wander'`

Intent modifiers: `'pressure'` / `'reposition'` / `'bait'` / `'retreat'`

Key behaviors:
- Edge avoidance: 100px buffer, jump-away with 25% chance
- Aerial tracking: pursues airborne targets with jump-toward logic
- Ranged: burst-fire with heat/cooldown, strafes while shooting
- Shield use: blocks on `SHIELD_CD` cooldown (not spammable)
- Input buffer: `_pendingAction` queues one deferred action per tick

**Boss AI** — `Boss.updateAI()` (every 15 frames)

- Phase-scaled aggression: Phase 3 ≈ 2× attack frequency
- Deferred attacks with telegraphs (ground slam, gravity pulse)
- Post-special pause: 3-tick recovery window after each special
- Stagger mechanic: 120+ damage in 3 seconds triggers a 2.5-second stun
- Idle guard: forces a special move if 12+ ticks with no action
- Reads player behavior: fleeing, standing still, high/low position, ranged spam

**TrueForm Adaptive AI** — `TrueForm.updateAI()`

- `adaptationLevel` (0–100): grows over time; gates 6 attack tiers
- Profiling object (updated every 2s): `attackFrequency`, `jumpFrequency`, `dodgeFrequency`, `blockFrequency`, `distancePreference`, `repetitionScore`
- Anti-ranged phase: activates when ranged damage threshold reached; closes distance aggressively
- Debug: `tf adapt`, `tf profile`, `tf force <0-100>` in dev console

**AdaptiveAI / SovereignMk2** — `smb-adaptive-ai.js`, `smb-sovereign-mk2.js`

- Bigram sequence learning: tracks which 2-move combos the player repeats
- Spam punishment: detects repeated single moves and counters specifically
- Aggro-burst mode: periodic escalation window with increased speed and damage

**Pathfinding v4** — `smb-pathfinding.js`

- Arc-based: predicts parabolic jump arcs to reach target platforms
- Map Analyzer pre-computes platform adjacency graph at game start
- `pf*` helper functions called during AI tick for platform selection

---

## 4. Cinematic System

**See `cinematics.md` for full detail.**

- `CinematicManager` + `cinScript()` constructor (smb-cinematics.js)
- Declarative step-based sequences with `at:` timestamps (seconds)
- `CinFX`: shockwaves, particles, screen shake, flash, ground cracks
- `CinCam`: `setFocus`, `snap`, `orbit`, `midpoint`, `focusOn`
- `slowMotion` (0–1) scales physics time; `isCinematic` blocks new attacks
- Finisher system (`smb-finishers.js`) built on top of `CinematicManager`

---

## 5. Character Classes

Defined in `smb-data.js`, applied via `applyClass()` in `smb-enemies.js`.

Each class modifies base `Fighter` stats and optionally overrides ability/super behavior.

| Class | Key Trait |
|-------|-----------|
| Warrior | Balanced; bonus melee damage |
| Archer | Ranged power; penalty on melee |
| Paladin | Damage reduction passive (×0.85 incoming) |
| Berserker | Speed +20%; damage taken +15% |
| Kratos | Rage stacks (max 30); grows per hit taken |
| Assassin | Dash-cancel; high burst |
| Tank | High HP; heavy KB resistance |
| Mage | Ability spam; low base health |
| Gunner | Reload mechanic; clip system |
| Rogue | Stamina-based evasion |

**Class affinity:** `CLASS_AFFINITY` lookup in `smb-data.js` applies per-class damage multipliers for light/heavy/ranged weapon types.

---

## 6. Weapon System

16 weapons defined in `WEAPONS` in `smb-data.js`. Each weapon is a plain object attached to `Fighter.weapon`.

**Melee weapons:** sword, hammer, axe, spear
**Ranged weapons:** gun, bow, slingshot, peashooter, paper airplane
**Special weapons:** shield, scythe, frying pan, broomstick, boxing gloves, gauntlet (boss-only)

Key properties:
- `damage` / `damageFunc()` — fixed or random damage per hit
- `range` — hitbox reach in logical pixels
- `cooldown` / `endlag` — frames between attacks
- `kb` — knockback force multiplier
- `clipSize` / `reloadFrames` — ranged only
- `ability(user, target)` / `abilityCooldown` — Q-key special

Ranged specifics:
- Bullet spread increases with `_rangedShotHeat`
- Movement penalty while firing: `_rangedMovePenalty`
- Burst commit window: `_rangedCommitTimer`
- Clip depletes → auto-reload (`_reloadTimer`); movement interrupts reload

---

## 7. Arena System

18 arenas defined in `ARENAS` in `smb-data.js`.

**Arena flags:**
- `isLowGravity`, `isHeavyGravity`, `isIcy`, `isSlowMovement`
- `hasLava`, `lavaY` — burn zone
- `isBossArena` → locked to boss mode (`creator`)
- `isVoidArena` → locked to TrueForm mode (`void`)
- `isStoryOnly` → excluded from all non-story pickers
- `worldWidth: 3600` → large map with `mapLeft/mapRight` camera clamping

**Platform properties:**
- `isFloor` — ground reference for respawn
- `isFloorDisabled` — hazard state (boss floor spell)
- `isCeiling` — stops upward momentum
- `isBouncy` — `vy *= -1.4` on landing
- `oscX/oscY`, `oscSpeed`, `oscPhase` — oscillation animation

**Map perks** (some arenas):
- Forest: healing zone
- Ruins: item drops
- City: cars deal contact damage
- Lava: eruption columns

---

## 8. Particle & Effects System

`smb-particles.js` owns all visual effects.

- `spawnParticles(x, y, color, count, vx, vy)` — general burst
- `Projectile` — physics object with optional homing, bounce, chain-explosion
- `DamageText` — floating number; color-coded by damage tier
- `VerletRagdoll` — skeletal ragdoll via Verlet integration (death sequence)
- Heatmap system: tracks `Fighter._weaponTip` proximity; spawns sparks on clash (<28px)
- `checkWeaponSparks()` called each frame; 20-frame cooldown per pair

---

## 9. HUD System

All HUD drawing happens in `drawHUD()` inside `smb-drawing.js`, using the **identity transform** (screen-space, not game-space).

Elements:
- Health bars (color-coded per player)
- Super meters
- Lives indicators (or ∞ symbol in infinite mode)
- Win counters (infinite mode)
- Boss HP bar with phase markers
- Chaos mod badges (bottom-right, pulsing)
- Story chapter/phase indicator

---

## 10. Achievement System

`smb-achievements.js` — 20 achievements across combat, weapons, minigames, exploration, fun.

- `ACHIEVEMENTS` array: each entry has `id`, `name`, `desc`, `condition`
- `earnedAchievements` Set — persisted in `localStorage('smc_achievements')`
- `unlockAchievement(id)` — checks Set, saves, queues popup, plays sound
- `drawAchievementPopups()` — rendered screen-space in `gameLoop`
- `_achStats` object tracks per-match: `damageTaken`, `rangedDmg`, `consecutiveHits`, `superCount`, `winStreak`, `totalWins`, `matchStartTime`

---

## 11. Director System

`smb-director.js` — match intensity tracker (0–1).

- Reads player proximity, damage exchange rate, HP disparity
- Feeds into: camera lerp speed, damage boost when underdog, music tension
- `directorSchedule()` allows event-chain sequencing for future use
- `Director.intensity` can be read by any system for dynamic scaling

---

## 12. Save System

`smb-save.js` — persistent state via localStorage.

- Auto-saves on: game end, achievement unlock, story chapter complete
- `exportSave()` / `importSave()` — JSON blob download/upload
- Save includes: achievements, story progress, settings, unlock flags

---

## 13. Debug System

`smb-debug.js` — dev toolkit. Activated by F1 toggle or `debugmode` cheat.

- F2: slow-motion toggle
- In-game console: `_consoleExec()` parses typed commands
- Commands: `tf adapt`, `tf profile`, `tf force <n>`, `boss phase <n>`, `godmode`, `spawn <entity>`
- Console commands broadcast to all online players by default; prefix `--local` to skip broadcast
- `showAdaptationLevel`, `showPlayerProfile`, `forceAdaptationLevel` are exposed debug API on `TrueForm`
