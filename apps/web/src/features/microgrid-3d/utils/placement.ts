import * as THREE from 'three';
import {
  SECTOR_IDS,
  type Appliance,
  type AppliancePosition,
  type SectorId,
} from '@mitsinjo/engine';
import {
  KEEP_OUT_ZONES,
  LAKE_CENTER,
  LAKE_RADIUS,
  PATH_HALF_WIDTH,
  TERRAIN_RADIUS,
  closestPathSegment,
  pathDistance,
  type KeepOutZone,
} from './landscape';
import { SECTOR_POSITIONS } from './site-positions';
import { siteZones, type PlacedZoneItem } from './site-zones';

export { siteZones, type PlacedZoneItem, type KeepOutZone } from './site-zones';

/** Distance of the first marker row from the building centre, row and column spacing (scene units). */
export const MARKER_RING = 3.4;
export const MARKER_ROW = 0.75;
export const MARKER_GAP = 0.7;
export const MARKERS_PER_ROW = 5;

/**
 * Pure free-placement helpers (PP-T2): where a marker goes on the village map. The engine
 * ignores `position` (PP-T1); these only decide drawing spots and default feeders.
 */

/** Marker clearance outside a keep-out circle (scene units). */
export const PLACEMENT_CLEARANCE = 0.5;
/** Markers clamp inside this radius (mirrors `isBlocked`'s off-map edge). */
export const PLACEMENT_RADIUS = TERRAIN_RADIUS - 4;

/** Nearest feeder (sector building) to a map position — the default feeder for a placed object. */
export function nearestSector(pos: AppliancePosition): SectorId {
  let best: SectorId = SECTOR_IDS[0];
  let bestD = Infinity;
  for (const id of SECTOR_IDS) {
    const [bx, , bz] = SECTOR_POSITIONS[id];
    const d = Math.hypot(pos.x - bx, pos.z - bz);
    if (d < bestD) {
      bestD = d;
      best = id;
    }
  }
  return best;
}

/** Project a map position inside the terrain disc (the engine box corners hang off-map). */
export function clampToTerrain(pos: AppliancePosition): AppliancePosition {
  const r = Math.hypot(pos.x, pos.z);
  if (r <= PLACEMENT_RADIUS) return { x: pos.x, z: pos.z };
  const s = PLACEMENT_RADIUS / r;
  return { x: pos.x * s, z: pos.z * s };
}

export interface SnapOptions {
  zones?: readonly KeepOutZone[] | null;
  placed?: readonly PlacedZoneItem[] | null;
  excludeId?: string;
  checkPaths?: boolean;
}

/** True when (x, z) clears every keep-out zone and path by `clearance` (1e-9 under for float noise). */
function clearsAll(
  x: number,
  z: number,
  clearance: number,
  zones: readonly KeepOutZone[],
  excludeId?: string,
  checkPaths = true
): boolean {
  if (Math.hypot(x, z) > PLACEMENT_RADIUS) return false;
  for (const k of zones) {
    if (excludeId && k.id === excludeId) continue;
    if (Math.hypot(x - k.x, z - k.z) < k.r + clearance - 1e-9) return false;
  }
  if (checkPaths && pathDistance(x, z) < PATH_HALF_WIDTH + clearance - 1e-9) {
    return false;
  }
  if (Math.hypot(x - LAKE_CENTER[0], z - LAKE_CENTER[1]) < LAKE_RADIUS * 0.95) {
    return false;
  }
  return true;
}

/** Radial push of (x, z) onto its circle (dead centre pushes +x). */
function radialOut(
  x: number,
  z: number,
  k: { x: number; z: number; r: number },
  clearance: number
): [number, number] {
  const min = k.r + clearance;
  const dx = x - k.x;
  const dz = z - k.z;
  const d = Math.hypot(dx, dz);
  if (d === 0) return [k.x + min, z];
  const s = min / d;
  return [k.x + dx * s, k.z + dz * s];
}

