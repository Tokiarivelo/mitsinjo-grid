'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { CloudSun, Eye, Play, ShieldCheck, Siren, Sparkles } from 'lucide-react';
import { fmtHour, fmtKwh, fmtNum, fmtPct } from '@/lib/format';
import { useTranslations } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { Button, buttonVariants } from '@/components/ui/button';
import type { Incident } from '../utils/incident';

type HeroState = 'empty' | 'risk' | 'safe';

export interface IncidentHeroProps {
  incident: Incident | null;
  /** Translated name of the active strategy. */
  strategyName: string;
  /** Essential coverage of the active strategy (engine, 0–100). */
  coveragePct: number | null;
  isRunning: boolean;
  /** Twin preview shown beside the text. */
  visual: ReactNode;
  onRun: () => void;
  onSolarDrop: () => void;
  onShowHour: (hour: number) => void;
}

const stateStyles: Record<HeroState, { glow: string; pill: string; dot: string }> = {
  risk: {
    glow: 'from-critical-red/30 via-warning-amber/10',
    pill: 'bg-critical-red/15 text-critical-red border-critical-red/40',
    dot: 'bg-critical-red',
  },
  safe: {
    glow: 'from-battery-green/25 via-energy-cyan/10',
    pill: 'bg-battery-green/15 text-battery-green border-battery-green/40',
    dot: 'bg-battery-green',
  },
  empty: {
    glow: 'from-solar-amber/25 via-energy-cyan/10',
    pill: 'bg-solar-amber/15 text-solar-amber border-solar-amber/40',
    dot: 'bg-solar-amber',
  },
};

const ctaSize = 'h-11 px-5';

