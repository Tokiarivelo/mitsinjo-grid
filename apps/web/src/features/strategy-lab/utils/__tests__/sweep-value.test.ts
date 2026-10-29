import { describe, expect, it } from 'vitest';
import { fmtSweepValue } from '../sweep-value';

describe('fmtSweepValue', () => {
  it('formats the demand multiplier with ×', () => {
    expect(fmtSweepValue('demandMultiplier', 1.2)).toBe('1.2×');
  });

  it('formats percentage parameters as whole percents', () => {
    expect(fmtSweepValue('solarDropPct', 30)).toBe('30%');
    expect(fmtSweepValue('initialSocPct', 65)).toBe('65%');
  });
});
