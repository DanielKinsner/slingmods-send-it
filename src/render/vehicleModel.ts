import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { VehicleSpec } from '../sim/types';
import { M, mesh } from './materials';

// Stylised, toy-scale three-wheelers built from side profiles. Chassis-local
// frame matches the simulation: +x forward, +y up, +z toward the camera.

type P = [number, number];

function profile(points: P[], depth: number, bevel = 0.04, curveSegs = 3) {
  const s = new THREE.Shape();
  s.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) s.lineTo(points[i][0], points[i][1]);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, {
    depth: depth - bevel * 2,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: curveSegs,
    curveSegments: 12,
  });
  g.translate(0, 0, -(depth - bevel * 2) / 2);
  g.computeVertexNormals();
  return g;
}

/** Smooth closed profile through control points (Catmull-Rom). */
function smoothProfile(points: P[], depth: number, bevel = 0.05) {
  const curve = new THREE.CatmullRomCurve3(points.map(([x, y]) => new THREE.Vector3(x, y, 0)), true, 'catmullrom', 0.2);
  const pts = curve.getPoints(points.length * 6).map((v) => [v.x, v.y] as P);
  return profile(pts, depth, bevel, 4);
}

function rbox(w: number, h: number, d: number, r = 0.03) {
  return new RoundedBoxGeometry(w, h, d, 3, r);
}

function cyl(r: number, len: number, seg = 16) {
  const g = new THREE.CylinderGeometry(r, r, len, seg);
  return g;
}

/** A rod between two points. */
function rod(a: THREE.Vector3, b: THREE.Vector3, r: number, mat: THREE.Material) {
  const len = a.distanceTo(b);
  const m = mesh(cyl(r, len, 10), mat);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  return m;
}

function v(x: number, y: number, z = 0) {
  return new THREE.Vector3(x, y, z);
}

export interface WheelVisual {
  group: THREE.Group; // positioned at hub
  spin: THREE.Group; // rotates about z
  baseX: number;
  baseY: number;
  z: number;
}

function wheel(radius: number, width: number, rimColor: string, accent: string): { group: THREE.Group; spin: THREE.Group } {
  const group = new THREE.Group();
  const spin = new THREE.Group();
  group.add(spin);
  const tireGeo = new THREE.CylinderGeometry(radius, radius, width, 28, 1);
  tireGeo.rotateX(Math.PI / 2);
  spin.add(mesh(tireGeo, M.rubber()));
  // Sidewall bulge / tread band.
  const tread = new THREE.TorusGeometry(radius - width * 0.18, width * 0.2, 8, 28);
  for (const s of [-1, 1]) {
    const t = mesh(tread, M.rubber());
    t.position.z = (s * width) / 2 - s * width * 0.05;
    spin.add(t);
  }
  const rimGeo = new THREE.CylinderGeometry(radius * 0.62, radius * 0.62, width * 1.02, 24);
  rimGeo.rotateX(Math.PI / 2);
  spin.add(mesh(rimGeo, M.metal(rimColor)));
  // Spokes (visible so rotation reads).
  for (let i = 0; i < 5; i++) {
    const sp = mesh(new THREE.BoxGeometry(radius * 1.1, radius * 0.13, width * 1.08), M.satin(accent));
    sp.rotation.z = (i / 5) * Math.PI;
    spin.add(sp);
  }
  const hub = mesh(cyl(radius * 0.18, width * 1.12, 12).rotateX(Math.PI / 2), M.metal('#d8d8dc'));
  spin.add(hub);
  return { group, spin };
}

export interface RiderRig {
  root: THREE.Group;
  torso: THREE.Group;
  head: THREE.Group;
}

