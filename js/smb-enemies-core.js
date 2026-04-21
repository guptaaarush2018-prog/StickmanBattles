'use strict';
// smb-enemies-core.js — Minion class (wave AI) + ForestBeast class (roaming melee AI)
// Depends on: smb-globals.js, smb-fighter.js, smb-data-weapons.js

// ============================================================
// MINION  (lightweight boss-spawned enemy)
// ============================================================
class Minion extends Fighter {
  constructor(x, y) {
    const wKey = Math.random() < 0.5 ? 'axe' : 'sword';
    super(x, y, '#bb00ee', wKey,
      { left:null, right:null, jump:null, attack:null, ability:null, super:null },
      true, 'hard');
    this.name      = 'MINION';
    this.isMinion  = true;
    this.w         = 32;
    this.h         = 62;
    this.health    = 150;
    this.maxHealth = 150;
    this.lives     = 1;
    this.dmgMult   = 0.10; // deals 10% damage
    this.spawnX    = x;
    this.spawnY    = y;
    this.playerNum = 2;
  }

  // Minions never super
  useSuper() {}
  activateSuper() {}

  // Flat respawn override — minions just die, no countdown
  respawn() { this.health = 0; }
}

// ============================================================
// FOREST BEAST  (rare random encounter in forest arena)
// ============================================================
class ForestBeast extends Fighter {
  constructor(x, y) {
    super(x, y, '#1a8a2e', 'axe',
      { left:null, right:null, jump:null, attack:null, ability:null, super:null },
      true, 'hard');
    this.name       = 'BEAST';
    this.isBeast    = true;
    this.isMinion   = true;   // shares minion hit-detection code
    this.w          = 32;
    this.h          = 62;
    this.health     = 300;
    this.maxHealth  = 300;
    this.lives      = 1;
    this.dmgMult    = 1.5;    // deals 150% damage
    this.kbResist   = 0.4;    // absorbs 60% of knockback
    this.kbBonus    = 1.4;    // deals 40% extra knockback
    this.spawnX     = x;
    this.spawnY     = y;
    this.playerNum  = 2;
    this.dashCooldown = 120;  // initial delay before first dash
    this._lastPhase   = 1;    // for phase-transition cinematic
    this._slamCd      = 60;
    this._slamPhase   = 'none';
    this._slamTimer   = 0;
    this._leapCd      = 80;
    this._leapPhase   = 'none';
    this._leapAirborne = false;
    this._burstCd     = 0;
  }

