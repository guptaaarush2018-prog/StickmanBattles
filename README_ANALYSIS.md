# Stickman Battles — Analysis Guide

A personal reference for navigating and reasoning about the codebase.

---

## Core Systems

| System | File(s) | Notes |
|--------|---------|-------|
| Fighter base class | `js/smb-fighter.js` | All fighters inherit from this — physics, input, draw |
| Combat / damage | `js/smb-particles.js` | `dealDamage()` is the single pipeline for all damage |
| Game loop | `js/smb-loop.js` | `gameLoop()`, `processInput()`, camera, cheat codes |
| Global state | `js/smb-globals.js` | Canvas, all game flags, TF state, online state — read this first |
| Director / flow | `js/smb-director.js` | Manages transitions between menus, modes, game states |
| Menu & start | `js/smb-menu.js` | `startGame()`, mode/arena selection, UI |
| Physics / spawning | `js/smb-fighter.js` | gravity, velocity, platform checks inside Fighter class |
| Pathfinding | `js/smb-pathfinding.js` | Bot nav — used by AI in `smb-enemies.js` |
| Adaptive AI | `js/smb-adaptive-ai.js` | Real-time player profiling, used by TrueForm |

---

## Weapons

All weapon data is in `js/smb-data.js` — `WEAPONS` object starting at line 1514.

| Weapon | Damage | Cooldown | Range | Notes |
|--------|--------|----------|-------|-------|
| Sword | 16 | 30 | 90 | Fast, balanced |
| Hammer | 22 | 62 | 80 | Highest raw damage, very slow |
| Gun | 9 | 32 | 600 | Random 1–3 dmg per bullet via `damageFunc` |
| Axe | 13 | 52 | 88 | Medium damage, slow |
| Spear | 15 | 44 | 140 | Long range melee |
| Bow | 0 (projectile) | 52 | 700 | Damage in projectile logic |
| Shield | 10 | 36 | 52 | Short range, defensive class weapon |
| Scythe | 12 | 44 | 100 | Arc swing |
| Frying Pan | 18 | 58 | 60 | High damage, heavy feel |
| Broomstick | 12 | 32 | 125 | Long reach, fast |
| Boxing Gloves | 9 | 20 | 50 | Fastest cooldown melee |
| Pea Shooter | 0 (projectile) | 18 | 700 | Fastest ranged fire rate |
| Slingshot | 0 (projectile) | 62 | 650 | Slow ranged |
| Paper Airplane | 0 (projectile) | 35 | 800 | Longest range |
| Gauntlet | 13 | 38 | 30 | Boss weapon |
| Mk. Gauntlets | 20 | 22 | 72 | Megaknight weapon — fast and high damage |
| Void Blade | 14 | 26 | 58 | TrueForm-adjacent |
| Shock Rifle | 8 | 36 | 600 | Ranged, status effect |

To find a weapon: search `smb-data.js` for the weapon key (e.g. `'gun'`, `'sword'`).

---

## Classes

All class data is in `js/smb-data.js` — `CLASSES` object starting at line 1846.

| Class | HP | Speed | Weapon | Perk |
|-------|----|-------|--------|------|
| None | 100 | 1.00 | Any | — |
| Thor | 112 | 0.90 | Hammer | Thunder on dash |
| Kratos | 110 | 0.95 | Axe | Rage at low HP |
| Ninja | 78 | 1.24 | Sword | Quick dash |
| Gunner | 92 | 1.06 | Gun | Dual shot |
| Archer | 82 | 1.20 | Bow | Auto-backstep at low HP |
| Paladin | 132 | 0.88 | Shield | 15% dmg reduction |
| Berserker | 115 | 1.08 | Any | Damage boost at low HP |
| Megaknight | 165 | 0.84 | Mk. Gauntlets | — |

Perks are applied in `js/smb-enemies.js` → `applyClass()`.

---

## Bosses

