// smb-story-config.js
// Pure story data: enemy configs, unlocks, fight scripts, skill tree, worlds, arcs, abilities.
// Depends on: smb-globals.js
// Must load: BEFORE smb-story-engine.js
'use strict';

// ── Enemy scaling per level ────────────────────────────────────────────────────
// enemyDmgMult:   multiplier on all damage the enemy deals (1.0 = normal)
// enemyAtkCdMult: multiplier on attack cooldown (>1 = slower attacks, 1 = normal)
const STORY_ENEMY_CONFIGS = {
  1: { enemyDmgMult: 0.45, enemyAtkCdMult: 2.2 }, // Prologue — barely a threat
  2: { enemyDmgMult: 0.55, enemyAtkCdMult: 2.0 }, // Ch1 — slow, light hits
  3: { enemyDmgMult: 0.65, enemyAtkCdMult: 1.8 }, // Ch2 — slightly more dangerous
  4: { enemyDmgMult: 0.72, enemyAtkCdMult: 1.6 }, // Ch3 — warming up
  5: { enemyDmgMult: 0.80, enemyAtkCdMult: 1.4 }, // Ch4 — real threat now
  6: { enemyDmgMult: 0.88, enemyAtkCdMult: 1.25 }, // Ch5 — tough
  7: { enemyDmgMult: 0.94, enemyAtkCdMult: 1.12 }, // Ch6 — nearly full power
  8: { enemyDmgMult: 1.00, enemyAtkCdMult: 1.00 }, // SOVEREIGN — unscaled (AdaptiveAI self-regulates)
  9: { enemyDmgMult: 1.00, enemyAtkCdMult: 1.00 }, // Ch8 — boss fight, unscaled
  10: { enemyDmgMult: 1.00, enemyAtkCdMult: 1.00 }, // Final — unscaled
};

// ── Unlock ceremonies — shown before the level-complete screen ────────────────
const STORY_UNLOCKS = {
  1: { icon: '⬆', name: 'Double Jump',   desc: 'Something inside you remembered how to fly.\nYour body moves before your mind decides.' },
  2: { icon: '⚡', name: 'Weapon Ability', desc: 'You found the rhythm of the blade.\nThe move comes naturally now.' },
  3: { icon: '✦',  name: 'Super Meter',   desc: 'Power you did not know you had is building.\nLet it charge. Let it release.' },
  4: { icon: '🔥', name: 'Full Power',     desc: 'You are no longer the person who fell through the portal.\nYou are a fighter.' },
};

// ── In-fight narrative scripts — timed subtitles during combat ────────────────
const STORY_FIGHT_SCRIPTS = {
  1: [
    { frame: 80,  text: '"You don\'t even know how to hold that thing."', color: '#ff8866' },
    { frame: 200, text: 'Your hands are shaking. But you\'re still standing.', color: '#aaccff' },
    { frame: 380, text: '"Are you seriously trying to fight me?"', color: '#ff8866' },
    { frame: 520, text: 'Something is telling you not to give up.', color: '#88ddff' },
  ],
  2: [
    { frame: 90,  text: '"You survived once. Lucky."', color: '#ff9944' },
    { frame: 260, text: '"This world will eat you alive."', color: '#ff9944' },
    { frame: 420, text: 'Something is clicking. Your body is starting to remember.', color: '#aaccff' },
  ],
  3: [
    { frame: 60,  text: '"STOP. RUNNING."', color: '#ff4400' },
    { frame: 220, text: 'You\'re not running anymore.', color: '#88ccff' },
    { frame: 380, text: 'Your body moves before you think. That\'s new.', color: '#88ccff' },
  ],
  4: [
    { frame: 100, text: '"We\'ve been watching you since you arrived."', color: '#ffaa33' },
    { frame: 280, text: '"You\'re learning too fast."', color: '#ffaa33' },
    { frame: 430, text: '"Humans from your world don\'t do this."', color: '#ffaa33' },
    { frame: 560, text: 'You are not who you were when you arrived.', color: '#88ddff' },
  ],
  5: [
    { frame: 120, text: 'You fight like you\'ve always been here.', color: '#88ccff' },
    { frame: 320, text: 'There\'s no going back. You know that.', color: '#aaaacc' },
  ],
  7: [
    { frame: 80,  text: '"You were not supposed to make it this far."', color: '#cc88ff' },
    { frame: 260, text: '"This world was not made for you."', color: '#cc88ff' },
    { frame: 440, text: 'The ground feels different. Like it\'s rejecting you.', color: '#aaccff' },
    { frame: 600, text: 'Keep going.', color: '#ffffff' },
  ],
};

// ── Story menu ────────────────────────────────────────────────────────────────
function openStoryMenu() {
  _renderChapterList();
  const m = document.getElementById('storyModal');
  if (m) m.style.display = 'flex';
  // Make sure Chapters tab is active and refreshed
  const chapTab = document.getElementById('storyTabChapters');
  const chapPanel = document.getElementById('storyTabPanelChapters');
  if (chapTab && chapPanel) {
    ['storyTabChapters','storyTabStore','storyTabJourney'].forEach(id => {
      const b = document.getElementById(id);
      if (b) b.classList.remove('active');
    });
    ['storyTabPanelChapters','storyTabPanelStore'].forEach(id => {
      const p = document.getElementById(id);
      if (p) p.style.display = 'none';
    });
    chapTab.classList.add('active');
    chapPanel.style.display = '';
  }
  if (typeof _story2TokenDisplay === 'function') _story2TokenDisplay();
  _updateStoryCloseBtn();
}

// Single entry point for launching a specific chapter from the menu.
// Every chapter button should call this — behavior is always chapter-driven.
function startStoryFromMenu(chapterId) {
  storyModeActive    = true;
  storyCurrentLevel  = Math.min(8, Math.floor(chapterId / 5) + 1);
  if (typeof _beginChapter2 === 'function') _beginChapter2(chapterId);
}

function closeStoryMenu() {
  // Block close until chapter 0 is beaten
  const ch0Beaten = Array.isArray(_story2.defeated) && _story2.defeated.includes(0);
  if (!ch0Beaten) return; // locked — must complete chapter 1 first
  const m = document.getElementById('storyModal');
  if (m) m.style.display = 'none';
}

// Update the close button visibility based on whether chapter 0 is beaten
function _updateStoryCloseBtn() {
  const btn = document.querySelector('#storyModal button[onclick="closeStoryMenu()"]');
  if (!btn) return;
  const ch0Beaten = Array.isArray(_story2.defeated) && _story2.defeated.includes(0);
  btn.style.opacity      = ch0Beaten ? '1'       : '0.25';
  btn.style.pointerEvents = ch0Beaten ? 'auto'    : 'none';
  btn.title               = ch0Beaten ? ''        : 'Complete Chapter 1 to unlock the rest of the game';
  btn.textContent         = ch0Beaten ? '✕ Close' : '🔒 Complete Chapter 1 First';
}

function storyNewGame() {
  const msg = 'Start a new story?\nProgress will be reset. (Boss/True Form unlocks are kept.)';
  if (!confirm(msg)) return;
  _story2 = _defaultStory2Progress();
  _saveStory2();
  if (typeof saveGame === 'function') saveGame();
  _renderChapterList();
  if (typeof _story2TokenDisplay === 'function') _story2TokenDisplay();
  if (typeof _updateStoryCloseBtn === 'function') _updateStoryCloseBtn();
}

// Power level label per chapter
function _powerLabel(num) {
  if (num <= 1) return { text: 'Normal Human', color: '#778' };
  if (num <= 2) return { text: 'Learning',     color: '#88aacc' };
  if (num <= 3) return { text: 'Adapting',     color: '#88ccaa' };
  if (num <= 4) return { text: 'Awakening',    color: '#aaccff' };
  if (num <= 5) return { text: 'Fighter',      color: '#88ddff' };
  if (num <= 7) return { text: 'Elite',        color: '#ffcc88' };
  if (num === 8) return { text: 'SOVEREIGN',   color: '#cc44ff' };
  if (num === 9) return { text: 'Challenger',  color: '#ff8844' };
  return { text: 'Complete',    color: '#ffaaff' };
}

