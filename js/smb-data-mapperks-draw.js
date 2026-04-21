'use strict';
// smb-data-mapperks-draw.js — applyMapPerk() + drawMapPerks()
// Depends on: smb-globals.js, smb-data-mapperks.js (MAP_PERK_DEFS, mapPerkState), smb-particles.js
// Must load AFTER smb-data-mapperks.js, BEFORE smb-loop.js

function applyMapPerk(player, type) {
  if (type === 'heal') {
    player.health = Math.min(player.maxHealth, player.health + 30);
  } else if (type === 'speed') {
    player._speedBuff = 360; // 6 seconds
  } else if (type === 'power') {
    player._powerBuff = 360;
  } else if (type === 'shield') {
    player.invincible = Math.max(player.invincible, 180);
    spawnParticles(player.cx(), player.cy(), '#88ddff', 20);
  } else if (type === 'maxhp') {
    player.maxHealth = Math.min(250, player.maxHealth + 15);
    player.health    = Math.min(player.maxHealth, player.health + 15);
    spawnParticles(player.cx(), player.cy(), '#ff88ff', 20);
  } else if (type === 'curse_slow') {
    if (!player.curses) player.curses = [];
    player.curses = player.curses.filter(c => c.type !== 'curse_slow');
    player.curses.push({ type: 'curse_slow', timer: 30 * 60 }); // 30s
    spawnParticles(player.cx(), player.cy(), '#4488ff', 14);
  } else if (type === 'curse_weak') {
    if (!player.curses) player.curses = [];
    player.curses = player.curses.filter(c => c.type !== 'curse_weak');
    player.curses.push({ type: 'curse_weak', timer: 20 * 60 }); // 20s
    spawnParticles(player.cx(), player.cy(), '#222222', 14);
  } else if (type === 'curse_fragile') {
    if (!player.curses) player.curses = [];
    player.curses = player.curses.filter(c => c.type !== 'curse_fragile');
    player.curses.push({ type: 'curse_fragile', timer: 25 * 60 }); // 25s
    spawnParticles(player.cx(), player.cy(), '#ff8800', 14);
  } else if (type === 'curse_maxhp_perm') {
    player.maxHealth = Math.max(50, player.maxHealth - 15);
    if (player.health > player.maxHealth) player.health = player.maxHealth;
    spawnParticles(player.cx(), player.cy(), '#880000', 18);
  }
}

