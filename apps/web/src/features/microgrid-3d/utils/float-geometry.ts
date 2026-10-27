import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const ATTRS: [name: string, size: number][] = [
  ['position', 3],
  ['normal', 3],
  ['uv', 2],
];

/**
 * Copy position / normal / uv into plain Float32 attributes (non-indexed).
 * Optimized GLBs store them as normalized int16/int8 (KHR_mesh_quantization): baking a
 * transform into those would clamp every value to [-1, 1], and mixed types can't merge.
 */
export function toFloatGeometry(source: THREE.BufferGeometry): THREE.BufferGeometry {
  const src = source.index ? source.toNonIndexed() : source;
  const g = new THREE.BufferGeometry();
  for (const [name, size] of ATTRS) {
    const attr = src.getAttribute(name);
    if (!attr) continue;
    const out = new Float32Array(attr.count * size);
    for (let i = 0; i < attr.count; i++) {
      out[i * size] = attr.getX(i);
      out[i * size + 1] = attr.getY(i);
      if (size === 3) out[i * size + 2] = attr.getZ(i);
    }
    g.setAttribute(name, new THREE.BufferAttribute(out, size));
  }
  if (src !== source) src.dispose();
  return g;
}

/**
 * Bake every mesh under `root` (world transforms applied) into one geometry.
 * Meshes must share one material for the result to render correctly (e.g. a texture atlas).
 */
export function mergeObjectMeshes(root: THREE.Object3D): {
  geometry: THREE.BufferGeometry;
  material: THREE.Material | null;
} {
  root.updateMatrixWorld(true);
  const geos: THREE.BufferGeometry[] = [];
  let material: THREE.Material | null = null;
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const g = toFloatGeometry(mesh.geometry);
    g.applyMatrix4(mesh.matrixWorld);
    geos.push(g);
    material ??= Array.isArray(mesh.material) ? (mesh.material[0] ?? null) : mesh.material;
  });
  const geometry = geos.length ? mergeGeometries(geos) : new THREE.BufferGeometry();
  geos.forEach((g) => g.dispose());
  return { geometry: geometry ?? new THREE.BufferGeometry(), material };
}