| Boss | File | HP | Notes |
|------|------|----|-------|
| Boss (3-phase) | `js/boss/smb-boss.js` | 2000 (base) | Phase transitions at 2000/1000 HP; beams, floor hazards, minion spawns |
| TrueForm | `js/boss/smb-trueform.js` + `js/boss/smb-trueform-attacks.js` | 5000 | Player-sized, adaptive AI, ~20 special attacks |
| Sovereign Mk2 | `js/smb-sovereign-mk2.js` | — | Separate boss system |

Boss cinematics: `js/boss/smb-boss-cinematics.js`
Boss visual effects: `js/boss/smb-boss-effects.js`
Boss helper utilities: `js/boss/smb-boss-helpers.js`
TrueForm ending: `js/smb-trueform-ending.js`

---

## Maps / Arenas

All arena data: `js/smb-data.js` — `ARENAS` object starting at line 6.
Arena backgrounds drawn in: `js/rendering/smb-drawing-arenas.js`

Arena categories:
- **Normal** — standard pick pool (grass, lava, space, city, etc.)
- **Online-only** — `isOnlineOnly: true` — Mega City, Warp Zone, Grand Colosseum
- **Boss-only** — `isBossArena: true` — Creator (boss), Void (TrueForm)
- **Story-only** — `isStoryOnly: true` — Home Yard, City Alley, Suburbs, Rural Fields, Portal Threshold, The New Realm, Sanctum of the Ruler

`creator` and `void` arenas are excluded from the normal arena picker and minigame pool.

---

## Combo System

Defined in `js/smb-particles.js` inside `dealDamage()`:

- **Combo window:** 45 frames between hits — miss it and `_comboHitCount` resets
- **Auto-launch:** 7+ hit combo forces a hard launcher and breaks the combo
- **Hitstun decay:** each successive hit reduces stun duration by 8% (floored at 28%)
- **Combo limiter:** tracked per-attacker via `_comboHitCount` and `_comboLastFrame`
- **TrueForm-specific:** `_comboDamage` caps damage dealt in a single combo to 85% of target's `maxHP`
- **Wall-combo escape:** TrueForm triggers an escape move if hit 3+ times near a boundary

This is a soft limiter — infinite combos are theoretically possible before the auto-launch kicks in at hit 7.

---

## AI Behavior

- Base bot logic: inside `Fighter` / `js/smb-enemies.js` (`updateAI()`)
- Pathfinding: `js/smb-pathfinding.js`
- Adaptive AI (TrueForm only): `js/smb-adaptive-ai.js` — profiles player attack patterns in real time
- Bot difficulty: `aiDiff` property on fighter (`'easy'`, `'medium'`, `'hard'`)
- Edge avoidance: 100px buffer with 25% jump-away chance
- KotH bots override `updateAI()` to rush the zone instead of engaging freely
- Minions: `dmgMult = 0.5`, die permanently (no respawn), `health = 50`

---

## Damage Flow

All damage must go through `dealDamage(attacker, target, dmg, kbForce)` in `js/smb-particles.js`.

Never write `target.health -= X` directly. The pipeline handles:
- Combo limiter
- Knockback
- Hit-stop frames (`hitStopFrames`)
- Multiplayer sync
- Shield checks
- Achievement tracking
- TrueForm-specific modifiers

---

## Spawn Rates

- **Minions:** spawned by Boss in `smb-boss.js` at phase thresholds
- **Yeti:** one at a time; minimum 900 frames (15s) after game start; 1200-frame (20s) cooldown after death — see `js/smb-enemies.js`
- **Forest Beast:** `dmgMult = 2.2` (very high damage output)
- **Survival waves:** wave logic in `js/smb-minigames.js`

---

## Cinematic System

- Manager + scripting: `js/smb-cinematics.js`
- Playback runtime: `js/smb-cinematic.js`
- Boss cinematics: `js/boss/smb-boss-cinematics.js`
- Finishers: `js/smb-finishers.js`
- QTE: `js/smb-qte.js`

