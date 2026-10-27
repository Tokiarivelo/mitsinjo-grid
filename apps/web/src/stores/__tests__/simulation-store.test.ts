import { beforeEach, describe, expect, it } from 'vitest';
import { resetSimulationStore, useSimulationStore } from '../simulation.store';
import {
  selectActiveMetrics,
  selectActiveResult,
  selectActiveSteps,
  selectActiveStrategy,
  selectActiveWarnings,
  selectComparison,
  selectHasResults,
  selectInput,
  selectIsModified,
  selectScenarioId,
  selectSectorMetrics,
  selectStatus,
  selectStepAtTime,
  selectTimeIndex,
} from '../selectors';

describe('useSimulationStore & selectors (P4-T1)', () => {
  beforeEach(() => {
    resetSimulationStore();
  });

  it('initializes with default baseline preset, ready status, and empty results', () => {
    const state = useSimulationStore.getState();
    expect(selectScenarioId(state)).toBe('baseline');
    expect(selectStatus(state)).toBe('ready');
    expect(selectIsModified(state)).toBe(false);
    expect(selectHasResults(state)).toBe(false);
    expect(selectActiveStrategy(state)).toBe('proportional');
    expect(selectActiveResult(state)).toBeUndefined();
    expect(selectActiveMetrics(state)).toBeNull();
    expect(selectActiveSteps(state)).toEqual([]);
    expect(selectActiveWarnings(state)).toEqual([]);
    expect(selectTimeIndex(state)).toBe(12);
  });

  it('loads another scenario and resets state to ready with empty results', () => {
    const store = useSimulationStore.getState();
    store.loadScenario('cloudy_afternoon');

    const updated = useSimulationStore.getState();
    expect(selectScenarioId(updated)).toBe('cloudy_afternoon');
    expect(selectStatus(updated)).toBe('ready');
    expect(selectHasResults(updated)).toBe(false);
    expect(selectInput(updated).battery.initialSocPct).toBe(35);
    expect(selectInput(updated).events).toHaveLength(1);
  });

  it('patches input and marks status as modified', () => {
    const store = useSimulationStore.getState();
    store.patchInput({ solarDropPct: 30, dropStartHour: 12, dropDurationH: 3 });

    const updated = useSimulationStore.getState();
    expect(selectStatus(updated)).toBe('modified');
    expect(selectIsModified(updated)).toBe(true);
    expect(selectInput(updated).events.some((e) => e.type === 'solar_drop')).toBe(true);
  });

  it('resets modified scenario back to pristine preset', () => {
    const store = useSimulationStore.getState();
    store.loadScenario('cloudy_afternoon');
    store.patchInput({ solarDropPct: 50 });
    expect(useSimulationStore.getState().status).toBe('modified');

    useSimulationStore.getState().reset();
    const resetState = useSimulationStore.getState();
    expect(selectStatus(resetState)).toBe('ready');
    expect(selectScenarioId(resetState)).toBe('cloudy_afternoon');
    expect(selectInput(resetState).battery.initialSocPct).toBe(35);
  });

  it('runs simulation, populates results, and sets status to complete', () => {
    const store = useSimulationStore.getState();
    store.run(['proportional', 'essential_first']);

    const updated = useSimulationStore.getState();
    expect(selectStatus(updated)).toBe('complete');
    expect(selectHasResults(updated)).toBe(true);

    const comparison = selectComparison(updated);
    expect(comparison.proportional).toBeDefined();
    expect(comparison.essential_first).toBeDefined();

    const activeResult = selectActiveResult(updated);
    expect(activeResult).toBeDefined();
    expect(activeResult?.strategy).toBe('proportional');
    expect(activeResult?.steps).toHaveLength(24);

    const metrics = selectActiveMetrics(updated);
    expect(metrics).not.toBeNull();
    expect(metrics?.violations).toBe(0);

    const steps = selectActiveSteps(updated);
    expect(steps).toHaveLength(24);

    const stepAtNoon = selectStepAtTime(updated, 12);
    expect(stepAtNoon).not.toBeNull();
    expect(stepAtNoon?.t).toBe(12);

    const healthMetrics = selectSectorMetrics('health')(updated);
    expect(healthMetrics).not.toBeNull();
    expect(healthMetrics?.demandKwh).toBeGreaterThan(0);
  });

  it('verifies demo-hero contrast via store on cloudy_afternoon', () => {
    const store = useSimulationStore.getState();
    store.loadScenario('cloudy_afternoon');
    store.run(['proportional', 'essential_first']);

    const updated = useSimulationStore.getState();
    const results = selectComparison(updated);

    const prop = results.proportional!;
    const ess = results.essential_first!;

    expect(prop.metrics.criticalUnservedKwh).toBeGreaterThan(0);
    expect(ess.metrics.criticalUnservedKwh).toBe(0);
    expect(ess.metrics.criticalCoveragePct).toBe(100);
  });

  it('clamps timeIndex between 0 and 23', () => {
    const store = useSimulationStore.getState();
    store.setTimeIndex(42);
    expect(selectTimeIndex(useSimulationStore.getState())).toBe(23);

    store.setTimeIndex(-5);
    expect(selectTimeIndex(useSimulationStore.getState())).toBe(0);

    store.setTimeIndex(15.7);
    expect(selectTimeIndex(useSimulationStore.getState())).toBe(15);
  });

  it('selects active strategy and sector', () => {
    const store = useSimulationStore.getState();
    store.selectStrategy('essential_first');
    expect(selectActiveStrategy(useSimulationStore.getState())).toBe('essential_first');

    store.selectSector('health');
    expect(useSimulationStore.getState().selectedSector).toBe('health');
  });

  it('applyProposal applies patch, runs simulation, and sets status to complete', () => {
    const store = useSimulationStore.getState();
    store.applyProposal({ solarDropPct: 40 });

    const updated = useSimulationStore.getState();
    expect(selectStatus(updated)).toBe('complete');
    expect(selectHasResults(updated)).toBe(true);
    expect(selectInput(updated).events.some((e) => e.type === 'solar_drop')).toBe(true);
  });
});
