import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { silhouetteRings, type ObjectRecipe } from '@/lib/object-shape';
import {
  recipeMesh,
  ROOF_OVERHANG,
  roundedBox,
  SPHERE_SEGMENTS,
  silhouetteDepth,
  silhouetteMesh,
  silhouetteSize,
  triangleCount,
  unitPrism,
} from '../utils/object-geometry';
import { SURFACE_LOOK } from '../utils/surface-look';

const box = { x: 0.2, y: 0.1, w: 0.4, h: 0.5 };
const fridge: ObjectRecipe = {
  proportions: { w: 0.5, h: 1, d: 0.5 },
  parts: [
    { shape: 'box', at: [0, 0, 0], size: [1, 1, 1], color: '#ffffff', front: true },
    { shape: 'cylinder', axis: 'x', at: [0, 0.4, 0.5], size: [0.6, 0.04, 0.04], color: '#000000' },
  ],
};

const bounds = (g: THREE.BufferGeometry) => {
  g.computeBoundingBox();
  return g.boundingBox!;
};

describe('recipeMesh (PV-T10)', () => {
  it('scales parts to the object proportions and keeps their colours', () => {
    const body = recipeMesh(fridge);
    const b = bounds(body);
    expect(b.max.y - b.min.y).toBeCloseTo(1);
    expect(b.max.x - b.min.x).toBeCloseTo(0.5);
    const colors = body.getAttribute('color');
    expect(colors.count).toBe(body.getAttribute('position').count);
    expect(colors.getX(0)).toBeCloseTo(1); // first part white
    expect(colors.getX(colors.count - 1)).toBeCloseTo(0); // handle black
  });

  it('regression (PR-1.1): a measured colour is converted to linear once, not twice', () => {
    // Before: `set(hex)` then `convertSRGBToLinear()` → stone #c8aa78 shown dark orange.
    const stone: ObjectRecipe = { ...fridge, parts: [{ ...fridge.parts[0]!, color: '#808080' }] };
    const colors = recipeMesh(stone).getAttribute('color');
    expect(colors.getX(0)).toBeCloseTo(new THREE.Color('#808080').r, 5);
    expect(colors.getX(0)).toBeCloseTo(0.2158, 3); // sRGB 0.5 → linear
  });

  it('turns a cylinder to its axis: the x-axis handle is long along x', () => {
    const handleOnly: ObjectRecipe = { ...fridge, parts: [fridge.parts[1]!] };
    const b = bounds(recipeMesh(handleOnly));
    expect(b.max.x - b.min.x).toBeCloseTo(0.3); // 0.6 × w 0.5
    expect(b.max.y - b.min.y).toBeCloseTo(0.04, 2);
  });

  it('regression (user): no photo on the model, only coloured parts', () => {
    // Before: the photo was projected on every front face (screenshot pasted on the 3D).
    const body = recipeMesh(fridge);
    expect(Object.keys(body.attributes).sort()).toEqual(['color', 'normal', 'position', 'uv']);
  });

  it('stays light: 12 round parts within 5 k triangles (PR-1.3)', () => {
    const many: ObjectRecipe = {
      ...fridge,
      parts: Array.from({ length: 12 }, () => ({
        shape: 'sphere' as const,
        at: [0, 0, 0] as [number, number, number],
        size: [0.5, 0.5, 0.5] as [number, number, number],
        color: '#808080',
      })),
    };
    expect(triangleCount(recipeMesh(many))).toBeLessThanOrEqual(5_000);
  });
});

