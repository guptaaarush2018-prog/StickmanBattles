'use strict';
// smb-finisher-tf — Depends on: smb-finisher-helpers.js

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
