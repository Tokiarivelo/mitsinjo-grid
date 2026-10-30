import { SECTOR_IDS } from '@mitsinjo/engine';

export const KNOWN_SECTORS = new Set<string>(SECTOR_IDS);

export const KNOWN_STRATEGIES = new Set(['essential_first', 'proportional', 'balanced']);

export const KNOWN_CHANNELS = new Set([
  'demandKwh',
  'servedKwh',
  'unservedKwh',
  'coveragePct',
  'criticalCoveragePct',
  'criticalDemandKwh',
  'criticalUnservedKwh',
  'criticalUnmetHours',
  'solarPeakKw',
  'solarKwh',
  'curtailedKwh',
  'batteryCapacityKwh',
  'socStartPct',
  'socEndPct',
  'socMinPct',
  // propose_change impact (M1-T1)
  'servedKwhBefore',
  'servedKwhAfter',
  'servedKwhDelta',
  'offHoursBefore',
  'offHoursAfter',
  'socMinPctBefore',
  'socMinPctAfter',
  'unservedKwhBefore',
  'unservedKwhAfter',
]);

export interface TelemetryFormatTranslators {
  tChannels?: (key: string) => string;
  tSectors?: (key: string) => string;
  tStrategies?: (key: string) => string;
}

/**
 * Format unknown or raw identifiers into clean, human-readable Title Case strings with unit annotations.
 * e.g. "foo_barKwh" -> "Foo Bar (kWh)"
 */
export function formatFallbackChannel(key: string): string {
  let label = key
    .replace(/_/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .trim();

  // Clean unit notations
  if (/(\b| )Kwh$/i.test(label)) {
    label = label.replace(/(\b| )Kwh$/i, ' (kWh)');
  } else if (/(\b| )Kw$/i.test(label)) {
    label = label.replace(/(\b| )Kw$/i, ' (kW)');
  } else if (/(\b| )Pct$/i.test(label)) {
    label = label.replace(/(\b| )Pct$/i, ' (%)');
  } else if (/(\b| )Hours$/i.test(label)) {
    label = label.replace(/(\b| )Hours$/i, ' (h)');
  }

  return label
    .split(' ')
    .map((word) => {
      if (word.startsWith('(')) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

/**
 * Formats a telemetry channel key (e.g. "health_demandKwh", "proportional_criticalCoveragePct", "solarPeakKw")
 * into a human-readable labeled text based on active locale translators.
 */
export function formatTelemetryChannel(
  channelKey: string,
  translators?: TelemetryFormatTranslators
): string {
  if (!channelKey) return '';

  const { tChannels, tSectors, tStrategies } = translators || {};

  // 1. Sector prefix (e.g. health_demandKwh)
  for (const sector of KNOWN_SECTORS) {
    const prefix = `${sector}_`;
    if (channelKey.startsWith(prefix)) {
      const metricSuffix = channelKey.slice(prefix.length);
      const sectorLabel = tSectors ? tSectors(sector) : capitalize(sector);
      const channelLabel =
        KNOWN_CHANNELS.has(metricSuffix) && tChannels
          ? tChannels(metricSuffix)
          : formatFallbackChannel(metricSuffix);
      return `${sectorLabel} — ${channelLabel}`;
    }
  }

  // 2. Strategy prefix (e.g. essential_first_criticalCoveragePct, proportional_unservedKwh)
  for (const strategy of KNOWN_STRATEGIES) {
    const prefix = `${strategy}_`;
    if (channelKey.startsWith(prefix)) {
      const metricSuffix = channelKey.slice(prefix.length);
      const strategyLabel = tStrategies ? tStrategies(strategy) : capitalize(strategy);
      const channelLabel =
        KNOWN_CHANNELS.has(metricSuffix) && tChannels
          ? tChannels(metricSuffix)
          : formatFallbackChannel(metricSuffix);
      return `${strategyLabel} — ${channelLabel}`;
    }
  }

  // 3. Direct standalone channel (e.g. solarPeakKw, criticalCoveragePct)
  if (KNOWN_CHANNELS.has(channelKey) && tChannels) {
    return tChannels(channelKey);
  }

  // 4. Fallback formatter
  return formatFallbackChannel(channelKey);
}

function capitalize(str: string): string {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}
