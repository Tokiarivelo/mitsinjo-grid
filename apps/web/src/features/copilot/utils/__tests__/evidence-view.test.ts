import { describe, it, expect } from 'vitest';
import { evidenceView } from '../evidence-view';

const grid = {
  resultId: 'SIM-1',
  fields: {
    servedKwh: 125.9,
    socMinPct: 46.35,
    solarPeakKw: 40,
    batteryCapacityKwh: 120,
    peakSolarHour: 12,
    lowestSocPct: 46.35,
    lowestSocHour: 8,
    peakDemandKw: 8.7,
  },
};
const households = { resultId: 'SIM-1', fields: { households_servedKwh: 48 } };
const compare = { resultId: 'SIM-1', fields: { proportional_servedKwh: 125.9 } };

describe('evidenceView', () => {
  it('shows only the last table and folds the earlier lookups', () => {
    const view = evidenceView([grid, households, compare], false);
    expect(view.shown).toEqual([compare]);
    expect(view.folded.map((e) => Object.keys(e.fields)[0])).toEqual([
      'servedKwh',
      'households_servedKwh',
    ]);
  });

  it('drops fixed settings, bare hours and the duplicate lowest SoC', () => {
    const [only] = evidenceView([grid], false).shown;
    expect(only?.fields).toEqual({ servedKwh: 125.9, socMinPct: 46.35, peakDemandKw: 8.7 });
  });

  it('with a proposal, every table is folded (its card shows the engine impact)', () => {
    const view = evidenceView([grid, households], true);
    expect(view.shown).toEqual([]);
    expect(view.folded).toHaveLength(2);
  });

  it('drops tables left empty and handles no evidence', () => {
    expect(evidenceView([{ resultId: 'X', fields: { solarPeakKw: 40 } }], false)).toEqual({
      shown: [],
      folded: [],
    });
    expect(evidenceView(undefined, false)).toEqual({ shown: [], folded: [] });
  });
});
