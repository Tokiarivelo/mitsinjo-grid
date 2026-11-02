import type { ObjectRecipe, RecipePart } from '@/lib/object-shape';

/**
 * Readable openings (PG-T8): each window or door part (`kind`) is drawn in the 3D view as a frame
 * proud of the wall, the glass (or door leaf) set back inside it, glazing bars from its pane `grid`
 * and, for a window, a sill. The recipe keeps one part per opening (12-part budget); this expansion
 * only feeds the mesh. Frame colour: light or dark timber, whichever stands out from the wall.
 * Pure: recipe units in, recipe parts out.
 */

/** Frame width, share of the opening's shorter side. */
export const FRAME_SHARE = 0.12;
/** Glazing bar width, share of the frame width. */
const BAR_SHARE = 0.45;
/** Default panes of a window without a measured grid: a cross reads as a window from afar. */
export const DEFAULT_WINDOW_GRID: readonly [number, number] = [2, 2];
/** Light and dark timber frames (data colours of the model, not UI tokens). */
export const FRAME_LIGHT = '#efe9df';
export const FRAME_DARK = '#3f2e20';

/** Relative luminance of `#rrggbb`, 0–1. */
export function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const lin = (v: number) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
}

/** The frame colour that stands out from a wall: dark timber on light walls, light on dark. */
export function frameColor(wallHex: string): string {
  return luminance(wallHex) > 0.3 ? FRAME_DARK : FRAME_LIGHT;
}

const isOpening = (p: RecipePart) =>
  p.shape === 'box' && (p.kind === 'window' || p.kind === 'door');

/** Recipe parts with every window / door expanded into frame, glass or leaf, bars and sill. */
export function expandOpenings(recipe: ObjectRecipe): RecipePart[] {
  if (!recipe.parts.some(isOpening)) return recipe.parts;
  const dims = [recipe.proportions.w, recipe.proportions.h, recipe.proportions.d];
  const wall = recipe.parts.find((p) => p.kind === 'wall') ?? recipe.parts.find((p) => p.front);
  const trim = frameColor(wall?.color ?? FRAME_LIGHT);
  return recipe.parts.flatMap((p) => (isOpening(p) ? opening(p, dims, trim) : [p]));
}

function opening(p: RecipePart, dims: number[], trim: string): RecipePart[] {
  const world = p.size.map((s, i) => s * dims[i]!);
  // Thin axis = the wall normal; the other horizontal axis runs along the wall.
  const n = world[0]! < world[2]! ? 0 : 2;
  const b = n === 0 ? 2 : 0;
  const out = Math.sign(p.at[n]!) || 1;
  const [W, H, T] = [world[b]!, world[1]!, world[n]!];
  const f = FRAME_SHARE * Math.min(W, H);
  /** A box offset from the opening centre: du along the wall, dv up, dn out of the wall (world). */
  const piece = (
    du: number,
    dv: number,
    dn: number,
    sw: number,
    sh: number,
    sn: number,
    look: Pick<RecipePart, 'color' | 'material' | 'kind'>
  ): RecipePart => {
    const at = [...p.at] as RecipePart['at'];
    const size = [...p.size] as RecipePart['size'];
    at[b] = p.at[b]! + du / dims[b]!;
    at[1] = p.at[1]! + dv / dims[1]!;
    at[n] = p.at[n]! + (dn * out) / dims[n]!;
    size[b] = sw / dims[b]!;
    size[1] = sh / dims[1]!;
    size[n] = sn / dims[n]!;
    return {
      shape: 'box',
      at,
      size,
      ...look,
      ...(p.status ? { status: p.status } : {}),
    };
  };
  const frame = { color: trim, material: 'wood' as const, kind: 'frame' as const };
  const [Wi, Hi] = [W - 2 * f, H - 2 * f];
  const inner = piece(0, 0, -0.25 * T, Wi, Hi, T, {
    color: p.color,
    ...(p.material ? { material: p.material } : {}),
    ...(p.kind ? { kind: p.kind } : {}),
  });
  const parts: RecipePart[] = [
    inner,
    piece(0, H / 2 - f / 2, 0.4 * T, W, f, 1.8 * T, frame),
    piece(0, -H / 2 + f / 2, 0.4 * T, W, f, 1.8 * T, frame),
    piece(-W / 2 + f / 2, 0, 0.4 * T, f, Hi, 1.8 * T, frame),
    piece(W / 2 - f / 2, 0, 0.4 * T, f, Hi, 1.8 * T, frame),
  ];
  const [cols, rows] = p.grid ?? (p.kind === 'window' ? DEFAULT_WINDOW_GRID : [1, 1]);
  const bar = BAR_SHARE * f;
  for (let k = 1; k < cols; k++)
    parts.push(piece(-Wi / 2 + (k * Wi) / cols, 0, 0.2 * T, bar, Hi, 1.4 * T, frame));
  for (let k = 1; k < rows; k++)
    parts.push(piece(0, -Hi / 2 + (k * Hi) / rows, 0.2 * T, Wi, bar, 1.4 * T, frame));
  if (p.kind === 'window')
    parts.push(piece(0, -H / 2 - 0.35 * f, 1.5 * T, 1.15 * W, 0.7 * f, 4 * T, frame));
  return parts;
}
