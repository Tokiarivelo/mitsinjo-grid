/**
 * Pure zoom & pan math for the 2D diagrams. Content is drawn at the viewport size
 * and transformed with `translate(x, y) scale(scale)` from the top-left corner,
 * so a content point p lands on screen at p * scale + (x, y).
 */
export interface ZoomPan {
  scale: number;
  x: number;
  y: number;
}

export const ZOOM_MIN = 1;
export const ZOOM_MAX = 4;
/** One zoom button press / wheel notch. */
export const ZOOM_STEP = 1.25;
export const ZOOM_IDENTITY: ZoomPan = { scale: 1, x: 0, y: 0 };

/** Keep the scaled content covering the viewport (no empty band at any edge). */
export function clampPan(z: ZoomPan, width: number, height: number): ZoomPan {
  const scale = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z.scale));
  const minX = width - width * scale;
  const minY = height - height * scale;
  // `+ 0` turns -0 into 0 so the identity state compares equal.
  return {
    scale,
    x: Math.min(0, Math.max(minX, z.x)) + 0,
    y: Math.min(0, Math.max(minY, z.y)) + 0,
  };
}

/**
 * Zoom by `factor` keeping the screen point `origin` (viewport px) fixed,
 * then clamp to the viewport.
 */
export function zoomAround(
  z: ZoomPan,
  factor: number,
  origin: [number, number],
  width: number,
  height: number
): ZoomPan {
  const scale = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z.scale * factor));
  const k = scale / z.scale;
  const [ox, oy] = origin;
  return clampPan({ scale, x: ox - (ox - z.x) * k, y: oy - (oy - z.y) * k }, width, height);
}

/** Pan by a screen delta, clamped to the viewport. */
export function panBy(z: ZoomPan, dx: number, dy: number, width: number, height: number): ZoomPan {
  return clampPan({ scale: z.scale, x: z.x + dx, y: z.y + dy }, width, height);
}

export function toTransform(z: ZoomPan): string {
  return `translate(${z.x}px, ${z.y}px) scale(${z.scale})`;
}
