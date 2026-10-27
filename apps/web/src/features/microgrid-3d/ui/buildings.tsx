'use client';

import { type ReactNode, useState } from 'react';
import { Html } from '@react-three/drei';
import type { Priority, SectorId } from '@mitsinjo/engine';
import { cn } from '@/lib/utils';
import { fmtPct } from '@/lib/format';
import type { BuildingSceneModel } from '../types';
import { STATUS_BG_CLASS, STATUS_HEX, TOKEN_HEX } from '../utils/scene-palette';

export interface VillageBuildingsProps {
  buildings: Record<SectorId, BuildingSceneModel>;
  selectedSector: SectorId | null;
  onSelectSector: (sector: SectorId | null) => void;
  sectorNames: Record<SectorId, string>;
  priorityLabels: Record<Priority, string>;
}

/** Per-building layout of the shared frame (selection ring, status light, badge). */
interface FrameLayout {
  ringInner: number;
  ledY: number;
}

interface BuildingFrameProps extends FrameLayout {
  model: BuildingSceneModel;
  isSelected: boolean;
  onSelect: () => void;
  sectorName: string;
  priorityLabel: string;
  children: ReactNode;
}

const SELECTED_RING_HEX = TOKEN_HEX.energyCyan;
const HOVER_RING_HEX = '#94a3b8';

function BuildingFrame({
  model,
  isSelected,
  onSelect,
  sectorName,
  priorityLabel,
  ringInner,
  ledY,
  children,
}: BuildingFrameProps) {
  const [hovered, setHovered] = useState(false);
  const { position, statusColor, coveragePct, isCritical } = model;

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
          <ringGeometry args={[ringInner, ringInner + 0.2, 32]} />
          <meshBasicMaterial
            color={isSelected ? SELECTED_RING_HEX : HOVER_RING_HEX}
            transparent
            opacity={0.8}
          />
        </mesh>
      )}

      {/* Status light */}
      <mesh position={[0, ledY, 0]}>
        <sphereGeometry args={[0.16, 12, 12]} />
        <meshBasicMaterial color={STATUS_HEX[statusColor]} />
      </mesh>

      {/* 2D label badge (keyboard-focusable button) */}
      <Html
        position={[0, ledY + 0.6, 0]}
        center
        distanceFactor={18}
        className="pointer-events-auto select-none"
      >
        <button
          type="button"
          onClick={onSelect}
          aria-pressed={isSelected}
          className={cn(
            'flex items-center gap-1.5 px-2 py-1 rounded-control shadow-md backdrop-blur text-[11px] font-sans border transition-all cursor-pointer whitespace-nowrap',
            isSelected
              ? 'bg-surface-elevated/95 border-energy-cyan ring-2 ring-energy-cyan/40 scale-105'
              : 'bg-surface/90 border-border hover:border-text-secondary'
          )}
        >
          <span
            className={cn('w-2 h-2 rounded-full shrink-0', STATUS_BG_CLASS[statusColor])}
            aria-hidden="true"
          />
          <span className="font-semibold text-text-primary">{sectorName}</span>
          <span className="font-mono text-text-muted text-[10px]">
            {fmtPct(coveragePct, 0)}
          </span>
          {isCritical && (
            <span className="px-1 rounded text-[9px] font-mono uppercase bg-critical-red/20 text-critical-red border border-critical-red/30">
              {priorityLabel}
            </span>
          )}
        </button>
      </Html>
    </group>
  );
}

function HealthClinicBody({ isSelected }: { isSelected: boolean }) {
  return (
    <>
      <mesh position={[0, 0.1, 0]}>
        <boxGeometry args={[4.2, 0.2, 3.2]} />
        <meshStandardMaterial color="#334155" roughness={0.9} />
      </mesh>
      <mesh position={[0, 1.1, 0]}>
        <boxGeometry args={[3.8, 1.8, 2.8]} />
        <meshStandardMaterial color={isSelected ? '#f8fafc' : '#e2e8f0'} roughness={0.4} />
      </mesh>
      <mesh position={[0, 2.4, 0]} rotation={[0, Math.PI / 4, 0]}>
        <coneGeometry args={[2.8, 1.1, 4]} />
        <meshStandardMaterial color="#0284c7" roughness={0.3} metalness={0.6} />
      </mesh>
      {/* Medical cross emblem */}
      <group position={[0, 1.4, 1.42]}>
        <mesh>
          <planeGeometry args={[0.6, 0.18]} />
          <meshBasicMaterial color={TOKEN_HEX.criticalRed} />
        </mesh>
        <mesh>
          <planeGeometry args={[0.18, 0.6]} />
          <meshBasicMaterial color={TOKEN_HEX.criticalRed} />
        </mesh>
      </group>
    </>
  );
}

