import 'server-only';

import type { KitArchetype } from '@/lib/object-kit';
import type { PartMask } from '@/lib/object-shape';
import type { NormBox } from '@/lib/vision';
import type { PerceptionClient } from './client';
import { samBoxToNorm } from './outline';

/** SAM concepts segmented per archetype on the object crop (PR-2.5). */
export const PART_CONCEPTS: Record<KitArchetype, ReadonlyArray<string>> = {
  vehicle: ['wheel', 'window'],
  house: ['window', 'door', 'chimney'],
  lamp_post: ['lamp'],
  cabinet: [],
  screen: [],
  fan: [],
  machine: [],
  pole: [],
  tank: [],
  panel: [],
  building: [],
  tree: [],
  bush: [],
  person: [],
  animal: [],
  water: [],
  other: [],
};

/** The whole batch (all concepts in parallel) resolves inside this, stragglers dropped. */
export const PART_MASKS_TIMEOUT_MS = 5000;

/** Most instances kept per concept, highest confidence first. */
export const PART_MASKS_PER_CONCEPT = 8;

/**
 * Segments the archetype's part concepts on the crop, in parallel (PR-2.5). Best effort:
 * a failed concept contributes nothing, a hanging one is dropped at the shared deadline, and
 * only real SAM answers count (the mock's boxes belong to another image). Never throws.
 */
export async function fetchPartMasks(
  segmentImage: PerceptionClient['segmentImage'],
  cropUrl: string,
  archetype: KitArchetype,
  {
    timeoutMs = PART_MASKS_TIMEOUT_MS,
    concepts = PART_CONCEPTS[archetype] ?? [],
  }: {
    timeoutMs?: number;
    /** Concepts to segment instead of the archetype's (the facade asks windows and doors only). */
    concepts?: ReadonlyArray<string>;
  } = {}
): Promise<PartMask[]> {
  if (concepts.length === 0) return [];
  const deadline = Date.now() + timeoutMs;
  const controller = new AbortController();
  const abortTimer = setTimeout(() => controller.abort(), timeoutMs);
  // Per-concept miss cause, for the one warn when every concept misses (else the caller logs
  // the hits and the misses stay invisible — the green Mini lost its wheels silently).
  const missed = new Map<string, string>();
  try {
    const perConcept = await Promise.all(
      concepts.map(async (concept): Promise<PartMask[]> => {
        const remaining = Math.max(0, deadline - Date.now());
        type Settled =
          | { status: 'answer'; seg: Awaited<ReturnType<typeof segmentImage>> }
          | { status: 'error' }
          | { status: 'late' };
        const call: Promise<Settled> = segmentImage(cropUrl, concept, controller.signal).then(
          (seg) => ({ status: 'answer', seg }) as const,
          () => ({ status: 'error' }) as const
        );
        const late: Promise<Settled> = new Promise((resolve) =>
          setTimeout(() => resolve({ status: 'late' }), remaining)
        );
        const settled = await Promise.race([call, late]);
        if (settled.status !== 'answer') {
          missed.set(concept, settled.status === 'late' ? 'timed out' : 'call failed');
          return [];
        }
        const { seg } = settled;
        if (seg.source !== 'meta' || seg.fallback) {
          missed.set(concept, 'mock answer ignored');
          return [];
        }
        if (seg.instances.length === 0) {
          missed.set(concept, 'SAM found nothing');
          return [];
        }
        const masks = seg.instances
          .map((inst) => ({
            inst,
            box: samBoxToNorm(inst.box, seg.imageWidth, seg.imageHeight),
          }))
          .filter(
            (m): m is { inst: (typeof seg.instances)[number]; box: NormBox } => m.box !== null
          )
          .sort((a, b) => (b.inst.confidence ?? 0) - (a.inst.confidence ?? 0))
          .slice(0, PART_MASKS_PER_CONCEPT)
          .map(({ inst, box }) => ({
            concept,
            box,
            ...(inst.outline ? { outline: inst.outline } : {}),
          }));
        if (masks.length === 0) missed.set(concept, 'no usable boxes');
        return masks;
      })
    );
    const masks = perConcept.flat();
    if (masks.length === 0 && missed.size > 0) {
      console.warn(
        `[vision] 3D part masks missed for "${archetype}": ${[...missed].map(([c, why]) => `${c} ${why}`).join(', ')}`
      );
    }
    return masks;
  } finally {
    clearTimeout(abortTimer);
  }
}
