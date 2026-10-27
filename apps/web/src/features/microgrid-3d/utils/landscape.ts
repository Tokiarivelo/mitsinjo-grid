import { BATTERY_POSITION, BUS_POSITION, SECTOR_POSITIONS, SOLAR_POSITION } from './to-scene-model';
import { fbm2d, smoothstep } from './noise';

/**
 * Pure landscape layout: terrain relief, laterite paths and keep-out zones.
 * Visual only (no energy values). Shared by the terrain mesh, the vegetation
 * scatter and the cable router so everything sits on the same ground.
 */

/** Village plateau: flat inside this radius so buildings never float. */
export const FLAT_RADIUS = 19;
/** Hills reach full height at this radius. */
export const HILL_RADIUS = 46;
/** Terrain mesh radius (fog hides the edge). */
export const TERRAIN_RADIUS = 110;

export const POND_CENTER: [number, number] = [-11.5, 4.5];
export const POND_RADIUS = 2.6;

/**
 * Sun azimuth (radians, from -z towards +x): behind the village, slightly right,
 * over the lake valley, as in the reference render.
 */
export const SUN_AZIMUTH_RAD = 0.45;

/** Distant lake in the sunset valley (catches the sun like the reference). */
export const LAKE_CENTER: [number, number] = [34, -70];
export const LAKE_RADIUS = 24;
export const LAKE_LEVEL = -0.6;

const TERRAIN_SEED = 7;

/** Ground height at (x, z). 0 on the village plateau, rolling forested hills beyond. */
export function terrainHeight(x: number, z: number): number {
  const r = Math.hypot(x, z);
  const rise = smoothstep(FLAT_RADIUS, HILL_RADIUS, r);
  const relief = fbm2d(x * 0.035, z * 0.035, TERRAIN_SEED);
  // Lower on the camera side (south, +z) so the village and the horizon stay visible.
  const facing = 0.3 + 0.7 * smoothstep(25, -35, z);
  const hills = rise * rise * (2 + relief * 11) * facing;
  // Small bumps only near/after the plateau edge.
  const bumps =
    (fbm2d(x * 0.18, z * 0.18, TERRAIN_SEED + 3) - 0.5) *
    0.6 *
    smoothstep(FLAT_RADIUS - 4, FLAT_RADIUS + 6, r);
  // Basin for the distant lake.
  const dl = Math.hypot(x - LAKE_CENTER[0], z - LAKE_CENTER[1]);
  const basin = (1 - smoothstep(LAKE_RADIUS * 0.6, LAKE_RADIUS * 1.25, dl)) * (hills + 2.2);
  return hills + bumps - basin;
}

/** Laterite paths as polylines [x, z][] (bus hub → each site, plus the village road). */
export const VILLAGE_PATHS: [number, number][][] = [
  [
    [BUS_POSITION[0], BUS_POSITION[2]],
    [-3, -3],
    [SOLAR_POSITION[0] + 3, SOLAR_POSITION[2] + 3],
  ],
  [
    [BUS_POSITION[0], BUS_POSITION[2]],
    [BATTERY_POSITION[0], BATTERY_POSITION[2]],
  ],
  [
    [BUS_POSITION[0], BUS_POSITION[2]],
    [4, 0.5],
    [SECTOR_POSITIONS.health[0] - 1, SECTOR_POSITIONS.health[2] + 1.5],
  ],
  [
    [BUS_POSITION[0], BUS_POSITION[2]],
    [-4, 2],
    [SECTOR_POSITIONS.water[0] + 1.5, SECTOR_POSITIONS.water[2]],
  ],
  [
    [BATTERY_POSITION[0], BATTERY_POSITION[2]],
    [1.5, -5.5],
    [SECTOR_POSITIONS.school[0], SECTOR_POSITIONS.school[2] + 2],
  ],
  [
    [BUS_POSITION[0], BUS_POSITION[2]],
    [-3, 5],
    [SECTOR_POSITIONS.households[0] + 1, SECTOR_POSITIONS.households[2]],
  ],
  [
    [BUS_POSITION[0], BUS_POSITION[2]],
    [2.5, 4.5],
    [SECTOR_POSITIONS.market[0], SECTOR_POSITIONS.market[2] - 1],
  ],
  // Main road leaving the village to the south-east.
  [
    [SECTOR_POSITIONS.market[0], SECTOR_POSITIONS.market[2]],
    [9, 12],
    [14, 20],
    [17, 34],
    [24, 52],
  ],
  // Ring road to the clinic and school.
  [
    [SECTOR_POSITIONS.health[0], SECTOR_POSITIONS.health[2]],
    [8, -6],
    [SECTOR_POSITIONS.school[0] + 3, SECTOR_POSITIONS.school[2]],
  ],
];

export const PATH_HALF_WIDTH = 0.8;

function distToSegment(px: number, pz: number, a: [number, number], b: [number, number]): number {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const len2 = dx * dx + dz * dz;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - a[0]) * dx + (pz - a[1]) * dz) / len2));
  return Math.hypot(px - (a[0] + t * dx), pz - (a[1] + t * dz));
}

/** Distance from (x, z) to the nearest path centre line. */
export function pathDistance(x: number, z: number, paths = VILLAGE_PATHS): number {
  let best = Infinity;
  for (const line of paths) {
    for (let i = 0; i < line.length - 1; i++) {
      const a = line[i];
      const b = line[i + 1];
      if (!a || !b) continue;
      const d = distToSegment(x, z, a, b);
      if (d < best) best = d;
    }
  }
  return best;
}

export interface KeepOutZone {
  x: number;
  z: number;
  r: number;
}

/** Areas where vegetation must not grow (buildings, pads, pond). */
export const KEEP_OUT_ZONES: KeepOutZone[] = [
  { x: SECTOR_POSITIONS.health[0], z: SECTOR_POSITIONS.health[2], r: 4.6 },
  { x: SECTOR_POSITIONS.water[0], z: SECTOR_POSITIONS.water[2], r: 3.4 },
  { x: SECTOR_POSITIONS.school[0], z: SECTOR_POSITIONS.school[2], r: 5 },
  { x: SECTOR_POSITIONS.households[0], z: SECTOR_POSITIONS.households[2], r: 4.4 },
  { x: SECTOR_POSITIONS.market[0], z: SECTOR_POSITIONS.market[2], r: 4.2 },
  { x: SOLAR_POSITION[0], z: SOLAR_POSITION[2], r: 6.6 },
  { x: BATTERY_POSITION[0], z: BATTERY_POSITION[2], r: 3.4 },
  { x: BUS_POSITION[0], z: BUS_POSITION[2], r: 3.2 },
  { x: POND_CENTER[0], z: POND_CENTER[1], r: POND_RADIUS + 0.8 },
];

/** True when nothing may be placed at (x, z): keep-out zone, path, lake or off-map. */
export function isBlocked(x: number, z: number, margin = 0): boolean {
  if (Math.hypot(x, z) > TERRAIN_RADIUS - 4) return true;
  for (const k of KEEP_OUT_ZONES) {
    if (Math.hypot(x - k.x, z - k.z) < k.r + margin) return true;
  }
  if (pathDistance(x, z) < PATH_HALF_WIDTH + 0.5 + margin) return true;
  if (Math.hypot(x - LAKE_CENTER[0], z - LAKE_CENTER[1]) < LAKE_RADIUS * 0.95) return true;
  return false;
}
