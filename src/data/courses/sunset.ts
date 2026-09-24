import type { CourseSpec } from '../../sim/types';
import { Path, box, slab } from './build';

// SUNSET EXPRESS — warehouse to the Sunset Motel.
// Lower road: sensible. Rooftop + pool jump: express, if you commit.

const LIP_X = 128;
const LIP_Y = 3.2;
const ROOF_Y = 4.2;
const ROOF_X0 = 136.5;
const ROOF_END = 178;
const POOL_LIP_Y = 5.1;
const TERRACE_Y = 4.2;
const POOL_X0 = 179.5;
const POOL_X1 = 191.5;
const TERRACE_END = 222;
const BAY_Y = -4.5;

const road = new Path(-40, 0)
  .line(20)
  .bump(2.5, 0.16) // loading-dock threshold: the stack settles, nobody dies
  .line(46)
  .ease(53, -1.1)
  .ease(61, 0)
  .line(70)
  .ease(81, 1.7)
  .ease(92, 0)
  .line(110)
  .kicker(LIP_X, LIP_Y) // SHORTCUT* — measured emotionally
  .ease(LIP_X + 9, 0)
  .line(148)
  .bump(1.6, 0.22) // SERVICE LANE: 5 MPH. The boxes enforce it.
  .line(158)
  .bump(1.6, 0.22)
  .line(203)
  .bump(1.6, 0.22)
  .line(211)
  .bump(1.6, 0.22)
  .line(TERRACE_END + 6)
  .landing(TERRACE_END + 40, BAY_Y) // the final mile: a long landing slope
  .line(304)
  .done();

const roofTop = new Path(ROOF_X0, ROOF_Y - 0.8)
  .landing(ROOF_X0 + 4.5, ROOF_Y)
  .line(170)
  .kicker(ROOF_END, POOL_LIP_Y)
  .done();

const terraceTop = new Path(POOL_X1, TERRACE_Y - 0.35).landing(POOL_X1 + 1.2, TERRACE_Y).line(TERRACE_END - 7).line(TERRACE_END, TERRACE_Y - 0.6).done();

export const SUNSET: CourseSpec = {
  id: 'sunset',
  name: 'Sunset Express',
  district: 'Coast',
  destination: 'Sunset Motel',
  note: 'Rear entrance. Please do not use the pool again.',
  order: 0,
  theme: 'sunset',
  roads: [{ id: 'main', points: road, surface: 'asphalt', baseY: -9 }],
  solids: [
    slab('roof', roofTop, 0.45, 'roof', 'roof'),
    box('pool-coping', { x0: ROOF_END + 0.6, x1: POOL_X0, y0: 3.4, y1: TERRACE_Y }, 'tile', 'terrace'),
    box('pool-floor', { x0: POOL_X0, x1: POOL_X1, y0: 3.4, y1: 3.7 }, 'tile', 'terrace'),
    slab('terrace', terraceTop, 0.6, 'tile', 'terrace'),
    box('receiving', { x0: 304, x1: 318, y0: BAY_Y, y1: 3 }, 'concrete', 'wall'),
    box('warehouse-back', { x0: -52, x1: -40, y0: -1, y1: 8 }, 'concrete', 'wall'),
  ],
  water: [{ x0: POOL_X0, x1: POOL_X1, y0: 3.3, y1: 4.05 }],
  killY: -14,
  bounds: { x0: -45, x1: 320 },
  start: [-6, 0],
  delivery: { x0: 286, x1: 301, y0: BAY_Y - 1, y1: BAY_Y + 3.5 },
  zones: [
    { id: 'p-throttle', kind: 'prompt', lesson: 'throttle', x0: -12, x1: 16, y0: -2, y1: 6, text: 'HOLD  W / ↑  TO SEND IT' },
    { id: 'p-brake', kind: 'prompt', lesson: 'brake', x0: 38, x1: 52, y0: -3, y1: 6, text: 'S / ↓  TO BRAKE — WATCH THE STACK' },
    { id: 'p-pitch', kind: 'prompt', lesson: 'pitch', x0: 96, x1: 124, y0: -2, y1: 8, text: 'IN THE AIR:  A = NOSE UP   D = NOSE DOWN' },
    { id: 'p-deliver', kind: 'prompt', lesson: 'deliver', x0: 258, x1: 286, y0: -8, y1: 4, text: 'BRAKE TO DELIVER — STOP IN THE BAY' },
    { id: 'shortcut', kind: 'shortcut', x0: ROOF_X0, x1: ROOF_END, y0: ROOF_Y - 0.4, y1: 14 },
    {
      id: 'pool-jump',
      kind: 'stunt',
      x0: POOL_X1,
      x1: TERRACE_END + 30,
      y0: -6,
      y1: 14,
      takeoff: [168, ROOF_END + 1],
      bonus: 500,
      event: 'clean_shortcut_landing',
      label: 'POOL CLEARED',
    },
    {
      id: 'roof-gap',
      kind: 'stunt',
      x0: ROOF_X0,
      x1: ROOF_END,
      y0: ROOF_Y - 0.5,
      y1: 14,
      takeoff: [LIP_X - 6, LIP_X + 1],
      bonus: 250,
      label: 'ROOF ACCESS',
    },
  ],
  par: { fast: 22, express: 30, slow: 60 },
  attract: [-2, 0],
  decor: [],
};
