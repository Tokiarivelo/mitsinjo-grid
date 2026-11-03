/**
 * Visual hull of an object seen from the front and from the side (PV-H): the front silhouette
 * (`points`, x right / y up) extruded along z, intersected with the side silhouette (`section`,
 * z toward the front / y up) extruded along x. Unit space: both rings within ±0.5, the hull fills
 * the 1 × 1 × 1 box. Pure helpers shared by the server render and the 3D view.
 */

export type Ring = ReadonlyArray<readonly [number, number]>;

/**
 * Outer extent [lo, hi] of the ring's first coordinate on the line where its second coordinate is
 * `v` (e.g. x span of a front ring at height y), or null when the line misses the ring.
 */
export function spanAt(ring: Ring, v: number): [number, number] | null {
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [ax, ay] = ring[j]!;
    const [bx, by] = ring[i]!;
    if ((ay <= v && by >= v) || (by <= v && ay >= v)) {
      const t = by === ay ? 0.5 : (v - ay) / (by - ay);
      const u = ax + (bx - ax) * t;
      lo = Math.min(lo, u);
      hi = Math.max(hi, u);
    }
  }
  return lo <= hi ? [lo, hi] : null;
}

/** The ring with its coordinates swapped ([a, b] → [b, a]). */
export const swapRing = (ring: Ring): Array<[number, number]> => ring.map(([a, b]) => [b, a]);

/** Range of the ring's coordinate `k` (0 or 1). */
export function ringRange(ring: Ring, k: 0 | 1): [number, number] {
  let lo = Infinity;
  let hi = -Infinity;
  for (const p of ring) {
    lo = Math.min(lo, p[k]);
    hi = Math.max(hi, p[k]);
  }
  return [lo, hi];
}

/**
 * The part of a ring inside the box [a0, a1] × [b0, b1] (Sutherland–Hodgman: the box is convex,
 * the ring may not be). Empty when they do not overlap. Pure.
 */
export function clipRing(
  ring: Ring,
  a0: number,
  a1: number,
  b0: number,
  b1: number
): Array<[number, number]> {
  const edges: Array<{ k: 0 | 1; v: number; keep: 1 | -1 }> = [
    { k: 0, v: a0, keep: 1 },
    { k: 0, v: a1, keep: -1 },
    { k: 1, v: b0, keep: 1 },
    { k: 1, v: b1, keep: -1 },
  ];
  let out: Array<[number, number]> = ring.map(([a, b]) => [a, b]);
  for (const { k, v, keep } of edges) {
    const inside = (p: readonly [number, number]) => (p[k] - v) * keep >= 0;
    const next: Array<[number, number]> = [];
    for (let i = 0; i < out.length; i++) {
      const p = out[i]!;
      const q = out[(i + 1) % out.length]!;
      if (inside(p)) next.push(p);
      if (inside(p) !== inside(q)) {
        const t = (v - p[k]) / (q[k] - p[k]);
        next.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
      }
    }
    out = next;
    if (!out.length) break;
  }
  return out;
}

/** Slices along z and levels per slice side of the 3D view's hull mesh (≈ 1.6 k triangles). */
export const HULL_SLICES = 28;
export const HULL_LEVELS = 14;

/**
 * Hull cross-sections, one closed loop per z slice (front → back order: rising z): the slice's
 * height range read on the side ring, each level's width read on the front ring. Each loop runs
 * up the right side then down the left (counter-clockwise seen from +z), `2 × levels` points.
 */
export function hullLoops(
  points: Ring,
  section: Ring,
  slices = HULL_SLICES,
  levels = HULL_LEVELS
): Array<{ z: number; loop: Array<[number, number]> }> {
  const [z0, z1] = ringRange(section, 0);
  const [fy0, fy1] = ringRange(points, 1);
  const eps = 1e-4;
  const out: Array<{ z: number; loop: Array<[number, number]> }> = [];
  // Side ring as (y-span at z): swap so the span is read along y.
  const side = swapRing(section);
  for (let i = 0; i < slices; i++) {
    const z = z0 + eps + ((z1 - z0 - 2 * eps) * i) / (slices - 1);
    const ys = spanAt(side, z);
    if (!ys) continue;
    const [ylo, yhi] = ys;
    if (!(yhi - ylo > eps)) continue;
    const right: Array<[number, number]> = [];
    const left: Array<[number, number]> = [];
    for (let k = 0; k < levels; k++) {
      const y = ylo + ((yhi - ylo) * k) / (levels - 1);
      const yc = Math.min(fy1 - eps, Math.max(fy0 + eps, y));
      const xs = spanAt(points, yc) ?? [0, 0];
      right.push([xs[1], y]);
      left.push([xs[0], y]);
    }
    out.push({ z, loop: [...right, ...left.reverse()] });
  }
  return out;
}

/** Sample points of the hull surface (silhouette fit bounds): each ring point at its other extent. */
export function hullSamplePoints(points: Ring, section: Ring): Array<[number, number, number]> {
  const out: Array<[number, number, number]> = [];
  for (const [x, y] of points) {
    const zs = spanAt(section, y);
    if (zs) out.push([x, y, zs[0]], [x, y, zs[1]]);
  }
  for (const [z, y] of section) {
    const xs = spanAt(points, y);
    if (xs) out.push([xs[0], y, z], [xs[1], y, z]);
  }
  return out;
}
