import { describe, expect, it } from 'vitest';
import { scenarios, simulate } from '@mitsinjo/engine';
import { batteryStory } from '../battery-story';

describe('batteryStory (M7-T3)', () => {
  const input = scenarios.cloudy_afternoon.input;
  const result = simulate(input, 'proportional');

  it('traces the drain from the last SoC peak to the asked hour', () => {
    const story = batteryStory(input, result, 3);
    expect(story.hour).toBe(3);
    expect(story.socPct).toBeCloseTo(result.steps[3]!.socPct, 2);
    // The peak is the last max SoC at or before 3 h.
    const window = result.steps.slice(0, 4);
    const maxSoc = Math.max(...window.map((s) => s.socPct));
    const lastPeak = window.reduce((last, s, i) => (s.socPct === maxSoc ? i : last), 0);
    expect(story.peak.hour).toBe(lastPeak);
    expect(story.peak.socPct).toBeCloseTo(maxSoc, 2);
    // Overnight: no sun since the peak, only drain.
    expect(story.solarKwhSincePeak).toBe(0);
    expect(story.dischargedKwh).toBeGreaterThan(0);
    // Drained energy covers the net SoC drop (recharges would only add).
    const net = ((story.peak.socPct - story.socPct) / 100) * input.battery.capacityKwh;
    expect(story.dischargedKwh).toBeGreaterThanOrEqual(net - 0.01);
  });

  it('unserved energy by sector sums to the window total', () => {
    const story = batteryStory(input, result, 23);
    const sum = story.unservedBySector.reduce((n, s) => n + s.kwh, 0);
    expect(sum).toBeCloseTo(story.unservedKwhSincePeak, 5);
    for (const s of story.unservedBySector) {
      expect(s.kwh).toBeGreaterThan(0);
    }
  });

  it('clamps the hour to the simulated day', () => {
    expect(batteryStory(input, result, 99).hour).toBe(23);
    expect(batteryStory(input, result, -2).hour).toBe(0);
  });
});