function WaterPumpBody() {
  return (
    <>
      <mesh position={[0, 0.1, 0]}>
        <cylinderGeometry args={[1.8, 2.0, 0.2, 16]} />
        <meshStandardMaterial color="#334155" roughness={0.9} />
      </mesh>
      {[-0.8, 0.8].map((x) =>
        [-0.8, 0.8].map((z) => (
          <mesh key={`${x}-${z}`} position={[x, 1.4, z]}>
            <cylinderGeometry args={[0.06, 0.08, 2.8, 6]} />
            <meshStandardMaterial color="#64748b" metalness={0.7} roughness={0.3} />
          </mesh>
        ))
      )}
      <mesh position={[0, 3.4, 0]}>
        <cylinderGeometry args={[1.4, 1.4, 1.8, 20]} />
        <meshStandardMaterial color="#0284c7" metalness={0.6} roughness={0.3} />
      </mesh>
      <mesh position={[0, 4.4, 0]}>
        <sphereGeometry args={[1.4, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#0369a1" metalness={0.6} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.6, 0]}>
        <boxGeometry args={[1.3, 1.0, 1.3]} />
        <meshStandardMaterial color="#475569" roughness={0.6} />
      </mesh>
      <mesh position={[0.7, 2.0, 0]}>
        <cylinderGeometry args={[0.07, 0.07, 3.0, 8]} />
        <meshStandardMaterial color="#38bdf8" metalness={0.8} roughness={0.2} />
      </mesh>
    </>
  );
}

function SchoolBody() {
  return (
    <>
      <mesh position={[0, 0.1, 0]}>
        <boxGeometry args={[5.2, 0.2, 2.6]} />
        <meshStandardMaterial color="#334155" roughness={0.9} />
      </mesh>
      <mesh position={[0, 1.0, 0]}>
        <boxGeometry args={[4.8, 1.6, 2.2]} />
        <meshStandardMaterial color="#fef08a" roughness={0.6} />
      </mesh>
      <mesh position={[0, 2.1, 0]}>
        <coneGeometry args={[3.2, 1.0, 4]} />
        <meshStandardMaterial color="#b45309" roughness={0.8} />
      </mesh>
      {/* Rooftop demo panel */}
      <mesh position={[0, 2.4, 0.6]} rotation={[-0.4, 0, 0]}>
        <boxGeometry args={[1.2, 0.04, 0.7]} />
        <meshStandardMaterial color="#1e3a8a" metalness={0.7} roughness={0.3} />
      </mesh>
    </>
  );
}

const HUTS: { pos: [number, number, number]; wall: [number, number, number]; color: string; roof: number }[] = [
  { pos: [-1.2, 0, -0.6], wall: [1.5, 1.2, 1.5], color: '#d97706', roof: 1.3 },
  { pos: [1.2, 0, -0.4], wall: [1.6, 1.2, 1.4], color: '#c2410c', roof: 1.4 },
  { pos: [0, 0, 1.0], wall: [1.4, 1.0, 1.3], color: '#b45309', roof: 1.2 },
];

function HousesBody() {
  return (
    <>
      {HUTS.map((hut, idx) => {
        const wallH = hut.wall[1];
        return (
          <group key={idx} position={hut.pos}>
            <mesh position={[0, wallH / 2 + 0.1, 0]}>
              <boxGeometry args={hut.wall} />
              <meshStandardMaterial color={hut.color} roughness={0.9} />
            </mesh>
            <mesh position={[0, wallH + 0.5, 0]} rotation={[0, Math.PI / 4, 0]}>
              <coneGeometry args={[hut.roof, wallH * 0.75, 4]} />
              <meshStandardMaterial color="#78350f" roughness={1} />
            </mesh>
          </group>
        );
      })}
    </>
  );
}

function MarketBody() {
  return (
    <>
      <mesh position={[0, 0.1, 0]}>
        <boxGeometry args={[4.4, 0.15, 3.4]} />
        <meshStandardMaterial color="#334155" roughness={0.9} />
      </mesh>
      {[-1.6, 0, 1.6].map((x) =>
        [-1.2, 1.2].map((z) => (
          <mesh key={`${x}-${z}`} position={[x, 1.0, z]}>
            <cylinderGeometry args={[0.06, 0.06, 1.9, 6]} />
            <meshStandardMaterial color="#78350f" roughness={0.9} />
          </mesh>
        ))
      )}
      <mesh position={[0, 2.05, 0]}>
        <boxGeometry args={[4.2, 0.1, 3.2]} />
        <meshStandardMaterial color="#e11d48" roughness={0.8} />
      </mesh>
      {[-0.8, 0.8].map((x) => (
        <mesh key={x} position={[x, 0.45, 0]}>
          <boxGeometry args={[1.2, 0.6, 1.8]} />
          <meshStandardMaterial color="#92400e" roughness={0.8} />
        </mesh>
      ))}
    </>
  );
}

/** Fixed order = keyboard tab order of the badges. */
const BUILDING_ORDER: SectorId[] = ['health', 'water', 'school', 'households', 'market'];

const LAYOUT: Record<SectorId, FrameLayout> = {
  health: { ringInner: 2.5, ledY: 3.2 },
  water: { ringInner: 2.2, ledY: 4.9 },
  school: { ringInner: 3.0, ledY: 3.0 },
  households: { ringInner: 2.6, ledY: 2.5 },
  market: { ringInner: 2.6, ledY: 2.7 },
};

function BuildingBody({ id, isSelected }: { id: SectorId; isSelected: boolean }) {
  switch (id) {
    case 'health':
      return <HealthClinicBody isSelected={isSelected} />;
    case 'water':
      return <WaterPumpBody />;
    case 'school':
      return <SchoolBody />;
    case 'households':
      return <HousesBody />;
    case 'market':
      return <MarketBody />;
  }
}

export function VillageBuildings({
  buildings,
  selectedSector,
  onSelectSector,
  sectorNames,
  priorityLabels,
}: VillageBuildingsProps) {
  return (
    <group name="village-buildings">
      {BUILDING_ORDER.map((id) => {
        const model = buildings[id];
        const isSelected = selectedSector === id;
        return (
          <BuildingFrame
            key={id}
            model={model}
            isSelected={isSelected}
            onSelect={() => onSelectSector(isSelected ? null : id)}
            sectorName={sectorNames[id]}
            priorityLabel={priorityLabels[model.priority]}
            {...LAYOUT[id]}
          >
            <BuildingBody id={id} isSelected={isSelected} />
          </BuildingFrame>
        );
      })}
    </group>
  );
}