/** Full-width incident banner: the one thing at stake today, its impact, and the next step. */
export function IncidentHero({
  incident,
  strategyName,
  coveragePct,
  isRunning,
  visual,
  onRun,
  onSolarDrop,
  onShowHour,
}: IncidentHeroProps) {
  const t = useTranslations('overview.incident');
  const state: HeroState = !incident ? 'empty' : incident.atRisk ? 'risk' : 'safe';
  const s = stateStyles[state];
  const startHour = incident?.window?.fromHour ?? null;

  return (
    <section
      aria-labelledby="incident-title"
      className="relative isolate overflow-hidden rounded-card border border-border bg-surface shadow-sm"
    >
      {/* Coloured light behind the content: red when at risk, green when safe */}
      <div
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute -top-32 -left-32 -z-10 h-[28rem] w-[28rem] rounded-full bg-gradient-to-br to-transparent blur-3xl',
          s.glow
        )}
      />

      <div className="grid grid-cols-1 lg:grid-cols-12">
        <div className="lg:col-span-6 flex flex-col gap-5 p-5 sm:p-8">
          <span
            className={cn(
              'inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-mono font-semibold uppercase tracking-widest',
              s.pill
            )}
          >
            <span className="relative flex h-2 w-2" aria-hidden="true">
              <span
                className={cn(
                  'absolute inline-flex h-full w-full rounded-full opacity-75 motion-safe:animate-ping',
                  s.dot
                )}
              />
              <span className={cn('relative inline-flex h-2 w-2 rounded-full', s.dot)} />
            </span>
            {t(`pill.${state}`)}
          </span>

          <div>
            <h1
              id="incident-title"
              className="font-display text-3xl sm:text-4xl xl:text-5xl font-bold leading-[1.05] tracking-tight text-text-primary"
            >
              {state === 'risk' && startHour !== null
                ? t('riskTitle', { hour: fmtHour(startHour) })
                : t(`title.${state}`)}
            </h1>
            <p className="mt-3 max-w-xl text-sm sm:text-base text-text-secondary leading-relaxed">
              {state === 'risk' && incident
                ? t('riskDesc', { strategy: strategyName, kwh: fmtKwh(incident.shortfallKwh) })
                : state === 'safe'
                  ? t('safeDesc', { strategy: strategyName })
                  : t('emptyDesc')}
            </p>
          </div>

          {state === 'risk' && incident && (
            <dl className="grid grid-cols-3 gap-2 sm:gap-3">
              <ImpactStat
                tone="critical"
                value={fmtHour(startHour)}
                label={t('stats.start')}
                icon={<Siren className="h-4 w-4" aria-hidden="true" />}
              />
              <ImpactStat
                tone="critical"
                value={t('hoursValue', { hours: fmtNum(incident.unmetHours, 0) })}
                label={t('stats.hours')}
              />
              <ImpactStat
                tone="warning"
                value={fmtKwh(incident.shortfallKwh)}
                label={t('stats.missing')}
              />
            </dl>
          )}

          {state === 'safe' && (
            <dl className="grid grid-cols-2 gap-2 sm:gap-3 max-w-sm">
              <ImpactStat
                tone="safe"
                value={fmtPct(coveragePct, 0)}
                label={t('stats.coverage')}
                icon={<ShieldCheck className="h-4 w-4" aria-hidden="true" />}
              />
              <ImpactStat
                tone="safe"
                value={t('hoursValue', { hours: fmtNum(incident?.unmetHours, 0) })}
                label={t('stats.hours')}
              />
            </dl>
          )}

          <div className="flex flex-col sm:flex-row flex-wrap gap-2.5">
            {state === 'risk' && (
              <>
                <Link
                  href="/copilot"
                  className={buttonVariants({ variant: 'primary', className: ctaSize })}
                >
                  <Sparkles className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{t('askCopilot')}</span>
                </Link>
                {startHour !== null && (
                  <Button
                    variant="secondary"
                    className={ctaSize}
                    icon={<Eye className="h-4 w-4" aria-hidden="true" />}
                    onClick={() => onShowHour(startHour)}
                  >
                    {t('showAt', { hour: fmtHour(startHour) })}
                  </Button>
                )}
              </>
            )}
            {state !== 'risk' && (
              <Button
                variant="primary"
                className={ctaSize}
                loading={isRunning}
                icon={<CloudSun className="h-4 w-4" aria-hidden="true" />}
                onClick={onSolarDrop}
              >
                {t('solarDrop')}
              </Button>
            )}
            {state === 'empty' && (
              <Button
                variant="secondary"
                className={ctaSize}
                loading={isRunning}
                icon={<Play className="h-4 w-4" aria-hidden="true" />}
                onClick={onRun}
              >
                {t('run')}
              </Button>
            )}
            {state === 'safe' && (
              <Link
                href="/copilot"
                className={buttonVariants({ variant: 'secondary', className: ctaSize })}
              >
                <Sparkles className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{t('askCopilotSafe')}</span>
              </Link>
            )}
          </div>
        </div>

        <div className="lg:col-span-6 border-t lg:border-t-0 lg:border-l border-border/60 p-3 sm:p-4">
          {visual}
        </div>
      </div>
    </section>
  );
}

type StatTone = 'critical' | 'warning' | 'safe';

const statTone: Record<StatTone, string> = {
  critical: 'text-critical-red border-critical-red/30 bg-critical-red/5',
  warning: 'text-warning-amber border-warning-amber/30 bg-warning-amber/5',
  safe: 'text-battery-green border-battery-green/30 bg-battery-green/5',
};

function ImpactStat({
  value,
  label,
  tone,
  icon,
}: {
  value: string;
  label: string;
  tone: StatTone;
  icon?: ReactNode;
}) {
  return (
    <div className={cn('flex flex-col gap-1 rounded-control border p-2.5 sm:p-3', statTone[tone])}>
      <dt className="order-2 text-[11px] sm:text-xs leading-snug text-text-secondary">{label}</dt>
      <dd className="order-1 flex items-center gap-1.5 font-display text-xl sm:text-3xl font-bold tabular-nums leading-none">
        {icon}
        <span className="truncate">{value}</span>
      </dd>
    </div>
  );
}
