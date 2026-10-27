import { EPS } from './constants';
import type { BatteryConfig, SectorStep, StepResult } from './schemas';

export interface InvariantCheckParams {
  t: number;
  step: StepResult;
  prevStoredKwh: number;
  newStoredKwh: number;
  availableKw: number;
  battery: BatteryConfig;
}

/**
 * Checks all physics & model invariants for a single simulation step.
 * Returns the number of violations (0 when all invariants hold).
 */
export function checkStepInvariants(params: InvariantCheckParams): number {
  const { step, prevStoredKwh, newStoredKwh, availableKw, battery } = params;
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

  return violations;
}
