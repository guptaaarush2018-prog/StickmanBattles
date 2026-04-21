'use strict';

// ============================================================
// STICKMAN CLASH — MAP & WEAPON DESIGNER
// Accessible from the main menu (Designer card) or via console.
// ============================================================

// ---- State ----
let _dPlatforms  = [];          // custom platforms being edited
let _dHazards    = new Set();   // active hazard toggles
let _dSelected   = null;        // index of selected platform
let _dDragging   = false;
let _dResizing   = false;       // true when dragging a resize handle
let _dResizeDir  = null;        // 'e' | 'w' | 'n' | 's' | 'se' | 'sw'
let _dDragOffX   = 0;
let _dDragOffY   = 0;
let _dHistory    = [];          // undo stack (shallow platform copies)
let _dBaseArena  = 'grass';
let _dMeta       = { name: 'My Map', hasLava: false, skyColor: '#0d0d1e' };
let _dCanvas     = null;
let _dCtx        = null;
let _dAnimId     = null;
let _dCustomWeapons = [];       // saved custom weapons
let _dSnapGrid   = true;        // grid snap toggle
const _D_SNAP    = 20;          // grid snap size (game units)

function _dSnapVal(v) { return _dSnapGrid ? Math.round(v / _D_SNAP) * _D_SNAP : v; }

function designerToggleSnap() {
  _dSnapGrid = !_dSnapGrid;
  const btn = document.getElementById('dSnapBtn');
  if (btn) { btn.textContent = `Grid Snap: ${_dSnapGrid ? 'ON' : 'OFF'}`; btn.classList.toggle('active', _dSnapGrid); }
}

// ---- PRESET ARENA LAYOUTS ----
const _D_PRESETS = {
  arena: [
    { x: -60, y: 480, w: 1020, h: 40, isFloor: true },
    { x: 370, y: 200, w: 160, h: 16 },
    { x: 155, y: 275, w: 155, h: 16 },
    { x: 590, y: 275, w: 155, h: 16 },
    { x:  18, y: 150, w: 120, h: 16 },
    { x: 762, y: 150, w: 120, h: 16 },
  ],
  parkour: [
    { x: -60, y: 480, w: 200, h: 40, isFloor: true },
    { x: 140, y: 400, w:  80, h: 14 },
    { x: 240, y: 340, w:  70, h: 14 },
    { x: 330, y: 275, w:  70, h: 14 },
    { x: 420, y: 215, w:  70, h: 14 },
    { x: 510, y: 155, w:  70, h: 14 },
    { x: 600, y: 100, w: 200, h: 14 },
    { x: 700, y: 480, w: 200, h: 40, isFloor: true },
  ],
  boss: [
    { x: 0,   y: 460, w: 900, h: 60, isFloor: true },
    { x: 300, y: 200, w: 300, h: 18 },
    { x:  60, y: 280, w: 150, h: 18 },
    { x: 690, y: 280, w: 150, h: 18 },
    { x: 375, y:  90, w: 150, h: 18 },
  ],
};

function designerApplyPreset(name) {
  const pl = _D_PRESETS[name];
  if (!pl) return;
  _dHistory.push(JSON.stringify(_dPlatforms));
  _dPlatforms = pl.map(p => Object.assign({ oscX: 0, oscY: 0, ox: p.x, oy: p.y }, p));
  _dSelected  = null;
}

// ---- OPEN / CLOSE ----
// ── Build the entire designer UI as a draggable floating panel ──
function _dBuildOverlay() {
  if (document.getElementById('designerOverlay')) return; // already built

  const S = (css) => css; // identity — just for readability
  const panel = document.createElement('div');
  panel.id = 'designerOverlay';
  panel.style.cssText = S(`
    display:none;
    position:fixed;
    top:5vh; left:50%;
    transform:translateX(-50%);
    width:min(960px,96vw);
    max-height:90vh;
    background:#0a0a1a;
    border:1.5px solid rgba(100,180,255,0.22);
    border-radius:14px;
    box-shadow:0 8px 60px rgba(0,0,50,0.7);
    z-index:2000;
    display:none;
    flex-direction:column;
    overflow:hidden;
    font-family:'Segoe UI',Arial,sans-serif;
    color:#ccd;
    font-size:14px;
    user-select:none;
  `);

  // ── Drag handle / title bar ───────────────────────────────
  panel.innerHTML = `
  <div id="dDragHandle" style="display:flex;align-items:center;justify-content:space-between;
    padding:9px 14px;background:rgba(40,60,120,0.55);cursor:grab;border-radius:12px 12px 0 0;
    border-bottom:1px solid rgba(100,180,255,0.15);flex-shrink:0;">
    <span style="font-weight:700;letter-spacing:1px;font-size:0.92rem;">🛠 Creator Studio</span>
    <div style="display:flex;gap:6px;align-items:center;">
      <button onclick="designerTab('map')"    id="dTabMap"    style="${_dTabBtnStyle(true)}">Map</button>
      <button onclick="designerTab('weapon')" id="dTabWeapon" style="${_dTabBtnStyle(false)}">Weapon</button>
      <button onclick="closeDesigner()" style="background:rgba(255,80,80,0.18);border:1px solid rgba(255,80,80,0.35);
        color:#ff8888;border-radius:7px;padding:3px 11px;cursor:pointer;font-size:0.8rem;">✕</button>
    </div>
  </div>

  <!-- MAP PANEL -->
  <div id="designerMapPanel" style="display:flex;flex-direction:row;gap:10px;padding:10px;overflow:auto;flex:1;min-height:0;">
    <!-- Canvas -->
    <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:6px;">
      <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">
        <button id="dSnapBtn" onclick="designerToggleSnap()" style="${_dBtnStyle('#44ff88',true)}">Grid Snap: ON</button>
        <span style="color:#778;font-size:0.72rem;">Presets:</span>
        <button onclick="designerApplyPreset('arena')"   style="${_dBtnStyle()}">⚔ Arena</button>
        <button onclick="designerApplyPreset('parkour')" style="${_dBtnStyle()}">🏃 Parkour</button>
        <button onclick="designerApplyPreset('boss')"    style="${_dBtnStyle()}">👑 Boss Stage</button>
      </div>
      <canvas id="designerCanvas" width="900" height="520"
        style="width:100%;border-radius:8px;border:1px solid rgba(255,255,255,0.08);cursor:crosshair;display:block;">
      </canvas>
      <p style="font-size:0.7rem;color:#556;margin:0;">Left-click empty space = add platform · Left-drag = move · Right-click = delete · Scroll = resize width · Drag corner handles = resize</p>
    </div>
    <!-- Controls -->
    <div style="width:200px;flex-shrink:0;display:flex;flex-direction:column;gap:7px;overflow-y:auto;">
      <div style="font-size:0.72rem;color:#88aacc;font-weight:700;letter-spacing:1px;text-transform:uppercase;">Base Arena</div>
      <select id="dBaseArena" onchange="designerChangeBase()" style="${_dSelectStyle()}">
        <option value="grass">Grass</option><option value="lava">Lava</option>
        <option value="space">Space</option><option value="city">City</option>
        <option value="forest">Forest</option><option value="ice">Ice</option>
        <option value="ruins">Ruins</option><option value="cave">Cave</option>
        <option value="colosseum">Colosseum</option><option value="cyberpunk">Cyberpunk</option>
        <option value="underwater">Underwater</option><option value="volcano">Volcano</option>
      </select>
      <div style="font-size:0.72rem;color:#88aacc;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin-top:4px;">Selected Platform</div>
      <div style="display:flex;gap:6px;align-items:center;">
        <label style="font-size:0.72rem;color:#889;">W</label>
        <input id="dPlatW" type="number" value="120" min="20" max="450" onchange="designerUpdateSelected()" style="${_dInputStyle()};width:60px;">
        <label style="font-size:0.72rem;color:#889;">H</label>
        <input id="dPlatH" type="number" value="14"  min="8"  max="80"  onchange="designerUpdateSelected()" style="${_dInputStyle()};width:50px;">
      </div>
      <label style="display:flex;align-items:center;gap:6px;font-size:0.78rem;cursor:pointer;">
        <input type="checkbox" id="dPlatFloor"  onchange="designerUpdateSelected()"> Floor
      </label>
      <label style="display:flex;align-items:center;gap:6px;font-size:0.78rem;cursor:pointer;">
        <input type="checkbox" id="dPlatMoving" onchange="designerUpdateSelected()"> Moving platform
      </label>
      <div style="font-size:0.72rem;color:#88aacc;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin-top:4px;">Map Settings</div>
      <input id="dMapName"  type="text"     value="My Map" placeholder="Map name"
        style="${_dInputStyle()};width:100%;">
      <label style="display:flex;align-items:center;gap:6px;font-size:0.78rem;cursor:pointer;">
        <input type="checkbox" id="dHasLava"> Has Lava
      </label>
      <div style="display:flex;align-items:center;gap:6px;">
        <label style="font-size:0.72rem;color:#889;">Sky</label>
        <input id="dSkyColor" type="color" value="#0d0d1e" style="width:40px;height:24px;border:none;background:none;cursor:pointer;">
      </div>
      <div style="font-size:0.72rem;color:#88aacc;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin-top:4px;">Hazards</div>
      <div style="display:flex;flex-wrap:wrap;gap:5px;">
        <button class="d-hazard-btn" onclick="designerToggleHazard('lava')"      style="${_dBtnStyle()}">🌋 Lava</button>
        <button class="d-hazard-btn" onclick="designerToggleHazard('lowgrav')"   style="${_dBtnStyle()}">🚀 Low-G</button>
        <button class="d-hazard-btn" onclick="designerToggleHazard('heavygrav')" style="${_dBtnStyle()}">⬇ Heavy-G</button>
        <button class="d-hazard-btn" onclick="designerToggleHazard('ice')"       style="${_dBtnStyle()}">🧊 Ice</button>
        <button class="d-hazard-btn" onclick="designerToggleHazard('wind')"      style="${_dBtnStyle()}">💨 Wind</button>
        <button class="d-hazard-btn" onclick="designerToggleHazard('fog')"       style="${_dBtnStyle()}">🌫 Fog</button>
        <button class="d-hazard-btn" onclick="designerToggleHazard('npc_beast')" style="${_dBtnStyle()}">🐺 Beast</button>
        <button class="d-hazard-btn" onclick="designerToggleHazard('npc_yeti')"  style="${_dBtnStyle()}">❄ Yeti</button>
      </div>
      <div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:4px;">
        <button onclick="designerAddPlatform()"   style="${_dBtnStyle('#88ccff')}">+ Add</button>
        <button onclick="designerUndo()"          style="${_dBtnStyle()}">↩ Undo</button>
        <button onclick="designerClearPlatforms()" style="${_dBtnStyle('#ff8888')}">🗑 Clear</button>
      </div>
      <div style="display:flex;gap:5px;flex-wrap:wrap;">
        <button onclick="designerPreview()" style="${_dBtnStyle('#88ff44')}">▶ Preview</button>
        <button onclick="designerSave()"    style="${_dBtnStyle('#ffcc44')}">💾 Save</button>
        <button onclick="designerLoad()"    style="${_dBtnStyle()}">📂 Load</button>
        <button onclick="designerExport()"  style="${_dBtnStyle('#88ccff')}">↑ Export</button>
        <button onclick="designerImport()"  style="${_dBtnStyle('#cc88ff')}">↓ Import</button>
      </div>
      <div id="dSavedMaps" style="display:none;margin-top:4px;">
        <div style="font-size:0.7rem;color:#aaa;margin-bottom:4px;">Saved Maps</div>
        <div id="dSavedMapsList" style="display:flex;flex-direction:column;gap:4px;max-height:140px;overflow-y:auto;"></div>
      </div>
    </div>
  </div>

  <!-- WEAPON PANEL -->
  <div id="designerWeaponPanel" style="display:none;flex-direction:row;gap:10px;padding:10px;overflow:auto;flex:1;min-height:0;">
    <!-- Preview Canvas -->
    <div style="flex:0 0 280px;display:flex;flex-direction:column;gap:8px;">
      <div style="font-size:0.72rem;color:#88aacc;font-weight:700;letter-spacing:1px;text-transform:uppercase;">Live Preview</div>
      <canvas id="weaponPreviewCanvas" width="280" height="280"
        style="width:280px;height:280px;border-radius:10px;border:1px solid rgba(100,180,255,0.18);background:#060610;display:block;">
      </canvas>
      <div id="weaponStatDisplay" style="font-size:0.76rem;line-height:1.6;background:rgba(255,255,255,0.04);
        border-radius:7px;padding:7px 10px;border:1px solid rgba(255,255,255,0.06);"></div>
    </div>
    <!-- Controls -->
    <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:7px;overflow-y:auto;">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
        <div>
          <label style="font-size:0.72rem;color:#889;">Name</label>
          <input id="wName" type="text" value="Custom Weapon" oninput="wSync()" style="${_dInputStyle()};width:100%;margin-top:3px;">
        </div>
        <div>
          <label style="font-size:0.72rem;color:#889;">Color</label>
          <input id="wColor" type="color" value="#44aaff" onchange="wSync()" style="display:block;width:100%;height:30px;border:none;background:none;cursor:pointer;margin-top:3px;">
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
        <div>
          <label style="font-size:0.72rem;color:#889;">Shape</label>
          <select id="wShape" onchange="wSync()" style="${_dSelectStyle()};margin-top:3px;width:100%;">
            <option value="blade">Blade / Sword</option>
            <option value="dagger">Dagger</option>
            <option value="hammer">Hammer</option>
            <option value="axe">Axe</option>
            <option value="spear">Spear / Lance</option>
            <option value="bow">Bow</option>
            <option value="staff">Staff / Orb</option>
          </select>
        </div>
        <div>
          <label style="font-size:0.72rem;color:#889;">Type</label>
          <select id="wType" onchange="wSync()" style="${_dSelectStyle()};margin-top:3px;width:100%;">
            <option value="melee">Melee</option>
            <option value="heavy">Heavy Melee</option>
            <option value="ranged">Ranged</option>
            <option value="magic">Magic</option>
          </select>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
        <div>
          <label style="font-size:0.72rem;color:#889;">Damage <span id="wDmgVal" style="color:#ff8888;">15</span></label>
          <input id="wDmg" type="range" min="1" max="60" value="15" oninput="wSync()" style="width:100%;margin-top:3px;">
        </div>
        <div>
          <label style="font-size:0.72rem;color:#889;">Range <span id="wRangeVal" style="color:#88aaff;">50</span>px</label>
          <input id="wRange" type="range" min="20" max="90" value="50" oninput="wSync()" style="width:100%;margin-top:3px;">
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
        <div>
          <label style="font-size:0.72rem;color:#889;">Cooldown <span id="wCoolVal" style="color:#ffcc44;">30</span>f</label>
          <input id="wCool" type="range" min="8" max="80" value="30" oninput="wSync()" style="width:100%;margin-top:3px;">
        </div>
        <div>
          <label style="font-size:0.72rem;color:#889;">Knockback <span id="wKbVal" style="color:#88ff88;">8</span></label>
          <input id="wKb" type="range" min="1" max="22" value="8" oninput="wSync()" style="width:100%;margin-top:3px;">
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
        <div>
          <label style="font-size:0.72rem;color:#889;">Ability Effect</label>
          <select id="wAbilEffect" onchange="wSync()" style="${_dSelectStyle()};margin-top:3px;width:100%;">
            <option value="dash">Dash Strike</option>
            <option value="leap">Leap</option>
            <option value="shield_burst">Shield Burst</option>
            <option value="projectile">Projectile</option>
            <option value="heal">Heal</option>
            <option value="slow">Slow</option>
          </select>
        </div>
        <div>
          <label style="font-size:0.72rem;color:#889;">Ability CD <span id="wAbilCoolVal" style="color:#ffaa44;">90</span>f</label>
          <input id="wAbilCool" type="range" min="30" max="300" value="90" oninput="wSync()" style="width:100%;margin-top:3px;">
        </div>
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:4px;">
        <button onclick="wSaveWeapon()"    style="${_dBtnStyle('#ffcc44')}">💾 Save Weapon</button>
        <button onclick="wEquipWeapon('p1')" style="${_dBtnStyle('#00d4ff')}">Equip P1</button>
        <button onclick="wEquipWeapon('p2')" style="${_dBtnStyle('#ff4455')}">Equip P2</button>
        <button onclick="wExportWeapon()"  style="${_dBtnStyle()}">📋 Export Code</button>
        <button onclick="wImportWeapon()"  style="${_dBtnStyle('#cc88ff')}">↓ Import</button>
      </div>
      <div id="dSavedWeaponsList" style="display:flex;flex-direction:column;gap:4px;max-height:120px;overflow-y:auto;margin-top:4px;"></div>
    </div>
  </div>`;

  document.body.appendChild(panel);
  _dMakeDraggable(panel, document.getElementById('dDragHandle'));
}

