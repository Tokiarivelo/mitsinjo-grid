'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Activity, Box, Clock, ExternalLink } from 'lucide-react';
import type { SimulationInput, SimulationResult } from '@mitsinjo/engine';
import { cn } from '@/lib/utils';
import { fmtHour, fmtKwh, fmtPct } from '@/lib/format';
import { useTranslations } from '@/lib/i18n';
import { buttonVariants } from '@/components/ui/button';
import { ViewModeToggle } from '@/components/ui/view-mode-toggle';
import {
  GridDiagram,
  LazyVillageCanvas,
  toSceneModel,
  useWebGLAvailable,
} from '@/features/microgrid-3d';

export interface GridSchematicPreviewProps {
  result?: SimulationResult;
  input: SimulationInput;
  hour?: number;
  onHourChange?: (hour: number) => void;
  className?: string;
}

export function GridSchematicPreview({
  result,
  input,
  hour = 12,
  onHourChange,
  className,
}: GridSchematicPreviewProps) {
  const tOverview = useTranslations('overview');

  const hasWebGL = useWebGLAvailable();
  const [userViewMode, setUserViewMode] = useState<'3d' | '2d' | null>(null);
  const viewMode = userViewMode ?? (hasWebGL ? '3d' : '2d');

  const sceneModel = useMemo(
    () => toSceneModel({ input, result, timeIndex: hour }),
    [input, result, hour]
  );

  const hasUnserved = Boolean(result && result.metrics.unservedKwh > 0.05);

  const quickPhases = [
    { hour: 6, label: tOverview('phaseDawn') },
    { hour: 12, label: tOverview('phasePeak') },
    { hour: 19, label: tOverview('phaseEvening') },
    { hour: 23, label: tOverview('phaseNight') },
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
            <ViewModeToggle
              label={tOverview('viewModeLabel')}
              value={viewMode}
              onChange={setUserViewMode}
              options={[
                {
                  id: '3d' as const,
                  label: tOverview('view3d'),
                  icon: <Box className="h-3 w-3" aria-hidden="true" />,
                },
                { id: '2d' as const, label: tOverview('view2d') },
              ]}
            />
          )}

          <Link href="/simulation" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
            <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>{tOverview('openLive')}</span>
          </Link>
        </div>
      </div>

      {/* Viewport Content */}
      {viewMode === '3d' && hasWebGL ? (
        <div className="my-4 rounded-control overflow-hidden border border-border/60 h-[260px] sm:h-[300px] relative bg-canvas-sunken">
          <LazyVillageCanvas
            model={sceneModel}
            selectedSector={null}
            onSelectSector={() => {}}
            cameraPreset="village"
            className="w-full h-full"
          />

          {/* Top-left HUD badge */}
          <div className="absolute top-2.5 left-2.5 pointer-events-none flex flex-col gap-0.5 font-mono text-[10px] text-text-secondary bg-surface/85 backdrop-blur-sm px-2 py-1 rounded-control-sm border border-border/80">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-battery-green animate-pulse" />
              <span className="font-semibold text-text-primary">
                {tOverview('nodeMitsinjoBus')}
              </span>
            </div>
            <span className="text-text-muted">{tOverview('nodeCoordinates')}</span>
          </div>

          {/* Top-right Hour Badge */}
          <div className="absolute top-2.5 right-2.5 pointer-events-none flex items-center gap-1.5 bg-surface/85 backdrop-blur-sm px-2.5 py-1 rounded-control-sm border border-border/80 font-mono text-xs text-energy-cyan font-semibold">
            <span>{fmtHour(hour)}</span>
          </div>
        </div>
      ) : (
        /* 2D village plan: same scene model, electrons on powered lines */
        <div className="my-4 p-2 rounded-control bg-canvas-sunken border border-border/60 aspect-[16/11]">
          <GridDiagram model={sceneModel} variant="topology" />
        </div>
      )}

      {/* Quick-Phase Hour Selector */}
      <div className="pt-2 pb-3 flex flex-wrap items-center justify-between gap-2 border-b border-border/40">
        <span className="text-[11px] font-mono text-text-muted flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 text-energy-cyan" aria-hidden="true" />
          {tOverview('quickPhasesLabel')}:
        </span>
        <div className="flex items-center gap-1.5 flex-wrap">
          {quickPhases.map((phase) => (
            <button
              key={phase.hour}
              type="button"
              onClick={() => onHourChange?.(phase.hour)}
              className={cn(
                'px-2 py-0.5 rounded-control-sm text-[11px] font-mono transition-colors cursor-pointer border',
                hour === phase.hour
                  ? 'bg-energy-cyan/20 text-energy-cyan border-energy-cyan/40 font-semibold'
                  : 'bg-surface-elevated text-text-secondary border-border/60 hover:text-text-primary hover:border-border'
              )}
            >
              {phase.label}
            </button>
          ))}
        </div>
      </div>

      {/* Docked 4-Stat Energy Balance Summary Panel */}
      <div className="pt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="bg-canvas-sunken/60 p-2.5 rounded-control border border-border/60 flex flex-col justify-between">
          <span className="text-[10px] font-mono text-text-muted uppercase tracking-wider">
            {tOverview('solarGen')}
          </span>
          <span className="text-sm font-bold font-mono text-solar-amber mt-1">
            {fmtKwh(result ? result.metrics.solarKwh : null)}
          </span>
        </div>

        <div className="bg-canvas-sunken/60 p-2.5 rounded-control border border-border/60 flex flex-col justify-between">
          <span className="text-[10px] font-mono text-text-muted uppercase tracking-wider">
            {tOverview('batteryNet')}
          </span>
          <span className="text-sm font-bold font-mono text-battery-green mt-1">
            {result
              ? `${fmtPct(result.metrics.socStartPct, 0)} → ${fmtPct(result.metrics.socEndPct, 0)}`
              : fmtPct(null)}
          </span>
        </div>

        <div className="bg-canvas-sunken/60 p-2.5 rounded-control border border-border/60 flex flex-col justify-between">
          <span className="text-[10px] font-mono text-text-muted uppercase tracking-wider">
            {tOverview('servedEnergy')}
          </span>
          <span className="text-sm font-bold font-mono text-energy-cyan mt-1">
            {fmtKwh(result ? result.metrics.servedKwh : null)}
          </span>
        </div>

        <div
          className={cn(
            'p-2.5 rounded-control border flex flex-col justify-between',
            hasUnserved
              ? 'bg-critical-red/5 border-critical-red/30'
              : 'bg-canvas-sunken/60 border border-border/60'
          )}
        >
          <span
            className={cn(
              'text-[10px] font-mono uppercase tracking-wider',
              hasUnserved ? 'text-critical-red' : 'text-text-muted'
            )}
          >
            {tOverview('unservedTotal')}
          </span>
          <span
            className={cn(
              'text-sm font-bold font-mono mt-1',
              hasUnserved ? 'text-critical-red' : 'text-text-muted'
            )}
          >
            {fmtKwh(result ? result.metrics.unservedKwh : null)}
          </span>
        </div>
      </div>
    </div>
  );
}
