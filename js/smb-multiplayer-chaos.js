// ============================================================
// CHAOS MULTIPLAYER SYSTEM  —  smb-multiplayer-chaos.js
// Dynamic events, mutations, item drops, kill streaks, spectator
// Works in any game mode when chaosMode = true.
// ============================================================

// ─── Global State ────────────────────────────────────────────
let chaosMode        = false;   // enabled from menu toggle or console
let chaosModeStarted = false;   // true while game is running with chaos
let chaosEventTimer  = 0;       // countdown to next chaos event (frames)
let _chaosNextInterval = 1800;  // randomized interval, reset each event
let activeChaosEvent = null;    // { id, timer, duration }
let chaosKillTarget  = 15;      // kills to win in chaos mode (0 = use normal lives)

// Announcer text stack
let _announcerQueue = []; // { text, subtext, color, timer, maxTimer, scaleY }

// World-space item drops
let chaosItemDrops = []; // { x, y, type, label, color, timer, bobPhase, vy, collected }

// Spectator cameras for eliminated players
let _spectatorCams = []; // { playerIdx, x, y, active }

// ─── Chaos Event Definitions ─────────────────────────────────
const CHAOS_EVENT_POOL = [
  {
    id: 'gravity_flip',
    name: '⬆ GRAVITY FLIPPED!',
    subtext: 'The ceiling is the new floor',
    color: '#aa44ff',
    duration: 480,
    onStart() {
      tfGravityInverted = true;
      screenShake = Math.max(screenShake, 14);
      SoundManager.phaseUp && SoundManager.phaseUp();
    },
    onEnd() { tfGravityInverted = false; },
  },
  {
    id: 'time_slow',
    name: '⏱ TIME WARP!',
    subtext: 'Time slows to a crawl...',
    color: '#00ddff',
    duration: 420,
    onStart() {
      slowMotion = 0.30;
      SoundManager.portalOpen && SoundManager.portalOpen();
    },
    onEnd() { slowMotion = 1; },
  },
  {
    id: 'black_hole',
    name: '🕳 BLACK HOLES!',
    subtext: 'Watch your footing',
    color: '#6600cc',
    duration: 600,
    onStart() {
      const bx1 = GAME_W * 0.25 + (Math.random() - 0.5) * 80;
      const bx2 = GAME_W * 0.75 + (Math.random() - 0.5) * 80;
      tfBlackHoles.push({ x: bx1, y: GAME_H * 0.5, r: 38, angle: 0, pullForce: 0.40, timer: 600, maxTimer: 600, _chaos: true });
      tfBlackHoles.push({ x: bx2, y: GAME_H * 0.5, r: 38, angle: 0, pullForce: 0.40, timer: 600, maxTimer: 600, _chaos: true });
      screenShake = Math.max(screenShake, 10);
      SoundManager.explosion && SoundManager.explosion();
    },
    onEnd() {
      tfBlackHoles = tfBlackHoles.filter(bh => !bh._chaos);
    },
  },
  {
    id: 'giant_players',
    name: '🔺 EVERYONE GROWS!',
    subtext: 'Absolute units only',
    color: '#ff8800',
    duration: 540,
    onStart() {
      players.forEach(p => { if (!p.isBoss) { p.drawScale = 2.2; _applyChaosEffect(p, 'big', 540); } });
      screenShake = Math.max(screenShake, 10);
    },
    onEnd() {
      players.forEach(p => { if (!p.isBoss) { p.drawScale = 1; _removeChaosEffect(p, 'big'); } });
    },
  },
  {
    id: 'tiny_players',
    name: '🔻 EVERYONE SHRINKS!',
    subtext: 'Smol mode activated',
    color: '#44ff88',
    duration: 540,
    onStart() {
      players.forEach(p => { if (!p.isBoss) { p.drawScale = 0.45; _applyChaosEffect(p, 'tiny', 540); } });
    },
    onEnd() {
      players.forEach(p => { if (!p.isBoss) { p.drawScale = 1; _removeChaosEffect(p, 'tiny'); } });
    },
  },
  {
    id: 'weapon_rain',
    name: '⚔ WEAPON RAIN!',
    subtext: 'Grab what you can',
    color: '#ffdd00',
    duration: 0,
    onStart() {
      const weapKeys = Object.keys(WEAPONS).filter(k => k !== 'gauntlet');
      for (let i = 0; i < 7; i++) {
        const wk = weapKeys[Math.floor(Math.random() * weapKeys.length)];
        const x  = 60 + Math.random() * (GAME_W - 120);
        _spawnItemDropInternal(x, -30 - i * 25, 'weapon_' + wk, true);
      }
      SoundManager.pickup && SoundManager.pickup();
    },
    onEnd() {},
  },
  {
    id: 'reverse_controls',
    name: '🔄 CONTROLS REVERSED!',
    subtext: 'Left is right, right is left',
    color: '#ff4488',
    duration: 480,
    onStart() {
      tfControlsInverted = true;
      SoundManager.explosion && SoundManager.explosion();
    },
    onEnd() { tfControlsInverted = false; },
  },
  {
    id: 'exploding_platforms',
    name: '💥 UNSTABLE GROUND!',
    subtext: 'Platforms will explode',
    color: '#ff6600',
    duration: 360,
    onStart() {
      if (!currentArena) return;
      const nonFloor = currentArena.platforms.filter(pl => !pl.isFloor);
      const targets  = [...nonFloor].sort(() => Math.random() - 0.5).slice(0, Math.min(3, nonFloor.length));
      targets.forEach(pl => {
        pl._chaosExplodeTimer = 90 + Math.floor(Math.random() * 90);
        pl._chaosShaking = true;
      });
      screenShake = Math.max(screenShake, 12);
      SoundManager.explosion && SoundManager.explosion();
    },
    onEnd() {
      if (!currentArena) return;
      currentArena.platforms.forEach(pl => {
        if (pl._chaosShaking) { pl._chaosShaking = false; pl._chaosExplodeTimer = 0; pl.isFloorDisabled = false; }
      });
    },
  },
  {
    id: 'hyperspeed',
    name: '⚡ HYPERSPEED!',
    subtext: 'Everyone moves faster',
    color: '#00ffcc',
    duration: 480,
    onStart() {
      players.forEach(p => { if (!p.isBoss) _applyChaosEffect(p, 'speed', 480); });
    },
    onEnd() {
      players.forEach(p => { _removeChaosEffect(p, 'speed'); });
    },
  },
  {
    id: 'random_weapons',
    name: '🎲 WEAPON SWAP!',
    subtext: 'Everyone gets a surprise',
    color: '#ffaaff',
    duration: 0,
    onStart() {
      const weapKeys = Object.keys(WEAPONS).filter(k => k !== 'gauntlet');
      players.forEach(p => {
        if (p.isBoss || p.isRemote) return;
        const wk = weapKeys[Math.floor(Math.random() * weapKeys.length)];
        p.weaponKey = wk; p.weapon = WEAPONS[wk];
        spawnParticles(p.cx(), p.cy(), '#ffaaff', 8);
      });
      SoundManager.pickup && SoundManager.pickup();
    },
    onEnd() {},
  },
  {
    id: 'health_drain',
    name: '☠ HEALTH DRAIN!',
    subtext: 'Everyone loses HP over time',
    color: '#ff2222',
    duration: 420,
    _tick: 0,
    onStart() { this._tick = 0; SoundManager.death && SoundManager.death(); },
    onEnd() {},
    onTick() {
      this._tick++;
      if (this._tick % 50 === 0) {
        players.forEach(p => {
          if (!p.isBoss && p.health > 0 && p.invincible === 0) {
            p.health = Math.max(1, p.health - 4);
            spawnParticles(p.cx(), p.cy(), '#ff2222', 2);
          }
        });
      }
    },
  },
  {
    id: 'mercy_heal',
    name: '✨ MERCY!',
    subtext: 'Everyone is healed',
    color: '#44ff44',
    duration: 0,
    onStart() {
      players.forEach(p => {
        if (p.health > 0) {
          p.health = Math.min(p.maxHealth, p.health + 55);
          spawnParticles(p.cx(), p.cy(), '#44ff44', 14);
        }
      });
      SoundManager.superActivate && SoundManager.superActivate();
    },
    onEnd() {},
  },
];

