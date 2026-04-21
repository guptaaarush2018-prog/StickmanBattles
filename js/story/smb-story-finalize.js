// Loads AFTER smb-story-engine.js AND all arc data files.
// Calls engine helpers - do NOT reorder relative to smb-story-engine.js.

// Step 1: Sort registry by id and validate no gaps
STORY_CHAPTER_REGISTRY.sort((a, b) => a.id - b.id);
STORY_CHAPTER_REGISTRY.forEach((ch, i) => {
  if (ch.id !== i) console.error(`[Story] id mismatch: index ${i} has id ${ch.id}`);
});

// Step 2: Expose backward-compatible alias (engine refs use this name)
const STORY_CHAPTERS2 = STORY_CHAPTER_REGISTRY;

// Step 3: Promote noFight chapters to exploration chapters (sets noFight=false, type='exploration')
//         Must run before expansion. Epilogues are explicitly skipped and remain unchanged.
_promotePassiveStoryChapters();

// Step 4: Phase prebuild - parity with live code; caches .phases on original chapter objects
//         for any caller that reads the property directly outside the expansion path.
//         NOTE: _expandStoryChaptersInPlace() rebuilds phases independently on its own copy;
//         this loop is NOT a dependency for expansion correctness.
for (const _ch of STORY_CHAPTERS2) {
  if (_ch && !_ch.isEpilogue) _storyBuildPhases(_ch);
}

// Step 5: Act/Arc structure - must live here, NOT inside any arc file
//         Chapter ranges use the registered chapter IDs (pre-expansion).
//         8 acts matching canon:
//           I   Initial Encounter  (0–5)
//           II  City               (6–12)
//           III Rifts / Veran      (13–27)
//           IV  Rural              (28–44)
//           V   Stickman Universe  (45–61)
//           VI  Multiverse Exploration + Fallen God (62–73)
//           VII Creator            (74–89)
//           VIII True Form — FINAL (90–92)
const STORY_ACT_STRUCTURE = [
  {
    id: 'act1', label: 'Act I — Initial Encounter', color: '#88aacc',
    arcs: [
      { id: 'arc0-0', label: 'The Incident', chapterRange: [0, 5] },
    ],
  },
  {
    id: 'act2', label: 'Act II — City', color: '#6699bb',
    arcs: [
      { id: 'arc0-1', label: 'City Collapse', chapterRange: [6, 12] },
    ],
  },
  {
    id: 'act3', label: 'Act III — Rifts / Veran', color: '#7744cc',
    arcs: [
      { id: 'arc1-0', label: 'Fracture Network', chapterRange: [13, 19] },
      { id: 'arc1-1', label: 'The Core', chapterRange: [20, 27] },
    ],
  },
  {
    id: 'act4', label: 'Act IV — Rural', color: '#33aa44',
    arcs: [
      { id: 'arc2-0', label: 'The Rift Core', chapterRange: [28, 34] },
      { id: 'arc2-1', label: 'Forest & Ice', chapterRange: [35, 41] },
      { id: 'arc2-2', label: 'Ruins & Collapse', chapterRange: [42, 44] },
    ],
  },
  {
    id: 'act5', label: 'Act V — Stickman Universe', color: '#cc7722',
    arcs: [
      { id: 'arc3-0', label: 'The Assembly', chapterRange: [45, 51] },
      { id: 'arc3-1', label: 'The Fracture Within', chapterRange: [52, 61] },
    ],
  },
  {
    // Multiverse trials (62-69) + Fallen God final trial (70-73)
    id: 'act6', label: 'Act VI — Multiverse Exploration', color: '#bb88ff',
    arcs: [
      { id: 'arc4mv-0', label: 'War & Flux', chapterRange: [62, 65] },
      { id: 'arc4mv-1', label: 'Shadow & Titan', chapterRange: [66, 69] },
      { id: 'arc5-godfall', label: 'The Fallen God', chapterRange: [70, 73] },
    ],
  },
  {
    id: 'act7', label: 'Act VII — Creator', color: '#dd3344',
    arcs: [
      { id: 'arc4-0', label: 'The Creator\'s Threshold', chapterRange: [74, 81] },
      { id: 'arc4-1', label: 'The Final Architecture', chapterRange: [82, 89] },
    ],
  },
  {
    // True Form — absolute final act, nothing follows
    id: 'act8', label: 'Act VIII — True Form', color: '#cc44ff',
    arcs: [
      { id: 'arc5-0',          label: 'Into the Void',        chapterRange: [90, 90] },
      { id: 'arc5-damnation',  label: 'The Damnation Loop',   chapterRange: [91, 93] },
      { id: 'arc5-1',          label: 'Final Confrontation',  chapterRange: [94, 95] },
    ],
  },
];

// Step 6: Expand chapters in-place - also rebuilds STORY_ACT_STRUCTURE chapterRanges
_expandStoryChaptersInPlace();
