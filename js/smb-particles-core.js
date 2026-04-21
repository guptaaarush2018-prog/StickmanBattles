'use strict';
// smb-particles-core.js — particle pool, spawnParticles, spawnRing, checkWeaponSparks, spawnBullet, Projectile, DamageText
// Depends on: smb-globals.js, smb-combat.js
// PARTICLE POOL — reuses particle objects to reduce GC pressure
// ============================================================
const MAX_PARTICLES = 250;
const _particlePool = [];   // recycled particle objects

function _getParticle() {
  // Recycle from pool first
  if (_particlePool.length > 0) return _particlePool.pop();
  return {};
}

function _recycleParticle(p) {
  if (_particlePool.length < 300) _particlePool.push(p);
}

function spawnParticles(x, y, color, count) {
  if (!settings.particles) return;
  // Enforce cap: if over max, skip new particles
  if (particles.length >= MAX_PARTICLES) return;
  const toSpawn = Math.min(count, MAX_PARTICLES - particles.length);
  for (let i = 0; i < toSpawn; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = 1.5 + Math.random() * 5;
    const p = _getParticle();
    p.x = x; p.y = y;
    p.vx = Math.cos(a) * s; p.vy = Math.sin(a) * s;
    p.color = color;
    p.size = 1.5 + Math.random() * 2.5;
    p.life = 18 + Math.random() * 22;
    p.maxLife = 40;
    particles.push(p);
  }
}

function spawnRing(x, y) {
  if (!settings.particles) return;
  const ringCount = Math.min(18, MAX_PARTICLES - particles.length);
  for (let i = 0; i < ringCount; i++) {
    const a = (i / 18) * Math.PI * 2;
    const _p = _getParticle();
    _p.x = x; _p.y = y; _p.vx = Math.cos(a)*7; _p.vy = Math.sin(a)*3.5;
    _p.color = '#ff8800'; _p.size = 3; _p.life = 14; _p.maxLife = 14;
    particles.push(_p);
  }
}

function checkWeaponSparks() {
  if (!settings.particles) return;
  const pool = [...players, ...minions, ...(trainingDummies || [])].filter(f => f.health > 0 && f.attackTimer > 0 && f.weapon && f.weapon.type === 'melee');
  const all = pool.map(f => {
    const tip = f._weaponTip || (f.getWeaponTipPos && f.getWeaponTipPos());
    return tip ? { f, tip: { x: tip.x, y: tip.y, attacking: true } } : null;
  }).filter(Boolean);
  for (let i = 0; i < all.length; i++) {
    for (let j = i + 1; j < all.length; j++) {
      const a = all[i], b = all[j];
      if (!a.tip.attacking || !b.tip.attacking) continue;
      if ((a.f._weaponClashCd || 0) > 0 || (b.f._weaponClashCd || 0) > 0) continue;
      const dx = a.tip.x - b.tip.x;
      const dy = a.tip.y - b.tip.y;
      if (dx * dx + dy * dy < 28 * 28) {
        const mx = (a.tip.x + b.tip.x) / 2;
        const my = (a.tip.y + b.tip.y) / 2;
        for (let s = 0; s < 10 && particles.length < MAX_PARTICLES; s++) {
          const sa = Math.random() * Math.PI * 2;
          const sv = 2 + Math.random() * 5;
          const _p = _getParticle();
          _p.x = mx; _p.y = my; _p.vx = Math.cos(sa) * sv; _p.vy = Math.sin(sa) * sv - 1;
          _p.color = s < 5 ? '#ffffff' : '#ffdd44'; _p.size = 1.5 + Math.random() * 2; _p.life = 8; _p.maxLife = 8;
          particles.push(_p);
        }
        screenShake = Math.max(screenShake, 3);
        const nx = dx === 0 ? 1 : dx / Math.sqrt(dx * dx + dy * dy);
        a.f.vx += nx * 2; b.f.vx -= nx * 2;
        a.f._weaponClashCd = 20; b.f._weaponClashCd = 20;
        if (!a.f.isAI || !b.f.isAI) unlockAchievement('clash_master');
      }
    }
  }
  // Decrement clash cooldowns
  [...players, ...minions, ...(trainingDummies || [])].forEach(f => { if (f._weaponClashCd > 0) f._weaponClashCd--; });
}

function _achCheckYetiDead()  { unlockAchievement('yeti_hunter'); }
function _achCheckBeastDead() { unlockAchievement('beast_tamer'); }

