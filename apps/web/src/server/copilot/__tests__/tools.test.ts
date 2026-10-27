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
