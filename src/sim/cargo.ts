import type { CargoSpec, CargoState, Rect } from './types';
import type { Slot } from '../data/cargo';
import { type Body, type Collider, type R, type World, DT, GROUPS, clamp, wrapAngle } from './physics';
import type { VehicleSim } from './vehicle';

export interface CargoEvent {
  type: 'strain' | 'snap' | 'loose' | 'lost' | 'recover-start' | 'recovered' | 'impact' | 'onboard';
  id: string;
  kind: CargoSpec['kind'];
  strength?: number;
  x: number;
  y: number;
}

interface Pickup {
  t: number;
  from: [number, number, number];
  slot: Slot;
}

export class CargoItem {
  state: CargoState = 'onboard';
  strapped = true;
  strapBroken = false;
  condition = 1;
  /** 0..1, how hard the strap is working right now (visual + audio cue). */
  tension = 0;
  overload = 0;
  impactCooldown = 0;
  strainLatched = false;
  pickup: Pickup | null = null;
  recoveredOnce = false;
  lastTouchedDeck = 0;

  constructor(
    readonly spec: CargoSpec,
    readonly body: Body,
    readonly collider: Collider,
    public slot: Slot,
  ) {}

  get pos() {
    return this.body.translation();
  }
}

export interface RestraintConfig {
  stiffness: number; // N/m per kg
  damping: number;
  breakDistance: number; // m
  breakTime: number; // s over the limit before it snaps
}

export function restraintFor(strength: number): RestraintConfig {
  return {
    stiffness: 380 * strength,
    damping: 26 * Math.sqrt(strength),
    breakDistance: 0.2 * Math.sqrt(strength),
    breakTime: 0.05 * strength,
  };
}

/** All parcels for one attempt. */
export class CargoSystem {
  readonly items: CargoItem[] = [];
  readonly events: CargoEvent[] = [];
  private byCollider = new Map<number, CargoItem>();
  private time = 0;

  constructor(
    private rapier: R,
    world: World,
    private vehicle: VehicleSim,
    specs: CargoSpec[],
    slots: Slot[],
    private restraint: RestraintConfig,
  ) {
    for (const slot of slots) {
      const spec = specs.find((s) => s.id === slot.cargoId);
      if (!spec) continue;
      const [wx, wy] = vehicle.toWorld(slot.x, slot.y);
      const body = world.createRigidBody(
        rapier.RigidBodyDesc.dynamic()
          .setTranslation(wx, wy)
          .setRotation(vehicle.angle)
          // Hard CCD between parcels and the deck they ride on clamps the whole
          // vehicle's motion at speed (a sudden invisible "wall"). Soft CCD
          // predicts contacts without clamping.
          .setSoftCcdPrediction(0.3)
          .setLinearDamping(0.05)
          .setAngularDamping(0.2),
      );
      const shrink = spec.kind === 'flamingo' ? 0.8 : 1;
      const desc = rapier.ColliderDesc.roundCuboid((spec.w * shrink) / 2 - 0.02, spec.h / 2 - 0.02, 0.02)
        .setMass(spec.mass)
        .setFriction(spec.kind === 'flamingo' ? 0.5 : 0.8)
        .setRestitution(spec.kind === 'flamingo' ? 0.35 : 0.08)
        .setCollisionGroups(GROUPS.cargo)
        .setActiveEvents(rapier.ActiveEvents.CONTACT_FORCE_EVENTS)
        .setContactForceEventThreshold(spec.mass * 30);
      const collider = world.createCollider(desc, body);
      const item = new CargoItem(spec, body, collider, slot);
      this.items.push(item);
      this.byCollider.set(collider.handle, item);
    }
  }

  get totalMass() {
    return this.items.reduce((s, i) => s + i.spec.mass, 0);
  }

  itemForCollider(handle: number) {
    return this.byCollider.get(handle);
  }

