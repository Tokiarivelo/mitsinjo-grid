'use client';

import { useCallback, useMemo } from 'react';
import { isSectorConnected, type SectorId } from '@mitsinjo/engine';
import { selectInput, useSimulationStore } from '@/stores';

/** Slider bounds of a sector load (engine accepts × 0–3; 0 = not connected). */
export const SECTOR_LOAD_MIN = 0;
export const SECTOR_LOAD_MAX = 3;
export const SECTOR_LOAD_STEP = 0.1;

export interface SectorLoadRow {
  id: SectorId;
  /** Load multiplier from the input (default 1). */
  load: number;
  connected: boolean;
}

/**
 * Live sector loads. Each change patches the input and re-runs the engine at once
 * (`applyProposal`): 3D, metrics and charts follow while the timeline keeps playing.
 */
export function useSectorLoads() {
  const input = useSimulationStore(selectInput);
  const applyProposal = useSimulationStore((s) => s.applyProposal);

  const rows = useMemo<SectorLoadRow[]>(
    () =>
      input.sectors.map((s) => ({
        id: s.id,
        load: s.loadMultiplier ?? 1,
        connected: isSectorConnected(s),
      })),
    [input]
  );

  const setLoad = useCallback(
    (id: SectorId, load: number) => {
      const clamped = Math.max(SECTOR_LOAD_MIN, Math.min(SECTOR_LOAD_MAX, load));
      // Round to the slider step so float noise never reaches the engine or the hash.
      const value = Math.round(clamped / SECTOR_LOAD_STEP) * SECTOR_LOAD_STEP;
      applyProposal({ sectorLoads: { [id]: Number(value.toFixed(2)) } });
    },
    [applyProposal]
  );

  return { rows, setLoad };
}
