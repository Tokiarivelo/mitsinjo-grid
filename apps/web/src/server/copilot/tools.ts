import 'server-only';

import { entrySavedKwh } from '@/lib/dispatch-log';
import { z } from 'zod';
import {
  type SimulationInput,
  type StrategyId,
  type Metrics,
  type InputPatch,
  type Appliance,
  type SectorId,
  type DispatchLogEntry,
  InputPatchSchema,
  SECTOR_IDS,
  SectorIdSchema,
  ScenarioIdSchema,
  simulate,
  compare,
  simulateWorkflow,
  compareWorkflow,
  applyWeather,
  applyPatch,
  scenarios,
  clinicGuard,
  applianceSummary,
  sectorApplianceKw,
  fireEvents,
  type ChangeImpact,
  type StepResult,
} from '@mitsinjo/engine';
import { proposalImpact } from '@/lib/proposal-impact';
import {
  type ScenarioDraft,
  ScenarioDraftSchema,
  missingSlots,
  draftToWorkflow,
} from '@/lib/scenario-draft';
import { extractScenarioDraft } from '@/lib/scenario-extractor';
import type { ScenarioDraftPayload } from '@/features/copilot/types';
import { rememberResult } from './result-cache';
import { batteryStory, lowestSocHour } from './battery-story';
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

export { compactImpact } from '@/lib/proposal-impact';

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

/** One inserted line with its engine-computed load (PV-T14). */
export interface ApplianceLineReport {
  id: string;
  name: string;
  category: string;
  sector: SectorId;
  quantity: number;
  watts: number;
  peakKw: number;
  dailyKwh: number;
}

export interface SectorApplianceTotals {
  count: number;
  dailyKwh: number;
  peakKw: number;
}

export interface ApplianceReport extends SectorApplianceTotals {
  perSector: Partial<Record<SectorId, SectorApplianceTotals>>;
  lines: ApplianceLineReport[];
}

/**
 * Engine loads of the inserted lines (PV-T14): per-line summaries plus sector and overall
 * totals. Totals are rounded once from unrounded values, so they match the engine exactly.
 */
export function summarizeAppliances(appliances: readonly Appliance[] = []): ApplianceReport {
  const profiles = sectorApplianceKw(appliances);
  const lines: ApplianceLineReport[] = appliances.map((a) => {
    const { peakKw, dailyKwh } = applianceSummary(a);
    return {
      id: a.id,
      name: a.name,
      category: a.category,
      sector: a.sector,
      quantity: a.quantity,
      watts: a.watts,
      peakKw: round2(peakKw),
      dailyKwh: round2(dailyKwh),
    };
  });
  const perSector: ApplianceReport['perSector'] = {};
  let totalKwh = 0;
  const totalProfile = new Array<number>(24).fill(0);
  for (const [sector, profile] of Object.entries(profiles)) {
    if (!profile) continue;
    const count = appliances.filter((a) => a.sector === sector).length;
    const dailyKwh = profile.reduce((sum, kw) => sum + kw, 0);
    totalKwh += dailyKwh;
    for (let t = 0; t < 24; t++) totalProfile[t]! += profile[t] ?? 0;
    perSector[sector as SectorId] = {
      count,
      dailyKwh: round2(dailyKwh),
      peakKw: round2(Math.max(...profile)),
    };
  }
  return {
    count: appliances.length,
    dailyKwh: round2(totalKwh),
    peakKw: round2(Math.max(...totalProfile)),
    perSector,
    lines,
  };
}

