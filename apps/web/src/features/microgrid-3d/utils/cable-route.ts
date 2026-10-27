/**
 * Pure cable routing: utility poles every `spacing` units between two anchors,
 * with a catenary-like sag in each span. Visual only.
 */

export const POLE_HEIGHT = 3.1;
export const ANCHOR_HEIGHT = 2.6;

export interface CableRoute {
  /** Intermediate pole feet [x, z] (anchors excluded: equipment carries the cable there). */
  poles: [number, number][];
  /** Polyline points along the whole cable. */
  points: [number, number, number][];
}

export function routeCable(
  from: [number, number, number],
  to: [number, number, number],
  { spacing = 4.5, sag = 0.35, segmentsPerSpan = 8 } = {}
): CableRoute {
  const dx = to[0] - from[0];
  const dz = to[2] - from[2];
  const length = Math.hypot(dx, dz);
  const spans = Math.max(1, Math.round(length / spacing));

  const anchors: [number, number, number][] = [];
  const poles: [number, number][] = [];
  for (let i = 0; i <= spans; i++) {
    const t = i / spans;
    const x = from[0] + dx * t;
    const z = from[2] + dz * t;
    const isEnd = i === 0 || i === spans;
    anchors.push([x, isEnd ? ANCHOR_HEIGHT : POLE_HEIGHT, z]);
    if (!isEnd) poles.push([x, z]);
  }

  const points: [number, number, number][] = [[from[0], ANCHOR_HEIGHT, from[2]]];
  for (let s = 0; s < anchors.length - 1; s++) {
    const a = anchors[s];
    const b = anchors[s + 1];
    if (!a || !b) continue;
    for (let k = 1; k <= segmentsPerSpan; k++) {
      const t = k / segmentsPerSpan;
      // Parabola: 0 at both ends, -sag in the middle.
      const drop = 4 * sag * t * (1 - t);
      points.push([
        a[0] + (b[0] - a[0]) * t,
        a[1] + (b[1] - a[1]) * t - drop,
        a[2] + (b[2] - a[2]) * t,
      ]);
    }
  }
  return { poles, points };
}
