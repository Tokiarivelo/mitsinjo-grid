// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { kitToRecipe, type ObjectKit } from '@/lib/object-kit';
import { EXTRUDE_POINTS_MAX, ObjectRecipeSchema, type ShapeTarget } from '@/lib/object-shape';
import { boxPath } from '@/lib/vision';
import { GOLDEN_SHAPES, goldenBox, goldenOutline } from '../__fixtures__/shape';
import { withProfileBody } from '../profile-body';

const kit = (archetype: ObjectKit['archetype']): ObjectKit => ({
  archetype,
  proportions: { w: 1, h: 0.4, d: 0.45 },
  colors: { main: '#a33327', secondary: '#cfd6dd', accent: '#1c1c1e' },
  materials: { main: 'metal', secondary: 'glass', accent: 'rubber' },
});

const targetOf = (name: string): ShapeTarget => {
  const c = GOLDEN_SHAPES.find((g) => g.name === name)!;
  return { id: name, label: name, category: 'other', box: goldenBox(c), outline: goldenOutline(c) };
};

describe('withProfileBody (PR-2.2)', () => {
  it('vehicle: the outline becomes the main body above the wheels band', () => {
    const recipe = kitToRecipe(kit('vehicle'));
    const out = withProfileBody('vehicle', recipe, targetOf('car'), 2.5);
    expect(out).not.toBe(recipe);
    expect(out.parts).toHaveLength(recipe.parts.length);
    const body = out.parts[0]!;
    expect(body.shape).toBe('extrude');
    expect(body.front).toBe(true);
    expect(body.color).toBe(recipe.parts[0]!.color);
    expect(body.points!.length).toBeGreaterThanOrEqual(3);
    expect(body.points!.length).toBeLessThanOrEqual(EXTRUDE_POINTS_MAX);
    for (const [x, y] of body.points!) {
      expect(Math.abs(x)).toBeLessThanOrEqual(0.5);
      expect(Math.abs(y)).toBeLessThanOrEqual(0.5);
    }
    // Wheels kept in their wells, arches between the tires kept.
    const wheels = out.parts.filter((p) => p.shape === 'cylinder' && p.axis === 'z');
    expect(wheels).toHaveLength(4);
    const wheelTop = Math.max(...wheels.map((w) => w.at[1] + w.size[1] / 2));
    const ringObj = body.points!.map(
      ([ux, uy]) => [body.at[0] + ux * body.size[0], body.at[1] + uy * body.size[1]] as const
    );
    for (const [x, y] of ringObj) {
      if (Math.abs(Math.abs(x) - 0.25) < 0.13) expect(y).toBeGreaterThanOrEqual(wheelTop - 1e-9);
    }
    expect(ringObj.some(([x, y]) => Math.abs(x) < 0.15 && y < wheelTop - 0.01)).toBe(true);
    // Full depth kept; the glasshouse notches the slab to the old box top (beltline),
    // the outline roof pillars outside the glass stay.
    expect(body.size[2]).toBe(recipe.parts[0]!.size[2]);
    const main = recipe.parts[0]!;
    const mainTop = main.at[1] + main.size[1] / 2;
    const obj = body.points!.map(
      ([ux, uy]) => [body.at[0] + ux * body.size[0], body.at[1] + uy * body.size[1]] as const
    );
    for (const [x, y] of obj) {
      if (x > -0.29 && x < 0.23) expect(y).toBeLessThanOrEqual(mainTop + 1e-9);
    }
    expect(obj.some(([, y]) => y > mainTop + 0.01)).toBe(true);
    // A valid recipe: the schema accepts the rebuilt body.
    expect(ObjectRecipeSchema.safeParse(out).success).toBe(true);
  });

  it('machine: full depth kept (small details drown, silhouette wins)', () => {
    const recipe = kitToRecipe(kit('machine'));
    const box = { x: 0.3, y: 0.2, w: 0.4, h: 0.6 };
    const target: ShapeTarget = {
      id: 'pump',
      label: 'pump',
      category: 'water_pump',
      box,
      outline: boxPath(box),
    };
    const out = withProfileBody('machine', recipe, target, 2.5);
    expect(out.parts[0]!.shape).toBe('extrude');
    expect(out.parts[0]!.size[2]).toBe(recipe.parts[0]!.size[2]);
    expect(ObjectRecipeSchema.safeParse(out).success).toBe(true);
  });

  it('a turned body pre-squeezes x so its projection lands on the outline', () => {
    const recipe = kitToRecipe(kit('vehicle'));
    const target = targetOf('car');
    const straight = withProfileBody('vehicle', recipe, target, 2.5).parts[0]!;
    const turned = withProfileBody('vehicle', { ...recipe, yaw: 0.1 }, target, 2.5).parts[0]!;
    expect(turned.shape).toBe('extrude');
    // Turned projection lands on the outline: (w·s·cosθ + d·s_d·sinθ) / (h·aspect) = ring width.
    const { w, h, d } = recipe.proportions;
    const sd = recipe.parts[0]!.size[2];
    const expected = (1 * h * 2.5 - d * sd * Math.sin(0.1)) / (w * Math.cos(0.1));
    expect(expected).toBeLessThan(1);
    expect(turned.size[0]).toBeCloseTo(expected, 3);
    expect(turned.size[0]).toBeLessThan(straight.size[0]);
    expect(turned.at[0]).toBeCloseTo(straight.at[0], 6);
  });

  it('cabinet: full outline height (no wheels band), details kept', () => {
    const recipe = kitToRecipe(kit('cabinet'));
    const out = withProfileBody('cabinet', recipe, targetOf('fridge'), 1);
    expect(out.parts[0]!.shape).toBe('extrude');
    // Fridge outline spans the whole box: the body too (no cut).
    expect(out.parts[0]!.size[1]).toBeCloseTo(1, 2);
    expect(out.parts).toHaveLength(recipe.parts.length);
    expect(out.parts.some((p) => p.color === kit('cabinet').colors.accent)).toBe(true);
    expect(ObjectRecipeSchema.safeParse(out).success).toBe(true);
  });

  it('leaves the recipe alone when the profile does not apply', () => {
    const vehicle = kitToRecipe(kit('vehicle'));
    const target = targetOf('car');
    expect(withProfileBody('tree', vehicle, target, 2.5)).toBe(vehicle);
    expect(withProfileBody('house', vehicle, target, 2.5)).toBe(vehicle);
    expect(withProfileBody('vehicle', vehicle, { ...target, outline: undefined }, 2.5)).toBe(
      vehicle
    );
    const yawed = { ...vehicle, yaw: 0.5 };
    expect(withProfileBody('vehicle', yawed, target, 2.5)).toBe(yawed);
    const yawedBack = { ...vehicle, yaw: -0.5 };
    expect(withProfileBody('vehicle', yawedBack, target, 2.5)).toBe(yawedBack);
    expect(withProfileBody('vehicle', vehicle, { ...target, outline: 'M0 0L1 0Z' }, 2.5)).toBe(
      vehicle
    );
    // Small yaw still profiles, up to the shared 0.3 gate (was 0.26 before PR-2.12).
    expect(withProfileBody('vehicle', { ...vehicle, yaw: 0.1 }, target, 2.5)).not.toBe(vehicle);
    expect(withProfileBody('vehicle', { ...vehicle, yaw: 0.28 }, target, 2.5)).not.toBe(vehicle);
  });
});
