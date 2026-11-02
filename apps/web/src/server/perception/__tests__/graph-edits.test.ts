// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { kitToRecipe, type ObjectKit } from '@/lib/object-kit';
import { ObjectRecipeSchema, type ObjectRecipe, type PartMask } from '@/lib/object-shape';
import { polygonPath } from '@/lib/vision';
import { applyEdit } from '../graph-edits';
import type { MaskMapGeom } from '../mask-geometry';
import { withMaskPanels } from '../mask-panels';
import { checkConstraints } from '../object-graph';
import { cropRectForShape } from '../shape-crop';

const houseKit = (details?: ObjectKit['details']): ObjectKit => ({
  archetype: 'house',
  proportions: { w: 1, h: 0.6, d: 0.5 },
  colors: { main: '#aaaaaa', secondary: '#bb2222', accent: '#2222bb' },
  materials: { main: 'plaster', secondary: 'tile', accent: 'glass' },
  details,
});

const vehicleKit = (): ObjectKit => ({
  archetype: 'vehicle',
  proportions: { w: 1, h: 0.4, d: 0.45 },
  colors: { main: '#a33327', secondary: '#cfd6dd', accent: '#1c1c1e' },
  materials: { main: 'metal', secondary: 'glass', accent: 'rubber' },
});

const geomA = () => {
  const box = { x: 0.1, y: 0.1, w: 0.8, h: 0.8 };
  return { photoW: 200, photoH: 100, box, crop: cropRectForShape(200, 100, box) };
};

const rectMask = (
  geom: MaskMapGeom,
  concept: string,
  x0: number,
  y0: number,
  x1: number,
  y1: number
): PartMask => {
  const { crop } = geom;
  const cu = (px: number) => (px - crop.left) / crop.width;
  const cv = (py: number) => (py - crop.top) / crop.height;
  return {
    concept,
    box: { x: cu(x0), y: cv(y0), w: cu(x1) - cu(x0), h: cv(y1) - cv(y0) },
    outline: polygonPath([
      [cu(x0), cv(y0)],
      [cu(x1), cv(y0)],
      [cu(x1), cv(y1)],
      [cu(x0), cv(y1)],
    ]),
  };
};

/** Segmented house (one measured window) through the real panels path. */
function segmentedHouse() {
  const geom = geomA();
  const recipe = withMaskPanels(
    'house',
    kitToRecipe(houseKit()),
    [rectMask(geom, 'window', 40, 50, 70, 66)],
    geom
  );
  const leaf = recipe.parts.findIndex((p) => p.color === '#2222bb');
  expect(leaf).toBeGreaterThanOrEqual(0);
  return { recipe, leaf };
}

const wallBbox = (r: ObjectRecipe) => {
  const strips = r.parts.filter((p) => p.color === '#aaaaaa');
  return {
    x0: Math.min(...strips.map((p) => p.at[0] - p.size[0] / 2)),
    x1: Math.max(...strips.map((p) => p.at[0] + p.size[0] / 2)),
    y0: Math.min(...strips.map((p) => p.at[1] - p.size[1] / 2)),
    y1: Math.max(...strips.map((p) => p.at[1] + p.size[1] / 2)),
  };
};

