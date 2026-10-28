import { beforeEach, describe, expect, it } from 'vitest';
import { MAX_WORKFLOW_DAYS, compareWorkflow, scenarios } from '@mitsinjo/engine';
import { DEFAULT_WORKFLOW, resetSimulationStore, useSimulationStore } from '../simulation.store';
import {
  selectActiveResult,
  selectActiveWorkflowResult,
  selectDayIndex,
  selectStatus,
  selectWorkflow,
} from '../selectors';

const get = () => useSimulationStore.getState();

describe('weather workflow in useSimulationStore', () => {
  beforeEach(() => {
    resetSimulationStore();
  });

  it('starts with one sunny day', () => {
    expect(selectWorkflow(get())).toEqual(DEFAULT_WORKFLOW);
    expect(selectDayIndex(get())).toBe(0);
  });

  it('adds days (copying the last weather by default) and marks the run modified', () => {
    get().addWorkflowDay('cloudy');
    get().addWorkflowDay();
    expect(selectWorkflow(get()).map((d) => d.weather)).toEqual(['sunny', 'cloudy', 'cloudy']);
    expect(selectStatus(get())).toBe('modified');
  });

  it('re-runs at once when a weather edit lands on an up-to-date run', () => {
    get().run();
    const sunnySolar = selectActiveResult(get())?.metrics.solarKwh ?? 0;
    get().setDayWeather(0, 'rainy');
    expect(selectStatus(get())).toBe('complete');
    const expected = compareWorkflow(scenarios.baseline.input, [{ weather: 'rainy' }]);
    expect(selectActiveResult(get())).toEqual(expected.proportional?.days[0]?.result);
    expect(selectActiveResult(get())?.metrics.solarKwh).toBeLessThan(sunnySolar);

    get().addWorkflowDay('storm');
    expect(selectStatus(get())).toBe('complete');
    expect(selectActiveWorkflowResult(get())?.days).toHaveLength(2);
    get().removeWorkflowDay(1);
    expect(selectStatus(get())).toBe('complete');
    expect(selectActiveWorkflowResult(get())?.days).toHaveLength(1);
  });

  it('stays modified when a weather edit lands on a stale run', () => {
    get().run();
    get().patchInput({ solarDropPct: 50 });
    get().setDayWeather(0, 'cloudy');
    expect(selectStatus(get())).toBe('modified');
  });

  it('caps the workflow at MAX_WORKFLOW_DAYS', () => {
    for (let i = 0; i < MAX_WORKFLOW_DAYS + 3; i++) get().addWorkflowDay('rainy');
    expect(selectWorkflow(get())).toHaveLength(MAX_WORKFLOW_DAYS);
  });

  it('changes and removes days but never removes the last one', () => {
    get().addWorkflowDay('cloudy');
    get().setDayWeather(0, 'storm');
    expect(selectWorkflow(get()).map((d) => d.weather)).toEqual(['storm', 'cloudy']);
    get().removeWorkflowDay(0);
    expect(selectWorkflow(get()).map((d) => d.weather)).toEqual(['cloudy']);
    get().removeWorkflowDay(0);
    expect(selectWorkflow(get())).toHaveLength(1);
  });

  it('keeps the day cursor valid when days are removed', () => {
    get().addWorkflowDay('cloudy');
    get().addWorkflowDay('rainy');
    get().run();
    get().setDayIndex(2);
    get().removeWorkflowDay(0);
    expect(selectDayIndex(get())).toBe(1);
    get().removeWorkflowDay(1);
    expect(selectDayIndex(get())).toBe(0);
  });

  it('run() simulates every day and exposes the day under the cursor as results', () => {
    get().addWorkflowDay('storm');
    get().run();
    const expected = compareWorkflow(scenarios.baseline.input, [
      { weather: 'sunny' },
      { weather: 'storm' },
    ]);
    expect(selectActiveWorkflowResult(get())).toEqual(expected.proportional);
    expect(selectActiveResult(get())).toEqual(expected.proportional?.days[0]?.result);

    get().setDayIndex(1);
    expect(selectActiveResult(get())).toEqual(expected.proportional?.days[1]?.result);
    get().setDayIndex(99);
    expect(selectDayIndex(get())).toBe(1);
  });

  it('playback rolls over days, and stop/restart rewind to day 1', () => {
    get().addWorkflowDay('cloudy');
    get().run();
    get().setTimeIndex(23);
    get().advancePlayback();
    expect(get()).toMatchObject({ dayIndex: 1, timeIndex: 0 });
    expect(selectActiveResult(get())).toBe(get().workflowResults.proportional?.days[1]?.result);

    get().stop();
    expect(get()).toMatchObject({ dayIndex: 0, timeIndex: 0 });

    get().setDayIndex(1);
    get().restart();
    expect(get()).toMatchObject({ dayIndex: 0, timeIndex: 0, isPlaying: true });
  });

  it('play() at the end of the last day starts over from day 1', () => {
    get().addWorkflowDay('cloudy');
    get().run();
    get().setDayIndex(1);
    get().setTimeIndex(23);
    get().play();
    expect(get()).toMatchObject({ dayIndex: 0, timeIndex: 0, isPlaying: true });
  });

  it('loading a scenario keeps the workflow but clears its results', () => {
    get().addWorkflowDay('rainy');
    get().run();
    get().loadScenario('cloudy_afternoon');
    expect(selectWorkflow(get())).toHaveLength(2);
    expect(get().workflowResults).toEqual({});
    expect(selectDayIndex(get())).toBe(0);
  });
});
