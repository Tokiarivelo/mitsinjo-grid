import { DEFAULT_BALANCED_WEIGHTS } from '../constants';
import type { SectorDemandStep } from '../model/demand';
import type { Priority, SectorId, SectorStep } from '../schemas';

export function runBalancedStrategy(
  availableKw: number,
  sectors: readonly SectorDemandStep[],
  weights: Record<Priority, number> = DEFAULT_BALANCED_WEIGHTS
): Record<SectorId, SectorStep> {
  const result = {} as Record<SectorId, SectorStep>;
  let totalCriticalKw = 0;

  for (const s of sectors) {
    totalCriticalKw += s.criticalDemandKw;
  }

  const clampedAvailable = Math.max(0, availableKw);

  // Pass 1: Serve critical shares of all sectors (proportional if short)
  if (clampedAvailable <= totalCriticalKw) {
    const ratio = totalCriticalKw > 0 ? clampedAvailable / totalCriticalKw : 0;
    for (const s of sectors) {
      const servedKw = Math.min(s.demandKw, s.criticalDemandKw * ratio);
      result[s.sectorId] = {
        demandKw: s.demandKw,
        servedKw,
        criticalDemandKw: s.criticalDemandKw,
        criticalServedKw: Math.min(servedKw, s.criticalDemandKw),
      };
    }
    return result;
  }

  // Pass 1 fully satisfied
  const pass1Served: Record<SectorId, number> = {} as Record<SectorId, number>;
  for (const s of sectors) {
    pass1Served[s.sectorId] = s.criticalDemandKw;
  }

  let remainingKw = clampedAvailable - totalCriticalKw;
  const pass2Served: Record<SectorId, number> = {} as Record<SectorId, number>;
  for (const s of sectors) {
    pass2Served[s.sectorId] = 0;
  }

  // Pass 2: Water-filling on remaining demand * weight
  const EPS = 1e-9;
  for (let iteration = 0; iteration < sectors.length + 1 && remainingKw > EPS; iteration++) {
    const active = sectors.filter((s) => {
      const remainingDemand =
        s.demandKw - (pass1Served[s.sectorId] ?? 0) - (pass2Served[s.sectorId] ?? 0);
      return remainingDemand > EPS;
    });

    if (active.length === 0) break;

    let sumWeightRem = 0;
    for (const s of active) {
      const remainingDemand =
        s.demandKw - (pass1Served[s.sectorId] ?? 0) - (pass2Served[s.sectorId] ?? 0);
      sumWeightRem += remainingDemand * weights[s.priority];
    }

    if (sumWeightRem <= EPS) break;

    // Check caps
    let hasCap = false;
    for (const s of active) {
      const remainingDemand =
        s.demandKw - (pass1Served[s.sectorId] ?? 0) - (pass2Served[s.sectorId] ?? 0);
      const trialShare = (remainingKw * (remainingDemand * weights[s.priority])) / sumWeightRem;
      if (trialShare >= remainingDemand - EPS) {
        hasCap = true;
        break;
      }
    }

    if (hasCap) {
      for (const s of active) {
        const remainingDemand =
          s.demandKw - (pass1Served[s.sectorId] ?? 0) - (pass2Served[s.sectorId] ?? 0);
        const trialShare = (remainingKw * (remainingDemand * weights[s.priority])) / sumWeightRem;
        if (trialShare >= remainingDemand - EPS) {
          pass2Served[s.sectorId] = (pass2Served[s.sectorId] ?? 0) + remainingDemand;
          remainingKw = Math.max(0, remainingKw - remainingDemand);
        }
      }
    } else {
      for (const s of active) {
        const remainingDemand =
          s.demandKw - (pass1Served[s.sectorId] ?? 0) - (pass2Served[s.sectorId] ?? 0);
        const trialShare = (remainingKw * (remainingDemand * weights[s.priority])) / sumWeightRem;
        pass2Served[s.sectorId] = (pass2Served[s.sectorId] ?? 0) + trialShare;
      }
      remainingKw = 0;
      break;
    }
  }

  // Assemble final result
  for (const s of sectors) {
    const totalServed = Math.min(
      s.demandKw,
      (pass1Served[s.sectorId] ?? 0) + (pass2Served[s.sectorId] ?? 0)
    );
    result[s.sectorId] = {
      demandKw: s.demandKw,
      servedKw: totalServed,
      criticalDemandKw: s.criticalDemandKw,
      criticalServedKw: Math.min(totalServed, s.criticalDemandKw),
    };
  }

  return result;
}
