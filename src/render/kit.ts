import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { CourseSpec, DecorItem, Vec2 } from '../sim/types';
import type { Theme } from './courseModel';
import { M, mesh } from './materials';
import {
  awningTex,
  cartonTex,
  concreteTex,
  corrugatedTex,
  grassTex,
  roofTex,
  sandTex,
  signTex,
  stuccoTex,
  tileTex,
  windowsTex,
  woodTex,
} from './textures';
import { heightAt } from '../data/courses/build';

// Modular miniature scenery kit. Everything off the gameplay plane (|z| > 2.4)
// is decoration and never collides.

export interface KitContext {
  course: CourseSpec;
  logo: HTMLImageElement | null;
  theme: Theme;
  updaters: ((t: number, camX: number) => void)[];
}

const BACK = -4.8; // just behind the sidewalk

function groundAt(ctx: KitContext, x: number, span = 0): number {
  const pts = ctx.course.roads[0].points;
  let lo = Infinity;
  for (let dx = -span / 2; dx <= span / 2 + 1e-6; dx += Math.max(1, span / 8 || 1)) {
    const h = heightAt(pts, x + dx);
    if (h !== null) lo = Math.min(lo, h);
    if (span === 0) break;
  }
  return lo === Infinity ? 0 : lo;
}

function rbox(w: number, h: number, d: number, r = 0.05) {
  return new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2, h / 2, d / 2));
}

function boxAt(w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number, r = 0.04) {
  const m = mesh(rbox(w, h, d, r), mat);
  m.position.set(x, y, z);
  return m;
}

/** Box with world-scaled UVs on its front face so textures tile properly. */
function texturedBox(w: number, h: number, d: number, mat: THREE.Material, scale = 3) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv as THREE.BufferAttribute;
  const n = g.attributes.normal as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) {
    const nx = Math.abs(n.getX(i));
    const ny = Math.abs(n.getY(i));
    const u = uv.getX(i);
    const v = uv.getY(i);
    const sw = nx > 0.5 ? d : w;
    const sh = ny > 0.5 ? d : h;
    uv.setXY(i, (u * sw) / scale, (v * sh) / scale);
  }
  return mesh(g, mat);
}

function signPlane(key: string, w: number, h: number, opts: Parameters<typeof signTex>[1], emissive = 0) {
  const tex = signTex(key, opts);
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, emissive: emissive ? '#ffffff' : '#000000', emissiveMap: emissive ? tex : null, emissiveIntensity: emissive });
  return mesh(new THREE.PlaneGeometry(w, h), mat, false, true);
}

// ---------------------------------------------------------------------------

function warehouse(d: DecorItem, ctx: KitContext) {
  const g = new THREE.Group();
  const w = d.w ?? 52;
  const h = d.h ?? 11;
  const depth = d.d ?? 18;
  const x0 = d.x;
  const base = groundAt(ctx, x0 + w / 2, w) - 0.1;
  const zf = BACK - 0.3;
  const wall = M.tex('corr-wh', corrugatedTex('#e2ddd2'), { roughness: 0.75, metalness: 0.2 });
  const shell = texturedBox(w, h, depth, wall, 2.5);
  shell.position.set(x0 + w / 2, base + h / 2, zf - depth / 2);
  g.add(shell);
  // Dark lower band + red stripe (brand accent).
  g.add(boxAt(w + 0.1, 1.2, 0.2, M.satin('#2a2c31'), x0 + w / 2, base + 0.6, zf + 0.05, 0.02));
  g.add(boxAt(w + 0.1, 0.35, 0.22, M.satin('#d8242b'), x0 + w / 2, base + h - 1.4, zf + 0.06, 0.02));
  // Roof edge.
  g.add(boxAt(w + 0.6, 0.5, depth + 0.6, M.satin('#8e8c88'), x0 + w / 2, base + h + 0.2, zf - depth / 2, 0.08));

  // Big open roller door with a lit interior full of parcels.
  const doorW = 11;
  const doorH = 6.2;
  const dx = x0 + w - 20;
  const interior = mesh(new THREE.PlaneGeometry(doorW, doorH), M.matte('#3b3530'), false, false);
  interior.position.set(dx, base + doorH / 2, zf + 0.02);
  g.add(interior);
  const inside = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 4; j++) {
      const shelfY = base + 0.6 + j * 1.45;
      inside.add(boxAt(doorW - 1, 0.08, 0.6, M.metal('#e0632b'), dx, shelfY, zf - 1.6 + i * 0.01, 0.01));
      for (let k = 0; k < 7; k++) {
        const bw = 0.7 + ((k * 13 + j * 7) % 5) * 0.08;
        const bh = 0.6 + ((k * 7 + j * 3) % 4) * 0.12;
        const c = boxAt(bw, bh, 0.55, M.tex('carton-wh', cartonTex('standard', 'WH', ctx.logo)), dx - doorW / 2 + 1 + k * 1.35, shelfY + bh / 2 + 0.05, zf - 1.6, 0.03);
        inside.add(c);
      }
    }
  }
  g.add(inside);
  const doorLight = new THREE.PointLight('#ffcf8a', 30, 14, 2);
  doorLight.position.set(dx, base + doorH - 0.6, zf + 1.5);
  g.add(doorLight);
  // Rolled-up door drum and frame.
  g.add(boxAt(doorW + 0.6, 0.8, 0.8, M.satin('#bfbab0'), dx, base + doorH + 0.4, zf + 0.35, 0.3));
  for (const s of [-1, 1]) g.add(boxAt(0.35, doorH, 0.4, M.satin('#f3c01c'), dx + (s * (doorW + 0.35)) / 2, base + doorH / 2, zf + 0.2, 0.05));

  // Logo panel.
  if (ctx.logo) {
    const lw = 13;
    const lh = lw * (ctx.logo.height / ctx.logo.width) + 0.8;
    const panel = boxAt(lw + 0.8, lh + 0.4, 0.25, M.matte('#fbfaf7'), x0 + 14, base + h - 3.9, zf + 0.15, 0.08);
    g.add(panel);
    const tex = new THREE.Texture(ctx.logo);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    const logo = mesh(new THREE.PlaneGeometry(lw, lw * (ctx.logo.height / ctx.logo.width)), new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.5 }), false, false);
    logo.position.set(x0 + 14, base + h - 3.9, zf + 0.3);
    g.add(logo);
  }
  const shipIt = signPlane('shipit', 10, 1.5, { w: 10, h: 1.5, bg: '#1d1e22', fg: '#f3c01c', lines: [{ text: 'OUTBOUND  →  SEND IT', size: 0.9 }], px: 64 });
  shipIt.position.set(dx, base + doorH + 1.6, zf + 0.12);
  g.add(shipIt);
  // Painted wall slogans.
  const slogan = signPlane('wh-slogan', 9, 1.3, { w: 9, h: 1.3, bg: '#e2ddd2', fg: '#2a2c31', lines: [{ text: 'THIS SIDE UP IS A REQUEST', size: 0.75 }], px: 64 });
  slogan.position.set(x0 + 14, base + 2.6, zf + 0.12);
  g.add(slogan);
  const emp = signPlane('wh-employee', 2.6, 1.9, {
    w: 2.6,
    h: 1.9,
    bg: '#fbf8f1',
    fg: '#1d1e22',
    border: '#c7a24a',
    lines: [
      { text: 'EMPLOYEE OF', size: 0.28 },
      { text: 'THE MONTH', size: 0.28 },
      { text: '— RATCHET STRAP —', size: 0.22, color: '#d8242b' },
    ],
    px: 128,
  });
  emp.position.set(dx + doorW / 2 + 2.6, base + 3.2, zf + 0.12);
  g.add(emp);
  // Dock bumpers + stacked outbound cartons.
  for (let i = 0; i < 4; i++) g.add(boxAt(0.4, 0.5, 0.3, M.rubber(), x0 + 3 + i * 3, base + 1.2, zf + 0.25, 0.08));
  return g;
}

function crates(d: DecorItem, ctx: KitContext) {
  const g = new THREE.Group();
  const base = d.base ?? groundAt(ctx, d.x) + 0.14;
  const n = d.variant ?? 6;
  const mat = M.tex('carton-stack', cartonTex('standard', 'STACK', ctx.logo));
  const pallet = boxAt(1.4, 0.14, 1.1, M.tex('pallet', woodTex('#caa072')), d.x, base + 0.07, d.z ?? BACK, 0.01);
  g.add(pallet);
  let k = 0;
  for (let j = 0; j < 3 && k < n; j++)
    for (let i = 0; i < 2 - (j === 2 ? 1 : 0) && k < n; i++, k++) {
      const b = boxAt(0.62, 0.5, 0.9, mat, d.x - 0.33 + i * 0.66 + (j === 2 ? 0.33 : 0), base + 0.4 + j * 0.51, d.z ?? BACK, 0.03);
      b.rotation.y = ((k * 37) % 7) * 0.02 - 0.06;
      g.add(b);
    }
  return g;
}

