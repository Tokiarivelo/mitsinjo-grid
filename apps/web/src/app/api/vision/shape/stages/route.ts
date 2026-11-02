import 'server-only';

import { type NextRequest } from 'next/server';
import { cancelJob, followJob, hasJob } from '@/server/perception/shape-jobs';
import { jsonResponse, sseResponse } from '@/server/perception/vision-request';

/** Job ids are server UUIDs; anything else is refused before touching the registry. */
const JOB_ID = /^[0-9a-f-]{36}$/;

/**
 * Background stages of a 3D shape (PG-T18). `GET ?job=<id>&from=<seq>` → `text/event-stream`
 * replaying the job's `shape_stage` events from `seq`, then each new one, until
 * `shape_stages_done`, then `done`. `DELETE ?job=<id>` cancels a running job (204). 404 (JSON)
 * unknown or expired job, 400 bad id.
 */
export async function GET(req: NextRequest) {
  const job = req.nextUrl.searchParams.get('job') ?? '';
  const from = Number(req.nextUrl.searchParams.get('from') ?? 0);
  if (!JOB_ID.test(job)) return jsonResponse({ error: 'Invalid job' }, 400);
  if (!hasJob(job)) return jsonResponse({ error: 'Unknown job' }, 404);
  return sseResponse(async (send) => {
    await followJob(job, Number.isFinite(from) ? from : 0, send, req.signal);
  });
}

export async function DELETE(req: NextRequest) {
  const job = req.nextUrl.searchParams.get('job') ?? '';
  if (!JOB_ID.test(job)) return jsonResponse({ error: 'Invalid job' }, 400);
  if (!hasJob(job)) return jsonResponse({ error: 'Unknown job' }, 404);
  cancelJob(job);
  return new Response(null, { status: 204 });
}
