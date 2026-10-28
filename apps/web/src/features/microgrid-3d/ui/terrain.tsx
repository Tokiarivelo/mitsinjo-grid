'use client';

import { useMemo } from 'react';
import * as THREE from 'three';
import {
  LAKE_CENTER,
  LAKE_LEVEL,
  LAKE_RADIUS,
  POND_CENTER,
  POND_RADIUS,
  TERRAIN_RADIUS,
  terrainHeight,
} from '../utils/landscape';
import { terrainColor } from '../utils/terrain-colors';
import { mergeParts, type Part } from '../utils/merge-parts';
import { BUS_POSITION } from '../utils/to-scene-model';
import { TOKEN_HEX } from '../utils/scene-palette';
import type { SceneQuality } from '../hooks/use-scene-quality';

const GROUND_MAT = new THREE.MeshStandardMaterial({
  vertexColors: true,
  roughness: 0.96,
  metalness: 0,
});

const WATER_MAT = new THREE.MeshStandardMaterial({
  color: '#1f4f63',
  roughness: 0.06,
  metalness: 0.35,
  envMapIntensity: 1.6,
});

const SHORE_MAT = new THREE.MeshStandardMaterial({ color: '#7d6a4b', roughness: 0.95 });
const CONCRETE_MAT = new THREE.MeshStandardMaterial({ color: '#8b8f94', roughness: 0.85 });
const STEEL_MAT = new THREE.MeshStandardMaterial({
  color: '#a3acb8',
  metalness: 0.75,
  roughness: 0.35,
});
const TRANSFORMER_MAT = new THREE.MeshStandardMaterial({
  color: '#5d6b78',
  metalness: 0.55,
  roughness: 0.45,
});

/** Hub insulators + mast, one geometry. */
const HUB_STEEL = mergeParts([
  ...[-0.3, 0, 0.3].map((x): Part => ({
    shape: { kind: 'cylinder', radiusTop: 0.05, radiusBottom: 0.07, height: 0.35 },
    position: [x, 1.2, 0],
  })),
  {
    shape: { kind: 'cylinder', radiusTop: 0.07, radiusBottom: 0.1, height: 3.2 },
    position: [0, 1.6, -0.9],
  },
]);

function buildGround(segments: number): THREE.BufferGeometry {
  const size = TERRAIN_RADIUS * 2;
  const g = new THREE.PlaneGeometry(size, size, segments, segments);
  g.rotateX(-Math.PI / 2);
  const pos = g.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    pos.setY(i, terrainHeight(x, z));
    terrainColor(x, z, c);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  g.computeVertexNormals();
  return g;
}

export interface VillageTerrainProps {
  quality?: SceneQuality;
}

export function VillageTerrain({ quality = 'high' }: VillageTerrainProps) {
  const segments = quality === 'high' ? 220 : 110;
  const ground = useMemo(() => buildGround(segments), [segments]);
  const beaconColor = useMemo(() => new THREE.Color(TOKEN_HEX.energyCyan).multiplyScalar(2.2), []);

  return (
    <group name="terrain">
      <mesh geometry={ground} material={GROUND_MAT} receiveShadow name="ground" />

      {/* Village pond beside the water station */}
      <group position={[POND_CENTER[0], 0, POND_CENTER[1]]}>
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0.02, 0]}
          material={SHORE_MAT}
          receiveShadow
        >
          <circleGeometry args={[POND_RADIUS + 0.45, 40]} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]} material={WATER_MAT}>
          <circleGeometry args={[POND_RADIUS, 40]} />
        </mesh>
      </group>

      {/* Distant lake catching the sunset */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[LAKE_CENTER[0], LAKE_LEVEL, LAKE_CENTER[1]]}
        material={WATER_MAT}
      >
        <circleGeometry args={[LAKE_RADIUS * 1.2, 64]} />
      </mesh>

      {/* Distribution hub: pad, transformer and mast */}
      <group position={[BUS_POSITION[0], 0, BUS_POSITION[2]]}>
        <mesh position={[0, 0.08, 0]} material={CONCRETE_MAT} receiveShadow castShadow>
          <boxGeometry args={[2.6, 0.16, 2.6]} />
        </mesh>
        <mesh position={[0, 0.6, 0]} material={TRANSFORMER_MAT} castShadow>
          <boxGeometry args={[1.0, 0.9, 0.9]} />
        </mesh>
        <mesh geometry={HUB_STEEL} material={STEEL_MAT} castShadow />
        <mesh position={[0, 3.25, -0.9]}>
          <sphereGeometry args={[0.13, 12, 12]} />
          <meshBasicMaterial color={beaconColor} toneMapped={false} />
        </mesh>
      </group>
    </group>
  );
}
