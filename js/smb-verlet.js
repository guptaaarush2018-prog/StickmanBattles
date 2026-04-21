'use strict';
// smb-verlet.js — VerletPoint, VerletStick, VerletRagdoll, PlayerRagdoll classes
// Depends on: smb-globals.js
// VERLET RAGDOLL — position-based dynamics for death animation
// ============================================================

class VerletPoint {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.ox = x; this.oy = y; // old position for Verlet
    this.pinned = false;
  }
  // Verlet integration step
  integrate(gravity = 0.55) {
    if (this.pinned) return;
    const vx = (this.x - this.ox) * 0.98; // friction
    const vy = (this.y - this.oy) * 0.98;
    this.ox = this.x; this.oy = this.y;
    this.x += vx;
    this.y += vy + gravity;
  }
  // Apply impulse
  impulse(ix, iy) { this.ox -= ix; this.oy -= iy; }
}

class VerletStick {
  constructor(a, b, len) {
    this.a = a; this.b = b;
    this.len = len ?? Math.hypot(b.x - a.x, b.y - a.y);
  }
  constrain() {
    const dx = this.b.x - this.a.x;
    const dy = this.b.y - this.a.y;
    const dist = Math.hypot(dx, dy) || 0.001;
    const diff = (dist - this.len) / dist * 0.5;
    if (!this.a.pinned) { this.a.x += dx * diff; this.a.y += dy * diff; }
    if (!this.b.pinned) { this.b.x -= dx * diff; this.b.y -= dy * diff; }
  }
}

class VerletRagdoll {
  constructor(fighter) {
    const f = fighter;
    const cx = f.cx(), cy = f.cy();
    const h = f.h;

    // Joint positions relative to fighter center
    this.head     = new VerletPoint(cx, cy - h * 0.38);
    this.neck     = new VerletPoint(cx, cy - h * 0.25);
    this.lShoulder= new VerletPoint(cx - 12, cy - h * 0.18);
    this.rShoulder= new VerletPoint(cx + 12, cy - h * 0.18);
    this.lElbow   = new VerletPoint(cx - 22, cy - h * 0.04);
    this.rElbow   = new VerletPoint(cx + 22, cy - h * 0.04);
    this.lHand    = new VerletPoint(cx - 26, cy + h * 0.10);
    this.rHand    = new VerletPoint(cx + 26, cy + h * 0.10);
    this.lHip     = new VerletPoint(cx - 8,  cy + h * 0.06);
    this.rHip     = new VerletPoint(cx + 8,  cy + h * 0.06);
    this.lKnee    = new VerletPoint(cx - 10, cy + h * 0.25);
    this.rKnee    = new VerletPoint(cx + 10, cy + h * 0.25);
    this.lFoot    = new VerletPoint(cx - 10, cy + h * 0.42);
    this.rFoot    = new VerletPoint(cx + 10, cy + h * 0.42);

    this.points = [
      this.head, this.neck,
      this.lShoulder, this.rShoulder,
      this.lElbow, this.rElbow, this.lHand, this.rHand,
      this.lHip, this.rHip,
      this.lKnee, this.rKnee, this.lFoot, this.rFoot,
    ];

    // Sticks (bones) — each enforces a constant distance
    this.sticks = [
      new VerletStick(this.head,     this.neck),       // spine-neck
      new VerletStick(this.neck,     this.lShoulder),
      new VerletStick(this.neck,     this.rShoulder),
      new VerletStick(this.lShoulder,this.lElbow),
      new VerletStick(this.lElbow,   this.lHand),
      new VerletStick(this.rShoulder,this.rElbow),
      new VerletStick(this.rElbow,   this.rHand),
      new VerletStick(this.lShoulder,this.lHip),       // torso left
      new VerletStick(this.rShoulder,this.rHip),       // torso right
      new VerletStick(this.lHip,     this.rHip),       // pelvis
      new VerletStick(this.lHip,     this.lKnee),
      new VerletStick(this.lKnee,    this.lFoot),
      new VerletStick(this.rHip,     this.rKnee),
      new VerletStick(this.rKnee,    this.rFoot),
      new VerletStick(this.lShoulder,this.rShoulder),  // shoulder girdle
      new VerletStick(this.neck,     this.lHip),       // diagonal stabilizer
      new VerletStick(this.neck,     this.rHip),       // diagonal stabilizer
    ];

    // Apply initial death impulse from the fighter's current velocity
    const ivx = (f.vx || 0) * 0.6;
    const ivy = (f.vy || 0) * 0.5 - 2;
    const spin = (f.ragdollSpin || 0) * 14;
    this.points.forEach(p => {
      p.impulse(-ivx + (Math.random() - 0.5) * 2, -ivy + (Math.random() - 0.5) * 2);
      // Apply spin: offset from center causes rotation
      const rx = p.x - cx, ry = p.y - cy;
      p.impulse(-spin * ry * 0.012, spin * rx * 0.012);
    });

    this.color  = f.color || '#aaaaaa';
    const RAGDOLL_LIFETIME_FRAMES = 240; // despawn after ~4s to prevent accumulation
    this.timer  = RAGDOLL_LIFETIME_FRAMES;
    this.alpha  = 1;
    this.floorY = 460;   // default floor Y; updated from arena
  }