function palm(d: DecorItem, ctx: KitContext) {
  const g = new THREE.Group();
  const h = d.h ?? 8;
  const base = d.base ?? groundAt(ctx, d.x) - 0.1;
  const trunkMat = M.matte('#8a6a4a');
  const bend = (d.variant ?? 1) * 0.6;
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(bend * 0.3, h * 0.35, 0),
    new THREE.Vector3(bend * 0.8, h * 0.7, 0),
    new THREE.Vector3(bend, h, 0),
  ]);
  const trunk = mesh(new THREE.TubeGeometry(curve, 12, 0.18, 8), trunkMat);
  g.add(trunk);
  // Ring bumps on the trunk.
  for (let i = 1; i < 10; i++) {
    const p = curve.getPoint(i / 10);
    const r = mesh(new THREE.TorusGeometry(0.19, 0.04, 5, 10), M.matte('#735538'), true, false);
    r.position.copy(p);
    r.rotation.x = Math.PI / 2;
    g.add(r);
  }
  const top = curve.getPoint(1);
  const frondMat = M.plastic('#3f8f3a');
  const frondMat2 = M.plastic('#2f7a33');
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + (d.variant ?? 0);
    const len = 3.2 + (i % 3) * 0.4;
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.quadraticCurveTo(len * 0.5, 0.55, len, 0.05);
    shape.quadraticCurveTo(len * 0.5, -0.25, 0, 0);
    const geo = new THREE.ShapeGeometry(shape, 6);
    // Droop the frond.
    const pos = geo.attributes.position;
    for (let k = 0; k < pos.count; k++) {
      const x = pos.getX(k);
      pos.setZ(k, 0);
      pos.setY(k, pos.getY(k) - (x * x) / (len * 2.2));
    }
    geo.computeVertexNormals();
    const f = mesh(geo, i % 2 ? frondMat : frondMat2, true, false);
    (f.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
    f.position.copy(top);
    f.rotation.y = a;
    f.rotation.x = -0.2;
    g.add(f);
  }
  for (let i = 0; i < 4; i++) {
    const c = mesh(new THREE.SphereGeometry(0.16, 8, 6), M.matte('#6b4a2a'));
    c.position.copy(top).add(new THREE.Vector3(Math.cos(i * 1.7) * 0.2, -0.25, Math.sin(i * 1.7) * 0.2));
    g.add(c);
  }
  g.position.set(d.x, base, d.z ?? -8);
  g.scale.setScalar(d.s ?? 1);
  // Gentle sway.
  const phase = d.x * 0.37;
  ctx.updaters.push((t) => {
    g.rotation.z = Math.sin(t * 0.8 + phase) * 0.012;
  });
  return g;
}

function streetLight(d: DecorItem, ctx: KitContext) {
  const g = new THREE.Group();
  const base = groundAt(ctx, d.x) + 0.14;
  const pole = M.satin('#3b3e45');
  g.add(boxAt(0.14, 6, 0.14, pole, 0, 3, 0, 0.06));
  const arm = boxAt(1.6, 0.1, 0.1, pole, 0.7, 5.95, 0, 0.04);
  g.add(arm);
  const lamp = boxAt(0.6, 0.18, 0.3, M.emissive('#ffe2b0', 1.2), 1.4, 5.85, 0, 0.06);
  g.add(lamp);
  g.position.set(d.x, base, d.z ?? BACK + 0.6);
  return g;
}

function sign(d: DecorItem, ctx: KitContext) {
  const g = new THREE.Group();
  const w = d.w ?? 3;
  const h = d.h ?? 1.6;
  const scheme = d.color ?? 'yellow';
  const schemes: Record<string, { bg: string; fg: string; border?: string; small?: string }> = {
    yellow: { bg: '#f3c01c', fg: '#1d1e22', border: '#1d1e22', small: '#1d1e22' },
    white: { bg: '#fbf8f1', fg: '#1d1e22', border: '#1d1e22', small: '#5b5b5b' },
    red: { bg: '#d8242b', fg: '#ffffff', border: '#ffffff', small: '#ffe3e3' },
    dark: { bg: '#1d1e22', fg: '#f3c01c', border: '#f3c01c', small: '#e9e4d6' },
    blue: { bg: '#1f5fae', fg: '#ffffff', border: '#ffffff', small: '#dce9ff' },
    green: { bg: '#23704a', fg: '#ffffff', border: '#ffffff', small: '#dff2e6' },
  };
  const s = schemes[scheme] ?? schemes.yellow;
  const lines: { text: string; size: number; weight?: string; color?: string; strike?: boolean }[] = [];
  const main = (d.text ?? '').split('|');
  for (const t of main) {
    const strike = t.startsWith('~');
    lines.push({ text: strike ? t.slice(1) : t, size: Math.min(0.42, (h * 0.62) / Math.max(1, main.length + (d.small ? 0.6 : 0))), strike });
  }
  if (d.small) lines.push({ text: d.small, size: Math.min(0.2, h * 0.16), weight: '600', color: s.small });
  const board = signPlane('sign-' + d.text + d.small + scheme + w + h, w, h, { w, h, bg: s.bg, fg: s.fg, border: s.border, lines, px: 160 });
  const back = boxAt(w + 0.08, h + 0.08, 0.08, M.satin('#44464c'), 0, 0, -0.06, 0.02);
  const face = new THREE.Group();
  face.add(back, board);
  board.position.z = 0;
  const postH = d.y ?? 1.4;
  const base = d.base ?? groundAt(ctx, d.x) + 0.14;
  face.position.y = postH + h / 2;
  g.add(face);
  if (postH > 0) {
    for (const px of w > 2.2 ? [-w / 2 + 0.3, w / 2 - 0.3] : [0]) g.add(boxAt(0.1, postH + h / 2, 0.1, M.satin('#6b6e75'), px, (postH + h / 2) / 2, -0.12, 0.03));
  }
  g.position.set(d.x, base, d.z ?? BACK + 0.4);
  g.rotation.y = d.rot ?? 0;
  return g;
}

interface BuildingOpts {
  x: number;
  w: number;
  h: number;
  depth: number;
  z: number;
  wall: string;
  trim: string;
  windows?: [number, number];
  awning?: [string, string];
  sign?: string;
  signColor?: string;
  signFg?: string;
  door?: string;
  roof?: 'flat' | 'pitched';
  roofColor?: string;
  base?: number;
}

function building(o: BuildingOpts, ctx: KitContext) {
  const g = new THREE.Group();
  const base = o.base ?? groundAt(ctx, o.x, o.w) - 0.05;
  const bottom = base - 6;
  const H = o.h + 6;
  const wallMat = M.tex('stucco' + o.wall, stuccoTex(o.wall), { roughness: 0.9 });
  const shell = texturedBox(o.w, H, o.depth, wallMat, 3);
  shell.position.set(o.x, bottom + H / 2, o.z - o.depth / 2);
  g.add(shell);
  const zf = o.z + 0.02;
  // Windows band.
  if (o.windows) {
    const [cols, rows] = o.windows;
    const wtex = windowsTex(`${cols}x${rows}${o.trim}`, cols, rows, o.trim, '#2e4a5f', 0.12);
    const wh = o.h - 1.8 - (o.awning ? 2.6 : 0.6);
    if (wh > 0.8) {
      const win = mesh(new THREE.PlaneGeometry(o.w - 1, wh), new THREE.MeshStandardMaterial({ map: wtex, roughness: 0.3, metalness: 0.2, emissive: '#ffcc88', emissiveMap: wtex, emissiveIntensity: 0.25 }), false, true);
      win.position.set(o.x, base + (o.awning ? 2.9 : 1.1) + wh / 2, zf);
      g.add(win);
    }
  }
  // Storefront glass + door.
  if (o.awning) {
    const glass = mesh(new THREE.PlaneGeometry(o.w - 1.6, 2.2), M.glass(), false, true);
    glass.position.set(o.x, base + 1.3, zf);
    g.add(glass);
    const aw = new THREE.Mesh(new THREE.PlaneGeometry(o.w - 0.6, 1.4), new THREE.MeshStandardMaterial({ map: awningTex(o.awning[0], o.awning[1]), side: THREE.DoubleSide, roughness: 0.8 }));
    const at = aw.material.map!;
    at.repeat.set((o.w - 0.6) / 2, 1);
    aw.castShadow = true;
    aw.position.set(o.x, base + 2.95, zf + 0.6);
    aw.rotation.x = -0.9;
    g.add(aw);
  }
  if (o.door) {
    const door = boxAt(1.1, 2.1, 0.1, M.satin(o.door), o.x + o.w / 2 - 1.6, base + 1.05, zf + 0.02, 0.02);
    g.add(door);
  }
  // Parapet / roof.
  if (o.roof === 'pitched') {
    const roofShape = new THREE.Shape();
    roofShape.moveTo(-o.w / 2 - 0.4, 0);
    roofShape.lineTo(o.w / 2 + 0.4, 0);
    roofShape.lineTo(0, Math.min(3.2, o.w * 0.35));
    roofShape.closePath();
    const rg = new THREE.ExtrudeGeometry(roofShape, { depth: o.depth + 0.6, bevelEnabled: false });
    rg.translate(0, 0, -(o.depth + 0.6));
    const roof = mesh(rg, M.satin(o.roofColor ?? '#b0553a'));
    roof.position.set(o.x, base + o.h, o.z + 0.3);
    g.add(roof);
  } else {
    g.add(boxAt(o.w + 0.3, 0.45, o.depth + 0.3, M.satin(o.trim), o.x, base + o.h, o.z - o.depth / 2, 0.06));
  }
  if (o.sign) {
    const sw = Math.min(o.w - 1, o.sign.length * 0.55 + 1.5);
    const s = signPlane('bsign' + o.sign + o.signColor, sw, 1.1, {
      w: sw,
      h: 1.1,
      bg: o.signColor ?? '#1d1e22',
      fg: o.signFg ?? '#fbf8f1',
      lines: [{ text: o.sign, size: 0.62 }],
      px: 96,
    });
    s.position.set(o.x, base + (o.awning ? 3.9 : o.h - 0.9), zf + 0.08);
    g.add(s);
  }
  return g;
}

