import {
  applianceProfileKw,
  SECTOR_IDS,
  type Appliance,
  type SectorId,
  type SimulationResult,
} from '@mitsinjo/engine';

/** One inserted appliance in the 3D village (PV-T13). kW values come from the engine profile. */
export interface ApplianceMarkerSceneModel {
  id: string;
  name: string;
  category: Appliance['category'];
  sector: SectorId;
  quantity: number;
  watts: number;
  /** Engine profile of this line at the shown hour (kW). */
  kwNow: number;
  /** Line draws power now and its sector is served: the marker glows. */
  running: boolean;
  position: [number, number, number];
}

/** Distance of the first marker row from the building centre, row and column spacing (scene units). */
export const MARKER_RING = 3.4;
export const MARKER_ROW = 0.75;
export const MARKER_GAP = 0.7;
export const MARKERS_PER_ROW = 5;
const RUNNING_KW = 1e-4;

/**
 * Markers sit on the outer side of their building (away from the controller in the middle, where the
 * cables come in), rows of 5 facing the centre. Pure: same input → same positions.
 */
export function applianceMarkers(
  appliances: readonly Appliance[] | undefined,
  positions: Record<SectorId, [number, number, number]>,
  timeIndex: number,
  result?: SimulationResult | null
): ApplianceMarkerSceneModel[] {
  if (!appliances?.length) return [];
  const t = Math.max(0, Math.min(23, Math.floor(timeIndex)));
  const step = result?.steps[t];
  const count: Partial<Record<SectorId, number>> = {};
  return appliances.map((a) => {
    const k = (count[a.sector] = (count[a.sector] ?? 0) + 1) - 1;
    const [bx, , bz] = positions[a.sector];
    const len = Math.hypot(bx, bz) || 1;
    const ox = bx / len;
    const oz = bz / len;
    const row = Math.floor(k / MARKERS_PER_ROW);
    const col = (k % MARKERS_PER_ROW) - (MARKERS_PER_ROW - 1) / 2;
    const out = MARKER_RING + row * MARKER_ROW;
    const kwNow = applianceProfileKw(a)[t] ?? 0;
    const served = (step?.sectors[a.sector]?.servedKw ?? 0) > 0.05;
    return {
      id: a.id,
      name: a.name,
      category: a.category,
      sector: a.sector,
      quantity: a.quantity,
      watts: a.watts,
      kwNow,
      running: served && kwNow > RUNNING_KW,
      // Perpendicular (−oz, ox) spreads a row sideways.
      position: [bx + ox * out - oz * col * MARKER_GAP, 0, bz + oz * out + ox * col * MARKER_GAP],
    };
  });
}

/** Inserted lines per sector (2D diagram chip, lists). */
export function appliancesPerSector(
  appliances: readonly Pick<Appliance, 'sector'>[] | undefined
): Record<SectorId, number> {
  const out = Object.fromEntries(SECTOR_IDS.map((id) => [id, 0])) as Record<SectorId, number>;
  for (const a of appliances ?? []) out[a.sector] += 1;
  return out;
}
