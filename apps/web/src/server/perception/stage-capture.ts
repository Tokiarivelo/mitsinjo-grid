import 'server-only';

import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { ObjectRecipeSchema, SHAPE_STAGE_IDS, type ObjectRecipe } from '@/lib/object-shape';
import { recipeToScript } from '@/lib/shape-script';
import type { ElevationStage } from './elevation-score';
import type { Elevation } from './facade-house';
import { SHAPE_SCRIPT_PROMPT_VERSION } from './shape-script-prompt';
import {
  HOUSE_STAGES,
  type Proposer,
  type StageStop,
  houseCanEdit,
  houseStageScorer,
  runShapeStages,
} from './shape-stages';

/**
 * Stage replay (PG-T22): one live run of the staged loop frozen to a file — the seed model, the
 * measured drawing and each Spark answer by stage and round — so the loop can be replayed offline
 * (`make eval-stages`, no API cost) to compare prompt versions and scorer changes. No energy values.
 */

const NormBoxSchema = z.object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() });
const RingSchema = z.array(z.tuple([z.number(), z.number()]));

/** The measured elevation (`measureElevation` output), as plain JSON. */
const ElevationSchema = z.object({
  aspect: z.number(),
  left: z.number(),
  right: z.number(),
  wallLeft: z.number(),
  wallRight: z.number(),
  top: z.number(),
  eave: z.number(),
  bottom: z.number(),
  ridge: z.number().nullable(),
  windows: z.array(NormBoxSchema),
  doors: z.array(NormBoxSchema),
  chimneys: z.array(NormBoxSchema),
  plinth: NormBoxSchema.nullable(),
  steps: z.array(NormBoxSchema),
  panes: z.array(NormBoxSchema),
  beams: z.array(NormBoxSchema),
  roofRings: z.array(RingSchema).optional(),
});

export const StageAnswerSchema = z.object({
  stage: z.enum(SHAPE_STAGE_IDS),
  round: z.number().int().min(1),
  /** Spark's raw ops (null = unusable answer). */
  ops: z.array(z.unknown()).nullable(),
  seconds: z.number().min(0),
});
export type StageAnswer = z.infer<typeof StageAnswerSchema>;

export const StageCaptureSchema = z.object({
  version: z.literal(1),
  id: z.string().min(1).max(64),
  capturedAt: z.string(),
  model: z.string(),
  promptVersion: z.number().int(),
  label: z.string(),
  front: ElevationSchema,
  seed: ObjectRecipeSchema,
  answers: z.array(StageAnswerSchema),
});
export type StageCapture = z.infer<typeof StageCaptureSchema>;

/** Stage and round named by a stage question (« Stage: roof (round 2). »), else null. */
export function stageOfQuestion(q: string): { stage: ElevationStage; round: number } | null {
  const m = /Stage: (\w+) \(round (\d+)\)/.exec(q);
  if (!m || !(SHAPE_STAGE_IDS as readonly string[]).includes(m[1]!)) return null;
  return { stage: m[1] as ElevationStage, round: Number(m[2]) };
}

type ProposeShapeOps<R extends { ops: unknown[] | null }> = (
  imageUrl: string,
  question: string,
  signal?: AbortSignal
) => Promise<R>;

/** Wraps `proposeShapeOps`: every answer is also pushed to `answers` (stage + round + latency). */
export function recordingProposeShapeOps<R extends { ops: unknown[] | null }>(
  fn: ProposeShapeOps<R>,
  answers: StageAnswer[],
  now: () => number = Date.now
): ProposeShapeOps<R> {
  return async (imageUrl, question, signal) => {
    const t0 = now();
    const res = await fn(imageUrl, question, signal);
    const at = stageOfQuestion(question);
    if (at) answers.push({ ...at, ops: res.ops, seconds: Math.max(0, (now() - t0) / 1000) });
    return res;
  };
}

/** A proposer answering from the capture (same stage + round), empty patch when none. */
export function replayProposer(answers: ReadonlyArray<StageAnswer>): Proposer<ElevationStage> {
  return async (ctx) =>
    answers.find((a) => a.stage === ctx.stage.id && a.round === ctx.round)?.ops ?? [];
}

