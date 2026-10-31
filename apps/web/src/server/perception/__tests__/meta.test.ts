// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MetaPerceptionBackend } from '../meta';

const BASE = 'https://api.meta.ai/v1';
const originalFetch = global.fetch;

function respond(body: unknown, ok = true, status = 200) {
  global.fetch = vi.fn().mockResolvedValue({
    ok,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response);
  return global.fetch as ReturnType<typeof vi.fn>;
}

function lastRequest(fetchMock: ReturnType<typeof vi.fn>) {
  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  return { url, init };
}

const backend = new MetaPerceptionBackend({ apiKey: 'k', baseUrl: BASE, preferContributor: false });

afterEach(() => {
  global.fetch = originalFetch;
});

describe('MetaPerceptionBackend (shapes recorded from real calls, 2026-10-30)', () => {
  it('transcribes: multipart request + WAV, maps turns and duration', async () => {
    const fetchMock = respond({
      sessionId: 's',
      transcript: 'A: bonjour',
      audioDurationMs: 1040,
      turns: [{ turnId: 0, startMs: 0, endMs: 900, transcript: 'bonjour', speaker: 'A' }],
    });
    const wav = new Blob([new Uint8Array(100)], { type: 'audio/wav' });
    const out = await backend.transcribe(wav, { diarize: true, languages: ['French'] });

    const { url, init } = lastRequest(fetchMock);
    expect(url).toBe(`${BASE}/asr/transcribe`);
    const form = init.body as FormData;
    const request = JSON.parse(await (form.get('request') as Blob).text());
    expect(request).toEqual({
      model: 'muse-voice-transcribe-1.0',
      audioEncoding: 'WAV',
      mode: 'DIARIZATION',
      languageBias: ['French'],
    });
    expect(form.get('audio')).toBeInstanceOf(Blob);
    expect(out.result).toEqual({
      text: 'A: bonjour',
      durationMs: 1040,
      turns: [{ startMs: 0, endMs: 900, text: 'bonjour', speaker: 'A' }],
    });
    expect(out.usage).toEqual({ audioMs: 1040 });
  });

  it('analyzes an image with a JSON schema answer and drops malformed observations', async () => {
    const fetchMock = respond({
      choices: [
        {
          message: {
            content: JSON.stringify({
              summary: 'Partly cloudy',
              observations: [
                { label: 'cloud_cover', value: 65, unit: '%', confidence: 85 },
                { label: 'broken' },
              ],
            }),
          },
        },
      ],
      usage: { prompt_tokens: 3202, completion_tokens: 1314 },
    });
    const out = await backend.analyzeImage('data:image/webp;base64,AA', 'Cloud cover?');

    const body = JSON.parse(lastRequest(fetchMock).init.body as string);
    expect(lastRequest(fetchMock).url).toBe(`${BASE}/chat/completions`);
    expect(body.model).toBe('muse-spark-1.3');
    expect(body.response_format.type).toBe('json_schema');
    expect(body.messages[1].content[1]).toEqual({
      type: 'image_url',
      image_url: { url: 'data:image/webp;base64,AA' },
    });
    expect(out.result.observations).toEqual([
      { label: 'cloud_cover', value: 65, unit: '%', confidence: 0.85 },
    ]);
    expect(out.usage).toEqual({ inputTokens: 3202, outputTokens: 1314 });
  });

  it('prefers the contributor vision model and resends on the standard one when refused', async () => {
    const ok = {
      choices: [{ message: { content: JSON.stringify({ summary: 'ok', observations: [] }) } }],
      usage: { prompt_tokens: 10, completion_tokens: 5 },
    };
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 429, text: async () => 'rate limited' })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ok });
    const contributor = new MetaPerceptionBackend({
      apiKey: 'k',
      baseUrl: BASE,
      preferContributor: true,
    });
    const out = await contributor.analyzeImage('https://x/p.png', 'sky?');
    const models = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.map(
      (c) => JSON.parse((c[1] as RequestInit).body as string).model
    );
    expect(models).toEqual(['muse-spark-1.3-contributor', 'muse-spark-1.3']);
    expect(out.model).toBe('muse-spark-1.3');
  });

  it('detects appliances with the category enum schema and parses the boxes', async () => {
    const fetchMock = respond({
      choices: [
        {
          message: {
            content: JSON.stringify({
              objects: [{ label: 'Fridge', category: 'refrigerator', bbox: [100, 200, 300, 1040] }],
            }),
          },
        },
      ],
      usage: { prompt_tokens: 1500, completion_tokens: 120 },
    });
    const out = await backend.detectAppliances('data:image/jpeg;base64,AA');

    const body = JSON.parse(lastRequest(fetchMock).init.body as string);
    expect(lastRequest(fetchMock).url).toBe(`${BASE}/chat/completions`);
    expect(body.model).toBe('muse-spark-1.3');
    expect(body.response_format.json_schema.name).toBe('ApplianceDetections');
    expect(
      body.response_format.json_schema.schema.properties.objects.items.properties.category.enum
    ).toContain('fridge_vaccine');
    expect(body.messages[1].content[1].image_url.url).toBe('data:image/jpeg;base64,AA');
    expect(out.result.detections).toEqual([
      { id: 'det-1', label: 'Fridge', category: 'fridge', box: { x: 0.1, y: 0.2, w: 0.2, h: 0.8 } },
    ]);
    expect(out.usage).toEqual({ inputTokens: 1500, outputTokens: 120 });
  });

  it('throws on a malformed detection reply so the client can fall back', async () => {
    respond({ choices: [{ message: { content: 'A fridge, I think.' } }] });
    await expect(backend.detectAppliances('data:image/jpeg;base64,AA')).rejects.toThrow(/JSON/);
  });

  it('segments through /responses and reads the boxes', async () => {
    const fetchMock = respond({
      output: [
        {
          type: 'message',
          content: [
            {
              type: 'output_text',
              text: '<0f>0<|box;x1=0;y1=0;x2=9;y2=4;w=10;h=10;c=0.9|><|mask;x=0;y=0;data=1,1,!|>',
            },
          ],
        },
      ],
    });
    const out = await backend.segmentImage('https://x/p.png', 'solar panel');

    const body = JSON.parse(lastRequest(fetchMock).init.body as string);
    expect(lastRequest(fetchMock).url).toBe(`${BASE}/responses`);
    expect(body.model).toBe('sam-3.1');
    expect(body.input[0].content).toEqual([
      { type: 'input_text', text: 'solar panel' },
      { type: 'input_image', image_url: 'https://x/p.png' },
    ]);
    expect(out.result.count).toBe(1);
    expect(out.result.boxCoverage).toBeCloseTo(0.5);
    expect(out.usage).toEqual({ images: 1 });
  });

  it('segment: decodes full masks into outlines on each instance', async () => {
    respond({
      output: [
        {
          type: 'message',
          content: [
            {
              type: 'output_text',
              text:
                '<0f>0<|box;x1=211;y1=228;x2=270;y2=254;w=320;h=334|>' +
                "<|mask;x=0;y=0;data=27,60,~!!!!M!0c[0o91w?q1!pIH4pPRVp2B3'7`e.ioeAf6-k/#Xd8%dX9x(|>",
            },
          ],
        },
      ],
    });
    const out = await backend.segmentImage('https://x/p.png', 'button');
    expect(out.result.instances[0]!.outline).toMatch(/^M.*Z$/);
  });

  it('throws on an HTTP error so the client can fall back', async () => {
    respond({ error: { code: 'media_url_origin_error' } }, false, 400);
    await expect(backend.analyzeImage('https://x', 'q')).rejects.toThrow(/400/);
  });

  it('throws without an API key', async () => {
    const noKey = new MetaPerceptionBackend({ apiKey: '', baseUrl: BASE });
    // env may hold a real key in dev: only assert when the constructor really has none.
    if (!(noKey as unknown as { apiKey: string }).apiKey) {
      await expect(noKey.segmentImage('https://x', 'roof')).rejects.toThrow(/META_API_KEY/);
    }
  });
});
