import 'server-only';

import sharp from 'sharp';
import type { ObjectRecipe, RecipeMaterial, ShapeTarget } from '@/lib/object-shape';
import { pathToRings } from '@/lib/vision';
import { recipeMaterials } from '@/features/vision-insert/utils/surface-look';
import {
  MAPPED_SURFACES,
  SWATCH_BASELINE,
  SWATCH_SIZE,
} from '@/features/vision-insert/utils/surface-maps';
import { hexToRgb } from './color-measure';
import { renderFlat } from './flat-render';
import type { PhotoForRegions } from './region';
import { pixelBox } from './shape-colors';
import { ringsMask } from './silhouette-fit';

export { SWATCH_BASELINE, SWATCH_SIZE };

/**
 * Photo swatches (PR-1.5): tileable 64 px textures cut from the photo for each textured material.
 * Where each material sits: the flat renderer's visible part map intersected with the SAM outline.
 * Patch choice: the window fully inside that region with the most even texture and a colour close to
 * the measured one.
 * Tileable: blended with a half-offset copy so edges wrap seamlessly.
 * Normalised: average pixel value set to `SWATCH_BASELINE` (relative average = 1), so each part's
 * measured colour tints it without darkening. One swatch per material on `recipe.swatches`.
 */

/**
 * Blend a square patch with a half-offset copy so its edges wrap seamlessly without seam lines
 * at the borders or the centre.
 */
export function blendHalfOffset(rgb: Uint8Array, size: number): Uint8Array {
  const half = size >> 1;
  const out = new Uint8Array(size * size * 3);
  for (let y = 0; y < size; y++) {
    const v = (y + 0.5) / size;
    const sy = Math.sin(Math.PI * v);
    const wy = sy * sy;
    const oy = (y + half) % size;
    for (let x = 0; x < size; x++) {
      const u = (x + 0.5) / size;
      const sx = Math.sin(Math.PI * u);
      const w = sx * sx * wy;
      const ox = (x + half) % size;
      const i = (y * size + x) * 3;
      const j = (oy * size + ox) * 3;
      out[i] = Math.round(w * rgb[i]! + (1 - w) * rgb[j]!);
      out[i + 1] = Math.round(w * rgb[i + 1]! + (1 - w) * rgb[j + 1]!);
      out[i + 2] = Math.round(w * rgb[i + 2]! + (1 - w) * rgb[j + 2]!);
    }
  }
  return out;
}

/**
 * Normalise each RGB channel to average `baseline` (relative average = 1).
 * Adds grain and variation while keeping the measured colour tint exact.
 */
export function normaliseSwatch(
  rgb: Uint8Array,
  size: number,
  baseline = SWATCH_BASELINE
): Uint8Array {
  const n = size * size;
  let sumR = 0;
  let sumG = 0;
  let sumB = 0;
  for (let i = 0; i < n; i++) {
    sumR += rgb[i * 3]!;
    sumG += rgb[i * 3 + 1]!;
    sumB += rgb[i * 3 + 2]!;
  }
  const meanR = sumR / n || 1;
  const meanG = sumG / n || 1;
  const meanB = sumB / n || 1;
  const out = new Uint8Array(n * 3);
  for (let i = 0; i < n; i++) {
    out[i * 3] = Math.min(255, Math.max(0, Math.round(baseline * (rgb[i * 3]! / meanR))));
    out[i * 3 + 1] = Math.min(255, Math.max(0, Math.round(baseline * (rgb[i * 3 + 1]! / meanG))));
    out[i * 3 + 2] = Math.min(255, Math.max(0, Math.round(baseline * (rgb[i * 3 + 2]! / meanB))));
  }
  return out;
}

/** Candidate window sizes in descending order: 64 px preferred, smaller when the region is constrained. */
const CANDIDATE_SIZES = [SWATCH_SIZE, 48, 32, 24, 16] as const;

export interface BestPatch {
  x0: number;
  y0: number;
  size: number;
}

/**
 * Find a square window fully inside `materialMask` with the most even texture (low gradient spread,
 * no strong edges) and colour closest to `targetColor`.
 */
