'use strict';
// smb-menu-select.js — Card grid, arena/lives/settings selection, changelog, custom weapons init
// Depends on: smb-globals.js, smb-data-arenas.js, smb-data-weapons.js, smb-menu-ui.js
// Must load AFTER smb-menu-ui.js, BEFORE smb-menu-config.js

function _syncSelCards(gridId, val) {
  const grid = document.getElementById(gridId);
  if (!grid) return;
  grid.querySelectorAll('.sel-card').forEach(c =>
    c.classList.toggle('active', c.dataset.val === val));
}

function _buildSelCardGrid(gridId, selectId, cardData, pid, type) {
  const grid = document.getElementById(gridId);
  const sel  = document.getElementById(selectId);
  if (!grid || !sel) return;
  grid.innerHTML = '';
  [...sel.options].forEach(opt => {
    const val  = opt.value;
    const info = cardData[val] || { icon: '❓', tag: '' };
    // Strip class-lock annotations from display name
    const name = opt.text.replace(/\s*⚔\s*.*/,'');
    const card = document.createElement('div');
    card.className = 'sel-card' + (val === sel.value ? ' active' : '');
    card.dataset.val = val;
    card.innerHTML =
      `<span class="sel-card-icon">${info.icon}</span>` +
      `<span class="sel-card-name">${name}</span>` +
      `<span class="sel-card-tag">${info.tag}</span>`;
    card.addEventListener('click', () => {
      sel.value = val;
      _syncSelCards(gridId, val);
      if (type === 'weapon') {
        showDesc(pid, 'weapon', val);
        onWeaponChange(pid);
      } else {
        updateClassWeapon(pid);
        showDesc(pid, 'class', val);
      }
    });
    grid.appendChild(card);
  });
}

function _initSelCardGrids() {
  refreshCustomWeaponOptions(); // inject any saved custom weapons first
  _buildSelCardGrid('p1WeaponCards', 'p1Weapon', _WEAPON_CARD_DATA, 'p1', 'weapon');
  _buildSelCardGrid('p1ClassCards',  'p1Class',  _CLASS_CARD_DATA,  'p1', 'class');
  _buildSelCardGrid('p2WeaponCards', 'p2Weapon', _WEAPON_CARD_DATA, 'p2', 'weapon');
  _buildSelCardGrid('p2ClassCards',  'p2Class',  _CLASS_CARD_DATA,  'p2', 'class');
}

// ============================================================
// WEAPON / CLASS DESCRIPTION PANEL
// ============================================================
function showDesc(pid, type, value) {
  const panel = document.getElementById(pid + 'Desc');
  const titleEl = document.getElementById(pid + 'DescTitle');
  const bodyEl  = document.getElementById(pid + 'DescBody');
  if (!panel || !titleEl || !bodyEl) return;
  const desc = type === 'weapon' ? WEAPON_DESCS[value] : CLASS_DESCS[value];
  if (!desc) { panel.style.display = 'none'; return; }
  panel.style.display = 'block';
  titleEl.textContent = desc.title;
  bodyEl.innerHTML = [
    `<span style="color:#ccc">${desc.what}</span>`,
    desc.ability ? `<br><span style="color:#88ccff">${desc.ability}</span>` : '',
    desc.super   ? `<br><span style="color:#ffaa44">${desc.super}</span>`   : '',
    desc.perk    ? `<br><span style="color:#aaffaa">★ ${desc.perk}</span>`  : '',
    `<br><span style="color:#aaa; font-style:italic">Tip: ${desc.how}</span>`,
  ].join('');
}

// Bidirectional class/weapon locking removed.
// Rules: weapon selection never forces a class; class selection suggests a weapon only on first pick.
const WEAPON_CLASS_LOCK = {}; // kept as empty stub — logic below no longer uses it

// Called when the CLASS selector changes.
function updateClassWeapon(pid) {
  const classEl  = document.getElementById(pid + 'Class');
  const weaponEl = document.getElementById(pid + 'Weapon');
  if (!classEl || !weaponEl) return;

  // Always unlock both selectors
  classEl.disabled  = false;
  classEl.title     = '';
  weaponEl.disabled = false;

  // Class suggests a default weapon ONLY if user has not manually picked one yet
  const cls = CLASSES[classEl.value];
  if (cls && cls.weapon && !weaponEl.dataset.userPicked) {
    weaponEl.value = cls.weapon;
    _syncSelCards(pid + 'WeaponCards', cls.weapon);
  }

  showDesc(pid, 'class', classEl.value);
}

