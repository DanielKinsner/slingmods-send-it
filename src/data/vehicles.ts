import type { Build, VehicleId, VehicleSpec } from '../sim/types';

// Fictional arcade roles. These are game-balance characters, not performance
// claims about the real vehicles.

export const VEHICLES: Record<VehicleId, VehicleSpec> = {
  slingshot: {
    id: 'slingshot',
    name: 'Slingshot',
    department: 'The Express Department',
    line: 'Two seats. One questionable business model.',
    traits: ['Long wheelbase', 'Smooth pitch', 'Low nose — clean approaches'],
    // Invisible collision hull (rounded by 0.06 m at runtime). The nose
    // underside is raised above the real splitter so ramps don't snag it.
    hull: [[-1.62, -0.24], [-1.0, -0.28], [1.3, -0.28], [1.95, -0.12], [2.0, -0.02], [1.85, 0.05], [0.6, 0.27], [-0.6, 0.46], [-1.62, 0.46]],
    chassisMass: 290,
    com: [0.2, -0.1],
    inertiaScale: 1.0,
    head: { x: -0.28, y: 0.59, r: 0.15 },
    rear: { x: -1.3335, y: -0.2045, radius: 0.3455, mass: 16 },
    front: { x: 1.33, y: -0.22, radius: 0.33, mass: 20 },
    suspension: { freq: 1.75, damping: 0.42, up: 0.2, down: 0.12 },
    drive: { torque: 820, topSpeed: 24, brake: 760, reverseSpeed: 5, reaction: 0.45 },
    pitch: { air: 3700, airMaxOmega: 8.0, ground: 420 },
    grip: 1.5,
    deck: { x0: -2.37, x1: -0.85, y: 0.62, lip: 0.07 },
    rider: 'seated',
    paint: '#d8242b',
    accent: '#1c1d21',
  },
  ryker: {
    id: 'ryker',
    name: 'Ryker',
    department: 'The Shortcut Department',
    line: 'Small shipment. Large incident report.',
    traits: ['Short wheelbase', 'Quick pitch', 'Tall, twitchy stack'],
    hull: [[-1.14, -0.16], [-0.6, -0.27], [0.7, -0.27], [1.05, -0.06], [0.95, 0.24], [0.3, 0.29], [-1.14, 0.24]],
    chassisMass: 225,
    com: [0.1, -0.05],
    inertiaScale: 0.85,
    head: { x: -0.12, y: 0.82, r: 0.16 },
    rear: { x: -0.8545, y: -0.215, radius: 0.285, mass: 14 },
    front: { x: 0.85, y: -0.19, radius: 0.31, mass: 16 },
    suspension: { freq: 1.95, damping: 0.38, up: 0.2, down: 0.13 },
    drive: { torque: 640, topSpeed: 23, brake: 620, reverseSpeed: 5, reaction: 0.5 },
    pitch: { air: 3300, airMaxOmega: 9.5, ground: 380 },
    grip: 1.45,
    deck: { x0: -1.55, x1: -0.62, y: 0.35, lip: 0.07 },
    rider: 'straddle',
    paint: '#f2f2ef',
    accent: '#f0b400',
  },
  spyder: {
    id: 'spyder',
    name: 'Spyder',
    department: 'The Cargo Department',
    line: 'The responsible option has also found the ramp.',
    traits: ['Heavy & planted', 'Calm cargo deck', 'Slow to rotate'],
    hull: [[-1.24, -0.2], [-0.6, -0.32], [1.0, -0.32], [1.34, -0.08], [1.24, 0.24], [0.5, 0.39], [-1.24, 0.36]],
    chassisMass: 360,
    com: [0.15, -0.1],
    inertiaScale: 1.3,
    head: { x: -0.1, y: 1.0, r: 0.16 },
    rear: { x: -0.8545, y: -0.2265, radius: 0.3235, mass: 18 },
    front: { x: 0.8545, y: -0.2265, radius: 0.3235, mass: 22 },
    suspension: { freq: 1.6, damping: 0.55, up: 0.2, down: 0.12 },
    drive: { torque: 1000, topSpeed: 23, brake: 900, reverseSpeed: 5, reaction: 0.4 },
    pitch: { air: 4300, airMaxOmega: 6.8, ground: 480 },
    grip: 1.55,
    deck: { x0: -1.75, x1: -0.62, y: 0.47, lip: 0.08 },
    rider: 'straddle',
    paint: '#e8e9e6',
    accent: '#2b6fd6',
  },
};

