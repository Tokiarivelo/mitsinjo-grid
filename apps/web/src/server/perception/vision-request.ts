import 'server-only';

import sharp from 'sharp';
import { z } from 'zod';
import { prepareVisionImage, type PreparedVisionImage } from './prepare-image';
import type { PhotoForRegions } from './region';

/** The browser sends the photo as picked (the server rotates and resizes it); 12 MB fits a phone photo. */
export const MAX_VISION_BYTES = 12_000_000;
const IMAGE_TYPES = /^image\/(jpeg|png|webp)$/;

const FieldsSchema = z.object({ sessionId: z.string().max(64).optional() });

export const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

export interface VisionRequest {
  form: FormData;
  sessionId?: string;
  /** Upright, ≤ 1280 px JPEG (what Muse and SAM see, matching what the page shows). */
  photo: PreparedVisionImage;
}

/**
 * Multipart `image` (JPEG/PNG/WebP ≤ MAX_VISION_BYTES) + `sessionId?`, shared by the vision routes.
 * → the prepared photo, or the error response (400 missing / bad fields, 413 too big, 415 not an image).
 */
export async function readVisionRequest(req: Request): Promise<VisionRequest | Response> {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return jsonResponse({ error: 'Expected multipart form data' }, 400);
  }
  const image = form.get('image');
  if (!(image instanceof Blob) || image.size === 0)
    return jsonResponse({ error: 'Missing image' }, 400);
  if (image.size > MAX_VISION_BYTES)
    return jsonResponse({ error: 'Image too large (max 12 MB)' }, 413);
  if (!IMAGE_TYPES.test(image.type))
    return jsonResponse({ error: 'Image must be JPEG, PNG or WebP' }, 415);
  const fields = FieldsSchema.safeParse({ sessionId: form.get('sessionId') ?? undefined });
  if (!fields.success) return jsonResponse({ error: 'Invalid fields' }, 400);
  const photo = await prepareVisionImage(Buffer.from(await image.arrayBuffer()), image.type);
  return { form, sessionId: fields.data.sessionId, photo };
}

/** JSON form field parsed with `schema`; undefined when absent, null when present but invalid. */
export function jsonField<T>(
  form: FormData,
  name: string,
  schema: z.ZodType<T>
): T | null | undefined {
  const raw = form.get(name);
  if (typeof raw !== 'string') return undefined;
  try {
    const ok = schema.safeParse(JSON.parse(raw));
    return ok.success ? ok.data : null;
  } catch {
    return null;
  }
}

/** Pixel size for cropping; null when the bytes cannot be decoded (whole photo sent). */
export async function photoSize(buffer: Buffer): Promise<PhotoForRegions | null> {
  try {
    const { width, height } = await sharp(buffer, { failOn: 'none' }).metadata();
    return width && height ? { buffer, width, height } : null;
  } catch {
    return null;
  }
}

/** SSE sender of a vision route: `event: <name>` + JSON `data`. */
export type SseSend = (event: string, data: Record<string, unknown>) => void;

/**
 * `text/event-stream` response for the vision routes: `run` sends events, then `done` closes it.
 * Proxy buffering off so steps reach the browser as they happen.
 */
export function sseResponse(run: (send: SseSend) => Promise<void>): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let open = true;
      // A closed client (tab gone, reconnect) must not crash the work still running.
      const send: SseSend = (event, data) => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          open = false;
        }
      };
      await run(send);
      send('done', {});
      if (open) {
        try {
          controller.close();
        } catch {
          // already closed by the client
        }
      }
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
