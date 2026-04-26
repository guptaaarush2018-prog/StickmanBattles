// smb-progression.js — Ship Progression + Fracture System
// -------------------------------------------------------
// LORE CONTEXT
// ─────────────────────────────────────────────────────────
// Axiom was a hero in his home branch. After proving himself,
// he gathered allies — the closest friends he had ever known.
// Together they discovered a fracture: a tear between multiversal layers.
// Inside it they found power without limit — power to reshape reality,
// to create and to destroy.
//
// That power destroyed them from within. Identity blurred.
// Trust collapsed. They went to war across branches.
//
// Each of them — Vael, Kael, Sora, and others — seized a branch
// and became its ruler. Axiom did the same.
//
// The Axiom who won control of THIS branch is the entity now known
// as the Creator — and beneath the Creator shell, True Form.
// He is the strongest entity in the game. No branch ruler surpasses him.
//
// The player is Axiom at an EARLIER point — before the corruption.
// He was attacked without warning. That attack is the starting motivation.
// Investigation reveals who is pulling the strings.
// The answer forces a path: find and defeat True Form.
//
// PARADOX was built during the war as a weapon — a construct
// designed to fight alongside Axiom. It can be reused as a boss
// or ally across story moments.
// -------------------------------------------------------
// Depends on: smb-globals.js (SHIP, FRACTURES, fracturePreview* globals)
// Must load: after smb-story-engine.js, before smb-multiverse.js
// -------------------------------------------------------
'use strict';

// ============================================================
// SHIP PART MANAGEMENT
// ============================================================

/**
 * Award a ship part to the player.
 * Call this from story chapter reward hooks (blueprintDrop, tokenReward, etc.)
 *
 * @param {'hull'|'engine'|'core'|'crystal'} part
 */
function giveShipPart(part) {
    if (!window.SHIP) return;

    if (part === 'hull') {
        SHIP.parts.hull = Math.min(SHIP.parts.hull + 1, 5);
    } else if (part in SHIP.parts) {
        SHIP.parts[part] = true;
    }

    // Persist across sessions
    _saveShipState();
    checkShipCompletion();
}

/**
 * Check if all parts are collected. If so, mark the ship as built and
 * fire a one-time notification.
 */
function checkShipCompletion() {
    if (SHIP.built) return; // already done

    const p = SHIP.parts;
    if (p.hull >= 5 && p.engine && p.core && p.crystal) {
        SHIP.built = true;
        _saveShipState();
        _onShipBuilt();
    }
}

/** Called once when the ship first becomes complete. */
function _onShipBuilt() {
    // Show an ability-unlock-style toast if that system is available
    if (typeof abilityUnlockToast !== 'undefined') {
        abilityUnlockToast = {
            text:     'The Axiom Ship is complete. Full branch travel unlocked.',
            icon:     '🚀',
            timer:    300,
            maxTimer: 300
        };
    }

    // Surface a boss-dialogue line if in an active fight
    if (typeof showBossDialogue === 'function' && gameRunning) {
        showBossDialogue('The ship is ready. Every branch is now within reach.', 200);
    }

    // Unlock all fractures so the player can enter them fully
    for (const f of FRACTURES) {
        f.unlocked = true;
    }
}

// ============================================================
// FRACTURE SYSTEM
// ============================================================

/**
 * Mark a fracture as visible/enterable.
 * @param {string} id — fracture id from FRACTURES array
 */
function unlockFracture(id) {
    const f = FRACTURES.find(f => f.id === id);
    if (f) {
        f.unlocked = true;
        _saveFractureState();
    }
}

/**
 * Attempt to interact with the nearest unlocked fracture.
 * Call this from player input when the "use" key is pressed.
 *
 * @param {{ x: number, y: number }} player  — current player position
 * @param {boolean} usePressed               — true on the frame "use" was pressed
 */
