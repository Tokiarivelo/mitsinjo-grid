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
  { timeoutMs = PART_MASKS_TIMEOUT_MS }: { timeoutMs?: number } = {}
): Promise<PartMask[]> {
  const concepts = PART_CONCEPTS[archetype] ?? [];
  if (concepts.length === 0) return [];
  const deadline = Date.now() + timeoutMs;
  const controller = new AbortController();
  const abortTimer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const perConcept = await Promise.all(
      concepts.map(async (concept): Promise<PartMask[]> => {
        const remaining = Math.max(0, deadline - Date.now());
        const call = (async () => {
          try {
            return await segmentImage(cropUrl, concept, controller.signal);
          } catch {
            return null;
          }
        })();
        const late = new Promise<null>((resolve) => setTimeout(() => resolve(null), remaining));
        const seg = await Promise.race([call, late]);
        if (!seg || seg.source !== 'meta' || seg.fallback) return [];
        return seg.instances
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
      })
    );
    return perConcept.flat();
  } finally {
    clearTimeout(abortTimer);
  }
}
