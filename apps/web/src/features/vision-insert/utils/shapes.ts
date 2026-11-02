import {
  polygonBounds,
  polygonPath,
  type ApplianceDetection,
  type NormBox,
  type VisionRegion,
} from '@/lib/vision';

/** Rectangle, free hand, or lasso that sticks to edges (PV-T8). */
export type DrawTool = 'box' | 'free' | 'lasso';
export const DRAW_TOOLS: readonly DrawTool[] = ['box', 'free', 'lasso'];

/** Point in image fractions (0–1), `[x, y]`. */
export type Pt = readonly [number, number];

/** A shape the operator drew and can still move, resize or delete before sending it. */
export interface DrawnShape {
  id: string;
  tool: DrawTool;
  /** Closed polygon (a box is its 4 corners). */
  points: Pt[];
  /** What the operator says it is (sent to the vision model as a hint). */
  hint: string;
}

export type Corner = 'nw' | 'ne' | 'sw' | 'se';
export const CORNERS: readonly Corner[] = ['nw', 'ne', 'sw', 'se'];

/** Smallest shape side (fraction of the photo); smaller = a tap, not a shape. */
export const MIN_SHAPE_SIDE = 0.02;
/** Free-hand points closer than this are skipped while drawing. */
export const STROKE_STEP = 0.004;
/** Box added from the keyboard (no pointer): centred. */
export const DEFAULT_BOX: Pt[] = [
  [0.35, 0.35],
  [0.65, 0.35],
  [0.65, 0.65],
  [0.35, 0.65],
];

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Pointer position → image fractions of `rect`, clamped to the photo. */
export function toNormPoint(
  clientX: number,
  clientY: number,
  rect: Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>
): Pt {
  return [
    rect.width > 0 ? clamp01((clientX - rect.left) / rect.width) : 0,
    rect.height > 0 ? clamp01((clientY - rect.top) / rect.height) : 0,
  ];
}

/** Four corners of the box spanned by two drag points (any order). */
export function boxPoints(a: Pt, b: Pt): Pt[] {
  const x1 = Math.min(a[0], b[0]);
  const x2 = Math.max(a[0], b[0]);
  const y1 = Math.min(a[1], b[1]);
  const y2 = Math.max(a[1], b[1]);
  return [
    [x1, y1],
    [x2, y1],
    [x2, y2],
    [x1, y2],
  ];
}

/** Adds a stroke point unless it is too close to the last one. */
export function addStrokePoint(points: Pt[], p: Pt, step = STROKE_STEP): Pt[] {
  const last = points[points.length - 1];
  if (last && Math.hypot(p[0] - last[0], p[1] - last[1]) < step) return points;
  return [...points, p];
}

function distToSegment(p: Pt, a: Pt, b: Pt): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  const t = len2 > 0 ? clamp01(((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2) : 0;
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

/** Ramer–Douglas–Peucker: drops points that add less than `eps` of detail. */
export function simplify(points: Pt[], eps = 0.002): Pt[] {
  if (points.length <= 3) return points;
  const first = points[0]!;
  const last = points[points.length - 1]!;
  let worst = 0;
  let index = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const d = distToSegment(points[i]!, first, last);
    if (d > worst) {
      worst = d;
      index = i;
    }
  }
  if (worst <= eps) return [first, last];
  return [
    ...simplify(points.slice(0, index + 1), eps).slice(0, -1),
    ...simplify(points.slice(index), eps),
  ];
}

/** True when the shape is big enough to be an object (not a tap or a line). */
export function isUsableShape(points: Pt[]): boolean {
  if (points.length < 3) return false;
  const b = polygonBounds(points);
  return b.w >= MIN_SHAPE_SIDE && b.h >= MIN_SHAPE_SIDE;
}

/** Finished stroke → closed polygon (≤ 400 points), or null when too small. */
export function finishStroke(tool: DrawTool, points: Pt[]): Pt[] | null {
  if (tool === 'box') {
    if (points.length < 2) return null;
    const box = boxPoints(points[0]!, points[points.length - 1]!);
    return isUsableShape(box) ? box : null;
  }
  let out = simplify(points);
  for (let eps = 0.004; out.length > 400; eps *= 2) out = simplify(points, eps);
  return isUsableShape(out) ? out : null;
}

/** Moves a shape, kept inside the photo. */
export function moveShape(points: Pt[], dx: number, dy: number): Pt[] {
  const b = polygonBounds(points);
  const mx = Math.min(1 - (b.x + b.w), Math.max(-b.x, dx));
  const my = Math.min(1 - (b.y + b.h), Math.max(-b.y, dy));
  return points.map(([x, y]) => [x + mx, y + my] as Pt);
}

/** Maps every point from `from` bounds to `to` bounds (keeps the drawn shape, any polygon). */
function remap(points: Pt[], from: NormBox, to: NormBox): Pt[] {
  return points.map(([x, y]) => [
    to.x + (from.w > 0 ? (x - from.x) / from.w : 0) * to.w,
    to.y + (from.h > 0 ? (y - from.y) / from.h : 0) * to.h,
  ]);
}

/** Drags one corner of the shape bounds to `p` (opposite corner fixed), shape scaled to fit. */
export function resizeShape(points: Pt[], corner: Corner, p: Pt): Pt[] {
  const b = polygonBounds(points);
  const ax = corner.endsWith('w') ? b.x + b.w : b.x;
  const ay = corner.startsWith('n') ? b.y + b.h : b.y;
  const px = clamp01(p[0]);
  const py = clamp01(p[1]);
  // Never smaller than the minimum, never flipped through the fixed corner.
  const w = Math.max(MIN_SHAPE_SIDE, Math.abs(px - ax));
  const h = Math.max(MIN_SHAPE_SIDE, Math.abs(py - ay));
  const x = corner.endsWith('w') ? Math.max(0, ax - w) : ax;
  const y = corner.startsWith('n') ? Math.max(0, ay - h) : ay;
  return remap(points, b, { x, y, w: Math.min(w, 1 - x), h: Math.min(h, 1 - y) });
}

/** Corner position of the shape bounds (for the resize handles). */
export function cornerPoint(points: Pt[], corner: Corner): Pt {
  const b = polygonBounds(points);
  return [corner.endsWith('w') ? b.x : b.x + b.w, corner.startsWith('n') ? b.y : b.y + b.h];
}

/** What the server gets for a shape. */
export function shapeToRegion(shape: DrawnShape): VisionRegion {
  const hint = shape.hint.trim().slice(0, 40);
  return {
    id: shape.id,
    points: shape.points.map(([x, y]) => [clamp01(x), clamp01(y)] as [number, number]),
    ...(hint ? { hint } : {}),
  };
}

/**
 * Sent shape → detection shown right away (before, or without, the model): the shape's outline,
 * the operator's text as label, no category yet (`other`). The model's answer then replaces it.
 */
export function shapeToDetection(shape: DrawnShape, fallbackLabel: string): ApplianceDetection {
  return {
    id: shape.id,
    label: (shape.hint.trim() || fallbackLabel).slice(0, 40),
    kind: 'appliance',
    category: 'other',
    box: polygonBounds(shape.points),
    outline: polygonPath(shape.points),
    manual: true,
  };
}
