'use client';

import { useCallback } from 'react';
import type { AppliancePosition } from '@mitsinjo/engine';
import { useSimulationStore } from '@/stores';
import { moveAppliance } from '../utils/placement';

/**
 * Commit a marker drag (PP-T5): the line keeps its identity, takes the normalized spot, and the
 * feeder follows unless overridden (`moveAppliance`). Unknown ids are ignored (stale drag after
 * a remove). Undo = drag again, or the existing Remove/edit flow.
 */
export function useMoveMarker() {
  const applyProposal = useSimulationStore((s) => s.applyProposal);
  return useCallback(
    (id: string, pos: AppliancePosition) => {
      const list = useSimulationStore.getState().input.appliances ?? [];
      const line = list.find((a) => a.id === id);
      if (!line) return;
      applyProposal({ appliances: list.map((a) => (a.id === id ? moveAppliance(line, pos) : a)) });
    },
    [applyProposal]
  );
}