// Called when the WEAPON selector changes — marks user intent so class can no longer override it.
function onWeaponChange(pid) {
  const weaponEl = document.getElementById(pid + 'Weapon');
  if (weaponEl) weaponEl.dataset.userPicked = 'true';
  updateClassWeapon(pid);
}

function classSel_wasLocked(el, val) { /* no-op — bidirectional locking removed */ }

const _ARENA_GIMMICKS = {
  grass:      '',
  city:       '🚗 Cars race across the rooftop floor',
  space:      '🌌 Low gravity — big air time',
  lava:       '🔥 Heavy gravity · lava floor burns',
  forest:     '🐾 A forest beast roams · passive healing',
  ice:        '❄️ Icy friction · a yeti stalks the tundra',
  ruins:      '📦 Artifact pickups scattered around',
  cave:       '🦇 Stalactites fall from the ceiling',
  volcano:    '🌋 Lava geysers erupt from the floor · heavy gravity',
  underwater: '🌊 Slow movement · water currents shift',
  colosseum:  '⚔️ Stone pillars · crowd cheers on big hits',
  clouds:     '☁️ Low gravity · cloud platforms slowly shrink',
  mushroom:   '🍄 Bouncy platforms launch you skyward',
  haunted:    '👻 Ghosts drift across and deal damage',
  cyberpunk:  '⚡ Electric floor hazard periodically zaps',
  neonGrid:   '💾 Speed boost pads on the floor',
  mirror:     '🪞 Platforms drift and reality warps',
  random:     '🎲 A random arena is chosen each match',
};

function selectArena(name) {
  selectedArena = name;
  const sel = document.getElementById('arenaSelect');
  if (sel) sel.value = name;
  const hint = document.getElementById('arenaGimmickHint');
  if (hint) hint.textContent = _ARENA_GIMMICKS[name] || '';
}

// Called between random-mode fights: fades to black, switches arena + rerolls weapons/classes, fades back
function switchArenaWithTransition(newArenaKey, callback) {
  const fade = document.getElementById('fadeOverlay');
  if (fade) { fade.style.transition = 'opacity 0.28s'; fade.style.opacity = '1'; }
  setTimeout(() => {
    if (!gameRunning) { // guard: game may have ended between outer and inner timeouts
      if (fade) { fade.style.transition = 'opacity 0.38s'; fade.style.opacity = '0'; }
      return;
    }
    if (typeof switchArena === 'function') switchArena(newArenaKey);
    // Reroll weapons + classes for each non-boss player:
    //   - always when completeRandomizer is active
    //   - otherwise only when the dropdown is set to 'random'
    players.forEach(p => {
      if (p.isBoss) return;
      const isP1 = p === players[0];
      const wSel = isP1 ? 'p1Weapon' : 'p2Weapon';
      const cSel = isP1 ? 'p1Class'  : 'p2Class';
      const wVal = document.getElementById(wSel)?.value;
      const cVal = document.getElementById(cSel)?.value;
      if (!completeRandomizer && wVal !== 'random' && cVal !== 'random') return;
      const resolved = completeRandomizer
        ? resolveWeaponAndClassValues('random', 'random')
        : resolveWeaponAndClass(wSel, cSel);
      if (resolved.weaponKey && typeof WEAPONS !== 'undefined' && WEAPONS[resolved.weaponKey]) {
        p.weaponKey = resolved.weaponKey;
        p.weapon    = WEAPONS[resolved.weaponKey];
        p._ammo     = p.weapon.clipSize || 0;
        p._reloadTimer = 0;
      }
      if (typeof applyClass === 'function') applyClass(p, resolved.classKey);
    });
    if (typeof callback === 'function') callback();
    setTimeout(() => {
      if (fade) { fade.style.transition = 'opacity 0.38s'; fade.style.opacity = '0'; }
    }, 80);
  }, 300);
}

