'use client';

import { useEffect } from 'react';
import { useSimulationStore } from '@/stores/simulation.store';
import { nextPlaybackHour } from '../utils/playback';

/** One simulated hour per tick while playing. */
export const PLAYBACK_TICK_MS = 750;

/** Advances the store's 24h time cursor while playback is on. */
export function usePlaybackTicker(isPlaying: boolean) {
  useEffect(() => {
    if (!isPlaying) return;
    const id = window.setInterval(() => {
      const { timeIndex, setTimeIndex } = useSimulationStore.getState();
      setTimeIndex(nextPlaybackHour(timeIndex));
    }, PLAYBACK_TICK_MS);
    return () => window.clearInterval(id);
  }, [isPlaying]);
}
