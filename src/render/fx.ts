import * as THREE from 'three';
import { blobTex } from './textures';

interface Particle {
  alive: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  max: number;
  size: number;
  grow: number;
  gravity: number;
  color: THREE.Color;
  alpha: number;
}

/** Bounded pool of soft billboard particles (dust, splash, confetti). */
export class Particles {
  readonly points: THREE.Points;
  private parts: Particle[] = [];
  private pos: Float32Array;
  private col: Float32Array;
  private size: Float32Array;
  private cursor = 0;
  reduced = false;

  constructor(private max = 600) {
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 4);
    this.size = new Float32Array(max);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 4));
    g.setAttribute('size', new THREE.BufferAttribute(this.size, 1));
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { map: { value: blobTex() }, scale: { value: 600 } },
      vertexShader: `
        attribute float size; attribute vec4 color; varying vec4 vColor; uniform float scale;
        void main(){ vColor = color; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = size * scale / -mv.z; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `
        uniform sampler2D map; varying vec4 vColor;
        void main(){ vec4 t = texture2D(map, gl_PointCoord); gl_FragColor = vec4(vColor.rgb, vColor.a * t.a); if (gl_FragColor.a < 0.01) discard; }`,
    });
    this.points = new THREE.Points(g, mat);
    this.points.frustumCulled = false;
    for (let i = 0; i < max; i++)
      this.parts.push({ alive: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, max: 1, size: 1, grow: 0, gravity: 0, color: new THREE.Color(), alpha: 1 });
  }

  setScale(h: number) {
    (this.points.material as THREE.ShaderMaterial).uniforms.scale.value = h * 0.9;
  }

  emit(n: number, o: { x: number; y: number; z?: number; spread?: number; vx?: number; vy?: number; speed?: number; life?: number; size?: number; grow?: number; gravity?: number; color: string; alpha?: number; zSpread?: number }) {
    if (this.reduced) n = Math.ceil(n / 3);
    for (let i = 0; i < n; i++) {
      const p = this.parts[this.cursor];
      this.cursor = (this.cursor + 1) % this.max;
      const a = Math.random() * Math.PI * 2;
      const s = (o.speed ?? 1) * (0.4 + Math.random() * 0.8);
      p.alive = true;
      p.x = o.x + (Math.random() - 0.5) * (o.spread ?? 0.3);
      p.y = o.y + (Math.random() - 0.5) * (o.spread ?? 0.3) * 0.5;
      p.z = (o.z ?? 0) + (Math.random() - 0.5) * (o.zSpread ?? 1.5);
      p.vx = (o.vx ?? 0) + Math.cos(a) * s;
      p.vy = (o.vy ?? 0) + Math.abs(Math.sin(a)) * s;
      p.vz = (Math.random() - 0.5) * s;
      p.max = p.life = (o.life ?? 0.8) * (0.7 + Math.random() * 0.6);
      p.size = (o.size ?? 0.5) * (0.7 + Math.random() * 0.6);
      p.grow = o.grow ?? 1;
      p.gravity = o.gravity ?? 0;
      p.color.set(o.color);
      p.alpha = o.alpha ?? 0.6;
    }
  }

  update(dt: number) {
    for (let i = 0; i < this.max; i++) {
      const p = this.parts[i];
      if (!p.alive) {
        this.size[i] = 0;
        continue;
      }
      p.life -= dt;
      if (p.life <= 0) {
        p.alive = false;
        this.size[i] = 0;
        continue;
      }
      p.vy -= p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.vx *= 0.98;
      const t = 1 - p.life / p.max;
      this.pos[i * 3] = p.x;
      this.pos[i * 3 + 1] = p.y;
      this.pos[i * 3 + 2] = p.z;
      this.col[i * 4] = p.color.r;
      this.col[i * 4 + 1] = p.color.g;
      this.col[i * 4 + 2] = p.color.b;
      this.col[i * 4 + 3] = p.alpha * (1 - t);
      this.size[i] = p.size * (1 + t * p.grow);
    }
    const g = this.points.geometry;
    g.attributes.position.needsUpdate = true;
    g.attributes.color.needsUpdate = true;
    g.attributes.size.needsUpdate = true;
  }

  clear() {
    for (const p of this.parts) p.alive = false;
  }
}

/** Soft contact shadow blob under a body. */
export function blobShadow(size: number) {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(size, size * 0.55),
    new THREE.MeshBasicMaterial({ map: blobTex(), color: '#000', transparent: true, opacity: 0.35, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 }),
  );
  m.rotation.x = -Math.PI / 2;
  m.renderOrder = 2;
  return m;
}
