import { EPS } from './constants';
import { activeFires } from './fire';
import { canonicalJson, fnv1a64 } from './hash';
import {
  IncidentSchema,
  SEVERITY_RANK,
  type DispatchLogEntry,
  type Incident,
  type SectorId,
  type SimulationInput,
  type SimulationResult,
} from './schemas';

/**
 * Audit hash of a log line (PA): FNV-1a 64 of its canonical JSON, `hash` field excluded.
 * Same line → same hash, whatever the key order.
 */
export function dispatchLogHash(entry: Omit<DispatchLogEntry, 'hash'> | DispatchLogEntry): string {
  const { hash: _ignored, ...rest } = entry as DispatchLogEntry;
  return fnv1a64(canonicalJson(rest));
}

/** Incidents most severe first, then earliest (day, hour); stable otherwise. Never mutates. */
export function sortIncidents(incidents: readonly Incident[]): Incident[] {
  return [...incidents].sort(
    (a, b) =>
      SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || a.day - b.day || a.hour - b.hour
  );
}

/**
 * Detects grid incidents at simulated hour `hour` (PA-T1):
 * - `fire` (critical): active fire event cutting a sector
 * - `critical_forecast` (critical): critical unserved > EPS in t+1..t+lookaheadH under the active strategy
 * - `overload` (warning): demand exceeds available generation/discharge or surge exceeds baseline profile by >= 30%
 * - `lifeline_shortfall` (warning): LIFELINE_SHORTFALL warning covers hour t
 * - `reserve_low` (warning): battery SoC <= minSoc + 5 points
 * - `demand_surge` (warning): sector demand >= 130% of its normal profile
 * - `meter_anomaly` (info): ANOMALY_TO_VERIFY warning covers hour t
 * - `solar_surplus` (info): curtailment > EPS or peak midday solar generation surplus
 *
 * Returned incidents are validated with IncidentSchema and sorted by severity.
 */
