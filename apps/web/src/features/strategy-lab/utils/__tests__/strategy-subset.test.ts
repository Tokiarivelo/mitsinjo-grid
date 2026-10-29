import { describe, expect, it } from 'vitest';
import type { StrategyId } from '@mitsinjo/engine';
import { activeWithinSubset, toggleStrategySubset } from '../strategy-subset';

const ALL: StrategyId[] = ['proportional', 'essential_first', 'balanced'];

describe('toggleStrategySubset', () => {
  it('removes a strategy when more than the minimum remain', () => {
    expect(toggleStrategySubset(ALL, 'balanced')).toEqual(['proportional', 'essential_first']);
  });

  it('refuses to go below 2 strategies and returns the same array', () => {
    const two: StrategyId[] = ['proportional', 'balanced'];
    expect(toggleStrategySubset(two, 'balanced')).toBe(two);
  });

  it('adds a missing strategy without mutating the input', () => {
    const two: StrategyId[] = ['proportional', 'balanced'];
    expect(toggleStrategySubset(two, 'essential_first')).toEqual([
      'proportional',
      'balanced',
      'essential_first',
    ]);
    expect(two).toHaveLength(2);
  });
});

describe('activeWithinSubset', () => {
  it('keeps the active strategy when it is still compared', () => {
    expect(activeWithinSubset('balanced', ALL)).toBe('balanced');
  });

  it('falls back to the first compared strategy when the active one was excluded', () => {
    expect(activeWithinSubset('proportional', ['essential_first', 'balanced'])).toBe(
      'essential_first'
    );
  });
});
