import { describe, expect, it } from 'vitest';
import { ENGINE_VERSION } from '../constants';
import { scenarios } from '../scenarios';
import { simulate } from '../simulate';

describe('simulate (P3-T5)', () => {
  it('returns valid simulation result with 24 steps', () => {
    const sim = simulate(scenarios.baseline.input, 'proportional');

    expect(sim.engineVersion).toBe(ENGINE_VERSION);
    expect(sim.strategy).toBe('proportional');
    expect(sim.steps).toHaveLength(24);
    expect(sim.id).toMatch(/^SIM-[0-9A-F]{6}$/);
    expect(sim.inputHash).toHaveLength(16);

    for (let t = 0; t < 24; t++) {
      const step = sim.steps[t];
      expect(step).toBeDefined();
      if (step) {
        expect(step.t).toBe(t);
        expect(Object.keys(step.sectors)).toEqual([
          'health',
          'water',
          'school',
          'households',
          'market',
        ]);
      }
    }
  });

  it('aggregates step sums into metrics correctly', () => {
    const sim = simulate(scenarios.cloudy_afternoon.input, 'proportional');

    const totalDemandKw = sim.steps.reduce((acc, s) => acc + s.demandKw, 0);
    const totalServedKw = sim.steps.reduce((acc, s) => acc + s.servedKw, 0);
    const totalUnservedKw = sim.steps.reduce((acc, s) => acc + s.unservedKw, 0);
    const totalSolarKw = sim.steps.reduce((acc, s) => acc + s.solarKw, 0);
    const totalCurtailedKw = sim.steps.reduce((acc, s) => acc + s.curtailedKw, 0);

    expect(sim.metrics.demandKwh).toBeCloseTo(totalDemandKw, 6);
    expect(sim.metrics.servedKwh).toBeCloseTo(totalServedKw, 6);
    expect(sim.metrics.unservedKwh).toBeCloseTo(totalUnservedKw, 6);
    expect(sim.metrics.solarKwh).toBeCloseTo(totalSolarKw, 6);
    expect(sim.metrics.curtailedKwh).toBeCloseTo(totalCurtailedKw, 6);
  });

  it('generates and merges consecutive warnings into ranges', () => {
    const sim = simulate(scenarios.cloudy_afternoon.input, 'proportional');

    expect(sim.warnings.length).toBeGreaterThan(0);
    for (const w of sim.warnings) {
      expect(w.fromHour).toBeLessThanOrEqual(w.toHour);
      expect(w.fromHour).toBeGreaterThanOrEqual(0);
      expect(w.toHour).toBeLessThanOrEqual(23);
      expect(['CRITICAL_UNMET', 'SECTOR_PARTIAL', 'RESERVE_REACHED', 'CURTAILMENT']).toContain(
        w.code
      );
    }
  });
});
