'use client';

import { type RefObject, useMemo, useState } from 'react';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import { Cpu } from 'lucide-react';
import { SECTOR_IDS, type SectorId } from '@mitsinjo/engine';
import { cn } from '@/lib/utils';
import { fmtKw } from '@/lib/format';
import { BUS_POSITION } from '../utils/to-scene-model';
import { mergeParts, type Part } from '../utils/merge-parts';
import type { ControllerSceneModel } from '../types';
import { TOKEN_HEX } from '../utils/scene-palette';

export interface DispatchControllerUnitProps {
  model: ControllerSceneModel;
  totalServedKw: number;
  onFocus?: () => void;
  nameLabel?: string;
  htmlPortal?: RefObject<HTMLElement | null>;
}

/** Merged technical shelter: concrete pad, frame, roof, enclosure, and cable conduits. */
function buildShelter() {
  const parts: Part[] = [];

  // Concrete foundation pad
  parts.push({
    shape: { kind: 'box', size: [2.6, 0.14, 2.0] },
    position: [0, 0.07, 0],
  });

  // 4 steel shelter posts
  const postXs = [-1.15, 1.15];
  const postZs = [-0.85, 0.85];
  for (const px of postXs) {
    for (const pz of postZs) {
      parts.push({
        shape: { kind: 'box', size: [0.08, 2.1, 0.08] },
        position: [px, 1.12, pz],
      });
    }
  }

  // Canopy roof with slight slope
  parts.push({
    shape: { kind: 'box', size: [2.8, 0.06, 2.2] },
    position: [0, 2.2, 0],
    rotation: [-0.05, 0, 0],
  });

  // Back wall panel
  parts.push({
    shape: { kind: 'box', size: [2.3, 1.7, 0.04] },
    position: [0, 1.05, -0.82],
  });

  // Main EMS enclosure / cabinet body
  parts.push({
    shape: { kind: 'box', size: [1.6, 1.35, 0.55] },
    position: [0, 0.95, -0.2],
  });

  // Base plinth
  parts.push({
    shape: { kind: 'box', size: [1.5, 0.18, 0.5] },
    position: [0, 0.23, -0.2],
  });

  // Top overhead conduit linking cabinet to village line gantry
  parts.push({
    shape: { kind: 'cylinder', radiusTop: 0.04, radiusBottom: 0.04, height: 0.65 },
    position: [0.5, 1.9, -0.2],
  });
  parts.push({
    shape: { kind: 'cylinder', radiusTop: 0.04, radiusBottom: 0.04, height: 0.65 },
    position: [-0.5, 1.9, -0.2],
  });

  // Breaker mounting rail on the front face
  parts.push({
    shape: { kind: 'box', size: [1.35, 0.18, 0.04] },
    position: [0, 0.65, 0.09],
  });

  return mergeParts(parts);
}

/** LED indicator positions for all 6 feeder departures along the breaker mounting rail. */
const FEEDER_SPACING_X: Record<SectorId, number> = {
  health: -0.5,
  water: -0.3,
  school: -0.1,
  households: 0.1,
  market: 0.3,
  industry: 0.5,
};

