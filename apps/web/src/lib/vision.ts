import { ApplianceCategorySchema } from '@mitsinjo/engine';
import { z } from 'zod';

/**
 * Appliance detection shapes shared by `/api/vision` (server) and the detection editor (client).
 * Labels and geometry only: never a power value (the engine catalog gives power).
 */

/** Box in image fractions (0–1), top-left origin. */
export const NormBoxSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  w: z.number().min(0).max(1),
  h: z.number().min(0).max(1),
});
export type NormBox = z.infer<typeof NormBoxSchema>;

/** Non-electrical things worth outlining (no load in the engine). Street lights are `lamp` appliances. */
export const SCENERY_TYPES = [
  'building',
  'vehicle',
  'tree',
  'plant',
  'person',
  'animal',
  'water',
  'other',
] as const;
export const SceneryTypeSchema = z.enum(SCENERY_TYPES);
export type SceneryType = z.infer<typeof SceneryTypeSchema>;

/**
 * One object seen on a photo (PV). `kind` absent = `appliance`. Scenery (houses, cars, trees…) is
 * outlined but has no load: its `category` is `other` and `scenery` says what it is.
 */
export const ApplianceDetectionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1).max(40),
  kind: z.enum(['appliance', 'scenery']).optional(),
  category: ApplianceCategorySchema,
  scenery: SceneryTypeSchema.optional(),
  confidence: z.number().min(0).max(1).optional(),
  box: NormBoxSchema,
  /** SVG path in image fractions (0–1), from SAM. Absent → draw the box. */
  outline: z.string().optional(),
  /** Shape drawn by the operator (PV-T8); label and category then come from the vision model. Set by the client. */
  manual: z.literal(true).optional(),
});
export type ApplianceDetection = z.infer<typeof ApplianceDetectionSchema>;

/** `vision_detections` SSE event data. */
export const VisionDetectionsEventSchema = z.object({
  phase: z.enum(['boxes', 'outlines']),
  detections: z.array(ApplianceDetectionSchema),
  refined: z.number().int().min(0).optional(),
  source: z.enum(['meta', 'mock']),
  model: z.string(),
  fallback: z.enum(['provider_error', 'spend_cap', 'not_configured']).optional(),
});
export type VisionDetectionsEvent = z.infer<typeof VisionDetectionsEventSchema>;

/** Most shapes the operator can send in one go (one vision call each). */
export const MAX_REGIONS = 10;

/** Point in image fractions (0–1), `[x, y]`. */
export const NormPointTupleSchema = z.tuple([z.number().min(0).max(1), z.number().min(0).max(1)]);

/**
 * Shape drawn by the operator around a missing object (PV-T8): rectangle, free hand or magnetic
 * lasso, all sent as a closed polygon. `hint` = what the operator typed (« fridge », « pompe »).
 */
export const VisionRegionSchema = z.object({
  id: z.string().min(1).max(40),
  points: z.array(NormPointTupleSchema).min(3).max(400),
  hint: z.string().max(40).optional(),
});
export type VisionRegion = z.infer<typeof VisionRegionSchema>;
export const VisionRegionsSchema = z.array(VisionRegionSchema).min(1).max(MAX_REGIONS);

/**
 * `vision_regions` SSE event: what the vision model saw inside each drawn shape. `boxes` = Muse
 * (label, category, tightened box), then `outlines` = SAM outline (Meta only). No `detection` = not
 * identified: the client keeps the shape with the operator's text.
 */
export const VisionRegionsEventSchema = z.object({
  phase: z.enum(['boxes', 'outlines']),
  results: z.array(
    z.object({ regionId: z.string(), detection: ApplianceDetectionSchema.optional() })
  ),
  source: z.enum(['meta', 'mock']),
  model: z.string(),
  fallback: z.enum(['provider_error', 'spend_cap', 'not_configured']).optional(),
});
export type VisionRegionsEvent = z.infer<typeof VisionRegionsEventSchema>;

/** Closed SVG path through polygon points (image fractions). */
export function polygonPath(points: ReadonlyArray<readonly [number, number]>): string {
  if (points.length === 0) return '';
  const r = (v: number) => Math.round(v * 10000) / 10000;
  return `M${points.map(([x, y]) => `${r(x)} ${r(y)}`).join('L')}Z`;
}

/** Bounding box of polygon points (image fractions). */
export function polygonBounds(points: ReadonlyArray<readonly [number, number]>): NormBox {
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

/** True when the object can carry an electrical load (an appliance). */
export function isAppliance(d: Pick<ApplianceDetection, 'kind'>): boolean {
  return d.kind !== 'scenery';
}

/** Rectangle path of a box, same coordinate space as SAM outlines. */
export function boxPath(b: NormBox): string {
  return `M${b.x} ${b.y}H${b.x + b.w}V${b.y + b.h}H${b.x}Z`;
}
