'use client';

import { useEffect } from 'react';
import { useSimulationStore } from '@/stores/simulation.store';

/** One simulated hour per tick while playing (smooth & responsive). */
export const PLAYBACK_TICK_MS = 500;

/** Advances the store's time cursor (hour, then workflow day) while playback is on. */
export function usePlaybackTicker(isPlaying: boolean) {
  useEffect(() => {
    if (!isPlaying) return;
    const id = window.setInterval(() => {
      useSimulationStore.getState().advancePlayback();
    }, PLAYBACK_TICK_MS);
    return () => window.clearInterval(id);
  }, [isPlaying]);
}
