'use client';

import { useCallback, type ComponentRef, useEffect, useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { SectorId } from '@mitsinjo/engine';
import { cameraLerpFactor, cameraTweenExpired } from '../utils/camera-tween';
import { focusCameraFor, focusOrbitAngle, type Vec3 } from '../utils/camera-focus';
import { SECTOR_POSITIONS } from '../utils/to-scene-model';
import * as THREE from 'three';
import type { CameraPreset } from '../types';

export const CAMERA_PRESETS: Record<CameraPreset, { position: Vec3; target: Vec3 }> = {
  // Front three-quarter view: village in front, hills, lake and sunset behind.
  village: {
    position: [2, 10.5, 28],
    target: [0, 2.5, -8],
  },
  solar: {
    position: [-4, 10, 4],
    target: [-10, 0.5, -8],
  },
  battery: {
    position: [6, 7, 5],
    target: [0, 1, -2],
  },
  controller: {
    position: [3.5, 4.2, 6.5],
    target: [0, 1.1, 1],
  },
  essential: {
    position: [14, 13, 16],
    target: [4, 1, -2],
  },
};

const UP = new THREE.Vector3(0, 1, 0);

export interface CameraControllerProps {
  preset: CameraPreset;
  /** Changing this re-applies `preset` even when it is unchanged. */
  resetKey?: number;
  /** Selected building: the camera flies to it; clearing it returns to `preset`. */
  focusSector?: SectorId | null;
  /** Slowly orbit the focused building once the camera arrives (off without a GPU). */
  autoRotate?: boolean;
  reducedMotion?: boolean;
  /**
   * Inertia after a drag. Off on the `low` tier: damping keeps requesting frames until
   * it decays, which at very low fps (weak GPU, software GL) means minutes of rendering.
   */
  damping?: boolean;
}

export function CameraController({
  preset,
  resetKey = 0,
  focusSector = null,
  autoRotate = true,
  reducedMotion = false,
  damping = true,
}: CameraControllerProps) {
  const camera = useThree((s) => s.camera);
  const invalidate = useThree((s) => s.invalidate);
  const controlsRef = useRef<ComponentRef<typeof OrbitControls>>(null);

  const targetPos = useRef(new THREE.Vector3(...CAMERA_PRESETS.village.position));
  const targetLook = useRef(new THREE.Vector3(...CAMERA_PRESETS.village.target));
  const isTransitioning = useRef(false);
  /** Orbit around `targetLook` (after the tween, until the user drags or deselects). */
  const isOrbiting = useRef(false);
  const orbitAfterTween = useRef(false);
  const tweenStart = useRef(0);
  const hasMounted = useRef(false);
  const presetRef = useRef(preset);
  const prevFocus = useRef<SectorId | null>(null);
  const orbitOffset = useRef(new THREE.Vector3());

  const startOrbit = useCallback(() => {
    isOrbiting.current = orbitAfterTween.current;
    orbitAfterTween.current = false;
  }, []);

  const snapToTarget = useCallback(() => {
    camera.position.copy(targetPos.current);
    if (controlsRef.current) {
      controlsRef.current.target.copy(targetLook.current);
      controlsRef.current.update();
    }
    isTransitioning.current = false;
    startOrbit();
  }, [camera, startOrbit]);

  const moveTo = useCallback(
    (config: { position: Vec3; target: Vec3 }, orbit: boolean) => {
      targetPos.current.set(...config.position);
      targetLook.current.set(...config.target);
      isOrbiting.current = false;
      orbitAfterTween.current = orbit && !reducedMotion;

      // First placement is instant (nothing to animate from); later moves tween.
      if (reducedMotion || !hasMounted.current) {
        snapToTarget();
      } else {
        isTransitioning.current = true;
        tweenStart.current = performance.now();
      }
      hasMounted.current = true;
      // frameloop="demand": render the jump, or start the tween loop.
      invalidate();
    },
    [reducedMotion, invalidate, snapToTarget]
  );

  useEffect(() => {
    presetRef.current = preset;
    moveTo(CAMERA_PRESETS[preset] ?? CAMERA_PRESETS.village, false);
  }, [preset, resetKey, moveTo]);

  useEffect(() => {
    const previous = prevFocus.current;
    prevFocus.current = focusSector;
    if (focusSector) {
      moveTo(focusCameraFor(SECTOR_POSITIONS[focusSector]), autoRotate);
    } else if (previous) {
      moveTo(CAMERA_PRESETS[presetRef.current] ?? CAMERA_PRESETS.village, false);
    }
  }, [focusSector, autoRotate, moveTo]);

  useFrame((state, delta) => {
    if (reducedMotion) return;

    if (isTransitioning.current) {
      state.invalidate();
      if (cameraTweenExpired(tweenStart.current, performance.now())) {
        snapToTarget();
        return;
      }
      const lerpFactor = cameraLerpFactor(delta);
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
        startOrbit();
      }
      return;
    }

    if (isOrbiting.current && controlsRef.current) {
      state.invalidate();
      // Rotate the camera around the look target on the vertical axis (no allocation).
      const look = controlsRef.current.target;
      orbitOffset.current
        .copy(camera.position)
        .sub(look)
        .applyAxisAngle(UP, focusOrbitAngle(delta));
      camera.position.copy(look).add(orbitOffset.current);
      controlsRef.current.update();
    }
  });

  return (
    <OrbitControls
      ref={controlsRef}
      enableDamping={damping}
      dampingFactor={0.05}
      maxPolarAngle={Math.PI / 2.15}
      minDistance={6}
      maxDistance={70}
      onStart={() => {
        // The user takes over: stop any tween or orbit.
        isTransitioning.current = false;
        isOrbiting.current = false;
        orbitAfterTween.current = false;
      }}
    />
  );
}
