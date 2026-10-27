'use client';

import {
  HeartPulse,
  Home,
  School,
  ShieldAlert,
  ShoppingBag,
  Waves,
  X,
  Zap,
} from 'lucide-react';
import type {
  SectorId,
  SimulationInput,
  SimulationResult,
} from '@mitsinjo/engine';
import { cn } from '@/lib/utils';
import { fmtKw, fmtKwh, fmtPct } from '@/lib/format';
import { useTranslations } from '@/lib/i18n';

export interface BuildingInspectorPanelProps {
  selectedSector: SectorId | null;
  onSelectSector: (sector: SectorId | null) => void;
  result?: SimulationResult;
  input: SimulationInput;
  timeIndex: number;
  className?: string;
}

export function BuildingInspectorPanel({
  selectedSector,
  onSelectSector,
  result,
  input,
  timeIndex,
  className,
}: BuildingInspectorPanelProps) {
  const tSim = useTranslations('features.simulation');
  const tSectors = useTranslations('sectors');
  const tCommon = useTranslations('common');
  const tPriorities = useTranslations('priorities');

  const sectorConfigs = {
    health: {
      id: 'health' as SectorId,
      name: tSectors('health'),
      icon: <HeartPulse className="h-4 w-4 text-critical-red" aria-hidden="true" />,
    },
    water: {
      id: 'water' as SectorId,
      name: tSectors('water'),
      icon: <Waves className="h-4 w-4 text-energy-cyan" aria-hidden="true" />,
    },
    school: {
      id: 'school' as SectorId,
      name: tSectors('school'),
      icon: <School className="h-4 w-4 text-warning-amber" aria-hidden="true" />,
    },
    households: {
      id: 'households' as SectorId,
      name: tSectors('households'),
      icon: <Home className="h-4 w-4 text-text-secondary" aria-hidden="true" />,
    },
    market: {
      id: 'market' as SectorId,
      name: tSectors('market'),
      icon: <ShoppingBag className="h-4 w-4 text-solar-amber" aria-hidden="true" />,
    },
  };

  const currentSector = selectedSector ? sectorConfigs[selectedSector] : null;
  const sectorInput = selectedSector
    ? input.sectors.find((s) => s.id === selectedSector)
    : null;
  const sectorMetrics = selectedSector && result
    ? result.metrics.perSector[selectedSector]
    : null;
  const stepSector = selectedSector && result?.steps[timeIndex]
    ? result.steps[timeIndex].sectors[selectedSector]
    : null;

  return (
    <div
      className={cn(
        'flex flex-col p-4 rounded-card bg-surface border border-border shadow-sm',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-border/60">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-energy-cyan" aria-hidden="true" />
          <h3 className="text-xs font-display font-semibold uppercase tracking-wider text-text-primary">
            {tSim('inspectorTitle')}
          </h3>
        </div>

        {selectedSector && (
          <button
            type="button"
            onClick={() => onSelectSector(null)}
            aria-label={tCommon('close')}
            className="p-1 rounded-control text-text-muted hover:text-text-primary hover:bg-surface-elevated transition-colors cursor-pointer"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Sector Quick Selector Buttons */}
      <div className="flex flex-wrap gap-1.5 py-3 border-b border-border/40">
        {(Object.keys(sectorConfigs) as SectorId[]).map((id) => {
          const sec = sectorConfigs[id];
          const isSelected = selectedSector === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onSelectSector(isSelected ? null : id)}
              aria-pressed={isSelected}
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1 rounded-control text-xs font-sans transition-colors cursor-pointer border',
                isSelected
                  ? 'bg-energy-cyan/20 text-energy-cyan border-energy-cyan font-medium'
                  : 'bg-surface-elevated/70 text-text-secondary border-border hover:bg-surface-hover hover:text-text-primary'
              )}
            >
              {sec.icon}
              <span>{sec.name}</span>
            </button>
          );
        })}
      </div>

      {/* Body: Detailed Node Telemetry or Empty State */}
      {selectedSector && currentSector && sectorInput ? (
        <div className="flex flex-col gap-3 pt-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-control bg-surface-elevated border border-border">
                {currentSector.icon}
              </div>
              <div>
                <h4 className="font-display text-sm font-semibold text-text-primary">
                  {currentSector.name}
                </h4>
                <span className="text-[11px] font-mono text-text-muted">
                  {tCommon('idLabel', { id: selectedSector })}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <span
                className={cn(
                  'text-[10px] font-mono px-2 py-0.5 rounded-full border uppercase',
                  sectorInput.priority === 'critical'
                    ? 'text-critical-red bg-critical-red/10 border-critical-red/30'
                    : sectorInput.priority === 'high'
                    ? 'text-solar-amber bg-solar-amber/10 border-solar-amber/30'
                    : 'text-energy-cyan bg-energy-cyan/10 border-energy-cyan/30'
                )}
              >
                {tPriorities(sectorInput.priority)}
              </span>
            </div>
          </div>

          {/* Critical Share & Shiftable characteristics */}
          <div className="p-2.5 rounded-control bg-surface-elevated/50 border border-border/60 text-xs">
            <div className="flex items-center justify-between mb-1">
              <span className="text-text-secondary font-sans">
                {tSim('criticalDemandShare')}
              </span>
              <span className="font-mono font-medium text-text-primary">
                {fmtPct(sectorInput.criticalShare * 100, 0)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-text-secondary font-sans">
                {tSim('flexibleLoad')}
              </span>
              <span className="font-mono font-medium text-text-primary">
                {sectorInput.flexible ? tCommon('yes') : tCommon('no')}
              </span>
            </div>
          </div>

          {/* 24h Aggregated Metrics */}
          {sectorMetrics ? (
            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <div className="p-2 rounded-control bg-surface-elevated border border-border">
                <span className="text-[10px] font-sans text-text-muted block">
                  {tSim('sectorDemand24h')}
                </span>
                <span className="font-semibold text-text-primary">
                  {fmtKwh(sectorMetrics.demandKwh)}
                </span>
              </div>

              <div className="p-2 rounded-control bg-surface-elevated border border-border">
                <span className="text-[10px] font-sans text-text-muted block">
                  {tSim('sectorServed24h')}
                </span>
                <span className="font-semibold text-battery-green">
                  {fmtKwh(sectorMetrics.servedKwh)}
                </span>
              </div>

              <div className="p-2 rounded-control bg-surface-elevated border border-border">
                <span className="text-[10px] font-sans text-text-muted block">
                  {tSim('sectorDeficit24h')}
                </span>
                <span
                  className={cn(
                    'font-semibold',
                    sectorMetrics.unservedKwh > 0 ? 'text-critical-red' : 'text-text-muted'
                  )}
                >
                  {fmtKwh(sectorMetrics.unservedKwh)}
                </span>
              </div>

              <div className="p-2 rounded-control bg-surface-elevated border border-border">
                <span className="text-[10px] font-sans text-text-muted block">
                  {tSim('sectorCoverage24h')}
                </span>
                <span
                  className={cn(
                    'font-semibold',
                    sectorMetrics.coveragePct < 90
                      ? 'text-critical-red'
                      : sectorMetrics.coveragePct < 99
                      ? 'text-solar-amber'
                      : 'text-battery-green'
                  )}
                >
                  {fmtPct(sectorMetrics.coveragePct)}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-xs text-text-muted italic">
              {tSim('runToViewMetrics')}
            </p>
          )}

          {/* Current Step (Hour t) Snapshot */}
          {stepSector && (
            <div className="pt-2 border-t border-border/40 text-xs">
              <span className="text-[11px] font-sans font-medium text-text-secondary block mb-1.5">
                {tSim('hourlyFlowAtHour', { hour: timeIndex })}
              </span>
              <div className="flex items-center justify-between font-mono bg-canvas/60 p-2 rounded-control border border-border/60">
                <span className="text-text-muted">
                  {fmtKw(stepSector.servedKw)} / {fmtKw(stepSector.demandKw)}
                </span>
                <span
                  className={cn(
                    'text-[10px] px-1.5 py-0.5 rounded-control-sm font-semibold',
                    stepSector.servedKw >= stepSector.demandKw - 0.05
                      ? 'text-battery-green bg-battery-green/10'
                      : 'text-critical-red bg-critical-red/10'
                  )}
                >
                  {stepSector.servedKw >= stepSector.demandKw - 0.05
                    ? tCommon('supplied')
                    : tCommon('curtailed')}
                </span>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="py-6 flex flex-col items-center justify-center text-center text-text-muted">
          <ShieldAlert className="h-6 w-6 text-text-muted/60 mb-2" aria-hidden="true" />
          <p className="text-xs font-sans max-w-[200px]">
            {tSim('inspectorPrompt')}
          </p>
        </div>
      )}
    </div>
  );
}
