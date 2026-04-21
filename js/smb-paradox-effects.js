'use strict';
// smb-paradox-effects.js — resetParadoxState body, updateParadoxEffects — particle/text/strike effects
// Depends on: smb-globals.js, smb-paradox-class.js (and preceding splits in chain)

// ============================================================
// RESET  (call from _startGameCore to clear state)
// ============================================================
function resetParadoxState() {
  paradoxEntity        = null;
  paradoxReviveActive  = false;
  tfOpeningFightActive    = false;
  tfOpeningDamageDealt    = 0;
  _tfOpeningParadoxAtkCd  = 0;
  _tfOpeningHeroAtkCd     = 90;
  _tfOpeningPhase         = 0;
  _tfOpeningDialogueFired = new Set();
  _tfOpeningTFRef         = null;
  _tfAbsorptionState    = null;
  playerParadoxAbsorbed = false;
  _tfKCOverlay          = null;
  paradoxReviveTimer   = 0;
  paradoxRevivePlayer  = null;
  tfDamageLocked       = false;
  tfDamageLockTimer    = 0;
  tfParadoxEmpowered   = false;
  tfEmpowerTimer       = 0;
  tfFinalParadoxFired  = false;
  bossParadoxForeshadow.active     = false;
  bossParadoxForeshadow.timer      = 0;
  bossParadoxForeshadow.cooldown   = 0;
  bossParadoxForeshadow.punchFired = false;
  // Phase 0 / False Victory state
  tfFalseVictoryFired = false;
  tfFalseVictoryState = null;
  tfParadoxFused      = false;
  tfFusionGlow        = 0;
  tfFusionControlMode = 'player';
  tfFusionSwitchTimer = 0;
  tfFusionGlitchTimer = 0;
  controlState = 'player';
  controlTimer = 0;
  tfSwitchToParadoxFlash = 0;
  tfSwitchToPlayerFade   = 0;
  tfFinalStateActive  = false;
  _paradoxPendingStrikes = [];
  _paradoxEchoHits       = [];
  _paradoxNullFields     = [];
  _paradoxCommandTexts   = [];
}

