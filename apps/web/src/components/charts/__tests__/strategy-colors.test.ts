import { describe, expect, it } from 'vitest';
import { STRATEGY_COLORS } from '../strategy-colors';

describe('STRATEGY_COLORS', () => {
  it('maps every strategy to a distinct theme token (no raw hex)', () => {
    const colors = Object.values(STRATEGY_COLORS);
    expect(colors).toHaveLength(3);
    expect(new Set(colors).size).toBe(3);
    for (const c of colors) expect(c).toMatch(/^var\(--color-[a-z-]+\)$/);
  });
});