export function findBestPatch(
  boxRgb: Uint8Array,
  width: number,
  height: number,
  materialMask: Uint8Array,
  targetColor: readonly [number, number, number],
  targetSize = SWATCH_SIZE
): BestPatch | null {
  // 2D integral image (SAT) of materialMask to check if a window is 100% inside in O(1).
  const sat = new Int32Array((width + 1) * (height + 1));
  for (let y = 0; y < height; y++) {
    let rowSum = 0;
    for (let x = 0; x < width; x++) {
      rowSum += materialMask[y * width + x]!;
      sat[(y + 1) * (width + 1) + (x + 1)] = sat[y * (width + 1) + (x + 1)]! + rowSum;
    }
  }
  const countInside = (x0: number, y0: number, s: number) => {
    const x1 = x0 + s;
    const y1 = y0 + s;
    return (
      sat[y1 * (width + 1) + x1]! -
      sat[y0 * (width + 1) + x1]! -
      sat[y1 * (width + 1) + x0]! +
      sat[y0 * (width + 1) + x0]!
    );
  };

  // Luminance gradient magnitude across the box.
  const lum = new Float32Array(width * height);
  for (let i = 0; i < lum.length; i++) {
    lum[i] =
      (0.299 * boxRgb[i * 3]! + 0.587 * boxRgb[i * 3 + 1]! + 0.114 * boxRgb[i * 3 + 2]!) / 255;
  }
  const grad = new Float32Array(width * height);
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const gx = (lum[y * width + x + 1]! - lum[y * width + x - 1]!) / 2;
      const gy = (lum[(y + 1) * width + x]! - lum[(y - 1) * width + x]!) / 2;
      grad[y * width + x] = Math.hypot(gx, gy);
    }
  }

  // Find the largest candidate size with at least one window fully inside the mask.
  const sizes = CANDIDATE_SIZES.filter((s) => s <= targetSize && s <= width && s <= height);
  for (const s of sizes) {
    let bestX = -1;
    let bestY = -1;
    let minCost = Infinity;

    // Check with a small stride for speed on large regions.
    const stride = s >= 48 ? 2 : 1;
    for (let y0 = 0; y0 <= height - s; y0 += stride) {
      for (let x0 = 0; x0 <= width - s; x0 += stride) {
        if (countInside(x0, y0, s) !== s * s) continue;

        // Metric 1: max edge and gradient spread in the window.
        let maxE = 0;
        let sumG = 0;
        let sumR = 0;
        let sumG_ = 0;
        let sumB = 0;
        for (let dy = 0; dy < s; dy++) {
          const row = (y0 + dy) * width;
          for (let dx = 0; dx < s; dx++) {
            const idx = row + (x0 + dx);
            const g = grad[idx]!;
            if (g > maxE) maxE = g;
            sumG += g;
            sumR += boxRgb[idx * 3]!;
            sumG_ += boxRgb[idx * 3 + 1]!;
            sumB += boxRgb[idx * 3 + 2]!;
          }
        }
        const meanG = sumG / (s * s);
        let varG = 0;
        for (let dy = 0; dy < s; dy++) {
          const row = (y0 + dy) * width;
          for (let dx = 0; dx < s; dx++) {
            const g = grad[row + (x0 + dx)]!;
            varG += (g - meanG) ** 2;
          }
        }
        const stdG = Math.sqrt(varG / (s * s));

        // Metric 2: colour distance to the measured colour of this material.
        const avgR = sumR / (s * s);
        const avgG = sumG_ / (s * s);
        const avgB = sumB / (s * s);
        const colorDiff =
          Math.hypot(avgR - targetColor[0], avgG - targetColor[1], avgB - targetColor[2]) / 255;

        // Cost: penalise strong edges heavily, favour uniform texture and close colour.
        const cost = maxE * 2.0 + stdG + colorDiff * 1.5;
        if (cost < minCost) {
          minCost = cost;
          bestX = x0;
          bestY = y0;
        }
      }
    }

    if (bestX >= 0 && bestY >= 0) {
      return { x0: bestX, y0: bestY, size: s };
    }
  }

  return null;
}

