'use client';

import { useCallback } from 'react';
import type { Appliance } from '@mitsinjo/engine';
import { selectInput, useSimulationStore, usePlacedModelsStore } from '@/stores';
import { upsertAppliance } from '../utils/appliance-draft';

const NONE: readonly Appliance[] = [];

/**
 * Appliance lines in the simulation (PV-T12/T13). `upsert` / `remove` replace the whole list through
 * `applyProposal({ appliances })`: every strategy re-runs at once. `upsert` returns false when full.
 */
export function useSimulationAppliances() {
  const list = useSimulationStore((s) => selectInput(s).appliances ?? NONE);
  const applyProposal = useSimulationStore((s) => s.applyProposal);

  const upsert = useCallback(
    (line: Appliance) => {
      const next = upsertAppliance(useSimulationStore.getState().input.appliances ?? [], line);
      if (!next) return false;
      applyProposal({ appliances: next });
      return true;
    },
    [applyProposal]
  );
  const remove = useCallback(
    (id: string) => {
      usePlacedModelsStore.getState().remove(id);
      applyProposal({
        appliances: (useSimulationStore.getState().input.appliances ?? []).filter(
          (a) => a.id !== id
        ),
      });
    },
    [applyProposal]
  );

  return { list, upsert, remove };
}
