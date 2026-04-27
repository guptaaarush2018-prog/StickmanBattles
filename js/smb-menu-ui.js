'use strict';
// smb-menu-ui.js — Mode selection, cosmetics/store, bot toggle
// Depends on: smb-globals.js, smb-data-weapons.js, smb-state.js, smb-accounts.js
// Must load BEFORE smb-menu-select.js

// ============================================================
// MENU UI HANDLERS
// ============================================================
function selectMode(mode) {
  const _prevMode = gameMode;
  // 'bot' is no longer a separate mode — merge into '2p' with bot toggles
  if (mode === 'bot') mode = '2p';
  if (mode === 'completerandom') {
    mode = '2p';
    completeRandomizer = true;
  }
  // 'story' opens the story modal instead of changing menu layout
  if (mode === 'story') {
    if (typeof openStoryMenu === 'function') openStoryMenu();
    return;
  }
  gameMode = mode;
  if (_prevMode === 'story' && mode !== 'story' && typeof forceResetGravity === 'function') {
    forceResetGravity();
  }
  document.querySelectorAll('.mode-card').forEach(c => c.classList.remove('active'));
  const modeCard = document.querySelector(`[data-mode="${mode}"]`);
  if (modeCard) modeCard.classList.add('active');
  const isBoss       = mode === 'boss';
  // Online allows boss, trueform, training, minigames — no redirect needed
  const isTrueForm   = mode === 'trueform';
  const isBoss2p     = isBoss && bossPlayerCount === 2;
  const isTraining   = mode === 'training';
  const isMinigames  = mode === 'minigames';
  const isOnline     = mode === 'online';
  const isAdaptive        = mode === 'adaptive' || mode === 'sovereign';
  const isCompleteRandom  = mode === '2p' && completeRandomizer;
  // Only update onlineMode when not already connected (prevents clearing it when host/guest switch game modes)
  if (!NetworkManager.connected) onlineMode = isOnline;
  // Show/hide boss player count toggle
  const bpt = document.getElementById('bossPlayerToggle');
  if (bpt) bpt.style.display = isBoss ? 'flex' : 'none';
  const crRow = document.getElementById('completeRandomRow');
  if (crRow) crRow.style.display = mode === '2p' ? 'flex' : 'none';
  const crBtn = document.getElementById('completeRandomBtn');
  if (crBtn) {
    crBtn.textContent = `🎲 Complete Random: ${isCompleteRandom ? 'ON' : 'OFF'}`;
    crBtn.classList.toggle('active', isCompleteRandom);
  }
  // Show/hide online connection panel
  const onlinePanel = document.getElementById('onlinePanel');
  if (onlinePanel) onlinePanel.style.display = isOnline ? 'flex' : 'none';
  if (isOnline && typeof refreshPublicRooms === 'function') refreshPublicRooms();
  // Show/hide minigame selection panel
  const mgPanel = document.getElementById('minigamePanel');
  if (mgPanel) mgPanel.style.display = isMinigames ? 'block' : 'none';
  // P2 panel title/hint
  document.getElementById('p2Title').textContent = isTrueForm ? 'TRUE FORM' : isAdaptive ? 'NEURAL AI' : (isBoss && !isBoss2p) ? 'CREATOR' : (isBoss2p ? 'Player 2' : (isTraining ? 'TRAINING' : (p2IsBot ? 'BOT' : 'Player 2')));
  const _p2Hint = document.getElementById('p2Hint');
  if (_p2Hint) _p2Hint.textContent = isTrueForm ? 'Secret Final Boss' : isAdaptive ? 'Learns your playstyle' : (isBoss && !isBoss2p) ? 'Boss — AI Controlled' : (isBoss2p ? '← → ↑ · Enter · . · /' : (isTraining ? 'Practice mode' : (p2IsBot ? 'AI Controlled' : '← → ↑ · Enter · . · / · ↓')));
  document.getElementById('p1DifficultyRow').style.display = p1IsBot ? 'flex' : 'none';
  document.getElementById('p2DifficultyRow').style.display = p2IsBot ? 'flex' : 'none';
  // Hide P2 config rows in boss 1P, training, trueform, adaptive
  const hideP2 = (isBoss && !isBoss2p) || isTraining || isTrueForm || isAdaptive;
  document.getElementById('p2ColorRow').style.display     = hideP2 ? 'none' : 'flex';
  document.getElementById('p2WeaponRow').style.display    = hideP2 ? 'none' : 'flex';
  document.getElementById('p2ClassRow').style.display     = hideP2 ? 'none' : 'flex';
  const p1BotToggle = document.getElementById('p1BotToggle');
  if (p1BotToggle) p1BotToggle.style.display = (isMinigames || isTrueForm || isAdaptive) ? 'none' : '';
  const p2BotToggleEl = document.getElementById('p2BotToggle');
  if (p2BotToggleEl) p2BotToggleEl.style.display = (isBoss2p) ? '' : (isBoss || isTrueForm || isAdaptive) ? 'none' : '';
  const trainingPanel = document.getElementById('trainingPanel');
  if (trainingPanel) trainingPanel.style.display = isTraining ? 'block' : 'none';
  // Boss/training/minigames/trueform/online/adaptive: hide ∞ infinite; adaptive still shows arena picker
  document.getElementById('arenaSection').style.display   = (isBoss || isTraining || isMinigames || isTrueForm || isOnline || isCompleteRandom) ? 'none' : '';
  const _infOpt = document.getElementById('infiniteOption');
  if (_infOpt) _infOpt.disabled = !!(isBoss || isTraining || isMinigames || isTrueForm || isOnline || isAdaptive);
  if ((isBoss || isTraining || isMinigames || isTrueForm || isOnline || isAdaptive) && infiniteMode) {
    infiniteMode = false;
    selectLives(3);
  }
  // Chaos mode toggle: only available in minigames and online
  const chaosModeRow = document.getElementById('chaosModeRow');
  if (chaosModeRow) {
    const showChaos = isMinigames || isOnline;
    chaosModeRow.style.display = showChaos ? 'flex' : 'none';
    // If switching away from a chaos-compatible mode, turn chaos off
    if (!showChaos && typeof chaosMode !== 'undefined' && chaosMode) {
      chaosMode = false;
      const btn = document.getElementById('chaosModeBtn');
      if (btn) { btn.textContent = '⚡ Chaos Mode: OFF'; btn.style.borderColor = 'rgba(160,60,255,0.4)'; btn.style.color = '#cc88ff'; btn.style.boxShadow = ''; }
    }
  }
  // Custom weapons: allowed in offline 1v1/training, or online when host enables the checkbox
  const _allowCustomWeapons = (!onlineMode && (mode === '2p' || mode === 'training'))
                             || (onlineMode && onlineAllowCustomWeapons);
  for (const selId of ['p1Weapon', 'p2Weapon']) {
    const sel = document.getElementById(selId);
    if (!sel) continue;
    sel.querySelectorAll('option[value^="_custom_"]').forEach(opt => {
      opt.hidden = !_allowCustomWeapons;
    });
    // If currently selected value is a custom weapon and mode doesn't allow it, reset to sword
    if (!_allowCustomWeapons && sel.value && sel.value.startsWith('_custom_')) {
      sel.value = 'sword';
    }
  }
  // Enter config view if this was a user-initiated mode selection (home content currently visible)
  if (mode !== 'story') {
    const _hc = document.getElementById('menuHomeContent');
    if (_hc && _hc.style.display !== 'none') {
      _enterConfigView(mode);
    }
  }
}