function _renderChapterList() {
  const list = document.getElementById('storyLevelList');
  if (!list) return;
  list.innerHTML = '';

  const cur        = _story2.chapter;
  const curArcId   = _getCurrentArcId();

  // ── Overall progress bar ──────────────────────────────────────────────────
  const totalCh  = STORY_CHAPTERS2.length;
  const doneCh   = _story2.defeated.length;
  const pct      = Math.round((doneCh / totalCh) * 100);
  const progWrap = document.createElement('div');
  progWrap.style.cssText = 'padding:0 2px 10px;';
  progWrap.innerHTML =
    `<div style="display:flex;justify-content:space-between;font-size:0.62rem;color:#778;margin-bottom:4px;">` +
      `<span>Overall Progress</span><span>${doneCh}/${totalCh} chapters</span>` +
    `</div>` +
    `<div style="height:5px;border-radius:3px;background:rgba(255,255,255,0.07);overflow:hidden;">` +
      `<div style="height:100%;width:${pct}%;background:linear-gradient(90deg,#4488ff,#88ffcc);border-radius:3px;transition:width 0.4s;"></div>` +
    `</div>`;
  list.appendChild(progWrap);

  // ── Determine which acts to render fully (current ±1) ─────────────────────
  let curActIdx = 0;
  for (let ai = 0; ai < STORY_ACT_STRUCTURE.length; ai++) {
    for (const arc of STORY_ACT_STRUCTURE[ai].arcs) {
      if (cur >= arc.chapterRange[0] && cur <= arc.chapterRange[1]) { curActIdx = ai; break; }
    }
  }
  const fullRenderMin = Math.max(0, curActIdx - 1);
  const fullRenderMax = Math.min(STORY_ACT_STRUCTURE.length - 1, curActIdx + 1);

  // ── Render each act ───────────────────────────────────────────────────────
  STORY_ACT_STRUCTURE.forEach((act, ai) => {
    const inAutoRange   = ai >= fullRenderMin && ai <= fullRenderMax;
    const manualExpanded = !!_story2.actExpanded[ai];
    const isFullRender  = inAutoRange || manualExpanded;

    // Count act completion
    let actDone = 0, actTotal = 0;
    for (const arc of act.arcs) {
      for (let i = arc.chapterRange[0]; i <= arc.chapterRange[1]; i++) {
        actTotal++;
        if (_story2.defeated.includes(i)) actDone++;
      }
    }
    const actComplete = actDone === actTotal;

    // Act header — always clickable to expand/collapse when outside auto range
    const actHeader = document.createElement('div');
    const chevronRot = (!inAutoRange && !manualExpanded) ? '0deg' : '90deg';
    actHeader.style.cssText = [
      'display:flex', 'align-items:center', 'gap:8px',
      'padding:8px 10px 6px',
      `border-top:1px solid ${act.color}44`,
      'margin-top:6px',
      !inAutoRange ? 'cursor:pointer' : '',
    ].join(';');
    actHeader.innerHTML =
      (!inAutoRange
        ? `<span style="font-size:0.65rem;color:#667;transition:transform 0.18s;display:inline-block;transform:rotate(${chevronRot});">▶</span>`
        : '') +
      `<span style="font-size:0.68rem;letter-spacing:1.5px;text-transform:uppercase;color:${act.color};font-weight:700;flex:1;">${act.label}</span>` +
      `<span style="font-size:0.6rem;color:${actComplete ? '#66ee99' : '#556'};">${actDone}/${actTotal}</span>`;

    if (!inAutoRange) {
      actHeader.addEventListener('click', () => {
        _story2.actExpanded[ai] = !_story2.actExpanded[ai];
        _saveStory2();
        openStoryMenu(); // re-render
      });
    }
    list.appendChild(actHeader);

    if (!isFullRender) {
      // Compact hint — click the header above to expand
      const summary = document.createElement('div');
      summary.style.cssText = 'padding:2px 12px 7px;font-size:0.60rem;color:#445;';
      summary.textContent = actComplete ? '✓ Completed — click to expand' : actDone > 0 ? `${actDone}/${actTotal} done — click to expand` : 'Locked — click to expand';
      list.appendChild(summary);
      return;
    }

    // ── Render arcs within this act ─────────────────────────────────────────
    act.arcs.forEach(arc => {
      const arcUnlocked  = _isArcUnlocked(arc);
      const arcComplete  = _isArcComplete(arc);
      const isCurrentArc = arc.id === curArcId;
      const { done: arcDone, total: arcTotal } = _getArcProgress(arc);
      // Default: current arc expanded, others collapsed (unless user toggled)
      const collapsed = _story2.arcCollapsed.hasOwnProperty(arc.id)
        ? _story2.arcCollapsed[arc.id]
        : !isCurrentArc;

      // Arc sub-header
      const arcRow = document.createElement('div');
      arcRow.style.cssText = [
        'display:flex', 'align-items:center', 'gap:7px',
        'padding:6px 14px 5px',
        `background:${isCurrentArc ? 'rgba(120,170,255,0.07)' : 'transparent'}`,
        'border-radius:6px', 'margin:2px 0',
        arcUnlocked ? 'cursor:pointer' : 'cursor:default',
        `opacity:${arcUnlocked ? '1' : '0.35'}`,
      ].join(';');
      arcRow.innerHTML =
        `<span style="font-size:0.7rem;color:#667;transition:transform 0.18s;display:inline-block;transform:rotate(${collapsed ? '0' : '90'}deg);">▶</span>` +
        `<span style="font-size:0.72rem;color:${arcComplete ? '#66ee99' : isCurrentArc ? '#aacfff' : '#889'};flex:1;">${arc.label}</span>` +
        `<span style="font-size:0.58rem;color:${arcComplete ? '#66ee99' : '#556'};">${arcDone}/${arcTotal}</span>`;

      if (arcUnlocked) {
        arcRow.addEventListener('click', () => _toggleArcCollapse(arc.id));
      }
      list.appendChild(arcRow);

      if (collapsed) return;

      // ── Chapter rows ──────────────────────────────────────────────────────
      for (let i = arc.chapterRange[0]; i <= arc.chapterRange[1]; i++) {
        const ch      = STORY_CHAPTERS2[i];
        const done    = _story2.defeated.includes(i);
        const current = i === cur;
        const locked  = !arcUnlocked || i > cur;

        const borderCol = done ? 'rgba(80,220,120,0.35)' : current ? 'rgba(120,170,255,0.40)' : 'rgba(255,255,255,0.07)';
        const bgCol     = done ? 'rgba(30,90,55,0.28)'   : current ? 'rgba(25,55,110,0.35)'   : 'rgba(10,10,30,0.20)';

        const el = document.createElement('div');
        el.style.cssText = [
          'display:flex', 'align-items:center', 'gap:11px',
          'padding:8px 14px 8px 26px', 'border-radius:8px', 'margin-bottom:3px',
          `border:1px solid ${borderCol}`, `background:${bgCol}`,
          `opacity:${locked ? '0.30' : '1'}`,
          'transition:background 0.14s,border-color 0.14s',
          locked ? 'cursor:default' : 'cursor:pointer',
        ].join(';');

        const statusEl = document.createElement('span');
        statusEl.style.cssText = 'font-size:0.72rem;min-width:16px;text-align:center;flex-shrink:0;';
        statusEl.textContent    = done ? '✓' : locked ? '🔒' : current ? '▶' : String(i + 1);
        statusEl.style.color    = done ? '#66ee99' : current ? '#aacfff' : '#445';

        const livesTag = (!locked && !done && ch.playerLives === 1)
          ? `<span style="font-size:0.54rem;color:#ff5533;background:rgba(255,50,20,0.15);border:1px solid rgba(255,50,20,0.30);border-radius:3px;padding:1px 4px;margin-left:4px;">1 life</span>`
          : (!locked && !done && ch.playerLives === 2)
          ? `<span style="font-size:0.54rem;color:#ffaa44;background:rgba(255,140,0,0.08);border:1px solid rgba(255,140,0,0.25);border-radius:3px;padding:1px 4px;margin-left:4px;">2 lives</span>`
          : '';
        const rewardTag = (!done && ch.tokenReward)
          ? `<span style="font-size:0.54rem;color:#998833;margin-left:3px;">+${ch.tokenReward}🪙</span>` : '';
        const bpTag = (!done && ch.blueprintDrop && STORY_ABILITIES2[ch.blueprintDrop])
          ? `<span style="font-size:0.54rem;color:#5577bb;margin-left:2px;">📋</span>` : '';
        const replayTag = (done)
          ? `<span style="font-size:0.52rem;color:#667;margin-left:4px;border:1px solid #334;border-radius:3px;padding:1px 4px;">replay</span>` : '';

        // Spoiler-safe: redact boss/trueform fights that are locked
        const isSpoilerChapter = (ch.isBossFight || ch.isTrueFormFight);
        const isSpoilerLocked  = locked && !done && isSpoilerChapter;
        const isDeepLocked     = locked && !done && i > cur + 3 && isSpoilerChapter;
        let displayTitle = ch.title;
        let displayWorld = ch.world || '';
        if (isSpoilerLocked) {
          displayTitle = ch.isTrueFormFight ? '??? Final Entity' : '??? Boss Encounter';
          displayWorld = 'Unknown Zone';
        }

        const infoEl = document.createElement('div');
        infoEl.style.cssText = 'flex:1;min-width:0;line-height:1.3;';
        infoEl.innerHTML =
          `<div style="display:flex;align-items:center;flex-wrap:wrap;gap:2px;">` +
            `<span style="font-size:0.81rem;color:${done ? '#88ffaa' : current ? '#dde4ff' : '#556'};">${displayTitle}</span>` +
            (isSpoilerLocked ? '' : livesTag + rewardTag + bpTag) + replayTag +
          `</div>` +
          `<div style="font-size:0.60rem;color:#4a4a6a;margin-top:1px;">${displayWorld}</div>`;

        if (isSpoilerLocked) {
          infoEl.title = "You're not supposed to see that yet.";
        }
        if (isDeepLocked) {
          el.style.filter = 'brightness(0.7)';
        }

        el.appendChild(statusEl);
        el.appendChild(infoEl);

        if (!locked) {
          el.addEventListener('click', () => { _beginChapter2(i); });
          el.addEventListener('mouseover', () => {
            el.style.background  = done ? 'rgba(30,100,60,0.45)' : 'rgba(35,70,160,0.50)';
            el.style.borderColor = done ? 'rgba(80,220,120,0.55)' : 'rgba(120,170,255,0.60)';
          });
          el.addEventListener('mouseout', () => {
            el.style.background  = bgCol;
            el.style.borderColor = borderCol;
          });
        }
        list.appendChild(el);
      }
    });
  });
}