// Helper style builders (avoids repeating inline CSS)
function _dTabBtnStyle(active) {
  return `background:${active ? 'rgba(80,160,255,0.25)' : 'rgba(255,255,255,0.07)'};
    border:1px solid ${active ? 'rgba(80,160,255,0.55)' : 'rgba(255,255,255,0.15)'};
    color:${active ? '#88ccff' : '#aab'};border-radius:7px;padding:3px 14px;
    cursor:pointer;font-size:0.8rem;font-family:inherit;`;
}
function _dBtnStyle(accentColor, isActive) {
  const c = accentColor || 'rgba(255,255,255,0.7)';
  return `background:${isActive ? 'rgba(68,255,136,0.16)' : 'rgba(255,255,255,0.06)'};
    border:1px solid ${isActive ? c : 'rgba(255,255,255,0.14)'};
    color:${isActive ? c : '#bbc'};border-radius:6px;padding:3px 10px;cursor:pointer;
    font-size:0.76rem;font-family:inherit;transition:background 0.12s;`;
}
function _dInputStyle() {
  return `background:#0c0c22;color:#ccd;border:1px solid rgba(100,180,255,0.22);
    border-radius:5px;padding:4px 8px;font-size:0.78rem;font-family:inherit;outline:none;`;
}
function _dSelectStyle() {
  return `background:#0c0c22;color:#ccd;border:1px solid rgba(100,180,255,0.22);
    border-radius:5px;padding:4px 8px;font-size:0.78rem;font-family:inherit;outline:none;cursor:pointer;`;
}

// Make element draggable via a handle
function _dMakeDraggable(el, handle) {
  let ox = 0, oy = 0, sx = 0, sy = 0;
  handle.addEventListener('mousedown', (e) => {
    if (e.target.tagName === 'BUTTON' || e.target.tagName === 'SELECT') return;
    e.preventDefault();
    sx = e.clientX; sy = e.clientY;
    const rect = el.getBoundingClientRect();
    ox = rect.left; oy = rect.top;
    el.style.left      = ox + 'px';
    el.style.top       = oy + 'px';
    el.style.transform = 'none';
    handle.style.cursor = 'grabbing';
    const onMove = (e) => {
      el.style.left = Math.max(0, Math.min(window.innerWidth  - 80, ox + e.clientX - sx)) + 'px';
      el.style.top  = Math.max(0, Math.min(window.innerHeight - 40, oy + e.clientY - sy)) + 'px';
    };
    const onUp = () => {
      handle.style.cursor = 'grab';
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup',   onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup',   onUp);
  });
}

function openDesigner() {
  _dBuildOverlay(); // build DOM if first open
  const ov = document.getElementById('designerOverlay');
  ov.style.display = 'flex';
  // Re-center on open (in case it was dragged previously)
  if (ov.style.transform !== 'none') {
    ov.style.left      = '50%';
    ov.style.top       = '5vh';
    ov.style.transform = 'translateX(-50%)';
  }
  _dCanvas = document.getElementById('designerCanvas');
  _dCtx    = _dCanvas.getContext('2d');
  _dSetupCanvasEvents();
  _dLoadSaved();
  _wRefreshList();
  _dStartPreviewLoop();
  designerTab('map');
  wSync(); // init weapon preview
}

function closeDesigner() {
  const ov = document.getElementById('designerOverlay');
  if (ov) ov.style.display = 'none';
  if (_dAnimId) { cancelAnimationFrame(_dAnimId); _dAnimId = null; }
}

// ── In-game Training Mode Designer ───────────────────────────
// A compact live-edit panel that appears while the game runs.
// All platform changes update currentArena.platforms in real time.
// Human player gets godmode + free flight while open.

let _tdSelectedIdx = -1; // selected platform index in live editor

function openTrainingDesigner() {
  if (!trainingMode && gameMode !== 'training') {
    _dToast('Training designer only available in Training mode');
    return;
  }
  trainingDesignerOpen = true;
  _tdSelectedIdx = -1;
  let existing = document.getElementById('_tdPanel');
  if (existing) { existing.style.display = 'flex'; _tdRefreshList(); return; }

  const panel = document.createElement('div');
  panel.id = '_tdPanel';
  panel.style.cssText = `
    position:fixed;top:12px;right:12px;width:260px;background:rgba(8,8,22,0.93);
    border:1.5px solid rgba(100,200,255,0.35);border-radius:12px;padding:12px 14px 14px;
    font-family:'Segoe UI',Arial,sans-serif;color:#ccd;font-size:0.8rem;
    z-index:1500;box-shadow:0 4px 30px rgba(0,0,80,0.7);display:flex;
    flex-direction:column;gap:8px;user-select:none;`;

  panel.innerHTML = `
    <div id="_tdDragHandle" style="display:flex;align-items:center;justify-content:space-between;
      cursor:move;padding-bottom:6px;border-bottom:1px solid rgba(100,200,255,0.15);">
      <span style="font-weight:700;font-size:0.85rem;color:#88ccff;">🛠 Live Map Editor</span>
      <div style="display:flex;gap:5px;">
        <span style="font-size:0.65rem;opacity:0.55;align-self:center;">✦ Godmode+Flight ON</span>
        <button onclick="closeTrainingDesigner()"
          style="background:rgba(255,60,60,0.18);border:1px solid rgba(255,80,80,0.4);
          color:#ff8888;border-radius:6px;padding:2px 8px;cursor:pointer;font-size:0.78rem;">✕</button>
      </div>
    </div>

    <div style="display:flex;gap:6px;flex-wrap:wrap;">
      <button onclick="_tdAddPlatform()" style="${_dBtnStyle('#44ff88')}">+ Add Platform</button>
      <button onclick="_tdDeleteSelected()" style="${_dBtnStyle('#ff4455')}">🗑 Delete</button>
      <button onclick="_tdToggleSnap()" id="_tdSnapBtn" style="${_dBtnStyle('#ffcc44')}">Snap: ON</button>
    </div>

    <div style="font-size:0.72rem;opacity:0.6;">Click canvas to add · Drag to move · Select to edit</div>

    <div id="_tdEditRow" style="display:none;gap:6px;flex-direction:column;">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">
        <label>X <input id="_tdX" type="number" oninput="_tdUpdateSelected()" style="${_dInputStyle()}" step="1"></label>
        <label>Y <input id="_tdY" type="number" oninput="_tdUpdateSelected()" style="${_dInputStyle()}" step="1"></label>
        <label>W <input id="_tdW" type="number" oninput="_tdUpdateSelected()" style="${_dInputStyle()}" step="1"></label>
        <label>H <input id="_tdH" type="number" oninput="_tdUpdateSelected()" style="${_dInputStyle()}" step="1"></label>
      </div>
    </div>

    <div id="_tdList" style="display:flex;flex-direction:column;gap:3px;max-height:150px;overflow-y:auto;"></div>

    <div style="display:flex;gap:6px;flex-wrap:wrap;border-top:1px solid rgba(100,200,255,0.12);padding-top:8px;">
      <button onclick="_tdExport()" style="${_dBtnStyle()}">📋 Export</button>
      <button onclick="_tdImport()" style="${_dBtnStyle('#cc88ff')}">↓ Import</button>
      <button onclick="_tdApplyPreset('arena')" style="${_dBtnStyle('#88aaff')}">Reset Default</button>
    </div>`;

  document.body.appendChild(panel);
  _dMakeDraggable(panel, document.getElementById('_tdDragHandle'));

  // Click on game canvas to place platform
  canvas.addEventListener('click', _tdCanvasClick);
  _tdRefreshList();
}