export const VEHICLE_ORDER: VehicleId[] = ['slingshot', 'ryker', 'spyder'];

export const PAINTS: { name: string; body: string; accent: string; cost: number }[] = [
  { name: 'Factory', body: '', accent: '', cost: 0 },
  { name: 'Parcel Brown', body: '#9a6a3c', accent: '#2a1d12', cost: 300 },
  { name: 'Express Yellow', body: '#f3c01c', accent: '#1c1d21', cost: 300 },
  { name: 'Pool Blue', body: '#2aa7c9', accent: '#f4f1e8', cost: 450 },
  { name: 'Flamingo', body: '#f07aa8', accent: '#fff4f8', cost: 600 },
];

// Garage equipment. Every option changes the simulation; see applyBuild().
export const SUSPENSION = {
  standard: { name: 'Standard', desc: 'Balanced. Does what it says.', freq: 1, damping: 1, cost: 0 },
  comfort: { name: 'Parcel Insurance', desc: 'Softer, heavily damped. Cargo settles fast after landings.', freq: 0.85, damping: 1.45, cost: 500 },
  stunt: { name: 'Pogo Protocol', desc: 'Stiffer and livelier. Pops off lips, rotates harder.', freq: 1.25, damping: 0.75, cost: 650 },
} as const;

export const TIRES = {
  road: { name: 'Road Grip', desc: 'Stops when asked. Mostly.', grip: 1, brake: 1, air: 1, cost: 0 },
  stunt: { name: 'Slick Decisions', desc: 'Less grip and braking, more air rotation.', grip: 0.82, brake: 0.85, air: 1.2, cost: 550 },
} as const;

export const RESTRAINTS = {
  standard: { name: 'Standard Straps', desc: 'Holds a normal amount of optimism.', strength: 1, weight: 0, cost: 0 },
  secure: { name: 'No Really, It’s Secure', desc: 'Much stronger straps. Adds a little weight.', strength: 1.55, weight: 14, cost: 700 },
  loose: { name: 'Bungee Budget', desc: 'Weak straps. For challenge runs and bad ideas.', strength: 0.6, weight: -4, cost: 0 },
} as const;

export const DEFAULT_BUILD: Build = {
  vehicle: 'slingshot',
  preset: 'sensible',
  suspension: 'standard',
  tires: 'road',
  restraint: 'standard',
  paint: 0,
};

/** Vehicle spec with garage equipment applied. */
export function applyBuild(build: Build): VehicleSpec {
  const base = VEHICLES[build.vehicle];
  const s = SUSPENSION[build.suspension];
  const t = TIRES[build.tires];
  const r = RESTRAINTS[build.restraint];
  const paint = PAINTS[build.paint] ?? PAINTS[0];
  return {
    ...base,
    chassisMass: base.chassisMass + r.weight,
    suspension: {
      ...base.suspension,
      freq: base.suspension.freq * s.freq,
      damping: base.suspension.damping * s.damping,
    },
    pitch: {
      ...base.pitch,
      air: base.pitch.air * t.air * (build.suspension === 'stunt' ? 1.1 : 1),
    },
    drive: { ...base.drive, brake: base.drive.brake * t.brake },
    grip: base.grip * t.grip,
    paint: paint.body || base.paint,
    accent: paint.accent || base.accent,
  };
}
