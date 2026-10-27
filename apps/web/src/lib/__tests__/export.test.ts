import { describe, expect, it } from 'vitest';
import { compare, scenarios } from '@mitsinjo/engine';
import { createTranslator } from 'next-intl';
import en from '@/messages/en.json';
import fr from '@/messages/fr.json';
import { buildExportData, generateSummaryMarkdown, type Translate } from '../export';

const makeT = (locale: string, messages: Record<string, unknown>): Translate => {
  const t = createTranslator({ locale, messages });
  return (key, values) => t(key as never, values as never);
};
const tEn = makeT('en', en);
const tFr = makeT('fr', fr);

describe('export utilities (P5-T4, P5-T6)', () => {
  const baselineInput = scenarios.baseline.input;
  const cloudyInput = scenarios.cloudy_afternoon.input;

  it('builds JSON export data with result IDs, inputs, and metrics', () => {
    const comparison = compare(cloudyInput, ['proportional', 'essential_first']);
    const proportionalRes = comparison.proportional!;

    const exportData = buildExportData(
      cloudyInput,
      proportionalRes,
      comparison,
      'proportional'
    );

    expect(exportData.scenarioId).toBe('cloudy_afternoon');
    expect(exportData.activeStrategy).toBe('proportional');
    expect(exportData.resultId).toBe(proportionalRes.id);
    expect(exportData.resultId).toMatch(/^SIM-/);
    expect(exportData.resultIds.proportional).toBe(proportionalRes.id);
    expect(exportData.resultIds.essential_first).toBe(comparison.essential_first?.id);
    expect(exportData.metrics).toBeDefined();
    expect(exportData.metrics?.servedKwh).toBe(proportionalRes.metrics.servedKwh);
    expect(exportData.comparisonSummary).toBeDefined();
    expect(exportData.comparisonSummary?.proportional?.resultId).toBe(proportionalRes.id);
    expect(exportData.input.scenarioId).toBe('cloudy_afternoon');
  });

  it('generates human-readable Markdown summary containing resultId and scenario name', () => {
    const comparison = compare(cloudyInput, ['proportional', 'essential_first']);
    const proportionalRes = comparison.proportional!;

    const markdown = generateSummaryMarkdown(
      tEn,
      cloudyInput,
      proportionalRes,
      comparison,
      'proportional'
    );

    expect(markdown).toContain('# Mitsinjo Grid — Simulation Summary');
    expect(markdown).toContain('**Scenario:** Cloudy Afternoon (-40%) (cloudy_afternoon)');
    expect(markdown).toContain(`**Result ID:** ${proportionalRes.id}`);
    expect(markdown).toContain('SYNTHETIC SIMULATION');
    expect(markdown).toContain('Total demand:');
    expect(markdown).toContain('Served energy:');
    const servedPct = (proportionalRes.metrics.servedKwh / proportionalRes.metrics.demandKwh) * 100;
    expect(markdown).toContain(`(${servedPct.toFixed(1)}%)`);
    expect(markdown).toContain('Health Clinic');
    expect(markdown).toContain('Water Pumping Station');
    expect(markdown).toContain('## Strategy comparison');
    expect(markdown).toContain(comparison.essential_first!.id);
  });

  it('handles unsimulated input cleanly', () => {
    const exportData = buildExportData(baselineInput, undefined, undefined, 'proportional');
    expect(exportData.resultId).toBeNull();
    expect(exportData.metrics).toBeNull();

    const markdown = generateSummaryMarkdown(tEn, baselineInput, undefined, undefined, 'proportional');
    expect(markdown).toContain('**Result ID:** N/A (not simulated)');
    expect(markdown).toContain('(baseline)');
  });

  it('follows the caller locale (French)', () => {
    const comparison = compare(cloudyInput, ['proportional', 'essential_first']);
    const markdown = generateSummaryMarkdown(tFr, cloudyInput, comparison.proportional, comparison, 'proportional');
    expect(markdown).toContain('# Mitsinjo Grid — Résumé de simulation');
    expect(markdown).toContain('SIMULATION SYNTHÉTIQUE');
    expect(markdown).not.toContain('Total demand');
  });
});
