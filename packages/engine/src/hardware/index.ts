import { HORIZON_H } from '../constants';
import {
  breakerFromMode,
  controllerModeAt,
  feederModeAt,
  feederTone,
  flowLevel,
} from '../dispatch';
import { isSectorConnected } from '../model';
import { sectorApplianceKw } from '../appliances';
import { computeProfileDemandKw } from '../model';
import { HardwareScaleSchema, SECTOR_IDS, TelemetrySampleSchema } from '../schemas';
import type {
  HardwareCommand,
  HardwareScale,
  InputPatch,
  SectorId,
  SimulationInput,
  SimulationResult,
  TelemetrySample,
} from '../schemas';

/** Speeds offered in the app: seconds of real time per simulated hour (slow → fast). */
export const TIME_SCALE_PRESETS = [60, 20, 10, 5] as const;

/** Default scale: 1 W = 4 kW, 1 h = 20 s (a day in 8 min); nominal W = default sector peaks ÷ 4000. */
export const DEFAULT_HARDWARE_SCALE: HardwareScale = {
  powerScale: 4000,
  timeScale: 20,
  luxFullSun: 20_000,
  nominalW: {
    health: 0.3,
    water: 0.75,
    school: 0.375,
    households: 1.5,
    market: 0.5,
    industry: 2,
  },
};

/** Simulated kW of a feeder at 100 % duty. */
export function feederNominalKw(scale: HardwareScale, id: SectorId): number {
  return (scale.nominalW[id] * scale.powerScale) / 1000;
}

function mean(values: readonly number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * Turns samples measured on the scale model into an InputPatch for `base`.
 * Measured hour h:
 *  - solarProfile[h] = base.profile[h] × clamp(mean lux / luxFullSun, 0, 1)  (lamp = clear sky)
 *  - meterReadings[s][h] = expected profile demand × mean request (0–1)
 * Unmeasured hours keep the base profile and expected demand. No samples → empty patch.
 */
export function scaleTelemetry(
  rawSamples: readonly TelemetrySample[],
  rawScale: HardwareScale,
  base: SimulationInput
): InputPatch {
  const scale = HardwareScaleSchema.parse(rawScale);
  const samples = rawSamples.map((s) => TelemetrySampleSchema.parse(s));
  if (samples.length === 0) return {};

  const byHour: TelemetrySample[][] = Array.from({ length: HORIZON_H }, () => []);
  for (const s of samples) byHour[s.simHour]!.push(s);

  const solarProfile = base.solar.profile.map((p, h) => {
    const hour = byHour[h]!;
    if (hour.length === 0) return p;
    const ratio = Math.min(1, Math.max(0, mean(hour.map((s) => s.lux)) / scale.luxFullSun));
    return p * ratio;
  });

  const meterReadings: Partial<Record<SectorId, number[]>> = {};
  const applianceKw = sectorApplianceKw(base.appliances);
  for (const sector of base.sectors) {
    meterReadings[sector.id] = Array.from({ length: HORIZON_H }, (_, h) => {
      const expected = computeProfileDemandKw(
        sector,
        base.demandMultiplier,
        base.events,
        h,
        applianceKw
      );
      const requests = byHour[h]!.map((s) => s.requests[sector.id]).filter(
        (r): r is number => r !== undefined
      );
      return requests.length === 0 ? expected : expected * mean(requests);
    });
  }

  return { solarProfile, meterReadings };
}

/** Setpoints for the scale model at `hour`, read from an engine result (no energy computed here). */
export function toHardwareCommand(
  input: SimulationInput,
  result: SimulationResult,
  hour: number,
  rawScale: HardwareScale,
  seq = 0
): HardwareCommand {
  const scale = HardwareScaleSchema.parse(rawScale);
  const h = Math.max(0, Math.min(HORIZON_H - 1, Math.floor(hour)));
  const step = result.steps[h]!;

  const feeders = {} as HardwareCommand['feeders'];
  for (const id of SECTOR_IDS) {
    const servedKw = step.sectors[id]?.servedKw ?? 0;
    const nominalKw = feederNominalKw(scale, id);
    const sector = step.sectors[id];
    const breaker = breakerFromMode(feederModeAt(input, result, h, id));
    const config = input.sectors.find((s) => s.id === id);
    feeders[id] = {
      duty: nominalKw > 0 ? Math.min(1, Math.max(0, servedKw / nominalKw)) : 0,
      breaker,
      flow: flowLevel(servedKw),
      tone: feederTone({
        connected: config ? isSectorConnected(config) : false,
        demandKw: sector?.demandKw ?? 0,
        servedKw,
        breaker,
      }),
    };
  }

  return {
    v: 1,
    seq,
    simHour: h,
    mode: controllerModeAt(input, result, h),
    socPct: Math.min(100, Math.max(0, step.socPct)),
    batteryKw: step.batteryKw,
    feeders,
  };
}
