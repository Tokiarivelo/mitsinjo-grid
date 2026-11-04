import net from 'node:net';
import { afterEach, describe, expect, it, vi } from 'vitest';

describe('ensureNetworkDefaults (fetch failed ETIMEDOUT, 2026-11-04)', () => {
  const initial = net.getDefaultAutoSelectFamilyAttemptTimeout();
  afterEach(() => {
    net.setDefaultAutoSelectFamilyAttemptTimeout(initial);
    vi.resetModules();
  });

  it('raises the per-family connect attempt above Node 250 ms default, once per process', async () => {
    net.setDefaultAutoSelectFamilyAttemptTimeout(250);
    const { ensureNetworkDefaults, CONNECT_ATTEMPT_MS } = await import('../net');
    expect(ensureNetworkDefaults()).toBe(true);
    expect(net.getDefaultAutoSelectFamilyAttemptTimeout()).toBe(CONNECT_ATTEMPT_MS);
    expect(ensureNetworkDefaults()).toBe(false);
  });

  it('never lowers a longer timeout set elsewhere (e.g. NODE_OPTIONS)', async () => {
    net.setDefaultAutoSelectFamilyAttemptTimeout(5_000);
    const { ensureNetworkDefaults } = await import('../net');
    ensureNetworkDefaults();
    expect(net.getDefaultAutoSelectFamilyAttemptTimeout()).toBe(5_000);
  });

  it('the Meta clients apply it on construction', async () => {
    net.setDefaultAutoSelectFamilyAttemptTimeout(250);
    const { MetaPerceptionBackend } = await import('../perception/meta');
    new MetaPerceptionBackend({ apiKey: 'k' });
    expect(net.getDefaultAutoSelectFamilyAttemptTimeout()).toBeGreaterThanOrEqual(2_000);
  });
});
