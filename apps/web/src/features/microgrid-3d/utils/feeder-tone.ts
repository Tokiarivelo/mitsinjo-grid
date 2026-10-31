import {
  ACTIVE_FEEDER_KW,
  feederTone as engineFeederTone,
  SECTOR_IDS,
  type FeederTone,
  type SectorId,
} from '@mitsinjo/engine';
import type { BuildingSceneModel, FeederSceneModel, SceneModel, StatusColor } from '../types';

/** Below this demand a feeder has nothing to carry (same threshold as the diagram's "No load"). */
export const NO_LOAD_KW = ACTIVE_FEEDER_KW;

const TONE_STATUS: Record<FeederTone, StatusColor> = {
  ok: 'battery-green',
  warning: 'warning-amber',
  critical: 'critical-red',
  idle: 'idle',
};

/**
 * Display tone of one controller feeder, shared by the 3D unit, its cable tags, both 2D
 * diagrams and the scale-model LEDs. Rule owned by the engine (`feederTone`), mapped to tokens here.
 */
export function feederTone(feeder: FeederSceneModel, building: BuildingSceneModel): StatusColor {
  // A burning sector (F1) is shown critical everywhere, even with no load at that hour.
  if (building.onFire) return 'critical-red';
  return TONE_STATUS[
    engineFeederTone({
      connected: building.connected,
      demandKw: building.demandKw,
      servedKw: building.servedKw,
      breaker: feeder.breaker,
    })
  ];
}

/** `feederTone` for every sector of a scene. */
export function feederTones(model: SceneModel): Record<SectorId, StatusColor> {
  return Object.fromEntries(
    SECTOR_IDS.map((id) => [id, feederTone(model.controller.feeders[id], model.buildings[id])])
  ) as Record<SectorId, StatusColor>;
}

/** A 3D cable tag only where the feeder carries power or should (shed); idle ones stay quiet. */
export function hasFeederTag(b: BuildingSceneModel): boolean {
  return b.connected && (b.demandKw > NO_LOAD_KW || b.servedKw > NO_LOAD_KW);
}
