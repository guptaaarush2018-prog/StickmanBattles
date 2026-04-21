'use strict';
// smb-drawing-arenas3.js — Online/large arenas + home world arenas (megacity, warpzone, homeyard, alley, suburb, rural, portal edge, realm entry, boss sanctum)
// Depends on: smb-globals.js, smb-data-arenas.js, smb-particles-core.js

// ─── ONLINE-ONLY LARGE ARENA DRAW FUNCTIONS ─────────────────────────────────

function drawMegacityArena() {
  const W = 1800, H = GAME_H;
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#0a0a1a');
  grad.addColorStop(1, '#1a0a2e');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
  // Buildings
  for (let i = 0; i < 30; i++) {
    const bx = (i * 62) % W;
    const bh = 120 + ((i * 137) % 200);
    const bw = 40 + ((i * 53) % 50);
    ctx.fillStyle = '#1a1a3e';
    ctx.fillRect(bx, H - bh - 40, bw, bh);
    // Windows
    for (let wy = 0; wy < bh - 20; wy += 16) {
      for (let wx = 6; wx < bw - 6; wx += 14) {
        const lit = ((frameCount + i * 7 + wy + wx) % 60) < 30;
        ctx.fillStyle = 'rgba(255,220,80,' + (lit ? '0.7' : '0.1') + ')';
        ctx.fillRect(bx + wx, H - bh - 40 + wy + 8, 8, 8);
      }
    }
  }
}

