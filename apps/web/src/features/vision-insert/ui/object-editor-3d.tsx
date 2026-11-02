'use client';

import { Suspense, useEffect, useMemo } from 'react';
import { Canvas, useLoader, useThree } from '@react-three/fiber';
import { ContactShadows, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { TOKEN_HEX } from '@/features/microgrid-3d/utils/scene-palette';
import { defaultArchetype, kitToRecipe, type ObjectKit } from '@/lib/object-kit';
import {
  fitRecipe,
  silhouetteRings,
  type ObjectShape,
  type RecipeMaterial,
} from '@/lib/object-shape';
import type { ApplianceDetection } from '@/lib/vision';
import { recipeMesh, silhouetteDepth, silhouetteMesh } from '../utils/object-geometry';
import { SURFACE_LOOK, SURFACES } from '../utils/surface-look';
import { SWATCH_GAIN } from '../utils/surface-maps';
import { surfaceTextures, swatchTexture } from '../utils/surface-textures';

export interface ObjectEditor3dProps {
  shape: ObjectShape;
  detection: Pick<ApplianceDetection, 'box' | 'outline' | 'category' | 'scenery'> & {
    label?: string;
  };
  /** The photo the object was found on: only its size is read (the photo is never pasted on the model). */
  imageUrl: string;
  /** Display size multiplier (PV-T11b, visual only, 0.5–2). */
  scale?: number;
  /** Tint multiplied over the measured colours (PV-T11b, visual only); null = as measured. */
  tint?: string | null;
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

function ObjectModel({ shape, detection, imageUrl, scale = 1, tint = null }: ObjectEditor3dProps) {
  // Photo size only (silhouette proportions); cached image, no GPU upload.
  const image = useLoader(THREE.ImageLoader, imageUrl);
  const photoAspect = image.width && image.height ? image.width / image.height : 1;

  const fallbackRecipe = useMemo(() => {
    if (shape.mode === 'recipe' && shape.recipe) return null;
    if (detection.outline) return null;
    const archetype = defaultArchetype(detection.category, detection.scenery, detection.label);
    const fallbackKit: ObjectKit = {
      archetype,
      proportions: { w: 1, h: 0.6, d: 0.5 },
      colors: { main: '#6a6c72', secondary: '#333538', accent: '#1a1b1e' },
      materials: { main: 'metal', secondary: 'glass', accent: 'rubber' },
    };
    return fitRecipe(kitToRecipe(fallbackKit), photoAspect);
  }, [shape, detection, photoAspect]);

  const activeRecipe = shape.mode === 'recipe' && shape.recipe ? shape.recipe : fallbackRecipe;

  const mesh = useMemo(
    () =>
      activeRecipe
        ? recipeMesh(activeRecipe)
        : silhouetteMesh(
            silhouetteRings(detection),
            detection.box,
            photoAspect,
            silhouetteDepth(detection)
          ),
    [activeRecipe, detection, photoAspect]
  );
  useEffect(() => () => mesh.dispose(), [mesh]);
  const invalidate = useThree((s) => s.invalidate);
  const vertexColors = Boolean(activeRecipe);
  const swatches = activeRecipe?.swatches;
  // One material per surface (stone matte, glass shiny…), indexed by the geometry groups. Surfaces the
  // model uses get their relief maps (PR-1.4: stone blocks, slate rows…) or photo swatches (PR-1.5),
  // tinted by the measured colours and compensated with a brightness gain so surfaces do not darken.
  const surfaces = useMemo(() => {
    const used = new Set(mesh.groups.map((g) => g.materialIndex));
    return SURFACES.map((s, i) => {
      const { roughness, metalness } = SURFACE_LOOK[s];
      const maps = vertexColors && used.has(i) ? surfaceTextures(s) : null;
      const swatch = vertexColors && swatches?.[s as RecipeMaterial];
      const swatchTex = swatch ? swatchTexture(swatch, invalidate) : null;
      const map = swatchTex ?? maps?.map;
      const gain = swatchTex ? SWATCH_GAIN : (maps?.gain ?? 1);
      return new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness,
        metalness,
        color: new THREE.Color(tint ?? '#ffffff').multiplyScalar(gain),
        ...(maps ? { normalMap: maps.normalMap, roughnessMap: maps.roughnessMap } : {}),
        ...(map ? { map } : {}),
      });
    });
  }, [mesh, vertexColors, swatches, tint, invalidate]);
  useEffect(() => () => surfaces.forEach((m) => m.dispose()), [surfaces]);
  // Ground under the object (shadow sits on it), from the real geometry.
  const floorY = useMemo(() => {
    mesh.computeBoundingBox();
    return (mesh.boundingBox?.min.y ?? -0.5) - 0.002;
  }, [mesh]);
  // frameloop="demand": a display tweak must request its frame.
  useEffect(() => {
    invalidate();
  }, [scale, tint, invalidate]);

  return (
    <group>
      <ContactShadows
        position={[0, floorY * scale, 0]}
        scale={2.4 * scale}
        blur={2.2}
        far={1.2}
        opacity={0.45}
        frames={1}
      />
      <group scale={scale}>
        {vertexColors ? (
          <mesh geometry={mesh} material={surfaces} />
        ) : (
          <mesh geometry={mesh}>
            <meshStandardMaterial color={tint ?? TOKEN_HEX.idle} roughness={0.6} metalness={0.05} />
          </mesh>
        )}
      </group>
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
