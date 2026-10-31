'use client';

import { Flame, X } from 'lucide-react';
import { fmtHour } from '@/lib/format';
import { useTranslations } from '@/lib/i18n';
import type { FireAlert } from '../hooks/use-fire-alerts';

export interface FireSnackbarsProps {
  items: readonly FireAlert[];
  onDismiss: (key: string) => void;
}

/** Pop-up notices, bottom right (above the mobile nav), one per fire that just started. */
export function FireSnackbars({ items, onDismiss }: FireSnackbarsProps) {
  const t = useTranslations('features.fireAlert');
  const tSectors = useTranslations('sectors');
  if (items.length === 0) return null;
  return (
    <div
      aria-label={t('notificationsLabel')}
      className="fixed z-[60] bottom-20 md:bottom-6 inset-x-3 md:inset-x-auto md:right-6 md:w-96 flex flex-col gap-2 pointer-events-none"
    >
      {items.map((f) => (
        <div
          key={f.key}
          role="alert"
          className="pointer-events-auto flex items-start gap-3 p-3 rounded-card border border-critical-red/60 border-l-4 border-l-critical-red bg-surface-elevated shadow-xl motion-safe:animate-in motion-safe:slide-in-from-bottom-2"
        >
          <Flame className="h-5 w-5 mt-0.5 shrink-0 text-critical-red" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-text-primary">
              {t('snackbarTitle', { sector: tSectors(f.sector) })}
            </p>
            <p className="text-xs text-text-secondary mt-0.5">
              {t('snackbarBody', { hour: fmtHour(f.startHour) })}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onDismiss(f.key)}
            aria-label={t('dismiss')}
            className="h-11 w-11 -m-2 shrink-0 inline-flex items-center justify-center rounded-control-sm text-text-muted hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-energy-cyan"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      ))}
    </div>
  );
}
