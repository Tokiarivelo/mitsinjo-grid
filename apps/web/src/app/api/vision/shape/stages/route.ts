import 'server-only';

import { randomUUID } from 'node:crypto';
import { type NextRequest } from 'next/server';
import { z } from 'zod';
import { getPerceptionClient } from '@/server/perception';
import {
  cancelJob,
  createJob,
  finishJob,
  followJob,
  hasJob,
  pushJobEvent,
} from '@/server/perception/shape-jobs';
import { STAGE_CHECKPOINT_MAX, StageCheckpointSchema } from '@/server/perception/stage-checkpoint';
import { resumeStages, runStagesSlice } from '@/server/perception/stage-slices';
import { jsonResponse, sseResponse } from '@/server/perception/vision-request';

/** Job ids are server UUIDs; anything else is refused before touching the registry. */
const JOB_ID = /^[0-9a-f-]{36}$/;

/**
 * Background stages of a 3D shape (PG-T18). `GET ?job=<id>&from=<seq>` → `text/event-stream`
 * replaying the job's `shape_stage` events from `seq`, then each new one, until
 * `shape_stages_done`, then `done`. `DELETE ?job=<id>` cancels a running job (204). 404 (JSON)
 * unknown or expired job, 400 bad id.
 * `POST { checkpoint, sessionId? }` (JSON) resumes a loop cut by the request limit: a new job
 * (`shape_stages_resumed { jobId }` first), then the same `shape_stage` events until
 * `shape_stages_done` or the next `shape_stages_checkpoint`. Tied to this request: the browser
 * closing it (« Cancel ») stops the loop. 400 invalid checkpoint, 413 too large.
 */

/** Vercel request limit (s) = `SHAPE_FUNCTION_MS`: the stages stop before it with a checkpoint. */
export const maxDuration = 300;

const ResumeBodySchema = z.object({
  checkpoint: StageCheckpointSchema,
  sessionId: z.string().max(128).optional(),
});
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

export async function POST(req: NextRequest) {
  const requestStart = Date.now();
  const text = await req.text().catch(() => '');
  if (text.length > STAGE_CHECKPOINT_MAX + 1_000) return jsonResponse({ error: 'Too large' }, 413);
  let raw: unknown = null;
  try {
    raw = JSON.parse(text);
  } catch {
    raw = null;
  }
  const body = ResumeBodySchema.safeParse(raw);
  if (!body.success) return jsonResponse({ error: 'Invalid checkpoint' }, 400);
  const { checkpoint, sessionId } = body.data;
  const perception = getPerceptionClient(sessionId);
  return sseResponse(async (send) => {
    const jobId = randomUUID();
    const signal = createJob(jobId);
    // The browser closing the stream (« Cancel », new request) stops the loop.
    req.signal.addEventListener('abort', () => cancelJob(jobId), { once: true });
    pushJobEvent(jobId, 'shape_stages_resumed', { jobId });
    const rest = await resumeStages(perception, checkpoint, signal).catch((err) => {
      console.warn('[vision] 3D stages resume failed:', err instanceof Error ? err.message : err);
      return null;
    });
    if (!rest) finishJob(jobId, 'shape_stages_done', { jobId, status: 'done' });
    else
      void runStagesSlice({
        jobId,
        rest,
        requestStart,
        signal,
        startRound: checkpoint.round,
        stalls: checkpoint.stalls,
      });
    await followJob(jobId, 0, send, req.signal);
  });
}
