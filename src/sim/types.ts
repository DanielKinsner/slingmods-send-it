// Shared data contracts. The simulation is 2D (x forward, y up, angle = pitch,
// counter-clockwise positive = nose up). Rendering maps it into a 3D world.

export type Vec2 = [number, number];

export type VehicleId = 'slingshot' | 'ryker' | 'spyder';

export interface WheelSpec {
  x: number; // attach point, chassis-local
  y: number;
  radius: number;
  mass: number;
}

export interface VehicleSpec {
  id: VehicleId;
  name: string;
  department: string;
  line: string;
  traits: string[];
  /** Convex hull of the lower body, chassis-local. */
  hull: Vec2[];
  chassisMass: number;
  /** Centre of mass offset (chassis-local). */
  com: Vec2;
  inertiaScale: number;
  head: { x: number; y: number; r: number };
  rear: WheelSpec;
  front: WheelSpec;
  suspension: {
    freq: number; // Hz at static load
    damping: number; // ratio
    up: number; // compression travel (m)
    down: number; // extension travel (m)
  };
  drive: {
    torque: number; // N*m at the rear wheel
    topSpeed: number; // m/s
    brake: number; // N*m per wheel
    reverseSpeed: number;
    reaction: number; // fraction of drive torque fed back into the chassis (wheelies)
  };
  pitch: { air: number; airMaxOmega: number; ground: number };
  grip: number;
  /** Cargo deck surface, chassis-local. */
  deck: { x0: number; x1: number; y: number; lip: number };
  /** Rider pose family used by the renderer. */
  rider: 'seated' | 'straddle';
  paint: string;
  accent: string;
}

export type CargoKind = 'standard' | 'fragile' | 'heavy' | 'flamingo';

export interface CargoSpec {
  id: string;
  kind: CargoKind;
  label: string;
  w: number;
  h: number;
  mass: number;
  required: boolean;
  /** Impact speed change (m/s) above which condition starts to drop. */
  damageThreshold: number;
  damageScale: number;
}

export type CargoState = 'onboard' | 'loose' | 'lost' | 'delivered';

export type SurfaceKind = 'asphalt' | 'concrete' | 'wood' | 'roof' | 'tile' | 'grass';

export interface RoadPath {
  id: string;
  points: Vec2[];
  surface: SurfaceKind;
  /** Bottom of the visual road body. */
  baseY: number;
}

export interface Solid {
  id: string;
  /** Closed outline, counter-clockwise. */
  outline: Vec2[];
  surface: SurfaceKind;
  style: 'roof' | 'terrace' | 'ramp' | 'wall' | 'dock' | 'deck';
}

export interface Rect {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

export interface CourseZone extends Rect {
  id: string;
  kind: 'shortcut' | 'prompt' | 'stunt';
  text?: string;
  /** For prompts: the control lesson this teaches (suppressed once learned). */
  lesson?: 'throttle' | 'brake' | 'pitch' | 'deliver';
  /** For stunts: bonus points + dispatch event. */
  bonus?: number;
  event?: string;
  /** For stunts: the jump must have taken off inside this x range. */
  takeoff?: [number, number];
  label?: string;
}

export interface DecorItem {
  kind: string;
  x: number;
  y?: number;
  z?: number;
  w?: number;
  h?: number;
  d?: number;
  rot?: number;
  s?: number;
  text?: string;
  small?: string;
  color?: string;
  variant?: number;
  /** Explicit base height (otherwise sampled from the main road). */
  base?: number;
}

export interface CourseSpec {
  id: string;
  name: string;
  district: string;
  destination: string;
  note: string;
  order: number;
  theme: 'sunset' | 'pier' | 'suburb';
  roads: RoadPath[];
  solids: Solid[];
  water: Rect[];
  killY: number;
  bounds: { x0: number; x1: number };
  start: Vec2;
  delivery: Rect;
  /** Wall at the end of the bay (visual + physical stop). */
  zones: CourseZone[];
  par: { fast: number; slow: number; express: number };
  decor: DecorItem[];
  /** Where the camera frames the title/attract shot. */
  attract: Vec2;
}

export interface Build {
  vehicle: VehicleId;
  preset: PresetId;
  suspension: 'standard' | 'comfort' | 'stunt';
  tires: 'road' | 'stunt';
  restraint: 'standard' | 'secure' | 'loose';
  paint: number;
}

export type PresetId = 'sensible' | 'regret' | 'secure';

export interface InputState {
  throttle: number; // 0..1
  brake: number; // 0..1
  pitch: number; // -1 (nose down) .. 1 (nose up)
}

export const NO_INPUT: InputState = { throttle: 0, brake: 0, pitch: 0 };
