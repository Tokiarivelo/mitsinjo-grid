import 'server-only';

import { z } from 'zod';
import {
  type SimulationInput,
  type StrategyId,
  type Metrics,
  type InputPatch,
  InputPatchSchema,
  simulate,
  compare,
  applyPatch,
  scenarios,
} from '@mitsinjo/engine';
import type { ToolDefinition } from './provider';

function round2(val: number): number {
  return Math.round(val * 100) / 100;
}

function extractNumericMetrics(cm: Record<string, unknown>): Record<string, number> {
  const result: Record<string, number> = {};
  for (const [k, v] of Object.entries(cm)) {
    if (typeof v === 'number') {
      result[k] = v;
    }
  }
  return result;
}

export function compactMetrics(m: Metrics) {
  return {
    demandKwh: round2(m.demandKwh),
    servedKwh: round2(m.servedKwh),
    unservedKwh: round2(m.unservedKwh),
    criticalDemandKwh: round2(m.criticalDemandKwh),
    criticalUnservedKwh: round2(m.criticalUnservedKwh),
    criticalUnmetHours: m.criticalUnmetHours,
    criticalCoveragePct: round2(m.criticalCoveragePct),
    solarKwh: round2(m.solarKwh),
    curtailedKwh: round2(m.curtailedKwh),
    socStartPct: round2(m.socStartPct),
    socEndPct: round2(m.socEndPct),
    socMinPct: round2(m.socMinPct),
    affectedSectors: m.affectedSectors,
  };
}

// Zod argument schemas for the 5 tools
export const GetGridStateSchema = z.object({});

export const RunScenarioSchema = z.object({
  scenarioId: z
    .enum([
      'baseline',
      'cloudy_afternoon',
      'high_demand',
      'battery_constraint',
      'essential_stress',
      'meter_anomaly',
    ])
    .optional(),
  patch: InputPatchSchema.optional(),
  strategy: z.enum(['proportional', 'essential_first', 'balanced']).default('proportional'),
});

export const CompareStrategiesSchema = z.object({
  strategies: z.array(z.enum(['proportional', 'essential_first', 'balanced'])).optional(),
});

export const GetSectorMetricsSchema = z.object({
  sector: z.enum(['health', 'water', 'school', 'households', 'market']),
  // Omitted → the user's active strategy (not always proportional).
  strategy: z.enum(['proportional', 'essential_first', 'balanced']).optional(),
});

