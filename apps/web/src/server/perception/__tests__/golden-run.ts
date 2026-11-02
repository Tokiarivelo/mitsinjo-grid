import sharp from 'sharp';
import { vi } from 'vitest';
import { kitToRecipe } from '@/lib/object-kit';
import type { ShapeTarget } from '@/lib/object-shape';
import { runObjectShape } from '../object-shape';
import { goldenBox, goldenOutline, goldenSvg, PHOTO, type GoldenCase } from '../__fixtures__/shape';

/**
 * Golden set (PF-T9): the whole 3D shape math on one synthetic street photo, Spark answering instantly
 * with the case's (wrong) prior. The calling test file mocks `server-only`.
 */
export async function runGolden(c: GoldenCase) {
  const buffer = await sharp(Buffer.from(goldenSvg(c)))
    .jpeg({ quality: 85 })
    .toBuffer();
  const photo = { buffer, ...PHOTO };
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
    describeParts: vi.fn().mockResolvedValue({ recipe: null }),
  };
  const t0 = performance.now();
  const shape = await runObjectShape(spark, photo, 'data:full', target);
  return { shape, ms: performance.now() - t0, photo, target };
}
