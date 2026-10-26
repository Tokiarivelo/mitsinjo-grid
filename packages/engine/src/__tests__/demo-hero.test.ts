import { describe, expect, it } from 'vitest';
import { scenarios } from '../scenarios';
import { simulate } from '../simulate';

describe('Demo Hero Scenario (cloudy_afternoon)', () => {
  it('proportional strategy drops clinic critical power during evening deficit', () => {
    const input = scenarios.cloudy_afternoon.input;
    const propSim = simulate(input, 'proportional');

    // Must have unserved critical energy
    expect(propSim.metrics.criticalUnservedKwh).toBeGreaterThan(0.01);
    expect(propSim.metrics.criticalCoveragePct).toBeLessThan(100);
    expect(propSim.metrics.criticalUnmetHours).toBeGreaterThan(0);
    expect(propSim.metrics.violations).toBe(0);
  });

  it('essential_first strategy fully protects critical clinic power', () => {
    const input = scenarios.cloudy_afternoon.input;
    const essSim = simulate(input, 'essential_first');

    // Essential first protects 100% of critical demand
    expect(essSim.metrics.criticalUnservedKwh).toBe(0);
    expect(essSim.metrics.criticalCoveragePct).toBe(100);
    expect(essSim.metrics.criticalUnmetHours).toBe(0);
    expect(essSim.metrics.violations).toBe(0);
  });

  it('essential_first achieves higher or equal coverage for critical tier (health) across all scenarios', () => {
    const scenarioKeys = Object.keys(scenarios) as (keyof typeof scenarios)[];
    for (const key of scenarioKeys) {
      const input = scenarios[key].input;
      const propSim = simulate(input, 'proportional');
      const essSim = simulate(input, 'essential_first');

      const essHealth = essSim.metrics.perSector.health;
      const propHealth = propSim.metrics.perSector.health;
      expect(essHealth).toBeDefined();
      expect(propHealth).toBeDefined();

      if (essHealth && propHealth) {
        expect(essHealth.coveragePct).toBeGreaterThanOrEqual(
          propHealth.coveragePct - 1e-9
        );
        expect(essHealth.unservedKwh).toBeLessThanOrEqual(
          propHealth.unservedKwh + 1e-9
        );
      }
    }
  });

  it('balanced strategy achieves higher or equal critical coverage across all scenarios', () => {
    const scenarioKeys = Object.keys(scenarios) as (keyof typeof scenarios)[];
    for (const key of scenarioKeys) {
      const input = scenarios[key].input;
      const propSim = simulate(input, 'proportional');
      const balSim = simulate(input, 'balanced');

      expect(balSim.metrics.criticalCoveragePct).toBeGreaterThanOrEqual(
        propSim.metrics.criticalCoveragePct - 1e-9
      );
    }
  });
});
