import { describe, expect, it } from 'vitest';
import {
  APPLIANCE_CATALOG,
  ApplianceSchema,
  applianceProfileKw,
  applyPatch,
  compare,
  computeInputHash,
  createBaselineInput,
  EPS,
  InputPatchSchema,
  MAX_APPLIANCES,
  scenarios,
  sectorApplianceKw,
  simulate,
  StrategyIdSchema,
  type Appliance,
  type SimulationInput,
} from '../index';

const fridge: Appliance = {
  id: 'a1',
  name: 'Clinic fridge',
  category: 'fridge',
  sector: 'health',
  watts: 120,
  quantity: 1,
};

const withAppliances = (input: SimulationInput, appliances: Appliance[]) =>
  applyPatch(input, { appliances });

describe('applianceProfileKw (PV-T2)', () => {
  it('= watts × quantity × catalog duty / 1000', () => {
    const p = applianceProfileKw({ ...fridge, quantity: 2 });
    expect(p).toHaveLength(24);
    p.forEach((kw, t) =>
      expect(kw).toBeCloseTo((120 * 2 * APPLIANCE_CATALOG.fridge.hourlyDuty[t]!) / 1000, 12)
    );
  });

  it('uses a custom duty profile when given', () => {
    const hourlyDuty = Array.from({ length: 24 }, (_, t) => (t === 19 ? 1 : 0));
    const p = applianceProfileKw({ ...fridge, hourlyDuty });
    expect(p[19]).toBeCloseTo(0.12, 12);
    expect(p.reduce((a, b) => a + b, 0)).toBeCloseTo(0.12, 12);
  });

  it('sums lines per sector and leaves other sectors absent', () => {
    const pump: Appliance = {
      ...fridge,
      id: 'a2',
      category: 'water_pump',
      sector: 'water',
      watts: 750,
    };
    const bySector = sectorApplianceKw([fridge, { ...fridge, id: 'a3' }, pump]);
    expect(Object.keys(bySector).sort()).toEqual(['health', 'water']);
    expect(bySector.health![14]).toBeCloseTo(2 * applianceProfileKw(fridge)[14]!, 12);
  });
});

describe('Appliance schema bounds', () => {
  it('rejects watts outside the catalog range, bad quantity and duplicate ids', () => {
    expect(ApplianceSchema.safeParse({ ...fridge, watts: 5000 }).success).toBe(false);
    expect(ApplianceSchema.safeParse({ ...fridge, quantity: 0 }).success).toBe(false);
    expect(ApplianceSchema.safeParse({ ...fridge, name: ' ' }).success).toBe(false);
    expect(InputPatchSchema.safeParse({ appliances: [fridge, fridge] }).success).toBe(false);
    const tooMany = Array.from({ length: MAX_APPLIANCES + 1 }, (_, i) => ({
      ...fridge,
      id: `a${i}`,
    }));
    expect(InputPatchSchema.safeParse({ appliances: tooMany }).success).toBe(false);
  });
});

describe('Appliances in the demand model (PV-T2)', () => {
  it('golden: no appliance (absent or emptied) gives identical results on every scenario', () => {
    for (const sc of Object.values(scenarios)) {
      const emptied = applyPatch(withAppliances(sc.input, [fridge]), { appliances: [] });
      expect(emptied.appliances).toBeUndefined();
      expect(computeInputHash(emptied)).toBe(
        computeInputHash({ ...sc.input, scenarioId: 'custom' })
      );
      for (const strategy of StrategyIdSchema.options) {
        const a = simulate({ ...sc.input, scenarioId: 'custom' }, strategy);
        const b = simulate(emptied, strategy);
        expect(b.steps).toEqual(a.steps);
        expect(b.metrics).toEqual(a.metrics);
      }
    }
  });

  it('one fridge adds exactly its curve to its sector, nothing elsewhere', () => {
    const base = createBaselineInput();
    const before = simulate(base, 'essential_first');
    const after = simulate(withAppliances(base, [fridge]), 'essential_first');
    const curve = applianceProfileKw(fridge);
    for (let t = 0; t < 24; t++) {
      const b = before.steps[t]!.sectors;
      const a = after.steps[t]!.sectors;
      expect(a.health!.demandKw - b.health!.demandKw).toBeCloseTo(curve[t]!, 12);
      for (const id of ['water', 'school', 'households', 'market', 'industry'] as const) {
        expect(a[id]!.demandKw).toBe(b[id]!.demandKw);
      }
    }
    expect(after.metrics.violations).toBe(0);
  });

  it('a disconnected sector carries no appliance load', () => {
    const base = createBaselineInput(); // industry not connected
    const mill: Appliance = { ...fridge, category: 'rice_mill', sector: 'industry', watts: 7500 };
    const r = simulate(withAppliances(base, [mill]), 'proportional');
    expect(r.steps.every((s) => Math.abs(s.sectors.industry!.demandKw) < EPS)).toBe(true);
  });

  it('meter readings replace the modelled profile, appliances included', () => {
    const readings = Array(24).fill(2);
    const input = applyPatch(createBaselineInput(), {
      meterReadings: { health: readings },
      appliances: [fridge],
    });
    const r = simulate(input, 'proportional');
    expect(r.steps.every((s) => s.sectors.health!.demandKw === 2)).toBe(true);
  });

  it('appliances change the input hash and every strategy sees them', () => {
    const base = createBaselineInput();
    const input = withAppliances(base, [fridge]);
    expect(computeInputHash(input)).not.toBe(computeInputHash(base));
    const c = compare(input);
    const extraKwh = applianceProfileKw(fridge).reduce((a, b) => a + b, 0);
    const baseDemand = compare(base);
    for (const strategy of StrategyIdSchema.options) {
      expect(c[strategy]!.metrics.demandKwh - baseDemand[strategy]!.metrics.demandKwh).toBeCloseTo(
        extraKwh,
        9
      );
    }
  });
});