// ── In-fight script ticker — call every game frame ───────────────────────────
function storyTickFightScript() {
  if (!gameRunning || !storyModeActive) return;
  if (storyFightScriptIdx >= storyFightScript.length) return;
  const entry = storyFightScript[storyFightScriptIdx];
  if (frameCount >= entry.frame) {
    const dur = entry.timer || 220;
    storyFightSubtitle = { text: entry.text, timer: dur, maxTimer: dur, color: entry.color, speaker: entry.speaker || null };
    storyFightScriptIdx++;
  }
}

// ── Level complete (called from endGame) ─────────────────────────────────────
function storyOnMatchEnd(playerWon) {
  if (!storyModeActive) return;
  storyFightSubtitle = null;
  if (typeof story2OnMatchEnd === 'function' && _activeStory2Chapter) {
    story2OnMatchEnd(playerWon);
  }
}

// ── Back to menu ──────────────────────────────────────────────────────────────
function storyOnBackToMenu() {
  if (!storyModeActive) return;
  storyModeActive     = false;
  storyPlayerOverride = null;
  storyFightSubtitle  = null;
  storyFightScript    = [];
  storyPhaseIndicator = null;
  storyGauntletState  = null;
  storyPendingPhaseConfig = null;
  storyCameraLock = null;
  exploreSidePortals = [];
  exploreArenaLock = null;
  setTimeout(openStoryMenu, 300);
}

function getDifficultyMultiplier(chapterId) {
  return 1 + (chapterId * 0.08);
}

// ── Unified balance scaling ────────────────────────────────────────────────────
// Returns raw (unclamped) stat targets for a given original chapter index.
// Clamps are applied by _storyScaleEnemyUnit before writing to a fighter.
function getScaling(chapter) {
  const base = 1 + chapter * 0.08;
  return {
    enemyHP:     100 * base,   // standard enemy HP target
    enemyDamage: 12  * base,   // damage per hit target (pre-weapon-multiplier)
    bossHP:      600 * base,   // boss HP target (used for Fallen God / custom bosses)
    bossDamage:  18  * base,   // boss damage per hit target
  };
}

function _storyPerformanceBonus() {
  const run = _story2 && _story2.runState;
  if (!run) return 0;
  let bonus = 0;
  if ((run.healthPct || 1) > 0.72) bonus += 0.06;
  if ((run.noDeathChain || 0) >= 2) bonus += 0.04;
  return bonus;
}

function _storyDifficultyForChapter(chapterId, elite = false) {
  const mult = getDifficultyMultiplier(chapterId) + _storyPerformanceBonus();
  return elite ? mult * 1.18 : mult;
}

function _storyPhaseName(type) {
  if (type === 'traversal') return 'Traversal';
  if (type === 'arena_lock') return 'Arena Lock';
  if (type === 'hazard_phase') return 'Hazard Surge';
  if (type === 'elite_wave') return 'Elite Wave';
  if (type === 'mini_boss') return 'Mini Boss';
  return 'Phase';
}

function _storyCloneEnemyDef(base, extra = {}) {
  const src = base || {};
  return {
    name: src.name || src.opponentName || 'Enemy',
    weaponKey: src.weaponKey || 'sword',
    classKey: src.classKey || 'warrior',
    aiDiff: src.aiDiff || 'medium',
    color: src.color || src.opponentColor || '#778899',
    armor: src.armor ? [...src.armor] : [],
    health: src.health,
    isElite: !!src.isElite,
    ...extra,
  };
}

function _storyBuildPhases(ch) {
  if (Array.isArray(ch.phases) && ch.phases.length >= 3) return ch.phases;

  const diffTier = ch.id >= 45 ? 'expert' : ch.id >= 25 ? 'hard' : ch.id >= 10 ? 'medium' : 'easy';
  const eliteAI  = ch.id >= 40 ? 'expert' : 'hard';
  const baseEnemy = _storyCloneEnemyDef(ch, {
    name: ch.opponentName || ch.title,
    weaponKey: ch.weaponKey || 'sword',
    classKey: ch.classKey || 'warrior',
    aiDiff: ch.aiDiff || diffTier,
    color: ch.opponentColor || '#778899',
    armor: ch.armor || [],
  });
  const supportEnemy = _storyCloneEnemyDef(baseEnemy, {
    name: `${baseEnemy.name} Support`,
    weaponKey: ch.id >= 14 ? 'spear' : 'sword',
    classKey: ch.id >= 18 ? 'assassin' : 'warrior',
    aiDiff: diffTier,
    color: '#667788',
  });
  const eliteEnemy = _storyCloneEnemyDef(baseEnemy, {
    name: `${baseEnemy.name} Elite`,
    weaponKey: ch.id >= 12 ? (ch.weaponKey || 'axe') : 'sword',
    classKey: ch.id >= 15 ? 'warrior' : 'none',
    aiDiff: eliteAI,
    color: '#b36b3f',
    armor: [...new Set([...(baseEnemy.armor || []), 'helmet'])],
    isElite: true,
  });

  if (ch.type === 'exploration') {
    const worldLen = Math.max(5600, ch.worldLength || 5600);
    ch.phases = [
      {
        type: 'traversal',
        label: ch.objectName || 'Advance',
        worldLength: Math.floor(worldLen * 0.72),
        objectName: `${ch.objectName || 'Forward Route'} Relay`,
        spawnEnemies: (ch.spawnEnemies || []).slice(0, Math.max(4, Math.ceil((ch.spawnEnemies || []).length * 0.45))),
      },
      {
        type: 'arena_lock',
        label: 'Hold The Route',
        arena: ch.arena || 'homeAlley',
        opponents: [supportEnemy, _storyCloneEnemyDef(supportEnemy, { name: 'Lockdown Guard', weaponKey: 'hammer', classKey: 'tank', color: '#556677' })],
        playerLives: ch.playerLives || 3,
      },
      {
        type: ch.id >= 12 ? 'hazard_phase' : 'elite_wave',
        label: ch.id >= 12 ? 'Instability Surge' : 'Pressure Spike',
        arena: ch.id >= 10 ? 'lava' : (ch.arena || 'homeAlley'),
        opponents: [eliteEnemy, supportEnemy],
        playerLives: ch.playerLives || 3,
      },
      {
        type: 'mini_boss',
        label: ch.opponentName || 'Final Guard',
        arena: ch.arena || 'homeAlley',
        opponents: [_storyCloneEnemyDef(ch.opponentName ? baseEnemy : eliteEnemy, {
          name: ch.opponentName || 'Route Breaker',
          weaponKey: ch.weaponKey || eliteEnemy.weaponKey || 'hammer',
          classKey: ch.classKey || eliteEnemy.classKey || 'warrior',
          aiDiff: ch.aiDiff || eliteAI,
          color: ch.opponentColor || '#775588',
          isElite: true,
          armor: [...new Set([...(ch.armor || []), 'helmet'])],
        })],
        finalChapter: true,
        playerLives: ch.playerLives || 3,
      },
    ];
  } else {
    ch.phases = [
      {
        type: 'arena_lock',
        label: 'Opening Clash',
        arena: ch.arena || 'homeAlley',
        opponents: [supportEnemy],
        playerLives: Math.max(2, ch.playerLives || 3),
      },
      {
        type: ch.id >= 9 ? 'hazard_phase' : 'elite_wave',
        label: ch.id >= 9 ? 'Field Distortion' : 'Pressure Wave',
        arena: ch.id >= 10 ? 'lava' : (ch.arena || 'homeAlley'),
        opponents: ch.id >= 8 ? [eliteEnemy, supportEnemy] : [eliteEnemy],
        playerLives: Math.max(2, ch.playerLives || 3),
      },
      {
        type: 'mini_boss',
        label: ch.opponentName || 'Final Duel',
        arena: ch.arena || 'homeAlley',
        finalChapter: true,
        playerLives: ch.playerLives || 3,
      },
    ];
    if (ch.id >= 16) {
      ch.phases.splice(1, 0, {
        type: 'elite_wave',
        label: 'Elite Intercept',
        arena: ch.arena || 'space',
        opponents: [eliteEnemy, _storyCloneEnemyDef(eliteEnemy, { name: 'Fracture Elite', weaponKey: 'spear', classKey: 'ninja', color: '#8855cc', isElite: true })],
        playerLives: Math.max(2, ch.playerLives || 3),
      });
    }
  }
  return ch.phases;
}

