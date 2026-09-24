import { initPhysics } from '../src/sim/physics';
import { Run } from '../src/game/run';
import { botInput } from '../src/game/bot';
import { BOT_PLANS } from '../src/data/botPlans';
import { COURSES } from '../src/data/courses';
import { DEFAULT_BUILD } from '../src/data/vehicles';
const R = await initPhysics();
const course = COURSES.find((c) => c.id === 'pier')!;
const run = new Run(R, course, { ...DEFAULT_BUILD, vehicle: 'spyder' });
for (let i = 0; i < 120 * 8; i++) {
  const inp = botInput(run, BOT_PLANS.pier.shortcut);
  run.step(inp);
  run.events.length = 0;
  const t = run.simTime;
  if (t > 7.25 && t < 7.55 && i % 3 === 0) {
    const v = run.vehicle;
    const lv = v.chassis.linvel();
    const touching: string[] = [];
    run.world.contactPairsWith(v.hull, (o) => touching.push('hull-' + o.handle));
    for (const [n, c] of v.deckColliders.entries()) run.world.contactPairsWith(c, (o) => touching.push(`deck${n}-` + o.handle));
    run.world.contactPairsWith(v.head, (o) => touching.push('head-' + o.handle));
    console.log(t.toFixed(3), 'x', v.position.x.toFixed(2), 'y', v.position.y.toFixed(2), 'vx', lv.x.toFixed(2), 'vy', lv.y.toFixed(2), 'in', JSON.stringify(inp), 'rw', v.contacts.rear, 'fw', v.contacts.front, touching.join(','));
  }
}
