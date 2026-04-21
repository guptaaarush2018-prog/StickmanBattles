'use strict';
// smb-story-engine-flow.js — Chapter launch flow: _startStoryGauntlet → _launchChapter2Fight (immediate)
// Depends on: smb-globals.js, smb-story-registry.js (and preceding story-engine splits)

// ── Chapter flow ──────────────────────────────────────────────────────────────
let _narrativeActive = false; // guard against re-entrant narrative calls
const _seenNarrativeIds = new Set(); // chapters whose narrative was already shown this session

function _startStoryGauntlet(ch) {
  if (!ch) return;
  const phases = _storyBuildPhases(ch);
  storyGauntletState = {
    chapterId: ch.id,
    phases,
    index: 0,
    carryHealthPct: _storyGetCarryHealthPct(),
    sideRewards: [],
  };
  _storyUpdatePhaseIndicator();
  _launchStoryGauntletPhase(ch);
}

function _storyPhaseLaunchConfig(ch, phase) {
  const phaseType = phase.type;
  const traversalLike = phaseType === 'traversal';
  if (traversalLike) {
    const traversalChapter = {
      ...ch,
      type: 'exploration',
      noFight: false,
      preText: `${phase.label || 'Advance'} — ${_storyPhaseName(phase.type)}`,
      worldLength: phase.worldLength || Math.max(5200, Math.floor((ch.worldLength || 4600) * 0.75)),
      objectName: phase.objectName || ch.objectName || 'Forward Route',
      spawnEnemies: phase.spawnEnemies || ch.spawnEnemies || [],
      playerLives: phase.playerLives || ch.playerLives || 3,
      fightScript: [...(ch.fightScript || [])],
    };
    return { mode: 'exploration', chapter: traversalChapter };
  }

  const launch = {
    ...ch,
    type: 'fight',
    noFight: false,
    preText: `${phase.label || _storyPhaseName(phaseType)}`,
    playerLives: phase.playerLives || ch.playerLives || 3,
    arena: phase.arena || ch.arena,
    isBossFight: false,
    isTrueFormFight: false,
    isSovereignFight: false,
    twoEnemies: Array.isArray(phase.opponents) && phase.opponents.length > 1,
    secondEnemy: Array.isArray(phase.opponents) && phase.opponents.length > 1 ? phase.opponents[1] : null,
  };
  if (Array.isArray(phase.opponents) && phase.opponents[0]) {
    const lead = phase.opponents[0];
    launch.opponentName = lead.name || ch.opponentName || 'Enemy';
    launch.weaponKey = lead.weaponKey || ch.weaponKey || 'sword';
    launch.classKey = lead.classKey || ch.classKey || 'warrior';
    launch.aiDiff = lead.aiDiff || ch.aiDiff || 'medium';
    launch.opponentColor = lead.color || ch.opponentColor || '#778899';
    launch.armor = lead.armor || [];
  }
  if (phase.finalChapter) {
    launch.isBossFight = !!ch.isBossFight;
    launch.isTrueFormFight = !!ch.isTrueFormFight;
    launch.isSovereignFight = !!ch.isSovereignFight;
    if (!launch.opponentName && ch.opponentName) launch.opponentName = ch.opponentName;
    if (!launch.weaponKey && ch.weaponKey) launch.weaponKey = ch.weaponKey;
    if (!launch.classKey && ch.classKey) launch.classKey = ch.classKey;
  }
  return { mode: 'chapter', chapter: launch };
}

function _launchStoryGauntletPhase(ch) {
  const phase = _storyGetCurrentPhase();
  if (!phase) return;
  _storyUpdatePhaseIndicator();
  storyPendingPhaseConfig = phase;
  const cfg = _storyPhaseLaunchConfig(ch, phase);
  if (cfg.mode === 'exploration') _launchExplorationChapter(cfg.chapter);
  else _launchChapter2Fight(cfg.chapter);
}

