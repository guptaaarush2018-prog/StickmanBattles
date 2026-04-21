'use strict';
// smb-story-engine-ui.js — Story menu tab switching, journey/store/skill-tree rendering, prologue overlay
// Depends on: smb-globals.js, smb-story-registry.js (and preceding story-engine splits)

// ── UI helpers ────────────────────────────────────────────────────────────────
function _worldIcon(w) {
  // World strings already include their emoji, just return as-is
  return w || '🌐';
}

function _story2TokenDisplay() {
  const el = document.getElementById('storyTokenDisplay');
  if (el) el.textContent = _story2.tokens;
}

// ── Tab switching ─────────────────────────────────────────────────────────────
function switchStoryTab(tab) {
  // 'multiverse' panel is kept but has no tab button — only accessible via story progression
  ['chapters','store','multiverse'].forEach(t => {
    const btn   = document.getElementById('storyTab' + t.charAt(0).toUpperCase() + t.slice(1));
    const panel = document.getElementById('storyTabPanel' + t.charAt(0).toUpperCase() + t.slice(1));
    if (btn)   btn.classList.toggle('active', t === tab);
    if (panel) panel.style.display = (t === tab) ? '' : 'none';
  });
  // Deactivate visible tab buttons when multiverse panel is shown programmatically
  if (tab === 'multiverse') {
    ['storyTabChapters','storyTabStore'].forEach(id => {
      const b = document.getElementById(id);
      if (b) b.classList.remove('active');
    });
  }
  if (tab === 'store') _renderStoryStore2();
  if (tab === 'multiverse' && typeof _renderMultiverseWorldList === 'function') _renderMultiverseWorldList();
  _story2TokenDisplay();
}

// ── Journey tab ───────────────────────────────────────────────────────────────
function _renderStoryJourney() {
  const list = document.getElementById('storyJourneyList');
  if (!list) return;
  list.innerHTML = '';
  const cur = _story2.chapter;

  STORY_CHAPTERS2.forEach((ch, i) => {
    const done    = _story2.defeated.includes(i);
    const current = i === cur;
    const locked  = i > cur;

    const el = document.createElement('div');
    el.className = 'story-journey-card' + (done ? ' done' : current ? ' current' : locked ? ' locked' : '');

    const icon = done ? '✅' : current ? '▶️' : locked ? '🔒' : '⭐';
    let rewardHtml = '';
    if (ch.tokenReward) rewardHtml += `+${ch.tokenReward} 🪙`;
    if (ch.blueprintDrop && STORY_ABILITIES2[ch.blueprintDrop]) {
      rewardHtml += ` · 📋 ${STORY_ABILITIES2[ch.blueprintDrop].name}`;
    }

    el.innerHTML = `<span class="sjc-icon">${icon}</span>
      <div class="sjc-body">
        <div class="sjc-title">${ch.title}</div>
        <div class="sjc-world">${_worldIcon(ch.world)}</div>
        ${rewardHtml ? `<div class="sjc-reward">${rewardHtml}</div>` : ''}
      </div>`;

    if (!locked) {
      el.onclick = () => _beginChapter2(i);
    }
    list.appendChild(el);
  });
}

// ── Ability Store tab ─────────────────────────────────────────────────────────
let _storeSubTab = 'shop';

function _renderStoryStore2() {
  const grid = document.getElementById('storyAbilityGrid2');
  if (!grid) return;
  grid.innerHTML = '';
  _story2TokenDisplay();
  _storyUpdateExpDisplay();

  // Sub-tab header
  const subTabBar = document.createElement('div');
  subTabBar.style.cssText = 'display:flex;gap:8px;margin-bottom:14px;border-bottom:1px solid rgba(255,255,255,0.1);padding-bottom:8px;';
  for (const [key, label] of [['shop','🪙 Shop'], ['skilltree','🌿 Skill Tree']]) {
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.style.cssText = `background:${_storeSubTab===key?'rgba(80,140,255,0.25)':'transparent'};border:1px solid ${_storeSubTab===key?'rgba(80,140,255,0.6)':'rgba(255,255,255,0.12)'};color:${_storeSubTab===key?'#aacfff':'#6677aa'};padding:5px 14px;border-radius:5px;cursor:pointer;font-size:0.75rem;letter-spacing:1px;`;
    btn.onclick = () => { _storeSubTab = key; _renderStoryStore2(); };
    subTabBar.appendChild(btn);
  }
  grid.appendChild(subTabBar);

  if (_storeSubTab === 'shop') {
    _renderShopSection(grid);
  } else {
    _renderSkillTreeSection(grid);
  }
}

