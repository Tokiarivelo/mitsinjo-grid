import 'server-only';

import { type NextRequest } from 'next/server';
import { z } from 'zod';
import { getPerceptionClient } from '@/server/perception';
import { runVisionPipeline } from '@/server/perception/vision-pipeline';

/** The client resizes to ≤ 1280 px before upload; 4 MB leaves room for an unresized phone photo. */
export const MAX_VISION_BYTES = 4_000_000;
const IMAGE_TYPES = /^image\/(jpeg|png|webp)$/;

const FieldsSchema = z.object({ sessionId: z.string().max(64).optional() });

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/**
 * Appliance detection on a photo (PV). Multipart: `image` (JPEG/PNG/WebP ≤ MAX_VISION_BYTES), `sessionId`.
 * → `text/event-stream`: `vision_detections` (boxes, then outlines on Meta) · `vision_error` · `done`.
 * The image is not stored. Meta when configured, the sample-room fixture otherwise.
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
  if (image.size > MAX_VISION_BYTES) return json({ error: 'Image too large (max 4 MB)' }, 413);
  if (!IMAGE_TYPES.test(image.type)) return json({ error: 'Image must be JPEG, PNG or WebP' }, 415);
  const fields = FieldsSchema.safeParse({ sessionId: form.get('sessionId') ?? undefined });
  if (!fields.success) return json({ error: 'Invalid fields' }, 400);

  // Base64 data URL: some hosts fail as URLs on the Meta API (media_url_origin_error).
  const bytes = Buffer.from(await image.arrayBuffer());
  const imageUrl = `data:${image.type};base64,${bytes.toString('base64')}`;
  const perception = getPerceptionClient(fields.data.sessionId);
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: Record<string, unknown>) =>
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      await runVisionPipeline(perception, imageUrl, send, req.signal);
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
