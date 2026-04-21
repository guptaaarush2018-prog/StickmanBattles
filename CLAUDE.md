# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## What This Game Is

**Stickman Battles** is a canvas-based 2D action fighting game with:
- Local and online (PeerJS/WebRTC) multiplayer
- 10 character classes and 16 weapons
- 18 arenas with unique physics and hazards
- A 3-phase Boss fight with cinematics and floor hazards
- A TrueForm boss with adaptive AI (~20 attacks, real-time player profiling)
- A multi-act Story Mode with full cinematic sequences
- A declarative cinematic scripting system built on `CinematicManager`
- No build step — raw HTML5 Canvas + plain JS globals loaded via `<script>` tags

**Active codebase:** `Stickman-Battles/` — do not edit legacy root files (`SMC.html`, `SMC.js`, `SMC.css`, `SMC.js.backup`).

---

## CRITICAL RULES (Override Everything)

### 1. Never Break Existing Systems
- Do NOT remove or rewrite large systems unless explicitly told
- Do NOT delete cinematics, boss logic, or rendering pipelines
- Always PATCH, never REPLACE
- If unsure, add — don't remove

### 2. Use Existing Architecture
- This codebase is globals-based with ordered script loading
- Do NOT introduce ES modules, `import`/`export`, or classes that bypass `Fighter`
- Use existing globals: `players[]`, `gameRunning`, `activeCinematic`, `GAME_W`, `GAME_H`

### 3. Respect Load Order
- Files can ONLY use globals defined by files loaded earlier in `index.html`
- See `docs/architecture.md` for the full ordered table

### 4. Always Add Safety Guards
```js
if (!boss || boss.health <= 0) return;
```

### 5. Never Bypass dealDamage()
All damage must go through `dealDamage(attacker, target, dmg, kbForce)` in `smb-particles.js`. Never mutate `target.health` directly.

### 6. Never Trigger Cinematics Inside dealDamage()
Set a flag; trigger at frame start in `gameLoop`.

---

## How Claude Should Behave

Before making any change:
1. **Read the relevant module** — understand what already exists
2. **Read the relevant docs file** — understand the system's design contract
3. **Plan the smallest possible patch** — do not touch unrelated code
4. **Verify syntax:** `node --check Stickman-Battles/js/smb-yourfile.js`
5. **Do not add features or refactoring** beyond what was asked

When in doubt: read more code, ask before assuming.

---

## Documentation Index

All docs are in `Stickman-Battles/docs/`.

| Doc | When to Read |
|-----|-------------|
| [docs/architecture.md](Stickman-Battles/docs/architecture.md) | File structure, load order, rendering pipeline, class hierarchy, globals |
| [docs/systems.md](Stickman-Battles/docs/systems.md) | All major systems: combat, physics, AI, cinematics, weapons, arenas, HUD |
| [docs/cinematics.md](Stickman-Battles/docs/cinematics.md) | `CinematicManager`, `cinScript()`, `CinFX`, `CinCam`, phases, QTE, finishers |
| [docs/combat.md](Stickman-Battles/docs/combat.md) | `dealDamage()` full pipeline, boss attacks, TrueForm moves, hit detection |
| [docs/multiplayer.md](Stickman-Battles/docs/multiplayer.md) | NetworkManager, PeerJS topology, state sync, remote players, message types |
| [docs/roadmap.md](Stickman-Battles/docs/roadmap.md) | Feature priorities, completed work, technical debt |
| [docs/coding_standards.md](Stickman-Battles/docs/coding_standards.md) | Naming conventions, how to add weapons/arenas/modes/commands, safety patterns |
| [docs/story-structure.md](Stickman-Battles/docs/story-structure.md) | Story Mode chapter/arc layout, engine design |
| [docs/canon.md](Stickman-Battles/docs/canon.md) | In-universe lore and character canon |
| [docs/implementation-checklist.md](Stickman-Battles/docs/implementation-checklist.md) | Step-by-step refactor checklist — execute in order, test after each step |
| [docs/refactoring-plan.md](Stickman-Battles/docs/refactoring-plan.md) | Globals-based modularity patterns; which files are too large and how to split them |

