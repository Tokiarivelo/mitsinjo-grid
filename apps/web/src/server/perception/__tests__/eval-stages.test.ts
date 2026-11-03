// @vitest-environment node
import { existsSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { readStageCaptures, replayStageCapture, stageReplayMarkdown } from '../stage-capture';

/**
 * `make eval-stages` (also run by `make eval-shape`): replays every recorded stage loop
 * (`*.stages.json`, written by `make facade-e2e`) offline and prints the per-stage table.
 */
const DIR = process.env.EVAL_STAGES_DIR;

describe.skipIf(!DIR)('stage replay', () => {
  it('make eval-stages', async () => {
    const captures = existsSync(DIR!) ? readStageCaptures(DIR!) : [];
    if (!captures.length) {
      console.log(`no stage captures in ${DIR} (record one with make facade-e2e … ID=…)`);
      return;
    }
    const rows = [];
    for (const c of captures) rows.push((await replayStageCapture(c)).row);
    console.log(stageReplayMarkdown(rows));
    // The loop is monotone: a replay never ends below its seed.
    for (const r of rows) expect(r.overall.after).toBeGreaterThanOrEqual(r.overall.before);
  });
});
