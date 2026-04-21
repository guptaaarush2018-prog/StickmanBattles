// Appends chapters for act2/smb-act2-arc3.js.
STORY_CHAPTER_REGISTRY.push(
  {
    id: 42, type: 'exploration', title: 'What the Ancients Left',
    world: '🏛️ Ruins Dimension — The First Collapse',
    narrative: [
      'The first dimension to ever fracture.',
      '',
      'It looked like your world might.',
      'Broken towers. Cracked sky.',
      'A planet mid-collapse, frozen in time.',
      '',
      'The fourth Architect had lived here since the beginning.',
      'And hidden the original fracture diagram deep in the ruins.',
      '"You\'ll find it," the rift entity said.',
      '"The fragment will guide you."',
      '',
      'The ruins stretched endlessly ahead.',
      'Something ancient waited in the rubble.',
    ],
    objectName: 'Fracture Diagram',
    style: 'ruins',
    worldLength: 4800,
    sky: ['#100808', '#1e1010'],
    groundColor: '#3a2e20',
    platColor: '#4a3e30',
    spawnEnemies: [
      { wx: 700,  name: 'Stone Warden',    weaponKey: 'hammer', classKey: 'tank',    aiDiff: 'hard',   color: '#776655', armor: ['helmet'] },
      { wx: 1100, name: 'Rubble Crawler',  weaponKey: 'sword',  classKey: 'ninja',   aiDiff: 'medium', color: '#887766' },
      { wx: 1500, name: 'Ruin Guardian',   weaponKey: 'axe',    classKey: 'warrior', aiDiff: 'hard',   color: '#998866', armor: ['helmet', 'chestplate'] },
      { wx: 1900, name: 'Shard Stalker',   weaponKey: 'spear',  classKey: 'ninja',   aiDiff: 'hard',   color: '#776644' },
      { wx: 2300, name: 'Ancient Scout',   weaponKey: 'sword',  classKey: 'ninja',   aiDiff: 'expert', color: '#887755' },
      { wx: 2700, name: 'Tomb Knight',     weaponKey: 'axe',    classKey: 'warrior', aiDiff: 'expert', color: '#998877', armor: ['helmet'] },
      { wx: 3000, name: 'Relic Knight',    weaponKey: 'spear',  classKey: 'warrior', aiDiff: 'expert', color: '#aa9977', armor: ['helmet', 'chestplate'] },
      { wx: 3400, name: 'Dust Wraith',     weaponKey: 'sword',  classKey: 'ninja',   aiDiff: 'expert', color: '#665544' },
      { wx: 3800, name: 'Keeper',          weaponKey: 'hammer', classKey: 'tank',    aiDiff: 'expert', color: '#998844', armor: ['helmet', 'chestplate', 'leggings'] },
      // Diagram guardians — hold the fracture diagram location
      { wx: 4300, name: 'Diagram Sentinel', weaponKey: 'axe',   classKey: 'tank',    aiDiff: 'expert', color: '#776644', isGuard: true, health: 140, armor: ['helmet', 'chestplate'] },
      { wx: 4380, name: 'Vault Warden',     weaponKey: 'hammer',classKey: 'warrior', aiDiff: 'expert', color: '#887755', isGuard: true, health: 120, armor: ['helmet', 'chestplate', 'leggings'] },
      { wx: 4450, name: 'Last Keeper',      weaponKey: 'spear', classKey: 'ninja',   aiDiff: 'expert', color: '#665533', isGuard: true, health: 100 },
    ],
    playerLives: 3,
    tokenReward: 130, blueprintDrop: null,
    postText: 'The fracture diagram. Not a physical object — a transfer of knowledge. You understand it immediately. The closure protocol. Three steps. The third step you already knew.',
  },

  // ───────────────────────────────────────────────────────────────
  // CHAPTER V — UNRAVELING
  // Setting: back to the core — executing the closure protocol.
  // Mechanics: escalating distortion, staggered elite fights.
  // ───────────────────────────────────────────────────────────────

  {
    id: 43, title: 'The Last Army',
    world: '⚛️ Multiversal Core — Outer Ring',
    narrative: [
      'The rift entity had been quiet.',
      'Then it spoke.',
      '',
      '"You\'ve gathered the Architects. You know the protocol."',
      '"And you intend to sacrifice yourself."',
      '"I don\'t want that. I never wanted that."',
      '',
      '"But the rift has its own hunger now. It generates fighters.',
      '"Echoes. Fragments of collapsed dimensions wearing combat forms."',
      '"They will try to stop you."',
      '"Not because I command it — because the rift commands it."',
      '"Survive them. Then we talk."',
    ],
    fightScript: [
      { frame: 80,  text: '⚠️ Reality distortion is increasing. The visual noise is the rift amplifying.', color: '#cc44ff', timer: 310 },
      { frame: 90,  text: 'Rift echos — they don\'t die cleanly. They fracture and reassemble. Hit hard.', color: '#ff44cc', timer: 270 },
      { frame: 380, text: 'The fragment is fully charged. You can feel it. Wait for the right moment.', color: '#88aaff', timer: 260 },
    ],
    preText: 'The rift\'s final echo wave — powerful fracture constructs. Two simultaneous. 2 lives.',
    opponentName: 'Rift Echo Alpha', weaponKey: 'sword', classKey: 'warrior', aiDiff: 'expert', opponentColor: '#aa00ff',
    twoEnemies: true,
    secondEnemy: { weaponKey: 'axe', classKey: 'berserker', aiDiff: 'hard', color: '#8800cc' },
    armor: ['helmet', 'chestplate'],
    playerLives: 2,
    arena: 'ruins',
    tokenReward: 120, blueprintDrop: null,
    postText: 'The echoes collapse. The outer ring is clear. Ahead: the rift core. Veran and the Architects are in position. "Whenever you\'re ready," Veran says. Her voice is steady. Yours is too.',
  },

  {
    id: 44, title: 'The Herald of Nothing',
    world: '⚛️ Multiversal Core — Threshold',
    narrative: [
      'The rift\'s final guardian.',
      '',
      'Not a construct. Not an echo.',
      'A person who had volunteered.',
      '',
      '"If the rift closes, everything it absorbed is destroyed.",',
      '"Fifty-two dimensions. Every echo. Every stolen fighter.",',
      '"Including me."',
      '',
      '"I\'d rather die fighting than dissolve when you seal it."',
      '"Make it count."',
    ],
    storeNag: '⚠️ The final threshold guardian. 1 life. This is the last fight before the Creator.',
    fightScript: [
      { frame: 70,  text: '"I\'ve been waiting for this for sixty years. Make it a good fight."', color: '#ffffff', timer: 290 },
      { frame: 340, text: 'They\'re holding nothing back. Neither are you.', color: '#ffaa55', timer: 250 },
      { frame: 600, text: '"You\'re going to win," they say, mid-swing. "I can feel it." So can you.', color: '#aaccff', timer: 260 },
    ],
    preText: 'The Herald of Nothing — a voluntary last stand before the rift core. Expert-level. 1 life.',
    opponentName: 'Herald of Nothing', weaponKey: 'voidblade', classKey: 'ninja', aiDiff: 'expert', opponentColor: '#ffffff',
    armor: ['helmet', 'chestplate', 'leggings'],
    playerLives: 1,
    arena: 'ruins',
    tokenReward: 150, blueprintDrop: null,
    postText: 'They dissolve in light, not in violence. Peaceful. The rift core opens. The rift entity stands at the center. "One more thing before the protocol," it says. "There is something beyond the rift. Something that has been watching." It looks at you. "The Creator of the fracture system itself. It built me. It built you. And now it knows what you can do." A long silence. "You will meet it. But not today." The core hums. "Today, we close this."',
  },

  // ══════════════════════════════════════════════════════════════════
  // ACT IV — THE ARCHITECTS' WAR (ids 45–60)
  // The Architects convene. A betrayal reshapes everything.
  // ══════════════════════════════════════════════════════════════════

  // ─────── Arc 3-0: The Assembly (ids 45–51) ────────────────────────

);
