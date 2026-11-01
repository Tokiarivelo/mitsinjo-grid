import * as THREE from 'three';
import type { Surface } from './surface-look';
import { surfaceMaps } from './surface-maps';

export interface SurfaceTextures {
  normalMap: THREE.DataTexture;
  roughnessMap: THREE.DataTexture;
  /** Grey light variation, multiplies the measured vertex colour. */
  map: THREE.DataTexture;
}

const cache = new Map<Surface, SurfaceTextures | null>();

function texture(data: Uint8Array, size: number, srgb: boolean): THREE.DataTexture {
  const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.anisotropy = 4;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.needsUpdate = true;
  return t;
}

/**
 * GPU textures of a surface's procedural maps (PR-1.4), built on first use and kept for the session
 * (≤ 12 surfaces × 3 × 64 kB, shared by every viewer); null for smooth surfaces.
 */
export function surfaceTextures(surface: Surface): SurfaceTextures | null {
  if (!cache.has(surface)) {
    const m = surfaceMaps(surface);
    cache.set(
      surface,
      m && {
        normalMap: texture(m.normal, m.size, false),
        roughnessMap: texture(m.roughness, m.size, false),
        map: texture(m.shade, m.size, true),
      }
    );
  }
  return cache.get(surface)!;
}