  update() {
    this.timer--;
    if (this.timer < 60) this.alpha = this.timer / 60;

    // Integrate all points
    this.points.forEach(p => p.integrate(0.55));

    // Constraint iterations (7 per frame prevents collapse)
    for (let iter = 0; iter < 7; iter++) {
      this.sticks.forEach(s => s.constrain());
      this._groundCollide();
    }
  }

  _groundCollide() {
    // Use arena platforms for collision
    const plats = currentArena?.platforms || [];
    this.points.forEach(p => {
      // Arena floor fallback
      if (p.y > this.floorY) {
        p.y = this.floorY;
        p.oy = p.y + (p.y - p.oy) * 0.35; // bounce damp
        p.ox = p.ox + (p.x - p.ox) * 0.25; // floor friction
      }
      // Screen sides
      if (p.x < 0)       { p.x = 0;       p.ox = p.x + (p.x - p.ox) * 0.4; }
      if (p.x > GAME_W)  { p.x = GAME_W;  p.ox = p.x + (p.x - p.ox) * 0.4; }
      // Platform surfaces (only top collision)
      for (const pl of plats) {
        if (pl.isFloorDisabled) continue;
        if (p.x > pl.x && p.x < pl.x + pl.w && p.y > pl.y && p.y < pl.y + pl.h + 12) {
          p.y = pl.y;
          p.oy = p.y + (p.y - p.oy) * 0.35;
          p.ox = p.ox + (p.x - p.ox) * 0.25;
        }
      }
    });
  }

  draw() {
    ctx.save();
    ctx.globalAlpha = this.alpha;
    ctx.strokeStyle = this.color;
    ctx.lineCap = 'round';

    // Draw bones (sticks)
    for (const s of this.sticks) {
      ctx.lineWidth = s === this.sticks[0] ? 3.5 : 2;
      ctx.beginPath();
      ctx.moveTo(s.a.x, s.a.y);
      ctx.lineTo(s.b.x, s.b.y);
      ctx.stroke();
    }

    // Head circle
    ctx.beginPath();
    ctx.arc(this.head.x, this.head.y, 7, 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.fill();

    ctx.restore();
  }

  isDone() { return this.timer <= 0; }
}

// ============================================================
// PLAYER RAGDOLL — per-limb spring-damper physics
//
// Each limb (rArm, lArm, rLeg, lLeg, head, torso) carries:
//   angle (radians) — current draw angle
//   vel   (rad/frame) — angular velocity
//
// Every frame: spring pulls angle toward naturalPose(state),
// damping bleeds energy. Hit reactions apply impulses directly
// to the affected limb + sympathetic limbs.
//
// API:
//   PlayerRagdoll.createRagdoll(f)       — attach ragdoll to fighter
//   PlayerRagdoll.updateLimbs(f)         — spring-step each frame
//   PlayerRagdoll.applyHit(f, fx, fy, ix, iy) — directional hit impulse
//   PlayerRagdoll.applyJump(f)           — jump kick impulse
//   PlayerRagdoll.applyMovement(f)       — lean into movement
//   PlayerRagdoll.collapse(f)            — knockout (max floppiness)
//   PlayerRagdoll.standUp(f)             — respawn recovery ramp
//   PlayerRagdoll.debugDraw(f, cx, sy, hy) — joint overlay (window.rdDebug=true)
// ============================================================
class PlayerRagdoll {