function shop(d: DecorItem, ctx: KitContext) {
  const palettes = [
    { wall: '#f1d9b5', trim: '#e0632b', awning: ['#e0632b', '#fbf1e0'] as [string, string] },
    { wall: '#bfe0de', trim: '#1f5fae', awning: ['#1f5fae', '#f4f7fb'] as [string, string] },
    { wall: '#f6c9c0', trim: '#2a7a6a', awning: ['#2a7a6a', '#fff4ea'] as [string, string] },
    { wall: '#fff0c9', trim: '#d8242b', awning: ['#d8242b', '#fffaf0'] as [string, string] },
    { wall: '#d9d3f0', trim: '#5a4aa0', awning: ['#5a4aa0', '#faf8ff'] as [string, string] },
  ];
  const p = palettes[(d.variant ?? 0) % palettes.length];
  return building(
    {
      x: d.x,
      w: d.w ?? 12,
      h: d.h ?? 7,
      depth: d.d ?? 9,
      z: d.z ?? BACK - 1,
      wall: d.color ?? p.wall,
      trim: p.trim,
      awning: p.awning,
      windows: [Math.round((d.w ?? 12) / 2.2), 1],
      sign: d.text,
      signColor: p.trim,
      door: '#2a2c31',
    },
    ctx,
  );
}

function house(d: DecorItem, ctx: KitContext) {
  const walls = ['#f4efe3', '#e8d6bf', '#cfe0e8', '#f1dfe3', '#e3ead0', '#fff6dd'];
  const roofs = ['#8e4a3a', '#5b6570', '#a0643e', '#4e5a4a', '#7a3e3e', '#6a5a4a'];
  const v = d.variant ?? 0;
  return building(
    {
      x: d.x,
      w: d.w ?? 10,
      h: d.h ?? 4.2,
      depth: d.d ?? 8,
      z: d.z ?? BACK - 3,
      wall: walls[v % walls.length],
      trim: '#fbfaf7',
      windows: [3, 1],
      door: ['#2f5f8f', '#8f2f2f', '#2f6f4f'][v % 3],
      roof: 'pitched',
      roofColor: roofs[v % roofs.length],
    },
    ctx,
  );
}

function apartment(d: DecorItem, ctx: KitContext) {
  return building(
    {
      x: d.x,
      w: d.w ?? 16,
      h: d.h ?? 13,
      depth: d.d ?? 12,
      z: d.z ?? -20,
      wall: d.color ?? '#efe2cf',
      trim: '#8a7d6a',
      windows: [6, 4],
    },
    ctx,
  );
}

/** Building mass under an elevated gameplay slab (lower road runs in front). */
function underBuilding(d: DecorItem, ctx: KitContext) {
  const g = new THREE.Group();
  const w = d.w ?? 30;
  const top = d.y ?? 4;
  const base = groundAt(ctx, d.x + w / 2, w) - 0.1;
  const H = top - base + 6;
  const zf = -2.7;
  const depth = 10;
  const wallMat = M.tex('stucco' + (d.color ?? '#e9c7a0'), stuccoTex(d.color ?? '#e9c7a0'), { roughness: 0.9 });
  const shell = texturedBox(w, H - 0.02, depth, wallMat, 3);
  shell.position.set(d.x + w / 2, base - 6 + H / 2, zf - depth / 2);
  g.add(shell);
  // The building's roof is continuous with the drivable slab.
  const roofTop = mesh(new THREE.PlaneGeometry(w, depth), M.tex(d.variant === 1 ? 'terrace-top' : 'roof-top', d.variant === 1 ? tileTex('#efe6d6', '#cdbfa8', 42) : roofTex(), { roughness: 0.95 }), false, true);
  roofTop.rotation.x = -Math.PI / 2;
  roofTop.position.set(d.x + w / 2, top - 0.01, zf - depth / 2);
  // Scale UVs (not the shared texture's repeat) so tiling matches the slab.
  const ruv = roofTop.geometry.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < ruv.count; i++) ruv.setXY(i, (ruv.getX(i) * w) / 3, (ruv.getY(i) * depth) / 3);
  if (d.variant !== 1) g.add(roofTop);
  // Covered carport: dark recess + columns + ceiling lights.
  const recess = mesh(new THREE.PlaneGeometry(w - 0.6, top - base - 0.5), M.matte('#4a403a'), false, true);
  recess.position.set(d.x + w / 2, base + (top - base - 0.5) / 2, zf + 0.03);
  g.add(recess);
  for (let x = d.x + 1; x < d.x + w; x += 6.5) {
    g.add(boxAt(0.45, top - base, 0.45, M.tex('col', concreteTex('#e8e1d4')), x, base + (top - base) / 2, zf + 0.25, 0.05));
  }
  for (let x = d.x + 3; x < d.x + w - 1; x += 6.5) {
    g.add(boxAt(1.2, 0.06, 0.3, M.emissive('#fff0d0', 1.4), x, top - 0.55, 0.6, 0.02));
  }
  if (d.variant === 1) return g;
  // Parapet at the back of the roof + rooftop clutter (AC units, vents).
  g.add(boxAt(w, 0.9, 0.3, M.tex('parapet', concreteTex('#e7ddcc')), d.x + w / 2, top + 0.45, zf - depth + 0.15, 0.04));
  for (let x = d.x + 4; x < d.x + w - 3; x += 7.5) {
    const zz = zf - 4 - ((x * 7) % 3);
    g.add(boxAt(1.4, 0.9, 1.2, M.metal('#b8bcc2'), x, top + 0.45, zz, 0.08));
    const fan = mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.05, 16), M.satin('#3a3d44'));
    fan.position.set(x, top + 0.93, zz);
    g.add(fan);
    const vent = mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.8, 8), M.metal('#9aa0a8'));
    vent.position.set(x + 3, top + 0.4, zz - 1.5);
    g.add(vent);
  }
  if (d.text) {
    // Rooftop billboard at the back of the roof.
    const s = signPlane('ub' + d.text, 9, 1.8, { w: 9, h: 1.8, bg: '#1f5fae', fg: '#fff', border: '#f3c01c', lines: [{ text: d.text, size: 0.9 }], px: 96 });
    s.position.set(d.x + w / 2, top + 3.2, zf - depth + 0.6);
    g.add(s);
    g.add(boxAt(9.2, 1.9, 0.1, M.satin('#2a2c31'), d.x + w / 2, top + 3.2, zf - depth + 0.52, 0.02));
    for (const s2 of [-3.5, 3.5]) g.add(boxAt(0.14, 2.4, 0.14, M.satin('#2a2c31'), d.x + w / 2 + s2, top + 1.2, zf - depth + 0.5, 0.03));
  }
  return g;
}

