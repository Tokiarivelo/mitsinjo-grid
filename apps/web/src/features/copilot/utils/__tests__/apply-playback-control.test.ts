import { describe, it, expect, vi } from 'vitest';
import { applyPlaybackControl, parsePlaybackControl } from '../apply-playback-control';

function fakeStore(isPlaying: boolean) {
  return {
    isPlaying,
    play: vi.fn(),
    pause: vi.fn(),
    stop: vi.fn(),
    restart: vi.fn(),
    setTimeIndex: vi.fn(),
  };
}

describe('applyPlaybackControl', () => {
  it.each(['play', 'pause', 'stop', 'restart'] as const)('%s calls the store action', (action) => {
    const store = fakeStore(false);
    applyPlaybackControl(store, { action });
    expect(store[action]).toHaveBeenCalledOnce();
  });

  it('seek pauses a running playback, then moves the cursor', () => {
    const store = fakeStore(true);
    applyPlaybackControl(store, { action: 'seek', hour: 18 });
    expect(store.pause).toHaveBeenCalledOnce();
    expect(store.setTimeIndex).toHaveBeenCalledWith(18);
  });
});

describe('parsePlaybackControl', () => {
  it('accepts valid commands only', () => {
    expect(parsePlaybackControl({ action: 'play' })).toEqual({ action: 'play' });
    expect(parsePlaybackControl({ action: 'seek', hour: 6 })).toEqual({ action: 'seek', hour: 6 });
    expect(parsePlaybackControl({ action: 'seek' })).toBeNull();
    expect(parsePlaybackControl({ action: 'seek', hour: 25 })).toBeNull();
    expect(parsePlaybackControl({ action: 'jump' })).toBeNull();
  });
});
