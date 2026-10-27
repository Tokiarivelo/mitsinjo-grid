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

  it('generates stress summary on severe deficit scenario', () => {
    const comp = compare(scenarios.essential_stress.input, [
      'proportional',
      'essential_first',
    ]);
    const summary = summarizeComparison(comp);

    expect(summary).not.toBeNull();
    expect(summary?.recommendedStrategy).toBe('essential_first');
    expect(summary?.titleKey).toBe('summaryStressTitle');
  });
});
