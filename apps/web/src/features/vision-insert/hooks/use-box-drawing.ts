'use client';

import { useCallback, useRef, useState, type PointerEvent } from 'react';
import type { NormBox } from '@/lib/vision';
import { boxFromPoints, toNormPoint, type NormPoint } from '../utils/manual-box';

/**
 * Drag to draw one box on the photo (PV-T8). Mouse, pen and touch (pointer events, captured so a
 * drag ending outside the photo still counts). A new drag replaces the previous box.
 */
export function useBoxDrawing() {
  const start = useRef<NormPoint | null>(null);
  const [draft, setDraft] = useState<NormBox | null>(null);
  const [box, setBox] = useState<NormBox | null>(null);

  const point = (e: PointerEvent<HTMLElement>) =>
    toNormPoint(e.clientX, e.clientY, e.currentTarget.getBoundingClientRect());

  const onPointerDown = useCallback((e: PointerEvent<HTMLElement>) => {
    e.preventDefault();
    start.current = point(e);
    setDraft(null);
    e.currentTarget.setPointerCapture?.(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e: PointerEvent<HTMLElement>) => {
    if (start.current) setDraft(boxFromPoints(start.current, point(e)));
  }, []);

  const onPointerUp = useCallback((e: PointerEvent<HTMLElement>) => {
    if (!start.current) return;
    const drawn = boxFromPoints(start.current, point(e));
    start.current = null;
    setDraft(null);
    // A tap (too small) keeps the previous box.
    if (drawn) setBox(drawn);
  }, []);

  const clear = useCallback(() => {
    start.current = null;
    setDraft(null);
    setBox(null);
  }, []);

  return {
    /** Box being dragged, else the last finished one. */
    shown: draft ?? box,
    box,
    clear,
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp },
  };
}