  /** Attach ragdoll state to a fighter (idempotent). */
  static createRagdoll(f) {
    if (f._rd) return f._rd;
    f._rd = {
      rArm:  { angle: Math.PI * 0.58, vel: 0 },
      lArm:  { angle: Math.PI * 0.42, vel: 0 },
      rLeg:  { angle: Math.PI * 0.62, vel: 0 },
      lLeg:  { angle: Math.PI * 0.38, vel: 0 },
      head:  { angle: 0,              vel: 0 },
      torso: { angle: 0,              vel: 0 },
      // State flags
      collapsed:     false,   // knockout — near-zero stiffness
      recovering:    false,   // slowly ramping stiffness back up
      recoveryTimer: 0,       // 0-90 frames
      // Physics constants (overridden by collapse/standUp)
      stiffness: 0.18,        // spring strength toward natural pose
      damping:   0.82,        // velocity decay per frame
    };
    return f._rd;
  }

  // ---- Frame update ----

  /**
   * Advance the spring-damper simulation one frame.
   * Computes the natural pose for the fighter's current state,
   * then pulls each limb angle toward it with spring + damping.
   */
  static updateLimbs(f) {
    const rd = f._rd;
    if (!rd) return;

    // Recovery: ramp stiffness from near-zero back to normal over 90 frames
    if (rd.recovering) {
      rd.recoveryTimer++;
      if (rd.recoveryTimer >= 90) {
        rd.collapsed     = false;
        rd.recovering    = false;
        rd.recoveryTimer = 0;
        rd.stiffness     = 0.18;
        rd.damping       = 0.82;
      }
    }

    // Effective spring constant: collapsed → very loose; recovering → ramping
    const k = rd.collapsed
      ? 0.004
      : rd.recovering
        ? 0.004 + (rd.stiffness - 0.004) * (rd.recoveryTimer / 90)
        : rd.stiffness;
    const d = rd.collapsed ? 0.89 : rd.damping;

    const pose = PlayerRagdoll._naturalPose(f);
    for (const limb of ['rArm', 'lArm', 'rLeg', 'lLeg', 'head', 'torso']) {
      const jt  = rd[limb];
      jt.vel   += (pose[limb] - jt.angle) * k;   // spring force
      jt.vel   *= d;                               // damping
      jt.angle += jt.vel;                          // integrate
    }
  }

  // ---- Natural pose by animation state ----

