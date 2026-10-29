import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { scenarios } from '@mitsinjo/engine';
import { ALL_CONDITION_FIELDS, useConditionControls } from '../hooks/use-condition-controls';
import { usePatchValidation } from '../hooks/use-patch-validation';

const input = scenarios.baseline.input;

describe('usePatchValidation', () => {
  it('dispatches valid patches and keeps invalid ones as inline errors', () => {
    const onPatch = vi.fn();
    const { result } = renderHook(() => usePatchValidation(input, onPatch));

    act(() => void result.current.validateAndPatch('demandMultiplier', { demandMultiplier: 5 }));
    expect(onPatch).not.toHaveBeenCalled();
    expect(result.current.errors.demandMultiplier).toMatch(/allowed range/i);

    act(() => void result.current.validateAndPatch('demandMultiplier', { demandMultiplier: 1.2 }));
    expect(onPatch).toHaveBeenCalledWith({ demandMultiplier: 1.2 });
    expect(result.current.errors.demandMultiplier).toBeUndefined();
  });
});

describe('useConditionControls', () => {
  it('exposes the six condition controls bound to the input', () => {
    const { result } = renderHook(() => useConditionControls(input, 'ready', vi.fn()));
    expect(result.current.controls.map((c) => c.field)).toEqual(ALL_CONDITION_FIELDS);
    expect(result.current.controls.find((c) => c.field === 'batteryCapacityKwh')?.value).toBe(
      input.battery.capacityKwh
    );
  });

  it('keeps a rejected drop window as a dirty draft until reset', () => {
    const onPatch = vi.fn();
    const { result } = renderHook(() => useConditionControls(input, 'ready', onPatch));
    const duration = () => result.current.controls.find((c) => c.field === 'dropDurationH')!;

    act(() => result.current.controls.find((c) => c.field === 'dropStartHour')!.onChange(20));
    act(() => duration().onChange(10));
    expect(duration().value).toBe(10);
    expect(duration().error).toBeDefined();
    expect(result.current.hasErrors).toBe(true);
    expect(result.current.draftsDirty).toBe(true);

    act(() => result.current.resetControls());
    expect(result.current.hasErrors).toBe(false);
    expect(result.current.draftsDirty).toBe(false);
  });

  it('rounds the demand multiplier before patching', () => {
    const onPatch = vi.fn();
    const { result } = renderHook(() => useConditionControls(input, 'ready', onPatch));
    act(() =>
      result.current.controls.find((c) => c.field === 'demandMultiplier')!.onChange(1.2000001)
    );
    expect(onPatch).toHaveBeenCalledWith({ demandMultiplier: 1.2 });
  });
});
