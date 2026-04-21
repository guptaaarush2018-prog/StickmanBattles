// smb-boss-helpers.js
// Boss/TrueForm utility helpers: debug, TF arena mechanics, state reset, FallenGod class.
// Depends on: smb-globals.js, smb-boss-effects.js, smb-boss-cinematics.js
// Must load: AFTER smb-boss-effects.js, BEFORE smb-loop.js

// ============================================================
// TRUE FORM ADAPTIVE AI — DEBUG API
// Use via the game console (F1 → open console)
// ============================================================
function showAdaptationLevel() {
  const tf = players && players.find(p => p.isTrueForm);
  if (!tf) { console.warn('[TF-Adapt] No active TrueForm.'); return; }
  const al = tf.adaptationLevel.toFixed(1);
  const tier = al >= 90 ? 'PERFECTED' : al >= 75 ? 'MASTERED' : al >= 60 ? 'EVOLVED'
             : al >= 40 ? 'ADAPTING'  : al >= 20 ? 'LEARNING' : 'OBSERVING';
  console.log(`[TF-Adapt] Level: ${al}/100  Tier: ${tier}`);
  if (typeof showBossDialogue === 'function') showBossDialogue(`Adapt: ${al}% — ${tier}`, 180);
}

function showPlayerProfile() {
  const tf = players && players.find(p => p.isTrueForm);
  if (!tf) { console.warn('[TF-Adapt] No active TrueForm.'); return; }
  const p = tf._profile;
  console.log(
    '[TF-Adapt] Player Profile:\n' +
    `  Attack freq   : ${(p.attackFrequency  * 100).toFixed(0)}%\n` +
    `  Jump freq     : ${(p.jumpFrequency    * 100).toFixed(0)}%\n` +
    `  Dodge freq    : ${(p.dodgeFrequency   * 100).toFixed(0)}%\n` +
    `  Block freq    : ${(p.blockFrequency   * 100).toFixed(0)}%\n` +
    `  Pref. distance: ${p.distancePreference.toFixed(0)}px\n` +
    `  Repetition    : ${(p.repetitionScore  * 100).toFixed(0)}% predictable`
  );
  console.log(
    '[TF-Adapt] Behavior Multipliers:\n' +
    `  Dodge chance : ${(tf._adaptDodge * 100).toFixed(0)}%\n` +
    `  Atk frequency: ${(tf._adaptAtkFreq * 100).toFixed(0)}%\n` +
    `  Spacing      : ${tf._adaptSpacing.toFixed(0)}px\n` +
    `  Reaction lag : ${tf._adaptReact} ticks`
  );
}

function forceAdaptationLevel(value) {
  const tf = players && players.find(p => p.isTrueForm);
  if (!tf) { console.warn('[TF-Adapt] No active TrueForm.'); return; }
  tf.adaptationLevel = Math.max(0, Math.min(100, Number(value) || 0));
  // Force visual state update immediately
  tf._adaptOrbitMult = 1.0 + (tf.adaptationLevel / 100) * 1.4;
  tf._adaptGlowBoost = tf.adaptationLevel / 100;
  tf._adaptFlicker   = Math.max(0, (tf.adaptationLevel - 68) / 32);
  console.log(`[TF-Adapt] Forced adaptation level to ${tf.adaptationLevel.toFixed(1)}`);
  if (typeof showBossDialogue === 'function') showBossDialogue(`Forced: ${tf.adaptationLevel.toFixed(0)}%`, 150);
}

function tfWarpArena(key) {
  if (!ARENAS[key]) return;
  currentArenaKey = key;
  currentArena    = ARENAS[key];
  // Randomize layout if safe
  if (key !== 'lava') randomizeArenaLayout(key);
  generateBgElements();
  initMapPerks(key);
  // Reset floor state
  const floorPl = currentArena.platforms.find(p => p.isFloor);
  if (floorPl) floorPl.isFloorDisabled = false;
  tfFloorRemoved = false;
  if (settings.screenShake) screenShake = Math.max(screenShake, 22);
  spawnParticles(GAME_W / 2, GAME_H / 2, '#ffffff', 40);
}

function tfPortalTeleport(tf, target) {
  if (!target || !tf) return;
  const safePos = _bossFindSafeArenaPosition(tf, target.cx() + (target.facing || 1) * 48, target.y, {
    preferRaised: true,
    sideBias: target.facing || 1,
  });
  if (!safePos) {
    tf._finishAttackState && tf._finishAttackState('portal');
    return;
  }
  // Black portal flash
  spawnParticles(tf.cx(), tf.cy(), '#000000', 20);
  spawnParticles(tf.cx(), tf.cy(), '#ffffff', 10);
  setTimeout(() => {
    if (!gameRunning) return;
    const landed = _bossTeleportActor(tf, safePos.x + tf.w / 2, safePos.y, { preferRaised: true, sideBias: target.facing || 1 });
    if (!landed) {
      tf._finishAttackState && tf._finishAttackState('portal');
      return;
    }
    tf.facing = target.cx() > tf.cx() ? 1 : -1;
    spawnParticles(tf.cx(), tf.cy(), '#000000', 20);
    spawnParticles(tf.cx(), tf.cy(), '#ffffff', 10);
    if (settings.screenShake) screenShake = Math.max(screenShake, 12);
    tf._setAttackPhase && tf._setAttackPhase('recovery', 16, false);
  }, 350);
}

