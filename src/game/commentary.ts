import type { Line } from '../data/humor';

export interface CommentaryOptions {
  cooldown: number; // seconds between non-essential lines
  noRepeatRuns: number; // don't reuse a line within this many runs
}

/**
 * Picks at most one dispatch line at a time, spaced out, never repeating a
 * recent line, and only for events that actually happened.
 */
export class Commentary {
  private lastTime = -Infinity;
  private recent: string[][] = [[]];
  constructor(
    private lines: Line[],
    private opts: CommentaryOptions = { cooldown: 12, noRepeatRuns: 4 },
    private rand: () => number = Math.random,
  ) {}

  newRun() {
    this.recent.push([]);
    while (this.recent.length > this.opts.noRepeatRuns) this.recent.shift();
    // A fresh attempt may open with a line right away.
    this.lastTime = -Infinity;
  }

  private used(id: string) {
    return this.recent.some((r) => r.includes(id));
  }

  pick(event: string, now: number, course: string, force = false): Line | null {
    if (!force && now - this.lastTime < this.opts.cooldown) return null;
    const pool = this.lines.filter((l) => l.event === event && (!l.course || l.course === course));
    if (!pool.length) return null;
    // Prefer course-specific lines when present.
    const specific = pool.filter((l) => l.course === course);
    const candidates = (specific.length && this.rand() < 0.6 ? specific : pool).filter((l) => !this.used(l.id));
    const choice = (candidates.length ? candidates : pool)[Math.floor(this.rand() * (candidates.length || pool.length))];
    if (!choice) return null;
    this.recent[this.recent.length - 1].push(choice.id);
    this.lastTime = now;
    return choice;
  }
}
