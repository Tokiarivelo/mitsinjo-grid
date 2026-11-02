import { describe, it, expect } from 'vitest';
import {
  scenarios,
  simulate,
  applianceSummary,
  sectorApplianceKw,
  type Appliance,
} from '@mitsinjo/engine';
import { getResultEntry } from '../result-cache';
import {
  executeTool,
  GetGridStateSchema,
  RunScenarioSchema,
  CompareStrategiesSchema,
  GetSectorMetricsSchema,
  ProposeChangeSchema,
  TOOL_DEFINITIONS,
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

    it('get_grid_state hourly: 24 engine points and highlights picked from them, all in evidence', () => {
      const res = executeTool('get_grid_state', { hourly: true }, ctx);
      const hourly = res.data?.hourly as { t: number; solarKw: number; socPct: number }[];
      expect(hourly).toHaveLength(24);
      const sim = simulate(ctx.input, ctx.activeStrategy ?? 'proportional');
      expect(hourly[12]?.solarKw).toBeCloseTo(sim.steps[12]!.solarKw, 2);
      const h = res.data?.highlights as Record<string, number>;
      expect(h.peakSolarKw).toBe(Math.max(...hourly.map((p) => p.solarKw)));
      expect(h.lowestSocPct).toBe(Math.min(...hourly.map((p) => p.socPct)));
      expect(res.evidence).toMatchObject(h);
      // Without the flag the payload stays compact.
      expect(executeTool('get_grid_state', {}, ctx).data?.hourly).toBeUndefined();
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

    it('appliance patches pass positions through unchanged, feeder (sector) intact (PP-T7)', () => {
      const appliances = [
        {
          id: 'a1',
          name: 'Pump',
          category: 'water_pump',
          sector: 'water',
          watts: 750,
          quantity: 1,
          position: { x: 30, z: 30 },
        },
        { id: 'a2', name: 'Lamp', category: 'lamp', sector: 'households', watts: 10, quantity: 2 },
      ];
      const res = executeTool(
        'propose_change',
        { patch: { appliances }, reason: 'Add inserted loads' },
        ctx
      );
      expect(res.error).toBeUndefined();
      expect(res.proposal?.patch?.appliances).toEqual(appliances);
      const run = executeTool(
        'run_scenario',
        { patch: { appliances }, strategy: 'proportional' },
        ctx
      );
      expect(run.error).toBeUndefined();
      expect(run.data?.metrics).toBeDefined();
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

    it('run_scenario remembers its result for generate_visual (M5-T1)', () => {
      const res = executeTool('run_scenario', { scenarioId: 'cloudy_afternoon' }, ctx);
      expect(res.error).toBeUndefined();
      expect(res.resultId).toBeTruthy();
      expect(getResultEntry(res.resultId ?? '')).not.toBeNull();
    });

    describe('get_battery_story (M7-T3)', () => {
      const cloudyCtx = {
        input: scenarios.cloudy_afternoon.input,
        activeStrategy: 'proportional' as const,
      };

      it('traces the drain window with engine evidence', () => {
        const res = executeTool('get_battery_story', { hour: 3 }, cloudyCtx);
        expect(res.error).toBeUndefined();
        const story = res.data as { hour: number; socPct: number; peak: { hour: number } };
        expect(story.hour).toBe(3);
        expect(res.evidence?.battery_socPct).toBe(story.socPct);
        expect(res.evidence?.battery_peakHour).toBe(story.peak.hour);
      });

      it('defaults to the emptiest hour and rejects out-of-range hours', () => {
        const res = executeTool('get_battery_story', {}, cloudyCtx);
        expect(res.error).toBeUndefined();
        expect((res.data as { hour: number }).hour).toBeGreaterThanOrEqual(0);
        expect(executeTool('get_battery_story', { hour: 99 }, cloudyCtx).error).toContain(
          'Invalid args for get_battery_story'
        );
      });
    });

    describe('simulate_week (M7-T2)', () => {
      const stormWeek = Array.from({ length: 7 }, () => ({ weather: 'storm' as const }));

      it('simulates 7 days with battery carryover, totals, plan and worst day', () => {
        const res = executeTool('simulate_week', { days: stormWeek }, ctx);
        expect(res.error).toBeUndefined();
        const data = res.data as {
          days: { day: number; weather: string; resultId: string; unservedKwh: number }[];
          totals: { unservedKwh: number; criticalUnservedKwh: number };
          plan: { strategy: string; worstDay: number };
        };
        expect(data.days).toHaveLength(7);
        expect(data.days.map((d) => d.weather)).toEqual(Array(7).fill('storm'));
        // Totals are the days' sums (rounded).
        const sum = data.days.reduce((n, d) => n + d.unservedKwh, 0);
        expect(data.totals.unservedKwh).toBeCloseTo(Math.round(sum * 100) / 100, 5);
        // The plan recommends a real strategy and names the worst day.
        expect(['proportional', 'essential_first', 'balanced']).toContain(data.plan.strategy);
        const worst = data.days.reduce((a, b) => (b.unservedKwh > a.unservedKwh ? b : a));
        expect(data.plan.worstDay).toBe(worst.day);
        // Evidence carries the week numbers (cited by the answer).
        expect(res.evidence?.week_unservedKwh).toBe(data.totals.unservedKwh);
        // Each day is remembered for generate_visual.
        for (const d of data.days) {
          expect(getResultEntry(d.resultId)).not.toBeNull();
        }
      });

      it('rejects bad weather and weeks over 7 days', () => {
        expect(
          executeTool('simulate_week', { days: [{ weather: 'tornado' }] }, ctx).error
        ).toContain('Invalid args for simulate_week');
        expect(
          executeTool(
            'simulate_week',
            { days: Array.from({ length: 8 }, () => ({ weather: 'sunny' })) },
            ctx
          ).error
        ).toContain('Invalid args for simulate_week');
      });
    });

    describe('appliance reporting (PV-T14)', () => {
      const pump1: Appliance = {
        id: 'pump-1',
        name: 'Village Pump',
        category: 'water_pump',
        sector: 'water',
        watts: 750,
        quantity: 1,
      };
      const pump2: Appliance = {
        id: 'pump-2',
        name: 'Field Pump',
        category: 'water_pump',
        sector: 'water',
        watts: 750,
        quantity: 2,
      };
      const lamp: Appliance = {
        id: 'lamp-1',
        name: 'Lamp',
        category: 'lamp',
        sector: 'households',
        watts: 10,
        quantity: 2,
      };
      const appCtx = {
        input: { ...baseInput, appliances: [pump1, pump2, lamp] },
        activeStrategy: 'proportional' as const,
      };
      const round2 = (n: number) => Math.round(n * 100) / 100;

      it('run_scenario and propose_change expose the appliances patch to the model', () => {
        for (const name of ['run_scenario', 'propose_change']) {
          const def = TOOL_DEFINITIONS.find((d) => d.name === name);
          const patchProps = (
            def?.parameters.properties as Record<string, { properties?: Record<string, unknown> }>
          ).patch?.properties;
          expect(patchProps?.appliances).toBeDefined();
        }
      });

      it('get_sector_metrics lists the inserted lines with engine loads, all in evidence', () => {
        const res = executeTool('get_sector_metrics', { sector: 'water' }, appCtx);
        expect(res.error).toBeUndefined();
        const appliances = res.data?.appliances as {
          count: number;
          dailyKwh: number;
          peakKw: number;
          lines: { id: string; name: string; quantity: number; watts: number }[];
        };
        expect(appliances.count).toBe(2);
        expect(appliances.lines.map((l) => l.name)).toEqual(['Village Pump', 'Field Pump']);
        const expectedKwh = round2(
          applianceSummary(pump1).dailyKwh + applianceSummary(pump2).dailyKwh
        );
        expect(appliances.dailyKwh).toBe(expectedKwh);
        const profile = sectorApplianceKw([pump1, pump2]).water ?? [];
        expect(appliances.peakKw).toBe(round2(Math.max(...profile)));
        expect(res.evidence?.water_applianceKwh).toBe(expectedKwh);
        expect(res.evidence?.water_appliancePeakKw).toBe(appliances.peakKw);
        expect(res.evidence?.water_applianceCount).toBe(2);
      });

      it('get_sector_metrics without inserted loads reports an empty list, no appliance evidence', () => {
        const res = executeTool('get_sector_metrics', { sector: 'water' }, ctx);
        expect(res.error).toBeUndefined();
        expect(res.data?.appliances).toEqual({ count: 0, dailyKwh: 0, peakKw: 0, lines: [] });
        expect(res.evidence?.water_applianceKwh).toBeUndefined();
      });

      it('run_scenario accepts an appliances patch and reports totals', () => {
        const res = executeTool(
          'run_scenario',
          { patch: { appliances: [pump1, pump2] }, strategy: 'proportional' },
          ctx
        );
        expect(res.error).toBeUndefined();
        const appliances = res.data?.appliances as {
          count: number;
          dailyKwh: number;
          perSector: Record<string, { count: number; dailyKwh: number }>;
        };
        expect(appliances.count).toBe(2);
        expect(appliances.perSector.water?.count).toBe(2);
        expect(res.evidence?.applianceKwh).toBe(appliances.dailyKwh);
        expect(res.evidence?.applianceCount).toBe(2);
        expect(res.evidence?.water_applianceKwh).toBe(appliances.perSector.water?.dailyKwh);
        // The patched load really runs: demand grows by the pumps' day.
        const metrics = res.data?.metrics as { demandKwh: number };
        const plain = simulate(ctx.input, 'proportional');
        expect(metrics.demandKwh).toBeCloseTo(plain.metrics.demandKwh + appliances.dailyKwh, 1);
      });

      it('run_scenario rejects an out-of-bounds appliance patch gracefully', () => {
        const res = executeTool(
          'run_scenario',
          { patch: { appliances: [{ ...pump1, watts: 1000000 }] }, strategy: 'proportional' },
          ctx
        );
        expect(res.error).toContain('Invalid args for run_scenario');
        expect(res.data).toBeUndefined();
      });

      it('propose_change reports the after-list and its kWh delta', () => {
        const res = executeTool(
          'propose_change',
          { patch: { appliances: [pump1, pump2, lamp] }, reason: 'Add inserted loads' },
          ctx
        );
        expect(res.error).toBeUndefined();
        const appliances = res.data?.appliances as { count: number; dailyKwh: number };
        expect(appliances.count).toBe(3);
        expect(res.data?.applianceKwhDelta).toBe(appliances.dailyKwh);
        expect(res.evidence?.applianceKwhDelta).toBe(appliances.dailyKwh);
      });
    });

    describe('get_incidents + clearFires restore (M2-T4)', () => {
      const burning = {
        ...baseInput,
        events: [
          ...baseInput.events,
          { type: 'fire', sector: 'school', startHour: 14, durationH: 4 } as const,
        ],
      };
      const fireCtx = { input: burning, activeStrategy: 'proportional' as const, hour: 15 };

      it('exposes get_incidents and the clearFires patch to the model', () => {
        expect(TOOL_DEFINITIONS.some((d) => d.name === 'get_incidents')).toBe(true);
        for (const name of ['run_scenario', 'propose_change']) {
          const def = TOOL_DEFINITIONS.find((d) => d.name === name);
          const patchProps = (
            def?.parameters.properties as Record<string, { properties?: Record<string, unknown> }>
          ).patch?.properties;
          expect(patchProps?.clearFires).toBeDefined();
        }
      });

      it('reports the burning sector with its engine impact, all in evidence', () => {
        const res = executeTool('get_incidents', { hour: 15 }, fireCtx);
        expect(res.error).toBeUndefined();
        const data = res.data as {
          count: number;
          incidents: {
            sector: string;
            startHour: number;
            endHour: number;
            status: string;
            unservedKwh: number;
          }[];
        };
        expect(data.count).toBe(1);
        expect(data.incidents).toEqual([
          {
            sector: 'school',
            startHour: 14,
            endHour: 18,
            status: 'burning',
            unservedKwh: data.incidents[0]!.unservedKwh,
          },
        ]);
        expect(data.incidents[0]!.unservedKwh).toBeGreaterThan(0);
        expect(res.evidence?.incidentCount).toBe(1);
        expect(res.evidence?.school_fireUnservedKwh).toBe(data.incidents[0]!.unservedKwh);
        expect(res.evidence?.school_fireStartHour).toBe(14);
        expect(res.evidence?.school_fireEndHour).toBe(18);
      });

      it('status follows the hour; defaults to the app hour and active strategy', () => {
        const upcoming = executeTool('get_incidents', { hour: 10 }, fireCtx);
        expect((upcoming.data as { incidents: { status: string }[] }).incidents[0]?.status).toBe(
          'upcoming'
        );
        const over = executeTool('get_incidents', { hour: 20 }, fireCtx);
        expect((over.data as { incidents: { status: string }[] }).incidents[0]?.status).toBe(
          'over'
        );
        const implicit = executeTool('get_incidents', {}, fireCtx);
        expect((implicit.data as { hour: number }).hour).toBe(15);
        expect((implicit.data as { strategy: string }).strategy).toBe('proportional');
      });

      it('without fire reports zero incidents and no per-sector evidence', () => {
        const res = executeTool('get_incidents', {}, ctx);
        expect(res.error).toBeUndefined();
        expect(res.data).toMatchObject({ count: 0, incidents: [] });
        expect(res.evidence?.incidentCount).toBe(0);
        expect(res.evidence?.school_fireUnservedKwh).toBeUndefined();
      });

      it('rejects an out-of-range hour gracefully', () => {
        const res = executeTool('get_incidents', { hour: 30 }, fireCtx);
        expect(res.error).toContain('Invalid args for get_incidents');
      });

      it('propose_change restores with clearFires: impact shows the sector served again', () => {
        const res = executeTool(
          'propose_change',
          { patch: { clearFires: ['school'] }, reason: 'Fire out, restore the school' },
          fireCtx
        );
        expect(res.error).toBeUndefined();
        expect(res.proposal?.patch?.clearFires).toEqual(['school']);
        const school = res.proposal?.impact?.sectors.school;
        expect(school?.servedKwhAfter).toBeGreaterThan(school?.servedKwhBefore ?? 0);
      });
    });

    describe('edit_appliance (PV-T11b)', () => {
      const pump: Appliance = {
        id: 'a1',
        name: 'Pump',
        category: 'water_pump',
        sector: 'water',
        watts: 750,
        quantity: 1,
        position: { x: 10, z: 20 },
      };
      const lamp: Appliance = {
        id: 'a2',
        name: 'Lamp',
        category: 'lamp',
        sector: 'households',
        watts: 10,
        quantity: 2,
      };
      const appCtx = {
        input: { ...baseInput, appliances: [pump, lamp] },
        activeStrategy: 'proportional' as const,
      };

      it('merges fields onto the line and proposes the full list', () => {
        const res = executeTool(
          'edit_appliance',
          { id: 'a1', watts: 900, sector: 'market', reason: 'Bigger pump on market' },
          appCtx
        );
        expect(res.error).toBeUndefined();
        expect(res.proposal?.patch?.appliances).toEqual([
          { ...pump, watts: 900, sector: 'market' },
          lamp,
        ]);
        expect(res.proposal?.reason).toBe('Bigger pump on market');
        expect(res.evidence?.unservedKwhBefore).toBeDefined();
      });

      it('omitted fields keep their values, including the position', () => {
        const res = executeTool('edit_appliance', { id: 'a1', watts: 900, reason: 'r' }, appCtx);
        expect(res.error).toBeUndefined();
        expect(res.proposal?.patch?.appliances?.[0]).toEqual({ ...pump, watts: 900 });
      });

      it('echoed positions pass through; unknown ids and bad merges fail gracefully', () => {
        const echo = executeTool(
          'edit_appliance',
          { id: 'a1', position: { x: 30, z: 30 }, reason: 'r' },
          appCtx
        );
        expect(echo.error).toBeUndefined();
        expect(echo.proposal?.patch?.appliances?.[0]).toEqual({
          ...pump,
          position: { x: 30, z: 30 },
        });
        const unknown = executeTool(
          'edit_appliance',
          { id: 'ghost', watts: 5, reason: 'r' },
          appCtx
        );
        expect(unknown.error).toContain("Unknown appliance id 'ghost'");
        expect(unknown.proposal).toBeUndefined();
        const badMerge = executeTool(
          'edit_appliance',
          { id: 'a2', watts: 1000000, reason: 'r' },
          appCtx
        );
        expect(badMerge.error).toContain('watts');
        expect(badMerge.proposal).toBeUndefined();
        const badArgs = executeTool('edit_appliance', { id: 'a1', quantity: 0 }, appCtx);
        expect(badArgs.error).toContain('Invalid args for edit_appliance');
      });
    });
  });
});
