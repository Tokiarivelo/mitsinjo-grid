import { WEATHER_SOLAR_FACTOR } from './constants';
import { WorkflowSchema } from './schemas';
import type {
  SimulationInput,
  StrategyId,
  WeatherId,
  Workflow,
  WorkflowComparison,
  WorkflowDayResult,
  WorkflowResult,
  WorkflowTotals,
} from './schemas';
import { simulate } from './simulate';

const DEFAULT_STRATEGIES: readonly StrategyId[] = ['proportional', 'essential_first', 'balanced'];

/**
 * Returns a copy of `input` whose solar profile is scaled by the weather preset.
 * Scenario events (solar drops, demand spikes) still apply on top.
 */
export function applyWeather(input: SimulationInput, weather: WeatherId): SimulationInput {
  const factor = WEATHER_SOLAR_FACTOR[weather];
  const cloned = structuredClone(input);
  cloned.solar.profile = input.solar.profile.map((f) => f * factor);
  return cloned;
}

/**
 * Runs a multi-day weather workflow: each day is one 24 h simulation of `input` under that
 * day's weather. The battery carries over: day N+1 starts at day N's final SoC.
 */
export function simulateWorkflow(
  input: SimulationInput,
  rawWorkflow: Workflow,
  strategy: StrategyId
): WorkflowResult {
  const workflow = WorkflowSchema.parse(rawWorkflow);
  const days: WorkflowDayResult[] = [];
  let socPct = input.battery.initialSocPct;

  for (let day = 0; day < workflow.length; day++) {
    const { weather } = workflow[day]!;
    const dayInput = applyWeather(input, weather);
    dayInput.battery.initialSocPct = socPct;
    const result = simulate(dayInput, strategy);
    days.push({ day, weather, result });
    socPct = result.metrics.socEndPct;
  }

  return { strategy, days, totals: sumWorkflow(days) };
}

/** Runs the workflow for each strategy (all three by default). */
export function compareWorkflow(
  input: SimulationInput,
  workflow: Workflow,
  strategies?: readonly StrategyId[]
): WorkflowComparison {
  const selected = strategies && strategies.length > 0 ? strategies : DEFAULT_STRATEGIES;
  const out: WorkflowComparison = {};
  for (const strategy of selected) {
    out[strategy] = simulateWorkflow(input, workflow, strategy);
  }
  return out;
}

function sumWorkflow(days: readonly WorkflowDayResult[]): WorkflowTotals {
  const first = days[0]!.result.metrics;
  const last = days[days.length - 1]!.result.metrics;
  const totals: WorkflowTotals = {
    demandKwh: 0,
    servedKwh: 0,
    unservedKwh: 0,
    criticalUnservedKwh: 0,
    criticalUnmetHours: 0,
    solarKwh: 0,
    socStartPct: first.socStartPct,
    socEndPct: last.socEndPct,
    socMinPct: first.socMinPct,
    violations: 0,
  };
  for (const { result } of days) {
    const m = result.metrics;
    totals.demandKwh += m.demandKwh;
    totals.servedKwh += m.servedKwh;
    totals.unservedKwh += m.unservedKwh;
    totals.criticalUnservedKwh += m.criticalUnservedKwh;
    totals.criticalUnmetHours += m.criticalUnmetHours;
    totals.solarKwh += m.solarKwh;
    totals.socMinPct = Math.min(totals.socMinPct, m.socMinPct);
    totals.violations += m.violations;
  }
  return totals;
}