function _renderShopSection(grid) {
  for (const item of _storyBuildShopItems()) {
    const canBuy = _story2.tokens >= item.tokenCost && item.canBuy();
    const card = document.createElement('div');
    card.className = 'story-ability-card2' + (canBuy ? ' sa-buyable' : ' sa-locked');
    card.innerHTML = `<div class="sa-icon2">${item.icon}</div>
      <div class="sa-name2">${item.name}</div>
      <div class="sa-desc2">${item.desc}</div>
      <span class="sa-cost2">${item.tokenCost} 🪙</span>`;
    if (canBuy) card.onclick = () => _buyStoryShopItem(item);
    grid.appendChild(card);
  }

  for (const [key, ab] of Object.entries(STORY_ABILITIES2)) {
    const owned  = _story2.unlockedAbilities.includes(key);
    const hasBP  = !ab.requiresBlueprint || _story2.blueprints.includes(key);
    const canBuy = !owned && hasBP && _story2.tokens >= ab.tokenCost;
    const card   = document.createElement('div');
    card.className = 'story-ability-card2' + (owned ? ' sa-owned' : canBuy ? ' sa-buyable' : ' sa-locked');
    const costLabel = owned
      ? `<span class="sa-cost2 sa-owned-label">✅ Owned</span>`
      : !hasBP
      ? `<span class="sa-cost2 sa-locked-label">📋 Blueprint needed</span>`
      : `<span class="sa-cost2">${ab.tokenCost} 🪙</span>`;
    card.innerHTML = `<div class="sa-icon2">${ab.icon}</div>
      <div class="sa-name2">${ab.name}</div>
      <div class="sa-desc2">${ab.desc}</div>
      ${costLabel}`;
    if (canBuy) card.onclick = () => _buyAbility2(key, ab);
    grid.appendChild(card);
  }
}

// Helper: check if a skill node's requirements are met
function _skillNodeReqMet(node, sk) {
  if (!node.requires && !node.requiresAny) return true;
  if (node.requiresAny && node.requiresAny.some(r => !!sk[r])) return true;
  if (node.requires && !!sk[node.requires]) return true;
  return false;
}

