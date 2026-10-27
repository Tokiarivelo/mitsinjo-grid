import { EPS } from '../constants';
import type { BatteryConfig, Metrics, SectorId, SectorMetrics, StepResult } from '../schemas';
import { SECTOR_IDS } from '../schemas';

export function calculateMetrics(
  steps: readonly StepResult[],
  battery: BatteryConfig,
  violations: number
): Metrics {
  let demandKwh = 0;
  let servedKwh = 0;
  let unservedKwh = 0;
  let criticalDemandKwh = 0;
  let criticalUnservedKwh = 0;
  let criticalUnmetHours = 0;
  let solarKwh = 0;
  let curtailedKwh = 0;

  const perSectorAccum: Record<
    SectorId,
    { demandKwh: number; servedKwh: number; unservedKwh: number }
  > = {
    health: { demandKwh: 0, servedKwh: 0, unservedKwh: 0 },
    water: { demandKwh: 0, servedKwh: 0, unservedKwh: 0 },
    school: { demandKwh: 0, servedKwh: 0, unservedKwh: 0 },
    households: { demandKwh: 0, servedKwh: 0, unservedKwh: 0 },
    market: { demandKwh: 0, servedKwh: 0, unservedKwh: 0 },
  };

  let socMinPct = battery.initialSocPct;

  for (const step of steps) {
    demandKwh += step.demandKw;
    servedKwh += step.servedKw;
    unservedKwh += step.unservedKw;
    solarKwh += step.solarKw;
    curtailedKwh += step.curtailedKw;

    if (step.socPct < socMinPct) {
      socMinPct = step.socPct;
    }

    let stepHasCriticalUnmet = false;

    for (const secId of SECTOR_IDS) {
      const secStep = step.sectors[secId];
      const acc = perSectorAccum[secId];
      if (secStep && acc) {
        acc.demandKwh += secStep.demandKw;
        acc.servedKwh += secStep.servedKw;
        acc.unservedKwh += secStep.demandKw - secStep.servedKw;

        criticalDemandKwh += secStep.criticalDemandKw;
        const critUnserved = secStep.criticalDemandKw - secStep.criticalServedKw;
        criticalUnservedKwh += critUnserved;

        if (critUnserved > EPS) {
          stepHasCriticalUnmet = true;
        }
      }
    }

    if (stepHasCriticalUnmet) {
      criticalUnmetHours++;
    }
  }

  const criticalCoveragePct =
    criticalDemandKwh > EPS
      ? Math.max(
          0,
          Math.min(100, ((criticalDemandKwh - criticalUnservedKwh) / criticalDemandKwh) * 100)
        )
      : 100;

  const perSector = {} as Record<SectorId, SectorMetrics>;
  const affectedSectors: SectorId[] = [];

  for (const secId of SECTOR_IDS) {
    const acc = perSectorAccum[secId]!;
    const unserved = Math.max(0, acc.unservedKwh);
    const coveragePct =
      acc.demandKwh > EPS ? Math.max(0, Math.min(100, (acc.servedKwh / acc.demandKwh) * 100)) : 100;

    perSector[secId] = {
      demandKwh: acc.demandKwh,
      servedKwh: acc.servedKwh,
      unservedKwh: unserved,
      coveragePct,
    };

    if (unserved > EPS) {
      affectedSectors.push(secId);
    }
  }

  const lastStep = steps[steps.length - 1];
  const socEndPct = lastStep ? lastStep.socPct : battery.initialSocPct;

  return {
    demandKwh,
    servedKwh,
    unservedKwh,
    criticalDemandKwh,
    criticalUnservedKwh,
    criticalUnmetHours,
    criticalCoveragePct,
    affectedSectors,
    solarKwh,
    curtailedKwh,
    socStartPct: battery.initialSocPct,
    socEndPct,
    socMinPct,
    violations,
    perSector,
  };
}