Key globals: `activeCinematic`, `isCinematic`, `slowMotion`
Never trigger cinematics inside `dealDamage()` — set a flag, trigger at frame start.

---

## Multiplayer

- `js/smb-network.js` — NetworkManager using PeerJS/WebRTC
- `js/smb-multiplayer-chaos.js` — chaos extensions for multiplayer
- Topology: peer-to-peer (no dedicated game server — `server.js` is a relay only)
- Online-only arenas are larger maps flagged with `isLargeMap: true`
- See `docs/multiplayer.md` for full message type reference

---

## Story Mode

- Chapter registry: `js/story/smb-story-registry.js`
- Per-act arcs: `js/story/acts/` (act0–act6, side quests)
- Engine: `js/story/smb-story-engine.js`
- Config: `js/story/smb-story-config.js`
- Finalization: `js/story/smb-story-finalize.js`
- Story-only arenas: Home Yard, City Alley, Suburbs, Rural Fields, Portal Threshold, The New Realm, Sanctum of the Ruler

Rule: `id === index` must always hold in `STORY_CHAPTERS`. Check with the script in `CLAUDE.md`.

---

## Things That Feel Wrong (Honest Assessment)

**Combo system is softer than it seems.**
The auto-launch at hit 7 sounds like a hard cap, but hitstun decay is the real limiter — it just makes later hits feel less punishing rather than ending the combo. A fast fighter with Boxing Gloves (cooldown 20) can realistically chain 6 hits before the window expires. Whether that feels fair depends heavily on the matchup.

**Damage numbers are inconsistent with feel.**
Hammer (22 dmg, cooldown 62) is technically balanced against Sword (16 dmg, cooldown 30) on paper, but in practice the Hammer's 22 endlag frames means a missed swing gets you punished hard. Meanwhile Mk. Gauntlets (20 dmg, cooldown 22) feel overtuned — Megaknight gets Paladin HP (165) AND fast high-damage attacks.

**Megaknight's stat package is aggressive.**
165 HP is the highest in the game AND 20 dmg at cooldown 22. The `speedMult: 0.84` is the tradeoff but it's a light tax. Worth pressure-testing.

**Adaptive AI is TrueForm-only.**
`smb-adaptive-ai.js` profiles player patterns but is only wired to TrueForm. Regular bots use fixed `aiDiff` tiers with no in-match adaptation — which makes mid-difficulty fights feel predictable fast.

**Spawn rate documentation is thin.**
Minion spawn logic is embedded in `smb-boss.js`'s `updateAI()` with no centralized table. Boss phase thresholds, beam timers, and minion spawns are all scattered across the same long function — makes balance tuning harder than it needs to be.

**Story-only arenas are siloed.**
The 7 story arenas are completely inaccessible outside Story Mode (`isStoryOnly: true`). There's no sandbox or free-play way to revisit them, which limits replayability of the visual designs.

**Floor hazard cycle is slow to feel threatening.**
`normal → warning (300f) → hazard (900f) → normal` means the floor is actually dangerous for 900 frames (~15s at 60fps) out of a 1200-frame cycle (~50% uptime). Warning phase is long enough that experienced players can mostly ignore it.

---

## Useful Docs

| Doc | Purpose |
|-----|---------|
| `docs/architecture.md` | Full load order and global reference |
| `docs/systems.md` | All major systems overview |
| `docs/combat.md` | `dealDamage()` full pipeline |
| `docs/cinematics.md` | CinematicManager, cinScript, phases |
| `docs/multiplayer.md` | NetworkManager, message types |
| `docs/coding_standards.md` | How to add weapons, arenas, modes |
| `docs/roadmap.md` | What's planned and what's done |
| `docs/story-structure.md` | Chapter/arc layout |
| `docs/canon.md` | In-universe lore |
