import { describe, expect, it } from 'vitest';
import {
  frontPartIndex,
  ObjectRecipeSchema,
  recipeIssue,
  silhouetteRings,
  type ObjectRecipe,
} from '../object-shape';
import { pathToRings } from '../vision';

const fridge: ObjectRecipe = {
  proportions: { w: 0.5, h: 1, d: 0.5 },
  parts: [
    { shape: 'box', at: [0, 0, 0], size: [1, 1, 1], color: '#eeeeee' },
    { shape: 'box', at: [0.4, 0.1, 0.5], size: [0.04, 0.3, 0.04], color: '#888888', front: true },
  ],
};

describe('pathToRings (shared)', () => {
  it('reads M/L/Z paths and the H/V commands of boxPath', () => {
    expect(pathToRings('M0 0L1 0L1 1ZM5 5L6 6Z')).toEqual([
      [
        [0, 0],
        [1, 0],
        [1, 1],
      ],
    ]);
    expect(pathToRings('M0.1 0.2H0.5V0.6H0.1Z')).toEqual([
      [
        [0.1, 0.2],
        [0.5, 0.2],
        [0.5, 0.6],
        [0.1, 0.6],
      ],
    ]);
  });
});

describe('recipeIssue (PV-T9)', () => {
  it('accepts a fridge recipe that matches a tall photo box', () => {
    expect(recipeIssue(fridge, 0.5)).toBeNull();
    expect(recipeIssue(fridge, 0)).toBeNull();
  });

  it('rejects a recipe with only tiny parts, parts far outside, or wrong proportions', () => {
    const tiny = { ...fridge, parts: [{ ...fridge.parts[1]! }] };
    expect(recipeIssue(tiny, 0.5)).toBe('no_body');
    const far: ObjectRecipe = {
      ...fridge,
      parts: [fridge.parts[0]!, { ...fridge.parts[1]!, at: [0.6, 0, 0], size: [0.5, 0.1, 0.1] }],
    };
    expect(recipeIssue(far, 0.5)).toBe('out_of_bounds');
    // Recipe says tall and narrow, the photo shows a wide object.
    expect(recipeIssue(fridge, 2)).toBe('proportions');
  });

  it('schema refuses bad colours and out-of-range values', () => {
    expect(
      ObjectRecipeSchema.safeParse({ ...fridge, parts: [{ ...fridge.parts[0]!, color: 'red' }] })
        .success
    ).toBe(false);
    expect(
      ObjectRecipeSchema.safeParse({ ...fridge, parts: [{ ...fridge.parts[0]!, size: [2, 1, 1] }] })
        .success
    ).toBe(false);
  });
});

describe('frontPartIndex', () => {
  it('uses the part marked front, else the biggest one', () => {
    expect(frontPartIndex(fridge)).toBe(1);
    // Small handle first, big body second, nothing marked → the body.
    const unmarked: ObjectRecipe = {
      ...fridge,
      parts: [{ ...fridge.parts[1]!, front: undefined }, fridge.parts[0]!],
    };
    expect(frontPartIndex(unmarked)).toBe(1);
  });
});

describe('silhouetteRings (fallback)', () => {
  const box = { x: 0.2, y: 0.4, w: 0.4, h: 0.2 };

  it('maps the SAM outline into box fractions, largest ring first', () => {
    const outline = 'M0.5 0.5L0.52 0.5L0.52 0.52ZM0.2 0.4L0.6 0.4L0.6 0.6L0.2 0.6Z';
    const rings = silhouetteRings({ box, outline });
    expect(rings).toHaveLength(2);
    expect(rings[0]!.map(([x, y]) => [+x.toFixed(6), +y.toFixed(6)])).toEqual([
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ]);
  });

  it('uses the box when there is no outline, and nothing for an empty box', () => {
    expect(silhouetteRings({ box })[0]!.map(([x, y]) => [+x.toFixed(6), +y.toFixed(6)])).toEqual([
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ]);
    expect(silhouetteRings({ box: { x: 0, y: 0, w: 0, h: 0 } })).toEqual([]);
  });
});
