import type { ApplianceCategory } from '@mitsinjo/engine';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { frontPartIndex, type ObjectRecipe, type RecipePart } from '@/lib/object-shape';
import type { NormBox } from '@/lib/vision';

/**
 * Geometry of the 3D object editor (PV-T10). Pure (three.js only, no React): a Spark recipe → one merged,
 * vertex-coloured mesh + a photo plane on its front part; the silhouette fallback → the outline extruded
 * + a photo cap. Object centred at the origin, largest side = 1 scene unit. Photo UVs point into the
 * whole photo (the detection box), so one texture serves every object of the photo.
 */

/** Depth of the silhouette extrusion, share of the object's largest side, by what the object is. */
export const SILHOUETTE_DEPTH: Record<ApplianceCategory, number> = {
  fridge: 0.6,
  freezer: 0.6,
  fridge_vaccine: 0.6,
  tv: 0.12,
  lamp: 0.3,
  fan: 0.3,
  laptop: 0.1,
  phone_charger: 0.3,
  radio: 0.35,
  water_pump: 0.5,
  rice_mill: 0.6,
  sewing_machine: 0.4,
  welder: 0.5,
  computer: 0.4,
  other: 0.3,
};

/** Curve segments of round parts (≤ 12 parts × ~1 k triangles: far under the scene budget). */
export const ROUND_SEGMENTS = 24;
/** Gap between a surface and the photo laid on it (avoids z-fighting). */
const PHOTO_GAP = 0.003;

export interface PhotoMesh {
  /** Part bodies (vertex colours for a recipe, plain for a silhouette). */
  body: THREE.BufferGeometry;
  /** Photo-textured front (plane or flat cap), UVs into the whole photo. */
  front: THREE.BufferGeometry;
}

/** Rectangle in scene units that the detection box maps onto. */
interface Bounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/** Sets UVs so that `bounds` shows the `box` part of the photo (top-left origin, texture flipY). */
export function setPhotoUv(geometry: THREE.BufferGeometry, box: NormBox, bounds: Bounds): void {
  const pos = geometry.getAttribute('position');
  const w = bounds.maxX - bounds.minX || 1;
  const h = bounds.maxY - bounds.minY || 1;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    uv[i * 2] = box.x + ((pos.getX(i) - bounds.minX) / w) * box.w;
    uv[i * 2 + 1] = 1 - (box.y + ((bounds.maxY - pos.getY(i)) / h) * box.h);
  }
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

/** Unit primitive (1 × 1 × 1 bounds) along y, non-indexed so parts merge. */
function unitPart(shape: RecipePart['shape']): THREE.BufferGeometry {
  switch (shape) {
    case 'box':
      return new THREE.BoxGeometry(1, 1, 1).toNonIndexed();
    case 'cylinder':
      return new THREE.CylinderGeometry(0.5, 0.5, 1, ROUND_SEGMENTS).toNonIndexed();
    case 'cone':
      return new THREE.ConeGeometry(0.5, 1, ROUND_SEGMENTS).toNonIndexed();
    case 'sphere':
      return new THREE.SphereGeometry(0.5, ROUND_SEGMENTS, ROUND_SEGMENTS * 0.75).toNonIndexed();
  }
}

const color = new THREE.Color();

/** Recipe → merged coloured body + photo plane on the front of its main part. */
export function recipeMesh(recipe: ObjectRecipe, box: NormBox): PhotoMesh {
  const dims = [recipe.proportions.w, recipe.proportions.h, recipe.proportions.d] as const;
  const parts = recipe.parts.map((p) => {
    const g = unitPart(p.shape);
    // Round parts turn to their axis before taking the part's own x / y / z extent.
    if (p.axis === 'x') g.rotateZ(Math.PI / 2);
    else if (p.axis === 'z') g.rotateX(Math.PI / 2);
    g.scale(p.size[0] * dims[0], p.size[1] * dims[1], p.size[2] * dims[2]);
    g.translate(p.at[0] * dims[0], p.at[1] * dims[1], p.at[2] * dims[2]);
    color.set(p.color).convertSRGBToLinear();
    const count = g.getAttribute('position').count;
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) color.toArray(colors, i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return g;
  });
  const body = mergeGeometries(parts) ?? new THREE.BufferGeometry();
  parts.forEach((g) => g.dispose());

  const main = recipe.parts[frontPartIndex(recipe)]!;
  const w = main.size[0] * dims[0];
  const h = main.size[1] * dims[1];
  const cx = main.at[0] * dims[0];
  const cy = main.at[1] * dims[1];
  const front = new THREE.PlaneGeometry(w, h);
  front.translate(cx, cy, main.at[2] * dims[2] + (main.size[2] * dims[2]) / 2 + PHOTO_GAP);
  setPhotoUv(front, box, {
    minX: cx - w / 2,
    maxX: cx + w / 2,
    minY: cy - h / 2,
    maxY: cy + h / 2,
  });
  return { body, front };
}

/** Width and height of the object (largest = 1) from its box on a photo of `photoAspect` (w / h, pixels). */
export function silhouetteSize(box: NormBox, photoAspect: number): [number, number] {
  const a = box.h > 0 && photoAspect > 0 ? (box.w * photoAspect) / box.h : 1;
  return a >= 1 ? [1, 1 / a] : [a, 1];
}

/**
 * Silhouette fallback: `rings` (box fractions, y down, from `silhouetteRings`) extruded by the category
 * depth, with a flat photo cap on the front. Each ring is its own piece (SAM may return several).
 */
export function silhouetteMesh(
  rings: ReadonlyArray<ReadonlyArray<readonly [number, number]>>,
  box: NormBox,
  photoAspect: number,
  category: ApplianceCategory
): PhotoMesh {
  const [w, h] = silhouetteSize(box, photoAspect);
  const depth = SILHOUETTE_DEPTH[category] * Math.max(w, h);
  const shapes = rings
    .filter((r) => r.length >= 3)
    .map(
      (r) => new THREE.Shape(r.map(([u, v]) => new THREE.Vector2((u - 0.5) * w, (0.5 - v) * h)))
    );
  const body = new THREE.ExtrudeGeometry(shapes, { depth, bevelEnabled: false, curveSegments: 1 });
  body.translate(0, 0, -depth / 2);
  const front = new THREE.ShapeGeometry(shapes);
  front.translate(0, 0, depth / 2 + PHOTO_GAP);
  setPhotoUv(front, box, { minX: -w / 2, maxX: w / 2, minY: -h / 2, maxY: h / 2 });
  return { body, front };
}

/** Triangles of a geometry (for the scene budget). */
export function triangleCount(g: THREE.BufferGeometry): number {
  return (g.index ? g.index.count : (g.getAttribute('position')?.count ?? 0)) / 3;
}
