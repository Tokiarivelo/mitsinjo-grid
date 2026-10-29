import type { SectorDemandStep } from '../model/demand';
import type { Priority, SectorCap, SectorId, SectorStep, StrategyId } from '../schemas';
import { runBalancedStrategy } from './balanced';
import { runEssentialFirstStrategy } from './essential-first';
import {
  type BaseSectorStep,
  computeLifelinePass,
  computeSectorMode,
  effectiveFloorKw,
  resolveLifelineKw,
} from './lifeline';
import { runProportionalStrategy } from './proportional';

export * from './balanced';
export * from './essential-first';
export * from './lifeline';
export * from './proportional';

function runBaseStrategy(
  strategy: StrategyId,
  availableKw: number,
  sectors: readonly SectorDemandStep[],
  weights?: Record<Priority, number>
): Record<SectorId, BaseSectorStep> {
  switch (strategy) {
    case 'proportional':
      return runProportionalStrategy(availableKw, sectors);
    case 'essential_first':
      return runEssentialFirstStrategy(availableKw, sectors);
    case 'balanced':
      return runBalancedStrategy(availableKw, sectors, weights);
    default: {
      const _exhaustive: never = strategy;
      throw new Error(`Unsupported strategy: ${_exhaustive}`);
    }
  }
}

/**
 * Runs Pass 0 (lifeline floors, PL-T2) then the selected strategy on what is left, and returns the
 * full sector steps (`lifelineServedKw`, `mode`). With `lifelineEnabled = false`, the strategy runs
 * alone and the result matches the pre-lifeline engine (floor 0 for `mode`).
 */
export function executeStrategy(
  strategy: StrategyId,
  availableKw: number,
  sectors: readonly SectorDemandStep[],
  weights?: Record<Priority, number>,
  lifelineEnabled: boolean = true,
  activeCaps?: readonly SectorCap[]
): Record<SectorId, SectorStep> {
  const result = {} as Record<SectorId, SectorStep>;

  if (!lifelineEnabled) {
    const raw = runBaseStrategy(strategy, availableKw, sectors, weights);
    for (const s of sectors) {
      const step = raw[s.sectorId]!;
      result[s.sectorId] = {
        ...step,
        lifelineServedKw: 0,
        mode: computeSectorMode(step.servedKw, step.demandKw, 0),
      };
    }
    return result;
  }

  const pass0 = computeLifelinePass(availableKw, sectors, activeCaps);

  // Emergency mode: Pass 0 used all available power.
  // Normal mode: the strategy shares what is left, on demand reduced by the floor already served.
  const sub = pass0.isEmergency
    ? null
    : runBaseStrategy(
        strategy,
        pass0.remainingKw,
        sectors.map((s) => {
          const floorAlloc = pass0.allocations[s.sectorId] ?? 0;
          const demandKw = Math.max(0, s.demandKw - floorAlloc);
          const criticalDemandKw = Math.max(
            0,
            s.criticalDemandKw - Math.min(floorAlloc, s.criticalDemandKw)
          );
          return {
            ...s,
            demandKw,
            criticalDemandKw,
            criticalShare: demandKw > 0 ? criticalDemandKw / demandKw : 0,
          };
        }),
        weights
      );

  for (const s of sectors) {
    const floorAlloc = pass0.allocations[s.sectorId] ?? 0;
    const extra = sub?.[s.sectorId];
    const servedKw = Math.min(s.demandKw, floorAlloc + (extra?.servedKw ?? 0));
    const criticalServedKw = Math.min(
      s.criticalDemandKw,
      Math.min(floorAlloc, s.criticalDemandKw) + (extra?.criticalServedKw ?? 0)
    );
    result[s.sectorId] = {
      demandKw: s.demandKw,
      servedKw,
      criticalDemandKw: s.criticalDemandKw,
      criticalServedKw,
      lifelineServedKw: floorAlloc,
      mode: computeSectorMode(servedKw, s.demandKw, pass0.effectiveFloors[s.sectorId] ?? 0),
    };
  }

  return result;
}

/** Sector step for a sector held at its cap (`served = min(demand, cap)`), lifeline fields included. */
export function cappedSectorStep(
  s: SectorDemandStep,
  capKw: number,
  lifelineEnabled: boolean
): SectorStep {
  const servedKw = Math.min(s.demandKw, capKw);
  const floorKw = lifelineEnabled
    ? effectiveFloorKw(resolveLifelineKw(s.sectorId, s.lifelineKw), capKw)
    : 0;
  return {
    demandKw: s.demandKw,
    servedKw,
    criticalDemandKw: s.criticalDemandKw,
    criticalServedKw: Math.min(servedKw, s.criticalDemandKw),
    lifelineServedKw: Math.min(servedKw, floorKw),
    mode: computeSectorMode(servedKw, s.demandKw, floorKw),
  };
}
