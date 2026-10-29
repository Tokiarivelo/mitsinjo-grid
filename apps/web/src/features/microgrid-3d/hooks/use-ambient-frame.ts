import { useCallback, useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { createFrameThrottle, type FrameThrottle } from '../utils/frame-throttle';

/** One throttle per canvas (keyed by its `invalidate`), shared by every animated part. */
const throttles = new WeakMap<() => void, { throttle: FrameThrottle; users: number }>();

/**
 * Returns `requestFrame()`: call it from `useFrame` to keep an ambient animation going
 * at `AMBIENT_FPS`. When the canvas is paused (`frameloop="never"`, off-screen) the
 * request is a no-op, so the chain stops by itself.
 */
export function useAmbientFrame(): () => void {
  const invalidate = useThree((s) => s.invalidate);

  useEffect(() => {
    let entry = throttles.get(invalidate);
    if (!entry) {
      entry = { throttle: createFrameThrottle(), users: 0 };
      throttles.set(invalidate, entry);
    }
    entry.users++;
    return () => {
      const e = throttles.get(invalidate);
      if (!e) return;
      e.users--;
      if (e.users <= 0) {
        e.throttle.cancel();
        throttles.delete(invalidate);
      }
    };
  }, [invalidate]);

  return useCallback(() => {
    let entry = throttles.get(invalidate);
    if (!entry) {
      // First frame can run before the effect above registered the throttle.
      entry = { throttle: createFrameThrottle(), users: 0 };
      throttles.set(invalidate, entry);
    }
    entry.throttle.request(() => invalidate());
  }, [invalidate]);
}