---

## Running the Game

```bash
# Serve from the active codebase directory
cd "Stickman-Battles" && python3 -m http.server 8080
# Open: http://localhost:8080/index.html

# Syntax-check a JS file
node --check Stickman-Battles/js/smb-globals.js

# Start optional multiplayer relay server
cd "Stickman-Battles" && node server.js   # port 3001
```

---

## File Structure (Load Order)

Script load order in `Stickman-Battles/index.html` — files may only reference globals from earlier entries:

1. `js/smb-errorboundary.js` — Global error boundary/fallback
2. `js/smb-globals.js` — ALL global state (canvas, settings, TF state, online state, boss floor state)
3. `js/smb-audio.js` — SoundManager
4. `js/smb-director.js` — Game director / flow controller
5. `js/smb-achievements.js` — Achievement definitions and unlock logic
6. `js/smb-data-arenas.js` — `ARENAS`, `ARENA_BASE_PLATFORMS`, `randomizeArenaLayout`
7. `js/smb-data-mapperks.js` — `MAP_PERK_DEFS`, `mapPerkState`, `initMapPerks`, `updateMapPerks`
8. `js/smb-data-mapperks-draw.js` — `applyMapPerk`, `drawMapPerks`
9. `js/smb-data-weapons.js` — `WEAPONS`, `WEAPON_KEYS`, `CLASSES`, `CLASS_AFFINITY`, descs
10. `js/smb-map-analyzer.js` — Arena layout analysis
11. `js/smb-combat.js` — `dealDamage()` ← **all damage here**; `lerp`, `clamp`, `areAlliedEntities`, `handleSplash`
12. `js/smb-particles-core.js` — Particle pool, `spawnParticles`, `spawnBullet`, `Projectile`, `DamageText`
13. `js/smb-heatmap.js` — Player heatmap (zone tracking)
14. `js/smb-verlet.js` — `VerletRagdoll`, `PlayerRagdoll`
15. `js/smb-cinematics-core.js` — `CinematicManager`, `cinScript`, `CinFX`, `CinCam`, `CinTimeline`
16. `js/smb-cinematics-backstory.js` — `startBossBackstoryCinematic`
17. `js/smb-cinematics-boss-thresh.js` — Boss warning/rage/desp threshold cinematics
18. `js/smb-cinematics-tf-thresh.js` — TrueForm entry/reality/desp threshold cinematics
19. `js/smb-cinematics-multiverse.js` — `startMultiverseTravelCinematic`
20. `js/smb-finisher-helpers.js` — Shared finisher drawing helpers + dialogue pools
21. `js/smb-finisher-void.js` — `FIN_VOID_SLAM`
22. `js/smb-finisher-reality.js` — `FIN_REALITY_BREAK`
23. `js/smb-finisher-boss.js` — `FIN_SKY_EXECUTION`, `FIN_DARKNESS_FALLS`, `FIN_HEROS_TRIUMPH`
24. `js/smb-finisher-tf.js` — TF/creator finisher definitions
25. `js/smb-finisher-yeti.js` — Yeti finisher definitions
26. `js/smb-finisher-beast.js` — Beast finisher definitions
27. `js/smb-finisher-weapon.js` — `WEAPON_FINISHERS`, `CLASS_FINISHERS`
28. `js/smb-finisher-engine.js` — `triggerFinisher`, `updateFinisher`, `drawFinisher`
29. `js/smb-pathfinding.js` — Bot pathfinding
30. `js/smb-fighter.js` — Fighter base class
31. `js/smb-combat-ai.js` — Modular AI: `CombatSystem`, `MovementSystem`, `AIController`, `CombatAIFighter`
32. `js/smb-enemies-core.js` — `Minion`, `ForestBeast` classes
33. `js/smb-enemies-creatures.js` — `Yeti`, `Dummy` classes
34. `js/smb-enemies-training.js` — Training mode, map creator, custom weapon creator
35. `js/smb-enemies-class.js` — `applyClass`, `updateClassWeapon`, `showDesc`, mirror AI patch
36. `js/boss/smb-boss.js` — Boss class (3-phase)
37. `js/boss/smb-boss-cinematics.js` — Boss cinematic sequences
38. `js/boss/smb-boss-tf-misc.js` — TF black holes, warp, portal teleport, size manipulation
39. `js/boss/smb-boss-phase-cin.js` — Phase 2/3 cinematics for Boss, TrueForm, Beast, Yeti
40. `js/boss/smb-boss-tf-legacy.js` — DELETED cinematic stubs + `triggerPhaseTransition`
41. `js/boss/smb-boss-tf-attacks1.js` — Gravity wells, meteor crash, clones, dimension punch, shockwaves, boss pending attacks
42. `js/boss/smb-boss-tf-attacks2.js` — `updateTFPendingAttacks`, `drawBossWarnings`, `resetBossWarnings`
43. `js/boss/smb-boss-tf-visuals1.js` — Phase shift, reality tear, calc strike, math bubble, reality override, gamma beam
44. `js/boss/smb-boss-tf-visuals2.js` — Burn trail, neutron star, galaxy sweep, multiverse fracture, supernova
45. `js/boss/smb-boss-helpers.js` — Boss utility functions
46. `js/boss/smb-trueform.js` — TrueForm class
47. `js/boss/smb-trueform-attacks.js` — TrueForm move set
48. `js/smb-paradox-class.js` — Paradox entity class + global state
49. `js/smb-paradox-opening.js` — TF opening fight cinematic
50. `js/smb-paradox-return-cin.js` — TF kicks Paradox out + return-1000 cinematic
51. `js/smb-paradox-absorption-update.js` — Absorption update logic
52. `js/smb-paradox-absorption-draw.js` — Absorption draw, memories, KC overlay
53. `js/smb-paradox-kills-cin.js` — `_makeTFKillsParadoxCinematic`
54. `js/smb-paradox-revive.js` — Spawn/remove, revive, damage lock, empowerment, foreshadow
55. `js/smb-paradox-intro-cin.js` — `_makeTFIntroCinematic`
56. `js/smb-paradox-cin2.js` — `_makeTFParadoxEntryCinematic`, `_makeTFFinalParadoxCinematic`, false victory
57. `js/smb-paradox-effects.js` — `resetParadoxState`, `updateParadoxEffects`
58. `js/smb-paradox-ai.js` — `drawParadoxEffects`, fusion AI, ability handlers, companion
59. `js/smb-behavior-model.js` — Player behavior fingerprinting; plugs into AdaptiveAI
60. `js/smb-adaptive-ai.js` — Real-time player profiling / adaptive AI
61. `js/smb-smk2-data.js` — SovereignMK2 dialogue pools, action classifier, stage names
62. `js/smb-smk2-class.js` — `SovereignMK2 extends AdaptiveAI` + debug API
63. `js/smb-trueform-ending-data.js` — TFEnding state vars, helpers, `startTFEnding`
64. `js/smb-trueform-ending-update.js` — `updateTFEnding` state machine
65. `js/smb-trueform-ending-draw.js` — `drawTFEnding`, utilities
66. `js/rendering/smb-drawing-arenas.js` — Arena backgrounds and platform drawing
67. `js/rendering/smb-drawing-bg.js` — `generateBgElements`, `drawBackground`, explore tiles
68. `js/rendering/smb-drawing-effects.js` — Boss beams, class effects, accessories, lightning
69. `js/rendering/smb-drawing-scenes.js` — Boss death scene, fake death scene
70. `js/rendering/smb-drawing-hud.js` — Story subtitle, objective HUD, cinematic letterbox
71. `js/rendering/smb-drawing-arenas2.js` — Cave, mirror, underwater, volcano, cyberpunk, etc.
72. `js/rendering/smb-drawing-arenas3.js` — Online/large arenas + home world arenas
73. `js/smb-minigames.js` — Survival, KotH, Chaos Match systems
74. `js/smb-qte-core.js` — QTE phase defs, state, public API, trigger detection, `_startQTE`
75. `js/smb-qte-engine.js` — QTE stage tickers, prompt logic, round failure, `_endQTE`
76. `js/smb-qte-draw.js` — QTE draw functions (background, prompts, HUD, combo text)
77. `js/smb-cinematic.js` — Cinematic playback runtime
78. `js/smb-cutscene.js` — Cutscene helpers
79. `js/smb-camera.js` — Camera sequences, drama cam, `updateCamera`
80. `js/smb-loop-core.js` — `applyWorldModifiers` + main `gameLoop` (monolithic)
81. `js/smb-input.js` — `processInput`, shield constants, key normalization
82. `js/smb-cheats.js` — `applyCode`, all cheat code logic
83. `js/smb-menu-ui.js` — Mode selection, cosmetics/store, bot toggle
84. `js/smb-menu-select.js` — Card grids, arena/lives/settings selection, changelog
85. `js/smb-menu-config.js` — Custom weapons panel, stats log, weapon/class resolution
86. `js/smb-menu-spawn.js` — `startGame`, arena spawn bounds, safe spawn helpers
87. `js/smb-menu-startcore.js` — `_startGameCore` (full game initialisation sequence)
88. `js/smb-menu-utils.js` — `toggleChaosMode`, `resizeGame`, `refreshMenuFromAccount`, `drawEdgeIndicators`
89. `js/smb-network.js` — NetworkManager (PeerJS/WebRTC)
90. `js/smb-state.js` — `GameState`: centralized persistent state (accounts, admin overrides, session metadata)
91. `js/smb-online.js` — `LobbyManager`: lobby presence layer on top of NetworkManager; localStorage lobby ads
92. `js/smb-debug-overlay.js` — Debug HUD, sanity checks, debug menu panel
93. `js/smb-debug-console.js` — In-game developer console (`_consoleExec`)
94. `js/smb-debug-jump.js` — F8 developer jump menu (story/cinematic/arena/boss fast-travel)
95. `js/smb-accounts.js` — `AccountManager`: local multi-account system; reads/writes via `GameState`
96. `js/smb-save.js` — Save/load persistence
97. `js/smb-admin-core.js` — Admin identity, isAdmin, ban/unban/kick actions, player management
98. `js/smb-admin-panels.js` — Admin panel DOM, action handlers, toast, ban screen, F9 listener
99. `js/smb-attacktest-core.js` — ATK sandbox state, proxy factory, helpers
100. `js/smb-attacktest-exec.js` — `FORCE_ATTACK_MODE`, `forceExecuteAttack`, debug tools
101. `js/smb-attacktest-registry.js` — `ATK_REGISTRY` per-class attack definitions
102. `js/smb-attacktest-commands.js` — `_atkCommand` router, kit HUD, key handler
103. `js/smb-attacktest-gui.js` — Visual GUI overlay + console patch
104. `js/story/smb-story-registry.js` — Story chapter registry
105. `js/story/acts/` — Per-act story arc files:
    - act0: arc1, arc2
    - act1: arc1, arc2
    - act2: arc1, arc2, arc3
    - act3: arc1, arc2
    - act4: arc1, arc2
    - act4mv: arc1, arc2 (multiverse arcs)
    - act5: arc1, arc2, arc-damnation
    - act6: arc1, arc2
    - side: smb-lab-infiltration
