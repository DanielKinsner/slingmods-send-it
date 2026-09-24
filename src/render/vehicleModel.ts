import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { VehicleId, VehicleSpec } from '../sim/types';
import { M, mesh } from './materials';

// Real SlingMods vehicle assets (imported read-only from Three-Wheel Tour, see
// public/assets/vehicles/provenance.json). Model space: metres, +Y up,
// -Z forward, +X right. Chassis-local simulation space: +X forward, +Y up.

const BASE = import.meta.env.BASE_URL;

interface Adapter {
  url: string;
  fit: string;
  /** Model-space (z, y) that maps to the chassis origin. */
  origin: [number, number];
  /** Rear swing-arm pivot in model space (y, z) and the nodes that ride on it. */
  rearPivot: [number, number];
  rearHub: [number, number];
  armNodes: string[];
  rearSpin: string[];
  hide: string[];
  paint: RegExp;
}

export const ADAPTERS: Record<VehicleId, Adapter> = {
  slingshot: {
    url: 'assets/vehicles/slingshot/slingshot-2026.glb',
    fit: 'assets/vehicles/rider/fit-slingshot.json',
    origin: [0, 0.55],
    rearPivot: [0.35, 0.78],
    rearHub: [0.3455, 1.3335],
    armNodes: ['rear_arm_visual', 'rear_caliper_visual', 'rear_axle_visual', 'belt_visual'],
    rearSpin: ['rear_spin'],
    hide: [],
    paint: /Radar_Blue_PC/,
  },
  ryker: {
    url: 'assets/vehicles/ryker/ryker-900-complete.glb',
    fit: 'assets/vehicles/rider/fit-ryker.json',
    origin: [0, 0.5],
    rearPivot: [0.3, 0.12],
    rearHub: [0.2851, 0.8545],
    armNodes: [],
    rearSpin: ['rear_carrier'],
    // Default Three-Wheel Tour assembly: retained partitions replace these,
    // stock parts shown, mod parts hidden (see source ryker-products.ts).
    hide: ['front_suspension', 'body_panels', 'rear_mechanical', 'ryker_mod_shocks', 'ryker_mod_exhaust', 'ryker_mod_body'],
    paint: /^Ryker_Paint$/,
  },
  spyder: {
    url: 'assets/vehicles/spyder/spyder-f3.glb',
    fit: 'assets/vehicles/rider/fit-spyder.json',
    origin: [0, 0.55],
    rearPivot: [0.33, 0.1],
    rearHub: [0.3235, 0.8545],
    armNodes: ['rear_swingarm'],
    rearSpin: ['rear_carrier'],
    hide: [],
    paint: /^paint_orange$/,
  },
};

const RIDER_URL = 'assets/vehicles/rider/biker-rider.glb';

interface RiderFit {
  restPose: Record<string, { t: number[]; r: number[] }>;
  rootOffset?: number[];
}

const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);
const cache = new Map<string, Promise<GLTF>>();
const fitCache = new Map<string, Promise<RiderFit>>();

// The licensed model files are not in the public repo. Production builds load
// them from a separate asset host (VITE_MODEL_BASE); local copies are the fallback.
const MODEL_BASE: string = import.meta.env.VITE_MODEL_BASE ?? '';

function loadGLTF(url: string): Promise<GLTF> {
  let p = cache.get(url);
  if (!p) {
    const local = () => loader.loadAsync(BASE + url);
    const first = MODEL_BASE && url.endsWith('.glb') ? loader.loadAsync(MODEL_BASE + url).catch(local) : local();
    p = first.catch((e) => {
      cache.delete(url);
      throw new Error(`Required model failed to load: ${url} (${(e as Error)?.message ?? e})`);
    });
    cache.set(url, p);
  }
  return p;
}

function loadFit(url: string): Promise<RiderFit> {
  let p = fitCache.get(url);
  if (!p) {
    p = fetch(BASE + url).then((r) => {
      if (!r.ok) throw new Error(`Required rider fit failed to load: ${url} (${r.status})`);
      return r.json();
    });
    fitCache.set(url, p);
  }
  return p;
}

/** Start downloading a vehicle without building it (e.g. from the garage). */
export function preloadVehicle(id: VehicleId) {
  const a = ADAPTERS[id];
  return Promise.all([loadGLTF(a.url), loadGLTF(RIDER_URL), loadFit(a.fit)]).then(() => undefined);
}

export interface WheelVisual {
  node: THREE.Object3D; // moves with suspension
  spin: THREE.Object3D; // rotates about the axle
  restY: number;
}