// ── Home/Config view state machine ───────────────────────────────────────────
function _enterConfigView(mode) {
  const menuEl = document.getElementById('menu');
  if (menuEl) menuEl.classList.remove('menu-home');
  const homeContent = document.getElementById('menuHomeContent');
  if (homeContent) homeContent.style.display = 'none';
  const configContent = document.getElementById('menuConfigContent');
  if (configContent) configContent.style.display = 'flex';
  const modeLabel = document.getElementById('configModeLabel');
  if (modeLabel) {
    const _names = {
      '2p': '1v1', 'boss': 'Boss Fight', 'trueform': 'True Form',
      'training': 'Training', 'minigames': 'Minigames', 'online': 'Online',
      'sovereign': 'Sovereign Ω', 'adaptive': 'Adaptive AI', 'storyonline': 'Story Online',
    };
    modeLabel.textContent = _names[mode] || mode.toUpperCase();
  }
}

function backToHome() {
  const menuEl = document.getElementById('menu');
  if (menuEl) menuEl.classList.add('menu-home');
  const homeContent = document.getElementById('menuHomeContent');
  if (homeContent) homeContent.style.display = '';
  const configContent = document.getElementById('menuConfigContent');
  if (configContent) configContent.style.display = 'none';
}

// ── Custom weapon options ─────────────────────────────────────────────────────
function refreshCustomWeaponOptions() {
  const customWeapons = window.CUSTOM_WEAPONS || {};
  const keys = Object.keys(customWeapons);
  for (const selId of ['p1Weapon', 'p2Weapon']) {
    const sel = document.getElementById(selId);
    if (!sel) continue;
    // Remove any previously-injected custom options
    sel.querySelectorAll('option[value^="_custom_"]').forEach(o => o.remove());
    sel.querySelectorAll('optgroup[label="─── Custom ────────────"]').forEach(g => g.remove());
    if (keys.length === 0) continue;
    const grp = document.createElement('optgroup');
    grp.label = '─── Custom ────────────';
    keys.forEach(key => {
      const w = customWeapons[key];
      const opt = document.createElement('option');
      opt.value = key;
      opt.textContent = '🔧 ' + (w.name || key);
      grp.appendChild(opt);
    });
    sel.appendChild(grp);
  }
  // Rebuild card grids to include the new options
  _buildSelCardGrid('p1WeaponCards', 'p1Weapon', _WEAPON_CARD_DATA, 'p1', 'weapon');
  _buildSelCardGrid('p2WeaponCards', 'p2Weapon', _WEAPON_CARD_DATA, 'p2', 'weapon');
}

