// smb-lab-infiltration.js — Side Mission: Laboratory Infiltration
// Depends on: smb-story-registry.js (STORY_CHAPTER_REGISTRY)
//             smb-globals.js (STORY_PROGRESS)
//             smb-progression.js (setStoryFlag, fireLoreMoment)
// Must load: after smb-story-registry.js, before smb-story-finalize.js
//
// Chapter id 96 — sits outside the main 0–95 story arc so it never
// affects story-completion checks or id/index alignment in 0–95.
// Launched via startLabInfiltration() in smb-progression.js.

STORY_CHAPTER_REGISTRY.push({
    id: 96,
    title: 'Laboratory Infiltration',
    world: '🧪 Abandoned Research Facility',

    narrative: [
        'The signal led you here.',
        '',
        'An abandoned facility — buried beneath a collapsed district.',
        'Whatever it was built for, it was never meant to be found.',
        '',
        '"Axiom." Veran\'s voice on the comm. Strained.',
        '"That facility is on every restricted list I have access to."',
        '"It predates the fractures. Which means someone was studying them"',
        '"before they were supposed to exist."',
        '',
        'The logs inside tell a different story.',
        '"Axiom War — Phase 1 — Fracture Acceleration."',
        '"Project goal: weaponize fracture decay to destabilize rival branches."',
        '"Authorized by: the Creator."',
        '',
        'This wasn\'t an accident.',
        'The fractures were built as weapons.',
        'And this facility was where Axiom\'s war started.',
        '',
        'The door was already open.',
        'Something was inside, waiting.',
    ],

    fightScript: [
        { frame: 60,  text: 'Lab security — automated, hostile, no hesitation.', color: '#88ccff', timer: 260 },
        { frame: 200, text: '"That\'s not a guard." Veran\'s voice, sharp. "That\'s a test subject."', color: '#ffaa44', timer: 280 },
        { frame: 420, text: 'It moves like it\'s been fighting its whole life. Because it has.', color: '#cc88ff', timer: 260 },
        { frame: 600, text: 'Finish it. Then find the cells.', color: '#ffffff', timer: 220 },
    ],

    preText: 'Lab security — a conditioned fighter built to eliminate intruders. It has never lost.',
    opponentName: 'Lab Guardian',
    weaponKey: 'spear',
    classKey: 'ninja',
    aiDiff: 'hard',
    opponentColor: '#336688',
    playerLives: 3,
    arena: 'city',
    tokenReward: 80,
    blueprintDrop: null,

    postText: 'The cells are empty. Whatever was held here is gone — freed or escaped. You find one remaining terminal. The logs confirm it: the fractures aren\'t natural. They were accelerated here, on purpose, by order of the Creator. Axiom\'s war was engineered. Every fracture you\'ve crossed — he opened.',

    // Fires on first-clear win via the onComplete hook in story2OnMatchEnd.
    onComplete() {
        if (typeof setStoryFlag === 'function') {
            setStoryFlag('test_subject_freed');
            setStoryFlag('lab_truth_known');  // gates Creator confrontation dialogue
        }
        if (typeof fireLoreMoment === 'function') {
            fireLoreMoment('fracture_instability');
            fireLoreMoment('lab_truth');
        }
        // Reward: grant ship core part (critical progression unlock)
        if (typeof giveShipPart === 'function' && (!window.SHIP || !window.SHIP.parts || !window.SHIP.parts.core)) {
            giveShipPart('core');
            if (typeof storyFightSubtitle !== 'undefined') {
                storyFightSubtitle = {
                    text:  '⬡ Ship Core acquired — the Axiom Ship grows closer to completion.',
                    color: '#aaddff',
                    timer: 280, maxTimer: 280,
                };
            }
        }
        // Reward: grant Paradox memory upgrade (unlocks a special ability)
        if (typeof _story2 !== 'undefined' && typeof _saveStory2 !== 'undefined') {
            _story2.blueprints = _story2.blueprints || [];
            if (!_story2.blueprints.includes('void_pulse2')) {
                _story2.blueprints.push('void_pulse2');
                if (typeof showToast === 'function') showToast('📋 Blueprint unlocked: Void Pulse — available in Story Store.');
            }
            _saveStory2();
        }
    },
});