106. `js/story/smb-story-config.js` — Story configuration
107. `js/story/smb-story-engine-data.js` — Chapter expansion helpers, state vars
108. `js/story/smb-story-engine-ui.js` — Tab switching, journey/store/skill-tree UI
109. `js/story/smb-story-engine-flow.js` — Chapter launch flow
110. `js/story/smb-story-engine-match.js` — `spawnWorldBoss`, `story2OnMatchEnd`, victory
111. `js/story/smb-story-engine-events.js` — Event bus, `_handleBuiltinEvent`, freeze/slow helpers
112. `js/story/smb-story-engine-frame.js` — Per-frame: `storyCheckEvents`, dodge roll, boundaries
113. `js/story/smb-story-engine-explore.js` — Exploration chapter: platform gen, side portal
114. `js/story/smb-story-engine-explore2.js` — `updateExploration`, scene triggers, fallen warrior
115. `js/story/smb-story-finalize.js` — Story end/transition logic
116. `js/smb-progression.js` — Player progression / unlocks
117. `js/smb-multiverse.js` — Multiverse mode
118. `js/smb-multiplayer-chaos.js` — Multiplayer chaos extensions
119. `js/smb-designer.js` — Level designer tool
120. `js/smb-test-tools.js` — Test/QA tooling (loaded last)

