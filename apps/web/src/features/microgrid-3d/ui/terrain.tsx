'use client';

import { useMemo } from 'react';

export function VillageTerrain() {
  // Ground plane & decorative low-poly elements (rocks, trees, paths)
  const trees = useMemo(() => {
    return [
      { pos: [-14, 0, -3], scale: 1.2 },
      { pos: [-12, 0, 6], scale: 0.9 },
      { pos: [-3, 0, 12], scale: 1.1 },
      { pos: [11, 0, -8], scale: 1.3 },
      { pos: [13, 0, 5], scale: 1.0 },
      { pos: [8, 0, 11], scale: 0.8 },
      { pos: [-2, 0, -13], scale: 1.0 },
    ] as const;
  }, []);

  return (
    <group name="terrain">
      {/* Main Ground Disc */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} receiveShadow>
        <circleGeometry args={[26, 48]} />
        <meshStandardMaterial color="#151d2a" roughness={0.9} metalness={0.1} />
      </mesh>

      {/* Sub-disc rim / landscape plateau */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.15, 0]}>
        <circleGeometry args={[27.5, 48]} />
        <meshStandardMaterial color="#0d1420" roughness={1} metalness={0} />
      </mesh>

      {/* Village Path Network (Dirt / gravel trails connecting sectors) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.04, 0]}>
        <ringGeometry args={[0.5, 14, 32]} />
        <meshBasicMaterial color="#1a2332" transparent opacity={0.35} />
      </mesh>

      {/* Pathway strips */}
      <mesh rotation={[-Math.PI / 2, 0, 0.4]} position={[0, -0.035, 0]}>
        <planeGeometry args={[1.2, 22]} />
        <meshStandardMaterial color="#1c2638" roughness={0.9} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, -0.8]} position={[0, -0.035, 0]}>
        <planeGeometry args={[1.2, 20]} />
        <meshStandardMaterial color="#1c2638" roughness={0.9} />
      </mesh>

      {/* Stylized Madagascar Trees (Baobab/Acacia silhouettes) */}
      {trees.map((t, idx) => (
        <group key={idx} position={t.pos} scale={t.scale}>
          {/* Trunk */}
          <mesh position={[0, 1, 0]}>
            <cylinderGeometry args={[0.2, 0.4, 2, 6]} />
            <meshStandardMaterial color="#5c4033" roughness={0.9} />
          </mesh>
          {/* Canopy crown */}
          <mesh position={[0, 2.2, 0]}>
            <dodecahedronGeometry args={[0.9, 0]} />
            <meshStandardMaterial color="#2d4a22" roughness={0.8} />
          </mesh>
        </group>
      ))}

      {/* Central Distribution Substation Pad */}
      <mesh position={[0, 0.05, 1]}>
        <boxGeometry args={[2.5, 0.1, 2.5]} />
        <meshStandardMaterial color="#223044" roughness={0.7} metalness={0.3} />
      </mesh>
      {/* Central Grid Hub Pole */}
      <mesh position={[0, 1.8, 1]}>
        <cylinderGeometry args={[0.08, 0.1, 3.6, 8]} />
        <meshStandardMaterial color="#64748b" metalness={0.6} roughness={0.4} />
      </mesh>
      {/* Central Transformer Box */}
      <mesh position={[0, 0.4, 1]}>
        <boxGeometry args={[0.8, 0.7, 0.8]} />
        <meshStandardMaterial color="#475569" metalness={0.5} roughness={0.5} />
      </mesh>
      {/* Central Grid Hub Beacon LED */}
      <mesh position={[0, 3.65, 1]}>
        <sphereGeometry args={[0.15, 12, 12]} />
        <meshBasicMaterial color="#50d8e8" />
      </mesh>
    </group>
  );
}
