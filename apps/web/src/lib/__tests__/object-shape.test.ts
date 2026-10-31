import { describe, expect, it } from 'vitest';
import {
  fitRecipe,
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

describe('fitRecipe + recipeIssue (PV-T9)', () => {
  // What Spark sends for a lamp post: thin parts, nothing near 8 % of the box, head sticking out.
  const lampPost: ObjectRecipe = {
    proportions: { w: 0.3, h: 1, d: 0.3 },
    parts: [
      {
        shape: 'cylinder',
        at: [0, -0.05, 0],
        size: [0.1, 0.8, 0.1],
        color: '#555555',
        front: true,
      },
      { shape: 'box', at: [0.2, 0.4, 0], size: [0.4, 0.04, 0.05], color: '#555555' },
      { shape: 'cone', at: [0.4, 0.38, 0], size: [0.2, 0.1, 0.2], color: '#eeeeaa' },
    ],
  };

  it('keeps a thin lamp post (was rejected) and stretches its parts to fill the box', () => {
    const fit = fitRecipe(lampPost, 0.19);
    expect(recipeIssue(fit)).toBeNull();
    expect(ObjectRecipeSchema.safeParse(fit).success).toBe(true);
    for (let i = 0; i < 3; i++) {
      const lo = Math.min(...fit.parts.map((p) => p.at[i]! - p.size[i]! / 2));
      const hi = Math.max(...fit.parts.map((p) => p.at[i]! + p.size[i]! / 2));
      expect(lo).toBeCloseTo(-0.5, 5);
      expect(hi).toBeCloseTo(0.5, 5);
    }
  });

  it('takes width / height from the photo box, depth stays relative to height', () => {
    const fit = fitRecipe(fridge, 2);
    expect(fit.proportions.w).toBe(1);
    expect(fit.proportions.h).toBeCloseTo(0.5);
    expect(fit.proportions.d).toBeCloseTo(0.25);
    // No photo aspect → the model's proportions.
    expect(fitRecipe(fridge, 0).proportions).toEqual(fridge.proportions);
  });

  it('a fitting fridge stays the same; only an almost empty recipe is refused', () => {
    const body = { ...fridge, parts: [fridge.parts[0]!] };
    expect(fitRecipe(body, 0.5)).toEqual(body);
    expect(recipeIssue(fitRecipe(fridge, 0.5))).toBeNull();
    const wire: ObjectRecipe = {
      ...fridge,
      parts: [
        { shape: 'box', at: [0, 0, 0], size: [1, 0.01, 0.01], color: '#888888' },
        { shape: 'box', at: [0, 0.4, 0], size: [0.01, 0.2, 1], color: '#888888' },
      ],
    };
    expect(recipeIssue(fitRecipe(wire, 0))).toBe('no_body');
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
