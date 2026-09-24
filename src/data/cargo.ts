import type { CargoSpec, PresetId, VehicleSpec } from '../sim/types';

// The standard contract: five required parcels plus an optional flamingo.
export const CARGO: CargoSpec[] = [
  { id: 'c1', kind: 'standard', label: 'CARTON A', w: 0.46, h: 0.38, mass: 7, required: true, damageThreshold: 5.2, damageScale: 0.06 },
  { id: 'c2', kind: 'standard', label: 'CARTON B', w: 0.46, h: 0.38, mass: 7, required: true, damageThreshold: 5.2, damageScale: 0.06 },
  { id: 'c3', kind: 'standard', label: 'CARTON C', w: 0.42, h: 0.42, mass: 6, required: true, damageThreshold: 5.2, damageScale: 0.06 },
  { id: 'fr', kind: 'fragile', label: 'FRAGILE', w: 0.4, h: 0.34, mass: 4, required: true, damageThreshold: 3.0, damageScale: 0.12 },
  { id: 'hv', kind: 'heavy', label: 'HEAVY', w: 0.5, h: 0.4, mass: 15, required: true, damageThreshold: 6.5, damageScale: 0.04 },
  { id: 'fl', kind: 'flamingo', label: 'FLAMINGO', w: 0.34, h: 0.52, mass: 1.6, required: false, damageThreshold: 99, damageScale: 0 },
];

export const REQUIRED_COUNT = CARGO.filter((c) => c.required).length;
export const MIN_TO_PASS = 3;

export interface PresetSpec {
  id: PresetId;
  name: string;
  desc: string;
  traits: string[];
  /** Bottom-up stacking order. */
  order: string[];
  maxPerRow: number;
  restraint: number; // strength multiplier
}

export const PRESETS: Record<PresetId, PresetSpec> = {
  sensible: {
    id: 'sensible',
    name: 'Low & Sensible',
    desc: 'Heavy parcel low, wide base, snug straps.',
    traits: ['Easiest delivery', 'Slightly lazier rotation'],
    order: ['hv', 'c1', 'c2', 'c3', 'fr', 'fl'],
    maxPerRow: 3,
    restraint: 1.1,
  },
  regret: {
    id: 'regret',
    name: 'Express Regret',
    desc: 'A tall, proud stack. Rotates like it means it.',
    traits: ['Tall centre of mass', 'Livelier flips', 'Leans on braking'],
    order: ['hv', 'c1', 'c2', 'c3', 'fr', 'fl'],
    maxPerRow: 2,
    restraint: 0.9,
  },
  secure: {
    id: 'secure',
    name: 'Looks Secure',
    desc: 'Heavy box on top. Fragile at the bottom. Confidence everywhere.',
    traits: ['Top-heavy', 'Fragile takes the hits', 'Challenge build'],
    order: ['fr', 'c1', 'c2', 'hv', 'c3', 'fl'],
    maxPerRow: 3,
    restraint: 0.85,
  },
};

export const PRESET_ORDER: PresetId[] = ['sensible', 'regret', 'secure'];

export interface Slot {
  cargoId: string;
  /** Centre of the parcel, chassis-local. */
  x: number;
  y: number;
}

const GAP = 0.02;

/** Pack the contract onto a vehicle deck, bottom row first. */
export function layoutCargo(vehicle: VehicleSpec, preset: PresetSpec, cargo: CargoSpec[] = CARGO): Slot[] {
  const byId = new Map(cargo.map((c) => [c.id, c]));
  const deckLen = vehicle.deck.x1 - vehicle.deck.x0;
  const deckMid = (vehicle.deck.x0 + vehicle.deck.x1) / 2;
  const rows: CargoSpec[][] = [];
  let row: CargoSpec[] = [];
  let rowW = 0;
  for (const id of preset.order) {
    const c = byId.get(id);
    if (!c) continue;
    // Strict: a row must fit between the rear lip and the headboard.
    const fits = rowW + c.w + (row.length ? GAP : 0) <= deckLen - 0.04;
    if (row.length >= preset.maxPerRow || (!fits && row.length > 0)) {
      rows.push(row);
      row = [];
      rowW = 0;
    }
    row.push(c);
    rowW += c.w + (row.length > 1 ? GAP : 0);
  }
  if (row.length) rows.push(row);

  const slots: Slot[] = [];
  let y = vehicle.deck.y;
  let prevWidth = deckLen;
  for (const r of rows) {
    const width = r.reduce((s, c) => s + c.w, 0) + GAP * (r.length - 1);
    // Upper rows sit toward the front of the row below so the stack reads as a pile.
    let x = deckMid - width / 2 + (width < prevWidth - 0.2 ? 0.08 : 0);
    x = Math.max(vehicle.deck.x0 + 0.02, Math.min(x, vehicle.deck.x1 - 0.02 - width));
    const h = Math.max(...r.map((c) => c.h));
    for (const c of r) {
      slots.push({ cargoId: c.id, x: x + c.w / 2, y: y + c.h / 2 + 0.005 });
      x += c.w + GAP;
    }
    y += h + 0.01;
    prevWidth = width;
  }
  return slots;
}
