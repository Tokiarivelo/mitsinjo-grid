import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { ObjectRecipe, RecipePart } from '@/lib/object-shape';
import { holedBox } from '../utils/holed-wall';
import { layoutOpenings, type WallHole } from '../utils/openings';
import { recipeMesh } from '../utils/object-geometry';

/** Is (a, b) covered by a triangle of the face where coordinate `axis` = `at`? (2D test on the others.) */
function covered(g: THREE.BufferGeometry, axis: 0 | 2, at: number, a: number, b: number): boolean {
  const pos = g.getAttribute('position');
  const other = axis === 0 ? 2 : 0;
  for (let t = 0; t < pos.count; t += 3) {
    const pts = [0, 1, 2].map((k) => [
      pos.getComponent(t + k, other),
      pos.getComponent(t + k, 1),
      pos.getComponent(t + k, axis),
    ]);
    if (!pts.every((p) => Math.abs(p[2]! - at) < 1e-6)) continue;
    const [p0, p1, p2] = pts as [number[], number[], number[]];
    const d = (p: number[], q: number[]) =>
      (a - q[0]!) * (p[1]! - q[1]!) - (p[0]! - q[0]!) * (b - q[1]!);
    const [d1, d2, d3] = [d(p0, p1), d(p1, p2), d(p2, p0)];
    const neg = d1 < 0 || d2 < 0 || d3 < 0;
    const pos_ = d1 > 0 || d2 > 0 || d3 > 0;
    if (!(neg && pos_)) return true;
  }
  return false;
}

const hole = (over: Partial<WallHole>): WallHole => ({
  axis: 2,
  sign: 1,
  u: 0,
  v: 0,
  w: 0.2,
  h: 0.2,
  depth: 0.03,
  ...over,
});

describe('holedBox (PG-T11)', () => {
  it('without holes is a closed box (12 triangles)', () => {
    expect(holedBox(1, 0.6, 0.6, []).getAttribute('position').count).toBe(36);
  });

  it('cuts the hole on the right face, at the right place, on each side', () => {
    const cases: Array<[WallHole, 0 | 2, number]> = [
      [hole({ axis: 2, sign: 1, u: 0.25 }), 2, 0.3],
      [hole({ axis: 2, sign: -1, u: 0.25 }), 2, -0.3],
      [hole({ axis: 0, sign: 1, u: 0.1 }), 0, 0.5],
      [hole({ axis: 0, sign: -1, u: 0.1 }), 0, -0.5],
    ];
    for (const [h, axis, at] of cases) {
      const g = holedBox(1, 0.6, 0.6, [h]);
      expect(covered(g, axis, at, h.u, h.v)).toBe(false); // the hole
      expect(covered(g, axis, at, -h.u, h.v)).toBe(true); // the mirrored spot stays wall
    }
  });

  it('adds 4 reveal faces going `depth` into the wall, facing into the hole', () => {
    const g = holedBox(1, 0.6, 0.6, [hole({ u: 0.2, depth: 0.05 })]);
    const pos = g.getAttribute('position');
    let minZ = Infinity;
    for (let i = 0; i < pos.count; i++)
      if (Math.abs(pos.getX(i) - 0.2) < 0.11) minZ = Math.min(minZ, pos.getZ(i));
    expect(minZ).toBeCloseTo(0.3 - 0.05, 6);
  });

  it('drops a hole that leaves the face or overlaps another', () => {
    const g = holedBox(1, 0.6, 0.6, [hole({ u: 0.45 }), hole({ u: 0 }), hole({ u: 0.05 })]);
    expect(covered(g, 2, 0.3, 0, 0)).toBe(false);
    // The edge hole was dropped: its centre is wall.
    expect(covered(g, 2, 0.3, 0.47, 0)).toBe(true);
  });
});

describe('openings cut into their wall (PG-T11)', () => {
  const wall: RecipePart = {
    shape: 'box',
    at: [0, 0, 0],
    size: [1, 0.6, 0.6],
    color: '#e6dccb',
    material: 'plaster',
    kind: 'wall',
    front: true,
  };
  const win: RecipePart = {
    shape: 'box',
    at: [-0.25, 0.05, 0.3075],
    size: [0.14, 0.2, 0.015],
    color: '#2b3440',
    material: 'glass',
    kind: 'window',
  };
  const recipe: ObjectRecipe = { proportions: { w: 1, h: 0.6, d: 0.6 }, parts: [wall, win] };

  it('finds the host wall and puts the glass at the bottom of the reveal', () => {
    const { parts, holes } = layoutOpenings(recipe);
    const cut = holes.get(wall)!;
    expect(cut).toHaveLength(1);
    expect(cut[0]).toMatchObject({ axis: 2, sign: 1 });
    expect(cut[0]!.u).toBeCloseTo(-0.25, 6);
    const glass = parts.find((p) => p.material === 'glass')!;
    // World units (depth 0.6): the glass back sits `depth` behind the wall face (0.18).
    const d = recipe.proportions.d;
    expect((glass.at[2] - glass.size[2] / 2) * d).toBeCloseTo(0.18 - cut[0]!.depth, 6);
    // The hole is inside the frame: frame pieces still cover its border on the wall face.
    expect(cut[0]!.w).toBeLessThan(win.size[0]);
  });

  it('a window off every wall keeps the flat look (no hole)', () => {
    const floating = { ...win, at: [-0.25, 0.05, 0.5] as RecipePart['at'] };
    const { holes } = layoutOpenings({ ...recipe, parts: [wall, floating] });
    expect(holes.size).toBe(0);
  });

  it('the mesh shows the hole: no wall triangle in front of the glass centre', () => {
    const g = recipeMesh(recipe);
    // The wall face (world z 0.18) is open in front of the glass; elsewhere it is wall.
    const y = 0.05 * recipe.proportions.h;
    expect(covered(g, 2, 0.18, -0.25 + 0.02, y + 0.01)).toBe(false);
    expect(covered(g, 2, 0.18, 0.25, y)).toBe(true);
  });
});
