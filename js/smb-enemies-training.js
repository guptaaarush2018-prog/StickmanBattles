'use strict';
// smb-enemies-training.js — Training mode commands, training panel UI, map creator tool, custom weapon creator
// Depends on: smb-globals.js, smb-fighter.js, smb-data-weapons.js

// ============================================================
// DUMMY  (training-mode target — stands still, auto-heals)
// ============================================================
class Dummy extends Fighter {
  constructor(x, y) {
    super(x, y, '#888888', 'sword',
      { left:null, right:null, jump:null, attack:null, ability:null, super:null },
      false);
    this.name     = 'DUMMY';
    this.isDummy  = true;
    this.health   = 200;
    this.maxHealth = 200;
    this.lives    = 999;
    this.spawnX   = x;
    this.spawnY   = y;
  }

  update() {
    // Timers
    if (this.cooldown > 0)         this.cooldown--;
    if (this.invincible > 0)       this.invincible--;
    if (this.hurtTimer > 0)        this.hurtTimer--;
    if (this.stunTimer > 0)        this.stunTimer--;
    if (this.ragdollTimer > 0) {
      this.ragdollTimer--;
      this.ragdollAngle += this.ragdollSpin;
      this.ragdollSpin  *= 0.97;
    } else {
      this.ragdollAngle = 0;
      this.ragdollSpin  = 0;
    }
    // Gravity + minimal physics
    this.vy += 0.65;
    this.x  += this.vx;
    this.y  += this.vy;
    this.vx *= 0.80;
    this.vy  = clamp(this.vy, -20, 19);
    this.onGround = false;
    // Ceiling
    const _ceilY = currentArena && currentArena.isLowGravity ? -60 : -20;
    if (this.y < _ceilY) { this.y = _ceilY; if (this.vy < 0) this.vy = 0; }
    for (const pl of currentArena.platforms) this.checkPlatform(pl);
    // Auto-reset if falls off
    if (this.y > 640) { this.x = this.spawnX; this.y = this.spawnY - 60; this.vy = 0; this.health = this.maxHealth; }
    // Auto-heal when health hits 0
    if (this.health <= 0) {
      this.health = this.maxHealth;
      this.invincible = 120;
      spawnParticles(this.cx(), this.cy(), this.color, 12);
    }
    this.animTimer++;
    this.updateState();
  }

  respawn() { this.health = this.maxHealth; }
  useSuper() {}
  activateSuper() {}
  updateAI() {}

  draw() {
    // Always draw — explicit override so the dummy is never invisible
    ctx.save();
    // Invincibility blink
    if (this.invincible > 0 && Math.floor(this.invincible / 5) % 2 === 1) {
      ctx.globalAlpha = 0.35;
    }
    const cx = this.x + this.w / 2;
    const ty = this.y;
    const bw = this.w;      // body width (~20)
    const bh = this.h;      // body height (~50)

    // Hurt flash
    const hurt = this.hurtTimer > 0;
    const bodyCol = hurt ? '#ff6666' : '#999999';
    const headCol = hurt ? '#ffaaaa' : '#cccccc';

    // Ragdoll rotation when knocked back
    if (this.ragdollTimer > 0) {
      ctx.translate(cx, ty + bh * 0.45);
      ctx.rotate(this.ragdollAngle || 0);
      ctx.translate(-cx, -(ty + bh * 0.45));
    }

    // Body (torso)
    ctx.fillStyle = bodyCol;
    ctx.fillRect(cx - bw * 0.3, ty + bh * 0.32, bw * 0.6, bh * 0.38);

    // Head
    ctx.fillStyle = headCol;
    ctx.beginPath();
    ctx.arc(cx, ty + bh * 0.15, bh * 0.14, 0, Math.PI * 2);
    ctx.fill();

    // Eyes (simple dots)
    ctx.fillStyle = '#444';
    ctx.beginPath(); ctx.arc(cx - 3, ty + bh * 0.13, 2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + 3, ty + bh * 0.13, 2, 0, Math.PI * 2); ctx.fill();

    // Left arm
    ctx.fillStyle = bodyCol;
    ctx.fillRect(cx - bw * 0.65, ty + bh * 0.33, bw * 0.32, bh * 0.08);
    // Right arm
    ctx.fillRect(cx + bw * 0.33, ty + bh * 0.33, bw * 0.32, bh * 0.08);

    // Left leg
    ctx.fillRect(cx - bw * 0.32, ty + bh * 0.68, bw * 0.13, bh * 0.32);
    // Right leg
    ctx.fillRect(cx + bw * 0.19, ty + bh * 0.68, bw * 0.13, bh * 0.32);

    // "DUMMY" label above
    ctx.globalAlpha = 0.85;
    ctx.font = 'bold 8px Arial';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#000';
    ctx.shadowBlur = 3;
    ctx.fillText('DUMMY', cx, ty - 4);
    ctx.shadowBlur = 0;

    // Health bar
    const hpPct = Math.max(0, this.health / this.maxHealth);
    const bw2 = 28, bh2 = 4;
    ctx.globalAlpha = 0.8;
    ctx.fillStyle = '#333';
    ctx.fillRect(cx - bw2 / 2, ty - 14, bw2, bh2);
    ctx.fillStyle = hpPct > 0.5 ? '#44dd44' : hpPct > 0.25 ? '#ffcc00' : '#ff4444';
    ctx.fillRect(cx - bw2 / 2, ty - 14, bw2 * hpPct, bh2);

    ctx.restore();
  }
}

