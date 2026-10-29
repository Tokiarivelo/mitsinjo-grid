import { applyPatch, patchInputUnchecked } from './patch';
import { SweepConfigSchema } from './schemas';
import type {
  Metrics,
  SimulationInput,
  StrategyId,
  SweepConfig,
  SweepPoint,
  SweepResult,
} from './schemas';
import { simulateSteps } from './simulate';

const DEFAULT_STRATEGIES: readonly StrategyId[] = ['proportional', 'essential_first', 'balanced'];

/**
 * Sweeps a parameter across a range [from, to] with a given step (≤ 20 points)
 * and returns the resulting metrics for each requested strategy.
 *
 * Pure function: does not mutate the input. Throws ZodError when a swept value makes the
 * input invalid (e.g. initialSocPct ≤ minSocPct).
 */
export function sweep(
  input: SimulationInput,
  rawConfig: SweepConfig,
  strategies?: readonly StrategyId[]
): SweepResult {
  const config = SweepConfigSchema.parse(rawConfig);
  const targetStrategies = strategies && strategies.length > 0 ? strategies : DEFAULT_STRATEGIES;

  const stepStr = config.step.toString();
  const decimals = stepStr.includes('.') ? (stepStr.split('.')[1]?.length ?? 0) : 0;

  // Same rule as the schema's point count; index-based so float steps never drift.
  const count = Math.floor((config.to - config.from) / config.step + 1e-9) + 1;
  const points: SweepPoint[] = [];

  const valueAt = (i: number) => Number((config.from + i * config.step).toFixed(decimals));

  // Every input constraint on one scalar is an interval, so validating both ends of the
  // range validates every point in between; interior points skip Zod to stay in budget.
  applyPatch(input, { [config.param]: valueAt(0) });
  applyPatch(input, { [config.param]: valueAt(count - 1) });

  for (let i = 0; i < count; i++) {
    const value = valueAt(i);
    const patched = patchInputUnchecked(input, { [config.param]: value });

    const metrics: Partial<Record<StrategyId, Metrics>> = {};
    for (const strat of targetStrategies) {
      metrics[strat] = simulateSteps(patched, strat).metrics;
    }

    points.push({ value, metrics: metrics as Record<StrategyId, Metrics> });
  }

  return points;
}
