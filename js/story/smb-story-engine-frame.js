'use strict';
// smb-story-engine-frame.js — Per-frame: storyCheckEvents, onEnemyDeath, syncDistort, resetState, boundaries, dodgeRoll
// Depends on: smb-globals.js, smb-story-registry.js (and preceding story-engine splits)

// ── storyCheckEvents: called each game frame from smc-loop.js ─────────────────
/**
 * Polls per-frame game state and fires events when thresholds are crossed.
 * Call this from the main game loop AFTER physics/combat update.
 */
function storyCheckEvents() {
  if (!storyModeActive || !gameRunning) return;

  const ch  = _activeStory2Chapter;
  const chId = ch ? ch.id : (storyState.chapter - 1);
  const p1  = players && players[0];
  if (!p1) return;

  // ── SURVIVAL_EVENT: player health drops below 20% ────────────────────────
  if (p1.health > 0 && p1.health / p1.maxHealth < 0.20) {
    triggerEvent('SURVIVAL_EVENT', { player: p1 });
  }

  // ── REALITY_BREAK: chapters 8+ (fracture network) trigger ambient distortion
  if (chId >= 8 && !storyEventFired['REALITY_BREAK']) {
    triggerEvent('REALITY_BREAK', { chapterId: chId });
  }

  // ── FIRST_KILL: track whether an enemy just died to p1 ───────────────────
  // (This is called separately by checkDeaths() via storyOnEnemyDeath)
  // Handled in storyOnEnemyDeath below.

  // ── ABILITY_UNLOCK: chapter 3 (Ground Zero), once the player uses Q ────────
  if (chId >= 3 && !storyEventFired['ABILITY_UNLOCK'] && !storyState.abilities.weaponAbility) {
    if (p1.abilityCooldown > 0) {  // ability was just used (cooldown just started)
      triggerEvent('ABILITY_UNLOCK', { player: p1 });
    }
  }

  // ── SUPER_UNLOCK: chapter 5 (Lava Crossing), when super meter first fires ─
  if (chId >= 5 && !storyEventFired['SUPER_UNLOCK'] && !storyState.abilities.superMeter) {
    if (p1.superMeter >= (p1.maxSuperMeter || 100)) {
      triggerEvent('SUPER_UNLOCK', { player: p1 });
    }
  }

  // ── Fallen warrior memory: rare ambient scene in late-game chapters ─────────
  // Fires once per fight (10% chance) when past chapter 60 to build TrueForm tension.
  if (chId >= 60 && !storyEventFired['FALLEN_WARRIOR'] && frameCount === 180) {
    if (Math.random() < 0.10) triggerScene('fallen_warrior_memory');
  }

  // ── Tick storyFreezeTimer ─────────────────────────────────────────────────
  if (storyFreezeTimer > 0) storyFreezeTimer--;

  // ── Per-frame ability processing ─────────────────────────────────────────
  if (typeof storyTickAbilities === 'function') storyTickAbilities();
}

/**
 * Called from checkDeaths() (smc-drawing.js) when an AI enemy dies.
 * Fires FIRST_KILL event and handles per-event unlock logic.
 */
function storyOnEnemyDeath(victim, killer) {
  if (!storyModeActive) return;
  // Only fire on p1 kills
  if (killer !== (players && players[0])) return;
  triggerEvent('FIRST_KILL', { victim, killer });
}

// ── syncStoryDistortLevel: call after chapter advances ───────────────────────
function syncStoryDistortLevel() {
  const id = storyState.chapter;
  // Ch 0-7  : no distortion (home city, normal world)
  // Ch 8-12 : fracture network — mild to moderate distortion
  // Ch 13-22: multiversal core + architects — moderate to heavy
  // Ch 23+  : unraveling / final — maximum distortion
  if (id < 8) {
    storyDistortLevel = 0;
  } else if (id < 13) {
    storyDistortLevel = (id - 8) / 5 * 0.45;   // 0 → 0.45 across ch 8-13
  } else if (id < 23) {
    storyDistortLevel = 0.45 + (id - 13) / 10 * 0.40; // 0.45 → 0.85 across ch 13-23
  } else {
    storyDistortLevel = 0.85 + Math.min((id - 23) / 5, 1) * 0.15; // 0.85 → 1.0
  }
}

