import type { FireEvent, ScenarioEvent, SectorId, Workflow } from '@mitsinjo/engine';

/**
 * Events the engine applies on one workflow day: the input's events (every day) plus that
 * day's own events. The 3D scene, the fire alerts and the report button read the same list.
 */
export function dayEvents(
  base: readonly ScenarioEvent[] | undefined,
  workflow: Workflow,
  day: number
): ScenarioEvent[] {
  return [...(base ?? []), ...(workflow[day]?.events ?? [])];
}

/**
 * Fire reported on `day` at `hour` in a multi-day workflow: it burns from `hour` to midnight that
 * day, then all day on every later day, until the sector is restored (`clearWorkflowFires`).
 * Earlier days stay untouched. An input-level fire would replay from `hour` every day instead.
 */
export function reportWorkflowFire(
  workflow: Workflow,
  day: number,
  sector: SectorId,
  hour: number
): Workflow {
  return workflow.map((d, i) => {
    if (i < day) return d;
    const startHour = i === day ? hour : 0;
    const fire: FireEvent = { type: 'fire', sector, startHour, durationH: 24 - startHour };
    return { ...d, events: [...(d.events ?? []), fire] };
  });
}

/** Removes the fires of `sectors` from every workflow day (restore after a fire). */
export function clearWorkflowFires(workflow: Workflow, sectors: readonly SectorId[]): Workflow {
  if (sectors.length === 0) return workflow;
  const cleared = new Set(sectors);
  return workflow.map((d) => {
    if (!d.events?.some((e) => e.type === 'fire' && cleared.has(e.sector))) return d;
    const events = d.events.filter((e) => !(e.type === 'fire' && cleared.has(e.sector)));
    const { events: _drop, ...rest } = d;
    void _drop;
    return events.length > 0 ? { ...rest, events } : rest;
  });
}
