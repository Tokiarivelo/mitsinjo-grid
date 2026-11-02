import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { resetSimulationStore, useSimulationStore } from '@/stores';
import { useAutopilot } from '../use-autopilot';

describe('useAutopilot (M10-T1)', () => {
  beforeEach(() => {
    resetSimulationStore();
    act(() => {
      useSimulationStore.getState().loadScenario('essential_stress');
    });
  });

  it('off by default; enabling evaluates the current hour once', () => {
    act(() => {
      useSimulationStore.getState().setTimeIndex(18);
    });
    const { result } = renderHook(() => useAutopilot());
    expect(result.current.enabled).toBe(false);
    expect(result.current.pending).toBeNull();

    act(() => {
      result.current.setEnabled(true);
    });
    // essential_stress h18 under proportional: clinic short → strategy switch.
    expect(result.current.pending?.suggestion.rule).toBe('strategy');
    expect(result.current.pending?.hour).toBe(18);
    expect(result.current.history).toHaveLength(1);
  });

  it('a new hour replaces the pending suggestion (old one expires)', () => {
    const { result } = renderHook(() => useAutopilot());
    act(() => {
      useSimulationStore.getState().setTimeIndex(19);
      result.current.setEnabled(true);
    });
    expect(result.current.pending?.hour).toBe(19);

    act(() => {
      useSimulationStore.getState().setTimeIndex(20);
    });
    expect(result.current.pending?.hour).toBe(20);
    expect(result.current.history.find((e) => e.hour === 19)?.decision).toBe('expired');
  });

  it('accept applies the change, refuse records it — both clear pending', () => {
    const { result } = renderHook(() => useAutopilot());
    act(() => {
      useSimulationStore.getState().setTimeIndex(18);
      result.current.setEnabled(true);
    });
    const pending = result.current.pending!;
    act(() => {
      result.current.accept(pending.id);
    });
    expect(useSimulationStore.getState().activeStrategy).toBe('essential_first');
    expect(result.current.pending).toBeNull();
    expect(result.current.history[0]?.decision).toBe('accepted');

    act(() => {
      useSimulationStore.getState().setTimeIndex(20);
    });
    const second = result.current.pending!;
    act(() => {
      result.current.refuse(second.id);
    });
    expect(result.current.history.find((e) => e.hour === 20)?.decision).toBe('refused');
    expect(result.current.pending).toBeNull();
  });

  it('open envelope auto-applies the strategy switch, no tap (M10-T3)', () => {
    const { result } = renderHook(() => useAutopilot());
    act(() => {
      useSimulationStore.getState().setTimeIndex(18);
      result.current.setEnvelope({ strategyChange: true, clinicFloor: false });
      result.current.setEnabled(true);
    });
    // Applied alone: no pending, history shows auto-accepted.
    expect(result.current.pending).toBeNull();
    expect(useSimulationStore.getState().activeStrategy).toBe('essential_first');
    expect(result.current.history[0]?.decision).toBe('accepted');
    expect(result.current.history[0]?.auto).toBe(true);
  });

  it('closed envelope keeps the lifeline suggestion pending (M10-T3)', () => {
    const { result } = renderHook(() => useAutopilot());
    act(() => {
      useSimulationStore.setState({ activeStrategy: 'essential_first' });
      useSimulationStore.getState().setTimeIndex(20);
      result.current.setEnvelope({ strategyChange: true, clinicFloor: false });
      result.current.setEnabled(true);
    });
    // h20 under essential_first: R2 lifeline is outside the envelope → tap needed.
    expect(result.current.pending?.suggestion.rule).toBe('lifeline');
    expect(result.current.pending?.auto).toBe(false);
  });

  it('quiet hours produce nothing', () => {
    act(() => {
      useSimulationStore.getState().loadScenario('baseline');
      useSimulationStore.getState().setTimeIndex(12);
    });
    const { result } = renderHook(() => useAutopilot());
    act(() => {
      result.current.setEnabled(true);
    });
    expect(result.current.pending).toBeNull();
    expect(result.current.history).toHaveLength(0);
  });
});
