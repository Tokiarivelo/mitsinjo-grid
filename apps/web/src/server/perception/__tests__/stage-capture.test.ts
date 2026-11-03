// @vitest-environment node
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { fitRecipe } from '@/lib/object-shape';
import { facadeHouseRecipe, measureElevation } from '../facade-house';
import {
  newStageCapture,
  readStageCaptures,
  recordingProposeShapeOps,
  replayProposer,
  replayStageCapture,
  stageOfQuestion,
  stageReplayMarkdown,
  writeStageCapture,
  type StageAnswer,
} from '../stage-capture';
import { HOUSE_STAGES } from '../shape-stages';
import { SHAPE_SCRIPT_PROMPT_VERSION } from '../shape-script-prompt';
import { THATCHED_FRONT } from '../__fixtures__/elevation';

const g = THATCHED_FRONT;
const front = measureElevation(g.masks)!;
const seed = fitRecipe(
  { ...facadeHouseRecipe({ front, side: null, colors: g.colors }), source: 'facade' },
  0
);

describe('stage capture (PG-T22 replay)', () => {
  it('reads stage and round from a stage question', () => {
    expect(stageOfQuestion('… Stage: roof (round 2). Stage score 71 %')).toEqual({
      stage: 'roof',
      round: 2,
    });
    expect(stageOfQuestion('Stage: walls (round 1)')).toBeNull();
    expect(stageOfQuestion('no stage')).toBeNull();
  });

  it('records each answer with its stage, round and latency', async () => {
    const answers: StageAnswer[] = [];
    let t = 1000;
    const fn = recordingProposeShapeOps(
      async () => ({ model: 'm', ops: [{ op: 'remove', id: 'x' }] }),
      answers,
      () => (t += 500)
    );
    const res = await fn('img', 'Stage: openings (round 1).');
    expect(res.ops).toHaveLength(1);
    await fn('img', 'not a stage question');
    expect(answers).toEqual([
      { stage: 'openings', round: 1, ops: [{ op: 'remove', id: 'x' }], seconds: 0.5 },
    ]);
  });

  it('replays answers by stage and round, empty patch when none', async () => {
    const propose = replayProposer([{ stage: 'roof', round: 1, ops: [{ op: 'a' }], seconds: 1 }]);
    const ctx = { round: 1 } as Parameters<typeof propose>[0];
    expect(await propose({ ...ctx, stage: HOUSE_STAGES[1]! })).toEqual([{ op: 'a' }]);
    expect(await propose({ ...ctx, stage: HOUSE_STAGES[0]! })).toEqual([]);
  });

  it('writes, reads and replays a capture deterministically, never below the seed', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'stages-'));
    const capture = newStageCapture({
      id: 'thatched',
      model: 'muse-spark-1.3',
      label: 'thatched house',
      front,
      seed: { ...seed, swatches: { thatch: 'data:image/png;base64,AA' } },
      answers: [
        // A flattened ridge (worse) and a junk op: both refused, the seed stays.
        { stage: 'roof', round: 1, ops: [{ op: 'set', id: 'roof', ridge: 0 }], seconds: 3 },
        { stage: 'openings', round: 1, ops: [{ op: 'eval' }], seconds: 2 },
      ],
      now: new Date('2026-11-03T00:00:00Z'),
    });
    expect(capture.seed.swatches).toBeUndefined();
    writeStageCapture(dir, capture);
    writeFileSync(join(dir, 'bad.stages.json'), '{"version": 2}');
    const [back, ...rest] = readStageCaptures(dir);
    expect(rest).toHaveLength(0);
    expect(back).toEqual(capture);
    const a = await replayStageCapture(back!);
    const b = await replayStageCapture(back!);
    expect(a.row).toEqual(b.row);
    expect(a.row.overall.after).toBeGreaterThanOrEqual(a.row.overall.before);
    expect(a.row.ops).toBe(2);
    expect(a.row.stages.every((s) => s.stop !== 'timeout')).toBe(true);
    const md = stageReplayMarkdown([a.row]);
    expect(md).toMatch(/^\| capture \| prompt \| massing \| roof \| openings \| accessories \|/);
    expect(md).toContain(`| thatched | v${SHAPE_SCRIPT_PROMPT_VERSION} |`);
  });
});
