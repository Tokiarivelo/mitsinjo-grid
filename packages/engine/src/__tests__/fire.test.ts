import { describe, expect, it } from 'vitest';
import {
  activeFires,
  effectiveSectorCaps,
  scenarios,
  simulate,
  ScenarioEventSchema,
  STRATEGIES,
  type ScenarioId,
  type SimulationInput,
  type StrategyId,
} from '../index';

const SCENARIO_IDS = Object.keys(scenarios) as ScenarioId[];
const STRATEGY_IDS = Object.keys(STRATEGIES) as StrategyId[];

/** Scenario input plus a fire in `sector` from `startHour` to the end of the day. */
function withFire(
  input: SimulationInput,
  sector: SimulationInput['sectors'][number]['id'],
  startHour: number,
  durationH = 24 - startHour
): SimulationInput {
  return { ...input, events: [...input.events, { type: 'fire', sector, startHour, durationH }] };
}

describe('fire event (M2-T1, F1)', () => {
  it('schema: accepts a fire, rejects one past the end of the day', () => {
    expect(
      ScenarioEventSchema.safeParse({
        type: 'fire',
        sector: 'school',
        startHour: 14,
        durationH: 10,
      }).success
    ).toBe(true);
    expect(
      ScenarioEventSchema.safeParse({
        type: 'fire',
        sector: 'school',
        startHour: 14,
        durationH: 11,
      }).success
    ).toBe(false);
  });

  describe.each(SCENARIO_IDS)('scenario %s', (id) => {
    const base = scenarios[id].input;
    const input = withFire(base, 'school', 14);

    it.each(STRATEGY_IDS)('%s: school at 0 kW from 14:00, off, no violation', (strategy) => {
      const result = simulate(input, strategy);
      expect(result.metrics.violations).toBe(0);
      for (const step of result.steps) {
        const school = step.sectors.school;
        if (!school) continue;
        if (step.t >= 14) {
          expect(school.servedKw).toBe(0);
          expect(school.lifelineServedKw).toBe(0);
          if (school.demandKw > 0) expect(school.mode).toBe('off');
        }
      }
      // Before the fire nothing changes.
      const before = simulate(base, strategy);
      for (let t = 0; t < 14; t++) {
        expect(result.steps[t]?.sectors.school?.servedKw).toBeCloseTo(
          before.steps[t]?.sectors.school?.servedKw ?? 0,
          9
        );
      }
    });
  });

  it('wins over a higher cap and over the lifeline floor; energy goes to other sectors', () => {
    const base: SimulationInput = {
      ...scenarios.baseline.input,
      sectorCaps: [{ sector: 'market', maxKw: 5, fromHour: 0, toHour: 24 }],
    };
    const input = withFire(base, 'market', 8, 4);
    const fire = simulate(input, 'proportional');
    const noFire = simulate(base, 'proportional');
    for (let t = 8; t < 12; t++) {
      expect(fire.steps[t]?.sectors.market?.servedKw).toBe(0);
    }
    expect(fire.steps[12]?.sectors.market?.servedKw).toBeCloseTo(
      noFire.steps[12]?.sectors.market?.servedKw ?? 0,
      9
    );
    // No lifeline shortfall reported for a sector cut by a fire.
    expect(
      fire.warnings.some((w) => w.code === 'LIFELINE_SHORTFALL' && w.sector === 'market')
    ).toBe(false);
  });

  it('warns FIRE_ISOLATION once per sector range, also for overlapping fires', () => {
    const input: SimulationInput = {
      ...scenarios.baseline.input,
      events: [
        ...scenarios.baseline.input.events,
        { type: 'fire', sector: 'school', startHour: 14, durationH: 4 },
        { type: 'fire', sector: 'school', startHour: 16, durationH: 4 },
      ],
    };
    const fire = simulate(input, 'balanced').warnings.filter((w) => w.code === 'FIRE_ISOLATION');
    expect(fire).toEqual([{ code: 'FIRE_ISOLATION', sector: 'school', fromHour: 14, toHour: 19 }]);
  });

  it('activeFires / effectiveSectorCaps', () => {
    const input = withFire(scenarios.baseline.input, 'water', 10, 2);
    expect(activeFires(input.events, 9)).toEqual([]);
    expect(activeFires(input.events, 10).map((f) => f.sector)).toEqual(['water']);
    expect(activeFires(input.events, 12)).toEqual([]);
    expect(effectiveSectorCaps(input)).toContainEqual({
      sector: 'water',
      maxKw: 0,
      fromHour: 10,
      toHour: 12,
    });
    expect(effectiveSectorCaps(scenarios.baseline.input)).toBe(scenarios.baseline.input.sectorCaps);
  });
});
