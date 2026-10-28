import { AlertCircle, ShieldAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslations } from '@/lib/i18n';
import { EMPTY_PLACEHOLDER } from '@/lib/format';

export type SectorPriority = 'critical' | 'high' | 'medium' | 'low';
export type EnergyBarStatus = 'full' | 'partial' | 'critical';

export interface EnergyBarProps {
  label: string;
  sectorId?: string;
  valuePct: number;
  servedKwh?: number;
  demandKwh?: number;
  priority?: SectorPriority;
  status?: EnergyBarStatus;
  showValues?: boolean;
  /** No simulation result yet: show a dash, an empty track and no status text. */
  empty?: boolean;
  className?: string;
}

export function EnergyBar({
  label,
  valuePct,
  servedKwh,
  demandKwh,
  priority,
  status,
  showValues = true,
  empty = false,
  className,
}: EnergyBarProps) {
  const tUi = useTranslations('ui.energyBar');
  const tPriorities = useTranslations('priorities');
  const clampedPct = Math.max(0, Math.min(100, Math.round(valuePct * 10) / 10));

  // Determine status if not explicitly passed
  const resolvedStatus: EnergyBarStatus =
    status || (clampedPct >= 99.9 ? 'full' : priority === 'critical' ? 'critical' : 'partial');

  const fillClass = {
    full: 'bg-battery-green',
    partial: 'bg-warning-amber',
    critical: 'bg-critical-red',
  }[resolvedStatus];

  const priorityBadge = priority ? (
    <span
      className={cn(
        'text-[10px] uppercase font-mono px-1.5 py-0.5 rounded-control-sm border tracking-wide',
        priority === 'critical'
          ? 'bg-critical-red/15 text-critical-red border-critical-red/30'
          : priority === 'high'
            ? 'bg-warning-amber/12 text-warning-amber border-warning-amber/30'
            : 'bg-surface-elevated text-text-muted border-border'
      )}
    >
      {tPriorities(priority)}
    </span>
  ) : null;

  return (
    <div className={cn('flex flex-col gap-1.5 py-1.5', className)}>
      {/* Top line: Label, Priority, Values and Percentage */}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs font-sans">
        <div className="flex items-center gap-2">
          <span className="font-medium text-text-primary">{label}</span>
          {priorityBadge}
        </div>
        <div className="ml-auto flex items-center gap-3 font-mono text-xs whitespace-nowrap">
          {showValues && !empty && servedKwh !== undefined && demandKwh !== undefined && (
            <span className="text-text-muted text-[11px]">
              {servedKwh.toFixed(1)} / {demandKwh.toFixed(1)} kWh
            </span>
          )}
          <span
            className={cn(
              'font-semibold min-w-[44px] text-right',
              empty
                ? 'text-text-muted'
                : resolvedStatus === 'full'
                  ? 'text-battery-green'
                  : resolvedStatus === 'critical'
                    ? 'text-critical-red'
                    : 'text-warning-amber'
            )}
          >
            {empty ? EMPTY_PLACEHOLDER : `${clampedPct}%`}
          </span>
        </div>
      </div>

      {/* Progress Track */}
      <div
        role="progressbar"
        aria-valuenow={empty ? undefined : clampedPct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${label} ${tUi('coverageLabel')}`}
        aria-valuetext={
          empty ? EMPTY_PLACEHOLDER : `${label}: ${clampedPct}% ${tUi('coveredText')}`
        }
        className="h-2 w-full bg-surface-elevated rounded-full overflow-hidden border border-border/40"
      >
        <div
          className={cn('h-full transition-all duration-fast rounded-full', fillClass)}
          style={{ width: `${empty ? 0 : clampedPct}%` }}
        />
      </div>

      {/* Optional status text if partial or critical */}
      {!empty && resolvedStatus !== 'full' && (
        <div className="flex items-center gap-1 text-[11px] font-sans mt-0.5">
          {resolvedStatus === 'critical' ? (
            <>
              <ShieldAlert className="h-3 w-3 text-critical-red shrink-0" aria-hidden="true" />
              <span className="text-critical-red">{tUi('essentialShortfall')}</span>
            </>
          ) : (
            <>
              <AlertCircle className="h-3 w-3 text-warning-amber shrink-0" aria-hidden="true" />
              <span className="text-warning-amber">{tUi('partialSupply')}</span>
            </>
          )}
        </div>
      )}
    </div>
  );
}
