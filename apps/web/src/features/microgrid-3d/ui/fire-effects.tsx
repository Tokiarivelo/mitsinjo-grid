'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { BuildingSceneModel } from '../types';
import type { SceneQuality } from '../hooks/use-scene-quality';
import { useAmbientFrame } from '../hooks/use-ambient-frame';
import { TOKEN_HEX } from '../utils/scene-palette';
import { mulberry32 } from '../utils/noise';

/** Roof height the flames sit on (buildings are 2–4 m tall). */
const FIRE_BASE_Y = 2.4;
/** Smoke rises this high before it starts again from the roof. */
const SMOKE_RISE = 7;
const SMOKE_COUNT = { low: 6, high: 12 } as const;
/** Glow colors (> 1, not tone mapped) from the solar-amber / critical-red tokens. */
const FLAME_CORE = new THREE.Color(TOKEN_HEX.solarAmber).multiplyScalar(2.2);
const FLAME_OUTER = new THREE.Color(TOKEN_HEX.criticalRed).multiplyScalar(1.8);
const SMOKE_COLOR = new THREE.Color(TOKEN_HEX.idle);

const FLAMES: { x: number; z: number; h: number; r: number; outer: boolean }[] = [
  { x: 0, z: 0, h: 1.6, r: 0.45, outer: true },
  { x: 0.35, z: 0.2, h: 1.1, r: 0.3, outer: true },
  { x: -0.3, z: -0.15, h: 1.2, r: 0.32, outer: true },
  { x: 0.05, z: 0.05, h: 1.0, r: 0.22, outer: false },
];

export interface FireEffectsProps {
  buildings: Record<string, BuildingSceneModel>;
  quality: SceneQuality;
  /** False with reduced motion (or software GL): flames and smoke stay still. */
  animate: boolean;
}

/** Fire on every burning sector (F1): flames on the roof, rising smoke, a red glow (high tier). */
export function FireEffects({ buildings, quality, animate }: FireEffectsProps) {
  const burning = Object.values(buildings).filter((b) => b.onFire);
  if (burning.length === 0) return null;
  return (
    <>
      {burning.map((b) => (
        <BuildingFire
          key={b.id}
          position={b.position}
          quality={quality}
          animate={animate}
          seed={b.id.length * 97 + b.position[0]}
        />
      ))}
    </>
  );
}

function BuildingFire({
  position,
  quality,
  animate,
  seed,
}: {
  position: [number, number, number];
  quality: SceneQuality;
  animate: boolean;
  seed: number;
}) {
  const count = SMOKE_COUNT[quality];
  const smokeRef = useRef<THREE.InstancedMesh>(null);
  const flamesRef = useRef<THREE.Group>(null);
  const lightRef = useRef<THREE.PointLight>(null);
  const requestFrame = useAmbientFrame();

  // Fixed per-puff offsets (seeded) + one reusable matrix helper: nothing allocated per frame.
  const puffs = useMemo(() => {
    const rand = mulberry32(Math.floor(seed * 1000) || 1);
    return Array.from({ length: count }, (_, i) => ({
      phase: i / count,
      dx: (rand() - 0.5) * 0.8,
      dz: (rand() - 0.5) * 0.8,
      speed: 0.18 + rand() * 0.1,
    }));
  }, [count, seed]);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const placeSmoke = (time: number) => {
    const mesh = smokeRef.current;
    if (!mesh) return;
    for (let i = 0; i < puffs.length; i++) {
      const p = puffs[i]!;
      const k = (p.phase + time * p.speed) % 1;
      const s = 0.35 + k * 1.1;
      dummy.position.set(
        p.dx * (1 + k),
        FIRE_BASE_Y + 0.8 + k * SMOKE_RISE,
        p.dz * (1 + k) - k * 0.8
      );
      dummy.scale.set(s, s, s);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  };

  useFrame((state) => {
    const t = animate ? state.clock.elapsedTime : 0.4;
    placeSmoke(t);
    if (flamesRef.current) {
      const flicker = animate ? 0.85 + Math.sin(t * 11 + seed) * 0.1 + Math.sin(t * 17) * 0.06 : 1;
      flamesRef.current.scale.set(1, flicker, 1);
    }
    if (lightRef.current) lightRef.current.intensity = animate ? 6 + Math.sin(t * 9) * 1.5 : 6;
    if (animate) requestFrame();
  });

  return (
    <group position={position} name="fire">
      <group ref={flamesRef} position={[0, FIRE_BASE_Y, 0]}>
        {FLAMES.map((f, i) => (
          <mesh key={i} position={[f.x, f.h / 2, f.z]}>
            <coneGeometry args={[f.r, f.h, 8]} />
            <meshBasicMaterial
              color={f.outer ? FLAME_OUTER : FLAME_CORE}
              toneMapped={false}
              transparent
              opacity={f.outer ? 0.85 : 1}
              depthWrite={false}
            />
          </mesh>
        ))}
      </group>
      <instancedMesh ref={smokeRef} args={[undefined, undefined, count]} frustumCulled={false}>
        <sphereGeometry args={[0.5, 8, 6]} />
        <meshBasicMaterial color={SMOKE_COLOR} transparent opacity={0.45} depthWrite={false} />
      </instancedMesh>
      {quality === 'high' && (
        <pointLight
          ref={lightRef}
          position={[0, FIRE_BASE_Y + 1, 0]}
          color={FLAME_OUTER}
          intensity={6}
          distance={9}
          decay={2}
        />
      )}
    </group>
  );
}
