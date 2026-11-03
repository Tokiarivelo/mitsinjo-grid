// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextRequest } from 'next/server';
import { dispatchLogHash, type DispatchLogEntry } from '@mitsinjo/engine';

vi.mock('server-only', () => ({}));

// Mock neon saveDispatchLogEntries
vi.mock('@/server/db/neon', () => ({
  saveDispatchLogEntries: vi.fn().mockResolvedValue(undefined),
  isNeonConfigured: vi.fn().mockReturnValue(false),
}));

// Mock spend guard (cap open unless a test closes it)
const canSpend = vi.fn().mockReturnValue(true);
const recordSpend = vi.fn();
vi.mock('@/server/spend', () => ({
  spendGuard: { canSpend: () => canSpend(), record: (...a: unknown[]) => recordSpend(...a) },
  estimateTokens: (text: string) => Math.ceil(text.length / 4),
}));

// Mock Meta provider
const mockChat = vi.fn();
vi.mock('@/server/copilot/providers/meta', () => {
  return {
    MetaLlmProvider: class {
      chat = mockChat;
    },
  };
});

// Mock env
vi.mock('@/lib/env', () => ({
  env: {
    LLM_PROVIDER: 'mock',
    META_API_KEY: '',
  },
}));

import { POST, clearNarrationCache } from '../narrate/route';
import { env } from '@/lib/env';

const mockRequest = (body: unknown) =>
  new Request('http://localhost/api/dispatch/narrate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;

const sampleFireEntry = (): DispatchLogEntry => {
  const base = {
    id: 'test-fire-entry',
    day: 0,
    hour: 14,
    mode: 'autonomous' as const,
    origin: 'ai' as const,
    incident: {
      kind: 'fire' as const,
      severity: 'critical' as const,
      day: 0,
      hour: 14,
      sector: 'market' as const,
      evidence: { activeFire: 1 },
    },
    action: {
      kind: 'isolate_sector' as const,
      sector: 'market' as const,
      answers: 'fire' as const,
      patch: { sectorCaps: [{ sector: 'market' as const, maxKw: 0, fromHour: 14, toHour: 24 }] },
    },
    before: {
      resultId: 'r1',
      unservedKwh: 30,
      criticalUnservedKwh: 10,
      socEndPct: 40,
    },
    after: {
      resultId: 'r2',
      unservedKwh: 10,
      criticalUnservedKwh: 0,
      socEndPct: 50,
    },
  };
  return {
    ...base,
    hash: dispatchLogHash(base),
  };
};

describe('POST /api/dispatch/narrate (PA-T5a)', () => {
  beforeEach(() => {
    clearNarrationCache();
    vi.clearAllMocks();
    (env as unknown as { LLM_PROVIDER: string; META_API_KEY: string }).LLM_PROVIDER = 'mock';
    (env as unknown as { LLM_PROVIDER: string; META_API_KEY: string }).META_API_KEY = '';
    canSpend.mockReturnValue(true);
  });

  it('skips the LLM and uses the template when the spend cap is reached', async () => {
    (env as unknown as { LLM_PROVIDER: string; META_API_KEY: string }).LLM_PROVIDER = 'meta';
    (env as unknown as { LLM_PROVIDER: string; META_API_KEY: string }).META_API_KEY = 'valid-key';
    canSpend.mockReturnValue(false);

    const res = await POST(mockRequest({ entry: sampleFireEntry(), locale: 'en' }));
    const data = await res.json();
    expect(mockChat).not.toHaveBeenCalled();
    expect(data.narration.source).toBe('template');
  });

  it('rejects invalid body with 400', async () => {
    const res = await POST(mockRequest({ invalid: 'body' }));
    expect(res.status).toBe(400);
  });

  it('generates deterministic template narration without Meta API key', async () => {
    const entry = sampleFireEntry();
    const res = await POST(mockRequest({ entry, locale: 'fr' }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.cached).toBe(false);
    expect(data.narration.source).toBe('template');
    expect(data.narration.text).toContain('14:00');
    expect(data.narration.text).toContain('marché');
  });

  it('serves repeated requests from memory cache', async () => {
    const entry = sampleFireEntry();
    const res1 = await POST(mockRequest({ entry, locale: 'fr' }));
    const data1 = await res1.json();
    expect(data1.cached).toBe(false);

    const res2 = await POST(mockRequest({ entry, locale: 'fr' }));
    const data2 = await res2.json();
    expect(data2.cached).toBe(true);
    expect(data2.narration.text).toBe(data1.narration.text);
  });

  it('uses LLM when Meta is configured and text passes factual validation', async () => {
    (env as unknown as { LLM_PROVIDER: string; META_API_KEY: string }).LLM_PROVIDER = 'meta';
    (env as unknown as { LLM_PROVIDER: string; META_API_KEY: string }).META_API_KEY = 'valid-key';

    mockChat.mockResolvedValueOnce({
      content:
        'À 14:00, incendie au marché : secteur isolé avec succès, 20 kWh économisés et dispensaire protégé.',
    });

    const entry = sampleFireEntry();
    const res = await POST(mockRequest({ entry, locale: 'fr' }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.narration.source).toBe('llm');
    expect(data.narration.text).toContain('20 kWh');
    expect(recordSpend).toHaveBeenCalledWith(
      'dispatch-narrate',
      'muse-spark-1.3',
      expect.objectContaining({ inputTokens: expect.any(Number) })
    );
  });

  it('falls back to template if LLM outputs hallucinated numbers', async () => {
    (env as unknown as { LLM_PROVIDER: string; META_API_KEY: string }).LLM_PROVIDER = 'meta';
    (env as unknown as { LLM_PROVIDER: string; META_API_KEY: string }).META_API_KEY = 'valid-key';

    mockChat.mockResolvedValueOnce({
      content: 'À 14:00, coupure magique ayant économisé 9999.00 kWh non réels.',
    });

    const entry = sampleFireEntry();
    const res = await POST(mockRequest({ entry, locale: 'fr' }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.narration.source).toBe('template');
    expect(data.narration.text).not.toContain('9999');
  });
});