function checkFractureInteraction(player, usePressed) {
    if (!usePressed || fracturePreviewActive) return;
    if (!player) return;

    for (const f of FRACTURES) {
        if (!f.unlocked) continue;
        if (f.completed) continue;

        const dx = (player.x + player.w / 2) - f.x;
        const dy = (player.y + player.h / 2) - f.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 40) {
            if (!SHIP.built) {
                enterFracturePreview(f.id);
            } else {
                enterFullBranch(f.id);
            }
            return; // only interact with one fracture per frame
        }
    }
}

/**
 * Enter a short (10-second) preview of a branch.
 * Spawns one branch guardian enemy in a small arena; force-exits after 600 frames.
 * Drops the CRYSTAL ship part on first completion.
 */
function enterFracturePreview(id) {
    const f = FRACTURES.find(f => f.id === id);
    if (!f) return;

    fracturePreviewActive = true;
    fracturePreviewTimer  = 600; // 10 seconds at 60fps
    fracturePreviewId     = id;

    // Narrative subtitle
    if (typeof storyFightSubtitle !== 'undefined') {
        storyFightSubtitle = {
            text:     `FRACTURE PREVIEW — ${f.name} · Ruler: ${f.rulerName}`,
            color:    '#cc88ff',
            timer:    240,
            maxTimer: 240
        };
    }

    // Show ruler lore as boss dialogue
    if (typeof showBossDialogue === 'function') {
        showBossDialogue(`"${f.rulerLore}"`, 220);
    }

    // Spawn guardian — one medium-difficulty enemy with arena-appropriate settings
    _spawnFractureGuardian(f, /*isPreview=*/true);

    f.previewed = true;
    _saveFractureState();
}

/**
 * Enter a full branch after the ship is built.
 * This is a stub that can be expanded into a full arc later.
 */
function enterFullBranch(id) {
    const f = FRACTURES.find(f => f.id === id);
    if (!f) return;

    // Placeholder: show a "coming soon" toast via the lore subtitle system
    if (typeof storyFightSubtitle !== 'undefined') {
        storyFightSubtitle = {
            text:     `Entering ${f.name} — Ruler: ${f.rulerName} · Full branch content unlocked`,
            color:    '#88ffcc',
            timer:    300,
            maxTimer: 300
        };
    }

    if (typeof showBossDialogue === 'function') {
        showBossDialogue(`Entering ${f.name}. Expect resistance.`, 200);
    }

    // Future: launch a dedicated arc for this branch.
    // For now, mark as entered so hooks can key off it.
    f.completed = true;
    _saveFractureState();
}

/**
 * Tick the fracture preview timer. Call once per game frame.
 * When timer expires, force-exits the preview and drops the crystal part.
 */
function updateFracturePreview() {
    if (!fracturePreviewActive) return;

    fracturePreviewTimer--;

    // Countdown warning at 3 seconds remaining
    if (fracturePreviewTimer === 180) {
        if (typeof storyFightSubtitle !== 'undefined') {
            storyFightSubtitle = {
                text:     'Fracture closing — 3 seconds',
                color:    '#ff8844',
                timer:    180,
                maxTimer: 180
            };
        }
    }

    if (fracturePreviewTimer <= 0) {
        _exitFracturePreview();
    }
}

function _exitFracturePreview() {
    const id = fracturePreviewId;
    fracturePreviewActive = false;
    fracturePreviewTimer  = 0;
    fracturePreviewId     = null;

    // Award crystal part if not yet collected
    if (!SHIP.parts.crystal) {
        giveShipPart('crystal');
        if (typeof storyFightSubtitle !== 'undefined') {
            storyFightSubtitle = {
                text:     'Ship Part acquired: Fracture Crystal',
                color:    '#aaddff',
                timer:    240,
                maxTimer: 240
            };
        }
    }

    // Flash the screen as the fracture closes
    if (typeof cinScreenFlash !== 'undefined') {
        cinScreenFlash = { color: '#9933cc', alpha: 0.7, timer: 30, maxTimer: 30 };
    }
}

