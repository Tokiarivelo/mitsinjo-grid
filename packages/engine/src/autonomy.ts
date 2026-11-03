import { sectorApplianceKw } from './appliances';
import { EPS } from './constants';
import { checkConstitution, DEFAULT_CONSTITUTION, type ConstitutionRule } from './constitution';
import { activeFires, effectiveSectorCaps } from './fire';
import { canonicalJson, computeInputHash, computeResultId, fnv1a64 } from './hash';
import {
  computeBatteryStep,
  computeDemandStep,
  computeDischargeMaxKw,
  computeSolarStep,
} from './model';
import { applyPatch } from './patch';
import {
  AutoActionSchema,
  DispatchSnapshotSchema,
  IncidentSchema,
  SEVERITY_RANK,
  type AutoAction,
  type DispatchLogEntry,
  type DispatchSnapshot,
  type Incident,
  type SectorId,
  type SimulationInput,
  type SimulationResult,
  type StrategyId,
} from './schemas';
import { allocateWithCaps, simulate } from './simulate';

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

/**
 * Generates candidate actions in response to an incident (PA-T2a).
 * Pure engine function: never mutates input, all candidates validated by AutoActionSchema.
 */
export function candidateActions(incident: Incident, input: SimulationInput): AutoAction[] {
  const actions: AutoAction[] = [];
  const hour = incident.hour;

  const buildCapsWithSector = (sector: SectorId, maxKw: number) => {
    const existing = (input.sectorCaps ?? []).filter((c) => c.sector !== sector);
    return [
      ...existing,
      {
        sector,
        maxKw,
        fromHour: hour,
        toHour: 24,
      },
    ];
  };

  switch (incident.kind) {
    case 'fire': {
      if (incident.sector) {
        actions.push(
          AutoActionSchema.parse({
            kind: 'isolate_sector',
            sector: incident.sector,
            patch: {
              sectorCaps: buildCapsWithSector(incident.sector, 0),
            },
            answers: 'fire',
          })
        );
      }
      break;
    }

    case 'critical_forecast':
    case 'lifeline_shortfall': {
      // 1. Switch to essential_first (protects critical tier)
      actions.push(
        AutoActionSchema.parse({
          kind: 'switch_strategy',
          strategy: 'essential_first',
          answers: incident.kind,
        })
      );

      // 2. Switch to balanced (protects critical tier across all sectors)
      actions.push(
        AutoActionSchema.parse({
          kind: 'switch_strategy',
          strategy: 'balanced',
          answers: incident.kind,
        })
      );

      // 3. Raise clinic lifeline floor
      actions.push(
        AutoActionSchema.parse({
          kind: 'raise_clinic_floor',
          patch: {
            lifeline: {
              enabled: true,
              kw: { health: 1.5 },
            },
          },
          answers: incident.kind,
        })
      );

      // 4. Shed flexible sectors (industry, water)
      for (const s of input.sectors) {
        if (s.flexible && (s.loadMultiplier ?? 1) > 0) {
          actions.push(
            AutoActionSchema.parse({
              kind: 'shed_flexible',
              sector: s.id,
              patch: {
                sectorCaps: buildCapsWithSector(s.id, 0),
              },
              answers: incident.kind,
            })
          );
        }
      }

      // 5. Cap low-priority sectors
      for (const s of input.sectors) {
        if (s.priority === 'low' && !s.flexible) {
          actions.push(
            AutoActionSchema.parse({
              kind: 'cap_sector',
              sector: s.id,
              patch: {
                sectorCaps: buildCapsWithSector(s.id, 1.0),
              },
              answers: incident.kind,
            })
          );
        }
      }
      break;
    }

    case 'overload': {
      // 1. Switch strategy: essential_first & balanced
      actions.push(
        AutoActionSchema.parse({
          kind: 'switch_strategy',
          strategy: 'essential_first',
          answers: 'overload',
        })
      );
      actions.push(
        AutoActionSchema.parse({
          kind: 'switch_strategy',
          strategy: 'balanced',
          answers: 'overload',
        })
      );

      // 2. Shed flexible sectors
      for (const s of input.sectors) {
        if (s.flexible && (s.loadMultiplier ?? 1) > 0) {
          actions.push(
            AutoActionSchema.parse({
              kind: 'shed_flexible',
              sector: s.id,
              patch: {
                sectorCaps: buildCapsWithSector(s.id, 0),
              },
              answers: 'overload',
            })
          );
        }
      }

      // 3. Cap market
      actions.push(
        AutoActionSchema.parse({
          kind: 'cap_sector',
          sector: 'market',
          patch: {
            sectorCaps: buildCapsWithSector('market', 1.0),
          },
          answers: 'overload',
        })
      );
      break;
    }

    case 'demand_surge': {
      if (incident.sector) {
        const sec = input.sectors.find((s) => s.id === incident.sector);
        const normalKw = sec?.profileKw[hour] ?? 1.0;
        actions.push(
          AutoActionSchema.parse({
            kind: 'cap_sector',
            sector: incident.sector,
            patch: {
              sectorCaps: buildCapsWithSector(incident.sector, Math.max(0.5, normalKw)),
            },
            answers: 'demand_surge',
          })
        );
      }
      actions.push(
        AutoActionSchema.parse({
          kind: 'switch_strategy',
          strategy: 'essential_first',
          answers: 'demand_surge',
        })
      );
      actions.push(
        AutoActionSchema.parse({
          kind: 'switch_strategy',
          strategy: 'balanced',
          answers: 'demand_surge',
        })
      );
      break;
    }

    case 'reserve_low': {
      // 1. Night reserve: raise minSocPct only during evening/night (≥18h or ≤5h)
      if (hour >= 18 || hour <= 5) {
        const maxAllowedMinSoc = Math.max(input.battery.minSocPct, input.battery.initialSocPct - 1);
        const targetMinSoc = Math.min(maxAllowedMinSoc, input.battery.minSocPct + 5);
        if (targetMinSoc > input.battery.minSocPct + EPS) {
          actions.push(
            AutoActionSchema.parse({
              kind: 'reserve_night',
              patch: {
                minSocPct: targetMinSoc,
              },
              answers: 'reserve_low',
            })
          );
        }
      }

      // 2. Shed flexible
      for (const s of input.sectors) {
        if (s.flexible && (s.loadMultiplier ?? 1) > 0) {
          actions.push(
            AutoActionSchema.parse({
              kind: 'shed_flexible',
              sector: s.id,
              patch: {
                sectorCaps: buildCapsWithSector(s.id, 0),
              },
              answers: 'reserve_low',
            })
          );
        }
      }

      actions.push(
        AutoActionSchema.parse({
          kind: 'switch_strategy',
          strategy: 'essential_first',
          answers: 'reserve_low',
        })
      );
      actions.push(
        AutoActionSchema.parse({
          kind: 'switch_strategy',
          strategy: 'balanced',
          answers: 'reserve_low',
        })
      );
      break;
    }

    case 'solar_surplus': {
      // 1. Shift flexible load: connect industry or increase water
      for (const s of input.sectors) {
        if (s.flexible) {
          actions.push(
            AutoActionSchema.parse({
              kind: 'shift_flexible',
              sector: s.id,
              patch: {
                sectorLoads: {
                  [s.id]: 1.0,
                },
              },
              answers: 'solar_surplus',
            })
          );
        }
      }

      // 2. Restore any previously capped sectors
      if (input.sectorCaps && input.sectorCaps.length > 0) {
        const cappedSectors = new Set(input.sectorCaps.map((c) => c.sector));
        for (const s of cappedSectors) {
          const remainingCaps = input.sectorCaps.filter((c) => c.sector !== s);
          actions.push(
            AutoActionSchema.parse({
              kind: 'restore_sector',
              sector: s,
              patch: {
                sectorCaps: remainingCaps,
              },
              answers: 'solar_surplus',
            })
          );
        }
      }

      // 3. Switch back to proportional if abundant sun
      actions.push(
        AutoActionSchema.parse({
          kind: 'switch_strategy',
          strategy: 'proportional',
          answers: 'solar_surplus',
        })
      );

      // 4. Alert only
      actions.push(
        AutoActionSchema.parse({
          kind: 'alert_only',
          answers: 'solar_surplus',
        })
      );
      break;
    }

    case 'meter_anomaly': {
      actions.push(
        AutoActionSchema.parse({
          kind: 'alert_only',
          answers: 'meter_anomaly',
        })
      );
      break;
    }
  }

  // Restore cleared fires if any fire event ended
  if (input.events) {
    for (const e of input.events) {
      if (e.type === 'fire' && hour >= e.startHour + e.durationH) {
        // Also lift the 0 kW isolation cap, otherwise the sector stays dark until midnight.
        actions.push(
          AutoActionSchema.parse({
            kind: 'restore_sector',
            sector: e.sector,
            patch: {
              clearFires: [e.sector],
              sectorCaps: (input.sectorCaps ?? []).filter((c) => c.sector !== e.sector),
            },
            answers: incident.kind,
          })
        );
      }
    }
  }

  return actions;
}