  /** Straps pull each parcel toward its slot; the chassis takes the reaction. */
  applyRestraints() {
    const v = this.vehicle;
    const chassis = v.chassis;
    const ca = chassis.rotation();
    const cw = chassis.angvel();
    const cfg = this.restraint;
    for (const it of this.items) {
      if (it.pickup || !it.strapped) {
        it.tension = 0;
        continue;
      }
      const [ax, ay] = v.toWorld(it.slot.x, it.slot.y);
      const p = it.body.translation();
      const dx = ax - p.x;
      const dy = ay - p.y;
      const dist = Math.hypot(dx, dy);
      const va = chassis.velocityAtPoint({ x: ax, y: ay });
      const vb = it.body.linvel();
      const m = it.spec.mass;
      const k = cfg.stiffness * m;
      const c = cfg.damping * m;
      let fx = k * dx + c * (va.x - vb.x);
      let fy = k * dy + c * (va.y - vb.y);
      it.body.applyImpulse({ x: fx * DT, y: fy * DT }, true);
      chassis.applyImpulseAtPoint({ x: -fx * DT, y: -fy * DT }, { x: ax, y: ay }, true);

      // Keep the parcel roughly square to the deck.
      const da = wrapAngle(ca - it.body.rotation());
      const I = m * (it.spec.w * it.spec.w + it.spec.h * it.spec.h) / 12;
      const tq = (da * 90 + (cw - it.body.angvel()) * 9) * I;
      it.body.applyTorqueImpulse(tq * DT, true);
      chassis.applyTorqueImpulse(-tq * DT, true);

      const slack = 0.03;
      it.tension = clamp((dist - slack) / (cfg.breakDistance - slack), 0, 1.5);
      if (dist > cfg.breakDistance) {
        it.overload += DT;
        if (it.overload > cfg.breakTime || dist > cfg.breakDistance * 2.2) {
          it.strapped = false;
          it.strapBroken = true;
          it.tension = 0;
          this.push('snap', it);
        }
      } else {
        it.overload = Math.max(0, it.overload - DT * 0.5);
        // One creak per strain episode, not one per physics step.
        if (it.tension > 0.7 && !it.strainLatched) {
          it.strainLatched = true;
          this.push('strain', it, it.tension);
        } else if (it.tension < 0.3) it.strainLatched = false;
      }
    }
  }

  /** Convert contact force reports into condition damage. */
  onContactForce(handle: number, totalForce: number) {
    const it = this.byCollider.get(handle);
    if (!it || it.pickup || it.state === 'lost' || it.state === 'delivered') return;
    const dv = (totalForce * DT) / it.spec.mass;
    if (dv > 2.2 && (it.spec.kind === 'flamingo' || dv > 3.2)) this.push('impact', it, dv);
    if (it.impactCooldown > 0) return;
    if (dv > it.spec.damageThreshold) {
      it.condition = clamp(it.condition - (dv - it.spec.damageThreshold) * it.spec.damageScale, 0, 1);
      it.impactCooldown = 0.12;
    }
  }

  /** Classify each parcel relative to the deck and the course's fail volumes. */
  updateStates(water: Rect[], killY: number, bounds: { x0: number; x1: number }) {
    this.time += DT;
    const v = this.vehicle;
    const d = v.spec.deck;
    for (const it of this.items) {
      if (it.impactCooldown > 0) it.impactCooldown -= DT;
      if (it.state === 'lost' || it.state === 'delivered' || it.pickup) continue;
      const p = it.pos;
      const inWater = water.some((w) => p.x > w.x0 && p.x < w.x1 && p.y > w.y0 - 1 && p.y < w.y1);
      if (inWater || p.y < killY || p.x < bounds.x0 - 5 || p.x > bounds.x1 + 20) {
        it.state = 'lost';
        it.strapped = false;
        this.push('lost', it);
        continue;
      }
      const [lx, ly] = v.toLocal(p.x, p.y);
      const onDeck = lx > d.x0 - 0.25 && lx < d.x1 + 0.35 && ly > d.y - 0.15 && ly < d.y + 2.6;
      if (it.strapped || onDeck) {
        if (it.state === 'loose') {
          it.state = 'onboard';
          this.push('onboard', it);
        }
        it.lastTouchedDeck = this.time;
      } else if (it.state === 'onboard') {
        it.state = 'loose';
        this.push('loose', it);
      }
    }
  }