// ============================================================
// INTERNAL HELPERS
// ============================================================

/**
 * Spawn a branch guardian enemy for the fracture preview.
 * Uses existing Fighter/enemy infrastructure — no new classes.
 */
function _spawnFractureGuardian(fracture, isPreview) {
    if (!Array.isArray(players) || players.length === 0) return;

    // Guardian definitions keyed by fracture id
    const GUARDIAN_DEFS = {
        branch_alpha:   { weaponKey: 'sword',  classKey: 'warrior',  color: '#8844ff', name: 'Vael\'s Scout',  aiDiff: 'hard' },
        branch_null:    { weaponKey: 'spear',  classKey: 'ninja',    color: '#224488', name: 'Kael\'s Shadow', aiDiff: 'hard' },
        branch_crimson: { weaponKey: 'axe',    classKey: 'berserker',color: '#cc2222', name: 'Sora\'s Vanguard',aiDiff: 'hard' }
    };

    const def = GUARDIAN_DEFS[fracture.id] || { weaponKey: 'sword', classKey: 'warrior', color: '#667788', name: 'Branch Guardian', aiDiff: 'medium' };

    // Reuse story opponent override so HUD and fight system work correctly
    storyOpponentName = def.name;

    // Spawn as a second bot if there's already a p2 slot, otherwise replace
    // Use existing enemy creation pathway if available
    if (typeof Fighter !== 'undefined') {
        const p1 = players[0];
        const spawnX = p1 ? Math.min(GAME_W - 80, p1.x + 300) : GAME_W / 2 + 100;

        const guardian = new Fighter(spawnX, 200, 18, 50, def.color, true, 'hard');
        guardian.weapon      = WEAPONS[def.weaponKey] || WEAPONS['sword'];
        guardian.hp          = isPreview ? 120 : 250;  // preview guardian has limited HP
        guardian.maxHp       = guardian.hp;
        guardian.health      = guardian.hp;
        guardian.maxHealth   = guardian.maxHp;
        guardian.lives       = 1;
        guardian.aiDiff      = def.aiDiff;
        guardian._isFractureGuardian = true;

        if (typeof applyClass === 'function') applyClass(guardian, def.classKey);

        players.push(guardian);
    }
}

// ============================================================
// LORE INJECTION — DIALOGUE HOOKS
// ============================================================

/**
 * Lore lines that can be surfaced at key story moments.
 * Call loreLine(key) to get the string; pass to showBossDialogue or storyFightSubtitle.
 *
 * Keys map to canonical story beats defined in the lore brief.
 */
const LORE_LINES = {
    // Axiom's origin motivation
    axiom_attacked:        '"Someone hit first. I intend to find out why."',
    axiom_discovery:       '"There are others like me. Or there were."',
    fracture_found:        '"We found a tear between worlds. We thought it was a gift."',
    power_warning:         '"That much power doesn\'t belong to anyone."',
    corruption_begins:     '"We stopped recognizing each other. That was the beginning of the war."',
    war_declared:          '"We fought across realities. Each of us claimed a branch."',
    true_form_revelation:  '"The Creator is a shell. What\'s inside is what I became."',
    final_approach:        '"This branch is his. He built it. I have to end it."',

    // Paradox — construct built for war
    paradox_intro:         '"Paradox wasn\'t born. It was built. Designed to fight beside me."',
    paradox_reappears:     '"Still operational. Of course it is."',

    // Branch rulers (spoken as encounter dialogue)
    vael_taunt:            '"You should have stayed home, Axiom. This order is mine to maintain."',
    kael_taunt:            '"Silence is a branch unto itself. You don\'t belong here."',
    sora_taunt:            '"The war never ended. You just stopped fighting for a while."',

    // Multiverse trials
    trials_ship_required:  '"The trials were built to break those who arrive unprepared. Complete the ship first."',
    trials_prepare:        '"Every trial you survive brings you closer to understanding what the Creator built — and how to end it."',

    // Ship progression
    ship_first_part:       '"A hull fragment. Start of something."',
    ship_halfway:          '"The engine core is intact. This might actually work."',
    ship_complete:         '"The Axiom Ship is ready. Every branch is reachable now."',

    // Laboratory Infiltration arc
    lab_discovered:        '"Someone has been running experiments here for a long time."',
    lab_test_subject:      '"Whatever they were building — it was designed to feel pain."',
    fracture_instability:  '"The fractures aren\'t stable. Whatever they used here accelerated the decay."',
    lab_mission_complete:  '"It\'s out. Whatever comes next — it owes us nothing."',
    lab_truth:             '"The Creator didn\'t just survive the war. He started it. Every fracture — every branch that burned — he built the machine that tore them open."'
};

