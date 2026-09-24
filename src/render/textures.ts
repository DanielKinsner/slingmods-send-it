import * as THREE from 'three';

// Canvas-painted textures. Everything here is original, generated at load.

const cache = new Map<string, THREE.Texture>();
export const FONT = '"Barlow Condensed", "Arial Narrow", Arial, sans-serif';

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!] as const;
}

function toTex(c: HTMLCanvasElement, opts: { repeat?: boolean; srgb?: boolean; aniso?: number } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (opts.srgb !== false) t.colorSpace = THREE.SRGBColorSpace;
  if (opts.repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = opts.aniso ?? 8;
  t.needsUpdate = true;
  return t;
}

function memo(key: string, make: () => THREE.Texture) {
  let t = cache.get(key);
  if (!t) {
    t = make();
    cache.set(key, t);
  }
  return t;
}

// Deterministic noise so textures are identical every load.
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function speckle(ctx: CanvasRenderingContext2D, w: number, h: number, n: number, colors: string[], size: [number, number], seed = 1) {
  const r = rng(seed);
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = colors[Math.floor(r() * colors.length)];
    ctx.globalAlpha = 0.25 + r() * 0.5;
    const s = size[0] + r() * (size[1] - size[0]);
    ctx.fillRect(r() * w, r() * h, s, s);
  }
  ctx.globalAlpha = 1;
}

export function asphaltTex() {
  return memo('asphalt', () => {
    const [c, g] = canvas(512, 512);
    g.fillStyle = '#4a4b50';
    g.fillRect(0, 0, 512, 512);
    speckle(g, 512, 512, 9000, ['#3b3c40', '#57585d', '#626168', '#45464b'], [1, 3], 7);
    // Patch repairs.
    g.globalAlpha = 0.18;
    g.fillStyle = '#2f3034';
    g.fillRect(60, 300, 140, 90);
    g.fillRect(330, 60, 90, 60);
    g.globalAlpha = 1;
    return toTex(c, { repeat: true });
  });
}

/** Road top: asphalt with a painted edge line near the camera side. */
export function roadTopTex() {
  return memo('roadtop', () => {
    const [c, g] = canvas(512, 256);
    g.drawImage(asphaltTex().image as HTMLCanvasElement, 0, 0, 512, 256);
    // v runs across the road (0 = far edge, 1 = near edge).
    g.fillStyle = '#e9e4d6';
    g.fillRect(0, 226, 512, 8);
    g.fillStyle = '#f0c21a';
    for (let x = 0; x < 512; x += 128) g.fillRect(x, 118, 70, 7);
    g.fillStyle = '#e9e4d6';
    g.fillRect(0, 22, 512, 6);
    return toTex(c, { repeat: true });
  });
}

export function concreteTex(tint = '#c9c1b3') {
  return memo('concrete' + tint, () => {
    const [c, g] = canvas(256, 256);
    g.fillStyle = tint;
    g.fillRect(0, 0, 256, 256);
    speckle(g, 256, 256, 2500, ['#b3aa9b', '#d6cfc2', '#a69d8f'], [1, 2], 3);
    g.strokeStyle = 'rgba(80,70,60,0.25)';
    g.lineWidth = 2;
    g.strokeRect(0, 0, 256, 256);
    return toTex(c, { repeat: true });
  });
}

export function corrugatedTex(base = '#d7d3c8') {
  return memo('corr' + base, () => {
    const [c, g] = canvas(256, 256);
    g.fillStyle = base;
    g.fillRect(0, 0, 256, 256);
    for (let x = 0; x < 256; x += 16) {
      const grd = g.createLinearGradient(x, 0, x + 16, 0);
      grd.addColorStop(0, 'rgba(0,0,0,0.18)');
      grd.addColorStop(0.5, 'rgba(255,255,255,0.18)');
      grd.addColorStop(1, 'rgba(0,0,0,0.18)');
      g.fillStyle = grd;
      g.fillRect(x, 0, 16, 256);
    }
    speckle(g, 256, 256, 600, ['#8a8478', '#b8b2a6'], [1, 2], 5);
    return toTex(c, { repeat: true });
  });
}

export function tileTex(color = '#e8f1f2', grout = '#b8c9cc', px = 32) {
  return memo(`tile${color}${grout}${px}`, () => {
    const [c, g] = canvas(256, 256);
    g.fillStyle = grout;
    g.fillRect(0, 0, 256, 256);
    g.fillStyle = color;
    for (let y = 0; y < 256; y += px) for (let x = 0; x < 256; x += px) g.fillRect(x + 1.5, y + 1.5, px - 3, px - 3);
    return toTex(c, { repeat: true });
  });
}

