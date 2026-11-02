import { describe, expect, it } from 'vitest';
import { createBaselineInput } from '../scenarios/baseline';
import { GeneratedScenarioSchema, type GeneratedAssertion } from '../scenarios/generated-schema';
import { GENERATED_FILES } from '../scenarios/generated';
import { simulate } from '../simulate';
import { SimulationInputSchema, type StrategyId } from '../schemas';

const FILES = GENERATED_FILES;

const ALL_STRATEGIES: readonly StrategyId[] = ['proportional', 'essential_first', 'balanced'];

function checkOp(actual: number, op: GeneratedAssertion['op'], value: number): boolean {
  switch (op) {
    case 'eq':
      return actual === value;
    case 'gt':
      return actual > value;
    case 'gte':
      return actual >= value;
    case 'lt':
      return actual < value;
    case 'lte':
      return actual <= value;
  }
}

describe('Generated scenarios (M12-T2, D1)', () => {
  const entries = Object.entries(FILES);
  it('has at least one generated scenario', () => {
    expect(entries.length).toBeGreaterThan(0);
  });

  for (const [path, mod] of entries) {
    const parsed = GeneratedScenarioSchema.parse(mod);
    describe(`Scenario: ${parsed.id} (${path})`, () => {
      for (const strat of ALL_STRATEGIES) {
        it(`runs with ${strat} with 0 invariant violations`, () => {
          const input = createBaselineInput();
          input.events = parsed.events;
          if (parsed.battery) Object.assign(input.battery, parsed.battery);
          SimulationInputSchema.parse(input);
          const sim = simulate(input, strat);
          expect(sim.metrics.violations).toBe(0);
          expect(sim.steps).toHaveLength(24);
        });
      }

      for (const [idx, assertion] of parsed.assertions.entries()) {
        it(`assertion ${idx}: ${assertion.strategy}.${assertion.metric} ${assertion.op} ${assertion.value}`, () => {
          const input = createBaselineInput();
          input.events = parsed.events;
          if (parsed.battery) Object.assign(input.battery, parsed.battery);
          const sim = simulate(input, assertion.strategy);
          const actual = sim.metrics[assertion.metric];
          expect(
            checkOp(actual, assertion.op, assertion.value),
            `${assertion.metric} = ${actual}, expected ${assertion.op} ${assertion.value}`
          ).toBe(true);
        });
      }
    });
  }
});
