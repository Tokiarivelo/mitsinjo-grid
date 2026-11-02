import type { SectorId } from '@mitsinjo/engine';

/**
 * Village site positions (scene units, y = 0, ground added by callers). Leaf module on purpose:
 * `landscape` and `placement` both need these, and living in `to-scene-model` created an import
 * cycle that crashed module evaluation (PP-T3).
 */
export const SECTOR_POSITIONS: Record<SectorId, [number, number, number]> = {
  health: [9, 0, -1],
  water: [-8, 0, 2],
  school: [2, 0, -9],
  households: [-6, 0, 8],
  market: [4, 0, 7],
  industry: [11, 0, -8.5],
};

export const SOLAR_POSITION: [number, number, number] = [-10, 0, -8];
export const BATTERY_POSITION: [number, number, number] = [0, 0, -2];
export const BUS_POSITION: [number, number, number] = [0, 0, 1];
