import * as THREE from 'three';
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useShaderWarmup, WARMUP_TIMEOUT_MS, type WarmupTarget } from '../use-shader-warmup';

const target = (compileAsync: () => Promise<unknown>): WarmupTarget => ({
  gl: { compileAsync } as unknown as WarmupTarget['gl'],
  scene: new THREE.Scene(),
  camera: new THREE.PerspectiveCamera(),
});

afterEach(() => vi.useRealTimers());

describe('useShaderWarmup (PT-7)', () => {
  it('waits for a target, then compiles its scene once and turns ready', async () => {
    let resolve!: () => void;
    const compile = vi.fn(() => new Promise<void>((r) => (resolve = r)));
    const t = target(compile);
    const { result, rerender } = renderHook(({ tg }) => useShaderWarmup(tg), {
      initialProps: { tg: null as WarmupTarget | null },
    });
    expect(result.current).toBe(false);
    expect(compile).not.toHaveBeenCalled();
    rerender({ tg: t });
    expect(compile).toHaveBeenCalledWith(t.scene, t.camera);
    expect(result.current).toBe(false);
    await act(async () => resolve());
    expect(result.current).toBe(true);
    rerender({ tg: t });
    expect(compile).toHaveBeenCalledOnce();
  });

  it('shows the canvas anyway after the timeout', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useShaderWarmup(target(() => new Promise<void>(() => {}))));
    expect(result.current).toBe(false);
    act(() => vi.advanceTimersByTime(WARMUP_TIMEOUT_MS - 1));
    expect(result.current).toBe(false);
    act(() => vi.advanceTimersByTime(1));
    expect(result.current).toBe(true);
  });

  it('a failed compile still shows the canvas', async () => {
    const { result } = renderHook(() =>
      useShaderWarmup(target(() => Promise.reject(new Error('lost'))))
    );
    await act(async () => {});
    expect(result.current).toBe(true);
  });

  it('no compileAsync (old renderer): ready at once', () => {
    const t = { ...target(() => Promise.resolve()), gl: {} as WarmupTarget['gl'] };
    const { result } = renderHook(() => useShaderWarmup(t));
    expect(result.current).toBe(true);
  });
});