function drawWarpzoneArena() {
  const W = 1800, H = GAME_H;
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#0d0024');
  grad.addColorStop(1, '#00001a');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
  // Stars
  for (let i = 0; i < 80; i++) {
    const sx = (i * 223) % W, sy = (i * 139) % Math.floor(H * 0.7);
    ctx.fillStyle = 'rgba(200,150,255,' + (0.3 + (i % 3) * 0.2) + ')';
    ctx.fillRect(sx, sy, 2, 2);
  }
  // Decorative warp portals
  for (let i = 0; i < 5; i++) {
    const px = 180 + i * 350, py = 200 + (i % 2) * 100;
    const phase = (frameCount * 0.03 + i) % (Math.PI * 2);
    ctx.beginPath();
    ctx.ellipse(px, py, 60 + Math.sin(phase) * 10, 30 + Math.sin(phase) * 5, 0, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(136,0,255,' + (0.5 + Math.sin(phase) * 0.3) + ')';
    ctx.lineWidth = 3;
    ctx.stroke();
  }
}

function drawColosseum10Arena() {
  const W = 1800, H = GAME_H;
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#1a0800');
  grad.addColorStop(1, '#3d1a00');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
  // Stone arches
  ctx.fillStyle = '#4a2808';
  for (let i = 0; i < 12; i++) {
    const ax = i * 155, aw = 100, ah = 180;
    ctx.fillRect(ax, H - ah - 40, 20, ah);
    ctx.fillRect(ax + aw - 20, H - ah - 40, 20, ah);
    ctx.beginPath();
    ctx.arc(ax + aw / 2, H - ah - 40, aw / 2, Math.PI, 0);
    ctx.fill();
  }
  // Torches (flickering)
  for (let i = 0; i < 8; i++) {
    const tx = 100 + i * 220, ty = H - 180;
    const flicker = Math.sin(frameCount * 0.2 + i) * 0.3;
    const g = 120 + Math.floor(flicker * 80);
    ctx.fillStyle = 'rgba(255,' + g + ',0,' + (0.7 + flicker * 0.3) + ')';
    ctx.beginPath();
    ctx.arc(tx, ty, 8 + flicker * 4, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ── Home world: Backyard ───────────────────────────────────────────────────────
function drawHomeYardArena() {
  const W = GAME_W;
  const groundY = 480;

  // Sky — clear afternoon
  const sky = ctx.createLinearGradient(0,0,0,groundY);
  sky.addColorStop(0,'#5aaddb'); sky.addColorStop(1,'#c0e8f8');
  ctx.fillStyle = sky; ctx.fillRect(0,0,W,groundY);

  // Clouds
  ctx.fillStyle = 'rgba(255,255,255,0.82)';
  [[120,60,55,22],[360,40,70,26],[640,70,50,20],[800,50,60,24]].forEach(([cx,cy,rx,ry])=>{
    ctx.beginPath(); ctx.ellipse(cx,cy,rx,ry,0,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx+30,cy-8,rx*0.7,ry*0.7,0,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx-28,cy-4,rx*0.6,ry*0.6,0,0,Math.PI*2); ctx.fill();
  });

  // Back wall of house — large, spans most of the width
  ctx.fillStyle = '#c8b89a'; ctx.strokeStyle='#a09070'; ctx.lineWidth=2;
  ctx.fillRect(0, 180, W, groundY-180);
  // Brick texture rows
  ctx.strokeStyle='rgba(0,0,0,0.06)'; ctx.lineWidth=1;
  for(let ry=200; ry<groundY; ry+=18){
    ctx.beginPath(); ctx.moveTo(0,ry); ctx.lineTo(W,ry); ctx.stroke();
    const off = ((ry/18)|0)%2 === 0 ? 0 : 55;
    for(let rx=off; rx<W; rx+=110){
      ctx.beginPath(); ctx.moveTo(rx,ry); ctx.lineTo(rx,ry+18); ctx.stroke();
    }
  }

  // Sliding glass door (center)
  ctx.fillStyle='rgba(180,220,255,0.35)'; ctx.strokeStyle='#8aadcc'; ctx.lineWidth=2;
  ctx.fillRect(360,270,180,210); ctx.strokeRect(360,270,180,210);
  ctx.beginPath(); ctx.moveTo(450,270); ctx.lineTo(450,480); ctx.stroke();
  // Door frame
  ctx.strokeStyle='#6a8aa8'; ctx.lineWidth=3;
  ctx.strokeRect(360,270,180,210);
  // Reflection shimmer
  ctx.fillStyle='rgba(255,255,255,0.18)';
  ctx.fillRect(366,276,24,180);

  // Window (left of door)
  ctx.fillStyle='rgba(180,220,255,0.3)'; ctx.strokeStyle='#8aadcc'; ctx.lineWidth=1.5;
  ctx.fillRect(180,290,120,90); ctx.strokeRect(180,290,120,90);
  ctx.beginPath(); ctx.moveTo(240,290); ctx.lineTo(240,380); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(180,335); ctx.lineTo(300,335); ctx.stroke();
  // Curtains
  ctx.fillStyle='rgba(255,220,180,0.5)';
  ctx.fillRect(180,290,28,90); ctx.fillRect(272,290,28,90);

  // Window (right)
  ctx.fillStyle='rgba(180,220,255,0.3)'; ctx.strokeStyle='#8aadcc'; ctx.lineWidth=1.5;
  ctx.fillRect(600,290,120,90); ctx.strokeRect(600,290,120,90);
  ctx.beginPath(); ctx.moveTo(660,290); ctx.lineTo(660,380); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(600,335); ctx.lineTo(720,335); ctx.stroke();
  ctx.fillStyle='rgba(255,220,180,0.5)';
  ctx.fillRect(600,290,28,90); ctx.fillRect(692,290,28,90);

  // Wooden fence (back of yard)
  ctx.fillStyle='#c4966a'; ctx.strokeStyle='#9a7040'; ctx.lineWidth=1.5;
  // Horizontal rails
  ctx.fillRect(0,195,W,10); ctx.strokeRect(0,195,W,10);
  ctx.fillRect(0,218,W,8);  ctx.strokeRect(0,218,W,8);
  // Vertical pickets (left section and right section, door gap in middle)
  for(let fx=0; fx<360; fx+=22){
    ctx.fillRect(fx+2,170,16,50); ctx.strokeRect(fx+2,170,16,50);
  }
  for(let fx=540; fx<W; fx+=22){
    ctx.fillRect(fx+2,170,16,50); ctx.strokeRect(fx+2,170,16,50);
  }

  // Patio concrete slab
  ctx.fillStyle='#b0a898'; ctx.strokeStyle='#908878'; ctx.lineWidth=1;
  ctx.fillRect(300,460,300,20); ctx.strokeRect(300,460,300,20);
  // Patio grout lines
  ctx.strokeStyle='rgba(0,0,0,0.12)'; ctx.lineWidth=1;
  for(let px=300; px<600; px+=50){ ctx.beginPath(); ctx.moveTo(px,460); ctx.lineTo(px,480); ctx.stroke(); }
  ctx.beginPath(); ctx.moveTo(300,470); ctx.lineTo(600,470); ctx.stroke();

  // Lawn — green ground (extends well past canvas so camera zoom-out never shows void)
  const grass = ctx.createLinearGradient(0,groundY-30,0,groundY+40);
  grass.addColorStop(0,'#5a9040'); grass.addColorStop(1,'#3d6e28');
  ctx.fillStyle = grass; ctx.fillRect(0,groundY,W,600);
  ctx.fillStyle='#4a8030'; ctx.fillRect(0,groundY,W,8);

  // Lawn texture — random darker blades
  ctx.strokeStyle='rgba(40,80,20,0.25)'; ctx.lineWidth=1;
  for(let bx=0; bx<W; bx+=14){
    ctx.beginPath(); ctx.moveTo(bx,groundY); ctx.lineTo(bx+3,groundY-8); ctx.stroke();
  }

  // Small flower pots on patio
  [[328,460],[560,460]].forEach(([px,py])=>{
    ctx.fillStyle='#9a5030'; ctx.strokeStyle='#7a3820'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(px-8,py); ctx.lineTo(px+8,py); ctx.lineTo(px+6,py-14); ctx.lineTo(px-6,py-14); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle='#e06040'; ctx.beginPath(); ctx.arc(px,py-18,5,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#3a7020'; ctx.fillRect(px-1,py-28,2,12);
  });

  // Left & right wooden fence barriers (hard walls)
  [[0, 40],[W-40, 40]].forEach(([bx, bw])=>{
    ctx.fillStyle='#c4966a'; ctx.strokeStyle='#9a7040'; ctx.lineWidth=1.5;
    ctx.fillRect(bx,0,bw,groundY);
    // Horizontal rails
    ctx.fillStyle='#b08050'; ctx.fillRect(bx,200,bw,10); ctx.fillRect(bx,260,bw,10);
    // Vertical pickets
    for(let fy=0; fy<groundY; fy+=22){
      ctx.fillStyle='#c4966a'; ctx.fillRect(bx+4,fy,bw-8,18); ctx.strokeRect(bx+4,fy,bw-8,18);
    }
  });
}

// ── Home world: City Alley ─────────────────────────────────────────────────────
function drawHomeAlleyArena() {
  const W = GAME_W;
  const groundY = 480;
  const t = frameCount * 0.02;

  // Sky strip between buildings — dark/dusk
  const sky = ctx.createLinearGradient(0,0,0,160);
  sky.addColorStop(0,'#1a2030'); sky.addColorStop(1,'#2a3040');
  ctx.fillStyle = sky; ctx.fillRect(0,0,W,160);

  // Stars in the narrow sky strip
  ctx.fillStyle='rgba(255,255,255,0.7)';
  [[60,20],[130,40],[200,15],[300,35],[400,22],[500,38],[620,18],[730,42],[820,28],[880,15]].forEach(([sx,sy])=>{
    const blink = Math.sin(t + sx*0.1) * 0.3 + 0.7;
    ctx.globalAlpha = blink * 0.7;
    ctx.beginPath(); ctx.arc(sx,sy,1,0,Math.PI*2); ctx.fill();
  });
  ctx.globalAlpha = 1;

  // LEFT building wall — brick
  const leftW = 130;
  ctx.fillStyle='#3a3028'; ctx.fillRect(0,0,leftW,groundY);
  // Brick pattern
  ctx.strokeStyle='rgba(0,0,0,0.3)'; ctx.lineWidth=1;
  for(let ry=0; ry<groundY; ry+=16){
    ctx.beginPath(); ctx.moveTo(0,ry); ctx.lineTo(leftW,ry); ctx.stroke();
    const off = ((ry/16)|0)%2===0 ? 0 : 50;
    for(let rx=off; rx<leftW; rx+=100){ ctx.beginPath(); ctx.moveTo(rx,ry); ctx.lineTo(rx,ry+16); ctx.stroke(); }
  }
  // Fire escape on left wall
  ctx.strokeStyle='#555545'; ctx.lineWidth=2;
  ctx.beginPath(); ctx.moveTo(leftW-2,160); ctx.lineTo(leftW-2,groundY); ctx.stroke();
  [220,310,400,groundY-10].forEach(fy=>{
    ctx.fillStyle='#444434'; ctx.fillRect(leftW-30,fy,30,6);
    ctx.strokeStyle='#333324'; ctx.lineWidth=1;
    ctx.strokeRect(leftW-30,fy,30,6);
    // Railing
    for(let rx=leftW-28; rx<leftW; rx+=8){ ctx.beginPath(); ctx.moveTo(rx,fy); ctx.lineTo(rx,fy-20); ctx.stroke(); }
  });
  // Lit window on left
  ctx.fillStyle='rgba(255,200,80,0.35)'; ctx.strokeStyle='#555'; ctx.lineWidth=1;
  ctx.fillRect(8,100,60,50); ctx.strokeRect(8,100,60,50);
  ctx.fillStyle='rgba(255,200,80,0.12)'; // window glow
  ctx.beginPath(); ctx.ellipse(38,125,50,40,0,0,Math.PI*2); ctx.fill();

  // RIGHT building wall
  const rightX = W-130;
  ctx.fillStyle='#2e2a24'; ctx.fillRect(rightX,0,130,groundY);
  ctx.strokeStyle='rgba(0,0,0,0.3)'; ctx.lineWidth=1;
  for(let ry=0; ry<groundY; ry+=16){
    ctx.beginPath(); ctx.moveTo(rightX,ry); ctx.lineTo(W,ry); ctx.stroke();
    const off = ((ry/16)|0)%2===0 ? 0 : 50;
    for(let rx=off; rx<130; rx+=100){ ctx.beginPath(); ctx.moveTo(rightX+rx,ry); ctx.lineTo(rightX+rx,ry+16); ctx.stroke(); }
  }
  ctx.fillStyle='rgba(255,200,80,0.3)'; ctx.strokeStyle='#555'; ctx.lineWidth=1;
  ctx.fillRect(rightX+12,80,70,45); ctx.strokeRect(rightX+12,80,70,45);
  ctx.fillStyle='rgba(255,200,80,0.10)';
  ctx.beginPath(); ctx.ellipse(rightX+47,105,60,40,0,0,Math.PI*2); ctx.fill();

  // Alley depth — dark background between buildings
  const depthGrad = ctx.createLinearGradient(0,0,0,groundY);
  depthGrad.addColorStop(0,'#141820'); depthGrad.addColorStop(1,'#1e2028');
  ctx.fillStyle=depthGrad; ctx.fillRect(leftW,0,rightX-leftW,groundY);

  // Overhead wires
  ctx.strokeStyle='rgba(40,40,40,0.9)'; ctx.lineWidth=1.5;
  [[leftW,80,rightX,100],[leftW,120,rightX,108]].forEach(([x1,y1,x2,y2])=>{
    ctx.beginPath();
    ctx.moveTo(x1,y1);
    const mid=(x1+x2)/2;
    ctx.quadraticCurveTo(mid,y1+18,x2,y2);
    ctx.stroke();
  });
  // Hanging light
  const lightX = W*0.5, lightY = 110;
  const swing = Math.sin(t) * 8;
  ctx.strokeStyle='rgba(40,40,40,0.8)'; ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(lightX,90); ctx.lineTo(lightX+swing,lightY); ctx.stroke();
  ctx.fillStyle='#888'; ctx.beginPath(); ctx.arc(lightX+swing,lightY,6,0,Math.PI*2); ctx.fill();
  // Light cone
  const lightFlicker = 0.15 + Math.sin(t*3)*0.05;
  const lgrad = ctx.createRadialGradient(lightX+swing,lightY,0,lightX+swing,lightY,180);
  lgrad.addColorStop(0,`rgba(255,200,100,${lightFlicker*2})`);
  lgrad.addColorStop(1,'rgba(255,200,100,0)');
  ctx.fillStyle=lgrad;
  ctx.beginPath(); ctx.moveTo(lightX+swing,lightY); ctx.lineTo(lightX+swing-100,groundY); ctx.lineTo(lightX+swing+100,groundY); ctx.closePath(); ctx.fill();

  // Ground — wet asphalt (fill well past canvas to eliminate void on zoom-out)
  const road = ctx.createLinearGradient(0,groundY,0,groundY+60);
  road.addColorStop(0,'#252525'); road.addColorStop(1,'#1a1a1a');
  ctx.fillStyle=road; ctx.fillRect(0,groundY,W,600);
  // Cracks
  ctx.strokeStyle='rgba(0,0,0,0.4)'; ctx.lineWidth=1;
  [[200,groundY,220,groundY+20],[450,groundY,440,groundY+15],[700,groundY,715,groundY+18]].forEach(([x1,y1,x2,y2])=>{
    ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
  });
  // Puddle reflection
  ctx.fillStyle='rgba(255,200,100,0.06)';
  ctx.beginPath(); ctx.ellipse(lightX,groundY+12,60,8,0,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='rgba(100,140,200,0.08)';
  ctx.beginPath(); ctx.ellipse(250,groundY+10,40,6,0,0,Math.PI*2); ctx.fill();
  // Ground line
  ctx.fillStyle='#1a1a1a'; ctx.fillRect(0,groundY,W,4);

  // Graffiti on left wall (simple colored shapes)
  ctx.save(); ctx.globalAlpha=0.45;
  ctx.fillStyle='#dd4422'; ctx.font='bold 18px Arial';
  ctx.fillText('NO', 20, 340);
  ctx.fillStyle='#2244cc';
  ctx.fillText('WAY', 22, 360);
  ctx.restore();

  // Graffiti arrow on right
  ctx.save(); ctx.globalAlpha=0.35; ctx.strokeStyle='#cc8800'; ctx.lineWidth=3;
  ctx.beginPath(); ctx.moveTo(rightX+15,300); ctx.lineTo(rightX+55,300); ctx.lineTo(rightX+48,293); ctx.moveTo(rightX+55,300); ctx.lineTo(rightX+48,307); ctx.stroke();
  ctx.restore();

  // Dumpsters — decorative, flush against ground (no collision)
  [[80,480],[700,480]].forEach(([dx,dy])=>{
    ctx.fillStyle='#2a7a3a'; ctx.strokeStyle='#1a5a2a'; ctx.lineWidth=2;
    ctx.fillRect(dx,dy-38,120,38); ctx.strokeRect(dx,dy-38,120,38);
    ctx.fillStyle='#1a6a2a'; ctx.fillRect(dx-2,dy-42,124,8); ctx.strokeRect(dx-2,dy-42,124,8);
    ctx.strokeStyle='rgba(0,0,0,0.3)'; ctx.lineWidth=1;
    ctx.strokeRect(dx+10,dy-28,30,18);
    ctx.fillStyle='rgba(255,255,255,0.15)'; ctx.font='7px Arial';
    ctx.fillText('WASTE', dx+8, dy-16);
  });

  // Rats (tiny animated)
  const ratX = 180 + Math.sin(t*0.8)*15;
  ctx.fillStyle='#555'; ctx.save();
  ctx.translate(ratX, groundY+5);
  ctx.beginPath(); ctx.ellipse(0,0,8,4,0,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(-8,0,3,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle='#555'; ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(8,0); ctx.quadraticCurveTo(16,-3,20,1); ctx.stroke();
  ctx.restore();

  // Left & right solid brick barrier walls (hard walls matching physics boundary)
  [[0,40],[W-40,40]].forEach(([bx,bw])=>{
    ctx.fillStyle='#3a3028'; ctx.fillRect(bx,0,bw,groundY);
    ctx.strokeStyle='rgba(0,0,0,0.3)'; ctx.lineWidth=1;
    for(let ry=0; ry<groundY; ry+=16){
      ctx.beginPath(); ctx.moveTo(bx,ry); ctx.lineTo(bx+bw,ry); ctx.stroke();
      const off=((ry/16)|0)%2===0?0:50;
      for(let rx=off; rx<bw; rx+=100){ ctx.beginPath(); ctx.moveTo(bx+rx,ry); ctx.lineTo(bx+rx,ry+16); ctx.stroke(); }
    }
    // Grime/moss patches
    ctx.fillStyle='rgba(40,60,20,0.2)'; ctx.fillRect(bx, groundY-80, bw, 80);
  });
}

function drawSuburbArena() {
  const W = GAME_W;
  const sky = ctx.createLinearGradient(0,0,0,480);
  sky.addColorStop(0,'#87CEEB'); sky.addColorStop(1,'#daf0ff');
  ctx.fillStyle = sky; ctx.fillRect(0,0,W,GAME_H);
  // Houses in background
  const houses = [{x:60,w:120,h:140},{x:230,w:140,h:160},{x:430,w:160,h:150},{x:640,w:130,h:145},{x:780,w:110,h:130}];
  for (const hh of houses) {
    ctx.fillStyle = '#e8d8b0';
    ctx.fillRect(hh.x, 480-hh.h, hh.w, hh.h);
    ctx.fillStyle = '#aa5522';
    ctx.beginPath();
    ctx.moveTo(hh.x - 10, 480 - hh.h);
    ctx.lineTo(hh.x + hh.w/2, 480 - hh.h - 60);
    ctx.lineTo(hh.x + hh.w + 10, 480 - hh.h);
    ctx.fill();
    ctx.fillStyle = 'rgba(100,180,255,0.6)';
    ctx.fillRect(hh.x + 15, 480 - hh.h + 25, 30, 30);
    ctx.fillRect(hh.x + hh.w - 45, 480 - hh.h + 25, 30, 30);
  }
  // Portal smoke effect (chaos beginning)
  const smokeAlpha = 0.08 + Math.sin(frameCount * 0.04) * 0.03;
  ctx.fillStyle = `rgba(80,0,80,${smokeAlpha})`;
  ctx.fillRect(0,0,W,GAME_H);
  // Lawn — extend well below canvas to eliminate void on zoom-out
  ctx.fillStyle = '#5a8a3a'; ctx.fillRect(0, 480, W, 600);
  // Sidewalk strip
  ctx.fillStyle = '#c8b890'; ctx.fillRect(0, 472, W, 8);
  ctx.strokeStyle = '#a09070'; ctx.lineWidth = 1;
  for (let sx = 0; sx < W; sx += 80) { ctx.beginPath(); ctx.moveTo(sx,472); ctx.lineTo(sx,480); ctx.stroke(); }

  // Left & right picket fence barriers (hard wall boundaries)
  [[0,40],[W-40,40]].forEach(([bx,bw])=>{
    // Lawn behind fence
    ctx.fillStyle='#5a8a3a'; ctx.fillRect(bx,0,bw,480);
    // Fence rails
    ctx.fillStyle='#f0ece0'; ctx.strokeStyle='#c8c0a0'; ctx.lineWidth=1.5;
    ctx.fillRect(bx,300,bw,8); ctx.strokeRect(bx,300,bw,8);
    ctx.fillRect(bx,340,bw,8); ctx.strokeRect(bx,340,bw,8);
    // Pickets
    for(let fy=260; fy<480; fy+=16){
      ctx.fillStyle='#f5f0e0'; ctx.fillRect(bx+4,fy,bw-8,14); ctx.strokeRect(bx+4,fy,bw-8,14);
      // Pointed top
      ctx.beginPath(); ctx.moveTo(bx+4,fy); ctx.lineTo(bx+bw/2,fy-8); ctx.lineTo(bx+bw-4,fy); ctx.closePath();
      ctx.fillStyle='#f5f0e0'; ctx.fill(); ctx.stroke();
    }
  });
}

function drawRuralArena() {
  const W = GAME_W;
  const groundY = 480;

  // Sky — sunset gradient
  const sky = ctx.createLinearGradient(0,0,0,groundY);
  sky.addColorStop(0,'#f5c842'); sky.addColorStop(0.5,'#f0a020'); sky.addColorStop(1,'#c87010');
  ctx.fillStyle = sky; ctx.fillRect(0,0,W,groundY);

  // Sun
  ctx.fillStyle = 'rgba(255,220,80,0.9)';
  ctx.beginPath(); ctx.arc(740, 100, 55, 0, Math.PI*2); ctx.fill();

  // Background barn (purely decorative — does not reach ground)
  ctx.fillStyle = '#8b1a1a';
  ctx.fillRect(220, 300, 180, 180);
  ctx.fillStyle = '#6b1010';
  ctx.beginPath(); ctx.moveTo(210,300); ctx.lineTo(310,230); ctx.lineTo(410,300); ctx.fill();
  ctx.fillStyle = '#4a0808';
  ctx.fillRect(285, 390, 60, 90);

  // Background silo
  ctx.fillStyle = '#c8b870';
  ctx.fillRect(500, 300, 60, 180);
  ctx.beginPath(); ctx.arc(530, 300, 30, Math.PI, 0); ctx.fill();

  // Portal glow in distance (story atmosphere)
  const pg = ctx.createRadialGradient(150, 380, 10, 150, 380, 80);
  pg.addColorStop(0, `rgba(180,0,255,${0.35 + Math.sin(frameCount*0.06)*0.12})`);
  pg.addColorStop(1, 'rgba(180,0,255,0)');
  ctx.fillStyle = pg; ctx.fillRect(0,200,300,280);

  // Ground — dirt/earth, extend far below to eliminate void
  const dirt = ctx.createLinearGradient(0,groundY,0,groundY+60);
  dirt.addColorStop(0,'#8a6a38'); dirt.addColorStop(1,'#6a4e28');
  ctx.fillStyle = dirt; ctx.fillRect(0,groundY,W,600);
  // Top soil strip
  ctx.fillStyle = '#7a5c30'; ctx.fillRect(0,groundY,W,6);
  // Dirt texture lines
  ctx.strokeStyle = '#5c4010'; ctx.lineWidth = 1;
  for (let fx = 0; fx < W; fx += 18) {
    ctx.beginPath(); ctx.moveTo(fx,groundY); ctx.lineTo(fx+5,groundY-6); ctx.stroke();
  }

  // Left & right wire/chain-link fence barriers (hard wall boundaries)
  [[0,36],[W-36,36]].forEach(([bx,bw])=>{
    // Wood posts
    ctx.fillStyle='#8a6a38'; ctx.strokeStyle='#5a4020'; ctx.lineWidth=2;
    for(let py=200; py<groundY; py+=100){
      ctx.fillRect(bx+bw/2-4,py,8,groundY-py);
      ctx.strokeRect(bx+bw/2-4,py,8,groundY-py);
      // Post cap
      ctx.beginPath(); ctx.moveTo(bx+bw/2-5,py); ctx.lineTo(bx+bw/2,py-10); ctx.lineTo(bx+bw/2+5,py); ctx.closePath();
      ctx.fill(); ctx.stroke();
    }
    // Horizontal wire strands
    ctx.strokeStyle='rgba(150,150,100,0.7)'; ctx.lineWidth=1.5;
    [240,280,320,360,400,440,480].forEach(wy=>{
      ctx.beginPath(); ctx.moveTo(bx,wy); ctx.lineTo(bx+bw,wy); ctx.stroke();
    });
    // Diagonal cross-wire pattern
    ctx.strokeStyle='rgba(150,150,100,0.4)'; ctx.lineWidth=1;
    for(let wy=240; wy<480; wy+=20){
      ctx.beginPath(); ctx.moveTo(bx,wy); ctx.lineTo(bx+bw,wy+20); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(bx,wy+20); ctx.lineTo(bx+bw,wy); ctx.stroke();
    }
  });
}

function drawPortalEdgeArena() {
  const W = GAME_W, H = GAME_H;
  const sky = ctx.createLinearGradient(0,0,0,H);
  sky.addColorStop(0,'#0a0020'); sky.addColorStop(1,'#300060');
  ctx.fillStyle = sky; ctx.fillRect(0,0,W,H);
  for (let i=0; i<60; i++) {
    const sx=(i*227+13)%W, sy=(i*131+7)%(H*0.7);
    const br = 0.4 + Math.sin(frameCount*0.05+i)*0.3;
    ctx.fillStyle=`rgba(220,180,255,${br})`; ctx.fillRect(sx,sy,2,2);
  }
  const px = W/2, py = 260;
  const pr = 120 + Math.sin(frameCount*0.04)*12;
  const portalGrad = ctx.createRadialGradient(px,py,0,px,py,pr);
  portalGrad.addColorStop(0,'rgba(255,255,255,0.95)');
  portalGrad.addColorStop(0.15,'rgba(180,80,255,0.9)');
  portalGrad.addColorStop(0.5,'rgba(80,0,200,0.7)');
  portalGrad.addColorStop(1,'rgba(20,0,60,0)');
  ctx.fillStyle = portalGrad;
  ctx.beginPath(); ctx.ellipse(px,py,pr*0.55,pr,0,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle = `rgba(200,100,255,${0.7+Math.sin(frameCount*0.07)*0.2})`;
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.ellipse(px,py,pr*0.55,pr,0,0,Math.PI*2); ctx.stroke();
  for (let i=0; i<8; i++) {
    const angle = (i/8)*Math.PI*2 + frameCount*0.02;
    const len = 30 + Math.sin(frameCount*0.1+i)*15;
    ctx.strokeStyle = `rgba(200,100,255,0.6)`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(px + Math.cos(angle)*pr*0.5, py + Math.sin(angle)*pr*0.85);
    ctx.lineTo(px + Math.cos(angle)*(pr*0.5+len), py + Math.sin(angle)*(pr*0.85+len));
    ctx.stroke();
  }
  ctx.fillStyle = '#150030'; ctx.fillRect(0,480,W,H-480);
  const gGlow = ctx.createLinearGradient(0,460,0,480);
  gGlow.addColorStop(0,`rgba(100,0,200,${0.4+Math.sin(frameCount*0.04)*0.1})`);
  gGlow.addColorStop(1,'rgba(100,0,200,0)');
  ctx.fillStyle = gGlow; ctx.fillRect(0,440,W,40);
}

function drawRealmEntryArena() {
  const W = GAME_W, H = GAME_H;
  const sky = ctx.createLinearGradient(0,0,0,H);
  sky.addColorStop(0,'#000820'); sky.addColorStop(1,'#003060');
  ctx.fillStyle = sky; ctx.fillRect(0,0,W,H);
  for (let i=0; i<4; i++) {
    const nx=(i*230+100)%W, ny=60+i*80;
    const nr=100+i*30;
    const ng = ctx.createRadialGradient(nx,ny,0,nx,ny,nr);
    ng.addColorStop(0,`rgba(0,${80+i*30},${180+i*20},0.07)`);
    ng.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=ng; ctx.fillRect(0,0,W,H);
  }
  ctx.fillStyle = 'rgba(0,60,120,0.6)';
  for (let i=0; i<5; i++) {
    const bx=i*185+30, bh=60+i%3*40;
    ctx.fillRect(bx, 380-bh, 60, bh);
    ctx.fillRect(bx-10, 380-bh-20, 80, 20);
  }
  for (let i=0; i<80; i++) {
    const sx=(i*211)%W, sy=(i*137)%(H*0.9);
    const br = 0.3+Math.sin(frameCount*0.04+i*0.7)*0.3;
    ctx.fillStyle=`rgba(100,200,255,${br})`; ctx.fillRect(sx,sy,1.5,1.5);
  }
  ctx.fillStyle='#001030'; ctx.fillRect(0,480,W,H-480);
  const reGlow = ctx.createLinearGradient(0,460,0,480);
  reGlow.addColorStop(0,`rgba(0,100,255,${0.3+Math.sin(frameCount*0.04)*0.1})`);
  reGlow.addColorStop(1,'rgba(0,100,255,0)');
  ctx.fillStyle = reGlow; ctx.fillRect(0,440,W,40);
}

function drawBossSanctumArena() {
  const W = GAME_W, H = GAME_H;
  const sky = ctx.createLinearGradient(0,0,0,H);
  sky.addColorStop(0,'#100005'); sky.addColorStop(1,'#350020');
  ctx.fillStyle = sky; ctx.fillRect(0,0,W,H);
  ctx.strokeStyle = `rgba(200,0,60,${0.3+Math.sin(frameCount*0.05)*0.2})`;
  ctx.lineWidth = 2;
  for (let i=0; i<6; i++) {
    const vx = i*(W/5);
    ctx.beginPath(); ctx.moveTo(vx,0);
    ctx.bezierCurveTo(vx+80,60, vx-50,120, vx+30,200);
    ctx.stroke();
  }
  ctx.fillStyle = '#1a0015';
  ctx.fillRect(W/2-60, 280, 120, 200);
  ctx.fillRect(W/2-100, 275, 200, 20);
  ctx.fillRect(W/2-40, 210, 80, 80);
  ctx.fillRect(W/2-50, 205, 100, 15);
  const tg = ctx.createRadialGradient(W/2,350,0,W/2,350,200);
  tg.addColorStop(0,`rgba(180,0,50,${0.2+Math.sin(frameCount*0.04)*0.08})`);
  tg.addColorStop(1,'rgba(180,0,50,0)');
  ctx.fillStyle=tg; ctx.fillRect(0,0,W,H);
  for (let i=0; i<6; i++) {
    const cx2 = 80+i*140, cy2 = 150+Math.sin(frameCount*0.02+i)*12;
    ctx.fillStyle = `rgba(80,0,40,0.7)`;
    ctx.beginPath();
    ctx.moveTo(cx2, cy2-25); ctx.lineTo(cx2+12,cy2); ctx.lineTo(cx2,cy2+25); ctx.lineTo(cx2-12,cy2);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle='rgba(200,0,60,0.5)'; ctx.lineWidth=1; ctx.stroke();
  }
  ctx.fillStyle='#1a0010'; ctx.fillRect(0,480,W,H-480);
  ctx.strokeStyle=`rgba(200,0,40,${0.4+Math.sin(frameCount*0.06)*0.15})`; ctx.lineWidth=2;
  const cracks = [[0,490,200,485],[200,485,350,492],[350,492,500,480],[500,480,700,488],[700,488,900,483]];
  for (const [x1,y1,x2,y2] of cracks) { ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke(); }
}