function switchArena(newKey) {
  if (!gameRunning) return;
  const OFFMAP = ['creator', 'void', 'soccer'];
  if (OFFMAP.includes(newKey) || ARENAS[newKey]?.isStoryOnly || ARENAS[newKey]?.isExploreArena) return;
  currentArenaKey = newKey;
  if (currentArenaKey !== 'lava') randomizeArenaLayout(currentArenaKey);
  currentArena = ARENAS[currentArenaKey];
  initMapPerks(currentArenaKey);
  generateBgElements();
  // Clear arena-specific NPCs and items — they belong to their home arena
  if (typeof forestBeast !== 'undefined') { forestBeast = null; forestBeastCooldown = 600; }
  if (typeof yeti        !== 'undefined') { yeti        = null; yetiCooldown        = 600; }
  if (typeof mapItems    !== 'undefined') mapItems = [];
  // Assign safe spawn positions for ALL players on the new map.
  // Alive players are repositioned immediately.
  // Dead players only get spawnX/spawnY updated so their pending respawn()
  // call lands on the correct map instead of stale coordinates from the old arena.
  const _sides = ['left', 'right', 'any'];
  let lastX;
  players.forEach((p, i) => {
    if (p.isBoss) return;
    const sp = pickSafeSpawn(_sides[i] || 'any', lastX) || { x: [160, 720, 450][i] || 300, y: 200 };
    // Always update the cached spawn coordinates for the new arena
    p.spawnX = sp.x;
    p.spawnY = sp.y;
    if (p.health > 0) {
      // Only physically move alive players
      p.x = sp.x; p.y = sp.y - p.h;
      p.vx = 0; p.vy = 0;
      p.invincible = Math.max(p.invincible, 90);
    }
    lastX = sp.x;
  });
  trainingDummies.forEach(d => { d.x = 640; d.y = 200; d.vx = 0; d.vy = 0; });
}

function selectLives(n) {
  if (bossFightLivesLock) {
    chosenLives = BOSS_FIGHT_LIVES;
    const sel = document.getElementById('livesSelect');
    if (sel) sel.value = String(BOSS_FIGHT_LIVES);
    return;
  }
  infiniteMode = (n === 0);
  chosenLives  = infiniteMode ? 3 : n;
  const sel = document.getElementById('livesSelect');
  if (sel) sel.value = String(n);
}

function _setBossFightLivesLock(active) {
  const enable = !!active;
  if (enable) {
    if (!bossFightLivesLock) bossFightLivesPrev = chosenLives;
    bossFightLivesLock = true;
    infiniteMode = false;
    chosenLives = BOSS_FIGHT_LIVES;
    const sel = document.getElementById('livesSelect');
    if (sel) sel.value = String(BOSS_FIGHT_LIVES);
    return;
  }
  if (!bossFightLivesLock) return;
  bossFightLivesLock = false;
  infiniteMode = false;
  chosenLives = bossFightLivesPrev != null ? bossFightLivesPrev : 3;
  bossFightLivesPrev = null;
  const sel = document.getElementById('livesSelect');
  if (sel) sel.value = String(chosenLives);
}

function _applyBossFightLivesLockToPlayers() {
  if (!bossFightLivesLock || !Array.isArray(players)) return;
  for (const p of players) {
    if (!p || p.isBoss || p.isDummy) continue;
    p.lives = BOSS_FIGHT_LIVES;
    p._maxLives = BOSS_FIGHT_LIVES;
  }
}

function toggleSettings() {
  const panel = document.getElementById('settingsPanel');
  panel.style.display = panel.style.display === 'block' ? 'none' : 'block';
}

function toggleCard(id) {
  const card  = document.getElementById(id);
  const arrow = card.querySelector('.expand-arrow');
  card.classList.toggle('expanded');
  if (arrow) arrow.textContent = card.classList.contains('expanded') ? '▾' : '▸';
}

function updateSettings() {
  settings.particles   = document.getElementById('settingParticles').checked;
  settings.screenShake = document.getElementById('settingShake').checked;
  settings.dmgNumbers  = document.getElementById('settingDmgNums').checked;
  settings.landingDust = document.getElementById('settingLandDust').checked;
  const bossAuraEl   = document.getElementById('settingBossAura');
  const botPortalEl  = document.getElementById('settingBotPortal');
  const phaseFlashEl = document.getElementById('settingPhaseFlash');
  if (bossAuraEl)   settings.bossAura   = bossAuraEl.checked;
  if (botPortalEl)  settings.botPortal  = botPortalEl.checked;
  if (phaseFlashEl) settings.phaseFlash = phaseFlashEl.checked;
  const finishersEl = document.getElementById('settingFinishers');
  if (finishersEl) settings.finishers = finishersEl.checked;
}

function toggleAdvanced() {
  const panel = document.getElementById('advancedPanel');
  if (panel) panel.style.display = panel.style.display === 'block' ? 'none' : 'block';
}

let _performanceModeActive = false;
let _perfModePrevSettings = null;

