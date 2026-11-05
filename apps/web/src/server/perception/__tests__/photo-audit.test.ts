// @vitest-environment node
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { ShapeTargetSchema, type ObjectRecipe, type ObjectShape } from '@/lib/object-shape';
import { getPerceptionClient } from '../client';
import { generateFacadeImage } from '../facade-specialist';
import { renderFlat, type FlatView } from '../flat-render';
import { shapeWithCritic } from '../spark-critic';
import type { StageProgress, StagesContinuation } from '../shape-stages-spark';

/**
 * Photo audit on the live Meta models (`make photo-audit PHOTO=… TARGETS=… OUT=…`, costs API
 * calls): every target of a real photo goes the app's way — 2D view (Muse Image), 3D shape
 * (`shapeWithCritic`, as `/api/vision/shape`), then the background stages — and gets one sheet
 * row: photo crop | 2D view | model front | model ¾, plus a summary line in `OUT/audit.md`.
 */
const PHOTO = process.env.PHOTO_AUDIT_PHOTO;
const TARGETS = process.env.PHOTO_AUDIT_TARGETS ?? '';
const OUT = process.env.PHOTO_AUDIT_OUT ?? '';
const ONLY = process.env.PHOTO_AUDIT_ONLY?.split(',').filter(Boolean);
/** Objects run at once (each waits on Meta most of the time). */
const PARALLEL = Number(process.env.PHOTO_AUDIT_PARALLEL ?? 3);
/** Background stages budget per object (ms). */
const STAGES_MS = Number(process.env.PHOTO_AUDIT_STAGES_MS ?? 240_000);
const TILE = 256;

const VIEWS: Record<'front' | 'threeQuarter', FlatView> = {
  front: { yaw: 0, pitch: 0 },
  threeQuarter: { yaw: (35 * Math.PI) / 180, pitch: (20 * Math.PI) / 180 },
};

async function renderTile(recipe: ObjectRecipe, view: FlatView): Promise<Buffer> {
  const r = renderFlat({ ...recipe, yaw: 0 }, 1, TILE, TILE, view);
  const rgb = Buffer.from(r.rgb);
  for (let i = 0; i < r.mask.data.length; i++) if (!r.mask.data[i]) rgb.fill(255, i * 3, i * 3 + 3);
  return sharp(rgb, { raw: { width: TILE, height: TILE, channels: 3 } })
    .png()
    .toBuffer();
}

const fitTile = (img: Buffer) =>
  sharp(img)
    .resize(TILE, TILE, { fit: 'contain', background: '#ffffff' })
    .flatten({ background: '#ffffff' })
    .png()
    .toBuffer();

async function imageBuffer(url: string): Promise<Buffer> {
  if (url.startsWith('data:')) return Buffer.from(url.split(',')[1]!, 'base64');
  return Buffer.from(await (await fetch(url)).arrayBuffer());
}

/** Runs `fn` over `items`, at most `n` at a time, results in order. */
async function pool<T, R>(items: T[], n: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]!);
      }
    })
  );
  return out;
}

