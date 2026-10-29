import { DEFAULT_BALANCED_WEIGHTS, DEFAULT_LIFELINE_KW } from '../constants';
import type { SectorDemandStep } from '../model/demand';
import type { Priority, SectorId, SectorStep } from '../schemas';
import { computeSectorMode } from './lifeline';

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
      const floor = s.lifelineKw ?? DEFAULT_LIFELINE_KW[s.sectorId];
      result[s.sectorId] = {
        demandKw: s.demandKw,
        servedKw,
        criticalDemandKw: s.criticalDemandKw,
        criticalServedKw: Math.min(servedKw, s.criticalDemandKw),
        lifelineServedKw: 0,
        mode: computeSectorMode(servedKw, s.demandKw, floor),
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

    // Weights ration scarce power; they never waste it. When every sector still in need has
    // weight 0, the leftover is shared by remaining demand (uniform weights) instead.
    const weightedSum = active.reduce(
      (sum, s) =>
        sum +
        (s.demandKw - (pass1Served[s.sectorId] ?? 0) - (pass2Served[s.sectorId] ?? 0)) *
          weights[s.priority],
      0
    );
    const weightOf = (p: Priority) => (weightedSum > EPS ? weights[p] : 1);

    let sumWeightRem = 0;
    for (const s of active) {
      const remainingDemand =
        s.demandKw - (pass1Served[s.sectorId] ?? 0) - (pass2Served[s.sectorId] ?? 0);
      sumWeightRem += remainingDemand * weightOf(s.priority);
    }

    if (sumWeightRem <= EPS) break;

    // Check caps
    let hasCap = false;
    for (const s of active) {
      const remainingDemand =
        s.demandKw - (pass1Served[s.sectorId] ?? 0) - (pass2Served[s.sectorId] ?? 0);
      const trialShare = (remainingKw * (remainingDemand * weightOf(s.priority))) / sumWeightRem;
      if (trialShare >= remainingDemand - EPS) {
        hasCap = true;
        break;
      }
    }

    if (hasCap) {
      for (const s of active) {
        const remainingDemand =
          s.demandKw - (pass1Served[s.sectorId] ?? 0) - (pass2Served[s.sectorId] ?? 0);
        const trialShare = (remainingKw * (remainingDemand * weightOf(s.priority))) / sumWeightRem;
        if (trialShare >= remainingDemand - EPS) {
          pass2Served[s.sectorId] = (pass2Served[s.sectorId] ?? 0) + remainingDemand;
          remainingKw = Math.max(0, remainingKw - remainingDemand);
        }
      }
    } else {
      for (const s of active) {
        const remainingDemand =
          s.demandKw - (pass1Served[s.sectorId] ?? 0) - (pass2Served[s.sectorId] ?? 0);
        const trialShare = (remainingKw * (remainingDemand * weightOf(s.priority))) / sumWeightRem;
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
    const floor = s.lifelineKw ?? DEFAULT_LIFELINE_KW[s.sectorId];
    result[s.sectorId] = {
      demandKw: s.demandKw,
      servedKw: totalServed,
      criticalDemandKw: s.criticalDemandKw,
      criticalServedKw: Math.min(totalServed, s.criticalDemandKw),
      lifelineServedKw: 0,
      mode: computeSectorMode(totalServed, s.demandKw, floor),
    };
  }

  return result;
}
