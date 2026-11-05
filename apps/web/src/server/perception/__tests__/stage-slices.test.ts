// @vitest-environment node
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import sharp from 'sharp';
vi.mock('server-only', () => ({}));
import { SHAPE_FUNCTION_MS } from '@/lib/object-shape';
import { viewsRecipe } from '../object-views';
import { createJob, followJob, resetJobs } from '../shape-jobs';
import { viewStageLoop, type StagesContinuation } from '../shape-stages-spark';
import {
  StageCheckpointSchema,
  STAGE_MAX_STALLS,
  type StageLoopContext,
} from '../stage-checkpoint';
import { resumeStages, runStagesSlice } from '../stage-slices';
import { KIT, front, side } from '../__fixtures__/views';

const car = viewsRecipe({ front, side }, KIT);
const ops = async () => ({ result: { ops: [] as unknown[] } });

/** Every event of a finished job. */
async function events(id: string) {
  const out: Array<{ event: string; data: Record<string, unknown> }> = [];
  await followJob(id, 0, (event, data) => out.push({ event, data }));
  return out;
}

describe('background stages in slices (Vercel 300 s limit, live 2026-11-03)', () => {
  let context: StageLoopContext;
  let rest: StagesContinuation;
  beforeAll(async () => {
    const png = await sharp({ create: { width: 64, height: 48, channels: 3, background: '#fff' } })
      .png()
      .toBuffer();
    const frontUrl = `data:image/png;base64,${png.toString('base64')}`;
    context = {
      label: 'car',
      loop: { kind: 'views', archetype: 'vehicle', front, side, frontUrl, sidePng: null },
    };
    // Every stage left for the background (no first-answer budget).
    const loop = await viewStageLoop({
      recipe: car,
      archetype: 'vehicle',
      views: { front, side, frontUrl, sidePng: null },
      label: 'car',
      firstBudgetMs: 0,
      proposeShapeOps: ops,
    })!;
    rest = { ...loop.rest!, context };
  }, 60_000);
  beforeEach(() => resetJobs());

  it('a request out of time ends with a checkpoint, not a timeout (before: « Task timed out after 300 seconds »)', async () => {
    const signal = createJob('job-1');
    // The request already used its whole time: no round starts.
    await runStagesSlice({
      jobId: 'job-1',
      rest,
      requestStart: Date.now() - SHAPE_FUNCTION_MS,
      signal,
    });
    const last = (await events('job-1')).at(-1)!;
    expect(last.event).toBe('shape_stages_checkpoint');
    const cp = StageCheckpointSchema.parse(JSON.parse(JSON.stringify(last.data.checkpoint)));
    // No time for a round: the loop resumes where it stood (the body is below its 0.92 gate).
    expect(cp.stages).toEqual(rest.stages.slice(rest.stages.indexOf(cp.stages[0]!)));
    expect(cp.all).toEqual(rest.all);
    expect(cp.stages[0]).toBe(rest.stages[0]);
    expect(cp.round).toBe(1);
    // No round finished in this slice: one stall (the next slices may still progress).
    expect(cp.stalls).toBe(1);
    expect(cp.recipe.parts).toEqual(car.parts);
  }, 60_000);

  it('the next request resumes from the checkpoint and finishes, positions kept', async () => {
    createJob('job-2');
    await runStagesSlice({
      jobId: 'job-2',
      rest,
      requestStart: Date.now() - SHAPE_FUNCTION_MS,
      signal: new AbortController().signal,
    });
    const cp = StageCheckpointSchema.parse(
      JSON.parse(JSON.stringify((await events('job-2')).at(-1)!.data.checkpoint))
    );
    const propose = vi.fn(async () => ({ ops: [] as unknown[] }));
    const resumed = await resumeStages({ proposeShapeOps: propose } as never, cp);
    expect(resumed!.stages).toEqual(cp.stages);
    const signal = createJob('job-3');
    await runStagesSlice({
      jobId: 'job-3',
      rest: resumed!,
      requestStart: Date.now(),
      signal,
      startRound: cp.round,
      stalls: cp.stalls,
    });
    const evs = await events('job-3');
    expect(evs.at(-1)).toMatchObject({ event: 'shape_stages_done', data: { status: 'done' } });
    expect(propose).toHaveBeenCalled();
    // Progress keeps the loop's full order: « stage n / total » as before the cut.
    const stageEvents = evs.filter((e) => e.event === 'shape_stage').map((e) => e.data);
    expect(stageEvents.every((e) => e.total === cp.all.length)).toBe(true);
    const first = stageEvents.find((e) => e.state === 'running')!;
    expect(first.index).toBe(cp.all.indexOf(cp.stages[0]!) + 1);
  }, 60_000);

  it('never retries forever: slices without progress stop as timeout', async () => {
    createJob('job-4a');
    await runStagesSlice({
      jobId: 'job-4a',
      rest,
      requestStart: Date.now() - SHAPE_FUNCTION_MS,
      signal: new AbortController().signal,
    });
    const cp = StageCheckpointSchema.parse(
      JSON.parse(JSON.stringify((await events('job-4a')).at(-1)!.data.checkpoint))
    );
    // Resumed at a stage that needs Spark, still no time: no round finishes.
    const resumed = await resumeStages({ proposeShapeOps: async () => ({ ops: [] }) } as never, cp);
    createJob('job-4');
    await runStagesSlice({
      jobId: 'job-4',
      rest: resumed!,
      requestStart: Date.now() - SHAPE_FUNCTION_MS,
      signal: new AbortController().signal,
      startRound: cp.round,
      stalls: STAGE_MAX_STALLS - 1,
    });
    expect((await events('job-4')).at(-1)).toMatchObject({
      event: 'shape_stages_done',
      data: { status: 'stopped', cause: 'timeout' },
    });
  }, 60_000);

  it('a cancelled slice ends as stopped (aborted), no checkpoint', async () => {
    const ctrl = new AbortController();
    createJob('job-5');
    ctrl.abort();
    await runStagesSlice({ jobId: 'job-5', rest, requestStart: Date.now(), signal: ctrl.signal });
    expect((await events('job-5')).at(-1)).toMatchObject({
      event: 'shape_stages_done',
      data: { status: 'stopped', cause: 'aborted' },
    });
  }, 60_000);

  it('refuses a checkpoint fetching anything but an inline image or https', () => {
    const bad = {
      ...context,
      v: 1,
      all: ['body'],
      stages: ['body'],
      round: 1,
      recipe: car,
      loop: { ...context.loop, frontUrl: 'file:///etc/passwd' },
    };
    expect(StageCheckpointSchema.safeParse(bad).success).toBe(false);
  });
});

