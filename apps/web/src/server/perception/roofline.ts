import type { KitRoof } from '@/lib/object-kit';
import type { NormBox } from './schemas';

/**
 * Roofline from the SAM outline (PF-T3). Pure and deterministic, no pixels needed:
 * skyline `s(x)` = top of the outline per column (upper envelope), median-5 smoothed, then segmented
 * least squares (dynamic programming) with the number of segments chosen by BIC. Rising / falling
 * segment pairs are gables: their breakpoints give the peak, their fitted ends the eave line.
 * All values are box fractions (x 0 = box left, y 0 = box top, y down).
 */

type Ring = ReadonlyArray<readonly [number, number]>;

/** Columns sampled across the box. */
export const SKYLINE_COLUMNS = 128;
/** Most segments tried by the fit (6 gables + steps between them). */
export const MAX_SEGMENTS = 14;
/** Fewest columns in one segment. */
const MIN_SEGMENT = 3;
/** Skyline noise floor (half a row of a 128-row raster): keeps BIC finite on perfect lines. */
const NOISE = 0.5 / SKYLINE_COLUMNS;
/** A segment steeper than this (degrees, on the photo) rises or falls; flatter = flat. */
export const MIN_PITCH_DEG = 8;
/** Steeper than this = a vertical step (wall edge), not a roof slope. */
const MAX_PITCH_DEG = 75;
/** Gables narrower than this share of the box are noise. */
const MIN_GABLE_WIDTH = 0.06;
/** Roofs lower than this share of the box height are ignored (flat top). */
const MIN_ROOF_HEIGHT = 0.05;
export const MAX_ROOF_HEIGHT = 0.7;
export const MAX_GABLES = 6;

/** One fitted line `y = a + b·x` over columns [from, to]. */
export interface Segment {
  from: number;
  to: number;
  a: number;
  b: number;
}

/**
 * Top of the outline per column, in box fractions (NaN = no outline in that column). Exact: the topmost
 * crossing of the column's vertical line with any ring edge, which is where an even-odd polygon starts.
 */
export function skylineFromRings(
  rings: ReadonlyArray<Ring>,
  box: NormBox,
  columns = SKYLINE_COLUMNS
): Float64Array {
  const out = new Float64Array(columns).fill(NaN);
  if (box.w <= 0 || box.h <= 0) return out;
  for (let c = 0; c < columns; c++) {
    const x = box.x + ((c + 0.5) / columns) * box.w;
    let top = Infinity;
    for (const r of rings) {
      for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
        const [xi, yi] = r[i]!;
        const [xj, yj] = r[j]!;
        if (xi > x === xj > x) continue;
        const y = yi + ((x - xi) * (yj - yi)) / (xj - xi);
        if (y < top) top = y;
      }
    }
    if (Number.isFinite(top)) out[c] = Math.min(1, Math.max(0, (top - box.y) / box.h));
  }
  return out;
}

/** Running median over a window of 5 (shorter at the ends). */
export function median5(values: ArrayLike<number>): Float64Array {
  const n = values.length;
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const w: number[] = [];
    for (let k = Math.max(0, i - 2); k <= Math.min(n - 1, i + 2); k++) w.push(values[k]!);
    w.sort((p, q) => p - q);
    out[i] = w[w.length >> 1]!;
  }
  return out;
}

/**
 * Segmented least squares: for each segment count k ≤ `maxSegments`, the k lines with the least total
 * squared error (DP, O(k·n²) with prefix sums), then k = argmin BIC = n·ln(RSS/n + σ²) + (3k − 1)·ln n.
 */
