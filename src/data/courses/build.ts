import type { CourseSpec, Rect, Solid, SurfaceKind, Vec2 } from '../../sim/types';

/** Authoring helper: builds a road profile from simple segments. */
export class Path {
  pts: Vec2[];
  constructor(x: number, y: number) {
    this.pts = [[x, y]];
  }
  get x() {
    return this.pts[this.pts.length - 1][0];
  }
  get y() {
    return this.pts[this.pts.length - 1][1];
  }
  /** Straight segment. */
  line(x: number, y = this.y) {
    this.pts.push([x, y]);
    return this;
  }
  /** Smooth (cosine) blend to a new height. */
  ease(x: number, y: number, step = 1) {
    const x0 = this.x;
    const y0 = this.y;
    const n = Math.max(2, Math.ceil((x - x0) / step));
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      const e = (1 - Math.cos(Math.PI * t)) / 2;
      this.pts.push([x0 + (x - x0) * t, y0 + (y - y0) * e]);
    }
    return this;
  }
  /** Concave launch ramp (curves up, steepest at the lip). */
  kicker(x: number, y: number, step = 0.5) {
    const x0 = this.x;
    const y0 = this.y;
    const n = Math.max(3, Math.ceil((x - x0) / step));
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      this.pts.push([x0 + (x - x0) * t, y0 + (y - y0) * t * t]);
    }
    return this;
  }
  /** Convex landing: starts steep, flattens out. */
  landing(x: number, y: number, step = 0.5) {
    const x0 = this.x;
    const y0 = this.y;
    const n = Math.max(3, Math.ceil((x - x0) / step));
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      const e = 1 - (1 - t) * (1 - t);
      this.pts.push([x0 + (x - x0) * t, y0 + (y - y0) * e]);
    }
    return this;
  }
  /** Rounded hump of the given height. */
  bump(len: number, h: number) {
    const x0 = this.x;
    const y0 = this.y;
    const n = Math.max(4, Math.ceil(len / 0.4));
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      this.pts.push([x0 + len * t, y0 + h * Math.sin(Math.PI * t)]);
    }
    return this;
  }
  done(): Vec2[] {
    return this.pts;
  }
}

/** A slab with a flat top (optionally with a profile on top). */
export function slab(id: string, top: Vec2[], thickness: number, surface: SurfaceKind, style: Solid['style']): Solid {
  const bottom = top
    .slice()
    .reverse()
    .map(([x, y]) => [x, y - thickness] as Vec2);
  // CCW: bottom left->right then top right->left.
  const outline: Vec2[] = [...bottom.reverse(), ...top.slice().reverse()];
  return { id, outline, surface, style };
}

export function box(id: string, r: Rect, surface: SurfaceKind, style: Solid['style']): Solid {
  return {
    id,
    outline: [
      [r.x0, r.y0],
      [r.x1, r.y0],
      [r.x1, r.y1],
      [r.x0, r.y1],
    ],
    surface,
    style,
  };
}

/** Height of a polyline at x (or null when outside). */
export function heightAt(points: Vec2[], x: number): number | null {
  for (let i = 0; i < points.length - 1; i++) {
    const [ax, ay] = points[i];
    const [bx, by] = points[i + 1];
    if (x >= ax && x <= bx && bx > ax) return ay + ((x - ax) / (bx - ax)) * (by - ay);
  }
  return null;
}

/** Load-time validation: an authoring error must be loud, not a player driving forever. */
export function validateCourse(c: CourseSpec): string[] {
  const errs: string[] = [];
  if (!c.roads.length) errs.push('no roads');
  if (!(c.delivery.x1 > c.delivery.x0 && c.delivery.y1 > c.delivery.y0)) errs.push('delivery zone is empty');
  if (c.start[0] < c.bounds.x0 || c.start[0] > c.bounds.x1) errs.push('start outside bounds');
  if (c.delivery.x1 > c.bounds.x1) errs.push('delivery outside bounds');
  if (!(c.par.fast < c.par.express && c.par.express < c.par.slow)) errs.push('par thresholds out of order');
  for (const r of c.roads) {
    for (let i = 1; i < r.points.length; i++) {
      if (r.points[i][0] < r.points[i - 1][0] - 1e-6) errs.push(`road ${r.id} goes backwards at ${i}`);
    }
  }
  const road = c.roads[0];
  if (road && heightAt(road.points, c.start[0]) === null) errs.push('start not above main road');
  return errs;
}