describe.skipIf(!PHOTO || !TARGETS || !OUT)('photo audit (live)', () => {
  it('builds every target of the photo the app way', async () => {
    mkdirSync(OUT, { recursive: true });
    const raw = readFileSync(PHOTO!);
    const meta = await sharp(raw).metadata();
    const photo = { buffer: raw, width: meta.width!, height: meta.height! };
    const photoUrl = `data:image/jpeg;base64,${raw.toString('base64')}`;
    const targets = (JSON.parse(readFileSync(TARGETS, 'utf8')) as unknown[])
      .map((t) => ShapeTargetSchema.parse(t))
      .filter((t) => !ONLY || ONLY.includes(t.id));
    const blank = await fitTile(
      Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"/>')
    );
    const rows = await pool(targets, PARALLEL, async (target) => {
      try {
        return await auditOne(target);
      } catch (err) {
        // One object's network error never sinks the others: an error row instead.
        const summary = `| ${target.id} | ${target.label} | error: ${err instanceof Error ? err.message : String(err)} | - | - | - | - | - |`;
        console.log(summary);
        return { tiles: [blank, blank, blank, blank], summary };
      }
    });
    async function auditOne(target: (typeof targets)[number]) {
      const t0 = Date.now();
      const crop = await sharp(raw)
        .extract({
          left: Math.max(0, Math.floor(target.box.x * photo.width)),
          top: Math.max(0, Math.floor(target.box.y * photo.height)),
          width: Math.max(1, Math.round(target.box.w * photo.width)),
          height: Math.max(1, Math.round(target.box.h * photo.height)),
        })
        .png()
        .toBuffer();
      const facade = await generateFacadeImage({ target, photo }).catch(() => null);
      const withFacade = facade?.imageUrl ? { ...target, facadeUrl: facade.imageUrl } : target;
      const facadePng = facade?.imageUrl ? await imageBuffer(facade.imageUrl) : null;
      if (facadePng) writeFileSync(join(OUT, `${target.id}.view.png`), facadePng);
      const stages: StageProgress[] = [];
      let rest: StagesContinuation | null = null;
      const perception = getPerceptionClient(`audit-${target.id}`);
      const shape: ObjectShape = await shapeWithCritic(perception, photo, photoUrl, withFacade, {
        onStage: (e) => stages.push(e),
        onStagesLeft: (r) => {
          rest = r;
        },
      });
      let recipe = shape.mode === 'recipe' ? shape.recipe : undefined;
      const left = rest as StagesContinuation | null;
      if (left && recipe) {
        const done = await left.run({ budgetMs: STAGES_MS, onProgress: (e) => stages.push(e) });
        recipe = done.recipe;
      }
      const tiles = await Promise.all([
        fitTile(crop),
        facadePng
          ? fitTile(facadePng)
          : fitTile(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"/>')),
        recipe ? renderTile(recipe, VIEWS.front) : fitTile(crop),
        recipe ? renderTile(recipe, VIEWS.threeQuarter) : fitTile(crop),
      ]);
      const ended = stages.filter((e) => e.state === 'done');
      const summary = [
        `| ${target.id} | ${target.label} | ${shape.mode}${shape.reason ? ` (${shape.reason})` : ''}`,
        recipe?.source ?? '-',
        recipe ? String(recipe.parts.length) : '-',
        shape.fit ? shape.fit.iou.toFixed(2) : '-',
        ended
          .map(
            (e) =>
              `${e.stage} ${Math.round((e.before ?? 0) * 100)}→${Math.round((e.after ?? 0) * 100)} ${e.stop ?? ''}`
          )
          .join(' · ') || 'no stage',
        `${((Date.now() - t0) / 1000).toFixed(0)} s |`,
      ].join(' | ');
      console.log(summary);
      if (recipe)
        writeFileSync(
          join(OUT, `${target.id}.recipe.json`),
          JSON.stringify({ ...recipe, swatches: undefined }, null, 1)
        );
      return { tiles, summary };
    }
    const sheet = await sharp({
      create: {
        width: TILE * 4,
        height: TILE * rows.length,
        channels: 3,
        background: '#ffffff',
      },
    })
      .composite(
        rows.flatMap((r, y) =>
          r.tiles.map((input, x) => ({ input, left: x * TILE, top: y * TILE }))
        )
      )
      .png()
      .toBuffer();
    writeFileSync(join(OUT, 'sheet.png'), sheet);
    writeFileSync(
      join(OUT, 'audit.md'),
      [
        '| id | label | mode | source | parts | fit IoU | stages | time |',
        '| --- | --- | --- | --- | --- | --- | --- | --- |',
        ...rows.map((r) => r.summary),
        '',
      ].join('\n')
    );
    expect(rows.length).toBe(targets.length);
  }, 3_600_000);
});
