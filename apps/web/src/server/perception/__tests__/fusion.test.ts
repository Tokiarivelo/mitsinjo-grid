// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { ObjectRecipe } from '@/lib/object-shape';
import { confidence, mixColor, mixNumber, mixRecipe, pickCount } from '../fusion';

describe('confidence (PF-T7)', () => {
  it('grows with what the measure saw, stays in [0, 1]', () => {
    expect(confidence.colors(10)).toBe(0);
    expect(confidence.colors(64)).toBe(0.5);
    expect(confidence.colors(5000)).toBe(1);
    expect(confidence.repetition(0.2)).toBe(0);
    expect(confidence.repetition(0.41)).toBe(0.6);
    expect(confidence.repetition(0.9)).toBe(1);
    expect(confidence.perspective(5)).toBe(0);
    expect(confidence.perspective(8)).toBe(0.5);
    expect(confidence.perspective(40)).toBe(1);
    expect(confidence.fit(0.3)).toBe(0);
    expect(confidence.fit(0.6)).toBe(0.5);
    expect(confidence.fit(0.95)).toBe(1);
  });

  it('box-only colours (no outline) never fully replace the prior (green Mini)', () => {
    expect(confidence.colors(10, false)).toBe(0);
    expect(confidence.colors(64, false)).toBe(0.3);
    expect(confidence.colors(5000, false)).toBe(0.3);
    expect(confidence.colors(5000, true)).toBe(1);
    expect(confidence.colors(5000)).toBe(1);
  });
});

describe('mix', () => {
  it('numbers and counts: prior at 0, measurement at 1', () => {
    expect(mixNumber(10, 0, 0)).toBe(0);
    expect(mixNumber(10, 0, 0.25)).toBe(2.5);
    expect(mixNumber(10, 0, 3)).toBe(10);
    expect(pickCount(6, 1, 0.6)).toBe(6);
    expect(pickCount(6, 1, 0.4)).toBe(1);
    expect(pickCount(6, undefined, 0)).toBe(6);
  });

  it('colours mix in linear light: ends exact, half of black/white brighter than sRGB #808080', () => {
    expect(mixColor('#c9a36a', '#000000', 1)).toBe('#c9a36a');
    expect(mixColor('#c9a36a', '#123456', 0)).toBe('#123456');
    expect(parseInt(mixColor('#ffffff', '#000000', 0.5).slice(1, 3), 16)).toBeGreaterThan(0x80);
  });

  it('recipe: a poor fit keeps the start, a good one wins', () => {
    const part = {
      shape: 'box' as const,
      at: [0, 0, 0] as [number, number, number],
      size: [1, 1, 1] as [number, number, number],
      color: '#cccccc',
    };
    const start: ObjectRecipe = { proportions: { w: 1, h: 0.5, d: 0.5 }, parts: [part] };
    const fitted: ObjectRecipe = {
      proportions: { w: 1, h: 0.8, d: 0.4 },
      parts: [{ ...part, color: '#000000' }],
      yaw: 0.4,
    };
    expect(mixRecipe(fitted, start, 0)).toEqual(start);
    expect(mixRecipe(fitted, start, 1)).toEqual(fitted);
    const half = mixRecipe(fitted, start, 0.5);
    expect(half.proportions.h).toBeCloseTo(0.65, 6);
    expect(half.yaw).toBeCloseTo(0.2, 6);
  });
});
