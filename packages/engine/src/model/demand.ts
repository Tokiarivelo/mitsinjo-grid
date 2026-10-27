import type { Priority, ScenarioEvent, SectorConfig, SectorId } from '../schemas';

export interface SectorDemandStep {
  sectorId: SectorId;
  demandKw: number;
  criticalDemandKw: number;
  priority: Priority;
  criticalShare: number;
  profileDemandKw?: number;
  hasMeterOverride?: boolean;
}

export interface DemandStepResult {
  demandKw: number;
  criticalDemandKw: number;
  sectors: Record<SectorId, SectorDemandStep>;
  sectorList: SectorDemandStep[];
}

export function computeDemandStep(
  sectors: readonly SectorConfig[],
  demandMultiplier: number,
  events: readonly ScenarioEvent[],
  t: number
): DemandStepResult {
  const sectorsRecord = {} as Record<SectorId, SectorDemandStep>;
  const sectorList: SectorDemandStep[] = [];
  let totalDemandKw = 0;
  let totalCriticalDemandKw = 0;

  for (const s of sectors) {
    let spikeMultiplier = 1;

    for (const event of events) {
      if (
        event.type === 'demand_spike' &&
        (event.sector === 'all' || event.sector === s.id) &&
        t >= event.startHour &&
        t < event.startHour + event.durationH
      ) {
        spikeMultiplier *= event.factor;
      }
    }

    const baseDemandKw = s.profileKw[t] ?? 0;
    const profileDemandKw = Math.max(0, baseDemandKw * demandMultiplier * spikeMultiplier);
    const hasMeterOverride = s.meterReadings !== undefined && s.meterReadings[t] !== undefined;
    const demandKw = hasMeterOverride ? Math.max(0, s.meterReadings![t] ?? 0) : profileDemandKw;
    const criticalDemandKw = demandKw * s.criticalShare;

    const sectorStep: SectorDemandStep = {
      sectorId: s.id,
      demandKw,
      criticalDemandKw,
      priority: s.priority,
      criticalShare: s.criticalShare,
      profileDemandKw,
      hasMeterOverride,
    };

    sectorsRecord[s.id] = sectorStep;
    sectorList.push(sectorStep);
    totalDemandKw += demandKw;
    totalCriticalDemandKw += criticalDemandKw;
  }

  return {
    demandKw: totalDemandKw,
    criticalDemandKw: totalCriticalDemandKw,
    sectors: sectorsRecord,
    sectorList,
  };
}
