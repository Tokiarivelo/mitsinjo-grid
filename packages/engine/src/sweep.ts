import { DEFAULT_DROP_DURATION_H, DEFAULT_DROP_START_HOUR } from './constants';
import { SweepConfigSchema } from './schemas';
import type {
  Metrics,
  SimulationInput,
  SolarDropEvent,
  StrategyId,
  SweepConfig,
  SweepParam,
  SweepPoint,
  SweepResult,
} from './schemas';
import { simulateSteps } from './simulate';

const DEFAULT_STRATEGIES: readonly StrategyId[] = ['proportional', 'essential_first', 'balanced'];

function patchInputForSweep(
  input: SimulationInput,
  param: SweepParam,
  value: number
): SimulationInput {
  if (param === 'demandMultiplier') {
    return {
      ...input,
      scenarioId: 'custom',
      demandMultiplier: value,
    };
  }

  if (param === 'initialSocPct') {
    return {
      ...input,
      scenarioId: 'custom',
      battery: {
        ...input.battery,
        initialSocPct: value,
      },
    };
  }

  // solarDropPct
  const existingDrop = input.events.find((e) => e.type === 'solar_drop') as
    SolarDropEvent | undefined;
  const startHour = existingDrop?.startHour ?? DEFAULT_DROP_START_HOUR;
  const durationH = existingDrop?.durationH ?? DEFAULT_DROP_DURATION_H;
  const eventsWithoutDrop = input.events.filter((e) => e.type !== 'solar_drop');

  if (value === 0) {
    return {
      ...input,
      scenarioId: 'custom',
      events: eventsWithoutDrop,
    };
  }

  return {
    ...input,
    scenarioId: 'custom',
    events: [
      ...eventsWithoutDrop,
      {
        type: 'solar_drop',
        startHour,
        durationH,
        factor: 1 - value / 100,
      },
    ],
  };
}

/**
 * Sweeps a parameter across a range [from, to] with a given step (≤ 20 points)
 * and returns the resulting metrics for each requested strategy.
 *
 * Pure function: does not mutate the input.
 */
export function sweep(
  input: SimulationInput,
  rawConfig: SweepConfig,
  strategies?: readonly StrategyId[]
): SweepResult {
  const config = SweepConfigSchema.parse(rawConfig);
  const targetStrategies = strategies && strategies.length > 0 ? strategies : DEFAULT_STRATEGIES;

  const stepStr = config.step.toString();
  const decimals = stepStr.includes('.') ? (stepStr.split('.')[1]?.length ?? 0) : 0;

  const points: SweepPoint[] = [];
  const epsilon = 1e-9;

  for (let v = config.from; v <= config.to + epsilon; v += config.step) {
    const roundedValue = Number(v.toFixed(decimals));
    const patched = patchInputForSweep(input, config.param, roundedValue);

    const metrics: Partial<Record<StrategyId, Metrics>> = {};
    for (const strat of targetStrategies) {
      metrics[strat] = simulateSteps(patched, strat).metrics;
    }

    points.push({
      value: roundedValue,
      metrics: metrics as Record<StrategyId, Metrics>,
    });
  }

  return points;
}
