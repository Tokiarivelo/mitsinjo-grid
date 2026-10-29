import type { SimulationInput } from '../schemas';

/**
 * Solar irradiance profile (fraction 0..1 of peakKw).
 * Tuned bell curve (06:00 to 18:00) so that:
 * - baseline has 0 unserved energy across 24h
 * - cloudy_afternoon (solar x0.6 for 2h at 13-15h, initialSoc 35%) creates an evening deficit
 *   where proportional sheds clinic power (criticalUnservedKwh > 0)
 *   while essential_first fully protects it (criticalUnservedKwh === 0).
 */
export const SOLAR_PROFILE_BASELINE: readonly number[] = [
  0, 0, 0, 0, 0, 0, 0.02, 0.077, 0.164, 0.266, 0.368, 0.439, 0.485, 0.47, 0.368, 0.245, 0.143,
  0.051, 0.01, 0, 0, 0, 0, 0,
];

export const HEALTH_PROFILE_BASELINE: readonly number[] = [
  0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 1.2, 1.2, 1.2, 1.2, 1.2, 1.2, 1.2, 1.2, 1.2, 1.2, 0.6,
  0.6, 0.6, 0.6, 0.6, 0.6,
];

export const WATER_PROFILE_BASELINE: readonly number[] = [
  0, 0, 0, 0, 0, 0, 0, 0, 3.0, 3.0, 3.0, 3.0, 3.0, 3.0, 3.0, 3.0, 0, 0, 0, 0, 0, 0, 0, 0,
];

export const SCHOOL_PROFILE_BASELINE: readonly number[] = [
  0, 0, 0, 0, 0, 0, 0, 1.5, 1.5, 1.5, 1.5, 1.5, 1.5, 1.5, 1.5, 1.5, 0, 0, 0, 0, 0, 0, 0, 0,
];

export const HOUSEHOLDS_PROFILE_BASELINE: readonly number[] = [
  1.5, 1.5, 1.5, 1.5, 1.5, 1.5, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 6.0,
  6.0, 6.0, 6.0, 1.5, 1.5,
];

export const MARKET_PROFILE_BASELINE: readonly number[] = [
  0, 0, 0, 0, 0, 0, 0, 0, 2.0, 2.0, 2.0, 2.0, 2.0, 2.0, 2.0, 2.0, 2.0, 2.0, 0, 0, 0, 0, 0, 0,
];

/** Small factory (rice mill / workshop): daytime shifts, a heavy flexible load. */
export const INDUSTRY_PROFILE_BASELINE: readonly number[] = [
  0, 0, 0, 0, 0, 0, 0, 4.0, 8.0, 8.0, 8.0, 8.0, 6.0, 8.0, 8.0, 8.0, 8.0, 4.0, 0, 0, 0, 0, 0, 0,
];

export function createBaselineInput(): SimulationInput {
  return {
    scenarioId: 'baseline',
    horizonH: 24,
    stepH: 1,
    solar: {
      peakKw: 40,
      profile: [...SOLAR_PROFILE_BASELINE],
    },
    battery: {
      capacityKwh: 120,
      initialSocPct: 60,
      minSocPct: 20,
      maxChargeKw: 25,
      maxDischargeKw: 25,
      chargeEff: 0.95,
      dischargeEff: 0.95,
    },
    sectors: [
      {
        id: 'health',
        label: 'Health Clinic',
        priority: 'critical',
        criticalShare: 0.8,
        profileKw: [...HEALTH_PROFILE_BASELINE],
        flexible: false,
      },
      {
        id: 'water',
        label: 'Water Pumping',
        priority: 'high',
        criticalShare: 0.3,
        profileKw: [...WATER_PROFILE_BASELINE],
        flexible: true,
      },
      {
        id: 'school',
        label: 'School',
        priority: 'medium',
        criticalShare: 0.1,
        profileKw: [...SCHOOL_PROFILE_BASELINE],
        flexible: false,
      },
      {
        id: 'households',
        label: 'Households',
        priority: 'medium',
        criticalShare: 0.2,
        profileKw: [...HOUSEHOLDS_PROFILE_BASELINE],
        flexible: false,
      },
      {
        id: 'market',
        label: 'Market & Small Businesses',
        priority: 'low',
        criticalShare: 0.1,
        profileKw: [...MARKET_PROFILE_BASELINE],
        flexible: false,
      },
      {
        id: 'industry',
        label: 'Small Factory',
        priority: 'low',
        criticalShare: 0,
        profileKw: [...INDUSTRY_PROFILE_BASELINE],
        flexible: true,
        // Not connected by default: baseline results stay unchanged; connect it live (load > 0).
        loadMultiplier: 0,
      },
    ],
    events: [],
    demandMultiplier: 1.0,
  };
}
