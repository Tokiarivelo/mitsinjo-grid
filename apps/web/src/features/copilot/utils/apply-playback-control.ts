import type { SimulationState } from '@/stores/simulation.store';
import type { PlaybackControl } from '../types';

type PlaybackStore = Pick<
  SimulationState,
  'play' | 'pause' | 'stop' | 'restart' | 'setTimeIndex' | 'isPlaying'
>;

/** Runs a copilot playback command on the simulation store. Seeking pauses playback first. */
export function applyPlaybackControl(store: PlaybackStore, control: PlaybackControl): void {
  switch (control.action) {
    case 'play':
      store.play();
      return;
    case 'pause':
      store.pause();
      return;
    case 'stop':
      store.stop();
      return;
    case 'restart':
      store.restart();
      return;
    case 'seek':
      if (control.hour === undefined) return;
      if (store.isPlaying) store.pause();
      store.setTimeIndex(control.hour);
  }
}

/** Reads a `control` SSE payload; null when it is not a valid command. */
export function parsePlaybackControl(data: Record<string, unknown>): PlaybackControl | null {
  const actions = ['play', 'pause', 'stop', 'restart', 'seek'] as const;
  const action = actions.find((a) => a === data.action);
  if (!action) return null;
  const hour =
    typeof data.hour === 'number' &&
    Number.isInteger(data.hour) &&
    data.hour >= 0 &&
    data.hour <= 23
      ? data.hour
      : undefined;
  if (action === 'seek' && hour === undefined) return null;
  return action === 'seek' ? { action, hour } : { action };
}
