'use client';

import { type ReactNode, type RefObject, useMemo, useState } from 'react';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import { SECTOR_IDS, type Priority, type SectorId } from '@mitsinjo/engine';
import { SectorIcon } from '@/components/ui/sector-icon';
import { cn } from '@/lib/utils';
import { fmtPct } from '@/lib/format';
import type { BuildingSceneModel } from '../types';
import { STATUS_BG_CLASS, STATUS_HEX, TOKEN_HEX, glowFromIntensity } from '../utils/scene-palette';
import { BODY_LAYOUT, BuildingBody } from './building-bodies';

export interface VillageBuildingsProps {
  buildings: Record<SectorId, BuildingSceneModel>;
  selectedSector: SectorId | null;
  onSelectSector: (sector: SectorId | null) => void;
  sectorNames: Record<SectorId, string>;
  priorityLabels: Record<Priority, string>;
  /** Badge text for a sector at load 0 ("Not connected"). */
  disconnectedLabel: string;
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
  /** Shown instead of the coverage when the sector's load is 0. */
  disconnectedLabel: string;
  htmlPortal?: RefObject<HTMLElement | null>;
  children: ReactNode;
}

const SELECTED_RING_HEX = TOKEN_HEX.energyCyan;
const HOVER_RING_HEX = '#94a3b8';

/** Badge disc behind the sector glyph (same hue as `SECTOR_TEXT_CLASS`). */
const SECTOR_ICON_BG: Record<SectorId, string> = {
  health: 'bg-critical-red/20 border-critical-red/40',
  water: 'bg-energy-cyan/20 border-energy-cyan/40',
  school: 'bg-warning-amber/20 border-warning-amber/40',
  households: 'bg-surface-hover border-border-strong',
  market: 'bg-solar-amber/20 border-solar-amber/40',
  industry: 'bg-network-blue/20 border-network-blue/40',
};

function BuildingFrame({
  id,
  model,
  isSelected,
  onSelect,
  sectorName,
  priorityLabel,
  disconnectedLabel,
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
              ? 'bg-surface-elevated/95 border-energy-cyan ring-2 ring-energy-cyan/50 scale-105'
              : 'bg-surface/90 border border-border hover:border-text-secondary hover:bg-surface-hover'
          )}
        >
          <div
            className={cn(
              'w-5 h-5 rounded-full flex items-center justify-center shrink-0 border',
              SECTOR_ICON_BG[id]
            )}
          >
            <SectorIcon sector={id} className="w-3.5 h-3.5" />
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
              <span className="text-text-secondary">
                · {model.connected ? fmtPct(coveragePct, 0) : disconnectedLabel}
              </span>
            </div>
          </div>
        </button>
      </Html>
    </group>
  );
}

export function VillageBuildings({
  buildings,
  selectedSector,
  onSelectSector,
  sectorNames,
  priorityLabels,
  disconnectedLabel,
  htmlPortal,
  lampGlow = 1,
}: VillageBuildingsProps) {
  return (
    <group name="village-buildings">
      {SECTOR_IDS.map((id) => {
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
            disconnectedLabel={disconnectedLabel}
            htmlPortal={htmlPortal}
            {...BODY_LAYOUT[id]}
          >
            <BuildingBody
              id={id}
              glow={glowFromIntensity(model.intensity) * (0.3 + 0.7 * lampGlow)}
            />
          </BuildingFrame>
        );
      })}
    </group>
  );
}
