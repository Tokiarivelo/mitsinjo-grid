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
      'village_fire',
      'overload_evening',
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

  it('village_fire cuts the market from 14 h and the water pumps from 15 h, the clinic keeps power', () => {
    const sim = simulate(scenarios.village_fire.input, 'essential_first');
    expect(sim.steps[13]?.sectors.market?.servedKw).toBeGreaterThan(0);
    expect(sim.steps[14]?.sectors.market?.servedKw).toBe(0);
    expect(sim.steps[14]?.sectors.water?.servedKw).toBeGreaterThan(0);
    expect(sim.steps[15]?.sectors.water?.servedKw).toBe(0);
    expect(sim.steps[23]?.sectors.market?.servedKw).toBe(0);
    for (const step of sim.steps) {
      expect(step.sectors.health?.servedKw).toBeCloseTo(step.sectors.health?.demandKw ?? 0, 6);
    }
  });

  it('overload_evening scenario cuts school from 14 h, industry is connected, and households surge in evening (PA-T6b)', () => {
    const input = scenarios.overload_evening.input;
    const industry = input.sectors.find((s) => s.id === 'industry');
    expect(industry?.loadMultiplier).toBe(0.2);

    const sim = simulate(input, 'essential_first');
    expect(sim.metrics.violations).toBe(0);

    // School is cut from 14:00 to 24:00 due to feeder outage
    expect(sim.steps[13]?.sectors.school?.servedKw).toBeGreaterThan(0);
    for (let h = 14; h < 24; h++) {
      expect(sim.steps[h]?.sectors.school?.servedKw).toBe(0);
    }

    // Households evening demand is higher than baseline
    const baselineSim = simulate(scenarios.baseline.input, 'essential_first');
    expect(sim.steps[19]?.sectors.households?.demandKw).toBeGreaterThan(
      baselineSim.steps[19]?.sectors.households?.demandKw ?? 0
    );

    // Overload creates unserved energy in the evening
    expect(sim.metrics.unservedKwh).toBeGreaterThan(0);

    const propSim = simulate(input, 'proportional');
    expect(propSim.metrics.unservedKwh).toBeGreaterThan(0);
  });
});
