import { DEFAULT_LIFELINE_KW } from '../constants';
import type { SectorDemandStep } from '../model/demand';
import type { SectorId, SectorStep } from '../schemas';
import { computeSectorMode } from './lifeline';

export function runProportionalStrategy(
  availableKw: number,
  sectors: readonly SectorDemandStep[]
): Record<SectorId, SectorStep> {
  const result = {} as Record<SectorId, SectorStep>;
  let totalDemandKw = 0;

  for (const s of sectors) {
    totalDemandKw += s.demandKw;
  }

  const ratio = totalDemandKw > 0 ? Math.min(1, Math.max(0, availableKw) / totalDemandKw) : 1;

  for (const s of sectors) {
    const servedKw = Math.min(s.demandKw, s.demandKw * ratio);
    const criticalServedKw = Math.min(servedKw, s.criticalDemandKw);
    const floor = s.lifelineKw ?? DEFAULT_LIFELINE_KW[s.sectorId];

    result[s.sectorId] = {
      demandKw: s.demandKw,
      servedKw,
      criticalDemandKw: s.criticalDemandKw,
      criticalServedKw,
      lifelineServedKw: 0,
      mode: computeSectorMode(servedKw, s.demandKw, floor),
    };
  }

  return result;
}
