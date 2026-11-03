'use client';

import { useEffect, useRef } from 'react';
import {
  detectIncidents,
  decideDispatch,
  DEFAULT_CONSTITUTION,
  simulate,
  type DispatchLogEntry,
} from '@mitsinjo/engine';
import { sealLogEntry } from '@/lib/dispatch-log';
import { useSimulationStore } from '@/stores';

/**
 * Autonomous dispatch loop (PA-T3b): on each new simulated hour, runs the engine detectors and
 * decision policy, applies the action alone and logs it with engine figures before/after.
 * Mount it **once** per page (it writes to the store; two mounts would apply every action twice).
 */
export function useAutonomousDispatch(): void {
  const dispatchMode = useSimulationStore((s) => s.dispatchMode);
  const timeIndex = useSimulationStore((s) => s.timeIndex);
  const dayIndex = useSimulationStore((s) => s.dayIndex);
  /** Last (day, hour) decided: each hour is decided once. */
  const lastProcessed = useRef<string | null>(null);

  // Autonomous mode loop: runs detectors and decision policy on each simulated hour
  useEffect(() => {
    if (dispatchMode !== 'autonomous') return;
    const key = `autonomous:${dayIndex}:${timeIndex}`;
    if (lastProcessed.current === key) return;
    lastProcessed.current = key;

    const state = useSimulationStore.getState();
    const { input, activeStrategy } = state;
    const result = state.results[activeStrategy] ?? simulate(input, activeStrategy);

    const incidents = detectIncidents(input, result, timeIndex, 3, dayIndex);
    if (incidents.length === 0) return;

    const stamp = Date.now();
    const base = {
      day: dayIndex,
      hour: timeIndex,
      mode: 'autonomous' as const,
      origin: 'ai' as const,
    };
    const newEntries: DispatchLogEntry[] = incidents.map((incident, i) =>
      sealLogEntry({
        ...base,
        id: `inc-d${dayIndex}-h${timeIndex}-${incident.kind}-${i}-${stamp}`,
        incident,
      })
    );

    const decision = decideDispatch(
      input,
      timeIndex,
      activeStrategy,
      incidents,
      DEFAULT_CONSTITUTION,
      state.dispatchLog,
      dayIndex
    );
    const { action } = decision;
    if (action) {
      const applies = action.kind !== 'alert_only';
      if (applies) {
        state.approveChange(
          `ai-${action.kind}-d${dayIndex}-h${timeIndex}`,
          action.patch,
          action.strategy
        );
      }
      newEntries.push(
        sealLogEntry({
          ...base,
          id: `act-d${dayIndex}-h${timeIndex}-${action.kind}-${stamp}`,
          action,
          ...(applies ? { before: decision.before, after: decision.after } : {}),
        })
      );
    }
    state.appendDispatchLog(newEntries);
  }, [dispatchMode, timeIndex, dayIndex]);
  // Back to manual: the next autonomous run starts fresh on the current hour.
  useEffect(() => {
    if (dispatchMode !== 'autonomous') lastProcessed.current = null;
  }, [dispatchMode]);
}
