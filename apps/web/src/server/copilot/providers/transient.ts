import 'server-only';

/** Errors worth one retry before falling back: rate limit, server error, network failure. */
export function isTransientProviderError(err: unknown): boolean {
  if (!(err instanceof Error) || err.name === 'AbortError') return false;
  return err.name === 'TypeError' || /\((429|5\d\d)\)/.test(err.message);
}

/** Error message plus its low-level cause (undici hides DNS/TLS/reset behind "fetch failed"). */
export function errorWithCause(err: unknown): string {
  if (!(err instanceof Error)) return String(err);
  const cause = err.cause as { code?: string; message?: string } | undefined;
  const detail = cause ? [cause.code, cause.message].filter(Boolean).join(' ') : '';
  return detail ? `${err.message} (${detail})` : err.message;
}
