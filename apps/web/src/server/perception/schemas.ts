import { ApplianceCategorySchema } from '@mitsinjo/engine';
import { z } from 'zod';

/**
 * Perception results: what a model heard or saw. These are observations, never energy values:
 * any number here (cloud cover, a meter reading, a box) must go through an `InputPatch`
 * proposal before the engine turns it into kW, kWh or %.
 */

/** Who produced the result. `fallback` is set when the mock answered instead of Meta. */
export const PerceptionSourceSchema = z.object({
  source: z.enum(['meta', 'mock']),
  model: z.string(),
  fallback: z.enum(['provider_error', 'spend_cap', 'not_configured']).optional(),
});
export type PerceptionSource = z.infer<typeof PerceptionSourceSchema>;

export const TranscriptTurnSchema = z.object({
  startMs: z.number().int().min(0),
  endMs: z.number().int().min(0),
  text: z.string(),
  /** Speaker label (`A`, `B`…), only in diarization mode. */
  speaker: z.string().optional(),
});

export const TranscriptSchema = PerceptionSourceSchema.extend({
  text: z.string(),
  durationMs: z.number().int().min(0),
  turns: z.array(TranscriptTurnSchema),
});
export type Transcript = z.infer<typeof TranscriptSchema>;

export const TranscribeOptionsSchema = z.object({
  /** Language names for the model (`French`, `English`, `Malagasy`). Omit = auto-detect. */
  languages: z.array(z.string().min(1)).max(4).optional(),
  /** Split speakers (meeting recordings). */
  diarize: z.boolean().optional(),
  /** Words to bias recognition toward (sector names, `lifeline`…). */
  keywords: z.array(z.string().min(1)).max(50).optional(),
  /** File name hint; the mock uses it to pick a deterministic phrase. */
  fileName: z.string().max(200).optional(),
});
export type TranscribeOptions = z.infer<typeof TranscribeOptionsSchema>;

export const ObservationSchema = z.object({
  /** Stable id of what was observed, e.g. `cloud_cover`, `meter_reading`, `smoke`. */
  label: z.string().min(1),
  value: z.union([z.number(), z.string(), z.boolean()]),
  unit: z.string().optional(),
  /** Model's own confidence, 0–1. Shown to the user, never trusted blindly. */
  confidence: z.number().min(0).max(1),
});
export type Observation = z.infer<typeof ObservationSchema>;

export const VisionResultSchema = PerceptionSourceSchema.extend({
  summary: z.string(),
  observations: z.array(ObservationSchema),
});
export type VisionResult = z.infer<typeof VisionResultSchema>;

export const BoxSchema = z.object({
  x1: z.number(),
  y1: z.number(),
  x2: z.number(),
  y2: z.number(),
});
export type Box = z.infer<typeof BoxSchema>;

export const SegmentInstanceSchema = z.object({
  box: BoxSchema,
  confidence: z.number().min(0).max(1).optional(),
  /** Mask outline: SVG path in image fractions (0–1), simplified. Absent when the mask is missing or unreadable. */
  outline: z.string().optional(),
});
export type SegmentInstance = z.infer<typeof SegmentInstanceSchema>;

export const SegmentResultSchema = PerceptionSourceSchema.extend({
  concept: z.string(),
  imageWidth: z.number().int().min(0),
  imageHeight: z.number().int().min(0),
  instances: z.array(SegmentInstanceSchema),
  count: z.number().int().min(0),
  /** Share of the image covered by the union of the boxes, 0–1 (boxes, not masks: an upper bound). */
  boxCoverage: z.number().min(0).max(1),
});
export type SegmentResult = z.infer<typeof SegmentResultSchema>;

/** Box in image fractions (0–1), top-left origin. */
export const NormBoxSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  w: z.number().min(0).max(1),
  h: z.number().min(0).max(1),
});
export type NormBox = z.infer<typeof NormBoxSchema>;

/** One appliance seen on a photo (PV). Labels and geometry only: never a power value. */
export const ApplianceDetectionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1).max(40),
  category: ApplianceCategorySchema,
  confidence: z.number().min(0).max(1).optional(),
  box: NormBoxSchema,
  /** SVG path in image fractions (0–1), from SAM (PV-T5). Absent → draw the box. */
  outline: z.string().optional(),
});
export type ApplianceDetection = z.infer<typeof ApplianceDetectionSchema>;

export const DetectionResultSchema = PerceptionSourceSchema.extend({
  detections: z.array(ApplianceDetectionSchema),
});
export type DetectionResult = z.infer<typeof DetectionResultSchema>;
