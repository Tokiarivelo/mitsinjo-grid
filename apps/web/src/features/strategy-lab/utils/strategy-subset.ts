import type { StrategyId } from '@mitsinjo/engine';

/** Fewest strategies the lab compares at once. */
export const MIN_COMPARED_STRATEGIES = 2;

/**
 * Adds or removes one strategy from the compared subset. Removing is refused (same array
 * returned) when it would leave fewer than `MIN_COMPARED_STRATEGIES`. Never mutates `selected`.
 */
export function toggleStrategySubset(
  selected: readonly StrategyId[],
  id: StrategyId
): readonly StrategyId[] {
  if (!selected.includes(id)) return [...selected, id];
  if (selected.length <= MIN_COMPARED_STRATEGIES) return selected;
  return selected.filter((s) => s !== id);
}

/**
 * The active strategy must stay in the compared subset, or every view reading
 * `results[activeStrategy]` (dashboard, 3D, copilot) goes empty. Returns the strategy to
 * activate: the current one when still compared, else the first compared one.
 */
export function activeWithinSubset(
  active: StrategyId,
  selected: readonly StrategyId[]
): StrategyId {
  return selected.includes(active) ? active : (selected[0] ?? active);
}
