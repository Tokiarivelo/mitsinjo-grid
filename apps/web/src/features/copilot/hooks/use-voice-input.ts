import { useCallback, useEffect, useRef, useState } from 'react';
import { toVoiceWav } from '../utils/wav';

/** Longest recording; the route refuses more (60 s of 16 kHz WAV). */
export const VOICE_MAX_MS = 60_000;

export type VoiceStatus = 'idle' | 'recording' | 'transcribing';
/** i18n keys under `features.copilot.voice`. */
export type VoiceErrorKey = 'unsupported' | 'denied' | 'failed' | 'empty';

export interface UseVoiceInputOptions {
  locale: string;
  sessionId?: string;
  /** Receives the transcribed text (shown in the input, editable before sending). */
  onText: (text: string) => void;
}

/**
 * Chat microphone: tap to record, tap again to stop. The audio is turned into WAV and sent to
 * `/api/voice` (Meta Voice or the offline mock). Works in every browser with `MediaRecorder`,
 * unlike the Web Speech API (missing in Firefox and most Linux Chromium builds).
 */
export function useVoiceInput({ locale, sessionId, onText }: UseVoiceInputOptions) {
  const [status, setStatus] = useState<VoiceStatus>('idle');
  const [error, setError] = useState<VoiceErrorKey | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const onTextRef = useRef(onText);
  useEffect(() => {
    onTextRef.current = onText;
  }, [onText]);

  const supported =
    typeof window !== 'undefined' &&
    typeof window.MediaRecorder !== 'undefined' &&
    Boolean(navigator.mediaDevices?.getUserMedia);

  const transcribe = useCallback(
    async (recording: Blob) => {
      setStatus('transcribing');
      try {
        const form = new FormData();
        form.append('audio', await toVoiceWav(recording), 'voice.wav');
        form.append('locale', locale);
        if (sessionId) form.append('sessionId', sessionId);
        const res = await fetch('/api/voice', { method: 'POST', body: form });
        if (!res.ok) throw new Error(`voice ${res.status}`);
        const data = (await res.json()) as { text?: string };
        const text = data.text?.trim();
        if (text) onTextRef.current(text);
        else setError('empty');
      } catch {
        setError('failed');
      } finally {
        setStatus('idle');
      }
    },
    [locale, sessionId]
  );

  const stop = useCallback(() => {
    clearTimeout(timerRef.current);
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
  }, []);

  const start = useCallback(async () => {
    setError(null);
    if (!supported) {
      setError('unsupported');
      return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError('denied');
      return;
    }
    const recorder = new MediaRecorder(stream);
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    recorder.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      recorderRef.current = null;
      const recording = new Blob(chunks, { type: recorder.mimeType });
      if (recording.size === 0) {
        setStatus('idle');
        setError('empty');
        return;
      }
      void transcribe(recording);
    };
    recorderRef.current = recorder;
    recorder.start();
    setStatus('recording');
    timerRef.current = setTimeout(stop, VOICE_MAX_MS);
  }, [supported, transcribe, stop]);

  const toggle = useCallback(() => {
    if (status === 'recording') stop();
    else if (status === 'idle') void start();
  }, [status, start, stop]);

  // Leaving the page while recording releases the microphone.
  useEffect(
    () => () => {
      clearTimeout(timerRef.current);
      const rec = recorderRef.current;
      if (rec?.state === 'recording') {
        rec.onstop = null;
        rec.stop();
        rec.stream.getTracks().forEach((t) => t.stop());
      }
    },
    []
  );

  return { status, error, supported, toggle, clearError: () => setError(null) };
}
