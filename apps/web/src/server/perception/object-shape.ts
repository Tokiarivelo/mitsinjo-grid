import 'server-only';

import {
  SHAPE_TIMEOUT_MS,
  fitRecipe,
  recipeIssue,
  type ObjectShape,
  type ShapeStep,
  type ShapeTarget,
} from '@/lib/object-shape';
import { kitToRecipe, type ObjectKit } from '@/lib/object-kit';
import { pathToRings } from '@/lib/vision';
import type { PerceptionClient } from './client';
import { measureKitColors, type ObjectPixels } from './color-measure';
import type { PhotoForRegions } from './region';
import { measurePerspective, type Perspective } from './perspective';
import { measureRepetition, type GrayGrid, type Repetition } from './repetition';
import { measureRoof, type RoofMeasure } from './roofline';
import { EDGE_COLUMNS, sampleObjectGray, sampleObjectPixels } from './shape-colors';
import { cropForShape } from './shape-crop';

export { SHAPE_TIMEOUT_MS };

/** Archetypes whose roof is read on the outline (PF-T3). A pitched `building` becomes a `house`. */
const ROOFED: ReadonlyArray<ObjectKit['archetype']> = ['house', 'building'];

/** Kit + roofline measured on the SAM outline, or the kit unchanged (no outline, flat top, not a house). */
export function withMeasuredRoof(
  kit: ObjectKit,
  target: Pick<ShapeTarget, 'box' | 'outline'>,
  aspect: number
): { kit: ObjectKit; measure: RoofMeasure | null } {
  if (!target.outline || !ROOFED.includes(kit.archetype)) return { kit, measure: null };
  const rings = pathToRings(target.outline).filter((r) => r.length >= 3);
  const measure = rings.length ? measureRoof(rings, target.box, aspect) : null;
  if (!measure) return { kit, measure };
  return { kit: { ...kit, archetype: 'house', roof: measure.roof }, measure };
}

/**
 * Kit + houses in the row and windows per house (PF-T4), houses only (a flat building's window columns
 * are not houses). Units: the measured gables when ≥ 2 (seen directly), else the edge period, else
 * Spark's count. Windows: measured per house × units (≤ 8), else Spark's.
 */
export function withMeasuredRepetition(
  kit: ObjectKit,
  grid: GrayGrid | null
): { kit: ObjectKit; repetition: Repetition | null } {
  if (kit.archetype !== 'house' || !grid) return { kit, repetition: null };
  const repetition = measureRepetition(grid, kit.roof?.eave ?? 0.4);
  const gables = kit.roof?.gables.length ?? 0;
  const units =
    gables >= 2 ? gables : repetition.units >= 2 ? repetition.units : kit.details?.units;
  const details = { ...kit.details };
  if (units) details.units = units;
  if (repetition.windowsPerUnit) {
    details.windows = Math.min(8, repetition.windowsPerUnit * (units ?? 1));
  }
  return { kit: { ...kit, details }, repetition };
}

/** Archetypes with straight facade lines (PF-T5): a tree's or a person's edges point nowhere. */
const STRAIGHT: ReadonlyArray<ObjectKit['archetype']> = [
  'house',
  'building',
  'cabinet',
  'machine',
  'vehicle',
  'screen',
];

/** Measured yaw of a straight-edged object, or null (round archetype, no grid, too few lines). */
export function measuredYaw(
  archetype: ObjectKit['archetype'],
  grid: GrayGrid | null,
  box: ShapeTarget['box'],
  photo: Pick<PhotoForRegions, 'width' | 'height'>
): Perspective | null {
  if (!grid || !STRAIGHT.includes(archetype)) return null;
  return measurePerspective(grid, box, photo.width, photo.height);
}

export interface ObjectShapeOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
  /** Live progress (SSE `shape_step`). */
  onStep?: (step: ShapeStep) => void;
}

/**
 * Selected object → its 3D shape (PV-T9), Meta models only. One Spark call on a crop around the object
 * returns a kit → parts recipe, fitted to the photo box (`fitRecipe`). Colours are measured on the photo
 * pixels inside the SAM outline while Spark thinks (PF-T2), and replace Spark's guessed colours; houses get the roofline
 * read on that outline (PF-T3) and the houses / windows counted by edge repetition (PF-T4); straight-edged objects are turned by the yaw read on
 * their vanishing points (PF-T5). Fallbacks → `silhouette` mode, built in
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
    const gray: Promise<GrayGrid | null> = photo
      ? sampleObjectGray(photo, target.box, target.outline).catch((err) => {
          console.warn('[vision] grey sample failed:', err instanceof Error ? err.message : err);
          return null;
        })
      : Promise.resolve(null);
    const edges: Promise<GrayGrid | null> = photo
      ? sampleObjectGray(photo, target.box, target.outline, EDGE_COLUMNS).catch(() => null)
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
        console.info(
          `[vision] 3D colours measured for "${target.label}" (${px!.y.length} px${target.outline ? ', outline' : ''}): ${colors.main} ${colors.secondary} ${colors.accent}`
        );
      }
      if (found.kit) {
        const { kit, measure } = withMeasuredRoof(
          colors ? { ...found.kit, colors } : found.kit,
          target,
          aspect
        );
        if (measure) {
          console.info(
            `[vision] 3D roof measured for "${target.label}": ${measure.roof.gables.length} gables, pitch ${measure.pitch}°, eave ${measure.roof.eave}`
          );
        }
        const rep = withMeasuredRepetition(kit, await gray);
        if (rep.repetition) {
          console.info(
            `[vision] 3D repetition for "${target.label}": units=${rep.kit.details?.units ?? 1} (R=${rep.repetition.strength}), windows=${rep.kit.details?.windows ?? '-'}`
          );
        }
        if (colors || measure || rep.repetition) built = kitToRecipe(rep.kit);
      }
      const persp =
        found.kit && photo
          ? measuredYaw(found.kit.archetype, await edges, target.box, photo)
          : null;
      if (persp) {
        console.info(
          `[vision] 3D perspective for "${target.label}": yaw=${Math.round((persp.yaw * 180) / Math.PI)}° (${persp.inliers}${persp.inliersSide ? ` + ${persp.inliersSide}` : ''} lines, f=${persp.focal}${persp.focalMeasured ? ' measured' : ''})`
        );
      }
      const recipe = fitRecipe(built, aspect, persp?.yaw ?? 0);
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
