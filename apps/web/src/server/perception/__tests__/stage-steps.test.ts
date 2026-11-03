import { describe, expect, it } from 'vitest';
import type { ObjectRecipe, RecipePart } from '@/lib/object-shape';
import { compileScript, recipeToScript } from '@/lib/shape-script';
import { type Proposer, type StageSpec, runShapeStages } from '../shape-stages';
import { feedbackLines } from '../shape-script-prompt';
import { STAGE_STEP_SHARES, microPatch, stepVariants, trialsLog } from '../stage-steps';

const wall: RecipePart = {
  shape: 'box',
  at: [0, -0.2, 0],
  size: [0.6, 0.6, 0.6],
  color: '#e6dccb',
  kind: 'wall',
  front: true,
};
const roof: RecipePart = {
  shape: 'hip',
  ridge: 0.3,
  at: [0, 0.3, 0],
  size: [0.9, 0.4, 0.7],
  color: '#c8a060',
  kind: 'roof',
};
const seed = recipeToScript({ proportions: { w: 1, h: 0.7, d: 0.6 }, parts: [wall, roof] });
const base = compileScript(seed);
const find = (r: ObjectRecipe, k: string) => r.parts.find((p) => p.kind === k)!;
// Targets: roof 0.3 high (from 0.4), ridge 0.9; the wall stays.
const roofScore = (r: ObjectRecipe) => {
  const p = find(r, 'roof');
  const v = 1 - Math.abs(p.size[1] - 0.3) - Math.abs((p.ridge ?? 0) - 0.9) / 2;
  return { stage: v, overall: v };
};
const step = (patch: unknown[]) =>
  microPatch({
    script: seed,
    patch,
    locked: new Set(['wall']),
    components: base.components,
    current: roofScore(base.recipe!),
    score: roofScore,
  });

describe('stepVariants', () => {
  it('a set that resizes a known part is also tried at a half and a quarter step', () => {
    const v = stepVariants({ op: 'set', id: 'roof', size: [0.9, 0, 0.7] }, base.components);
    expect(v.map((x) => x.share)).toEqual([...STAGE_STEP_SHARES]);
    expect((v[1]!.op as { size: number[] }).size[1]).toBeCloseTo(0.2);
  });

  it('other ops are tried as sent', () => {
    expect(stepVariants({ op: 'set', id: 'roof', ridge: 1 }, base.components)).toHaveLength(1);
    expect(stepVariants({ op: 'remove', id: 'roof' }, base.components)).toHaveLength(1);
  });
});

describe('microPatch', () => {
  it('keeps the good op of a patch a bad op used to sink (before: whole patch no_gain)', () => {
    const r = step([
      { op: 'set', id: 'roof', ridge: 0.9 },
      { op: 'set', id: 'roof', size: [0.9, 0.9, 0.7] },
    ]);
    expect(r.trials.map((t) => t.outcome)).toEqual(['kept', 'worse']);
    expect(find(r.out!.recipe!, 'roof').ridge).toBe(0.9);
    expect(find(r.out!.recipe!, 'roof').size[1]).toBe(0.4);
  });

  it('an overshooting move is kept at a smaller step', () => {
    // 0.4 → 0.1 overshoots the 0.3 target; the quarter step lands on 0.325.
    const r = step([{ op: 'set', id: 'roof', size: [0.9, 0.1, 0.7] }]);
    expect(r.trials[0]).toMatchObject({ outcome: 'kept', share: 0.25 });
    expect(find(r.out!.recipe!, 'roof').size[1]).toBeCloseTo(0.325);
  });

  it('a locked or empty op is reported, nothing kept', () => {
    const r = step([
      { op: 'set', id: 'wall', size: [0.8, 0.6, 0.6] },
      { op: 'set', id: 'roof', at_nudge: [0, -0.3, 0] },
    ]);
    expect(r.ops).toEqual([]);
    expect(r.trials.map((t) => t.outcome)).toEqual(['dropped', 'no_effect']);
    expect(r.dropped).toBe(1);
    expect(trialsLog(r.trials)).toContain('no effect (at_nudge)');
  });
});

describe('runShapeStages retry (no_gain)', () => {
  const STAGE: StageSpec<'roof'> = { id: 'roof', kinds: ['roof'], gate: 0.99 };

  it('a round without gain gets one retry, told what each op did', async () => {
    const seen: unknown[] = [];
    const propose: Proposer<'roof'> = async (ctx) => {
      seen.push(ctx.feedback);
      return ctx.round === 1
        ? [{ op: 'set', id: 'roof', size: [0.9, 0.9, 0.7] }]
        : [{ op: 'set', id: 'roof', ridge: 0.9 }];
    };
    const res = await runShapeStages({
      seed,
      stages: [STAGE],
      score: (r) => roofScore(r),
      propose,
      budgetMs: 5_000,
    });
    expect(seen[0]).toBeUndefined();
    expect(seen[1]).toMatchObject({ round: 1, kept: false, trials: [{ outcome: 'worse' }] });
    expect(res.stages[0]!.kept).toBe(1);
    expect(find(res.recipe, 'roof').ridge).toBe(0.9);
  });

  it('an empty answer (« already matches ») stops at once', async () => {
    let calls = 0;
    const res = await runShapeStages({
      seed,
      stages: [STAGE],
      score: (r) => roofScore(r),
      propose: async () => {
        calls++;
        return [];
      },
      budgetMs: 5_000,
    });
    expect(calls).toBe(1);
    expect(res.stages[0]!.stop).toBe('no_gain');
  });
});

describe('feedbackLines', () => {
  it('says what was kept, overshot, worse or changed nothing', () => {
    const text = feedbackLines({
      round: 1,
      kept: false,
      refused: 1,
      trials: [
        { op: 'set', id: 'roof', outcome: 'worse', fields: ['size'] },
        { op: 'set', id: 'roof', outcome: 'no_effect', fields: ['at_snap'] },
        { op: 'set', id: 'chimney', outcome: 'kept', share: 0.5, fields: ['at'] },
      ],
    }).join('\n');
    expect(text).toContain('no op raised the stage score');
    expect(text).toContain('set roof: made the score worse');
    expect(text).toContain('changed nothing (fields at_snap)');
    expect(text).toContain('overshot, kept at 50 %');
    expect(text).toContain('1 op(s) named parts outside this stage');
  });
});
