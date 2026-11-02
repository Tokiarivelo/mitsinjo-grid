import type { ApplianceCategory } from '@mitsinjo/engine';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { ObjectRecipe, RecipePart } from '@/lib/object-shape';
import { SURFACE_LOOK, SURFACES, surfaceIndex } from './surface-look';
import { holedBox } from './holed-wall';
import { layoutOpenings } from './openings';
import { expandRoofTrim } from './roof-trim';
import { timberBeams } from './timber';
import { planarUvs } from './surface-maps';
import { type ApplianceDetection, type NormBox, type SceneryType } from '@/lib/vision';

/**
 * Geometry of the 3D object editor (PV-T10). Pure (three.js only, no React): a Spark recipe → one merged,
 * vertex-coloured mesh; the silhouette fallback → the outline extruded. Built from shapes and measured
 * colours only: the photo is never pasted on the model (user choice). Object centred at the origin,
 * largest side = 1 scene unit.
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
/** Sphere segments (PR-1.3): 396 triangles, smooth normals; 12 spheres stay under 5 k. */
export const SPHERE_SEGMENTS = [18, 12] as const;
/**
 * Roof overhang (PR-1.3), object units: each gable prism reaches past the walls on every side — eaves on
 * the slopes, verge over the front and back — so the roof reads as a roof, not a wedge on a box.
 */
export const ROOF_OVERHANG = 0.03;
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

/**
 * Unit hipped roof (2D facade, user 2026-11-02): base 1 × 1 at y −0.5, ridge along x at y 0.5, z 0,
 * `ridge` × the width long (0 = pyramid, 1 = side gable). Front / back slopes are trapezoids, the
 * hip ends triangles. Non-indexed, flat normals, empty UVs like `unitPrism`.
 */
export function unitHip(ridge = 0.5): THREE.BufferGeometry {
  const r = Math.min(1, Math.max(0, ridge)) / 2;
  const A = [-0.5, -0.5, 0.5];
  const B = [0.5, -0.5, 0.5];
  const C = [0.5, -0.5, -0.5];
  const D = [-0.5, -0.5, -0.5];
  const R1 = [-r, 0.5, 0];
  const R2 = [r, 0.5, 0];
  const positions = [
    ...A,
    ...B,
    ...R2,
    ...A,
    ...R2,
    ...R1, // front slope (+z)
    ...C,
    ...D,
    ...R1,
    ...C,
    ...R1,
    ...R2, // back slope (−z)
    ...B,
    ...C,
    ...R2, // right hip
    ...D,
    ...A,
    ...R1, // left hip
    ...A,
    ...D,
    ...C,
    ...A,
    ...C,
    ...B, // bottom
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

/** Corner segments of a rounded box: 300 triangles per box, 12 boxes stay under 5 k. */
export const ROUNDED_SEGMENTS = 2;
/** Below this radius (object units, ≈ 1 px in the viewer) the rounding is invisible: plain box, 12 triangles. */
export const MIN_RADIUS = 0.005;

/**
 * Box of its final size with rounded edges and smooth corner normals (PR-1.2), non-indexed, centred.
 * Built at size (not scaled afterwards) so the radius stays round on long thin parts; ≤ ¼ of the thinnest side.
 */
export function roundedBox(w: number, h: number, d: number, radius: number): THREE.BufferGeometry {
  const r = Math.min(radius, Math.min(w, h, d) / 4);
  if (r < MIN_RADIUS) {
    const g = new THREE.BoxGeometry(1, 1, 1).toNonIndexed();
    g.scale(w, h, d);
    return g;
  }
  const g = new RoundedBoxGeometry(w, h, d, ROUNDED_SEGMENTS, r);
  if (!g.index) return g;
  const flat = g.toNonIndexed();
  g.dispose();
  return flat;
}

/** Bevel of an extruded profile (PR-2.1), unit space: soft edge, exact 1 × 1 × 1 bounds. */
export const EXTRUDE_BEVEL = 0.02;

/**
 * Unit extruded profile (PR-2.1): the closed `points` ring (x right, y up) with a thin bevel,
 * 1 deep along z, centred. Non-indexed so parts merge; either winding accepted.
 */
export function unitExtrude(
  points: ReadonlyArray<readonly [number, number]>
): THREE.BufferGeometry {
  const shape = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: 1 - 2 * EXTRUDE_BEVEL,
    bevelEnabled: true,
    bevelThickness: EXTRUDE_BEVEL,
    bevelSize: EXTRUDE_BEVEL,
    bevelSegments: 1,
    steps: 1,
  });
  g.translate(0, 0, -0.5 + EXTRUDE_BEVEL);
  if (g.index) {
    const flat = g.toNonIndexed();
    g.dispose();
    return flat;
  }
  return g;
}