// ── Per-fight state reset ──────────────────────────────────────────────────────
// Call when a story fight starts (in _launchChapter2Fight) to clear per-fight flags
function resetStoryEventState() {
  storyEventFired  = {};
  storyFreezeTimer = 0;
  _fallenWarrior   = null;
  syncStoryDistortLevel();
  // Sync ability locks from current chapter
  const id = storyState.chapter;
  storyState.abilities.doubleJump    = id >= 1  || storyState.abilities.doubleJump;
  storyState.abilities.weaponAbility = id >= 3  || storyState.abilities.weaponAbility;
  storyState.abilities.superMeter    = id >= 5  || storyState.abilities.superMeter;
  storyState.abilities.dodge         = id >= 9  || storyDodgeUnlocked;
}

// ── Story soft boundary / portal system ───────────────────────────────────────
// Called every frame from gameLoop when storyModeActive.
// If a player has crossed the soft boundary, teleport them back to the nearest
// safe platform with a flash effect so it feels like a "reality enforcement" system.
function storyUpdateBoundaries() {
  if (!storyModeActive || !gameRunning || !currentArena || gameMode === 'exploration') return;
  // portalEdge: center portal (decorative in drawing, functional here) — teleport to far side of map
  if (currentArenaKey === 'portalEdge') {
    const cpx = GAME_W / 2, cpy = 260;
    for (const p of players) {
      if (!p || p.isBoss || p.health <= 0 || p._centerPortalCd > 0) continue;
      if (Math.abs(p.cx() - cpx) < 70 && Math.abs(p.cy() - cpy) < 130) {
        // Teleport to a safe platform away from center, on the opposite half of the world
        const halfW = (currentArena.mapRight || GAME_W) / 2;
        const pls = (currentArena.platforms || []).filter(pl =>
          !pl.isFloorDisabled && !pl.isFloor && pl.w > 40 &&
          (p.cx() < cpx ? pl.x + pl.w / 2 > halfW : pl.x + pl.w / 2 < halfW)
        );
        let dest = pls.length ? pls[Math.floor(Math.random() * pls.length)] : null;
        if (dest) {
          p.x = dest.x + dest.w / 2 - p.w / 2;
          p.y = dest.y - p.h - 2;
        } else {
          p.x = p.cx() < cpx ? cpx + 200 : cpx - 200;
          p.y = 350;
        }
        p.vx = 0; p.vy = 0;
        p._centerPortalCd = 90; // 1.5s cooldown to prevent re-trigger
        p.hurtTimer = Math.max(p.hurtTimer || 0, 30);
        if (settings.particles) {
          spawnParticles(p.cx(), p.cy(), '#aa44ff', 18);
          spawnParticles(p.cx(), p.cy(), '#ffffff', 8);
        }
        if (settings.screenShake) screenShake = Math.max(screenShake, 5);
      }
      if (p._centerPortalCd > 0) p._centerPortalCd--;
    }
  }
  for (const p of players) {
    if (!p || p.isBoss || p.health <= 0) continue;
    const breachedH = p._storyBoundaryBreached; // 'left' | 'right' | null
    const breachedV = p._storyBottomBreached;   // true | false
    if (!breachedH && !breachedV) continue;
    // Find the safest landing platform (not floor-disabled, not lava)
    const pls = currentArena.platforms
      ? currentArena.platforms.filter(pl => !pl.isFloorDisabled && pl.w > 40)
      : [];
    // For worldWidth arenas, pick platforms near the current camera view
    const viewCX = (typeof camX === 'number' ? camX : 0) + GAME_W / 2;
    const viewHalf = GAME_W * 0.8;
    const nearby = pls.filter(pl => !pl.isFloor && Math.abs(pl.x + pl.w / 2 - viewCX) < viewHalf);
    const usable = nearby.length ? nearby : pls.filter(pl => !pl.isFloor);
    // Prefer platforms with overhead clearance (no platform within 100px above)
    const clear = usable.filter(pl => {
      const spawnX = pl.x + pl.w / 2;
      return !pls.some(o => o !== pl && !o.isFloor &&
        o.y + o.h > pl.y - 100 && o.y + o.h < pl.y && o.x < spawnX + 20 && o.x + o.w > spawnX - 20);
    });
    const pool = clear.length ? clear : (usable.length ? usable : pls);
    // Pick closest to camera center
    let best = null;
    let bestScore = Infinity;
    for (const pl of pool) {
      const cx = pl.x + pl.w / 2;
      const score = Math.abs(cx - viewCX) + (pl.isFloor ? 400 : 0);
      if (score < bestScore) { bestScore = score; best = pl; }
    }
    const safePos = typeof pickSafeSpawnNear === 'function'
      ? pickSafeSpawnNear(viewCX, breachedH === 'right' ? 'left' : breachedH === 'left' ? 'right' : 'any')
      : null;
    if (safePos) {
      p.x  = safePos.x - p.w / 2;
      p.y  = safePos.y - p.h;
    } else if (!best) {
      p.x  = viewCX - p.w / 2;
      p.y  = 200;
    } else {
      p.x  = best.x + best.w / 2 - p.w / 2;
      p.y  = best.y - p.h - 2;
    }
    p.vx = 0;
    p.vy = 0;
    p._storyBoundaryBreached = null;
    p._storyBottomBreached   = false;
    // Brief invincibility so the teleport can't be used to dodge attacks
    p.hurtTimer = Math.max(p.hurtTimer || 0, 25);
    // Flash burst
    if (settings.particles) {
      spawnParticles(p.cx(), p.cy(), '#aa44ff', 18);
      spawnParticles(p.cx(), p.cy(), '#ffffff', 8);
    }
    if (settings.screenShake) screenShake = Math.max(screenShake, 5);
  }
}

