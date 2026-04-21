'use strict';
// smb-qte-engine.js — QTE stage tickers, prompt advancement, round failure/reset, hit/miss, outro, _endQTE, visual helpers
// Depends on: smb-globals.js, smb-particles-core.js, smb-combat.js

// ── Build prompt queue ────────────────────────────────────────────────────────
function _buildPromptQueue(count, def) {
  const queue = [];
  for (let i = 0; i < count; i++) {
    const actualKey  = _QTE_ALL_KEYS[Math.floor(Math.random() * _QTE_ALL_KEYS.length)];
    const isMirrored = def.mirrored && Math.random() < (def.mirrorChance || 0);
    const displayKey = isMirrored ? _QTE_MIRROR[actualKey] : actualKey;
    queue.push({
      key:          actualKey,
      displayKey:   displayKey,
      label:        _QTE_KEY_MAP[actualKey]  ? _QTE_KEY_MAP[actualKey].label  : actualKey.toUpperCase(),
      displayLabel: _QTE_KEY_MAP[displayKey] ? _QTE_KEY_MAP[displayKey].label : displayKey.toUpperCase(),
      isMirrored,
      hit:          false,
      missed:       false,
      timer:        0,
      maxTimer:     def.windowFrames,
      x:            0,
      y:            0,
      slot:         i % (def.simultaneousCount || 1),
    });
  }
  return queue;
}

// ── Stage tickers ─────────────────────────────────────────────────────────────

function _tickQTEIntro() {
  const s = QTE_STATE;
  s.introTimer++;

  // Escalate visuals
  _qteScanAlpha  = Math.min(0.45, s.introTimer / 80 * 0.45);
  _qteVoidAlpha  = Math.min(0.55 * s.def.bgIntensity, s.introTimer / 80 * 0.55 * s.def.bgIntensity);
  _qteCloneAlpha = Math.min(0.6, s.introTimer / 80 * 0.6);

  // Warp grid activation
  for (const node of _qteWarpGrid) {
    node.wobble = (node.wobble || 0) + 0.04;
    node.x = node.bx + Math.sin(node.wobble + node.phase) * 8 * s.def.bgIntensity;
    node.y = node.by + Math.cos(node.wobble + node.phase) * 6 * s.def.bgIntensity;
  }

  _qteFlashAlpha = Math.max(0, _qteFlashAlpha - 0.04);
  screenShake = Math.max(screenShake, _qteShakeExtra * (1 - s.introTimer / 80));

  if (s.introTimer >= 80) {
    s.stage = 'prompts';
    _advancePrompts();
  }
}

function _tickQTEPrompts() {
  const s   = QTE_STATE;
  const def = s.def;

  // Maintain visual chaos
  _qteScanAlpha  = 0.35 + s.chaosLevel * 0.25;
  _qteVoidAlpha  = 0.4  + s.chaosLevel * 0.3;
  _qteCloneAlpha = 0.4  + s.chaosLevel * 0.3;

  // Warp grid
  for (const node of _qteWarpGrid) {
    node.wobble = (node.wobble || 0) + 0.06 + s.chaosLevel * 0.04;
    node.x = node.bx + Math.sin(node.wobble + node.phase) * (10 + s.chaosLevel * 18) * def.bgIntensity;
    node.y = node.by + Math.cos(node.wobble + node.phase) * (8  + s.chaosLevel * 14) * def.bgIntensity;
  }

  _qteFlashAlpha = Math.max(0, _qteFlashAlpha - 0.05);

  // Tick active prompts
  let allResolved = true;
  for (const prompt of s.prompts) {
    if (prompt.hit || prompt.missed) continue;
    allResolved = false;
    prompt.timer++;
    if (!_qtePromptReachable(prompt, s)) {
      prompt._badPosFrames = (prompt._badPosFrames || 0) + 1;
      _qteEnsureReachable(prompt, prompt._slot || 0, prompt._total || 1, s);
      prompt.timer = Math.max(0, prompt.timer - 4);
    } else {
      prompt._badPosFrames = 0;
    }

    // Pulse radius on the bubble
    prompt.pulseT = (prompt.pulseT || 0) + 0.18;

    // Check expiry
    if (prompt.timer >= prompt.maxTimer) {
      prompt.missed = true;
      s.failCount++;
      s.failedThisRound = true;
      _onPromptFail(prompt);
      // In simultaneous mode — don't immediately restart, let others resolve
    } else {
      // Check key press (rising-edge: key is down AND was not down last frame)
      const keyDown = keysDown.has(prompt.key);
      if (keyDown && !prompt._wasDown) {
        prompt.hit = true;
        s.completedCount++;
        _onPromptHit(prompt, s);
      }
      prompt._wasDown = keyDown;
    }
  }

  // All prompts in current batch resolved?
  if (allResolved || s.prompts.every(p => p.hit || p.missed)) {
    const anyMissed = s.prompts.some(p => p.missed);
    if (anyMissed && !def.simultaneous) {
      // Sequential fail: reset the queue but escalate chaos
      _resetQTERound();
      return;
    }
    // Advance to next batch or finish
    _advancePrompts();
  }
}

