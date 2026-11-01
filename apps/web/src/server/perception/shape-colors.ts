import 'server-only';

import sharp from 'sharp';
import { pathToRings } from '@/lib/vision';
import { insideRings, objectPixels, type ObjectPixels } from './color-measure';
import type { PhotoForRegions } from './region';
import type { NormBox } from './schemas';

/** Long side of the sampled box (px): enough for colour groups, ~10 k pixels at most. */
export const COLOR_SAMPLE_PX = 96;

/**
 * Pixels of the object for the colour measure (PF-T2): the box, downscaled, kept only inside the SAM
 * outline when there is one (no sky, no road). Without an outline every box pixel counts.
 */
export async function sampleObjectPixels(
  photo: PhotoForRegions,
  box: NormBox,
  outline?: string
): Promise<ObjectPixels> {
  const left = Math.max(0, Math.min(photo.width - 1, Math.floor(box.x * photo.width)));
  const top = Math.max(0, Math.min(photo.height - 1, Math.floor(box.y * photo.height)));
  const width = Math.max(1, Math.min(photo.width - left, Math.round(box.w * photo.width)));
  const height = Math.max(1, Math.min(photo.height - top, Math.round(box.h * photo.height)));
  const scale = Math.min(1, COLOR_SAMPLE_PX / Math.max(width, height));
  const { data, info } = await sharp(photo.buffer, { failOn: 'none' })
    .extract({ left, top, width, height })
    .resize({
      width: Math.max(1, Math.round(width * scale)),
      height: Math.max(1, Math.round(height * scale)),
    })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const rings = outline ? pathToRings(outline).filter((r) => r.length >= 3) : [];
  const rgb: number[] = [];
  const ys: number[] = [];
  for (let j = 0; j < info.height; j++) {
    const fy = (j + 0.5) / info.height;
    const py = (top + fy * height) / photo.height;
    for (let i = 0; i < info.width; i++) {
      const px = (left + ((i + 0.5) / info.width) * width) / photo.width;
      if (rings.length && !insideRings(px, py, rings)) continue;
      const k = (j * info.width + i) * info.channels;
      rgb.push(data[k]!, data[k + 1]!, data[k + 2]!);
      ys.push(fy);
    }
  }
  return objectPixels(rgb, ys);
}