function closeTrainingDesigner() {
  trainingDesignerOpen = false;
  _tdSelectedIdx = -1;
  const panel = document.getElementById('_tdPanel');
  if (panel) panel.style.display = 'none';
  canvas.removeEventListener('click', _tdCanvasClick);
}

let _tdSnap = true;
const _TD_SNAP = 20;

function _tdSnapV(v) { return _tdSnap ? Math.round(v / _TD_SNAP) * _TD_SNAP : Math.round(v); }
function _tdToggleSnap() {
  _tdSnap = !_tdSnap;
  const btn = document.getElementById('_tdSnapBtn');
  if (btn) btn.textContent = `Snap: ${_tdSnap ? 'ON' : 'OFF'}`;
}

function _tdScreenToGame(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  // Convert CSS pixels → canvas pixels
  const canvasPx = (clientX - rect.left) * (canvas.width  / rect.width);
  const canvasPy = (clientY - rect.top)  * (canvas.height / rect.height);
  // Invert the current camera transform (setTransform(scX,0,0,scY,tx,ty))
  const m = ctx.getTransform();
  return {
    x: (canvasPx - m.e) / m.a,
    y: (canvasPy - m.f) / m.d,
  };
}

function _tdCanvasClick(e) {
  if (!trainingDesignerOpen || !currentArena) return;
  // Only place if not clicking in the panel area
  if (e.clientX > window.innerWidth - 280 && e.clientY < 500) return;
  const gp = _tdScreenToGame(e.clientX, e.clientY);
  // Center the new platform on the cursor
  const gx = _tdSnapV(gp.x - 60);
  const gy = _tdSnapV(gp.y - 8);
  currentArena.platforms.push({ x: gx, y: gy, w: 120, h: 16 });
  _tdSelectedIdx = currentArena.platforms.length - 1;
  _tdRefreshList();
  _tdFillEdit();
}

function _tdRefreshList() {
  const list = document.getElementById('_tdList');
  if (!list || !currentArena) return;
  list.innerHTML = currentArena.platforms.map((pl, i) => {
    const active = i === _tdSelectedIdx;
    return `<div onclick="_tdSelect(${i})" style="padding:3px 6px;border-radius:5px;cursor:pointer;
      background:${active ? 'rgba(100,200,255,0.18)' : 'rgba(255,255,255,0.04)'};
      border:1px solid ${active ? 'rgba(100,200,255,0.5)' : 'rgba(255,255,255,0.08)'};
      font-size:0.72rem;color:${pl.isFloor ? '#ffcc44' : '#aabbcc'};">
      ${pl.isFloor ? '⚓ Floor' : `P${i}`} &nbsp;
      <span style="opacity:0.6;">(${Math.round(pl.x)},${Math.round(pl.y)}) ${Math.round(pl.w)}×${Math.round(pl.h)}</span>
    </div>`;
  }).join('');
}

function _tdSelect(idx) {
  _tdSelectedIdx = idx;
  _tdRefreshList();
  _tdFillEdit();
}

function _tdFillEdit() {
  const row = document.getElementById('_tdEditRow');
  if (!row || !currentArena) return;
  const pl = currentArena.platforms[_tdSelectedIdx];
  if (!pl) { row.style.display = 'none'; return; }
  row.style.display = 'flex';
  document.getElementById('_tdX').value = Math.round(pl.x);
  document.getElementById('_tdY').value = Math.round(pl.y);
  document.getElementById('_tdW').value = Math.round(pl.w);
  document.getElementById('_tdH').value = Math.round(pl.h);
}

function _tdUpdateSelected() {
  if (!currentArena || _tdSelectedIdx < 0) return;
  const pl = currentArena.platforms[_tdSelectedIdx];
  if (!pl) return;
  const v = id => parseFloat(document.getElementById(id)?.value) || 0;
  pl.x = v('_tdX'); pl.y = v('_tdY'); pl.w = v('_tdW'); pl.h = v('_tdH');
  _tdRefreshList();
}

function _tdAddPlatform() {
  if (!currentArena) return;
  currentArena.platforms.push({ x: 200, y: 300, w: 120, h: 16 });
  _tdSelectedIdx = currentArena.platforms.length - 1;
  _tdRefreshList();
  _tdFillEdit();
}

function _tdDeleteSelected() {
  if (!currentArena || _tdSelectedIdx < 0) return;
  const pl = currentArena.platforms[_tdSelectedIdx];
  if (pl && pl.isFloor) { _dToast('Cannot delete the floor'); return; }
  currentArena.platforms.splice(_tdSelectedIdx, 1);
  _tdSelectedIdx = -1;
  _tdRefreshList();
  document.getElementById('_tdEditRow').style.display = 'none';
}

function _tdExport() {
  if (!currentArena) return;
  const exportable = currentArena.platforms.map(pl => ({ x: pl.x, y: pl.y, w: pl.w, h: pl.h, ...(pl.isFloor ? { isFloor: true } : {}) }));
  const text = JSON.stringify(exportable, null, 2);
  _dShowExportModal(text, 'arena_platforms.json', 'Export Arena Platforms');
}