function motel(d: DecorItem, ctx: KitContext) {
  const g = new THREE.Group();
  const w = d.w ?? 44;
  const base = d.base ?? groundAt(ctx, d.x + w / 2, w);
  const floors = 2;
  const fh = 3.2;
  const zf = d.z ?? -8.5;
  const wallMat = M.tex('stucco-motel', stuccoTex('#f5d7b8'), { roughness: 0.9 });
  const H = floors * fh + 8;
  const shell = texturedBox(w, H, 9, wallMat, 3);
  shell.position.set(d.x + w / 2, base - 8 + H / 2, zf - 4.5);
  g.add(shell);
  // Doors + windows per room, balcony walkway with railing.
  for (let f = 0; f < floors; f++) {
    const y = base + f * fh;
    for (let x = d.x + 2; x < d.x + w - 2; x += 4.4) {
      g.add(boxAt(1.0, 2.1, 0.08, M.satin(['#2a8a9a', '#e0632b', '#f3c01c'][Math.floor(x) % 3]), x, y + 1.05, zf + 0.04, 0.02));
      const win = mesh(new THREE.PlaneGeometry(1.5, 1.1), M.emissive('#ffd9a0', 0.35), false, false);
      win.position.set(x + 1.6, y + 1.5, zf + 0.03);
      g.add(win);
      const n = signPlane('room' + f + Math.floor(x), 0.5, 0.3, { w: 0.5, h: 0.3, bg: '#fbf8f1', fg: '#1d1e22', lines: [{ text: `${f + 1}${String(Math.floor((x - d.x) / 4.4) + 1).padStart(2, '0')}`, size: 0.2 }], px: 128 });
      n.position.set(x, y + 2.35, zf + 0.06);
      g.add(n);
    }
    if (f > 0) {
      g.add(boxAt(w, 0.25, 1.6, M.tex('walkway', concreteTex('#e8ddd0')), d.x + w / 2, y - 0.1, zf + 0.8, 0.03));
      g.add(boxAt(w, 0.08, 0.08, M.paint('#1f8fa0'), d.x + w / 2, y + 1.0, zf + 1.55, 0.02));
      for (let x = d.x + 0.5; x < d.x + w; x += 1.2) g.add(boxAt(0.05, 1.0, 0.05, M.paint('#1f8fa0'), x, y + 0.5, zf + 1.55, 0.01));
    }
  }
  g.add(boxAt(w + 0.8, 0.5, 10, M.satin('#e07a4a'), d.x + w / 2, base + floors * fh + 0.2, zf - 4.5, 0.08));
  // The sign.
  const sx = d.x + (d.variant === 1 ? w - 5 : 5);
  const pole = boxAt(0.5, 14, 0.5, M.satin('#e7e2d9'), sx, base + 7, zf + 1.2, 0.1);
  g.add(pole);
  const sunsetTex = signTex('motel-sign', {
    w: 6,
    h: 3,
    bg: '#1f7f8f',
    fg: '#ffe6c2',
    border: '#ffb04a',
    lines: [
      { text: 'Sunset', size: 1.25, weight: 'italic 800', color: '#ffd07a' },
      { text: 'MOTEL', size: 0.95, color: '#fff4e4' },
    ],
    px: 96,
  });
  const signMat = new THREE.MeshStandardMaterial({ map: sunsetTex, emissive: '#ffffff', emissiveMap: sunsetTex, emissiveIntensity: 0.5, roughness: 0.5 });
  const board = mesh(new RoundedBoxGeometry(6.2, 3.2, 0.4, 3, 0.2), signMat);
  board.position.set(sx, base + 12.4, zf + 1.2);
  g.add(board);
  const sub = signPlane('motel-sub', 4.2, 1.6, {
    w: 4.2,
    h: 1.6,
    bg: '#fbf1e0',
    fg: '#1d1e22',
    border: '#1f7f8f',
    lines: [
      { text: 'POOL / PARKING', size: 0.42 },
      { text: 'PLEASE STOP', size: 0.5, color: '#d8242b' },
    ],
    px: 128,
  });
  sub.position.set(sx, base + 9.6, zf + 1.42);
  g.add(sub);
  const vac = signPlane('motel-vac', 2.4, 0.6, { w: 2.4, h: 0.6, bg: '#1d1e22', fg: '#ff4a6a', lines: [{ text: 'VACANCY', size: 0.42 }], px: 128 }, 1.6);
  vac.position.set(sx, base + 8.3, zf + 1.42);
  g.add(vac);
  const vm = vac.material as THREE.MeshStandardMaterial;
  ctx.updaters.push((t) => {
    vm.emissiveIntensity = Math.sin(t * 3) > -0.6 ? 1.6 : 0.2;
  });
  return g;
}

function poolDeck(d: DecorItem, ctx: KitContext) {
  // Loungers, umbrellas and railing on an elevated terrace.
  const g = new THREE.Group();
  const y = d.y ?? 4.2;
  const w = d.w ?? 40;
  // Back deck extension (non-gameplay).
  const deck = texturedBox(w, 0.6, 7, M.tex('terrace-back', tileTex('#efe6d6', '#cdbfa8', 42)), 3);
  deck.position.set(d.x + w / 2, y - 0.3, -2.6 - 3.5);
  g.add(deck);
  for (let i = 0; i < 4; i++) {
    const lx = d.x + 3 + i * (w / 4);
    const lounger = new THREE.Group();
    lounger.add(boxAt(1.9, 0.12, 0.7, M.plastic('#fbfaf7'), 0, 0.35, 0, 0.04));
    const back = boxAt(0.8, 0.1, 0.7, M.plastic('#fbfaf7'), -0.95, 0.6, 0, 0.04);
    back.rotation.z = 0.7;
    lounger.add(back);
    lounger.add(boxAt(1.6, 0.06, 0.66, M.plastic(['#ff7a7a', '#2aa7c9', '#f3c01c', '#7ac98a'][i]), 0.1, 0.44, 0, 0.03));
    lounger.position.set(lx, y, -4.8);
    g.add(lounger);
    if (i % 2 === 0) {
      const pole = boxAt(0.06, 2.4, 0.06, M.metal(), lx + 1.6, y + 1.2, -5.2, 0.02);
      const shade = mesh(new THREE.ConeGeometry(1.4, 0.6, 8, 1, true), M.plastic(['#d8242b', '#1f7f8f'][i / 2]));
      (shade.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
      shade.position.set(lx + 1.6, y + 2.5, -5.2);
      g.add(pole, shade);
    }
  }
  return g;
}

function railing(d: DecorItem, _ctx: KitContext) {
  const g = new THREE.Group();
  const w = d.w ?? 10;
  const y = d.y ?? 0;
  const z = d.z ?? 2.7;
  const mat = M.paint(d.color ?? '#1f8fa0');
  g.add(boxAt(w, 0.07, 0.07, mat, d.x + w / 2, y + 1.0, z, 0.02));
  g.add(boxAt(w, 0.05, 0.05, mat, d.x + w / 2, y + 0.5, z, 0.02));
  for (let x = d.x; x <= d.x + w + 1e-6; x += 1.4) g.add(boxAt(0.06, 1.0, 0.06, mat, x, y + 0.5, z, 0.02));
  return g;
}

function flamingoFloat(d: DecorItem, ctx: KitContext) {
  const g = new THREE.Group();
  const pink = M.paint('#f07aa8');
  const ring = mesh(new THREE.TorusGeometry(0.7, 0.28, 12, 24), pink);
  ring.rotation.x = Math.PI / 2;
  g.add(ring);
  const neck = new THREE.CatmullRomCurve3([new THREE.Vector3(0.6, 0, 0), new THREE.Vector3(0.9, 0.6, 0), new THREE.Vector3(0.6, 1.1, 0), new THREE.Vector3(0.8, 1.4, 0)]);
  g.add(mesh(new THREE.TubeGeometry(neck, 16, 0.14, 8), pink));
  const head = mesh(new THREE.SphereGeometry(0.2, 12, 10), pink);
  head.position.set(0.85, 1.45, 0);
  g.add(head);
  const beak = mesh(new THREE.ConeGeometry(0.08, 0.3, 8), M.matte('#1c1c1c'));
  beak.rotation.z = -2.2;
  beak.position.set(1.05, 1.35, 0);
  g.add(beak);
  g.position.set(d.x, d.y ?? 4, d.z ?? -1.4);
  g.scale.setScalar(d.s ?? 1);
  ctx.updaters.push((t) => {
    g.position.y = (d.y ?? 4) + Math.sin(t * 1.3) * 0.05;
    g.rotation.y = Math.sin(t * 0.4) * 0.5;
  });
  return g;
}

function ferris(d: DecorItem, ctx: KitContext) {
  const g = new THREE.Group();
  const r = d.s ?? 14;
  const wheel = new THREE.Group();
  const white = M.satin('#fbfaf7');
  wheel.add(mesh(new THREE.TorusGeometry(r, 0.25, 8, 64), white, false, false));
  wheel.add(mesh(new THREE.TorusGeometry(r * 0.96, 0.12, 6, 64), M.satin('#d8242b'), false, false));
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const sp = mesh(new THREE.BoxGeometry(0.12, r * 2, 0.12), white, false, false);
    sp.rotation.z = a;
    wheel.add(sp);
  }
  const cars: THREE.Mesh[] = [];
  for (let i = 0; i < 16; i++) {
    const c = mesh(new RoundedBoxGeometry(1.4, 1.2, 1.2, 2, 0.2), M.plastic(['#f3c01c', '#2aa7c9', '#d8242b', '#7ac98a'][i % 4]), false, false);
    cars.push(c);
    wheel.add(c);
  }
  g.add(wheel);
  for (const s of [-1, 1]) {
    const leg = mesh(new THREE.BoxGeometry(0.5, r * 1.25, 0.5), white, false, false);
    leg.position.set(s * r * 0.3, -r * 0.55, 0);
    leg.rotation.z = s * 0.3;
    g.add(leg);
  }
  const base = d.y ?? 0;
  g.position.set(d.x, base + r * 1.15, d.z ?? -160);
  ctx.updaters.push((t) => {
    wheel.rotation.z = t * 0.06;
    for (let i = 0; i < cars.length; i++) {
      const a = (i / cars.length) * Math.PI * 2 + wheel.rotation.z;
      cars[i].position.set(Math.cos(a) * r, Math.sin(a) * r - 0.8, 0);
      cars[i].rotation.z = -wheel.rotation.z;
    }
  });
  return g;
}

