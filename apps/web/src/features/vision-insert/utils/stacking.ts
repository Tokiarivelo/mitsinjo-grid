import type { NormBox } from '@/lib/vision';
import type { Pt } from './shapes';

const area = (b: NormBox) => b.w * b.h;

/**
 * Paint order of the photo boxes: biggest first, so a small object inside or under a big one
 * (lamp post in front of a house) is drawn on top and stays clickable. Stable for equal areas.
 */
export function paintOrder<T extends { box: NormBox }>(items: readonly T[]): T[] {
  return items
    .map((item, i) => ({ item, i }))
    .sort((a, b) => area(b.item.box) - area(a.item.box) || a.i - b.i)
    .map(({ item }) => item);
}

const contains = (b: NormBox, [x, y]: Pt) =>
  x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;

/**
 * Object under a click: the smallest box that contains the point. Clicking again on the same spot
 * (`currentId` is one of the boxes there) goes to the next bigger one, then back to the smallest,
 * so a box hidden under others can always be reached. Null when no box contains the point.
 */
export function pickAt<T extends { id: string; box: NormBox }>(
  items: readonly T[],
  point: Pt,
  currentId: string | null
): string | null {
  const hits = paintOrder(items.filter((d) => contains(d.box, point))).reverse();
  if (hits.length === 0) return null;
  const at = hits.findIndex((d) => d.id === currentId);
  return hits[at < 0 ? 0 : (at + 1) % hits.length]!.id;
}