/**
 * Fast forward simulation over a lookahead window [startHour, endHour] starting
 * from an exact stored battery energy (initialStoredKwh).
 * Does not mutate input or past steps.
 */
export function simulateHorizon(
  input: SimulationInput,
  strategy: StrategyId,
  startHour: number,
  endHour: number,
  initialStoredKwh: number
): DispatchSnapshot {
  let storedKwh = Math.max(0, initialStoredKwh);
  let criticalUnservedKwh = 0;
  let unservedKwh = 0;
  const sectorCaps = effectiveSectorCaps(input);
  const lifelineEnabled = input.strategyParams?.lifeline?.enabled !== false;
  const applianceKw = sectorApplianceKw(input.appliances);

  for (let t = startHour; t <= endHour; t++) {
    const solarKw = computeSolarStep(input.solar, input.events, t);
    const demandResult = computeDemandStep(
      input.sectors,
      input.demandMultiplier,
      input.events,
      t,
      applianceKw
    );
    const { dischargeMaxKw } = computeDischargeMaxKw(input.battery, storedKwh);
    const availableKw = solarKw + dischargeMaxKw;
    const activeCaps = sectorCaps?.filter((c) => t >= c.fromHour && t < c.toHour) ?? [];
    const sectorSteps = allocateWithCaps(
      strategy,
      availableKw,
      demandResult.sectorList,
      activeCaps,
      input.strategyParams?.balancedWeights,
      lifelineEnabled
    );

    let servedKw = 0;
    for (const sectorItem of demandResult.sectorList) {
      const stepForSec = sectorSteps[sectorItem.sectorId];
      if (stepForSec) {
        servedKw += stepForSec.servedKw;
        criticalUnservedKwh += Math.max(
          0,
          stepForSec.criticalDemandKw - stepForSec.criticalServedKw
        );
      }
    }

    const batteryResult = computeBatteryStep(input.battery, storedKwh, solarKw, servedKw);
    unservedKwh += Math.max(0, demandResult.demandKw - servedKw);
    storedKwh = batteryResult.storedKwh;
  }

  const socEndPct = Math.max(0, Math.min(100, (storedKwh / input.battery.capacityKwh) * 100));
  const inputHash = computeInputHash(input);
  const resultId = computeResultId(inputHash, strategy);

  return DispatchSnapshotSchema.parse({
    resultId,
    unservedKwh,
    criticalUnservedKwh,
    socEndPct,
  });
}

