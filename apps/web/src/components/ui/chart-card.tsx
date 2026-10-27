import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { useTranslations } from '@/lib/i18n';
import { EmptyState } from './empty-state';

export interface ChartCardProps {
  title: string;
  subtitle?: string;
  unit?: string;
  legend?: ReactNode;
  summary: string;
  empty?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyActionLabel?: string;
  onEmptyAction?: () => void;
  loading?: boolean;
  children?: ReactNode;
  className?: string;
}

export function ChartCard({
  title,
  subtitle,
  unit,
  legend,
  summary,
  empty = false,
  emptyTitle,
  emptyDescription,
  emptyActionLabel,
  onEmptyAction,
  loading = false,
  children,
  className,
}: ChartCardProps) {
  const tUi = useTranslations('ui.chartCard');

  return (
    <div
      className={cn(
        'relative flex flex-col p-5 rounded-card bg-surface border border-border shadow-sm',
        className
      )}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-border/60">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-display text-sm font-semibold text-text-primary tracking-tight">
              {title}
            </h3>
            {unit && (
              <span className="text-[11px] font-mono text-text-muted px-1.5 py-0.5 rounded-control-sm bg-surface-elevated border border-border">
                {unit}
              </span>
            )}
          </div>
          {subtitle && <p className="text-xs text-text-secondary mt-0.5">{subtitle}</p>}
        </div>

        {legend && <div className="flex items-center gap-2 text-xs">{legend}</div>}
      </div>

      {/* Screen-reader accessible summary */}
      <p className="sr-only">{summary}</p>

      {/* Chart body */}
      <div className="mt-4 min-h-[240px] flex flex-col justify-center">
        {loading ? (
          <div className="h-60 w-full bg-surface-elevated animate-pulse rounded-control" />
        ) : empty ? (
          <EmptyState
            title={emptyTitle || tUi('noDataTitle')}
            description={emptyDescription || tUi('noDataDesc')}
            actionLabel={emptyActionLabel}
            onAction={onEmptyAction}
          />
        ) : (
          children
        )}
      </div>
    </div>
  );
}
