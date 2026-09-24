import type { CourseSpec } from '../../sim/types';
import { Path, box, slab } from './build';

// PIER PRESSURE — boardwalk rhythm, concession-roof hops, and one low awning
// that has opinions about tall stacks.

const RAMP_X = 52;
const RAMP_Y = 2.2;
// Sensible stacks top out ~2.2–2.36 m; Express Regret stacks ~2.5 m. Choose.
const AWNING = { x0: 139, x1: 152, y0: 2.45, y1: 2.75 };
const TRENCH = { x0: 174, x1: 196, y: -1.6 };
const RAMP2_X = 250;
const DOCK = { x0: 334, x1: 358, y: -1.5 };
const BAY = { x0: 378, x1: 386 };
const SHED = BAY.x1 + 6;

const deck = new Path(-40, 0)
  .line(40)
  .kicker(RAMP_X, RAMP_Y) // SNACK DELIVERY RAMP
  .ease(RAMP_X + 7, 0)
  .line(158)
  .bump(5, 0.45) // boardwalk rollers: land each one
  .line(164)
  .bump(5, 0.45)
  .line(TRENCH.x0)
  .ease(TRENCH.x0 + 8, TRENCH.y) // repair trench: drive through or jump it
  .line(TRENCH.x1 - 8)
  .ease(TRENCH.x1, 0)
  .line(236)
  .kicker(RAMP2_X, 2.4) // SEAGULL FEEDING PLATFORM
  .ease(RAMP2_X + 8, 0)
  .line(312)
  .bump(5, 0.5)
  .line(318)
  .bump(5, 0.5)
  .line(324)
  .bump(5, 0.5)
  .line(DOCK.x0)
  .ease(DOCK.x0 + 8, DOCK.y) // low-tide floating dock
  .line(DOCK.x1 - 8)
  .ease(DOCK.x1, 0)
  .line(SHED)
  .done();

const roofA = new Path(59, 3.0).landing(61.5, 3.4).line(72).kicker(76, 3.9).done();
const roofB = new Path(83, 3.5).landing(85.5, 3.8).line(96).kicker(100, 4.2).done();
const roofC = new Path(107, 3.8).landing(109.5, 4.1).line(123).kicker(128, 4.7).done();
const roofD = new Path(258, 3.2).landing(260.5, 3.6).line(274).kicker(278, 4.0).done();
const roofE = new Path(285, 3.6).landing(287.5, 3.9).line(300).kicker(304, 4.3).done();