function _tickQTEOutroSuccess() {
  const s = QTE_STATE;
  s.outroTimer++;

  _qteFlashAlpha  = Math.max(0, _qteFlashAlpha - 0.02);
  _qteScanAlpha   = Math.max(0, _qteScanAlpha  - 0.025);
  _qteVoidAlpha   = Math.max(0, _qteVoidAlpha  - 0.025);
  _qteCloneAlpha  = Math.max(0, _qteCloneAlpha - 0.018);
  _qteShakeExtra  = Math.max(0, _qteShakeExtra - 1);
  screenShake     = Math.max(screenShake, _qteShakeExtra);

  // Warp grid settle
  for (const node of _qteWarpGrid) {
    node.x += (node.bx - node.x) * 0.12;
    node.y += (node.by - node.y) * 0.12;
  }

  if (s.outroTimer >= 90) {
    _endQTE(true);
  }
}

function _tickQTEOutroFail() {
  const s = QTE_STATE;
  s.outroTimer++;
  _qteFlashAlpha = Math.max(0, _qteFlashAlpha - 0.03);
  screenShake = Math.max(screenShake, 18 * (1 - s.outroTimer / 45));

  if (s.outroTimer >= 45) {
    _endQTE(false);
  }
}

// ── Prompt advancement ────────────────────────────────────────────────────────

function _advancePrompts() {
  const s   = QTE_STATE;
  const def = s.def;

  // All prompts done?
  if (s.promptIdx >= s.promptQueue.length) {
    _beginOutroSuccess();
    return;
  }

  s.prompts = [];

  if (def.simultaneous) {
    // Launch simultaneousCount prompts at once
    const batchSize = def.simultaneousCount || 3;
    for (let b = 0; b < batchSize && s.promptIdx < s.promptQueue.length; b++, s.promptIdx++) {
      const p = s.promptQueue[s.promptIdx];
      _assignPromptPosition(p, b, batchSize, s);
      s.prompts.push(p);
    }
  } else {
    // One prompt at a time
    const p = s.promptQueue[s.promptIdx++];
    _assignPromptPosition(p, 0, 1, s);
    s.prompts.push(p);
  }
}

