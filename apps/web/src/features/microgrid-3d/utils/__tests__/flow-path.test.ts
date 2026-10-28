import { describe, expect, it } from 'vitest';
import {
  buildArcPath,
  electronCount,
  electronPeriodS,
  sampleArcPath,
  toSvgPath,
} from '../flow-path';

describe('flow-path', () => {
  const path = buildArcPath([
    [0, 0, 0],
    [3, 0, 0],
    [3, 4, 0],
  ]);

  it('measures cumulative arc length', () => {
    expect(path.cum).toEqual([0, 3, 7]);
    expect(path.total).toBe(7);
  });

  it('samples by arc fraction and wraps outside [0, 1)', () => {
    const out = [0, 0, 0];
    expect(sampleArcPath(path, 0, out)).toEqual([0, 0, 0]);
    const mid = sampleArcPath(path, 3 / 7, out);
    expect(mid[0]).toBeCloseTo(3);
    expect(mid[1]).toBeCloseTo(0);
    const up = sampleArcPath(path, 5 / 7, out);
    expect(up[0]).toBeCloseTo(3);
    expect(up[1]).toBeCloseTo(2);
    // Negative phase (reverse flow) wraps to the end of the cable.
    expect(sampleArcPath(path, -2 / 7, out)[1]).toBeCloseTo(2);
    expect(sampleArcPath(path, 1 + 1.5 / 7, out)[0]).toBeCloseTo(1.5);
  });

  it('reuses the output array (no allocation)', () => {
    const out = [0, 0, 0];
    expect(sampleArcPath(path, 0.5, out)).toBe(out);
  });

  it('handles degenerate paths', () => {
    const single = buildArcPath([[1, 2]]);
    expect(sampleArcPath(single, 0.4, [0, 0])).toEqual([1, 2]);
    expect(buildArcPath([]).total).toBe(0);
  });

  it('spaces electrons by length within bounds', () => {
    expect(electronCount(10, 1)).toBe(10);
    expect(electronCount(1, 1)).toBe(3);
    expect(electronCount(500, 1)).toBe(24);
    expect(electronCount(0, 1)).toBe(0);
  });

  it('derives a travel period from speed', () => {
    expect(electronPeriodS(10, 2)).toBe(5);
    expect(electronPeriodS(0.01, 10)).toBe(0.2);
    expect(electronPeriodS(10, 0)).toBe(Infinity);
  });

  it('builds an SVG path', () => {
    expect(
      toSvgPath([
        [0, 0],
        [10, 5.25],
      ])
    ).toBe('M0.0 0.0 L10.0 5.3');
  });
});
