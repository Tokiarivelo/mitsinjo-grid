import {
  AlertTriangle,
  BatteryCharging,
  CheckCircle2,
  Info,
  Search,
  Sliders,
  ZapOff,
} from 'lucide-react';
import type { SimWarning } from '@mitsinjo/engine';
import { cn } from '@/lib/utils';
import { fmtHour } from '@/lib/format';
import { useTranslations } from '@/lib/i18n';

export interface ImpactBannerProps {
  warnings: readonly SimWarning[];
  className?: string;
  showNominal?: boolean;
}

export function ImpactBanner({ warnings, className, showNominal = true }: ImpactBannerProps) {
  const tWarnings = useTranslations('warnings');
  const tSectors = useTranslations('sectors');

  if (!warnings || warnings.length === 0) {
    if (!showNominal) return null;
    return (
      <div
        className={cn(
          'flex items-start gap-3 p-4 rounded-card bg-battery-green/5 border border-battery-green/30 text-xs',
          className
        )}
      >
        <div className="p-1 rounded-control-sm bg-battery-green/15 text-battery-green shrink-0 mt-0.5">
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
        </div>
        <div>
          <h4 className="font-display font-semibold text-text-primary text-xs">
            {tWarnings('essentialSupplied')}
          </h4>
          <p className="mt-0.5 text-text-secondary leading-relaxed text-xs">
            {tWarnings('noWarningsDesc')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn('flex flex-col gap-2.5', className)}
      role="region"
      aria-label={tWarnings('title')}
    >
      {warnings.map((w, idx) => {
        const key = `${w.code}-${w.sector ?? 'all'}-${w.fromHour}-${w.toHour}-${idx}`;
        const fromStr = fmtHour(w.fromHour);
        const toStr = fmtHour(w.toHour);
        const timeRange = tWarnings('hoursRange', { from: fromStr, to: toStr });

        let toneClass = 'border-warning-amber/30 bg-warning-amber/10 text-warning-amber';
        let icon = <AlertTriangle className="h-4 w-4" aria-hidden="true" />;
        let title = tWarnings('sectorPartialTitle');
        let desc = '';

        switch (w.code) {
          case 'CRITICAL_UNMET':
            toneClass = 'border-critical-red/40 bg-critical-red/10 text-critical-red';
            icon = <ZapOff className="h-4 w-4 text-critical-red" aria-hidden="true" />;
            title = tWarnings('criticalUnmetTitle');
            desc = tWarnings('criticalUnmetDesc', { from: fromStr, to: toStr });
            break;

          case 'SECTOR_PARTIAL': {
            const sectorName = w.sector ? tSectors(w.sector) : '';
            toneClass = 'border-warning-amber/30 bg-warning-amber/10 text-warning-amber';
            icon = <AlertTriangle className="h-4 w-4 text-warning-amber" aria-hidden="true" />;
            title =
              w.sector === 'water'
                ? tWarnings('waterPartiallyUnmet')
                : w.sector === 'health'
                  ? tWarnings('clinicSupplyBelowTarget')
                  : tWarnings('sectorPartialTitle');
            desc = tWarnings('sectorPartialDesc', { sector: sectorName, from: fromStr, to: toStr });
            break;
          }

          case 'RESERVE_REACHED':
            toneClass = 'border-warning-amber/30 bg-warning-amber/10 text-warning-amber';
            icon = <BatteryCharging className="h-4 w-4 text-warning-amber" aria-hidden="true" />;
            title = tWarnings('batteryDepletedTitle');
            desc = tWarnings('reserveReachedDesc', { from: fromStr, to: toStr });
            break;

          case 'CURTAILMENT':
            toneClass = 'border-energy-cyan/30 bg-energy-cyan/10 text-energy-cyan';
            icon = <Info className="h-4 w-4 text-energy-cyan" aria-hidden="true" />;
            title = tWarnings('curtailmentTitle');
            desc = tWarnings('curtailmentDesc', { from: fromStr, to: toStr });
            break;

          case 'ANOMALY_TO_VERIFY': {
            const sectorName = w.sector ? tSectors(w.sector) : '';
            toneClass = 'border-ai-violet/50 bg-ai-violet/10 text-ai-violet';
            icon = <Search className="h-4 w-4 text-ai-violet" aria-hidden="true" />;
            title = tWarnings('anomalyToVerifyTitle');
            desc = tWarnings('anomalyToVerifyDesc', {
              sector: sectorName,
              from: fromStr,
              to: toStr,
            });
            break;
          }

          case 'SECTOR_CAPPED': {
            const sectorName = w.sector ? tSectors(w.sector) : '';
            toneClass = 'border-energy-cyan/40 bg-energy-cyan/10 text-energy-cyan';
            icon = <Sliders className="h-4 w-4 text-energy-cyan" aria-hidden="true" />;
            title = tWarnings('sectorCappedTitle');
            desc = tWarnings('sectorCappedDesc', { sector: sectorName, from: fromStr, to: toStr });
            break;
          }
        }

        return (
          <div
            key={key}
            className={cn(
              'flex items-start justify-between gap-3 p-3.5 rounded-card border text-xs',
              toneClass
            )}
          >
            <div className="flex items-start gap-2.5">
              <div className="p-1 rounded-control-sm bg-surface-elevated shrink-0 mt-0.5">
                {icon}
              </div>
              <div>
                <h4 className="font-display font-semibold text-text-primary text-xs">{title}</h4>
                <p className="mt-0.5 text-text-secondary leading-relaxed text-xs">{desc}</p>
              </div>
            </div>

            <span className="shrink-0 font-mono text-[10px] text-text-muted px-1.5 py-0.5 rounded-control-sm bg-surface-elevated border border-border">
              {timeRange}
            </span>
          </div>
        );
      })}
    </div>
  );
}