export function DispatchControllerUnit({
  model,
  totalServedKw,
  onFocus,
  nameLabel = 'EMS Dispatch',
  htmlPortal,
}: DispatchControllerUnitProps) {
  const [hovered, setHovered] = useState(false);
  const shelterGeom = useMemo(() => buildShelter(), []);

  const mode = model.mode;
  const isNormal = mode === 'normal';
  const isEmergency = mode === 'lifeline_only';

  // Screen glow color based on dispatch mode
  const screenColorHex = isNormal
    ? TOKEN_HEX.energyCyan
    : isEmergency
      ? TOKEN_HEX.solarAmber
      : TOKEN_HEX.solarAmber;

  const screenGlow = useMemo(
    () => new THREE.Color(screenColorHex).multiplyScalar(isEmergency ? 2.5 : 1.8),
    [screenColorHex, isEmergency]
  );

  return (
    <group
      position={BUS_POSITION}
      name="ems-dispatch-controller"
      onClick={(e) => {
        e.stopPropagation();
        onFocus?.();
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={() => setHovered(false)}
    >
      {/* 1. Merged technical shelter structure (pad, frame, canopy, cabinet) */}
      <mesh geometry={shelterGeom} receiveShadow castShadow>
        <meshStandardMaterial
          color={hovered ? '#6b7280' : '#4b5563'}
          roughness={0.7}
          metalness={0.3}
        />
      </mesh>

      {/* 2. Emissive EMS status screen on the cabinet front */}
      <mesh position={[0, 1.25, 0.08]} castShadow={false}>
        <planeGeometry args={[0.55, 0.28]} />
        <meshStandardMaterial
          color={screenColorHex}
          emissive={screenGlow}
          emissiveIntensity={1.2}
          roughness={0.2}
          toneMapped={false}
        />
      </mesh>

      {/* 3. Feeder breakers & status LEDs (one per sector) */}
      {SECTOR_IDS.map((sectorId) => {
        const feeder = model.feeders[sectorId];
        const state = feeder?.breaker ?? 'open';
        const posX = FEEDER_SPACING_X[sectorId];

        const ledColor =
          state === 'limited'
            ? '#f59e0b' // Amber (survie / limiter)
            : state === 'closed'
              ? '#22c55e' // Green (powered)
              : '#ef4444'; // Red (open / cut)

        return (
          <group key={sectorId} position={[posX, 0.65, 0.11]}>
            {/* Miniature switch box */}
            <mesh>
              <boxGeometry args={[0.12, 0.14, 0.02]} />
              <meshStandardMaterial color="#1f2937" roughness={0.8} />
            </mesh>
            {/* Status indicator LED */}
            <mesh position={[0, 0.03, 0.015]}>
              <sphereGeometry args={[0.02, 8, 8]} />
              <meshStandardMaterial
                color={ledColor}
                emissive={ledColor}
                emissiveIntensity={2}
                toneMapped={false}
              />
            </mesh>
          </group>
        );
      })}

      {/* 4. In-scene HUD Badge */}
      <Html
        position={[0, 2.45, 0]}
        center
        distanceFactor={22}
        portal={htmlPortal as RefObject<HTMLElement>}
        zIndexRange={[10, 0]}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onFocus?.();
          }}
          className={cn(
            'flex flex-col items-center gap-0.5 rounded-control-sm border bg-surface/90 px-2.5 py-1 text-center shadow-lg backdrop-blur-sm transition-transform hover:scale-105 pointer-events-auto cursor-pointer',
            isEmergency
              ? 'border-warning-amber/70 ring-1 ring-warning-amber/40'
              : 'border-border/80 hover:border-energy-cyan/70'
          )}
        >
          <div className="flex items-center gap-1.5 font-mono text-[10px] text-text-secondary">
            <Cpu
              className={cn(
                'h-3 w-3',
                isEmergency ? 'text-warning-amber animate-pulse' : 'text-energy-cyan'
              )}
              aria-hidden="true"
            />
            <span className="font-semibold text-text-primary">{nameLabel}</span>
          </div>
          <div className="flex items-center gap-1.5 font-mono text-[9px]">
            <span
              className={cn(
                'h-1.5 w-1.5 rounded-full',
                isEmergency
                  ? 'bg-warning-amber animate-pulse'
                  : isNormal
                    ? 'bg-battery-green'
                    : 'bg-warning-amber'
              )}
              aria-hidden="true"
            />
            <span
              className={cn(
                'font-semibold',
                isEmergency
                  ? 'text-warning-amber'
                  : isNormal
                    ? 'text-battery-green'
                    : 'text-warning-amber'
              )}
            >
              {fmtKw(totalServedKw)}
            </span>
          </div>
        </button>
      </Html>
    </group>
  );
}
