import {
  DEFAULT_BALANCED_WEIGHTS,
  DEFAULT_DROP_DURATION_H,
  DEFAULT_DROP_START_HOUR,
} from './constants';
import { BalancedWeightsSchema, InputPatchSchema, parseInput } from './schemas';
import type { InputPatch, SimulationInput, SolarDropEvent } from './schemas';

export interface SolarDropSettings {
  /** Solar reduction in percent (0 = no drop event). */
  pct: number;
  startHour: number;
  durationH: number;
}

/** Current solar drop as control values; defaults when the input has no drop event. */
export function getSolarDrop(input: SimulationInput): SolarDropSettings {
  const drop = input.events.find((e) => e.type === 'solar_drop');
  return {
    pct: drop ? Math.round((1 - drop.factor) * 100) : 0,
    startHour: drop?.startHour ?? DEFAULT_DROP_START_HOUR,
    durationH: drop?.durationH ?? DEFAULT_DROP_DURATION_H,
  };
}

/**
 * Applies a partial patch to a SimulationInput, returning a new validated SimulationInput.
 * Does not mutate the original input. Throws ZodError if the patch or the patched input violates contract bounds.
 */
export function applyPatch(input: SimulationInput, rawPatch: InputPatch): SimulationInput {
  // Patches may come from the LLM: enforce InputPatch bounds (e.g. solarDropPct ≤ 90).
  return parseInput(patchInputUnchecked(input, InputPatchSchema.parse(rawPatch)));
}

/**
 * Same mapping as `applyPatch` without Zod validation of the patch or the result.
 * Only for hot loops whose values were already validated (see `sweep`). Never mutates `input`.
 */
export function patchInputUnchecked(input: SimulationInput, patch: InputPatch): SimulationInput {
  const cloned = structuredClone(input);
  cloned.scenarioId = 'custom';

  if (patch.demandMultiplier !== undefined) {
    cloned.demandMultiplier = patch.demandMultiplier;
  }

  if (patch.batteryCapacityKwh !== undefined) {
    cloned.battery.capacityKwh = patch.batteryCapacityKwh;
  }

  if (patch.initialSocPct !== undefined) {
    cloned.battery.initialSocPct = patch.initialSocPct;
  }

  if (patch.minSocPct !== undefined) {
    cloned.battery.minSocPct = patch.minSocPct;
  }

  if (patch.priorities !== undefined) {
    for (const [secId, priority] of Object.entries(patch.priorities)) {
      const s = cloned.sectors.find((sec) => sec.id === secId);
      if (s && priority) {
        s.priority = priority;
      }
    }
  }

  if (patch.sectorCaps !== undefined) {
    cloned.sectorCaps = patch.sectorCaps;
  }

  if (patch.meterReadings !== undefined) {
    for (const [secId, readings] of Object.entries(patch.meterReadings)) {
      const s = cloned.sectors.find((sec) => sec.id === secId);
      if (s && readings) {
        s.meterReadings = readings;
      }
    }
  }

  if (patch.criticalShares !== undefined) {
    for (const [secId, share] of Object.entries(patch.criticalShares)) {
      const s = cloned.sectors.find((sec) => sec.id === secId);
      if (s && share !== undefined) {
        s.criticalShare = share;
      }
    }
  }

  if (patch.balancedWeights !== undefined) {
    const currentWeights = cloned.strategyParams?.balancedWeights ?? {
      ...DEFAULT_BALANCED_WEIGHTS,
    };
    const mergedWeights = {
      ...currentWeights,
      ...patch.balancedWeights,
    };
    const finalWeights = {
      critical: mergedWeights.critical ?? DEFAULT_BALANCED_WEIGHTS.critical,
      high: mergedWeights.high ?? DEFAULT_BALANCED_WEIGHTS.high,
      medium: mergedWeights.medium ?? DEFAULT_BALANCED_WEIGHTS.medium,
      low: mergedWeights.low ?? DEFAULT_BALANCED_WEIGHTS.low,
    };
    cloned.strategyParams = {
      ...cloned.strategyParams,
      balancedWeights: BalancedWeightsSchema.parse(finalWeights),
    };
  }

  if (patch.lifeline !== undefined) {
    if (patch.lifeline.enabled !== undefined) {
      cloned.strategyParams = {
        ...cloned.strategyParams,
        lifeline: {
          enabled: patch.lifeline.enabled,
        },
      };
    }
    if (patch.lifeline.kw !== undefined) {
      for (const [secId, kw] of Object.entries(patch.lifeline.kw)) {
        const s = cloned.sectors.find((sec) => sec.id === secId);
        if (s && kw !== undefined) {
          s.lifelineKw = kw;
        }
      }
    }
  }

  const existingDrop = cloned.events.find((e) => e.type === 'solar_drop') as
    SolarDropEvent | undefined;

  if (patch.solarDropPct !== undefined) {
    if (patch.solarDropPct === 0) {
      cloned.events = cloned.events.filter((e) => e.type !== 'solar_drop');
    } else {
      const factor = 1 - patch.solarDropPct / 100;
      const startHour = patch.dropStartHour ?? existingDrop?.startHour ?? DEFAULT_DROP_START_HOUR;
      const durationH = patch.dropDurationH ?? existingDrop?.durationH ?? DEFAULT_DROP_DURATION_H;

      cloned.events = cloned.events.filter((e) => e.type !== 'solar_drop');
      cloned.events.push({
        type: 'solar_drop',
        startHour,
        durationH,
        factor,
      });
    }
  } else if (
    existingDrop &&
    (patch.dropStartHour !== undefined || patch.dropDurationH !== undefined)
  ) {
    if (patch.dropStartHour !== undefined) {
      existingDrop.startHour = patch.dropStartHour;
    }
    if (patch.dropDurationH !== undefined) {
      existingDrop.durationH = patch.dropDurationH;
    }
  }

  return cloned;
}