function pier(d: DecorItem, _ctx: KitContext) {
  const g = new THREE.Group();
  const len = d.w ?? 120;
  const z = d.z ?? -150;
  const y = d.y ?? 1.5;
  const wood = M.tex('pier-wood', woodTex('#9c7650'));
  const deckM = texturedBox(len, 0.5, 14, wood, 3);
  deckM.position.set(d.x + len / 2, y, z);
  deckM.castShadow = false;
  g.add(deckM);
  for (let x = d.x; x < d.x + len; x += 6) {
    for (const zz of [-6, 6]) {
      const p = mesh(new THREE.CylinderGeometry(0.35, 0.35, 8, 8), M.matte('#6b5038'), false, false);
      p.position.set(x, y - 4, z + zz);
      g.add(p);
    }
  }
  // Little stalls on the pier.
  for (let x = d.x + 8; x < d.x + len - 8; x += 18) {
    g.add(boxAt(6, 3.2, 5, M.plastic(['#fbf1e0', '#e8f4f8', '#fff0f0'][Math.floor(x) % 3]), x, y + 1.85, z, 0.1));
    const roof = boxAt(6.6, 0.4, 5.6, M.plastic(['#d8242b', '#1f7f8f', '#f3c01c'][Math.floor(x) % 3]), x, y + 3.6, z, 0.1);
    g.add(roof);
  }
  return g;
}

function hills(d: DecorItem, _ctx: KitContext) {
  const g = new THREE.Group();
  const colors = ['#9aa88a', '#b3a98a', '#8f9f86'];
  for (let i = 0; i < (d.variant ?? 8); i++) {
    const r = 40 + ((i * 53) % 40);
    const h = mesh(new THREE.SphereGeometry(r, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), M.matte(colors[i % 3]), false, false);
    h.scale.set(1.6, 0.35 + ((i * 17) % 10) / 40, 1);
    h.position.set(d.x + i * 90, -2, (d.z ?? -330) - ((i * 37) % 60));
    g.add(h);
  }
  return g;
}

function clouds(d: DecorItem, _ctx: KitContext) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: '#fff6ea', roughness: 1, emissive: '#ffd9b0', emissiveIntensity: 0.15 });
  for (let i = 0; i < (d.variant ?? 10); i++) {
    const c = new THREE.Group();
    for (let k = 0; k < 5; k++) {
      const s = mesh(new THREE.SphereGeometry(6 + (k % 3) * 2.5, 12, 8), mat, false, false);
      s.position.set(k * 7 - 14, Math.sin(k * 1.3) * 2, 0);
      s.scale.y = 0.6;
      c.add(s);
    }
    c.position.set(d.x + i * 70 + ((i * 31) % 20), 55 + ((i * 13) % 25), -260 - ((i * 47) % 120));
    g.add(c);
  }
  return g;
}

function handTruck(d: DecorItem, ctx: KitContext) {
  const g = new THREE.Group();
  const base = d.base ?? groundAt(ctx, d.x);
  const red = M.paint('#d8242b');
  g.add(boxAt(0.08, 1.3, 0.08, red, -0.2, 0.75, -0.2, 0.02), boxAt(0.08, 1.3, 0.08, red, -0.2, 0.75, 0.2, 0.02));
  g.add(boxAt(0.4, 0.05, 0.45, M.metal(), 0.0, 0.1, 0, 0.01));
  for (const z of [-0.25, 0.25]) {
    const wh = mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.08, 12).rotateX(Math.PI / 2), M.rubber());
    wh.position.set(-0.2, 0.14, z);
    g.add(wh);
  }
  g.rotation.z = 0.2;
  g.position.set(d.x, base, d.z ?? -2.8);
  return g;
}

function person(d: DecorItem, ctx: KitContext) {
  // Stylised background figure: clerk, gull-watcher, HOA inspector...
  const g = new THREE.Group();
  const base = d.base ?? groundAt(ctx, d.x) + 0.14;
  const shirt = M.satin(d.color ?? '#1f7f8f');
  g.add(boxAt(0.4, 0.8, 0.28, M.satin('#33363d'), 0, 0.4, 0, 0.08));
  g.add(boxAt(0.46, 0.7, 0.3, shirt, 0, 1.15, 0, 0.12));
  const head = mesh(new THREE.SphereGeometry(0.17, 14, 12), M.matte('#e8b98f'));
  head.position.y = 1.7;
  g.add(head);
  const cap = mesh(new THREE.SphereGeometry(0.18, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), M.satin(d.variant === 1 ? '#f3c01c' : '#d8242b'));
  cap.position.y = 1.74;
  g.add(cap);
  const clip = boxAt(0.25, 0.32, 0.03, M.satin('#8a6a4a'), 0.2, 1.15, 0.18, 0.01);
  clip.rotation.x = -0.4;
  g.add(clip);
  const arm = boxAt(0.12, 0.55, 0.12, shirt, 0.25, 1.4, 0, 0.05);
  arm.rotation.z = 0.2;
  g.add(arm);
  g.position.set(d.x, base, d.z ?? -3.4);
  g.rotation.y = d.rot ?? 0.4;
  const phase = d.x;
  ctx.updaters.push((t) => {
    // The clerk waves occasionally.
    arm.rotation.z = 0.2 + Math.max(0, Math.sin(t * 1.4 + phase)) * 2.4;
    arm.position.y = 1.4 + Math.max(0, Math.sin(t * 1.4 + phase)) * 0.2;
  });
  return g;
}

function bayPad(d: DecorItem, ctx: KitContext) {
  const g = new THREE.Group();
  const w = d.w ?? 14;
  const y = groundAt(ctx, d.x + w / 2) + 0.012;
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const k = c.getContext('2d')!;
  k.fillStyle = 'rgba(0,0,0,0)';
  k.clearRect(0, 0, 512, 256);
  k.strokeStyle = '#f3c01c';
  k.lineWidth = 14;
  k.strokeRect(10, 10, 492, 236);
  k.lineWidth = 10;
  for (let x = -256; x < 512; x += 48) {
    k.beginPath();
    k.moveTo(x, 246);
    k.lineTo(x + 60, 10);
    k.stroke();
  }
  k.clearRect(150, 70, 212, 116);
  k.fillStyle = '#f3c01c';
  k.font = `800 64px "Barlow Condensed", Arial`;
  k.textAlign = 'center';
  k.fillText('DELIVER', 256, 150);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, 4.4), new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -2 }));
  m.rotation.x = -Math.PI / 2;
  m.position.set(d.x + w / 2, y, 0);
  m.receiveShadow = true;
  g.add(m);
  return g;
}

function rollerDoor(d: DecorItem, ctx: KitContext) {
  // Receiving door on the face of an end wall.
  const g = new THREE.Group();
  const base = groundAt(ctx, d.x - 1);
  const door = texturedBox(0.1, 4.2, 4.2, M.tex('rolldoor', corrugatedTex('#c9cdd2'), { metalness: 0.3, roughness: 0.6 }), 1);
  door.position.set(d.x - 0.03, base + 2.1, 0);
  g.add(door);
  for (const z of [-2.2, 2.2]) g.add(boxAt(0.2, 4.4, 0.25, M.satin('#f3c01c'), d.x - 0.05, base + 2.2, z, 0.04));
  const knock = signPlane('knock', 3.2, 0.9, {
    w: 3.2,
    h: 0.9,
    bg: '#fbf8f1',
    fg: '#1d1e22',
    border: '#d8242b',
    lines: [
      { text: 'RECEIVING', size: 0.3, color: '#d8242b' },
      { text: 'KNOCK. NOT WITH VEHICLE.', size: 0.24 },
    ],
    px: 160,
  });
  knock.position.set(d.x - 0.1, base + 4.9, 0);
  knock.rotation.y = -Math.PI / 2;
  g.add(knock);
  const light = boxAt(0.2, 0.2, 0.6, M.emissive('#fff0c8', 2), d.x - 0.2, base + 4.4, 0, 0.05);
  g.add(light);
  return g;
}

function cones(d: DecorItem, ctx: KitContext) {
  const g = new THREE.Group();
  const n = d.variant ?? 3;
  for (let i = 0; i < n; i++) {
    const x = d.x + i * 1.2;
    const base = groundAt(ctx, x) + 0.14;
    const c = mesh(new THREE.ConeGeometry(0.22, 0.7, 12), M.plastic('#f26a1b'));
    c.position.set(x, base + 0.35, d.z ?? BACK + 0.9);
    const band = mesh(new THREE.CylinderGeometry(0.13, 0.16, 0.12, 12), M.plastic('#fbfaf7'));
    band.position.set(x, base + 0.42, d.z ?? BACK + 0.9);
    g.add(c, band);
  }
  return g;
}

function hedge(d: DecorItem, ctx: KitContext) {
  const g = new THREE.Group();
  const w = d.w ?? 6;
  const base = groundAt(ctx, d.x + w / 2, w) + 0.1;
  const mat = M.tex('hedge', grassTex(), { roughness: 1, color: new THREE.Color('#5f8f45') });
  const h = mesh(new RoundedBoxGeometry(w, d.h ?? 1.2, d.d ?? 1.1, 3, 0.4), mat);
  h.position.set(d.x + w / 2, base + (d.h ?? 1.2) / 2, d.z ?? BACK + 0.2);
  g.add(h);
  return g;
}

