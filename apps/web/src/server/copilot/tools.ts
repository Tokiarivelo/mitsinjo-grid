import 'server-only';

import { z } from 'zod';
import {
  type SimulationInput,
  type StrategyId,
  type Metrics,
  type InputPatch,
  InputPatchSchema,
  SECTOR_IDS,
  SectorIdSchema,
  simulate,
  compare,
  applyPatch,
  scenarios,
  changeImpact,
  clinicGuard,
  type ChangeImpact,
  type StepResult,
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
    lifelineCoveragePct: round2(m.lifelineCoveragePct),
    solarKwh: round2(m.solarKwh),
    curtailedKwh: round2(m.curtailedKwh),
    socStartPct: round2(m.socStartPct),
    socEndPct: round2(m.socEndPct),
    socMinPct: round2(m.socMinPct),
    affectedSectors: m.affectedSectors,
  };
}

/**
 * Engine impact of a proposal, rounded for display. Keeps only sectors whose served energy
 * or off hours change, so the dialog and the evidence list the same numbers.
 */
export function compactImpact(impact: ChangeImpact): ChangeImpact {
  const sectors: ChangeImpact['sectors'] = {};
  for (const [id, s] of Object.entries(impact.sectors)) {
    if (!s) continue;
    const delta = round2(s.servedKwhDelta);
    if (delta === 0 && s.offHoursAfter === s.offHoursBefore) continue;
    sectors[id as keyof ChangeImpact['sectors']] = {
      servedKwhBefore: round2(s.servedKwhBefore),
      servedKwhAfter: round2(s.servedKwhAfter),
      servedKwhDelta: delta,
      offHoursBefore: s.offHoursBefore,
      offHoursAfter: s.offHoursAfter,
    };
  }
  return {
    ...impact,
    socMinPctBefore: round2(impact.socMinPctBefore),
    socMinPctAfter: round2(impact.socMinPctAfter),
    unservedKwhBefore: round2(impact.unservedKwhBefore),
    unservedKwhAfter: round2(impact.unservedKwhAfter),
    sectors,
  };
}

/** Flat evidence fields for every number the approval dialog shows. */
export function impactEvidence(impact: ChangeImpact): Record<string, number> {
  const ev: Record<string, number> = {
    socMinPctBefore: impact.socMinPctBefore,
    socMinPctAfter: impact.socMinPctAfter,
    unservedKwhBefore: impact.unservedKwhBefore,
    unservedKwhAfter: impact.unservedKwhAfter,
  };
  for (const [id, s] of Object.entries(impact.sectors)) {
    if (!s) continue;
    ev[`${id}_servedKwhBefore`] = s.servedKwhBefore;
    ev[`${id}_servedKwhAfter`] = s.servedKwhAfter;
    ev[`${id}_servedKwhDelta`] = s.servedKwhDelta;
    ev[`${id}_offHoursBefore`] = s.offHoursBefore;
    ev[`${id}_offHoursAfter`] = s.offHoursAfter;
  }
  return ev;
}

// Zod argument schemas for the 5 tools
export const GetGridStateSchema = z.object({
  /** Adds the 24 h solar / demand / battery series and their peak hours (for charts). */
  hourly: z.boolean().optional(),
});

/** One hour of the engine run, rounded for the model (charts). */
export interface HourlyPoint {
  t: number;
  solarKw: number;
  demandKw: number;
  socPct: number;
}

/** Engine hours where solar and demand peak and the battery is lowest (picked from the steps, no new math). */
export function profileHighlights(steps: readonly StepResult[]) {
  const pick = (better: (a: StepResult, b: StepResult) => boolean) =>
    steps.reduce((best, s) => (better(s, best) ? s : best));
  const solar = pick((a, b) => a.solarKw > b.solarKw);
  const demand = pick((a, b) => a.demandKw > b.demandKw);
  const soc = pick((a, b) => a.socPct < b.socPct);
  return {
    peakSolarKw: round2(solar.solarKw),
    peakSolarHour: solar.t,
    peakDemandKw: round2(demand.demandKw),
    peakDemandHour: demand.t,
    lowestSocPct: round2(soc.socPct),
    lowestSocHour: soc.t,
  };
}

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
  sector: SectorIdSchema,
  // Omitted → the user's active strategy (not always proportional).
  strategy: z.enum(['proportional', 'essential_first', 'balanced']).optional(),
});

/** Playback commands the chat may run directly: they move the time cursor only, never the inputs. */
export const PLAYBACK_ACTIONS = ['play', 'pause', 'stop', 'restart', 'seek'] as const;
export type PlaybackAction = (typeof PLAYBACK_ACTIONS)[number];

