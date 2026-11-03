// @vitest-environment node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { env } from '@/lib/env';
import type { ObjectRecipe, ShapeTarget } from '@/lib/object-shape';
import { getPerceptionClient } from '../client';
import { buildFacadePrompt, museImage } from '../facade-specialist';
import { renderFlat, type FlatView } from '../flat-render';
import { runObjectShape } from '../object-shape';
import { elevationDiff, formatElevationScore, type ScoredElevation } from '../elevation-score';
import type { Elevation } from '../facade-house';
import { conceptOf, samBoxToNorm } from '../outline';
import type { StagesContinuation } from '../shape-stages-spark';
import {
  newStageCapture,
  recordingProposeShapeOps,
  replayStageCapture,
  stageReplayMarkdown,
  writeStageCapture,
  type StageAnswer,
} from '../stage-capture';

/**
 * Facade → 3D end to end on the live Meta models (`make facade-e2e FRONT=… OUT=…`, costs API
 * calls): a ¾ « photo » of the house drawn by Muse Image from the facade (cached), SAM on it for
 * the box, the full shape pipeline with the facade, then the model rendered front / right side /
 * ¾ next to the elevations in `OUT/sheet.png`, and the measured proportions printed.
 */
const FRONT = process.env.FACADE_E2E_FRONT;
const OUT = process.env.FACADE_E2E_OUT ?? '';

/** Any object (PV-H): label and scenery type, a house by default. */
const LABEL = process.env.FACADE_E2E_LABEL ?? 'house';
const SCENERY = (process.env.FACADE_E2E_SCENERY ?? 'building') as ShapeTarget['scenery'];

const PHOTO_PROMPT =
  process.env.FACADE_E2E_PHOTO_PROMPT ??
  `A realistic daylight photograph of this exact ${LABEL}, seen from the front-left at a three-quarter angle, in a rural Malagasy village, a small bush partly hiding its right corner. Photographic, natural colours.`;

const VIEWS: Record<string, FlatView> = {
  front: { yaw: 0, pitch: 0 },
  side: { yaw: -Math.PI / 2, pitch: 0 },
  threeQuarter: { yaw: (35 * Math.PI) / 180, pitch: (20 * Math.PI) / 180 },
};

async function renderPng(recipe: ObjectRecipe, view: FlatView, size = 384): Promise<Buffer> {
  const r = renderFlat({ ...recipe, yaw: 0 }, 1, size, size, view);
  const rgb = Buffer.from(r.rgb);
  for (let i = 0; i < r.mask.data.length; i++) if (!r.mask.data[i]) rgb.fill(255, i * 3, i * 3 + 3);
  return sharp(rgb, { raw: { width: size, height: size, channels: 3 } })
    .png()
    .toBuffer();
}

const tile = (png: Buffer, size = 384) =>
  sharp(png)
    .resize(size, size, { fit: 'contain', background: '#ffffff' })
    .flatten({ background: '#ffffff' })
    .png()
    .toBuffer();

