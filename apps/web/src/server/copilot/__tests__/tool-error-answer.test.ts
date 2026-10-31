import { describe, it, expect } from 'vitest';
import { toolErrorAnswer, toolErrorKind } from '../providers/mock';

describe('toolErrorAnswer (offline copilot, tool failures)', () => {
  it('classifies failures from the tool error text', () => {
    expect(
      toolErrorKind('propose_change', 'Invalid args for propose_change: args: At least one…')
    ).toBe('unclear_change');
    expect(
      toolErrorKind(
        'run_scenario',
        'Invalid args for run_scenario: solarDropPct: Number must be less than or equal to 90'
      )
    ).toBe('out_of_bounds');
    expect(toolErrorKind('propose_change', 'Failed to apply patch: bad hour')).toBe(
      'out_of_bounds'
    );
    expect(
      toolErrorKind(
        'get_sector_metrics',
        'Invalid args for get_sector_metrics: sector: Invalid enum'
      )
    ).toBe('other');
  });

  it.each([
    ['en', 'What happened', 'I did not understand which change to make'],
    ['fr', "Ce qui s'est passé", "Je n'ai pas compris quel changement appliquer"],
    ['mg', 'Inona no nitranga', 'Tsy azoko hoe inona no fanovana tianao'],
  ] as const)('answers in %s with the four sections and no raw error', (lang, heading, line) => {
    const raw =
      'Invalid args for propose_change: args: At least one of patch or strategy must be specified.';
    const text = toolErrorAnswer('propose_change', raw, lang);
    expect(text).toContain(`### ${heading}`);
    expect(text).toContain(line);
    expect(text.match(/^### /gm)).toHaveLength(4);
    expect(text).not.toContain('Invalid args');
    expect(text).not.toMatch(/solar drop|baisse solaire/i);
  });
});
