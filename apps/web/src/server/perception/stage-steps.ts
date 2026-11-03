import type { ObjectRecipe } from '@/lib/object-shape';
import {
  compileScript,
  type CompileResult,
  type Component,
  type ShapeScript,
} from '@/lib/shape-script';

/**
 * Micro-steps of one stage round (no `no_gain` for one bad op): Spark's patch is split into its
 * ops, each tried on its own and, for a `set` that moves or resizes a part, also at a half and a
 * quarter step (Spark often aims right but overshoots). Ops that raise the stage score are kept,
 * greedily in Spark's order; the whole patch as sent is tried too (ops that only work together).
 * Pure and local: no extra model call, one compile + score per try.
 */

/** Step shares tried for a `set` with `at` or `size`: full, half, quarter. */
export const STAGE_STEP_SHARES = [1, 0.5, 0.25] as const;
/** Most candidate models scored per round (≈ 25 ms each for a house elevation). */
export const STAGE_MAX_TRIES = 40;

export type OpOutcome = 'kept' | 'worse' | 'no_effect' | 'dropped';

/** What one op of the patch did, for the log and the next round's feedback. */
export interface OpTrial {
  op: string;
  id?: string;
  outcome: OpOutcome;
  /** Step share kept (`kept` only, < 1 = the op overshot). */
  share?: number;
  /** Compiler reason (`dropped` only). */
  reason?: string;
  /** Fields the op carried (a `set` with no usable field changes nothing). */
  fields: string[];
}

export interface StepScore {
  stage: number;
  overall: number;
}

export interface MicroPatchInput {
  script: ShapeScript;
  patch: ReadonlyArray<unknown>;
  locked: ReadonlySet<string>;
  components: ReadonlyArray<Component>;
  current: StepScore;
  score: (recipe: ObjectRecipe) => StepScore;
}

export interface MicroPatchResult {
  /** Ops to append (empty = nothing helped). */
  ops: unknown[];
  out: CompileResult | null;
  after: StepScore;
  trials: OpTrial[];
  /** Patch ops the compiler refused. */
  dropped: number;
}

const EPS = 1e-6;
const better = (a: StepScore, b: StepScore) =>
  a.stage > b.stage + EPS && a.overall >= b.overall - EPS;
const round4 = (v: number) => Math.round(v * 1e4) / 1e4;

const isVec3 = (v: unknown): v is [number, number, number] =>
  Array.isArray(v) && v.length === 3 && v.every((n) => typeof n === 'number' && Number.isFinite(n));

const describe = (op: unknown) => {
  const o = (op && typeof op === 'object' ? op : {}) as Record<string, unknown>;
  return {
    op: typeof o.op === 'string' ? o.op : '?',
    ...(typeof o.id === 'string' ? { id: o.id } : {}),
    fields: Object.keys(o).filter((k) => k !== 'op' && k !== 'id'),
  };
};

/** The op at each step share (a `set` moving or resizing a known part), else the op alone. */
export function stepVariants(
  op: unknown,
  components: ReadonlyArray<Component>
): Array<{ op: unknown; share: number }> {
  const o = op as Record<string, unknown> | null;
  if (!o || o.op !== 'set' || !(isVec3(o.at) || isVec3(o.size))) return [{ op, share: 1 }];
  const cur = components.find((c) => c.id === o.id)?.part;
  if (!cur) return [{ op, share: 1 }];
  const mix = (from: readonly number[], to: [number, number, number], f: number) =>
    to.map((v, i) => round4(from[i]! + f * (v - from[i]!)));
  return STAGE_STEP_SHARES.map((share) =>
    share === 1
      ? { op, share }
      : {
          op: {
            ...o,
            ...(isVec3(o.at) ? { at: mix(cur.at, o.at, share) } : {}),
            ...(isVec3(o.size) ? { size: mix(cur.size, o.size, share) } : {}),
          },
          share,
        }
  );
}

export function microPatch({
  script,
  patch,
  locked,
  components,
  current,
  score,
}: MicroPatchInput): MicroPatchResult {
  const from = script.ops.length;
  let tries = 0;
  const run = (ops: ReadonlyArray<unknown>) => {
    tries++;
    const out = compileScript(
      { ...script, ops: [...script.ops, ...(ops as ShapeScript['ops'])] },
      { locked: new Set(locked), lockedFrom: from }
    );
    return { out, s: out.recipe ? score(out.recipe) : null };
  };
  const none: MicroPatchResult = { ops: [], out: null, after: current, trials: [], dropped: 0 };
  if (!patch.length) return none;

  // The patch as sent (ops that depend on each other, e.g. `add` then `attach`).
  const whole = run(patch);
  const wholeDropped = whole.out.dropped.filter((d) => d.index >= from).length;

  // Greedy, op by op, best step share first.
  let accepted: unknown[] = [];
  let base: { out: CompileResult | null; s: StepScore } = { out: null, s: current };
  const trials: OpTrial[] = [];
  for (const op of patch) {
    const at = from + accepted.length;
    let best: { out: CompileResult; s: StepScore; op: unknown; share: number } | null = null;
    let reason: string | undefined;
    let worse = false;
    for (const v of stepVariants(op, components)) {
      if (tries >= STAGE_MAX_TRIES) break;
      const e = run([...accepted, v.op]);
      const drop = e.out.dropped.find((d) => d.index === at);
      if (drop) {
        reason = drop.reason;
        // A smaller step can bring a part back inside its bounds; any other refusal stays.
        if (drop.reason !== 'out_of_bounds') break;
        continue;
      }
      if (!e.s) continue;
      if (better(e.s, best?.s ?? base.s)) best = { out: e.out, s: e.s, op: v.op, share: v.share };
      else if (e.s.stage < base.s.stage - EPS || e.s.overall < base.s.overall - EPS) worse = true;
    }
    const d = describe(op);
    if (best) {
      accepted = [...accepted, best.op];
      base = { out: best.out, s: best.s };
      trials.push({ ...d, outcome: 'kept', share: best.share });
    } else if (reason) {
      trials.push({ ...d, outcome: 'dropped', reason });
    } else {
      trials.push({ ...d, outcome: worse ? 'worse' : 'no_effect' });
    }
  }
  const dropped = trials.filter((t) => t.outcome === 'dropped').length;

  if (whole.s && whole.out.recipe && better(whole.s, base.s)) {
    return {
      ops: [...patch],
      out: whole.out,
      after: whole.s,
      trials: patch.map((op) => ({ ...describe(op), outcome: 'kept' as const, share: 1 })),
      dropped: wholeDropped,
    };
  }
  if (!accepted.length) return { ...none, trials, dropped };
  return { ops: accepted, out: base.out, after: base.s, trials, dropped };
}

/** One log fragment: `set roof ½ ✓, repeat step ✗ worse, set roof – no_effect (at_nudge)`. */
export function trialsLog(trials: ReadonlyArray<OpTrial>): string {
  return trials
    .map((t) => {
      const name = `${t.op}${t.id ? ` ${t.id}` : ''}`;
      if (t.outcome === 'kept') return `${name} kept${t.share !== 1 ? ` ×${t.share}` : ''}`;
      if (t.outcome === 'dropped') return `${name} dropped (${t.reason})`;
      if (t.outcome === 'no_effect')
        return `${name} no effect (${t.fields.join(', ') || 'no field'})`;
      return `${name} worse`;
    })
    .join(', ');
}
