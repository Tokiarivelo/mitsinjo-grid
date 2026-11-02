import { useEffect, useRef, useState } from 'react';
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
 * Rule-based autopilot (M10-T1) with autonomy envelope (M10-T3): while enabled, each new
 * simulated hour gets at most one protective suggestion. In-envelope suggestions apply alone;
 * the envelope is off by default, and only new hours are decided (a pending suggestion never
 * flips to auto when the envelope opens later).
 */
export function useAutopilot() {
  const [enabled, setEnabled] = useState(false);
  const [envelope, setEnvelope] = useState<AutonomyEnvelope>(ENVELOPE_OFF);
  const [entries, setEntries] = useState<AutopilotEntry[]>([]);
  const timeIndex = useSimulationStore((s) => s.timeIndex);
  const lastHour = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) {
      lastHour.current = null;
      return;
    }
    if (lastHour.current === timeIndex) return;
    lastHour.current = timeIndex;
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
  }, [enabled, timeIndex, envelope]);

  const accept = (id: string) => {
    const entry = entries.find((e) => e.id === id);
    if (!entry || entry.decision !== 'pending') return;
    useSimulationStore
      .getState()
      .approveChange(`autopilot-${id}`, entry.suggestion.patch, entry.suggestion.strategy);
    setEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, decision: 'accepted' as const } : e))
    );
  };

  const refuse = (id: string) => {
    setEntries((prev) =>
      prev.map((e) =>
        e.id === id && e.decision === 'pending' ? { ...e, decision: 'refused' as const } : e
      )
    );
  };

  return {
    enabled,
    setEnabled,
    envelope,
    setEnvelope,
    pending: entries.find((e) => e.decision === 'pending') ?? null,
    history: entries,
    accept,
    refuse,
  };
}
