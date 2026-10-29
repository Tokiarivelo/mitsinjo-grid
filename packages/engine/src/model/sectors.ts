import type { SectorConfig, SectorId, SimulationInput } from '../schemas';

/** A sector is connected unless its load multiplier is 0 (e.g. the factory before it is wired). */
export function isSectorConnected(sector: Pick<SectorConfig, 'loadMultiplier'>): boolean {
  return (sector.loadMultiplier ?? 1) > 0;
}

/** Connected sector configs, in input order: what coverage lists and metric rows show. */
export function connectedSectors(input: Pick<SimulationInput, 'sectors'>): SectorConfig[] {
  return input.sectors.filter(isSectorConnected);
}

/** Ids of the connected sectors, in input order. */
export function connectedSectorIds(input: Pick<SimulationInput, 'sectors'>): SectorId[] {
  return connectedSectors(input).map((s) => s.id);
}
