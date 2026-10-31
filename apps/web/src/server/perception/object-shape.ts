import 'server-only';

import { recipeIssue, type ObjectShape, type ShapeTarget } from '@/lib/object-shape';
import type { PerceptionClient } from './client';
import { cropRegion, type PhotoForRegions } from './region';

/** Spark budget for one recipe; past it the silhouette is used (the operator is waiting on the editor). */
export const SHAPE_TIMEOUT_MS = 20_000;

/**
 * Selected object → its 3D shape (PV-T9), Meta models only. One Spark call on a crop around the object
 * returns a parts recipe; Meta failure, spend cap, timeout, unreadable or poor recipe (`recipeIssue`) →
 * `silhouette` mode, built in the browser from the SAM outline it already has (no extra call).
 * Mock mode: fixed recipe per category, not checked. Never throws.
 */
export async function runObjectShape(
  perception: Pick<PerceptionClient, 'describeShape'>,
  photo: PhotoForRegions | null,
  fullImageUrl: string,
  target: ShapeTarget,
  signal?: AbortSignal,
  timeoutMs = SHAPE_TIMEOUT_MS
): Promise<ObjectShape> {
  const base = { detectionId: target.id };
  const silhouette = (
    reason: NonNullable<ObjectShape['reason']>,
    source: Pick<ObjectShape, 'source' | 'model' | 'fallback'>
  ): ObjectShape => ({ ...base, mode: 'silhouette', reason, ...source });

  try {
    const { x, y, w, h } = target.box;
    let imageUrl = fullImageUrl;
    if (photo) {
      try {
        const points: Array<[number, number]> = [
          [x, y],
          [x + w, y],
          [x + w, y + h],
          [x, y + h],
        ];
        imageUrl = (await cropRegion(photo, { id: target.id, points })).dataUrl;
      } catch (err) {
        console.warn('[vision] shape crop failed, sending the whole photo:', err);
      }
    }
    const timeout = AbortSignal.timeout(timeoutMs);
    const found = await perception.describeShape(
      imageUrl,
      { label: target.label, category: target.category },
      signal ? AbortSignal.any([signal, timeout]) : timeout
    );
    const source = {
      source: found.source,
      model: found.model,
      ...(found.fallback ? { fallback: found.fallback } : {}),
    };
    if (found.fallback === 'provider_error' || found.fallback === 'spend_cap') {
      return silhouette(found.fallback, source);
    }
    if (!found.recipe) return silhouette('malformed', source);
    if (found.source === 'meta') {
      const aspect = photo && h > 0 ? (w * photo.width) / (h * photo.height) : 0;
      const issue = recipeIssue(found.recipe, aspect);
      if (issue) {
        console.info(`[vision] 3D recipe for "${target.label}" rejected (${issue}), silhouette`);
        return silhouette(issue, source);
      }
    }
    return { ...base, mode: 'recipe', recipe: found.recipe, ...source };
  } catch (err) {
    console.warn('[vision] shape failed:', err instanceof Error ? err.message : err);
    return silhouette('provider_error', { source: 'mock', model: 'none' });
  }
}
