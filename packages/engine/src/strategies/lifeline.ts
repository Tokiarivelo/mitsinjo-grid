import { DEFAULT_LIFELINE_KW, EPS, HORIZON_H } from '../constants';
import type { SectorDemandStep } from '../model/demand';
import type { SectorCap, SectorConfig, SectorId, SectorMode, SectorStep } from '../schemas';

/** Below this, a sector counts as without power (`mode = 'off'`). */
export const SECTOR_OFF_KW = 0.05;

/** Sectors kept alive first, at equal share, when energy is below Σ lifeline floors. */
export const EMERGENCY_SECTORS: readonly SectorId[] = ['health', 'water'];

/** Sector step as produced by a base strategy, before the lifeline fields are added. */
export type BaseSectorStep = Omit<SectorStep, 'lifelineServedKw' | 'mode'>;

/** Configured lifeline floor of a sector (kW), falling back to the default. */
export function resolveLifelineKw(sectorId: SectorId, lifelineKw?: number): number {
  return lifelineKw ?? DEFAULT_LIFELINE_KW[sectorId];
}

/**
 * Sector → cap (kW), keeping the lowest when several apply. With `t`, only caps active at hour t
 * (`fromHour ≤ t < toHour`) count; without it, every cap given counts.
 */
export function buildCapMap(
  caps: readonly SectorCap[] | undefined,
  t?: number
): Map<SectorId, number> {
  const map = new Map<SectorId, number>();
  for (const c of caps ?? []) {
    if (t !== undefined && (t < c.fromHour || t >= c.toHour)) continue;
    const existing = map.get(c.sector);
    map.set(c.sector, existing !== undefined ? Math.min(existing, c.maxKw) : c.maxKw);
  }
  return map;
}

/** Lifeline floor once a sector cap applies: the cap wins when it is lower. */
export function effectiveFloorKw(floorKw: number, capKw: number | undefined): number {
  return capKw !== undefined ? Math.min(floorKw, capKw) : floorKw;
}

/** Effective (cap-aware) lifeline floor of every configured sector at hour t. */
export function lifelineFloorsAt(
  sectors: readonly Pick<SectorConfig, 'id' | 'lifelineKw'>[],
  sectorCaps: readonly SectorCap[] | undefined,
  t: number
): Partial<Record<SectorId, number>> {
  const caps = buildCapMap(sectorCaps, t);
  const floors: Partial<Record<SectorId, number>> = {};
  for (const s of sectors) {
    floors[s.id] = effectiveFloorKw(resolveLifelineKw(s.id, s.lifelineKw), caps.get(s.id));
  }
  return floors;
}

/** Lifeline floors by hour (index = t). Hours without an active cap share one object. */
export type LifelineFloorsByHour = readonly Partial<Record<SectorId, number>>[];

/** `lifelineFloorsAt` for every hour of the horizon, computed once per simulation. */
export function lifelineFloorsByHour(
  sectors: readonly Pick<SectorConfig, 'id' | 'lifelineKw'>[],
  sectorCaps: readonly SectorCap[] | undefined,
  hours: number = HORIZON_H
): LifelineFloorsByHour {
  const uncapped = lifelineFloorsAt(sectors, undefined, 0);
  const out = new Array<Partial<Record<SectorId, number>>>(hours);
  for (let t = 0; t < hours; t++) {
    const capped = sectorCaps?.some((c) => t >= c.fromHour && t < c.toHour) ?? false;
    out[t] = capped ? lifelineFloorsAt(sectors, sectorCaps, t) : uncapped;
  }
  return out;
}

/**
 * Sector operating mode (PL-T3):
 * - 'full': the demand is fully served (demand > ε);
 * - 'off': served < 0.05 kW (no power, or no load);
 * - 'lifeline': served ≤ floor + ε;
 * - 'limited': between the floor and the demand.
 */
export function computeSectorMode(servedKw: number, demandKw: number, floorKw: number): SectorMode {
  if (demandKw > EPS && servedKw >= demandKw - EPS) return 'full';
  if (servedKw < SECTOR_OFF_KW) return 'off';
  if (servedKw <= floorKw + EPS) return 'lifeline';
  return 'limited';
}

export interface LifelinePassResult {
  allocations: Record<SectorId, number>;
  effectiveFloors: Record<SectorId, number>;
  remainingKw: number;
  isEmergency: boolean;
}

/**
 * Common Pass 0 across strategies (PL-T2):
 * - Normal mode (dispo ≥ Σ floors): each sector gets min(demand_s, floor_s); the rest is returned.
 * - Caps win over floors (floor_s = min(floor_s, cap_s)).
 * - Emergency mode (dispo < Σ floors):
 *   (a) health & water at equal share: min(dispo / 2, floor_s, demand_s), surplus to the other;
 *   (b) what is left goes to the other sectors pro rata of their floors; otherwise they get 0 kW.
 */
export function computeLifelinePass(
  availableKw: number,
  sectors: readonly SectorDemandStep[],
  activeCaps?: readonly SectorCap[]
): LifelinePassResult {
  const capsMap = buildCapMap(activeCaps);
  const effectiveFloors = {} as Record<SectorId, number>;
  const targets = {} as Record<SectorId, number>;
  let totalFloors = 0;

  for (const s of sectors) {
    const effFloor = effectiveFloorKw(
      resolveLifelineKw(s.sectorId, s.lifelineKw),
      capsMap.get(s.sectorId)
    );
    effectiveFloors[s.sectorId] = effFloor;
    const target = Math.min(s.demandKw, effFloor);
    targets[s.sectorId] = target;
    totalFloors += target;
  }

  const allocations = {} as Record<SectorId, number>;

  if (availableKw >= totalFloors - EPS) {
    for (const s of sectors) {
      allocations[s.sectorId] = targets[s.sectorId]!;
    }
    return {
      allocations,
      effectiveFloors,
      remainingKw: Math.max(0, availableKw - totalFloors),
      isEmergency: false,
    };
  }

  // Emergency mode (mode secours)
  const dispo = Math.max(0, availableKw);
  const [first, second] = EMERGENCY_SECTORS as [SectorId, SectorId];
  const targetFirst = targets[first] ?? 0;
  const targetSecond = targets[second] ?? 0;

  // (a) Equal share, then surplus to the one still below its floor
  const half = dispo / 2;
  let allocFirst = Math.min(half, targetFirst);
  let allocSecond = Math.min(half, targetSecond);
  let surplus = Math.max(0, dispo - allocFirst - allocSecond);
  if (surplus > EPS) {
    const addFirst = Math.min(surplus, Math.max(0, targetFirst - allocFirst));
    allocFirst += addFirst;
    surplus -= addFirst;
    const addSecond = Math.min(surplus, Math.max(0, targetSecond - allocSecond));
    allocSecond += addSecond;
    surplus -= addSecond;
  }
  allocations[first] = allocFirst;
  allocations[second] = allocSecond;

  // (b) Remainder to the other sectors, pro rata of their floors
  const others = sectors.filter((s) => !EMERGENCY_SECTORS.includes(s.sectorId));
  let sumOthers = 0;
  for (const s of others) sumOthers += targets[s.sectorId] ?? 0;
  for (const s of others) {
    const tgt = targets[s.sectorId] ?? 0;
    allocations[s.sectorId] =
      surplus > EPS && sumOthers > EPS ? Math.min(tgt, surplus * (tgt / sumOthers)) : 0;
  }

  return { allocations, effectiveFloors, remainingKw: 0, isEmergency: true };
}
