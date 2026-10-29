import type { Comparison, SimulationInput, StrategyId } from './schemas';
import { simulate } from './simulate';

const DEFAULT_STRATEGIES: readonly StrategyId[] = ['proportional', 'essential_first', 'balanced'];

export function compare(input: SimulationInput, strategies?: readonly StrategyId[]): Comparison {
  const selected = strategies && strategies.length > 0 ? strategies : DEFAULT_STRATEGIES;
  const result: Partial<Comparison> = {};

  for (const strat of selected) {
    result[strat] = simulate(input, strat);
  }

  return result as Comparison;
}

export interface LifelineComparisonSummary {
  coveragePct: Partial<Record<StrategyId, number>>;
  maxCoveragePct: number;
  minCoveragePct: number;
  gainPct: number;
  bestStrategy: StrategyId | null;
}

/**
 * Evaluates lifeline coverage across compared strategies and exposes the maximum coverage gain (PL-T4).
 */
export function compareLifelineCoverage(comparison: Comparison): LifelineComparisonSummary {
  const entries = Object.entries(comparison) as [StrategyId, Comparison[StrategyId]][];
  const coveragePct: Partial<Record<StrategyId, number>> = {};
  let maxCoveragePct = -Infinity;
  let minCoveragePct = Infinity;
  let bestStrategy: StrategyId | null = null;

  for (const [strat, result] of entries) {
    if (!result) continue;
    const cov = result.metrics.lifelineCoveragePct;
    coveragePct[strat] = cov;
    if (cov > maxCoveragePct) {
      maxCoveragePct = cov;
      bestStrategy = strat;
    }
    if (cov < minCoveragePct) {
      minCoveragePct = cov;
    }
  }

  const valid = entries.length > 0 && maxCoveragePct !== -Infinity;
  return {
    coveragePct,
    maxCoveragePct: valid ? maxCoveragePct : 0,
    minCoveragePct: valid ? minCoveragePct : 0,
    gainPct: valid ? Math.max(0, maxCoveragePct - minCoveragePct) : 0,
    bestStrategy,
  };
}
