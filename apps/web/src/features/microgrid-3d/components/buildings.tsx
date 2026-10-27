'use client';

import { useState } from 'react';
import { Html } from '@react-three/drei';
import type { SectorId } from '@mitsinjo/engine';
import { cn } from '@/lib/utils';
import type { BuildingSceneModel } from '../types';

export interface VillageBuildingsProps {
  buildings: Record<SectorId, BuildingSceneModel>;
  selectedSector: SectorId | null;
  onSelectSector: (sector: SectorId | null) => void;
  sectorNames: Record<SectorId, string>;
  priorityLabels: Record<string, string>;
}

interface BuildingMeshProps {
  model: BuildingSceneModel;
  isSelected: boolean;
  onSelect: () => void;
  sectorName: string;
  priorityLabel?: string;
}

function HealthClinicMesh({
  model,
  isSelected,
  onSelect,
  sectorName,
  priorityLabel,
}: BuildingMeshProps) {
  const [hovered, setHovered] = useState(false);
  const { position, statusColor, coveragePct, isCritical } = model;

  const statusHex =
    statusColor === 'battery-green'
      ? '#22c55e'
      : statusColor === 'warning-amber'
      ? '#f59e0b'
      : '#ef4444';

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
      {/* Foundation plinth */}
      <mesh position={[0, 0.1, 0]}>
        <boxGeometry args={[4.2, 0.2, 3.2]} />
        <meshStandardMaterial color="#334155" roughness={0.9} />
      </mesh>

      {/* Main Clinic White Building */}
      <mesh position={[0, 1.1, 0]}>
        <boxGeometry args={[3.8, 1.8, 2.8]} />
        <meshStandardMaterial
          color={isSelected ? '#f8fafc' : '#e2e8f0'}
          roughness={0.4}
        />
      </mesh>

      {/* Pitched Roof (Hi-tech galvanized tin roof) */}
      <mesh position={[0, 2.4, 0]} rotation={[0, Math.PI / 4, 0]}>
        <coneGeometry args={[2.8, 1.1, 4]} />
        <meshStandardMaterial color="#0284c7" roughness={0.3} metalness={0.6} />
      </mesh>

      {/* Red Cross Medical Emblem on front */}
      <group position={[0, 1.4, 1.42]}>
        {/* Horizontal bar */}
        <mesh>
          <planeGeometry args={[0.6, 0.18]} />
          <meshBasicMaterial color="#ef4444" />
        </mesh>
        {/* Vertical bar */}
        <mesh>
          <planeGeometry args={[0.18, 0.6]} />
          <meshBasicMaterial color="#ef4444" />
        </mesh>
      </group>

      {/* Selection / Status Beacon Ring at Base */}
      {(isSelected || hovered) && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
          <ringGeometry args={[2.5, 2.7, 32]} />
          <meshBasicMaterial color={isSelected ? '#50d8e8' : '#94a3b8'} transparent opacity={0.8} />
        </mesh>
      )}

      {/* Status LED Pin */}
      <mesh position={[0, 3.2, 0]}>
        <sphereGeometry args={[0.16, 12, 12]} />
        <meshBasicMaterial color={statusHex} />
      </mesh>

      {/* 2D HTML Label Badge */}
      <Html
        position={[0, 3.8, 0]}
        center
        distanceFactor={18}
        className="pointer-events-auto select-none"
      >
        <button
          type="button"
          onClick={onSelect}
          className={cn(
            'flex items-center gap-1.5 px-2 py-1 rounded-control shadow-md backdrop-blur text-[11px] font-sans border transition-all cursor-pointer whitespace-nowrap',
            isSelected
              ? 'bg-surface-elevated/95 border-energy-cyan ring-2 ring-energy-cyan/40 scale-105'
              : 'bg-surface/90 border-border hover:border-text-secondary'
          )}
        >
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: statusHex }}
          />
          <span className="font-semibold text-text-primary">{sectorName}</span>
          <span className="font-mono text-text-muted text-[10px]">
            {coveragePct}%
          </span>
          {isCritical && priorityLabel && (
            <span className="px-1 py-0.2 rounded text-[9px] font-mono uppercase bg-critical-red/20 text-critical-red border border-critical-red/30">
              {priorityLabel}
            </span>
          )}
        </button>
      </Html>
    </group>
  );
}