/**
 * Extract photo swatches for all textured materials on a recipe (PR-1.5).
 * Returns a dictionary mapping material name to a tileable 64 px PNG data URL (≤ 8 kB each).
 */
export async function extractSwatches(
  photo: PhotoForRegions,
  target: Pick<ShapeTarget, 'box' | 'outline'>,
  recipe: ObjectRecipe
): Promise<Partial<Record<RecipeMaterial, string>>> {
  // Find which materials are used on the recipe that have textured maps.
  const materials = recipeMaterials(recipe).filter((m) =>
    (MAPPED_SURFACES as readonly string[]).includes(m)
  );
  if (!materials.length) return {};

  const px = pixelBox(photo, target.box);
  if (px.width < 16 || px.height < 16) return {};

  // Extract raw RGB of the detection box.
  const { data: boxRgb, info } = await sharp(photo.buffer, { failOn: 'none' })
    .extract(px)
    .removeAlpha()
    .toColourspace('srgb')
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height } = info;
  const aspect = (target.box.w * photo.width) / (target.box.h * photo.height);
  if (!(aspect > 0)) return {};

  // Render flat recipe at the exact box resolution to get the per-pixel part map.
  const flat = renderFlat(recipe, aspect, width, height);
  const rings = target.outline ? pathToRings(target.outline).filter((r) => r.length >= 3) : [];
  const outline = ringsMask(rings, target.box, width, height);

  const swatches: Partial<Record<RecipeMaterial, string>> = {};

  for (const m of materials) {
    // Find measured color from the recipe parts of this material.
    const part = recipe.parts.find((p) => p.material === m);
    if (!part) continue;
    const targetColor = hexToRgb(part.color);

    // Mask of where this material is visible on the photo.
    const materialMask = new Uint8Array(width * height);
    let area = 0;
    for (let i = 0; i < materialMask.length; i++) {
      if (
        outline.data[i] === 1 &&
        flat.part[i]! >= 0 &&
        recipe.parts[flat.part[i]!]?.material === m
      ) {
        materialMask[i] = 1;
        area++;
      }
    }
    // Need at least 16×16 pixels to extract any swatch.
    if (area < 256) continue;

    const best = findBestPatch(boxRgb, width, height, materialMask, targetColor, SWATCH_SIZE);
    if (!best) continue;

    // Cut the patch.
    const patchRaw = new Uint8Array(best.size * best.size * 3);
    for (let dy = 0; dy < best.size; dy++) {
      const srcRow = (best.y0 + dy) * width;
      const dstRow = dy * best.size;
      for (let dx = 0; dx < best.size; dx++) {
        const srcIdx = (srcRow + (best.x0 + dx)) * 3;
        const dstIdx = (dstRow + dx) * 3;
        patchRaw[dstIdx] = boxRgb[srcIdx]!;
        patchRaw[dstIdx + 1] = boxRgb[srcIdx + 1]!;
        patchRaw[dstIdx + 2] = boxRgb[srcIdx + 2]!;
      }
    }

    // Resize to 64x64 if cut from a smaller window.
    let patch64 = patchRaw;
    if (best.size !== SWATCH_SIZE) {
      const resized = await sharp(Buffer.from(patchRaw), {
        raw: { width: best.size, height: best.size, channels: 3 },
      })
        .resize(SWATCH_SIZE, SWATCH_SIZE, { fit: 'fill' })
        .raw()
        .toBuffer();
      patch64 = new Uint8Array(resized);
    }

    // Blend with half-offset copy to make tileable.
    const blended = blendHalfOffset(patch64, SWATCH_SIZE);

    // Normalise to average 1 (baseline = SWATCH_BASELINE).
    const normalised = normaliseSwatch(blended, SWATCH_SIZE, SWATCH_BASELINE);

    // Convert to PNG data URL.
    const pngBuffer = await sharp(Buffer.from(normalised), {
      raw: { width: SWATCH_SIZE, height: SWATCH_SIZE, channels: 3 },
    })
      .png()
      .toBuffer();

    swatches[m] = `data:image/png;base64,${pngBuffer.toString('base64')}`;
  }

  return swatches;
}