// ─── Player Chaos Effects ─────────────────────────────────────
const _CHAOS_EFFECTS = {
  big:   { label: '⬆BIG',   onApply(p)  { p.drawScale = 2.2; },      onRemove(p) { if (p.drawScale === 2.2) p.drawScale = 1; } },
  tiny:  { label: '⬇TINY',  onApply(p)  { p.drawScale = 0.45; },     onRemove(p) { if (p.drawScale === 0.45) p.drawScale = 1; } },
  speed: { label: '⚡FAST', onApply(p)  { p._chaosSpeedMult = 1.65; }, onRemove(p) { delete p._chaosSpeedMult; } },
  slow:  { label: '🐌SLOW', onApply(p)  { p._chaosSpeedMult = 0.50; }, onRemove(p) { delete p._chaosSpeedMult; } },
};

function _applyChaosEffect(p, id, duration) {
  if (!p._chaosEffects) p._chaosEffects = new Map();
  if (!p._chaosEffects.has(id) && _CHAOS_EFFECTS[id]) _CHAOS_EFFECTS[id].onApply(p);
  p._chaosEffects.set(id, { timer: duration || 9999 });
}

function _removeChaosEffect(p, id) {
  if (!p._chaosEffects || !p._chaosEffects.has(id)) return;
  if (_CHAOS_EFFECTS[id]) _CHAOS_EFFECTS[id].onRemove(p);
  p._chaosEffects.delete(id);
}

