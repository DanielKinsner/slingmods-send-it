import type { CourseSpec, DecorItem } from '../../sim/types';
import { Path, box, slab } from './build';

// SUNSET EXPRESS — warehouse to the Sunset Motel.
// Lower road: sensible. Rooftop + pool jump: express, if you commit.
// v2: + construction zone (x 100–210) and beachfront (after the motel).

const C = 100; // length of the construction zone inserted after the neighbourhood
const B = 50; // length of the beachfront inserted before the bay

const LIP_X = 128 + C;
const LIP_Y = 3.2;
const ROOF_Y = 4.2;
const ROOF_X0 = 136.5 + C;
const ROOF_END = 178 + C;
const POOL_LIP_Y = 5.1;
const TERRACE_Y = 4.2;
const POOL_X0 = 179.5 + C;
const POOL_X1 = 191.5 + C;
const TERRACE_END = 222 + C;
const BAY_Y = -4.5;
const BAY_X0 = 286 + C + B;

const road = new Path(-40, 0)
  .line(20)
  .bump(2.5, 0.16) // loading-dock threshold: the stack settles, nobody dies
  .line(46)
  .ease(53, -1.1)
  .ease(61, 0)
  .line(70)
  .ease(81, 1.7)
  .ease(92, 0)
  .line(106)
  // --- Construction zone -------------------------------------------------
  .ease(111, -1.6) // THE DIG SITE: we lost something down here
  .line(119)
  .ease(124, 0)
  .line(132)
  .bump(0.7, 0.07) // rumble strips: the boxes will tell you about them
  .line(134)
  .bump(0.7, 0.07)
  .line(136)
  .bump(0.7, 0.07)
  .line(138)
  .bump(0.7, 0.07)
  .line(140)
  .bump(0.7, 0.07)
  .line(152)
  .bump(9, 1.3) // DETOUR (sand pile)
  .line(175)
  .ease(185, 1.2)
  .ease(195, 0)
  .line(110 + C)
  // --- The choice ------------------------------------------------------------
  .kicker(LIP_X, LIP_Y) // SHORTCUT* — measured emotionally
  .ease(LIP_X + 9, 0)
  .line(148 + C)
  .bump(1.6, 0.22) // SERVICE LANE: 5 MPH. The boxes enforce it.
  .line(158 + C)
  .bump(1.6, 0.22)
  .line(203 + C)
  .bump(1.6, 0.22)
  .line(211 + C)
  .bump(1.6, 0.22)
  .line(TERRACE_END + 6)
  .landing(TERRACE_END + 40, BAY_Y) // the final mile: a long landing slope
  // --- Beachfront ------------------------------------------------------------
  .line(TERRACE_END + 52)
  .bump(7, 0.75) // dune: buggy not included
  .line(TERRACE_END + 74)
  .bump(3, 0.2)
  .line(BAY_X0 + 18)
  .done();

const roofTop = new Path(ROOF_X0, ROOF_Y - 0.8)
  .landing(ROOF_X0 + 4.5, ROOF_Y)
  .line(170 + C)
  .kicker(ROOF_END, POOL_LIP_Y)
  .done();

const terraceTop = new Path(POOL_X1, TERRACE_Y - 0.35).landing(POOL_X1 + 1.2, TERRACE_Y).line(TERRACE_END - 7).line(TERRACE_END, TERRACE_Y - 0.6).done();

