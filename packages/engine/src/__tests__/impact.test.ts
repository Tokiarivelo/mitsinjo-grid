import { describe, expect, it } from 'vitest';
import { applyPatch } from '../patch';
import { createBaselineInput } from '../scenarios';
import { simulate } from '../simulate';
import { changeImpact, sectorOffHours } from '../metrics/impact';
import { ChangeImpactSchema } from '../schemas/impact';

describe('changeImpact (M1-T1)', () => {
  const input = createBaselineInput();
  const before = simulate(input, 'proportional');

  it('cutting the market 8–12 h gives it 4 more off hours and less served energy', () => {
    const patched = applyPatch(input, {
      sectorCaps: [{ sector: 'market', maxKw: 0, fromHour: 8, toHour: 12 }],
    });
    const after = simulate(patched, 'proportional');
    const impact = changeImpact(before, after);

    expect(ChangeImpactSchema.parse(impact)).toEqual(impact);
    const market = impact.sectors.market!;
    expect(market.offHoursAfter).toBeGreaterThan(market.offHoursBefore);
    expect(market.servedKwhAfter).toBeLessThan(market.servedKwhBefore);
    expect(market.servedKwhDelta).toBeCloseTo(market.servedKwhAfter - market.servedKwhBefore, 9);
    expect(impact.beforeResultId).toBe(before.id);
    expect(impact.afterResultId).toBe(after.id);
  });

  it('same result on both sides → zero deltas', () => {
    const impact = changeImpact(before, before);
    for (const s of Object.values(impact.sectors)) {
      expect(s.servedKwhDelta).toBe(0);
      expect(s.offHoursAfter).toBe(s.offHoursBefore);
    }
    expect(impact.socMinPctAfter).toBe(impact.socMinPctBefore);
  });

  it('a sector with no demand never counts as off', () => {
    // industry is not connected by default (load 0)
    expect(sectorOffHours(before, 'industry')).toBe(0);
  });
});
