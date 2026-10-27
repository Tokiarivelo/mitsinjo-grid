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
};
