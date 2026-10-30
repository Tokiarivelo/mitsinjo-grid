'use client';

import { ArrowRight, Check } from 'lucide-react';
import Link from 'next/link';
import type { ScenarioId, SimulationInput } from '@mitsinjo/engine';
import { cn } from '@/lib/utils';
import { fmtHour, fmtKw, fmtKwh, fmtPct } from '@/lib/format';
import { buttonVariants } from '@/components/ui/button';
import { StatusBadge, type StatusBadgeVariant } from '@/components/ui/status-badge';
import { useTranslations } from '@/lib/i18n';

export interface ScenarioCardProps {
  id: ScenarioId;
  name: string;
  description: string;
  input: SimulationInput;
  isActive: boolean;
  status: StatusBadgeVariant;
  onSelect: (id: ScenarioId) => void;
  onOpen: (id: ScenarioId) => void;
  className?: string;
}

export function ScenarioCard({
  id,
  name,
  description,
  input,
  isActive,
  status,
  onSelect,
  onOpen,
  className,
}: ScenarioCardProps) {
  const tScenarios = useTranslations('features.scenarios');
  const tCommon = useTranslations('common');

  // Extract key deltas
  const solarDrop = input.events.find((e) => e.type === 'solar_drop');
  const demandSpike = input.events.find((e) => e.type === 'demand_spike');

  let deltaLabel = tScenarios('nominalConditions');
  if (solarDrop && solarDrop.type === 'solar_drop') {
    const dropPct = Math.round((1 - solarDrop.factor) * 100);
    deltaLabel = tScenarios('deltaSolarDrop', {
      pct: dropPct,
      from: fmtHour(solarDrop.startHour),
      to: fmtHour(solarDrop.startHour + solarDrop.durationH),
    });
  } else if (demandSpike && demandSpike.type === 'demand_spike') {
    const spikePct = Math.round((demandSpike.factor - 1) * 100);
    deltaLabel = tScenarios('deltaDemandSpike', {
      pct: spikePct,
      from: fmtHour(demandSpike.startHour),
      to: fmtHour(demandSpike.startHour + demandSpike.durationH),
    });
  } else if (input.demandMultiplier !== 1.0) {
    const multPct = Math.round((input.demandMultiplier - 1) * 100);
    deltaLabel = tScenarios('deltaGlobalLoad', { pct: `${multPct >= 0 ? '+' : ''}${multPct}` });
  }

  const typeVariant =
    id === 'baseline'
      ? 'nominal'
      : id === 'cloudy_afternoon' || id === 'essential_stress'
        ? 'climate'
        : id === 'battery_constraint'
          ? 'storage'
          : 'demand';

  return (
    <div
      onClick={() => onSelect(id)}
      className={cn(
        'group flex flex-col justify-between p-5 rounded-card border transition-all cursor-pointer',
        isActive
          ? 'bg-surface-elevated/90 border-energy-cyan shadow-md ring-2 ring-energy-cyan/40 scale-[1.01]'
          : 'bg-surface border-border hover:border-text-secondary hover:bg-surface-hover/70',
        className
      )}
    >
      {/* Top row: Type Tag, Active Selection Indicator, Status Badge */}
      <div>
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'text-[10px] font-mono px-2 py-0.5 rounded-full uppercase border font-semibold',
                typeVariant === 'nominal'
                  ? 'text-battery-green bg-battery-green/10 border-battery-green/30'
                  : typeVariant === 'climate'
                    ? 'text-solar-amber bg-solar-amber/10 border-solar-amber/30'
                    : typeVariant === 'storage'
                      ? 'text-energy-cyan bg-energy-cyan/10 border-energy-cyan/30'
                      : 'text-critical-red bg-critical-red/10 border-critical-red/30'
              )}
            >
              {tScenarios(`types.${typeVariant}`)}
            </span>

            {isActive && (
              <span className="flex items-center gap-1 text-[10px] font-mono text-energy-cyan bg-energy-cyan/15 border border-energy-cyan/30 px-2 py-0.5 rounded-full font-semibold">
                <Check className="h-3 w-3" aria-hidden="true" />
                {tCommon('active')}
              </span>
            )}
          </div>

          <StatusBadge variant={status} size="sm" />
        </div>

        {/* Title & Description */}
        <h3 className="font-display text-base font-semibold text-text-primary group-hover:text-energy-cyan transition-colors tracking-tight">
          <button
            type="button"
            aria-pressed={isActive}
            onClick={(e) => {
              e.stopPropagation();
              onSelect(id);
            }}
            className="text-left cursor-pointer rounded-control-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-energy-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
          >
            {name}
          </button>
        </h3>
        <p className="text-xs text-text-secondary mt-1 line-clamp-2 leading-relaxed">
          {description}
        </p>

        {/* Parameter HUD Grid (Mono) */}
        <div className="grid grid-cols-2 gap-2 mt-4 p-3 rounded-control bg-canvas/70 border border-border/60 text-xs font-mono">
          <div>
            <span className="text-[10px] font-sans text-text-muted block">
              {tScenarios('pvCapacity')}
            </span>
            <span className="font-semibold text-solar-amber">{fmtKw(input.solar.peakKw, 0)}</span>
          </div>

          <div>
            <span className="text-[10px] font-sans text-text-muted block">
              {tScenarios('batteryStorage')}
            </span>
            <span className="font-semibold text-battery-green">
              {fmtKwh(input.battery.capacityKwh, 0)} ({fmtPct(input.battery.initialSocPct, 0)})
            </span>
          </div>

          <div className="col-span-2 pt-1.5 border-t border-border/40">
            <span className="text-[10px] font-sans text-text-muted block">
              {tScenarios('stressProfile')}
            </span>
            <span className="font-semibold text-text-primary truncate block">{deltaLabel}</span>
          </div>
        </div>
      </div>

      {/* Footer CTA */}
      <div className="flex items-center justify-between gap-2 mt-4 pt-3 border-t border-border/60">
        <span className="text-[11px] font-mono text-text-muted">{tCommon('idLabel', { id })}</span>

        <Link
          href="/simulation"
          role="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpen(id);
          }}
          className={buttonVariants({
            variant: isActive ? 'primary' : 'secondary',
            size: 'sm',
          })}
          aria-label={tScenarios('openScenario', { name })}
        >
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          {tScenarios('openSimulation')}
        </Link>
      </div>
    </div>
  );
}
