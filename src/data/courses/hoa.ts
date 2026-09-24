import type { CourseSpec } from '../../sim/types';
import { Path, box, slab } from './build';

// HOA NO — speed discipline through a very tidy neighbourhood. The shortcut
// is a row of hillside garage roofs; the safe way is the street in the valley.

const LIP = { x: 128, y: 2.2 };
const VALLEY = -4.2;
const POND = { x0: 172.5, x1: 176, y: 0.4 };
const PAD = { x0: 334, x1: 341 };
const WALL = PAD.x1 + 3;

let road = new Path(-40, 0).line(10);
// Driveway crests: every house has the same ramp-shaped driveway.
for (let i = 0; i < 6; i++) road = road.bump(4, 0.42).line(22 + i * 12);
road = road
  .line(112)
  .kicker(LIP.x, LIP.y) // "DRIVEWAY" (disputed)
  .ease(146, VALLEY)
  .line(226)
  .ease(246, 0)
  .line(262)
  .ease(276, 2.4) // BLIND CREST
  .ease(292, 0)
  .line(304)
  .bump(1.6, 0.2) // speed humps (appreciation zone)
  .line(312)
  .bump(1.6, 0.2)
  .line(320)
  .bump(1.6, 0.2)
  .line(WALL);

// Front edge set back so the valley road keeps ~3.5 m of headroom beneath it.
// A sloped nose so near-misses roll up or slide off instead of hanging.
const garageA = new Path(139.5, 1.0).landing(142.5, 1.8).line(148).kicker(152, 2.1).done();
const garageB = new Path(156, 1.2).landing(157.5, 1.4).line(172).done();
const garageC = new Path(176, 1.0).line(188).kicker(192, 1.3).done();
const garageD = new Path(196, 0.4).line(203).line(206, 0.2).done();

