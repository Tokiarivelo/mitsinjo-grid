import {
  APPLIANCE_CATALOG,
  ApplianceSchema,
  MAX_APPLIANCES,
  type Appliance,
  type ApplianceCategory,
  type SectorId,
} from '@mitsinjo/engine';
import { isAppliance, type ApplianceDetection } from '@/lib/vision';

/**
 * Line the operator is about to insert (PV-T11). Power comes from the engine catalog (AI estimate) or
 * from the operator (manual), always inside the catalog bounds of the category. Never from a model.
 */
export interface ApplianceDraft {
  name: string;
  category: ApplianceCategory;
  sector: SectorId;
  watts: number;
  quantity: number;
}

export const MAX_QUANTITY = 50;
export const MAX_NAME = 40;
export { MAX_APPLIANCES };

/** Default sector for what the AI recognised (the operator can change it). */
const SECTOR_BY_CATEGORY: Partial<Record<ApplianceCategory, SectorId>> = {
  fridge_vaccine: 'health',
  water_pump: 'water',
  rice_mill: 'industry',
  welder: 'industry',
  sewing_machine: 'market',
  computer: 'school',
};
const SECTOR_BY_SCENERY: Partial<Record<NonNullable<ApplianceDetection['scenery']>, SectorId>> = {
  water: 'water',
  vehicle: 'market',
};

export function suggestSector(
  d: Pick<ApplianceDetection, 'kind' | 'category' | 'scenery'>
): SectorId {
  if (!isAppliance(d)) return SECTOR_BY_SCENERY[d.scenery ?? 'other'] ?? 'households';
  return SECTOR_BY_CATEGORY[d.category] ?? 'households';
}

/** Catalog bounds of a category (W, one unit). */
export const wattsRange = (category: ApplianceCategory) => {
  const { minW, maxW, defaultW } = APPLIANCE_CATALOG[category];
  return { minW, maxW, defaultW };
};

/** Watts kept inside the catalog bounds of the category; not a number → the catalog default. */
export function clampWatts(category: ApplianceCategory, watts: number): number {
  const { minW, maxW, defaultW } = wattsRange(category);
  if (!Number.isFinite(watts)) return defaultW;
  return Math.min(maxW, Math.max(minW, watts));
}

export const clampQuantity = (q: number) =>
  Number.isFinite(q) ? Math.min(MAX_QUANTITY, Math.max(1, Math.round(q))) : 1;

/** « AI estimate »: the category the AI recognised (scenery → `other`), catalog default power, 1 unit. */
export function aiDraft(
  d: Pick<ApplianceDetection, 'kind' | 'category' | 'scenery'>,
  name: string
): ApplianceDraft {
  const category: ApplianceCategory = isAppliance(d) ? d.category : 'other';
  return {
    name: name.trim().slice(0, MAX_NAME),
    category,
    sector: suggestSector(d),
    watts: wattsRange(category).defaultW,
    quantity: 1,
  };
}

/** Same values as the AI estimate (the badge shows « AI estimate » again). */
export const sameDraft = (a: ApplianceDraft, b: ApplianceDraft) =>
  a.name === b.name &&
  a.category === b.category &&
  a.sector === b.sector &&
  a.watts === b.watts &&
  a.quantity === b.quantity;

/** Draft → engine line, or null when the engine schema refuses it (empty name, bounds). */
export function toAppliance(id: string, draft: ApplianceDraft): Appliance | null {
  const parsed = ApplianceSchema.safeParse({ id, ...draft, name: draft.name.trim() });
  return parsed.success ? parsed.data : null;
}

/** Engine line → draft (reopening an object already in the simulation). */
export const fromAppliance = ({ name, category, sector, watts, quantity }: Appliance) => ({
  name,
  category,
  sector,
  watts,
  quantity,
});

/**
 * Short stable key of a photo (FNV-1a over its length and both ends), so appliance ids from two photos
 * never collide (detection ids restart at det-1) and a reload of the same photo finds its lines again.
 */
export function photoKey(url: string): string {
  const sample = `${url.length}|${url.slice(0, 4096)}|${url.slice(-4096)}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < sample.length; i++) {
    h ^= sample.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

/** Engine id of a photo object: `vision-<photo>-<detection>` (≤ 64 chars). */
export const applianceIdFor = (photo: string, detectionId: string) =>
  `vision-${photo}-${detectionId}`.slice(0, 64);

/** List with the line added or replaced (same id), never more than the engine maximum. */
export function upsertAppliance(list: readonly Appliance[], line: Appliance): Appliance[] | null {
  const others = list.filter((a) => a.id !== line.id);
  if (others.length >= MAX_APPLIANCES) return null;
  return [...others, line];
}
