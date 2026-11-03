'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { autopilotProposal, type AutopilotSuggestion } from '@/lib/autopilot';
import { ENVELOPE_OFF, withinEnvelope, type AutonomyEnvelope } from '@/lib/envelope';
import { useSimulationStore } from '@/stores';

export type AutopilotDecision = 'pending' | 'accepted' | 'refused' | 'expired';

export interface AutopilotEntry {
  id: string;
  hour: number;
  suggestion: AutopilotSuggestion;
  decision: AutopilotDecision;
  /** True when the change applied alone under the autonomy envelope (no tap). */
  auto: boolean;
}

const HISTORY_MAX = 20;

/**
 * Dispatch mode state + Assisted Autopilot (M10). The autonomous loop lives in
 * `useAutonomousDispatch`, mounted once per page so it never runs twice:
 * - `manual`: operator only; no automatic actions or suggestions.
 * - `assisted`: rule-based suggestions on each new simulated hour; applies alone only within envelope.
 * - `autonomous`: handled by `useAutonomousDispatch` (detectors + policy, logged in `dispatchLog`).
 */
export function useAiDispatch() {
  const dispatchMode = useSimulationStore((s) => s.dispatchMode);
  const setDispatchMode = useSimulationStore((s) => s.setDispatchMode);
  const takeBackControl = useSimulationStore((s) => s.takeBackControl);
  const timeIndex = useSimulationStore((s) => s.timeIndex);
  const dayIndex = useSimulationStore((s) => s.dayIndex);
  const dispatchLog = useSimulationStore((s) => s.dispatchLog);

  const [envelope, setEnvelope] = useState<AutonomyEnvelope>(ENVELOPE_OFF);
  const [entries, setEntries] = useState<AutopilotEntry[]>([]);
  /** Last (mode, day, hour) decided: each mode decides a given hour once. */
  const lastProcessed = useRef<string | null>(null);

  // Assisted mode loop (M10 autopilot compatibility)
  useEffect(() => {
    if (dispatchMode !== 'assisted') return;
    const key = `assisted:${dayIndex}:${timeIndex}`;
    if (lastProcessed.current === key) return;
    lastProcessed.current = key;

    const { input, activeStrategy } = useSimulationStore.getState();
    const suggestion = autopilotProposal(input, timeIndex, activeStrategy);
    const auto = suggestion !== null && withinEnvelope(envelope, suggestion);
    if (auto && suggestion) {
      useSimulationStore
        .getState()
        .approveChange(`autopilot-auto-h${timeIndex}`, suggestion.patch, suggestion.strategy);
    }
    setEntries((prev) => {
      const settled = prev.map((e) =>
        e.decision === 'pending' ? { ...e, decision: 'expired' as const } : e
      );
      if (!suggestion) return settled;
      return [
        ...settled,
        {
          id: `h${timeIndex}-${Date.now()}`,
          hour: timeIndex,
          suggestion,
          decision: auto ? ('accepted' as const) : ('pending' as const),
          auto,
        },
      ].slice(-HISTORY_MAX);
    });
  }, [dispatchMode, timeIndex, dayIndex, envelope]);

  // Back to manual: the next mode starts fresh on the current hour.
  useEffect(() => {
    if (dispatchMode === 'manual') lastProcessed.current = null;
  }, [dispatchMode]);

  const accept = useCallback(
    (id: string) => {
      const entry = entries.find((e) => e.id === id);
      if (!entry || entry.decision !== 'pending') return;
      useSimulationStore
        .getState()
        .approveChange(`autopilot-${id}`, entry.suggestion.patch, entry.suggestion.strategy);
      setEntries((prev) =>
        prev.map((e) => (e.id === id ? { ...e, decision: 'accepted' as const } : e))
      );
    },
    [entries]
  );

  const refuse = useCallback((id: string) => {
    setEntries((prev) =>
      prev.map((e) =>
        e.id === id && e.decision === 'pending' ? { ...e, decision: 'refused' as const } : e
      )
    );
  }, []);

  return {
    dispatchMode,
    setDispatchMode,
    takeBackControl,
    // Autopilot compatibility
    enabled: dispatchMode === 'assisted',
    setEnabled: (val: boolean) => setDispatchMode(val ? 'assisted' : 'manual'),
    envelope,
    setEnvelope,
    pending: entries.find((e) => e.decision === 'pending') ?? null,
    history: entries,
    accept,
    refuse,
    // Autonomous information
    dispatchLog,
  };
}

export { useAiDispatch as useAutopilot };
