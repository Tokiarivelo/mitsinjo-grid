import type { SectorId, Priority, StrategyId, WeatherId } from '@mitsinjo/engine';

/** `unknown` = no simulation result for this step yet. */
/** `disconnected`: sector load set to 0 (e.g. the factory before it is connected). */
export type BuildingStatus = 'full' | 'partial' | 'unserved' | 'unknown' | 'disconnected';
export type StatusColor = 'battery-green' | 'warning-amber' | 'critical-red' | 'idle';
export type BatteryStatusColor = 'healthy' | 'warning' | 'critical';

export interface BuildingSceneModel {
  id: SectorId;
  nameKey: string;
  position: [number, number, number];
  priority: Priority;
  demandKw: number;
  servedKw: number;
  unservedKw: number;
  /** Null when there is no result for this step. */
  coveragePct: number | null;
  status: BuildingStatus;
  statusColor: StatusColor;
  isCritical: boolean;
  /** False when the sector's load multiplier is 0 (not connected to the grid). */
  connected: boolean;
  /** Sector load multiplier from the input (× 0–3, default 1). */
  loadMultiplier: number;
}

export interface SolarSceneModel {
  position: [number, number, number];
  peakKw: number;
  currentKw: number;
  glowIntensity: number; // 0 to 1
  isGenerating: boolean;
}

export interface BatterySceneModel {
  position: [number, number, number];
  capacityKwh: number;
  socPct: number;
  flowKw: number;
  isCharging: boolean;
  isDischarging: boolean;
  isIdle: boolean;
  statusColor: BatteryStatusColor;
}

export interface LineFlowSceneModel {
  from: [number, number, number];
  to: [number, number, number];
  active: boolean;
  flowKw: number;
  direction: 'forward' | 'backward' | 'idle';
  speed: number;
  color: string;
}

export interface SceneModel {
  timeIndex: number;
  timeLabel: string;
  sunElevation: number; // in radians or degrees (0 at sunrise/sunset, 1 at noon, negative at night)
  sunIntensity: number; // 0 to 1 for scene directional light
  isDaytime: boolean;
  isModified: boolean;
  hasResult: boolean;
  strategy: StrategyId;
  /** Weather of the simulated day shown (sky, clouds, rain). Solar kW already reflects it. */
  weather: WeatherId;
  solar: SolarSceneModel;
  battery: BatterySceneModel;
  buildings: Record<SectorId, BuildingSceneModel>;
  lines: {
    solarToBattery: LineFlowSceneModel;
    batteryToBus: LineFlowSceneModel;
    busToSectors: Record<SectorId, LineFlowSceneModel>;
  };
}

export type CameraPreset = 'village' | 'solar' | 'battery' | 'essential';
