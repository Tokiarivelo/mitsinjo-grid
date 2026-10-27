import { describe, expect, it } from 'vitest';
import { scenarios } from '../scenarios';
import { simulate } from '../simulate';
import type { StrategyId } from '../schemas';

const ALL_STRATEGIES: readonly StrategyId[] = ['proportional', 'essential_first', 'balanced'];

describe('Scenarios Presets & Invariants', () => {
  const scenarioKeys = Object.keys(scenarios) as (keyof typeof scenarios)[];

  it('provides all documented scenarios including synthetic anomaly (PX-T3)', () => {
    expect(scenarioKeys).toEqual([
      'baseline',
      'cloudy_afternoon',
      'high_demand',
      'battery_constraint',
      'essential_stress',
      'meter_anomaly',
    ]);
  });

  for (const sId of scenarioKeys) {
    describe(`Scenario: ${sId}`, () => {
      for (const strat of ALL_STRATEGIES) {
        it(`runs with ${strat} with 0 invariant violations`, () => {
          const sim = simulate(scenarios[sId].input, strat);
          expect(sim.metrics.violations).toBe(0);
          expect(sim.steps).toHaveLength(24);
          expect(sim.metrics.demandKwh).toBeGreaterThan(0);
          expect(sim.metrics.servedKwh).toBeGreaterThan(0);
        });
      }
    });
  }

  it('baseline scenario satisfies 100% of demand with 0 unserved energy', () => {
    const sim = simulate(scenarios.baseline.input, 'proportional');
    expect(sim.metrics.violations).toBe(0);
    expect(sim.metrics.unservedKwh).toBe(0);
    expect(sim.metrics.criticalUnservedKwh).toBe(0);
    expect(sim.metrics.criticalCoveragePct).toBe(100);
    expect(sim.metrics.affectedSectors).toEqual([]);
  });

  it('meter_anomaly scenario detects persistent divergence and emits ANOMALY_TO_VERIFY warning (PX-T2, PX-T3)', () => {
    const sim = simulate(scenarios.meter_anomaly.input, 'proportional');
    const anomalyWarn = sim.warnings.find((w) => w.code === 'ANOMALY_TO_VERIFY');
    expect(anomalyWarn).toBeDefined();
    expect(anomalyWarn?.sector).toBe('market');
    expect(anomalyWarn?.fromHour).toBe(11);
    expect(anomalyWarn?.toHour).toBe(14);
  });
});
