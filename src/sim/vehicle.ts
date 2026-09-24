import type { InputState, VehicleSpec, WheelSpec } from './types';
import { type Body, type Collider, type R, type World, DT, GRAVITY, GROUPS, clamp, rotate, touchingTerrain } from './physics';

interface WheelRig {
  spec: WheelSpec;
  axle: Body;
  wheel: Body;
  collider: Collider;
  k: number;
  c: number;
  preload: number;
  grounded: boolean;
  compression: number;
  lastCompression: number;
}

export interface VehicleContacts {
  rear: boolean;
  front: boolean;
  body: boolean;
  head: boolean;
}

/**
 * Plane-constrained three-wheeler. The two real front wheels share one
 * effective front support in the side plane; the renderer draws both.
 */
export class VehicleSim {
  readonly spec: VehicleSpec;
  readonly chassis: Body;
  readonly hull: Collider;
  readonly deckColliders: Collider[] = [];
  readonly head: Collider;
  readonly rear: WheelRig;
  readonly front: WheelRig;
  contacts: VehicleContacts = { rear: false, front: false, body: false, head: false };
  reverse = false;
  private reverseTimer = 0;
  autoBalance = false;
  /** Latest landing jolt (m/s of suspension closing speed), for audio/fx. */
  landingJolt = 0;

  constructor(
    private rapier: R,
    private world: World,
    spec: VehicleSpec,
    x: number,
    groundY: number,
    cargoMass: number,
  ) {
    this.spec = spec;
    const rest = Math.max(spec.rear.radius - spec.rear.y, spec.front.radius - spec.front.y);
    const y = groundY + rest + 0.02;

    const bodyDesc = rapier.RigidBodyDesc.dynamic()
      .setTranslation(x, y)
      // Soft CCD: hard CCD against the parcels riding on the deck clamps motion.
      .setSoftCcdPrediction(0.5)
      .setLinearDamping(0.02)
      .setAngularDamping(0.15);
    this.chassis = world.createRigidBody(bodyDesc);

    const hullPts = new Float32Array(spec.hull.flat());
    const L = Math.max(...spec.hull.map((p) => p[0])) - Math.min(...spec.hull.map((p) => p[0]));
    const H = Math.max(...spec.hull.map((p) => p[1])) - Math.min(...spec.hull.map((p) => p[1]));
    const inertia = ((spec.chassisMass * (L * L + H * H)) / 12) * spec.inertiaScale;
    // Rounded hull: a sharp corner sliding along a polyline snags on the joints
    // between segments ("ghost" walls). The radius is small and invisible.
    const hullDesc = (rapier.ColliderDesc.roundConvexHull(hullPts, 0.06) ?? rapier.ColliderDesc.convexHull(hullPts)!)
      .setMassProperties(spec.chassisMass, { x: spec.com[0], y: spec.com[1] }, inertia)
      .setFriction(0.6)
      .setRestitution(0.05)
      .setCollisionGroups(GROUPS.chassis);
    this.hull = world.createCollider(hullDesc, this.chassis);

    // Cargo deck, rear lip and headboard. Massless: the chassis mass is set above.
    const d = spec.deck;
    const deckLen = d.x1 - d.x0;
    const mk = (hx: number, hy: number, cx: number, cy: number, friction: number) => {
      const desc = rapier.ColliderDesc.cuboid(hx, hy)
        .setTranslation(cx, cy)
        .setDensity(0)
        .setFriction(friction)
        .setRestitution(0.02)
        .setCollisionGroups(GROUPS.chassis);
      const col = world.createCollider(desc, this.chassis);
      this.deckColliders.push(col);
      return col;
    };
    mk(deckLen / 2, 0.05, (d.x0 + d.x1) / 2, d.y - 0.05, 0.75);
    mk(0.025, d.lip / 2 + 0.02, d.x0 - 0.02, d.y + d.lip / 2, 0.5);
    mk(0.03, 0.26, d.x1 + 0.03, d.y + 0.26, 0.4);

    const headDesc = rapier.ColliderDesc.ball(spec.head.r)
      .setTranslation(spec.head.x, spec.head.y)
      .setDensity(0)
      .setFriction(0.4)
      .setCollisionGroups(GROUPS.chassis);
    this.head = world.createCollider(headDesc, this.chassis);

    // Static load share per axle, including the cargo sitting over the rear.
    const cargoX = (d.x0 + d.x1) / 2;
    const total = spec.chassisMass + cargoMass;
    const comX = (spec.chassisMass * spec.com[0] + cargoMass * cargoX) / total;
    const span = spec.front.x - spec.rear.x;
    const rearShare = clamp((spec.front.x - comX) / span, 0.25, 0.75);
    this.rear = this.makeWheel(spec.rear, total * rearShare, x, y);
    this.front = this.makeWheel(spec.front, total * (1 - rearShare), x, y);
  }

