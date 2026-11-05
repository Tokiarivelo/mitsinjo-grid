import { decodeMaskToSVGPath } from '@meta-sam/parser';
import { pathToRings } from '@/lib/vision';
import type { SamMask } from './parse-sam';

export { pathToRings };

/** Simplification tolerance, in image fractions (≈ 2 px on a 1000 px photo). */
export const OUTLINE_TOLERANCE = 0.002;
/** Most points kept per outline (sent to the browser in the detections event). */
export const MAX_OUTLINE_POINTS = 160;

type Pt = readonly [number, number];

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
export function simplifyRing(ring: readonly Pt[], tolerance: number): Pt[] {
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

/** Mask raster this many pixels off its box (per axis) is taken as full size, not scaled. */
export const MASK_SCALE_SLACK_PX = 2;

/**
 * Raster → image pixel scale of a SAM mask over its box: SAM sends big instances downsampled
 * (live 2026-11-05: a 1047 × 1148 px tree box came with a ≈ 934 × 1024 mask, the outline shrank
 * 11 % toward the top-left). 1 when the box end is unknown or the raster is full size.
 */
export function maskScale(
  mask: Pick<SamMask, 'width' | 'height'>,
  box: { x1: number; y1: number; x2?: number; y2?: number }
): [number, number] {
  const axis = (lo: number, hi: number | undefined, px: number) => {
    if (hi === undefined || !(px > 0)) return 1;
    const span = hi - lo + 1; // inclusive pixels
    return Math.abs(span - px) > MASK_SCALE_SLACK_PX && span > 0 ? span / px : 1;
  };
  return [axis(box.x1, box.x2, mask.width), axis(box.y1, box.y2, mask.height)];
}

/**
 * Encoded SAM mask (a raster over the instance box) → SVG path in image fractions (0–1), simplified.
 * `box` = instance box, inclusive pixels; with its end, a downsampled raster is scaled back to it
 * (`maskScale`). Null when the mask cannot be decoded or is empty.
 */
export function maskToOutline(
  mask: SamMask,
  box: { x1: number; y1: number; x2?: number; y2?: number },
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
  const [sx, sy] = maskScale(mask, box);
  const toImage = ([x, y]: Pt): Pt => [
    Math.min(1, Math.max(0, ((x + 0.5) * sx + box.x1) / imageWidth)),
    Math.min(1, Math.max(0, ((y + 0.5) * sy + box.y1) / imageHeight)),
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

/**
 * Crop fractions → photo fractions (FIX 2): an outline SAM drew on the shape crop, remapped
 * into photo space like a detection outline. Affine, so ring point counts are preserved. Null
 * without a usable rect, image size, or ring.
 */
export function remapOutlineToPhoto(
  path: string,
  rect: { left: number; top: number; width: number; height: number },
  photoW: number,
  photoH: number
): string | null {
  if (!(photoW > 0) || !(photoH > 0) || !(rect.width > 0) || !(rect.height > 0)) return null;
  const rings = pathToRings(path)
    .map((r): Pt[] =>
      r.map(([u, v]): Pt => [
        (rect.left + u * rect.width) / photoW,
        (rect.top + v * rect.height) / photoH,
      ])
    )
    .filter((r) => r.length >= 3);
  if (rings.length === 0) return null;
  return rings.map((r) => `M${r.map((p) => `${fmt(p[0])} ${fmt(p[1])}`).join('L')}Z`).join('');
}
