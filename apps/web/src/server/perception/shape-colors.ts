import 'server-only';

import sharp from 'sharp';
import { pathToRings } from '@/lib/vision';
import { insideRings, objectPixels, type ObjectPixels } from './color-measure';
import type { PhotoForRegions } from './region';
import type { GrayGrid } from './repetition';
import type { NormBox } from './schemas';

/** Long side of the sampled box (px): enough for colour groups, ~10 k pixels at most. */
export const COLOR_SAMPLE_PX = 96;

/** Box of the object in photo pixels, clamped inside the photo. */
function pixelBox(photo: PhotoForRegions, box: NormBox) {
  const left = Math.max(0, Math.min(photo.width - 1, Math.floor(box.x * photo.width)));
  const top = Math.max(0, Math.min(photo.height - 1, Math.floor(box.y * photo.height)));
  const width = Math.max(1, Math.min(photo.width - left, Math.round(box.w * photo.width)));
  const height = Math.max(1, Math.min(photo.height - top, Math.round(box.h * photo.height)));
  return { left, top, width, height };
}

/** Columns of the grey grid for the repetition measure (PF-T4). */
export const GRAY_COLUMNS = 128;
/** Columns for the perspective measure (PF-T5): line segments need more pixels. */
export const EDGE_COLUMNS = 256;

/**
 * Grey levels of the box: `columns` wide (128 for repetition, PF-T4; 256 for perspective, PF-T5), rows
 * keeping the box aspect (¼–2 × columns), and the SAM outline as a mask (all pixels without an outline).
 */
export async function sampleObjectGray(
  photo: PhotoForRegions,
  box: NormBox,
  outline?: string,
  columns = GRAY_COLUMNS
): Promise<GrayGrid> {
  const px = pixelBox(photo, box);
  const width = columns;
  const height = Math.max(
    columns / 4,
    Math.min(2 * columns, Math.round((width * px.height) / px.width))
  );
  const { data } = await sharp(photo.buffer, { failOn: 'none' })
    .extract(px)
    .resize({ width, height, fit: 'fill' })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const rings = outline ? pathToRings(outline).filter((r) => r.length >= 3) : [];
  const channels = data.length / (width * height);
  const gray = new Float32Array(width * height);
  const mask = new Uint8Array(width * height);
  for (let j = 0; j < height; j++) {
    const py = box.y + ((j + 0.5) / height) * box.h;
    for (let i = 0; i < width; i++) {
      const k = j * width + i;
      gray[k] = data[k * channels]! / 255;
      mask[k] =
        !rings.length || insideRings(box.x + ((i + 0.5) / width) * box.w, py, rings) ? 1 : 0;
    }
  }
  return { width, height, gray, mask };
}

/**
 * Pixels of the object for the colour measure (PF-T2): the box, downscaled, kept only inside the SAM
 * outline when there is one (no sky, no road). Without an outline every box pixel counts.
 */
export async function sampleObjectPixels(
  photo: PhotoForRegions,
  box: NormBox,
  outline?: string
): Promise<ObjectPixels> {
  const { left, top, width, height } = pixelBox(photo, box);
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