export function segmentFit(
  xs: ArrayLike<number>,
  ys: ArrayLike<number>,
  maxSegments = MAX_SEGMENTS
): Segment[] {
  const n = xs.length;
  if (n < 2) return [];
  const S = { x: [0], y: [0], xx: [0], xy: [0], yy: [0] };
  for (let i = 0; i < n; i++) {
    const x = xs[i]!;
    const y = ys[i]!;
    S.x.push(S.x[i]! + x);
    S.y.push(S.y[i]! + y);
    S.xx.push(S.xx[i]! + x * x);
    S.xy.push(S.xy[i]! + x * y);
    S.yy.push(S.yy[i]! + y * y);
  }
  /** Line through points [i, j] and its squared error. */
  const line = (i: number, j: number) => {
    const m = j - i + 1;
    const sx = S.x[j + 1]! - S.x[i]!;
    const sy = S.y[j + 1]! - S.y[i]!;
    const sxx = S.xx[j + 1]! - S.xx[i]!;
    const sxy = S.xy[j + 1]! - S.xy[i]!;
    const syy = S.yy[j + 1]! - S.yy[i]!;
    const den = m * sxx - sx * sx;
    const b = den > 1e-12 ? (m * sxy - sx * sy) / den : 0;
    const a = (sy - b * sx) / m;
    const err = syy - 2 * a * sy - 2 * b * sxy + a * a * m + 2 * a * b * sx + b * b * sxx;
    return { a, b, err: Math.max(0, err) };
  };
  const minLen = Math.min(MIN_SEGMENT, n);
  const K = Math.max(1, Math.min(maxSegments, Math.floor(n / minLen)));
  // cost[k][j] = best error of points [0, j] with k + 1 segments; from[k][j] = start of the last one.
  const cost = Array.from({ length: K }, () => new Float64Array(n).fill(Infinity));
  const from = Array.from({ length: K }, () => new Int32Array(n).fill(-1));
  for (let j = minLen - 1; j < n; j++) {
    cost[0]![j] = line(0, j).err;
    from[0]![j] = 0;
  }
  for (let k = 1; k < K; k++) {
    for (let j = (k + 1) * minLen - 1; j < n; j++) {
      for (let i = k * minLen; i <= j - minLen + 1; i++) {
        const c = cost[k - 1]![i - 1]! + line(i, j).err;
        if (c < cost[k]![j]!) {
          cost[k]![j] = c;
          from[k]![j] = i;
        }
      }
    }
  }
  let best = 0;
  let bestBic = Infinity;
  for (let k = 0; k < K; k++) {
    const rss = cost[k]![n - 1]!;
    if (!Number.isFinite(rss)) continue;
    const bic = n * Math.log(rss / n + NOISE * NOISE) + (3 * (k + 1) - 1) * Math.log(n);
    if (bic < bestBic - 1e-9) {
      bestBic = bic;
      best = k;
    }
  }
  const segments: Segment[] = [];
  for (let k = best, j = n - 1; k >= 0 && j >= 0; k--) {
    const i = from[k]![j]!;
    const { a, b } = line(i, j);
    segments.unshift({ from: i, to: j, a, b });
    j = i - 1;
  }
  return segments;
}

export type SlopeKind = 'rise' | 'fall' | 'flat' | 'step';

/** Kind of a segment from its slope on the photo (`aspect` = box width / height in pixels). */
export function slopeKind(b: number, aspect: number): SlopeKind {
  const deg = (Math.atan(-b / (aspect > 0 ? aspect : 1)) * 180) / Math.PI;
  if (Math.abs(deg) > MAX_PITCH_DEG) return 'step';
  if (deg > MIN_PITCH_DEG) return 'rise';
  if (deg < -MIN_PITCH_DEG) return 'fall';
  return 'flat';
}

/** Roof measured on the outline, with the mean pitch (degrees, for the logs). */
export interface RoofMeasure {
  roof: KitRoof;
  pitch: number;
}

/**
 * Skyline (box fractions per column, NaN = none) → gables and eave line, or null when the top is flat,
 * the outline covers under half of the columns, or the roof is too low.
 */
