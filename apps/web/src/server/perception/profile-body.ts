import 'server-only';

import type { KitArchetype } from '@/lib/object-kit';
import {
  EXTRUDE_POINTS_MAX,
  frontPartIndex,
  silhouetteRings,
  type ObjectRecipe,
  type RecipePart,
  type ShapeTarget,
} from '@/lib/object-shape';
import { MASK_YAW_MAX } from './mask-geometry';
import { simplifyRing } from './mask-outline';

/** Archetypes seen from the side whose main body follows the SAM outline (PR-2.2). */
export const PROFILE_ARCHETYPES: ReadonlyArray<KitArchetype> = ['vehicle', 'cabinet', 'machine'];

/** Plates covering the body side (glasshouse, bumpers) notch the slab: z-size above this. */
export const NOTCH_PLATE_MIN_Z = 0.5;

type Pt = readonly [number, number];

/** Drops consecutive near-duplicates and a closing repeat of the first point. */
function cleanRing(ring: ReadonlyArray<Pt>): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (const [x, y] of ring) {
    const last = out[out.length - 1];
    if (!last || Math.hypot(x - last[0], y - last[1]) > 1e-9) out.push([x, y]);
  }
  if (out.length > 1) {
    const [fx, fy] = out[0]!;
    const last = out[out.length - 1]!;
    if (Math.hypot(fx - last[0], fy - last[1]) <= 1e-9) out.pop();
  }
  return out;
}

/** Douglas–Peucker down to the point budget, doubling the tolerance, then stride sampling. */
export function budgetRing(ring: ReadonlyArray<Pt>): Array<[number, number]> {
  const clean = cleanRing(ring);
  if (clean.length <= EXTRUDE_POINTS_MAX) return clean;
  let tol = 0.004;
  for (let i = 0; i < 8; i++) {
    tol *= 2;
    const simp = cleanRing(simplifyRing(clean, tol));
    if (simp.length < 3) break;
    if (simp.length <= EXTRUDE_POINTS_MAX) return simp;
  }
  const step = Math.ceil(clean.length / EXTRUDE_POINTS_MAX);
  return cleanRing(clean.filter((_, i) => i % step === 0));
}

const clampHalf = (v: number) => Math.min(0.5, Math.max(-0.5, v));

/**
 * Main body of a side-seen object (PR-2.2): the SAM outline ring (box fractions, y down) as an
 * `extrude` part sized to the ring's own bbox, so the silhouette matches the outline by
 * construction. Each template wheel notches its own well (the arches between stay). Returns the
 * recipe unchanged (same reference) when the archetype, yaw, outline or ring disqualifies it.
 * Pure: same inputs → same recipe.
 */