function _storyGetCurrentPhase() {
  return storyGauntletState && storyGauntletState.phases
    ? storyGauntletState.phases[storyGauntletState.index] || null
    : null;
}

function _storyUpdatePhaseIndicator() {
  const phase = _storyGetCurrentPhase();
  if (!storyGauntletState || !phase) {
    storyPhaseIndicator = null;
    return;
  }
  storyPhaseIndicator = {
    index: storyGauntletState.index + 1,
    total: storyGauntletState.phases.length,
    label: phase.label || _storyPhaseName(phase.type),
    type: phase.type,
  };
}

function _storyGetCarryHealthPct() {
  const run = _story2 && _story2.runState;
  return run && typeof run.healthPct === 'number' ? clamp(run.healthPct, 0.18, 1.0) : 1;
}

function _storySetCarryHealthPct(pct) {
  if (!_story2.runState) _story2.runState = { healthPct: 1, noDeathChain: 0 };
  _story2.runState.healthPct = clamp(pct, 0.18, 1.0);
}

function _storyBuildShopItems() {
  const up = _story2.metaUpgrades || { damage: 0, survivability: 0, healUses: 0 };
  return [
    {
      key: 'chapter_heal',
      icon: '💉',
      name: 'Field Treatment',
      desc: 'Restore 35% chapter health carryover before the next chapter. Cannot heal above 90%.',
      tokenCost: 18 + up.healUses * 10,
      canBuy: () => _storyGetCarryHealthPct() < 0.9,
      buy() {
        _storySetCarryHealthPct(Math.min(0.9, _storyGetCarryHealthPct() + 0.35));
        up.healUses++;
      },
    },
    {
      key: 'meta_damage',
      icon: '⚔️',
      name: 'Damage Upgrade',
      desc: 'Permanent +8% story damage. Cost scales each rank.',
      tokenCost: 28 + up.damage * 20,
      canBuy: () => up.damage < 6,
      buy() { up.damage++; },
    },
    {
      key: 'meta_survivability',
      icon: '🛡️',
      name: 'Survivability Upgrade',
      desc: 'Permanent +10 max HP and minor damage reduction in Story Mode.',
      tokenCost: 30 + up.survivability * 22,
      canBuy: () => up.survivability < 6,
      buy() { up.survivability++; },
    },
  ];
}

// ── Save integration ─────────────────────────────────────────────────────────
function getStoryDataForSave() {
  return typeof _story2 !== 'undefined' ? JSON.parse(JSON.stringify(_story2)) : null;
}

function restoreStoryDataFromSave(data) {
  if (!data || !data.defeated) return;
  Object.assign(_story2, data);
  _saveStory2();
}

// ============================================================
// STORY MODE v2 — Chapter Progression, Tokens, Blueprints,
//                 Ability Store, Story Online unlock
// ============================================================

// ============================================================
// STORY SKILL TREE
// ============================================================
// ── Skill Tree ────────────────────────────────────────────────────────────────
// Layout: each branch has a root node(s), with child chains.
// `requires` is a single parent nodeId (or null for root).
// `requiresAny` is an array of alternative parents (unlocked if ANY is met).
// The renderer builds the visual tree from these dependency relationships.
const STORY_SKILL_TREE = {
  mobility: {
    label: 'Mobility',
    color: '#44ffaa',
    icon: '🏃',
    nodes: [
      { id: 'highJump1',      name: 'Stronger Legs',       desc: 'Jump 15% higher',                           expCost: 25,  requires: null },
      { id: 'highJump2',      name: 'Leap Training',        desc: 'Jump 25% higher total',                     expCost: 45,  requires: 'highJump1' },
      { id: 'doubleJump',     name: 'Double Jump',          desc: 'Press W again while airborne',              expCost: 80,  requires: 'highJump2' },
      { id: 'airDash',        name: 'Air Dash',             desc: 'Double-tap ← or → while airborne to dash',  expCost: 120, requires: 'doubleJump' },
      { id: 'fastFall',       name: 'Fast Fall',            desc: 'Hold S in air to drop fast; cancel lag',    expCost: 55,  requires: 'highJump2' },
    ],
  },
  combat: {
    label: 'Combat',
    color: '#ff8844',
    icon: '⚔️',
    nodes: [
      { id: 'heavyHit1',      name: 'Stronger Strikes',     desc: '+15% attack damage',                        expCost: 25,  requires: null },
      { id: 'heavyHit2',      name: 'Power Blows',          desc: '+25% damage total',                         expCost: 45,  requires: 'heavyHit1' },
      { id: 'weaponAbility',  name: 'Weapon Mastery',       desc: 'Unlock weapon Q-ability',                   expCost: 80,  requires: 'heavyHit2' },
      { id: 'comboExtender',  name: 'Combo Flow',           desc: 'One extra hit before combo limiter kicks in',expCost: 100, requires: 'weaponAbility' },
      { id: 'criticalEdge',   name: 'Critical Edge',        desc: '8% chance to deal 2× damage on any hit',    expCost: 140, requires: 'comboExtender' },
      { id: 'impactShield',   name: 'Impact Shield',        desc: 'Q while shielding: slam forward 15 dmg + stagger (3s CD)', expCost: 60, requires: 'heavyHit1' },
    ],
  },
  resilience: {
    label: 'Resilience',
    color: '#88aaff',
    icon: '🛡️',
    nodes: [
      { id: 'tankier1',       name: 'Tougher Body',         desc: '+15 max HP',                                expCost: 25,  requires: null },
      { id: 'tankier2',       name: 'Hardened',             desc: '+25 max HP total',                          expCost: 45,  requires: 'tankier1' },
      { id: 'superMeter',     name: 'Inner Power',          desc: 'Unlock Super meter (E key)',                 expCost: 80,  requires: 'tankier2' },
      { id: 'tankier3',       name: 'Iron Frame',           desc: '+40 max HP total',                          expCost: 70,  requires: 'tankier2' },
      { id: 'dimensionalPatch', name: 'Dimensional Patch',  desc: 'Once per match, Q heals 30% max HP',         expCost: 50,  requires: 'tankier1' },
      { id: 'voidStep',       name: 'Void Step',            desc: 'Below 30% HP: one-time +50% speed for 5s',  expCost: 85,  requires: 'dimensionalPatch' },
    ],
  },
  speed: {
    label: 'Speed',
    color: '#ffee44',
    icon: '⚡',
    nodes: [
      { id: 'fastMove1',      name: 'Quick Feet',           desc: 'Move 10% faster',                           expCost: 20,  requires: null },
      { id: 'fastMove2',      name: 'Sprint Training',      desc: 'Move 20% faster total',                     expCost: 40,  requires: 'fastMove1' },
      { id: 'fastMove3',      name: 'Blur Step',            desc: 'Move 30% faster total',                     expCost: 75,  requires: 'fastMove2' },
      { id: 'fractureSurge',  name: 'Fracture Surge',       desc: 'Super meter charges 40% faster',            expCost: 75,  requires: 'fastMove1' },
    ],
  },
  survival: {
    label: 'Survival',
    color: '#ff5588',
    icon: '❤️',
    nodes: [
      { id: 'lastStrike',     name: 'Last Strike',          desc: 'Below 10% HP: next attack deals 2× damage (once per life)', expCost: 60, requires: null },
      { id: 'echoRage',       name: 'Echo Rage',            desc: '3 rapid hits trigger rage: next 5 attacks 3× damage',       expCost: 110, requires: 'lastStrike' },
      { id: 'mirrorFracture', name: 'Mirror Fracture',      desc: 'While shielding, reflect 25% damage back at attacker',      expCost: 90,  requires: 'lastStrike' },
      { id: 'temporalBreak',  name: 'Temporal Break',       desc: 'Below 20% HP: freeze all enemies 2s once per match',        expCost: 180, requires: 'echoRage' },
    ],
  },
  mastery: {
    label: 'Mastery',
    color: '#cc88ff',
    icon: '🌀',
    // Root requires any tier-2 node from another branch (gate behind progression)
    nodes: [
      { id: 'masterRoot',     name: 'Fragment Sync',        desc: 'Reduces all ability cooldowns by 15%',      expCost: 100, requires: null, requiresAny: ['heavyHit2','tankier2','fastMove2'] },
      { id: 'fragmentHunger', name: 'Fragment Hunger',      desc: 'Each kill: +8% damage stacked (max 5 kills, resets on death)', expCost: 130, requires: 'masterRoot' },
      { id: 'architects',     name: 'Architects\' Resolve', desc: 'Once per match: auto-revive at 25% HP when you would die', expCost: 160, requires: 'masterRoot' },
      { id: 'coreCollapse',   name: 'Core Collapse',        desc: 'Once per match, super deals 60% of enemy max HP',           expCost: 350, requires: 'architects' },
    ],
  },
};

