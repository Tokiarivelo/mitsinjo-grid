import { DEFAULT_LIFELINE_KW } from '../constants';
import type { SectorDemandStep } from '../model/demand';
import { PRIORITY_ORDER, type SectorId, type SectorStep } from '../schemas';
import { computeSectorMode } from './lifeline';

export function runEssentialFirstStrategy(
  availableKw: number,
  sectors: readonly SectorDemandStep[]
): Record<SectorId, SectorStep> {
  const result = {} as Record<SectorId, SectorStep>;
  let remainingKw = Math.max(0, availableKw);

  for (const priority of PRIORITY_ORDER) {
    const tierSectors = sectors.filter((s) => s.priority === priority);
    if (tierSectors.length === 0) continue;

    let tierDemandKw = 0;
    for (const s of tierSectors) {
      tierDemandKw += s.demandKw;
    }

    if (tierDemandKw <= 0) {
      for (const s of tierSectors) {
        const floor = s.lifelineKw ?? DEFAULT_LIFELINE_KW[s.sectorId];
        result[s.sectorId] = {
          demandKw: s.demandKw,
          servedKw: 0,
          criticalDemandKw: s.criticalDemandKw,
          criticalServedKw: 0,
          lifelineServedKw: 0,
          mode: computeSectorMode(0, s.demandKw, floor),
        };
      }
    } else if (remainingKw >= tierDemandKw) {
      for (const s of tierSectors) {
        const floor = s.lifelineKw ?? DEFAULT_LIFELINE_KW[s.sectorId];
        result[s.sectorId] = {
          demandKw: s.demandKw,
          servedKw: s.demandKw,
          criticalDemandKw: s.criticalDemandKw,
          criticalServedKw: Math.min(s.demandKw, s.criticalDemandKw),
          lifelineServedKw: 0,
          mode: computeSectorMode(s.demandKw, s.demandKw, floor),
        };
      }
      remainingKw -= tierDemandKw;
    } else {
      const ratio = remainingKw > 0 ? remainingKw / tierDemandKw : 0;
      for (const s of tierSectors) {
        const servedKw = Math.min(s.demandKw, s.demandKw * ratio);
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
      remainingKw = 0;
    }
  }

  // Ensure all sectors are accounted for
  for (const s of sectors) {
    if (!result[s.sectorId]) {
      const floor = s.lifelineKw ?? DEFAULT_LIFELINE_KW[s.sectorId];
      result[s.sectorId] = {
        demandKw: s.demandKw,
        servedKw: 0,
        criticalDemandKw: s.criticalDemandKw,
        criticalServedKw: 0,
        lifelineServedKw: 0,
        mode: computeSectorMode(0, s.demandKw, floor),
      };
    }
  }

  return result;
}