function _tickChaosEffects() {
  if (!players) return;
  players.forEach(p => {
    if (!p._chaosEffects) return;
    for (const [id, state] of p._chaosEffects) {
      state.timer--;
      if (state.timer <= 0) _removeChaosEffect(p, id);
    }
    // Apply speed mutation every frame
    if (p._chaosSpeedMult && p._chaosSpeedMult !== 1 && Math.abs(p.vx) > 0.5) {
      const boost = (p._chaosSpeedMult - 1) * 2.5;
      p.vx += Math.sign(p.vx) * boost;
      const cap = 20 * (p._chaosSpeedMult > 1 ? p._chaosSpeedMult : 1);
      p.vx = Math.max(-cap, Math.min(cap, p.vx));
    }
  });
}

// ─── Announcer System ─────────────────────────────────────────
function chaosAnnounce(text, subtext, color, duration) {
  _announcerQueue.push({
    text, subtext: subtext || '',
    color: color || '#ffffff',
    timer: duration || 170,
    maxTimer: duration || 170,
    scaleY: 0,
  });
  // Cap queue at 3 so they don't stack forever
  if (_announcerQueue.length > 3) _announcerQueue.shift();
}

function _updateAnnouncer() {
  for (let i = _announcerQueue.length - 1; i >= 0; i--) {
    const a = _announcerQueue[i];
    const prog = a.timer / a.maxTimer;
    if (prog > 0.82)     a.scaleY = Math.min(1, a.scaleY + 0.14);
    else if (prog < 0.15) a.scaleY = Math.max(0, a.scaleY - 0.10);
    else                  a.scaleY = Math.min(1, a.scaleY + 0.07);
    a.timer--;
    if (a.timer <= 0) _announcerQueue.splice(i, 1);
  }
}

function _drawAnnouncer() {
  if (!_announcerQueue.length) return;
  // Draw newest on top
  for (let i = Math.max(0, _announcerQueue.length - 2); i < _announcerQueue.length; i++) {
    const a = _announcerQueue[i];
    if (a.scaleY <= 0.01) continue;

    const scale = canvas.width / 900;
    const cx    = canvas.width  / 2;
    const cy    = canvas.height * 0.20 + (i - (_announcerQueue.length - 1)) * Math.round(60 * scale);

    ctx.save();
    ctx.globalAlpha = Math.min(1, a.scaleY);
    ctx.transform(1, 0, 0, a.scaleY, 0, cy * (1 - a.scaleY));

    // Shadow / glow
    ctx.shadowColor = a.color;
    ctx.shadowBlur  = Math.round(28 * a.scaleY);

    const fs = Math.round(42 * scale * Math.min(1, a.scaleY * 1.2));
    ctx.font         = `900 ${fs}px Arial`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';

    // Drop shadow
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillText(a.text, cx + 2, cy + 2);
    ctx.fillStyle = a.color;
    ctx.fillText(a.text, cx, cy);

    if (a.subtext) {
      ctx.shadowBlur = 0;
      ctx.font = `${Math.round(16 * scale)}px Arial`;
      ctx.fillStyle = 'rgba(230,230,230,0.88)';
      ctx.fillText(a.subtext, cx, cy + Math.round(32 * scale));
    }
    ctx.restore();
  }
}

// ─── Kill Streak / Multi-Kill System ──────────────────────────
const _MK_NAMES = [
  null, null,
  { text: 'DOUBLE KILL!',  color: '#ffdd00' },
  { text: 'TRIPLE KILL!',  color: '#ff8800' },
  { text: 'QUAD KILL!',    color: '#ff4400' },
  { text: 'PENTA KILL!!',  color: '#ff0066' },
  { text: '✦ GODLIKE ✦',  color: '#ff00ff' },
];

