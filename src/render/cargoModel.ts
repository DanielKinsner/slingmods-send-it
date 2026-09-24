import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { CargoSpec } from '../sim/types';
import { M, mesh } from './materials';
import { cartonTex } from './textures';

export interface CargoVisual {
  spec: CargoSpec;
  root: THREE.Group;
  box: THREE.Object3D;
  straps: THREE.Mesh[];
  strapMat: THREE.MeshStandardMaterial;
  ring: THREE.Mesh;
  damagedApplied: boolean;
  setDamaged(): void;
}

const DEPTH: Record<string, number> = { standard: 0.5, fragile: 0.42, heavy: 0.55, flamingo: 0.3 };

function flamingo(spec: CargoSpec): THREE.Group {
  const g = new THREE.Group();
  const pink = M.paint('#f07aa8');
  const body = mesh(new THREE.SphereGeometry(0.15, 20, 14), pink);
  body.scale.set(1.35, 0.95, 0.9);
  body.position.set(-0.02, -0.02, 0);
  g.add(body);
  const tail = mesh(new THREE.ConeGeometry(0.07, 0.16, 10), pink);
  tail.rotation.z = Math.PI / 2 + 0.4;
  tail.position.set(-0.22, 0.04, 0);
  g.add(tail);
  const neckCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.12, 0.02, 0),
    new THREE.Vector3(0.16, 0.14, 0),
    new THREE.Vector3(0.06, 0.24, 0),
    new THREE.Vector3(0.1, 0.34, 0),
  ]);
  g.add(mesh(new THREE.TubeGeometry(neckCurve, 16, 0.03, 8), pink));
  const head = mesh(new THREE.SphereGeometry(0.05, 12, 10), pink);
  head.position.set(0.12, 0.35, 0);
  g.add(head);
  const beak = mesh(new THREE.ConeGeometry(0.025, 0.09, 8), M.matte('#1c1c1c'));
  beak.rotation.z = -Math.PI / 2 - 0.6;
  beak.position.set(0.18, 0.32, 0);
  g.add(beak);
  for (const z of [-0.05, 0.05]) {
    const eye = mesh(new THREE.SphereGeometry(0.012, 6, 6), M.matte('#111'));
    eye.position.set(0.14, 0.37, z * 0.7);
    g.add(eye);
  }
  const legMat = M.satin('#e46a98');
  for (const z of [-0.04, 0.04]) {
    const leg = mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.13, 6), legMat);
    leg.position.set(0, -0.19, z);
    g.add(leg);
  }
  // Shipping tag on the neck: it has a tracking number, just not a box.
  const tag = mesh(new THREE.BoxGeometry(0.06, 0.04, 0.005), M.matte('#fbf8f1'));
  tag.position.set(0.16, 0.18, 0.04);
  tag.rotation.z = 0.3;
  g.add(tag);
  g.position.y = -spec.h / 2 + 0.26;
  return g;
}

export function buildCargo(spec: CargoSpec, logo: HTMLImageElement | null): CargoVisual {
  const root = new THREE.Group();
  const straps: THREE.Mesh[] = [];
  const strapMat = new THREE.MeshStandardMaterial({ color: '#f0b400', roughness: 0.6, emissive: '#000000' });
  let box: THREE.Object3D;
  const d = DEPTH[spec.kind] ?? 0.5;
  let boxMesh: THREE.Mesh | null = null;
  if (spec.kind === 'flamingo') {
    box = flamingo(spec);
    root.add(box);
  } else {
    const tex = cartonTex(spec.kind, spec.label, logo);
    const side = M.tex('carton-side-' + spec.kind, cartonTex(spec.kind, spec.label + '-s', null), { roughness: 0.95 });
    const face = M.tex('carton-face-' + spec.kind + spec.label, tex, { roughness: 0.95 });
    const geo = new RoundedBoxGeometry(spec.w, spec.h, d, 2, 0.025);
    boxMesh = new THREE.Mesh(geo, [side, side, side, side, face, face]);
    boxMesh.castShadow = true;
    boxMesh.receiveShadow = true;
    box = boxMesh;
    root.add(box);
    // Two ratchet straps wrapping over the top.
    for (const z of [-d * 0.28, d * 0.28]) {
      const s = mesh(new THREE.BoxGeometry(spec.w + 0.012, spec.h + 0.012, 0.045), strapMat, false, false);
      s.position.z = z;
      (s.geometry as THREE.BoxGeometry).computeBoundingBox();
      straps.push(s);
      root.add(s);
    }
  }
  // Pickup ring (visible only while recovering / recoverable).
  const ring = mesh(new THREE.TorusGeometry(Math.max(spec.w, spec.h) * 0.85, 0.03, 8, 32), M.emissive('#f3c01c', 2.2), false, false);
  ring.visible = false;
  root.add(ring);

  const vis: CargoVisual = {
    spec,
    root,
    box,
    straps,
    strapMat,
    ring,
    damagedApplied: false,
    setDamaged() {
      if (vis.damagedApplied || !boxMesh) return;
      vis.damagedApplied = true;
      const tex = cartonTex(spec.kind as 'standard', spec.label, logo, true);
      const dmg = M.tex('carton-dmg-' + spec.kind + spec.label, tex, { roughness: 1 });
      const mats = boxMesh.material as THREE.Material[];
      mats[4] = dmg;
      mats[5] = dmg;
      boxMesh.scale.set(1.0, 0.94, 1.03);
      boxMesh.rotation.x = 0.04;
    },
  };
  return vis;
}
