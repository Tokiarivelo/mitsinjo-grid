/**
 * Attached image (data URL) → Blob for `/api/vision`, bytes unchanged. The server rotates (EXIF) and
 * resizes it: a browser canvas can come back blank (Firefox fingerprinting protection) or keep a phone
 * photo sideways, which misplaced the boxes.
 */
export async function prepareVisionImage(dataUrl: string): Promise<Blob> {
  return (await fetch(dataUrl)).blob();
}
