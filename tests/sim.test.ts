// Integration tests through the real physics, driven only by gameplay inputs.
import { beforeAll, describe, expect, it } from 'vitest';
import { initPhysics, type R } from '../src/sim/physics';
import { Run } from '../src/game/run';
import { botInput } from '../src/game/bot';
import { BOT_PLANS } from '../src/data/botPlans';
import { courseById } from '../src/data/courses';
import { DEFAULT_BUILD } from '../src/data/vehicles';
import type { Build, InputState } from '../src/sim/types';

let rapier: R;
beforeAll(async () => {
  rapier = await initPhysics();
});

function drive(course: string, plan: string, build: Partial<Build> = {}, maxSeconds = 150) {
  const run = new Run(rapier, courseById(course), { ...DEFAULT_BUILD, ...build });
  for (let i = 0; i < maxSeconds * 120; i++) {
    run.step(botInput(run, BOT_PLANS[course][plan]));
    run.events.length = 0;
    if (run.phase === 'finished' || (run.phase === 'failed' && run.failElapsed > 0.2)) break;
  }
  return run;
}

describe('full runs (bot uses gameplay controls only)', () => {
  it('Sunset Express: the safe route delivers', () => {
    const run = drive('sunset', 'safe');
    run.dispose();
    expect(run.result?.passed).toBe(true);
    expect(run.result?.route).toBe('safe');
    expect(run.result!.delivered).toBeGreaterThanOrEqual(3);
  });
  it('Sunset Express: the rooftop shortcut is faster', () => {
    const safe = drive('sunset', 'safe');
    const fast = drive('sunset', 'shortcut');
    safe.dispose();
    fast.dispose();
    expect(fast.result?.route).toBe('shortcut');
    expect(fast.result!.time).toBeLessThan(safe.result!.time - 8);
  });
  it('Sunset Express: a timid rooftop run ends in the pool, not a pass', () => {
    const run = drive('sunset', 'pool');
    run.dispose();
    expect(run.result?.passed).toBe(false);
    expect(run.result?.failReason).toBe('pool');
    expect(run.result?.score.total).toBe(0);
  });
  it.each(['pier', 'hoa'])('%s: the safe route delivers', (c) => {
    const run = drive(c, 'safe');
    run.dispose();
    expect(run.result?.passed).toBe(true);
  });
});

describe('cargo rules', () => {
  it('only parcels that actually arrive are counted', () => {
    const run = new Run(rapier, courseById('sunset'), DEFAULT_BUILD);
    // Launch the carton off the back, far away, like a real loss.
    const lost = run.cargo.items.find((i) => i.spec.id === 'c1')!;
    lost.strapped = false;
    lost.body.setTranslation({ x: -30, y: 0.5 }, true);
    for (let i = 0; i < 120 * 150 && run.phase !== 'finished'; i++) {
      run.step(botInput(run, BOT_PLANS.sunset.safe));
      run.events.length = 0;
    }
    const r = run.result!;
    run.dispose();
    expect(r.parcels.find((p) => p.id === 'c1')!.delivered).toBe(false);
    expect(r.delivered).toBeLessThanOrEqual(4);
  });
  it('recovery restores the same parcel, same condition, no duplicate', () => {
    const run = new Run(rapier, courseById('sunset'), DEFAULT_BUILD);
    const stop: InputState = { throttle: 0, brake: 1, pitch: 0 };
    for (let i = 0; i < 60; i++) run.step(stop);
    const it = run.cargo.items.find((i) => i.spec.id === 'c3')!;
    it.condition = 0.7;
    it.strapped = false;
    // Drop it on the road just behind the rack.
    const v = run.vehicle.position;
    it.body.setTranslation({ x: v.x - 2.8, y: v.y + 0.2 }, true);
    it.body.setLinvel({ x: 0, y: 0 }, true);
    let recovered = false;
    for (let i = 0; i < 120 * 4 && !recovered; i++) {
      run.phase = 'running';
      run.step(stop);
      recovered = run.events.some((e) => e.type === 'cargo' && e.ev.type === 'recovered' && e.ev.id === 'c3');
      run.events.length = 0;
    }
    expect(recovered).toBe(true);
    expect(it.condition).toBe(0.7);
    expect(it.state).toBe('onboard');
    expect(run.cargo.items.filter((i) => i.spec.id === 'c3')).toHaveLength(1);
    run.dispose();
  });
  it('the clock does not start until the player uses the throttle', () => {
    const run = new Run(rapier, courseById('sunset'), DEFAULT_BUILD);
    for (let i = 0; i < 240; i++) run.step({ throttle: 0, brake: 0, pitch: 0 });
    expect(run.time).toBe(0);
    run.step({ throttle: 1, brake: 0, pitch: 0 });
    expect(run.phase).toBe('running');
    run.dispose();
  });
  it('twenty retries do not accumulate physics bodies', () => {
    const counts: number[] = [];
    for (let k = 0; k < 20; k++) {
      const run = new Run(rapier, courseById('sunset'), DEFAULT_BUILD);
      for (let i = 0; i < 30; i++) run.step({ throttle: 1, brake: 0, pitch: 0 });
      counts.push(run.world.bodies.len());
      run.dispose();
    }
    expect(new Set(counts).size).toBe(1);
  });
});
