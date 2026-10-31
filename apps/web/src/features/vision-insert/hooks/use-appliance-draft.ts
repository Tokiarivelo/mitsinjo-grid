'use client';

import { useCallback, useMemo, useState } from 'react';
import {
  applianceSummary,
  type Appliance,
  type ApplianceCategory,
  type SectorId,
} from '@mitsinjo/engine';
import type { ApplianceDetection } from '@/lib/vision';
import {
  aiDraft,
  clampWatts,
  fromAppliance,
  sameDraft,
  toAppliance,
  wattsRange,
  type ApplianceDraft,
} from '../utils/appliance-draft';

/** `ai` = AI category + engine catalog power · `manual` = the operator's values (still catalog-bounded). */
export type DraftSource = 'ai' | 'manual';

interface DraftState {
  key: string;
  draft: ApplianceDraft;
  source: DraftSource;
}

function initial(
  key: string,
  detection: ApplianceDetection,
  name: string,
  existing?: Appliance
): DraftState {
  const ai = aiDraft(detection, name);
  if (!existing) return { key, draft: ai, source: 'ai' };
  const draft = fromAppliance(existing);
  return { key, draft, source: sameDraft(draft, ai) ? 'ai' : 'manual' };
}

/**
 * Load line of the selected object before « Insert into simulation » (PV-T11). Starts from the AI estimate
 * (or the line already in the simulation); any edit switches to `manual`. `appliance` = engine-valid line
 * or null, `summary` = engine preview (peak kW, kWh per day). A new object starts a new draft.
 */
export function useApplianceDraft(
  id: string,
  detection: ApplianceDetection,
  name: string,
  existing?: Appliance
) {
  const key = `${id}|${existing ? 'in' : 'out'}`;
  const [state, setState] = useState<DraftState>(() => initial(key, detection, name, existing));
  // New object (or inserted / removed elsewhere): start again, without an effect round-trip.
  const current = state.key === key ? state : initial(key, detection, name, existing);
  if (current !== state) setState(current);

  const edit = useCallback(
    (change: (d: ApplianceDraft) => ApplianceDraft) =>
      setState((s) => ({ ...s, draft: change(s.draft), source: 'manual' })),
    []
  );

  const setName = useCallback((v: string) => edit((d) => ({ ...d, name: v })), [edit]);
  const setSector = useCallback((v: SectorId) => edit((d) => ({ ...d, sector: v })), [edit]);
  const setWatts = useCallback((v: number) => edit((d) => ({ ...d, watts: v })), [edit]);
  const setQuantity = useCallback((v: number) => edit((d) => ({ ...d, quantity: v })), [edit]);
  const setCategory = useCallback(
    (v: ApplianceCategory) => edit((d) => ({ ...d, category: v, watts: clampWatts(v, d.watts) })),
    [edit]
  );
  const applyAiEstimate = useCallback(
    () => setState((s) => ({ ...s, draft: aiDraft(detection, name), source: 'ai' })),
    [detection, name]
  );
  const setManual = useCallback(() => setState((s) => ({ ...s, source: 'manual' })), []);

  const appliance = useMemo(() => toAppliance(id, current.draft), [id, current.draft]);
  const summary = useMemo(() => (appliance ? applianceSummary(appliance) : null), [appliance]);

  return {
    draft: current.draft,
    source: current.source,
    range: wattsRange(current.draft.category),
    appliance,
    summary,
    setName,
    setCategory,
    setSector,
    setWatts,
    setQuantity,
    applyAiEstimate,
    setManual,
  };
}

export type ApplianceDraftState = ReturnType<typeof useApplianceDraft>;
