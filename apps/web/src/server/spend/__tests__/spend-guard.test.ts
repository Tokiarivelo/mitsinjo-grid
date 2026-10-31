import { describe, expect, it } from 'vitest';
import { SpendGuard, estimateCostUsd, estimateTokens } from '../spend-guard';

describe('estimateCostUsd (catalogue prices)', () => {
  it('prices a Spark chat turn per million tokens', () => {
    // 6 000 in × 1.25 $/M + 600 out × 4.25 $/M
    expect(estimateCostUsd('muse-spark-1.3', { inputTokens: 6000, outputTokens: 600 })).toBeCloseTo(
      0.01005,
      6
    );
  });

  it('prices images, audio and video frames', () => {
    expect(estimateCostUsd('muse-image-1.0', { images: 2 })).toBeCloseTo(0.02, 6);
    expect(estimateCostUsd('sam-3.1', { images: 4 })).toBeCloseTo(0.01, 6);
    expect(estimateCostUsd('sam-3.1', { videoFrames: 1000 })).toBeCloseTo(0.2, 6);
    expect(estimateCostUsd('muse-voice-transcribe-1.0', { audioMs: 3_600_000 })).toBeCloseTo(
      0.18,
      6
    );
  });

  it('counts an unknown model at the most expensive chat price', () => {
    expect(estimateCostUsd('future-model', { inputTokens: 1e6 })).toBe(4);
  });

  it('estimates tokens from text length', () => {
    expect(estimateTokens('abcdefgh')).toBe(2);
    expect(estimateTokens('')).toBe(0);
  });
});

describe('SpendGuard', () => {
  it('allows calls until the key reaches the cap, per key', () => {
    const guard = new SpendGuard(0.015);
    expect(guard.canSpend('s1')).toBe(true);
    guard.record('s1', 'muse-image-1.0', { images: 1 });
    expect(guard.canSpend('s1')).toBe(true);
    guard.record('s1', 'muse-image-1.0', { images: 1 });
    expect(guard.spentUsd('s1')).toBeCloseTo(0.02, 6);
    expect(guard.canSpend('s1')).toBe(false);
    expect(guard.canSpend('s2')).toBe(true);
  });

  it('blocks every paid call with a cap of 0', () => {
    expect(new SpendGuard(0).canSpend()).toBe(false);
  });
});
