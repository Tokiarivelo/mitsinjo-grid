// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextRequest } from 'next/server';
import { dispatchLogHash, type DispatchLogEntry } from '@mitsinjo/engine';

vi.mock('server-only', () => ({}));

import { GET, POST, DELETE } from '../log/route';

const mockRequest = (url: string, method = 'GET', body?: unknown) =>
  new Request(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  }) as unknown as NextRequest;

const sampleEntry = (): DispatchLogEntry => {
  const base = {
    id: `log-${Date.now()}-${Math.random()}`,
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
  };
  return {
    ...base,
    hash: dispatchLogHash(base),
  };
};

describe('Dispatch log API route (PA-T3a)', () => {
  beforeEach(async () => {
    await DELETE();
  });

  it('GET /api/dispatch/log returns empty array initially', async () => {
    const res = await GET(mockRequest('http://localhost/api/dispatch/log'));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.entries).toEqual([]);
    expect(data).toHaveProperty('dbConfigured');
  });

  it('POST /api/dispatch/log stores a valid entry and GET retrieves it', async () => {
    const entry = sampleEntry();
    const postRes = await POST(mockRequest('http://localhost/api/dispatch/log', 'POST', entry));
    expect(postRes.status).toBe(201);

    const getRes = await GET(mockRequest('http://localhost/api/dispatch/log'));
    expect(getRes.status).toBe(200);
    const data = await getRes.json();
    expect(data.entries).toHaveLength(1);
    expect(data.entries[0].id).toBe(entry.id);
    expect(data.entries[0].hash).toBe(entry.hash);
  });

  it('POST /api/dispatch/log stores batch entries when array is sent', async () => {
    const entry1 = sampleEntry();
    const entry2 = sampleEntry();
    const postRes = await POST(
      mockRequest('http://localhost/api/dispatch/log', 'POST', [entry1, entry2])
    );
    expect(postRes.status).toBe(201);

    const getRes = await GET(mockRequest('http://localhost/api/dispatch/log'));
    const data = await getRes.json();
    expect(data.entries).toHaveLength(2);
  });

  it('GET returns the latest entries and ignores a bad limit', async () => {
    const entries = [sampleEntry(), sampleEntry(), sampleEntry()];
    await POST(mockRequest('http://localhost/api/dispatch/log', 'POST', entries));

    const latest = await (
      await GET(mockRequest('http://localhost/api/dispatch/log?limit=2'))
    ).json();
    expect(latest.entries.map((e: DispatchLogEntry) => e.id)).toEqual([
      entries[1]!.id,
      entries[2]!.id,
    ]);

    const bad = await GET(mockRequest('http://localhost/api/dispatch/log?limit=abc'));
    expect(bad.status).toBe(200);
    expect((await bad.json()).entries).toHaveLength(3);
  });

  it('POST /api/dispatch/log rejects invalid payload with 400', async () => {
    const invalid = { id: 'missing-all-required-fields' };
    const res = await POST(mockRequest('http://localhost/api/dispatch/log', 'POST', invalid));
    expect(res.status).toBe(400);
  });

  it('DELETE /api/dispatch/log clears entries', async () => {
    await POST(mockRequest('http://localhost/api/dispatch/log', 'POST', sampleEntry()));
    const delRes = await DELETE();
    expect(delRes.status).toBe(200);

    const getRes = await GET(mockRequest('http://localhost/api/dispatch/log'));
    const data = await getRes.json();
    expect(data.entries).toHaveLength(0);
  });
});