function fence(d: DecorItem, ctx: KitContext) {
  const g = new THREE.Group();
  const w = d.w ?? 10;
  const mat = M.plastic(d.color ?? '#fbfaf7');
  for (let x = d.x; x <= d.x + w; x += 0.35) {
    const base = groundAt(ctx, x) + 0.1;
    g.add(boxAt(0.12, 1.0, 0.04, mat, x, base + 0.5, d.z ?? BACK - 0.1, 0.02));
  }
  const base = groundAt(ctx, d.x + w / 2, w) + 0.1;
  g.add(boxAt(w, 0.08, 0.05, mat, d.x + w / 2, base + 0.75, (d.z ?? BACK - 0.1) - 0.04, 0.01));
  return g;
}

function tree(d: DecorItem, ctx: KitContext) {
  const g = new THREE.Group();
  const base = d.base ?? groundAt(ctx, d.x);
  const h = d.h ?? 5;
  g.add(boxAt(0.35, h * 0.55, 0.35, M.matte('#7a5a3a'), 0, h * 0.27, 0, 0.12));
  const leaf = M.plastic(['#4f8f3f', '#3f7f45', '#6a9f3f'][(d.variant ?? 0) % 3]);
  for (let i = 0; i < 4; i++) {
    const s = mesh(new THREE.IcosahedronGeometry(h * 0.28 - i * 0.1, 1), leaf);
    s.position.set(Math.sin(i * 2.1) * 0.6, h * 0.62 + i * 0.35, Math.cos(i * 2.1) * 0.5);
    g.add(s);
  }
  g.position.set(d.x, base, d.z ?? -9);
  g.scale.setScalar(d.s ?? 1);
  return g;
}

function trampoline(d: DecorItem, ctx: KitContext) {
  const g = new THREE.Group();
  const base = groundAt(ctx, d.x) + 0.1;
  const mat = mesh(new THREE.CylinderGeometry(1.6, 1.6, 0.05, 24), M.matte('#1d1e22'));
  mat.position.y = 0.8;
  g.add(mat);
  const rim = mesh(new THREE.TorusGeometry(1.65, 0.1, 8, 24), M.plastic('#2aa7c9'));
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.8;
  g.add(rim);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    g.add(boxAt(0.06, 0.8, 0.06, M.metal('#6b6e75'), Math.cos(a) * 1.6, 0.4, Math.sin(a) * 1.6, 0.02));
  }
  g.position.set(d.x, base, d.z ?? -9);
  return g;
}

function boat(d: DecorItem, ctx: KitContext) {
  const g = new THREE.Group();
  const hull = mesh(new RoundedBoxGeometry(6, 1.2, 2.2, 3, 0.5), M.paint(d.color ?? '#fbfaf7'), false, false);
  g.add(hull);
  const cab = boxAt(2, 1.2, 1.6, M.paint('#1f5fae'), -0.5, 1.1, 0, 0.2);
  g.add(cab);
  g.position.set(d.x, -3, d.z ?? -120);
  const phase = d.x * 0.1;
  ctx.updaters.push((t) => {
    g.position.y = -3 + Math.sin(t * 0.9 + phase) * 0.15;
    g.rotation.z = Math.sin(t * 0.7 + phase) * 0.03;
  });
  return g;
}

function gull(d: DecorItem, ctx: KitContext) {
  const g = new THREE.Group();
  const body = mesh(new THREE.SphereGeometry(0.2, 10, 8), M.matte('#fbfaf7'));
  body.scale.set(1.6, 0.9, 0.9);
  g.add(body);
  const head = mesh(new THREE.SphereGeometry(0.11, 10, 8), M.matte('#fbfaf7'));
  head.position.set(0.3, 0.15, 0);
  g.add(head);
  const beak = mesh(new THREE.ConeGeometry(0.03, 0.14, 6), M.matte('#f3c01c'));
  beak.rotation.z = -Math.PI / 2;
  beak.position.set(0.45, 0.14, 0);
  g.add(beak);
  const wings: THREE.Mesh[] = [];
  for (const s of [-1, 1]) {
    const w = mesh(new THREE.BoxGeometry(0.3, 0.03, 0.7), M.matte('#b9bec4'));
    w.position.set(0, 0.05, s * 0.35);
    wings.push(w);
    g.add(w);
  }
  const perch = d.variant === 1;
  const baseY = d.y ?? 6;
  g.position.set(d.x, baseY, d.z ?? -6);
  const phase = d.x;
  let launched = -1;
  ctx.updaters.push((t, focusX) => {
    if (perch) {
      // Scatter when a vehicle comes close; resettle once it is gone.
      if (launched < 0 && Math.abs(focusX - d.x) < 7) launched = t;
      if (launched >= 0 && Math.abs(focusX - d.x) > 40) launched = -1;
      if (launched >= 0) {
        const k = t - launched;
        g.position.set(d.x + k * 5, baseY + k * 3.5 + k * k * 0.6, (d.z ?? -6) - k * 4);
        g.rotation.y = -0.6;
        for (const [i, w] of wings.entries()) w.rotation.x = Math.sin(t * 16) * 0.8 * (i ? 1 : -1);
        return;
      }
      g.position.set(d.x, baseY, d.z ?? -6);
      for (const w of wings) w.rotation.x = 0;
      g.rotation.y = Math.sin(t * 0.5 + phase) * 0.6;
      head.position.y = 0.15 + Math.max(0, Math.sin(t * 2 + phase)) * 0.05;
      return;
    }
    const a = t * 0.25 + phase;
    g.position.set(d.x + Math.cos(a) * 12, baseY + Math.sin(a * 2) * 1.5, (d.z ?? -20) + Math.sin(a) * 6);
    g.rotation.y = -a;
    for (const [i, w] of wings.entries()) w.rotation.x = Math.sin(t * 8 + phase) * 0.6 * (i ? 1 : -1);
  });
  return g;
}

function seeded(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Rows of background buildings and palms so the town reads as a place. */
function townFill(d: DecorItem, ctx: KitContext) {
  const g = new THREE.Group();
  const r = seeded(d.variant ?? 7);
  const x1 = d.x + (d.w ?? 100);
  const style = d.text ?? 'coast';
  const colors =
    style === 'suburb'
      ? ['#f4efe3', '#e8d6bf', '#cfe0e8', '#f1dfe3', '#e3ead0']
      : ['#f0dcc4', '#e3eef0', '#f6d6c8', '#f2e2cc', '#fbe9c6', '#d8e8e0', '#f7cfc0'];
  // Row 1 (mid-distance) and row 2 (far).
  for (const [zBase, hMin, hMax, gap] of [
    [-22, 8, 16, 2],
    [-40, 12, 26, 4],
  ] as const) {
    let x = d.x + r() * 6;
    while (x < x1) {
      const w = 10 + r() * 10;
      const h = hMin + r() * (hMax - hMin);
      if (style === 'suburb' && zBase === -22) {
        g.add(house({ kind: 'house', x: x + w / 2, w: Math.min(w, 13), z: zBase + 6, variant: Math.floor(r() * 6) }, ctx));
      } else {
        g.add(apartment({ kind: 'apartment', x: x + w / 2, w, h, z: zBase - r() * 6, color: colors[Math.floor(r() * colors.length)] }, ctx));
      }
      x += w + gap + r() * 6;
    }
  }
  // Palm / tree line between the street and row 1.
  for (let x = d.x + 4; x < x1; x += 9 + r() * 9) {
    if (style === 'suburb') g.add(tree({ kind: 'tree', x, z: -13 - r() * 4, h: 4.5 + r() * 2, variant: Math.floor(r() * 3) }, ctx));
    else g.add(palm({ kind: 'palm', x, z: -12 - r() * 5, h: 7 + r() * 4, variant: r() < 0.5 ? -1 : 1 }, ctx));
  }
  return g;
}

/** Sparse, low foreground dressing (never tall enough to hide the road). */
function frontFill(d: DecorItem, ctx: KitContext) {
  const g = new THREE.Group();
  const r = seeded(d.variant ?? 3);
  const x1 = d.x + (d.w ?? 100);
  const flowerCols = ['#f07aa8', '#f3c01c', '#ff7a5a', '#fbfaf7', '#b48cf0'];
  for (let x = d.x + r() * 8; x < x1; x += 7 + r() * 12) {
    const base = groundAt(ctx, x) - 0.25;
    const z = 4 + r() * 3;
    const pick = r();
    if (pick < 0.4) {
      // Hedge with flowers.
      const w = 1.6 + r() * 2.2;
      const hedgeMat = M.plastic(['#4f8a3f', '#5b9447', '#44803a'][Math.floor(r() * 3)]);
      const hdg = mesh(new RoundedBoxGeometry(w, 0.7, 0.9, 3, 0.3), hedgeMat);
      hdg.position.set(x, base + 0.35, z);
      g.add(hdg);
      const fc = M.plastic(flowerCols[Math.floor(r() * flowerCols.length)]);
      for (let i = 0; i < 6; i++) {
        const f = mesh(new THREE.SphereGeometry(0.09, 6, 5), fc, false, false);
        f.position.set(x - w / 2 + 0.2 + r() * (w - 0.4), base + 0.72, z - 0.3 + r() * 0.6);
        g.add(f);
      }
    } else if (pick < 0.8) {
      // Round shrub cluster.
      const mat = M.plastic(['#5f9a45', '#4f8a3f', '#6fa84f'][Math.floor(r() * 3)]);
      for (let i = 0; i < 3; i++) {
        const s = mesh(new THREE.IcosahedronGeometry(0.45 + r() * 0.35, 1), mat);
        s.position.set(x + (i - 1) * 0.6, base + 0.35, z + r() * 0.6);
        g.add(s);
      }
    } else {
      // Mailbox / hydrant / bench variety.
      const k = r();
      if (k < 0.4) {
        const hy = mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.7, 10), M.paint('#d8242b'));
        hy.position.set(x, base + 0.35, z - 2);
        g.add(hy);
      } else if (k < 0.7) {
        g.add(boxAt(1.6, 0.08, 0.45, M.tex('bench', woodTex('#b98a5a')), x, base + 0.45, z - 1.5, 0.02));
        g.add(boxAt(1.6, 0.4, 0.06, M.tex('bench', woodTex('#b98a5a')), x, base + 0.7, z - 1.7, 0.02));
        for (const s of [-0.7, 0.7]) g.add(boxAt(0.06, 0.45, 0.4, M.satin('#2a2c31'), x + s, base + 0.22, z - 1.5, 0.01));
      } else {
        const post = boxAt(0.08, 1.0, 0.08, M.satin('#2a2c31'), x, base + 0.5, z - 1.8, 0.02);
        const box = boxAt(0.35, 0.3, 0.5, M.paint('#1f5fae'), x, base + 1.1, z - 1.8, 0.1);
        g.add(post, box);
      }
    }
  }
  return g;
}