  update() {
    super.update();

    if (this.health <= 0) return;

    // Phase transition: at 50% HP enter rage mode with cinematic
    const fbPhase = this.health <= this.maxHealth * 0.5 ? 2 : 1;
    if (fbPhase !== this._lastPhase) {
      this._lastPhase = fbPhase;
      this.isRaged = true;
      triggerPhaseTransition(this, fbPhase);
    }

    // Block AI behavior during cinematic
    if (activeCinematic) return;

    // ── Cooldown ticks ──────────────────────────────────────────
    if (this.dashCooldown   > 0) this.dashCooldown--;
    if (this._slamCd   > 0) this._slamCd--;
    if (this._leapCd   > 0) this._leapCd--;
    if (this._burstCd  > 0) this._burstCd--;

    // ── Slam wind-up / release ──────────────────────────────────
    if (this._slamPhase === 'windup') {
      this._slamTimer--;
      this.vx = 0; // plant feet during windup
      if (this._slamTimer <= 0) {
        this._slamPhase = 'impact';
        screenShake = Math.max(screenShake, 10);
        spawnParticles(this.cx(), this.y + this.h, '#553300', 20);
        spawnParticles(this.cx(), this.y + this.h, '#aa6600', 10);
        // Damage any target standing close on the ground
        for (const p of players) {
          if (p === this || p.health <= 0) continue;
          const dist = Math.abs(p.cx() - this.cx());
          if (dist < 90 && p.onGround) {
            dealDamage(this, p, Math.round(32 * this.dmgMult), 8);
            p.vy = -10; // launch up
          }
        }
        this._slamCd = this.isRaged ? 280 : 400;
        setTimeout(() => { this._slamPhase = 'none'; }, 300);
      }
      return;
    }

    // ── Leap wind-up / airborne ─────────────────────────────────
    if (this._leapPhase === 'launch') {
      // Already launched via vy; wait until we land
      if (this.onGround && this._leapAirborne) {
        this._leapAirborne = false;
        this._leapPhase    = 'none';
        // Land impact shockwave
        screenShake = Math.max(screenShake, 8);
        spawnParticles(this.cx(), this.y + this.h, '#553300', 16);
        for (const p of players) {
          if (p === this || p.health <= 0) continue;
          const dist = Math.abs(p.cx() - this.cx());
          if (dist < 70) dealDamage(this, p, Math.round(22 * this.dmgMult), 12);
        }
        this._leapCd = this.isRaged ? 220 : 340;
      }
      if (!this.onGround) this._leapAirborne = true;
      return;
    }

    // Dynamic retargeting: immediately retarget if current target is dead/missing
    if (!this.target || this.target.health <= 0) this._fbRetargetCd = 0;
    this._fbRetargetCd = (this._fbRetargetCd || 0) - 1;
    if (this._fbRetargetCd <= 0) {
      const _pool = players.filter(p => p !== this && p.health > 0);
      if (_pool.length > 0)
        this.target = _pool.reduce((a, b) => Math.abs(b.cx() - this.cx()) < Math.abs(a.cx() - this.cx()) ? b : a);
      this._fbRetargetCd = 30;
    }

    const tgt = this.target;
    if (!tgt || tgt.health <= 0) return;
    const dx  = tgt.cx() - this.cx();
    const dist = Math.abs(dx);

    // ── Ground slam: use when target is close ───────────────────
    if (this._slamCd <= 0 && dist < 100 && this.onGround && this._slamPhase === 'none') {
      this._slamPhase = 'windup';
      this._slamTimer = this.isRaged ? 18 : 26;
      // Warning circle on ground
      if (typeof bossWarnings !== 'undefined') {
        bossWarnings.push({ type: 'circle', x: this.cx(), y: this.y + this.h, r: 90,
          color: '#cc5500', timer: this._slamTimer + 4, maxTimer: this._slamTimer + 4, label: '' });
      }
      return;
    }

    // ── Leap attack: use at medium range ───────────────────────
    if (this._leapCd <= 0 && dist > 120 && dist < 340 && this.onGround && this._leapPhase === 'none') {
      this._leapPhase    = 'launch';
      this._leapAirborne = false;
      this.vy = -18;
      this.vx = Math.sign(dx) * 14;
      spawnParticles(this.cx(), this.y + this.h, '#1a8a2e', 12);
      return;
    }

    // ── Dash attack: charge when far away ──────────────────────
    if (this.dashCooldown <= 0 && dist > 180) {
      this.vx = Math.sign(dx) * (this.isRaged ? 20 : 16);
      spawnParticles(this.cx(), this.cy(), '#1a8a2e', 8);
      this.dashCooldown = this.isRaged ? 130 : 180 + Math.floor(Math.random() * 120);
    }

    // ── Fast burst combo in rage mode ──────────────────────────
    if (this.isRaged && this._burstCd <= 0 && dist < 80) {
      this.attack();
      this._burstCd = 22;
    }
  }

  useSuper() {}
  activateSuper() {}
  respawn() { this.health = 0; }