/**
 * Retrieve a lore line by key.
 * @param {string} key
 * @returns {string}
 */
function loreLine(key) {
    return LORE_LINES[key] || '';
}

/**
 * Fire a lore moment — show the line as an in-fight subtitle.
 * Deduped via storyEventFired so it only fires once per session.
 *
 * @param {string} key  — LORE_LINES key
 * @param {string} [color='#ccaaff']
 */
function fireLoreMoment(key) {
    // Deduplicate within the session
    if (storyEventFired && storyEventFired[key]) return;
    if (storyEventFired) storyEventFired[key] = true;

    const text = loreLine(key);
    if (!text) return;

    if (typeof storyFightSubtitle !== 'undefined') {
        storyFightSubtitle = {
            text,
            color:    '#ccaaff',
            timer:    240,
            maxTimer: 240
        };
    }
}

// ============================================================
// PLAYER MOTIVATION SYSTEM
// Grounds the player's reason for progressing — no abstraction.
// ============================================================

/**
 * Motivation stages mirror the story acts.
 * Called by story chapter completion hooks to update the displayed motivation.
 *
 * Stage 0 — default: survival (attacked without cause)
 * Stage 1 — investigation: who is controlling the attackers?
 * Stage 2 — understanding: True Form runs this branch; he will not stop
 * Stage 3 — commitment: the only way to end it is to reach True Form
 */
const MOTIVATION_STAGES = [
    { stage: 0, text: 'You were attacked. Find out why.' },
    { stage: 1, text: 'Someone is coordinating this. Follow the trail.' },
    { stage: 2, text: 'The Creator controls this branch. He built the system you\'re fighting.' },
    { stage: 3, text: 'True Form is the Creator\'s core. Reach him. End this.' }
];

let motivationStage = 0; // tracks current stage; advances via advanceMotivation()

/**
 * Advance to the next motivation stage (max stage 3).
 * Surfaces the new motivation as a story subtitle.
 */
function advanceMotivation() {
    if (motivationStage >= MOTIVATION_STAGES.length - 1) return;
    motivationStage++;
    if (typeof saveGame === 'function') { saveGame(); } else {
        try { localStorage.setItem('smb_motivation_stage', String(motivationStage)); } catch (e) {}
    }

    const m = MOTIVATION_STAGES[motivationStage];
    if (typeof storyFightSubtitle !== 'undefined') {
        storyFightSubtitle = {
            text:     m.text,
            color:    '#ffffff',
            timer:    360,
            maxTimer: 360
        };
    }
}

/** Return the current motivation text string. */
function currentMotivationText() {
    return MOTIVATION_STAGES[motivationStage]?.text || '';
}

// ============================================================
// LABORATORY INFILTRATION — side mission launcher
// Call startLabInfiltration() from any menu button or trigger.
// Chapter id 93 must be registered in smb-lab-infiltration.js.
// ============================================================

/**
 * Launch the Laboratory Infiltration side mission.
 * Sets the lab_discovered flag and begins chapter 93.
 */
