'use strict';
// smb-boss-tf-attacks2.js — updateTFPendingAttacks, drawBossWarnings, resetBossWarnings
// Depends on: smb-globals.js, smb-boss-tf-attacks1.js
// Must load AFTER smb-boss-tf-attacks1.js, BEFORE smb-boss-tf-visuals1.js

function updateTFPendingAttacks() {
  if (!gameRunning) return;
  const tf = players.find(p => p.isTrueForm);

  for (let i = tfAttackRetryQueue.length - 1; i >= 0; i--) {
    const job = tfAttackRetryQueue[i];
    job.framesLeft--;
    if (job.framesLeft > 0) continue;
    const target = job.targetRef && job.targetRef.health > 0 ? job.targetRef : players.find(p => !p.isBoss && p.health > 0);
    const ok = job.ctx && typeof job.ctx._doSpecial === 'function' ? job.ctx._doSpecial(job.move, target) : false;
    if (ok || job.attempts >= 4) {
      if (!ok) console.warn(`[TrueFormAttack:${job.source}] retry failed for "${job.move}"`);
      tfAttackRetryQueue.splice(i, 1);
    } else {
      job.attempts++;
      job.framesLeft = 12;
    }
  }

  if (!tf || tf.health <= 0) return;
  if (tf._wallComboTimer > 0) tf._wallComboTimer--;
  if (tf._antiRangedCooldown > 0) tf._antiRangedCooldown--;
  if (tf._antiRangedDashCd > 0) tf._antiRangedDashCd--;
  if (tf._antiRangedPulse > 0) tf._antiRangedPulse--;
  if (tf._antiRangedTimer > 0) {
    tf._antiRangedTimer--;
    const pullRadius = tf._antiRangedFieldR + 55;
    for (const p of players) {
      if (p.isBoss || p.health <= 0) continue;
      const dx = tf.cx() - p.cx();
      const dy = tf.cy() - p.cy();
      const dd = Math.hypot(dx, dy) || 1;
      if (dd < pullRadius) {
        const movingAway = Math.sign(p.vx || 0) === -Math.sign(dx) && Math.abs(p.vx || 0) > 1.1;
        const pull = (movingAway ? 1.10 : 0.62) * (1 - dd / pullRadius);
        p.vx += (dx / dd) * pull;
        p.vy += (dy / dd) * pull * 0.22;
      }
    }
    if (tf._antiRangedTimer <= 0) {
      tf._antiRangedStats.projectiles = 0;
      tf._antiRangedStats.rangedDamage = 0;
      tf._antiRangedStats.farTicks = 0;
    }
  }
  if (tf._tfAttackState && tf._tfAttackState.timer > 0) {
    tf._tfAttackState.timer--;
    if (tf._tfAttackState.timer <= 0) {
      if (tf._tfAttackState.phase === 'recovery') {
        tf._finishAttackState();
      } else if (tf._tfAttackState.phase === 'start' && tf._tfAttackState.locked) {
        // Telegraph window expired — release the lock so follow-up moves can fire
        tf._tfAttackState.locked = false;
      }
    }
  }

  // ── Tick bossWarnings (so telegraph circles disappear) ────
  for (let i = bossWarnings.length - 1; i >= 0; i--) {
    bossWarnings[i].timer--;
    if (bossWarnings[i].timer <= 0) bossWarnings.splice(i, 1);
  }

  // ── Stagger ────────────────────────────────────────────────
  const dmgThisFrame = (tf._prevHealth || tf.health) - tf.health;
  if (dmgThisFrame > 0) {
    bossStaggerDmg   += dmgThisFrame;
    bossStaggerDecay  = 180;
  }
  tf._prevHealth = tf.health;
  if (bossStaggerDecay > 0) {
    bossStaggerDecay--;
    if (bossStaggerDecay <= 0) bossStaggerDmg = 0;
  }
  if (bossStaggerDmg >= 150 && bossStaggerTimer <= 0) {
    bossStaggerTimer = 150;
    bossStaggerDmg   = 0;
    bossStaggerDecay = 0;
    screenShake = Math.max(screenShake, 25);
    showBossDialogue(randChoice(['...noted.', 'You hit like you mean it.', 'That was unexpected. I respect it.']), 120);
    spawnParticles(tf.cx(), tf.cy(), '#ffffff', 22);
    if (typeof directorAddIntensity === 'function') directorAddIntensity(0.4);
  }
  if (bossStaggerTimer > 0) {
    bossStaggerTimer--;
    tf.vx *= 0.85;
    if (bossStaggerTimer === 0) {
      showBossDialogue(randChoice(['That was the last one you get free.', 'I don\'t fall.', 'We\'re past the warm-up.']), 120);
    }
  }

  // ── Desperation mode ──────────────────────────────────────
  if (!bossDesperationMode && tf.health / tf.maxHealth < 0.25) {
    bossDesperationMode  = true;
    bossDesperationFlash = 90;
    screenShake = Math.max(screenShake, 30);
    showBossDialogue('You\'ve earned the last of me. I hope it was worth asking for.', 300);
    spawnParticles(tf.cx(), tf.cy(), '#ffffff', 50);
    spawnParticles(tf.cx(), tf.cy(), '#000000', 30);
    if (typeof directorAddIntensity === 'function') directorAddIntensity(0.8);
  }

  // ── Pending Reality Slash ─────────────────────────────────
  if (tf._pendingSlash) {
    tf._pendingSlash.timer--;
    if (tf._pendingSlash.timer <= 0) {
      const tgt = tf._pendingSlash.target;
      const behindOff = tf._pendingSlash.behindOff;
      const landed = _bossTeleportActor(tf, tgt.cx() + behindOff, tgt.y, { preferRaised: true, sideBias: Math.sign(behindOff) || 1 });
      if (!landed) {
        tf._pendingSlash = null;
        tf._finishAttackState('slash');
        return;
      }
      tf.facing = (tgt.cx() > tf.cx() ? 1 : -1);
      tf._setAttackPhase('active', 4, true);
      spawnParticles(tf.cx(), tf.cy(), '#ffffff', 20);
      spawnParticles(tf.cx(), tf.cy(), '#000000', 12);
      screenShake = Math.max(screenShake, 12);
      dealDamage(tf, tgt, 18, 10);
      for (const p of players) {
        if (p.isBoss || p.health <= 0) continue;
        const sdx = p.cx() - tf.cx();
        if (Math.abs(sdx) < 220) {
          p.vx += (sdx > 0 ? 1 : -1) * 9;
          if (p !== tgt) dealDamage(tf, p, 6, 5);
        }
      }
      tf._pendingSlash = null;
      tf._setAttackPhase('recovery', 20, false);
    }
  }

  // ── Pending Teleport Combo ─────────────────────────────────
  if (tf._pendingTeleportCombo) {
    const tc = tf._pendingTeleportCombo;
    tc.timer--;
    if (tc.timer <= 0 && tc.hits > 0) {
      const tgt = tc.target;
      if (tgt && tgt.health > 0) {
        // Teleport to alternating sides of the player
        const side   = tc.hits % 2 === 0 ? 1 : -1;
        const offset = side * (45 + Math.random() * 25);
        const landed = _bossTeleportActor(tf, tgt.cx() + offset, tgt.y, { preferRaised: true, sideBias: side });
        if (!landed) {
          tc.hits = 0;
          tf._pendingTeleportCombo = null;
          tf._finishAttackState('teleportCombo');
          return;
        }
        tf.facing = tgt.cx() > tf.cx() ? 1 : -1;
        tf._setAttackPhase('active', 4, true);
        // Portal burst at new position
        spawnParticles(tf.cx(), tf.cy(), '#000000', 18);
        spawnParticles(tf.cx(), tf.cy(), '#ffffff', 10);
        screenShake = Math.max(screenShake, 14);
        // Deal damage
        dealDamage(tf, tgt, 14, 8);
        // Brief invincibility so we don't get counter-hit during combo
        tf.invincible = Math.max(tf.invincible, 12);
      }
      tc.hits--;
      if (tc.hits > 0) {
        tc.timer = tc.gap;
      } else {
        tf._pendingTeleportCombo = null;
        tf._setAttackPhase('recovery', 14, false);
        // Final shockwave at landing position
        if (typeof tfShockwaves !== 'undefined') {
          tfShockwaves.push({
            x: tf.cx(), y: tf.y + tf.h,
            r: 8, maxR: 200,
            timer: 30, maxTimer: 30,
            boss: tf, hit: new Set(),
          });
        }
        screenShake = Math.max(screenShake, 22);
      }
    }
  }

  // ── Pending Gravity Crush ──────────────────────────────────
  if (tf._pendingGravityCrush) {
    const gc = tf._pendingGravityCrush;
    gc.timer--;
    // During pull phase, drag all players toward arena center each frame
    const pullStrength = 0.55 * (1 - gc.timer / 60); // increases as timer counts down
    for (const p of players) {
      if (p.isBoss || p.health <= 0) continue;
      const pdx = GAME_W / 2 - p.cx();
      const pdy = GAME_H / 2 - p.cy();
      p.vx += Math.sign(pdx) * pullStrength * Math.min(1, Math.abs(pdx) / 200);
      p.vy += Math.sign(pdy) * pullStrength * 0.5;
    }
    if (gc.timer <= 0) {
      // DETONATE — massive outward blast
      spawnParticles(GAME_W / 2, GAME_H / 2, '#8800ff', 55);
      spawnParticles(GAME_W / 2, GAME_H / 2, '#ffffff', 35);
      spawnParticles(GAME_W / 2, GAME_H / 2, '#ff00aa', 20);
      screenShake = Math.max(screenShake, 40);
      if (typeof cinScreenFlash !== 'undefined') {
        cinScreenFlash = { color: '#8800ff', alpha: 0.45, timer: 12, maxTimer: 12 };
      }
      // Blast rings
      if (typeof phaseTransitionRings !== 'undefined') {
        for (let ri = 0; ri < 5; ri++) {
          phaseTransitionRings.push({
            cx: GAME_W / 2, cy: GAME_H / 2,
            r: 10 + ri * 18, maxR: 380 + ri * 55,
            timer: 50 + ri * 10, maxTimer: 50 + ri * 10,
            color: ri % 2 === 0 ? '#8800ff' : '#ffffff',
            lineWidth: Math.max(0.8, 4 - ri * 0.5),
          });
        }
      }
      // Knockback and damage all nearby players
      for (const p of players) {
        if (p.isBoss || p.health <= 0) continue;
        const pdx2 = p.cx() - GAME_W / 2;
        const pdy2 = p.cy() - GAME_H / 2;
        const dist2 = Math.hypot(pdx2, pdy2) || 1;
        p.vx += (pdx2 / dist2) * 28;
        p.vy += (pdy2 / dist2) * 18 - 8;
        dealDamage(tf, p, 22, 16);
      }
      tf._pendingGravityCrush = null;
    }
  }

  // ── Pending Collapse Strike ────────────────────────────────
  if (tf._pendingCollapseStrike) {
    tf._pendingCollapseStrike.timer--;
    if (tf._pendingCollapseStrike.timer <= 0) {
      const csTgt = tf._pendingCollapseStrike.target;
      // Teleport boss behind target
      if (csTgt && csTgt.health > 0) {
        const csDir = (csTgt.facing || 1);
        const landed = _bossTeleportActor(tf, csTgt.cx() - csDir * 55, csTgt.y, { preferRaised: true, sideBias: -csDir });
        if (!landed) {
          tf._pendingCollapseStrike = null;
          tf._finishAttackState('collapseStrike');
          return;
        }
        tf._setAttackPhase('active', 5, true);
        // Restore slowmo
        if (hitSlowTimer <= 0) slowMotion = 1.0;
        screenShake = Math.max(screenShake, 26);
        spawnParticles(tf.cx(), tf.cy(), '#ffffff', 28);
        spawnParticles(tf.cx(), tf.cy(), '#aaddff', 18);
        spawnParticles(tf.cx(), tf.cy(), '#000000', 14);
        // Heavy strike — 55 damage + strong knockback
        const oldDmg = tf.weapon.damage;
        const oldKb  = tf.weapon.kb;
        tf.weapon.damage = 55;
        tf.weapon.kb     = 16;
        if (tf.cooldown <= 0) tf.attack(csTgt);
        tf.weapon.damage = oldDmg;
        tf.weapon.kb     = oldKb;
      }
      tf._pendingCollapseStrike = null;
      tf._setAttackPhase('recovery', 18, false);
    }
  }

  // ── Pending Shockwave (ground) ─────────────────────────────
  if (tf._pendingShockwave) {
    tf._pendingShockwave.timer--;
    if (tf._pendingShockwave.timer <= 0) {
      const bossRef = tf._pendingShockwave.boss || tf;
      screenShake = Math.max(screenShake, 22);
      spawnParticles(bossRef.cx(), bossRef.y + bossRef.h, '#ffffff', 30);
      spawnParticles(bossRef.cx(), bossRef.y + bossRef.h, '#440044', 22);
      spawnParticles(bossRef.cx(), bossRef.y + bossRef.h, '#8800ff', 14);
      for (let ri = 0; ri < 3; ri++) {
        tfShockwaves.push({
          x: bossRef.cx(), y: bossRef.y + bossRef.h,
          r: 12 + ri * 6, maxR: 260 + ri * 70,
          timer: 38 + ri * 9, maxTimer: 38 + ri * 9,
          boss: bossRef, hit: new Set(),
        });
      }
      tf._pendingShockwave = null;
    }
  }
}

