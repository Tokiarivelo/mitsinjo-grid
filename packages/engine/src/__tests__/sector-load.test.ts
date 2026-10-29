import { describe, expect, it } from 'vitest';
import { compare } from '../compare';
import { EPS } from '../constants';
import { computeInputHash } from '../hash';
import { applyPatch } from '../patch';
import { InputPatchSchema, SECTOR_IDS, SimulationInputSchema } from '../schemas';
import { createBaselineInput, scenarios } from '../scenarios';
import { simulate } from '../simulate';

const sumKwh = (r: ReturnType<typeof simulate>, id: (typeof SECTOR_IDS)[number]) =>
  r.steps.reduce((a, s) => a + (s.sectors[id]?.demandKw ?? 0), 0);

describe('Consumer sectors & live sector load', () => {
  it('every sector id has exactly one config in every scenario', () => {
    for (const sc of Object.values(scenarios)) {
      expect(sc.input.sectors.map((s) => s.id).sort()).toEqual([...SECTOR_IDS].sort());
      expect(SimulationInputSchema.safeParse(sc.input).success).toBe(true);
    }
  });

  it('rejects an input missing a sector', () => {
    const input = createBaselineInput();
    input.sectors = input.sectors.filter((s) => s.id !== 'industry');
    expect(SimulationInputSchema.safeParse(input).success).toBe(false);
  });

  it('the factory is not connected by default: no demand, results unchanged', () => {
    const input = createBaselineInput();
    const withFactory = simulate(input, 'essential_first');
    expect(sumKwh(withFactory, 'industry')).toBe(0);
    expect(withFactory.metrics.perSector.industry?.coveragePct).toBe(100);
    expect(withFactory.metrics.affectedSectors).not.toContain('industry');
  });

  it('connecting the factory adds its profile and pressures the grid', () => {
    const base = createBaselineInput();
    const connected = applyPatch(base, { sectorLoads: { industry: 1 } });
    const a = simulate(base, 'essential_first');
    const b = simulate(connected, 'essential_first');
    const factoryProfileKwh = base.sectors
      .find((s) => s.id === 'industry')!
      .profileKw.reduce((x, y) => x + y, 0);
    expect(sumKwh(b, 'industry')).toBeCloseTo(factoryProfileKwh);
    expect(b.metrics.demandKwh).toBeCloseTo(a.metrics.demandKwh + factoryProfileKwh);
  });

  it.each([0, 0.5, 2, 3])('scales one sector by × %s without touching the others', (load) => {
    const base = createBaselineInput();
    const patched = applyPatch(base, { sectorLoads: { households: load } });
    const a = simulate(base, 'proportional');
    const b = simulate(patched, 'proportional');
    expect(sumKwh(b, 'households')).toBeCloseTo(sumKwh(a, 'households') * load);
    expect(sumKwh(b, 'health')).toBeCloseTo(sumKwh(a, 'health'));
  });

  it('bounds the load multiplier (0–3)', () => {
    expect(InputPatchSchema.safeParse({ sectorLoads: { market: 3 } }).success).toBe(true);
    expect(InputPatchSchema.safeParse({ sectorLoads: { market: 3.5 } }).success).toBe(false);
    expect(InputPatchSchema.safeParse({ sectorLoads: { market: -1 } }).success).toBe(false);
  });

  it('load × 1 keeps the input hash of an untouched sector', () => {
    const base = createBaselineInput();
    const roundTrip = applyPatch(applyPatch(base, { sectorLoads: { school: 2 } }), {
      sectorLoads: { school: 1 },
    });
    const ref = applyPatch(base, {});
    expect(computeInputHash(roundTrip)).toBe(computeInputHash(ref));
  });

  it.each(Object.entries(scenarios).map(([id, s]) => [id, s.input] as const))(
    'keeps zero invariant violations with the factory connected at × 2 (%s)',
    (_, input) => {
      const patched = applyPatch(input, { sectorLoads: { industry: 2 } });
      for (const r of Object.values(compare(patched))) {
        expect(r.metrics.violations).toBe(0);
        for (const step of r.steps) {
          for (const id of SECTOR_IDS) {
            const sec = step.sectors[id];
            expect(sec).toBeDefined();
            expect(sec!.servedKw).toBeLessThanOrEqual(sec!.demandKw + EPS);
          }
        }
      }
    }
  );
});
