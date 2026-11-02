import 'server-only';

import sharp from 'sharp';
import { polygonBounds, type VisionRegion } from '@/lib/vision';
import type { PerceptionClient } from './client';
import { iou, refineDetections } from './outline';
import type { ApplianceDetection, NormBox } from './schemas';
import type { VisionEmit } from './vision-pipeline';

export { REGION_SYSTEM_PROMPT, regionQuestion } from './region-prompt';

/** Margin around a drawn shape when cropping (fraction of the shape size): context helps the model. */
export const REGION_PADDING = 0.15;
/** Min overlap between the model box and the drawn shape; below, the model looked at something else. */
export const REGION_MIN_IOU = 0.05;

export interface PhotoForRegions {
  buffer: Buffer;
  width: number;
  height: number;
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Shape bounds plus margin, clamped to the photo (image fractions). */
export function paddedBounds(points: VisionRegion['points']): NormBox {
  const b = polygonBounds(points);
  const pad = Math.max(0.02, REGION_PADDING * Math.max(b.w, b.h));
  const x1 = clamp01(b.x - pad);
  const y1 = clamp01(b.y - pad);
  const x2 = clamp01(b.x + b.w + pad);
  const y2 = clamp01(b.y + b.h + pad);
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

/** Box in crop fractions → photo fractions. */
export function cropBoxToImage(box: NormBox, crop: NormBox): NormBox {
  return {
    x: crop.x + box.x * crop.w,
    y: crop.y + box.y * crop.h,
    w: box.w * crop.w,
    h: box.h * crop.h,
  };
}

/**
 * Crop around one shape (JPEG data URL), everything outside the shape dimmed in white so the model
 * looks at the outlined object. `box` = the crop in photo fractions.
 */
export async function cropRegion(
  photo: PhotoForRegions,
  region: VisionRegion
): Promise<{ dataUrl: string; box: NormBox }> {
  const crop = paddedBounds(region.points);
  const left = Math.floor(crop.x * photo.width);
  const top = Math.floor(crop.y * photo.height);
  const width = Math.max(1, Math.min(photo.width - left, Math.ceil(crop.w * photo.width)));
  const height = Math.max(1, Math.min(photo.height - top, Math.ceil(crop.h * photo.height)));
  const pts = region.points
    .map(
      ([x, y]) => `${(x * photo.width - left).toFixed(1)},${(y * photo.height - top).toFixed(1)}`
    )
    .join(' ');
  // Outside the polygon: white at 65 %, inside untouched (even-odd hole).
  const mask = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
      `<path fill="white" fill-opacity="0.65" fill-rule="evenodd" d="M0 0H${width}V${height}H0Z M${pts.replace(/ /g, ' L')}Z"/></svg>`
  );
  const jpeg = await sharp(photo.buffer, { failOn: 'none' })
    .extract({ left, top, width, height })
    .composite([{ input: mask, top: 0, left: 0 }])
    .jpeg({ quality: 85 })
    .toBuffer();
  return {
    dataUrl: `data:image/jpeg;base64,${jpeg.toString('base64')}`,
    box: {
      x: left / photo.width,
      y: top / photo.height,
      w: width / photo.width,
      h: height / photo.height,
    },
  };
}

/** Best model detection for a shape (in photo fractions), or null when none overlaps it. */
export function pickRegionDetection(
  detections: ApplianceDetection[],
  crop: NormBox,
  shape: NormBox
): ApplianceDetection | null {
  let best: { d: ApplianceDetection; score: number } | null = null;
  for (const d of detections) {
    const box = cropBoxToImage(d.box, crop);
    const score = iou(box, shape);
    if (score >= REGION_MIN_IOU && (!best || score > best.score))
      best = { d: { ...d, box }, score };
  }
  return best?.d ?? null;
}

/**
 * Drawn shapes → what the model sees in each (PV-T8). One Muse call per shape on its crop (parallel),
 * then SAM on the whole photo for the identified ones (Meta only). Emits `vision_regions` (`boxes`,
 * then `outlines`). Never throws: an unexpected error becomes `vision_error`.
 */
export async function runRegionPipeline(
  perception: Pick<PerceptionClient, 'identifyRegion' | 'segmentImage'>,
  photo: PhotoForRegions | null,
  fullImageUrl: string,
  regions: VisionRegion[],
  emit: VisionEmit,
  signal?: AbortSignal
): Promise<void> {
  try {
    const crops = await Promise.all(
      regions.map(async (r) => {
        if (!photo) return { dataUrl: fullImageUrl, box: { x: 0, y: 0, w: 1, h: 1 } };
        try {
          return await cropRegion(photo, r);
        } catch (err) {
          console.warn('[vision] region crop failed, sending the whole photo:', err);
          return { dataUrl: fullImageUrl, box: { x: 0, y: 0, w: 1, h: 1 } };
        }
      })
    );
    const found = await Promise.all(
      regions.map((r, i) => perception.identifyRegion(crops[i]!.dataUrl, r.hint, signal))
    );
    const first = found[0]!;
    const source = {
      source: first.source,
      model: first.model,
      ...(first.fallback ? { fallback: first.fallback } : {}),
    };
    const results = regions.map((r, i) => {
      const hit = pickRegionDetection(found[i]!.detections, crops[i]!.box, polygonBounds(r.points));
      return {
        regionId: r.id,
        ...(hit ? { detection: { ...hit, id: r.id, manual: true as const } } : {}),
      };
    });
    emit('vision_regions', { phase: 'boxes', results, ...source });

    const identified = results.flatMap((r) => (r.detection ? [r.detection] : []));
    if (source.source !== 'meta' || identified.length === 0) return;
    const refined = await refineDetections(perception, fullImageUrl, identified);
    const byId = new Map(refined.detections.map((d) => [d.id, d]));
    emit('vision_regions', {
      phase: 'outlines',
      results: results.map((r) => ({
        regionId: r.regionId,
        ...(byId.has(r.regionId) ? { detection: byId.get(r.regionId) } : {}),
      })),
      ...source,
    });
  } catch (err) {
    console.warn('[vision] region pipeline failed:', err instanceof Error ? err.message : err);
    emit('vision_error', { code: 'VISION_FAILED', message: 'Object identification failed' });
  }
}
