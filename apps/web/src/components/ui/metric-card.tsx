import type { ReactNode } from 'react';
import { ArrowDown, ArrowUp, BatteryCharging, Factory, HeartPulse, Sun, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

export type MetricCardVariant = 'solar' | 'battery' | 'demand' | 'essential';
export type MetricCardStatus = 'normal' | 'warning' | 'critical';

export interface MetricCardProps {
  variant: MetricCardVariant;
  label: string;
  value: string | number;
  unit: string;
  delta?: {
    value: string | number;
    direction: 'up' | 'down' | 'neutral';
    label: string;
  };
  caption?: string;
  icon?: ReactNode;
  status?: MetricCardStatus;
  loading?: boolean;
  empty?: boolean;
  className?: string;
}

export function MetricCard({
  variant,
  label,
  value,
  unit,
  delta,
  caption,
  icon,
  status = 'normal',
  loading = false,
  empty = false,
  className,
}: MetricCardProps) {
  // Variant accent rules
  const variantColor = () => {
    if (status === 'critical') return 'text-critical-red border-critical-red/30';
    if (status === 'warning') return 'text-warning-amber border-warning-amber/30';

    switch (variant) {
      case 'solar':
        return 'text-solar-amber border-border';
      case 'battery':
        return 'text-battery-green border-border';
      case 'demand':
        return 'text-energy-cyan border-border';
      case 'essential':
        return 'text-battery-green border-border';
    }
  };

  const defaultIcon = () => {
    switch (variant) {
      case 'solar':
        return <Sun className="h-4 w-4 text-solar-amber" aria-hidden="true" />;
      case 'battery':
        return <BatteryCharging className="h-4 w-4 text-battery-green" aria-hidden="true" />;
      case 'demand':
        return <Factory className="h-4 w-4 text-energy-cyan" aria-hidden="true" />;
      case 'essential':
        return <HeartPulse className="h-4 w-4 text-battery-green" aria-hidden="true" />;
    }
  };

  return (
    <div
      className={cn(
        'relative flex flex-col justify-between p-5 rounded-card bg-surface border border-border shadow-sm transition-all',
        variantColor(),
        className
      )}
    >
      {/* Top row: Label & Icon */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-sans font-medium text-text-secondary uppercase tracking-wider">
          {label}
        </span>
        <div className="p-1.5 rounded-control-sm bg-surface-elevated shrink-0">
          {icon || defaultIcon()}
        </div>
      </div>

      {/* Main value + unit */}
      <div className="mt-3 flex items-baseline gap-2">
        {loading ? (
          <div className="h-9 w-28 bg-surface-elevated animate-pulse rounded-control-sm" />
        ) : empty ? (
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-display font-semibold text-text-muted">--</span>
            <span className="text-sm font-mono text-text-muted">{unit}</span>
          </div>
        ) : (
          <div className="flex items-baseline gap-1.5 flex-wrap">
            <span className="text-3xl font-display font-semibold text-text-primary tracking-tight">
              {value}
            </span>
            <span className="text-sm font-mono text-text-secondary font-medium">{unit}</span>
          </div>
        )}
      </div>

      {/* Delta & Status or Caption */}
      <div className="mt-3 pt-2.5 border-t border-border/60 flex items-center justify-between text-xs">
        {delta ? (
          <div className="flex items-center gap-1 font-mono">
            {delta.direction === 'up' && (
              <ArrowUp className="h-3 w-3 text-solar-amber" aria-hidden="true" />
            )}
            {delta.direction === 'down' && (
              <ArrowDown className="h-3 w-3 text-energy-cyan" aria-hidden="true" />
            )}
            <span className="text-text-primary font-medium">{delta.value}</span>
            <span className="text-text-muted ml-0.5">{delta.label}</span>
          </div>
        ) : caption ? (
          <span className="text-text-muted font-sans text-xs">{caption}</span>
        ) : (
          <span className="text-text-muted font-mono text-[11px]">24h simulation</span>
        )}

        {status === 'warning' && (
          <span className="inline-flex items-center gap-1 text-[11px] font-mono text-warning-amber">
            <AlertTriangle className="h-3 w-3" aria-hidden="true" />
            WARNING
          </span>
        )}
        {status === 'critical' && (
          <span className="inline-flex items-center gap-1 text-[11px] font-mono text-critical-red">
            <AlertTriangle className="h-3 w-3" aria-hidden="true" />
            CRITICAL
          </span>
        )}
      </div>
    </div>
  );
}
