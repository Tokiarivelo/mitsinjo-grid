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
 * `recipe` = Muse Spark describes the object as a few primitive parts, coloured with the colours measured on the photo.
 * `silhouette` = fallback when Spark fails or its recipe is poor: the SAM outline (or the box) extruded,
 * plain. The photo itself is never pasted on the model. Geometry and colors only: never a power value.
 */

/** `prism` = triangle extruded along z (gable roof, PF-T3), apex at `apex` of its width. */
export const RECIPE_SHAPES = [
  'box',
  'cylinder',
  'sphere',
  'cone',
  'prism',
  'extrude',
  'lathe',
] as const;
/** Polygon points of an `extrude` part (PR-2.1): closed ring, simplified before storing. */
export const EXTRUDE_POINTS_MAX = 64;
/** Profile points of a `lathe` part (PR-2.3): radius-vs-height, non-decreasing y. */
export const LATHE_PROFILE_MAX = 32;
export const MAX_RECIPE_PARTS = 12;
/** A part may stick out of the object box by this much (handles, feet) before the recipe counts as poor. */
export const RECIPE_BOUND = 0.6;
/**
 * Smallest total volume of all parts (share of the object box) for a fitted recipe to be usable.
 * Low on purpose: a lamp post or a pole is mostly empty space around a thin cylinder.
 */
export const MIN_FILL_VOLUME = 0.005;

/**
 * What a part is made of, named by Spark (the AI): the 3D view gives each its own surface (rough stone,
 * shiny glass, metal…). Absent = a neutral painted surface.
 */
export const RECIPE_MATERIALS = [
  'stone',
  'brick',
  'plaster',
  'concrete',
  'wood',
  'thatch',
  'tile',
  'slate',
  'metal',
  'glass',
  'plastic',
  'fabric',
  'rubber',
  'foliage',
  'water',
] as const;
export const RecipeMaterialSchema = z.enum(RECIPE_MATERIALS);
export type RecipeMaterial = z.infer<typeof RecipeMaterialSchema>;

/** Largest measured yaw (60°). */
export const MAX_YAW = Math.PI / 3;

const coord = z.number().min(-RECIPE_BOUND).max(RECIPE_BOUND);
const extent = z.number().min(0.01).max(1);

/**
 * One primitive. Object centred at the origin, x right, y up, z toward the camera.
 * `at` = part centre and `size` = part extent, both in fractions of the object's own width / height / depth.
 */
/** Closed ring in unit space (fractions of the part size, centred, y up), extruded along z. */
const unitPoint = z.tuple([z.number().min(-0.5).max(0.5), z.number().min(-0.5).max(0.5)]);
/** Lathe profile point: [radius 0–0.5, height −0.5–0.5], revolved around y. */
const unitProfilePoint = z.tuple([z.number().min(0).max(0.5), z.number().min(-0.5).max(0.5)]);

export const RecipePartSchema = z
  .object({
    shape: z.enum(RECIPE_SHAPES),
    at: z.tuple([coord, coord, coord]),
    size: z.tuple([extent, extent, extent]),
    /** Axis of a cylinder or cone (default `y`). */
    axis: z.enum(['x', 'y', 'z']).optional(),
    /** Prism only: x of the ridge, share of the part width from its left edge (default 0.5). */
    apex: z.number().min(0).max(1).optional(),
    /** Extrude only (PR-2.1): the profile ring, 3–64 points, built server-side (never from Spark). */
    points: z.array(unitPoint).min(3).max(EXTRUDE_POINTS_MAX).optional(),
    /** Lathe only (PR-2.3): radius-vs-height profile, 2–32 points, y never decreases. */
    profile: z.array(unitProfilePoint).min(2).max(LATHE_PROFILE_MAX).optional(),
    color: z.string().regex(/^#[0-9a-f]{6}$/i),
    /** What the part is made of (AI), sets its surface in the 3D view. */
    material: RecipeMaterialSchema.optional(),
    /** Main body of the object (walls, cabinet). */
    front: z.boolean().optional(),
  })
  .superRefine((p, ctx) => {
    if (p.shape === 'extrude' && !p.points)
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'extrude needs points' });
    if (p.shape !== 'extrude' && p.points)
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'points need extrude' });
    if (p.shape === 'lathe' && !p.profile)
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'lathe needs profile' });
    if (p.shape !== 'lathe' && p.profile)
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'profile needs lathe' });
    if (p.profile && !p.profile.every((pt, i) => i === 0 || pt[1] >= p.profile![i - 1]![1]))
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'profile y must not fall' });
  });
