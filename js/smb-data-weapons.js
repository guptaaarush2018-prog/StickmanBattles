'use strict';
// smb-data-weapons.js — WEAPONS, WEAPON_KEYS, CLASSES, CLASS_AFFINITY, descriptions
// Depends on: smb-globals.js, smb-particles.js (spawnParticles, dealDamage)
// Must load AFTER smb-data-arenas.js

// ============================================================
// WEAPON DEFINITIONS
// ============================================================
const WEAPONS = {
  sword: {
    // THE ALL-ROUNDER: Fast, mobile, reliable. Jack of all trades.
    // Identity: Dash Slash chases and punishes. Great neutral game.
    name: 'Sword',   damage: 16, range: 90, cooldown: 30, endlag: 7,
    kb: 10,          abilityCooldown: 150, type: 'melee', weaponType: 'light', color: '#cccccc',
    abilityName: 'Dash Slash',
    ability(user, target) {
      user.vx = user.facing * 16;
      if (dist(user, target) < 130) dealDamage(user, target, 28, 16);
    }
  },
  hammer: {
    // THE CRUSHER: Slow, punishing, massive knockback. Forces commitment.
    // Identity: Every hit sends enemies flying. One good read = huge reward.
    name: 'Hammer',  damage: 22, range: 80, cooldown: 62, endlag: 22,
    kb: 20,          abilityCooldown: 230, type: 'melee', weaponType: 'heavy', color: '#888888',
    abilityName: 'Ground Slam',
    ability(user, target) {
      screenShake = Math.max(screenShake, 24);
      spawnRing(user.cx(), user.y + user.h);
      if (dist(user, target) < 145) dealDamage(user, target, 28, 22);
    }
  },
  gun: {
    // THE HARASSER: Reliable ranged poke. Rewards keeping distance.
    // Identity: Steady chip damage + burst fire ability. Control space.
    name: 'Gun',     damage: 9, range: 600, cooldown: 32, endlag: 6,
    damageFunc: () => Math.floor(Math.random() * 4) + 7,
    superRateBonus: 1.2,
    splashRange: 38, splashDmgPct: 0.30,
    clipSize: 6, reloadFrames: 90,
    kb: 7,           abilityCooldown: 200, type: 'ranged', weaponType: 'ranged', color: '#666666',
    abilityName: 'Burst Shot',
    ability(user, _target) {
      // 3-round burst: fires 3 bullets in a tight vertical fan, rapid-fire feel
      user._qSuperCapRemaining = 10; // max 10% super per activation
      const offsets = [-0.55, 0, 0.55]; // slight vertical spread
      for (let i = 0; i < 3; i++) {
        setTimeout(() => {
          if (!gameRunning || user.health <= 0) return;
          const _p = spawnBullet(user, 9, '#ffdd00', 7);
          if (_p) {
            _p._isQAbility = true;
            _p.vy += offsets[i]; // fan spread
          }
        }, i * 60);
      }
      setTimeout(() => { user._qSuperCapRemaining = undefined; }, 400);
    }
  },
  axe: {
    // THE SPINNER: Mid-range AoE brawler. Covers angles, not pure damage.
    // Identity: Spin Attack is a defensive escape AND offensive tool. Trades raw dmg for coverage.
    name: 'Axe',     damage: 13, range: 88, cooldown: 52, endlag: 16,
    splashRange: 70, splashDmgPct: 0.30,
    kb: 10,          abilityCooldown: 180, type: 'melee', weaponType: 'heavy', color: '#cc4422',
    abilityName: 'Spin Attack',
    ability(user, target) {
      user.spinning = 30;
      if (dist(user, target) < 110) dealDamage(user, target, 16, 11);
    }
  },
  spear: {
    // THE POKER: Longest melee reach. Safe, consistent, spacing-dependent.
    // Identity: Never lets enemies get close. Low KB keeps spacing tight for follow-ups.
    name: 'Spear',   damage: 15, range: 140, cooldown: 44, endlag: 12,
    kb: 7,           abilityCooldown: 165, type: 'melee', weaponType: 'light', color: '#8888ff',
    abilityName: 'Lunge',
    ability(user, target) {
      user.vx = user.facing * 14;
      user.vy = -5;
      if (dist(user, target) < 150) dealDamage(user, target, 18, 10);
    }
  },
  bow: {
    // THE SNIPER: Highest single-shot ranged damage. Archer class only.
    // Identity: Huge range, powerful arrow, but slow fire rate demands good aim.
    name: 'Bow',  damage: 0, range: 700, cooldown: 52, endlag: 4,
    damageFunc: () => Math.floor(14 + Math.random() * 8),
    clipSize: 3, reloadFrames: 120,
    kb: 14,       abilityCooldown: 185, type: 'ranged', weaponType: 'ranged', color: '#aad47a',
    requiresClass: 'archer',
    abilityName: 'Triple Shot',
    ability(user, _target) {
      user._qHitCount = 0;
      user._qSuperCapRemaining = 28;
      const angles = [-0.22, 0, 0.22];
      for (let i = 0; i < 3; i++) {
        const dmg = user.weapon.damageFunc();
        const speed = 13;
        const vx = user.facing * speed * Math.cos(angles[i]);
        const vy = speed * Math.sin(angles[i]);
        const _p = new Projectile(user.cx() + user.facing * 12, user.y + 22, vx, vy, user, dmg, '#aad47a');
        _p._isQAbility = true;
        projectiles.push(_p);
      }
      setTimeout(() => { user._qSuperCapRemaining = undefined; }, 400);
    }
  },
  shield: {
    // THE WALL: Lowest damage, highest block and pushback. Paladin class only.
    // Identity: You don't kill with damage — you kill by shoving enemies off platforms.
    name: 'Shield', damage: 10, range: 52, cooldown: 36, endlag: 9,
    kb: 26,         abilityCooldown: 195, type: 'melee', weaponType: 'heavy', color: '#88aaff',
    requiresClass: 'paladin',
    contactDmgMult: 0,
    abilityName: 'Shield Bash',
    ability(user, target) {
      if (dist(user, target) < 105) {
        target.vx  = user.facing * 26;
        target.stunTimer = Math.max(target.stunTimer || 0, 12);
        dealDamage(user, target, 12, 22);
        spawnParticles(target.cx(), target.cy(), '#88aaff', 10);
      }
    }
  },
  scythe: {
    // THE SUSTAINER: Wide sweep with lifesteal. Weaker 1v1, stronger vs groups.
    // Identity: Fights multiple targets simultaneously. Healing rewards multi-hit risks.
    name: 'Scythe', damage: 12, range: 100, cooldown: 44, endlag: 13,
    splashRange: 60, splashDmgPct: 0.35,
    kb: 8,           abilityCooldown: 195, type: 'melee', weaponType: 'light', color: '#aa44aa',
    abilityName: 'Reaping Sweep',
    ability(user, _target) {
      let healed = 0;
      for (const p of players) {
        if (p === user || p.health <= 0) continue;
        if (dist(user, p) < 125) { dealDamage(user, p, 10, 7); healed++; }
      }
      for (const d of trainingDummies) {
        if (d.health > 0 && dist(user, d) < 125) { dealDamage(user, d, 10, 7); healed++; }
      }
      if (healed > 0) {
        user.health = Math.min(user.maxHealth, user.health + healed * 3);
        spawnParticles(user.cx(), user.cy(), '#aa44aa', 12);
      }
    }
  },
  fryingpan: {
    // THE STUNNER: Slow but delivers punishing stun windows. Reads = reward.
    // Identity: Land the slow swing → stun window → follow-up combo. High risk, high reward.
    name: 'Frying Pan', damage: 18, range: 60, cooldown: 58, endlag: 20,
    kb: 12,              abilityCooldown: 220, type: 'melee', weaponType: 'heavy', color: '#ccaa44',
    abilityName: 'Pan Slam',
    ability(user, target) {
      if (dist(user, target) < 105) {
        dealDamage(user, target, 22, 16);
        target.stunTimer = Math.max(target.stunTimer || 0, 18); // reduced from 35 — brief stun, not a chain lock
        spawnParticles(target.cx(), target.cy(), '#ffdd66', 12);
        screenShake = Math.max(screenShake, 12);
      }
    }
  },
  broomstick: {
    // THE PUSHER: Long reach + extreme knockback. Kills by platform denial.
    // Identity: Lowest damage, highest push force. Win by edgeguarding.
    name: 'Broomstick', damage: 12, range: 125, cooldown: 32, endlag: 8,
    kb: 22,              abilityCooldown: 155, type: 'melee', weaponType: 'light', color: '#aa8855',
    abilityName: 'Sweep',
    ability(user, target) {
      user.vx = user.facing * 12;
      if (dist(user, target) < 165) {
        dealDamage(user, target, 14, 18);
        target.vx += user.facing * 24; // huge push toward edge
        spawnParticles(target.cx(), target.cy(), '#cc9966', 10);
      }
    }
  },
  boxinggloves: {
    // THE BRAWLER: Fastest attack speed in the game. Wins by relentless pressure.
    // Identity: Lowest range, must stay face-to-face. Rapid Combo is the identity skill.
    name: 'Boxing Gloves', damage: 9, range: 50, cooldown: 20, endlag: 10,
    kb: 4,                 abilityCooldown: 110, type: 'melee', weaponType: 'light', color: '#ee3333',
    abilityName: 'Rapid Combo',
    ability(user, target) {
      let count = 0;
      const doHit = () => {
        if (!gameRunning || user.health <= 0) return;
        if (dist(user, target) < 90) {
          dealDamage(user, target, 11, 4);
          spawnParticles(target.cx(), target.cy(), '#ff4444', 4);
        }
        count++;
        if (count < 5) setTimeout(doHit, 90);
      };
      doHit();
    }
  },
  peashooter: {
    // THE HARASSER: Fastest fire rate. Chip damage and interrupts enemy combos.
    // Identity: Each shot is weak but relentless. Storm ability dumps huge lead.
    name: 'Pea Shooter', damage: 0, range: 700, cooldown: 18, endlag: 5,
    damageFunc: () => 2 + Math.floor(Math.random() * 2), // 2-3 per shot
    bulletSpeed: 15, bulletColor: '#44cc44',
    clipSize: 15, reloadFrames: 75,
    kb: 3,               abilityCooldown: 120, type: 'ranged', weaponType: 'ranged', color: '#44cc44',
    abilityName: 'Pea Storm',
    ability(user, _target) {
      user._qHitCount = 0;
      user._qSuperCapRemaining = 28;
      for (let i = 0; i < 9; i++) {
        setTimeout(() => {
          if (!gameRunning || user.health <= 0) return;
          const angle = (Math.random() - 0.5) * 0.28;
          const spd   = 13 + Math.random() * 3;
          const _p = new Projectile(
            user.cx() + user.facing * 12, user.y + 22,
            user.facing * spd * Math.cos(angle), spd * Math.sin(angle),
            user, user.weapon.damageFunc(), '#44cc44'
          );
          _p._isQAbility = true;
          projectiles.push(_p);
        }, i * 65);
      }
      setTimeout(() => { user._qSuperCapRemaining = undefined; }, 800);
    }
  },
  slingshot: {
    // THE AIM-REWARDING SNIPER: Highest per-shot ranged damage. Slow but punishing.
    // Identity: Arc trajectory demands prediction. Land a hit = big reward.
    name: 'Slingshot', damage: 0, range: 650, cooldown: 62, endlag: 5,
    damageFunc: () => 10 + Math.floor(Math.random() * 5), // 10-14 per shot (was 15-21)
    bulletSpeed: 9, bulletColor: '#ff9933', bulletVy: -1.5,
    clipSize: 4, reloadFrames: 130,
    kb: 10,            abilityCooldown: 230, type: 'ranged', weaponType: 'ranged', color: '#cc8833',
    abilityName: 'Power Stone',
    ability(user, target) {
      const dx = (target.cx() - user.cx()) || 1;
      const dy = (target.cy() - user.cy()) || 1;
      const len = Math.hypot(dx, dy);
      const proj = new Projectile(
        user.cx() + user.facing * 12, user.y + 22,
        (dx / len) * 14, (dy / len) * 14,
        user, 30, '#ff9933'
      );
      proj.splashRange = 50;
      proj.dmg = 22;
      projectiles.push(proj);
    }
  },
  paperairplane: {
    // THE TRICKSTER: Unpredictable arc confuses and disrupts. Unique flight path.
    // Identity: Angles and curves opponents can't predict. Barrage forces dodging.
    name: 'Paper Airplane', damage: 0, range: 800, cooldown: 35, endlag: 8,
    damageFunc: () => 8 + Math.floor(Math.random() * 5), // 8-12 per shot
    bulletSpeed: 7, bulletColor: '#aaccff', bulletVy: -0.5,
    clipSize: 5, reloadFrames: 80,
    kb: 6,                  abilityCooldown: 160, type: 'ranged', weaponType: 'ranged', color: '#ddeeff',
    abilityName: 'Paper Barrage',
    ability(user, _target) {
      for (let i = 0; i < 5; i++) {
        setTimeout(() => {
          if (!gameRunning || user.health <= 0) return;
          const angle = (Math.random() - 0.5) * 0.55;
          projectiles.push(new Projectile(
            user.cx() + user.facing * 12, user.y + 20,
            user.facing * (8 + Math.random() * 5) * Math.cos(angle),
            (8 + Math.random() * 5) * Math.sin(angle) - 2,
            user, user.weapon.damageFunc(), '#aaccff'
          ));
        }, i * 120);
      }
    }
  },
  gauntlet: {
    // Boss-only weapon. Heavy hitting melee, massive void slam ability.
    name: 'Gauntlet', damage: 13, range: 30, cooldown: 38,
    kb: 18,            abilityCooldown: 160, type: 'melee', weaponType: 'heavy', color: '#9900ee',
    contactDmgMult: 0.55,
    abilityName: 'Void Slam',
    ability(user, _target) {
      screenShake = Math.max(screenShake, 28);
      spawnRing(user.cx(), user.cy());
      spawnRing(user.cx(), user.cy());
      for (const p of players) {
        if (p === user || p.health <= 0) continue;
        if (dist(user, p) < 165) dealDamage(user, p, 22, 40);
      }
      // Also hit training dummies
      for (const d of trainingDummies) {
        if (d.health <= 0) continue;
        if (dist(user, d) < 165) dealDamage(user, d, 7, 40);
      }
    }
  },

  mkgauntlet: {
    // Megaknight class weapon — locked to Megaknight. Overrides handled in attack()/ability().
    name: 'Mk. Gauntlets', damage: 20, range: 72, cooldown: 22,
    kb: 24, abilityCooldown: 75, type: 'melee', weaponType: 'heavy', color: '#8844ff',
    contactDmgMult: 0.5, abilityName: 'Uppercut',
    ability(_user, _tgt) { /* fully overridden by Megaknight class */ }
  },

  // ── ENEMY-ONLY WEAPONS (never available in player weapon picker) ─────────
  voidblade: {
    enemyOnly: true,
    name: 'Void Blade', damage: 14, range: 58, cooldown: 26, endlag: 9,
    kb: 10, abilityCooldown: 140, type: 'melee', weaponType: 'light', color: '#9933ff',
    abilityName: 'Void Slash',
    ability(user, target) {
      if (!target || target.health <= 0) return;
      // Lunge forward + rapid slashes
      user.vx = user.facing * 14;
      if (dist(user, target) < 80) dealDamage(user, target, 10, 8);
      if (dist(user, target) < 80) dealDamage(user, target, 10, 8);
      spawnParticles(user.cx(), user.cy(), '#9933ff', 8);
      spawnParticles(user.cx(), user.cy(), '#cc66ff', 5);
    }
  },

  shockrifle: {
    enemyOnly: true,
    name: 'Shock Rifle', damage: 8, range: 600, cooldown: 36, endlag: 10,
    kb: 6, abilityCooldown: 180, type: 'ranged', weaponType: 'ranged', color: '#00ddff',
    abilityName: 'Chain Lightning',
    ability(user, _target) {
      // Rapid triple burst — fire 3 projectiles in quick sequence
      spawnBullet(user, 22, '#00eeff', 11);
      spawnBullet(user, 20, '#00ccdd', 11);
      spawnBullet(user, 18, '#0099bb', 11);
      spawnParticles(user.cx(), user.cy(), '#00ddff', 6);
    }
  }
};