export const HOA: CourseSpec = {
  id: 'hoa',
  name: 'HOA No',
  district: 'Coast',
  destination: 'Driveway Workshop',
  note: 'Use the driveway. That sentence should have been sufficient.',
  order: 2,
  theme: 'suburb',
  roads: [{ id: 'street', points: road.done(), surface: 'asphalt', baseY: -10 }],
  solids: [
    slab('garage-a', garageA, 0.4, 'roof', 'roof'),
    slab('garage-b', garageB, 0.4, 'roof', 'roof'),
    slab('garage-c', garageC, 0.4, 'roof', 'roof'),
    slab('garage-d', garageD, 0.4, 'roof', 'roof'),
    box('koi-pond', { x0: POND.x0 - 0.5, x1: POND.x1 + 0.5, y0: POND.y - 0.6, y1: POND.y - 0.3 }, 'tile', 'terrace'),
    box('workshop', { x0: WALL, x1: WALL + 14, y0: -1, y1: 5 }, 'concrete', 'wall'),
    box('depot', { x0: -52, x1: -40, y0: -1, y1: 7 }, 'concrete', 'wall'),
  ],
  water: [{ x0: POND.x0, x1: POND.x1, y0: POND.y - 0.3, y1: POND.y + 0.2 }],
  killY: -14,
  bounds: { x0: -45, x1: WALL + 4 },
  start: [-6, 0],
  delivery: { x0: PAD.x0, x1: PAD.x1, y0: -1, y1: 3.5 },
  zones: [
    { id: 'p-throttle', kind: 'prompt', lesson: 'throttle', x0: -12, x1: 8, y0: -2, y1: 6, text: 'HOLD  W / ↑  TO SEND IT' },
    { id: 'p-humps', kind: 'prompt', x0: 8, x1: 16, y0: -2, y1: 6, text: 'DRIVEWAY CRESTS — SPEED IS A PERSONAL DECISION' },
    { id: 'p-brake', kind: 'prompt', lesson: 'brake', x0: 26, x1: 40, y0: -2, y1: 6, text: 'S / ↓  TO BRAKE — THE HOA IS WATCHING' },
    { id: 'p-pitch', kind: 'prompt', lesson: 'pitch', x0: 96, x1: 118, y0: -2, y1: 8, text: 'IN THE AIR:  A = NOSE UP   D = NOSE DOWN' },
    { id: 'p-crest', kind: 'prompt', x0: 254, x1: 262, y0: -2, y1: 6, text: 'BLIND CREST AHEAD — LAND IT, THEN BRAKE' },
    { id: 'p-deliver', kind: 'prompt', lesson: 'deliver', x0: 296, x1: PAD.x0, y0: -2, y1: 6, text: 'NARROW PAD — STOP ON THE DRIVEWAY, NOT IN THE WORKSHOP' },
    { id: 'shortcut', kind: 'shortcut', x0: 137, x1: 206, y0: 0, y1: 12 },
    { id: 'garage-access', kind: 'stunt', x0: 137, x1: 152, y0: 1.2, y1: 12, takeoff: [LIP.x - 6, LIP.x + 1], bonus: 300, label: 'GARAGE ACCESS' },
    { id: 'roof-run', kind: 'stunt', x0: 176, x1: 206, y0: 0, y1: 12, takeoff: [150, 173], bonus: 250, label: 'POND AVOIDED' },
    { id: 'garage-exit', kind: 'stunt', x0: 206, x1: 250, y0: -6, y1: 12, takeoff: [190, 207], bonus: 400, event: 'clean_shortcut_landing', label: 'VIOLATION #46' },
    { id: 'crest-air', kind: 'stunt', x0: 282, x1: 330, y0: -2, y1: 10, takeoff: [270, 282], bonus: 200, label: 'CREST AIR' },
  ],
  par: { fast: 30, express: 40, slow: 80 },
  attract: [-2, 0],
  decor: [
    { kind: 'clouds', x: -250, variant: 12 },
    { kind: 'hills', x: -200, z: -380, variant: 9 },
    { kind: 'townfill', x: -30, w: 390, variant: 23, text: 'suburb' },
    { kind: 'frontfill', x: -30, w: 390, variant: 9 },
    { kind: 'gull', x: 60, y: 16, z: -30 },

    // The depot.
    { kind: 'shop', x: -20, w: 30, h: 8, variant: 3, text: 'SLINGMODS SATELLITE DEPOT', z: -5 },
    { kind: 'crates', x: 2, z: -3.8, variant: 5 },
    { kind: 'sign', x: 6, w: 3.6, h: 1.6, y: 1.3, color: 'white', text: 'RESIDENTIAL SPEED|LIMIT: A REASONABLE ONE', small: 'They will not tell you what that is.' },

    // Driveway crests.
    { kind: 'hedge', x: 12, w: 7 },
    { kind: 'lawnflamingo', x: 20, variant: 7 },
    { kind: 'sign', x: 21, w: 2.6, h: 1.3, y: 0.8, color: 'white', text: 'MAX 2 FLAMINGOS', small: 'PER YARD. — The Committee' },
    { kind: 'hedge', x: 34, w: 8 },
    { kind: 'person', x: 44, z: -4, color: '#5a6a3a', variant: 1, rot: 0.5 },
    { kind: 'sign', x: 47, w: 3.4, h: 1.5, y: 1.2, color: 'green', text: 'PLEASE RESPECT|THE HEDGES', small: 'They have a committee.' },
    { kind: 'fence', x: 52, w: 14 },
    { kind: 'trampoline', x: 70, z: -10 },
    { kind: 'hedge', x: 74, w: 6 },
    { kind: 'lawnflamingo', x: 84, variant: 2 },
    { kind: 'sign', x: 92, w: 3.2, h: 1.4, y: 1.3, color: 'white', text: 'HOA OFFICE', small: 'Complaints: yes' },

    // The disputed driveway + garage roofs.
    { kind: 'sign', x: 108, w: 3.6, h: 1.7, y: 1.3, color: 'yellow', text: 'HOA NOTICE:|RAMPS ARE NOT DRIVEWAYS', small: 'This one is a driveway. Probably.' },
    { kind: 'cones', x: 113, variant: 2 },
    { kind: 'under', x: 139.5, w: 12.5, y: 1.8, color: '#f4efe3', variant: 1 },
    { kind: 'under', x: 156, w: 16, y: 1.4, color: '#e8d6bf', variant: 1 },
    { kind: 'under', x: 176, w: 16, y: 1.0, color: '#cfe0e8', variant: 1 },
    { kind: 'under', x: 196, w: 10, y: 0.4, color: '#f1dfe3', variant: 1 },
    { kind: 'sign', x: 142, w: 2.8, h: 1.2, y: 0.8, base: 1.85, color: 'red', text: 'GARAGE ROOFS', small: 'Are not a road. Violation #1 of 46.' },
    { kind: 'koipond', x: POND.x0, w: POND.x1 - POND.x0, y: POND.y },
    { kind: 'sign', x: 174.2, w: 2.4, h: 1.1, y: 0.6, base: POND.y + 0.2, z: -3.5, color: 'white', text: 'KOI POND', small: 'Koi are not parcels.' },
    { kind: 'sign', x: 150, w: 3.0, h: 1.3, y: 0.5, base: VALLEY + 0.15, color: 'blue', text: 'VALLEY ROAD', small: 'The sensible way. Nobody takes it.' },
    { kind: 'lawnflamingo', x: 214, variant: 3 },
    { kind: 'person', x: 222, z: -4, color: '#8a4a8a', variant: 1, rot: 0.3 },
    { kind: 'sign', x: 232, w: 3.4, h: 1.4, y: 1.3, color: 'white', text: 'NO OVERNIGHT PARKING.|NO DAYTIME PARKING.', small: 'No parking.' },

    // Blind crest + humps + workshop.
    { kind: 'sign', x: 256, w: 3.2, h: 1.5, y: 1.3, color: 'yellow', text: 'BLIND CREST', small: 'Children at play (they are retired)' },
    { kind: 'hedge', x: 264, w: 10 },
    { kind: 'trampoline', x: 280, z: -11 },
    { kind: 'sign', x: 300, w: 3.4, h: 1.5, y: 1.3, color: 'yellow', text: 'SPEED HUMP|APPRECIATION ZONE', small: 'Please appreciate each one.' },
    { kind: 'fence', x: 306, w: 20 },
    { kind: 'lawnflamingo', x: 318, variant: 2 },
    { kind: 'sign', x: 328, w: 3.6, h: 1.6, y: 1.3, color: 'green', text: 'WORKSHOP DELIVERIES', small: 'Use the driveway. That sentence should have been sufficient.' },
    { kind: 'bay', x: PAD.x0, w: PAD.x1 - PAD.x0 },
    { kind: 'person', x: WALL - 2, z: -3.6, color: '#1f5fae', variant: 1 },
    { kind: 'handtruck', x: WALL - 0.8, z: -3.2 },
    { kind: 'door', x: WALL },
    { kind: 'house', x: WALL + 8, w: 14, z: -3, variant: 4 },
  ],
};
