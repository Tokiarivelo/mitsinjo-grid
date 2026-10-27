'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Activity,
  Battery,
  Box,
  ExternalLink,
  HeartPulse,
  Home,
  School,
  ShoppingBag,
  Sun,
  Waves,
} from 'lucide-react';
import type { SimulationInput, SimulationResult } from '@mitsinjo/engine';
import { cn } from '@/lib/utils';
import { fmtHour, fmtKw, fmtKwh, fmtPct } from '@/lib/format';
import { useTranslations } from '@/lib/i18n';
import { buttonVariants } from '@/components/ui/button';
import { toSceneModel, useWebGLAvailable, LazyVillageCanvas } from '@/features/microgrid-3d';

export interface GridSchematicPreviewProps {
  result?: SimulationResult;
  input: SimulationInput;
  hour?: number;
  className?: string;
}

export function GridSchematicPreview({
  result,
  input,
  hour = 12,
  className,
}: GridSchematicPreviewProps) {
  const tOverview = useTranslations('overview');
  const tSectors = useTranslations('sectors');

  const hasWebGL = useWebGLAvailable();
  const [userViewMode, setUserViewMode] = useState<'3d' | '2d' | null>(null);
  const viewMode = userViewMode ?? (hasWebGL ? '3d' : '2d');

  const sceneModel = useMemo(
    () => toSceneModel({ input, result, timeIndex: hour }),
    [input, result, hour]
  );

  const step = result?.steps[hour];

  const solarKw = step?.solarKw ?? 0;
  const batteryKw = step?.batteryKw ?? 0;
  const socPct = step?.socPct ?? 0;

  const sectors = [
    {
      id: 'health',
      name: tSectors('health'),
      icon: <HeartPulse className="h-4 w-4 text-critical-red" aria-hidden="true" />,
      step: step?.sectors.health,
      critical: true,
    },
    {
      id: 'water',
      name: tSectors('water'),
      icon: <Waves className="h-4 w-4 text-energy-cyan" aria-hidden="true" />,
      step: step?.sectors.water,
      critical: true,
    },
    {
      id: 'school',
      name: tSectors('school'),
      icon: <School className="h-4 w-4 text-warning-amber" aria-hidden="true" />,
      step: step?.sectors.school,
      critical: false,
    },
    {
      id: 'households',
      name: tSectors('households'),
      icon: <Home className="h-4 w-4 text-text-secondary" aria-hidden="true" />,
      step: step?.sectors.households,
      critical: false,
    },
    {
      id: 'market',
      name: tSectors('market'),
      icon: <ShoppingBag className="h-4 w-4 text-solar-amber" aria-hidden="true" />,
      step: step?.sectors.market,
      critical: false,
    },
  ];

  return (
    <div
      className={cn(
        'flex flex-col justify-between p-5 rounded-card bg-surface border border-border shadow-sm',
        className
      )}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-border/60">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-energy-cyan" aria-hidden="true" />
            <h3 className="font-display text-sm font-semibold text-text-primary tracking-tight">
              {tOverview('previewTitle')}
            </h3>
            <span className="text-[10px] font-mono text-energy-cyan px-1.5 py-0.5 rounded-control-sm bg-energy-cyan/10 border border-energy-cyan/30">
              {viewMode === '3d' ? tOverview('badge3d') : tOverview('schematicBadge')}
            </span>
          </div>
          <p className="text-xs text-text-secondary mt-0.5">{tOverview('previewSubtitle')}</p>
        </div>

        <div className="flex items-center gap-2">
          {hasWebGL && (
            <div className="flex items-center gap-0.5 p-0.5 rounded-control bg-surface-elevated border border-border">
              <button
                type="button"
                onClick={() => setUserViewMode('3d')}
                className={cn(
                  'px-2 py-0.5 rounded-control-sm text-xs font-sans transition-colors cursor-pointer flex items-center gap-1',
                  viewMode === '3d'
                    ? 'bg-energy-cyan/20 text-energy-cyan font-medium'
                    : 'text-text-muted hover:text-text-primary'
                )}
              >
                <Box className="h-3 w-3" aria-hidden="true" />
                <span>{tOverview('view3d')}</span>
              </button>
              <button
                type="button"
                onClick={() => setUserViewMode('2d')}
                className={cn(
                  'px-2 py-0.5 rounded-control-sm text-xs font-sans transition-colors cursor-pointer',
                  viewMode === '2d'
                    ? 'bg-energy-cyan/20 text-energy-cyan font-medium'
                    : 'text-text-muted hover:text-text-primary'
                )}
              >
                <span>{tOverview('view2d')}</span>
              </button>
            </div>
          )}

          <Link href="/simulation" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
            <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>{tOverview('openLive')}</span>
          </Link>
        </div>
      </div>

      {/* Viewport Content */}
      {viewMode === '3d' && hasWebGL ? (
        <div className="my-5 rounded-control overflow-hidden border border-border/60 h-[280px] relative bg-canvas-sunken">
          <LazyVillageCanvas
            model={sceneModel}
            selectedSector={null}
            onSelectSector={() => {}}
            cameraPreset="village"
            className="w-full h-full"
          />
        </div>
      ) : (
        /* Schematic Diagram */
        <div className="my-5 p-4 rounded-control bg-canvas/60 border border-border/60 flex flex-col gap-4">
          {/* Top: Generation & Storage bus */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Solar Array Node */}
            <div className="flex items-center justify-between p-3 rounded-card bg-surface border border-solar-amber/30">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-control-sm bg-solar-amber/15 text-solar-amber">
                  <Sun className="h-4 w-4" aria-hidden="true" />
                </div>
                <div>
                  <span className="text-xs font-semibold text-text-primary block">
                    {tOverview('solarArrayNode')}
                  </span>
                  <span className="text-[11px] font-mono text-text-muted">
                    {tOverview('solarArrayCapacity', { kw: fmtKw(input.solar.peakKw, 0) })}
                  </span>
                </div>
              </div>
              <div className="text-right font-mono">
                <span className="text-sm font-semibold text-solar-amber block">
                  {fmtKw(result ? solarKw : null)}
                </span>
                <span className="text-[10px] text-text-muted">
                  {tOverview('atHour', { hour: fmtHour(hour) })}
                </span>
              </div>
            </div>

            {/* Battery Bank Node */}
            <div className="flex items-center justify-between p-3 rounded-card bg-surface border border-battery-green/30">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-control-sm bg-battery-green/15 text-battery-green">
                  <Battery className="h-4 w-4" aria-hidden="true" />
                </div>
                <div>
                  <span className="text-xs font-semibold text-text-primary block">
                    {tOverview('batteryStorageNode')}
                  </span>
                  <span className="text-[11px] font-mono text-text-muted">
                    {tOverview('batteryStorageCapacity', {
                      kwh: fmtKwh(input.battery.capacityKwh, 0),
                    })}
                  </span>
                </div>
              </div>
              <div className="text-right font-mono">
                <span className="text-sm font-semibold text-battery-green block">
                  {fmtPct(result ? socPct : null)}
                </span>
                <span className="text-[10px] text-text-muted">
                  {result
                    ? batteryKw >= 0
                      ? tOverview('charging', { kw: fmtKw(batteryKw, 1, '0.0 kW') })
                      : tOverview('discharging', { kw: fmtKw(Math.abs(batteryKw), 1, '0.0 kW') })
                    : tOverview('idle')}
                </span>
              </div>
            </div>
          </div>

          {/* Middle: Grid Distribution Bus bar indicator */}
          <div className="relative py-1 flex items-center justify-center">
            <div className="w-full h-0.5 bg-gradient-to-r from-solar-amber via-energy-cyan to-battery-green opacity-70" />
            <span className="absolute px-2 py-0.5 rounded-full bg-surface-elevated border border-border text-[10px] font-mono text-text-muted uppercase tracking-wider">
              {tOverview('gridBusLabel')}
            </span>
          </div>

          {/* Bottom: 5 Village Sectors */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {sectors.map((sec) => {
              const served = sec.step?.servedKw ?? 0;
              const demand = sec.step?.demandKw ?? 0;
              const isDeficit = demand > 0 && served < demand - 0.05;

              return (
                <div
                  key={sec.id}
                  className="flex flex-col justify-between p-2.5 rounded-control bg-surface border border-border/80"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="p-1 rounded-control-sm bg-surface-elevated">{sec.icon}</div>
                    {sec.critical && (
                      <span className="text-[9px] font-mono text-critical-red bg-critical-red/10 border border-critical-red/30 px-1 rounded-control-sm">
                        {tOverview('criticalTag')}
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] font-medium text-text-primary truncate">
                    {sec.name}
                  </span>
                  <span className="text-[11px] font-mono font-semibold text-text-secondary mt-1">
                    {result ? (
                      <span className={isDeficit ? 'text-critical-red' : 'text-battery-green'}>
                        {fmtKw(served)}
                      </span>
                    ) : (
                      fmtKw(null)
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
