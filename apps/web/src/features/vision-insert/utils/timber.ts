import type { ObjectRecipe, RecipePart } from '@/lib/object-shape';
import { frameColor } from './openings';

/**
 * Exposed timber frame (PV-G): a wall's `timber` posts and rails drawn as beams proud of its front
 * face, cut around the windows and doors on that face. Viewer-only, like the opening expansion;
 * colour = the frame colour that stands out from the wall. Pure: recipe units in and out.
 */

/** Beam width, share of the wall height. */
export const BEAM_SHARE = 0.035;
/** Beam projection from the wall face, share of its width. */
const BEAM_PROUD = 0.5;
/** Pieces shorter than this many beam widths are dropped (slivers between openings). */
const MIN_PIECE = 1.5;

type Span = [number, number];

/** `span` minus every interval of `cuts`, in order. */
export function subtractSpans(span: Span, cuts: ReadonlyArray<Span>): Span[] {
  let out: Span[] = [span];
  for (const [c0, c1] of cuts)
    out = out.flatMap(([a, b]) => {
      if (c1 <= a || c0 >= b) return [[a, b] as Span];
      const keep: Span[] = [];
      if (c0 > a) keep.push([a, c0]);
      if (c1 < b) keep.push([c1, b]);
      return keep;
    });
  return out;
}

/** Beam parts for every wall with a timber frame (empty when none). */
export function timberBeams(recipe: ObjectRecipe): RecipePart[] {
  const dims = [recipe.proportions.w, recipe.proportions.h, recipe.proportions.d];
  return recipe.parts.flatMap((wall) => {
    if (!wall.timber || wall.shape !== 'box') return [];
    const [cx, cy, cz] = wall.at.map((v, i) => v * dims[i]!) as [number, number, number];
    const [W, H, D] = wall.size.map((v, i) => v * dims[i]!) as [number, number, number];
    const face = cz + D / 2;
    const bw = BEAM_SHARE * H;
    const bd = BEAM_PROUD * bw;
    const [x0, y0] = [cx - W / 2, cy - H / 2];
    // Openings on this face (world rects), the beams stop at them.
    const holes = recipe.parts
      .filter((p) => (p.kind === 'window' || p.kind === 'door') && p.shape === 'box')
      .map((p) => ({ c: p.at.map((v, i) => v * dims[i]!), s: p.size.map((v, i) => v * dims[i]!) }))
      .filter((o) => o.s[2]! < o.s[0]! && Math.abs(o.c[2]! - o.s[2]! / 2 - face) <= o.s[2]! + 1e-6)
      .map((o) => ({
        x: [o.c[0]! - o.s[0]! / 2, o.c[0]! + o.s[0]! / 2] as Span,
        y: [o.c[1]! - o.s[1]! / 2, o.c[1]! + o.s[1]! / 2] as Span,
      }));
    const color = frameColor(wall.color);
    const beam = (x: number, y: number, w: number, h: number): RecipePart => ({
      shape: 'box',
      at: [x / dims[0]!, y / dims[1]!, (face + bd / 2) / dims[2]!],
      size: [w / dims[0]!, h / dims[1]!, bd / dims[2]!],
      color,
      material: 'wood',
      kind: 'frame',
      ...(wall.status ? { status: wall.status } : {}),
    });
    const out: RecipePart[] = [];
    for (const share of wall.timber.posts) {
      const x = Math.min(x0 + W - bw / 2, Math.max(x0 + bw / 2, x0 + share * W));
      const cuts = holes.filter((h) => h.x[0] < x + bw / 2 && h.x[1] > x - bw / 2).map((h) => h.y);
      for (const [a, b] of subtractSpans([y0, y0 + H], cuts))
        if (b - a >= MIN_PIECE * bw) out.push(beam(x, (a + b) / 2, bw, b - a));
    }
    for (const share of wall.timber.rails) {
      const y = Math.min(y0 + H - bw / 2, Math.max(y0 + bw / 2, y0 + share * H));
      const cuts = holes.filter((h) => h.y[0] < y + bw / 2 && h.y[1] > y - bw / 2).map((h) => h.x);
      for (const [a, b] of subtractSpans([x0, x0 + W], cuts))
        if (b - a >= MIN_PIECE * bw) out.push(beam((a + b) / 2, y, b - a, bw));
    }
    return out;
  });
}
