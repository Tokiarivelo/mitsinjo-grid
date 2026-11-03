import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { fbm2d, smoothstep } from './noise';
import { terrainHeight, type KeepOutZone } from './landscape';
import { GROUND_HEX, terrainColor } from './terrain-colors';
import { ACCESS_PATH_HALF_WIDTH, type AccessPath } from './access-paths';

/** Placed objects stand on bare red laterite (same as the village paths), not the tan yard. */
const YARD_COLOR = new THREE.Color(GROUND_HEX.laterite);
/** Share of laterite at the yard centre (the rest is the grass underneath). */
export const YARD_TINT = 0.9;

/**
 * Computes the color in a yard at (x, z) for a given clearing zone (PI-T5).
 * Matches the exact yard tint and falloff from `terrainColor`.
 */
export function yardColorAt(
  x: number,
  z: number,
  zone: KeepOutZone,
  out = new THREE.Color()
): THREE.Color {
  const d = Math.hypot(x - zone.x, z - zone.z);
  terrainColor(x, z, out);
  const yardFactor = (1 - smoothstep(zone.r * 0.55, zone.r * 0.95, d)) * YARD_TINT;
  if (yardFactor > 0) {
    out.lerp(YARD_COLOR, yardFactor);
  }
  return out;
}

/**
 * Builds a draped disc geometry on the terrain relief for a single clearing (PI-T5).
 * Draped at `terrainHeight(x, z) + 0.03` (+3 cm to avoid z-fighting).
 * Uses `fbm2d` noise to create an irregular natural boundary matching existing yards.
 */
export function buildSingleYardGeometry(
  zone: KeepOutZone,
  radialSegments = 32,
  rings = 4
): THREE.BufferGeometry {
  const vertices: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  const tmpColor = new THREE.Color();

  // Center vertex
  const cy = terrainHeight(zone.x, zone.z) + 0.03;
  vertices.push(zone.x, cy, zone.z);
  yardColorAt(zone.x, zone.z, zone, tmpColor);
  colors.push(tmpColor.r, tmpColor.g, tmpColor.b);

  // Concentric rings
  for (let ring = 1; ring <= rings; ring++) {
    const rho = ring / rings;
    for (let seg = 0; seg < radialSegments; seg++) {
      const theta = (seg / radialSegments) * Math.PI * 2;
      const cosT = Math.cos(theta);
      const sinT = Math.sin(theta);

      // Irregular natural border matching the noise of village yards
      const noise = fbm2d(cosT * 2.5 + zone.x * 0.1, sinT * 2.5 + zone.z * 0.1, 7);
      const rBorder = zone.r * (0.92 + 0.16 * (noise - 0.5));
      const r = rho * rBorder;

      const vx = zone.x + r * cosT;
      const vz = zone.z + r * sinT;
      const vy = terrainHeight(vx, vz) + 0.03;

      vertices.push(vx, vy, vz);
      yardColorAt(vx, vz, zone, tmpColor);
      colors.push(tmpColor.r, tmpColor.g, tmpColor.b);
    }
  }

  // Indices for center fan (ring 1)
  for (let seg = 0; seg < radialSegments; seg++) {
    const nextSeg = (seg + 1) % radialSegments;
    // Counter-clockwise seen from above: the face (and its normal) points up.
    indices.push(0, nextSeg + 1, seg + 1);
  }

  // Indices for outer rings
  for (let ring = 1; ring < rings; ring++) {
    const innerStart = 1 + (ring - 1) * radialSegments;
    const outerStart = 1 + ring * radialSegments;
    for (let seg = 0; seg < radialSegments; seg++) {
      const nextSeg = (seg + 1) % radialSegments;
      const i0 = innerStart + seg;
      const i1 = innerStart + nextSeg;
      const o0 = outerStart + seg;
      const o1 = outerStart + nextSeg;

      indices.push(i0, i1, o0);
      indices.push(i1, o1, o0);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * Draped laterite ribbon along one access track (+4 cm, above the yards).
 * Full laterite in the middle, blended into the grass at both edges.
 */
export function buildAccessPathGeometry(path: AccessPath, step = 0.5): THREE.BufferGeometry {
  const [x0, z0] = path.from;
  const [x1, z1] = path.to;
  const len = Math.max(1e-6, Math.hypot(x1 - x0, z1 - z0));
  // Unit normal on the ground plane.
  const nx = -(z1 - z0) / len;
  const nz = (x1 - x0) / len;
  const n = Math.max(1, Math.ceil(len / step));
  const across = [-1, -0.5, 0, 0.5, 1];
  const vertices: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const tmp = new THREE.Color();
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const cx = x0 + (x1 - x0) * t;
    const cz = z0 + (z1 - z0) * t;
    for (const a of across) {
      const vx = cx + nx * a * ACCESS_PATH_HALF_WIDTH;
      const vz = cz + nz * a * ACCESS_PATH_HALF_WIDTH;
      vertices.push(vx, terrainHeight(vx, vz) + 0.04, vz);
      terrainColor(vx, vz, tmp).lerp(YARD_COLOR, Math.abs(a) === 1 ? 0.45 : YARD_TINT);
      colors.push(tmp.r, tmp.g, tmp.b);
    }
  }
  const row = across.length;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < row - 1; j++) {
      const a = i * row + j;
      const b = a + row;
      // Faces up (counter-clockwise seen from above).
      indices.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * Builds a single merged BufferGeometry for all placed yards (PI-T5).
 * Draped over the relief (+3 cm, zero z-fighting) in a single draw call (≤ +1 draw call budget).
 * Returns null if clearings is empty.
 */
export function buildPlacedYardsGeometry(
  clearings: readonly KeepOutZone[],
  paths: readonly AccessPath[] = []
): THREE.BufferGeometry | null {
  if (clearings.length === 0 && paths.length === 0) return null;
  const singleGeometries: THREE.BufferGeometry[] = [];
  for (const zone of clearings) {
    singleGeometries.push(buildSingleYardGeometry(zone));
  }
  for (const path of paths) {
    singleGeometries.push(buildAccessPathGeometry(path));
  }
  if (singleGeometries.length === 0) return null;
  const merged = mergeGeometries(singleGeometries, false);
  // Dispose intermediate geometries
  for (const g of singleGeometries) g.dispose();
  return merged;
}
