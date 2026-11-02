import { z } from 'zod';
import { ScenarioEventSchema } from '../schemas/input';
import { StrategyIdSchema } from '../schemas/common';

/**
 * Generated scenario overlay (M12-T2, D1): JSON the scenario generator writes. Applied onto
 * baseline by the harness only — never registered in `scenarios/` (the enum, the registry test
 * and the engine version stay untouched). Internal tooling shape, not exported from the index.
 */
const BatteryOverlaySchema = z
  .object({
    capacityKwh: z.number().min(1).max(2000),
    initialSocPct: z.number().min(0).max(100),
    minSocPct: z.number().min(0).max(100),
    maxChargeKw: z.number().min(0),
    maxDischargeKw: z.number().min(0),
  })
  .partial();

export const GeneratedAssertionSchema = z.object({
  strategy: StrategyIdSchema,
  metric: z.enum([
    'violations',
    'demandKwh',
    'servedKwh',
    'unservedKwh',
    'criticalUnservedKwh',
    'socMinPct',
  ]),
  op: z.enum(['eq', 'gt', 'gte', 'lt', 'lte']),
  value: z.number(),
});
export type GeneratedAssertion = z.infer<typeof GeneratedAssertionSchema>;

export const GeneratedScenarioSchema = z.object({
  id: z.string().regex(/^[a-z0-9_]+$/),
  title: z.string().min(1).max(80),
  description: z.string().min(1).max(500),
  base: z.literal('baseline'),
  events: z.array(ScenarioEventSchema).min(1).max(6),
  battery: BatteryOverlaySchema.optional(),
  assertions: z.array(GeneratedAssertionSchema).min(1).max(12),
});
export type GeneratedScenario = z.infer<typeof GeneratedScenarioSchema>;
