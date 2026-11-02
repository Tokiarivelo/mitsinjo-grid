import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useElapsedSeconds } from '../hooks/use-elapsed-seconds';

describe('useElapsedSeconds', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('counts whole seconds while active, 0 when stopped or not started', () => {
    const start = Date.now();
    const { result, rerender } = renderHook(
      ({ active }: { active: boolean }) => useElapsedSeconds(start, active),
      { initialProps: { active: true } }
    );
    expect(result.current).toBe(0);
    act(() => vi.advanceTimersByTime(3200));
    expect(result.current).toBe(3);
    rerender({ active: false });
    expect(result.current).toBe(0);
    const { result: none } = renderHook(() => useElapsedSeconds(undefined, true));
    expect(none.current).toBe(0);
  });
});
