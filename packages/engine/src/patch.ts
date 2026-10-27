import { InputPatchSchema, parseInput } from './schemas';
import type { InputPatch, SimulationInput, SolarDropEvent } from './schemas';

/**
 * Applies a partial patch to a SimulationInput, returning a new validated SimulationInput.
 * Does not mutate the original input. Throws ZodError if the patch or the patched input violates contract bounds.
 */
export function applyPatch(input: SimulationInput, rawPatch: InputPatch): SimulationInput {
  // Patches may come from the LLM: enforce InputPatch bounds (e.g. solarDropPct ≤ 90).
  const patch = InputPatchSchema.parse(rawPatch);
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

  const existingDrop = cloned.events.find((e) => e.type === 'solar_drop') as
    SolarDropEvent | undefined;

  if (patch.solarDropPct !== undefined) {
    if (patch.solarDropPct === 0) {
      cloned.events = cloned.events.filter((e) => e.type !== 'solar_drop');
    } else {
      const factor = 1 - patch.solarDropPct / 100;
      const startHour = patch.dropStartHour ?? existingDrop?.startHour ?? 12;
      const durationH = patch.dropDurationH ?? existingDrop?.durationH ?? 3;

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

  return parseInput(cloned);
}
