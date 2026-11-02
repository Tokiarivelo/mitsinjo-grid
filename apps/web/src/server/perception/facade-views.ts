import 'server-only';

import type { KitArchetype } from '@/lib/object-kit';
import { pathToRings } from '@/lib/vision';
import type { PerceptionClient } from './client';
import {
  measureElevation,
  sideConsistent,
  sideRoofHint,
  type Elevation,
  type ElevationMasks,
} from './facade-house';
import { museImage, museImageReady } from './facade-specialist';
import { samBoxToNorm } from './outline';
import type { NormBox } from './schemas';

/**
 * The house's elevations, measured (user 2026-11-02): SAM on the validated front facade, and on
 * a side elevation Muse Image redraws from that front (same house, same style). Built step by
 * step, side after side, then assembled by `facadeHouseRecipe`. Best effort, never throws.
 */

/** Archetypes rebuilt from their elevations; others keep the photo pipeline. */
export const ELEVATION_ARCHETYPES: ReadonlyArray<KitArchetype> = ['house', 'building'];

/** One SAM call on an elevation: measured ≈ 5–10 s, run in parallel per image. */
export const ELEVATION_SAM_TIMEOUT_MS = 25_000;
/** Muse Image side elevation: measured ≈ 35 s. */
export const SIDE_VIEW_TIMEOUT_MS = 60_000;
/** SAM answers below this confidence are dropped (windows drawn faint, hatching). */
const MIN_CONFIDENCE = 0.5;
const MAX_PER_CONCEPT = 12;

/** Prompt for the side elevation, the front facade sent as the reference image. */
export const SIDE_VIEW_PROMPT =
  'This image is the front elevation of a building. Draw the RIGHT SIDE elevation of the very same building, as an architect would on the next sheet: same drawing style, same scale, same storeys and eave height, same chimneys, and the windows a house of this size has on its side wall (at least one per storey). The side wall is as deep as such a house really is, usually a bit more than half its front width. Straight-on orthographic view at eye level, the whole building centred on a plain white background, no perspective, no text, no dimension lines.';

/** Roof line added to the side prompt from the front's measured roof (`sideRoofHint`). */
export const SIDE_ROOF_HINTS = {
  slope:
    'The roof ridge runs from the front to the back: seen from the side, the roof is its long sloping plane (a band above the wall), NOT a triangle. Do not redraw the front.',
  end: 'The roof ridge runs parallel to the front: seen from the side, the roof shows its end (a triangle for a hipped or gable end).',
} as const;

/** Side prompt for this front: the base prompt plus what its roof must look like from the side. */
export function sideViewPrompt(front: Elevation | null): string {
  const hint = front ? sideRoofHint(front) : null;
  return hint ? `${SIDE_VIEW_PROMPT} ${SIDE_ROOF_HINTS[hint]}` : SIDE_VIEW_PROMPT;
}

type Segment = PerceptionClient['segmentImage'];

interface Found {
  boxes: NormBox[];
  outlines: (string | undefined)[];
  width: number;
  height: number;
}

/** One concept on one image: real SAM boxes by confidence, or none. */
async function find(
  segment: Segment,
  url: string,
  concept: string,
  signal: AbortSignal
): Promise<Found | null> {
  try {
    const seg = await segment(url, concept, signal);
    if (seg.source !== 'meta' || seg.fallback) return null;
    const hits = seg.instances
      .filter((i) => (i.confidence ?? 1) >= MIN_CONFIDENCE)
      .sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))
      .slice(0, MAX_PER_CONCEPT)
      .map((i) => ({
        box: samBoxToNorm(i.box, seg.imageWidth, seg.imageHeight),
        outline: i.outline,
      }))
      .filter((h): h is { box: NormBox; outline: string | undefined } => h.box !== null);
    return {
      boxes: hits.map((h) => h.box),
      outlines: hits.map((h) => h.outline),
      width: seg.imageWidth,
      height: seg.imageHeight,
    };
  } catch {
    return null;
  }
}

const largest = (f: Found | null | undefined) => {
  if (!f?.boxes.length) return null;
  let k = 0;
  f.boxes.forEach((b, i) => {
    if (b.w * b.h > f.boxes[k]!.w * f.boxes[k]!.h) k = i;
  });
  return { box: f.boxes[k]!, outline: f.outlines[k] };
};

