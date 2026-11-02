'use client';

import { useMemo } from 'react';
import * as THREE from 'three';
import {
  LAKE_CENTER,
  LAKE_LEVEL,
  LAKE_RADIUS,
  PADDY_CENTER,
  PADDY_SIZE,
  POND_CENTER,
  POND_RADIUS,
  TERRAIN_RADIUS,
  terrainHeight,
} from '../utils/landscape';
import { terrainColor } from '../utils/terrain-colors';
import { paddyTexture, redEarthTexture } from './procedural-textures';
import type { SceneQuality } from '../hooks/use-scene-quality';

// Laterite grain multiplies the vertex colors (M12-T1): palette survives, soil gets pebbles.
const groundDetail = redEarthTexture().clone();
groundDetail.needsUpdate = true;
groundDetail.repeat.set(64, 64);

const GROUND_MAT = new THREE.MeshStandardMaterial({
  vertexColors: true,
  map: groundDetail,
  roughness: 0.96,
  metalness: 0,
});

const PADDY_MAT = new THREE.MeshStandardMaterial({
  map: paddyTexture(),
  roughness: 0.4,
  metalness: 0,
});

const WATER_MAT = new THREE.MeshStandardMaterial({
  color: '#1f4f63',
  roughness: 0.06,
  metalness: 0.35,
  envMapIntensity: 1.6,
});

const SHORE_MAT = new THREE.MeshStandardMaterial({ color: '#7d6a4b', roughness: 0.95 });

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

/** Rice paddy parcel: flat plane draped on the relief (+3.5 cm, no z-fighting). */
function buildPaddy(): THREE.BufferGeometry {
  const g = new THREE.PlaneGeometry(PADDY_SIZE[0], PADDY_SIZE[1], 7, 5);
  g.rotateX(-Math.PI / 2);
  const pos = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) + PADDY_CENTER[0];
    const z = pos.getZ(i) + PADDY_CENTER[1];
    pos.setY(i, terrainHeight(x, z) + 0.035);
  }
  g.computeVertexNormals();
  return g;
}

export function VillageTerrain({ quality = 'high' }: VillageTerrainProps) {
  const segments = quality === 'high' ? 220 : 110;
  const ground = useMemo(() => buildGround(segments), [segments]);
  const paddy = useMemo(() => buildPaddy(), []);

  return (
    <group name="terrain">
      <mesh geometry={ground} material={GROUND_MAT} receiveShadow name="ground" />

      {/* Rice paddy parcel west of the pond (M12-T1, +1 draw call) */}
      <mesh
        geometry={paddy}
        material={PADDY_MAT}
        receiveShadow
        name="paddy"
        position={[PADDY_CENTER[0], 0, PADDY_CENTER[1]]}
      />

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
    </group>
  );
}