function rider(spec: VehicleSpec): RiderRig {
  const root = new THREE.Group();
  const jacket = M.satin('#26282e');
  const pants = M.satin('#33363d');
  const glove = M.matte('#141416');
  const helmetMat = M.paint('#f4f3ef');
  const stripe = M.paint('#d8242b');
  const torso = new THREE.Group();
  const head = new THREE.Group();
  const seated = spec.rider === 'seated';

  const hip = seated ? v(-0.3, 0.22) : v(-0.22, 0.52);
  const shoulder = seated ? v(-0.36, 0.7) : v(-0.02, 0.98);
  const hand = seated ? v(0.2, 0.52) : v(0.42, 0.82);
  const headPos = v(spec.head.x, spec.head.y);
  torso.position.copy(hip);
  root.add(torso);

  // Torso block.
  const tl = shoulder.clone().sub(hip);
  const chest = mesh(rbox(0.3, tl.length() + 0.1, 0.42, 0.1), jacket);
  chest.position.copy(tl.clone().multiplyScalar(0.5));
  chest.rotation.z = Math.atan2(-tl.x, tl.y);
  torso.add(chest);
  // Accent panel on the jacket.
  const panel = mesh(rbox(0.06, tl.length() * 0.7, 0.44, 0.02), M.satin('#d8242b'));
  panel.position.copy(chest.position).add(v(Math.cos(chest.rotation.z) * 0.12, Math.sin(chest.rotation.z) * 0.12));
  panel.rotation.z = chest.rotation.z;
  torso.add(panel);

  // Head (in torso space so bracing moves it).
  head.position.copy(headPos.clone().sub(hip));
  torso.add(head);
  const helmet = mesh(new THREE.SphereGeometry(0.2, 24, 18), helmetMat);
  helmet.scale.set(1.08, 1, 0.95);
  head.add(helmet);
  const visor = mesh(new THREE.SphereGeometry(0.2, 24, 12, -0.9, 1.8, 1.05, 0.75), M.visor());
  visor.rotation.y = Math.PI / 2;
  visor.scale.set(1.02, 1.02, 1.1);
  head.add(visor);
  const st = mesh(new THREE.TorusGeometry(0.195, 0.025, 6, 24, Math.PI), stripe);
  st.rotation.y = Math.PI / 2;
  st.rotation.x = Math.PI / 2;
  st.scale.set(1, 1.05, 1);
  head.add(st);

  // Arms (both sides).
  for (const z of [-0.2, 0.2]) {
    const sh = shoulder.clone().sub(hip).setZ(z);
    const hd = hand.clone().sub(hip).setZ(z * 0.9);
    const elbow = sh.clone().lerp(hd, 0.5).add(v(0, -0.12, 0));
    torso.add(rod(sh, elbow, 0.065, jacket));
    torso.add(rod(elbow, hd, 0.055, jacket));
    const gl = mesh(new THREE.SphereGeometry(0.07, 10, 8), glove);
    gl.position.copy(hd);
    torso.add(gl);
  }

  // Legs (fixed to the vehicle, not the torso).
  for (const z of [-0.17, 0.17]) {
    if (seated) {
      const knee = v(0.25, 0.28, z);
      const foot = v(0.75, 0.05, z);
      root.add(rod(hip.clone().setZ(z), knee, 0.085, pants));
      root.add(rod(knee, foot, 0.07, pants));
    } else {
      const knee = v(0.22, 0.5, z * 1.9);
      const foot = v(0.02, 0.12, z * 1.8);
      root.add(rod(hip.clone().setZ(z), knee, 0.09, pants));
      root.add(rod(knee, foot, 0.075, pants));
      const boot = mesh(rbox(0.26, 0.1, 0.12, 0.03), glove);
      boot.position.copy(foot).add(v(0.06, -0.02, 0));
      root.add(boot);
    }
  }
  return { root, torso, head };
}

export interface VehicleVisual {
  root: THREE.Group;
  body: THREE.Group;
  wheels: WheelVisual[]; // [rear, frontLeft, frontRight]
  rider: RiderRig;
  deck: THREE.Group;
  lights: THREE.Mesh[];
  dispose(): void;
}

