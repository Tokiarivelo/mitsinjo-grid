import { compare } from './compare';
import type { SimulationInput, StrategyId } from './schemas';

/** The three strategies every benchmark compares, in report order. */
export const BENCH_STRATEGIES: readonly StrategyId[] = [
  'proportional',
  'essential_first',
  'balanced',
];

/** Rounded per-strategy outcome, as published in `benchmarks/engine.json`. */
export interface StrategyOutcome {
  healthCoveragePct: number;
  criticalCoveragePct: number;
  criticalUnmetHours: number;
  unservedKwh: number;
  violations: number;
}

const round = (n: number, d: number) => Math.round(n * 10 ** d) / 10 ** d;

/** Runs the three strategies on one input and returns the outcome rows the benchmark report publishes. */
export function strategyOutcomes(input: SimulationInput): Record<StrategyId, StrategyOutcome> {
  const cmp = compare(input, BENCH_STRATEGIES);
  return Object.fromEntries(
    BENCH_STRATEGIES.map((s) => {
      const m = cmp[s as keyof typeof cmp]!.metrics;
      const o: StrategyOutcome = {
        healthCoveragePct: round(m.perSector.health?.coveragePct ?? 100, 1),
        criticalCoveragePct: round(m.criticalCoveragePct, 1),
        criticalUnmetHours: m.criticalUnmetHours,
        unservedKwh: round(m.unservedKwh, 2),
        violations: m.violations,
      };
      return [s, o];
    })
  ) as Record<StrategyId, StrategyOutcome>;
}