/**
 * Checks anti-oscillation rules (PA-T2c):
 * - At most 2 actions per hour
 * - No action contrary to the previous on the same sector within 2h (except mandatory fire isolation)
 */
export function checkAntiOscillation(
  action: AutoAction,
  hour: number,
  day: number,
  history: readonly DispatchLogEntry[]
): boolean {
  // Fire isolation is safety-critical and never blocked by anti-oscillation (F1)
  if (action.kind === 'isolate_sector') return true;

  // 1. Max 2 actions per hour
  const actionsThisHour = history.filter(
    (e) => e.day === day && e.hour === hour && e.action && e.action.kind !== 'alert_only'
  );
  if (actionsThisHour.length >= 2) {
    return false;
  }

  // 2. No action contrary to the previous on the same sector within 2h
  if (action.sector) {
    const recentOpposites: Record<string, string[]> = {
      isolate_sector: ['restore_sector'],
      restore_sector: ['isolate_sector', 'shed_flexible', 'cap_sector'],
      shed_flexible: ['shift_flexible', 'restore_sector'],
      shift_flexible: ['shed_flexible', 'isolate_sector'],
      cap_sector: ['restore_sector'],
    };

    const opposites = recentOpposites[action.kind] ?? [];
    const recent = history.filter(
      (e) =>
        e.day === day &&
        Math.abs(e.hour - hour) <= 2 &&
        e.action &&
        e.action.sector === action.sector &&
        opposites.includes(e.action.kind)
    );

    if (recent.length > 0) {
      return false;
    }
  }

  return true;
}

/**
 * Compares two snapshots according to the PA-T2 policy objective:
 * 1. lower critical unserved (by > EPS)
 * 2. then lower unserved (by > EPS)
 * 3. then higher final SoC (by > 0.1)
 */
function isSnapshotBetter(candidate: DispatchSnapshot, current: DispatchSnapshot): boolean {
  if (candidate.criticalUnservedKwh < current.criticalUnservedKwh - EPS) {
    return true;
  }
  if (candidate.criticalUnservedKwh > current.criticalUnservedKwh + EPS) {
    return false;
  }

  if (candidate.unservedKwh < current.unservedKwh - EPS) {
    return true;
  }
  if (candidate.unservedKwh > current.unservedKwh + EPS) {
    return false;
  }

  if (candidate.socEndPct > current.socEndPct + 0.1) {
    return true;
  }

  return false;
}

