import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { resetSimulationStore, useSimulationStore } from '@/stores';
import { useAiDispatch } from '../use-ai-dispatch';
import { useAutonomousDispatch } from '../use-autonomous-dispatch';

/** Page wiring: the loop mounted once + the panel hook. */
function usePageDispatch() {
  useAutonomousDispatch();
  return useAiDispatch();
}

describe('useAiDispatch (PA-T3b, autonomous dispatch)', () => {
  beforeEach(() => {
    resetSimulationStore();
  });

  it('runs village_fire in autonomous mode: detects fires, isolates sectors, fills event log', () => {
    act(() => {
      useSimulationStore.getState().loadScenario('village_fire');
      useSimulationStore.getState().setDispatchMode('autonomous');
      useSimulationStore.getState().setTimeIndex(13);
    });

    const { result } = renderHook(() => usePageDispatch());
    expect(result.current.dispatchMode).toBe('autonomous');

    // Hour 13: no active fire yet
    expect(result.current.dispatchLog).toHaveLength(0);

    // Hour 14: fire starts on market
    act(() => {
      useSimulationStore.getState().setTimeIndex(14);
    });

    let state = useSimulationStore.getState();
    // 1 incident (fire on market) + 1 action (isolate_sector on market)
    expect(state.dispatchLog.length).toBeGreaterThanOrEqual(2);
    const marketFireEntry = state.dispatchLog.find(
      (e) => e.incident?.kind === 'fire' && e.incident?.sector === 'market'
    );
    expect(marketFireEntry).toBeDefined();

    const marketIsolateEntry = state.dispatchLog.find(
      (e) => e.action?.kind === 'isolate_sector' && e.action?.sector === 'market'
    );
    expect(marketIsolateEntry).toBeDefined();
    expect(marketIsolateEntry?.before).toBeDefined();
    expect(marketIsolateEntry?.after).toBeDefined();

    // Verify market is isolated in simulation input caps
    expect(state.input.sectorCaps?.some((c) => c.sector === 'market' && c.maxKw === 0)).toBe(true);

    // Hour 15: fire spreads to water pumping station
    act(() => {
      useSimulationStore.getState().setTimeIndex(15);
    });

    state = useSimulationStore.getState();
    // Done criteria: ≥ 4 lines (2 incidents, 2 isolations)
    expect(state.dispatchLog.length).toBeGreaterThanOrEqual(4);

    const waterFireEntry = state.dispatchLog.find(
      (e) => e.incident?.kind === 'fire' && e.incident?.sector === 'water'
    );
    expect(waterFireEntry).toBeDefined();

    const waterIsolateEntry = state.dispatchLog.find(
      (e) => e.action?.kind === 'isolate_sector' && e.action?.sector === 'water'
    );
    expect(waterIsolateEntry).toBeDefined();

    // Verify water is also isolated
    expect(state.input.sectorCaps?.some((c) => c.sector === 'water' && c.maxKw === 0)).toBe(true);
  });

  it('takeBackControl immediately restores manual mode and stops automated dispatch', () => {
    act(() => {
      useSimulationStore.getState().loadScenario('village_fire');
      useSimulationStore.getState().setDispatchMode('autonomous');
      useSimulationStore.getState().setTimeIndex(13);
    });

    const { result } = renderHook(() => usePageDispatch());

    // Advance to 14: auto-isolates market
    act(() => {
      useSimulationStore.getState().setTimeIndex(14);
    });
    expect(useSimulationStore.getState().dispatchLog.length).toBeGreaterThanOrEqual(2);

    // Operator takes back control
    act(() => {
      result.current.takeBackControl();
    });
    expect(useSimulationStore.getState().dispatchMode).toBe('manual');
    expect(result.current.dispatchMode).toBe('manual');

    const logCountBefore = useSimulationStore.getState().dispatchLog.length;

    // Advance to 15 while in manual: no automatic action taken
    act(() => {
      useSimulationStore.getState().setTimeIndex(15);
    });

    expect(useSimulationStore.getState().dispatchLog.length).toBe(logCountBefore);
    // Water is NOT isolated automatically while in manual mode
    expect(
      useSimulationStore
        .getState()
        .input.sectorCaps?.some((c) => c.sector === 'water' && c.maxKw === 0)
    ).toBe(false);
  });

  it('AI actions can be undone one by one via undoLastChange', () => {
    act(() => {
      useSimulationStore.getState().loadScenario('village_fire');
      useSimulationStore.getState().setDispatchMode('autonomous');
      useSimulationStore.getState().setTimeIndex(14);
    });

    renderHook(() => usePageDispatch());

    expect(
      useSimulationStore
        .getState()
        .input.sectorCaps?.some((c) => c.sector === 'market' && c.maxKw === 0)
    ).toBe(true);

    // Undo the AI action
    act(() => {
      useSimulationStore.getState().undoLastChange();
    });

    // Market is no longer capped to 0
    expect(
      Boolean(
        useSimulationStore
          .getState()
          .input.sectorCaps?.some((c) => c.sector === 'market' && c.maxKw === 0)
      )
    ).toBe(false);
  });

  it('PR #39 regression: page loop + deck panel hook apply and log each action once', () => {
    act(() => {
      useSimulationStore.getState().loadScenario('village_fire');
      useSimulationStore.getState().setDispatchMode('autonomous');
      useSimulationStore.getState().setTimeIndex(13);
    });

    // SimulationPage mounts the loop, AutopilotPanel mounts useAiDispatch (alias useAutopilot).
    renderHook(() => usePageDispatch());
    renderHook(() => useAiDispatch());

    act(() => {
      useSimulationStore.getState().setTimeIndex(14);
    });

    const log = useSimulationStore.getState().dispatchLog;
    const isolations = log.filter(
      (e) => e.action?.kind === 'isolate_sector' && e.action?.sector === 'market'
    );
    const fires = log.filter((e) => e.incident?.kind === 'fire' && e.incident?.sector === 'market');
    expect(isolations).toHaveLength(1);
    expect(fires).toHaveLength(1);
  });

  it('useAiDispatch alone never runs the autonomous loop', () => {
    act(() => {
      useSimulationStore.getState().loadScenario('village_fire');
      useSimulationStore.getState().setDispatchMode('autonomous');
      useSimulationStore.getState().setTimeIndex(14);
    });
    renderHook(() => useAiDispatch());
    expect(useSimulationStore.getState().dispatchLog).toHaveLength(0);
  });
});
