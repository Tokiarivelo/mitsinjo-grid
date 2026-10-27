import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useReducedMotion } from '../use-reduced-motion';
import { useWebGLAvailable } from '../use-webgl-available';

function mockMatchMedia(initial: boolean) {
  let matches = initial;
  const listeners = new Set<() => void>();
  const mql = {
    get matches() {
      return matches;
    },
    addEventListener: (_: string, cb: () => void) => listeners.add(cb),
    removeEventListener: (_: string, cb: () => void) => listeners.delete(cb),
  };
  vi.stubGlobal('matchMedia', vi.fn(() => mql));
  return {
    set(next: boolean) {
      matches = next;
      listeners.forEach((cb) => cb());
    },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useReducedMotion', () => {
  it('reads the media query and follows changes', () => {
    const mq = mockMatchMedia(false);
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);

    act(() => mq.set(true));
    expect(result.current).toBe(true);
  });
});

describe('useWebGLAvailable', () => {
  it('returns false in jsdom (no WebGL context)', () => {
    const { result } = renderHook(() => useWebGLAvailable());
    expect(result.current).toBe(false);
  });
});

describe('usePerfFlag', () => {
  it('is true only with ?perf=1', async () => {
    const { usePerfFlag } = await import('../use-perf-flag');
    window.history.replaceState(null, '', '/simulation');
    expect(renderHook(() => usePerfFlag()).result.current).toBe(false);
    window.history.replaceState(null, '', '/simulation?perf=1');
    expect(renderHook(() => usePerfFlag()).result.current).toBe(true);
    window.history.replaceState(null, '', '/');
  });
});
