import { SectorCapSchema, type SectorCap, type SectorId } from '@mitsinjo/engine';

/** Cap proposed when the user turns a sector limit on (evening peak window). */
export const DEFAULT_CAP: Omit<SectorCap, 'sector'> = { maxKw: 1, fromHour: 18, toHour: 22 };

/** i18n key under `strategies.params.errors`. */
export type SectorCapError = 'outOfRange' | 'capHoursOrder';

/** Validates one cap against the engine schema. Returns null when valid. */
export function validateSectorCap(cap: SectorCap): SectorCapError | null {
  const parsed = SectorCapSchema.safeParse(cap);
  if (parsed.success) return null;
  const orderOnly = parsed.error.issues.every((i) => i.code === 'custom');
  return orderOnly ? 'capHoursOrder' : 'outOfRange';
}

/**
 * Replaces the caps of one sector (one cap per sector in this editor), keeping the others.
 * `cap = null` removes the sector's limit. Never mutates `caps`.
 */
export function withSectorCap(
  caps: readonly SectorCap[] | undefined,
  sector: SectorId,
  cap: Omit<SectorCap, 'sector'> | null
): SectorCap[] {
  const others = (caps ?? []).filter((c) => c.sector !== sector);
  return cap ? [...others, { sector, ...cap }] : others;
}
