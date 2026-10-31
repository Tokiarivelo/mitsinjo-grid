import type { FireEvent, ScenarioEvent, SectorCap, SimulationInput } from './schemas';

function isFire(e: ScenarioEvent): e is FireEvent {
  return e.type === 'fire';
}

/** Fire events of a scenario, in input order. */
export function fireEvents(events: readonly ScenarioEvent[]): FireEvent[] {
  return events.filter(isFire);
}

/** Fires burning at hour t (startHour ≤ t < startHour + durationH). */
export function activeFires(events: readonly ScenarioEvent[], t: number): FireEvent[] {
  return fireEvents(events).filter((f) => t >= f.startHour && t < f.startHour + f.durationH);
}

/**
 * Sector caps the engine applies: the operator's caps plus one 0 kW cap per fire (F1).
 * Caps combine by minimum, so a fire wins over any cap, and the cap-aware lifeline floor drops to 0.
 */
export function effectiveSectorCaps(
  input: Pick<SimulationInput, 'sectorCaps' | 'events'>
): SectorCap[] | undefined {
  const fires = fireEvents(input.events);
  if (fires.length === 0) return input.sectorCaps;
  return [
    ...(input.sectorCaps ?? []),
    ...fires.map((f) => ({
      sector: f.sector,
      maxKw: 0,
      fromHour: f.startHour,
      toHour: f.startHour + f.durationH,
    })),
  ];
}
