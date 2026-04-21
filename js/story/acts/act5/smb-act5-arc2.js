// Appends chapters for act5/smb-act5-arc2.js.
STORY_CHAPTER_REGISTRY.push(
  {
    id: 94, title: 'True Form',
    world: '\uD83D\uDD73\uFE0F The Void — Final Confrontation',
    narrative: [
      'The True Form arrived without announcement.',
      '',
      'Not a creature.',
      'Not a person.',
      'A law.',
      '',
      '"I am what the fracture system was built to protect."',
      '"I am the pattern beneath every dimension."',
      '"I do not lose."',
      '"I do not negotiate."',
      '"I simply am."',
      '',
      '...',
      '',
      'You have fought inside it.',
      'You carry its scar.',
      '',
      'Prove it wrong anyway.',
    ],
    fightScript: [
      { frame: 60,  text: '\u26A0\uFE0F TRUE FORM \u2014 this entity is the fracture system itself. QTE sequences will trigger.', color: '#cc44ff', timer: 380 },
      { frame: 80,  text: '"You survived my echo." Good. You know what you are fighting.', color: '#ffffff', timer: 280 },
      { frame: 320, text: '"The scar in your fragment — I feel it." So does it feel you.', color: '#cc88ff', timer: 280 },
      { frame: 600, text: '\u26A0\uFE0F QTE INCOMING \u2014 watch for the prompt sequences. Survive them.', color: '#ff44ff', timer: 320 },
      { frame: 900, text: '"You\'re still here." Yes. Still here.', color: '#88aaff', timer: 240 },
      { frame: 1200, text: '\u26A0\uFE0F FINAL PHASE \u2014 everything the True Form has. Everything you have. And the scar.', color: '#ff88ff', timer: 300 },
      { frame: 1400, text: 'The void is collapsing around it. The scar burns. That means you\'re winning.', color: '#aaccff', timer: 260 },
    ],
    preText: 'The True Form \u2014 the original pattern, the system\'s deepest failsafe. You have already fought inside its echo. The scar grants focus. QTE sequences will trigger at HP thresholds. 3 lives.',
    opponentName: null,
    weaponKey: null,
    classKey: null,
    aiDiff: null,
    playerLives: 3,
    arena: 'void',
    isTrueFormFight: true,
    tokenReward: 300, blueprintDrop: null,
    postText: 'The True Form unravels. Not destroyed \u2014 resolved. The fracture system loses its anchor. Seventeen dimensions stabilize simultaneously. And you are still standing in the void. Veran\'s voice, quiet: "We can bring you back." The compass in your pocket spins once. Settles. Points home. "...Yeah. I know."',
  },

  // \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 EPILOGUE \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550

  {
    id: 95, title: 'After',
    world: '\uD83C\uDFD9\uFE0F Home \u2014 Epilogue',
    isEpilogue: true,
    narrative: [
      'The city is rebuilding.',
      '',
      'The portals still open sometimes.',
      'Not as invasions.',
      'Just as doors.',
      '',
      'People use them now.',
      'For trade. For travel.',
      'For reaching places they never could before.',
      '',
      'Veran has an office on the fourteenth floor of what used to be a ruin.',
      'She sends you coordinates sometimes.',
      '"Another fracture point. Thought you should know."',
      '',
      'You always go.',
      '',
      'The scar is still there.',
      'It doesn\'t hurt.',
      'It just reminds you of what you carried out of the loop.',
      '',
      '...',
      '',
      'Some things don\'t need explaining.',
    ],
    preText: null, noFight: true,
    tokenReward: 300,
    postText: 'STORY COMPLETE. You held the rift open with your own fragment. You survived the loop. You are the reason seventeen dimensions are still standing. Story Online is now unlocked.',
  },

  // ══════════════════════════════════════════════════════════════════
  // ACT VII — GODFALL ARC (ids 81–84)
  // A post-epilogue arc. The Fallen God emerges from the sealed rift
  // as a lore narrator and final challenge.
  // ══════════════════════════════════════════════════════════════════

);
