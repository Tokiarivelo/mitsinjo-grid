import type { ObjectRecipe, RecipePart } from '@/lib/object-shape';

/**
 * Roof trim. Eave roll (PG-T12, `bulge` PG-T10): a thatched roof ends in a thick rounded lip, not
 * a knife edge (the drawing's curved eave). Each eave line of a roof part with a bulge (thatch by
 * default) gets a cylinder of the roof's colour along it. Chimney cap (PG-T10): a slab on top of a
 * chimney with `cap`. Viewer-only, like the opening expansion. Pure: recipe units in and out.
 */

/** Default roll radius of a thatch roof, share of the roof's height. */
export const EAVE_ROLL_SHARE = 0.08;
/** Chimney cap: wider than the stack by this factor, this share of the stack's width thick. */
export const CAP_WIDEN = 1.3;
export const CAP_THICK = 0.25;

/** Roll radius share of a roof part: its `bulge`, else the thatch default, else 0. */
export function roofBulge(p: RecipePart): number {
  if (p.shape !== 'hip' && p.shape !== 'prism') return 0;
  return p.bulge ?? (p.material === 'thatch' ? EAVE_ROLL_SHARE : 0);
}

const isThatchRoof = (p: RecipePart) => roofBulge(p) > 0;

/** Parts with a cap slab added after each chimney that asks for one. */
export function expandChimneyCaps(
  parts: ReadonlyArray<RecipePart>,
  proportions: ObjectRecipe['proportions']
): RecipePart[] {
  const dims = [proportions.w, proportions.h, proportions.d];
  return parts.flatMap((p) => {
    if (p.kind !== 'chimney' || !p.cap || p.shape !== 'box') return [p];
    const [sx, sy, sz] = p.size.map((v, i) => v * dims[i]!);
    const t = Math.min(CAP_THICK * Math.min(sx!, sz!), 0.3 * sy!);
    const top = p.at[1] * dims[1]! + sy! / 2;
    const cap: RecipePart = {
      shape: 'box',
      at: [p.at[0], (top + t / 2) / dims[1]!, p.at[2]],
      size: [(CAP_WIDEN * sx!) / dims[0]!, t / dims[1]!, (CAP_WIDEN * sz!) / dims[2]!],
      color: p.color,
      ...(p.material ? { material: p.material } : {}),
      kind: 'chimney',
      ...(p.status ? { status: p.status } : {}),
    };
    return [p, cap];
  });
}

/**
 * Parts with an eave roll added after each thatch roof. `overhang` = the viewer's extra roof
 * reach on a prism (world units, each side), so the roll sits on the drawn eave.
 */
export function expandRoofTrim(
  parts: ReadonlyArray<RecipePart>,
  proportions: ObjectRecipe['proportions'],
  overhang = 0
): RecipePart[] {
  if (!parts.some(isThatchRoof)) return [...parts];
  const dims = [proportions.w, proportions.h, proportions.d];
  return parts.flatMap((p) => (isThatchRoof(p) ? [p, ...rolls(p, dims, overhang)] : [p]));
}

function rolls(p: RecipePart, dims: number[], overhang: number): RecipePart[] {
  const [cx, cy, cz] = p.at.map((v, i) => v * dims[i]!);
  const [sx, sy, sz] = p.size.map((v, i) => v * dims[i]!);
  const r = roofBulge(p) * sy!;
  const y = cy! - sy! / 2 + 0.6 * r;
  const look = { color: p.color, material: p.material, kind: 'roof' as const };
  const roll = (at: [number, number, number], axis: 'x' | 'z', len: number): RecipePart => ({
    shape: 'cylinder',
    axis,
    at: [at[0] / dims[0]!, at[1] / dims[1]!, at[2] / dims[2]!],
    size:
      axis === 'x'
        ? [len / dims[0]!, (2 * r) / dims[1]!, (2 * r) / dims[2]!]
        : [(2 * r) / dims[0]!, (2 * r) / dims[1]!, len / dims[2]!],
    ...look,
    ...(p.status ? { status: p.status } : {}),
  });
  if (p.shape === 'prism') {
    // Ridge front to back: the eaves run along z on both long sides.
    const half = sx! / 2 + overhang;
    const len = sz! + 2 * overhang;
    return [roll([cx! - half, y, cz!], 'z', len), roll([cx! + half, y, cz!], 'z', len)];
  }
  // Hip: eaves on all four sides.
  return [
    roll([cx!, y, cz! + sz! / 2], 'x', sx!),
    roll([cx!, y, cz! - sz! / 2], 'x', sx!),
    roll([cx! - sx! / 2, y, cz!], 'z', sz!),
    roll([cx! + sx! / 2, y, cz!], 'z', sz!),
  ];
}
