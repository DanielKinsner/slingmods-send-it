import type { Build, CourseSpec, InputState, Rect, SurfaceKind } from '../sim/types';
import { type R, type World, DT, GRAVITY, GROUPS, wrapAngle } from '../sim/physics';
import { VehicleSim } from '../sim/vehicle';
import { CargoSystem, type CargoEvent, restraintFor } from '../sim/cargo';
import { CARGO, MIN_TO_PASS, PRESETS, REQUIRED_COUNT, type Slot, layoutCargo } from '../data/cargo';
import { RESTRAINTS, applyBuild } from '../data/vehicles';
import { heightAt } from '../data/courses/build';
import { StuntTracker, type StuntAward } from './stunts';
import { type ScoreBreakdown, type Stamps, scoreRun, stampsFor } from './scoring';

export const CONTENT_VERSION = 'send-it-1.0';

export type RunPhase = 'ready' | 'running' | 'settling' | 'finished' | 'failed';
export type FailReason = 'pool' | 'wipeout' | 'inverted' | 'bounds' | 'stuck';

export type GameEvent =
  | { type: 'start' }
  | { type: 'prompt'; id: string; text: string }
  | { type: 'dispatch'; event: string }
  | { type: 'stunt-pending'; awards: StuntAward[]; total: number }
  | { type: 'stunt-banked'; awards: StuntAward[]; total: number; flips: number }
  | { type: 'stunt-dropped'; total: number }
  | { type: 'cargo'; ev: CargoEvent }
  | { type: 'landing'; jolt: number; x: number; y: number }
  | { type: 'fail'; reason: FailReason; x: number; y: number }
  | { type: 'stopping' }
  | { type: 'finished'; result: RunResult }
  | { type: 'impossible' }
  | { type: 'shortcut' }
  | { type: 'surface'; surface: SurfaceKind };

export interface ParcelResult {
  id: string;
  kind: string;
  label: string;
  required: boolean;
  state: string;
  condition: number;
  delivered: boolean;
}

export interface RunResult {
  attemptId: string;
  contentVersion: string;
  courseId: string;
  build: Build;
  assist: boolean;
  seed: number;
  passed: boolean;
  failReason: FailReason | 'insufficient' | null;
  delivered: number;
  required: number;
  parcels: ParcelResult[];
  flamingo: boolean;
  time: number;
  style: number;
  flips: number;
  route: 'safe' | 'shortcut';
  recovered: boolean;
  score: ScoreBreakdown;
  stamps: Stamps;
}

export interface RunOptions {
  assist?: boolean;
  seed?: number;
  attemptId?: string;
}

let attemptCounter = 0;
function newAttemptId() {
  attemptCounter++;
  const rnd = Math.floor(Math.random() * 1e9).toString(36);
  return `${Date.now().toString(36)}-${attemptCounter}-${rnd}`;
}

function inRect(r: Rect, x: number, y: number) {
  return x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1;
}

/** One attempt: its own physics world, vehicle, cargo and rules. */
export class Run {
  readonly world: World;
  readonly vehicle: VehicleSim;
  readonly cargo: CargoSystem;
  readonly stunts: StuntTracker;
  readonly slots: Slot[];
  readonly attemptId: string;
  readonly assist: boolean;
  readonly seed: number;
  phase: RunPhase = 'ready';
  time = 0;
  /** Simulated seconds since construction (for fx). */
  simTime = 0;
  route: 'safe' | 'shortcut' = 'safe';
  failReason: FailReason | null = null;
  result: RunResult | null = null;
  readonly events: GameEvent[] = [];
  private terrain = new Set<number>();
  private eventQueue;
  private stopTimer = 0;
  private settleTimer = 0;
  private headTimer = 0;
  private invertedTimer = 0;
  private stuckTimer = 0;
  private promptsShown = new Set<string>();
  private wasAirborne = false;
  private airTime = 0;
  private prevVy = 0;
  private impossibleSent = false;
  private failTimer = 0;
  learned = { throttle: false, brake: false, pitch: false };
  private throttleHeld = 0;

  constructor(
    private rapier: R,
    readonly course: CourseSpec,
    readonly build: Build,
    opts: RunOptions = {},
  ) {
    this.attemptId = opts.attemptId ?? newAttemptId();
    this.assist = !!opts.assist;
    this.seed = opts.seed ?? 1;
    this.world = new rapier.World({ x: 0, y: -GRAVITY });
    this.world.timestep = DT;
    this.world.numSolverIterations = 8;
    this.eventQueue = new rapier.EventQueue(true);
    this.buildTerrain();

    const spec = applyBuild(build);
    const preset = PRESETS[build.preset];
    this.slots = layoutCargo(spec, preset);
    const cargoMass = CARGO.reduce((s, c) => s + c.mass, 0);
    const [sx] = course.start;
    const groundY = heightAt(course.roads[0].points, sx) ?? course.start[1];
    this.vehicle = new VehicleSim(rapier, this.world, spec, sx, groundY, cargoMass);
    this.vehicle.autoBalance = this.assist;
    const strength = preset.restraint * RESTRAINTS[build.restraint].strength;
    this.cargo = new CargoSystem(rapier, this.world, this.vehicle, CARGO, this.slots, restraintFor(strength));
    this.stunts = new StuntTracker(course.zones);
  }