Dependencies: GSAP 3.12.5 (CDN), PeerJS 1.5.4 (CDN).

---

## Common Failures (Do Not Repeat)

| Failure | Why It Breaks |
|---------|--------------|
| Rewriting a whole file | Destroys cinematic phase state, event guards, boss AI tuning |
| Breaking cinematics | `activeCinematic`, `isCinematic`, `slowMotion` are interdependent — partial changes cause freezes |
| Duplicate systems | Two systems writing to same global causes race conditions each frame |
| Idle bosses | Boss AI must always find a valid action; dead-end state machine leaves boss frozen |
| Direct `target.health -=` | Skips multipliers, shields, online sync, hit-stop, achievements |
| ES module syntax | Breaks all files loaded after it — game goes completely silent |
| Missing `isFloor: true` platform | `pickSafeSpawn()` returns null → crashes on respawn |
| Editing files in wrong directory | Legacy root `SMC.*` files are dead code — only edit `Stickman-Battles/` |

---

## Key Globals Cheat Sheet

| Global | Purpose |
|--------|---------|
| `GAME_W = 900`, `GAME_H = 520` | Logical game dimensions — always use these |
| `players[]` | All active fighters (including boss, remote) |
| `gameMode` | Current mode string |
| `gameRunning` | True when game loop is active |
| `activeCinematic` | Running cinematic object; null = idle |
| `isCinematic` | Blocks new attacks while cinematic plays |
| `slowMotion` | 0–1 physics time scale |
| `hitStopFrames` | >0 = physics paused (heavy hit) |
| `bossFloorState` | `'normal'` / `'warning'` / `'hazard'` |
| `tfGravityInverted` | TrueForm gravity flip flag |
| `tfControlsInverted` | TrueForm controls flip flag |
| `onlineLocalSlot` | 0 = host, 1+ = guest |
| `GameState` | Singleton (smb-state.js) — persistent account/session data; use `GameState.get/set/save()` |
| `AccountManager` | Singleton (smb-accounts.js) — multi-account CRUD; depends on `GameState` |
| `LobbyManager` | Singleton (smb-online.js) — lobby presence; sits on top of `NetworkManager` |

