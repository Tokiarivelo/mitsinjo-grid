'use client';

import { useMemo } from 'react';
import * as THREE from 'three';
import { createHipRoofGeometry } from '../utils/hip-roof';
import { mergeParts, type Part } from '../utils/merge-parts';
import { corrugatedTexture } from './procedural-textures';

/** Window glass when the building is unlit. */
const DARK_GLASS = '#1c2129';
/** Warm interior light (sRGB). Multiplied above 1 so bloom catches it. */
const WARM_LIGHT = '#ffb25e';

const TRIM_MAT = new THREE.MeshStandardMaterial({ color: '#6e5a48', roughness: 0.9 });
const VERANDA_MAT = new THREE.MeshStandardMaterial({ color: '#d9cfbf', roughness: 0.85 });

/** Shared window color for a 0..1 glow (0 = dark glass). */
export function windowColor(glow: number): THREE.Color {
  const c = new THREE.Color(DARK_GLASS);
  if (glow <= 0) return c;
  return c
    .lerp(new THREE.Color(WARM_LIGHT), Math.min(1, glow * 1.5))
    .multiplyScalar(1 + glow * 2.4);
}

export interface VillageHouseProps {
  width: number;
  depth: number;
  wallHeight: number;
  roofHeight: number;
  wallColor: string;
  roofColor: string;
  /** Eave overhang beyond the walls. */
  overhang?: number;
  /** Interior light, 0..1 (data-driven by the parent: served / partial / unserved). */
  windowGlow?: number;
  windowsPerSide?: number;
  /** Covered front veranda with posts. */
  veranda?: boolean;
  position?: [number, number, number];
  rotationY?: number;
  /** Corrugated metal (default) or smooth tiles. */
  roofFinish?: 'corrugated' | 'tile';
}

export function VillageHouse({
  width,
  depth,
  wallHeight,
  roofHeight,
  wallColor,
  roofColor,
  overhang = 0.32,
  windowGlow = 0,
  windowsPerSide = 2,
  veranda = false,
  position = [0, 0, 0],
  rotationY = 0,
  roofFinish = 'corrugated',
}: VillageHouseProps) {
  const roofW = width + overhang * 2;
  const roofD = depth + overhang * 2 + (veranda ? 0.9 : 0);
  const roofGeom = useMemo(
    () => createHipRoofGeometry(roofW, roofD, roofHeight),
    [roofW, roofD, roofHeight]
  );

  const roofMat = useMemo(() => {
    const tex = roofFinish === 'corrugated' ? corrugatedTexture().clone() : null;
    if (tex) {
      tex.needsUpdate = true;
      tex.repeat.set(0.9, 1);
    }
    return new THREE.MeshStandardMaterial({
      color: roofColor,
      map: tex,
      bumpMap: tex,
      bumpScale: 0.6,
      roughness: roofFinish === 'corrugated' ? 0.55 : 0.8,
      metalness: roofFinish === 'corrugated' ? 0.35 : 0.05,
    });
  }, [roofColor, roofFinish]);

  const wallMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: wallColor, roughness: 0.88 }),
    [wallColor]
  );
  const glassColor = useMemo(() => windowColor(windowGlow), [windowGlow]);

  const winW = Math.min(0.42, (width * 0.6) / windowsPerSide);
  const winH = wallHeight * 0.38;
  const winY = wallHeight * 0.58 + 0.12;
  const roofZ = veranda ? 0.45 : 0;

  // All panes of the house in one geometry (1 draw call).
  const windowsGeom = useMemo(() => {
    const n = Math.max(1, windowsPerSide);
    const usable = width * 0.72;
    const xs = Array.from({ length: n }, (_, i) =>
      n === 1 ? 0 : -usable / 2 + (usable / (n - 1)) * i
    );
    const parts: Part[] = [];
    for (const side of [1, -1]) {
      for (const x of xs) {
        parts.push({
          shape: { kind: 'plane', size: [winW, winH] },
          position: [x, winY, side * (depth / 2 + 0.012)],
          rotation: [0, side === 1 ? 0 : Math.PI, 0],
        });
      }
      parts.push({
        shape: { kind: 'plane', size: [winW, winH] },
        position: [side * (width / 2 + 0.012), winY, 0],
        rotation: [0, (side * Math.PI) / 2, 0],
      });
    }
    return mergeParts(parts);
  }, [width, depth, windowsPerSide, winW, winH, winY]);

  const trimGeom = useMemo(
    () =>
      mergeParts([
        {
          shape: { kind: 'box', size: [width + 0.16, 0.12, depth + 0.16] },
          position: [0, 0.06, 0],
        },
        {
          shape: { kind: 'plane', size: [0.34, wallHeight * 0.62] },
          position: [
            windowsPerSide > 1 ? 0 : width * 0.28,
            0.12 + wallHeight * 0.33,
            depth / 2 + 0.014,
          ],
        },
      ]),
    [width, depth, wallHeight, windowsPerSide]
  );

  // Veranda deck + posts in one geometry.
  const verandaGeom = useMemo(() => {
    if (!veranda) return null;
    const n = Math.max(2, Math.round(width / 1.3)) + 1;
    const parts: Part[] = [
      {
        shape: { kind: 'box', size: [width + 0.1, 0.08, 0.95] },
        position: [0, 0.1, depth / 2 + 0.5],
      },
    ];
    for (let i = 0; i < n; i++) {
      const x = -width / 2 + 0.08 + ((width - 0.16) / (n - 1)) * i;
      parts.push({
        shape: { kind: 'box', size: [0.08, wallHeight, 0.08] },
        position: [x, wallHeight / 2 + 0.1, depth / 2 + 0.88],
      });
    }
    return mergeParts(parts);
  }, [veranda, width, depth, wallHeight]);

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {/* Plinth + door: one geometry, one dark-earth material */}
      <mesh geometry={trimGeom} material={TRIM_MAT} receiveShadow castShadow />
      {/* Walls */}
      <mesh position={[0, wallHeight / 2 + 0.12, 0]} material={wallMat} castShadow receiveShadow>
        <boxGeometry args={[width, wallHeight, depth]} />
      </mesh>
      {/* Roof */}
      <mesh
        geometry={roofGeom}
        material={roofMat}
        position={[0, wallHeight + 0.1, roofZ]}
        castShadow
        receiveShadow
      />
      {/* Windows (data-driven glow) */}
      <mesh geometry={windowsGeom}>
        <meshBasicMaterial color={glassColor} toneMapped={false} />
      </mesh>
      {verandaGeom && (
        <mesh geometry={verandaGeom} material={VERANDA_MAT} castShadow receiveShadow />
      )}
    </group>
  );
}
