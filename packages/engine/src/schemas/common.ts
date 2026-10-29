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