function chaosModeRecordKill(killer) {
  if (!killer || !chaosModeStarted) return;
  if (!killer._chaosMultiKillTimer) killer._chaosMultiKillTimer = 0;
  if (!killer._chaosMultiKillCount) killer._chaosMultiKillCount = 0;

  if (killer._chaosMultiKillTimer > 0) {
    killer._chaosMultiKillCount++;
  } else {
    killer._chaosMultiKillCount = 1;
  }
  killer._chaosMultiKillTimer = 200; // 3.3-second multi-kill window

  const mk  = killer._chaosMultiKillCount;
  const def = _MK_NAMES[Math.min(mk, _MK_NAMES.length - 1)];
  if (mk >= 2 && def) {
    chaosAnnounce(def.text, killer.name + ' is unstoppable!', def.color, 190);
    SoundManager.phaseUp && SoundManager.phaseUp();
    screenShake = Math.max(screenShake, Math.min(mk * 4, 18));
  }

  // Kill-target win condition
  if (chaosKillTarget > 0 && (killer.kills || 0) >= chaosKillTarget) {
    chaosAnnounce(killer.name.toUpperCase() + ' WINS!', `First to ${chaosKillTarget} kills!`, killer.color, 360);
    setTimeout(() => { if (gameRunning) endGame(); }, 2400);
  }
}

function _tickMultiKillTimers() {
  if (!players) return;
  players.forEach(p => {
    if (p._chaosMultiKillTimer > 0) p._chaosMultiKillTimer--;
    else p._chaosMultiKillCount = 0;
  });
}

// ─── Item Drop System ─────────────────────────────────────────
const _ITEM_DROP_DEFS = {
  heal:         { label: '❤ HEAL',    color: '#ff4466' },
  shield_buff:  { label: '🛡 SHIELD', color: '#4488ff' },
  speed_boost:  { label: '⚡ SPEED',  color: '#00ffcc' },
  super_charge: { label: '★ SUPER',  color: '#ffdd00' },
  invincible:   { label: '✦ INVULN', color: '#aaaaff' },
};

function spawnItemDrop(x, y, type) {
  _spawnItemDropInternal(x, y, type, false);
}

function _spawnItemDropInternal(x, y, type, hasGravity) {
  const isWeapon = type.startsWith('weapon_');
  const wKey = isWeapon ? type.slice(7) : null;
  const def  = isWeapon
    ? { label: '⚔ ' + (WEAPONS[wKey]?.name || wKey).toUpperCase(), color: '#ffbbff' }
    : _ITEM_DROP_DEFS[type];
  if (!def) return;

  chaosItemDrops.push({
    x, y,
    type,
    label:     def.label,
    color:     def.color,
    timer:     720, // 12 second despawn
    bobPhase:  Math.random() * Math.PI * 2,
    vy:        hasGravity ? 4 : 0,
    collected: false,
  });
}

function _updateItemDrops() {
  for (let i = chaosItemDrops.length - 1; i >= 0; i--) {
    const item = chaosItemDrops[i];
    if (item.collected) { chaosItemDrops.splice(i, 1); continue; }

    // Weapon-rain gravity
    if (item.vy !== 0) {
      item.vy = Math.min(item.vy + 0.5, 14);
      item.y += item.vy;
      if (currentArena) {
        const floor = currentArena.platforms.find(pl => pl.isFloor && !pl.isFloorDisabled);
        if (floor && item.y + 12 >= floor.y) { item.y = floor.y - 12; item.vy = 0; }
      }
    }

    item.bobPhase += 0.06;
    item.timer--;
    if (item.timer <= 0) { chaosItemDrops.splice(i, 1); continue; }

    // Pickup detection
    players.forEach(p => {
      if (p.health <= 0 || item.collected) return;
      if (Math.abs(p.cx() - item.x) < 30 && Math.abs((p.y + p.h * 0.5) - item.y) < 30) {
        _collectItem(p, item);
        item.collected = true;
      }
    });
  }
}