function _tdImport() {
  document.getElementById('_dImportModal')?.remove();
  // Reuse the map import modal but apply to live arena
  const modal = document.createElement('div');
  modal.id = '_dImportModal';
  modal.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,0.72);z-index:3000;
    display:flex;align-items:center;justify-content:center;`;
  modal.innerHTML = `
  <div style="background:#0c0c1e;border:1.5px solid rgba(100,200,255,0.28);border-radius:13px;
    padding:22px 24px 18px;width:min(480px,92vw);font-family:'Segoe UI',Arial,sans-serif;color:#ccd;">
    <div style="font-weight:700;font-size:0.95rem;margin-bottom:14px;">Import Platforms (Live)</div>
    <textarea id="_dImportText" rows="6" placeholder="Paste platform JSON array here…"
      style="width:100%;background:#07071a;color:#bdc;border:1px solid rgba(100,200,255,0.2);
      border-radius:7px;padding:8px;font-family:monospace;font-size:0.72rem;
      resize:vertical;box-sizing:border-box;"></textarea>
    <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:12px;">
      <button onclick="document.getElementById('_dImportModal').remove()"
        style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.18);
        color:#bbc;border-radius:7px;padding:6px 16px;cursor:pointer;font-family:inherit;font-size:0.8rem;">
        Cancel
      </button>
      <button onclick="_tdImportFromText()" style="${_dModalBtnStyle('#88ff44')}">Apply Live</button>
    </div>
  </div>`;
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
}

function _tdImportFromText() {
  const text = document.getElementById('_dImportText')?.value?.trim();
  document.getElementById('_dImportModal')?.remove();
  if (!text || !currentArena) return;
  try {
    const arr = JSON.parse(text);
    if (!Array.isArray(arr)) throw new Error('Expected array');
    currentArena.platforms = arr;
    _tdSelectedIdx = -1;
    _tdRefreshList();
    _dToast(`Applied ${arr.length} platforms to live arena`);
  } catch { _dToast('Invalid JSON'); }
}

function _tdApplyPreset(name) {
  if (!currentArena) return;
  // Re-randomize the layout for the current arena key (restores defaults)
  if (typeof randomizeArenaLayout === 'function') randomizeArenaLayout(currentArenaKey);
  _tdSelectedIdx = -1;
  _tdRefreshList();
  _dToast('Reset to default platforms');
}

function _dInputStyle() {
  return `width:100%;background:#07071a;color:#bdc;border:1px solid rgba(100,200,255,0.2);
    border-radius:5px;padding:4px 6px;font-family:monospace;font-size:0.75rem;box-sizing:border-box;`;
}

function designerTab(tab) {
  const mp = document.getElementById('designerMapPanel');
  const wp = document.getElementById('designerWeaponPanel');
  const tm = document.getElementById('dTabMap');
  const tw = document.getElementById('dTabWeapon');
  if (mp) mp.style.display = tab === 'map'    ? 'flex'   : 'none';
  if (wp) wp.style.display = tab === 'weapon' ? 'flex'   : 'none';
  if (tm) { tm.style.background = tab === 'map'    ? 'rgba(80,160,255,0.25)' : 'rgba(255,255,255,0.07)';
            tm.style.borderColor= tab === 'map'    ? 'rgba(80,160,255,0.55)' : 'rgba(255,255,255,0.15)';
            tm.style.color      = tab === 'map'    ? '#88ccff' : '#aab'; }
  if (tw) { tw.style.background = tab === 'weapon' ? 'rgba(80,160,255,0.25)' : 'rgba(255,255,255,0.07)';
            tw.style.borderColor= tab === 'weapon' ? 'rgba(80,160,255,0.55)' : 'rgba(255,255,255,0.15)';
            tw.style.color      = tab === 'weapon' ? '#88ccff' : '#aab'; }
  if (tab === 'weapon') _wDraw();
}

// ---- BASE ARENA CHANGE ----
function designerChangeBase() {
  _dBaseArena = document.getElementById('dBaseArena').value;
  _dPlatforms = [];
  _dSelected  = null;
  _dHistory   = [];
  // Pre-populate with the selected arena's platforms as starting points
  if (typeof ARENAS !== 'undefined' && ARENAS[_dBaseArena]) {
    ARENAS[_dBaseArena].platforms.forEach(pl => {
      _dPlatforms.push({ x: pl.x, y: pl.y, w: pl.w, h: pl.h || 14,
        isFloor: !!pl.isFloor, oscX: pl.oscX || 0, oscY: pl.oscY || 0,
        ox: pl.ox || pl.x, oy: pl.oy || pl.y });
    });
  }
}

// ---- PLATFORM TOOLS ----
function designerAddPlatform() {
  _dHistory.push(JSON.stringify(_dPlatforms));
  _dPlatforms.push({ x: 300, y: 200, w: 120, h: 14, isFloor: false, oscX: 0, oscY: 0 });
  _dSelected = _dPlatforms.length - 1;
  _dSyncControls();
}

function designerClearPlatforms() {
  _dHistory.push(JSON.stringify(_dPlatforms));
  _dPlatforms = [];
  _dSelected  = null;
}

function designerUndo() {
  if (_dHistory.length === 0) return;
  _dPlatforms = JSON.parse(_dHistory.pop());
  _dSelected  = null;
}

function designerUpdateSelected() {
  if (_dSelected === null || !_dPlatforms[_dSelected]) return;
  const pl = _dPlatforms[_dSelected];
  pl.w     = parseInt(document.getElementById('dPlatW').value);
  pl.h     = parseInt(document.getElementById('dPlatH').value);
  pl.isFloor = document.getElementById('dPlatFloor').checked;
  const moving = document.getElementById('dPlatMoving').checked;
  pl.oscX  = moving ? 60 : 0;
  pl.oscY  = 0;
  if (!pl.ox) { pl.ox = pl.x; pl.oy = pl.y; }
}

function _dSyncControls() {
  const pl = _dSelected !== null ? _dPlatforms[_dSelected] : null;
  document.getElementById('dPlatW').value       = pl ? pl.w : 120;
  document.getElementById('dPlatH').value       = pl ? pl.h : 14;
  document.getElementById('dPlatFloor').checked  = pl ? !!pl.isFloor : false;
  document.getElementById('dPlatMoving').checked = pl ? (pl.oscX > 0) : false;
}

// ---- HAZARD TOGGLES ----
function designerToggleHazard(h) {
  if (_dHazards.has(h)) _dHazards.delete(h);
  else _dHazards.add(h);
  // Update button visual
  document.querySelectorAll('.d-hazard-btn').forEach(btn => {
    const key = btn.getAttribute('onclick').match(/'([^']+)'/)?.[1];
    if (key) btn.classList.toggle('active', _dHazards.has(key));
  });
}

function designerSyncMeta() {
  _dMeta.name    = document.getElementById('dMapName').value || 'My Map';
  _dMeta.hasLava = document.getElementById('dHasLava').checked;
  _dMeta.skyColor = document.getElementById('dSkyColor').value;
}

// ---- CANVAS EVENTS ----
function _dSetupCanvasEvents() {
  const cv = _dCanvas;
  // Scale canvas coords from CSS to logical GAME dimensions (900×520)
  const _toGame = (cx, cy) => {
    const r = cv.getBoundingClientRect();
    return { x: (cx - r.left) / r.width * 900, y: (cy - r.top) / r.height * 520 };
  };

  // Returns which resize handle is under cursor ('e','w','se','sw', or null)
  const _getHandleAt = (x, y) => {
    if (_dSelected === null) return null;
    const pl = _dPlatforms[_dSelected];
    const sx = cv.width  / 900, sy = cv.height / 520;
    const hSize = 10 / sx; // handle hit-zone in game coords
    const checks = [
      { dir: 'e',  hx: pl.x + pl.w, hy: pl.y + pl.h / 2 },
      { dir: 'w',  hx: pl.x,        hy: pl.y + pl.h / 2 },
      { dir: 's',  hx: pl.x + pl.w / 2, hy: pl.y + pl.h },
      { dir: 'se', hx: pl.x + pl.w, hy: pl.y + pl.h },
      { dir: 'sw', hx: pl.x,        hy: pl.y + pl.h },
    ];
    for (const c of checks) {
      if (Math.abs(x - c.hx) < hSize && Math.abs(y - c.hy) < hSize) return c.dir;
    }
    return null;
  };

  cv.onmousedown = (e) => {
    e.preventDefault();
    const { x, y } = _toGame(e.clientX, e.clientY);
    if (e.button === 2) {
      const idx = _dPlatforms.findIndex(pl => x >= pl.x && x <= pl.x + pl.w && y >= pl.y && y <= pl.y + pl.h);
      if (idx >= 0) { _dHistory.push(JSON.stringify(_dPlatforms)); _dPlatforms.splice(idx, 1); _dSelected = null; }
      return;
    }
    // Check resize handle first
    const handle = _getHandleAt(x, y);
    if (handle && _dSelected !== null) {
      _dResizing  = true;
      _dResizeDir = handle;
      _dDragOffX  = x;
      _dDragOffY  = y;
      return;
    }
    // Select or add platform
    const idx = _dPlatforms.findIndex(pl => x >= pl.x && x <= pl.x + pl.w && y >= pl.y && y <= pl.y + pl.h);
    if (idx >= 0) {
      _dSelected  = idx;
      _dDragging  = true;
      _dDragOffX  = x - _dPlatforms[idx].x;
      _dDragOffY  = y - _dPlatforms[idx].y;
      _dSyncControls();
    } else {
      _dHistory.push(JSON.stringify(_dPlatforms));
      const pw = parseInt(document.getElementById('dPlatW').value) || 120;
      const ph = parseInt(document.getElementById('dPlatH').value) || 14;
      const nx = _dSnapVal(x - pw / 2), ny = _dSnapVal(y);
      _dPlatforms.push({ x: nx, y: ny, w: pw, h: ph, isFloor: false, oscX: 0, oscY: 0 });
      _dSelected = _dPlatforms.length - 1;
      _dDragging  = true;
      _dDragOffX  = pw / 2;
      _dDragOffY  = ph / 2;
      _dSyncControls();
    }
  };

  cv.onmousemove = (e) => {
    const { x, y } = _toGame(e.clientX, e.clientY);
    if (_dResizing && _dSelected !== null) {
      const pl = _dPlatforms[_dSelected];
      const dx = x - _dDragOffX, dy = y - _dDragOffY;
      _dDragOffX = x; _dDragOffY = y;
      if (_dResizeDir.includes('e')) pl.w = Math.max(20, pl.w + dx);
      if (_dResizeDir.includes('w')) { pl.x = _dSnapVal(pl.x + dx); pl.w = Math.max(20, pl.w - dx); }
      if (_dResizeDir.includes('s')) pl.h = Math.max(8, pl.h + dy);
      document.getElementById('dPlatW').value = Math.round(pl.w);
      document.getElementById('dPlatH').value = Math.round(pl.h);
      return;
    }
    if (!_dDragging || _dSelected === null) {
      // Update cursor style based on handle proximity
      const handle = _getHandleAt(x, y);
      cv.style.cursor = handle ? (handle === 'e' || handle === 'w' ? 'ew-resize' : handle === 's' ? 'ns-resize' : 'nwse-resize') : 'crosshair';
      return;
    }
    const pl = _dPlatforms[_dSelected];
    pl.x = _dSnapVal(x - _dDragOffX);
    pl.y = _dSnapVal(y - _dDragOffY);
  };

  const _stopDrag = () => { _dDragging = false; _dResizing = false; _dResizeDir = null; };
  cv.onmouseup    = _stopDrag;
  cv.onmouseleave = _stopDrag;
  cv.oncontextmenu = (e) => e.preventDefault();

  // Scroll wheel: resize selected platform width
  cv.onwheel = (e) => {
    e.preventDefault();
    if (_dSelected === null) return;
    const pl = _dPlatforms[_dSelected];
    pl.w = Math.max(30, Math.min(450, pl.w - Math.sign(e.deltaY) * _D_SNAP));
    document.getElementById('dPlatW').value = pl.w;
  };
}

// ---- PREVIEW LOOP (draws editor canvas) ----
function _dStartPreviewLoop() {
  const loop = () => {
    const ov = document.getElementById('designerOverlay');
    if (!ov || ov.style.display === 'none') { _dAnimId = null; return; }
    _dAnimId = requestAnimationFrame(loop);
    _dDrawEditor();
  };
  if (_dAnimId) cancelAnimationFrame(_dAnimId);
  _dAnimId = requestAnimationFrame(loop);
}

function _dDrawEditor() {
  const cv = _dCanvas;
  if (!cv) return;
  const dc = _dCtx;
  const W = 900, H = 520;

  dc.clearRect(0, 0, cv.width, cv.height);

  // Sky gradient
  const sky = dc.createLinearGradient(0, 0, 0, cv.height);
  sky.addColorStop(0, _dMeta.skyColor || '#0d0d1e');
  sky.addColorStop(1, '#1a1a2e');
  dc.fillStyle = sky;
  dc.fillRect(0, 0, cv.width, cv.height);

  const sx = cv.width / W, sy = cv.height / H;

  // Lava hint at bottom
  if (_dHazards.has('lava') || _dMeta.hasLava) {
    dc.fillStyle = 'rgba(255,80,0,0.25)';
    dc.fillRect(0, cv.height - cv.height * 0.07, cv.width, cv.height * 0.07);
    dc.fillStyle = '#ff6600';
    dc.fillRect(0, cv.height - 3, cv.width, 3);
  }

  // Grid — fine when snap active (20 units), coarse otherwise
  const gridUnits = _dSnapGrid ? _D_SNAP : 45;
  const gridAlpha = _dSnapGrid ? 0.07 : 0.04;
  dc.strokeStyle = `rgba(255,255,255,${gridAlpha})`;
  dc.lineWidth = 0.5;
  for (let x = 0; x < cv.width; x += gridUnits * sx) { dc.beginPath(); dc.moveTo(x,0); dc.lineTo(x,cv.height); dc.stroke(); }
  for (let y = 0; y < cv.height; y += gridUnits * sy) { dc.beginPath(); dc.moveTo(0,y); dc.lineTo(cv.width,y); dc.stroke(); }

  // Ceiling line
  const ceilY = _dHazards.has('lowgrav') ? (cv.height * 0.3) : (cv.height * 0.05);
  dc.strokeStyle = 'rgba(100,200,255,0.3)';
  dc.setLineDash([6,4]);
  dc.lineWidth = 1.5;
  dc.beginPath(); dc.moveTo(0, ceilY); dc.lineTo(cv.width, ceilY); dc.stroke();
  dc.setLineDash([]);
  dc.fillStyle = 'rgba(100,200,255,0.5)';
  dc.font = '10px Arial';
  dc.fillText('ceiling', 6, ceilY - 3);

  // Platforms
  _dPlatforms.forEach((pl, i) => {
    const px = pl.x * sx, py = pl.y * sy, pw = pl.w * sx, ph = (pl.h || 14) * sy;
    const isSelected = i === _dSelected;

    // Shadow
    dc.fillStyle = 'rgba(0,0,0,0.4)';
    dc.fillRect(px + 2, py + 2, pw, ph);

    // Platform body
    if (pl.isFloor) {
      dc.fillStyle = isSelected ? '#88ff88' : '#446644';
    } else {
      dc.fillStyle = isSelected ? '#aaddff' : '#334466';
    }
    dc.fillRect(px, py, pw, ph);

    // Shimmer edge
    dc.fillStyle = isSelected ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.18)';
    dc.fillRect(px, py, pw, 2);

    // Oscillating indicator
    if (pl.oscX > 0 || pl.oscY > 0) {
      dc.strokeStyle = '#ffcc44';
      dc.lineWidth   = 1.5;
      dc.setLineDash([4, 3]);
      dc.beginPath();
      dc.moveTo(px - pl.oscX * sx, py); dc.lineTo(px + pw + pl.oscX * sx, py);
      dc.stroke();
      dc.setLineDash([]);
    }

    // Selected: outline + functional resize handles
    if (isSelected) {
      dc.strokeStyle = '#88ff44';
      dc.lineWidth   = 2;
      dc.strokeRect(px - 1, py - 1, pw + 2, ph + 2);
      // Resize handles: east, west, south, se, sw corners
      const handles = [
        { hx: px + pw,      hy: py + ph/2, dir: 'e'  },
        { hx: px,           hy: py + ph/2, dir: 'w'  },
        { hx: px + pw/2,    hy: py + ph,   dir: 's'  },
        { hx: px + pw,      hy: py + ph,   dir: 'se' },
        { hx: px,           hy: py + ph,   dir: 'sw' },
      ];
      handles.forEach(h => {
        dc.fillStyle = h.dir === 'e' || h.dir === 'w' ? '#44aaff' : '#88ff44';
        dc.fillRect(h.hx - 5, h.hy - 5, 10, 10);
        dc.strokeStyle = 'rgba(0,0,0,0.5)'; dc.lineWidth = 1;
        dc.strokeRect(h.hx - 5, h.hy - 5, 10, 10);
      });
      // Size label
      dc.fillStyle = 'rgba(255,255,255,0.55)';
      dc.font      = '9px Arial';
      dc.textAlign = 'center';
      dc.fillText(`${Math.round(pl.w)}×${Math.round(pl.h)}`, px + pw/2, py - 5);
      dc.textAlign = 'left';
    }
  });

  // Hazard overlays
  if (_dHazards.has('fog')) {
    dc.fillStyle = 'rgba(180,180,220,0.12)';
    dc.fillRect(0, 0, cv.width, cv.height);
    dc.fillStyle = 'rgba(180,180,220,0.6)';
    dc.font = 'bold 11px Arial';
    dc.textAlign = 'center';
    dc.fillText('🌫 FOG ACTIVE', cv.width / 2, 20);
    dc.textAlign = 'left';
  }
  if (_dHazards.has('wind')) {
    for (let i = 0; i < 5; i++) {
      const wx = ((Date.now() / 8 + i * 160) % cv.width);
      dc.strokeStyle = 'rgba(150,200,255,0.25)';
      dc.lineWidth   = 1;
      dc.beginPath(); dc.moveTo(wx, 60 + i * 70); dc.lineTo(wx + 50, 60 + i * 70); dc.stroke();
    }
  }

  // NPC spawn hints
  if (_dHazards.has('npc_beast')) {
    dc.fillStyle = 'rgba(100,200,0,0.7)';
    dc.font = '14px Arial';
    dc.fillText('🐺', cv.width * 0.65, cv.height * 0.5);
    dc.fillStyle = 'rgba(100,200,0,0.4)';
    dc.font = '9px Arial';
    dc.fillText('Forest Beast spawn', cv.width * 0.63, cv.height * 0.5 + 14);
  }
  if (_dHazards.has('npc_yeti')) {
    dc.fillStyle = 'rgba(180,240,255,0.7)';
    dc.font = '14px Arial';
    dc.fillText('❄', cv.width * 0.35, cv.height * 0.5);
    dc.fillStyle = 'rgba(180,240,255,0.4)';
    dc.font = '9px Arial';
    dc.fillText('Yeti spawn', cv.width * 0.32, cv.height * 0.5 + 14);
  }

  // Info overlay
  dc.fillStyle = 'rgba(255,255,255,0.35)';
  dc.font = '10px Arial';
  dc.textAlign = 'right';
  dc.fillText(`Platforms: ${_dPlatforms.length}  |  Selected: ${_dSelected !== null ? _dSelected : 'none'}`, cv.width - 6, cv.height - 6);
  dc.textAlign = 'left';
}

// ---- PREVIEW IN GAME ----
function designerPreview() {
  designerSyncMeta();
  if (typeof ARENAS === 'undefined') { alert('Open the game first (ARENAS not loaded).'); return; }
  // Build a custom arena object and inject it
  const base = (ARENAS[_dBaseArena] || ARENAS['grass']);
  const customArena = Object.assign({}, base, {
    name:       _dMeta.name,
    sky:        [_dMeta.skyColor, '#1a1a2e'],
    hasLava:    _dMeta.hasLava || _dHazards.has('lava'),
    isLowGravity:   _dHazards.has('lowgrav'),
    isHeavyGravity: _dHazards.has('heavygrav'),
    isIcy:          _dHazards.has('ice'),
    platforms:  _dPlatforms.length > 0 ? _dPlatforms.map(pl => ({
      x: pl.x, y: pl.y, w: pl.w, h: pl.h || 14,
      isFloor: pl.isFloor,
      oscX: pl.oscX || 0, oscY: pl.oscY || 0,
      ox: pl.x, oy: pl.y,
    })) : base.platforms,
  });
  const _customKey  = '_custom_' + (_dMeta.name || 'custom').replace(/\s+/g,'_').toLowerCase();
  ARENAS[_customKey] = customArena;
  ARENAS['_custom']  = customArena; // always keep generic key for backwards compat
  currentArenaKey    = _customKey;
  currentArena       = customArena;
  if (typeof generateBgElements === 'function') generateBgElements();
  // Inject into the arena dropdown so the player can select it like a normal map
  _dInjectArenaOption(_customKey, '🗺 ' + (_dMeta.name || 'Custom Map'));
  closeDesigner();
  if (typeof selectMode === 'function') selectMode('2p');
  if (typeof selectArena === 'function') selectArena(_customKey);
  _dToast(`Map "${_dMeta.name}" ready — selected in arena list!`);
}

// ---- SAVE / LOAD / EXPORT ----
function designerSave() {
  designerSyncMeta();
  const saves = _dGetSaves();
  const key   = Date.now().toString();
  saves[key]  = { meta: _dMeta, platforms: _dPlatforms, hazards: [..._dHazards], base: _dBaseArena };
  localStorage.setItem('smc_custom_maps', JSON.stringify(saves));
  _dLoadSaved();
  alert(`Map "${_dMeta.name}" saved!`);
}

function designerLoad() {
  const panel = document.getElementById('dSavedMaps');
  if (panel) panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
}

function _dLoadSaved() {
  const saves = _dGetSaves();
  const list  = document.getElementById('dSavedMapsList');
  if (!list) return;
  list.innerHTML = '';
  Object.entries(saves).forEach(([k, v]) => {
    const row = document.createElement('div');
    row.className = 'd-saved-entry';
    row.innerHTML = `<span>${v.meta.name}</span>
      <div><button onclick="_dApplySave('${k}')">Load</button><button onclick="_dDeleteSave('${k}')">✕</button></div>`;
    list.appendChild(row);
  });
  const panel = document.getElementById('dSavedMaps');
  if (panel && Object.keys(saves).length > 0) panel.style.display = 'block';
}

function _dGetSaves() {
  try { return JSON.parse(localStorage.getItem('smc_custom_maps') || '{}'); } catch { return {}; }
}

function _dApplySave(key) {
  const saves = _dGetSaves();
  const s     = saves[key];
  if (!s) return;
  _dMeta      = s.meta;
  _dPlatforms = s.platforms || [];
  _dHazards   = new Set(s.hazards || []);
  _dBaseArena = s.base || 'grass';
  document.getElementById('dBaseArena').value  = _dBaseArena;
  document.getElementById('dMapName').value    = _dMeta.name;
  document.getElementById('dHasLava').checked  = _dMeta.hasLava;
  document.getElementById('dSkyColor').value   = _dMeta.skyColor;
  _dSelected = null;
  // Sync hazard buttons
  document.querySelectorAll('.d-hazard-btn').forEach(btn => {
    const k = btn.getAttribute('onclick').match(/'([^']+)'/)?.[1];
    if (k) btn.classList.toggle('active', _dHazards.has(k));
  });
}

function _dDeleteSave(key) {
  const saves = _dGetSaves();
  delete saves[key];
  localStorage.setItem('smc_custom_maps', JSON.stringify(saves));
  _dLoadSaved();
}

// ── Export / Import modal ────────────────────────────────────
function designerExport() {
  designerSyncMeta();
  const obj  = { meta: _dMeta, platforms: _dPlatforms, hazards: [..._dHazards], base: _dBaseArena };
  const text = JSON.stringify(obj, null, 2);
  const name = (_dMeta.name || 'map').replace(/\s+/g, '_');
  _dShowExportModal(text, name + '.json', 'Map Export');
}

function _dShowExportModal(text, filename, title) {
  // Remove existing modal if open
  document.getElementById('_dExportModal')?.remove();

  const modal = document.createElement('div');
  modal.id = '_dExportModal';
  modal.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,0.72);z-index:3000;
    display:flex;align-items:center;justify-content:center;`;

  modal.innerHTML = `
  <div style="background:#0c0c1e;border:1.5px solid rgba(100,180,255,0.28);border-radius:13px;
    padding:22px 24px 18px;width:min(480px,92vw);box-shadow:0 6px 40px rgba(0,0,80,0.6);
    font-family:'Segoe UI',Arial,sans-serif;color:#ccd;">
    <div style="font-weight:700;font-size:0.95rem;margin-bottom:14px;">${title}</div>
    <div style="display:flex;gap:10px;margin-bottom:16px;">
      <button onclick="_dExportAsCode('${_escAttr(text)}')"
        style="flex:1;${_dModalBtnStyle('#88ccff')}">
        📋 Copy Code<br><span style="font-size:0.7rem;opacity:0.7;">Paste anywhere</span>
      </button>
      <button onclick="_dExportAsFile('${_escAttr(text)}','${_escAttr(filename)}')"
        style="flex:1;${_dModalBtnStyle('#88ff44')}">
        💾 Download File<br><span style="font-size:0.7rem;opacity:0.7;">Save as .json</span>
      </button>
    </div>
    <textarea readonly style="width:100%;height:80px;background:#07071a;color:#7a9;
      border:1px solid rgba(100,180,255,0.18);border-radius:6px;padding:8px;
      font-family:monospace;font-size:0.71rem;resize:none;box-sizing:border-box;">${_escHtml(text.slice(0,400))}…</textarea>
    <div style="display:flex;justify-content:flex-end;margin-top:12px;">
      <button onclick="document.getElementById('_dExportModal').remove()"
        style="${_dModalBtnStyle()}">Close</button>
    </div>
  </div>`;

  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
}

