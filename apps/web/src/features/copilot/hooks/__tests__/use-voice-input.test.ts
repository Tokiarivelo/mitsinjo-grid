import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

vi.mock('../../utils/wav', () => ({
  toVoiceWav: vi.fn(async () => new Blob([new Uint8Array(100)], { type: 'audio/wav' })),
}));

import { useVoiceInput } from '../use-voice-input';

class FakeRecorder {
  state: 'inactive' | 'recording' = 'inactive';
  mimeType = 'audio/webm';
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  constructor(readonly stream: MediaStream) {}
  start() {
    this.state = 'recording';
  }
  stop() {
    this.state = 'inactive';
    this.ondataavailable?.({ data: new Blob([new Uint8Array(10)]) });
    this.onstop?.();
  }
}

const stream = { getTracks: () => [{ stop: vi.fn() }] } as unknown as MediaStream;

function setup(getUserMedia: () => Promise<MediaStream>, fetchImpl?: typeof fetch) {
  vi.stubGlobal('MediaRecorder', FakeRecorder);
  Object.defineProperty(navigator, 'mediaDevices', {
    value: { getUserMedia: vi.fn(getUserMedia) },
    configurable: true,
  });
  if (fetchImpl) vi.stubGlobal('fetch', vi.fn(fetchImpl));
}

describe('useVoiceInput (M3-T2)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('records, stops, then puts the transcript in the input', async () => {
    setup(
      async () => stream,
      async () =>
        ({ ok: true, json: async () => ({ text: 'Coupe le marché ce soir' }) }) as Response
    );
    const onText = vi.fn();
    const { result } = renderHook(() => useVoiceInput({ locale: 'fr', onText }));

    await act(async () => result.current.toggle());
    expect(result.current.status).toBe('recording');
    await act(async () => result.current.toggle());

    await waitFor(() => expect(onText).toHaveBeenCalledWith('Coupe le marché ce soir'));
    expect(result.current.status).toBe('idle');
    const [url, init] = vi.mocked(fetch).mock.calls[0]!;
    expect(url).toBe('/api/voice');
    expect((init?.body as FormData).get('locale')).toBe('fr');
  });

  it('a refused microphone shows the "denied" message, no recording', async () => {
    setup(async () => {
      throw new Error('NotAllowedError');
    });
    const { result } = renderHook(() => useVoiceInput({ locale: 'en', onText: vi.fn() }));
    await act(async () => result.current.toggle());
    expect(result.current.error).toBe('denied');
    expect(result.current.status).toBe('idle');
  });

  it('a failed transcription says so and goes back to idle', async () => {
    setup(
      async () => stream,
      async () => ({ ok: false, status: 500 }) as Response
    );
    const { result } = renderHook(() => useVoiceInput({ locale: 'en', onText: vi.fn() }));
    await act(async () => result.current.toggle());
    await act(async () => result.current.toggle());
    await waitFor(() => expect(result.current.error).toBe('failed'));
    expect(result.current.status).toBe('idle');
  });

  it('without MediaRecorder: "unsupported", never the browser alert', async () => {
    vi.stubGlobal('MediaRecorder', undefined);
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const { result } = renderHook(() => useVoiceInput({ locale: 'en', onText: vi.fn() }));
    await act(async () => result.current.toggle());
    expect(result.current.error).toBe('unsupported');
    expect(alertSpy).not.toHaveBeenCalled();
  });
});
