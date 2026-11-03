import { closestPathSegment, PATH_HALF_WIDTH, type KeepOutZone } from './landscape';

/** A laterite track from a placed object's yard to the nearest village path ([x, z]). */
export interface AccessPath {
  id?: string;
  from: [number, number];
  to: [number, number];
}

/** Narrower than the village paths: a footpath, not a road. */
export const ACCESS_PATH_HALF_WIDTH = PATH_HALF_WIDTH * 0.75;
/** Spacing of the tree-clearing circles along a track. */
const CLEARING_STEP = 0.8;

/**
 * One track per yard, from inside the yard to the closest point of the village paths.
 * A yard that already touches a path needs none. Pure: same zones → same tracks.
 */
export function accessPaths(zones: readonly KeepOutZone[]): AccessPath[] {
  const out: AccessPath[] = [];
  for (const z of zones) {
    const hit = closestPathSegment(z.x, z.z);
    if (!hit || hit.distance <= z.r + PATH_HALF_WIDTH * 0.5) continue;
    const [px, pz] = hit.closestPoint;
    const k = (z.r * 0.6) / hit.distance;
    out.push({
      id: z.id,
      from: [z.x + (px - z.x) * k, z.z + (pz - z.z) * k],
      to: [px, pz],
    });
  }
  return out;
}

/** Circles along each track: trees there are cleared like in a yard. */
export function accessPathClearings(paths: readonly AccessPath[]): KeepOutZone[] {
  const out: KeepOutZone[] = [];
  const r = ACCESS_PATH_HALF_WIDTH + 0.6;
  for (const p of paths) {
    const len = Math.hypot(p.to[0] - p.from[0], p.to[1] - p.from[1]);
    const n = Math.max(1, Math.ceil(len / CLEARING_STEP));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      out.push({
        x: p.from[0] + (p.to[0] - p.from[0]) * t,
        z: p.from[1] + (p.to[1] - p.from[1]) * t,
        r,
        id: `${p.id ?? 'path'}:track:${i}`,
      });
    }
  }
  return out;
}
