import type { ObjectRecipe, RecipePart } from '@/lib/object-shape';

/**
 * Thatch eave roll (PG-T12): a thatched roof ends in a thick rounded lip, not a knife edge (the
 * drawing's curved eave). Each eave line of a `thatch` roof part gets a cylinder of the roof's
 * colour along it. Viewer-only, like the opening expansion. Pure: recipe units in and out.
 */

/** Roll radius, share of the roof's height. */
export const EAVE_ROLL_SHARE = 0.08;

const isThatchRoof = (p: RecipePart) =>
  (p.shape === 'hip' || p.shape === 'prism') && p.material === 'thatch';

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
  const r = EAVE_ROLL_SHARE * sy!;
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
