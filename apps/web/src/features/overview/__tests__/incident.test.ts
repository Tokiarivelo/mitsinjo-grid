import { describe, expect, it } from 'vitest';
import { compare, scenarios } from '@mitsinjo/engine';
import { CRITICAL_SHORTFALL_KWH, summarizeIncident } from '../utils/incident';

describe('summarizeIncident', () => {
  it('returns null when the active strategy has no result', () => {
    expect(summarizeIncident({}, 'proportional')).toBeNull();
  });

  it('baseline: not at risk, no window', () => {
    const inc = summarizeIncident(compare(scenarios.baseline.input), 'proportional')!;
    expect(inc.atRisk).toBe(false);
    expect(inc.window).toBeNull();
    expect(inc.strategies).toHaveLength(3);
  });

  it('cloudy afternoon: proportional is at risk, essential-first is best', () => {
    const results = compare(scenarios.cloudy_afternoon.input);
    const inc = summarizeIncident(results, 'proportional')!;
    const metrics = results.proportional!.metrics;

    expect(inc.atRisk).toBe(true);
    expect(inc.shortfallKwh).toBe(metrics.criticalUnservedKwh);
    expect(inc.shortfallKwh).toBeGreaterThan(CRITICAL_SHORTFALL_KWH);
    expect(inc.unmetHours).toBe(metrics.criticalUnmetHours);

    const first = results
      .proportional!.warnings.filter((w) => w.code === 'CRITICAL_UNMET')
      .sort((a, b) => a.fromHour - b.fromHour)[0]!;
    expect(inc.window).toEqual({ fromHour: first.fromHour, toHour: first.toHour });

    expect(inc.best).toBe('essential_first');
    expect(inc.strategies.find((s) => s.id === 'essential_first')!.coveragePct).toBe(
      results.essential_first!.metrics.criticalCoveragePct
    );
  });

  it('only lists strategies that were run', () => {
    const results = compare(scenarios.cloudy_afternoon.input, ['proportional']);
    const inc = summarizeIncident(results, 'proportional')!;
    expect(inc.strategies.map((s) => s.id)).toEqual(['proportional']);
    expect(inc.best).toBe('proportional');
  });
});