export function woodTex(base = '#b98a5a') {
  return memo('wood' + base, () => {
    const [c, g] = canvas(256, 256);
    g.fillStyle = base;
    g.fillRect(0, 0, 256, 256);
    const r = rng(11);
    for (let y = 0; y < 256; y += 32) {
      g.fillStyle = `rgba(60,35,15,${0.1 + r() * 0.15})`;
      g.fillRect(0, y, 256, 32);
      g.fillStyle = 'rgba(40,25,10,0.55)';
      g.fillRect(0, y, 256, 2);
      for (let i = 0; i < 6; i++) {
        g.strokeStyle = `rgba(90,55,25,${0.15 + r() * 0.2})`;
        g.beginPath();
        const yy = y + 4 + r() * 24;
        g.moveTo(0, yy);
        g.bezierCurveTo(80, yy + r() * 6 - 3, 170, yy + r() * 6 - 3, 256, yy);
        g.stroke();
      }
    }
    return toTex(c, { repeat: true });
  });
}

export function stuccoTex(base: string) {
  return memo('stucco' + base, () => {
    const [c, g] = canvas(256, 256);
    g.fillStyle = base;
    g.fillRect(0, 0, 256, 256);
    speckle(g, 256, 256, 3000, ['rgba(255,255,255,0.5)', 'rgba(0,0,0,0.25)'], [1, 2], 9);
    return toTex(c, { repeat: true });
  });
}

export function roofTex() {
  return memo('roof', () => {
    const [c, g] = canvas(256, 256);
    g.fillStyle = '#8d8a85';
    g.fillRect(0, 0, 256, 256);
    speckle(g, 256, 256, 6000, ['#76736e', '#a3a09a', '#6a6762'], [1, 3], 13);
    return toTex(c, { repeat: true });
  });
}

export function grassTex() {
  return memo('grass', () => {
    const [c, g] = canvas(256, 256);
    g.fillStyle = '#6e9a45';
    g.fillRect(0, 0, 256, 256);
    speckle(g, 256, 256, 5000, ['#5c8a38', '#86b056', '#4f7a2f', '#93bd5c'], [1, 3], 17);
    return toTex(c, { repeat: true });
  });
}

export function sandTex() {
  return memo('sand', () => {
    const [c, g] = canvas(256, 256);
    g.fillStyle = '#e6cf9f';
    g.fillRect(0, 0, 256, 256);
    speckle(g, 256, 256, 4000, ['#d8bf8c', '#f1dcb0', '#cdb27f'], [1, 2], 19);
    return toTex(c, { repeat: true });
  });
}

export type CargoLook = 'standard' | 'fragile' | 'heavy';

