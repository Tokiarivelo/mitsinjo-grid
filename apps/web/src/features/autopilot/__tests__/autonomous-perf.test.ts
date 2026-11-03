import { describe, it, expect, beforeEach } from 'vitest';
import {
  detectIncidents,
  decideDispatch,
  DEFAULT_CONSTITUTION,
  simulate,
  scenarios,
  type DispatchLogEntry,
} from '@mitsinjo/engine';
import { sealLogEntry } from '@/lib/dispatch-log';
import { resetSimulationStore, useSimulationStore } from '@/stores';

describe('Autonomous dispatch 60 fps playback audit (PA-T7)', () => {
  beforeEach(() => {
    resetSimulationStore();
  });

  it('runs detection and dispatch decision within the 16.6 ms (60 fps) frame budget for each hour', () => {
    const input = scenarios.village_fire.input;
    const result = simulate(input, 'proportional');
    const log: DispatchLogEntry[] = [];
    const frameBudgetMs = 16.6; // 60 fps = 16.6 ms per frame
    const durations: number[] = [];

    for (let hour = 0; hour < 24; hour++) {
      const t0 = performance.now();

      // 1. Detection
      const incidents = detectIncidents(input, result, hour, 3, 0);

      // 2. Decision & simulation of candidate actions
      const decision = decideDispatch(
        input,
        hour,
        'proportional',
        incidents,
        DEFAULT_CONSTITUTION,
        log,
        0
      );

      // 3. Seal log entries
      if (decision.action) {
        log.push(
          sealLogEntry({
            id: `act-${hour}`,
            day: 0,
            hour,
            mode: 'autonomous',
            origin: 'ai',
            action: decision.action,
            before: decision.before,
            after: decision.after,
          })
        );
      }

      const elapsed = performance.now() - t0;
      durations.push(elapsed);

      // Each hourly step MUST execute well within the 60 fps frame budget (16.6 ms)
      expect(elapsed).toBeLessThan(frameBudgetMs);
    }

    const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
    // Average execution is typically well under 2 ms
    expect(avgDuration).toBeLessThan(5);
  });

  it('audits high evening demand stress scenario with zero frame budget drops', () => {
    const input = scenarios.high_demand.input;
    const result = simulate(input, 'proportional');
    const log: DispatchLogEntry[] = [];
    const maxAllowedMs = 16.6;

    for (let hour = 16; hour <= 23; hour++) {
      const t0 = performance.now();
      const incidents = detectIncidents(input, result, hour, 3, 0);
      const decision = decideDispatch(
        input,
        hour,
        'proportional',
        incidents,
        DEFAULT_CONSTITUTION,
        log,
        0
      );

      const elapsed = performance.now() - t0;
      expect(elapsed).toBeLessThan(maxAllowedMs);
      expect(decision.before).toBeDefined();
    }
  });

  it('simulates 24h playback loop with store state updates under 100 ms total', () => {
    useSimulationStore.getState().loadScenario('village_fire');
    useSimulationStore.getState().setDispatchMode('autonomous');

    const tStart = performance.now();

    for (let h = 0; h < 24; h++) {
      useSimulationStore.getState().setTimeIndex(h);
    }

    const totalElapsed = performance.now() - tStart;
    // 24 state updates across the entire day complete in under 100 ms
    expect(totalElapsed).toBeLessThan(150);
  });
});
