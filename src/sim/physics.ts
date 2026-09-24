import RAPIER from '@dimforge/rapier2d-compat';

export type R = typeof RAPIER;
export type World = InstanceType<R['World']>;
export type Body = InstanceType<R['RigidBody']>;
export type Collider = InstanceType<R['Collider']>;

let ready: Promise<R> | null = null;

/** Initialise the physics WASM exactly once. */
export function initPhysics(): Promise<R> {
  if (!ready) ready = RAPIER.init().then(() => RAPIER);
  return ready;
}

export const GRAVITY = 12;
export const DT = 1 / 120;

// Collision groups: membership << 16 | filter.
export const G = {
  TERRAIN: 0x1,
  CHASSIS: 0x2,
  WHEEL: 0x4,
  CARGO: 0x8,
  NONE: 0,
};

export function groups(member: number, filter: number): number {
  return ((member & 0xffff) << 16) | (filter & 0xffff);
}

export const GROUPS = {
  terrain: groups(G.TERRAIN, G.CHASSIS | G.WHEEL | G.CARGO),
  chassis: groups(G.CHASSIS, G.TERRAIN | G.CARGO),
  wheel: groups(G.WHEEL, G.TERRAIN),
  cargo: groups(G.CARGO, G.TERRAIN | G.CHASSIS | G.CARGO),
  none: groups(G.NONE, G.NONE),
  terrainQuery: groups(0xffff, G.TERRAIN),
};

export function rotate(x: number, y: number, a: number): [number, number] {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [x * c - y * s, x * s + y * c];
}

export function wrapAngle(a: number): number {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/** True when the collider is currently touching any terrain collider. */
export function touchingTerrain(world: World, collider: Collider, terrain: Set<number>): boolean {
  let hit = false;
  world.contactPairsWith(collider, (other) => {
    if (hit || !terrain.has(other.handle)) return;
    world.contactPair(collider, other, (manifold) => {
      if (manifold.numContacts() > 0 && manifold.contactDist(0) < 0.03) hit = true;
    });
  });
  return hit;
}
