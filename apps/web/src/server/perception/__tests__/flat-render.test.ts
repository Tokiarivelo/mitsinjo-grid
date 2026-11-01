// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { kitToRecipe } from '@/lib/object-kit';
import type { ObjectRecipe, RecipePart } from '@/lib/object-shape';
import { FLAT_AMBIENT, FLAT_LIGHT, renderFlat } from '../flat-render';
import { iou, renderRecipe } from '../silhouette-fit';
import { GOLDEN_SHAPES } from '../__fixtures__/shape';

const part = (over: Partial<RecipePart>): RecipePart => ({
  shape: 'box',
  at: [0, 0, 0],
  size: [1, 1, 1],
  color: '#c08040',
  ...over,
});
const recipe = (parts: RecipePart[], yaw?: number): ObjectRecipe => ({
  proportions: { w: 1, h: 1, d: 1 },
  parts,
  yaw,
});
const pixel = (r: ReturnType<typeof renderFlat>, c: number, row: number, cols: number) => {
  const i = (row * cols + c) * 3;
  return [r.rgb[i]!, r.rgb[i + 1]!, r.rgb[i + 2]!];
};

describe('renderFlat (PR-0.1)', () => {
  it('a box head-on renders its colour, shaded by its front face', () => {
    const r = renderFlat(recipe([part({})]), 1, 32, 32);
    const shade = FLAT_AMBIENT + (1 - FLAT_AMBIENT) * FLAT_LIGHT[2];
    expect(pixel(r, 16, 16, 32)).toEqual([0xc0, 0x80, 0x40].map((v) => Math.round(v * shade)));
    expect(r.mask.data.every((v) => v === 1)).toBe(true);
    expect(r.part[0]).toBe(0);
  });

  it('leaves the background empty around a smaller part', () => {
    const r = renderFlat(recipe([part({ size: [0.5, 0.5, 0.5] })]), 1, 32, 32);
    expect(r.mask.data[0]).toBe(0);
    expect(r.part[0]).toBe(-1);
    expect(pixel(r, 0, 0, 32)).toEqual([0, 0, 0]);
    expect(r.mask.data.reduce((s, v) => s + v, 0)).toBe(16 * 16);
  });

  it('the nearest part wins whatever the part order (z-buffer)', () => {
    const back = part({ size: [1, 1, 0.4], at: [0, 0, -0.3], color: '#ff0000' });
    const front = part({ size: [0.4, 0.4, 0.2], at: [0, 0, 0.3], color: '#0000ff' });
    for (const parts of [
      [back, front],
      [front, back],
    ]) {
      const r = renderFlat(recipe(parts), 1, 20, 20);
      const blue = pixel(r, 10, 10, 20);
      expect(blue[2]).toBeGreaterThan(0);
      expect(blue[0]).toBe(0);
    }
  });

  it('a turned box shows two faces with different light', () => {
    const r = renderFlat(recipe([part({})], 0.5), 1.4, 64, 32);
    const left = pixel(r, 20, 16, 64);
    const right = pixel(r, 44, 16, 64);
    expect(left[0]).not.toBe(right[0]);
  });

  it('round parts: a sphere is lit at its upper left, a cone narrows to its apex', () => {
    const s = renderFlat(recipe([part({ shape: 'sphere' })]), 1, 40, 40);
    expect(pixel(s, 14, 12, 40)[0]).toBeGreaterThan(pixel(s, 28, 30, 40)[0]!);
    expect(s.mask.data[0]).toBe(0); // corner outside the disc
    const c = renderFlat(recipe([part({ shape: 'cone' })]), 1, 40, 40);
    const rowWidth = (row: number) =>
      c.mask.data.slice(row * 40, row * 40 + 40).reduce((a, v) => a + v, 0);
    expect(rowWidth(36)).toBeGreaterThan(rowWidth(4));
  });

  it('a lying cylinder (axis x) is wider than tall', () => {
    const r = renderFlat(
      recipe([part({ shape: 'cylinder', axis: 'x', size: [1, 0.4, 0.4] })]),
      1,
      40,
      40
    );
    const cols = new Set<number>();
    const rows = new Set<number>();
    r.mask.data.forEach((v, i) => {
      if (v) {
        cols.add(i % 40);
        rows.add(Math.floor(i / 40));
      }
    });
    expect(cols.size).toBeGreaterThan(rows.size * 2);
  });

  it('matches the fit silhouette on the golden set, within budget', () => {
    for (const c of GOLDEN_SHAPES) {
      const rec = kitToRecipe(c.prior);
      const aspect = rec.proportions.w / rec.proportions.h;
      const t0 = performance.now();
      const flat = renderFlat(rec, aspect, 128, Math.round(128 / aspect));
      const ms = performance.now() - t0;
      const sil = renderRecipe(rec, aspect, 128, Math.round(128 / aspect));
      expect(iou(flat.mask, sil), c.name).toBeGreaterThan(0.95);
      expect(ms, c.name).toBeLessThan(100);
    }
  });
});
