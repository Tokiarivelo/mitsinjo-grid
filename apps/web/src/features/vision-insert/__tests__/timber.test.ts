import { describe, expect, it } from 'vitest';
import type { ObjectRecipe, RecipePart } from '@/lib/object-shape';
import { FRAME_DARK } from '../utils/openings';
import { BEAM_SHARE, subtractSpans, timberBeams } from '../utils/timber';

const wall: RecipePart = {
  shape: 'box',
  at: [0, 0, 0],
  size: [1, 1, 0.6],
  color: '#e6dccb',
  material: 'plaster',
  kind: 'wall',
  front: true,
  timber: { posts: [0, 0.3, 1], rails: [0.5] },
};
const win: RecipePart = {
  shape: 'box',
  at: [0.3, 0, 0.3075],
  size: [0.2, 0.3, 0.015],
  color: '#2b3440',
  material: 'glass',
  kind: 'window',
};
const P = { w: 1, h: 0.5, d: 0.5 };

describe('subtractSpans', () => {
  it('cuts holes out of a span, in order', () => {
    expect(
      subtractSpans(
        [0, 10],
        [
          [2, 3],
          [5, 7],
        ]
      )
    ).toEqual([
      [0, 2],
      [3, 5],
      [7, 10],
    ]);
    expect(subtractSpans([0, 10], [[-1, 11]])).toEqual([]);
    expect(subtractSpans([0, 10], [[12, 13]])).toEqual([[0, 10]]);
  });
});

describe('timberBeams (PV-G)', () => {
  it('no timber → no beams', () => {
    expect(timberBeams({ proportions: P, parts: [{ ...wall, timber: undefined }] })).toEqual([]);
  });

  it('posts and rails on the front face, dark wood on a light wall, proud of it', () => {
    const beams = timberBeams({ proportions: P, parts: [wall] });
    expect(beams).toHaveLength(4);
    for (const b of beams) {
      expect(b.color).toBe(FRAME_DARK);
      expect(b.at[2] * P.d).toBeGreaterThan(0.3 * P.d);
    }
    // Corner posts stay inside the wall.
    const xs = beams.filter((b) => b.size[1] > b.size[0]).map((b) => b.at[0]);
    expect(Math.min(...xs)).toBeGreaterThan(-0.5);
  });

  it('cuts the post and the rail around a window on the face', () => {
    // Post at 0.8 of the width (x 0.3) runs through the window (x 0.2–0.4, y ±0.075 world);
    // the rail at mid-height (y 0) crosses it.
    const r: ObjectRecipe = {
      proportions: P,
      parts: [{ ...wall, timber: { posts: [0, 0.8, 1], rails: [0.5] } }, win],
    };
    const beams = timberBeams(r);
    const over = beams.filter((b) => {
      const [x0, x1] = [(b.at[0] - b.size[0] / 2) * P.w, (b.at[0] + b.size[0] / 2) * P.w];
      const [y0, y1] = [(b.at[1] - b.size[1] / 2) * P.h, (b.at[1] + b.size[1] / 2) * P.h];
      return x0 < 0.4 - 1e-9 && x1 > 0.2 + 1e-9 && y0 < 0.075 - 1e-9 && y1 > -0.075 + 1e-9;
    });
    expect(over).toEqual([]);
    // 2 whole corner posts + the middle post in 2 + the rail in 2.
    expect(beams).toHaveLength(6);
    expect(BEAM_SHARE).toBeGreaterThan(0);
  });
});
