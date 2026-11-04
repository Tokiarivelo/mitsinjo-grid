import * as THREE from 'three';
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const three = vi.hoisted(() => ({
  state: {
    invalidate: vi.fn(),
    camera: null as unknown as THREE.Camera,
    gl: {
      domElement: { getBoundingClientRect: () => ({ left: 0, top: 0, width: 200, height: 200 }) },
    },
    controls: { enabled: true },
  },
}));

vi.mock('@react-three/fiber', () => ({
  useThree: (selector: (s: typeof three.state) => unknown) => selector(three.state),
}));

import { useMarkerDrag, type MarkerDragHandlers } from '../use-marker-drag';

const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 500);
camera.position.set(0, 10, 10);
camera.lookAt(0, 0, 0);
camera.updateMatrixWorld();
three.state.camera = camera;

const down = (h: MarkerDragHandlers, x: number, y: number) =>
  h.onPointerDown({ stopPropagation: () => {}, clientX: x, clientY: y } as never);
const move = (x: number, y: number) =>
  window.dispatchEvent(new MouseEvent('pointermove', { clientX: x, clientY: y }));
const up = () => window.dispatchEvent(new MouseEvent('pointerup'));

describe('useMarkerDrag (PP-T5)', () => {
  it('without onCommit the markers stay inert', () => {
    const { result } = renderHook(() => useMarkerDrag({}));
    expect(result.current.bindMarker('a1')).toEqual({});
    expect(result.current.selectedId).toBeNull();
  });

  it('click toggles selection and requests a frame', () => {
    const { result } = renderHook(() => useMarkerDrag({ onCommit: vi.fn() }));
    const h = result.current.bindMarker('a1') as MarkerDragHandlers;
    act(() => down(h, 100, 100));
    act(up);
    expect(result.current.selectedId).toBe('a1');
    expect(three.state.invalidate).toHaveBeenCalled();
    act(() => down(h, 100, 100));
    act(up);
    expect(result.current.selectedId).toBeNull();
  });

  it('toggleSelect (badge click, PT-11e) toggles the same selection', () => {
    const { result } = renderHook(() => useMarkerDrag({ onCommit: vi.fn() }));
    act(() => result.current.toggleSelect('a2'));
    expect(result.current.selectedId).toBe('a2');
    act(() => result.current.toggleSelect('a2'));
    expect(result.current.selectedId).toBeNull();
  });

  it('drag moves the ghost imperatively, disables orbit, commits on release', () => {
    const onCommit = vi.fn();
    const onActiveChange = vi.fn();
    const { result } = renderHook(() => useMarkerDrag({ onCommit, onActiveChange }));
    const ghost = new THREE.Group();
    result.current.ghostRef.current = ghost;
    const h = result.current.bindMarker('a1') as MarkerDragHandlers;
    act(() => down(h, 100, 100));
    expect(result.current.dragId).toBeNull();
    // Under the threshold: still a press, orbit untouched.
    act(() => move(102, 100));
    expect(result.current.dragId).toBeNull();
    expect(three.state.controls.enabled).toBe(true);
    // Past it: dragging, orbit off, ghost on the ground ray.
    act(() => move(150, 100));
    expect(result.current.dragId).toBe('a1');
    expect(three.state.controls.enabled).toBe(false);
    expect(onActiveChange).toHaveBeenCalledWith(true);
    expect(ghost.position.x).toBeGreaterThan(0);
    expect(ghost.position.z).toBeCloseTo(0, 6);
    expect(ghost.position.y).toBeCloseTo(0, 6);
    expect(onCommit).not.toHaveBeenCalled();
    act(up);
    expect(onCommit).toHaveBeenCalledTimes(1);
    const [id, pos] = onCommit.mock.calls[0] as [string, { x: number; z: number }];
    expect(id).toBe('a1');
    expect(pos.x).toBeCloseTo(ghost.position.x, 9);
    expect(pos.z).toBeCloseTo(ghost.position.z, 9);
    expect(result.current.dragId).toBeNull();
    expect(three.state.controls.enabled).toBe(true);
    expect(onActiveChange).toHaveBeenCalledWith(false);
  });

  it('pointer-cancel and stray releases never commit', () => {
    const onCommit = vi.fn();
    const { result } = renderHook(() => useMarkerDrag({ onCommit }));
    const h = result.current.bindMarker('a1') as MarkerDragHandlers;
    act(() => down(h, 100, 100));
    act(() => move(150, 100));
    expect(result.current.dragId).toBe('a1');
    act(() => window.dispatchEvent(new MouseEvent('pointercancel')));
    expect(onCommit).not.toHaveBeenCalled();
    expect(result.current.dragId).toBeNull();
    expect(three.state.controls.enabled).toBe(true);
    act(up);
    expect(result.current.selectedId).toBeNull();
  });
});