  /**
   * Returns target { rArm, lArm, rLeg, lLeg, head, torso } angles (radians)
   * for the fighter's current state.  The spring system pulls limbs here.
   */
  static _naturalPose(f) {
    const s    = f.state;
    const t    = f.animTimer;
    const face = f.facing;
    const rd   = f._rd;

    // Collapsed (dead / knocked out): fully limp on the ground
    if (rd && rd.collapsed) {
      return {
        rArm:  Math.PI * 0.88,
        lArm:  Math.PI * 0.12,
        rLeg:  Math.PI * 0.74,
        lLeg:  Math.PI * 0.26,
        head:  0.36 * (face > 0 ? 1 : -1),
        torso: 0.14,
      };
    }

    // Ragdoll hit-flung: limbs trail loosely
    if (s === 'ragdoll') {
      return {
        rArm:  Math.PI * 0.92,
        lArm:  Math.PI * 0.08,
        rLeg:  Math.PI * 0.76,
        lLeg:  Math.PI * 0.24,
        head:  0,
        torso: 0,
      };
    }

    // Stunned: limp arms, slightly open stance
    if (s === 'stunned') {
      const sw = Math.sin(t * 0.06) * 0.05;
      return {
        rArm:  Math.PI * 0.76 + sw,
        lArm:  Math.PI * 0.24 - sw,
        rLeg:  Math.PI * 0.60,
        lLeg:  Math.PI * 0.40,
        head:  Math.sin(t * 0.07) * 0.10,
        torso: 0,
      };
    }

    // Hurt: arms pulled back, cringe
    if (s === 'hurt') {
      return {
        rArm:  Math.PI * 0.72,
        lArm:  Math.PI * 0.28,
        rLeg:  Math.PI * 0.58,
        lLeg:  Math.PI * 0.42,
        head:  -0.12,
        torso: 0,
      };
    }

    // Attacking: forward swing (direction-aware)
    if (s === 'attacking') {
      const p = f.attackDuration > 0 ? 1 - f.attackTimer / f.attackDuration : 0;
      return face > 0
        ? { rArm: lerp(-0.45, 1.1, p), lArm: lerp(Math.PI * 0.80, Math.PI * 0.55, p),
            rLeg: Math.PI * 0.55,      lLeg: Math.PI * 0.45,
            head: -0.08, torso: -0.06 * p }
        : { rArm: lerp(Math.PI + 0.45, Math.PI - 1.1, p), lArm: lerp(Math.PI * 0.20, Math.PI * 0.45, p),
            rLeg: Math.PI * 0.55, lLeg: Math.PI * 0.45,
            head: -0.08, torso: 0.06 * p };
    }

    // Walking: counter-swinging arms and legs
    if (s === 'walking') {
      const sw = Math.sin(t * 0.24) * 0.52;
      return {
        rArm:  Math.PI * 0.58 + sw,
        lArm:  Math.PI * 0.42 - sw,
        rLeg:  Math.PI * 0.50 + sw * 0.85,
        lLeg:  Math.PI * 0.50 - sw * 0.85,
        head:  Math.sin(t * 0.24) * 0.03,
        torso: 0,
      };
    }

    if (s === 'jumping') {
      return { rArm: -0.25, lArm: Math.PI + 0.25, rLeg: Math.PI * 0.65, lLeg: Math.PI * 0.35, head: -0.10, torso: -0.04 };
    }

    if (s === 'falling') {
      return { rArm: -0.10, lArm: Math.PI + 0.10, rLeg: Math.PI * 0.56, lLeg: Math.PI * 0.44, head: 0.06, torso: 0.03 };
    }

    if (s === 'shielding') {
      return {
        rArm: face > 0 ? -0.25 : Math.PI + 0.25,
        lArm: face > 0 ? -0.55 : Math.PI + 0.55,
        rLeg: Math.PI * 0.60, lLeg: Math.PI * 0.40,
        head: 0, torso: 0,
      };
    }

    // Idle (default): gentle breath oscillation
    const b = Math.sin(t * 0.045) * 0.045;
    return {
      rArm:  Math.PI * 0.58 + b,
      lArm:  Math.PI * 0.42 - b,
      rLeg:  Math.PI * 0.62,
      lLeg:  Math.PI * 0.38,
      head:  Math.sin(t * 0.025) * 0.03,
      torso: 0,
    };
  }

  // ---- Hit reactions ----

  /**
   * Apply a directional impulse to the limb at the impact position.
   * Nearby limbs receive smaller sympathetic impulses.
   * @param {Fighter} f
   * @param {number}  forceX  world-space horizontal force (± = direction)
   * @param {number}  forceY  world-space vertical force
   * @param {number}  impactX world-space X of impact
   * @param {number}  impactY world-space Y of impact
   */
  static applyHit(f, forceX, forceY, impactX, impactY) {
    const rd    = PlayerRagdoll.createRagdoll(f);
    const mag   = Math.hypot(forceX, forceY);
    const scale = Math.min(mag * 0.012, 0.55);   // cap: prevents spinning forever
    const sign  = forceX >= 0 ? 1 : -1;

    // Classify impact region (0 = top of fighter, f.h = bottom)
    const relY       = impactY - f.y;
    const headZone   = relY < f.h * 0.22;
    const torsoZone  = relY < f.h * 0.55;
    const rightSide  = impactX > f.cx();

    if (headZone) {
      // Head struck: large head flick, arms snap sympathetically
      rd.head.vel  += sign * scale * 1.55;
      rd.torso.vel += sign * scale * 0.48;
      rd.rArm.vel  += sign * scale * 0.38;
      rd.lArm.vel  -= sign * scale * 0.22;
    } else if (torsoZone) {
      // Torso struck: body rotates, near-side arm flung out
      rd.torso.vel += sign * scale * 0.88;
      if (rightSide) { rd.rArm.vel += scale * 1.30; rd.lArm.vel -= scale * 0.28; }
      else            { rd.lArm.vel += scale * 1.30; rd.rArm.vel -= scale * 0.28; }
      rd.rLeg.vel  += sign * scale * 0.22;
    } else {
      // Leg struck: near-side leg kicked, torso wobbles upward
      if (rightSide) { rd.rLeg.vel += scale * 1.45; rd.lLeg.vel -= scale * 0.18; }
      else            { rd.lLeg.vel += scale * 1.45; rd.rLeg.vel -= scale * 0.18; }
      rd.torso.vel += sign * scale * 0.32;
      rd.head.vel  += sign * scale * 0.16;
    }
  }

