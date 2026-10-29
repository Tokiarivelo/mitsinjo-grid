'use client';

import { useCallback, useState } from 'react';
import type { InputPatch, SimulationInput } from '@mitsinjo/engine';
import { useTranslations } from '@/lib/i18n';
import { validatePatch } from '../utils/validate-patch';

/** The three solar-drop controls are validated together: one valid move clears all of them. */
export const DROP_FIELDS: ReadonlyArray<keyof InputPatch> = [
  'solarDropPct',
  'dropStartHour',
  'dropDurationH',
];

export function withoutDropErrors(errors: Record<string, string>): Record<string, string> {
  const rest = { ...errors };
  for (const f of DROP_FIELDS) delete rest[f];
  return rest;
}

/**
 * Validates one control's candidate patch before dispatching it. Invalid → translated inline
 * error keyed by field, nothing dispatched (never clamps). Valid → error cleared, patch sent.
 */
export function usePatchValidation(input: SimulationInput, onPatch: (patch: InputPatch) => void) {
  const tSim = useTranslations('features.simulation');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateAndPatch = useCallback(
    (field: keyof InputPatch, candidate: InputPatch) => {
      const error = validatePatch(field, candidate, input);
      if (error) {
        setErrors((prev) => ({ ...prev, [field]: tSim(`errors.${error.key}`, error.params) }));
        return false;
      }
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return DROP_FIELDS.includes(field) ? withoutDropErrors(next) : next;
      });
      onPatch(candidate);
      return true;
    },
    [input, onPatch, tSim]
  );

  return { errors, setErrors, validateAndPatch };
}
