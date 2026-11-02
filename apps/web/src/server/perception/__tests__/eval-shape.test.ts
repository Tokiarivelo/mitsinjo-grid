// @vitest-environment node
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { kitToRecipe, type ObjectKit } from '@/lib/object-kit';
import type { ShapeTarget } from '@/lib/object-shape';
import { getPerceptionClient } from '../client';
import { agreement, compareKits, evalCaptures, evalMarkdown } from '../eval-shape';
import { runObjectShape } from '../object-shape';
import { cropForShape, cropRectForShape } from '../shape-crop';
import {
  remapBoxToCrop,
  remapOutlineToCrop,
  writeCapture,
  type ShapeCapture,
} from '../shape-capture';
import { GOLDEN_SHAPES, goldenBox, goldenOutline, goldenSvg, PHOTO } from '../__fixtures__/shape';

const kit: ObjectKit = {
  archetype: 'vehicle',
  subtype: 'sedan',
  proportions: { w: 1, h: 0.4, d: 0.45 },
  colors: { main: '#a33327', secondary: '#cfd6dd', accent: '#1c1c1e' },
  materials: { main: 'metal', secondary: 'glass', accent: 'rubber' },
  details: { wheels: 4, doors: 2 },
};

describe('compareKits + agreement (PR-3.1)', () => {
  it('identical kits agree everywhere', () => {
    const row = { id: 'x', model: 'm', ...compareKits(kit, kit), seconds: 1 };
    const { match, total } = agreement(row);
    expect(match).toBe(total);
    expect(row.proportionsDelta).toBe(0);
  });

  it('scores mismatches per field', () => {
    const other: ObjectKit = {
      ...kit,
      subtype: 'van',
      proportions: { w: 1, h: 0.6, d: 0.45 },
      materials: { main: 'metal', secondary: 'glass', accent: 'plastic' },
      details: { wheels: 6, doors: 2 },
    };
    const row = { id: 'x', model: 'm', ...compareKits(kit, other), seconds: 1 };
    expect(row.archetype).toEqual(['vehicle', 'vehicle']);
    expect(row.subtype).toEqual(['sedan', 'van']);
    expect(row.counts.wheels).toEqual([4, 6]);
    expect(row.counts.doors).toEqual([2, 2]);
    expect(row.materials.accent).toEqual(['rubber', 'plastic']);
    expect(row.proportionsDelta).toBeCloseTo(0.2, 9);
    const { match, total } = agreement(row);
    expect(match).toBeLessThan(total);
    // archetype ✓, subtype ✗, wheels ✗, doors ✓, 3 materials (2 ✓), proportions ✗ (0.2 > 0.15)
    expect([match, total]).toEqual([4, 8]);
    const md = evalMarkdown([row]);
    expect(md).toContain('| x | m | 4/8 |');
    expect(md).toContain('wheels:4→6✗');
  });
});

describe('evalCaptures (PR-3.1)', () => {
  async function captureDir() {
    const fridge = GOLDEN_SHAPES.find((g) => g.name === 'fridge')!;
    const buffer = await sharp(Buffer.from(goldenSvg(fridge)))
      .jpeg({ quality: 85 })
      .toBuffer();
    const photo = { buffer, ...PHOTO };
    const target: ShapeTarget = {
      id: fridge.name,
      label: fridge.name,
      category: 'other',
      box: goldenBox(fridge),
      outline: goldenOutline(fridge),
    };
    const spark = {
      describeShape: vi.fn().mockResolvedValue({
        recipe: kitToRecipe(fridge.prior),
        kit: fridge.prior,
        source: 'meta',
        model: 'muse-spark-1.3',
      }),
      describeParts: vi.fn().mockResolvedValue({ recipe: null }),
    };
    const shape = await runObjectShape(spark, photo, 'data:full', target);
    if (shape.mode !== 'recipe' || !shape.recipe) throw new Error('no recipe');
    const rect = cropRectForShape(photo.width, photo.height, target.box);
    const jpeg = Buffer.from((await cropForShape(photo, target.box)).split(',')[1]!, 'base64');
    const dir = mkdtempSync(join(tmpdir(), 'shape-eval-'));
    const capture: ShapeCapture = {
      version: 1,
      id: 'fridge',
      capturedAt: new Date().toISOString(),
      source: 'meta',
      model: shape.model,
      photo: { width: photo.width, height: photo.height },
      target,
      kit: fridge.prior,
      recipe: shape.recipe,
      seconds: 0.1,
      crop: rect,
      cropTarget: {
        box: remapBoxToCrop(target.box, photo.width, photo.height, rect),
        outline: target.outline
          ? remapOutlineToCrop(target.outline, photo.width, photo.height, rect)
          : undefined,
      },
    };
    writeCapture(dir, capture, jpeg);
    return dir;
  }

  it('replays crops and compares against the frozen kits', async () => {
    const dir = await captureDir();
    const same = { describeShape: vi.fn().mockResolvedValue({ kit: kit, model: 'm' }) };
    const rows = await evalCaptures(same, dir);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.id).toBe('fridge');
    // The stub answers a vehicle kit for a fridge capture: archetype mismatch recorded.
    expect(rows[0]!.archetype).toEqual(['cabinet', 'vehicle']);
    expect(rows[0]!.seconds).toBeGreaterThanOrEqual(0);
    const quiet = { describeShape: vi.fn().mockResolvedValue({ model: 'm' }) };
    await expect(evalCaptures(quiet, dir)).resolves.toHaveLength(0);
  }, 60_000);
});

const LIVE = process.env.EVAL_SHAPE === '1';

describe.skipIf(!LIVE)('make eval-shape', () => {
  it('scores the real captures on live Spark', async () => {
    const dir =
      process.env.EVAL_SHAPE_DIR ??
      join(process.cwd(), 'src/server/perception/__fixtures__/shape/real');
    const client = getPerceptionClient('eval-shape');
    if (!client.callsMeta) throw new Error('Refusing to eval mock: set LLM_PROVIDER=meta');
    const rows = await evalCaptures(client, dir);
    const md = `# Kit eval — ${new Date().toISOString().slice(0, 10)}\n\n${evalMarkdown(rows)}`;
    console.info(`\n${md}`);
    expect(rows.length).toBeGreaterThan(0);
  }, 600_000);
});