function WaterPumpMesh({
  model,
  isSelected,
  onSelect,
  sectorName,
  priorityLabel,
}: BuildingMeshProps) {
  const [hovered, setHovered] = useState(false);
  const { position, statusColor, coveragePct, isCritical } = model;

  const statusHex =
    statusColor === 'battery-green'
      ? '#22c55e'
      : statusColor === 'warning-amber'
      ? '#f59e0b'
      : '#ef4444';

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
      {/* Foundation plinth */}
      <mesh position={[0, 0.1, 0]}>
        <cylinderGeometry args={[1.8, 2.0, 0.2, 16]} />
        <meshStandardMaterial color="#334155" roughness={0.9} />
      </mesh>

      {/* 4 Steel Truss Legs */}
      {[-0.8, 0.8].map((x) =>
        [-0.8, 0.8].map((z) => (
          <mesh key={`${x}-${z}`} position={[x, 1.4, z]}>
            <cylinderGeometry args={[0.06, 0.08, 2.8, 6]} />
            <meshStandardMaterial color="#64748b" metalness={0.7} roughness={0.3} />
          </mesh>
        ))
      )}

      {/* Elevated Cylindrical Water Storage Tank */}
      <mesh position={[0, 3.4, 0]}>
        <cylinderGeometry args={[1.4, 1.4, 1.8, 20]} />
        <meshStandardMaterial
          color="#0284c7"
          metalness={0.6}
          roughness={0.3}
        />
      </mesh>
      {/* Tank Dome Roof */}
      <mesh position={[0, 4.4, 0]}>
        <sphereGeometry args={[1.4, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#0369a1" metalness={0.6} roughness={0.3} />
      </mesh>

      {/* Pump House Enclosure at Base */}
      <mesh position={[0, 0.6, 0]}>
        <boxGeometry args={[1.3, 1.0, 1.3]} />
        <meshStandardMaterial color="#475569" roughness={0.6} />
      </mesh>

      {/* Vertical Water Pipe */}
      <mesh position={[0.7, 2.0, 0]}>
        <cylinderGeometry args={[0.07, 0.07, 3.0, 8]} />
        <meshStandardMaterial color="#38bdf8" metalness={0.8} roughness={0.2} />
      </mesh>

      {/* Selection ring */}
      {(isSelected || hovered) && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
          <ringGeometry args={[2.2, 2.4, 32]} />
          <meshBasicMaterial color={isSelected ? '#50d8e8' : '#94a3b8'} transparent opacity={0.8} />
        </mesh>
      )}

      {/* Status LED Pin */}
      <mesh position={[0, 4.9, 0]}>
        <sphereGeometry args={[0.16, 12, 12]} />
        <meshBasicMaterial color={statusHex} />
      </mesh>

      {/* 2D HTML Label Badge */}
      <Html
        position={[0, 5.5, 0]}
        center
        distanceFactor={18}
        className="pointer-events-auto select-none"
      >
        <button
          type="button"
          onClick={onSelect}
          className={cn(
            'flex items-center gap-1.5 px-2 py-1 rounded-control shadow-md backdrop-blur text-[11px] font-sans border transition-all cursor-pointer whitespace-nowrap',
            isSelected
              ? 'bg-surface-elevated/95 border-energy-cyan ring-2 ring-energy-cyan/40 scale-105'
              : 'bg-surface/90 border-border hover:border-text-secondary'
          )}
        >
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: statusHex }}
          />
          <span className="font-semibold text-text-primary">{sectorName}</span>
          <span className="font-mono text-text-muted text-[10px]">
            {coveragePct}%
          </span>
          {isCritical && priorityLabel && (
            <span className="px-1 py-0.2 rounded text-[9px] font-mono uppercase bg-critical-red/20 text-critical-red border border-critical-red/30">
              {priorityLabel}
            </span>
          )}
        </button>
      </Html>
    </group>
  );
}