function _assignPromptPosition(prompt, slot, total, s) {
  const cw = canvas.width;
  const ch = canvas.height;
  const anchor = _qteAnchorPoint(s);

  if (s.def.id === 3) {
    // Phase 3: chaotic, but still inside a player-reachable pocket.
    prompt.x = anchor.x + (Math.random() - 0.5) * 300;
    prompt.y = anchor.y + (Math.random() - 0.5) * 220;
  } else if (s.def.id === 4) {
    // Phase 4: collapse arc close enough to read and react to.
    const angle = -Math.PI / 2 + (slot / Math.max(total - 1, 1)) * Math.PI * 1.2;
    const r     = 90 + slot * 10;
    prompt.x    = anchor.x + Math.cos(angle) * r;
    prompt.y    = anchor.y + Math.sin(angle) * (r * 0.82);
  } else if (total > 1) {
    // Phase 2: spread around player anchor, not the raw screen edges.
    const offsets = [-120, 0, 120];
    prompt.x = anchor.x + (offsets[slot] || 0);
    prompt.y = anchor.y + (slot % 2 === 0 ? -28 : 28);
  } else {
    // Single prompt: near the player focus point.
    prompt.x = anchor.x + (Math.random() - 0.5) * 96;
    prompt.y = anchor.y + (Math.random() - 0.5) * 56;
  }
  _qteEnsureReachable(prompt, slot, total, s);
  prompt.timer    = 0;
  prompt._wasDown = false; // always reset so any press — held OR new — registers immediately
}

// ── Round failure/reset ───────────────────────────────────────────────────────

function _resetQTERound() {
  const s = QTE_STATE;
  s.totalAttempts++;
  s.chaosLevel = Math.min(1, s.chaosLevel + 0.22);

  // Escalate visual chaos
  _qteFlashColor = '#ff0044';
  _qteFlashAlpha = 0.70;
  _qteShakeExtra = 22 + s.chaosLevel * 20;
  screenShake = Math.max(screenShake, _qteShakeExtra);

  // Damage player (failDamage fraction of max HP)
  const p1 = s.playerRef;
  if (p1 && p1.health > 0) {
    const dmg = Math.round(p1.maxHealth * s.def.failDamage * (1 + s.chaosLevel * 0.5));
    p1.health = Math.max(1, p1.health - dmg); // never kill outright (plot armor)
    if (typeof spawnParticles === 'function') {
      spawnParticles(p1.cx(), p1.cy(), '#ff0044', 20);
    }
    if (typeof showBossDialogue === 'function') {
      const taunts = [
        '"Slow."',
        '"That was already written."',
        '"You\'re not here anymore. You just don\'t know it."',
        '"You\'re more interesting when you resist."',
      ];
      showBossDialogue(taunts[s.totalAttempts % taunts.length], 120);
    }
  }

  // Spawn fail particles at centre
  _spawnQTEBurst(canvas.width / 2, canvas.height / 2, 30, '#ff0044');
  _spawnQTERipple(canvas.width / 2, canvas.height / 2, '#ff0044');

  // Combo text
  _qteComboText = {
    text:  'SEQUENCE FAILED',
    timer: 60,
    x:     canvas.width  / 2,
    y:     canvas.height * 0.30,
    color: '#ff2244',
  };

  // Plot armor: after N failures, inject easy prompts at end of queue
  if (s.def.plotArmor && s.totalAttempts >= s.def.plotArmor) {
    const remaining = s.promptQueue.slice(s.promptIdx);
    // Replace last 2 prompts with easily-detectable keys, no mirroring
    for (let i = Math.max(0, remaining.length - 2); i < remaining.length; i++) {
      remaining[i].isMirrored  = false;
      remaining[i].displayKey  = remaining[i].key;
      remaining[i].displayLabel= remaining[i].label;
      remaining[i].maxTimer    = 80; // extra time
    }
  }

  // Rebuild remaining prompts into the queue (restart from current idx)
  s.promptIdx = 0;
  s.failCount = 0;
  s.failedThisRound = false;
  s.prompts   = [];

  // Short pause then continue
  QTE_STATE.stage = 'outro_fail';
  QTE_STATE.outroTimer = 0;
}

// ── Prompt hit/miss events ────────────────────────────────────────────────────