function tfSetSize(fighter, scale) {
  if (!fighter) return;
  // Restore original size first
  if (tfSizeTargets.has(fighter)) {
    const orig = tfSizeTargets.get(fighter);
    fighter.w = orig.w; fighter.h = orig.h;
  } else {
    tfSizeTargets.set(fighter, { w: fighter.w, h: fighter.h });
  }
  fighter.w        = Math.round(fighter.w * scale);
  fighter.h        = Math.round(fighter.h * scale);
  fighter.tfDrawScale = scale;
  fighter.drawScale   = scale;
}

function resetTFState() {
  forceResetGravity(); // clears gravityState, tfGravityInverted, tfGravityTimer

  tfControlsInverted    = false;
  tfControlsInvertTimer = 0;
  mirrorFlipped      = false; mirrorFlipTimer = 0; mirrorFlipWarning = 0;
  tfFloorRemoved     = false;
  tfFloorTimer       = 0;
  tfBlackHoles       = [];
  tfSizeTargets.clear();
  tfGravityWells     = [];
  tfMeteorCrash      = null;
  tfClones           = [];
  tfChainSlam        = null;
  tfGraspSlam        = null;
  tfDimensionPunch   = null;
  tfShockwaves       = [];
  tfPhaseShift       = null;
  tfRealityTear      = null;
  tfMathBubble       = null;
  tfCalcStrike       = null;
  tfGhostPaths       = null;
  tfRealityOverride  = null;
  tfGammaBeam        = null;
  tfBurnTrail        = null;
  tfNeutronStar      = null;
  tfGalaxySweep      = null;
  if (tfMultiverse) { tfMultiverse.shards && (tfMultiverse.shards.length = 0); tfMultiverse = null; }
  tfSupernova        = null;
  tfAttackRetryQueue = [];
  // Restore slow-motion if any attack left it in a reduced state
  if (slowMotion < 1.0) { slowMotion = 1.0; hitSlowTimer = 0; }
  // Reset dimension shift — always restore 2D on fight end
  if (tfDimensionIs3D) {
    tfDimensionIs3D = false;
    set3DView(settings.view3D ? 'settings' : false);
  }
  // Reset telegraph / warning system
  resetBossWarnings();
  // Restore void arena floor
  if (ARENAS.void) {
    const floorPl = ARENAS.void.platforms.find(p => p.isFloor);
    if (floorPl) floorPl.isFloorDisabled = false;
  }
  if (typeof resetQTEState === 'function') resetQTEState();
  // Reset intro-sequence state machine
  if (typeof tfCinematicState      !== 'undefined') tfCinematicState      = 'none';
  if (typeof paradoxDeathComplete  !== 'undefined') paradoxDeathComplete  = false;
  if (typeof absorptionComplete    !== 'undefined') absorptionComplete    = false;
  if (typeof tfAbsorptionScene     !== 'undefined') tfAbsorptionScene     = null;
  // Hide the controls-inverted DOM banner if it's still showing
  const _cib = document.getElementById('ctrlInvertedBanner');
  if (_cib) _cib.style.display = 'none';
}

// ============================================================
// FALLEN GOD  (Godfall arc boss — lore narrator / post-epilogue)
// ============================================================
class FallenGod extends Boss {
  constructor() {
    super();
    this.isFallenGod  = true;
    this.name         = 'FALLEN GOD';
    this.color        = '#ffaa00';
    // 1.5× the story-scaled health set by _startGameCore
    // (multiplied after construction, see smb-menu.js patch)
    this._healthMult  = 1.5;
    // Slightly slower beams — emphasises gravitas over speed
    this.beamCooldown = 36;
    this.minionCooldown = 24;
    // Unique draw tint (golden silhouette)
    this._fallenGodTint = true;
  }

  // Override draw to give a golden tint on top of base Boss rendering
  draw(ctx) {
    super.draw(ctx);
    if (!this._fallenGodTint) return;
    // Overlay a subtle golden rim around the entity
    ctx.save();
    ctx.globalAlpha = 0.18 + 0.08 * Math.sin(Date.now() / 400);
    ctx.fillStyle   = '#ffcc44';
    ctx.shadowColor = '#ffaa00';
    ctx.shadowBlur  = 24;
    ctx.fillRect(this.x - 4, this.y - 4, this.w + 8, this.h + 8);
    ctx.restore();
  }
}