function PrimarySchoolMesh({
  model,
  isSelected,
  onSelect,
  sectorName,
}: BuildingMeshProps) {
  const [hovered, setHovered] = useState(false);
  const { position, statusColor, coveragePct } = model;

  const statusHex =
    statusColor === 'battery-green'
      ? '#22c55e'
      : statusColor === 'warning-amber'
      ? '#f59e0b'
      : '#ef4444';

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
      {/* School plinth */}
      <mesh position={[0, 0.1, 0]}>
        <boxGeometry args={[5.2, 0.2, 2.6]} />
        <meshStandardMaterial color="#334155" roughness={0.9} />
      </mesh>

      {/* Elongated Classroom Pavilion */}
      <mesh position={[0, 1.0, 0]}>
        <boxGeometry args={[4.8, 1.6, 2.2]} />
        <meshStandardMaterial color="#fef08a" roughness={0.6} />
      </mesh>

      {/* School Pitched Gable Roof */}
      <mesh position={[0, 2.1, 0]} rotation={[0, 0, 0]}>
        <coneGeometry args={[3.2, 1.0, 4]} />
        <meshStandardMaterial color="#b45309" roughness={0.8} />
      </mesh>

      {/* Small Demonstration Rooftop Solar Panel */}
      <group position={[0, 2.4, 0.6]} rotation={[-0.4, 0, 0]}>
        <mesh>
          <boxGeometry args={[1.2, 0.04, 0.7]} />
          <meshStandardMaterial color="#1e3a8a" metalness={0.7} roughness={0.3} />
        </mesh>
      </group>

      {/* Selection ring */}
      {(isSelected || hovered) && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
          <ringGeometry args={[3.0, 3.2, 32]} />
          <meshBasicMaterial color={isSelected ? '#50d8e8' : '#94a3b8'} transparent opacity={0.8} />
        </mesh>
      )}

      {/* Status LED Pin */}
      <mesh position={[0, 3.0, 0]}>
        <sphereGeometry args={[0.16, 12, 12]} />
        <meshBasicMaterial color={statusHex} />
      </mesh>

      {/* 2D HTML Label Badge */}
      <Html
        position={[0, 3.6, 0]}
        center
        distanceFactor={18}
        className="pointer-events-auto select-none"
      >
        <button
          type="button"
          onClick={onSelect}
          className={cn(
            'flex items-center gap-1.5 px-2 py-1 rounded-control shadow-md backdrop-blur text-[11px] font-sans border transition-all cursor-pointer whitespace-nowrap',
            isSelected
              ? 'bg-surface-elevated/95 border-energy-cyan ring-2 ring-energy-cyan/40 scale-105'
              : 'bg-surface/90 border-border hover:border-text-secondary'
          )}
        >
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: statusHex }}
          />
          <span className="font-semibold text-text-primary">{sectorName}</span>
          <span className="font-mono text-text-muted text-[10px]">
            {coveragePct}%
          </span>
        </button>
      </Html>
    </group>
  );
}

