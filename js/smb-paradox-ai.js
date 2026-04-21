'use strict';
// smb-paradox-ai.js — drawParadoxEffects, paradoxFusionUpdateAI, paradoxAIUseAbility, paradoxPlayerUseAbility, paradoxSpeak, companion
// Depends on: smb-globals.js, smb-paradox-class.js (and preceding splits in chain)

// ============================================================
function drawParadoxEffects() {
  // Future Strike markers
  for (const s of _paradoxPendingStrikes) {
    if (s.fired) continue;
    const prog = s.timer / s.maxTimer;
    const pulse = 0.5 + Math.sin(s.timer * 0.3) * 0.3;
    ctx.save();
    ctx.globalAlpha = pulse * (1 - prog * 0.4);
    ctx.strokeStyle = '#ffcc00';
    ctx.lineWidth   = 2;
    ctx.shadowColor = '#ffcc00';
    ctx.shadowBlur  = 14;
    const sz = 12 + prog * 8;
    ctx.beginPath();
    ctx.moveTo(s.x - sz, s.y - sz); ctx.lineTo(s.x + sz, s.y + sz);
    ctx.moveTo(s.x + sz, s.y - sz); ctx.lineTo(s.x - sz, s.y + sz);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(s.x, s.y, 18, -Math.PI/2, -Math.PI/2 + prog * Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Null Field zones
  for (const nf of _paradoxNullFields) {
    const prog = nf.timer / nf.maxTimer;
    const alpha = (1 - prog) * 0.18;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle   = '#8800ff';
    ctx.beginPath();
    ctx.arc(nf.x, nf.y, nf.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = (1 - prog) * 0.35;
    ctx.strokeStyle = '#bb44ff';
    ctx.lineWidth   = 2;
    ctx.shadowColor = '#bb44ff';
    ctx.shadowBlur  = 12;
    ctx.beginPath();
    ctx.arc(nf.x, nf.y, nf.r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Command Injection floating text
  for (const ct of _paradoxCommandTexts) {
    ctx.save();
    ctx.globalAlpha = ct.alpha;
    ctx.fillStyle   = '#00ffcc';
    ctx.font        = 'bold 11px monospace';
    ctx.textAlign   = 'center';
    ctx.shadowColor = '#00ffcc';
    ctx.shadowBlur  = 8;
    ctx.fillText(ct.text, ct.x, ct.y);
    ctx.restore();
  }

  // Echo Combo afterimages
  for (const e of _paradoxEchoHits) {
    if (e.fired) continue;
    const alpha = 0.25 - (e.timer / 22) * 0.1;
    if (alpha <= 0) continue;
    ctx.save();
    ctx.globalAlpha = Math.max(0, alpha);
    ctx.fillStyle   = '#ffcc00';
    ctx.shadowColor = '#ffcc00';
    ctx.shadowBlur  = 8;
    ctx.fillRect(e.x - 9, e.y - 25, 18, 50);
    ctx.restore();
  }
}

// ============================================================
// paradoxFusionUpdateAI — deterministic combat loop for Paradox control phase
// Priority: DODGE > ATTACK > CHASE > REPOSITION
// Never stands still; always faces boss; forces attack when in range.
// ============================================================
function paradoxFusionUpdateAI(fighter) {
  if (!tfParadoxFused || tfFusionControlMode !== 'paradox') return;
  if (!fighter || fighter.health <= 0 || fighter.ragdollTimer > 0 || fighter.stunTimer > 0) return;

  // ── Target ────────────────────────────────────────────────
  const boss = players.find(p => p.isBoss && p.health > 0);
  if (!boss) return;
  fighter.target = boss;

  const dx   = boss.cx() - fighter.cx();
  const dist = Math.abs(dx);
  const dir  = Math.sign(dx) || 1;

  // Always face the boss
  fighter.facing = dir;

  // Init drift tracker
  if (fighter._pdxDriftDir === undefined) fighter._pdxDriftDir = 0;
  if (fighter._pdxDriftFrames === undefined) fighter._pdxDriftFrames = 0;

  const range = (fighter.weapon && fighter.weapon.range) ? fighter.weapon.range : 60;
  const OPTIMAL_DIST = range - 5; // stay just inside attack range

  // ── A. DODGE — check active telegraphs near fighter ───────
  let inDanger = false;
  let dodgeDir = 0;

  // Boss beams (warning or active)
  if (typeof bossBeams !== 'undefined') {
    for (const beam of bossBeams) {
      if (beam.done) continue;
      const beamDist = Math.abs(fighter.cx() - beam.x);
      if (beamDist < 80) {
        inDanger = true;
        dodgeDir = fighter.cx() < beam.x ? -1 : 1; // move away from beam
        break;
      }
    }
  }

  // Black holes
  if (!inDanger && typeof tfBlackHoles !== 'undefined') {
    for (const bh of tfBlackHoles) {
      const bhDist = Math.hypot(fighter.cx() - bh.x, fighter.cy() - bh.y);
      if (bhDist < bh.r + 60) {
        inDanger = true;
        // move directly away from black hole
        dodgeDir = Math.sign(fighter.cx() - bh.x) || (Math.random() < 0.5 ? -1 : 1);
        break;
      }
    }
  }

  // Floor hazard
  if (!inDanger && typeof bossFloorState !== 'undefined' && bossFloorState === 'hazard') {
    // Stay airborne — jump constantly
    inDanger = true;
    dodgeDir = dir; // keep moving toward boss even during floor hazard
  }

  // ── Execute priority ───────────────────────────────────────
  if (inDanger) {
    // A. DODGE: sprint away from danger zone
    fighter.vx = dodgeDir * 7.5;
    if (fighter.onGround) fighter.vy = -17; // jump out of danger
    // Reset drift counter when dodging
    fighter._pdxDriftDir    = dodgeDir;
    fighter._pdxDriftFrames = 0;

  } else if (dist <= range + 10) {
    // B. ATTACK: in range — must attack; maintain close pressure
    if (fighter.cooldown <= 0) {
      fighter.attack(boss);
    }
    // Maintain optimal distance (slight forward pressure, never retreat)
    if (dist > OPTIMAL_DIST) {
      fighter.vx = dir * 2.5;
    } else {
      fighter.vx = dir * 0.8; // micro-pressure, never zero
    }
    fighter._pdxDriftDir    = dir;
    fighter._pdxDriftFrames = 0;

  } else {
    // C. CHASE: close the gap aggressively
    fighter.vx = dir * 6.2;

    // D. REPOSITION drift guard — if drifting backward > 30 frames, force forward
    if (Math.sign(fighter.vx) !== dir) {
      fighter._pdxDriftFrames++;
    } else {
      fighter._pdxDriftFrames = 0;
      fighter._pdxDriftDir    = dir;
    }
    if (fighter._pdxDriftFrames >= 30) {
      fighter.vx = dir * 6.2;
      fighter._pdxDriftFrames = 0;
    }
  }

  // Jump to reach boss on elevated platforms or when far
  if (fighter.onGround && (boss.y < fighter.y - 45 || dist > 260)) {
    fighter.vy = -18;
  }

  // Use Paradox special abilities on top of movement
  paradoxAIUseAbility(fighter);
}

// ============================================================
// paradoxAIUseAbility — called from game loop during AI control phase
// ============================================================
function paradoxAIUseAbility(fighter) {
  if (!tfParadoxFused || tfFusionControlMode !== 'paradox') return;
  if (!fighter || !fighter.target || fighter.target.health <= 0) return;

  if (!fighter._pdxCooldowns) {
    fighter._pdxCooldowns = {};
    for (const k of Object.keys(PARADOX_ABILITIES)) fighter._pdxCooldowns[k] = 0;
  }

  for (const k of Object.keys(fighter._pdxCooldowns)) {
    if (fighter._pdxCooldowns[k] > 0) fighter._pdxCooldowns[k]--;
  }

  const target = fighter.target;
  const dist   = Math.abs(fighter.cx() - target.cx());

  const tryAbility = (key) => {
    if (fighter._pdxCooldowns[key] <= 0) {
      PARADOX_ABILITIES[key].execute(fighter, target);
      fighter._pdxCooldowns[key] = Math.round(PARADOX_ABILITIES[key].cooldown * 0.85);
      return true;
    }
    return false;
  };

  if (fighter.health < fighter.maxHealth * 0.35 && tryAbility('undoHit')) return;

  if (projectiles && projectiles.some(p => p.owner !== fighter && Math.hypot(p.x - fighter.cx(), p.y - fighter.cy()) < 150)) {
    if (tryAbility('projectileRewrite')) return;
  }

  if (dist < 100) {
    if (Math.random() < 0.5 && tryAbility('echoCombo')) return;
    if (tryAbility('phaseDash')) return;
  }

  if (dist >= 100 && dist < 240) {
    if (Math.random() < 0.6 && tryAbility('futureStrike')) return;
    if (tryAbility('commandInjection')) return;
  }

  if (dist >= 240 && tryAbility('microTeleport')) return;

  if (Math.abs(fighter.y - target.y) < 40 && tryAbility('positionSwap')) return;
}

// ============================================================
// paradoxPlayerUseAbility — called from processInput during player control phase
// ============================================================
function paradoxPlayerUseAbility(fighter) {
  if (!tfParadoxFused || tfFusionControlMode !== 'player') return;
  if (!fighter || fighter.health <= 0) return;

  if (!fighter._pdxCooldowns) {
    fighter._pdxCooldowns = {};
    for (const k of Object.keys(PARADOX_ABILITIES)) fighter._pdxCooldowns[k] = 0;
  }

  const target = fighter.target || (players.find(p => p !== fighter && p.health > 0 && p.isBoss));
  if (!target) return;

  const dist = target ? Math.abs(fighter.cx() - target.cx()) : 999;

  for (const k of Object.keys(fighter._pdxCooldowns)) {
    if (fighter._pdxCooldowns[k] > 0) fighter._pdxCooldowns[k]--;
  }

  const tryAbility = (key) => {
    if (fighter._pdxCooldowns[key] <= 0) {
      PARADOX_ABILITIES[key].execute(fighter, target);
      fighter._pdxCooldowns[key] = Math.round(PARADOX_ABILITIES[key].cooldown * 1.15);
      abilityFlashTimer  = 14;
      abilityFlashPlayer = fighter;
      return true;
    }
    return false;
  };

  if (dist < 100) {
    if (tryAbility('phaseDash')) return;
    if (tryAbility('echoCombo')) return;
  } else if (dist < 240) {
    if (tryAbility('commandInjection')) return;
    if (tryAbility('futureStrike')) return;
  } else {
    if (tryAbility('microTeleport')) return;
  }
  for (const k of Object.keys(PARADOX_ABILITIES)) {
    if (tryAbility(k)) return;
  }
}

// ============================================================
// PARADOX COMPANION  — post-final-boss ambient voice system
// Activated once by setting localStorage 'smc_paradox_companion'
// after the TrueForm ending. No UI, no spam.
// ============================================================

// Read persisted flag once on load
let paradoxCompanionActive = localStorage.getItem('smc_paradox_companion') === '1';

// Internal state
let _pdxCompIdleTimer    = 0;   // counts up; fires a line at threshold
let _pdxCompLastArena    = '';  // detect arena change
let _pdxCompCooldown     = 0;   // global cooldown between any lines (frames)
const _PDX_IDLE_MIN      = 3600; // 60s minimum between idle lines
const _PDX_IDLE_VARIANCE = 3600; // up to 60s additional random delay
const _PDX_COOLDOWN      = 900;  // 15s minimum between any two lines

const _PDX_BOSS_START_LINES = [
  "I have seen this fight before. It ends differently now.",
  "He is strong. You are stronger than you were.",
  "I remember the last time you faced him. You did not hesitate.",
  "Do not let him read you. Move first.",
];

const _PDX_AREA_LINES = {
  creator:   ["This place again. The architecture is afraid of you now.", "He built this arena to break you. It did not."],
  void:      ["The void remembers what happened here.", "He thought the void was his. You proved otherwise."],
  _default:  ["New ground. Stay sharp.", "I am still here.", "Different arena. Same outcome."],
};

const _PDX_IDLE_LINES = [
  "Still here.",
  "I watch. That is enough.",
  "You carry what I gave you. Use it well.",
  "The fracture is quiet for now.",
  "I do not sleep. I observe.",
  "Something is coming. Not today.",
];

/**
 * Speak a single line as Paradox. Uses showBossDialogue if available,
 * otherwise silently skips. Respects global cooldown.
 */
function paradoxSpeak(line) {
  if (!paradoxCompanionActive) return;
  if (_pdxCompCooldown > 0) return;
  if (typeof showBossDialogue !== 'function') return;
  showBossDialogue(`[Paradox] ${line}`, 200);
  _pdxCompCooldown = _PDX_COOLDOWN;
}

/**
 * Called once when the TrueForm ending completes (non-intro path).
 * Sets the persistent companion flag.
 */
function activateParadoxCompanion() {
  if (paradoxCompanionActive) return;
  paradoxCompanionActive = true;
  localStorage.setItem('smc_paradox_companion', '1');
}

/**
 * Called at boss/trueform game start, after players[] is populated.
 * Fires a single contextual line with a short delay so it lands
 * after the opening animation settles.
 */
function paradoxOnBossStart() {
  if (!paradoxCompanionActive) return;
  const line = _PDX_BOSS_START_LINES[Math.floor(Math.random() * _PDX_BOSS_START_LINES.length)];
  // Delay 4 seconds — let opening cinematics breathe
  setTimeout(() => paradoxSpeak(line), 4000);
}

/**
 * Called from updateParadoxCompanion() when arena changes mid-session.
 */
function _paradoxOnAreaChange(arenaKey) {
  if (!paradoxCompanionActive) return;
  const pool = _PDX_AREA_LINES[arenaKey] || _PDX_AREA_LINES._default;
  const line = pool[Math.floor(Math.random() * pool.length)];
  paradoxSpeak(line);
}

/**
 * Tick function — called each frame from gameLoop.
 * Handles cooldown decay, arena-change detection, and rare idle lines.
 */
function updateParadoxCompanion() {
  if (!paradoxCompanionActive || !gameRunning) return;

  if (_pdxCompCooldown > 0) _pdxCompCooldown--;

  // Arena-change detection
  if (typeof currentArenaKey !== 'undefined' && currentArenaKey !== _pdxCompLastArena) {
    if (_pdxCompLastArena !== '') _paradoxOnAreaChange(currentArenaKey);
    _pdxCompLastArena = currentArenaKey;
  }

  // Rare idle line — only during active gameplay, not during cinematics
  if (!isCinematic) {
    _pdxCompIdleTimer++;
    const threshold = _PDX_IDLE_MIN + Math.floor(Math.random() * _PDX_IDLE_VARIANCE);
    if (_pdxCompIdleTimer >= threshold) {
      _pdxCompIdleTimer = 0;
      // ~40% chance to actually speak when threshold reached (keeps it rare)
      if (Math.random() < 0.4) {
        const line = _PDX_IDLE_LINES[Math.floor(Math.random() * _PDX_IDLE_LINES.length)];
        paradoxSpeak(line);
      }
    }
  }
}
