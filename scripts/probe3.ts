import { initPhysics } from '../src/sim/physics';
import { Run } from '../src/game/run';
import { botInput } from '../src/game/bot';
import { BOT_PLANS } from '../src/data/botPlans';
import { COURSES } from '../src/data/courses';
import { DEFAULT_BUILD } from '../src/data/vehicles';
const R = await initPhysics();
const course = COURSES.find((c) => c.id === 'pier')!;
const run = new Run(R, course, { ...DEFAULT_BUILD, vehicle: 'slingshot' });
const v = run.vehicle;
const name = new Map<number, string>();
name.set(v.hull.handle, 'hull');
name.set(v.head.handle, 'head');
v.deckColliders.forEach((c, i) => name.set(c.handle, ['deckplate', 'lip', 'headboard'][i]));
name.set(v.rear.collider.handle, 'rearWheel');
name.set(v.front.collider.handle, 'frontWheel');
run.cargo.items.forEach((it) => name.set(it.collider.handle, 'cargo-' + it.spec.id));
let k = 0;
run.world.forEachCollider((c) => {
  if (!name.has(c.handle)) name.set(c.handle, 'terrain#' + k++);
});
const n = (h: number) => name.get(h) ?? '?';
let lastVx = 0;
for (let i = 0; i < 120 * 9; i++) {
  run.step(botInput(run, BOT_PLANS.pier.shortcut));
  run.events.length = 0;
  const vx = v.chassis.linvel().x;
  if (run.simTime > 6.5 && lastVx - vx > 1.0) {
    const pairs: string[] = [];
    for (const c of [v.hull, v.head, ...v.deckColliders, v.rear.collider, v.front.collider])
      run.world.contactPairsWith(c, (o) => run.world.contactPair(c, o, (m) => { if (m.numContacts() > 0) pairs.push(`${n(c.handle)}~${n(o.handle)}(d=${m.contactDist(0).toFixed(3)})`); }));
    const w = v.wheelState();
    console.log(run.simTime.toFixed(3), 'dvx', (vx - lastVx).toFixed(2), 'pos', v.position.x.toFixed(2), v.position.y.toFixed(2), 'wheels', w.map((q) => `${q.x.toFixed(2)},${q.y.toFixed(2)}`).join(' '), pairs.join(' '));
  }
  lastVx = vx;
}
