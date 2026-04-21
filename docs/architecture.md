# Architecture — Stickman Battles

## Folder Structure

```
Stickman-Battles/
├── index.html              # DOM skeleton: menu, HUD, canvas, mobile controls
├── SMB.css                 # All styles (glass-morphism, mode cards, HUD, animations)
├── server.js               # Socket.io relay server (port 3001, for signaling only)
├── images/                 # Splash screen PNGs shown at startup
└── js/                     # All game logic — 33 modules, ~52K lines total
```

### JS Module Load Order

Strict dependency order. A file may only reference globals defined by files loaded before it.

| # | File | Responsibility |
|---|------|---------------|
| 1 | `smb-errorboundary.js` | Global error handler; renders overlay on module failure |
| 2 | `smb-globals.js` | Canvas, `GAME_W=900 / GAME_H=520`, ALL global state |
| 3 | `smb-audio.js` | `SoundManager` singleton — Web Audio API, no external files |
| 4 | `smb-director.js` | Match intensity tracker 0–1; dynamic pacing |
| 5 | `smb-achievements.js` | `ACHIEVEMENTS` array, `unlockAchievement()`, popup draw |
| 6 | `smb-data.js` | `ARENAS`, `WEAPONS`, `CLASSES`, story arenas, `pickSafeSpawn()` |
| 7 | `smb-map-analyzer.js` | Static platform graph analysis for AI navigation |
| 8 | `smb-particles.js` | Particles, `Projectile`, `DamageText`, `VerletRagdoll`, `dealDamage()` |
| 9 | `smb-cinematics.js` | Declarative cinematic scripting v2 (`CinematicManager`, `cinScript()`) |
| 10 | `smb-finishers.js` | Kill-blow finisher system built on `CinematicManager` |
| 11 | `smb-pathfinding.js` | Predictive arc-based pathfinding v4 (`pf*` helpers for AI) |
| 12 | `smb-fighter.js` | `Fighter` base class — physics, animation, combat, AI loop |
| 13 | `smb-enemies.js` | `Minion`, `ForestBeast`, `Yeti`, `Dummy`, `applyClass()` |
| 14 | `smb-boss.js` | `Boss` (phase AI, beams, minions), `TrueForm` (adaptive AI, cosmic attacks) |
| 15 | `smb-adaptive-ai.js` | `AdaptiveAI extends Fighter` — dedicated Adaptive AI mode |
| 16 | `smb-sovereign-mk2.js` | `SovereignMk2 extends AdaptiveAI` — bigram learning, spam punishment |
| 17 | `smb-trueform-ending.js` | TrueForm victory cinematic — meta-breaking post-fight sequence |
| 18 | `smb-paradox.js` | Paradox visual entity — TrueForm empower phases, revive, foreshadowing |
| 19 | `smb-drawing.js` | Background gen, arena draw, `checkDeaths()`, `endGame()`, HUD |
| 20 | `smb-minigames.js` | Survival, KotH, Chaos Match, Soccer |
| 21 | `smb-qte.js` | QTE phases at 75/50/25/10% TF HP |
| 22 | `smb-cinematic.js` | Impact cinematic system — hit-stop and zoom effects |
| 23 | `smb-loop.js` | Camera, `gameLoop()`, `processInput()`, `keysDown`, cheat codes |
| 24 | `smb-menu.js` | Tutorial, menu UI, `startGame()`, `selectMode()`, `backToMenu()` |
| 25 | `smb-network.js` | `NetworkManager` IIFE — PeerJS P2P, state sync at 20 Hz |
| 26 | `smb-debug.js` | F1 toggle, F2 slow-mo, console, `_consoleExec()` |
| 27 | `smb-save.js` | Persistent save: auto-save to localStorage, export/import JSON |
| 28 | `smb-attacktest.js` | Frame-by-frame attack/hitbox analysis tool |
| 29 | `smb-story.js` | Story Mode v2: 80 chapters, ability store, event bus, distortion |
| 30 | `smb-multiplayer-chaos.js` | Chaos events, item drops, kill streaks, announcer, spectator |
| 31 | `smb-designer.js` | Map/weapon designer (loaded last; standalone tool) |

---

## Coordinate System

- **Logical space:** `GAME_W = 900, GAME_H = 520` — always use these constants, never `canvas.width/height`
- **Scaling:** `ctx.setTransform(canvas.width/GAME_W, 0, 0, canvas.height/GAME_H, sx, sy)` applied each frame
- **HUD/overlays:** reset to identity (`ctx.setTransform(1,0,0,1,0,0)`) before drawing
- **Large maps:** `worldWidth: 3600`, `mapLeft/mapRight` clamp camera; platforms spread across full width

---

## Class Hierarchy

