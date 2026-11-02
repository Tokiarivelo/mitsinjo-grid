import type { ObjectRecipe, PartKind } from '@/lib/object-shape';
type Ring = ReadonlyArray<readonly [number, number]>;
import { type ElevationStage, scoreElevation } from './elevation-score';
import type { Elevation } from './facade-house';
import {
  type Component,
  type ComponentId,
  type OpIssue,
  type ShapeScript,
  compileScript,
} from '@/lib/shape-script';

/**
 * Staged agent loop (PG-T16): the model is improved one stage at a time (massing → roof →
 * openings → accessories). Per stage, up to `maxRounds` rounds: the proposer (Spark, PG-T15)
 * answers patch ops for the stage's components only, the engine compiles them, and the patch is
 * kept only if the stage score rises without lowering the overall score. A stage stops at its
 * gate, after a round without gain, at `maxRounds`, or when the shared time budget runs out (the
 * rest keeps the seed). Deterministic given the same proposer answers. Pure apart from the
 * injected proposer and clock.
 */

export interface StageSpec<S extends string = string> {
  id: S;
  /** Part kinds this stage may add or change; every other component is locked. */
  kinds: ReadonlyArray<PartKind>;
  /** Accept the stage at this score (0–1). */
  gate: number;
}

/** What one stage measures, from the recipe: its own score and the overall one (both 0–1). */
export type StageScorer<S extends string = string> = (
  recipe: ObjectRecipe,
  stage: S
) => { stage: number; overall: number };

export interface ProposeContext<S extends string = string> {
  stage: StageSpec<S>;
  round: number;
  recipe: ObjectRecipe;
  components: ReadonlyArray<Component>;
  /** Components the patch may touch (the stage's kinds). */
  editable: ReadonlyArray<ComponentId>;
  /** Components the patch must leave alone (accepted stages, other kinds). */
  locked: ReadonlyArray<ComponentId>;
  score: { stage: number; overall: number };
  signal: AbortSignal;
}

/** Answers patch ops for the stage (raw: compiled and checked here). */
export type Proposer<S extends string = string> = (ctx: ProposeContext<S>) => Promise<unknown[]>;

export type StageStop = 'gate' | 'no_gain' | 'rounds' | 'timeout' | 'error' | 'skipped';

export interface StageResult<S extends string = string> {
  id: S;
  before: number;
  after: number;
  rounds: number;
  /** Patches kept (score rose). */
  kept: number;
  stop: StageStop;
  /** Patch ops the compiler or the stage guard refused, all rounds. */
  dropped: number;
}

export interface StagesResult<S extends string = string> {
  script: ShapeScript;
  recipe: ObjectRecipe;
  stages: StageResult<S>[];
  overall: { before: number; after: number };
}

export interface RunStagesOptions<S extends string = string> {
  seed: ShapeScript;
  stages: ReadonlyArray<StageSpec<S>>;
  score: StageScorer<S>;
  propose: Proposer<S>;
  /** Shared time budget for every stage, ms. */
  budgetMs: number;
  maxRounds?: number;
  /** Clock (tests); defaults to `Date.now`. */
  now?: () => number;
  signal?: AbortSignal;
  /** Called after each stage ends, with the model at that point (progressive build, PG-T17). */
  onStage?: (result: StageResult<S>, recipe: ObjectRecipe, index: number) => void;
}

/** Most rounds per stage. */
export const STAGE_ROUNDS = 3;
/** A patch must raise the stage score by at least this much to be kept. */
export const STAGE_MIN_GAIN = 0.005;

/** Stages of a house built from its elevation (scores from `scoreElevation().stages`). */
export const HOUSE_STAGES: ReadonlyArray<
  StageSpec<'massing' | 'roof' | 'openings' | 'accessories'>
> = [
  { id: 'massing', kinds: ['wall', 'plinth'], gate: 0.95 },
  { id: 'roof', kinds: ['roof'], gate: 0.9 },
  { id: 'openings', kinds: ['window', 'door'], gate: 0.9 },
  { id: 'accessories', kinds: ['chimney', 'step'], gate: 0.8 },
];

const kindOfOp = (op: unknown): PartKind | 'unknown' | null => {
  if (!op || typeof op !== 'object') return null;
  const o = op as { op?: unknown; kind?: unknown; part?: { kind?: unknown } };
  if (o.op === 'cut') return typeof o.kind === 'string' ? (o.kind as PartKind) : 'unknown';
  if (o.op === 'add')
    return typeof o.part?.kind === 'string' ? (o.part.kind as PartKind) : 'unknown';
  return null;
};

/** Patch ops that create components outside the stage's kinds are refused before compiling. */
function guardPatch(ops: unknown[], kinds: ReadonlyArray<PartKind>) {
  const kept: unknown[] = [];
  let refused = 0;
  for (const op of ops) {
    const k = kindOfOp(op);
    if (k !== null && (k === 'unknown' || !kinds.includes(k))) refused++;
    else kept.push(op);
  }
  return { kept, refused };
}

