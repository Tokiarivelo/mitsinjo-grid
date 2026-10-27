import { describe, expect, it } from 'vitest';
import { canonicalJson, computeInputHash, computeResultId, fnv1a64 } from '../hash';
import { createBaselineInput } from '../scenarios';

describe('Deterministic Hash & IDs (P3-T6)', () => {
  it('serializes objects canonically regardless of key order', () => {
    const objA = { z: 1, a: 2, m: { y: 'bar', x: 'foo' } };
    const objB = { a: 2, m: { x: 'foo', y: 'bar' }, z: 1 };

    expect(canonicalJson(objA)).toBe(canonicalJson(objB));
    expect(canonicalJson(objA)).toBe('{"a":2,"m":{"x":"foo","y":"bar"},"z":1}');
  });

  it('computes 16-hex deterministic FNV-1a hash', () => {
    const hash = fnv1a64('test-string');
    expect(hash).toHaveLength(16);
    expect(hash).toBe(fnv1a64('test-string'));
    expect(hash).not.toBe(fnv1a64('other-string'));
  });

  it('produces identical inputHash for identical inputs', () => {
    const input1 = createBaselineInput();
    const input2 = createBaselineInput();

    expect(computeInputHash(input1)).toBe(computeInputHash(input2));
  });

  it('produces stable result ID formatted as SIM-XXXXXX', () => {
    const input = createBaselineInput();
    const hash = computeInputHash(input);

    const id1 = computeResultId(hash, 'proportional');
    const id2 = computeResultId(hash, 'proportional');
    const idEss = computeResultId(hash, 'essential_first');

    expect(id1).toMatch(/^SIM-[0-9A-F]{6}$/);
    expect(id1).toBe(id2);
    expect(id1).not.toBe(idEss);
  });
});
