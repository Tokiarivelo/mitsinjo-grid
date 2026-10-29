import { describe, expect, it, vi } from 'vitest';
import { AMBIENT_FPS, createFrameThrottle } from '../frame-throttle';

function fakeClock() {
  let t = 0;
  const timers: { cb: () => void; at: number }[] = [];
  return {
    now: () => t,
    schedule: (cb: () => void, ms: number) => {
      const timer = { cb, at: t + ms };
      timers.push(timer);
      return timer;
    },
    clear: (h: unknown) => {
      const i = timers.indexOf(h as (typeof timers)[number]);
      if (i >= 0) timers.splice(i, 1);
    },
    advance(ms: number) {
      t += ms;
      for (const timer of [...timers]) {
        if (timer.at <= t) {
          timers.splice(timers.indexOf(timer), 1);
          timer.cb();
        }
      }
    },
    pending: () => timers.length,
  };
}

describe('createFrameThrottle', () => {
  it('defaults to 30 fps for ambient motion', () => {
    expect(AMBIENT_FPS).toBe(30);
  });

  it('fires the first request right away', () => {
    const c = fakeClock();
    const throttle = createFrameThrottle(30, c.now, c.schedule, c.clear);
    const invalidate = vi.fn();
    throttle.request(invalidate);
    c.advance(0);
    expect(invalidate).toHaveBeenCalledTimes(1);
  });

  it('merges requests from many animated parts into one frame per interval', () => {
    const c = fakeClock();
    const throttle = createFrameThrottle(30, c.now, c.schedule, c.clear);
    const invalidate = vi.fn();
    throttle.request(invalidate);
    c.advance(0);
    // Electrons, clouds and rain all ask during the same frame.
    throttle.request(invalidate);
    throttle.request(invalidate);
    throttle.request(invalidate);
    expect(c.pending()).toBe(1);
    c.advance(20);
    expect(invalidate).toHaveBeenCalledTimes(1);
    c.advance(14);
    expect(invalidate).toHaveBeenCalledTimes(2);
  });

  it('caps a 1 s request chain at the target rate', () => {
    const c = fakeClock();
    const throttle = createFrameThrottle(30, c.now, c.schedule, c.clear);
    let frames = 0;
    const invalidate = () => {
      frames++;
      throttle.request(invalidate); // the next useFrame asks again
    };
    throttle.request(invalidate);
    for (let ms = 0; ms < 1000; ms += 1) c.advance(1);
    expect(frames).toBeGreaterThanOrEqual(29);
    expect(frames).toBeLessThanOrEqual(31);
  });

  it('cancel drops the pending frame', () => {
    const c = fakeClock();
    const throttle = createFrameThrottle(30, c.now, c.schedule, c.clear);
    const invalidate = vi.fn();
    throttle.request(invalidate);
    throttle.cancel();
    c.advance(100);
    expect(invalidate).not.toHaveBeenCalled();
  });
});