function _dExportAsCode(text) {
  navigator.clipboard?.writeText(text)
    .then(() => { _dToast('Copied to clipboard!'); })
    .catch(() => {
      const ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); ta.remove();
      _dToast('Copied to clipboard!');
    });
}

function _dExportAsFile(text, filename) {
  const blob = new Blob([text], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
  _dToast('File downloaded!');
}

// ── Import modal ─────────────────────────────────────────────
function designerImport() {
  document.getElementById('_dImportModal')?.remove();

  const modal = document.createElement('div');
  modal.id = '_dImportModal';
  modal.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,0.72);z-index:3000;
    display:flex;align-items:center;justify-content:center;`;

  modal.innerHTML = `
  <div style="background:#0c0c1e;border:1.5px solid rgba(100,180,255,0.28);border-radius:13px;
    padding:22px 24px 18px;width:min(480px,92vw);box-shadow:0 6px 40px rgba(0,0,80,0.6);
    font-family:'Segoe UI',Arial,sans-serif;color:#ccd;">
    <div style="font-weight:700;font-size:0.95rem;margin-bottom:14px;">Map Import</div>
    <div style="display:flex;gap:10px;margin-bottom:14px;">
      <label style="flex:1;${_dModalBtnStyle('#88ccff')};cursor:pointer;text-align:center;display:flex;
        flex-direction:column;align-items:center;justify-content:center;">
        📁 Upload File<br><span style="font-size:0.7rem;opacity:0.7;">.json map file</span>
        <input type="file" accept=".json,.txt" onchange="_dImportFromFile(this)"
          style="position:absolute;width:1px;height:1px;opacity:0;">
      </label>
      <div style="display:flex;align-items:center;color:#556;font-size:0.8rem;">or</div>
      <div style="flex:2;display:flex;flex-direction:column;gap:6px;">
        <span style="font-size:0.72rem;color:#889;">Paste code:</span>
        <textarea id="_dImportText" rows="4" placeholder="Paste map JSON here…"
          style="background:#07071a;color:#7a9;border:1px solid rgba(100,180,255,0.18);
          border-radius:6px;padding:8px;font-family:monospace;font-size:0.71rem;
          resize:vertical;width:100%;box-sizing:border-box;"></textarea>
      </div>
    </div>
    <div style="display:flex;gap:8px;justify-content:flex-end;">
      <button onclick="document.getElementById('_dImportModal').remove()"
        style="${_dModalBtnStyle()}">Cancel</button>
      <button onclick="_dImportFromText()" style="${_dModalBtnStyle('#88ff44')}">Import Code</button>
    </div>
  </div>`;

  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
}

function _dImportFromFile(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    _dApplyImportJSON(e.target.result);
    document.getElementById('_dImportModal')?.remove();
  };
  reader.readAsText(file);
}

function _dImportFromText() {
  const text = document.getElementById('_dImportText')?.value?.trim();
  if (!text) return;
  _dApplyImportJSON(text);
  document.getElementById('_dImportModal')?.remove();
}

function _dApplyImportJSON(text) {
  try {
    const s = JSON.parse(text);
    if (!s || !s.platforms) { _dToast('Invalid map data — missing platforms.', true); return; }
    _dHistory.push(JSON.stringify(_dPlatforms));
    _dMeta      = s.meta      || _dMeta;
    _dPlatforms = s.platforms || [];
    _dHazards   = new Set(s.hazards || []);
    _dBaseArena = s.base      || 'grass';
    // Sync controls
    const dba = document.getElementById('dBaseArena'); if (dba) dba.value = _dBaseArena;
    const dmn = document.getElementById('dMapName');   if (dmn) dmn.value = _dMeta.name || 'My Map';
    const dhl = document.getElementById('dHasLava');   if (dhl) dhl.checked = !!_dMeta.hasLava;
    const dsc = document.getElementById('dSkyColor');  if (dsc) dsc.value = _dMeta.skyColor || '#0d0d1e';
    document.querySelectorAll('.d-hazard-btn').forEach(btn => {
      const k = btn.getAttribute('onclick')?.match(/'([^']+)'/)?.[1];
      if (k) btn.classList.toggle('active', _dHazards.has(k));
    });
    _dSelected = null;
    _dToast(`Imported "${_dMeta.name || 'map'}" — ${_dPlatforms.length} platforms`);
  } catch (err) {
    _dToast('Could not parse map JSON.', true);
  }
}

// Small helpers
function _dToast(msg, isError) {
  const t = document.createElement('div');
  t.textContent = msg;
  t.style.cssText = `position:fixed;bottom:24px;left:50%;transform:translateX(-50%);
    background:${isError ? 'rgba(255,60,60,0.92)' : 'rgba(60,200,120,0.92)'};
    color:#fff;padding:8px 20px;border-radius:8px;font-size:0.85rem;z-index:4000;
    pointer-events:none;font-family:'Segoe UI',Arial,sans-serif;`;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2200);
}

function _dModalBtnStyle(accent) {
  const c = accent || 'rgba(255,255,255,0.7)';
  return `background:rgba(255,255,255,0.06);border:1px solid ${accent ? c : 'rgba(255,255,255,0.18)'};
    color:${accent ? c : '#bbc'};border-radius:7px;padding:8px 16px;cursor:pointer;
    font-size:0.8rem;font-family:inherit;transition:background 0.12s;`;
}

function _escHtml(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function _escAttr(s) { return String(s).replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/\n/g,'\\n'); }

// ---- WEAPON BUILDER ----
function wSync() {
  document.getElementById('wDmgVal').textContent    = document.getElementById('wDmg').value;
  document.getElementById('wRangeVal').textContent  = document.getElementById('wRange').value;
  document.getElementById('wCoolVal').textContent   = document.getElementById('wCool').value;
  document.getElementById('wKbVal').textContent     = document.getElementById('wKb').value;
  document.getElementById('wAbilCoolVal').textContent = document.getElementById('wAbilCool').value;
  _wUpdateStatDisplay();
  _wDraw();
}

function _wUpdateStatDisplay() {
  const name   = document.getElementById('wName')?.value   || 'Custom';
  const dmg    = document.getElementById('wDmg')?.value    || 15;
  const range  = document.getElementById('wRange')?.value  || 50;
  const cool   = document.getElementById('wCool')?.value   || 30;
  const kb     = document.getElementById('wKb')?.value     || 8;
  const type   = document.getElementById('wType')?.value   || 'melee';
  const abil   = document.getElementById('wAbilEffect')?.value || 'dash';
  const el     = document.getElementById('weaponStatDisplay');
  if (!el) return;
  el.innerHTML =
    `<b style="color:#88aaff">${name}</b><br>` +
    `Damage: <span style="color:#ff8888">${dmg}</span>  ·  ` +
    `Range: <span style="color:#88aaff">${range}px</span>  ·  ` +
    `Cooldown: <span style="color:#ffcc44">${cool}f</span><br>` +
    `Knockback: <span style="color:#88ff88">${kb}</span>  ·  ` +
    `Type: <span style="color:#cc88ff">${type}</span><br>` +
    `Ability: <span style="color:#ffaa44">${abil}</span>  (CD ${document.getElementById('wAbilCool')?.value || 90}f)`;
}

// ── Weapon Visual System — modular shape-based renderer ──────
// shape → { blade, guard, handle, head, effect }
const _WEAPON_SHAPES = {
  blade:    { headW: 10, headH: 1.6, guardW: 2.2, handleLen: 0.48, headShape: 'blade' },
  dagger:   { headW: 6,  headH: 1.2, guardW: 1.6, handleLen: 0.35, headShape: 'blade' },
  hammer:   { headW: 0,  headH: 0,   guardW: 0,   handleLen: 0.55, headShape: 'hammer' },
  axe:      { headW: 0,  headH: 0,   guardW: 0,   handleLen: 0.55, headShape: 'axe' },
  spear:    { headW: 8,  headH: 2.2, guardW: 1.0, handleLen: 0.75, headShape: 'blade' },
  bow:      { headW: 0,  headH: 0,   guardW: 0,   handleLen: 0.0,  headShape: 'bow' },
  staff:    { headW: 0,  headH: 0,   guardW: 0,   handleLen: 0.65, headShape: 'orb' },
};

function _wGetShape() {
  const sel = document.getElementById('wShape');
  return sel ? sel.value : 'blade';
}

function _wDraw() {
  const cv = document.getElementById('weaponPreviewCanvas');
  if (!cv) return;
  const dc = cv.getContext('2d');
  const W  = cv.width, H = cv.height;
  dc.clearRect(0, 0, W, H);

  // Background — dark gradient with vignette
  const bg = dc.createRadialGradient(W/2, H/2, 10, W/2, H/2, W * 0.7);
  bg.addColorStop(0, '#141426');
  bg.addColorStop(1, '#06060f');
  dc.fillStyle = bg;
  dc.fillRect(0, 0, W, H);

  const type   = document.getElementById('wType')?.value   || 'melee';
  const color  = document.getElementById('wColor')?.value  || '#44aaff';
  const range  = parseInt(document.getElementById('wRange')?.value  || 50);
  const dmg    = parseInt(document.getElementById('wDmg')?.value    || 15);
  const cool   = parseInt(document.getElementById('wCool')?.value   || 30);
  const kb     = parseInt(document.getElementById('wKb')?.value     || 8);
  const shape  = _wGetShape();
  const sd     = _WEAPON_SHAPES[shape] || _WEAPON_SHAPES.blade;
  const t      = Date.now();

  // Stat-driven proportions: heavier = thicker, faster = slimmer
  const weightFactor  = Math.max(0.4, Math.min(2.2, dmg / 15));   // damage = weight proxy
  const speedFactor   = Math.max(0.5, Math.min(1.8, 30 / cool));  // cooldown inverse = speed

  const cx = W / 2, cy = H / 2;
  const weaponLen = Math.max(40, Math.min(120, range * 1.2));
  const bladeW    = Math.max(4, 10 * weightFactor * speedFactor * 0.55);

  dc.save();
  dc.translate(cx, cy + 10);
  dc.rotate(-Math.PI / 3.5);

  // ── GLOW behind weapon ───────────────────────────────────
  const glowPulse = 0.85 + Math.sin(t * 0.003) * 0.15;
  dc.shadowColor  = color;
  dc.shadowBlur   = 24 * glowPulse;

  const headShape = sd.headShape;

  if (headShape === 'blade') {
    // ── Handle ───────────────────────────────────────────────
    const handleLen = weaponLen * sd.handleLen;
    const handleW   = Math.max(4, 6 * weightFactor * 0.7);
    dc.fillStyle = '#7a5533';
    dc.beginPath();
    dc.roundRect(-handleW/2, 0, handleW, handleLen, 3);
    dc.fill();
    // Handle wrap
    dc.strokeStyle = '#4a3018';
    dc.lineWidth   = 2;
    for (let i = 6; i < handleLen - 6; i += 7) {
      dc.beginPath(); dc.moveTo(-handleW/2, i); dc.lineTo(handleW/2, i); dc.stroke();
    }

    // ── Guard ────────────────────────────────────────────────
    const guardW = handleW * sd.guardW * 2.5;
    dc.fillStyle = '#aaaaaa';
    dc.shadowBlur = 8;
    dc.beginPath();
    dc.roundRect(-guardW/2, handleLen - 4, guardW, 7, 2);
    dc.fill();

    // ── Blade ────────────────────────────────────────────────
    const bladeLen = weaponLen - handleLen;
    dc.shadowColor = color;
    dc.shadowBlur  = 18 * glowPulse;
    dc.fillStyle   = color;
    dc.beginPath();
    dc.moveTo(-bladeW/2, handleLen);
    dc.lineTo(-bladeW * 0.25, handleLen + bladeLen * 0.88);
    dc.lineTo(0, handleLen + bladeLen);  // tip
    dc.lineTo( bladeW * 0.25, handleLen + bladeLen * 0.88);
    dc.lineTo( bladeW/2, handleLen);
    dc.closePath();
    dc.fill();
    // Blade edge highlight
    dc.strokeStyle = 'rgba(255,255,255,0.55)';
    dc.lineWidth   = 1.2;
    dc.beginPath();
    dc.moveTo(0, handleLen + 4);
    dc.lineTo(0, handleLen + bladeLen);
    dc.stroke();

  } else if (headShape === 'hammer') {
    const handleLen = weaponLen * 0.68;
    const handleW   = Math.max(5, 7 * weightFactor * 0.65);
    dc.fillStyle = '#7a5533';
    dc.beginPath(); dc.roundRect(-handleW/2, 0, handleW, handleLen, 3); dc.fill();
    // Hammer head — width driven by weight
    const hHeadW = Math.max(22, 36 * weightFactor * 0.8);
    const hHeadH = Math.max(14, 24 * weightFactor * 0.7);
    dc.fillStyle   = color;
    dc.shadowColor = color;
    dc.shadowBlur  = 20 * glowPulse;
    dc.beginPath(); dc.roundRect(-hHeadW/2, handleLen, hHeadW, hHeadH, 4); dc.fill();
    dc.strokeStyle = 'rgba(255,255,255,0.3)'; dc.lineWidth = 1.5;
    dc.strokeRect(-hHeadW/2, handleLen, hHeadW, hHeadH);

  } else if (headShape === 'axe') {
    const handleLen = weaponLen * 0.65;
    const handleW   = Math.max(4, 6 * weightFactor * 0.65);
    dc.fillStyle = '#7a5533';
    dc.beginPath(); dc.roundRect(-handleW/2, 0, handleW, handleLen, 3); dc.fill();
    // Axe head — crescent
    dc.fillStyle   = color;
    dc.shadowColor = color;
    dc.shadowBlur  = 20 * glowPulse;
    const aR = Math.max(18, 28 * weightFactor * 0.75);
    dc.beginPath();
    dc.moveTo(0, handleLen);
    dc.lineTo(-aR * 0.6, handleLen - aR * 0.5);
    dc.lineTo(-aR, handleLen + aR * 0.25);
    dc.lineTo(-aR * 0.5, handleLen + aR * 0.8);
    dc.lineTo(0, handleLen + aR * 0.5);
    dc.closePath();
    dc.fill();

  } else if (headShape === 'bow') {
    dc.restore();
    dc.save();
    dc.translate(cx, cy);
    // Bow arc
    dc.strokeStyle = color;
    dc.lineWidth   = Math.max(2, 3.5 * weightFactor * 0.7);
    dc.shadowColor = color;
    dc.shadowBlur  = 18;
    dc.beginPath();
    dc.arc(cx, cy, weaponLen * 0.5, -Math.PI * 0.72, Math.PI * 0.72);
    dc.stroke();
    // String
    dc.strokeStyle = 'rgba(255,255,200,0.7)';
    dc.lineWidth   = 1;
    dc.setLineDash([]);
    const bowY0 = cy - weaponLen * 0.5 * Math.sin(Math.PI * 0.72);
    const bowY1 = cy + weaponLen * 0.5 * Math.sin(Math.PI * 0.72);
    dc.beginPath();
    dc.moveTo(cx + weaponLen * 0.5 * Math.cos(Math.PI * 0.72), bowY0);
    dc.lineTo(cx + weaponLen * 0.5 * Math.cos(Math.PI * 0.72), bowY1);
    dc.stroke();
    // Arrow
    const arrX0 = cx - weaponLen * 0.4, arrX1 = cx + weaponLen * 0.42;
    dc.strokeStyle = '#ffffaa'; dc.lineWidth = 2;
    dc.beginPath(); dc.moveTo(arrX0, cy); dc.lineTo(arrX1, cy); dc.stroke();
    dc.fillStyle = '#ffffaa';
    dc.beginPath(); dc.moveTo(arrX1, cy); dc.lineTo(arrX1-10, cy-5); dc.lineTo(arrX1-10, cy+5); dc.closePath(); dc.fill();
    // Speed lines (fast weapons)
    if (speedFactor > 1.2) {
      dc.strokeStyle = `rgba(255,255,255,${(speedFactor-1)*0.4})`;
      dc.lineWidth = 1; dc.setLineDash([4,4]);
      for (let i = 0; i < 3; i++) {
        dc.beginPath(); dc.moveTo(arrX0 - 10 - i*8, cy + (i-1)*8); dc.lineTo(arrX0 - 30 - i*8, cy + (i-1)*8); dc.stroke();
      }
      dc.setLineDash([]);
    }
    dc.restore();
    _wDrawStickman(dc, W, H, color);
    _wUpdateStatDisplay();
    return;

  } else if (headShape === 'orb') {
    const handleLen = weaponLen * 0.72;
    const handleW   = Math.max(4, 6 * weightFactor * 0.6);
    dc.fillStyle = '#555588';
    dc.beginPath(); dc.roundRect(-handleW/2, 0, handleW, handleLen, 3); dc.fill();
    // Crystal topper
    const orbR = Math.max(12, 20 * weightFactor * 0.6);
    const orbPulse = 0.85 + Math.sin(t * 0.004) * 0.15;
    dc.fillStyle   = color;
    dc.shadowColor = color;
    dc.shadowBlur  = 28 * glowPulse;
    dc.beginPath(); dc.arc(0, handleLen + orbR, orbR * orbPulse, 0, Math.PI * 2); dc.fill();
    // Orbital particles
    dc.shadowBlur = 8;
    for (let i = 0; i < 5; i++) {
      const a = t * 0.0022 + i * Math.PI * 2 / 5;
      dc.fillStyle = 'rgba(255,255,255,0.7)';
      dc.beginPath(); dc.arc(Math.cos(a) * orbR * 1.4, handleLen + orbR + Math.sin(a) * orbR * 1.4 * 0.4, 2.5, 0, Math.PI * 2); dc.fill();
    }
  }

  dc.restore();
  dc.shadowBlur = 0;

  // ── Speed lines for fast weapons ────────────────────────────
  if (speedFactor > 1.3) {
    const alpha = Math.min(0.55, (speedFactor - 1.3) * 0.6);
    dc.strokeStyle = `rgba(255,255,255,${alpha})`;
    dc.lineWidth   = 1.5;
    dc.setLineDash([6, 5]);
    for (let i = 0; i < 4; i++) {
      const lx = cx + 28 + i * 12, ly = cy + 22 + i * 14;
      dc.beginPath(); dc.moveTo(lx, ly); dc.lineTo(lx + 22, ly - 18); dc.stroke();
    }
    dc.setLineDash([]);
  }

  // ── Range arc indicator ──────────────────────────────────────
  dc.strokeStyle = `rgba(255,255,255,0.10)`;
  dc.lineWidth   = 1;
  dc.setLineDash([4, 5]);
  dc.beginPath(); dc.arc(cx, cy, weaponLen * 0.85, 0, Math.PI * 2); dc.stroke();
  dc.setLineDash([]);

  // ── Stat bars — visual feedback strips at bottom ────────────
  const barY = H - 28;
  const barH = 6;
  const barsInfo = [
    { label: 'DMG',  val: Math.min(1, dmg / 40),  col: '#ff6655' },
    { label: 'SPD',  val: Math.min(1, speedFactor / 1.8), col: '#55ddff' },
    { label: 'KB',   val: Math.min(1, kb / 18),   col: '#88ff44' },
    { label: 'RNG',  val: Math.min(1, range / 90), col: '#ffcc44' },
  ];
  dc.font = '9px Arial';
  barsInfo.forEach((b, i) => {
    const bx = 10 + i * (W / 4 - 2);
    const bw = W / 4 - 14;
    dc.fillStyle = 'rgba(255,255,255,0.08)'; dc.fillRect(bx, barY, bw, barH);
    dc.fillStyle = b.col;
    dc.fillRect(bx, barY, bw * b.val, barH);
    dc.fillStyle = 'rgba(255,255,255,0.45)';
    dc.textAlign = 'left';
    dc.fillText(b.label, bx, barY - 3);
  });

  // ── Stickman holder ──────────────────────────────────────────
  _wDrawStickman(dc, W, H, color);

  _wUpdateStatDisplay();
}

function _wDrawStickman(dc, W, H, color) {
  // Simple stickman on the right side holding the weapon
  const sx = W - 38, sy = H / 2 + 10;
  dc.strokeStyle = 'rgba(180,200,255,0.55)';
  dc.lineWidth   = 2.5;
  dc.lineCap     = 'round';
  // Head
  dc.beginPath(); dc.arc(sx, sy - 28, 9, 0, Math.PI * 2); dc.stroke();
  // Body
  dc.beginPath(); dc.moveTo(sx, sy - 19); dc.lineTo(sx, sy + 10); dc.stroke();
  // Arms — left arm holds weapon
  dc.beginPath(); dc.moveTo(sx, sy - 10); dc.lineTo(sx - 22, sy - 2); dc.stroke();
  dc.beginPath(); dc.moveTo(sx, sy - 10); dc.lineTo(sx + 10, sy + 2); dc.stroke();
  // Legs
  dc.beginPath(); dc.moveTo(sx, sy + 10); dc.lineTo(sx - 10, sy + 28); dc.stroke();
  dc.beginPath(); dc.moveTo(sx, sy + 10); dc.lineTo(sx + 10, sy + 28); dc.stroke();
  // Tiny weapon in hand
  dc.strokeStyle = color;
  dc.shadowColor = color;
  dc.shadowBlur  = 10;
  dc.lineWidth   = 2;
  dc.beginPath(); dc.moveTo(sx - 22, sy - 2); dc.lineTo(sx - 38, sy - 16); dc.stroke();
  dc.shadowBlur  = 0;
  dc.lineCap     = 'butt';
}

function _wBuildObj() {
  const name      = document.getElementById('wName')?.value    || 'Custom';
  const dmg       = parseInt(document.getElementById('wDmg')?.value    || 15);
  const range     = parseInt(document.getElementById('wRange')?.value  || 50);
  const cool      = parseInt(document.getElementById('wCool')?.value   || 30);
  const kb        = parseInt(document.getElementById('wKb')?.value     || 8);
  const type      = document.getElementById('wType')?.value   || 'melee';
  const abilCool  = parseInt(document.getElementById('wAbilCool')?.value || 90);
  const abilEffect = document.getElementById('wAbilEffect')?.value || 'dash';
  const color     = document.getElementById('wColor')?.value  || '#44aaff';

  // Build ability function based on selected effect
  let abilityFn;
  switch (abilEffect) {
    case 'dash':
      abilityFn = function(user, target) {
        user.vx += user.facing * 18;
        const d = Math.abs(user.cx() - target.cx());
        if (d < range + 30) { if (typeof dealDamage !== 'undefined') dealDamage(user, target, Math.round(dmg * 0.7), kb); }
      };
      break;
    case 'leap':
      abilityFn = function(user) { user.vy = -20; user.canDoubleJump = true; };
      break;
    case 'shield_burst':
      abilityFn = function(user, target) {
        if (typeof dealDamage !== 'undefined') dealDamage(user, target, Math.round(dmg * 0.4), kb * 2);
        if (typeof spawnParticles !== 'undefined') spawnParticles(user.cx(), user.cy(), color, 20);
      };
      break;
    case 'projectile':
      abilityFn = function(user) {
        if (typeof spawnBullet !== 'undefined') spawnBullet(user, dmg, range * 0.06);
      };
      break;
    case 'heal':
      abilityFn = function(user) { user.health = Math.min(user.maxHealth, user.health + Math.round(user.maxHealth * 0.2)); };
      break;
    case 'slow':
      abilityFn = function(user, target) { target.stunTimer = Math.max(target.stunTimer, 40); };
      break;
    default:
      abilityFn = function() {};
  }

  return {
    name,
    damage:          dmg,
    range,
    cooldown:        cool,
    kb,
    type,
    abilityCooldown: abilCool,
    ability:         abilityFn,
    _color:          color,  // custom metadata
    _abilEffect:     abilEffect,
    _isCustom:       true,   // blocks achievement/progression tracking
  };
}

function wSaveWeapon() {
  const obj = _wBuildObj();
  // Strip non-serializable fn for storage
  const stored = Object.assign({}, obj, { ability: null });
  _dCustomWeapons.push(stored);
  try { localStorage.setItem('smc_custom_weapons', JSON.stringify(_dCustomWeapons)); } catch(e) {}
  _wRefreshList();
  alert(`Weapon "${obj.name}" saved!`);
}

function _wRefreshList() {
  try {
    const raw = localStorage.getItem('smc_custom_weapons');
    if (raw) _dCustomWeapons = JSON.parse(raw);
  } catch(e) { _dCustomWeapons = []; }

  const list = document.getElementById('dSavedWeaponsList');
  if (!list) return;
  list.innerHTML = '';
  _dCustomWeapons.forEach((w, i) => {
    const row = document.createElement('div');
    row.className = 'd-saved-entry';
    row.innerHTML = `<span>${w.name} (${w.type}, ${w.damage}dmg)</span>
      <div>
        <button onclick="_wLoadWeapon(${i})">Load</button>
        <button onclick="_wDeleteWeapon(${i})">✕</button>
      </div>`;
    list.appendChild(row);
  });
}

function _wLoadWeapon(i) {
  const w = _dCustomWeapons[i];
  if (!w) return;
  document.getElementById('wName').value      = w.name;
  document.getElementById('wDmg').value       = w.damage;
  document.getElementById('wRange').value     = w.range;
  document.getElementById('wCool').value      = w.cooldown;
  document.getElementById('wKb').value        = w.kb;
  document.getElementById('wType').value      = w.type;
  document.getElementById('wAbilCool').value  = w.abilityCooldown || 90;
  document.getElementById('wAbilEffect').value = w._abilEffect || 'dash';
  document.getElementById('wColor').value     = w._color || '#44aaff';
  wSync();
}

function _wDeleteWeapon(i) {
  _dCustomWeapons.splice(i, 1);
  try { localStorage.setItem('smc_custom_weapons', JSON.stringify(_dCustomWeapons)); } catch(e) {}
  _wRefreshList();
}

function wEquipWeapon(pid) {
  const _allowedModes = new Set(['2p', 'training']);
  if (typeof gameMode !== 'undefined' && !_allowedModes.has(gameMode)) {
    alert('Custom weapons can only be used in 1v1 or Training mode.');
    return;
  }
  if (typeof players === 'undefined' || !players.length) {
    // Not in game — store for next game start
    const wObj = _wBuildObj();
    if (pid === 'p1') {
      const _cwKey = '_custom_' + Date.now();
      window.CUSTOM_WEAPONS = window.CUSTOM_WEAPONS || {};
      window.CUSTOM_WEAPONS[_cwKey] = wObj;
      if (typeof saveCustomWeaponSelection === 'function') saveCustomWeaponSelection(_cwKey);
      if (typeof saveCustomWeaponsData === 'function') saveCustomWeaponsData();
      alert(`Custom weapon ready — it will be equipped on P1 when you start a 1v1 or Training match.`);
    }
    return;
  }
  const wObj = _wBuildObj();
  const p    = pid === 'p2' ? players[1] : players[0];
  if (p) { p.weapon = wObj; alert(`Equipped "${wObj.name}" on ${pid.toUpperCase()}!`); }
  else    { alert('Player not found in current game.'); }
}

function wExportWeapon() {
  const obj = _wBuildObj();
  const serializable = Object.assign({}, obj);
  delete serializable.ability;
  serializable._abilEffect = document.getElementById('wAbilEffect')?.value || 'dash';
  const jsText  = `// Custom weapon — paste into WEAPONS object in smb-data.js\n'${obj.name.toLowerCase().replace(/\s+/g,'_')}': ${JSON.stringify(serializable, null, 2)},`;
  const jsonText = JSON.stringify(serializable, null, 2);
  const filename = (obj.name || 'weapon').replace(/\s+/g,'_') + '.json';
  _dShowExportModal(jsonText, filename, 'Weapon Export — ' + obj.name, jsText);
}

