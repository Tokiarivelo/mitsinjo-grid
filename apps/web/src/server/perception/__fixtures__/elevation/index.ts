import type { ObjectKit } from '@/lib/object-kit';
import type { ElevationMasks } from '../../facade-house';

/** One validated 2D elevation, SAM boxes read on it, and the photo colours (PG-T2 golden set). */
export interface GoldenElevation {
  name: string;
  masks: ElevationMasks;
  colors: ObjectKit['colors'];
}

/**
 * The user's « rural thatched house » front elevation (2026-11-02, 1920 × 1280 sheet), boxes read
 * on the drawing: long-ridge thatch roof, 2 brick chimneys, 2 casement windows, a double door.
 */
export const THATCHED_FRONT: GoldenElevation = {
  name: 'thatched house',
  masks: {
    aspect: 1920 / 1280,
    house: { x: 0.161, y: 0.119, w: 0.678, h: 0.697 },
    roof: {
      box: { x: 0.161, y: 0.176, w: 0.678, h: 0.332 },
      rings: [
        [
          [0.161, 0.508],
          [0.161, 0.32],
          [0.215, 0.23],
          [0.785, 0.23],
          [0.839, 0.32],
          [0.839, 0.508],
        ],
      ],
    },
    wall: { x: 0.19, y: 0.508, w: 0.62, h: 0.308 },
    windows: [
      { x: 0.276, y: 0.559, w: 0.083, h: 0.136 },
      { x: 0.643, y: 0.559, w: 0.084, h: 0.136 },
    ],
    doors: [{ x: 0.44, y: 0.559, w: 0.12, h: 0.23 }],
    chimneys: [
      { x: 0.194, y: 0.119, w: 0.043, h: 0.139 },
      { x: 0.763, y: 0.119, w: 0.042, h: 0.139 },
    ],
    plinths: [{ x: 0.187, y: 0.777, w: 0.625, h: 0.039 }],
    steps: [{ x: 0.418, y: 0.8, w: 0.164, h: 0.016 }],
  },
  colors: { main: '#e6dccb', secondary: '#b8955a', accent: '#2b3440' },
};

export const GOLDEN_ELEVATIONS: ReadonlyArray<GoldenElevation> = [THATCHED_FRONT];
