import { ENGINE_VERSION, EPS, HORIZON_H } from './constants';
import { computeInputHash, computeResultId } from './hash';
import { checkStepInvariants } from './invariants';
import { calculateMetrics } from './metrics';
import {
  computeBatteryStep,
  computeDemandStep,
  computeDischargeMaxKw,
  computeSolarStep,
} from './model';
import type { SectorDemandStep } from './model/demand';
import type {
  SectorCap,
  SectorId,
  SectorStep,
  SimulationInput,
  SimulationResult,
  StepResult,
  StrategyId,
} from './schemas';
import { executeStrategy } from './strategies';
import { generateWarnings } from './warnings';

function allocateWithCaps(
  strategy: StrategyId,
  availableKw: number,
  sectors: readonly SectorDemandStep[],
  activeCaps: readonly SectorCap[]
): Record<SectorId, SectorStep> {
  if (activeCaps.length === 0) {
    return executeStrategy(strategy, availableKw, sectors);
  }

  // Build sector -> cap map (minimum cap if multiple active for the same sector)
  const capMap = new Map<SectorId, number>();
  for (const c of activeCaps) {
    const existing = capMap.get(c.sector);
    capMap.set(c.sector, existing !== undefined ? Math.min(existing, c.maxKw) : c.maxKw);
  }

  const result: Partial<Record<SectorId, SectorStep>> = {};
  let currentAvailable = Math.max(0, availableKw);
  let uncappedSectors = [...sectors];

  while (uncappedSectors.length > 0) {
    const trialAllocation = executeStrategy(strategy, currentAvailable, uncappedSectors);
    const newlyConstrained: SectorDemandStep[] = [];

    for (const s of uncappedSectors) {
      const cap = capMap.get(s.sectorId);
      const allocated = trialAllocation[s.sectorId];
      if (cap !== undefined && allocated && allocated.servedKw > cap + EPS) {
        newlyConstrained.push(s);
      }
    }

    if (newlyConstrained.length === 0) {
      for (const s of uncappedSectors) {
        result[s.sectorId] = trialAllocation[s.sectorId];
      }
      break;
    }

    for (const s of newlyConstrained) {
      const cap = capMap.get(s.sectorId)!;
      const servedKw = Math.min(s.demandKw, cap);
      const criticalServedKw = Math.min(servedKw, s.criticalDemandKw);
      result[s.sectorId] = {
        demandKw: s.demandKw,
        servedKw,
        criticalDemandKw: s.criticalDemandKw,
        criticalServedKw,
      };
      currentAvailable = Math.max(0, currentAvailable - servedKw);
    }

    const constrainedIds = new Set(newlyConstrained.map((s) => s.sectorId));
    uncappedSectors = uncappedSectors.filter((s) => !constrainedIds.has(s.sectorId));
  }

  for (const s of sectors) {
    if (!result[s.sectorId]) {
      result[s.sectorId] = {
        demandKw: s.demandKw,
        servedKw: 0,
        criticalDemandKw: s.criticalDemandKw,
        criticalServedKw: 0,
      };
    }
  }

  return result as Record<SectorId, SectorStep>;
}

export function simulate(input: SimulationInput, strategy: StrategyId): SimulationResult {
  const inputHash = computeInputHash(input);
  const id = computeResultId(inputHash, strategy);

  let storedKwh = (input.battery.initialSocPct / 100) * input.battery.capacityKwh;
  let violations = 0;
  const steps: StepResult[] = new Array(HORIZON_H);

  for (let t = 0; t < HORIZON_H; t++) {
    const solarKw = computeSolarStep(input.solar, input.events, t);
    const demandResult = computeDemandStep(input.sectors, input.demandMultiplier, input.events, t);

    const { dischargeMaxKw } = computeDischargeMaxKw(input.battery, storedKwh);
    const availableKw = solarKw + dischargeMaxKw;

    const activeCaps = input.sectorCaps?.filter((c) => t >= c.fromHour && t < c.toHour) ?? [];

    const sectorSteps = allocateWithCaps(
      strategy,
      availableKw,
      demandResult.sectorList,
      activeCaps
    );

    let servedKw = 0;
    for (const sectorItem of demandResult.sectorList) {
      const stepForSec = sectorSteps[sectorItem.sectorId];
      if (stepForSec) {
        servedKw += stepForSec.servedKw;
      }
    }

    const batteryResult = computeBatteryStep(input.battery, storedKwh, solarKw, servedKw);

    const unservedKw = Math.max(0, demandResult.demandKw - servedKw);

    const stepResult: StepResult = {
      t,
      solarKw,
      demandKw: demandResult.demandKw,
      servedKw,
      unservedKw,
      batteryKw: batteryResult.batteryKw,
      socPct: batteryResult.socPct,
      curtailedKw: batteryResult.curtailedKw,
      sectors: sectorSteps,
    };

    violations += checkStepInvariants({
      t,
      step: stepResult,
      prevStoredKwh: storedKwh,
      newStoredKwh: batteryResult.storedKwh,
      availableKw,
      battery: input.battery,
      sectorCaps: input.sectorCaps,
    });

    storedKwh = batteryResult.storedKwh;
    steps[t] = stepResult;
  }

  const metrics = calculateMetrics(steps, input.battery, violations);
  const warnings = generateWarnings(steps, input.battery, input);

  return {
    id,
    inputHash,
    strategy,
    steps,
    metrics,
    warnings,
    engineVersion: ENGINE_VERSION,
  };
}
