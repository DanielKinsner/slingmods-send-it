import { describe, expect, it } from 'vitest';
import { SCORE, creditsFor, scoreRun, stampsFor, timeBonus } from '../src/game/scoring';
import { StuntTracker, type StuntFrame } from '../src/game/stunts';
import { Commentary } from '../src/game/commentary';
import { SaveStore, applyResult, defaultSave, sanitize } from '../src/game/save';
import { CARGO, PRESETS, PRESET_ORDER, layoutCargo } from '../src/data/cargo';
import { VEHICLES, VEHICLE_ORDER, applyBuild, DEFAULT_BUILD } from '../src/data/vehicles';
import { COURSES } from '../src/data/courses';
import { validateCourse } from '../src/data/courses/build';
import type { RunResult } from '../src/game/run';

const par = { fast: 30, express: 40, slow: 80 };
const base = { required: 5, par, style: 0, flamingo: false };

describe('scoring', () => {
  it('caps a perfect standard run at 10,000 before the optional flamingo', () => {
    const s = scoreRun({ ...base, passed: true, delivered: [1, 1, 1, 1, 1], time: 10, style: 99999 });
    expect(s.total).toBe(10000);
    expect(scoreRun({ ...base, passed: true, delivered: [1, 1, 1, 1, 1], time: 10, style: 99999, flamingo: true }).total).toBe(10000 + SCORE.flamingo);
  });
  it('never gives a negative time bonus and interpolates between thresholds', () => {
    expect(timeBonus(999, par)).toBe(0);
    expect(timeBonus(0, par)).toBe(SCORE.timeMax);
    expect(timeBonus(55, par)).toBe(750);
  });
  it('scores a failed run as zero (stunts do not rescue a failed delivery)', () => {
    expect(scoreRun({ ...base, passed: false, delivered: [], time: 20, style: 5000 }).total).toBe(0);
  });
  it('awards stamps independently and honestly', () => {
    const three = stampsFor({ ...base, passed: true, delivered: [1, 1, 1], time: 35 });
    expect(three).toEqual({ delivered: true, allAccounted: false, express: true });
    const dented = stampsFor({ ...base, passed: true, delivered: [0.5, 0.5, 0.5, 0.5, 0.5], time: 90 });
    expect(dented).toEqual({ delivered: true, allAccounted: false, express: false });
    const fail = stampsFor({ ...base, passed: false, delivered: [], time: 10 });
    expect(fail.express).toBe(false);
  });
  it('never creates debt and keeps failed-run credit tiny', () => {
    expect(creditsFor({ passed: false, total: 0, firstClear: false, newStamps: 0, style: 100000 })).toBeLessThanOrEqual(40);
    expect(creditsFor({ passed: false, total: 0, firstClear: false, newStamps: 0, style: 0 })).toBe(0);
  });
});

function frame(p: Partial<StuntFrame>): StuntFrame {
  return { x: 0, y: 0, angle: 0, airborne: false, rear: true, front: true, forwardSpeed: 10, failed: false, ...p };
}

describe('stunts', () => {
  const dt = 1 / 120;
  function jump(t: StuntTracker, x0: number, dist: number, secs: number, spin = 0) {
    const n = Math.round(secs / dt);
    for (let i = 0; i < n; i++) {
      const k = i / n;
      let a = spin * k;
      while (a > Math.PI) a -= Math.PI * 2;
      t.step(frame({ x: x0 + dist * k, y: 2, angle: a, airborne: true, rear: false, front: false }), dt);
    }
    for (let i = 0; i < 70; i++) t.step(frame({ x: x0 + dist + i * 0.1 }), dt);
  }
  it('banks airtime only after a stable landing', () => {
    const t = new StuntTracker();
    jump(t, 0, 12, 1.0);
    expect(t.banked).toBeGreaterThan(0);
    expect(t.pending).toHaveLength(0);
  });
  it('gives nothing for a stationary hop (no forward progress)', () => {
    const t = new StuntTracker();
    jump(t, 50, 0.5, 1.0);
    expect(t.banked).toBe(0);
  });
  it('does not pay twice for the same jump (reverse-and-repeat farming)', () => {
    const t = new StuntTracker();
    jump(t, 100, 12, 1.0);
    const once = t.banked;
    jump(t, 101, 12, 1.0);
    expect(t.banked).toBe(once);
  });
  it('counts a real flip from unwrapped angle, not a wrap', () => {
    const t = new StuntTracker();
    jump(t, 200, 20, 1.6, Math.PI * 2);
    expect(t.flipsBanked).toBe(1);
    const t2 = new StuntTracker();
    jump(t2, 300, 20, 1.6, Math.PI * 0.6);
    expect(t2.flipsBanked).toBe(0);
  });
  it('drops pending points on failure but keeps banked ones', () => {
    const t = new StuntTracker();
    jump(t, 0, 12, 1.0);
    const banked = t.banked;
    for (let i = 0; i < 120; i++) t.step(frame({ x: 400 + i * 0.1, y: 3, airborne: true, rear: false, front: false }), dt);
    t.step(frame({ x: 420 }), dt); // touchdown -> pending
    const ev = t.step(frame({ x: 420, failed: true }), dt);
    expect(ev.some((e) => e.type === 'dropped')).toBe(true);
    expect(t.banked).toBe(banked);
  });
});