describe('roundedBox (PR-1.2)', () => {
  it('keeps the exact size, rounds the corners, smooth normals there', () => {
    const g = roundedBox(1, 0.5, 0.4, 0.04);
    const b = bounds(g);
    expect(b.max.x - b.min.x).toBeCloseTo(1);
    expect(b.max.y - b.min.y).toBeCloseTo(0.5);
    expect(b.max.z - b.min.z).toBeCloseTo(0.4);
    // A corner point is cut off: no vertex at (0.5, 0.25, 0.2).
    const pos = g.getAttribute('position');
    let atCorner = false;
    const normals = new Set<string>();
    const n = g.getAttribute('normal');
    for (let i = 0; i < pos.count; i++) {
      if (Math.hypot(pos.getX(i) - 0.5, pos.getY(i) - 0.25, pos.getZ(i) - 0.2) < 1e-4)
        atCorner = true;
      normals.add(`${n.getX(i).toFixed(2)},${n.getY(i).toFixed(2)},${n.getZ(i).toFixed(2)}`);
    }
    expect(atCorner).toBe(false);
    expect(normals.size).toBeGreaterThan(6); // more than the 6 face normals of a sharp box
    expect(Object.keys(g.attributes).sort()).toEqual(['normal', 'position', 'uv']);
  });

  it('radius ≤ ¼ of the thinnest side; negligible radius → plain 12-triangle box', () => {
    const thin = roundedBox(1, 1, 0.02, 0.04);
    expect(bounds(thin).max.z - bounds(thin).min.z).toBeCloseTo(0.02);
    expect(triangleCount(roundedBox(1, 1, 1, 0.001))).toBe(12);
  });

  it('a metal box is rounder than a stone one (radius by material)', () => {
    const part = (material: 'metal' | 'stone'): ObjectRecipe => ({
      proportions: { w: 1, h: 1, d: 1 },
      parts: [{ shape: 'box', at: [0, 0, 0], size: [1, 1, 1], color: '#808080', material }],
    });
    // Distance of the vertex nearest to the sharp corner grows with the radius.
    const cornerGap = (g: THREE.BufferGeometry) => {
      const pos = g.getAttribute('position');
      let best = Infinity;
      for (let i = 0; i < pos.count; i++)
        best = Math.min(best, Math.hypot(pos.getX(i) - 0.5, pos.getY(i) - 0.5, pos.getZ(i) - 0.5));
      return best;
    };
    expect(cornerGap(recipeMesh(part('metal')))).toBeGreaterThan(
      cornerGap(recipeMesh(part('stone')))
    );
  });

  it('budget: 12 rounded boxes stay under 5 k triangles', () => {
    const boxes: ObjectRecipe = {
      ...fridge,
      parts: Array.from({ length: 12 }, () => ({
        shape: 'box' as const,
        at: [0, 0, 0] as [number, number, number],
        size: [0.5, 0.5, 0.5] as [number, number, number],
        color: '#808080',
        material: 'metal' as const,
      })),
    };
    expect(triangleCount(recipeMesh(boxes))).toBeLessThanOrEqual(5_000);
  });
});

describe('silhouetteMesh (fallback)', () => {
  it('sizes the object from the box on the photo, largest side = 1', () => {
    expect(silhouetteSize({ x: 0, y: 0, w: 0.5, h: 0.5 }, 2)).toEqual([1, 0.5]);
    expect(silhouetteSize({ x: 0, y: 0, w: 0.2, h: 0.8 }, 1)).toEqual([0.25, 1]);
  });

  it('extrudes the outline by the category depth, no photo cap', () => {
    const rings = silhouetteRings({ box });
    const tv = silhouetteMesh(rings, box, 1, silhouetteDepth({ category: 'tv' }));
    const fr = silhouetteMesh(rings, box, 1, silhouetteDepth({ category: 'fridge' }));
    const depth = (g: THREE.BufferGeometry) => bounds(g).max.z - bounds(g).min.z;
    expect(depth(tv)).toBeLessThan(depth(fr));
    expect(bounds(fr).max.x - bounds(fr).min.x).toBeCloseTo(0.8);
  });

  it('scenery uses its own depth (a house is deep, water flat), not the `other` category', () => {
    expect(silhouetteDepth({ category: 'other', scenery: 'building' })).toBe(0.8);
    expect(silhouetteDepth({ category: 'other', scenery: 'water' })).toBe(0.1);
    expect(silhouetteDepth({ category: 'other' })).toBe(0.3);
  });

  it('builds nothing from no ring (no throw)', () => {
    const empty = silhouetteMesh([], box, 1, 0.3);
    expect(triangleCount(empty)).toBe(0);
  });
});

