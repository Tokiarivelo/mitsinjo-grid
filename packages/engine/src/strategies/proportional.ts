import type { SectorDemandStep } from '../model/demand';
import type { SectorId } from '../schemas';
import type { BaseSectorStep } from './lifeline';

export function runProportionalStrategy(
  availableKw: number,
  sectors: readonly SectorDemandStep[]
): Record<SectorId, BaseSectorStep> {
  const result = {} as Record<SectorId, BaseSectorStep>;
  let totalDemandKw = 0;

  for (const s of sectors) {
    totalDemandKw += s.demandKw;
  }

  const ratio = totalDemandKw > 0 ? Math.min(1, Math.max(0, availableKw) / totalDemandKw) : 1;

  for (const s of sectors) {
    const servedKw = Math.min(s.demandKw, s.demandKw * ratio);
    const criticalServedKw = Math.min(servedKw, s.criticalDemandKw);

    result[s.sectorId] = {
      demandKw: s.demandKw,
      servedKw,
      criticalDemandKw: s.criticalDemandKw,
      criticalServedKw,
    };
  }

  return result;
}
