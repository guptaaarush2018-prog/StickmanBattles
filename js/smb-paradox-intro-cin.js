'use strict';
// smb-paradox-intro-cin.js — _makeTFIntroCinematic — TF intro (fight start, fully scripted)
// Depends on: smb-globals.js, smb-paradox-class.js (and preceding splits in chain)

// ============================================================
// TRUEFORM INTRO CINEMATIC  (fires at fight start, fully scripted)
//
// Sequence:
//   0.0 s  Freeze — TF centered, Paradox + player repositioned left
//   0.3 s  "So… you brought backup."
//   0.7-2.4 s  6 scripted hits — TF HP falls from 10 000 → 9 000
//   2.6 s  "Enough." — momentum halted, slowdown
//   3.1 s  "You cannot win." — TF begins gliding toward Paradox (visible)
//   4.9 s  GRAB complete → Paradox pinned
//   4.9 s  NECK SNAP — white flash, ~10-frame near-freeze
//   5.4 s  PORTAL OPEN — shockwave burst right side
//   6.1 s  THROW — Paradox launched at portal with velocity
//   7.2 s  PORTAL CLOSE — Paradox fades out
//   8.3 s  "Now… face me alone." — fight begins
// ============================================================
function _makeTFIntroCinematic(tf) {
  const PORTAL_X  = GAME_W - 140;
  const PORTAL_Y  = GAME_H - 100;
  const FLOOR_Y   = GAME_H - 72;

  // ── Scripted hit timings (seconds) ────────────────────────────────
  // Paradox hits TF  (6 hits, frames ~42–144)
  const PARADOX_HITS = [0.7, 1.05, 1.4, 1.75, 2.05, 2.4];
  // Player hits TF   (5 hits, interleaved, frames ~54–150)
  const P1_HITS      = [0.9, 1.2,  1.6, 1.95, 2.3 ];

  // Per-hit damage amounts — deterministic, total well above 1000 so the
  // hard-set at frame 300 is the only source of truth for final HP.
  const PARADOX_HIT_DMG = [120, 130, 125, 140, 115, 135]; // sum = 765
  const P1_HIT_DMG      = [ 80,  90,  85,  95,  75];      // sum = 425
  // Combined ≥1000, but tf.health is clamped to ≥9000 per hit AND
  // hard-forced to exactly 9000 at t=5.0 s (frame 300).

  return {
    durationFrames: 500,   // ~8.3 s at 60 fps
    _phaseLabel: { text: '— THE VOID AWAKENS —', color: '#00ffff' },

    // ── State flags ──────────────────────────────────────────────────
    _setupDone:          false,
    _introDialogueFired: false,
    _paradoxHitIdx:      0,
    _p1HitIdx:           0,
    _hp9kForced:         false,   // hard HP lock at frame 300
    _turnFired:          false,
    _grabMoving:         false,
    _grabDone:           false,
    _snapFired:          false,
    _portalFired:        false,
    _portalPulse:        0,
    _throwFired:         false,
    _throwVx:            0,
    _throwVy:            0,
    _closeFired:         false,
    // Animation state — manually driven since gameFrozen skips Fighter.update()
    _heroAtkTimer:       0,  // counts down: >0 → hero shows attack pose
    _tfHurtTimer:        0,  // counts down: >0 → TF shows hurt pose / flinch

    // Cached hero ref (set in _setupDone block)
    _hero: null,
    // Target X for hero approach (set in _setupDone block)
    _heroTargetX: 0,

    update(t) {
      // ── Slow-motion curve ─────────────────────────────────────────
      if      (t < 0.3)  slowMotion = Math.max(0.3,  1.0 - t * 2.33);
      else if (t < 2.5)  slowMotion = 0.30;
      else if (t < 2.85) slowMotion = Math.max(0.08, 0.30 - (t - 2.5) * 0.63);
      else if (t < 4.85) slowMotion = 0.08;
      else if (t < 5.0)  slowMotion = 0.01;  // near-freeze before snap
      else if (t < 6.2)  slowMotion = 0.10;
      else               slowMotion = Math.min(1.0, 0.10 + (t - 6.2) * 0.35);

      // ── Camera ───────────────────────────────────────────────────
      cinematicCamOverride = true;
      if (t < 2.5) {
        cinematicZoomTarget = 0.82;
        cinematicFocusX     = GAME_W / 2;
        cinematicFocusY     = GAME_H / 2 - 10;
      } else if (t < 5.5 && tf) {
        cinematicZoomTarget = Math.min(1.55, 0.82 + (t - 2.5) * 0.244);
        cinematicFocusX     = tf.cx ? tf.cx() : GAME_W / 2;
        cinematicFocusY     = (tf.cy ? tf.cy() : GAME_H / 2) - 20;
      } else {
        cinematicZoomTarget = 1.1;
        cinematicFocusX     = PORTAL_X - 60;
        cinematicFocusY     = PORTAL_Y - 20;
      }

      // ── MANUAL ANIMATION STATE (gameFrozen skips Fighter.update()) ──
      // Hero walk / attack pose driven entirely by cinematic state.
      {
        const hero = this._hero;
        if (this._heroAtkTimer > 0) {
          this._heroAtkTimer--;
          if (hero) {
            hero.attackDuration = Math.max(hero.attackDuration || 0, 22);
            hero.attackTimer    = Math.max(1, this._heroAtkTimer);
            hero.state          = 'attacking';
          }
        } else if (this._setupDone && t < 2.5 && hero && hero.x < this._heroTargetX) {
          if (hero) hero.state = 'walking';
        } else if (hero && hero.state !== 'idle' && this._heroAtkTimer <= 0 && t < 2.6) {
          if (hero) hero.state = 'idle';
        }

        // TF hurt flinch — manually decrement since update() is frozen
        if (this._tfHurtTimer > 0) {
          this._tfHurtTimer--;
          if (tf) { tf.hurtTimer = this._tfHurtTimer; tf.state = 'hurt'; }
        }
      }

      // ── CONTINUOUS HP FLOOR CLAMP ────────────────────────────────
      // Prevents any stray damage (class effects, particles, etc.) from
      // pushing TF below 9000 before the deterministic force at frame 300.
      if (tf && !this._hp9kForced && tf.health < 9000) tf.health = 9000;

      // ── STEP 0: Position entities ─────────────────────────────────
      if (!this._setupDone && t >= 0.05) {
        this._setupDone = true;

        // True Form: centered, full HP, abilities hard-blocked
        if (tf) {
          tf.x               = GAME_W / 2 - tf.w / 2;
          tf.y               = FLOOR_Y - tf.h;
          tf.vx              = 0; tf.vy = 0;
          tf.health          = tf.maxHealth; // 10 000
          tf.facing          = -1;           // face left toward attackers
          // Block ALL special abilities for the duration of this cinematic.
          // gameFrozen=true (set by startCinematic) already prevents updateAI,
          // but postSpecialPause guards against any ability that checks it.
          tf.postSpecialPause = 9999;
        }

        // Spawn Paradox left side (between player and TF)
        if (!paradoxEntity) spawnParadox(210, FLOOR_Y - 50);
        if (paradoxEntity) { paradoxEntity.facing = 1; paradoxEntity.vy = 0; }

        // Reposition player: left edge, zero velocity, input already locked
        // by gameFrozen=true — no additional input disable needed.
        const hero = players ? players.find(p => !p.isBoss) : null;
        this._hero = hero || null;
        if (hero) {
          hero.x  = 80 - hero.w / 2;
          hero.y  = FLOOR_Y - hero.h;
          hero.vx = 0; hero.vy = 0;
          // Approach target: stop ~90 px left of TF center
          this._heroTargetX = (GAME_W / 2) - 90 - hero.w / 2;
        }

        screenShake = Math.max(screenShake, 12);
        if (typeof CinFX !== 'undefined') CinFX.flash('#ffffff', 0.20, 18);
      }

      // ── STEP 1: Intro dialogue ────────────────────────────────────
      if (t >= 0.3 && !this._introDialogueFired) {
        this._introDialogueFired = true;
        if (typeof showBossDialogue === 'function')
          showBossDialogue('So\u2026 you brought backup.', 270);
      }

      // ── STEP 1a: Player & Paradox approach TF (frames 0–120 / t 0–2 s) ─
      // Both fighters walk toward TF during the positioning window.
      if (this._setupDone && t < 2.0) {
        const hero = this._hero;
        if (hero && hero.x < this._heroTargetX) {
          hero.x      += 1.6;
          hero.facing  = 1; // face right (toward TF)
        }
        // Paradox also closes distance
        if (paradoxEntity && tf) {
          const pdx = tf.cx() - paradoxEntity.cx();
          if (Math.abs(pdx) > 70) {
            paradoxEntity.x     += Math.sign(pdx) * 1.4;
            paradoxEntity.facing = Math.sign(pdx);
          }
        }
      }

      // ── STEP 2: Paradox scripted hits (frames ~42–144) ───────────
      if (this._paradoxHitIdx < PARADOX_HITS.length &&
          t >= PARADOX_HITS[this._paradoxHitIdx]) {
        const idx = this._paradoxHitIdx++;
        if (paradoxEntity) paradoxEntity.punch(1);
        const drop = PARADOX_HIT_DMG[idx];
        if (tf) tf.health = Math.max(9000, tf.health - drop);
        const px = tf ? tf.cx() : GAME_W / 2;
        const py = tf ? tf.cy() : GAME_H / 2;
        spawnParticles(px, py, '#00ffff', 7);
        spawnParticles(px, py, '#ffffff', 4);
        screenShake = Math.max(screenShake, 7);
        if (settings.dmgNumbers && typeof DamageText !== 'undefined') {
          damageTexts.push(new DamageText(String(drop),
            px + (Math.random() - 0.5) * 28, py - 22, '#00ffff'));
        }
        // TF flinch: brief hurt pose + slight knockback away from Paradox
        if (tf) {
          this._tfHurtTimer = 14;
          tf.hurtTimer = 14;
          tf.state     = 'hurt';
          if (paradoxEntity) tf.x += Math.sign(tf.cx() - paradoxEntity.cx()) * 5;
        }
      }

      // ── STEP 3: Player (hero) scripted hits (frames ~54–150) ─────
      // Player is AI-controlled for this cinematic (gameFrozen disables input).
      // We script their position + impact visuals to show them actively fighting.
      if (this._p1HitIdx < P1_HITS.length &&
          t >= P1_HITS[this._p1HitIdx]) {
        const idx  = this._p1HitIdx++;
        const hero = this._hero;
        const drop = P1_HIT_DMG[idx];

        // Snap hero adjacent to TF for the impact frame, show attack pose
        if (hero && tf) {
          hero.x            = tf.x - hero.w - 4;
          hero.y            = FLOOR_Y - hero.h;
          hero.facing       = 1;
          hero.attackDuration = Math.max(hero.attackDuration || 0, 22);
          hero.attackTimer  = 22;
          hero.state        = 'attacking';
          this._heroAtkTimer = 22;
        }

        if (tf) tf.health = Math.max(9000, tf.health - drop);
        const px = tf ? tf.cx() : GAME_W / 2;
        const py = tf ? tf.cy() : GAME_H / 2;

        // Hero-colored impact particles (white + yellow)
        spawnParticles(px, py, '#ffffff', 6);
        spawnParticles(px, py, '#ffe066', 4);
        if (hero) spawnParticles(hero.cx ? hero.cx() : hero.x, hero.y, '#ffe066', 3);

        screenShake = Math.max(screenShake, 9);
        if (settings.dmgNumbers && typeof DamageText !== 'undefined') {
          damageTexts.push(new DamageText(String(drop),
            px + (Math.random() - 0.5) * 24, py - 34, '#ffe066'));
        }

        // TF flinch on player hit: stronger knockback than Paradox hits
        if (tf) {
          this._tfHurtTimer = Math.max(this._tfHurtTimer, 18);
          tf.hurtTimer = 18;
          tf.state     = 'hurt';
          if (hero) tf.x += Math.sign(tf.cx() - hero.cx()) * 8;
        }

        // Pull hero back slightly after impact (recoil)
        if (hero) { hero.x -= 12; hero.vx = 0; hero.vy = 0; }
      }

      // ── STEP 4: HARD HP FORCE at t = 5.0 s (frame 300) ──────────
      // This is the single source of truth for the final opening HP value.
      // Regardless of accumulated hit damage, TF is ALWAYS at exactly 9000
      // when the execution cinematic begins.
      if (!this._hp9kForced && t >= 5.0) {
        this._hp9kForced = true;
        if (tf) {
          tf.health           = 9000; // hard set — no Math.max, no Math.min
          tf.maxHealth        = Math.max(tf.maxHealth, 9000);
          tf.postSpecialPause = 0;   // will be re-applied in onEnd guard
        }
      }

      // ── STEP 5: Turning point — TF disengages from player ────────
      if (t >= 2.6 && !this._turnFired) {
        this._turnFired = true;
        if (paradoxEntity) paradoxEntity.vy = 0;
        const hero = this._hero;
        if (hero) {
          hero.vx = 0; hero.vy = 0;
          hero.state = 'idle';
          hero.attackTimer = 0;
          this._heroAtkTimer = 0;
        }
        // Clear TF hurt state so it stands upright before grab
        this._tfHurtTimer = 0;
        if (tf) { tf.hurtTimer = 0; tf.state = 'idle'; }
        if (typeof showBossDialogue === 'function') showBossDialogue('Enough.', 200);
        if (tf) spawnParticles(tf.cx(), tf.cy() - 10, '#ffffff', 22);
        if (typeof CinFX !== 'undefined') {
          CinFX.shake(24);
          CinFX.flash('#ffffff', 0.30, 12);
        }
      }

      // ── STEP 6: GRAB — TF glides visibly toward Paradox ──────────
      if (t >= 3.15 && !this._grabMoving) {
        this._grabMoving = true;
        if (typeof showBossDialogue === 'function')
          showBossDialogue('You cannot win.', 270);
      }

      if (this._grabMoving && !this._grabDone && tf && paradoxEntity) {
        const dx = paradoxEntity.cx() - tf.cx();
        if (Math.abs(dx) > 6) {
          tf.x     += Math.sign(dx) * 2.5;
          tf.facing = Math.sign(dx);
        } else {
          this._grabDone   = true;
          tf.x             = paradoxEntity.cx() - tf.w / 2 - 3;
          tf.facing        = 1;
          paradoxEntity.facing = -1;
          paradoxEntity.vy     = -1;
          spawnParticles(tf.cx(), tf.cy(), '#ffffff', 16);
          spawnParticles(paradoxEntity.cx(), paradoxEntity.cy(), '#00ffff', 12);
          if (typeof CinFX !== 'undefined') CinFX.shake(16);
        }
      }

      // Keep Paradox pinned while grabbed (before snap)
      if (this._grabDone && paradoxEntity && !this._snapFired) {
        paradoxEntity.vx = 0;
        paradoxEntity.vy = 0;
        if (tf) {
          paradoxEntity.x = tf.cx() - paradoxEntity.w / 2 + tf.facing * 2;
          paradoxEntity.y = tf.y - 4;
        }
      }

      // Fallback: force grab complete if movement overruns timing
      if (!this._grabDone && t >= 5.2 && paradoxEntity && tf) {
        this._grabDone       = true;
        tf.x                 = paradoxEntity.cx() - tf.w / 2 - 3;
        tf.facing            = 1;
        paradoxEntity.facing = -1;
      }

      // ── STEP 7: NECK SNAP ─────────────────────────────────────────
      if (this._grabDone && t >= 4.9 && !this._snapFired) {
        this._snapFired = true;

        if (paradoxEntity && settings.particles) {
          for (let i = 0; i < 55 && particles.length < MAX_PARTICLES; i++) {
            const angle = Math.random() * Math.PI * 2;
            const spd   = 7 + Math.random() * 15;
            const _p    = _getParticle();
            _p.x     = paradoxEntity.cx();
            _p.y     = paradoxEntity.cy();
            _p.vx    = Math.cos(angle) * spd;
            _p.vy    = Math.sin(angle) * spd;
            _p.color = Math.random() < 0.55 ? '#00ffff' : '#ffffff';
            _p.size  = 2 + Math.random() * 5;
            _p.life  = 35 + Math.random() * 30;
            _p.maxLife = 65;
            particles.push(_p);
          }
        }
        if (typeof CinFX !== 'undefined') {
          CinFX.flash('#ffffff', 0.92, 10);
          CinFX.shake(42);
        }
        if (typeof showBossDialogue === 'function')
          showBossDialogue('This timeline ends here.', 290);
      }

      // ── STEP 8: PORTAL OPEN ───────────────────────────────────────
      if (t >= 5.4 && !this._portalFired) {
        this._portalFired = true;
        if (typeof CinFX !== 'undefined') {
          CinFX.shockwave(PORTAL_X, PORTAL_Y, '#00ffff', { count: 5, maxR: 200, lw: 5, dur: 100 });
          CinFX.shockwave(PORTAL_X, PORTAL_Y, '#aa44ff', { count: 2, maxR: 90,  lw: 9, dur: 65  });
          CinFX.flash('#00ffff', 0.38, 16);
          CinFX.shake(18);
        }
        spawnParticles(PORTAL_X, PORTAL_Y, '#00ffff', 30);
        spawnParticles(PORTAL_X, PORTAL_Y, '#aa44ff', 20);
        if (typeof showBossDialogue === 'function')
          showBossDialogue('Back to the void.', 230);
      }

      // Portal pulse — inward particle swirl
      if (this._portalFired && !this._closeFired) {
        this._portalPulse++;
        if (this._portalPulse % 7 === 0 && settings.particles && particles.length < MAX_PARTICLES) {
          for (let i = 0; i < 5; i++) {
            const ang = Math.random() * Math.PI * 2;
            const r   = 35 + Math.random() * 40;
            const _p  = _getParticle();
            _p.x    = PORTAL_X + Math.cos(ang) * r;
            _p.y    = PORTAL_Y + Math.sin(ang) * r;
            _p.vx   = -Math.cos(ang) * (1.2 + Math.random() * 2.2);
            _p.vy   = -Math.sin(ang) * (1.2 + Math.random() * 2.2);
            _p.color = Math.random() < 0.6 ? '#00ffff' : '#aa44ff';
            _p.size  = 1.5 + Math.random() * 2.5;
            _p.life  = 18 + Math.random() * 14;
            _p.maxLife = 32;
            particles.push(_p);
          }
        }
      }

      // ── STEP 9: THROW ─────────────────────────────────────────────
      if (t >= 6.1 && !this._throwFired) {
        this._throwFired = true;
        if (paradoxEntity && tf) {
          const dx   = PORTAL_X - paradoxEntity.cx();
          const dy   = PORTAL_Y - paradoxEntity.cy();
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          this._throwVx = (dx / dist) * 22;
          this._throwVy = (dy / dist) * 22 - 5;
          paradoxEntity._glitchX = 10;
        }
        if (typeof CinFX !== 'undefined') {
          CinFX.shake(28);
          CinFX.flash('#ffffff', 0.55, 12);
        }
        if (paradoxEntity)
          spawnParticles(paradoxEntity.cx(), paradoxEntity.cy(), '#ffffff', 28);
      }

      if (this._throwFired && !this._closeFired && paradoxEntity) {
        paradoxEntity.x += this._throwVx;
        paradoxEntity.y += this._throwVy;
        this._throwVy   += 0.3;
      }

      // ── STEP 10: PORTAL CLOSE ────────────────────────────────────
      if (t >= 7.2 && !this._closeFired) {
        this._closeFired = true;
        if (paradoxEntity) paradoxEntity.done = true;
        if (typeof CinFX !== 'undefined') {
          CinFX.flash('#00ffff', 0.60, 20);
          CinFX.shake(18);
        }
        spawnParticles(PORTAL_X, PORTAL_Y, '#00ffff', 38);
        spawnParticles(PORTAL_X, PORTAL_Y, '#ffffff', 20);
      }

      // Keep Paradox entity ticking (fade, glitch, alpha decay)
      if (paradoxEntity) paradoxEntity.update();
    },

    onEnd() {
      slowMotion           = 1.0;
      cinematicCamOverride = false;
      paradoxEntity        = null;

      // Guarantee TF is at exactly 9000 HP when fight resumes.
      // (Safety net in case the cinematic was skipped or cut short.)
      if (tf) {
        tf.health           = 9000;
        tf.maxHealth        = Math.max(tf.maxHealth, 9000);
        // Re-enable TF abilities for the main fight (postSpecialPause was
        // set to 9999 in setup; give a small grace window before first attack).
        tf.postSpecialPause = 4; // ~60 frames before first special
      }

      // Reposition hero to a safe spawn so they aren't clipping TF
      const hero = players ? players.find(p => !p.isBoss) : null;
      if (hero && tf) {
        hero.x   = Math.max(40, tf.x - 140);
        hero.y   = GAME_H - 72 - hero.h;
        hero.vx  = 0;
        hero.vy  = 0;
      }

      // Opening taunt — fight begins
      if (typeof showBossDialogue === 'function')
        showBossDialogue('Now\u2026 face me alone.', 300);
    }
  };
}

