'use strict';

// ============================================================
// FINISHER SYSTEM — CinematicManager-powered
// ============================================================
// Architecture:
//   triggerFinisher(attacker, target)
//     → picks a finisher definition
//     → sets activeFinisher { attacker, target, timer, def, data }
//     → sets activeCinematic sentinel (blocks processInput + AI)
//     → runs def.timeline via CinematicManager each frame
//
// Global hooks used:
//   activeCinematic   — blocks processInput() / updateAI()
//   slowMotion        — scales physics in Fighter.update()
//   cinematicCamOverride / cinematicZoomTarget / cinematicFocusX/Y
//   screenShake
// ============================================================

// ── Easing helpers ───────────────────────────────────────────
function _finLerp(a, b, t)  { return a + (b - a) * Math.max(0, Math.min(1, t)); }
function _finEaseOut(t)     { t = Math.max(0,Math.min(1,t)); return 1-(1-t)*(1-t); }
function _finEaseIn(t)      { t = Math.max(0,Math.min(1,t)); return t*t; }
function _finEaseInOut(t)   { t = Math.max(0,Math.min(1,t)); return t<0.5?2*t*t:1-Math.pow(-2*t+2,2)/2; }
function _finEaseBounce(t)  { t = Math.max(0,Math.min(1,t)); if(t<1/2.75) return 7.5625*t*t; if(t<2/2.75){ t-=1.5/2.75; return 7.5625*t*t+0.75; } if(t<2.5/2.75){ t-=2.25/2.75; return 7.5625*t*t+0.9375; } t-=2.625/2.75; return 7.5625*t*t+0.984375; }

// ── Canvas: game-space transform (use when drawing in game coords) ─
function _finGameTransform() {
  const bs = Math.min(canvas.width/GAME_W, canvas.height/GAME_H);
  const scX = bs * camZoomCur, scY = bs * camZoomCur;
  return { scX, scY, ox: canvas.width/2 - camXCur*scX, oy: canvas.height/2 - camYCur*scY };
}

// ── Canvas: impact lines ─────────────────────────────────────
function _finImpactLines(ctx, gx, gy, count, len, color, lw) {
  ctx.save();
  ctx.strokeStyle = color; ctx.lineWidth = lw || 2;
  ctx.shadowColor = color; ctx.shadowBlur = 12;
  for (let i = 0; i < count; i++) {
    const a = (i/count) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(gx + Math.cos(a)*len*0.25, gy + Math.sin(a)*len*0.25);
    ctx.lineTo(gx + Math.cos(a)*len,      gy + Math.sin(a)*len);
    ctx.stroke();
  }
  ctx.restore();
}

// ── Canvas: lightning bolt ───────────────────────────────────
function _finLightning(ctx, x1, y1, x2, y2, color, lw, segs) {
  segs = segs || 8;
  ctx.save();
  ctx.strokeStyle = color; ctx.lineWidth = lw || 3;
  ctx.shadowColor = color; ctx.shadowBlur = 18;
  ctx.beginPath(); ctx.moveTo(x1, y1);
  for (let i = 1; i <= segs; i++) {
    const t2 = i/segs;
    const j = i<segs ? (Math.random()-0.5)*24 : 0;
    ctx.lineTo(x1+(x2-x1)*t2+j, y1+(y2-y1)*t2+j);
  }
  ctx.stroke();
  ctx.restore();
}

// ── Canvas: screen flash (screen-space) ─────────────────────
function _finFlash(ctx, alpha, r, g, b) {
  if (alpha <= 0) return;
  ctx.save();
  ctx.setTransform(1,0,0,1,0,0);
  ctx.fillStyle = `rgba(${r||255},${g||255},${b||255},${Math.min(1,alpha)})`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.restore();
}

// ── Canvas: letterbox bars ───────────────────────────────────
function _finBars(ctx, progress) {
  const bh = canvas.height * 0.09 * Math.max(0, Math.min(1, progress));
  if (bh < 1) return;
  ctx.save(); ctx.setTransform(1,0,0,1,0,0);
  ctx.fillStyle = 'rgba(0,0,0,0.92)';
  ctx.fillRect(0, 0, canvas.width, bh);
  ctx.fillRect(0, canvas.height-bh, canvas.width, bh);
  ctx.restore();
}

// ── Canvas: finisher title card (screen-space) ───────────────
function _finTitle(ctx, name, t, accentColor) {
  const alpha = t < 0.18 ? t/0.18 : t > 0.68 ? Math.max(0,(0.82-t)/0.14) : 1;
  if (alpha <= 0) return;
  accentColor = accentColor || 'rgba(200,80,255,0.95)';
  ctx.save();
  ctx.setTransform(1,0,0,1,0,0);
  const cx = canvas.width/2, cy = canvas.height * 0.135;
  const tw = Math.min(canvas.width * 0.72, 540);
  const bh = canvas.height * 0.075;
  // pill background
  ctx.fillStyle = `rgba(0,0,0,${alpha*0.6})`;
  ctx.beginPath(); ctx.roundRect(cx-tw/2, cy-bh*0.6, tw, bh, bh/2); ctx.fill();
  // accent glow line
  ctx.strokeStyle = accentColor.replace(')',`,${alpha*0.7})`).replace('rgba(','rgba(').replace('0.95','0.7');
  ctx.lineWidth = 2;
  ctx.shadowColor = accentColor; ctx.shadowBlur = 16;
  ctx.beginPath(); ctx.moveTo(cx-tw*0.38, cy+bh*0.38); ctx.lineTo(cx+tw*0.38, cy+bh*0.38); ctx.stroke();
  // text
  ctx.shadowColor = accentColor; ctx.shadowBlur = 28;
  ctx.fillStyle = `rgba(255,255,255,${alpha})`;
  ctx.font = `900 ${Math.floor(canvas.width*0.042)}px Arial`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(name, cx, cy);
  ctx.restore();
}

// ── Canvas: dialogue subtitle (screen-space) ─────────────────
function _finSubtitle(ctx, text, t, yFrac) {
  const alpha = t < 0.15 ? t/0.15 : t > 0.7 ? Math.max(0,(0.85-t)/0.15) : 1;
  if (alpha <= 0) return;
  ctx.save();
  ctx.setTransform(1,0,0,1,0,0);
  const cx = canvas.width/2, cy = canvas.height*(yFrac||0.88);
  ctx.font = `italic ${Math.floor(canvas.width*0.022)}px Arial`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = 8;
  ctx.fillStyle = `rgba(220,220,220,${alpha})`;
  ctx.fillText(text, cx, cy);
  ctx.restore();
}

// ── Canvas: vignette (dark edges) ───────────────────────────
function _finVignette(ctx, alpha) {
  if (alpha <= 0) return;
  ctx.save(); ctx.setTransform(1,0,0,1,0,0);
  const grd = ctx.createRadialGradient(
    canvas.width/2, canvas.height/2, canvas.height*0.18,
    canvas.width/2, canvas.height/2, canvas.height*1.0
  );
  grd.addColorStop(0, 'rgba(0,0,0,0)');
  grd.addColorStop(1, `rgba(0,0,0,${Math.min(0.85, alpha)})`);
  ctx.fillStyle = grd; ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.restore();
}

// CinCam, _makeTimeline, _tickTimeline, _makeFinisherSentinel
// are all defined in smc-cinematics.js (loaded before this file).

// ── Per-character dialogue pools ─────────────────────────────
const _FIN_DIALOGUE = {
  trueform: [
    'I will uncode you.',
    'You are an error.',
    'Removed.',
    'You never existed.',
    'End of instance.',
  ],
  creator: [
    'I wrote you. I can delete you.',
    'Back to nothing.',
    'I designed your defeat.',
    'You had no say in this.',
    'This was never a fair fight.',
  ],
  yeti: [
    'CRUSH.',
    'BREAK.',
    'NOTHING.',
    'FALL.',
    'GONE.',
  ],
  beast: [
    "You don't belong here.",
    'The wild takes you.',
    'This is my domain.',
    'Nature always wins.',
    'Prey.',
  ],
};

// ============================================================
// BOSS FINISHER 1: VOID SLAM
// Theme: raw power — boss grabs player, lifts, slams
// ============================================================
const FIN_VOID_SLAM = {
  name: 'VOID SLAM',
  accentColor: 'rgba(140,0,220,1)',
  duration: 185,

  setup(att, tgt, data) {
    data.ax0 = att.x; data.ay0 = att.y;
    data.tx0 = tgt.x; data.ty0 = tgt.y;
    data.dir = att.x < tgt.x ? 1 : -1;
    data.midX = (att.cx() + tgt.cx()) / 2;
    data.bars = 0; // letterbox progress
    data.glitch = 0;
    data.liftH  = 130; // how high above start tgt is lifted
    // Snap boss to near target
    data.bossSnapX = data.tx0 - data.dir * 28;
    data.bossSnapY = data.ty0;
    // Target's peak position
    data.peakX = data.tx0;
    data.peakY = data.ty0 - data.liftH;
    // Shockwave
    data.shockR = 0;
    data.shockAlpha = 0;
    data.dialogue = _FIN_DIALOGUE.trueform[Math.floor(Math.random() * _FIN_DIALOGUE.trueform.length)];

    data.timeline = _makeTimeline([
      // Frame 0: freeze, zoom in, slow-mo
      { frame: 0, fn() {
          CinCam.zoomTo(1.25);
          CinCam.focusMidpoint(att, tgt);
          CinCam.slowMo(0.4);
          data.bars = 0;
      }},
      // Frame 15: bars fully in
      { frame: 15, fn() { data.bars = 1; } },
      // Frame 20: boss teleports behind player (instant)
      { frame: 20, fn() {
          att.x = data.bossSnapX;
          att.y = data.bossSnapY;
          att.vx = 0; att.vy = 0;
          CinCam.shake(14);
          spawnParticles(att.cx(), att.cy(), '#aa00ff', 18);
      }},
      // Frame 28: lift begins — slow-mo deepens
      { frame: 28, fn() { CinCam.slowMo(0.18); } },
      // Frame 55: at peak — pause briefly
      { frame: 55, fn() {
          CinCam.slowMo(0.08);
          CinCam.zoomTo(1.5);
          CinCam.focusMidpoint(att, tgt);
          CinCam.shake(8);
      }},
      // Frame 80: SLAM DOWN — full speed
      { frame: 80, fn() {
          CinCam.slowMo(1.0);
          CinCam.zoomTo(1.1);
      }},
      // Frame 105: impact — shockwave + heavy shake
      { frame: 105, fn() {
          data.shockR = 1;
          data.shockAlpha = 1;
          CinCam.shake(48);
          spawnParticles(data.tx0+tgt.w/2, data.ty0+tgt.h, '#aa00ff', 50);
          spawnParticles(data.tx0+tgt.w/2, data.ty0+tgt.h, '#ffffff', 20);
          spawnParticles(data.tx0+tgt.w/2, data.ty0+tgt.h, '#ff44ff', 25);
          CinCam.zoomTo(1.35);
          CinCam.focusPoint(data.tx0+tgt.w/2, data.ty0+tgt.h);
      }},
      // Frame 140: hold on crater, restore slow-mo
      { frame: 140, fn() {
          CinCam.zoomTo(1.0);
          CinCam.restore();
      }},
      // Frame 185: done
      { frame: 184, fn() { data.bars = 0; } },
    ]);
  },

  update(att, tgt, timer, data) {
    _tickTimeline(data.timeline, timer);

    // Bars lerp
    if (timer < 15)     data.bars = timer / 15;
    if (timer > 170)    data.bars = Math.max(0, (185 - timer) / 15);

    // Shockwave expand
    if (data.shockR > 0) {
      data.shockR += 12;
      data.shockAlpha = Math.max(0, data.shockAlpha - 0.03);
    }

    // Phase 1 (0-20): both hold
    if (timer <= 20) {
      tgt.x = data.tx0; tgt.y = data.ty0;
      att.x = data.ax0; att.y = data.ay0;

    // Phase 2 (20-55): boss grabs and lifts tgt
    } else if (timer <= 55) {
      const t2 = (timer - 20) / 35;
      tgt.x = _finLerp(data.tx0, data.peakX, _finEaseOut(t2));
      tgt.y = _finLerp(data.ty0, data.peakY, _finEaseOut(t2));
      att.x = data.bossSnapX;
      att.y = _finLerp(data.bossSnapY, data.bossSnapY - data.liftH*0.6, _finEaseOut(t2));

    // Phase 3 (55-80): held at peak
    } else if (timer <= 80) {
      tgt.x = data.peakX; tgt.y = data.peakY;

    // Phase 4 (80-105): slam down — fast
    } else if (timer <= 105) {
      const t2 = (timer - 80) / 25;
      tgt.y = _finLerp(data.peakY, data.ty0 + tgt.h*0.2, _finEaseIn(t2));
      tgt.x = data.peakX;
      // boss follows slam
      att.y = _finLerp(data.bossSnapY - data.liftH*0.6, data.bossSnapY, _finEaseIn(t2));

    // Phase 5 (105+): locked on floor
    } else {
      tgt.x = data.peakX; tgt.y = data.ty0 + tgt.h*0.2;
      att.x = data.bossSnapX; att.y = data.bossSnapY;
    }

    att.vx = 0; att.vy = 0;
    tgt.vx = 0; tgt.vy = 0;

    // Cinematic cam focus tracking (between events)
    if (timer > 28 && timer < 80) CinCam.focusMidpoint(att, tgt);
  },

  draw(ctx, att, tgt, t, timer, data) {
    const { scX, scY, ox, oy } = _finGameTransform();

    // Letterbox
    _finBars(ctx, data.bars);

    // Vignette
    _finVignette(ctx, Math.min(0.55, t * 2));

    // Purple aura around boss
    if (timer < 105) {
      const aura = Math.min(1, timer / 30);
      ctx.save(); ctx.setTransform(scX, 0, 0, scY, ox, oy);
      const grd = ctx.createRadialGradient(att.cx(), att.cy(), 8, att.cx(), att.cy(), 80);
      grd.addColorStop(0, `rgba(140,0,220,${aura * 0.35})`);
      grd.addColorStop(1, 'rgba(140,0,220,0)');
      ctx.shadowColor = '#aa00ff'; ctx.shadowBlur = 40 * aura;
      ctx.fillStyle = grd; ctx.beginPath();
      ctx.arc(att.cx(), att.cy(), 80, 0, Math.PI*2); ctx.fill();
      ctx.restore();
    }

    // Void chains: wavy lines from boss hand to player while lifting
    if (timer > 20 && timer < 105) {
      ctx.save(); ctx.setTransform(scX, 0, 0, scY, ox, oy);
      ctx.strokeStyle = `rgba(180,50,255,0.6)`; ctx.lineWidth = 2;
      ctx.shadowColor = '#aa00ff'; ctx.shadowBlur = 10;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        const cx1 = att.cx() + Math.sin(timer*0.18+i*2.1)*6;
        const cy1 = att.y + att.h*0.3;
        const cx2 = tgt.cx() + Math.sin(timer*0.22+i*1.7)*4;
        const cy2 = tgt.cy();
        ctx.moveTo(cx1, cy1);
        ctx.quadraticCurveTo(
          (cx1+cx2)/2 + Math.sin(timer*0.15+i*2.5)*20,
          (cy1+cy2)/2 + Math.cos(timer*0.19+i*1.3)*15,
          cx2, cy2
        );
        ctx.stroke();
      }
      ctx.restore();
    }

    // Impact shockwave
    if (data.shockR > 0 && data.shockAlpha > 0) {
      ctx.save(); ctx.setTransform(scX, 0, 0, scY, ox, oy);
      ctx.strokeStyle = `rgba(180,50,255,${data.shockAlpha})`;
      ctx.lineWidth = 6; ctx.shadowColor = '#aa00ff'; ctx.shadowBlur = 30;
      ctx.beginPath(); ctx.arc(data.peakX + tgt.w/2, data.ty0 + tgt.h*0.9, data.shockR, 0, Math.PI*2); ctx.stroke();
      _finImpactLines(ctx, data.peakX+tgt.w/2, data.ty0+tgt.h, 16, data.shockR*0.6, '#cc44ff', 3);
      ctx.restore();
    }

    // Flash on slam
    if (timer >= 105 && timer <= 113) {
      _finFlash(ctx, (113-timer)/8 * 0.85, 120, 0, 200);
    }

    _finTitle(ctx, 'VOID SLAM', t, 'rgba(160,40,255,1)');
    if (timer > 50 && timer < 130) _finSubtitle(ctx, `"${data.dialogue}"`, t);
  }
};