export function detectIncidents(
  input: SimulationInput,
  result: SimulationResult,
  hour: number,
  lookaheadH = 3,
  day = 0
): Incident[] {
  if (hour < 0 || hour >= 24) return [];
  const step = result.steps[hour];
  if (!step) return [];

  const incidents: Incident[] = [];

  // 1. Fire (critical): active fire events at hour t
  const fires = activeFires(input.events ?? [], hour);
  for (const f of fires) {
    incidents.push(
      IncidentSchema.parse({
        kind: 'fire',
        severity: 'critical',
        day,
        hour,
        sector: f.sector,
        evidence: {
          startHour: f.startHour,
          durationH: f.durationH,
          servedKw: step.sectors[f.sector]?.servedKw ?? 0,
        },
      })
    );
  }

  // 2. Critical forecast (critical): critical unserved > EPS in t+1..t+lookaheadH
  const burningSectors = new Set(fires.map((f) => f.sector));
  const endLookahead = Math.min(result.steps.length - 1, hour + lookaheadH);
  const forecastSectorsReported = new Set<string>();

  for (let h = hour + 1; h <= endLookahead; h++) {
    const futureStep = result.steps[h];
    if (!futureStep) continue;
    const futureBurning = new Set(activeFires(input.events ?? [], h).map((f) => f.sector));

    for (const [secId, s] of Object.entries(futureStep.sectors)) {
      if (burningSectors.has(secId as SectorId) || futureBurning.has(secId as SectorId)) {
        continue;
      }
      const critUnserved = Math.max(0, s.criticalDemandKw - s.criticalServedKw);
      if (critUnserved > EPS && !forecastSectorsReported.has(secId)) {
        forecastSectorsReported.add(secId);
        incidents.push(
          IncidentSchema.parse({
            kind: 'critical_forecast',
            severity: 'critical',
            day,
            hour,
            sector: secId as SectorId,
            evidence: {
              forecastHour: h,
              criticalDemandKw: s.criticalDemandKw,
              criticalServedKw: s.criticalServedKw,
              criticalUnservedKw: critUnserved,
            },
          })
        );
      }
    }
  }

  // 3. Overload (warning): total demand > solar + max discharge or spike >= 130% baseline demand
  let baselineDemandKw = 0;
  for (const s of input.sectors) {
    baselineDemandKw += (s.profileKw[hour] ?? 0) * (s.loadMultiplier ?? 1);
  }
  const baselineScaled = baselineDemandKw * input.demandMultiplier;

  // Exclude unserved energy from burning sectors (which are isolated by safety breakers, not capacity deficit)
  let activeUnservedKw = 0;
  for (const [secId, s] of Object.entries(step.sectors)) {
    if (burningSectors.has(secId as SectorId)) continue;
    activeUnservedKw += Math.max(0, s.demandKw - s.servedKw);
  }

  const isCapacityOverload =
    activeUnservedKw > EPS || step.demandKw > step.solarKw + input.battery.maxDischargeKw + EPS;

  const isSurgeOverload =
    baselineScaled > EPS &&
    step.demandKw >= 1.3 * baselineScaled - EPS &&
    step.demandKw > baselineScaled + EPS;

  if (isCapacityOverload || isSurgeOverload) {
    incidents.push(
      IncidentSchema.parse({
        kind: 'overload',
        severity: 'warning',
        day,
        hour,
        evidence: {
          demandKw: step.demandKw,
          servedKw: step.servedKw,
          unservedKw: step.unservedKw,
          solarKw: step.solarKw,
          maxDischargeKw: input.battery.maxDischargeKw,
        },
      })
    );
  }

  // 4. Lifeline shortfall (warning): LIFELINE_SHORTFALL warning covers hour t
  for (const w of result.warnings) {
    if (w.code === 'LIFELINE_SHORTFALL' && hour >= w.fromHour && hour <= w.toHour) {
      const s = w.sector ? step.sectors[w.sector] : undefined;
      incidents.push(
        IncidentSchema.parse({
          kind: 'lifeline_shortfall',
          severity: 'warning',
          day,
          hour,
          ...(w.sector ? { sector: w.sector } : {}),
          evidence: {
            fromHour: w.fromHour,
            toHour: w.toHour,
            servedKw: s?.servedKw ?? 0,
            lifelineServedKw: s?.lifelineServedKw ?? 0,
          },
        })
      );
    }
  }

  // 5. Reserve low (warning): battery SoC <= minSoc + 5 points
  const lowReserveThreshold = input.battery.minSocPct + 5;
  if (step.socPct <= lowReserveThreshold + EPS) {
    incidents.push(
      IncidentSchema.parse({
        kind: 'reserve_low',
        severity: 'warning',
        day,
        hour,
        evidence: {
          socPct: step.socPct,
          minSocPct: input.battery.minSocPct,
          thresholdSocPct: lowReserveThreshold,
        },
      })
    );
  }

  // 6. Demand surge (warning): sector demand >= 130% of its normal profile
  for (const sec of input.sectors) {
    const baseProfileKw =
      (sec.profileKw[hour] ?? 0) * input.demandMultiplier * (sec.loadMultiplier ?? 1);
    const secStep = step.sectors[sec.id];
    const demandKw = secStep?.demandKw ?? 0;
    if (baseProfileKw > EPS) {
      if (demandKw >= 1.3 * baseProfileKw - EPS && demandKw > baseProfileKw + EPS) {
        incidents.push(
          IncidentSchema.parse({
            kind: 'demand_surge',
            severity: 'warning',
            day,
            hour,
            sector: sec.id,
            evidence: {
              demandKw,
              baseProfileKw,
              ratio: demandKw / baseProfileKw,
            },
          })
        );
      }
    } else if (demandKw > EPS) {
      incidents.push(
        IncidentSchema.parse({
          kind: 'demand_surge',
          severity: 'warning',
          day,
          hour,
          sector: sec.id,
          evidence: {
            demandKw,
            baseProfileKw: 0,
            ratio: 999,
          },
        })
      );
    }
  }

  // 7. Meter anomaly (info): ANOMALY_TO_VERIFY warning covers hour t
  for (const w of result.warnings) {
    if (w.code === 'ANOMALY_TO_VERIFY' && hour >= w.fromHour && hour <= w.toHour) {
      const s = input.sectors.find((sec) => sec.id === w.sector);
      incidents.push(
        IncidentSchema.parse({
          kind: 'meter_anomaly',
          severity: 'info',
          day,
          hour,
          ...(w.sector ? { sector: w.sector } : {}),
          evidence: {
            fromHour: w.fromHour,
            toHour: w.toHour,
            meterKw: s?.meterReadings?.[hour] ?? 0,
            profileKw: s?.profileKw[hour] ?? 0,
          },
        })
      );
    }
  }

  // 8. Solar surplus (info): curtailment > EPS or midday peak solar generation surplus
  const isCurtailment = step.curtailedKw > EPS;
  const isNoonSurplus = hour === 12 && step.solarKw > step.demandKw + EPS;

  if (isCurtailment || isNoonSurplus) {
    incidents.push(
      IncidentSchema.parse({
        kind: 'solar_surplus',
        severity: 'info',
        day,
        hour,
        evidence: {
          curtailedKw: step.curtailedKw,
          solarKw: step.solarKw,
          surplusKw: Math.max(0, step.solarKw - step.demandKw),
        },
      })
    );
  }

  return sortIncidents(incidents);
}
