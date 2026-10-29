'use client';

import { useState } from 'react';
import { getSolarDrop, type InputPatch, type SimulationInput } from '@mitsinjo/engine';
import type { SimStatus } from '@/stores';
import { useTranslations } from '@/lib/i18n';
import { usePatchValidation, withoutDropErrors } from './use-patch-validation';

export type ConditionField =
  | 'solarDropPct'
  | 'dropStartHour'
  | 'dropDurationH'
  | 'demandMultiplier'
  | 'batteryCapacityKwh'
  | 'initialSocPct';

export const ALL_CONDITION_FIELDS: readonly ConditionField[] = [
  'solarDropPct',
  'dropStartHour',
  'dropDurationH',
  'demandMultiplier',
  'batteryCapacityKwh',
  'initialSocPct',
];

export interface ConditionControl {
  field: ConditionField;
  label: string;
  description: string;
  value: number;
  unit: string;
  min: number;
  max: number;
  step: number;
  error?: string;
  onChange: (val: number) => void;
}

/**
 * Scenario condition sliders (solar drop, demand, battery) shared by every screen that edits the input.
 * Start/duration keep a draft so a rejected value stays visible until a compensating move makes
 * start + duration fit the horizon. Drafts follow the committed input again on reset or run.
 */
export function useConditionControls(
  input: SimulationInput,
  status: SimStatus,
  onPatch: (patch: InputPatch) => void
) {
  const tSim = useTranslations('features.simulation');
  const { errors, setErrors, validateAndPatch } = usePatchValidation(input, onPatch);
  const { pct: dropPct, startHour, durationH } = getSolarDrop(input);

  const [draftStart, setDraftStart] = useState<number>(startHour);
  const [draftDuration, setDraftDuration] = useState<number>(durationH);

  // Sync drafts during render (no cascading effect) when the input or status changes
  const [prevInput, setPrevInput] = useState(input);
  const [prevStatus, setPrevStatus] = useState(status);
  if (prevInput !== input || prevStatus !== status) {
    setPrevInput(input);
    setPrevStatus(status);
    if (status === 'ready' || status === 'complete') {
      setDraftStart(startHour);
      setDraftDuration(durationH);
      setErrors((prev) => (status === 'ready' ? {} : withoutDropErrors(prev)));
    }
  }

  const base: Omit<ConditionControl, 'error'>[] = [
    {
      field: 'solarDropPct',
      label: tSim('solarDropPct'),
      description: tSim('solarDropDesc'),
      value: dropPct,
      unit: '%',
      min: 0,
      max: 90,
      step: 5,
      onChange: (val) =>
        validateAndPatch('solarDropPct', {
          solarDropPct: val,
          dropStartHour: draftStart,
          dropDurationH: draftDuration,
        }),
    },
    {
      field: 'dropStartHour',
      label: tSim('dropStartHour'),
      description: tSim('dropStartDesc'),
      value: draftStart,
      unit: 'h',
      min: 0,
      max: 23,
      step: 1,
      onChange: (val) => {
        setDraftStart(val);
        validateAndPatch('dropStartHour', {
          dropStartHour: val,
          dropDurationH: draftDuration,
          solarDropPct: dropPct,
        });
      },
    },
    {
      field: 'dropDurationH',
      label: tSim('dropDuration'),
      description: tSim('dropDurationDesc'),
      value: draftDuration,
      unit: 'h',
      min: 1,
      max: 24,
      step: 1,
      onChange: (val) => {
        setDraftDuration(val);
        validateAndPatch('dropDurationH', {
          dropDurationH: val,
          dropStartHour: draftStart,
          solarDropPct: dropPct,
        });
      },
    },
    {
      field: 'demandMultiplier',
      label: tSim('demandMultiplier'),
      description: tSim('demandMultiplierDesc'),
      value: input.demandMultiplier,
      unit: '×',
      min: 0.5,
      max: 2.0,
      step: 0.1,
      // Round to 1 decimal place to prevent floating point noise
      onChange: (val) =>
        validateAndPatch('demandMultiplier', { demandMultiplier: Math.round(val * 10) / 10 }),
    },
    {
      field: 'batteryCapacityKwh',
      label: tSim('batteryCapacity'),
      description: tSim('batteryCapacityDesc'),
      value: input.battery.capacityKwh,
      unit: 'kWh',
      min: 1,
      max: 2000,
      step: 10,
      onChange: (val) => validateAndPatch('batteryCapacityKwh', { batteryCapacityKwh: val }),
    },
    {
      field: 'initialSocPct',
      label: tSim('initialSoc'),
      description: tSim('initialSocDesc'),
      value: input.battery.initialSocPct,
      unit: '%',
      min: 0,
      max: 100,
      step: 5,
      onChange: (val) => validateAndPatch('initialSocPct', { initialSocPct: val }),
    },
  ];
  const controls: ConditionControl[] = base.map((c) => ({ ...c, error: errors[c.field] }));

  const hasErrors = Object.keys(errors).length > 0;
  const draftsDirty = draftStart !== startHour || draftDuration !== durationH;

  /** Clear errors and drafts before the caller resets the store input. */
  const resetControls = () => {
    setErrors({});
    setDraftStart(startHour);
    setDraftDuration(durationH);
  };

  return { controls, errors, hasErrors, draftsDirty, resetControls };
}