  private makeWheel(w: WheelSpec, sprung: number, x: number, y: number): WheelRig {
    const { rapier, world, spec } = this;
    const ax = x + w.x;
    const ay = y + w.y;
    const axle = world.createRigidBody(
      rapier.RigidBodyDesc.dynamic().setTranslation(ax, ay).setAdditionalMassProperties(4, { x: 0, y: 0 }, 0.08),
    );
    const wheel = world.createRigidBody(
      rapier.RigidBodyDesc.dynamic().setTranslation(ax, ay).setCcdEnabled(true).setAngularDamping(0.05),
    );
    const collider = world.createCollider(
      rapier.ColliderDesc.ball(w.radius)
        .setMass(w.mass)
        .setFriction(spec.grip)
        .setRestitution(0.02)
        .setCollisionGroups(GROUPS.wheel),
      wheel,
    );
    const pj = rapier.JointData.prismatic({ x: w.x, y: w.y }, { x: 0, y: 0 }, { x: 0, y: 1 });
    pj.limitsEnabled = true;
    pj.limits = [-spec.suspension.down, spec.suspension.up];
    const j1 = world.createImpulseJoint(pj, this.chassis, axle, true);
    j1.setContactsEnabled(false);
    const j2 = world.createImpulseJoint(rapier.JointData.revolute({ x: 0, y: 0 }, { x: 0, y: 0 }), axle, wheel, true);
    j2.setContactsEnabled(false);

    const omega = 2 * Math.PI * spec.suspension.freq;
    const k = sprung * omega * omega;
    const c = 2 * spec.suspension.damping * Math.sqrt(k * sprung);
    return { spec: w, axle, wheel, collider, k, c, preload: sprung * GRAVITY, grounded: false, compression: 0, lastCompression: 0 };
  }

  get position() {
    return this.chassis.translation();
  }
  get angle() {
    return this.chassis.rotation();
  }
  get speed() {
    const v = this.chassis.linvel();
    return Math.hypot(v.x, v.y);
  }
  /** Velocity along the chassis' forward axis. */
  get forwardSpeed() {
    const v = this.chassis.linvel();
    const a = this.chassis.rotation();
    return v.x * Math.cos(a) + v.y * Math.sin(a);
  }
  get airborne() {
    return !this.contacts.rear && !this.contacts.front && !this.contacts.body;
  }

  /** Local point -> world. */
  toWorld(lx: number, ly: number): [number, number] {
    const p = this.chassis.translation();
    const [rx, ry] = rotate(lx, ly, this.chassis.rotation());
    return [p.x + rx, p.y + ry];
  }
  /** World point -> chassis-local. */
  toLocal(wx: number, wy: number): [number, number] {
    const p = this.chassis.translation();
    return rotate(wx - p.x, wy - p.y, -this.chassis.rotation());
  }

  updateContacts(terrain: Set<number>) {
    const { world } = this;
    this.rear.grounded = touchingTerrain(world, this.rear.collider, terrain);
    this.front.grounded = touchingTerrain(world, this.front.collider, terrain);
    this.contacts = {
      rear: this.rear.grounded,
      front: this.front.grounded,
      body: touchingTerrain(world, this.hull, terrain),
      head: touchingTerrain(world, this.head, terrain),
    };
  }