export type RecipePart = z.infer<typeof RecipePartSchema>;

export const ObjectRecipeSchema = z.object({
  /** Real proportions of the object, largest side = 1. */
  proportions: z.object({ w: extent, h: extent, d: extent }),
  parts: z.array(RecipePartSchema).min(1).max(MAX_RECIPE_PARTS),
  /** Measured turn of the front away from the camera (PF-T5), radians, + = right end farther. */
  yaw: z.number().min(-MAX_YAW).max(MAX_YAW).optional(),
  /** One tileable 64 px photo swatch per material (PR-1.5), base64 data URL (≤ 8 kB each). */
  swatches: z.record(RecipeMaterialSchema, z.string()).optional(),
});
export type ObjectRecipe = z.infer<typeof ObjectRecipeSchema>;

/** What the browser sends to `/api/vision/shape` about the selected object. */
/** Longest SAM outline sent with a shape request (characters). */
export const SHAPE_OUTLINE_MAX = 20_000;

export const ShapeTargetSchema = z.object({
  id: z.string().min(1).max(64),
  label: z.string().min(1).max(40),
  category: ApplianceCategorySchema,
  /** Scenery type (house, tree, car…): every object can be modelled, not only appliances. */
  scenery: SceneryTypeSchema.optional(),
  box: NormBoxSchema,
  /** SAM outline (photo fractions path): colours are measured inside it (PF-T2). Too long → not sent. */
  outline: z.string().max(SHAPE_OUTLINE_MAX).optional(),
});
export type ShapeTarget = z.infer<typeof ShapeTargetSchema>;

export const SHAPE_FALLBACK_REASONS = [
  'provider_error',
  'spend_cap',
  'malformed',
  'no_body',
  /** Spark took longer than the time limit (`SHAPE_TIMEOUT_MS`). */
  'timeout',
  /** The browser could not reach the app server (offline, server down, bad reply). */
  'network',
] as const;
export type ShapeFallbackReason = (typeof SHAPE_FALLBACK_REASONS)[number];

export const CANONICAL_ANGLES = ['front', 'back', 'left', 'right', 'top', 'three_quarter'] as const;
export type CanonicalAngle = (typeof CANONICAL_ANGLES)[number];

export const ImaginedAngleViewSchema = z.object({
  angle: z.enum(CANONICAL_ANGLES),
  labelKey: z.string(),
  angleDeg: z.number(),
  description: z.string(),
  imageUrl: z.string(),
  features: z.array(z.string()).default([]),
});
export type ImaginedAngleView = z.infer<typeof ImaginedAngleViewSchema>;

/** `/api/vision/views` reply: the 6 canonical 2D imagined angles for one detection. */
export const ImaginedViewsResponseSchema = z.object({
  ok: z.literal(true),
  views: z.array(ImaginedAngleViewSchema).length(CANONICAL_ANGLES.length),
  detectionId: z.string(),
});
export type ImaginedViewsResponse = z.infer<typeof ImaginedViewsResponseSchema>;

/** `/api/vision/shape` reply. `recipe` set only in `recipe` mode; `reason` only in `silhouette` mode. */
/**
 * One segmented part on the object crop (PR-2.5): SAM concept + box in crop fractions, outline
 * when the mask decoded. Wheels / windows / doors feed PR-2.6…2.8; empty when the archetype has
 * no concepts, the client cannot segment, or every call failed.
 */
export const PartMaskSchema = z.object({
  concept: z.string(),
  box: NormBoxSchema,
  outline: z.string().optional(),
});
export type PartMask = z.infer<typeof PartMaskSchema>;

export const ObjectShapeSchema = z.object({
  detectionId: z.string(),
  mode: z.enum(['recipe', 'silhouette']),
  partMasks: z.array(PartMaskSchema).optional(),
  recipe: ObjectRecipeSchema.optional(),
  reason: z.enum(SHAPE_FALLBACK_REASONS).optional(),
  source: z.enum(['meta', 'mock']),
  model: z.string(),
  fallback: z.enum(['provider_error', 'spend_cap', 'not_configured']).optional(),
  /** How well the model's silhouette matches the SAM outline after the fit (PF-T6), IoU 0–1. Computed, not AI. */
  fit: z.object({ iou: z.number().min(0).max(1) }).optional(),
  /** Short cause with `provider_error` (`http_429`…), shown in the panel and the logs. */
  detail: z.string().max(40).optional(),
  /** 2D imagined views across the 6 canonical angles before or alongside full 3D generation. */
  imaginedViews: z.array(ImaginedAngleViewSchema).optional(),
});
export type ObjectShape = z.infer<typeof ObjectShapeSchema>;

