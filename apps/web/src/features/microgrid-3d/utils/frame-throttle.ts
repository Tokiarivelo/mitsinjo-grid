/** Ambient motion (electrons, clouds, rain, lightning) runs at this rate, not the display rate. */
export const AMBIENT_FPS = 30;

export interface FrameThrottle {
  /** Ask for one frame; calls `invalidate` at most once per interval, however many callers. */
  request: (invalidate: () => void) => void;
  /** Drop a pending frame (canvas unmount). */
  cancel: () => void;
}

/**
 * Caps the demand loop for ambient animation: every animated part asks for its next
 * frame here instead of calling `invalidate()` from `useFrame` (which renders at the
 * display rate, 60–120 fps, with the full post-processing stack). Clock and timer are
 * injectable for tests.
 */
export function createFrameThrottle(
  fps: number = AMBIENT_FPS,
  now: () => number = () => performance.now(),
  schedule: (cb: () => void, ms: number) => unknown = (cb, ms) => setTimeout(cb, ms),
  clear: (handle: unknown) => void = (h) => clearTimeout(h as ReturnType<typeof setTimeout>)
): FrameThrottle {
  const interval = 1000 / fps;
  let last = -Infinity;
  let pending: unknown = null;

  return {
    request(invalidate) {
      if (pending !== null) return;
      const wait = Math.max(0, interval - (now() - last));
      pending = schedule(() => {
        pending = null;
        last = now();
        invalidate();
      }, wait);
    },
    cancel() {
      if (pending !== null) clear(pending);
      pending = null;
    },
  };
}
