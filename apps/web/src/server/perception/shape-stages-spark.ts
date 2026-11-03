import sharp from 'sharp';
import type { ObjectRecipe, ShapeStageEvent, ShapeStageId } from '@/lib/object-shape';
import { recipeToScript } from '@/lib/shape-script';
import {
  type ElevationStage,
  type ScoredElevation,
  elevationDiff,
  scoreElevation,
} from './elevation-score';
import type { Elevation } from './facade-house';
import { stageQuestion } from './shape-script-prompt';
import {
  HOUSE_STAGES,
  STAGE_MIN_MS,
  type Proposer,
  type StageResult,
  type StageSpec,
  houseCanEdit,
  houseStageScorer,
  runShapeStages,
} from './shape-stages';

/**
 * Spark as the stage proposer (PG-T15): builds the stage sheet (drawing | model | diff), asks
 * `proposeShapeOps`, and hands the raw ops to the runner (which compiles and scores them).
 */

type Ring = ReadonlyArray<readonly [number, number]>;

/** Grey levels of the drawing's concepts when no drawing image is at hand (label map). */
const LABEL_GREY = [200, 160, 120, 70, 90, 30];
/** Tiles are drawn at this zoom (nearest), so Spark sees the 128-row grids crisp. */
const SHEET_ZOOM = 3;

/** Plain measured hints for the question (openings drawn vs built, per-concept IoU). */
export function stageNotes(s: ScoredElevation): string[] {
  const o = s.openings;
  const concepts = Object.entries(s.concepts)
    .map(([k, v]) => `${k} ${Math.round((v ?? 0) * 100)} %`)
    .join(', ');
  return [
    `openings ${o.target} drawn, ${o.render} built, ${o.matched} matched`,
    ...(concepts ? [`overlap per part: ${concepts}`] : []),
  ];
}

/**
 * Drawing | model | diff (JPEG data URL). The drawing tile is the validated elevation image
 * resized to the score grid, else the label map read on it. Never throws: null on failure.
 */
export async function stageSheet(
  recipe: ObjectRecipe,
  s: ScoredElevation,
  drawing: Buffer | null
): Promise<string | null> {
  try {
    const { cols, rows, label } = s.target;
    const [w, h] = [cols * SHEET_ZOOM, rows * SHEET_ZOOM];
    const raw = (b: Buffer) =>
      sharp(b, { raw: { width: cols, height: rows, channels: 3 } })
        .resize(w, h, { kernel: 'nearest' })
        .png()
        .toBuffer();
    const labels = Buffer.alloc(cols * rows * 3, 255);
    label.forEach((v, i) => {
      if (v >= 0) labels.fill(LABEL_GREY[v]!, i * 3, i * 3 + 3);
    });
    const built = Buffer.from(s.render.rgb);
    s.render.mask.data.forEach((v, i) => {
      if (!v) built.fill(255, i * 3, i * 3 + 3);
    });
    const tiles = await Promise.all([
      drawing
        ? sharp(drawing).resize(w, h).flatten({ background: '#ffffff' }).png().toBuffer()
        : raw(labels),
      raw(built),
      raw(Buffer.from(elevationDiff(recipe, s).rgb)),
    ]);
    const jpg = await sharp({
      create: { width: w * 3, height: h, channels: 3, background: '#ffffff' },
    })
      .composite(tiles.map((input, i) => ({ input, left: i * w, top: 0 })))
      .jpeg({ quality: 85 })
      .toBuffer();
    return `data:image/jpeg;base64,${jpg.toString('base64')}`;
  } catch (err) {
    console.warn('[vision] 3D stage sheet failed:', err instanceof Error ? err.message : err);
    return null;
  }
}

export interface SparkStageInput {
  /** `perception.proposeShapeOps` bound to its backend. */
  proposeShapeOps: (
    imageUrl: string,
    question: string,
    signal?: AbortSignal
  ) => Promise<{ result: { ops: unknown[] | null } }>;
  front: Elevation;
  roofRings?: ReadonlyArray<Ring>;
  /** The validated front drawing (PNG / JPEG bytes), when at hand. */
  drawing: Buffer | null;
  label: string;
}

/** A runner proposer that asks Spark for each stage round; empty patch when unusable. */
export function sparkStageProposer(input: SparkStageInput): Proposer<ElevationStage> {
  return async (ctx) => {
    const scored = scoreElevation(
      ctx.recipe,
      input.front,
      input.roofRings ? { roofRings: input.roofRings } : {}
    );
    const sheet = await stageSheet(ctx.recipe, scored, input.drawing);
    if (!sheet) return [];
    const question = stageQuestion({
      label: input.label,
      stage: ctx.stage.id,
      round: ctx.round,
      score: ctx.score,
      components: ctx.components,
      editable: ctx.editable,
      notes: stageNotes(scored),
    });
    const { result } = await input.proposeShapeOps(sheet, question, ctx.signal);
    return result.ops ?? [];
  };
}