function _renderSkillTreeSection(grid) {
  const sk  = _story2.skillTree || {};
  const exp = _story2.exp || 0;

  // EXP banner
  const expBanner = document.createElement('div');
  expBanner.style.cssText = 'padding:8px 12px;background:rgba(100,220,100,0.08);border:1px solid rgba(100,220,100,0.25);border-radius:7px;margin-bottom:14px;display:flex;align-items:center;justify-content:space-between;';
  expBanner.innerHTML = `<span style="color:#88cc88;font-size:0.72rem;letter-spacing:1px;">🌟 SKILL POINTS (EXP)</span><span id="storyExpDisplay" style="color:#aaff88;font-size:1.05rem;font-weight:700;">${exp} EXP</span>`;
  grid.appendChild(expBanner);

  for (const [, branch] of Object.entries(STORY_SKILL_TREE)) {
    // Branch wrapper
    const branchWrap = document.createElement('div');
    branchWrap.style.cssText = 'margin-bottom:18px;';

    // Branch header bar
    const header = document.createElement('div');
    header.style.cssText = `display:flex;align-items:center;gap:7px;margin-bottom:10px;padding:5px 10px;background:rgba(0,0,0,0.22);border-left:3px solid ${branch.color};border-radius:0 6px 6px 0;`;
    header.innerHTML = `<span style="font-size:1rem;">${branch.icon || ''}</span><span style="font-size:0.70rem;letter-spacing:2px;text-transform:uppercase;color:${branch.color};font-weight:700;">${branch.label}</span>`;
    branchWrap.appendChild(header);

    // Build a depth map: nodeId → depth (0 = root)
    const nodeMap = {};
    for (const n of branch.nodes) nodeMap[n.id] = n;
    const depthOf = {};
    const getDepth = (n) => {
      if (n.id in depthOf) return depthOf[n.id];
      const parent = n.requires ? nodeMap[n.requires] : null;
      depthOf[n.id] = parent ? getDepth(parent) + 1 : 0;
      return depthOf[n.id];
    };
    for (const n of branch.nodes) getDepth(n);
    const maxDepth = Math.max(...branch.nodes.map(n => depthOf[n.id]));

    // Group nodes by depth
    const layers = [];
    for (let d = 0; d <= maxDepth; d++) {
      layers.push(branch.nodes.filter(n => depthOf[n.id] === d));
    }

    // Render layers top-to-bottom with connector lines between parent-child
    const treeWrap = document.createElement('div');
    treeWrap.style.cssText = 'position:relative;padding:0 4px;';

    for (let d = 0; d <= maxDepth; d++) {
      const layerNodes = layers[d];
      const layerRow = document.createElement('div');
      layerRow.style.cssText = 'display:flex;gap:8px;margin-bottom:0;';

      for (const node of layerNodes) {
        const owned   = !!sk[node.id];
        const reqMet  = _skillNodeReqMet(node, sk);
        const canBuy  = !owned && reqMet && exp >= node.expCost;
        const isLocked = !owned && !reqMet;

        // Connector line above non-root nodes
        const colWrap = document.createElement('div');
        colWrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;flex:1;min-width:110px;';

        if (d > 0) {
          const connector = document.createElement('div');
          connector.style.cssText = `width:2px;height:14px;background:${owned ? branch.color : reqMet ? branch.color + '55' : 'rgba(255,255,255,0.08)'};margin-bottom:2px;border-radius:1px;`;
          colWrap.appendChild(connector);
        }

        const card = document.createElement('div');
        card.style.cssText = [
          'border-radius:9px', 'padding:9px 10px 8px', 'width:100%', 'box-sizing:border-box',
          `border:1px solid ${owned ? branch.color + 'aa' : canBuy ? branch.color + '55' : 'rgba(255,255,255,0.07)'}`,
          `background:${owned ? 'rgba(20,60,35,0.55)' : canBuy ? 'rgba(20,30,60,0.5)' : 'rgba(5,5,18,0.30)'}`,
          `opacity:${isLocked ? '0.32' : '1'}`,
          canBuy ? 'cursor:pointer;transition:background 0.12s,box-shadow 0.12s;' : 'cursor:default;',
          owned ? `box-shadow:0 0 8px ${branch.color}44;` : '',
        ].join(';');

        const reqLabel = isLocked
          ? (node.requiresAny
              ? '🔒 Requires ' + (node.requiresAny[0] || '').replace(/([A-Z])/g,' $1').trim()
              : '🔒 ' + (node.requires || '').replace(/([A-Z])/g,' $1').trim() + ' required')
          : '';

        card.innerHTML = `
          <div style="font-size:0.80rem;color:${owned ? '#aaff88' : canBuy ? '#dde4ff' : '#556'};font-weight:700;margin-bottom:3px;">${node.name}</div>
          <div style="font-size:0.60rem;color:#5a6a9a;line-height:1.35;margin-bottom:5px;">${node.desc}</div>
          <div style="font-size:0.68rem;${owned ? 'color:#66ee99' : canBuy ? `color:${branch.color}` : 'color:#445'}">
            ${owned ? '✓ Unlocked' : isLocked ? reqLabel : node.expCost + ' EXP'}
          </div>`;

        if (canBuy) {
          card.addEventListener('click', () => _buySkillNode(node, branch));
          card.addEventListener('mouseover', () => { card.style.background = 'rgba(30,55,110,0.7)'; card.style.boxShadow = `0 0 12px ${branch.color}33`; });
          card.addEventListener('mouseout',  () => { card.style.background = 'rgba(20,30,60,0.5)';  card.style.boxShadow = ''; });
        }

        colWrap.appendChild(card);

        // Connector line below if this node has children
        const hasChild = branch.nodes.some(c => c.requires === node.id);
        if (hasChild) {
          const connDown = document.createElement('div');
          connDown.style.cssText = `width:2px;height:14px;background:${owned ? branch.color : branch.color + '33'};margin-top:2px;border-radius:1px;`;
          colWrap.appendChild(connDown);
        }

        layerRow.appendChild(colWrap);
      }

      treeWrap.appendChild(layerRow);
    }

    branchWrap.appendChild(treeWrap);
    grid.appendChild(branchWrap);
  }
}

function _buySkillNode(node, branch) {
  const sk  = _story2.skillTree = _story2.skillTree || {};
  const exp = _story2.exp || 0;
  if (sk[node.id]) return;
  if (!_skillNodeReqMet(node, sk)) return;
  if (exp < node.expCost) return;
  _story2.exp = exp - node.expCost;
  sk[node.id] = true;
  _saveStory2();
  _renderStoryStore2();
  if (typeof showToast === 'function') showToast(`✅ ${node.name} unlocked!`);
}

function _buyStoryShopItem(item) {
  if (!item || _story2.tokens < item.tokenCost || !item.canBuy()) return;
  _story2.tokens -= item.tokenCost;
  item.buy();
  _saveStory2();
  _renderStoryStore2();
  _story2TokenDisplay();
  if (typeof showToast === 'function') showToast(`✅ Purchased: ${item.name}`);
}