describe('facade house checkpoint (PG-T16)', () => {
  it('rebuilds the house loop on the stages left, from the measured elevation', async () => {
    const { THATCHED_FRONT } = await import('../__fixtures__/elevation');
    const { measureElevation, facadeHouseRecipe } = await import('../facade-house');
    const { fitRecipe } = await import('@/lib/object-shape');
    const { elevationForCheckpoint } = await import('../stage-checkpoint');
    const front = measureElevation(THATCHED_FRONT.masks)!;
    const recipe = fitRecipe(
      {
        ...facadeHouseRecipe({ front, side: null, colors: THATCHED_FRONT.colors }),
        source: 'facade',
      },
      0
    );
    const cp = StageCheckpointSchema.parse(
      JSON.parse(
        JSON.stringify({
          v: 1,
          label: 'house',
          loop: { kind: 'facade', front: elevationForCheckpoint(front) },
          all: ['massing', 'roof', 'openings', 'accessories', 'final'],
          stages: ['openings', 'accessories', 'final'],
          round: 2,
          recipe,
        })
      )
    );
    const rest = await resumeStages({ proposeShapeOps: async () => ({ ops: [] }) } as never, cp);
    expect(rest!.stages).toEqual(['openings', 'accessories', 'final']);
    expect(rest!.all).toEqual(cp.all);
    expect(rest!.context).toEqual({ label: 'house', loop: cp.loop });
  }, 60_000);
});
