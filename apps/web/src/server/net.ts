import 'server-only';

import net from 'node:net';

/**
 * Time Node gives each address family to connect before trying the next (ms). Node's default is
 * 250 ms: on a slow link the IPv4 connect to `api.meta.ai` takes longer, Node moves to IPv6, which
 * has no route here, and every Meta call fails in < 1 s with `fetch failed (ETIMEDOUT)` → mock
 * fallback (user report 2026-11-04, reproduced with a 10–100 ms attempt timeout).
 */
export const CONNECT_ATTEMPT_MS = 2_000;

let applied = false;

/** Applies the network defaults once per process (server start, Meta clients, scripts). */
export function ensureNetworkDefaults(): boolean {
  if (applied) return false;
  applied = true;
  if (net.getDefaultAutoSelectFamilyAttemptTimeout() < CONNECT_ATTEMPT_MS) {
    net.setDefaultAutoSelectFamilyAttemptTimeout(CONNECT_ATTEMPT_MS);
  }
  return true;
}
