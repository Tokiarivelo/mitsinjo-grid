'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { ContactShadows, Environment } from '@react-three/drei';
import type { Priority, SectorId } from '@mitsinjo/engine';
import { useTranslations } from '@/lib/i18n';
import { fmtKw } from '@/lib/format';
import type { BatteryStatusColor, CameraPreset, SceneModel } from '../types';
import { useReducedMotion } from '../hooks/use-reduced-motion';
import { usePerfFlag } from '../hooks/use-perf-flag';
import { useSceneQuality, type SceneQuality } from '../hooks/use-scene-quality';
import { isSoftwareRenderer } from '../utils/webgl';
import { createSceneStats, sampleSceneStats, type SceneStatsSample } from '../utils/scene-stats';
import { applyOvercast, skyPalette } from '../utils/sky-palette';
import { WEATHER_ATMOSPHERE } from '../utils/weather-atmosphere';
import { SUN_AZIMUTH_RAD } from '../utils/landscape';
import { SceneStatsProbe } from './scene-stats-probe';
import { VillageTerrain } from './terrain';
import { SolarArray } from './solar-array';
import { BatteryUnit } from './battery-unit';
import { DistributionLines } from './distribution-lines';
import { VillageBuildings } from './buildings';
import { CameraController } from './camera-controller';
import { SkyBackdrop } from './sky-backdrop';
import { Vegetation } from './vegetation';
import { Vehicles } from './vehicles';
import { PostEffects } from './post-effects';
import { QualityProbe } from './quality-probe';
import { WeatherEffects } from './weather-effects';

export const SUNSET_HDRI_URL = '/3d/sunset_1k.hdr';

const KEY_LIGHT_DISTANCE = 70;

export interface VillageCanvasProps {
  model: SceneModel;
  selectedSector: SectorId | null;
  onSelectSector: (sector: SectorId | null) => void;
  cameraPreset?: CameraPreset;
  /** Bump to re-apply the current preset (reset camera after the user orbits). */
  cameraResetKey?: number;
  /** Render tier override. Default: the shared tier from `useSceneQuality` (toggle + auto-downgrade). */
  quality?: SceneQuality;
  className?: string;
}

