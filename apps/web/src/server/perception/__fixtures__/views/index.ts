import type { ViewMeasure } from '../../object-views';

/** Synthetic car views (PV-H / PG-T20 tests): object-box fractions, as `measureView` gives them. */
export type Pt = [number, number];
/** Car side, object-box fractions (u right, v up), front on the left: long hood, short trunk. */
export const SIDE: Pt[] = [
  [0, 0.15],
  [0, 0.5],
  [0.05, 0.55],
  [0.3, 0.6],
  [0.4, 0.95],
  [0.75, 0.95],
  [0.85, 0.6],
  [1, 0.55],
  [1, 0.15],
  [0.88, 0.15],
  [0.88, 0],
  [0.72, 0],
  [0.72, 0.15],
  [0.28, 0.15],
  [0.28, 0],
  [0.12, 0],
  [0.12, 0.15],
];
/** Car front: body, narrower cabin, two tires. */
export const FRONT: Pt[] = [
  [0, 0.15],
  [0, 0.6],
  [0.15, 0.65],
  [0.25, 0.95],
  [0.75, 0.95],
  [0.85, 0.65],
  [1, 0.6],
  [1, 0.15],
  [0.95, 0.15],
  [0.95, 0],
  [0.8, 0],
  [0.8, 0.15],
  [0.2, 0.15],
  [0.2, 0],
  [0.05, 0],
  [0.05, 0.15],
];
export const KIT = {
  archetype: 'vehicle' as const,
  proportions: { w: 1, h: 0.43, d: 0.48 },
  colors: { main: '#5a4aca', secondary: '#c0c6cc', accent: '#2f3a45' },
  materials: { main: 'metal' as const },
};
export const box = (x: number, y: number, w: number, h: number) => ({ x, y, w, h });
export const front: ViewMeasure = {
  aspect: 1.3,
  box: box(0.2, 0.1, 0.6, 0.8),
  ring: FRONT,
  parts: [
    { concept: 'headlight', box: box(0.08, 0.3, 0.12, 0.15) },
    { concept: 'headlight', box: box(0.8, 0.3, 0.12, 0.15) },
    { concept: 'bumper', box: box(0.02, 0.72, 0.96, 0.1) },
    { concept: 'windshield', box: box(0.27, 0.07, 0.46, 0.25) },
    { concept: 'grille', box: box(0.3, 0.5, 0.4, 0.15) },
    { concept: 'wheel', box: box(0.05, 0.85, 0.15, 0.15) },
  ],
};
export const side: ViewMeasure = {
  aspect: 2.9,
  box: box(0.05, 0.3, 0.9, 0.4),
  ring: SIDE,
  parts: [
    { concept: 'wheel', box: box(0.12, 0.7, 0.16, 0.3) },
    { concept: 'wheel', box: box(0.72, 0.7, 0.16, 0.3) },
    { concept: 'window', box: box(0.42, 0.08, 0.15, 0.3) },
    { concept: 'window', box: box(0.58, 0.08, 0.15, 0.3) },
  ],
};
