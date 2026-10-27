'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, GitCompare, Sparkles } from 'lucide-react';
import type { StrategyId } from '@mitsinjo/engine';
import {
  selectActiveStrategy,
  selectComparison,
  selectHasResults,
  selectInput,
  selectIsRunning,
  selectScenarioId,
  useSimulationStore,
} from '@/stores';
import { useTranslations } from '@/lib/i18n';
import { Button, buttonVariants } from '@/components/ui/button';
import { ChartCard } from '@/components/ui/chart-card';
import { StatusBadge } from '@/components/ui/status-badge';
import { InsightCard } from '@/components/ui/insight-card';
import { ImpactBanner } from '@/components/ui/impact-banner';
import { StrategyComparisonChart } from '@/components/charts';
import { StrategyCard } from './strategy-card';
import { summarizeComparison } from '../utils/summarize';

export function StrategyLabPage() {
  const tCommon = useTranslations('common');
  const tStrategies = useTranslations('strategies');
  const tScenarios = useTranslations('scenarios');

  const scenarioId = useSimulationStore(selectScenarioId);
  const input = useSimulationStore(selectInput);
  const isRunning = useSimulationStore(selectIsRunning);
  const hasResults = useSimulationStore(selectHasResults);
  const comparison = useSimulationStore(selectComparison);
  const activeStrategy = useSimulationStore(selectActiveStrategy);

  const runComparison = useSimulationStore((s) => s.run);
  const selectStrategy = useSimulationStore((s) => s.selectStrategy);

  // Derive decision summary strictly by rule from engine comparison
  const summary = useMemo(() => {
    return summarizeComparison(comparison);
  }, [comparison]);

  const scenarioName = tScenarios(`${scenarioId}.name` as const);

  const handleUseStrategy = (strategy: StrategyId) => {
    selectStrategy(strategy);
  };

  const activeResult = comparison[activeStrategy];

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 flex flex-col gap-6 max-w-7xl mx-auto w-full">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-border/60">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <StatusBadge variant="simulated" label={tCommon('simulatedData')} />
            <span className="text-xs font-mono text-text-muted">
              {tStrategies('identicalInputs', {
                scenario: scenarioName,
                pv: input.solar.peakKw,
                battery: input.battery.capacityKwh,
              })}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold font-display text-text-primary tracking-tight">
            {tStrategies('subtitle')}
          </h1>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <Button
            variant="primary"
            size="md"
            loading={isRunning}
            icon={<GitCompare className="h-4 w-4" />}
            onClick={() => runComparison()}
          >
            {isRunning ? tStrategies('comparing') : tStrategies('compareBtn')}
          </Button>
        </div>
      </div>

      {/* Decision Summary InsightCard (rule-derived from engine numbers) */}
      {hasResults && summary && (
        <div className="grid grid-cols-1 gap-4">
          <InsightCard
            title={tStrategies(summary.titleKey)}
            text={tStrategies(summary.descriptionKey, summary.descriptionParams)}
            evidenceRef={summary.evidenceRef}
            origin="computed"
            icon={<CheckCircle2 className="h-5 w-5 text-battery-green" />}
            actionLabel={
              activeStrategy !== summary.recommendedStrategy
                ? tStrategies('useStrategy')
                : undefined
            }
            onAction={
              activeStrategy !== summary.recommendedStrategy
                ? () => handleUseStrategy(summary.recommendedStrategy)
                : undefined
            }
          />
        </div>
      )}

      {/* 1. Side-by-side Strategy Columns (Proportional vs Essential-First vs Balanced) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Proportional Strategy Card */}
        <StrategyCard
          strategyId="proportional"
          name={tStrategies('proportional')}
          rule={tStrategies('proportionalRule')}
          result={comparison.proportional}
          isActive={activeStrategy === 'proportional'}
          bestMetrics={
            summary
              ? {
                  delivered: summary.bestDelivered === 'proportional',
                  essential: summary.bestEssentialCoverage === 'proportional',
                  unmet: summary.lowestUnmet === 'proportional',
                  soc: summary.highestEndSoc === 'proportional',
                }
              : undefined
          }
          onSelectStrategy={() => handleUseStrategy('proportional')}
        />

        {/* Essential-First Priority Strategy Card */}
        <StrategyCard
          strategyId="essential_first"
          name={tStrategies('essential_first')}
          rule={tStrategies('essentialFirstRule')}
          result={comparison.essential_first}
          isActive={activeStrategy === 'essential_first'}
          bestMetrics={
            summary
              ? {
                  delivered: summary.bestDelivered === 'essential_first',
                  essential: summary.bestEssentialCoverage === 'essential_first',
                  unmet: summary.lowestUnmet === 'essential_first',
                  soc: summary.highestEndSoc === 'essential_first',
                }
              : undefined
          }
          onSelectStrategy={() => handleUseStrategy('essential_first')}
        />

        {/* Balanced Strategy Card */}
        <StrategyCard
          strategyId="balanced"
          name={tStrategies('balanced')}
          rule={tStrategies('balancedRule')}
          result={comparison.balanced}
          isActive={activeStrategy === 'balanced'}
          bestMetrics={
            summary
              ? {
                  delivered: summary.bestDelivered === 'balanced',
                  essential: summary.bestEssentialCoverage === 'balanced',
                  unmet: summary.lowestUnmet === 'balanced',
                  soc: summary.highestEndSoc === 'balanced',
                }
              : undefined
          }
          onSelectStrategy={() => handleUseStrategy('balanced')}
        />
      </div>

      {/* 2. Comparison Chart Matrix */}
      <div className="grid grid-cols-1 gap-6">
        <ChartCard
          title={tStrategies('comparisonChartTitle')}
          subtitle={tStrategies('comparisonChartSubtitle')}
          unit="kWh / %"
          summary={tStrategies('comparisonChartSummary')}
          empty={!hasResults}
          emptyTitle={tStrategies('compareEmptyTitle')}
          emptyDescription={tStrategies('compareEmptyDesc')}
          loading={isRunning}
        >
          {hasResults && <StrategyComparisonChart comparison={comparison} height={280} />}
        </ChartCard>
      </div>

      {/* 3. Bottom Row: Active Warnings & Copilot Link */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <ImpactBanner warnings={activeResult?.warnings ?? []} />
        </div>

        {/* AI Copilot Explanation CTA */}
        <div className="p-5 rounded-card bg-surface border border-border shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-4 w-4 text-ai-violet" aria-hidden="true" />
              <StatusBadge variant="ai" label={tCommon('aiExplanation')} size="sm" />
            </div>
            <h4 className="font-display text-sm font-semibold text-text-primary">
              {tStrategies('explainInCopilot')}
            </h4>
            <p className="mt-1 text-xs text-text-secondary leading-relaxed">
              {tStrategies('copilotPromoDesc')}
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-border/60">
            <Link
              href="/copilot"
              className={buttonVariants({ variant: 'secondary', size: 'sm', className: 'w-full' })}
            >
              <ArrowRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>{tStrategies('explainInCopilot')}</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