export function withProfileBody(
  archetype: KitArchetype,
  recipe: ObjectRecipe,
  target: Pick<ShapeTarget, 'box' | 'outline'>,
  /** Detection-box aspect (w/h in pixels): the frame the outline lives in. */
  aspect: number
): ObjectRecipe {
  if (!PROFILE_ARCHETYPES.includes(archetype)) return recipe;
  if (Math.abs(recipe.yaw ?? 0) > MASK_YAW_MAX) return recipe;
  if (!target.outline) return recipe;
  const main = recipe.parts[frontPartIndex(recipe)]!;
  if (main.shape === 'extrude') return recipe;

  // Outline (photo fractions, y down) → object fractions (y up), deduped and budgeted.
  const rings = silhouetteRings({ box: target.box, outline: target.outline });
  const ring = rings[0];
  if (!ring || ring.length < 3) return recipe;
  let pts = budgetRing(ring.map(([u, v]) => [u - 0.5, 0.5 - v] as const));
  if (pts.length < 3) return recipe;

  // Wheels band: z-axis cylinders below the body's middle keep their strip (vehicles).
  // Each wheel notches its own x-range up to its top (wheel wells); the outline arches between
  // the tires stay — a global cut would punch the middle out of the silhouette.
  const midY = main.at[1];
  const wheels = recipe.parts.filter(
    (p) => p !== main && p.shape === 'cylinder' && p.axis === 'z' && p.at[1] < midY
  );
  if (wheels.length > 0) {
    pts = pts.map(([x, y]) => {
      let ny = y;
      for (const w of wheels) {
        const top = w.at[1] + w.size[1] / 2;
        if (Math.abs(x - w.at[0]) <= w.size[0] / 2 && y < top) ny = Math.max(ny, top);
      }
      return [x, ny] as [number, number];
    });
    pts = cleanRing(pts);
    if (pts.length < 3) return recipe;
  }

  const xs = pts.map(([x]) => x);
  const ys = pts.map(([, y]) => y);
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  const y0 = Math.min(...ys);
  const y1 = Math.max(...ys);
  const w = x1 - x0;
  const h = y1 - y0;
  if (!(w >= 0.01) || !(h >= 0.01)) return recipe;
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  // Plates overlapping the ring (glasshouse, bumpers) notch it: the slab keeps the old main
  // box's occlusions and follows the outline elsewhere. A plate straddling the old box top
  // notches to that top (the glass shows exactly what showed before); else to its own bottom.
  const mainTop = main.at[1] + main.size[1] / 2;
  const plates = recipe.parts.filter((p) => {
    if (p === main || p.size[2] <= NOTCH_PLATE_MIN_Z) return false;
    return Math.abs(p.at[0] - cx) <= w / 2 && Math.abs(p.at[1] - cy) <= h / 2;
  });
  if (plates.length > 0) {
    pts = pts.map(([x, y]) => {
      let ny = y;
      for (const p of plates) {
        const px0 = p.at[0] - p.size[0] / 2;
        const px1 = p.at[0] + p.size[0] / 2;
        const py1 = p.at[1] + p.size[1] / 2;
        const level =
          p.at[1] - p.size[1] / 2 < mainTop && py1 > mainTop ? mainTop : p.at[1] - p.size[1] / 2;
        if (x >= px0 && x <= px1 && y > level && y <= py1 + 1e-9) ny = Math.min(ny, level);
      }
      return [x, ny] as [number, number];
    });
    pts = cleanRing(pts);
    if (pts.length < 3) return recipe;
  }

  const nx = pts.map(([x]) => x);
  const ny2 = pts.map(([, y]) => y);
  const nx0 = Math.min(...nx);
  const nx1 = Math.max(...nx);
  const ny0 = Math.min(...ny2);
  const ny1 = Math.max(...ny2);
  const nw = nx1 - nx0;
  const nh = ny1 - ny0;
  if (!(nw >= 0.01) || !(nh >= 0.01)) return recipe;
  let ncx = (nx0 + nx1) / 2;
  const ncy = (ny0 + ny1) / 2;
  let pw = nw;

  // Yaw foreshortening: the render turns the slab, widening its projection, so a box-wide
  // ring would overshoot the outline ~1 px per 3°. Pre-squeeze x in world units (the frame is
  // h·aspect wide) so the turned projection lands back on the outline; never widen.
  const yaw = recipe.yaw ?? 0;
  if (yaw !== 0 && aspect > 0) {
    const { w: dimW, h: dimH, d: dimD } = recipe.proportions;
    const scaled =
      (nw * dimH * aspect - dimD * main.size[2] * Math.abs(Math.sin(yaw))) / (dimW * Math.cos(yaw));
    if (!(scaled > 0.5 * nw)) return recipe;
    if (scaled < nw) {
      const k = scaled / nw;
      pts = cleanRing(pts.map(([x, y]) => [ncx + (x - ncx) * k, y] as [number, number]));
      if (pts.length < 3) return recipe;
      const sx = pts.map(([x]) => x);
      ncx = (Math.min(...sx) + Math.max(...sx)) / 2;
      pw = Math.max(...sx) - Math.min(...sx);
    }
  }

  const body: RecipePart = {
    shape: 'extrude',
    at: [ncx, ncy, main.at[2]],
    // Box-spanning rings measure 1 ± float noise.
    size: [Math.min(1, pw), Math.min(1, nh), main.size[2]],
    color: main.color,
    ...(main.material ? { material: main.material } : {}),
    front: true,
    points: pts.map(
      ([x, y]) => [clampHalf((x - ncx) / pw), clampHalf((y - ncy) / nh)] as [number, number]
    ),
  };
  const parts = recipe.parts.slice();
  parts[frontPartIndex(recipe)] = body;
  return { ...recipe, parts };
}