```
Fighter (smb-fighter.js)
├── Boss            — creator arena; phase-based AI (3 phases); beams, minion spawns, platform hazards
├── TrueForm        — void arena; adaptive AI; cosmic attack suite (~20 moves); environmental manipulation
├── AdaptiveAI      — dedicated Adaptive AI mode opponent (smb-adaptive-ai.js)
│   └── SovereignMk2  — bigram sequence learning, aggro-burst mode (smb-sovereign-mk2.js)
├── Minion          — boss-spawned; half damage output; permanent death (no respawn)
├── Dummy           — training target; auto-heals
├── ForestBeast     — forest arena hazard NPC
└── Yeti            — ice arena hazard NPC
```

**Constructor signature:**
```js
Fighter(x, y, color, weaponKey, controls, isAI, aiDifficulty)
// controls keys: { left, right, jump, attack, shield, ability, super }
// controls = null → AI-controlled
```

---

## Rendering Pipeline

Each frame, in order:

```
1. processInput()            — read keyboard/gamepad, decrement cooldowns, run bot AI
2. Update entities           — physics, velocity integration, platform collision, status effects
3. updateCamera()            — bounding-box or cinematic mode; zoom lerp
4. Clear canvas              — ctx.clearRect(0, 0, GAME_W, GAME_H)
5. drawBackground()          — sky gradient + arena-specific layers (smb-drawing.js)
6. drawPlatforms()           — solid platforms with edge glow
7. drawBossBeams()           — charged beam warnings + active beams (world-space)
8. Draw fighters             — Fighter.draw() per entity
9. Draw projectiles          — Projectile.draw() per projectile
10. Draw particles           — Particle.draw(), DamageText.draw()
11. drawHUD()                — health bars, meters, lives (screen-space; identity transform)
12. drawCinematicOverlay()   — letter-box bars, dialogue, labels
13. drawAchievementPopups()  — achievement toast (screen-space)
14. drawEdgeIndicators()     — off-screen player arrows (screen-space)
```

Two separate `requestAnimationFrame` loops — **only one active at a time:**
- `menuBgLoop()` — animated arena behind the menu
- `gameLoop()` — full update + render cycle

---

## Camera System

| Mode | Trigger | Pos Lerp | Zoom Lerp |
|------|---------|----------|-----------|
| Gameplay | Default | 0.062 | 0.045 |
| Combat | Players within 220px or attacking | 0.130 | 0.095 |
| Cinematic | `isCinematic = true` | 0.220 | 0.180 |
| Snap | `cinematicCamSnapFrames > 0` | 0.55 | 0.45 |

- Gameplay: bounding-box enclosing all players (PAD = 150px, zoom 0.45–1.1)
- Combat: locks on closest active pair, tighter zoom
- Cinematic: entity-lock via `cinematicFocusX/Y`; overridden by `CinCam` commands
- Dead zone: 1.5px prevents micro-jitter
- Wide-map guard: when zoomed too far out, centers at `GAME_W/2` (prevents right-drift)
- `hitStopFrames > 0` → gameLoop skips physics update (freeze effect on heavy hits)

---

## Global State Buckets (smb-globals.js)

| Bucket | Key globals |
|--------|-------------|
| Game state | `gameMode`, `gameRunning`, `paused`, `gameFrozen`, `frameCount` |
| Entities | `players[]`, `minions[]`, `projectiles[]`, `particles[]`, `damageTexts[]` |
| Camera | `camZoomTarget/Cur`, `camXTarget/Cur`, `camYTarget/Cur` |
| Cinematic | `activeCinematic`, `isCinematic`, `slowMotion`, `screenShake`, `hitStopFrames` |
| TrueForm | `tfGravityInverted`, `tfControlsInverted`, `tfFloorRemoved`, `tfBlackHoles[]` |
| Online | `onlineMode`, `localPlayerSlot`, `onlinePlayerCount` |
| Boss | `bossBeams[]`, `bossFloorState`, `bossFloorType`, `bossDialogue` |
| Settings | `settings.particles`, `.screenShake`, `.dmgNumbers`, `.finishers`, `.view3D` |
| Story | `storyModeActive`, `storyCurrentLevel`, `playerPowerLevel`, `worldModifiers` |

---

## Game Modes

`gameMode` value → behavior driven by `startGame()`, `checkDeaths()`, `endGame()`:

| Mode | Description |
|------|-------------|
| `'2p'` | Local PvP |
| `'boss'` | Player(s) vs Boss |
| `'trueform'` | Player vs TrueForm boss (unlock required) |
| `'training'` | vs Dummy, godmode toggle |
| `'tutorial'` | Guided tutorial flow |
| `'minigames'` | Survival / KotH / Chaos / Soccer |
| `'story'` | Story Mode v2 (80 chapters) |
| `'adaptive'` | vs AdaptiveAI / SovereignMk2 |
| `'online'` | P2P multiplayer via PeerJS |

---

## Persistent Storage (localStorage keys)

| Key | Value |
|-----|-------|
| `smc_bossBeaten` | Flag — enables secret letter hunt |
| `smc_letters` | JSON array of collected letter indices 0–7 |
| `smc_trueform` | TrueForm unlock flag |
| `smc_achievements` | JSON Set of earned achievement IDs |
| `smc_sfxVol` / `smc_sfxMute` | Audio settings |
| `smb_save` | Full save export blob |