describe.skipIf(!FRONT)('facade → 3D end to end (live)', () => {
  it('rebuilds the house from its elevations', async () => {
    mkdirSync(OUT, { recursive: true });
    // FACADE_E2E_FRONT_PROMPT: the front itself drawn first by the facade specialist (cached).
    if (!existsSync(FRONT!) && process.env.FACADE_E2E_FRONT_PROMPT)
      writeFileSync(
        FRONT!,
        await museImage(
          buildFacadePrompt(
            SCENERY === 'building' ? 'house' : 'other',
            LABEL,
            process.env.FACADE_E2E_FRONT_PROMPT
          )
        )
      );
    const front = readFileSync(FRONT!);
    const frontUrl = `data:image/png;base64,${front.toString('base64')}`;
    const photoPath = process.env.FACADE_E2E_PHOTO ?? join(OUT, 'photo.png');
    if (!existsSync(photoPath)) writeFileSync(photoPath, await museImage(PHOTO_PROMPT, [frontUrl]));
    const buffer = await sharp(readFileSync(photoPath)).jpeg({ quality: 90 }).toBuffer();
    const meta = await sharp(buffer).metadata();
    const photo = { buffer, width: meta.width!, height: meta.height! };
    const photoUrl = `data:image/jpeg;base64,${buffer.toString('base64')}`;
    const live = getPerceptionClient('facade-e2e');
    // PG-T22: every stage answer is recorded (replayed offline by `make eval-stages`).
    const answers: StageAnswer[] = [];
    const client = Object.assign(Object.create(live) as typeof live, {
      proposeShapeOps: recordingProposeShapeOps(live.proposeShapeOps.bind(live), answers),
    });
    const seg = await client.segmentImage(photoUrl, conceptOf({ label: LABEL }));
    const inst = [...seg.instances].sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))[0];
    const box = inst && samBoxToNorm(inst.box, seg.imageWidth, seg.imageHeight);
    expect(box).toBeTruthy();
    const target: ShapeTarget = {
      id: 'facade-e2e',
      label: LABEL,
      category: 'other',
      ...(SCENERY ? { scenery: SCENERY } : {}),
      box: box!,
      ...(inst!.outline && inst!.outline.length < 6000 ? { outline: inst!.outline } : {}),
      facadeUrl: frontUrl,
    };
    let side: Buffer | null = null;
    let elevation: { front: Elevation; score: ScoredElevation } | null = null;
    let stageSeed: { seed: ObjectRecipe; front: Elevation } | null = null;
    let rest: StagesContinuation | null = null;
    const t0 = Date.now();
    const shape = await runObjectShape(client, photo, photoUrl, target, {
      timeoutMs: 120_000,
      onSideView: (png) => {
        side = png;
      },
      onElevation: (f, score) => {
        elevation = { front: f, score };
      },
      onStageSeed: (seed, f) => {
        stageSeed = { seed, front: f };
      },
      onStagesLeft: (r) => {
        rest = r;
      },
    });
    console.log(
      `shape in ${((Date.now() - t0) / 1000).toFixed(1)} s: ${shape.mode} ${shape.reason ?? ''}`
    );
    expect(shape.mode).toBe('recipe');
    let recipe = shape.recipe!;
    // PG-T18: the stages left after the first answer, run to the end as the route's job would.
    const left = rest as StagesContinuation | null;
    if (left) {
      const t1 = Date.now();
      const done = await left.run({ budgetMs: 180_000, onProgress: () => {} });
      recipe = done.recipe;
      console.log(
        `background stages (${left.stages.join(', ')}) in ${((Date.now() - t1) / 1000).toFixed(1)} s${done.cause ? `: ${done.cause}` : ''}`
      );
    }
    const seeded = stageSeed as { seed: ObjectRecipe; front: Elevation } | null;
    if (seeded) {
      const capture = newStageCapture({
        id: process.env.FACADE_E2E_ID ?? 'facade-e2e',
        model: env.LLM_PROVIDER === 'meta' ? env.META_VISION_MODEL : 'mock',
        label: LABEL,
        front: seeded.front,
        seed: seeded.seed,
        answers,
      });
      console.log(`stage capture: ${writeStageCapture(OUT, capture)} (${answers.length} answers)`);
      const keepDir = process.env.FACADE_E2E_CAPTURE_DIR;
      if (keepDir && process.env.FACADE_E2E_ID)
        console.log(`kept for make eval-stages: ${writeStageCapture(keepDir, capture)}`);
      console.log(stageReplayMarkdown([(await replayStageCapture(capture)).row]));
    }
    writeFileSync(
      join(OUT, 'recipe.json'),
      JSON.stringify({ ...recipe, swatches: undefined }, null, 2)
    );
    if (side) writeFileSync(join(OUT, 'side.png'), side);
    console.log(
      `source=${recipe.source} parts=${recipe.parts.length} w:h:d=${recipe.proportions.w.toFixed(2)}:${recipe.proportions.h.toFixed(2)}:${recipe.proportions.d.toFixed(2)} materials=${recipe.parts.map((p) => `${p.shape}/${p.material ?? '-'}`).join(' ')}`
    );
    const tiles = await Promise.all([
      tile(front),
      renderPng(recipe, VIEWS.front!),
      side
        ? tile(side)
        : tile(
            await sharp({ create: { width: 8, height: 8, channels: 3, background: '#ffffff' } })
              .png()
              .toBuffer()
          ),
      renderPng(recipe, VIEWS.side!),
      tile(readFileSync(photoPath)),
      renderPng(recipe, VIEWS.threeQuarter!),
    ]);
    const sheet = await sharp({
      create: { width: 384 * 2, height: 384 * 3, channels: 3, background: '#ffffff' },
    })
      .composite(
        tiles.map((input, i) => ({ input, left: (i % 2) * 384, top: Math.floor(i / 2) * 384 }))
      )
      .png()
      .toBuffer();
    writeFileSync(join(OUT, 'sheet.png'), sheet);
    // PG-T4: drawing | elevation render | diff (red missing, blue extra, amber wrong part).
    const elev = elevation as { front: Elevation; score: ScoredElevation } | null;
    if (elev) {
      console.log(formatElevationScore(elev.score));
      const { render } = elev.score;
      const raw = (rgb: ArrayLike<number>, mask?: Uint8Array) => {
        const b = Buffer.from(rgb as Uint8ClampedArray);
        if (mask) for (let i = 0; i < mask.length; i++) if (!mask[i]) b.fill(255, i * 3, i * 3 + 3);
        return sharp(b, { raw: { width: render.cols, height: render.rows, channels: 3 } })
          .resize(render.cols * 3, render.rows * 3, { kernel: 'nearest' })
          .png()
          .toBuffer();
      };
      const diff = elevationDiff(recipe, elev.score);
      const [built, delta, drawn] = await Promise.all([
        raw(render.rgb, render.mask.data),
        raw(diff.rgb),
        sharp(front)
          .resize(render.cols * 3, render.rows * 3)
          .png()
          .toBuffer(),
      ]);
      const w = render.cols * 3;
      writeFileSync(
        join(OUT, 'elevation.png'),
        await sharp({
          create: { width: w * 3, height: render.rows * 3, channels: 3, background: '#ffffff' },
        })
          .composite([drawn, built, delta].map((input, i) => ({ input, left: i * w, top: 0 })))
          .png()
          .toBuffer()
      );
      writeFileSync(
        join(OUT, 'elevation.json'),
        JSON.stringify({ ...elev.score, render: undefined, target: undefined }, null, 2)
      );
    }
    // First answer (≤ 90 s) + background stages (≤ 3 min) + drawing the photo.
  }, 600_000);
});
