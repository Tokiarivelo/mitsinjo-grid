'use client';

import { useRef, useState } from 'react';
import { Users } from 'lucide-react';
import { useAppLocale, useTranslations } from '@/lib/i18n';
import { useSharedCopilot } from '../hooks/copilot-context';
import type { CopilotMeeting } from '../types';

type Status =
  | { state: 'idle' }
  | { state: 'working' }
  | { state: 'posted'; turns: number; count: number }
  | { state: 'error' };

/**
 * Village meeting entry (M10-T4, full /copilot only): the operator picks a WAV recording, the
 * server diarizes it and extracts priorities, and the result lands in the chat as a meeting
 * block — proposed to the engine from there, never applied here.
 */
export function MeetingPanel() {
  const t = useTranslations('features.copilot.meeting');
  const { locale } = useAppLocale();
  const { sessionId, postMeeting } = useSharedCopilot();
  const [status, setStatus] = useState<Status>({ state: 'idle' });
  const inputRef = useRef<HTMLInputElement>(null);

  const onFile = async (file: File | undefined) => {
    if (!file || status.state === 'working') return;
    setStatus({ state: 'working' });
    try {
      const form = new FormData();
      form.append('audio', file, file.name || 'meeting.wav');
      form.append('locale', locale);
      form.append('sessionId', sessionId);
      const res = await fetch('/api/meetings', { method: 'POST', body: form });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const meeting = (await res.json()) as CopilotMeeting;
      postMeeting(meeting);
      setStatus({
        state: 'posted',
        turns: meeting.turns.length,
        count: meeting.priorities.length,
      });
    } catch {
      setStatus({ state: 'error' });
    } finally {
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <section
      aria-label={t('title')}
      className="rounded-card border border-border/70 bg-surface/60 p-3 flex flex-col gap-2"
    >
      <p className="flex items-center gap-1.5 text-xs font-semibold text-text-primary">
        <Users className="h-4 w-4 text-ai-violet" aria-hidden="true" />
        {t('title')}
      </p>
      <input
        ref={inputRef}
        type="file"
        accept="audio/wav,.wav"
        className="sr-only"
        aria-label={t('pickFile')}
        onChange={(e) => void onFile(e.target.files?.[0])}
      />
      <button
        type="button"
        disabled={status.state === 'working'}
        onClick={() => inputRef.current?.click()}
        className="min-h-[44px] rounded-control border border-ai-violet/40 bg-ai-violet/10 text-sm font-semibold text-text-primary hover:bg-ai-violet/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-energy-cyan disabled:opacity-60"
      >
        {status.state === 'working' ? t('transcribing') : t('pickFile')}
      </button>
      {status.state === 'posted' && (
        <p className="text-xs text-text-secondary" role="status">
          {t('posted', { turns: status.turns, count: status.count })}
        </p>
      )}
      {status.state === 'error' && (
        <p className="text-xs text-critical-red" role="alert">
          {t('error')}
        </p>
      )}
    </section>
  );
}
