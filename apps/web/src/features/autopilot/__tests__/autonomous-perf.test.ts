import { describe, it, expect, beforeEach } from 'vitest';
import {
  detectIncidents,
  decideDispatch,
  DEFAULT_CONSTITUTION,
  simulate,
  scenarios,
  type DispatchLogEntry,
  type ScenarioId,
} from '@mitsinjo/engine';
import { sealLogEntry } from '@/lib/dispatch-log';
import { resetSimulationStore, useSimulationStore } from '@/stores';

/** 60 fps = 16.6 ms per frame. */
const FRAME_BUDGET_MS = 16.6;
const PASSES = 5;

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/**
 * Times one autonomous step (detect → decide → seal) per hour.
 * One untimed warm-up pass first, so JIT compilation is not billed to the first frame.
 * Other test workers share the CPU and only ever add time, so each hour keeps its fastest of
 * `PASSES` timed passes; callers then assert on the median.
 */
function timeAutonomousSteps(id: ScenarioId, hours: readonly number[]): number[] {
  const input = scenarios[id].input;
  const result = simulate(input, 'proportional');
  const run = (timed: boolean): number[] => {
    const log: DispatchLogEntry[] = [];
    const durations: number[] = [];
    for (const hour of hours) {
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
      expect(decision.before).toBeDefined();
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
      if (timed) durations.push(performance.now() - t0);
    }
    return durations;
  };
  run(false);
  const passes = Array.from({ length: PASSES }, () => run(true));
  return hours.map((_, i) => Math.min(...passes.map((p) => p[i]!)));
}

const ALL_HOURS = Array.from({ length: 24 }, (_, h) => h);
const EVENING_HOURS = [16, 17, 18, 19, 20, 21, 22, 23];

describe('Autonomous dispatch 60 fps playback audit (PA-T7)', () => {
  beforeEach(() => {
    resetSimulationStore();
  });

  it('median hourly detection + decision fits the 60 fps frame budget (village fire, 24 h)', () => {
    const durations = timeAutonomousSteps('village_fire', ALL_HOURS);
    expect(durations).toHaveLength(24);
    expect(median(durations)).toBeLessThan(FRAME_BUDGET_MS);
  });

  it('median hourly detection + decision fits the frame budget under high evening demand', () => {
    const durations = timeAutonomousSteps('high_demand', EVENING_HOURS);
    expect(durations).toHaveLength(EVENING_HOURS.length);
    expect(median(durations)).toBeLessThan(FRAME_BUDGET_MS);
  });

  it('plays 24 autonomous hours of store updates in under 150 ms total', () => {
    useSimulationStore.getState().loadScenario('village_fire');
    useSimulationStore.getState().setDispatchMode('autonomous');

    const tStart = performance.now();
    for (let h = 0; h < 24; h++) {
      useSimulationStore.getState().setTimeIndex(h);
    }
    expect(performance.now() - tStart).toBeLessThan(150);
  });

  it('median helper handles odd and even lengths', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });
});
