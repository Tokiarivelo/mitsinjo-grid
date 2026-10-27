import { create } from 'zustand';
import {
  type Comparison,
  type InputPatch,
  type ScenarioId,
  type SectorId,
  type SimulationInput,
  type StrategyId,
  scenarios,
  compare,
  applyPatch,
} from '@mitsinjo/engine';

export type SimStatus = 'ready' | 'running' | 'complete' | 'modified' | 'error';

export interface SimulationState {
  scenarioId: ScenarioId;
  input: SimulationInput;
  status: SimStatus;
  results: Partial<Comparison>;
  activeStrategy: StrategyId;
  selectedSector: SectorId | null;
  timeIndex: number;
  error: string | null;

  // Actions
  loadScenario: (scenarioId: ScenarioId) => void;
  patchInput: (patch: InputPatch) => void;
  run: (strategies?: readonly StrategyId[]) => void;
  reset: () => void;
  selectStrategy: (strategy: StrategyId) => void;
  selectSector: (sector: SectorId | null) => void;
  setTimeIndex: (timeIndex: number) => void;
  applyProposal: (patch?: InputPatch, strategy?: StrategyId) => void;
}

export function cloneInput(input: SimulationInput): SimulationInput {
  return JSON.parse(JSON.stringify(input)) as SimulationInput;
}

export const INITIAL_SCENARIO_ID: ScenarioId = 'baseline';

export const initialSimulationData = {
  scenarioId: INITIAL_SCENARIO_ID,
  input: cloneInput(scenarios[INITIAL_SCENARIO_ID].input),
  status: 'ready' as SimStatus,
  results: {} as Partial<Comparison>,
  activeStrategy: 'proportional' as StrategyId,
  selectedSector: null as SectorId | null,
  timeIndex: 12,
  error: null as string | null,
};

export function resetSimulationStore() {
  useSimulationStore.setState({
    ...initialSimulationData,
    input: cloneInput(scenarios[INITIAL_SCENARIO_ID].input),
  });
}

export const useSimulationStore = create<SimulationState>((set, get) => ({
  ...initialSimulationData,

  loadScenario: (scenarioId: ScenarioId) => {
    const preset = scenarios[scenarioId];
    if (!preset) {
      set({ error: `Unknown scenario: ${scenarioId}`, status: 'error' });
      return;
    }
    set({
      scenarioId,
      input: cloneInput(preset.input),
      status: 'ready',
      results: {},
      error: null,
    });
  },

  patchInput: (patch: InputPatch) => {
    try {
      const patched = applyPatch(get().input, patch);
      set({
        input: patched,
        status: 'modified',
        error: null,
      });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Invalid patch',
        status: 'error',
      });
    }
  },

  run: (strategies?: readonly StrategyId[]) => {
    const activeStrategies: readonly StrategyId[] =
      strategies && strategies.length > 0
        ? strategies
        : ['proportional', 'essential_first', 'balanced'];

    set({ status: 'running', error: null });
    try {
      const comparison = compare(get().input, activeStrategies);
      set({
        results: comparison,
        status: 'complete',
        error: null,
      });
    } catch (err) {
      set({
        status: 'error',
        error: err instanceof Error ? err.message : 'Simulation failed',
      });
    }
  },

  reset: () => {
    const currentScenario = get().scenarioId;
    const preset = scenarios[currentScenario] ?? scenarios[INITIAL_SCENARIO_ID];
    set({
      input: cloneInput(preset.input),
      status: 'ready',
      results: {},
      error: null,
    });
  },

  selectStrategy: (strategy: StrategyId) => {
    set({ activeStrategy: strategy });
  },

  selectSector: (sector: SectorId | null) => {
    set({ selectedSector: sector });
  },

  setTimeIndex: (timeIndex: number) => {
    const clamped = Math.max(0, Math.min(23, Math.floor(timeIndex)));
    set({ timeIndex: clamped });
  },

  applyProposal: (patch?: InputPatch, strategy?: StrategyId) => {
    try {
      const patched =
        patch && Object.keys(patch).length > 0
          ? applyPatch(get().input, patch)
          : get().input;
      const nextStrategy = strategy ?? get().activeStrategy;

      set({
        input: patched,
        activeStrategy: nextStrategy,
        status: 'running',
        error: null,
      });
      const comparison = compare(patched, ['proportional', 'essential_first', 'balanced']);
      set({
        results: comparison,
        status: 'complete',
        error: null,
      });
    } catch (err) {
      set({
        status: 'error',
        error: err instanceof Error ? err.message : 'Failed to apply proposal',
      });
    }
  },
}));
