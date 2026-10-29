import {
  SECTOR_IDS,
  type SectorId,
  type SimulationInput,
  type SimulationResult,
  type StrategyId,
  type WeatherId,
} from '@mitsinjo/engine';
import type {
  BuildingSceneModel,
  BuildingStatus,
  BatteryStatusColor,
  LineFlowSceneModel,
  SceneModel,
  StatusColor,
} from '../types';
import { STATUS_HEX, TOKEN_HEX } from './scene-palette';

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

/** SoC at or below this shows the battery as amber (visual threshold only). */
export const BATTERY_WARNING_SOC_PCT = 30;

export interface ToSceneModelOptions {
  input: SimulationInput;
  result?: SimulationResult | null;
  timeIndex?: number;
  isModified?: boolean;
  strategy?: StrategyId;
  /** Weather of the day shown. Default sunny (plain 24 h run). */
  weather?: WeatherId;
}

/**
 * Pure mapping from simulation engine state to 3D scene visual model.
 * Adheres strictly to P7-T1: zero energy math inside components.
 */
export function toSceneModel(options: ToSceneModelOptions): SceneModel {
  const {
    input,
    result,
    timeIndex = 12,
    isModified = false,
    strategy = 'proportional',
    weather = 'sunny',
  } = options;

  const validTime = Math.max(0, Math.min(23, Math.floor(timeIndex)));
  const step = result?.steps[validTime];
  const timeLabel = `${validTime.toString().padStart(2, '0')}:00`;

  // Sun & Daylight physics
  const isDaytime = validTime >= 6 && validTime <= 18;
  const sunElevation = isDaytime ? Math.sin(((validTime - 6) / 12) * Math.PI) : 0;
  const sunIntensity = Math.max(0, sunElevation);

  // 1. Solar model
  const peakKw = input.solar.peakKw;
  const currentSolarKw = step ? step.solarKw : 0;
  const glowIntensity = peakKw > 0 ? Math.min(1, Math.max(0, currentSolarKw / peakKw)) : 0;
  const isGenerating = currentSolarKw > 0.05;

  const solar = {
    position: SOLAR_POSITION,
    peakKw,
    currentKw: currentSolarKw,
    glowIntensity,
    isGenerating,
  };

  // 2. Battery model
  const capacityKwh = input.battery.capacityKwh;
  const socPct = step ? step.socPct : input.battery.initialSocPct;
  const flowKw = step ? step.batteryKw : 0;
  const isCharging = flowKw > 0.05;
  const isDischarging = flowKw < -0.05;
  const isIdle = !isCharging && !isDischarging;

  let batteryColor: BatteryStatusColor = 'healthy';
  if (socPct <= input.battery.minSocPct) {
    batteryColor = 'critical';
  } else if (socPct <= BATTERY_WARNING_SOC_PCT) {
    batteryColor = 'warning';
  }

  const battery = {
    position: BATTERY_POSITION,
    capacityKwh,
    socPct,
    flowKw,
    isCharging,
    isDischarging,
    isIdle,
    statusColor: batteryColor,
  };

  // 3. Buildings model (every engine sector)
  const buildings = {} as Record<SectorId, BuildingSceneModel>;
  const busToSectors = {} as Record<SectorId, LineFlowSceneModel>;

  for (const sectorId of SECTOR_IDS) {
    const sectorConfig = input.sectors.find((s) => s.id === sectorId);
    const priority = sectorConfig?.priority ?? 'medium';
    const sectorStep = step?.sectors[sectorId];
    const loadMultiplier = sectorConfig?.loadMultiplier ?? 1;
    const connected = loadMultiplier > 0;

    const demandKw = sectorStep ? sectorStep.demandKw : 0;
    const servedKw = sectorStep ? sectorStep.servedKw : 0;
    const unservedKw = Math.max(0, demandKw - servedKw);
    // No result yet → no coverage to show (never default to "100%").
    const coveragePct =
      !sectorStep || !connected
        ? null
        : demandKw > 0
          ? Math.round((servedKw / demandKw) * 100)
          : 100;

    let status: BuildingStatus = !connected ? 'disconnected' : sectorStep ? 'full' : 'unknown';
    if (connected && sectorStep && demandKw > 0 && servedKw < demandKw - 0.05) {
      status = servedKw > 0.05 ? 'partial' : 'unserved';
    }

    let statusColor: StatusColor = 'battery-green';
    if (status === 'unknown' || status === 'disconnected') {
      statusColor = 'idle';
    } else if (status === 'partial') {
      statusColor = 'warning-amber';
    } else if (status === 'unserved') {
      statusColor = 'critical-red';
    }

    const pos = SECTOR_POSITIONS[sectorId];

    buildings[sectorId] = {
      id: sectorId,
      nameKey: `sectors.${sectorId}`,
      position: pos,
      priority,
      demandKw,
      servedKw,
      unservedKw,
      coveragePct,
      status,
      statusColor,
      isCritical: priority === 'critical',
      connected,
      loadMultiplier,
    };

    // Bus to building transmission line
    const activeLine = servedKw > 0.05;
    busToSectors[sectorId] = {
      from: BUS_POSITION,
      to: pos,
      active: activeLine,
      flowKw: servedKw,
      direction: activeLine ? 'forward' : 'idle',
      speed: Math.min(2.5, Math.max(0.5, servedKw / 5)),
      color: STATUS_HEX[statusColor],
    };
  }

  // 4. Intersite lines
  const solarActive = currentSolarKw > 0.05;
  const solarToBattery: LineFlowSceneModel = {
    from: SOLAR_POSITION,
    to: BATTERY_POSITION,
    active: solarActive,
    flowKw: currentSolarKw,
    direction: solarActive ? 'forward' : 'idle',
    speed: Math.min(2.5, Math.max(0.5, currentSolarKw / 10)),
    color: TOKEN_HEX.solarAmber,
  };

  // Feeder from the solar/battery hub to the village bus carries what the engine
  // served this hour (solar + battery discharge), so it always flows toward the bus.
  const feederKw = step ? step.servedKw : 0;
  const feederActive = feederKw > 0.05;
  const batteryToBus: LineFlowSceneModel = {
    from: BATTERY_POSITION,
    to: BUS_POSITION,
    active: feederActive,
    flowKw: feederKw,
    direction: feederActive ? 'forward' : 'idle',
    speed: Math.min(2.5, Math.max(0.5, feederKw / 10)),
    color: TOKEN_HEX.energyCyan,
  };

  return {
    timeIndex: validTime,
    timeLabel,
    sunElevation,
    sunIntensity,
    isDaytime,
    isModified,
    hasResult: Boolean(result && step),
    strategy,
    weather,
    solar,
    battery,
    buildings,
    lines: {
      solarToBattery,
      batteryToBus,
      busToSectors,
    },
  };
}
