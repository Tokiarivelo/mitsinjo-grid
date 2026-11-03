import { describe, expect, it } from 'vitest';
import { accessPathClearings, accessPaths } from '../access-paths';
import { closestPathSegment, pathDistance, type KeepOutZone } from '../landscape';
import { isPositionInClearing } from '../scatter';

describe('access tracks to placed objects', () => {
  const far: KeepOutZone = { id: 'a', x: 14, z: 6, r: 1.4 };

  it('runs from inside the yard to the closest village path', () => {
    const [track] = accessPaths([far]);
    expect(track).toBeDefined();
    expect(Math.hypot(track!.from[0] - far.x, track!.from[1] - far.z)).toBeLessThan(far.r);
    expect(track!.to).toEqual(closestPathSegment(far.x, far.z)!.closestPoint);
    expect(pathDistance(track!.to[0], track!.to[1])).toBeCloseTo(0, 6);
  });

  it('skips a yard that already sits on a path', () => {
    const hit = closestPathSegment(14, 6)!;
    const onPath: KeepOutZone = { x: hit.closestPoint[0], z: hit.closestPoint[1], r: 1.4 };
    expect(accessPaths([onPath])).toEqual([]);
  });

  it('clears trees all along the track', () => {
    const [track] = accessPaths([far]);
    const zones = accessPathClearings([track!]);
    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
      const x = track!.from[0] + (track!.to[0] - track!.from[0]) * t;
      const z = track!.from[1] + (track!.to[1] - track!.from[1]) * t;
      expect(isPositionInClearing(x, z, zones)).toBe(true);
    }
  });
});
