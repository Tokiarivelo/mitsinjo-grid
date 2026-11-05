import 'server-only';

import sharp from 'sharp';
import { flatWaterRecipe, kitToRecipe, type ObjectKit } from '@/lib/object-kit';
import {
  SHAPE_TIMEOUT_MS,
  type ObjectRecipe,
  type ObjectShape,
  type ShapeTarget,
} from '@/lib/object-shape';
import type { PerceptionClient } from './client';
import { renderFlat, type FlatRender } from './flat-render';
import type { ModelScore, RgbGrid } from './model-score';
import { runObjectShape, type ObjectShapeOptions } from './object-shape';
import type { PhotoForRegions } from './region';
import { scoreRecipe } from './score-shape';
import { criticQuestion, mergeKitPatch } from './shape';

/**
 * Spark visual critic, shared half (PR-0.6): the side-by-side image (photo crop | flat render)
 * and one patch request. Meta models do not render 3D; we render, Spark judges. The live round
 * lives in `runObjectShape` (1 round, score < 70, ≥ 20 s left), the offline rounds in
 * `criticReplay` (captures, ≤ 3); both keep the patch only when the score rises.
 */

/** Critic image width (px); the skill asks for a 256-wide flat render. */
export const CRITIC_WIDTH = 256;
/** Live round gates: score below this, this much time left. */
export const CRITIC_SCORE_MAX = 70;
export const CRITIC_TIME_MIN_MS = 20_000;

/** Render background → white, so dark parts stay visible to the judge. */
function onWhite(r: FlatRender): Buffer {
  const out = Buffer.from(r.rgb);
  for (let i = 0; i < r.mask.data.length; i++) {
    if (!r.mask.data[i]) {
      out[i * 3] = 255;
      out[i * 3 + 1] = 255;
      out[i * 3 + 2] = 255;
    }
  }
  return out;
}

/**
 * Crop (left) | flat render at the photo view (right), one PNG data URL. The render is rebuilt
 * at critic width (the fit grid is coarser); the crop is scaled to the same height.
 */
export async function criticImage(
  crop: RgbGrid,
  recipe: ObjectRecipe,
  aspect: number
): Promise<string> {
  const rows = Math.min(512, Math.max(32, Math.round(CRITIC_WIDTH / Math.max(0.1, aspect))));
  const render = renderFlat(recipe, aspect, CRITIC_WIDTH, rows);
  const left = sharp(Buffer.from(crop.rgb as Uint8Array), {
    raw: { width: crop.cols, height: crop.rows, channels: 3 },
  }).resize({ height: rows });
  const right = sharp(onWhite(render), {
    raw: { width: CRITIC_WIDTH, height: rows, channels: 3 },
  }).png();
  const [l, r] = await Promise.all([left.png().toBuffer(), right.toBuffer()]);
  const lm = await sharp(l).metadata();
  const width = (lm.width ?? CRITIC_WIDTH) + CRITIC_WIDTH;
  const png = await sharp({
    create: { width, height: rows, channels: 3, background: '#ffffff' },
  })
    .composite([
      { input: l, left: 0, top: 0 },
      { input: r, left: lm.width ?? CRITIC_WIDTH, top: 0 },
    ])
    .png()
    .toBuffer();
  return `data:image/png;base64,${png.toString('base64')}`;
}

/**
 * Live shape with one critic round (PR-0.6): run, score against the used outline, and when the
 * score is below 70 with ≥ 20 s left, patch → re-fit → keep only when the score rises. The
 * scoring sits outside `runObjectShape`, so the 300 ms shape-math budget is untouched. Mock and
 * outline-less runs never round (no kit, or nothing to score against). Never throws.
 */
export async function shapeWithCritic(
  ...args: Parameters<typeof shapeWithCriticRound>
): Promise<ObjectShape> {
  const shape = await shapeWithCriticRound(...args);
  return shape.mode === 'recipe' && shape.recipe && shape.kit?.archetype === 'water'
    ? { ...shape, recipe: flatWaterRecipe(shape.recipe) }
    : shape;
}