function _collectItem(p, item) {
  spawnParticles(item.x, item.y, item.color, 12);
  SoundManager.pickup && SoundManager.pickup();

  if (item.type.startsWith('weapon_')) {
    const wk = item.type.slice(7);
    if (WEAPONS[wk]) { p.weaponKey = wk; p.weapon = WEAPONS[wk]; }
  } else if (item.type === 'heal') {
    p.health = Math.min(p.maxHealth, p.health + 35);
    spawnParticles(p.cx(), p.cy(), '#ff4466', 8);
  } else if (item.type === 'shield_buff') {
    p.invincible = Math.max(p.invincible, 200);
  } else if (item.type === 'speed_boost') {
    _applyChaosEffect(p, 'speed', 600);
  } else if (item.type === 'super_charge') {
    p.superMeter = 100; p.superReady = true;
    spawnParticles(p.cx(), p.cy(), '#ffdd00', 10);
  } else if (item.type === 'invincible') {
    p.invincible = Math.max(p.invincible, 280);
    spawnParticles(p.cx(), p.cy(), '#aaaaff', 10);
  }
}

// ─── Exploding Platform Tick ──────────────────────────────────
function _tickExplodingPlatforms() {
  if (!currentArena) return;
  currentArena.platforms.forEach(pl => {
    if (!pl._chaosShaking || !pl._chaosExplodeTimer) return;
    pl._chaosExplodeTimer--;
    if (pl._chaosExplodeTimer <= 0) {
      pl.isFloorDisabled = true;
      pl._chaosShaking   = false;
      spawnParticles(pl.x + pl.w / 2, pl.y, '#ff6600', 18);
      screenShake = Math.max(screenShake, 7);
      SoundManager.explosion && SoundManager.explosion();
      // Re-enable after 4 seconds
      setTimeout(() => { pl.isFloorDisabled = false; }, 4000);
    }
  });
}

// ─── Chaos Event Timer & Dispatch ────────────────────────────
function _triggerChaosEvent(id) {
  // Clean up previous event
  if (activeChaosEvent) {
    const prev = CHAOS_EVENT_POOL.find(e => e.id === activeChaosEvent.id);
    if (prev?.onEnd) prev.onEnd();
    activeChaosEvent = null;
  }

  const def = id
    ? CHAOS_EVENT_POOL.find(e => e.id === id)
    : CHAOS_EVENT_POOL[Math.floor(Math.random() * CHAOS_EVENT_POOL.length)];
  if (!def) return;

  activeChaosEvent = { id: def.id, timer: def.duration, duration: def.duration };
  def.onStart();
  chaosAnnounce(def.name, def.subtext, def.color, 210);
  screenShake = Math.max(screenShake, 8);

  // Host broadcasts event to guests
  if (typeof NetworkManager !== 'undefined' && NetworkManager.isConnected?.() && NetworkManager.isHost?.()) {
    NetworkManager.sendGameEvent('chaosEvent', { eventId: def.id });
  }
}

// Public — called from console or externally
function triggerChaosEvent(id) { _triggerChaosEvent(id); }

function _updateChaosEventTimer() {
  chaosEventTimer--;
  if (chaosEventTimer <= 0) {
    _triggerChaosEvent(null);
    _chaosNextInterval = 1200 + Math.floor(Math.random() * 1200); // 20–40s
    chaosEventTimer    = _chaosNextInterval;
  }

  if (activeChaosEvent) {
    const def = CHAOS_EVENT_POOL.find(e => e.id === activeChaosEvent.id);
    if (def?.onTick) def.onTick();
    if (activeChaosEvent.duration > 0) {
      activeChaosEvent.timer--;
      if (activeChaosEvent.timer <= 0) {
        if (def?.onEnd) def.onEnd();
        activeChaosEvent = null;
      }
    }
  }
}

// ─── Spectator Camera ────────────────────────────────────────
function _updateSpectatorCams() {
  _spectatorCams.forEach(sc => {
    const p = players[sc.playerIdx];
    if (!p) return;
    sc.active = (p.health <= 0);
    if (!sc.active) return;
    // Drift toward nearest living player
    const living = players.filter(q => q !== p && q.health > 0);
    if (living.length) {
      const nearest = living.reduce((a, b) =>
        Math.hypot(b.cx() - sc.x, b.cy() - sc.y) < Math.hypot(a.cx() - sc.x, a.cy() - sc.y) ? b : a);
      sc.x += (nearest.cx() - sc.x) * 0.018;
      sc.y += (nearest.cy() - sc.y) * 0.018;
    }
  });
}

