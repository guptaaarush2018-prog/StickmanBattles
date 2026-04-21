# Combat — Stickman Battles

## Design Principles

- Game must be difficult. Passive play is punished.
- Bosses always chain attacks; no idle periods.
- No infinite combos or free damage — combo limiter enforced in `dealDamage()`.
- Every special move has a telegraph. Player always has a counterplay window.
- KB scales with damage: heavier hits push further.

---

## dealDamage() — Full Pipeline

**Location:** `smb-particles.js`

**Signature:**
```js
dealDamage(attacker, target, dmg, kbForce, stunMult=1.0, isSplash=false, hitInvincibleFrames=16)
```

**Never bypass this function.** All damage must flow through it for correct multiplier stacking, online sync, and feedback.

### Step 1 — Guard Checks
- `activeCinematic` → return (no damage during cinematics)
- `target.invincible > 0` → return
- `target.health <= 0` → return
- `target.godmode` → return (training mode)
- Attacker and target are allies → return

### Step 2 — Damage Multipliers (applied sequentially)

| Source | Effect |
|--------|--------|
| `attacker.dmgMult` | Per-entity multiplier (Minion = 0.5) |
| Story power level | +2% per chapter (max +200%) |
| `CLASS_AFFINITY[class][weaponType]` | Per-class weapon bonus/penalty |
| Kratos rage stacks | `1 + stacks × 0.015` (max 30 stacks) |
| Spartan Rage | +30% damage + 10% lifesteal |
| Map perk: power buff | ×1.35 |
| Curse: `curse_weak` | ×0.5 |
| Target: Paladin passive | ×0.85 incoming |
| Armor (helmet -12%, chest -15%, legs -8%) | Max combined -40% |
| Mirror Fracture reflect | 25% back if target is shielding |

### Step 3 — Knockback Scaling
```
actualKb = kbForce × (1 + actualDmg × 0.028)
```
- Curse `curse_fragile`: ×1.5
- Post-teleport crit window (boss): +65% dmg; player: ×2.0 dmg + stun
- Director intensity: small boost when underdog
- Shielding: KB reduced to 15% of normal

### Step 4 — Hit-Stop Assignment

| Damage | Hit-Stop Frames |
|--------|----------------|
| 8–17 | 2–4f |
| 18–29 | 4–7f |
| 30+ | 8–11f |
| Boss cosmic hit (≥20) | 11–14f |
| Boss receiving | 2–4f (shorter for pacing) |

Hit-stop pauses physics via `hitStopFrames` counter in `gameLoop`.

### Step 5 — Screen Feedback
- Camera zoom-in: `camHitZoomTimer` (dmg ≥ 18)
- Screen shake: `4 + dmg/5`, max 18 (respects `settings.screenShake`)
- Red vignette: `hitVignetteTimer` (human player taking ≥ 15 damage)
- Hit-slow: brief `slowMotion` reduction on heavy hits (30+)

### Step 6 — State Application
- `target.health -= actualDmg`
- `target.vx = dir × actualKb`; `target.vy = -actualKb × 0.55`
- `target.invincible = hitInvincibleFrames` (default 16f)
- Stun: if `stunMult > 0` → `target.stunTimer` set proportional to dmg

### Step 7 — Special Cases
- Online: `NetworkManager.sendHit()` broadcasts to all peers
- Killing blow: `triggerFinisher()` if `settings.finishers`
- TrueForm: combo accumulation (`_comboCount`, `_comboDamage`)
- Wall-combo escape: 3+ hits near arena boundary → TrueForm teleports to center
- Anti-ranged tracking: updates TrueForm `_antiRangedStats`

---

## Player Combat

### Basic Attack
- Triggered by attack key; fires `Fighter.attack(target)`
- Melee: sweep arc based on `weapon.range`; arc points via `_getMeleeArcPoints()`
- Ranged: `spawnBullet()` — uses `weapon.damageFunc` if present, else `weapon.damage`
- `swingHitTargets` Set prevents hitting same target twice per swing

### Ability (Q key)
- Each weapon has a unique `ability(user, target)` function
- `abilityCooldown` in frames; checked before activation
- Feedback: `abilityFlashTimer` expanding ring at player position

### Super (E key)
- `superMeter` charges from dealing/taking damage at `superChargeRate`
- `activateSuper(target)` triggers class-specific ultimate
- HUD meter fills green → gold when ready

### Shield (S/down key)
- `shielding = true` reduces incoming dmg to 8%, KB to 15%
- `shieldCooldown` prevents spam (separate from `SHIELD_CD`)
- `shieldHoldTimer` decrements max shield duration

---

## Boss Combat

### Boss Properties

| Stat | Value |
|------|-------|
| Health | 3,000 |
| KB Resistance | 0.5 (half KB received) |
| KB Bonus | 1.5 (1.5× KB dealt) |
| Attack Cooldown Mult | 0.5 (attacks twice as often) |
| Super Charge Rate | 1.7 |
| Draw Scale | 1.5 |
| Stagger threshold | 120 damage in 3 seconds → 2.5s stun |

### Boss Phase System

