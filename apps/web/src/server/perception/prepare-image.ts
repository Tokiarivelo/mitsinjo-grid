import 'server-only';

import sharp from 'sharp';

/** Longest side sent to Muse / SAM (Muse reads boxes on a 0–1000 grid; more pixels add cost, not precision). */
export const VISION_MAX_SIDE = 1280;

export interface PreparedVisionImage {
  buffer: Buffer;
  contentType: string;
  /** False when the bytes could not be decoded and are passed on as received. */
  normalized: boolean;
}

/**
 * Same picture for every browser: EXIF orientation applied (phone photos are stored sideways and only
 * displayed upright), longest side ≤ VISION_MAX_SIDE, transparency on white, JPEG q85. Done on the
 * server because some browsers (Firefox fingerprinting protection) blank canvas read-back.
 * Undecodable bytes → passed on unchanged. Never throws.
 */
export async function prepareVisionImage(
  bytes: Buffer,
  contentType: string
): Promise<PreparedVisionImage> {
  try {
    const buffer = await sharp(bytes, { failOn: 'none' })
      .rotate()
      .resize({
        width: VISION_MAX_SIDE,
        height: VISION_MAX_SIDE,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .flatten({ background: { r: 255, g: 255, b: 255 } })
      .jpeg({ quality: 85 })
      .toBuffer();
    return { buffer, contentType: 'image/jpeg', normalized: true };
  } catch (err) {
    console.warn('[vision] photo not normalized, sending as received:', err);
    return { buffer: bytes, contentType, normalized: false };
  }
}
