import { describe, expect, it } from 'vitest';
import { compare, compareLifelineCoverage } from '../compare';
import { DEFAULT_LIFELINE_KW, EPS } from '../constants';
import { canonicalJson, computeInputHash } from '../hash';
import { checkStepInvariants } from '../invariants';
import type { SectorDemandStep } from '../model/demand';
import { applyPatch } from '../patch';
import { InputPatchSchema, SectorConfigSchema, StepResult, StrategyParamsSchema } from '../schemas';
import { createBaselineInput, scenarios } from '../scenarios';
import { simulate } from '../simulate';
import { computeLifelinePass, computeSectorMode, executeStrategy } from '../strategies';

describe('Lifeline Survival Dispatch (PL-T1...PL-T4)', () => {
  describe('PL-T1: Contracts, Schemas & Hash Stability', () => {
    it('validates SectorConfig.lifelineKw bounds (>= 0)', () => {
      const validSector = {
        id: 'health',
        label: 'Clinic',
        priority: 'critical',
        criticalShare: 0.8,
        profileKw: new Array(24).fill(1),
        flexible: false,
        lifelineKw: 0.3,
      };
      expect(SectorConfigSchema.safeParse(validSector).success).toBe(true);

      const invalidSector = { ...validSector, lifelineKw: -0.1 };
      expect(SectorConfigSchema.safeParse(invalidSector).success).toBe(false);
    });

    it('validates StrategyParams with optional lifeline enabled flag', () => {
      expect(StrategyParamsSchema.safeParse({ lifeline: { enabled: true } }).success).toBe(true);
      expect(StrategyParamsSchema.safeParse({ lifeline: { enabled: false } }).success).toBe(true);
      expect(StrategyParamsSchema.safeParse({ lifeline: {} }).success).toBe(false);
    });

    it('preserves canonical hash stability when strategyParams.lifeline is default (enabled: true)', () => {
      const inputWithout = createBaselineInput();
      const inputWithDefault = {
        ...createBaselineInput(),
        strategyParams: {
          lifeline: { enabled: true },
        },
      };

      expect(canonicalJson(inputWithout)).toBe(canonicalJson(inputWithDefault));
      expect(computeInputHash(inputWithout)).toBe(computeInputHash(inputWithDefault));
    });

    it('preserves canonical hash stability when sectors have default lifelineKw', () => {
      const inputWithout = createBaselineInput();
      const inputWithDefaults = createBaselineInput();
      for (const s of inputWithDefaults.sectors) {
        s.lifelineKw = DEFAULT_LIFELINE_KW[s.id];
      }

      expect(canonicalJson(inputWithout)).toBe(canonicalJson(inputWithDefaults));
      expect(computeInputHash(inputWithout)).toBe(computeInputHash(inputWithDefaults));
    });

    it('produces different hash when lifeline is explicitly disabled or floors changed', () => {
      const base = createBaselineInput();
      const disabled = {
        ...createBaselineInput(),
        strategyParams: { lifeline: { enabled: false } },
      };
      expect(computeInputHash(disabled)).not.toBe(computeInputHash(base));

      const customFloor = createBaselineInput();
      customFloor.sectors[0]!.lifelineKw = 0.8;
      expect(computeInputHash(customFloor)).not.toBe(computeInputHash(base));
    });
  });

  describe('PL-T2: Common Pass 0, Normal Mode & Emergency Mode', () => {
    const mockSectors: SectorDemandStep[] = [
      {
        sectorId: 'health',
        demandKw: 1.2,
        criticalDemandKw: 0.96,
        priority: 'critical',
        criticalShare: 0.8,
        lifelineKw: 0.3,
      },
      {
        sectorId: 'water',
        demandKw: 3.0,
        criticalDemandKw: 0.9,
        priority: 'high',
        criticalShare: 0.3,
        lifelineKw: 0.2,
      },
      {
        sectorId: 'school',
        demandKw: 1.5,
        criticalDemandKw: 0.15,
        priority: 'medium',
        criticalShare: 0.1,
        lifelineKw: 0.1,
      },
      {
        sectorId: 'households',
        demandKw: 6.0,
        criticalDemandKw: 1.2,
        priority: 'medium',
        criticalShare: 0.2,
        lifelineKw: 0.4,
      },
      {
        sectorId: 'market',
        demandKw: 2.0,
        criticalDemandKw: 0.2,
        priority: 'low',
        criticalShare: 0.1,
        lifelineKw: 0.1,
      },
    ];
    // Total demand = 13.7 kW. Total planchers = 0.3 + 0.2 + 0.1 + 0.4 + 0.1 = 1.1 kW.

    it('conserves energy and guarantees served_s >= min(demand_s, lifeline_s) when available >= Σ planchers', () => {
      const availableKw = 2.5; // > 1.1 kW planchers
      const res = executeStrategy('proportional', availableKw, mockSectors, undefined, true);

      let totalServed = 0;
      for (const s of mockSectors) {
        const step = res[s.sectorId]!;
        const floor = s.lifelineKw ?? DEFAULT_LIFELINE_KW[s.sectorId];
        expect(step.servedKw).toBeGreaterThanOrEqual(Math.min(s.demandKw, floor) - EPS);
        expect(step.lifelineServedKw).toBeCloseTo(Math.min(s.demandKw, floor), 6);
        totalServed += step.servedKw;
      }
      expect(totalServed).toBeCloseTo(availableKw, 6);
    });

    it('produces identical energy results when lifeline is disabled (lifeline.enabled = false)', () => {
      const availableKw = 4.0;
      const resDisabled = executeStrategy(
        'proportional',
        availableKw,
        mockSectors,
        undefined,
        false
      );

      // In pure proportional without lifeline:
      // ratio = 4.0 / 13.7
      const totalDemand = 13.7;
      const ratio = 4.0 / totalDemand;
      for (const s of mockSectors) {
        expect(resDisabled[s.sectorId]!.servedKw).toBeCloseTo(s.demandKw * ratio, 6);
        expect(resDisabled[s.sectorId]!.lifelineServedKw).toBe(0);
      }
    });

    describe('Emergency Mode (dispo < Σ planchers)', () => {
      it('gives water and health equal power (to ε) as long as neither reaches its floor, while others get 0 kW', () => {
        // Total planchers = 1.1 kW.
        // dispo = 0.3 kW (< 1.1 kW).
        // half = 0.15 kW.
        // health floor = 0.3, water floor = 0.2. Both > 0.15 kW.
        const pass = computeLifelinePass(0.3, mockSectors);
        expect(pass.isEmergency).toBe(true);
        expect(pass.remainingKw).toBe(0);
        expect(pass.allocations.health).toBeCloseTo(0.15, 6);
        expect(pass.allocations.water).toBeCloseTo(0.15, 6);
        expect(Math.abs(pass.allocations.health - pass.allocations.water)).toBeLessThan(EPS);

        // Others get 0 kW
        expect(pass.allocations.school).toBe(0);
        expect(pass.allocations.households).toBe(0);
        expect(pass.allocations.market).toBe(0);

        // Executed through strategy: modes must be 'lifeline' for health & water, 'off' for others
        const execRes = executeStrategy('essential_first', 0.3, mockSectors, undefined, true);
        expect(execRes.health.mode).toBe('lifeline');
        expect(execRes.water.mode).toBe('lifeline');
        expect(execRes.school.mode).toBe('off');
        expect(execRes.households.mode).toBe('off');
        expect(execRes.market.mode).toBe('off');
      });

      it('routes surplus from water to health when water reaches its floor (0.2 kW), before others get power', () => {
        // dispo = 0.46 kW.
        // half = 0.23 kW.
        // water floor is 0.2 kW, so water is limited to 0.2 kW.
        // Surplus (0.23 - 0.2 = 0.03 kW) goes to health (floor 0.3 kW).
        // Health receives 0.23 + 0.03 = 0.26 kW.
        // Others still receive 0 kW!
        const pass = computeLifelinePass(0.46, mockSectors);
        expect(pass.isEmergency).toBe(true);
        expect(pass.allocations.water).toBeCloseTo(0.2, 6);
        expect(pass.allocations.health).toBeCloseTo(0.26, 6);
        expect(pass.allocations.school).toBe(0);
        expect(pass.allocations.households).toBe(0);
        expect(pass.allocations.market).toBe(0);
      });

      it('shares remaining energy proportionally among others once health and water reach their floors', () => {
        // Health floor = 0.3, water floor = 0.2. Sum = 0.5 kW.
        // Others floors: school 0.1, households 0.4, market 0.1. Sum = 0.6 kW.
        // dispo = 0.8 kW (< 1.1 kW).
        // Health and water consume 0.5 kW.
        // Remainder = 0.3 kW.
        // School gets 0.3 * (0.1 / 0.6) = 0.05 kW.
        // Households gets 0.3 * (0.4 / 0.6) = 0.20 kW.
        // Market gets 0.3 * (0.1 / 0.6) = 0.05 kW.
        const pass = computeLifelinePass(0.8, mockSectors);
        expect(pass.isEmergency).toBe(true);
        expect(pass.allocations.health).toBeCloseTo(0.3, 6);
        expect(pass.allocations.water).toBeCloseTo(0.2, 6);
        expect(pass.allocations.school).toBeCloseTo(0.05, 6);
        expect(pass.allocations.households).toBeCloseTo(0.2, 6);
        expect(pass.allocations.market).toBeCloseTo(0.05, 6);

        const sum = Object.values(pass.allocations).reduce((acc, v) => acc + v, 0);
        expect(sum).toBeCloseTo(0.8, 6);
      });
    });

    describe('Sector capacity caps priority (PL-T2)', () => {
      it('enforces cap over floor when cap < floor (cap wins)', () => {
        // Market has floor 0.1 kW, cap is 0.04 kW
        const activeCaps = [{ sector: 'market' as const, maxKw: 0.04, fromHour: 0, toHour: 24 }];
        const pass = computeLifelinePass(2.0, mockSectors, activeCaps);
        expect(pass.effectiveFloors.market).toBe(0.04);
        expect(pass.allocations.market).toBe(0.04);
      });
    });
  });

  describe('PL-T3: Invariant LIFELINE_MET, Warnings & Metrics', () => {
    it('computes correct sector modes', () => {
      expect(computeSectorMode(0.02, 1.0, 0.4)).toBe('off');
      expect(computeSectorMode(0.3, 1.0, 0.4)).toBe('lifeline');
      expect(computeSectorMode(0.4, 1.0, 0.4)).toBe('lifeline');
      expect(computeSectorMode(0.7, 1.0, 0.4)).toBe('limited');
      expect(computeSectorMode(1.0, 1.0, 0.4)).toBe('full');
      expect(computeSectorMode(0, 0, 0.2)).toBe('off');
    });

    it('verifies LIFELINE_MET invariant holds on all standard scenarios with 0 violations', () => {
      const scenarioKeys = Object.keys(scenarios) as (keyof typeof scenarios)[];
      for (const key of scenarioKeys) {
        for (const strat of ['proportional', 'essential_first', 'balanced'] as const) {
          const sim = simulate(scenarios[key].input, strat);
          expect(sim.metrics.violations).toBe(0);
        }
      }
    });

    it('detects LIFELINE_MET violation if a sector is starved below floor when energy is available', () => {
      const dummyStep: StepResult = {
        t: 12,
        solarKw: 10,
        demandKw: 10,
        servedKw: 10,
        unservedKw: 0,
        batteryKw: 0,
        socPct: 50,
        curtailedKw: 0,
        sectors: {
          health: {
            demandKw: 1.2,
            servedKw: 0.1, // Less than floor 0.3 kW while available = 10 kW!
            criticalDemandKw: 0.96,
            criticalServedKw: 0.1,
            lifelineServedKw: 0.1,
            mode: 'lifeline',
          },
          water: {
            demandKw: 3.0,
            servedKw: 3.0,
            criticalDemandKw: 0.9,
            criticalServedKw: 0.9,
            lifelineServedKw: 0.2,
            mode: 'full',
          },
          school: {
            demandKw: 1.5,
            servedKw: 1.5,
            criticalDemandKw: 0.15,
            criticalServedKw: 0.15,
            lifelineServedKw: 0.1,
            mode: 'full',
          },
          households: {
            demandKw: 2.3,
            servedKw: 2.3,
            criticalDemandKw: 0.46,
            criticalServedKw: 0.46,
            lifelineServedKw: 0.4,
            mode: 'full',
          },
          market: {
            demandKw: 2.0,
            servedKw: 2.0,
            criticalDemandKw: 0.2,
            criticalServedKw: 0.2,
            lifelineServedKw: 0.1,
            mode: 'full',
          },
        },
      };

      const violations = checkStepInvariants({
        t: 12,
        step: dummyStep,
        prevStoredKwh: 60,
        newStoredKwh: 60,
        availableKw: 10,
        battery: {
          capacityKwh: 120,
          initialSocPct: 60,
          minSocPct: 20,
          maxChargeKw: 25,
          maxDischargeKw: 25,
          chargeEff: 0.95,
          dischargeEff: 0.95,
        },
        lifelines: DEFAULT_LIFELINE_KW,
        lifelineEnabled: true,
      });

      expect(violations).toBeGreaterThan(0);
    });

    it('emits LIFELINE_SHORTFALL warning when available energy < Σ planchers in severe deficit', () => {
      // Create severe deficit: solar peak = 0.1, battery at minSoc
      const input = structuredClone(scenarios.baseline.input);
      input.solar.peakKw = 0.1;
      input.battery.initialSocPct = 20.001;
      input.battery.minSocPct = 20;

      const sim = simulate(input, 'proportional');
      const shortfallWarnings = sim.warnings.filter((w) => w.code === 'LIFELINE_SHORTFALL');
      expect(shortfallWarnings.length).toBeGreaterThan(0);
      // Confirms shortfall names affected sectors
      expect(shortfallWarnings.some((w) => w.sector === 'school' || w.sector === 'market')).toBe(
        true
      );
    });

    it('reports 100% lifelineCoveragePct on baseline scenario', () => {
      const sim = simulate(scenarios.baseline.input, 'proportional');
      expect(sim.metrics.lifelineCoveragePct).toBe(100);
    });
  });

  describe('PL-T4: InputPatch & Compare Lifeline Coverage', () => {
    it('applies lifeline patch (enabled and kw overrides)', () => {
      const base = createBaselineInput();
      const patched = applyPatch(base, {
        lifeline: {
          enabled: false,
          kw: { health: 0.5, market: 0.2 },
        },
      });

      expect(patched.strategyParams?.lifeline?.enabled).toBe(false);
      expect(patched.sectors.find((s) => s.id === 'health')?.lifelineKw).toBe(0.5);
      expect(patched.sectors.find((s) => s.id === 'market')?.lifelineKw).toBe(0.2);
    });

    it('rejects out-of-bounds lifeline kw in patch (> 2 kW)', () => {
      expect(
        InputPatchSchema.safeParse({
          lifeline: { kw: { health: 2.5 } },
        }).success
      ).toBe(false);
      expect(
        InputPatchSchema.safeParse({
          lifeline: { kw: { health: -0.1 } },
        }).success
      ).toBe(false);
    });

    it('exposes lifeline coverage gain in compareLifelineCoverage', () => {
      const input = scenarios.cloudy_afternoon.input;
      const comp = compare(input);
      const summary = compareLifelineCoverage(comp);

      expect(summary.coveragePct.proportional).toBeDefined();
      expect(summary.coveragePct.essential_first).toBeDefined();
      expect(summary.coveragePct.balanced).toBeDefined();
      expect(summary.maxCoveragePct).toBeGreaterThanOrEqual(summary.minCoveragePct);
      expect(summary.gainPct).toBeCloseTo(summary.maxCoveragePct - summary.minCoveragePct, 6);
    });
  });
});
