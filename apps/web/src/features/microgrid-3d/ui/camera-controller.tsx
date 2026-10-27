'use client';

import { type ComponentRef, useEffect, useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type { CameraPreset } from '../types';

export const CAMERA_PRESETS: Record<
  CameraPreset,
  { position: [number, number, number]; target: [number, number, number] }
> = {
  village: {
    position: [24, 20, 24],
    target: [0, 0, 0],
  },
  solar: {
    position: [-2, 10, 0],
    target: [-10, 1, -8],
  },
  battery: {
    position: [6, 7, 5],
    target: [0, 1, -2],
  },
  essential: {
    position: [18, 14, 12],
    target: [5, 1, 0],
  },
};

export interface CameraControllerProps {
  preset: CameraPreset;
  /** Changing this re-applies `preset` even when it is unchanged. */
  resetKey?: number;
  reducedMotion?: boolean;
}

export function CameraController({
  preset,
  resetKey = 0,
  reducedMotion = false,
}: CameraControllerProps) {
  const camera = useThree((s) => s.camera);
  const invalidate = useThree((s) => s.invalidate);
  const controlsRef = useRef<ComponentRef<typeof OrbitControls>>(null);

  const targetPos = useRef(new THREE.Vector3(...CAMERA_PRESETS.village.position));
  const targetLook = useRef(new THREE.Vector3(...CAMERA_PRESETS.village.target));
  const isTransitioning = useRef(false);

  useEffect(() => {
    const config = CAMERA_PRESETS[preset] ?? CAMERA_PRESETS.village;
    targetPos.current.set(...config.position);
    targetLook.current.set(...config.target);

    if (reducedMotion) {
      camera.position.copy(targetPos.current);
      if (controlsRef.current) {
        controlsRef.current.target.copy(targetLook.current);
        controlsRef.current.update();
      }
      isTransitioning.current = false;
    } else {
      isTransitioning.current = true;
    }
    // frameloop="demand": render the jump, or start the tween loop.
    invalidate();
  }, [preset, resetKey, camera, reducedMotion, invalidate]);

  useFrame((state, delta) => {
    if (!isTransitioning.current || reducedMotion) return;
    state.invalidate();

    // Smooth lerp towards target (delta capped for the first demand frame)
    const lerpFactor = Math.min(1, Math.min(delta, 0.1) * 3.5);
    camera.position.lerp(targetPos.current, lerpFactor);

    if (controlsRef.current) {
      controlsRef.current.target.lerp(targetLook.current, lerpFactor);
      controlsRef.current.update();
    }

    if (
      camera.position.distanceTo(targetPos.current) < 0.1 &&
      (!controlsRef.current || controlsRef.current.target.distanceTo(targetLook.current) < 0.1)
    ) {
      isTransitioning.current = false;
    }
  });

  return (
    <OrbitControls
      ref={controlsRef}
      enableDamping
      dampingFactor={0.05}
      maxPolarAngle={Math.PI / 2.15}
      minDistance={6}
      maxDistance={48}
      onStart={() => {
        isTransitioning.current = false;
      }}
    />
  );
}