async function shapeWithCriticRound(
  perception: Pick<PerceptionClient, 'describeShape' | 'describeParts' | 'criticizeShape'> &
    Partial<Pick<PerceptionClient, 'segmentImage' | 'checkViews'>>,
  photo: PhotoForRegions | null,
  fullImageUrl: string,
  target: ShapeTarget,
  opts: ObjectShapeOptions = {}
): Promise<ObjectShape> {
  const started = Date.now();
  const timeoutMs = opts.timeoutMs ?? SHAPE_TIMEOUT_MS;
  const shape = await runObjectShape(perception, photo, fullImageUrl, target, opts);
  try {
    if (
      !photo ||
      shape.mode !== 'recipe' ||
      !shape.recipe ||
      !shape.kit ||
      !shape.outline ||
      // Free recipes have no template to patch: rebuilding from a patched kit would swap the
      // imagined parts for the crude placeholder ones.
      shape.recipe.source === 'free' ||
      // Facade / views recipes are measured on the drawn views, not on the photo: nothing to patch.
      shape.recipe.source === 'facade' ||
      shape.recipe.source === 'views' ||
      timeoutMs - (Date.now() - started) < CRITIC_TIME_MIN_MS
    ) {
      return shape;
    }
    const scored = await scoreRecipe(
      photo,
      { box: target.box, outline: shape.outline },
      shape.recipe,
      shape.partMasks
    );
    if (!scored || scored.score.score >= CRITIC_SCORE_MAX) return shape;
    const w = target.box.w * photo.width;
    const h = target.box.h * photo.height;
    if (!(w > 0 && h > 0)) return shape;
    const patch = await requestPatch(
      perception,
      await criticImage(scored.crop, shape.recipe, w / h),
      shape.kit,
      scored.score,
      opts.signal
    );
    if (!patch) return shape;
    // No re-check of the budget here: the patch is paid for, and the retry below carries no
    // LLM call (stubbed kit, same photo) — only the 5 s SAM batch plus local math — so it runs
    // even when the patch arrived past the budget (live: 146 ms over). The expired budget used
    // to crash the retry (AbortSignal.timeout of a negative "delay", "shape failed") and the
    // fix died with it; the clamp in runObjectShape keeps the signal construction safe instead.
    const remainingMs = timeoutMs - (Date.now() - started);
    const patched = mergeKitPatch(shape.kit, patch);
    const retry = await runObjectShape(
      {
        describeShape: async () => ({
          recipe: kitToRecipe(patched),
          kit: patched,
          source: shape.source,
          model: shape.model,
        }),
        // The retry is kit-driven by design: no second imagination round off the patched kit.
        describeParts: async () => ({ recipe: null, source: shape.source, model: shape.model }),
        // No spread: the client is a class, its methods live on the prototype.
        ...(perception.segmentImage
          ? { segmentImage: perception.segmentImage.bind(perception) }
          : {}),
      },
      photo,
      fullImageUrl,
      target,
      { ...opts, timeoutMs: remainingMs }
    );
    if (retry.mode !== 'recipe' || !retry.recipe || !retry.outline) return shape;
    const rescored = await scoreRecipe(
      photo,
      { box: target.box, outline: retry.outline },
      retry.recipe,
      retry.partMasks
    );
    if (rescored && rescored.score.score > scored.score.score) {
      console.info(
        `[vision] 3D critic kept: score ${scored.score.score} → ${rescored.score.score} (${Object.keys(patch).join(',')})`
      );
      return retry;
    }
    console.info(
      `[vision] 3D critic dropped: score ${scored.score.score} → ${rescored?.score.score ?? 'n/a'}`
    );
    return shape;
  } catch (err) {
    console.warn('[vision] 3D critic round failed:', err instanceof Error ? err.message : err);
    return shape;
  }
}

/**
 * One patch request: the side-by-side image + kit + scores → the kit fields to change, or null
 * (mock, match, or an unusable reply). Never throws: a failed round keeps the recipe.
 */
export async function requestPatch(
  client: Pick<PerceptionClient, 'criticizeShape'>,
  imageUrl: string,
  kit: ObjectKit,
  score: ModelScore,
  signal?: AbortSignal
): Promise<Partial<ObjectKit> | null> {
  try {
    const out = await client.criticizeShape(
      imageUrl,
      criticQuestion(kit, {
        score: score.score,
        iou: score.iou,
        edgeF1: score.edgeF1,
        deltaE: score.deltaE,
      }),
      signal
    );
    return out.patch;
  } catch (err) {
    console.warn('[vision] 3D critic failed:', err instanceof Error ? err.message : err);
    return null;
  }
}