export const ProposeChangeSchema = z
  .object({
    patch: InputPatchSchema.optional(),
    strategy: z.enum(['proportional', 'essential_first', 'balanced']).optional(),
    reason: z.string().min(1).max(500),
  })
  .refine((data) => data.patch !== undefined || data.strategy !== undefined, {
    message: 'At least one of patch or strategy must be specified.',
  });

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: 'get_grid_state',
    description:
      'Inspect the current microgrid simulation state, active scenario parameters, and summary metrics.',
    parameters: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: 'run_scenario',
    description:
      'Run a simulation with an optional scenario preset, parameter patch (such as solarDropPct ≤ 90), and dispatch strategy. Returns computed metrics and warnings.',
    parameters: {
      type: 'object',
      properties: {
        scenarioId: {
          type: 'string',
          enum: [
            'baseline',
            'cloudy_afternoon',
            'high_demand',
            'battery_constraint',
            'essential_stress',
            'meter_anomaly',
          ],
          description: 'Optional scenario preset ID to simulate.',
        },
        patch: {
          type: 'object',
          description: 'Optional parameter patch.',
          properties: {
            solarDropPct: {
              type: 'number',
              description: 'Percentage drop in solar production (0 to 90).',
            },
            dropStartHour: {
              type: 'integer',
              description: 'Start hour of solar drop event (0 to 23).',
            },
            dropDurationH: {
              type: 'integer',
              description: 'Duration in hours of solar drop (1 to 24).',
            },
            demandMultiplier: {
              type: 'number',
              description: 'Global demand multiplier (0.5 to 2.0).',
            },
            batteryCapacityKwh: {
              type: 'number',
              description: 'Total battery storage capacity (1 to 2000 kWh).',
            },
            initialSocPct: {
              type: 'number',
              description: 'Initial battery state of charge (0 to 100%).',
            },
            minSocPct: {
              type: 'number',
              description: 'Minimum reserve battery state of charge (0 to 100%).',
            },
            criticalShares: {
              type: 'object',
              description:
                'Critical lifeline share per sector (0 to 1) for health, water, school, households, market.',
            },
            balancedWeights: {
              type: 'object',
              description:
                'Priority weights (0 to 10) for balanced strategy (critical, high, medium, low).',
            },
          },
        },
        strategy: {
          type: 'string',
          enum: ['proportional', 'essential_first', 'balanced'],
          description: 'Allocation strategy to evaluate (default: proportional).',
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'compare_strategies',
    description:
      'Compare dispatch strategies (proportional, essential_first, balanced) on the current scenario input.',
    parameters: {
      type: 'object',
      properties: {
        strategies: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['proportional', 'essential_first', 'balanced'],
          },
          description: 'List of strategies to compare. Defaults to all 3.',
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'get_sector_metrics',
    description:
      'Fetch detailed metrics and 24-hour power profile for a specific sector (health, water, school, households, market).',
    parameters: {
      type: 'object',
      properties: {
        sector: {
          type: 'string',
          enum: ['health', 'water', 'school', 'households', 'market'],
          description: 'The target sector to examine.',
        },
        strategy: {
          type: 'string',
          enum: ['proportional', 'essential_first', 'balanced'],
          description: 'The dispatch strategy to inspect (default: the active strategy).',
        },
      },
      required: ['sector'],
      additionalProperties: false,
    },
  },
  {
    name: 'propose_change',
    description:
      'Propose a scenario parameter change or strategy switch to the human operator for review. Does NOT automatically apply changes.',
    parameters: {
      type: 'object',
      properties: {
        patch: {
          type: 'object',
          description: 'Optional parameter patch to propose.',
          properties: {
            solarDropPct: { type: 'number' },
            dropStartHour: { type: 'integer' },
            dropDurationH: { type: 'integer' },
            demandMultiplier: { type: 'number' },
            batteryCapacityKwh: { type: 'number' },
            initialSocPct: { type: 'number' },
            minSocPct: { type: 'number' },
            priorities: {
              type: 'object',
              description: 'Sector priority overrides (critical, high, medium, low).',
            },
            sectorCaps: {
              type: 'array',
              description: 'Sector capacity limits {sector, maxKw, fromHour, toHour}.',
              items: {
                type: 'object',
                properties: {
                  sector: {
                    type: 'string',
                    enum: ['health', 'water', 'school', 'households', 'market'],
                  },
                  maxKw: { type: 'number' },
                  fromHour: { type: 'integer' },
                  toHour: { type: 'integer' },
                },
                required: ['sector', 'maxKw', 'fromHour', 'toHour'],
              },
            },
            criticalShares: {
              type: 'object',
              description:
                'Critical lifeline share per sector (0 to 1) for health, water, school, households, market.',
            },
            balancedWeights: {
              type: 'object',
              description:
                'Priority weights (0 to 10) for balanced strategy (critical, high, medium, low).',
            },
          },
        },
        strategy: {
          type: 'string',
          enum: ['proportional', 'essential_first', 'balanced'],
          description: 'Optional allocation strategy switch to propose.',
        },
        reason: {
          type: 'string',
          description: 'Clear justification for the proposed modification.',
        },
      },
      required: ['reason'],
      additionalProperties: false,
    },
  },
];

export interface ToolContext {
  input: SimulationInput;
  activeStrategy?: StrategyId;
}

export interface ToolResult {
  toolName: string;
  resultId?: string;
  data?: Record<string, unknown>;
  error?: string;
  proposal?: {
    proposalId: string;
    patch?: InputPatch;
    strategy?: StrategyId;
    reason: string;
  };
  evidence?: Record<string, number | string>;
}

export function executeTool(toolName: string, rawArgs: unknown, ctx: ToolContext): ToolResult {
  switch (toolName) {
    case 'get_grid_state': {
      const parsed = GetGridStateSchema.safeParse(rawArgs);
      if (!parsed.success) {
        return {
          toolName,
          error: `Invalid args for get_grid_state: ${parsed.error.message}`,
        };
      }
      const strategy: StrategyId = ctx.activeStrategy || 'proportional';
      const result = simulate(ctx.input, strategy);
      const metrics = compactMetrics(result.metrics);

      return {
        toolName,
        resultId: result.id,
        data: {
          scenarioId: ctx.input.scenarioId,
          inputSummary: {
            solarPeakKw: ctx.input.solar.peakKw,
            batteryCapacityKwh: ctx.input.battery.capacityKwh,
            initialSocPct: ctx.input.battery.initialSocPct,
            minSocPct: ctx.input.battery.minSocPct,
            demandMultiplier: ctx.input.demandMultiplier,
          },
          strategy,
          resultId: result.id,
          metrics,
        },
        evidence: {
          ...extractNumericMetrics(metrics),
          solarPeakKw: ctx.input.solar.peakKw,
          batteryCapacityKwh: ctx.input.battery.capacityKwh,
        },
      };
    }

    case 'run_scenario': {
      const parsed = RunScenarioSchema.safeParse(rawArgs);
      if (!parsed.success) {
        return {
          toolName,
          error: `Invalid args for run_scenario: ${parsed.error.message}`,
        };
      }
      let baseInput = ctx.input;
      if (parsed.data.scenarioId) {
        const preset = scenarios[parsed.data.scenarioId];
        if (preset) {
          baseInput = preset.input;
        }
      }
      let finalInput = baseInput;
      if (parsed.data.patch) {
        try {
          finalInput = applyPatch(baseInput, parsed.data.patch);
        } catch (err) {
          return {
            toolName,
            error: `Failed to apply patch: ${err instanceof Error ? err.message : String(err)}`,
          };
        }
      }
      const result = simulate(finalInput, parsed.data.strategy);
      const metrics = compactMetrics(result.metrics);

      return {
        toolName,
        resultId: result.id,
        data: {
          resultId: result.id,
          strategy: parsed.data.strategy,
          metrics,
          warnings: result.warnings,
        },
        evidence: {
          ...extractNumericMetrics(metrics),
        },
      };
    }

    case 'compare_strategies': {
      const parsed = CompareStrategiesSchema.safeParse(rawArgs);
      if (!parsed.success) {
        return {
          toolName,
          error: `Invalid args for compare_strategies: ${parsed.error.message}`,
        };
      }
      const strats: readonly StrategyId[] =
        parsed.data.strategies && parsed.data.strategies.length > 0
          ? parsed.data.strategies
          : ['proportional', 'essential_first', 'balanced'];

      const comp = compare(ctx.input, strats);
      const data: Record<string, unknown> = {};
      const evidence: Record<string, number | string> = {};

      for (const [sId, res] of Object.entries(comp)) {
        if (!res) continue;
        const cm = compactMetrics(res.metrics);
        data[sId] = {
          resultId: res.id,
          metrics: cm,
        };
        evidence[`${sId}_criticalCoveragePct`] = cm.criticalCoveragePct;
        evidence[`${sId}_unservedKwh`] = cm.unservedKwh;
        evidence[`${sId}_servedKwh`] = cm.servedKwh;
      }

      const firstRes = Object.values(comp)[0];

      return {
        toolName,
        resultId: firstRes?.id,
        data,
        evidence,
      };
    }

    case 'get_sector_metrics': {
      const parsed = GetSectorMetricsSchema.safeParse(rawArgs);
      if (!parsed.success) {
        return {
          toolName,
          error: `Invalid args for get_sector_metrics: ${parsed.error.message}`,
        };
      }
      const sectorId = parsed.data.sector;
      const strategy: StrategyId = parsed.data.strategy ?? ctx.activeStrategy ?? 'proportional';
      const result = simulate(ctx.input, strategy);
      const secMetrics = result.metrics.perSector[sectorId];
      const sectorConfig = ctx.input.sectors.find((s) => s.id === sectorId);

      const hourly = result.steps.map((st) => ({
        t: st.t,
        demandKw: round2(st.sectors[sectorId]?.demandKw ?? 0),
        servedKw: round2(st.sectors[sectorId]?.servedKw ?? 0),
      }));

      const compactSec = {
        sector: sectorId,
        priority: sectorConfig?.priority ?? 'medium',
        demandKwh: round2(secMetrics?.demandKwh ?? 0),
        servedKwh: round2(secMetrics?.servedKwh ?? 0),
        unservedKwh: round2(secMetrics?.unservedKwh ?? 0),
        coveragePct: round2(secMetrics?.coveragePct ?? 0),
        hourly,
      };

      return {
        toolName,
        resultId: result.id,
        data: compactSec,
        evidence: {
          [`${sectorId}_demandKwh`]: compactSec.demandKwh,
          [`${sectorId}_servedKwh`]: compactSec.servedKwh,
          [`${sectorId}_unservedKwh`]: compactSec.unservedKwh,
          [`${sectorId}_coveragePct`]: compactSec.coveragePct,
        },
      };
    }

    case 'propose_change': {
      const parsed = ProposeChangeSchema.safeParse(rawArgs);
      if (!parsed.success) {
        return {
          toolName,
          error: `Invalid args for propose_change: ${parsed.error.message}`,
        };
      }
      // Generate deterministic proposal id based on patch, strategy & reason
      const rawKey = JSON.stringify({
        p: parsed.data.patch,
        s: parsed.data.strategy,
        r: parsed.data.reason,
      });
      let hash = 0;
      for (let i = 0; i < rawKey.length; i++) {
        hash = ((hash << 5) - hash + rawKey.charCodeAt(i)) | 0;
      }
      const proposalId = `PROP-${Math.abs(hash).toString(16).toUpperCase().padStart(6, '0').slice(0, 6)}`;

      const proposal = {
        proposalId,
        patch: parsed.data.patch,
        strategy: parsed.data.strategy,
        reason: parsed.data.reason,
      };

      return {
        toolName,
        proposal,
        data: {
          proposalId,
          status: 'pending_operator_approval',
          patch: parsed.data.patch,
          strategy: parsed.data.strategy,
          reason: parsed.data.reason,
        },
      };
    }

    default:
      return {
        toolName,
        error: `Unknown tool: ${toolName}`,
      };
  }
}
