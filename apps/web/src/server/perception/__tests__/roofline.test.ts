// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  measureRoof,
  median5,
  roofFromSkyline,
  segmentFit,
  skylineFromRings,
  slopeKind,
  SKYLINE_COLUMNS,
} from '../roofline';

type Pt = readonly [number, number];
const box = { x: 0, y: 0, w: 1, h: 1 };

/** Outline of a row of `n` gabled cottages over the whole box: walls up to `eave`, ridges at y `top`. */
function cottageRow(n: number, eave = 0.5, top = 0.1): Pt[] {
  const pts: Pt[] = [[0, 1]];
  for (let i = 0; i < n; i++) {
    pts.push([i / n, eave], [(i + 0.5) / n, top]);
  }
  pts.push([1, eave], [1, 1]);
  return pts;
}

describe('skylineFromRings (PF-T3)', () => {
  it('gives the top of the outline per column, NaN outside it', () => {
    const tri: Pt[] = [
      [0.25, 1],
      [0.5, 0],
      [0.75, 1],
    ];
    const s = skylineFromRings([tri], box, 8);
    expect(Number.isNaN(s[0]!)).toBe(true);
    // Column 3 centre x = 0.4375 → on the left edge y = 1 − (0.4375 − 0.25)·4 = 0.25.
    expect(s[3]).toBeCloseTo(0.25, 6);
    expect(s[4]).toBeCloseTo(0.25, 6);
    expect(Number.isNaN(s[7]!)).toBe(true);
  });

  it('works in box fractions on a box inside the photo', () => {
    const s = skylineFromRings(
      [
        [
          [0.2, 0.3],
          [0.6, 0.3],
          [0.6, 0.7],
          [0.2, 0.7],
        ],
      ],
      { x: 0.2, y: 0.2, w: 0.4, h: 0.5 },
      4
    );
    for (const v of s) expect(v).toBeCloseTo(0.2, 6);
  });
});

describe('median5', () => {
  it('removes a one-column spike and keeps a step', () => {
    expect([...median5([1, 1, 9, 1, 1])]).toEqual([1, 1, 1, 1, 1]);
    expect([...median5([0, 0, 0, 5, 5, 5])]).toEqual([0, 0, 0, 5, 5, 5]);
  });
});

describe('segmentFit', () => {
  it('finds one line on a straight skyline, two on a gable (BIC stops there)', () => {
    const xs = Array.from({ length: 64 }, (_, i) => i / 63);
    expect(
      segmentFit(
        xs,
        xs.map((x) => 0.2 + 0.1 * x)
      )
    ).toHaveLength(1);
    const gable = segmentFit(
      xs,
      xs.map((x) => 0.5 - 0.8 * (0.5 - Math.abs(x - 0.5)))
    );
    expect(gable).toHaveLength(2);
    expect(gable[0]!.b).toBeCloseTo(-0.8, 1);
    expect(gable[1]!.b).toBeCloseTo(0.8, 1);
    expect(xs[gable[0]!.to]!).toBeCloseTo(0.5, 1);
  });

  it('is deterministic', () => {
    const xs = Array.from({ length: 40 }, (_, i) => i / 39);
    const ys = xs.map((x) => Math.sin(6 * x) * 0.2 + 0.4);
    expect(segmentFit(xs, ys)).toEqual(segmentFit(xs, ys));
  });
});

describe('slopeKind', () => {
  it('classifies by the angle on the photo, y down', () => {
    expect(slopeKind(-1, 1)).toBe('rise');
    expect(slopeKind(1, 1)).toBe('fall');
    expect(slopeKind(0.05, 1)).toBe('flat');
    expect(slopeKind(-20, 1)).toBe('step');
    // Same box slope on a box 4× wider than high: 14° on the photo, still a slope; 8× → flat.
    expect(slopeKind(-1, 4)).toBe('rise');
    expect(slopeKind(-1, 8)).toBe('flat');
  });
});

describe('measureRoof (PF-T3)', () => {
  it('row of 6 gabled cottages → 6 gables, peaks centred, eave and ridge read', () => {
    const m = measureRoof([cottageRow(6)], box, 1.6);
    expect(m).not.toBeNull();
    const { roof, pitch } = m!;
    expect(roof.gables).toHaveLength(6);
    expect(roof.eave).toBeCloseTo(0.5, 1);
    roof.gables.forEach((g, i) => {
      expect(g.peak).toBeCloseTo((i + 0.5) / 6, 1);
      expect(g.top).toBeCloseTo(0.1, 1);
      expect(g.x1).toBeGreaterThan(g.x0);
    });
    expect(pitch).toBeGreaterThan(30);
  });

  it('jagged SAM outline (seeded noise, 1.5 % of the box) still gives 6 gables', () => {
    let seed = 7;
    const noise = () => ((seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5) * 0.03;
    const clean = cottageRow(6);
    const jagged: Pt[] = [];
    for (let i = 0; i < clean.length; i++) {
      const [x0, y0] = clean[i]!;
      const [x1, y1] = clean[(i + 1) % clean.length]!;
      for (let k = 0; k < 10; k++) {
        const t = k / 10;
        jagged.push([x0 + (x1 - x0) * t, Math.min(1, y0 + (y1 - y0) * t + (y0 < 1 ? noise() : 0))]);
      }
    }
    const m = measureRoof([jagged], box, 1.6);
    expect(m?.roof.gables).toHaveLength(6);
  });

  it('one house with a gable → 1 gable over the whole width', () => {
    const { roof } = measureRoof([cottageRow(1, 0.6, 0.05)], box, 1)!;
    expect(roof.gables).toHaveLength(1);
    expect(roof.gables[0]!.x0).toBeLessThan(0.05);
    expect(roof.gables[0]!.x1).toBeGreaterThan(0.95);
    expect(roof.eave).toBeCloseTo(0.6, 1);
  });

  it('flat top (box, cut sky) → null: the template keeps its default roof', () => {
    const flat: Pt[] = [
      [0, 0.3],
      [1, 0.3],
      [1, 1],
      [0, 1],
    ];
    expect(measureRoof([flat], box, 2)).toBeNull();
  });

  it('outline over under half of the columns → null', () => {
    const thin: Pt[] = [
      [0.45, 1],
      [0.5, 0],
      [0.55, 1],
    ];
    expect(measureRoof([thin], box, 1)).toBeNull();
    expect(roofFromSkyline(new Float64Array(SKYLINE_COLUMNS).fill(NaN), 1)).toBeNull();
  });

  it('runs far under the budget on 128 columns', () => {
    const started = performance.now();
    for (let i = 0; i < 5; i++) measureRoof([cottageRow(6)], box, 1.6);
    expect((performance.now() - started) / 5).toBeLessThan(300);
  });
});
