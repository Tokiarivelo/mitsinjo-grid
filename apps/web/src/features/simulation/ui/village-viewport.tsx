'use client';

import { useState, useMemo } from 'react';
import {
  Battery,
  Box,
  Camera,
  HeartPulse,
  Home,
  MapPin,
  RotateCcw,
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
import { fmtHour, fmtKw, fmtKwh, fmtPct } from '@/lib/format';
import { useTranslations } from '@/lib/i18n';
import {
  toSceneModel,
  useWebGLAvailable,
  LazyVillageCanvas,
  type CameraPreset,
} from '@/features/microgrid-3d';

export interface VillageViewportProps {
  input: SimulationInput;
  result?: SimulationResult;
  selectedSector: SectorId | null;
  onSelectSector: (sector: SectorId | null) => void;
  timeIndex: number;
  /** Store status is `modified`: show the last result dimmed and frozen. */
  isModified?: boolean;
  className?: string;
}

const CAMERA_PRESET_KEYS: { id: CameraPreset; labelKey: string }[] = [
  { id: 'village', labelKey: 'presetVillage' },
  { id: 'solar', labelKey: 'presetSolar' },
  { id: 'battery', labelKey: 'presetBattery' },
  { id: 'essential', labelKey: 'presetEssential' },
];

export function VillageViewport({
  input,
  result,
  selectedSector,
  onSelectSector,
  timeIndex,
  isModified = false,
  className,
}: VillageViewportProps) {
  const tSim = useTranslations('features.simulation');
  const tSectors = useTranslations('sectors');
  const tCommon = useTranslations('common');
  const tPriorities = useTranslations('priorities');

  const hasWebGL = useWebGLAvailable();
  const [userViewMode, setUserViewMode] = useState<'3d' | 'schematic' | 'circuit' | null>(null);
  const viewMode = userViewMode ?? (hasWebGL ? '3d' : 'schematic');
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('village');
  const [cameraResetKey, setCameraResetKey] = useState(0);
  const applyPreset = (preset: CameraPreset) => {
    setCameraPreset(preset);
    // Re-apply even when the preset is unchanged (user orbited away).
    setCameraResetKey((k) => k + 1);
  };

  const step = result?.steps[timeIndex];
  const solarKw = step?.solarKw ?? 0;
  const batteryKw = step?.batteryKw ?? 0;
  const socPct = step?.socPct ?? input.battery.initialSocPct;

  // Scene model for 3D visualization (pure mapping)
  const sceneModel = useMemo(
    () =>
      toSceneModel({
        input,
        result,
        timeIndex,
        isModified,
        strategy: result?.strategy ?? 'proportional',
      }),
    [input, result, timeIndex, isModified]
  );

  const nodes = [
    {
      id: 'health' as SectorId,
      name: tSectors('health'),
      icon: <HeartPulse className="h-4 w-4" aria-hidden="true" />,
      step: step?.sectors.health,
      color: 'critical-red',
    },
    {
      id: 'water' as SectorId,
      name: tSectors('water'),
      icon: <Waves className="h-4 w-4" aria-hidden="true" />,
      step: step?.sectors.water,
      color: 'energy-cyan',
    },
    {
      id: 'school' as SectorId,
      name: tSectors('school'),
      icon: <School className="h-4 w-4" aria-hidden="true" />,
      step: step?.sectors.school,
      color: 'warning-amber',
    },
    {
      id: 'households' as SectorId,
      name: tSectors('households'),
      icon: <Home className="h-4 w-4" aria-hidden="true" />,
      step: step?.sectors.households,
      color: 'text-secondary',
    },
    {
      id: 'market' as SectorId,
      name: tSectors('market'),
      icon: <ShoppingBag className="h-4 w-4" aria-hidden="true" />,
      step: step?.sectors.market,
      color: 'solar-amber',
    },
  ];

  return (
    <div
      className={cn(
        'relative flex flex-col justify-between rounded-card bg-canvas-sunken border border-border overflow-hidden shadow-inner min-h-[460px]',
        className
      )}
    >
      {/* Top Floating HUD bar */}
      <div className="absolute top-3 left-3 right-3 flex items-center justify-between z-10 pointer-events-none flex-wrap gap-2">
        {/* Left: Mode Title & Time Status */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <div className="px-2.5 py-1 rounded-control bg-surface-elevated/90 backdrop-blur border border-border text-xs font-mono flex items-center gap-1.5 text-text-primary shadow-xs">
            <span className="h-2 w-2 rounded-full bg-energy-cyan animate-pulse" />
            <span className="font-semibold text-energy-cyan">
              {viewMode === '3d'
                ? tSim('view3d')
                : viewMode === 'schematic'
                ? tSim('villageTopology')
                : tSim('circuitBus')}
            </span>
            <span className="text-text-muted">· {fmtHour(timeIndex)}</span>
          </div>

          <div className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-control bg-surface/80 backdrop-blur border border-border text-[11px] font-sans text-text-muted">
            <MapPin className="h-3 w-3 text-solar-amber" aria-hidden="true" />
            <span>{tSim('siteLocation')}</span>
          </div>
        </div>

        {/* Center: 3D Camera Presets & Reset (visible in 3D mode) */}
        {viewMode === '3d' && hasWebGL && (
          <div className="flex items-center gap-1 p-0.5 rounded-control bg-surface-elevated/90 backdrop-blur border border-border pointer-events-auto shadow-xs">
            <div className="flex items-center gap-1 px-1.5 text-[11px] font-mono text-text-muted border-r border-border pr-2">
              <Camera className="h-3 w-3 text-energy-cyan" aria-hidden="true" />
              <span className="hidden md:inline">{tSim('cameraLabel')}</span>
            </div>
            {CAMERA_PRESET_KEYS.map(({ id, labelKey }) => (
              <button
                key={id}
                type="button"
                onClick={() => applyPreset(id)}
                aria-pressed={cameraPreset === id}
                className={cn(
                  'px-2 py-0.5 rounded-control-sm text-xs font-sans transition-colors cursor-pointer',
                  cameraPreset === id
                    ? 'bg-energy-cyan/20 text-energy-cyan font-medium'
                    : 'text-text-muted hover:text-text-primary'
                )}
              >
                {tSim(labelKey)}
              </button>
            ))}
            <button
              type="button"
              onClick={() => applyPreset('village')}
              aria-label={tSim('resetCamera')}
              title={tSim('resetCamera')}
              className="p-1 rounded-control-sm text-text-muted hover:text-text-primary hover:bg-surface transition-colors cursor-pointer ml-1"
            >
              <RotateCcw className="h-3 w-3" aria-hidden="true" />
            </button>
          </div>
        )}

        {/* Right: View Mode Toggle (3D vs 2D Topology vs Circuit) */}
        <div className="flex items-center gap-1 p-0.5 rounded-control bg-surface-elevated/90 backdrop-blur border border-border pointer-events-auto shadow-xs">
          {hasWebGL && (
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
              <span>{tSim('view3d')}</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setUserViewMode('schematic')}
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
            onClick={() => setUserViewMode('circuit')}
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
      {viewMode === '3d' && hasWebGL ? (
        <div className="relative flex-1 w-full h-full min-h-[460px]">
          <LazyVillageCanvas
            model={sceneModel}
            selectedSector={selectedSector}
            onSelectSector={onSelectSector}
            cameraPreset={cameraPreset}
            cameraResetKey={cameraResetKey}
            className={cn(
              'w-full h-full absolute inset-0 transition-opacity',
              isModified && 'opacity-60'
            )}
          />

          {isModified && (
            <div
              role="status"
              className="absolute top-14 left-1/2 -translate-x-1/2 z-10 px-2.5 py-1 rounded-control bg-surface-elevated/90 backdrop-blur border border-warning-amber/40 text-[11px] font-sans text-warning-amber"
            >
              {tSim('scenarioModified3D')}
            </div>
          )}

          {/* Adjacent 2D Sector Selector mirror bar (bottom-left) for quick accessibility */}
          <div className="absolute bottom-9 left-3 right-3 z-10 hidden sm:flex items-center overflow-x-auto gap-1.5 bg-surface/85 backdrop-blur p-1.5 rounded-control border border-border">
            {nodes.map((node) => {
              const isSelected = selectedSector === node.id;
              return (
                <button
                  key={node.id}
                  type="button"
                  onClick={() => onSelectSector(isSelected ? null : node.id)}
                  aria-pressed={isSelected}
                  className={cn(
                    'px-2 py-1 rounded-control-sm text-xs font-sans flex items-center gap-1 border transition-all cursor-pointer shrink-0 whitespace-nowrap',
                    isSelected
                      ? 'bg-surface-elevated border-energy-cyan text-energy-cyan font-semibold'
                      : 'border-border/60 text-text-secondary hover:text-text-primary hover:border-text-secondary'
                  )}
                >
                  <span className="scale-75">{node.icon}</span>
                  <span>{node.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        /* 2D Schematic & Circuit Fallback View */
        <div className="flex-1 flex flex-col justify-center p-4 pt-14 pb-12">
          {!hasWebGL && (
            <div className="max-w-2xl mx-auto w-full mb-3 p-2 rounded-control bg-surface-elevated/80 border border-border text-[11px] font-sans text-text-muted flex items-center gap-2">
              <Box className="h-3.5 w-3.5 text-solar-amber shrink-0" aria-hidden="true" />
              <span>{tSim('webglUnavailable')}</span>
            </div>
          )}

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
                    {tSim('solarArrayCapacity', { kw: fmtKw(input.solar.peakKw, 0) })}
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
                    {tSim('batteryStorageCapacity', { kwh: fmtKwh(input.battery.capacityKwh, 0) })}
                  </span>
                </div>
              </div>
              <div className="text-right font-mono">
                <span className="text-sm font-semibold text-battery-green block">
                  {tSim('socValue', { pct: fmtPct(socPct) })}
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
              const priority = input.sectors.find((s) => s.id === node.id)?.priority;
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
                    {priority === 'critical' ? (
                      <span className="text-[9px] font-mono px-1 rounded-control-sm text-critical-red bg-critical-red/10 border border-critical-red/30 uppercase">
                        {tPriorities('critical')}
                      </span>
                    ) : (
                      <span className="text-[9px] font-mono px-1 rounded-control-sm text-text-muted bg-surface-elevated uppercase">
                        {priority ? tPriorities(priority) : null}
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
                      {result ? fmtKw(demand) : fmtKw(null)}
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
                      {result ? fmtKw(served) : fmtKw(null)}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Bottom status hint bar */}
      <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between text-[11px] text-text-muted font-sans pointer-events-none">
        <span>
          {viewMode === '3d'
            ? tSim('hint3d')
            : tSim('clickNodeToInspect')}
        </span>
        <span className="font-mono text-[10px] text-energy-cyan">
          {tCommon('simulatedData')}
        </span>
      </div>
    </div>
  );
}