  private buildTerrain() {
    const { rapier, world, course } = this;
    const friction: Record<SurfaceKind, number> = { asphalt: 1.1, concrete: 1.0, wood: 0.95, roof: 1.0, tile: 0.9, grass: 0.85 };
    for (const road of course.roads) {
      const verts = new Float32Array(road.points.flat());
      const col = world.createCollider(
        rapier.ColliderDesc.polyline(verts).setFriction(friction[road.surface]).setCollisionGroups(GROUPS.terrain),
      );
      this.terrain.add(col.handle);
    }
    for (const s of course.solids) {
      const pts = [...s.outline, s.outline[0]];
      const col = world.createCollider(
        rapier.ColliderDesc.polyline(new Float32Array(pts.flat())).setFriction(friction[s.surface]).setCollisionGroups(GROUPS.terrain),
      );
      this.terrain.add(col.handle);
    }
  }

  /** Advance one fixed step (1/120 s). */
  step(input: InputState) {
    const { vehicle, cargo } = this;
    this.simTime += DT;
    if (this.phase === 'ready' && input.throttle > 0.05) {
      this.phase = 'running';
      this.events.push({ type: 'start' });
      this.events.push({ type: 'dispatch', event: 'run_started' });
    }
    const driving = this.phase === 'ready' || this.phase === 'running';
    const ctl: InputState = this.phase === 'settling' ? { throttle: 0, brake: 1, pitch: 0 } : input;
    vehicle.applyControls(ctl, driving || this.phase === 'settling');
    cargo.applyRestraints();
    cargo.stepPickups();

    this.world.step(this.eventQueue);
    this.eventQueue.drainContactForceEvents((e) => {
      const f = e.totalForceMagnitude();
      cargo.onContactForce(e.collider1(), f);
      cargo.onContactForce(e.collider2(), f);
    });
    this.eventQueue.drainCollisionEvents(() => {});

    vehicle.updateContacts(this.terrain);
    cargo.updateStates(this.course.water, this.course.killY, this.course.bounds);
    if (this.phase === 'running') this.time += DT;

    this.learn(input);
    this.rules(input);
    for (const ev of cargo.events) this.events.push({ type: 'cargo', ev });
    cargo.events.length = 0;
  }

  private learn(input: InputState) {
    const v = this.vehicle;
    if (input.throttle > 0.5) this.throttleHeld += DT;
    if (this.throttleHeld > 1.2) this.learned.throttle = true;
    if (input.brake > 0.5 && v.forwardSpeed > 3) this.learned.brake = true;
    if (input.pitch !== 0 && v.airborne) this.learned.pitch = true;
  }