// ── Wire resetStoryEventState into _launchChapter2Fight ────────────────────────
// Monkey-patch: wrap the existing function so resetStoryEventState() is always called
(function _patchLaunchChapter2Fight() {
  // _launchChapter2Fight is defined earlier in this same file, so we can
  // reference it after the file finishes loading. We do it lazily via a
  // wrapper on the global that smc-menu.js actually calls: startGame().
  // Instead, we add a hook point here that _launchChapter2Fight can call.
  // The actual patch is below, applied after the function reference is stable.
})();

// Patch called from storyModeActive guard inside _startGameCore (smc-menu.js):
// We expose a hook: before startGame(), call _onStoryFightStart() when in story mode.
function _onStoryFightStart() {
  resetStoryEventState();
  // Apply purchased story abilities to p1 once players[] is populated
  setTimeout(() => {
    const p1 = players && players[0];
    if (p1 && !p1.isAI) {
      p1._story2BaseDmg = p1.dmgMult || 1;
      const meta = _story2.metaUpgrades || { damage: 0, survivability: 0, healUses: 0 };
      p1.maxHealth += meta.survivability * 10;
      p1.health = Math.min(p1.maxHealth, Math.max(1, Math.round(p1.maxHealth * _storyGetCarryHealthPct())));
      p1.dmgMult = (p1.dmgMult || 1) * (1 + meta.damage * 0.08);
      p1.damageReductionMult = Math.max(0.70, (p1.damageReductionMult || 1) - meta.survivability * 0.025);
      _applyStory2Abilities(p1);
      // Multiverse worlds: apply accumulated dimensional bonuses to the player
      if (typeof MultiverseScalingSystem !== 'undefined' && typeof MultiverseManager !== 'undefined') {
        MultiverseScalingSystem.applyToFighter(p1, MultiverseManager.getSave());
      }
    }
    for (const enemy of players.filter(p => p && p !== p1 && (p.isAI || p.isBoss))) {
      _storyScaleEnemyUnit(enemy, _activeStory2Chapter ? _activeStory2Chapter.id : 1, {
        elite: !!(storyPendingPhaseConfig && (storyPendingPhaseConfig.type === 'elite_wave' || storyPendingPhaseConfig.type === 'mini_boss'))
      });
      // Multiverse world fights: apply world modifier to enemies
      if (_activeStory2Chapter && _activeStory2Chapter.isMultiverseWorld && typeof MultiverseScalingSystem !== 'undefined') {
        const worldsCleared = typeof MultiverseManager !== 'undefined' ? MultiverseManager.getCompletedCount() : 0;
        MultiverseScalingSystem.applyWorldModifierToEnemy(enemy, _activeStory2Chapter.multiverseWorldId, worldsCleared);
      }
    }
    // Activate the multiverse world state so modifiers tick and Fallen God dialogue fires
    if (_activeStory2Chapter && _activeStory2Chapter.isMultiverseWorld && typeof MultiverseManager !== 'undefined') {
      MultiverseManager.enterWorld(_activeStory2Chapter.multiverseWorldId);
    } else if (typeof MultiverseManager !== 'undefined' && MultiverseManager.isActive()) {
      MultiverseManager.deactivate();
    }
  }, 80);
}