// Called by the "Custom Weapons" checkbox in #onlineGameModeRow
function toggleOnlineCustomWeapons(checked) {
  onlineAllowCustomWeapons = !!checked;
  // Re-run selectMode so weapon dropdowns update immediately
  if (typeof selectMode === 'function') selectMode(gameMode || 'online');
}

function toggleCompleteRandom(forceValue) {
  const nextValue = typeof forceValue === 'boolean' ? forceValue : !completeRandomizer;
  completeRandomizer = nextValue;
  if (gameMode !== '2p') gameMode = '2p';
  selectMode('2p');
}

const SKIN_COLORS = {
  default: null, // uses player's selected color
  fire:    '#ff4400',
  ice:     '#44aaff',
  shadow:  '#222233',
  gold:    '#cc8800',
  void:    '#7700cc',
  neon:    '#00ff88',
};

// Weapon theme tint colors applied as a colour-blend overlay in drawWeapon()
const WEAPON_THEMES = {
  default: null,
  fire:    '#ff5500',
  ice:     '#44aaff',
  shadow:  '#220033',
  gold:    '#ffaa00',
  void:    '#aa00ff',
  neon:    '#00ff88',
};

// Cosmetic catalog — price 0 = free / always unlocked
const COSMETIC_CATALOG = [
  // Character skins
  { id: 'skin_default', type: 'skin', key: 'default', name: 'Default',   price: 0,   color: null },
  { id: 'skin_fire',    type: 'skin', key: 'fire',    name: 'Fire',      price: 0,   color: '#ff4400' },
  { id: 'skin_ice',     type: 'skin', key: 'ice',     name: 'Ice',       price: 0,   color: '#44aaff' },
  { id: 'skin_shadow',  type: 'skin', key: 'shadow',  name: 'Shadow',    price: 0,   color: '#222233' },
  { id: 'skin_gold',    type: 'skin', key: 'gold',    name: 'Gold',      price: 0,   color: '#cc8800' },
  { id: 'skin_void',    type: 'skin', key: 'void',    name: 'Void',      price: 150, color: '#7700cc' },
  { id: 'skin_neon',    type: 'skin', key: 'neon',    name: 'Neon',      price: 100, color: '#00ff88' },
  // Weapon themes
  { id: 'wskin_default', type: 'wskin', key: 'default', name: 'Default', price: 0,   color: '#888888' },
  { id: 'wskin_fire',    type: 'wskin', key: 'fire',    name: 'Inferno', price: 50,  color: '#ff5500' },
  { id: 'wskin_ice',     type: 'wskin', key: 'ice',     name: 'Glacier', price: 50,  color: '#44aaff' },
  { id: 'wskin_shadow',  type: 'wskin', key: 'shadow',  name: 'Shadow',  price: 50,  color: '#220033' },
  { id: 'wskin_gold',    type: 'wskin', key: 'gold',    name: 'Gilded',  price: 75,  color: '#ffaa00' },
  { id: 'wskin_void',    type: 'wskin', key: 'void',    name: 'Void',    price: 200, color: '#aa00ff' },
  { id: 'wskin_neon',    type: 'wskin', key: 'neon',    name: 'Neon',    price: 125, color: '#00ff88' },
];

// ---- Coin balance ----
// Sourced from playerCoins global (hydrated by _refreshRuntimeFromSave)
let coinBalance = (typeof playerCoins !== 'undefined') ? playerCoins : 0;

