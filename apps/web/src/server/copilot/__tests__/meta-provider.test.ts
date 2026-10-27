import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MetaLlmProvider, DEFAULT_META_MODEL, isCopilotModel } from '../providers/meta';

describe('MetaLlmProvider & Model Discovery (P6-T5)', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('fetches available models from GET /models per Meta API reference', async () => {
    const mockModels = [
      { id: 'muse-spark-1.3', object: 'model' },
      { id: 'muse-spark-1.2', object: 'model' },
    ];

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        object: 'list',
        data: mockModels,
      }),
    } as Response);

    const models = await MetaLlmProvider.listModels('test-api-key', 'https://api.meta.ai/v1');

    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.meta.ai/v1/models',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-api-key',
        }),
      })
    );

    expect(models).toEqual(['muse-spark-1.3', 'muse-spark-1.2']);
  });

  it('falls back to default/env META_MODEL if Meta API returns an error', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    } as Response);

    const models = await MetaLlmProvider.listModels('test-api-key', 'https://api.meta.ai/v1');

    expect(models).toEqual([DEFAULT_META_MODEL]);
  });

  it('falls back to default/env META_MODEL if fetch throws an exception', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network connection error'));

    const models = await MetaLlmProvider.listModels('test-api-key', 'https://api.meta.ai/v1');

    expect(models).toEqual([DEFAULT_META_MODEL]);
  });

  it('falls back to default/env META_MODEL if API key is missing', async () => {
    const models = await MetaLlmProvider.listModels('', 'https://api.meta.ai/v1');

    expect(models).toEqual([DEFAULT_META_MODEL]);
  });

  it('initializes with custom model or allows setModel', () => {
    const provider = new MetaLlmProvider({
      apiKey: 'test-key',
      model: 'muse-spark-1.2',
    });

    expect(provider.getModel()).toBe('muse-spark-1.2');

    provider.setModel('muse-spark-1.3');
    expect(provider.getModel()).toBe('muse-spark-1.3');
  });

  it('keeps only standard-mode Muse Spark models for the copilot', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          { id: 'muse-spark-1.3' },
          { id: 'muse-spark-1.3-contributor' },
          { id: 'muse-image-1.0' },
          { id: 'sam-3.1' },
          { id: 'muse-wonder-1.0' },
        ],
      }),
    } as Response);

    const models = await MetaLlmProvider.listModels('k', 'https://api.meta.ai/v1');
    expect(models).toEqual(['muse-spark-1.3']);
  });

  it('isCopilotModel rejects non-chat and contributor ids', () => {
    expect(isCopilotModel('mock-deterministic-v1')).toBe(true);
    expect(isCopilotModel('muse-spark-1.2')).toBe(true);
    expect(isCopilotModel('muse-spark-1.2-contributor')).toBe(false);
    expect(isCopilotModel('muse-voice-transcribe-1.0')).toBe(false);
    expect(isCopilotModel('anything')).toBe(false);
  });
});
