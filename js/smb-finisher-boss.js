'use strict';
// smb-finisher-boss — Depends on: smb-finisher-helpers.js

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