function spawnBullet(user, speed, color, overrideDmg = null) {
  if (isCinematic) return null; // no new projectiles during cinematics or finishers
  // Sovereign Domain rule: no ranged weapons allowed — melee only
  if (typeof gameMode !== 'undefined' && gameMode === 'sovereign') return null;
  // Arena-level no-ranged flag (e.g. story sovereign arena)
  if (typeof currentArena !== 'undefined' && currentArena && currentArena.isNoRanged) return null;
  SoundManager.shoot();
  const _nearest = [user.target, ...players, ...minions, ...trainingDummies].filter(Boolean).find(t => t !== user && t.health > 0) || null;
  const _distToT = _nearest ? Math.abs(_nearest.cx() - user.cx()) : 999;
  const _pointBlankT = !user.isBoss ? Math.max(0, 1 - clamp((_distToT - 48) / 72, 0, 1)) : 0;
  const _baseDmg = overrideDmg !== null ? overrideDmg : (user.weapon.damageFunc ? user.weapon.damageFunc() : user.weapon.damage);
  const dmg = Math.max(1, Math.round(_baseDmg * (1 - _pointBlankT * 0.34)));

  // Movement-based accuracy: faster movement = more vertical spread.
  // At full run speed (5.2) normal weapons get ±0.9 vy spread (~54px at 60f range).
  // Rapid-fire weapons get 2.8× (±1.4 vy) — rewards burst-control close range.
  const _ownerSpd = Math.abs(user.vx);
  const _isRapid  = user.weapon && user.weapon.cooldown <= 20; // rapid-fire threshold
  const _shotHeat = Math.min(8, user._rangedShotHeat || 0);
  const _spread   = (_ownerSpd > 0.8 ? (_ownerSpd / 5.2) * (_isRapid ? 3.1 : 2.0) : 0)
                  + _shotHeat * (_isRapid ? 0.30 : 0.20)
                  + _pointBlankT * (_isRapid ? 1.35 : 0.92);
  const _vy       = _spread > 0 ? (Math.random() - 0.5) * _spread : 0;

  const _proj = new Projectile(
    user.cx() + user.facing * 12, user.y + 22,
    user.facing * speed, _vy, user, dmg, color
  );
  _proj._closeRangePenalty = _pointBlankT;
  _proj._warmupFrames = _isRapid ? 3 : 2;
  projectiles.push(_proj);
  // Gunner class: fire a second bullet at slight angle
  if (user.charClass === 'gunner') {
    const dmg2 = Math.max(1, Math.round((user.weapon.damageFunc ? user.weapon.damageFunc() : user.weapon.damage) * (1 - _pointBlankT * 0.34)));
    const _vy2 = _vy + (Math.random() - 0.5) * 0.3;
    const _proj2 = new Projectile(
      user.cx() + user.facing * 12, user.y + 26,
      user.facing * speed * 0.92, -0.8 + _vy2, user, dmg2, color
    );
    _proj2._closeRangePenalty = _pointBlankT;
    _proj2._warmupFrames = _isRapid ? 3 : 2;
    projectiles.push(_proj2);
  }
  return _proj; // return primary projectile so callers can mark Q-ability shots
}

