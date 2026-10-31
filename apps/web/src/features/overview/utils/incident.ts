import type { Comparison, SimulationResult, StrategyId } from '@mitsinjo/engine';

/** Below this, a critical shortfall is rounding noise (same threshold as the old overview cards). */
export const CRITICAL_SHORTFALL_KWH = 0.05;

export interface StrategyCoverage {
  id: StrategyId;
  coveragePct: number;
  unservedKwh: number;
  unmetHours: number;
}

export interface Incident {
  /** Essential services lack energy under the active strategy. */
  atRisk: boolean;
  /** First hour range where critical power falls short (engine warning), or null. */
  window: { fromHour: number; toHour: number } | null;
  shortfallKwh: number;
  unmetHours: number;
  /** Every strategy that was run, in engine order. */
  strategies: StrategyCoverage[];
  /** Strategy with the highest essential coverage (first one on a tie). */
  best: StrategyId | null;
}

/**
 * Picks engine values for the incident screen. Selection only: no energy math.
 * Returns null when the active strategy has no result yet.
 */
export function summarizeIncident(
  results: Partial<Comparison>,
  active: StrategyId
): Incident | null {
  const current: SimulationResult | undefined = results[active];
  if (!current) return null;

  const { metrics, warnings } = current;
  const atRisk = metrics.criticalUnservedKwh > CRITICAL_SHORTFALL_KWH;

  const first =
    warnings
      .filter((w) => w.code === 'CRITICAL_UNMET')
      .sort((a, b) => a.fromHour - b.fromHour)[0] ?? null;

  const strategies = (Object.keys(results) as StrategyId[]).flatMap((id) => {
    const r = results[id];
    return r
      ? [
          {
            id,
            coveragePct: r.metrics.criticalCoveragePct,
            unservedKwh: r.metrics.criticalUnservedKwh,
            unmetHours: r.metrics.criticalUnmetHours,
          },
        ]
      : [];
  });

  const best = strategies.reduce<StrategyCoverage | null>(
    (acc, s) => (acc === null || s.coveragePct > acc.coveragePct ? s : acc),
    null
  );

  return {
    atRisk,
    window: atRisk && first ? { fromHour: first.fromHour, toHour: first.toHour } : null,
    shortfallKwh: metrics.criticalUnservedKwh,
    unmetHours: metrics.criticalUnmetHours,
    strategies,
    best: best?.id ?? null,
  };
}
