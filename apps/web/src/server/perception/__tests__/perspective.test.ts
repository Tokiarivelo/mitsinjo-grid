// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  detectSegments,
  lineSpread,
  measurePerspective,
  ransacVanishingPoint,
  yawFromVanishingPoint,
  type Segment2,
} from '../perspective';
import type { GrayGrid } from '../repetition';
import { H, render, turned, W } from './fixtures/render-facade';

const box = { x: 0, y: 0, w: 1, h: 1 };
const deg = (r: number) => (r * 180) / Math.PI;

describe('yawFromVanishingPoint (PF-T5)', () => {
  it('infinite point → facing the camera; right of centre → right end farther', () => {
    expect(yawFromVanishingPoint([1, 0, 0], 100, 200)).toBe(0);
    expect(deg(yawFromVanishingPoint([300, 50, 1], 100, 200))).toBeCloseTo(45, 6);
    expect(deg(yawFromVanishingPoint([-100, 50, 1], 100, 200))).toBeCloseTo(-45, 6);
    // Same point, homogeneous scale −1.
    expect(deg(yawFromVanishingPoint([-300, -50, -1], 100, 200))).toBeCloseTo(45, 6);
  });
});

describe('ransacVanishingPoint', () => {
  it('finds where 10 lines meet, ignores 4 strays, deterministic', () => {
    const vp = [400, 80];
    const segs: Segment2[] = Array.from({ length: 10 }, (_, i) => {
      const y = 20 + i * 15;
      const k = 0.4;
      return { x1: 0, y1: y, x2: k * vp[0]!, y2: y + k * (vp[1]! - y) };
    });
    segs.push(
      { x1: 10, y1: 10, x2: 30, y2: 90 },
      { x1: 50, y1: 5, x2: 60, y2: 100 },
      { x1: 0, y1: 150, x2: 90, y2: 40 },
      { x1: 20, y1: 60, x2: 100, y2: 190 }
    );
    const found = ransacVanishingPoint(segs)!;
    expect(found.inliers).toHaveLength(10);
    expect(found.v[0] / found.v[2]).toBeCloseTo(400, -1);
    expect(found.v[1] / found.v[2]).toBeCloseTo(80, -1);
    expect(ransacVanishingPoint(segs)).toEqual(found);
    expect(ransacVanishingPoint(segs.slice(0, 5))).toBeNull();
  });
});

describe('lineSpread (PF-T9 regression)', () => {
  it('copies of one edge sit together; facade lines spread; no vanishing point from copies', () => {
    // Regression (golden cottage row): 10 copies of the eave line, ±1 px tilt → a false 60° turn.
    const copies: Segment2[] = Array.from({ length: 10 }, (_, i) => ({
      x1: i * 10,
      y1: 57 + (i % 2 ? 0.6 : -0.6),
      x2: 150 + i * 10,
      y2: 57 + (i % 2 ? -0.6 : 0.6),
    }));
    expect(lineSpread(copies, 128)).toBeLessThan(3);
    expect(ransacVanishingPoint(copies, { spreadAt: { x: 128, min: 12 } })).toBeNull();
    const facade: Segment2[] = [40, 70, 100].map((y) => ({ x1: 0, y1: y, x2: 100, y2: y + 10 }));
    expect(lineSpread(facade, 50)).toBeCloseTo(60, 6);
  });
});

describe('measurePerspective (PF-T5)', () => {
  it('detects straight segments on a rendered facade', () => {
    expect(detectSegments(turned(30)).length).toBeGreaterThanOrEqual(8);
  });

  it.each([15, 30, -25, 45])('facade turned %i° → yaw within 6°', (y) => {
    const p = measurePerspective(turned(y), box, W, H);
    expect(p).not.toBeNull();
    expect(Math.abs(deg(p!.yaw) - y)).toBeLessThan(6);
    expect(p!.inliers).toBeGreaterThanOrEqual(8);
  });

  it('facade facing the camera → yaw ≈ 0', () => {
    const p = measurePerspective(turned(0), box, W, H);
    expect(p?.yaw ?? 0).toBe(0);
  });

  it('plain surface (no lines) → null: the model keeps facing the camera', () => {
    const plain: GrayGrid = {
      width: W,
      height: H,
      gray: new Float32Array(W * H).fill(0.5),
      mask: new Uint8Array(W * H).fill(1),
    };
    expect(measurePerspective(plain, box, W, H)).toBeNull();
  });

  it('a corner (two facades at 90°) → both vanishing points, focal measured near the true one', () => {
    const y = (35 * Math.PI) / 180;
    const f = 1.1 * W;
    const corner = render(
      [
        { at: [-1.4, 0, 6], a: [Math.cos(y), 0, Math.sin(y)], half: 1.7 },
        { at: [1.6, 0, 6], a: [Math.sin(y), 0, -Math.cos(y)], half: 1.7 },
      ],
      f
    );
    const p = measurePerspective(corner, box, W, H)!;
    expect(p.inliersSide).toBeGreaterThanOrEqual(8);
    if (p.focalMeasured) expect(Math.abs(p.focal - f) / f).toBeLessThan(0.25);
  });

  it('runs under 300 ms on 256 × 192', () => {
    const g = turned(30);
    const t = performance.now();
    measurePerspective(g, box, W, H);
    expect(performance.now() - t).toBeLessThan(300);
  });
});