  private rules(input: InputState) {
    const { vehicle: v, course } = this;
    const p = v.position;
    const angle = wrapAngle(v.angle);
    const failed = this.phase === 'failed';

    // Landing jolts for audio/fx.
    const air = v.airborne;
    if (air) this.airTime += DT;
    if (this.wasAirborne && !air && this.airTime > 0.2) {
      this.events.push({ type: 'landing', jolt: Math.max(0.5, -this.prevVy), x: p.x, y: p.y });
    }
    this.prevVy = v.chassis.linvel().y;
    if (!air) this.airTime = 0;
    this.wasAirborne = air;

    // Stunts.
    const sEvents = this.stunts.step(
      { x: p.x, y: p.y, angle, airborne: air, rear: v.contacts.rear, front: v.contacts.front, forwardSpeed: v.forwardSpeed, failed },
      DT,
    );
    for (const e of sEvents) {
      if (e.type === 'pending') this.events.push({ type: 'stunt-pending', awards: e.awards, total: e.total });
      else if (e.type === 'banked') {
        this.events.push({ type: 'stunt-banked', awards: e.awards, total: e.total, flips: e.flips });
        const zoneBonus = e.awards.find((a) => course.zones.some((z) => z.id === a.id && z.event));
        if (zoneBonus) {
          const z = course.zones.find((zz) => zz.id === zoneBonus.id)!;
          this.events.push({ type: 'dispatch', event: this.cargo.counts().onboard === REQUIRED_COUNT ? 'all_cargo_clean_landing' : z.event! });
        } else if (e.flips > 0) this.events.push({ type: 'dispatch', event: 'flip_banked' });
      } else if (e.type === 'dropped') this.events.push({ type: 'stunt-dropped', total: e.total });
    }

    if (this.phase === 'finished') return;
    if (failed) {
      this.failTimer += DT;
      return;
    }

    // Zones: prompts and route tracking.
    for (const z of course.zones) {
      if (!inRect(z, p.x, p.y)) continue;
      if (z.kind === 'prompt' && !this.promptsShown.has(z.id)) {
        const learned = z.lesson && z.lesson !== 'deliver' && this.learned[z.lesson];
        this.promptsShown.add(z.id);
        if (!learned && z.text) this.events.push({ type: 'prompt', id: z.id, text: z.text });
      } else if (z.kind === 'shortcut' && this.route !== 'shortcut') {
        this.route = 'shortcut';
        this.events.push({ type: 'shortcut' });
      }
    }

    // Failures.
    const inWater = course.water.some((w) => p.x > w.x0 && p.x < w.x1 && p.y < w.y1 + 0.35 && p.y > w.y0 - 1.5);
    if (inWater) return this.fail('pool');
    if (p.y < course.killY || p.x < course.bounds.x0 || p.x > course.bounds.x1 + 10) return this.fail('bounds');
    this.headTimer = v.contacts.head ? this.headTimer + DT : 0;
    if (this.headTimer > 0.06) return this.fail('wipeout');
    const upsideDown = Math.abs(angle) > 1.9;
    this.invertedTimer = upsideDown && (!air || v.speed < 1.5) ? this.invertedTimer + DT : 0;
    if (this.invertedTimer > 1.6) return this.fail('inverted');
    // Hung up on an edge with no way to drive: end it rather than soft-lock.
    const hung = this.phase === 'running' && v.speed < 0.25 && !(v.contacts.rear && v.contacts.front) && !inRect(course.delivery, p.x, p.y);
    this.stuckTimer = hung ? this.stuckTimer + DT : 0;
    if (this.stuckTimer > 3) return this.fail('stuck');

    // Parcel recovery.
    if (this.phase === 'running') this.cargo.tryRecover(this.slots);

    // Contract cannot pass any more: say so, once.
    const counts = this.cargo.counts();
    if (!this.impossibleSent && counts.lost > REQUIRED_COUNT - MIN_TO_PASS) {
      this.impossibleSent = true;
      this.events.push({ type: 'impossible' });
      this.events.push({ type: 'dispatch', event: 'all_required_cargo_lost' });
    }

    // Delivery: stop in the bay, upright, then let cargo settle.
    const inBay = inRect(course.delivery, p.x, p.y);
    if (this.phase === 'running') {
      if (inBay && v.speed < 1.0 && Math.abs(angle) < 0.6 && !air) this.stopTimer += DT;
      else this.stopTimer = 0;
      if (this.stopTimer >= 0.7) {
        this.phase = 'settling';
        this.settleTimer = 0;
        this.events.push({ type: 'stopping' });
      }
    } else if (this.phase === 'settling') {
      this.settleTimer += DT;
      if (this.settleTimer >= 1.0) this.finish();
    }
    void input;
  }

  private fail(reason: FailReason) {
    if (this.phase === 'failed' || this.phase === 'finished') return;
    this.phase = 'failed';
    this.failReason = reason;
    const p = this.vehicle.position;
    this.events.push({ type: 'fail', reason, x: p.x, y: p.y });
    this.events.push({ type: 'dispatch', event: reason === 'pool' ? 'pool_failure' : 'inverted_failure' });
    this.result = this.buildResult(false);
    // Stunt tracker drops pending points on the next step via `failed`.
  }

  private finish() {
    this.result = this.buildResult(true);
    this.phase = 'finished';
    this.events.push({ type: 'finished', result: this.result });
  }

  /** Count parcels that actually arrived: on the deck, or inside the bay. */
  private buildResult(reachedBay: boolean): RunResult {
    const { course } = this;
    const parcels: ParcelResult[] = this.cargo.items.map((it) => {
      const p = it.pos;
      const inBay = inRect(course.delivery, p.x, p.y);
      const delivered = reachedBay && it.state !== 'lost' && (it.state === 'onboard' || inBay) && !it.pickup;
      if (delivered) it.state = 'delivered';
      return {
        id: it.spec.id,
        kind: it.spec.kind,
        label: it.spec.label,
        required: it.spec.required,
        state: it.state,
        condition: it.condition,
        delivered,
      };
    });
    const req = parcels.filter((p) => p.required && p.delivered);
    const delivered = req.length;
    const passed = reachedBay && delivered >= MIN_TO_PASS;
    const flamingo = passed && parcels.some((p) => p.kind === 'flamingo' && p.delivered);
    const input = {
      passed,
      delivered: req.map((p) => p.condition),
      required: REQUIRED_COUNT,
      time: this.time,
      par: course.par,
      style: this.stunts.banked,
      flamingo,
    };
    return {
      attemptId: this.attemptId,
      contentVersion: CONTENT_VERSION,
      courseId: course.id,
      build: { ...this.build },
      assist: this.assist,
      seed: this.seed,
      passed,
      failReason: reachedBay ? (passed ? null : 'insufficient') : this.failReason,
      delivered,
      required: REQUIRED_COUNT,
      parcels,
      flamingo,
      time: this.time,
      style: this.stunts.banked,
      flips: this.stunts.flipsBanked,
      route: this.route,
      recovered: this.cargo.items.some((i) => i.recoveredOnce && i.state === 'delivered'),
      score: scoreRun(input),
      stamps: stampsFor(input),
    };
  }

  get failElapsed() {
    return this.failTimer;
  }

  dispose() {
    this.eventQueue.free();
    this.world.free();
  }
}