function wImportWeapon() {
  document.getElementById('_dWeaponImportModal')?.remove();
  const modal = document.createElement('div');
  modal.id = '_dWeaponImportModal';
  modal.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,0.72);z-index:3000;
    display:flex;align-items:center;justify-content:center;`;
  modal.innerHTML = `
  <div style="background:#0c0c1e;border:1.5px solid rgba(200,136,255,0.28);border-radius:13px;
    padding:22px 24px 18px;width:min(480px,92vw);box-shadow:0 6px 40px rgba(60,0,80,0.6);
    font-family:'Segoe UI',Arial,sans-serif;color:#ccd;">
    <div style="font-weight:700;font-size:0.95rem;margin-bottom:14px;color:#cc88ff;">Weapon Import</div>
    <div style="margin-bottom:10px;">
      <label style="font-size:0.8rem;opacity:0.7;">Import from file (.json)</label><br>
      <input type="file" accept=".json,.txt" onchange="_wImportFromFile(this)"
        style="margin-top:4px;color:#aaa;font-size:0.8rem;width:100%;">
    </div>
    <div style="font-size:0.75rem;text-align:center;opacity:0.45;margin-bottom:8px;">— or paste JSON below —</div>
    <textarea id="_dWeaponImportText" rows="5" placeholder='{"name":"My Weapon","damage":14,...}'
      style="width:100%;background:#07071a;color:#bdc;border:1px solid rgba(200,136,255,0.2);
      border-radius:7px;padding:8px;font-family:monospace;font-size:0.72rem;
      resize:vertical;box-sizing:border-box;"></textarea>
    <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:12px;">
      <button onclick="document.getElementById('_dWeaponImportModal').remove()"
        style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.18);
        color:#bbc;border-radius:7px;padding:6px 16px;cursor:pointer;font-family:inherit;font-size:0.8rem;">
        Cancel
      </button>
      <button onclick="_wImportFromText()" style="${_dModalBtnStyle('#cc88ff')}">Import</button>
    </div>
  </div>`;
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
}

function _wImportFromFile(input) {
  if (!input.files?.length) return;
  const reader = new FileReader();
  reader.onload = e => {
    _wApplyImportJSON(e.target.result);
    document.getElementById('_dWeaponImportModal')?.remove();
  };
  reader.readAsText(input.files[0]);
}

function _wImportFromText() {
  const text = document.getElementById('_dWeaponImportText')?.value?.trim();
  if (!text) { _dToast('Nothing to import'); return; }
  _wApplyImportJSON(text);
  document.getElementById('_dWeaponImportModal')?.remove();
}

function _wApplyImportJSON(text) {
  let obj;
  try { obj = JSON.parse(text); } catch (err) { _dToast('Invalid JSON — could not import'); return; }
  const setVal = (id, val) => { const el = document.getElementById(id); if (el && val !== undefined) el.value = val; };
  setVal('wName',      obj.name);
  setVal('wDmg',       obj.damage);
  setVal('wRange',     obj.range);
  setVal('wCool',      obj.cooldown);
  setVal('wKb',        obj.kbForce);
  setVal('wType',      obj.type);
  setVal('wAbilEffect', obj._abilEffect || obj.abilEffect);
  setVal('wAbilCool',  obj.abilityCooldown);
  setVal('wColor',     obj.color || obj.weaponColor);
  setVal('wShape',     obj.shape);
  wSync();
  _dToast(`Imported "${obj.name || 'weapon'}"`);
}

// Overloaded version for weapon (pass optional jsCode for "Copy Code" text)
const _dShowExportModal_orig = _dShowExportModal;
// eslint-disable-next-line no-global-assign
_dShowExportModal = function(text, filename, title, altCodeText) {
  document.getElementById('_dExportModal')?.remove();
  const codeText = altCodeText || text;
  const modal = document.createElement('div');
  modal.id = '_dExportModal';
  modal.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,0.72);z-index:3000;
    display:flex;align-items:center;justify-content:center;`;
  const preview = _escHtml((altCodeText || text).slice(0, 380));
  modal.innerHTML = `
  <div style="background:#0c0c1e;border:1.5px solid rgba(100,180,255,0.28);border-radius:13px;
    padding:22px 24px 18px;width:min(500px,92vw);box-shadow:0 6px 40px rgba(0,0,80,0.6);
    font-family:'Segoe UI',Arial,sans-serif;color:#ccd;">
    <div style="font-weight:700;font-size:0.95rem;margin-bottom:14px;">${title}</div>
    <div style="display:flex;gap:10px;margin-bottom:16px;">
      <button onclick="_dExportAsCode(decodeURIComponent('${encodeURIComponent(codeText)}'))"
        style="flex:1;background:rgba(136,200,255,0.1);border:1px solid rgba(136,200,255,0.4);
        color:#88ccff;border-radius:8px;padding:10px 8px;cursor:pointer;font-family:inherit;font-size:0.82rem;">
        📋 Copy Code<br><span style="font-size:0.7rem;opacity:0.65;">Paste into file / chat</span>
      </button>
      <button onclick="_dExportAsFile(decodeURIComponent('${encodeURIComponent(text)}'),'${_escAttr(filename)}')"
        style="flex:1;background:rgba(136,255,68,0.1);border:1px solid rgba(136,255,68,0.4);
        color:#88ff44;border-radius:8px;padding:10px 8px;cursor:pointer;font-family:inherit;font-size:0.82rem;">
        💾 Download File<br><span style="font-size:0.7rem;opacity:0.65;">Save as .json</span>
      </button>
    </div>
    <textarea readonly style="width:100%;height:72px;background:#07071a;color:#7a9;
      border:1px solid rgba(100,180,255,0.15);border-radius:6px;padding:8px;
      font-family:monospace;font-size:0.7rem;resize:none;box-sizing:border-box;">${preview}…</textarea>
    <div style="display:flex;justify-content:flex-end;margin-top:12px;">
      <button onclick="document.getElementById('_dExportModal').remove()"
        style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.18);
        color:#bbc;border-radius:7px;padding:6px 16px;cursor:pointer;font-family:inherit;font-size:0.8rem;">
        Close
      </button>
    </div>
  </div>`;
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
};

