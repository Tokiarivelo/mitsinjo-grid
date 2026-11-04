import { writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  BENCH_STRATEGIES as STRATEGIES,
  compare,
  scenarios,
  simulate,
  strategyOutcomes,
  type ScenarioId,
} from '../index';

// Engine benchmark (`make bench`): latency of simulate/compare and strategy outcomes per scenario.
// Always runs as a light check; with BENCH_OUT set it also writes the JSON report there.

// Plain `make test` keeps it light; `make bench` sets BENCH_RUNS=200.
const RUNS = Number(process.env.BENCH_RUNS ?? 20);
const round = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d;

export function percentile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx] ?? 0;
}

function timeMs(fn: () => void, runs: number) {
  for (let i = 0; i < 10; i++) fn(); // warm-up
  const samples: number[] = [];
  for (let i = 0; i < runs; i++) {
    const t0 = performance.now();
    fn();
    samples.push(performance.now() - t0);
  }
  samples.sort((a, b) => a - b);
  return { medianMs: round(percentile(samples, 50), 3), p95Ms: round(percentile(samples, 95), 3) };
}

describe('percentile', () => {
  it('picks nearest-rank values', () => {
    expect(percentile([1, 2, 3, 4], 50)).toBe(2);
    expect(percentile([1, 2, 3, 4], 95)).toBe(4);
    expect(percentile([], 50)).toBe(0);
  });
});

describe('engine benchmark', () => {
  it('times every scenario and compares strategies', { timeout: 120_000 }, () => {
    const ids = Object.keys(scenarios) as ScenarioId[];
    const rows = ids.map((id) => {
      const input = scenarios[id].input;
      const outcome = strategyOutcomes(input);
      return {
        scenario: id,
        simulate: timeMs(() => simulate(input, 'essential_first'), RUNS),
        compare3: timeMs(() => compare(input, STRATEGIES), RUNS),
        outcome,
      };
    });

    for (const r of rows) {
      // The clinic is never served worse by essential-first than by proportional shedding.
      expect(r.outcome.essential_first.healthCoveragePct).toBeGreaterThanOrEqual(
        r.outcome.proportional.healthCoveragePct
      );
      for (const s of STRATEGIES) expect(r.outcome[s].violations).toBe(0);
    }

    if (process.env.BENCH_OUT) {
      const report = {
        generatedBy: 'make bench',
        node: process.version,
        runsPerMeasure: RUNS,
        scenarios: rows,
      };
      writeFileSync(process.env.BENCH_OUT, JSON.stringify(report, null, 2) + '\n');
    }
  });
});
