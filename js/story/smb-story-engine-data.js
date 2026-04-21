'use strict';
// smb-story-engine-data.js — Story chapter expansion helpers + current chapter state vars + UI icon helpers
// Depends on: smb-globals.js, smb-story-registry.js (and preceding story-engine splits)

// smb-story-engine.js
// Story mode engine: fight progression, chapter launch, event system, UI, exploration, drawing.
// Depends on: smb-story-config.js, smb-story-registry.js, smb-globals.js
// Must load: AFTER smb-story-config.js and all arc files, BEFORE smb-story-finalize.js

// ── Act / Arc structure (read-only descriptor over STORY_CHAPTERS2 indices) ───

function _phaseToChapter(origCh, phase, newId, pi, isFirst, isFinal, totalTokens, numPhases) {
  const phaseCh = {
    id:          newId,
    title:       origCh.title + (numPhases > 1 ? ' — ' + (phase.label || _storyPhaseName(phase.type)) : ''),
    world:       origCh.world,
    narrative:   isFirst ? (origCh.narrative || []) : [],
    preText:     phase.label || _storyPhaseName(phase.type),
    fightScript: isFirst ? (origCh.fightScript || []) : [],
    tokenReward: isFinal
      ? Math.max(8, Math.ceil(totalTokens * 0.55))
      : Math.max(4, Math.floor(totalTokens * 0.45 / Math.max(1, numPhases - 1))),
    playerLives: phase.playerLives || origCh.playerLives || 3,
    arena:       phase.arena || origCh.arena,
    blueprintDrop: isFinal ? (origCh.blueprintDrop || null) : null,
    storeNag:    isFinal ? (origCh.storeNag || null) : null,
    _origId:     origCh.id,   // original chapter ID for difficulty scaling
    _phaseType:  phase.type,
    _phaseFinal: isFinal,
  };

  if (phase.type === 'traversal') {
    phaseCh.type         = 'exploration';
    phaseCh.worldLength  = phase.worldLength || origCh.worldLength;
    phaseCh.objectName   = phase.objectName  || origCh.objectName;
    phaseCh.spawnEnemies = phase.spawnEnemies || origCh.spawnEnemies || [];
    phaseCh.exploreStyle = origCh.exploreStyle || null;
    phaseCh.sky          = origCh.sky;
    phaseCh.groundColor  = origCh.groundColor;
    phaseCh.platColor    = origCh.platColor;
  } else {
    // Fight phase
    if (Array.isArray(phase.opponents) && phase.opponents.length > 0) {
      const lead           = phase.opponents[0];
      phaseCh.opponentName  = lead.name         || origCh.opponentName  || 'Enemy';
      phaseCh.weaponKey     = lead.weaponKey     || origCh.weaponKey     || 'sword';
      phaseCh.classKey      = lead.classKey      || origCh.classKey      || 'warrior';
      phaseCh.aiDiff        = lead.aiDiff        || origCh.aiDiff        || 'medium';
      phaseCh.opponentColor = lead.color         || origCh.opponentColor || '#778899';
      phaseCh.armor         = lead.armor         || [];
      if (phase.opponents.length > 1) {
        phaseCh.twoEnemies  = true;
        phaseCh.secondEnemy = phase.opponents[1];
      }
    } else {
      // Final phase (mini_boss) — use original chapter opponent
      phaseCh.opponentName  = origCh.opponentName;
      phaseCh.weaponKey     = origCh.weaponKey;
      phaseCh.classKey      = origCh.classKey;
      phaseCh.aiDiff        = origCh.aiDiff;
      phaseCh.opponentColor = origCh.opponentColor;
      phaseCh.armor         = origCh.armor || [];
    }
    if (isFinal) {
      phaseCh.isBossFight      = !!origCh.isBossFight;
      phaseCh.isTrueFormFight  = !!origCh.isTrueFormFight;
      phaseCh.isSovereignFight = !!origCh.isSovereignFight;
    }
  }
  return phaseCh;
}

function _expandStoryChaptersInPlace() {
  // Take a snapshot of the original 80 chapters
  const origList = STORY_CHAPTERS2.slice();
  const expanded = [];
  // Track new ID range for each original chapter (for act structure rebuild)
  const origToNewRange = {}; // origId → { start, end }

  for (const origCh of origList) {
    const rangeStart = expanded.length;

    if (origCh.noFight || origCh.isEpilogue || origCh.isDamnationChapter) {
      // noFight / epilogue / damnation chapters stay as single chapters
      expanded.push({ ...origCh, id: expanded.length });
    } else {
      // Build phases using the original chapter's id for difficulty scaling
      const phaseSrc = { ...origCh }; // don't mutate origCh
      delete phaseSrc.phases;         // force rebuild
      const phases   = _storyBuildPhases(phaseSrc);
      const n        = phases.length;
      const tok      = origCh.tokenReward || 0;

      phases.forEach((phase, pi) => {
        expanded.push(_phaseToChapter(
          origCh, phase,
          expanded.length,   // new sequential id
          pi,
          pi === 0,          // isFirst
          pi === n - 1,      // isFinal
          tok,
          n,
        ));
      });
    }

    origToNewRange[origCh.id] = { start: rangeStart, end: expanded.length - 1 };
  }

  // Mutate STORY_CHAPTERS2 in place (it's a const array)
  STORY_CHAPTERS2.length = 0;
  for (const ch of expanded) STORY_CHAPTERS2.push(ch);

  // Rebuild STORY_ACT_STRUCTURE chapterRanges with new IDs
  for (const act of STORY_ACT_STRUCTURE) {
    for (const arc of act.arcs) {
      const [origStart, origEnd] = arc.chapterRange;
      const newStart = origToNewRange[origStart] ? origToNewRange[origStart].start : origStart;
      const newEnd   = origToNewRange[origEnd]   ? origToNewRange[origEnd].end     : origEnd;
      arc.chapterRange = [newStart, newEnd];
    }
  }
}

// Run expansion immediately after both arrays are defined


// ── Current chapter state for a fight in progress ─────────────────────────────
let _activeStory2Chapter = null;  // set when launching a chapter fight

