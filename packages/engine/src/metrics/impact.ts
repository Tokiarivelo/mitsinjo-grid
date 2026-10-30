import { EPS } from '../constants';
import { SECTOR_IDS, type SectorId } from '../schemas/common';
import type { ChangeImpact, SectorImpact } from '../schemas/impact';
import type { SimulationResult } from '../schemas/result';

/** Hours where the sector has demand but receives no power (`mode = 'off'`). */
export function sectorOffHours(result: SimulationResult, sector: SectorId): number {
  let hours = 0;
  for (const step of result.steps) {
    const s = step.sectors[sector];
    if (s && s.demandKw > EPS && s.mode === 'off') hours++;
  }
  return hours;
}

/** Before/after impact of a change: served energy and off hours per sector, minimum SoC, unserved energy. */
export function changeImpact(before: SimulationResult, after: SimulationResult): ChangeImpact {
  const sectors = {} as Record<SectorId, SectorImpact>;
  for (const id of SECTOR_IDS) {
    const b = before.metrics.perSector[id]?.servedKwh ?? 0;
    const a = after.metrics.perSector[id]?.servedKwh ?? 0;
    sectors[id] = {
      servedKwhBefore: b,
      servedKwhAfter: a,
      servedKwhDelta: a - b,
      offHoursBefore: sectorOffHours(before, id),
      offHoursAfter: sectorOffHours(after, id),
    };
  }
  return {
    beforeResultId: before.id,
    afterResultId: after.id,
    strategyBefore: before.strategy,
    strategyAfter: after.strategy,
    socMinPctBefore: before.metrics.socMinPct,
    socMinPctAfter: after.metrics.socMinPct,
    unservedKwhBefore: before.metrics.unservedKwh,
    unservedKwhAfter: after.metrics.unservedKwh,
    sectors,
  };
}
