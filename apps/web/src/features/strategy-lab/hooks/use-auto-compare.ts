'use client';

import { useEffect } from 'react';
import { selectInput, selectStatus, useSimulationStore } from '@/stores';

export const AUTO_COMPARE_DELAY_MS = 300;

/**
 * Re-runs the strategy comparison shortly after the input was edited (status `modified`),
 * so slider drags coalesce into one engine run. Never runs for any other status.
 */
export function useAutoCompare(enabled = true, delayMs = AUTO_COMPARE_DELAY_MS) {
  const status = useSimulationStore(selectStatus);
  const input = useSimulationStore(selectInput);
  const run = useSimulationStore((s) => s.run);

  useEffect(() => {
    if (!enabled || status !== 'modified') return;
    const id = setTimeout(() => run(), delayMs);
    return () => clearTimeout(id);
  }, [enabled, status, input, run, delayMs]);
}
