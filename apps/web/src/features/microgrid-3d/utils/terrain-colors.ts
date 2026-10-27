import * as THREE from 'three';
import { fbm2d, smoothstep } from './noise';
import {
  FLAT_RADIUS,
  HILL_RADIUS,
  KEEP_OUT_ZONES,
  LAKE_CENTER,
  LAKE_RADIUS,
  PATH_HALF_WIDTH,
  pathDistance,
} from './landscape';
import { SOLAR_POSITION } from './to-scene-model';

/** Ground palette (sRGB hex). Neutral, desaturated enough that state colors still pop. */
export const GROUND_HEX = {
  lush: '#4d7d2c',
  meadow: '#6a8f36',
  dry: '#8f8a48',
  forestFloor: '#2b4a1f',
  laterite: '#b5643a',
  yard: '#a87650',
  gravel: '#8d806c',
  shore: '#9c8a62',
} as const;

const C = Object.fromEntries(
  Object.entries(GROUND_HEX).map(([k, v]) => [k, new THREE.Color(v)])
) as Record<keyof typeof GROUND_HEX, THREE.Color>;

const tmp = new THREE.Color();

/** Ground color at (x, z), written into `out` (linear working space). */
export function terrainColor(x: number, z: number, out: THREE.Color): THREE.Color {
  const r = Math.hypot(x, z);
  const n = fbm2d(x * 0.09, z * 0.09, 5);
  const n2 = fbm2d(x * 0.03 + 9, z * 0.03 - 4, 6);

  // Grass: lush ↔ meadow ↔ dry patches.
  out.copy(C.lush).lerp(C.meadow, smoothstep(0.35, 0.7, n));
  out.lerp(tmp.copy(C.dry), smoothstep(0.62, 0.8, n2) * 0.6);

  // Hills under the forest are darker.
  out.lerp(C.forestFloor, smoothstep(FLAT_RADIUS, HILL_RADIUS * 0.8, r) * 0.75);

  // Dirt yards around buildings.
  for (const k of KEEP_OUT_ZONES) {
    const d = Math.hypot(x - k.x, z - k.z);
    const yard = 1 - smoothstep(k.r * 0.55, k.r * 0.95, d);
    if (yard > 0) out.lerp(C.yard, yard * 0.8);
  }

  // Gravel pad under the PV field.
  const sx = Math.abs(x - SOLAR_POSITION[0]);
  const sz = Math.abs(z - SOLAR_POSITION[2]);
  const pad = (1 - smoothstep(4.6, 5.4, sx)) * (1 - smoothstep(4.1, 4.9, sz));
  if (pad > 0) out.lerp(C.gravel, pad * 0.9);

  // Laterite paths with a soft edge (n adds a ragged border).
  const pd = pathDistance(x, z);
  const path = 1 - smoothstep(PATH_HALF_WIDTH * 0.6, PATH_HALF_WIDTH + 0.35 + n * 0.3, pd);
  if (path > 0) out.lerp(C.laterite, path);

  // Lake shore.
  const dl = Math.hypot(x - LAKE_CENTER[0], z - LAKE_CENTER[1]);
  const shore = 1 - smoothstep(LAKE_RADIUS * 0.9, LAKE_RADIUS * 1.15, dl);
  if (shore > 0) out.lerp(C.shore, shore * 0.8);

  return out;
}
