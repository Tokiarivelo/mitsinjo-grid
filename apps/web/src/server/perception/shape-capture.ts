import 'server-only';

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { ObjectKitSchema } from '@/lib/object-kit';
import { ObjectRecipeSchema, ShapeTargetSchema, type ObjectRecipe } from '@/lib/object-shape';
import { pathToRings } from './mask-outline';
import type { PhotoForRegions } from './region';
import type { NormBox } from './schemas';
import { scoreRecipe, type RecipeScore } from './score-shape';
import type { CropRect } from './shape-crop';
import { photoSize } from './vision-request';

/** One live 3D run, frozen for offline replay (PR-0.4): no API cost per loop iteration. */
export const ShapeCaptureSchema = z.object({
  version: z.literal(1),
  /** Fixture id (`make shape-capture … ID=car1`), also the file name. */
  id: z.string().min(1).max(64),
  capturedAt: z.string(),
  source: z.literal('meta'),
  model: z.string(),
  /** Prepared photo the target box and outline are fractions of. */
  photo: z.object({ width: z.number().int().min(1), height: z.number().int().min(1) }),
  target: ShapeTargetSchema,
  /** Spark's kit answer (what the loop patches and replays). */
  kit: ObjectKitSchema,
  recipe: ObjectRecipeSchema.optional(),
  fit: z.object({ iou: z.number().min(0).max(1) }).optional(),
  /** Spark latency, seconds. */
  seconds: z.number(),
  /** Square crop sent to Spark (photo pixels) and its sent size. */
  crop: z.object({
    left: z.number().int().min(0),
    top: z.number().int().min(0),
    width: z.number().int().min(1),
    height: z.number().int().min(1),
    outWidth: z.number().int().min(1),
    outHeight: z.number().int().min(1),
  }),
  /** Target remapped into crop fractions (what `scoreRecipe` replays on the crop JPEG). */
  cropTarget: z.object({ box: ShapeTargetSchema.shape.box, outline: z.string().optional() }),
  /** Per-concept part masks (PR-2.5 fills this; absent until then). */
  partMasks: z.array(z.unknown()).optional(),
});
export type ShapeCapture = z.infer<typeof ShapeCaptureSchema>;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Photo-fraction box → crop-fraction box (resolution independent). */
export function remapBoxToCrop(
  box: NormBox,
  photoW: number,
  photoH: number,
  rect: CropRect
): NormBox {
  return {
    x: clamp01((box.x * photoW - rect.left) / rect.width),
    y: clamp01((box.y * photoH - rect.top) / rect.height),
    w: clamp01((box.w * photoW) / rect.width),
    h: clamp01((box.h * photoH) / rect.height),
  };
}

/** Photo-fraction outline path → crop-fraction path (same rings, re-encoded). */
export function remapOutlineToCrop(
  outline: string,
  photoW: number,
  photoH: number,
  rect: CropRect
): string {
  const f = (n: number) => (Math.round(n * 10000) / 10000).toString();
  return pathToRings(outline)
    .filter((r) => r.length >= 3)
    .map(
      (r) =>
        'M' +
        r
          .map(
            ([x, y]) =>
              `${f((x * photoW - rect.left) / rect.width)} ${f((y * photoH - rect.top) / rect.height)}`
          )
          .join('L') +
        'Z'
    )
    .join('');
}

/** `<dir>/<id>.capture.json` + `<dir>/<id>.crop.jpg` (the exact bytes Spark saw). */
export function writeCapture(
  dir: string,
  capture: ShapeCapture,
  cropJpeg: Buffer
): [json: string, jpg: string] {
  mkdirSync(dir, { recursive: true });
  const json = join(dir, `${capture.id}.capture.json`);
  const jpg = join(dir, `${capture.id}.crop.jpg`);
  writeFileSync(json, JSON.stringify(ShapeCaptureSchema.parse(capture), null, 2));
  writeFileSync(jpg, cropJpeg);
  return [json, jpg];
}

/** Read a capture back: validated JSON + the crop as photo pixels. */
export async function readCapture(
  dir: string,
  id: string
): Promise<{ capture: ShapeCapture; cropPhoto: PhotoForRegions }> {
  const capture = ShapeCaptureSchema.parse(
    JSON.parse(readFileSync(join(dir, `${id}.capture.json`), 'utf8'))
  );
  const cropPhoto = await photoSize(readFileSync(join(dir, `${id}.crop.jpg`)));
  if (!cropPhoto) throw new Error(`capture ${id}: crop JPEG not readable`);
  return { capture, cropPhoto };
}

/**
 * Offline replay proof (no API): re-score the captured recipe on the captured crop with the
 * remapped target. Null without a recipe or an outline, like the live score.
 */
export async function rescoreCapture(dir: string, id: string): Promise<RecipeScore | null> {
  const { capture, cropPhoto } = await readCapture(dir, id);
  const recipe: ObjectRecipe | undefined = capture.recipe;
  if (!recipe) return null;
  // No masks: captured boxes are fractions of the saved crop, but scoreRecipe would remap them
  // through a crop-of-the-crop. Replay stays 3-term until the mapping is capture-aware.
  return scoreRecipe(cropPhoto, capture.cropTarget, recipe);
}
