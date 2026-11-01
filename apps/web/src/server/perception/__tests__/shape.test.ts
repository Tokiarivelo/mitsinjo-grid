import { APPLIANCE_CATEGORIES } from '@mitsinjo/engine';
import { SCENERY_TYPES } from '@/lib/vision';
import { describe, expect, it } from 'vitest';
import { ObjectRecipeSchema, recipeIssue } from '@/lib/object-shape';
import {
  mockRecipe,
  parseKit,
  SHAPE_JSON_SCHEMA,
  SHAPE_SYSTEM_PROMPT,
  shapeQuestion,
} from '../shape';

const reply = (o: unknown) => JSON.stringify(o);

describe('parseKit (PV-T9b)', () => {
  it('reads a Spark kit and rescales proportions so the largest is 1', () => {
    const k = parseKit(
      reply({
        archetype: 'house',
        proportions: { w: 300, h: 150, d: 150 },
        colors: { main: '#C9A36A', secondary: '#6E6A62', accent: '#FFFFFF' },
        details: { windows: 4, doors: 1, chimney: true },
      })
    );
    expect(k).toEqual({
      archetype: 'house',
      proportions: { w: 1, h: 0.5, d: 0.5 },
      colors: { main: '#C9A36A', secondary: '#6E6A62', accent: '#FFFFFF' },
      details: { windows: 4, doors: 1, chimney: true },
    });
  });

  it('unknown archetype → the hint, bad colours → grey, counts rounded and clamped', () => {
    const k = parseKit(
      reply({
        archetype: 'cottage',
        proportions: { w: 1, h: 1, d: 1 },
        colors: { main: 'beige' },
        details: { windows: 40.4, wheels: -2, units: 12, color: 'x' },
      }),
      'house'
    );
    expect(k).toMatchObject({
      archetype: 'house',
      colors: { main: '#9aa3ad', secondary: '#9aa3ad', accent: '#9aa3ad' },
      details: { windows: 8, wheels: 0, units: 8 },
    });
  });

  it('returns null for prose, a missing archetype / proportions or zero proportions', () => {
    expect(parseKit('Here is a house')).toBeNull();
    expect(parseKit(reply({ proportions: { w: 1, h: 1, d: 1 } }))).toBeNull();
    expect(parseKit(reply({ archetype: 'tree' }))).toBeNull();
    expect(parseKit(reply({ archetype: 'tree', proportions: { w: 0, h: 0, d: 0 } }))).toBeNull();
  });

  it('asks for a short kit, not 3D coordinates (Spark was > 60 s on a building)', () => {
    expect(SHAPE_SYSTEM_PROMPT).toMatch(/do not plan 3D coordinates/);
    expect(JSON.stringify(SHAPE_JSON_SCHEMA)).not.toMatch(/"at"|"size"/);
    expect(shapeQuestion('Stone cottages', 1.2, 'house')).toContain('probably a "house"');
  });

  it('quotes the label safely and never asks for energy values', () => {
    expect(shapeQuestion('my "big" fridge')).toContain("'big'");
  });

  it('tells Spark how wide the object is on the photo', () => {
    expect(shapeQuestion('lamp post', 0.192)).toContain('0.19 times as wide as it is high');
    expect(shapeQuestion('lamp post')).not.toContain('times as wide');
  });
});

describe('parseKit materials (AI)', () => {
  it('keeps known materials per role, drops unknown ones', () => {
    const k = parseKit(
      reply({
        archetype: 'house',
        proportions: { w: 1, h: 0.6, d: 0.6 },
        colors: { main: '#c9a36a', secondary: '#6e6a62', accent: '#ffffff' },
        materials: { main: 'stone', secondary: 'marble', accent: 'glass' },
      })
    );
    expect(k?.materials).toEqual({ main: 'stone', accent: 'glass' });
  });

  it('asks Spark for materials in the prompt and the JSON schema', () => {
    expect(SHAPE_SYSTEM_PROMPT).toContain('materials');
    expect(SHAPE_JSON_SCHEMA.schema.properties.materials.properties.main.enum).toContain('slate');
  });
});

describe('mockRecipe', () => {
  it('gives a valid, usable recipe for every category', () => {
    for (const c of APPLIANCE_CATEGORIES) {
      const r = mockRecipe(c);
      expect(ObjectRecipeSchema.safeParse(r).success).toBe(true);
      expect(recipeIssue(r)).toBeNull();
    }
  });

  it('models scenery too: a valid recipe per type, a house is not the plain box', () => {
    for (const s of SCENERY_TYPES) {
      const r = mockRecipe('other', s);
      expect(ObjectRecipeSchema.safeParse(r).success).toBe(true);
      expect(recipeIssue(r)).toBeNull();
    }
    expect(mockRecipe('other', 'building').parts.length).toBeGreaterThan(1);
    expect(mockRecipe('other', 'building')).not.toEqual(mockRecipe('other'));
  });
});