// ============================================================
// TRAINING COMMANDS
// ============================================================
function trainingCmd(cmd) {
  if (!gameRunning || !trainingMode) return;
  const p = players[0];
  if (!p) return;

  if (cmd === 'giveSuper') {
    const giveTargets = trainingPlayerOnly ? [p] : [p, ...trainingDummies];
    for (const t of giveTargets) { t.superMeter = 100; t.superReady = true; t.superFlashTimer = 90; }
  }
  if (cmd === 'noCooldowns') {
    p.noCooldownsActive = !p.noCooldownsActive;
    if (p.noCooldownsActive) { p.cooldown = 0; p.cooldown2 = 0; p.abilityCooldown = 0; p.abilityCooldown2 = 0; p.shieldCooldown = 0; p.boostCooldown = 0; }
    document.getElementById('tBtnCDs')?.classList.toggle('training-active', p.noCooldownsActive);
  }
  if (cmd === 'fullHealth') {
    if (trainingPlayerOnly) {
      p.health = p.maxHealth;
    } else {
      for (const d of trainingDummies) d.health = d.maxHealth;
      p.health = p.maxHealth;
    }
  }
  if (cmd === 'spawnDummy') {
    const x = 200 + Math.random() * 500;
    trainingDummies.push(new Dummy(x, 300));
  }
  if (cmd === 'spawnBot') {
    const x    = Math.random() < 0.5 ? 160 : 720;
    const wKey = randChoice(WEAPON_KEYS);
    const bot  = new Fighter(x, 300, '#ff8800', wKey,
      { left:null, right:null, jump:null, attack:null, ability:null, super:null },
      true, 'hard');
    bot.name = 'BOT'; bot.lives = 1; bot.spawnX = x; bot.spawnY = 300;
    bot.target = p; bot.playerNum = 2;
    trainingDummies.push(bot);
  }
  if (cmd === 'clearEnemies') {
    trainingDummies = [];
    bossBeams  = [];
    bossSpikes = [];
    minions    = [];
    // Reset stale target references — cleared entities still have health > 0,
    // so without this fix bots in players[] would chase invisible entities
    // until their 25-tick retarget timer fires.
    for (const pl of players) {
      if (pl.target && !players.includes(pl.target)) {
        pl.target = players.find(q => q !== pl && q.health > 0) || null;
      }
    }
  }
  if (cmd === 'godmode') {
    if (trainingPlayerOnly) {
      p.godmode = !p.godmode;
      document.getElementById('tBtnGod')?.classList.toggle('training-active', p.godmode);
    } else {
      const newVal = !p.godmode;
      p.godmode = newVal;
      for (const d of trainingDummies) d.godmode = newVal;
      document.getElementById('tBtnGod')?.classList.toggle('training-active', newVal);
    }
  }
  if (cmd === 'spawnBoss') {
    // Allow multiple bosses — no filter, just spawn another
    const bossX = 150 + Math.random() * 600;
    const tb = new Boss();
    tb.target    = p;
    tb.spawnX    = bossX; tb.spawnY = 200;
    tb.x         = bossX; tb.y     = 200;
    trainingDummies.push(tb);
  }
  if (cmd === 'spawnBeast') {
    const bx = Math.random() < 0.5 ? 80 : 820;
    const beast = new ForestBeast(bx, 280);
    beast.target = p;
    trainingDummies.push(beast);
  }
  if (cmd === 'onePunch') {
    if (trainingPlayerOnly) {
      p.onePunchMode = !p.onePunchMode;
      document.getElementById('tBtnOnePunch')?.classList.toggle('training-active', p.onePunchMode);
    } else {
      const newVal = !p.onePunchMode;
      p.onePunchMode = newVal;
      for (const d of trainingDummies) d.onePunchMode = newVal;
      document.getElementById('tBtnOnePunch')?.classList.toggle('training-active', newVal);
    }
  }
  if (cmd === 'chaosMode') {
    trainingChaosMode = !trainingChaosMode;
    document.getElementById('tBtnChaos')?.classList.toggle('training-active', trainingChaosMode);
  }
  if (cmd === 'playerOnly') {
    trainingPlayerOnly = !trainingPlayerOnly;
    const btn = document.getElementById('tBtnPlayerOnly');
    if (btn) {
      btn.classList.toggle('training-active', trainingPlayerOnly);
      btn.textContent = trainingPlayerOnly ? 'Player Only' : 'All Entities';
    }
  }
}