/** Radial segments of a lathe profile (PR-2.3): round tanks, cheap enough to merge. */
export const LATHE_SEGMENTS = 16;

/**
 * Unit body of revolution (PR-2.3): `profile` ([radius, height], rising y) revolved around y.
 * Non-indexed so parts merge; smooth normals so tanks read round.
 */
export function unitLathe(profile: ReadonlyArray<readonly [number, number]>): THREE.BufferGeometry {
  const raw =
    profile.length >= 2
      ? profile
      : ([
          [0, -0.5],
          [0, 0.5],
        ] as const);
  const pts = raw.map(([r, y]) => new THREE.Vector2(Math.max(0, r), y));
  const g = new THREE.LatheGeometry(pts, LATHE_SEGMENTS);
  const flat = g.index ? g.toNonIndexed() : g;
  if (flat !== g) g.dispose();
  return flat;
}

/** Unit primitive (1 × 1 × 1 bounds) along y, non-indexed so parts merge. */
function unitPart(
  shape: RecipePart['shape'],
  apex?: number,
  points?: RecipePart['points'],
  profile?: RecipePart['profile'],
  ridge?: number
): THREE.BufferGeometry {
  switch (shape) {
    case 'prism':
      return unitPrism(apex);
    case 'hip':
      return unitHip(ridge);
    case 'extrude':
      return unitExtrude(points ?? []);
    case 'lathe':
      return unitLathe(profile ?? []);
    case 'box':
      return new THREE.BoxGeometry(1, 1, 1).toNonIndexed();
    case 'cylinder':
      return new THREE.CylinderGeometry(0.5, 0.5, 1, ROUND_SEGMENTS).toNonIndexed();
    case 'cone':
      return new THREE.ConeGeometry(0.5, 1, ROUND_SEGMENTS).toNonIndexed();
    case 'sphere':
      return new THREE.SphereGeometry(0.5, ...SPHERE_SEGMENTS).toNonIndexed();
  }
}

const color = new THREE.Color();

/**
 * Recipe → one merged, vertex-coloured body (windows, doors, roofs are parts of their own colour).
 * Parts are grouped by material: one geometry group per surface, `materialIndex` = `surfaceIndex`, so the
 * view draws stone matte and glass shiny in one mesh.
 */
