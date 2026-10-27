'use client';

import { useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { ContactShadows } from '@react-three/drei';
import type { Priority, SectorId } from '@mitsinjo/engine';
import { useTranslations } from '@/lib/i18n';
import type { BatteryStatusColor, CameraPreset, SceneModel } from '../types';
import { useReducedMotion } from '../hooks/use-reduced-motion';
import { usePerfFlag } from '../hooks/use-perf-flag';
import { createSceneStats, sampleSceneStats, type SceneStatsSample } from '../utils/scene-stats';
import { SceneStatsProbe } from './scene-stats-probe';
import { VillageTerrain } from './terrain';
import { SolarArray } from './solar-array';
import { BatteryUnit } from './battery-unit';
import { DistributionLines } from './distribution-lines';
import { VillageBuildings } from './buildings';
import { CameraController } from './camera-controller';

export interface VillageCanvasProps {
  model: SceneModel;
  selectedSector: SectorId | null;
  onSelectSector: (sector: SectorId | null) => void;
  cameraPreset?: CameraPreset;
  /** Bump to re-apply the current preset (reset camera after the user orbits). */
  cameraResetKey?: number;
  className?: string;
}

export function VillageCanvas({
  model,
  selectedSector,
  onSelectSector,
  cameraPreset = 'village',
  cameraResetKey = 0,
  className,
}: VillageCanvasProps) {
  const tSectors = useTranslations('sectors');
  const tPriorities = useTranslations('priorities');
  const tSim = useTranslations('features.simulation');

  const reducedMotion = useReducedMotion();
  // A modified scenario shows the last result frozen: no flow animation.
  const animate = !reducedMotion && !model.isModified;

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

  // ?perf=1 → draw calls / fps readout, sampled at 2 Hz (no per-frame React state).
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

  // Daylight & Sky calculation
  const sunPos: [number, number, number] = [
    Math.cos(((model.timeIndex - 6) / 12) * Math.PI) * 20,
    Math.max(2, model.sunElevation * 25),
    12,
  ];
  const ambientIntensity = model.isDaytime ? 0.6 : 0.25;
  const dirLightIntensity = model.isDaytime ? model.sunIntensity * 1.4 : 0.1;
  const bgColor = model.isDaytime ? '#142033' : model.sunElevation > 0 ? '#0f172a' : '#090d16';

  return (
    <div ref={htmlPortal} className={className} style={{ width: '100%', height: '100%' }}>
      {perfEnabled && perf && (
        <div className="absolute top-14 right-3 z-20 px-2 py-1 rounded-control bg-surface-elevated/90 border border-border text-[10px] font-mono text-text-secondary pointer-events-none">
          {tSim('perfOverlay', { calls: perf.calls, fps: perf.fps })}
        </div>
      )}
      <Canvas
        camera={{ position: [24, 20, 24], fov: 42 }}
        dpr={[1, 1.75]}
        frameloop="demand"
        style={{ background: bgColor }}
      >
        {/* Sky / Environment Lighting */}
        <ambientLight color="#93c5fd" intensity={ambientIntensity} />
        <directionalLight
          position={sunPos}
          color={model.isDaytime ? '#ffedd5' : '#60a5fa'}
          intensity={dirLightIntensity}
          castShadow={false}
        />
        {/* Soft fill light from opposite quadrant */}
        <directionalLight position={[-15, 10, -15]} color="#38bdf8" intensity={0.2} />

        {/* 3D Scene Components */}
        <VillageTerrain />
        <SolarArray model={model.solar} />
        <BatteryUnit
          model={model.battery}
          statusLabels={batteryStatusLabels}
          socLabel={socLabel}
          htmlPortal={htmlPortal}
        />
        {perfEnabled && <SceneStatsProbe stats={stats} />}
        <DistributionLines lines={model.lines} animate={animate} />
        <VillageBuildings
          buildings={model.buildings}
          selectedSector={selectedSector}
          onSelectSector={onSelectSector}
          sectorNames={sectorNames}
          priorityLabels={priorityLabels}
          htmlPortal={htmlPortal}
        />

        {/* Static Baked Contact Shadows (single frame, zero per-frame cost) */}
        <ContactShadows
          position={[0, 0, 0]}
          opacity={0.65}
          scale={50}
          blur={1.5}
          far={10}
          frames={1}
          color="#020617"
        />

        {/* Camera Control & Presets */}
        <CameraController
          preset={cameraPreset}
          resetKey={cameraResetKey}
          reducedMotion={reducedMotion}
        />
      </Canvas>
    </div>
  );
}
