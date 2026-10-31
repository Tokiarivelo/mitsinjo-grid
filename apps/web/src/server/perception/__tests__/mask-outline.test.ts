// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { MAX_OUTLINE_POINTS, maskToOutline, pathToRings, simplify } from '../mask-outline';
import { parseSamOutput } from '../parse-sam';

// Complete sam-3.1 records (lossless masks) from the @meta-sam/parser README: 320 × 334 frame, prompt "button".
const SAM_FULL =
  '<0f>0<|box;x1=211;y1=228;x2=270;y2=254;w=320;h=334|>' +
  "<|mask;x=0;y=0;data=27,60,~!!!!M!0c[0o91w?q1!pIH4pPRVp2B3'7`e.ioeAf6-k/#Xd8%dX9x(|>" +
  ',1<|box;x1=155;y1=228;x2=202;y2=254;w=320;h=334|>' +
  '<|mask;x=0;y=0;data=27,48,~!!!!J!0c[q=Pj_zs=*4C4(/./x#:/`S_GnD`=o3?X{emCgO$y@|>';

const points = (path: string) => pathToRings(path).flat();

describe('maskToOutline (PV-T5)', () => {
  const parsed = parseSamOutput(SAM_FULL);

  it('decodes a real mask into a closed outline inside its box, in image fractions', () => {
    const inst = parsed.instances[0]!;
    const outline = maskToOutline(parsed.masks[0]!, inst.box, 320, 334)!;
    expect(outline).toMatch(/^M[\d.]+ [\d.]+(L[\d.]+ [\d.]+)+Z$/);
    const pts = points(outline);
    expect(pts.length).toBeGreaterThan(8);
    expect(pts.length).toBeLessThanOrEqual(MAX_OUTLINE_POINTS);
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    // Box 211–270 × 228–254 (inclusive px) → edges 211/320 … 271/320, 228/334 … 255/334.
    expect(Math.min(...xs)).toBeCloseTo(211 / 320, 2);
    expect(Math.max(...xs)).toBeCloseTo(271 / 320, 2);
    expect(Math.min(...ys)).toBeCloseTo(228 / 334, 2);
    expect(Math.max(...ys)).toBeCloseTo(255 / 334, 2);
  });

  it('the two objects get distinct outlines at their own place', () => {
    const [a, b] = parsed.instances.map((inst, i) =>
      maskToOutline(parsed.masks[i]!, inst.box, 320, 334)!
    );
    expect(Math.max(...points(b!).map((p) => p[0]))).toBeLessThan(
      Math.min(...points(a!).map((p) => p[0]))
    );
  });

  it('returns null for an unreadable mask or no image size, never throws', () => {
    const box = { x1: 0, y1: 0 };
    expect(
      maskToOutline(
        { encoding: 'one_bit', height: 487, width: 722, payload: '!!!!$q@' },
        box,
        1920,
        1280
      )
    ).toBeNull();
    expect(maskToOutline(parsed.masks[0]!, box, 0, 0)).toBeNull();
  });
});

describe('path helpers', () => {
  it('pathToRings splits subpaths and drops degenerate ones', () => {
    expect(pathToRings('M0 0L1 0L1 1ZM5 5L6 6Z')).toEqual([
      [
        [0, 0],
        [1, 0],
        [1, 1],
      ],
    ]);
  });

  it('simplify drops collinear points and keeps corners', () => {
    const line = [
      [0, 0],
      [1, 0],
      [2, 0],
      [2, 1],
      [2, 2],
    ] as const;
    expect(simplify(line, 0.01)).toEqual([
      [0, 0],
      [2, 0],
      [2, 2],
    ]);
  });
});
