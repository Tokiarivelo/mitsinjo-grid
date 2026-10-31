// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import type { NextRequest } from 'next/server';

vi.mock('server-only', () => ({}));

import { POST, MAX_VOICE_BYTES } from '../route';

const request = (form: FormData) =>
  new Request('http://localhost/api/voice', {
    method: 'POST',
    body: form,
  }) as unknown as NextRequest;

const wav = (bytes: number) => new Blob([new Uint8Array(bytes)], { type: 'audio/wav' });

describe('POST /api/voice (M3-T1)', () => {
  it('returns the transcript (mock backend)', async () => {
    const form = new FormData();
    form.append('audio', wav(32_044), 'voice.wav');
    form.append('locale', 'fr');
    const res = await POST(request(form));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(typeof body.text).toBe('string');
    expect(body.text.length).toBeGreaterThan(0);
    expect(body.source).toBe('mock');
  });

  it('refuses audio over the size limit', async () => {
    const form = new FormData();
    form.append('audio', wav(MAX_VOICE_BYTES + 1), 'voice.wav');
    expect((await POST(request(form))).status).toBe(413);
  });

  it('refuses a missing or non-WAV file', async () => {
    expect((await POST(request(new FormData()))).status).toBe(400);
    const form = new FormData();
    form.append('audio', new Blob([new Uint8Array(10)], { type: 'audio/webm' }), 'a.webm');
    expect((await POST(request(form))).status).toBe(415);
  });
});