// ============================================================
// PROJECTILE
// ============================================================
class Projectile {
  constructor(x, y, vx, vy, owner, damage, color) {
    this.x = x; this.y = y;
    this.vx = vx; this.vy = vy;
    this.owner  = owner;
    this.damage = damage;
    this.color  = color;
    this.life   = 90;
    this.active = true;
    this._warmupFrames = 0;
    this.hitEntities = new Set(); // prevents duplicate hits from same projectile (e.g. piercing)
    const tf = typeof getTrueFormAntiRangedBoss === 'function' ? getTrueFormAntiRangedBoss() : (players && players.find(p => p.isTrueForm && p.health > 0));
    if (tf && owner && !owner.isAI && owner.weapon && owner.weapon.type === 'ranged') {
      tf._antiRangedStats = tf._antiRangedStats || { projectiles: 0, rangedDamage: 0, farTicks: 0 };
      tf._antiRangedStats.projectiles = Math.min(999, (tf._antiRangedStats.projectiles || 0) + 1);
    }
  }
  update() {
    if (this._warmupFrames > 0) {
      this._warmupFrames--;
      this.x += this.vx * 0.45;
      this.y += this.vy * 0.45;
      this.vy += 0.04;
      if (--this.life <= 0) { this.active = false; }
      return;
    }
    const tfAnti = typeof getTrueFormAntiRangedBoss === 'function' ? getTrueFormAntiRangedBoss() : null;
    if (tfAnti && this.owner && !this.owner.isBoss && this.owner.weapon && this.owner.weapon.type === 'ranged') {
      const dx = tfAnti.cx() - this.x;
      const dy = tfAnti.cy() - this.y;
      const dd = Math.hypot(dx, dy) || 1;
      const fieldR = (tfAnti._antiRangedFieldR || 220) * 1.18;
      const wasInField = this._inAntiRangedField;
      this._inAntiRangedField = dd < fieldR;
      const justEntered = this._inAntiRangedField && !wasInField;
      if (justEntered && !this._tfReflected && Math.random() < 0.05) {
        const reflectTarget = this.owner && this.owner.health > 0 ? this.owner : players.find(p => !p.isBoss && p.health > 0);
        if (reflectTarget) {
          this._tfReflected = true;
          this.owner = tfAnti;
          const rdx = reflectTarget.cx() - this.x;
          const rdy = reflectTarget.cy() - this.y;
          const rd = Math.hypot(rdx, rdy) || 1;
          const speed = Math.max(9, Math.hypot(this.vx, this.vy) * 1.35);
          this.vx = (rdx / rd) * speed;
          this.vy = (rdy / rd) * speed * 0.35 - 0.3;
          this.damage = Math.max(1, Math.round(this.damage * 1.15));
          this.color = '#ffffff';
          spawnParticles(this.x, this.y, '#ffffff', 6);
          screenShake = Math.max(screenShake, 5);
        }
      }
    }
    this.x += this.vx;
    this.y += this.vy;
    this.vy += 0.08;
    // Track distance for damage falloff (applied on hit below)
    this._distTraveled = (this._distTraveled || 0) + Math.abs(this.vx);
    if (--this.life <= 0) { this.active = false; return; }
    // platform collision
    for (const pl of currentArena.platforms) {
      if (this.x > pl.x && this.x < pl.x+pl.w && this.y > pl.y && this.y < pl.y+pl.h) {
        this.active = false;
        spawnParticles(this.x, this.y, this.color, 4);
        return;
      }
    }
    // player collision
    for (const p of players) {
      if (p === this.owner || p.health <= 0) continue;
      if (areAlliedEntities(this.owner, p)) continue;
      if (p !== this.owner && p.isAI && !p.isBoss && (!p.weapon || p.weapon.type !== 'ranged')) {
        const _aiProjD = Math.hypot(this.x - p.cx(), this.y - p.cy());
        const _towardAI = Math.sign(this.vx || 0) === Math.sign(p.cx() - this.x);
        if (_towardAI && _aiProjD < 72 && (p.attackTimer > 0 || Math.abs(p.vx) > 3.4) && Math.random() < 0.18) {
          p.invincible = Math.max(p.invincible || 0, 6);
          p.vx += Math.sign(this.vx || 1) * 2.2;
          spawnParticles(p.cx(), p.cy(), '#ddeeff', 4);
          this.active = false;
          return;
        }
      }
      if (p.isBoss && this.owner && this.owner.weapon && this.owner.weapon.type === 'ranged') {
        const _bossD = Math.hypot(this.x - p.cx(), this.y - p.cy());
        if (_bossD < 88 && Math.random() < 0.05 && !(p._projDeflectCd > 0)) {
          p._projDeflectCd = 16;
          this.owner = p;
          this.vx = (this.x < p.cx() ? -1 : 1) * Math.max(8, Math.abs(this.vx) * 1.05);
          this.vy = -Math.abs(this.vy) * 0.35 - 0.5;
          this.x  = p.cx() + Math.sign(this.vx) * 18;
          this.y  = p.cy() - 8;
          this.color = '#ffffff';
          spawnParticles(this.x, this.y, '#ffffff', 8);
          screenShake = Math.max(screenShake, 6);
          return;
        }
      }
      // Block friendly fire unless survival competitive mode explicitly enables it
      const _survFF = gameMode === 'minigames' && minigameType === 'survival' && survivalFriendlyFire;
      if (!_survFF && gameMode === 'boss' && !(this.owner && this.owner.isBoss) && !p.isBoss) continue;
      if (!_survFF && gameMode === 'minigames' && !(this.owner && this.owner.isBoss) && !p.isBoss && !p.isAI) continue;
      if (this.hitEntities && this.hitEntities.has(p)) continue; // dedup: already hit this target
    if (this.x > p.x && this.x < p.x+p.w && this.y > p.y && this.y < p.y+p.h) {
        this.hitEntities.add(p);
        // Q-ability: diminishing returns on damage per sequential hit
        if (this._isQAbility && this.owner) {
          const hc = this.owner._qHitCount || 0;
          this.damage = Math.max(1, Math.round(this.damage * Math.max(0.10, 1 - hc * 0.18)));
          this.owner._qHitCount = hc + 1;
        }
        // Distance falloff: full damage ≤200px, ramps down to 60% at ≥600px
        const _falloff = Math.max(0.60, 1.0 - Math.max(0, (this._distTraveled - 200) / 1000));
        const _hitDmg  = Math.max(1, Math.round(this.damage * _falloff * (1 - (this._closeRangePenalty || 0) * 0.18)));
        dealDamage(this.owner, p, _hitDmg, 7, 1.0, false, 0);
        handleSplash(this.owner, p, _hitDmg, this.x, this.y);
        this.active = false;
        spawnParticles(this.x, this.y, this.color, 6);
        return;
      }
    }
    // minion collision — player/non-minion projectiles can kill minions
    if (!this.owner.isMinion && !(this.owner instanceof Boss)) {
      for (const mn of minions) {
        if (mn.health <= 0) continue;
        if (areAlliedEntities(this.owner, mn)) continue;
        if (this.x > mn.x && this.x < mn.x+mn.w && this.y > mn.y && this.y < mn.y+mn.h) {
          const _mFalloff = Math.max(0.60, 1.0 - Math.max(0, ((this._distTraveled || 0) - 200) / 1000));
          const _mHitDmg  = Math.max(1, Math.round(this.damage * _mFalloff * (1 - (this._closeRangePenalty || 0) * 0.18)));
          dealDamage(this.owner, mn, _mHitDmg, 9, 1.0, false, 0);
          handleSplash(this.owner, mn, _mHitDmg, this.x, this.y);
          this.active = false;
          spawnParticles(this.x, this.y, this.color, 6);
          return;
        }
      }
    }
    // training dummy collision
    if (!this.owner.isDummy) {
      for (const dum of trainingDummies) {
        if (dum.health <= 0) continue;
        if (this.x > dum.x && this.x < dum.x+dum.w && this.y > dum.y && this.y < dum.y+dum.h) {
          dealDamage(this.owner, dum, this.damage, 9, 1.0, false, 0);
          handleSplash(this.owner, dum, this.damage, this.x, this.y);
          this.active = false;
          spawnParticles(this.x, this.y, this.color, 6);
          return;
        }
      }
    }
  }
  draw() {
    ctx.save();
    ctx.shadowColor = this.color;
    ctx.shadowBlur  = 8;
    ctx.fillStyle   = this.color;
    ctx.beginPath();
    ctx.ellipse(this.x, this.y, 7, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    // trail
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    ctx.ellipse(this.x - this.vx * 2.5, this.y, 5, 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// ============================================================
// DAMAGE TEXT
// ============================================================
class DamageText {
  constructor(x, y, amount, color) {
    this.x = x; this.y = y;
    this.amount = amount;
    this.color  = color;
    this.life   = 52;
    this.vx     = (Math.random() - 0.5) * 1.5;
  }
  update() { this.y -= 1.1; this.x += this.vx; this.life--; }
  draw() {
    const a = Math.min(1, this.life / 20);
    // Font size scales more aggressively with damage for better readability
    const fs = this.amount >= 40 ? 24
             : this.amount >= 25 ? 20
             : this.amount >= 12 ? 16
             : 13;
    // Color-code by damage tier: low=white, medium=yellow, high=orange, massive=red
    const col = this.amount >= 40 ? '#ff4422'
              : this.amount >= 25 ? '#ff9900'
              : this.amount >= 12 ? '#ffee44'
              : this.color;
    ctx.save();
    ctx.globalAlpha   = a;
    ctx.textAlign     = 'center';
    ctx.font          = `bold ${fs}px Arial`;
    // Stronger outline improves readability on all backgrounds
    ctx.strokeStyle   = 'rgba(0,0,0,0.95)';
    ctx.lineWidth     = fs >= 20 ? 4 : 3;
    ctx.strokeText('-' + this.amount, this.x, this.y);
    ctx.fillStyle     = col;
    // Glow on heavy hits
    if (this.amount >= 25) {
      ctx.shadowColor = col;
      ctx.shadowBlur  = 6;
    }
    ctx.fillText('-'  + this.amount, this.x, this.y);
    ctx.restore();
  }
}

