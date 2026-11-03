'use client';

import { useCallback } from 'react';
import type { AppliancePosition } from '@mitsinjo/engine';
import { useSimulationStore } from '@/stores';
import { moveAppliance } from '../utils/placement';
import { readSiteZones } from './use-site-zones';

/**
 * Commit a marker drag (PP-T5): the line keeps its identity, takes the normalized spot, and the
 * feeder follows unless overridden (`moveAppliance`). Unknown ids are ignored (stale drag after
 * a remove). Placed objects push each other away (PI-T3). Undo = drag again, or the existing Remove/edit flow.
 */
export function useMoveMarker() {
  const applyProposal = useSimulationStore((s) => s.applyProposal);
  return useCallback(
    (id: string, pos: AppliancePosition) => {
      const list = useSimulationStore.getState().input.appliances ?? [];
      const line = list.find((a) => a.id === id);
      if (!line) return;
      const moved = moveAppliance(line, pos, { zones: readSiteZones(), excludeId: id });
      applyProposal({ appliances: list.map((a) => (a.id === id ? moved : a)) });
    },
    [applyProposal]
  );
}
