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
