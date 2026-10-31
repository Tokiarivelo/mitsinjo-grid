import { decodeMaskToSVGPath } from '@meta-sam/parser';
import type { SamMask } from './parse-sam';

/** Simplification tolerance, in image fractions (≈ 2 px on a 1000 px photo). */
export const OUTLINE_TOLERANCE = 0.002;
/** Most points kept per outline (sent to the browser in the detections event). */
export const MAX_OUTLINE_POINTS = 160;

type Pt = readonly [number, number];

/** Absolute `M x yL x y…Z` path → closed rings of points. Other commands are not emitted by the parser. */
export function pathToRings(path: string): Pt[][] {
  const rings: Pt[][] = [];
  let ring: Pt[] = [];
  for (const m of path.matchAll(/([MLZ])\s*(?:(-?[\d.]+)[ ,](-?[\d.]+))?/g)) {
    const cmd = m[1];
    if (cmd === 'Z') {
      if (ring.length >= 3) rings.push(ring);
      ring = [];
      continue;
    }
    if (cmd === 'M' && ring.length) {
      if (ring.length >= 3) rings.push(ring);
      ring = [];
    }
    const x = Number(m[2]);
    const y = Number(m[3]);
    if (Number.isFinite(x) && Number.isFinite(y)) ring.push([x, y]);
  }
  if (ring.length >= 3) rings.push(ring);
  return rings;
}

function segmentDistance(p: Pt, a: Pt, b: Pt): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  const t =
    len2 > 0 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2)) : 0;
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
}

/** Ramer–Douglas–Peucker on an open polyline (iterative). */
export function simplify(points: readonly Pt[], tolerance: number): Pt[] {
  if (points.length <= 2) return [...points];
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length) {
    const [s, e] = stack.pop()!;
    let worst = -1;
    let worstD = tolerance;
    for (let i = s + 1; i < e; i++) {
      const d = segmentDistance(points[i]!, points[s]!, points[e]!);
      if (d > worstD) {
        worst = i;
        worstD = d;
      }
    }
    if (worst > 0) {
      keep[worst] = 1;
      stack.push([s, worst], [worst, e]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

/** Closed ring simplified from its farthest-apart split so both halves keep their shape. */
function simplifyRing(ring: readonly Pt[], tolerance: number): Pt[] {
  let far = 0;
  let farD = -1;
  for (let i = 1; i < ring.length; i++) {
    const d = Math.hypot(ring[i]![0] - ring[0]![0], ring[i]![1] - ring[0]![1]);
    if (d > farD) {
      far = i;
      farD = d;
    }
  }
  const a = simplify(ring.slice(0, far + 1), tolerance);
  const b = simplify([...ring.slice(far), ring[0]!], tolerance);
  return [...a.slice(0, -1), ...b.slice(0, -1)];
}

const fmt = (v: number) => String(Math.round(v * 10000) / 10000);

/**
 * Encoded SAM mask (a raster over the instance box) → SVG path in image fractions (0–1), simplified.
 * `box` = instance box, inclusive pixels. Null when the mask cannot be decoded or is empty.
 */
export function maskToOutline(
  mask: SamMask,
  box: { x1: number; y1: number },
  imageWidth: number,
  imageHeight: number,
  tolerance = OUTLINE_TOLERANCE
): string | null {
  if (imageWidth <= 0 || imageHeight <= 0) return null;
  let path: string;
  try {
    path = decodeMaskToSVGPath(mask);
  } catch {
    return null;
  }
  // Parser points sit on pixel edges as centre ± 0.5: shift by +0.5 to land on pixel boundaries.
  const toImage = ([x, y]: Pt): Pt => [
    Math.min(1, Math.max(0, (x + 0.5 + box.x1) / imageWidth)),
    Math.min(1, Math.max(0, (y + 0.5 + box.y1) / imageHeight)),
  ];
  const rings = pathToRings(path).map((r) => r.map(toImage));
  if (rings.length === 0) return null;

  let tol = tolerance;
  let simplified = rings.map((r) => simplifyRing(r, tol));
  const count = () => simplified.reduce((n, r) => n + r.length, 0);
  while (count() > MAX_OUTLINE_POINTS && tol < 0.05) {
    tol *= 2;
    simplified = rings.map((r) => simplifyRing(r, tol));
  }
  const parts = simplified
    .filter((r) => r.length >= 3)
    .map((r) => `M${r.map((p) => `${fmt(p[0])} ${fmt(p[1])}`).join('L')}Z`);
  return parts.length ? parts.join('') : null;
}
