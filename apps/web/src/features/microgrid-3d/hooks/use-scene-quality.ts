import { useCallback, useSyncExternalStore } from 'react';

/**
 * 3D render quality tier.
 * - `high` (default): HDRI lighting, real-time sun shadows, post-processing, dense forest.
 * - `low`: lightweight look for weak GPUs (no post-processing, baked contact shadow, light forest).
 * A user choice is remembered per browser; without one, a slow device is auto-downgraded once.
 */
export type SceneQuality = 'high' | 'low';

export const SCENE_QUALITY_STORAGE_KEY = 'mitsinjo.sceneQuality';
/** Median fps below this during the probe window → auto-downgrade to `low`. */
export const AUTO_DOWNGRADE_FPS = 28;
export const MIN_PROBE_SAMPLES = 20;

interface QualityState {
  quality: SceneQuality;
  /** True when the user picked the tier (auto-downgrade never overrides it). */
  userChosen: boolean;
}

function readStored(): SceneQuality | null {
  try {
    const v = window.localStorage.getItem(SCENE_QUALITY_STORAGE_KEY);
    return v === 'high' || v === 'low' ? v : null;
  } catch {
    return null;
  }
}

let state: QualityState | null = null;
const listeners = new Set<() => void>();

/** `?quality=high|low` forces a tier (audits, screenshots); not persisted. */
function readUrlOverride(): SceneQuality | null {
  try {
    const v = new URLSearchParams(window.location.search).get('quality');
    return v === 'high' || v === 'low' ? v : null;
  } catch {
    return null;
  }
}

function getState(): QualityState {
  if (!state) {
    const chosen = typeof window === 'undefined' ? null : (readUrlOverride() ?? readStored());
    state = { quality: chosen ?? 'high', userChosen: chosen !== null };
  }
  return state;
}

function setState(next: QualityState) {
  state = next;
  listeners.forEach((l) => l());
}

const SERVER_STATE: QualityState = { quality: 'high', userChosen: false };

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Pure: should the probe's fps samples trigger a downgrade? */
export function shouldAutoDowngrade(fpsSamples: number[], threshold = AUTO_DOWNGRADE_FPS): boolean {
  if (fpsSamples.length < MIN_PROBE_SAMPLES) return false;
  const sorted = [...fpsSamples].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
  return median < threshold;
}

/** Test helper: forget the in-memory tier (storage is read again on next access). */
export function resetSceneQualityForTests() {
  state = null;
}

export function useSceneQuality() {
  const current = useSyncExternalStore(subscribe, getState, () => SERVER_STATE);

  const setQuality = useCallback((quality: SceneQuality) => {
    try {
      window.localStorage.setItem(SCENE_QUALITY_STORAGE_KEY, quality);
    } catch {
      // Private mode / blocked storage: keep the choice for this session only.
    }
    setState({ quality, userChosen: true });
  }, []);

  /** Called by the in-scene fps probe. No-op if the user chose a tier. */
  const autoDowngrade = useCallback(() => {
    const s = getState();
    if (s.userChosen || s.quality === 'low') return;
    setState({ quality: 'low', userChosen: false });
  }, []);

  return {
    quality: current.quality,
    userChosen: current.userChosen,
    setQuality,
    autoDowngrade,
  };
}