function toggleTrainingPanel() {
  const panel = document.getElementById('trainingExpandPanel');
  if (!panel) return;
  panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
}

function toggleTraining2P() {
  training2P = !training2P;
  const btn = document.getElementById('training2PBtn');
  if (btn) { btn.textContent = training2P ? '2P: ON' : '2P: OFF'; btn.classList.toggle('active', training2P); }
}

function spawnTrainingYeti() {
  if (!gameRunning || gameMode !== 'training') return;
  if (yeti && yeti.health > 0) return;
  yeti = new Yeti(450, 150);
  if (players[0]) players[0].target = yeti;
}

function spawnTrainingDummy() {
  if (!gameRunning || gameMode !== 'training') return;
  const d = new Dummy(300 + Math.random() * 300, 150);
  d.playerNum = trainingDummies.length + 3;
  d.name = 'DUMMY';
  trainingDummies.push(d);
}

let _creatorPlatforms  = [];
let _creatorHistory    = []; // undo stack: each entry = platforms snapshot before action
let _mcDragPlatform    = null;
let _mcDragOffX        = 0;
let _mcDragOffY        = 0;
let _mcDragOriginX     = 0;
let _mcDragOriginY     = 0;
let _mcEditorOpen      = false;

function toggleMapCreator() {
  const panel = document.getElementById('mapCreatorPanel');
  if (!panel) return;
  _mcEditorOpen = panel.style.display === 'none';
  panel.style.display = _mcEditorOpen ? 'block' : 'none';
}

// Convert client (screen) coords to game-world coords
function _mcScreenToGame(clientX, clientY) {
  const scX = (canvas.width  / GAME_W) * camZoomCur;
  const scY = (canvas.height / GAME_H) * camZoomCur;
  return {
    x: (clientX - canvas.width  / 2) / scX + camXCur,
    y: (clientY - canvas.height / 2) / scY + camYCur
  };
}