// ============================================================
// PARADOX ABILITIES SYSTEM
// ============================================================
const PARADOX_ABILITIES = {
  microTeleport: {
    name: 'Micro-Teleport',
    cooldown: 90,
    execute(user) {
      const dir = user.facing || 1;
      const blink = 120;
      user.x += dir * blink;
      user.x = Math.max(0, Math.min(GAME_W - user.w, user.x));
      user.vy = -6;
      if (settings.particles) {
        for (let i = 0; i < 18 && particles.length < MAX_PARTICLES; i++) {
          const _p = _getParticle();
          _p.x = user.cx() - dir * blink * 0.5;
          _p.y = user.cy();
          _p.vx = (Math.random() - 0.5) * 8;
          _p.vy = (Math.random() - 0.5) * 8;
          _p.color = '#00ffff';
          _p.size = 2 + Math.random() * 3;
          _p.life = 18 + Math.random() * 14;
          _p.maxLife = 32;
          particles.push(_p);
        }
      }
      SoundManager.jump && SoundManager.jump();
    }
  },
  phaseDash: {
    name: 'Phase Dash',
    cooldown: 120,
    execute(user, target) {
      if (!target) return;
      const dir = target.cx() > user.cx() ? 1 : -1;
      user.x = target.cx() + dir * (target.w + 5) - user.w / 2;
      user.vx = dir * 8;
      user.invincible = Math.max(user.invincible, 45);
      if (typeof dealDamage === 'function') {
        dealDamage(user, target, 18, 14);
      }
      if (settings.particles) {
        for (let i = 0; i < 22 && particles.length < MAX_PARTICLES; i++) {
          const _p = _getParticle();
          _p.x = user.cx() + (Math.random() - 0.5) * 30;
          _p.y = user.cy() + (Math.random() - 0.5) * 20;
          _p.vx = -dir * (2 + Math.random() * 4);
          _p.vy = (Math.random() - 0.5) * 3;
          _p.color = Math.random() < 0.5 ? '#ffffff' : '#00ffff';
          _p.size = 1.5 + Math.random() * 2.5;
          _p.life = 14 + Math.random() * 12;
          _p.maxLife = 26;
          particles.push(_p);
        }
      }
    }
  },
  futureStrike: {
    name: 'Future Strike',
    cooldown: 180,
    execute(user, target) {
      if (!target) return;
      const predX = target.cx() + (target.vx || 0) * 18;
      const predY = target.y + (target.h / 2);
      _paradoxPendingStrikes.push({
        x: predX, y: predY,
        timer: 0, maxTimer: 55,
        owner: user,
        target: target,
        fired: false
      });
      if (settings.particles) {
        const _p = _getParticle();
        _p.x = predX; _p.y = predY - 20;
        _p.vx = 0; _p.vy = -1;
        _p.color = '#ffcc00';
        _p.size = 6; _p.life = 55; _p.maxLife = 55;
        particles.push(_p);
      }
    }
  },
  echoCombo: {
    name: 'Echo Combo',
    cooldown: 150,
    execute(user, target) {
      if (!target) return;
      for (let i = 0; i < 3; i++) {
        _paradoxEchoHits.push({
          x: user.cx(), y: user.cy(),
          timer: i * 22,
          owner: user, target: target,
          fired: false
        });
      }
      if (typeof dealDamage === 'function') dealDamage(user, target, 12, 8);
    }
  },
  positionSwap: {
    name: 'Position Swap',
    cooldown: 210,
    execute(user, target) {
      if (!target) return;
      const tx = target.x, ty = target.y;
      target.x = user.x; target.y = user.y;
      user.x   = tx;     user.y   = ty;
      if (settings.particles) {
        for (let i = 0; i < 16 && particles.length < MAX_PARTICLES; i++) {
          const _p = _getParticle();
          _p.x = user.cx() + (Math.random()-0.5)*20;
          _p.y = user.cy() + (Math.random()-0.5)*20;
          _p.vx = (Math.random()-0.5)*5;
          _p.vy = (Math.random()-0.5)*5;
          _p.color = '#ff00ff';
          _p.size = 2+Math.random()*3; _p.life = 18+Math.random()*12; _p.maxLife = 30;
          particles.push(_p);
        }
      }
      screenShake = Math.max(screenShake, 12);
    }
  },
  nullField: {
    name: 'Null Field',
    cooldown: 240,
    execute(user) {
      _paradoxNullFields.push({
        x: user.cx(), y: user.cy(),
        r: 90, timer: 0, maxTimer: 300
      });
      if (typeof showBossDialogue === 'function') showBossDialogue('> null_zone.activate();', 160);
    }
  },
  commandInjection: {
    name: 'Command Injection',
    cooldown: 180,
    execute(user, target) {
      if (!target) return;
      _paradoxCommandTexts.push({
        text: '> target.speed = 0;',
        x: target.cx(), y: target.y - 30,
        timer: 0, maxTimer: 90, alpha: 1
      });
      target._pdxSlow = 120;
      if (typeof dealDamage === 'function') dealDamage(user, target, 8, 4);
    }
  },
  projectileRewrite: {
    name: 'Projectile Rewrite',
    cooldown: 90,
    execute(user) {
      if (!projectiles) return;
      let nearest = null, nearDist = 200;
      for (const proj of projectiles) {
        if (proj.owner === user) continue;
        const d = Math.hypot(proj.x - user.cx(), proj.y - user.cy());
        if (d < nearDist) { nearDist = d; nearest = proj; }
      }
      if (nearest) {
        nearest.vx *= -1.4;
        nearest.vy *= -1.2;
        nearest.owner = user;
        nearest.damage = (nearest.damage || 5) + 4;
        if (settings.particles) {
          for (let i = 0; i < 10 && particles.length < MAX_PARTICLES; i++) {
            const _p = _getParticle();
            _p.x = nearest.x; _p.y = nearest.y;
            _p.vx = (Math.random()-0.5)*5; _p.vy = (Math.random()-0.5)*5;
            _p.color = '#00ffff'; _p.size = 2+Math.random()*2;
            _p.life = 12+Math.random()*10; _p.maxLife = 22;
            particles.push(_p);
          }
        }
      }
    }
  },
  perfectShield: {
    name: 'Perfect Shield',
    cooldown: 240,
    execute(user) {
      user.invincible = Math.max(user.invincible, 60);
      user.shielding  = true;
      user._pdxParryTimer = 60;
      if (settings.particles) {
        for (let i = 0; i < 14 && particles.length < MAX_PARTICLES; i++) {
          const _p = _getParticle();
          _p.x = user.cx() + Math.cos(i/14*Math.PI*2)*28;
          _p.y = user.cy() + Math.sin(i/14*Math.PI*2)*28;
          _p.vx = Math.cos(i/14*Math.PI*2)*2; _p.vy = Math.sin(i/14*Math.PI*2)*2;
          _p.color = '#ffffff'; _p.size = 2; _p.life = 25; _p.maxLife = 25;
          particles.push(_p);
        }
      }
    }
  },
  undoHit: {
    name: 'Undo Hit',
    cooldown: 300,
    execute(user) {
      const restore = Math.min(35, user.maxHealth - user.health);
      if (restore > 0) {
        user.health = Math.min(user.maxHealth, user.health + restore);
        if (settings.particles) {
          for (let i = 0; i < 18 && particles.length < MAX_PARTICLES; i++) {
            const _p = _getParticle();
            _p.x = user.cx() + (Math.random()-0.5)*20;
            _p.y = user.cy() + (Math.random()-0.5)*20;
            _p.vx = (Math.random()-0.5)*3; _p.vy = -2-Math.random()*3;
            _p.color = '#00ffcc'; _p.size = 2+Math.random()*3;
            _p.life = 22+Math.random()*18; _p.maxLife = 40;
            particles.push(_p);
          }
        }
        if (typeof showBossDialogue === 'function') showBossDialogue('> rollback(damage);', 140);
      }
    }
  }
};

