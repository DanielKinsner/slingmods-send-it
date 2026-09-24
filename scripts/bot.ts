// Headless playtest: drives a course with gameplay inputs and reports.
// Usage: npx vite-node scripts/bot.ts -- [course] [vehicle] [plan] [preset]
import { initPhysics } from '../src/sim/physics';
import { Run } from '../src/game/run';
import { botInput, type BotPlan } from '../src/game/bot';
import { COURSES } from '../src/data/courses';
import { BOT_PLANS } from '../src/data/botPlans';
import { DEFAULT_BUILD } from '../src/data/vehicles';
import type { PresetId, VehicleId } from '../src/sim/types';

const all = process.argv.slice(2).filter((a) => a !== '--');
const args = all.filter((a) => !a.startsWith('-'));
const courseId = args[0] ?? 'sunset';
const vehicle = (args[1] ?? 'slingshot') as VehicleId;
const planId = args[2] ?? 'safe';
const preset = (args[3] ?? 'sensible') as PresetId;
const verbose = all.includes('-v');

const R = await initPhysics();
const course = COURSES.find((c) => c.id === courseId)!;
const plan: BotPlan = BOT_PLANS[courseId][planId];
const run = new Run(R, course, { ...DEFAULT_BUILD, vehicle, preset });
let lastLog = -1;
const t0 = performance.now();
for (let i = 0; i < 120 * 150; i++) {
  const input = botInput(run, plan);
  run.step(input);
  for (const e of run.events) {
    if (e.type === 'cargo' && e.ev.type === 'strain') continue;
    if (e.type === 'cargo' && e.ev.type === 'impact' && !verbose) continue;
    if (e.type === 'surface') continue;
    const tag = e.type === 'cargo' ? `cargo:${e.ev.type}:${e.ev.id}${e.ev.strength ? '=' + e.ev.strength.toFixed(1) : ''}@${e.ev.x.toFixed(1)},${e.ev.y.toFixed(1)}` : e.type;
    const extra =
      e.type === 'stunt-banked' || e.type === 'stunt-pending'
        ? ' ' + e.awards.map((a) => `${a.label}=${a.points}`).join(',')
        : e.type === 'landing'
          ? ` jolt=${e.jolt.toFixed(2)}`
          : e.type === 'fail'
            ? ` ${e.reason}`
            : '';
    if (e.type !== 'dispatch' && e.type !== 'prompt') {
      const p = run.vehicle.position;
      console.log(`${run.simTime.toFixed(2)}s x=${p.x.toFixed(1)} ${tag}${extra}`);
    }
  }
  run.events.length = 0;
  const sec = Math.floor(run.simTime * (verbose ? 4 : 1));
  if (sec !== lastLog && sec % (verbose ? 1 : 2) === 0) {
    lastLog = sec;
    const p = run.vehicle.position;
    const c = run.cargo.counts();
    console.log(
      `  t=${run.simTime.toFixed(2)} x=${p.x.toFixed(1)} y=${p.y.toFixed(2)} v=${run.vehicle.forwardSpeed.toFixed(1)} a=${((run.vehicle.angle * 180) / Math.PI).toFixed(0)} air=${run.vehicle.airborne ? 1 : 0} on=${c.onboard} loose=${c.loose} lost=${c.lost} ${run.phase}`,
    );
  }
  if (run.phase === 'finished' || (run.phase === 'failed' && run.failElapsed > 0.5)) break;
}
const ms = performance.now() - t0;
const r = run.result;
console.log('\nRESULT', r ? { passed: r.passed, fail: r.failReason, delivered: r.delivered, time: +r.time.toFixed(2), style: r.style, route: r.route, total: r.score.total, stamps: r.stamps, cond: r.parcels.map((p) => `${p.id}:${p.condition.toFixed(2)}:${p.state}`).join(' ') } : 'none (timeout)', `sim ${ms.toFixed(0)}ms`);
run.dispose();