function _advanceStoryGauntletPhase(ch) {
  if (!storyGauntletState) return false;
  storyGauntletState.index++;
  if (storyGauntletState.index >= storyGauntletState.phases.length) {
    storyPendingPhaseConfig = null;
    storyPhaseIndicator = null;
    return false;
  }
  _storyUpdatePhaseIndicator();
  setTimeout(() => {
    const go = document.getElementById('gameOverOverlay');
    if (go) go.style.display = 'none';
    const pauseOv = document.getElementById('pauseOverlay');
    if (pauseOv) pauseOv.style.display = 'none';
    storyModeActive = true;
    _launchStoryGauntletPhase(ch);
  }, 420);
  return true;
}

function _beginChapter2(idx) {
  if (_narrativeActive) return;
  const ch = STORY_CHAPTERS2[idx];
  if (!ch) return;
  _activeStory2Chapter = ch;
  storyGauntletState = null; // no phases — single chapter only

  if (ch.noFight && !ch.isEpilogue) {
    _showStory2Narrative(ch.narrative, () => _completeChapter2(ch));
    return;
  }
  if (ch.noFight) {
    _showStory2Narrative(ch.narrative, () => _completeChapter2(ch));
    return;
  }

  // On retry (narrative already seen this session), skip straight to fight
  if (_seenNarrativeIds.has(ch.id)) {
    _directLaunchChapter(ch);
    return;
  }

  _seenNarrativeIds.add(ch.id);
  const allLines = [...(ch.narrative || [])];
  if (ch.preText) allLines.push(ch.preText);
  _showStory2Narrative(allLines, () => {
    _showPreFightStoreNag(ch, () => _directLaunchChapter(ch));
  });
}

// Direct launch — no gauntlet phases, just the chapter itself
function _directLaunchChapter(ch) {
  if (!ch) return;
  storyGauntletState = null;
  if (ch.type === 'exploration') {
    _launchExplorationChapter(ch);
  } else {
    _launchChapter2Fight(ch);
  }
}

// Reuse the existing storyDialoguePanel for narrative display.
function _showStory2Narrative(lines, callback) {
  const panel   = document.getElementById('storyDialoguePanel');
  const chEl    = document.getElementById('storyDialogueChapter');
  const titleEl = document.getElementById('storyDialogueTitle');
  const bodyEl  = document.getElementById('storyDialogueBody');
  const btn     = document.getElementById('storyDialogueFightBtn');

  if (!panel || !lines || !lines.length) { _narrativeActive = false; if (callback) callback(); return; }

  _narrativeActive = true;
  let idx = 0;

  function showLine() {
    if (idx >= lines.length) {
      panel.style.display = 'none';
      _narrativeActive = false;
      callback();
      return;
    }
    bodyEl.innerHTML = `<p style="margin:0;font-size:0.93rem;color:#dde4ff;line-height:1.65;">${lines[idx]}</p>`;
    idx++;
    btn.textContent = idx < lines.length ? 'Next →' : (_activeStory2Chapter && _activeStory2Chapter.noFight ? 'Continue →' : '⚔️ Fight!');
    btn.onclick = showLine;
  }

  if (chEl)    chEl.textContent   = _activeStory2Chapter ? _worldIcon(_activeStory2Chapter.world) : '';
  if (titleEl) titleEl.textContent = _activeStory2Chapter ? _activeStory2Chapter.title : '';
  // Show opponent name sub-label if available
  const _diagOpp = document.getElementById('storyDialogueOpponent');
  if (_diagOpp) {
    const _oppName = _activeStory2Chapter && _activeStory2Chapter.opponentName;
    _diagOpp.textContent = _oppName ? `vs. ${_oppName}` : '';
    _diagOpp.style.display = _oppName ? '' : 'none';
  }
  panel.style.display = 'flex';
  showLine();
}

function _showStory2PreFight(ch) {
  // Legacy stub — now handled inline by _showStory2Narrative
  _launchChapter2Fight(ch);
}

function _launchChapter2Fight(ch) {
  if (!ch) return;

  // Reset per-fight story event state (abilities, distortion, event dedup)
  if (typeof resetStoryEventState === 'function') resetStoryEventState();

  // Exploration chapter: different launch path
  if (ch.type === 'exploration') {
    _launchExplorationChapter(ch);
    return;
  }

  // Boss fight: show cinematic intro before launching (async — delays startGame)
  if (ch.isBossFight) {
    if (typeof triggerEvent === 'function') triggerEvent('BOSS_INTRO', { ch }, true);
    const _bossCinDuration = 7800;
    setTimeout(() => _launchChapter2FightImmediate(ch), _bossCinDuration);
    return;
  }

  _launchChapter2FightImmediate(ch);
}

