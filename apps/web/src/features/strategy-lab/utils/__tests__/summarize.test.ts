import { describe, expect, it } from 'vitest';
import { compare, scenarios } from '@mitsinjo/engine';
import { summarizeComparison } from '../summarize';

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
    expect(summary?.bestEssentialCoverage).toBeDefined();
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
    expect(summary?.bestEssentialCoverage).toBe('essential_first');
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
    expect(summary?.recommendedStrategy).toBe(summary?.bestEssentialCoverage);
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
    expect(flipped?.recommendedStrategy).toBe(flipped?.bestEssentialCoverage);
  });

  it('hero summary passes both critical unserved values as params (no hardcoded numbers)', () => {
    const comp = compare(scenarios.cloudy_afternoon.input, ['proportional', 'essential_first']);
    const summary = summarizeComparison(comp);

    expect(summary?.descriptionParams).toEqual({
      essUnserved: '0.0 kWh',
      propUnserved: expect.stringMatching(/kWh$/),
    });
  });
});
