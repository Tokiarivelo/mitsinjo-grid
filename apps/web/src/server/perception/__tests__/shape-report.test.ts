// @vitest-environment node
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { renderFlat, THREE_QUARTER } from '../flat-render';
import type { ModelScore } from '../model-score';
import { scoreRecipe } from '../score-shape';
import {
  contactSheet,
  reportMarkdown,
  worstMetric,
  type ReportRow,
  type SheetRow,
} from '../shape-report';
import { GOLDEN_SHAPES } from '../__fixtures__/shape';
import { runGolden } from './golden-run';

const score = (over: Partial<ModelScore>): ModelScore => ({
  iou: 0.9,
  edgeF1: 0.7,
  deltaE: 4,
  score: 85,
  ...over,
});

describe('shape report (PR-0.3)', () => {
  it('names the metric farthest from its target', () => {
    expect(worstMetric(score({ edgeF1: 0.3 })).metric).toBe('edgeF1');
    expect(worstMetric(score({ deltaE: 20 })).metric).toBe('deltaE');
    expect(worstMetric(score({})).gap).toBeLessThanOrEqual(0);
  });

  it('writes one row per object, the means and the next object to fix', () => {
    const rows: ReportRow[] = [
      { name: 'fridge', score: score({ score: 97 }), parts: 3, ms: 40 },
      { name: 'car', score: score({ score: 60, edgeF1: 0.4 }), parts: 7, ms: 80 },
    ];
    const md = reportMarkdown(rows, '2026-11-01');
    expect(md).toContain('| car | 60 | 0.9 ✓ | 0.4 ✗ |');
    expect(md).toContain('| **mean** | 79 |');
    expect(md).toContain('**Next:** car (score 60) — edgeF1');
  });

  it('builds a contact sheet with a row per object', async () => {
    const { shape, photo, target } = await runGolden(GOLDEN_SHAPES[3]!);
    const s = (await scoreRecipe(photo, target, shape.recipe!))!;
    const row: SheetRow = {
      name: 'car',
      crop: s.crop,
      flat: s.render,
      threeQuarter: renderFlat(shape.recipe!, 1, 160, 120, THREE_QUARTER),
    };
    const meta = await sharp(await contactSheet([row, row])).metadata();
    expect(meta.format).toBe('png');
    expect(meta.height).toBeGreaterThan(2 * 160);
  });
});

/**
 * `make shape-report` (SHAPE_REPORT=1): the golden set → `test-results/shape-report/` (index.md +
 * contact-sheet.png + recipes.json). Skipped in the normal suite.
 */
describe.runIf(process.env.SHAPE_REPORT)('make shape-report', () => {
  it('writes the report', async () => {
    const dir = process.env.SHAPE_REPORT_DIR ?? join(process.cwd(), 'test-results', 'shape-report');
    const rows: ReportRow[] = [];
    const sheet: SheetRow[] = [];
    const recipes: Array<{ name: string; recipe: unknown }> = [];
    for (const c of GOLDEN_SHAPES) {
      await runGolden(c); // warm-up: `ms` is the steady-state math
      const { shape, ms, photo, target } = await runGolden(c);
      const recipe = shape.recipe!;
      const s = await scoreRecipe(photo, target, recipe);
      if (!s) continue;
      rows.push({ name: c.name, score: s.score, parts: recipe.parts.length, ms });
      recipes.push({ name: c.name, recipe });
      sheet.push({
        name: `${c.name} — ${s.score.score}`,
        crop: s.crop,
        flat: s.render,
        threeQuarter: renderFlat(recipe, 1, 160, 120, THREE_QUARTER),
      });
    }
    await mkdir(dir, { recursive: true });
    const md = reportMarkdown(rows, new Date().toISOString().slice(0, 10));
    await writeFile(join(dir, 'index.md'), md);
    await writeFile(join(dir, 'contact-sheet.png'), await contactSheet(sheet));
    // Fitted recipes for `make shape-shots` (the real 3D viewer, stubbed API).
    await writeFile(join(dir, 'recipes.json'), JSON.stringify(recipes));
    console.info(`\n${md}\n→ ${dir}`);
    expect(rows.length).toBe(GOLDEN_SHAPES.length);
  }, 60_000);
});
