import { EPS } from './constants';
import type { BatteryConfig, SectorCap, SectorId, SectorStep, StepResult } from './schemas';

export interface InvariantCheckParams {
  t: number;
  step: StepResult;
  prevStoredKwh: number;
  newStoredKwh: number;
  availableKw: number;
  battery: BatteryConfig;
  sectorCaps?: readonly SectorCap[];
  lifelines?: Partial<Record<SectorId, number>>;
  lifelineEnabled?: boolean;
}

/**
 * Checks all physics & model invariants for a single simulation step.
 * Returns the number of violations (0 when all invariants hold).
 */
export function checkStepInvariants(params: InvariantCheckParams): number {
  const { t, step, prevStoredKwh, newStoredKwh, availableKw, battery, sectorCaps } = params;
  let violations = 0;

  // 1. All step values must be finite
  const scalars = [
    step.solarKw,
    step.demandKw,
    step.servedKw,
    step.unservedKw,
    step.batteryKw,
    step.socPct,
    step.curtailedKw,
    prevStoredKwh,
    newStoredKwh,
    availableKw,
  ];
  for (const val of scalars) {
    if (!Number.isFinite(val)) {
      violations++;
    }
  }

  // 2. Sector-level bounds: 0 <= served <= demand
  const sectorEntries = Object.values(step.sectors);
  for (const s of sectorEntries) {
    const sec: SectorStep = s;
    if (sec.servedKw < -EPS || sec.servedKw > sec.demandKw + EPS) {
      violations++;
    }
    if (
      sec.criticalServedKw < -EPS ||
      sec.criticalServedKw > sec.criticalDemandKw + EPS ||
      sec.criticalServedKw > sec.servedKw + EPS
    ) {
      violations++;
    }
  }

  // 3. Grid served limit: servedKw <= availableKw + EPS
  if (step.servedKw > availableKw + EPS) {
    violations++;
  }

  // 4. Battery storage bounds: reserve - EPS <= stored <= capacity + EPS
  const reserveKwh = (battery.minSocPct / 100) * battery.capacityKwh;
  if (newStoredKwh < reserveKwh - EPS || newStoredKwh > battery.capacityKwh + EPS) {
    violations++;
  }

  // 5. Battery power limits
  if (step.batteryKw > battery.maxChargeKw + EPS) {
    violations++;
  }
  if (-step.batteryKw > battery.maxDischargeKw + EPS) {
    violations++;
  }

  // 6. Energy balance: servedKw == solarKw - batteryKw - curtailedKw
  const balanceDiff = Math.abs(step.servedKw - (step.solarKw - step.batteryKw - step.curtailedKw));
  if (balanceDiff > EPS) {
    violations++;
  }

  // 7. Battery delta energy:
  // deltaStoredKwh = max(batteryKw, 0) * chargeEff - max(-batteryKw, 0) / dischargeEff
  const expectedDelta =
    Math.max(step.batteryKw, 0) * battery.chargeEff -
    Math.max(-step.batteryKw, 0) / battery.dischargeEff;
  const actualDelta = newStoredKwh - prevStoredKwh;
  if (Math.abs(actualDelta - expectedDelta) > EPS) {
    violations++;
  }

  // 8. Sector caps invariant: served_s <= cap_s + EPS
  if (sectorCaps && sectorCaps.length > 0) {
    for (const cap of sectorCaps) {
      if (t >= cap.fromHour && t < cap.toHour) {
        const sec = step.sectors[cap.sector];
        if (sec && sec.servedKw > cap.maxKw + EPS) {
          violations++;
        }
      }
    }
  }

  // 9. Invariant LIFELINE_MET (PL-T3):
  // When availableKw >= sum(targets), every sector must receive at least its target floor min(demand_s, effFloor_s)
  if (params.lifelineEnabled !== false && params.lifelines) {
    const capsMap = new Map<SectorId, number>();
    if (sectorCaps && sectorCaps.length > 0) {
      for (const cap of sectorCaps) {
        if (t >= cap.fromHour && t < cap.toHour) {
          const existing = capsMap.get(cap.sector);
          capsMap.set(
            cap.sector,
            existing !== undefined ? Math.min(existing, cap.maxKw) : cap.maxKw
          );
        }
      }
    }

    let totalPlanchers = 0;
    const targetFloors = {} as Record<SectorId, number>;
    for (const [secId, rawFloor] of Object.entries(params.lifelines) as [SectorId, number][]) {
      const cap = capsMap.get(secId);
      const effFloor = cap !== undefined ? Math.min(rawFloor, cap) : rawFloor;
      const secStep = step.sectors[secId];
      const demand = secStep ? secStep.demandKw : 0;
      const target = Math.min(demand, effFloor);
      targetFloors[secId] = target;
      totalPlanchers += target;
    }

    if (availableKw >= totalPlanchers - EPS) {
      for (const [secId, target] of Object.entries(targetFloors) as [SectorId, number][]) {
        const sec = step.sectors[secId];
        if (sec && sec.servedKw < target - EPS) {
          violations++;
        }
      }
    }

    // Also verify lifelineServedKw bounds
    for (const [secId, target] of Object.entries(targetFloors) as [SectorId, number][]) {
      const sec = step.sectors[secId];
      if (sec) {
        if (sec.lifelineServedKw < -EPS || sec.lifelineServedKw > sec.servedKw + EPS) {
          violations++;
        }
        if (sec.lifelineServedKw > target + EPS) {
          violations++;
        }
      }
    }
  }

  return violations;
}