function _launchChapter2FightImmediate(ch) {
  const _phase = storyPendingPhaseConfig;
  // Close the story modal directly — bypass the ch0-lock guard (fight launch is always valid)
  const _storyModal = document.getElementById('storyModal');
  if (_storyModal) _storyModal.style.display = 'none';

  // Apply world modifiers for this chapter
  worldId        = getWorldForChapter(ch.id);
  currentWorld   = STORY_WORLDS[worldId] || null;
  worldModifiers = currentWorld ? currentWorld.modifier : null;

  // Apply multiverse arc
  const _arc = getStoryArc(ch.id);
  if (_arc) storyCurrentArc = _arc.id;

  // Configure game for chapter
  if (ch.isTrueFormFight) {
    gameMode = 'trueform';
    if (typeof selectMode === 'function') selectMode('trueform');
  } else if (ch.isBossFight) {
    gameMode = 'boss';
    if (typeof selectMode === 'function') selectMode('boss');
  } else if (ch.isSovereignFight) {
    gameMode = 'adaptive';
    p2IsBot  = true;
    if (typeof selectMode === 'function') selectMode('adaptive');
  } else if (ch.isDamnationChapter) {
    gameMode = 'damnation';
    p2IsBot  = true;
    if (typeof selectMode === 'function') selectMode('damnation');
  } else {
    gameMode = '2p';
    p2IsBot  = true;
    if (typeof selectMode === 'function') selectMode('2p');
  }

  // Set arena
  if ((_phase && _phase.arena) || ch.arena) {
    selectedArena = (_phase && _phase.arena) || ch.arena;
    const arSelect = document.getElementById('arenaSelect');
    if (arSelect) arSelect.value = selectedArena;
  }

  // ── Ranged-weapon restriction ─────────────────────────────────────────────
  // Early story forbids ranged weapons so progression stays grounded and difficulty is consistent.
  // Later chapters/replays can use ranged loadouts normally.
  const _chBeaten = Array.isArray(_story2.defeated) && _story2.defeated.includes(ch.id);
  const _RANGED_FALLBACK = 'sword'; // melee substitute when ranged is stripped
  const _isRanged = key => typeof WEAPONS !== 'undefined' && WEAPONS[key] && WEAPONS[key].type === 'ranged';
  const _rangedUnlocked = _chBeaten || ch.id >= 10;
  const _safeWeapon = key => (_rangedUnlocked || !_isRanged(key)) ? key : _RANGED_FALLBACK;

  // Set P2 weapon/class to chapter opponent
  const _notBossOrTF = !ch.isBossFight && !ch.isTrueFormFight && !ch.isSovereignFight;
  if (_notBossOrTF && ch.weaponKey) {
    const p2w = document.getElementById('p2Weapon');
    if (p2w) p2w.value = _safeWeapon(ch.weaponKey);
  }
  if (_notBossOrTF && ch.classKey) {
    const p2c = document.getElementById('p2Class');
    if (p2c) p2c.value = ch.classKey;
  }
  if (_notBossOrTF && ch.aiDiff) {
    const p2d = document.getElementById('p2Difficulty');
    if (p2d) p2d.value = ch.aiDiff;
  }

  // Apply per-chapter fight script (tutorial hints, narrative subtitles)
  // Filter out entries that require abilities not yet unlocked.
  // Each entry can carry a `requires` array: ['ability','super','doubleJump']
  if (ch.fightScript && ch.fightScript.length) {
    const _ov = storyPlayerOverride || {};
    storyFightScript = ch.fightScript.filter(entry => {
      const req = entry.requires;
      if (!req) return true;
      const reqs = Array.isArray(req) ? req : [req];
      if (reqs.includes('doubleJump') && _ov.noDoubleJump) return false;
      if (reqs.includes('ability')    && _ov.noAbility)    return false;
      if (reqs.includes('super')      && _ov.noSuper)      return false;
      return true;
    });
    if (_phase && !_phase.finalChapter) {
      storyFightScript.unshift({
        frame: 20,
        text: `${_storyPhaseName(_phase.type)} — ${_phase.label || 'Engage and clear the arena.'}`,
        color: _phase.type === 'hazard_phase' ? '#ff8844' : _phase.type === 'elite_wave' ? '#ffcc66' : '#aaccff',
        timer: 220,
      });
    }
    storyFightScriptIdx = 0;
    storyFightSubtitle  = null;
  } else {
    storyFightScript    = [];
    storyFightScriptIdx = 0;
    storyFightSubtitle  = null;
    if (_phase && !_phase.finalChapter) {
      storyFightSubtitle = {
        text: `${_storyPhaseName(_phase.type)} — ${_phase.label || 'Clear the phase.'}`,
        timer: 220,
        maxTimer: 220,
        color: _phase.type === 'hazard_phase' ? '#ff8844' : '#aaccff'
      };
    }
  }

  // Apply per-chapter player lives
  if (typeof selectLives === 'function') selectLives((_phase && _phase.playerLives) || ch.playerLives || 3);
  infiniteMode = false;

  // ── Ability progression: gate unlocks by chapter id OR by story events ───
  // storyState.abilities is the authoritative source; chapter thresholds are
  // the fallback minimum for players who have already progressed past the unlock point.
  const _caps = ch.playerCaps || {};
  const id = ch._origId !== undefined ? ch._origId : ch.id; // use original id for difficulty scaling
  const _sa = (typeof storyState !== 'undefined') ? storyState.abilities : {};
  const _sk = _story2.skillTree || {};
  storyPlayerOverride = {
    // If chapter not yet beaten, strip ranged weapons from the player too
    weapon:        _caps.weapon !== undefined ? _safeWeapon(_caps.weapon) : (id < 1 ? 'sword' : (_isRanged(document.getElementById('p1Weapon')?.value) ? _RANGED_FALLBACK : null)),
    noDoubleJump:  _caps.noDoubleJump !== undefined ? _caps.noDoubleJump : !(_sk.doubleJump || !!_sa.doubleJump),
    noAbility:     _caps.noAbility    !== undefined ? _caps.noAbility    : !(_sk.weaponAbility || !!_sa.weaponAbility),
    noSuper:       _caps.noSuper      !== undefined ? _caps.noSuper      : !(_sk.superMeter || !!_sa.superMeter),
    noClass:       _caps.noClass      !== undefined ? _caps.noClass      : !_sk.classUnlock,
    noDodge:       !(_sk.dodge || !!_sa.dodge || storyDodgeUnlocked),
    dmgMult:       1.0 + (_sk.heavyHit2 ? 0.25 : _sk.heavyHit1 ? 0.15 : 0),
    speedMult:     1.0 + (_sk.fastMove2 ? 0.20 : _sk.fastMove1 ? 0.10 : 0),
    jumpMult:      1.0 + (_sk.highJump2 ? 0.25 : _sk.highJump1 ? 0.15 : 0),
  };

  // Set in-fight objective based on chapter type
  if (typeof setObjective === 'function') {
    const _chOrigId = ch._origId !== undefined ? ch._origId : ch.id;
    let _obj;
    if (ch.isTrueFormFight)  _obj = 'Defeat True Form';
    else if (ch.isBossFight) _obj = 'Defeat the Creator';
    else if (ch.isSovereignFight) _obj = 'Defeat the Sovereign';
    else if (ch.type === 'exploration') _obj = 'Reach ' + (ch.objectName || 'the objective');
    else if (_chOrigId < 8)  _obj = 'Survive the attack — find out why.';
    else if (_chOrigId < 20) _obj = 'Investigate the fractures.';
    else if (_chOrigId < 40) _obj = 'Follow the trail. Someone is coordinating this.';
    else if (_chOrigId < 60) _obj = 'Breach the Creator\'s domain.';
    else                     _obj = 'Prepare for the Creator.';
    setObjective(_obj);
  }

  // Ability toasts are now shown only when purchased in the skill tree

  // Boss type override (e.g. 'fallen_god' → spawns FallenGod instead of Boss)
  storyBossType = ch.bossType || null;

  // Opponent name
  storyOpponentName = ch.opponentName || null;

  // Armor and multi-enemy setup
  storyEnemyArmor = ch.armor || [];
  storyTwoEnemies = !!ch.twoEnemies;
  // Strip ranged weapon from second enemy on unbeaten chapters
  if (ch.secondEnemy) {
    const _sed = Object.assign({}, ch.secondEnemy);
    if (_sed.weaponKey) _sed.weaponKey = _safeWeapon(_sed.weaponKey);
    storySecondEnemyDef = _sed;
  } else if (ch.twoEnemies) {
    // Auto-generate second enemy from chapter opponent data when no explicit def
    storySecondEnemyDef = {
      weaponKey: _safeWeapon(ch.weaponKey || 'sword'),
      classKey:  ch.classKey  || 'warrior',
      aiDiff:    ch.aiDiff    || 'medium',
      color:     ch.opponentColor || '#cc5500',
    };
  } else {
    storySecondEnemyDef = null;
  }

  // Mark story2 fight active
  storyModeActive = true;

  // Scale STORY_ENEMY_CONFIGS to chapter progression (defaults to 1 for v1 story)
  storyCurrentLevel = Math.min(8, Math.floor(id / 5) + 1);

  // Boss chapter: register director sequences that fire during the fight
  if (ch.isBossFight && typeof directorOnce === 'function') {
    // Use setTimeout so players[] is populated after startGame initializes
    setTimeout(() => {
      const _boss = players && players.find(p => p.isBoss);
      if (!_boss) return;

      directorOnce('boss_first_blood',
        () => gameRunning && _boss.health < _boss.maxHealth - 180,
        () => {
          if (typeof showBossDialogue === 'function') showBossDialogue('"You landed that. Good."', 120);
          if (typeof setCameraDrama === 'function') setCameraDrama('focus', 60, _boss, 1.18);
        }
      );

      directorOnce('boss_half_hp',
        () => gameRunning && _boss.health < _boss.maxHealth * 0.50,
        () => {
          if (typeof setCameraDrama === 'function') {
            setCameraDrama('wideshot', 100);
            setTimeout(() => setCameraDrama('focus', 70, _boss, 1.30), 1000);
          }
          if (typeof screenShakeIntensity !== 'undefined') screenShakeIntensity = Math.max(screenShakeIntensity || 0, 10);
          if (typeof showBossDialogue === 'function') showBossDialogue('"Half gone. You\'re better than I expected."', 160);
          if (typeof slowMotionFor === 'function') slowMotionFor(0.40, 900);
          if (director) director._worldState = 'boss';
        }
      );

      directorOnce('boss_final_phase',
        () => gameRunning && _boss.health < _boss.maxHealth * 0.20,
        () => {
          storyDistortLevel = Math.min(1.0, storyDistortLevel + 0.30);
          if (typeof setCameraDrama === 'function') setCameraDrama('wideshot', 160);
          if (typeof slowMotionFor === 'function') slowMotionFor(0.42, 1300);
          if (typeof showBossDialogue === 'function') showBossDialogue('"You weren\'t in the design. Yet here you are."', 210);
          if (typeof screenShakeIntensity !== 'undefined') screenShakeIntensity = Math.max(screenShakeIntensity || 0, 13);
          if (typeof directorSchedule === 'function') {
            directorSchedule([{
              id: 'boss_fp_focus', delay: 130,
              condition: () => gameRunning,
              action: () => {
                if (typeof setCameraDrama === 'function') setCameraDrama('focus', 90, _boss, 1.38);
              }
            }]);
          }
        }
      );
    }, 800); // 800ms after startGame so players[] is ready
  }

  if (typeof startGame === 'function') startGame();
  setTimeout(() => { if (players[0]) _applySkillTreeToPlayer(players[0]); }, 50);

  // World boss variant: patch the boss after players[] is populated
  if (ch.isWorldBoss) {
    setTimeout(() => spawnWorldBoss(worldId), 100);
  }
}

// ── World Boss variants ────────────────────────────────────────────────────────
