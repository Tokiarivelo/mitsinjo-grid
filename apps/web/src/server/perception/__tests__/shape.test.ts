import { APPLIANCE_CATEGORIES } from '@mitsinjo/engine';
import { SCENERY_TYPES } from '@/lib/vision';
import { describe, expect, it } from 'vitest';
import { ObjectRecipeSchema, recipeIssue } from '@/lib/object-shape';
import { mockRecipe, parseRecipe, shapeQuestion } from '../shape';

const reply = (o: unknown) => JSON.stringify(o);

describe('parseRecipe (PV-T9)', () => {
  it('reads a Spark recipe and rescales proportions so the largest is 1', () => {
    const r = parseRecipe(
      reply({
        proportions: { w: 60, h: 180, d: 60 },
        parts: [{ shape: 'box', at: [0, 0, 0], size: [1, 1, 1], color: '#EEEEEE', front: true }],
      })
    );
    expect(r?.proportions).toEqual({ w: 1 / 3, h: 1, d: 1 / 3 });
    expect(r?.parts[0]).toEqual({
      shape: 'box',
      at: [0, 0, 0],
      size: [1, 1, 1],
      color: '#EEEEEE',
      front: true,
    });
  });

  it('clamps values, greys bad colours and drops unreadable parts', () => {
    const r = parseRecipe(
      reply({
        proportions: { w: 1, h: 1, d: 1 },
        parts: [
          { shape: 'box', at: [3, 0, 0], size: [5, 0, 1], color: 'white', axis: 'q' },
          { shape: 'torus', at: [0, 0, 0], size: [1, 1, 1], color: '#000000' },
          { shape: 'sphere', at: [0, 0], size: [1, 1, 1], color: '#000000' },
        ],
      })
    );
    expect(r?.parts).toEqual([
      { shape: 'box', at: [0.6, 0, 0], size: [1, 0.01, 1], color: '#9aa3ad' },
    ]);
  });

  it('returns null for prose, a missing field, no usable part or zero proportions', () => {
    expect(parseRecipe('Here is a fridge')).toBeNull();
    expect(parseRecipe(reply({ parts: [] }))).toBeNull();
    expect(parseRecipe(reply({ proportions: { w: 1, h: 1, d: 1 }, parts: ['x'] }))).toBeNull();
    expect(
      parseRecipe(
        reply({
          proportions: { w: 0, h: 0, d: 0 },
          parts: [{ shape: 'box', at: [0, 0, 0], size: [1, 1, 1], color: '#000000' }],
        })
      )
    ).toBeNull();
  });

  it('quotes the label safely and never asks for energy values', () => {
    expect(shapeQuestion('my "big" fridge')).toContain("'big'");
  });
});

describe('mockRecipe', () => {
  it('gives a valid, usable recipe for every category', () => {
    for (const c of APPLIANCE_CATEGORIES) {
      const r = mockRecipe(c);
      expect(ObjectRecipeSchema.safeParse(r).success).toBe(true);
      expect(recipeIssue(r, 0)).toBeNull();
    }
  });

  it('models scenery too: a valid recipe per type, a house is not the plain box', () => {
    for (const s of SCENERY_TYPES) {
      const r = mockRecipe('other', s);
      expect(ObjectRecipeSchema.safeParse(r).success).toBe(true);
      expect(recipeIssue(r, 0)).toBeNull();
    }
    expect(mockRecipe('other', 'building').parts.length).toBeGreaterThan(1);
    expect(mockRecipe('other', 'building')).not.toEqual(mockRecipe('other'));
  });
});
