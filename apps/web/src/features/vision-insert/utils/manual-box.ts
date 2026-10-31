import type { ApplianceCategory } from '@mitsinjo/engine';
import type { ApplianceDetection, NormBox } from '@/lib/vision';

/** A point in image fractions (0–1). */
export interface NormPoint {
  x: number;
  y: number;
}

/** Smallest box side a drag must cover (fraction of the photo); smaller = a tap, not a box. */
export const MIN_BOX_SIDE = 0.02;

/** Box used when the object is added without drawing (keyboard): centred, visible, easy to spot. */
export const DEFAULT_MANUAL_BOX: NormBox = { x: 0.35, y: 0.35, w: 0.3, h: 0.3 };

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Pointer position → image fractions of `rect` (clamped to the photo). */
export function toNormPoint(
  clientX: number,
  clientY: number,
  rect: Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>
): NormPoint {
  return {
    x: rect.width > 0 ? clamp01((clientX - rect.left) / rect.width) : 0,
    y: rect.height > 0 ? clamp01((clientY - rect.top) / rect.height) : 0,
  };
}

/** Two drag corners (any order) → box, or null when too small to be a box. */
export function boxFromPoints(a: NormPoint, b: NormPoint): NormBox | null {
  const x1 = clamp01(Math.min(a.x, b.x));
  const y1 = clamp01(Math.min(a.y, b.y));
  const w = clamp01(Math.max(a.x, b.x)) - x1;
  const h = clamp01(Math.max(a.y, b.y)) - y1;
  if (w < MIN_BOX_SIDE || h < MIN_BOX_SIDE) return null;
  return { x: x1, y: y1, w, h };
}

/**
 * Box drawn by the operator (PV-T8) → a detection like the AI ones, marked `manual`.
 * No AI call and no power value: the engine catalog gives power from `category`.
 */
export function manualDetection(input: {
  id: string;
  box: NormBox;
  category: ApplianceCategory;
  label: string;
}): ApplianceDetection {
  return {
    id: input.id,
    label: input.label.trim().slice(0, 40),
    kind: 'appliance',
    category: input.category,
    box: input.box,
    manual: true,
  };
}