export interface VehicleVisual {
  id: VehicleId;
  root: THREE.Group; // chassis frame
  model: THREE.Object3D;
  wheels: { rear: WheelVisual; front: WheelVisual[] };
  rearArm: THREE.Group | null;
  armLength: number;
  spine: THREE.Object3D | null;
  spineRest: THREE.Quaternion;
  headVisual: THREE.Object3D | null;
  helmetAnchor: THREE.Object3D;
  deck: THREE.Group;
  pivot: THREE.Group;
  rider: THREE.Object3D;
  riderRest: THREE.Vector3;
  spec: VehicleSpec;
  dispose(): void;
}

function find(root: THREE.Object3D, name: string) {
  return root.getObjectByName(name) ?? null;
}

/** Racks are fictional gameplay devices; built to sit on top of the real body. */
function deckRack(spec: VehicleSpec): THREE.Group {
  const g = new THREE.Group();
  const d = spec.deck;
  const len = d.x1 - d.x0;
  const frame = M.metal('#2f3137');
  const rb = (w: number, h: number, dd: number, r = 0.02) => new RoundedBoxGeometry(w, h, dd, 2, r);
  const plate = mesh(rb(len, 0.06, 0.9), M.satin('#24262b'));
  plate.position.set((d.x0 + d.x1) / 2, d.y - 0.03, 0);
  g.add(plate);
  for (const z of [-0.45, 0.45]) {
    const rail = mesh(new THREE.CylinderGeometry(0.022, 0.022, len, 8).rotateZ(Math.PI / 2), frame);
    rail.position.set((d.x0 + d.x1) / 2, d.y + 0.03, z);
    g.add(rail);
  }
  const hb = mesh(rb(0.05, 0.52, 0.9), frame);
  hb.position.set(d.x1 + 0.03, d.y + 0.26, 0);
  g.add(hb);
  const lip = mesh(rb(0.045, d.lip + 0.04, 0.9, 0.012), frame);
  lip.position.set(d.x0 - 0.02, d.y + d.lip / 2, 0);
  g.add(lip);
  // Two posts down into the body so the rack reads as mounted, not floating.
  for (const z of [-0.3, 0.3]) {
    for (const x of [d.x0 + 0.25, d.x1 - 0.15]) {
      const post = mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.35, 8), frame);
      post.position.set(x, d.y - 0.2, z);
      g.add(post);
    }
  }
  return g;
}

export async function buildVehicle(spec: VehicleSpec, paint: string | null): Promise<VehicleVisual> {
  const a = ADAPTERS[spec.id];
  const [gltf, riderGltf, fit] = await Promise.all([loadGLTF(a.url), loadGLTF(RIDER_URL), loadFit(a.fit)]);

  const root = new THREE.Group();
  root.name = `vehicle-${spec.id}`;
  // Trick pivot: barrel rolls / helicopter spins rotate everything on it.
  const pivot = new THREE.Group();
  root.add(pivot);
  const turn = new THREE.Group();
  turn.rotation.y = -Math.PI / 2; // model -Z forward -> world +X
  pivot.add(turn);
  const offset = new THREE.Group();
  offset.position.set(0, -a.origin[1], -a.origin[0]);
  turn.add(offset);

  const model = gltf.scene.clone(true);
  offset.add(model);
  model.updateMatrixWorld(true);

  // Per-instance materials so paint options never leak between vehicles.
  model.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    m.castShadow = true;
    m.receiveShadow = true;
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    const cloned = mats.map((mat) => {
      const c = mat.clone();
      if (paint && a.paint.test(mat.name) && 'color' in c) (c as THREE.MeshStandardMaterial).color.set(paint);
      return c;
    });
    m.material = Array.isArray(m.material) ? cloned : cloned[0];
  });
  for (const n of a.hide) {
    const o = find(model, n);
    if (o) o.visible = false;
  }

  // Wheels.
  const frontNodes = ['front_left_steer', 'front_right_steer'].map((n) => find(model, n));
  const front: WheelVisual[] = [];
  for (const [i, node] of frontNodes.entries()) {
    if (!node) throw new Error(`${spec.id}: front wheel node missing`);
    const spin = find(node, i === 0 ? 'front_left_spin' : 'front_right_spin') ?? node;
    front.push({ node, spin, restY: node.position.y });
  }
  const rearNode = a.rearSpin.map((n) => find(model, n)).find(Boolean);
  if (!rearNode) throw new Error(`${spec.id}: rear wheel node missing`);
  const rearSpin = rearNode.getObjectByName('rear_spin') ?? rearNode;

  // Rear swing arm: re-parent arm parts and the wheel onto a pivot group.
  let rearArm: THREE.Group | null = null;
  const armLength = Math.hypot(a.rearHub[0] - a.rearPivot[0], a.rearHub[1] - a.rearPivot[1]);
  rearArm = new THREE.Group();
  rearArm.name = 'send-it-rear-pivot';
  rearArm.position.set(0, a.rearPivot[0], a.rearPivot[1]);
  model.add(rearArm);
  rearArm.updateMatrixWorld(true);
  for (const n of a.armNodes) {
    const o = find(model, n);
    if (o) rearArm.attach(o);
  }
  rearArm.attach(rearNode);

  // Rider: the owner's rigged biker, posed with the per-vehicle fit.
  const rider = cloneSkinned(riderGltf.scene) as THREE.Object3D;
  rider.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      m.castShadow = true;
      m.receiveShadow = true;
      m.frustumCulled = false;
    }
  });
  for (const [bone, pose] of Object.entries(fit.restPose)) {
    const b = rider.getObjectByName(bone);
    if (!b) continue;
    b.position.fromArray(pose.t);
    b.quaternion.fromArray(pose.r);
  }
  if (fit.rootOffset) rider.position.fromArray(fit.rootOffset);
  offset.add(rider);
  const spine = rider.getObjectByName('driver_spine') ?? null;
  const headVisual = rider.getObjectByName('driver_head_visual') ?? null;
  const helmetAnchor = rider.getObjectByName('driver_head') ?? rider;

  const deck = deckRack(spec);
  pivot.add(deck);

  return {
    id: spec.id,
    root,
    model,
    wheels: { rear: { node: rearNode, spin: rearSpin, restY: rearNode.position.y }, front },
    rearArm,
    armLength,
    spine,
    spineRest: spine ? spine.quaternion.clone() : new THREE.Quaternion(),
    headVisual,
    helmetAnchor,
    deck,
    pivot,
    rider,
    riderRest: rider.position.clone(),
    spec,
    dispose() {
      root.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        for (const mat of mats) mat.dispose();
      });
      deck.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).geometry.dispose();
      });
    },
  };
}

