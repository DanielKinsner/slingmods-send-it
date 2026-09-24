import { beforeAll, describe, expect, it } from 'vitest';
import { TRICKS, TrickState, trickFor, trickVisual } from '../src/game/tricks';
import { StuntTracker } from '../src/game/stunts';
import { initPhysics, type R } from '../src/sim/physics';
import { Run, type GameEvent } from '../src/game/run';
import { courseById } from '../src/data/courses';
import { DEFAULT_BUILD } from '../src/data/vehicles';

const dt = 1 / 120;

describe('trick state', () => {
  it('maps held direction to a trick', () => {
    expect(trickFor('up')).toBe('barrel');
    expect(trickFor('down')).toBe('helicopter');
    expect(trickFor('side')).toBe('standup');
    expect(trickFor('none')).toBe('superman');
  });
  it('completes a trick given enough air and awards it once', () => {
    const t = new TrickState();
    expect(t.request('barrel', true, 3)).toHaveLength(1);
    const done = [];
    for (let i = 0; i < 200; i++) done.push(...t.step(dt, true, false));
    const d = done.filter((e) => e.type === 'trick-done');
    expect(d).toHaveLength(1);
    expect(d[0]).toMatchObject({ kind: 'barrel', points: TRICKS.barrel.points, chain: 1 });
  });
  it('bails when landing mid-trick', () => {
    const t = new TrickState();
    t.request('helicopter', true, 3);
    for (let i = 0; i < 20; i++) t.step(dt, true, false);
    const ev = t.step(dt, false, true);
    expect(ev.map((e) => e.type)).toEqual(['bail']);
    expect(t.active).toBeNull();
  });
  it('refuses tricks on the ground or on tiny hops, and one at a time', () => {
    const t = new TrickState();
    expect(t.request('barrel', false, 5)).toHaveLength(0);
    expect(t.request('barrel', true, 0.3)).toHaveLength(0);
    expect(t.request('barrel', true, 3)).toHaveLength(1);
    expect(t.request('superman', true, 3)).toHaveLength(0);
  });
  it('pays less for spamming the same trick', () => {
    const t = new TrickState();
    const pts: number[] = [];
    for (let k = 0; k < 4; k++) {
      t.request('superman', true, 3);
      for (let i = 0; i < 200; i++) for (const e of t.step(dt, true, false)) if (e.type === 'trick-done') pts.push(e.points);
    }
    expect(pts[0]).toBeGreaterThan(pts[3]);
    expect(pts[3]).toBeGreaterThan(0);
  });
  it('visuals complete a full rotation', () => {
    expect(trickVisual({ kind: 'barrel', t: 1 }).roll).toBeCloseTo(Math.PI * 2);
    expect(trickVisual({ kind: 'helicopter', t: 1 }).yaw).toBeCloseTo(Math.PI * 2);
    expect(trickVisual(null).roll).toBe(0);
  });
});

describe('stunt tracker with tricks', () => {
  it('bail drops pending trick points, combos pay extra when banked', () => {
    const s = new StuntTracker();
    s.addAirAward({ id: 'trick:barrel', label: 'X', points: 400 });
    expect(s.bail()[0]).toMatchObject({ type: 'dropped', total: 400 });
    expect(s.banked).toBe(0);
    s.addAirAward({ id: 'trick:barrel', label: 'X', points: 400 });
    s.addAirAward({ id: 'trick:superman', label: 'Y', points: 300 });
    let banked = 0;
    for (let i = 0; i < 60; i++) {
      for (const e of s.step({ x: i, y: 0, angle: 0, airborne: false, rear: true, front: true, forwardSpeed: 8, failed: false }, dt)) {
        if (e.type === 'banked') banked = e.total;
      }
    }
    expect(banked).toBeGreaterThan(700); // 400 + 300 + combo bonus
    expect(s.banked).toBe(banked);
  });
});

describe('springboard + trick in the real physics', () => {
  let rapier: R;
  beforeAll(async () => {
    rapier = await initPhysics();
  });
  it('launches over the first springboard and lands a barrel roll', () => {
    const run = new Run(rapier, courseById('sunset'), DEFAULT_BUILD);
    const events: GameEvent[] = [];
    let requested = false;
    for (let i = 0; i < 120 * 12; i++) {
      run.step({ throttle: run.vehicle.forwardSpeed < 9 ? 1 : 0, brake: 0, pitch: 0 });
      events.push(...run.events);
      run.events.length = 0;
      if (run.boosted && !requested && run.heightAboveGround() > 1.5) {
        run.requestTrick('up');
        requested = true;
      }
    }
    run.dispose();
    expect(events.some((e) => e.type === 'launch')).toBe(true);
    expect(events.some((e) => e.type === 'trick-done' && e.kind === 'barrel')).toBe(true);
    expect(events.some((e) => e.type === 'bail')).toBe(false);
    const banked = events.filter((e) => e.type === 'stunt-banked');
    expect(banked.some((e) => e.type === 'stunt-banked' && e.awards.some((a) => a.id === 'trick:barrel'))).toBe(true);
    expect(run.cargo.counts().onboard).toBe(5);
  });
});
