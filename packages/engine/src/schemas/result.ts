import { z } from 'zod';
import { SectorIdSchema, SectorModeSchema, StrategyIdSchema } from './common';

export const SectorStepSchema = z.object({
  demandKw: z.number(),
  servedKw: z.number(),
  criticalDemandKw: z.number(),
  criticalServedKw: z.number(),
  lifelineServedKw: z.number(),
  mode: SectorModeSchema,
});
export type SectorStep = z.infer<typeof SectorStepSchema>;

export const StepResultSchema = z.object({
  t: z.number().int().min(0).max(23),
  solarKw: z.number(),
  demandKw: z.number(),
  servedKw: z.number(),
  unservedKw: z.number(),
  batteryKw: z.number(),
  socPct: z.number(),
  curtailedKw: z.number(),
  sectors: z.record(SectorIdSchema, SectorStepSchema),
});
export type StepResult = z.infer<typeof StepResultSchema>;

export const SectorMetricsSchema = z.object({
  demandKwh: z.number(),
  servedKwh: z.number(),
  unservedKwh: z.number(),
  coveragePct: z.number(),
});
export type SectorMetrics = z.infer<typeof SectorMetricsSchema>;

export const MetricsSchema = z.object({
  demandKwh: z.number(),
  servedKwh: z.number(),
  unservedKwh: z.number(),
  criticalDemandKwh: z.number(),
  criticalUnservedKwh: z.number(),
  criticalUnmetHours: z.number(),
  criticalCoveragePct: z.number(),
  lifelineCoveragePct: z.number(),
  affectedSectors: z.array(SectorIdSchema),
  solarKwh: z.number(),
  curtailedKwh: z.number(),
  socStartPct: z.number(),
  socEndPct: z.number(),
  socMinPct: z.number(),
  violations: z.number(),
  perSector: z.record(SectorIdSchema, SectorMetricsSchema),
});
export type Metrics = z.infer<typeof MetricsSchema>;

export const WarningCodeSchema = z.enum([
  'CRITICAL_UNMET',
  'SECTOR_PARTIAL',
  'RESERVE_REACHED',
  'CURTAILMENT',
  'ANOMALY_TO_VERIFY',
  'SECTOR_CAPPED',
  'LIFELINE_SHORTFALL',
]);
export type WarningCode = z.infer<typeof WarningCodeSchema>;

export const SimWarningSchema = z.object({
  code: WarningCodeSchema,
  sector: SectorIdSchema.optional(),
  fromHour: z.number().int().min(0).max(23),
  toHour: z.number().int().min(0).max(23),
});
export type SimWarning = z.infer<typeof SimWarningSchema>;

export const SimulationResultSchema = z.object({
  id: z.string(),
  inputHash: z.string(),
  strategy: StrategyIdSchema,
  steps: z.array(StepResultSchema).length(24),
  metrics: MetricsSchema,
  warnings: z.array(SimWarningSchema),
  engineVersion: z.string(),
});
export type SimulationResult = z.infer<typeof SimulationResultSchema>;

export const ComparisonSchema = z.record(StrategyIdSchema, SimulationResultSchema);
export type Comparison = z.infer<typeof ComparisonSchema>;
