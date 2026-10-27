import type { SimulationResult, StrategyId } from '@mitsinjo/engine';
import { fmtKwh } from '@/lib/format';

export interface DecisionSummary {
  recommendedStrategy: StrategyId;
  titleKey: 'summaryHeroTitle' | 'summaryNominalTitle' | 'summaryStressTitle';
  descriptionKey: 'summaryHeroDesc' | 'summaryNominalDesc' | 'summaryStressDesc';
  descriptionParams?: Record<string, string | number>;
  evidenceRef: string;
  bestDelivered: StrategyId;
  bestEssentialCoverage: StrategyId;
  lowestUnmet: StrategyId;
  highestEndSoc: StrategyId;
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
  const allResults: { id: StrategyId; res: SimulationResult }[] = [
    { id: 'proportional', res: prop },
    { id: 'essential_first', res: ess },
    ...(bal ? [{ id: 'balanced' as StrategyId, res: bal }] : []),
  ];

  // Best delivered energy (max servedKwh)
  let bestDelivered = prop.strategy;
  let maxServed = prop.metrics.servedKwh;
  for (const { id, res } of allResults) {
    if (res.metrics.servedKwh > maxServed + 0.001) {
      maxServed = res.metrics.servedKwh;
      bestDelivered = id;
    }
  }

  // Best essential coverage (min criticalUnservedKwh, then max criticalCoveragePct)
  let bestEssential = ess.strategy;
  let minCriticalUnserved = ess.metrics.criticalUnservedKwh;
  let maxCriticalPct = ess.metrics.criticalCoveragePct;
  for (const { id, res } of allResults) {
    if (
      res.metrics.criticalUnservedKwh < minCriticalUnserved - 0.001 ||
      (Math.abs(res.metrics.criticalUnservedKwh - minCriticalUnserved) <= 0.001 &&
        res.metrics.criticalCoveragePct > maxCriticalPct + 0.001)
    ) {
      minCriticalUnserved = res.metrics.criticalUnservedKwh;
      maxCriticalPct = res.metrics.criticalCoveragePct;
      bestEssential = id;
    }
  }

  // Lowest unmet demand (min unservedKwh)
  let lowestUnmet = prop.strategy;
  let minUnserved = prop.metrics.unservedKwh;
  for (const { id, res } of allResults) {
    if (res.metrics.unservedKwh < minUnserved - 0.001) {
      minUnserved = res.metrics.unservedKwh;
      lowestUnmet = id;
    }
  }

  // Highest ending SoC (max socEndPct)
  let highestEndSoc = prop.strategy;
  let maxSoc = prop.metrics.socEndPct;
  for (const { id, res } of allResults) {
    if (res.metrics.socEndPct > maxSoc + 0.001) {
      maxSoc = res.metrics.socEndPct;
      highestEndSoc = id;
    }
  }

  // Rule 1: Nominal condition — 0 unserved energy across both strategies
  if (prop.metrics.unservedKwh < 0.01 && ess.metrics.unservedKwh < 0.01) {
    return {
      recommendedStrategy: 'proportional',
      titleKey: 'summaryNominalTitle',
      descriptionKey: 'summaryNominalDesc',
      evidenceRef: `metrics.unservedKwh=0.0`,
      bestDelivered,
      bestEssentialCoverage: bestEssential,
      lowestUnmet,
      highestEndSoc,
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
      bestDelivered,
      bestEssentialCoverage: 'essential_first',
      lowestUnmet,
      highestEndSoc,
    };
  }

  // Rule 3: Severe deficit — recommend whichever strategy best protects the essential tier
  return {
    recommendedStrategy: bestEssential,
    titleKey: 'summaryStressTitle',
    descriptionKey: 'summaryStressDesc',
    evidenceRef: `criticalCoveragePct: ess=${ess.metrics.criticalCoveragePct.toFixed(1)}% vs prop=${prop.metrics.criticalCoveragePct.toFixed(1)}%`,
    bestDelivered,
    bestEssentialCoverage: bestEssential,
    lowestUnmet,
    highestEndSoc,
  };
}