/** 0–2 intersection points of two circles (centre x/z, radius r + clearance). */
function circleIntersections(
  a: { x: number; z: number; r: number },
  b: { x: number; z: number; r: number },
  clearance: number
): [number, number][] {
  const ra = a.r + clearance;
  const rb = b.r + clearance;
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const d = Math.hypot(dx, dz);
  if (d === 0 || d > ra + rb || d < Math.abs(ra - rb)) return [];
  const t = (ra * ra - rb * rb + d * d) / (2 * d);
  const h2 = ra * ra - t * t;
  if (h2 < 0) return [];
  const h = Math.sqrt(h2);
  const mx = a.x + (dx / d) * t;
  const mz = a.z + (dz / d) * t;
  const ox = (-dz / d) * h;
  const oz = (dx / d) * h;
  return [
    [mx + ox, mz + oz],
    [mx - ox, mz - oz],
  ];
}

/**
 * Exit points off the nearest path corridor for (x, z): straight away from the centre line, then
 * both normals of the segment. Empty when (x, z) already clears every path.
 */
function pathExits(x: number, z: number, clearance: number): [number, number][] {
  const hit = closestPathSegment(x, z);
  const rMin = PATH_HALF_WIDTH + clearance;
  if (!hit || hit.distance >= rMin) return [];
  const [c0, c1] = hit.closestPoint;
  const [a, b] = hit.segment;
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  const nx = -(b[1] - a[1]) / L;
  const nz = (b[0] - a[0]) / L;
  const exits: [number, number][] = [];
  if (hit.distance > 1e-6) {
    exits.push([c0 + ((x - c0) / hit.distance) * rMin, c1 + ((z - c1) / hit.distance) * rMin]);
  }
  exits.push([c0 + nx * rMin, c1 + nz * rMin], [c0 - nx * rMin, c1 - nz * rMin]);
  return exits;
}

/**
 * Push a map position out of every obstacle (buildings, pads, pond, paths, and placed objects, PI-T3):
 * no object placed inside a footprint or on a path. Nearest clean exit wins: radial push-outs first,
 * perpendicular path pushes, pairwise intersections, then cross-pushes.
 * Deterministic and pure.
 */
