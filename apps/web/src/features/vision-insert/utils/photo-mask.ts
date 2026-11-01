import * as THREE from 'three';

/** Long side of the mask canvas (px): outline detail, small upload. */
export const PHOTO_MASK_PX = 512;
/** Mask values: inside the object outline = shown, outside = cut (alphaMap reads luminance). */
const INSIDE = 'white';
const OUTSIDE = 'black';

/**
 * Alpha mask of the whole photo (PF-T1): white inside the object's SAM outline, black elsewhere, so the
 * projected photo shows the object only (no sky or road painted on the model). Same UVs as the photo.
 * `rings` are in photo fractions (`photoMaskRings`). Null when there is no 2D canvas (tests, old browsers).
 */
export function photoMaskTexture(
  rings: ReadonlyArray<ReadonlyArray<readonly [number, number]>>,
  photoAspect: number
): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const aspect = photoAspect > 0 && Number.isFinite(photoAspect) ? photoAspect : 1;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(aspect >= 1 ? PHOTO_MASK_PX : PHOTO_MASK_PX * aspect);
  canvas.height = Math.round(aspect >= 1 ? PHOTO_MASK_PX / aspect : PHOTO_MASK_PX);
  let ctx: CanvasRenderingContext2D | null = null;
  try {
    ctx = canvas.getContext('2d');
  } catch {
    ctx = null;
  }
  if (!ctx) return null;
  ctx.fillStyle = OUTSIDE;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = INSIDE;
  for (const ring of rings) {
    if (ring.length < 3) continue;
    ctx.beginPath();
    ring.forEach(([u, v], i) =>
      i === 0
        ? ctx.moveTo(u * canvas.width, v * canvas.height)
        : ctx.lineTo(u * canvas.width, v * canvas.height)
    );
    ctx.closePath();
    ctx.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}
