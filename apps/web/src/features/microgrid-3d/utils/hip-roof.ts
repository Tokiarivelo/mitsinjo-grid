import * as THREE from 'three';

/**
 * Hipped roof (4 sloped faces) over a `width` × `depth` rectangle, base at y = 0.
 * Ridge runs along the longer side; a square footprint gives a pyramid.
 * UVs: u along the eave, v up the slope (so a stripe texture reads as corrugation).
 */
export function createHipRoofGeometry(
  width: number,
  depth: number,
  height: number
): THREE.BufferGeometry {
  const alongX = width >= depth;
  const long = alongX ? width : depth;
  const short = alongX ? depth : width;
  const halfRidge = (long - short) / 2;
  const hl = long / 2;
  const hs = short / 2;

  // Build in a local frame where the ridge runs along X, then swap if needed.
  type V3 = [number, number, number];
  const A: V3 = [-hl, 0, -hs]; // back-left eave
  const B: V3 = [hl, 0, -hs]; // back-right
  const C: V3 = [hl, 0, hs]; // front-right
  const D: V3 = [-hl, 0, hs]; // front-left
  const R1: V3 = [-halfRidge, height, 0];
  const R2: V3 = [halfRidge, height, 0];

  const positions: number[] = [];
  const uvs: number[] = [];
  const tri = (p: V3[], uv: [number, number][]) => {
    for (const v of p) positions.push(v[0], v[1], v[2]);
    for (const t of uv) uvs.push(t[0], t[1]);
  };
  const u = (x: number) => (x + hl) / long;
  // Front slope (+z): D C R2 R1
  tri(
    [D, C, R2],
    [
      [u(D[0]) * long, 0],
      [u(C[0]) * long, 0],
      [u(R2[0]) * long, 1],
    ]
  );
  // Square footprint → pyramid: R1 == R2, the second slope triangles would be degenerate.
  const hasRidge = halfRidge > 1e-6;
  if (hasRidge)
    tri(
      [D, R2, R1],
      [
        [u(D[0]) * long, 0],
        [u(R2[0]) * long, 1],
        [u(R1[0]) * long, 1],
      ]
    );
  // Back slope (-z): B A R1 R2
  tri(
    [B, A, R1],
    [
      [u(B[0]) * long, 0],
      [u(A[0]) * long, 0],
      [u(R1[0]) * long, 1],
    ]
  );
  if (hasRidge)
    tri(
      [B, R1, R2],
      [
        [u(B[0]) * long, 0],
        [u(R1[0]) * long, 1],
        [u(R2[0]) * long, 1],
      ]
    );
  // Hip ends (triangles): left A D R1, right C B R2
  tri(
    [A, D, R1],
    [
      [0, 0],
      [short, 0],
      [short / 2, 1],
    ]
  );
  tri(
    [C, B, R2],
    [
      [0, 0],
      [short, 0],
      [short / 2, 1],
    ]
  );

  if (!alongX) {
    // Rotate 90° about Y: (x, z) → (z, -x); keeps winding (outward normals).
    for (let i = 0; i < positions.length; i += 3) {
      const x = positions[i] ?? 0;
      const z = positions[i + 2] ?? 0;
      positions[i] = z;
      positions[i + 2] = -x;
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.computeVertexNormals();
  return geometry;
}
