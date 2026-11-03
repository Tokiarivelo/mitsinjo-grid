import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { activeFires, type SectorId } from '@mitsinjo/engine';
import { criticalSectorIncidents } from '@/lib/dispatch-log';
import { useSimulationStore } from '@/stores';
import { dayEvents } from '@/lib/day-events';

/** How long a fire snackbar stays before it hides itself (the banner stays while the fire lasts). */
export const FIRE_SNACKBAR_MS = 10_000;

/** A fire burning or critical incident at the hour shown in the app. */
export interface FireAlert {
  /** `fire:sector` (or `kind:sector:hour`), stable while the alert lasts. */
  key: string;
  sector: SectorId;
  startHour: number;
  kind?: string;
}

/** Fires and critical incidents active at the shown hour (PA-T4c), one per sector. */
export function useActiveFires(): FireAlert[] {
  const baseEvents = useSimulationStore((s) => s.input.events);
  const workflow = useSimulationStore((s) => s.workflow);
  const timeIndex = useSimulationStore((s) => s.timeIndex);
  const input = useSimulationStore((s) => s.input);
  const results = useSimulationStore((s) => s.results);
  const activeStrategy = useSimulationStore((s) => s.activeStrategy);
  const dayIndex = useSimulationStore((s) => s.dayIndex);

  return useMemo(() => {
    const seen = new Set<SectorId>();
    const out: FireAlert[] = [];
    // Fires of the day shown (a multi-day run keeps reported fires on its days).
    const events = dayEvents(baseEvents, workflow, dayIndex);

    // 1. Active fires (engine activeFires)
    for (const f of activeFires(events, timeIndex)) {
      if (seen.has(f.sector)) continue;
      seen.add(f.sector);
      out.push({
        // One fire per sector at a time: stable across midnight on a multi-day run.
        key: `fire:${f.sector}`,
        sector: f.sector,
        startHour: f.startHour,
        kind: 'fire',
      });
    }

    // 2. Critical forecast / other critical incidents (PA-T4c)
    const result = results[activeStrategy];
    if (result) {
      for (const inc of criticalSectorIncidents(input, result, timeIndex, dayIndex)) {
        if (!seen.has(inc.sector)) {
          seen.add(inc.sector);
          out.push({
            key: `${inc.kind}:${inc.sector}:${inc.hour}`,
            sector: inc.sector,
            startHour: inc.hour,
            kind: inc.kind,
          });
        }
      }
    }

    return out;
  }, [baseEvents, workflow, timeIndex, input, results, activeStrategy, dayIndex]);
}

/**
 * Snackbars for fires that just started burning (reported now, or reached on the timeline).
 * Each one shows once per fire, hides after FIRE_SNACKBAR_MS or when dismissed, and goes when the fire ends.
 */
export function useFireSnackbars(fires: readonly FireAlert[]) {
  const [shown, setShown] = useState<FireAlert[]>([]);
  const notified = useRef(new Set<string>());
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((key: string) => {
    const timer = timers.current.get(key);
    if (timer) clearTimeout(timer);
    timers.current.delete(key);
    setShown((prev) => prev.filter((s) => s.key !== key));
  }, []);

  useEffect(() => {
    const live = new Set(fires.map((f) => f.key));
    // A fire that ended (or was scrubbed back before its start) may notify again later.
    for (const key of notified.current) {
      if (!live.has(key)) {
        notified.current.delete(key);
        dismiss(key);
      }
    }
    const fresh = fires.filter((f) => !notified.current.has(f.key));
    if (fresh.length === 0) return;
    for (const f of fresh) {
      notified.current.add(f.key);
      timers.current.set(
        f.key,
        setTimeout(() => dismiss(f.key), FIRE_SNACKBAR_MS)
      );
    }
    setShown((prev) => [...prev, ...fresh]);
  }, [fires, dismiss]);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  return { snackbars: shown, dismiss };
}
