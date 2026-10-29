import { DEFAULT_LIFELINE_KW } from '../constants';
import type { Priority, ScenarioEvent, SectorConfig, SectorId } from '../schemas';

export interface SectorDemandStep {
  sectorId: SectorId;
  demandKw: number;
  criticalDemandKw: number;
  priority: Priority;
  criticalShare: number;
  lifelineKw?: number;
  profileDemandKw?: number;
  hasMeterOverride?: boolean;
}

export interface DemandStepResult {
  demandKw: number;
  criticalDemandKw: number;
  sectors: Record<SectorId, SectorDemandStep>;
  sectorList: SectorDemandStep[];
}

/**
 * Expected (profile-based) demand of one sector at hour t:
 * profileKw[t] × demandMultiplier × active demand_spike factors. Ignores meterReadings.
 */
export function computeProfileDemandKw(
  sector: SectorConfig,
  demandMultiplier: number,
  events: readonly ScenarioEvent[],
  t: number
): number {
  let spikeMultiplier = 1;
  for (const event of events) {
    if (
      event.type === 'demand_spike' &&
      (event.sector === 'all' || event.sector === sector.id) &&
      t >= event.startHour &&
      t < event.startHour + event.durationH
    ) {
      spikeMultiplier *= event.factor;
    }
  }
  return Math.max(0, (sector.profileKw[t] ?? 0) * demandMultiplier * spikeMultiplier);
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
    const profileDemandKw = computeProfileDemandKw(s, demandMultiplier, events, t);
    const hasMeterOverride = s.meterReadings !== undefined && s.meterReadings[t] !== undefined;
    const demandKw = hasMeterOverride ? Math.max(0, s.meterReadings![t] ?? 0) : profileDemandKw;
    const criticalDemandKw = demandKw * s.criticalShare;

    const sectorStep: SectorDemandStep = {
      sectorId: s.id,
      demandKw,
      criticalDemandKw,
      priority: s.priority,
      criticalShare: s.criticalShare,
      lifelineKw: s.lifelineKw ?? DEFAULT_LIFELINE_KW[s.id],
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