// Apply purchased skill tree bonuses to a fighter in story mode
function _applySkillTreeToPlayer(p) {
  if (!p || !_story2.skillTree) return;
  const sk = _story2.skillTree;
  // Jump
  p._storyJumpMult = 1.0 + (sk.highJump2 ? 0.25 : sk.highJump1 ? 0.15 : 0);
  if (p._storyNoDoubleJump !== undefined) p._storyNoDoubleJump = !sk.doubleJump;
  // HP bonus (stacking tiers)
  const hpBonus = (sk.tankier3 ? 40 : sk.tankier2 ? 25 : sk.tankier1 ? 15 : 0);
  if (hpBonus > 0) {
    p.maxHealth = (p.maxHealth || 100) + hpBonus;
    p.health    = Math.min(p.health + hpBonus, p.maxHealth);
  }
  // Speed
  const speedBonus = sk.fastMove3 ? 0.30 : sk.fastMove2 ? 0.20 : sk.fastMove1 ? 0.10 : 0;
  if (speedBonus > 0) p._storySpeedMult = 1.0 + speedBonus;
  // Damage
  const dmgBonus = sk.heavyHit2 ? 0.25 : sk.heavyHit1 ? 0.15 : 0;
  if (dmgBonus > 0) p._storyDmgMult = 1.0 + dmgBonus;
  // Skill flags (consumed by game systems already checking _story2.skillTree)
  p._skillAirDash        = !!sk.airDash;
  p._skillImpactShield   = !!sk.impactShield;
  p._skillDimensionalPatch = !!sk.dimensionalPatch;
  p._skillVoidStep       = !!sk.voidStep;
  p._skillFractureSurge  = !!sk.fractureSurge;
  p._skillEchoRage       = !!sk.echoRage;
  p._skillMirrorFracture = !!sk.mirrorFracture;
  p._skillFragmentHunger = !!sk.fragmentHunger;
  p._skillArchitects     = !!sk.architects;
  p._skillCoreCollapse   = !!sk.coreCollapse;
  p._skillLastStrike     = !!sk.lastStrike;
  p._skillTemporalBreak  = !!sk.temporalBreak;
  p._skillCriticalEdge   = !!sk.criticalEdge;
  p._skillCooldownReduction = !!sk.masterRoot ? 0.15 : 0;
}

// Award EXP to the player for a story kill
function _storyAwardKillExp(amount) {
  if (!storyModeActive) return;
  _story2.exp = (_story2.exp || 0) + amount;
  _saveStory2();
  if (players[0] && typeof DamageText !== 'undefined') {
    const dt = new DamageText(`+${amount} EXP`, players[0].cx(), players[0].y - 30, '#aaff88');
    damageTexts.push(dt);
  }
  _storyUpdateExpDisplay();
}

function _storyUpdateExpDisplay() {
  const el = document.getElementById('storyExpDisplay');
  if (el) el.textContent = `${_story2.exp || 0} EXP`;
}

// ── Persistent state (separate key to avoid collision with v1) ───────────────
const _STORY2_KEY = 'smc_story2';

function _defaultStory2Progress() {
  return {
    chapter:           0,       // index into STORY_CHAPTERS2 (next to play)
    tokens:            0,
    exp:               0,       // EXP earned from kills — used for skill tree
    blueprints:        [],      // blueprint keys earned
    unlockedAbilities: [],      // ability keys bought from store
    skillTree:         {},      // { nodeId: true } — purchased skill nodes
    defeated:          [],      // chapter indices completed
    storyComplete:     false,
    runState:          { healthPct: 1, noDeathChain: 0 },
    metaUpgrades:      { damage: 0, survivability: 0, healUses: 0 },
    // v3 hierarchy fields — added by migration for old saves
    arcCollapsed:      {},      // { arcId: bool } — user-toggled arc collapse state
    actExpanded:       {},      // { actIndex: bool } — user forced an out-of-range act open
  };
}

let _story2 = (function() {
  try {
    const raw = localStorage.getItem(_STORY2_KEY);
    if (!raw) return _defaultStory2Progress();
    const p = JSON.parse(raw);
    if (!p || !Array.isArray(p.defeated)) return _defaultStory2Progress();
    // Migration: ensure v3 fields exist on old saves
    if (!p.arcCollapsed || typeof p.arcCollapsed !== 'object') p.arcCollapsed = {};
    if (!p.actExpanded  || typeof p.actExpanded  !== 'object') p.actExpanded  = {};
    if (!p.runState || typeof p.runState !== 'object') p.runState = { healthPct: 1, noDeathChain: 0 };
    if (!p.metaUpgrades || typeof p.metaUpgrades !== 'object') p.metaUpgrades = { damage: 0, survivability: 0, healUses: 0 };
    if (typeof p.exp !== 'number') p.exp = 0;
    if (!p.skillTree || typeof p.skillTree !== 'object') p.skillTree = {};
    return p;
  } catch(e) { return _defaultStory2Progress(); }
})();

function _saveStory2() {
  try { localStorage.setItem(_STORY2_KEY, JSON.stringify(_story2)); } catch(e) {}
}

// ── Act/Arc hierarchy helpers ─────────────────────────────────────────────────
function _getActForChapter(idx) {
  for (const act of STORY_ACT_STRUCTURE) {
    for (const arc of act.arcs) {
      if (idx >= arc.chapterRange[0] && idx <= arc.chapterRange[1]) return act;
    }
  }
  return null;
}
function _getArcForChapter(idx) {
  for (const act of STORY_ACT_STRUCTURE) {
    for (const arc of act.arcs) {
      if (idx >= arc.chapterRange[0] && idx <= arc.chapterRange[1]) return arc;
    }
  }
  return null;
}
function _isArcComplete(arc) {
  for (let i = arc.chapterRange[0]; i <= arc.chapterRange[1]; i++) {
    if (!_story2.defeated.includes(i)) return false;
  }
  return true;
}
function _isArcUnlocked(arc) {
  // First arc of first act is always unlocked
  const firstArc = STORY_ACT_STRUCTURE[0].arcs[0];
  if (arc.id === firstArc.id) return true;

  // Fallen God arc unlocks directly from Act V completion (not multiverse).
  // This ensures the revelation lore fires before the Creator domain,
  // removing the postgame/multiverse-completion dependency.
  if (arc.id === 'arc5-godfall') {
    const actV = STORY_ACT_STRUCTURE.find(a => a.id === 'act5');
    if (actV) return _isArcComplete(actV.arcs[actV.arcs.length - 1]);
    return false;
  }

  // Multiverse arcs (arc4mv-*) additionally require the Axiom Ship to be built.
  // The trials were designed for a traveler with a stable vessel — not before.
  if (arc.id && arc.id.startsWith('arc4mv')) {
    if (!window.SHIP || !SHIP.built) return false;
  }

  // An arc is unlocked if all chapters in the previous arc are complete
  for (let ai = 0; ai < STORY_ACT_STRUCTURE.length; ai++) {
    const act = STORY_ACT_STRUCTURE[ai];
    for (let ri = 0; ri < act.arcs.length; ri++) {
      if (act.arcs[ri].id === arc.id) {
        // get previous arc
        if (ri > 0) return _isArcComplete(act.arcs[ri - 1]);
        if (ai > 0) {
          const prevAct = STORY_ACT_STRUCTURE[ai - 1];
          return _isArcComplete(prevAct.arcs[prevAct.arcs.length - 1]);
        }
      }
    }
  }
  return false;
}
function _getArcProgress(arc) {
  let done = 0;
  const total = arc.chapterRange[1] - arc.chapterRange[0] + 1;
  for (let i = arc.chapterRange[0]; i <= arc.chapterRange[1]; i++) {
    if (_story2.defeated.includes(i)) done++;
  }
  return { done, total };
}
function _getCurrentArcId() {
  const arc = _getArcForChapter(_story2.chapter);
  return arc ? arc.id : null;
}
function _toggleArcCollapse(arcId) {
  _story2.arcCollapsed[arcId] = !_story2.arcCollapsed[arcId];
  _saveStory2();
  _renderChapterList();
}

