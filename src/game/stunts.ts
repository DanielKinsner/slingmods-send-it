import type { CourseZone } from '../sim/types';

export interface StuntFrame {
  x: number;
  y: number;
  /** Wrapped chassis angle (radians, nose up positive). */
  angle: number;
  airborne: boolean;
  rear: boolean;
  front: boolean;
  forwardSpeed: number;
  failed: boolean;
}

export interface StuntAward {
  id: string;
  label: string;
  points: number;
}

export type StuntEvent =
  | { type: 'pending'; awards: StuntAward[]; total: number }
  | { type: 'banked'; awards: StuntAward[]; total: number; flips: number }
  | { type: 'dropped'; total: number };

const TAU = Math.PI * 2;
const AIR_DEBOUNCE = 0.12;
const LAND_CONFIRM = 0.4;
const MIN_AIRTIME = 0.55;
const MIN_PROGRESS = 4;
const JUMP_REUSE_RADIUS = 5;
const WHEELIE_MIN = 1.0;
const WHEELIE_CAP = 600;

function wrap(a: number) {
  while (a > Math.PI) a -= TAU;
  while (a < -Math.PI) a += TAU;
  return a;
}

/**
 * Recognises airtime, flips, clean landings, wheelies and authored stunt
 * zones. Awards accumulate while airborne and bank only after a stable
 * landing; a failure drops whatever is pending.
 */
export class StuntTracker {
  banked = 0;
  flipsBanked = 0;
  pending: StuntAward[] = [];
  private unwrapped = 0;
  private prevAngle: number | null = null;
  private airTime = 0;
  private liftoff: { x: number; y: number; a: number } | null = null;
  private air: { x0: number; a0: number; time: number; maxY: number; y0: number } | null = null;
  private groundedFor = 0;
  private landing = false;
  private cleanTouch = false;
  private usedJumps: number[] = [];
  private wheelieTime = 0;
  private wheeliePts = 0;
  private usedZones = new Set<string>();
  private dead = false;

  constructor(private zones: CourseZone[] = []) {}

  get pendingTotal() {
    return this.pending.reduce((s, a) => s + a.points, 0);
  }

  step(f: StuntFrame, dt: number): StuntEvent[] {
    const out: StuntEvent[] = [];
    if (this.dead) return out;
    if (f.failed) {
      this.dead = true;
      if (this.pending.length) {
        out.push({ type: 'dropped', total: this.pendingTotal });
        this.pending = [];
      }
      return out;
    }

    if (this.prevAngle !== null) this.unwrapped += wrap(f.angle - this.prevAngle);
    this.prevAngle = f.angle;

    if (f.airborne) {
      if (this.airTime === 0) this.liftoff = { x: f.x, y: f.y, a: this.unwrapped };
      this.airTime += dt;
      this.groundedFor = 0;
      if (!this.air && this.airTime >= AIR_DEBOUNCE) {
        const l = this.liftoff ?? { x: f.x, y: f.y, a: this.unwrapped };
        this.air = { x0: l.x, y0: l.y, a0: l.a, time: this.airTime, maxY: f.y };
      }
      if (this.air) {
        this.air.time = this.airTime;
        this.air.maxY = Math.max(this.air.maxY, f.y);
      }
      this.endWheelie(out, false);
    } else {
      this.airTime = 0;
      this.groundedFor += dt;
      if (this.air) {
        this.onTouchdown(f, out);
        this.air = null;
      }
      this.trackWheelie(f, dt, out);
      if (this.landing && this.groundedFor >= LAND_CONFIRM) {
        if (Math.abs(f.angle) < 1.2) this.bank(out);
        else {
          out.push({ type: 'dropped', total: this.pendingTotal });
          this.pending = [];
          this.landing = false;
        }
      }
    }
    return out;
  }

  private onTouchdown(f: StuntFrame, out: StuntEvent[]) {
    const air = this.air!;
    const progress = f.x - air.x0;
    const awards: StuntAward[] = [];
    const reused = this.usedJumps.some((x) => Math.abs(x - air.x0) < JUMP_REUSE_RADIUS);
    if (!reused && air.time >= MIN_AIRTIME && progress >= MIN_PROGRESS) {
      this.usedJumps.push(air.x0);
      const t = air.time;
      awards.push({ id: 'air', label: `AIR ${t.toFixed(1)}s`, points: Math.round(60 * t * t + 110 * t) });

      const turns = (this.unwrapped - air.a0) / TAU;
      const n = Math.floor(Math.abs(turns) + 0.1);
      if (n > 0) {
        const name = turns > 0 ? 'BACKFLIP' : 'FRONTFLIP';
        awards.push({ id: 'flip', label: n > 1 ? `${n}x ${name}` : name, points: 650 * n + (turns < 0 ? 150 * n : 0) });
      }
      for (const z of this.zones) {
        if (z.kind !== 'stunt' || !z.takeoff || this.usedZones.has(z.id)) continue;
        const inTake = air.x0 >= z.takeoff[0] && air.x0 <= z.takeoff[1];
        const inLand = f.x >= z.x0 && f.x <= z.x1 && f.y >= z.y0 && f.y <= z.y1;
        if (inTake && inLand) {
          this.usedZones.add(z.id);
          awards.push({ id: z.id, label: z.label ?? z.id.toUpperCase(), points: z.bonus ?? 0 });
        }
      }
      this.cleanTouch = Math.abs(f.angle) < 0.3;
    }
    if (awards.length) {
      this.pending.push(...awards);
      out.push({ type: 'pending', awards, total: this.pendingTotal });
    }
    if (this.pending.length) this.landing = true;
  }

  private trackWheelie(f: StuntFrame, dt: number, out: StuntEvent[]) {
    const wheelie = f.rear && !f.front && f.forwardSpeed > 3 && f.angle > 0.12 && f.angle < 1.3;
    if (wheelie) {
      this.wheelieTime += dt;
    } else {
      this.endWheelie(out, f.front);
    }
  }

  private endWheelie(out: StuntEvent[], frontDown: boolean) {
    const t = this.wheelieTime;
    this.wheelieTime = 0;
    if (!frontDown || t < WHEELIE_MIN || this.wheeliePts >= WHEELIE_CAP) return;
    const pts = Math.min(Math.round(90 * t), WHEELIE_CAP - this.wheeliePts);
    if (pts <= 0) return;
    this.wheeliePts += pts;
    const a: StuntAward = { id: 'wheelie', label: `WHEELIE ${t.toFixed(1)}s`, points: pts };
    this.pending.push(a);
    this.landing = true;
    this.groundedFor = 0;
    out.push({ type: 'pending', awards: [a], total: this.pendingTotal });
  }

  private bank(out: StuntEvent[]) {
    const awards = this.pending;
    if (this.cleanTouch && awards.some((a) => a.id === 'air')) {
      awards.push({ id: 'clean', label: 'CLEAN LANDING', points: 150 });
    }
    const total = awards.reduce((s, a) => s + a.points, 0);
    const flips = awards.filter((a) => a.id === 'flip').reduce((s, a) => s + (parseInt(a.label) || 1), 0);
    this.banked += total;
    this.flipsBanked += flips;
    out.push({ type: 'banked', awards, total, flips });
    this.pending = [];
    this.landing = false;
    this.cleanTouch = false;
  }
}
