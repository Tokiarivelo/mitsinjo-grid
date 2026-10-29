import { describe, expect, it } from 'vitest';
import { scenarios } from '../scenarios';
import { sweep } from '../sweep';

describe('sweep (PZ-T11, PZ-T14)', () => {
  const baseInput = scenarios.cloudy_afternoon.input;

  it('is a pure function and does not mutate the input', () => {
    const inputCopy = structuredClone(baseInput);
    const result = sweep(baseInput, {
      param: 'solarDropPct',
      from: 10,
      to: 30,
      step: 10,
    });

    expect(baseInput).toEqual(inputCopy);
    expect(result).toHaveLength(3);
    expect(result.map((p) => p.value)).toEqual([10, 20, 30]);
  });

  it('rejects invalid sweep configurations with ZodError', () => {
    // from > to
    expect(() =>
      sweep(baseInput, {
        param: 'solarDropPct',
        from: 50,
        to: 20,
        step: 10,
      })
    ).toThrow();

    // step <= 0
    expect(() =>
      sweep(baseInput, {
        param: 'solarDropPct',
        from: 0,
        to: 50,
        step: 0,
      })
    ).toThrow();

    // > 20 points (e.g. 0 to 90 by step 1 = 91 points)
    expect(() =>
      sweep(baseInput, {
        param: 'solarDropPct',
        from: 0,
        to: 90,
        step: 1,
      })
    ).toThrow();

    // Out of range solar drop (> 90)
    expect(() =>
      sweep(baseInput, {
        param: 'solarDropPct',
        from: 0,
        to: 95,
        step: 5,
      })
    ).toThrow();

    // Out of range demand multiplier (> 2.0)
    expect(() =>
      sweep(baseInput, {
        param: 'demandMultiplier',
        from: 0.5,
        to: 2.5,
        step: 0.2,
      })
    ).toThrow();
  });

  it('produces monotonically non-decreasing critical unserved energy on solar drop', () => {
    const result = sweep(baseInput, {
      param: 'solarDropPct',
      from: 0,
      to: 80,
      step: 10,
    });

    expect(result.length).toBe(9);

    for (const strat of ['proportional', 'essential_first', 'balanced'] as const) {
      for (let i = 0; i < result.length - 1; i++) {
        const curr = result[i]?.metrics[strat]?.criticalUnservedKwh ?? 0;
        const next = result[i + 1]?.metrics[strat]?.criticalUnservedKwh ?? 0;
        // As solar drop worsens, critical unserved cannot decrease
        expect(next).toBeGreaterThanOrEqual(curr - 1e-9);
      }
    }
  });

  it('sweeps demandMultiplier correctly', () => {
    const result = sweep(scenarios.baseline.input, {
      param: 'demandMultiplier',
      from: 0.8,
      to: 1.6,
      step: 0.2,
    });

    expect(result.length).toBe(5);
    expect(result.map((p) => p.value)).toEqual([0.8, 1, 1.2, 1.4, 1.6]);

    // Total demand must strictly increase with multiplier
    for (let i = 0; i < result.length - 1; i++) {
      const currDemand = result[i]?.metrics.proportional?.demandKwh ?? 0;
      const nextDemand = result[i + 1]?.metrics.proportional?.demandKwh ?? 0;
      expect(nextDemand).toBeGreaterThan(currDemand);
    }
  });

  it('sweeps initialSocPct correctly', () => {
    const result = sweep(scenarios.baseline.input, {
      param: 'initialSocPct',
      from: 30,
      to: 90,
      step: 15,
    });

    expect(result.length).toBe(5);
    expect(result.map((p) => p.value)).toEqual([30, 45, 60, 75, 90]);
    for (const p of result) {
      expect(p.metrics.proportional?.socStartPct).toBe(p.value);
    }
  });

  it('supports strategy subsets', () => {
    const result = sweep(
      baseInput,
      {
        param: 'solarDropPct',
        from: 10,
        to: 30,
        step: 10,
      },
      ['proportional', 'essential_first']
    );

    expect(result).toHaveLength(3);
    for (const p of result) {
      expect(p.metrics.proportional).toBeDefined();
      expect(p.metrics.essential_first).toBeDefined();
      expect(p.metrics.balanced).toBeUndefined();
    }
  });

  it('meets performance budget: 20 points runs in < 50 ms (PZ-T14)', () => {
    const config = {
      param: 'solarDropPct' as const,
      from: 0,
      to: 76,
      step: 4, // (76 - 0) / 4 + 1 = 20 points
    };

    // Warmup JIT
    for (let i = 0; i < 3; i++) {
      sweep(scenarios.cloudy_afternoon.input, config);
    }

    const times: number[] = [];
    for (let i = 0; i < 5; i++) {
      const t0 = performance.now();
      const res = sweep(scenarios.cloudy_afternoon.input, config);
      times.push(performance.now() - t0);
      expect(res).toHaveLength(20);
    }

    times.sort((a, b) => a - b);
    const median = times[Math.floor(times.length / 2)] ?? 0;
    const min = times[0] ?? 0;

    console.log(`sweep() latency: min=${min.toFixed(3)} ms, median=${median.toFixed(3)} ms`);
    expect(median).toBeLessThan(50);
  });
});
