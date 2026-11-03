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

/**
 * Feeder departures on the EMS controller's roof gantry (x offset from BUS_POSITION),
 * ordered by where each sector lies (west → east) so outgoing cables never cross.
 * The breaker LEDs on the cabinet use the same order.
 */
export const FEEDER_EXIT_X: Record<SectorId, number> = {
  water: -0.6,
  households: -0.36,
  school: -0.12,
  market: 0.12,
  health: 0.36,
  industry: 0.6,
};
/** Gantry depth (z offset from BUS_POSITION), above the cabinet. */
export const FEEDER_EXIT_Z = -0.2;

/** World point where a sector's cable leaves the controller. */
export function feederExitPosition(id: SectorId): [number, number, number] {
  return [BUS_POSITION[0] + FEEDER_EXIT_X[id], 0, BUS_POSITION[2] + FEEDER_EXIT_Z];
}
