import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { resetSimulationStore, useSimulationStore } from '@/stores';
import { AUTO_COMPARE_DELAY_MS, useAutoCompare } from '../hooks/use-auto-compare';

describe('useAutoCompare (PZ-T3)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetSimulationStore();
  });
  afterEach(() => vi.useRealTimers());

  it('re-runs the comparison once after an input edit settles', () => {
    renderHook(() => useAutoCompare());
    act(() => {
      useSimulationStore.getState().patchInput({ solarDropPct: 40 });
      useSimulationStore.getState().patchInput({ solarDropPct: 50 });
    });
    expect(useSimulationStore.getState().status).toBe('modified');

    act(() => vi.advanceTimersByTime(AUTO_COMPARE_DELAY_MS - 1));
    expect(useSimulationStore.getState().status).toBe('modified');

    act(() => vi.advanceTimersByTime(1));
    const state = useSimulationStore.getState();
    expect(state.status).toBe('complete');
    expect(Object.keys(state.results)).toEqual(['proportional', 'essential_first', 'balanced']);
  });

  it('never runs while the input is not modified, or when disabled', () => {
    const run = vi.spyOn(useSimulationStore.getState(), 'run');
    renderHook(() => useAutoCompare());
    act(() => vi.advanceTimersByTime(AUTO_COMPARE_DELAY_MS * 2));
    expect(useSimulationStore.getState().status).toBe('ready');

    const { unmount } = renderHook(() => useAutoCompare(false));
    act(() => useSimulationStore.getState().patchInput({ demandMultiplier: 1.2 }));
    unmount();
    expect(run).not.toHaveBeenCalled();
  });
});
