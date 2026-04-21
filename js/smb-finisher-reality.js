'use strict';
// smb-finisher-reality — Depends on: smb-finisher-helpers.js

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
