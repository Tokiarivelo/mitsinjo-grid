import {
  HORIZON_H,
  InputPatchSchema,
  type InputPatch,
  type SimulationInput,
} from '@mitsinjo/engine';

/** i18n key (under `features.simulation.errors`) + params for an invalid patch field. */
export interface PatchError {
  key: 'outOfRange' | 'dropExceedsHorizon' | 'initialBelowMinSoc';
  params?: Record<string, number>;
}

/**
 * Validate a candidate patch for one control. Returns null when valid.
 * Never clamps: the caller shows the error and does not dispatch the patch.
 */
export function validatePatch(
  field: keyof InputPatch,
  candidate: InputPatch,
  input: SimulationInput
): PatchError | null {
  const parsed = InputPatchSchema.safeParse(candidate);
  if (!parsed.success && parsed.error.issues.some((i) => i.path.includes(field))) {
    return { key: 'outOfRange' };
  }

  if (field === 'dropStartHour' || field === 'dropDurationH') {
    const drop = input.events.find((e) => e.type === 'solar_drop');
    const start = candidate.dropStartHour ?? drop?.startHour ?? 0;
    const duration = candidate.dropDurationH ?? drop?.durationH ?? 0;
    if (start + duration > HORIZON_H) return { key: 'dropExceedsHorizon' };
  }

  if (field === 'initialSocPct') {
    const value = candidate.initialSocPct ?? input.battery.initialSocPct;
    if (value <= input.battery.minSocPct) {
      return { key: 'initialBelowMinSoc', params: { min: input.battery.minSocPct } };
    }
  }

  return null;
}
