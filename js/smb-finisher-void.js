'use strict';
// smb-finisher-void — Depends on: smb-finisher-helpers.js

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
