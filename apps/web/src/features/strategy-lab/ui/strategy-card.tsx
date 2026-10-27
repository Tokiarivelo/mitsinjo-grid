'use client';

import { Award, Check, ShieldCheck, Zap } from 'lucide-react';
import type { SimulationResult, StrategyId } from '@mitsinjo/engine';
import { cn } from '@/lib/utils';
import { fmtKwh, fmtPct } from '@/lib/format';
import { useTranslations } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { EnergyBar } from '@/components/ui/energy-bar';

export interface StrategyCardProps {
  strategyId: StrategyId;
  name: string;
  rule: string;
  result?: SimulationResult;
  isActive: boolean;
  bestMetrics?: {
    delivered?: boolean;
    essential?: boolean;
    unmet?: boolean;
    soc?: boolean;
  };
  onSelectStrategy: () => void;
  className?: string;
}

export function StrategyCard({
  strategyId,
  name,
  rule,
  result,
  isActive,
  bestMetrics,
  onSelectStrategy,
  className,
}: StrategyCardProps) {
  const tStrategies = useTranslations('strategies');
  const tSectors = useTranslations('sectors');

  const metrics = result?.metrics;
  const hasResults = Boolean(result && metrics);

  return (
    <div
      data-strategy={strategyId}
      className={cn(
        'flex flex-col justify-between p-5 rounded-card bg-surface border transition-all shadow-sm',
        isActive
          ? 'border-energy-cyan/60 ring-1 ring-energy-cyan/30 shadow-md shadow-energy-cyan/10'
          : 'border-border/80 hover:border-border',
        className
      )}
    >
      <div>
        {/* Top bar: Name + Active Badge */}
        <div className="flex items-start justify-between gap-2 pb-3 border-b border-border/60">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-display text-base font-semibold text-text-primary tracking-tight">
                {name}
              </h3>
              {isActive && (
                <span className="inline-flex items-center gap-1 text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-energy-cyan/15 text-energy-cyan border border-energy-cyan/30">
                  <Check className="h-3 w-3" aria-hidden="true" />
                  {tStrategies('activeBadge')}
                </span>
              )}
            </div>
            <p className="text-xs text-text-secondary mt-1 leading-relaxed">{rule}</p>
          </div>
        </div>

        {/* 4 Compact Metric Tiles */}
        <div className="grid grid-cols-2 gap-2.5 my-4">
          {/* Delivered Energy */}
          <div className="p-3 rounded-control bg-surface-elevated/70 border border-border/60 flex flex-col justify-between">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[11px] font-sans text-text-muted">
                {tStrategies('delivered')}
              </span>
              {bestMetrics?.delivered && hasResults && (
                <span className="text-[9px] font-mono text-battery-green bg-battery-green/15 border border-battery-green/30 px-1 py-0.5 rounded-control-sm flex items-center gap-0.5">
                  <Award className="h-2.5 w-2.5" aria-hidden="true" />
                  {tStrategies('badgeTop')}
                </span>
              )}
            </div>
            <span className="text-base font-display font-semibold text-text-primary mt-1 font-mono">
              {fmtKwh(metrics?.servedKwh)}
            </span>
          </div>

          {/* Essential Services Coverage */}
          <div
            className={cn(
              'p-3 rounded-control border flex flex-col justify-between',
              metrics && metrics.criticalUnservedKwh > 0.05
                ? 'bg-critical-red/5 border-critical-red/30'
                : 'bg-surface-elevated/70 border-border/60'
            )}
          >
            <div className="flex items-center justify-between gap-1">
              <span className="text-[11px] font-sans text-text-muted">
                {tStrategies('essentialCoverage')}
              </span>
              {bestMetrics?.essential && hasResults && (
                <span className="text-[9px] font-mono text-battery-green bg-battery-green/15 border border-battery-green/30 px-1 py-0.5 rounded-control-sm flex items-center gap-0.5">
                  <ShieldCheck className="h-2.5 w-2.5" aria-hidden="true" />
                  {tStrategies('badgeBest')}
                </span>
              )}
            </div>
            <span
              className={cn(
                'text-base font-display font-semibold mt-1 font-mono',
                metrics && metrics.criticalUnservedKwh > 0.05
                  ? 'text-critical-red'
                  : 'text-battery-green'
              )}
            >
              {fmtPct(metrics?.criticalCoveragePct)}
            </span>
          </div>

          {/* Unmet Demand */}
          <div className="p-3 rounded-control bg-surface-elevated/70 border border-border/60 flex flex-col justify-between">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[11px] font-sans text-text-muted">{tStrategies('unmet')}</span>
              {bestMetrics?.unmet && hasResults && (
                <span className="text-[9px] font-mono text-battery-green bg-battery-green/15 border border-battery-green/30 px-1 py-0.5 rounded-control-sm">
                  {tStrategies('badgeMin')}
                </span>
              )}
            </div>
            <span
              className={cn(
                'text-base font-display font-semibold mt-1 font-mono',
                metrics && metrics.unservedKwh > 0.05 ? 'text-warning-amber' : 'text-text-muted'
              )}
            >
              {fmtKwh(metrics?.unservedKwh)}
            </span>
          </div>

          {/* Ending Battery SoC */}
          <div className="p-3 rounded-control bg-surface-elevated/70 border border-border/60 flex flex-col justify-between">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[11px] font-sans text-text-muted">{tStrategies('socEnd')}</span>
              {bestMetrics?.soc && hasResults && (
                <span className="text-[9px] font-mono text-battery-green bg-battery-green/15 border border-battery-green/30 px-1 py-0.5 rounded-control-sm">
                  {tStrategies('badgeMax')}
                </span>
              )}
            </div>
            <span className="text-base font-display font-semibold text-text-primary mt-1 font-mono">
              {fmtPct(metrics?.socEndPct, 0)}
            </span>
          </div>
        </div>

        {/* 5 Sector EnergyBar Rows */}
        <div className="pt-2 border-t border-border/40 flex flex-col divide-y divide-border/30">
          <EnergyBar
            label={tSectors('health')}
            valuePct={hasResults && metrics ? (metrics.perSector.health?.coveragePct ?? 0) : 0}
            servedKwh={metrics?.perSector.health?.servedKwh}
            demandKwh={metrics?.perSector.health?.demandKwh}
            priority="critical"
          />
          <EnergyBar
            label={tSectors('water')}
            valuePct={hasResults && metrics ? (metrics.perSector.water?.coveragePct ?? 0) : 0}
            servedKwh={metrics?.perSector.water?.servedKwh}
            demandKwh={metrics?.perSector.water?.demandKwh}
            priority="critical"
          />
          <EnergyBar
            label={tSectors('school')}
            valuePct={hasResults && metrics ? (metrics.perSector.school?.coveragePct ?? 0) : 0}
            servedKwh={metrics?.perSector.school?.servedKwh}
            demandKwh={metrics?.perSector.school?.demandKwh}
            priority="medium"
          />
          <EnergyBar
            label={tSectors('households')}
            valuePct={hasResults && metrics ? (metrics.perSector.households?.coveragePct ?? 0) : 0}
            servedKwh={metrics?.perSector.households?.servedKwh}
            demandKwh={metrics?.perSector.households?.demandKwh}
            priority="low"
          />
          <EnergyBar
            label={tSectors('market')}
            valuePct={hasResults && metrics ? (metrics.perSector.market?.coveragePct ?? 0) : 0}
            servedKwh={metrics?.perSector.market?.servedKwh}
            demandKwh={metrics?.perSector.market?.demandKwh}
            priority="low"
          />
        </div>
      </div>

      {/* Footer: Use this strategy action */}
      <div className="mt-5 pt-3 border-t border-border/60">
        <Button
          variant={isActive ? 'secondary' : 'primary'}
          size="sm"
          className="w-full"
          disabled={isActive}
          icon={isActive ? <Check className="h-3.5 w-3.5" /> : <Zap className="h-3.5 w-3.5" />}
          onClick={onSelectStrategy}
        >
          {isActive ? tStrategies('strategyActive') : tStrategies('useStrategy')}
        </Button>
      </div>
    </div>
  );
}
