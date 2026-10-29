import { DEFAULT_LIFELINE_KW, EPS } from '../constants';
import type { SectorDemandStep } from '../model/demand';
import type { SectorCap, SectorId, SectorMode } from '../schemas';

/**
 * Computes sector operational mode based on served power, demand, and lifeline floor (PL-T3):
 * - 'off': served < 0.05 kW
 * - 'full': served >= demand - EPS
 * - 'lifeline': served <= floor + EPS
 * - 'limited': served > floor + EPS and served < demand - EPS
 */
export function computeSectorMode(servedKw: number, demandKw: number, floorKw: number): SectorMode {
  if (servedKw < 0.05) {
    return 'off';
  }
  if (servedKw >= demandKw - EPS) {
    return 'full';
  }
  if (servedKw <= floorKw + EPS) {
    return 'lifeline';
  }
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
 * - Guarantees baseline survival power (lighting, phone charging, clinic, water pump).
 * - Caps are strictly enforced: if cap < floor, cap wins.
 * - Emergency mode (dispo < Σ planchers):
 *   (a) health & water receive equal shares: min(dispo / 2, plancher_s, demand_s), surplus to the other.
 *   (b) remainder goes to other sectors proportional to their planchers; otherwise 0 kW (mode 'off').
 */
export function computeLifelinePass(
  availableKw: number,
  sectors: readonly SectorDemandStep[],
  activeCaps?: readonly SectorCap[]
): LifelinePassResult {
  const capsMap = new Map<SectorId, number>();
  if (activeCaps && activeCaps.length > 0) {
    for (const c of activeCaps) {
      const existing = capsMap.get(c.sector);
      capsMap.set(c.sector, existing !== undefined ? Math.min(existing, c.maxKw) : c.maxKw);
    }
  }

  const effectiveFloors = {} as Record<SectorId, number>;
  const targets = {} as Record<SectorId, number>;
  let totalPlanchers = 0;

  for (const s of sectors) {
    const rawFloor = s.lifelineKw ?? DEFAULT_LIFELINE_KW[s.sectorId];
    const cap = capsMap.get(s.sectorId);
    const effFloor = cap !== undefined ? Math.min(rawFloor, cap) : rawFloor;
    effectiveFloors[s.sectorId] = effFloor;
    const target = Math.min(s.demandKw, effFloor);
    targets[s.sectorId] = target;
    totalPlanchers += target;
  }

  const allocations = {} as Record<SectorId, number>;

  // Case 1: Normal mode — available covers all lifeline floors
  if (availableKw >= totalPlanchers - EPS) {
    for (const s of sectors) {
      allocations[s.sectorId] = targets[s.sectorId]!;
    }
    return {
      allocations,
      effectiveFloors,
      remainingKw: Math.max(0, availableKw - totalPlanchers),
      isEmergency: false,
    };
  }

  // Case 2: Emergency mode (mode secours) — available < Σ planchers
  const dispo = Math.max(0, availableKw);
  const targetHealth = targets.health ?? 0;
  const targetWater = targets.water ?? 0;

  // (a) Health and water at equal share
  const half = dispo / 2;
  let allocHealth = Math.min(half, targetHealth);
  let allocWater = Math.min(half, targetWater);
  let used = allocHealth + allocWater;
  let surplus = Math.max(0, dispo - used);

  if (surplus > EPS) {
    const headroomHealth = Math.max(0, targetHealth - allocHealth);
    const addHealth = Math.min(surplus, headroomHealth);
    allocHealth += addHealth;
    surplus = Math.max(0, surplus - addHealth);

    const headroomWater = Math.max(0, targetWater - allocWater);
    const addWater = Math.min(surplus, headroomWater);
    allocWater += addWater;
    surplus = Math.max(0, surplus - addWater);
  }

  allocations.health = allocHealth;
  allocations.water = allocWater;

  // (b) Remaining energy goes to other sectors proportional to their planchers
  const otherSectors: SectorId[] = ['school', 'households', 'market'];
  let sumOthersTargets = 0;
  for (const sec of otherSectors) {
    sumOthersTargets += targets[sec] ?? 0;
  }

  if (surplus > EPS && sumOthersTargets > EPS) {
    for (const sec of otherSectors) {
      const tgt = targets[sec] ?? 0;
      const share = surplus * (tgt / sumOthersTargets);
      allocations[sec] = Math.min(tgt, share);
    }
  } else {
    for (const sec of otherSectors) {
      allocations[sec] = 0;
    }
  }

  return {
    allocations,
    effectiveFloors,
    remainingKw: 0,
    isEmergency: true,
  };
}
