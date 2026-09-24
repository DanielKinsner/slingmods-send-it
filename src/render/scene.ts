import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { Build, CourseSpec } from '../sim/types';
import { PAINTS, applyBuild } from '../data/vehicles';
import { M } from './materials';
import { CARGO } from '../data/cargo';
import { buildCourse, THEMES, type CourseVisual } from './courseModel';
import { buildVehicle, poseVehicle, type VehicleVisual } from './vehicleModel';
import { buildCargo, type CargoVisual } from './cargoModel';
import { Particles, blobShadow } from './fx';
import type { Run } from '../game/run';
import { trickVisual } from '../game/tricks';

const Z_AXIS = new THREE.Vector3(0, 0, 1);

export interface Snapshot {
  x: number;
  y: number;
  a: number;
  wheels: { x: number; y: number; spin: number }[];
  cargo: { x: number; y: number; a: number }[];
}

export function snapshot(run: Run, out?: Snapshot): Snapshot {
  const v = run.vehicle;
  const p = v.position;
  const s: Snapshot = out ?? { x: 0, y: 0, a: 0, wheels: [{ x: 0, y: 0, spin: 0 }, { x: 0, y: 0, spin: 0 }], cargo: [] };
  s.x = p.x;
  s.y = p.y;
  s.a = v.angle;
  const ws = v.wheelState();
  for (let i = 0; i < 2; i++) {
    const [lx, ly] = v.toLocal(ws[i].x, ws[i].y);
    s.wheels[i].x = lx;
    s.wheels[i].y = ly;
    s.wheels[i].spin = ws[i].spin - v.angle;
  }
  const items = run.cargo.items;
  while (s.cargo.length < items.length) s.cargo.push({ x: 0, y: 0, a: 0 });
  for (let i = 0; i < items.length; i++) {
    const b = items[i].body;
    const t = b.translation();
    s.cargo[i].x = t.x;
    s.cargo[i].y = t.y;
    s.cargo[i].a = b.rotation();
  }
  return s;
}

function lerpAngle(a: number, b: number, t: number) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

export interface CameraSettings {
  shake: boolean;
  reducedMotion: boolean;
}

export class GameScene {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly particles = new Particles(700);
  private sun: THREE.DirectionalLight;
  private hemi: THREE.HemisphereLight;
  private course: CourseVisual | null = null;
  courseSpec: CourseSpec | null = null;
  private vehicle: VehicleVisual | null = null;
  private vehicleKey = '';
  private cargo: CargoVisual[] = [];
  private shadows: THREE.Mesh[] = [];
  private logo: HTMLImageElement | null;
  private camPos = new THREE.Vector3();
  private camTarget = new THREE.Vector3();
  private camInit = false;
  private shakeT = 0;
  private shakeAmp = 0;
  private zoom = 22;
  time = 0;
  settings: CameraSettings = { shake: true, reducedMotion: false };
  /** Extra framing for title/garage shots. */
  framing: 'run' | 'attract' | 'garage' = 'run';
  private lastBrace = 0;
  private tqLocal = new THREE.Quaternion();
  private tqAngle = new THREE.Quaternion();
  private tqWorld = new THREE.Quaternion();
  private tEuler = new THREE.Euler();
  private tmpV = new THREE.Vector3();

