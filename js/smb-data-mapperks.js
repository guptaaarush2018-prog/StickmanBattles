'use strict';
// smb-data-mapperks.js — MAP_PERK_DEFS, spawn helpers, updateMapPerks
// Depends on: smb-globals.js, smb-data-arenas.js (ARENAS, currentArena), smb-particles.js (dealDamage, spawnParticles)
// Must load BEFORE smb-data-mapperks-draw.js

// ============================================================
// MAP PERKS — per-arena special item/event state
// ============================================================
const MAP_PERK_DEFS = {
  ruins: {
    items: [
      { baseX: 135, baseY: 400 },  // on left block
      { baseX: 450, baseY: 400 },  // on center block
      { baseX: 765, baseY: 400 },  // on right block
    ],
    types: ['speed','power','heal','shield','maxhp','curse_slow','curse_weak','curse_fragile','curse_maxhp_perm']
  },
  forest: {
    healZones: [{ x: 0, w: 900, healRate: 60 }]  // gentle healing every 60 frames
  },
  city: {
    carCooldown: 600  // frames between car runs
  },
  lava: {
    eruptionCooldown: 480
  },
  cave: {
    stalactites:       [],
    stalactiteCooldown: 0
  },
  volcano: {
    geysers:       [],
    geyserCooldown: 0
  },
  haunted: {
    ghosts:       [],
    ghostCooldown: 0
  },
  cyberpunk: {
    zapTimer:  0,
    zapActive: false,
    zapLine:   0
  },
  neonGrid: {
    boostPads: [{ x: 180, y: 478 }, { x: 540, y: 478 }, { x: 750, y: 478 }]
  }
};

let mapPerkState = {};  // runtime state per arena

function initMapPerks(key) {
  mapItems    = [];
  mapPerkState = {};
  if (key === 'ruins') {
    const def = MAP_PERK_DEFS.ruins;
    for (const pos of def.items) {
      mapItems.push({
        x: pos.baseX, y: pos.baseY - 22,
        type: def.types[Math.floor(Math.random() * def.types.length)],
        collected: false, respawnIn: 0, radius: 14, animPhase: Math.random() * Math.PI * 2
      });
    }
    mapPerkState.crates       = [];
    mapPerkState.crateCooldown = 300; // first crate after 5s
  }
  if (key === 'city') {
    mapPerkState.carCooldown = MAP_PERK_DEFS.city.carCooldown;
    mapPerkState.cars        = [];
  }
  if (key === 'lava') {
    mapPerkState.eruptCooldown = MAP_PERK_DEFS.lava.eruptionCooldown;
    mapPerkState.eruptions     = [];
  }
  if (key === 'cave') {
    mapPerkState.stalactites       = [];
    mapPerkState.stalactiteCooldown = 480; // first drop after ~8s
  }
  if (key === 'volcano') {
    mapPerkState.geysers       = [];
    mapPerkState.geyserCooldown = 420;
  }
  if (key === 'haunted') {
    mapPerkState.ghosts       = [];
    mapPerkState.ghostCooldown = 600;
  }
  if (key === 'cyberpunk') {
    mapPerkState.zapTimer  = 900; // first zap after 15s
    mapPerkState.zapActive = false;
    mapPerkState.zapLine   = GAME_W / 2;
  }
  if (key === 'underwater') {
    mapPerkState.bubbles = Array.from({ length: 18 }, (_, i) => ({
      x: 30 + i * 50, y: 480 + Math.random() * 40, speed: 0.6 + Math.random() * 0.8
    }));
  }
}

