// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';

vi.mock('server-only', () => ({}));

const recipe = {
  proportions: { w: 1, h: 0.6, d: 0.5 },
  parts: [{ shape: 'box', at: [0, 0, 0], size: [1, 1, 1], color: '#aaaaaa' }],
  source: 'facade',
};
/** What the fake pipeline does: first-answer stage events, then stages left for the background. */
const plan: { left: boolean; release?: () => void } = { left: true };

vi.mock('@/server/perception/spark-critic', () => ({
  shapeWithCritic: vi.fn(async (_p, _s, _u, target, opts) => {
    opts.onStage?.({ phase: 'first', index: 1, total: 4, stage: 'massing', state: 'running' });
    opts.onStage?.({
      phase: 'first',
      index: 1,
      total: 4,
      stage: 'massing',
      state: 'done',
      before: 0.9,
      after: 0.97,
      stop: 'gate',
      recipe,
    });
    if (plan.left)
      opts.onStagesLeft?.({
        total: 4,
        stages: ['roof'],
        run: async ({ onProgress }: { onProgress: (e: unknown) => void }) => {
          onProgress({ phase: 'background', index: 2, total: 4, stage: 'roof', state: 'running' });
          await new Promise<void>((r) => (plan.release ? r() : (plan.release = r)));
          onProgress({
            phase: 'background',
            index: 2,
            total: 4,
            stage: 'roof',
            state: 'done',
            before: 0.5,
            after: 0.8,
            stop: 'no_gain',
          });
          return { recipe };
        },
      });
    return { detectionId: target.id, mode: 'recipe', recipe, source: 'meta', model: 'm' };
  }),
}));

import { ShapeStageEventSchema, ShapeStagesDoneSchema } from '@/lib/object-shape';
import { parseSseChunk } from '@/lib/sse';
import { resetJobs } from '@/server/perception/shape-jobs';
import { POST } from '../route';
import { DELETE, GET, POST as RESUME } from '../stages/route';

const form = () => {
  const f = new FormData();
  f.append('image', new Blob([new Uint8Array(500)], { type: 'image/jpeg' }), 'room.jpg');
  f.append(
    'target',
    JSON.stringify({ id: 'h', label: 'house', category: 'other', box: { x: 0, y: 0, w: 1, h: 1 } })
  );
  return f;
};
const post = () =>
  POST(
    new Request('http://localhost/api/vision/shape', {
      method: 'POST',
      body: form(),
    }) as unknown as NextRequest
  );
const getReq = (q: string, method = 'GET') => {
  const url = new URL(`http://localhost/api/vision/shape/stages?${q}`);
  return Object.assign(new Request(url, { method }), { nextUrl: url }) as unknown as NextRequest;
};
const events = async (res: Response) => parseSseChunk(await res.text()).events;

beforeEach(() => {
  resetJobs();
  plan.left = true;
  plan.release = undefined;
});

describe('POST /api/vision/shape with staged stages (PG-T17/T18)', () => {
  it('streams first-answer stages, the result with its job id, then the background stages', async () => {
    plan.release = () => {}; // background answers at once
    const list = await events(await post());
    expect(list.map((e) => e.event)).toEqual([
      'shape_stage',
      'shape_stage',
      'shape_result',
      'shape_stage',
      'shape_stage',
      'shape_stages_done',
      'done',
    ]);
    const jobId = list[2]!.data.jobId as string;
    expect(jobId).toMatch(/^[0-9a-f-]{36}$/);
    for (const e of list.filter((x) => x.event === 'shape_stage'))
      expect(ShapeStageEventSchema.safeParse(e.data).success).toBe(true);
    expect(ShapeStageEventSchema.parse(list[1]!.data).recipe).toBeDefined();
    expect(ShapeStagesDoneSchema.parse(list[5]!.data)).toEqual({ jobId, status: 'done' });
  });

  it('no stages left → no job id, the stream ends after the result', async () => {
    plan.left = false;
    const list = await events(await post());
    expect(list.map((e) => e.event)).toEqual([
      'shape_stage',
      'shape_stage',
      'shape_result',
      'done',
    ]);
    expect(list[2]!.data.jobId).toBeUndefined();
  });
});

describe('GET / DELETE /api/vision/shape/stages (PG-T18)', () => {
  it('a reconnect replays from its seq and follows the job to the end', async () => {
    const ctrl = new AbortController();
    const res = await POST(
      new Request('http://localhost/api/vision/shape', {
        method: 'POST',
        body: form(),
        signal: ctrl.signal,
      }) as unknown as NextRequest
    );
    // Read up to the first background event, then drop the stream.
    const reader = res.body!.getReader();
    let text = '';
    while (!text.includes('"phase":"background"'))
      text += new TextDecoder().decode((await reader.read()).value);
    const jobId = /"jobId":"([0-9a-f-]{36})"/.exec(text)![1]!;
    ctrl.abort();
    await reader.cancel();
    const resumed = GET(getReq(`job=${jobId}&from=1`));
    plan.release!();
    const list = await events(await resumed);
    expect(list.map((e) => [e.event, e.data.seq])).toEqual([
      ['shape_stage', 1],
      ['shape_stages_done', 2],
      ['done', undefined],
    ]);
  });

  it('refuses bad and unknown jobs; DELETE cancels a running one', async () => {
    expect((await GET(getReq('job=../etc'))).status).toBe(400);
    expect((await GET(getReq(`job=${'0'.repeat(36)}`))).status).toBe(404);
    expect((await DELETE(getReq(`job=${'0'.repeat(36)}`, 'DELETE'))).status).toBe(404);
  });

  it('POST resume refuses a bad or oversized checkpoint before any work', async () => {
    const post = (body: string) =>
      RESUME(
        new Request('http://localhost/api/vision/shape/stages', {
          method: 'POST',
          body,
        }) as unknown as NextRequest
      );
    expect((await post('not json')).status).toBe(400);
    expect((await post(JSON.stringify({ checkpoint: { v: 2 } }))).status).toBe(400);
    expect((await post('x'.repeat(4_100_000))).status).toBe(413);
  });
});