function _drawSpectatorLabel() {
  const localP = players?.find(p => !p.isRemote && !p.isAI);
  if (!localP || localP.health > 0) return;
  const sc = canvas.width / 900;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  const bw = Math.round(170 * sc), bh = Math.round(24 * sc);
  ctx.fillRect(canvas.width / 2 - bw / 2, canvas.height - Math.round(44 * sc), bw, bh);
  ctx.font = `bold ${Math.round(12 * sc)}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(180,200,255,0.9)';
  ctx.fillText('👁  SPECTATING — Respawning soon', canvas.width / 2, canvas.height - Math.round(32 * sc));
  ctx.restore();
}

// ─── Score / Kill HUD ────────────────────────────────────────
function _drawChaosScoreHUD() {
  if (!chaosKillTarget || players.length < 2) return;
  const sc = canvas.width / 900;
  const cx = canvas.width / 2;
  const y  = Math.round(10 * sc);

  ctx.save();
  ctx.font = `bold ${Math.round(11 * sc)}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  let parts = [];
  players.forEach((p, i) => {
    if (p.isBoss) return;
    const kills = p.kills || 0;
    const bar   = '█'.repeat(kills) + '░'.repeat(Math.max(0, chaosKillTarget - kills));
    parts.push(p.name + ' ' + kills + '/' + chaosKillTarget);
  });
  const scoreStr = parts.join('  ·  ');

  const tw = ctx.measureText(scoreStr).width + Math.round(22 * sc);
  const bh = Math.round(20 * sc);

  ctx.fillStyle = 'rgba(0,0,0,0.60)';
  if (ctx.roundRect) ctx.roundRect(cx - tw / 2, y, tw, bh, Math.round(4 * sc));
  else ctx.rect(cx - tw / 2, y, tw, bh);
  ctx.fill();

  ctx.fillStyle = '#e8e8e8';
  ctx.fillText(scoreStr, cx, y + Math.round(4 * sc));

  // Next-event countdown
  const secsLeft = Math.ceil(chaosEventTimer / 60);
  const evStr = activeChaosEvent
    ? `⚡ ${CHAOS_EVENT_POOL.find(e => e.id === activeChaosEvent.id)?.name || '?'} — ${Math.ceil(activeChaosEvent.timer / 60)}s left`
    : `⚡ Next chaos in ${secsLeft}s`;
  ctx.font = `${Math.round(9 * sc)}px Arial`;
  ctx.fillStyle = activeChaosEvent ? '#ffdd44' : 'rgba(180,180,180,0.55)';
  ctx.fillText(evStr, cx, y + bh + Math.round(2 * sc));

  ctx.restore();
}

// ─── Active Event Badge (bottom-left) ────────────────────────
function _drawActiveEventBadge() {
  if (!activeChaosEvent) return;
  const def = CHAOS_EVENT_POOL.find(e => e.id === activeChaosEvent.id);
  if (!def) return;

  const sc = canvas.width / 900;
  const x  = Math.round(10 * sc);
  const bw = Math.round(168 * sc), bh = Math.round(28 * sc);
  const y  = canvas.height - Math.round(44 * sc);
  const pct = activeChaosEvent.duration > 0 ? activeChaosEvent.timer / activeChaosEvent.duration : 1;

  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.62)';
  if (ctx.roundRect) ctx.roundRect(x, y, bw, bh, Math.round(5 * sc));
  else ctx.rect(x, y, bw, bh);
  ctx.fill();

  // Progress bar
  if (activeChaosEvent.duration > 0) {
    ctx.fillStyle = def.color;
    ctx.globalAlpha = 0.55;
    ctx.fillRect(x, y + bh - Math.round(4 * sc), Math.round(bw * pct), Math.round(4 * sc));
    ctx.globalAlpha = 1;
  }

  ctx.font = `bold ${Math.round(11 * sc)}px Arial`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = def.color;
  ctx.shadowColor = def.color;
  ctx.shadowBlur  = 6;
  ctx.fillText(def.name, x + Math.round(8 * sc), y + bh / 2 - Math.round(1 * sc));
  ctx.restore();
}

