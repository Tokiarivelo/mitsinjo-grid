import type { PerceptionClient } from './client';
import { refineDetections } from './outline';

export type VisionEmit = (
  event: 'vision_detections' | 'vision_error',
  data: Record<string, unknown>
) => void;

/**
 * Photo → appliances (PV-T6). Emits `vision_detections` twice: `phase: 'boxes'` as soon as Muse
 * answers, then `phase: 'outlines'` once SAM refined them (Meta only; the mock fixture is final).
 * Never throws: an unexpected error becomes `vision_error`.
 */
export async function runVisionPipeline(
  perception: Pick<PerceptionClient, 'detectAppliances' | 'segmentImage'>,
  imageUrl: string,
  emit: VisionEmit,
  signal?: AbortSignal
): Promise<void> {
  try {
    const found = await perception.detectAppliances(imageUrl, signal);
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
