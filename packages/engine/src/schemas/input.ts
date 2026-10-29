import { z } from 'zod';
import { PrioritySchema, ScenarioIdSchema, SectorIdSchema } from './common';

export const SectorConfigSchema = z.object({
  id: SectorIdSchema,
  label: z.string().min(1),
  priority: PrioritySchema,
  criticalShare: z.number().min(0).max(1),
  profileKw: z.array(z.number().min(0)).length(24),
  flexible: z.boolean(),
  meterReadings: z.array(z.number().min(0)).length(24).optional(),
});
export type SectorConfig = z.infer<typeof SectorConfigSchema>;

export const BatteryConfigSchema = z
  .object({
    capacityKwh: z.number().min(1).max(2000),
    initialSocPct: z.number().min(0).max(100),
    minSocPct: z.number().min(0).max(100),
    maxChargeKw: z.number().min(0).max(500),
    maxDischargeKw: z.number().min(0).max(500),
    chargeEff: z.number().min(0.5).max(1),
    dischargeEff: z.number().min(0.5).max(1),
  })
  .refine((b) => b.minSocPct < b.initialSocPct, {
    message: 'minSocPct must be strictly less than initialSocPct',
    path: ['minSocPct'],
  });
export type BatteryConfig = z.infer<typeof BatteryConfigSchema>;

export const SolarConfigSchema = z.object({
  peakKw: z.number().min(0).max(500),
  profile: z.array(z.number().min(0).max(1)).length(24),
});
export type SolarConfig = z.infer<typeof SolarConfigSchema>;

const BaseSolarDropEventSchema = z.object({
  type: z.literal('solar_drop'),
  startHour: z.number().int().min(0).max(23),
  durationH: z.number().int().min(1).max(24),
  factor: z.number().min(0).max(3),
});

export const SolarDropEventSchema = BaseSolarDropEventSchema.refine(
  (e) => e.startHour + e.durationH <= 24,
  {
    message: 'startHour + durationH must be <= 24',
    path: ['durationH'],
  }
);
export type SolarDropEvent = z.infer<typeof SolarDropEventSchema>;

const BaseDemandSpikeEventSchema = z.object({
  type: z.literal('demand_spike'),
  sector: z.union([SectorIdSchema, z.literal('all')]),
  startHour: z.number().int().min(0).max(23),
  durationH: z.number().int().min(1).max(24),
  factor: z.number().min(0).max(3),
});

export const DemandSpikeEventSchema = BaseDemandSpikeEventSchema.refine(
  (e) => e.startHour + e.durationH <= 24,
  {
    message: 'startHour + durationH must be <= 24',
    path: ['durationH'],
  }
);
export type DemandSpikeEvent = z.infer<typeof DemandSpikeEventSchema>;

export const ScenarioEventSchema = z
  .discriminatedUnion('type', [BaseSolarDropEventSchema, BaseDemandSpikeEventSchema])
  .refine((e) => e.startHour + e.durationH <= 24, {
    message: 'startHour + durationH must be <= 24',
    path: ['durationH'],
  });
export type ScenarioEvent = z.infer<typeof ScenarioEventSchema>;

export const SectorCapSchema = z
  .object({
    sector: SectorIdSchema,
    maxKw: z.number().min(0).max(500),
    fromHour: z.number().int().min(0).max(23),
    toHour: z.number().int().min(1).max(24),
  })
  .refine((c) => c.fromHour < c.toHour, {
    message: 'fromHour must be strictly less than toHour',
    path: ['toHour'],
  });
export type SectorCap = z.infer<typeof SectorCapSchema>;

export const BalancedWeightsSchema = z
  .object({
    critical: z.number().min(0).max(10),
    high: z.number().min(0).max(10),
    medium: z.number().min(0).max(10),
    low: z.number().min(0).max(10),
  })
  .refine((w) => w.critical > 0 || w.high > 0 || w.medium > 0 || w.low > 0, {
    message: 'At least one balanced weight must be strictly positive',
  });
export type BalancedWeights = z.infer<typeof BalancedWeightsSchema>;

export const StrategyParamsSchema = z.object({
  balancedWeights: BalancedWeightsSchema.optional(),
});
export type StrategyParams = z.infer<typeof StrategyParamsSchema>;

const REQUIRED_SECTORS = ['health', 'water', 'school', 'households', 'market'] as const;

export const SimulationInputSchema = z.object({
  scenarioId: z.union([ScenarioIdSchema, z.literal('custom')]),
  horizonH: z.literal(24),
  stepH: z.literal(1),
  solar: SolarConfigSchema,
  battery: BatteryConfigSchema,
  sectors: z
    .array(SectorConfigSchema)
    .length(5)
    .refine(
      (sectors) => {
        const ids = new Set(sectors.map((s) => s.id));
        return ids.size === 5 && REQUIRED_SECTORS.every((id) => ids.has(id));
      },
      {
        message:
          'Must contain exactly 5 sectors with unique ids (health, water, school, households, market)',
        path: ['sectors'],
      }
    ),
  events: z.array(ScenarioEventSchema),
  demandMultiplier: z.number().min(0.5).max(2),
  sectorCaps: z.array(SectorCapSchema).optional(),
  strategyParams: StrategyParamsSchema.optional(),
});
export type SimulationInput = z.infer<typeof SimulationInputSchema>;

export const InputPatchSchema = z.object({
  solarDropPct: z.number().min(0).max(90).optional(),
  dropStartHour: z.number().int().min(0).max(23).optional(),
  dropDurationH: z.number().int().min(1).max(24).optional(),
  demandMultiplier: z.number().min(0.5).max(2).optional(),
  batteryCapacityKwh: z.number().min(1).max(2000).optional(),
  initialSocPct: z.number().min(0).max(100).optional(),
  minSocPct: z.number().min(0).max(100).optional(),
  priorities: z.record(SectorIdSchema, PrioritySchema).optional(),
  sectorCaps: z.array(SectorCapSchema).optional(),
  meterReadings: z.record(SectorIdSchema, z.array(z.number().min(0)).length(24)).optional(),
  criticalShares: z.record(SectorIdSchema, z.number().min(0).max(1)).optional(),
  balancedWeights: z
    .object({
      critical: z.number().min(0).max(10).optional(),
      high: z.number().min(0).max(10).optional(),
      medium: z.number().min(0).max(10).optional(),
      low: z.number().min(0).max(10).optional(),
    })
    .optional(),
});
export type InputPatch = z.infer<typeof InputPatchSchema>;