function VillageHousesMesh({
  model,
  isSelected,
  onSelect,
  sectorName,
}: BuildingMeshProps) {
  const [hovered, setHovered] = useState(false);
  const { position, statusColor, coveragePct } = model;

  const statusHex =
    statusColor === 'battery-green'
      ? '#22c55e'
      : statusColor === 'warning-amber'
      ? '#f59e0b'
      : '#ef4444';

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
      {/* Cluster of 3 Village Huts / Dwellings */}
      {/* Hut 1 */}
      <group position={[-1.2, 0, -0.6]}>
        <mesh position={[0, 0.7, 0]}>
          <boxGeometry args={[1.5, 1.2, 1.5]} />
          <meshStandardMaterial color="#d97706" roughness={0.9} />
        </mesh>
        <mesh position={[0, 1.7, 0]} rotation={[0, Math.PI / 4, 0]}>
          <coneGeometry args={[1.3, 0.9, 4]} />
          <meshStandardMaterial color="#78350f" roughness={1} />
        </mesh>
      </group>

      {/* Hut 2 */}
      <group position={[1.2, 0, -0.4]}>
        <mesh position={[0, 0.7, 0]}>
          <boxGeometry args={[1.6, 1.2, 1.4]} />
          <meshStandardMaterial color="#c2410c" roughness={0.9} />
        </mesh>
        <mesh position={[0, 1.7, 0]} rotation={[0, Math.PI / 4, 0]}>
          <coneGeometry args={[1.4, 0.9, 4]} />
          <meshStandardMaterial color="#78350f" roughness={1} />
        </mesh>
      </group>

      {/* Hut 3 */}
      <group position={[0, 0, 1.0]}>
        <mesh position={[0, 0.6, 0]}>
          <boxGeometry args={[1.4, 1.0, 1.3]} />
          <meshStandardMaterial color="#b45309" roughness={0.9} />
        </mesh>
        <mesh position={[0, 1.5, 0]} rotation={[0, Math.PI / 4, 0]}>
          <coneGeometry args={[1.2, 0.8, 4]} />
          <meshStandardMaterial color="#78350f" roughness={1} />
        </mesh>
      </group>

      {/* Selection ring */}
      {(isSelected || hovered) && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
          <ringGeometry args={[2.6, 2.8, 32]} />
          <meshBasicMaterial color={isSelected ? '#50d8e8' : '#94a3b8'} transparent opacity={0.8} />
        </mesh>
      )}

      {/* Status LED Pin */}
      <mesh position={[0, 2.5, 0]}>
        <sphereGeometry args={[0.16, 12, 12]} />
        <meshBasicMaterial color={statusHex} />
      </mesh>

      {/* 2D HTML Label Badge */}
      <Html
        position={[0, 3.1, 0]}
        center
        distanceFactor={18}
        className="pointer-events-auto select-none"
      >
        <button
          type="button"
          onClick={onSelect}
          className={cn(
            'flex items-center gap-1.5 px-2 py-1 rounded-control shadow-md backdrop-blur text-[11px] font-sans border transition-all cursor-pointer whitespace-nowrap',
            isSelected
              ? 'bg-surface-elevated/95 border-energy-cyan ring-2 ring-energy-cyan/40 scale-105'
              : 'bg-surface/90 border-border hover:border-text-secondary'
          )}
        >
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: statusHex }}
          />
          <span className="font-semibold text-text-primary">{sectorName}</span>
          <span className="font-mono text-text-muted text-[10px]">
            {coveragePct}%
          </span>
        </button>
      </Html>
    </group>
  );
}

