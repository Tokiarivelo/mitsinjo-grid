import 'server-only';

import { type NextRequest } from 'next/server';
import { ShapeTargetSchema } from '@/lib/object-shape';
import { getPerceptionClient } from '@/server/perception';
import { runObjectShape } from '@/server/perception/object-shape';
import {
  jsonField,
  jsonResponse,
  photoSize,
  readVisionRequest,
} from '@/server/perception/vision-request';

/**
 * 3D shape of one detected object (PV-T9), Meta models only. Multipart: `image` (same photo as
 * `/api/vision`), `target` (JSON `ShapeTarget`: id, label, category, box), `sessionId?`.
 * → JSON `ObjectShape`: `recipe` (Spark parts) or `silhouette` (fallback, built in the browser from the
 * SAM outline). 400 missing / invalid target. The crop is sent inline: nothing is stored.
 */
export async function POST(req: NextRequest) {
  const read = await readVisionRequest(req);
  if (read instanceof Response) return read;
  const target = jsonField(read.form, 'target', ShapeTargetSchema);
  if (!target) return jsonResponse({ error: 'Invalid target' }, 400);
  const { photo, sessionId } = read;
  const shape = await runObjectShape(
    getPerceptionClient(sessionId),
    await photoSize(photo.buffer),
    `data:${photo.contentType};base64,${photo.buffer.toString('base64')}`,
    target,
    req.signal
  );
  return jsonResponse(shape);
}