const WEAPON_KEYS = Object.keys(WEAPONS).filter(k => k !== 'gauntlet' && k !== 'mkgauntlet' && !WEAPONS[k].enemyOnly);

// ============================================================
// CHARACTER CLASSES
// ============================================================
const CLASSES = {
  none:      { name: 'None',      desc: 'Standard balanced fighter',            weapon: null,     hp: 150, speedMult: 1.00, perk: null           },
  thor:      { name: 'Thor',      desc: 'Hammer master, thunder on dash',       weapon: 'hammer', hp: 150, speedMult: 0.90, perk: 'thunder'      },
  kratos:    { name: 'Kratos',    desc: 'Axe specialist, rage at low HP',       weapon: 'axe',    hp: 150, speedMult: 0.95, perk: 'rage'         },
  ninja:     { name: 'Ninja',     desc: 'Fast sword fighter, quick dash',       weapon: 'sword',  hp: 150, speedMult: 1.24, perk: 'swift'        },
  gunner:    { name: 'Gunner',    desc: 'Dual-shot gunslinger',                 weapon: 'gun',    hp: 150, speedMult: 1.06, perk: 'dual_shot'    },
  archer:    { name: 'Archer',    desc: 'Bow-only. Fast. Auto-backstep at low HP.', weapon: 'bow', hp: 150, speedMult: 1.20, perk: 'backstep'    },
  paladin:   { name: 'Paladin',   desc: 'Shield-only. Tanky. 15% dmg reduction.', weapon: 'shield', hp: 150, speedMult: 0.88, perk: 'holy_light' },
  berserker:  { name: 'Berserker',  desc: 'Any weapon. Rage boosts dmg at low HP.',             weapon: null, hp: 150, speedMult: 1.08, perk: 'blood_frenzy' },
  megaknight: { name: 'Megaknight', desc: 'Legendary knight. Smash, uppercut, and crush enemies.', weapon: 'mkgauntlet', hp: 150, speedMult: 0.84, perk: null },
};