/**
 * Server steps of `/api/vision/shape` (SSE `shape_step`), shown live in the « 3D model » block:
 * `crop` = cut and enlarge the object · `model` = Muse Spark imagines the parts · `fit` = check and fit
 * them to the photo box. The browser adds its own `build` step (geometry) once the answer is in.
 */
/**
 * Spark budget for one recipe; past it the silhouette is used (reason `timeout`). Measured: Muse needs
 * ≈ 15 s (base) to ≈ 25 s (contributor) on a photo, more for a 12-part recipe; the old 20 s cut most answers.
 */
export const SHAPE_TIMEOUT_MS = 60_000;

export const SHAPE_STEPS = ['crop', 'model', 'fit'] as const;
export type ShapeStep = (typeof SHAPE_STEPS)[number];
export const ShapeStepEventSchema = z.object({ step: z.enum(SHAPE_STEPS) });

const volume = (p: RecipePart) => p.size[0] * p.size[1] * p.size[2];
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Repairs a Spark recipe instead of rejecting it (thin objects like lamp posts came back « poor »):
 * - parts are stretched and re-centred so together they fill the object box on each axis
 *   (fixes parts drawn too small, off-centre or sticking out);
 * - width / height come from the photo box (`boxAspect` = its width / height in pixels, 0 = keep the
 *   model's), depth keeps the model's ratio to height. Largest side stays 1.
 * - `yaw` (PF-T5): the box shows the front foreshortened plus the side, `w·cos + d·sin = aspect·h`, so the
 *   true front width is solved from it (≥ 30 % of the box width; the depth shrinks when it cannot fit).
 */
export function fitRecipe(recipe: ObjectRecipe, boxAspect: number, yaw = 0): ObjectRecipe {
  const lo = [Infinity, Infinity, Infinity];
  const hi = [-Infinity, -Infinity, -Infinity];
  for (const p of recipe.parts) {
    for (let i = 0; i < 3; i++) {
      lo[i] = Math.min(lo[i]!, p.at[i]! - p.size[i]! / 2);
      hi[i] = Math.max(hi[i]!, p.at[i]! + p.size[i]! / 2);
    }
  }
  const span = lo.map((l, i) => Math.max(0.01, hi[i]! - l));
  const mid = lo.map((l, i) => (l + hi[i]!) / 2);
  const parts = recipe.parts.map((p) => ({
    ...p,
    at: p.at.map((c, i) =>
      clamp((c - mid[i]!) / span[i]!, -RECIPE_BOUND, RECIPE_BOUND)
    ) as RecipePart['at'],
    size: p.size.map((v, i) => clamp(v / span[i]!, 0.01, 1)) as RecipePart['size'],
  }));
  const { h } = recipe.proportions;
  let { d } = recipe.proportions;
  const turn = clamp(Number.isFinite(yaw) ? yaw : 0, -MAX_YAW, MAX_YAW);
  const known = boxAspect > 0 && Number.isFinite(boxAspect);
  let w = known ? h * boxAspect : recipe.proportions.w;
  if (known && turn !== 0) {
    const cos = Math.cos(turn);
    const sin = Math.abs(Math.sin(turn));
    const seen = h * boxAspect;
    w = Math.max(0.3 * seen, (seen - d * sin) / cos);
    d = Math.max(0.01, Math.min(d, (seen - w * cos) / sin));
  }
  const max = Math.max(w, h, d);
  return {
    proportions: {
      w: clamp(w / max, 0.01, 1),
      h: clamp(h / max, 0.01, 1),
      d: clamp(d / max, 0.01, 1),
    },
    parts,
    ...(turn !== 0 ? { yaw: turn } : {}),
    ...(recipe.swatches ? { swatches: recipe.swatches } : {}),
  };
}

/** Why a (fitted) recipe would look wrong, or null when it is usable: parts with almost no volume. */
export function recipeIssue(recipe: ObjectRecipe): 'no_body' | null {
  const fill = recipe.parts.reduce((s, p) => s + volume(p), 0);
  return fill < MIN_FILL_VOLUME ? 'no_body' : null;
}

/** Main body part: the one marked `front`, else the biggest. */
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