/** SAM on one elevation image → its measurement, or null (nothing usable). */
export async function measureElevationImage(
  segment: Segment,
  url: string,
  objectConcept: string,
  { timeoutMs = ELEVATION_SAM_TIMEOUT_MS, withDoors = true } = {}
): Promise<{ elevation: Elevation; masks: ElevationMasks } | null> {
  const signal = AbortSignal.timeout(timeoutMs);
  const concepts = [
    objectConcept,
    'roof',
    'wall',
    'window',
    'chimney',
    ...(withDoors ? ['door'] : []),
  ];
  const [house, roof, wall, windows, chimneys, doors] = await Promise.all(
    concepts.map((c) => find(segment, url, c, signal))
  );
  const sized = [house, roof, wall, windows, chimneys, doors].find((f) => f && f.width > 0);
  if (!sized) return null;
  const r = largest(roof);
  const masks: ElevationMasks = {
    aspect: sized.width / sized.height,
    ...(largest(house) ? { house: largest(house)!.box } : {}),
    ...(r
      ? {
          roof: {
            box: r.box,
            ...(r.outline
              ? { rings: pathToRings(r.outline).filter((ring) => ring.length >= 3) }
              : {}),
          },
        }
      : {}),
    ...(largest(wall) ? { wall: largest(wall)!.box } : {}),
    windows: windows?.boxes ?? [],
    doors: doors?.boxes ?? [],
    chimneys: chimneys?.boxes ?? [],
  };
  const elevation = measureElevation(masks);
  return elevation ? { elevation, masks } : null;
}

/** Side elevation PNG redrawn by Muse Image from the front facade, or null (mock, error). */
export async function imagineSideView(
  frontUrl: string,
  prompt: string,
  signal?: AbortSignal
): Promise<Buffer | null> {
  if (!museImageReady()) return null;
  try {
    const timeout = AbortSignal.timeout(SIDE_VIEW_TIMEOUT_MS);
    return await museImage(
      prompt,
      [frontUrl],
      signal ? AbortSignal.any([signal, timeout]) : timeout
    );
  } catch (err) {
    console.warn('[vision] 3D side view failed:', err instanceof Error ? err.message : err);
    return null;
  }
}

export interface FacadeElevations {
  front: Elevation;
  side: Elevation | null;
}

/** Side drawings tried before giving up on the side (Muse Image may redraw the front). */
export const SIDE_VIEW_ATTEMPTS = 2;

/**
 * Step by step: the front is measured first, its roof tells Muse Image what the side must show,
 * the side drawn is measured and kept only when consistent with the front (`sideConsistent`),
 * else drawn once more, else dropped (Spark's depth then). Null when the front gives nothing
 * usable (the photo pipeline then runs as before).
 */
export async function measureFacadeElevations(
  segment: Segment,
  frontUrl: string,
  archetype: KitArchetype,
  {
    signal,
    withSide = true,
    onSideView,
  }: { signal?: AbortSignal; withSide?: boolean; onSideView?: (png: Buffer) => void } = {}
): Promise<FacadeElevations | null> {
  if (!ELEVATION_ARCHETYPES.includes(archetype)) return null;
  const concept = archetype === 'building' ? 'building' : 'house';
  const front = (await measureElevationImage(segment, frontUrl, concept))?.elevation;
  if (!front) return null;
  if (!withSide) return { front, side: null };
  const prompt = sideViewPrompt(front);
  for (let attempt = 1; attempt <= SIDE_VIEW_ATTEMPTS; attempt++) {
    if (signal?.aborted) break;
    const png = await imagineSideView(frontUrl, prompt, signal);
    if (!png) break;
    onSideView?.(png);
    const side = (
      await measureElevationImage(
        segment,
        `data:image/png;base64,${png.toString('base64')}`,
        concept,
        {
          withDoors: false,
        }
      )
    )?.elevation;
    if (side && sideConsistent(front, side)) return { front, side };
    console.info(
      `[vision] 3D side view ${attempt}/${SIDE_VIEW_ATTEMPTS} ${side ? 'inconsistent with the front' : 'unreadable'}${attempt < SIDE_VIEW_ATTEMPTS ? ', drawing it again' : ', dropped'}`
    );
  }
  return { front, side: null };
}
