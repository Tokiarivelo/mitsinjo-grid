import {
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { ZOOM_IDENTITY, ZOOM_STEP, type ZoomPan, panBy, zoomAround } from '../utils/zoom-pan';

/** Pointer travel (px) before a press becomes a drag, so taps still select a sector. */
const DRAG_THRESHOLD_PX = 4;

function sizeOf(el: HTMLElement | null): readonly [number, number] {
  return el ? [el.clientWidth, el.clientHeight] : [0, 0];
}

/** Client coordinates → viewport-local px. */
function localPoint(el: HTMLElement | null, clientX: number, clientY: number): [number, number] {
  const r = el?.getBoundingClientRect();
  return r ? [clientX - r.left, clientY - r.top] : [0, 0];
}

export interface UseZoomPanOptions {
  /** Plain wheel zooms (e.g. full screen). Otherwise only Ctrl/⌘ + wheel or trackpad pinch. */
  wheelZoom?: boolean;
}

/**
 * Zoom & pan for a 2D diagram viewport: buttons, Ctrl/⌘ + wheel, two-finger pinch,
 * drag to pan once zoomed. Visual only (no data).
 */
export function useZoomPan({ wheelZoom = false }: UseZoomPanOptions = {}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState<ZoomPan>(ZOOM_IDENTITY);
  const pointers = useRef(new Map<number, [number, number]>());
  const dragged = useRef(false);
  const start = useRef<[number, number] | null>(null);

  const zoomBy = useCallback((factor: number, origin?: [number, number]) => {
    const [w, h] = sizeOf(viewportRef.current);
    setZoom((z) => zoomAround(z, factor, origin ?? [w / 2, h / 2], w, h));
  }, []);
  const zoomIn = useCallback(() => zoomBy(ZOOM_STEP), [zoomBy]);
  const zoomOut = useCallback(() => zoomBy(1 / ZOOM_STEP), [zoomBy]);
  const reset = useCallback(() => setZoom(ZOOM_IDENTITY), []);

  // Wheel needs a non-passive native listener to block page scroll while zooming.
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!wheelZoom && !e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      zoomBy(Math.exp(-e.deltaY * 0.002), localPoint(viewportRef.current, e.clientX, e.clientY));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [wheelZoom, zoomBy]);

  const onPointerDown = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    pointers.current.set(e.pointerId, [e.clientX, e.clientY]);
    if (pointers.current.size === 1) {
      dragged.current = false;
      start.current = [e.clientX, e.clientY];
    }
  }, []);

  const onPointerMove = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    const [w, h] = sizeOf(viewportRef.current);
    if (pointers.current.size >= 2) {
      // Pinch: scale by the change in finger distance, around their midpoint.
      const others = [...pointers.current.entries()].find(([id]) => id !== e.pointerId);
      if (!others) return;
      const o = others[1];
      const before = Math.hypot(prev[0] - o[0], prev[1] - o[1]);
      const after = Math.hypot(e.clientX - o[0], e.clientY - o[1]);
      pointers.current.set(e.pointerId, [e.clientX, e.clientY]);
      if (before > 0) {
        dragged.current = true;
        const mid = localPoint(viewportRef.current, (e.clientX + o[0]) / 2, (e.clientY + o[1]) / 2);
        setZoom((z) => zoomAround(z, after / before, mid, w, h));
      }
      return;
    }
    pointers.current.set(e.pointerId, [e.clientX, e.clientY]);
    const s = start.current;
    if (!dragged.current && s) {
      if (Math.hypot(e.clientX - s[0], e.clientY - s[1]) < DRAG_THRESHOLD_PX) return;
      dragged.current = true;
      // Capture only once dragging, so a plain tap still reaches the sector card.
      e.currentTarget.setPointerCapture?.(e.pointerId);
    }
    setZoom((z) => (z.scale > 1 ? panBy(z, e.clientX - prev[0], e.clientY - prev[1], w, h) : z));
  }, []);

  const onPointerEnd = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 0) start.current = null;
  }, []);

  /** Swallow the click that ends a drag or pinch. */
  const onClickCapture = useCallback((e: ReactMouseEvent) => {
    if (!dragged.current) return;
    dragged.current = false;
    e.stopPropagation();
    e.preventDefault();
  }, []);

  return {
    viewportRef,
    zoom,
    zoomIn,
    zoomOut,
    reset,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: onPointerEnd,
      onPointerCancel: onPointerEnd,
      onClickCapture,
    },
  };
}
