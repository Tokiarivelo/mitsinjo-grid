import 'server-only';

import sharp from 'sharp';
import type { PhotoForRegions } from './region';
import type { NormBox } from './schemas';

/** Context around the object: the crop is a square this many times the object's long side. */
export const SHAPE_CROP_CONTEXT = 1.6;
/** A small object (a lamp post is ~20 px wide) is upscaled so Spark sees its parts. */
export const SHAPE_CROP_MIN_PX = 640;
/** Never send more than this (tokens). */
export const SHAPE_CROP_MAX_PX = 1024;

/**
 * Crop for the 3D recipe (PV-T9): a square around the object box with context, upscaled when small,
 * outside the box lightly dimmed in white so Spark knows which object to model. JPEG data URL.
 */
export async function cropForShape(photo: PhotoForRegions, box: NormBox): Promise<string> {
  const W = photo.width;
  const H = photo.height;
  const bw = Math.max(1, box.w * W);
  const bh = Math.max(1, box.h * H);
  const side = Math.min(Math.max(W, H), Math.ceil(Math.max(bw, bh) * SHAPE_CROP_CONTEXT));
  const width = Math.min(W, side);
  const height = Math.min(H, side);
  const cx = box.x * W + bw / 2;
  const cy = box.y * H + bh / 2;
  const left = Math.round(Math.min(W - width, Math.max(0, cx - width / 2)));
  const top = Math.round(Math.min(H - height, Math.max(0, cy - height / 2)));

  const bx = box.x * W - left;
  const by = box.y * H - top;
  const mask = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
      `<path fill="white" fill-opacity="0.4" fill-rule="evenodd" d="M0 0H${width}V${height}H0Z ` +
      `M${bx.toFixed(1)} ${by.toFixed(1)}h${bw.toFixed(1)}v${bh.toFixed(1)}h${(-bw).toFixed(1)}Z"/></svg>`
  );
  const long = Math.max(width, height);
  const target = Math.min(SHAPE_CROP_MAX_PX, Math.max(SHAPE_CROP_MIN_PX, long));
  const jpeg = await sharp(
    await sharp(photo.buffer, { failOn: 'none' })
      .extract({ left, top, width, height })
      .composite([{ input: mask, top: 0, left: 0 }])
      .png()
      .toBuffer()
  )
    .resize({
      width: Math.round((width / long) * target),
      height: Math.round((height / long) * target),
      kernel: 'lanczos3',
    })
    .jpeg({ quality: 88 })
    .toBuffer();
  return `data:image/jpeg;base64,${jpeg.toString('base64')}`;
}
