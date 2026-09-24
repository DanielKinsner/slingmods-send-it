// Score model. Style cap raised from the plan's 2,500 to 4,000 once air tricks
// became a core loop; delivery still dominates (a failed run scores 0).
// A perfect standard run caps at 11,500 before the optional flamingo bonus.

export const SCORE = {
  perParcel: 1000,
  conditionMax: 200,
  timeMax: 1500,
  styleCap: 4000,
  flamingo: 300,
  cleanThreshold: 0.8,
};

export interface ScoreInput {
  passed: boolean;
  /** Conditions (0..1) of delivered required parcels. */
  delivered: number[];
  required: number;
  time: number;
  par: { fast: number; slow: number; express: number };
  style: number;
  flamingo: boolean;
}

export interface ScoreBreakdown {
  delivery: number;
  condition: number;
  time: number;
  style: number;
  bonus: number;
  total: number;
}

export interface Stamps {
  delivered: boolean;
  allAccounted: boolean;
  express: boolean;
}

export function timeBonus(time: number, par: { fast: number; slow: number }): number {
  if (time <= par.fast) return SCORE.timeMax;
  if (time >= par.slow) return 0;
  return Math.round(SCORE.timeMax * (1 - (time - par.fast) / (par.slow - par.fast)));
}

export function scoreRun(i: ScoreInput): ScoreBreakdown {
  if (!i.passed) {
    return { delivery: 0, condition: 0, time: 0, style: 0, bonus: 0, total: 0 };
  }
  const delivery = i.delivered.length * SCORE.perParcel;
  const condition = Math.round(i.delivered.reduce((s, c) => s + Math.max(0, Math.min(1, c)) * SCORE.conditionMax, 0));
  const time = timeBonus(i.time, i.par);
  const style = Math.min(SCORE.styleCap, Math.max(0, Math.round(i.style)));
  const bonus = i.flamingo ? SCORE.flamingo : 0;
  return { delivery, condition, time, style, bonus, total: delivery + condition + time + style + bonus };
}

export function stampsFor(i: ScoreInput): Stamps {
  const avg = i.delivered.length ? i.delivered.reduce((s, c) => s + c, 0) / i.delivered.length : 0;
  return {
    delivered: i.passed,
    allAccounted: i.passed && i.delivered.length === i.required && avg >= SCORE.cleanThreshold,
    express: i.passed && i.time <= i.par.express,
  };
}

/** Fictional Shop Credit for a result. Never negative. */
export function creditsFor(opts: { passed: boolean; total: number; firstClear: boolean; newStamps: number; style: number }): number {
  if (!opts.passed) return Math.min(40, Math.floor(opts.style / 60));
  return Math.round(opts.total / 25) + (opts.firstClear ? 300 : 0) + opts.newStamps * 150;
}
