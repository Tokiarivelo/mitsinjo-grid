import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { EPS } from '../constants';
import { parseInput } from '../schemas';
import { scenarios } from '../scenarios';
import { simulate } from '../simulate';

describe('Engine Spec §7 Invariant Test Suite (P3-T8)', () => {
  it('nominal no-deficit on baseline scenario', () => {
    const sim = simulate(scenarios.baseline.input, 'proportional');
    expect(sim.metrics.unservedKwh).toBe(0);
    expect(sim.metrics.criticalUnservedKwh).toBe(0);
    expect(sim.metrics.criticalCoveragePct).toBe(100);
    expect(sim.metrics.violations).toBe(0);
  });

  it('solar drop changes simulation results', () => {
    const baselineSim = simulate(scenarios.baseline.input, 'proportional');
    const cloudySim = simulate(scenarios.cloudy_afternoon.input, 'proportional');

    expect(cloudySim.metrics.solarKwh).toBeLessThan(baselineSim.metrics.solarKwh);
    expect(cloudySim.id).not.toBe(baselineSim.id);
    expect(cloudySim.inputHash).not.toBe(baselineSim.inputHash);
  });

  it('never drops below reserve SoC on any scenario', () => {
    const scenarioKeys = Object.keys(scenarios) as (keyof typeof scenarios)[];
    for (const key of scenarioKeys) {
      const input = scenarios[key].input;
      for (const strat of ['proportional', 'essential_first', 'balanced'] as const) {
        const sim = simulate(input, strat);
        const minAllowedSoc = input.battery.minSocPct;
        for (const step of sim.steps) {
          expect(step.socPct).toBeGreaterThanOrEqual(minAllowedSoc - 1e-6);
        }
      }
    }
  });

  it('never exceeds battery capacity on any scenario', () => {
    const scenarioKeys = Object.keys(scenarios) as (keyof typeof scenarios)[];
    for (const key of scenarioKeys) {
      const input = scenarios[key].input;
      for (const strat of ['proportional', 'essential_first', 'balanced'] as const) {
        const sim = simulate(input, strat);
        for (const step of sim.steps) {
          expect(step.socPct).toBeLessThanOrEqual(100 + 1e-6);
        }
      }
    }
  });

  it('impossible demand reports unserved energy without crashing', () => {
    const input = structuredClone(scenarios.baseline.input);
    input.demandMultiplier = 2.0; // Maximum demand multiplier
    // Constrain solar and battery
    input.solar.peakKw = 5;
    input.battery.initialSocPct = 25;
    input.battery.capacityKwh = 10;

    const sim = simulate(input, 'proportional');
    expect(sim.metrics.unservedKwh).toBeGreaterThan(0);
    expect(sim.metrics.violations).toBe(0);
  });

  it('invalid input throws ZodError', () => {
    expect(() => parseInput({ horizonH: 12 })).toThrow(ZodError);
    expect(() => parseInput({ demandMultiplier: 5 })).toThrow(ZodError);
  });

  it('same input produces byte-identical result and id', () => {
    const inputA = scenarios.cloudy_afternoon.input;
    const inputB = structuredClone(scenarios.cloudy_afternoon.input);

    const simA = simulate(inputA, 'essential_first');
    const simB = simulate(inputB, 'essential_first');

    expect(simA.id).toBe(simB.id);
    expect(simA.inputHash).toBe(simB.inputHash);
    expect(JSON.stringify(simA)).toBe(JSON.stringify(simB));
  });

  it('energy balance holds for every step within EPS', () => {
    const scenarioKeys = Object.keys(scenarios) as (keyof typeof scenarios)[];
    for (const key of scenarioKeys) {
      const input = scenarios[key].input;
      for (const strat of ['proportional', 'essential_first', 'balanced'] as const) {
        const sim = simulate(input, strat);
        let storedKwh = (input.battery.initialSocPct / 100) * input.battery.capacityKwh;

        for (const step of sim.steps) {
          // servedKw = solarKw - batteryKw - curtailedKw
          const balance = step.solarKw - step.batteryKw - step.curtailedKw;
          expect(Math.abs(step.servedKw - balance)).toBeLessThanOrEqual(EPS);

          // ΔstoredKwh = max(batteryKw,0)·chargeEff − max(−batteryKw,0)/dischargeEff
          const newStoredKwh = (step.socPct / 100) * input.battery.capacityKwh;
          const actualDelta = newStoredKwh - storedKwh;
          const expectedDelta =
            Math.max(step.batteryKw, 0) * input.battery.chargeEff -
            Math.max(-step.batteryKw, 0) / input.battery.dischargeEff;

          expect(Math.abs(actualDelta - expectedDelta)).toBeLessThanOrEqual(EPS);
          storedKwh = newStoredKwh;
        }
      }
    }
  });
});
