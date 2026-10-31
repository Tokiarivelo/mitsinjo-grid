import { HORIZON_H } from '../constants';
import type { SectorApplianceKw } from '../model/demand';
import type { Appliance, SectorId } from '../schemas';
import { APPLIANCE_CATALOG } from './catalog';

/** 24 h load of one appliance line (kW): watts × quantity × hourly duty / 1000. */
export function applianceProfileKw(appliance: Appliance): number[] {
  const dutyProfile = appliance.hourlyDuty ?? APPLIANCE_CATALOG[appliance.category].hourlyDuty;
  const kw = (appliance.watts * appliance.quantity) / 1000;
  const out = new Array<number>(HORIZON_H);
  for (let t = 0; t < HORIZON_H; t++) out[t] = kw * (dutyProfile[t] ?? 0);
  return out;
}

/** Sum of appliance profiles per sector (kW per hour). Sectors without appliances are absent. */
export function sectorApplianceKw(appliances: readonly Appliance[] = []): SectorApplianceKw {
  const bySector: Partial<Record<SectorId, number[]>> = {};
  for (const a of appliances) {
    const profile = applianceProfileKw(a);
    const sum = (bySector[a.sector] ??= new Array<number>(HORIZON_H).fill(0));
    for (let t = 0; t < HORIZON_H; t++) sum[t]! += profile[t]!;
  }
  return bySector;
}
