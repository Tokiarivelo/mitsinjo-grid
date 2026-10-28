/**
 * Pure helpers to move "electron" dots along a cable polyline (3D scene and 2D
 * diagrams). Visual only: the flow rate comes from `LineFlowSceneModel.speed`.
 */

export type Vec = readonly number[];

export interface ArcPath {
  points: Vec[];
  /** Cumulative length at each point (cum[0] = 0). */
  cum: number[];
  total: number;
}

export function buildArcPath(points: Vec[]): ArcPath {
  const cum = [0];
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    let sq = 0;
    for (let k = 0; k < a.length; k++) sq += ((b[k] ?? 0) - (a[k] ?? 0)) ** 2;
    total += Math.sqrt(sq);
    cum.push(total);
  }
  return { points, cum, total };
}

/**
 * Write the point at fraction `t` (wrapped into [0, 1)) of the path into `out`.
 * Allocation-free so it can run inside `useFrame`.
 */
export function sampleArcPath(path: ArcPath, t: number, out: number[]): number[] {
  const { points, cum, total } = path;
  const first = points[0];
  if (!first) return out;
  if (points.length === 1 || total === 0) {
    for (let k = 0; k < first.length; k++) out[k] = first[k]!;
    return out;
  }
  const d = (((t % 1) + 1) % 1) * total;
  // Binary search the segment containing distance d.
  let lo = 0;
  let hi = cum.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (cum[mid]! <= d) lo = mid;
    else hi = mid;
  }
  const a = points[lo]!;
  const b = points[hi]!;
  const span = cum[hi]! - cum[lo]!;
  const f = span > 0 ? (d - cum[lo]!) / span : 0;
  for (let k = 0; k < a.length; k++) out[k] = a[k]! + ((b[k] ?? 0) - a[k]!) * f;
  return out;
}

/** Dots on a cable: one every `spacing` units, clamped to [min, max]. */
export function electronCount(length: number, spacing: number, min = 3, max = 24): number {
  if (!(length > 0) || !(spacing > 0)) return 0;
  return Math.max(min, Math.min(max, Math.round(length / spacing)));
}

/** Seconds for one dot to travel the whole cable at `speed` units/s (≥ 0.2 s). */
export function electronPeriodS(length: number, speed: number): number {
  if (!(speed > 0)) return Infinity;
  return Math.max(0.2, length / speed);
}

/** SVG path `d` for a 2D polyline. */
export function toSvgPath(points: Vec[]): string {
  return points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${(p[0] ?? 0).toFixed(1)} ${(p[1] ?? 0).toFixed(1)}`)
    .join(' ');
}
