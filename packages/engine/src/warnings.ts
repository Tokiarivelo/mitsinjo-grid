import { EPS } from './constants';
import type { BatteryConfig, SectorId, SimulationInput, SimWarning, StepResult } from './schemas';

interface RawWarning {
  code: SimWarning['code'];
  sector?: SectorId;
  hour: number;
}

export function generateWarnings(
  steps: readonly StepResult[],
  battery: BatteryConfig,
  input?: SimulationInput
): SimWarning[] {
  const raw: RawWarning[] = [];

  for (let t = 0; t < steps.length; t++) {
    const step = steps[t];
    if (!step) continue;
    const sectorEntries = Object.entries(step.sectors) as [
      SectorId,
      (typeof step.sectors)[SectorId],
    ][];

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

    // 5. SECTOR_CAPPED: active capacity cap constrained this sector in step t
    if (input?.sectorCaps && input.sectorCaps.length > 0) {
      for (const cap of input.sectorCaps) {
        if (t >= cap.fromHour && t < cap.toHour) {
          const s = step.sectors[cap.sector];
          if (s && s.demandKw > cap.maxKw + EPS && s.servedKw <= cap.maxKw + EPS) {
            raw.push({ code: 'SECTOR_CAPPED', sector: cap.sector, hour: t });
          }
        }
      }
    }
  }

  // 6. ANOMALY_TO_VERIFY: detector for persistent gap vs profile > 25% for >= 2 h
  if (input?.sectors) {
    for (const s of input.sectors) {
      if (s.meterReadings && s.meterReadings.length === steps.length) {
        const divergentHours: number[] = [];
        for (let t = 0; t < steps.length; t++) {
          let spikeMultiplier = 1;
          for (const ev of input.events) {
            if (
              ev.type === 'demand_spike' &&
              (ev.sector === 'all' || ev.sector === s.id) &&
              t >= ev.startHour &&
              t < ev.startHour + ev.durationH
            ) {
              spikeMultiplier *= ev.factor;
            }
          }
          const baseDemand = s.profileKw[t] ?? 0;
          const expectedKw = baseDemand * input.demandMultiplier * spikeMultiplier;
          const meterKw = s.meterReadings[t] ?? 0;

          let gap = 0;
          if (expectedKw > EPS) {
            gap = Math.abs(meterKw - expectedKw) / expectedKw;
          } else if (meterKw > EPS) {
            gap = 1.0;
          }

          if (gap > 0.25) {
            divergentHours.push(t);
          }
        }

        let currentRun: number[] = [];
        for (let i = 0; i < divergentHours.length; i++) {
          const h = divergentHours[i]!;
          if (currentRun.length === 0 || h === currentRun[currentRun.length - 1]! + 1) {
            currentRun.push(h);
          } else {
            if (currentRun.length >= 2) {
              for (const hour of currentRun) {
                raw.push({ code: 'ANOMALY_TO_VERIFY', sector: s.id, hour });
              }
            }
            currentRun = [h];
          }
        }
        if (currentRun.length >= 2) {
          for (const hour of currentRun) {
            raw.push({ code: 'ANOMALY_TO_VERIFY', sector: s.id, hour });
          }
        }
      }
    }
  }

  // Sort raw warnings by hour before merging consecutive intervals
  raw.sort((a, b) => a.hour - b.hour);

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