// ─── Mutation Badges on Players ───────────────────────────────
function _drawChaosEffectBadges() {
  if (!players) return;
  players.forEach(p => {
    if (!p._chaosEffects || p._chaosEffects.size === 0 || p.health <= 0) return;
    let off = 0;
    ctx.save();
    ctx.font = `bold ${6}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const [id] of p._chaosEffects) {
      const def = _CHAOS_EFFECTS[id];
      if (!def) continue;
      ctx.fillStyle = 'rgba(0,0,0,0.58)';
      ctx.fillRect(p.cx() - 18, p.y - 24 - off, 36, 11);
      ctx.fillStyle = '#fff';
      ctx.fillText(def.label, p.cx(), p.y - 19 - off);
      off += 13;
    }
    ctx.restore();
  });
}

// ─── Item Drop Draw (world space) ────────────────────────────
function _drawItemDrops() {
  chaosItemDrops.forEach(item => {
    if (item.collected) return;
    const bY    = Math.sin(item.bobPhase) * 5;
    const alpha = item.timer < 90 ? item.timer / 90 : 1;

    ctx.save();
    ctx.globalAlpha = alpha;

    // Glow halo
    const grd = ctx.createRadialGradient(item.x, item.y + bY, 0, item.x, item.y + bY, 22);
    grd.addColorStop(0,   item.color + 'bb');
    grd.addColorStop(1,   item.color + '00');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(item.x, item.y + bY, 22, 0, Math.PI * 2);
    ctx.fill();

    // Pill box
    const bw = 46, bh = 18;
    ctx.fillStyle   = 'rgba(0,0,0,0.68)';
    ctx.strokeStyle = item.color;
    ctx.lineWidth   = 1.5;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(item.x - bw / 2, item.y + bY - bh / 2, bw, bh, 4);
    else ctx.rect(item.x - bw / 2, item.y + bY - bh / 2, bw, bh);
    ctx.fill();
    ctx.stroke();

    // Label
    ctx.fillStyle    = item.color;
    ctx.font         = 'bold 7px Arial';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(item.label, item.x, item.y + bY + 0.5);
    ctx.restore();
  });
}

// ─── Exploding Platform Visual ────────────────────────────────
function drawChaosPlatformEffects() {
  if (!chaosModeStarted || !currentArena) return;
  currentArena.platforms.forEach(pl => {
    if (!pl._chaosShaking) return;
    const pct  = pl._chaosExplodeTimer / 180;
    const shk  = (1 - pct) * 3;
    const ox   = (Math.random() - 0.5) * shk * 2;
    const oy   = (Math.random() - 0.5) * shk;
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.fillStyle   = '#ff6600';
    ctx.fillRect(pl.x + ox, pl.y + oy, pl.w, pl.h);
    ctx.fillStyle = '#ffdd00';
    ctx.globalAlpha = (1 - pct) * 0.5;
    ctx.fillRect(pl.x + ox, pl.y + oy, pl.w, 3);
    ctx.restore();
  });
}

// ─── Main Update (call once per game frame) ───────────────────
function updateChaosSystem() {
  if (!chaosModeStarted || !gameRunning) return;
  _updateChaosEventTimer();
  _tickExplodingPlatforms();
  _updateItemDrops();
  _tickChaosEffects();
  _updateAnnouncer();
  _tickMultiKillTimers();
  _updateSpectatorCams();

  // Periodic random item drop (every ~18s)
  if (frameCount % 1080 === 0) {
    const types = Object.keys(_ITEM_DROP_DEFS);
    const t     = types[Math.floor(Math.random() * types.length)];
    const fx    = currentArena?.platforms.find(pl => pl.isFloor);
    const dy    = fx ? fx.y - 55 : GAME_H - 80;
    const dx    = 80 + Math.random() * (GAME_W - 160);
    spawnItemDrop(dx, dy, t);
  }
}

// ─── Main Draw — screen space (call after ctx transform reset) ─
function drawChaosOverlay() {
  if (!chaosModeStarted) return;
  _drawChaosScoreHUD();
  _drawActiveEventBadge();
  _drawAnnouncer();
  _drawSpectatorLabel();
}

// ─── World-space Draw (call before transform reset) ───────────
function drawChaosWorldSpace() {
  if (!chaosModeStarted) return;
  drawChaosPlatformEffects();
  _drawItemDrops();
  _drawChaosEffectBadges();
}

// ─── Initialization ───────────────────────────────────────────
function initChaosMode() {
  chaosModeStarted   = true;
  chaosEventTimer    = 900 + Math.floor(Math.random() * 600); // 15–25s before first event
  _chaosNextInterval = 1200 + Math.floor(Math.random() * 1200);
  activeChaosEvent   = null;
  chaosItemDrops     = [];
  _announcerQueue    = [];
  _spectatorCams     = players.map((p, i) => ({ playerIdx: i, x: GAME_W / 2, y: GAME_H / 2, active: false }));

  players.forEach(p => {
    p._chaosEffects        = new Map();
    p._chaosMultiKillTimer = 0;
    p._chaosMultiKillCount = 0;
  });

  chaosAnnounce('⚡ CHAOS MODE ⚡', 'Anything can happen...', '#ff6600', 280);
  console.log('[ChaosMode] Initialized. Kill target:', chaosKillTarget || 'lives-based');
}

function cleanupChaosMode() {
  if (!chaosModeStarted) return;
  chaosModeStarted = false;

  // End any active event cleanly
  if (activeChaosEvent) {
    const def = CHAOS_EVENT_POOL.find(e => e.id === activeChaosEvent.id);
    if (def?.onEnd) def.onEnd();
    activeChaosEvent = null;
  }

  // Restore globals
  tfGravityInverted  = false;
  tfControlsInverted = false;
  slowMotion         = 1;
  tfBlackHoles       = tfBlackHoles.filter(bh => !bh._chaos);

  chaosItemDrops  = [];
  _announcerQueue = [];

  players.forEach(p => {
    if (!p) return;
    p.drawScale = 1;
    if (p._chaosEffects) {
      for (const [id] of p._chaosEffects) { if (_CHAOS_EFFECTS[id]) _CHAOS_EFFECTS[id].onRemove(p); }
      p._chaosEffects.clear();
    }
    delete p._chaosSpeedMult;
  });

  if (currentArena) {
    currentArena.platforms.forEach(pl => {
      pl._chaosShaking      = false;
      pl._chaosExplodeTimer = 0;
      if (pl._chaosExploding) { pl.isFloorDisabled = false; pl._chaosExploding = false; }
    });
  }
}

// ─── Console & Host Commands ──────────────────────────────────
// Returns true if the command was handled, false if unrecognized.
function handleChaosConsoleCmd(raw) {
  const parts = raw.trim().split(/\s+/);
  const cmd   = parts[0].toLowerCase();
  const sub   = (parts[1] || '').toLowerCase();

  if (cmd === 'chaos') {
    if (sub === 'on')    { chaosMode = true;  if (gameRunning && !chaosModeStarted) initChaosMode(); return true; }
    if (sub === 'off')   { chaosMode = false; cleanupChaosMode(); return true; }
    if (sub === 'event') {
      const evId = parts.slice(2).join('_') || CHAOS_EVENT_POOL[Math.floor(Math.random() * CHAOS_EVENT_POOL.length)].id;
      triggerChaosEvent(evId);
      return true;
    }
    if (sub === 'score') { const n = parseInt(parts[2]); if (!isNaN(n)) { chaosKillTarget = n; } return true; }
    if (sub === 'drop')  { spawnItemDrop(GAME_W / 2, 80, parts[2] || 'heal'); return true; }
    if (sub === 'reset') { cleanupChaosMode(); if (gameRunning) initChaosMode(); return true; }
    if (sub === 'list')  { console.log('[Chaos] Events:', CHAOS_EVENT_POOL.map(e => e.id).join(', ')); return true; }
    // No sub → toggle
    chaosMode = !chaosMode;
    if (chaosMode && gameRunning && !chaosModeStarted) initChaosMode();
    else if (!chaosMode) cleanupChaosMode();
    return true;
  }

  if (cmd === 'mutate') {
    const who  = sub || 'all';
    const eff  = parts[2] || 'speed';
    const dur  = parseInt(parts[3]) || 600;
    const tgts = (who === 'all' || who === 'everyone')
      ? players
      : players.filter((_, i) => who === ('p' + (i + 1)));
    tgts.forEach(p => _applyChaosEffect(p, eff, dur));
    return true;
  }

  if (cmd === 'announce') {
    chaosAnnounce(parts.slice(1).join(' ').toUpperCase(), '', '#ffffff', 230);
    return true;
  }

  if (cmd === 'spawn' && sub === 'item') {
    const t = parts[2] || 'heal';
    spawnItemDrop(80 + Math.random() * (GAME_W - 160), 80, t);
    return true;
  }

  return false; // not handled
}

// ─── Network Sync Handler ────────────────────────────────────
// Returns true if the event was a chaos event and was handled.
function handleChaosNetworkEvent(msg) {
  if (msg.event === 'chaosEvent' && msg.data?.eventId) {
    triggerChaosEvent(msg.data.eventId);
    return true;
  }
  if (msg.event === 'chaosItemDrop' && msg.data) {
    spawnItemDrop(msg.data.x, msg.data.y, msg.data.type);
    return true;
  }
  return false;
}
