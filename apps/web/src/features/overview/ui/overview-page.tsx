'use client';

import { useMemo } from 'react';
import { scenarios, type ScenarioId } from '@mitsinjo/engine';
import {
  selectActiveMetrics,
  selectActiveResult,
  selectActiveStrategy,
  selectComparison,
  selectInput,
  selectIsRunning,
  selectScenarioId,
  selectTimeIndex,
  useSimulationStore,
} from '@/stores';
import { useTranslations } from '@/lib/i18n';
import { StatusBadge } from '@/components/ui/status-badge';
import { ScenarioSelector, type ScenarioOption } from '@/components/ui/scenario-selector';
import { summarizeIncident } from '../utils/incident';
import { GridSchematicPreview } from './grid-schematic-preview';
import { IncidentHero } from './incident-hero';
import { StrategyRings } from './strategy-rings';

/** Scenario behind « Simulate a solar drop »: the demo-path weather shock. */
export const SOLAR_DROP_SCENARIO: ScenarioId = 'cloudy_afternoon';

/** Landing screen: what is at stake today, its impact, and the one decision that changes it. */
export function OverviewPage() {
  const tCommon = useTranslations('common');
  const tScenarios = useTranslations('scenarios');
  const tStrategies = useTranslations('strategies');

  const scenarioId = useSimulationStore(selectScenarioId);
  const input = useSimulationStore(selectInput);
  const status = useSimulationStore((s) => s.status);
  const isRunning = useSimulationStore(selectIsRunning);
  const results = useSimulationStore(selectComparison);
  const activeStrategy = useSimulationStore(selectActiveStrategy);
  const result = useSimulationStore(selectActiveResult);
  const metrics = useSimulationStore(selectActiveMetrics);
  const timeIndex = useSimulationStore(selectTimeIndex);

  const run = useSimulationStore((s) => s.run);
  const loadScenario = useSimulationStore((s) => s.loadScenario);
  const setTimeIndex = useSimulationStore((s) => s.setTimeIndex);

  const incident = useMemo(
    () => summarizeIncident(results, activeStrategy),
    [results, activeStrategy]
  );

  const scenarioOptions: ScenarioOption[] = useMemo(
    () =>
      (Object.keys(scenarios) as ScenarioId[]).map((id) => ({
        id,
        name: tScenarios(`${id}.name` as const),
        description: tScenarios(`${id}.description` as const),
      })),
    [tScenarios]
  );

  const simulateSolarDrop = () => {
    loadScenario(SOLAR_DROP_SCENARIO);
    run();
    const first = summarizeIncident(
      useSimulationStore.getState().results,
      useSimulationStore.getState().activeStrategy
    )?.window;
    if (first) setTimeIndex(first.fromHour);
  };

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto w-full">
      {/* Top bar: simulated notice and scenario */}
      <div className="flex items-center gap-2 flex-wrap">
        <StatusBadge variant="simulated" label={tCommon('simulatedData')} />
        <ScenarioSelector
          scenarios={scenarioOptions}
          value={scenarioId}
          modified={status === 'modified'}
          onChange={(id) => {
            loadScenario(id as ScenarioId);
            run();
          }}
        />
      </div>

      <IncidentHero
        incident={incident}
        strategyName={tStrategies(activeStrategy)}
        coveragePct={metrics?.criticalCoveragePct ?? null}
        isRunning={isRunning}
        onRun={() => run()}
        onSolarDrop={simulateSolarDrop}
        onShowHour={setTimeIndex}
        visual={
          <GridSchematicPreview
            result={result}
            input={input}
            hour={timeIndex}
            onHourChange={setTimeIndex}
          />
        }
      />

      {incident && incident.strategies.length > 1 && (
        <StrategyRings
          strategies={incident.strategies}
          active={activeStrategy}
          best={incident.best}
        />
      )}
    </div>
  );
}