// Helper used by both the random forest encounter logic and the Director.
function spawnForestBeastNow() {
  if (!currentArena || forestBeast || forestBeastCooldown > 0) return;
  const pls = currentArena.platforms;
  if (!pls || pls.length === 0) return;
  const pl  = pls[Math.floor(Math.random() * pls.length)];
  const spawnX = pl.x + Math.random() * pl.w;
  const spawnY = pl.y - 62;
  forestBeast = new ForestBeast(spawnX, spawnY);
  // 1/10 chance: spawn as raged beast (lower HP, higher everything else)
  if (Math.random() < 0.10) {
    forestBeast.isRaged     = true;
    forestBeast.health      = 180;
    forestBeast.maxHealth   = 180;
    forestBeast.dmgMult     = 2.2;
    forestBeast.kbBonus     = 1.8;
    forestBeast.kbResist    = 0.25;
    forestBeast.color       = '#ff2200';
    forestBeast.name        = 'RAGED BEAST';
    // Speed handled in updateAI via dash cooldown tweak
    forestBeast.dashCooldown = 60;
  }
  // Target the player with lowest health
  const livingPlayers = players.filter(p => !p.isBoss && p.health > 0);
  if (livingPlayers.length > 0) {
    forestBeast.target = livingPlayers.reduce((a, b) => a.health < b.health ? a : b);
  }
  minions.push(forestBeast);
  spawnParticles(spawnX, spawnY, forestBeast.isRaged ? '#ff2200' : '#1a8a2e', 20);
  if (settings.screenShake) screenShake = Math.max(screenShake, 10);
  const beastLabel = forestBeast.isRaged ? 'RAGED BEAST!' : 'BEAST APPEARS!';
  if (settings.dmgNumbers) damageTexts.push(new DamageText(spawnX, spawnY - 20, beastLabel, forestBeast.isRaged ? '#ff4400' : '#1aff3a'));
}

// Helper used by both the random ice encounter logic and the Director.
function spawnYetiNow() {
  if (!currentArena || yeti || yetiCooldown > 0) return;
  const spawnX = Math.random() < 0.5 ? 60 : GAME_W - 60;
  yeti = new Yeti(spawnX, 200);
  const living = players.filter(p => !p.isBoss && p.health > 0);
  yeti.target = living[0] || players[0];
  minions.push(yeti);
  spawnParticles(spawnX, 200, '#88ccff', 20);
  if (settings.dmgNumbers) damageTexts.push(new DamageText(GAME_W / 2, 80, 'A YETI APPEARS!', '#88ccff'));
}