// ── Armor application ─────────────────────────────────────────────────────────
// Called for exploration chapter enemies that have armor defs in their spawn entry.
function storyApplyArmor(fighter, armorArray) {
  if (!fighter || !armorArray || !armorArray.length) return;
  fighter.armorPieces = Array.isArray(fighter.armorPieces)
    ? [...new Set([...fighter.armorPieces, ...armorArray])]
    : [...armorArray];
  // Visual feedback: brief armor-tint flash
  fighter._armorFlash = 12;
}

// ── Ability application at fight start ───────────────────────────────────────
// Called from _onStoryFightStart() when storyModeActive and _activeStory2Chapter is set.
function _applyStory2Abilities(p1) {
  if (!p1 || !_story2.unlockedAbilities.length) return;
  const ua = _story2.unlockedAbilities;

  // Attach ability set for fast lookup in dealDamage / tick
  p1.story2Abilities = new Set(ua);

  // Reset per-fight ability state
  storyAbilityState = {
    medkitUsed:      false,
    lastStandFired:  false,
    voidStepFired:   false,
    worldBreakUsed:  false,
    killStacks:      0,         // berserker_blood2
    hitStreak:       0,         // rage_mode2 consecutive hit counter
    rageAttacksLeft: 0,         // rage_mode2 powered attacks remaining
    ghostStepCd:     0,         // fracture step cooldown (frames)
    shieldBashCd:    0,         // shield_bash2 cooldown (frames)
  };

  // fracture_surge2: super charges 40% faster — set multiplier on fighter
  if (ua.includes('fracture_surge2')) {
    p1._superChargeMult = (p1._superChargeMult || 1) * 1.4;
  }
}

// ── Per-frame ability tick ─────────────────────────────────────────────────────
// Called every frame from storyCheckEvents() when storyModeActive.
function storyTickAbilities() {
  const p1 = players && players[0];
  if (!p1 || !p1.story2Abilities || p1.health <= 0) return;

  const ua  = p1.story2Abilities;
  const abs = storyAbilityState;

  // Cool down timers
  if (abs.ghostStepCd  > 0) abs.ghostStepCd--;
  if (abs.shieldBashCd > 0) abs.shieldBashCd--;

  // last_stand2: below 15% HP → +60% speed + 2× dmg for 8s (one shot)
  if (ua.has('last_stand2') && !abs.lastStandFired && p1.health / p1.maxHealth < 0.15 && p1.health > 0) {
    abs.lastStandFired = true;
    const baseSpeed = p1.speed;
    const baseDmg   = p1.dmgMult || 1;
    p1.speed   = baseSpeed * 1.6;
    p1.dmgMult = baseDmg   * 2.0;
    storyFightSubtitle = { text: '🔥 LAST STAND — Speed & Damage doubled!', timer: 200, maxTimer: 200, color: '#ff4400' };
    spawnParticles(p1.cx(), p1.cy(), '#ff4400', 20);
    setTimeout(() => {
      if (p1.health > 0) { p1.speed = baseSpeed; p1.dmgMult = baseDmg; }
    }, 8000);
  }

  // void_step2: below 30% HP → +50% speed for 5s (one shot)
  if (ua.has('void_step2') && !abs.voidStepFired && p1.health / p1.maxHealth < 0.30 && p1.health > 0) {
    abs.voidStepFired = true;
    const baseSpeed = p1.speed;
    p1.speed = baseSpeed * 1.5;
    storyFightSubtitle = { text: '🌑 VOID STEP — Speed surge activated!', timer: 160, maxTimer: 160, color: '#8844ff' };
    spawnParticles(p1.cx(), p1.cy(), '#8844ff', 14);
    setTimeout(() => { if (p1.health > 0) p1.speed = baseSpeed; }, 5000);
  }

  // medkit2: ability key (Q) heals 30% max HP once per match
  // We intercept ability use via p1._story2AbilityPending flag set in Fighter.ability()
  if (ua.has('medkit2') && !abs.medkitUsed && p1._story2AbilityPending) {
    p1._story2AbilityPending = false;
    abs.medkitUsed = true;
    const heal = Math.floor(p1.maxHealth * 0.30);
    p1.health = Math.min(p1.maxHealth, p1.health + heal);
    storyFightSubtitle = { text: `💊 Dimensional Patch — +${heal} HP`, timer: 180, maxTimer: 180, color: '#44ff99' };
    spawnParticles(p1.cx(), p1.cy(), '#44ff99', 16);
  } else if (p1._story2AbilityPending) {
    p1._story2AbilityPending = false; // consumed
  }

  // berserker_blood2: kill stacks applied in storyOnEnemyDeath
  if (ua.has('berserker_blood2') && abs.killStacks > 0) {
    p1.dmgMult = (p1._story2BaseDmg || 1) * (1 + abs.killStacks * 0.08);
  }

  // rage_mode2: rageAttacksLeft > 0 sets dmg boost flag on fighter
  if (ua.has('rage_mode2')) {
    p1._story2RageMult = abs.rageAttacksLeft > 0 ? 3.0 : 1.0;
  }
}

// Extend storyOnEnemyDeath to handle berserker_blood2 kill stacks
const _origStoryOnEnemyDeath = typeof storyOnEnemyDeath !== 'undefined' ? storyOnEnemyDeath : null;
function storyOnEnemyDeath(victim, killer) {
  if (_origStoryOnEnemyDeath) _origStoryOnEnemyDeath(victim, killer);
  const p1 = players && players[0];
  if (!p1 || killer !== p1 || !p1.story2Abilities) return;
  if (p1.story2Abilities.has('berserker_blood2')) {
    storyAbilityState.killStacks = Math.min(5, (storyAbilityState.killStacks || 0) + 1);
    storyFightSubtitle = { text: `🩸 Fragment Hunger: ${storyAbilityState.killStacks} stack${storyAbilityState.killStacks > 1 ? 's' : ''}`, timer: 120, maxTimer: 120, color: '#cc2244' };
  }
}