export function snapAwayFromBuildings(
  pos: AppliancePosition,
  clearance = PLACEMENT_CLEARANCE,
  options: SnapOptions = {}
): AppliancePosition {
  const zones = options.zones ?? (options.placed ? siteZones(options.placed) : KEEP_OUT_ZONES);
  const { excludeId, checkPaths = true } = options;
  const clean = (p: [number, number]) =>
    clearsAll(p[0], p[1], clearance, zones, excludeId, checkPaths);

  // Already clean: no movement needed.
  if (clean([pos.x, pos.z])) return { x: pos.x, z: pos.z };

  const violated = zones.filter(
    (k) =>
      (!excludeId || k.id !== excludeId) && Math.hypot(pos.x - k.x, pos.z - k.z) < k.r + clearance
  );
  const candidates: [number, number][] = [];
  const keepClean = (p: [number, number]) => {
    if (clean(p)) candidates.push(p);
  };

  // A candidate that is still blocked gets one relaxation: off the path, then out of each circle.
  const tryCandidate = (p: [number, number]) => {
    if (clean(p)) {
      candidates.push(p);
      return;
    }
    if (checkPaths) pathExits(p[0], p[1], clearance).forEach(keepClean);
    for (const k of zones) {
      if (excludeId && k.id === excludeId) continue;
      if (Math.hypot(p[0] - k.x, p[1] - k.z) < k.r + clearance) {
        keepClean(radialOut(p[0], p[1], k, clearance));
      }
    }
  };

  // 1. Circle radial push-outs
  for (const k of violated) tryCandidate(radialOut(pos.x, pos.z, k, clearance));

  // 2. Pairwise circle intersections
  for (let i = 0; i < violated.length; i++) {
    for (let j = i + 1; j < violated.length; j++) {
      for (const p of circleIntersections(violated[i]!, violated[j]!, clearance)) {
        tryCandidate(p);
      }
    }
  }

  // 3. Path pushes (away from the centre line, then both normals)
  if (checkPaths) pathExits(pos.x, pos.z, clearance).forEach(tryCandidate);

  // 4. Fallback search if no candidate was completely clean
  if (candidates.length === 0) {
    for (let r = 0.2; r <= 10; r += 0.2) {
      for (let a = 0; a < 24; a++) {
        const theta = (a / 24) * 2 * Math.PI;
        const x = pos.x + Math.cos(theta) * r;
        const z = pos.z + Math.sin(theta) * r;
        if (clearsAll(x, z, clearance, zones, excludeId, checkPaths)) {
          candidates.push([x, z]);
          break;
        }
      }
      if (candidates.length > 0) break;
    }
  }

  // 5. Ultimate fallback if extreme edge
  if (candidates.length === 0) {
    if (violated.length > 0) {
      let deepest = violated[0]!;
      for (const k of violated) {
        if (
          k.r - Math.hypot(pos.x - k.x, pos.z - k.z) >
          deepest.r - Math.hypot(pos.x - deepest.x, pos.z - deepest.z)
        ) {
          deepest = k;
        }
      }
      const p = radialOut(pos.x, pos.z, deepest, clearance);
      return { x: p[0], z: p[1] };
    }
    return { x: pos.x, z: pos.z };
  }

  // 6. Nearest clean exit wins
  let best = candidates[0]!;
  let bestD = Math.hypot(best[0] - pos.x, best[1] - pos.z);
  for (const p of candidates) {
    const d = Math.hypot(p[0] - pos.x, p[1] - pos.z);
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  return { x: best[0], z: best[1] };
}

/**
 * Today's ring around the building (PP-T3 moves `applianceMarkers` onto this, so current markers
 * keep their place): k-th appliance of the sector sits on the outer side (away from the village
 * centre), rows of 5. `k` = index among the sector's appliances, 0-based.
 */
export function defaultPosition(sector: SectorId, k: number): [number, number, number] {
  const [bx, , bz] = SECTOR_POSITIONS[sector];
  const len = Math.hypot(bx, bz) || 1;
  const ox = bx / len;
  const oz = bz / len;
  const row = Math.floor(k / MARKERS_PER_ROW);
  const col = (k % MARKERS_PER_ROW) - (MARKERS_PER_ROW - 1) / 2;
  const out = MARKER_RING + row * MARKER_ROW;
  // Perpendicular (−oz, ox) spreads a row sideways.
  return [bx + ox * out - oz * col * MARKER_GAP, 0, bz + oz * out + ox * col * MARKER_GAP];
}

/**
 * Move an engine line to a map spot (PP-T5, PI-T3): normalized onto the terrain and out of footprints,
 * paths and other placed objects; the feeder follows the nearest building unless it was overridden.
 */
export function moveAppliance(
  line: Appliance,
  pos: AppliancePosition,
  options?: SnapOptions
): Appliance {
  const position = snapAwayFromBuildings(clampToTerrain(pos), PLACEMENT_CLEARANCE, options);
  const overridden = !!line.position && nearestSector(line.position) !== line.sector;
  return { ...line, position, sector: overridden ? line.sector : nearestSector(position) };
}

const dragRaycaster = new THREE.Raycaster();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const dragNdc = new THREE.Vector2();
const dragHit = new THREE.Vector3();

/**
 * Client pointer → map spot on the ground plane (PP-T5 drag math, pure). Null on a degenerate
 * rect or when the ray runs parallel to the ground. The marker re-grounds on commit.
 */
export function pointerToGround(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number; height: number },
  camera: THREE.Camera
): AppliancePosition | null {
  if (!(rect.width > 0 && rect.height > 0)) return null;
  dragNdc.set(
    ((clientX - rect.left) / rect.width) * 2 - 1,
    -(((clientY - rect.top) / rect.height) * 2 - 1)
  );
  dragRaycaster.setFromCamera(dragNdc, camera);
  if (!dragRaycaster.ray.intersectPlane(groundPlane, dragHit)) return null;
  return { x: dragHit.x, z: dragHit.z };
}
