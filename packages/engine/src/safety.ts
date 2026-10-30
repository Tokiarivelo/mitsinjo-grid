import type { ClinicGuardReason, InputPatch, SectorId } from './schemas';
import { SECTOR_OFF_KW } from './strategies/lifeline';

/** Sector that a patch must never silently cut (the clinic). */
export const PROTECTED_SECTOR: SectorId = 'health';

/**
 * Safety rule (K6), coded so the LLM cannot skip it: lists every way `patch` cuts the clinic or removes its
 * floor (`cap_zero` cap below the off threshold, `disconnected` load × 0, `floor_zero` floor 0 kW,
 * `lifeline_off` floors disabled for all). Empty array = safe. The UI shows a red warning and asks a second confirmation when not empty.
 */
export function clinicGuard(patch: InputPatch | undefined): ClinicGuardReason[] {
  if (!patch) return [];
  const reasons: ClinicGuardReason[] = [];
  if (patch.sectorCaps?.some((c) => c.sector === PROTECTED_SECTOR && c.maxKw < SECTOR_OFF_KW)) {
    reasons.push('cap_zero');
  }
  if (patch.sectorLoads?.[PROTECTED_SECTOR] === 0) reasons.push('disconnected');
  const floorKw = patch.lifeline?.kw?.[PROTECTED_SECTOR];
  if (floorKw !== undefined && floorKw < SECTOR_OFF_KW) reasons.push('floor_zero');
  if (patch.lifeline?.enabled === false) reasons.push('lifeline_off');
  return reasons;
}
