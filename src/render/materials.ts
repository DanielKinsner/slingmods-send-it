import * as THREE from 'three';

const mats = new Map<string, THREE.Material>();

function memo<T extends THREE.Material>(key: string, make: () => T): T {
  let m = mats.get(key) as T | undefined;
  if (!m) {
    m = make();
    mats.set(key, m);
  }
  return m;
}

export const M = {
  paint: (color: string) =>
    memo('paint' + color, () => new THREE.MeshPhysicalMaterial({ color, roughness: 0.32, metalness: 0.15, clearcoat: 0.9, clearcoatRoughness: 0.12 })),
  satin: (color: string) => memo('satin' + color, () => new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.2 })),
  plastic: (color: string) => memo('plastic' + color, () => new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0 })),
  matte: (color: string) => memo('matte' + color, () => new THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0 })),
  metal: (color = '#b9bcc2') => memo('metal' + color, () => new THREE.MeshStandardMaterial({ color, roughness: 0.28, metalness: 0.9 })),
  rubber: () => memo('rubber', () => new THREE.MeshStandardMaterial({ color: '#1b1b1d', roughness: 0.92, metalness: 0 })),
  glass: () =>
    memo('glass', () => new THREE.MeshPhysicalMaterial({ color: '#27313b', roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.55, clearcoat: 1 })),
  visor: () => memo('visor', () => new THREE.MeshPhysicalMaterial({ color: '#15181d', roughness: 0.08, metalness: 0.6, clearcoat: 1 })),
  emissive: (color: string, intensity = 2) =>
    memo(`emi${color}${intensity}`, () => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity, roughness: 0.4 })),
  tex: (key: string, map: THREE.Texture, opts: THREE.MeshStandardMaterialParameters = {}) =>
    memo('tex' + key, () => new THREE.MeshStandardMaterial({ map, roughness: 0.85, metalness: 0, ...opts })),
};

export function mesh(geo: THREE.BufferGeometry, mat: THREE.Material, cast = true, receive = true) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = cast;
  m.receiveShadow = receive;
  return m;
}