function _onPromptHit(prompt, s) {
  // Cosmic flare particle burst at prompt position
  _spawnQTEBurst(prompt.x, prompt.y, 22, prompt.isMirrored ? '#00ffff' : '#ffcc00');
  _spawnQTERipple(prompt.x, prompt.y, '#ffcc00');

  // Screen flash on phase 3/4
  if (s.def.id >= 3) {
    _qteFlashColor = '#ffcc00';
    _qteFlashAlpha = 0.25;
    screenShake = Math.max(screenShake, 6);
  }

  // Timeline pulse
  _spawnTimelinePulse(prompt.x, prompt.y, s.def.id);

  // Combo text
  const combos = ['NICE', 'GOOD', 'PERFECT', 'REALITY HELD', 'TIMELINE STABLE'];
  _qteComboText = {
    text:  combos[Math.min(s.completedCount - 1, combos.length - 1)],
    timer: 40,
    x:     prompt.x,
    y:     prompt.y - 50,
    color: '#88ffcc',
  };
}

function _onPromptFail(prompt) {
  _spawnQTEBurst(prompt.x, prompt.y, 12, '#ff2244');
  screenShake = Math.max(screenShake, 10);
  // Simultaneous phases: deal damage per missed prompt (sequential phases handle this in _resetQTERound)
  if (QTE_STATE && QTE_STATE.def.simultaneous) {
    const p1 = QTE_STATE.playerRef;
    if (p1 && p1.health > 0) {
      const dmg = Math.round(p1.maxHealth * QTE_STATE.def.failDamage * 0.5); // half-weight per prompt
      p1.health = Math.max(1, p1.health - dmg);
      if (typeof spawnParticles === 'function') spawnParticles(p1.cx(), p1.cy(), '#ff0044', 10);
    }
  }
}

// ── Outro success ─────────────────────────────────────────────────────────────

function _beginOutroSuccess() {
  const s = QTE_STATE;
  s.stage      = 'outro_success';
  s.outroTimer = 0;

  // Visual payoff
  _qteFlashColor = _phaseColor(s.phase);
  _qteFlashAlpha = 0.70;
  screenShake = Math.max(screenShake, 30);

  // Massive particle burst
  _spawnQTEBurst(canvas.width / 2, canvas.height / 2, 60, _phaseColor(s.phase));
  _spawnQTEBurst(canvas.width / 2, canvas.height / 2, 40, '#ffffff');
  for (let i = 0; i < 6; i++) {
    const rx = 60 + Math.random() * (canvas.width  - 120);
    const ry = 60 + Math.random() * (canvas.height - 120);
    _spawnQTERipple(rx, ry, _phaseColor(s.phase));
  }

  // Combo headline
  const headlines = [
    '', // phase 0 unused
    'TIMELINE STABILIZED',
    'MULTIVERSE REALIGNED',
    'ERASURE REVERSED',
    'MULTIVERSE REBUILT',
  ];
  _qteComboText = {
    text:  headlines[s.phase] || 'SUCCESS',
    timer: 90,
    x:     canvas.width  / 2,
    y:     canvas.height * 0.28,
    color: _phaseColor(s.phase),
  };

  // Dialogue
  const successLines = [
    '',
    '"...you broke the sequence."',
    '"That wasn\'t in any timeline I modeled."',
    '"You survived the gap between realities. Remarkable."',
    '"...I see. You\'re something else entirely."',
  ];
  if (typeof showBossDialogue === 'function') {
    showBossDialogue(successLines[s.phase] || '', 200);
  }

  // Deal success bonus damage to boss
  const boss = s.bossRef;
  if (boss && boss.health > 0) {
    if (s.def.successBonus >= 9999) {
      // Phase 4 kill — set health to 1 so boss death scene triggers naturally
      boss.health = 1;
      if (typeof dealDamage === 'function') dealDamage(s.playerRef, boss, 1, 0);
    } else {
      if (typeof dealDamage === 'function') dealDamage(s.playerRef, boss, s.def.successBonus, 0);
    }
  }

  // Phase-specific cinematic extras
  _phaseSuccessExtras(s);
}

