'use client';

import { CalendarDays } from 'lucide-react';
import type { Workflow, WorkflowResult } from '@mitsinjo/engine';
import { cn } from '@/lib/utils';
import { useTranslations } from '@/lib/i18n';
import { WeatherPill } from './weather-pill';
import { CRITICAL_DEFICIT_KWH } from '../utils/weather';

export interface DayStripProps {
  workflow: Workflow;
  dayIndex: number;
  /** Active strategy's workflow result (flags days with a critical deficit). */
  workflowResult?: WorkflowResult;
  onSelectDay: (day: number) => void;
  className?: string;
}

/** Day selector above the 24 h timeline: one weather pill per workflow day. */
export function DayStrip({
  workflow,
  dayIndex,
  workflowResult,
  onSelectDay,
  className,
}: DayStripProps) {
  const t = useTranslations('features.simulation.workflow');
  return (
    <nav
      aria-label={t('stripLabel')}
      className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-card bg-surface border border-border shadow-sm min-w-0',
        className
      )}
    >
      <CalendarDays className="h-4 w-4 shrink-0 text-energy-cyan" aria-hidden="true" />
      <div className="flex items-center gap-2 overflow-x-auto py-1 [-webkit-overflow-scrolling:touch]">
        {workflow.map((d, i) => {
          const critical =
            (workflowResult?.days[i]?.result.metrics.criticalUnservedKwh ?? 0) >
            CRITICAL_DEFICIT_KWH;
          const label = t('dayLabel', { n: i + 1 });
          const weather = t(`weather.${d.weather}`);
          return (
            <WeatherPill
              key={i}
              weather={d.weather}
              label={label}
              selected={i === dayIndex}
              alert={critical}
              ariaLabel={
                critical
                  ? t('dayPillCritical', { day: label, weather })
                  : t('dayPill', { day: label, weather })
              }
              onClick={() => onSelectDay(i)}
            />
          );
        })}
      </div>
    </nav>
  );
}