function excavator(d: DecorItem, ctx: KitContext) {
  const g = new THREE.Group();
  const base = groundAt(ctx, d.x);
  const yellow = M.paint('#f3b21c');
  const dark = M.satin('#2a2c31');
  // Tracks.
  for (const z of [-0.9, 0.9]) g.add(boxAt(4.2, 0.8, 0.6, M.rubber(), 0, 0.4, z, 0.35));
  g.add(boxAt(3.2, 0.9, 2.2, yellow, 0, 1.3, 0, 0.1));
  g.add(boxAt(1.5, 1.6, 1.5, yellow, -0.6, 2.4, 0.3, 0.1));
  const glass = boxAt(1.2, 1.1, 1.52, M.glass(), -0.5, 2.55, 0.3, 0.05);
  g.add(glass);
  g.add(boxAt(1.2, 0.8, 2.0, dark, -1.4, 1.9, 0, 0.1));
  // Boom + stick + bucket reaching toward the dig.
  const boom = boxAt(3.4, 0.4, 0.45, yellow, 1.5, 3.1, -0.3, 0.08);
  boom.rotation.z = 0.5;
  g.add(boom);
  const stick = boxAt(2.4, 0.32, 0.38, yellow, 3.4, 2.9, -0.3, 0.06);
  stick.rotation.z = -0.9;
  g.add(stick);
  const bucket = boxAt(0.8, 0.7, 0.9, dark, 4.1, 1.8, -0.3, 0.1);
  bucket.rotation.z = 0.4;
  g.add(bucket);
  const sticker = signPlane('exc-sticker', 1.6, 0.4, { w: 1.6, h: 0.4, bg: '#1d1e22', fg: '#f3c01c', lines: [{ text: 'HOW’S MY DIGGING?', size: 0.2 }], px: 160 });
  sticker.position.set(0, 1.35, 1.12);
  g.add(sticker);
  g.position.set(d.x, base, d.z ?? -7);
  g.rotation.y = 0.35;
  return g;
}

function sandpile(d: DecorItem, ctx: KitContext) {
  const g = new THREE.Group();
  const w = d.w ?? 10;
  const base = groundAt(ctx, d.x - w / 2);
  const mat = M.tex('sand-pile', sandTex(), { roughness: 1, color: new THREE.Color('#e3c68f') });
  for (const [zz, s] of [
    [-3.6, 1],
    [3.4, 0.7],
  ] as const) {
    const m = mesh(new THREE.SphereGeometry(w / 2, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat);
    m.scale.set(1, (2.2 * s) / (w / 2), 0.5);
    m.position.set(d.x, base, zz);
    g.add(m);
  }
  return g;
}

function lifeguard(d: DecorItem, ctx: KitContext) {
  const g = new THREE.Group();
  const base = groundAt(ctx, d.x);
  const wood = M.tex('lg-wood', woodTex('#d8b98a'));
  for (const [x, z] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ])
    g.add(boxAt(0.18, 3.2, 0.18, wood, x, 1.6, z, 0.03));
  g.add(boxAt(2.6, 0.2, 2.6, wood, 0, 3.2, 0, 0.03));
  g.add(boxAt(2.4, 1.8, 2.4, M.paint('#d8242b'), 0, 4.2, 0, 0.1));
  const roof = mesh(new THREE.ConeGeometry(2.2, 1, 4), M.paint('#fbfaf7'));
  roof.rotation.y = Math.PI / 4;
  roof.position.y = 5.6;
  g.add(roof);
  const s = signPlane('lg-sign', 2.2, 0.5, { w: 2.2, h: 0.5, bg: '#fbfaf7', fg: '#d8242b', lines: [{ text: 'LIFEGUARD (ON BREAK)', size: 0.3 }], px: 128 });
  s.position.set(0, 4.3, 1.22);
  g.add(s);
  g.position.set(d.x, base, d.z ?? -9);
  return g;
}

