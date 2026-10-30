'use client';

import { useMemo, useRef, useState } from 'react';
import {
  Battery,
  Box,
  Camera,
  Gauge,
  Maximize2,
  Minimize2,
  Sparkles,
  Zap,
  MapPin,
  RotateCcw,
  Sun,
} from 'lucide-react';
import type { SectorId, SimulationInput, SimulationResult, WeatherId } from '@mitsinjo/engine';
import { WEATHER_VISUALS } from '../utils/weather';
import { cn } from '@/lib/utils';
import { fmtHour, fmtKw, fmtPct } from '@/lib/format';
import { SectorIcon } from '@/components/ui/sector-icon';
import { ViewModeToggle } from '@/components/ui/view-mode-toggle';
import { useTranslations } from '@/lib/i18n';
import {
  toSceneModel,
  useWebGLAvailable,
  LazyVillageCanvas,
  GridDiagram,
  useFullscreen,
  useSceneQuality,
  type CameraPreset,
  type SceneQuality,
} from '@/features/microgrid-3d';

export interface VillageViewportProps {
  input: SimulationInput;
  result?: SimulationResult;
  selectedSector: SectorId | null;
  onSelectSector: (sector: SectorId | null) => void;
  timeIndex: number;
  /** Store status is `modified`: show the last result dimmed and frozen. */
  isModified?: boolean;
  /** Weather of the day shown: drives the 3D sky, clouds and rain. Default sunny. */
  weather?: WeatherId;
  className?: string;
}

const QUALITY_KEYS: { id: SceneQuality; labelKey: string }[] = [
  { id: 'high', labelKey: 'qualityHigh' },
  { id: 'low', labelKey: 'qualityLow' },
];

const CAMERA_PRESET_KEYS: { id: CameraPreset; labelKey: string }[] = [
  { id: 'village', labelKey: 'presetVillage' },
  { id: 'solar', labelKey: 'presetSolar' },
  { id: 'battery', labelKey: 'presetBattery' },
  { id: 'controller', labelKey: 'presetController' },
  { id: 'essential', labelKey: 'presetEssential' },
];

