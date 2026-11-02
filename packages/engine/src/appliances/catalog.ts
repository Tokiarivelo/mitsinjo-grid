import { HORIZON_H } from '../constants';
import type { ApplianceCategory, ApplianceSpec } from '../schemas';

/** [startHour, endHour) window and its duty ratio; later windows override earlier ones. */
type DutyWindow = readonly [start: number, end: number, duty: number];

/** 24 duty values: `base` everywhere, then each window applied in order. */
function duty(base: number, ...windows: DutyWindow[]): number[] {
  const out = new Array<number>(HORIZON_H).fill(base);
  for (const [start, end, value] of windows) {
    for (let t = start; t < end; t++) out[t] = value;
  }
  return out;
}

function spec(
  category: ApplianceCategory,
  watts: { defaultW: number; minW: number; maxW: number },
  hourlyDuty: number[]
): ApplianceSpec {
  return { category, ...watts, hourlyDuty };
}

/**
 * Typical rural appliances: rated power (W) and default daily use.
 * Orders of magnitude for village use; sources in docs/engine-spec.md § "Appliance catalog".
 */
export const APPLIANCE_CATALOG: Readonly<Record<ApplianceCategory, ApplianceSpec>> = {
  // Compressor cycles all day, a bit more in the afternoon heat.
  fridge: spec('fridge', { defaultW: 100, minW: 50, maxW: 300 }, duty(0.35, [12, 18, 0.5])),
  freezer: spec('freezer', { defaultW: 150, minW: 80, maxW: 400 }, duty(0.4, [12, 18, 0.55])),
  // Solar vaccine fridge (WHO PQS class): small, steady, never off.
  fridge_vaccine: spec(
    'fridge_vaccine',
    { defaultW: 60, minW: 30, maxW: 150 },
    duty(0.35, [12, 18, 0.45])
  ),
  tv: spec(
    'tv',
    { defaultW: 60, minW: 20, maxW: 200 },
    duty(0, [12, 14, 0.3], [18, 22, 1], [22, 23, 0.4])
  ),
  lamp: spec(
    'lamp',
    { defaultW: 10, minW: 3, maxW: 60 },
    duty(0, [5, 6, 0.5], [18, 22, 1], [22, 24, 0.3])
  ),
  fan: spec('fan', { defaultW: 50, minW: 20, maxW: 100 }, duty(0, [11, 16, 0.8], [19, 22, 0.5])),
  laptop: spec(
    'laptop',
    { defaultW: 50, minW: 20, maxW: 120 },
    duty(0, [8, 17, 0.6], [19, 21, 0.3])
  ),
  computer: spec('computer', { defaultW: 150, minW: 60, maxW: 300 }, duty(0, [8, 17, 0.8])),
  phone_charger: spec(
    'phone_charger',
    { defaultW: 5, minW: 2, maxW: 20 },
    duty(0, [12, 14, 0.3], [18, 22, 0.5])
  ),
  radio: spec(
    'radio',
    { defaultW: 10, minW: 3, maxW: 40 },
    duty(0, [6, 8, 0.5], [12, 13, 0.5], [18, 21, 0.7])
  ),
  // Pumping follows the sun (fills a tank).
  water_pump: spec(
    'water_pump',
    { defaultW: 750, minW: 200, maxW: 3000 },
    duty(0, [8, 9, 0.5], [9, 15, 1], [15, 16, 0.5])
  ),
  // Rice huller: morning and afternoon batches, idle at lunch.
  rice_mill: spec(
    'rice_mill',
    { defaultW: 7500, minW: 3000, maxW: 15000 },
    duty(0, [8, 12, 0.6], [14, 17, 0.6])
  ),
  sewing_machine: spec(
    'sewing_machine',
    { defaultW: 100, minW: 50, maxW: 250 },
    duty(0, [8, 12, 0.5], [14, 17, 0.5])
  ),
  // Arc welder: short bursts.
  welder: spec(
    'welder',
    { defaultW: 3000, minW: 1500, maxW: 6000 },
    duty(0, [9, 12, 0.3], [14, 16, 0.3])
  ),
  other: spec('other', { defaultW: 100, minW: 1, maxW: 5000 }, duty(0, [8, 18, 0.5])),
};
