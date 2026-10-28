import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { initialSimulationData, useSimulationStore } from '@/stores/simulation.store';
import { PLAYBACK_TICK_MS, usePlaybackTicker } from '../hooks/use-playback-ticker';

describe('usePlaybackTicker', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useSimulationStore.setState({ ...initialSimulationData, timeIndex: 22 });
  });
  afterEach(() => vi.useRealTimers());

  it('advances one hour per tick and loops after 23:00', () => {
    renderHook(() => usePlaybackTicker(true));
    vi.advanceTimersByTime(PLAYBACK_TICK_MS);
    expect(useSimulationStore.getState().timeIndex).toBe(23);
    vi.advanceTimersByTime(PLAYBACK_TICK_MS);
    expect(useSimulationStore.getState().timeIndex).toBe(0);
  });

  it('does nothing while paused and stops on unmount', () => {
    const { rerender, unmount } = renderHook(({ on }) => usePlaybackTicker(on), {
      initialProps: { on: false },
    });
    vi.advanceTimersByTime(PLAYBACK_TICK_MS * 3);
    expect(useSimulationStore.getState().timeIndex).toBe(22);
    rerender({ on: true });
    unmount();
    vi.advanceTimersByTime(PLAYBACK_TICK_MS * 3);
    expect(useSimulationStore.getState().timeIndex).toBe(22);
  });
});
