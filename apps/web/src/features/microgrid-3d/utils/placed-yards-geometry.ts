import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { fbm2d, smoothstep } from './noise';
import { terrainHeight, type KeepOutZone } from './landscape';
import { GROUND_HEX, terrainColor } from './terrain-colors';

const YARD_COLOR = new THREE.Color(GROUND_HEX.yard);

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
  const yardFactor = (1 - smoothstep(zone.r * 0.55, zone.r * 0.95, d)) * 0.8;
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
    indices.push(0, seg + 1, nextSeg + 1);
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

      indices.push(i0, o0, i1);
      indices.push(i1, o0, o1);
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
  clearings: readonly KeepOutZone[]
): THREE.BufferGeometry | null {
  if (clearings.length === 0) return null;
  const singleGeometries: THREE.BufferGeometry[] = [];
  for (const zone of clearings) {
    singleGeometries.push(buildSingleYardGeometry(zone));
  }
  if (singleGeometries.length === 0) return null;
  const merged = mergeGeometries(singleGeometries, false);
  // Dispose intermediate geometries
  for (const g of singleGeometries) g.dispose();
  return merged;
}
