import { describe, expect, it } from 'vitest';
import { APPLIANCE_CATALOG, APPLIANCE_CATEGORIES, ApplianceSpecSchema, HORIZON_H } from '../index';

describe('Appliance catalog (PV-T1)', () => {
  it('has exactly one spec per category', () => {
    expect(Object.keys(APPLIANCE_CATALOG).sort()).toEqual([...APPLIANCE_CATEGORIES].sort());
  });

  it.each(APPLIANCE_CATEGORIES)(
    '%s: valid spec, ordered bounds, 24 duty values in 0–1',
    (category) => {
      const s = APPLIANCE_CATALOG[category];
      expect(s.category).toBe(category);
      expect(ApplianceSpecSchema.safeParse(s).success).toBe(true);
      expect(s.minW).toBeLessThanOrEqual(s.defaultW);
      expect(s.defaultW).toBeLessThanOrEqual(s.maxW);
      expect(s.hourlyDuty).toHaveLength(HORIZON_H);
      for (const d of s.hourlyDuty) {
        expect(d).toBeGreaterThanOrEqual(0);
        expect(d).toBeLessThanOrEqual(1);
      }
      // Every appliance is used at some point of the day.
      expect(Math.max(...s.hourlyDuty)).toBeGreaterThan(0);
    }
  );

  it('cold chain never stops; the solar pump runs only in daylight', () => {
    for (const c of ['fridge', 'freezer', 'fridge_vaccine'] as const) {
      expect(Math.min(...APPLIANCE_CATALOG[c].hourlyDuty)).toBeGreaterThan(0);
    }
    const pump = APPLIANCE_CATALOG.water_pump.hourlyDuty;
    expect(pump.slice(0, 8).every((d) => d === 0)).toBe(true);
    expect(pump.slice(16).every((d) => d === 0)).toBe(true);
  });

  it('rejects a spec whose default is outside its bounds', () => {
    const bad = { ...APPLIANCE_CATALOG.tv, defaultW: 500 };
    expect(ApplianceSpecSchema.safeParse(bad).success).toBe(false);
  });
});
