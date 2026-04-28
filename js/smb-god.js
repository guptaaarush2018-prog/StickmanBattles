'use strict';
// smb-god.js — God entity, encounter system, fake crash screen, Paradox ally
// Depends on: smb-globals.js, smb-fighter.js, smb-combat.js, smb-save.js
// Load after: smb-enemies-class.js
// Load before: smb-menu-startcore.js

// ── Godslayer weapon (granted to player in Phase 2 encounter) ──────────────
window.GODSLAYER_WEAPON = {
  name: 'Godslayer',
  damage: 180,
  range: 85,
  cooldown: 26,
  endlag: 8,
  kb: 20,
  abilityCooldown: 200,
  type: 'melee',
  weaponType: 'heavy',
  color: '#e8e8ff',
  abilityName: 'Divine Strike',
  ability(user, target) {
    if (typeof dealDamage !== 'function' || !target) return;
    user.vx = user.facing * 16;
    if (typeof dist === 'function' && dist(user, target) < 170) {
      dealDamage(user, target, 380, 24);
    }
  },
};

// ── Encounter state ────────────────────────────────────────────────────────
const _GOD_ATTACK_RANGE   = 160;
let _godEncounterCooldown = 0;
let _godWasAlive          = false;

function _getGodEncounterChance() {
  let denom = 1000000;
  if (typeof sovereignBeaten !== 'undefined' && sovereignBeaten) denom = Math.min(denom, 10000);
  if (typeof godEncountered  !== 'undefined' && godEncountered)  denom = Math.min(denom, 10000);
  if (typeof godDefeated     !== 'undefined' && godDefeated)     denom = Math.min(denom, 5000);
  return 1 / denom;
}

function _isGodPhase2() {
  return (typeof godEncountered !== 'undefined' && godEncountered) ||
         (typeof sovereignBeaten !== 'undefined' && sovereignBeaten);
}

function updateGodEncounterTick() {
  if (typeof gameRunning === 'undefined' || !gameRunning) return;
  if (typeof gameMode !== 'undefined' && gameMode === 'god') return;
  if (typeof gameMode !== 'undefined' && (gameMode === 'boss' || gameMode === 'trueform')) return;
  if (typeof onlineMode !== 'undefined' && onlineMode) return;
  if (_godEncounterCooldown > 0) { _godEncounterCooldown--; return; }
  if (typeof activeCinematic !== 'undefined' && activeCinematic) return;
  if (typeof storyModeActive !== 'undefined' && storyModeActive) return;
  if (Math.random() < _getGodEncounterChance()) {
    _godEncounterCooldown = 600;
    startGodEncounter();
  }
}

function spawnGod(consoleSummoned) {
  if (!Array.isArray(minions)) return null;
  if (minions.some(m => m instanceof God)) return null;
  const ref = Array.isArray(players) && players[0];
  const gx  = ref ? ref.x + (Math.random() < 0.5 ? 1 : -1) * (120 + Math.random() * 80) : 450;
  const gy  = ref ? ref.y - 100 : 200;
  const g   = new God(gx, gy);
  g._teamId          = 2;
  g._consoleSummoned = !!consoleSummoned;
  minions.push(g);
  return g;
}

function startGodEncounter() {
  if (typeof godEncountered !== 'undefined' && !godEncountered) {
    if (typeof setAccountFlagWithRuntime === 'function') {
      setAccountFlagWithRuntime(['unlocks', 'godEncountered'], true, v => { godEncountered = v; });
    } else {
      godEncountered = true;
    }
  }
  if (typeof godDefeated !== 'undefined' && godDefeated) {
    _showGodChallengePrompt();
    return;
  }
  if (typeof gameMode !== 'undefined') gameMode = 'god';
  if (typeof startGame === 'function') startGame();
}

function _showGodChallengePrompt() {
  if (document.getElementById('_godChallengeOverlay')) return;
  const style = document.createElement('style');
  style.id = '_godChallengeStyles';
  style.textContent = `
    #_godChallengeOverlay {
      position:fixed;inset:0;z-index:99998;
      background:rgba(0,0,8,0.72);
      display:flex;align-items:center;justify-content:center;
      animation:_gcFadeIn 0.3s ease;
    }
  `;
  document.head.appendChild(style);

  const div = document.createElement('div');
  div.id = '_godChallengeOverlay';
  div.innerHTML = `
    <div style="
      background:linear-gradient(160deg,#06001a,#0e0024);
      border:1.5px solid rgba(200,200,255,0.35);
      border-radius:18px;padding:32px 40px 26px;
      width:min(460px,90vw);
      box-shadow:0 8px 60px rgba(160,130,255,0.3),0 0 120px rgba(80,60,180,0.15);
      text-align:center;color:#ddd;">
      <div style="font-size:2.4rem;margin-bottom:10px;">✦</div>
      <div style="font-size:1.1rem;font-weight:800;color:#e8e0ff;letter-spacing:0.5px;margin-bottom:8px;">
        God has issued a challenge
      </div>
      <div style="font-size:0.82rem;color:#aaa;margin-bottom:22px;line-height:1.6;">
        A divine presence has chosen you once again.<br>
        Will you abandon this fight to answer the call?
      </div>
      <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;">
        <button id="_godChallengeAccept"
          style="background:rgba(200,180,255,0.18);border:1.5px solid rgba(200,180,255,0.55);
          color:#e0d8ff;border-radius:9px;padding:10px 28px;cursor:pointer;
          font-family:inherit;font-size:0.88rem;font-weight:700;transition:background 0.15s;">
          Accept
        </button>
        <button id="_godChallengeDecline"
          style="background:rgba(255,255,255,0.06);border:1.5px solid rgba(255,255,255,0.2);
          color:#999;border-radius:9px;padding:10px 28px;cursor:pointer;
          font-family:inherit;font-size:0.88rem;font-weight:700;transition:background 0.15s;">
          Decline
        </button>
      </div>
    </div>`;
  document.body.appendChild(div);

  function _closePrompt() {
    div.remove();
    const st = document.getElementById('_godChallengeStyles');
    if (st) st.remove();
  }
  document.getElementById('_godChallengeAccept').addEventListener('click', function () {
    _closePrompt();
    if (typeof gameMode !== 'undefined') gameMode = 'god';
    if (typeof startGame === 'function') startGame();
  });
  document.getElementById('_godChallengeDecline').addEventListener('click', function () {
    _closePrompt();
    _godEncounterCooldown = 300;
  });
}

