import type { ApplianceCategory } from '@mitsinjo/engine';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { ObjectRecipe, RecipePart } from '@/lib/object-shape';
import { pathToRings, type ApplianceDetection, type NormBox, type SceneryType } from '@/lib/vision';

/**
 * Geometry of the 3D object editor (PV-T10). Pure (three.js only, no React): a Spark recipe → one merged,
 * vertex-coloured mesh + the photo projected onto every front-facing face (PF-T1); the silhouette fallback → the outline extruded
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

/** Same for scenery (no load). */
export const SCENERY_DEPTH: Record<SceneryType, number> = {
  building: 0.8,
  vehicle: 0.45,
  tree: 0.7,
  plant: 0.6,
  person: 0.3,
  animal: 0.4,
  water: 0.1,
  other: 0.3,
};

/** Extrusion depth share for an object: its scenery type first (category is `other`), else its category. */
export function silhouetteDepth(d: Pick<ApplianceDetection, 'category' | 'scenery'>): number {
  return d.scenery ? SCENERY_DEPTH[d.scenery] : SILHOUETTE_DEPTH[d.category];
}

/** Curve segments of round parts (≤ 12 parts × ~1 k triangles: far under the scene budget). */
export const ROUND_SEGMENTS = 24;
/** Gap between a surface and the photo laid on it (avoids z-fighting). */
const PHOTO_GAP = 0.003;
/** A face takes the photo when its normal points this much towards the camera (z): fronts, not tops. */
export const FRONT_MIN_NZ = 0.35;

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

/**
 * Unit gable prism (PF-T3): triangle (base at y −0.5, ridge at x `apex − 0.5`, y 0.5) extruded along z.
 * Non-indexed with flat normals and empty UVs, the same attributes as the other primitives so they merge.
 */
export function unitPrism(apex = 0.5): THREE.BufferGeometry {
  const r = Math.min(1, Math.max(0, apex)) - 0.5;
  const tri = (z: number) => [-0.5, -0.5, z, 0.5, -0.5, z, r, 0.5, z];
  const [a, b, c] = [0, 1, 2].map((k) => tri(0.5).slice(k * 3, k * 3 + 3)) as [
    number[],
    number[],
    number[],
  ];
  const [a2, b2, c2] = [0, 1, 2].map((k) => tri(-0.5).slice(k * 3, k * 3 + 3)) as [
    number[],
    number[],
    number[],
  ];
  const quad = (p: number[], q: number[], s: number[], t: number[]) => [
    ...p,
    ...q,
    ...s,
    ...p,
    ...s,
    ...t,
  ];
  const positions = [
    ...a,
    ...b,
    ...c, // front (+z)
    ...a2,
    ...c2,
    ...b2, // back (−z)
    ...quad(a2, b2, b, a), // bottom
    ...quad(b, b2, c2, c), // right slope
    ...quad(c, c2, a2, a), // left slope
  ];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute(
    'uv',
    new THREE.Float32BufferAttribute(new Float32Array((positions.length / 3) * 2), 2)
  );
  g.computeVertexNormals();
  return g;
}

/** Unit primitive (1 × 1 × 1 bounds) along y, non-indexed so parts merge. */
function unitPart(shape: RecipePart['shape'], apex?: number): THREE.BufferGeometry {
  switch (shape) {
    case 'prism':
      return unitPrism(apex);
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
const ab = new THREE.Vector3();
const ac = new THREE.Vector3();

/** Triangles of a non-indexed geometry whose face normal z is above `minNz` (position only). */
export function frontFacing(g: THREE.BufferGeometry, minNz = FRONT_MIN_NZ): THREE.BufferGeometry {
  const pos = g.getAttribute('position');
  const kept: number[] = [];
  const v = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()] as const;
  for (let t = 0; t + 2 < pos.count; t += 3) {
    v.forEach((p, k) => p.fromBufferAttribute(pos, t + k));
    const n = ab.subVectors(v[1], v[0]).cross(ac.subVectors(v[2], v[0]));
    const len = n.length();
    if (len > 0 && n.z / len > minNz) v.forEach((p) => kept.push(p.x, p.y, p.z));
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(kept, 3));
  return out;
}

/**
 * Recipe → merged coloured body + the photo projected onto it (PF-T1). The photo is a camera projection
 * along z of the whole model onto the detection box: every face turned to the camera (walls, the front
 * of roof slabs, a lamp head) shows the part of the photo in front of it, not the whole box squashed on
 * one part. Faces hidden behind others are covered by the depth test.
 */
export function recipeMesh(recipe: ObjectRecipe, box: NormBox): PhotoMesh {
  const dims = [recipe.proportions.w, recipe.proportions.h, recipe.proportions.d] as const;
  const parts = recipe.parts.map((p) => {
    const g = unitPart(p.shape, p.apex);
    // Round parts turn to their axis before taking the part's own x / y / z extent.
    if (p.axis === 'x') g.rotateZ(Math.PI / 2);
    else if (p.axis === 'z') g.rotateX(Math.PI / 2);
    g.scale(p.size[0] * dims[0], p.size[1] * dims[1], p.size[2] * dims[2]);
    g.translate(p.at[0] * dims[0], p.at[1] * dims[1], p.at[2] * dims[2]);
    // Measured yaw (PF-T5): turned like on the photo, so the projection below paints both facades.
    if (recipe.yaw) g.rotateY(recipe.yaw);
    color.set(p.color).convertSRGBToLinear();
    const count = g.getAttribute('position').count;
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) color.toArray(colors, i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return g;
  });
  const fronts = parts.map((g) => frontFacing(g));
  const body = mergeGeometries(parts) ?? new THREE.BufferGeometry();
  const front = (fronts.length && mergeGeometries(fronts)) || new THREE.BufferGeometry();
  parts.forEach((g) => g.dispose());
  fronts.forEach((g) => g.dispose());

  body.computeBoundingBox();
  const b = body.boundingBox;
  if (b && !b.isEmpty() && front.getAttribute('position')) {
    front.translate(0, 0, PHOTO_GAP);
    setPhotoUv(front, box, { minX: b.min.x, maxX: b.max.x, minY: b.min.y, maxY: b.max.y });
  }
  return { body, front };
}

/**
 * The object's SAM outline as rings in photo fractions (0–1, y down), for the photo mask; null without an
 * outline (box moved by the operator, mock) — then nothing is masked.
 */
export function photoMaskRings(
  d: Pick<ApplianceDetection, 'outline'>
): Array<Array<readonly [number, number]>> | null {
  if (!d.outline) return null;
  const rings = pathToRings(d.outline).filter((r) => r.length >= 3);
  return rings.length ? rings : null;
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
  /** Depth as a share of the largest side (`silhouetteDepth`). */
  depthShare: number
): PhotoMesh {
  const [w, h] = silhouetteSize(box, photoAspect);
  const depth = depthShare * Math.max(w, h);
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
