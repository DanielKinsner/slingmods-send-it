import { initPhysics } from '../src/sim/physics';
import { Run } from '../src/game/run';
import { COURSES } from '../src/data/courses';
import { DEFAULT_BUILD } from '../src/data/vehicles';
const R = await initPhysics();
const course = COURSES.find((c) => c.id === (process.argv[2] ?? 'pier'))!;
const run = new Run(R, course, { ...DEFAULT_BUILD, vehicle: 'spyder' });
run.step({ throttle: 0, brake: 0, pitch: 0 });
for (const x of (process.argv[3] ?? '70,72,74,74.5,75,76,77').split(',').map(Number)) {
  const hits: string[] = [];
  run.world.intersectionsWithRay(new R.Ray({ x, y: 12 }, { x: 0, y: -1 }), 30, true, (h) => {
    const c = h.collider;
    if (!c.parent()) hits.push(`y=${(12 - h.timeOfImpact).toFixed(2)} h${c.handle}`);
    return true;
  });
  console.log('x', x, hits.join(' | '));
}
