import type { Build } from '../sim/types';
import { DEFAULT_BUILD } from '../data/vehicles';
import type { RunResult } from './run';
import { creditsFor } from './scoring';

export const SAVE_KEY = 'slingmods-send-it-v1';

export interface Settings {
  master: number;
  music: number;
  sfx: number;
  voice: number;
  muted: boolean;
  reducedMotion: boolean;
  shake: boolean;
  uiScale: number;
  autoBalance: boolean;
  quality: 'high' | 'low';
  touchControls: 'auto' | 'on' | 'off';
}

export interface CourseRecord {
  bestScore: number;
  bestTime: number | null;
  bestBuild: Build | null;
  bestAssist: boolean;
  stamps: { delivered: boolean; allAccounted: boolean; express: boolean };
  attempts: number;
  passes: number;
}

export interface SaveData {
  version: 1;
  settings: Settings;
  credits: number;
  owned: string[]; // equipment ids like 'suspension:comfort', 'paint:2'
  build: Build;
  lastCourse: string;
  records: Record<string, CourseRecord>;
  achievements: string[];
  processed: string[]; // attempt ids already rewarded
  firstRunDone: boolean;
  lessons: { throttle: boolean; brake: boolean; pitch: boolean };
  stats: { deliveries: number; parcels: number; pools: number; flips: number };
}

export const DEFAULT_SETTINGS: Settings = {
  master: 0.9,
  music: 0.55,
  sfx: 0.85,
  voice: 0.9,
  muted: false,
  reducedMotion: false,
  shake: true,
  uiScale: 1,
  autoBalance: false,
  quality: 'high',
  touchControls: 'auto',
};

