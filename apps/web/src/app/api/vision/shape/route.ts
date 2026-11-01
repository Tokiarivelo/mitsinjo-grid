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
  sseResponse,
} from '@/server/perception/vision-request';

/**
 * 3D shape of one detected object (PV-T9), Meta models only. Multipart: `image` (same photo as
 * `/api/vision`), `target` (JSON `ShapeTarget`: id, label, category, box), `sessionId?`.
 * → `text/event-stream`: `shape_step { step: crop|model|fit }` as the work goes, then
 * `shape_result { shape: ObjectShape }` (`recipe` or `silhouette` + reason), `done`.
 * 400 (JSON) missing / invalid target. The crop is sent inline: nothing is stored.
 */
export async function POST(req: NextRequest) {
  const read = await readVisionRequest(req);
  if (read instanceof Response) return read;
  const target = jsonField(read.form, 'target', ShapeTargetSchema);
  if (!target) return jsonResponse({ error: 'Invalid target' }, 400);
  const { photo, sessionId } = read;
  const perception = getPerceptionClient(sessionId);
  const size = await photoSize(photo.buffer);
  const fullUrl = `data:${photo.contentType};base64,${photo.buffer.toString('base64')}`;
  return sseResponse(async (send) => {
    const shape = await runObjectShape(perception, size, fullUrl, target, {
      signal: req.signal,
      onStep: (step) => send('shape_step', { step }),
      withViews: true,
    });
    send('shape_result', { shape });
  });
}
