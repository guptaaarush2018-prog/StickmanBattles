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
let _godEncounterCooldown = 0; // per-session cooldown in game-seconds (decrements in tick)
let _godWasAlive          = false; // tracks whether God was alive this session fight

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

// Called once per second (frameCount % 60 === 0) from gameLoop
function updateGodEncounterTick() {
  if (typeof gameRunning === 'undefined' || !gameRunning) return;
  if (typeof gameMode !== 'undefined' && gameMode === 'god') return;
  if (_godEncounterCooldown > 0) { _godEncounterCooldown--; return; }
  if (typeof activeCinematic !== 'undefined' && activeCinematic) return;
  if (typeof storyModeActive !== 'undefined' && storyModeActive) return;
  if (Math.random() < _getGodEncounterChance()) {
    _godEncounterCooldown = 600; // 10-minute in-game cooldown
    startGodEncounter();
  }
}

function startGodEncounter() {
  // Mark as encountered (Phase 2 unlocks on next encounter)
  if (typeof godEncountered !== 'undefined' && !godEncountered) {
    if (typeof setAccountFlagWithRuntime === 'function') {
      setAccountFlagWithRuntime(['unlocks', 'godEncountered'], true, v => { godEncountered = v; });
    } else {
      godEncountered = true;
    }
  }
  if (typeof gameMode !== 'undefined') gameMode = 'god';
  if (typeof startGame === 'function') startGame();
}

// Called from smb-loop-core.js after minions are filtered (death hook)
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
  if (typeof unlockAchievement === 'function') {
    unlockAchievement('god_slayer');
  }
}

