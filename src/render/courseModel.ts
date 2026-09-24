import * as THREE from 'three';
import type { CourseSpec, Solid, Vec2 } from '../sim/types';
import { M, mesh } from './materials';
import { concreteTex, grassTex, roadTopTex, roofTex, sandTex, tileTex, woodTex } from './textures';
import { buildDecor, type KitContext } from './kit';

export const ROAD_HALF = 2.3;
const SIDEWALK = 2.2;

export interface Theme {
  skyTop: string;
  skyMid: string;
  skyHorizon: string;
  sunColor: string;
  sunIntensity: number;
  ambient: string;
  hemiGround: string;
  fog: string;
  fogNear: number;
  fogFar: number;
  ground: 'grass' | 'sand' | 'concrete';
  foreground: 'grass' | 'sand' | 'concrete';
  roadSurface: 'asphalt' | 'wood';
  ocean: boolean;
  sunDir: [number, number, number];
  exposure: number;
}

export const THEMES: Record<string, Theme> = {
  sunset: {
    skyTop: '#4d7fc4',
    skyMid: '#f2b27a',
    skyHorizon: '#ffd79a',
    sunColor: '#ffd9a8',
    sunIntensity: 3.1,
    ambient: '#ffe6d0',
    hemiGround: '#8a6a55',
    fog: '#f3c9a0',
    fogNear: 70,
    fogFar: 330,
    ground: 'grass',
    foreground: 'grass',
    roadSurface: 'asphalt',
    ocean: true,
    sunDir: [-0.55, 0.62, 0.56],
    exposure: 1.0,
  },
  pier: {
    skyTop: '#3f86cf',
    skyMid: '#9ccbe8',
    skyHorizon: '#e9f1ea',
    sunColor: '#fff1d8',
    sunIntensity: 3.3,
    ambient: '#e8f2ff',
    hemiGround: '#6c7f85',
    fog: '#cfe3ec',
    fogNear: 80,
    fogFar: 360,
    ground: 'sand',
    foreground: 'sand',
    roadSurface: 'wood',
    ocean: true,
    sunDir: [-0.35, 0.78, 0.52],
    exposure: 1.0,
  },
  suburb: {
    skyTop: '#3b79c9',
    skyMid: '#a9d0ee',
    skyHorizon: '#f5ecd8',
    sunColor: '#fff0d0',
    sunIntensity: 3.2,
    ambient: '#eaf2ff',
    hemiGround: '#6f7d4f',
    fog: '#d7e6ea',
    fogNear: 70,
    fogFar: 320,
    ground: 'grass',
    foreground: 'grass',
    roadSurface: 'asphalt',
    ocean: false,
    sunDir: [-0.45, 0.72, 0.5],
    exposure: 1.0,
  },
};

function groundMat(kind: 'grass' | 'sand' | 'concrete') {
  const t = kind === 'grass' ? grassTex() : kind === 'sand' ? sandTex() : concreteTex('#bdb6a8');
  return M.tex('ground-' + kind, t, { roughness: 0.95 });
}

/** Resample a polyline at a fixed spacing (keeps authored corners). */
function samples(points: Vec2[], step: number): Vec2[] {
  const out: Vec2[] = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const [ax, ay] = points[i - 1];
    const [bx, by] = points[i];
    const n = Math.max(1, Math.ceil((bx - ax) / step));
    for (let k = 1; k <= n; k++) out.push([ax + ((bx - ax) * k) / n, ay + ((by - ay) * k) / n]);
  }
  return out;
}

