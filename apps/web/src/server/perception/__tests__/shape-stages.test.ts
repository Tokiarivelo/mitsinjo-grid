import { describe, expect, it, vi } from 'vitest';
import { fitRecipe, type ObjectRecipe, type RecipePart } from '@/lib/object-shape';
import { recipeToScript } from '@/lib/shape-script';
import {
  HOUSE_STAGES,
  type Proposer,
  type StageScorer,
  type StageSpec,
  houseStageScorer,
  runShapeStages,
} from '../shape-stages';
import { facadeHouseRecipe, measureElevation } from '../facade-house';
import { THATCHED_FRONT } from '../__fixtures__/elevation';

type S = 'massing' | 'roof';
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
const STAGES: StageSpec<S>[] = [
  { id: 'massing', kinds: ['wall'], gate: 0.99 },
  { id: 'roof', kinds: ['roof'], gate: 0.99 },
];
// Targets: walls 0.8 wide, ridge 0.9.
const find = (r: ObjectRecipe, k: string) => r.parts.find((p) => p.kind === k)!;
const score: StageScorer<S> = (r, stage) => {
  const m = 1 - Math.abs(find(r, 'wall').size[0] - 0.8);
  const f = 1 - Math.abs((find(r, 'roof').ridge ?? 0) - 0.9);
  return { stage: stage === 'massing' ? m : f, overall: (m + f) / 2 };
};
/** Scripted answers: `answers[stage][round - 1]`, empty patch when missing. */
const scripted =
  (answers: Partial<Record<S, unknown[][]>>): Proposer<S> =>
  async ({ stage, round }) =>
    answers[stage.id]?.[round - 1] ?? [];

