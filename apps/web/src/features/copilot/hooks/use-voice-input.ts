import { useCallback, useEffect, useRef, useState } from 'react';
import { toVoiceWav } from '../utils/wav';

/** Longest recording; the route refuses more (60 s of 16 kHz WAV). */
export const VOICE_MAX_MS = 60_000;
/** FFT size of the spectrum display: ≈ 11.7 Hz per bin at 48 kHz, fine enough for voice pitch. */
export const VOICE_FFT_SIZE = 4096;

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
  /** Live spectrum of the microphone while recording (null when Web Audio is missing). */
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
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

  /** Taps the microphone for the spectrum display. Optional: recording works without it. */
  const openAnalyser = useCallback((stream: MediaStream) => {
    if (typeof window.AudioContext === 'undefined') return;
    try {
      const ctx = new AudioContext();
      const node = ctx.createAnalyser();
      node.fftSize = VOICE_FFT_SIZE;
      node.smoothingTimeConstant = 0.6;
      node.minDecibels = -90;
      node.maxDecibels = -20;
      ctx.createMediaStreamSource(stream).connect(node);
      audioCtxRef.current = ctx;
      setAnalyser(node);
    } catch {
      setAnalyser(null);
    }
  }, []);

  const closeAnalyser = useCallback(() => {
    void audioCtxRef.current?.close().catch(() => undefined);
    audioCtxRef.current = null;
    setAnalyser(null);
  }, []);

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
      closeAnalyser();
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
    openAnalyser(stream);
    recorder.start();
    setStatus('recording');
    timerRef.current = setTimeout(stop, VOICE_MAX_MS);
  }, [supported, transcribe, stop, openAnalyser, closeAnalyser]);

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
      void audioCtxRef.current?.close().catch(() => undefined);
    },
    []
  );

  return { status, error, supported, toggle, analyser, clearError: () => setError(null) };
}