/** Strip mesh following a profile between two z values, with y offset per z. */
function strip(pts: Vec2[], z0: number, z1: number, yOff0: number, yOff1: number, uScale: number, vRepeat: number) {
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  let u = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x, y] = pts[i];
    if (i > 0) u += Math.hypot(x - pts[i - 1][0], y - pts[i - 1][1]);
    pos.push(x, y + yOff0, z0, x, y + yOff1, z1);
    uv.push(u / uScale, 0, u / uScale, vRepeat);
    if (i > 0) {
      const a = (i - 1) * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Vertical face under a profile (front face of the road body). */
function face(pts: Vec2[], z: number, baseY: number, uScale: number) {
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i < pts.length; i++) {
    const [x, y] = pts[i];
    pos.push(x, y, z, x, baseY, z);
    uv.push(x / uScale, y / uScale, x / uScale, baseY / uScale);
    if (i > 0) {
      const a = (i - 1) * 2;
      idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function smoothHeights(pts: Vec2[], radius: number): Vec2[] {
  return pts.map(([x], i) => {
    let s = 0;
    let n = 0;
    for (let j = Math.max(0, i - radius); j < Math.min(pts.length, i + radius + 1); j++) {
      s += pts[j][1];
      n++;
    }
    return [x, s / n] as Vec2;
  });
}

function solidMesh(s: Solid, depth: number): THREE.Group {
  const g = new THREE.Group();
  const shape = new THREE.Shape(s.outline.map(([x, y]) => new THREE.Vector2(x, y)));
  const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 2 });
  geo.translate(0, 0, -depth / 2);
  // World-space planar UVs so textures don't stretch.
  const p = geo.attributes.position;
  const n = geo.attributes.normal;
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const ny = Math.abs(n.getY(i));
    const nz = Math.abs(n.getZ(i));
    if (ny > 0.7) {
      uv[i * 2] = p.getX(i) / 3;
      uv[i * 2 + 1] = p.getZ(i) / 3;
    } else if (nz > 0.7) {
      uv[i * 2] = p.getX(i) / 3;
      uv[i * 2 + 1] = p.getY(i) / 3;
    } else {
      uv[i * 2] = p.getZ(i) / 3;
      uv[i * 2 + 1] = p.getY(i) / 3;
    }
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  let mat: THREE.Material;
  switch (s.style) {
    case 'roof':
      mat = M.tex('roofslab', roofTex(), { roughness: 0.95 });
      break;
    case 'terrace':
      mat = M.tex('terrace', tileTex('#efe6d6', '#cdbfa8', 42), { roughness: 0.8 });
      break;
    case 'deck':
    case 'dock':
      mat = M.tex('deck', woodTex(), { roughness: 0.85 });
      break;
    default:
      mat = M.tex('wall-concrete', concreteTex('#d9cfbf'), { roughness: 0.9 });
  }
  g.add(mesh(geo, mat));
  return g;
}

function waterMaterial(color: string, deep: string) {
  const mat = new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.08,
    metalness: 0,
    transmission: 0,
    transparent: true,
    opacity: 0.9,
    clearcoat: 1,
    clearcoatRoughness: 0.05,
    sheen: 0.4,
    sheenColor: new THREE.Color(deep),
  });
  return mat;
}

export interface CourseVisual {
  root: THREE.Group;
  update(t: number, camX: number): void;
  dispose(): void;
}

