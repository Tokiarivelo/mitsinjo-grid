import { z } from 'zod';

/**
 * Every consumer sector, in display order. This list is the single source: add a sector
 * here, then follow docs/engine-spec.md § "Adding a consumer sector".
 */
export const SECTOR_IDS = [
  'health',
  'water',
  'school',
  'households',
  'market',
  'industry',
] as const;
export const SectorIdSchema = z.enum(SECTOR_IDS);
export type SectorId = z.infer<typeof SectorIdSchema>;

export const PrioritySchema = z.enum(['critical', 'high', 'medium', 'low']);
export type Priority = z.infer<typeof PrioritySchema>;

export const PRIORITY_ORDER: readonly Priority[] = ['critical', 'high', 'medium', 'low'] as const;

export const StrategyIdSchema = z.enum(['proportional', 'essential_first', 'balanced']);
export type StrategyId = z.infer<typeof StrategyIdSchema>;

export const SimStatusSchema = z.enum(['ready', 'modified', 'running', 'complete', 'error']);
export type SimStatus = z.infer<typeof SimStatusSchema>;

export const ScenarioIdSchema = z.enum([
  'baseline',
  'cloudy_afternoon',
  'high_demand',
  'battery_constraint',
  'essential_stress',
  'meter_anomaly',
]);
export type ScenarioId = z.infer<typeof ScenarioIdSchema>;

export const SectorModeSchema = z.enum(['full', 'limited', 'lifeline', 'off']);
export type SectorMode = z.infer<typeof SectorModeSchema>;

/** Dispatch controller state for one hour, derived from sector modes (shared by 3D, 2D and hardware). */
export const ControllerModeSchema = z.enum(['normal', 'rationing', 'lifeline_only']);
export type ControllerMode = z.infer<typeof ControllerModeSchema>;

/** Feeder breaker shown or driven for a sector: `limited` = lifeline floor only. */
export const BreakerStateSchema = z.enum(['closed', 'limited', 'open']);
export type BreakerState = z.infer<typeof BreakerStateSchema>;

/** Display tone of a feeder (3D, 2D, scale-model LEDs): served, rationed/lifeline, shed, nothing to carry. */
export const FeederToneSchema = z.enum(['ok', 'warning', 'critical', 'idle']);
export type FeederTone = z.infer<typeof FeederToneSchema>;

/** Zod object with one entry per sector (all required), built from SECTOR_IDS. */
export function sectorRecordSchema<T extends z.ZodTypeAny>(schema: T) {
  const shape = Object.fromEntries(SECTOR_IDS.map((id) => [id, schema])) as Record<SectorId, T>;
  return z.object(shape);
}