function MarketMesh({
  model,
  isSelected,
  onSelect,
  sectorName,
}: BuildingMeshProps) {
  const [hovered, setHovered] = useState(false);
  const { position, statusColor, coveragePct } = model;

  const statusHex =
    statusColor === 'battery-green'
      ? '#22c55e'
      : statusColor === 'warning-amber'
      ? '#f59e0b'
      : '#ef4444';

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
      {/* Plinth */}
      <mesh position={[0, 0.1, 0]}>
        <boxGeometry args={[4.4, 0.15, 3.4]} />
        <meshStandardMaterial color="#334155" roughness={0.9} />
      </mesh>

      {/* 6 Wooden Pavilion Canopy Pillars */}
      {[-1.6, 0, 1.6].map((x) =>
        [-1.2, 1.2].map((z) => (
          <mesh key={`${x}-${z}`} position={[x, 1.0, z]}>
            <cylinderGeometry args={[0.06, 0.06, 1.9, 6]} />
            <meshStandardMaterial color="#78350f" roughness={0.9} />
          </mesh>
        ))
      )}

      {/* Striped Market Canopy Awnings (Canopy roof) */}
      <mesh position={[0, 2.05, 0]}>
        <boxGeometry args={[4.2, 0.1, 3.2]} />
        <meshStandardMaterial color="#e11d48" roughness={0.8} />
      </mesh>

      {/* Internal Wooden Market Stalls */}
      <mesh position={[-0.8, 0.45, 0]}>
        <boxGeometry args={[1.2, 0.6, 1.8]} />
        <meshStandardMaterial color="#92400e" roughness={0.8} />
      </mesh>
      <mesh position={[0.8, 0.45, 0]}>
        <boxGeometry args={[1.2, 0.6, 1.8]} />
        <meshStandardMaterial color="#92400e" roughness={0.8} />
      </mesh>

      {/* Selection ring */}
      {(isSelected || hovered) && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
          <ringGeometry args={[2.6, 2.8, 32]} />
          <meshBasicMaterial color={isSelected ? '#50d8e8' : '#94a3b8'} transparent opacity={0.8} />
        </mesh>
      )}

      {/* Status LED Pin */}
      <mesh position={[0, 2.7, 0]}>
        <sphereGeometry args={[0.16, 12, 12]} />
        <meshBasicMaterial color={statusHex} />
      </mesh>

      {/* 2D HTML Label Badge */}
      <Html
        position={[0, 3.3, 0]}
        center
        distanceFactor={18}
        className="pointer-events-auto select-none"
      >
        <button
          type="button"
          onClick={onSelect}
          className={cn(
            'flex items-center gap-1.5 px-2 py-1 rounded-control shadow-md backdrop-blur text-[11px] font-sans border transition-all cursor-pointer whitespace-nowrap',
            isSelected
              ? 'bg-surface-elevated/95 border-energy-cyan ring-2 ring-energy-cyan/40 scale-105'
              : 'bg-surface/90 border-border hover:border-text-secondary'
          )}
        >
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: statusHex }}
          />
          <span className="font-semibold text-text-primary">{sectorName}</span>
          <span className="font-mono text-text-muted text-[10px]">
            {coveragePct}%
          </span>
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
}: VillageBuildingsProps) {
  return (
    <group name="village-buildings">
      <HealthClinicMesh
        model={buildings.health}
        isSelected={selectedSector === 'health'}
        onSelect={() => onSelectSector(selectedSector === 'health' ? null : 'health')}
        sectorName={sectorNames.health}
        priorityLabel={priorityLabels.critical}
      />
      <WaterPumpMesh
        model={buildings.water}
        isSelected={selectedSector === 'water'}
        onSelect={() => onSelectSector(selectedSector === 'water' ? null : 'water')}
        sectorName={sectorNames.water}
        priorityLabel={priorityLabels.critical}
      />
      <PrimarySchoolMesh
        model={buildings.school}
        isSelected={selectedSector === 'school'}
        onSelect={() => onSelectSector(selectedSector === 'school' ? null : 'school')}
        sectorName={sectorNames.school}
      />
      <VillageHousesMesh
        model={buildings.households}
        isSelected={selectedSector === 'households'}
        onSelect={() =>
          onSelectSector(selectedSector === 'households' ? null : 'households')
        }
        sectorName={sectorNames.households}
      />
      <MarketMesh
        model={buildings.market}
        isSelected={selectedSector === 'market'}
        onSelect={() => onSelectSector(selectedSector === 'market' ? null : 'market')}
        sectorName={sectorNames.market}
      />
    </group>
  );
}
