import { describe, expect, it } from 'vitest';
import { boxUnionCoverage, parseSamOutput } from '../parse-sam';

// Shape recorded from a real sam-3.1 call (masks shortened).
const SAM_TEXT =
  '<0f>0<|box;x1=1179;y1=585;x2=1900;y2=1071;w=1920;h=1280;c=0.96|><|mask;x=0;y=0;c=0.96;data=487,722,!!!!$q@|>,' +
  '1<|box;x1=16;y1=586;x2=748;y2=1094;w=1920;h=1280;c=0.94|><|mask;x=0;y=0;c=0.94;data=509,733,!!!!4P|>';

describe('parseSamOutput', () => {
  it('reads boxes, image size and confidence, ignoring masks', () => {
    const out = parseSamOutput(SAM_TEXT);
    expect(out.imageWidth).toBe(1920);
    expect(out.imageHeight).toBe(1280);
    expect(out.instances).toEqual([
      { box: { x1: 1179, y1: 585, x2: 1900, y2: 1071 }, confidence: 0.96 },
      { box: { x1: 16, y1: 586, x2: 748, y2: 1094 }, confidence: 0.94 },
    ]);
  });

  it('returns no instance for an empty answer (no match)', () => {
    expect(parseSamOutput('')).toEqual({ imageWidth: 0, imageHeight: 0, instances: [] });
  });

  it('skips a malformed box', () => {
    expect(parseSamOutput('<0f>0<|box;x1=1;y1=2;w=10;h=10|>').instances).toEqual([]);
  });
});

describe('boxUnionCoverage', () => {
  it('counts inclusive pixels of one box', () => {
    // 0..4 inclusive = 5 × 5 px on a 10 × 10 image
    expect(boxUnionCoverage([{ x1: 0, y1: 0, x2: 4, y2: 4 }], 10, 10)).toBeCloseTo(0.25);
  });

  it('does not double count overlapping boxes', () => {
    const boxes = [
      { x1: 0, y1: 0, x2: 4, y2: 4 },
      { x1: 2, y1: 2, x2: 6, y2: 6 },
    ];
    // 25 + 25 − 9 (3 × 3 overlap) = 41 px
    expect(boxUnionCoverage(boxes, 10, 10)).toBeCloseTo(0.41);
  });

  it('clips boxes to the image and caps at 1', () => {
    expect(boxUnionCoverage([{ x1: -5, y1: -5, x2: 50, y2: 50 }], 10, 10)).toBe(1);
  });

  it('is 0 without boxes or without image size', () => {
    expect(boxUnionCoverage([], 10, 10)).toBe(0);
    expect(boxUnionCoverage([{ x1: 0, y1: 0, x2: 1, y2: 1 }], 0, 0)).toBe(0);
  });
});
