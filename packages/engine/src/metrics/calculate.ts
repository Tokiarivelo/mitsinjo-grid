import { EPS } from '../constants';
import type { BatteryConfig, Metrics, SectorId, SectorMetrics, StepResult } from '../schemas';
import { SECTOR_IDS } from '../schemas';
import { type LifelineFloorsByHour, lifelineFloorsByHour } from '../strategies/lifeline';

const DEFAULT_FLOORS_BY_HOUR = lifelineFloorsByHour(
  SECTOR_IDS.map((id) => ({ id })),
  undefined
);

export function calculateMetrics(
  steps: readonly StepResult[],
  battery: BatteryConfig,
  violations: number,
  /** Cap-aware floors by hour (`lifelineFloorsByHour`); default floors when omitted. */
  floorsByHour: LifelineFloorsByHour = DEFAULT_FLOORS_BY_HOUR
): Metrics {
  let demandKwh = 0;
  let servedKwh = 0;
  let unservedKwh = 0;
  let criticalDemandKwh = 0;
  let criticalUnservedKwh = 0;
  let criticalUnmetHours = 0;
  let solarKwh = 0;
  let curtailedKwh = 0;
  let heldSectorHours = 0;

  const perSectorAccum: Record<
    SectorId,
    { demandKwh: number; servedKwh: number; unservedKwh: number }
  > = Object.fromEntries(
    SECTOR_IDS.map((id) => [id, { demandKwh: 0, servedKwh: 0, unservedKwh: 0 }])
  ) as Record<SectorId, { demandKwh: number; servedKwh: number; unservedKwh: number }>;

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
    const floors = floorsByHour[step.t] ?? {};

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

        const targetFloor = Math.min(secStep.demandKw, floors[secId] ?? 0);
        if (secStep.servedKw >= targetFloor - EPS) {
          heldSectorHours++;
        }
      }
    }

    if (stepHasCriticalUnmet) {
      criticalUnmetHours++;
    }
  }

  const totalSectorHours = steps.length * SECTOR_IDS.length;
  const lifelineCoveragePct =
    totalSectorHours > 0
      ? Math.max(0, Math.min(100, (heldSectorHours / totalSectorHours) * 100))
      : 100;

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
    lifelineCoveragePct,
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
