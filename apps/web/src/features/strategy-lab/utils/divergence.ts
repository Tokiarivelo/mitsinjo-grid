import type { StrategyId, SweepPoint, SweepResult } from '@mitsinjo/engine';

export interface DivergenceInfo {
  found: boolean;
  value?: number;
  diff?: number;
  bestStrategy?: StrategyId;
  bestVal?: number;
  worstStrategy?: StrategyId;
  worstVal?: number;
  point?: SweepPoint;
}

/** Critical unserved gap (kWh) above which strategies count as diverging. */
export const DIVERGENCE_THRESHOLD_KWH = 0.1;

/**
 * Finds the first sweep point where critical unserved energy differs between
 * strategies by more than `threshold` kWh. Values are raw engine numbers; the UI formats them.
 */
export function findDivergencePoint(
  points: SweepResult,
  threshold = DIVERGENCE_THRESHOLD_KWH,
  strategies?: readonly StrategyId[]
): DivergenceInfo {
  if (!points || points.length === 0) {
    return { found: false };
  }

  for (const point of points) {
    const available = (
      strategies && strategies.length > 0
        ? strategies
        : (Object.keys(point.metrics) as StrategyId[])
    ).filter((s) => point.metrics[s] !== undefined);

    if (available.length < 2) {
      continue;
    }

    let minVal = Infinity;
    let maxVal = -Infinity;
    let bestStrat: StrategyId | undefined;
    let worstStrat: StrategyId | undefined;

    for (const s of available) {
      const unserved = point.metrics[s]?.criticalUnservedKwh ?? 0;
      if (unserved < minVal) {
        minVal = unserved;
        bestStrat = s;
      }
      if (unserved > maxVal) {
        maxVal = unserved;
        worstStrat = s;
      }
    }

    const diff = maxVal - minVal;
    if (diff > threshold + 1e-9) {
      return {
        found: true,
        value: point.value,
        diff,
        bestStrategy: bestStrat,
        bestVal: minVal,
        worstStrategy: worstStrat,
        worstVal: maxVal,
        point,
      };
    }
  }

  return { found: false };
}
