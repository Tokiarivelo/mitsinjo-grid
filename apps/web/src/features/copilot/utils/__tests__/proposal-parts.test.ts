import { describe, it, expect } from 'vitest';
import type { Appliance, InputPatch } from '@mitsinjo/engine';
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

describe('appliance lines (PV-T11b)', () => {
  const pump: Appliance = {
    id: 'a1',
    name: 'Pump',
    category: 'water_pump',
    sector: 'water',
    watts: 750,
    quantity: 1,
  };
  const lamp: Appliance = {
    id: 'a2',
    name: 'Lamp',
    category: 'lamp',
    sector: 'households',
    watts: 10,
    quantity: 2,
  };
  const tv: Appliance = {
    id: 'a3',
    name: 'TV',
    category: 'tv',
    sector: 'households',
    watts: 80,
    quantity: 1,
  };
  const current = [pump, lamp];

  it('ids list edits and adds in patch order, then removals; unchanged lines hidden', () => {
    const proposal = { patch: { appliances: [{ ...pump, watts: 900 }, lamp, tv] } };
    // Lamp is unchanged → no row; tv is new; nothing removed.
    expect(proposalPartIds(proposal, current)).toEqual(['appliances.a1', 'appliances.a3']);
    expect(proposalPartIds({ patch: { appliances: [lamp] } }, current)).toEqual(['appliances.a1']);
    expect(proposalPartIds({ patch: { appliances: [] } }, current)).toEqual([
      'appliances.a1',
      'appliances.a2',
    ]);
    expect(proposalPartIds({ patch: {} }, current)).toEqual([]);
  });

  it('all checked → the same list; none checked → no appliance change', () => {
    const proposal = { patch: { appliances: [{ ...pump, watts: 900 }, lamp] } };
    expect(pickProposal(proposal, ['appliances.a1'], current)).toEqual({
      patch: { appliances: [{ ...pump, watts: 900 }, lamp] },
    });
    expect(pickProposal(proposal, [], current)).toEqual({});
  });

  it('unchecked edits restore the current line, unchecked adds drop, removals restore', () => {
    // Edit pump + add tv, keep neither: the current list stands, so no patch at all.
    expect(
      pickProposal({ patch: { appliances: [{ ...pump, watts: 900 }, lamp, tv] } }, [], current)
    ).toEqual({});
    // Keep the edit only: tv dropped.
    expect(
      pickProposal(
        { patch: { appliances: [{ ...pump, watts: 900 }, lamp, tv] } },
        ['appliances.a1'],
        current
      )
    ).toEqual({ patch: { appliances: [{ ...pump, watts: 900 }, lamp] } });
    // Removal stands when checked, restored when not.
    expect(pickProposal({ patch: { appliances: [lamp] } }, ['appliances.a1'], current)).toEqual({
      patch: { appliances: [lamp] },
    });
    expect(pickProposal({ patch: { appliances: [lamp] } }, [], current)).toEqual({});
  });
});

describe('clearFires lines (M2-T4)', () => {
  const fireProposal: { patch: InputPatch } = { patch: { clearFires: ['school', 'market'] } };

  it('ids list one restore line per sector, after sectorLoads', () => {
    expect(
      proposalPartIds({
        patch: { sectorLoads: { water: 0.5 }, clearFires: ['school'] },
        strategy: undefined,
      })
    ).toEqual(['sectorLoads.water', 'clearFires.school']);
  });

  it('all checked → the same patch; unchecked sectors dropped', () => {
    expect(pickProposal(fireProposal, ['clearFires.school', 'clearFires.market'])).toEqual(
      fireProposal
    );
    expect(pickProposal(fireProposal, ['clearFires.market'])).toEqual({
      patch: { clearFires: ['market'] },
    });
    expect(pickProposal(fireProposal, [])).toEqual({});
  });
});