---

## Cinematic Phase Reference

`tfCinematicState` valid values (in sequence):
```
'none' → 'opening_fight' → 'paradox_death' → 'absorption' → 'punch_transition' → 'backstage'
```

Boss HP threshold cinematics fire via `_cinematicFired` Set guard in `Boss.updateAI()`.

---

## Design Rules

| Topic | Rule |
|-------|------|
| Difficulty | Game must be hard; bosses chain attacks and punish passivity |
| Combos | No infinite combos — combo limiter enforced in `dealDamage()` |
| Ranged | Add spread, recoil, reload penalties; TrueForm ~5% deflect chance |
| TrueForm | Must be aggressive, adaptive, and counter wall combos |
| QTE | Never during active combat — only at cinematic HP checkpoints |
| AI | Must not fall off map; must avoid hazards; must always engage |
| Debug | Must not break gameplay; must respect `isCinematic` flag |

---

## Story Mode Invariants

Story chapters live in `js/story/acts/` organized by act and arc. After editing any story registry, verify id === index alignment:
```bash
node -e "const m=require('fs').readFileSync('Stickman-Battles/js/story/smb-story-registry.js','utf8').match(/const STORY_CHAPTERS\s*=\s*\[([\s\S]*?)\];/); if(m){const ids=[...m[1].matchAll(/^\s*id:\s*(\d+),/gm)].map(x=>+x[1]); ids.forEach((id,i)=>id!==i&&console.log(i,id));}"
```
