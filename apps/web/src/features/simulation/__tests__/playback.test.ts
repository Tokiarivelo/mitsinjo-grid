import { describe, expect, it } from 'vitest';
import { primaryPlaybackAction, simStatusBadgeVariant } from '../utils/playback';

describe('playback utils', () => {
  it.each([
    ['running', false, false, 'loading'],
    ['complete', true, true, 'pause'],
    ['ready', false, false, 'run'],
    ['modified', false, true, 'run'],
    ['complete', false, true, 'play'],
  ] as const)('primary action for %s / playing=%s / results=%s → %s', (s, p, r, want) => {
    expect(primaryPlaybackAction(s, p, r)).toBe(want);
  });

  it.each([
    ['modified', true, 'warning'],
    ['error', false, 'error'],
    ['complete', true, 'running'],
    ['running', false, 'running'],
    ['complete', false, 'complete'],
    ['ready', false, 'ready'],
  ] as const)('badge for %s / playing=%s → %s', (s, p, want) => {
    expect(simStatusBadgeVariant(s, p)).toBe(want);
  });
});