const tmpQ = new THREE.Quaternion();
const HIP = new THREE.Vector3(0, 0.6, 0.25); // approx. pelvis, model space
const POSE_Q = new THREE.Quaternion();
const POSE_E = new THREE.Euler();
const POSE_P = new THREE.Vector3();
const POSE_OFFSET = new THREE.Vector3();
const AX = new THREE.Vector3(1, 0, 0);

/**
 * Pose from simulation. Wheel positions arrive chassis-local, so suspension
 * travel = local y minus the authored attach height.
 */
export function poseVehicle(
  vis: VehicleVisual,
  x: number,
  y: number,
  angle: number,
  wheelsLocal: { x: number; y: number; spin: number }[],
  brace: number,
  trick: { roll: number; yaw: number; pose: string | null; poseT: number } = { roll: 0, yaw: 0, pose: null, poseT: 0 },
) {
  vis.root.position.set(x, y, 0);
  vis.root.rotation.z = angle;
  vis.pivot.rotation.set(trick.roll, trick.yaw, 0, 'YXZ');
  // Rider trick poses (model space: +Y up, -Z forward).
  const t = trick.poseT;
  let rx = 0;
  let rz = 0;
  POSE_OFFSET.set(0, 0, 0);
  if (trick.pose === 'superman') {
    // "Headstand delivery": the rider flips forward out of the seat, legs up.
    rx = -Math.PI * t;
    POSE_OFFSET.set(0, 1.0 * t, -0.05 * t);
  } else if (trick.pose === 'standup') {
    // Stands on the seat and wobbles, like it's a surfboard.
    rx = 0.2 * t;
    rz = Math.sin(t * Math.PI * 4) * 0.28 * t;
    POSE_OFFSET.set(0, 0.75 * t, 0.1 * t);
  }
  // Rotate about the hips, not the vehicle floor.
  POSE_Q.setFromEuler(POSE_E.set(rx, 0, rz));
  POSE_P.copy(HIP).applyQuaternion(POSE_Q);
  vis.rider.quaternion.copy(POSE_Q);
  vis.rider.position.copy(vis.riderRest).add(HIP).sub(POSE_P).add(POSE_OFFSET);
  const s = vis.spec;
  const rear = wheelsLocal[0];
  const front = wheelsLocal[1];
  const dyF = THREE.MathUtils.clamp(front.y - s.front.y, -0.25, 0.25);
  for (const w of vis.wheels.front) {
    w.node.position.y = w.restY + dyF;
    w.spin.rotation.x = front.spin;
  }
  const dyR = THREE.MathUtils.clamp(rear.y - s.rear.y, -0.25, 0.25);
  if (vis.rearArm) vis.rearArm.rotation.x = -Math.asin(THREE.MathUtils.clamp(dyR / vis.armLength, -0.9, 0.9));
  vis.wheels.rear.spin.rotation.x = rear.spin;
  // Rider bracing: lean with throttle / braking.
  if (vis.spine) {
    tmpQ.setFromAxisAngle(AX, THREE.MathUtils.clamp(-brace, -0.25, 0.25));
    vis.spine.quaternion.copy(vis.spineRest).multiply(tmpQ);
  }
}
