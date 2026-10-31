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

let canvasCheck: boolean | null = null;

/**
 * True when pixels drawn on a canvas read back unchanged. Firefox with fingerprinting protection
 * (`privacy.resistFingerprinting`, strict mode) returns a blank image instead: resizing would send
 * an empty photo and the model would find nothing.
 */
export function canvasReadable(): boolean {
  if (canvasCheck !== null) return canvasCheck;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 2;
    canvas.height = 1;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return (canvasCheck = false);
    ctx.fillStyle = 'rgb(255,0,0)';
    ctx.fillRect(0, 0, 1, 1);
    ctx.fillStyle = 'rgb(0,0,255)';
    ctx.fillRect(1, 0, 1, 1);
    const [r1, g1, b1, , r2, g2, b2] = ctx.getImageData(0, 0, 2, 1).data;
    canvasCheck = r1 === 255 && g1 === 0 && b1 === 0 && r2 === 0 && g2 === 0 && b2 === 255;
  } catch {
    canvasCheck = false;
  }
  return canvasCheck;
}

/** Test hook: forget the cached canvas check. */
export function resetCanvasCheck() {
  canvasCheck = null;
}

/**
 * Attached image (data URL) → Blob for upload, longest side ≤ VISION_MAX_SIDE when the browser can resize.
 * The original bytes are sent when the photo already fits, or the canvas cannot be read back (privacy
 * protection), or drawing fails (old browser, tests).
 */
export async function prepareVisionImage(dataUrl: string): Promise<Blob> {
  try {
    const img = new Image();
    img.src = dataUrl;
    await img.decode();
    const original = await dataUrlToBlob(dataUrl);
    const fits = Math.max(img.naturalWidth, img.naturalHeight) <= VISION_MAX_SIDE;
    if ((fits && SENDABLE.test(original.type)) || !canvasReadable()) return original;

    const { width, height } = fitWithin(img.naturalWidth, img.naturalHeight);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return original;
    ctx.drawImage(img, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.85)
    );
    return blob ?? original;
  } catch {
    return dataUrlToBlob(dataUrl);
  }
}
