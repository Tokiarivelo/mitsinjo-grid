import {
  activeFires,
  type FireEvent,
  type ScenarioEvent,
  type SectorId,
  type SimulationInput,
  type Workflow,
} from '@mitsinjo/engine';

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

/**
 * Midnight on the playback: every fire still burning at 23 h on `fromDay` keeps burning all day on
 * `toDay` (the next day, or the same one when a single day loops), until the sector is restored.
 * Single day: the input fire becomes 0–24 h. Several days: `toDay` (and the days after) get the fire.
 * Returns null when nothing burns at 23 h or it already burns from 0 h.
 */
export function carryFiresOver(
  input: SimulationInput,
  workflow: Workflow,
  fromDay: number,
  toDay: number
): { input: SimulationInput; workflow: Workflow } | null {
  const burning = new Set(
    activeFires(dayEvents(input.events, workflow, fromDay), 23).map((f) => f.sector)
  );
  const alreadyAtMidnight = new Set(
    activeFires(dayEvents(input.events, workflow, toDay), 0).map((f) => f.sector)
  );
  const sectors = [...burning].filter((s) => !alreadyAtMidnight.has(s));
  if (sectors.length === 0) return null;

  if (workflow.length <= 1) {
    const carried = new Set(sectors);
    const events: ScenarioEvent[] = input.events.filter(
      (e) => !(e.type === 'fire' && carried.has(e.sector))
    );
    for (const sector of sectors) {
      events.push({ type: 'fire', sector, startHour: 0, durationH: 24 });
    }
    return { input: { ...input, events }, workflow };
  }
  let next = workflow;
  for (const sector of sectors) next = reportWorkflowFire(next, toDay, sector, 0);
  return { input, workflow: next };
}
