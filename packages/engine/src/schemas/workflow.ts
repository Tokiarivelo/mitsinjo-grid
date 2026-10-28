import { z } from 'zod';
import { StrategyIdSchema } from './common';
import { SimulationResultSchema } from './result';

/** Daily weather preset: scales the whole solar profile of that day. */
export const WeatherIdSchema = z.enum(['sunny', 'partly_cloudy', 'cloudy', 'rainy', 'storm']);
export type WeatherId = z.infer<typeof WeatherIdSchema>;

export const WEATHER_IDS: readonly WeatherId[] = WeatherIdSchema.options;

/** Longest weather workflow (days) the engine accepts. */
export const MAX_WORKFLOW_DAYS = 7;

export const WorkflowDaySchema = z.object({
  weather: WeatherIdSchema,
});
export type WorkflowDay = z.infer<typeof WorkflowDaySchema>;

export const WorkflowSchema = z.array(WorkflowDaySchema).min(1).max(MAX_WORKFLOW_DAYS);
export type Workflow = z.infer<typeof WorkflowSchema>;

export const WorkflowTotalsSchema = z.object({
  demandKwh: z.number(),
  servedKwh: z.number(),
  unservedKwh: z.number(),
  criticalUnservedKwh: z.number(),
  criticalUnmetHours: z.number(),
  solarKwh: z.number(),
  socStartPct: z.number(),
  socEndPct: z.number(),
  socMinPct: z.number(),
  violations: z.number(),
});
export type WorkflowTotals = z.infer<typeof WorkflowTotalsSchema>;

export const WorkflowDayResultSchema = z.object({
  day: z.number().int().min(0),
  weather: WeatherIdSchema,
  result: SimulationResultSchema,
});
export type WorkflowDayResult = z.infer<typeof WorkflowDayResultSchema>;

export const WorkflowResultSchema = z.object({
  strategy: StrategyIdSchema,
  days: z.array(WorkflowDayResultSchema).min(1).max(MAX_WORKFLOW_DAYS),
  totals: WorkflowTotalsSchema,
});
export type WorkflowResult = z.infer<typeof WorkflowResultSchema>;

export const WorkflowComparisonSchema = z.record(StrategyIdSchema, WorkflowResultSchema);
export type WorkflowComparison = z.infer<typeof WorkflowComparisonSchema>;
