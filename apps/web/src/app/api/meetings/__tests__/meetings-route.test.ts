// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import type { NextRequest } from 'next/server';

vi.mock('server-only', () => ({}));

import { POST, MAX_MEETING_BYTES } from '../route';

const request = (form: FormData) =>
  new Request('http://localhost/api/meetings', {
    method: 'POST',
    body: form,
  }) as unknown as NextRequest;

const wav = (bytes: number) => new Blob([new Uint8Array(bytes)], { type: 'audio/wav' });

describe('POST /api/meetings (M10-T4)', () => {
  it('diarizes and extracts priorities + patch (mock backend)', async () => {
    const form = new FormData();
    form.append('audio', wav(64_044), 'meeting.wav');
    form.append('locale', 'fr');
    const res = await POST(request(form));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.source).toBe('mock');
    expect(body.turns).toHaveLength(3);
    expect(body.turns[0].speaker).toBe('A');
    expect(body.priorities).toHaveLength(3);
    expect(body.patch).toEqual({
      priorities: { health: 'critical', school: 'high', market: 'low' },
    });
    expect(body.unmapped).toEqual([]);
  });

  it('refuses audio over the size limit', async () => {
    const form = new FormData();
    form.append('audio', wav(MAX_MEETING_BYTES + 1), 'meeting.wav');
    expect((await POST(request(form))).status).toBe(413);
  });

  it('refuses a missing or non-WAV file', async () => {
    expect((await POST(request(new FormData()))).status).toBe(400);
    const form = new FormData();
    form.append('audio', new Blob([new Uint8Array(10)], { type: 'audio/webm' }), 'a.webm');
    expect((await POST(request(form))).status).toBe(415);
  });
});
