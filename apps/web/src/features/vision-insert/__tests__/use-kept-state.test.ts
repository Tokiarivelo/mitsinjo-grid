import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { clearKeptState, useKeptRef, useKeptState } from '../hooks/use-kept-state';

beforeEach(() => clearKeptState());

describe('useKeptState', () => {
  it('outlives an unmount when scoped', () => {
    const first = renderHook(() => useKeptState('s', 'n', 0));
    act(() => first.result.current[1]((n) => n + 2));
    expect(first.result.current[0]).toBe(2);
    first.unmount();
    const again = renderHook(() => useKeptState('s', 'n', 0));
    expect(again.result.current[0]).toBe(2);
  });

  it('acts as plain useState without a scope', () => {
    const first = renderHook(() => useKeptState(undefined, 'n', 0));
    const setter = first.result.current[1];
    act(() => first.result.current[1](5));
    expect(first.result.current[0]).toBe(5);
    // Stable setter: callbacks built on it do not change on every update.
    expect(first.result.current[1]).toBe(setter);
    first.unmount();
    expect(renderHook(() => useKeptState(undefined, 'n', 0)).result.current[0]).toBe(0);
  });
});

describe('useKeptRef', () => {
  it('shares one ref per scope and key', () => {
    const a = renderHook(() => useKeptRef('s', 'r', () => ({ v: 1 })));
    a.result.current.current.v = 7;
    a.unmount();
    expect(renderHook(() => useKeptRef('s', 'r', () => ({ v: 1 }))).result.current.current.v).toBe(
      7
    );
    expect(
      renderHook(() => useKeptRef(undefined, 'r', () => ({ v: 1 }))).result.current.current.v
    ).toBe(1);
  });
});
