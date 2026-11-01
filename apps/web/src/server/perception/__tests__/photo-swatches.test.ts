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
      const recipe = kitToRecipe(cottage.prior);

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
  });
});
