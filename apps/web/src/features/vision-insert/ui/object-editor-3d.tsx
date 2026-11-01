'use client';

import { Suspense, useEffect, useMemo } from 'react';
import { Canvas, useLoader } from '@react-three/fiber';
import { ContactShadows, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { TOKEN_HEX } from '@/features/microgrid-3d/utils/scene-palette';
import { silhouetteRings, type ObjectShape } from '@/lib/object-shape';
import type { ApplianceDetection } from '@/lib/vision';
import { recipeMesh, silhouetteDepth, silhouetteMesh } from '../utils/object-geometry';
import { SURFACE_LOOK, SURFACES } from '../utils/surface-look';

export interface ObjectEditor3dProps {
  shape: ObjectShape;
  detection: Pick<ApplianceDetection, 'box' | 'outline' | 'category' | 'scenery'>;
  /** The photo the object was found on: only its size is read (the photo is never pasted on the model). */
  imageUrl: string;
}

/** Camera on a ¾ view, far enough for a 1 × 1 × 1 object. */
const CAMERA_POSITION: [number, number, number] = [1.3, 0.85, 2.35];

function ObjectModel({ shape, detection, imageUrl }: ObjectEditor3dProps) {
  // Photo size only (silhouette proportions); cached image, no GPU upload.
  const image = useLoader(THREE.ImageLoader, imageUrl);
  const photoAspect = image.width && image.height ? image.width / image.height : 1;

  const mesh = useMemo(
    () =>
      shape.mode === 'recipe' && shape.recipe
        ? recipeMesh(shape.recipe)
        : silhouetteMesh(
            silhouetteRings(detection),
            detection.box,
            photoAspect,
            silhouetteDepth(detection)
          ),
    [shape, detection, photoAspect]
  );
  useEffect(() => () => mesh.dispose(), [mesh]);
  const vertexColors = shape.mode === 'recipe';
  // One material per surface (stone matte, glass shiny…), indexed by the geometry groups.
  const surfaces = useMemo(
    () =>
      SURFACES.map(
        (s) => new THREE.MeshStandardMaterial({ vertexColors: true, ...SURFACE_LOOK[s] })
      ),
    []
  );
  useEffect(() => () => surfaces.forEach((m) => m.dispose()), [surfaces]);
  // Ground under the object (shadow sits on it), from the real geometry.
  const floorY = useMemo(() => {
    mesh.computeBoundingBox();
    return (mesh.boundingBox?.min.y ?? -0.5) - 0.002;
  }, [mesh]);

  return (
    <group>
      <ContactShadows
        position={[0, floorY, 0]}
        scale={2.4}
        blur={2.2}
        far={1.2}
        opacity={0.45}
        frames={1}
      />
      {vertexColors ? (
        <mesh geometry={mesh} material={surfaces} />
      ) : (
        <mesh geometry={mesh}>
          <meshStandardMaterial color={TOKEN_HEX.idle} roughness={0.6} metalness={0.05} />
        </mesh>
      )}
    </group>
  );
}

/**
 * 3D view of one detected object (PV-T10): Spark recipe (measured colours) or silhouette fallback, no photo on it.
 * Orbit (drag) and zoom (pinch / wheel), no pan. `frameloop="demand"`: renders only on change.
 * Transparent canvas over the `.viewer-studio` backdrop; rim light + one baked contact shadow so a dark
 * object never melts into the background.
 * Load with `LazyObjectEditor3d` (no SSR) behind a WebGL check.
 */
export function ObjectEditor3d(props: ObjectEditor3dProps) {
  return (
    <Canvas
      frameloop="demand"
      dpr={[1, 1.5]}
      camera={{ position: CAMERA_POSITION, fov: 35, near: 0.05, far: 20 }}
      gl={{ alpha: true, antialias: true }}
    >
      <hemisphereLight intensity={1.2} />
      <directionalLight position={[2, 3, 2.5]} intensity={1.6} />
      <directionalLight position={[-2, 1, -1.5]} intensity={0.5} />
      {/* Rim light from behind: outlines dark objects (black TV, pump) against the backdrop. */}
      <directionalLight position={[-0.5, 1.6, -3]} intensity={1.4} />
      <Suspense fallback={null}>
        <ObjectModel {...props} />
      </Suspense>
      <OrbitControls makeDefault enablePan={false} minDistance={1.2} maxDistance={5} />
    </Canvas>
  );
}
