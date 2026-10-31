import { ApplianceCategorySchema } from '@mitsinjo/engine';
import { z } from 'zod';
import {
  boxPath,
  NormBoxSchema,
  pathToRings,
  SceneryTypeSchema,
  type ApplianceDetection,
} from './vision';

/**
 * 3D shape of one detected object (PV-T9), Meta models only. Shared by `/api/vision/shape` and the 3D editor.
 * `recipe` = Muse Spark describes the object as a few primitive parts (front face textured with the photo).
 * `silhouette` = fallback when Spark fails or its recipe is poor: the SAM outline (or the box) extruded,
 * with the photo on the front. Geometry and colors only: never a power value.
 */

export const RECIPE_SHAPES = ['box', 'cylinder', 'sphere', 'cone'] as const;
export const MAX_RECIPE_PARTS = 12;
/** A part may stick out of the object box by this much (handles, feet) before the recipe counts as poor. */
export const RECIPE_BOUND = 0.6;
/** Smallest body part (volume, share of the object box) for a recipe to be usable. */
export const MIN_BODY_VOLUME = 0.08;
/** Width / height ratio of the recipe vs the photo box may differ by this factor at most. */
export const MAX_ASPECT_GAP = 2.5;

const coord = z.number().min(-RECIPE_BOUND).max(RECIPE_BOUND);
const extent = z.number().min(0.01).max(1);

/**
 * One primitive. Object centred at the origin, x right, y up, z toward the camera.
 * `at` = part centre and `size` = part extent, both in fractions of the object's own width / height / depth.
 */
export const RecipePartSchema = z.object({
  shape: z.enum(RECIPE_SHAPES),
  at: z.tuple([coord, coord, coord]),
  size: z.tuple([extent, extent, extent]),
  /** Axis of a cylinder or cone (default `y`). */
  axis: z.enum(['x', 'y', 'z']).optional(),
  color: z.string().regex(/^#[0-9a-f]{6}$/i),
  /** This part's front face shows the photo of the object (usually the main body). */
  front: z.boolean().optional(),
});
export type RecipePart = z.infer<typeof RecipePartSchema>;

export const ObjectRecipeSchema = z.object({
  /** Real proportions of the object, largest side = 1. */
  proportions: z.object({ w: extent, h: extent, d: extent }),
  parts: z.array(RecipePartSchema).min(1).max(MAX_RECIPE_PARTS),
});
export type ObjectRecipe = z.infer<typeof ObjectRecipeSchema>;

/** What the browser sends to `/api/vision/shape` about the selected object. */
export const ShapeTargetSchema = z.object({
  id: z.string().min(1).max(64),
  label: z.string().min(1).max(40),
  category: ApplianceCategorySchema,
  /** Scenery type (house, tree, car…): every object can be modelled, not only appliances. */
  scenery: SceneryTypeSchema.optional(),
  box: NormBoxSchema,
});
export type ShapeTarget = z.infer<typeof ShapeTargetSchema>;

export const SHAPE_FALLBACK_REASONS = [
  'provider_error',
  'spend_cap',
  'malformed',
  'no_body',
  'out_of_bounds',
  'proportions',
] as const;
export type ShapeFallbackReason = (typeof SHAPE_FALLBACK_REASONS)[number];

/** `/api/vision/shape` reply. `recipe` set only in `recipe` mode; `reason` only in `silhouette` mode. */
export const ObjectShapeSchema = z.object({
  detectionId: z.string(),
  mode: z.enum(['recipe', 'silhouette']),
  recipe: ObjectRecipeSchema.optional(),
  reason: z.enum(SHAPE_FALLBACK_REASONS).optional(),
  source: z.enum(['meta', 'mock']),
  model: z.string(),
  fallback: z.enum(['provider_error', 'spend_cap', 'not_configured']).optional(),
});
export type ObjectShape = z.infer<typeof ObjectShapeSchema>;

const volume = (p: RecipePart) => p.size[0] * p.size[1] * p.size[2];

/**
 * Why a recipe would look wrong, or null when it is usable: no part big enough to be the body,
 * a part far outside the object box, or proportions that contradict the photo.
 * `boxAspect` = width / height of the object on the photo, in pixels (0 or less = not checked).
 */
export function recipeIssue(
  recipe: ObjectRecipe,
  boxAspect: number
): Exclude<ShapeFallbackReason, 'provider_error' | 'spend_cap' | 'malformed'> | null {
  if (!recipe.parts.some((p) => volume(p) >= MIN_BODY_VOLUME)) return 'no_body';
  const outside = recipe.parts.some((p) =>
    p.at.some((c, i) => Math.abs(c) + p.size[i]! / 2 > 0.5 + RECIPE_BOUND / 2)
  );
  if (outside) return 'out_of_bounds';
  if (boxAspect > 0) {
    const gap = recipe.proportions.w / recipe.proportions.h / boxAspect;
    if (gap > MAX_ASPECT_GAP || gap < 1 / MAX_ASPECT_GAP) return 'proportions';
  }
  return null;
}

/** Part that carries the photo: the one marked `front`, else the biggest. */
export function frontPartIndex(recipe: ObjectRecipe): number {
  const marked = recipe.parts.findIndex((p) => p.front);
  if (marked >= 0) return marked;
  let best = 0;
  recipe.parts.forEach((p, i) => {
    if (volume(p) > volume(recipe.parts[best]!)) best = i;
  });
  return best;
}

/**
 * Silhouette fallback: the object's outline (SAM, else its box) as rings in box fractions
 * (0–1 of the detection box, y down), largest ring first. Ready for a THREE.Shape extrusion.
 */
export function silhouetteRings(
  d: Pick<ApplianceDetection, 'box' | 'outline'>
): Array<Array<readonly [number, number]>> {
  const { x, y, w, h } = d.box;
  if (w <= 0 || h <= 0) return [];
  const rings = pathToRings(d.outline || boxPath(d.box)).map((r) =>
    r.map(([px, py]) => [(px - x) / w, (py - y) / h] as const)
  );
  const area = (r: ReadonlyArray<readonly [number, number]>) =>
    Math.abs(
      r.reduce(
        (s, p, i) => s + p[0] * r[(i + 1) % r.length]![1] - r[(i + 1) % r.length]![0] * p[1],
        0
      )
    ) / 2;
  return rings.sort((a, b) => area(b) - area(a));
}
