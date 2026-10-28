'use client';

import { CalendarRange, Plus, X } from 'lucide-react';
import {
  MAX_WORKFLOW_DAYS,
  WEATHER_IDS,
  type WeatherId,
  type Workflow,
  type WorkflowResult,
} from '@mitsinjo/engine';
import { cn } from '@/lib/utils';
import { fmtKwh, fmtPct } from '@/lib/format';
import { useTranslations } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { WeatherPill } from './weather-pill';
import { CRITICAL_DEFICIT_KWH } from '../utils/weather';

export interface WeatherWorkflowPanelProps {
  workflow: Workflow;
  dayIndex: number;
  /** Active strategy's result; only shown when the run is up to date. */
  workflowResult?: WorkflowResult;
  onAddDay: () => void;
  onRemoveDay: (day: number) => void;
  onSetWeather: (day: number, weather: WeatherId) => void;
  onSelectDay: (day: number) => void;
  className?: string;
}

/** Builds the multi-day weather sequence: Day 1 → sunny, Day 2 → cloudy… */
export function WeatherWorkflowPanel({
  workflow,
  dayIndex,
  workflowResult,
  onAddDay,
  onRemoveDay,
  onSetWeather,
  onSelectDay,
  className,
}: WeatherWorkflowPanelProps) {
  const t = useTranslations('features.simulation.workflow');
  const canAdd = workflow.length < MAX_WORKFLOW_DAYS;
  const canRemove = workflow.length > 1;

  return (
    <section
      aria-labelledby="weather-workflow-title"
      className={cn(
        'flex flex-col gap-4 p-5 rounded-card bg-surface border border-border shadow-sm',
        className
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-border/60">
        <div className="flex items-center gap-2 min-w-0">
          <CalendarRange className="h-4 w-4 shrink-0 text-energy-cyan" aria-hidden="true" />
          <h3
            id="weather-workflow-title"
            className="font-display text-sm font-semibold text-text-primary tracking-tight whitespace-nowrap"
          >
            {t('title')}
          </h3>
          <span className="text-[10px] font-mono text-text-muted whitespace-nowrap">
            {t('dayCount', { count: workflow.length, max: MAX_WORKFLOW_DAYS })}
          </span>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={onAddDay}
          disabled={!canAdd}
          icon={<Plus className="h-3.5 w-3.5" aria-hidden="true" />}
          className="min-h-11 shrink-0 whitespace-nowrap"
        >
          {t('addDay')}
        </Button>
      </div>

      <p className="text-xs text-text-secondary">{t('description')}</p>

      <ol className="flex flex-col gap-3">
        {workflow.map((d, i) => {
          const dayLabel = t('dayLabel', { n: i + 1 });
          const m = workflowResult?.days[i]?.result.metrics;
          const isCurrent = i === dayIndex;
          return (
            <li
              key={i}
              className={cn(
                'flex flex-col gap-2 p-3 rounded-control border',
                isCurrent ? 'border-energy-cyan/60 bg-energy-cyan/5' : 'border-border/60'
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => onSelectDay(i)}
                  aria-current={isCurrent ? 'step' : undefined}
                  className="min-h-11 text-left text-xs font-semibold text-text-primary hover:text-energy-cyan cursor-pointer"
                >
                  {dayLabel}
                </button>
                <div className="flex items-center gap-2">
                  {m && (
                    <span
                      className={cn(
                        'text-[10px] font-mono',
                        m.criticalUnservedKwh > CRITICAL_DEFICIT_KWH
                          ? 'text-critical-red'
                          : 'text-text-muted'
                      )}
                    >
                      {t('daySummary', {
                        soc: fmtPct(m.socEndPct, 0),
                        unserved: fmtKwh(m.unservedKwh),
                      })}
                    </span>
                  )}
                  {canRemove && (
                    <button
                      type="button"
                      onClick={() => onRemoveDay(i)}
                      aria-label={t('removeDay', { day: dayLabel })}
                      title={t('removeDay', { day: dayLabel })}
                      className="inline-flex items-center justify-center h-11 w-11 rounded-control text-text-muted hover:text-critical-red hover:bg-surface-hover cursor-pointer"
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
                    </button>
                  )}
                </div>
              </div>
              <div
                role="radiogroup"
                aria-label={t('weatherFor', { day: dayLabel })}
                className="flex flex-wrap gap-2"
              >
                {WEATHER_IDS.map((w) => (
                  <WeatherPill
                    key={w}
                    role="radio"
                    weather={w}
                    label={t(`weather.${w}`)}
                    selected={d.weather === w}
                    onClick={() => onSetWeather(i, w)}
                  />
                ))}
              </div>
            </li>
          );
        })}
      </ol>

      {workflowResult && workflow.length > 1 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-3 border-t border-border/60 text-xs">
          <div className="flex flex-col">
            <span className="text-text-muted">{t('totalSolar')}</span>
            <span className="font-mono text-text-primary">
              {fmtKwh(workflowResult.totals.solarKwh)}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-text-muted">{t('totalUnserved')}</span>
            <span className="font-mono text-text-primary">
              {fmtKwh(workflowResult.totals.unservedKwh)}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-text-muted">{t('socRange')}</span>
            <span className="font-mono text-text-primary">
              {t('socRangeValue', {
                min: fmtPct(workflowResult.totals.socMinPct, 0),
                end: fmtPct(workflowResult.totals.socEndPct, 0),
              })}
            </span>
          </div>
        </div>
      )}
    </section>
  );
}
