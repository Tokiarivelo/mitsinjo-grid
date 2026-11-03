// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { timeoutSignal } from '../abort';

const aborted = (s: AbortSignal) =>
  new Promise<void>((resolve) => s.addEventListener('abort', () => resolve()));

describe('timeoutSignal', () => {
  it('aborts a stalled call after the time limit', async () => {
    const s = timeoutSignal(20)!;
    expect(s.aborted).toBe(false);
    await aborted(s);
    expect(s.aborted).toBe(true);
  });

  it('still follows the caller signal', () => {
    const c = new AbortController();
    const s = timeoutSignal(60_000, c.signal)!;
    c.abort();
    expect(s.aborted).toBe(true);
  });

  it('a past deadline aborts at once; no limit keeps the caller signal', async () => {
    await aborted(timeoutSignal(-5)!);
    const c = new AbortController();
    expect(timeoutSignal(Infinity, c.signal)).toBe(c.signal);
    expect(timeoutSignal(null)).toBeUndefined();
  });
});
