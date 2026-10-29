import { DEFAULT_LIFELINE_KW } from '../constants';
import type { SectorDemandStep } from '../model/demand';
import type { Priority, SectorCap, SectorId, SectorStep, StrategyId } from '../schemas';
import { runBalancedStrategy } from './balanced';
import { runEssentialFirstStrategy } from './essential-first';
import { computeLifelinePass, computeSectorMode } from './lifeline';
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
): Record<SectorId, SectorStep> {
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

export function executeStrategy(
  strategy: StrategyId,
  availableKw: number,
  sectors: readonly SectorDemandStep[],
  weights?: Record<Priority, number>,
  lifelineEnabled: boolean = true,
  activeCaps?: readonly SectorCap[]
): Record<SectorId, SectorStep> {
  if (!lifelineEnabled) {
    const raw = runBaseStrategy(strategy, availableKw, sectors, weights);
    for (const s of sectors) {
      const step = raw[s.sectorId];
      if (step) {
        step.lifelineServedKw = 0;
        step.mode = computeSectorMode(
          step.servedKw,
          step.demandKw,
          s.lifelineKw ?? DEFAULT_LIFELINE_KW[s.sectorId]
        );
      }
    }
    return raw;
  }

  // Pass 0: Lifeline allocation (PL-T2)
  const pass0 = computeLifelinePass(availableKw, sectors, activeCaps);

  // If in emergency mode (dispo < Σ planchers), all available power was consumed by Pass 0
  if (pass0.isEmergency) {
    const result = {} as Record<SectorId, SectorStep>;
    for (const s of sectors) {
      const servedKw = pass0.allocations[s.sectorId] ?? 0;
      const effFloor =
        pass0.effectiveFloors[s.sectorId] ?? s.lifelineKw ?? DEFAULT_LIFELINE_KW[s.sectorId];
      result[s.sectorId] = {
        demandKw: s.demandKw,
        servedKw,
        criticalDemandKw: s.criticalDemandKw,
        criticalServedKw: Math.min(servedKw, s.criticalDemandKw),
        lifelineServedKw: servedKw,
        mode: computeSectorMode(servedKw, s.demandKw, effFloor),
      };
    }
    return result;
  }

  // Normal mode: Pass 0 allocated floor power; remaining energy distributed via selected strategy
  const reducedSectors: SectorDemandStep[] = sectors.map((s) => {
    const floorAlloc = pass0.allocations[s.sectorId] ?? 0;
    const remainingDemand = Math.max(0, s.demandKw - floorAlloc);
    const critFromFloor = Math.min(floorAlloc, s.criticalDemandKw);
    const remainingCrit = Math.max(0, s.criticalDemandKw - critFromFloor);
    return {
      ...s,
      demandKw: remainingDemand,
      criticalDemandKw: remainingCrit,
      criticalShare: remainingDemand > 0 ? remainingCrit / remainingDemand : 0,
    };
  });

  const subAllocation = runBaseStrategy(strategy, pass0.remainingKw, reducedSectors, weights);
  const result = {} as Record<SectorId, SectorStep>;

  for (const s of sectors) {
    const floorAlloc = pass0.allocations[s.sectorId] ?? 0;
    const sub = subAllocation[s.sectorId];
    const additionalServed = sub ? sub.servedKw : 0;
    const additionalCrit = sub ? sub.criticalServedKw : 0;
    const critFromFloor = Math.min(floorAlloc, s.criticalDemandKw);

    const totalServed = Math.min(s.demandKw, floorAlloc + additionalServed);
    const totalCrit = Math.min(s.criticalDemandKw, critFromFloor + additionalCrit);
    const effFloor =
      pass0.effectiveFloors[s.sectorId] ?? s.lifelineKw ?? DEFAULT_LIFELINE_KW[s.sectorId];

    result[s.sectorId] = {
      demandKw: s.demandKw,
      servedKw: totalServed,
      criticalDemandKw: s.criticalDemandKw,
      criticalServedKw: totalCrit,
      lifelineServedKw: floorAlloc,
      mode: computeSectorMode(totalServed, s.demandKw, effFloor),
    };
  }

  return result;
}
