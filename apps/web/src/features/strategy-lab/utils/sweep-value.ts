import type { SweepParam } from '@mitsinjo/engine';
import { fmtNum, fmtPct } from '@/lib/format';

/** Formats a swept parameter value with its unit: "1.2×" for demand, "30%" otherwise. */
export function fmtSweepValue(param: SweepParam, value: number): string {
  return param === 'demandMultiplier' ? `${fmtNum(value, 1)}×` : fmtPct(value, 0);
}