/** Map a v1 x-coordinate (pre-insert) into v2 space. */
const at = (x: number) => (x < 100 ? x : x < 240 ? x + C : x + C + B);
const shifted = (items: DecorItem[]) => items.map((d) => ({ ...d, x: at(d.x) }));

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
    box('receiving', { x0: BAY_X0 + 18, x1: BAY_X0 + 32, y0: BAY_Y, y1: 3 }, 'concrete', 'wall'),
    box('warehouse-back', { x0: -52, x1: -40, y0: -1, y1: 8 }, 'concrete', 'wall'),
  ],
  water: [{ x0: POOL_X0, x1: POOL_X1, y0: 3.3, y1: 4.05 }],
  killY: -14,
  bounds: { x0: -45, x1: BAY_X0 + 34 },
  start: [-6, 0],
  delivery: { x0: BAY_X0, x1: BAY_X0 + 15, y0: BAY_Y - 1, y1: BAY_Y + 3.5 },
  zones: [
    { id: 'p-throttle', kind: 'prompt', lesson: 'throttle', x0: -12, x1: 16, y0: -2, y1: 6, text: 'HOLD  W / ↑  TO SEND IT' },
    { id: 'p-brake', kind: 'prompt', lesson: 'brake', x0: 38, x1: 52, y0: -3, y1: 6, text: 'S / ↓  TO BRAKE — WATCH THE STACK' },
    { id: 'p-dig', kind: 'prompt', x0: 96, x1: 104, y0: -3, y1: 6, text: 'DIG SITE AHEAD — THE BOXES REQUEST GENTLENESS' },
    { id: 'p-pitch', kind: 'prompt', lesson: 'pitch', x0: 142, x1: 152, y0: -2, y1: 8, text: 'IN THE AIR:  A = NOSE UP   D = NOSE DOWN' },
    { id: 'p-deliver', kind: 'prompt', lesson: 'deliver', x0: BAY_X0 - 28, x1: BAY_X0, y0: -8, y1: 4, text: 'BRAKE TO DELIVER — STOP IN THE BAY' },
    { id: 'shortcut', kind: 'shortcut', x0: ROOF_X0, x1: ROOF_END, y0: ROOF_Y - 0.4, y1: 14 },
    { id: 'detour-air', kind: 'stunt', x0: 162, x1: 200, y0: -3, y1: 12, takeoff: [152, 162], bonus: 200, label: 'DETOUR TAKEN' },
    {
      id: 'pool-jump',
      kind: 'stunt',
      x0: POOL_X1,
      x1: TERRACE_END + 30,
      y0: -6,
      y1: 14,
      takeoff: [168 + C, ROOF_END + 1],
      bonus: 500,
      event: 'clean_shortcut_landing',
      label: 'POOL CLEARED',
    },
    { id: 'roof-gap', kind: 'stunt', x0: ROOF_X0, x1: ROOF_END, y0: ROOF_Y - 0.5, y1: 14, takeoff: [LIP_X - 6, LIP_X + 1], bonus: 250, label: 'ROOF ACCESS' },
    { id: 'dune-air', kind: 'stunt', x0: TERRACE_END + 58, x1: BAY_X0, y0: -8, y1: 10, takeoff: [TERRACE_END + 52, TERRACE_END + 60], bonus: 150, label: 'DUNE BUGGY (UNLICENSED)' },
  ],
  par: { fast: 32, express: 42, slow: 85 },
  attract: [-2, 0],
  decor: [
    // Sky and far coast.
    { kind: 'clouds', x: -250, variant: 16 },
    { kind: 'hills', x: 350, z: -640, variant: 6 },
    { kind: 'pier', x: 220, w: 170, z: -150, y: -1.6 },
    { kind: 'ferris', x: 335, z: -160, s: 15, y: -1 },
    { kind: 'boat', x: 60, z: -230 },
    { kind: 'boat', x: 430, z: -280, color: '#f3c01c' },
    { kind: 'gull', x: 70, y: 15, z: -26 },
    { kind: 'gull', x: 315, y: 17, z: -34 },
    { kind: 'gull', x: 420, y: 13, z: -20 },

    { kind: 'townfill', x: 10, w: 470, variant: 11 },
    { kind: 'frontfill', x: -30, w: 500, variant: 5 },

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
    { kind: 'sign', x: 72, w: 2.8, h: 1.2, y: 1.3, color: 'white', text: 'SPEED LIMIT: YES', small: 'Enforced by physics' },
    { kind: 'palm', x: 86, z: -9, h: 9.5, variant: 1 },
    { kind: 'shop', x: 95, w: 9, h: 6.5, variant: 2, text: 'SURF & TURF' },

    // C0: the construction zone (new).
    { kind: 'sign', x: 101, w: 3.4, h: 1.7, y: 1.3, color: 'yellow', text: 'ROAD WORK AHEAD', small: 'So is regret.' },
    { kind: 'cones', x: 104, variant: 3 },
    { kind: 'excavator', x: 115, z: -7 },
    { kind: 'sign', x: 121, w: 3.4, h: 1.6, y: 1.3, color: 'white', text: 'DIG SITE', small: 'We lost something down here. Possibly a van.' },
    { kind: 'cones', x: 126, variant: 2 },
    { kind: 'sign', x: 131, w: 3.2, h: 1.4, y: 1.3, color: 'yellow', text: 'RUMBLE STRIPS', small: 'Your cargo will now speak.' },
    { kind: 'person', x: 136, z: -3.8, color: '#f26a1b', variant: 1, rot: 0.3 },
    { kind: 'sign', x: 147, w: 3.2, h: 1.6, y: 1.4, color: 'dark', text: 'DETOUR →', small: '“Detour” is a strong word.' },
    { kind: 'sandpile', x: 156.5, w: 12 },
    { kind: 'cones', x: 166, variant: 3 },
    { kind: 'sign', x: 176, w: 3.4, h: 1.5, y: 1.3, color: 'white', text: 'CONSTRUCTION ENDS', small: 'Consequences do not.' },
    { kind: 'light', x: 190 },
    { kind: 'shop', x: 200, w: 12, h: 6.5, variant: 4, text: 'PAWN & PRAWN' },

    ...shifted([
      // C: the choice.
      { kind: 'sign', x: 104, w: 3.4, h: 1.9, y: 1.4, color: 'yellow', text: 'SHORTCUT*', small: '*Measured emotionally.' },
      { kind: 'gull', x: 104, y: 3.35, z: -4.3, variant: 1 },
      { kind: 'sign', x: 116, w: 3.0, h: 1.6, y: 1.9, color: 'white', text: '~AUTHORIZED|SHORTCUT', small: 'Authorization pending.' },
      { kind: 'cones', x: 111, variant: 3 },
      { kind: 'light', x: 124 },
      { kind: 'under', x: 136.5, w: 42, y: 4.2, text: 'PARCEL MART', color: '#e9c7a0' },
      { kind: 'sign', x: 141.5, w: 2.6, h: 1.2, y: 0.7, color: 'blue', text: 'SERVICE LANE|5 MPH', small: 'The boxes enforce it.' },
      { kind: 'sign', x: 172, w: 2.6, h: 1.2, y: 0.7, base: 4.35, color: 'red', text: 'EDGE OF ROOF', small: 'Suggestions welcome' },
      { kind: 'sign', x: 156, w: 2.6, h: 1.1, y: 0.8, base: 4.35, color: 'white', text: 'ROOF ACCESS:|STAFF ONLY', small: 'You are not staff.' },

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
      { kind: 'cones', x: 234, variant: 2, z: -4.2 },
    ]),

    // E0: beachfront (new).
    { kind: 'sign', x: TERRACE_END + 44, w: 3.6, h: 1.6, y: 1.3, color: 'blue', text: 'PUBLIC BEACH', small: 'No deliveries. We mean it. (We don’t.)' },
    { kind: 'lifeguard', x: TERRACE_END + 56, z: -9 },
    { kind: 'umbrellas', x: TERRACE_END + 62, w: 20 },
    { kind: 'sign', x: TERRACE_END + 70, w: 2.8, h: 1.3, y: 1.3, color: 'yellow', text: 'SOFT SAND', small: 'Soft landing not implied.' },
    { kind: 'palm', x: TERRACE_END + 80, z: -8, h: 9, variant: 1 },

    ...shifted([
      // E: the final mile.
      { kind: 'sign', x: 262, w: 3.4, h: 1.6, y: 1.3, color: 'green', text: 'DELIVERIES →|REAR ENTRANCE', small: 'Please do not use the pool again.' },
      { kind: 'light', x: 270 },
      { kind: 'bay', x: 286, w: 15 },
      { kind: 'handtruck', x: 300, z: -3.2 },
      { kind: 'person', x: 296.5, z: -3.6, color: '#1f7f8f' },
      { kind: 'door', x: 304 },
      { kind: 'palm', x: 290, z: -9, h: 8.5, variant: -1 },
      { kind: 'apartment', x: 260, w: 20, h: 15, z: -32, color: '#f2e2cc' },
    ]),
  ],
};
