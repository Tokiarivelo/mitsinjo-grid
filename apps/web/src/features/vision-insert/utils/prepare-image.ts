/** Longest side sent to `/api/vision` (Muse reads boxes on a 0–1000 grid; more pixels add cost, not precision). */
export const VISION_MAX_SIDE = 1280;

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
 * Attached image (data URL) → JPEG Blob ≤ VISION_MAX_SIDE px for upload.
 * Falls back to the original bytes when the browser cannot draw it (old browser, tests).
 */
export async function prepareVisionImage(dataUrl: string): Promise<Blob> {
  try {
    const img = new Image();
    img.src = dataUrl;
    await img.decode();
    const { width, height } = fitWithin(img.naturalWidth, img.naturalHeight);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return dataUrlToBlob(dataUrl);
    ctx.drawImage(img, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.85)
    );
    return blob ?? dataUrlToBlob(dataUrl);
  } catch {
    return dataUrlToBlob(dataUrl);
  }
}
