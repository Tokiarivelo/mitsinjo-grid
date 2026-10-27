import { z } from 'zod';

export const SectorIdSchema = z.enum(['health', 'water', 'school', 'households', 'market']);
export type SectorId = z.infer<typeof SectorIdSchema>;

export const SECTOR_IDS: readonly SectorId[] = [
  'health',
  'water',
  'school',
  'households',
  'market',
] as const;

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