  /** Apply suspension, drive, brake and pitch for one fixed step. */
  applyControls(input: InputState, enabled: boolean) {
    const { spec, chassis } = this;
    const dt = DT;
    this.landingJolt = 0;
    for (const w of [this.rear, this.front]) this.applySpring(w);

    const throttle = enabled ? input.throttle : 0;
    const brake = enabled ? input.brake : 0;
    const pitch = enabled ? input.pitch : 0;
    const vF = this.forwardSpeed;
    const grounded = this.contacts.rear || this.contacts.front;

    // Brake -> (after a short, deliberate hold at a stop) reverse.
    if (brake > 0.5 && vF < 0.6 && grounded) {
      this.reverseTimer += dt;
      if (this.reverseTimer > 0.35) this.reverse = true;
    } else if (brake < 0.2) {
      this.reverseTimer = 0;
      this.reverse = false;
    }

    const rw = this.rear.wheel;
    const wc = chassis.angvel();
    const wRel = rw.angvel() - wc;
    const r = spec.rear.radius;

    if (throttle > 0) {
      const ratio = vF / spec.drive.topSpeed;
      const taper = clamp(1 - ratio * ratio * ratio, 0, 1);
      // Airborne wheel spin limit, so a held throttle doesn't wind the wheel to infinity.
      const spinCap = -wRel * r > spec.drive.topSpeed * 1.08 ? 0 : 1;
      const T = throttle * spec.drive.torque * taper * spinCap;
      rw.applyTorqueImpulse(-T * dt, true);
      chassis.applyTorqueImpulse(T * spec.drive.reaction * dt, true);
    }

    if (this.reverse && brake > 0.2) {
      const taper = clamp(1 + vF / spec.drive.reverseSpeed, 0, 1);
      const T = spec.drive.torque * 0.5 * taper;
      rw.applyTorqueImpulse(T * dt, true);
    } else if (brake > 0) {
      for (const w of [this.rear, this.front]) this.applyBrake(w, brake * spec.drive.brake);
    }

    // Rolling resistance and a little aero drag.
    const v = chassis.linvel();
    const sp = Math.hypot(v.x, v.y);
    if (sp > 0.01) {
      const drag = 0.32 * sp * sp + (grounded ? 22 : 0);
      chassis.applyImpulse({ x: (-v.x / sp) * drag * dt, y: (-v.y / sp) * drag * dt }, true);
    }

    // Pitch: real torque, tapered near the rotation limit.
    const w = chassis.angvel();
    if (this.airborne) {
      let T = pitch * spec.pitch.air;
      const maxW = spec.pitch.airMaxOmega;
      if (T * w > 0) T *= clamp(1 - (Math.abs(w) - 0.55 * maxW) / (0.45 * maxW), 0, 1);
      if (pitch === 0 && this.autoBalance) {
        const a = chassis.rotation();
        T = clamp(-a * 1800 - w * 700, -spec.pitch.air * 0.6, spec.pitch.air * 0.6);
      }
      chassis.applyTorqueImpulse(T * dt, true);
    } else if (pitch !== 0) {
      // Hung on an edge (body touching, a wheel dangling): extra leverage so
      // the player can rock free instead of waiting for a stuck reset.
      const hung = this.contacts.body && !(this.contacts.rear && this.contacts.front);
      chassis.applyTorqueImpulse(pitch * spec.pitch.ground * (hung ? 3.5 : 1) * dt, true);
    }
  }

  private applySpring(w: WheelRig) {
    const { chassis } = this;
    const a = chassis.rotation();
    const [ux, uy] = rotate(0, 1, a);
    const [axw, ayw] = this.toWorld(w.spec.x, w.spec.y);
    const p = w.axle.translation();
    const d = (p.x - axw) * ux + (p.y - ayw) * uy;
    const vA = chassis.velocityAtPoint({ x: axw, y: ayw });
    const vP = w.axle.linvel();
    const vrel = (vP.x - vA.x) * ux + (vP.y - vA.y) * uy;
    let F = w.preload + w.k * d + w.c * vrel;
    if (F < 0) F = 0;
    const imp = F * DT;
    w.axle.applyImpulse({ x: -ux * imp, y: -uy * imp }, true);
    chassis.applyImpulseAtPoint({ x: ux * imp, y: uy * imp }, { x: axw, y: ayw }, true);
    w.lastCompression = w.compression;
    w.compression = d;
    if (vrel > this.landingJolt) this.landingJolt = vrel;
  }

  private applyBrake(w: WheelRig, torque: number) {
    const rel = w.wheel.angvel() - this.chassis.angvel();
    const I = w.wheel.principalInertia();
    const max = torque * DT;
    const imp = clamp(-rel * I, -max, max);
    w.wheel.applyTorqueImpulse(imp, true);
    this.chassis.applyTorqueImpulse(-imp, true);
  }

  /** Render snapshot data for the wheels. */
  wheelState() {
    const out = [] as { x: number; y: number; spin: number; compression: number }[];
    for (const w of [this.rear, this.front]) {
      const p = w.wheel.translation();
      out.push({ x: p.x, y: p.y, spin: w.wheel.rotation(), compression: w.compression });
    }
    return out;
  }
}
