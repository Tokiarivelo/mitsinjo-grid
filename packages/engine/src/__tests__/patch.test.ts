import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { DEFAULT_DROP_DURATION_H, DEFAULT_DROP_START_HOUR } from '../constants';
import { applyPatch, getSolarDrop } from '../patch';
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

  it('updates sector priorities via patch (PY-T2)', () => {
    const input = createBaselineInput();
    const waterBefore = input.sectors.find((s) => s.id === 'water')?.priority;
    expect(waterBefore).toBe('high');

    const patched = applyPatch(input, {
      priorities: {
        water: 'critical',
        market: 'medium',
      },
    });

    expect(patched.sectors.find((s) => s.id === 'water')?.priority).toBe('critical');
    expect(patched.sectors.find((s) => s.id === 'market')?.priority).toBe('medium');
    // Health priority unchanged
    expect(patched.sectors.find((s) => s.id === 'health')?.priority).toBe('critical');
  });

  it('updates sectorCaps via patch with LLM-safe bounds (PY-T2)', () => {
    const input = createBaselineInput();
    expect(input.sectorCaps).toBeUndefined();

    const patched = applyPatch(input, {
      sectorCaps: [
        {
          sector: 'market',
          maxKw: 1.0,
          fromHour: 18,
          toHour: 22,
        },
      ],
    });

    expect(patched.sectorCaps).toHaveLength(1);
    expect(patched.sectorCaps?.[0]).toEqual({
      sector: 'market',
      maxKw: 1.0,
      fromHour: 18,
      toHour: 22,
    });
  });

  it('rejects invalid sectorCaps bounds (fromHour >= toHour, negative maxKw, hour > 24) (PY-T2)', () => {
    const input = createBaselineInput();

    // fromHour >= toHour
    expect(() =>
      applyPatch(input, {
        sectorCaps: [{ sector: 'market', maxKw: 1.0, fromHour: 20, toHour: 18 }],
      })
    ).toThrow(ZodError);

    // negative maxKw
    expect(() =>
      applyPatch(input, {
        sectorCaps: [{ sector: 'market', maxKw: -1, fromHour: 18, toHour: 22 }],
      })
    ).toThrow(ZodError);

    // fromHour > 23
    expect(() =>
      applyPatch(input, {
        sectorCaps: [{ sector: 'market', maxKw: 1, fromHour: 24, toHour: 25 }],
      })
    ).toThrow(ZodError);
  });

  it('updates criticalShares per sector via patch (PZ-T8)', () => {
    const input = createBaselineInput();
    const healthBefore = input.sectors.find((s) => s.id === 'health')?.criticalShare;
    expect(healthBefore).toBe(0.8);

    const patched = applyPatch(input, {
      criticalShares: {
        health: 0.9,
        market: 0.25,
      },
    });

    expect(patched.sectors.find((s) => s.id === 'health')?.criticalShare).toBe(0.9);
    expect(patched.sectors.find((s) => s.id === 'market')?.criticalShare).toBe(0.25);
    // Households unchanged
    expect(patched.sectors.find((s) => s.id === 'households')?.criticalShare).toBe(0.2);
  });

  it('rejects out-of-bounds criticalShares (< 0 or > 1) (PZ-T8)', () => {
    const input = createBaselineInput();
    expect(() => applyPatch(input, { criticalShares: { health: -0.1 } })).toThrow(ZodError);
    expect(() => applyPatch(input, { criticalShares: { health: 1.5 } })).toThrow(ZodError);
  });

  it('updates balancedWeights via patch, merging with defaults (PZ-T8)', () => {
    const input = createBaselineInput();
    expect(input.strategyParams).toBeUndefined();

    const patched = applyPatch(input, {
      balancedWeights: {
        critical: 6,
        low: 0,
      },
    });

    expect(patched.strategyParams?.balancedWeights).toEqual({
      critical: 6,
      high: 3,
      medium: 2,
      low: 0,
    });
  });

  it('rejects balancedWeights when all weights are 0 or out of bounds (PZ-T8)', () => {
    const input = createBaselineInput();

    // All zero
    expect(() =>
      applyPatch(input, {
        balancedWeights: { critical: 0, high: 0, medium: 0, low: 0 },
      })
    ).toThrow(ZodError);

    // Negative
    expect(() =>
      applyPatch(input, {
        balancedWeights: { critical: -1 },
      })
    ).toThrow(ZodError);

    // Greater than 10
    expect(() =>
      applyPatch(input, {
        balancedWeights: { critical: 11 },
      })
    ).toThrow(ZodError);
  });
});

describe('getSolarDrop', () => {
  it('returns defaults and 0 % when there is no drop event', () => {
    expect(getSolarDrop(createBaselineInput())).toEqual({
      pct: 0,
      startHour: DEFAULT_DROP_START_HOUR,
      durationH: DEFAULT_DROP_DURATION_H,
    });
  });

  it('reads the existing drop event as control values', () => {
    expect(getSolarDrop(createCloudyAfternoonInput())).toEqual({
      pct: 40,
      startHour: 13,
      durationH: 2,
    });
  });

  it('matches the window applyPatch uses for a new drop', () => {
    const patched = applyPatch(createBaselineInput(), { solarDropPct: 30 });
    expect(getSolarDrop(patched)).toEqual({
      pct: 30,
      startHour: DEFAULT_DROP_START_HOUR,
      durationH: DEFAULT_DROP_DURATION_H,
    });
  });
});