// Snapshot current platforms for undo
function _mcSnapshot() {
  if (!currentArena) return;
  _creatorHistory.push(currentArena.platforms.map(p => ({ ...p })));
  if (_creatorHistory.length > 50) _creatorHistory.shift();
}

function _mcRefreshCount() {
  const cnt = document.getElementById('mcCount');
  if (cnt) cnt.textContent = (_creatorPlatforms.length);
}

function addCreatorPlatform() {
  const x       = parseInt(document.getElementById('mcX')?.value)     || 200;
  const y       = parseInt(document.getElementById('mcY')?.value)     || 300;
  const w       = parseInt(document.getElementById('mcW')?.value)     || 150;
  const h       = parseInt(document.getElementById('mcH')?.value)     || 14;
  const color   = document.getElementById('mcColor')?.value           || null;
  const bouncy  = document.getElementById('mcBouncy')?.checked        || false;
  const moving  = document.getElementById('mcMoving')?.checked        || false;
  const oscX    = parseInt(document.getElementById('mcOscX')?.value)  || 60;
  const oscSpd  = parseFloat(document.getElementById('mcOscSpd')?.value) || 0.02;
  const isFloor = document.getElementById('mcFloor')?.checked         || false;
  _mcSnapshot();
  const pl = { x, y, w, h, isFloor, _creator: true };
  if (color && color !== '#888888') pl.color = color;
  if (bouncy) { pl.isBouncy = true; pl.naturalY = y; pl.sinkOffset = 0; pl.floatPhase = Math.random() * Math.PI * 2; }
  if (moving) { pl.ox = x; pl.oscX = oscX; pl.oscSpeed = oscSpd; pl.oscPhase = Math.random() * Math.PI * 2; pl.rx = x; pl.rTimer = 0; }
  _creatorPlatforms.push(pl);
  if (currentArena) currentArena.platforms.push(pl);
  _mcRefreshCount();
}

function clearCreatorPlatforms() {
  _mcSnapshot();
  if (currentArena) currentArena.platforms = currentArena.platforms.filter(p => !p._creator);
  _creatorPlatforms = [];
  _mcRefreshCount();
}

function clearAllPlatforms() {
  if (!confirm('Clear ALL platforms including the floor?')) return;
  _mcSnapshot();
  if (currentArena) currentArena.platforms = [];
  _creatorPlatforms = [];
  _mcRefreshCount();
}

function undoLastPlatform() {
  if (_creatorHistory.length === 0) return;
  const prev = _creatorHistory.pop();
  if (currentArena) currentArena.platforms = prev;
  _creatorPlatforms = prev.filter(p => p._creator);
  _mcRefreshCount();
}

