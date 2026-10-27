'use client';

import { useMemo } from 'react';
import { Instance, Instances } from '@react-three/drei';
import { SOLAR_POSITION } from '../utils/to-scene-model';
import { TOKEN_HEX } from '../utils/scene-palette';
import type { SolarSceneModel } from '../types';

const ROWS = 4;
const COLS = 3;
const TABLE_COUNT = ROWS * COLS;
const PANEL_HEIGHT = 0.6;
const TILT_RAD = -0.314; // ~18°
const PANEL_TILT: [number, number, number] = [TILT_RAD, 0, 0];
// Cell sits 0.03 above the backplate in the tilted frame → world offset.
const CELL_OFFSET_Y = 0.03 * Math.cos(TILT_RAD);
const CELL_OFFSET_Z = 0.03 * Math.sin(TILT_RAD);

export interface SolarArrayProps {
  model: SolarSceneModel;
}

export function SolarArray({ model }: SolarArrayProps) {
  const { glowIntensity, isGenerating } = model;

  const panelLayout = useMemo(() => {
    const items: [number, number, number][] = [];
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        items.push([col * 2.2 - 2.2, 0, row * 1.8 - 2.7]);
      }
    }
    return items;
  }, []);

  // Emissive color calculation based on glowIntensity
  const emissiveIntensity = Math.min(1.5, glowIntensity * 1.2);

  return (
    <group position={SOLAR_POSITION} name="solar-array">
      {/* Ground Foundation Slab */}
      <mesh position={[0, 0.05, 0]}>
        <boxGeometry args={[7.8, 0.1, 7.8]} />
        <meshStandardMaterial color="#1f2937" roughness={0.9} />
      </mesh>

      {/* Racks of solar panels: one instanced draw call per part (4 total, not 48) */}
      <Instances limit={TABLE_COUNT} name="solar-legs-short">
        <cylinderGeometry args={[0.03, 0.03, 0.7, 6]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.8} roughness={0.3} />
        {panelLayout.map(([x, y, z], idx) => (
          <Instance key={idx} position={[x, y + 0.35, z - 0.3]} />
        ))}
      </Instances>
      <Instances limit={TABLE_COUNT} name="solar-legs-long">
        <cylinderGeometry args={[0.03, 0.03, 1.1, 6]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.8} roughness={0.3} />
        {panelLayout.map(([x, y, z], idx) => (
          <Instance key={idx} position={[x, y + 0.55, z + 0.3]} />
        ))}
      </Instances>
      <Instances limit={TABLE_COUNT} name="solar-backplates">
        <boxGeometry args={[1.8, 0.05, 1.2]} />
        <meshStandardMaterial color="#334155" metalness={0.7} roughness={0.4} />
        {panelLayout.map(([x, y, z], idx) => (
          <Instance key={idx} position={[x, y + PANEL_HEIGHT, z]} rotation={PANEL_TILT} />
        ))}
      </Instances>
      <Instances limit={TABLE_COUNT} name="solar-cells">
        <boxGeometry args={[1.72, 0.02, 1.12]} />
        <meshStandardMaterial
          color="#0f2b5c"
          roughness={0.2}
          metalness={0.8}
          emissive={TOKEN_HEX.energyCyan}
          emissiveIntensity={emissiveIntensity}
        />
        {panelLayout.map(([x, y, z], idx) => (
          <Instance
            key={idx}
            position={[x, y + PANEL_HEIGHT + CELL_OFFSET_Y, z + CELL_OFFSET_Z]}
            rotation={PANEL_TILT}
          />
        ))}
      </Instances>

      {/* Solar Inverter / Combiner Box */}
      <group position={[3.6, 0, 2.5]}>
        <mesh position={[0, 0.6, 0]}>
          <boxGeometry args={[0.6, 1.2, 0.5]} />
          <meshStandardMaterial color="#475569" roughness={0.5} metalness={0.5} />
        </mesh>
        {/* Status LED on inverter */}
        <mesh position={[0, 0.9, 0.26]}>
          <sphereGeometry args={[0.05, 8, 8]} />
          <meshBasicMaterial color={isGenerating ? TOKEN_HEX.batteryGreen : TOKEN_HEX.idle} />
        </mesh>
      </group>

      {/* Light glow halo when sun is shining */}
      {glowIntensity > 0.1 && (
        <pointLight
          position={[0, 2.5, 0]}
          color={TOKEN_HEX.energyCyan}
          intensity={glowIntensity * 1.5}
          distance={8}
        />
      )}
    </group>
  );
}
