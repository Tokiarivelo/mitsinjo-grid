'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  detectIncidents,
  decideDispatch,
  dispatchLogHash,
  DEFAULT_CONSTITUTION,
  simulate,
  type DispatchLogEntry,
  type Incident,
} from '@mitsinjo/engine';
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
 * AI Autonomous Dispatch orchestrator (PA-T3b) + Assisted Autopilot (M10):
 * - `manual`: operator only; no automatic actions or suggestions.
 * - `assisted`: rule-based suggestions on each new simulated hour; applies alone only within envelope.
 * - `autonomous`: pure engine detectors + decision policy on each new simulated hour; applies alone
 *   without human validation, logs detections and actions with engine figures before/after into `dispatchLog`.
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
  const lastProcessed = useRef<{ hour: number; day: number } | null>(null);

  // Autonomous mode loop: runs detectors and decision policy on each simulated hour
  useEffect(() => {
    if (dispatchMode !== 'autonomous') {
      return;
    }

    if (
      lastProcessed.current &&
      lastProcessed.current.hour === timeIndex &&
      lastProcessed.current.day === dayIndex
    ) {
      return;
    }
    lastProcessed.current = { hour: timeIndex, day: dayIndex };

    const state = useSimulationStore.getState();
    const { input, activeStrategy, results, workflowResults, appendDispatchLog } = state;

    // Get current simulation result for the active strategy
    const currentResult =
      results[activeStrategy] ??
      workflowResults[activeStrategy]?.days[dayIndex]?.result ??
      simulate(input, activeStrategy);

    // 1. Detect incidents
    const incidents = detectIncidents(input, currentResult, timeIndex, 3, dayIndex);
    if (incidents.length === 0) {
      return;
    }

    const newEntries: DispatchLogEntry[] = [];
    const timestamp = Date.now();

    // 2. Log detected incidents
    for (let i = 0; i < incidents.length; i++) {
      const inc = incidents[i]!;
      const incDraft = {
        id: `inc-d${dayIndex}-h${timeIndex}-${inc.kind}-${i}-${timestamp}`,
        day: dayIndex,
        hour: timeIndex,
        mode: 'autonomous' as const,
        origin: 'ai' as const,
        incident: inc,
      };
      newEntries.push({
        ...incDraft,
        hash: dispatchLogHash(incDraft),
      });
    }

    // 3. Decide dispatch action
    const currentHistory = state.dispatchLog;
    const decision = decideDispatch(
      input,
      timeIndex,
      activeStrategy,
      incidents,
      DEFAULT_CONSTITUTION,
      currentHistory,
      dayIndex
    );

    // 4. Apply action if decided
    if (decision.action) {
      if (decision.action.kind !== 'alert_only') {
        const actionId = `ai-${decision.action.kind}-d${dayIndex}-h${timeIndex}`;
        useSimulationStore
          .getState()
          .approveChange(actionId, decision.action.patch, decision.action.strategy);

        const actDraft = {
          id: `act-d${dayIndex}-h${timeIndex}-${decision.action.kind}-${timestamp}`,
          day: dayIndex,
          hour: timeIndex,
          mode: 'autonomous' as const,
          origin: 'ai' as const,
          action: decision.action,
          before: decision.before,
          after: decision.after,
        };
        newEntries.push({
          ...actDraft,
          hash: dispatchLogHash(actDraft),
        });
      } else {
        const alertDraft = {
          id: `act-d${dayIndex}-h${timeIndex}-alert-${timestamp}`,
          day: dayIndex,
          hour: timeIndex,
          mode: 'autonomous' as const,
          origin: 'ai' as const,
          action: decision.action,
        };
        newEntries.push({
          ...alertDraft,
          hash: dispatchLogHash(alertDraft),
        });
      }
    }

    // 5. Append all new entries to dispatchLog
    if (newEntries.length > 0) {
      appendDispatchLog(newEntries);
    }
  }, [dispatchMode, timeIndex, dayIndex]);

  // Assisted mode loop (M10 autopilot compatibility)
  useEffect(() => {
    if (dispatchMode !== 'assisted') {
      return;
    }

    if (
      lastProcessed.current &&
      lastProcessed.current.hour === timeIndex &&
      lastProcessed.current.day === dayIndex
    ) {
      return;
    }
    lastProcessed.current = { hour: timeIndex, day: dayIndex };

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

  // Reset lastProcessed ref when switching modes or when manual
  useEffect(() => {
    if (dispatchMode === 'manual') {
      lastProcessed.current = null;
    }
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

  const activeIncidents = useMemo((): Incident[] => {
    const { input, activeStrategy, results, workflowResults } = useSimulationStore.getState();
    const currentResult =
      results[activeStrategy] ??
      workflowResults[activeStrategy]?.days[dayIndex]?.result ??
      simulate(input, activeStrategy);
    return detectIncidents(input, currentResult, timeIndex, 3, dayIndex);
  }, [timeIndex, dayIndex]);

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
    activeIncidents,
  };
}

export { useAiDispatch as useAutopilot };