function _phaseSuccessExtras(s) {
  switch (s.phase) {
    case 1:
      // Mild gravity glitch clears
      if (typeof tfGravityInverted !== 'undefined' && tfGravityInverted) {
        tfGravityInverted = false;
        if (typeof showBossDialogue === 'function') showBossDialogue('"You broke the pull. Noted."', 100);
      }
      break;
    case 2:
      // Clear all black holes
      if (typeof tfBlackHoles !== 'undefined') tfBlackHoles.length = 0;
      if (typeof setCameraDrama === 'function') setCameraDrama('wideshot', 80);
      break;
    case 3:
      // Slow-mo moment
      slowMotion = 0.08;
      setTimeout(() => { if (typeof slowMotion !== 'undefined' && slowMotion < 0.5) slowMotion = 1.0; }, 1200);
      if (typeof setCameraDrama === 'function') {
        setCameraDrama('impact', 40);
        setTimeout(() => setCameraDrama('focus', 70, s.bossRef, 1.28), 700);
      }
      break;
    case 4:
      // Final collapse cinematic — camera pulls out dramatically
      slowMotion = 0.05;
      if (typeof setCameraDrama === 'function') {
        setCameraDrama('wideshot', 120);
        setTimeout(() => { if (typeof setCameraDrama === 'function') setCameraDrama('focus', 90, s.bossRef, 1.6); }, 2000);
      }
      setTimeout(() => { if (typeof slowMotion !== 'undefined') slowMotion = 1.0; }, 3000);
      // Massive shake sequence
      let _shakeSeq = 0;
      const _doShake = () => {
        if (_shakeSeq++ < 5 && typeof screenShake !== 'undefined') {
          screenShake = 35 - _shakeSeq * 4;
          setTimeout(_doShake, 220);
        }
      };
      _doShake();
      break;
  }
}

// ── End QTE ───────────────────────────────────────────────────────────────────

function _endQTE(success) {
  if (!QTE_STATE) return;
  const phase = QTE_STATE.phase;

  // Restore slowMotion (we froze it at 0.0 during the QTE) and release combat lock
  if (typeof slowMotion !== 'undefined') slowMotion = 1.0;
  if (typeof clearCombatLock === 'function') clearCombatLock('qte');

  // Fade out visuals
  _qteFlashAlpha  = 0;
  _qteScanAlpha   = 0;
  _qteVoidAlpha   = 0;
  _qteCloneAlpha  = 0;
  _qteShakeExtra  = 0;

  // If failure outro just ended, either retry or end with heavy penalty
  if (!success) {
    const def = QTE_STATE.def;
    const p1  = QTE_STATE.playerRef;

    // Check attempt limit — if reached, deal the penalty and exit for real
    if (def.maxAttempts && QTE_STATE.totalAttempts >= def.maxAttempts) {
      if (p1 && p1.health > 0) {
        const penaltyDmg = Math.round(p1.maxHealth * (def.penaltyDamage || 0.40));
        // Phase 4: outright kill (the boss wins this exchange)
        if (def.id === 4) {
          p1.health = 0;
        } else {
          p1.health = Math.max(1, p1.health - penaltyDmg);
        }
        if (typeof spawnParticles === 'function') spawnParticles(p1.cx(), p1.cy(), '#ff0000', 30);
        screenShake = Math.max(screenShake || 0, 30);
        _qteFlashColor = '#ff0000';
        _qteFlashAlpha = 0.85;
      }
      if (typeof showBossDialogue === 'function') {
        const endLines = [
          '"That\'s all you had."',
          '"Every version of you failed."',
          '"Existence disagreed with you."',
          '"You ran out of timelines."',
        ];
        showBossDialogue(endLines[(def.id - 1) % endLines.length], 200);
      }
      QTE_STATE = null;
      return;
    }

    // Attempts remain — rebuild and retry with escalated chaos
    QTE_STATE.stage        = 'prompts';
    QTE_STATE.outroTimer   = 0;
    QTE_STATE.failedThisRound = false;
    const count = def.promptCount[0] + Math.floor(Math.random() * (def.promptCount[1] - def.promptCount[0] + 1));
    QTE_STATE.promptQueue  = _buildPromptQueue(count, def);
    QTE_STATE.promptIdx    = 0;
    QTE_STATE.prompts      = [];
    slowMotion = 0.0; // re-freeze
    _advancePrompts();
    return;
  }

  // Full success — clear
  QTE_STATE = null;
}