function _syncCoinDisplay() {
  const storeBal = document.getElementById('storeCoinBalance');
  if (storeBal) {
    storeBal.textContent = coinBalance + ' ⬡';
    storeBal.classList.add('coin-pop');
    setTimeout(() => storeBal.classList.remove('coin-pop'), 500);
  }
  const coinEl = document.getElementById('coinDisplay');
  if (coinEl) coinEl.textContent = coinBalance + ' ⬡';
}

function getCoinBalance() {
  // Always read from account.data via getCoins() (single source of truth)
  if (typeof getCoins === 'function') {
    coinBalance = getCoins();
  } else if (typeof playerCoins === 'number') {
    coinBalance = playerCoins;
  }
  return coinBalance;
}

function refreshCoinDisplay() {
  if (typeof getCoins === 'function') coinBalance = getCoins();
  else if (typeof playerCoins === 'number') coinBalance = playerCoins;
  _syncCoinDisplay();
}

function setCoinBalance(value) {
  const next = Math.max(0, Math.floor(Number(value) || 0));
  coinBalance = next;
  // Delegate to canonical setCoins() which writes to account.data first
  if (typeof setCoins === 'function') {
    setCoins(next);
  } else if (typeof updateCoins === 'function') {
    updateCoins(function() { return next; });
  } else if (typeof playerCoins !== 'undefined') {
    playerCoins = next;
    if (typeof saveGame === 'function') saveGame();
  }
  _syncCoinDisplay();
  return coinBalance;
}

function awardCoins(n) {
  const amount = Number(n) || 0;
  if (typeof addCoins === 'function') {
    addCoins(amount);
    coinBalance = typeof getCoins === 'function' ? getCoins() : coinBalance + amount;
    _syncCoinDisplay();
    return coinBalance;
  }
  return setCoinBalance(getCoinBalance() + amount);
}

// ---- Unlocked cosmetics (sourced from unlockedCosmetics global) ----
function _getUnlocked() {
  return typeof unlockedCosmetics !== 'undefined' ? unlockedCosmetics : [];
}
function isCosmeticUnlocked(id) {
  const entry = COSMETIC_CATALOG.find(c => c.id === id);
  if (!entry || entry.price === 0) return true;
  return _getUnlocked().indexOf(id) !== -1;
}
function unlockCosmetic(id) {
  const entry = COSMETIC_CATALOG.find(c => c.id === id);
  if (!entry) return false;
  if (isCosmeticUnlocked(id)) return true;
  const _bal = typeof getCoins === 'function' ? getCoins() : getCoinBalance();
  if (_bal < entry.price) return false;
  if (typeof setCoins === 'function') {
    setCoins(_bal - entry.price);
    coinBalance = typeof getCoins === 'function' ? getCoins() : coinBalance - entry.price;
    _syncCoinDisplay();
  } else {
    setCoinBalance(_bal - entry.price);
  }
  if (typeof addCosmetic === 'function') {
    addCosmetic(id);
  } else if (typeof unlockedCosmetics !== 'undefined' && unlockedCosmetics.indexOf(id) === -1) {
    unlockedCosmetics.push(id);
    if (typeof saveGame === 'function') saveGame();
  }
  return true;
}

// ---- Equip state ----
let p1Skin = 'default', p2Skin = 'default';
let p1WeaponSkin = 'default', p2WeaponSkin = 'default';

function setSkin(pid, skin, btn) {
  if (pid === 'p1') p1Skin = skin;
  else              p2Skin = skin;
  document.querySelectorAll(`.skin-swatch[data-pid="${pid}"]`).forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
}

function setWeaponSkin(pid, skin, btn) {
  if (pid === 'p1') p1WeaponSkin = skin;
  else              p2WeaponSkin = skin;
  document.querySelectorAll(`.wskin-swatch[data-pid="${pid}"]`).forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
}

