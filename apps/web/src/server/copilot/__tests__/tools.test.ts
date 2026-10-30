import { describe, it, expect } from 'vitest';
import { scenarios } from '@mitsinjo/engine';
import {
  executeTool,
  GetGridStateSchema,
  RunScenarioSchema,
  CompareStrategiesSchema,
  GetSectorMetricsSchema,
  ProposeChangeSchema,
} from '../tools';

describe('Copilot Tools (P6-T2)', () => {
  const baseInput = scenarios.baseline.input;
  const ctx = { input: baseInput, activeStrategy: 'proportional' as const };

  describe('Zod Schemas', () => {
    it('validates get_grid_state args', () => {
      expect(GetGridStateSchema.safeParse({}).success).toBe(true);
    });

    it('validates run_scenario args and enforces bounds', () => {
      expect(
        RunScenarioSchema.safeParse({
          patch: { solarDropPct: 40, dropStartHour: 12, dropDurationH: 2 },
          strategy: 'essential_first',
        }).success
      ).toBe(true);

      // solarDropPct > 90 must fail
      expect(
        RunScenarioSchema.safeParse({
          patch: { solarDropPct: 150 },
        }).success
      ).toBe(false);
    });

    it('validates compare_strategies args', () => {
      expect(
        CompareStrategiesSchema.safeParse({
          strategies: ['proportional', 'essential_first'],
        }).success
      ).toBe(true);
    });

    it('validates get_sector_metrics args', () => {
      expect(
        GetSectorMetricsSchema.safeParse({
          sector: 'health',
          strategy: 'proportional',
        }).success
      ).toBe(true);

      expect(
        GetSectorMetricsSchema.safeParse({
          sector: 'spaceport',
        }).success
      ).toBe(false);
    });

    it('validates propose_change args', () => {
      expect(
        ProposeChangeSchema.safeParse({
          patch: { solarDropPct: 20 },
          reason: 'Protect vaccine refrigeration',
        }).success
      ).toBe(true);

      expect(
        ProposeChangeSchema.safeParse({
          patch: { solarDropPct: 150 },
          reason: 'Too high drop',
        }).success
      ).toBe(false);
    });
  });

  describe('executeTool execution', () => {
    it('executes get_grid_state and returns compact summary & evidence', () => {
      const res = executeTool('get_grid_state', {}, ctx);
      expect(res.error).toBeUndefined();
      expect(res.resultId).toMatch(/^SIM-/);
      expect(res.data?.scenarioId).toBe('baseline');
      expect(res.evidence?.solarPeakKw).toBe(baseInput.solar.peakKw);
    });

    it('executes run_scenario with valid patch and returns metrics', () => {
      const res = executeTool(
        'run_scenario',
        {
          patch: { solarDropPct: 40, dropStartHour: 13, dropDurationH: 2 },
          strategy: 'proportional',
        },
        ctx
      );
      expect(res.error).toBeUndefined();
      expect(res.resultId).toMatch(/^SIM-/);
      expect(res.data?.metrics).toBeDefined();
      expect(res.evidence?.criticalCoveragePct).toBeDefined();
    });

    it('executes compare_strategies and returns all strategies', () => {
      const res = executeTool(
        'compare_strategies',
        { strategies: ['proportional', 'essential_first'] },
        ctx
      );
      expect(res.error).toBeUndefined();
      const compData = res.data as Record<string, { resultId: string }>;
      expect(compData.proportional).toBeDefined();
      expect(compData.essential_first).toBeDefined();
      expect(res.evidence?.proportional_criticalCoveragePct).toBeDefined();
      expect(res.evidence?.essential_first_criticalCoveragePct).toBeDefined();
    });

    it('executes get_sector_metrics and returns sector details + hourly profile', () => {
      const res = executeTool(
        'get_sector_metrics',
        { sector: 'health', strategy: 'proportional' },
        ctx
      );
      expect(res.error).toBeUndefined();
      expect(res.data?.sector).toBe('health');
      expect(res.data?.priority).toBe('critical');
      const hourly = res.data?.hourly as Array<{ t: number; demandKw: number; servedKw: number }>;
      expect(hourly).toHaveLength(24);
      expect(res.evidence?.health_demandKwh).toBeDefined();
    });

    it('get_sector_metrics defaults to the active strategy', () => {
      const stressed = {
        input: scenarios.essential_stress.input,
        activeStrategy: 'essential_first' as const,
      };
      const implicit = executeTool('get_sector_metrics', { sector: 'health' }, stressed);
      const explicit = executeTool(
        'get_sector_metrics',
        { sector: 'health', strategy: 'essential_first' },
        stressed
      );
      expect(implicit.resultId).toBe(explicit.resultId);
    });

    it('executes propose_change without mutating state', () => {
      const res = executeTool(
        'propose_change',
        {
          patch: { solarDropPct: 30 },
          reason: 'Test proposal',
        },
        ctx
      );
      expect(res.error).toBeUndefined();
      expect(res.proposal).toBeDefined();
      expect(res.proposal?.proposalId).toMatch(/^PROP-/);
      expect(res.proposal?.reason).toBe('Test proposal');
      // Verify ctx input is untouched
      expect(ctx.input.solar.peakKw).toBe(baseInput.solar.peakKw);
    });

    it('propose_change flags a clinic cut for the model, not a safe change (M1-T2)', () => {
      const unsafe = executeTool(
        'propose_change',
        {
          patch: { sectorCaps: [{ sector: 'health', maxKw: 0, fromHour: 18, toHour: 22 }] },
          reason: 'Cut the clinic tonight',
        },
        ctx
      );
      expect(unsafe.data?.clinicGuard).toEqual(['cap_zero']);
      const safe = executeTool(
        'propose_change',
        { patch: { solarDropPct: 30 }, reason: 'Safe change' },
        ctx
      );
      expect(safe.data?.clinicGuard).toBeUndefined();
    });

    it('propose_change attaches the engine before/after impact, all of it in evidence (M1-T1)', () => {
      const res = executeTool(
        'propose_change',
        {
          patch: { sectorCaps: [{ sector: 'market', maxKw: 0, fromHour: 8, toHour: 12 }] },
          reason: 'Cut the market this morning',
        },
        ctx
      );
      expect(res.error).toBeUndefined();
      const impact = res.proposal?.impact;
      expect(impact).toBeDefined();
      const market = impact!.sectors.market!;
      expect(market.offHoursAfter).toBeGreaterThan(market.offHoursBefore);
      expect(market.servedKwhAfter).toBeLessThan(market.servedKwhBefore);
      // Only changed sectors are kept.
      expect(impact!.sectors.industry).toBeUndefined();
      // Every number the dialog shows is an evidence value.
      const evidenceValues = new Set(Object.values(res.evidence ?? {}));
      const shown = [
        impact!.socMinPctBefore,
        impact!.socMinPctAfter,
        impact!.unservedKwhBefore,
        impact!.unservedKwhAfter,
        ...Object.values(impact!.sectors).flatMap((s) =>
          s
            ? [
                s.servedKwhBefore,
                s.servedKwhAfter,
                s.servedKwhDelta,
                s.offHoursBefore,
                s.offHoursAfter,
              ]
            : []
        ),
      ];
      for (const n of shown) expect(evidenceValues.has(n)).toBe(true);
    });

    it('propose_change with a strategy only compares current vs proposed strategy', () => {
      const res = executeTool(
        'propose_change',
        { strategy: 'essential_first', reason: 'Protect the clinic' },
        { ...ctx, activeStrategy: 'proportional' }
      );
      expect(res.proposal?.impact?.strategyBefore).toBe('proportional');
      expect(res.proposal?.impact?.strategyAfter).toBe('essential_first');
    });

    it('executes propose_change with strategy rules (criticalShares & balancedWeights) (PZ-T10)', () => {
      const res = executeTool(
        'propose_change',
        {
          patch: {
            criticalShares: { health: 0.9, water: 0.4 },
            balancedWeights: { critical: 5, high: 3, medium: 2, low: 1 },
          },
          reason: 'Increase health lifeline and tune balanced weights',
        },
        ctx
      );
      expect(res.error).toBeUndefined();
      expect(res.proposal).toBeDefined();
      expect(res.proposal?.patch?.criticalShares).toEqual({ health: 0.9, water: 0.4 });
      expect(res.proposal?.patch?.balancedWeights).toEqual({
        critical: 5,
        high: 3,
        medium: 2,
        low: 1,
      });
    });

    it('executes propose_change with lifeline floor (PL-T14)', () => {
      const res = executeTool(
        'propose_change',
        {
          patch: {
            lifeline: {
              enabled: true,
              kw: { households: 0.4, school: 0.2 },
            },
          },
          reason: 'Keep essential lighting active without cutting the neighborhood',
        },
        ctx
      );
      expect(res.error).toBeUndefined();
      expect(res.proposal).toBeDefined();
      expect(res.proposal?.patch?.lifeline).toEqual({
        enabled: true,
        kw: { households: 0.4, school: 0.2 },
      });
      expect(res.proposal?.proposalId).toMatch(/^PROP-/);
      // Verify ctx input is untouched
      expect(ctx.input.sectors.find((s) => s.id === 'households')?.lifelineKw).toBe(
        baseInput.sectors.find((s) => s.id === 'households')?.lifelineKw
      );
    });

    it('compactMetrics and compare_strategies include lifelineCoveragePct (PL-T14)', () => {
      const res = executeTool('compare_strategies', {}, ctx);
      expect(res.error).toBeUndefined();
      expect(res.evidence?.proportional_lifelineCoveragePct).toBeDefined();
      expect(res.evidence?.essential_first_lifelineCoveragePct).toBeDefined();
    });

    it('returns structured error for invalid args without throwing', () => {
      const res = executeTool('run_scenario', { patch: { solarDropPct: 150 } }, ctx);
      expect(res.error).toBeDefined();
      expect(res.error).toContain('Invalid args for run_scenario');
    });

    it('returns structured error for unknown tool', () => {
      const res = executeTool('hack_grid', {}, ctx);
      expect(res.error).toContain('Unknown tool: hack_grid');
    });
  });
});
