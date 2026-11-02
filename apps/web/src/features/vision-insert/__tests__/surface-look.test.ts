import { describe, expect, it } from 'vitest';
import { RECIPE_MATERIALS, type ObjectRecipe } from '@/lib/object-shape';
import { recipeMesh } from '../utils/object-geometry';
import { recipeMaterials, SURFACE_LOOK, SURFACES, surfaceIndex } from '../utils/surface-look';

const house: ObjectRecipe = {
  proportions: { w: 1, h: 0.8, d: 0.6 },
  parts: [
    {
      shape: 'box',
      at: [0, -0.25, 0],
      size: [1, 0.5, 1],
      color: '#c9a36a',
      material: 'stone',
      front: true,
    },
    { shape: 'prism', at: [0, 0.25, 0], size: [1, 0.5, 1], color: '#6e6a62', material: 'slate' },
    {
      shape: 'box',
      at: [-0.2, -0.2, 0.505],
      size: [0.1, 0.1, 0.02],
      color: '#ffffff',
      material: 'glass',
    },
    {
      shape: 'box',
      at: [0.2, -0.2, 0.505],
      size: [0.1, 0.1, 0.02],
      color: '#ffffff',
      material: 'glass',
    },
    { shape: 'box', at: [0.3, 0.35, 0], size: [0.08, 0.2, 0.1], color: '#c9a36a' },
  ],
};

describe('surface looks (AI materials)', () => {
  it('every AI material has a look; glass and metal shinier than stone', () => {
    for (const m of RECIPE_MATERIALS) expect(SURFACE_LOOK[m]).toBeDefined();
    expect(SURFACE_LOOK.glass.roughness).toBeLessThan(SURFACE_LOOK.stone.roughness);
    expect(SURFACE_LOOK.metal.metalness).toBeGreaterThan(SURFACE_LOOK.wood.metalness);
    expect(SURFACES[surfaceIndex()]).toBe('painted');
    expect(SURFACES[surfaceIndex('slate')]).toBe('slate');
  });

  it('lists the materials once each, in part order', () => {
    expect(recipeMaterials(house)).toEqual(['stone', 'slate', 'glass']);
    expect(recipeMaterials({ parts: [house.parts[4]!] })).toEqual([]);
  });

  it('recipeMesh: one geometry group per material, covering every vertex', () => {
    const g = recipeMesh(house);
    const surfaces = g.groups.map((x) => SURFACES[x.materialIndex!]);
    expect([...surfaces].sort()).toEqual(['glass', 'painted', 'slate', 'stone']);
    const total = g.groups.reduce((s, x) => s + x.count, 0);
    expect(total).toBe(g.getAttribute('position').count);
    // Two glass windows share one group (12 + 12 triangles).
    expect(g.groups.find((x) => SURFACES[x.materialIndex!] === 'glass')!.count).toBe(72);
  });
});