// ── Visual helpers ────────────────────────────────────────────────────────────

function _tickQTEVisuals() {
  _qteFlashAlpha = Math.max(0, _qteFlashAlpha - 0.015);

  // Apply extra shake to game
  if (_qteShakeExtra > 0.5 && typeof screenShake !== 'undefined') {
    screenShake = Math.max(screenShake, _qteShakeExtra * (0.6 + Math.sin(_qteTimeline * 0.3) * 0.4));
    _qteShakeExtra *= 0.96;
  }

  if (_qteComboText) {
    _qteComboText.timer--;
    if (_qteComboText.timer <= 0) _qteComboText = null;
  }
}

function _tickQTEParticles() {
  for (let i = _qteParticles.length - 1; i >= 0; i--) {
    const p = _qteParticles[i];
    p.x    += p.vx;
    p.y    += p.vy;
    p.vy   += p.gravity || 0;
    p.alpha = Math.max(0, p.alpha - p.decay);
    p.r    *= 0.97;
    if (p.alpha <= 0 || p.r < 0.3) { _qteParticles.splice(i, 1); }
  }
}

function _tickQTERipples() {
  for (let i = _qteRipples.length - 1; i >= 0; i--) {
    const r = _qteRipples[i];
    r.r     += r.speed || 4;
    r.alpha  = Math.max(0, r.alpha - 0.028);
    if (r.alpha <= 0) { _qteRipples.splice(i, 1); }
  }
}

function _spawnQTEBurst(cx, cy, count, color) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const spd   = 1.5 + Math.random() * 5;
    _qteParticles.push({
      x: cx, y: cy,
      vx: Math.cos(angle) * spd,
      vy: Math.sin(angle) * spd,
      r: 3 + Math.random() * 5,
      color,
      alpha: 0.9 + Math.random() * 0.1,
      decay: 0.018 + Math.random() * 0.015,
      gravity: 0.05,
    });
  }
}

function _spawnTimelinePulse(cx, cy, phaseId) {
  // A "timeline thread" — a line of particles shooting upward
  const color = _phaseColor(phaseId);
  for (let i = 0; i < 8; i++) {
    _qteParticles.push({
      x: cx + (Math.random() - 0.5) * 20,
      y: cy,
      vx: (Math.random() - 0.5) * 2,
      vy: -(2 + Math.random() * 4),
      r: 2 + Math.random() * 3,
      color,
      alpha: 1.0,
      decay: 0.022,
      gravity: -0.02,
    });
  }
}

function _spawnQTERipple(cx, cy, color) {
  _qteRipples.push({ x: cx, y: cy, r: 8, alpha: 0.85, color, speed: 3 + Math.random() * 2 });
  _qteRipples.push({ x: cx, y: cy, r: 4, alpha: 0.65, color, speed: 5 + Math.random() * 3 });
}

// ── Warp grid builder ─────────────────────────────────────────────────────────
function _buildWarpGrid(cols, rows) {
  const nodes = [];
  const cw = canvas.width  || 900;
  const ch = canvas.height || 520;
  for (let row = 0; row <= rows; row++) {
    for (let col = 0; col <= cols; col++) {
      const bx = (col / cols) * cw;
      const by = (row / rows) * ch;
      nodes.push({ bx, by, x: bx, y: by, wobble: 0, phase: Math.random() * Math.PI * 2 });
    }
  }
  return nodes;
}

// ── Phase colour ─────────────────────────────────────────────────────────────
function _phaseColor(phaseId) {
  return ['#ffffff', '#44aaff', '#aa44ff', '#ff4400', '#ff00ff'][phaseId] || '#ffffff';
}