export const PIER: CourseSpec = {
  id: 'pier',
  name: 'Pier Pressure',
  district: 'Coast',
  destination: 'Pier Maintenance Shed',
  note: 'Gate code: broken. Gate: also broken.',
  order: 1,
  theme: 'pier',
  roads: [{ id: 'deck', points: deck, surface: 'wood', baseY: -1.4 }],
  solids: [
    slab('stand-a', roofA, 0.4, 'roof', 'roof'),
    slab('stand-b', roofB, 0.4, 'roof', 'roof'),
    slab('stand-c', roofC, 0.4, 'roof', 'roof'),
    slab('stand-d', roofD, 0.4, 'roof', 'roof'),
    slab('stand-e', roofE, 0.4, 'roof', 'roof'),
    box('awning', AWNING, 'wood', 'deck'),
    box('shed', { x0: SHED, x1: SHED + 16, y0: -1, y1: 6 }, 'wood', 'wall'),
    box('pier-gate', { x0: -52, x1: -40, y0: -1, y1: 6 }, 'wood', 'wall'),
  ],
  water: [{ x0: -60, x1: SHED + 40, y0: -12, y1: -3.1 }],
  killY: -10,
  bounds: { x0: -45, x1: SHED + 4 },
  start: [-6, 0],
  delivery: { x0: BAY.x0, x1: BAY.x1, y0: -1, y1: 3.5 },
  zones: [
    { id: 'p-throttle', kind: 'prompt', lesson: 'throttle', x0: -12, x1: 12, y0: -2, y1: 6, text: 'HOLD  W / ↑  TO SEND IT' },
    { id: 'p-pitch', kind: 'prompt', lesson: 'pitch', x0: 24, x1: 46, y0: -2, y1: 8, text: 'IN THE AIR:  A = NOSE UP   D = NOSE DOWN' },
    { id: 'p-awning', kind: 'prompt', x0: 128, x1: 138, y0: -1, y1: 2, text: 'LOW AWNING — TALL STACKS, TAKE THE ROOFS' },
    { id: 'p-brake', kind: 'prompt', lesson: 'brake', x0: 166, x1: 176, y0: -2, y1: 4, text: 'S / ↓  TO BRAKE — TRENCH AHEAD' },
    { id: 'p-dock', kind: 'prompt', x0: 326, x1: 336, y0: -2, y1: 4, text: 'LOW TIDE ACCESS — GO SLOW OR GO OVER' },
    { id: 'p-deliver', kind: 'prompt', lesson: 'deliver', x0: 356, x1: BAY.x0, y0: -3, y1: 5, text: 'BRAKE TO DELIVER — STOP AT THE SHED' },
    { id: 'shortcut', kind: 'shortcut', x0: 59, x1: 128, y0: 3.0, y1: 14 },
    { id: 'shortcut-2', kind: 'shortcut', x0: 258, x1: 304, y0: 3.0, y1: 14 },
    { id: 'roof-hop', kind: 'stunt', x0: 83, x1: 128, y0: 3.2, y1: 14, takeoff: [70, 101], bonus: 150, label: 'ROOF HOP' },
    { id: 'awning-jump', kind: 'stunt', x0: AWNING.x1, x1: 176, y0: -1, y1: 12, takeoff: [120, 130], bonus: 450, event: 'clean_shortcut_landing', label: 'OVER THE AWNING' },
    { id: 'trench-jump', kind: 'stunt', x0: TRENCH.x1 - 1, x1: 230, y0: -1, y1: 10, takeoff: [TRENCH.x0 - 4, TRENCH.x0 + 3], bonus: 300, label: 'TRENCH CLEARED' },
    { id: 'arcade-hop', kind: 'stunt', x0: 285, x1: 312, y0: 3.2, y1: 14, takeoff: [270, 280], bonus: 200, label: 'ARCADE HOP' },
    { id: 'dock-jump', kind: 'stunt', x0: DOCK.x1 - 1, x1: BAY.x1, y0: -1, y1: 10, takeoff: [DOCK.x0 - 4, DOCK.x0 + 3], bonus: 350, event: 'clean_shortcut_landing', label: 'TIDE IGNORED' },
  ],
  par: { fast: 30, express: 40, slow: 80 },
  attract: [-2, 0],
  decor: [
    { kind: 'clouds', x: -250, variant: 14 },
    { kind: 'hills', x: -150, z: -420, variant: 7 },
    { kind: 'skyline', x: -150, w: 700, z: -230, variant: 8 },
    { kind: 'ferris', x: 150, z: -40, s: 13, y: -1.2 },
    { kind: 'pier', x: -80, w: 90, z: -60, y: -1.4 },
    { kind: 'pier', x: 250, w: 120, z: -70, y: -1.4 },
    { kind: 'boat', x: 40, z: -120 },
    { kind: 'boat', x: 200, z: -170, color: '#d8242b' },
    { kind: 'boat', x: 330, z: -140, color: '#2aa7c9' },
    { kind: 'gull', x: 30, y: 12, z: -18 },
    { kind: 'gull', x: 160, y: 14, z: -24 },
    { kind: 'gull', x: 100, y: 10, z: -12 },
    { kind: 'gull', x: 250, y: 11, z: -14 },
    { kind: 'gull', x: 262, y: 13, z: -20 },
    { kind: 'gull', x: 340, y: 12, z: -16 },
    { kind: 'pilings', x: -40, w: SHED + 40 },
    { kind: 'rail', x: -40, w: SHED + 36 },

    { kind: 'sign', x: -2, w: 3.6, h: 1.4, y: 1.8, color: 'red', text: 'PIER PRESSURE', small: 'Est. before building codes' },
    { kind: 'lamp', x: 6 },
    { kind: 'sign', x: 18, w: 2.4, h: 1.1, y: 1.4, color: 'white', text: 'NO LOITERING' },
    { kind: 'gull', x: 18, y: 3.05, z: -4.3, variant: 1 },
    { kind: 'lifebuoy', x: 26 },
    { kind: 'bench', x: 32 },
    { kind: 'sign', x: 38, w: 3.2, h: 1.6, y: 1.4, color: 'yellow', text: 'SNACK DELIVERY|RAMP', small: 'Snacks optional. Ramp mandatory.' },

    { kind: 'stand', x: 59, w: 17, y: 3.0, text: 'CHURROS', variant: 0 },
    { kind: 'stand', x: 83, w: 17, y: 3.5, text: 'BAIT & BOTH', variant: 1 },
    { kind: 'stand', x: 107, w: 21, y: 3.8, text: 'LEMONADE', variant: 2 },
    { kind: 'lamp', x: 80 },
    { kind: 'lamp', x: 104 },
    { kind: 'lifebuoy', x: 131 },

    { kind: 'awning', x: AWNING.x0, w: AWNING.x1 - AWNING.x0, y: AWNING.y0 },
    { kind: 'sign', x: 134, w: 2.8, h: 1.3, y: 0.6, color: 'yellow', text: 'LOW CLEARANCE', small: 'Your stack: probably taller.' },
    { kind: 'bench', x: 158 },
    { kind: 'lamp', x: 168 },
    { kind: 'sign', x: 172, w: 3.0, h: 1.4, y: 1.4, color: 'red', text: 'PIER UNDER REPAIR', small: 'Jump responsibly (not a thing)' },
    { kind: 'cones', x: 174, variant: 2 },
    { kind: 'cones', x: 192, variant: 2 },
    { kind: 'fishing', x: 198 },
    { kind: 'lifebuoy', x: 206 },
    { kind: 'sign', x: 214, w: 3.2, h: 1.5, y: 1.4, color: 'blue', text: 'ARCADE →', small: 'Prizes: emotional' },
    { kind: 'lamp', x: 222 },
    { kind: 'sign', x: 238, w: 3.6, h: 1.7, y: 1.4, color: 'white', text: 'SEAGULL FEEDING|PLATFORM', small: 'Do not feed the gulls. They will feed themselves.' },
    { kind: 'gull', x: 245, y: 2.95, z: -4.1, variant: 1 },
    { kind: 'stand', x: 258, w: 20, y: 3.2, text: 'ARCADE', variant: 1 },
    { kind: 'stand', x: 285, w: 19, y: 3.6, text: 'FUNNEL CAKE', variant: 0 },
    { kind: 'lamp', x: 282 },
    { kind: 'bench', x: 308 },
    { kind: 'sign', x: 328, w: 3.2, h: 1.5, y: 1.4, color: 'blue', text: 'LOW TIDE ACCESS', small: 'Tide schedule: vibes' },
    { kind: 'lifebuoy', x: 334 },
    { kind: 'fishing', x: 360 },
    { kind: 'sign', x: 368, w: 3.2, h: 1.5, y: 1.4, color: 'white', text: 'RECEIVING HOURS:|EVENTUALLY' },
    { kind: 'bay', x: BAY.x0, w: BAY.x1 - BAY.x0 },
    { kind: 'person', x: SHED - 3.5, z: -3.6, color: '#2a7a6a', variant: 1 },
    { kind: 'handtruck', x: SHED - 1.5, z: -3.2 },
    { kind: 'gate', x: BAY.x0 - 3 },
    { kind: 'door', x: SHED },
  ],
};