  draw() {
    if (this.health <= 0) return;
    ctx.save();
    // Blink when invincible
    if (this.invincible > 0 && Math.floor(this.invincible / 5) % 2 === 1) ctx.globalAlpha = 0.35;

    const cx = this.cx(), ty = this.y, f = this.facing;
    const clr = this.isRaged ? '#cc1100' : '#1a6622';
    const darkClr = this.isRaged ? '#880800' : '#0d3d14';

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(cx, ty + this.h + 4, this.w * 0.7, 6, 0, 0, Math.PI * 2); ctx.fill();

    // Body — hunched quadruped torso
    ctx.fillStyle = clr;
    ctx.strokeStyle = darkClr;
    ctx.lineWidth = 2;
    // Main body blob (wide, low-slung)
    ctx.beginPath();
    ctx.ellipse(cx, ty + this.h * 0.58, this.w * 0.72, this.h * 0.38, 0, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();

    // Hump / back
    ctx.beginPath();
    ctx.ellipse(cx - f * 4, ty + this.h * 0.38, this.w * 0.48, this.h * 0.28, 0, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();

    // Head (large, low, forward-leaning)
    const headX = cx + f * (this.w * 0.38);
    const headY = ty + this.h * 0.3;
    ctx.beginPath();
    ctx.ellipse(headX, headY, this.w * 0.38, this.w * 0.32, f > 0 ? -0.3 : 0.3, 0, Math.PI * 2);
    ctx.fillStyle = clr; ctx.fill(); ctx.stroke();

    // Snout / maw
    ctx.fillStyle = darkClr;
    ctx.beginPath();
    ctx.ellipse(headX + f * (this.w * 0.22), headY + 4, this.w * 0.18, this.w * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();

    // Fangs
    ctx.fillStyle = '#ffffcc';
    ctx.beginPath();
    ctx.moveTo(headX + f * (this.w * 0.26), headY + 7);
    ctx.lineTo(headX + f * (this.w * 0.30), headY + 16);
    ctx.lineTo(headX + f * (this.w * 0.22), headY + 7);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(headX + f * (this.w * 0.34), headY + 6);
    ctx.lineTo(headX + f * (this.w * 0.38), headY + 14);
    ctx.lineTo(headX + f * (this.w * 0.30), headY + 6);
    ctx.fill();

    // Eyes — glowing red
    ctx.fillStyle = this.isRaged ? '#ffff00' : '#ff2200';
    ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 8;
    ctx.beginPath(); ctx.arc(headX + f * 8, headY - 4, 4, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;

    // Front claws (arm)
    ctx.strokeStyle = darkClr; ctx.lineWidth = 4;
    const armX = cx + f * (this.w * 0.4);
    ctx.beginPath(); ctx.moveTo(armX, ty + this.h * 0.52); ctx.lineTo(armX + f * 14, ty + this.h * 0.72); ctx.stroke();
    // Claw tips
    ctx.strokeStyle = '#ffddaa'; ctx.lineWidth = 2;
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(armX + f * 14, ty + this.h * 0.72);
      ctx.lineTo(armX + f * 14 + i * 6, ty + this.h * 0.72 + 10);
      ctx.stroke();
    }

    // Back legs
    ctx.strokeStyle = darkClr; ctx.lineWidth = 4;
    const legX = cx - f * (this.w * 0.3);
    ctx.beginPath(); ctx.moveTo(legX, ty + this.h * 0.72); ctx.lineTo(legX - f * 8, ty + this.h + 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, ty + this.h * 0.76); ctx.lineTo(cx + f * 4, ty + this.h + 2); ctx.stroke();

    // Fur spikes on back
    ctx.fillStyle = darkClr;
    for (let i = 0; i < 5; i++) {
      const sx = cx - f * 18 + i * f * 9;
      const sy = ty + this.h * 0.25 - i * 2;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx - f * 3, sy - 12);
      ctx.lineTo(sx + f * 3, sy);
      ctx.fill();
    }

    // Raged: fire aura
    if (this.isRaged && settings.particles && this.animTimer % 3 === 0) {
      spawnParticles(cx, ty + this.h * 0.4, '#ff4400', 2);
    }

    // Name tag
    ctx.globalAlpha = 1;
    ctx.fillStyle = this.isRaged ? '#ff6600' : '#aaffaa';
    ctx.font = 'bold 11px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(this.name, cx, ty - 10);

    // HP bar
    const hpPct = Math.max(0, this.health / this.maxHealth);
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(cx - 24, ty - 22, 48, 5);
    ctx.fillStyle = `hsl(${hpPct * 120},100%,44%)`;
    ctx.fillRect(cx - 24, ty - 22, 48 * hpPct, 5);

    ctx.restore();
  }
}

// ============================================================
