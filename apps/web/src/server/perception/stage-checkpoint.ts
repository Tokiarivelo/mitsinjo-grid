import 'server-only';

import { z } from 'zod';
import { KIT_ARCHETYPES } from '@/lib/object-kit';
import {
  FACADE_URL_MAX,
  ObjectRecipeSchema,
  RecipeMaterialSchema,
  SHAPE_STAGE_IDS,
} from '@/lib/object-shape';
import type { Elevation } from './facade-house';
import { STAGE_ROUNDS } from './shape-stages';

/**
 * Checkpoint of a background stage loop (PG-T18, Vercel limit): a serverless request lives at
 * most `SHAPE_FUNCTION_MS`, a Spark round up to ≈ 2 min, so a long loop is cut into slices. When a
 * slice runs out of time it sends this checkpoint (`shape_stages_checkpoint`); the browser posts it
 * back to `/api/vision/shape/stages` and a fresh request goes on from the same stage and round.
 * Everything the loop needs is inside (no server memory): the model so far, the stages left and
 * the measured drawings. Sent by the browser, so it is validated like any input. No energy value.
 */

const num = z.number().finite();
/** A box in object or image fractions: parts may poke a little out of the object box. */
const BoxSchema = z.object({ x: num, y: num, w: num, h: num });
const RingSchema = z.array(z.tuple([num, num])).max(4_000);
/** Drawings are fetched again on resume: only an inline image or an https link (like `facadeUrl`). */
const ImageUrlSchema = z
  .string()
  .max(FACADE_URL_MAX)
  .regex(/^(data:image\/(png|jpeg|webp);base64,|https:\/\/)/);

const ViewMeasureSchema = z.object({
  aspect: num.positive(),
  ring: RingSchema,
  parts: z
    .array(
      z.object({
        concept: z.string().max(80),
        box: BoxSchema,
        look: z
          .object({
            color: z.string().max(16).optional(),
            material: RecipeMaterialSchema.optional(),
          })
          .optional(),
      })
    )
    .max(64),
  box: BoxSchema,
});

const ElevationSchema = z.object({
  aspect: num.positive(),
  left: num,
  right: num,
  wallLeft: num,
  wallRight: num,
  top: num,
  eave: num,
  bottom: num,
  ridge: num.nullable(),
  windows: z.array(BoxSchema).max(64),
  doors: z.array(BoxSchema).max(32),
  chimneys: z.array(BoxSchema).max(8),
  plinth: BoxSchema.nullable(),
  steps: z.array(BoxSchema).max(16),
  panes: z.array(BoxSchema).max(256),
  beams: z.array(BoxSchema).max(64),
  roofRings: z.array(RingSchema).max(16).optional(),
});

/** What the loop is built from: an object's views (PG-T20) or a house elevation (PG-T16). */
export const StageLoopContextSchema = z.object({
  label: z.string().max(200),
  loop: z.discriminatedUnion('kind', [
    z.object({
      kind: z.literal('views'),
      archetype: z.enum(KIT_ARCHETYPES),
      front: ViewMeasureSchema,
      side: ViewMeasureSchema.nullable(),
      frontUrl: ImageUrlSchema,
      /** The side Muse Image drew (base64 PNG), null when none. */
      sidePng: z.string().max(FACADE_URL_MAX).nullable(),
    }),
    z.object({
      kind: z.literal('facade'),
      front: ElevationSchema,
      facadeUrl: ImageUrlSchema.optional(),
    }),
  ]),
});
export type StageLoopContext = z.infer<typeof StageLoopContextSchema>;

const StageIdsSchema = z.array(z.enum(SHAPE_STAGE_IDS)).min(1).max(SHAPE_STAGE_IDS.length);

export const StageCheckpointSchema = StageLoopContextSchema.extend({
  v: z.literal(1),
  /** Every stage of the loop, in order (progress positions). */
  all: StageIdsSchema,
  /** Stages left; the first resumes at `round`. */
  stages: StageIdsSchema,
  round: z.number().int().min(1).max(STAGE_ROUNDS),
  /** Slices in a row that ended without one finished round (a Spark call longer than a slice). */
  stalls: z.number().int().min(0).max(10).default(0),
  recipe: ObjectRecipeSchema,
});
export type StageCheckpoint = z.infer<typeof StageCheckpointSchema>;

/** Most characters of a checkpoint the browser can post back (Vercel bodies ≤ 4.5 MB). */
export const STAGE_CHECKPOINT_MAX = 4_000_000;
/** Slices in a row without progress before the loop stops (`timeout`): never an endless retry. */
export const STAGE_MAX_STALLS = 3;

/** The measured elevation as plain JSON for a checkpoint (its roof rings copied). */
export function elevationForCheckpoint(front: Elevation): z.infer<typeof ElevationSchema> {
  const { roofRings, ...rest } = front;
  return {
    ...rest,
    ...(roofRings
      ? { roofRings: roofRings.map((r) => r.map(([a, b]) => [a, b] as [number, number])) }
      : {}),
  };
}
