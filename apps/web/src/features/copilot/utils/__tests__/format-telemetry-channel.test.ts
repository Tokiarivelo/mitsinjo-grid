import { describe, it, expect } from 'vitest';
import { formatTelemetryChannel, formatFallbackChannel } from '../format-telemetry-channel';

describe('formatTelemetryChannel', () => {
  const mockTranslators = {
    tChannels: (key: string) => {
      const map: Record<string, string> = {
        demandKwh: "Demande d'énergie (kWh)",
        servedKwh: 'Énergie desservie (kWh)',
        unservedKwh: 'Énergie non desservie (kWh)',
        coveragePct: 'Taux de couverture (%)',
        criticalCoveragePct: 'Couverture besoins critiques (%)',
        solarPeakKw: 'Puissance crête solaire (kW)',
        batteryCapacityKwh: 'Capacité stockage batterie (kWh)',
      };
      return map[key] || key;
    },
    tSectors: (key: string) => {
      const map: Record<string, string> = {
        health: 'Centre de santé',
        water: "Station de pompage d'eau",
        school: 'École primaire',
        households: 'Foyers du village',
        market: 'Marché local',
      };
      return map[key] || key;
    },
    tStrategies: (key: string) => {
      const map: Record<string, string> = {
        proportional: 'Allocation proportionnelle',
        essential_first: 'Priorité aux services essentiels',
        balanced: 'Distribution équilibrée',
      };
      return map[key] || key;
    },
  };

  it('formats sector metrics with translated sector and metric names', () => {
    expect(formatTelemetryChannel('health_demandKwh', mockTranslators)).toBe(
      "Centre de santé — Demande d'énergie (kWh)"
    );
    expect(formatTelemetryChannel('health_servedKwh', mockTranslators)).toBe(
      'Centre de santé — Énergie desservie (kWh)'
    );
    expect(formatTelemetryChannel('health_coveragePct', mockTranslators)).toBe(
      'Centre de santé — Taux de couverture (%)'
    );
    expect(formatTelemetryChannel('health_unservedKwh', mockTranslators)).toBe(
      'Centre de santé — Énergie non desservie (kWh)'
    );
  });

  it('formats strategy comparison metrics', () => {
    expect(formatTelemetryChannel('proportional_criticalCoveragePct', mockTranslators)).toBe(
      'Allocation proportionnelle — Couverture besoins critiques (%)'
    );
    expect(formatTelemetryChannel('essential_first_criticalCoveragePct', mockTranslators)).toBe(
      'Priorité aux services essentiels — Couverture besoins critiques (%)'
    );
  });

  it('formats direct standalone metrics', () => {
    expect(formatTelemetryChannel('solarPeakKw', mockTranslators)).toBe(
      'Puissance crête solaire (kW)'
    );
    expect(formatTelemetryChannel('batteryCapacityKwh', mockTranslators)).toBe(
      'Capacité stockage batterie (kWh)'
    );
  });

  it('handles fallback gracefully when translators are omitted or missing keys', () => {
    expect(formatTelemetryChannel('health_demandKwh')).toBe('Health — Demand (kWh)');
    expect(formatTelemetryChannel('custom_telemetry_flowKw')).toBe('Custom Telemetry Flow (kW)');
  });

  it('formats fallback channel names with units correctly', () => {
    expect(formatFallbackChannel('total_demandKwh')).toBe('Total Demand (kWh)');
    expect(formatFallbackChannel('curtailedPct')).toBe('Curtailed (%)');
    expect(formatFallbackChannel('criticalUnmetHours')).toBe('Critical Unmet (h)');
  });
});
