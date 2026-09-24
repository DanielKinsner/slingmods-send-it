// Air tricks: deliberately outrageous. They are visual/pose tricks layered on
// top of the real physics (flips stay physical). Start one in the air; if you
// touch down before it finishes, you bail.

export type TrickKind = 'superman' | 'barrel' | 'helicopter' | 'standup';
export type TrickDir = 'none' | 'up' | 'down' | 'side';

export interface TrickDef {
  id: TrickKind;
  label: string;
  duration: number; // seconds of air needed to complete
  points: number;
}

export const TRICKS: Record<TrickKind, TrickDef> = {
  superman: { id: 'superman', label: 'HEADSTAND DELIVERY', duration: 0.8, points: 300 },
  barrel: { id: 'barrel', label: 'THIS SIDE UP (NOT)', duration: 0.75, points: 400 },
  helicopter: { id: 'helicopter', label: 'RETURN TO SENDER', duration: 0.9, points: 450 },
  standup: { id: 'standup', label: 'SURF’S UP (NO LIABILITY)', duration: 0.6, points: 250 },
};

/** Which trick a press means, from the direction held at the time. */
export function trickFor(dir: TrickDir): TrickKind {
  return dir === 'up' ? 'barrel' : dir === 'down' ? 'helicopter' : dir === 'side' ? 'standup' : 'superman';
}

export interface ActiveTrick {
  kind: TrickKind;
  t: number; // 0..1 progress
}

export type TrickEvent =
  | { type: 'trick-start'; kind: TrickKind }
  | { type: 'trick-done'; kind: TrickKind; label: string; points: number; chain: number }
  | { type: 'bail'; kind: TrickKind };

/** Minimum clearance before a trick can start: no trick-spam on curb hops. */
export const TRICK_MIN_HEIGHT = 0.9;

export class TrickState {
  active: ActiveTrick | null = null;
  /** Tricks completed during the current airborne stretch (for combos). */
  chain: TrickKind[] = [];
  /** Tricks completed this run per kind (diminishing returns vs farming). */
  counts: Record<TrickKind, number> = { superman: 0, barrel: 0, helicopter: 0, standup: 0 };

  request(kind: TrickKind, airborne: boolean, height: number): TrickEvent[] {
    if (!airborne || this.active || height < TRICK_MIN_HEIGHT) return [];
    this.active = { kind, t: 0 };
    return [{ type: 'trick-start', kind }];
  }

  /** Advance one step. `touchdown` is true on the step the vehicle lands. */
  step(dt: number, airborne: boolean, touchdown: boolean): TrickEvent[] {
    const out: TrickEvent[] = [];
    const a = this.active;
    if (a) {
      if (touchdown || !airborne) {
        out.push({ type: 'bail', kind: a.kind });
        this.active = null;
        this.chain = [];
        return out;
      }
      a.t += dt / TRICKS[a.kind].duration;
      if (a.t >= 1) {
        this.active = null;
        this.chain.push(a.kind);
        const n = this.counts[a.kind]++;
        // Repeating the same trick all run pays less each time.
        const scale = Math.max(0.25, 1 - n * 0.15);
        const def = TRICKS[a.kind];
        out.push({ type: 'trick-done', kind: a.kind, label: def.label, points: Math.round(def.points * scale), chain: this.chain.length });
      }
    }
    if (touchdown) this.chain = [];
    return out;
  }

  reset() {
    this.active = null;
    this.chain = [];
  }
}

/** Visual transform for the current trick: roll/yaw in radians, rider pose 0..1. */
export function trickVisual(a: ActiveTrick | null): { roll: number; yaw: number; pose: TrickKind | null; poseT: number } {
  if (!a) return { roll: 0, yaw: 0, pose: null, poseT: 0 };
  const e = a.t < 0.5 ? 2 * a.t * a.t : 1 - Math.pow(-2 * a.t + 2, 2) / 2;
  const hump = Math.sin(Math.PI * Math.min(1, a.t));
  switch (a.kind) {
    case 'barrel':
      return { roll: e * Math.PI * 2, yaw: 0, pose: null, poseT: 0 };
    case 'helicopter':
      return { roll: 0, yaw: e * Math.PI * 2, pose: null, poseT: 0 };
    default:
      return { roll: 0, yaw: 0, pose: a.kind, poseT: hump };
  }
}