// Init weapon preview on tab load
// Inject a custom arena option into the arena <select> dropdown.
// Avoids duplicates by checking for an existing option with the same value.
function _dInjectArenaOption(key, label) {
  const sel = document.getElementById('arenaSelect');
  if (!sel) return;
  // Remove stale entry with this key if it exists
  const existing = sel.querySelector(`option[value="${CSS.escape(key)}"]`);
  if (existing) existing.remove();
  // Find or create the "Custom" optgroup
  let grp = sel.querySelector('optgroup[label="─── Custom ────────────"]');
  if (!grp) {
    grp = document.createElement('optgroup');
    grp.label = '─── Custom ────────────';
    sel.appendChild(grp);
  }
  const opt = document.createElement('option');
  opt.value       = key;
  opt.textContent = label;
  grp.appendChild(opt);
  sel.value = key; // auto-select it
}

// Restore all saved custom maps into the arena dropdown + ARENAS on page load.
function _dRestoreCustomMapsToDropdown() {
  const saves = _dGetSaves();
  Object.entries(saves).forEach(([, v]) => {
    if (!v.meta || !v.meta.name) return;
    const key  = '_custom_' + v.meta.name.replace(/\s+/g,'_').toLowerCase();
    const base = (typeof ARENAS !== 'undefined' && ARENAS[v.base || 'grass']) || {};
    const platforms = (v.platforms || []).map(pl => ({
      x: pl.x, y: pl.y, w: pl.w, h: pl.h || 14,
      isFloor: pl.isFloor, oscX: pl.oscX||0, oscY: pl.oscY||0, ox: pl.x, oy: pl.y,
    }));
    if (typeof ARENAS !== 'undefined') {
      ARENAS[key] = Object.assign({}, base, {
        name:           v.meta.name,
        sky:            [v.meta.skyColor || '#1a1a2e', '#1a1a2e'],
        hasLava:        v.meta.hasLava || false,
        isLowGravity:   (v.hazards||[]).includes('lowgrav'),
        isHeavyGravity: (v.hazards||[]).includes('heavygrav'),
        isIcy:          (v.hazards||[]).includes('ice'),
        platforms:      platforms.length > 0 ? platforms : (base.platforms || []),
      });
    }
    _dInjectArenaOption(key, '🗺 ' + v.meta.name);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  // Load saved weapons
  try {
    const raw = localStorage.getItem('smc_custom_weapons');
    if (raw) _dCustomWeapons = JSON.parse(raw);
  } catch(e) {}
  // Restore persisted custom weapons into window.CUSTOM_WEAPONS
  if (typeof loadCustomWeaponsData === 'function') loadCustomWeaponsData();
  // Restore custom maps into arena dropdown
  // Defer slightly so ARENAS (smb-data.js) is guaranteed to be defined
  setTimeout(_dRestoreCustomMapsToDropdown, 200);
  // Animate weapon preview when tab is open
  const _wLoop = () => {
    const panel = document.getElementById('designerWeaponPanel');
    if (panel && panel.style.display !== 'none') _wDraw();
    requestAnimationFrame(_wLoop);
  };
  requestAnimationFrame(_wLoop);
});
