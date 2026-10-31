import { z } from 'zod';
import { HORIZON_H } from '../constants';
import { APPLIANCE_CATALOG } from '../appliances/catalog';
import { SectorIdSchema } from './common';

/** Appliance kinds vision can map a detection to (closed list, PV). `other` = unknown load. */
export const APPLIANCE_CATEGORIES = [
  'fridge',
  'freezer',
  'tv',
  'lamp',
  'fan',
  'laptop',
  'phone_charger',
  'radio',
  'water_pump',
  'rice_mill',
  'sewing_machine',
  'welder',
  'fridge_vaccine',
  'computer',
  'other',
] as const;
export const ApplianceCategorySchema = z.enum(APPLIANCE_CATEGORIES);
export type ApplianceCategory = z.infer<typeof ApplianceCategorySchema>;

/** 24 hourly duty ratios (0–1): share of the hour the appliance draws its rated power. */
export const HourlyDutySchema = z.array(z.number().min(0).max(1)).length(HORIZON_H);

/** Read-only catalog entry: rated power bounds (W) and the default daily use profile. */
export const ApplianceSpecSchema = z
  .object({
    category: ApplianceCategorySchema,
    defaultW: z.number().positive(),
    minW: z.number().positive(),
    maxW: z.number().positive(),
    hourlyDuty: HourlyDutySchema,
  })
  .refine((s) => s.minW <= s.defaultW && s.defaultW <= s.maxW, {
    message: 'minW ≤ defaultW ≤ maxW',
  });
export type ApplianceSpec = z.infer<typeof ApplianceSpecSchema>;

/** Max appliances inserted in one simulation (keeps the hot path and the prompt small). */
export const MAX_APPLIANCES = 30;

/**
 * An appliance inserted into the simulation (from a photo or by hand). Load comes from the engine:
 * watts × quantity × hourly duty (default = catalog profile), added to its sector.
 */
export const ApplianceSchema = z
  .object({
    id: z.string().min(1).max(64),
    name: z.string().trim().min(1).max(40),
    category: ApplianceCategorySchema,
    sector: SectorIdSchema,
    /** Rated power of one unit (W), within the catalog bounds of its category. */
    watts: z.number().positive(),
    quantity: z.number().int().min(1).max(50),
    hourlyDuty: HourlyDutySchema.optional(),
  })
  .superRefine((a, ctx) => {
    const { minW, maxW } = APPLIANCE_CATALOG[a.category];
    if (a.watts < minW || a.watts > maxW) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['watts'],
        message: `watts must be within ${minW}–${maxW} W for ${a.category}`,
      });
    }
  });
export type Appliance = z.infer<typeof ApplianceSchema>;

export const AppliancesSchema = z
  .array(ApplianceSchema)
  .max(MAX_APPLIANCES)
  .refine((list) => new Set(list.map((a) => a.id)).size === list.length, {
    message: 'Appliance ids must be unique',
  });