// ---- Store modal ----
function openStore() {
  renderStore();
  const m = document.getElementById('cosmeticStore');
  if (m) m.style.display = 'flex';
}
function closeStore() {
  const m = document.getElementById('cosmeticStore');
  if (m) m.style.display = 'none';
}
function renderStore() {
  const el = document.getElementById('storeCoinBalance');
  if (el) el.textContent = coinBalance + ' ⬡';
  const grid = document.getElementById('storeGrid');
  if (!grid) return;
  grid.innerHTML = '';
  COSMETIC_CATALOG.forEach(item => {
    const owned = isCosmeticUnlocked(item.id);
    const card  = document.createElement('div');
    card.className = 'store-card' + (owned ? ' owned' : '');
    const swatch = item.color
      ? `<div class="store-swatch" style="background:${item.color}"></div>`
      : `<div class="store-swatch" style="background:linear-gradient(135deg,#00d4ff,#ff4455)"></div>`;
    const typeLabel = item.type === 'skin' ? 'Character Skin' : 'Weapon Theme';
    card.innerHTML = `
      ${swatch}
      <div class="store-name">${item.name}</div>
      <div class="store-type">${typeLabel}</div>
      ${owned
        ? `<div class="store-owned">Owned</div>`
        : `<button class="store-buy-btn" onclick="handleStoreBuy('${item.id}')">${item.price} ⬡</button>`
      }`;
    grid.appendChild(card);
  });
}
function handleStoreBuy(id) {
  const ok = unlockCosmetic(id);
  if (!ok) {
    const msg = document.getElementById('storeMsg');
    if (msg) { msg.textContent = 'Not enough coins!'; msg.style.color = '#ff4455'; setTimeout(() => { msg.textContent = ''; }, 1800); }
    return;
  }
  renderStore(); // refresh
  // If bought a skin/wskin that is currently equipped, mark it visually
  _syncStoreSwatches();
}
function _syncStoreSwatches() {
  // Mark locked swatches visually
  document.querySelectorAll('.skin-swatch[data-cosid]').forEach(btn => {
    btn.disabled = !isCosmeticUnlocked(btn.dataset.cosid);
    btn.style.opacity = btn.disabled ? '0.35' : '1';
  });
  document.querySelectorAll('.wskin-swatch[data-cosid]').forEach(btn => {
    btn.disabled = !isCosmeticUnlocked(btn.dataset.cosid);
    btn.style.opacity = btn.disabled ? '0.35' : '1';
  });
}

function setBossPlayers(n) {
  bossPlayerCount = n;
  document.getElementById('bpBtn1').classList.toggle('active', n === 1);
  document.getElementById('bpBtn2').classList.toggle('active', n === 2);
  selectMode('boss'); // refresh UI
}

function toggleBot(pid) {
  if (pid === 'p1') {
    p1IsBot = !p1IsBot;
    const btn = document.getElementById('p1BotToggle');
    if (btn) btn.textContent = p1IsBot ? 'Bot' : 'Human';
  } else {
    // Cycle: Human → Bot → None → Human
    if (!p2IsBot && !p2IsNone)      { p2IsBot = true;  p2IsNone = false; }
    else if (p2IsBot && !p2IsNone)  { p2IsBot = false; p2IsNone = true;  }
    else                             { p2IsBot = false; p2IsNone = false; }
    const btn = document.getElementById('p2BotToggle');
    if (btn) btn.textContent = p2IsNone ? 'None' : (p2IsBot ? 'Bot' : 'Human');
  }
  // Refresh mode UI to reflect updated bot state
  selectMode(gameMode);
}

// ============================================================
// WEAPON / CLASS CARD GRIDS
// ============================================================
const _WEAPON_CARD_DATA = {
  random:        { icon: '🎲', tag: 'Chaos' },
  sword:         { icon: '⚔️',  tag: 'Fast' },
  hammer:        { icon: '🔨', tag: 'Heavy' },
  gun:           { icon: '🔫', tag: 'Ranged' },
  axe:           { icon: '🪓', tag: 'Splash' },
  spear:         { icon: '🗡️', tag: 'Reach' },
  bow:           { icon: '🏹', tag: 'Archer' },
  shield:        { icon: '🛡️', tag: 'Paladin' },
  scythe:        { icon: '💀', tag: 'Lifesteal' },
  fryingpan:     { icon: '🍳', tag: 'Stun' },
  broomstick:    { icon: '🧹', tag: 'Push' },
  boxinggloves:  { icon: '🥊', tag: 'Combo' },
  peashooter:    { icon: '🌿', tag: 'Rapid' },
  slingshot:     { icon: '🪃', tag: 'Arc' },
  paperairplane: { icon: '✈️', tag: 'Curve' },
};

const _CLASS_CARD_DATA = {
  random:    { icon: '🎲', tag: 'Surprise' },
  none:      { icon: '⬜', tag: 'Free' },
  thor:      { icon: '⚡', tag: 'Tank' },
  kratos:    { icon: '🔴', tag: 'Rage' },
  ninja:     { icon: '💨', tag: 'Speed' },
  gunner:    { icon: '🔵', tag: 'Double' },
  archer:    { icon: '🏹', tag: 'Evasive' },
  paladin:   { icon: '🛡️', tag: 'Holy' },
  berserker: { icon: '💢', tag: 'Frenzy' },
};
