import { describe, expect, it } from 'vitest';
import { createPrng, generateChaosWorkflow } from '../chaos';
import { createBaselineInput } from '../scenarios';
import { simulateWorkflow } from '../workflow';
import { WorkflowSchema } from '../schemas';

describe('createPrng (Mulberry32)', () => {
  it('is deterministic: same seed produces identical sequence', () => {
    const r1 = createPrng(42);
    const r2 = createPrng(42);
    const seq1 = Array.from({ length: 10 }, () => r1());
    const seq2 = Array.from({ length: 10 }, () => r2());
    expect(seq1).toEqual(seq2);
  });

  it('generates numbers strictly within [0, 1)', () => {
    const rand = createPrng(1337);
    for (let i = 0; i < 100; i++) {
      const val = rand();
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThan(1);
    }
  });

  it('different seeds produce different numbers', () => {
    const r1 = createPrng(100);
    const r2 = createPrng(200);
    expect(r1()).not.toBe(r2());
  });
});

describe('generateChaosWorkflow (PA-T6c)', () => {
  it('generates a valid workflow conforming to WorkflowSchema', () => {
    const wf = generateChaosWorkflow({ seed: 42, days: 4 });
    expect(WorkflowSchema.safeParse(wf).success).toBe(true);
    expect(wf).toHaveLength(4);
  });

  it('is strictly deterministic given the same seed', () => {
    const wf1 = generateChaosWorkflow({ seed: 1234, days: 5 });
    const wf2 = generateChaosWorkflow({ seed: 1234, days: 5 });
    expect(wf1).toEqual(wf2);
  });

  it('produces different workflows for different seeds', () => {
    const wf1 = generateChaosWorkflow({ seed: 111, days: 3 });
    const wf2 = generateChaosWorkflow({ seed: 999, days: 3 });
    expect(wf1).not.toEqual(wf2);
  });

  it('respects day count bounds (1 to 7)', () => {
    expect(generateChaosWorkflow({ seed: 1, days: 0 })).toHaveLength(1);
    expect(generateChaosWorkflow({ seed: 1, days: 7 })).toHaveLength(7);
    expect(generateChaosWorkflow({ seed: 1, days: 10 })).toHaveLength(7);
  });

  it('runs simulateWorkflow cleanly with 0 invariant violations', () => {
    const input = createBaselineInput();
    const chaosWf = generateChaosWorkflow({ seed: 2026, days: 3, maxIncidentsPerDay: 2 });
    const sim = simulateWorkflow(input, chaosWf, 'essential_first');

    expect(sim.days).toHaveLength(3);
    expect(sim.totals.violations).toBe(0);
    expect(sim.totals.demandKwh).toBeGreaterThan(0);
    expect(sim.totals.servedKwh).toBeGreaterThan(0);
  });

  it('can use custom fixed weathers while randomizing incidents', () => {
    const wf = generateChaosWorkflow({
      seed: 888,
      days: 3,
      weathers: ['sunny', 'storm', 'cloudy'],
    });
    expect(wf.map((d) => d.weather)).toEqual(['sunny', 'storm', 'cloudy']);
  });
});
