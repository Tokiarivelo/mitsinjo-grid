import type { Pt } from './shapes';

/** Edge strength of a small copy of the photo (Sobel), for the magnetic lasso. */
export interface EdgeMap {
  width: number;
  height: number;
  /** Gradient magnitude per pixel, row by row. */
  mag: Float32Array;
  max: number;
}

/** Longest side of the analysed copy: enough to follow an outline, cheap to compute. */
export const EDGE_MAP_SIDE = 320;
/** How far the lasso looks for an edge around the pointer (fraction of the photo's longest side). */
export const SNAP_RADIUS = 0.03;
/** An edge weaker than this share of the strongest one is ignored (flat areas, noise). */
export const SNAP_MIN_RATIO = 0.25;

/** RGBA pixels → Sobel gradient magnitude on luminance. */
export function buildEdgeMap(rgba: ArrayLike<number>, width: number, height: number): EdgeMap {
  const lum = new Float32Array(width * height);
  for (let i = 0; i < width * height; i++) {
    lum[i] = 0.299 * rgba[i * 4]! + 0.587 * rgba[i * 4 + 1]! + 0.114 * rgba[i * 4 + 2]!;
  }
  const mag = new Float32Array(width * height);
  let max = 0;
  const at = (x: number, y: number) => lum[y * width + x]!;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const gx =
        at(x + 1, y - 1) +
        2 * at(x + 1, y) +
        at(x + 1, y + 1) -
        at(x - 1, y - 1) -
        2 * at(x - 1, y) -
        at(x - 1, y + 1);
      const gy =
        at(x - 1, y + 1) +
        2 * at(x, y + 1) +
        at(x + 1, y + 1) -
        at(x - 1, y - 1) -
        2 * at(x, y - 1) -
        at(x + 1, y - 1);
      const m = Math.hypot(gx, gy);
      mag[y * width + x] = m;
      if (m > max) max = m;
    }
  }
  return { width, height, mag, max };
}

/**
 * Pointer → strongest nearby edge (the « magnet »), nearer edges preferred on ties. No edge strong
 * enough within the radius (or a blank map) → the pointer itself.
 */
export function snapToEdge(map: EdgeMap, p: Pt, radius = SNAP_RADIUS): Pt {
  if (map.max <= 0) return p;
  const cx = Math.round(p[0] * (map.width - 1));
  const cy = Math.round(p[1] * (map.height - 1));
  const r = Math.max(1, Math.round(radius * Math.max(map.width, map.height)));
  const floor = SNAP_MIN_RATIO * map.max;
  let best: { x: number; y: number; score: number } | null = null;
  for (let y = Math.max(0, cy - r); y <= Math.min(map.height - 1, cy + r); y++) {
    for (let x = Math.max(0, cx - r); x <= Math.min(map.width - 1, cx + r); x++) {
      const d = Math.hypot(x - cx, y - cy);
      if (d > r) continue;
      const m = map.mag[y * map.width + x]!;
      if (m < floor) continue;
      // Strength, lightly discounted with distance so the lasso does not jump far.
      const score = m * (1 - 0.5 * (d / r));
      if (!best || score > best.score) best = { x, y, score };
    }
  }
  if (!best) return p;
  return [best.x / (map.width - 1), best.y / (map.height - 1)];
}