function umbrellas(d: DecorItem, ctx: KitContext) {
  const g = new THREE.Group();
  const cols = ['#d8242b', '#f3c01c', '#2aa7c9', '#f07aa8', '#7ac98a'];
  const w = d.w ?? 20;
  for (let i = 0; i < w / 4; i++) {
    const x = d.x + i * 4 + (i % 2) * 1.2;
    const base = groundAt(ctx, x);
    const z = -6.5 - (i % 3) * 2.2;
    g.add(boxAt(0.06, 2.4, 0.06, M.metal(), x, base + 1.2, z, 0.02));
    const shade = mesh(new THREE.ConeGeometry(1.4, 0.55, 10, 1, true), M.plastic(cols[i % cols.length]));
    (shade.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
    shade.position.set(x, base + 2.4, z);
    shade.rotation.z = 0.12;
    g.add(shade);
    g.add(boxAt(1.8, 0.04, 0.8, M.plastic(['#fbfaf7', '#ffe39a'][i % 2]), x + 0.9, base + 0.05, z + 0.9, 0.02));
  }
  return g;
}

// --- Pier kit -----------------------------------------------------------------

function pilings(d: DecorItem, ctx: KitContext) {
  const g = new THREE.Group();
  const w = d.w ?? 200;
  const mat = M.tex('piling', woodTex('#6b5038'), { roughness: 0.95 });
  for (let x = d.x; x <= d.x + w; x += 5) {
    const top = groundAt(ctx, x) - 1.3;
    for (const z of [-2.2, 2.2]) {
      const p = mesh(new THREE.CylinderGeometry(0.28, 0.32, top + 8, 10), mat);
      p.position.set(x, (top - 8) / 2, z);
      g.add(p);
    }
    const brace = boxAt(0.18, 0.18, 4.6, mat, x, top - 0.6, 0, 0.02);
    g.add(brace);
  }
  return g;
}

function pierRail(d: DecorItem, ctx: KitContext) {
  const g = new THREE.Group();
  const w = d.w ?? 200;
  const mat = M.tex('rail-wood', woodTex('#caa37a'));
  for (let x = d.x; x <= d.x + w; x += 2.4) {
    const b = groundAt(ctx, x) + 0.14;
    g.add(boxAt(0.12, 1.0, 0.12, mat, x, b + 0.5, -2.45, 0.02));
  }
  // Rail segments follow the deck height.
  for (let x = d.x; x < d.x + w; x += 2.4) {
    const b0 = groundAt(ctx, x) + 0.14;
    const b1 = groundAt(ctx, x + 2.4) + 0.14;
    const seg = boxAt(Math.hypot(2.4, b1 - b0), 0.1, 0.1, mat, x + 1.2, (b0 + b1) / 2 + 1.0, -2.45, 0.02);
    seg.rotation.z = Math.atan2(b1 - b0, 2.4);
    g.add(seg);
  }
  return g;
}

function lamp(d: DecorItem, ctx: KitContext) {
  const g = new THREE.Group();
  const base = groundAt(ctx, d.x) + 0.14;
  const iron = M.satin('#1f5f5a');
  g.add(boxAt(0.12, 4.2, 0.12, iron, 0, 2.1, 0, 0.05));
  const globe = mesh(new THREE.SphereGeometry(0.28, 14, 10), M.emissive('#fff1c8', 1.4));
  globe.position.y = 4.45;
  g.add(globe);
  g.add(boxAt(0.5, 0.08, 0.5, iron, 0, 4.15, 0, 0.02));
  g.position.set(d.x, base, d.z ?? -3.2);
  return g;
}

function lifebuoy(d: DecorItem, ctx: KitContext) {
  const g = new THREE.Group();
  const base = groundAt(ctx, d.x) + 0.14;
  g.add(boxAt(0.12, 1.6, 0.12, M.tex('rail-wood', woodTex('#caa37a')), 0, 0.8, 0, 0.02));
  const ring = mesh(new THREE.TorusGeometry(0.34, 0.1, 10, 20), M.plastic('#f26a1b'));
  ring.position.y = 1.25;
  ring.position.z = 0.1;
  g.add(ring);
  for (let i = 0; i < 4; i++) {
    const band = mesh(new THREE.TorusGeometry(0.34, 0.105, 6, 4, 0.35), M.plastic('#fbfaf7'));
    band.rotation.z = (i * Math.PI) / 2;
    band.position.copy(ring.position);
    g.add(band);
  }
  g.position.set(d.x, base, d.z ?? -2.9);
  return g;
}

function bench(d: DecorItem, ctx: KitContext) {
  const g = new THREE.Group();
  const base = groundAt(ctx, d.x) + 0.14;
  const wood = M.tex('bench', woodTex('#b98a5a'));
  g.add(boxAt(1.8, 0.08, 0.45, wood, 0, 0.45, 0, 0.02));
  g.add(boxAt(1.8, 0.4, 0.06, wood, 0, 0.72, -0.22, 0.02));
  for (const s of [-0.8, 0.8]) g.add(boxAt(0.06, 0.45, 0.4, M.satin('#2a2c31'), s, 0.22, 0, 0.01));
  const plaque = signPlane('bench-plaque', 0.6, 0.12, { w: 0.6, h: 0.12, bg: '#c7a24a', fg: '#1d1e22', lines: [{ text: 'IN MEMORY OF A PARCEL', size: 0.07 }], px: 400 });
  plaque.position.set(0, 0.8, -0.18);
  g.add(plaque);
  g.position.set(d.x, base, d.z ?? -3.5);
  return g;
}

/** Snack stand under a drivable roof slab (the slab is the gameplay roof). */
function stand(d: DecorItem, ctx: KitContext) {
  const g = new THREE.Group();
  const w = d.w ?? 16;
  const top = d.y ?? 3.4;
  const deck = groundAt(ctx, d.x + w / 2) + 0.14;
  const pal = [
    ['#d8242b', '#fff4e4'],
    ['#1f7f8f', '#e8f4f8'],
    ['#f3c01c', '#fffaf0'],
  ][(d.variant ?? 0) % 3];
  // Counter and back wall behind the lower deck.
  const back = boxAt(w - 1, top - deck - 0.4, 3, M.plastic(pal[1]), d.x + w / 2, deck + (top - deck - 0.4) / 2, -4.2, 0.08);
  g.add(back);
  g.add(boxAt(w - 1.4, 1.1, 0.8, M.plastic(pal[0]), d.x + w / 2, deck + 0.55, -2.9, 0.08));
  // Striped awning edge hanging from the roof slab.
  const aw = new THREE.Mesh(new THREE.PlaneGeometry(w, 0.7), new THREE.MeshStandardMaterial({ map: awningTex(pal[0], '#fbfaf7'), side: THREE.DoubleSide, roughness: 0.8 }));
  aw.position.set(d.x + w / 2, top - 0.65, 2.65);
  g.add(aw);
  // Posts.
  for (const x of [d.x + 0.5, d.x + w - 0.5]) for (const z of [-2.6, 2.6]) g.add(boxAt(0.18, top - deck, 0.18, M.satin('#fbfaf7'), x, deck + (top - deck) / 2 - 0.2, z, 0.03));
  const s = signPlane('stand-' + d.text, Math.min(w - 2, 6), 1.1, { w: Math.min(w - 2, 6), h: 1.1, bg: pal[0], fg: '#fff', lines: [{ text: d.text ?? 'SNACKS', size: 0.6 }], px: 96 });
  s.position.set(d.x + w / 2, top + 1.3, -2.8);
  g.add(s);
  g.add(boxAt(Math.min(w - 2, 6) + 0.2, 1.2, 0.1, M.satin('#2a2c31'), d.x + w / 2, top + 1.3, -2.88, 0.02));
  for (const px of [-2, 2]) g.add(boxAt(0.1, 1.2, 0.1, M.satin('#2a2c31'), d.x + w / 2 + px, top + 0.6, -2.9, 0.02));
  return g;
}

function awningProp(d: DecorItem, _ctx: KitContext) {
  const g = new THREE.Group();
  const w = d.w ?? 12;
  const y = d.y ?? 2.3;
  const aw = new THREE.Mesh(new THREE.BoxGeometry(w, 0.1, 5.2), new THREE.MeshStandardMaterial({ map: awningTex('#1f5fae', '#fbfaf7'), roughness: 0.8 }));
  aw.position.set(d.x + w / 2, y + 0.25, 0);
  aw.castShadow = true;
  g.add(aw);
  const fringe = new THREE.Mesh(new THREE.PlaneGeometry(w, 0.35), new THREE.MeshStandardMaterial({ map: awningTex('#1f5fae', '#fbfaf7'), side: THREE.DoubleSide }));
  fringe.position.set(d.x + w / 2, y - 0.05, 2.62);
  g.add(fringe);
  for (const x of [d.x + 0.3, d.x + w - 0.3]) g.add(boxAt(0.14, y + 0.3, 0.14, M.satin('#fbfaf7'), x, (y + 0.3) / 2, -2.55, 0.03));
  const s = signPlane('awning-sign', 2.6, 0.45, { w: 2.6, h: 0.45, bg: '#fbfaf7', fg: '#1f5fae', lines: [{ text: 'CLEARANCE 2.45 m', size: 0.3 }], px: 160 });
  s.position.set(d.x + 1.6, y - 0.12, 2.64);
  g.add(s);
  return g;
}

function fishing(d: DecorItem, ctx: KitContext) {
  const g = new THREE.Group();
  const base = groundAt(ctx, d.x) + 0.14;
  for (let i = 0; i < 3; i++) {
    const rod = boxAt(0.04, 3.2, 0.04, M.satin('#2a2c31'), i * 1.4, 1.5, -2.4, 0.01);
    rod.rotation.x = -0.5;
    rod.rotation.z = 0.1 * (i - 1);
    g.add(rod);
  }
  g.add(boxAt(0.8, 0.5, 0.5, M.plastic('#1f7f8f'), 0.7, 0.25, -3.3, 0.05));
  const s = signPlane('bait', 1.4, 0.4, { w: 1.4, h: 0.4, bg: '#fbfaf7', fg: '#1d1e22', lines: [{ text: 'LIVE BAIT (MOSTLY)', size: 0.22 }], px: 200 });
  s.position.set(0.7, 0.6, -3.04);
  g.add(s);
  g.position.set(d.x, base, 0);
  return g;
}

function brokenGate(d: DecorItem, ctx: KitContext) {
  const g = new THREE.Group();
  const base = groundAt(ctx, d.x) + 0.14;
  const mat = M.metal('#6b6e75');
  g.add(boxAt(0.14, 2.2, 0.14, mat, 0, 1.1, -2.5, 0.03));
  // The gate itself lies flat behind the deck, defeated.
  const gate = boxAt(2.4, 0.08, 1.6, mat, 1.1, 0.06, -4.2, 0.02);
  gate.rotation.y = 0.3;
  g.add(gate);
  const s = signPlane('gate-sign', 2.2, 0.8, {
    w: 2.2,
    h: 0.8,
    bg: '#fbf8f1',
    fg: '#1d1e22',
    border: '#d8242b',
    lines: [
      { text: 'GATE CODE: BROKEN', size: 0.22 },
      { text: 'GATE: ALSO BROKEN', size: 0.22, color: '#d8242b' },
    ],
    px: 200,
  });
  s.position.set(0, 1.9, -2.4);
  g.add(s);
  g.position.set(d.x, base, 0);
  return g;
}

const BUILDERS: Record<string, (d: DecorItem, ctx: KitContext) => THREE.Object3D> = {
  excavator,
  sandpile,
  lifeguard,
  umbrellas,
  pilings,
  rail: pierRail,
  lamp,
  lifebuoy,
  bench,
  stand,
  awning: awningProp,
  fishing,
  gate: brokenGate,
  townfill: townFill,
  frontfill: frontFill,
  warehouse,
  crates,
  palm,
  light: streetLight,
  sign,
  shop,
  house,
  apartment,
  under: underBuilding,
  motel,
  pooldeck: poolDeck,
  railing,
  floatie: flamingoFloat,
  ferris,
  pier,
  hills,
  clouds,
  handtruck: handTruck,
  person,
  bay: bayPad,
  door: rollerDoor,
  cones,
  hedge,
  fence,
  tree,
  trampoline,
  boat,
  gull,
};

export function buildDecor(d: DecorItem, ctx: KitContext): THREE.Object3D | null {
  const b = BUILDERS[d.kind];
  if (!b) {
    console.warn('Unknown decor kind', d.kind);
    return null;
  }
  return b(d, ctx);
}

export const _unused: Vec2 | null = null;
