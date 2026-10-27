import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { applyPatch } from '../patch';
import { createBaselineInput, createCloudyAfternoonInput } from '../scenarios';

describe('applyPatch (P3-T7)', () => {
  it('does not mutate the original input', () => {
    const input = createBaselineInput();
    const originalMultiplier = input.demandMultiplier;

    const patched = applyPatch(input, { demandMultiplier: 1.5 });

    expect(input.demandMultiplier).toBe(originalMultiplier);
    expect(patched.demandMultiplier).toBe(1.5);
    expect(patched.scenarioId).toBe('custom');
  });

  it('updates battery configuration parameters', () => {
    const input = createBaselineInput();
    const patched = applyPatch(input, {
      batteryCapacityKwh: 150,
      initialSocPct: 80,
      minSocPct: 30,
    });

    expect(patched.battery.capacityKwh).toBe(150);
    expect(patched.battery.initialSocPct).toBe(80);
    expect(patched.battery.minSocPct).toBe(30);
  });

  it('adds a solar_drop event when solarDropPct > 0', () => {
    const input = createBaselineInput();
    expect(input.events).toHaveLength(0);

    const patched = applyPatch(input, {
      solarDropPct: 40,
      dropStartHour: 13,
      dropDurationH: 3,
    });

    expect(patched.events).toHaveLength(1);
    expect(patched.events[0]).toEqual({
      type: 'solar_drop',
      startHour: 13,
      durationH: 3,
      factor: 0.6,
    });
  });

  it('updates existing solar_drop when startHour or durationH are provided without solarDropPct', () => {
    const cloudy = createCloudyAfternoonInput();
    expect(cloudy.events[0]).toEqual({
      type: 'solar_drop',
      startHour: 13,
      durationH: 2,
      factor: 0.6,
    });

    const patched = applyPatch(cloudy, {
      dropStartHour: 14,
      dropDurationH: 4,
    });

    expect(patched.events[0]).toEqual({
      type: 'solar_drop',
      startHour: 14,
      durationH: 4,
      factor: 0.6,
    });
  });

  it('removes solar_drop event when solarDropPct is 0', () => {
    const input = createBaselineInput();
    const withDrop = applyPatch(input, { solarDropPct: 50 });
    expect(withDrop.events.some((e) => e.type === 'solar_drop')).toBe(true);

    const removed = applyPatch(withDrop, { solarDropPct: 0 });
    expect(removed.events.some((e) => e.type === 'solar_drop')).toBe(false);
  });

  it('throws ZodError on invalid bounds', () => {
    const input = createBaselineInput();

    // minSoc >= initialSoc
    expect(() =>
      applyPatch(input, {
        initialSocPct: 20,
        minSocPct: 20,
      })
    ).toThrow(ZodError);

    // multiplier > 2
    expect(() =>
      applyPatch(input, {
        demandMultiplier: 3.5,
      })
    ).toThrow(ZodError);
  });

  it('rejects out-of-bounds patch fields even when the result would be a valid input', () => {
    const input = createBaselineInput();
    // 95 % drop → factor 0.05 is a valid event, but InputPatch caps solarDropPct at 90.
    expect(() => applyPatch(input, { solarDropPct: 95 })).toThrow(ZodError);
  });
});