// Active pending effect arrays
let _paradoxPendingStrikes = [];
let _paradoxEchoHits       = [];
let _paradoxNullFields     = [];
let _paradoxCommandTexts   = [];

// ============================================================
// updateParadoxEffects — called each game frame
// ============================================================
function updateParadoxEffects() {
  // Future Strike: wait then hit
  for (let i = _paradoxPendingStrikes.length - 1; i >= 0; i--) {
    const s = _paradoxPendingStrikes[i];
    s.timer++;
    if (s.timer >= s.maxTimer && !s.fired) {
      s.fired = true;
      if (s.target && s.target.health > 0 && typeof dealDamage === 'function') {
        dealDamage(s.owner, s.target, 28, 18);
        screenShake = Math.max(screenShake, 14);
        if (settings.particles) {
          for (let j = 0; j < 20 && particles.length < MAX_PARTICLES; j++) {
            const _p = _getParticle();
            _p.x = s.x + (Math.random()-0.5)*20; _p.y = s.y + (Math.random()-0.5)*20;
            _p.vx = (Math.random()-0.5)*8; _p.vy = (Math.random()-0.5)*8;
            _p.color = '#ffcc00'; _p.size = 2+Math.random()*4;
            _p.life = 18+Math.random()*16; _p.maxLife = 34;
            particles.push(_p);
          }
        }
      }
    }
    if (s.timer > s.maxTimer + 5) _paradoxPendingStrikes.splice(i, 1);
  }

  // Echo Combo: delayed afterimage hits
  for (let i = _paradoxEchoHits.length - 1; i >= 0; i--) {
    const e = _paradoxEchoHits[i];
    e.timer--;
    if (e.timer <= 0 && !e.fired) {
      e.fired = true;
      if (e.target && e.target.health > 0 && typeof dealDamage === 'function') {
        dealDamage(e.owner, e.target, 10, 6);
      }
      if (settings.particles) {
        const _p = _getParticle();
        _p.x = e.x; _p.y = e.y;
        _p.vx = (Math.random()-0.5)*4; _p.vy = -2-Math.random()*3;
        _p.color = '#00ffff'; _p.size = 3+Math.random()*3;
        _p.life = 12+Math.random()*10; _p.maxLife = 22;
        particles.push(_p);
      }
    }
    if (e.fired) _paradoxEchoHits.splice(i, 1);
  }

  // Null Field: destroy projectiles in zone, apply slow to targets
  for (let i = _paradoxNullFields.length - 1; i >= 0; i--) {
    const nf = _paradoxNullFields[i];
    nf.timer++;
    if (projectiles) {
      for (let j = projectiles.length - 1; j >= 0; j--) {
        const proj = projectiles[j];
        const d = Math.hypot(proj.x - nf.x, proj.y - nf.y);
        if (d < nf.r) {
          projectiles.splice(j, 1);
          if (settings.particles) {
            const _p = _getParticle();
            _p.x = proj.x; _p.y = proj.y;
            _p.vx = (Math.random()-0.5)*3; _p.vy = (Math.random()-0.5)*3;
            _p.color = '#8800ff'; _p.size = 3; _p.life = 12; _p.maxLife = 12;
            particles.push(_p);
          }
        }
      }
    }
    for (const p of players) {
      if (p.isBoss) continue;
      const d = Math.hypot(p.cx() - nf.x, p.cy() - nf.y);
      if (d < nf.r) {
        p.vx *= 0.88;
      }
    }
    if (nf.timer >= nf.maxTimer) _paradoxNullFields.splice(i, 1);
  }

  // Command Injection slow decay
  for (const p of players) {
    if (p._pdxSlow > 0) {
      p._pdxSlow--;
      p.vx *= 0.72;
    }
    if (p._pdxParryTimer > 0) {
      p._pdxParryTimer--;
      if (p._pdxParryTimer <= 0) p.shielding = false;
    }
  }

  // Command text decay
  for (let i = _paradoxCommandTexts.length - 1; i >= 0; i--) {
    const ct = _paradoxCommandTexts[i];
    ct.timer++;
    ct.y -= 0.4;
    ct.alpha = Math.max(0, 1 - ct.timer / ct.maxTimer);
    if (ct.timer >= ct.maxTimer) _paradoxCommandTexts.splice(i, 1);
  }
}

// ============================================================
// drawParadoxEffects — called each game frame (world-space)
