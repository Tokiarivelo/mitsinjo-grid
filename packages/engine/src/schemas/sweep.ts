import { z } from 'zod';
import { StrategyIdSchema } from './common';
import type { StrategyId } from './common';
import { MetricsSchema } from './result';
import type { Metrics } from './result';

export const SweepParamSchema = z.enum(['solarDropPct', 'demandMultiplier', 'initialSocPct']);
export type SweepParam = z.infer<typeof SweepParamSchema>;

export const SweepConfigSchema = z
  .object({
    param: SweepParamSchema,
    from: z.number(),
    to: z.number(),
    step: z.number().positive(),
  })
  .refine((c) => c.from <= c.to, {
    message: 'from must be less than or equal to to',
    path: ['to'],
  })
  .refine(
    (c) => {
      const count = Math.floor((c.to - c.from) / c.step + 1e-9) + 1;
      return count >= 1 && count <= 20;
    },
    {
      message: 'sweep point count must be between 1 and 20',
      path: ['step'],
    }
  )
  .superRefine((c, ctx) => {
    if (c.param === 'solarDropPct') {
      if (c.from < 0 || c.to > 90) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'solarDropPct sweep range must be within [0, 90]',
          path: ['from'],
        });
      }
    } else if (c.param === 'demandMultiplier') {
      if (c.from < 0.5 || c.to > 2.0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'demandMultiplier sweep range must be within [0.5, 2.0]',
          path: ['from'],
        });
      }
    } else if (c.param === 'initialSocPct') {
      if (c.from < 0 || c.to > 100) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'initialSocPct sweep range must be within [0, 100]',
          path: ['from'],
        });
      }
    }
  });

export type SweepConfig = z.infer<typeof SweepConfigSchema>;

export const SweepPointSchema = z.object({
  value: z.number(),
  metrics: z.record(StrategyIdSchema, MetricsSchema),
});
export type SweepPoint = {
  value: number;
  metrics: Partial<Record<StrategyId, Metrics>>;
};

export const SweepResultSchema = z.array(SweepPointSchema).max(20);
export type SweepResult = SweepPoint[];