// ============================================================
// BOSS FINISHER 2: DIMENSIONAL PUNCH
// Theme: TrueForm punches player HORIZONTALLY through reality
// Player launches flat across screen, background transitions
// through multiple realms, stickmen watch in awe, player
// crashes into the CODE REALM to begin backstage phase.
// ============================================================
const FIN_REALITY_BREAK = {
  name: 'DIMENSIONAL PUNCH',
  accentColor: 'rgba(0,220,180,1)',
  duration: 270,

  setup(att, tgt, data) {
    data.ax0 = att.x; data.ay0 = att.y;
    data.tx0 = tgt.x; data.ty0 = tgt.y;
    // Direction away from attacker; prefer left if ambiguous
    data.dir = att.x < tgt.x ? 1 : -1;

    data.bars          = 0;
    data.glitchIntensity = 0;
    data.whiteAlpha    = 0;
    data.tearAlpha     = 0;
    data.bgPhase       = 0;   // 0=normal,1=forest,2=city,3=void,4=lava,5=ice,6=code
    data.codeRealm     = false;
    data.realmFadeT    = 0;   // 0-1, fade into current realm

    // Flat horizontal destination — player launched across reality
    data.launchX = data.tx0 + data.dir * 560;
    data.launchY = data.ty0;  // perfectly horizontal, no arc

    // Background stickmen: 6 figures spread across the screen
    data.bgStickmen = [];
    for (let i = 0; i < 6; i++) {
      data.bgStickmen.push({
        xFrac:  0.05 + i * 0.17 + (Math.random() - 0.5) * 0.06,
        yFrac:  0.62 + (Math.random() - 0.5) * 0.06,
        looking: false,
        fightOff: Math.random() * Math.PI * 2,
      });
    }

    data.dialogue = _FIN_DIALOGUE.trueform[Math.floor(Math.random() * _FIN_DIALOGUE.trueform.length)];

    data.timeline = _makeTimeline([
      // ── ACT 1: Approach ─────────────────────────────────────
      { frame: 0, fn() {
          CinCam.slowMo(0.25);
          CinCam.zoomTo(1.25);
          CinCam.focusMidpoint(att, tgt);
      }},
      { frame: 10, fn() { data.bars = 1; } },
      { frame:  8, fn() { data.glitchIntensity = 0.8; } },
      { frame: 16, fn() { data.glitchIntensity = 1.5; CinCam.shake(10); } },
      { frame: 24, fn() { data.glitchIntensity = 0.4; } },
      { frame: 30, fn() { data.glitchIntensity = 0; } },
      // ── ACT 2: TrueForm winds up punch ──────────────────────
      { frame: 68, fn() {
          data.glitchIntensity = 3.0;
          CinCam.shake(18);
          spawnParticles(tgt.cx(), tgt.cy(), '#00ffcc', 22);
      }},
      // ── ACT 3: IMPACT ───────────────────────────────────────
      { frame: 80, fn() {
          data.whiteAlpha = 1.0;
          data.glitchIntensity = 5;
          CinCam.shake(40);
          spawnParticles(tgt.cx(), tgt.cy(), '#ffffff', 50);
          spawnParticles(tgt.cx(), tgt.cy(), '#00ffcc', 25);
      }},
      // ── ACT 4: HORIZONTAL LAUNCH ────────────────────────────
      { frame: 90, fn() {
          CinCam.slowMo(1.0);
          data.glitchIntensity = 1.5;
          data.tearAlpha = 0.7;
          data.bgPhase = 0;
          CinCam.zoomTo(0.72);
          CinCam.focusOn(tgt);
      }},
      // Realm transitions every ~20 frames
      { frame: 100, fn() { data.bgPhase = 1; data.realmFadeT = 0; CinCam.shake(6); } },
      { frame: 118, fn() { data.bgPhase = 2; data.realmFadeT = 0; CinCam.shake(6); } },
      { frame: 136, fn() { data.bgPhase = 3; data.realmFadeT = 0; CinCam.shake(8); } },
      { frame: 154, fn() { data.bgPhase = 4; data.realmFadeT = 0; CinCam.shake(8); } },
      { frame: 172, fn() { data.bgPhase = 5; data.realmFadeT = 0; CinCam.shake(6); } },
      // Stickmen notice player at each realm transition
      { frame: 105, fn() { data.bgStickmen[0].looking = true; data.bgStickmen[3].looking = true; } },
      { frame: 125, fn() { data.bgStickmen[1].looking = true; data.bgStickmen[4].looking = true; } },
      { frame: 145, fn() { data.bgStickmen[2].looking = true; data.bgStickmen[5].looking = true; } },
      // ── ACT 5: CODE REALM CRASH ─────────────────────────────
      { frame: 190, fn() {
          data.bgPhase = 6;
          data.realmFadeT = 0;
          data.tearAlpha = 0;
          CinCam.shake(35);
          spawnParticles(data.launchX + tgt.w/2, data.launchY + tgt.h/2, '#00ff44', 50);
          spawnParticles(data.launchX + tgt.w/2, data.launchY + tgt.h/2, '#44ff88', 28);
      }},
      { frame: 200, fn() {
          data.codeRealm = true;
          CinCam.slowMo(0.18);
          CinCam.zoomTo(1.1);
          CinCam.focusOn(tgt);
      }},
      // ── ACT 6: Hold on CODE REALM, fade out ─────────────────
      { frame: 248, fn() { CinCam.zoomTo(1.0); CinCam.restore(); } },
      { frame: 258, fn() { data.bars = 0; } },
    ]);
  },

  update(att, tgt, timer, data) {
    _tickTimeline(data.timeline, timer);

    // Bars fade in/out
    if (timer < 10)    data.bars = timer / 10;
    if (timer > 258)   data.bars = Math.max(0, (270 - timer) / 12);

    // White flash decay
    if (data.whiteAlpha > 0) data.whiteAlpha = Math.max(0, data.whiteAlpha - 0.07);

    // Realm fade-in progress
    data.realmFadeT = Math.min(1, data.realmFadeT + 0.08);

    // Tear alpha: pulse during launch, zero after code realm hit
    if (timer >= 90 && timer < 190) {
      data.tearAlpha = Math.min(data.tearAlpha, 0.55 + Math.sin(timer * 0.35) * 0.22);
    } else if (timer >= 190) {
      data.tearAlpha = Math.max(0, data.tearAlpha - 0.06);
    }

    // ── Position update ──────────────────────────────────────
    // Phase 1 (0-30): freeze both
    if (timer <= 30) {
      att.x = data.ax0; att.y = data.ay0;
      tgt.x = data.tx0; tgt.y = data.ty0;

    // Phase 2 (30-78): TrueForm walks toward player, winding up
    } else if (timer <= 78) {
      const t2 = (timer - 30) / 48;
      att.x = _finLerp(data.ax0, data.tx0 - data.dir * 18, _finEaseInOut(t2));
      att.y = data.ay0;
      tgt.x = data.tx0; tgt.y = data.ty0;

    // Phase 3 (78-90): impact distort — player shakes in place
    } else if (timer <= 90) {
      const gi = Math.min(1, data.glitchIntensity / 4);
      tgt.x = data.tx0 + (Math.random() - 0.5) * 12 * gi;
      tgt.y = data.ty0 + (Math.random() - 0.5) *  5 * gi;

    // Phase 4 (90-192): FLAT HORIZONTAL LAUNCH across dimensions
    } else if (timer <= 192) {
      const t2 = (timer - 90) / 102;
      // Pure horizontal — only a tiny Y wobble that decays
      const wobble = Math.sin(timer * 0.28) * 6 * (1 - t2);
      tgt.x = _finLerp(data.tx0, data.launchX, _finEaseIn(t2));
      tgt.y = data.ty0 + wobble;

    // Phase 5 (192+): rest in code realm
    } else {
      tgt.x = data.launchX;
      tgt.y = data.launchY;
      att.x = data.tx0 - data.dir * 18;
      att.y = data.ay0;
    }

    att.vx = 0; att.vy = 0;
    tgt.vx = 0; tgt.vy = 0;
  },

  draw(ctx, att, tgt, t, timer, data) {
    const { scX, scY, ox, oy } = _finGameTransform();
    const W = canvas.width, H = canvas.height;

    _finBars(ctx, data.bars);
    _finVignette(ctx, 0.4);

    // ── REALM BACKGROUND TRANSITIONS (screen-space) ──────────
    if (timer >= 90 && data.bgPhase > 0) {
      ctx.save(); ctx.setTransform(1,0,0,1,0,0);

      const REALMS = [
        null,
        // 1: Forest
        { sky1:'#1c4d14', sky2:'#0c2808', gnd:'#2a5c18',
          label:'FOREST REALM', lc:'#88ff44' },
        // 2: City
        { sky1:'#0d1b3e', sky2:'#070f22', gnd:'#1a1a2a',
          label:'CITY REALM',   lc:'#6699ff' },
        // 3: Void
        { sky1:'#09001e', sky2:'#040010', gnd:'#14003a',
          label:'VOID REALM',   lc:'#bb44ff' },
        // 4: Lava
        { sky1:'#3d0500', sky2:'#1c0200', gnd:'#5c1800',
          label:'LAVA REALM',   lc:'#ff4422' },
        // 5: Ice
        { sky1:'#0a1e3a', sky2:'#040e1e', gnd:'#0e2a4c',
          label:'ICE REALM',    lc:'#88eeff' },
        // 6: Code Realm
        { sky1:'#000000', sky2:'#000a00', gnd:'#001200',
          label:'CODE REALM',   lc:'#00ff44' },
      ];

      const realm = REALMS[Math.min(data.bgPhase, REALMS.length - 1)];
      if (realm) {
        const fa = Math.min(0.88, data.realmFadeT * 0.88);
        // Sky gradient
        const grd = ctx.createLinearGradient(0, 0, 0, H * 0.8);
        grd.addColorStop(0, realm.sky1);
        grd.addColorStop(1, realm.sky2);
        ctx.globalAlpha = fa;
        ctx.fillStyle = grd;
        ctx.fillRect(0, 0, W, H);
        // Ground strip
        ctx.fillStyle = realm.gnd;
        ctx.fillRect(0, H * 0.76, W, H * 0.24);
        ctx.globalAlpha = 1;

        // Code realm: matrix rain
        if (data.bgPhase >= 6) {
          ctx.globalAlpha = fa * 0.6;
          ctx.fillStyle = '#00ff44';
          const fz = Math.max(10, Math.floor(14 * W / 900));
          ctx.font = `${fz}px monospace`;
          const chars = '01{}[]<>()アイウエオカキクケコ';
          for (let c = 0; c < 32; c++) {
            const cx2 = ((c * 31 + timer * 4) % W);
            const cy2 = ((c * 53 + timer * 7) % (H * 0.74));
            ctx.fillText(chars[(timer + c * 7) % chars.length], cx2, cy2);
          }
          ctx.globalAlpha = 1;
        }

        // Realm label — flash in at transition
        const labelAge = timer - (
          [0, 100, 118, 136, 154, 172, 190][Math.min(data.bgPhase, 6)]
        );
        const la = Math.min(1, labelAge / 6) * Math.max(0, 1 - (labelAge - 16) / 10);
        if (la > 0) {
          ctx.globalAlpha = la;
          ctx.fillStyle = realm.lc;
          ctx.shadowColor = realm.lc; ctx.shadowBlur = 18;
          ctx.font = `bold ${Math.max(11, Math.floor(13 * W / 900))}px monospace`;
          ctx.textAlign = 'center';
          ctx.fillText(`— ${realm.label} —`, W / 2, H * 0.14);
          ctx.textAlign = 'left';
          ctx.shadowBlur = 0;
          ctx.globalAlpha = 1;
        }
      }
      ctx.restore();
    }

    // ── BACKGROUND STICKMEN (screen-space) ───────────────────
    if (timer >= 100 && timer < 230) {
      ctx.save(); ctx.setTransform(1,0,0,1,0,0);
      const fadeIn  = Math.min(1, (timer - 100) / 18);
      const fadeOut = timer > 215 ? Math.max(0, 1 - (timer - 215) / 15) : 1;
      ctx.globalAlpha = fadeIn * fadeOut * 0.72;

      const sc2 = Math.min(W, H) / 680;
      const r   = 7 * sc2; // head radius

      data.bgStickmen.forEach((s) => {
        const bx  = s.xFrac * W;
        const by  = s.yFrac * H;
        const fp  = s.fightOff + timer * 0.075;
        const clr = s.looking ? '#ffcc44' : '#cccccc';

        ctx.strokeStyle = clr;
        ctx.lineWidth   = 2 * sc2;
        ctx.shadowColor = s.looking ? '#ffcc44' : 'transparent';
        ctx.shadowBlur  = s.looking ? 10 : 0;

        // Head
        ctx.beginPath(); ctx.arc(bx, by - r * 3.6, r, 0, Math.PI * 2); ctx.stroke();
        // Torso
        ctx.beginPath(); ctx.moveTo(bx, by - r * 2.6); ctx.lineTo(bx, by); ctx.stroke();

        if (s.looking) {
          // Arms raised in surprise — pointing in launch direction
          ctx.beginPath();
          ctx.moveTo(bx, by - r * 2.2);
          ctx.lineTo(bx - r * 2.8, by - r * 3.8); // arm up-left
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(bx, by - r * 2.2);
          ctx.lineTo(bx + r * 1.5, by - r * 1.2); // other arm out
          ctx.stroke();
          // Legs planted
          ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx - r * 1.1, by + r * 2.2); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + r * 1.1, by + r * 2.2); ctx.stroke();
        } else {
          // Fighting animation (two stickmen near each other)
          ctx.beginPath();
          ctx.moveTo(bx, by - r * 2.2);
          ctx.lineTo(bx + Math.cos(fp) * r * 2.6, by - r * 2.2 + Math.sin(fp) * r * 1.4);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(bx, by - r * 2.2);
          ctx.lineTo(bx - Math.cos(fp + 1.1) * r * 2.2, by - r * 2.2 + Math.sin(fp + 1.1) * r * 1.2);
          ctx.stroke();
          ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + Math.sin(fp) * r * 1.4, by + r * 2.2); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx - Math.sin(fp) * r * 1.4, by + r * 2.2); ctx.stroke();
        }
      });

      ctx.shadowBlur  = 0;
      ctx.globalAlpha = 1;
      ctx.restore();
    }

    // ── SCREEN TEARING (horizontal displaced strips) ─────────
    if (data.tearAlpha > 0 && timer >= 90 && timer < 200) {
      ctx.save(); ctx.setTransform(1,0,0,1,0,0);
      const tearCount = 3 + Math.floor(data.tearAlpha * 5);
      for (let i = 0; i < tearCount; i++) {
        const ty2 = ((i * 137 + timer * 4.3) % H);
        const th2 = 2 + Math.random() * 7;
        const tx2 = (Math.random() - 0.5) * W * 0.07;
        const hue = (timer * 9 + i * 55) % 360;
        ctx.globalAlpha = data.tearAlpha * 0.28;
        ctx.fillStyle   = `hsl(${hue},100%,65%)`;
        ctx.fillRect(tx2, ty2, W, th2);
      }
      ctx.globalAlpha = 1;
      ctx.restore();
    }

    // ── COLOR SHIFT OVERLAY ──────────────────────────────────
    if (timer >= 90 && timer < 196) {
      ctx.save(); ctx.setTransform(1,0,0,1,0,0);
      const hue = (timer * 7) % 360;
      ctx.globalAlpha = 0.06;
      ctx.fillStyle   = `hsl(${hue},100%,50%)`;
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
      ctx.restore();
    }

    // ── GLITCH SCANLINES (pre/post punch) ────────────────────
    if (data.glitchIntensity > 0) {
      ctx.save(); ctx.setTransform(1,0,0,1,0,0);
      const gi = Math.min(1, data.glitchIntensity / 4);
      for (let i = 0; i < 9; i++) {
        const gy2 = Math.random() * H;
        const gh  = 2 + Math.random() * 10;
        const gx2 = (Math.random() - 0.5) * W * 0.14 * gi;
        ctx.fillStyle = `rgba(0,255,200,${gi * 0.22})`;
        ctx.fillRect(gx2, gy2, W, gh);
      }
      ctx.restore();
    }

    // ── TRUEFORM ENERGY AURA (approach) ──────────────────────
    if (timer > 30 && timer < 95) {
      const ba = Math.min(1, (timer - 30) / 20);
      ctx.save(); ctx.setTransform(scX,0,0,scY,ox,oy);
      ctx.shadowColor = '#00ffcc'; ctx.shadowBlur = 38 * ba;
      const grd = ctx.createRadialGradient(att.cx(),att.cy(),5,att.cx(),att.cy(),70);
      grd.addColorStop(0, `rgba(0,220,160,${ba * 0.3})`);
      grd.addColorStop(1, 'rgba(0,220,160,0)');
      ctx.fillStyle = grd;
      ctx.beginPath(); ctx.arc(att.cx(),att.cy(),70,0,Math.PI*2); ctx.fill();
      ctx.restore();
    }

    // ── DISTORTION RINGS (wind-up) ───────────────────────────
    if (timer > 60 && timer < 90) {
      const ra = Math.min(1, (timer - 60) / 15);
      ctx.save(); ctx.setTransform(scX,0,0,scY,ox,oy);
      for (let i = 0; i < 4; i++) {
        const rr = 18 + i * 17 + Math.sin(timer * 0.3 + i) * 8;
        ctx.strokeStyle = `rgba(0,255,200,${ra * (0.65 - i * 0.13)})`;
        ctx.lineWidth   = 2 + i * 0.5;
        ctx.shadowColor = '#00ffcc'; ctx.shadowBlur = 12;
        ctx.beginPath(); ctx.arc(tgt.cx(), tgt.cy(), rr, 0, Math.PI*2); ctx.stroke();
      }
      ctx.restore();
    }

    // ── HORIZONTAL LAUNCH TRAIL ───────────────────────────────
    if (timer > 90 && timer < 195) {
      ctx.save(); ctx.setTransform(scX,0,0,scY,ox,oy);
      const trailStrength = Math.min(1, (timer - 90) / 25);
      // Afterimage streaks — purely horizontal
      for (let i = 0; i < 5; i++) {
        const ta2 = (0.52 - i * 0.09) * trailStrength;
        ctx.strokeStyle = `rgba(0,255,200,${ta2})`;
        ctx.lineWidth   = 4.5 - i * 0.7;
        ctx.shadowColor = '#00ffcc'; ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.moveTo(tgt.cx() + data.dir * i * 12, tgt.cy() + (i - 2) * 1.5);
        ctx.lineTo(tgt.cx() - data.dir * 90 * trailStrength * (1 - i * 0.08),
                   tgt.cy() + (i - 2) * 1.5);
        ctx.stroke();
      }
      // Origin shockwave ring expanding from punch point
      const swa = Math.max(0, 0.7 - (timer - 90) * 0.017);
      if (swa > 0) {
        const swr = (timer - 90) * 3;
        ctx.strokeStyle = `rgba(0,255,200,${swa})`;
        ctx.lineWidth   = 2.5;
        ctx.shadowColor = '#00ffcc'; ctx.shadowBlur = 18;
        ctx.beginPath(); ctx.arc(data.tx0 + tgt.w/2, data.ty0 + tgt.h/2, swr, 0, Math.PI*2); ctx.stroke();
      }
      ctx.restore();
    }

    // ── CODE REALM CRASH SHOCKWAVE ────────────────────────────
    if (data.codeRealm && timer >= 200) {
      ctx.save(); ctx.setTransform(scX,0,0,scY,ox,oy);
      const age = timer - 200;
      // Expanding ring
      const cr  = age * 4;
      const ca  = Math.max(0, 0.9 - age * 0.035);
      if (ca > 0) {
        ctx.strokeStyle = `rgba(0,255,68,${ca})`;
        ctx.lineWidth   = 3;
        ctx.shadowColor = '#00ff44'; ctx.shadowBlur = 22;
        ctx.beginPath(); ctx.arc(data.launchX + tgt.w/2, data.launchY + tgt.h/2, cr, 0, Math.PI*2); ctx.stroke();
        _finImpactLines(ctx, data.launchX + tgt.w/2, data.launchY + tgt.h/2, 10, cr * 0.65, '#00ff44', 2);
      }
      // Floor crack lines (green)
      if (age < 30) {
        const cra = Math.max(0, 1 - age / 30);
        ctx.strokeStyle = `rgba(0,220,50,${cra * 0.7})`;
        ctx.lineWidth = 1.5; ctx.shadowColor = '#00ff44'; ctx.shadowBlur = 10;
        for (let i = 0; i < 6; i++) {
          const ang = (i / 6) * Math.PI * 2 + Math.PI * 0.1;
          const len = (30 + i * 12) * Math.min(1, age / 10);
          ctx.beginPath();
          ctx.moveTo(data.launchX + tgt.w/2, data.launchY + tgt.h);
          ctx.lineTo(data.launchX + tgt.w/2 + Math.cos(ang) * len,
                     data.launchY + tgt.h   + Math.sin(ang) * len * 0.4);
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    // ── WHITE FLASH ──────────────────────────────────────────
    if (data.whiteAlpha > 0) {
      _finFlash(ctx, data.whiteAlpha, 220, 255, 240);
    }

    _finTitle(ctx, 'DIMENSIONAL PUNCH', t, 'rgba(0,220,180,1)');
    if (timer > 38 && timer < 170) _finSubtitle(ctx, `"${data.dialogue}"`, t);
  }
};

// ============================================================
// BOSS FINISHER 3: SKY EXECUTION
// Theme: aerial — boss launches player up, kicks down
// ============================================================
const FIN_SKY_EXECUTION = {
  name: 'SKY EXECUTION',
  accentColor: 'rgba(255,120,0,1)',
  duration: 200,

  setup(att, tgt, data) {
    data.ax0 = att.x; data.ay0 = att.y;
    data.tx0 = tgt.x; data.ty0 = tgt.y;
    data.dir = att.x < tgt.x ? 1 : -1;
    data.bars   = 0;
    data.peakY  = Math.min(data.ty0, 60);  // apex of launch
    data.landY  = data.ty0 + 40;           // crash-landing Y
    data.shockR = 0; data.shockAlpha = 0;
    data.bossAppearedAbove = false;
    data.bossAboveX = data.tx0 + data.dir * 5;
    data.bossAboveY = data.peakY - 60;
    data.dialogue = _FIN_DIALOGUE.creator[Math.floor(Math.random() * _FIN_DIALOGUE.creator.length)];

    data.timeline = _makeTimeline([
      { frame: 0, fn() {
          CinCam.slowMo(0.35);
          CinCam.zoomTo(1.15);
          CinCam.focusMidpoint(att, tgt);
          data.bars = 0;
      }},
      { frame: 12, fn() { data.bars = 1; } },
      // Boss uppercuts — launches player
      { frame: 25, fn() {
          CinCam.shake(22);
          spawnParticles(att.cx(), att.cy(), '#ff8800', 20);
      }},
      // Follow player rising
      { frame: 30, fn() {
          CinCam.zoomTo(1.35);
          CinCam.focusOn(tgt);
          CinCam.slowMo(0.12); // deep slow-mo at apex
      }},
      // Boss appears above player
      { frame: 65, fn() {
          data.bossAppearedAbove = true;
          CinCam.focusMidpoint(att, tgt);
          spawnParticles(data.bossAboveX+att.w/2, data.bossAboveY, '#ff4400', 16);
          CinCam.shake(10);
      }},
      // Kick — burst of speed
      { frame: 80, fn() {
          CinCam.slowMo(1.0);
          CinCam.zoomTo(1.0);
      }},
      // Camera follows downward crash
      { frame: 85, fn() { CinCam.focusOn(tgt); } },
      // CRASH
      { frame: 128, fn() {
          data.shockR = 1; data.shockAlpha = 1;
          CinCam.shake(55);
          spawnParticles(data.tx0+tgt.w/2, data.landY, '#ff6600', 60);
          spawnParticles(data.tx0+tgt.w/2, data.landY, '#ffff00', 20);
          spawnParticles(data.tx0+tgt.w/2, data.landY, '#ffffff', 15);
          CinCam.zoomTo(1.3);
          CinCam.focusPoint(data.tx0+tgt.w/2, data.landY);
      }},
      { frame: 160, fn() {
          CinCam.zoomTo(1.0);
          CinCam.restore();
      }},
      { frame: 185, fn() { data.bars = 0; } },
    ]);
  },

  update(att, tgt, timer, data) {
    _tickTimeline(data.timeline, timer);

    if (timer < 12)     data.bars = timer/12;
    if (timer > 185)    data.bars = Math.max(0,(200-timer)/15);

    if (data.shockR > 0) {
      data.shockR += 14;
      data.shockAlpha = Math.max(0, data.shockAlpha - 0.028);
    }

    // Phase 1 (0-25): build up, hold
    if (timer <= 25) {
      att.x = data.ax0; att.y = data.ay0;
      tgt.x = data.tx0; tgt.y = data.ty0;

    // Phase 2 (25-65): player launched upward, slow-mo
    } else if (timer <= 65) {
      const t2 = (timer-25)/40;
      tgt.x = data.tx0;
      tgt.y = _finLerp(data.ty0, data.peakY, _finEaseOut(t2));
      // Boss stays below
      att.x = data.ax0; att.y = data.ay0;

    // Phase 3 (65-80): boss appears above, both at apex
    } else if (timer <= 80) {
      tgt.x = data.tx0; tgt.y = data.peakY;
      att.x = data.bossAboveX;
      att.y = _finLerp(data.bossAboveY - 40, data.bossAboveY, _finEaseOut((timer-65)/15));

    // Phase 4 (80-128): boss kicks player downward
    } else if (timer <= 128) {
      const t2 = (timer-80)/48;
      tgt.y = _finLerp(data.peakY, data.landY, _finEaseIn(t2));
      tgt.x = data.tx0 + data.dir * _finEaseIn(t2) * 15;
      // boss follows slightly
      att.y = _finLerp(data.bossAboveY, data.bossAboveY + 60, _finEaseIn(t2));
      att.x = data.bossAboveX;

    // Phase 5 (128+): both landed
    } else {
      tgt.x = data.tx0 + data.dir*15; tgt.y = data.landY;
      att.x = data.bossAboveX; att.y = data.bossAboveY + 60;
    }

    att.vx = 0; att.vy = 0; tgt.vx = 0; tgt.vy = 0;
  },

  draw(ctx, att, tgt, t, timer, data) {
    const { scX, scY, ox, oy } = _finGameTransform();

    _finBars(ctx, data.bars);
    _finVignette(ctx, 0.45);

    // Orange fire aura on boss
    if (timer < 135) {
      ctx.save(); ctx.setTransform(scX,0,0,scY,ox,oy);
      const fa = Math.min(1, timer/20);
      const grd = ctx.createRadialGradient(att.cx(),att.cy(),5,att.cx(),att.cy(),75);
      grd.addColorStop(0,`rgba(255,120,0,${fa*0.32})`);
      grd.addColorStop(1,'rgba(255,60,0,0)');
      ctx.shadowColor='#ff6600'; ctx.shadowBlur=40*fa;
      ctx.fillStyle=grd; ctx.beginPath();
      ctx.arc(att.cx(),att.cy(),75,0,Math.PI*2); ctx.fill();
      ctx.restore();
    }

    // Rising trail lines
    if (timer > 25 && timer < 70) {
      ctx.save(); ctx.setTransform(scX,0,0,scY,ox,oy);
      const ta = Math.min(1,(timer-25)/15);
      for (let i = 0; i < 4; i++) {
        ctx.strokeStyle = `rgba(255,${120+i*30},0,${ta*(0.6-i*0.1)})`;
        ctx.lineWidth = 4-i;
        ctx.shadowColor='#ff8800'; ctx.shadowBlur=10;
        ctx.beginPath();
        ctx.moveTo(tgt.cx()+(i-2)*5, tgt.y + tgt.h);
        ctx.lineTo(tgt.cx()+(i-2)*5, tgt.y + tgt.h + 35 + i*8);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Sky flash at apex
    if (timer >= 65 && timer <= 72) {
      _finFlash(ctx, (72-timer)/7 * 0.5, 255, 140, 20);
    }

    // Falling speed lines
    if (timer > 80 && timer < 128) {
      ctx.save(); ctx.setTransform(scX,0,0,scY,ox,oy);
      const fa2 = Math.min(1,(timer-80)/15);
      for (let i = 0; i < 8; i++) {
        const lx = tgt.cx() + (Math.random()-0.5)*120;
        ctx.strokeStyle = `rgba(255,${80+Math.random()*80},0,${fa2*0.4})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(lx, tgt.y - 50); ctx.lineTo(lx, tgt.y + 30); ctx.stroke();
      }
      ctx.restore();
    }

    // Impact shockwave
    if (data.shockR > 0 && data.shockAlpha > 0) {
      ctx.save(); ctx.setTransform(scX,0,0,scY,ox,oy);
      ctx.strokeStyle = `rgba(255,120,0,${data.shockAlpha})`;
      ctx.lineWidth = 7; ctx.shadowColor='#ff6600'; ctx.shadowBlur=35;
      ctx.beginPath(); ctx.arc(data.tx0+tgt.w/2+data.dir*15, data.landY+tgt.h*0.8, data.shockR, 0, Math.PI*2); ctx.stroke();
      _finImpactLines(ctx, data.tx0+tgt.w/2+data.dir*15, data.landY+tgt.h, 18, data.shockR*0.55, '#ffaa00', 4);
      ctx.restore();
    }
    // Crash flash
    if (timer >= 128 && timer <= 137) {
      _finFlash(ctx, (137-timer)/9 * 0.88, 255, 140, 0);
    }

    _finTitle(ctx, 'SKY EXECUTION', t, 'rgba(255,120,0,1)');
    if (timer > 55 && timer < 140) _finSubtitle(ctx, `"${data.dialogue}"`, t);
  }
};

// ============================================================
// BOSS FINISHER 4: DARKNESS FALLS  (boss kills player — alt)
// ============================================================
const FIN_DARKNESS_FALLS = {
  name: 'DARKNESS FALLS',
  accentColor: 'rgba(200,0,50,1)',
  duration: 130,

  setup(att, tgt, data) {
    data.ax0 = att.x; data.ay0 = att.y;
    data.tx0 = tgt.x; data.ty0 = tgt.y;
    data.dir = att.x < tgt.x ? 1 : -1;
    data.bars = 0; data.shockR = 0; data.shockAlpha = 0;
    data.bossSnapX = data.tx0 - data.dir*30;
    data.dialogue = _FIN_DIALOGUE.creator[Math.floor(Math.random() * _FIN_DIALOGUE.creator.length)];

    data.timeline = _makeTimeline([
      { frame: 0, fn() {
          CinCam.slowMo(0.3);
          CinCam.zoomTo(1.2);
          CinCam.focusMidpoint(att, tgt);
      }},
      { frame: 10, fn() { data.bars = 1; } },
      { frame: 22, fn() {
          att.x = data.bossSnapX; att.y = data.ay0;
          att.vx = 0; att.vy = 0;
          CinCam.shake(12);
          spawnParticles(att.cx(), att.cy(), '#cc0000', 14);
      }},
      { frame: 50, fn() {
          CinCam.zoomTo(1.45);
          CinCam.focusMidpoint(att, tgt);
          CinCam.slowMo(0.08);
      }},
      { frame: 68, fn() {
          CinCam.slowMo(1.0);
          CinCam.zoomTo(1.0);
      }},
      { frame: 88, fn() {
          data.shockR = 1; data.shockAlpha = 1;
          CinCam.shake(42);
          spawnParticles(data.tx0+tgt.w/2, data.ty0+tgt.h, '#cc0000', 45);
          spawnParticles(data.tx0+tgt.w/2, data.ty0+tgt.h, '#ff4444', 20);
      }},
      { frame: 110, fn() { CinCam.restore(); } },
      { frame: 118, fn() { data.bars = 0; } },
    ]);
  },

  update(att, tgt, timer, data) {
    _tickTimeline(data.timeline, timer);
    if (timer < 10) data.bars = timer/10;
    if (timer > 118) data.bars = Math.max(0,(130-timer)/12);
    if (data.shockR > 0) { data.shockR += 11; data.shockAlpha = Math.max(0,data.shockAlpha-0.034); }

    if (timer <= 22) {
      att.x = data.ax0; att.y = data.ay0; tgt.x = data.tx0; tgt.y = data.ty0;
    } else if (timer <= 50) {
      tgt.x = data.tx0 + Math.sin(timer*1.9)*3*(1-(timer-22)/28);
      tgt.y = data.ty0 + Math.sin(timer*2.4)*2;
    } else if (timer <= 68) {
      const t2=(timer-50)/18;
      tgt.y = data.ty0 + _finEaseIn(t2)*210;
    } else {
      tgt.x = data.tx0; tgt.y = data.ty0+210;
      att.x = data.bossSnapX; att.y = data.ay0;
    }
    att.vx=0;att.vy=0;tgt.vx=0;tgt.vy=0;
  },

  draw(ctx, att, tgt, t, timer, data) {
    const { scX, scY, ox, oy } = _finGameTransform();
    _finBars(ctx, data.bars);
    ctx.save(); ctx.setTransform(1,0,0,1,0,0);
    ctx.fillStyle=`rgba(0,0,0,${Math.min(0.5,t*1.8)})`;
    ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.restore();
    // Red aura
    if (timer < 88) {
      ctx.save(); ctx.setTransform(scX,0,0,scY,ox,oy);
      const ra=Math.min(1,timer/25);
      ctx.shadowColor='#cc0000'; ctx.shadowBlur=44*ra;
      const grd=ctx.createRadialGradient(att.cx(),att.cy(),8,att.cx(),att.cy(),68);
      grd.addColorStop(0,`rgba(200,0,0,${ra*0.3})`);
      grd.addColorStop(1,'rgba(200,0,0,0)');
      ctx.fillStyle=grd; ctx.beginPath();
      ctx.arc(att.cx(),att.cy(),68,0,Math.PI*2); ctx.fill();
      ctx.restore();
    }
    if (data.shockR > 0 && data.shockAlpha > 0) {
      ctx.save(); ctx.setTransform(scX,0,0,scY,ox,oy);
      ctx.strokeStyle=`rgba(200,0,0,${data.shockAlpha})`; ctx.lineWidth=5;
      ctx.shadowColor='#ff0000'; ctx.shadowBlur=28;
      ctx.beginPath(); ctx.arc(data.tx0+tgt.w/2,data.ty0+210,data.shockR,0,Math.PI*2); ctx.stroke();
      _finImpactLines(ctx,data.tx0+tgt.w/2,data.ty0+210+tgt.h,12,data.shockR*0.6,'#ff2200',3);
      ctx.restore();
    }
    if (timer>=68&&timer<=76) _finFlash(ctx,(76-timer)/8*0.82,200,40,40);
    if (timer>28&&timer<115) _finSubtitle(ctx,`"${data.dialogue}"`,t);
    _finTitle(ctx,'DARKNESS FALLS',t,'rgba(200,0,50,1)');
  }
};

// ============================================================
// PLAYER KILLS BOSS: HERO'S TRIUMPH
// ============================================================
const FIN_HEROS_TRIUMPH = {
  name: "HERO'S TRIUMPH",
  accentColor: 'rgba(255,210,40,1)',
  duration: 145,

  setup(att, tgt, data) {
    data.ax0=att.x; data.ay0=att.y;
    data.tx0=tgt.x; data.ty0=tgt.y;
    data.dir=att.x<tgt.x?1:-1;
    data.bars=0; data.pillarAlpha=0; data.shockR=0; data.shockAlpha=0;

    data.timeline = _makeTimeline([
      { frame:0, fn() {
          CinCam.slowMo(0.25); CinCam.zoomTo(1.2);
          CinCam.focusMidpoint(att,tgt); data.bars=0;
      }},
      { frame:10, fn() { data.bars=1; }},
      { frame:35, fn() {
          CinCam.slowMo(1.0);
          const d2=att.x<tgt.x?1:-1;
          att.x=data.ax0+d2*_finEaseOut(1)*55;
          CinCam.shake(20);
          data.pillarAlpha=1;
          data.shockR=1; data.shockAlpha=1;
          spawnParticles(att.cx(),att.cy(),'#ffdd44',50);
          spawnParticles(att.cx(),att.cy(),'#ffffff',22);
      }},
      { frame:36, fn() { CinCam.zoomTo(1.4); CinCam.focusMidpoint(att,tgt); }},
      { frame:70, fn() {
          CinCam.zoomTo(1.0);
          CinCam.restore();
      }},
      { frame:130, fn() { data.bars=0; }},
    ]);
  },

  update(att, tgt, timer, data) {
    _tickTimeline(data.timeline, timer);
    if (timer<10) data.bars=timer/10;
    if (timer>130) data.bars=Math.max(0,(145-timer)/15);
    if (data.shockR>0){ data.shockR+=13; data.shockAlpha=Math.max(0,data.shockAlpha-0.032); }
    if (data.pillarAlpha>0) data.pillarAlpha=Math.max(0,data.pillarAlpha-0.008);

    if (timer<=35) {
      const t2=timer/35;
      tgt.x=data.tx0+data.dir*_finEaseOut(t2)*80;
      tgt.y=data.ty0+_finEaseOut(t2)*35;
      att.x=data.ax0; att.y=data.ay0;
    } else if (timer<=70) {
      const t2=(timer-35)/35;
      tgt.x=data.tx0+data.dir*80+data.dir*_finEaseIn(t2)*40;
      tgt.y=data.ty0+35+_finEaseIn(t2)*160;
      att.x=data.ax0+data.dir*_finEaseOut(t2)*55;
    } else {
      tgt.x=data.tx0+data.dir*120; tgt.y=data.ty0+195;
      att.x=data.ax0+data.dir*55; att.y=data.ay0;
    }
    att.vx=0;att.vy=0;tgt.vx=0;tgt.vy=0;
  },

  draw(ctx, att, tgt, t, timer, data) {
    const { scX, scY, ox, oy } = _finGameTransform();
    _finBars(ctx, data.bars);
    _finVignette(ctx, 0.3);
    if (data.pillarAlpha>0) {
      ctx.save(); ctx.setTransform(scX,0,0,scY,ox,oy);
      const grd=ctx.createLinearGradient(att.cx(),att.y-220,att.cx(),att.y+att.h);
      grd.addColorStop(0,'rgba(255,220,60,0)');
      grd.addColorStop(0.5,`rgba(255,220,60,${data.pillarAlpha*0.4})`);
      grd.addColorStop(1,'rgba(255,220,60,0)');
      ctx.fillStyle=grd; ctx.fillRect(att.cx()-28,att.y-220,56,att.h+220);
      ctx.restore();
    }
    if (data.shockR>0&&data.shockAlpha>0) {
      ctx.save(); ctx.setTransform(scX,0,0,scY,ox,oy);
      ctx.strokeStyle=`rgba(255,220,60,${data.shockAlpha})`; ctx.lineWidth=5+data.shockAlpha*4;
      ctx.shadowColor='#ffdd44'; ctx.shadowBlur=30;
      ctx.beginPath(); ctx.arc(att.cx(),att.cy(),data.shockR,0,Math.PI*2); ctx.stroke();
      _finImpactLines(ctx,att.cx(),att.cy(),10,data.shockR*0.6,'#ffe066',3);
      ctx.restore();
    }
    if (timer>=35&&timer<=43) _finFlash(ctx,(43-timer)/8*0.72,255,240,120);
    // Gold letterbox hold
    if (timer>70) {
      const ga=Math.min(1,(timer-70)/20);
      const bh2=canvas.height*0.09*ga;
      ctx.save(); ctx.setTransform(1,0,0,1,0,0);
      ctx.fillStyle=`rgba(160,120,0,${ga*0.8})`;
      ctx.fillRect(0,0,canvas.width,bh2);
      ctx.fillRect(0,canvas.height-bh2,canvas.width,bh2);
      ctx.restore();
    }
    _finTitle(ctx,"HERO'S TRIUMPH",t,'rgba(255,210,40,1)');
  }
};

// ============================================================
// TRUE FORM FINISHER 3: ERASURE
// Theme: target glitches out of existence — cold, inevitable
// ============================================================
const FIN_TF_ERASURE = {
  name: 'ERASURE',
  accentColor: 'rgba(180,180,255,1)',
  duration: 150,
  setup(att, tgt, data) {
    data.ax0=att.x; data.ay0=att.y; data.tx0=tgt.x; data.ty0=tgt.y;
    data.dir=att.x<tgt.x?1:-1; data.bars=0; data.glitch=0; data.eraseAlpha=0;
    data.dialogue=_FIN_DIALOGUE.trueform[Math.floor(Math.random()*_FIN_DIALOGUE.trueform.length)];
    data.tl=_makeTimeline([
      {frame:0, fn(){CinCam.slowMo(0.2);CinCam.zoomTo(1.3);CinCam.focusMidpoint(att,tgt);}},
      {frame:10, fn(){data.bars=1;}},
      {frame:18, fn(){data.glitch=1.5;CinCam.shake(8);}},
      {frame:30, fn(){data.glitch=0.5;CinCam.focusOn(tgt);CinCam.zoomTo(1.6);}},
      {frame:60, fn(){data.glitch=2.5;CinCam.shake(14);spawnParticles(tgt.cx(),tgt.cy(),'#aaaaff',20);}},
      {frame:80, fn(){data.eraseAlpha=1;data.glitch=4;CinCam.shake(22);spawnParticles(tgt.cx(),tgt.cy(),'#ffffff',25);}},
      {frame:100, fn(){CinCam.slowMo(1.0);data.glitch=0;}},
      {frame:130, fn(){CinCam.restore();}},
      {frame:140, fn(){data.bars=0;}},
    ]);
  },
  update(att, tgt, timer, data) {
    _tickTimeline(data.tl, timer);
    if(timer<10) data.bars=timer/10;
    if(timer>140) data.bars=Math.max(0,(150-timer)/10);
    if(data.eraseAlpha>0) data.eraseAlpha=Math.max(0,data.eraseAlpha-0.012);
    if(timer<=80){ att.x=data.ax0;att.y=data.ay0;tgt.x=data.tx0;tgt.y=data.ty0; }
    else if(timer<=100){
      tgt.x=data.tx0+(Math.random()-0.5)*12*data.glitch;
      tgt.y=data.ty0+(Math.random()-0.5)*8*data.glitch;
    } else {
      const p=Math.min(1,(timer-100)/40);
      tgt.x=data.tx0+data.dir*_finEaseOut(p)*120;
      tgt.y=data.ty0-_finEaseOut(p)*30;
      att.x=data.ax0;att.y=data.ay0;
    }
    att.vx=0;att.vy=0;tgt.vx=0;tgt.vy=0;
  },
  draw(ctx, att, tgt, t, timer, data) {
    const {scX,scY,ox,oy}=_finGameTransform();
    _finBars(ctx,data.bars); _finVignette(ctx,Math.min(0.6,t*2.5));
    if(timer<100){
      const a=Math.min(1,timer/25);
      ctx.save();ctx.setTransform(scX,0,0,scY,ox,oy);
      const grd=ctx.createRadialGradient(att.cx(),att.cy(),6,att.cx(),att.cy(),70);
      grd.addColorStop(0,`rgba(160,160,255,${a*0.3})`);
      grd.addColorStop(1,'rgba(160,160,255,0)');
      ctx.shadowColor='#aaaaff';ctx.shadowBlur=36*a;
      ctx.fillStyle=grd;ctx.beginPath();ctx.arc(att.cx(),att.cy(),70,0,Math.PI*2);ctx.fill();
      ctx.restore();
    }
    if(data.glitch>0){
      ctx.save();ctx.setTransform(1,0,0,1,0,0);
      const gi=Math.min(1,data.glitch/3);
      const tx=tgt.x*scX+ox; const ty=tgt.y*scY+oy;
      for(let i=0;i<5;i++){
        const gy=ty+Math.random()*(tgt.h*scY);
        ctx.fillStyle=`rgba(180,180,255,${gi*0.22})`;
        ctx.fillRect(tx+(Math.random()-0.5)*20*gi,gy,tgt.w*scX,2+Math.random()*4);
      }
      ctx.restore();
    }
    if(data.eraseAlpha>0) _finFlash(ctx,data.eraseAlpha*0.7,180,180,255);
    if(timer>35&&timer<125) _finSubtitle(ctx,`"${data.dialogue}"`,t);
    _finTitle(ctx,'ERASURE',t,'rgba(180,180,255,1)');
  }
};

// ============================================================
// TRUE FORM FINISHER 4: PHASE SHIFT
// Theme: reality phases — target blinks out, reappears broken
// ============================================================
const FIN_TF_PHASE_SHIFT = {
  name: 'PHASE SHIFT',
  accentColor: 'rgba(80,60,200,1)',
  duration: 155,
  setup(att, tgt, data) {
    data.ax0=att.x; data.ay0=att.y; data.tx0=tgt.x; data.ty0=tgt.y;
    data.dir=att.x<tgt.x?1:-1; data.bars=0; data.shockR=0; data.shockAlpha=0;
    data.phaseX=tgt.x+( att.x<tgt.x?180:-180); data.phaseY=tgt.y;
    data.dialogue=_FIN_DIALOGUE.trueform[Math.floor(Math.random()*_FIN_DIALOGUE.trueform.length)];
    data.tl=_makeTimeline([
      {frame:0, fn(){CinCam.slowMo(0.3);CinCam.zoomTo(1.25);CinCam.focusMidpoint(att,tgt);}},
      {frame:12, fn(){data.bars=1;}},
      {frame:20, fn(){CinCam.focusOn(att);CinCam.slowMo(0.15);}},
      {frame:55, fn(){CinCam.focusMidpoint(att,tgt);CinCam.shake(16);spawnParticles(tgt.cx(),tgt.cy(),'#6644ff',22);}},
      {frame:70, fn(){CinCam.slowMo(1.0);CinCam.zoomTo(0.95);}},
      {frame:80, fn(){
        data.shockR=1;data.shockAlpha=1;CinCam.shake(38);
        spawnParticles(data.phaseX,data.phaseY,'#6644ff',45);
        spawnParticles(data.phaseX,data.phaseY,'#ffffff',18);
        CinCam.focusPoint(data.phaseX,data.phaseY);CinCam.zoomTo(1.3);
      }},
      {frame:125, fn(){CinCam.restore();}},
      {frame:140, fn(){data.bars=0;}},
    ]);
  },
  update(att, tgt, timer, data) {
    _tickTimeline(data.tl, timer);
    if(timer<12) data.bars=timer/12;
    if(timer>140) data.bars=Math.max(0,(155-timer)/15);
    if(data.shockR>0){data.shockR+=12;data.shockAlpha=Math.max(0,data.shockAlpha-0.033);}
    if(timer<=55){ att.x=data.ax0;att.y=data.ay0;tgt.x=data.tx0;tgt.y=data.ty0; }
    else if(timer<=70){
      const p=(timer-55)/15;
      tgt.x=_finLerp(data.tx0,data.phaseX,_finEaseIn(p));
      tgt.y=_finLerp(data.ty0,data.phaseY,p);
    } else {
      tgt.x=data.phaseX;tgt.y=data.phaseY;
      att.x=data.ax0;att.y=data.ay0;
    }
    att.vx=0;att.vy=0;tgt.vx=0;tgt.vy=0;
  },
  draw(ctx, att, tgt, t, timer, data) {
    const {scX,scY,ox,oy}=_finGameTransform();
    _finBars(ctx,data.bars); _finVignette(ctx,0.5);
    if(timer<80){
      const a=Math.min(1,timer/30);
      ctx.save();ctx.setTransform(scX,0,0,scY,ox,oy);
      const grd=ctx.createRadialGradient(att.cx(),att.cy(),6,att.cx(),att.cy(),75);
      grd.addColorStop(0,`rgba(80,60,200,${a*0.35})`);
      grd.addColorStop(1,'rgba(80,60,200,0)');
      ctx.shadowColor='#6644ff';ctx.shadowBlur=44*a;
      ctx.fillStyle=grd;ctx.beginPath();ctx.arc(att.cx(),att.cy(),75,0,Math.PI*2);ctx.fill();
      ctx.restore();
    }
    if(timer>=55&&timer<80){
      const a=Math.min(1,(timer-55)/10);
      ctx.save();ctx.setTransform(scX,0,0,scY,ox,oy);
      for(let i=0;i<3;i++){
        ctx.strokeStyle=`rgba(100,80,220,${a*(0.6-i*0.15)})`;
        ctx.lineWidth=3+i;ctx.shadowColor='#6644ff';ctx.shadowBlur=14;
        ctx.beginPath();ctx.arc(tgt.cx(),tgt.cy(),20+i*16+Math.sin(timer*0.4+i)*8,0,Math.PI*2);ctx.stroke();
      }
      ctx.restore();
    }
    if(data.shockR>0&&data.shockAlpha>0){
      ctx.save();ctx.setTransform(scX,0,0,scY,ox,oy);
      ctx.strokeStyle=`rgba(100,80,255,${data.shockAlpha})`;ctx.lineWidth=6;
      ctx.shadowColor='#6644ff';ctx.shadowBlur=32;
      ctx.beginPath();ctx.arc(data.phaseX,data.phaseY,data.shockR,0,Math.PI*2);ctx.stroke();
      _finImpactLines(ctx,data.phaseX,data.phaseY,14,data.shockR*0.55,'#8866ff',3);
      ctx.restore();
    }
    if(timer>=70&&timer<=78) _finFlash(ctx,(78-timer)/8*0.75,80,60,220);
    if(timer>30&&timer<130) _finSubtitle(ctx,`"${data.dialogue}"`,t);
    _finTitle(ctx,'PHASE SHIFT',t,'rgba(80,60,200,1)');
  }
};

// ============================================================
// CREATOR FINISHER 3: CODE DELETION
// Theme: precise, surgical — player falls through deleted floor
// ============================================================
const FIN_CR_CODE_DELETION = {
  name: 'CODE DELETION',
  accentColor: 'rgba(0,200,100,1)',
  duration: 140,
  setup(att, tgt, data) {
    data.ax0=att.x; data.ay0=att.y; data.tx0=tgt.x; data.ty0=tgt.y;
    data.dir=att.x<tgt.x?1:-1; data.bars=0; data.codeAlpha=0;
    data.fallY=data.ty0+280;
    data.dialogue=_FIN_DIALOGUE.creator[Math.floor(Math.random()*_FIN_DIALOGUE.creator.length)];
    data.tl=_makeTimeline([
      {frame:0, fn(){CinCam.slowMo(0.3);CinCam.zoomTo(1.2);CinCam.focusMidpoint(att,tgt);}},
      {frame:10, fn(){data.bars=1;}},
      {frame:25, fn(){
        att.x=data.tx0-data.dir*30;att.y=data.ay0;
        att.vx=0;att.vy=0;CinCam.shake(12);
        spawnParticles(tgt.cx(),tgt.cy(),'#00cc66',18);
      }},
      {frame:45, fn(){data.codeAlpha=1;CinCam.slowMo(0.1);CinCam.zoomTo(1.5);CinCam.focusMidpoint(att,tgt);CinCam.shake(8);}},
      {frame:68, fn(){CinCam.slowMo(1.0);CinCam.focusOn(tgt);}},
      {frame:115, fn(){CinCam.shake(38);spawnParticles(tgt.cx(),data.fallY,'#00cc66',40);spawnParticles(tgt.cx(),data.fallY,'#ffffff',15);CinCam.zoomTo(1.3);}},
      {frame:125, fn(){CinCam.restore();}},
      {frame:132, fn(){data.bars=0;}},
    ]);
  },
  update(att, tgt, timer, data) {
    _tickTimeline(data.tl, timer);
    if(timer<10) data.bars=timer/10;
    if(timer>132) data.bars=Math.max(0,(140-timer)/8);
    if(data.codeAlpha>0) data.codeAlpha=Math.max(0,data.codeAlpha-0.016);
    if(timer<=25){att.x=data.ax0;att.y=data.ay0;tgt.x=data.tx0;tgt.y=data.ty0;}
    else if(timer<=68){tgt.x=data.tx0;tgt.y=data.ty0;att.x=data.tx0-data.dir*30;}
    else if(timer<=115){
      const p=(timer-68)/47;
      tgt.y=_finLerp(data.ty0,data.fallY,_finEaseIn(p));
      tgt.x=data.tx0;att.x=data.tx0-data.dir*30;att.y=data.ay0;
    } else {
      tgt.x=data.tx0;tgt.y=data.fallY;
      att.x=data.tx0-data.dir*30;att.y=data.ay0;
    }
    att.vx=0;att.vy=0;tgt.vx=0;tgt.vy=0;
  },
  draw(ctx, att, tgt, t, timer, data) {
    const {scX,scY,ox,oy}=_finGameTransform();
    _finBars(ctx,data.bars);
    ctx.save();ctx.setTransform(1,0,0,1,0,0);
    ctx.fillStyle=`rgba(0,0,0,${Math.min(0.45,t*1.6)})`;
    ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.restore();
    if(timer<70){
      const a=Math.min(1,timer/22);
      ctx.save();ctx.setTransform(scX,0,0,scY,ox,oy);
      ctx.shadowColor='#00cc66';ctx.shadowBlur=38*a;
      const grd=ctx.createRadialGradient(att.cx(),att.cy(),6,att.cx(),att.cy(),65);
      grd.addColorStop(0,`rgba(0,180,80,${a*0.3})`);
      grd.addColorStop(1,'rgba(0,180,80,0)');
      ctx.fillStyle=grd;ctx.beginPath();ctx.arc(att.cx(),att.cy(),65,0,Math.PI*2);ctx.fill();
      ctx.restore();
    }
    if(data.codeAlpha>0){
      ctx.save();ctx.setTransform(1,0,0,1,0,0);
      ctx.font=`${Math.floor(9*canvas.width/GAME_W)}px monospace`;
      ctx.fillStyle=`rgba(0,200,80,${data.codeAlpha*0.5})`;
      for(let i=0;i<20;i++){
        ctx.fillText(Math.random()<0.5?'0':'1',Math.random()*canvas.width,Math.random()*canvas.height);
      }
      ctx.restore();
    }
    if(timer>=68&&timer<=76) _finFlash(ctx,(76-timer)/8*0.72,0,200,100);
    if(timer>30&&timer<125) _finSubtitle(ctx,`"${data.dialogue}"`,t);
    _finTitle(ctx,'CODE DELETION',t,'rgba(0,200,100,1)');
  }
};

// ============================================================
// YETI FINISHER 1: AVALANCHE CRUSH
// Theme: charge in, grab, lift, smash into ground — heavy, primal
// ============================================================
const FIN_YETI_AVALANCHE = {
  name: 'AVALANCHE CRUSH',
  accentColor: 'rgba(120,200,255,1)',
  duration: 140,
  setup(att, tgt, data) {
    data.ax0=att.x; data.ay0=att.y; data.tx0=tgt.x; data.ty0=tgt.y;
    data.dir=att.x<tgt.x?1:-1; data.bars=0; data.shockR=0; data.shockAlpha=0;
    data.bossSnapX=data.tx0-data.dir*30;
    data.dialogue=_FIN_DIALOGUE.yeti[Math.floor(Math.random()*_FIN_DIALOGUE.yeti.length)];
    data.tl=_makeTimeline([
      {frame:0, fn(){CinCam.slowMo(0.35);CinCam.zoomTo(1.2);CinCam.focusMidpoint(att,tgt);}},
      {frame:10, fn(){data.bars=1;}},
      {frame:20, fn(){att.x=data.bossSnapX;att.y=data.ay0;att.vx=0;att.vy=0;CinCam.shake(18);spawnParticles(att.cx(),att.cy(),'#aaeeff',20);}},
      {frame:45, fn(){CinCam.slowMo(0.1);CinCam.zoomTo(1.5);CinCam.focusMidpoint(att,tgt);CinCam.shake(10);}},
      {frame:68, fn(){
        data.shockR=1;data.shockAlpha=1;CinCam.slowMo(1.0);CinCam.shake(55);
        spawnParticles(tgt.cx(),tgt.y+tgt.h,'#aaeeff',60);spawnParticles(tgt.cx(),tgt.y+tgt.h,'#ffffff',25);
        CinCam.focusPoint(tgt.cx(),tgt.y+tgt.h);CinCam.zoomTo(1.35);
      }},
      {frame:110, fn(){CinCam.restore();}},
      {frame:130, fn(){data.bars=0;}},
    ]);
  },
  update(att, tgt, timer, data) {
    _tickTimeline(data.tl, timer);
    if(timer<10) data.bars=timer/10;
    if(timer>130) data.bars=Math.max(0,(140-timer)/10);
    if(data.shockR>0){data.shockR+=11;data.shockAlpha=Math.max(0,data.shockAlpha-0.034);}
    if(timer<=20){att.x=data.ax0;att.y=data.ay0;tgt.x=data.tx0;tgt.y=data.ty0;}
    else if(timer<=45){
      const p=(timer-20)/25;
      att.x=_finLerp(data.ax0,data.bossSnapX,_finEaseOut(p));
      tgt.x=data.tx0;tgt.y=data.ty0;att.y=data.ay0;
    } else if(timer<=68){
      const p=(timer-45)/23;
      tgt.y=_finLerp(data.ty0,data.ty0-70,_finEaseOut(p));
      tgt.x=data.tx0;att.x=data.bossSnapX;att.y=data.ay0;
    } else {
      const p=Math.min(1,(timer-68)/40);
      tgt.y=_finLerp(data.ty0-70,data.ty0+tgt.h*0.3,_finEaseIn(p));
      tgt.x=data.tx0;att.x=data.bossSnapX;att.y=data.ay0;
    }
    att.vx=0;att.vy=0;tgt.vx=0;tgt.vy=0;
  },
  draw(ctx, att, tgt, t, timer, data) {
    const {scX,scY,ox,oy}=_finGameTransform();
    _finBars(ctx,data.bars); _finVignette(ctx,Math.min(0.5,t*2.2));
    if(timer<70){
      const a=Math.min(1,timer/25);
      ctx.save();ctx.setTransform(scX,0,0,scY,ox,oy);
      const grd=ctx.createRadialGradient(att.cx(),att.cy(),8,att.cx(),att.cy(),90);
      grd.addColorStop(0,`rgba(100,200,255,${a*0.28})`);
      grd.addColorStop(1,'rgba(100,200,255,0)');
      ctx.shadowColor='#88ddff';ctx.shadowBlur=40*a;
      ctx.fillStyle=grd;ctx.beginPath();ctx.arc(att.cx(),att.cy(),90,0,Math.PI*2);ctx.fill();
      ctx.restore();
    }
    if(data.shockR>0&&data.shockAlpha>0){
      ctx.save();ctx.setTransform(scX,0,0,scY,ox,oy);
      ctx.strokeStyle=`rgba(120,200,255,${data.shockAlpha})`;ctx.lineWidth=7;
      ctx.shadowColor='#88ddff';ctx.shadowBlur=35;
      ctx.beginPath();ctx.arc(tgt.cx(),data.ty0+tgt.h,data.shockR,0,Math.PI*2);ctx.stroke();
      _finImpactLines(ctx,tgt.cx(),data.ty0+tgt.h,16,data.shockR*0.5,'#aaeeff',4);
      ctx.restore();
    }
    if(timer>=68&&timer<=76) _finFlash(ctx,(76-timer)/8*0.82,120,200,255);
    if(timer>25&&timer<120) _finSubtitle(ctx,`"${data.dialogue}"`,t);
    _finTitle(ctx,'AVALANCHE CRUSH',t,'rgba(120,200,255,1)');
  }
};

// ============================================================
// YETI FINISHER 2: POLAR SLAM
// Theme: spin target overhead like a club + smash — brutal rotation
// ============================================================
const FIN_YETI_POLAR_SLAM = {
  name: 'POLAR SLAM',
  accentColor: 'rgba(80,170,255,1)',
  duration: 135,
  setup(att, tgt, data) {
    data.ax0=att.x; data.ay0=att.y; data.tx0=tgt.x; data.ty0=tgt.y;
    data.dir=att.x<tgt.x?1:-1; data.bars=0; data.shockR=0; data.shockAlpha=0;
    data.spinAngle=0; data.orbitR=55;
    data.slamX=att.x+( att.x<tgt.x?50:-50); data.slamY=data.ty0;
    data.dialogue=_FIN_DIALOGUE.yeti[Math.floor(Math.random()*_FIN_DIALOGUE.yeti.length)];
    data.tl=_makeTimeline([
      {frame:0, fn(){CinCam.slowMo(0.3);CinCam.zoomTo(1.25);CinCam.focusMidpoint(att,tgt);}},
      {frame:10, fn(){data.bars=1;}},
      {frame:18, fn(){CinCam.shake(14);spawnParticles(att.cx(),att.cy(),'#88ccff',16);}},
      {frame:55, fn(){CinCam.slowMo(0.08);CinCam.zoomTo(1.55);CinCam.focusMidpoint(att,tgt);}},
      {frame:72, fn(){
        data.shockR=1;data.shockAlpha=1;CinCam.slowMo(1.0);CinCam.shake(60);
        spawnParticles(data.slamX,data.slamY,'#88ccff',55);spawnParticles(data.slamX,data.slamY,'#ffffff',20);
        CinCam.focusPoint(data.slamX,data.slamY);CinCam.zoomTo(1.4);
      }},
      {frame:110, fn(){CinCam.restore();}},
      {frame:125, fn(){data.bars=0;}},
    ]);
  },
  update(att, tgt, timer, data) {
    _tickTimeline(data.tl, timer);
    if(timer<10) data.bars=timer/10;
    if(timer>125) data.bars=Math.max(0,(135-timer)/10);
    data.spinAngle+=timer<72?0.35:0;
    if(data.shockR>0){data.shockR+=13;data.shockAlpha=Math.max(0,data.shockAlpha-0.036);}
    if(timer<=18){att.x=data.ax0;att.y=data.ay0;tgt.x=data.tx0;tgt.y=data.ty0;}
    else if(timer<=72){
      att.x=data.ax0;att.y=data.ay0;
      tgt.x=att.cx()+Math.cos(data.spinAngle)*data.orbitR-tgt.w/2;
      tgt.y=att.cy()+Math.sin(data.spinAngle)*data.orbitR*0.5-tgt.h/2;
    } else {
      const p=Math.min(1,(timer-72)/38);
      tgt.x=_finLerp(data.tx0,data.slamX-tgt.w/2,_finEaseIn(p));
      tgt.y=_finLerp(data.ty0,data.slamY,_finEaseIn(p));
      att.x=data.ax0;att.y=data.ay0;
    }
    att.vx=0;att.vy=0;tgt.vx=0;tgt.vy=0;
  },
  draw(ctx, att, tgt, t, timer, data) {
    const {scX,scY,ox,oy}=_finGameTransform();
    _finBars(ctx,data.bars); _finVignette(ctx,0.48);
    if(timer<74){
      const a=Math.min(1,timer/20);
      ctx.save();ctx.setTransform(scX,0,0,scY,ox,oy);
      ctx.shadowColor='#88ccff';ctx.shadowBlur=45*a;
      const grd=ctx.createRadialGradient(att.cx(),att.cy(),8,att.cx(),att.cy(),95);
      grd.addColorStop(0,`rgba(80,170,255,${a*0.3})`);
      grd.addColorStop(1,'rgba(80,170,255,0)');
      ctx.fillStyle=grd;ctx.beginPath();ctx.arc(att.cx(),att.cy(),95,0,Math.PI*2);ctx.fill();
      if(timer>18){
        ctx.strokeStyle='rgba(120,200,255,0.5)';ctx.lineWidth=2;ctx.shadowBlur=14;
        ctx.beginPath();ctx.arc(att.cx(),att.cy(),data.orbitR,0,Math.PI*2);ctx.stroke();
      }
      ctx.restore();
    }
    if(data.shockR>0&&data.shockAlpha>0){
      ctx.save();ctx.setTransform(scX,0,0,scY,ox,oy);
      ctx.strokeStyle=`rgba(80,170,255,${data.shockAlpha})`;ctx.lineWidth=8;
      ctx.shadowColor='#88ccff';ctx.shadowBlur=38;
      ctx.beginPath();ctx.arc(data.slamX,data.slamY,data.shockR,0,Math.PI*2);ctx.stroke();
      _finImpactLines(ctx,data.slamX,data.slamY+10,14,data.shockR*0.55,'#aaddff',5);
      ctx.restore();
    }
    if(timer>=72&&timer<=80) _finFlash(ctx,(80-timer)/8*0.88,80,170,255);
    if(timer>20&&timer<118) _finSubtitle(ctx,`"${data.dialogue}"`,t);
    _finTitle(ctx,'POLAR SLAM',t,'rgba(80,170,255,1)');
  }
};

// ============================================================
// YETI FINISHER 3: ICE BURIAL
// Theme: freeze target solid then shatter — cold, pitiless
// ============================================================
const FIN_YETI_ICE_BURIAL = {
  name: 'ICE BURIAL',
  accentColor: 'rgba(180,240,255,1)',
  duration: 138,
  setup(att, tgt, data) {
    data.ax0=att.x; data.ay0=att.y; data.tx0=tgt.x; data.ty0=tgt.y;
    data.dir=att.x<tgt.x?1:-1; data.bars=0; data.freezeAlpha=0; data.shockR=0; data.shockAlpha=0;
    data.dialogue=_FIN_DIALOGUE.yeti[Math.floor(Math.random()*_FIN_DIALOGUE.yeti.length)];
    data.tl=_makeTimeline([
      {frame:0, fn(){CinCam.slowMo(0.28);CinCam.zoomTo(1.3);CinCam.focusMidpoint(att,tgt);}},
      {frame:12, fn(){data.bars=1;}},
      {frame:25, fn(){CinCam.focusOn(tgt);CinCam.slowMo(0.12);}},
      {frame:55, fn(){data.freezeAlpha=1;CinCam.shake(20);spawnParticles(tgt.cx(),tgt.cy(),'#ccf0ff',28);}},
      {frame:72, fn(){
        data.shockR=1;data.shockAlpha=1;CinCam.slowMo(1.0);CinCam.shake(44);
        spawnParticles(tgt.cx(),tgt.cy(),'#ccf0ff',45);spawnParticles(tgt.cx(),tgt.cy(),'#ffffff',18);
        CinCam.zoomTo(1.4);CinCam.focusOn(tgt);
      }},
      {frame:115, fn(){CinCam.restore();}},
      {frame:128, fn(){data.bars=0;}},
    ]);
  },
  update(att, tgt, timer, data) {
    _tickTimeline(data.tl, timer);
    if(timer<12) data.bars=timer/12;
    if(timer>128) data.bars=Math.max(0,(138-timer)/10);
    if(data.freezeAlpha>0) data.freezeAlpha=Math.max(0,data.freezeAlpha-0.013);
    if(data.shockR>0){data.shockR+=10;data.shockAlpha=Math.max(0,data.shockAlpha-0.032);}
    att.x=data.ax0;att.y=data.ay0;
    if(timer<=55){tgt.x=data.tx0;tgt.y=data.ty0;}
    else if(timer<=72){
      tgt.x=data.tx0+(Math.random()-0.5)*5;
      tgt.y=data.ty0+(Math.random()-0.5)*4;
    } else {
      const p=Math.min(1,(timer-72)/35);
      tgt.x=data.tx0;tgt.y=data.ty0+_finEaseIn(p)*75;
    }
    att.vx=0;att.vy=0;tgt.vx=0;tgt.vy=0;
  },
  draw(ctx, att, tgt, t, timer, data) {
    const {scX,scY,ox,oy}=_finGameTransform();
    _finBars(ctx,data.bars); _finVignette(ctx,0.46);
    ctx.save();ctx.setTransform(scX,0,0,scY,ox,oy);
    const a=Math.min(1,timer/30);
    ctx.shadowColor='#ccf0ff';ctx.shadowBlur=32*a;
    const grd=ctx.createRadialGradient(att.cx(),att.cy(),8,att.cx(),att.cy(),85);
    grd.addColorStop(0,`rgba(160,230,255,${a*0.25})`);
    grd.addColorStop(1,'rgba(160,230,255,0)');
    ctx.fillStyle=grd;ctx.beginPath();ctx.arc(att.cx(),att.cy(),85,0,Math.PI*2);ctx.fill();
    if(timer>55){
      const fa=Math.min(1,(timer-55)/12);
      for(let i=0;i<6;i++){
        const ang=i/6*Math.PI*2; const r=20+i*8;
        ctx.strokeStyle=`rgba(180,240,255,${fa*(0.7-i*0.08)})`;ctx.lineWidth=2;
        ctx.beginPath();
        ctx.moveTo(tgt.cx()+Math.cos(ang)*8,tgt.cy()+Math.sin(ang)*8);
        ctx.lineTo(tgt.cx()+Math.cos(ang)*r,tgt.cy()+Math.sin(ang)*r);
        ctx.stroke();
      }
    }
    ctx.restore();
    if(data.freezeAlpha>0) _finFlash(ctx,data.freezeAlpha*0.5,180,240,255);
    if(data.shockR>0&&data.shockAlpha>0){
      ctx.save();ctx.setTransform(scX,0,0,scY,ox,oy);
      ctx.strokeStyle=`rgba(180,240,255,${data.shockAlpha})`;ctx.lineWidth=6;
      ctx.shadowColor='#ccf0ff';ctx.shadowBlur=28;
      ctx.beginPath();ctx.arc(tgt.cx(),data.ty0+tgt.h,data.shockR,0,Math.PI*2);ctx.stroke();
      ctx.restore();
    }
    if(timer>=72&&timer<=80) _finFlash(ctx,(80-timer)/8*0.78,180,240,255);
    if(timer>28&&timer<118) _finSubtitle(ctx,`"${data.dialogue}"`,t);
    _finTitle(ctx,'ICE BURIAL',t,'rgba(180,240,255,1)');
  }
};

// ============================================================
// FOREST BEAST FINISHER 1: FERAL TACKLE
// Theme: explosive full-sprint charge-tackle — wild, unstoppable
// ============================================================
const FIN_BEAST_FERAL_TACKLE = {
  name: 'FERAL TACKLE',
  accentColor: 'rgba(80,200,60,1)',
  duration: 130,
  setup(att, tgt, data) {
    data.ax0=att.x; data.ay0=att.y; data.tx0=tgt.x; data.ty0=tgt.y;
    data.dir=att.x<tgt.x?1:-1; data.bars=0; data.shockR=0; data.shockAlpha=0;
    data.chargeX=data.tx0+data.dir*180; data.chargeY=data.ty0-15;
    data.dialogue=_FIN_DIALOGUE.beast[Math.floor(Math.random()*_FIN_DIALOGUE.beast.length)];
    data.tl=_makeTimeline([
      {frame:0, fn(){CinCam.slowMo(0.35);CinCam.zoomTo(1.15);CinCam.focusMidpoint(att,tgt);}},
      {frame:10, fn(){data.bars=1;}},
      {frame:18, fn(){CinCam.focusOn(att);spawnParticles(att.cx(),att.cy(),'#44cc22',18);}},
      {frame:38, fn(){CinCam.slowMo(0.08);CinCam.zoomTo(1.55);CinCam.focusMidpoint(att,tgt);CinCam.shake(12);}},
      {frame:52, fn(){
        CinCam.slowMo(1.0);CinCam.shake(50);data.shockR=1;data.shockAlpha=1;
        spawnParticles(tgt.cx(),tgt.cy(),'#44cc22',55);spawnParticles(tgt.cx(),tgt.cy(),'#ffffff',20);
        spawnParticles(tgt.cx(),tgt.cy(),'#88ff44',22);CinCam.zoomTo(1.0);
      }},
      {frame:60, fn(){CinCam.focusOn(tgt);CinCam.zoomTo(1.3);}},
      {frame:105, fn(){CinCam.restore();}},
      {frame:120, fn(){data.bars=0;}},
    ]);
  },
  update(att, tgt, timer, data) {
    _tickTimeline(data.tl, timer);
    if(timer<10) data.bars=timer/10;
    if(timer>120) data.bars=Math.max(0,(130-timer)/10);
    if(data.shockR>0){data.shockR+=13;data.shockAlpha=Math.max(0,data.shockAlpha-0.036);}
    if(timer<=38){att.x=data.ax0;att.y=data.ay0;tgt.x=data.tx0;tgt.y=data.ty0;}
    else if(timer<=52){
      const p=(timer-38)/14;
      att.x=_finLerp(data.ax0,data.tx0-data.dir*10,_finEaseIn(p));
      att.y=data.ay0;tgt.x=data.tx0;tgt.y=data.ty0;
    } else {
      att.x=data.tx0-data.dir*10;att.y=data.ay0;
      const p=Math.min(1,(timer-52)/48);
      tgt.x=_finLerp(data.tx0,data.chargeX,_finEaseOut(p));
      tgt.y=_finLerp(data.ty0,data.chargeY,p<0.5?_finEaseOut(p*2)*(-0.3):_finEaseIn((p-0.5)*2)*0.4-0.3+0.7);
    }
    att.vx=0;att.vy=0;tgt.vx=0;tgt.vy=0;
  },
  draw(ctx, att, tgt, t, timer, data) {
    const {scX,scY,ox,oy}=_finGameTransform();
    _finBars(ctx,data.bars); _finVignette(ctx,0.42);
    if(timer<54){
      const a=Math.min(1,timer/22);
      ctx.save();ctx.setTransform(scX,0,0,scY,ox,oy);
      const grd=ctx.createRadialGradient(att.cx(),att.cy(),8,att.cx(),att.cy(),80);
      grd.addColorStop(0,`rgba(60,200,30,${a*0.3})`);
      grd.addColorStop(1,'rgba(60,200,30,0)');
      ctx.shadowColor='#44cc22';ctx.shadowBlur=38*a;
      ctx.fillStyle=grd;ctx.beginPath();ctx.arc(att.cx(),att.cy(),80,0,Math.PI*2);ctx.fill();
      ctx.restore();
    }
    if(timer>=38&&timer<52){
      ctx.save();ctx.setTransform(scX,0,0,scY,ox,oy);
      const pa=(timer-38)/14;
      for(let i=0;i<5;i++){
        ctx.strokeStyle=`rgba(80,220,40,${pa*(0.6-i*0.1)})`;ctx.lineWidth=3;
        ctx.beginPath();ctx.moveTo(att.cx()-data.dir*(i*12+5),att.cy()+(i-2)*8);
        ctx.lineTo(att.cx()-data.dir*(i*12+25),att.cy()+(i-2)*8);ctx.stroke();
      }
      ctx.restore();
    }
    if(data.shockR>0&&data.shockAlpha>0){
      ctx.save();ctx.setTransform(scX,0,0,scY,ox,oy);
      ctx.strokeStyle=`rgba(80,200,60,${data.shockAlpha})`;ctx.lineWidth=6;
      ctx.shadowColor='#44cc22';ctx.shadowBlur=32;
      ctx.beginPath();ctx.arc(tgt.cx(),tgt.cy(),data.shockR,0,Math.PI*2);ctx.stroke();
      _finImpactLines(ctx,tgt.cx(),tgt.cy(),12,data.shockR*0.6,'#88ff44',4);
      ctx.restore();
    }
    if(timer>=52&&timer<=60) _finFlash(ctx,(60-timer)/8*0.72,60,200,40);
    if(timer>22&&timer<112) _finSubtitle(ctx,`"${data.dialogue}"`,t);
    _finTitle(ctx,'FERAL TACKLE',t,'rgba(80,200,60,1)');
  }
};

// ============================================================
// FOREST BEAST FINISHER 2: NATURE DEVOUR
// Theme: vine-whip + drag into the earth — wild nature power
// ============================================================
const FIN_BEAST_NATURE_DEVOUR = {
  name: 'NATURE DEVOUR',
  accentColor: 'rgba(40,160,40,1)',
  duration: 145,
  setup(att, tgt, data) {
    data.ax0=att.x; data.ay0=att.y; data.tx0=tgt.x; data.ty0=tgt.y;
    data.dir=att.x<tgt.x?1:-1; data.bars=0; data.shockR=0; data.shockAlpha=0;
    data.vineAlpha=0; data.slamY=data.ty0+200;
    data.dialogue=_FIN_DIALOGUE.beast[Math.floor(Math.random()*_FIN_DIALOGUE.beast.length)];
    data.tl=_makeTimeline([
      {frame:0, fn(){CinCam.slowMo(0.3);CinCam.zoomTo(1.2);CinCam.focusMidpoint(att,tgt);}},
      {frame:10, fn(){data.bars=1;}},
      {frame:22, fn(){data.vineAlpha=1;CinCam.shake(10);spawnParticles(tgt.cx(),tgt.cy(),'#22aa22',18);}},
      {frame:50, fn(){CinCam.slowMo(0.1);CinCam.zoomTo(1.5);CinCam.focusMidpoint(att,tgt);CinCam.shake(14);}},
      {frame:72, fn(){
        CinCam.slowMo(1.0);CinCam.shake(50);data.shockR=1;data.shockAlpha=1;
        spawnParticles(tgt.cx(),data.slamY,'#22aa22',55);spawnParticles(tgt.cx(),data.slamY,'#ffffff',18);
        CinCam.focusPoint(tgt.cx(),data.slamY);CinCam.zoomTo(1.35);
      }},
      {frame:115, fn(){CinCam.restore();}},
      {frame:133, fn(){data.bars=0;}},
    ]);
  },
  update(att, tgt, timer, data) {
    _tickTimeline(data.tl, timer);
    if(timer<10) data.bars=timer/10;
    if(timer>133) data.bars=Math.max(0,(145-timer)/12);
    if(data.vineAlpha>0) data.vineAlpha=Math.max(0,data.vineAlpha-0.012);
    if(data.shockR>0){data.shockR+=12;data.shockAlpha=Math.max(0,data.shockAlpha-0.033);}
    att.x=data.ax0;att.y=data.ay0;
    if(timer<=22){tgt.x=data.tx0;tgt.y=data.ty0;}
    else if(timer<=50){
      tgt.x=data.tx0+(Math.random()-0.5)*6;
      tgt.y=data.ty0+(Math.random()-0.5)*5;
    } else if(timer<=72){
      const p=(timer-50)/22;
      tgt.y=_finLerp(data.ty0,data.slamY,_finEaseIn(p));tgt.x=data.tx0;
    } else {
      tgt.x=data.tx0;tgt.y=data.slamY;
    }
    att.vx=0;att.vy=0;tgt.vx=0;tgt.vy=0;
  },
  draw(ctx, att, tgt, t, timer, data) {
    const {scX,scY,ox,oy}=_finGameTransform();
    _finBars(ctx,data.bars); _finVignette(ctx,0.44);
    const a=Math.min(1,timer/25);
    ctx.save();ctx.setTransform(scX,0,0,scY,ox,oy);
    ctx.shadowColor='#22aa22';ctx.shadowBlur=35*a;
    const grd=ctx.createRadialGradient(att.cx(),att.cy(),8,att.cx(),att.cy(),75);
    grd.addColorStop(0,`rgba(30,160,30,${a*0.32})`);
    grd.addColorStop(1,'rgba(30,160,30,0)');
    ctx.fillStyle=grd;ctx.beginPath();ctx.arc(att.cx(),att.cy(),75,0,Math.PI*2);ctx.fill();
    if(timer>22&&timer<72){
      const va=Math.min(1,(timer-22)/12);
      for(let i=0;i<4;i++){
        const ang=i*Math.PI*0.5+timer*0.06;
        ctx.strokeStyle=`rgba(30,180,30,${va*(0.55-i*0.08)})`;ctx.lineWidth=2+i*0.5;ctx.shadowBlur=10;
        ctx.beginPath();
        ctx.moveTo(att.cx(),att.cy());
        ctx.bezierCurveTo(
          att.cx()+Math.cos(ang)*35,att.cy()+Math.sin(ang)*25,
          tgt.cx()+Math.cos(ang+1)*20,tgt.cy()+Math.sin(ang+1)*20,
          tgt.cx(),tgt.cy()
        );
        ctx.stroke();
      }
    }
    ctx.restore();
    if(data.shockR>0&&data.shockAlpha>0){
      ctx.save();ctx.setTransform(scX,0,0,scY,ox,oy);
      ctx.strokeStyle=`rgba(40,160,40,${data.shockAlpha})`;ctx.lineWidth=6;
      ctx.shadowColor='#22aa22';ctx.shadowBlur=28;
      ctx.beginPath();ctx.arc(tgt.cx(),data.slamY,data.shockR,0,Math.PI*2);ctx.stroke();
      _finImpactLines(ctx,tgt.cx(),data.slamY,14,data.shockR*0.55,'#44cc44',3);
      ctx.restore();
    }
    if(data.vineAlpha>0) _finFlash(ctx,data.vineAlpha*0.35,30,160,30);
    if(timer>=72&&timer<=80) _finFlash(ctx,(80-timer)/8*0.82,40,160,40);
    if(timer>28&&timer<125) _finSubtitle(ctx,`"${data.dialogue}"`,t);
    _finTitle(ctx,'NATURE DEVOUR',t,'rgba(40,160,40,1)');
  }
};

// ============================================================
// FOREST BEAST FINISHER 3: SAVAGE LAUNCH
// Theme: grab + spin + hurl across the entire arena
// ============================================================
const FIN_BEAST_SAVAGE_LAUNCH = {
  name: 'SAVAGE LAUNCH',
  accentColor: 'rgba(160,230,60,1)',
  duration: 150,
  setup(att, tgt, data) {
    data.ax0=att.x; data.ay0=att.y; data.tx0=tgt.x; data.ty0=tgt.y;
    data.dir=att.x<tgt.x?1:-1; data.bars=0; data.shockR=0; data.shockAlpha=0;
    data.spinAngle=0; data.orbitR=50;
    data.landX=data.tx0+data.dir*280; data.landY=data.ty0;
    data.dialogue=_FIN_DIALOGUE.beast[Math.floor(Math.random()*_FIN_DIALOGUE.beast.length)];
    data.tl=_makeTimeline([
      {frame:0, fn(){CinCam.slowMo(0.35);CinCam.zoomTo(1.15);CinCam.focusMidpoint(att,tgt);}},
      {frame:10, fn(){data.bars=1;}},
      {frame:20, fn(){CinCam.shake(14);spawnParticles(att.cx(),att.cy(),'#88dd22',16);}},
      {frame:55, fn(){CinCam.slowMo(0.08);CinCam.zoomTo(1.5);CinCam.focusMidpoint(att,tgt);}},
      {frame:70, fn(){CinCam.slowMo(1.0);CinCam.zoomTo(0.9);}},
      {frame:75, fn(){CinCam.focusOn(tgt);}},
      {frame:118, fn(){
        data.shockR=1;data.shockAlpha=1;CinCam.shake(52);
        spawnParticles(data.landX,data.landY,'#88dd22',55);spawnParticles(data.landX,data.landY,'#ffffff',20);
        CinCam.focusPoint(data.landX,data.landY);CinCam.zoomTo(1.3);
      }},
      {frame:138, fn(){CinCam.restore();}},
      {frame:142, fn(){data.bars=0;}},
    ]);
  },
  update(att, tgt, timer, data) {
    _tickTimeline(data.tl, timer);
    if(timer<10) data.bars=timer/10;
    if(timer>142) data.bars=Math.max(0,(150-timer)/8);
    data.spinAngle+=timer<70?0.32:0;
    if(data.shockR>0){data.shockR+=12;data.shockAlpha=Math.max(0,data.shockAlpha-0.032);}
    if(timer<=20){att.x=data.ax0;att.y=data.ay0;tgt.x=data.tx0;tgt.y=data.ty0;}
    else if(timer<=70){
      att.x=data.ax0;att.y=data.ay0;
      tgt.x=att.cx()+Math.cos(data.spinAngle)*data.orbitR-tgt.w/2;
      tgt.y=att.cy()+Math.sin(data.spinAngle)*data.orbitR*0.4-tgt.h/2;
    } else {
      att.x=data.ax0;att.y=data.ay0;
      const p=Math.min(1,(timer-70)/48);
      tgt.x=_finLerp(data.tx0,data.landX,_finEaseIn(p));
      tgt.y=_finLerp(data.ty0,data.landY,p<0.5?_finEaseOut(p*2)*(-0.35):_finEaseIn((p-0.5)*2)*0.5-0.35+0.85);
    }
    att.vx=0;att.vy=0;tgt.vx=0;tgt.vy=0;
  },
  draw(ctx, att, tgt, t, timer, data) {
    const {scX,scY,ox,oy}=_finGameTransform();
    _finBars(ctx,data.bars); _finVignette(ctx,0.45);
    if(timer<72){
      const a=Math.min(1,timer/22);
      ctx.save();ctx.setTransform(scX,0,0,scY,ox,oy);
      const grd=ctx.createRadialGradient(att.cx(),att.cy(),8,att.cx(),att.cy(),88);
      grd.addColorStop(0,`rgba(100,200,30,${a*0.3})`);
      grd.addColorStop(1,'rgba(100,200,30,0)');
      ctx.shadowColor='#88dd22';ctx.shadowBlur=42*a;
      ctx.fillStyle=grd;ctx.beginPath();ctx.arc(att.cx(),att.cy(),88,0,Math.PI*2);ctx.fill();
      if(timer>20){
        ctx.strokeStyle='rgba(120,230,40,0.45)';ctx.lineWidth=2;
        ctx.beginPath();ctx.arc(att.cx(),att.cy(),data.orbitR,0,Math.PI*2);ctx.stroke();
      }
      ctx.restore();
    }
    if(data.shockR>0&&data.shockAlpha>0){
      ctx.save();ctx.setTransform(scX,0,0,scY,ox,oy);
      ctx.strokeStyle=`rgba(140,210,50,${data.shockAlpha})`;ctx.lineWidth=7;
      ctx.shadowColor='#88dd22';ctx.shadowBlur=34;
      ctx.beginPath();ctx.arc(data.landX,data.landY,data.shockR,0,Math.PI*2);ctx.stroke();
      _finImpactLines(ctx,data.landX,data.landY,16,data.shockR*0.5,'#aaff44',4);
      ctx.restore();
    }
    if(timer>=70&&timer<=78) _finFlash(ctx,(78-timer)/8*0.68,100,200,40);
    if(timer>25&&timer<130) _finSubtitle(ctx,`"${data.dialogue}"`,t);
    _finTitle(ctx,'SAVAGE LAUNCH',t,'rgba(160,230,60,1)');
  }
};

// ============================================================
// WEAPON FINISHER DEFINITIONS
// ============================================================
// Every weapon finisher follows the same 6-phase structure as
// the boss finishers:
//   Phase 1: bars in, slow-mo 0.25, camera frames both fighters
//   Phase 2: attacker wind-up approach, energy aura builds
//   Phase 3: DEEP FREEZE (slowMo 0.07) — 10 frames before impact
//   Phase 4: STRIKE — full speed, shake, flash, particles, shockwave
//   Phase 5: aftermath — target flies, camera tracks & zooms impact
//   Phase 6: bars out, camera restore
// All finishers include weapon-flavored subtitles.
// ============================================================

function _wfDef(name, accent, dur, setupFn, updateFn, drawFn) {
  return { name, accentColor: accent, duration: dur, setup: setupFn, update: updateFn, draw: drawFn };
}

// ── Shared helpers ───────────────────────────────────────────
function _wfBaseSetup(att, tgt, data) {
  data.ax0=att.x; data.ay0=att.y;
  data.tx0=tgt.x; data.ty0=tgt.y;
  data.dir=att.x<tgt.x?1:-1;
  data.bars=0; data.shockR=0; data.shockAlpha=0;
  data.auraAlpha=0; data.auraR=0;
}
function _wfTick(timer, totalDur, data) {
  // Bars animate in (0-12f) and out (last 14f)
  if (timer < 12)              data.bars = timer/12;
  if (timer > totalDur-14)     data.bars = Math.max(0,(totalDur-timer)/14);
  // Shockwave expand + fade
  if (data.shockR>0){ data.shockR+=11; data.shockAlpha=Math.max(0,data.shockAlpha-0.035); }
  // Aura pulse
  data.auraR = data.auraR ? data.auraR : 0;
}
// Radial energy aura around attacker
function _wfDrawAura(ctx, att, color, alpha, r, scX, scY, ox, oy) {
  if (alpha <= 0 || r <= 0) return;
  ctx.save(); ctx.setTransform(scX,0,0,scY,ox,oy);
  const grd = ctx.createRadialGradient(att.cx(),att.cy(),r*0.1,att.cx(),att.cy(),r);
  grd.addColorStop(0,color.replace('1)',`${alpha*0.38})`));
  grd.addColorStop(1,color.replace('1)','0)'));
  ctx.shadowColor=color; ctx.shadowBlur=36*alpha;
  ctx.fillStyle=grd; ctx.beginPath();
  ctx.arc(att.cx(),att.cy(),r,0,Math.PI*2); ctx.fill();
  ctx.restore();
}

const WEAPON_FINISHERS = {

  // ── sword ────────────────────────────────────────────────────
  sword: _wfDef('PHANTOM SLASH','rgba(100,160,255,1)',120,
    (att,tgt,data)=>{ _wfBaseSetup(att,tgt,data); data.slashFired=false;
      data.tl=_makeTimeline([
        {frame:0, fn(){ CinCam.zoomTo(1.3); CinCam.focusMidpoint(att,tgt); CinCam.slowMo(0.25); }},
        {frame:12,fn(){ CinCam.focusOn(att); }},
        {frame:30,fn(){ CinCam.slowMo(0.07); CinCam.zoomTo(1.55); CinCam.focusMidpoint(att,tgt); }},
        {frame:40,fn(){ data.slashFired=true; CinCam.slowMo(1.0); CinCam.shake(32); spawnParticles(tgt.cx(),tgt.cy(),'#88ccff',40); spawnParticles(tgt.cx(),tgt.cy(),'#ffffff',14); data.shockR=1;data.shockAlpha=1; CinCam.focusOn(tgt); CinCam.zoomTo(1.3); }},
        {frame:90,fn(){ CinCam.restore(); }},
      ]); },
    (att,tgt,timer,data)=>{ _tickTimeline(data.tl,timer); _wfTick(timer,120,data);
      if(timer<12){ att.x=data.ax0; tgt.x=data.tx0;tgt.y=data.ty0; data.auraAlpha=0; }
      else if(timer<30){ const p=(timer-12)/18; att.x=data.ax0+data.dir*_finEaseOut(p)*35; tgt.x=data.tx0;tgt.y=data.ty0; data.auraAlpha=p*0.8; data.auraR=30+p*20; }
      else if(timer<40){ att.x=data.ax0+data.dir*35; tgt.x=data.tx0;tgt.y=data.ty0; data.auraAlpha=0.85; data.auraR=50; }
      else{ const p=Math.min(1,(timer-40)/50); tgt.x=data.tx0+data.dir*_finEaseOut(p)*80; tgt.y=data.ty0-_finEaseOut(p)*28; att.x=data.ax0+data.dir*35; data.auraAlpha=Math.max(0,data.auraAlpha-0.04); }
      att.vx=0;att.vy=0;tgt.vx=0;tgt.vy=0; },
    (ctx,att,tgt,t,timer,data)=>{
      const {scX,scY,ox,oy}=_finGameTransform();
      _finBars(ctx,data.bars); _finVignette(ctx,0.42);
      _wfDrawAura(ctx,att,'rgba(100,160,255,1)',data.auraAlpha,data.auraR,scX,scY,ox,oy);
      if(data.slashFired){ ctx.save();ctx.setTransform(scX,0,0,scY,ox,oy);
        const a=Math.atan2(tgt.cy()-att.cy(),tgt.cx()-att.cx());
        ctx.strokeStyle=`rgba(150,200,255,${data.shockAlpha*0.9})`; ctx.lineWidth=3+data.shockAlpha*5;
        ctx.shadowColor='#88ccff';ctx.shadowBlur=28;
        ctx.beginPath();ctx.moveTo(att.cx()-Math.cos(a)*50,att.cy()-Math.sin(a)*50);
        ctx.lineTo(tgt.cx()+Math.cos(a)*60,tgt.cy()+Math.sin(a)*60);ctx.stroke();ctx.restore();
      }
      if(timer>=40&&timer<=48) _finFlash(ctx,(48-timer)/8*0.65,100,160,255);
      if(timer>50&&timer<105) _finSubtitle(ctx,'"Faster than the eye can see."',t);
      _finTitle(ctx,'PHANTOM SLASH',t,'rgba(100,160,255,1)');
    }
  ),

  // ── hammer ───────────────────────────────────────────────────
  hammer: _wfDef('EARTH SHATTER','rgba(200,140,40,1)',125,
    (att,tgt,data)=>{ _wfBaseSetup(att,tgt,data); data.hLift=0;
      data.tl=_makeTimeline([
        {frame:0, fn(){ CinCam.zoomTo(1.3); CinCam.focusMidpoint(att,tgt); CinCam.slowMo(0.25); }},
        {frame:12,fn(){ CinCam.focusOn(att); }},
        {frame:30,fn(){ CinCam.slowMo(0.07); CinCam.zoomTo(1.5); CinCam.focusMidpoint(att,tgt); }},
        {frame:42,fn(){ CinCam.slowMo(1.0); CinCam.shake(60); data.shockR=1;data.shockAlpha=1; spawnParticles(tgt.cx(),tgt.y+tgt.h,'#cc8800',60); spawnParticles(tgt.cx(),tgt.y+tgt.h,'#ffcc44',22); CinCam.focusOn(tgt); CinCam.zoomTo(1.3); }},
        {frame:92,fn(){ CinCam.restore(); }},
      ]); },
    (att,tgt,timer,data)=>{ _tickTimeline(data.tl,timer); _wfTick(timer,125,data);
      if(timer<12){ att.x=data.ax0;att.y=data.ay0; tgt.x=data.tx0;tgt.y=data.ty0; data.auraAlpha=0; }
      else if(timer<30){ const p=(timer-12)/18; data.hLift=_finEaseOut(p)*(-60); att.y=data.ay0+data.hLift; att.x=data.ax0; tgt.x=data.tx0;tgt.y=data.ty0; data.auraAlpha=p*0.7; data.auraR=28+p*22; }
      else if(timer<42){ const p=(timer-30)/12; att.y=data.ay0-60+_finEaseIn(p)*60; att.x=data.ax0; tgt.x=data.tx0;tgt.y=data.ty0; data.auraAlpha=0.8; data.auraR=50; }
      else{ const p=Math.min(1,(timer-42)/55); tgt.y=data.ty0+_finEaseOut(p)*70; tgt.x=data.tx0; att.x=data.ax0;att.y=data.ay0; data.auraAlpha=Math.max(0,data.auraAlpha-0.04); }
      att.vx=0;att.vy=0;tgt.vx=0;tgt.vy=0; },
    (ctx,att,tgt,t,timer,data)=>{
      const {scX,scY,ox,oy}=_finGameTransform();
      _finBars(ctx,data.bars); _finVignette(ctx,0.44);
      _wfDrawAura(ctx,att,'rgba(200,140,40,1)',data.auraAlpha,data.auraR,scX,scY,ox,oy);
      if(data.shockR>0&&data.shockAlpha>0){ ctx.save();ctx.setTransform(scX,0,0,scY,ox,oy);
        ctx.strokeStyle=`rgba(200,140,40,${data.shockAlpha})`;ctx.lineWidth=7;ctx.shadowColor='#cc8800';ctx.shadowBlur=36;
        ctx.beginPath();ctx.arc(data.tx0+tgt.w/2,data.ty0+tgt.h,data.shockR,Math.PI,0);ctx.stroke();
        _finImpactLines(ctx,data.tx0+tgt.w/2,data.ty0+tgt.h,16,data.shockR*0.55,'#ffaa00',5);ctx.restore();
      }
      if(timer>=42&&timer<=50) _finFlash(ctx,(50-timer)/8*0.85,200,140,40);
      if(timer>55&&timer<110) _finSubtitle(ctx,'"Feel the weight of the earth."',t);
      _finTitle(ctx,'EARTH SHATTER',t,'rgba(200,140,40,1)');
    }
  ),

  // ── gun ──────────────────────────────────────────────────────
  gun: _wfDef('BULLET TIME','rgba(220,220,60,1)',118,
    (att,tgt,data)=>{ _wfBaseSetup(att,tgt,data); data.bulletX=0;data.bulletY=0;data.bulletDone=false;
      data.tl=_makeTimeline([
        {frame:0, fn(){ CinCam.zoomTo(1.3); CinCam.focusMidpoint(att,tgt); CinCam.slowMo(0.25); }},
        {frame:12,fn(){ CinCam.focusOn(att); }},
        {frame:28,fn(){ CinCam.slowMo(0.07); CinCam.zoomTo(1.6); CinCam.focusOn(tgt); }},
        {frame:40,fn(){ CinCam.slowMo(1.0); data.shockR=1;data.shockAlpha=1; CinCam.shake(22); spawnParticles(tgt.cx(),tgt.cy(),'#ffff44',30); CinCam.focusOn(tgt); CinCam.zoomTo(1.3); }},
        {frame:88,fn(){ CinCam.restore(); }},
      ]); },
    (att,tgt,timer,data)=>{ _tickTimeline(data.tl,timer); _wfTick(timer,118,data);
      if(timer<28){ const p=(timer-12)/16; data.auraAlpha=Math.max(0,p)*0.6; data.auraR=20+p*20; data.bulletX=att.cx();data.bulletY=att.cy(); }
      else if(timer<40){ const p=(timer-28)/12; data.bulletX=_finLerp(att.cx(),tgt.cx(),p); data.bulletY=_finLerp(att.cy(),tgt.cy(),p); }
      else{ data.bulletDone=true; }
      att.x=data.ax0;att.y=data.ay0; if(timer<40){tgt.x=data.tx0;tgt.y=data.ty0;}
      else{ const p=Math.min(1,(timer-40)/55); tgt.x=data.tx0+data.dir*_finEaseOut(p)*65; tgt.y=data.ty0-_finEaseOut(p)*20; data.auraAlpha=Math.max(0,data.auraAlpha-0.05); }
      att.vx=0;att.vy=0;tgt.vx=0;tgt.vy=0; },
    (ctx,att,tgt,t,timer,data)=>{
      const {scX,scY,ox,oy}=_finGameTransform();
      _finBars(ctx,data.bars); _finVignette(ctx,0.45);
      _wfDrawAura(ctx,att,'rgba(220,220,60,1)',data.auraAlpha,data.auraR,scX,scY,ox,oy);
      ctx.save();ctx.setTransform(scX,0,0,scY,ox,oy);
      if(!data.bulletDone&&data.bulletX>0){
        ctx.strokeStyle='rgba(255,255,100,0.9)';ctx.lineWidth=4;ctx.shadowColor='#ffff44';ctx.shadowBlur=22;
        ctx.beginPath();ctx.moveTo(att.cx(),att.cy());ctx.lineTo(data.bulletX,data.bulletY);ctx.stroke();
        ctx.fillStyle='#ffffaa';ctx.beginPath();ctx.arc(data.bulletX,data.bulletY,5,0,Math.PI*2);ctx.fill();
      }
      if(data.shockR>0&&data.shockAlpha>0){
        ctx.strokeStyle=`rgba(255,255,100,${data.shockAlpha})`;ctx.lineWidth=5;ctx.shadowColor='#ffff44';ctx.shadowBlur=24;
        ctx.beginPath();ctx.arc(tgt.cx(),tgt.cy(),data.shockR,0,Math.PI*2);ctx.stroke();
      }
      ctx.restore();
      if(timer>=40&&timer<=48) _finFlash(ctx,(48-timer)/8*0.68,240,240,80);
      if(timer>52&&timer<105) _finSubtitle(ctx,'"One shot. One ending."',t);
      _finTitle(ctx,'BULLET TIME',t,'rgba(220,220,60,1)');
    }
  ),

  // ── axe ──────────────────────────────────────────────────────
  axe: _wfDef('SPINNING FURY','rgba(255,80,40,1)',120,
    (att,tgt,data)=>{ _wfBaseSetup(att,tgt,data); data.spinAngle=0;
      data.tl=_makeTimeline([
        {frame:0, fn(){ CinCam.zoomTo(1.3); CinCam.focusMidpoint(att,tgt); CinCam.slowMo(0.25); }},
        {frame:12,fn(){ CinCam.focusOn(att); }},
        {frame:30,fn(){ CinCam.slowMo(0.07); CinCam.zoomTo(1.55); CinCam.focusMidpoint(att,tgt); }},
        {frame:40,fn(){ CinCam.slowMo(1.0); CinCam.shake(42); data.shockR=1;data.shockAlpha=1; spawnParticles(tgt.cx(),tgt.cy(),'#ff4422',48); spawnParticles(tgt.cx(),tgt.cy(),'#ff8844',18); CinCam.focusOn(tgt); CinCam.zoomTo(1.3); }},
        {frame:90,fn(){ CinCam.restore(); }},
      ]); },
    (att,tgt,timer,data)=>{ _tickTimeline(data.tl,timer); _wfTick(timer,120,data);
      data.spinAngle+=timer<40?0.45:0.1;
      if(timer<12){ att.x=data.ax0;att.y=data.ay0; data.auraAlpha=0; }
      else if(timer<40){ const p=(timer-12)/28; att.x=data.ax0+Math.cos(data.spinAngle)*22; att.y=data.ay0+Math.sin(data.spinAngle)*12; tgt.x=data.tx0;tgt.y=data.ty0; data.auraAlpha=p*0.9; data.auraR=25+p*30; }
      else{ const p=Math.min(1,(timer-40)/55); tgt.x=data.tx0+data.dir*_finEaseOut(p)*75; tgt.y=data.ty0-_finEaseOut(p)*32; att.x=data.ax0;att.y=data.ay0; data.auraAlpha=Math.max(0,data.auraAlpha-0.04); }
      att.vx=0;att.vy=0;tgt.vx=0;tgt.vy=0; },
    (ctx,att,tgt,t,timer,data)=>{
      const {scX,scY,ox,oy}=_finGameTransform();
      _finBars(ctx,data.bars); _finVignette(ctx,0.42);
      _wfDrawAura(ctx,att,'rgba(255,80,40,1)',data.auraAlpha,data.auraR,scX,scY,ox,oy);
      ctx.save();ctx.setTransform(scX,0,0,scY,ox,oy);
      if(timer>=12&&timer<40){ ctx.shadowColor='#ff4422';ctx.shadowBlur=30;ctx.strokeStyle='rgba(255,100,40,0.6)';ctx.lineWidth=2;ctx.beginPath();ctx.arc(att.cx(),att.cy(),38,0,Math.PI*2);ctx.stroke(); }
      if(data.shockR>0&&data.shockAlpha>0){ctx.strokeStyle=`rgba(255,80,40,${data.shockAlpha})`;ctx.lineWidth=6;ctx.shadowColor='#ff4422';ctx.shadowBlur=30;ctx.beginPath();ctx.arc(tgt.cx(),tgt.cy(),data.shockR,0,Math.PI*2);ctx.stroke();}
      ctx.restore();
      if(timer>=40&&timer<=48) _finFlash(ctx,(48-timer)/8*0.78,255,80,40);
      if(timer>53&&timer<108) _finSubtitle(ctx,'"You cannot stop the spin."',t);
      _finTitle(ctx,'SPINNING FURY',t,'rgba(255,80,40,1)');
    }
  ),

  // ── spear ────────────────────────────────────────────────────
  spear: _wfDef('PIERCING LANCE','rgba(40,200,255,1)',115,
    (att,tgt,data)=>{ _wfBaseSetup(att,tgt,data);
      data.tl=_makeTimeline([
        {frame:0, fn(){ CinCam.zoomTo(1.3); CinCam.focusMidpoint(att,tgt); CinCam.slowMo(0.25); }},
        {frame:12,fn(){ CinCam.focusOn(att); }},
        {frame:28,fn(){ CinCam.slowMo(0.07); CinCam.zoomTo(1.6); CinCam.focusMidpoint(att,tgt); }},
        {frame:38,fn(){ CinCam.slowMo(1.0); CinCam.shake(30); data.shockR=1;data.shockAlpha=1; spawnParticles(tgt.cx(),tgt.cy(),'#44ccff',35); CinCam.focusOn(tgt); CinCam.zoomTo(1.3); }},
        {frame:88,fn(){ CinCam.restore(); }},
      ]); },
    (att,tgt,timer,data)=>{ _tickTimeline(data.tl,timer); _wfTick(timer,115,data);
      if(timer<12){ att.x=data.ax0;tgt.x=data.tx0;tgt.y=data.ty0; data.auraAlpha=0; }
      else if(timer<28){ const p=(timer-12)/16; att.x=data.ax0; tgt.x=data.tx0;tgt.y=data.ty0; data.auraAlpha=p*0.75; data.auraR=18+p*28; }
      else if(timer<38){ const p=(timer-28)/10; att.x=data.ax0+data.dir*_finEaseIn(p)*75; tgt.x=data.tx0;tgt.y=data.ty0; data.auraAlpha=0.85; data.auraR=46; }
      else{ const p=Math.min(1,(timer-38)/52); tgt.x=data.tx0+data.dir*_finEaseOut(p)*90; tgt.y=data.ty0-_finEaseOut(p)*14; att.x=data.ax0+data.dir*75; att.y=data.ay0; data.auraAlpha=Math.max(0,data.auraAlpha-0.04); }
      att.vx=0;att.vy=0;tgt.vx=0;tgt.vy=0; },
    (ctx,att,tgt,t,timer,data)=>{
      const {scX,scY,ox,oy}=_finGameTransform();
      _finBars(ctx,data.bars); _finVignette(ctx,0.4);
      _wfDrawAura(ctx,att,'rgba(40,200,255,1)',data.auraAlpha,data.auraR,scX,scY,ox,oy);
      ctx.save();ctx.setTransform(scX,0,0,scY,ox,oy);
      if(timer>=12&&timer<38){ ctx.strokeStyle='rgba(80,220,255,0.75)';ctx.lineWidth=4;ctx.shadowColor='#44ccff';ctx.shadowBlur=22;ctx.beginPath();ctx.moveTo(att.cx(),att.cy());ctx.lineTo(att.cx()-data.dir*60,att.cy());ctx.stroke(); }
      if(data.shockR>0&&data.shockAlpha>0){ctx.strokeStyle=`rgba(40,200,255,${data.shockAlpha})`;ctx.lineWidth=5;ctx.shadowColor='#44ccff';ctx.shadowBlur=24;ctx.beginPath();ctx.arc(tgt.cx(),tgt.cy(),data.shockR,0,Math.PI*2);ctx.stroke();}
      ctx.restore();
      if(timer>=38&&timer<=46) _finFlash(ctx,(46-timer)/8*0.65,40,180,255);
      if(timer>50&&timer<102) _finSubtitle(ctx,'"Nothing can outrun this lance."',t);
      _finTitle(ctx,'PIERCING LANCE',t,'rgba(40,200,255,1)');
    }
  ),

  // ── scythe ───────────────────────────────────────────────────
  scythe: _wfDef("REAPER'S SWEEP",'rgba(80,255,120,1)',122,
    (att,tgt,data)=>{ _wfBaseSetup(att,tgt,data); data.sweepAngle=Math.PI*1.5;
      data.tl=_makeTimeline([
        {frame:0, fn(){ CinCam.zoomTo(1.3); CinCam.focusMidpoint(att,tgt); CinCam.slowMo(0.25); }},
        {frame:12,fn(){ CinCam.focusOn(att); }},
        {frame:30,fn(){ CinCam.slowMo(0.07); CinCam.zoomTo(1.52); CinCam.focusMidpoint(att,tgt); }},
        {frame:40,fn(){ CinCam.slowMo(1.0); CinCam.shake(36); data.shockR=1;data.shockAlpha=1; spawnParticles(tgt.cx(),tgt.cy(),'#44ff88',42); spawnParticles(tgt.cx(),tgt.cy(),'#ccffcc',14); CinCam.focusOn(tgt); CinCam.zoomTo(1.3); }},
        {frame:90,fn(){ CinCam.restore(); }},
      ]); },
    (att,tgt,timer,data)=>{ _tickTimeline(data.tl,timer); _wfTick(timer,122,data);
      data.sweepAngle+=timer<40?0.14*data.dir:0.02;
      if(timer<12){ att.x=data.ax0;att.y=data.ay0; data.auraAlpha=0; }
      else if(timer<40){ const p=(timer-12)/28; att.x=data.ax0;att.y=data.ay0; data.auraAlpha=p*0.8; data.auraR=30+p*28; }
      else{ const p=Math.min(1,(timer-40)/55); tgt.x=data.tx0+data.dir*_finEaseOut(p)*78; tgt.y=data.ty0-_finEaseOut(p)*30; att.x=data.ax0;att.y=data.ay0; data.auraAlpha=Math.max(0,data.auraAlpha-0.04); }
      if(timer<40){ tgt.x=data.tx0+Math.sin(data.sweepAngle)*6; tgt.y=data.ty0+Math.cos(data.sweepAngle)*4; }
      att.vx=0;att.vy=0;tgt.vx=0;tgt.vy=0; },
    (ctx,att,tgt,t,timer,data)=>{
      const {scX,scY,ox,oy}=_finGameTransform();
      _finBars(ctx,data.bars); _finVignette(ctx,0.46);
      _wfDrawAura(ctx,att,'rgba(80,255,120,1)',data.auraAlpha,data.auraR,scX,scY,ox,oy);
      ctx.save();ctx.setTransform(scX,0,0,scY,ox,oy);
      if(timer>=12&&timer<40){ ctx.strokeStyle='rgba(80,255,140,0.65)';ctx.lineWidth=3;ctx.shadowColor='#44ff88';ctx.shadowBlur=18;ctx.beginPath();ctx.arc(att.cx(),att.cy(),58,data.sweepAngle-Math.PI*0.75,data.sweepAngle+Math.PI*0.75);ctx.stroke(); }
      if(data.shockR>0&&data.shockAlpha>0){ctx.strokeStyle=`rgba(80,255,120,${data.shockAlpha})`;ctx.lineWidth=6;ctx.shadowColor='#44ff88';ctx.shadowBlur=28;ctx.beginPath();ctx.arc(tgt.cx(),tgt.cy(),data.shockR,0,Math.PI*2);ctx.stroke();}
      ctx.restore();
      if(timer>=40&&timer<=48) _finFlash(ctx,(48-timer)/8*0.68,60,220,100);
      if(timer>53&&timer<108) _finSubtitle(ctx,'"The harvest is complete."',t);
      _finTitle(ctx,"REAPER'S SWEEP",t,'rgba(80,255,120,1)');
    }
  ),

  // ── fryingpan ────────────────────────────────────────────────
  fryingpan: _wfDef('SWEET DREAMS','rgba(255,180,220,1)',115,
    (att,tgt,data)=>{ _wfBaseSetup(att,tgt,data);
      data.tl=_makeTimeline([
        {frame:0, fn(){ CinCam.zoomTo(1.3); CinCam.focusMidpoint(att,tgt); CinCam.slowMo(0.25); }},
        {frame:12,fn(){ CinCam.focusOn(att); }},
        {frame:28,fn(){ CinCam.slowMo(0.07); CinCam.zoomTo(1.58); CinCam.focusMidpoint(att,tgt); }},
        {frame:38,fn(){ CinCam.slowMo(1.0); CinCam.shake(32); data.shockR=1;data.shockAlpha=1; spawnParticles(tgt.cx(),tgt.cy(),'#ff88cc',34); spawnParticles(tgt.cx(),tgt.cy(),'#ffffff',14); CinCam.focusOn(tgt); CinCam.zoomTo(1.3); }},
        {frame:86,fn(){ CinCam.restore(); }},
      ]); },
    (att,tgt,timer,data)=>{ _tickTimeline(data.tl,timer); _wfTick(timer,115,data);
      if(timer<12){ att.x=data.ax0;att.y=data.ay0; data.auraAlpha=0; }
      else if(timer<38){ const p=(timer-12)/26; att.x=data.ax0+data.dir*_finEaseOut(p)*28; att.y=data.ay0; tgt.x=data.tx0;tgt.y=data.ty0; data.auraAlpha=p*0.7; data.auraR=22+p*24; }
      else{ const p=Math.min(1,(timer-38)/50); tgt.x=data.tx0+data.dir*_finEaseOut(p)*38; tgt.y=data.ty0+_finEaseOut(p)*35; att.x=data.ax0+data.dir*28; data.auraAlpha=Math.max(0,data.auraAlpha-0.04); }
      att.vx=0;att.vy=0;tgt.vx=0;tgt.vy=0; },
    (ctx,att,tgt,t,timer,data)=>{
      const {scX,scY,ox,oy}=_finGameTransform();
      _finBars(ctx,data.bars); _finVignette(ctx,0.36);
      _wfDrawAura(ctx,att,'rgba(255,180,220,1)',data.auraAlpha,data.auraR,scX,scY,ox,oy);
      ctx.save();ctx.setTransform(scX,0,0,scY,ox,oy);
      if(data.shockR>0&&data.shockAlpha>0){ for(let i=0;i<4;i++){ ctx.strokeStyle=`rgba(255,${150+i*20},${180+i*15},${data.shockAlpha*(0.8-i*0.15)})`; ctx.lineWidth=3+i; ctx.beginPath();ctx.arc(tgt.cx(),tgt.cy(),data.shockR*(0.5+i*0.2),0,Math.PI*2);ctx.stroke(); } }
      ctx.restore();
      if(timer>=38&&timer<=46) _finFlash(ctx,(46-timer)/8*0.72,255,180,220);
      if(timer>50&&timer<100) _finSubtitle(ctx,'"Nighty night."',t);
      _finTitle(ctx,'SWEET DREAMS',t,'rgba(255,180,220,1)');
    }
  ),

  // ── bow ──────────────────────────────────────────────────────
  bow: _wfDef('ARROW STORM','rgba(160,220,80,1)',120,
    (att,tgt,data)=>{ _wfBaseSetup(att,tgt,data); data.arrows=[];
      data.tl=_makeTimeline([
        {frame:0, fn(){ CinCam.zoomTo(1.3); CinCam.focusMidpoint(att,tgt); CinCam.slowMo(0.25); }},
        {frame:12,fn(){ CinCam.focusOn(att); }},
        {frame:26,fn(){ CinCam.slowMo(0.07); CinCam.zoomTo(1.52); CinCam.focusMidpoint(att,tgt); for(let i=0;i<6;i++) data.arrows.push({x:att.cx(),y:att.cy()-i*10,tx:tgt.cx()+(i-2)*12,ty:tgt.cy(),p:0,speed:0.055+i*0.007,done:false}); }},
        {frame:40,fn(){ CinCam.slowMo(1.0); CinCam.shake(26); data.shockR=1;data.shockAlpha=1; spawnParticles(tgt.cx(),tgt.cy(),'#aade50',38); CinCam.focusOn(tgt); CinCam.zoomTo(1.3); }},
        {frame:90,fn(){ CinCam.restore(); }},
      ]); },
    (att,tgt,timer,data)=>{ _tickTimeline(data.tl,timer); _wfTick(timer,120,data);
      const p12=(timer-12)/14; data.auraAlpha=timer>=12&&timer<40?Math.min(1,p12)*0.7:Math.max(0,(data.auraAlpha||0)-0.04); data.auraR=20+p12*20;
      for(const a of data.arrows){ if(!a.done){ a.p=Math.min(1,a.p+a.speed); a.x=_finLerp(att.cx(),a.tx,_finEaseIn(a.p)); a.y=_finLerp(att.cy()-10,a.ty,_finEaseIn(a.p)); if(a.p>=1)a.done=true; } }
      att.x=data.ax0;att.y=data.ay0; if(timer<40){tgt.x=data.tx0;tgt.y=data.ty0;}
      else{ const p2=Math.min(1,(timer-40)/55); tgt.x=data.tx0+data.dir*_finEaseOut(p2)*60; tgt.y=data.ty0-_finEaseOut(p2)*22; }
      att.vx=0;att.vy=0;tgt.vx=0;tgt.vy=0; },
    (ctx,att,tgt,t,timer,data)=>{
      const {scX,scY,ox,oy}=_finGameTransform();
      _finBars(ctx,data.bars); _finVignette(ctx,0.42);
      _wfDrawAura(ctx,att,'rgba(160,220,80,1)',data.auraAlpha||0,data.auraR||20,scX,scY,ox,oy);
      ctx.save();ctx.setTransform(scX,0,0,scY,ox,oy);
      for(const a of data.arrows){ if(a.p>0&&a.p<1){ const ca=Math.atan2(a.ty-(att.cy()-10),a.tx-att.cx()); ctx.strokeStyle='rgba(160,220,80,0.88)';ctx.lineWidth=2;ctx.shadowColor='#aade50';ctx.shadowBlur=12;ctx.beginPath();ctx.moveTo(a.x-Math.cos(ca)*9,a.y-Math.sin(ca)*9);ctx.lineTo(a.x+Math.cos(ca)*15,a.y+Math.sin(ca)*15);ctx.stroke(); } }
      if(data.shockR>0&&data.shockAlpha>0){ctx.strokeStyle=`rgba(160,220,80,${data.shockAlpha})`;ctx.lineWidth=5;ctx.shadowColor='#aade50';ctx.shadowBlur=24;ctx.beginPath();ctx.arc(tgt.cx(),tgt.cy(),data.shockR,0,Math.PI*2);ctx.stroke();}
      ctx.restore();
      if(timer>=40&&timer<=48) _finFlash(ctx,(48-timer)/8*0.62,140,210,60);
      if(timer>52&&timer<106) _finSubtitle(ctx,'"Every arrow finds its mark."',t);
      _finTitle(ctx,'ARROW STORM',t,'rgba(160,220,80,1)');
    }
  ),

  // ── boxinggloves ─────────────────────────────────────────────
  boxinggloves: _wfDef('KNOCKOUT','rgba(255,80,80,1)',118,
    (att,tgt,data)=>{ _wfBaseSetup(att,tgt,data);
      data.tl=_makeTimeline([
        {frame:0, fn(){ CinCam.zoomTo(1.3); CinCam.focusMidpoint(att,tgt); CinCam.slowMo(0.25); }},
        {frame:12,fn(){ CinCam.focusOn(att); }},
        {frame:28,fn(){ CinCam.slowMo(0.07); CinCam.zoomTo(1.58); CinCam.focusMidpoint(att,tgt); }},
        {frame:38,fn(){ CinCam.slowMo(1.0); CinCam.shake(48); data.shockR=1;data.shockAlpha=1; spawnParticles(tgt.cx(),tgt.cy(),'#ff4444',46); spawnParticles(tgt.cx(),tgt.cy(),'#ffaa44',18); CinCam.focusOn(tgt); CinCam.zoomTo(1.3); }},
        {frame:88,fn(){ CinCam.restore(); }},
      ]); },
    (att,tgt,timer,data)=>{ _tickTimeline(data.tl,timer); _wfTick(timer,118,data);
      if(timer<12){ att.x=data.ax0; data.auraAlpha=0; }
      else if(timer<38){ const p=(timer-12)/26; att.x=data.ax0+data.dir*_finEaseOut(p)*52; att.y=data.ay0; tgt.x=data.tx0;tgt.y=data.ty0; data.auraAlpha=p*0.85; data.auraR=22+p*30; }
      else{ const p=Math.min(1,(timer-38)/55); tgt.x=data.tx0+data.dir*_finEaseOut(p)*85; tgt.y=data.ty0-_finEaseOut(p)*20; att.x=data.ax0+data.dir*52; att.y=data.ay0; data.auraAlpha=Math.max(0,data.auraAlpha-0.04); }
      att.vx=0;att.vy=0;tgt.vx=0;tgt.vy=0; },
    (ctx,att,tgt,t,timer,data)=>{
      const {scX,scY,ox,oy}=_finGameTransform();
      _finBars(ctx,data.bars); _finVignette(ctx,0.44);
      _wfDrawAura(ctx,att,'rgba(255,80,80,1)',data.auraAlpha,data.auraR,scX,scY,ox,oy);
      ctx.save();ctx.setTransform(scX,0,0,scY,ox,oy);
      if(data.shockR>0&&data.shockAlpha>0){_finImpactLines(ctx,tgt.cx(),tgt.cy(),14,data.shockR*0.58,'#ff4444',5+data.shockAlpha*3);}
      ctx.restore();
      if(timer>=38&&timer<=46) _finFlash(ctx,(46-timer)/8*0.82,255,60,60);
      if(timer>50&&timer<105) _finSubtitle(ctx,'"Lights out."',t);
      _finTitle(ctx,'KNOCKOUT',t,'rgba(255,80,80,1)');
    }
  ),
};

// ============================================================
// CLASS FINISHER DEFINITIONS
// ============================================================
const CLASS_FINISHERS = {

  // ── thor ─────────────────────────────────────────────────────
  thor: _wfDef('THUNDER GOD','rgba(80,160,255,1)',125,
    (att,tgt,data)=>{ _wfBaseSetup(att,tgt,data); data.bolts=[];
      data.tl=_makeTimeline([
        {frame:0, fn(){ CinCam.zoomTo(1.3); CinCam.focusMidpoint(att,tgt); CinCam.slowMo(0.25); }},
        {frame:12,fn(){ CinCam.focusOn(att); }},
        {frame:28,fn(){ CinCam.slowMo(0.07); CinCam.zoomTo(1.5); CinCam.focusMidpoint(att,tgt); for(let i=0;i<5;i++) data.bolts.push({x:tgt.cx()+(Math.random()-0.5)*90}); }},
        {frame:40,fn(){ CinCam.slowMo(1.0); CinCam.shake(42); data.shockR=1;data.shockAlpha=1; spawnParticles(tgt.cx(),tgt.cy(),'#4488ff',50); spawnParticles(tgt.cx(),tgt.cy(),'#ffffff',20); CinCam.focusOn(tgt); CinCam.zoomTo(1.3); }},
        {frame:92,fn(){ CinCam.restore(); }},
      ]); },
    (att,tgt,timer,data)=>{ _tickTimeline(data.tl,timer); _wfTick(timer,125,data);
      if(timer<12){ att.x=data.ax0;att.y=data.ay0; data.auraAlpha=0; }
      else if(timer<40){ const p=(timer-12)/28; att.x=data.ax0;att.y=data.ay0; data.auraAlpha=p*0.85; data.auraR=28+p*26; }
      if(timer<=40){ tgt.x=data.tx0;tgt.y=data.ty0; }
      else{ const p=Math.min(1,(timer-40)/55); tgt.x=data.tx0+data.dir*_finEaseOut(p)*60; tgt.y=data.ty0+_finEaseOut(p)*25; data.auraAlpha=Math.max(0,data.auraAlpha-0.04); }
      att.vx=0;att.vy=0;tgt.vx=0;tgt.vy=0; },
    (ctx,att,tgt,t,timer,data)=>{
      const {scX,scY,ox,oy}=_finGameTransform();
      _finBars(ctx,data.bars); _finVignette(ctx,0.46);
      _wfDrawAura(ctx,att,'rgba(80,160,255,1)',data.auraAlpha,data.auraR,scX,scY,ox,oy);
      ctx.save();ctx.setTransform(scX,0,0,scY,ox,oy);
      if(timer>=28&&timer<=48){ for(const b of data.bolts){ _finLightning(ctx,b.x,0,b.x+(Math.random()-0.5)*22,tgt.cy(),'#88ccff',3); } }
      if(data.shockR>0&&data.shockAlpha>0){ctx.strokeStyle=`rgba(80,160,255,${data.shockAlpha})`;ctx.lineWidth=6;ctx.shadowColor='#4488ff';ctx.shadowBlur=32;ctx.beginPath();ctx.arc(tgt.cx(),tgt.cy(),data.shockR,0,Math.PI*2);ctx.stroke();}
      ctx.restore();
      if(timer>=40&&timer<=48) _finFlash(ctx,(48-timer)/8*0.78,80,150,255);
      if(timer>55&&timer<110) _finSubtitle(ctx,'"By the power of the storm."',t);
      _finTitle(ctx,'THUNDER GOD',t,'rgba(80,160,255,1)');
    }
  ),

  // ── kratos ───────────────────────────────────────────────────
  kratos: _wfDef('SPARTAN RAGE','rgba(220,60,60,1)',120,
    (att,tgt,data)=>{ _wfBaseSetup(att,tgt,data); data.ragePulse=0;
      data.tl=_makeTimeline([
        {frame:0, fn(){ CinCam.zoomTo(1.3); CinCam.focusMidpoint(att,tgt); CinCam.slowMo(0.25); }},
        {frame:12,fn(){ CinCam.focusOn(att); }},
        {frame:28,fn(){ CinCam.slowMo(0.07); CinCam.zoomTo(1.55); CinCam.focusMidpoint(att,tgt); }},
        {frame:40,fn(){ CinCam.slowMo(1.0); CinCam.shake(52); data.shockR=1;data.shockAlpha=1; spawnParticles(tgt.cx(),tgt.cy(),'#cc2222',58); spawnParticles(tgt.cx(),tgt.cy(),'#ff6600',24); CinCam.focusOn(tgt); CinCam.zoomTo(1.3); }},
        {frame:90,fn(){ CinCam.restore(); }},
      ]); },
    (att,tgt,timer,data)=>{ _tickTimeline(data.tl,timer); _wfTick(timer,120,data);
      data.ragePulse+=0.3;
      if(timer<12){ att.x=data.ax0; data.auraAlpha=0; }
      else if(timer<40){ const p=(timer-12)/28; att.x=data.ax0+data.dir*_finEaseOut(p)*65; att.y=data.ay0; tgt.x=data.tx0;tgt.y=data.ty0; data.auraAlpha=p*0.9; data.auraR=26+p*28; }
      else{ const p=Math.min(1,(timer-40)/55); tgt.x=data.tx0+data.dir*_finEaseOut(p)*95; tgt.y=data.ty0-_finEaseOut(p)*22; att.x=data.ax0+data.dir*65; att.y=data.ay0; data.auraAlpha=Math.max(0,data.auraAlpha-0.04); }
      att.vx=0;att.vy=0;tgt.vx=0;tgt.vy=0; },
    (ctx,att,tgt,t,timer,data)=>{
      const {scX,scY,ox,oy}=_finGameTransform();
      _finBars(ctx,data.bars); _finVignette(ctx,0.46);
      _wfDrawAura(ctx,att,'rgba(220,60,60,1)',data.auraAlpha,data.auraR,scX,scY,ox,oy);
      ctx.save();ctx.setTransform(scX,0,0,scY,ox,oy);
      if(data.shockR>0&&data.shockAlpha>0){_finImpactLines(ctx,tgt.cx(),tgt.cy(),16,data.shockR*0.6,'#cc2222',5+data.shockAlpha*3);}
      ctx.restore();
      if(timer>=40&&timer<=48) _finFlash(ctx,(48-timer)/8*0.84,200,50,50);
      if(timer>54&&timer<106) _finSubtitle(ctx,'"BOY. This ends now."',t);
      _finTitle(ctx,'SPARTAN RAGE',t,'rgba(220,60,60,1)');
    }
  ),

  // ── ninja ────────────────────────────────────────────────────
  ninja: _wfDef('SHADOW STRIKE','rgba(100,100,200,1)',118,
    (att,tgt,data)=>{ _wfBaseSetup(att,tgt,data);
      data.tl=_makeTimeline([
        {frame:0, fn(){ CinCam.zoomTo(1.3); CinCam.focusMidpoint(att,tgt); CinCam.slowMo(0.25); }},
        {frame:12,fn(){ CinCam.focusOn(att); }},
        {frame:28,fn(){ CinCam.slowMo(0.07); CinCam.zoomTo(1.62); CinCam.focusMidpoint(att,tgt); }},
        {frame:38,fn(){ att.x=tgt.cx()+data.dir*22; att.y=tgt.cy(); CinCam.slowMo(1.0); CinCam.shake(34); data.shockR=1;data.shockAlpha=1; spawnParticles(tgt.cx(),tgt.cy(),'#4444aa',36); spawnParticles(tgt.cx(),tgt.cy(),'#8888dd',16); CinCam.focusOn(tgt); CinCam.zoomTo(1.3); }},
        {frame:88,fn(){ CinCam.restore(); }},
      ]); },
    (att,tgt,timer,data)=>{ _tickTimeline(data.tl,timer); _wfTick(timer,118,data);
      if(timer<12){ att.x=data.ax0;att.y=data.ay0; data.auraAlpha=0; }
      else if(timer<28){ const p=(timer-12)/16; att.x=data.ax0; data.auraAlpha=p*0.7; data.auraR=20+p*24; }
      else if(timer<38){ const p=(timer-28)/10; att.x=data.ax0; data.auraAlpha=0.8; data.auraR=44; }
      if(timer<38){ tgt.x=data.tx0;tgt.y=data.ty0; }
      else{ const p=Math.min(1,(timer-38)/55); tgt.x=data.tx0+data.dir*_finEaseOut(p)*75; tgt.y=data.ty0-_finEaseOut(p)*32; data.auraAlpha=Math.max(0,data.auraAlpha-0.04); }
      att.vx=0;att.vy=0;tgt.vx=0;tgt.vy=0; },
    (ctx,att,tgt,t,timer,data)=>{
      const {scX,scY,ox,oy}=_finGameTransform();
      _finBars(ctx,data.bars); _finVignette(ctx,0.54);
      _wfDrawAura(ctx,att,'rgba(100,100,200,1)',data.auraAlpha,data.auraR,scX,scY,ox,oy);
      ctx.save();ctx.setTransform(scX,0,0,scY,ox,oy);
      if(data.shockR>0&&data.shockAlpha>0){ctx.strokeStyle=`rgba(100,100,180,${data.shockAlpha})`;ctx.lineWidth=5;ctx.shadowColor='#6666cc';ctx.shadowBlur=26;ctx.beginPath();ctx.arc(tgt.cx(),tgt.cy(),data.shockR,0,Math.PI*2);ctx.stroke();}
      ctx.restore();
      if(timer>=38&&timer<=46) _finFlash(ctx,(46-timer)/8*0.62,60,60,120);
      if(timer>50&&timer<104) _finSubtitle(ctx,'"You never even saw me coming."',t);
      _finTitle(ctx,'SHADOW STRIKE',t,'rgba(100,100,200,1)');
    }
  ),

  // ── gunner ───────────────────────────────────────────────────
  gunner: _wfDef('EXECUTION','rgba(255,200,50,1)',118,
    (att,tgt,data)=>{ _wfBaseSetup(att,tgt,data); data.muzzleFlash=0; data.bX=0; data.bY=0; data.bDone=false;
      data.tl=_makeTimeline([
        {frame:0, fn(){ CinCam.zoomTo(1.3); CinCam.focusMidpoint(att,tgt); CinCam.slowMo(0.25); }},
        {frame:12,fn(){ CinCam.focusOn(att); }},
        {frame:28,fn(){ CinCam.slowMo(0.07); CinCam.zoomTo(1.65); CinCam.focusOn(tgt); }},
        {frame:40,fn(){ CinCam.slowMo(1.0); CinCam.shake(25); data.shockR=1;data.shockAlpha=1; data.muzzleFlash=12; spawnParticles(tgt.cx(),tgt.cy(),'#ffcc44',28); CinCam.focusOn(tgt); CinCam.zoomTo(1.3); }},
        {frame:88,fn(){ CinCam.restore(); }},
      ]); },
    (att,tgt,timer,data)=>{ _tickTimeline(data.tl,timer); _wfTick(timer,118,data);
      if(data.muzzleFlash>0) data.muzzleFlash--;
      if(timer<28){ const p=Math.max(0,(timer-12)/16); data.auraAlpha=p*0.65; data.auraR=18+p*20; data.bX=att.cx();data.bY=att.cy(); }
      else if(timer<40){ const p=(timer-28)/12; data.bX=_finLerp(att.cx(),tgt.cx(),p); data.bY=_finLerp(att.cy(),tgt.cy(),p); }
      else{ data.bDone=true; }
      att.x=data.ax0;att.y=data.ay0;
      if(timer<40){tgt.x=data.tx0;tgt.y=data.ty0;}
      else{ const p=Math.min(1,(timer-40)/55); tgt.x=data.tx0+data.dir*_finEaseOut(p)*70; tgt.y=data.ty0-_finEaseOut(p)*18; data.auraAlpha=Math.max(0,data.auraAlpha-0.04); }
      att.vx=0;att.vy=0;tgt.vx=0;tgt.vy=0; },
    (ctx,att,tgt,t,timer,data)=>{
      const {scX,scY,ox,oy}=_finGameTransform();
      _finBars(ctx,data.bars); _finVignette(ctx,0.48);
      _wfDrawAura(ctx,att,'rgba(255,200,50,1)',data.auraAlpha,data.auraR,scX,scY,ox,oy);
      if(data.muzzleFlash>0) _finFlash(ctx,data.muzzleFlash/12*0.65,255,200,50);
      ctx.save();ctx.setTransform(scX,0,0,scY,ox,oy);
      if(!data.bDone&&data.bX>0){ ctx.strokeStyle='rgba(255,220,80,0.9)';ctx.lineWidth=4;ctx.shadowColor='#ffcc44';ctx.shadowBlur=20;ctx.beginPath();ctx.moveTo(att.cx(),att.cy());ctx.lineTo(data.bX,data.bY);ctx.stroke(); ctx.fillStyle='#ffffaa';ctx.beginPath();ctx.arc(data.bX,data.bY,5,0,Math.PI*2);ctx.fill(); }
      if(data.shockR>0&&data.shockAlpha>0){ctx.strokeStyle=`rgba(255,200,50,${data.shockAlpha})`;ctx.lineWidth=5;ctx.shadowColor='#ffcc44';ctx.shadowBlur=24;ctx.beginPath();ctx.arc(tgt.cx(),tgt.cy(),data.shockR,0,Math.PI*2);ctx.stroke();}
      ctx.restore();
      if(timer>52&&timer<104) _finSubtitle(ctx,'"Dead on arrival."',t);
      _finTitle(ctx,'EXECUTION',t,'rgba(255,200,50,1)');
    }
  ),

  // ── paladin ──────────────────────────────────────────────────
  paladin: _wfDef('HOLY JUDGMENT','rgba(255,240,120,1)',125,
    (att,tgt,data)=>{ _wfBaseSetup(att,tgt,data); data.holyR=0;
      data.tl=_makeTimeline([
        {frame:0, fn(){ CinCam.zoomTo(1.3); CinCam.focusMidpoint(att,tgt); CinCam.slowMo(0.25); }},
        {frame:12,fn(){ CinCam.focusOn(att); }},
        {frame:30,fn(){ CinCam.slowMo(0.07); CinCam.zoomTo(1.52); CinCam.focusMidpoint(att,tgt); }},
        {frame:42,fn(){ CinCam.slowMo(1.0); CinCam.shake(40); data.shockR=1;data.shockAlpha=1; spawnParticles(tgt.cx(),tgt.cy(),'#ffe888',52); spawnParticles(tgt.cx(),tgt.cy(),'#ffffff',22); CinCam.focusOn(tgt); CinCam.zoomTo(1.3); }},
        {frame:94,fn(){ CinCam.restore(); }},
      ]); },
    (att,tgt,timer,data)=>{ _tickTimeline(data.tl,timer); _wfTick(timer,125,data);
      if(timer>=12) data.holyR=Math.min(110,(timer-12)*3.2);
      if(timer<12){ att.x=data.ax0;att.y=data.ay0; data.auraAlpha=0; }
      else if(timer<42){ const p=(timer-12)/30; att.x=data.ax0;att.y=data.ay0; data.auraAlpha=p*0.8; data.auraR=26+p*30; }
      if(timer<=42){ tgt.x=data.tx0;tgt.y=data.ty0; }
      else{ const p=Math.min(1,(timer-42)/55); tgt.x=data.tx0; tgt.y=data.ty0+_finEaseOut(p)*58; data.auraAlpha=Math.max(0,data.auraAlpha-0.04); }
      att.vx=0;att.vy=0;tgt.vx=0;tgt.vy=0; },
    (ctx,att,tgt,t,timer,data)=>{
      const {scX,scY,ox,oy}=_finGameTransform();
      _finBars(ctx,data.bars); _finVignette(ctx,0.42);
      _wfDrawAura(ctx,att,'rgba(255,240,120,1)',data.auraAlpha,data.auraR,scX,scY,ox,oy);
      ctx.save();ctx.setTransform(scX,0,0,scY,ox,oy);
      if(timer>=12&&timer<60){ const ha=Math.min(1,(timer-12)/22); const grd=ctx.createLinearGradient(tgt.cx(),tgt.y-200,tgt.cx(),tgt.y+tgt.h); grd.addColorStop(0,'rgba(255,240,120,0)');grd.addColorStop(0.5,`rgba(255,240,120,${ha*0.45})`);grd.addColorStop(1,'rgba(255,240,120,0)'); ctx.fillStyle=grd;ctx.fillRect(tgt.cx()-36,tgt.y-200,72,tgt.h+200); }
      if(data.shockR>0&&data.shockAlpha>0){ctx.strokeStyle=`rgba(255,240,120,${data.shockAlpha})`;ctx.lineWidth=6;ctx.shadowColor='#ffe888';ctx.shadowBlur=32;ctx.beginPath();ctx.arc(tgt.cx(),tgt.cy(),data.shockR,0,Math.PI*2);ctx.stroke();}
      ctx.restore();
      if(timer>=42&&timer<=50) _finFlash(ctx,(50-timer)/8*0.78,255,240,100);
      if(timer>56&&timer<112) _finSubtitle(ctx,'"Divine justice is absolute."',t);
      _finTitle(ctx,'HOLY JUDGMENT',t,'rgba(255,240,120,1)');
    }
  ),

  // ── berserker ────────────────────────────────────────────────
  berserker: _wfDef('BLOOD FRENZY','rgba(200,0,60,1)',120,
    (att,tgt,data)=>{ _wfBaseSetup(att,tgt,data); data.frenzyAngle=0;
      data.tl=_makeTimeline([
        {frame:0, fn(){ CinCam.zoomTo(1.3); CinCam.focusMidpoint(att,tgt); CinCam.slowMo(0.25); }},
        {frame:12,fn(){ CinCam.focusOn(att); }},
        {frame:28,fn(){ CinCam.slowMo(0.07); CinCam.zoomTo(1.55); CinCam.focusMidpoint(att,tgt); }},
        {frame:38,fn(){ CinCam.slowMo(1.0); CinCam.shake(50); data.shockR=1;data.shockAlpha=1; spawnParticles(tgt.cx(),tgt.cy(),'#cc0030',55); spawnParticles(tgt.cx(),tgt.cy(),'#ff2244',22); CinCam.focusOn(tgt); CinCam.zoomTo(1.3); }},
        {frame:90,fn(){ CinCam.restore(); }},
      ]); },
    (att,tgt,timer,data)=>{ _tickTimeline(data.tl,timer); _wfTick(timer,120,data);
      data.frenzyAngle+=timer<38?0.52:0.1;
      if(timer<12){ att.x=data.ax0;att.y=data.ay0; data.auraAlpha=0; }
      else if(timer<38){ const p=(timer-12)/26; att.x=data.ax0+Math.cos(data.frenzyAngle)*14; att.y=data.ay0+Math.sin(data.frenzyAngle)*9; tgt.x=data.tx0;tgt.y=data.ty0; data.auraAlpha=p*0.9; data.auraR=26+p*28; }
      else{ const p=Math.min(1,(timer-38)/55); tgt.x=data.tx0+data.dir*_finEaseOut(p)*90; tgt.y=data.ty0-_finEaseOut(p)*32; att.x=data.ax0;att.y=data.ay0; data.auraAlpha=Math.max(0,data.auraAlpha-0.04); }
      att.vx=0;att.vy=0;tgt.vx=0;tgt.vy=0; },
    (ctx,att,tgt,t,timer,data)=>{
      const {scX,scY,ox,oy}=_finGameTransform();
      _finBars(ctx,data.bars); _finVignette(ctx,0.48);
      _wfDrawAura(ctx,att,'rgba(200,0,60,1)',data.auraAlpha,data.auraR,scX,scY,ox,oy);
      ctx.save();ctx.setTransform(scX,0,0,scY,ox,oy);
      if(data.shockR>0&&data.shockAlpha>0){_finImpactLines(ctx,tgt.cx(),tgt.cy(),18,data.shockR*0.62,'#cc0030',6+data.shockAlpha*3);}
      ctx.restore();
      if(timer>=38&&timer<=46) _finFlash(ctx,(46-timer)/8*0.86,200,0,50);
      if(timer>52&&timer<106) _finSubtitle(ctx,'"Pain is the point."',t);
      _finTitle(ctx,'BLOOD FRENZY',t,'rgba(200,0,60,1)');
    }
  ),

  // ── archer ───────────────────────────────────────────────────
  archer: _wfDef('VOLLEY','rgba(120,200,80,1)',120,
    (att,tgt,data)=>{ _wfBaseSetup(att,tgt,data); data.volArrows=[];
      for(let i=0;i<7;i++) data.volArrows.push({p:0,delay:i*0.09,cx:0,cy:0});
      data.tl=_makeTimeline([
        {frame:0, fn(){ CinCam.zoomTo(1.3); CinCam.focusMidpoint(att,tgt); CinCam.slowMo(0.25); }},
        {frame:12,fn(){ CinCam.focusOn(att); }},
        {frame:28,fn(){ CinCam.slowMo(0.07); CinCam.zoomTo(1.52); CinCam.focusMidpoint(att,tgt); }},
        {frame:40,fn(){ CinCam.slowMo(1.0); CinCam.shake(28); data.shockR=1;data.shockAlpha=1; spawnParticles(tgt.cx(),tgt.cy(),'#88cc44',40); CinCam.focusOn(tgt); CinCam.zoomTo(1.3); }},
        {frame:90,fn(){ CinCam.restore(); }},
      ]); },
    (att,tgt,timer,data)=>{ _tickTimeline(data.tl,timer); _wfTick(timer,120,data);
      if(timer<12){ data.auraAlpha=0; }
      else if(timer<40){ const p=(timer-12)/28; data.auraAlpha=p*0.72; data.auraR=20+p*22; }
      else{ data.auraAlpha=Math.max(0,data.auraAlpha-0.04); }
      for(const a of data.volArrows){ const eff=Math.max(0,(timer/62)-a.delay); a.p=Math.min(1,eff*1.3); a.cx=_finLerp(att.cx(),tgt.cx()+(Math.random()-0.5)*28,_finEaseIn(a.p)); a.cy=_finLerp(att.cy()-22,tgt.cy()+(Math.random()-0.5)*18,_finEaseIn(a.p)); }
      att.x=data.ax0;att.y=data.ay0;
      if(timer<40){tgt.x=data.tx0;tgt.y=data.ty0;}
      else{ const p=Math.min(1,(timer-40)/55); tgt.x=data.tx0+data.dir*_finEaseOut(p)*65; tgt.y=data.ty0-_finEaseOut(p)*24; }
      att.vx=0;att.vy=0;tgt.vx=0;tgt.vy=0; },
    (ctx,att,tgt,t,timer,data)=>{
      const {scX,scY,ox,oy}=_finGameTransform();
      _finBars(ctx,data.bars); _finVignette(ctx,0.42);
      _wfDrawAura(ctx,att,'rgba(120,200,80,1)',data.auraAlpha,data.auraR,scX,scY,ox,oy);
      ctx.save();ctx.setTransform(scX,0,0,scY,ox,oy);
      for(const a of data.volArrows){ if(a.p>0&&a.p<1){ const ang=Math.atan2(tgt.cy()-att.cy(),tgt.cx()-att.cx()); ctx.strokeStyle='rgba(120,200,80,0.85)';ctx.lineWidth=2;ctx.shadowColor='#88cc44';ctx.shadowBlur=12;ctx.beginPath();ctx.moveTo(a.cx-Math.cos(ang)*10,a.cy-Math.sin(ang)*10);ctx.lineTo(a.cx+Math.cos(ang)*13,a.cy+Math.sin(ang)*13);ctx.stroke(); } }
      if(data.shockR>0&&data.shockAlpha>0){ctx.strokeStyle=`rgba(120,200,80,${data.shockAlpha})`;ctx.lineWidth=5;ctx.shadowColor='#88cc44';ctx.shadowBlur=24;ctx.beginPath();ctx.arc(tgt.cx(),tgt.cy(),data.shockR,0,Math.PI*2);ctx.stroke();}
      ctx.restore();
      if(timer>=40&&timer<=48) _finFlash(ctx,(48-timer)/8*0.62,100,190,60);
      if(timer>53&&timer<107) _finSubtitle(ctx,'"Rain of arrows. No escape."',t);
      _finTitle(ctx,'VOLLEY',t,'rgba(120,200,80,1)');
    }
  ),

  // ── megaknight ───────────────────────────────────────────────
  megaknight: _wfDef('FINAL JUDGMENT','rgba(220,180,40,1)',128,
    (att,tgt,data)=>{ _wfBaseSetup(att,tgt,data); data.leapY=0;
      // Clamp slam landing Y so attacker never goes below the floor
      const _floorPl = currentArena && currentArena.platforms && currentArena.platforms.find(pl => pl.isFloor && !pl.isFloorDisabled);
      const _floorY  = _floorPl ? _floorPl.y : GAME_H - 160;
      data.slamLandY = Math.min(data.ay0, _floorY - att.h - 4);
      data.tl=_makeTimeline([
        {frame:0, fn(){ CinCam.zoomTo(1.3); CinCam.focusMidpoint(att,tgt); CinCam.slowMo(0.25); }},
        {frame:12,fn(){ CinCam.focusOn(att); }},
        {frame:30,fn(){ CinCam.slowMo(0.07); CinCam.zoomTo(1.55); CinCam.focusMidpoint(att,tgt); }},
        {frame:44,fn(){ CinCam.slowMo(1.0); CinCam.shake(58); data.shockR=1;data.shockAlpha=1; spawnParticles(tgt.cx(),tgt.cy(),'#ccaa22',62); spawnParticles(tgt.cx(),tgt.cy(),'#ffffff',28); spawnParticles(tgt.cx(),tgt.cy(),'#ffe066',22); CinCam.focusOn(tgt); CinCam.zoomTo(1.3); }},
        {frame:96,fn(){ CinCam.restore(); }},
      ]); },
    (att,tgt,timer,data)=>{ _tickTimeline(data.tl,timer); _wfTick(timer,128,data);
      if(timer<12){ att.x=data.ax0;att.y=data.ay0; data.auraAlpha=0; }
      else if(timer<30){ const p=(timer-12)/18; data.leapY=_finEaseOut(p)*(-90); att.x=data.ax0;att.y=data.ay0+data.leapY; tgt.x=data.tx0;tgt.y=data.ty0; data.auraAlpha=p*0.8; data.auraR=28+p*26; }
      else if(timer<44){ const p=(timer-30)/14; att.x=data.ax0+data.dir*_finEaseOut(p)*60; att.y=data.ay0-90+_finEaseIn(p)*(90+(data.slamLandY-(data.ay0-90))); tgt.x=data.tx0;tgt.y=data.ty0; data.auraAlpha=0.88; data.auraR=54; }
      else{ const p=Math.min(1,(timer-44)/58); tgt.x=data.tx0; tgt.y=data.ty0+_finEaseOut(p)*68; att.x=data.ax0+data.dir*60;att.y=data.slamLandY; data.auraAlpha=Math.max(0,data.auraAlpha-0.04); }
      att.vx=0;att.vy=0;tgt.vx=0;tgt.vy=0; },
    (ctx,att,tgt,t,timer,data)=>{
      const {scX,scY,ox,oy}=_finGameTransform();
      _finBars(ctx,data.bars); _finVignette(ctx,0.46);
      _wfDrawAura(ctx,att,'rgba(220,180,40,1)',data.auraAlpha,data.auraR,scX,scY,ox,oy);
      ctx.save();ctx.setTransform(scX,0,0,scY,ox,oy);
      if(data.shockR>0&&data.shockAlpha>0){ ctx.strokeStyle=`rgba(220,180,40,${data.shockAlpha})`;ctx.lineWidth=6+data.shockAlpha*4;ctx.shadowColor='#ffaa00';ctx.shadowBlur=28;ctx.beginPath();ctx.arc(tgt.cx(),tgt.cy(),data.shockR,0,Math.PI*2);ctx.stroke(); _finImpactLines(ctx,tgt.cx(),tgt.cy(),14,data.shockR*0.5,'#ffcc00',4); }
      ctx.restore();
      if(timer>=44&&timer<=52) _finFlash(ctx,(52-timer)/8*0.92,255,220,100);
      if(timer>58&&timer<114) _finSubtitle(ctx,'"Kneel before the knight eternal."',t);
      _finTitle(ctx,'FINAL JUDGMENT',t,'rgba(220,180,40,1)');
    }
  ),
};

// ============================================================
// FINISHER PICKER
// ============================================================
function _pickFinisher(attacker) {
  const wKey = attacker.weaponKey;
  const cKey = attacker.charClass;
  const haW  = !!(WEAPON_FINISHERS[wKey]);
  // Class finisher only fires if the class has no locked weapon OR the attacker is still using it
  const classLockedWeapon = cKey && typeof CLASSES !== 'undefined' && CLASSES[cKey] && CLASSES[cKey].weapon;
  const classWeaponMatch  = !classLockedWeapon || attacker.weaponKey === classLockedWeapon;
  const haC  = cKey && cKey !== 'none' && classWeaponMatch && !!(CLASS_FINISHERS[cKey]);

  if (!haW && !haC) return null;
  if ( haW && !haC) return { key: wKey,          def: WEAPON_FINISHERS[wKey] };
  if (!haW &&  haC) return { key: 'class_'+cKey, def: CLASS_FINISHERS[cKey]  };

  // Both — weighted 50/50 with consecutive-skip bonus (+10% per skip, capped 10/90)
  const wSkips = attacker._finSkipW || 0;
  const cSkips = attacker._finSkipC || 0;
  const wChance = Math.max(0.1, Math.min(0.9, 0.5 + (cSkips - wSkips) * 0.1));
  if (Math.random() < wChance) {
    attacker._finSkipW = 0;
    attacker._finSkipC = cSkips + 1;
    return { key: wKey, def: WEAPON_FINISHERS[wKey] };
  } else {
    attacker._finSkipC = 0;
    attacker._finSkipW = wSkips + 1;
    return { key: 'class_'+cKey, def: CLASS_FINISHERS[cKey] };
  }
}

// ── Per-character boss finisher pools ────────────────────────
const _TF_KILL_POOL      = [FIN_VOID_SLAM, FIN_REALITY_BREAK, FIN_TF_ERASURE, FIN_TF_PHASE_SHIFT];
const _CREATOR_KILL_POOL = [FIN_SKY_EXECUTION, FIN_DARKNESS_FALLS, FIN_CR_CODE_DELETION];
const _YETI_KILL_POOL    = [FIN_YETI_AVALANCHE, FIN_YETI_POLAR_SLAM, FIN_YETI_ICE_BURIAL];
const _BEAST_KILL_POOL   = [FIN_BEAST_FERAL_TACKLE, FIN_BEAST_NATURE_DEVOUR, FIN_BEAST_SAVAGE_LAUNCH];
// Legacy fallback
const _BOSS_KILL_POOL    = [FIN_VOID_SLAM, FIN_REALITY_BREAK, FIN_SKY_EXECUTION, FIN_DARKNESS_FALLS];

// ============================================================
// TRIGGER
// ============================================================
function triggerFinisher(attacker, target) {
  if (!settings.finishers) return false;
  if (activeFinisher)      return false;
  if (!attacker || !target) return false;
  if (trainingMode || tutorialMode) return false;
  if (onlineMode)          return false;

  let def = null;

  if (attacker.isBoss && !target.isBoss) {
    // Boss kills player — pick from character-specific pool
    let _pool;
    if (attacker.isTrueForm)           _pool = _TF_KILL_POOL;
    else if (attacker.isYeti)          _pool = _YETI_KILL_POOL;
    else if (attacker.isBeast)         _pool = _BEAST_KILL_POOL;
    else                               _pool = _CREATOR_KILL_POOL;
    def = _pool[Math.floor(Math.random() * _pool.length)];
  } else if (target.isBoss && !attacker.isBoss) {
    // Player kills boss
    def = FIN_HEROS_TRIUMPH;
  } else if (!attacker.isBoss && !target.isBoss) {
    // Player vs player
    const picked = _pickFinisher(attacker);
    if (!picked) return false;
    def = picked.def;
  } else {
    return false;
  }

  if (!def) return false;

  // Freeze target alive
  target.health    = 1;
  target.invincible = 9999;
  target.vx = 0; target.vy = 0;
  attacker.vx = 0; attacker.vy = 0;

  const data = {};
  if (def.setup) def.setup(attacker, target, data);

  activeFinisher = {
    attacker,
    target,
    timer: 0,
    totalDuration: def.duration || 90,
    def,
    data,
  };

  // Block processInput() and updateAI() during the finisher
  activeCinematic = _makeFinisherSentinel();
  isCinematic = true;
  if (typeof setCombatLock === 'function') setCombatLock('finisher');

  // Completely stop the game world — physics, particles, everything freezes
  slowMotion = 0;

  return true;
}

// ============================================================
// UPDATE (called each frame between player update + draw)
// ============================================================
function updateFinisher() {
  if (!activeFinisher) return;
  const { attacker, target, def, data } = activeFinisher;

  // Keep target frozen
  target.invincible = Math.max(target.invincible, 2);
  // Keep attacker from drifting under gravity
  attacker.invincible = Math.max(attacker.invincible, 2);

  if (def.update) def.update(attacker, target, activeFinisher.timer, data);

  activeFinisher.timer++;

  if (activeFinisher.timer >= activeFinisher.totalDuration) {
    // Restore camera / time
    CinCam.restore();
    slowMotion = 1.0; // resume game world
    // End sentinel so processInput + AI come back
    if (activeCinematic && activeCinematic._isFinisherSentinel) {
      activeCinematic = null;
    }
    isCinematic = false;
    if (typeof clearCombatLock === 'function') clearCombatLock('finisher');
    // Let normal death logic take over
    target.health    = 0;
    target.invincible = 0;
    activeFinisher   = null;
  }
}

// ============================================================
// DRAW (called in screen-space after drawAchievementPopups)
// ============================================================
function drawFinisher(ctx) {
  if (!activeFinisher) return;
  const { attacker, target, timer, totalDuration, def, data } = activeFinisher;
  const t = timer / totalDuration;

  // Radial vignette base (each finisher may add its own on top)
  _finVignette(ctx, Math.min(0.45, t * 2.8));

  if (def.draw) def.draw(ctx, attacker, target, t, timer, data);
}
