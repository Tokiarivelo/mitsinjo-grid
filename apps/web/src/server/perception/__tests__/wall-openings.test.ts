// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { segmentWall, type FaceRect } from '../wall-openings';

const WALL: FaceRect = { x: 0, y: 0, w: 1, h: 0.6 };
const area = (rs: FaceRect[]) => rs.reduce((s, r) => s + r.w * r.h, 0);

/** Strips + holes tile the wall exactly, with no pairwise overlap. */
function expectTiling(wall: FaceRect, holes: FaceRect[]) {
  const seg = segmentWall(wall, holes)!;
  expect(seg).not.toBeNull();
  expect(area(seg.strips) + area(seg.holes)).toBeCloseTo(wall.w * wall.h, 9);
  const all = [...seg.strips, ...seg.holes];
  for (let i = 0; i < all.length; i++) {
    for (let j = i + 1; j < all.length; j++) {
      const a = all[i]!;
      const b = all[j]!;
      const ox = Math.min(a.x + a.w / 2, b.x + b.w / 2) - Math.max(a.x - a.w / 2, b.x - b.w / 2);
      const oy = Math.min(a.y + a.h / 2, b.y + b.h / 2) - Math.max(a.y - a.h / 2, b.y - b.h / 2);
      expect(Math.min(ox, oy)).toBeLessThanOrEqual(1e-9);
    }
  }
  return seg;
}

describe('segmentWall (PR-2.17)', () => {
  it('cuts one window: 4 strips around the hole', () => {
    const seg = expectTiling(WALL, [{ x: -0.2, y: 0.05, w: 0.2, h: 0.2 }]);
    expect(seg.strips).toHaveLength(4);
    expect(seg.holes).toHaveLength(1);
  });

  it('a door to the ground loses its below strip', () => {
    const seg = expectTiling(WALL, [{ x: 0.25, y: -0.2, w: 0.16, h: 0.2 }]);
    // Left, between…​: left + right + above = 3 (below degenerates at the wall foot).
    expect(seg.strips).toHaveLength(3);
  });

  it('two holes share the middle strip', () => {
    const seg = expectTiling(WALL, [
      { x: -0.28, y: 0.05, w: 0.18, h: 0.2 },
      { x: 0.06, y: -0.2, w: 0.12, h: 0.2 },
    ]);
    // 3 side strips + window above/below + door above = 6.
    expect(seg.strips).toHaveLength(6);
    expect(seg.holes).toHaveLength(2);
  });

  it('merges overlapping holes to their bbox', () => {
    const seg = expectTiling(WALL, [
      { x: -0.1, y: 0, w: 0.2, h: 0.2 },
      { x: 0, y: 0.05, w: 0.2, h: 0.2 },
    ]);
    expect(seg.holes).toHaveLength(1);
    expect(seg.holes[0]!.x).toBeCloseTo(-0.05, 9);
    expect(seg.holes[0]!.y).toBeCloseTo(0.025, 9);
    expect(seg.holes[0]!.w).toBeCloseTo(0.3, 9);
    expect(seg.holes[0]!.h).toBeCloseTo(0.25, 9);
  });

  it('clamps holes into the wall and drops degenerate ones', () => {
    // Half outside: clamped, still tiled.
    const seg = expectTiling(WALL, [{ x: 0.55, y: 0, w: 0.3, h: 0.2 }]);
    expect(seg.holes[0]!.x).toBeCloseTo(0.45, 9);
    expect(seg.holes[0]!.w).toBeCloseTo(0.1, 9);
    // Fully outside or flat: the wall stays whole.
    expect(segmentWall(WALL, [{ x: 2, y: 0, w: 0.2, h: 0.2 }])).toBeNull();
    expect(segmentWall(WALL, [{ x: 0, y: 0, w: 0, h: 0.2 }])).toBeNull();
    expect(segmentWall(WALL, [])).toBeNull();
  });
});