describe('runShapeStages (PG-T16)', () => {
  it('keeps improving patches and stops a stage at its gate', async () => {
    const res = await runShapeStages({
      seed,
      stages: STAGES,
      score,
      budgetMs: 5_000,
      propose: scripted({
        massing: [
          [{ op: 'set', id: 'wall', size: [0.7, 0.6, 0.6] }],
          [{ op: 'set', id: 'wall', size: [0.8, 0.6, 0.6] }],
        ],
        roof: [[{ op: 'set', id: 'roof', ridge: 0.9 }]],
      }),
    });
    expect(res.stages.map((s) => [s.id, s.kept, s.stop])).toEqual([
      ['massing', 2, 'gate'],
      ['roof', 1, 'gate'],
    ]);
    expect(find(res.recipe, 'wall').size[0]).toBeCloseTo(0.8, 9);
    expect(res.overall.after).toBeGreaterThan(res.overall.before);
  });

  it('the score never goes down: a worse patch is dropped, the model kept', async () => {
    const res = await runShapeStages({
      seed,
      stages: STAGES,
      score,
      budgetMs: 5_000,
      propose: scripted({
        massing: [[{ op: 'set', id: 'wall', size: [0.3, 0.6, 0.6] }]],
        roof: [[{ op: 'set', id: 'roof', ridge: 0.1 }]],
      }),
    });
    expect(res.stages.map((s) => s.stop)).toEqual(['no_gain', 'no_gain']);
    expect(res.recipe.parts).toEqual([wall, roof]);
    expect(res.overall.after).toBe(res.overall.before);
  });

  it('locks hold: the roof stage cannot move the walls nor add a chimney', async () => {
    const res = await runShapeStages({
      seed,
      stages: [STAGES[1]!],
      score,
      budgetMs: 5_000,
      propose: scripted({
        roof: [
          [
            { op: 'set', id: 'wall', size: [0.8, 0.6, 0.6] },
            {
              op: 'add',
              id: 'chimney',
              part: { ...wall, front: undefined, kind: 'chimney', size: [0.05, 0.2, 0.05] },
            },
            { op: 'set', id: 'roof', ridge: 0.6 },
          ],
        ],
      }),
    });
    expect(find(res.recipe, 'wall').size[0]).toBe(0.6);
    expect(res.recipe.parts.some((p) => p.kind === 'chimney')).toBe(false);
    expect(find(res.recipe, 'roof').ridge).toBe(0.6);
    expect(res.stages[0]!.dropped).toBe(2);
  });

  it('out of time: returns the best so far, later stages keep the seed', async () => {
    let t = 0;
    const res = await runShapeStages({
      seed,
      stages: STAGES,
      score,
      budgetMs: 30,
      now: () => t,
      propose: async ({ stage }) => {
        if (stage.id === 'massing') {
          t = 40; // this answer lands after the budget's clock
          return [{ op: 'set', id: 'wall', size: [0.8, 0.6, 0.6] }];
        }
        return [{ op: 'set', id: 'roof', ridge: 0.9 }];
      },
    });
    expect(res.stages[0]!.kept).toBe(1);
    expect(res.stages[1]!.stop).toBe('timeout');
    expect(find(res.recipe, 'roof').ridge).toBe(0.3);
  });

  it('a hanging proposer is cut at the deadline', async () => {
    const res = await runShapeStages({
      seed,
      stages: STAGES,
      score,
      budgetMs: 30,
      propose: () => new Promise(() => {}),
    });
    expect(res.stages.map((s) => s.stop)).toEqual(['timeout', 'timeout']);
    expect(res.recipe.parts).toEqual([wall, roof]);
  });

  it('a failing proposer ends its stage; the next stage still runs', async () => {
    const res = await runShapeStages({
      seed,
      stages: STAGES,
      score,
      budgetMs: 5_000,
      propose: async ({ stage }) => {
        if (stage.id === 'massing') throw new Error('bad json');
        return [{ op: 'set', id: 'roof', ridge: 0.9 }];
      },
    });
    expect(res.stages.map((s) => s.stop)).toEqual(['error', 'gate']);
  });

  it('a stage already at its gate asks nothing; onStage reports each stage', async () => {
    const propose = vi.fn(scripted({}));
    const onStage = vi.fn();
    await runShapeStages({
      seed,
      stages: [{ id: 'massing', kinds: ['wall'], gate: 0.5 }, STAGES[1]!],
      score,
      budgetMs: 5_000,
      propose,
      onStage,
    });
    expect(propose).toHaveBeenCalledTimes(1);
    expect(propose.mock.calls[0]![0].stage.id).toBe('roof');
    expect(onStage.mock.calls.map((c) => c[0].id)).toEqual(['massing', 'roof']);
  });

  it('is deterministic for the same answers, and tells the proposer what it may edit', async () => {
    const answers = {
      massing: [[{ op: 'set', id: 'wall', size: [0.75, 0.6, 0.6] }]],
      roof: [[{ op: 'set', id: 'roof', ridge: 0.7 }], [{ op: 'set', id: 'roof', ridge: 0.8 }]],
    };
    const seen: string[][] = [];
    const run = () =>
      runShapeStages({
        seed,
        stages: STAGES,
        score,
        budgetMs: 5_000,
        propose: async (ctx) => {
          seen.push([...ctx.editable, '|', ...ctx.locked]);
          return scripted(answers)(ctx);
        },
      });
    const a = await run();
    const b = await run();
    expect(a.recipe).toEqual(b.recipe);
    expect(a.stages).toEqual(b.stages);
    expect(seen[0]).toEqual(['wall', '|', 'roof']);
    expect(seen.at(-1)).toEqual(['roof', '|', 'wall']);
  });
});

describe('houseStageScorer + HOUSE_STAGES on the thatched drawing', () => {
  it('scores the seed per stage and a worse roof lowers the roof stage', async () => {
    const g = THATCHED_FRONT;
    const front = measureElevation(g.masks)!;
    const built = fitRecipe(
      { ...facadeHouseRecipe({ front, side: null, colors: g.colors }), source: 'facade' },
      0
    );
    const scorer = houseStageScorer(front, g.masks.roof?.rings);
    const s = scorer(built, 'roof');
    expect(s.stage).toBeGreaterThan(0.6);
    expect(s.overall).toBeGreaterThan(0.8);
    // A patch that flattens the roof ridge is refused by the loop.
    const res = await runShapeStages({
      seed: recipeToScript(built),
      stages: HOUSE_STAGES.filter((st) => st.id === 'roof'),
      score: scorer,
      budgetMs: 5_000,
      propose: async () => [{ op: 'set', id: 'roof', ridge: 0 }],
    });
    expect(res.stages[0]!.stop).toMatch(/no_gain|gate/);
    expect(res.recipe).toEqual(built);
  });
});
