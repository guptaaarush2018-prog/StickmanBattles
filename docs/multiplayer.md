# Multiplayer — Stickman Battles

## Architecture

**Stack:**
- **PeerJS** — WebRTC data channels for peer-to-peer game state
- **Socket.io relay** (`server.js`, port 3001) — signaling and room management only; not in the game data path
- **Star topology** — Host relays all state packets to all guests; guests send only to host

**Manager:** `NetworkManager` IIFE in `smb-network.js`. Accessed globally as `NetworkManager.*`.

---

## Topology

```
HOST (slot 0)  ←──────────────────────────────────┐
  │  PeerJS data channel                           │
  │  receives: guest states                        │
  │  sends:    host state + relayed guest states   │
  └──→ GUEST 1 (slot 1)                            │
  └──→ GUEST 2 (slot 2)  ──────────────────────────┘
  └──→ GUEST 3–9 (slots 3–9)
```

- HOST: Registers PeerID `"smcgame-<ROOMCODE>"`
- GUESTS: Connect to host, assigned sequential slots 1–9
- MAX players: 10 (slots 0–9)
- `onlineLocalSlot`: `0` = host (P1), `1` = guest (P2) in standard 2-player

---

## State Synchronization

### Send Rate
- **20 Hz** (`SEND_HZ = 20`) — state packets sent every 50ms
- `sendState()` is called on a `setInterval` timer (not tied to frame rate)

### State Buffer
- 16-frame history per slot: `_stateBuffers[slot] = [{ state, ts }, ...]`
- Interpolation delay: `INTERP_DELAY = 130ms`
- `_remoteStates[slot]` — latest received state, used for display

### Per-Player State Packet

```js
{
  slot,
  x, y, vx, vy,
  health, maxHealth,
  state,           // 'idle' | 'walk' | 'attack' | etc.
  facing,
  weaponKey,
  superMeter,
  invincible,
  ts               // timestamp for interpolation
}
```

### Latency Compensation
- Ping measured via round-trip timer on dedicated ping messages
- State buffering allows rendering at `now - INTERP_DELAY` to smooth jitter
- Host validates damage events; guests display prediction locally

---

## Message Types

| Type | Direction | Payload |
|------|-----------|---------|
| `playerState` | All → All (via host) | Position, velocity, health, animation |
| `hitEvent` | Attacker → Host | `targetSlot`, `attackerSlot`, `dmg`, `kbForce` |
| `gameEvent` | Any → All | Custom events (super used, landed, etc.) |
| `gameStateSync` | Host → Guests | Arena key, mode, selected lives |
| `playerCount` | Host → Guests | Current lobby count |
| `roomFull` | Host → Joining | Capacity reached signal |

---

## Remote Player Behavior

When a player slot has `p.isRemote = true`:
- `Fighter.update()` is **skipped** — physics not simulated locally for remote players
- `checkDeaths()` is **skipped** for remote players — authority stays with host
- Display driven entirely by incoming state packets
- Interpolated position rendered from `_stateBuffers[slot]`

Only the local player runs full physics and AI locally.

---

## Room System

- **Private rooms:** ROOMCODE entered manually; host creates, guest joins
- **Public rooms:** `_isPublicRoom = true`; host registers with Socket.io relay; `_publicRooms[]` list shown in lobby browser
- `onlinePlayerCount` (2–10) reported to HUD and lobby UI

---

## Disconnect Handling

`_handleOpponentLeft(slot)`:
1. Zero the leaver's HP and lives
2. Wait 600ms (allows packets to drain)
3. Call `endGame()`

All disconnect paths flow through this function. No game state corruption.

---

## Online Console Commands

Console commands in `smb-debug.js` are broadcast to all online players by default.

- Prefix with `--local` to skip broadcast (e.g., `godmode --local`)
- `NetworkManager.sendGameEvent('consoleCmd', { cmd })` is the broadcast mechanism
- Chaos events in `smb-multiplayer-chaos.js` also use `sendGameEvent`

---

## Multiplayer Chaos Mode

`smb-multiplayer-chaos.js` — layered on top of online multiplayer.

Features:
- 12 chaos events that fire at intervals (map hazard escalations, random weapon swaps, item drops)
- Kill streak tracking with announcer voice lines
- Item drops at world positions; synced via `gameEvent` messages
- Spectator mode (when a local player dies in team modes)

---

## Known Design Constraints

- **Authority model:** Host-authoritative. Host validates all damage. Guests display predictions.
- **No server-side validation:** The relay server is dumb — it only forwards PeerJS signals. No anti-cheat.
- **Slot 0 = host = P1:** Host always plays as Player 1. This is hardcoded in lobby flow.
- **State packet size:** Kept small intentionally (no full physics history). Projectile positions are NOT synced — each client simulates them independently from the spawn event.
- **Large maps and online:** `worldWidth: 3600` arenas require tighter camera clamping; the camera system handles this but extra latency makes fast-moving projectiles more prone to desync.

---

## Adding New Synced Events

1. Define a new event type string (e.g., `'myEvent'`)
2. Send: `NetworkManager.sendGameEvent('myEvent', { ...payload })`
3. Receive: add a handler block in `NetworkManager._handleGameEvent(type, data)`
4. Handler must be idempotent — it may arrive out of order or be re-sent on reconnect
5. Never sync visual-only effects — only sync game-state-changing events