  /** Slot is free when no onboard parcel sits near it. */
  private slotFree(slot: Slot, except: CargoItem) {
    const v = this.vehicle;
    for (const o of this.items) {
      if (o === except || o.state !== 'onboard') continue;
      const [lx, ly] = v.toLocal(o.pos.x, o.pos.y);
      if (Math.abs(lx - slot.x) < 0.3 && Math.abs(ly - slot.y) < 0.3) return false;
    }
    return true;
  }

  /** Candidates for the arcade pickup: slow, close, a vacant slot, reachable. */
  tryRecover(allSlots: Slot[]): CargoItem | null {
    const v = this.vehicle;
    if (v.speed > 2.4 || v.airborne || Math.abs(v.angle) > 0.5) return null;
    for (const it of this.items) {
      if (it.state !== 'loose' || it.pickup) continue;
      const p = it.pos;
      const lin = it.body.linvel();
      if (Math.hypot(lin.x, lin.y) > 2) continue;
      const [cx, cy] = v.toWorld((v.spec.deck.x0 + v.spec.deck.x1) / 2, v.spec.deck.y);
      if (Math.hypot(p.x - cx, p.y - cy) > 3.4) continue;
      // Prefer its own slot; otherwise the lowest free one.
      const ordered = [it.slot, ...allSlots.filter((s) => s !== it.slot).sort((a, b) => a.y - b.y)];
      const slot = ordered.find((s) => this.slotFree(s, it));
      if (!slot) continue;
      it.pickup = { t: 0, from: [p.x, p.y, it.body.rotation()], slot };
      it.body.setBodyType(this.rapier.RigidBodyType.KinematicPositionBased, true);
      it.collider.setCollisionGroups(GROUPS.none);
      this.push('recover-start', it);
      return it;
    }
    return null;
  }

  /** Animate active pickups along a short arc into the slot. */
  stepPickups() {
    const v = this.vehicle;
    for (const it of this.items) {
      const pk = it.pickup;
      if (!pk) continue;
      pk.t += DT / 0.5;
      const t = clamp(pk.t, 0, 1);
      const e = t * t * (3 - 2 * t);
      const [tx, ty] = v.toWorld(pk.slot.x, pk.slot.y);
      const x = pk.from[0] + (tx - pk.from[0]) * e;
      const y = pk.from[1] + (ty - pk.from[1]) * e + Math.sin(Math.PI * t) * 1.2;
      const a = pk.from[2] + wrapAngle(v.angle - pk.from[2]) * e;
      it.body.setNextKinematicTranslation({ x, y });
      it.body.setNextKinematicRotation(a);
      if (pk.t >= 1) {
        it.pickup = null;
        it.slot = pk.slot;
        it.body.setBodyType(this.rapier.RigidBodyType.Dynamic, true);
        it.collider.setCollisionGroups(GROUPS.cargo);
        const cv = v.chassis.linvel();
        it.body.setLinvel({ x: cv.x, y: cv.y }, true);
        it.body.setAngvel(0, true);
        it.strapped = true;
        it.state = 'onboard';
        it.recoveredOnce = true;
        this.push('recovered', it);
      }
    }
  }

  private push(type: CargoEvent['type'], it: CargoItem, strength?: number) {
    const p = it.pos;
    this.events.push({ type, id: it.spec.id, kind: it.spec.kind, strength, x: p.x, y: p.y });
  }

  counts() {
    let onboard = 0;
    let lost = 0;
    let loose = 0;
    for (const it of this.items) {
      if (!it.spec.required) continue;
      if (it.state === 'onboard' || it.pickup) onboard++;
      else if (it.state === 'lost') lost++;
      else if (it.state === 'loose') loose++;
    }
    return { onboard, lost, loose };
  }
}