function deckRack(spec: VehicleSpec, frame: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  const d = spec.deck;
  const len = d.x1 - d.x0;
  const plate = mesh(rbox(len, 0.08, 0.95, 0.02), M.satin('#2b2d33'));
  plate.position.set((d.x0 + d.x1) / 2, d.y - 0.04, 0);
  g.add(plate);
  // Side rails.
  for (const z of [-0.47, 0.47]) {
    const rail = mesh(cyl(0.025, len, 8).rotateZ(Math.PI / 2), frame);
    rail.position.set((d.x0 + d.x1) / 2, d.y + 0.03, z);
    g.add(rail);
  }
  // Headboard (matches the physical one) and rear lip.
  const hb = mesh(rbox(0.06, 0.55, 0.95, 0.02), frame);
  hb.position.set(d.x1 + 0.03, d.y + 0.26, 0);
  g.add(hb);
  for (let i = 0; i < 3; i++) {
    const bar = mesh(cyl(0.018, 0.95, 8).rotateX(Math.PI / 2), M.metal('#9a9da4'));
    bar.position.set(d.x1 + 0.03, d.y + 0.12 + i * 0.16, 0);
    g.add(bar);
  }
  const lip = mesh(rbox(0.05, d.lip + 0.04, 0.95, 0.015), frame);
  lip.position.set(d.x0 - 0.02, d.y + d.lip / 2, 0);
  g.add(lip);
  // Stays down to the body.
  for (const z of [-0.4, 0.4]) {
    g.add(rod(v(d.x0 + 0.1, d.y - 0.05, z), v(d.x0 + 0.35, d.y - 0.32, z * 0.8), 0.025, frame));
    g.add(rod(v(d.x1 - 0.1, d.y - 0.05, z), v(d.x1 - 0.3, d.y - 0.3, z * 0.8), 0.025, frame));
  }
  return g;
}

function slingshotBody(spec: VehicleSpec, paint: THREE.Material, accent: THREE.Material, body: THREE.Group, lights: THREE.Mesh[]) {
  // Main tub.
  const tub = mesh(
    smoothProfile(
      [
        [-1.95, -0.08],
        [-1.2, -0.16],
        [0.6, -0.2],
        [1.75, -0.16],
        [2.1, -0.04],
        [2.0, 0.08],
        [1.3, 0.2],
        [0.6, 0.3],
        [0.25, 0.3],
        [-0.15, 0.22],
        [-0.7, 0.26],
        [-1.4, 0.38],
        [-1.95, 0.34],
      ],
      1.25,
      0.08,
    ),
    paint,
  );
  body.add(tub);
  // Dark rocker/splitter.
  const rocker = mesh(profile([[-1.8, -0.2], [1.85, -0.24], [2.12, -0.12], [1.9, -0.1], [-1.8, -0.08]], 1.3, 0.03), accent);
  body.add(rocker);
  // Side scoops.
  for (const z of [-0.64, 0.64]) {
    const scoop = mesh(profile([[-0.9, -0.05], [-0.2, -0.08], [0.1, 0.12], [-0.7, 0.2]], 0.04, 0.01), accent);
    scoop.position.z = z;
    body.add(scoop);
  }
  // Seats.
  for (const z of [-0.3, 0.3]) {
    const seat = mesh(rbox(0.5, 0.14, 0.44, 0.06), M.satin('#1d1e22'));
    seat.position.set(-0.2, 0.2, z);
    body.add(seat);
    const back = mesh(rbox(0.14, 0.62, 0.42, 0.06), M.satin('#1d1e22'));
    back.position.set(-0.55, 0.45, z);
    back.rotation.z = 0.28;
    body.add(back);
    // Roll hoop.
    const hoop = mesh(new THREE.TorusGeometry(0.2, 0.035, 8, 16, Math.PI), M.metal('#2a2b30'));
    hoop.position.set(-0.72, 0.66, z);
    hoop.rotation.y = Math.PI / 2;
    body.add(hoop);
  }
  // Windscreen and steering wheel.
  const ws = mesh(rbox(0.04, 0.3, 1.0, 0.015), M.glass());
  ws.position.set(0.5, 0.44, 0);
  ws.rotation.z = 0.85;
  body.add(ws);
  const sw = mesh(new THREE.TorusGeometry(0.15, 0.025, 8, 20), M.satin('#1a1a1c'));
  sw.position.set(0.24, 0.5, 0.3);
  sw.rotation.y = Math.PI / 2;
  sw.rotation.x = 0.5;
  body.add(sw);
  // Headlights: angular slits on the nose.
  for (const z of [-0.45, 0.45]) {
    const hl = mesh(rbox(0.3, 0.06, 0.24, 0.02), M.emissive('#fff6de', 2.4));
    hl.position.set(1.82, 0.08, z);
    hl.rotation.z = -0.22;
    body.add(hl);
    lights.push(hl);
  }
  const tail = mesh(rbox(0.04, 0.06, 1.0, 0.02), M.emissive('#ff2a2a', 1.6));
  tail.position.set(-1.97, 0.22, 0);
  body.add(tail);
  // Front suspension arms to the outboard wheels.
  const fz = 0.98;
  for (const z of [-fz, fz]) {
    body.add(rod(v(1.15, -0.05, z * 0.55), v(spec.front.x, spec.front.y + 0.02, z * 0.92), 0.03, M.metal('#2a2b30')));
    body.add(rod(v(1.55, 0.05, z * 0.55), v(spec.front.x, spec.front.y + 0.12, z * 0.92), 0.03, M.metal('#2a2b30')));
  }
  // Swingarm to the rear wheel.
  body.add(rod(v(-0.75, -0.12, 0.18), v(spec.rear.x, spec.rear.y, 0.18), 0.05, accent));
  body.add(rod(v(-0.75, -0.12, -0.18), v(spec.rear.x, spec.rear.y, -0.18), 0.05, accent));
}