describe('unitPrism (PF-T3)', () => {
  it('fills the unit box with the ridge at the apex, front face turned to the camera', () => {
    const g = unitPrism(0.25);
    const b = bounds(g);
    expect(b.min.toArray()).toEqual([-0.5, -0.5, -0.5]);
    expect(b.max.toArray()).toEqual([0.5, 0.5, 0.5]);
    const pos = g.getAttribute('position');
    const top = Array.from({ length: pos.count }, (_, i) => i).filter((i) => pos.getY(i) === 0.5);
    for (const i of top) expect(pos.getX(i)).toBe(-0.25);
    expect(triangleCount(g)).toBe(8);
  });

  it('merges with the other primitives in a recipe (gable roof on walls)', () => {
    const house: ObjectRecipe = {
      proportions: { w: 1, h: 0.8, d: 0.6 },
      parts: [
        { shape: 'box', at: [0, -0.25, 0], size: [1, 0.5, 1], color: '#c9a36a', front: true },
        { shape: 'prism', at: [0, 0.25, 0], size: [1, 0.5, 1], color: '#6e6a62', apex: 0.5 },
      ],
    };
    const body = recipeMesh(house);
    // Rounded walls (PR-1.2: 300 triangles) + the 8-triangle prism.
    expect(body.getAttribute('position').count).toBe(3 * (2 * 6 * 25 + 8));
    expect(bounds(body).max.y).toBeCloseTo(0.4, 6);
  });

  it('a gable roof overhangs the walls on every side, the ridge stays at its height (PR-1.3)', () => {
    const roof: ObjectRecipe = {
      proportions: { w: 1, h: 0.8, d: 0.6 },
      parts: [{ shape: 'prism', at: [0, 0.25, 0], size: [1, 0.5, 1], color: '#6e6a62' }],
    };
    const b = bounds(recipeMesh(roof));
    expect(b.max.x - b.min.x).toBeCloseTo(1 + 2 * ROOF_OVERHANG, 6);
    expect(b.max.z - b.min.z).toBeCloseTo(0.6 + 2 * ROOF_OVERHANG, 6);
    expect(b.max.y).toBeCloseTo(0.4, 6);
    expect(b.max.y - b.min.y).toBeCloseTo(0.4, 6);
  });
});

describe('round parts (PR-1.3)', () => {
  const one = (shape: 'sphere' | 'cylinder' | 'cone'): ObjectRecipe => ({
    proportions: { w: 1, h: 1, d: 1 },
    parts: [{ shape, at: [0, 0, 0], size: [1, 1, 1], color: '#808080' }],
  });
  /** Distinct normals on the curved surface (y ≈ 0 band of the side): many = smooth, few = facets. */
  const sideNormals = (g: THREE.BufferGeometry) => {
    const pos = g.getAttribute('position');
    const n = g.getAttribute('normal');
    const set = new Set<string>();
    for (let i = 0; i < pos.count; i++)
      if (Math.abs(n.getY(i)) < 0.9) set.add(`${n.getX(i).toFixed(3)},${n.getZ(i).toFixed(3)}`);
    return set.size;
  };
  // Smooth shading: one normal per vertex column, not per face (flat would repeat each face normal).
  it.each(['sphere', 'cylinder', 'cone'] as const)('%s is smooth-shaded', (shape) => {
    const g = recipeMesh(one(shape));
    const pos = g.getAttribute('position');
    const n = g.getAttribute('normal');
    // On a smooth surface the normal points away from the axis through the vertex.
    let aligned = 0;
    let side = 0;
    for (let i = 0; i < pos.count; i++) {
      const r = Math.hypot(pos.getX(i), pos.getZ(i));
      if (r < 0.2 || Math.abs(n.getY(i)) > 0.9) continue;
      side++;
      const cos =
        (pos.getX(i) * n.getX(i) + pos.getZ(i) * n.getZ(i)) /
        (r * Math.hypot(n.getX(i), n.getZ(i)));
      if (cos > 0.999) aligned++;
    }
    expect(aligned / side).toBeGreaterThan(0.99);
    expect(sideNormals(g)).toBeGreaterThanOrEqual(SPHERE_SEGMENTS[0]);
  });
});

describe('recipeMesh with a yaw (PF-T5)', () => {
  const block: ObjectRecipe = {
    proportions: { w: 1, h: 0.6, d: 0.5 },
    parts: [{ shape: 'box', at: [0, 0, 0], size: [1, 1, 1], color: '#cccccc', front: true }],
  };

  it('turns the model like on the photo: the side shows, the box seen wider', () => {
    const straight = bounds(recipeMesh(block));
    const turned = bounds(recipeMesh({ ...block, yaw: Math.PI / 6 }));
    expect(straight.max.x - straight.min.x).toBeCloseTo(1, 6);
    // Sharp box: w·cos 30° + d·sin 30°; rounded corners (PR-1.2) take 2r off each side, add 2r back.
    const r = SURFACE_LOOK.painted.radius;
    const expected = (1 - 2 * r) * Math.cos(Math.PI / 6) + (0.5 - 2 * r) * 0.5 + 2 * r;
    expect(turned.max.x - turned.min.x).toBeCloseTo(expected, 3);
  });
});