// ── World distortion drawing helper ─────────────────────────────────────────
// Called from smc-drawing.js each frame after the world is drawn, before HUD.
// Draws scanline glitches and reality-tear effects based on storyDistortLevel.
function drawStoryWorldDistortion(ctx, cw, ch_h) {
  const lvl = storyDistortLevel;
  if (lvl <= 0) return;

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0); // screen space

  const t = frameCount * 0.04;

  // ── Scanline bands (mild at low levels, heavy at high) ───────────────────
  const bandCount = Math.floor(lvl * 8);
  for (let i = 0; i < bandCount; i++) {
    const yFrac = (Math.sin(t * 0.7 + i * 2.3) * 0.5 + 0.5);
    const y     = yFrac * ch_h;
    const bh    = 2 + lvl * 4;
    const alpha = lvl * 0.25 * (0.5 + 0.5 * Math.sin(t + i));
    ctx.globalAlpha = alpha;
    ctx.fillStyle   = '#cc55ff';
    ctx.fillRect(0, y, cw, bh);
    // Horizontal glitch offset for this band
    if (lvl > 0.3 && Math.random() < 0.04) {
      ctx.globalAlpha = alpha * 0.5;
      const sliceH = 3 + Math.random() * 8;
      const offset = (Math.random() - 0.5) * 18 * lvl;
      ctx.drawImage(ctx.canvas, 0, y, cw, sliceH, offset, y, cw, sliceH);
    }
  }

  // ── Reality tears (vertical purple cracks, ch 11+) ───────────────────────
  if (lvl > 0.4) {
    const tearCount = Math.floor((lvl - 0.4) / 0.12);
    ctx.globalAlpha = 0;
    for (let i = 0; i < tearCount; i++) {
      const xFrac = Math.abs(Math.sin(i * 3.7 + t * 0.15));
      const x     = xFrac * cw;
      const alpha = (lvl - 0.4) * 0.7 * (0.5 + 0.5 * Math.sin(t * 0.6 + i));
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = '#cc44ff';
      ctx.shadowColor = '#cc44ff';
      ctx.shadowBlur  = 12;
      ctx.lineWidth   = 1.5;
      ctx.beginPath();
      const segments = 5 + Math.floor(Math.random() * 3);
      ctx.moveTo(x, 0);
      for (let s = 1; s <= segments; s++) {
        ctx.lineTo(x + (Math.random() - 0.5) * 14 * lvl, (s / segments) * ch_h);
      }
      ctx.stroke();
    }
    ctx.shadowBlur = 0;
  }

  // ── Full-screen vignette tint (deep purple at highest levels) ────────────
  if (lvl > 0.65) {
    const vAlpha = (lvl - 0.65) * 0.35;
    const vg = ctx.createRadialGradient(cw/2, ch_h/2, cw*0.1, cw/2, ch_h/2, cw*0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, `rgba(80,0,120,${vAlpha})`);
    ctx.globalAlpha = 1;
    ctx.fillStyle   = vg;
    ctx.fillRect(0, 0, cw, ch_h);
  }

  ctx.globalAlpha = 1;
  ctx.restore();
}

