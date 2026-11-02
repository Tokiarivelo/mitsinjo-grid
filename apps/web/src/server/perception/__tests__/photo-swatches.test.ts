// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));

import sharp from 'sharp';
import { kitToRecipe } from '@/lib/object-kit';
import {
  blendHalfOffset,
  extractSwatches,
  findBestPatch,
  normaliseSwatch,
  erodeMask,
  limitContrast,
  patchStats,
  vetSwatches,
  SWATCH_MAX_SPREAD,
  SWATCH_TARGET_SPREAD,
  type SwatchCandidate,
  SWATCH_BASELINE,
  SWATCH_SIZE,
} from '../photo-swatches';
import { GOLDEN_SHAPES, PHOTO, goldenBox, goldenOutline, goldenSvg } from '../__fixtures__/shape';

describe('photoSwatches (PR-1.5)', () => {
  describe('blendHalfOffset', () => {
    it('makes a patch tileable: edges wrap seamlessly without seam lines', () => {
      const N = 64;
      // Linear gradient across x: 0 at left, 255 at right (strong edge across wrap seam).
      const raw = new Uint8Array(N * N * 3);
      for (let y = 0; y < N; y++) {
        for (let x = 0; x < N; x++) {
          const val = Math.round((x / (N - 1)) * 255);
          const i = (y * N + x) * 3;
          raw[i] = val;
          raw[i + 1] = val;
          raw[i + 2] = val;
        }
      }

      const blended = blendHalfOffset(raw, N);

      // In the original, the step from x = N - 1 (255) to x = 0 (0) was 255.
      // In the blended patch, left and right edges wrap smoothly:
      let maxEdgeStep = 0;
      for (let y = 0; y < N; y++) {
        const leftVal = blended[y * N * 3]!;
        const rightVal = blended[(y * N + (N - 1)) * 3]!;
        const step = Math.abs(leftVal - rightVal);
        if (step > maxEdgeStep) maxEdgeStep = step;
      }
      expect(maxEdgeStep).toBeLessThan(10);

      // The center has no seam: adjacent pixels near center are continuous.
      const cy = N >> 1;
      const cx = N >> 1;
      const centerStep = Math.abs(blended[(cy * N + cx) * 3]! - blended[(cy * N + (cx + 1)) * 3]!);
      expect(centerStep).toBeLessThan(15);
    });
  });

  describe('normaliseSwatch', () => {
    it('normalises channels to average baseline (relative average = 1) while preserving grain', () => {
      const N = 64;
      // High contrast input with average around 100
      const raw = new Uint8Array(N * N * 3);
      for (let i = 0; i < N * N; i++) {
        const v = 80 + (i % 41);
        raw[i * 3] = v;
        raw[i * 3 + 1] = v + 10;
        raw[i * 3 + 2] = v - 10;
      }

      const norm = normaliseSwatch(raw, N, SWATCH_BASELINE);

      let sumR = 0;
      let sumG = 0;
      let sumB = 0;
      for (let i = 0; i < N * N; i++) {
        sumR += norm[i * 3]!;
        sumG += norm[i * 3 + 1]!;
        sumB += norm[i * 3 + 2]!;
      }
      const avgR = sumR / (N * N);
      const avgG = sumG / (N * N);
      const avgB = sumB / (N * N);

      expect(avgR).toBeCloseTo(SWATCH_BASELINE, 0);
      expect(avgG).toBeCloseTo(SWATCH_BASELINE, 0);
      expect(avgB).toBeCloseTo(SWATCH_BASELINE, 0);

      // Non-flat: grain variation is preserved
      expect(Math.max(...norm) - Math.min(...norm)).toBeGreaterThan(20);
    });
  });

  describe('findBestPatch', () => {
    it('returns null if the region is too small for any candidate size', () => {
      const W = 32;
      const H = 32;
      const mask = new Uint8Array(W * H); // all 0
      const rgb = new Uint8Array(W * H * 3);
      const patch = findBestPatch(rgb, W, H, mask, [128, 128, 128]);
      expect(patch).toBeNull();
    });

    it('prefers a patch with even texture over one with a sharp edge', () => {
      const W = 128;
      const H = 64;
      const mask = new Uint8Array(W * H).fill(1);
      const rgb = new Uint8Array(W * H * 3);

      // Left 64x64 has a sharp black-to-white line down the middle
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < 64; x++) {
          const val = x < 32 ? 20 : 230;
          const i = (y * W + x) * 3;
          rgb[i] = val;
          rgb[i + 1] = val;
          rgb[i + 2] = val;
        }
      }
      // Right 64x64 is uniform 128
      for (let y = 0; y < H; y++) {
        for (let x = 64; x < W; x++) {
          const val = 128;
          const i = (y * W + x) * 3;
          rgb[i] = val;
          rgb[i + 1] = val;
          rgb[i + 2] = val;
        }
      }

      const patch = findBestPatch(rgb, W, H, mask, [128, 128, 128], 64);
      expect(patch).not.toBeNull();
      // Should pick the uniform right half (x0 >= 64)
      expect(patch!.x0).toBeGreaterThanOrEqual(60);
    });
  });

  describe('extractSwatches', () => {
    it('extracts one tileable swatch per textured material under 8 kB', async () => {
      const cottage = GOLDEN_SHAPES.find((c) => c.name === 'cottage row')!;
      const buffer = await sharp(Buffer.from(goldenSvg(cottage)))
        .jpeg({ quality: 85 })
        .toBuffer();
      const photo = { buffer, ...PHOTO };
      const target = {
        box: goldenBox(cottage),
        outline: goldenOutline(cottage),
      };
      // Measured colours, as in the pipeline (the prior's are deliberately wrong).
      const recipe = kitToRecipe({
        ...cottage.prior,
        colors: {
          ...cottage.prior.colors,
          main: cottage.expect.main!,
          secondary: cottage.expect.secondary!,
        },
      });

      const swatches = await extractSwatches(photo, target, recipe);

      expect(swatches).toBeDefined();
      // Stone and slate are textured materials, glass is smooth (no swatch)
      expect(swatches.stone).toBeDefined();
      expect(swatches.slate).toBeDefined();
      expect((swatches as Record<string, string>).glass).toBeUndefined();

      // Check format and size contract (≤ 8 kB each)
      for (const [, url] of Object.entries(swatches)) {
        expect(url).toMatch(/^data:image\/png;base64,/);
        // Base64 string length <= 8192 characters (8 kB)
        expect(url!.length).toBeLessThan(8192);

        // Verify the PNG header and 64x64 dimensions
        const base64Data = url!.replace(/^data:image\/png;base64,/, '');
        const imgBuffer = Buffer.from(base64Data, 'base64');
        const metadata = await sharp(imgBuffer).metadata();
        expect(metadata.width).toBe(SWATCH_SIZE);
        expect(metadata.height).toBe(SWATCH_SIZE);
        expect(metadata.format).toBe('png');
      }

      // Contract: 4 slate roofs share ONE swatch (keys are material names, not parts)
      expect(Object.keys(swatches)).toEqual(['stone', 'slate']);
    });

    it('drops a swatch cut far from its part colour (wrong colours = wrong surface)', async () => {
      const cottage = GOLDEN_SHAPES.find((c) => c.name === 'cottage row')!;
      const buffer = await sharp(Buffer.from(goldenSvg(cottage)))
        .jpeg({ quality: 85 })
        .toBuffer();
      const swatches = await extractSwatches(
        { buffer, ...PHOTO },
        { box: goldenBox(cottage), outline: goldenOutline(cottage) },
        kitToRecipe(cottage.prior)
      );
      expect(swatches.stone).toBeUndefined();
    });
  });
});

