import { describe, expect, it } from 'vitest';
import { WEATHER_SOLAR_FACTOR } from '../constants';
import { simulate } from '../simulate';
import { createBaselineInput, createCloudyAfternoonInput } from '../scenarios';
import { MAX_WORKFLOW_DAYS, WEATHER_IDS, WorkflowSchema } from '../schemas';
import { applyWeather, compareWorkflow, simulateWorkflow } from '../workflow';

describe('applyWeather', () => {
  it('scales the solar profile by the weather factor without mutating the input', () => {
    const input = createBaselineInput();
    const before = structuredClone(input);
    const cloudy = applyWeather(input, 'cloudy');

    expect(input).toEqual(before);
    cloudy.solar.profile.forEach((f, h) => {
      expect(f).toBeCloseTo((input.solar.profile[h] ?? 0) * WEATHER_SOLAR_FACTOR.cloudy, 12);
    });
  });

  it('sunny keeps the clear-sky profile', () => {
    const input = createBaselineInput();
    expect(applyWeather(input, 'sunny').solar.profile).toEqual(input.solar.profile);
  });

  it('keeps scenario events', () => {
    const input = createCloudyAfternoonInput();
    expect(applyWeather(input, 'rainy').events).toEqual(input.events);
  });

  it('orders weather presets from brightest to darkest', () => {
    const factors = WEATHER_IDS.map((w) => WEATHER_SOLAR_FACTOR[w]);
    expect([...factors].sort((a, b) => b - a)).toEqual(factors);
    factors.forEach((f) => {
      expect(f).toBeGreaterThan(0);
      expect(f).toBeLessThanOrEqual(1);
    });
  });
});

describe('simulateWorkflow', () => {
  it('a single sunny day equals the plain 24 h simulation', () => {
    const input = createBaselineInput();
    const wf = simulateWorkflow(input, [{ weather: 'sunny' }], 'proportional');
    expect(wf.days).toHaveLength(1);
    expect(wf.days[0]!.result).toEqual(simulate(input, 'proportional'));
  });

  it('carries battery SoC from one day to the next', () => {
    const input = createBaselineInput();
    const wf = simulateWorkflow(
      input,
      [{ weather: 'sunny' }, { weather: 'cloudy' }, { weather: 'rainy' }],
      'essential_first'
    );
    expect(wf.days.map((d) => d.weather)).toEqual(['sunny', 'cloudy', 'rainy']);
    expect(wf.days[0]!.result.metrics.socStartPct).toBe(input.battery.initialSocPct);
    for (let d = 1; d < wf.days.length; d++) {
      expect(wf.days[d]!.result.metrics.socStartPct).toBe(wf.days[d - 1]!.result.metrics.socEndPct);
    }
  });

  it('darker weather produces less solar and more unserved energy', () => {
    const input = createBaselineInput();
    const wf = simulateWorkflow(
      input,
      [{ weather: 'sunny' }, { weather: 'storm' }],
      'proportional'
    );
    const [sunny, storm] = wf.days.map((d) => d.result.metrics);
    expect(storm!.solarKwh).toBeLessThan(sunny!.solarKwh);
    expect(storm!.unservedKwh).toBeGreaterThan(sunny!.unservedKwh);
  });

  it('totals sum the daily metrics', () => {
    const input = createBaselineInput();
    const wf = simulateWorkflow(
      input,
      [{ weather: 'partly_cloudy' }, { weather: 'rainy' }, { weather: 'sunny' }],
      'balanced'
    );
    const sum = (k: 'demandKwh' | 'servedKwh' | 'unservedKwh' | 'solarKwh') =>
      wf.days.reduce((acc, d) => acc + d.result.metrics[k], 0);

    expect(wf.totals.demandKwh).toBeCloseTo(sum('demandKwh'), 9);
    expect(wf.totals.servedKwh).toBeCloseTo(sum('servedKwh'), 9);
    expect(wf.totals.unservedKwh).toBeCloseTo(sum('unservedKwh'), 9);
    expect(wf.totals.solarKwh).toBeCloseTo(sum('solarKwh'), 9);
    expect(wf.totals.socStartPct).toBe(input.battery.initialSocPct);
    expect(wf.totals.socEndPct).toBe(wf.days[2]!.result.metrics.socEndPct);
    expect(wf.totals.socMinPct).toBe(Math.min(...wf.days.map((d) => d.result.metrics.socMinPct)));
    expect(wf.totals.violations).toBe(0);
  });

  it('survives a battery drained to its reserve (no invariant violations)', () => {
    const input = createBaselineInput();
    const wf = simulateWorkflow(
      input,
      Array.from({ length: MAX_WORKFLOW_DAYS }, () => ({ weather: 'storm' as const })),
      'essential_first'
    );
    expect(wf.days).toHaveLength(MAX_WORKFLOW_DAYS);
    expect(wf.totals.violations).toBe(0);
    expect(wf.totals.socMinPct).toBeGreaterThanOrEqual(input.battery.minSocPct - 1e-6);
  });

  it('is deterministic', () => {
    const input = createBaselineInput();
    const days = [{ weather: 'cloudy' as const }, { weather: 'sunny' as const }];
    expect(simulateWorkflow(input, days, 'balanced')).toEqual(
      simulateWorkflow(input, days, 'balanced')
    );
  });

  it('rejects empty or too long workflows', () => {
    const input = createBaselineInput();
    expect(() => simulateWorkflow(input, [], 'proportional')).toThrow();
    const tooLong = Array.from({ length: MAX_WORKFLOW_DAYS + 1 }, () => ({
      weather: 'sunny' as const,
    }));
    expect(() => simulateWorkflow(input, tooLong, 'proportional')).toThrow();
    expect(WorkflowSchema.safeParse([{ weather: 'snow' }]).success).toBe(false);
  });
});

describe('compareWorkflow', () => {
  it('runs all three strategies by default', () => {
    const out = compareWorkflow(createBaselineInput(), [{ weather: 'cloudy' }]);
    expect(Object.keys(out).sort()).toEqual(['balanced', 'essential_first', 'proportional']);
  });

  it('runs only the requested strategies', () => {
    const out = compareWorkflow(createBaselineInput(), [{ weather: 'cloudy' }], ['balanced']);
    expect(Object.keys(out)).toEqual(['balanced']);
    expect(out.balanced?.strategy).toBe('balanced');
  });

  it('essential_first protects the clinic at least as well as proportional over a dark week', () => {
    const days = [
      { weather: 'cloudy' as const },
      { weather: 'rainy' as const },
      { weather: 'storm' as const },
    ];
    const out = compareWorkflow(createBaselineInput(), days);
    expect(out.essential_first!.totals.criticalUnservedKwh).toBeLessThanOrEqual(
      out.proportional!.totals.criticalUnservedKwh + 1e-9
    );
  });
});
