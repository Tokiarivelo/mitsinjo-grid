/** Longest side sent to `/api/vision` (Muse reads boxes on a 0–1000 grid; more pixels add cost, not precision). */
export const VISION_MAX_SIDE = 1280;

/** Types `/api/vision` accepts as is. */
const SENDABLE = /^image\/(jpeg|png|webp)$/;

/** Size that fits `max` on the longest side, keeping the ratio; never upscales. */
export function fitWithin(width: number, height: number, max = VISION_MAX_SIDE) {
  const scale = Math.min(1, max / Math.max(width, height, 1));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  return (await fetch(dataUrl)).blob();
}

/**
 * True when every sampled pixel has the same colour: what Firefox fingerprinting protection
 * (`privacy.resistFingerprinting`, strict mode) gives back from a canvas instead of the drawn photo.
 * A real photo is never one flat colour.
 */
export function looksBlank(data: ArrayLike<number>, samples = 4096): boolean {
  const pixels = Math.floor(data.length / 4);
  if (pixels === 0) return true;
  const step = Math.max(1, Math.floor(pixels / samples));
  const [r, g, b] = [data[0], data[1], data[2]];
  for (let p = step; p < pixels; p += step) {
    const i = p * 4;
    if (data[i] !== r || data[i + 1] !== g || data[i + 2] !== b) return false;
  }
  return true;
}

/**
 * Attached image (data URL) → Blob for upload, longest side ≤ VISION_MAX_SIDE when the browser can resize.
 * The original bytes are sent when the photo already fits, when the resized image reads back blank
 * (privacy protection), or when drawing fails (old browser, tests).
 */
export async function prepareVisionImage(dataUrl: string): Promise<Blob> {
  try {
    const img = new Image();
    img.src = dataUrl;
    await img.decode();
    const original = await dataUrlToBlob(dataUrl);
    const fits = Math.max(img.naturalWidth, img.naturalHeight) <= VISION_MAX_SIDE;
    if (fits && SENDABLE.test(original.type)) return original;

    const { width, height } = fitWithin(img.naturalWidth, img.naturalHeight);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return original;
    ctx.drawImage(img, 0, 0, width, height);
    // Privacy protection blanks the read-back: send the photo as picked rather than an empty image.
    if (looksBlank(ctx.getImageData(0, 0, width, height).data)) return original;
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.85)
    );
    return blob ?? original;
  } catch {
    return dataUrlToBlob(dataUrl);
  }
}
