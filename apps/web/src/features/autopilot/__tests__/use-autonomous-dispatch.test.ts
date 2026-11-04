import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { resetSimulationStore, useSimulationStore } from '@/stores';
import { useAutonomousDispatch } from '../use-autonomous-dispatch';

const playDay = () => {
  for (let h = 0; h < 24; h++) act(() => useSimulationStore.setState({ timeIndex: h }));
};
const keys = () =>
  useSimulationStore
    .getState()
    .dispatchLog.map((e) => `${e.day}:${e.hour}:${e.incident?.kind ?? e.action?.kind}`);

describe('useAutonomousDispatch', () => {
  beforeEach(() => {
    resetSimulationStore();
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response('{}')))
    );
  });

  it('logs each simulated hour once, even when playback loops over the same day', () => {
    act(() => useSimulationStore.setState({ dispatchMode: 'autonomous', timeIndex: 0 }));
    renderHook(() => useAutonomousDispatch());
    playDay();
    const firstPass = keys();
    expect(firstPass.length).toBeGreaterThan(0);
    playDay(); // loop / restart / scrub back over hours already decided
    expect(keys()).toEqual(firstPass);
  });
});
