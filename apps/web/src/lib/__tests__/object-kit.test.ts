import { APPLIANCE_CATEGORIES } from '@mitsinjo/engine';
import { describe, expect, it } from 'vitest';
import {
  decalWidth,
  defaultArchetype,
  KIT_ARCHETYPES,
  kitToRecipe,
  ObjectKitSchema,
  type ObjectKit,
} from '../object-kit';
import { fitRecipe, ObjectRecipeSchema, recipeIssue } from '../object-shape';
import { SCENERY_TYPES } from '../vision';

const kit = (archetype: ObjectKit['archetype'], details?: ObjectKit['details']): ObjectKit => ({
  archetype,
  proportions: { w: 1, h: 0.7, d: 0.6 },
  colors: { main: '#c9a36a', secondary: '#6e6a62', accent: '#ffffff' },
  ...(details ? { details } : {}),
});

describe('kitToRecipe (PV-T9b)', () => {
  it('every archetype gives a valid, usable recipe with the photo on one part', () => {
    for (const a of KIT_ARCHETYPES) {
      for (const details of [
        undefined,
        { windows: 8, doors: 3, wheels: 6, legs: 4, floors: 4, chimney: true },
      ]) {
        const r = kitToRecipe(kit(a, details));
        expect(ObjectRecipeSchema.safeParse(r).success, a).toBe(true);
        expect(r.parts.length).toBeLessThanOrEqual(12);
        expect(r.parts.filter((p) => p.front)).toHaveLength(1);
        expect(recipeIssue(fitRecipe(r, 1.2)), a).toBeNull();
      }
    }
  });

  it('uses the kit colours and counts: a house with 4 windows and a chimney', () => {
    const r = kitToRecipe(kit('house', { windows: 4, doors: 1, chimney: true }));
    expect(r.parts.filter((p) => p.color === '#ffffff')).toHaveLength(4);
    expect(r.parts[0]).toMatchObject({ color: '#c9a36a', front: true });
    expect(r.parts.length).toBe(1 + 3 + 1 + 4 + 1);
    expect(kitToRecipe(kit('house'))).toEqual(kitToRecipe(kit('house')));
  });

  it('every detection maps to an archetype (hint for Spark, mock)', () => {
    for (const c of APPLIANCE_CATEGORIES) expect(KIT_ARCHETYPES).toContain(defaultArchetype(c));
    for (const s of SCENERY_TYPES) expect(KIT_ARCHETYPES).toContain(defaultArchetype('other', s));
    expect(defaultArchetype('lamp')).toBe('lamp_post');
    expect(defaultArchetype('other', 'building')).toBe('house');
    expect(ObjectKitSchema.safeParse({ ...kit('tree'), colors: { main: 'red' } }).success).toBe(
      false
    );
  });
});

describe('decalWidth (PF-T1)', () => {
  it('never lets 8 windows overlap (regression: grey bar on the cottage row)', () => {
    const w = decalWidth(8, 0.76, 0.11);
    expect(w).toBeLessThan(0.76 / 7);
    expect(decalWidth(3, 0.76, 0.11)).toBe(0.11);
    expect(decalWidth(1, 0.76, 0.11)).toBe(0.11);
  });
});