function _checkGodDeath() {
  if (typeof gameMode === 'undefined' || gameMode !== 'god') return;
  if (!_godWasAlive) return;
  const hasGod = Array.isArray(minions) && minions.some(m => m.isGod);
  if (!hasGod) {
    _godWasAlive = false;
    _onGodDefeated();
  }
}

function _onGodDefeated() {
  if (typeof godDefeated !== 'undefined' && godDefeated) return;
  if (typeof setAccountFlagWithRuntime === 'function') {
    setAccountFlagWithRuntime(['unlocks', 'godDefeated'], true, v => { godDefeated = v; });
  } else {
    godDefeated = true;
  }
  if (typeof unlockAchievement === 'function') unlockAchievement('god_slayer');
}

// ── Fake crash screen ──────────────────────────────────────────────────────
function _showGodFakeCrash() {
  if (typeof gameRunning !== 'undefined') gameRunning = false;
  if (document.getElementById('_godCrashOverlay')) return;

  const style = document.createElement('style');
  style.id = '_godCrashStyles';
  style.textContent = `
    #_godCrashOverlay {
      position:fixed;inset:0;z-index:99999;
      background:rgba(4,0,12,0.97);
      display:flex;align-items:center;justify-content:center;
      font-family:'Segoe UI',Arial,sans-serif;
      animation:_gcFadeIn 0.25s ease;
    }
    @keyframes _gcFadeIn { from{opacity:0} to{opacity:1} }
    #_godCrashOverlay > div { animation:_gcFadeIn 0.3s ease; }
  `;
  document.head.appendChild(style);

  const div = document.createElement('div');
  div.id = '_godCrashOverlay';
  div.innerHTML = `
    <div style="
      background:linear-gradient(160deg,#0a001a,#120028);
      border:1.5px solid rgba(255,60,60,0.45);
      border-radius:18px;padding:36px 40px 28px;
      width:min(520px,92vw);
      box-shadow:0 8px 60px rgba(200,0,0,0.25),0 0 120px rgba(100,0,200,0.15);
      text-align:center;color:#ddd;">
      <div style="font-size:2.8rem;margin-bottom:10px;">💥</div>
      <div style="font-size:1.25rem;font-weight:800;color:#ff6666;letter-spacing:0.5px;margin-bottom:8px;">
        Critical Error
      </div>
      <div style="font-size:0.82rem;color:#aaa;margin-bottom:16px;line-height:1.55;">
        The game encountered a fatal error and had to stop.<br>
        Your progress in this match has been lost.
      </div>
      <div style="background:rgba(0,0,0,0.5);border-radius:8px;padding:10px 14px;
        font-family:monospace;font-size:0.68rem;color:#ff9999;text-align:left;
        margin-bottom:20px;max-height:90px;overflow-y:auto;word-break:break-all;
        border:1px solid rgba(255,80,80,0.2);">
        Your presence is not accepted here.
      </div>
      <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;">
        <button id="_godCrashMenuBtn"
          style="background:rgba(255,60,60,0.2);border:1.5px solid rgba(255,80,80,0.6);
          color:#ff8888;border-radius:9px;padding:10px 24px;cursor:pointer;
          font-family:inherit;font-size:0.88rem;font-weight:700;transition:background 0.15s;">
          🔄 Return to Menu
        </button>
      </div>
    </div>`;
  document.body.appendChild(div);

  document.getElementById('_godCrashMenuBtn').addEventListener('click', function () {
    div.remove();
    const st = document.getElementById('_godCrashStyles');
    if (st) st.remove();
    if (typeof backToMenu === 'function') backToMenu();
  });
}

// ── God entity ─────────────────────────────────────────────────────────────
class God extends Fighter {
  constructor(x, y) {
    super(x, y, '#ffffff', 'sword',
      { left: null, right: null, jump: null, attack: null, ability: null, super: null },
      true, 'hard');
    this.name      = 'GOD';
    this.isGod     = true;
    this.isMinion  = true;
    this.w         = 32;
    this.h         = 62;
    this.lives     = 1;
    this.spawnX    = x;
    this.spawnY    = y;
    this.playerNum = 99;
    this._attackCd      = 90;
    this._crashFired    = false;
    this._consoleSummoned = false;

    // Continuous animation timers
    this._wingAngle  = 0;
    this._auraPhase  = 0;
    this._hoverTime  = 0;
    this._crossAngle = 0;
    this._runeAngle  = 0;
    this._haloAngles = [0, Math.PI / 3, Math.PI * 2 / 3];

    // Trail
    this._trailPoints = [];
    this._trailTimer  = 0;

    // Flying state
    this._flyVy = 0;

    // Special attack state (Phase 2)
    this._specialCd     = 220;
    this._angelCooldown = 0;
    this._columns       = [];
    this._novaRings     = [];
    this._smiteRings    = [];

    this._phase = _isGodPhase2() ? 2 : 1;
    if (this._phase === 1) {
      this.health    = 1e15;
      this.maxHealth = 1e15;
      this.dmgMult   = 9999;
      this.kbBonus   = 1.5;
      this.kbResist  = 0.9;
    } else {
      this.health    = 100000;
      this.maxHealth = 100000;
      this.dmgMult   = 3.0;
      this.kbBonus   = 1.2;
      this.kbResist  = 0.7;
    }
  }

  respawn()       { this.health = 0; }
  useSuper()      {}
  activateSuper() {}

  // ── Special attacks ────────────────────────────────────────────────────

