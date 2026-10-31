'use client';

import { useCallback, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import type { NormBox } from '@/lib/vision';

/** Zoom levels of the detection photo (1 = fit). */
export const ZOOM_STEPS = [1, 1.5, 2, 3, 4] as const;
/** Height the fitted photo may take (vh), as before zooming existed. */
export const PHOTO_MAX_VH = 60;

/** Next zoom level up (`1`) or down (`-1`), clamped to `ZOOM_STEPS`. */
export function stepZoom(zoom: number, dir: 1 | -1): number {
  if (dir > 0) return ZOOM_STEPS.find((z) => z > zoom + 1e-6) ?? ZOOM_STEPS[ZOOM_STEPS.length - 1]!;
  return [...ZOOM_STEPS].reverse().find((z) => z < zoom - 1e-6) ?? ZOOM_STEPS[0];
}

/**
 * Photo width: fitted (full width, or less for a tall photo so it stays ≤ PHOTO_MAX_VH high and the
 * overlays keep matching the picture), times the zoom. `aspect` = width / height (null = not loaded).
 */
export function photoWidth(aspect: number | null, zoom: number): string {
  const fit = aspect ? `min(100%, ${PHOTO_MAX_VH}vh * ${aspect.toFixed(4)})` : '100%';
  return `calc(${fit} * ${zoom})`;
}

/**
 * Zoom on the detection photo (precise drawing and box correction). The scroll box pans (scroll bars,
 * wheel, touch); zooming keeps the centre of the view, or centres `focus` (the box being adjusted).
 * Resets when the photo changes.
 */
export function usePhotoZoom(imageUrl: string, focus: NormBox | null = null) {
  const [state, setState] = useState({ image: imageUrl, zoom: 1, aspect: null as number | null });
  const current = state.image === imageUrl ? state : { image: imageUrl, zoom: 1, aspect: null };
  const viewportRef = useRef<HTMLDivElement>(null);
  /** View centre (fractions of the content) to restore after a zoom change. */
  const centre = useRef<[number, number] | null>(null);

  const setZoom = useCallback(
    (zoom: number) => {
      const el = viewportRef.current;
      if (focus) centre.current = [focus.x + focus.w / 2, focus.y + focus.h / 2];
      else if (el && el.scrollWidth > 0 && el.scrollHeight > 0) {
        centre.current = [
          (el.scrollLeft + el.clientWidth / 2) / el.scrollWidth,
          (el.scrollTop + el.clientHeight / 2) / el.scrollHeight,
        ];
      }
      setState((s) => ({
        ...(s.image === imageUrl ? s : { aspect: null }),
        image: imageUrl,
        zoom,
      }));
    },
    [imageUrl, focus]
  );

  useLayoutEffect(() => {
    const el = viewportRef.current;
    const c = centre.current;
    centre.current = null;
    if (!el || !c) return;
    el.scrollLeft = c[0] * el.scrollWidth - el.clientWidth / 2;
    el.scrollTop = c[1] * el.scrollHeight - el.clientHeight / 2;
  }, [current.zoom]);

  /** Scrolls so `box` sits in the middle of the view (no-op at 100 %). */
  const centreOn = useCallback((box: NormBox) => {
    const el = viewportRef.current;
    if (!el) return;
    el.scrollLeft = (box.x + box.w / 2) * el.scrollWidth - el.clientWidth / 2;
    el.scrollTop = (box.y + box.h / 2) * el.scrollHeight - el.clientHeight / 2;
  }, []);

  const onImageLoad = useCallback(
    (e: { currentTarget: HTMLImageElement }) => {
      const { naturalWidth: w, naturalHeight: h } = e.currentTarget;
      if (w > 0 && h > 0)
        setState((s) => ({
          ...(s.image === imageUrl ? s : { zoom: 1 }),
          image: imageUrl,
          aspect: w / h,
        }));
    },
    [imageUrl]
  );

  const zoom = current.zoom;
  const contentStyle: CSSProperties = { width: photoWidth(current.aspect, zoom) };
  return {
    zoom,
    zoomIn: () => setZoom(stepZoom(zoom, 1)),
    zoomOut: () => setZoom(stepZoom(zoom, -1)),
    reset: () => setZoom(1),
    canZoomIn: zoom < ZOOM_STEPS[ZOOM_STEPS.length - 1]!,
    canZoomOut: zoom > ZOOM_STEPS[0],
    centreOn,
    viewportRef,
    onImageLoad,
    contentStyle,
  };
}
