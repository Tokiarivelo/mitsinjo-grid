/**
 * Repetition along the object (PF-T4): how many houses in a row, how many windows per house.
 * Pure and deterministic. Vertical-edge energy `e(x) = Σ_y |∂I/∂x|` inside the mask, then the
 * normalised autocorrelation `R(τ)`: its first strong peak is the repetition period `P`.
 */

/** Grey levels of the object box (0–1, row-major) and which pixels are inside the SAM outline. */
export interface GrayGrid {
  width: number;
  height: number;
  gray: Float32Array;
  mask: Uint8Array;
}

/** A peak of `R(τ)` under this is not a repetition (noise, one-off features). */
export const MIN_PERIOD_PEAK = 0.35;
export const MAX_UNITS = 8;
const MAX_WINDOWS_PER_UNIT = 4;

/**
 * Edge energy per column over rows [`from`, `to`) (box fractions), counting only the horizontal steps
 * between two mask pixels (the outline itself is not an edge of the object).
 */
export function edgeEnergy(g: GrayGrid, from = 0, to = 1): Float64Array {
  const e = new Float64Array(g.width);
  const y0 = Math.max(0, Math.floor(from * g.height));
  const y1 = Math.min(g.height, Math.ceil(to * g.height));
  for (let y = y0; y < y1; y++) {
    const row = y * g.width;
    for (let x = 0; x + 1 < g.width; x++) {
      if (!g.mask[row + x] || !g.mask[row + x + 1]) continue;
      e[x] = e[x]! + Math.abs(g.gray[row + x + 1]! - g.gray[row + x]!);
    }
  }
  return e;
}

/** First and last column that holds a mask pixel (−1, −1 when empty). */
export function maskColumns(g: GrayGrid): [number, number] {
  let first = -1;
  let last = -1;
  for (let x = 0; x < g.width; x++) {
    for (let y = 0; y < g.height; y++) {
      if (g.mask[y * g.width + x]) {
        if (first < 0) first = x;
        last = x;
        break;
      }
    }
  }
  return [first, last];
}

/** Normalised autocorrelation `R(τ)` for τ = 0…n−1 (R(0) = 1; mean removed; unbiased per lag). */
export function autocorrelation(signal: ArrayLike<number>): Float64Array {
  const n = signal.length;
  const R = new Float64Array(n);
  if (n === 0) return R;
  let mean = 0;
  for (let i = 0; i < n; i++) mean += signal[i]!;
  mean /= n;
  const c = Float64Array.from({ length: n }, (_, i) => signal[i]! - mean);
  let v = 0;
  for (let i = 0; i < n; i++) v += c[i]! * c[i]!;
  if (v <= 1e-12) return R;
  v /= n;
  for (let t = 0; t < n; t++) {
    let s = 0;
    for (let i = 0; i + t < n; i++) s += c[i]! * c[i + t]!;
    R[t] = s / (n - t) / v;
  }
  return R;
}

/** First local maximum of `R` above `MIN_PERIOD_PEAK` with τ in [lo, hi], or null. */
export function firstPeak(
  R: ArrayLike<number>,
  lo: number,
  hi: number
): { period: number; strength: number } | null {
  for (let t = Math.max(1, Math.ceil(lo)); t <= Math.min(R.length - 2, Math.floor(hi)); t++) {
    const r = R[t]!;
    if (r > MIN_PERIOD_PEAK && r > R[t - 1]! && r >= R[t + 1]!) return { period: t, strength: r };
  }
  return null;
}

export interface Repetition {
  /** Houses side by side (1 = no repetition found). */
  units: number;
  /** Windows per house on the wall band, when a window period was found. */
  windowsPerUnit?: number;
  /** `R(P)` of the unit period, 0 when none (confidence, PF-T7). */
  strength: number;
}

/**
 * Units along the row and windows per unit. `wallFrom` = top of the wall band (box fraction): units are read
 * only on the roof band above it (gables, chimneys: window edges on the walls would read as false
 * houses); windows only on the walls. Periods are searched where
 * they make sense: 2…`MAX_UNITS` units over the mask width, windows strictly shorter than one unit.
 */
export function measureRepetition(g: GrayGrid, wallFrom = 0.4): Repetition {
  const [first, last] = maskColumns(g);
  const W = last - first + 1;
  if (first < 0 || W < 16) return { units: 1, strength: 0 };
  const crop = (e: Float64Array) => e.subarray(first, last + 1);
  const unit = firstPeak(autocorrelation(crop(edgeEnergy(g, 0, wallFrom))), W / MAX_UNITS, W / 2);
  const units = unit ? Math.max(1, Math.min(MAX_UNITS, Math.round(W / unit.period))) : 1;
  const span = unit ? unit.period : W;
  const win = firstPeak(
    autocorrelation(crop(edgeEnergy(g, wallFrom, 1))),
    span / (MAX_WINDOWS_PER_UNIT + 0.5),
    span / 1.5
  );
  const windowsPerUnit = win
    ? Math.max(1, Math.min(MAX_WINDOWS_PER_UNIT, Math.round(span / win.period)))
    : undefined;
  return {
    units,
    ...(windowsPerUnit ? { windowsPerUnit } : {}),
    strength: unit ? Math.round(unit.strength * 100) / 100 : 0,
  };
}
