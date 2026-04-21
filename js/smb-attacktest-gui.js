'use strict';
// smb-attacktest-gui.js — _atkOpenGUI visual overlay + console patch integration
// Depends on: smb-globals.js, smb-fighter.js, smb-combat.js

// ─── VISUAL GUI ───────────────────────────────────────────────
function _atkOpenGUI() {
  const existing = document.getElementById('atkViewerOverlay');
  if (existing) { existing.remove(); return; }

  const ov = document.createElement('div');
  ov.id = 'atkViewerOverlay';
  ov.style.cssText = 'position:fixed;top:0;right:0;width:340px;max-height:100vh;overflow-y:auto;z-index:9995;background:rgba(6,6,18,0.97);border-left:2px solid #8800ff;font-family:monospace;color:#ccbbff;display:flex;flex-direction:column;';

  // Header
  const hdr = document.createElement('div');
  hdr.style.cssText = 'padding:10px 14px 6px;background:rgba(50,0,100,0.9);border-bottom:1px solid #8800ff;flex-shrink:0;';
  hdr.innerHTML = '<span style="font-size:1rem;font-weight:bold;letter-spacing:1px;color:#cc88ff">⚔ ATTACK VIEWER</span>'
    + '<span id="atkCloseBtn" style="float:right;cursor:pointer;color:#ff88aa;font-size:1.1rem;" title="Close">✕</span>'
    + '<div style="font-size:0.7rem;color:#8866aa;margin-top:3px;">Click an attack to fire it as a pure effect. No boss spawned.</div>';
  ov.appendChild(hdr);

  // Options bar
  const optBar = document.createElement('div');
  optBar.style.cssText = 'padding:7px 14px;background:rgba(20,10,40,0.9);border-bottom:1px solid #440088;font-size:0.72rem;display:flex;gap:10px;align-items:center;flex-shrink:0;';
  optBar.innerHTML = `<label style="cursor:pointer"><input type="checkbox" id="atkGUISafe" ${_atkSafeMode?'checked':''}> Safe</label>`
    + `<label style="cursor:pointer"><input type="checkbox" id="atkGUIPause" ${_atkPauseBetween?'checked':''}> Pause</label>`
    + `<label>Dmg×<input type="number" id="atkGUIScale" value="${_atkDamageScale}" min="0.1" max="10" step="0.1" style="width:42px;background:#111;color:#aaf;border:1px solid #556;border-radius:3px;padding:1px 4px;"></label>`
    + `<button id="atkGUIReset" style="margin-left:auto;padding:2px 8px;background:rgba(180,0,0,0.4);border:1px solid #880000;border-radius:4px;color:#ffaaaa;cursor:pointer;font-size:0.7rem;">Reset</button>`;
  ov.appendChild(optBar);

  // Admin class equip bar
  const kitBar = document.createElement('div');
  kitBar.style.cssText = 'padding:6px 14px;background:rgba(15,0,35,0.9);border-bottom:1px solid #440088;font-size:0.7rem;flex-shrink:0;';
  kitBar.innerHTML = '<div style="color:#aa88cc;margin-bottom:4px;">⚙ Equip Admin Kit on player:</div>'
    + '<div style="display:flex;gap:6px;flex-wrap:wrap;">'
    + ['creator','trueform','yeti','beast'].map(k =>
        `<button class="atkKitBtn" data-kit="${k}" style="padding:3px 8px;background:rgba(80,0,160,0.4);border:1px solid #660099;border-radius:4px;color:#cc88ff;cursor:pointer;font-size:0.68rem;">${k}</button>`
      ).join('')
    + `<button class="atkKitBtn" data-kit="off" style="padding:3px 8px;background:rgba(100,0,0,0.4);border:1px solid #660000;border-radius:4px;color:#ff8888;cursor:pointer;font-size:0.68rem;">off</button>`
    + `<select id="atkKitSlot" style="padding:2px 4px;background:#111;color:#aaf;border:1px solid #446;border-radius:4px;font-size:0.68rem;"><option value="p1">P1</option><option value="p2">P2</option></select>`
    + '</div>';
  ov.appendChild(kitBar);

  // Class tabs
  const tabBar = document.createElement('div');
  tabBar.style.cssText = 'display:flex;flex-shrink:0;border-bottom:1px solid #440088;';
  const classKeys = Object.keys(ATK_REGISTRY);
  let activeKey = classKeys[0];
  const tabBtns = {};
  for (const key of classKeys) {
    const tb = document.createElement('button');
    tb.textContent = key.toUpperCase().slice(0,6);
    tb.dataset.key = key;
    tb.style.cssText = 'flex:1;padding:6px 2px;background:transparent;border:none;border-right:1px solid #440088;color:#aa88cc;font-family:monospace;font-size:0.68rem;cursor:pointer;';
    tabBtns[key] = tb;
    tabBar.appendChild(tb);
  }
  ov.appendChild(tabBar);

  // Attack list
  const listDiv = document.createElement('div');
  listDiv.id = 'atkGUIList';
  listDiv.style.cssText = 'flex:1;overflow-y:auto;padding:6px 10px;';
  ov.appendChild(listDiv);

  // Demo all footer
  const footer = document.createElement('div');
  footer.style.cssText = 'padding:8px 14px;border-top:1px solid #440088;flex-shrink:0;';
  footer.innerHTML = '<button id="atkGUIDemoAll" style="width:100%;padding:5px;background:rgba(100,0,200,0.4);border:1px solid #8800ff;border-radius:5px;color:#cc88ff;font-family:monospace;cursor:pointer;">▶ Demo All Attacks</button>';
  ov.appendChild(footer);

  document.body.appendChild(ov);

  // Render attack cards
  function _syncOpts() {
    const safeEl  = document.getElementById('atkGUISafe');
    const scaleEl = document.getElementById('atkGUIScale');
    const pauseEl = document.getElementById('atkGUIPause');
    if (safeEl)  _atkSafeMode     = safeEl.checked;
    if (scaleEl) _atkDamageScale  = Math.max(0.1, parseFloat(scaleEl.value)||1);
    if (pauseEl) _atkPauseBetween = pauseEl.checked;
  }

  function _renderCards(key) {
    activeKey = key;
    for (const [k, btn] of Object.entries(tabBtns)) {
      btn.style.background = k===key ? 'rgba(100,0,200,0.5)' : 'transparent';
      btn.style.color      = k===key ? '#ffffff' : '#aa88cc';
    }
    listDiv.innerHTML = '';
    const bucket = ATK_REGISTRY[key] || [];
    bucket.forEach((entry, i) => {
      const card = document.createElement('div');
      card.style.cssText = 'display:flex;align-items:center;gap:8px;margin:4px 0;padding:6px 10px;background:rgba(40,0,80,0.55);border:1px solid rgba(120,0,200,0.4);border-radius:5px;cursor:pointer;';
      card.innerHTML = `<div style="flex:0 0 auto;font-size:0.7rem;color:#8844cc;min-width:18px">${i+1}</div>`
        + `<div style="flex:1;"><div style="color:#ddaaff;font-size:0.8rem;font-weight:bold;">${entry.label}</div>`
        + `<div style="color:#8877aa;font-size:0.68rem;margin-top:1px;">${entry.desc}</div></div>`
        + `<button style="flex-shrink:0;padding:3px 10px;background:rgba(130,0,255,0.4);border:1px solid #8800ff;border-radius:4px;color:#ccaaff;font-size:0.7rem;cursor:pointer;">▶</button>`;
      card.addEventListener('mouseenter', () => { card.style.background = 'rgba(80,0,150,0.7)'; });
      card.addEventListener('mouseleave', () => { card.style.background = 'rgba(40,0,80,0.55)'; });
      card.addEventListener('click', () => {
        _syncOpts();
        _atkSummon(entry.label);
      });
      listDiv.appendChild(card);
    });
  }

  _renderCards(activeKey);
  for (const [key, btn] of Object.entries(tabBtns)) btn.addEventListener('click', () => _renderCards(key));
  ov.querySelector('#atkCloseBtn').addEventListener('click', () => ov.remove());
  document.getElementById('atkGUIReset').addEventListener('click', () => _atkResetEffects());
  document.getElementById('atkGUIDemoAll').addEventListener('click', () => { _syncOpts(); _atkAll(activeKey); });

  // Kit equip buttons
  ov.querySelectorAll('.atkKitBtn').forEach(btn => {
    btn.addEventListener('click', () => {
      _syncOpts();
      const slot = document.getElementById('atkKitSlot').value;
      _atkEquipClass(btn.dataset.kit, slot);
    });
  });

  _consolePrint('[ATK] GUI opened — click any attack card to fire it.', '#88bbff');
}

// ─── PATCH CONSOLE ────────────────────────────────────────────
(function _patchConsoleForATK() {
  if (typeof _consoleExec !== 'function') {
    window.addEventListener('load', _patchConsoleForATK, { once: true });
    return;
  }
  if (_consoleExec.__atkPatched) return;
  const _orig = _consoleExec;
  _consoleExec = function(raw) {
    const trimmed = raw.trim().toLowerCase();
    if (trimmed === 'atk' || trimmed.startsWith('atk ')) {
      _atkCommand(raw.trim().slice(4).trim());
      return;
    }
    _orig(raw);
  };
  _consoleExec.__atkPatched = true;
  // Browser DevTools aliases
  window.atkSummon = (l)   => _atkSummon(l);
  window.atkList   = (k)   => _atkList(k);
  window.atkAll    = (k)   => _atkAll(k);
  window.atkGUI    = ()    => _atkOpenGUI();
  window.atkReset  = ()    => _atkResetEffects();
  window.atkClass  = (k,s) => _atkEquipClass(k,s);
})();
