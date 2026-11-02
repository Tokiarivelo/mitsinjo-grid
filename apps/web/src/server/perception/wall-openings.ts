import 'server-only';

/**
 * Real openings (PR-2.17): a wall rect minus hole rects, tiled into strips — no CSG dependency.
 * One wall with n holes becomes n+1 full-height side strips (shared between neighbours) plus an
 * above/below strip per hole, and the glass/door leaf stays centred in its hole. Doors touch the
 * ground, so their below strip degenerates away. Pure geometry: same inputs → same tiling.
 */

/** Centre-form rect, in the wall's face plane. */
export interface FaceRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface WallSegments {
  strips: FaceRect[];
  /** Holes that survived the clamp (glass goes here, same x/y span). */
  holes: FaceRect[];
}

const EPS = 1e-9;

function valid(r: FaceRect): boolean {
  return r.w > EPS && r.h > EPS;
}

/** Intersect a hole with the wall; null when nothing survives. */
function clampHole(wall: FaceRect, h: FaceRect): FaceRect | null {
  const x0 = Math.max(wall.x - wall.w / 2, h.x - h.w / 2);
  const x1 = Math.min(wall.x + wall.w / 2, h.x + h.w / 2);
  const y0 = Math.max(wall.y - wall.h / 2, h.y - h.h / 2);
  const y1 = Math.min(wall.y + wall.h / 2, h.y + h.h / 2);
  const out = { x: (x0 + x1) / 2, y: (y0 + y1) / 2, w: x1 - x0, h: y1 - y0 };
  return valid(out) ? out : null;
}

function overlaps(a: FaceRect, b: FaceRect): boolean {
  return Math.abs(a.x - b.x) * 2 < a.w + b.w - EPS && Math.abs(a.y - b.y) * 2 < a.h + b.h - EPS;
}

function union(a: FaceRect, b: FaceRect): FaceRect {
  const x0 = Math.min(a.x - a.w / 2, b.x - b.w / 2);
  const x1 = Math.max(a.x + a.w / 2, b.x + b.w / 2);
  const y0 = Math.min(a.y - a.h / 2, b.y - b.h / 2);
  const y1 = Math.max(a.y + a.h / 2, b.y + b.h / 2);
  return { x: (x0 + x1) / 2, y: (y0 + y1) / 2, w: x1 - x0, h: y1 - y0 };
}

/**
 * Tile the wall around the holes. Returns null when no hole survives (the wall stays whole and
 * keeps its decals). Holes are clamped into the wall and overlapping pairs merged to their bbox
 * (a strip must never cross a hole). Strips + holes exactly cover the wall rect.
 */
export function segmentWall(wall: FaceRect, holes: ReadonlyArray<FaceRect>): WallSegments | null {
  const kept: FaceRect[] = [];
  for (const h of holes) {
    const c = clampHole(wall, h);
    if (c) kept.push(c);
  }
  if (kept.length === 0) return null;
  // Merge overlaps to a fixpoint (n is tiny: ≤ 5 panels).
  for (let pass = 0; pass < kept.length; pass++) {
    let merged = false;
    outer: for (let i = 0; i < kept.length; i++) {
      for (let j = i + 1; j < kept.length; j++) {
        if (overlaps(kept[i]!, kept[j]!)) {
          kept[i] = union(kept[i]!, kept[j]!);
          kept.splice(j, 1);
          merged = true;
          break outer;
        }
      }
    }
    if (!merged) break;
  }
  kept.sort((a, b) => a.x - b.x);
  const wx0 = wall.x - wall.w / 2;
  const wx1 = wall.x + wall.w / 2;
  const wy0 = wall.y - wall.h / 2;
  const wy1 = wall.y + wall.h / 2;
  const strips: FaceRect[] = [];
  const push = (x0: number, x1: number, y0: number, y1: number) => {
    const r = { x: (x0 + x1) / 2, y: (y0 + y1) / 2, w: x1 - x0, h: y1 - y0 };
    if (valid(r)) strips.push(r);
  };
  // Full-height side strips: wall edge, between neighbours, wall edge.
  let edge = wx0;
  for (const h of kept) {
    push(edge, h.x - h.w / 2, wy0, wy1);
    edge = h.x + h.w / 2;
  }
  push(edge, wx1, wy0, wy1);
  // Above/below each hole, hole width.
  for (const h of kept) {
    const hx0 = h.x - h.w / 2;
    const hx1 = h.x + h.w / 2;
    push(hx0, hx1, h.y + h.h / 2, wy1);
    push(hx0, hx1, wy0, h.y - h.h / 2);
  }
  return { strips, holes: kept };
}
