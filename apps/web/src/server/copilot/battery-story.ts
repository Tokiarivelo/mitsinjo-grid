import 'server-only';

import {
  SECTOR_IDS,
  type SectorId,
  type SimulationInput,
  type SimulationResult,
} from '@mitsinjo/engine';

/**
 * Battery post-mortem (M7-T3): why the battery sat where it sat at hour H. Pure reader over the
 * engine steps — the drain window runs from the last SoC peak at or before H, every figure below
 * is a sum over that window, and the mock turns it into the causal narrative.
 */

export interface BatteryStorySector {
  sector: SectorId;
  kwh: number;
}

export interface BatteryStory {
  hour: number;
  socPct: number;
  peak: { hour: number; socPct: number };
  solarKwhSincePeak: number;
  demandKwhSincePeak: number;
  dischargedKwh: number;
  unservedKwhSincePeak: number;
  /** Sectors shorted inside the window, most kWh first. */
  unservedBySector: BatteryStorySector[];
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function batteryStory(
  input: SimulationInput,
  result: SimulationResult,
  hour: number
): BatteryStory {
  const h = Math.min(23, Math.max(0, Math.floor(hour)));
  const steps = result.steps.slice(0, h + 1);
  const maxSoc = Math.max(...steps.map((s) => s.socPct));
  const peakHour = steps.reduce((last, s, i) => (s.socPct === maxSoc ? i : last), 0);
  const window = result.steps.slice(peakHour + 1, h + 1);
  const cap = input.battery.capacityKwh;

  let discharged = 0;
  for (let t = peakHour + 1; t <= h; t++) {
    const drop = (result.steps[t - 1]?.socPct ?? 0) - (result.steps[t]?.socPct ?? 0);
    if (drop > 0) discharged += (drop / 100) * cap;
  }

  const shortBySector = new Map<SectorId, number>();
  for (const step of window) {
    for (const id of SECTOR_IDS) {
      const s = step.sectors[id];
      if (!s) continue;
      const short = s.demandKw - s.servedKw;
      if (short > 0) shortBySector.set(id, (shortBySector.get(id) ?? 0) + short);
    }
  }
  const unservedBySector = [...shortBySector.entries()]
    .map(([sector, kwh]) => ({ sector, kwh: round2(kwh) }))
    .filter((s) => s.kwh > 0)
    .sort((a, b) => b.kwh - a.kwh);

  return {
    hour: h,
    socPct: round2(result.steps[h]?.socPct ?? 0),
    peak: { hour: peakHour, socPct: round2(maxSoc) },
    solarKwhSincePeak: round2(window.reduce((n, s) => n + s.solarKw, 0)),
    demandKwhSincePeak: round2(window.reduce((n, s) => n + s.demandKw, 0)),
    dischargedKwh: round2(discharged),
    unservedKwhSincePeak: round2(unservedBySector.reduce((n, s) => n + s.kwh, 0)),
    unservedBySector,
  };
}

/** First hour with the lowest SoC: the default "when was it emptiest" question. */
export function lowestSocHour(result: SimulationResult): number {
  let best = 0;
  for (const step of result.steps) {
    if (step.socPct < (result.steps[best]?.socPct ?? Infinity)) best = step.t;
  }
  return best;
}
