'use strict';
// smb-attacktest-registry.js — ATK_REGISTRY — per-class attack definitions (fn, label, desc) for all classes + TrueForm
// Depends on: smb-globals.js, smb-fighter.js, smb-combat.js

// ─── ATTACK REGISTRY ──────────────────────────────────────────
// fn(ctx, target, opts)
//   ctx    — proxy object (position + methods, never rendered)
//   target — first live human player, may be null
//   opts   — { damageScale, safeMode }
//
// HOW TO ADD:  push a new { label, desc, fn } into the right bucket.
// ──────────────────────────────────────────────────────────────
const ATK_REGISTRY = {

  // ═══════════════════════════════════════════════════════════
  // CREATOR BOSS
  // ═══════════════════════════════════════════════════════════
  creator: [
    {
      label: 'beam_single',
      desc:  'Void beam — warning then active strike',
      fn(ctx, target) {
        const bx = target ? clamp(target.cx() + (Math.random()-0.5)*60, 40, 860) : GAME_W/2;
        bossBeams.push({ x:bx, warningTimer:300, activeTimer:0, phase:'warning', done:false });
        showBossDialogue('Feel the void!', 200);
      }
    },
    {
      label: 'beam_storm',
      desc:  'Meteor Storm — 5 beams with marked safe zone',
      fn(ctx) {
        const safeX = 150 + Math.random() * 600;
        bossMetSafeZones.push({ x:safeX, y:380, r:70, timer:350, maxTimer:350 });
        for (let i = 0; i < 5; i++) {
          let bx;
          do { bx = 60 + Math.random()*(GAME_W-120); } while (Math.abs(bx-safeX) < 80);
          bossBeams.push({ x:bx, warningTimer:240, activeTimer:0, phase:'warning', done:false });
        }
        screenShake = Math.max(screenShake, 14);
        showBossDialogue('METEOR STORM!', 220);
      }
    },
    {
      label: 'ground_slam',
      desc:  'Ground Slam — telegraph AOE then spike burst',
      fn(ctx, target) {
        const slamX = ctx.cx();
        const slamY = ctx.y + ctx.h;
        bossWarnings.push({ type:'circle', x:slamX, y:slamY, r:160, color:'#ff2200', timer:45, maxTimer:45, label:'SLAM!' });
        for (let i=0;i<6;i++) {
          const sx = clamp(slamX+(i-2.5)*55, 20, 880);
          bossWarnings.push({ type:'spike_warn', x:sx, y:460, r:12, color:'#ff6600', timer:45, maxTimer:45 });
        }
        setTimeout(() => {
          if (!gameRunning) return;
          for (let i=0;i<6;i++) {
            const sx = clamp(slamX+(i-2.5)*55, 20, 880);
            bossSpikes.push({ x:sx, maxH:90+Math.random()*50, h:0, phase:'rising', stayTimer:0, done:false });
          }
          screenShake = Math.max(screenShake, 20);
          spawnParticles(slamX, slamY, '#ff4400', 28);
        }, 750);
        showBossDialogue('SHATTER!', 160);
      }
    },
    {
      label: 'gravity_pulse',
      desc:  'Gravity Pulse — pulls player toward ctx position',
      fn(ctx) {
        bossWarnings.push({ type:'circle', x:ctx.cx(), y:ctx.cy(), r:350, color:'#9900cc', timer:40, maxTimer:40, label:'GRAVITY PULL!' });
        bossWarnings.push({ type:'circle', x:ctx.cx(), y:ctx.cy(), r:60,  color:'#cc66ff', timer:40, maxTimer:40 });
        setTimeout(() => {
          if (!gameRunning) return;
          const aoeTargets = _atkGetAOETargets(_atkCurrentFirer);
          for (const p of aoeTargets) {
            if (p.health <= 0) continue;
            const ddx = ctx.cx()-p.cx(), ddy = ctx.cy()-(p.y+p.h*0.5);
            const dd  = Math.hypot(ddx,ddy)||1;
            p.vx = (ddx/dd)*18; p.vy = (ddy/dd)*12-4;
            _atkDeal(null, p, 12, 6);
          }
          screenShake = Math.max(screenShake, 18);
          spawnParticles(ctx.cx(), ctx.cy(), '#9900cc', 24);
        }, 670);
        showBossDialogue('You cannot run.', 180);
      }
    },
    {
      label: 'minion_spawn',
      desc:  'Spawn 2 boss minions from arena edges',
      fn() {
        if (typeof Minion === 'undefined') { _consoleErr('Minion class unavailable.'); return; }
        const t = _atkGetTarget();
        for (let i=0;i<2;i++) {
          const spawnX = i===0 ? 80 : 820;
          const mn = new Minion(spawnX, 200);
          mn.target = t;
          minions.push(mn);
          spawnParticles(spawnX, 200, '#bb00ee', 24);
        }
        screenShake = Math.max(screenShake, 12);
        showBossDialogue('MINIONS, arise!', 220);
      }
    },
    {
      label: 'teleport',
      desc:  'Backstage portal teleport animation',
      fn(ctx) {
        // Open entry portal at ctx position then exit portal at a new position
        if (typeof openBackstagePortal === 'function') {
          openBackstagePortal(ctx.cx(), ctx.cy(), 'entry');
          const destX = ctx.cx() > GAME_W/2 ? 150 : GAME_W-150;
          setTimeout(() => {
            if (!gameRunning) return;
            openBackstagePortal(destX, ctx.cy(), 'exit');
          }, 500);
        }
        spawnParticles(ctx.cx(), ctx.cy(), '#9900ee', 18);
      }
    },
    {
      label: 'phase_flash',
      desc:  'Phase transition flash + screen shake',
      fn() {
        if (typeof bossPhaseFlash !== 'undefined') bossPhaseFlash = 50;
        screenShake = Math.max(screenShake, 24);
        showBossDialogue('PHASE THREE. Feel my full power!', 300);
        SoundManager.phaseUp && SoundManager.phaseUp();
      }
    },
    {
      label: 'beam_wave',
      desc:  'Wave of 8 beams covering the whole arena',
      fn() {
        for (let i=0;i<8;i++) {
          const bx = 60 + i*(GAME_W-120)/7;
          setTimeout(() => {
            if (!gameRunning) return;
            bossBeams.push({ x:bx, warningTimer:200, activeTimer:0, phase:'warning', done:false });
          }, i*120);
        }
        screenShake = Math.max(screenShake, 12);
        showBossDialogue('Nowhere to hide!', 200);
      }
    },
    {
      label: 'spike_carpet',
      desc:  'Dense carpet of floor spikes across the arena',
      fn() {
        for (let i=0;i<10;i++) {
          const sx = 50 + i*(GAME_W-100)/9;
          bossSpikes.push({ x:sx, maxH:70+Math.random()*60, h:0, phase:'rising', stayTimer:0, done:false });
        }
        screenShake = Math.max(screenShake, 18);
        showBossDialogue('The ground betrays you!', 200);
      }
    },
  ],

  // ═══════════════════════════════════════════════════════════
  // TRUE FORM
  // ═══════════════════════════════════════════════════════════
  trueform: [
    {
      label: 'gravity_invert',
      desc:  'Invert gravity for all non-boss players (10 s)',
      fn(ctx) {
        if (typeof tfGravityInverted === 'undefined') return;
        tfGravityInverted = !tfGravityInverted;
        tfGravityTimer    = tfGravityInverted ? 600 : 0;
        spawnParticles(ctx.cx(), ctx.cy(), '#ffffff', 22);
        showBossDialogue(tfGravityInverted ? 'Down is up now.' : 'Gravity returns.', 180);
      }
    },
    {
      label: 'controls_invert',
      desc:  'Invert player left/right controls',
      fn(ctx) {
        if (typeof tfControlsInverted === 'undefined') return;
        tfControlsInverted = !tfControlsInverted;
        spawnParticles(ctx.cx(), ctx.cy(), '#aaaaaa', 16);
        showBossDialogue(tfControlsInverted ? 'Your body refuses you.' : 'Control returns.', 180);
      }
    },
    {
      label: 'black_holes',
      desc:  'Spawn black holes that pull players',
      fn(ctx) {
        if (typeof spawnTFBlackHoles === 'function') {
          spawnTFBlackHoles(ctx);
        } else if (typeof tfBlackHoles !== 'undefined') {
          for (let i=0;i<3;i++)
            tfBlackHoles.push({ x:150+i*280, y:260+Math.random()*80, r:0, maxR:70, timer:600, bossRef:ctx });
        }
        showBossDialogue('Consume.', 110);
      }
    },
    {
      label: 'floor_remove',
      desc:  'Remove the arena floor for 20 seconds',
      fn() {
        if (typeof tfFloorRemoved === 'undefined') return;
        tfFloorRemoved = true; tfFloorTimer = 1200;
        const fl = currentArena && currentArena.platforms.find(p => p.isFloor);
        if (fl) fl.isFloorDisabled = true;
        spawnParticles(GAME_W/2, 465, '#000000', 30);
        spawnParticles(GAME_W/2, 465, '#ffffff', 15);
        showBossDialogue('There is no ground to stand on.', 240);
      }
    },
    {
      label: 'size_shift',
      desc:  'Randomly resize the player',
      fn(ctx, target) {
        if (typeof tfSetSize !== 'function') return;
        const scales = [0.4, 0.55, 0.7, 1.0, 1.25, 1.5];
        if (target) tfSetSize(target, scales[Math.floor(Math.random()*scales.length)]);
        showBossDialogue('Size means nothing here.', 180);
      }
    },
    {
      label: 'arena_warp',
      desc:  'Warp to a random arena',
      fn() {
        if (typeof tfWarpArena !== 'function') return;
        const pool = Object.keys(ARENAS).filter(k => !['creator','void','soccer'].includes(k));
        tfWarpArena(pool[Math.floor(Math.random()*pool.length)]);
        showBossDialogue('A new stage.', 150);
      }
    },
    {
      label: 'portal_teleport',
      desc:  'Teleport the player through a void portal',
      fn(ctx, target) {
        if (typeof executeTrueFormAttack === 'function') {
          executeTrueFormAttack(ctx, 'portal', target, 'atk-gui');
        } else if (target) {
          target.x = clamp(GAME_W - target.x - target.w, 20, GAME_W - target.w - 20);
          spawnParticles(target.cx(), target.cy(), '#8800ff', 18);
        }
      }
    },
    {
      label: 'void_grasp',
      desc:  'Pull player in then slam (Void Grasp)',
      fn(ctx, target) { if (typeof executeTrueFormAttack === 'function') { ctx._graspCd=0; executeTrueFormAttack(ctx, 'grasp', target, 'atk-gui'); } }
    },
    {
      label: 'reality_slash',
      desc:  'Telegraph + teleport strike (Reality Slash)',
      fn(ctx, target) { if (typeof executeTrueFormAttack === 'function') { ctx._slashCd=0; executeTrueFormAttack(ctx, 'slash', target, 'atk-gui'); } }
    },
    {
      label: 'gravity_well',
      desc:  'Persistent gravity pull zone',
      fn(ctx, target) { if (typeof executeTrueFormAttack === 'function') { ctx._wellCd=0; executeTrueFormAttack(ctx, 'well', target, 'atk-gui'); } }
    },
    {
      label: 'meteor_crash',
      desc:  'Rising leap then crash down on target',
      fn(ctx, target) { if (typeof executeTrueFormAttack === 'function') { ctx._meteorCd=0; executeTrueFormAttack(ctx, 'meteor', target, 'atk-gui'); } }
    },
    {
      label: 'shadow_clones',
      desc:  '3 clones — one is real (Shadow Clones)',
      fn(ctx, target) { if (typeof executeTrueFormAttack === 'function') { ctx._cloneCd=0; executeTrueFormAttack(ctx, 'clones', target, 'atk-gui'); } }
    },
    {
      label: 'chain_slam',
      desc:  'Multi-stage slam combo (Chain Slam)',
      fn(ctx, target) { if (typeof executeTrueFormAttack === 'function') { ctx._chainCd=0; executeTrueFormAttack(ctx, 'chain', target, 'atk-gui'); } }
    },
    {
      label: 'shockwave',
      desc:  'Ground shockwave with telegraph ring',
      fn(ctx, target) { if (typeof executeTrueFormAttack === 'function') { ctx._shockwaveCd=0; executeTrueFormAttack(ctx, 'shockwave', target, 'atk-gui'); } }
    },
    {
      label: 'phase_shift',
      desc:  '3 decoy echoes, one is real (Phase Shift)',
      fn(ctx, target) { if (typeof executeTrueFormAttack === 'function') { ctx._phaseShiftCd=0; executeTrueFormAttack(ctx, 'phaseShift', target, 'atk-gui'); } }
    },
    {
      label: 'teleport_combo',
      desc:  '3× rapid teleport-strikes',
      fn(ctx, target) { if (typeof executeTrueFormAttack === 'function') { ctx._teleportComboCd=0; executeTrueFormAttack(ctx, 'teleportCombo', target, 'atk-gui'); } }
    },
    {
      label: 'gravity_crush',
      desc:  'Suck players to center then explode outward',
      fn(ctx, target) { if (typeof executeTrueFormAttack === 'function') { ctx._gravityCrushCd=0; executeTrueFormAttack(ctx, 'gravityCrush', target, 'atk-gui'); } }
    },
    {
      label: 'gamma_beam',
      desc:  'Horizontal screen-crossing beam',
      fn(ctx, target) { if (typeof executeTrueFormAttack === 'function') { ctx._gammaBeamCd=0; executeTrueFormAttack(ctx, 'gammaBeam', target, 'atk-gui'); } }
    },
    {
      label: 'neutron_star',
      desc:  'Massive gravity sphere (Neutron Star)',
      fn(ctx, target) { if (typeof executeTrueFormAttack === 'function') { ctx._neutronStarCd=0; executeTrueFormAttack(ctx, 'neutronStar', target, 'atk-gui'); } }
    },
    {
      label: 'galaxy_sweep',
      desc:  'Wide debris wave (Galaxy Sweep)',
      fn(ctx, target) { if (typeof executeTrueFormAttack === 'function') { ctx._galaxySweepCd=0; executeTrueFormAttack(ctx, 'galaxySweep', target, 'atk-gui'); } }
    },
    {
      label: 'multiverse_fracture',
      desc:  'Shatter arena into segments',
      fn(ctx, target) { if (typeof executeTrueFormAttack === 'function') { ctx._multiverseCd=0; executeTrueFormAttack(ctx, 'multiverseFracture', target, 'atk-gui'); } }
    },
    {
      label: 'supernova',
      desc:  'Ultimate screen-clearing explosion',
      fn(ctx, target) { if (typeof executeTrueFormAttack === 'function') { ctx._supernovaCd=0; executeTrueFormAttack(ctx, 'supernova', target, 'atk-gui'); } }
    },
    {
      label: 'collapse_strike',
      desc:  'Slow-motion devastating blow',
      fn(ctx, target) { if (typeof executeTrueFormAttack === 'function') { ctx._collapseStrikeCd=0; executeTrueFormAttack(ctx, 'collapseStrike', target, 'atk-gui'); } }
    },
    {
      label: 'reality_override',
      desc:  'Boss temporarily rewrites game state',
      fn(ctx, target) { if (typeof executeTrueFormAttack === 'function') { ctx._realityOverrideCd=0; executeTrueFormAttack(ctx, 'realityOverride', target, 'atk-gui'); } }
    },
  ],

  // ═══════════════════════════════════════════════════════════
  // WEAPON ABILITIES (fires from first human player)
  // ═══════════════════════════════════════════════════════════
  weapons: [
    {
      label: 'sword_parry',
      desc:  'Sword ability — parry/counter',
      fn(_, target) {
        const p = players && players.find(q => !q.isBoss && q.health > 0);
        if (p && WEAPONS.sword && WEAPONS.sword.ability) WEAPONS.sword.ability(p, target || p.target);
      }
    },
    {
      label: 'hammer_shockwave',
      desc:  'Hammer ability — ground shockwave',
      fn(_, target) {
        const p = players && players.find(q => !q.isBoss && q.health > 0);
        if (p && WEAPONS.hammer && WEAPONS.hammer.ability) WEAPONS.hammer.ability(p, target || p.target);
      }
    },
    {
      label: 'gun_rapidfire',
      desc:  'Gun ability — 5-shot rapid burst',
      fn() {
        const p = players && players.find(q => !q.isBoss && q.health > 0);
        if (p && WEAPONS.gun && WEAPONS.gun.ability) WEAPONS.gun.ability(p, p.target);
      }
    },
    {
      label: 'axe_spin',
      desc:  'Axe ability — 360° spin',
      fn(_, target) {
        const p = players && players.find(q => !q.isBoss && q.health > 0);
        if (p && WEAPONS.axe && WEAPONS.axe.ability) WEAPONS.axe.ability(p, target || p.target);
      }
    },
    {
      label: 'spear_dash',
      desc:  'Spear ability — forward dash thrust',
      fn(_, target) {
        const p = players && players.find(q => !q.isBoss && q.health > 0);
        if (p && WEAPONS.spear && WEAPONS.spear.ability) WEAPONS.spear.ability(p, target || p.target);
      }
    },
  ],

  // ═══════════════════════════════════════════════════════════
  // YETI ATTACKS
  // ═══════════════════════════════════════════════════════════
  yeti: [
    {
      label: 'ice_roar',
      desc:  'AOE stun + KB all nearby players',
      fn(ctx) {
        const ROAR_R = 200;
        for (const p of _atkGetAOETargets(_atkCurrentFirer)) {
          if (Math.hypot(p.cx()-ctx.cx(), p.cy()-ctx.cy()) < ROAR_R) {
            p.stunTimer = Math.max(p.stunTimer||0, 60);
            p.vx = (p.cx() > ctx.cx() ? 1 : -1) * 10;
          }
        }
        spawnParticles(ctx.cx(), ctx.cy(), '#88ccff', 30);
        screenShake = Math.max(screenShake, 16);
        if (settings.dmgNumbers && typeof DamageText !== 'undefined')
          damageTexts.push(new DamageText(ctx.cx(), ctx.y-20, 'ROAR!', '#88ccff'));
      }
    },
    {
      label: 'ice_throw',
      desc:  'Throw an ice boulder at the target',
      fn(ctx, target) {
        if (!target) return;
        const dx = target.cx()-ctx.cx(), dy = (target.cy())-(ctx.cy());
        const spd = 14, mag = Math.hypot(dx,dy)||1;
        const _iceBoulder = new Projectile(ctx.cx(), ctx.cy(), (dx/mag)*spd, (dy/mag)*spd-4, null, Math.round(22*_atkDamageScale), '#aaddff');
        _iceBoulder.radius = 10; _iceBoulder.life = 120;
        projectiles.push(_iceBoulder);
        spawnParticles(ctx.cx(), ctx.cy(), '#aaddff', 12);
      }
    },
    {
      label: 'blizzard',
      desc:  'Burst of ice projectiles across the arena',
      fn(ctx) {
        for (let i=0;i<8;i++) {
          const ang = (Math.PI*0.9)+(i/7)*(Math.PI*1.0);
          const spd = 4+Math.random()*4;
          const _blizzP = new Projectile(ctx.cx(), ctx.y+30+i*20, Math.cos(ang)*spd, Math.sin(ang)*spd+1, null, Math.round(8*_atkDamageScale), '#88ccff');
          _blizzP.radius = 8; _blizzP.life = 180;
          projectiles.push(_blizzP);
        }
        spawnParticles(ctx.cx(), ctx.y, '#cceeff', 30);
        screenShake = Math.max(screenShake, 8);
        showBossDialogue && showBossDialogue('BLIZZARD!', 180);
      }
    },
    {
      label: 'ice_slam',
      desc:  'Massive downward ice slam + freeze zone',
      fn(ctx) {
        screenShake = Math.max(screenShake, 22);
        spawnParticles(ctx.cx(), ctx.cy(), '#aaddff', 40);
        spawnParticles(ctx.cx(), ctx.cy(), '#ffffff', 20);
        for (const p of _atkGetAOETargets(_atkCurrentFirer)) {
          _atkDeal(null, p, 30, 18);
          p.stunTimer = Math.max(p.stunTimer||0, 45);
        }
        if (settings.dmgNumbers && typeof DamageText !== 'undefined')
          damageTexts.push(new DamageText(ctx.cx(), ctx.y-30, 'ICE SLAM!', '#aaddff'));
      }
    },
  ],

  // ═══════════════════════════════════════════════════════════
  // FOREST BEAST ATTACKS
  // ═══════════════════════════════════════════════════════════
  beast: [
    {
      label: 'pounce',
      desc:  'Lunge forward at the player with high KB',
      fn(ctx, target) {
        if (!target) return;
        const dir = target.cx() > ctx.cx() ? 1 : -1;
        spawnParticles(ctx.cx(), ctx.cy(), '#1a8a2e', 16);
        _atkDeal(null, target, 20, 14);
        target.vx = dir * 18; target.vy = -10;
      }
    },
    {
      label: 'rage_burst',
      desc:  'Rage burst — particle explosion + nearby KB',
      fn(ctx) {
        spawnParticles(ctx.cx(), ctx.cy(), '#ff4400', 40);
        spawnParticles(ctx.cx(), ctx.cy(), '#ff8800', 20);
        screenShake = Math.max(screenShake, 20);
        for (const p of _atkGetAOETargets(_atkCurrentFirer)) {
          if (Math.hypot(p.cx()-ctx.cx(), p.cy()-ctx.cy()) < 160) {
            _atkDeal(null, p, 15, 16);
            p.vx = (p.cx() > ctx.cx() ? 1 : -1) * 16;
          }
        }
        if (settings.dmgNumbers && typeof DamageText !== 'undefined')
          damageTexts.push(new DamageText(ctx.cx(), ctx.y-20, 'ENRAGED!', '#ff4400'));
      }
    },
    {
      label: 'ground_slam',
      desc:  'AOE ground slam on landing',
      fn(ctx) {
        screenShake = Math.max(screenShake, 14);
        spawnParticles(ctx.cx(), ctx.y+ctx.h, '#1a8a2e', 24);
        for (const p of _atkGetAOETargets(_atkCurrentFirer)) {
          if (Math.abs(p.cx()-ctx.cx()) < 120) _atkDeal(null, p, 18, 12);
        }
      }
    },
    {
      label: 'vine_snare',
      desc:  'Root the target in place for 1.5 s',
      fn(ctx, target) {
        if (!target) return;
        target.stunTimer = Math.max(target.stunTimer||0, 90);
        target.vx = 0; target.vy = 0;
        spawnParticles(target.cx(), target.cy(), '#1a8a2e', 20);
        spawnParticles(target.cx(), target.cy(), '#44cc44', 10);
        if (settings.dmgNumbers && typeof DamageText !== 'undefined')
          damageTexts.push(new DamageText(target.cx(), target.y-20, 'SNARED!', '#44cc44'));
      }
    },
  ],
};

