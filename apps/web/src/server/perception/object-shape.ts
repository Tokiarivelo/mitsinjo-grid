import 'server-only';

import {
  SHAPE_TIMEOUT_MS,
  fitRecipe,
  recipeIssue,
  type ObjectShape,
  type ShapeStep,
  type ShapeTarget,
} from '@/lib/object-shape';
import { kitToRecipe } from '@/lib/object-kit';
import type { PerceptionClient } from './client';
import { measureKitColors, type ObjectPixels } from './color-measure';
import type { PhotoForRegions } from './region';
import { sampleObjectPixels } from './shape-colors';
import { cropForShape } from './shape-crop';

export { SHAPE_TIMEOUT_MS };

export interface ObjectShapeOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
  /** Live progress (SSE `shape_step`). */
  onStep?: (step: ShapeStep) => void;
}

/**
 * Selected object → its 3D shape (PV-T9), Meta models only. One Spark call on a crop around the object
 * returns a kit → parts recipe, fitted to the photo box (`fitRecipe`). Colours are measured on the photo
 * pixels inside the SAM outline while Spark thinks (PF-T2), and replace Spark's guessed colours. Fallbacks → `silhouette` mode, built in
 * the browser from the SAM outline (no extra call), with a precise `reason`: `timeout` (past
 * `SHAPE_TIMEOUT_MS`), `provider_error` + `detail` (`http_429`…), `spend_cap`, `malformed`, `no_body`.
 * Mock mode: fixed recipe per category, not checked. Never throws.
 */
export async function runObjectShape(
  perception: Pick<PerceptionClient, 'describeShape'>,
  photo: PhotoForRegions | null,
  fullImageUrl: string,
  target: ShapeTarget,
  { signal, timeoutMs = SHAPE_TIMEOUT_MS, onStep }: ObjectShapeOptions = {}
): Promise<ObjectShape> {
  const base = { detectionId: target.id };
  const silhouette = (
    reason: NonNullable<ObjectShape['reason']>,
    source: Pick<ObjectShape, 'source' | 'model' | 'fallback' | 'detail'>
  ): ObjectShape => ({ ...base, mode: 'silhouette', reason, ...source });

  try {
    onStep?.('crop');
    const { w, h } = target.box;
    const aspect = photo && h > 0 ? (w * photo.width) / (h * photo.height) : 0;
    let imageUrl = fullImageUrl;
    if (photo) {
      try {
        imageUrl = await cropForShape(photo, target.box);
      } catch (err) {
        console.warn('[vision] shape crop failed, sending the whole photo:', err);
      }
    }
    // Pixels sampled in parallel with Spark (sharp, a few ms); a failure only keeps Spark's colours.
    const pixels: Promise<ObjectPixels | null> = photo
      ? sampleObjectPixels(photo, target.box, target.outline).catch((err) => {
          console.warn('[vision] colour sample failed:', err instanceof Error ? err.message : err);
          return null;
        })
      : Promise.resolve(null);
    onStep?.('model');
    const started = Date.now();
    const timeout = AbortSignal.timeout(timeoutMs);
    const found = await perception.describeShape(
      imageUrl,
      {
        label: target.label,
        category: target.category,
        ...(target.scenery ? { scenery: target.scenery } : {}),
        ...(aspect > 0 ? { aspect } : {}),
      },
      signal ? AbortSignal.any([signal, timeout]) : timeout
    );
    const seconds = ((Date.now() - started) / 1000).toFixed(1);
    const source = {
      source: found.source,
      model: found.model,
      ...(found.fallback ? { fallback: found.fallback } : {}),
      ...(found.failure ? { detail: found.failure } : {}),
    };
    if (found.fallback === 'provider_error' || found.fallback === 'spend_cap') {
      const reason = found.failure === 'timeout' ? 'timeout' : found.fallback;
      console.info(
        `[vision] 3D recipe for "${target.label}": ${reason}${found.failure ? ` (${found.failure})` : ''} after ${seconds} s, silhouette`
      );
      return silhouette(reason, source);
    }
    onStep?.('fit');
    if (!found.recipe) return silhouette('malformed', source);
    if (found.source === 'meta') {
      let built = found.recipe;
      const px = found.kit ? await pixels : null;
      const colors = found.kit && px ? measureKitColors(px, found.kit.archetype) : null;
      if (found.kit && colors) {
        built = kitToRecipe({ ...found.kit, colors });
        console.info(
          `[vision] 3D colours measured for "${target.label}" (${px!.y.length} px${target.outline ? ', outline' : ''}): ${colors.main} ${colors.secondary} ${colors.accent}`
        );
      }
      const recipe = fitRecipe(built, aspect);
      const issue = recipeIssue(recipe);
      if (issue) {
        console.info(`[vision] 3D recipe for "${target.label}" rejected (${issue}), silhouette`);
        return silhouette(issue, source);
      }
      console.info(
        `[vision] 3D recipe for "${target.label}": ${recipe.parts.length} parts in ${seconds} s (${found.model})`
      );
      return { ...base, mode: 'recipe', recipe, ...source };
    }
    return { ...base, mode: 'recipe', recipe: found.recipe, ...source };
  } catch (err) {
    console.warn('[vision] shape failed:', err instanceof Error ? err.message : err);
    return silhouette('provider_error', { source: 'mock', model: 'none' });
  }
}
