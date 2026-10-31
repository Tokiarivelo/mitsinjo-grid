import type { VisionImage } from '@/server/storage/media';
import type { PerceptionClient } from './client';
import { refineDetections } from './outline';

export type VisionEmit = (
  event: 'vision_detections' | 'vision_error',
  data: Record<string, unknown>
) => void;

/**
 * Photo → appliances (PV-T6). Emits `vision_detections` twice: `phase: 'boxes'` as soon as Muse
 * answers, then `phase: 'outlines'` once SAM refined them (Meta only; the mock fixture is final).
 * Hosted link first; on a Meta failure the inline photo is tried once. Never throws: an unexpected
 * error becomes `vision_error`.
 */
export async function runVisionPipeline(
  perception: Pick<PerceptionClient, 'detectAppliances' | 'segmentImage'>,
  image: string | VisionImage,
  emit: VisionEmit,
  signal?: AbortSignal
): Promise<void> {
  const { url, inlineUrl } =
    typeof image === 'string' ? { url: image, inlineUrl: undefined } : image;
  try {
    let imageUrl = url;
    let found = await perception.detectAppliances(imageUrl, signal);
    // Meta could not use the hosted link (e.g. media_url_origin_error): resend the photo inline once.
    if (found.fallback === 'provider_error' && inlineUrl && !signal?.aborted) {
      console.warn('[vision] hosted photo failed on Meta, retrying with base64');
      imageUrl = inlineUrl;
      found = await perception.detectAppliances(imageUrl, signal);
    }
    const source = {
      source: found.source,
      model: found.model,
      ...(found.fallback ? { fallback: found.fallback } : {}),
    };
    emit('vision_detections', { phase: 'boxes', detections: found.detections, ...source });

    if (found.source !== 'meta' || found.detections.length === 0) return;
    const refined = await refineDetections(perception, imageUrl, found.detections);
    emit('vision_detections', {
      phase: 'outlines',
      detections: refined.detections,
      refined: refined.refined,
      ...source,
    });
  } catch (err) {
    console.warn('[vision] pipeline failed:', err instanceof Error ? err.message : err);
    emit('vision_error', { code: 'VISION_FAILED', message: 'Appliance detection failed' });
  }
}