// ── Axiom Origin Cutscene — plays after the Fallen God is defeated ────────────
// Full-screen canvas overlay, independent of the game loop (uses its own RAF).
// Draws Axiom's origin story in sequential scene "bursts", then calls onDoneCallback.
// CANON:
//   Axiom was a regular human who was robbed by someone far stronger.
//   He fought back and won. The feeling was unlike anything he'd known.
//   He became a hero, growing stronger as he saved others.
//   He found five others who had started the same way and shared his goals.
//   Together they fought an exceptionally strong enemy.
//   The battle caused a fracture — a tear in the universe itself.
//   They stepped through together. The fracture sealed behind them.
//   Void surrounded them. Yet they floated instead of falling.
//   Dark energy corrupted them all, making them unrecognisable to each other.
//   Each became the ruler of a branch. Five total. Endless war.
//   True Form controls one branch. Paradox is True Form's enemy (no branch).
function startAxiomOriginCutscene(onDoneCallback) {
  if (typeof document === 'undefined') { if (typeof onDoneCallback === 'function') onDoneCallback(); return; }

  // ── Overlay + canvas setup ─────────────────────────────────────────────────
  let ov = document.getElementById('_axiomCutsceneOv');
  if (!ov) {
    ov = document.createElement('div');
    ov.id = '_axiomCutsceneOv';
    ov.style.cssText = 'position:fixed;inset:0;background:#000;z-index:9998;display:none;';
    const cvs = document.createElement('canvas');
    cvs.id = '_axiomCutsceneCvs';
    cvs.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;';
    ov.appendChild(cvs);
    document.body.appendChild(ov);
  }
  ov.style.display = 'block';

  const cvs = document.getElementById('_axiomCutsceneCvs');
  cvs.width  = window.innerWidth;
  cvs.height = window.innerHeight;
  const ctx  = cvs.getContext('2d');
  const CW = cvs.width, CH = cvs.height;

  // ── Helpers ────────────────────────────────────────────────────────────────

  // Fade alpha for a scene: sf=sceneFrame (0..sd-1)
  function fade(sf, sd, ff) {
    ff = ff || 22;
    return Math.min(1, Math.min(sf / ff, (sd - sf) / ff));
  }

  // Simple stickman drawn with canvas angles: 0=right, π/2=down, π=left, −π/2=up
  function stick(cx, fy, h, col, opts) {
    opts = opts || {};
    const la  = opts.la !== undefined ? opts.la : Math.PI * 0.75;
    const ra  = opts.ra !== undefined ? opts.ra : Math.PI * 0.25;
    const ll  = opts.ll !== undefined ? opts.ll : Math.PI * 0.65;
    const rl  = opts.rl !== undefined ? opts.rl : Math.PI * 0.35;
    const lw  = opts.lw || Math.max(1.5, h * 0.045);
    const hr  = h * 0.12;
    const headCY    = fy - h * 0.88;
    const neckY     = fy - h * 0.76;
    const shoulderY = fy - h * 0.73;
    const hipY      = fy - h * 0.45;
    const armLen    = h * 0.22;
    const legLen    = h * 0.46;
    ctx.save();
    ctx.strokeStyle = col;
    ctx.lineWidth   = lw;
    ctx.lineCap     = 'round';
    ctx.lineJoin    = 'round';
    if (opts.shadow)  { ctx.shadowColor = opts.shadow; ctx.shadowBlur = opts.shadowBlur || 12; }
    ctx.beginPath(); ctx.arc(cx, headCY, hr, 0, Math.PI * 2);
    if (opts.filled)  { ctx.fillStyle = col; ctx.fill(); }
    ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, neckY); ctx.lineTo(cx, hipY); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, shoulderY);
    ctx.lineTo(cx + Math.cos(la) * armLen, shoulderY + Math.sin(la) * armLen); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, shoulderY);
    ctx.lineTo(cx + Math.cos(ra) * armLen, shoulderY + Math.sin(ra) * armLen); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, hipY);
    ctx.lineTo(cx + Math.cos(ll) * legLen, hipY + Math.sin(ll) * legLen); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, hipY);
    ctx.lineTo(cx + Math.cos(rl) * legLen, hipY + Math.sin(rl) * legLen); ctx.stroke();
    ctx.restore();
  }

  // Walk-cycle angle set
  function walk(t) {
    const s = Math.sin(t);
    return { la: Math.PI*0.75+s*0.35, ra: Math.PI*0.25-s*0.35, ll: Math.PI*0.65-s*0.25, rl: Math.PI*0.35+s*0.25 };
  }

  // Single caption line
  function cap(text, alpha, col, yf) {
    if (alpha <= 0) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.textAlign   = 'center';
    ctx.fillStyle   = col || '#cccccc';
    ctx.shadowColor = '#000'; ctx.shadowBlur = 10;
    ctx.font        = `${Math.round(CH * 0.038)}px Arial, sans-serif`;
    ctx.fillText(text, CW * 0.5, CH * (yf || 0.88));
    ctx.restore();
  }

  // Secondary caption line (smaller, dimmer)
  function cap2(text, alpha, col) {
    if (alpha <= 0) return;
    ctx.save();
    ctx.globalAlpha = alpha * 0.75;
    ctx.textAlign   = 'center';
    ctx.fillStyle   = col || '#888888';
    ctx.shadowColor = '#000'; ctx.shadowBlur = 8;
    ctx.font        = `${Math.round(CH * 0.030)}px Arial, sans-serif`;
    ctx.fillText(text, CW * 0.5, CH * 0.93);
    ctx.restore();
  }

  // Ground strip + fill below
  function ground(y, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha * 0.4;
    ctx.strokeStyle = '#2a2a3a'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CW, y); ctx.stroke();
    ctx.fillStyle = '#0a0a18';
    ctx.fillRect(0, y, CW, CH - y);
    ctx.restore();
  }

  // City skyline silhouette + window dots
  function skyline(alpha) {
    const bldgs = [
      [0.02,0.55,0.10,0.45],[0.13,0.44,0.09,0.56],[0.23,0.49,0.08,0.51],
      [0.32,0.40,0.10,0.60],[0.43,0.52,0.07,0.48],[0.51,0.43,0.11,0.57],
      [0.63,0.48,0.09,0.52],[0.73,0.38,0.12,0.62],[0.86,0.46,0.08,0.54],
      [0.95,0.52,0.05,0.48],
    ];
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#11112a';
    for (const [bx,by,bw,bh] of bldgs) ctx.fillRect(bx*CW, by*CH, bw*CW, bh*CH);
    ctx.fillStyle = 'rgba(255,220,80,0.28)';
    for (const [bx,by,bw,bh] of bldgs)
      for (let wy=by+0.04; wy<by+bh-0.04; wy+=0.07)
        for (let wx=bx+0.01; wx<bx+bw-0.01; wx+=0.03)
          ctx.fillRect(wx*CW, wy*CH, 0.014*CW, 0.038*CH);
    ctx.restore();
  }

  // Sparse void stars
  function stars(alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#3a4a55';
    for (let s = 0; s < 55; s++) {
      ctx.beginPath();
      ctx.arc(((s*137.5)%1)*CW, ((s*97.3+17)%1)*CH, Math.max(0.4,(s%3)*0.45), 0, Math.PI*2);
      ctx.fill();
    }
    ctx.restore();
  }

  // ── Scene definitions ──────────────────────────────────────────────────────
  // Each { dur: frames, fn(sf, sd) } — sf=0-based sceneFrame, sd=scene duration
  const ALLY_COLS = ['#4488ff','#ff6633','#33cc77','#bb44ff','#ffcc22'];

  const scenes = [

    // 0 — Title card (2s)
    { dur: 120, fn(sf, sd) {
      const a = fade(sf, sd);
      ctx.save(); ctx.globalAlpha = a; ctx.textAlign = 'center';
      ctx.fillStyle = '#ffcc44'; ctx.shadowColor = '#ffaa00'; ctx.shadowBlur = 30;
      ctx.font = `bold ${Math.round(CH*0.11)}px Arial`; ctx.fillText('AXIOM', CW*0.5, CH*0.46);
      ctx.shadowBlur = 0; ctx.fillStyle = '#666666';
      ctx.font = `${Math.round(CH*0.036)}px Arial`;
      ctx.fillText('Before the fracture.  Before the war.', CW*0.5, CH*0.60);
      ctx.restore();
    }},

    // 1 — City streets, Axiom walking (3s)
    { dur: 180, fn(sf, sd) {
      const a = fade(sf, sd);
      const GY = CH * 0.75, H = CH * 0.17;
      ctx.save(); ctx.globalAlpha = a; ctx.fillStyle='#080812'; ctx.fillRect(0,0,CW,CH); ctx.restore();
      ground(GY, a); skyline(a * 0.85);
      ctx.save(); ctx.globalAlpha = a;
      stick(CW*(0.18+sf/sd*0.36), GY, H, '#4488ff', walk(sf*0.14));
      ctx.restore();
      cap('He was just a man.', a, '#aaaaaa');
    }},

    // 2 — Robbery + fight (4s)
    { dur: 240, fn(sf, sd) {
      const a = fade(sf, sd);
      const GY = CH*0.75, H = CH*0.17;
      ctx.save(); ctx.globalAlpha=a; ctx.fillStyle='#070710'; ctx.fillRect(0,0,CW,CH); ctx.restore();
      ground(GY, a); skyline(a*0.5);
      const phase = sf < 120 ? 0 : 1;
      const pt    = phase===0 ? sf/120 : (sf-120)/120;
      ctx.save(); ctx.globalAlpha = a;
      if (phase === 0) {
        // Robber looms close, arm extended in threat
        stick(CW*(0.37-pt*0.02), GY, H*1.4, '#cc2222', {
          la: Math.PI*0.75, ra: -Math.PI*0.1, ll: Math.PI*0.6, rl: Math.PI*0.4,
        });
        // Axiom backing away, arms raised in surprise
        stick(CW*(0.56+pt*0.03), GY, H, '#4488ff', {
          la: Math.PI*0.8, ra: Math.PI*0.5, ll: Math.PI*0.6, rl: Math.PI*0.4,
        });
        ctx.globalAlpha = a * Math.min(1, sf/20);
        ctx.fillStyle='#ffee44'; ctx.textAlign='center';
        ctx.font=`bold ${Math.round(CH*0.05)}px Arial`;
        ctx.fillText('!', CW*(0.56+pt*0.03), GY-H*1.1-CH*0.03);
      } else {
        // Axiom punches forward
        stick(CW*0.5, GY, H, '#4488ff', {
          la: Math.PI*0.85, ra: 0.1, ll: Math.PI*0.55, rl: Math.PI*0.45,
        });
        // Robber knocked back, tipping over
        ctx.save();
        ctx.translate(CW*(0.34-pt*0.09), GY-H*1.4*0.5);
        ctx.rotate(pt * Math.PI * 0.5);
        stick(0, H*1.4*0.5, H*1.4, '#cc2222', {
          la: Math.PI*0.5, ra: Math.PI*0.5, ll: Math.PI*0.15, rl: Math.PI*0.85,
        });
        ctx.restore();
      }
      ctx.restore();
      cap(phase===0 ? 'He was robbed by someone far stronger.' : 'He fought back.  He won.', a, '#cccccc');
    }},

    // 3 — Awakening (3s)
    { dur: 180, fn(sf, sd) {
      const a  = fade(sf, sd);
      const GY = CH*0.72, H = CH*0.20;
      ctx.save(); ctx.globalAlpha=a; ctx.fillStyle='#060610'; ctx.fillRect(0,0,CW,CH); ctx.restore();
      ground(GY, a*0.5);
      const cx0=CW*0.5, cy0=GY-H*0.5;
      const pulse = 0.6 + 0.4*Math.sin(sf*0.12);
      const g = ctx.createRadialGradient(cx0,cy0,H*0.1,cx0,cy0,H*2.2);
      g.addColorStop(0,'rgba(80,130,255,0.55)'); g.addColorStop(1,'rgba(0,0,0,0)');
      ctx.save(); ctx.globalAlpha=a*pulse; ctx.fillStyle=g; ctx.fillRect(0,0,CW,CH); ctx.restore();
      ctx.save(); ctx.globalAlpha=a;
      // Arms raised in awakening/triumph
      stick(cx0, GY, H, '#88aaff', {
        la: Math.PI*1.25, ra: -Math.PI*0.25, ll: Math.PI*0.62, rl: Math.PI*0.38,
        shadow: '#4488ff', shadowBlur: 18,
      });
      ctx.strokeStyle='rgba(100,160,255,0.35)'; ctx.lineWidth=2;
      for (let i=0;i<8;i++) {
        const ang=i/8*Math.PI*2+sf*0.025, r0=H*0.55, r1=H*(1.1+0.28*Math.sin(sf*0.09+i*1.3));
        ctx.beginPath(); ctx.moveTo(cx0+Math.cos(ang)*r0,cy0+Math.sin(ang)*r0);
        ctx.lineTo(cx0+Math.cos(ang)*r1,cy0+Math.sin(ang)*r1); ctx.stroke();
      }
      ctx.restore();
      cap('Something awakened in him.', a, '#aabbff');
      cap2('He had never felt so alive.', a);
    }},

    // 4 — Hero rise (3s)
    { dur: 180, fn(sf, sd) {
      const a  = fade(sf, sd);
      const GY = CH*0.75, H = CH*0.17;
      ctx.save(); ctx.globalAlpha=a; ctx.fillStyle='#080a14'; ctx.fillRect(0,0,CW,CH); ctx.restore();
      ground(GY, a); skyline(a*0.7);
      ctx.save(); ctx.globalAlpha=a;
      for (let i=0;i<4;i++)
        stick(CW*(0.10+i*0.18), GY, H*0.65, '#444466', { la:Math.PI*0.7+0.3, ra:Math.PI*0.3-0.3 });
      stick(CW*(0.60+sf/sd*0.17), GY, H, '#5599ff', { ...walk(sf*0.18), shadow:'#2255cc', shadowBlur:10 });
      ctx.restore();
      cap('He chose to protect others.', a, '#aaccff');
      cap2('His strength grew.', a);
    }},

    // 5 — Meeting allies (3s)
    { dur: 180, fn(sf, sd) {
      const a  = fade(sf, sd);
      const GY = CH*0.75, H = CH*0.17;
      ctx.save(); ctx.globalAlpha=a; ctx.fillStyle='#06080f'; ctx.fillRect(0,0,CW,CH); ctx.restore();
      ground(GY, a);
      const xpos = [0.20,0.33,0.50,0.67,0.80];
      ctx.save();
      for (let i=0;i<5;i++) {
        const slide = Math.min(1, sf/(35+i*14));
        ctx.globalAlpha = a * slide;
        stick(CW*xpos[i], GY+H*(1-slide), H, ALLY_COLS[i], {
          la: Math.PI*(0.75+(i%2===0?0.1:-0.1)), ra: Math.PI*(0.25-(i%2===0?0.1:-0.1)),
        });
      }
      ctx.restore();
      cap('Others had walked the same path.', a, '#cccccc');
      cap2('They found each other.', a, '#888888');
    }},

    // 6 — The fracture (5s)
    { dur: 300, fn(sf, sd) {
      const a  = fade(sf, sd);
      const GY = CH*0.75, H = CH*0.17;
      ctx.save(); ctx.globalAlpha=a; ctx.fillStyle='#05050c'; ctx.fillRect(0,0,CW,CH); ctx.restore();
      ground(GY, a);
      ctx.save(); ctx.globalAlpha=a;
      const eH = H*2.2, shk = sf>180 ? Math.sin(sf*0.6)*(CW*0.003) : 0;
      stick(CW*0.83+shk, GY, eH, '#880011', { la:Math.PI*0.65, ra:Math.PI*0.35, lw:Math.max(2,eH*0.05) });
      for (let i=0;i<5;i++) {
        const s = Math.sin(sf*0.09+i*1.1)*0.28;
        stick(CW*(0.20+i*0.09), GY, H, ALLY_COLS[i], {
          la:Math.PI*0.75+s, ra:Math.PI*0.25-s, ll:Math.PI*0.65-s*0.5, rl:Math.PI*0.35+s*0.5,
        });
      }
      if (sf > 180) {
        const cp = Math.min(1,(sf-180)/75);
        const pts=[[CW*0.50,CH*0.07],[CW*0.48,CH*0.16],[CW*0.52,CH*0.24],[CW*0.49,CH*0.32],[CW*0.51,CH*0.40]];
        const vis = Math.round(cp*(pts.length-1))+1;
        ctx.globalAlpha=a*cp*0.3;
        const cg=ctx.createRadialGradient(CW*0.5,CH*0.24,5,CW*0.5,CH*0.24,CH*0.22);
        cg.addColorStop(0,'#aabbff'); cg.addColorStop(1,'rgba(0,0,0,0)');
        ctx.fillStyle=cg; ctx.fillRect(CW*0.3,0,CW*0.4,CH*0.5);
        ctx.globalAlpha=a*cp;
        ctx.strokeStyle='#ddeeff'; ctx.lineWidth=3.5; ctx.shadowColor='#88aaff'; ctx.shadowBlur=20;
        ctx.beginPath();
        for (let pi=0;pi<Math.min(vis,pts.length);pi++)
          pi===0?ctx.moveTo(pts[pi][0],pts[pi][1]):ctx.lineTo(pts[pi][0],pts[pi][1]);
        ctx.stroke(); ctx.shadowBlur=0;
      }
      ctx.restore();
      cap(sf<=180?'They faced something they could not overcome.':'The universe itself cracked.', a, sf<=180?'#cc8888':'#aaccff');
    }},

    // 7 — Through the fracture / void (4s)
    { dur: 240, fn(sf, sd) {
      const a   = fade(sf, sd);
      const vp  = Math.min(1, sf/160);
      ctx.fillStyle=`rgb(${Math.round(5+vp*2)},5,${Math.round(10+vp*3)})`; ctx.fillRect(0,0,CW,CH);
      const crackX=CW*0.5, crackY=CH*0.28, cAlpha=sf<160?1:Math.max(0,1-(sf-160)/60);
      const pts=[[crackX,crackY],[crackX-CW*0.02,crackY+CH*0.09],[crackX+CW*0.03,crackY+CH*0.17],
                 [crackX-CW*0.01,crackY+CH*0.25],[crackX+CW*0.02,crackY+CH*0.34]];
      ctx.save(); ctx.globalAlpha=a*cAlpha*0.55;
      const pg=ctx.createRadialGradient(crackX,crackY+CH*0.17,10,crackX,crackY+CH*0.17,CH*0.28);
      pg.addColorStop(0,'rgba(180,210,255,0.7)'); pg.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle=pg; ctx.fillRect(crackX-CH*0.3,crackY-CH*0.05,CH*0.6,CH*0.45); ctx.restore();
      ctx.save(); ctx.globalAlpha=a*cAlpha;
      ctx.strokeStyle='#ddeeff'; ctx.lineWidth=4; ctx.shadowColor='#aaccff'; ctx.shadowBlur=22;
      ctx.beginPath();
      for (let pi=0;pi<pts.length;pi++) pi===0?ctx.moveTo(pts[pi][0],pts[pi][1]):ctx.lineTo(pts[pi][0],pts[pi][1]);
      ctx.stroke(); ctx.restore();
      const GY=sf<160?CH*0.75:CH*0.75-(sf-160)/80*CH*0.15, H=CH*0.17;
      ctx.save();
      for (let i=0;i<5;i++) {
        const prog=Math.min(1,sf/(50+i*18));
        const px=CW*(0.08+i*0.11)+(crackX+(i-2)*CW*0.035-CW*(0.08+i*0.11))*prog;
        const fadeOut=prog>0.78?Math.max(0,1-(prog-0.78)/0.22):1;
        ctx.globalAlpha=a*fadeOut;
        stick(px, GY, H, ALLY_COLS[i], prog<1?walk(sf*0.12+i*0.7):{});
      }
      ctx.restore();
      if (sf > 185) {
        const vfa=Math.min(1,(sf-185)/45);
        stars(a*vfa*0.7);
        ctx.save();
        for (let i=0;i<5;i++) {
          ctx.globalAlpha=a*vfa*0.75;
          stick(CW*(0.18+i*0.16), CH*0.50+Math.sin(sf*0.04+i*1.2)*CH*0.03, H*0.95, ALLY_COLS[i], {});
        }
        ctx.restore();
      }
      const capT=sf<140?'They stepped through together.':sf<190?'The fracture sealed behind them.':'There was only void.  Yet they did not fall.';
      cap(capT, a, '#99bbdd');
    }},

    // 8 — Corruption (4s)
    { dur: 240, fn(sf, sd) {
      const a  = fade(sf, sd);
      const cp = Math.min(1, sf/190);
      const GY = CH*0.68, H = CH*0.18;
      ctx.fillStyle='#020005'; ctx.fillRect(0,0,CW,CH);
      stars(a*0.4);
      const dcols=['#112244','#441100','#004422','#220033','#332200'];
      const xpos=[0.15,0.30,0.50,0.70,0.85];
      ctx.save();
      for (let i=0;i<5;i++) {
        const px=CW*xpos[i], fy=GY+Math.sin(sf*0.04+i*1.2)*CH*0.02;
        const col=cp>0.65?dcols[i]:ALLY_COLS[i];
        ctx.globalAlpha=a;
        stick(px, fy, H, col, { filled: cp>0.65 });
        if (cp > 0.12) {
          const ta=Math.min(1,(cp-0.12)/0.6);
          ctx.globalAlpha=a*ta*0.7;
          ctx.strokeStyle='rgba(100,0,160,0.65)'; ctx.lineWidth=1.8;
          ctx.shadowColor='#7700bb'; ctx.shadowBlur=14;
          for (let j=0;j<7;j++) {
            const ang=j/7*Math.PI*2+sf*0.045+i*0.7;
            const r0=H*0.28, r1=H*(0.55+0.3*Math.sin(sf*0.08+j*1.1));
            const cy0=fy-H*0.5;
            ctx.beginPath(); ctx.moveTo(px+Math.cos(ang)*r0,cy0+Math.sin(ang)*r0);
            ctx.lineTo(px+Math.cos(ang)*r1,cy0+Math.sin(ang)*r1); ctx.stroke();
          }
          ctx.shadowBlur=0;
        }
      }
      ctx.restore();
      const cT=cp<0.35?"The void's power found them.":cp<0.70?'It did not leave.':'They became something else entirely.';
      cap(cT, a, `rgba(${Math.round(180-cp*100)},${Math.round(120-cp*80)},255,1)`);
    }},

    // 9 — Five branches / endless war (3.5s)
    { dur: 210, fn(sf, sd) {
      const a = fade(sf, sd);
      ctx.fillStyle='#030008'; ctx.fillRect(0,0,CW,CH);
      const rulers=[
        {col:'#ffffff',lc:'#dddddd',glow:'#aaaaaa',x:0.50,y:0.43,lbl:'True Form'},
        {col:'#ff4422',lc:'#ff9977',glow:'#ff4422',x:0.15,y:0.30,lbl:'Branch I'},
        {col:'#44aaff',lc:'#88ccff',glow:'#44aaff',x:0.85,y:0.30,lbl:'Branch II'},
        {col:'#44ff88',lc:'#88ffbb',glow:'#44ff88',x:0.22,y:0.72,lbl:'Branch III'},
        {col:'#ffaa00',lc:'#ffcc66',glow:'#ffaa00',x:0.78,y:0.72,lbl:'Branch IV'},
      ];
      const H=CH*0.19, lsz=Math.round(CH*0.026);
      ctx.save();
      for (let i=0;i<rulers.length;i++) {
        const r=rulers[i], slide=Math.min(1,sf/(25+i*18));
        const px=CW*r.x, py=CH*r.y+H*(1-slide);
        const g=ctx.createRadialGradient(px,py-H*0.5,5,px,py-H*0.5,H*1.3);
        g.addColorStop(0,r.glow+'44'); g.addColorStop(1,'rgba(0,0,0,0)');
        ctx.globalAlpha=a*slide*0.55; ctx.fillStyle=g; ctx.fillRect(px-H,py-H*1.5,H*2,H*2);
        ctx.globalAlpha=a*slide;
        stick(px, py, H, r.col, { filled:true, shadow:r.glow, shadowBlur:14 });
        if (slide>0.45) {
          ctx.globalAlpha=a*(slide-0.45)*2; ctx.textAlign='center';
          ctx.fillStyle=r.lc; ctx.shadowColor=r.glow; ctx.shadowBlur=8;
          ctx.font=`bold ${lsz}px Arial`;
          ctx.fillText(r.lbl, px, CH*r.y-H-CH*0.025); ctx.shadowBlur=0;
        }
      }
      if (sf > 100) {
        const la=Math.min(1,(sf-100)/55);
        ctx.globalAlpha=a*la*0.28; ctx.strokeStyle='#ff4444'; ctx.lineWidth=1.5;
        ctx.setLineDash([5,7]);
        for (const [ai,bi] of [[0,1],[0,2],[0,3],[0,4],[1,3],[2,4]]) {
          ctx.beginPath();
          ctx.moveTo(CW*rulers[ai].x,CH*rulers[ai].y-H*0.5);
          ctx.lineTo(CW*rulers[bi].x,CH*rulers[bi].y-H*0.5);
          ctx.stroke();
        }
        ctx.setLineDash([]);
      }
      ctx.restore();
      cap('Each took a branch.  Each became its ruler.', a, '#888888');
      cap2('Five rulers.  Endless war.', a*(sf>80?1:0), '#cc5533');
    }},

    // 10 — Epilogue (2.5s)
    { dur: 150, fn(sf, sd) {
      const a=fade(sf, sd, 30);
      ctx.fillStyle='#000'; ctx.fillRect(0,0,CW,CH);
      ctx.save(); ctx.globalAlpha=a; ctx.textAlign='center'; ctx.shadowColor='#000'; ctx.shadowBlur=10;
      ctx.fillStyle='#cccccc'; ctx.font=`bold ${Math.round(CH*0.042)}px Arial`;
      ctx.fillText('This is what True Form is.', CW*0.5, CH*0.42);
      ctx.fillStyle='#888888'; ctx.font=`${Math.round(CH*0.032)}px Arial`;
      ctx.fillText('This is what the Creator built over.', CW*0.5, CH*0.54);
      ctx.fillStyle='#666666'; ctx.font=`${Math.round(CH*0.026)}px Arial`;
      ctx.fillText('This is why you are here.', CW*0.5, CH*0.64);
      ctx.restore();
    }},
  ];

  const TOTAL = scenes.reduce((s, sc) => s + sc.dur, 0);
  let frame = 0, rafId = null;

  function tick() {
    ctx.clearRect(0, 0, CW, CH);
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, CW, CH);
    let rem = frame;
    for (const sc of scenes) {
      if (rem < sc.dur) { try { sc.fn(rem, sc.dur); } catch(e) { /* guard */ } break; }
      rem -= sc.dur;
    }
    frame++;
    if (frame >= TOTAL) {
      ov.style.display = 'none';
      if (typeof onDoneCallback === 'function') onDoneCallback();
    } else {
      rafId = requestAnimationFrame(tick);
    }
  }

  rafId = requestAnimationFrame(tick);
}

// ── 3D View helper ────────────────────────────────────────────────────────────
// mode: false = 2D, 'tf' = TrueForm dramatic 3D, 'settings' = gentle persistent 3D
function set3DView(mode) {
  const c = document.getElementById('gameCanvas');
  if (!c) return;
  c.classList.remove('view-3d', 'view-3d-tf');
  if (mode === 'tf')  c.classList.add('view-3d-tf');
  else if (mode)      c.classList.add('view-3d');
}