export function VillageViewport({
  input,
  result,
  selectedSector,
  onSelectSector,
  timeIndex,
  isModified = false,
  weather = 'sunny',
  className,
}: VillageViewportProps) {
  const tSim = useTranslations('features.simulation');
  const tWeather = useTranslations('features.simulation.workflow.weather');
  const { icon: WeatherIcon, tone: weatherTone } = WEATHER_VISUALS[weather];
  const tSectors = useTranslations('sectors');
  const tCommon = useTranslations('common');

  const hasWebGL = useWebGLAvailable();
  const rootRef = useRef<HTMLDivElement>(null);
  const {
    isFullscreen,
    toggle: toggleFullscreen,
    supported: fullscreenSupported,
  } = useFullscreen(rootRef);
  const { quality, userChosen, setQuality } = useSceneQuality();
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
  const socPct = step?.socPct ?? input.battery.initialSocPct;
  const demandKw = step?.demandKw ?? null;

  // Scene model for 3D visualization (pure mapping)
  const sceneModel = useMemo(
    () =>
      toSceneModel({
        input,
        result,
        timeIndex,
        isModified,
        strategy: result?.strategy ?? 'proportional',
        weather,
      }),
    [input, result, timeIndex, isModified, weather]
  );

  const sectorIds = input.sectors.map((sec) => sec.id);

  return (
    <div
      ref={rootRef}
      className={cn(
        'relative flex flex-col justify-between rounded-card bg-canvas-sunken border border-border overflow-hidden shadow-inner min-h-[360px] sm:min-h-[460px]',
        isFullscreen && 'rounded-none border-0',
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

          <div className="flex items-center gap-1 px-2 py-1 rounded-control bg-surface/80 backdrop-blur border border-border text-[11px] font-sans text-text-secondary">
            <WeatherIcon className={cn('h-3.5 w-3.5', weatherTone)} aria-hidden="true" />
            <span>{tWeather(weather)}</span>
          </div>

          <div className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-control bg-surface/80 backdrop-blur border border-border text-[11px] font-sans text-text-muted">
            <MapPin className="h-3 w-3 text-solar-amber" aria-hidden="true" />
            <span>{tSim('siteLocation')}</span>
          </div>
        </div>

        {/* Center: 3D Camera Presets & Reset (visible in 3D mode) */}
        {viewMode === '3d' && hasWebGL && (
          <div className="flex items-center gap-1 p-0.5 rounded-control bg-surface-elevated/90 backdrop-blur border border-border pointer-events-auto shadow-xs overflow-x-auto max-w-full">
            <div className="flex items-center gap-1 px-1.5 text-[11px] font-mono text-text-muted border-r border-border pr-2 shrink-0">
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
                  'px-1.5 sm:px-2 py-0.5 rounded-control-sm text-[11px] sm:text-xs font-sans transition-colors cursor-pointer shrink-0',
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
              className="p-1 rounded-control-sm text-text-muted hover:text-text-primary hover:bg-surface transition-colors cursor-pointer ml-0.5 shrink-0"
            >
              <RotateCcw className="h-3 w-3" aria-hidden="true" />
            </button>
          </div>
        )}

        {/* Render quality tier + fullscreen (3D only) */}
        {viewMode === '3d' && hasWebGL && (
          <div className="flex items-center gap-1 p-0.5 rounded-control bg-surface-elevated/90 backdrop-blur border border-border pointer-events-auto shadow-xs">
            <div
              className="flex items-center gap-1 px-1.5 text-[11px] font-mono text-text-muted border-r border-border pr-2"
              title={!userChosen && quality === 'low' ? tSim('qualityAutoLowered') : undefined}
            >
              {quality === 'high' ? (
                <Sparkles className="h-3 w-3 text-solar-amber" aria-hidden="true" />
              ) : (
                <Gauge className="h-3 w-3 text-text-secondary" aria-hidden="true" />
              )}
              <span className="hidden md:inline">{tSim('qualityLabel')}</span>
            </div>
            {QUALITY_KEYS.map(({ id, labelKey }) => (
              <button
                key={id}
                type="button"
                onClick={() => setQuality(id)}
                aria-pressed={quality === id}
                className={cn(
                  'px-2 py-0.5 rounded-control-sm text-xs font-sans transition-colors cursor-pointer',
                  quality === id
                    ? 'bg-energy-cyan/20 text-energy-cyan font-medium'
                    : 'text-text-muted hover:text-text-primary'
                )}
              >
                {tSim(labelKey)}
              </button>
            ))}
            {fullscreenSupported && (
              <FullscreenButton
                isFullscreen={isFullscreen}
                onToggle={toggleFullscreen}
                className="ml-1 border-l border-border pl-1.5"
              />
            )}
          </div>
        )}

        {/* 2D views: full screen gives the narrow diagrams the whole display */}
        {viewMode !== '3d' && fullscreenSupported && (
          <div className="flex items-center p-0.5 rounded-control bg-surface-elevated/90 backdrop-blur border border-border pointer-events-auto shadow-xs">
            <FullscreenButton
              isFullscreen={isFullscreen}
              onToggle={toggleFullscreen}
              className="flex h-10 w-10 md:h-7 md:w-7 items-center justify-center"
            />
          </div>
        )}

        {/* Right: View Mode Toggle (3D vs 2D Topology vs Circuit) */}
        <ViewModeToggle
          label={tSim('viewModeLabel')}
          value={viewMode}
          onChange={setUserViewMode}
          className="pointer-events-auto shadow-xs"
          options={[
            ...(hasWebGL
              ? [
                  {
                    id: '3d' as const,
                    label: tSim('view3d'),
                    icon: <Box className="h-3 w-3" aria-hidden="true" />,
                  },
                ]
              : []),
            { id: 'schematic' as const, label: tSim('viewTopology') },
            { id: 'circuit' as const, label: tSim('viewCircuit') },
          ]}
        />
      </div>

      {/* Main Viewport Content Area */}
      {viewMode === '3d' && hasWebGL ? (
        <div className="relative flex-1 w-full h-full min-h-[360px] sm:min-h-[460px]">
          <LazyVillageCanvas
            model={sceneModel}
            selectedSector={selectedSector}
            onSelectSector={onSelectSector}
            cameraPreset={cameraPreset}
            onSelectPreset={applyPreset}
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

          {/* Fullscreen stats strip: engine values for the selected hour */}
          {isFullscreen && (
            <div className="absolute bottom-24 left-3 z-10 flex items-center gap-4 px-4 py-2.5 rounded-card bg-surface/85 backdrop-blur border border-border">
              <span className="text-[10px] font-mono uppercase tracking-wider text-text-muted border-r border-border pr-4">
                {tCommon('simulatedData')}
              </span>
              <div className="flex items-center gap-2">
                <Sun className="h-4 w-4 text-solar-amber" aria-hidden="true" />
                <div className="leading-tight">
                  <span className="block text-[10px] text-text-muted">{tSim('liveOutput')}</span>
                  <span className="font-mono text-sm text-text-primary">
                    {result ? fmtKw(solarKw) : fmtKw(null)}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Battery className="h-4 w-4 text-battery-green" aria-hidden="true" />
                <div className="leading-tight">
                  <span className="block text-[10px] text-text-muted">{tSim('bessBattery')}</span>
                  <span className="font-mono text-sm text-text-primary">
                    {tSim('socValue', { pct: fmtPct(socPct) })}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-energy-cyan" aria-hidden="true" />
                <div className="leading-tight">
                  <span className="block text-[10px] text-text-muted">{tSim('villageDemand')}</span>
                  <span className="font-mono text-sm text-text-primary">{fmtKw(demandKw)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Adjacent 2D Sector Selector mirror bar (bottom-left) for quick accessibility */}
          <div className="absolute bottom-9 left-3 right-3 z-10 hidden sm:flex items-center overflow-x-auto gap-1.5 bg-surface/85 backdrop-blur p-1.5 rounded-control border border-border">
            {sectorIds.map((id) => {
              const isSelected = selectedSector === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => onSelectSector(isSelected ? null : id)}
                  aria-pressed={isSelected}
                  className={cn(
                    'px-2 py-1 rounded-control-sm text-xs font-sans flex items-center gap-1 border transition-all cursor-pointer shrink-0 whitespace-nowrap',
                    isSelected
                      ? 'bg-surface-elevated border-energy-cyan text-energy-cyan font-semibold'
                      : 'border-border/60 text-text-secondary hover:text-text-primary hover:border-text-secondary'
                  )}
                >
                  <SectorIcon sector={id} tinted={!isSelected} className="h-3 w-3" />
                  <span>{tSectors(id)}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        /* 2D village plan / single-line circuit: same model as the 3D twin */
        <div
          className={cn(
            // Top padding clears the floating HUD (two rows in the card, one in full screen).
            'flex-1 flex flex-col gap-2 px-3 sm:px-4 pt-24 sm:pt-20 pb-16 min-h-[360px] sm:min-h-[460px]',
            isFullscreen && 'sm:pt-14'
          )}
        >
          {!hasWebGL && (
            <div className="max-w-2xl mx-auto w-full p-2 rounded-control bg-surface-elevated/80 border border-border text-[11px] font-sans text-text-muted flex items-center gap-2">
              <Box className="h-3.5 w-3.5 text-solar-amber shrink-0" aria-hidden="true" />
              <span>{tSim('webglUnavailable')}</span>
            </div>
          )}
          <GridDiagram
            model={sceneModel}
            variant={viewMode === 'circuit' ? 'circuit' : 'topology'}
            selectedSector={selectedSector}
            onSelectSector={onSelectSector}
            wheelZoom={isFullscreen}
            className={cn('flex-1', isModified && 'opacity-60')}
          />
        </div>
      )}

      {/* Bottom status hint bar */}
      <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between text-[11px] text-text-muted font-sans pointer-events-none">
        <span>{viewMode === '3d' ? tSim('hint3d') : tSim('clickNodeToInspect')}</span>
        <span className="font-mono text-[10px] text-energy-cyan">{tCommon('simulatedData')}</span>
      </div>
    </div>
  );
}

function FullscreenButton({
  isFullscreen,
  onToggle,
  className,
}: {
  isFullscreen: boolean;
  onToggle: () => void;
  className?: string;
}) {
  const tSim = useTranslations('features.simulation');
  const label = isFullscreen ? tSim('fullscreenExit') : tSim('fullscreenEnter');
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={isFullscreen}
      aria-label={label}
      title={label}
      className={cn(
        'p-1 rounded-control-sm text-text-muted hover:text-text-primary hover:bg-surface transition-colors cursor-pointer',
        className
      )}
    >
      {isFullscreen ? (
        <Minimize2 className="h-3 w-3" aria-hidden="true" />
      ) : (
        <Maximize2 className="h-3 w-3" aria-hidden="true" />
      )}
    </button>
  );
}