function togglePerformanceMode() {
  const btn = document.getElementById('perfModeBtn');
  _performanceModeActive = !_performanceModeActive;

  if (_performanceModeActive) {
    // Save current checkbox states
    _perfModePrevSettings = {
      particles:   document.getElementById('settingParticles').checked,
      shake:       document.getElementById('settingShake').checked,
      dmgNums:     document.getElementById('settingDmgNums').checked,
      landDust:    document.getElementById('settingLandDust').checked,
      finishers:   document.getElementById('settingFinishers') ? document.getElementById('settingFinishers').checked : true,
      bossAura:    document.getElementById('settingBossAura')  ? document.getElementById('settingBossAura').checked  : true,
      botPortal:   document.getElementById('settingBotPortal') ? document.getElementById('settingBotPortal').checked : true,
      phaseFlash:  document.getElementById('settingPhaseFlash')? document.getElementById('settingPhaseFlash').checked: true,
    };
    // Disable all visual effects
    document.getElementById('settingParticles').checked = false;
    document.getElementById('settingShake').checked     = false;
    document.getElementById('settingDmgNums').checked   = false;
    document.getElementById('settingLandDust').checked  = false;
    if (document.getElementById('settingFinishers'))  document.getElementById('settingFinishers').checked  = false;
    if (document.getElementById('settingBossAura'))   document.getElementById('settingBossAura').checked   = false;
    if (document.getElementById('settingBotPortal'))  document.getElementById('settingBotPortal').checked  = false;
    if (document.getElementById('settingPhaseFlash')) document.getElementById('settingPhaseFlash').checked = false;
    if (btn) { btn.textContent = '⚡ Performance Mode: On'; btn.style.color = '#ffff66'; btn.style.borderColor = 'rgba(255,255,80,0.5)'; }
  } else {
    // Restore previous settings
    if (_perfModePrevSettings) {
      document.getElementById('settingParticles').checked = _perfModePrevSettings.particles;
      document.getElementById('settingShake').checked     = _perfModePrevSettings.shake;
      document.getElementById('settingDmgNums').checked   = _perfModePrevSettings.dmgNums;
      document.getElementById('settingLandDust').checked  = _perfModePrevSettings.landDust;
      if (document.getElementById('settingFinishers'))  document.getElementById('settingFinishers').checked  = _perfModePrevSettings.finishers;
      if (document.getElementById('settingBossAura'))   document.getElementById('settingBossAura').checked   = _perfModePrevSettings.bossAura;
      if (document.getElementById('settingBotPortal'))  document.getElementById('settingBotPortal').checked  = _perfModePrevSettings.botPortal;
      if (document.getElementById('settingPhaseFlash')) document.getElementById('settingPhaseFlash').checked = _perfModePrevSettings.phaseFlash;
    }
    if (btn) { btn.textContent = '⚡ Performance Mode: Off'; btn.style.color = '#88ffaa'; btn.style.borderColor = 'rgba(80,255,120,0.4)'; }
  }

  updateSettings();
}

// ── Changelog ─────────────────────────────────────────────────────────────────
const _CLG_CAT_COLORS = {
  Story:     '#88ccff',
  Cinematic: '#cc88ff',
  AI:        '#ff9966',
  Combat:    '#ff6688',
  UI:        '#88ffcc',
  Network:   '#ffcc66',
  System:    '#aaaacc',
};

// Returns true if this change item should currently be shown glitched/hidden.
function _clgSpoilerHidden(ch) {
  if (ch.spoilerLevel !== undefined) {
    const lvl = (typeof playerProgressLevel !== 'undefined') ? playerProgressLevel : 0;
    return lvl < ch.spoilerLevel;
  }
  if (ch.spoilerAct !== undefined) {
    const act = (window.STORY_PROGRESS && typeof STORY_PROGRESS.act === 'number') ? STORY_PROGRESS.act : 0;
    return act < ch.spoilerAct;
  }
  return false;
}

// Deterministic character scramble — stable across renders (same text → same scramble).
function _clgScramble(text) {
  const CHARS = '▓░█▒▀▄╬╫╠╣▌▐■□▲▼⚡╪╥╨▬╗╚╔╝╩╦';
  let seed = 0;
  for (let i = 0; i < text.length; i++) seed = (seed * 31 + text.charCodeAt(i)) & 0xffffff;
  const rng = () => { seed = (seed * 1664525 + 1013904223) & 0xffffffff; return (seed >>> 0) / 0xffffffff; };
  return text.split('').map(c => (c === ' ' || c === '—') ? c : CHARS[Math.floor(rng() * CHARS.length)]).join('');
}