// ── Pre-fight store nag modal ─────────────────────────────────────────────────
// Shows a modal with chapter warning + "Go to Store" / "Continue" when ch.storeNag set.
const _seenStoreNagIds = new Set();
function _showPreFightStoreNag(ch, onContinue) {
  // Only show once per chapter per session
  if (!ch.storeNag || _seenStoreNagIds.has(ch.id)) { onContinue(); return; }
  _seenStoreNagIds.add(ch.id);

  let ov = document.getElementById('_storyPreFightNagOverlay');
  if (!ov) {
    ov = document.createElement('div');
    ov.id = '_storyPreFightNagOverlay';
    ov.style.cssText = [
      'position:fixed','inset:0','z-index:9500',
      'display:flex','align-items:center','justify-content:center',
      'background:rgba(0,0,0,0.82)',
    ].join(';');
    document.body.appendChild(ov);
  }

  const affordable = Object.entries(STORY_ABILITIES2).filter(([key, ab]) => {
    const owned = _story2.unlockedAbilities.includes(key);
    const hasBP = !ab.requiresBlueprint || _story2.blueprints.includes(key);
    return !owned && hasBP && _story2.tokens >= ab.tokenCost;
  });

  ov.innerHTML = `
    <div style="background:rgba(10,6,26,0.98);border:1px solid rgba(255,80,50,0.45);border-radius:14px;padding:24px 28px;max-width:360px;width:92vw;font-family:'Segoe UI',Arial,sans-serif;text-align:center;">
      <div style="font-size:1.3rem;font-weight:800;color:#ff8855;margin-bottom:8px;">⚠️ Warning</div>
      <div style="font-size:0.86rem;color:#ddc;line-height:1.55;margin-bottom:14px;">${ch.storeNag}</div>
      ${affordable.length > 0 ? `
        <div style="font-size:0.78rem;color:#ffcc66;margin-bottom:12px;">
          You can afford <b>${affordable.length}</b> upgrade${affordable.length > 1 ? 's' : ''} right now (${_story2.tokens} 🪙)
        </div>
      ` : `
        <div style="font-size:0.78rem;color:#998;margin-bottom:12px;">Tokens: ${_story2.tokens} 🪙</div>
      `}
      <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;">
        ${affordable.length > 0 ? `
          <button id="_nagStoreBtn" style="padding:10px 20px;background:linear-gradient(135deg,#8833cc,#aa44ee);border:none;border-radius:8px;color:#fff;font-weight:700;font-size:0.84rem;cursor:pointer;">
            🏪 Go to Store
          </button>
        ` : ''}
        <button id="_nagContinueBtn" style="padding:10px 20px;background:rgba(40,80,180,0.8);border:1px solid rgba(100,150,255,0.4);border-radius:8px;color:#fff;font-weight:700;font-size:0.84rem;cursor:pointer;">
          ⚔️ Continue
        </button>
      </div>
    </div>`;

  ov.style.display = 'flex';

  const cont = ov.querySelector('#_nagContinueBtn');
  const store = ov.querySelector('#_nagStoreBtn');

  if (cont) cont.onclick = () => { ov.style.display = 'none'; onContinue(); };
  if (store) store.onclick = () => {
    ov.style.display = 'none';
    storyModeActive = false;
    if (typeof backToMenu === 'function') backToMenu();
    setTimeout(() => {
      if (typeof openStoryMenu === 'function') openStoryMenu();
      setTimeout(() => { if (typeof switchStoryTab === 'function') switchStoryTab('store'); }, 120);
    }, 300);
  };
}

// ── Story retry screen ────────────────────────────────────────────────────────
function _showStory2RetryScreen(ch) {
  requestAnimationFrame(() => {
    // Hide default game-over overlay content and inject custom retry screen
    const ov = document.getElementById('gameOverOverlay');
    if (!ov) return;

    const old = ov.querySelector('#_story2RetryScreen');
    if (old) old.remove();

    const affordable = Object.entries(STORY_ABILITIES2).filter(([key, ab]) => {
      const owned = _story2.unlockedAbilities.includes(key);
      const hasBP = !ab.requiresBlueprint || _story2.blueprints.includes(key);
      return !owned && hasBP && _story2.tokens >= ab.tokenCost;
    });

    const retryDiv = document.createElement('div');
    retryDiv.id = '_story2RetryScreen';
    retryDiv.style.cssText = 'margin-top:16px;text-align:center;';

    retryDiv.innerHTML = `
      <div style="font-size:0.72rem;letter-spacing:1px;color:#667;text-transform:uppercase;margin-bottom:4px;">${storyPhaseIndicator ? 'Phase Failed' : 'Chapter'}</div>
      <div style="font-size:1.05rem;font-weight:700;color:#dde4ff;margin-bottom:10px;">${ch.title}</div>
      ${storyPhaseIndicator ? `<div style="font-size:0.74rem;color:#8cc8ff;margin-bottom:10px;">PHASE ${storyPhaseIndicator.index}/${storyPhaseIndicator.total} — ${storyPhaseIndicator.label}</div>` : ''}
      ${affordable.length > 0 ? `
        <div style="font-size:0.74rem;color:#ffcc66;margin-bottom:10px;">
          💡 ${affordable.length} upgrade${affordable.length > 1 ? 's' : ''} affordable (${_story2.tokens} 🪙)
        </div>
      ` : ''}
      <div style="display:flex;flex-direction:column;gap:7px;max-width:240px;margin:0 auto;">
        <button id="_retryChapterBtn" style="padding:10px 0;background:linear-gradient(135deg,#1a5acc,#2277ee);border:none;border-radius:9px;color:#fff;font-weight:700;font-size:0.88rem;cursor:pointer;width:100%;">
          ↺ Retry ${storyPhaseIndicator ? 'Phase' : 'Chapter'}
        </button>
        ${affordable.length > 0 ? `
          <button id="_retryStoreBtn" style="padding:10px 0;background:linear-gradient(135deg,#6622aa,#9933cc);border:none;border-radius:9px;color:#fff;font-weight:700;font-size:0.88rem;cursor:pointer;width:100%;">
            🏪 Go to Store
          </button>
        ` : ''}
        <button id="_retryMenuBtn" style="padding:9px 0;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.15);border-radius:9px;color:#aaa;font-size:0.82rem;cursor:pointer;width:100%;">
          ← Story Menu
        </button>
      </div>`;

    const btnRow = ov.querySelector('.btn-row');
    if (btnRow) btnRow.style.display = 'none'; // hide default buttons
    ov.querySelector('.overlay-box')?.appendChild(retryDiv);

    retryDiv.querySelector('#_retryChapterBtn').onclick = () => {
      ov.style.display = 'none';
      if (btnRow) btnRow.style.display = '';
      storyModeActive = false;
      if (typeof backToMenu === 'function') backToMenu();
      setTimeout(() => _beginChapter2(ch.id), 350);
    };

    const storeBtn = retryDiv.querySelector('#_retryStoreBtn');
    if (storeBtn) storeBtn.onclick = () => {
      ov.style.display = 'none';
      if (btnRow) btnRow.style.display = '';
      storyModeActive = false;
      if (typeof backToMenu === 'function') backToMenu();
      setTimeout(() => {
        if (typeof openStoryMenu === 'function') openStoryMenu();
        setTimeout(() => { if (typeof switchStoryTab === 'function') switchStoryTab('store'); }, 120);
      }, 320);
    };

    retryDiv.querySelector('#_retryMenuBtn').onclick = () => {
      ov.style.display = 'none';
      if (btnRow) btnRow.style.display = '';
      storyVictoryBackToMenu();
    };
  });
}

// ── World System ─────────────────────────────────────────────────────────────
const STORY_WORLDS = {
  fracture: {
    id:       'fracture',
    name:     'Fracture World',
    modifier: 'gravityShift'
  },
  war: {
    id:       'war',
    name:     'War Echo',
    modifier: 'highPressure'
  },
  mirror: {
    id:       'mirror',
    name:     'Void Mirror',
    modifier: 'mirrorAI'
  },
  godfall: {
    id:       'godfall',
    name:     'Collapsed God Realm',
    modifier: 'highDamage'
  },
  code: {
    id:       'code',
    name:     'Code Realm',
    modifier: 'uiBreak'
  }
};

function getWorldForChapter(id) {
  if (id < 60)  return 'fracture';
  if (id < 120) return 'war';
  if (id < 180) return 'mirror';
  if (id < 240) return 'godfall';
  return 'code';
}

// ── Multiverse Arc Definitions ────────────────────────────────────────────────
const STORY_ARCS = [
  { id: 'fracture', name: 'Fracture World',        range: [0,   59]  },
  { id: 'war',      name: 'War Echo',               range: [60,  119] },
  { id: 'mirror',   name: 'Void Mirror',            range: [120, 179] },
  { id: 'godfall',  name: 'Collapsed God Realm',    range: [180, 239] },
  { id: 'code',     name: 'Code Realm',             range: [240, 310] }
];

function getStoryArc(id) {
  for (const arc of STORY_ARCS) {
    if (id >= arc.range[0] && id <= arc.range[1]) return arc;
  }
  return null;
}

// ── Chapter definitions ───────────────────────────────────────────────────────

function _storyExploreStyleForWorld(world) {
  const tag = String(world || '').toLowerCase();
  if (tag.includes('forest') || tag.includes('green')) return 'forest';
  if (tag.includes('void') || tag.includes('rift')) return 'void';
  if (tag.includes('space') || tag.includes('fracture')) return 'space';
  if (tag.includes('lava') || tag.includes('industrial')) return 'lava';
  return 'city';
}

function _storyPassiveChapterVariant(ch) {
  const cycle = ['exploration', 'objective', 'parkour'];
  return cycle[ch.id % cycle.length];
}

