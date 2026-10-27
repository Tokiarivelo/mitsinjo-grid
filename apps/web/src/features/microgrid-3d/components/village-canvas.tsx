'use client';

import { Canvas } from '@react-three/fiber';
import { ContactShadows } from '@react-three/drei';
import type { SectorId } from '@mitsinjo/engine';
import { useTranslations } from '@/lib/i18n';
import type { CameraPreset, SceneModel } from '../types';
import { useReducedMotion } from '../utils/webgl';
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
  className?: string;
}

export function VillageCanvas({
  model,
  selectedSector,
  onSelectSector,
  cameraPreset = 'village',
  className,
}: VillageCanvasProps) {
  const tSectors = useTranslations('sectors');
  const tPriorities = useTranslations('priorities');

  const reducedMotion = useReducedMotion();

  const sectorNames: Record<SectorId, string> = {
    health: tSectors('health'),
    water: tSectors('water'),
    school: tSectors('school'),
    households: tSectors('households'),
    market: tSectors('market'),
  };

  const priorityLabels: Record<string, string> = {
    critical: tPriorities('critical'),
    high: tPriorities('high'),
    medium: tPriorities('medium'),
    low: tPriorities('low'),
  };

  // Daylight & Sky calculation
  const sunPos: [number, number, number] = [
    Math.cos(((model.timeIndex - 6) / 12) * Math.PI) * 20,
    Math.max(2, model.sunElevation * 25),
    12,
  ];
  const ambientIntensity = model.isDaytime ? 0.6 : 0.25;
  const dirLightIntensity = model.isDaytime ? model.sunIntensity * 1.4 : 0.1;
  const bgColor = model.isDaytime
    ? '#142033'
    : model.sunElevation > 0
    ? '#0f172a'
    : '#090d16';

  return (
    <div className={className} style={{ width: '100%', height: '100%' }}>
      <Canvas
        camera={{ position: [24, 20, 24], fov: 42 }}
        dpr={[1, 1.75]}
        frameloop={reducedMotion ? 'demand' : 'always'}
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
        <BatteryUnit model={model.battery} />
        <DistributionLines lines={model.lines} reducedMotion={reducedMotion} />
        <VillageBuildings
          buildings={model.buildings}
          selectedSector={selectedSector}
          onSelectSector={onSelectSector}
          sectorNames={sectorNames}
          priorityLabels={priorityLabels}
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
        <CameraController preset={cameraPreset} reducedMotion={reducedMotion} />
      </Canvas>
    </div>
  );
}
