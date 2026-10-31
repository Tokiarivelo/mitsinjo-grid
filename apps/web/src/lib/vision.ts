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

/** True when the object can carry an electrical load (an appliance). */
export function isAppliance(d: Pick<ApplianceDetection, 'kind'>): boolean {
  return d.kind !== 'scenery';
}

/** Rectangle path of a box, same coordinate space as SAM outlines. */
export function boxPath(b: NormBox): string {
  return `M${b.x} ${b.y}H${b.x + b.w}V${b.y + b.h}H${b.x}Z`;
}
