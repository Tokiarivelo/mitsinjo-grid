'use client';

import { type ReactNode, type RefObject, useMemo, useState } from 'react';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import { HeartPulse, Droplet, GraduationCap, Home, Store } from 'lucide-react';
import type { Priority, SectorId } from '@mitsinjo/engine';
import { cn } from '@/lib/utils';
import { fmtPct } from '@/lib/format';
import type { BuildingSceneModel } from '../types';
import {
  STATUS_BG_CLASS,
  STATUS_HEX,
  TOKEN_HEX,
  WINDOW_GLOW_BY_STATUS,
} from '../utils/scene-palette';
import { BODY_LAYOUT, BuildingBody } from './building-bodies';

export interface VillageBuildingsProps {
  buildings: Record<SectorId, BuildingSceneModel>;
  selectedSector: SectorId | null;
  onSelectSector: (sector: SectorId | null) => void;
  sectorNames: Record<SectorId, string>;
  priorityLabels: Record<Priority, string>;
  /** Stable DOM parent for labels (see VillageCanvas). */
  htmlPortal?: RefObject<HTMLElement | null>;
  /** Time-of-day lamp factor from the sky palette (dusk/night → 1, afternoon → low). */
  lampGlow?: number;
}

interface FrameLayout {
  ringInner: number;
  ledY: number;
}

interface BuildingFrameProps extends FrameLayout {
  id: SectorId;
  model: BuildingSceneModel;
  isSelected: boolean;
  onSelect: () => void;
  sectorName: string;
  priorityLabel: string;
  htmlPortal?: RefObject<HTMLElement | null>;
  children: ReactNode;
}

const SELECTED_RING_HEX = TOKEN_HEX.energyCyan;
const HOVER_RING_HEX = '#94a3b8';

function getSectorIcon(id: SectorId) {
  switch (id) {
    case 'health':
      return <HeartPulse className="w-3.5 h-3.5 text-critical-red" aria-hidden="true" />;
    case 'water':
      return <Droplet className="w-3.5 h-3.5 text-energy-cyan" aria-hidden="true" />;
    case 'school':
      return <GraduationCap className="w-3.5 h-3.5 text-warning-amber" aria-hidden="true" />;
    case 'households':
      return <Home className="w-3.5 h-3.5 text-solar-amber" aria-hidden="true" />;
    case 'market':
      return <Store className="w-3.5 h-3.5 text-solar-amber" aria-hidden="true" />;
  }
}

function getSectorIconBg(id: SectorId) {
  switch (id) {
    case 'health':
      return 'bg-critical-red/20 border-critical-red/40';
    case 'water':
      return 'bg-energy-cyan/20 border-energy-cyan/40';
    case 'school':
      return 'bg-warning-amber/20 border-warning-amber/40';
    case 'households':
      return 'bg-solar-amber/20 border-solar-amber/40';
    case 'market':
      return 'bg-solar-amber/20 border-solar-amber/40';
  }
}

function BuildingFrame({
  id,
  model,
  isSelected,
  onSelect,
  sectorName,
  priorityLabel,
  ringInner,
  ledY,
  htmlPortal,
  children,
}: BuildingFrameProps) {
  const [hovered, setHovered] = useState(false);
  const { position, statusColor, coveragePct, priority } = model;
  // Brighter than 1 so the bloom pass gives the status beacon a halo.
  const beaconColor = useMemo(
    () => new THREE.Color(STATUS_HEX[statusColor]).multiplyScalar(2),
    [statusColor]
  );

  return (
    <group
      position={position}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={() => setHovered(false)}
    >
      {children}

      {(isSelected || hovered) && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
          <ringGeometry args={[ringInner, ringInner + 0.25, 32]} />
          <meshBasicMaterial
            color={isSelected ? SELECTED_RING_HEX : HOVER_RING_HEX}
            transparent
            opacity={0.85}
          />
        </mesh>
      )}

      {/* Building Apex Status Beacon */}
      <mesh position={[0, ledY, 0]}>
        <sphereGeometry args={[0.16, 16, 12]} />
        <meshBasicMaterial color={beaconColor} toneMapped={false} />
      </mesh>

      {/* Sleek Glassmorphic Floating Telemetry Badge */}
      <Html
        position={[0, ledY + 0.75, 0]}
        center
        distanceFactor={18}
        portal={htmlPortal as RefObject<HTMLElement>}
        className="pointer-events-auto select-none"
      >
        <button
          type="button"
          onClick={onSelect}
          aria-pressed={isSelected}
          className={cn(
            'flex items-center gap-2 px-3 py-1.5 rounded-full shadow-xl backdrop-blur-md text-[11px] font-sans border transition-all cursor-pointer whitespace-nowrap',
            isSelected
              ? 'bg-[#0e1726]/95 border-energy-cyan ring-2 ring-energy-cyan/50 scale-105'
              : 'bg-[#0a101d]/90 border-border hover:border-text-secondary hover:bg-[#111a2d]/95'
          )}
        >
          <div
            className={cn(
              'w-5 h-5 rounded-full flex items-center justify-center shrink-0 border',
              getSectorIconBg(id)
            )}
          >
            {getSectorIcon(id)}
          </div>
          <div className="flex flex-col text-left leading-tight">
            <span className="font-semibold text-text-primary text-[11px]">{sectorName}</span>
            <div className="flex items-center gap-1.5 font-mono text-[10px]">
              <span
                className={cn('w-1.5 h-1.5 rounded-full shrink-0', STATUS_BG_CLASS[statusColor])}
                aria-hidden="true"
              />
              <span className="text-text-muted">
                {priority === 'critical' ? (
                  <span className="text-critical-red font-semibold">{priorityLabel}</span>
                ) : (
                  <span>{priorityLabel}</span>
                )}
              </span>
              <span className="text-text-secondary">· {fmtPct(coveragePct, 0)}</span>
            </div>
          </div>
        </button>
      </Html>
    </group>
  );
}

const BUILDING_ORDER: SectorId[] = ['health', 'water', 'school', 'households', 'market'];

export function VillageBuildings({
  buildings,
  selectedSector,
  onSelectSector,
  sectorNames,
  priorityLabels,
  htmlPortal,
  lampGlow = 1,
}: VillageBuildingsProps) {
  return (
    <group name="village-buildings">
      {BUILDING_ORDER.map((id) => {
        const model = buildings[id];
        const isSelected = selectedSector === id;
        return (
          <BuildingFrame
            key={id}
            id={id}
            model={model}
            isSelected={isSelected}
            onSelect={() => onSelectSector(isSelected ? null : id)}
            sectorName={sectorNames[id]}
            priorityLabel={priorityLabels[model.priority]}
            htmlPortal={htmlPortal}
            {...BODY_LAYOUT[id]}
          >
            <BuildingBody
              id={id}
              glow={WINDOW_GLOW_BY_STATUS[model.status] * (0.3 + 0.7 * lampGlow)}
            />
          </BuildingFrame>
        );
      })}
    </group>
  );
}
