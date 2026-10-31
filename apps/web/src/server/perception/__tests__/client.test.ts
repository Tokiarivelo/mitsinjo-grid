import { describe, expect, it, vi } from 'vitest';
import { SpendGuard } from '@/server/spend';
import type { PerceptionBackend } from '../backend';
import { PerceptionClient } from '../client';
import { MOCK_DETECTIONS, MockPerceptionBackend } from '../mock';

const image = 'data:image/png;base64,AA';

function fakeMeta(overrides: Partial<PerceptionBackend> = {}): PerceptionBackend {
  return {
    name: 'meta',
    transcribe: vi.fn(),
    segmentImage: vi.fn(),
    detectAppliances: vi.fn(),
    analyzeImage: vi.fn().mockResolvedValue({
      model: 'muse-spark-1.3',
      usage: { inputTokens: 1000, outputTokens: 100 },
      result: { summary: 'Clear sky', observations: [] },
    }),
    ...overrides,
  };
}

describe('PerceptionClient', () => {
  it('uses Meta when configured and records the cost', async () => {
    const guard = new SpendGuard(1);
    const client = new PerceptionClient(fakeMeta(), new MockPerceptionBackend(), guard, 's1');
    const out = await client.analyzeImage(image, 'sky?');
    expect(out).toEqual({
      summary: 'Clear sky',
      observations: [],
      source: 'meta',
      model: 'muse-spark-1.3',
    });
    expect(guard.spentUsd('s1')).toBeGreaterThan(0);
  });

  it('falls back to the mock on a Meta error', async () => {
    const meta = fakeMeta({ analyzeImage: vi.fn().mockRejectedValue(new Error('HTTP 500')) });
    const client = new PerceptionClient(meta, new MockPerceptionBackend(), new SpendGuard(1), 's1');
    const out = await client.analyzeImage(image, 'Quel est le ciel ?');
    expect(out.source).toBe('mock');
    expect(out.fallback).toBe('provider_error');
    expect(out.observations[0]?.label).toBe('cloud_cover');
  });

  it('uses the mock without calling Meta once the spend cap is reached', async () => {
    const meta = fakeMeta();
    const client = new PerceptionClient(meta, new MockPerceptionBackend(), new SpendGuard(0), 's1');
    const out = await client.analyzeImage(image, 'sky?');
    expect(meta.analyzeImage).not.toHaveBeenCalled();
    expect(out.fallback).toBe('spend_cap');
  });

  it('marks results not_configured when Meta is wanted without a key, plain mock otherwise', async () => {
    const missingKey = new PerceptionClient(
      null,
      new MockPerceptionBackend(),
      new SpendGuard(1),
      's1',
      true
    );
    expect((await missingKey.segmentImage(image, 'roof')).fallback).toBe('not_configured');

    const mockMode = new PerceptionClient(
      null,
      new MockPerceptionBackend(),
      new SpendGuard(1),
      's1'
    );
    const out = await mockMode.segmentImage(image, 'roof');
    expect(out.source).toBe('mock');
    expect(out.fallback).toBeUndefined();
  });

  it('detection: a malformed Meta reply falls back to the mock fixture, flagged', async () => {
    const meta = fakeMeta({
      detectAppliances: vi
        .fn()
        .mockRejectedValue(new Error('Appliance detection reply is not valid JSON')),
    });
    const client = new PerceptionClient(meta, new MockPerceptionBackend(), new SpendGuard(1), 's1');
    const out = await client.detectAppliances(image);
    expect(out.source).toBe('mock');
    expect(out.fallback).toBe('provider_error');
    expect(out.detections).toEqual(MOCK_DETECTIONS);
  });
});
