import * as THREE from 'three';
import {
  SECTOR_IDS,
  type Appliance,
  type AppliancePosition,
  type SectorId,
} from '@mitsinjo/engine';
import { KEEP_OUT_ZONES, TERRAIN_RADIUS } from './landscape';
import { SECTOR_POSITIONS } from './site-positions';

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

/** True when (x, z) clears every keep-out circle by `clearance` (1e-9 under for float noise). */
function clearsAll(x: number, z: number, clearance: number): boolean {
  return KEEP_OUT_ZONES.every((k) => Math.hypot(x - k.x, z - k.z) >= k.r + clearance - 1e-9);
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
 * Push a map position out of every keep-out circle (buildings, pads, pond): no marker inside a
 * footprint. Nearest clean exit wins: radial push-outs first, then pairwise circle intersections
 * (a radial push lands back inside a neighbour where clearings overlap). Deterministic and pure.
 */
export function snapAwayFromBuildings(
  pos: AppliancePosition,
  clearance = PLACEMENT_CLEARANCE
): AppliancePosition {
  const violated = KEEP_OUT_ZONES.filter(
    (k) => Math.hypot(pos.x - k.x, pos.z - k.z) < k.r + clearance
  );
  if (violated.length === 0) return { x: pos.x, z: pos.z };
  const candidates: [number, number][] = [];
  for (const k of violated) {
    const p = radialOut(pos.x, pos.z, k, clearance);
    if (clearsAll(p[0], p[1], clearance)) candidates.push(p);
  }
  for (let i = 0; i < violated.length; i++) {
    for (let j = i + 1; j < violated.length; j++) {
      for (const p of circleIntersections(violated[i]!, violated[j]!, clearance)) {
        if (clearsAll(p[0], p[1], clearance)) candidates.push(p);
      }
    }
  }
  if (candidates.length === 0) {
    // Triple overlap with no clean exit (not on our map): deepest single push, best effort.
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
 * Move an engine line to a map spot (PP-T5): normalized onto the terrain and out of footprints;
 * the feeder follows the nearest building unless it was overridden (same rule as the insert
 * draft: overridden ⟺ a set position whose nearest is not the line's sector).
 */
export function moveAppliance(line: Appliance, pos: AppliancePosition): Appliance {
  const position = snapAwayFromBuildings(clampToTerrain(pos));
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
