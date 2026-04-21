'use strict';
// smb-finisher-weapon — Depends on: smb-finisher-helpers.js

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