function drawMapPerks() {
  // ---- RUINS artifacts ----
  if (currentArenaKey === 'ruins') {
    // Breakable crates
    if (mapPerkState.crates) {
      for (const crate of mapPerkState.crates) {
        const sx = crate.hitShake > 0 ? (Math.random() - 0.5) * 4 : 0;
        const bx = crate.x + sx;
        const by = crate.y;          // crate bottom = platform top
        const cw = 32, ch = 28;
        ctx.save();
        // Box body
        ctx.fillStyle = '#7B4F2A';
        ctx.fillRect(bx - cw/2, by - ch, cw, ch);
        // Wood grain lines
        ctx.strokeStyle = '#4A2E10';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(bx - cw/2, by - ch, cw, ch);
        ctx.beginPath();
        ctx.moveTo(bx, by - ch); ctx.lineTo(bx, by);
        ctx.moveTo(bx - cw/2, by - ch/2); ctx.lineTo(bx + cw/2, by - ch/2);
        ctx.stroke();
        // HP bar
        const hpFrac = crate.hp / crate.maxHp;
        ctx.fillStyle = '#222';
        ctx.fillRect(bx - 18, by - ch - 7, 36, 4);
        ctx.fillStyle = hpFrac > 0.5 ? '#44dd44' : hpFrac > 0.25 ? '#ddcc22' : '#dd3333';
        ctx.fillRect(bx - 18, by - ch - 7, 36 * hpFrac, 4);
        // Type icon
        const icons = { speed:'S', power:'P', heal:'H', shield:'D', maxhp:'+' };
        ctx.fillStyle = '#ffe8a0';
        ctx.font = 'bold 11px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(icons[crate.type] || '?', bx, by - ch/2);
        ctx.restore();
      }
    }
    for (const item of mapItems) {
      if (item.collected) continue;
      const bob   = Math.sin(item.animPhase) * 5;
      const glow  = 0.6 + Math.sin(item.animPhase * 1.3) * 0.3;
      const colors = { speed:'#44aaff', power:'#ff4422', heal:'#44ff88', shield:'#88ddff', maxhp:'#ff88ff' };
      const glowC  = colors[item.type] || '#ffd700';
      ctx.save();
      ctx.shadowColor = glowC;
      ctx.shadowBlur  = 12 * glow;
      ctx.fillStyle   = glowC;
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.arc(item.x, item.y + bob, 10, 0, Math.PI * 2);
      ctx.fill();
      // Icon letter
      ctx.fillStyle   = '#000';
      ctx.shadowBlur  = 0;
      ctx.font        = 'bold 10px Arial';
      ctx.textAlign   = 'center';
      ctx.textBaseline = 'middle';
      const icons = { speed:'S', power:'P', heal:'H', shield:'D', maxhp:'+' };
      ctx.fillText(icons[item.type] || '?', item.x, item.y + bob);
      ctx.restore();
    }
  }

  // ---- LAVA eruption columns (lava arena + boss arena lava hazard) ----
  const showEruptions = (currentArenaKey === 'lava' || currentArenaKey === 'creator') && mapPerkState.eruptions;
  if (showEruptions) {
    const ly = currentArena.lavaY || 462;
    for (const er of mapPerkState.eruptions) {
      const progress = 1 - (er.timer / 180);
      const colH = Math.min(300, progress * 600);
      const alpha = er.timer < 40 ? er.timer / 40 : Math.min(1, (180 - er.timer) / 18 + 0.55);
      ctx.save();
      ctx.globalAlpha = alpha * 0.90;
      const cg = ctx.createLinearGradient(er.x, ly, er.x, ly - colH);
      cg.addColorStop(0, '#ff8800');
      cg.addColorStop(0.35, 'rgba(255,60,0,0.80)');
      cg.addColorStop(1, 'rgba(255,40,0,0)');
      ctx.fillStyle = cg;
      ctx.fillRect(er.x - 40, ly - colH, 80, colH);
      ctx.restore();
    }
  }

  // ---- CITY cars ----
  if (currentArenaKey === 'city' && mapPerkState.cars) {
    for (const car of mapPerkState.cars) {
      if (car.warnTimer > 0) {
        // Warning arrow
        const wx = car.vx > 0 ? 20 : GAME_W - 20;
        ctx.save();
        ctx.globalAlpha = Math.sin(frameCount * 0.3) * 0.5 + 0.5;
        ctx.fillStyle   = '#ff4400';
        ctx.font        = 'bold 18px Arial';
        ctx.textAlign   = 'center';
        ctx.fillText(car.vx > 0 ? '\u25b6 CAR!' : 'CAR! \u25c0', wx, car.y - 20);
        ctx.restore();
        continue;
      }
      ctx.save();
      ctx.fillStyle = '#cc3300';
      ctx.fillRect(car.x - 30, car.y - 24, 60, 24);
      ctx.fillStyle = '#ff5500';
      ctx.fillRect(car.x - 24, car.y - 38, 48, 16);
      ctx.fillStyle = '#ffee88';
      ctx.fillRect(car.vx > 0 ? car.x + 26 : car.x - 34, car.y - 20, 8, 8);
      ctx.restore();
    }
  }

  // ---- SPACE: Draw meteors + warning ----
  if (currentArenaKey === 'space' && mapPerkState.meteors) {
    for (const m of mapPerkState.meteors) {
      ctx.save();
      if (m.warnTimer > 0) {
        // Red X warning on ground
        ctx.globalAlpha = Math.sin(frameCount * 0.4) * 0.5 + 0.5;
        ctx.strokeStyle = '#ff4400';
        ctx.lineWidth   = 3;
        ctx.beginPath();
        ctx.moveTo(m.x - 14, 450); ctx.lineTo(m.x + 14, 464);
        ctx.moveTo(m.x + 14, 450); ctx.lineTo(m.x - 14, 464);
        ctx.stroke();
        // Dashed drop line
        ctx.setLineDash([4, 6]);
        ctx.strokeStyle = 'rgba(255,100,0,0.4)';
        ctx.beginPath(); ctx.moveTo(m.x, 0); ctx.lineTo(m.x, 450); ctx.stroke();
      } else {
        // Meteor body
        const mg = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, 16);
        mg.addColorStop(0, '#ffffff');
        mg.addColorStop(0.4, '#ffaa44');
        mg.addColorStop(1, '#cc3300');
        ctx.fillStyle = mg;
        ctx.shadowColor = '#ff6600';
        ctx.shadowBlur  = 16;
        ctx.beginPath(); ctx.arc(m.x, m.y, 14, 0, Math.PI * 2); ctx.fill();
        // Trail
        ctx.globalAlpha = 0.4;
        ctx.fillStyle = '#ffaa44';
        ctx.beginPath(); ctx.arc(m.x, m.y - 20, 8, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 0.2;
        ctx.beginPath(); ctx.arc(m.x, m.y - 38, 5, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }
  }

  // ---- CITY: Draw cars ----
  if (currentArenaKey === 'city' && mapPerkState.cityCars) {
    for (const car of mapPerkState.cityCars) {
      ctx.save();
      const carTop = car.y - car.h;
      // Car body
      ctx.fillStyle = car.color;
      ctx.fillRect(car.x, carTop, car.w, car.h);
      // Windows
      ctx.fillStyle = 'rgba(160,220,255,0.75)';
      ctx.fillRect(car.x + 6, carTop + 3, 14, 9);
      ctx.fillRect(car.x + car.w - 20, carTop + 3, 14, 9);
      // Wheels
      ctx.fillStyle = '#111';
      ctx.beginPath(); ctx.arc(car.x + 12, car.y, 6, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(car.x + car.w - 12, car.y, 6, 0, Math.PI * 2); ctx.fill();
      // Headlights
      ctx.fillStyle = car.vx > 0 ? '#ffffaa' : 'rgba(255,60,60,0.9)';
      ctx.beginPath(); ctx.arc(car.vx > 0 ? car.x + car.w : car.x, car.y - car.h / 2, 4, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  }

  // ---- ICE: Blizzard overlay ----
  if (currentArenaKey === 'ice' && mapPerkState.blizzardActive) {
    ctx.save();
    const windAlpha = Math.min(1, (180 - mapPerkState.blizzardTimer) / 60) * 0.18;
    ctx.fillStyle = `rgba(180,220,255,${windAlpha})`;
    ctx.fillRect(0, 0, GAME_W, GAME_H);
    // Wind lines
    ctx.strokeStyle = 'rgba(200,240,255,0.35)';
    ctx.lineWidth = 1.5;
    for (let li = 0; li < 12; li++) {
      const lx = ((frameCount * 6 * mapPerkState.blizzardDir + li * 80) % (GAME_W + 60)) - 30;
      const ly = 40 + li * 45;
      ctx.beginPath();
      ctx.moveTo(lx, ly);
      ctx.lineTo(lx + mapPerkState.blizzardDir * -60, ly + 8);
      ctx.stroke();
    }
    ctx.restore();
  }
}
