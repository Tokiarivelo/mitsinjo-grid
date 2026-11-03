import type { ObjectRecipe, PartKind, RecipePart } from '@/lib/object-shape';

/**
 * Pure framing for the staged build (PG-T18): which parts a stage works on or a kept patch
 * changed, their outline boxes and the camera framing around them. Object frame, before the
 * display scale; the measured yaw is applied like in `recipeMesh`.
 */

export type Vec3 = [number, number, number];

export interface FocusSphere {
  center: Vec3;
  radius: number;
}

/** Corner signs of a box, then the 12 edges as corner index pairs. */
const CORNERS: ReadonlyArray<Vec3> = [
  [-1, -1, -1],
  [1, -1, -1],
  [1, 1, -1],
  [-1, 1, -1],
  [-1, -1, 1],
  [1, -1, 1],
  [1, 1, 1],
  [-1, 1, 1],
];
const EDGES: ReadonlyArray<[number, number]> = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 0],
  [4, 5],
  [5, 6],
  [6, 7],
  [7, 4],
  [0, 4],
  [1, 5],
  [2, 6],
  [3, 7],
];

/** The 8 corners of a part's box in the object frame (yaw applied). */
function partCorners(recipe: ObjectRecipe, part: RecipePart): Vec3[] {
  const { w, h, d } = recipe.proportions;
  const dims: Vec3 = [w, h, d];
  const cos = Math.cos(recipe.yaw ?? 0);
  const sin = Math.sin(recipe.yaw ?? 0);
  return CORNERS.map((c) => {
    const x = (part.at[0] + (c[0] * part.size[0]) / 2) * dims[0];
    const y = (part.at[1] + (c[1] * part.size[1]) / 2) * dims[1];
    const z = (part.at[2] + (c[2] * part.size[2]) / 2) * dims[2];
    // Same turn as `THREE.BufferGeometry.rotateY(yaw)`.
    return [x * cos + z * sin, y, -x * sin + z * cos];
  });
}

/** Parts of the given kinds (parts without a kind never match). */
export function partsOfKinds(recipe: ObjectRecipe, kinds: ReadonlyArray<PartKind>): RecipePart[] {
  return recipe.parts.filter((p) => p.kind !== undefined && kinds.includes(p.kind));
}

const partKey = (p: RecipePart) => JSON.stringify(p);

/**
 * Parts a kept patch touched: new or edited parts of `next`, plus parts of `prev` that are gone
 * (framed where they were). Compared by value, order-free.
 */
export function changedParts(prev: ObjectRecipe, next: ObjectRecipe): RecipePart[] {
  const before = new Set(prev.parts.map(partKey));
  const after = new Set(next.parts.map(partKey));
  return [
    ...next.parts.filter((p) => !before.has(partKey(p))),
    ...prev.parts.filter((p) => !after.has(partKey(p))),
  ];
}

/** Smallest sphere around the parts' boxes (centre of their bounds), null for no parts. */
export function partsSphere(
  recipe: ObjectRecipe,
  parts: ReadonlyArray<RecipePart>
): FocusSphere | null {
  if (!parts.length) return null;
  const min: Vec3 = [Infinity, Infinity, Infinity];
  const max: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (const p of parts) {
    for (const c of partCorners(recipe, p)) {
      for (let i = 0; i < 3; i++) {
        min[i] = Math.min(min[i]!, c[i]!);
        max[i] = Math.max(max[i]!, c[i]!);
      }
    }
  }
  const center: Vec3 = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2];
  const radius = Math.hypot(max[0] - min[0], max[1] - min[1], max[2] - min[2]) / 2;
  return { center, radius };
}

/** Line-segment positions (2 points per edge, 12 edges per part) outlining each part's box. */
export function partOutlines(recipe: ObjectRecipe, parts: ReadonlyArray<RecipePart>): Float32Array {
  const out = new Float32Array(parts.length * EDGES.length * 6);
  let o = 0;
  for (const p of parts) {
    const corners = partCorners(recipe, p);
    for (const [a, b] of EDGES) {
      out.set(corners[a]!, o);
      out.set(corners[b]!, o + 3);
      o += 6;
    }
  }
  return out;
}

/** Closest and farthest the build camera frames from (the viewer's zoom limits). */
export const FOCUS_MIN_DISTANCE = 1.2;
export const FOCUS_MAX_DISTANCE = 5;
/** Margin around the framed parts. */
const FOCUS_MARGIN = 1.25;

/** Camera distance that fits a sphere of `radius` in a vertical field of view `fovDeg`. */
export function focusDistance(radius: number, fovDeg: number): number {
  const fit = (radius / Math.sin(((fovDeg / 2) * Math.PI) / 180)) * FOCUS_MARGIN;
  return Math.min(FOCUS_MAX_DISTANCE, Math.max(FOCUS_MIN_DISTANCE, fit));
}