// Damage multipliers applied when a class uses a weapon of a given weaponType.
// Keys must match classKey values used in applyClass().
const CLASS_AFFINITY = {
  archer: {
    light: 0.9,
    heavy: 0.7,
    ranged: 1.25
  },
  berserker: {
    light: 1.1,
    heavy: 1.3,
    ranged: 0.6
  },
  phasewalker: {
    light: 1.2,
    heavy: 0.8,
    ranged: 1.0
  },
  juggernaut: {
    light: 0.9,
    heavy: 1.4,
    ranged: 0.5
  }
};

// ============================================================
// WEAPON & CLASS DESCRIPTIONS  (shown in menu sidebar)
// ============================================================
const WEAPON_DESCS = {
  random:  { title: 'Random Weapon',  what: 'Picks a random weapon each game — embrace the chaos.',                                                         ability: null,                                                              super: null,                                                               how:  'Adapt to whatever you get each round.' },
  sword:   { title: 'Sword',          what: 'Fast, balanced melee weapon with good range. Damage: 18.',                                                     ability: 'Q — Dash Slash: dashes forward and slices for 36 dmg.',           super: 'E — Power Thrust: massive forward lunge for 60 dmg.',              how:  'Great all-rounder. Use Dash Slash to chase and punish.' },
  hammer:  { title: 'Hammer',         what: 'Slow but devastating. Huge knockback on every hit. Damage: 28.',                                               ability: 'Q — Ground Slam: shockwave AoE around you for 34 dmg.',          super: 'E — Mega Slam: screen-shaking AoE crush for 58 dmg.',              how:  'Get close, be patient, then smash hard.' },
  gun:     { title: 'Gun',            what: 'Ranged weapon. Each bullet deals 5–8 damage. Fires splash rounds.',                                            ability: 'Q — Rapid Fire: 5-shot burst.',                                   super: 'E — Bullet Storm: 14 rapid shots (9–12 dmg each).',               how:  'Keep your distance. Use Rapid Fire to pressure from afar.' },
  axe:     { title: 'Axe',            what: 'Balanced melee with solid damage, good knockback, and splash hits. Damage: 22.',                               ability: 'Q — Spin Attack: 360° slash that hits both sides.',               super: 'E — Berserker Spin: long spinning AoE for 52 dmg.',               how:  'Use Spin Attack in tight spots to cover all angles.' },
  spear:   { title: 'Spear',          what: 'Longest melee reach in the game. Consistent damage. Damage: 18.',                                              ability: 'Q — Lunge: leap forward with the spear for 30 dmg.',             super: 'E — Sky Piercer: aerial forward lunge for 50 dmg.',               how:  'Stay at optimal range. Poke safely from afar.' },
  bow:     { title: 'Bow ⚔ Archer only', what: 'Long-range arc weapon. Arrows deal 12–20 damage and arc slightly over distance.', ability: 'Q — Triple Shot: fires 3 arrows in a fan spread.',       super: 'E — Power Arrow: giant arrow for 60 dmg with high knockback.',    how:  'Stay back and poke. Triple Shot punishes clustered enemies. ARCHER CLASS REQUIRED.' },
  shield:  { title: 'Shield ⚔ Paladin only', what: 'Defensive melee weapon. High knockback. Damage: 10.', ability: 'Q — Shield Bash: pushes enemy back and stuns for 25 frames.',              super: 'E — Holy Nova: AoE burst, heals self and deals 40 dmg to nearby foes.', how: 'Block with S key to absorb bullets. Bash enemies away. PALADIN CLASS REQUIRED.' },
  scythe:       { title: 'Scythe',         what: 'Wide-arc melee with splash damage. Heals on ability kills. Damage: 20.',        ability: 'Q — Reaping Sweep: 360° sweep, heals 5 HP per target hit.',    super: 'E — Death\'s Toll: massive 40 dmg AoE sweep with lifesteal.',    how:  'Fight multiple enemies at once. Sweep into crowds for healing.' },
  fryingpan:    { title: 'Frying Pan',     what: 'Slow but punishing melee. High knockback and a 0.7s stun on ability. Damage: 20.', ability: 'Q — Pan Slam: heavy strike stuns for 40 frames.',              super: 'E — Mega Smack: shockwave stun for 55 dmg.',                     how:  'Patience is key. Land Pan Slam then follow up while they\'re stunned.' },
  broomstick:   { title: 'Broomstick',     what: 'Long-reach melee. Low damage but pushes enemies away. Damage: 10.',               ability: 'Q — Sweep: dash forward, huge push to enemy.',                 super: 'E — Tornado Spin: spin push that hits all directions.',           how:  'Keep pressure with the long reach. Sweep enemies off platforms.' },
  boxinggloves: { title: 'Boxing Gloves',  what: 'Very fast punches. Low damage per hit but combos build up. Damage: 7.',           ability: 'Q — Rapid Combo: 5-hit burst at close range.',                 super: 'E — KO Punch: massive single hit for 60 dmg.',                   how:  'Stay in close. The rapid combo ability is your main damage tool.' },
  peashooter:   { title: 'Pea Shooter',    what: 'Rapid-fire ranged weapon. Very low damage per pea (2-3). High fire rate.',        ability: 'Q — Pea Storm: 10 rapid shots.',                               super: 'E — Giant Pea: one huge pea for 40 dmg and big knockback.',      how:  'Annoy and whittle down enemies. Storm ability surprises up close.' },
  slingshot:    { title: 'Slingshot',      what: 'Ranged weapon with arc trajectory. Moderate damage (12-17). Slow fire rate.',     ability: 'Q — Power Stone: big stone with 60px splash for 24 dmg.',     super: 'E — Boulder Shot: massive arc shot for 55 dmg.',                 how:  'Aim ahead of moving targets. Arc makes it tricky but rewarding.' },
  paperairplane:{ title: 'Paper Airplane', what: 'Very slow curving projectile. Low damage (6-9) but unpredictable arc.',           ability: 'Q — Barrage: 4 airplanes at staggered angles.',               super: 'E — Paper Swarm: 8 planes in all directions.',                   how:  'Confuse enemies with the curving path. Barrage at close range.' },
};

