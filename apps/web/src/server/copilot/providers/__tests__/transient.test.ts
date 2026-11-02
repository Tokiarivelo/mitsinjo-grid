import { describe, expect, it } from 'vitest';
import { errorWithCause, isTransientProviderError } from '../transient';

describe('isTransientProviderError', () => {
  it('retries network, 429 and 5xx; not aborts or 4xx', () => {
    expect(isTransientProviderError(new TypeError('fetch failed'))).toBe(true);
    expect(isTransientProviderError(new Error('API error (503)'))).toBe(true);
    expect(isTransientProviderError(new Error('API error (429)'))).toBe(true);
    expect(isTransientProviderError(new Error('API error (400)'))).toBe(false);
    expect(isTransientProviderError(new DOMException('a', 'AbortError'))).toBe(false);
  });
});

describe('errorWithCause', () => {
  it('shows the hidden low-level cause of "fetch failed"', () => {
    const err = new TypeError('fetch failed', {
      cause: { code: 'ECONNRESET', message: 'socket hang up' },
    });
    expect(errorWithCause(err)).toBe('fetch failed (ECONNRESET socket hang up)');
    expect(errorWithCause(new Error('plain'))).toBe('plain');
  });
});
