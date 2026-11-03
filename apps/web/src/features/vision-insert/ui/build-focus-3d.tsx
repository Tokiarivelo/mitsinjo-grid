'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { cameraLerpFactor, cameraTweenExpired } from '@/features/microgrid-3d/utils/camera-tween';
import { focusOrbitAngle } from '@/features/microgrid-3d/utils/camera-focus';
import { TOKEN_HEX } from '@/features/microgrid-3d/utils/scene-palette';
import type { ObjectRecipe, RecipePart } from '@/lib/object-shape';
import type { ShapeImprove } from '../hooks/use-object-shape';
import {
  changedParts,
  focusDistance,
  partOutlines,
  partsOfKinds,
  partsSphere,
  type FocusSphere,
  type Vec3,
} from '../utils/build-focus';

/** A kept patch stays outlined (and framed) this long. */
export const CHANGE_FLASH_MS = 3_000;

const UP = new THREE.Vector3(0, 1, 0);
const ORIGIN: Vec3 = [0, 0, 0];

export interface BuildFocusProps {
  recipe: ObjectRecipe | null;
  improve?: Pick<ShapeImprove, 'status' | 'stage' | 'index' | 'kinds'>;
  /** Display scale of the model (the outlines and framing follow it). */
  scale: number;
  /** Camera distance of the default ¾ view (where the camera returns once the build ends). */
  homeDistance: number;
  reducedMotion: boolean;
}

/** Outline boxes around parts, pulsing while `pulse`. */
function PartOutlines({
  recipe,
  parts,
  color,
  pulse,
}: {
  recipe: ObjectRecipe;
  parts: ReadonlyArray<RecipePart>;
  color: string;
  pulse: boolean;
}) {
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(partOutlines(recipe, parts), 3));
    return g;
  }, [recipe, parts]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const material = useRef<THREE.LineBasicMaterial>(null);
  useFrame(({ clock }) => {
    if (material.current)
      material.current.opacity = pulse ? 0.55 + 0.4 * Math.sin(clock.elapsedTime * 4) : 0.9;
  });
  return (
    <lineSegments geometry={geometry} renderOrder={10}>
      <lineBasicMaterial ref={material} color={color} transparent depthTest={false} opacity={0.9} />
    </lineSegments>
  );
}

/**
 * Staged build in the viewer (PG-T18): while the stages run, the camera slowly orbits (like the
 * village focus) and eases toward the parts the current stage works on, outlined in violet. When a
 * stage keeps a patch, the changed parts flash green and the camera frames them. Once the build ends
 * the camera returns to the whole object. A drag hands the camera back to the operator until the
 * next stage. Reduced motion: jumps, no orbit, no pulse.
 */
export function BuildFocus({
  recipe,
  improve,
  scale,
  homeDistance,
  reducedMotion,
}: BuildFocusProps) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const controls = useThree((s) => s.controls) as
    | (THREE.EventDispatcher<{ start: object }> & { target: THREE.Vector3; update: () => void })
    | null;
  const invalidate = useThree((s) => s.invalidate);
  const running = improve?.status === 'running';
  const building = improve !== undefined;
  const kinds = improve?.kinds;
  const stageKey = `${improve?.index}:${improve?.stage}`;

  // Parts a kept patch changed, shown for `CHANGE_FLASH_MS`.
  const prevRecipe = useRef<ObjectRecipe | null>(recipe);
  const [flash, setFlash] = useState<{ recipe: ObjectRecipe; parts: RecipePart[] } | null>(null);
  useEffect(() => {
    const prev = prevRecipe.current;
    prevRecipe.current = recipe;
    if (!prev || !recipe || prev === recipe || !building) return;
    const parts = changedParts(prev, recipe);
    if (!parts.length) return;
    setFlash({ recipe, parts });
    const id = setTimeout(() => setFlash(null), CHANGE_FLASH_MS);
    return () => clearTimeout(id);
  }, [recipe, building]);

  const stageParts = useMemo(
    () => (running && recipe && kinds ? partsOfKinds(recipe, kinds) : []),
    [running, recipe, kinds]
  );

  // What to frame: a fresh change, else the running stage's parts, else the whole object.
  const focus: { key: string; sphere: FocusSphere | null } = useMemo(() => {
    if (flash)
      return { key: `flash:${flash.parts.length}`, sphere: partsSphere(flash.recipe, flash.parts) };
    if (running && recipe) {
      return {
        key: `stage:${stageKey}`,
        sphere: partsSphere(recipe, stageParts),
      };
    }
    return { key: 'home', sphere: null };
  }, [flash, running, recipe, stageKey, stageParts]);

  const goalTarget = useRef(new THREE.Vector3());
  const goalDistance = useRef(homeDistance);
  const tweening = useRef(false);
  const tweenStart = useRef(0);
  /** The operator dragged: no automatic move until the next focus. */
  const paused = useRef(false);
  const offset = useRef(new THREE.Vector3());
  const firstFocus = useRef(true);

  useEffect(() => {
    const s = focus.sphere;
    const center = s ? s.center : ORIGIN;
    goalTarget.current.set(center[0] * scale, center[1] * scale, center[2] * scale);
    goalDistance.current = s ? focusDistance(s.radius * scale, camera.fov) : homeDistance;
    paused.current = false;
    // Mounting on the home view: nothing to move.
    const skip = firstFocus.current && focus.key === 'home';
    firstFocus.current = false;
    if (skip) return;
    tweening.current = true;
    tweenStart.current = performance.now();
    invalidate();
  }, [focus, scale, homeDistance, camera, invalidate]);

  useEffect(() => {
    if (!controls) return;
    const stop = () => {
      paused.current = true;
      tweening.current = false;
    };
    controls.addEventListener('start', stop);
    return () => controls.removeEventListener('start', stop);
  }, [controls]);

  const orbiting = (running || flash !== null) && !reducedMotion;

  useFrame((state, delta) => {
    if (!controls || paused.current) return;
    if (!tweening.current && !orbiting) return;
    const look = controls.target;
    offset.current.copy(camera.position).sub(look);
    let distance = offset.current.length();
    offset.current.normalize();
    if (tweening.current) {
      const f = reducedMotion ? 1 : cameraLerpFactor(delta);
      look.lerp(goalTarget.current, f);
      distance += (goalDistance.current - distance) * f;
      const arrived =
        look.distanceTo(goalTarget.current) < 0.005 &&
        Math.abs(goalDistance.current - distance) < 0.005;
      if (arrived || reducedMotion || cameraTweenExpired(tweenStart.current, performance.now())) {
        look.copy(goalTarget.current);
        distance = goalDistance.current;
        tweening.current = false;
      }
    }
    if (orbiting) offset.current.applyAxisAngle(UP, focusOrbitAngle(delta));
    camera.position.copy(look).addScaledVector(offset.current, distance);
    controls.update();
    // frameloop="demand": keep frames coming while the camera moves.
    if (tweening.current || orbiting) state.invalidate();
  });

  if (!recipe) return null;
  return (
    <group scale={scale}>
      {flash ? (
        <PartOutlines
          recipe={flash.recipe}
          parts={flash.parts}
          color={TOKEN_HEX.batteryGreen}
          pulse={!reducedMotion}
        />
      ) : stageParts.length ? (
        <PartOutlines
          recipe={recipe}
          parts={stageParts}
          color={TOKEN_HEX.aiViolet}
          pulse={!reducedMotion}
        />
      ) : null}
    </group>
  );
}
