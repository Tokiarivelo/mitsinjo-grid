import 'server-only';

import type { SimulationInput, SimulationResult } from '@mitsinjo/engine';

/**
 * In-process memory of recent engine runs, so `generate_visual(kind, resultId)` can build its
 * prompt from the result the model names. Per-process (not shared across instances): an unknown
 * id fails the tool with "run a scenario first" instead of guessing. No eviction by age, just a
 * small FIFO cap — entries are one day of steps each.
 */
export interface CachedResult {
  input: SimulationInput;
  result: SimulationResult;
}

const MAX_CACHED_RESULTS = 20;

const cache = new Map<string, CachedResult>();

export function rememberResult(input: SimulationInput, result: SimulationResult): void {
  cache.delete(result.id);
  cache.set(result.id, { input, result });
  while (cache.size > MAX_CACHED_RESULTS) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

export function getResultEntry(resultId: string): CachedResult | null {
  return cache.get(resultId) ?? null;
}

/** Tests only. */
export function clearResultCache(): void {
  cache.clear();
}