describe('applyEdit (PR-2.18)', () => {
  it('enlarges a window 20 %: glass + hole grow, wall bounds kept, 0 violations', () => {
    const { recipe, leaf } = segmentedHouse();
    const before = recipe.parts[leaf]!;
    const box = wallBbox(recipe);
    const { recipe: out, graph } = applyEdit(
      'house',
      recipe,
      {
        node: leaf,
        param: 'size',
        value: { w: before.size[0] * 1.2, h: before.size[1] * 1.2 },
      },
      { outline: true }
    );
    const grown = out.parts.find((p) => p.color === '#2222bb')!;
    expect(grown.size[0]).toBeCloseTo(before.size[0] * 1.2, 9);
    expect(grown.size[1]).toBeCloseTo(before.size[1] * 1.2, 9);
    expect(grown.at[0]).toBeCloseTo(before.at[0], 9);
    expect(grown.at[2]).toBe(before.at[2]);
    // Same part count (4 strips + 1 leaf), same wall bounds.
    expect(out.parts).toHaveLength(recipe.parts.length);
    const after = wallBbox(out);
    expect(after.x0).toBeCloseTo(box.x0, 9);
    expect(after.x1).toBeCloseTo(box.x1, 9);
    expect(after.y0).toBeCloseTo(box.y0, 9);
    expect(after.y1).toBeCloseTo(box.y1, 9);
    expect(checkConstraints('house', out)).toBe(0);
    // Edited wall reads estimated, untouched roof still inferred.
    expect(grown.status).toBe('estimated');
    expect(
      out.parts.filter((p) => p.color === '#aaaaaa').every((p) => p.status === 'estimated')
    ).toBe(true);
    expect(
      out.parts
        .filter((p) => p.shape === 'prism' || p.color === '#bb2222')
        .every((p) => p.status === 'inferred')
    ).toBe(true);
    expect(graph.nodes[out.parts.indexOf(grown)]!.status).toBe('estimated');
    expect(ObjectRecipeSchema.safeParse(out).success).toBe(true);
  });

  it('moves an opening: the hole travels, the tiling conserves the wall', () => {
    const { recipe, leaf } = segmentedHouse();
    const before = recipe.parts[leaf]!;
    const { recipe: out } = applyEdit(
      'house',
      recipe,
      { node: leaf, param: 'position', value: { x: before.at[0] + 0.1 } },
      { outline: true }
    );
    const moved = out.parts.find((p) => p.color === '#2222bb')!;
    expect(moved.at[0]).toBeCloseTo(before.at[0] + 0.1, 9);
    expect(moved.at[1]).toBeCloseTo(before.at[1], 9);
    expect(moved.size[0]).toBeCloseTo(before.size[0], 9);
    const box = wallBbox(recipe);
    const after = wallBbox(out);
    expect(after.x0).toBeCloseTo(box.x0, 9);
    expect(after.x1).toBeCloseTo(box.x1, 9);
    expect(after.y0).toBeCloseTo(box.y0, 9);
    expect(after.y1).toBeCloseTo(box.y1, 9);
    expect(checkConstraints('house', out)).toBe(0);
  });

  it('shrinking a hole to nothing heals the wall', () => {
    const { recipe, leaf } = segmentedHouse();
    const { recipe: out } = applyEdit(
      'house',
      recipe,
      { node: leaf, param: 'size', value: { w: 0, h: 0 } },
      { outline: true }
    );
    expect(out.parts.some((p) => p.color === '#2222bb')).toBe(false);
    const strips = out.parts.filter((p) => p.color === '#aaaaaa');
    expect(strips).toHaveLength(1);
    expect(strips[0]!.size[0]).toBeCloseTo(1, 9);
    expect(checkConstraints('house', out)).toBe(0);
  });

  it('moves a chimney: the feet drop back onto the roof', () => {
    const recipe = kitToRecipe(houseKit({ chimney: true }));
    const stack = recipe.parts.findIndex(
      (p) => p.shape === 'box' && p.at[1] - p.size[1] / 2 > 0.1 && p.color === '#aaaaaa'
    );
    expect(stack).toBeGreaterThanOrEqual(0);
    const { recipe: out } = applyEdit(
      'house',
      recipe,
      {
        node: stack,
        param: 'position',
        value: { x: recipe.parts[stack]!.at[0] + 0.1, y: recipe.parts[stack]!.at[1] + 0.2 },
      },
      { outline: true }
    );
    const moved = out.parts[stack]!;
    expect(moved.at[0]).toBeCloseTo(recipe.parts[stack]!.at[0] + 0.1, 9);
    const roofTop = Math.max(
      ...out.parts.filter((p) => p.color === '#bb2222').map((p) => p.at[1] + p.size[1] / 2)
    );
    expect(moved.at[1] - moved.size[1] / 2).toBeCloseTo(roofTop, 9);
    expect(moved.status).toBe('estimated');
    expect(checkConstraints('house', out)).toBe(0);
  });

  it('moves a wheel and clamps an overlay back into its span', () => {
    const car = kitToRecipe(vehicleKit());
    const wheel = car.parts.findIndex((p) => p.shape === 'cylinder' && p.axis === 'z');
    const wx = car.parts[wheel]!.at[0];
    const rolled = applyEdit(
      'vehicle',
      car,
      { node: wheel, param: 'position', value: { x: wx + 0.05 } },
      { outline: true }
    );
    expect(rolled.recipe.parts[wheel]!.at[0]).toBeCloseTo(wx + 0.05, 9);
    expect(rolled.recipe.parts[wheel]!.status).toBe('estimated');
    expect(checkConstraints('vehicle', rolled.recipe)).toBe(0);
    // A facade decal dragged off the wall is pulled back (constraints re-solve).
    const house = kitToRecipe(houseKit());
    const decal = house.parts.findIndex((p) => p.color === '#2222bb');
    const dragged = applyEdit(
      'house',
      house,
      { node: decal, param: 'position', value: { x: 0.7 } },
      { outline: true }
    );
    const back = dragged.recipe.parts[decal]!;
    expect(back.at[0]).toBeLessThan(0.5);
    expect(checkConstraints('house', dragged.recipe)).toBe(0);
  });

  it('takes meters through the estimated scale', () => {
    const { recipe, leaf } = segmentedHouse();
    const { recipe: out } = applyEdit(
      'house',
      recipe,
      { node: leaf, param: 'size', value: { w: 0.4, h: 0.4 }, unit: 'meters', scale: 2 },
      { outline: true }
    );
    const grown = out.parts.find((p) => p.color === '#2222bb')!;
    expect(grown.size[0]).toBeCloseTo(0.2, 9);
    expect(grown.size[1]).toBeCloseTo(0.2, 9);
    expect(grown.status).toBe('estimated');
    expect(() =>
      applyEdit('house', recipe, { node: leaf, param: 'size', value: { w: 0.4 }, unit: 'meters' })
    ).toThrow(/scale/);
  });

  it('rejects strip edits, bad nodes and crossed params', () => {
    const { recipe, leaf } = segmentedHouse();
    const strip = recipe.parts.findIndex((p) => p.color === '#aaaaaa' && !p.front);
    expect(() =>
      applyEdit('house', recipe, { node: strip, param: 'position', value: { x: 0 } })
    ).toThrow(/opening/);
    const wallNode = recipe.parts.findIndex((p) => p.front);
    expect(() =>
      applyEdit('house', recipe, { node: wallNode, param: 'position', value: { x: 0 } })
    ).toThrow(/opening/);
    expect(() => applyEdit('house', recipe, { node: 99, param: 'size', value: { w: 1 } })).toThrow(
      /out of range/
    );
    expect(() =>
      applyEdit('house', recipe, { node: leaf, param: 'size', value: { w: 0.2, x: 0 } })
    ).toThrow(/w\/h\/d/);
    expect(() =>
      applyEdit('house', recipe, { node: leaf, param: 'position', value: { x: 0, z: 0 } })
    ).toThrow(/face plane/);
  });
});
