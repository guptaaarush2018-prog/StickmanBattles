'use strict';
// smb-enemies-creatures.js — Yeti class (ice arena encounter) + Dummy class (training mode target)
// Depends on: smb-globals.js, smb-fighter.js, smb-data-weapons.js

// YETI  (rare random encounter in ice arena)
// ============================================================
class Yeti extends Fighter {
  constructor(x, y) {
    super(x, y, '#e8f4ff', 'hammer',
      { left:null, right:null, jump:null, attack:null, ability:null, super:null },
      true, 'hard');
    this.name         = 'YETI';
    this.isYeti       = true;
    this.isMinion     = true;
    this.w            = 40;
    this.h            = 76;
    this.health       = 200;  // reduced — mini-boss tier, not ultra-boss
    this.maxHealth    = 200;
    this.lives        = 1;
    this.dmgMult      = 1.1;  // deals ~10% bonus damage (was 2.25×)
    this.kbResist     = 0.30; // moderate KB resistance (was 0.55)
    this.kbBonus      = 1.3;  // mild extra KB (was 2.1)
    this.classSpeedMult = 0.3; // 0.3x speed
    this.spawnX       = x;
    this.spawnY       = y;
    this.playerNum    = 2;
    this.roarCooldown  = 300;  // frames before first roar
    this.spikeCooldown = 200;  // frames before first ice spike
    this.breathCooldown = 400;
    this.iceSpikes     = [];   // {x, y, timer, h} visual ice spikes
    this._lastPhase    = 1;    // for phase-transition cinematic
    this._heavyCd      = 160;  // charged heavy smash
    this._heavyPhase   = 'none'; // 'windup' | 'release' | 'none'
    this._heavyTimer   = 0;
    this._freezeZones  = [];   // {x, y, r, timer, maxTimer} — freeze patches on ground
  }

  update() {
    // Slow movement — override speed
    this.classSpeedMult = 0.3;
    super.update();
    // Extra friction to keep it slow
    this.vx *= 0.88;

    if (this.health <= 0) return;

    // Phase transition: at 50% HP trigger blizzard rage cinematic
    const yetiPhase = this.health <= this.maxHealth * 0.5 ? 2 : 1;
    if (yetiPhase !== this._lastPhase) {
      this._lastPhase = yetiPhase;
      triggerPhaseTransition(this, yetiPhase);
    }

    // Block AI behavior during cinematic
    if (activeCinematic) return;

    // ── Heavy smash wind-up / release ──────────────────────────
    if (this._heavyPhase === 'windup') {
      this._heavyTimer--;
      this.vx = 0;
      if (this._heavyTimer <= 0) {
        this._heavyPhase = 'release';
        screenShake = Math.max(screenShake, 20);
        // Seismic ground shake particles
        for (let i = 0; i < 5; i++)
          spawnParticles(this.cx() + (Math.random()-0.5)*160, this.y + this.h, '#aaddff', 4);
        // Freeze zone on ground
        this._freezeZones.push({ x: this.cx(), y: this.y + this.h, r: 110, timer: 240, maxTimer: 240 });
        // Damage + freeze players in range
        for (const p of players) {
          if (p === this || p.health <= 0) continue;
          const dd = Math.abs(p.cx() - this.cx());
          if (dd < 130) {
            dealDamage(this, p, Math.round(40 * this.dmgMult), 10);
            p.vy = -14;
            p.stunTimer = Math.max(p.stunTimer || 0, 60); // freeze stun
            spawnParticles(p.cx(), p.cy(), '#88ccff', 16);
          }
        }
        if (typeof SoundManager !== 'undefined') SoundManager.heavyHit();
        this._heavyCd = this.health < this.maxHealth * 0.5 ? 280 : 420;
        setTimeout(() => { this._heavyPhase = 'none'; }, 400);
      }
      return;
    }

    if (this._heavyCd > 0) this._heavyCd--;

    // Tick freeze zones
    this._freezeZones = this._freezeZones.filter(z => z.timer > 0);
    for (const z of this._freezeZones) {
      z.timer--;
      // Damage players standing in zone each ~30 frames
      if (z.timer % 30 === 0) {
        for (const p of players) {
          if (p === this || p.health <= 0) continue;
          if (Math.hypot(p.cx() - z.x, (p.y + p.h) - z.y) < z.r && p.onGround) {
            dealDamage(this, p, 4, 0);
            p.vx *= 0.4; // slow in freeze zone
          }
        }
      }
    }

    // Roar stun: stuns all nearby players
    if (this.roarCooldown > 0) this.roarCooldown--;
    else if (this.target && this.target.health > 0 && dist(this, this.target) < 220) {
      this.doRoar();
      this.roarCooldown = 420;
    }

    // Ice spikes: erupt from ground under players
    if (this.spikeCooldown > 0) this.spikeCooldown--;
    else if (this.target && this.target.health > 0) {
      this.doIceSpikes();
      this.spikeCooldown = 280;
    }

    // Ice breath: fan of slow projectiles
    if (this.breathCooldown > 0) this.breathCooldown--;
    else if (this.target && this.target.health > 0 && dist(this, this.target) < 300) {
      this.doIceBreath();
      this.breathCooldown = 360;
    }

    // Charged heavy smash: use when target is close
    if (this._heavyCd <= 0 && this.target && this.target.health > 0 &&
        dist(this, this.target) < 140 && this.onGround && this._heavyPhase === 'none') {
      this._heavyPhase = 'windup';
      this._heavyTimer = this.health < this.maxHealth * 0.5 ? 30 : 45;
      if (typeof bossWarnings !== 'undefined') {
        bossWarnings.push({ type: 'circle', x: this.cx(), y: this.y + this.h, r: 130,
          color: '#88ccff', timer: this._heavyTimer + 5, maxTimer: this._heavyTimer + 5, label: '❄ FREEZE SLAM' });
      }
      spawnParticles(this.cx(), this.cy(), '#aaddff', 12);
    }

    // Update visual spikes
    this.iceSpikes = this.iceSpikes.filter(sp => sp.timer > 0);
    for (const sp of this.iceSpikes) sp.timer--;
  }

