import 'server-only';

import {
  SHAPE_FUNCTION_MS,
  STAGE_ROUND_RESERVE_MS,
  STAGE_SLICE_MARGIN_MS,
} from '@/lib/object-shape';
import type { PerceptionClient } from './client';
import type { ObjectViews } from './object-views';
import { imageBytes } from './object-views';
import { finishJob, pushJobEvent } from './shape-jobs';
import {
  facadeStageLoop,
  viewStageLoop,
  type StageProgress,
  type StagesContinuation,
} from './shape-stages-spark';
import { STAGE_CHECKPOINT_MAX, STAGE_MAX_STALLS, type StageCheckpoint } from './stage-checkpoint';

/**
 * One slice of a background stage loop (PG-T18, Vercel limit): runs the stages left while the
 * request has time, streaming `shape_stage` on job `jobId`, then ends the job with
 * `shape_stages_done` (finished, cancelled, failed) or `shape_stages_checkpoint` (out of request
 * time: the browser posts the checkpoint back and the next request resumes). Never throws.
 */
export async function runStagesSlice({
  jobId,
  rest,
  requestStart,
  signal,
  startRound = 1,
  stalls = 0,
  now = Date.now,
  limitMs = SHAPE_FUNCTION_MS,
}: {
  jobId: string;
  rest: StagesContinuation;
  /** When the serverless request started (its limit counts from there). */
  requestStart: number;
  signal: AbortSignal;
  startRound?: number;
  /** Slices in a row that ended without a finished round. */
  stalls?: number;
  now?: () => number;
  limitMs?: number;
}): Promise<void> {
  const label = rest.context?.label ?? 'object';
  const out = await rest.run({
    budgetMs: requestStart + limitMs - STAGE_SLICE_MARGIN_MS - now(),
    signal,
    startRound,
    roundReserveMs: STAGE_ROUND_RESERVE_MS,
    onProgress: (e: StageProgress) => pushJobEvent(jobId, 'shape_stage', { ...e, jobId }),
  });
  const done = (status: 'done' | 'stopped', cause?: 'timeout' | 'error' | 'aborted') =>
    finishJob(jobId, 'shape_stages_done', { jobId, status, ...(cause ? { cause } : {}) });
  if (signal.aborted) return done('stopped', 'aborted');
  if (!out.resume) return done(out.cause ? 'stopped' : 'done', out.cause);
  // No round finished in this slice (same stage and round as it started): a stall.
  const stalled = out.resume.stages[0] === rest.stages[0] && out.resume.round === startRound;
  const nextStalls = stalled ? stalls + 1 : 0;
  if (!rest.context || nextStalls >= STAGE_MAX_STALLS) {
    console.info(
      `[vision] 3D stages for "${label}": ${rest.context ? `${nextStalls} slices without progress` : 'no checkpoint context'}, stopped`
    );
    return done('stopped', 'timeout');
  }
  const checkpoint: StageCheckpoint = {
    ...rest.context,
    v: 1,
    all: rest.all,
    stages: out.resume.stages,
    round: out.resume.round,
    stalls: nextStalls,
    recipe: out.resume.recipe,
  };
  if (JSON.stringify(checkpoint).length > STAGE_CHECKPOINT_MAX) {
    console.warn(`[vision] 3D stages for "${label}": checkpoint too large to resume, stopped`);
    return done('stopped', 'timeout');
  }
  console.info(
    `[vision] 3D stages for "${label}": request time up, checkpoint at ${out.resume.stages[0]} round ${out.resume.round} (${out.resume.stages.join(', ')} left)`
  );
  finishJob(jobId, 'shape_stages_checkpoint', { jobId, checkpoint });
}

/**
 * The background loop rebuilt from a checkpoint (`StageCheckpointSchema`, already parsed): same
 * loop builder, the stages left only, the model so far as seed. Null when nothing is left.
 */
export async function resumeStages(
  perception: Pick<PerceptionClient, 'proposeShapeOps'>,
  cp: StageCheckpoint,
  signal?: AbortSignal
): Promise<StagesContinuation | null> {
  const propose = perception.proposeShapeOps.bind(perception);
  const timing = {
    firstBudgetMs: 0,
    resumeAt: { all: cp.all, stages: cp.stages },
    ...(signal ? { signal } : {}),
  };
  const { loop } = cp;
  const started =
    loop.kind === 'views'
      ? viewStageLoop({
          recipe: cp.recipe,
          archetype: loop.archetype,
          views: {
            front: loop.front,
            side: loop.side,
            frontUrl: loop.frontUrl,
            sidePng: loop.sidePng ? Buffer.from(loop.sidePng, 'base64') : null,
          } satisfies ObjectViews,
          label: cp.label,
          proposeShapeOps: async (img, q, sig, sheet, opts) => ({
            result: await propose(img, q, sig, sheet, opts),
          }),
          ...timing,
        })
      : facadeStageLoop({
          recipe: cp.recipe,
          front: loop.front,
          ...(loop.front.roofRings ? { roofRings: loop.front.roofRings } : {}),
          label: cp.label,
          proposeShapeOps: async (img, q, sig, opts) => ({
            result: await propose(img, q, sig, 'elevation', opts),
          }),
          drawing: () =>
            loop.facadeUrl ? imageBytes(loop.facadeUrl, signal) : Promise.resolve(null),
          ...timing,
        });
  if (!started) return null;
  const { rest } = await started;
  if (!rest) return null;
  const context = { label: cp.label, loop: cp.loop };
  return {
    ...rest,
    context,
    run: (o) =>
      rest.run({
        ...o,
        onProgress: (e) => {
          if (e.state === 'done')
            console.info(
              `[vision] 3D stage ${e.index}/${e.total} ${e.stage} (resumed) for "${cp.label}": ${e.before?.toFixed(2)}→${e.after?.toFixed(2)} (${e.stop}${e.recipe ? ', model updated' : ''})`
            );
          o.onProgress(e);
        },
      }),
  };
}