  // ---- State transitions ----

  /** Knockout: all joint springs near-zero — fighter flops freely. */
  static collapse(f) {
    const rd = PlayerRagdoll.createRagdoll(f);
    rd.collapsed     = true;
    rd.recovering    = false;
    rd.recoveryTimer = 0;
    rd.stiffness     = 0.003;
    rd.damping       = 0.88;
    // Random tumble impulse to each limb
    for (const limb of ['rArm', 'lArm', 'rLeg', 'lLeg', 'head', 'torso']) {
      rd[limb].vel += (Math.random() - 0.5) * 0.50;
    }
  }

  /** Recovery: ramp stiffness back up over 90 frames — fighter stands up. */
  static standUp(f) {
    const rd = PlayerRagdoll.createRagdoll(f);
    rd.collapsed     = false;
    rd.recovering    = true;
    rd.recoveryTimer = 0;
    rd.stiffness     = 0.20;
    rd.damping       = 0.84;
  }

  /** Lean torso + arms slightly into movement direction. */
  static applyMovement(f) {
    if (!f._rd) return;
    const lean = f.vx > 0.5 ? 0.03 : f.vx < -0.5 ? -0.03 : 0;
    f._rd.torso.vel += lean;
  }

  /** Jump impulse: arms sweep upward, legs kick out. */
  static applyJump(f) {
    const rd = PlayerRagdoll.createRagdoll(f);
    rd.rArm.vel  -= 0.28;
    rd.lArm.vel  -= 0.28;
    rd.rLeg.vel  -= 0.16;
    rd.lLeg.vel  += 0.16;
    rd.torso.vel -= 0.09;
    rd.head.vel  -= 0.06;
  }

  // ---- Debug ----

  /**
   * Draw joint angle vectors + state info over the fighter.
   * Enable: window.rdDebug = true
   */
  static debugDraw(f, cx, shoulderY, hipY) {
    if (!f._rd || !window.rdDebug) return;
    const rd = f._rd;
    ctx.save();
    ctx.globalAlpha = 0.65;
    const R = 11;
    const joints = [
      { j: rd.rArm,  x: cx, y: shoulderY, color: '#ff4488', label: 'rA' },
      { j: rd.lArm,  x: cx, y: shoulderY, color: '#44aaff', label: 'lA' },
      { j: rd.rLeg,  x: cx, y: hipY,      color: '#ff8800', label: 'rL' },
      { j: rd.lLeg,  x: cx, y: hipY,      color: '#88ff00', label: 'lL' },
      { j: rd.torso, x: cx, y: (shoulderY + hipY) / 2, color: '#ffff00', label: 'T' },
      { j: rd.head,  x: cx, y: shoulderY - 14,         color: '#ffffff', label: 'H' },
    ];
    for (const jt of joints) {
      // Arc showing angle range
      ctx.strokeStyle = jt.color;
      ctx.lineWidth   = 1.2;
      ctx.beginPath();
      ctx.arc(jt.x, jt.y, R, jt.j.angle - 0.38, jt.j.angle + 0.38);
      ctx.stroke();
      // Velocity vector
      const vLen = Math.min(Math.abs(jt.j.vel) * 75, 15);
      ctx.beginPath();
      ctx.moveTo(jt.x, jt.y);
      ctx.lineTo(jt.x + Math.cos(jt.j.angle) * vLen, jt.y + Math.sin(jt.j.angle) * vLen);
      ctx.stroke();
      // Label + angle value
      ctx.fillStyle = jt.color;
      ctx.font      = '7px monospace';
      ctx.fillText(`${jt.label}:${jt.j.angle.toFixed(1)}`, jt.x + 14, jt.y + 4);
    }
    // State summary
    ctx.fillStyle = '#cccccc';
    ctx.font      = '8px monospace';
    ctx.fillText(
      `k=${rd.stiffness.toFixed(3)} col=${rd.collapsed ? 'Y' : 'N'} rec=${rd.recovering ? rd.recoveryTimer : 'N'}`,
      cx - 22, shoulderY - 25
    );
    ctx.globalAlpha = 1;
    ctx.restore();
  }
}
