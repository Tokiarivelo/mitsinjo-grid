'use client';

import { useState } from 'react';
import { Radar } from 'lucide-react';
import { scenarios, type ScenarioId } from '@mitsinjo/engine';
import {
  useSimulationStore,
  selectActiveResult,
  selectActiveStrategy,
  selectComparison,
  selectInput,
  selectScenarioId,
  selectStatus,
} from '@/stores';
import { StatusBadge } from '@/components/ui/status-badge';
import { useTranslations } from '@/lib/i18n';
import { ScenarioCard } from './scenario-card';
import { AssumptionsInspector } from './assumptions-inspector';
import { ReproducibilitySummary } from './reproducibility-summary';

export function ScenariosPage() {
  const tCommon = useTranslations('common');
  const tScenarios = useTranslations('features.scenarios');
  const tScenariosCatalog = useTranslations('scenarios');

  const currentStoreScenarioId = useSimulationStore(selectScenarioId);
  const currentStoreInput = useSimulationStore(selectInput);
  const status = useSimulationStore(selectStatus);
  const activeResult = useSimulationStore(selectActiveResult);
  const comparison = useSimulationStore(selectComparison);
  const activeStrategy = useSimulationStore(selectActiveStrategy);

  const loadScenario = useSimulationStore((s) => s.loadScenario);
  const patchInput = useSimulationStore((s) => s.patchInput);
  const resetScenario = useSimulationStore((s) => s.reset);

  // Inspector can view a selected scenario, defaulting to the store's active scenario
  const [inspectedScenarioId, setInspectedScenarioId] =
    useState<ScenarioId>(currentStoreScenarioId);

  const scenarioIds: ScenarioId[] = [
    'baseline',
    'cloudy_afternoon',
    'high_demand',
    'battery_constraint',
    'essential_stress',
    'meter_anomaly',
  ];

  const handleSelectScenario = (id: ScenarioId) => {
    setInspectedScenarioId(id);
    if (id !== currentStoreScenarioId) {
      loadScenario(id);
    }
  };

  // The card's link navigates to /simulation; this only loads the scenario first.
  const handleOpenScenario = (id: ScenarioId) => {
    if (id !== currentStoreScenarioId) {
      loadScenario(id);
    }
  };

  const isInspectedActive = inspectedScenarioId === currentStoreScenarioId;
  const inspectedInput = isInspectedActive
    ? currentStoreInput
    : scenarios[inspectedScenarioId].input;

  const inspectedName = tScenariosCatalog(`${inspectedScenarioId}.name`);

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto">
      {/* 1. Synthetic Simulation Provenance Notice Banner */}
      <section className="rounded-card p-4 bg-surface-elevated/70 border border-border flex flex-col md:flex-row items-start md:items-center justify-between gap-4 backdrop-blur-sm shadow-xs">
        <div className="flex items-start md:items-center gap-3">
          <div className="p-2 rounded-control bg-energy-cyan/15 border border-energy-cyan/30 text-energy-cyan shrink-0">
            <Radar className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="font-mono text-xs font-semibold text-energy-cyan tracking-wider uppercase">
                {tCommon('simulatedData')}
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-control-sm bg-surface border border-border text-text-muted">
                {tScenarios('syntheticNoticeBadge')}
              </span>
            </div>
            <p className="text-xs text-text-secondary leading-relaxed">
              {tScenarios('syntheticNoticeDescription')}
            </p>
          </div>
        </div>

        <div className="shrink-0">
          <StatusBadge variant="simulated" size="sm" label={tCommon('simulatedData')} />
        </div>
      </section>

      {/* Page Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold font-display text-text-primary tracking-tight">
          {tScenarios('title')}
        </h1>
        <p className="text-text-secondary text-xs sm:text-sm mt-0.5">{tScenarios('description')}</p>
      </div>

      {/* 2. Main Split Layout: Scenario Cards Grid (Left) + Assumptions Inspector (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: 5 Predefined Scenario Cards */}
        <div className="lg:col-span-7 grid grid-cols-1 md:grid-cols-2 gap-4">
          {scenarioIds.map((id) => {
            const isActive = currentStoreScenarioId === id;
            const isInspected = inspectedScenarioId === id;
            const scenarioInput = isActive ? currentStoreInput : scenarios[id].input;

            return (
              <ScenarioCard
                key={id}
                id={id}
                name={tScenariosCatalog(`${id}.name`)}
                description={tScenariosCatalog(`${id}.description`)}
                input={scenarioInput}
                isActive={isInspected}
                status={
                  isActive
                    ? status === 'modified'
                      ? 'warning'
                      : status === 'complete'
                        ? 'complete'
                        : 'ready'
                    : 'ready'
                }
                onSelect={handleSelectScenario}
                onOpen={handleOpenScenario}
                className={id === 'essential_stress' ? 'md:col-span-2' : undefined}
              />
            );
          })}
        </div>

        {/* Right: Assumptions Inspector Panel */}
        <div className="lg:col-span-5 sticky top-4">
          <AssumptionsInspector
            scenarioId={inspectedScenarioId}
            scenarioName={inspectedName}
            input={inspectedInput}
            isModified={isInspectedActive && status === 'modified'}
            onPatch={patchInput}
            onReset={resetScenario}
          />
        </div>
      </div>

      {/* 3. Bottom Compact Strip: Latest Run Reproducibility Summary */}
      <ReproducibilitySummary
        input={currentStoreInput}
        result={activeResult}
        comparison={comparison}
        activeStrategy={activeStrategy}
      />
    </div>
  );
}
