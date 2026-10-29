import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render, renderHook } from '@testing-library/react';
import { useRef } from 'react';

const three = vi.hoisted(() => ({
  state: {
    invalidate: vi.fn(),
    frameloop: 'demand' as 'demand' | 'never',
    gl: { shadowMap: { autoUpdate: true, needsUpdate: false } },
  },
}));

vi.mock('@react-three/fiber', () => {
  const get = () => three.state; // stable, like the real store getter
  const withGet = () => ({ ...three.state, get });
  return {
    useThree: (selector: (s: ReturnType<typeof withGet>) => unknown) => selector(withGet()),
  };
});

const drei = vi.hoisted(() => ({ contactShadowRenders: 0 }));
vi.mock('@react-three/drei', () => ({
  ContactShadows: () => {
    drei.contactShadowRenders++;
    return null;
  },
}));

import { useInView } from '../use-in-view';
import { useAmbientFrame } from '../use-ambient-frame';
import { BakedContactShadows, ResumeOnVisible, ShadowBake } from '../../ui/render-control';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  three.state.invalidate.mockReset();
  three.state.frameloop = 'demand';
  three.state.gl.shadowMap.autoUpdate = true;
  three.state.gl.shadowMap.needsUpdate = false;
});

describe('useInView', () => {
  it('stays true without IntersectionObserver', () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    const { result } = renderHook(() => {
      const ref = useRef<HTMLDivElement>(document.createElement('div'));
      return useInView(ref);
    });
    expect(result.current).toBe(true);
  });

  it('follows the observer and disconnects on unmount', () => {
    let fire: (visible: boolean) => void = () => {};
    const disconnect = vi.fn();
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(cb: (e: { isIntersecting: boolean }[]) => void) {
          fire = (visible) => cb([{ isIntersecting: visible }]);
        }
        observe() {}
        disconnect = disconnect;
      }
    );
    const { result, unmount } = renderHook(() => {
      const ref = useRef<HTMLDivElement>(document.createElement('div'));
      return useInView(ref);
    });
    act(() => fire(false));
    expect(result.current).toBe(false);
    act(() => fire(true));
    expect(result.current).toBe(true);
    unmount();
    expect(disconnect).toHaveBeenCalled();
  });
});

describe('useAmbientFrame', () => {
  it('merges requests from several parts of one canvas into one throttled frame', () => {
    vi.useFakeTimers();
    const a = renderHook(() => useAmbientFrame());
    const b = renderHook(() => useAmbientFrame());
    a.result.current();
    b.result.current();
    vi.advanceTimersByTime(0);
    expect(three.state.invalidate).toHaveBeenCalledTimes(1);
    a.result.current();
    b.result.current();
    vi.advanceTimersByTime(10);
    expect(three.state.invalidate).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(30);
    expect(three.state.invalidate).toHaveBeenCalledTimes(2);
    a.unmount();
    b.unmount();
  });
});

describe('ShadowBake', () => {
  it('turns off per-frame shadow updates and re-bakes only when the key changes', () => {
    const key = {};
    const { rerender, unmount } = render(<ShadowBake bakeKey={key} />);
    expect(three.state.gl.shadowMap.autoUpdate).toBe(false);
    expect(three.state.gl.shadowMap.needsUpdate).toBe(true);
    expect(three.state.invalidate).toHaveBeenCalledTimes(1);

    three.state.gl.shadowMap.needsUpdate = false; // three.js resets it after the bake
    rerender(<ShadowBake bakeKey={key} />);
    expect(three.state.gl.shadowMap.needsUpdate).toBe(false);

    rerender(<ShadowBake bakeKey={{}} />);
    expect(three.state.gl.shadowMap.needsUpdate).toBe(true);

    unmount();
    expect(three.state.gl.shadowMap.autoUpdate).toBe(true);
  });
});

describe('ResumeOnVisible', () => {
  it('renders a frame when the loop resumes, not while paused', () => {
    three.state.frameloop = 'never';
    const { rerender } = render(<ResumeOnVisible />);
    expect(three.state.invalidate).not.toHaveBeenCalled();
    three.state.frameloop = 'demand';
    rerender(<ResumeOnVisible />);
    expect(three.state.invalidate).toHaveBeenCalledTimes(1);
  });
});

describe('BakedContactShadows', () => {
  it('never re-renders with its parent, so drei bakes the contact shadow once', () => {
    drei.contactShadowRenders = 0;
    const Parent = ({ hour }: { hour: number }) => (
      <div data-hour={hour}>
        <BakedContactShadows />
      </div>
    );
    const { rerender } = render(<Parent hour={0} />);
    for (let h = 1; h < 24; h++) rerender(<Parent hour={h} />);
    expect(drei.contactShadowRenders).toBe(1);
  });
});
