import { describe, expect, it } from 'vitest';
import { boxUnionCoverage, parseSamMask, parseSamOutput } from '../parse-sam';

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

  it('keeps each mask (still encoded) aligned with its box; mask size = box size', () => {
    const { masks, instances } = parseSamOutput(SAM_TEXT);
    expect(masks).toEqual([
      { encoding: 'one_bit', height: 487, width: 722, payload: '!!!!$q@' },
      { encoding: 'one_bit', height: 509, width: 733, payload: '!!!!4P' },
    ]);
    const b = instances[0]!.box;
    expect([b.y2 - b.y1 + 1, b.x2 - b.x1 + 1]).toEqual([487, 722]);
  });

  it('reads the lossless marker and rejects malformed mask data', () => {
    expect(parseSamMask('x=0;y=0;data=2,3,~a=b!')).toEqual({
      encoding: 'lossless',
      height: 2,
      width: 3,
      payload: '~a=b!',
    });
    expect(parseSamMask('x=0;y=0;data=2,3,Zabc')).toBeNull();
    expect(parseSamMask('x=0;y=0;data=0,3,!a')).toBeNull();
    expect(parseSamMask('x=0;y=0')).toBeNull();
    const noMask = parseSamOutput('<0f>0<|box;x1=0;y1=0;x2=9;y2=4;w=10;h=10|>');
    expect(noMask.masks).toEqual([null]);
  });

  it('returns no instance for an empty answer (no match)', () => {
    expect(parseSamOutput('')).toEqual({ imageWidth: 0, imageHeight: 0, instances: [], masks: [] });
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