  _doAngelFleet(target) {
    if (!target || !Array.isArray(minions)) return;
    const count = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < count; i++) {
      const spawnX = target.cx() + (Math.random() - 0.5) * 220;
      const angel  = new HolyAngel(spawnX, -50);
      angel._teamId = 2;
      minions.push(angel);
    }
    if (typeof spawnParticles === 'function') spawnParticles(this.cx(), this.y, '#ffffc0', 14);
    if (typeof screenShake !== 'undefined') screenShake = Math.max(screenShake, 4);
  }

  _doDivineColumn(target) {
    if (!target) return;
    this._columns.push({ x: target.cx(), timer: 0, maxTimer: 100, hitDealt: false });
  }

  _doHolySmite() {
    // Slam downward then rebound
    this._flyVy = 14;
    this._smiteRings.push({ r: 0, maxR: 230, alpha: 1.0, _hitChecked: false });
    if (typeof screenShake !== 'undefined') screenShake = Math.max(screenShake, 7);
  }

  _doRadiantNova() {
    const cx = this.cx();
    const cy = this.y + this.h / 2;
    const COUNT = 12;
    for (let i = 0; i < COUNT; i++) {
      const angle = (i / COUNT) * Math.PI * 2;
      this._novaRings.push({
        x: cx, y: cy,
        vx: Math.cos(angle) * 5.8,
        vy: Math.sin(angle) * 5.8,
        timer: 0, maxTimer: 72, hitDealt: false,
      });
    }
    if (typeof spawnParticles === 'function') spawnParticles(cx, cy, '#ffee88', 18);
  }

  _pickAndFireSpecial(target) {
    if (!target || this._phase !== 2) return;
    const hpFrac = this.health / this.maxHealth;
    const roll   = Math.random();
    if (this._angelCooldown <= 0 && roll < 0.3) {
      this._doAngelFleet(target);
      this._angelCooldown = 580;
    } else if (roll < 0.52) {
      this._doDivineColumn(target);
    } else if (roll < 0.72) {
      this._doHolySmite();
    } else {
      this._doRadiantNova();
    }
    this._specialCd = hpFrac < 0.3 ? 170 : hpFrac < 0.6 ? 230 : 300;
  }

  // ── Special effect logic ───────────────────────────────────────────────

  _updateColumns() {
    for (let i = this._columns.length - 1; i >= 0; i--) {
      const col = this._columns[i];
      col.timer++;
      if (!col.hitDealt && col.timer >= col.maxTimer - 8) {
        col.hitDealt = true;
        if (Array.isArray(players) && typeof dealDamage === 'function') {
          for (const p of players) {
            if (p.health <= 0 || p.isMinion) continue;
            if (p._teamId !== undefined && this._teamId !== undefined && p._teamId === this._teamId) continue;
            if (Math.abs(p.cx() - col.x) < 46) dealDamage(this, p, 160, 14);
          }
        }
        if (typeof screenShake !== 'undefined') screenShake = Math.max(screenShake, 8);
        if (typeof spawnParticles === 'function') {
          const gh = typeof GAME_H !== 'undefined' ? GAME_H : 520;
          spawnParticles(col.x, gh * 0.5, '#ffffc0', 22);
        }
      }
      if (col.timer >= col.maxTimer + 35) this._columns.splice(i, 1);
    }
  }

  _updateNova() {
    for (let i = this._novaRings.length - 1; i >= 0; i--) {
      const b = this._novaRings[i];
      b.x += b.vx; b.y += b.vy; b.timer++;
      if (!b.hitDealt && Array.isArray(players) && typeof dealDamage === 'function') {
        for (const p of players) {
          if (p.health <= 0 || p.isMinion) continue;
          if (p._teamId !== undefined && this._teamId !== undefined && p._teamId === this._teamId) continue;
          if (Math.hypot(p.cx() - b.x, (p.y + p.h / 2) - b.y) < 28) {
            dealDamage(this, p, 85, 10);
            b.hitDealt = true;
          }
        }
      }
      if (b.timer >= b.maxTimer || b.hitDealt) this._novaRings.splice(i, 1);
    }
  }

  _updateSmiteRings() {
    for (let i = this._smiteRings.length - 1; i >= 0; i--) {
      const ring = this._smiteRings[i];
      ring.r    += 10;
      ring.alpha = Math.max(0, ring.alpha - 0.022);
      if (!ring._hitChecked && ring.r > 50 && typeof dealDamage === 'function' && Array.isArray(players)) {
        ring._hitChecked = true;
        for (const p of players) {
          if (p.health <= 0 || p.isMinion) continue;
          if (p._teamId !== undefined && this._teamId !== undefined && p._teamId === this._teamId) continue;
          if (Math.hypot(p.cx() - this.cx(), (p.y + p.h / 2) - (this.y + this.h / 2)) < ring.maxR * 0.9) {
            dealDamage(this, p, 130, 16);
          }
        }
      }
      if (ring.alpha <= 0) this._smiteRings.splice(i, 1);
    }
  }

  // ── Update (flying) ────────────────────────────────────────────────────

  update() {
    if (this.health <= 0) return;
    if (typeof activeCinematic !== 'undefined' && activeCinematic) return;

    this._wingAngle  += 0.07;
    this._auraPhase  += 0.038;
    this._hoverTime  += 0.028;
    this._crossAngle += 0.007;

    if (this._attackCd > 0) this._attackCd--;
    if (this._specialCd > 0) this._specialCd--;
    if (this._angelCooldown > 0) this._angelCooldown--;

    this._trailTimer++;
    if (this._trailTimer >= 4) {
      this._trailTimer = 0;
      this._trailPoints.unshift({ x: this.cx(), y: this.y + this.h * 0.38 });
      if (this._trailPoints.length > 18) this._trailPoints.pop();
    }

    this._updateColumns();
    this._updateNova();
    this._updateSmiteRings();

    // Recover from smite dive
    if (this._flyVy > 0 && this._flyVy > -2) this._flyVy -= 1.2;

    // Find nearest target
    let target = null, minDist = Infinity;
    if (Array.isArray(players)) {
      for (const p of players) {
        if (p === this || p.isMinion || p.health <= 0) continue;
        if (p._teamId !== undefined && this._teamId !== undefined && p._teamId === this._teamId) continue;
        const d = Math.hypot(p.cx() - this.cx(), (p.y + p.h / 2) - (this.y + this.h / 2));
        if (d < minDist) { minDist = d; target = p; }
      }
    }
    if (!target) return;

    this.target = target;
    this.facing = Math.sign(target.cx() - this.cx()) || 1;

    // Desired hover position: above target with slow sinusoidal drift
    const hoverX = target.cx() + Math.sin(this._hoverTime * 0.42) * 95;
    const hoverY = (target.y + target.h / 2) - 115 + Math.sin(this._hoverTime * 0.68) * 22;

    const errX    = hoverX - this.cx();
    const errY    = hoverY - (this.y + this.h / 2);
    const flySpd  = this._phase === 1 ? 7.5 : 5.5;
    const flyDist = Math.hypot(errX, errY) || 1;
    const spd     = Math.min(flySpd, flyDist);

    this.vx      = (errX / flyDist) * spd;
    this._flyVy += (errY / flyDist) * spd * 0.35;
    this._flyVy  = Math.max(-12, Math.min(12, this._flyVy));

    // Feed flyVy to Fighter physics by cancelling gravity before super.update()
    this.vy = this._flyVy - 0.65;
    super.update();

    // Hard clamp — don't land on ground
    const GH = typeof GAME_H !== 'undefined' ? GAME_H : 520;
    const GW = typeof GAME_W !== 'undefined' ? GAME_W : 900;
    this.y = Math.max(8, Math.min(GH * 0.88 - this.h, this.y));
    this.x = Math.max(18, Math.min(GW - this.w - 18, this.x));

    // Melee strike when close
    if (minDist < _GOD_ATTACK_RANGE && this._attackCd <= 0 && typeof dealDamage === 'function') {
      const baseDmg = this.weapon ? (this.weapon.damage || 20) : 20;
      dealDamage(this, target, baseDmg, 8);
      this._attackCd = this._phase === 1 ? 40 : 60;
    }

    if (this._phase === 2 && this._specialCd <= 0) this._pickAndFireSpecial(target);
  }

  // ── Draw ───────────────────────────────────────────────────────────────

  draw() {
    if (this.health <= 0) return;
    if (typeof ctx === 'undefined') return;

    const cx    = this.cx();
    const headY = this.y + 11;
    const cy    = this.y + this.h * 0.44;
    const t     = this._wingAngle;
    const p2    = this._phase === 2;

    // Colour palette
    const mainCol   = p2 ? '#e0ccff' : '#ffffff';
    const glowCol   = p2 ? 'rgba(200,145,255,0.98)' : 'rgba(225,242,255,0.98)';
    const accentCol = p2 ? 'rgba(210,160,255,1)'     : 'rgba(255,242,100,1)';

    ctx.save();

    // ── Movement trail ─────────────────────────────────────────────────
    for (let i = 0; i < this._trailPoints.length; i++) {
      const tp = this._trailPoints[i];
      const a  = ((this._trailPoints.length - i) / this._trailPoints.length) * 0.22;
      ctx.beginPath();
      ctx.arc(tp.x, tp.y, 7 - i * 0.35, 0, Math.PI * 2);
      ctx.fillStyle = p2 ? `rgba(200,150,255,${a})` : `rgba(255,245,130,${a})`;
      ctx.fill();
    }

    // ── Layer 1: Vast outer radiance ────────────────────────────────────
    const farR    = 95 + Math.sin(this._auraPhase * 0.38) * 10;
    const farGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, farR);
    farGrad.addColorStop(0, p2 ? 'rgba(170,90,255,0.09)' : 'rgba(255,252,200,0.11)');
    farGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.beginPath();
    ctx.arc(cx, cy, farR, 0, Math.PI * 2);
    ctx.fillStyle = farGrad;
    ctx.fill();

    // ── Layer 2: Divine star/cross geometry (slow rotation) ─────────────
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(this._crossAngle);
    const RAYS = 8;
    for (let r = 0; r < RAYS; r++) {
      const ang   = (r / RAYS) * Math.PI * 2;
      const rLen  = r % 2 === 0 ? 88 : 56;
      const pulse = rLen * (1 + Math.sin(t * 0.55 + r * 0.65) * 0.07);
      ctx.save();
      ctx.rotate(ang);
      const rGrad = ctx.createLinearGradient(0, -6, 0, -pulse);
      rGrad.addColorStop(0, p2 ? 'rgba(200,140,255,0.38)' : 'rgba(255,242,120,0.42)');
      rGrad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle   = rGrad;
      ctx.shadowColor = accentCol;
      ctx.shadowBlur  = 8;
      ctx.beginPath();
      ctx.moveTo(-5, 0);
      ctx.lineTo(0, -pulse);
      ctx.lineTo(5, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();

    // ── Layer 3: Gyroscopic halo rings (3 rings, different tilt axes) ───
    for (let h = 0; h < 3; h++) {
      this._haloAngles[h] += 0.011 + h * 0.006;
      const ha    = this._haloAngles[h];
      const rx    = 30 + h * 7;
      const ry    = 7  + h * 2;
      const alpha = 0.72 - h * 0.16 + Math.sin(t * 1.1 + h * 1.4) * 0.1;
      const hCol  = h === 0
        ? `rgba(255,248,110,${alpha})`
        : h === 1
        ? `rgba(255,225,60,${alpha * 0.85})`
        : (p2 ? `rgba(200,145,255,${alpha * 0.7})` : `rgba(255,200,40,${alpha * 0.7})`);
      ctx.save();
      ctx.translate(cx, headY - 5);
      ctx.rotate(ha);
      ctx.strokeStyle = hCol;
      ctx.lineWidth   = 2.8 - h * 0.5;
      ctx.shadowColor = accentCol;
      ctx.shadowBlur  = 18 + h * 4;
      ctx.beginPath();
      ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // ── Layer 4: Four pairs of seraphic wings ────────────────────────────
    const wingFills = p2
      ? ['rgba(185,115,255,0.7)', 'rgba(155,85,240,0.48)', 'rgba(125,55,210,0.3)', 'rgba(100,35,185,0.18)']
      : ['rgba(245,250,255,0.78)', 'rgba(220,236,255,0.52)', 'rgba(195,220,255,0.32)', 'rgba(170,205,255,0.18)'];

    for (let pair = 0; pair < 4; pair++) {
      const yOff      = (pair - 1.5) * 19;
      const spread    = 58 - pair * 6;
      const thickness = 17 - pair * 2;
      const flapSpd   = 0.72 + pair * 0.22;
      const wave      = Math.sin(t * flapSpd + pair * 0.95) * 13;
      const tilt      = 0.18 + pair * 0.1;

      ctx.fillStyle   = wingFills[pair];
      ctx.strokeStyle = p2 ? 'rgba(215,175,255,0.45)' : 'rgba(230,242,255,0.5)';
      ctx.lineWidth   = 0.7;
      ctx.shadowColor = p2 ? 'rgba(165,95,255,0.55)' : 'rgba(205,228,255,0.55)';
      ctx.shadowBlur  = 8;

      for (const side of [-1, 1]) {
        // Primary wing lobe — gradient-filled
        const wGrad = ctx.createRadialGradient(
          cx + side * spread * 0.35, cy + yOff - wave * 0.6, 0,
          cx + side * spread * 0.55, cy + yOff - wave, spread * 0.7
        );
        wGrad.addColorStop(0, wingFills[pair].replace(/[\d.]+\)$/, `${parseFloat(wingFills[pair].match(/[\d.]+\)$/)[0]) * 1.6})`));
        wGrad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = wGrad;

        ctx.beginPath();
        ctx.ellipse(
          cx + side * spread * 0.52,
          cy + yOff - wave,
          spread * 0.62,
          thickness,
          side * tilt,
          0, Math.PI * 2
        );
        ctx.fill();
        ctx.stroke();

        // Outer wing tip lobe
        if (pair < 2) {
          ctx.fillStyle   = wingFills[pair].replace(/[\d.]+\)$/, '0.32)');
          ctx.shadowBlur  = 5;
          ctx.beginPath();
          ctx.ellipse(
            cx + side * (spread * 0.82),
            cy + yOff - wave - 7,
            spread * 0.22, thickness * 0.55,
            side * (tilt + 0.28),
            0, Math.PI * 2
          );
          ctx.fill();
        }

        // Feather quill strokes
        ctx.strokeStyle = p2 ? 'rgba(200,165,255,0.38)' : 'rgba(215,238,255,0.42)';
        ctx.lineWidth   = 0.55;
        ctx.shadowBlur  = 2;
        const QUILLS = 6;
        for (let q = 0; q < QUILLS; q++) {
          const qf  = q / (QUILLS - 1);
          const qx  = cx + side * (spread * 0.15 + qf * spread * 0.72);
          const qy  = cy + yOff - wave * (0.55 + qf * 0.45);
          const qL  = 14 - qf * 5;
          ctx.beginPath();
          ctx.moveTo(qx, qy);
          ctx.lineTo(qx + side * qL * 0.5, qy + qL);
          ctx.stroke();
        }
        ctx.strokeStyle = p2 ? 'rgba(215,175,255,0.45)' : 'rgba(230,242,255,0.5)';
        ctx.lineWidth   = 0.7;
        ctx.shadowBlur  = 8;
      }
    }

    // ── Layer 5: Flowing divine mantle ───────────────────────────────────
    const mFlow = Math.sin(t * 0.38) * 16;
    const mDir  = -this.facing * 28;
    ctx.save();
    for (let m = 0; m < 3; m++) {
      const mA   = 0.20 - m * 0.055;
      const mOff = m * 9;
      ctx.fillStyle   = p2 ? `rgba(150,70,240,${mA})` : `rgba(255,232,100,${mA})`;
      ctx.shadowColor = p2 ? 'rgba(130,55,210,0.45)' : 'rgba(255,220,60,0.45)';
      ctx.shadowBlur  = 14;
      ctx.beginPath();
      ctx.moveTo(cx - 16, cy - 2);
      ctx.quadraticCurveTo(cx + mDir - mOff, cy + 22 + mFlow, cx + mDir * 1.6 - mOff, cy + 58 + mFlow * 0.7);
      ctx.quadraticCurveTo(cx + mDir * 0.6 - mOff, cy + 50 + mFlow, cx, cy + 34);
      ctx.quadraticCurveTo(cx + mDir * 0.6 + mOff, cy + 50 + mFlow, cx + mDir * 1.6 + mOff, cy + 58 + mFlow * 0.7);
      ctx.quadraticCurveTo(cx + mDir + mOff, cy + 22 + mFlow, cx + 16, cy - 2);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // ── Layer 6: Body-close inner radiance ───────────────────────────────
    const iR    = 30 + Math.sin(this._auraPhase * 1.1) * 4;
    const iGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, iR);
    iGrad.addColorStop(0, p2 ? 'rgba(210,158,255,0.28)' : 'rgba(255,255,225,0.32)');
    iGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.beginPath();
    ctx.arc(cx, cy, iR, 0, Math.PI * 2);
    ctx.fillStyle = iGrad;
    ctx.fill();

    // ── Layer 7: The stickman — buried in divinity ──────────────────────
    // Lines are thick + extreme blur so they read as columns of light, not sticks
    ctx.strokeStyle = mainCol;
    ctx.lineWidth   = 5.5;
    ctx.shadowColor = glowCol;
    ctx.shadowBlur  = 28;
    ctx.lineCap     = 'round';
    ctx.lineJoin    = 'round';

    // Head
    ctx.beginPath();
    ctx.arc(cx, headY, 11, 0, Math.PI * 2);
    ctx.stroke();
    // Second pass at reduced opacity for layered glow
    ctx.globalAlpha  = 0.4;
    ctx.lineWidth    = 10;
    ctx.shadowBlur   = 40;
    ctx.beginPath();
    ctx.arc(cx, headY, 11, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.lineWidth   = 5.5;
    ctx.shadowBlur  = 28;

    // Torso
    const torsoY = headY + 11;
    ctx.beginPath();
    ctx.moveTo(cx, torsoY);
    ctx.lineTo(cx, torsoY + 26);
    ctx.stroke();

    // Arms — outstretched like a cruciform figure, animated
    const armY    = torsoY + 10;
    const armWave = Math.sin(t * 0.48) * 6;
    ctx.beginPath();
    ctx.moveTo(cx - 22, armY + 6 + armWave);
    ctx.lineTo(cx, armY);
    ctx.lineTo(cx + 22, armY + 6 - armWave);
    ctx.stroke();

    // Legs — slow glide motion
    const legY    = torsoY + 26;
    const legWave = Math.sin(t * 0.38) * 4;
    ctx.beginPath();
    ctx.moveTo(cx, legY);
    ctx.lineTo(cx - 14, legY + 22 + legWave);
    ctx.moveTo(cx, legY);
    ctx.lineTo(cx + 14, legY + 22 - legWave);
    ctx.stroke();

    // ── Layer 8: Diamond-shard eyes ──────────────────────────────────────
    const eyeGlow  = p2 ? 'rgba(225,185,255,1)' : 'rgba(255,255,180,1)';
    const eyeFill  = p2 ? '#e8ccff' : '#ffffcc';
    const eyeF     = this.facing;
    ctx.shadowColor = eyeGlow;
    ctx.shadowBlur  = 22;
    ctx.fillStyle   = eyeFill;
    for (const ox of [-3.5, 3.5]) {
      ctx.save();
      ctx.translate(cx + eyeF * 1.5 + ox, headY - 1);
      ctx.rotate(Math.PI / 4);
      ctx.beginPath();
      ctx.rect(-3, -3, 6, 6);
      ctx.fill();
      ctx.restore();
    }

    // ── Layer 9: Sunburst crown behind head ──────────────────────────────
    const BURST = 14;
    ctx.save();
    ctx.translate(cx, headY);
    ctx.rotate(this._runeAngle * 0.45);
    for (let r = 0; r < BURST; r++) {
      const ba  = (r / BURST) * Math.PI * 2;
      const bL  = r % 2 === 0 ? 30 : 19;
      const bAl = 0.55 + Math.sin(t * 0.75 + r * 0.42) * 0.22;
      ctx.strokeStyle = p2
        ? `rgba(200,150,255,${bAl})`
        : `rgba(255,242,100,${bAl})`;
      ctx.lineWidth   = r % 2 === 0 ? 2.0 : 1.0;
      ctx.shadowColor = accentCol;
      ctx.shadowBlur  = 14;
      ctx.beginPath();
      ctx.moveTo(Math.cos(ba) * 13, Math.sin(ba) * 13);
      ctx.lineTo(Math.cos(ba) * bL, Math.sin(ba) * bL);
      ctx.stroke();
    }
    ctx.restore();

    // ── Layer 10: Lissajous-orbit runes ──────────────────────────────────
    this._runeAngle += 0.016;
    const RUNE_N = p2 ? 14 : 10;
    for (let i = 0; i < RUNE_N; i++) {
      const base  = this._runeAngle + (i / RUNE_N) * Math.PI * 2;
      const rx    = cx + Math.cos(base) * 58 + Math.cos(base * 2.1 + i * 0.6) * 12;
      const ry    = cy + Math.sin(base) * 30 + Math.sin(base * 1.8 + i * 0.6) * 9;
      const brite = 0.38 + Math.sin(t * 1.05 + i * 0.85) * 0.28;
      ctx.save();
      ctx.translate(rx, ry);
      ctx.rotate(base * 2.8);
      ctx.shadowColor = p2 ? 'rgba(215,165,255,0.9)' : 'rgba(255,232,80,0.9)';
      ctx.shadowBlur  = 9;
      ctx.strokeStyle = p2 ? `rgba(210,170,255,${brite})` : `rgba(255,242,108,${brite})`;
      ctx.lineWidth   = 1.3;
      // Star-rune: two overlapping triangles
      ctx.beginPath();
      for (let v = 0; v < 6; v++) {
        const va = (v / 6) * Math.PI * 2;
        const vr = v % 2 === 0 ? 5.5 : 2.5;
        v === 0 ? ctx.moveTo(Math.cos(va) * vr, Math.sin(va) * vr)
                : ctx.lineTo(Math.cos(va) * vr, Math.sin(va) * vr);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    }

    ctx.restore();

    // ── Special effect overlays ──────────────────────────────────────────
    this._drawSpecialEffects(cx, cy);

    // ── Health bar (Phase 2) ─────────────────────────────────────────────
    if (this._phase === 2 || this._consoleSummoned) {
      const barW = 82, barH = 7;
      const bx   = cx - barW / 2;
      const by   = this.y - 26;
      const pct  = Math.max(0, this.health / this.maxHealth);

      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      ctx.fillRect(bx - 1, by - 1, barW + 2, barH + 2);

      const bGrad = ctx.createLinearGradient(bx, by, bx + barW * pct, by + barH);
      if (p2) {
        bGrad.addColorStop(0, '#cc88ff');
        bGrad.addColorStop(0.5, '#ee99ff');
        bGrad.addColorStop(1, '#9944dd');
      } else {
        bGrad.addColorStop(0, '#ffcc44');
        bGrad.addColorStop(0.5, '#ffe088');
        bGrad.addColorStop(1, '#ffaa00');
      }
      ctx.fillStyle = bGrad;
      ctx.fillRect(bx, by, barW * pct, barH);

      ctx.save();
      ctx.shadowColor = p2 ? 'rgba(200,140,255,0.9)' : 'rgba(255,225,80,0.9)';
      ctx.shadowBlur  = 10;
      ctx.fillStyle   = p2 ? '#f0d8ff' : '#ffffc0';
      ctx.font        = 'bold 11px Arial';
      ctx.textAlign   = 'center';
      ctx.fillText('✦ GOD ✦', cx, by - 4);
      ctx.textAlign   = 'left';
      ctx.restore();
    }
  }

  // ── Draw active special effects ────────────────────────────────────────

  _drawSpecialEffects(godCx, godCy) {
    if (typeof ctx === 'undefined') return;
    const p2 = this._phase === 2;
    const GH = typeof GAME_H !== 'undefined' ? GAME_H : 520;

    // Divine column warnings & strikes
    for (const col of this._columns) {
      const frac = col.timer / col.maxTimer;
      ctx.save();
      if (col.timer < col.maxTimer) {
        // Warning: shrinking crosshair + beam silhouette
        const wA    = 0.22 + Math.sin(col.timer * 0.26) * 0.14;
        const beamW = 55 * (1 - frac * 0.78);
        const cGrad = ctx.createLinearGradient(col.x, 0, col.x, GH);
        cGrad.addColorStop(0,   `rgba(255,255,160,${wA * 0.45})`);
        cGrad.addColorStop(0.5, `rgba(255,225,80,${wA})`);
        cGrad.addColorStop(1,   `rgba(255,200,0,${wA * 0.45})`);
        ctx.fillStyle = cGrad;
        ctx.fillRect(col.x - beamW / 2, 0, beamW, GH);
        // Ground circle
        ctx.strokeStyle = `rgba(255,210,60,${0.42 + Math.sin(col.timer * 0.3) * 0.2})`;
        ctx.lineWidth   = 2.2;
        ctx.shadowColor = 'rgba(255,225,80,0.8)';
        ctx.shadowBlur  = 12;
        ctx.beginPath();
        ctx.arc(col.x, GH - 12, 44 - frac * 18, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        // Strike: full column blast fading out
        const sa = Math.max(0, 1 - (col.timer - col.maxTimer) / 35);
        const sGrad = ctx.createLinearGradient(col.x - 28, 0, col.x + 28, 0);
        sGrad.addColorStop(0,   'rgba(255,255,220,0)');
        sGrad.addColorStop(0.5, `rgba(255,255,255,${sa * 0.95})`);
        sGrad.addColorStop(1,   'rgba(255,255,220,0)');
        ctx.fillStyle = sGrad;
        ctx.fillRect(col.x - 28, 0, 56, GH);
        ctx.shadowColor = 'rgba(255,255,110,1)';
        ctx.shadowBlur  = 28;
        ctx.strokeStyle = `rgba(255,255,210,${sa})`;
        ctx.lineWidth   = 3.5;
        ctx.beginPath();
        ctx.moveTo(col.x, 0); ctx.lineTo(col.x, GH);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Radiant nova orbs
    for (const b of this._novaRings) {
      const a = Math.max(0, 1 - b.timer / b.maxTimer);
      ctx.save();
      ctx.shadowColor = p2 ? 'rgba(220,180,255,0.9)' : 'rgba(255,232,80,0.9)';
      ctx.shadowBlur  = 16;
      // Outer glow orb
      ctx.fillStyle = p2 ? `rgba(200,150,255,${a * 0.5})` : `rgba(255,235,100,${a * 0.5})`;
      ctx.beginPath();
      ctx.arc(b.x, b.y, 13, 0, Math.PI * 2);
      ctx.fill();
      // Bright core
      ctx.fillStyle = `rgba(255,255,255,${a * 0.9})`;
      ctx.beginPath();
      ctx.arc(b.x, b.y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Smite shockwave rings
    for (const ring of this._smiteRings) {
      ctx.save();
      ctx.strokeStyle = p2
        ? `rgba(190,128,255,${ring.alpha * 0.65})`
        : `rgba(255,232,80,${ring.alpha * 0.65})`;
      ctx.lineWidth   = 4 * ring.alpha;
      ctx.shadowColor = p2 ? 'rgba(160,95,255,0.85)' : 'rgba(255,222,55,0.85)';
      ctx.shadowBlur  = 18;
      ctx.beginPath();
      ctx.arc(godCx, godCy, ring.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = `rgba(255,255,255,${ring.alpha * 0.3})`;
      ctx.lineWidth   = 1.5;
      ctx.beginPath();
      ctx.arc(godCx, godCy, ring.r * 0.86, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }
}

// ── HolyAngel — summoned by God's Angel Fleet ─────────────────────────────
class HolyAngel extends Fighter {
  constructor(x, y) {
    super(x, y, '#ffffff', 'sword',
      { left: null, right: null, jump: null, attack: null, ability: null, super: null },
      true, 'hard');
    this.name        = 'ANGEL';
    this.isMinion    = true;
    this.isHolyAngel = true;
    this.w           = 24;
    this.h           = 48;
    this.health      = 1200;
    this.maxHealth   = 1200;
    this.lives       = 1;
    this.dmgMult     = 1.2;
    this.kbBonus     = 0.8;
    this.kbResist    = 0.3;
    this.playerNum   = 97;
    this._attackCd   = 45;
    this._ttl        = 360 + Math.floor(Math.random() * 120);
    this._wingAngle  = Math.random() * Math.PI * 2;
    this._flyVy      = 0;
    this._hoverTime  = Math.random() * Math.PI * 2;
  }

  respawn()       { this.health = 0; }
  useSuper()      {}
  activateSuper() {}

  update() {
    if (this.health <= 0) return;
    if (typeof activeCinematic !== 'undefined' && activeCinematic) return;
    this._wingAngle += 0.13;
    this._hoverTime += 0.04;
    this._ttl--;
    if (this._ttl <= 0) { this.health = 0; return; }
    if (this._attackCd > 0) this._attackCd--;

    let target = null, minDist = Infinity;
    if (Array.isArray(players)) {
      for (const p of players) {
        if (p === this || p.isMinion || p.health <= 0) continue;
        if (p._teamId !== undefined && this._teamId !== undefined && p._teamId === this._teamId) continue;
        const d = Math.hypot(p.cx() - this.cx(), (p.y + p.h / 2) - (this.y + this.h / 2));
        if (d < minDist) { minDist = d; target = p; }
      }
    }
    if (!target) return;

    this.facing = Math.sign(target.cx() - this.cx()) || 1;
    const dx = target.cx() - this.cx();
    const dy = (target.y + target.h / 2) - (this.y + this.h / 2);

    const desiredX = target.cx() + Math.sin(this._hoverTime * 0.5) * 40;
    const desiredY = (target.y + target.h / 2) - 70 + Math.sin(this._hoverTime * 0.9) * 10;
    const errX = desiredX - this.cx();
    const errY = desiredY - (this.y + this.h / 2);
    const eDist = Math.hypot(errX, errY) || 1;
    const spd   = Math.min(6.5, eDist);
    this.vx      = (errX / eDist) * spd;
    this._flyVy += (errY / eDist) * spd * 0.3;
    this._flyVy  = Math.max(-10, Math.min(10, this._flyVy));
    this.vy      = this._flyVy - 0.65;

    super.update();

    const GH = typeof GAME_H !== 'undefined' ? GAME_H : 520;
    const GW = typeof GAME_W !== 'undefined' ? GAME_W : 900;
    this.y = Math.max(5, Math.min(GH * 0.85 - this.h, this.y));
    this.x = Math.max(10, Math.min(GW - this.w - 10, this.x));

    if (minDist < 90 && this._attackCd <= 0 && typeof dealDamage === 'function') {
      dealDamage(this, target, 70, 9);
      this._attackCd = 55;
      if (typeof spawnParticles === 'function') spawnParticles(this.cx(), this.y + this.h / 2, '#ffffc0', 6);
    }
  }

  draw() {
    if (this.health <= 0) return;
    if (typeof ctx === 'undefined') return;

    const cx     = this.cx();
    const headY  = this.y + 8;
    const cy     = this.y + this.h / 2;
    const t      = this._wingAngle;
    const fade   = Math.min(1, this._ttl / 40);

    ctx.save();
    ctx.globalAlpha = fade;

    // Mini aura
    const aG = ctx.createRadialGradient(cx, cy, 0, cx, cy, 26);
    aG.addColorStop(0, 'rgba(255,255,220,0.2)');
    aG.addColorStop(1, 'rgba(255,240,100,0)');
    ctx.fillStyle = aG;
    ctx.beginPath();
    ctx.arc(cx, cy, 26, 0, Math.PI * 2);
    ctx.fill();

    // 2 wing pairs
    for (let pair = 0; pair < 2; pair++) {
      const yOff  = (pair - 0.5) * 13;
      const wave  = Math.sin(t * (1.1 + pair * 0.4) + pair * 1.1) * 9;
      const sp    = 24 + pair * 8;
      ctx.fillStyle   = pair === 0 ? 'rgba(255,255,255,0.68)' : 'rgba(230,240,255,0.42)';
      ctx.strokeStyle = 'rgba(220,235,255,0.45)';
      ctx.lineWidth   = 0.5;
      ctx.shadowColor = 'rgba(200,225,255,0.5)';
      ctx.shadowBlur  = 5;
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(cx + side * sp * 0.5, cy + yOff - wave, sp * 0.52, 7 + pair, side * 0.25, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    }

    // Stickman
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth   = 2.8;
    ctx.shadowColor = 'rgba(220,240,255,0.95)';
    ctx.shadowBlur  = 14;
    ctx.lineCap     = 'round';

    ctx.beginPath(); ctx.arc(cx, headY, 6, 0, Math.PI * 2); ctx.stroke();
    const tY = headY + 7;
    ctx.beginPath(); ctx.moveTo(cx, tY); ctx.lineTo(cx, tY + 15); ctx.stroke();
    const aY = tY + 6;
    ctx.beginPath(); ctx.moveTo(cx - 10, aY + 4); ctx.lineTo(cx, aY); ctx.lineTo(cx + 10, aY + 4); ctx.stroke();
    const lY = tY + 15;
    ctx.beginPath();
    ctx.moveTo(cx, lY); ctx.lineTo(cx - 8, lY + 12);
    ctx.moveTo(cx, lY); ctx.lineTo(cx + 8, lY + 12);
    ctx.stroke();

    // Mini halo
    ctx.strokeStyle = 'rgba(255,255,160,0.88)';
    ctx.lineWidth   = 1.4;
    ctx.shadowColor = 'rgba(255,255,80,1)';
    ctx.shadowBlur  = 9;
    ctx.beginPath();
    ctx.ellipse(cx, headY - 8.5, 8, 2.2, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();

    // HP bar
    const pct = Math.max(0, this.health / this.maxHealth);
    const bw = 34, bh = 3;
    ctx.globalAlpha = fade * 0.82;
    ctx.fillStyle   = 'rgba(0,0,0,0.5)';
    ctx.fillRect(cx - bw / 2, this.y - 9, bw, bh);
    ctx.fillStyle   = '#ffe080';
    ctx.fillRect(cx - bw / 2, this.y - 9, bw * pct, bh);
    ctx.globalAlpha = 1;
  }
}

// ── GodParadoxAlly (Phase 2 helper — targets God only) ────────────────────
class GodParadoxAlly extends Fighter {
  constructor(x, y) {
    super(x, y, '#8844ee', 'sword',
      { left: null, right: null, jump: null, attack: null, ability: null, super: null },
      true, 'hard');
    this.name      = 'PARADOX';
    this.isMinion  = true;
    this.isAlly    = true;
    this.w         = 32;
    this.h         = 62;
    this.health    = 10000;
    this.maxHealth = 10000;
    this.lives     = 1;
    this.dmgMult   = 0.9;
    this.kbBonus   = 1.3;
    this.spawnX    = x;
    this.spawnY    = y;
    this.playerNum = 98;
    this._attackCd  = 30;
    this._wingAngle = 0;
    this._godTarget = null;
  }

  respawn()       { this.health = 0; }
  useSuper()      {}
  activateSuper() {}

  update() {
    if (this.health <= 0) return;
    if (typeof activeCinematic !== 'undefined' && activeCinematic) return;
    super.update();
    this._wingAngle += 0.1;
    if (this._attackCd > 0) this._attackCd--;

    if (!this._godTarget || this._godTarget.health <= 0) {
      this._godTarget = Array.isArray(minions)
        ? minions.find(m => m.isGod && m.health > 0) || null
        : null;
    }
    if (!this._godTarget) return;

    this.target  = this._godTarget;
    const dx     = this._godTarget.cx() - this.cx();
    const distX  = Math.abs(dx);
    const dir    = Math.sign(dx) || 1;
    this.facing  = dir;

    if (distX > 80) {
      this.vx = dir * 6;
      if (this.onGround && distX > 180) this.vy = -15;
    } else {
      this.vx *= 0.75;
      if (this._attackCd <= 0 && typeof dealDamage === 'function') {
        const baseDmg = this.weapon ? (this.weapon.damage || 20) : 20;
        dealDamage(this, this._godTarget, baseDmg * this.dmgMult, 6 * this.kbBonus);
        this._attackCd = 45;
      }
    }
  }

  draw() {
    if (this.health <= 0) return;
    if (typeof ctx === 'undefined') return;

    const cx    = this.cx();
    const headY = this.y + 10;
    const cy    = this.y + this.h / 2;

    ctx.save();

    const pulse = 0.28 + Math.sin(this._wingAngle) * 0.08;
    ctx.globalAlpha = pulse;
    ctx.beginPath();
    ctx.arc(cx, cy, 30, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(140,70,255,0.22)';
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.strokeStyle = '#aa66ff';
    ctx.lineWidth   = 3;
    ctx.shadowColor = 'rgba(160,90,255,0.9)';
    ctx.shadowBlur  = 10;

    ctx.beginPath(); ctx.arc(cx, headY, 8, 0, Math.PI * 2); ctx.stroke();
    const torsoY = headY + 8;
    ctx.beginPath(); ctx.moveTo(cx, torsoY); ctx.lineTo(cx, torsoY + 22); ctx.stroke();
    const armY = torsoY + 8;
    ctx.beginPath(); ctx.moveTo(cx - 14, armY + 6); ctx.lineTo(cx, armY); ctx.lineTo(cx + 14, armY + 6); ctx.stroke();
    const legY = torsoY + 22;
    ctx.beginPath();
    ctx.moveTo(cx, legY); ctx.lineTo(cx - 10, legY + 18);
    ctx.moveTo(cx, legY); ctx.lineTo(cx + 10, legY + 18);
    ctx.stroke();

    ctx.restore();

    const barW = 52, barH = 4, bx = cx - barW / 2, by = this.y - 14;
    const pct  = Math.max(0, this.health / this.maxHealth);
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(bx, by, barW, barH);
    ctx.fillStyle = '#aa66ff';
    ctx.fillRect(bx, by, barW * pct, barH);

    ctx.fillStyle = 'rgba(200,170,255,0.85)';
    ctx.font      = 'bold 9px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('PARADOX', cx, by - 2);
    ctx.textAlign = 'left';
  }
}