export function buildCourse(course: CourseSpec, theme: Theme, logo: HTMLImageElement | null): CourseVisual {
  const root = new THREE.Group();
  const updaters: ((t: number, camX: number) => void)[] = [];

  // --- Roads ---------------------------------------------------------------
  for (const road of course.roads) {
    const pts = samples(road.points, 0.5);
    const topMat =
      theme.roadSurface === 'wood'
        ? M.tex('road-wood', woodTex('#a77c52'), { roughness: 0.8 })
        : M.tex('road-top', roadTopTex(), { roughness: 0.88 });
    const top = mesh(strip(pts, -ROAD_HALF, ROAD_HALF, 0, 0, 8, 1), topMat, false, true);
    root.add(top);
    // Near curb face.
    const curb = mesh(strip(pts, ROAD_HALF, ROAD_HALF + 0.35, 0, -0.18, 2, 1), M.tex('curb', concreteTex('#d8d2c6')), false, true);
    root.add(curb);
    const front = mesh(face(pts, ROAD_HALF + 0.35, road.baseY, 4), M.tex('road-side', concreteTex('#b8ae9e')), false, true);
    root.add(front);
    // Sidewalk behind the road.
    const walk = mesh(strip(pts, -ROAD_HALF - SIDEWALK, -ROAD_HALF, 0.14, 0.14, 3, 1), M.tex('walk', tileTex('#d6cfc3', '#b9b0a2', 64), { roughness: 0.9 }), false, true);
    root.add(walk);
    const walkLip = mesh(strip(pts, -ROAD_HALF, -ROAD_HALF, 0.14, 0, 3, 1), M.tex('curb', concreteTex('#d8d2c6')), false, true);
    root.add(walkLip);

    // Background ground: follows a smoothed road profile, then falls away to the coast.
    const soft = smoothHeights(pts, 30);
    const bgMat = groundMat(theme.ground);
    const back1 = mesh(strip(pts.map((p, i) => [p[0], Math.min(p[1], soft[i][1]) + 0.14] as Vec2), -ROAD_HALF - SIDEWALK - 30, -ROAD_HALF - SIDEWALK, 0, 0, 6, 5), bgMat, false, true);
    // Flip winding so it faces up.
    back1.geometry.index!.array.reverse();
    back1.geometry.computeVertexNormals();
    root.add(back1);

    // Foreground verge.
    const fgMat = groundMat(theme.foreground);
    const fg = mesh(strip(pts.map((p) => [p[0], p[1] - 0.2] as Vec2), ROAD_HALF + 0.35, ROAD_HALF + 14, 0, -0.6, 6, 2), fgMat, false, true);
    root.add(fg);
  }

  // --- Solids --------------------------------------------------------------
  for (const s of course.solids) {
    root.add(solidMesh(s, s.style === 'wall' ? 6 : 5.2));
  }

  // --- Water volumes -------------------------------------------------------
  for (const w of course.water) {
    const water = mesh(new THREE.BoxGeometry(w.x1 - w.x0, 0.05, 5.0, 1, 1, 1), waterMaterial('#29c4d8', '#0b6f8a'), false, true);
    water.position.set((w.x0 + w.x1) / 2, w.y1 - 0.1, 0);
    root.add(water);
    const basin = mesh(new THREE.BoxGeometry(w.x1 - w.x0, 0.02, 5.0), M.tex('pooltile', tileTex('#5fd0e0', '#3aa9bf', 24), { roughness: 0.4 }), false, true);
    basin.position.set((w.x0 + w.x1) / 2, w.y0 + 0.42, 0);
    root.add(basin);
    const glint = water.material as THREE.MeshPhysicalMaterial;
    updaters.push((t) => {
      glint.sheen = 0.35 + Math.sin(t * 1.7) * 0.1;
      water.position.y = w.y1 - 0.1 + Math.sin(t * 2.1) * 0.01;
    });
  }

  // --- Sky, sea and horizon -------------------------------------------------
  const skyGeo = new THREE.SphereGeometry(900, 32, 16);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      top: { value: new THREE.Color(theme.skyTop) },
      mid: { value: new THREE.Color(theme.skyMid) },
      hor: { value: new THREE.Color(theme.skyHorizon) },
      sunDir: { value: new THREE.Vector3(0.55, 0.12, -1).normalize() },
      sunCol: { value: new THREE.Color(theme.sunColor) },
    },
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      uniform vec3 top; uniform vec3 mid; uniform vec3 hor; uniform vec3 sunDir; uniform vec3 sunCol;
      varying vec3 vDir;
      void main(){
        float h = clamp(vDir.y, -0.2, 1.0);
        vec3 c = mix(hor, mid, smoothstep(0.0, 0.18, h));
        c = mix(c, top, smoothstep(0.16, 0.65, h));
        float s = max(dot(normalize(vDir), sunDir), 0.0);
        c += sunCol * (pow(s, 900.0) * 3.0 + pow(s, 24.0) * 0.35 + pow(s, 4.0) * 0.12);
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  sky.renderOrder = -10;
  root.add(sky);
  updaters.push((_t, camX) => {
    sky.position.x = camX;
  });

  if (theme.ocean) {
    const sea = new THREE.Mesh(
      new THREE.PlaneGeometry(2400, 700, 1, 1),
      new THREE.MeshPhysicalMaterial({ color: '#2f8fb0', roughness: 0.18, metalness: 0.05, clearcoat: 0.7, clearcoatRoughness: 0.25 }),
    );
    sea.rotation.x = -Math.PI / 2;
    sea.position.set(course.bounds.x0 + 400, -3.4, -420);
    sea.receiveShadow = false;
    root.add(sea);
    // Sparkle band near the horizon.
    const band = new THREE.Mesh(
      new THREE.PlaneGeometry(2400, 40),
      new THREE.MeshBasicMaterial({ color: '#ffe3b0', transparent: true, opacity: 0.35, fog: false, depthWrite: false }),
    );
    band.rotation.x = -Math.PI / 2;
    band.position.set(course.bounds.x0 + 400, -3.3, -700);
    root.add(band);
    // Beach between the town and the sea.
    const beach = mesh(new THREE.PlaneGeometry(2400, 70), groundMat('sand'), false, true);
    beach.rotation.x = -Math.PI / 2;
    beach.position.set(course.bounds.x0 + 400, -2.2, -70);
    root.add(beach);
  } else {
    const far = mesh(new THREE.PlaneGeometry(2400, 700), groundMat('grass'), false, true);
    far.rotation.x = -Math.PI / 2;
    far.position.set(course.bounds.x0 + 400, -1.2, -380);
    root.add(far);
  }

  // --- Decor ---------------------------------------------------------------
  const ctx: KitContext = { course, logo, theme, updaters };
  for (const d of course.decor) {
    const obj = buildDecor(d, ctx);
    if (obj) root.add(obj);
  }

  return {
    root,
    update(t, camX) {
      for (const u of updaters) u(t, camX);
    },
    dispose() {
      root.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).geometry.dispose();
      });
    },
  };
}
