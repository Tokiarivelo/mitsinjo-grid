import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { activeFires, type SectorId } from '@mitsinjo/engine';
import { useSimulationStore } from '@/stores';

/** How long a fire snackbar stays before it hides itself (the banner stays while the fire lasts). */
export const FIRE_SNACKBAR_MS = 10_000;

/** A fire burning at the hour shown in the app. */
export interface FireAlert {
  /** `sector:startHour`, stable while the fire lasts. */
  key: string;
  sector: SectorId;
  startHour: number;
}

/** Fires burning at the hour shown in the app (engine `activeFires`), one per sector. */
export function useActiveFires(): FireAlert[] {
  const events = useSimulationStore((s) => s.input.events);
  const timeIndex = useSimulationStore((s) => s.timeIndex);
  return useMemo(() => {
    const seen = new Set<SectorId>();
    const out: FireAlert[] = [];
    for (const f of activeFires(events, timeIndex)) {
      if (seen.has(f.sector)) continue;
      seen.add(f.sector);
      out.push({ key: `${f.sector}:${f.startHour}`, sector: f.sector, startHour: f.startHour });
    }
    return out;
  }, [events, timeIndex]);
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