export interface DispatchDecision {
  action?: AutoAction;
  before: DispatchSnapshot;
  after: DispatchSnapshot;
  counterfactual: DispatchSnapshot;
  evaluatedCandidates: {
    action: AutoAction;
    snapshot: DispatchSnapshot;
    violatesConstitution: boolean;
  }[];
}

/**
 * Evaluates candidate dispatch actions on t..t+6, drops constitution violators,
 * and selects the action that best achieves the objective (PA-T2b).
 * Deterministic and pure engine code (< 20 ms / hour).
 */
export function decideDispatch(
  input: SimulationInput,
  hour: number,
  strategy: StrategyId,
  incidents: readonly Incident[],
  rules: readonly ConstitutionRule[] = DEFAULT_CONSTITUTION,
  history: readonly DispatchLogEntry[] = [],
  day = 0
): DispatchDecision {
  const windowEnd = Math.min(23, hour + 6);

  // 1. Counterfactual: run simulation with current input and strategy
  const baseSim = simulate(input, strategy);
  const prevStep = hour > 0 ? baseSim.steps[hour - 1] : undefined;
  const storedAtH =
    prevStep?.socPct !== undefined
      ? (prevStep.socPct / 100) * input.battery.capacityKwh
      : (input.battery.initialSocPct / 100) * input.battery.capacityKwh;

  const counterfactual = simulateHorizon(input, strategy, hour, windowEnd, storedAtH);
  let bestSnapshot = counterfactual;
  let bestAction: AutoAction | undefined = undefined;

  const evaluatedCandidates: DispatchDecision['evaluatedCandidates'] = [];

  // 2. Collect candidate actions from incidents
  const candidates: AutoAction[] = [];
  const seenKeys = new Set<string>();

  for (const inc of incidents) {
    const list = candidateActions(inc, input);
    for (const a of list) {
      const key = `${a.kind}:${a.sector ?? ''}:${a.strategy ?? ''}:${JSON.stringify(a.patch ?? {})}`;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        candidates.push(a);
      }
    }
  }

  // Active fires at hour t
  const firesNow = activeFires(input.events ?? [], hour);
  const burningNow = new Set(firesNow.map((f) => f.sector));

  // Once a burning sector's isolation is chosen, no other candidate may replace it (F1).
  let fireLocked = false;

  // 3. Evaluate each candidate
  for (const action of candidates) {
    // Alert only changes nothing on the grid
    if (action.kind === 'alert_only') {
      evaluatedCandidates.push({
        action,
        snapshot: counterfactual,
        violatesConstitution: false,
      });
      if (!bestAction) {
        bestAction = action;
      }
      continue;
    }

    // Safety rule: never restore a burning sector before its fire ends
    if (action.kind === 'restore_sector' && action.sector && burningNow.has(action.sector)) {
      continue;
    }

    // Constitution check
    const { violations } = checkConstitution(rules, {
      patch: action.patch,
      strategy: action.strategy,
    });
    if (violations.length > 0) {
      evaluatedCandidates.push({
        action,
        snapshot: counterfactual,
        violatesConstitution: true,
      });
      continue;
    }

    // Anti-oscillation check
    if (!checkAntiOscillation(action, hour, day, history)) {
      continue;
    }

    // Apply patch to input for candidate simulation
    let patchedInput = input;
    if (action.patch) {
      try {
        patchedInput = applyPatch(input, action.patch);
      } catch {
        continue;
      }
    }
    const candStrategy = action.strategy ?? strategy;
    const candSnapshot = simulateHorizon(patchedInput, candStrategy, hour, windowEnd, storedAtH);

    evaluatedCandidates.push({
      action,
      snapshot: candSnapshot,
      violatesConstitution: false,
    });

    // Check if candidate improves on bestSnapshot
    // For fire isolation: always apply isolate_sector for an active fire (unless already isolated)!
    const isSectorAlreadyIsolated = (input.sectorCaps ?? []).some(
      (c) => c.sector === action.sector && c.maxKw === 0
    );

    const isMandatoryFireIsolation =
      action.kind === 'isolate_sector' &&
      action.sector !== undefined &&
      burningNow.has(action.sector) &&
      !isSectorAlreadyIsolated;

    if (isMandatoryFireIsolation && !fireLocked) {
      fireLocked = true;
      bestSnapshot = candSnapshot;
      bestAction = action;
    } else if (!fireLocked && isSnapshotBetter(candSnapshot, bestSnapshot)) {
      bestSnapshot = candSnapshot;
      bestAction = action;
    }
  }

  return {
    action: bestAction,
    before: counterfactual,
    after: bestAction && bestAction.kind !== 'alert_only' ? bestSnapshot : counterfactual,
    counterfactual,
    evaluatedCandidates,
  };
}
