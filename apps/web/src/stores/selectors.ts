import type {
  Comparison,
  Metrics,
  ScenarioId,
  SectorId,
  SectorMetrics,
  SimulationInput,
  SimulationResult,
  SimWarning,
  StepResult,
  StrategyId,
} from '@mitsinjo/engine';
import type { SimStatus, SimulationState } from './simulation.store';

export const selectScenarioId = (s: SimulationState): ScenarioId => s.scenarioId;
export const selectInput = (s: SimulationState): SimulationInput => s.input;
export const selectStatus = (s: SimulationState): SimStatus => s.status;
export const selectIsModified = (s: SimulationState): boolean => s.status === 'modified';
export const selectIsRunning = (s: SimulationState): boolean => s.status === 'running';
export const selectIsComplete = (s: SimulationState): boolean => s.status === 'complete';
export const selectHasResults = (s: SimulationState): boolean =>
  Object.keys(s.results).length > 0;
export const selectError = (s: SimulationState): string | null => s.error;

export const selectActiveStrategy = (s: SimulationState): StrategyId => s.activeStrategy;
export const selectSelectedSector = (s: SimulationState): SectorId | null => s.selectedSector;
export const selectTimeIndex = (s: SimulationState): number => s.timeIndex;

export const selectComparison = (s: SimulationState): Partial<Comparison> => s.results;

export const selectActiveResult = (
  s: SimulationState
): SimulationResult | undefined => s.results[s.activeStrategy];

export const selectActiveMetrics = (s: SimulationState): Metrics | null =>
  s.results[s.activeStrategy]?.metrics ?? null;

const EMPTY_STEPS: StepResult[] = [];
const EMPTY_WARNINGS: SimWarning[] = [];

export const selectActiveSteps = (s: SimulationState): StepResult[] =>
  s.results[s.activeStrategy]?.steps ?? EMPTY_STEPS;

export const selectActiveWarnings = (s: SimulationState): SimWarning[] =>
  s.results[s.activeStrategy]?.warnings ?? EMPTY_WARNINGS;

export const selectStepAtTime = (
  s: SimulationState,
  hour?: number
): StepResult | null => {
  const steps = s.results[s.activeStrategy]?.steps;
  if (!steps || steps.length === 0) return null;
  const targetHour = hour !== undefined ? hour : s.timeIndex;
  return steps[targetHour] ?? null;
};

export const selectStrategyResult =
  (strategy: StrategyId) =>
  (s: SimulationState): SimulationResult | undefined =>
    s.results[strategy];

export const selectSectorMetrics =
  (sectorId: SectorId) =>
  (s: SimulationState): SectorMetrics | null =>
    s.results[s.activeStrategy]?.metrics.perSector[sectorId] ?? null;