function bikeBody(spec: VehicleSpec, paint: THREE.Material, accent: THREE.Material, body: THREE.Group, lights: THREE.Mesh[], tour: boolean) {
  const w = tour ? 0.95 : 0.72;
  const L = tour ? 1.0 : 1.0;
  // Main spine body.
  const main = mesh(
    smoothProfile(
      tour
        ? [
            [-2.0, 0.0],
            [-1.2, -0.12],
            [0.4, -0.2],
            [1.6, -0.14],
            [2.0, 0.05],
            [1.9, 0.32],
            [1.3, 0.5],
            [0.7, 0.62],
            [0.3, 0.55],
            [-0.5, 0.5],
            [-1.4, 0.55],
            [-2.0, 0.42],
          ]
        : [
            [-1.55, 0.02],
            [-0.9, -0.1],
            [0.5, -0.2],
            [1.45, -0.12],
            [1.72, 0.08],
            [1.5, 0.36],
            [0.95, 0.52],
            [0.45, 0.62],
            [0.1, 0.5],
            [-0.6, 0.46],
            [-1.3, 0.5],
            [-1.55, 0.36],
          ],
      w * L,
      0.07,
    ),
    paint,
  );
  body.add(main);
  // Dark lower engine block.
  const eng = mesh(rbox(1.1, 0.4, w * 0.8, 0.08), accent);
  eng.position.set(0.1, 0.02, 0);
  body.add(eng);
  // Front "face": wide fascia joining the two front fenders.
  const fz = tour ? 0.9 : 0.82;
  const fasc = mesh(rbox(0.5, 0.26, fz * 2 - 0.2, 0.1), paint);
  fasc.position.set(spec.front.x + 0.25, spec.front.y + 0.22, 0);
  body.add(fasc);
  for (const z of [-fz, fz]) {
    const fender = mesh(
      new THREE.TorusGeometry(spec.front.radius + 0.07, 0.07, 8, 20, Math.PI * 0.95),
      paint,
    );
    fender.position.set(spec.front.x, spec.front.y, z);
    fender.rotation.z = Math.PI * 0.05;
    fender.scale.set(1, 1, 2.2);
    body.add(fender);
    const hl = mesh(rbox(0.1, 0.1, 0.22, 0.03), M.emissive('#fff6de', 2.4));
    hl.position.set(spec.front.x + 0.48, spec.front.y + 0.26, z * 0.55);
    body.add(hl);
    lights.push(hl);
    body.add(rod(v(0.9, 0.0, z * 0.3), v(spec.front.x, spec.front.y + 0.02, z * 0.95), 0.03, M.metal('#2a2b30')));
  }
  // Seat.
  const seat = mesh(
    profile(
      tour
        ? [
            [-0.8, 0.5],
            [0.1, 0.52],
            [0.15, 0.62],
            [-0.35, 0.64],
            [-0.65, 0.78],
            [-0.85, 0.74],
          ]
        : [
            [-0.55, 0.46],
            [0.15, 0.48],
            [0.15, 0.58],
            [-0.3, 0.6],
            [-0.55, 0.62],
          ],
      0.44,
      0.05,
    ),
    M.satin('#1d1e22'),
  );
  body.add(seat);
  // Handlebars.
  const hbY = tour ? 0.86 : 0.82;
  body.add(rod(v(0.55, 0.55, 0), v(0.42, hbY, 0), 0.04, accent));
  body.add(rod(v(0.42, hbY, -0.32), v(0.42, hbY, 0.32), 0.03, M.metal('#2a2b30')));
  if (tour) {
    const ws = mesh(rbox(0.04, 0.45, 0.7, 0.02), M.glass());
    ws.position.set(0.75, 0.86, 0);
    ws.rotation.z = 0.55;
    body.add(ws);
    // Rear trunk bumper and accent stripe.
    const stripe = mesh(profile([[-1.9, 0.3], [1.7, 0.2], [1.7, 0.26], [-1.9, 0.36]], w + 0.02, 0.01), M.satin(spec.accent));
    body.add(stripe);
  } else {
    const stripe = mesh(profile([[-1.5, 0.3], [1.5, 0.2], [1.5, 0.27], [-1.5, 0.37]], w + 0.02, 0.01), M.satin(spec.accent));
    body.add(stripe);
  }
  const tail = mesh(rbox(0.05, 0.08, w * 0.7, 0.02), M.emissive('#ff2a2a', 1.6));
  tail.position.set(tour ? -2.0 : -1.56, 0.3, 0);
  body.add(tail);
  // Rear fender + swingarm.
  const rf = mesh(new THREE.TorusGeometry(spec.rear.radius + 0.08, 0.06, 8, 18, Math.PI * 0.55), accent);
  rf.position.set(spec.rear.x, spec.rear.y, 0);
  rf.rotation.z = Math.PI * 0.35;
  rf.scale.set(1, 1, 3.5);
  body.add(rf);
  body.add(rod(v(-0.5, -0.05, 0.2), v(spec.rear.x, spec.rear.y, 0.2), 0.05, accent));
}

