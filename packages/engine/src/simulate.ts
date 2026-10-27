import { ENGINE_VERSION, HORIZON_H } from './constants';
import { computeInputHash, computeResultId } from './hash';
import { checkStepInvariants } from './invariants';
import { calculateMetrics } from './metrics';
import {
  computeBatteryStep,
  computeDemandStep,
  computeDischargeMaxKw,
  computeSolarStep,
} from './model';
import type { SimulationInput, SimulationResult, StepResult, StrategyId } from './schemas';
import { executeStrategy } from './strategies';
import { generateWarnings } from './warnings';

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

    const sectorSteps = executeStrategy(strategy, availableKw, demandResult.sectorList);

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
    });

    storedKwh = batteryResult.storedKwh;
    steps[t] = stepResult;
  }

  const metrics = calculateMetrics(steps, input.battery, violations);
  const warnings = generateWarnings(steps, input.battery);

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
