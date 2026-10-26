import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import {
  createBaselineInput,
  parseInput,
  BatteryConfigSchema,
  InputPatchSchema,
  ScenarioEventSchema,
  SimulationInputSchema,
  SolarConfigSchema,
} from '../index';

describe('Schema validation & bounds (P3-T1)', () => {
  it('parses valid baseline input without throwing', () => {
    const input = createBaselineInput();
    const parsed = parseInput(input);
    expect(parsed.scenarioId).toBe('baseline');
    expect(parsed.sectors).toHaveLength(5);
  });

  describe('SolarConfig bounds', () => {
    it('accepts peakKw within [0, 500]', () => {
      expect(SolarConfigSchema.safeParse({ peakKw: 0, profile: new Array(24).fill(0) }).success).toBe(true);
      expect(SolarConfigSchema.safeParse({ peakKw: 500, profile: new Array(24).fill(0) }).success).toBe(true);
    });

    it('rejects peakKw < 0 or > 500', () => {
      expect(SolarConfigSchema.safeParse({ peakKw: -1, profile: new Array(24).fill(0) }).success).toBe(false);
      expect(SolarConfigSchema.safeParse({ peakKw: 501, profile: new Array(24).fill(0) }).success).toBe(false);
    });

    it('rejects profile with length != 24', () => {
      expect(SolarConfigSchema.safeParse({ peakKw: 40, profile: new Array(23).fill(0) }).success).toBe(false);
      expect(SolarConfigSchema.safeParse({ peakKw: 40, profile: new Array(25).fill(0) }).success).toBe(false);
    });

    it('rejects profile values < 0 or > 1', () => {
      const badLow = new Array(24).fill(0);
      badLow[0] = -0.1;
      expect(SolarConfigSchema.safeParse({ peakKw: 40, profile: badLow }).success).toBe(false);

      const badHigh = new Array(24).fill(0);
      badHigh[0] = 1.1;
      expect(SolarConfigSchema.safeParse({ peakKw: 40, profile: badHigh }).success).toBe(false);
    });
  });

  describe('BatteryConfig bounds', () => {
    const validBattery = {
      capacityKwh: 120,
      initialSocPct: 60,
      minSocPct: 20,
      maxChargeKw: 25,
      maxDischargeKw: 25,
      chargeEff: 0.95,
      dischargeEff: 0.95,
    };

    it('accepts valid battery config', () => {
      expect(BatteryConfigSchema.safeParse(validBattery).success).toBe(true);
    });

    it('rejects capacity < 1 or > 2000', () => {
      expect(BatteryConfigSchema.safeParse({ ...validBattery, capacityKwh: 0.5 }).success).toBe(false);
      expect(BatteryConfigSchema.safeParse({ ...validBattery, capacityKwh: 2001 }).success).toBe(false);
    });

    it('rejects when minSocPct >= initialSocPct', () => {
      expect(BatteryConfigSchema.safeParse({ ...validBattery, minSocPct: 60, initialSocPct: 60 }).success).toBe(false);
      expect(BatteryConfigSchema.safeParse({ ...validBattery, minSocPct: 70, initialSocPct: 60 }).success).toBe(false);
    });

    it('rejects efficiencies < 0.5 or > 1.0', () => {
      expect(BatteryConfigSchema.safeParse({ ...validBattery, chargeEff: 0.4 }).success).toBe(false);
      expect(BatteryConfigSchema.safeParse({ ...validBattery, chargeEff: 1.1 }).success).toBe(false);
      expect(BatteryConfigSchema.safeParse({ ...validBattery, dischargeEff: 0.4 }).success).toBe(false);
      expect(BatteryConfigSchema.safeParse({ ...validBattery, dischargeEff: 1.05 }).success).toBe(false);
    });
  });

  describe('ScenarioEvent bounds', () => {
    it('accepts valid solar_drop event', () => {
      expect(
        ScenarioEventSchema.safeParse({
          type: 'solar_drop',
          startHour: 13,
          durationH: 2,
          factor: 0.6,
        }).success
      ).toBe(true);
    });

    it('accepts valid demand_spike event', () => {
      expect(
        ScenarioEventSchema.safeParse({
          type: 'demand_spike',
          sector: 'health',
          startHour: 10,
          durationH: 4,
          factor: 1.5,
        }).success
      ).toBe(true);

      expect(
        ScenarioEventSchema.safeParse({
          type: 'demand_spike',
          sector: 'all',
          startHour: 0,
          durationH: 24,
          factor: 1.2,
        }).success
      ).toBe(true);
    });

    it('rejects events with startHour + durationH > 24', () => {
      expect(
        ScenarioEventSchema.safeParse({
          type: 'solar_drop',
          startHour: 20,
          durationH: 5,
          factor: 0.5,
        }).success
      ).toBe(false);
    });

    it('rejects factor < 0 or > 3', () => {
      expect(
        ScenarioEventSchema.safeParse({
          type: 'solar_drop',
          startHour: 10,
          durationH: 2,
          factor: -0.1,
        }).success
      ).toBe(false);

      expect(
        ScenarioEventSchema.safeParse({
          type: 'solar_drop',
          startHour: 10,
          durationH: 2,
          factor: 3.5,
        }).success
      ).toBe(false);
    });
  });

  describe('SimulationInput bounds', () => {
    it('rejects inputs with fewer than 5 sectors or duplicate sectors', () => {
      const input = createBaselineInput();
      const fourSectors = { ...input, sectors: input.sectors.slice(0, 4) };
      expect(SimulationInputSchema.safeParse(fourSectors).success).toBe(false);

      const duplicate = {
        ...input,
        sectors: [input.sectors[0], input.sectors[0], input.sectors[2], input.sectors[3], input.sectors[4]],
      };
      expect(SimulationInputSchema.safeParse(duplicate).success).toBe(false);
    });

    it('rejects demandMultiplier < 0.5 or > 2.0', () => {
      const input = createBaselineInput();
      expect(SimulationInputSchema.safeParse({ ...input, demandMultiplier: 0.4 }).success).toBe(false);
      expect(SimulationInputSchema.safeParse({ ...input, demandMultiplier: 2.1 }).success).toBe(false);
    });

    it('parseInput throws ZodError on invalid raw object', () => {
      expect(() => parseInput({})).toThrow(ZodError);
      expect(() => parseInput(null)).toThrow(ZodError);
      expect(() => parseInput({ foo: 'bar' })).toThrow(ZodError);
    });
  });

  describe('InputPatchSchema', () => {
    it('accepts valid partial patches', () => {
      expect(InputPatchSchema.safeParse({ demandMultiplier: 1.3 }).success).toBe(true);
      expect(InputPatchSchema.safeParse({ solarDropPct: 40, dropStartHour: 12, dropDurationH: 3 }).success).toBe(true);
      expect(InputPatchSchema.safeParse({ initialSocPct: 50, minSocPct: 20 }).success).toBe(true);
    });

    it('rejects invalid patch bounds', () => {
      expect(InputPatchSchema.safeParse({ demandMultiplier: 0.2 }).success).toBe(false);
      expect(InputPatchSchema.safeParse({ solarDropPct: 95 }).success).toBe(false);
      expect(InputPatchSchema.safeParse({ dropStartHour: 25 }).success).toBe(false);
    });
  });
});