describe('commentary', () => {
  const lines = [
    { id: 'a', event: 'x', text: 'A' },
    { id: 'b', event: 'x', text: 'B' },
  ];
  it('respects the cooldown and never talks over itself', () => {
    const c = new Commentary(lines, { cooldown: 12, noRepeatRuns: 4 }, () => 0);
    expect(c.pick('x', 0, 'sunset')).not.toBeNull();
    expect(c.pick('x', 5, 'sunset')).toBeNull();
    expect(c.pick('x', 13, 'sunset')).not.toBeNull();
  });
  it('avoids repeating a line within recent runs', () => {
    const c = new Commentary(lines, { cooldown: 0, noRepeatRuns: 4 }, () => 0);
    const first = c.pick('x', 0, 's')!.id;
    c.newRun();
    expect(c.pick('x', 1, 's')!.id).not.toBe(first);
  });
  it('says nothing for events that did not happen', () => {
    expect(new Commentary(lines).pick('nope', 0, 's')).toBeNull();
  });
});

function result(over: Partial<RunResult> = {}): RunResult {
  const input = { passed: true, delivered: [1, 1, 1, 1, 1], required: 5, time: 35, par, style: 300, flamingo: false };
  return {
    attemptId: 'att-1',
    contentVersion: 't',
    courseId: 'sunset',
    build: { ...DEFAULT_BUILD },
    assist: false,
    seed: 1,
    passed: true,
    failReason: null,
    delivered: 5,
    required: 5,
    parcels: [],
    flamingo: false,
    time: 35,
    style: 300,
    flips: 0,
    route: 'safe',
    recovered: false,
    score: scoreRun(input),
    stamps: stampsFor(input),
    ...over,
  };
}

describe('save + rewards', () => {
  it('applies a result exactly once (reopening results cannot mint credit)', () => {
    const s = defaultSave();
    const r1 = applyResult(s, result());
    const credits = s.credits;
    const r2 = applyResult(s, result());
    expect(r1.credits).toBeGreaterThan(0);
    expect(r2.alreadyProcessed).toBe(true);
    expect(s.credits).toBe(credits);
  });
  it('records first clear, stamps and personal best', () => {
    const s = defaultSave();
    const r = applyResult(s, result());
    expect(r.firstClear).toBe(true);
    expect(s.records.sunset.stamps.delivered).toBe(true);
    const better = applyResult(s, result({ attemptId: 'att-2', score: { ...result().score, total: 99999 } }));
    expect(better.personalBest).toBe(true);
  });
  it('a failed run grants no delivery record', () => {
    const s = defaultSave();
    applyResult(s, result({ attemptId: 'f', passed: false, failReason: 'pool', delivered: 0, score: scoreRun({ ...base, passed: false, delivered: [], time: 9 }) }));
    expect(s.records.sunset.passes).toBe(0);
    expect(s.records.sunset.bestScore).toBe(0);
    expect(s.achievements).toContain('pool_policy');
  });
  it('sanitizes garbage and unknown versions without throwing', () => {
    expect(sanitize(null).credits).toBe(0);
    expect(sanitize({ version: 99, credits: 5 }).credits).toBe(0);
    const s = sanitize({ version: 1, credits: -50, settings: { master: 7 }, owned: ['a', 3] });
    expect(s.credits).toBe(0);
    expect(s.settings.master).toBe(1);
    expect(s.owned).toEqual(['a']);
  });
  it('falls back to a temporary session when storage throws', () => {
    const broken = {
      getItem() {
        throw new Error('blocked');
      },
      setItem() {
        throw new Error('blocked');
      },
    };
    const store = new SaveStore(broken);
    expect(store.persistent).toBe(false);
    expect(() => store.save()).not.toThrow();
  });
});

describe('content', () => {
  it('every course validates', () => {
    for (const c of COURSES) expect(validateCourse(c), c.id).toEqual([]);
  });
  it('cargo layouts never overlap the rack lip or headboard, for every vehicle and preset', () => {
    for (const v of VEHICLE_ORDER) {
      const spec = applyBuild({ ...DEFAULT_BUILD, vehicle: v });
      for (const p of PRESET_ORDER) {
        const slots = layoutCargo(spec, PRESETS[p]);
        expect(slots).toHaveLength(CARGO.length);
        for (const s of slots) {
          const c = CARGO.find((x) => x.id === s.cargoId)!;
          expect(s.x - c.w / 2, `${v}/${p}/${c.id} vs lip`).toBeGreaterThanOrEqual(spec.deck.x0);
          expect(s.x + c.w / 2, `${v}/${p}/${c.id} vs headboard`).toBeLessThanOrEqual(spec.deck.x1);
        }
      }
    }
  });
  it('garage equipment actually changes the simulation', () => {
    const std = applyBuild(DEFAULT_BUILD);
    expect(applyBuild({ ...DEFAULT_BUILD, suspension: 'comfort' }).suspension.damping).not.toBe(std.suspension.damping);
    expect(applyBuild({ ...DEFAULT_BUILD, tires: 'stunt' }).grip).toBeLessThan(std.grip);
    expect(applyBuild({ ...DEFAULT_BUILD, restraint: 'secure' }).chassisMass).toBeGreaterThan(std.chassisMass);
    expect(VEHICLES.slingshot.rear.radius).toBeCloseTo(0.3455);
  });
});
