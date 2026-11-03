import type { ScenarioId, SimulationInput } from '../schemas';
import { createBaselineInput } from './baseline';

export * from './baseline';

export interface ScenarioDefinition {
  title: string;
  description: string;
  input: SimulationInput;
}

export function createCloudyAfternoonInput(): SimulationInput {
  const input = createBaselineInput();
  input.scenarioId = 'cloudy_afternoon';
  input.battery.initialSocPct = 35;
  input.events = [
    {
      type: 'solar_drop',
      startHour: 13,
      durationH: 2,
      factor: 0.6,
    },
  ];
  return input;
}

export function createHighDemandInput(): SimulationInput {
  const input = createBaselineInput();
  input.scenarioId = 'high_demand';
  input.events = [
    {
      type: 'demand_spike',
      sector: 'all',
      startHour: 17,
      durationH: 5,
      factor: 1.3,
    },
  ];
  return input;
}

export function createBatteryConstraintInput(): SimulationInput {
  const input = createBaselineInput();
  input.scenarioId = 'battery_constraint';
  input.battery.capacityKwh = 60;
  input.battery.initialSocPct = 30;
  return input;
}

export function createEssentialStressInput(): SimulationInput {
  const input = createBaselineInput();
  input.scenarioId = 'essential_stress';
  input.battery.initialSocPct = 25;
  input.events = [
    {
      type: 'solar_drop',
      startHour: 11,
      durationH: 4,
      factor: 0.4,
    },
  ];
  return input;
}

export function createMeterAnomalyInput(): SimulationInput {
  const input = createBaselineInput();
  input.scenarioId = 'meter_anomaly';
  const market = input.sectors.find((s) => s.id === 'market');
  if (market) {
    market.meterReadings = market.profileKw.map((kw, h) => {
      if (h >= 11 && h < 15) {
        return 3.2; // Divergence > 25% for 4 consecutive hours (>= 2h)
      }
      return kw;
    });
  }
  return input;
}

/** Market start hour of the scripted village fire; it reaches the water pumps 1 h later. */
export const VILLAGE_FIRE_START_HOUR = 14;

/**
 * Scripted fire (F1 events, no operator report): the market burns from 14 h, then the fire
 * spreads to the neighbouring water pumping station at 15 h. Both stay cut (0 kW) until the end of the day.
 */
export function createVillageFireInput(): SimulationInput {
  const input = createBaselineInput();
  input.scenarioId = 'village_fire';
  const spreadHour = VILLAGE_FIRE_START_HOUR + 1;
  input.events = [
    {
      type: 'fire',
      sector: 'market',
      startHour: VILLAGE_FIRE_START_HOUR,
      durationH: 24 - VILLAGE_FIRE_START_HOUR,
    },
    { type: 'fire', sector: 'water', startHour: spreadHour, durationH: 24 - spreadHour },
  ];
  return input;
}

/**
 * Scripted evening overload and feeder outage incident (PA-T6b):
 * - Evening household surge (demand spike ×1.4 from 18:00 to 23:00)
 * - Carpentry workshop connected (industry loadMultiplier = 0.2)
 * - Distribution feeder outage cuts school to 0 kW from 14:00 to 24:00
 */
export function createOverloadEveningInput(): SimulationInput {
  const input = createBaselineInput();
  input.scenarioId = 'overload_evening';
  const industry = input.sectors.find((s) => s.id === 'industry');
  if (industry) {
    // Carpentry workshop connected at moderate load.
    industry.loadMultiplier = 0.2;
  }
  input.events = [
    {
      type: 'demand_spike',
      sector: 'households',
      startHour: 18,
      durationH: 5,
      factor: 1.4,
    },
  ];
  input.sectorCaps = [
    {
      sector: 'school',
      maxKw: 0,
      fromHour: 14,
      toHour: 24,
    },
  ];
  return input;
}

export const scenarios: Record<ScenarioId, ScenarioDefinition> = {
  baseline: {
    title: 'Sunny Baseline Day',
    description:
      'Nominal operations with clear skies and standard village activity. Solar generation and 120 kWh storage fully satisfy all community demands with zero unserved energy.',
    input: createBaselineInput(),
  },
  cloudy_afternoon: {
    title: 'Cloudy Afternoon Deficit',
    description:
      'Sudden cloud cover reduces solar irradiance by 40% between 13:00 and 15:00 while initial battery storage is lower (35%). Proportional shedding drops clinic power, whereas essential-first protects it.',
    input: createCloudyAfternoonInput(),
  },
  high_demand: {
    title: 'Evening Demand Spike',
    description:
      'A community event and productive night shift increase demand across all sectors by 30% from 17:00 to 22:00, testing peak discharge limits.',
    input: createHighDemandInput(),
  },
  battery_constraint: {
    title: 'Degraded Battery Bank',
    description:
      'Battery usable capacity is constrained to 60 kWh with 30% starting SoC, simulating partial cell outage or end-of-life battery pack.',
    input: createBatteryConstraintInput(),
  },
  essential_stress: {
    title: 'Severe Weather Stress',
    description:
      'Extended storm drops solar output by 60% for 4 midday hours with depleted starting storage (25%). Demonstrates critical lifeline protection under deep deficit.',
    input: createEssentialStressInput(),
  },
  meter_anomaly: {
    title: 'Synthetic Meter Anomaly',
    description:
      'Clearly labeled synthetic anomaly scenario: persistent divergence between meter readings and expected profile (>25% for 4h) in the market sector. Flags ANOMALY_TO_VERIFY without assuming fraud.',
    input: createMeterAnomalyInput(),
  },
  village_fire: {
    title: 'Village Fire',
    description:
      'Scripted incident: the market catches fire at 14:00 and the fire spreads to the water pumping station at 15:00. Both sectors are cut to 0 kW for safety until the end of the day; the rest of the village keeps running.',
    input: createVillageFireInput(),
  },
  overload_evening: {
    title: 'Evening Overload & Feeder Outage',
    description:
      'Evening household demand surge with connected carpentry workshop (industry active) and simulated feeder outage on the school sector from 14:00 to midnight.',
    input: createOverloadEveningInput(),
  },
};
