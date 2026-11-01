// @vitest-environment node
import sharp from 'sharp';
import { describe, expect, it, vi } from 'vitest';
import { kitToRecipe } from '@/lib/object-kit';
import type { ShapeTarget } from '@/lib/object-shape';
vi.mock('server-only', () => ({}));
import { deltaE2000, hexToLab } from '../color-measure';
import { runObjectShape } from '../object-shape';
import {
  GOLDEN_SHAPES,
  goldenBox,
  goldenOutline,
  goldenSvg,
  PHOTO,
  type GoldenCase,
} from '../__fixtures__/shape';

/** Golden set (PF-T9): the whole 3D shape math on five street photos, Spark answering instantly. */
async function run(c: GoldenCase) {
  const buffer = await sharp(Buffer.from(goldenSvg(c)))
    .jpeg({ quality: 85 })
    .toBuffer();
  const target: ShapeTarget = {
    id: c.name,
    label: c.name,
    category: 'other',
    box: goldenBox(c),
    outline: goldenOutline(c),
  };
  const spark = {
    describeShape: vi.fn().mockResolvedValue({
      recipe: kitToRecipe(c.prior),
      kit: c.prior,
      source: 'meta',
      model: 'muse-spark-1.3',
    }),
  };
  const t0 = performance.now();
  const shape = await runObjectShape(spark, { buffer, ...PHOTO }, 'data:full', target);
  return { shape, ms: performance.now() - t0 };
}

/**
 * Math budget per object: 300 ms when run alone (`make test-shape` sets SHAPE_BUDGET_STRICT); looser
 * inside the full suite, where 50 test files share the CPU.
 */
const BUDGET_MS = process.env.SHAPE_BUDGET_STRICT ? 300 : 1000;
const dE = (a: string, b: string) => deltaE2000(hexToLab(a), hexToLab(b));

describe('golden shapes (PF-T9)', () => {
  it.each(GOLDEN_SHAPES.map((c) => [c.name, c] as const))('%s', async (_, c) => {
    await run(c); // warm sharp and the JIT: the budget is the steady-state math
    const { shape, ms } = await run(c);
    expect(shape.mode).toBe('recipe');
    const recipe = shape.recipe!;
    // Silhouette matches the expected outline.
    expect(shape.fit!.iou).toBeGreaterThanOrEqual(0.75);
    // Colours measured on the photo, not Spark's wrong ones.
    // Templates put the main body first (walls, pole, canopy, car body).
    const main = recipe.parts[0]!.color;
    const colours = recipe.parts.map((p) => p.color);
    expect(dE(main, c.expect.main)).toBeLessThan(10);
    if (c.expect.secondary) {
      expect(Math.min(...colours.map((x) => dE(x, c.expect.secondary!)))).toBeLessThan(10);
    }
    if (c.expect.gables) {
      expect(recipe.parts.filter((p) => p.shape === 'prism')).toHaveLength(c.expect.gables);
    }
    // All the math (crop, samples, colours, roof, repetition, perspective, fit) inside the budget.
    expect(ms).toBeLessThan(BUDGET_MS);
  });
});
