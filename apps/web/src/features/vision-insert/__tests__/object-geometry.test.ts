import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { silhouetteRings, type ObjectRecipe } from '@/lib/object-shape';
import {
  recipeMesh,
  silhouetteDepth,
  silhouetteMesh,
  silhouetteSize,
  triangleCount,
  unitPrism,
} from '../utils/object-geometry';

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

  it('stays light: 12 round parts under 15 k triangles', () => {
    const many: ObjectRecipe = {
      ...fridge,
      parts: Array.from({ length: 12 }, () => ({
        shape: 'sphere' as const,
        at: [0, 0, 0] as [number, number, number],
        size: [0.5, 0.5, 0.5] as [number, number, number],
        color: '#808080',
      })),
    };
    expect(triangleCount(recipeMesh(many))).toBeLessThan(15_000);
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
    expect(body.getAttribute('position').count).toBe(36 + 24);
    expect(bounds(body).max.y).toBeCloseTo(0.4, 6);
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
    // w·cos 30° + d·sin 30° = 0.866 + 0.25.
    expect(turned.max.x - turned.min.x).toBeCloseTo(Math.cos(Math.PI / 6) + 0.25, 6);
  });
});
