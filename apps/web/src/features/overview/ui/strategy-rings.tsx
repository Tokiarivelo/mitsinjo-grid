'use client';

import Link from 'next/link';
import { ArrowRight, Crown } from 'lucide-react';
import type { StrategyId } from '@mitsinjo/engine';
import { fmtNum } from '@/lib/format';
import { useTranslations } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';
import type { StrategyCoverage } from '../utils/incident';
import { CoverageRing } from './coverage-ring';

export interface StrategyRingsProps {
  strategies: readonly StrategyCoverage[];
  active: StrategyId;
  best: StrategyId | null;
}

/** "Same day, different decision": essential coverage of each strategy as big rings. */
export function StrategyRings({ strategies, active, best }: StrategyRingsProps) {
  const t = useTranslations('overview.incident');
  const tStrategies = useTranslations('strategies');

  return (
    <section
      aria-labelledby="strategy-rings-title"
      className="rounded-card border border-border bg-surface p-5 sm:p-8 shadow-sm"
    >
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <h2
            id="strategy-rings-title"
            className="font-display text-xl sm:text-2xl font-bold tracking-tight text-text-primary"
          >
            {t('ringsTitle')}
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-text-secondary">{t('ringsDesc')}</p>
        </div>
        <Link
          href="/strategies"
          className={buttonVariants({ variant: 'secondary', className: 'h-11 shrink-0' })}
        >
          <span>{tStrategies('compareBtn')}</span>
          <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
        </Link>
      </div>

      <ul className="mt-6 grid grid-cols-3 gap-2 sm:gap-6">
        {strategies.map((s) => {
          const name = tStrategies(s.id);
          const isBest = s.id === best;
          const isActive = s.id === active;
          return (
            <li
              key={s.id}
              className={cn(
                'flex flex-col items-center gap-2 sm:gap-3 rounded-card border p-2 sm:p-4 text-center',
                isBest ? 'border-battery-green/40 bg-battery-green/5' : 'border-border/60'
              )}
            >
              <CoverageRing
                pct={s.coveragePct}
                tone={s.coveragePct >= 99.95 ? 'safe' : 'critical'}
                label={t('ringLabel', { strategy: name })}
                caption={t('ringCaption')}
              />
              <span className="font-display text-xs sm:text-sm font-semibold leading-tight text-text-primary">
                {name}
              </span>
              <span
                className={cn(
                  'font-display text-sm sm:text-lg font-bold tabular-nums',
                  s.unmetHours > 0 ? 'text-critical-red' : 'text-battery-green'
                )}
              >
                {t('ringHours', { hours: fmtNum(s.unmetHours, 0) })}
              </span>
              <div className="flex flex-wrap justify-center gap-1.5 min-h-6">
                {isActive && (
                  <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-text-secondary">
                    {tStrategies('activeBadge')}
                  </span>
                )}
                {isBest && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-battery-green/40 bg-battery-green/10 px-2 py-0.5 text-[11px] font-semibold text-battery-green">
                    <Crown className="h-3 w-3" aria-hidden="true" />
                    {tStrategies('bestEssentialBadge')}
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
