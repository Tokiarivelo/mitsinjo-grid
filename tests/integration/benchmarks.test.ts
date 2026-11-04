import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  BENCH_STRATEGIES,
  scenarios,
  strategyOutcomes,
  type ScenarioId,
  type StrategyOutcome,
} from '@mitsinjo/engine';

// The published report (benchmarks/engine.json, quoted in README and benchmarks/README.md) must match
// what the engine computes today. Latency varies by machine, so only the strategy outcomes are checked.

interface Report {
  scenarios: { scenario: ScenarioId; outcome: Record<string, StrategyOutcome> }[];
}

const report = JSON.parse(
  readFileSync(new URL('../../benchmarks/engine.json', import.meta.url), 'utf8')
) as Report;

describe('published benchmark report', () => {
  it('covers every engine scenario exactly once', () => {
    const published = report.scenarios.map((r) => r.scenario).sort();
    expect(published).toEqual(Object.keys(scenarios).sort());
  });

  it.each(report.scenarios.map((r) => [r.scenario, r] as const))(
    '%s: published strategy outcomes match the engine',
    (id, row) => {
      expect(row.outcome).toEqual(strategyOutcomes(scenarios[id].input));
    }
  );

  it('backs the README claim: essential-first never serves the clinic worse than proportional', () => {
    for (const { outcome } of report.scenarios) {
      expect(outcome.essential_first!.healthCoveragePct).toBeGreaterThanOrEqual(
        outcome.proportional!.healthCoveragePct
      );
      for (const s of BENCH_STRATEGIES) expect(outcome[s]!.violations).toBe(0);
    }
  });
});
