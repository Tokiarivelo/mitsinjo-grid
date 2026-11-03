import { describe, it, expect } from 'vitest';
import { suggestPrompts, MAX_PROMPTS } from '../suggest-prompts';
import { scenarios } from '@mitsinjo/engine';
import { simulate } from '@mitsinjo/engine';

describe('suggestPrompts (P6-T10)', () => {
  it('no simulation yet → no question (the UI asks for a run instead of a fixed list)', () => {
    expect(suggestPrompts()).toEqual([]);
    expect(suggestPrompts({ result: undefined })).toEqual([]);
    expect(suggestPrompts({ result: null, fires: [] })).toEqual([]);
  });

  it('a calm day gets what-if questions built on its own numbers', () => {
    const result = simulate(scenarios.baseline.input, 'proportional');
    const prompts = suggestPrompts({ result, input: scenarios.baseline.input });
    expect(prompts[0]).toEqual({
      key: 'promptBatteryEnd',
      params: { pct: Math.round(result.metrics.socEndPct) },
    });
    expect(prompts.map((p) => p.key)).toContain('promptSolarDrop40');
    expect(prompts.map((p) => p.key)).not.toContain('promptUnmetDemand');
    expect(prompts.length).toBeLessThanOrEqual(MAX_PROMPTS);
  });

  it('the scenario events give their own questions (solar drop with its %, hours)', () => {
    const { input } = scenarios.cloudy_afternoon;
    const result = simulate(input, 'proportional');
    const prompts = suggestPrompts({ result, input });
    expect(prompts).toContainEqual({
      key: 'promptSolarDropEvent',
      params: { pct: 40, from: 13, to: 15 },
    });
    expect(prompts.map((p) => p.key)).not.toContain('promptBatteryEnd');
  });

  it('village_fire before 14 h: one incident question per scripted fire', () => {
    const { input } = scenarios.village_fire;
    const result = simulate(input, 'proportional');
    const prompts = suggestPrompts({ result, input });
    expect(prompts.slice(0, 2)).toEqual([
      { key: 'promptFireScripted', params: { sector: 'market', hour: 14 }, tone: 'incident' },
      { key: 'promptFireScripted', params: { sector: 'water', hour: 15 }, tone: 'incident' },
    ]);
  });

  it('village_fire while the market burns: its live questions replace its scripted one', () => {
    const { input } = scenarios.village_fire;
    const result = simulate(input, 'proportional');
    const prompts = suggestPrompts({ result, input, fires: ['market'] });
    expect(prompts[0]).toMatchObject({ key: 'promptFireImpact', params: { sector: 'market' } });
    expect(
      prompts.find((p) => p.key === 'promptFireScripted' && p.params?.sector === 'market')
    ).toBeUndefined();
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

  it('a fire burning now puts its four questions first, then one per other burning sector (M2)', () => {
    const result = simulate(scenarios.baseline.input, 'proportional');
    const prompts = suggestPrompts({ result, fires: ['water', 'school'] });
    expect(prompts.slice(0, 5)).toEqual([
      { key: 'promptFireImpact', params: { sector: 'water' }, tone: 'incident' },
      { key: 'promptFireEssential', params: { sector: 'water' }, tone: 'incident' },
      { key: 'promptFireEnergy', params: { sector: 'water' }, tone: 'incident' },
      { key: 'promptFireRestore', params: { sector: 'water' }, tone: 'incident' },
      { key: 'promptFireImpact', params: { sector: 'school' }, tone: 'incident' },
    ]);
    // A calm baseline adds nothing once the incident fills the list.
    expect(prompts).toHaveLength(5);
  });

  it('fire questions also show before any result, and only them', () => {
    const prompts = suggestPrompts({ fires: ['health'] });
    expect(prompts).toHaveLength(4);
    expect(prompts.every((p) => p.tone === 'incident')).toBe(true);
  });

  it('generates promptWhyDispatchAction with sector, and promptWhyDispatchActionNoSector without sector', () => {
    const withSector = suggestPrompts({
      dispatchLog: [
        {
          id: '1',
          day: 0,
          hour: 14,
          mode: 'autonomous',
          origin: 'ai',
          hash: 'h1',
          action: { kind: 'isolate_sector', sector: 'market', answers: 'fire' },
        },
      ],
    });
    expect(withSector[0]).toEqual({
      key: 'promptWhyDispatchAction',
      params: { hour: 14, action: 'isolate_sector', sector: 'market' },
      tone: 'incident',
    });

    const withoutSector = suggestPrompts({
      dispatchLog: [
        {
          id: '2',
          day: 0,
          hour: 18,
          mode: 'autonomous',
          origin: 'ai',
          hash: 'h2',
          action: { kind: 'switch_strategy', strategy: 'essential_first', answers: 'reserve_low' },
        },
      ],
    });
    expect(withoutSector[0]).toEqual({
      key: 'promptWhyDispatchActionNoSector',
      params: { hour: 18, action: 'switch_strategy' },
      tone: 'incident',
    });
  });
});
