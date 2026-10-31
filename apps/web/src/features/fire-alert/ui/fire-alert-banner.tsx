'use client';

import Link from 'next/link';
import { Flame } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { fmtHour } from '@/lib/format';
import { useTranslations } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { FireAlert } from '../hooks/use-fire-alerts';

export interface FireAlertBannerProps {
  fires: readonly FireAlert[];
  /** `compact`: one line, for the full-screen views (no links). */
  compact?: boolean;
  className?: string;
}

/** Big red warning while a fire burns (M2-T2): sectors cut, since when, what happens next. */
export function FireAlertBanner({ fires, compact = false, className }: FireAlertBannerProps) {
  const t = useTranslations('features.fireAlert');
  const tSectors = useTranslations('sectors');
  if (fires.length === 0) return null;

  const sectors = fires.map((f) => tSectors(f.sector)).join(', ');
  const since = fmtHour(Math.min(...fires.map((f) => f.startHour)));

  if (compact) {
    return (
      <div
        role="alert"
        className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-card border-2 border-critical-red bg-surface-elevated text-xs font-semibold text-critical-red shadow-lg',
          className
        )}
      >
        <Flame className="h-4 w-4 shrink-0 motion-safe:animate-pulse" aria-hidden="true" />
        <span className="min-w-0">{t('bannerTitle', { sectors })}</span>
        <span className="shrink-0 font-mono text-[10px] text-text-secondary">{since}</span>
      </div>
    );
  }

  return (
    <div
      role="alert"
      className={cn(
        'rounded-card border-2 border-critical-red bg-surface-elevated shadow-lg overflow-hidden',
        className
      )}
    >
      <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-4 p-4 md:p-5 bg-critical-red/10">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <span className="shrink-0 h-12 w-12 rounded-full bg-critical-red/20 border border-critical-red/50 flex items-center justify-center">
            <Flame
              className="h-7 w-7 text-critical-red motion-safe:animate-pulse"
              aria-hidden="true"
            />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-base md:text-lg font-bold text-critical-red">
                {t('bannerTitle', { sectors })}
              </h2>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold uppercase border border-border text-text-secondary">
                {t('simulatedTag')}
              </span>
            </div>
            <p className="mt-1 text-xs md:text-sm text-text-primary leading-relaxed">
              {t('bannerDesc', { hour: since })}
            </p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 shrink-0">
          <Link
            href="/simulation"
            className={buttonVariants({
              variant: 'secondary',
              size: 'sm',
              className: 'min-h-11 justify-center',
            })}
          >
            {t('seeVillage')}
          </Link>
          <Link
            href="/copilot"
            className={buttonVariants({
              variant: 'danger',
              size: 'sm',
              className: 'min-h-11 justify-center',
            })}
          >
            {t('askCopilot')}
          </Link>
        </div>
      </div>
    </div>
  );
}