function showChangelogModal() {
  const modal   = document.getElementById('changelogModal');
  const content = document.getElementById('changelogContent');
  const verHead = document.getElementById('changelogVersionHeader');
  if (!modal || !content) return;

  if (verHead) verHead.textContent = 'v' + GAME_VERSION;

  let html = '';
  const _clgProgress = (typeof playerProgressLevel !== 'undefined') ? playerProgressLevel : 0;
  for (const entry of CHANGELOG) {
    const isLatest = entry.isLatest;
    const entryRequired = entry.requiredProgress || 0;
    const isRedacted = _clgProgress < entryRequired;
    html += `
      <div style="margin-bottom:28px;border:1px solid rgba(${isLatest?'80,120,255':'40,60,120'},0.35);border-radius:10px;overflow:hidden;${isRedacted?'opacity:0.55;':''}">
        <!-- Header row -->
        <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 16px;background:rgba(${isLatest?'30,50,120':'15,20,50'},0.55);cursor:pointer;"
             onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='none'?'':'none'">
          <div style="display:flex;align-items:center;gap:10px;">
            ${isLatest ? '<span style="background:linear-gradient(90deg,#4488ff,#8844ff);color:#fff;font-size:0.6rem;padding:2px 8px;border-radius:4px;letter-spacing:2px;font-weight:700;">NEW</span>' : ''}
            <span style="color:${isLatest?'#aaccff':'#7788aa'};font-size:1.0rem;font-weight:700;letter-spacing:1px;">v${entry.version}</span>
            <span style="color:${isLatest?'#ddeeff':'#8899bb'};font-size:0.9rem;">${isRedacted ? '??? REDACTED' : entry.title}</span>
          </div>
          <span style="color:#334466;font-size:0.72rem;letter-spacing:1px;">${entry.date} &nbsp;▾</span>
        </div>
        <!-- Body -->
        <div style="padding:12px 16px 14px;background:rgba(5,8,25,0.6);">
    `;
    if (isRedacted) {
      html += `
          <div style="font-size:0.68rem;color:#334466;letter-spacing:2px;margin-bottom:10px;font-style:italic;">"You're not supposed to see that yet."</div>
          <div style="color:#334466;font-size:0.78rem;letter-spacing:1px;font-style:italic;">[ CONTENT REDACTED — UNLOCK TO VIEW ]</div>
      `;
    } else {
      html += `
          <div style="font-size:0.68rem;color:#334466;letter-spacing:2px;margin-bottom:10px;font-style:italic;">"${entry.flavor}"</div>
          <div style="display:flex;flex-direction:column;gap:5px;">
      `;
      // Group by category (keep full change objects)
      const grouped = {};
      for (const ch of entry.changes) {
        if (!grouped[ch.cat]) grouped[ch.cat] = [];
        grouped[ch.cat].push(ch);
      }
      for (const [cat, items] of Object.entries(grouped)) {
        const col = _CLG_CAT_COLORS[cat] || '#aaaacc';
        html += `<div style="margin-bottom:4px;">
          <span style="font-size:0.62rem;color:${col};letter-spacing:2px;opacity:0.8;text-transform:uppercase;font-weight:700;">[${cat}]</span>
          <ul style="margin:3px 0 0 0;padding-left:18px;list-style:none;">`;
        for (const ch of items) {
          const hidden = _clgSpoilerHidden(ch);
          if (hidden) {
            const scrambled = _clgScramble(ch.text);
            html += `<li style="font-size:0.78rem;line-height:1.65;position:relative;overflow:visible;">
              <span style="position:absolute;left:-14px;color:${col};opacity:0.3;">›</span>
              <span class="clg-spoiler" title="Progress further to reveal">${scrambled}</span>
            </li>`;
          } else {
            html += `<li style="color:#8899bb;font-size:0.78rem;line-height:1.65;position:relative;">
              <span style="position:absolute;left:-14px;color:${col};opacity:0.6;">›</span>${ch.text}
            </li>`;
          }
        }
        html += `</ul></div>`;
      }
      html += `</div>`;
    }
    html += `</div></div>`;
  }

  content.innerHTML = html;
  modal.style.display = 'block';
}

function closeChangelogModal() {
  const modal = document.getElementById('changelogModal');
  if (modal) modal.style.display = 'none';
}

// ── Populate version labels in menu on page load ─────────────────────────────
function _initVersionLabels() {
  const badge    = document.getElementById('homeVersionBadge');
  const settings = document.getElementById('settingsVersionLabel');
  if (badge)    badge.textContent    = 'v' + GAME_VERSION;
  if (settings) settings.textContent = 'v' + GAME_VERSION;
}

// ── Custom Weapons Panel ──────────────────────────────────────────────────────