export function buildVehicle(spec: VehicleSpec): VehicleVisual {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const paint = M.paint(spec.paint);
  const accent = M.satin(spec.accent);
  const lights: THREE.Mesh[] = [];

  if (spec.id === 'slingshot') slingshotBody(spec, paint, accent, body, lights);
  else bikeBody(spec, paint, accent, body, lights, spec.id === 'spyder');

  const deck = deckRack(spec, M.metal('#34363c'));
  body.add(deck);

  const wheels: WheelVisual[] = [];
  const rimColor = spec.id === 'ryker' ? '#2a2b30' : '#c9ccd2';
  const rw = wheel(spec.rear.radius, spec.id === 'slingshot' ? 0.34 : 0.3, rimColor, spec.id === 'slingshot' ? '#1d1e22' : spec.accent);
  root.add(rw.group);
  wheels.push({ ...rw, baseX: spec.rear.x, baseY: spec.rear.y, z: 0 });
  const fz = spec.id === 'slingshot' ? 0.98 : spec.id === 'spyder' ? 0.9 : 0.82;
  for (const z of [-fz, fz]) {
    const fw = wheel(spec.front.radius, 0.24, rimColor, spec.id === 'slingshot' ? '#1d1e22' : spec.accent);
    fw.group.position.z = z;
    root.add(fw.group);
    wheels.push({ ...fw, baseX: spec.front.x, baseY: spec.front.y, z });
    if (spec.id === 'slingshot') {
      // Cycle fender over each front wheel.
      const f = mesh(new THREE.TorusGeometry(spec.front.radius + 0.06, 0.055, 8, 20, Math.PI * 0.7), paint);
      f.rotation.z = Math.PI * 0.12;
      f.scale.set(1, 1, 2.6);
      fw.group.add(f);
    }
  }

  const r = rider(spec);
  root.add(r.root);

  return {
    root,
    body,
    wheels,
    rider: r,
    deck,
    lights,
    dispose() {
      root.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).geometry.dispose();
      });
    },
  };
}

/**
 * Pose the model from simulation state. Wheel positions are given in
 * chassis-local coordinates so suspension travel is visible.
 */
export function poseVehicle(
  vis: VehicleVisual,
  x: number,
  y: number,
  angle: number,
  wheelsLocal: { x: number; y: number; spin: number }[],
  brace: number,
) {
  vis.root.position.set(x, y, 0);
  vis.root.rotation.z = angle;
  const rear = wheelsLocal[0];
  const front = wheelsLocal[1];
  const [w0, w1, w2] = vis.wheels;
  w0.group.position.set(rear.x, rear.y, 0);
  w0.spin.rotation.z = rear.spin;
  for (const w of [w1, w2]) {
    w.group.position.set(front.x, front.y, w.z);
    w.spin.rotation.z = front.spin;
  }
  // Rider bracing: lean back under throttle, forward under braking.
  vis.rider.torso.rotation.z = THREE.MathUtils.clamp(brace, -0.25, 0.25);
}