function _storyPassiveChapterObjective(ch, variant) {
  const world = String(ch.world || '').toLowerCase();
  if (variant === 'parkour') {
    if (world.includes('rooftop') || world.includes('sky')) return 'Rooftop Route';
    if (world.includes('fracture') || world.includes('space')) return 'Phase Path';
    return 'Traversal Route';
  }
  if (variant === 'objective') {
    if (world.includes('relay') || world.includes('signal')) return 'Signal Node';
    if (world.includes('void') || world.includes('rift')) return 'Anchor Fragment';
    return 'Control Point';
  }
  if (world.includes('forest')) return 'Hidden Trail';
  if (world.includes('fracture') || world.includes('space')) return 'Fracture Trail';
  return 'Forward Route';
}

function _storyPassiveEnemyDefs(ch, variant) {
  const id = ch.id;
  const tier = id >= 60 ? 'expert' : id >= 35 ? 'hard' : id >= 12 ? 'medium' : 'easy';
  const style = _storyExploreStyleForWorld(ch.world);
  const baseColor = style === 'forest' ? '#58784f' : style === 'space' ? '#6b5ca8' : style === 'lava' ? '#9b4e2d' : style === 'void' ? '#55516d' : '#556677';
  const walker = { wx: 660, name: 'Scout', weaponKey: id >= 18 ? 'spear' : 'sword', classKey: 'none', aiDiff: tier, color: baseColor };
  const hunter = { wx: 1300, name: 'Hunter', weaponKey: id >= 25 ? 'axe' : 'sword', classKey: id >= 20 ? 'warrior' : 'none', aiDiff: tier, color: baseColor };
  const guardA = { wx: 2500, name: 'Sentinel', weaponKey: id >= 45 ? 'hammer' : 'sword', classKey: id >= 30 ? 'tank' : 'warrior', aiDiff: tier, color: baseColor, isGuard: true, health: 110 + Math.min(70, id * 2) };
  const guardB = { wx: 2580, name: 'Warden', weaponKey: id >= 48 ? 'spear' : 'axe', classKey: id >= 28 ? 'assassin' : 'warrior', aiDiff: id >= 55 ? 'expert' : 'hard', color: baseColor, isGuard: true, health: 95 + Math.min(60, id * 2) };
  if (variant === 'parkour') {
    walker.wx = 900;
    hunter.wx = 1850;
    return [walker, hunter];
  }
  if (variant === 'objective') {
    return [walker, hunter, guardA, guardB];
  }
  return [walker, hunter, { wx: 2050, name: 'Pursuer', weaponKey: id >= 22 ? 'axe' : 'sword', classKey: 'warrior', aiDiff: tier, color: baseColor }];
}

function _promotePassiveStoryChapters() {
  for (const ch of STORY_CHAPTERS2) {
    if (!ch || !ch.noFight || ch.isEpilogue || ch.isCinematicBridge) continue;

    const variant = _storyPassiveChapterVariant(ch);
    const objective = _storyPassiveChapterObjective(ch, variant);
    const worldLen = variant === 'parkour'
      ? 5600 + (ch.id % 4) * 340
      : variant === 'objective'
        ? 5200 + (ch.id % 5) * 320
        : 4800 + (ch.id % 6) * 280;

    ch.noFight = false;
    ch.type = 'exploration';
    ch.exploreMode = variant;
    ch.style = _storyExploreStyleForWorld(ch.world);
    ch.worldLength = ch.worldLength || worldLen;
    ch.objectX = ch.objectX || (ch.worldLength - (variant === 'objective' ? 620 : 520));
    ch.objectName = ch.objectName || objective;
    ch.spawnEnemies = ch.spawnEnemies || _storyPassiveEnemyDefs(ch, variant);
    ch.playerLives = ch.playerLives || 3;
    ch.tokenReward = Math.max(ch.tokenReward || 0, 16 + Math.floor(ch.id * 0.35));
    ch.preText = ch.preText || (
      variant === 'parkour'
        ? `Keep moving. Clear the route and reach the ${objective}.`
        : variant === 'objective'
          ? `Push through resistance and secure the ${objective}.`
          : `Advance through the area and find the ${objective}.`
    );
    ch.fightScript = ch.fightScript || [
      {
        frame: 50,
        text: variant === 'parkour'
          ? 'Route unstable. Stay high, keep speed, and don\'t get pinned.'
          : variant === 'objective'
            ? `Hold pressure, break the defenders, and take the ${objective}.`
            : `Stay alert. This section is live now — move toward the ${objective}.`,
        color: variant === 'parkour' ? '#44ccff' : variant === 'objective' ? '#ffcc44' : '#aaccff',
        timer: 260,
      },
      {
        frame: variant === 'parkour' ? 500 : 620,
        text: variant === 'parkour'
          ? 'Keep momentum. Hesitation is what gets you knocked off the route.'
          : variant === 'objective'
            ? `You are not done when you arrive. Hold the ${objective} under pressure.`
            : 'This section is built to grind you down. Keep moving anyway.',
        color: variant === 'parkour' ? '#9be7ff' : variant === 'objective' ? '#ffe58a' : '#d3e6ff',
        timer: 250,
      },
    ];
  }
}


// ── Ability definitions for the store ────────────────────────────────────────
// Blueprints are dropped as loot from specific chapter victories.
// Non-blueprint abilities can be purchased directly with tokens.
const STORY_ABILITIES2 = {
  // ── Blueprint-gated abilities (must find blueprint first) ──────────────────
  last_stand2: {
    name: 'Last Stand',
    desc: 'When HP < 15%, gain +60% speed and double damage for 8 seconds. One activation per match.',
    icon: '🔥', tokenCost: 80, requiresBlueprint: true,
    lore: 'The fragment knows when you\'re about to break. It doesn\'t let you.',
  },
  time_stop2: {
    name: 'Fracture Pulse',
    desc: 'Super (E) releases a fracture burst that stuns all enemies for 2.5s. 50s cooldown.',
    icon: '⏱️', tokenCost: 120, requiresBlueprint: true,
    lore: 'A micro-collapse of local time. The fragment remembers how.',
  },
  rage_mode2: {
    name: 'Echo Rage',
    desc: 'Taking 3 hits in quick succession triggers rage: next 5 attacks deal 3× damage.',
    icon: '💢', tokenCost: 100, requiresBlueprint: true,
    lore: 'The echo fighters taught you something you didn\'t expect: anger has a geometry.',
  },
  reflect2: {
    name: 'Mirror Fracture',
    desc: 'While shielding (S), reflect 25% of incoming damage back at the attacker.',
    icon: '🌀', tokenCost: 90, requiresBlueprint: true,
    lore: 'From the mirror pocket. Your echo showed you the technique by using it against you.',
  },
  world_break2: {
    name: 'Core Collapse',
    desc: 'Once per match, activate super to deal 60% of enemy max HP instantly.',
    icon: '🌍', tokenCost: 350, requiresBlueprint: true,
    lore: 'The Multiversal Core taught you what concentrated fracture energy feels like when it breaks.',
  },
  ghost_step2: {
    name: 'Fracture Step',
    desc: 'After rolling (double-tap ← or →), gain 0.4s of invincibility frames. 8s cooldown.',
    icon: '👁️', tokenCost: 110, requiresBlueprint: true,
    lore: 'A half-step between dimensions. The Herald showed you — then let you earn it.',
  },
  berserker_blood2: {
    name: 'Fragment Hunger',
    desc: 'Each kill charges your fragment: +8% damage stacked (max 5 kills, resets on death).',
    icon: '🩸', tokenCost: 130, requiresBlueprint: true,
    lore: 'The fragment was always absorbing. You learned to direct it.',
  },
  // (Impact Shield, Dimensional Patch, Fracture Surge, Void Step migrated to Skill Tree)
  // ── New Act IV / Act V blueprint abilities ────────────────────────
  architects_resolve2: {
    name: 'Architects\' Resolve',
    desc: 'Once per match, when you would be defeated, automatically revive with 25% HP instead.',
    icon: '🏛️', tokenCost: 160, requiresBlueprint: true,
    lore: 'Three Architects stood when one fell. Their resolve transferred to you — not as strength. As continuity.',
  },
  void_pulse2: {
    name: 'Void Pulse',
    desc: 'Press Q to emit a void pulse: pushes all nearby enemies back 120px and deals 20 damage. 12s cooldown.',
    icon: '💫', tokenCost: 95, requiresBlueprint: true,
    lore: 'The rift entity showed you what it felt like to exhale after ten thousand years of silence.',
  },
  temporal_anchor2: {
    name: 'Temporal Anchor',
    desc: 'When HP drops below 20%, freeze all enemies in place for 2 seconds. One activation per match.',
    icon: '⌛', tokenCost: 180, requiresBlueprint: true,
    lore: 'The Creator\'s domain runs on dimensional time. You learned to grip it.',
  },
};
