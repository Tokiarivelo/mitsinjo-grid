import type { SimulationResult, StrategyId } from '@mitsinjo/engine';
import { fmtKwh } from '@/lib/format';

export interface DecisionSummary {
  recommendedStrategy: StrategyId;
  titleKey: 'summaryHeroTitle' | 'summaryNominalTitle' | 'summaryStressTitle';
  descriptionKey: 'summaryHeroDesc' | 'summaryNominalDesc' | 'summaryStressDesc';
  descriptionParams?: Record<string, string | number>;
  evidenceRef: string;
  /** Strategies tied for the best value of each metric; empty when every strategy ties. */
  bestDelivered: StrategyId[];
  bestEssentialCoverage: StrategyId[];
  lowestUnmet: StrategyId[];
  highestEndSoc: StrategyId[];
}

export interface BestMetricFlags {
  delivered: boolean;
  essential: boolean;
  unmet: boolean;
  soc: boolean;
}

/** Values closer than this (kWh or %) count as a tie. */
const TIE_EPS = 0.001;

interface Ranked {
  id: StrategyId;
  res: SimulationResult;
}

/**
 * Ids holding the best value of one metric. Returns [] when all strategies tie,
 * so a badge never marks a "best" that is not distinguishable.
 */
export function bestStrategies(
  results: readonly Ranked[],
  score: (m: SimulationResult['metrics']) => number,
  direction: 'min' | 'max'
): StrategyId[] {
  if (results.length < 2) return [];
  const values = results.map((r) => score(r.res.metrics));
  const target = direction === 'max' ? Math.max(...values) : Math.min(...values);
  const winners = results
    .filter((_, i) => Math.abs(values[i]! - target) <= TIE_EPS)
    .map((r) => r.id);
  return winners.length === results.length ? [] : winners;
}

/** Badge flags for one strategy card; all false before a comparison exists. */
export function bestMetricsFor(
  summary: DecisionSummary | null,
  strategy: StrategyId
): BestMetricFlags {
  return {
    delivered: Boolean(summary?.bestDelivered.includes(strategy)),
    essential: Boolean(summary?.bestEssentialCoverage.includes(strategy)),
    unmet: Boolean(summary?.lowestUnmet.includes(strategy)),
    soc: Boolean(summary?.highestEndSoc.includes(strategy)),
  };
}

/**
 * Derives a deterministic decision summary by evaluating numerical engine metrics.
 * Pure TS, zero LLM, strictly grounded in SimulationResult contracts.
 */
export function summarizeComparison(
  comparison: Partial<Record<StrategyId, SimulationResult>>
): DecisionSummary | null {
  const prop = comparison.proportional;
  const ess = comparison.essential_first;

  if (!prop || !ess) {
    return null;
  }

  const bal = comparison.balanced;
  const allResults: Ranked[] = [
    { id: 'proportional', res: prop },
    { id: 'essential_first', res: ess },
    ...(bal ? [{ id: 'balanced' as StrategyId, res: bal }] : []),
  ];

  const bestDelivered = bestStrategies(allResults, (m) => m.servedKwh, 'max');
  const lowestUnmet = bestStrategies(allResults, (m) => m.unservedKwh, 'min');
  const highestEndSoc = bestStrategies(allResults, (m) => m.socEndPct, 'max');
  const bestEssentialCoverage = bestStrategies(allResults, (m) => m.criticalUnservedKwh, 'min');

  // Recommendation tie-break: min criticalUnservedKwh, then max criticalCoveragePct (essential_first first)
  let bestEssential = ess.strategy;
  let minCriticalUnserved = ess.metrics.criticalUnservedKwh;
  let maxCriticalPct = ess.metrics.criticalCoveragePct;
  for (const { id, res } of allResults) {
    if (
      res.metrics.criticalUnservedKwh < minCriticalUnserved - TIE_EPS ||
      (Math.abs(res.metrics.criticalUnservedKwh - minCriticalUnserved) <= TIE_EPS &&
        res.metrics.criticalCoveragePct > maxCriticalPct + TIE_EPS)
    ) {
      minCriticalUnserved = res.metrics.criticalUnservedKwh;
      maxCriticalPct = res.metrics.criticalCoveragePct;
      bestEssential = id;
    }
  }

  const best = { bestDelivered, bestEssentialCoverage, lowestUnmet, highestEndSoc };

  // Rule 1: Nominal condition — 0 unserved energy across both strategies
  if (prop.metrics.unservedKwh < 0.01 && ess.metrics.unservedKwh < 0.01) {
    return {
      recommendedStrategy: 'proportional',
      titleKey: 'summaryNominalTitle',
      descriptionKey: 'summaryNominalDesc',
      evidenceRef: `metrics.unservedKwh=0.0`,
      ...best,
    };
  }

  // Rule 2: Essential First protects clinic/water while Proportional drops critical power
  if (ess.metrics.criticalUnservedKwh < 0.01 && prop.metrics.criticalUnservedKwh > 0.01) {
    return {
      recommendedStrategy: 'essential_first',
      titleKey: 'summaryHeroTitle',
      descriptionKey: 'summaryHeroDesc',
      descriptionParams: {
        essUnserved: fmtKwh(ess.metrics.criticalUnservedKwh),
        propUnserved: fmtKwh(prop.metrics.criticalUnservedKwh),
      },
      evidenceRef: `criticalUnservedKwh: ess=${ess.metrics.criticalUnservedKwh.toFixed(1)} vs prop=${prop.metrics.criticalUnservedKwh.toFixed(1)}`,
      ...best,
    };
  }

  // Rule 3: Severe deficit — recommend whichever strategy best protects the essential tier
  return {
    recommendedStrategy: bestEssential,
    titleKey: 'summaryStressTitle',
    descriptionKey: 'summaryStressDesc',
    evidenceRef: `criticalCoveragePct: ess=${ess.metrics.criticalCoveragePct.toFixed(1)}% vs prop=${prop.metrics.criticalCoveragePct.toFixed(1)}%`,
    ...best,
  };
}