// ── Dodge roll mechanic (gated by storyDodgeUnlocked) ────────────────────────
// Dodge state is stored on the Fighter instance:
//   p._dodgeTimer     — frames of active i-frames
//   p._dodgeCd        — cooldown frames
//   p._dodgeFacing    — direction of dodge
//   p._dodgePressed   — true during the frame double-tap is detected
//
// processInput() in smc-loop.js will call storyHandleDodgeInput(p, movingLeft, movingRight)
// to check for double-tap and trigger the roll.

const DODGE_FRAMES   = 14;  // i-frame duration
const DODGE_SPEED    = 16;  // lateral velocity burst
const DODGE_CD       = 48;  // cooldown before next dodge

/**
 * Must be called from processInput() for each non-AI player.
 */
function storyHandleDodgeInput(p) {
  if (!storyDodgeUnlocked) return;
  if (p._storyNoDodge) return;
  if (p._dodgeCd > 0) { p._dodgeCd--; return; }
  if (p._dodgeTimer > 0) {
    // Mid-dodge physics: maintain velocity, grant i-frames
    p._dodgeTimer--;
    p.vx = p._dodgeFacing * DODGE_SPEED;
    p.invincible = Math.max(p.invincible || 0, 1); // i-frames
    if (p._dodgeTimer === 0) {
      p._dodgeCd = DODGE_CD;
      p.vx *= 0.3; // hard-brake on exit
    }
    return;
  }

  // Double-tap detection: key tapped twice within 10 frames
  const lKey = p.controls.left;
  const rKey = p.controls.right;
  if (!p._tapState) p._tapState = {};

  const ts = p._tapState;
  const lHeld = keyHeldFrames[lKey] || 0;
  const rHeld = keyHeldFrames[rKey] || 0;

  // Rising-edge detection (frame 1 of hold = new press)
  if (lHeld === 1) {
    ts.lLastTap = frameCount;
  }
  if (rHeld === 1) {
    ts.rLastTap = frameCount;
  }

  // Double-tap = two presses within 12 frames, second press happens now
  if (lHeld === 1 && ts.lLastTap && (frameCount - ts.lLastTap) <= 12 && lHeld < 2) {
    // Need two separate press events — detect by checking prev tap was at least 1 frame ago
    // Simple proxy: if the last tap was this frame, it's the first tap; skip
    // We use a two-slot buffer approach
  }

  // Simplified approach: track tap count in short window
  if (lHeld === 1) {
    if (ts.lTapFrame && (frameCount - ts.lTapFrame) < 13) {
      // Second tap — fire dodge left
      _doDodge(p, -1);
      ts.lTapFrame = 0;
    } else {
      ts.lTapFrame = frameCount;
    }
  }
  if (rHeld === 1) {
    if (ts.rTapFrame && (frameCount - ts.rTapFrame) < 13) {
      // Second tap — fire dodge right
      _doDodge(p, 1);
      ts.rTapFrame = 0;
    } else {
      ts.rTapFrame = frameCount;
    }
  }
}

function _doDodge(p, dir) {
  if (p._dodgeTimer > 0 || (p._dodgeCd || 0) > 0) return;
  p._dodgeTimer   = DODGE_FRAMES;
  p._dodgeFacing  = dir;
  p.vx            = dir * DODGE_SPEED;
  p.invincible    = Math.max(p.invincible || 0, 1);
  spawnParticles(p.cx(), p.cy(), '#88eeff', 8);
  SoundManager && SoundManager.jump && SoundManager.jump(); // reuse jump sound
}