  constructor(canvas: HTMLCanvasElement, logo: HTMLImageElement | null, quality: 'high' | 'low') {
    this.logo = logo;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: quality === 'high', powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, quality === 'high' ? 1.75 : 1));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.camera = new THREE.PerspectiveCamera(30, 16 / 9, 0.5, 2000);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.45;

    this.sun = new THREE.DirectionalLight('#ffffff', 3);
    this.sun.castShadow = true;
    const size = quality === 'high' ? 2048 : 1024;
    this.sun.shadow.mapSize.set(size, size);
    const sc = this.sun.shadow.camera;
    sc.left = -34;
    sc.right = 34;
    sc.top = 22;
    sc.bottom = -22;
    sc.near = 1;
    sc.far = 140;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.03;
    this.scene.add(this.sun, this.sun.target);
    this.hemi = new THREE.HemisphereLight('#ffffff', '#886655', 1.1);
    this.scene.add(this.hemi);
    this.scene.add(this.particles.points);
    this.resize();
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // Keep horizontal coverage on narrow/portrait screens.
    this.camera.fov = w / h < 1.3 ? 42 : 30;
    this.camera.updateProjectionMatrix();
    this.particles.setScale(h * this.renderer.getPixelRatio());
  }

  setCourse(course: CourseSpec) {
    if (this.courseSpec === course) return;
    if (this.course) {
      this.scene.remove(this.course.root);
      this.course.dispose();
    }
    this.courseSpec = course;
    const theme = THEMES[course.theme];
    this.course = buildCourse(course, theme, this.logo);
    this.scene.add(this.course.root);
    this.scene.fog = new THREE.Fog(theme.fog, theme.fogNear, theme.fogFar);
    this.sun.color.set(theme.sunColor);
    this.sun.intensity = theme.sunIntensity;
    this.hemi.color.set(theme.ambient);
    this.hemi.groundColor.set(theme.hemiGround);
    this.renderer.toneMappingExposure = theme.exposure;
    this.camInit = false;
  }

  /**
   * Load (once, cached) and show the real vehicle model for this build.
   * Rejects with a diagnostic if a required model is missing: there is no
   * substitute vehicle.
   */
  async setBuild(build: Build): Promise<void> {
    const key = `${build.vehicle}:${build.paint}`;
    this.ensureCargo();
    if (key === this.vehicleKey) return this.pendingVehicle ?? undefined;
    this.vehicleKey = key;
    // Never pose the previous vehicle on the new simulation.
    if (this.vehicle) this.vehicle.root.visible = false;
    const p = this.loadVehicle(build, key);
    this.pendingVehicle = p;
    return p;
  }

  private pendingVehicle: Promise<void> | null = null;

  private async loadVehicle(build: Build, key: string) {
    const spec = applyBuild(build);
    const paint = PAINTS[build.paint]?.body || null;
    const vis = await buildVehicle(spec, paint);
    if (this.vehicleKey !== key) {
      vis.dispose();
      return;
    }
    if (this.vehicle) {
      this.scene.remove(this.vehicle.root);
      this.vehicle.dispose();
    }
    this.vehicle = vis;
    this.scene.add(vis.root);
  }

  get vehicleReady() {
    return !!this.vehicle && this.vehicleKey.startsWith(this.vehicle.id + ':');
  }

  private ensureCargo() {
    if (!this.cargo.length) {
      for (const spec of CARGO) {
        const c = buildCargo(spec, this.logo);
        this.cargo.push(c);
        this.scene.add(c.root);
        const sh = blobShadow(Math.max(spec.w, 0.4) * 2);
        this.shadows.push(sh);
        this.scene.add(sh);
      }
      const vs = blobShadow(5);
      this.shadows.push(vs);
      this.scene.add(vs);
    }
  }

  private helmet: { obj: THREE.Object3D; vx: number; vy: number; vr: number } | null = null;

  /** The helmet leaves the rider (visual only). In water, it floats. */
  popHelmet(vx: number) {
    if (!this.vehicle || this.helmet || this.settings.reducedMotion) return;
    const wp = this.vehicle.helmetAnchor.getWorldPosition(new THREE.Vector3());
    if (this.vehicle.headVisual) this.vehicle.headVisual.visible = false;
    // The rider's head is skinned to the rig, so the flying helmet is a
    // matching loose prop rather than the bound mesh itself.
    const clone = new THREE.Group();
    const shell = new THREE.Mesh(new THREE.SphereGeometry(0.17, 24, 18), M.paint('#1d1e22'));
    shell.scale.set(1.08, 1, 0.95);
    const visor = new THREE.Mesh(new THREE.SphereGeometry(0.172, 24, 12, -0.9, 1.8, 1.05, 0.75), M.visor());
    visor.rotation.y = Math.PI / 2;
    clone.add(shell, visor);
    clone.traverse((o) => ((o as THREE.Mesh).castShadow = true));
    clone.position.copy(wp);
    clone.position.z = 0.6;
    this.scene.add(clone);
    this.helmet = { obj: clone, vx: vx * 0.4 + 1.5, vy: 6.5, vr: 7 };
  }

  private updateHelmet(dt: number) {
    const h = this.helmet;
    if (!h) return;
    const o = h.obj;
    const water = this.courseSpec?.water.find((w) => o.position.x > w.x0 && o.position.x < w.x1 && o.position.y < w.y1 + 0.1);
    if (water) {
      // Bob on the surface. Deadpan.
      o.position.y += (water.y1 - 0.02 + Math.sin(this.time * 2.2) * 0.04 - o.position.y) * Math.min(1, dt * 5);
      h.vx *= 0.96;
      o.position.x += h.vx * dt;
      o.rotation.z += (0.3 * Math.sin(this.time) - o.rotation.z) * dt * 2;
      return;
    }
    h.vy -= 12 * dt;
    o.position.x += h.vx * dt;
    o.position.y += h.vy * dt;
    o.rotation.z -= h.vr * dt;
    const g = this.groundBelow(o.position.x, o.position.y + 0.5) + 0.2;
    if (o.position.y < g) {
      o.position.y = g;
      h.vy = Math.abs(h.vy) > 1.5 ? -h.vy * 0.45 : 0;
      h.vx *= 0.7;
      h.vr *= 0.6;
    }
  }

  /** Reset cosmetic cargo state for a new attempt. */
  resetCargo() {
    if (this.helmet) {
      this.scene.remove(this.helmet.obj);
      this.helmet = null;
    }
    if (this.vehicle?.headVisual) this.vehicle.headVisual.visible = true;
    for (const c of this.cargo) {
      if (c.damagedApplied) {
        const fresh = buildCargo(c.spec, this.logo);
        this.scene.remove(c.root);
        Object.assign(c, fresh);
        this.scene.add(c.root);
      }
      c.root.visible = true;
    }
    this.particles.clear();
    this.camInit = false;
  }

  shake(amount: number) {
    if (!this.settings.shake || this.settings.reducedMotion) return;
    this.shakeAmp = Math.min(0.5, Math.max(this.shakeAmp, amount));
    this.shakeT = 0.35;
  }

  draw(run: Run, prev: Snapshot, cur: Snapshot, alpha: number, dt: number, extra: { throttle: number; brake: number }) {
    this.time += dt;
    const x = prev.x + (cur.x - prev.x) * alpha;
    const y = prev.y + (cur.y - prev.y) * alpha;
    const a = lerpAngle(prev.a, cur.a, alpha);
    const wheels = cur.wheels.map((w, i) => ({
      x: prev.wheels[i].x + (w.x - prev.wheels[i].x) * alpha,
      y: prev.wheels[i].y + (w.y - prev.wheels[i].y) * alpha,
      spin: lerpAngle(prev.wheels[i].spin, w.spin, alpha),
    }));
    const braceTarget = extra.throttle * 0.12 - extra.brake * 0.18;
    this.lastBrace += (braceTarget - this.lastBrace) * Math.min(1, dt * 6);
    const trick = trickVisual(run.tricks.active);
    if (this.vehicle) poseVehicle(this.vehicle, x, y, a, wheels, this.lastBrace, trick);
    // World-space version of the trick rotation, pivoting on the chassis.
    const trickOn = trick.roll !== 0 || trick.yaw !== 0;
    if (trickOn) {
      this.tqLocal.setFromEuler(this.tEuler.set(trick.roll, trick.yaw, 0, 'YXZ'));
      this.tqAngle.setFromAxisAngle(Z_AXIS, a);
      this.tqWorld.copy(this.tqAngle).multiply(this.tqLocal).multiply(this.tqAngle.clone().invert());
    }

    // Cargo.
    const items = run.cargo.items;
    for (let i = 0; i < this.cargo.length && i < items.length; i++) {
      const vis = this.cargo[i];
      const it = items[i];
      const p0 = prev.cargo[i];
      const p1 = cur.cargo[i];
      vis.root.position.set(p0.x + (p1.x - p0.x) * alpha, p0.y + (p1.y - p0.y) * alpha, 0);
      vis.root.rotation.set(0, 0, lerpAngle(p0.a, p1.a, alpha));
      if (trickOn && it.strapped && it.state === 'onboard' && !it.pickup) {
        this.tmpV.set(x, y, 0);
        vis.root.position.sub(this.tmpV).applyQuaternion(this.tqWorld).add(this.tmpV);
        vis.root.quaternion.premultiply(this.tqWorld);
      }
      const strapped = it.strapped && !it.pickup;
      for (const s of vis.straps) s.visible = strapped;
      const tension = Math.min(1, it.tension);
      vis.strapMat.color.setRGB(0.94, 0.7 - tension * 0.55, 0.0 + tension * 0.1);
      vis.strapMat.emissive.setRGB(tension > 0.75 ? 0.5 * Math.abs(Math.sin(this.time * 18)) : 0, 0, 0);
      vis.ring.visible = !!it.pickup;
      if (vis.ring.visible) vis.ring.rotation.z = this.time * 4;
      if (it.condition < 0.6 && !vis.damagedApplied) vis.setDamaged();
      vis.root.visible = it.state !== 'lost' || vis.root.position.y > run.course.killY + 2;
      // Flamingo wobble.
      if (vis.spec.kind === 'flamingo') vis.box.rotation.z = Math.sin(this.time * 9) * 0.05 * Math.min(1, run.vehicle.speed / 6);
      const sh = this.shadows[i];
      sh.position.set(vis.root.position.x, this.groundBelow(vis.root.position.x, vis.root.position.y) + 0.03, 0.2);
      const hgt = Math.max(0, vis.root.position.y - sh.position.y);
      sh.visible = hgt < 6 && vis.root.visible;
      (sh.material as THREE.MeshBasicMaterial).opacity = 0.3 * Math.max(0, 1 - hgt / 6);
    }
    const vsh = this.shadows[this.shadows.length - 1];
    if (vsh) {
      vsh.position.set(x, this.groundBelow(x, y) + 0.02, 0);
      const hgt = Math.max(0, y - vsh.position.y);
      (vsh.material as THREE.MeshBasicMaterial).opacity = 0.4 * Math.max(0, 1 - hgt / 8);
    }

    this.updateHelmet(dt);
    this.updateCamera(x, y, run, dt);
    this.course?.update(this.time, x);
    this.particles.update(dt);
    this.renderer.render(this.scene, this.camera);
  }

  /** Height of the highest walkable surface under (x, y). */
  groundBelow(x: number, y: number): number {
    const c = this.courseSpec;
    if (!c) return 0;
    let best = -Infinity;
    const consider = (pts: [number, number][]) => {
      for (let i = 0; i < pts.length - 1; i++) {
        const [ax, ay] = pts[i];
        const [bx, by] = pts[i + 1];
        if (bx <= ax) continue;
        if (x >= ax && x <= bx) {
          const h = ay + ((x - ax) / (bx - ax)) * (by - ay);
          if (h <= y + 0.3 && h > best) best = h;
        }
      }
    };
    for (const r of c.roads) consider(r.points);
    for (const s of c.solids) consider(s.outline);
    return best === -Infinity ? y - 50 : best;
  }

  private updateCamera(x: number, y: number, run: Run, dt: number) {
    const v = run.vehicle;
    const vel = v.chassis.linvel();
    const garage = this.framing === 'garage';
    // Frame by visible width in metres so any window shape reads the same.
    const width = garage ? 9 : THREE.MathUtils.clamp(17 + Math.abs(vel.x) * 0.35 + (v.airborne ? 3 : 0), 17, 27);
    const halfV = THREE.MathUtils.degToRad(this.camera.fov / 2);
    const desiredZoom = width / (2 * this.camera.aspect * Math.tan(halfV));
    const lookAhead = garage ? 0 : THREE.MathUtils.clamp(vel.x * 0.28, -2, width * 0.2) + 1.5;
    this.zoom += (desiredZoom - this.zoom) * Math.min(1, dt * (garage ? 4 : 1.2));

    const tx = x + lookAhead;
    const ground = this.groundBelow(x, y);
    // Frame between the vehicle and the ground so jumps stay readable.
    const ty = garage ? y + 0.9 : Math.max(y - 0.6, ground + (y - ground) * 0.55) + 1.6;
    if (!this.camInit) {
      this.camTarget.set(tx, ty, 0);
      this.camInit = true;
    }
    const kx = 1 - Math.exp(-dt * 4.5);
    const ky = 1 - Math.exp(-dt * 3.0);
    this.camTarget.x += (tx - this.camTarget.x) * kx;
    const dy = ty - this.camTarget.y;
    if (Math.abs(dy) > 0.4 || garage) this.camTarget.y += (dy - Math.sign(dy) * (garage ? 0 : 0.4)) * ky;

    const yaw = THREE.MathUtils.degToRad(garage ? 24 : 15);
    const pitch = THREE.MathUtils.degToRad(garage ? 10 : 6.5);
    const d = this.zoom;
    this.camPos.set(
      this.camTarget.x + Math.sin(yaw) * Math.cos(pitch) * d,
      this.camTarget.y + Math.sin(pitch) * d,
      Math.cos(yaw) * Math.cos(pitch) * d,
    );
    this.camera.position.copy(this.camPos);
    if (this.shakeT > 0) {
      this.shakeT -= dt;
      const k = this.shakeAmp * Math.max(0, this.shakeT / 0.35);
      this.camera.position.x += (Math.random() - 0.5) * k;
      this.camera.position.y += (Math.random() - 0.5) * k;
    }
    this.camera.lookAt(this.camTarget);

    // Shadow frustum follows the action.
    const sd = THEMES[this.courseSpec?.theme ?? 'sunset'].sunDir;
    this.sun.position.set(this.camTarget.x + sd[0] * 60, this.camTarget.y + sd[1] * 60, sd[2] * 60);
    this.sun.target.position.set(this.camTarget.x, this.camTarget.y - 2, 0);
  }

  /**
   * Developer inspection: the loaded vehicle alone under neutral light on a
   * grey sweep, orbiting camera. Used to verify the real assets.
   */
  inspect(yawDeg: number, pitchDeg = 12, dist = 6.5) {
    const v = this.vehicle;
    if (!v) return;
    if (!this.inspectBg) {
      this.inspectBg = new THREE.Mesh(new THREE.CylinderGeometry(30, 30, 30, 48, 1, true), new THREE.MeshStandardMaterial({ color: '#8d8f94', side: THREE.BackSide, roughness: 1 }));
      const floor = new THREE.Mesh(new THREE.CircleGeometry(30, 48), new THREE.MeshStandardMaterial({ color: '#9a9ca1', roughness: 0.9 }));
      floor.rotation.x = -Math.PI / 2;
      floor.receiveShadow = true;
      this.inspectBg.add(floor);
      floor.position.y = -14.99;
      this.inspectBg.position.y = 15;
      this.scene.add(this.inspectBg);
    }
    this.course?.root && (this.course.root.visible = false);
    for (const c of this.cargo) c.root.visible = false;
    for (const s of this.shadows) s.visible = false;
    v.deck.visible = false;
    this.scene.fog = null;
    this.sun.color.set('#ffffff');
    this.sun.intensity = 2.2;
    this.hemi.color.set('#ffffff');
    this.hemi.groundColor.set('#777777');
    this.renderer.toneMappingExposure = 1;
    const yc = v.spec.rear.radius - v.spec.rear.y;
    poseVehicle(v, 0, yc, 0, [
      { x: v.spec.rear.x, y: v.spec.rear.y, spin: 0 },
      { x: v.spec.front.x, y: v.spec.front.y, spin: 0 },
    ], 0);
    const yaw = THREE.MathUtils.degToRad(yawDeg);
    const pitch = THREE.MathUtils.degToRad(pitchDeg);
    this.camera.position.set(Math.sin(yaw) * Math.cos(pitch) * dist, 0.7 + Math.sin(pitch) * dist, Math.cos(yaw) * Math.cos(pitch) * dist);
    this.camera.lookAt(0, 0.7, 0);
    this.sun.position.set(-4, 8, 6);
    this.sun.target.position.set(0, 0, 0);
    this.renderer.render(this.scene, this.camera);
  }
  private inspectBg: THREE.Mesh | null = null;

  /** Project a world point to CSS pixels (for HUD callouts). */
  toScreen(x: number, y: number, z = 0): [number, number] {
    const v = new THREE.Vector3(x, y, z).project(this.camera);
    return [((v.x + 1) / 2) * window.innerWidth, ((1 - v.y) / 2) * window.innerHeight];
  }
}
