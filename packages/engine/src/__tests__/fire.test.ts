import { describe, expect, it } from 'vitest';
import {
  activeFires,
  applyPatch,
  effectiveSectorCaps,
  scenarios,
  simulate,
  InputPatchSchema,
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

  describe('clearFires restore (M2-T4)', () => {
    it('schema: accepts sectors, rejects an empty list and unknown sectors', () => {
      expect(InputPatchSchema.safeParse({ clearFires: ['school'] }).success).toBe(true);
      expect(InputPatchSchema.safeParse({ clearFires: [] }).success).toBe(false);
      expect(InputPatchSchema.safeParse({ clearFires: ['spaceport'] }).success).toBe(false);
    });

    it('removes only the listed sectors’ fires, keeps other events, never mutates', () => {
      const base: SimulationInput = {
        ...scenarios.cloudy_afternoon.input,
        events: [
          ...scenarios.cloudy_afternoon.input.events,
          { type: 'fire', sector: 'school', startHour: 14, durationH: 4 },
          { type: 'fire', sector: 'market', startHour: 10, durationH: 2 },
        ],
      };
      const restored = applyPatch(base, { clearFires: ['school'] });
      expect(restored.events.filter((e) => e.type === 'fire').map((e) => e.sector)).toEqual([
        'market',
      ]);
      expect(restored.events.some((e) => e.type === 'solar_drop')).toBe(true);
      expect(restored.scenarioId).toBe('custom');
      expect(base.events.filter((e) => e.type === 'fire')).toHaveLength(2);
    });

    it.each(SCENARIO_IDS)('scenario %s: cleared sector served again, 0 violations', (id) => {
      const base = scenarios[id].input;
      const burning = withFire(base, 'school', 14);
      const restored = applyPatch(burning, { clearFires: ['school'] });
      for (const strategy of STRATEGY_IDS) {
        const result = simulate(restored, strategy);
        expect(result.metrics.violations).toBe(0);
        expect(
          result.warnings.some((w) => w.code === 'FIRE_ISOLATION' && w.sector === 'school')
        ).toBe(false);
        const burnt = simulate(burning, strategy);
        expect(result.metrics.perSector.school?.servedKwh ?? 0).toBeGreaterThanOrEqual(
          burnt.metrics.perSector.school?.servedKwh ?? 0
        );
      }
      // Same numbers as if the fire had never happened.
      const plain = simulate(base, 'proportional');
      const cleared = simulate(restored, 'proportional');
      expect(cleared.metrics.servedKwh).toBeCloseTo(plain.metrics.servedKwh, 9);
    });
  });
});