/** Cardboard carton face with tape, arrows and a label. */
export function cartonTex(kind: CargoLook, label: string, logo: HTMLImageElement | null, damaged = false) {
  return memo(`carton${kind}${label}${damaged}`, () => {
    const [c, g] = canvas(256, 256);
    const base = kind === 'heavy' ? '#b98a55' : '#c99b62';
    g.fillStyle = base;
    g.fillRect(0, 0, 256, 256);
    // Fluting stripes.
    g.globalAlpha = 0.07;
    g.fillStyle = '#5a3a18';
    for (let x = 0; x < 256; x += 6) g.fillRect(x, 0, 2, 256);
    g.globalAlpha = 1;
    speckle(g, 256, 256, 500, ['#a97d48', '#d8ae78'], [1, 3], label.length * 31);
    // Edge shading.
    const grd = g.createRadialGradient(128, 128, 60, 128, 128, 190);
    grd.addColorStop(0, 'rgba(0,0,0,0)');
    grd.addColorStop(1, 'rgba(70,40,10,0.35)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 256, 256);
    // Tape.
    g.fillStyle = kind === 'fragile' ? 'rgba(222,48,48,0.85)' : 'rgba(230,205,150,0.75)';
    g.fillRect(108, 0, 40, 256);
    if (kind === 'fragile') {
      g.fillStyle = '#fff';
      g.font = `bold 20px ${FONT}`;
      g.save();
      g.translate(128, 128);
      g.rotate(-Math.PI / 2);
      g.textAlign = 'center';
      g.fillText('FRAGILE • FRAGILE • FRAGILE', 0, 7);
      g.restore();
    }
    // Label.
    g.fillStyle = '#fbf8f1';
    g.fillRect(20, 150, 80, 64);
    g.fillStyle = '#222';
    g.font = `bold 13px ${FONT}`;
    g.fillText('SHIP TO:', 26, 166);
    g.fillRect(26, 172, 64, 3);
    g.fillRect(26, 180, 50, 3);
    for (let i = 0; i < 14; i++) g.fillRect(26 + i * 4.5, 190, i % 3 ? 2 : 3, 18);
    if (logo) {
      g.fillStyle = 'rgba(255,255,255,0.85)';
      g.fillRect(156, 30, 88, 26);
      g.drawImage(logo, 158, 33, 84, 20);
    }
    // Arrows.
    g.strokeStyle = '#3a2410';
    g.lineWidth = 4;
    for (const x of [176, 206]) {
      g.beginPath();
      g.moveTo(x, 110);
      g.lineTo(x, 80);
      g.moveTo(x - 8, 88);
      g.lineTo(x, 78);
      g.lineTo(x + 8, 88);
      g.stroke();
    }
    g.fillStyle = '#3a2410';
    g.font = `bold 13px ${FONT}`;
    g.fillText('THIS SIDE UP', 158, 126);
    g.font = `9px ${FONT}`;
    g.fillText('(a request)', 170, 138);
    if (kind === 'heavy') {
      g.fillStyle = '#f3c01c';
      g.fillRect(150, 160, 94, 56);
      g.fillStyle = '#111';
      for (let i = -3; i < 10; i++) {
        g.beginPath();
        g.moveTo(150 + i * 14, 216);
        g.lineTo(150 + i * 14 + 8, 216);
        g.lineTo(150 + i * 14 + 8 + 20, 196);
        g.lineTo(150 + i * 14 + 20, 196);
        g.fill();
      }
      g.fillRect(150, 160, 94, 32);
      g.fillStyle = '#f3c01c';
      g.font = `bold 26px ${FONT}`;
      g.fillText('HEAVY', 164, 186);
    }
    if (damaged) {
      g.strokeStyle = 'rgba(60,30,5,0.6)';
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(10, 40);
      g.lineTo(60, 70);
      g.lineTo(40, 110);
      g.moveTo(230, 230);
      g.lineTo(200, 190);
      g.stroke();
    }
    return toTex(c);
  });
}

export interface SignOpts {
  w: number;
  h: number;
  bg: string;
  fg: string;
  lines: { text: string; size: number; weight?: string; color?: string; strike?: boolean }[];
  border?: string;
  radius?: number;
  px?: number;
  logo?: HTMLImageElement | null;
}

/** Painted sign / billboard. Size in px per metre via opts.px (default 128). */
export function signTex(key: string, o: SignOpts) {
  return memo('sign' + key, () => {
    const px = o.px ?? 128;
    const [c, g] = canvas(Math.round(o.w * px), Math.round(o.h * px));
    const W = c.width;
    const H = c.height;
    g.fillStyle = o.bg;
    g.fillRect(0, 0, W, H);
    if (o.border) {
      g.strokeStyle = o.border;
      g.lineWidth = Math.max(4, px * 0.06);
      g.strokeRect(g.lineWidth, g.lineWidth, W - g.lineWidth * 2, H - g.lineWidth * 2);
    }
    const total = o.lines.reduce((s, l) => s + l.size * px * 1.12, 0) + (o.logo ? H * 0.3 : 0);
    let y = (H - total) / 2;
    if (o.logo) {
      const lh = H * 0.26;
      const lw = (o.logo.width / o.logo.height) * lh;
      g.drawImage(o.logo, (W - lw) / 2, y, lw, lh);
      y += H * 0.3;
    }
    g.textAlign = 'center';
    g.textBaseline = 'top';
    for (const l of o.lines) {
      const size = l.size * px;
      g.font = `${l.weight ?? '800'} ${size}px ${FONT}`;
      g.fillStyle = l.color ?? o.fg;
      let fs = size;
      while (g.measureText(l.text).width > W * 0.92 && fs > 6) {
        fs *= 0.92;
        g.font = `${l.weight ?? '800'} ${fs}px ${FONT}`;
      }
      g.fillText(l.text, W / 2, y + (size - fs) / 2);
      if (l.strike) {
        const tw = g.measureText(l.text).width;
        g.strokeStyle = '#d8242b';
        g.lineWidth = fs * 0.12;
        g.beginPath();
        g.moveTo(W / 2 - tw / 2 - 6, y + fs * 0.62);
        g.lineTo(W / 2 + tw / 2 + 6, y + fs * 0.4);
        g.stroke();
      }
      y += size * 1.12;
    }
    return toTex(c);
  });
}

/** Window grid for building facades (emissive-friendly). */
export function windowsTex(key: string, cols: number, rows: number, frame: string, glass: string, lit = 0.15) {
  return memo('win' + key, () => {
    const [c, g] = canvas(256, 256);
    g.fillStyle = frame;
    g.fillRect(0, 0, 256, 256);
    const cw = 256 / cols;
    const rh = 256 / rows;
    const r = rng(cols * 7 + rows);
    for (let j = 0; j < rows; j++)
      for (let i = 0; i < cols; i++) {
        const lit1 = r() < lit;
        const grd = g.createLinearGradient(0, j * rh, 0, (j + 1) * rh);
        grd.addColorStop(0, lit1 ? '#ffd9a0' : glass);
        grd.addColorStop(1, lit1 ? '#f1b56b' : '#1d2a38');
        g.fillStyle = grd;
        g.fillRect(i * cw + cw * 0.14, j * rh + rh * 0.16, cw * 0.72, rh * 0.62);
      }
    return toTex(c, { repeat: true });
  });
}

/** Soft round blob for contact shadows / particles. */
export function blobTex() {
  return memo('blob', () => {
    const [c, g] = canvas(128, 128);
    const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.5, 'rgba(255,255,255,0.5)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 128, 128);
    return toTex(c, { srgb: false });
  });
}

export function awningTex(a: string, b: string) {
  return memo('awning' + a + b, () => {
    const [c, g] = canvas(256, 64);
    for (let x = 0; x < 256; x += 32) {
      g.fillStyle = (x / 32) % 2 ? a : b;
      g.fillRect(x, 0, 32, 64);
    }
    return toTex(c, { repeat: true });
  });
}
