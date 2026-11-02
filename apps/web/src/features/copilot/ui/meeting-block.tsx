'use client';

import type { InputPatch } from '@mitsinjo/engine';
import { useTranslations } from '@/lib/i18n';
import type { CopilotMeeting } from '../types';
import type { MeetingWant } from '@/lib/meeting-priorities';

export interface MeetingBlockProps {
  meeting: CopilotMeeting;
  onPropose: (patch: InputPatch, reason: string) => void;
}

const WANT_KEY: Record<MeetingWant, string> = {
  protect: 'wantProtect',
  mention: 'wantMention',
  deprioritize: 'wantDeprioritize',
};

const TIME_KEY = {
  morning: 'timeMorning',
  midday: 'timeMidday',
  evening: 'timeEvening',
  night: 'timeNight',
} as const;

/**
 * Diarized village meeting (M10-T4): speaker turns + who-wants-what, in the violet AI style.
 * The extracted patch is proposed to the engine — never applied without the operator's tap.
 */
export function MeetingBlock({ meeting, onPropose }: MeetingBlockProps) {
  const t = useTranslations('features.copilot.meeting');
  const tSectors = useTranslations('sectors');
  const canPropose = Object.keys(meeting.patch).length > 0;

  return (
    <div className="rounded-lg border border-ai-violet/40 bg-ai-violet/10 px-3 py-2.5 flex flex-col gap-2">
      <p className="text-xs font-semibold text-text-primary">{t('title')}</p>

      <div>
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wide text-text-muted">
          {t('turns')}
        </p>
        <ul className="mt-1 flex flex-col gap-1">
          {meeting.turns.map((turn, idx) => (
            <li key={idx} className="text-xs text-text-secondary">
              {turn.speaker && (
                <span className="font-mono font-semibold text-ai-violet">
                  {t('speaker', { id: turn.speaker })}{' '}
                </span>
              )}
              {turn.text}
            </li>
          ))}
        </ul>
      </div>

      {meeting.priorities.length > 0 && (
        <div>
          <p className="text-[10px] font-mono font-semibold uppercase tracking-wide text-text-muted">
            {t('priorities')}
          </p>
          <ul className="mt-1 flex flex-col gap-1">
            {meeting.priorities.map((p, idx) => (
              <li key={idx} className="text-xs text-text-secondary">
                <span className="font-semibold text-text-primary">{tSectors(p.sector)}</span>
                {' — '}
                {t(WANT_KEY[p.want])}
                {p.timeNote ? ` · ${t(TIME_KEY[p.timeNote])}` : ''}
              </li>
            ))}
          </ul>
        </div>
      )}

      {meeting.unmapped.length > 0 && (
        <ul className="flex flex-col gap-1">
          {meeting.unmapped.map((u, idx) => (
            <li key={idx} className="text-[11px] italic text-text-muted">
              {t('unmapped', { quote: u.quote })}
            </li>
          ))}
        </ul>
      )}

      {canPropose ? (
        <button
          type="button"
          onClick={() =>
            onPropose(meeting.patch, t('reason', { count: meeting.priorities.length }))
          }
          className="min-h-[44px] rounded-control bg-ai-violet text-surface text-sm font-semibold hover:bg-ai-violet/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-energy-cyan"
        >
          {t('propose')}
        </button>
      ) : (
        <p className="text-xs text-text-muted">{t('emptyPatch')}</p>
      )}
    </div>
  );
}
