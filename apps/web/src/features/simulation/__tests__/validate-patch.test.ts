import { describe, expect, it } from 'vitest';
import { scenarios } from '@mitsinjo/engine';
import { validatePatch } from '../utils/validate-patch';

const input = scenarios.cloudy_afternoon.input;

describe('validatePatch', () => {
  it('accepts a valid patch', () => {
    expect(validatePatch('demandMultiplier', { demandMultiplier: 1.4 }, input)).toBeNull();
  });

  it('flags out-of-range values from the Zod schema', () => {
    expect(validatePatch('demandMultiplier', { demandMultiplier: 3 }, input)).toEqual({
      key: 'outOfRange',
    });
  });

  it('flags a solar drop that runs past the 24h horizon', () => {
    expect(validatePatch('dropStartHour', { dropStartHour: 23, dropDurationH: 3 }, input)).toEqual({
      key: 'dropExceedsHorizon',
    });
  });

  it('flags initial SoC at or below the reserve minimum', () => {
    const min = input.battery.minSocPct;
    expect(validatePatch('initialSocPct', { initialSocPct: min }, input)).toEqual({
      key: 'initialBelowMinSoc',
      params: { min },
    });
  });

  it('flags invalid sectorCaps with outOfRange (PY-T2)', () => {
    expect(
      validatePatch(
        'sectorCaps',
        {
          sectorCaps: [
            {
              sector: 'market',
              maxKw: -2,
              fromHour: 18,
              toHour: 22,
            },
          ],
        },
        input
      )
    ).toEqual({ key: 'outOfRange' });
  });

  it('accepts valid sectorCaps and priorities (PY-T2)', () => {
    expect(
      validatePatch(
        'sectorCaps',
        {
          sectorCaps: [
            {
              sector: 'market',
              maxKw: 1.5,
              fromHour: 18,
              toHour: 22,
            },
          ],
        },
        input
      )
    ).toBeNull();

    expect(
      validatePatch('priorities', { priorities: { water: 'critical' } }, input)
    ).toBeNull();
  });
});
