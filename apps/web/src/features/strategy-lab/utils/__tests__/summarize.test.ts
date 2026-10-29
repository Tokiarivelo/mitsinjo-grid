import { describe, expect, it } from 'vitest';
import { compare, scenarios } from '@mitsinjo/engine';
import { bestMetricsFor, bestStrategies, summarizeComparison } from '../summarize';

describe('summarizeComparison rule engine (P4-T5, P4-T7)', () => {
  it('returns null when comparison is missing or incomplete', () => {
    expect(summarizeComparison({})).toBeNull();
    expect(
      summarizeComparison({
        proportional: compare(scenarios.baseline.input, ['proportional']).proportional,
      })
    ).toBeNull();
  });

  it('generates nominal summary on baseline scenario with 0 unserved energy', () => {
    const comp = compare(scenarios.baseline.input, ['proportional', 'essential_first']);
    const summary = summarizeComparison(comp);

    expect(summary).not.toBeNull();
    expect(summary?.titleKey).toBe('summaryNominalTitle');
    expect(summary?.descriptionKey).toBe('summaryNominalDesc');
    expect(summary?.evidenceRef).toContain('unservedKwh=0.0');
    // Every strategy ties on baseline: no metric gets a best-value badge
    expect(summary?.bestEssentialCoverage).toEqual([]);
    expect(summary?.bestDelivered).toEqual([]);
  });

  it('generates hero summary on cloudy_afternoon deficit recommending essential_first', () => {
    const comp = compare(scenarios.cloudy_afternoon.input, [
      'proportional',
      'essential_first',
      'balanced',
    ]);
    const summary = summarizeComparison(comp);

    expect(summary).not.toBeNull();
    expect(summary?.recommendedStrategy).toBe('essential_first');
    expect(summary?.titleKey).toBe('summaryHeroTitle');
    expect(summary?.descriptionKey).toBe('summaryHeroDesc');
    expect(summary?.descriptionParams?.propUnserved).toBeDefined();
    // essential_first and balanced both serve 100 % critical: both get the badge, not proportional
    expect(summary?.bestEssentialCoverage).toEqual(['essential_first', 'balanced']);
  });

  it('stress summary recommends the strategy with the lowest critical unserved energy', () => {
    // On essential_stress, balanced has the lowest all-sector critical unserved kWh
    // (engine-spec §7: essential_first can be slightly lower here).
    const comp = compare(scenarios.essential_stress.input, [
      'proportional',
      'essential_first',
      'balanced',
    ]);
    const summary = summarizeComparison(comp);
    const lowest = (['proportional', 'essential_first', 'balanced'] as const).reduce((best, id) =>
      comp[id]!.metrics.criticalUnservedKwh < comp[best]!.metrics.criticalUnservedKwh ? id : best
    );

    expect(summary?.titleKey).toBe('summaryStressTitle');
    expect(summary?.recommendedStrategy).toBe(lowest);
    expect(summary?.bestEssentialCoverage).toEqual([summary?.recommendedStrategy]);
  });

  it('stress summary is not hardwired to essential_first', () => {
    const comp = compare(scenarios.essential_stress.input, ['proportional', 'essential_first']);
    // Swap results so essential_first carries the better critical-tier numbers.
    const swapped = {
      proportional: { ...comp.essential_first!, strategy: 'proportional' as const },
      essential_first: { ...comp.proportional!, strategy: 'essential_first' as const },
    };
    const original = summarizeComparison(comp);
    const flipped = summarizeComparison(swapped);

    expect(original?.recommendedStrategy).not.toBe(flipped?.recommendedStrategy);
    expect(flipped?.bestEssentialCoverage).toEqual([flipped?.recommendedStrategy]);
  });

  it('hero summary passes both critical unserved values as params (no hardcoded numbers)', () => {
    const comp = compare(scenarios.cloudy_afternoon.input, ['proportional', 'essential_first']);
    const summary = summarizeComparison(comp);

    expect(summary?.descriptionParams).toEqual({
      essUnserved: '0.0 kWh',
      propUnserved: expect.stringMatching(/kWh$/),
    });
  });

  it('bestStrategies returns every tied winner, and nothing when all strategies tie', () => {
    const comp = compare(scenarios.cloudy_afternoon.input, [
      'proportional',
      'essential_first',
      'balanced',
    ]);
    const ranked = (['proportional', 'essential_first', 'balanced'] as const).map((id) => ({
      id,
      res: comp[id]!,
    }));

    expect(bestStrategies(ranked, (m) => m.criticalUnservedKwh, 'min')).toEqual([
      'essential_first',
      'balanced',
    ]);
    // Total served is identical across strategies (they only redistribute): no winner
    expect(bestStrategies(ranked, (m) => m.servedKwh, 'max')).toEqual([]);
    expect(bestStrategies(ranked.slice(0, 1), (m) => m.servedKwh, 'max')).toEqual([]);
  });

  it('bestMetricsFor maps the summary to per-card badge flags', () => {
    const comp = compare(scenarios.cloudy_afternoon.input, [
      'proportional',
      'essential_first',
      'balanced',
    ]);
    const summary = summarizeComparison(comp);

    expect(bestMetricsFor(summary, 'essential_first')).toEqual({
      delivered: false,
      essential: true,
      unmet: false,
      soc: false,
    });
    expect(bestMetricsFor(summary, 'proportional').essential).toBe(false);
    expect(bestMetricsFor(null, 'balanced')).toEqual({
      delivered: false,
      essential: false,
      unmet: false,
      soc: false,
    });
  });

  it('handles strategy subset comparisons gracefully (PZ-T9)', () => {
    // Proportional + Balanced (missing essential_first)
    const compPropBal = compare(scenarios.cloudy_afternoon.input, ['proportional', 'balanced']);
    const summaryPropBal = summarizeComparison(compPropBal);
    expect(summaryPropBal).not.toBeNull();
    expect(summaryPropBal?.recommendedStrategy).toBe('balanced');
    expect(summaryPropBal?.bestEssentialCoverage).toEqual(['balanced']);

    // Essential-First + Balanced (missing proportional)
    const compEssBal = compare(scenarios.cloudy_afternoon.input, ['essential_first', 'balanced']);
    const summaryEssBal = summarizeComparison(compEssBal);
    expect(summaryEssBal).not.toBeNull();
    expect(['essential_first', 'balanced']).toContain(summaryEssBal?.recommendedStrategy);
  });
});
