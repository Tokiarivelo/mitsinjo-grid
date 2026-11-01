'use client';

import { Suspense, useEffect, useMemo } from 'react';
import { Canvas, useLoader, useThree } from '@react-three/fiber';
import { ContactShadows, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { TOKEN_HEX } from '@/features/microgrid-3d/utils/scene-palette';
import { silhouetteRings, type ObjectShape } from '@/lib/object-shape';
import type { ApplianceDetection } from '@/lib/vision';
import { recipeMesh, silhouetteDepth, silhouetteMesh } from '../utils/object-geometry';
import { SURFACE_LOOK, SURFACES } from '../utils/surface-look';
import { surfaceTextures } from '../utils/surface-textures';

export interface ObjectEditor3dProps {
  shape: ObjectShape;
  detection: Pick<ApplianceDetection, 'box' | 'outline' | 'category' | 'scenery'>;
  /** The photo the object was found on: only its size is read (the photo is never pasted on the model). */
  imageUrl: string;
}

/** Strength of the studio reflections and fill (image-based light). */
const ENV_INTENSITY = 0.9;

/**
 * Studio light (PR-1.1): a soft room (`RoomEnvironment`) pre-filtered once per canvas (PMREM, 256² faces)
 * as `scene.environment`, so every surface gets fill light and reflections by its roughness; disposed on
 * unmount. Replaces the hemisphere and fill lights.
 */
function StudioEnvironment() {
  const get = useThree((s) => s.get);
  useEffect(() => {
    const { gl, scene, invalidate } = get();
    const pmrem = new THREE.PMREMGenerator(gl);
    const room = new RoomEnvironment();
    const target = pmrem.fromScene(room, 0.04);
    room.dispose();
    pmrem.dispose();
    scene.environment = target.texture;
    scene.environmentIntensity = ENV_INTENSITY;
    invalidate(); // frameloop="demand"
    return () => {
      scene.environment = null;
      target.dispose();
    };
  }, [get]);
  return null;
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
  // One material per surface (stone matte, glass shiny…), indexed by the geometry groups. Surfaces the
  // model uses get their relief maps (PR-1.4: stone blocks, slate rows…), tinted by the measured colours.
  const surfaces = useMemo(() => {
    const used = new Set(mesh.groups.map((g) => g.materialIndex));
    return SURFACES.map((s, i) => {
      const { roughness, metalness } = SURFACE_LOOK[s];
      const maps = vertexColors && used.has(i) ? surfaceTextures(s) : null;
      return new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness,
        metalness,
        ...(maps ?? {}),
      });
    });
  }, [mesh, vertexColors]);
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
 * Transparent canvas over the `.viewer-studio` backdrop. Studio light (PR-1.1): image-based room light,
 * Khronos PBR Neutral tone mapping (keeps the measured colours; ACES shifted them), one soft key, a rim light (a dark object never melts into the background) and one
 * baked contact shadow.
 * Load with `LazyObjectEditor3d` (no SSR) behind a WebGL check.
 */
export function ObjectEditor3d(props: ObjectEditor3dProps) {
  return (
    <Canvas
      frameloop="demand"
      dpr={[1, 1.5]}
      camera={{ position: CAMERA_POSITION, fov: 35, near: 0.05, far: 20 }}
      gl={{
        alpha: true,
        antialias: true,
        toneMapping: THREE.NeutralToneMapping,
        toneMappingExposure: 1,
      }}
    >
      <StudioEnvironment />
      {/* Soft key from the upper right front. */}
      <directionalLight position={[2, 3, 2.5]} intensity={1.2} />
      {/* Rim light from behind: outlines dark objects (black TV, pump) against the backdrop. */}
      <directionalLight position={[-0.5, 1.6, -3]} intensity={1.1} />
      <Suspense fallback={null}>
        <ObjectModel {...props} />
      </Suspense>
      <OrbitControls makeDefault enablePan={false} minDistance={1.2} maxDistance={5} />
    </Canvas>
  );
}
