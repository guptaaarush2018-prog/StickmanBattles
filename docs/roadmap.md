# Roadmap — Stickman Battles

Items are ordered by impact and stability risk. High-priority items are closer to the current architecture; lower-priority items may require new infrastructure.

---

## Completed (v2.7.0 — Current)

- Multiverse Mode: 4 dimensional worlds (War-Torn, Gravity Flux, Shadow Realm, Titan World) with AI modifiers, encounter tiers, and Fallen God dialogue
- Ship Progression System: collect 5 ship parts across story chapters to unlock full fracture branch access
- Fracture System: 3 named fracture branches (Alpha/Null/Crimson), each with preview and full ruler-boss entry
- Lore Moment + Motivation Tracker: narrative context updates at key milestones
- Attack Test Sandbox: console-driven attack previewer + admin class kits for any player
- Arena rendering submodule: Soccer/Void draw calls split to js/rendering/smb-drawing-arenas.js

## Completed (v2.6.0)

- SOVEREIGN Ω AI: bigram sequence learning, spam punishment, aggro-burst mode
- Complete Randomizer mode: reroll arena, weapons, classes every death
- Story Online mode: story arenas + story rules for multiplayer
- Persistent Save System: localStorage export/import JSON
- Game Director: dynamic match intensity tracker (0–1) for pacing
- Cinematic Scripting v2: declarative `cinScript()` API replacing frame counters
- Pathfinding v4: predictive arc-based platform graph traversal
- Map Analyzer v2: static platform adjacency pre-computation
- Error Boundary module: friendly overlay on any module load failure
- YouTube iframe music: separate boss/normal tracks

---

## Priority 1 — Polish & Stability (Do First)

These are low-risk, high-value improvements that don't touch core systems.

- **Mobile control hit areas:** Increase touch target size for attack/ability buttons; current targets too small on small screens
- **Projectile sync (online):** Spawn-event-based sync currently relies on frame-perfect timing; add a position-correction packet for long-lived projectiles (arrows, paper airplanes)
- **Save file versioning:** Add a `version` field to the save blob so future schema changes can migrate gracefully
- **Arena background performance:** Some arenas (city, cyberpunk) generate per-frame canvas operations; profile and cache static layers
- **AI target switching in 3-player modes:** Boss occasionally locks onto dead Minion target; add `target.health > 0` guard in `updateAI()` target selection
- **QTE key prompt localization:** QTE shows keyboard keys; mobile players see wrong prompt — detect input device and show correct icon

---

## Priority 2 — Gameplay Depth

Medium-risk additions that extend existing systems without replacing them.

- **New arena: Desert / Quicksand** — Slow-sink hazard on floor; players partially buried reduce move speed; adds vertical urgency
- **New weapon: Whip** — Long-range melee that pulls enemies toward attacker; pairs well with edge-push mechanics
- **New class: Summoner** — Periodically spawns one weak familiar that attacks autonomously; class ability sends familiar on a charge
- **Boss Mode: 2v2** — Two players fight two Bosses simultaneously; requires `players[]` to hold 4 fighters cleanly
- **Ranked system stub** — localStorage-based rating (no server); win/loss adjusts ELO; displayed in lobby; foundation for future server-backed ranking
- **Chaos modifier: Gravity Storm** — Random gravity direction changes every 20s (arena-wide); 15-second warning
- **Story Chapter 81–90: Post-game epilogue arc** — Story Mode v2 ends at chapter 80; epilogue arc introduces consequences of TrueForm defeat

---

## Priority 3 — New Systems

Larger additions requiring new modules. Higher risk; each needs its own file and load-order slot.

- **smb-tournament.js** — Bracket tournament mode: 4 or 8 players, single-elimination, auto-seeding, results screen
- **smb-replay.js** — Input recording + replay: capture `keysDown` state each frame; playback by replaying input into `processInput()`; save as JSON
- **smb-cosmetics.js** — Color/skin selector per player; hat/accessory slots drawn as offsets in `Fighter.draw()`; persisted in save file
- **smb-modding.js** — Runtime arena/weapon JSON loader; lets players paste custom arena definitions; validation layer required
- **smb-leaderboard.js** — Online leaderboard via a lightweight backend (POST scores, GET top 10); requires server-side component beyond current relay

---

## Priority 4 — Infrastructure

Changes to core architecture. High risk; requires careful migration.

- **Asset loading pipeline** — Currently all art is procedural (canvas draw calls); adding sprite support requires a preload step before `gameLoop` starts; needs a loading state in `gameMode`
- **Web Worker for AI** — Move `updateAI()` to a Worker thread to prevent frame drops in high-entity-count scenarios (story gauntlets with 3+ fighters + minions)
- **Server-authoritative multiplayer** — Current host-authoritative model has no anti-cheat; a dedicated game server with authoritative physics would fix desyncs on large maps
- **TypeScript migration (partial)** — `smb-globals.js` and `smb-data.js` are good candidates for typed definitions; would improve IDE autocomplete without requiring a bundler

---

## Known Technical Debt

- `MEMORY.md` is >200 lines — index is truncating (see footer warning); consolidate older entries
- `smb-loop.js` handles both camera and main game loop — split into `smb-camera.js` if the camera logic grows further
- `checkDeaths()` and `endGame()` are in `smb-drawing.js` — logically these belong in `smb-loop.js` or a dedicated `smb-gamestate.js`
- Some arena-specific hazard logic (cars, eruptions, ghosts) is scattered inline in `drawBackground()`; could be extracted into per-arena update hooks
- `STORY_CHAPTERS2` id-must-equal-index invariant is enforced by a manual check command, not automatically — a runtime assertion would be safer
