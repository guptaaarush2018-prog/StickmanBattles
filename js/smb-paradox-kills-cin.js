'use strict';
// smb-paradox-kills-cin.js — _makeTFKillsParadoxCinematic — TF executes Paradox
// Depends on: smb-globals.js, smb-paradox-class.js (and preceding splits in chain)

// ============================================================
// _makeTFKillsParadoxCinematic  — TrueForm executes Paradox
// 600 frames / 10 seconds. Fires when opening-fight threshold is reached.
// Sequence: lock → teleport strikes → command terminal → collapse →
//           energy stream → absorption pulse → onEnd → absorption phase
// ============================================================
function _makeTFKillsParadoxCinematic(tf) {
  return {
    durationFrames:   600,
    _paradoxSpawned:  false,
    _lockFired:       false,
    _prevPX:          0,
    _prevPY:          0,
    _strike1Fired:    false,
    _strike2Fired:    false,
    _strike3Fired:    false,
    _termFired:       false,
    _collapseFired:   false,
    _streamFired:     false,
    _absorptionFired: false,
    _phaseLabel: { text: '\u2014 TERMINAL SEQUENCE \u2014', color: '#00ffcc' },

    update(t) {
      // ── slow-motion envelope ──────────────────────────────────
      if      (t < 0.4) slowMotion = Math.max(0.06, 1 - t * 2.4);
      else if (t > 9.3) slowMotion = Math.min(1.0,  (t - 9.3) / 0.7);
      else              slowMotion = 0.06;

      // Manually tick TF attack animation (gameFrozen skips Fighter.update())
      if (tf && tf.attackTimer > 0) {
        tf.attackTimer--;
        tf.state = tf.attackTimer > 0 ? 'attacking' : 'idle';
      }
      if (paradoxEntity) paradoxEntity.update();

      // ── camera ───────────────────────────────────────────────
      cinematicCamOverride = (t < 9.8);
      if (cinematicCamOverride && tf) {
        const tgt = t < 4 ? 1.45 : t < 7 ? 1.55 : 1.3;
        cinematicZoomTarget = Math.min((cinematicZoomTarget || 1) + 0.012, tgt);
        cinematicFocusX     = tf.cx ? tf.cx() : GAME_W / 2;
        cinematicFocusY     = (tf.cy ? tf.cy() : GAME_H / 2) - 15;
      }

      // ── 0.5s: spawn Paradox, init overlay ────────────────────
      if (t >= 0.5 && !this._paradoxSpawned) {
        this._paradoxSpawned = true;
        if (!paradoxEntity) spawnParadox(200, GAME_H - 200);
        if (paradoxEntity) paradoxEntity.facing = 1;
        if (tf && paradoxEntity) tf.facing = Math.sign(paradoxEntity.cx() - tf.cx()) || 1;
        _tfKCOverlay = {
          frame: 0, lockActive: false, lockAlpha: 0,
          distortLines: [], realityTears: [],
          termVisible: false, termSlide: 0, termLines: null,
          termTimer: 0, termProgress: 0, termProgressStart: 0,
          termCursorTimer: 0,
        };
        if (typeof showBossDialogue === 'function')
          showBossDialogue('You cannot run.', 210);
      }

      // ── 0.8s: LOCK — Paradox frozen in place ─────────────────
      if (t >= 0.8 && !this._lockFired) {
        this._lockFired = true;
        if (paradoxEntity) {
          this._prevPX = paradoxEntity.x;
          this._prevPY = paradoxEntity.y;
          paradoxEntity.vx = 0;
          paradoxEntity.vy = 0;
        }
        if (_tfKCOverlay) _tfKCOverlay.lockActive = true;
        if (typeof CinFX !== 'undefined') { CinFX.shake(10); CinFX.flash('#00ffff', 0.26, 12); }
        if (paradoxEntity) spawnParticles(paradoxEntity.cx(), paradoxEntity.cy(), '#00ffff', 18);
      }

      // Pin Paradox while locked (until strike 1)
      if (this._lockFired && !this._strike1Fired && paradoxEntity) {
        paradoxEntity.vx = 0;
        paradoxEntity.vy = 0;
        paradoxEntity.x  = this._prevPX;
        paradoxEntity.y  = this._prevPY;
      }

      // Fade lock-ring alpha in
      if (_tfKCOverlay && _tfKCOverlay.lockActive && (t < 7.3)) {
        _tfKCOverlay.lockAlpha = Math.min(1, (_tfKCOverlay.lockAlpha || 0) + 0.05);
      }

      // ── 1.5s: STRIKE 1 — TF teleports BEHIND Paradox ────────
      if (t >= 1.5 && !this._strike1Fired) {
        this._strike1Fired = true;
        if (tf && paradoxEntity) {
          spawnParticles(tf.cx(), tf.cy(), '#000000', 14);
          spawnParticles(tf.cx(), tf.cy(), '#ffffff',  8);
          tf.x      = paradoxEntity.cx() + 14;
          tf.y      = paradoxEntity.y;
          tf.vy     = 0;
          tf.facing = -1;
          tf.state          = 'attacking';
          tf._attackMode    = 'punch';
          tf.attackTimer    = 18;
          tf.attackDuration = 18;
          paradoxEntity.facing = 1;
          paradoxEntity.vx = 0;
          paradoxEntity.vy = -4;
          spawnParticles(tf.cx(), tf.cy(), '#00ffff', 22);
          spawnParticles(tf.cx(), tf.cy(), '#ffffff', 10);
          this._prevPX = paradoxEntity.cx();
          this._prevPY = paradoxEntity.cy();
        }
        if (typeof CinFX !== 'undefined') { CinFX.shake(22); CinFX.flash('#00ffff', 0.40, 10); }
        // Energy distortion lines
        if (_tfKCOverlay) {
          for (let i = 0; i < 5; i++) {
            _tfKCOverlay.distortLines.push({
              y: 0.15 + Math.random() * 0.70, x1: Math.random() * 0.3, x2: 0.6 + Math.random() * 0.4,
              alpha: 0.6 + Math.random() * 0.3,
              color: Math.random() < 0.5 ? '#00ffcc' : '#ffffff',
              width: 1 + Math.random() * 2,
            });
          }
        }
      }

      // ── 2.3s: STRIKE 2 — TF teleports ABOVE Paradox ─────────
      if (t >= 2.3 && !this._strike2Fired) {
        this._strike2Fired = true;
        if (tf && paradoxEntity) {
          spawnParticles(tf.cx(), tf.cy(), '#000000', 14);
          tf.x      = paradoxEntity.cx() - tf.w / 2;
          tf.y      = paradoxEntity.y - 60;
          tf.vy     = 6;
          tf.facing = 1;
          tf.state          = 'attacking';
          tf._attackMode    = 'kick';
          tf.attackTimer    = 22;
          tf.attackDuration = 22;
          paradoxEntity.vx = (Math.random() - 0.5) * 3;
          paradoxEntity.vy = 5;
          spawnParticles(paradoxEntity.cx(), paradoxEntity.cy(), '#ffffff', 18);
          spawnParticles(paradoxEntity.cx(), paradoxEntity.cy(), '#aa44ff', 10);
          this._prevPX = paradoxEntity.cx();
          this._prevPY = paradoxEntity.cy();
        }
        if (typeof CinFX !== 'undefined') { CinFX.shake(28); CinFX.flash('#ffffff', 0.35, 10); }
        if (typeof showBossDialogue === 'function')
          showBossDialogue('Every timeline checked\u2026 you lose.', 230);
        // Reality tear cracks
        if (_tfKCOverlay) {
          _tfKCOverlay.realityTears.push({ x: 0.35 + Math.random() * 0.30, alpha: 0.80, seed: Math.random() * 10 });
          _tfKCOverlay.realityTears.push({ x: 0.55 + Math.random() * 0.20, alpha: 0.55, seed: Math.random() * 10 });
        }
      }

      // ── 3.0s: STRIKE 3 — Multiversal final blow ──────────────
      if (t >= 3.0 && !this._strike3Fired) {
        this._strike3Fired = true;
        if (tf && paradoxEntity) {
          spawnParticles(tf.cx(), tf.cy(), '#000000', 18);
          tf.x      = paradoxEntity.cx() - tf.w - 6;
          tf.y      = paradoxEntity.y;
          tf.vy     = 0;
          tf.facing = 1;
          tf.state          = 'attacking';
          tf._attackMode    = 'punch';
          tf.attackTimer    = 26;
          tf.attackDuration = 26;
          paradoxEntity.facing = -1;
          paradoxEntity.vx = 0;
          paradoxEntity.vy = -2;
          this._prevPX = paradoxEntity.cx();
          this._prevPY = paradoxEntity.cy();
        }
        if (paradoxEntity && settings.particles) {
          for (let i = 0; i < 55 && particles.length < MAX_PARTICLES; i++) {
            const angle = Math.random() * Math.PI * 2;
            const spd   = 6 + Math.random() * 14;
            const _p    = _getParticle();
            _p.x  = paradoxEntity.cx(); _p.y  = paradoxEntity.cy();
            _p.vx = Math.cos(angle) * spd; _p.vy = Math.sin(angle) * spd;
            _p.color   = ['#00ffff','#ffffff','#ff00ff','#aa44ff'][Math.floor(Math.random() * 4)];
            _p.size    = 2 + Math.random() * 5;
            _p.life    = 35 + Math.random() * 35;
            _p.maxLife = 70;
            particles.push(_p);
          }
        }
        if (typeof CinFX !== 'undefined') { CinFX.shake(45); CinFX.flash('#ffffff', 0.88, 14); }
        if (typeof showBossDialogue === 'function')
          showBossDialogue('This is where it ends.', 240);
        // More distortion + extra tear
        if (_tfKCOverlay) {
          for (let i = 0; i < 8; i++) {
            _tfKCOverlay.distortLines.push({
              y: Math.random(), x1: 0, x2: 1,
              alpha: 0.5 + Math.random() * 0.4,
              color: Math.random() < 0.5 ? '#ff00ff' : '#00ffff',
              width: 1 + Math.random() * 3,
            });
          }
          _tfKCOverlay.realityTears.push({ x: 0.1 + Math.random() * 0.8, alpha: 1.0, seed: Math.random() * 10 });
        }
      }

      // ── 3.8s: command-line terminal panel opens ───────────────
      if (t >= 3.8 && !this._termFired) {
        this._termFired = true;
        if (_tfKCOverlay) {
          _tfKCOverlay.termVisible        = true;
          _tfKCOverlay.termSlide          = 0;
          _tfKCOverlay.termTimer          = 0;
          _tfKCOverlay.termProgress       = 0;
          _tfKCOverlay.termProgressStart  = 145; // progress bar starts ~2.4s after panel opens
          _tfKCOverlay.termLines = [
            { text: '> query --entity PARADOX',                         color: '#00ffcc', delay: 0,   revealCount: 0 },
            { text: '  FOUND: 1 instance  [ID: \u03c8-\u221e]',         color: '#aaffee', delay: 42,  revealCount: 0 },
            { text: '> entity.destroy(--all-timelines --force)',         color: '#00ffcc', delay: 85,  revealCount: 0 },
            { text: '', isProgress: true, delay: 145, revealCount: 1,   color: '#ffff00' },
            { text: '  STATUS: TERMINATED \u2713',                       color: '#ff3344', delay: 230, revealCount: 0 },
          ];
        }
        if (typeof showBossDialogue === 'function')
          showBossDialogue('Every version. Every timeline.', 260);
      }

      // While terminal active: Paradox glitches and tracks center for collapse
      if (this._termFired && !this._collapseFired && paradoxEntity) {
        paradoxEntity.vx = 0;
        paradoxEntity.vy = 0;
        if (paradoxEntity._glitchTick <= 0) {
          paradoxEntity._glitchTick = 2 + Math.floor(Math.random() * 5);
          paradoxEntity._glitchX    = (Math.random() - 0.5) * 28;
        }
        this._prevPX = paradoxEntity.cx();
        this._prevPY = paradoxEntity.cy();
      }

      // ── 7.0s: COLLAPSE — Paradox destroyed ───────────────────
      if (t >= 7.0 && !this._collapseFired) {
        this._collapseFired = true;
        const px = this._prevPX || (paradoxEntity ? paradoxEntity.cx() : GAME_W / 2);
        const py = this._prevPY || (paradoxEntity ? paradoxEntity.cy() : GAME_H / 2);
        if (paradoxEntity) paradoxEntity.done = true;
        if (typeof CinFX !== 'undefined') { CinFX.flash('#ffffff', 0.95, 18); CinFX.shake(50); }
        if (settings.particles) {
          for (let i = 0; i < 80 && particles.length < MAX_PARTICLES; i++) {
            const angle = Math.random() * Math.PI * 2;
            const spd   = 3 + Math.random() * 18;
            const _p    = _getParticle();
            _p.x  = px + (Math.random() - 0.5) * 30; _p.y  = py + (Math.random() - 0.5) * 30;
            _p.vx = Math.cos(angle) * spd; _p.vy = Math.sin(angle) * spd;
            _p.color   = ['#00ffff','#ffffff','#ff00ff','#aaaaff'][Math.floor(Math.random() * 4)];
            _p.size    = 2 + Math.random() * 6;
            _p.life    = 40 + Math.random() * 40;
            _p.maxLife = 80;
            particles.push(_p);
          }
        }
        if (typeof showBossDialogue === 'function') showBossDialogue('Erased.', 200);
        // Force terminal to show TERMINATED immediately
        if (_tfKCOverlay && _tfKCOverlay.termLines) {
          const last = _tfKCOverlay.termLines[_tfKCOverlay.termLines.length - 1];
          if (last) last.revealCount = last.text.length;
          _tfKCOverlay.termProgress = 100;
        }
      }

      // ── 7.5s: terminal closes ────────────────────────────────
      if (t >= 7.5 && _tfKCOverlay && _tfKCOverlay.termVisible) {
        _tfKCOverlay.termVisible = false;
      }

      // ── 8.2s: energy streams from Paradox remains → player ───
      if (t >= 8.2 && !this._streamFired) {
        this._streamFired = true;
        if (_tfKCOverlay) _tfKCOverlay.lockActive = false;
        const hero = typeof players !== 'undefined' ? players.find(p => !p.isBoss && p.health > 0) : null;
        if (hero) hero.invincible = Math.max(hero.invincible || 0, 9999);
        if (typeof showBossDialogue === 'function')
          showBossDialogue('Their energy\u2026 it\u2019s yours now.', 240);
      }

      // Continuous stream particles (t 8.2 – 9.3)
      if (this._streamFired && !this._absorptionFired && settings.particles && particles.length < MAX_PARTICLES) {
        const hero = typeof players !== 'undefined' ? players.find(p => !p.isBoss && p.health > 0) : null;
        const hx   = hero ? hero.cx() : GAME_W / 2;
        const hy   = hero ? hero.cy() : GAME_H / 2;
        for (let i = 0; i < 3 && particles.length < MAX_PARTICLES; i++) {
          const lerpT = Math.random();
          const _p    = _getParticle();
          _p.x  = this._prevPX + (hx - this._prevPX) * lerpT + (Math.random() - 0.5) * 18;
          _p.y  = this._prevPY + (hy - this._prevPY) * lerpT + (Math.random() - 0.5) * 18;
          _p.vx = (hx - this._prevPX) / 80 * (1.5 + Math.random());
          _p.vy = (hy - this._prevPY) / 80 * (1.5 + Math.random());
          _p.color   = Math.random() < 0.6 ? '#00ffff' : '#aa44ff';
          _p.size    = 1.5 + Math.random() * 2.5;
          _p.life    = 14 + Math.random() * 12;
          _p.maxLife = 26;
          particles.push(_p);
        }
      }

      // ── 9.3s: absorption pulse — player gains Paradox power ──
      if (t >= 9.3 && !this._absorptionFired) {
        this._absorptionFired = true;
        playerParadoxAbsorbed = true;
        const hero = typeof players !== 'undefined' ? players.find(p => !p.isBoss && p.health > 0) : null;
        if (hero && settings.particles) {
          for (let i = 0; i < 50 && particles.length < MAX_PARTICLES; i++) {
            const angle = Math.random() * Math.PI * 2;
            const spd   = 5 + Math.random() * 10;
            const _p    = _getParticle();
            _p.x  = hero.cx(); _p.y = hero.cy();
            _p.vx = Math.cos(angle) * spd; _p.vy = Math.sin(angle) * spd;
            _p.color   = Math.random() < 0.55 ? '#00ffff' : '#ff00ff';
            _p.size    = 2 + Math.random() * 4;
            _p.life    = 30 + Math.random() * 30;
            _p.maxLife = 60;
            particles.push(_p);
          }
        }
        if (typeof CinFX !== 'undefined') { CinFX.flash('#00ffff', 0.55, 22); CinFX.shake(28); }
        if (typeof showBossDialogue === 'function')
          showBossDialogue('You carry a piece of the multiverse. That is why you survive.', 300);
      }

      // Tick Paradox entity (fade/glitch)
      if (paradoxEntity) paradoxEntity.update();
    },

    onEnd() {
      slowMotion           = 1.0;
      cinematicCamOverride = false;
      paradoxEntity        = null;
      _tfKCOverlay         = null;

      // Mark paradox death cinematic as complete — absorption MUST check this flag
      paradoxDeathComplete = true;

      // Guarantee TF starts the main fight at exactly 9000 HP
      if (tf) {
        tf.health           = 9000;
        tf.maxHealth        = Math.max(tf.maxHealth, 9000);
        tf.postSpecialPause = 4;
      }

      // Reposition hero away from TF
      const hero = typeof players !== 'undefined' ? players.find(p => !p.isBoss) : null;
      if (hero && tf) {
        hero.x  = Math.max(40, tf.x - 140);
        hero.y  = GAME_H - 72 - hero.h;
        hero.vx = 0;
        hero.vy = 0;
      }

      // Begin absorption → transition to dimension-punch cinematic
      // startTFAbsorptionScene is the new declarative version; falls back to legacy helper
      if (hero && typeof startTFAbsorptionScene === 'function') {
        startTFAbsorptionScene(hero, paradoxEntity);
      } else if (hero && typeof _startAbsorptionThenPunch === 'function') {
        _startAbsorptionThenPunch(tf, hero);
      }
    }
  };
}

