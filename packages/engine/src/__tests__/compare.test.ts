import { describe, expect, it } from 'vitest';
import { compare } from '../compare';
import { createBaselineInput } from '../scenarios';

describe('compare strategies (P3-T7)', () => {
  it('runs multiple strategies and returns Comparison record', () => {
    const input = createBaselineInput();
    const result = compare(input, ['proportional', 'essential_first']);

    expect(result.proportional).toBeDefined();
    expect(result.essential_first).toBeDefined();
    expect(result.proportional?.strategy).toBe('proportional');
    expect(result.essential_first?.strategy).toBe('essential_first');
    expect(result.proportional?.steps).toHaveLength(24);
    expect(result.essential_first?.steps).toHaveLength(24);
  });

  it('runs all three strategies by default when none specified', () => {
    const input = createBaselineInput();
    const result = compare(input);

    expect(result.proportional).toBeDefined();
    expect(result.essential_first).toBeDefined();
    expect(result.balanced).toBeDefined();
  });

  it('meets latency requirement: compare() runs in < 10 ms', () => {
    const input = createBaselineInput();

    // Warmup JIT
    for (let i = 0; i < 10; i++) {
      compare(input);
    }

    const times: number[] = [];
    for (let i = 0; i < 10; i++) {
      const t0 = performance.now();
      compare(input);
      times.push(performance.now() - t0);
    }
    times.sort((a, b) => a - b);
    const median = times[Math.floor(times.length / 2)] ?? 0;
    const min = times[0] ?? 0;

    console.log(`compare() latency: min=${min.toFixed(3)} ms, median=${median.toFixed(3)} ms`);
    expect(median).toBeLessThan(10);
  });
});
