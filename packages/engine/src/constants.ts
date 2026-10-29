import type { Priority, SectorId, StrategyId, WeatherId } from './schemas';

export const ENGINE_VERSION = '0.2.0';

export const EPS = 1e-9;

export const HORIZON_H = 24 as const;
export const STEP_H = 1 as const;

/** Solar drop window used when a patch adds a drop without start/duration. */
export const DEFAULT_DROP_START_HOUR = 12;
export const DEFAULT_DROP_DURATION_H = 3;

export const DEFAULT_BALANCED_WEIGHTS: Record<Priority, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

/**
 * Validated baseline lifeline power floors (kW) per sector (PL-T1).
 * When energy is constrained, connected sectors maintain this floor instead of dropping to 0 kW.
 */
export const DEFAULT_LIFELINE_KW: Record<SectorId, number> = {
  health: 0.3,
  water: 0.2,
  school: 0.1,
  households: 0.4,
  market: 0.1,
};

export const STRATEGIES: Record<StrategyId, { label: string; rule: string }> = {
  proportional: {
    label: 'Proportional',
    rule: 'Share available energy proportionally to demand across all sectors',
  },
  essential_first: {
    label: 'Essential First',
    rule: 'Strict priority waterfall: critical > high > medium > low',
  },
  balanced: {
    label: 'Balanced',
    rule: 'Serve critical shares for all first, then water-fill remaining demand by priority weights',
  },
};

/** Share of the clear-sky solar profile produced under each daily weather preset. */
export const WEATHER_SOLAR_FACTOR: Record<WeatherId, number> = {
  sunny: 1,
  partly_cloudy: 0.75,
  cloudy: 0.5,
  rainy: 0.3,
  storm: 0.15,
};