function startLabInfiltration() {
    if (typeof setStoryFlag === 'function') setStoryFlag('lab_discovered');
    if (typeof fireLoreMoment === 'function') fireLoreMoment('lab_discovered');
    if (typeof startStoryFromMenu === 'function') {
        startStoryFromMenu(93);
    }
}

// ============================================================
// PERSISTENCE — thin wrappers around localStorage
// ============================================================

function _saveShipState() {
    if (typeof saveGame === 'function') { saveGame(); }
}

function _saveFractureState() {
    if (typeof saveGame === 'function') { saveGame(); }
}

function _loadProgressionState() {
    // Primary: load from GameState account data (set by smb-save.js)
    // smb-save.js loads at position 37, smb-progression.js at 45, so GameState is available.
    const _acct = (window.GameState) ? GameState.getActiveAccount() : null;
    if (_acct && _acct.data && typeof _acct.data.version === 'number') {
        const _pd = _acct.data.progression || {};
        try { if (_pd.ship)                    Object.assign(SHIP, _pd.ship); } catch(e) {}
        try {
            if (Array.isArray(_pd.fractures)) {
                _pd.fractures.forEach(function(saved) {
                    const live = FRACTURES.find(function(f) { return f.id === saved.id; });
                    if (live) {
                        live.unlocked  = saved.unlocked  !== undefined ? saved.unlocked  : live.unlocked;
                        live.previewed = saved.previewed !== undefined ? saved.previewed : live.previewed;
                        live.completed = saved.completed !== undefined ? saved.completed : live.completed;
                    }
                });
            }
        } catch(e) {}
        try {
            if (typeof _pd.motivationStage === 'number') motivationStage = Math.min(3, _pd.motivationStage);
        } catch(e) {}
        // Also apply storyProgress here so STORY_PROGRESS is correct when story files load
        const _sp = _acct.data.storyProgress;
        if (_sp && window.STORY_PROGRESS) {
            if (typeof _sp.act     === 'number') STORY_PROGRESS.act     = _sp.act;
            if (typeof _sp.chapter === 'number') STORY_PROGRESS.chapter = _sp.chapter;
            if (_sp.flags && typeof _sp.flags === 'object') Object.assign(STORY_PROGRESS.flags, _sp.flags);
        }
        return; // applied from account data
    }
}

// Load saved state on script execution
_loadProgressionState();

// ============================================================
// STORY PROGRESS HELPERS
// Operate on window.STORY_PROGRESS (defined in smb-globals.js).
// All helpers are safe to call before/after game start.
// ============================================================

/** Jump directly to a specific act (0–9). Resets chapter to 0. */
function setAct(n) {
    if (!window.STORY_PROGRESS) return;
    STORY_PROGRESS.act     = Math.max(0, Math.min(9, n));
    STORY_PROGRESS.chapter = 0;
    _saveStoryProgress();
}

/** Move forward one act (capped at 9). Resets chapter to 0. */
function advanceAct() {
    if (!window.STORY_PROGRESS) return;
    setAct(STORY_PROGRESS.act + 1);
}

/** Set a named story flag (one-shot events, branch choices, etc.). */
function setStoryFlag(key) {
    if (!window.STORY_PROGRESS) return;
    STORY_PROGRESS.flags[key] = true;
    _saveStoryProgress();
}

/** Returns true if the flag has been set. */
function hasStoryFlag(key) {
    return !!(window.STORY_PROGRESS && STORY_PROGRESS.flags[key]);
}

// ── Persistence ──────────────────────────────────────────────

function _saveStoryProgress() {
    if (typeof saveGame === 'function') { saveGame(); }
}

(function _loadStoryProgress() {
    // Skip if account data was already applied (storyProgress handled in _loadProgressionState)
    const _acct = (window.GameState) ? GameState.getActiveAccount() : null;
    if (_acct && _acct.data && _acct.data.storyProgress) return;
})();