/** Rejects after `ms`, or when `signal` aborts; the timer never outlives the race. */
function withDeadline<T>(p: Promise<T>, ms: number, signal: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    if (signal.aborted) return reject(new Error('aborted'));
    const timer = setTimeout(() => reject(new Error('timeout')), Math.max(0, ms));
    const onAbort = () => {
      clearTimeout(timer);
      reject(new Error('aborted'));
    };
    signal.addEventListener('abort', onAbort, { once: true });
    p.then(
      (v) => {
        clearTimeout(timer);
        signal.removeEventListener('abort', onAbort);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        signal.removeEventListener('abort', onAbort);
        reject(e);
      }
    );
  });
}

export async function runShapeStages<S extends string>({
  seed,
  stages,
  score,
  propose,
  budgetMs,
  maxRounds = STAGE_ROUNDS,
  now = Date.now,
  signal,
  onStage,
}: RunStagesOptions<S>): Promise<StagesResult<S>> {
  const deadline = now() + budgetMs;
  const first = compileScript(seed);
  if (!first.recipe) throw new Error('seed script compiles to nothing');
  let script: ShapeScript = { ...seed, ops: [...seed.ops] };
  let recipe = first.recipe;
  let components = first.components;
  const overallBefore = score(recipe, stages[0]?.id as S).overall;
  const results: StageResult<S>[] = [];
  const ctrl = new AbortController();
  const onParentAbort = () => ctrl.abort();
  signal?.addEventListener('abort', onParentAbort, { once: true });
  let outOfTime = false;

  try {
    for (const [index, stage] of stages.entries()) {
      let current = score(recipe, stage.id);
      const result: StageResult<S> = {
        id: stage.id,
        before: current.stage,
        after: current.stage,
        rounds: 0,
        kept: 0,
        stop: 'rounds',
        dropped: 0,
      };
      if (outOfTime || signal?.aborted) {
        result.stop = outOfTime ? 'timeout' : 'skipped';
      } else if (current.stage >= stage.gate) {
        result.stop = 'gate';
      } else {
        for (let round = 1; round <= maxRounds; round++) {
          const left = deadline - now();
          if (left <= 0) {
            outOfTime = true;
            result.stop = 'timeout';
            break;
          }
          const editable = components
            .filter((c) => c.part.kind && stage.kinds.includes(c.part.kind))
            .map((c) => c.id);
          const locked = components.map((c) => c.id).filter((id) => !editable.includes(id));
          result.rounds = round;
          let raw: unknown[];
          try {
            raw = await withDeadline(
              propose({
                stage,
                round,
                recipe,
                components,
                editable,
                locked,
                score: current,
                signal: ctrl.signal,
              }),
              left,
              ctrl.signal
            );
          } catch (err) {
            const timeout = err instanceof Error && err.message === 'timeout';
            if (timeout) outOfTime = true;
            result.stop = timeout ? 'timeout' : signal?.aborted ? 'skipped' : 'error';
            break;
          }
          const { kept: patch, refused } = guardPatch(Array.isArray(raw) ? raw : [], stage.kinds);
          const next: ShapeScript = { ...script, ops: [...script.ops, ...patch] };
          const out = compileScript(next, {
            locked: new Set(locked),
            lockedFrom: script.ops.length,
          });
          result.dropped += refused + countPatchDrops(out.dropped, script.ops.length);
          const after = out.recipe ? score(out.recipe, stage.id) : null;
          if (
            out.recipe &&
            after &&
            after.stage >= current.stage + STAGE_MIN_GAIN &&
            after.overall >= current.overall
          ) {
            script = next;
            recipe = out.recipe;
            components = out.components;
            current = after;
            result.kept++;
            result.after = after.stage;
            if (after.stage >= stage.gate) {
              result.stop = 'gate';
              break;
            }
          } else {
            result.stop = 'no_gain';
            break;
          }
        }
      }
      results.push(result);
      onStage?.(result, recipe, index);
    }
  } finally {
    ctrl.abort();
    signal?.removeEventListener('abort', onParentAbort);
  }
  return {
    script,
    recipe,
    stages: results,
    overall: { before: overallBefore, after: score(recipe, stages[0]?.id as S).overall },
  };
}

const countPatchDrops = (dropped: ReadonlyArray<OpIssue>, from: number) =>
  dropped.filter((d) => d.index >= from).length;

/**
 * House stage scorer: the recipe's front elevation against the measured drawing (PG-T2), stage
 * share from `stages`, overall = elevation score / 100.
 */
export function houseStageScorer(
  front: Elevation,
  roofRings?: ReadonlyArray<Ring>
): StageScorer<ElevationStage> {
  return (recipe, stage) => {
    const s = scoreElevation(recipe, front, roofRings ? { roofRings } : {});
    return { stage: s.stages[stage], overall: s.score / 100 };
  };
}
