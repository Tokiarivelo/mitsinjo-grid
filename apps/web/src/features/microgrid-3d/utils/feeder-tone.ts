import { SECTOR_IDS, type SectorId } from '@mitsinjo/engine';
import type { BuildingSceneModel, FeederSceneModel, SceneModel, StatusColor } from '../types';

/** Below this demand a feeder has nothing to carry (same threshold as the diagram's "No load"). */
export const NO_LOAD_KW = 0.05;

/**
 * Display tone of one controller feeder, shared by the 3D unit, its cable tags and
 * both 2D diagrams: limiter → amber, open on a connected sector with demand → red,
 * open with nothing to serve (or not connected) → neutral, closed with no demand this
 * hour → neutral, closed → the sector's status.
 */
export function feederTone(feeder: FeederSceneModel, building: BuildingSceneModel): StatusColor {
  if (!building.connected) return 'idle';
  if (feeder.breaker === 'closed' && building.demandKw <= NO_LOAD_KW) return 'idle';
  if (feeder.breaker === 'limited') return 'warning-amber';
  if (feeder.breaker === 'open') return building.status === 'unserved' ? 'critical-red' : 'idle';
  return building.statusColor;
}

/** `feederTone` for every sector of a scene. */
export function feederTones(model: SceneModel): Record<SectorId, StatusColor> {
  return Object.fromEntries(
    SECTOR_IDS.map((id) => [id, feederTone(model.controller.feeders[id], model.buildings[id])])
  ) as Record<SectorId, StatusColor>;
}