| Phase | HP Range | Behavior |
|-------|---------|---------|
| 1 | >2,000 | Conservative; melee + occasional beams |
| 2 | 1,000–2,000 | Adds minion spawns; faster beams; platform hazards begin |
| 3 | <1,000 | Desperation; meteor storms; max aggression; shorter cooldowns |

Phase transitions trigger cinematics and dialogue.

### Boss Attacks

| Attack | Range | Cooldown | Telegraph |
|--------|-------|---------|-----------|
| Ground Slam | <130px | 18 ticks | Red circle at player feet; 0.5s warning |
| Gravity Pulse | 80–320px | 28 ticks | Purple glow; player pulled toward impact |
| Meteor Storm | >250px / fleeing | 32 ticks | 5–8 beams (phase 3); warning lines |
| Teleport Behind | >110px, player still | Phase-dependent | Faint silhouette flash |
| Minion Spawn | Any (phase 2+) | 20–36 ticks | Portal animation at spawn point |
| Beam Attacks | Any (phase 2+) | 16–28 ticks | Dashed beam + pulsing floor circle |
| Spike Floor | Any (phase 3+) | 24 ticks | 5 spike warnings before eruption |

### Boss Beams

- Stored in `bossBeams[]` global
- Warning phase (300 frames): dashed purple beam + pulsing circle + countdown text
- Active phase (110 frames): solid beam, 12 damage/frame in 24px radius
- Drawn by `drawBossBeams()` in world-space after platforms
- Boss is immune to its own beam (levitates above hazards)

### Boss Floor Hazard

State machine: `normal (300f) → warning → hazard (900f) → normal`

- `bossFloorType`: `'lava'` or `'void'`
- `bossFloorState` / `bossFloorTimer` globals
- Platforms set `isFloorDisabled = true` during hazard
- Boss levitates: `y = dyY - h - 4`; `vy = Math.min(vy, -10)`

---

## TrueForm Combat

### TrueForm Properties

| Stat | Value |
|------|-------|
| Health | 10,000 |
| KB Resistance | 0.90 (nearly unmoveable) |
| KB Bonus | 0.55 |
| Speed | 4.2 (1.3× normal) |
| Hitbox | 18×50 (smallest in game) |
| Combo Cap | 4 hits or 85% max HP per combo |

### TrueForm Attack Registry (~20 moves, all telegraphed)

| Move | Telegraph Duration | Effect |
|------|--------------------|--------|
| Void Grasp | 4.25s | Immobilizes + deals heavy damage |
| Reality Slash | 1.25s | Fast melee burst |
| Gravity Well | 3.25s | Pulls player; lingering zone |
| Meteor Crash | 5.5s | AoE drop from above |
| Shadow Clones | 5.0s | 3 clones attack simultaneously |
| Chain Slam | 3.5s | Ground chain slam × 3 |
| Phase Shift | 4.5s | Teleport + dimensional hit |
| Reality Tear | 6.5s | Map-wide damage zone |
| Calculated Strike | 3.25s | Counters player's last used move |
| Gamma Ray Beam | 3.0s | Horizontal beam sweep |
| Neutron Star | 4.25s | Gravity center pulls everything |
| Galaxy Sweep | 3.5s | 360° AoE |
| Multiverse Fracture | 4.75s | Multiple simultaneous slashes |
| Supernova | Once at low HP | Whole-arena blast — final desperation |
| Collapse Strike | Desperation mode | Instantly closes distance + stun |
| Reality Override | Dominance mechanic | Reverses last player action |
| Dimension Shift | Instant | 2D → pseudo-3D perspective toggle |

### Adaptive AI Tiers

| Adaptation Level | Tier Unlocked |
|-----------------|--------------|
| 0 | Tier 0 (always available) |
| 25 | Tier 1 |
| 40 | Tier 2 |
| 60 | Tier 3 |
| 75 | Tier 4 |
| 90 | Tier 5 (full moveset) |

Phase (HP%) also unlocks tiers as a fallback for new players.

---

## Hit Detection

### Melee
- `_getMeleeArcPoints()` generates N points along the weapon arc
- Each point checked against target AABB each frame during attack animation
- `swingHitTargets` Set prevents multi-hit in a single swing

### Ranged
- `Projectile` objects: updated each frame via `updateProjectiles()`
- Collision: check projectile AABB against each entity AABB
- Projectile removed on first hit (default); some weapons pierce or bounce

### Hitbox Visualization
- `smb-attacktest.js` provides frame-by-frame hitbox display tool
- Activated from dev console or F1 panel

---

## Combat Balancing Rules

- **No free damage:** Every attack has endlag. Spamming creates punish windows.
- **No infinite combos:** Combo limiter (`_comboCount` max 4, `_comboDamage` cap 85% maxHP) in `dealDamage()`.
- **Ranged weapons:** Spread increases with `_rangedShotHeat`; movement penalty while firing; reload interrupts.
- **TrueForm deflect:** ~5% chance to reflect projectiles (per `CLAUDE.md` ranged rules).
- **Shield:** Never makes a fighter invincible — always takes 8% damage. Spamming blocked by `shieldCooldown`.
- **KB scaling:** Heavier hits travel further, creating natural spacing. Prevents corner-lock.
