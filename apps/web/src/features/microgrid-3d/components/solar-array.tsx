'use client';

import { useMemo } from 'react';
import { SOLAR_POSITION } from '../utils/to-scene-model';
import type { SolarSceneModel } from '../types';

export interface SolarArrayProps {
  model: SolarSceneModel;
}

export function SolarArray({ model }: SolarArrayProps) {
  const { glowIntensity, currentKw } = model;

  // 4 rows of 3 dual-panel tables (12 tables total = 24 panels)
  const panelLayout = useMemo(() => {
    const items: [number, number, number][] = [];
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 3; col++) {
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

      {/* Racks of Solar Panels */}
      {panelLayout.map((pos, idx) => (
        <group key={idx} position={pos}>
          {/* Steel leg supports */}
          <mesh position={[0, 0.35, -0.3]}>
            <cylinderGeometry args={[0.03, 0.03, 0.7, 6]} />
            <meshStandardMaterial color="#94a3b8" metalness={0.8} roughness={0.3} />
          </mesh>
          <mesh position={[0, 0.55, 0.3]}>
            <cylinderGeometry args={[0.03, 0.03, 1.1, 6]} />
            <meshStandardMaterial color="#94a3b8" metalness={0.8} roughness={0.3} />
          </mesh>

          {/* Tilted Panel Frame (18 deg tilt) */}
          <group position={[0, 0.6, 0]} rotation={[-0.314, 0, 0]}>
            {/* Panel backplate */}
            <mesh>
              <boxGeometry args={[1.8, 0.05, 1.2]} />
              <meshStandardMaterial color="#334155" metalness={0.7} roughness={0.4} />
            </mesh>
            {/* Photovoltaic Active Cell Surface with emission glow */}
            <mesh position={[0, 0.03, 0]}>
              <boxGeometry args={[1.72, 0.02, 1.12]} />
              <meshStandardMaterial
                color="#0f2b5c"
                roughness={0.2}
                metalness={0.8}
                emissive="#38bdf8"
                emissiveIntensity={emissiveIntensity}
              />
            </mesh>
          </group>
        </group>
      ))}

      {/* Solar Inverter / Combiner Box */}
      <group position={[3.6, 0, 2.5]}>
        <mesh position={[0, 0.6, 0]}>
          <boxGeometry args={[0.6, 1.2, 0.5]} />
          <meshStandardMaterial color="#475569" roughness={0.5} metalness={0.5} />
        </mesh>
        {/* Status LED on inverter */}
        <mesh position={[0, 0.9, 0.26]}>
          <sphereGeometry args={[0.05, 8, 8]} />
          <meshBasicMaterial color={currentKw > 0 ? '#22c55e' : '#64748b'} />
        </mesh>
      </group>

      {/* Light glow halo when sun is shining */}
      {glowIntensity > 0.1 && (
        <pointLight
          position={[0, 2.5, 0]}
          color="#38bdf8"
          intensity={glowIntensity * 1.5}
          distance={8}
        />
      )}
    </group>
  );
}
