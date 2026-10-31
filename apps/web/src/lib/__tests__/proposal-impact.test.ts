import { describe, it, expect } from 'vitest';
import { scenarios } from '@mitsinjo/engine';
import { proposalImpact } from '../proposal-impact';

describe('proposalImpact', () => {
  const input = scenarios.baseline.input;

  it('cutting a sector lowers its served energy; untouched sectors are left out', () => {
    const { impact, afterResultId } = proposalImpact(input, 'proportional', {
      sectorCaps: [{ sector: 'market', maxKw: 0, fromHour: 0, toHour: 24 }],
    });
    expect(afterResultId).toBeTruthy();
    expect(impact.sectors.market?.servedKwhAfter).toBe(0);
    expect(impact.sectors.market?.servedKwhDelta).toBeLessThan(0);
    for (const s of Object.values(impact.sectors)) {
      expect(s && (s.servedKwhDelta !== 0 || s.offHoursAfter !== s.offHoursBefore)).toBe(true);
    }
  });

  it('no change → no sector rows, same before and after', () => {
    const { impact } = proposalImpact(input, 'balanced');
    expect(impact.sectors).toEqual({});
    expect(impact.unservedKwhAfter).toBe(impact.unservedKwhBefore);
  });

  it('rounds to 2 decimals', () => {
    const { impact } = proposalImpact(input, 'proportional', { solarDropPct: 37 });
    for (const v of [impact.socMinPctAfter, impact.unservedKwhAfter]) {
      expect(Math.round(v * 100) / 100).toBe(v);
    }
  });
});