export const ControlPlaybackSchema = z
  .object({
    action: z.enum(PLAYBACK_ACTIONS),
    hour: z.number().int().min(0).max(23).optional(),
  })
  .refine((d) => d.action !== 'seek' || d.hour !== undefined, {
    message: 'seek needs an hour from 0 to 23.',
    path: ['hour'],
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

/** Live sector load (× 0–3, 0 = not connected); shared by run_scenario and propose_change. */
const SECTOR_LOAD_PATCH_PROPS = {
  sectorLoads: {
    type: 'object',
    description: `Load multiplier per sector (0 to 3; 1 = normal, 0 = not connected) for ${SECTOR_IDS.join(', ')}. The industry sector (small factory) is not connected by default: set it above 0 to connect it.`,
  },
} as const;

/** Patch fields that tune strategy rules; shared by run_scenario and propose_change. */
const STRATEGY_RULE_PATCH_PROPS = {
  criticalShares: {
    type: 'object',
    description: `Critical lifeline share per sector (0 to 1) for ${SECTOR_IDS.join(', ')}.`,
  },
  balancedWeights: {
    type: 'object',
    description: 'Priority weights (0 to 10) for balanced strategy (critical, high, medium, low).',
  },
} as const;

/** Lifeline power floor (courant de survie) configuration; shared by run_scenario and propose_change. */
const LIFELINE_PATCH_PROPS = {
  lifeline: {
    type: 'object',
    description:
      'Lifeline power floor (courant de survie) configuration: guarantee minimum power floor per sector to avoid complete blackouts.',
    properties: {
      enabled: {
        type: 'boolean',
        description: 'Enable or disable the lifeline floor across all strategies (default: true).',
      },
      kw: {
        type: 'object',
        description:
          'Per-sector lifeline power floor in kW (0 to 2 kW; default: health 0.3, water 0.2, school 0.1, households 0.4, market 0.1).',
      },
    },
  },
} as const;

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: 'get_grid_state',
    description:
      'Inspect the current microgrid simulation state, active scenario parameters, and summary metrics. Set hourly=true to also get the 24 h solar, demand and battery series (use it for any chart: never invent chart values).',
    parameters: {
      type: 'object',
      properties: {
        hourly: {
          type: 'boolean',
          description:
            'Include the 24 h series (solarKw, demandKw, socPct) and their peak / lowest hours.',
        },
      },
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
            ...STRATEGY_RULE_PATCH_PROPS,
            ...SECTOR_LOAD_PATCH_PROPS,
            ...LIFELINE_PATCH_PROPS,
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
    description: `Fetch detailed metrics and 24-hour power profile for a specific sector (${SECTOR_IDS.join(', ')}).`,
    parameters: {
      type: 'object',
      properties: {
        sector: {
          type: 'string',
          enum: [...SECTOR_IDS],
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
    name: 'control_playback',
    description:
      'Run, pause, stop or restart the simulation playback, or move the time cursor to an hour (seek). ' +
      'Applied at once in the app: it changes only what is shown, never the scenario inputs or the strategy ' +
      '(use propose_change for those).',
    parameters: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: [...PLAYBACK_ACTIONS] },
        hour: {
          type: 'integer',
          minimum: 0,
          maximum: 23,
          description: 'Target hour for seek (0-23).',
        },
      },
      required: ['action'],
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
                    enum: [...SECTOR_IDS],
                  },
                  maxKw: { type: 'number' },
                  fromHour: { type: 'integer' },
                  toHour: { type: 'integer' },
                },
                required: ['sector', 'maxKw', 'fromHour', 'toHour'],
              },
            },
            ...STRATEGY_RULE_PATCH_PROPS,
            ...SECTOR_LOAD_PATCH_PROPS,
            ...LIFELINE_PATCH_PROPS,
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
    impact?: ChangeImpact;
  };
  evidence?: Record<string, number | string>;
  /** control_playback: what the app runs on the client (time cursor / playback only). */
  control?: { action: PlaybackAction; hour?: number };
}

/** Short, readable validation error for the model (no Zod JSON dump), with a fix hint when there is one. */
export function invalidArgs(toolName: string, error: z.ZodError): string {
  const issues = error.issues
    .map((i) => `${i.path.length > 0 ? i.path.join('.') : 'args'}: ${i.message}`)
    .join('; ');
  const hint = toolName === 'propose_change' ? ` ${PROPOSE_CHANGE_HINT}` : '';
  return `Invalid args for ${toolName}: ${issues}.${hint}`;
}

