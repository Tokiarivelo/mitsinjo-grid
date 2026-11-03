import { describe, expect, it } from 'vitest';
import type { ObjectRecipe, RecipePart } from '@/lib/object-shape';
import {
  FOCUS_MAX_DISTANCE,
  FOCUS_MIN_DISTANCE,
  changedParts,
  focusDistance,
  partOutlines,
  partsOfKinds,
  partsSphere,
} from '../utils/build-focus';

const wall: RecipePart = {
  shape: 'box',
  at: [0, -0.25, 0],
  size: [1, 0.5, 0.8],
  color: '#aaaaaa',
  kind: 'wall',
};
const roof: RecipePart = {
  shape: 'hip',
  at: [0, 0.2, 0],
  size: [1, 0.4, 0.8],
  color: '#333333',
  kind: 'roof',
};
const window1: RecipePart = {
  shape: 'box',
  at: [0.2, -0.3, 0.4],
  size: [0.1, 0.1, 0.02],
  color: '#88aacc',
  kind: 'window',
};
const recipe = (parts: RecipePart[], extra: Partial<ObjectRecipe> = {}): ObjectRecipe => ({
  proportions: { w: 1, h: 1, d: 1 },
  parts,
  ...extra,
});

describe('partsOfKinds', () => {
  it('keeps only parts of the stage kinds, never kind-less parts', () => {
    const plain: RecipePart = { ...wall, kind: undefined };
    expect(partsOfKinds(recipe([wall, roof, plain]), ['roof'])).toEqual([roof]);
    expect(partsOfKinds(recipe([plain]), ['wall'])).toEqual([]);
  });
});

describe('changedParts', () => {
  it('is empty when nothing changed, order aside', () => {
    expect(changedParts(recipe([wall, roof]), recipe([roof, wall]))).toEqual([]);
  });

  it('returns edited, added and removed parts', () => {
    const lower = { ...roof, at: [0, 0.12, 0] as RecipePart['at'] };
    expect(changedParts(recipe([wall, roof]), recipe([wall, lower]))).toEqual([lower, roof]);
    expect(changedParts(recipe([wall]), recipe([wall, window1]))).toEqual([window1]);
    expect(changedParts(recipe([wall, window1]), recipe([wall]))).toEqual([window1]);
  });
});

describe('partsSphere', () => {
  it('is null without parts', () => {
    expect(partsSphere(recipe([wall]), [])).toBeNull();
  });

  it('centres on the part bounds, scaled by the proportions', () => {
    const s = partsSphere(recipe([roof], { proportions: { w: 1, h: 0.5, d: 1 } }), [roof])!;
    expect(s.center[1]).toBeCloseTo(0.1);
    expect(s.radius).toBeCloseTo(Math.hypot(1, 0.2, 0.8) / 2);
  });

  it('turns with the measured yaw', () => {
    const s = partsSphere(recipe([window1], { yaw: Math.PI / 2 }), [window1])!;
    // x' = x cos + z sin = 0.4, z' = -x sin + z cos = -0.2
    expect(s.center[0]).toBeCloseTo(0.4);
    expect(s.center[2]).toBeCloseTo(-0.2);
  });
});

describe('partOutlines', () => {
  it('draws 12 edges per part, on the part box', () => {
    const lines = partOutlines(recipe([window1]), [window1, wall]);
    expect(lines.length).toBe(2 * 12 * 6);
    const xs = Array.from(lines.slice(0, 72)).filter((_, i) => i % 3 === 0);
    expect(Math.min(...xs)).toBeCloseTo(0.15);
    expect(Math.max(...xs)).toBeCloseTo(0.25);
  });
});

describe('focusDistance', () => {
  it('stays within the viewer zoom limits', () => {
    expect(focusDistance(0.01, 35)).toBe(FOCUS_MIN_DISTANCE);
    expect(focusDistance(10, 35)).toBe(FOCUS_MAX_DISTANCE);
  });

  it('grows with the framed size', () => {
    expect(focusDistance(0.5, 35)).toBeGreaterThan(focusDistance(0.4, 35));
  });
});