describe('swatch checks (PG-T6)', () => {
  const flat = (r: number, g: number, b: number, n = 16) => {
    const a = new Uint8Array(n * n * 3);
    for (let i = 0; i < n * n; i++) a.set([r, g, b], i * 3);
    return a;
  };
  const cand = (over: Partial<SwatchCandidate>): SwatchCandidate => ({
    material: 'plaster',
    patch: { x0: 0, y0: 0, size: 16 },
    rgb: flat(200, 190, 170),
    lab: patchStats(flat(200, 190, 170)).lab,
    spread: 0.03,
    colorDE: 3,
    ...over,
  });

  it('user case 2026-11-02: roof and wall cut from the same pixels → both dropped', () => {
    const { kept, rejected } = vetSwatches([
      cand({ material: 'thatch', patch: { x0: 10, y0: 10, size: 32 } }),
      cand({ material: 'wood', patch: { x0: 20, y0: 20, size: 32 }, lab: [40, 30, 10] }),
    ]);
    expect(kept).toEqual([]);
    expect(rejected.map((r) => r.why)).toEqual(['same_as_other', 'same_as_other']);
  });

  it('two surfaces of the same colour are one surface twice', () => {
    const { kept } = vetSwatches([
      cand({ material: 'thatch', patch: { x0: 0, y0: 0, size: 16 } }),
      cand({ material: 'plaster', patch: { x0: 40, y0: 40, size: 16 } }),
    ]);
    expect(kept).toHaveLength(0);
  });

  it('keeps distinct surfaces, drops blotchy and off-colour patches', () => {
    const { kept, rejected } = vetSwatches([
      cand({ material: 'thatch', lab: [70, 5, 35] }),
      cand({ material: 'plaster', patch: { x0: 40, y0: 40, size: 16 }, lab: [85, 1, 8] }),
      cand({
        material: 'stone',
        patch: { x0: 80, y0: 0, size: 16 },
        spread: SWATCH_MAX_SPREAD + 0.05,
      }),
      cand({ material: 'brick', patch: { x0: 0, y0: 80, size: 16 }, colorDE: 35 }),
    ]);
    expect(kept.map((c) => c.material)).toEqual(['thatch', 'plaster']);
    expect(rejected).toEqual([
      { material: 'stone', why: 'blotchy' },
      { material: 'brick', why: 'off_colour' },
    ]);
  });

  it('limitContrast compresses blotches to the target spread, mean kept', () => {
    const n = 16;
    const a = new Uint8Array(n * n * 3);
    for (let i = 0; i < n * n; i++) a.fill(i % 2 ? 230 : 40, i * 3, i * 3 + 3);
    const before = patchStats(a);
    const after = patchStats(limitContrast(a, before.spread));
    expect(after.spread).toBeCloseTo(SWATCH_TARGET_SPREAD, 2);
    expect(after.lab[0]).toBeCloseTo(before.lab[0], -1);
    // Already calm: untouched.
    const calm = flat(120, 120, 120);
    expect(limitContrast(calm, 0.01)).toBe(calm);
  });

  it('erodeMask drops the border band of a region', () => {
    const w = 10;
    const m = new Uint8Array(w * w).fill(1);
    const e = erodeMask(m, w, w, 2);
    expect(e[0]).toBe(0);
    expect(e[2 * w + 2]).toBe(1);
    expect(e[1 * w + 5]).toBe(0);
    expect(Array.from(e).reduce((a, b) => a + b, 0)).toBe(36);
  });
});