  doRoar() {
    screenShake = Math.max(screenShake, 18);
    spawnParticles(this.cx(), this.cy(), '#aaddff', 20);
    if (settings.dmgNumbers) damageTexts.push(new DamageText(this.cx(), this.y - 20, 'ROAR!', '#aaddff'));
    for (const p of players) {
      if (p.isBoss || p.health <= 0) continue;
      if (dist(this, p) < 220) {
        p.stunTimer = Math.max(p.stunTimer || 0, 50);
        dealDamage(this, p, 4, 4);
        spawnParticles(p.cx(), p.cy(), '#88bbff', 10);
      }
    }
  }

  doIceSpikes() {
    const target = this.target;
    if (!target) return;
    // Spawn 3 spikes: one under target, two offset
    const offsets = [-60, 0, 60];
    for (const off of offsets) {
      const sx = clamp(target.cx() + off, 30, GAME_W - 30);
      this.iceSpikes.push({ x: sx, y: currentArena.deathY || 520, timer: 60, h: 80 });
      // Delayed damage
      setTimeout(() => {
        if (!gameRunning) return;
        for (const p of players) {
          if (p.isBoss || p.health <= 0) continue;
          if (Math.abs(p.cx() - sx) < 28 && p.y + p.h > (currentArena.deathY || 520) - 90) {
            dealDamage(this, p, 8, 7);
            p.vy = -9;
            spawnParticles(p.cx(), p.cy(), '#aaddff', 10);
          }
        }
      }, 400);
    }
    spawnParticles(target.cx(), target.cy() + 60, '#aaddff', 12);
  }

  doIceBreath() {
    const target = this.target;
    if (!target) return;
    const dx = target.cx() - this.cx();
    const baseAngle = Math.atan2(target.cy() - this.cy(), dx);
    for (let i = -2; i <= 2; i++) {
      const angle = baseAngle + i * 0.18;
      const spd = 5 + Math.random() * 2;
      const proj = new Projectile(
        this.cx() + Math.cos(angle) * 24,
        this.cy(),
        Math.cos(angle) * spd,
        Math.sin(angle) * spd,
        this, 5, '#88ccff'
      );
      proj.isIce = true;
      proj.life  = 70;
      projectiles.push(proj);
    }
    spawnParticles(this.cx() + this.facing * 24, this.cy(), '#aaddff', 10);
  }

