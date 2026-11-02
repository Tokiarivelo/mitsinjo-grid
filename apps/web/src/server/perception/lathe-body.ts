import 'server-only';

import type { KitArchetype } from '@/lib/object-kit';
import {
  frontPartIndex,
  LATHE_PROFILE_MAX,
  silhouetteRings,
  type ObjectRecipe,
  type RecipePart,
  type ShapeTarget,
} from '@/lib/object-shape';

/** Archetypes whose round main body follows the SAM outline width per row (PR-2.4). */
export const LATHE_BODY_ARCHETYPES: ReadonlyArray<KitArchetype> = [
  'tree',
  'lamp_post',
  'tank',
  'bush',
  'person',
];

/** Scan rows per body: measured rows + 2 poles stays under LATHE_PROFILE_MAX (32). */
export const LATHE_BODY_ROWS = 24;

/** A body needs this many measured rows; fewer means the outline barely touches the band. */
export const LATHE_BODY_MIN_ROWS = 3;

/** The band (main-part span ∩ outline, box fractions) below this height is not a body. */
export const LATHE_BODY_MIN_BAND = 0.02;

type Pt = readonly [number, number];

/**
 * u-crossings of the ring edges with the horizontal line v (box fractions, y down),
 * ascending. Half-open rule: a vertex on the line counts once.
 */
function crossingsAt(ring: ReadonlyArray<Pt>, v: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < ring.length; i++) {
    const [x0, y0] = ring[i]!;
    const [x1, y1] = ring[(i + 1) % ring.length]!;
    if ((y0 <= v && v < y1) || (y1 <= v && v < y0)) {
      out.push(x0 + ((v - y0) / (y1 - y0)) * (x1 - x0));
    }
  }
  return out.sort((a, b) => a - b);
}

/**
 * Round body of a symmetric object (PR-2.4): the SAM outline scanned row by row inside the
 * main part's vertical band becomes a `lathe` profile (half-width per row), so a conifer
 * photo yields a cone-ish crown and a round one a ball — measurement, not template. The part
 * is resized to the measured band (round: depth = width) and centred on the outline; template
 * filler fully inside it (same colour + material, e.g. the tree canopy spheres) is dropped.
 * Returns the recipe unchanged (same reference) when the archetype, outline or band
 * disqualifies it. Pure: same inputs → same recipe.
 */
export function withLatheBody(
  archetype: KitArchetype,
  recipe: ObjectRecipe,
  target: Pick<ShapeTarget, 'box' | 'outline'>
): ObjectRecipe {
  if (!LATHE_BODY_ARCHETYPES.includes(archetype)) return recipe;
  if (!target.outline) return recipe;
  const main = recipe.parts[frontPartIndex(recipe)]!;

  // Largest ring first; box fractions, y down.
  const ring = silhouetteRings({ box: target.box, outline: target.outline })[0];
  if (!ring || ring.length < 3) return recipe;
  const us = ring.map(([u]) => u);
  const vs = ring.map(([, v]) => v);
  const cx = (Math.min(...us) + Math.max(...us)) / 2;
  // Band: main part span (object y up → v down) ∩ outline span.
  const mainTop = main.at[1] + main.size[1] / 2;
  const mainBottom = main.at[1] - main.size[1] / 2;
  const vLo = Math.max(Math.min(...vs), 0.5 - mainTop);
  const vHi = Math.min(Math.max(...vs), 0.5 - mainBottom);
  if (!(vHi - vLo >= LATHE_BODY_MIN_BAND)) return recipe;

  // Scan the band; midpoints dodge exact vertex hits. Half-width = furthest extent from the
  // outline centre so one-sided bulges (canopy tiers) are covered, not averaged away.
  const rows: Array<{ y: number; half: number }> = [];
  for (let i = 0; i < LATHE_BODY_ROWS; i++) {
    const v = vLo + ((i + 0.5) / LATHE_BODY_ROWS) * (vHi - vLo);
    const xs = crossingsAt(ring, v);
    if (xs.length < 2) continue;
    const half = Math.max(Math.abs(xs[0]! - cx), Math.abs(xs[xs.length - 1]! - cx));
    if (half > 0) rows.push({ y: 0.5 - v, half });
  }
  if (rows.length < LATHE_BODY_MIN_ROWS) return recipe;

  const maxHalf = Math.max(...rows.map((r) => r.half));
  const bandH = vHi - vLo;
  const cy = 0.5 - (vLo + vHi) / 2;
  if (!(maxHalf >= 0.005) || !(bandH >= 0.01)) return recipe;
  const width = 2 * maxHalf;
  // Bottom row first: profile y must not fall. Poles close both ends (flat annuli).
  rows.sort((a, b) => a.y - b.y);
  const profile: Array<[number, number]> = [
    [0, -0.5],
    ...rows.map(
      (r) =>
        [Math.min(0.5, r.half / width), Math.min(0.5, Math.max(-0.5, (r.y - cy) / bandH))] as [
          number,
          number,
        ]
    ),
    [0, 0.5],
  ];
  if (profile.length > LATHE_PROFILE_MAX) return recipe;

  const body: RecipePart = {
    shape: 'lathe',
    at: [cx - 0.5, cy, main.at[2]],
    size: [Math.min(1, width), Math.min(1, bandH), Math.min(1, width)],
    color: main.color,
    ...(main.material ? { material: main.material } : {}),
    front: true,
    profile,
  };
  const insideBody = (p: RecipePart) =>
    Math.abs(p.at[0] - body.at[0]) <= body.size[0] / 2 &&
    Math.abs(p.at[1] - body.at[1]) <= body.size[1] / 2 &&
    Math.abs(p.at[2] - body.at[2]) <= body.size[2] / 2;
  const sameLook = (p: RecipePart) =>
    p.color.toLowerCase() === body.color.toLowerCase() &&
    (p.material ?? null) === (body.material ?? null);
  const parts = recipe.parts.filter((p) => p === main || !(sameLook(p) && insideBody(p)));
  parts[parts.indexOf(main)] = body;
  return { ...recipe, parts };
}
