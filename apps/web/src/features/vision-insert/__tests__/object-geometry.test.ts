import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { silhouetteRings, type ObjectRecipe } from '@/lib/object-shape';
import { photoMaskTexture } from '../utils/photo-mask';
import {
  frontFacing,
  photoMaskRings,
  recipeMesh,
  setPhotoUv,
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
    const { body } = recipeMesh(fridge, box);
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
    const b = bounds(recipeMesh(handleOnly, box).body);
    expect(b.max.x - b.min.x).toBeCloseTo(0.3); // 0.6 × w 0.5
    expect(b.max.y - b.min.y).toBeCloseTo(0.04, 2);
  });

  it('projects the photo on the front of the model, mapped to the detection box', () => {
    const { front } = recipeMesh(fridge, box);
    const b = bounds(front);
    expect(b.min.z).toBeGreaterThan(0.25); // fronts only (body front = d / 2), no back face
    expect(b.max.x - b.min.x).toBeCloseTo(0.5);
    const uv = front.getAttribute('uv');
    const us = Array.from({ length: uv.count }, (_, i) => uv.getX(i));
    const vs = Array.from({ length: uv.count }, (_, i) => uv.getY(i));
    expect(Math.min(...us)).toBeCloseTo(0.2);
    expect(Math.max(...us)).toBeCloseTo(0.6);
    // flipY: the box top (y 0.1) is v 0.9, its bottom (y 0.6) v 0.4.
    expect(Math.max(...vs)).toBeCloseTo(0.9);
    expect(Math.min(...vs)).toBeCloseTo(0.4);
  });

  it('regression (cottage row): a roof shows the top of the photo box, the walls its bottom (PF-T1)', () => {
    // Before: the whole box (sky included) was squashed on the walls only.
    const house: ObjectRecipe = {
      proportions: { w: 1, h: 0.5, d: 0.4 },
      parts: [
        { shape: 'box', at: [0, -0.2, 0], size: [1, 0.6, 1], color: '#c8a46e', front: true },
        { shape: 'box', at: [0, 0.3, -0.1], size: [0.8, 0.4, 0.8], color: '#5a5048' },
      ],
    };
    const { front } = recipeMesh(house, box);
    const pos = front.getAttribute('position');
    const uv = front.getAttribute('uv');
    const vAt = (pick: (y: number) => boolean) =>
      Array.from({ length: pos.count }, (_, i) => i)
        .filter((i) => pick(pos.getY(i)))
        .map((i) => uv.getY(i));
    // Roof front (y > 0.05 of 0.5) → upper 40 % of the box: v between 0.9 and 0.7.
    const roof = vAt((y) => y > 0.06);
    expect(roof.length).toBeGreaterThan(0);
    expect(Math.min(...roof)).toBeGreaterThan(0.69);
    // Wall bottom = box bottom (v 0.4); the wall never shows the box top.
    const walls = vAt((y) => y < 0.04);
    expect(Math.min(...walls)).toBeCloseTo(0.4);
    expect(Math.max(...walls)).toBeLessThan(0.71);
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
    expect(triangleCount(recipeMesh(many, box).body)).toBeLessThan(15_000);
  });
});

describe('silhouetteMesh (fallback)', () => {
  it('sizes the object from the box on the photo, largest side = 1', () => {
    expect(silhouetteSize({ x: 0, y: 0, w: 0.5, h: 0.5 }, 2)).toEqual([1, 0.5]);
    expect(silhouetteSize({ x: 0, y: 0, w: 0.2, h: 0.8 }, 1)).toEqual([0.25, 1]);
  });

  it('extrudes the outline by the category depth with the photo cap in front', () => {
    const rings = silhouetteRings({ box });
    const tv = silhouetteMesh(rings, box, 1, silhouetteDepth({ category: 'tv' }));
    const fr = silhouetteMesh(rings, box, 1, silhouetteDepth({ category: 'fridge' }));
    const depth = (g: THREE.BufferGeometry) => bounds(g).max.z - bounds(g).min.z;
    expect(depth(tv.body)).toBeLessThan(depth(fr.body));
    expect(bounds(fr.front).min.z).toBeGreaterThan(bounds(fr.body).max.z - 0.001);
    const uv = fr.front.getAttribute('uv');
    const us = Array.from({ length: uv.count }, (_, i) => uv.getX(i));
    expect(Math.min(...us)).toBeCloseTo(0.2);
    expect(Math.max(...us)).toBeCloseTo(0.6);
  });

  it('scenery uses its own depth (a house is deep, water flat), not the `other` category', () => {
    expect(silhouetteDepth({ category: 'other', scenery: 'building' })).toBe(0.8);
    expect(silhouetteDepth({ category: 'other', scenery: 'water' })).toBe(0.1);
    expect(silhouetteDepth({ category: 'other' })).toBe(0.3);
  });

  it('builds nothing from no ring (no throw)', () => {
    const empty = silhouetteMesh([], box, 1, 0.3);
    expect(triangleCount(empty.front)).toBe(0);
  });
});

describe('setPhotoUv', () => {
  it('maps the bounds corners onto the box corners', () => {
    const g = new THREE.PlaneGeometry(2, 2);
    setPhotoUv(g, { x: 0, y: 0, w: 1, h: 1 }, { minX: -1, maxX: 1, minY: -1, maxY: 1 });
    const uv = g.getAttribute('uv');
    // PlaneGeometry vertex 0 = top-left.
    expect([uv.getX(0), uv.getY(0)]).toEqual([0, 1]);
  });
});

describe('frontFacing', () => {
  it('keeps the faces turned to the camera, not tops or sides', () => {
    const cube = new THREE.BoxGeometry(1, 1, 1).toNonIndexed();
    expect(triangleCount(frontFacing(cube))).toBe(2);
    const ball = new THREE.SphereGeometry(0.5, 16, 12).toNonIndexed();
    const f = frontFacing(ball);
    expect(triangleCount(f)).toBeLessThan(triangleCount(ball) / 2);
    expect(bounds(f).min.z).toBeGreaterThan(0);
  });
});

describe('photo mask (PF-T1)', () => {
  it('takes the SAM outline in photo fractions, nothing without one', () => {
    expect(photoMaskRings({})).toBeNull();
    expect(photoMaskRings({ outline: 'M0.2 0.1L0.6 0.1L0.6 0.6Z' })).toEqual([
      [
        [0.2, 0.1],
        [0.6, 0.1],
        [0.6, 0.6],
      ],
    ]);
  });

  it('builds no texture without a 2D canvas (jsdom): the photo stays unmasked', () => {
    expect(
      photoMaskTexture(
        [
          [
            [0, 0],
            [1, 0],
            [1, 1],
          ],
        ],
        1.5
      )
    ).toBeNull();
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
    expect(frontFacing(g).getAttribute('position').count).toBe(3);
  });

  it('merges with the other primitives in a recipe (gable roof on walls)', () => {
    const house: ObjectRecipe = {
      proportions: { w: 1, h: 0.8, d: 0.6 },
      parts: [
        { shape: 'box', at: [0, -0.25, 0], size: [1, 0.5, 1], color: '#c9a36a', front: true },
        { shape: 'prism', at: [0, 0.25, 0], size: [1, 0.5, 1], color: '#6e6a62', apex: 0.5 },
      ],
    };
    const { body, front } = recipeMesh(house, box);
    expect(body.getAttribute('position').count).toBe(36 + 24);
    expect(bounds(body).max.y).toBeCloseTo(0.4, 6);
    // Walls front (2 triangles) + gable triangle carry the photo.
    expect(front.getAttribute('position').count).toBe(9);
  });
});
