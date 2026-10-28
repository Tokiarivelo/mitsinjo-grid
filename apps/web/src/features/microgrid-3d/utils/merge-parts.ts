import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Merge many small static parts (posts, braces, window panes) into one geometry so they
 * cost a single draw call. Each part is a primitive with its own transform.
 */
export type PartShape =
  | { kind: 'box'; size: [number, number, number] }
  | { kind: 'plane'; size: [number, number] }
  | { kind: 'cylinder'; radiusTop: number; radiusBottom: number; height: number; segments?: number }
  | { kind: 'sphere'; radius: number; segments?: number };

export interface Part {
  shape: PartShape;
  position: [number, number, number];
  rotation?: [number, number, number];
}

function build(shape: PartShape): THREE.BufferGeometry {
  switch (shape.kind) {
    case 'box':
      return new THREE.BoxGeometry(...shape.size);
    case 'plane':
      return new THREE.PlaneGeometry(...shape.size);
    case 'cylinder':
      return new THREE.CylinderGeometry(
        shape.radiusTop,
        shape.radiusBottom,
        shape.height,
        shape.segments ?? 8
      );
    case 'sphere':
      return new THREE.SphereGeometry(
        shape.radius,
        shape.segments ?? 8,
        Math.max(4, Math.round((shape.segments ?? 8) * 0.75))
      );
  }
}

const euler = new THREE.Euler();
const matrix = new THREE.Matrix4();
const quat = new THREE.Quaternion();
const pos = new THREE.Vector3();
const one = new THREE.Vector3(1, 1, 1);

/** Returns one non-indexed geometry with all parts baked in (empty geometry for no parts). */
export function mergeParts(parts: Part[]): THREE.BufferGeometry {
  if (parts.length === 0) return new THREE.BufferGeometry();
  const geos = parts.map((p) => {
    const g = build(p.shape).toNonIndexed();
    euler.set(...(p.rotation ?? [0, 0, 0]));
    quat.setFromEuler(euler);
    pos.set(...p.position);
    matrix.compose(pos, quat, one);
    g.applyMatrix4(matrix);
    return g;
  });
  const merged = mergeGeometries(geos);
  geos.forEach((g) => g.dispose());
  if (!merged) throw new Error('mergeParts: incompatible geometries');
  return merged;
}
