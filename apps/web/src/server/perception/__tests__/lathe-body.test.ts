// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { kitToRecipe, type ObjectKit } from '@/lib/object-kit';
import { LATHE_PROFILE_MAX, ObjectRecipeSchema, type ShapeTarget } from '@/lib/object-shape';
import { boxPath, polygonPath } from '@/lib/vision';
import { GOLDEN_SHAPES, goldenBox, goldenOutline } from '../__fixtures__/shape';
import { LATHE_BODY_MIN_ROWS, LATHE_BODY_ROWS, withLatheBody } from '../lathe-body';

const kit = (archetype: ObjectKit['archetype']): ObjectKit => ({
  archetype,
  proportions: { w: 1, h: 1, d: 1 },
  colors: { main: '#3e7a34', secondary: '#6d4927', accent: '#e8d79b' },
  materials: { main: 'foliage', secondary: 'wood', accent: 'glass' },
});

const targetOf = (name: string): ShapeTarget => {
  const c = GOLDEN_SHAPES.find((g) => g.name === name)!;
  return { id: name, label: name, category: 'other', box: goldenBox(c), outline: goldenOutline(c) };
};

const boxTarget = (outline: string): ShapeTarget => {
  const box = { x: 0.2, y: 0.1, w: 0.6, h: 0.8 };
  return { id: 't', label: 't', category: 'other', box, outline };
};

describe('withLatheBody (PR-2.4)', () => {
  it('tree: the outline widths become the crown profile, canopy filler dropped', () => {
    const recipe = kitToRecipe(kit('tree'));
    expect(recipe.parts).toHaveLength(5);
    const out = withLatheBody('tree', recipe, targetOf('tree'));
    expect(out).not.toBe(recipe);
    const body = out.parts[0]!;
    expect(body.shape).toBe('lathe');
    expect(body.front).toBe(true);
    expect(body.color).toBe(recipe.parts[0]!.color);
    expect(body.material).toBe(recipe.parts[0]!.material);
    const profile = body.profile!;
    expect(profile.length).toBeGreaterThanOrEqual(LATHE_BODY_MIN_ROWS + 2);
    expect(profile.length).toBeLessThanOrEqual(LATHE_PROFILE_MAX);
    expect(profile.length).toBeLessThanOrEqual(LATHE_BODY_ROWS + 2);
    // Poles close both ends; y rises; radii fit the unit lathe.
    expect(profile[0]).toEqual([0, -0.5]);
    expect(profile[profile.length - 1]).toEqual([0, 0.5]);
    for (let i = 1; i < profile.length; i++) {
      expect(profile[i]![1]).toBeGreaterThanOrEqual(profile[i - 1]![1]);
    }
    for (const [r, y] of profile) {
      expect(r).toBeGreaterThanOrEqual(0);
      expect(r).toBeLessThanOrEqual(0.5);
      expect(Math.abs(y)).toBeLessThanOrEqual(0.5);
    }
    // Widest row uses the full radius; the body stays round (depth = width).
    expect(Math.max(...profile.map(([r]) => r))).toBeCloseTo(0.5, 6);
    expect(body.size[2]).toBe(body.size[0]);
    // Same-colour canopy spheres swallowed by the measured crown are gone; the trunk stays.
    expect(out.parts).toHaveLength(2);
    expect(out.parts[1]).toBe(recipe.parts[1]);
    expect(ObjectRecipeSchema.safeParse(out).success).toBe(true);
  });

  it('lamp post: the head follows the glass width, pole / cap / base kept', () => {
    const recipe = kitToRecipe(kit('lamp_post'));
    const out = withLatheBody('lamp_post', recipe, targetOf('lamp post'));
    expect(out).not.toBe(recipe);
    const head = out.parts.find((p) => p.front)!;
    expect(head.shape).toBe('lathe');
    expect(head.profile!.length).toBeGreaterThanOrEqual(LATHE_BODY_MIN_ROWS + 2);
    // Static template profile replaced by measured rows (radii vary, not a tube).
    const radii = head.profile!.slice(1, -1).map(([r]) => r);
    expect(Math.max(...radii) - Math.min(...radii)).toBeGreaterThan(0);
    expect(out.parts).toHaveLength(4);
    expect(ObjectRecipeSchema.safeParse(out).success).toBe(true);
  });

  it('box outline: every row measures the full width (tube profile)', () => {
    const box = { x: 0.2, y: 0.1, w: 0.6, h: 0.8 };
    const recipe = kitToRecipe(kit('bush'));
    const out = withLatheBody('bush', recipe, boxTarget(boxPath(box)));
    const body = out.parts.find((p) => p.front)!;
    expect(body.shape).toBe('lathe');
    for (const [r] of body.profile!.slice(1, -1)) expect(r).toBeCloseTo(0.5, 6);
    // Different-colour accent bud kept even though the lathe swallows it.
    expect(out.parts).toHaveLength(2);
    expect(ObjectRecipeSchema.safeParse(out).success).toBe(true);
  });

  it('triangle outline: conifer crown narrows towards the top', () => {
    const outline = polygonPath([
      [0.2, 0.9],
      [0.8, 0.9],
      [0.5, 0.1],
    ]);
    const recipe = kitToRecipe(kit('tree'));
    const out = withLatheBody('tree', recipe, boxTarget(outline));
    const body = out.parts.find((p) => p.front)!;
    expect(body.shape).toBe('lathe');
    const rows = body.profile!.slice(1, -1);
    expect(rows.length).toBeGreaterThanOrEqual(LATHE_BODY_MIN_ROWS);
    // Bottom-up rows shrink: each row is narrower than the one below (triangle scanlines).
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i]![0]).toBeLessThanOrEqual(rows[i - 1]![0] + 1e-9);
    }
    expect(rows[0]![0]).toBeCloseTo(0.5, 6);
    expect(rows[rows.length - 1]![0]).toBeLessThan(0.25);
    expect(ObjectRecipeSchema.safeParse(out).success).toBe(true);
  });

  it('returns the recipe untouched when disqualified', () => {
    const tree = kitToRecipe(kit('tree'));
    const target = targetOf('tree');
    // Wrong archetype.
    const vehicle = kitToRecipe(kit('vehicle'));
    expect(withLatheBody('vehicle', vehicle, target)).toBe(vehicle);
    // No outline.
    expect(withLatheBody('tree', tree, { ...target, outline: undefined })).toBe(tree);
    // Outline missing the body band (sliver far from the crown).
    const box = { x: 0, y: 0, w: 1, h: 1 };
    const sliver: ShapeTarget = {
      id: 's',
      label: 's',
      category: 'other',
      box,
      outline: polygonPath([
        [0.45, 0.99],
        [0.55, 0.99],
        [0.55, 0.985],
        [0.45, 0.985],
      ]),
    };
    expect(withLatheBody('tree', tree, sliver)).toBe(tree);
  });

  it('is idempotent: a second pass measures the same body', () => {
    const recipe = kitToRecipe(kit('tree'));
    const target = targetOf('tree');
    const once = withLatheBody('tree', recipe, target);
    const twice = withLatheBody('tree', once, target);
    expect(twice).not.toBe(once);
    expect(twice.parts.find((p) => p.front)!.profile).toEqual(
      once.parts.find((p) => p.front)!.profile
    );
  });
});