export function VillageCanvas({
  model,
  selectedSector,
  onSelectSector,
  cameraPreset = 'village',
  cameraResetKey = 0,
  quality: qualityOverride,
  className,
}: VillageCanvasProps) {
  const sceneQuality = useSceneQuality();
  const quality = qualityOverride ?? sceneQuality.quality;
  // Auto-downgrade only applies when the tier comes from the shared store and the user didn't pick it.
  const onSlowDevice =
    qualityOverride || sceneQuality.userChosen ? undefined : sceneQuality.autoDowngrade;
  const tSectors = useTranslations('sectors');
  const tPriorities = useTranslations('priorities');
  const tSim = useTranslations('features.simulation');

  const reducedMotion = useReducedMotion();
  // A modified scenario shows the last result frozen: no flow animation.
  // Moving electrons need a continuous frame loop: off without a GPU (each software
  // frame costs ~0.5 s and would freeze the page); dots stay visible, frozen.
  const softwareGl = isSoftwareRenderer();
  const animate = !reducedMotion && !model.isModified && !softwareGl;
  const high = quality === 'high';

  const sectorNames: Record<SectorId, string> = {
    health: tSectors('health'),
    water: tSectors('water'),
    school: tSectors('school'),
    households: tSectors('households'),
    market: tSectors('market'),
  };

  const priorityLabels: Record<Priority, string> = {
    critical: tPriorities('critical'),
    high: tPriorities('high'),
    medium: tPriorities('medium'),
    low: tPriorities('low'),
  };

  const batteryStatusLabels: Record<BatteryStatusColor, string> = {
    healthy: tSim('batteryHealthy'),
    warning: tSim('batteryLow'),
    critical: tSim('batteryDepleted'),
  };
  const socLabel = (pct: string) => tSim('socValue', { pct });

  // Fixed parent for in-scene HTML labels, so drei's <Html> never re-targets after mount.
  const htmlPortal = useRef<HTMLDivElement>(null);

  // ?perf=1 -> draw calls / fps readout, sampled at 2 Hz (no per-frame React state).
  const perfEnabled = usePerfFlag();
  // Stable mutable counters shared with the in-canvas probe.
  const [stats] = useState(() => createSceneStats(0));
  const [perf, setPerf] = useState<SceneStatsSample | null>(null);
  useEffect(() => {
    if (!perfEnabled) return;
    sampleSceneStats(stats, performance.now()); // start a fresh window
    const id = window.setInterval(() => {
      const sample = sampleSceneStats(stats, performance.now());
      setPerf(sample);
      // Read by `make scene-audit`.
      (window as Window & { __mitsinjoScene?: SceneStatsSample }).__mitsinjoScene = sample;
    }, 500);
    return () => window.clearInterval(id);
  }, [perfEnabled, stats]);

  // Art-directed light for the selected hour (golden hour by day, moonlit night),
  // greyed by the day's weather (overcast sky, dim sun, thicker haze).
  const palette = useMemo(
    () =>
      applyOvercast(
        skyPalette(model.sunElevation, model.isDaytime),
        WEATHER_ATMOSPHERE[model.weather].overcast,
        model.isDaytime
      ),
    [model.sunElevation, model.isDaytime, model.weather]
  );
  // Clouds drift and rain falls whenever motion is allowed (even on a modified run).
  const weatherMotion = !reducedMotion && !softwareGl;
  const sunDirection = useMemo<[number, number, number]>(() => {
    const alt = (palette.sunAltitudeDeg * Math.PI) / 180;
    return [
      Math.cos(alt) * Math.sin(SUN_AZIMUTH_RAD),
      Math.sin(alt),
      -Math.cos(alt) * Math.cos(SUN_AZIMUTH_RAD),
    ];
  }, [palette.sunAltitudeDeg]);
  // Visible sun / sky glow: low on the horizon so the sunset reads in frame.
  const skySunDirection = useMemo<[number, number, number]>(() => {
    const alt = (palette.sunDisplayAltitudeDeg * Math.PI) / 180;
    return [
      Math.cos(alt) * Math.sin(SUN_AZIMUTH_RAD),
      Math.sin(alt),
      -Math.cos(alt) * Math.cos(SUN_AZIMUTH_RAD),
    ];
  }, [palette.sunDisplayAltitudeDeg]);
  const keyLightPos = useMemo<[number, number, number]>(
    () => [
      sunDirection[0] * KEY_LIGHT_DISTANCE,
      sunDirection[1] * KEY_LIGHT_DISTANCE,
      sunDirection[2] * KEY_LIGHT_DISTANCE,
    ],
    [sunDirection]
  );

  return (
    <div ref={htmlPortal} className={className} style={{ width: '100%', height: '100%' }}>
      {perfEnabled && perf && (
        <div className="absolute bottom-24 right-3 z-20 px-2 py-1 rounded-control bg-surface-elevated/90 border border-border text-[10px] font-mono text-text-secondary pointer-events-none">
          {tSim('perfOverlay', { calls: perf.calls, fps: perf.fps })}
        </div>
      )}
      <Canvas
        // Remount on tier change: shadow maps, MSAA and shaders differ per tier.
        key={quality}
        camera={{ position: [2, 10.5, 28], fov: 42, near: 0.5, far: 1400 }}
        dpr={high ? [1, 1.5] : [1, 1.25]}
        frameloop="demand"
        shadows={high ? 'soft' : false}
        gl={{ antialias: !high, powerPreference: 'high-performance' }}
        style={{ background: palette.horizon }}
      >
        <fog
          attach="fog"
          args={[palette.fog, 48 * palette.fogScale, (high ? 210 : 170) * palette.fogScale]}
        />

        <hemisphereLight args={[palette.hemiSky, palette.hemiGround, palette.hemiIntensity]} />
        <directionalLight
          position={keyLightPos}
          color={palette.sun}
          intensity={palette.keyIntensity}
          castShadow={high}
          shadow-mapSize={[2048, 2048]}
          shadow-bias={-0.0004}
          shadow-normalBias={0.09}
          shadow-camera-left={-34}
          shadow-camera-right={34}
          shadow-camera-top={34}
          shadow-camera-bottom={-34}
          shadow-camera-near={10}
          shadow-camera-far={160}
        />
        {/* Cool sky fill from the opposite side keeps shadows readable. */}
        <directionalLight
          position={[-40, 30, 40]}
          color="#8fa3d9"
          intensity={palette.hemiIntensity * 0.45}
        />

        <SkyBackdrop palette={palette} sunDirection={skySunDirection} detail={quality} />
        <WeatherEffects
          weather={model.weather}
          isDaytime={model.isDaytime}
          quality={quality}
          animate={weatherMotion}
        />

        <Suspense fallback={null}>
          <Environment files={SUNSET_HDRI_URL} environmentIntensity={palette.envIntensity} />
        </Suspense>

        <VillageTerrain quality={quality} />
        <Suspense fallback={null}>
          <Vegetation quality={quality} />
          <Vehicles />
        </Suspense>

        <SolarArray
          model={model.solar}
          nameLabel={tSim('solarArray')}
          outputLabel={`${tSim('liveOutput')} : ${fmtKw(model.solar.currentKw)}`}
          htmlPortal={htmlPortal}
        />
        <BatteryUnit
          model={model.battery}
          statusLabels={batteryStatusLabels}
          socLabel={socLabel}
          nameLabel={tSim('bessBattery')}
          htmlPortal={htmlPortal}
        />
        {perfEnabled && <SceneStatsProbe stats={stats} />}
        <DistributionLines
          lines={model.lines}
          animate={animate}
          lampGlow={palette.lampGlow}
          halo={high}
        />
        <VillageBuildings
          buildings={model.buildings}
          selectedSector={selectedSector}
          onSelectSector={onSelectSector}
          sectorNames={sectorNames}
          priorityLabels={priorityLabels}
          htmlPortal={htmlPortal}
          lampGlow={palette.lampGlow}
        />

        {high ? (
          <>
            <PostEffects />
            {onSlowDevice && <QualityProbe onSlow={onSlowDevice} />}
          </>
        ) : (
          // Low tier: one baked contact shadow instead of real-time shadow maps.
          <ContactShadows
            position={[0, 0.01, 0]}
            opacity={0.55}
            scale={44}
            blur={1.8}
            far={8}
            frames={1}
            color="#1a1408"
          />
        )}

        <CameraController
          preset={cameraPreset}
          resetKey={cameraResetKey}
          focusSector={selectedSector}
          autoRotate={!softwareGl}
          reducedMotion={reducedMotion}
          damping={high && !reducedMotion}
        />
      </Canvas>
    </div>
  );
}
