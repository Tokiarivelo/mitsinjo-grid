// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  autocorrelation,
  edgeEnergy,
  firstPeak,
  maskColumns,
  measureRepetition,
  type GrayGrid,
} from '../repetition';

/** Grid of `width` × `height` painted by `paint(x, y)` (grey 0–1), mask from `inside` (all by default). */
function grid(
  width: number,
  height: number,
  paint: (x: number, y: number) => number,
  inside: (x: number, y: number) => boolean = () => true
): GrayGrid {
  const gray = new Float32Array(width * height);
  const mask = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      gray[y * width + x] = paint(x, y);
      mask[y * width + x] = inside(x, y) ? 1 : 0;
    }
  }
  return { width, height, gray, mask };
}

/**
 * Row of `units` cottages on 128 × 64: dark party-wall / chimney stripe at each house edge on the roof band
 * (top 40 %), `windows` dark windows per house on the walls.
 */
function row(units: number, windows: number): GrayGrid {
  const P = 128 / units;
  return grid(128, 64, (x, y) => {
    const u = x % P;
    if (y < 26) return u < 3 ? 0.15 : 0.55;
    const w = P / windows;
    return y > 34 && y < 46 && u % w > w * 0.3 && u % w < w * 0.7 ? 0.1 : 0.8;
  });
}

describe('autocorrelation / firstPeak (PF-T4)', () => {
  it('a periodic signal peaks at its period, R(0) = 1', () => {
    const s = Array.from({ length: 96 }, (_, i) => (i % 16 < 2 ? 1 : 0));
    const R = autocorrelation(s);
    expect(R[0]).toBeCloseTo(1, 6);
    expect(firstPeak(R, 4, 48)?.period).toBe(16);
  });

  it('flat or noise-free constant signal → no peak', () => {
    expect(firstPeak(autocorrelation(new Array(64).fill(0.5)), 2, 32)).toBeNull();
  });
});

describe('edgeEnergy / maskColumns', () => {
  it('counts steps inside the mask only, not the outline border', () => {
    const g = grid(
      8,
      4,
      (x) => (x < 4 ? 0 : 1),
      (x) => x >= 2
    );
    const e = edgeEnergy(g);
    expect(e[3]).toBeCloseTo(4, 6);
    expect(e[1]).toBe(0);
    expect(maskColumns(g)).toEqual([2, 7]);
    expect(
      maskColumns(
        grid(
          4,
          4,
          () => 0,
          () => false
        )
      )
    ).toEqual([-1, -1]);
  });
});

describe('measureRepetition (PF-T4)', () => {
  it('row of 6 cottages with 2 windows each → 6 units, 2 windows per unit', () => {
    const r = measureRepetition(row(6, 2), 0.4);
    expect(r.units).toBe(6);
    expect(r.windowsPerUnit).toBe(2);
    expect(r.strength).toBeGreaterThan(0.35);
  });

  it('row of 4 with 3 windows each', () => {
    const r = measureRepetition(row(4, 3), 0.4);
    expect(r.units).toBe(4);
    expect(r.windowsPerUnit).toBe(3);
  });

  it('plain roof (no repetition) → 1 unit; window edges alone never make houses', () => {
    const g = grid(128, 64, (x, y) => (y > 34 && y < 46 && x % 20 > 6 && x % 20 < 14 ? 0.1 : 0.7));
    expect(measureRepetition(g, 0.4).units).toBe(1);
    expect(measureRepetition(g, 0.4).strength).toBe(0);
  });

  it('empty or tiny mask → 1 unit', () => {
    expect(
      measureRepetition(
        grid(
          128,
          32,
          () => 0.5,
          () => false
        )
      ).units
    ).toBe(1);
    expect(
      measureRepetition(
        grid(
          128,
          32,
          () => 0.5,
          (x) => x < 10
        )
      ).units
    ).toBe(1);
  });

  it('is deterministic and fast on 128 × 256', () => {
    const g = grid(128, 256, (x, y) => ((x * 7 + y * 3) % 11) / 11);
    const t = performance.now();
    const a = measureRepetition(g);
    expect(performance.now() - t).toBeLessThan(100);
    expect(measureRepetition(g)).toEqual(a);
  });
});
