'use strict';
// smb-finisher-beast — Depends on: smb-finisher-helpers.js

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
