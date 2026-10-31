import 'server-only';

import { type NextRequest } from 'next/server';
import sharp from 'sharp';
import { z } from 'zod';
import { VisionRegionsSchema, type VisionRegion } from '@/lib/vision';
import { getPerceptionClient } from '@/server/perception';
import { runVisionPipeline } from '@/server/perception/vision-pipeline';
import { runRegionPipeline, type PhotoForRegions } from '@/server/perception/region';
import { prepareVisionImage } from '@/server/perception/prepare-image';
import { hostVisionImage } from '@/server/storage/media';

/** The browser sends the photo as picked (the server rotates and resizes it); 12 MB fits a phone photo. */
export const MAX_VISION_BYTES = 12_000_000;
const IMAGE_TYPES = /^image\/(jpeg|png|webp)$/;

const FieldsSchema = z.object({ sessionId: z.string().max(64).optional() });

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/** Pixel size for cropping drawn shapes; null when the bytes cannot be decoded (whole photo sent). */
async function photoSize(buffer: Buffer): Promise<PhotoForRegions | null> {
  try {
    const { width, height } = await sharp(buffer, { failOn: 'none' }).metadata();
    return width && height ? { buffer, width, height } : null;
  } catch {
    return null;
  }
}

/**
 * Appliance detection on a photo (PV). Multipart: `image` (JPEG/PNG/WebP ≤ MAX_VISION_BYTES), `sessionId`,
 * `regions?` (JSON `VisionRegion[]`, PV-T8: identify only the drawn shapes).
 * → `text/event-stream`: `vision_detections` (boxes, then outlines on Meta) or, with regions,
 * `vision_regions` (same two phases) · `vision_error` · `done`.
 * Meta + R2: the photo is kept under `vision/` and sent by link. Mock: not stored, sample-room fixture.
 */
export async function POST(req: NextRequest) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return json({ error: 'Expected multipart form data' }, 400);
  }
  const image = form.get('image');
  if (!(image instanceof Blob) || image.size === 0) return json({ error: 'Missing image' }, 400);
  if (image.size > MAX_VISION_BYTES) return json({ error: 'Image too large (max 12 MB)' }, 413);
  if (!IMAGE_TYPES.test(image.type)) return json({ error: 'Image must be JPEG, PNG or WebP' }, 415);
  const fields = FieldsSchema.safeParse({ sessionId: form.get('sessionId') ?? undefined });
  if (!fields.success) return json({ error: 'Invalid fields' }, 400);
  // Optional (PV-T8): shapes drawn by the operator → identify only those, not the whole photo.
  let regions: VisionRegion[] | null = null;
  const rawRegions = form.get('regions');
  if (typeof rawRegions === 'string') {
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawRegions);
    } catch {
      return json({ error: 'Invalid regions' }, 400);
    }
    const ok = VisionRegionsSchema.safeParse(parsed);
    if (!ok.success) return json({ error: 'Invalid regions' }, 400);
    regions = ok.data;
  }

  const perception = getPerceptionClient(fields.data.sessionId);
  // Upright, ≤ 1280 px JPEG: the picture Muse and SAM see matches the one the page shows, in every browser.
  const photo = await prepareVisionImage(Buffer.from(await image.arrayBuffer()), image.type);
  // Meta: one R2 upload, then a short link for Muse and every SAM call (base64 when R2 is off).
  const visionImage = perception.callsMeta
    ? await hostVisionImage(photo.buffer, photo.contentType)
    : { url: `data:${photo.contentType};base64,${photo.buffer.toString('base64')}` };
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: Record<string, unknown>) =>
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      if (regions) {
        await runRegionPipeline(
          perception,
          await photoSize(photo.buffer),
          visionImage.url,
          regions,
          send,
          req.signal
        );
      } else {
        await runVisionPipeline(perception, visionImage, send, req.signal);
      }
      send('done', {});
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
