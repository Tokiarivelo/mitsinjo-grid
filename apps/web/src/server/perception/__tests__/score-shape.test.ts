// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { kitToRecipe, type ObjectKit } from '@/lib/object-kit';
import type { PartMask } from '@/lib/object-shape';
import type { MaskMapGeom } from '../mask-geometry';
import { buildLandmarks } from '../score-shape';
import { cropRectForShape } from '../shape-crop';

const vehicleKit = (): ObjectKit => ({
  archetype: 'vehicle',
  proportions: { w: 1, h: 0.4, d: 0.45 },
  colors: { main: '#a33327', secondary: '#cfd6dd', accent: '#1c1c1e' },
  materials: { main: 'metal', secondary: 'glass', accent: 'rubber' },
});

const houseKit = (): ObjectKit => ({
  archetype: 'house',
  proportions: { w: 1, h: 0.6, d: 0.5 },
  colors: { main: '#aaaaaa', secondary: '#bb2222', accent: '#2222bb' },
  materials: { main: 'plaster', secondary: 'tile', accent: 'glass' },
});

/** Photo 200×100, box 160×80 px at (20, 10): the crop is the whole photo. */
const geomA = (): MaskMapGeom => {
  const box = { x: 0.1, y: 0.1, w: 0.8, h: 0.8 };
  return { photoW: 200, photoH: 100, box, crop: cropRectForShape(200, 100, box) };
};

describe('buildLandmarks (PR-0.8)', () => {
  it('wheel mask → nearest wheel part, mask centre in grid pixels', () => {
    const geom = geomA();
    const recipe = kitToRecipe(vehicleKit());
    // Mask centre on the left wheels (object −0.25, −0.375): photo (60, 80).
    const masks: PartMask[] = [{ concept: 'wheel', box: { x: 0.25, y: 0.75, w: 0.1, h: 0.1 } }];
    const lm = buildLandmarks(recipe, masks, geom, 48, 24);
    expect(lm).toHaveLength(1);
    // Sedan wheels are parts 4–7; the −x pair ties on x/y, the first wins.
    expect(lm[0]!.part).toBe(6);
    expect(lm[0]!.x).toBeCloseTo(12, 9);
    expect(lm[0]!.y).toBeCloseTo(21, 9);
  });

  it('window mask → nearest thin panel; none on the sedan → skipped', () => {
    const geom = geomA();
    // Mask centre near the left facade window (object −0.381, −0.0625): photo (39, 55).
    const masks: PartMask[] = [{ concept: 'window', box: { x: 0.15, y: 0.5, w: 0.09, h: 0.1 } }];
    const house = buildLandmarks(kitToRecipe(houseKit()), masks, geom, 48, 24);
    expect(house).toHaveLength(1);
    expect(house[0]!.part).toBe(4);
    expect(house[0]!.x).toBeCloseTo(5.7, 6);
    expect(house[0]!.y).toBeCloseTo(13.5, 6);
    // The sedan template has no thin boxes (lights are cylinders): nothing to judge.
    expect(buildLandmarks(kitToRecipe(vehicleKit()), masks, geom, 48, 24)).toHaveLength(0);
  });

  it('other concepts and garbage boxes are skipped', () => {
    const geom = geomA();
    const recipe = kitToRecipe(vehicleKit());
    const masks: PartMask[] = [
      { concept: 'chimney', box: { x: 0.25, y: 0.75, w: 0.1, h: 0.1 } },
      { concept: 'wheel', box: { x: NaN, y: 0.75, w: 0.1, h: 0.1 } },
      { concept: 'wheel', box: { x: 0.25, y: 0.75, w: 0, h: 0.1 } },
    ];
    expect(buildLandmarks(recipe, masks, geom, 48, 24)).toHaveLength(0);
  });
});