/** One stage event of the facade loop, as streamed (`shape_stage`, without the job id). */
export type StageProgress = Omit<ShapeStageEvent, 'jobId'>;

/** The stages left after the first answer, to run in the background (PG-T18). */
export interface StagesContinuation {
  total: number;
  /** Stage ids still to run. */
  stages: ShapeStageId[];
  run(opts: {
    budgetMs: number;
    signal?: AbortSignal;
    onProgress: (e: StageProgress) => void;
  }): Promise<{ recipe: ObjectRecipe; cause?: 'timeout' | 'error' | 'aborted' }>;
}

export interface FacadeLoopInput extends Omit<SparkStageInput, 'drawing'> {
  recipe: ObjectRecipe;
  /** Fetched once, on the first round that needs it. */
  drawing: () => Promise<Buffer | null>;
  /** Time left for the first answer's stages (ms); below `STAGE_MIN_MS` every stage waits. */
  firstBudgetMs: number;
  signal?: AbortSignal;
  onProgress?: (e: StageProgress) => void;
}

/**
 * The facade house loop (PG-T16…T18): stages that fit the first answer's budget run now; the
 * others come back as a continuation for the background. Swatches and dimension statuses of
 * the built model are kept on every staged model.
 */
export async function facadeStageLoop(input: FacadeLoopInput): Promise<{
  recipe: ObjectRecipe;
  rest: StagesContinuation | null;
}> {
  const total = HOUSE_STAGES.length;
  const keep = (r: ObjectRecipe): ObjectRecipe => ({
    ...r,
    ...(input.recipe.swatches ? { swatches: input.recipe.swatches } : {}),
    ...(input.recipe.dimStatus ? { dimStatus: input.recipe.dimStatus } : {}),
  });
  let drawing: Promise<Buffer | null> | null = null;
  const propose: Proposer<ElevationStage> = async (ctx) => {
    drawing ??= input.drawing().catch(() => null);
    return sparkStageProposer({ ...input, drawing: await drawing })(ctx);
  };
  const score = houseStageScorer(input.front, input.roofRings);
  const position = (id: ElevationStage) => HOUSE_STAGES.findIndex((st) => st.id === id) + 1;
  const stream = (phase: StageProgress['phase'], emit?: (e: StageProgress) => void) => ({
    onStageStart: (st: { id: ElevationStage }) =>
      emit?.({ phase, index: position(st.id), total, stage: st.id, state: 'running' }),
    onStage: (res: StageResult<ElevationStage>, recipe: ObjectRecipe) => {
      if (res.stop === 'timeout' || res.stop === 'skipped') return;
      emit?.({
        phase,
        index: position(res.id),
        total,
        stage: res.id,
        state: 'done',
        before: clamp01(res.before),
        after: clamp01(res.after),
        stop: res.stop,
        ...(res.kept ? { recipe: keep(recipe) } : {}),
      });
    },
  });
  let recipe = input.recipe;
  let remaining: ReadonlyArray<StageSpec<ElevationStage>> = HOUSE_STAGES;
  if (input.firstBudgetMs >= STAGE_MIN_MS) {
    const first = await runShapeStages({
      seed: recipeToScript(recipe),
      stages: HOUSE_STAGES,
      score,
      canEdit: houseCanEdit,
      propose,
      budgetMs: input.firstBudgetMs,
      ...(input.signal ? { signal: input.signal } : {}),
      ...stream('first', input.onProgress),
    });
    recipe = keep(first.recipe);
    remaining = HOUSE_STAGES.filter((_, i) => {
      const stop = first.stages[i]?.stop;
      return stop === 'timeout' || stop === 'skipped';
    });
  }
  if (!remaining.length) return { recipe, rest: null };
  const seed = recipe;
  return {
    recipe,
    rest: {
      total,
      stages: remaining.map((st) => st.id),
      run: async ({ budgetMs, signal, onProgress }) => {
        try {
          const res = await runShapeStages({
            seed: recipeToScript(seed),
            stages: remaining,
            score,
            canEdit: houseCanEdit,
            propose,
            budgetMs,
            ...(signal ? { signal } : {}),
            ...stream('background', onProgress),
          });
          const cause = signal?.aborted
            ? ('aborted' as const)
            : res.stages.some((st) => st.stop === 'timeout')
              ? ('timeout' as const)
              : undefined;
          return { recipe: keep(res.recipe), ...(cause ? { cause } : {}) };
        } catch (err) {
          console.warn(
            '[vision] 3D background stages failed:',
            err instanceof Error ? err.message : err
          );
          return { recipe: seed, cause: 'error' };
        }
      },
    },
  };
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, Number.isFinite(v) ? v : 0));
