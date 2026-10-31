import { z } from 'zod';
import { HORIZON_H } from '../constants';

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
