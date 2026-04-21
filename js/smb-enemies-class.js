'use strict';
// smb-enemies-class.js — applyClass, updateClassWeapon, showDesc (player stat description), mirror arena AI patch
// Depends on: smb-globals.js, smb-fighter.js, smb-data-weapons.js

function applyClass(fighter, classKey) {
  const cls = CLASSES[classKey || 'none'];
  if (!cls || classKey === 'none') return;
  fighter.charClass       = classKey;
  fighter.maxHealth       = cls.hp;
  fighter.health          = cls.hp;
  fighter.classSpeedMult  = cls.speedMult;
  // Weapon is NOT forced by class — player's selected weapon is always preserved
}

function updateClassWeapon(player) {
  const clsKey = document.getElementById(player + 'Class').value;
  const cls    = CLASSES[clsKey];
  const wEl    = document.getElementById(player + 'Weapon');
  // Default to the class's preferred weapon but do NOT lock the dropdown
  // Players can freely change weapon after selecting a class
  if (cls && cls.weapon) {
    wEl.value = cls.weapon;
  }
  wEl.disabled = false; // always keep weapon selectable
  showDesc(player, 'class', clsKey);
}

function showDesc(player, type, key) {
  const data  = type === 'weapon' ? WEAPON_DESCS[key] : CLASS_DESCS[key];
  const panel = document.getElementById(player + 'Desc');
  const title = document.getElementById(player + 'DescTitle');
  const body  = document.getElementById(player + 'DescBody');
  if (!panel || !title || !body) return;
  if (!data || key === 'none' || key === 'random') {
    panel.style.display = 'none';
    return;
  }
  title.textContent = data.title;
  let html = `<span class="desc-what">${data.what}</span>`;
  if (data.ability) html += `<br><span class="desc-ability">${data.ability}</span>`;
  if (data.super)   html += `<br><span class="desc-super">${data.super}</span>`;
  if (data.perk)    html += `<br><span class="desc-perk">${data.perk}</span>`;
  html += `<br><span class="desc-tip">${data.how}</span>`;
  // Randomizer toggle
  const inPool = type === 'weapon'
    ? (!randomWeaponPool || randomWeaponPool.has(key))
    : (!randomClassPool  || randomClassPool.has(key));
  html += `<br><button id="randBtn_${type}_${key}" class="rand-toggle-btn"
    onclick="toggleRandomPool('${type}','${key}')"
    style="margin-top:6px;padding:3px 10px;border-radius:6px;border:1px solid rgba(255,255,255,0.2);cursor:pointer;font-size:11px;background:${inPool ? 'rgba(0,200,100,0.25)' : 'rgba(200,50,50,0.25)'}">
    ${inPool ? '\u2713 In Random Pool' : '\u2717 Excluded'}</button>`;
  body.innerHTML = html;
  panel.style.display = 'block';
}

// ============================================================
// MIRROR ARENA — AI mimic behavior patch
// Wraps Fighter.prototype.updateAI so mirror logic fires only
// in the 'mirror' arena without touching any other AI path.
// ============================================================
(function _patchMirrorAI() {
  const _origUpdateAI = Fighter.prototype.updateAI;

  Fighter.prototype.updateAI = function() {
    // Mirror logic: only for non-boss AI fighters in the mirror arena
    if (currentArenaKey === 'mirror' && this.isAI && !this.isBoss && !this.isMinion) {
      // Find the human (or first non-AI) target
      const human = players.find(p => p !== this && !p.isAI && p.health > 0);
      if (human) {
        // ── Weapon mimic ─────────────────────────────────────────
        // Copy the human's current weapon with a small random delay
        // so it never feels instant / perfect.
        if (!this._mirrorWeaponTimer || this._mirrorWeaponTimer <= 0) {
          if (human.weapon && this.weapon !== human.weapon) {
            this.weapon = human.weapon;
          }
          // Reset timer: 20–40 frames before next check
          this._mirrorWeaponTimer = 20 + Math.floor(Math.random() * 21);
        } else {
          this._mirrorWeaponTimer--;
        }

        // ── Attack-frequency mimic ────────────────────────────────
        // Track when the human last attacked; mirror with a delay.
        if (human.isAttacking && !human._mirrorAttackSeen) {
          human._mirrorAttackSeen = true;
          // Queue a delayed mirror attack (20–40 frames from now)
          this._mirrorDelay = 20 + Math.floor(Math.random() * 21);
        }
        if (!human.isAttacking) human._mirrorAttackSeen = false;

        if (this._mirrorDelay > 0) {
          this._mirrorDelay--;
          if (this._mirrorDelay === 0 && this.cooldown <= 0 && this.health > 0) {
            this.isAttacking   = true;
            this.attackTimer   = this.weapon ? (this.weapon.atkDur || 18) : 18;
            this.cooldown      = this.weapon ? (this.weapon.cooldown || 28) : 28;
            this.attackDir     = this.facing;
          }
        }
      }
    }

    // Always run the standard AI logic
    _origUpdateAI.call(this);
  };
})();