export interface StageReplayRow {
  id: string;
  promptVersion: number;
  stages: Array<{
    id: ElevationStage;
    before: number;
    after: number;
    kept: number;
    stop: StageStop;
  }>;
  overall: { before: number; after: number };
  /** Ops answered, and ops the compiler or patch guard dropped. */
  ops: number;
  dropped: number;
}

/** Offline replay budget: answers come from the file, so this only guards a stuck scorer. */
export const REPLAY_BUDGET_MS = 10 * 60_000;

/** Replays one capture through the house runner (deterministic). */
export async function replayStageCapture(c: StageCapture): Promise<{
  row: StageReplayRow;
  recipe: ObjectRecipe;
}> {
  const front = c.front as Elevation;
  const res = await runShapeStages({
    seed: recipeToScript(c.seed),
    stages: HOUSE_STAGES,
    score: houseStageScorer(front, front.roofRings),
    propose: replayProposer(c.answers),
    canEdit: houseCanEdit,
    budgetMs: REPLAY_BUDGET_MS,
  });
  return {
    recipe: res.recipe,
    row: {
      id: c.id,
      promptVersion: c.promptVersion,
      stages: res.stages.map((s) => ({
        id: s.id,
        before: s.before,
        after: s.after,
        kept: s.kept,
        stop: s.stop,
      })),
      overall: res.overall,
      ops: c.answers.reduce((n, a) => n + (a.ops?.length ?? 0), 0),
      dropped: res.stages.reduce((n, s) => n + s.dropped, 0),
    },
  };
}

const pct = (v: number) => Math.round(v * 100);

/** Markdown table of replayed captures (one row each, per-stage before → after). */
export function stageReplayMarkdown(rows: ReadonlyArray<StageReplayRow>): string {
  const head = `| capture | prompt | ${HOUSE_STAGES.map((s) => s.id).join(' | ')} | overall | ops (dropped) |`;
  const sep = `|${' --- |'.repeat(HOUSE_STAGES.length + 4)}`;
  const body = rows.map((r) => {
    const cells = HOUSE_STAGES.map((st) => {
      const s = r.stages.find((x) => x.id === st.id);
      return s ? `${pct(s.before)}→${pct(s.after)} ${s.stop}${s.kept ? ` +${s.kept}` : ''}` : '–';
    });
    return `| ${r.id} | v${r.promptVersion} | ${cells.join(' | ')} | ${pct(r.overall.before)}→${pct(r.overall.after)} | ${r.ops} (${r.dropped}) |`;
  });
  return [head, sep, ...body].join('\n');
}

/** New capture from a live run (the seed without its photo swatches). */
export function newStageCapture(input: {
  id: string;
  model: string;
  label: string;
  front: Elevation;
  seed: ObjectRecipe;
  answers: StageAnswer[];
  now?: Date;
}): StageCapture {
  const seed: ObjectRecipe = { ...input.seed };
  delete seed.swatches;
  return StageCaptureSchema.parse({
    version: 1,
    id: input.id,
    capturedAt: (input.now ?? new Date()).toISOString(),
    model: input.model,
    promptVersion: SHAPE_SCRIPT_PROMPT_VERSION,
    label: input.label,
    front: input.front,
    seed,
    answers: input.answers,
  });
}

export const STAGE_CAPTURE_SUFFIX = '.stages.json';

export function writeStageCapture(dir: string, c: StageCapture): string {
  const path = join(dir, `${c.id}${STAGE_CAPTURE_SUFFIX}`);
  writeFileSync(path, `${JSON.stringify(c, null, 2)}\n`);
  return path;
}

/** Every valid stage capture in `dir` (bad files skipped with a warning). */
export function readStageCaptures(dir: string): StageCapture[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith(STAGE_CAPTURE_SUFFIX))
    .sort()
    .flatMap((f) => {
      const parsed = StageCaptureSchema.safeParse(JSON.parse(readFileSync(join(dir, f), 'utf8')));
      if (parsed.success) return [parsed.data];
      console.warn(`[vision] stage capture ${f} skipped:`, parsed.error.issues[0]?.message);
      return [];
    });
}
