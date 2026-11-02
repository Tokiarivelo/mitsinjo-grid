'use client';

import { Bot } from 'lucide-react';
import { useTranslations } from '@/lib/i18n';
import { fmtKwh, fmtKw } from '@/lib/format';
import type { AutonomyEnvelope } from '@/lib/envelope';
import type { AutopilotEntry } from './use-autopilot';

export interface AutopilotCardProps {
  enabled: boolean;
  setEnabled: (on: boolean) => void;
  envelope: AutonomyEnvelope;
  setEnvelope: (e: AutonomyEnvelope) => void;
  pending: AutopilotEntry | null;
  history: AutopilotEntry[];
  accept: (id: string) => void;
  refuse: (id: string) => void;
}

const DECISION_KEY = {
  pending: 'autopilotPending',
  accepted: 'autopilotAccepted',
  refused: 'autopilotRefused',
  expired: 'autopilotExpired',
} as const;

function reasonText(
  t: (key: string, params?: Record<string, string | number>) => string,
  entry: AutopilotEntry
): string {
  const { suggestion } = entry;
  if (suggestion.rule === 'strategy') {
    return t('autopilotReasonStrategy', {
      hour: `${entry.hour}:00`,
      short: fmtKwh(suggestion.shortKwh),
      strategy: suggestion.strategy ?? '',
    });
  }
  const floor = suggestion.patch?.lifeline?.kw?.health ?? 0;
  return t('autopilotReasonLifeline', {
    hour: `${entry.hour}:00`,
    short: fmtKwh(suggestion.shortKwh),
    floor: fmtKw(floor),
  });
}

/**
 * Autopilot deck card (M10-T1, envelope M10-T3): toggle (off by default), one-tap accept/refuse
 * on the pending suggestion, decision history. Envelope switches decide what applies alone in
 * simulation — both off by default, so every apply is the operator's tap unless opened.
 */
export function AutopilotCard({
  enabled,
  setEnabled,
  envelope,
  setEnvelope,
  pending,
  history,
  accept,
  refuse,
}: AutopilotCardProps) {
  const t = useTranslations('features.simulation');

  return (
    <div className="rounded-card border border-border/70 bg-surface/60 p-3 flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-text-primary">
          <Bot className="h-4 w-4 text-ai-violet" aria-hidden="true" />
          {t('autopilotTitle')}
        </p>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label={t('autopilotTitle')}
          onClick={() => setEnabled(!enabled)}
          className="relative min-h-[36px] min-w-[52px] rounded-full border border-border bg-surface-elevated px-1 transition-colors data-[on=true]:border-ai-violet data-[on=true]:bg-ai-violet/30"
          data-on={enabled}
        >
          <span
            aria-hidden="true"
            className={`block h-6 w-6 rounded-full bg-text-muted transition-transform ${enabled ? 'translate-x-5 bg-ai-violet' : ''}`}
          />
        </button>
      </div>

      {pending && (
        <div className="rounded-lg border border-ai-violet/40 bg-ai-violet/10 px-3 py-2">
          <p className="text-xs text-text-primary">{reasonText(t, pending)}</p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => accept(pending.id)}
              className="flex-1 min-h-[44px] rounded-control bg-ai-violet text-surface text-sm font-semibold hover:bg-ai-violet/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-energy-cyan"
            >
              {t('autopilotAccept')}
            </button>
            <button
              type="button"
              onClick={() => refuse(pending.id)}
              className="flex-1 min-h-[44px] rounded-control border border-border bg-surface text-sm font-medium text-text-primary hover:border-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-energy-cyan"
            >
              {t('autopilotRefuse')}
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-1.5 border-t border-border/70 pt-2">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wide text-text-muted">
          {t('envelopeTitle')}
        </p>
        {(
          [
            ['strategyChange', 'envelopeStrategy'],
            ['clinicFloor', 'envelopeClinicFloor'],
          ] as const
        ).map(([key, labelKey]) => (
          <div
            key={key}
            className="flex items-center justify-between gap-2 text-xs text-text-secondary"
          >
            <span id={`envelope-${key}`}>{t(labelKey)}</span>
            <button
              type="button"
              role="switch"
              aria-checked={envelope[key]}
              aria-labelledby={`envelope-${key}`}
              onClick={() => setEnvelope({ ...envelope, [key]: !envelope[key] })}
              className="relative min-h-[36px] min-w-[52px] rounded-full border border-border bg-surface-elevated px-1 transition-colors data-[on=true]:border-ai-violet data-[on=true]:bg-ai-violet/30"
              data-on={envelope[key]}
            >
              <span
                aria-hidden="true"
                className={`block h-6 w-6 rounded-full bg-text-muted transition-transform ${envelope[key] ? 'translate-x-5 bg-ai-violet' : ''}`}
              />
            </button>
          </div>
        ))}
      </div>

      {history.length > 0 && (
        <div>
          <p className="text-[10px] font-mono font-semibold uppercase tracking-wide text-text-muted">
            {t('autopilotHistory')}
          </p>
          <ul className="mt-1 flex flex-col gap-1 max-h-28 overflow-y-auto">
            {history.map((e) => (
              <li
                key={e.id}
                className="flex items-center justify-between gap-2 text-[11px] text-text-secondary"
              >
                <span className="min-w-0 truncate">{reasonText(t, e)}</span>
                <span className="shrink-0 font-mono">
                  {t(DECISION_KEY[e.decision])}
                  {e.auto ? ` · ${t('envelopeAuto')}` : ''}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