export function roofFromSkyline(skyline: ArrayLike<number>, aspect: number): RoofMeasure | null {
  const n = skyline.length;
  const xs: number[] = [];
  const raw: number[] = [];
  for (let c = 0; c < n; c++) {
    if (Number.isNaN(skyline[c]!)) continue;
    xs.push((c + 0.5) / n);
    raw.push(skyline[c]!);
  }
  if (xs.length < Math.max(8, n / 2)) return null;
  const ys = median5(raw);
  const segs = segmentFit(xs, ys).map((s) => ({
    ...s,
    x0: xs[s.from]!,
    x1: xs[s.to]!,
    kind: slopeKind(s.b, aspect),
  }));
  const at = (s: Segment, x: number) => s.a + s.b * x;

  type Open = { x0: number; base: number; peak: number; top: number; slopes: number[] };
  const gables: Array<KitRoof['gables'][number] & { bases: number[]; slopes: number[] }> = [];
  let open: Open | null = null;
  const close = (x1: number, base: number) => {
    if (open && x1 - open.x0 >= MIN_GABLE_WIDTH) {
      gables.push({
        x0: open.x0,
        x1,
        peak: open.peak,
        top: open.top,
        bases: [open.base, base],
        slopes: open.slopes,
      });
    }
    open = null;
  };
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i]!;
    if (s.kind === 'rise') {
      if (open) close(s.x0, at(s, s.x0));
      open = { x0: s.x0, base: at(s, s.x0), peak: s.x1, top: at(s, s.x1), slopes: [s.b] };
    } else if (s.kind === 'flat') {
      // A short flat at the top of a rise (hip, ridge seen at an angle) moves the peak to its middle.
      if (open && Math.abs(at(s, s.x0) - open.top) < 0.05 && s.x1 - s.x0 < 0.15) {
        open.peak = (s.x0 + s.x1) / 2;
        open.top = Math.min(open.top, at(s, s.x0), at(s, s.x1));
      } else if (open) close(s.x0, open.base);
    } else if (s.kind === 'fall') {
      const top = at(s, s.x0);
      if (!open) open = { x0: s.x0, base: top, peak: s.x0, top, slopes: [] };
      open.slopes.push(s.b);
      open.top = Math.min(open.top, top);
      close(s.x1, at(s, s.x1));
    } else if (open) {
      close(s.x0, open.base);
    }
  }
  // A rise still open at the right edge: half a gable, peak on the edge.
  if (open) close((open as Open).peak, (open as Open).base);
  if (!gables.length) return null;

  const bases = gables.flatMap((g) => g.bases).sort((p, q) => p - q);
  const eave = Math.min(1, bases[bases.length >> 1]!);
  const ridge = Math.max(0, Math.min(...gables.map((g) => g.top)));
  const height = Math.min(MAX_ROOF_HEIGHT, eave - ridge);
  if (!(height >= MIN_ROOF_HEIGHT)) return null;
  const slopes = gables.flatMap((g) => g.slopes);
  const pitch =
    slopes.reduce((s, b) => s + Math.abs(Math.atan(b / (aspect > 0 ? aspect : 1))), 0) /
    Math.max(1, slopes.length);
  const r3 = (v: number) => Math.round(v * 1000) / 1000;
  return {
    roof: {
      eave: r3(eave),
      gables: gables.slice(0, MAX_GABLES).map((g) => ({
        x0: r3(Math.max(0, g.x0)),
        x1: r3(Math.min(1, g.x1)),
        peak: r3(Math.min(Math.max(g.peak, g.x0), g.x1)),
        top: r3(Math.max(eave - MAX_ROOF_HEIGHT, Math.min(g.top, eave - MIN_ROOF_HEIGHT))),
      })),
    },
    pitch: Math.round((pitch * 180) / Math.PI),
  };
}

/** SAM outline rings (photo fractions) → measured roof of the object in `box`, or null. */
export function measureRoof(
  rings: ReadonlyArray<Ring>,
  box: NormBox,
  aspect: number
): RoofMeasure | null {
  return roofFromSkyline(skylineFromRings(rings, box), aspect);
}
