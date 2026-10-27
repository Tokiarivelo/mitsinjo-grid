'use client';

import { useState } from 'react';
import {
  Battery,
  HeartPulse,
  Home,
  MapPin,
  School,
  ShoppingBag,
  Sun,
  Waves,
} from 'lucide-react';
import type {
  SectorId,
  SimulationInput,
  SimulationResult,
} from '@mitsinjo/engine';
import { cn } from '@/lib/utils';
import { fmtHour, fmtKw, fmtPct } from '@/lib/format';
import { useTranslations } from '@/lib/i18n';

export interface VillageViewportProps {
  input: SimulationInput;
  result?: SimulationResult;
  selectedSector: SectorId | null;
  onSelectSector: (sector: SectorId | null) => void;
  timeIndex: number;
  className?: string;
}

export function VillageViewport({
  input,
  result,
  selectedSector,
  onSelectSector,
  timeIndex,
  className,
}: VillageViewportProps) {
  const tSim = useTranslations('features.simulation');
  const tSectors = useTranslations('sectors');
  const tCommon = useTranslations('common');
  const [viewMode, setViewMode] = useState<'schematic' | 'circuit'>('schematic');

  const step = result?.steps[timeIndex];
  const solarKw = step?.solarKw ?? 0;
  const batteryKw = step?.batteryKw ?? 0;
  const socPct = step?.socPct ?? input.battery.initialSocPct;

  const nodes = [
    {
      id: 'health' as SectorId,
      name: tSectors('health'),
      icon: <HeartPulse className="h-4 w-4" aria-hidden="true" />,
      priority: 'critical',
      step: step?.sectors.health,
      color: 'critical-red',
    },
    {
      id: 'water' as SectorId,
      name: tSectors('water'),
      icon: <Waves className="h-4 w-4" aria-hidden="true" />,
      priority: 'critical',
      step: step?.sectors.water,
      color: 'energy-cyan',
    },
    {
      id: 'school' as SectorId,
      name: tSectors('school'),
      icon: <School className="h-4 w-4" aria-hidden="true" />,
      priority: 'medium',
      step: step?.sectors.school,
      color: 'warning-amber',
    },
    {
      id: 'households' as SectorId,
      name: tSectors('households'),
      icon: <Home className="h-4 w-4" aria-hidden="true" />,
      priority: 'medium',
      step: step?.sectors.households,
      color: 'text-secondary',
    },
    {
      id: 'market' as SectorId,
      name: tSectors('market'),
      icon: <ShoppingBag className="h-4 w-4" aria-hidden="true" />,
      priority: 'low',
      step: step?.sectors.market,
      color: 'solar-amber',
    },
  ];

  return (
    <div
      className={cn(
        'relative flex flex-col justify-between rounded-card bg-canvas-sunken border border-border overflow-hidden shadow-inner min-h-[360px]',
        className
      )}
    >
      {/* Top Floating HUD bar */}
      <div className="absolute top-3 left-3 right-3 flex items-center justify-between z-10 pointer-events-none">
        <div className="flex items-center gap-2 pointer-events-auto">
          <div className="px-2.5 py-1 rounded-control bg-surface-elevated/90 backdrop-blur border border-border text-xs font-mono flex items-center gap-1.5 text-text-primary shadow-xs">
            <span className="h-2 w-2 rounded-full bg-energy-cyan animate-pulse" />
            <span className="font-semibold text-energy-cyan">
              {viewMode === 'schematic' ? tSim('villageTopology') : tSim('circuitBus')}
            </span>
            <span className="text-text-muted">· {fmtHour(timeIndex)}</span>
          </div>

          <div className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-control bg-surface/80 backdrop-blur border border-border text-[11px] font-sans text-text-muted">
            <MapPin className="h-3 w-3 text-solar-amber" aria-hidden="true" />
            <span>Madagascar S 18.91° E 47.53°</span>
          </div>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center gap-1 p-0.5 rounded-control bg-surface-elevated/90 backdrop-blur border border-border pointer-events-auto">
          <button
            type="button"
            onClick={() => setViewMode('schematic')}
            className={cn(
              'px-2 py-0.5 rounded-control-sm text-xs font-sans transition-colors cursor-pointer',
              viewMode === 'schematic'
                ? 'bg-energy-cyan/20 text-energy-cyan font-medium'
                : 'text-text-muted hover:text-text-primary'
            )}
          >
            {tSim('viewTopology')}
          </button>
          <button
            type="button"
            onClick={() => setViewMode('circuit')}
            className={cn(
              'px-2 py-0.5 rounded-control-sm text-xs font-sans transition-colors cursor-pointer',
              viewMode === 'circuit'
                ? 'bg-energy-cyan/20 text-energy-cyan font-medium'
                : 'text-text-muted hover:text-text-primary'
            )}
          >
            {tSim('viewCircuit')}
          </button>
        </div>
      </div>

      {/* Main Viewport Content Area */}
      <div className="flex-1 flex flex-col justify-center p-4 pt-14 pb-12">
        {/* Top Tier: Solar PV Array & Central BESS Battery Storage */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl mx-auto w-full mb-4">
          {/* Solar Array Node */}
          <div className="p-3 rounded-card bg-surface/90 border border-solar-amber/40 shadow-sm backdrop-blur flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-control bg-solar-amber/15 text-solar-amber border border-solar-amber/30">
                <Sun className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <span className="text-xs font-semibold text-text-primary block">
                  {tSim('solarArray')}
                </span>
                <span className="text-[11px] font-mono text-text-muted">
                  {input.solar.peakKw} kWp Solar PV
                </span>
              </div>
            </div>
            <div className="text-right font-mono">
              <span className="text-sm font-semibold text-solar-amber block">
                {result ? fmtKw(solarKw) : fmtKw(null)}
              </span>
              <span className="text-[10px] text-text-muted">
                {tSim('liveOutput')}
              </span>
            </div>
          </div>

          {/* Central BESS Storage */}
          <div className="p-3 rounded-card bg-surface/90 border border-battery-green/40 shadow-sm backdrop-blur flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-control bg-battery-green/15 text-battery-green border border-battery-green/30">
                <Battery className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <span className="text-xs font-semibold text-text-primary block">
                  {tSim('bessBattery')}
                </span>
                <span className="text-[11px] font-mono text-text-muted">
                  {input.battery.capacityKwh} kWh Storage
                </span>
              </div>
            </div>
            <div className="text-right font-mono">
              <span className="text-sm font-semibold text-battery-green block">
                {fmtPct(socPct)} SoC
              </span>
              <span className="text-[10px] text-text-muted">
                {result
                  ? batteryKw >= 0
                    ? `+${fmtKw(batteryKw)}`
                    : `-${fmtKw(Math.abs(batteryKw))}`
                  : tSim('idle')}
              </span>
            </div>
          </div>
        </div>

        {/* Central Glowing Grid Bus Cable */}
        <div className="relative my-2 max-w-3xl mx-auto w-full">
          <div className="h-1 rounded-full bg-gradient-to-r from-solar-amber via-energy-cyan to-battery-green shadow-[0_0_12px_rgba(80,216,232,0.4)]" />
          <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-surface-elevated border border-border text-[10px] font-mono text-energy-cyan uppercase tracking-wider shadow-xs">
            {tSim('distributionBus')}
          </div>
        </div>

        {/* Bottom Tier: 5 Interactive Village Sector Nodes */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 max-w-3xl mx-auto w-full mt-4">
          {nodes.map((node) => {
            const isSelected = selectedSector === node.id;
            const served = node.step?.servedKw ?? 0;
            const demand = node.step?.demandKw ?? 0;
            const isDeficit = demand > 0 && served < demand - 0.05;

            return (
              <button
                key={node.id}
                type="button"
                onClick={() => onSelectSector(isSelected ? null : node.id)}
                aria-pressed={isSelected}
                className={cn(
                  'flex flex-col justify-between p-3 rounded-card text-left transition-all cursor-pointer border',
                  isSelected
                    ? 'bg-surface-elevated border-energy-cyan shadow-md ring-2 ring-energy-cyan/40 scale-[1.02]'
                    : 'bg-surface/80 border-border hover:border-text-secondary hover:bg-surface-hover'
                )}
              >
                <div className="flex items-center justify-between w-full mb-2">
                  <div className="p-1.5 rounded-control-sm bg-surface-elevated border border-border/60 text-text-primary">
                    {node.icon}
                  </div>
                  {node.priority === 'critical' ? (
                    <span className="text-[9px] font-mono px-1 rounded-control-sm text-critical-red bg-critical-red/10 border border-critical-red/30 uppercase">
                      {tSim('criticalPriority')}
                    </span>
                  ) : (
                    <span className="text-[9px] font-mono px-1 rounded-control-sm text-text-muted bg-surface-elevated uppercase">
                      {node.priority}
                    </span>
                  )}
                </div>

                <div className="mb-1">
                  <span className="text-xs font-semibold text-text-primary font-sans block truncate">
                    {node.name}
                  </span>
                </div>

                <div className="mt-1 font-mono text-[11px] flex items-center justify-between">
                  <span className="text-text-muted">
                    {result ? `${Math.round(demand)} kW` : '—'}
                  </span>
                  <span
                    className={cn(
                      'font-semibold',
                      !result
                        ? 'text-text-muted'
                        : isDeficit
                        ? 'text-critical-red'
                        : 'text-battery-green'
                    )}
                  >
                    {result ? fmtKw(served) : '—'}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Bottom status hint bar */}
      <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between text-[11px] text-text-muted font-sans pointer-events-none">
        <span>{tSim('clickNodeToInspect')}</span>
        <span className="font-mono text-[10px] text-energy-cyan">
          {tCommon('simulatedData')}
        </span>
      </div>
    </div>
  );
}