const CLASS_DESCS = {
  none:      { title: 'No Class',   what: 'No class modifier. Full freedom of weapon choice. HP: 100.',                                                                    perk: null,                                                                                                                              how:  'Choose any weapon — pure skill matters.' },
  thor:      { title: 'Thor',       what: 'Hammer master. Slower movement but powerful strikes. Forces Hammer. HP: 115.',                                                   perk: 'Lightning Storm (≤20% HP, once): Summons 3 lightning bolts — 8 dmg + stun each. Activates automatically.',                        how:  'Tank hits to trigger the lightning perk when low. Then finish with your super.' },
  kratos:    { title: 'Kratos',     what: 'Axe specialist. More HP, builds rage when hit. Forces Axe. HP: 125.',                                                            perk: 'Spartan Rage (≤15% HP, once): Auto-heals to 30% HP and boosts damage by +30% for 5 seconds.',                                     how:  'Survive the threat threshold — let the rage save you. Strike hard in the buff window.' },
  ninja:     { title: 'Ninja',      what: 'Extremely fast sword fighter. Fragile but elusive. Forces Sword. HP: 80.',                                                       perk: 'Shadow Step (≤25% HP, once): 2 seconds of full invincibility and all cooldowns reset instantly.',                                  how:  'Use your speed advantage to dodge. The perk buys time to escape and counter.' },
  gunner:    { title: 'Gunner',     what: 'Dual-shot gunslinger — fires 2 bullets every shot. Forces Gun. HP: 95.',                                                         perk: 'Last Stand (≤20% HP, once): Fires 8 bullets in all directions for 3–5 dmg each.',                                                 how:  'Keep distance at all times. The burst perk punishes enemies who close in when you\'re low.' },
  archer:    { title: 'Archer',     what: 'Long-range bow fighter. Fast movement, low HP. Forces Bow. HP: 85.',                                                              perk: 'Back-Step (≤20% HP): Auto-dash backward and reset double jump when threatened.',                                                  how:  'Stay at range. The auto-backstep keeps you alive when pressured.' },
  paladin:   { title: 'Paladin',    what: 'Tanky shield warrior. Slower movement, high HP. Forces Shield. HP: 130.',                                                         perk: 'Holy Light (≤25% HP): AoE healing pulse — heals self 20 HP, deals 15 dmg to nearby enemies.',                                    how:  'Block and bash. The perk punishes opponents who rush you when you\'re low.' },
  berserker: { title: 'Berserker',  what: 'Any-weapon brawler. Strong and sturdy. HP: 120.',                                                                                 perk: 'Blood Frenzy (≤15% HP): 3 seconds of +50% damage and ×1.4 speed.',                                                              how:  'Play aggressively and stack risk — the frenzy perk rewards surviving near death.' },
};
