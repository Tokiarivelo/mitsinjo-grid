import { EPS } from './constants';
import type { BatteryConfig, SectorId, SimWarning, StepResult } from './schemas';

interface RawWarning {
  code: SimWarning['code'];
  sector?: SectorId;
  hour: number;
}

export function generateWarnings(
  steps: readonly StepResult[],
  battery: BatteryConfig
): SimWarning[] {
  const raw: RawWarning[] = [];

  for (let t = 0; t < steps.length; t++) {
    const step = steps[t];
    if (!step) continue;
    const sectorEntries = Object.entries(step.sectors) as [SectorId, (typeof step.sectors)[SectorId]][];

    // 1. CRITICAL_UNMET: any critical shortfall in this step
    let hasCriticalUnmet = false;
    for (let i = 0; i < sectorEntries.length; i++) {
      const entry = sectorEntries[i];
      if (!entry) continue;
      const [, s] = entry;
      if (!s) continue;
      if (s.criticalServedKw < s.criticalDemandKw - EPS) {
        hasCriticalUnmet = true;
        break;
      }
    }
    if (hasCriticalUnmet) {
      raw.push({ code: 'CRITICAL_UNMET', hour: t });
    }

    // 2. SECTOR_PARTIAL: each sector with shortfall
    for (let i = 0; i < sectorEntries.length; i++) {
      const entry = sectorEntries[i];
      if (!entry) continue;
      const [secId, s] = entry;
      if (!s) continue;
      if (s.servedKw < s.demandKw - EPS) {
        raw.push({ code: 'SECTOR_PARTIAL', sector: secId, hour: t });
      }
    }

    // 3. RESERVE_REACHED: soc <= minSoc + 0.5
    if (step.socPct <= battery.minSocPct + 0.5 + EPS) {
      raw.push({ code: 'RESERVE_REACHED', hour: t });
    }

    // 4. CURTAILMENT: curtailedKw > 0
    if (step.curtailedKw > EPS) {
      raw.push({ code: 'CURTAILMENT', hour: t });
    }
  }

  // Merge consecutive hours into ranges
  const merged: SimWarning[] = [];
  const map = new Map<string, SimWarning>();

  for (const item of raw) {
    const key = `${item.code}:${item.sector ?? ''}`;
    const active = map.get(key);

    if (active && active.toHour === item.hour - 1) {
      // Extend consecutive range
      active.toHour = item.hour;
    } else {
      // Start a new range
      const newWarning: SimWarning = {
        code: item.code,
        ...(item.sector ? { sector: item.sector } : {}),
        fromHour: item.hour,
        toHour: item.hour,
      };
      map.set(key, newWarning);
      merged.push(newWarning);
    }
  }

  return merged;
}
