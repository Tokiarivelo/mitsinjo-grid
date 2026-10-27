import type { SectorDemandStep } from '../model/demand';
import type { SectorId, SectorStep, StrategyId } from '../schemas';
import { runBalancedStrategy } from './balanced';
import { runEssentialFirstStrategy } from './essential-first';
import { runProportionalStrategy } from './proportional';

export * from './balanced';
export * from './essential-first';
export * from './proportional';

export function executeStrategy(
  strategy: StrategyId,
  availableKw: number,
  sectors: readonly SectorDemandStep[]
): Record<SectorId, SectorStep> {
  switch (strategy) {
    case 'proportional':
      return runProportionalStrategy(availableKw, sectors);
    case 'essential_first':
      return runEssentialFirstStrategy(availableKw, sectors);
    case 'balanced':
      return runBalancedStrategy(availableKw, sectors);
    default: {
      const _exhaustive: never = strategy;
      throw new Error(`Unsupported strategy: ${_exhaustive}`);
    }
  }
}