export function defaultSave(): SaveData {
  const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  return {
    version: 1,
    settings: { ...DEFAULT_SETTINGS, reducedMotion: !!reduced, shake: !reduced },
    credits: 0,
    owned: [],
    build: { ...DEFAULT_BUILD },
    lastCourse: 'sunset',
    records: {},
    achievements: [],
    processed: [],
    firstRunDone: false,
    lessons: { throttle: false, brake: false, pitch: false },
    stats: { deliveries: 0, parcels: 0, pools: 0, flips: 0 },
  };
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Merge whatever was stored onto defaults; tolerate missing/new fields. */
export function sanitize(raw: unknown): SaveData {
  const d = defaultSave();
  if (!isObj(raw) || raw.version !== 1) return d;
  const num = (v: unknown, def: number, lo = -Infinity, hi = Infinity) => (typeof v === 'number' && isFinite(v) ? Math.min(hi, Math.max(lo, v)) : def);
  const bool = (v: unknown, def: boolean) => (typeof v === 'boolean' ? v : def);
  const s = isObj(raw.settings) ? raw.settings : {};
  d.settings = {
    master: num(s.master, d.settings.master, 0, 1),
    music: num(s.music, d.settings.music, 0, 1),
    sfx: num(s.sfx, d.settings.sfx, 0, 1),
    voice: num(s.voice, d.settings.voice, 0, 1),
    muted: bool(s.muted, false),
    reducedMotion: bool(s.reducedMotion, d.settings.reducedMotion),
    shake: bool(s.shake, d.settings.shake),
    uiScale: num(s.uiScale, 1, 0.8, 1.4),
    autoBalance: bool(s.autoBalance, false),
    quality: s.quality === 'low' ? 'low' : 'high',
    touchControls: s.touchControls === 'on' || s.touchControls === 'off' ? s.touchControls : 'auto',
  };
  d.credits = Math.floor(num(raw.credits, 0, 0, 1e9));
  d.owned = Array.isArray(raw.owned) ? raw.owned.filter((x): x is string => typeof x === 'string') : [];
  if (isObj(raw.build)) d.build = { ...d.build, ...(raw.build as Partial<Build>) };
  d.lastCourse = typeof raw.lastCourse === 'string' ? raw.lastCourse : d.lastCourse;
  if (isObj(raw.records)) {
    for (const [k, r] of Object.entries(raw.records)) {
      if (!isObj(r)) continue;
      const st = isObj(r.stamps) ? r.stamps : {};
      d.records[k] = {
        bestScore: num(r.bestScore, 0, 0),
        bestTime: typeof r.bestTime === 'number' ? r.bestTime : null,
        bestBuild: isObj(r.bestBuild) ? (r.bestBuild as unknown as Build) : null,
        bestAssist: bool(r.bestAssist, false),
        stamps: { delivered: bool(st.delivered, false), allAccounted: bool(st.allAccounted, false), express: bool(st.express, false) },
        attempts: num(r.attempts, 0, 0),
        passes: num(r.passes, 0, 0),
      };
    }
  }
  d.achievements = Array.isArray(raw.achievements) ? raw.achievements.filter((x): x is string => typeof x === 'string') : [];
  d.processed = Array.isArray(raw.processed) ? raw.processed.filter((x): x is string => typeof x === 'string').slice(-100) : [];
  d.firstRunDone = bool(raw.firstRunDone, false);
  if (isObj(raw.lessons)) d.lessons = { throttle: bool(raw.lessons.throttle, false), brake: bool(raw.lessons.brake, false), pitch: bool(raw.lessons.pitch, false) };
  if (isObj(raw.stats)) {
    const st = raw.stats;
    d.stats = { deliveries: num(st.deliveries, 0, 0), parcels: num(st.parcels, 0, 0), pools: num(st.pools, 0, 0), flips: num(st.flips, 0, 0) };
  }
  return d;
}

export interface StorageLike {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
}

/** Persistence with graceful fallback to a temporary session. */
export class SaveStore {
  data: SaveData;
  persistent = true;
  constructor(private storage: StorageLike | null) {
    let raw: unknown = null;
    try {
      const s = storage?.getItem(SAVE_KEY);
      raw = s ? JSON.parse(s) : null;
      if (!storage) this.persistent = false;
    } catch {
      this.persistent = false;
    }
    this.data = sanitize(raw);
  }
  save() {
    if (!this.storage) return;
    try {
      this.storage.setItem(SAVE_KEY, JSON.stringify(this.data));
      this.persistent = true;
    } catch {
      this.persistent = false;
    }
  }
}

export interface Reward {
  credits: number;
  newStamps: string[];
  firstClear: boolean;
  personalBest: boolean;
  newAchievements: string[];
  alreadyProcessed: boolean;
}

export const ACHIEVEMENTS: Record<string, { title: string; desc: string }> = {
  ground_shipping: { title: 'Ground Shipping', desc: 'Pass a contract by the safe route.' },
  pool_policy: { title: 'Pool Policy', desc: 'Find out what the pool is for.' },
  five_star: { title: 'Five-Star Delivery', desc: 'All five parcels, clean.' },
  last_box_standing: { title: 'Last Box Standing', desc: 'Reach the bay with exactly one parcel.' },
  return_label: { title: 'Return Label', desc: 'Recover a parcel and deliver it.' },
  pink_slip: { title: 'Pink Slip', desc: 'Deliver the flamingo.' },
  letter_of_the_law: { title: 'The Letter of the Law', desc: 'Pass with exactly three parcels.' },
  air_mail: { title: 'Air Mail', desc: 'Bank a flip and still deliver.' },
  we_meant_the_driveway: { title: 'We Meant the Driveway', desc: 'Pass HOA No via the rooftops.' },
  empty_promises: { title: 'Empty Promises', desc: 'Arrive with zero parcels.' },
};

/** Apply a result exactly once (keyed by attempt id). */
export function applyResult(save: SaveData, r: RunResult): Reward {
  const reward: Reward = { credits: 0, newStamps: [], firstClear: false, personalBest: false, newAchievements: [], alreadyProcessed: false };
  if (save.processed.includes(r.attemptId)) {
    reward.alreadyProcessed = true;
    return reward;
  }
  save.processed.push(r.attemptId);
  if (save.processed.length > 100) save.processed.splice(0, save.processed.length - 100);

  const rec: CourseRecord = save.records[r.courseId] ?? {
    bestScore: 0,
    bestTime: null,
    bestBuild: null,
    bestAssist: false,
    stamps: { delivered: false, allAccounted: false, express: false },
    attempts: 0,
    passes: 0,
  };
  rec.attempts++;
  if (r.passed) {
    reward.firstClear = rec.passes === 0;
    rec.passes++;
    for (const k of ['delivered', 'allAccounted', 'express'] as const) {
      if (r.stamps[k] && !rec.stamps[k]) {
        rec.stamps[k] = true;
        reward.newStamps.push(k);
      }
    }
    if (r.score.total > rec.bestScore) {
      reward.personalBest = rec.bestScore > 0;
      rec.bestScore = r.score.total;
      rec.bestBuild = { ...r.build };
      rec.bestAssist = r.assist;
    }
    if (rec.bestTime === null || r.time < rec.bestTime) rec.bestTime = r.time;
    save.stats.deliveries++;
    save.stats.parcels += r.delivered;
  }
  if (r.failReason === 'pool') save.stats.pools++;
  save.stats.flips += r.flips;
  save.records[r.courseId] = rec;

  reward.credits = creditsFor({ passed: r.passed, total: r.score.total, firstClear: reward.firstClear, newStamps: reward.newStamps.length, style: r.style });
  save.credits += reward.credits;

  const earn = (id: string, cond: boolean) => {
    if (cond && !save.achievements.includes(id)) {
      save.achievements.push(id);
      reward.newAchievements.push(id);
    }
  };
  const reached = r.failReason === null || r.failReason === 'insufficient';
  earn('ground_shipping', r.passed && r.route === 'safe');
  earn('pool_policy', r.failReason === 'pool');
  earn('five_star', r.stamps.allAccounted);
  earn('last_box_standing', reached && r.delivered === 1);
  earn('return_label', r.passed && r.recovered);
  earn('pink_slip', r.flamingo);
  earn('letter_of_the_law', r.passed && r.delivered === 3);
  earn('air_mail', r.passed && r.flips > 0);
  earn('we_meant_the_driveway', r.passed && r.courseId === 'hoa' && r.route === 'shortcut');
  earn('empty_promises', reached && r.delivered === 0);
  return reward;
}