function exportCreatorMap() {
  const all = currentArena ? currentArena.platforms : _creatorPlatforms;
  const json = JSON.stringify({ platforms: all.map(p => ({ x:p.x, y:p.y, w:p.w, h:p.h, isFloor:p.isFloor, color:p.color, isBouncy:p.isBouncy, oscX:p.oscX, oscSpeed:p.oscSpeed })) }, null, 2);
  const ta = document.getElementById('mcJSON');
  if (ta) ta.value = json;
  const blob = new Blob([json], { type:'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'sb_map.json'; a.click();
  URL.revokeObjectURL(url);
}

function importCreatorMap() {
  const ta = document.getElementById('mcJSON');
  if (!ta || !ta.value.trim()) return;
  try {
    const data = JSON.parse(ta.value);
    _mcSnapshot();
    clearCreatorPlatforms();
    (data.platforms || []).forEach(p => {
      const pl = { x: p.x, y: p.y, w: p.w || 150, h: p.h || 14, isFloor: !!p.isFloor, _creator: true };
      if (p.color) pl.color = p.color;
      if (p.isBouncy) { pl.isBouncy = true; pl.naturalY = p.y; pl.sinkOffset = 0; pl.floatPhase = 0; }
      if (p.oscX)  { pl.ox = p.x; pl.oscX = p.oscX; pl.oscSpeed = p.oscSpeed || 0.02; pl.oscPhase = 0; pl.rx = p.x; pl.rTimer = 0; }
      _creatorPlatforms.push(pl);
      if (currentArena) currentArena.platforms.push(pl);
    });
    _mcRefreshCount();
  } catch(e) { alert('Invalid JSON: ' + e.message); }
}

// ---- Weapon Creator ----
function createCustomWeapon() {
  const name  = document.getElementById('wcName')?.value?.trim()         || 'Custom';
  const dmg   = parseInt(document.getElementById('wcDmg')?.value)         || 10;
  const range = parseInt(document.getElementById('wcRange')?.value)       || 60;
  const cd    = parseInt(document.getElementById('wcCd')?.value)          || 30;
  const kb    = parseInt(document.getElementById('wcKb')?.value)          || 8;
  const type  = document.getElementById('wcType')?.value                  || 'melee';
  const abilDmg = parseInt(document.getElementById('wcAbilDmg')?.value)   || 20;
  const key   = 'cw_' + name.toLowerCase().replace(/\s+/g,'_') + '_' + Date.now();
  WEAPONS[key] = {
    name, damage: dmg, range, cooldown: cd, kb, type,
    abilityCooldown: 150, abilityName: name + ' Strike',
    ability(user, tgt) {
      if (!tgt || tgt.health <= 0) return;
      if (dist(user, tgt) < range * 1.5) dealDamage(user, tgt, abilDmg, kb * 1.5);
    }
  };
  // Add to all weapon selects
  document.querySelectorAll('select[id$="Weapon"]').forEach(sel => {
    if (!sel.querySelector(`option[value="${key}"]`)) {
      const opt = document.createElement('option');
      opt.value = key; opt.textContent = '★ ' + name;
      sel.appendChild(opt);
    }
  });
  const status = document.getElementById('wcStatus');
  if (status) { status.textContent = `✅ "${name}" added to weapon list!`; setTimeout(() => { status.textContent = ''; }, 3000); }
}

// ---- Drag support for platforms ----
canvas.addEventListener('mousedown', (e) => {
  if (!_mcEditorOpen || !gameRunning || !currentArena) return;
  const gp = _mcScreenToGame(e.clientX, e.clientY);
  // find topmost platform under cursor
  for (let i = currentArena.platforms.length - 1; i >= 0; i--) {
    const pl = currentArena.platforms[i];
    if (gp.x >= pl.x && gp.x <= pl.x + pl.w && gp.y >= pl.y && gp.y <= pl.y + pl.h) {
      _mcSnapshot();
      _mcDragPlatform = pl;
      _mcDragOffX = gp.x - pl.x;
      _mcDragOffY = gp.y - pl.y;
      _mcDragOriginX = pl.x;
      _mcDragOriginY = pl.y;
      e.preventDefault();
      return;
    }
  }
});

canvas.addEventListener('mousemove', (e) => {
  if (!_mcDragPlatform) return;
  const gp = _mcScreenToGame(e.clientX, e.clientY);
  _mcDragPlatform.x = Math.round(gp.x - _mcDragOffX);
  _mcDragPlatform.y = Math.round(gp.y - _mcDragOffY);
  if (_mcDragPlatform.ox !== undefined) _mcDragPlatform.ox = _mcDragPlatform.x;
  if (_mcDragPlatform.naturalY !== undefined) _mcDragPlatform.naturalY = _mcDragPlatform.y;
  // Sync input fields if this is the only selected platform
  const xEl = document.getElementById('mcX'); if (xEl) xEl.value = _mcDragPlatform.x;
  const yEl = document.getElementById('mcY'); if (yEl) yEl.value = _mcDragPlatform.y;
});

canvas.addEventListener('mouseup', () => {
  if (_mcDragPlatform) {
    // If barely moved, pop the snapshot (no meaningful change)
    if (Math.abs(_mcDragPlatform.x - _mcDragOriginX) < 2 && Math.abs(_mcDragPlatform.y - _mcDragOriginY) < 2) {
      _creatorHistory.pop();
    }
    _mcDragPlatform = null;
  }
});