  draw() {
    if (this.health <= 0) return;
    ctx.save();
    if (this.invincible > 0 && Math.floor(this.invincible / 5) % 2 === 1) ctx.globalAlpha = 0.35;

    const cx = this.cx(), ty = this.y;
    const clr = '#c8e8ff', dark = '#4477aa';

    // Draw freeze zones on ground
    for (const z of this._freezeZones) {
      const zAlpha = (z.timer / z.maxTimer) * 0.45;
      ctx.save();
      ctx.globalAlpha = zAlpha;
      const zg = ctx.createRadialGradient(z.x, z.y, 0, z.x, z.y, z.r);
      zg.addColorStop(0, 'rgba(180,230,255,0.9)');
      zg.addColorStop(0.7, 'rgba(100,180,255,0.5)');
      zg.addColorStop(1, 'rgba(80,150,255,0)');
      ctx.fillStyle = zg;
      ctx.beginPath(); ctx.ellipse(z.x, z.y, z.r, z.r * 0.35, 0, 0, Math.PI * 2); ctx.fill();
      // Crystal crack lines
      ctx.strokeStyle = 'rgba(200,240,255,0.6)'; ctx.lineWidth = 1;
      for (let ci = 0; ci < 6; ci++) {
        const ang = ci * Math.PI / 3;
        ctx.beginPath(); ctx.moveTo(z.x, z.y);
        ctx.lineTo(z.x + Math.cos(ang) * z.r * 0.8, z.y + Math.sin(ang) * z.r * 0.28);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Charged heavy smash wind-up indicator
    if (this._heavyPhase === 'windup') {
      const chargeP = 1 - this._heavyTimer / (this.health < this.maxHealth * 0.5 ? 30 : 45);
      ctx.save();
      ctx.globalAlpha = 0.7 * chargeP;
      ctx.strokeStyle = '#aaddff'; ctx.lineWidth = 3;
      ctx.shadowColor = '#aaddff'; ctx.shadowBlur = 16 * chargeP;
      ctx.beginPath(); ctx.arc(this.cx(), this.cy() - 10, 18 + chargeP * 22, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }

    // Draw visual ice spikes first (below yeti)
    for (const sp of this.iceSpikes) {
      const prog = Math.min(1, (60 - sp.timer) / 20);
      const hh = sp.h * prog;
      ctx.fillStyle = 'rgba(136,200,255,0.8)';
      ctx.beginPath();
      ctx.moveTo(sp.x - 10, sp.y);
      ctx.lineTo(sp.x, sp.y - hh);
      ctx.lineTo(sp.x + 10, sp.y);
      ctx.fill();
      ctx.fillStyle = 'rgba(200,240,255,0.6)';
      ctx.beginPath();
      ctx.moveTo(sp.x - 5, sp.y);
      ctx.lineTo(sp.x, sp.y - hh * 0.6);
      ctx.lineTo(sp.x + 5, sp.y);
      ctx.fill();
    }

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath(); ctx.ellipse(cx, ty + this.h + 5, this.w * 0.75, 7, 0, 0, Math.PI * 2); ctx.fill();

    // Body — large bulky torso
    ctx.fillStyle = clr; ctx.strokeStyle = dark; ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(cx, ty + this.h * 0.55, this.w * 0.62, this.h * 0.36, 0, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();

    // Arms — outstretched (idle) or raised
    const armRaise = this.state === 'attacking' ? -20 : 0;
    ctx.strokeStyle = dark; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.moveTo(cx - this.w * 0.44, ty + this.h * 0.38); ctx.lineTo(cx - this.w * 0.7, ty + this.h * 0.52 + armRaise); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + this.w * 0.44, ty + this.h * 0.38); ctx.lineTo(cx + this.w * 0.7, ty + this.h * 0.52 + armRaise); ctx.stroke();

    // Fists / paws
    ctx.fillStyle = clr;
    ctx.beginPath(); ctx.arc(cx - this.w * 0.7, ty + this.h * 0.52 + armRaise, 10, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx + this.w * 0.7, ty + this.h * 0.52 + armRaise, 10, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

    // Legs
    ctx.lineWidth = 8;
    ctx.beginPath(); ctx.moveTo(cx - 14, ty + this.h * 0.78); ctx.lineTo(cx - 18, ty + this.h + 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + 14, ty + this.h * 0.78); ctx.lineTo(cx + 18, ty + this.h + 2); ctx.stroke();

    // Head — round, prominent
    ctx.lineWidth = 2.5;
    ctx.fillStyle = clr;
    ctx.beginPath(); ctx.arc(cx, ty + this.h * 0.22, this.w * 0.4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

    // Ears
    ctx.beginPath(); ctx.arc(cx - this.w * 0.32, ty + this.h * 0.08, 8, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx + this.w * 0.32, ty + this.h * 0.08, 8, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

    // Glowing blue eyes
    ctx.fillStyle = '#0066ff'; ctx.shadowColor = '#0099ff'; ctx.shadowBlur = 10;
    ctx.beginPath(); ctx.arc(cx - 9, ty + this.h * 0.2, 5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + 9, ty + this.h * 0.2, 5, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;

    // Mouth (angry)
    ctx.strokeStyle = dark; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, ty + this.h * 0.26, 10, 0.2, Math.PI - 0.2); ctx.stroke();

    // Fur texture lines
    ctx.strokeStyle = 'rgba(100,150,220,0.3)'; ctx.lineWidth = 1;
    for (let i = 0; i < 6; i++) {
      const lx = cx - 18 + i * 7; const ly = ty + this.h * 0.4;
      ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(lx - 3, ly + 14); ctx.stroke();
    }

    // Name tag
    ctx.globalAlpha = 1; ctx.fillStyle = '#88ccff'; ctx.font = 'bold 12px Arial'; ctx.textAlign = 'center';
    ctx.fillText('YETI', cx, ty - 12);

    // HP bar
    const hpPct = Math.max(0, this.health / this.maxHealth);
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(cx - 26, ty - 24, 52, 5);
    ctx.fillStyle = `hsl(${hpPct * 120},100%,44%)`; ctx.fillRect(cx - 26, ty - 24, 52 * hpPct, 5);

    ctx.restore();
  }

  useSuper() {}
  activateSuper() {}
  respawn() { this.health = 0; }
}