export function recipeMesh(recipe: ObjectRecipe): THREE.BufferGeometry {
  const dims = [recipe.proportions.w, recipe.proportions.h, recipe.proportions.d] as const;
  // Windows and doors drawn with frame, glass, bars and sill (PG-T8), cut into their wall (PG-T11).
  const { parts: laid, holes } = layoutOpenings(recipe);
  // Thatch roofs end in a rounded eave roll (PG-T12); half-timbered walls get their beams.
  const sorted = [
    ...expandRoofTrim(laid, recipe.proportions, ROOF_OVERHANG),
    ...timberBeams(recipe),
  ]
    .map((p) => ({ p, surface: surfaceIndex(p.material) }))
    .sort((a, b) => a.surface - b.surface);
  const parts = sorted.map(({ p, surface }) => {
    const [sx, sy, sz] = [p.size[0] * dims[0], p.size[1] * dims[1], p.size[2] * dims[2]];
    let g: THREE.BufferGeometry;
    const cut = holes.get(p);
    if (p.shape === 'box' && cut?.length) {
      g = holedBox(sx, sy, sz, cut);
    } else if (p.shape === 'box') {
      g = roundedBox(sx, sy, sz, SURFACE_LOOK[SURFACES[surface]!].radius);
    } else {
      g = unitPart(p.shape, p.apex, p.points, p.profile, p.ridge);
      // Round parts turn to their axis before taking the part's own x / y / z extent.
      if (p.axis === 'x') g.rotateZ(Math.PI / 2);
      else if (p.axis === 'z') g.rotateX(Math.PI / 2);
      const eave = p.shape === 'prism' ? 2 * ROOF_OVERHANG : 0;
      g.scale(sx + eave, sy, sz + eave);
    }
    g.translate(p.at[0] * dims[0], p.at[1] * dims[1], p.at[2] * dims[2]);
    // Surface maps (PR-1.4) tile in object units, aligned with the walls (before the yaw); roof
    // slopes in their own plane (PG-T7).
    g.setAttribute(
      'uv',
      new THREE.BufferAttribute(
        planarUvs(
          g.getAttribute('position').array,
          g.getAttribute('normal').array,
          p.shape === 'prism' || p.shape === 'hip'
        ),
        2
      )
    );
    // Measured yaw (PF-T5): turned like on the photo.
    if (recipe.yaw) g.rotateY(recipe.yaw);
    // `set` already turns sRGB into the linear working space (ColorManagement): no second conversion.
    color.set(p.color);
    const count = g.getAttribute('position').count;
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) color.toArray(colors, i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return g;
  });
  const body = mergeGeometries(parts) ?? new THREE.BufferGeometry();
  body.clearGroups();
  let start = 0;
  parts.forEach((g, i) => {
    const count = g.getAttribute('position').count;
    const surface = sorted[i]!.surface;
    if (i > 0 && sorted[i - 1]!.surface === surface) body.groups.at(-1)!.count += count;
    else body.addGroup(start, count, surface);
    start += count;
  });
  parts.forEach((g) => g.dispose());
  return body;
}

/** Width and height of the object (largest = 1) from its box on a photo of `photoAspect` (w / h, pixels). */
export function silhouetteSize(box: NormBox, photoAspect: number): [number, number] {
  const a = box.h > 0 && photoAspect > 0 ? (box.w * photoAspect) / box.h : 1;
  return a >= 1 ? [1, 1 / a] : [a, 1];
}

/**
 * Silhouette fallback: `rings` (box fractions, y down, from `silhouetteRings`) extruded by the category
 * depth. Each ring is its own piece (SAM may return several).
 */
export function silhouetteMesh(
  rings: ReadonlyArray<ReadonlyArray<readonly [number, number]>>,
  box: NormBox,
  photoAspect: number,
  /** Depth as a share of the largest side (`silhouetteDepth`). */
  depthShare: number
): THREE.BufferGeometry {
  const [w, h] = silhouetteSize(box, photoAspect);
  const depth = depthShare * Math.max(w, h);
  const shapes = rings
    .filter((r) => r.length >= 3)
    .map(
      (r) => new THREE.Shape(r.map(([u, v]) => new THREE.Vector2((u - 0.5) * w, (0.5 - v) * h)))
    );
  const body = new THREE.ExtrudeGeometry(shapes, { depth, bevelEnabled: false, curveSegments: 1 });
  body.translate(0, 0, -depth / 2);
  return body;
}

/** Triangles of a geometry (for the scene budget). */
export function triangleCount(g: THREE.BufferGeometry): number {
  return (g.index ? g.index.count : (g.getAttribute('position')?.count ?? 0)) / 3;
}
