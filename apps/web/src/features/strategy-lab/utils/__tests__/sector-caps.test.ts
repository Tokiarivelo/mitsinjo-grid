import { describe, expect, it } from 'vitest';
import type { SectorCap } from '@mitsinjo/engine';
import { DEFAULT_CAP, validateSectorCap, withSectorCap } from '../sector-caps';

describe('sector caps helpers (PZ-T2)', () => {
  it('validates caps against the engine schema', () => {
    expect(validateSectorCap({ sector: 'market', ...DEFAULT_CAP })).toBeNull();
    expect(validateSectorCap({ sector: 'market', maxKw: 1, fromHour: 20, toHour: 18 })).toBe(
      'capHoursOrder'
    );
    expect(validateSectorCap({ sector: 'market', maxKw: -1, fromHour: 18, toHour: 22 })).toBe(
      'outOfRange'
    );
    expect(validateSectorCap({ sector: 'market', maxKw: 1, fromHour: 18, toHour: 25 })).toBe(
      'outOfRange'
    );
  });

  it('replaces only the target sector cap and never mutates the input', () => {
    const caps: SectorCap[] = [
      { sector: 'market', maxKw: 1, fromHour: 18, toHour: 22 },
      { sector: 'school', maxKw: 0.5, fromHour: 8, toHour: 12 },
    ];
    const next = withSectorCap(caps, 'market', { maxKw: 2, fromHour: 17, toHour: 21 });

    expect(next).toEqual([
      { sector: 'school', maxKw: 0.5, fromHour: 8, toHour: 12 },
      { sector: 'market', maxKw: 2, fromHour: 17, toHour: 21 },
    ]);
    expect(caps[0]!.maxKw).toBe(1);
  });

  it('removes a sector cap with null and handles missing caps', () => {
    expect(
      withSectorCap([{ sector: 'market', maxKw: 1, fromHour: 18, toHour: 22 }], 'market', null)
    ).toEqual([]);
    expect(withSectorCap(undefined, 'health', DEFAULT_CAP)).toEqual([
      { sector: 'health', ...DEFAULT_CAP },
    ]);
  });
});
