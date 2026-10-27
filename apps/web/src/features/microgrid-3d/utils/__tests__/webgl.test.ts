import { describe, it, expect } from 'vitest';
import { isWebGLAvailable } from '../webgl';

describe('isWebGLAvailable (P7-T5)', () => {
  it('returns a boolean value without throwing in jsdom environment', () => {
    const available = isWebGLAvailable();
    expect(typeof available).toBe('boolean');
  });
});