/** Sent back to the model when propose_change has no change in it, so it can call again correctly. */
export const PROPOSE_CHANGE_HINT =
  'Call propose_change again with a patch (or a strategy) and a reason. ' +
  'To cut a sector "now" or with no time given: ' +
  '{"patch":{"sectorCaps":[{"sector":"households","maxKw":0,"fromHour":<app hour>,"toHour":24}]},"reason":"..."}. ' +
  `Sectors: ${SECTOR_IDS.join(', ')}.`;

export function executeTool(toolName: string, rawArgs: unknown, ctx: ToolContext): ToolResult {
  switch (toolName) {
    case 'get_grid_state': {
      const parsed = GetGridStateSchema.safeParse(rawArgs);
      if (!parsed.success) {
        return {
          toolName,
          error: invalidArgs('get_grid_state', parsed.error),
        };
      }
      const strategy: StrategyId = ctx.activeStrategy || 'proportional';
      const result = simulate(ctx.input, strategy);
      const metrics = compactMetrics(result.metrics);
      const highlights = parsed.data.hourly ? profileHighlights(result.steps) : undefined;
      const hourly: HourlyPoint[] | undefined = parsed.data.hourly
        ? result.steps.map((s) => ({
            t: s.t,
            solarKw: round2(s.solarKw),
            demandKw: round2(s.demandKw),
            socPct: round2(s.socPct),
          }))
        : undefined;

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
          ...(hourly && { hourly, highlights }),
        },
        evidence: {
          ...extractNumericMetrics(metrics),
          solarPeakKw: ctx.input.solar.peakKw,
          batteryCapacityKwh: ctx.input.battery.capacityKwh,
          ...highlights,
        },
      };
    }

    case 'run_scenario': {
      const parsed = RunScenarioSchema.safeParse(rawArgs);
      if (!parsed.success) {
        return {
          toolName,
          error: invalidArgs('run_scenario', parsed.error),
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
          error: invalidArgs('compare_strategies', parsed.error),
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
        evidence[`${sId}_lifelineCoveragePct`] = cm.lifelineCoveragePct;
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
          error: invalidArgs('get_sector_metrics', parsed.error),
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

    case 'control_playback': {
      const parsed = ControlPlaybackSchema.safeParse(rawArgs);
      if (!parsed.success) {
        return { toolName, error: invalidArgs('control_playback', parsed.error) };
      }
      const control = {
        action: parsed.data.action,
        ...(parsed.data.action === 'seek' && { hour: parsed.data.hour }),
      };
      return {
        toolName,
        control,
        data: {
          status: 'applied_in_app',
          ...control,
          note: 'Only playback / the time cursor changed. Scenario inputs, strategy and results are unchanged.',
        },
      };
    }

    case 'propose_change': {
      const parsed = ProposeChangeSchema.safeParse(rawArgs);
      if (!parsed.success) {
        return {
          toolName,
          error: invalidArgs('propose_change', parsed.error),
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

      // Engine before/after (K1): current input + strategy vs patched input + proposed strategy.
      const currentStrategy: StrategyId = ctx.activeStrategy ?? 'proportional';
      let patchedInput = ctx.input;
      if (parsed.data.patch) {
        try {
          patchedInput = applyPatch(ctx.input, parsed.data.patch);
        } catch (err) {
          return {
            toolName,
            error: `Failed to apply patch: ${err instanceof Error ? err.message : String(err)}`,
          };
        }
      }
      const before = simulate(ctx.input, currentStrategy);
      const after = simulate(patchedInput, parsed.data.strategy ?? currentStrategy);
      const impact = compactImpact(changeImpact(before, after));
      const clinicReasons = clinicGuard(parsed.data.patch);

      const proposal = {
        proposalId,
        patch: parsed.data.patch,
        strategy: parsed.data.strategy,
        reason: parsed.data.reason,
        impact,
      };

      return {
        toolName,
        resultId: after.id,
        proposal,
        data: {
          proposalId,
          status: 'pending_operator_approval',
          patch: parsed.data.patch,
          strategy: parsed.data.strategy,
          reason: parsed.data.reason,
          impact,
          // K6: coded safety rule; the UI shows a red warning and asks a second confirmation.
          ...(clinicReasons.length > 0 && { clinicGuard: clinicReasons }),
        },
        evidence: impactEvidence(impact),
      };
    }

    default:
      return {
        toolName,
        error: `Unknown tool: ${toolName}`,
      };
  }
}
