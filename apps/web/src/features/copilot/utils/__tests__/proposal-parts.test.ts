import { describe, it, expect } from 'vitest';
import type { InputPatch } from '@mitsinjo/engine';
import { pickProposal, proposalPartIds } from '../proposal-parts';

const patch: InputPatch = {
  priorities: { school: 'high' },
  sectorCaps: [
    { sector: 'market', maxKw: 0, fromHour: 14, toHour: 24 },
    { sector: 'industry', maxKw: 0, fromHour: 14, toHour: 24 },
  ],
  solarDropPct: 40,
  dropStartHour: 12,
  dropDurationH: 3,
  lifeline: { enabled: true, kw: { households: 0.4 } },
  sectorLoads: { water: 0.5 },
  criticalShares: { school: 0.5 },
};
const proposal = { patch, strategy: 'essential_first' as const };

describe('proposalPartIds', () => {
  it('gives one id per dialog line, in display order', () => {
    expect(proposalPartIds(proposal)).toEqual([
      'strategy',
      'priorities.school',
      'sectorCaps.0',
      'sectorCaps.1',
      'solarDropPct',
      'dropWindow',
      'lifeline.enabled',
      'lifeline.kw.households',
      'sectorLoads.water',
    ]);
  });
});

describe('pickProposal (K3 partial approval)', () => {
  it('all ids → the same change', () => {
    expect(pickProposal(proposal, proposalPartIds(proposal))).toEqual(proposal);
  });

  it('keeps only the checked lines (and unlisted fields)', () => {
    expect(pickProposal(proposal, ['sectorCaps.1', 'lifeline.kw.households'])).toEqual({
      patch: {
        sectorCaps: [{ sector: 'industry', maxKw: 0, fromHour: 14, toHour: 24 }],
        lifeline: { kw: { households: 0.4 } },
        criticalShares: { school: 0.5 },
      },
    });
  });

  it('the drop window line carries both its fields; the strategy line only the strategy', () => {
    expect(pickProposal(proposal, ['dropWindow', 'strategy'])).toEqual({
      patch: { dropStartHour: 12, dropDurationH: 3, criticalShares: { school: 0.5 } },
      strategy: 'essential_first',
    });
  });

  it('nothing checked → nothing to apply', () => {
    expect(pickProposal({ patch: { solarDropPct: 10 } }, [])).toEqual({});
  });
});
