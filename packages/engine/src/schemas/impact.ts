import { z } from 'zod';
import { SectorIdSchema, StrategyIdSchema } from './common';

/** One sector in a before/after change impact. `offHours` = hours with demand but no power. */
export const SectorImpactSchema = z.object({
  servedKwhBefore: z.number(),
  servedKwhAfter: z.number(),
  servedKwhDelta: z.number(),
  offHoursBefore: z.number().int().min(0).max(24),
  offHoursAfter: z.number().int().min(0).max(24),
});
export type SectorImpact = z.infer<typeof SectorImpactSchema>;

/** Engine result before vs after a proposed change (shown in the approval dialog). */
export const ChangeImpactSchema = z.object({
  beforeResultId: z.string(),
  afterResultId: z.string(),
  strategyBefore: StrategyIdSchema,
  strategyAfter: StrategyIdSchema,
  socMinPctBefore: z.number(),
  socMinPctAfter: z.number(),
  unservedKwhBefore: z.number(),
  unservedKwhAfter: z.number(),
  sectors: z.record(SectorIdSchema, SectorImpactSchema),
});
export type ChangeImpact = z.infer<typeof ChangeImpactSchema>;

/** Why a patch endangers the clinic (K6 safety rule, see `clinicGuard`). */
export const ClinicGuardReasonSchema = z.enum([
  'cap_zero',
  'disconnected',
  'floor_zero',
  'lifeline_off',
]);
export type ClinicGuardReason = z.infer<typeof ClinicGuardReasonSchema>;
