import { DEFAULT_LIFELINE_KW, ENGINE_VERSION, EPS, HORIZON_H } from './constants';
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
  Priority,
  SectorCap,
  SectorId,
  SectorStep,
  SimulationInput,
  SimulationResult,
  StepResult,
  StrategyId,
} from './schemas';
import { computeSectorMode, executeStrategy } from './strategies';
import { generateWarnings } from './warnings';

function allocateWithCaps(
  strategy: StrategyId,
  availableKw: number,
  sectors: readonly SectorDemandStep[],
  activeCaps: readonly SectorCap[],
  weights?: Record<Priority, number>,
  lifelineEnabled: boolean = true
): Record<SectorId, SectorStep> {
  if (activeCaps.length === 0) {
    return executeStrategy(strategy, availableKw, sectors, weights, lifelineEnabled);
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
    const trialAllocation = executeStrategy(
      strategy,
      currentAvailable,
      uncappedSectors,
      weights,
      lifelineEnabled,
      activeCaps
    );
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
      const rawFloor = s.lifelineKw ?? DEFAULT_LIFELINE_KW[s.sectorId];
      const effFloor = Math.min(rawFloor, cap);
      const lifelineServedKw = Math.min(servedKw, effFloor);
      const mode = computeSectorMode(servedKw, s.demandKw, effFloor);
      result[s.sectorId] = {
        demandKw: s.demandKw,
        servedKw,
        criticalDemandKw: s.criticalDemandKw,
        criticalServedKw,
        lifelineServedKw,
        mode,
      };
      currentAvailable = Math.max(0, currentAvailable - servedKw);
    }

    const constrainedIds = new Set(newlyConstrained.map((s) => s.sectorId));
    uncappedSectors = uncappedSectors.filter((s) => !constrainedIds.has(s.sectorId));
  }

  for (const s of sectors) {
    if (!result[s.sectorId]) {
      const cap = capMap.get(s.sectorId);
      const rawFloor = s.lifelineKw ?? DEFAULT_LIFELINE_KW[s.sectorId];
      const effFloor = cap !== undefined ? Math.min(rawFloor, cap) : rawFloor;
      result[s.sectorId] = {
        demandKw: s.demandKw,
        servedKw: 0,
        criticalDemandKw: s.criticalDemandKw,
        criticalServedKw: 0,
        lifelineServedKw: 0,
        mode: computeSectorMode(0, s.demandKw, effFloor),
      };
    }
  }

  return result as Record<SectorId, SectorStep>;
}

export interface SimStepsOutput {
  steps: StepResult[];
  metrics: ReturnType<typeof calculateMetrics>;
  violations: number;
}

export function simulateSteps(input: SimulationInput, strategy: StrategyId): SimStepsOutput {
  let storedKwh = (input.battery.initialSocPct / 100) * input.battery.capacityKwh;
  let violations = 0;
  const steps: StepResult[] = new Array(HORIZON_H);
  const lifelineEnabled = input.strategyParams?.lifeline?.enabled !== false;

  const lifelinesRecord: Partial<Record<SectorId, number>> = {};
  for (const s of input.sectors) {
    lifelinesRecord[s.id] = s.lifelineKw ?? DEFAULT_LIFELINE_KW[s.id];
  }

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
      activeCaps,
      input.strategyParams?.balancedWeights,
      lifelineEnabled
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
      lifelines: lifelinesRecord,
      lifelineEnabled,
    });

    storedKwh = batteryResult.storedKwh;
    steps[t] = stepResult;
  }

  const metrics = calculateMetrics(steps, input.battery, violations, input.sectors);
  return { steps, metrics, violations };
}

export function simulate(input: SimulationInput, strategy: StrategyId): SimulationResult {
  const inputHash = computeInputHash(input);
  const id = computeResultId(inputHash, strategy);
  const { steps, metrics } = simulateSteps(input, strategy);
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