/** Evidence fields for one sector's inserted load (`<sector>_applianceKwh`, …), empty when none. */
export function sectorApplianceEvidence(
  sector: SectorId,
  report: ApplianceReport
): Record<string, number> {
  const totals = report.perSector[sector];
  if (!totals || totals.count === 0) return {};
  return {
    [`${sector}_applianceKwh`]: totals.dailyKwh,
    [`${sector}_appliancePeakKw`]: totals.peakKw,
    [`${sector}_applianceCount`]: totals.count,
  };
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
  scenarioId: ScenarioIdSchema.optional(),
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

export const GetIncidentsSchema = z.object({
  /** Reference hour for burning/upcoming/over (default: the app hour). */
  hour: z.number().int().min(0).max(23).optional(),
  // Omitted → the user's active strategy (not always proportional).
  strategy: z.enum(['proportional', 'essential_first', 'balanced']).optional(),
});

export const GetDispatchLogSchema = z.object({
  limit: z.number().int().min(1).max(100).default(20),
  day: z.number().int().min(0).max(6).optional(),
  hour: z.number().int().min(0).max(23).optional(),
  sector: SectorIdSchema.optional(),
  severity: z.enum(['critical', 'warning', 'info']).optional(),
  origin: z.enum(['ai', 'operator']).optional(),
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

export const GetBatteryStorySchema = z.object({
  hour: z.number().int().min(0).max(23).optional(),
  strategy: z.enum(['proportional', 'essential_first', 'balanced']).optional(),
});

export const SimulateWeekSchema = z.object({
  days: z
    .array(z.object({ weather: z.enum(['sunny', 'partly_cloudy', 'cloudy', 'rainy', 'storm']) }))
    .min(1)
    .max(7),
  strategy: z.enum(['proportional', 'essential_first', 'balanced']).default('proportional'),
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

/** One inserted line, patched in place (PV-T11b): absent fields keep their current value. */
export const EditApplianceSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(80).optional(),
  category: z.string().min(1).optional(),
  sector: SectorIdSchema.optional(),
  watts: z.number().positive().optional(),
  quantity: z.number().int().min(1).optional(),
  /** Map spot; omit unless echoing the operator's own numbers (never invented). */
  position: z.object({ x: z.number(), z: z.number() }).optional(),
  reason: z.string().min(1).max(500),
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

/** Inserted appliance lines (PV-T14); shared by run_scenario and propose_change. Replaces the whole list. */
const APPLIANCE_PATCH_PROPS = {
  appliances: {
    type: 'array',
    description:
      'Inserted appliance lines (replaces the whole list; [] removes all). Each line: {id, name (1–40 chars), category, sector, watts (within the category catalog bounds), quantity (1–50)}. Single-line edits go through edit_appliance.',
    items: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        category: { type: 'string' },
        sector: { type: 'string', enum: [...SECTOR_IDS] },
        watts: { type: 'number' },
        quantity: { type: 'integer' },
      },
      required: ['id', 'name', 'category', 'sector', 'watts', 'quantity'],
    },
  },
} as const;

/** Fire restore (M2-T4); shared by run_scenario and propose_change. Removes those sectors' fires. */
const CLEAR_FIRES_PATCH_PROPS = {
  clearFires: {
    type: 'array',
    description:
      'Restore power after a fire: removes the fire events of these sectors (approved via this proposal, never direct).',
    items: { type: 'string', enum: [...SECTOR_IDS] },
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
          enum: [...ScenarioIdSchema.options],
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
            ...APPLIANCE_PATCH_PROPS,
            ...CLEAR_FIRES_PATCH_PROPS,
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
    name: 'get_battery_story',
    description:
      'Post-mortem of the battery at one hour: SoC then, last peak before, sun/demand/discharged since, unserved energy by sector. Defaults to the emptiest hour.',
    parameters: {
      type: 'object',
      properties: {
        hour: {
          type: 'integer',
          description: 'Hour to explain, 0–23 (default: the lowest-SoC hour).',
        },
        strategy: {
          type: 'string',
          enum: ['proportional', 'essential_first', 'balanced'],
          description: 'The dispatch strategy to inspect (default: the active strategy).',
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'simulate_week',
    description:
      'Simulate up to 7 days under daily weather (sunny, partly_cloudy, cloudy, rainy, storm); the battery carries over. Returns the day table, week totals, the recommended week strategy and the worst day.',
    parameters: {
      type: 'object',
      properties: {
        days: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              weather: {
                type: 'string',
                enum: ['sunny', 'partly_cloudy', 'cloudy', 'rainy', 'storm'],
              },
            },
            required: ['weather'],
          },
          description: '1–7 days of weather, in order.',
        },
        strategy: {
          type: 'string',
          enum: ['proportional', 'essential_first', 'balanced'],
          description: 'Dispatch strategy for the week table (default: proportional).',
        },
      },
      required: ['days'],
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
    name: 'get_incidents',
    description:
      'List fire incidents on the simulated grid: which sector is cut, from when to when, whether it burns now, and the unserved energy. A fire cut is automatic (safety); restoring power needs an approved propose_change with clearFires.',
    parameters: {
      type: 'object',
      properties: {
        hour: {
          type: 'integer',
          minimum: 0,
          maximum: 23,
          description:
            'Reference hour for burning/upcoming/over (default: the hour shown in the app).',
        },
        strategy: {
          type: 'string',
          enum: ['proportional', 'essential_first', 'balanced'],
          description: 'The dispatch strategy to inspect (default: the active strategy).',
        },
      },
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
            ...APPLIANCE_PATCH_PROPS,
            ...CLEAR_FIRES_PATCH_PROPS,
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
  {
    name: 'edit_appliance',
    description:
      'Propose an edit to ONE inserted appliance line (name, category, feeder sector, watts, quantity). Merges onto the current list and returns a proposal the operator approves per line; never applies. Only for loads already in the simulation — adding new loads is the /village insert flow. Never invent a map position: omit position unless echoing the operator’s own numbers.',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Engine id of the inserted line.' },
        name: { type: 'string', description: 'New load name.' },
        category: {
          type: 'string',
          description:
            'Catalog category (fridge, tv, lamp, fan, water_pump, …); watts must fit its bounds.',
        },
        sector: {
          type: 'string',
          description: 'Feeder sector carrying the load (one of the 6 sector ids).',
        },
        watts: {
          type: 'number',
          description: 'Rated power in W (catalog bounds of the category).',
        },
        quantity: { type: 'integer', description: 'How many (≥ 1).' },
        position: {
          type: 'object',
          properties: { x: { type: 'number' }, z: { type: 'number' } },
          required: ['x', 'z'],
          description: 'Map spot. Omit unless echoing the operator’s own numbers — never invented.',
        },
        reason: { type: 'string', description: 'Why, in one line.' },
      },
      required: ['id', 'reason'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_dispatch_log',
    description:
      'Retrieve the autonomous dispatch event log (incidents detected, autonomous actions taken, before/after engine figures). Use this to explain autonomous decisions or answer questions like "Why did the AI isolate the market at 14h?".',
    parameters: {
      type: 'object',
      properties: {
        limit: {
          type: 'integer',
          minimum: 1,
          maximum: 100,
          description: 'Maximum number of entries to return (default: 20).',
        },
        day: {
          type: 'integer',
          minimum: 0,
          maximum: 6,
          description: 'Filter entries by simulated day.',
        },
        hour: {
          type: 'integer',
          minimum: 0,
          maximum: 23,
          description: 'Filter entries by simulated hour.',
        },
        sector: {
          type: 'string',
          enum: [...SECTOR_IDS],
          description: 'Filter entries affecting this sector.',
        },
        severity: {
          type: 'string',
          enum: ['critical', 'warning', 'info'],
          description: 'Filter incidents by severity level.',
        },
        origin: {
          type: 'string',
          enum: ['ai', 'operator'],
          description: 'Filter by decision origin: ai (autonomous) or operator (chat proposal).',
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'draft_scenario',
    description:
      'Draft or refine a multi-day scenario from user descriptions or slot answers (e.g. "day 1: cloudy, day 2: rainy, day 3: sunny + fire at school"). Detects days, weather and incidents, computes missing slots, and calculates engine preview metrics when complete.',
    parameters: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description:
            'The user\'s own words, verbatim (French, English or Malagasy), including the total length ("7 jours") and every day mentioned. Days not described default to sunny.',
        },
        draft: {
          type: 'object',
          description: 'Optional partial or full scenario draft object.',
        },
        applyDefaults: {
          type: 'boolean',
          description:
            'Fill in default values for unspecified secondary parameters (SoC 60%, proportional strategy).',
        },
      },
      additionalProperties: false,
    },
  },
];

export const DraftScenarioSchema = z.object({
  text: z.string().optional(),
  draft: ScenarioDraftSchema.optional(),
  applyDefaults: z.boolean().optional(),
});

export interface ToolContext {
  input: SimulationInput;
  activeStrategy?: StrategyId;
  /** Hour shown in the app (default reference for get_incidents). */
  hour?: number;
  day?: number;
  /** Dispatch event log entries (PA-T5b). */
  dispatchLog?: readonly DispatchLogEntry[];
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
  /** Multi-day scenario draft (PA-T8d). */
  scenarioDraft?: ScenarioDraftPayload;
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

/**
 * Shared proposal tail (propose_change, edit_appliance): deterministic id, engine before/after
 * (K1), clinic guard (K6), and the pending-approval payload the dialog confirms.
 */
function proposeFromPatch(
  toolName: string,
  ctx: ToolContext,
  patch: InputPatch | undefined,
  strategy: StrategyId | undefined,
  reason: string
): ToolResult {
  // Generate deterministic proposal id based on patch, strategy & reason
  const rawKey = JSON.stringify({ p: patch, s: strategy, r: reason });
  let hash = 0;
  for (let i = 0; i < rawKey.length; i++) {
    hash = ((hash << 5) - hash + rawKey.charCodeAt(i)) | 0;
  }
  const proposalId = `PROP-${Math.abs(hash).toString(16).toUpperCase().padStart(6, '0').slice(0, 6)}`;

  // Engine before/after (K1): current input + strategy vs patched input + proposed strategy.
  const currentStrategy: StrategyId = ctx.activeStrategy ?? 'proportional';
  let computed: ReturnType<typeof proposalImpact>;
  try {
    computed = proposalImpact(ctx.input, currentStrategy, patch, strategy);
  } catch (err) {
    return {
      toolName,
      error: `Failed to apply patch: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
  const { impact, afterResultId } = computed;
  const clinicReasons = clinicGuard(patch);
  const afterInput = patch ? applyPatch(ctx.input, patch) : ctx.input;
  // Remembered for generate_visual (M5-T1): the model can illustrate the proposed state.
  rememberResult(afterInput, simulate(afterInput, strategy ?? currentStrategy));
  // Inserted loads after the proposal (PV-T14): the patch replaces the list, like the engine.
  const afterAppliances = summarizeAppliances(afterInput.appliances);
  const beforeKwh = summarizeAppliances(ctx.input.appliances).dailyKwh;
  const applianceKwhDelta = round2(afterAppliances.dailyKwh - beforeKwh);

  const proposal = { proposalId, patch, strategy, reason, impact };

  return {
    toolName,
    resultId: afterResultId,
    proposal,
    data: {
      proposalId,
      status: 'pending_operator_approval',
      patch,
      strategy,
      reason,
      impact,
      appliances: {
        count: afterAppliances.count,
        dailyKwh: afterAppliances.dailyKwh,
        peakKw: afterAppliances.peakKw,
        perSector: afterAppliances.perSector,
      },
      ...(patch?.appliances !== undefined && { applianceKwhDelta }),
      // K6: coded safety rule; the UI shows a red warning and asks a second confirmation.
      ...(clinicReasons.length > 0 && { clinicGuard: clinicReasons }),
    },
    evidence: {
      ...impactEvidence(impact),
      ...(patch?.appliances !== undefined && { applianceKwhDelta }),
    },
  };
}

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
      rememberResult(ctx.input, result);
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
      rememberResult(finalInput, result);
      const metrics = compactMetrics(result.metrics);
      const appliances = summarizeAppliances(finalInput.appliances);
      const applianceEvidence: Record<string, number> =
        appliances.count > 0
          ? {
              applianceCount: appliances.count,
              applianceKwh: appliances.dailyKwh,
              appliancePeakKw: appliances.peakKw,
            }
          : {};
      for (const sector of Object.keys(appliances.perSector) as SectorId[]) {
        Object.assign(applianceEvidence, sectorApplianceEvidence(sector, appliances));
      }

      return {
        toolName,
        resultId: result.id,
        data: {
          resultId: result.id,
          strategy: parsed.data.strategy,
          metrics,
          warnings: result.warnings,
          appliances: {
            count: appliances.count,
            dailyKwh: appliances.dailyKwh,
            peakKw: appliances.peakKw,
            perSector: appliances.perSector,
          },
        },
        evidence: {
          ...extractNumericMetrics(metrics),
          ...applianceEvidence,
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
        rememberResult(ctx.input, res);
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

    case 'get_battery_story': {
      const parsed = GetBatteryStorySchema.safeParse(rawArgs);
      if (!parsed.success) {
        return {
          toolName,
          error: invalidArgs('get_battery_story', parsed.error),
        };
      }
      const strategy: StrategyId = parsed.data.strategy ?? ctx.activeStrategy ?? 'proportional';
      const result = simulate(ctx.input, strategy);
      rememberResult(ctx.input, result);
      const story = batteryStory(ctx.input, result, parsed.data.hour ?? lowestSocHour(result));
      const evidence: Record<string, number> = {
        battery_hour: story.hour,
        battery_socPct: story.socPct,
        battery_peakHour: story.peak.hour,
        battery_peakSocPct: story.peak.socPct,
        battery_solarKwhSincePeak: story.solarKwhSincePeak,
        battery_demandKwhSincePeak: story.demandKwhSincePeak,
        battery_dischargedKwh: story.dischargedKwh,
        battery_unservedKwhSincePeak: story.unservedKwhSincePeak,
      };
      for (const s of story.unservedBySector) {
        evidence[`battery_${s.sector}_unservedKwh`] = s.kwh;
      }
      return {
        toolName,
        resultId: result.id,
        data: { ...story },
        evidence,
      };
    }

    case 'simulate_week': {
      const parsed = SimulateWeekSchema.safeParse(rawArgs);
      if (!parsed.success) {
        return {
          toolName,
          error: invalidArgs('simulate_week', parsed.error),
        };
      }
      const strategy = parsed.data.strategy;
      const week = simulateWorkflow(ctx.input, parsed.data.days, strategy);
      // Each day is illustratable (M5-T1); the table cites engine numbers only.
      let socPct = ctx.input.battery.initialSocPct;
      const dayRows = week.days.map((d) => {
        const dayInput = applyWeather(ctx.input, d.weather);
        dayInput.battery.initialSocPct = socPct;
        rememberResult(dayInput, d.result);
        socPct = d.result.metrics.socEndPct;
        return {
          day: d.day,
          weather: d.weather,
          resultId: d.result.id,
          unservedKwh: round2(d.result.metrics.unservedKwh),
          criticalUnservedKwh: round2(d.result.metrics.criticalUnservedKwh),
          socEndPct: round2(d.result.metrics.socEndPct),
        };
      });
      // Totals sum the ROUNDED days, so the cited total matches the cited table.
      const totals = {
        unservedKwh: round2(dayRows.reduce((n, d) => n + d.unservedKwh, 0)),
        criticalUnservedKwh: round2(dayRows.reduce((n, d) => n + d.criticalUnservedKwh, 0)),
        socMinPct: round2(week.totals.socMinPct),
      };
      // The 7-day plan: best week strategy (compared engine runs) + worst day.
      const comp = compareWorkflow(ctx.input, parsed.data.days);
      let best: StrategyId = strategy;
      let bestCrit = Infinity;
      let bestUnserved = Infinity;
      for (const [name, res] of Object.entries(comp)) {
        if (!res) continue;
        const c = res.totals.criticalUnservedKwh;
        const u = res.totals.unservedKwh;
        if (c < bestCrit || (c === bestCrit && u < bestUnserved)) {
          bestCrit = c;
          bestUnserved = u;
          best = name as StrategyId;
        }
      }
      const worstDay = dayRows.reduce((a, b) => (b.unservedKwh > a.unservedKwh ? b : a)).day;
      return {
        toolName,
        resultId: dayRows[0]?.resultId ?? 'SIM-BASELINE',
        data: {
          strategy,
          days: dayRows,
          totals,
          plan: { strategy: best, worstDay },
        },
        evidence: {
          week_days: dayRows.length,
          week_unservedKwh: totals.unservedKwh,
          week_criticalUnservedKwh: totals.criticalUnservedKwh,
          week_socMinPct: totals.socMinPct,
          week_worstDay: worstDay,
        },
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
      rememberResult(ctx.input, result);
      const secMetrics = result.metrics.perSector[sectorId];
      const sectorConfig = ctx.input.sectors.find((s) => s.id === sectorId);

      const hourly = result.steps.map((st) => ({
        t: st.t,
        demandKw: round2(st.sectors[sectorId]?.demandKw ?? 0),
        servedKw: round2(st.sectors[sectorId]?.servedKw ?? 0),
      }));

      const report = summarizeAppliances(ctx.input.appliances);
      const sectorTotals = report.perSector[sectorId] ?? { count: 0, dailyKwh: 0, peakKw: 0 };
      const compactSec = {
        sector: sectorId,
        priority: sectorConfig?.priority ?? 'medium',
        demandKwh: round2(secMetrics?.demandKwh ?? 0),
        servedKwh: round2(secMetrics?.servedKwh ?? 0),
        unservedKwh: round2(secMetrics?.unservedKwh ?? 0),
        coveragePct: round2(secMetrics?.coveragePct ?? 0),
        hourly,
        appliances: {
          count: sectorTotals.count,
          dailyKwh: sectorTotals.dailyKwh,
          peakKw: sectorTotals.peakKw,
          lines: report.lines.filter((l) => l.sector === sectorId),
        },
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
          ...sectorApplianceEvidence(sectorId, report),
        },
      };
    }

    case 'get_incidents': {
      const parsed = GetIncidentsSchema.safeParse(rawArgs);
      if (!parsed.success) {
        return {
          toolName,
          error: invalidArgs('get_incidents', parsed.error),
        };
      }
      const hour = parsed.data.hour ?? ctx.hour ?? 12;
      const strategy: StrategyId = parsed.data.strategy ?? ctx.activeStrategy ?? 'proportional';
      const result = simulate(ctx.input, strategy);
      rememberResult(ctx.input, result);
      const incidents = fireEvents(ctx.input.events).map((f) => ({
        sector: f.sector,
        startHour: f.startHour,
        endHour: f.startHour + f.durationH,
        status: (hour < f.startHour
          ? 'upcoming'
          : hour < f.startHour + f.durationH
            ? 'burning'
            : 'over') as 'upcoming' | 'burning' | 'over',
        unservedKwh: round2(result.metrics.perSector[f.sector]?.unservedKwh ?? 0),
      }));
      const evidence: Record<string, number> = { incidentCount: incidents.length };
      for (const i of incidents) {
        evidence[`${i.sector}_fireUnservedKwh`] = i.unservedKwh;
        evidence[`${i.sector}_fireStartHour`] = i.startHour;
        evidence[`${i.sector}_fireEndHour`] = i.endHour;
      }
      return {
        toolName,
        resultId: result.id,
        data: { resultId: result.id, hour, strategy, count: incidents.length, incidents },
        evidence,
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
      return proposeFromPatch(
        toolName,
        ctx,
        parsed.data.patch,
        parsed.data.strategy,
        parsed.data.reason
      );
    }

    case 'edit_appliance': {
      const parsed = EditApplianceSchema.safeParse(rawArgs);
      if (!parsed.success) {
        return {
          toolName,
          error: invalidArgs('edit_appliance', parsed.error),
        };
      }
      const { id, reason, ...fields } = parsed.data;
      const current = ctx.input.appliances ?? [];
      const line = current.find((a) => a.id === id);
      if (!line) {
        return {
          toolName,
          error: `Unknown appliance id '${id}': only lines already in the simulation can be edited (add new loads on /village).`,
        };
      }
      const merged = { ...line };
      for (const [k, v] of Object.entries(fields)) {
        if (v !== undefined) (merged as unknown as Record<string, unknown>)[k] = v;
      }
      const patchCheck = InputPatchSchema.safeParse({
        appliances: current.map((a) => (a.id === id ? merged : a)),
      });
      if (!patchCheck.success) {
        return {
          toolName,
          error: invalidArgs('edit_appliance', patchCheck.error),
        };
      }
      return proposeFromPatch(toolName, ctx, patchCheck.data, undefined, reason);
    }

    case 'get_dispatch_log': {
      const parsed = GetDispatchLogSchema.safeParse(rawArgs);
      if (!parsed.success) {
        return {
          toolName,
          error: invalidArgs('get_dispatch_log', parsed.error),
        };
      }
      const { limit, day, hour, sector, severity, origin } = parsed.data;
      const entries = ctx.dispatchLog ?? [];

      const filtered = entries.filter((e) => {
        if (day !== undefined && e.day !== day) return false;
        if (hour !== undefined && e.hour !== hour) return false;
        if (sector !== undefined && e.incident?.sector !== sector && e.action?.sector !== sector) {
          return false;
        }
        if (severity !== undefined && e.incident?.severity !== severity) return false;
        if (origin !== undefined && e.origin !== origin) return false;
        return true;
      });

      const sliced = filtered.slice(-limit);

      let criticalCount = 0;
      let warningCount = 0;
      let infoCount = 0;
      let actionsCount = 0;
      let totalSavedKwh = 0;

      const formattedEntries = sliced.map((e) => {
        if (e.incident) {
          if (e.incident.severity === 'critical') criticalCount++;
          else if (e.incident.severity === 'warning') warningCount++;
          else if (e.incident.severity === 'info') infoCount++;
        }
        if (e.action) {
          actionsCount++;
        }
        const saved = entrySavedKwh(e);
        totalSavedKwh += saved;

        return {
          id: e.id,
          day: e.day,
          hour: e.hour,
          origin: e.origin,
          incident: e.incident
            ? { kind: e.incident.kind, severity: e.incident.severity, sector: e.incident.sector }
            : undefined,
          action: e.action
            ? { kind: e.action.kind, sector: e.action.sector, answers: e.action.answers }
            : undefined,
          before: e.before
            ? {
                unservedKwh: round2(e.before.unservedKwh),
                criticalUnservedKwh: round2(e.before.criticalUnservedKwh),
                socEndPct: round2(e.before.socEndPct),
              }
            : undefined,
          after: e.after
            ? {
                unservedKwh: round2(e.after.unservedKwh),
                criticalUnservedKwh: round2(e.after.criticalUnservedKwh),
                socEndPct: round2(e.after.socEndPct),
              }
            : undefined,
          savedKwh: round2(saved),
          narration: e.narration?.text,
        };
      });

      return {
        toolName,
        data: {
          totalEntries: filtered.length,
          criticalCount,
          warningCount,
          infoCount,
          actionsCount,
          totalSavedKwh: round2(totalSavedKwh),
          entries: formattedEntries,
        },
        evidence: {
          totalEntries: filtered.length,
          actionsCount,
          totalSavedKwh: round2(totalSavedKwh),
        },
      };
    }

    case 'draft_scenario': {
      const parsed = DraftScenarioSchema.safeParse(rawArgs);
      if (!parsed.success) {
        return {
          toolName,
          error: invalidArgs('draft_scenario', parsed.error),
        };
      }

      const { text, draft: inputDraft, applyDefaults } = parsed.data;
      let draft: ScenarioDraft;

      if (text) {
        draft = extractScenarioDraft(text, inputDraft);
      } else if (inputDraft) {
        draft = inputDraft;
      } else {
        draft = { days: [{ day: 1, weather: 'sunny' }] };
      }

      const slots = missingSlots(draft);
      const isComplete = slots.length === 0;

      let preview: ScenarioDraftPayload['preview'] = undefined;
      if (isComplete || applyDefaults) {
        try {
          const { workflow } = draftToWorkflow(draft);
          const strat = ctx.activeStrategy || 'proportional';
          const comparison = compareWorkflow(ctx.input, workflow, [strat]);
          const res = comparison[strat];
          if (res) {
            let maxDeficit = -1;
            let worstDay = 1;
            const dayDeficits: Array<{ day: number; deficitKwh: number }> = [];

            for (let i = 0; i < res.days.length; i++) {
              const d = res.days[i]!;
              const unserved = round2(d.result.metrics.unservedKwh);
              dayDeficits.push({ day: d.day + 1, deficitKwh: unserved });
              if (unserved > maxDeficit) {
                maxDeficit = unserved;
                worstDay = d.day + 1;
              }
            }

            preview = {
              worstDay,
              totalDeficitKwh: round2(res.totals.unservedKwh),
              criticalUnservedKwh: round2(res.totals.criticalUnservedKwh),
              dayDeficits,
            };
          }
        } catch (err) {
          console.warn('[tools:draft_scenario] Preview computation failed:', err);
        }
      }

      const payload: ScenarioDraftPayload = {
        draft,
        missingSlots: slots,
        isComplete,
        ...(preview ? { preview } : {}),
      };

      return {
        toolName,
        scenarioDraft: payload,
        data: {
          daysCount: draft.days.length,
          missingSlotsCount: slots.length,
          missingSlots: slots.map((s) => ({
            kind: s.kind,
            day: s.day,
            suggestedResponses: s.suggestedResponses.map((r) => r.label),
          })),
          isComplete,
          ...(preview ? { preview } : {}),
        },
        evidence: {
          draftDaysCount: draft.days.length,
          draftMissingSlotsCount: slots.length,
          ...(preview?.totalDeficitKwh !== undefined && {
            draftTotalDeficitKwh: preview.totalDeficitKwh,
          }),
          ...(preview?.criticalUnservedKwh !== undefined && {
            draftCriticalUnservedKwh: preview.criticalUnservedKwh,
          }),
          ...(preview?.worstDay !== undefined && { draftWorstDay: preview.worstDay }),
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
