/**
 * Engineering number formatters for Mitsinjo Grid.
 * Consistent precision, distinct kW vs kWh units, safe null/NaN handling.
 */

export const EMPTY_PLACEHOLDER = '—';

/**
 * Format active power in kilowatts (kW).
 * e.g. fmtKw(40.23) => "40.2 kW"
 */
export function fmtKw(
  kw: number | null | undefined,
  decimals = 1,
  fallback = EMPTY_PLACEHOLDER
): string {
  if (kw === null || kw === undefined || Number.isNaN(kw) || !Number.isFinite(kw)) {
    return fallback;
  }
  return `${kw.toFixed(decimals)} kW`;
}

/**
 * Format cumulative or step energy in kilowatt-hours (kWh).
 * e.g. fmtKwh(124.56) => "124.6 kWh"
 */
export function fmtKwh(
  kwh: number | null | undefined,
  decimals = 1,
  fallback = EMPTY_PLACEHOLDER
): string {
  if (kwh === null || kwh === undefined || Number.isNaN(kwh) || !Number.isFinite(kwh)) {
    return fallback;
  }
  return `${kwh.toFixed(decimals)} kWh`;
}

/**
 * Format percentages (0 - 100).
 * e.g. fmtPct(98.52) => "98.5%"
 */
export function fmtPct(
  pct: number | null | undefined,
  decimals = 1,
  fallback = EMPTY_PLACEHOLDER
): string {
  if (pct === null || pct === undefined || Number.isNaN(pct) || !Number.isFinite(pct)) {
    return fallback;
  }
  return `${pct.toFixed(decimals)}%`;
}

/**
 * Format hour index (0-23) to 24h clock string (e.g. 13 -> "13:00").
 */
export function fmtHour(hour: number | null | undefined): string {
  if (hour === null || hour === undefined || Number.isNaN(hour)) {
    return EMPTY_PLACEHOLDER;
  }
  const clamped = Math.max(0, Math.min(23, Math.floor(hour)));
  return `${clamped.toString().padStart(2, '0')}:00`;
}

/**
 * Format signed delta percentage (e.g. +12.4% or -40.0%).
 */
export function fmtDeltaPct(
  delta: number | null | undefined,
  decimals = 1,
  fallback = EMPTY_PLACEHOLDER
): string {
  if (delta === null || delta === undefined || Number.isNaN(delta) || !Number.isFinite(delta)) {
    return fallback;
  }
  const sign = delta > 0 ? '+' : '';
  return `${sign}${delta.toFixed(decimals)}%`;
}

/**
 * Format a bare number (unit shown separately, e.g. by MetricCard).
 * e.g. fmtNum(40.23) => "40.2"
 */
export function fmtNum(
  value: number | null | undefined,
  decimals = 1,
  fallback = EMPTY_PLACEHOLDER
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return fallback;
  }
  return value.toFixed(decimals);
}
