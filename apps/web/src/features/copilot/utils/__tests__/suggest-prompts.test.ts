import { describe, it, expect } from 'vitest';
import { suggestPrompts, FALLBACK_STATIC_PROMPTS } from '../suggest-prompts';
import { scenarios } from '@mitsinjo/engine';
import { simulate } from '@mitsinjo/engine';

describe('suggestPrompts (P6-T10)', () => {
  it('returns static fallback list of 6 prompts when result is null or undefined', () => {
    const nullRes = suggestPrompts();
    expect(nullRes).toEqual(FALLBACK_STATIC_PROMPTS);
    expect(nullRes.length).toBe(6);

    const undefRes = suggestPrompts({ result: undefined });
    expect(undefRes).toEqual(FALLBACK_STATIC_PROMPTS);
  });

  it('suggests strategy switch and affected sector prompt when critical unserved load exists', () => {
    const stress = scenarios.essential_stress.input;
    const result = simulate(stress, 'proportional');

    const prompts = suggestPrompts({
      result,
      activeStrategy: 'proportional',
    });

    expect(prompts.length).toBeLessThanOrEqual(6);
    expect(prompts.length).toBeGreaterThan(0);

    const switchPrompt = prompts.find((p) => p.key === 'promptSwitchStrategy');
    expect(switchPrompt).toBeDefined();
    expect(switchPrompt?.params?.strategy).toBe('essential_first');

    const sectorPrompt = prompts.find((p) => p.key === 'promptWhySector');
    if (result.metrics.affectedSectors.length > 0) {
      expect(sectorPrompt).toBeDefined();
      expect(sectorPrompt?.params?.sector).toBe(result.metrics.affectedSectors[0]);
    }
  });

  it('does not suggest switching to essential_first if active strategy is already essential_first', () => {
    const stress = scenarios.essential_stress.input;
    const result = simulate(stress, 'essential_first');

    const prompts = suggestPrompts({
      result,
      activeStrategy: 'essential_first',
    });

    const switchPrompt = prompts.find((p) => p.key === 'promptSwitchStrategy');
    expect(switchPrompt).toBeUndefined();
    expect(prompts.length).toBeLessThanOrEqual(6);
  });

  it('includes warning deficit hours when warnings are present with hour ranges', () => {
    const stress = scenarios.essential_stress.input;
    const result = simulate(stress, 'proportional');

    const prompts = suggestPrompts({
      result,
      activeStrategy: 'proportional',
    });

    if (result.warnings.length > 0 && typeof result.warnings[0]?.fromHour === 'number') {
      const hoursPrompt = prompts.find((p) => p.key === 'promptDeficitHours');
      expect(hoursPrompt).toBeDefined();
      expect(hoursPrompt?.params?.hours).toBeDefined();
    }
  });

  it('always enforces a maximum of 6 prompts', () => {
    const baseline = scenarios.baseline.input;
    const result = simulate(baseline, 'proportional');

    const prompts = suggestPrompts({
      result,
      activeStrategy: 'proportional',
    });

    expect(prompts.length).toBeLessThanOrEqual(6);
  });

  it('never asks about a deficit when the only timed warning is curtailment', () => {
    const result = simulate(scenarios.baseline.input, 'proportional');
    const curtailOnly = {
      ...result,
      metrics: { ...result.metrics, unservedKwh: 0, criticalUnservedKwh: 0 },
      warnings: [{ code: 'CURTAILMENT' as const, fromHour: 11, toHour: 14 }],
    };
    const prompts = suggestPrompts({ result: curtailOnly });
    expect(prompts.find((p) => p.key === 'promptDeficitHours')).toBeUndefined();
  });
});
