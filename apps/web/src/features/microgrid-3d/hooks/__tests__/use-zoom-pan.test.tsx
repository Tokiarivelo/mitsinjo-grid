import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useZoomPan } from '../use-zoom-pan';
import { ZOOM_STEP } from '../../utils/zoom-pan';

function Harness({
  wheelZoom = false,
  onTap = vi.fn(),
}: {
  wheelZoom?: boolean;
  onTap?: () => void;
}) {
  const { viewportRef, zoom, zoomIn, zoomOut, reset, handlers } = useZoomPan({ wheelZoom });
  return (
    <div>
      <div ref={viewportRef} data-testid="vp" {...handlers}>
        <button type="button" onClick={onTap}>
          card
        </button>
      </div>
      <output data-testid="z">{`${zoom.scale.toFixed(3)} ${zoom.x.toFixed(1)} ${zoom.y.toFixed(1)}`}</output>
      <button type="button" onClick={zoomIn}>
        in
      </button>
      <button type="button" onClick={zoomOut}>
        out
      </button>
      <button type="button" onClick={reset}>
        reset
      </button>
    </div>
  );
}

// jsdom has no PointerEvent: without it fireEvent drops clientX / pointerId.
if (typeof window.PointerEvent === 'undefined') {
  class PointerEventPolyfill extends MouseEvent {
    pointerId: number;
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 0;
    }
  }
  window.PointerEvent = PointerEventPolyfill as unknown as typeof PointerEvent;
}

function sizeViewport(el: HTMLElement, w = 800, h = 500) {
  Object.defineProperty(el, 'clientWidth', { value: w, configurable: true });
  Object.defineProperty(el, 'clientHeight', { value: h, configurable: true });
}

const z = () => screen.getByTestId('z').textContent!.split(' ').map(Number);

describe('useZoomPan', () => {
  it('zooms in/out around the center and resets', () => {
    render(<Harness />);
    sizeViewport(screen.getByTestId('vp'));
    fireEvent.click(screen.getByText('in'));
    expect(z()[0]).toBeCloseTo(ZOOM_STEP);
    expect(z()[1]).toBeCloseTo(400 - 400 * ZOOM_STEP); // centered
    fireEvent.click(screen.getByText('out'));
    expect(z()).toEqual([1, 0, 0]);
    fireEvent.click(screen.getByText('in'));
    fireEvent.click(screen.getByText('reset'));
    expect(z()).toEqual([1, 0, 0]);
  });

  it('ignores a plain wheel unless wheelZoom or Ctrl is held', () => {
    const { rerender } = render(<Harness />);
    const vp = screen.getByTestId('vp');
    sizeViewport(vp);
    fireEvent.wheel(vp, { deltaY: -200 });
    expect(z()[0]).toBe(1);
    fireEvent.wheel(vp, { deltaY: -200, ctrlKey: true });
    expect(z()[0]).toBeGreaterThan(1);
    rerender(<Harness wheelZoom />);
    const before = z()[0]!;
    fireEvent.wheel(vp, { deltaY: -200 });
    expect(z()[0]).toBeGreaterThan(before);
  });

  it('drags to pan once zoomed and swallows the click that ends the drag', () => {
    const onTap = vi.fn();
    render(<Harness onTap={onTap} />);
    const vp = screen.getByTestId('vp');
    sizeViewport(vp);
    fireEvent.click(screen.getByText('in'));
    fireEvent.click(screen.getByText('in'));
    const [, x0, y0] = z();
    act(() => {
      fireEvent.pointerDown(vp, { pointerId: 1, clientX: 100, clientY: 100 });
      fireEvent.pointerMove(vp, { pointerId: 1, clientX: 130, clientY: 120 });
      fireEvent.pointerUp(vp, { pointerId: 1, clientX: 130, clientY: 120 });
    });
    expect(z()[1]).toBeCloseTo(x0! + 30);
    expect(z()[2]).toBeCloseTo(y0! + 20);
    fireEvent.click(screen.getByText('card'));
    expect(onTap).not.toHaveBeenCalled();
    // A plain tap (no movement) still reaches the card.
    fireEvent.pointerDown(vp, { pointerId: 2, clientX: 50, clientY: 50 });
    fireEvent.pointerUp(vp, { pointerId: 2, clientX: 50, clientY: 50 });
    fireEvent.click(screen.getByText('card'));
    expect(onTap).toHaveBeenCalledTimes(1);
  });
});