function updateMapPerks() {
  if (!currentArena || !gameRunning) return;


  // ---- RUINS: Artifact pickups ----
  if (currentArenaKey === 'ruins') {
    for (const item of mapItems) {
      item.animPhase += 0.06;
      if (item.collected) {
        item.respawnIn--;
        if (item.respawnIn <= 0) {
          item.collected = false;
          item.type = MAP_PERK_DEFS.ruins.types[Math.floor(Math.random() * MAP_PERK_DEFS.ruins.types.length)];
        }
        continue;
      }
      // Check proximity
      for (const p of players) {
        if (p.isBoss || p.health <= 0) continue;
        const dx = p.cx() - item.x, dy = (p.y + p.h/2) - item.y;
        if (Math.hypot(dx, dy) < 28) {
          item.collected  = true;
          item.respawnIn  = 1800 + Math.random() * 600; // 30–40 s
          applyMapPerk(p, item.type);
          SoundManager.pickup();
          spawnParticles(item.x, item.y, '#ffd700', 16);
          screenShake = Math.max(screenShake, 6);
          if (settings.dmgNumbers) {
            const labels = { speed:'SWIFT!', power:'POWER!', heal:'+30 HP', shield:'SHIELD!', maxhp:'+15 MAX HP' };
            damageTexts.push(new DamageText(item.x, item.y - 20, labels[item.type] || '!', '#ffd700'));
          }
          break;
        }
      }
    }

    // ---- RUINS: Breakable crates ----
    if (!mapPerkState.crates)       mapPerkState.crates       = [];
    if (mapPerkState.crateCooldown === undefined) mapPerkState.crateCooldown = 300;
    if (mapPerkState.crates.length < 3) {
      mapPerkState.crateCooldown--;
      if (mapPerkState.crateCooldown <= 0) {
        // Pick a random platform surface to place the crate
        const pls = currentArena.platforms.filter(p => !p.isFloor && p.w >= 60);
        if (pls.length > 0) {
          const pl  = pls[Math.floor(Math.random() * pls.length)];
          const cx  = pl.x + 20 + Math.random() * (pl.w - 40);
          const cy  = pl.y; // crate bottom sits on platform top
          // Avoid stacking on existing crates
          const occupied = mapPerkState.crates.some(c => Math.abs(c.x - cx) < 50 && Math.abs(c.y - cy) < 40);
          if (!occupied) {
            const t = MAP_PERK_DEFS.ruins.types[Math.floor(Math.random() * MAP_PERK_DEFS.ruins.types.length)];
            mapPerkState.crates.push({ x: cx, y: cy, hp: 50, maxHp: 50, type: t, hitShake: 0, lastHitFrame: -30 });
          }
        }
        mapPerkState.crateCooldown = 1200 + Math.floor(Math.random() * 600); // 20–30 s
      }
    }
    // Crate hit detection
    for (let ci = mapPerkState.crates.length - 1; ci >= 0; ci--) {
      const crate = mapPerkState.crates[ci];
      if (crate.hitShake > 0) crate.hitShake--;
      for (const p of players) {
        if (p.health <= 0 || p.state !== 'attacking') continue;
        if (frameCount - crate.lastHitFrame < 12) continue;
        const reach = (p.weapon ? (p.weapon.range || 40) : 40) + 20;
        const inX = Math.abs(p.cx() - crate.x) < reach;
        const inY = p.y < crate.y && p.y + p.h + 10 > crate.y;
        if (inX && inY) {
          const dmg = p.weapon ? (p.weapon.damage || 10) : 10;
          crate.hp -= dmg;
          crate.hitShake = 6;
          crate.lastHitFrame = frameCount;
          spawnParticles(crate.x, crate.y - 15, '#8B5E3C', 6);
          if (crate.hp <= 0) {
            applyMapPerk(p, crate.type);
            spawnParticles(crate.x, crate.y - 15, '#ffd700', 20);
            screenShake = Math.max(screenShake, 5);
            if (settings.dmgNumbers) {
              const labels = { speed:'SWIFT!', power:'POWER!', heal:'+30 HP', shield:'SHIELD!', maxhp:'+15 MAX HP' };
              damageTexts.push(new DamageText(crate.x, crate.y - 40, labels[crate.type] || '!', '#ffd700'));
            }
            mapPerkState.crates.splice(ci, 1);
          }
          break;
        }
      }
    }
  }

  // ---- FOREST: Gradual healing ----
  if (currentArenaKey === 'forest' && frameCount % 90 === 0) {
    for (const p of players) {
      if (p.isBoss || p.health <= 0 || p.hurtTimer > 0) continue;
      if (p.onGround && p.health < p.maxHealth) {
        p.health = Math.min(p.maxHealth, p.health + 1);
        if (settings.particles && Math.random() < 0.4) {
          spawnParticles(p.cx(), p.y, '#44ff44', 3);
        }
      }
    }
  }

  // ---- FOREST: Rare beast encounter ----
  if (currentArenaKey === 'forest') {
    // Track beast death → set cooldown
    if (forestBeast && forestBeast.health <= 0) {
      _achCheckBeastDead();
      forestBeast = null;
      forestBeastCooldown = SPAWN_CONFIG.forestBeast.respawnDelay;
    }
    if (forestBeastCooldown > 0) forestBeastCooldown--;
    // Deterministic interval spawn — no hidden randomness
    if (!forestBeast && forestBeastCooldown <= 0 && frameCount % SPAWN_CONFIG.forestBeast.spawnInterval === 0) {
      spawnForestBeastNow();
    }
  }

  // ---- CITY: Occasional car ----
  if (currentArenaKey === 'city') {
    if (!mapPerkState.cars)        mapPerkState.cars        = [];
    if (!mapPerkState.carCooldown) mapPerkState.carCooldown = MAP_PERK_DEFS.city.carCooldown;
    if (mapPerkState.carCooldown > 0) {
      mapPerkState.carCooldown--;
    } else {
      // Spawn a car
      const fromLeft = Math.random() < 0.5;
      mapPerkState.cars.push({ x: fromLeft ? -60 : GAME_W + 60, y: 432,
        vx: fromLeft ? 9 : -9, warned: false, warnTimer: 60 });
      mapPerkState.carCooldown = 1200 + Math.floor(Math.random() * 800);
    }
    for (let ci = mapPerkState.cars.length - 1; ci >= 0; ci--) {
      const car = mapPerkState.cars[ci];
      if (car.warnTimer > 0) { car.warnTimer--; continue; }
      car.x += car.vx;
      if (car.x < -120 || car.x > GAME_W + 120) {
        mapPerkState.cars.splice(ci, 1); continue;
      }
      // Damage players in path
      let _carExploded = false;
      for (const p of players) {
        if (p.health <= 0 || p.invincible > 0) continue;
        if (Math.abs(p.cx() - car.x) < 40 && Math.abs((p.y + p.h) - car.y) < 60) {
          if (p.isTrueForm) {
            spawnParticles(car.x, car.y - 20, '#ff8800', 16);
            spawnParticles(car.x, car.y - 20, '#ffff00', 8);
            if (settings.screenShake) screenShake = Math.max(screenShake, 14);
            car._exploded = true; _carExploded = true; break;
          }
          dealDamage(players.find(q => q.isBoss) || players[1], p, 18, 16);
        }
      }
      if (_carExploded) { mapPerkState.cars.splice(ci, 1); continue; }
    }
  }

  // ---- LAVA: Eruptions ----
  if (currentArenaKey === 'lava') {
    if (!mapPerkState.eruptCooldown) mapPerkState.eruptCooldown = 480;
    if (!mapPerkState.eruptions)     mapPerkState.eruptions     = [];
    mapPerkState.eruptCooldown--;
    if (mapPerkState.eruptCooldown <= 0) {
      const ex = 60 + Math.random() * 780;
      mapPerkState.eruptions.push({ x: ex, timer: 180 });
      mapPerkState.eruptCooldown = 360 + Math.floor(Math.random() * 360);
    }
    for (let ei = mapPerkState.eruptions.length - 1; ei >= 0; ei--) {
      const er = mapPerkState.eruptions[ei];
      er.timer--;
      if (er.timer <= 0) { mapPerkState.eruptions.splice(ei, 1); continue; }
      if (er.timer % 5 === 0 && settings.particles && particles.length < MAX_PARTICLES) {
        const upA = -Math.PI/2 + (Math.random()-0.5)*0.5;
        const _p = _getParticle();
        _p.x = er.x; _p.y = currentArena.lavaY || 442;
        _p.vx = Math.cos(upA)*5; _p.vy = Math.sin(upA)*(8+Math.random()*8);
        _p.color = Math.random() < 0.5 ? '#ff4400' : '#ff8800';
        _p.size = 3+Math.random()*4; _p.life = 30+Math.random()*20; _p.maxLife = 50;
        particles.push(_p);
      }
      // Damage nearby players — wider (±100px), taller (250px above lava)
      for (const p of players) {
        if (p.isBoss || p.health <= 0 || p.invincible > 0) continue;
        if (Math.abs(p.cx() - er.x) < 100 && p.y + p.h > (currentArena.lavaY || 442) - 250) {
          if (er.timer % 10 === 0) dealDamage(players.find(q => q.isBoss) || players[1], p, Math.ceil(p.maxHealth * 0.044), 8);
        }
      }
    }
  }

  // ---- SPACE: Falling meteorites ----
  if (currentArenaKey === 'space') {
    if (!mapPerkState.meteors)         mapPerkState.meteors        = [];
    if (!mapPerkState.meteorCooldown)  mapPerkState.meteorCooldown = 1800;
    mapPerkState.meteorCooldown--;
    if (mapPerkState.meteorCooldown <= 0) {
      mapPerkState.meteorCooldown = 1200 + Math.floor(Math.random() * 600);
      const mx = 80 + Math.random() * (GAME_W - 160);
      mapPerkState.meteors.push({ x: mx, y: -20, vy: 0, warned: true, warnTimer: 90, landed: false });
    }
    for (let mi = mapPerkState.meteors.length - 1; mi >= 0; mi--) {
      const m = mapPerkState.meteors[mi];
      if (m.warnTimer > 0) { m.warnTimer--; continue; }
      m.vy += 0.55; // gravity accelerates
      m.y  += m.vy;
      if (m.y > GAME_H + 20) { mapPerkState.meteors.splice(mi, 1); continue; }
      // Damage players in blast radius
      for (const p of players) {
        if (p.health <= 0 || p.invincible > 0) continue;
        if (Math.hypot(p.cx() - m.x, p.cy() - m.y) < 55) {
          spawnParticles(m.x, m.y, '#ff8844', 14);
          dealDamage(players[1] || players[0], p, 28, 22);
          mapPerkState.meteors.splice(mi, 1);
          if (settings.screenShake) screenShake = Math.max(screenShake, 18);
          break;
        }
      }
      // Explode on ground (y > 460)
      if (mi < mapPerkState.meteors.length && mapPerkState.meteors[mi].y > 455) {
        spawnParticles(m.x, 460, '#ff8844', 20);
        if (settings.screenShake) screenShake = Math.max(screenShake, 14);
        mapPerkState.meteors.splice(mi, 1);
      }
    }
  }

  // ---- CITY: Moving cars that deal damage ----
  if (currentArenaKey === 'city') {
    if (!mapPerkState.cityCars)    mapPerkState.cityCars    = [];
    if (mapPerkState.carSpawnCd === undefined) mapPerkState.carSpawnCd = 180;
    mapPerkState.carSpawnCd--;
    if (mapPerkState.carSpawnCd <= 0) {
      mapPerkState.carSpawnCd = 240 + Math.floor(Math.random() * 240);
      const goRight = Math.random() < 0.5;
      mapPerkState.cityCars.push({
        x:      goRight ? -80 : GAME_W + 80,
        y:      438,            // floor level
        w:      55, h: 22,
        vx:     goRight ? 6.5 : -6.5,
        color:  ['#cc2200','#0033cc','#448800','#cc8800'][Math.floor(Math.random() * 4)],
        warned: false,
        hit:    new Set(), // dedup: each player can only be hit once per car
      });
      // Warn players with a HUD message
      if (settings.dmgNumbers) damageTexts.push(new DamageText(GAME_W / 2, 105, 'CAR!', '#ffcc00'));
    }
    for (let ci = mapPerkState.cityCars.length - 1; ci >= 0; ci--) {
      const car = mapPerkState.cityCars[ci];
      car.x += car.vx;
      // Remove when off-screen
      if (car.x > GAME_W + 120 || car.x < -120) { mapPerkState.cityCars.splice(ci, 1); continue; }
      // Damage players
      let _cityCarHit = false;
      for (const p of players) {
        if (p.health <= 0 || p.invincible > 0 || p.isBoss) continue;
        if (car.hit.has(p)) continue; // already hit this player — skip
        const carCX = car.x + car.w / 2;
        const carCY = car.y - car.h / 2;
        if (Math.abs(p.cx() - carCX) < car.w / 2 + p.w / 2 &&
            Math.abs((p.y + p.h / 2) - carCY) < car.h / 2 + p.h / 2) {
          if (p.isTrueForm) {
            spawnParticles(carCX, carCY, '#ff8800', 16);
            spawnParticles(carCX, carCY, '#ffff00', 8);
            if (settings.screenShake) screenShake = Math.max(screenShake, 14);
            _cityCarHit = true; break;
          }
          car.hit.add(p);
          dealDamage(null, p, 20, 28, 1.0, false, 16);
          spawnParticles(p.cx(), p.cy(), '#ffcc00', 12);
          if (settings.screenShake) screenShake = Math.max(screenShake, 12);
          _cityCarHit = true; break; // car destroyed on first player hit
        }
      }
      if (_cityCarHit) { mapPerkState.cityCars.splice(ci, 1); continue; }
    }
  }

  // ---- ICE: Yeti rare encounter ----
  if (currentArenaKey === 'ice') {
    // Clean up dead yeti and start respawn cooldown
    if (yeti && yeti.health <= 0) { _achCheckYetiDead(); yeti = null; yetiCooldown = SPAWN_CONFIG.yeti.respawnDelay; }
    if (yetiCooldown > 0) yetiCooldown--;
    // Deterministic interval spawn — no hidden randomness
    if (!yeti && yetiCooldown <= 0 && frameCount >= SPAWN_CONFIG.yeti.minDelay && frameCount % SPAWN_CONFIG.yeti.spawnInterval === 0) {
      spawnYetiNow();
    }
  }

  // ---- ICE/SNOW: Blizzard wind gusts ----
  if (currentArenaKey === 'ice') {
    if (mapPerkState.blizzardTimer === undefined) mapPerkState.blizzardTimer = 1200;
    if (mapPerkState.blizzardActive === undefined) mapPerkState.blizzardActive = false;
    if (mapPerkState.blizzardDir    === undefined) mapPerkState.blizzardDir    = 1;
    mapPerkState.blizzardTimer--;
    if (!mapPerkState.blizzardActive && mapPerkState.blizzardTimer <= 0) {
      mapPerkState.blizzardActive = true;
      mapPerkState.blizzardDir    = Math.random() < 0.5 ? 1 : -1;
      mapPerkState.blizzardTimer  = 180; // gust lasts 3 seconds
      if (settings.dmgNumbers) damageTexts.push(new DamageText(GAME_W / 2, 80, 'BLIZZARD!', '#88ccff'));
    } else if (mapPerkState.blizzardActive && mapPerkState.blizzardTimer <= 0) {
      mapPerkState.blizzardActive = false;
      mapPerkState.blizzardTimer  = 1200 + Math.floor(Math.random() * 600);
    }
    if (mapPerkState.blizzardActive) {
      const pushForce = 1.2 * mapPerkState.blizzardDir;
      for (const p of players) {
        if (p.health <= 0) continue;
        p.vx += pushForce;
        // Spawn snow particles
        if (Math.random() < 0.25 && particles.length < MAX_PARTICLES) {
          const _p = _getParticle();
          _p.x = Math.random() * GAME_W; _p.y = -5;
          _p.vx = -2 * mapPerkState.blizzardDir + (Math.random()-0.5)*2;
          _p.vy = 2 + Math.random() * 2;
          _p.color = 'rgba(200,230,255,0.7)'; _p.size = 2 + Math.random() * 2;
          _p.life = 50; _p.maxLife = 50;
          particles.push(_p);
        }
      }
    }
  }

  // ---- CAVE: Falling stalactites ----
  if (currentArenaKey === 'cave') {
    if (!mapPerkState.stalactites)        mapPerkState.stalactites        = [];
    if (mapPerkState.stalactiteCooldown === undefined) mapPerkState.stalactiteCooldown = 480;
    mapPerkState.stalactiteCooldown--;
    if (mapPerkState.stalactiteCooldown <= 0 && mapPerkState.stalactites.length < 5) {
      const sx = 60 + Math.random() * (GAME_W - 120);
      mapPerkState.stalactites.push({ x: sx, y: 20, vy: 0, fallen: false, warnTimer: 90 });
      mapPerkState.stalactiteCooldown = 360 + Math.floor(Math.random() * 300);
    }
    for (let si = mapPerkState.stalactites.length - 1; si >= 0; si--) {
      const st = mapPerkState.stalactites[si];
      if (st.warnTimer > 0) { st.warnTimer--; continue; }
      st.vy += 0.6;
      st.y  += st.vy;
      if (st.y > GAME_H + 20) { mapPerkState.stalactites.splice(si, 1); continue; }
      for (const p of players) {
        if (p.health <= 0 || p.invincible > 0 || p.isBoss) continue;
        if (Math.abs(p.cx() - st.x) < 18 && Math.abs((p.y + p.h / 2) - st.y) < 30) {
          dealDamage(null, p, 22, 14);
          spawnParticles(st.x, st.y, '#8a5a3a', 10);
          if (settings.screenShake) screenShake = Math.max(screenShake, 8);
          mapPerkState.stalactites.splice(si, 1);
          break;
        }
      }
    }
  }

  // ---- VOLCANO: Lava geysers ----
  if (currentArenaKey === 'volcano') {
    if (!mapPerkState.geysers)        mapPerkState.geysers        = [];
    if (mapPerkState.geyserCooldown === undefined) mapPerkState.geyserCooldown = 420;
    mapPerkState.geyserCooldown--;
    if (mapPerkState.geyserCooldown <= 0 && mapPerkState.geysers.length < 4) {
      const gx = 80 + Math.random() * (GAME_W - 160);
      mapPerkState.geysers.push({ x: gx, timer: 200 });
      mapPerkState.geyserCooldown = 300 + Math.floor(Math.random() * 300);
    }
    for (let gi = mapPerkState.geysers.length - 1; gi >= 0; gi--) {
      const gy = mapPerkState.geysers[gi];
      gy.timer--;
      if (gy.timer <= 0) { mapPerkState.geysers.splice(gi, 1); continue; }
      if (gy.timer % 4 === 0 && settings.particles && particles.length < MAX_PARTICLES) {
        const upA = -Math.PI / 2 + (Math.random() - 0.5) * 0.6;
        const _p = _getParticle();
        _p.x = gy.x; _p.y = currentArena.lavaY || 442;
        _p.vx = Math.cos(upA) * 4; _p.vy = Math.sin(upA) * (9 + Math.random() * 9);
        _p.color = Math.random() < 0.5 ? '#ff5500' : '#ff9900';
        _p.size = 4 + Math.random() * 5; _p.life = 35 + Math.random() * 20; _p.maxLife = 55;
        particles.push(_p);
      }
      for (const p of players) {
        if (p.isBoss || p.health <= 0 || p.invincible > 0) continue;
        if (Math.abs(p.cx() - gy.x) < 90 && p.y + p.h > (currentArena.lavaY || 442) - 280) {
          if (gy.timer % 10 === 0) dealDamage(null, p, Math.ceil(p.maxHealth * 0.04), 7);
        }
      }
    }
  }

  // ---- HAUNTED: Drifting ghost NPCs ----
  if (currentArenaKey === 'haunted') {
    if (!mapPerkState.ghosts)        mapPerkState.ghosts        = [];
    if (mapPerkState.ghostCooldown === undefined) mapPerkState.ghostCooldown = 600;
    mapPerkState.ghostCooldown--;
    if (mapPerkState.ghostCooldown <= 0 && mapPerkState.ghosts.length < 3) {
      const fromLeft = Math.random() < 0.5;
      mapPerkState.ghosts.push({
        x: fromLeft ? -40 : GAME_W + 40,
        y: 100 + Math.random() * 300,
        vx: fromLeft ? 1.4 : -1.4,
        timer: 480
      });
      mapPerkState.ghostCooldown = 480 + Math.floor(Math.random() * 480);
    }
    for (let ghi = mapPerkState.ghosts.length - 1; ghi >= 0; ghi--) {
      const gh = mapPerkState.ghosts[ghi];
      gh.x += gh.vx;
      gh.timer--;
      if (gh.timer <= 0 || gh.x < -80 || gh.x > GAME_W + 80) {
        mapPerkState.ghosts.splice(ghi, 1); continue;
      }
      for (const p of players) {
        if (p.health <= 0 || p.invincible > 0 || p.isBoss) continue;
        if (Math.hypot(p.cx() - gh.x, p.cy() - gh.y) < 30) {
          dealDamage(null, p, 8, 5);
          spawnParticles(gh.x, gh.y, '#aa88ff', 8);
          mapPerkState.ghosts.splice(ghi, 1);
          break;
        }
      }
    }
  }

  // ---- NEON GRID: Speed boost pads on floor ----
  if (currentArenaKey === 'neonGrid') {
    const pads = (mapPerkState.boostPads) || [];
    for (const pad of pads) {
      for (const p of players) {
        if (p.health <= 0 || p.isBoss) continue;
        if (p.onGround && Math.abs(p.cx() - pad.x) < 30) {
          p._speedBuff = Math.max(p._speedBuff || 0, 18); // 0.3s burst
          if (frameCount % 30 === 0) spawnParticles(pad.x, pad.y, '#00ff88', 5);
        }
      }
    }
  }

  // ---- CYBERPUNK: Periodic floor zap ----
  if (currentArenaKey === 'cyberpunk') {
    if (mapPerkState.zapTimer === undefined) mapPerkState.zapTimer = 900;
    if (mapPerkState.zapActive === undefined) mapPerkState.zapActive = false;
    mapPerkState.zapTimer--;
    if (!mapPerkState.zapActive && mapPerkState.zapTimer <= 0) {
      mapPerkState.zapActive = true;
      mapPerkState.zapLine   = 60 + Math.random() * (GAME_W - 120);
      mapPerkState.zapTimer  = 120; // zap lasts 2s
      if (settings.dmgNumbers) damageTexts.push(new DamageText(GAME_W / 2, 80, 'ZAP!', '#00eeff'));
    } else if (mapPerkState.zapActive && mapPerkState.zapTimer <= 0) {
      mapPerkState.zapActive = false;
      mapPerkState.zapTimer  = 600 + Math.floor(Math.random() * 600);
    }
    if (mapPerkState.zapActive) {
      for (const p of players) {
        if (p.health <= 0 || p.invincible > 0 || p.isBoss) continue;
        if (Math.abs(p.cx() - mapPerkState.zapLine) < 40 && p.onGround) {
          if (frameCount % 12 === 0) dealDamage(null, p, 10, 6);
        }
      }
    }
  }
}
