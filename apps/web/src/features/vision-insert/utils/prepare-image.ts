/**
 * Largest photo sent as picked. Vercel rejects request bodies over 4.5 MB (`FUNCTION_PAYLOAD_TOO_LARGE`);
 * this leaves room for the multipart envelope and the other form fields.
 */
export const VISION_UPLOAD_MAX_BYTES = 3.5 * 1024 * 1024;

/** Longest side of a shrunk photo: well above the server's 1280 px, so no detail is lost. */
export const VISION_UPLOAD_MAX_SIDE = 2560;

/**
 * Attached image (data URL) → Blob for `/api/vision`. Bytes unchanged when small enough: the server rotates
 * (EXIF) and resizes, because a browser canvas can come back blank (Firefox fingerprinting protection).
 * A photo over VISION_UPLOAD_MAX_BYTES would be refused by the host, so only that one is shrunk here
 * (orientation applied by `createImageBitmap`). If the browser cannot shrink it, the original is sent.
 */
export async function prepareVisionImage(dataUrl: string): Promise<Blob> {
  const original = await (await fetch(dataUrl)).blob();
  if (original.size <= VISION_UPLOAD_MAX_BYTES) return original;
  return (await shrinkImage(original)) ?? original;
}

async function shrinkImage(blob: Blob): Promise<Blob | null> {
  try {
    const bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' });
    const scale = Math.min(1, VISION_UPLOAD_MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    for (const quality of [0.9, 0.8, 0.7]) {
      const out = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/jpeg', quality)
      );
      if (out && out.size <= VISION_UPLOAD_MAX_BYTES) return out;
    }
    return null;
  } catch {
    return null;
  }
}
