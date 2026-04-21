'use strict';
// smb-finisher-yeti — Depends on: smb-finisher-helpers.js

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
