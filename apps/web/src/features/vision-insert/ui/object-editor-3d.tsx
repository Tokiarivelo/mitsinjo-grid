'use client';

import { Suspense, useEffect, useMemo } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { TOKEN_HEX } from '@/features/microgrid-3d/utils/scene-palette';
import { silhouetteRings, type ObjectShape } from '@/lib/object-shape';
import type { ApplianceDetection } from '@/lib/vision';
import { recipeMesh, silhouetteDepth, silhouetteMesh } from '../utils/object-geometry';

export interface ObjectEditor3dProps {
  shape: ObjectShape;
  detection: Pick<ApplianceDetection, 'box' | 'outline' | 'category' | 'scenery'>;
  /** The photo the object was found on (its texture). */
  imageUrl: string;
}

/** Marks a loaded photo as sRGB and asks for a re-upload. */
function asPhotoTexture(t: THREE.Texture) {
  t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
}

/** Camera on a ¾ view, far enough for a 1 × 1 × 1 object. */
const CAMERA_POSITION: [number, number, number] = [1.3, 0.85, 2.35];

function ObjectModel({ shape, detection, imageUrl }: ObjectEditor3dProps) {
  const invalidate = useThree((s) => s.invalidate);
  // Photo colours as seen: sRGB, set on load then re-uploaded (else the GPU copy stays linear and pale).
  const texture = useTexture(imageUrl, (loaded) => {
    (Array.isArray(loaded) ? loaded : [loaded]).forEach(asPhotoTexture);
    invalidate();
  });
  const image = texture.image as { width?: number; height?: number } | undefined;
  const photoAspect = image?.width && image.height ? image.width / image.height : 1;

  const mesh = useMemo(
    () =>
      shape.mode === 'recipe' && shape.recipe
        ? recipeMesh(shape.recipe, detection.box)
        : silhouetteMesh(
            silhouetteRings(detection),
            detection.box,
            photoAspect,
            silhouetteDepth(detection)
          ),
    [shape, detection, photoAspect]
  );
  useEffect(
    () => () => {
      mesh.body.dispose();
      mesh.front.dispose();
    },
    [mesh]
  );
  const vertexColors = shape.mode === 'recipe';

  return (
    <group>
      <mesh geometry={mesh.body}>
        <meshStandardMaterial
          vertexColors={vertexColors}
          color={vertexColors ? undefined : TOKEN_HEX.idle}
          roughness={0.6}
          metalness={0.05}
        />
      </mesh>
      <mesh geometry={mesh.front}>
        {/* Photo as taken: unlit and not tone-mapped (ACES greys bright colours like a beige fridge). */}
        <meshBasicMaterial map={texture} toneMapped={false} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

/**
 * 3D view of one detected object (PV-T10): Spark recipe or silhouette fallback, photo on the front.
 * Orbit (drag) and zoom (pinch / wheel), no pan. `frameloop="demand"`: renders only on change.
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
      <Suspense fallback={null}>
        <ObjectModel {...props} />
      </Suspense>
      <OrbitControls makeDefault enablePan={false} minDistance={1.2} maxDistance={5} />
    </Canvas>
  );
}
