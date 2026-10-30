import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { glidePos, scrubHour, SCRUB_SETTLE_MS, useSmoothScrub } from '../hooks/use-smooth-scrub';

describe('glidePos', () => {
  it('starts at from, ends at to and eases out in between', () => {
    expect(glidePos(2, 3, 0, 100)).toBe(2);
    expect(glidePos(2, 3, 100, 100)).toBe(3);
    expect(glidePos(2, 3, 50, 100)).toBeGreaterThan(2.5); // ease-out is ahead of linear
  });

  it('moves linearly when asked and jumps when the duration is 0', () => {
    expect(glidePos(0, 1, 25, 100, true)).toBeCloseTo(0.25);
    expect(glidePos(0, 1, 0, 0)).toBe(1);
  });
});

describe('scrubHour', () => {
  it('rounds to the nearest hour and clamps to the day', () => {
    expect(scrubHour(14.4, 23)).toBe(14);
    expect(scrubHour(14.6, 23)).toBe(15);
    expect(scrubHour(-1, 23)).toBe(0);
    expect(scrubHour(30, 23)).toBe(23);
  });
});

describe('useSmoothScrub', () => {
  let now = 0;
  beforeEach(() => {
    now = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) =>
      setTimeout(() => cb(now), 16)
    );
    vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id));
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const tick = (ms: number) =>
    act(() => {
      for (let t = 0; t < ms; t += 16) {
        now += 16;
        vi.advanceTimersByTime(16);
      }
    });

  it('follows the pointer continuously but seeks only whole hours', () => {
    const onSeek = vi.fn();
    const { result } = renderHook(() => useSmoothScrub({ max: 23, value: 10, onSeek }));
    act(() => result.current.onDragStart());
    act(() => result.current.onInput(10.3));
    expect(result.current.pos).toBeCloseTo(10.3);
    expect(onSeek).not.toHaveBeenCalled();
    act(() => result.current.onInput(10.7));
    expect(onSeek).toHaveBeenCalledWith(11);
  });

  it('settles on the shown hour after release', () => {
    const onSeek = vi.fn();
    const { result, rerender } = renderHook(
      ({ v }) => useSmoothScrub({ max: 23, value: v, onSeek }),
      {
        initialProps: { v: 10 },
      }
    );
    act(() => result.current.onDragStart());
    act(() => result.current.onInput(10.7));
    rerender({ v: 11 });
    act(() => window.dispatchEvent(new Event('pointerup')));
    tick(SCRUB_SETTLE_MS + 32);
    expect(result.current.pos).toBe(11);
  });

  it('glides to a new store hour instead of jumping, but snaps on 23 → 0', () => {
    const { result, rerender } = renderHook(
      ({ v }) => useSmoothScrub({ max: 23, value: v, onSeek: vi.fn(), playingGlideMs: 500 }),
      { initialProps: { v: 22 } }
    );
    rerender({ v: 23 });
    tick(240);
    expect(result.current.pos).toBeGreaterThan(22.3);
    expect(result.current.pos).toBeLessThan(22.7);
    tick(300);
    expect(result.current.pos).toBe(23);
    rerender({ v: 0 });
    expect(result.current.pos).toBe(0);
  });

  it('runs as a live clock toward the next hour while following the scale model', () => {
    const { result, rerender } = renderHook(
      ({ v }) => useSmoothScrub({ max: 23, value: v, onSeek: vi.fn(), leadMs: 1000 }),
      { initialProps: { v: 9 } }
    );
    tick(496);
    expect(result.current.pos).toBeGreaterThan(9.4);
    expect(result.current.pos).toBeLessThan(9.6);
    tick(520);
    expect(result.current.pos).toBe(10);
    rerender({ v: 10 }); // next model hour: carries on without a jump
    expect(result.current.pos).toBe(10);
    tick(496);
    expect(result.current.pos).toBeGreaterThan(10.4);
  });
});
