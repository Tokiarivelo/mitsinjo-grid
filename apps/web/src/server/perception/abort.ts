/**
 * Signal that aborts after `ms` or when `signal` aborts, whichever comes first. `ms` = null or
 * Infinity: `signal` unchanged (no time limit). Bounds a model call so a stalled answer cannot
 * hold the request until Vercel's 300 s kill.
 */
export function timeoutSignal(ms: number | null, signal?: AbortSignal): AbortSignal | undefined {
  if (ms === null || !Number.isFinite(ms)) return signal;
  const timeout = AbortSignal.timeout(Math.max(0, ms));
  return signal ? AbortSignal.any([signal, timeout]) : timeout;
}