// ── Fake crash screen (Phase 1 — God hits player for first time) ───────────
function _showGodFakeCrash() {
  if (typeof gameRunning !== 'undefined') gameRunning = false;
  if (document.getElementById('_godCrashOverlay')) return;

  const _esc = s => String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

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
          font-family:inherit;font-size:0.88rem;font-weight:700;
          transition:background 0.15s;">
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
    this._attackCd    = 90;
    this._prevP1Health = -1;
    this._crashFired   = false;
    this._consoleSummoned = false;
    this._wingAngle    = 0;

    this._phase = _isGodPhase2() ? 2 : 1;
    if (this._phase === 1) {
      this.health    = 1e15;
      this.maxHealth = 1e15;
      this.dmgMult   = 9999;
      this.kbBonus   = 3.0;
      this.kbResist  = 0.9;
    } else {
      this.health    = 100000;
      this.maxHealth = 100000;
      this.dmgMult   = 3.0;
      this.kbBonus   = 2.5;
      this.kbResist  = 0.7;
    }
  }

  respawn()       { this.health = 0; }
  useSuper()      {}
  activateSuper() {}

  update() {
    if (this.health <= 0) return;
    if (typeof activeCinematic !== 'undefined' && activeCinematic) return;

    super.update();

    this._wingAngle += 0.08;

    // Phase 1 crash: detect first damage dealt to the human player
    if (this._phase === 1 && !this._crashFired && !this._consoleSummoned) {
      const humanP = Array.isArray(players)
        ? players.find(p => p !== this && !p.isMinion && !p.isRemote && !p.isAI && !p.isBoss)
        : null;
      if (humanP) {
        if (this._prevP1Health < 0) {
          this._prevP1Health = humanP.health;
        } else if (humanP.health < this._prevP1Health) {
          this._crashFired = true;
          _showGodFakeCrash();
          return;
        }
        this._prevP1Health = humanP.health;
      }
    }

    if (this._attackCd > 0) { this._attackCd--; return; }

    // Target: nearest fighter who is not an ally
    let target = null;
    let minDist = Infinity;
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
    const dx   = target.cx() - this.cx();
    const distX = Math.abs(dx);
    const dir  = Math.sign(dx) || 1;
    this.facing = dir;

    const speed = this._phase === 1 ? 7 : 5;
    if (distX > 100) {
      this.vx = dir * speed;
      if (this.onGround && distX > 220) this.vy = -16;
    } else {
      this.vx *= 0.7;
      if (typeof dealDamage === 'function') {
        const baseDmg = (this.weapon ? (this.weapon.damage || 20) : 20);
        dealDamage(this, target, baseDmg * this.dmgMult, 8 * this.kbBonus);
      }
      this._attackCd = this._phase === 1 ? 40 : 60;
    }
  }

  draw() {
    if (this.health <= 0) return;
    if (typeof ctx === 'undefined') return;

    const cx    = this.cx();
    const headY = this.y + 10;
    const cy    = this.y + this.h / 2;

    ctx.save();

    // 6 wings (3 pairs: upper / mid / lower), animated flap
    const wingPalette = [
      'rgba(255,255,255,0.65)',
      'rgba(210,225,255,0.45)',
      'rgba(180,200,255,0.28)',
    ];
    for (let pair = 0; pair < 3; pair++) {
      const yOff   = (pair - 1) * 18;
      const spread = 38 + pair * 12;
      const wave   = Math.sin(this._wingAngle + pair * 0.9) * 9;
      ctx.fillStyle   = wingPalette[pair];
      ctx.strokeStyle = 'rgba(220,230,255,0.5)';
      ctx.lineWidth   = 0.8;
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(
          cx + side * spread * 0.55,
          cy + yOff - wave,
          spread * 0.55,
          11 + pair * 2,
          side * (0.35 + pair * 0.12),
          0, Math.PI * 2
        );
        ctx.fill();
        ctx.stroke();
      }
    }

    // White stickman body with divine glow
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth   = 3;
    ctx.shadowColor = 'rgba(200,220,255,0.95)';
    ctx.shadowBlur  = 14;

    // Head
    ctx.beginPath();
    ctx.arc(cx, headY, 8, 0, Math.PI * 2);
    ctx.stroke();

    // Torso
    const torsoY = headY + 8;
    ctx.beginPath();
    ctx.moveTo(cx, torsoY);
    ctx.lineTo(cx, torsoY + 22);
    ctx.stroke();

    // Arms
    const armY = torsoY + 8;
    ctx.beginPath();
    ctx.moveTo(cx - 14, armY + 6);
    ctx.lineTo(cx, armY);
    ctx.lineTo(cx + 14, armY + 6);
    ctx.stroke();

    // Legs
    const legY = torsoY + 22;
    ctx.beginPath();
    ctx.moveTo(cx, legY);
    ctx.lineTo(cx - 10, legY + 18);
    ctx.moveTo(cx, legY);
    ctx.lineTo(cx + 10, legY + 18);
    ctx.stroke();

    // Halo
    ctx.strokeStyle = 'rgba(255,255,180,0.92)';
    ctx.lineWidth   = 2.5;
    ctx.shadowColor = 'rgba(255,255,100,1.0)';
    ctx.shadowBlur  = 16;
    ctx.beginPath();
    ctx.ellipse(cx, headY - 13, 13, 3.5, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();

    // Phase 2: health bar above entity
    if (this._phase === 2 || this._consoleSummoned) {
      const barW = 64, barH = 5;
      const bx   = cx - barW / 2;
      const by   = this.y - 16;
      const pct  = Math.max(0, this.health / this.maxHealth);
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(bx, by, barW, barH);
      ctx.fillStyle = `hsl(${Math.round(pct * 120)}, 90%, 55%)`;
      ctx.fillRect(bx, by, barW * pct, barH);

      // Name label
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.font      = 'bold 9px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('GOD', cx, by - 2);
      ctx.textAlign = 'left';
    }
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

    // Lock onto God
    if (!this._godTarget || this._godTarget.health <= 0) {
      this._godTarget = Array.isArray(minions)
        ? minions.find(m => m.isGod && m.health > 0) || null
        : null;
    }
    if (!this._godTarget) return;

    this.target = this._godTarget;
    const dx    = this._godTarget.cx() - this.cx();
    const distX = Math.abs(dx);
    const dir   = Math.sign(dx) || 1;
    this.facing = dir;

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

    // Paradox energy aura
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

    // Head
    ctx.beginPath();
    ctx.arc(cx, headY, 8, 0, Math.PI * 2);
    ctx.stroke();

    // Torso
    const torsoY = headY + 8;
    ctx.beginPath();
    ctx.moveTo(cx, torsoY);
    ctx.lineTo(cx, torsoY + 22);
    ctx.stroke();

    // Arms
    const armY = torsoY + 8;
    ctx.beginPath();
    ctx.moveTo(cx - 14, armY + 6);
    ctx.lineTo(cx, armY);
    ctx.lineTo(cx + 14, armY + 6);
    ctx.stroke();

    // Legs
    const legY = torsoY + 22;
    ctx.beginPath();
    ctx.moveTo(cx, legY);
    ctx.lineTo(cx - 10, legY + 18);
    ctx.moveTo(cx, legY);
    ctx.lineTo(cx + 10, legY + 18);
    ctx.stroke();

    ctx.restore();

    // Health bar
    const barW = 52, barH = 4;
    const bx   = cx - barW / 2;
    const by   = this.y - 14;
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
