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
  decor: [
    // Sky and far coast.
    { kind: 'clouds', x: -250, variant: 14 },
    { kind: 'hills', x: 250, z: -640, variant: 5 },
    { kind: 'pier', x: 120, w: 170, z: -150, y: -1.6 },
    { kind: 'ferris', x: 235, z: -160, s: 15, y: -1 },
    { kind: 'boat', x: 60, z: -230 },
    { kind: 'boat', x: 330, z: -280, color: '#f3c01c' },
    { kind: 'gull', x: 70, y: 15, z: -26 },
    { kind: 'gull', x: 215, y: 17, z: -34 },

    { kind: 'townfill', x: 10, w: 320, variant: 11 },
    { kind: 'frontfill', x: -30, w: 340, variant: 5 },

    // A: the warehouse.
    { kind: 'warehouse', x: -46, w: 54 },
    { kind: 'crates', x: 1.5, z: -3.6, variant: 5 },
    { kind: 'crates', x: 4, z: -3.8, variant: 3 },
    { kind: 'sign', x: 9.5, w: 2.4, h: 1.3, y: 1.1, color: 'white', text: 'DAYS SINCE LAST|INCIDENT: 0', small: 'Updated hourly' },
    { kind: 'sign', x: 17, w: 3.2, h: 1.1, y: 1.4, color: 'dark', text: 'WE PACK IT.|YOU EXPLAIN IT.' },
    { kind: 'person', x: -1, z: -3.6, color: '#d8242b', variant: 1, rot: 0.6 },
    { kind: 'palm', x: 12, z: -9, h: 9, variant: 1 },
    { kind: 'light', x: 22 },

    // B: the sensible neighbourhood.
    { kind: 'apartment', x: 20, w: 16, h: 14, z: -24, color: '#f0dcc4' },
    { kind: 'shop', x: 36, w: 13, h: 6.5, variant: 0, text: 'WRENCH & RELAX' },
    { kind: 'sign', x: 44, w: 3.2, h: 1.3, y: 1.3, color: 'yellow', text: 'DIP AHEAD', small: 'The boxes have opinions' },
    { kind: 'palm', x: 49, z: -8.5, h: 8, variant: -1 },
    { kind: 'shop', x: 58, w: 14, h: 7.5, variant: 1, text: 'SPIN CYCLE LAUNDRY' },
    { kind: 'apartment', x: 60, w: 18, h: 17, z: -30, color: '#e3eef0' },
    { kind: 'light', x: 66 },
    { kind: 'shop', x: 79, w: 12, h: 6, variant: 3, text: 'TACO DEPOT' },
    { kind: 'palm', x: 86, z: -9, h: 9.5, variant: 1 },
    { kind: 'apartment', x: 96, w: 14, h: 12, z: -24, color: '#f6d6c8' },
    { kind: 'shop', x: 98, w: 11, h: 6.5, variant: 2, text: 'SURF & TURF' },

    // C: the choice.
    { kind: 'sign', x: 104, w: 3.4, h: 1.9, y: 1.4, color: 'yellow', text: 'SHORTCUT*', small: '*Measured emotionally.' },
    { kind: 'gull', x: 104, y: 3.35, z: -4.3, variant: 1 },
    { kind: 'sign', x: 116, w: 3.0, h: 1.6, y: 1.9, color: 'white', text: '~AUTHORIZED|SHORTCUT', small: 'Authorization pending.' },
    { kind: 'cones', x: 111, variant: 3 },
    { kind: 'light', x: 124 },
    { kind: 'under', x: 136.5, w: 42, y: 4.2, text: 'PARCEL MART', color: '#e9c7a0' },
    { kind: 'sign', x: 141.5, w: 2.6, h: 1.2, y: 0.7, color: 'blue', text: 'SERVICE LANE|5 MPH', small: 'The boxes enforce it.' },
    { kind: 'sign', x: 172, w: 2.6, h: 1.2, y: 0.7, base: 4.35, color: 'red', text: 'EDGE OF ROOF', small: 'Suggestions welcome' },

    // D: the Sunset Motel pool terrace.
    { kind: 'motel', x: 176, w: 60, z: -10.5, base: 0 },
    { kind: 'under', x: 178.6, w: 44, y: 3.4, color: '#f5d7b8', variant: 1 },
    { kind: 'pooldeck', x: 178.6, w: 44, y: 4.2 },
    { kind: 'floatie', x: 185.5, y: 4.0, z: -1.2, s: 1 },
    { kind: 'railing', x: 193, w: 29, y: 4.2, z: 2.75, color: '#1f8fa0' },
    { kind: 'sign', x: 199, w: 2.8, h: 1.3, y: 1.1, base: 4.25, z: -4.2, color: 'white', text: 'NO DIVING.', small: 'This includes vehicles.' },
    { kind: 'palm', x: 181, z: -7.2, h: 7, variant: 1, base: 4.2 },
    { kind: 'palm', x: 214, z: -7.2, h: 8, variant: -1, base: 4.2 },
    { kind: 'person', x: 208, base: 4.25, z: -5.4, color: '#2aa7c9', rot: 0.9 },

    // E: the final mile.
    { kind: 'cones', x: 234, variant: 2, z: -4.2 },
    { kind: 'palm', x: 244, z: -8, h: 9, variant: 1 },
    { kind: 'sign', x: 262, w: 3.4, h: 1.6, y: 1.3, color: 'green', text: 'DELIVERIES →|REAR ENTRANCE', small: 'Please do not use the pool again.' },
    { kind: 'light', x: 270 },
    { kind: 'bay', x: 286, w: 15 },
    { kind: 'handtruck', x: 300, z: -3.2 },
    { kind: 'person', x: 296.5, z: -3.6, color: '#1f7f8f' },
    { kind: 'door', x: 304 },
    { kind: 'palm', x: 290, z: -9, h: 8.5, variant: -1 },
    { kind: 'apartment', x: 260, w: 20, h: 15, z: -32, color: '#f2e2cc' },
  ],
};