function _buyAbility2(key, ab) {
  if (_story2.tokens < ab.tokenCost || _story2.unlockedAbilities.includes(key)) return;
  _story2.tokens -= ab.tokenCost;
  _story2.unlockedAbilities.push(key);
  _saveStory2();
  _renderStoryStore2();
  _story2TokenDisplay();
  if (typeof showToast === 'function') showToast('✅ Unlocked: ' + ab.name + '!');
}

// ── Opening prologue — shown on first play or after save wipe ─────────────────
const _PROLOGUE_LINES = [
  { text: 'Every universe has a seam.',                        delay: 0    },
  { text: 'A place where the fabric pulls thin.',             delay: 1000 },
  { text: 'Scientists call them fracture points.',            delay: 2100 },
  { text: '',                                                  delay: 2900 },
  { text: 'Yours opened on a Tuesday.',                       delay: 3400 },
  { text: '',                                                  delay: 4100 },
  { text: 'Something came through.',                          delay: 4600 },
  { text: '...',                                               delay: 5500 },
  { text: 'It was looking for a fighter.',                    delay: 6000 },
  { text: '',                                                  delay: 6800 },
  { text: 'It found you.',                                    delay: 7200 },
];

function _showPrologue(onDone) {
  // Build or retrieve overlay
  let ov = document.getElementById('prologueOverlay');
  if (!ov) {
    ov = document.createElement('div');
    ov.id = 'prologueOverlay';
    ov.style.cssText = [
      'position:fixed', 'inset:0', 'z-index:8000',
      'background:#000', 'display:flex', 'flex-direction:column',
      'align-items:center', 'justify-content:center',
      'cursor:pointer', 'font-family:"Segoe UI",Arial,sans-serif',
      'transition:opacity 0.8s ease',
    ].join(';');
    document.body.appendChild(ov);
  }

  // Lines container
  const linesEl = document.createElement('div');
  linesEl.style.cssText = 'text-align:center; max-width:520px; padding:0 24px;';
  ov.innerHTML = '';
  ov.appendChild(linesEl);

  // Begin button (hidden until all lines shown)
  const btn = document.createElement('button');
  btn.textContent = '▶  Begin Your Story';
  btn.style.cssText = [
    'margin-top:48px', 'padding:12px 36px',
    'background:linear-gradient(135deg,#3a1a6a,#6a2a9a)',
    'color:#fff', 'border:1px solid rgba(180,100,255,0.4)',
    'border-radius:8px', 'font-size:1rem', 'letter-spacing:1px',
    'cursor:pointer', 'opacity:0', 'transition:opacity 0.6s ease',
    'font-family:inherit',
  ].join(';');
  btn.onmouseover = () => { btn.style.background = 'linear-gradient(135deg,#5a2a9a,#8a3abb)'; };
  btn.onmouseout  = () => { btn.style.background = 'linear-gradient(135deg,#3a1a6a,#6a2a9a)'; };
  ov.appendChild(btn);

  ov.style.opacity = '0';
  ov.style.display = 'flex';
  requestAnimationFrame(() => { ov.style.opacity = '1'; });

  // Reveal lines one by one on a schedule
  _PROLOGUE_LINES.forEach((line, i) => {
    setTimeout(() => {
      if (line.text === '') return; // blank = spacer already handled by margin
      const p = document.createElement('p');
      p.textContent = line.text;
      p.style.cssText = [
        'margin:0 0 18px', 'font-size:1.25rem', 'color:#dde4ff',
        'opacity:0', 'transition:opacity 1.2s ease',
        line.text === '...' ? 'letter-spacing:6px; color:#667' : '',
      ].filter(Boolean).join(';');
      linesEl.appendChild(p);
      requestAnimationFrame(() => requestAnimationFrame(() => { p.style.opacity = '1'; }));
    }, line.delay);
  });

  // Show button after last line
  const lastDelay = _PROLOGUE_LINES[_PROLOGUE_LINES.length - 1].delay + 1400;
  setTimeout(() => { btn.style.opacity = '1'; }, lastDelay);

  let _dismissed = false;
  function dismiss(e) {
    if (e) e.stopPropagation();
    if (_dismissed) return;
    _dismissed = true;
    btn.onclick = null;
    ov.onclick  = null;
    ov.style.opacity = '0';
    setTimeout(() => {
      ov.style.display = 'none';
      onDone();
    }, 820);
  }
  btn.onclick = dismiss;
  // Also allow click anywhere on overlay after button appears
  setTimeout(() => { ov.onclick = dismiss; }, lastDelay);
}

