import { describe, expect, it } from 'vitest';
import {
  applianceProfileKw,
  applyPatch,
  applyWeather,
  compare,
  createBaselineInput,
  scenarios,
  StrategyIdSchema,
  type Appliance,
} from '../index';

const pumps: Appliance = {
  id: 'pumps',
  name: 'Irrigation pumps',
  category: 'water_pump',
  sector: 'water',
  watts: 750,
  quantity: 5,
};
const pumpKwh = applianceProfileKw(pumps).reduce((a, b) => a + b, 0);

describe('Strategies, metrics and warnings see appliance load (PV-T3)', () => {
  const cloudyDay = applyWeather(createBaselineInput(), 'cloudy');
  const before = compare(cloudyDay);
  const after = compare(applyPatch(cloudyDay, { appliances: [pumps] }));
  const waterShare = cloudyDay.sectors.find((s) => s.id === 'water')!.criticalShare;

  it.each(StrategyIdSchema.options)(
    '%s: demand, critical demand and unserved follow the pumps',
    (id) => {
      const b = before[id]!.metrics;
      const a = after[id]!.metrics;
      expect(a.demandKwh - b.demandKwh).toBeCloseTo(pumpKwh, 9);
      // Critical share comes from the sector the appliance is on.
      expect(a.criticalDemandKwh - b.criticalDemandKwh).toBeCloseTo(pumpKwh * waterShare, 9);
      expect(a.perSector.water!.demandKwh - b.perSector.water!.demandKwh).toBeCloseTo(pumpKwh, 9);
      expect(a.unservedKwh).toBeGreaterThan(b.unservedKwh);
      expect(a.perSector.water!.unservedKwh).toBeGreaterThan(b.perSector.water!.unservedKwh);
      expect(a.violations).toBe(0);
      expect(
        after[id]!.warnings.some((w) => w.code === 'SECTOR_PARTIAL' && w.sector === 'water')
      ).toBe(true);
    }
  );

  it('priorities still apply: essential_first serves the high-priority water sector better', () => {
    expect(after.essential_first!.metrics.perSector.water!.unservedKwh).toBeLessThan(
      after.proportional!.metrics.perSector.water!.unservedKwh
    );
  });

  it('every scenario stays violation-free with appliances on several sectors', () => {
    const fridge: Appliance = {
      ...pumps,
      id: 'f',
      category: 'fridge_vaccine',
      sector: 'health',
      watts: 60,
      quantity: 2,
    };
    for (const sc of Object.values(scenarios)) {
      const c = compare(applyPatch(sc.input, { appliances: [pumps, fridge] }));
      for (const r of Object.values(c)) expect(r!.metrics.violations).toBe(0);
    }
  });
});
